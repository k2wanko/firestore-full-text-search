export type Operator = 'IN' | 'NOT';

export type FieldType = FieldStringType;
export type FieldStringType = {
  type: 'string';
  operator: Operator;
  value: string;
} & FieldTypeBase;
export type FieldTypeBase = {name: string; type: 'string'};

export type SearchQuery = {
  keywords: string[];
  fields?: FieldType[];
};

export function parseQuery(query: string): SearchQuery {
  if (!query) {
    return {
      keywords: [],
    };
  }

  const keywords: string[] = [];
  const regex = /(\S+:'(?:[^'\\]|\\.)*')|(\S+:"(?:[^"\\]|\\.)*")|(-?"(?:[^"\\]|\\.)*")|(-?'(?:[^'\\]|\\.)*')|\S+|\S+:\S+/g;
  let fields: FieldType[] | undefined;
  let match;
  while ((match = regex.exec(query)) !== null) {
    const term = match[0];
    if (!term.includes(':')) {
      keywords.push(term.replace(/"/g, ''));
      continue;
    }
    if (!fields) {
      fields = [];
    }

    let [name, value] = term.split(':');
    let operator: Operator = 'IN';
    if (name.startsWith('-')) {
      name = name.slice(1, name.length);
      operator = 'NOT';
    }
    value = value.replace(/"/g, '');
    fields.push({
      name,
      type: 'string',
      operator,
      value,
    });
  }
  if (fields) {
    return {
      keywords,
      fields,
    };
  }
  return {
    keywords,
  };
}
