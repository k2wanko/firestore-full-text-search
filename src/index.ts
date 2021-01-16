import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
  WriteBatch,
} from '@google-cloud/firestore';
import tokenize from './tokenizer/tokenize';
import type {LanguageID} from './tokenizer';

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

export default class FirestoreFullTextSearch {
  #ref: CollectionReference;
  #db: Firestore;
  constructor(ref: CollectionReference) {
    this.#ref = ref;
    this.#db = ref.firestore;
  }

  async set(lang: LanguageID, doc: DocumentReference, options?: SetOptions) {
    let data = options?.data;
    if (!data) {
      const snap = await doc.get();
      if (!snap.exists) {
        throw new Error('Document does not exist.');
      }
      data = snap.data() as DocumentData; // exists checked.
    }

    const batch = options?.batch ?? this.#db.batch();

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
      }
    }

    if (!options?.batch) {
      await batch.commit();
    }
  }

  async search(lang: LanguageID, query: string, options?: SearchOptions) {
    const tokens = tokenize(lang, query);
    const results: {[key: string]: DocumentReference} = {};
    for (const token of tokens) {
      const docsRef = this.#ref.doc(token.word).collection('docs');
      const query = docsRef.limit(options?.limit ?? 500);
      const snap = await query.get();
      for (const doc of snap.docs) {
        const data = doc.data() as FieldEntity;
        results[data.ref.id] = data.ref;
      }
    }

    return Object.values(results);
  }
}
