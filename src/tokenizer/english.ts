import type {LanguageID, Tokenizer} from './index';

const exceptions = new Map([
  ['skis', 'ski'],
  ['dying', 'die'],
  ['lying', 'lie'],
  ['tying', 'tie'],
  ['idly', 'idl'],
  ['gently', 'gentl'],
  ['ugly', 'ugli'],
  ['early', 'earli'],
  ['only', 'onli'],
  ['singly', 'singl'],
  ['sky', 'sky'],
  ['news', 'news'],
  ['howe', 'howe'],
  ['atlas', 'atlas'],
  ['cosmos', 'cosmos'],
  ['bias', 'bias'],
  ['andes', 'andes'],
]);

const exceptions1a = new Map([
  ['inning', 'inning'],
  ['outing', 'outing'],
  ['canning', 'canning'],
  ['herring', 'herring'],
  ['earring', 'earring'],
  ['proceed', 'proceed'],
  ['exceed', 'exceed'],
  ['succeed', 'succeed'],
]);

const extensions2 = new Map([
  ['ization', 'ize'],
  ['fulness', 'ful'],
  ['iveness', 'ive'],
  ['ational', 'ate'],
  ['ousness', 'ous'],
  ['tional', 'tion'],
  ['biliti', 'ble'],
  ['lessli', 'less'],
  ['entli', 'ent'],
  ['ation', 'ate'],
  ['alism', 'al'],
  ['aliti', 'al'],
  ['ousli', 'ous'],
  ['iviti', 'ive'],
  ['fulli', 'ful'],
  ['enci', 'ence'],
  ['anci', 'ance'],
  ['abli', 'able'],
  ['izer', 'ize'],
  ['ator', 'ate'],
  ['alli', 'al'],
  ['bli', 'ble'],
  ['ogi', 'og'],
  ['li', ''],
]);

// https://github.com/stopwords-iso/stopwords-en/blob/master/raw/snowball-tartarus.txt
const stopWords = new Set<string>([
  'i',
  'me',
  'my',
  'myself',
  'we',
  'us',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'will',
  'would',
  'shall',
  'should',
  'can',
  'could',
  'may',
  'might',
  'must',
  'ought',
  "i'm",
  "you're",
  "he's",
  "she's",
  "it's",
  "we're",
  "they're",
  "i've",
  "you've",
  "we've",
  "they've",
  "i'd",
  "you'd",
  "he'd",
  "she'd",
  "we'd",
  "they'd",
  "i'll",
  "you'll",
  "he'll",
  "she'll",
  "we'll",
  "they'll",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "hasn't",
  "haven't",
  "hadn't",
  "doesn't",
  "don't",
  "didn't",
  "won't",
  "wouldn't",
  "shan't",
  "shouldn't",
  "can't",
  'cannot',
  "couldn't",
  "mustn't",
  "let's",
  "that's",
  "who's",
  "what's",
  "here's",
  "there's",
  "when's",
  "where's",
  "why's",
  "how's",
  "daren't",
  "needn't",
  'doubtful',
  "oughtn't",
  "mightn't",
  'a',
  'an',
  'the',
  'and',
  'but',
  'if',
  'or',
  'because',
  'as',
  'until',
  'while',
  'of',
  'at',
  'by',
  'for',
  'with',
  'about',
  'against',
  'between',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'to',
  'from',
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'one',
  'every',
  'least',
  'less',
  'many',
  'now',
  'ever',
  'never',
  'say',
  'says',
  'said',
  'also',
  'get',
  'go',
  'goes',
  'just',
  'made',
  'make',
  'put',
  'see',
  'seen',
  'whether',
  'like',
  'well',
  'back',
  'even',
  'still',
  'way',
  'take',
  'since',
  'another',
  'however',
  'two',
  'three',
  'four',
  'five',
  'first',
  'second',
  'new',
  'old',
  'high',
  'long',
]);

export class EnglishTokenizer implements Tokenizer {
  getLanguage(): LanguageID {
    return 'en';
  }

  getStopWords(): Set<string> {
    return stopWords;
  }

