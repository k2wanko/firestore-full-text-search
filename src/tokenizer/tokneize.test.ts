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
    const res = tokeneize('en', word);
    for (const i in res) {
      const [token, want] = [res[i], wants[i]];
      expect(token.normalizedWord).toBe(want.normalizedWord);
      expect(token.word).toBe(want.word);
      expect(token.positions).toStrictEqual(want.positions);
    }
  });
});
