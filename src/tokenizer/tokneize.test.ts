import tokeneize from './tokenize';
import type {Token} from './index';

describe('tokeneize', () => {
  it('english', async () => {
    const word =
      "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine.";
    const wants: Token[] = [
      {word: 'nodej', positions: [0]},
      {word: 'javascript', positions: [1, 6]},
      {word: 'runtim', positions: [2]},
      {word: 'built', positions: [3]},
      {word: 'chrome', positions: [4]},
      {word: 'v8', positions: [5]},
      {word: 'javascript', positions: [1, 6]},
      {word: 'engin', positions: [7]},
    ];
    const res = tokeneize('en', word);
    for (const i in res) {
      const [token, want] = [res[i], wants[i]];
      expect(token.word).toBe(want.word);
      expect(token.positions).toStrictEqual(want.positions);
    }
  });
});
