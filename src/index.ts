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
  positions: Buffer;
  ref: DocumentReference;
};

export type SetOptions = {
  batch: WriteBatch;
  data: DocumentData;
};

export type SearchOptions = {
  limit: number;
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

    let query: SearchQuery;
    if (typeof stringOrQuery === 'string') {
      query = parseQuery(stringOrQuery);
    } else {
      query = stringOrQuery;
    }

    const results: {[key: string]: DocumentReference} = {};
    for (const keyword of query.keywords) {
      const tokens = tokenize(lang, keyword);
      for (const token of tokens) {
        const docsRef = this.#ref.doc(token.word).collection('docs');
        const query = docsRef.limit(options?.limit ?? 500);
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

    span.end();
    return Object.values(results);
  }
}
