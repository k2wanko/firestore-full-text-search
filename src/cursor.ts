import type {FieldValue} from '@google-cloud/firestore';
import msgpack from 'msgpack';

export type Cursor = string;

export interface CursorInfo {
  fields: string[];
  fieldValueMap: {[key: string]: FieldValue};
}

async function createCursor(info: CursorInfo): Promise<Cursor> {
  const data = msgpack.pack(info, true);
  if (data instanceof Buffer) {
    return data.toString('base64');
  }
  return data;
}

export async function parseCursor(cursor: Cursor): Promise<CursorInfo> {
  return msgpack.unpack(Buffer.from(cursor, 'base64')) as CursorInfo;
}

export class CursorBuilder {
  #fields: string[];
  #fieldValueMap: {[key: string]: FieldValue};
  constructor() {
    this.#fields = [];
    this.#fieldValueMap = {};
  }

  add(path: string, val: FieldValue) {
    if (this.#fieldValueMap[path]) {
      throw new Error(`exits path: ${path}`);
    }
    this.#fields.push(path);
    this.#fieldValueMap[path] = val;
  }

  async build(): Promise<Cursor> {
    return createCursor({
      fields: this.#fields,
      fieldValueMap: this.#fieldValueMap,
    });
  }
}
