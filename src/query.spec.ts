import admin from 'firebase-admin';
import {DateTime} from 'luxon';
import FirestoreFullTextSearch from './index';
import {parseQuery, SearchQuery} from './query';
import {Post, Animal} from './index.spec';

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

  it('string:field-not-in', () => {
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

  it('number:greater-than', () => {
    const res = parseQuery('dog like:>10');
    const want: SearchQuery = {
      keywords: ['dog'],
      fields: [{name: 'like', type: 'number', operator: '>', value: 10}],
    };
    expect(res).toStrictEqual(want);
  });

  it('number:greater-than-or-equal', () => {
    const res = parseQuery('dog like:>=10');
    const want: SearchQuery = {
      keywords: ['dog'],
      fields: [{name: 'like', type: 'number', operator: '>=', value: 10}],
    };
    expect(res).toStrictEqual(want);
  });

  it('number:less-than', () => {
    const res = parseQuery('dog like:<10');
    const want: SearchQuery = {
      keywords: ['dog'],
      fields: [{name: 'like', type: 'number', operator: '<', value: 10}],
    };
    expect(res).toStrictEqual(want);
  });

  it('number:less-than-or-equal', () => {
    const res = parseQuery('dog like:<=10');
    const want: SearchQuery = {
      keywords: ['dog'],
      fields: [{name: 'like', type: 'number', operator: '<=', value: 10}],
    };
    expect(res).toStrictEqual(want);
  });

  it('date:greater-than', () => {
    const res = parseQuery('hello created:>2021-01-01');
    const want: SearchQuery = {
      keywords: ['hello'],
      fields: [
        {
          name: 'created',
          type: 'date',
          operator: '>',
          value: DateTime.fromISO('2021-01-01').toJSDate(),
        },
      ],
    };
    expect(res).toStrictEqual(want);
  });

  it('date:greater-than-or-equal', () => {
    const res = parseQuery('hello created:>=2021-01-01');
    const want: SearchQuery = {
      keywords: ['hello'],
      fields: [
        {
          name: 'created',
          type: 'date',
          operator: '>=',
          value: DateTime.fromISO('2021-01-01').toJSDate(),
        },
      ],
    };
    expect(res).toStrictEqual(want);
  });

  it('date:less-than', () => {
    const res = parseQuery('hello created:<2021-01-01');
    const want: SearchQuery = {
      keywords: ['hello'],
      fields: [
        {
          name: 'created',
          type: 'date',
          operator: '<',
          value: DateTime.fromISO('2021-01-01').toJSDate(),
        },
      ],
    };
    expect(res).toStrictEqual(want);
  });

  it('date:less-than-or-equal', () => {
    const res = parseQuery('hello created:<=2021-01-01');
    const want: SearchQuery = {
      keywords: ['hello'],
      fields: [
        {
          name: 'created',
          type: 'date',
          operator: '<=',
          value: DateTime.fromISO('2021-01-01').toJSDate(),
        },
      ],
    };
    expect(res).toStrictEqual(want);
  });
});

