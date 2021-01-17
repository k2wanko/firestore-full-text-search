import {parseQuery, SearchQuery} from './query';

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
        {name: 'label', type: 'string', operator: 'IN', value: 'welsh corgi'},
      ],
    };
    expect(res).toStrictEqual(want);
  });

  it('string:field-not', () => {
    const res = parseQuery('dog -label:"welsh corgi"');
    const want: SearchQuery = {
      keywords: ['dog'],
      fields: [
        {name: 'label', type: 'string', operator: 'NOT', value: 'welsh corgi'},
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
