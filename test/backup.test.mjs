import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BackupError, buildBackup, findMatch, parseBackup, planRestore, progressFor,
} from '../app/js/storage/backup.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../app/js/settings.js';

const book = (overrides) => ({
  id: 'a1', title: 'Sult', author: 'Knut Hamsun', lang: 'nb', format: 'epub', fileName: 'sult.epub',
  wordCount: 1000, chapterCount: 4, position: 0, finished: false, addedAt: 1, openedAt: 0, remainingMs: 1234,
  ...overrides,
});
const chapters = [{ title: 'Kapittel 1', paragraphs: ['Det var i den tid.'] }];
const roundTrip = (options) => parseBackup(JSON.stringify(buildBackup({ settings: DEFAULT_SETTINGS, ...options })));

test('settings from a file are validated and clamped', () => {
  const settings = normalizeSettings({
    pacingModel: 2, wpm: 99999, theme: 'constructor', font: 'mono', guides: 'yes', fontSize: Number.NaN, anchor: 10,
    pacing: { punctuationDelayMs: -5, longWordDelayMs: 250 }, unknown: 1,
  });
  assert.equal(settings.wpm, 1200);
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.font, 'mono');
  assert.equal(settings.guides, true);
  assert.equal(settings.fontSize, 44);
  assert.equal(settings.anchor, 25);
  assert.deepEqual(settings.pacing, { longWordDelayMs: 250, complexWordDelayMs: 200, punctuationDelayMs: 0 });
  assert.ok(!('unknown' in settings));
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
});

test('a backup round-trips progress, settings and optionally the text', () => {
  const backup = roundTrip({
    books: [book({ position: 400, openedAt: 50 }), book({ id: 'b2', title: 'Markens grøde' })],
    contents: new Map([['a1', chapters]]),
    now: new Date('2026-10-24T12:00:00Z'),
  });
  assert.equal(backup.exportedAt.toISOString(), '2026-10-24T12:00:00.000Z');
  assert.deepEqual(backup.settings, DEFAULT_SETTINGS);
  assert.equal(backup.books.length, 2);
  assert.equal(backup.books[0].record.position, 400);
  assert.ok(!('remainingMs' in backup.books[0].record));
  assert.deepEqual(backup.books[0].chapters, chapters);
  assert.equal(backup.books[1].chapters, null);
});

test('invalid and newer backup files are rejected with a clear message', () => {
  assert.throws(() => parseBackup('ikke json'), (e) => e instanceof BackupError && /ikke en sikkerhetskopi/.test(e.message));
  assert.throws(() => parseBackup('{"app":"noe annet","format":1}'), BackupError);
  assert.throws(() => parseBackup('{"app":"les-rsvp","format":99}'), /nyere versjon/);
});

test('broken book entries are dropped, broken text falls back to progress only', () => {
  const backup = parseBackup(JSON.stringify({
    app: 'les-rsvp',
    format: 1,
    books: [
      { id: 'x', title: 'Uten ord' },
      { ...book({ position: 5000, lang: 'fr' }), chapters: [{ title: 1 }] },
      'tull',
    ],
  }));
  assert.equal(backup.books.length, 1);
  assert.equal(backup.books[0].record.position, 999);
  assert.ok(!('lang' in backup.books[0].record));
  assert.equal(backup.books[0].chapters, null);
  assert.equal(backup.settings, null);
});

test('restore keeps whichever side was read most recently', () => {
  const backup = roundTrip({ books: [book({ position: 700, openedAt: 200 }), book({ id: 'b2', title: 'Jenny', openedAt: 100 })] });
  const local = [book({ position: 100, openedAt: 150 }), book({ id: 'b2', title: 'Jenny', position: 900, openedAt: 300 })];
  const plan = planRestore(backup, local);
  assert.deepEqual(plan.updates, [{ id: 'a1', changes: { position: 700, finished: false, openedAt: 200, remainingMs: null, lang: 'nb' } }]);
  assert.equal(plan.kept, 1);
});

test('books missing here are added with their text, or kept as pending progress', () => {
  const backup = roundTrip({
    books: [book({ position: 10, openedAt: 5 }), book({ id: 'c3', title: 'Vildanden', author: 'Henrik Ibsen' })],
    contents: new Map([['a1', chapters]]),
  });
  const plan = planRestore(backup, []);
  assert.equal(plan.adds.length, 1);
  assert.equal(plan.adds[0].record.id, 'a1');
  assert.equal(plan.adds[0].record.position, 10);
  assert.equal(plan.adds[0].record.chapterCount, 1);
  assert.deepEqual(plan.adds[0].chapters, chapters);
  assert.deepEqual(plan.pending.map((record) => record.id), ['c3']);
});

test('a book\'s own speed is backed up and restored, invalid speeds are dropped', () => {
  const backup = roundTrip({ books: [book({ wpm: 450, openedAt: 9 }), book({ id: 'b2', title: 'Jenny', wpm: 5 })] });
  assert.equal(backup.books[0].record.wpm, 450);
  assert.ok(!('wpm' in backup.books[1].record));
  const plan = planRestore(backup, [book({ openedAt: 1 })]);
  assert.equal(plan.updates[0].changes.wpm, 450);
  assert.ok(!('wpm' in progressFor(book({ title: 'Jenny' }), book({ id: 'new', title: 'Jenny' }))));
});

test('a new download of the same book matches by title and keeps the fraction read', () => {
  const saved = book({ position: 500, openedAt: 9 });
  const newDownload = book({ id: 'new', wordCount: 2001 });
  assert.equal(findMatch(newDownload, [saved]), saved);
  assert.equal(progressFor(saved, newDownload).position, 1001);
});

test('the same title in another format is only used when nothing better matches', () => {
  const epub = book({ id: 'e', format: 'epub' });
  const txt = book({ id: 't', format: 'txt' });
  assert.equal(findMatch(book({ id: 'new', format: 'txt' }), [epub, txt]), txt);
  // Both formats are in the backup: neither may take the other's progress.
  const backup = roundTrip({ books: [book({ id: 'e', openedAt: 9 }), book({ id: 't', format: 'txt', openedAt: 9 })] });
  const plan = planRestore(backup, [book({ id: 'e', openedAt: 1 })]);
  assert.deepEqual(plan.updates.map((update) => update.id), ['e']);
  assert.deepEqual(plan.pending.map((record) => record.id), ['t']);
});
