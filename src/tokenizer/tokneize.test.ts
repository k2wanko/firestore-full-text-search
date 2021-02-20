import tokeneize from './tokenize';
import type {Token} from './index';

describe('tokeneize', () => {
  it('english', async () => {
    const word =
      "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine.";
    const wants: Token[] = [
      {word: 'Node.js', normalizedWord: 'nodej', positions: [0]},
      {word: 'JavaScript', normalizedWord: 'javascript', positions: [1, 6]},
      {word: 'runtime', normalizedWord: 'runtim', positions: [2]},
      {word: 'built', normalizedWord: 'built', positions: [3]},
      {word: "Chrome's", normalizedWord: 'chrome', positions: [4]},
      {word: 'V8', normalizedWord: 'v8', positions: [5]},
      {word: 'JavaScript', normalizedWord: 'javascript', positions: [1, 6]},
      {word: 'engine', normalizedWord: 'engin', positions: [7]},
    ];
    const res = await tokeneize('en', word);
    for (const i in res) {
      const [token, want] = [res[i], wants[i]];
      expect(token.normalizedWord).toBe(want.normalizedWord);
      expect(token.word).toBe(want.word);
      expect(token.positions).toStrictEqual(want.positions);
    }
  });

  it('japanese', async () => {
    const word =
      'Node.js は、Chrome の V8 JavaScript エンジン で動作する JavaScript 環境です。';
    const wants: Token[] = [
      {word: 'Node', normalizedWord: 'node', positions: [0]},
      {word: 'js', normalizedWord: 'js', positions: [1]},
      {word: 'Chrome', normalizedWord: 'chrome', positions: [2]},
      {word: 'V', normalizedWord: 'v', positions: [3]},
      {word: '8', normalizedWord: '8', positions: [4]},
      {
        word: 'JavaScript',
        normalizedWord: 'javascript',
        positions: [5, 8],
      },
      {word: 'エンジン', normalizedWord: 'エンジン', positions: [6]},
      {word: '動作', normalizedWord: '動作', positions: [7]},
      {
        word: 'JavaScript',
        normalizedWord: 'javascript',
        positions: [5, 8],
      },
      {word: '環境', normalizedWord: '環境', positions: [9]},
    ];

    const res = await tokeneize('ja', word);
    for (const i in res) {
      const [token, want] = [res[i], wants[i]];
      expect(token.normalizedWord).toBe(want.normalizedWord);
      expect(token.word).toBe(want.word);
      expect(token.positions).toStrictEqual(want.positions);
    }
  });
});
