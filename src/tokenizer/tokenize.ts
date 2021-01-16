import type {Tokenizer, LanguageID, Token} from './index';
import {EnglishTokenizer} from './english';

export default function tokenize(lang: LanguageID, word: string): Token[] {
  let tokeneizer: Tokenizer | null = null;
  switch (lang) {
    case 'en':
      tokeneizer = new EnglishTokenizer();
      break;
    default:
      throw new Error(`Unsupport language: ${lang}`);
  }
  const words = tokeneizer.splitter(word);

  const wordToPositions = new Map<string, number[]>();
  let index = 0;
  for (const word of words) {
    if (tokeneizer.getStopWords().has(word)) {
      continue;
    }

    const stemWord = tokeneizer.stemmer(word);
    if (wordToPositions.has(stemWord)) {
      wordToPositions.set(
        stemWord,
        wordToPositions.get(stemWord)?.concat(index) ?? []
      );
    } else {
      wordToPositions.set(stemWord, [index]);
    }
    index++;
  }

  const res: Token[] = new Array(index);
  for (const [stemWord, positions] of wordToPositions) {
    for (const pos of positions) {
      res[pos] = {
        word: stemWord,
        positions,
      };
    }
  }

  return res;
}