  splitter(content: string): string[] {
    const words = content.trim().split(/ +/);
    return words
      .map(word => word.replace(/[.,:"]+$/g, '').toLowerCase())
      .filter(v => !!v);
  }

  // implemented from algorithm at http://snowball.tartarus.org/algorithms/english/stemmer.html
  stemmer(content: string): string {
    if (content.length < 3) {
      return content;
    }
    if (exceptions.has(content)) {
      return exceptions.get(content) ?? '';
    }

    const eRx = ['', ''];
    content = content
      .toLowerCase()
      .replace(/^'/, '')
      .replace(/[^a-z']/g, '')
      .replace(/^y|([aeiouy])y/g, '$1Y');
    let R1, res;

    if ((res = /^(gener|commun|arsen)/.exec(content))) {
      R1 = res[0].length;
    } else {
      R1 = (/[aeiouy][^aeiouy]/.exec(' ' + content)?.index || 1000) + 1;
    }

    const R2 =
      (/[aeiouy][^aeiouy]/.exec(' ' + content.substr(R1))?.length || 1000) +
      R1 +
      1;

    // step 0
    content = content.replace(/('s'?|')$/, '');

    // step 1a
    const rx = /(?:(ss)es|(..i)(?:ed|es)|(us)|(ss)|(.ie)(?:d|s))$/;
    if (rx.test(content)) {
      content = content.replace(rx, '$1$2$3$4$5');
    } else {
      content = content.replace(/([aeiouy].+)s$/, '$1');
    }

    if (exceptions1a.has(content)) {
      return exceptions1a.get(content) ?? '';
    }

    // step 1b
    const s1 = (/(eedly|eed)$/.exec(content) || eRx)[1],
      s2 = (/(?:[aeiouy].*)(ingly|edly|ing|ed)$/.exec(content) || eRx)[1];

    if (s1.length > s2.length) {
      if (content.indexOf(s1, R1) >= 0) {
        content = content.substr(0, content.length - s1.length) + 'ee';
      }
    } else if (s2.length > s1.length) {
      content = content.substr(0, content.length - s2.length);
      if (/(at|bl|iz)$/.test(content)) {
        content += 'e';
      } else if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/.test(content)) {
        content = content.substr(0, content.length - 1);
      } else if (
        !content.substr(R1) &&
        /([^aeiouy][aeiouy][^aeiouywxY]|^[aeiouy][^aeiouy]|^[aeiouy])$/.test(
          content
        )
      ) {
        content += 'e';
      }
    }

    // step 1c
    content = content.replace(/(.[^aeiouy])[yY]$/, '$1i');

    // step 2
    const sfx = /(ization|fulness|iveness|ational|ousness|tional|biliti|lessli|entli|ation|alism|aliti|ousli|iviti|fulli|enci|anci|abli|izer|ator|alli|bli|l(ogi)|[cdeghkmnrt](li))$/.exec(
      content
    );
    if (sfx) {
      const sfx2 = sfx[3] || sfx[2] || sfx[1];
      if (content.indexOf(sfx2, R1) >= 0) {
        content =
          content.substr(0, content.length - sfx2.length) +
          extensions2.get(sfx2);
      }
    }

    // step 3
    const sfx3 = (/(ational|tional|alize|icate|iciti|ative|ical|ness|ful)$/.exec(
      content
    ) || eRx)[1];
    if (sfx && content.indexOf(sfx3, R1) >= 0) {
      content = `${content.substr(0, content.length - sfx3.length)}${new Map([
        ['ational', 'ate'],
        ['tional', 'tion'],
        ['alize', 'al'],
        ['icate', 'ic'],
        ['iciti', 'ic'],
        ['ative', content.indexOf('ative', R2) >= 0 ? '' : 'ative'],
        ['ical', 'ic'],
        ['ness', ''],
        ['ful', ''],
      ]).get(sfx3)}`;
    }

    // step 4
    const sfx4 = /(ement|ance|ence|able|ible|ment|ant|ent|ism|ate|iti|ous|ive|ize|[st](ion)|al|er|ic)$/.exec(
      content
    );
    if (sfx4) {
      const sfx5 = sfx4[2] || sfx4[1];
      if (content.indexOf(sfx5, R2) >= 0) {
        content = content.substr(0, content.length - sfx5.length);
      }
    }

    // step 5
    if (content.substr(-1) === 'e') {
      if (
        content.substr(R2) ||
        (content.substr(R1) &&
          !/([^aeiouy][aeiouy][^aeiouywxY]|^[aeiouy][^aeiouy])e$/.test(content))
      ) {
        content = content.substr(0, content.length - 1);
      }
    } else if (content.substr(-2) === 'll' && content.indexOf('l', R2) >= 0) {
      content = content.substr(0, content.length - 1);
    }

    return content.toLowerCase();
  }
}
