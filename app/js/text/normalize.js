// Text clean-up applied to every imported paragraph.

const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };

// Soft hyphen, zero-width characters and byte order marks never show up in a word.
const INVISIBLE = /[­​‌‍⁠﻿]/g;

// Collapses whitespace (including no-break and thin spaces) to single spaces.
// Number groups such as «1 000» are joined again by the tokenizer.
const WHITESPACE = /[\s   ]+/g;

export function normalizeText(text) {
  return text
    .normalize('NFC')
    .replace(/[ﬀ-ﬆ]/g, (ch) => LIGATURES[ch] || ch)
    .replace(INVISIBLE, '')
    .replace(WHITESPACE, ' ')
    .trim();
}
