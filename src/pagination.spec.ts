import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
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
    const {hits, total} = await fullTextSearch.search('en', 'member', {
      limit: 1,
    });
    expect(hits.length).toBe(1);
    expect(hits[0].path).toBe('animals/Cattle');
    expect(total).toBe(3);
  });

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
