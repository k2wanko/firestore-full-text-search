import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
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
  fieldMask?: string[];
  fields?: string[];
};

export type SearchOptions = {
  limit?: number;
  typeHints: {[key: string]: TypeHint};
};

export type TypeHint = {
  type: 'string' | 'array';
};

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

  constructor(ref: CollectionReference) {
    this.#ref = ref;
    this.#db = ref.firestore;
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
    const fieldMask = options?.fieldMask;
    const fields = options?.fields;

    let writeCount = 0;
    let writeTokenCount = 0;
    for (const [fieldName, vaule] of Object.entries(data)) {
      if (fieldMask) {
        if (!fieldMask.includes(fieldName)) {
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
        const docRef = this.#ref
          .doc('v1')
          .collection('words')
          .doc(token.word)
          .collection('docs')
          .doc(`${doc.id}.${fieldName}`);
        if (fields) {
          const fieldTypes: {[key: string]: 'string' | 'array'} = {};
          const fieldData: {[key: string]: unknown} = {};
          const _fieldData = fields.reduce((p, name) => {
            const val = _data[name];
            if (Array.isArray(val)) {
              fieldTypes[name] = 'array';
              p[name] = _data[name];
            } else {
              switch (typeof val) {
                case 'string':
                  fieldTypes[name] = 'string';
                  p[name] = _data[name];
                  break;
                default:
                  throw new Error(`Unsupport filed type ${typeof val}`);
              }
            }
            return p;
          }, fieldData);
          for (const [name, type] of Object.entries(fieldTypes)) {
            batch.set(this.#ref.doc('v1').collection('fields').doc(name), {
              type,
              ref: doc,
            });
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
    type fieldInfo = {name: string; type: 'string' | 'array'};
    let fieldInfos: fieldInfo[] | null = null;
    if (fields) {
      const snap = await this.#db.getAll(
        ...fields.map(field =>
          this.#ref.doc('v1').collection('fields').doc(field.name)
        )
      );
      fieldInfos = snap.map(doc => ({name: doc.id, type: doc.data()?.type}));
    }

    const results: {[key: string]: DocumentReference} = {};
    for (const keyword of searchQuery.keywords) {
      const tokens = tokenize(lang, keyword);
      for (const token of tokens) {
        const docsRef = this.#ref
          .doc('v1')
          .collection('words')
          .doc(token.word)
          .collection('docs');

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
                query = query.where(field.name, 'array-contains-any', [
                  field.value,
                ]);
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
