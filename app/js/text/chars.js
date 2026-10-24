// Character classes shared by tokenizer, pacing and focus-letter logic.

const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;
const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;
const UPPER = /\p{Lu}/u;
const LOWER = /\p{Ll}/u;

// Vowels used for the syllable estimate. Includes the Norwegian æ, ø and å.
const VOWELS = new Set('aeiouyæøåàáâãäèéêëìíîïòóôõöùúûüýÿœ');

export const isLetter = (ch) => LETTER.test(ch);
export const isDigit = (ch) => DIGIT.test(ch);
export const isWordChar = (ch) => WORD_CHAR.test(ch);
export const isUpper = (ch) => UPPER.test(ch);
export const isLower = (ch) => LOWER.test(ch);
export const isVowel = (ch) => VOWELS.has(ch.toLowerCase());

export const hasWordChar = (text) => WORD_CHAR.test(text);

// Splits by Unicode code point, so å, æ and ø count as one character each
// (text is NFC-normalised on import).
export const codePoints = (text) => Array.from(text);

export function countWhere(text, predicate) {
  let count = 0;
  for (const ch of text) if (predicate(ch)) count++;
  return count;
}

// Opening punctuation belongs to the following word: «Hei, „Hei, (Hei.
export const OPENING_PUNCTUATION = new Set(['«', '„', '“', '‘', '‚', '(', '[', '{', '¿', '¡', '"', "'", '‹']);

// Dashes used as Norwegian dialogue markers (replikkstrek) and as tankestrek.
export const DASHES = new Set(['-', '–', '—', '‒', '―']);

// Trailing characters ignored when looking for the punctuation that ends a word,
// so «Hei.» and (slutt.) still get a sentence pause.
export const IGNORED_TRAILING = new Set(['"', "'", ')', ']', '}', '»', '«', '”', '“', '’', '‘', '›', '*', '_']);
