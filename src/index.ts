import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
  Query,
  WriteBatch,
} from '@google-cloud/firestore';
import {FieldValue} from '@google-cloud/firestore';
import type {LanguageID, Token} from './tokenizer';
import tokenize from './tokenizer/tokenize';
import {trace, metrics} from '@opentelemetry/api';
import {parseQuery, SearchQuery} from './query';
import {calcScore} from './sort';
import {getCount, incrementCounter} from './counter';
import {WriteBatch2} from './utils/firestore';
import {createSearchContext} from './context';
import {Cursor, CursorBuilder, parseCursor} from './cursor';

export type FieldEntity = {
  __positions: Buffer;
  __score: number; // tf * idf
  __ref: DocumentReference;
};

export type WordEntity = {
  related: string[];
};

export type CounterEntity = {
  count: number;
};

export type Options = {
  sharedCounterNum?: number;
};

export type SetOptions = {
  batch?: WriteBatch;
  data?: DocumentData;
  indexMask?: string[];
  fields?: string[];
};

export type DeleteOptions = {
  batch?: WriteBatch;
  data?: DocumentData;
  indexMask?: string[];
};

export type SearchOptions = {
  limit?: number;
  cursor?: Cursor;
};

export type SearchResult = {
  hits: DocumentReference[];
  total: number;
  cursor?: Cursor;
};

export type FieldTypeEntity = {
  type: FieldType;
};

export type FieldType = 'string' | 'array' | 'number' | 'date';

const tracer = trace.getTracer('firestore-full-text-search');

const meter = metrics.getMeterProvider().getMeter('firestore-full-text-search');
const documentWriteCounter = meter.createCounter('document_write_count');
const documentWriteTokenCounter = meter.createCounter(
  'document_write_token_count'
);
// const searchTokenCounter = meter.createCounter('search_token_count');

const defaultSharedCounterNum = 3;

export default class FirestoreFullTextSearch {
  #ref: CollectionReference;
  #db: Firestore;
  #wordsRef: CollectionReference;
  #wordDocsRef: CollectionReference;
  #fieldsRef: CollectionReference;
  #options?: Options;

  constructor(ref: CollectionReference, options?: Options) {
    this.#ref = ref;
    this.#db = ref.firestore;
    this.#wordsRef = ref.doc('v1').collection('words');
    this.#wordDocsRef = ref.doc('v1').collection('word_docs');
    this.#fieldsRef = ref.doc('v1').collection('fields');
    this.#options = options;
  }

