import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  FieldPath,
  Firestore,
  WhereFilterOp,
  WriteBatch,
} from '@google-cloud/firestore';
import type {LanguageID} from './tokenizer';
import tokenize from './tokenizer/tokenize';
import {trace, metrics} from '@opentelemetry/api';
import {parseQuery, SearchQuery} from './query';

export type FieldEntity = {
  positions: Buffer;
  ref: DocumentReference;
};

export type SetOptions = {
  batch: WriteBatch;
  data: DocumentData;
};

export type SearchOptions = {
  limit?: number;
  typeHints?: {[key: string]: TypeHint};
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

    const batch = options?.batch ?? this.#db.batch();

    let writeCount = 0;
    let writeTokenCount = 0;
    for (const [fieldName, vaule] of Object.entries(data)) {
      if (typeof vaule !== 'string') {
        continue;
      }

      const tokens = tokenize(lang, vaule);
      for (const token of tokens) {
        const docRef = this.#ref
          .doc(token.word)
          .collection('docs')
          .doc(`${doc.id}.${fieldName}`);
        batch.set(docRef, {
          positions: new Uint8Array(token.positions),
          ref: doc,
        });
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

    let limit = options?.limit ?? 500;
    if (limit <= 0) {
      limit = 0;
    } else if (limit >= 500) {
      limit = 500;
    }

    let results: {[key: string]: DocumentReference} = {};
    for (const keyword of searchQuery.keywords) {
      const tokens = tokenize(lang, keyword);
      for (const token of tokens) {
        const docsRef = this.#ref.doc(token.word).collection('docs');

        const query = docsRef.limit(limit);

        const snap = await query.get();
        for (const doc of snap.docs) {
          const data = doc.data() as FieldEntity;
          results[data.ref.id] = data.ref;
        }
      }

      searchTokenCounter
        .bind({
          index: this.#ref.path,
          lang,
        })
        .add(tokens.length);
    }

    const resultsVals = Object.values(results);
    if (resultsVals.length >= 1 && searchQuery.fields) {
      const res: {[key: string]: DocumentReference} = {};

      let query = this.#db.collection(resultsVals[0].parent.path).limit(limit);
      for (const ref of resultsVals) {
        query.where(FieldPath.documentId(), '==', ref.id);
      }

      const typeHints = options?.typeHints;

      // TODO: @k2wanko refactoring.
      for (const field of searchQuery.fields) {
        if (typeHints) {
          const typeHint = typeHints[field.name];
          if (typeHint) {
            switch (typeHint.type) {
              case 'array':
                if (field.operator === '==') {
                  query = query.where(field.name, 'array-contains-any', [
                    field.value,
                  ]);
                } else {
                  query = query.where(field.name, field.operator, field.value);
                }
                break;
              default:
                query = query.where(field.name, field.operator, field.value);
            }
            continue;
          }
        }
        query = query.where(field.name, field.operator, field.value);
      }

      const snap = await query.get();
      for (const doc of snap.docs) {
        res[doc.id] = doc.ref;
      }
      results = res;
    }

    span.end();
    return Object.values(results);
  }
}
