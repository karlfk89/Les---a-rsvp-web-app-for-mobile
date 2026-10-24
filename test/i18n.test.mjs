import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { DEFAULT_UI_LANGUAGE, UI_LANGUAGES, getLocale, intlLocale, setLocale, t } from '../app/js/i18n.js';
import en from '../app/js/locales/en.js';
import { FOCUS_COLORS, FONTS, READING_MODES, THEMES, normalizeSettings } from '../app/js/settings.js';
import { LANGUAGES } from '../app/js/text/language.js';
import { formatDuration, formatPercent } from '../app/js/ui/format.js';

const appDir = new URL('../app/js/', import.meta.url).pathname;
const localeDir = join(appDir, 'locales');
const locales = await Promise.all(readdirSync(localeDir).filter((name) => name.endsWith('.js')).map(async (name) =>
  [name.replace(/\.js$/, ''), (await import(join(localeDir, name))).default]));
const sources = (dir = appDir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'locales' ? [] : sources(path);
  return entry.name.endsWith('.js') ? [readFileSync(path, 'utf8')] : [];
});
const matches = (pattern) => sources().flatMap((code) => Array.from(code.matchAll(pattern), (m) => m[1]));

const inLocale = (code, action) => {
  const previous = getLocale();
  setLocale(code);
  try {
    return action();
  } finally {
    setLocale(previous);
  }
};

test('every locale file is offered and has the same texts as English', () => {
  assert.deepEqual(locales.map(([code]) => code).sort(), Object.keys(UI_LANGUAGES).sort());
  for (const [code, texts] of locales) {
    assert.deepEqual(Object.keys(texts).sort(), Object.keys(en).sort(), code);
    for (const key of Object.keys(en)) {
      assert.equal(typeof texts[key], typeof en[key], `${code}: ${key}`);
      if (Array.isArray(en[key])) assert.equal(texts[key].length, en[key].length, `${code}: ${key}`);
    }
  }
});

test('every text the app asks for exists', () => {
  const keys = new Set([
    ...matches(/\bt\('([^']+)'/g),
    ...matches(/new ImportError\('([^']+)'\)/g).map((code) => `importError.${code}`),
    ...matches(/new BackupError\('([^']+)'\)/g).map((code) => `backupError.${code}`),
    ...Object.keys(LANGUAGES).flatMap((code) => [`lang.${code}`, `lang.${code}.short`]),
    ...THEMES.map((key) => `theme.${key}`),
    ...READING_MODES.map((key) => `readingMode.${key}`),
    ...Object.keys(FONTS).map((key) => `font.${key}`),
    ...Object.keys(FOCUS_COLORS).map((key) => `focusColor.${key}`),
  ]);
  assert.ok(keys.size > 100, `only found ${keys.size} keys`);
  for (const key of keys) assert.ok(key in en, `missing text: ${key}`);
});

test('English is the default and unknown languages fall back to it', () => {
  assert.equal(DEFAULT_UI_LANGUAGE, 'en');
  assert.equal(normalizeSettings({}).uiLanguage, 'en');
  assert.equal(normalizeSettings({ uiLanguage: 'nb' }).uiLanguage, 'nb');
  assert.equal(normalizeSettings({ uiLanguage: 'sv' }).uiLanguage, 'en');
  assert.deepEqual(Object.keys(UI_LANGUAGES), ['en', 'nb']);
  assert.equal(inLocale('sv', () => getLocale()), 'en');
  assert.equal(inLocale('nb', () => t('library.title')), 'Bibliotek');
  assert.equal(t('library.title'), 'Library');
  assert.equal(t('no.such.text'), 'no.such.text');
});

test('plurals, durations and percentages follow the language', () => {
  assert.equal(t('book.chapters', { count: 1 }), '1 chapter');
  assert.equal(inLocale('nb', () => t('book.chapters', { count: 3 })), '3 kapitler');
  assert.equal(formatDuration(90 * 60000), '1 h 30 min');
  assert.equal(inLocale('nb', () => formatDuration(90 * 60000)), '1 t 30 min');
  assert.equal(formatDuration(20000), '< 1 min');
  assert.equal(formatPercent(0.045), '4.5%');
  assert.equal(inLocale('nb', () => formatPercent(0.045)), '4,5 %');
  assert.equal(inLocale('nb', () => new Date(2026, 9, 24).toLocaleDateString(intlLocale())), '24.10.2026');
  assert.equal(formatPercent(0.999), '99%');
  assert.equal(formatPercent(1), '100%');
  assert.equal(t('backup.restored', { settings: true, updated: 2, added: 1, pending: 0, kept: 0 }),
    'The settings were restored. 2 books got their progress back. 1 book was added.');
  assert.equal(inLocale('nb', () => t('backup.confirmRestore', { date: null, settings: true, progress: 2, text: 1 })),
    'Gjenopprette sikkerhetskopien?\n\nDen inneholder innstillinger, fremdrift for 2 bøker og teksten til 1 bok. ' +
    'Fremdrift som er nyere på denne enheten, beholdes.');
});
