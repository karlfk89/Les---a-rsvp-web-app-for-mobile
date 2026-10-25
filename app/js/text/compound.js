// Splits very long words into parts shown one after the other, such as
// «sykehus-» «parkerings-» «plassen».
//
// 1. The word is segmented into known parts with dynamic programming. Known
//    parts come from the book's own words and a list of common compound parts,
//    allowing a linking s/e (arbeid-s) and inflected forms (plass-en). Letters
//    not covered by known parts are expensive, so the segmentation that
//    explains most of the word wins. A boundary must be a hyphenation point
//    from the TeX patterns, or lie between two known parts.
// 2. The parts are grouped into display chunks of at most `maxLetters` letters,
//    as few and as even as possible.
// Words without a good segmentation (known parts covering less than half of
// it) are left whole, unless they are more than twice the limit; those are
// split at the hyphenation points nearest the middle.
//
// In Norwegian a linking s is strong evidence of a compound boundary. A part
// ending in a word-forming suffix and s («rednings», «konsentrasjons») counts
// as known, and so does a part of four letters or more that follows a known
// part ending in s at a hyphenation point («stats|stipendiat»). The patterns
// put no break in «fin-ger-spid-ser-ne», so «fingers|pidserne» is not taken.

import { COMPOUND_WORDS } from './compound-words.js';
import { isWordChar } from './chars.js';

const MIN_PART = 3;
// An unknown last part of three letters is nearly always an ending
// («ekspedisjone|nes», «Taknemmelig|hed»); three-letter compound parts such as
// hus, fly and sjø come from the word list.
const MIN_UNKNOWN_LAST = 4;
const PART_COST = 0.5;
const OFF_POINT_COST = 0.25;
// A part known only from its suffix («forsynings») loses ties to real words.
const DERIVATION_COST = 0.25;
const LINKING = new Set(['s', 'e']);
const INFLECTIONS = ['ene', 'ane', 'ens', 'ets', 'en', 'et', 'er', 'ar', 'ne', 'a', 'e', 'n', 'r', 's', 't'];
// Word-forming suffixes that take a linking s in compounds, in today's and
// older spelling: forsynings-, informasjons-, sikkerhets-, vitenskaps-, …
const LINKED_DERIVATION = /(?:ing|sjon|tion|het|hed|skap|skab|dom|else|itet|nad)s$/;
const MIN_LINKED_HEAD = 4;
const MIN_KNOWN_TAIL = 6;

// Words from the book need four letters: short words such as «dig» or «ses»
// would otherwise explain fragments of unrelated words. Three-letter compound
// parts (hus, fly, sjø) come from the curated list.
const MIN_BOOK_WORD = 4;

export function buildVocabulary(words, base = COMPOUND_WORDS) {
  const vocabulary = new Set(base);
  for (const word of words) {
    const letters = word.toLowerCase().replace(/[^\p{L}]/gu, '');
    if (letters.length >= MIN_BOOK_WORD) vocabulary.add(letters);
  }
  return vocabulary;
}

function isKnownWord(text, vocabulary) {
  if (vocabulary.has(text)) return true;
  return INFLECTIONS.some((suffix) => text.length - suffix.length >= MIN_PART && text.endsWith(suffix) &&
    vocabulary.has(text.slice(0, -suffix.length)));
}

const letterCount = (text) => Array.from(text).filter(isWordChar).length;

const isLinkedDerivation = (part) => part.length >= 6 && LINKED_DERIVATION.test(part);

