// Interface language. English is the default and Norwegian Bokmål can be
// chosen in the settings. The language of each book is separate and decides
// the pacing rules (see text/language.js).

import en from './locales/en.js';
import nb from './locales/nb.js';

// Each language is named in itself, so it can be found whatever is shown.
export const UI_LANGUAGES = { en: 'English', nb: 'Norsk' };
export const DEFAULT_UI_LANGUAGE = 'en';

const DICTIONARIES = { en, nb };
let locale = DEFAULT_UI_LANGUAGE;

export function setLocale(code) {
  locale = Object.prototype.hasOwnProperty.call(DICTIONARIES, code) ? code : DEFAULT_UI_LANGUAGE;
}

export const getLocale = () => locale;

// Locale for dates and numbers. English follows the device's own variant
// when it has one, so a British phone gets British dates.
export function intlLocale() {
  if (locale === 'nb') return 'nb-NO';
  const device = globalThis.navigator?.language || '';
  return /^en(-|$)/i.test(device) ? device : 'en';
}

// The text for `key`. Entries with parameters are functions of `params`.
// Missing entries fall back to English, then to the key itself.
export function t(key, params) {
  const entry = DICTIONARIES[locale][key] ?? en[key];
  if (entry === undefined) return key;
  return typeof entry === 'function' ? entry(params) : entry;
}
