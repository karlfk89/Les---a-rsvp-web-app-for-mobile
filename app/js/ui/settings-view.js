// Settings sheet, available from the library and from the reader.

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

// Pause settings are stored as milliseconds at 300 words per minute (200 is
// the default) and shown as a percentage of the default, since they scale
// with the speed.
const percentOfDefault = (value) => `${Math.round(value / 2)} %`;

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

  const pacingSection = () => h('section', null,
    h('h3', null, 'Pauser og rytme'),
    h('p', { class: 'setting-help' }, '100 % er standard. Pausene følger hastigheten, og hastigheten er alltid ' +
      'snittet med pausene medregnet: mer pause ett sted gir litt raskere visning ellers.'),
    range({ label: 'Tegnsetting', min: 0, max: 600, step: 20, value: s.pacing.punctuationDelayMs,
      format: percentOfDefault,
      help: 'Pause etter komma, tankestrek, punktum, spørsmålstegn og avsnitt.',
      onInput: setPacing('punctuationDelayMs') }),
    range({ label: 'Lange ord', min: 0, max: 600, step: 20, value: s.pacing.longWordDelayMs, format: percentOfDefault,
      help: 'Ekstra tid for lange ord, som «arbeidsmiljøloven».',
      onInput: setPacing('longWordDelayMs') }),
    range({ label: 'Vanskelige ord', min: 0, max: 600, step: 20, value: s.pacing.complexWordDelayMs,
      format: percentOfDefault,
      help: 'Ekstra tid for ord med mange stavelser, tall, forkortelser og navn.',
      onInput: setPacing('complexWordDelayMs') }),
    toggle({ label: 'Myk start', checked: s.smoothStart,
      help: 'De første ordene etter at du starter, vises litt saktere, så øynene finner rytmen.',
      onChange: (smoothStart) => updateSettings({ smoothStart }) }),
    h('div', { class: 'setting' }, h('button', {
      class: 'btn',
      type: 'button',
      onclick: () => {
        updateSettings({ pacing: { ...DEFAULT_PACING } });
        reopen();
      },
    }, 'Tilbakestill pauser')));

  const status = h('span', null, 'Sjekker …');
  offlineStatus().then((text) => { status.textContent = text; });

  const body = h('div', { class: 'settings' },
    h('section', null,
      h('h3', null, 'Lesing'),
      range({ label: 'Standardhastighet', min: WPM_MIN, max: WPM_MAX, step: 10, value: s.wpm,
        format: (v) => `${v} ord/min`,
        help: 'Gjennomsnittlig lesefart med pauser. Brukes for bøker der du ikke har endret hastigheten; ' +
          'endrer du den med − og + mens du leser, husker boka sin egen.',
        onInput: (wpm) => updateSettings({ wpm }) }),
      book && book.wpm !== null
        ? h('div', { class: 'setting' },
          h('p', { class: 'setting-help' }, `«${book.title}» har egen hastighet: ${book.wpm} ord/min.`),
          h('button', {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              await book.resetSpeed();
              reopen({ book: { ...book, wpm: null } });
            },
          }, 'Bruk standardhastighet for denne boka'))
        : null,
      segmented({ label: 'Start og stopp', value: s.readingMode, options: READING_MODES,
        help: 'Trykk: trykk på ordet for å starte og stoppe. Hold inne: lesingen går bare mens du holder ' +
          'fingeren på skjermen, og et kort trykk viser menyen. Sveip til siden for å spole i begge.',
        onChange: (readingMode) => updateSettings({ readingMode }) }),
      toggle({ label: 'Vis ordene før og etter', checked: s.phantomWords,
        help: 'Forrige og neste ord vises svakt på hver side.',
        onChange: (phantomWords) => updateSettings({ phantomWords }) }),
      toggle({ label: 'Del lange ord', checked: s.splitLongWords,
        help: 'Lange sammensatte ord vises i deler, for eksempel «sykehus-» «parkerings-» «plassen». Delene ' +
          'følger orddelingsreglene og ord som finnes i boka.',
        onChange: (splitLongWords) => updateSettings({ splitLongWords }) }),
      range({ label: 'Del ord lengre enn', min: SPLIT_MIN, max: SPLIT_MAX, step: 1, value: s.splitLength,
        format: (v) => `${v} bokstaver`,
        onInput: (splitLength) => updateSettings({ splitLength }) }),
      toggle({ label: 'Vis avsnittet ved pause', checked: s.showContext,
        help: 'Trykk på et ord i avsnittet for å hoppe dit.',
        onChange: (showContext) => updateSettings({ showContext }) }),
      toggle({ label: 'Hjelpelinjer', checked: s.guides, onChange: (guides) => updateSettings({ guides }) }),
      segmented({ label: 'Fokusbokstav', value: s.focusColor,
        options: Object.fromEntries(Object.entries(FOCUS_COLORS).map(([k, v]) => [k, v.label])),
        onChange: (focusColor) => updateSettings({ focusColor }) }),
      range({ label: 'Fokusposisjon', min: 25, max: 50, step: 1, value: s.anchor, format: (v) => `${v} %`,
        help: 'Hvor på skjermen fokusbokstaven står, målt fra venstre.',
        onInput: (anchor) => updateSettings({ anchor }) })),
    pacingSection(),
    h('section', null,
      h('h3', null, 'Utseende'),
      segmented({ label: 'Tema', value: s.theme, options: THEMES, onChange: (theme) => updateSettings({ theme }) }),
      segmented({ label: 'Skrift', value: s.font,
        options: Object.fromEntries(Object.entries(FONTS).map(([k, v]) => [k, v.label])),
        onChange: (font) => updateSettings({ font }) }),
      range({ label: 'Skriftstørrelse', min: 24, max: 96, step: 2, value: s.fontSize, format: (v) => `${v} px`,
        onInput: (fontSize) => updateSettings({ fontSize }) })),
    backupSection({ canRestore, onRestored: reopen }),
    h('section', { class: 'about' },
      h('h3', null, 'Om'),
      h('p', null, status),
      h('p', null, `Versjon ${VERSION}.`),
      h('p', null, 'Tempo- og fokusreglene bygger på ',
        h('a', { href: 'https://github.com/ionutdecebal/rsvpnano', target: '_blank', rel: 'noopener' }, 'RSVP Nano'),
        ' (MIT). PDF-støtte med pdf.js (Apache 2.0), EPUB-utpakking med fflate (MIT). Orddeling med ' +
        'TeX-mønstrene fra hyph-utf8 av Rune Kleveland og Ole Michael Selberg (norsk) og Gerard D.C. Kuiken (engelsk).'),
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          updateSettings({ ...DEFAULT_SETTINGS, pacing: { ...DEFAULT_PACING } });
          reopen();
        },
      }, 'Tilbakestill alle innstillinger')));

  const close = openSheet('Innstillinger', body);
  return close;
}