  async set(lang: LanguageID, doc: DocumentReference, options?: SetOptions) {
    const span = tracer.startSpan('set');
    span.setAttributes({
      index: this.#ref.path,
      doc: doc.path,
      lang,
    });
    let data = options?.data;
    if (!data) {
      const snap = await doc.get();
      if (!snap.exists) {
        throw new Error('Document does not exist.');
      }
      data = snap.data() as DocumentData; // exists checked.
    }

    const _data = data;
    if (!_data) {
      throw new Error('Document is empty');
    }

    const batch = new WriteBatch2(this.#db, {batch: options?.batch});
    const indexMask = options?.indexMask;
    const fields = options?.fields;

    const allDocCount = await getCount(this.#ref.doc('v1'));

    let newDocCount = 0;
    const newWordCountMap = new Map<string, number>();
    const tokensMap = new Map<string, Token[]>();
    const targetFields = new Set<string>();
    let writeCount = 0;
    let writeTokenCount = 0;
    for (const [fieldName, value] of Object.entries(data)) {
      if (indexMask) {
        if (!indexMask.includes(fieldName)) {
          continue;
        }
      }

      if (fieldName.startsWith('__')) {
        continue;
      }

      if (typeof value !== 'string') {
        continue;
      }
      targetFields.add(fieldName);
    }

    for (const fieldName of targetFields) {
      const value = data[fieldName];
      if (typeof value !== 'string') {
        continue;
      }
      const tokens = tokenize(lang, value);
      tokensMap.set(fieldName, tokens);
      for (const token of tokens) {
        const word = token.normalizedWord;
        if (!word) {
          continue;
        }

        const wordRef = this.#wordsRef.doc(word);
        const docRef = wordRef.collection('docs').doc(`${doc.id}.${fieldName}`);
        const res = await docRef.get();
        if (!res.exists) {
          newDocCount = 1;
          newWordCountMap.set(word, 1);
        }
      }
    }

    for (const fieldName of targetFields) {
      const value = data[fieldName];
      if (typeof value !== 'string') {
        continue;
      }

      const tokens = tokensMap.get(fieldName);
      if (!tokens) {
        throw new Error('Not found tokens');
      }
      for (const token of tokens) {
        const word = token.normalizedWord;
        if (!word) {
          continue;
        }
        const wordRef = this.#wordsRef.doc(word);
        const wordSnap = await wordRef.get();
        if (wordSnap.exists) {
          const wordData = wordSnap.data() as WordEntity;
          batch.set(
            wordRef,
            {
              related: Array.from(
                new Set(wordData.related.concat([token.word])).keys()
              ),
            },
            {merge: true}
          );
        } else {
          batch.set(wordRef, {related: [token.word]});
        }

        const wordDocCount = await getCount(wordRef);
        const docRef = wordRef.collection('docs').doc(`${doc.id}.${fieldName}`);
        const wordDocRef = this.#wordDocsRef.doc(`${word}.${doc.id}`);
        const docData = {
          __word: word,
          __fields: Array.from(targetFields.values()),
          __positions: new Uint8Array(token.positions),
          __score: calcScore(
            token.positions.length,
            tokens.length,
            wordDocCount + (newWordCountMap.get(word) ?? 0),
            allDocCount + newDocCount
          ),
          __ref: doc,
        };
        if (fields) {
          const fieldTypes: {[key: string]: FieldType} = {};
          const fieldData: {[key: string]: unknown} = {};
          const _fieldData = fields.reduce((p, name) => {
            const val = _data[name];
            if (Array.isArray(val)) {
              fieldTypes[name] = 'array';
              p[name] = val.sort();
            } else {
              if (val instanceof Date) {
                fieldTypes[name] = 'date';
                p[name] = val;
              } else if (
                val instanceof FieldValue &&
                val.isEqual(FieldValue.serverTimestamp())
              ) {
                fieldTypes[name] = 'date';
                p[name] = val;
              } else {
                switch (typeof val) {
                  case 'string':
                    fieldTypes[name] = 'string';
                    p[name] = _data[name];
                    break;
                  case 'number':
                    fieldTypes[name] = 'number';
                    p[name] = _data[name];
                    break;
                  default:
                    throw new Error(`Unsupport filed type ${typeof val}`);
                }
              }
            }
            return p;
          }, fieldData);
          for (const [name, type] of Object.entries(fieldTypes)) {
            batch.set(this.#fieldsRef.doc(name), {
              type,
            } as FieldTypeEntity);
          }
          batch.set(docRef, {...docData, ..._fieldData});
          batch.set(wordDocRef, {...docData, ..._fieldData});
        } else {
          batch.set(docRef, docData);
          batch.set(wordDocRef, docData);
        }

        if (newWordCountMap.has(word)) {
          await incrementCounter(
            wordRef,
            this.#options?.sharedCounterNum ?? defaultSharedCounterNum,
            newWordCountMap.get(word) ?? 0,
            {batch}
          );
        }
        writeCount += 1;
      }

      writeTokenCount += tokens.length;
    }

    await incrementCounter(
      this.#ref.doc('v1'),
      this.#options?.sharedCounterNum ?? defaultSharedCounterNum,
      newDocCount,
      {batch}
    );

    await batch.commit();

    documentWriteCounter
      .bind({
        index: this.#ref.path,
        lang,
      })
      .add(writeCount);
    documentWriteTokenCounter
      .bind({
        index: this.#ref.path,
        lang,
      })
      .add(writeTokenCount);
    span.end();
  }

  async delete(
    lang: LanguageID,
    doc: DocumentReference,
    options?: DeleteOptions
  ) {
    const span = tracer.startSpan('delete');
    span.setAttributes({
      index: this.#ref.path,
      doc: doc.path,
      lang,
    });

    let data = options?.data;
    if (!data) {
      const snap = await doc.get();
      if (!snap.exists) {
        throw new Error('Document does not exist.');
      }
      data = snap.data() as DocumentData; // exists checked.
    }

    const _data = data;
    if (!_data) {
      throw new Error('Document is empty');
    }

    const batch = new WriteBatch2(this.#db, {batch: options?.batch});
    const indexMask = options?.indexMask;
    let docCount = 0;

    for (const [fieldName, vaule] of Object.entries(data)) {
      if (indexMask) {
        if (!indexMask.includes(fieldName)) {
          continue;
        }
      }

      if (fieldName.startsWith('__')) {
        continue;
      }

      if (typeof vaule !== 'string') {
        continue;
      }

      const tokens = tokenize(lang, vaule);
      for (const token of tokens) {
        const word = token.normalizedWord;
        if (!word) {
          continue;
        }
        const wordRef = this.#wordsRef.doc(word);
        const docRef = wordRef.collection('docs').doc(`${doc.id}.${fieldName}`);
        const wordDocRef = this.#wordDocsRef.doc(`${word}.${doc.id}`);

        batch.delete(docRef);
        batch.delete(wordDocRef);
        await incrementCounter(
          wordRef,
          this.#options?.sharedCounterNum ?? defaultSharedCounterNum,
          -1,
          {batch}
        );
        docCount = 1;
      }
    }

    await incrementCounter(
      this.#ref.doc('v1'),
      this.#options?.sharedCounterNum ?? defaultSharedCounterNum,
      docCount * -1,
      {batch}
    );

    await batch.commit();

    span.end();
  }

  async search(
    lang: LanguageID,
    stringOrQuery: string | SearchQuery,
    options?: SearchOptions
  ): Promise<SearchResult> {
    const span = tracer.startSpan('search');
    span.setAttributes({
      index: this.#ref.path,
      lang,
    });

    const context = createSearchContext();
    const cursorQueue: string[] = [];

    let searchQuery: SearchQuery;
    if (typeof stringOrQuery === 'string') {
      searchQuery = parseQuery(stringOrQuery);
    } else {
      searchQuery = stringOrQuery;
    }
    context.query = searchQuery;

    let limit = options?.limit ?? 100;
    if (limit < 1) {
      limit = 1;
    } else if (limit > 500) {
      limit = 500;
    }
    context.limit = limit;

    const fields = searchQuery?.fields;
    type fieldInfo = {name: string; type: FieldType};
    let fieldInfos: fieldInfo[] | null = null;
    if (fields) {
      const snap = await this.#db.getAll(
        ...fields.map(field => this.#fieldsRef.doc(field.name))
      );
      fieldInfos = snap.map(doc => ({name: doc.id, type: doc.data()?.type}));
    }

    const words: string[] = [];
    let total = 0;
    for (const keyword of searchQuery.keywords) {
      const tokens = tokenize(lang, keyword);
      for (const token of tokens) {
        words.push(token.normalizedWord);
        const wordRef = this.#wordsRef.doc(token.normalizedWord);
        const count = await getCount(wordRef);
        if (count === 0) {
          continue;
        }
        total += count;
      }
    }

    let query: Query = this.#wordDocsRef;
    if (words.length === 1) {
      query = query.where('__word', '==', words[0]);
    } else {
      query = query.where('__word', 'in', words);
    }

    if (fieldInfos) {
      for (const info of fieldInfos) {
        if (!fields) {
          continue;
        }
        const field = fields.find(f => f.name === info.name);
        if (!field) {
          continue;
        }
        switch (info.type) {
          case 'string':
            query = query.where(field.name, field.operator, field.value);
            break;
          case 'array':
            switch (field.operator) {
              case '==':
                query = query.where(field.name, 'in', [[field.value].sort()]);
                break;
              case '!=':
                query = query.where(field.name, 'not-in', [
                  [field.value].sort(),
                ]);
                break;
              default:
            }
            break;
          default:
            query = query.where(field.name, field.operator, field.value);
        }
      }
    } else {
      query = query.orderBy('__score', 'desc');
      cursorQueue.push('__score');
    }

    const cursor = options?.cursor;
    if (cursor) {
      const info = await parseCursor(cursor);
      query = query.startAfter(
        ...info.fields.map(field => info.fieldValueMap[field])
      );
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    const snap = await query.get();

    if (snap.empty) {
      return {hits: [], total};
    }

    const lastVisible = snap.docs[snap.docs.length - 1];
    const cursorBuilder = new CursorBuilder();
    for (const queue of cursorQueue) {
      cursorBuilder.add(queue, lastVisible.data()[queue]);
    }

    const hits = snap.docs.map(doc => doc.data().__ref);

    return {
      hits,
      total,
      cursor: hits.length < limit ? undefined : await cursorBuilder.build(),
    };
  }
}