// Segments a run of letters into parts; returns [text] when nothing beats
// leaving it whole.
function segment(text, { points, vocabulary, maxLetters, linkingS }) {
  const lower = text.toLowerCase();
  const n = lower.length;
  const hyphenation = new Set(points(text));
  const isKnownPart = (part) => part.length >= MIN_PART &&
    (isKnownWord(part, vocabulary) || (LINKING.has(part[part.length - 1]) && isKnownWord(part.slice(0, -1), vocabulary)));
  // A part known only from its suffix. It is better split where it ends in a
  // known word when it is longer than the limit («polar|forsknings») or also
  // starts with a known word («sykehus|parkerings»). A short known ending is no
  // such evidence: «passerings» is not «passe|rings».
  const hasKnownSplit = (start, end) => [...hyphenation].some((p) => p >= start + MIN_PART &&
    p <= end - MIN_PART && isKnownPart(lower.slice(p, end)) &&
    (end - start > maxLetters || (end - p >= MIN_KNOWN_TAIL && isKnownPart(lower.slice(start, p)))));
  const isDerivation = (start, end) => linkingS && isLinkedDerivation(lower.slice(start, end)) &&
    !hasKnownSplit(start, end);
  // Letters beyond the display limit cost as much as unknown letters, so a
  // known long part does not win over a split into shorter known parts.
  const partCost = (part, known) => PART_COST + (known ? Math.max(0, part.length - maxLetters) : part.length);

  // best[i][k]: cheapest segmentation of lower[0, i) whose last part is known (k = 1) or not (k = 0).
  const best = Array.from({ length: n + 1 }, () => [null, null]);
  best[0][1] = { cost: 0, from: -1, state: 1 };
  for (let end = MIN_PART; end <= n; end++) {
    for (let start = 0; start <= end - MIN_PART; start++) {
      if (start > 0 && start < MIN_PART) continue;
      const part = lower.slice(start, end);
      // The book always contains the whole word, so it is no evidence for itself.
      const plain = isKnownPart(part);
      const derived = !plain && isDerivation(start, end);
      const known = (start > 0 || end < n) && (plain || derived);
      if (!known && start > 0 && end === n && part.length < MIN_UNKNOWN_LAST) continue;
      const atPoint = start === 0 || hyphenation.has(start);
      for (const previousState of [0, 1]) {
        const previous = best[start][previousState];
        if (!previous) continue;
        if (!atPoint && !(known && previousState === 1)) continue;
        const cost = previous.cost + partCost(part, known) + (known && derived ? DERIVATION_COST : 0) +
          (atPoint ? 0 : OFF_POINT_COST);
        const state = known ? 1 : 0;
        if (!best[end][state] || cost < best[end][state].cost) best[end][state] = { cost, from: start, state: previousState };
      }
    }
  }
  const finals = best[n].filter(Boolean);
  if (finals.length === 0) return [text];
  let entry = finals.reduce((a, b) => (b.cost < a.cost ? b : a));
  const cuts = [];
  let position = n;
  while (entry && entry.from > 0) {
    cuts.unshift(entry.from);
    const next = best[entry.from][entry.state];
    position = entry.from;
    entry = next;
  }
  if (cuts.length === 0 || position <= 0) return [text];
  const parts = [0, ...cuts].map((cut, i, all) => text.slice(cut, all[i + 1] ?? n));
  // Weak evidence (known words covering less than half the word) gives odd
  // splits; such words are better left whole.
  const evidence = parts.map((part) => {
    const lowerPart = part.toLowerCase();
    return isKnownPart(lowerPart) || (linkingS && isLinkedDerivation(lowerPart));
  });
  const knownLetters = parts.reduce((sum, part, i) => {
    const previous = parts[i - 1]?.toLowerCase();
    const afterLink = linkingS && evidence[i - 1] && previous.endsWith('s') && previous.length > MIN_LINKED_HEAD &&
      hyphenation.has(cuts[i - 1]) && part.length >= MIN_LINKED_HEAD;
    return evidence[i] || afterLink ? sum + part.length : sum;
  }, 0);
  return knownLetters * 2 >= n ? parts : [text];
}

