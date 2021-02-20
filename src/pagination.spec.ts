import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import {getCount} from './counter';
import FirestoreFullTextSearch from './index';

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:5000';

admin.initializeApp({
  projectId: 'test',
});

const db = admin.firestore();
const docs = db.collection('animals');
const index = db.collection('pagination');
const fullTextSearch = new FirestoreFullTextSearch(index);

describe('pagination', () => {
  beforeAll(async () => {
    const count = await getCount(index.doc('v1'));
    if (count !== 0) {
      return;
    }

    const {items} = await new Promise((resolve, reject) => {
      fs.readFile(
        path.resolve(__dirname, '..', 'testdata', '5.en.json'),
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(JSON.parse(data.toString('utf-8')));
        }
      );
    });
    for (const {title, description} of items) {
      const batch = db.batch();
      const ref = docs.doc(title);
      const data = {description};
      await batch.set(ref, data);
      await fullTextSearch.set('en', ref, {data, batch});
      await batch.commit();
    }
  });

  it('basic', async () => {
    const {hits, total, cursor} = await fullTextSearch.search('en', 'member', {
      limit: 2,
    });

    // console.log({hits: hits.map(hit => hit.id), total, cursor});

    expect(hits.length).toBe(2);
    expect(hits.map(hit => hit.path)).toStrictEqual([
      'animals/Cattle',
      'animals/Cat',
    ]);
    expect(total).toBe(3);

    const {
      hits: hits2,
      total: total2,
      cursor: cursor2,
    } = await fullTextSearch.search('en', 'member', {
      limit: 2,
      cursor,
    });

    console.log({hits2: hits2.map(hit => hit.id), cursor2});

    expect(hits2.length).toBe(1);
    expect(cursor2).toBe(undefined);
    expect(hits2.map(hit => hit.path)).toStrictEqual(['animals/Bird']);
    expect(total2).toBe(3);
  });

  // it('startAfter', async () => {
  //   const wordsSnap = await db
  //     .collection('/pagination/v1/word_docs')
  //     .where('__word', '==', 'member')
  //     .orderBy('__score', 'desc')
  //     .limit(2)
  //     .get();

  //   const last = wordsSnap.docs[wordsSnap.docs.length - 1];
  //   console.log({ids: wordsSnap.docs.map(doc => doc.id)});

  //   const nextSnap = await db
  //     .collection('/pagination/v1/word_docs')
  //     .where('__word', '==', 'member')
  //     .orderBy('__score', 'desc')
  //     .startAfter(last)
  //     .limit(2)
  //     .get();
  //   console.log({ids: nextSnap.docs.map(doc => doc.id)});
  // });

  // it('startsWith', async () => {
  //   const wordsRef = index.doc('v1').collection('words');
  //   const query = startsWith(wordsRef, FieldPath.documentId(), 'a');
  //   const snap = await query.get();
  //   console.log({size: snap.size, path: wordsRef.path});
  //   for (const doc of snap.docs) {
  //     console.log(doc.id);
  //   }
  // });
});
