// Supported reading languages: Norwegian Bokmål (nb), Norwegian Nynorsk (nn)
// and English (en). The language decides abbreviation lists and the syllable
// estimate used for pacing.

export const LANGUAGES = {
  nb: { code: 'nb', name: 'Bokmål', short: 'BM' },
  nn: { code: 'nn', name: 'Nynorsk', short: 'NN' },
  en: { code: 'en', name: 'Engelsk', short: 'EN' },
};

export const DEFAULT_LANGUAGE = 'nb';

// Maps BCP 47 / ISO 639 tags to a supported language, or null when unknown.
export function normalizeLang(tag) {
  if (!tag) return null;
  const primary = String(tag).trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  switch (primary) {
    case 'nb':
    case 'nob':
    case 'no':
    case 'nor':
      return 'nb';
    case 'nn':
    case 'nno':
      return 'nn';
    case 'en':
    case 'eng':
      return 'en';
    default:
      return null;
  }
}

// Common function words. Shared Norwegian words count for both nb and nn,
// distinctive ones only for their written standard.
const SHARED_NO = ['og', 'i', 'på', 'til', 'som', 'er', 'det', 'med', 'av', 'for', 'han', 'seg', 'var', 'om',
  'men', 'så', 'har', 'da', 'skal', 'kan', 'der', 'ut', 'opp', 'når', 'etter', 'over', 'også', 'mot'];
const NB_ONLY = ['ikke', 'jeg', 'hun', 'de', 'dem', 'hva', 'hvor', 'hvordan', 'hvem', 'noe', 'noen', 'bare',
  'mye', 'fra', 'en', 'et', 'meg', 'deg', 'selv', 'hele', 'være', 'vært', 'blir', 'kunne', 'mange', 'hvis',
  'derfor', 'nå', 'sin', 'sitt', 'sine', 'også', 'enn', 'hjem', 'aldri'];
const NN_ONLY = ['ikkje', 'eg', 'ho', 'dei', 'kva', 'kor', 'korleis', 'kven', 'noko', 'nokon', 'berre', 'mykje',
  'frå', 'ein', 'eit', 'meg', 'deg', 'sjølv', 'heile', 'vere', 'vore', 'blir', 'kunne', 'mange', 'dersom',
  'difor', 'no', 'sin', 'sitt', 'sine', 'òg', 'enn', 'heim', 'aldri', 'ikkje', 'vart', 'medan', 'mellom', 'fekk'];
const EN = ['the', 'and', 'of', 'to', 'a', 'in', 'is', 'was', 'that', 'he', 'she', 'it', 'with', 'his', 'her',
  'for', 'as', 'had', 'you', 'not', 'be', 'at', 'on', 'they', 'but', 'have', 'this', 'which', 'from', 'were',
  'would', 'said', 'there', 'what', 'been', 'their', 'could', 'when', 'into', 'him'];

const lists = {
  nb: new Set([...SHARED_NO, ...NB_ONLY]),
  nn: new Set([...SHARED_NO, ...NN_ONLY]),
  en: new Set(EN),
};

// Guesses the language from a text sample by counting function words.
export function detectLanguage(text, fallback = DEFAULT_LANGUAGE) {
  const words = (text.slice(0, 200_000).toLowerCase().match(/[\p{L}]+/gu) || []).slice(0, 20_000);
  if (words.length === 0) return fallback;
  const score = { nb: 0, nn: 0, en: 0 };
  for (const word of words) {
    for (const lang of Object.keys(score)) if (lists[lang].has(word)) score[lang]++;
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  if (best[1] < Math.max(3, words.length * 0.05)) return fallback;
  return best[0];
}
