// Hyphenation points with Liang's algorithm, the one TeX uses, and the
// hyph-utf8 patterns in app/vendor/hyphenation (Norwegian patterns serve both
// bokmål and nynorsk).

// Returns a function giving the allowed break positions in a word: an index
// i means a break is allowed between word[i - 1] and word[i].
export function createHyphenator({ patterns, exceptions = '', leftMin = 2, rightMin = 2 }) {
  const table = new Map();
  let longest = 0;
  for (const pattern of patterns.split(' ')) {
    if (!pattern) continue;
    const letters = pattern.replace(/\d/g, '');
    const values = new Array(letters.length + 1).fill(0);
    let position = 0;
    for (const ch of pattern) {
      if (ch >= '0' && ch <= '9') values[position] = Number(ch);
      else position++;
    }
    table.set(letters, values);
    longest = Math.max(longest, letters.length);
  }

  const known = new Map();
  for (const word of exceptions.split(' ')) {
    if (!word) continue;
    const points = [];
    let length = 0;
    for (const ch of word) {
      if (ch === '-') points.push(length);
      else length++;
    }
    known.set(word.replace(/-/g, '').toLowerCase(), points);
  }

  return (word) => {
    const lower = word.toLowerCase();
    if (known.has(lower)) return known.get(lower);
    const text = `.${lower}.`;
    const values = new Array(text.length + 1).fill(0);
    for (let start = 0; start < text.length; start++) {
      for (let end = start + 1; end <= Math.min(text.length, start + longest); end++) {
        const match = table.get(text.slice(start, end));
        if (!match) continue;
        for (let k = 0; k < match.length; k++) {
          if (match[k] > values[start + k]) values[start + k] = match[k];
        }
      }
    }
    const points = [];
    // values[i + 1] is the value between lower[i - 1] and lower[i] (the leading dot shifts it).
    for (let i = leftMin; i <= lower.length - rightMin; i++) {
      if (values[i + 1] % 2 === 1) points.push(i);
    }
    return points;
  };
}

const loaders = {
  nb: () => import('../../vendor/hyphenation/no.js').then((m) => ({ ...m.default, exceptions: m.default.exceptions.nb })),
  nn: () => import('../../vendor/hyphenation/no.js').then((m) => ({ ...m.default, exceptions: m.default.exceptions.nn })),
  en: () => import('../../vendor/hyphenation/en.js').then((m) => ({ ...m.default, exceptions: m.default.exceptions.en })),
};
const cache = new Map();

export function loadHyphenator(lang) {
  const key = loaders[lang] ? lang : 'nb';
  if (!cache.has(key)) cache.set(key, loaders[key]().then(createHyphenator));
  return cache.get(key);
}
