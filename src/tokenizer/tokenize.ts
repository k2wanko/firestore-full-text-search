import type {Tokenizer, LanguageID, Token} from './index';
import {EnglishTokenizer} from './english';
import {JapaneseTokenizer} from './japanese';

export default async function tokenize(
  lang: LanguageID,
  text: string
): Promise<Token[]> {
  let tokeneizer: Tokenizer | null = null;
  switch (lang) {
    case 'en':
      tokeneizer = new EnglishTokenizer();
      break;
    case 'ja':
      tokeneizer = new JapaneseTokenizer();
      break;
    default:
      throw new Error(`Unsupport language: ${lang}`);
  }
  const words = await tokeneizer.splitter(text);

  const wordToPositions = new Map<
    string,
    {word: string; positions: number[]}
  >();
  let index = 0;
  for (const word of words) {
    if ((await tokeneizer.getStopWords()).has(word)) {
      continue;
    }

    const stemWord = await tokeneizer.stemmer(word.toLowerCase());
    if (wordToPositions.has(stemWord)) {
      wordToPositions.set(stemWord, {
        word,
        positions: wordToPositions.get(stemWord)?.positions.concat(index) ?? [],
      });
    } else {
      wordToPositions.set(stemWord, {word, positions: [index]});
    }
    index++;
  }

  const res: Token[] = new Array(index);
  for (const [stemWord, {word, positions}] of wordToPositions) {
    for (const pos of positions) {
      res[pos] = {
        word,
        normalizedWord: stemWord,
        positions,
      };
    }
  }

  return res;
}