describe('querySearch', () => {
  beforeAll(async () => {
    const db = admin.firestore();

    const postsRef = db.collection('posts');
    const postData: Post = {
      title: 'Test Post',
      content: 'Hello',
      created: DateTime.fromISO('2021-01-01').toJSDate(),
      label: ['draft'],
    };
    const postData2: Post = {
      title: 'Test Post',
      content: 'Hello',
      created: DateTime.fromISO('2021-01-02').toJSDate(),
      label: ['published'],
    };
    const postData3: Post = {
      title: 'Test Post 2',
      content: 'Hello World',
      created: DateTime.fromISO('2021-02-01').toJSDate(),
      label: ['published'],
    };

    const docRef = postsRef.doc('bF7lfaw8gOlkAPlqGzTHh');
    const docRef2 = postsRef.doc('cF7lfawhaOlkAPlqGzTHh');
    const docRef3 = postsRef.doc('dF7lfawhaOlkAPlqGzTHh');

    const batch = db.batch();
    batch.set(docRef, postData);
    batch.set(docRef2, postData2);
    batch.set(docRef3, postData3);

    const indexRef = db.collection('index_posts');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    await fullTextSearch.set('en', docRef, {
      batch,
      data: postData,
      indexMask: ['content'],
      fields: ['label', 'created'],
    });
    await fullTextSearch.set('en', docRef2, {
      batch,
      data: postData2,
      indexMask: ['content'],
      fields: ['label', 'created'],
    });
    await fullTextSearch.set('en', docRef3, {
      batch,
      data: postData3,
      indexMask: ['content'],
      fields: ['label', 'created'],
    });

    await batch.commit();
  });

  beforeAll(async () => {
    const dogs: {[key: string]: Animal} = {
      akita: {
        type: 'dog',
        class: 'akita',
        description:
          'The Akita (秋田犬, Akita-inu, Japanese pronunciation: [akʲita.inɯ]) is a large breed of dog originating from the mountainous regions of northern Japan.',
        like: 10,
      },
      corgi: {
        type: 'dog',
        class: 'corgi',
        description:
          'The Welsh Corgi (/ˈkɔːrɡi/[5] plural "Corgis" or occasionally the etymologically consistent "Corgwn"; /ˈkɔːrɡuːn/) is a small type of herding dog that originated in Wales.[6]',
        like: 50,
      },
      'border collie': {
        type: 'dog',
        class: 'corey',
        description:
          'The Border Collie is a working and herding dog breed developed in the Anglo-Scottish border county of Northumberland, for herding livestock, especially sheep.[1]',
        like: 5,
      },
    };

    const db = admin.firestore();
    const batch = db.batch();
    const indexRef = db.collection('index_dogs');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    for (const [id, data] of Object.entries(dogs)) {
      const dogRef = db.collection('dogs').doc(id);
      batch.set(dogRef, data);
      await fullTextSearch.set('en', dogRef, {
        data,
        batch,
        indexMask: ['description'],
        fields: ['like'],
      });
    }
    await batch.commit();
  });

  it('string:field-in', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_posts');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'hello label:published');
    expect(res.length).toBe(2);
  });

  it('string:field-not-in', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_posts');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'hello -label:published');
    expect(res.length).toBe(1);
  });

  it('number:greater-than', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_dogs');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'herding like:>5');
    expect(res.length >= 1).toBe(true);
    expect(res[0].id).toBe('corgi');
  });

  it('number:greater-than-or-equal', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_dogs');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'herding like:>=5');
    expect(res.length >= 2).toBe(true);
    expect(res[0].id).toBe('border collie');
    expect(res[1].id).toBe('corgi');
  });

  it('number:less-than', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_dogs');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'herding like:<10');
    expect(res.length >= 1).toBe(true);
    expect(res[0].id).toBe('border collie');
  });

  it('number:less-than-or-equal', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_dogs');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'herding like:<=50');
    expect(res.length >= 2).toBe(true);
    expect(res[0].id).toBe('border collie');
    expect(res[1].id).toBe('corgi');
  });

  it('date:greater-than', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_posts');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'hello created:>2021-01-01');
    expect(res.length >= 2).toBe(true);
    // expect(res[0].id).toBe('cF7lfawhaOlkAPlqGzTHh');
    // expect(res[1].id).toBe('dF7lfawhaOlkAPlqGzTHh');
  });

  it('date:greater-than-or-equal', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_posts');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'hello created:>=2021-01-01');
    expect(res.length >= 3).toBe(true);
    // expect(res[0].id).toBe('bF7lfaw8gOlkAPlqGzTHh');
    // expect(res[1].id).toBe('cF7lfawhaOlkAPlqGzTHh');
    // expect(res[2].id).toBe('dF7lfawhaOlkAPlqGzTHh');
  });

  it('date:less-than', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_posts');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'hello created:<2021-01-02');
    expect(res.length === 1).toBe(true);
    expect(res[0].id).toBe('bF7lfaw8gOlkAPlqGzTHh');
  });

  it('date:less-than-or-equal', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_posts');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const res = await fullTextSearch.search('en', 'hello created:<=2021-01-02');
    expect(res.length === 2).toBe(true);
    // expect(res[0].id).toBe('bF7lfaw8gOlkAPlqGzTHh');
    // expect(res[1].id).toBe('cF7lfawhaOlkAPlqGzTHh');
  });
});
