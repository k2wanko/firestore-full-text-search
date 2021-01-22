import admin from 'firebase-admin';
import FirestoreFullTextSearch from './index';
import type {FieldValue} from '@google-cloud/firestore';
import {LogLevel} from '@opentelemetry/core';
import {NodeTracerProvider} from '@opentelemetry/node';
import {SimpleSpanProcessor, ConsoleSpanExporter} from '@opentelemetry/tracing';
import {trace, metrics} from '@opentelemetry/api';
import {MeterProvider, ConsoleMetricExporter} from '@opentelemetry/metrics';

const provider = new NodeTracerProvider({
  logLevel: LogLevel.ERROR,
});
provider.register();
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
trace.setGlobalTracerProvider(provider);
metrics.setGlobalMeterProvider(
  new MeterProvider({
    exporter: new ConsoleMetricExporter(),
  })
);

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:5000';

admin.initializeApp({
  projectId: 'test',
});

export type Post = {
  title: string;
  content: string;
  created: Date | FieldValue;
  label?: string[];
};

export type Animal = {
  type: string;
  class: string;
  description: string;
  like: number;
};

describe('FirestoreFullTextSearch:english', () => {
  it('set:simple', async () => {
    const db = admin.firestore();

    const postsRef = db.collection('posts');
    const postData: Post = {
      title: "What's Firestore Full-Text Search?",
      content:
        'Firestore Full-Text Search provides a Firestore-specific full-text search function. It runs on Cloud Functions and has excellent performance.',
      created: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = postsRef.doc('gF4lmS8gOlkAPlqGzTHh');
    await docRef.set(postData);
    console.log({docID: docRef.id});

    const indexRef = db.collection('index_simple');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    await fullTextSearch.set('en', docRef);

    const word = 'search';
    const wants = ['title', 'content'];
    for (const field of wants) {
      const contentRef = indexRef.doc(
        `/v1/words/${word}/docs/${docRef.id}.${field}`
      );
      const contentSnap = await contentRef.get();
      expect(contentSnap.exists).toBe(true);
    }
  });

  it('set:batch', async () => {
    const db = admin.firestore();

    const postsRef = db.collection('posts');
    const postData: Post = {
      title: "What's Firebase?",
      content:
        'Firebase helps you build and run successful apps.\n Backed by Google and loved by app development teams - from startups to global enterprises.',
      created: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = postsRef.doc('aF7lmS8gOlkAPlqGzTHh');

    const batch = db.batch();
    batch.set(docRef, postData);

    const indexRef = db.collection('index_simple');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    await fullTextSearch.set('en', docRef, {batch, data: postData});

    await batch.commit();

    const word = 'firebas';
    const wants = ['title', 'content'];
    for (const field of wants) {
      const contentRef = indexRef.doc(
        `/v1/words/${word}/docs/${docRef.id}.${field}`
      );
      const contentSnap = await contentRef.get();
      expect(contentSnap.exists).toBe(true);
    }
  });

  it('search:simple', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_simple');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const results = await fullTextSearch.search('en', 'firestore');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('gF4lmS8gOlkAPlqGzTHh');
  });

  it('search:double-keywords', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_simple');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const results = await fullTextSearch.search('en', 'firebase firestore');

    expect(results.length).toBe(2);
  });

  it('search:nothing', async () => {
    const db = admin.firestore();
    const indexRef = db.collection('index_simple');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const results = await fullTextSearch.search('en', 'nothing');
    expect(results.length).toBe(0);
  });
});

describe('FirestoreFullTextSearch', () => {
  const db = admin.firestore();

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

    const batch = db.batch();
    const indexRef = db.collection('index_dogs_sort');
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

  it('search:sort', async () => {
    const indexRef = db.collection('index_dogs_sort');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    const results = await fullTextSearch.search('en', 'herding');
    expect(results.length === 2).toBe(true);
    expect(results[0].id).toBe('border collie');
    expect(results[1].id).toBe('corgi');
    // console.log(results.map(res => res.id));
  });

  it('delete:document', async () => {
    const postsRef = db.collection('posts');
    const postData: Post = {
      title: "What's Firestore Full-Text Search?",
      content:
        'Firestore Full-Text Search provides a Firestore-specific full-text search function. It runs on Cloud Functions and has excellent performance.',
      created: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = postsRef.doc('post1');
    await docRef.set(postData);
    console.log({docID: docRef.id});

    const indexRef = db.collection('index_delete_test');
    const fullTextSearch = new FirestoreFullTextSearch(indexRef);
    await fullTextSearch.set('en', docRef);

    const word = 'search';
    const wants = ['title', 'content'];
    for (const field of wants) {
      const contentRef = indexRef.doc(
        `/v1/words/${word}/docs/${docRef.id}.${field}`
      );
      const contentSnap = await contentRef.get();
      expect(contentSnap.exists).toBe(true);
    }

    await fullTextSearch.delete('en', docRef);

    for (const field of wants) {
      const contentRef = indexRef.doc(
        `/v1/words/${word}/docs/${docRef.id}.${field}`
      );
      const contentSnap = await contentRef.get();
      expect(contentSnap.exists).toBe(false);
    }
  });
});
