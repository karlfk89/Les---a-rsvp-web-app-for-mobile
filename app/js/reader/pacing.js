// How long each word stays on screen. Ported from rsvpnano
// (src/reader/ReadingLoop.cpp, MIT licence) with these changes:
// - Norwegian and English abbreviation lists, chosen by book language.
// - The English silent-e syllable rule applies to English only («jente», «gate»).
// - Short sentence-final words such as «Ja.» and «Nå.» keep their sentence pause.
// - The en dash (tankestrek) gets the dash pause, and the end of a paragraph
//   always gets at least a sentence pause.

import {
  DASHES, IGNORED_TRAILING, OPENING_PUNCTUATION, countWhere, isDigit, isLetter, isLower, isUpper, isVowel,
  isWordChar,
} from '../text/chars.js';
import { isKnownAbbreviation } from '../text/abbreviations.js';

export const DEFAULT_PACING = { longWordDelayMs: 200, complexWordDelayMs: 200, punctuationDelayMs: 200 };

const LONG_WORD_STEPS = [
  [6, 6], // over 6 characters: 6 % per extra character
  [10, 9],
  [14, 12],
];
const LONG_WORD_MAX = 170;
const COMPOUND_JOINER = 14;
const LONG_COMPOUND_WORD = 18;
const TECHNICAL_CONNECTOR = 8;
const SYLLABLE_BONUS_AFTER = 2;
const SYLLABLE_BONUS_PER_GROUP = 10;
const SYLLABLE_BONUS_MAX = 50;
const ALL_CAPS = 14;
const MIXED_TOKEN = 22;
const NUMERIC_TOKEN = 10;
const DENSE_CONNECTORS = 12;
const COMPLEX_WORD_MAX = 85;

export const PAUSE = {
  comma: 45,
  dash: 60,
  clause: 80,
  ellipsis: 110,
  sentence: 135,
  strongSentence: 150,
};

const isSegmentSeparator = (ch) => ch === '-' || ch === '/' || ch === '_';
const isTechnicalConnector = (ch) => '-/_.+\\'.includes(ch);

// Connectors between two word characters, e.g. the hyphen in «EU-land».
function connectorCount(word, predicate) {
  const chars = Array.from(word);
  let count = 0;
  for (let i = 1; i < chars.length - 1; i++) {
    if (predicate(chars[i]) && isWordChar(chars[i - 1]) && isWordChar(chars[i + 1])) count++;
  }
  return count;
}

export function syllableGroups(word, lang) {
  let groups = 0;
  let letters = 0;
  let previousWasVowel = false;
  let previousLetter = '';
  let lastLetter = '';
  for (const ch of word) {
    if (!isLetter(ch)) {
      previousWasVowel = false;
      continue;
    }
    letters++;
    const lower = ch.toLowerCase();
    previousLetter = lastLetter;
    lastLetter = lower;
    const vowel = isVowel(lower);
    if (vowel && !previousWasVowel) groups++;
    previousWasVowel = vowel;
  }
  if (lang === 'en' && groups > 1 && letters > 3 && lastLetter === 'e' && previousLetter !== 'l' &&
      previousLetter !== 'y') {
    groups--;
  }
  if (groups === 0 && letters > 0) groups = 1;
  return groups;
}

export function lengthBonusPercent(word) {
  const length = countWhere(word, isWordChar);
  if (length === 0) return 0;
  let bonus = 0;
  for (const [after, perChar] of LONG_WORD_STEPS) {
    if (length > after) bonus += (length - after) * perChar;
  }
  const joiners = connectorCount(word, isSegmentSeparator);
  if (joiners > 0) {
    bonus += joiners * COMPOUND_JOINER;
    if (length >= 10) bonus += LONG_COMPOUND_WORD;
  }
  const technical = connectorCount(word, isTechnicalConnector);
  if (technical > joiners) bonus += (technical - joiners) * TECHNICAL_CONNECTOR;
  return Math.min(LONG_WORD_MAX, bonus);
}

export function complexityBonusPercent(word, lang) {
  let bonus = 0;
  const groups = syllableGroups(word, lang);
  if (groups > SYLLABLE_BONUS_AFTER) {
    bonus += Math.min(SYLLABLE_BONUS_MAX, (groups - SYLLABLE_BONUS_AFTER) * SYLLABLE_BONUS_PER_GROUP);
  }
  const letters = countWhere(word, isLetter);
  const digits = countWhere(word, isDigit);
  const uppercase = countWhere(word, isUpper);
  if (letters > 0 && digits > 0) bonus += MIXED_TOKEN;
  else if (digits >= 3) bonus += NUMERIC_TOKEN;
  if (uppercase >= 2 && uppercase === letters) bonus += ALL_CAPS;
  const technical = connectorCount(word, isTechnicalConnector);
  if (technical >= 2) bonus += (technical - 1) * DENSE_CONNECTORS;
  return Math.min(COMPLEX_WORD_MAX, bonus);
}

