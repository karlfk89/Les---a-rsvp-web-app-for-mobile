// Settings sheet, available from the library and from the reader.

import { UI_LANGUAGES, t } from '../i18n.js';
import { DEFAULT_PACING } from '../reader/pacing.js';
import {
  DEFAULT_SETTINGS, FOCUS_COLORS, FONTS, READING_MODES, SPLIT_MAX, SPLIT_MIN, THEMES, WPM_MAX, WPM_MIN, loadSettings,
  updateSettings,
} from '../settings.js';
import { VERSION } from '../version.js';
import { backupSection } from './backup-view.js';
import { range, segmented, toggle } from './controls.js';
import { h, openSheet } from './dom.js';
import { offlineStatus } from './offline.js';

// The licence texts of the code and data the app includes. The file is
// cached with the app, so this also works offline.
async function showLicences() {
  const text = h('pre', { class: 'licences' }, t('licences.loading'));
  openSheet(t('licences.title'), text);
  try {
    const response = await fetch('third-party-notices.txt');
    text.textContent = response.ok ? await response.text() : t('licences.missing');
  } catch {
    text.textContent = t('licences.missing');
  }
}

// Pause settings are stored as milliseconds at 300 words per minute (200 is
// the default) and shown as a percentage of the default, since they scale
// with the speed.
const percentOfDefault = (value) => t('percent', { value: Math.round(value / 2) });

// Options for a segmented control, labelled from the locale (theme.dark, …).
const labelled = (keys, prefix) => Object.fromEntries(keys.map((key) => [key, t(`${prefix}.${key}`)]));

