import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHyphenator, loadHyphenator } from '../app/js/text/hyphenate.js';
import { buildVocabulary, splitLongWord } from '../app/js/text/compound.js';
import { tokenizeParagraph } from '../app/js/text/tokenize.js';
import { buildIndex, partDurations } from '../app/js/reader/book-index.js';
import { Engine } from '../app/js/reader/engine.js';
import { DEFAULT_PACING, wordDurationMs, wordTiming } from '../app/js/reader/pacing.js';

const hyphenated = (points, word) => {
  let out = '';
  let last = 0;
  for (const p of points(word)) {
    out += `${word.slice(last, p)}-`;
    last = p;
  }
  return out + word.slice(last);
};

test('Liang algorithm matches TeX on the classic examples', async () => {
  const en = await loadHyphenator('en');
  assert.equal(hyphenated(en, 'hyphenation'), 'hy-phen-ation');
  assert.equal(hyphenated(en, 'characteristically'), 'char-ac-ter-is-ti-cally');
  const tiny = createHyphenator({ patterns: '1ba 1ca', exceptions: 'ab-ra-ca-da-bra' });
  assert.deepEqual(tiny('abacab'), [3]);
  assert.deepEqual(tiny('Abracadabra'), [2, 4, 6, 8]);
});

test('Norwegian patterns keep compound parts together', async () => {
  const nb = await loadHyphenator('nb');
  assert.equal(hyphenated(nb, 'sykehusparkeringsplassen'), 'syke-hus-par-ke-rings-plas-sen');
  assert.equal(hyphenated(nb, 'barnehageplass'), 'barne-hage-plass');
  const nn = await loadHyphenator('nn');
  assert.equal(hyphenated(nn, 'kommunestyrevalet'), 'kom-mune-styre-va-let');
});

test('long compounds split into known parts', async () => {
  const points = await loadHyphenator('nb');
  const vocabulary = buildVocabulary([]);
  const split = (word, maxLetters = 13) => splitLongWord(word, { points, vocabulary, maxLetters });
  assert.deepEqual(split('sykehusparkeringsplassen'), ['sykehus-', 'parkerings-', 'plassen']);
  assert.deepEqual(split('flyplassjernbanestasjonen'), ['flyplass-', 'jernbane-', 'stasjonen']);
  assert.deepEqual(split('arbeidsmiljøloven'), ['arbeids-', 'miljøloven']);
  assert.deepEqual(split('stortingsrepresentanten'), ['stortings-', 'representanten']);
  assert.deepEqual(split('fylkeskommunen'), ['fylkes-', 'kommunen']);
  // A higher limit keeps more together.
  assert.deepEqual(split('sykehusparkeringsplassen', 18), ['sykehus-', 'parkeringsplassen']);
});

test('quotes and punctuation stay on the first and last part', async () => {
  const points = await loadHyphenator('nb');
  const vocabulary = buildVocabulary([]);
  assert.deepEqual(splitLongWord('«Sykehusparkeringsplassen»,', { points, vocabulary }),
    ['«Sykehus-', 'parkerings-', 'plassen»,']);
});

test('short, unknown and hyphenated words', async () => {
  const points = await loadHyphenator('nb');
  const vocabulary = buildVocabulary([]);
  const split = (word) => splitLongWord(word, { points, vocabulary, maxLetters: 13 });
  assert.deepEqual(split('barnehage'), ['barnehage']);
  // Without known parts a word of moderate length stays whole...
  assert.deepEqual(split('kvikksølvforgiftning'), ['kvikksølvforgiftning']);
  // ...unless the book itself has the parts.
  assert.deepEqual(splitLongWord('kvikksølvforgiftning', { points, vocabulary: buildVocabulary(['kvikksølv', 'forgiftning']) }),
    ['kvikksølv-', 'forgiftning']);
  // Far too long words are split at hyphenation points even without known parts.
  assert.ok(split('kvikksølvforgiftningsbehandlingsopplegg').length >= 3);
  // Existing hyphens are always split points.
  assert.deepEqual(split('sykehus-parkeringsplassen'), ['sykehus-', 'parkerings-', 'plassen']);
  assert.deepEqual(split('helse-og-omsorgsdepartementet'), ['helse-', 'og-omsorgs-', 'departementet']);
  assert.deepEqual(split('EU-landenes'), ['EU-landenes']);
});

