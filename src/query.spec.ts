import admin from 'firebase-admin';
import FirestoreFullTextSearch from './index';
import {parseQuery, SearchQuery} from './query';
import {Post} from './index.spec';

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:5000';

admin.initializeApp({
  projectId: 'test',
});

describe('parseQuery', () => {
  it('nothing', () => {
    const res = parseQuery('');
    const want: SearchQuery = {
      keywords: [],
    };
    expect(res).toStrictEqual(want);
  });

  it('simple', () => {
    const res = parseQuery('dog');
    const want: SearchQuery = {
      keywords: ['dog'],
    };
    expect(res).toStrictEqual(want);
  });

  it('2 keywords', () => {
    const res = parseQuery('dog cat');
    const want: SearchQuery = {
      keywords: ['dog', 'cat'],
    };
    expect(res).toStrictEqual(want);
  });

  it('has space keyword', () => {
    const res = parseQuery('"welsh corgi"');
    const want: SearchQuery = {
      keywords: ['welsh corgi'],
    };
    expect(res).toStrictEqual(want);
  });

  it('has space keywords', () => {
    const res = parseQuery('"welsh corgi" "cardigan welsh corgi"');
    const want: SearchQuery = {
      keywords: ['welsh corgi', 'cardigan welsh corgi'],
    };
    expect(res).toStrictEqual(want);
  });

  it('string:field-in', () => {
    const res = parseQuery('dog label:"welsh corgi"');
    const want: SearchQuery = {
      keywords: ['dog'],
      fields: [
        {name: 'label', type: 'string', operator: '==', value: 'welsh corgi'},
      ],
    };
    expect(res).toStrictEqual(want);
  });

  it('string:field-not', () => {
    const res = parseQuery('dog -label:"welsh corgi"');
    const want: SearchQuery = {
      keywords: ['dog'],
      fields: [
        {name: 'label', type: 'string', operator: '!=', value: 'welsh corgi'},
      ],
    };
    expect(res).toStrictEqual(want);
  });

  // // @k2wanko: I can't think of a way to make it work with the current indexing mechanism.
  //   it('string:not', () => {
  //     const res = parseQuery('dog NOT "welsh corgi"');
  //     const want: SearchQuery = {
  //       keywords: ['dog'],
  //       fields: [
  //         {name: 'label', type: 'string', operator: 'NOT', value: 'welsh corgi'},
  //       ],
  //     };
  //     expect(res).toStrictEqual(want);
  //   });
});

describe('querySearch', () => {
  it('string:field-in', async () => {
    const db = admin.firestore();

    const postsRef = db.collection('posts');
    const postData: Post = {
      title: 'Test Post',
      content: 'Hello',
      created: admin.firestore.FieldValue.serverTimestamp(),
      label: ['draft'],
    };
    const postData2: Post = {
      title: 'Test Post',
      content: 'Hello',
      created: admin.firestore.FieldValue.serverTimestamp(),
      label: ['published'],
    };

    const docRef = postsRef.doc('bF7lfaw8gOlkAPlqGzTHh');
    const docRef2 = postsRef.doc('cF7lfawhaOlkAPlqGzTHh');

    const batch = db.batch();
    batch.set(docRef, postData);
    batch.set(docRef2, postData2);

    const indexRef = db.collection('index');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    await fullTextSearch.set('en', docRef, {
      batch,
      data: postData,
      fieldMask: ['content'],
      fields: ['label'],
    });
    await fullTextSearch.set('en', docRef2, {
      batch,
      data: postData2,
      fieldMask: ['content'],
      fields: ['label'],
    });

    await batch.commit();

    const res = await fullTextSearch.search('en', 'hello label:published');
    expect(res.length).toBe(1);
  });
});
