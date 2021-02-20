export type LanguageID = English | Japanese;
export type English = 'en';
export type Japanese = 'ja';

export interface Tokenizer {
  getLanguage(): LanguageID;
  getStopWords(): Promise<Set<string>>;
  splitter(content: string): Promise<string[]>;
  stemmer(content: string): Promise<string>;
}

export type Token = {
  word: string;
  normalizedWord: string;
  positions: number[];
};
