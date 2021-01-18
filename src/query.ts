export type FieldType = FieldStringType | FieldNumberType;

export type FieldStringType = {
  type: 'string';
  operator: FilterOp;
  value: string;
} & FieldTypeBase;

export type FieldNumberType = {
  type: 'number';
  operator: FilterOp;
  value: number;
} & FieldTypeBase;

export type FilterOp = '==' | '!=' | '>' | '>=' | '<' | '<=';

export type FieldTypeBase = {name: string};

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
    let operator: FilterOp = '==';
    if (name.startsWith('-')) {
      name = name.slice(1, name.length);
      operator = '!=';
    }

    let [numOp, numValOrNAN] = [
      value.slice(0, 1),
      value.slice(1, value.length),
    ];
    if (numValOrNAN.startsWith('=')) {
      numOp += '=';
      numValOrNAN = numValOrNAN.slice(1, numValOrNAN.length);
    }
    const numberVal = Number.parseInt(numValOrNAN);
    if (!Number.isNaN(numberVal)) {
      switch (numOp) {
        case '>':
        case '<':
        case '>=':
        case '<=':
          fields.push({
            name,
            type: 'number',
            operator: numOp,
            value: numberVal,
          });
          continue;
        default:
      }
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
