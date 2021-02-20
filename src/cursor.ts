import type {FieldValue} from '@google-cloud/firestore';
export type Cursor = string;

export interface CursorInfo {
  fields: string[];
  fieldValueMap: {[key: string]: FieldValue};
}

async function createCursor(info: CursorInfo): Promise<Cursor> {
  return Buffer.from(JSON.stringify(info)).toString('base64');
}

export async function parseCursor(cursor: Cursor): Promise<CursorInfo> {
  return JSON.parse(Buffer.from(cursor, 'base64').toString()) as CursorInfo;
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
