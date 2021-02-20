# Firestore Full-Text Search

Firestore Full-Text Search provides a Firestore-specific full-text search function.  
It runs on Cloud Functions and has excellent performance.  
Supports simple inverted index type search.

#### Usage

```bash
npm install --save firestore-full-text-search
```

```js
import admin from 'firebase-admin';
import FirestoreFullTextSearch from 'firestore-full-text-search';

admin.initializeApp({...});
const db = admin.firestore();

// Specifies the collection in which to store the inverted index.
const fullTextSearch = new FirestoreFullTextSearch(db.collection('index'));


// Set documents
const postData: Post = {
    title: "What's Firestore Full-Text Search?",
    content:
    'Firestore Full-Text Search provides a Firestore-specific full-text search function. It runs on Cloud Functions and has excellent performance.',
    created: admin.firestore.FieldValue.serverTimestamp(),
};

const docRef = postsRef.collection('posts').doc('1');

// WriteBatch is supported so that documents and search indexes can be stored atomically.
const batch = db.batch();
batch.set(docRef, postData);
await fullTextSearch.set('en', docRef, {batch, data: postData});
await batch.commit();
```

```js
// Search documents
const results = await fullTextSearch.search('en', 'firestore');
```

#### ToDo

- [x] English Support
- [ ] Japanese Support
- [x] Implement Query parser
- [x] Implement Delete document 
- [x] Sorting Support
- [x] Limit Support
- [x] Pagination Support
- [x] OpenTelemetry Support
- [ ] Browser Support (Search-Only)
- [ ] Firebase Performance Monitoring Support