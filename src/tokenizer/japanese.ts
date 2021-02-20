import type {LanguageID, Tokenizer} from './index';
import path from 'path';
import kuromoji from 'kuromoji';

const stopWords = new Set<string>([
  'あそこ',
  'あっ',
  'あの',
  'あのかた',
  'あの人',
  'あり',
  'あります',
  'ある',
  'あれ',
  'い',
  'いう',
  'います',
  'いる',
  'う',
  'うち',
  'え',
  'お',
  'および',
  'おり',
  'おります',
  'か',
  'かつて',
  'から',
  'が',
  'き',
  'ここ',
  'こちら',
  'こと',
  'この',
  'これ',
  'これら',
  'さ',
  'さらに',
  'し',
  'しかし',
  'する',
  'ず',
  'せ',
  'せる',
  'そこ',
  'そして',
  'その',
  'その他',
  'その後',
  'それ',
  'それぞれ',
  'それで',
  'た',
  'ただし',
  'たち',
  'ため',
  'たり',
  'だ',
  'だっ',
  'だれ',
  'つ',
  'て',
  'で',
  'でき',
  'できる',
  'です',
  'では',
  'でも',
  'と',
  'という',
  'といった',
  'とき',
  'ところ',
  'として',
  'とともに',
  'とも',
  'と共に',
  'どこ',
  'どの',
  'な',
  'ない',
  'なお',
  'なかっ',
  'ながら',
  'なく',
  'なっ',
  'など',
  'なに',
  'なら',
  'なり',
  'なる',
  'なん',
  'に',
  'において',
  'における',
  'について',
  'にて',
  'によって',
  'により',
  'による',
  'に対して',
  'に対する',
  'に関する',
  'の',
  'ので',
  'のみ',
  'は',
  'ば',
  'へ',
  'ほか',
  'ほとんど',
  'ほど',
  'ます',
  'また',
  'または',
  'まで',
  'も',
  'もの',
  'ものの',
  'や',
  'よう',
  'より',
  'ら',
  'られ',
  'られる',
  'れ',
  'れる',
  'を',
  'ん',
  '何',
  '及び',
  '彼',
  '彼女',
  '我々',
  '特に',
  '私',
  '私達',
  '貴方',
  '貴方方',
]);

export class JapaneseTokenizer implements Tokenizer {
  #builder: kuromoji.TokenizerBuilder<kuromoji.IpadicFeatures>;
  #tokenizer?: kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

  constructor() {
    this.#builder = kuromoji.builder({
      dicPath: path.resolve(__dirname, '../../node_modules/kuromoji/dict'),
    });
  }

  getLanguage(): LanguageID {
    return 'ja';
  }

  async getStopWords(): Promise<Set<string>> {
    return stopWords;
  }

  async splitter(content: string): Promise<string[]> {
    const tokenizer = await new Promise<
      kuromoji.Tokenizer<kuromoji.IpadicFeatures>
    >((resolve, reject) => {
      if (this.#tokenizer) {
        return resolve(this.#tokenizer);
      }
      this.#builder.build((err, tokenizer) => {
        if (err) {
          reject(err);
          return;
        }
        this.#tokenizer = tokenizer;
        resolve(tokenizer);
      });
    });
    const res = tokenizer.tokenize(content);
    return res
      .filter(token => token.pos !== '助詞')
      .filter(token => token.pos !== '記号')
      .filter(token => token.surface_form !== '.')
      .map(token => token.surface_form);
  }

  async stemmer(content: string): Promise<string> {
    return content;
  }
}