// Splits at the hyphenation point nearest the middle until parts fit.
function forceSplit(text, { points, maxLetters }) {
  if (text.length <= maxLetters) return [text];
  const candidates = points(text).filter((p) => p >= MIN_PART && p <= text.length - MIN_PART);
  if (candidates.length === 0) return [text];
  const at = candidates.reduce((a, b) => (Math.abs(2 * b - text.length) < Math.abs(2 * a - text.length) ? b : a));
  return [...forceSplit(text.slice(0, at), { points, maxLetters }), ...forceSplit(text.slice(at), { points, maxLetters })];
}

// Groups consecutive parts into chunks: fewest letters beyond the limit, then
// fewest chunks, then the shortest longest chunk.
function group(parts, maxLetters) {
  const lengths = parts.map(letterCount);
  let best = null;
  for (let mask = 0; mask < 1 << (parts.length - 1); mask++) {
    const chunks = [];
    let current = [0];
    for (let i = 1; i < parts.length; i++) {
      if (mask & (1 << (i - 1))) {
        chunks.push(current);
        current = [i];
      } else {
        current.push(i);
      }
    }
    chunks.push(current);
    const sizes = chunks.map((chunk) => chunk.reduce((sum, i) => sum + lengths[i], 0));
    const excess = sizes.reduce((sum, size) => sum + Math.max(0, size - maxLetters), 0);
    const key = [excess, chunks.length, Math.max(...sizes)];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] ||
        (key[1] === best.key[1] && key[2] < best.key[2])))) {
      best = { key, chunks };
    }
  }
  return best.chunks.map((chunk) => chunk.map((i) => parts[i]).join(''));
}

const BREAKS = '-/';

function splitCore(core, options) {
  // Hyphens and slashes inside the word are always boundaries: «EU-landenes»,
  // «Maud»-ekspedisjonen, 1800-tallet, Skullerud/Mortensrud.
  const pieces = [];
  let start = 0;
  for (let i = 1; i < core.length - 1; i++) {
    if (BREAKS.includes(core[i]) && !BREAKS.includes(core[i - 1]) && !BREAKS.includes(core[i + 1])) {
      pieces.push(core.slice(start, i + 1));
      start = i + 1;
    }
  }
  pieces.push(core.slice(start));

  const parts = pieces.flatMap((piece) => {
    // Only the letters are segmented; quotes and the like stay on the outer parts («Maud»-).
    const match = /^(\P{L}*)(\p{L}+)(\P{L}*)$/u.exec(piece);
    if (letterCount(piece) <= options.maxLetters || !match) return [piece];
    const [, lead, letters, trail] = match;
    const segmented = segment(letters, options)
      .flatMap((part) => (part.length > 2 * options.maxLetters ? forceSplit(part, options) : [part]));
    segmented[0] = lead + segmented[0];
    segmented[segmented.length - 1] += trail;
    return segmented;
  });
  return parts.length > 1 ? group(parts, options.maxLetters) : parts;
}

// Returns the display parts of a token: [token] when it is short enough or no
// good split exists. Every part but the last ends with a hyphen (or the slash
// it was split at); quotes and punctuation stay on the first and last part.
// `lang` is the book's language; the linking s rules are Norwegian.
export function splitLongWord(token, { points, vocabulary, maxLetters = 13, lang = 'nb' }) {
  if (letterCount(token) <= maxLetters) return [token];
  const chars = Array.from(token);
  let start = 0;
  while (start < chars.length && !isWordChar(chars[start])) start++;
  let end = chars.length;
  while (end > start && !isWordChar(chars[end - 1])) end--;
  const prefix = chars.slice(0, start).join('');
  const core = chars.slice(start, end).join('');
  const suffix = chars.slice(end).join('');
  const parts = splitCore(core, { points, vocabulary, maxLetters, linkingS: lang !== 'en' });
  if (parts.length === 1) return [token];
  return parts.map((part, i) => {
    const last = i === parts.length - 1;
    const text = last || BREAKS.includes(part[part.length - 1]) ? part : `${part}-`;
    return (i === 0 ? prefix : '') + text + (last ? suffix : '');
  });
}
