import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  FieldValue,
  Firestore,
  WriteBatch,
} from '@google-cloud/firestore';
import type {LanguageID} from './tokenizer';
import tokenize from './tokenizer/tokenize';
import {trace, metrics} from '@opentelemetry/api';
import {parseQuery, SearchQuery} from './query';

export type FieldEntity = {
  __positions: Buffer;
  __ref: DocumentReference;
};

export type SetOptions = {
  batch?: WriteBatch;
  data?: DocumentData;
  indexMask?: string[];
  fields?: string[];
};

export type SearchOptions = {
  limit?: number;
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
const searchTokenCounter = meter.createCounter('search_token_count');

export default class FirestoreFullTextSearch {
  #ref: CollectionReference;
  #db: Firestore;
  #wordsRef: CollectionReference;
  #fieldsRef: CollectionReference;

  constructor(ref: CollectionReference) {
    this.#ref = ref;
    this.#db = ref.firestore;
    this.#wordsRef = ref.doc('v1').collection('words');
    this.#fieldsRef = ref.doc('v1').collection('fields');
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

    const batch = options?.batch ?? this.#db.batch();
    const indexMask = options?.indexMask;
    const fields = options?.fields;

    let writeCount = 0;
    let writeTokenCount = 0;
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
        if (!token.word) {
          continue;
        }
        const docRef = this.#wordsRef
          .doc(token.word)
          .collection('docs')
          .doc(`${doc.id}.${fieldName}`);
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
          batch.set(docRef, {
            __positions: new Uint8Array(token.positions),
            __ref: doc,
            ..._fieldData,
          });
        } else {
          batch.set(docRef, {
            __positions: new Uint8Array(token.positions),
            __ref: doc,
          });
        }
        writeCount += 1;
      }
      writeTokenCount += tokens.length;
    }

    if (!options?.batch) {
      await batch.commit();
    }

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

  async search(
    lang: LanguageID,
    stringOrQuery: string | SearchQuery,
    options?: SearchOptions
  ) {
    const span = tracer.startSpan('search');
    span.setAttributes({
      index: this.#ref.path,
      lang,
    });

    let searchQuery: SearchQuery;
    if (typeof stringOrQuery === 'string') {
      searchQuery = parseQuery(stringOrQuery);
    } else {
      searchQuery = stringOrQuery;
    }

    let limit = options?.limit ?? 100;
    if (limit <= 0) {
      limit = 0;
    } else if (limit >= 500) {
      limit = 500;
    }

    const fields = searchQuery?.fields;
    type fieldInfo = {name: string; type: FieldType};
    let fieldInfos: fieldInfo[] | null = null;
    if (fields) {
      const snap = await this.#db.getAll(
        ...fields.map(field => this.#fieldsRef.doc(field.name))
      );
      fieldInfos = snap.map(doc => ({name: doc.id, type: doc.data()?.type}));
    }

    const results: {[key: string]: DocumentReference} = {};
    for (const keyword of searchQuery.keywords) {
      const tokens = tokenize(lang, keyword);
      for (const token of tokens) {
        const docsRef = this.#wordsRef.doc(token.word).collection('docs');

        let query = docsRef.limit(limit);
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
                    query = query.where(field.name, 'in', [
                      [field.value].sort(),
                    ]);
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
        }

        const snap = await query.get();
        for (const doc of snap.docs) {
          const data = doc.data() as FieldEntity;
          results[data.__ref.id] = data.__ref;
        }
      }

      searchTokenCounter
        .bind({
          index: this.#ref.path,
          lang,
        })
        .add(tokens.length);
    }
    span.end();
    return Object.values(results);
  }
}
