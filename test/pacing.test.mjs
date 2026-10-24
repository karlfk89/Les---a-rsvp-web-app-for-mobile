import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildIndex, calibrationFactor, durationAt, estimateMs } from '../app/js/reader/book-index.js';
import { Engine } from '../app/js/reader/engine.js';
import { DEFAULT_PACING, wordDurationMs, wordTiming } from '../app/js/reader/pacing.js';
import { DEFAULT_SETTINGS, bookSpeed, convertLegacyWpm, normalizeSettings } from '../app/js/settings.js';
import { BOKMAL_CHAPTERS, bokmalText } from './fixtures/samples.mjs';
import { parseText } from '../app/js/import/txt.js';

const at = (wpm, extra = {}) => ({ wpm, pacing: DEFAULT_PACING, lang: 'nb', ...extra });

test('pauses and bonuses scale with the speed', () => {
  const slow = wordTiming('arbeidsmiljøloven,', at(300, { nextWord: 'om' }));
  const fast = wordTiming('arbeidsmiljøloven,', at(600, { nextWord: 'om' }));
  assert.ok(Math.abs(fast.pause - slow.pause / 2) < 1e-9);
  assert.ok(Math.abs(fast.core - slow.core / 2) < 1e-9);
});

test('short words are quicker and names inside a sentence slower', () => {
  assert.equal(wordDurationMs('i', at(300, { nextWord: 'går' })), 170);
  assert.equal(wordDurationMs('og', at(300, { nextWord: 'så' })), 170);
  assert.equal(wordDurationMs('det', at(300, { nextWord: 'var' })), 184);
  assert.equal(wordDurationMs('Kari', at(300, { sentenceStart: false })), 200 + 0.15 * 200);
  assert.equal(wordDurationMs('Kari', at(300, { sentenceStart: true })), 200);
  assert.equal(wordDurationMs('NATO', at(300, { sentenceStart: false })), wordDurationMs('NATO', at(300)));
});

test('a name inside a sentence is recognised from the text', () => {
  const index = buildIndex({ chapters: [{ title: 'K', paragraphs: ['Hun traff Kari. Kari smilte.'] }] });
  const options = at(300);
  // «Kari» after «traff» is a name inside the sentence; after «Kari.» it starts a sentence.
  assert.ok(durationAt(index, 2, options) > durationAt(index, 3, options) - 1e-9);
  assert.equal(durationAt(index, 3, options), wordDurationMs('Kari.', at(300, { nextWord: 'smilte.', sentenceStart: true })));
});

test('calibration makes the chosen speed the real average', () => {
  const book = parseText(`${bokmalText()}\n\n${bokmalText()}`, { filename: 'flyturen.txt' });
  const index = buildIndex(book);
  const calibration = calibrationFactor(index, { pacing: DEFAULT_PACING, lang: 'nb' });
  for (const wpm of [200, 300, 600]) {
    const total = estimateMs(index, 0, index.words.length, at(wpm, { calibration }));
    const real = index.words.length / (total / 60000);
    assert.ok(Math.abs(real - wpm) / wpm < 0.02, `${wpm} → ${real.toFixed(1)}`);
  }
  assert.ok(calibration < 1, `uncalibrated pace is slower than chosen: ${calibration}`);
});

test('speeds saved before calibration are converted so reading feels the same', () => {
  assert.equal(convertLegacyWpm(300), 250);
  assert.equal(convertLegacyWpm(250), 215);
  assert.equal(convertLegacyWpm(600), 430);
  assert.equal(normalizeSettings({ wpm: 300 }).wpm, 250);
  assert.equal(normalizeSettings({ wpm: 300, pacingModel: 2 }).wpm, 300);
  assert.equal(normalizeSettings({}).wpm, DEFAULT_SETTINGS.wpm);
  assert.equal(normalizeSettings({ wpm: 300 }).pacingModel, 2);
  assert.equal(bookSpeed({ wpm: 325 }), 270);
  assert.equal(bookSpeed({ wpm: 325, pacingModel: 2 }), 325);
  assert.equal(bookSpeed({}), null);
});

test('smooth start shows the first words a little longer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const index = buildIndex({ chapters: BOKMAL_CHAPTERS });
  const shown = [];
  let smoothStart = true;
  const engine = new Engine(index, {
    getOptions: () => ({ ...at(300), smoothStart }),
    timing: () => [100],
    onChange: () => shown.push(engine.duration()),
  });
  const realNow = performance.now.bind(performance);
  let now = 0;
  performance.now = () => now;
  try {
    engine.play({ leadInMs: 0 });
    for (let i = 0; i < 6; i++) {
      now += engine.duration();
      t.mock.timers.tick(engine.duration());
    }
    assert.deepEqual(shown.map((ms) => Math.round(ms)), [160, 145, 130, 115, 100, 100, 100]);
    engine.pause();
    smoothStart = false;
    shown.length = 0;
    engine.play({ leadInMs: 0 });
    assert.equal(Math.round(shown[0]), 100);
  } finally {
    performance.now = realNow;
  }
});