// The word without leading quote marks or dialogue dash and without trailing
// closing quotes: «– «f.eks.»» → «f.eks.».
function core(word) {
  const chars = Array.from(word);
  let start = 0;
  while (start < chars.length && (OPENING_PUNCTUATION.has(chars[start]) || DASHES.has(chars[start]) ||
         chars[start] === ' ')) start++;
  let end = chars.length;
  while (end > start && IGNORED_TRAILING.has(chars[end - 1])) end--;
  return chars.slice(start, end).join('');
}

function trailingRhythmChar(word) {
  const chars = Array.from(word);
  for (let i = chars.length - 1; i >= 0; i--) {
    if (!IGNORED_TRAILING.has(chars[i])) return chars[i];
  }
  return '';
}

const endsWithEllipsis = (word) => trailingRhythmChar(word) === '…' || /\.{3,}$/.test(core(word));

export function startsWithLowercase(word) {
  if (!word) return false;
  for (const ch of word) {
    if (isLower(ch)) return true;
    if (isLetter(ch)) return false;
  }
  return false;
}

function isDottedInitialism(text) {
  return /^(?:\p{L}\.){2,}$/u.test(text);
}

// True when a word ending in a period is an abbreviation or ordinal rather than
// the end of a sentence.
export function looksLikeAbbreviation(word, nextWord, lang) {
  const text = core(word);
  if (!text.endsWith('.')) return false;
  if (isKnownAbbreviation(text, lang)) return true;
  if (isDottedInitialism(text)) return true;
  const nextLower = startsWithLowercase(nextWord);
  // Ordinals and dates: «17. mai», «2. verdenskrig».
  if (/^\d+\.$/.test(text)) return nextLower;
  const length = countWhere(text, isWordChar);
  // Initials: «J. K. Rowling», «H. Ibsen».
  if (length === 1) return Boolean(nextWord) && (isUpper(text[0]) || nextLower);
  return nextLower && length <= 4;
}

export function punctuationPausePercent(word, nextWord, lang) {
  if (endsWithEllipsis(word)) return PAUSE.ellipsis;
  switch (trailingRhythmChar(word)) {
    case ',':
      return PAUSE.comma;
    case '-':
    case '–':
    case '—':
      return PAUSE.dash;
    case ';':
    case ':':
      return PAUSE.clause;
    case '.':
      return looksLikeAbbreviation(word, nextWord, lang) ? 0 : PAUSE.sentence;
    case '!':
    case '?':
      return PAUSE.strongSentence;
    default:
      return 0;
  }
}

// Whether a sentence ends after this word; used for «rewind to sentence start».
export function endsSentence(word, nextWord, lang) {
  if (endsWithEllipsis(word)) return !startsWithLowercase(nextWord);
  switch (trailingRhythmChar(word)) {
    case '.':
      return !looksLikeAbbreviation(word, nextWord, lang);
    case '!':
    case '?':
      // Norwegian dialogue continues after «– Hva? sa han.»
      return !startsWithLowercase(nextWord);
    default:
      return false;
  }
}

const scaled = (percent, delayMs) => (percent * delayMs) / 100;

// The time a word is shown, split into reading the word itself (`core`) and
// the pause after it (`pause`), so a word shown in parts can be timed per part.
export function wordTiming(word, { wpm, pacing = DEFAULT_PACING, lang = 'nb', nextWord, paragraphEnd = false }) {
  const base = 60000 / wpm;
  if (!word) return { core: base, pause: 0 };
  let punctuation = punctuationPausePercent(word, paragraphEnd ? undefined : nextWord, lang);
  if (paragraphEnd) punctuation = Math.max(punctuation, PAUSE.sentence);
  return {
    core: base +
      scaled(lengthBonusPercent(word), pacing.longWordDelayMs) +
      scaled(complexityBonusPercent(word, lang), pacing.complexWordDelayMs),
    pause: scaled(punctuation, pacing.punctuationDelayMs),
  };
}

export function wordDurationMs(word, options) {
  const { core, pause } = wordTiming(word, options);
  return core + pause;
}
