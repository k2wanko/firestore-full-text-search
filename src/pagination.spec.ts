import admin from 'firebase-admin';
import fs from 'fs/promises';
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
    const {items} = await fs
      .readFile(path.resolve(__dirname, '..', 'testdata', '5.en.json'))
      .then(res => res.toString('utf-8'))
      .then(res => JSON.parse(res));
    for (const {title, description} of items) {
      const ref = docs.doc(title);
      const data = {description};
      await ref.set(data);
      await fullTextSearch.set('en', ref, {data});
    }
  });
  it('basic', async () => {});
});
