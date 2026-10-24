// Focus letter (optimal recognition point). The ordinal rule comes from rsvpnano
// (src/ui/screens/ReaderScreen.cpp, focusOrdinal). Only letters and digits are
// counted, so «Hei» and «– Hei» put the focus on the same letter.

import { isWordChar } from '../text/chars.js';

export function focusOrdinal(length) {
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
}

const graphemeSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

const graphemes = (text) => (graphemeSegmenter
  ? Array.from(graphemeSegmenter.segment(text), (s) => s.segment)
  : Array.from(text));

// Splits a word into the text before the focus letter, the focus letter and
// the rest.
export function splitAtFocus(word) {
  const parts = graphemes(word);
  const wordCharPositions = [];
  parts.forEach((part, i) => {
    if (isWordChar(part[0])) wordCharPositions.push(i);
  });
  if (parts.length === 0) return { before: '', focus: '', after: '' };
  const focusAt = wordCharPositions.length === 0
    ? 0
    : wordCharPositions[Math.min(focusOrdinal(wordCharPositions.length), wordCharPositions.length - 1)];
  return {
    before: parts.slice(0, focusAt).join(''),
    focus: parts[focusAt],
    after: parts.slice(focusAt + 1).join(''),
  };
}
