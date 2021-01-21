import type {DocumentReference} from '@google-cloud/firestore';
import {FieldValue} from '@google-cloud/firestore';

export async function incrementCounter(
  ref: DocumentReference,
  numShards: number,
  numIncrement: number
) {
  const shardId = Math.floor(Math.random() * numShards).toString();
  const shardRef = ref.collection('count').doc(shardId);
  return await shardRef.set(
    {count: FieldValue.increment(numIncrement)},
    {merge: true}
  );
}

export async function getCount(ref: DocumentReference): Promise<number> {
  const snap = await ref.collection('count').get();
  let total = 0;
  for (const doc of snap.docs) {
    total += doc.data().count as number;
  }
  return total;
}
