export type LanguageID = English | Japanese;
export type English = 'en';
export type Japanese = 'ja';

export interface Tokenizer {
  getLanguage(): LanguageID;
  getStopWords(): Set<string>;
  splitter(content: string): string[];
  stemmer(content: string): string;
}

export type Token = {
  word: string;
  normalizedWord: string;
  positions: number[];
};
