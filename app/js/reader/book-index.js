// Flattens a stored book (chapters of paragraph strings) into the word list the
// reader steps through, with paragraph and chapter boundaries.

import { tokenizeParagraph } from '../text/tokenize.js';
import { endsSentence, wordDurationMs, wordTiming } from './pacing.js';

export function buildIndex(book) {
  const words = [];
  const paragraphs = [];
  const chapters = [];
  for (const chapter of book.chapters) {
    const start = words.length;
    for (const text of chapter.paragraphs) {
      const tokens = tokenizeParagraph(text);
      if (tokens.length === 0) continue;
      paragraphs.push({ start: words.length, end: words.length + tokens.length });
      for (const token of tokens) words.push(token);
    }
    if (words.length > start) chapters.push({ title: chapter.title, start, end: words.length });
  }
  const paragraphOf = new Uint32Array(words.length);
  paragraphs.forEach((paragraph, p) => paragraphOf.fill(p, paragraph.start, paragraph.end));
  return { words, paragraphs, chapters, paragraphOf };
}

// Index of the last element in `items` whose `start` is <= wordIndex.
function lastStartingAtOrBefore(items, wordIndex) {
  let low = 0;
  let high = items.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (items[mid].start <= wordIndex) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export const chapterIndexAt = (index, wordIndex) => lastStartingAtOrBefore(index.chapters, wordIndex);

export function paragraphAt(index, wordIndex) {
  return index.paragraphs[index.paragraphOf[wordIndex]];
}

export function isParagraphEnd(index, wordIndex) {
  const paragraph = paragraphAt(index, wordIndex);
  return paragraph ? paragraph.end - 1 === wordIndex : true;
}

const isSentenceStart = (index, wordIndex, lang) => wordIndex === paragraphAt(index, wordIndex).start ||
  endsSentence(index.words[wordIndex - 1], index.words[wordIndex], lang);

function timingOptions(index, wordIndex, { wpm, pacing, lang }) {
  return {
    wpm,
    pacing,
    lang,
    nextWord: index.words[wordIndex + 1],
    paragraphEnd: isParagraphEnd(index, wordIndex),
    sentenceStart: isSentenceStart(index, wordIndex, lang),
  };
}

// `calibration` (see calibrationFactor) scales all times so the chosen speed
// is the real average.
export function durationAt(index, wordIndex, options) {
  return wordDurationMs(index.words[wordIndex], timingOptions(index, wordIndex, options)) * (options.calibration ?? 1);
}

// Display times for a word shown in parts («sykehus-» «parkerings-»
// «plassen»): each part is timed like a word of its own, and the pause after
// the word follows its last part.
export function partDurations(index, wordIndex, parts, options) {
  const { core, pause } = wordTiming(index.words[wordIndex], timingOptions(index, wordIndex, options));
  const factor = options.calibration ?? 1;
  if (parts.length < 2) return [(core + pause) * factor];
  const { wpm, pacing, lang } = options;
  return parts.map((part, i) =>
    (wordTiming(part, { wpm, pacing, lang }).core + (i === parts.length - 1 ? pause : 0)) * factor);
}

// The factor that makes the average display time over the book 60000 / wpm,
// so the chosen speed is the real average reading speed, pauses included.
// Bonuses and pauses scale with the speed, so this depends only on the text
// and the pause settings.
export function calibrationFactor(index, { pacing, lang }) {
  const count = index.words.length;
  if (count === 0) return 1;
  const samples = Math.min(count, 4000);
  const stride = count / samples;
  let total = 0;
  for (let s = 0; s < samples; s++) total += durationAt(index, Math.floor(s * stride), { wpm: 300, pacing, lang });
  return 200 / (total / samples);
}

export function sentenceStartAtOrBefore(index, wordIndex, lang) {
  const paragraph = paragraphAt(index, wordIndex);
  let i = wordIndex;
  while (i > paragraph.start && !endsSentence(index.words[i - 1], index.words[i], lang)) i--;
  return i;
}

// Estimated reading time in ms for words [from, to). Long ranges are sampled.
export function estimateMs(index, from, to, options) {
  const count = to - from;
  if (count <= 0) return 0;
  const samples = Math.min(count, 1500);
  const stride = count / samples;
  let total = 0;
  for (let s = 0; s < samples; s++) total += durationAt(index, from + Math.floor(s * stride), options);
  return (total / samples) * count;
}
