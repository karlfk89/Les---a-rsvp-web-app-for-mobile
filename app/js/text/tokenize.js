// Splits a normalised paragraph into the tokens shown one at a time.
// Punctuation stays attached to its word, as in rsvpnano, so «Hei, keeps its
// comma pause and the quote marks are shown with the word.

import { DASHES, OPENING_PUNCTUATION, hasWordChar } from './chars.js';

const NBSP = ' ';
const NUMBER_HEAD = /^[-+−(]?\d{1,3}$/;
const NUMBER_GROUP = /^\d{3}$/;
const NUMBER_TAIL = /^\d{3}(?:[.,]\d+)?[^\p{L}\p{N}]*$/u;
const OPENING_THEN_SPACE = /^([«„“‘‚(\[{¿¡"'‹]+) /u;

// «1 000» may take another group; «1 000,» or «1814» may not.
function canTakeNumberGroup(token) {
  const [head, ...groups] = token.split(NBSP);
  return NUMBER_HEAD.test(head) && groups.every((group) => NUMBER_GROUP.test(group));
}

const isOpening = (token) => [...token].every((ch) => OPENING_PUNCTUATION.has(ch));
const isDash = (token) => [...token].every((ch) => DASHES.has(ch));

export function tokenizeParagraph(text) {
  // Join Norwegian number groups: «1 000 000», «kr 12 500».
  const tokens = [];
  for (const token of text.split(' ')) {
    if (!token) continue;
    const previous = tokens[tokens.length - 1];
    if (previous !== undefined && canTakeNumberGroup(previous) && NUMBER_TAIL.test(token)) {
      tokens[tokens.length - 1] = previous + NBSP + token;
    } else {
      tokens.push(token);
    }
  }

  // Attach tokens without letters or digits to a neighbour: a dialogue dash at
  // the start of a paragraph or an opening quote goes with the next word, other
  // punctuation (a free-standing tankestrek, a closing quote) with the previous.
  const merged = [];
  let prefix = '';
  for (const token of tokens) {
    if (hasWordChar(token)) {
      merged.push(prefix ? `${prefix} ${token}`.replace(OPENING_THEN_SPACE, '$1') : token);
      prefix = '';
    } else if (merged.length === 0 || isOpening(token)) {
      prefix = prefix ? `${prefix} ${token}` : token;
    } else {
      merged[merged.length - 1] += isDash(token) ? ` ${token}` : token;
    }
  }
  if (prefix) {
    if (merged.length > 0) merged[merged.length - 1] += ` ${prefix}`;
    else merged.push(prefix);
  }
  return merged;
}
