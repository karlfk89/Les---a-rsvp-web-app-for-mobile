// Flattens a stored book (chapters of paragraph strings) into the word list the
// reader steps through, with paragraph and chapter boundaries.

import { tokenizeParagraph } from '../text/tokenize.js';
import { endsSentence, wordDurationMs } from './pacing.js';

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

export function durationAt(index, wordIndex, { wpm, pacing, lang }) {
  return wordDurationMs(index.words[wordIndex], {
    wpm,
    pacing,
    lang,
    nextWord: index.words[wordIndex + 1],
    paragraphEnd: isParagraphEnd(index, wordIndex),
  });
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