test('hyphens after quotes and digits, and slashes, are split points', async () => {
  const points = await loadHyphenator('nb');
  const split = (word, words = []) =>
    splitLongWord(word, { points, vocabulary: buildVocabulary(words), maxLetters: 13 });
  // A bare ending is not a part: not «ekspedisjone-» «nes».
  assert.deepEqual(split('«Norge»-ekspedisjonenes,', ['ekspedisjon', 'ekspedisjonene']),
    ['«Norge»-', 'ekspedisjonenes,']);
  assert.deepEqual(split('1800-tallsforfatterne', ['forfatter']), ['1800-talls-', 'forfatterne']);
  assert.deepEqual(split('Skullerud/Mortensrud.'), ['Skullerud/', 'Mortensrud.']);
  assert.deepEqual(split('taknemmelighet', ['taknemmelig']), ['taknemmelighet']);
});

test('a Norwegian linking s marks a compound boundary', async () => {
  const points = await loadHyphenator('nb');
  const split = (word, words = [], lang = 'nb') =>
    splitLongWord(word, { points, vocabulary: buildVocabulary(words), maxLetters: 13, lang });
  // A word-forming suffix with s: the first part needs no entry in the vocabulary.
  assert.deepEqual(split('redningsaksjon', ['aksjon']), ['rednings-', 'aksjon']);
  assert.deepEqual(split('konsentrasjonsleirer', ['leir']), ['konsentrasjons-', 'leirer']);
  // A known word and s at a hyphenation point: the rest needs no entry either.
  assert.deepEqual(split('statsstipendiat'), ['stats-', 'stipendiat']);
  assert.deepEqual(split('idrettsbevegelsen'), ['idretts-', 'bevegelsen']);
  // The patterns have no break in «fin-ger-spid», so the s is not taken as linking.
  assert.deepEqual(split('fingerspidserne', ['finger']), ['fingerspidserne']);
  // A suffix does not swallow a known part.
  assert.deepEqual(split('polarforskningssenter', ['senter']), ['polar-', 'forsknings-', 'senter']);
  // English has no linking s.
  assert.deepEqual(split('redningsaksjon', ['aksjon'], 'en'), ['redningsaksjon']);
});

test('unspaced dashes between words separate them', () => {
  assert.deepEqual(tokenizeParagraph('dialogue—perhaps the best'), ['dialogue—', 'perhaps', 'the', 'best']);
  assert.deepEqual(tokenizeParagraph('Han kom – endelig.'), ['Han', 'kom –', 'endelig.']);
});

test('a word shown in parts is timed per part, with the pause after the last', () => {
  const options = { wpm: 300, pacing: DEFAULT_PACING, lang: 'nb' };
  const index = buildIndex({ chapters: [{ title: 'K', paragraphs: ['Den nye sykehusparkeringsplassen, sa han.'] }] });
  const parts = ['sykehus-', 'parkerings-', 'plassen,'];
  const times = partDurations(index, 2, parts, options);
  assert.equal(times.length, 3);
  assert.equal(times[0], wordTiming('sykehus-', options).core);
  const comma = wordTiming('sykehusparkeringsplassen,', { ...options, nextWord: 'sa' }).pause;
  assert.ok(comma > 0);
  assert.equal(times[2], wordTiming('plassen,', options).core + comma);
  assert.deepEqual(partDurations(index, 0, ['Den'], options), [wordDurationMs('Den', { ...options, nextWord: 'nye' })]);
});

test('the engine steps through the parts of a word before moving on', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const index = buildIndex({ chapters: [{ title: 'K', paragraphs: ['en tre to'] }] });
  const seen = [];
  const engine = new Engine(index, {
    getOptions: () => ({ wpm: 300, pacing: DEFAULT_PACING, lang: 'nb' }),
    timing: (i) => (i === 1 ? [100, 100, 100] : [100]),
    onChange: () => seen.push(`${engine.wordIndex}.${engine.part}`),
  });
  const realNow = performance.now.bind(performance);
  let now = 0;
  performance.now = () => now;
  try {
    engine.play({ leadInMs: 0 });
    for (let i = 0; i < 6; i++) {
      now += 100;
      t.mock.timers.tick(100);
    }
  } finally {
    performance.now = realNow;
  }
  assert.deepEqual(seen, ['0.0', '1.0', '1.1', '1.2', '2.0', '2.0']);
  assert.equal(engine.playing, false);
  engine.seek(1);
  assert.equal(engine.part, 0);
});