// `canRestore` is false in the reader: restoring there would be overwritten
// when the open book saves its position. `book` ({ title, wpm, resetSpeed })
// is given from the reader so the book's own speed can be shown and reset.
export function openSettings(options = {}) {
  const { canRestore = false, book = null } = options;
  const s = loadSettings();
  const reopen = (changes = {}) => {
    close();
    openSettings({ ...options, ...changes });
  };
  const setPacing = (key) => (value) => updateSettings({ pacing: { ...loadSettings().pacing, [key]: value } });
  const wpm = (value) => t('wpm', { wpm: value });

  const languageSection = () => h('section', null,
    h('h3', null, t('settings.language')),
    segmented({ label: t('settings.appLanguage'), value: s.uiLanguage, options: UI_LANGUAGES,
      help: t('settings.appLanguageHelp'),
      onChange: (uiLanguage) => {
        if (uiLanguage === loadSettings().uiLanguage) return;
        updateSettings({ uiLanguage });
        // Every view and format picks up the language when the app starts.
        location.reload();
      } }));

  const pacingSection = () => h('section', null,
    h('h3', null, t('settings.pacing')),
    h('p', { class: 'setting-help' }, t('settings.pacingHelp')),
    range({ label: t('settings.punctuation'), min: 0, max: 600, step: 20, value: s.pacing.punctuationDelayMs,
      format: percentOfDefault,
      help: t('settings.punctuationHelp'),
      onInput: setPacing('punctuationDelayMs') }),
    range({ label: t('settings.longWords'), min: 0, max: 600, step: 20, value: s.pacing.longWordDelayMs,
      format: percentOfDefault,
      help: t('settings.longWordsHelp'),
      onInput: setPacing('longWordDelayMs') }),
    range({ label: t('settings.complexWords'), min: 0, max: 600, step: 20, value: s.pacing.complexWordDelayMs,
      format: percentOfDefault,
      help: t('settings.complexWordsHelp'),
      onInput: setPacing('complexWordDelayMs') }),
    toggle({ label: t('settings.smoothStart'), checked: s.smoothStart,
      help: t('settings.smoothStartHelp'),
      onChange: (smoothStart) => updateSettings({ smoothStart }) }),
    h('div', { class: 'setting' }, h('button', {
      class: 'btn',
      type: 'button',
      onclick: () => {
        updateSettings({ pacing: { ...DEFAULT_PACING } });
        reopen();
      },
    }, t('settings.resetPacing'))));

  const status = h('span', null, t('common.checking'));
  offlineStatus().then((text) => { status.textContent = text; });

  const body = h('div', { class: 'settings' },
    languageSection(),
    h('section', null,
      h('h3', null, t('settings.reading')),
      range({ label: t('settings.defaultSpeed'), min: WPM_MIN, max: WPM_MAX, step: 10, value: s.wpm,
        format: wpm,
        help: t('settings.defaultSpeedHelp'),
        onInput: (value) => updateSettings({ wpm: value }) }),
      book && book.wpm !== null
        ? h('div', { class: 'setting' },
          h('p', { class: 'setting-help' }, t('settings.bookSpeed', { title: book.title, wpm: book.wpm })),
          h('button', {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              await book.resetSpeed();
              reopen({ book: { ...book, wpm: null } });
            },
          }, t('settings.useDefaultForBook')))
        : null,
      segmented({ label: t('settings.readingMode'), value: s.readingMode,
        options: labelled(READING_MODES, 'readingMode'),
        help: t('settings.readingModeHelp'),
        onChange: (readingMode) => updateSettings({ readingMode }) }),
      toggle({ label: t('settings.phantomWords'), checked: s.phantomWords,
        help: t('settings.phantomWordsHelp'),
        onChange: (phantomWords) => updateSettings({ phantomWords }) }),
      toggle({ label: t('settings.splitLongWords'), checked: s.splitLongWords,
        help: t('settings.splitLongWordsHelp'),
        onChange: (splitLongWords) => updateSettings({ splitLongWords }) }),
      range({ label: t('settings.splitLength'), min: SPLIT_MIN, max: SPLIT_MAX, step: 1, value: s.splitLength,
        format: (count) => t('settings.letters', { count }),
        onInput: (splitLength) => updateSettings({ splitLength }) }),
      toggle({ label: t('settings.showContext'), checked: s.showContext,
        help: t('settings.showContextHelp'),
        onChange: (showContext) => updateSettings({ showContext }) }),
      toggle({ label: t('settings.guides'), checked: s.guides, onChange: (guides) => updateSettings({ guides }) }),
      segmented({ label: t('settings.focusColor'), value: s.focusColor,
        options: labelled(Object.keys(FOCUS_COLORS), 'focusColor'),
        onChange: (focusColor) => updateSettings({ focusColor }) }),
      range({ label: t('settings.anchor'), min: 25, max: 50, step: 1, value: s.anchor,
        format: (value) => t('percent', { value }),
        help: t('settings.anchorHelp'),
        onInput: (anchor) => updateSettings({ anchor }) })),
    pacingSection(),
    h('section', null,
      h('h3', null, t('settings.appearance')),
      segmented({ label: t('settings.theme'), value: s.theme, options: labelled(THEMES, 'theme'),
        onChange: (theme) => updateSettings({ theme }) }),
      segmented({ label: t('settings.font'), value: s.font, options: labelled(Object.keys(FONTS), 'font'),
        onChange: (font) => updateSettings({ font }) }),
      range({ label: t('settings.fontSize'), min: 24, max: 96, step: 2, value: s.fontSize, format: (v) => `${v} px`,
        onInput: (fontSize) => updateSettings({ fontSize }) })),
    backupSection({ canRestore, onRestored: reopen }),
    h('section', { class: 'about' },
      h('h3', null, t('settings.about')),
      h('p', null, status),
      h('p', null, t('settings.version', { version: VERSION })),
      h('p', null, t('settings.aboutBefore'),
        h('a', { href: 'https://github.com/ionutdecebal/rsvpnano', target: '_blank', rel: 'noopener' }, 'RSVP Nano'),
        t('settings.aboutAfter')),
      h('div', { class: 'setting' }, h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          close();
          showLicences();
        },
      }, t('settings.showLicences'))),
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          // The interface language stays: a reset should not switch to a language the reader may not read.
          updateSettings({ ...DEFAULT_SETTINGS, pacing: { ...DEFAULT_PACING }, uiLanguage: s.uiLanguage });
          reopen();
        },
      }, t('settings.resetAll'))));

  const close = openSheet(t('common.settings'), body);
  return close;
}
