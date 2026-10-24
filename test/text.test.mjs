import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectLanguage, normalizeLang } from '../app/js/text/language.js';
import { normalizeText } from '../app/js/text/normalize.js';
import { tokenizeParagraph } from '../app/js/text/tokenize.js';
import { splitAtFocus } from '../app/js/reader/orp.js';
import {
  DEFAULT_PACING, PAUSE, endsSentence, lengthBonusPercent, punctuationPausePercent, syllableGroups, wordDurationMs,
} from '../app/js/reader/pacing.js';

const tokens = (text) => tokenizeParagraph(normalizeText(text));

test('normalisation composes å and removes soft hyphens and ligatures', () => {
  assert.equal(normalizeText('årstid'), 'årstid');
  assert.equal(normalizeText('sy­ke­hus'), 'sykehus');
  assert.equal(normalizeText('ﬁnne  og \n flate'), 'finne og flate');
});

test('dialogue dash and quotes stay with their words', () => {
  assert.deepEqual(tokens('– Hei, sa hun.'), ['– Hei,', 'sa', 'hun.']);
  assert.deepEqual(tokens('« Hva nå? »'), ['«Hva', 'nå?»']);
  assert.deepEqual(tokens('Han kom – endelig – hjem.'), ['Han', 'kom –', 'endelig –', 'hjem.']);
});

test('Norwegian number groups and decimal commas are kept together', () => {
  assert.deepEqual(tokens('Det kostet kr 1 500 000, sa han.'), ['Det', 'kostet', 'kr', '1 500 000,', 'sa', 'han.']);
  assert.deepEqual(tokens('Rundt 3,5 prosent i 1814 og 12 000 meter.'),
    ['Rundt', '3,5', 'prosent', 'i', '1814', 'og', '12 000', 'meter.']);
});

test('hyphenated compounds stay one token', () => {
  assert.deepEqual(tokens('EU-land og e-post'), ['EU-land', 'og', 'e-post']);
});

test('focus letter follows the rsvpnano ordinal and skips punctuation', () => {
  assert.deepEqual(splitAtFocus('å'), { before: '', focus: 'å', after: '' });
  assert.deepEqual(splitAtFocus('ære'), { before: 'æ', focus: 'r', after: 'e' });
  assert.deepEqual(splitAtFocus('«Hei'), { before: '«H', focus: 'e', after: 'i' });
  assert.deepEqual(splitAtFocus('– Hei,'), { before: '– H', focus: 'e', after: 'i,' });
  assert.deepEqual(splitAtFocus('sykehusparkeringsplass'), { before: 'syke', focus: 'h', after: 'usparkeringsplass' });
});

test('Norwegian abbreviations, ordinals and short sentences', () => {
  const pause = (word, next, lang = 'nb') => punctuationPausePercent(word, next, lang);
  assert.equal(pause('f.eks.', 'en'), 0);
  assert.equal(pause('bl.a.', 'fordi'), 0);
  assert.equal(pause('t.d.', 'ein', 'nn'), 0);
  assert.equal(pause('17.', 'mai'), 0);
  assert.equal(pause('osv.»', 'Hun'), 0);
  assert.equal(pause('Ja.', 'Hun'), PAUSE.sentence);
  assert.equal(pause('Nå.', 'Det'), PAUSE.sentence);
  assert.equal(pause('jul.', 'Det'), PAUSE.sentence);
  assert.equal(pause('1814.', 'Det'), PAUSE.sentence);
  assert.equal(pause('J.', 'K.'), 0);
  assert.equal(pause('e.g.', 'the', 'en'), 0);
  assert.equal(pause('hjem.»', 'Så'), PAUSE.sentence);
});

test('punctuation pauses', () => {
  assert.equal(punctuationPausePercent('Hei,', 'du', 'nb'), PAUSE.comma);
  assert.equal(punctuationPausePercent('kom –', 'endelig', 'nb'), PAUSE.dash);
  assert.equal(punctuationPausePercent('slik:', 'først', 'nb'), PAUSE.clause);
  assert.equal(punctuationPausePercent('vel…', 'Så', 'nb'), PAUSE.ellipsis);
  assert.equal(punctuationPausePercent('Hva?', 'Hun', 'nb'), PAUSE.strongSentence);
});

test('sentence ends respect Norwegian dialogue', () => {
  assert.equal(endsSentence('Hva?', 'sa', 'nb'), false);
  assert.equal(endsSentence('Hva?', 'Hun', 'nb'), true);
  assert.equal(endsSentence('f.eks.', 'når', 'nb'), false);
  assert.equal(endsSentence('hjem.', 'Så', 'nb'), true);
});

test('silent final e only applies to English', () => {
  assert.equal(syllableGroups('jente', 'nb'), 2);
  assert.equal(syllableGroups('make', 'en'), 1);
  assert.equal(syllableGroups('gate', 'nn'), 2);
});

test('long Norwegian compounds get extra time', () => {
  assert.equal(lengthBonusPercent('og'), 0);
  assert.ok(lengthBonusPercent('arbeidsmiljøloven') > 100);
  const short = wordDurationMs('hus', { wpm: 300, lang: 'nb', nextWord: 'og' });
  const long = wordDurationMs('sykehusparkeringsplass', { wpm: 300, lang: 'nb', nextWord: 'og' });
  assert.equal(short, 200);
  assert.ok(long > 500, `long compound got ${long} ms`);
});

test('paragraph end always pauses like a sentence end', () => {
  const options = { wpm: 300, pacing: DEFAULT_PACING, lang: 'nb' };
  assert.equal(wordDurationMs('Kapittel', { ...options, nextWord: 'en' }), 200 + 0.06 * 200 * 2 + 0.1 * 200);
  const heading = wordDurationMs('Hjem', { ...options, paragraphEnd: true });
  assert.equal(heading, 200 + (PAUSE.sentence / 100) * 200);
});

test('language tags and detection', () => {
  assert.equal(normalizeLang('nb-NO'), 'nb');
  assert.equal(normalizeLang('no'), 'nb');
  assert.equal(normalizeLang('nno'), 'nn');
  assert.equal(normalizeLang('en-GB'), 'en');
  assert.equal(normalizeLang('sv'), null);
  assert.equal(detectLanguage('Jeg vet ikke hva hun mener, men det er ikke så farlig. Hun kommer hjem i morgen.'), 'nb');
  assert.equal(detectLanguage('Eg veit ikkje kva ho meiner, men det er ikkje så farleg. Ho kjem heim i morgon.'), 'nn');
  assert.equal(detectLanguage('I do not know what she means, but it is not that bad. She was at home with him.'), 'en');
});
