import type {DocumentReference} from '@google-cloud/firestore';
import {FieldValue} from '@google-cloud/firestore';
import {WriteBatch2} from './utils/firestore';

export async function incrementCounter(
  ref: DocumentReference,
  numShards: number,
  numIncrement: number,
  options?: {batch: WriteBatch2}
) {
  const shardId = Math.floor(Math.random() * numShards).toString();
  const shardRef = ref.collection('count').doc(shardId);
  const batch = options?.batch;

  const data = {count: FieldValue.increment(numIncrement)};

  if (batch) {
    batch.set(shardRef, data, {merge: true});
  } else {
    await shardRef.set(data, {merge: true});
  }
  return;
}

export async function getCount(ref: DocumentReference): Promise<number> {
  const snap = await ref.collection('count').get();
  let total = 0;
  for (const doc of snap.docs) {
    total += doc.data().count as number;
  }
  return total;
}
