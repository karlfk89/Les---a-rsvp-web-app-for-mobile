// Helpers shared by the TXT and PDF importers: joining wrapped lines and
// recognising chapter headings in plain text.

import { t } from '../i18n.js';

// Joins wrapped lines of one paragraph. A hyphen at the end of a line is a
// word break («sam-» + «men» -> «sammen») when the next line starts in lower
// case; «EU-» + «land» keeps its hyphen.
export function joinLines(lines) {
  let text = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!text) {
      text = line;
    } else if (/\p{Ll}[-­‐]$/u.test(text) && /^\p{Ll}/u.test(line)) {
      text = text.slice(0, -1) + line;
    } else if (/[-‐]$/.test(text) && /^\p{L}/u.test(line)) {
      text += line;
    } else {
      text += ` ${line}`;
    }
  }
  return text;
}

const KEYWORD = '(?:kapittel|kapitel|kapitlet|chapter|del|part|bok|bog|book|akt|act|bolk|stykke|stykket|afsnit|avsnitt)';
const NUMBERISH = '(\\d{1,3}|[ivxlcdm]{1,7}|første|fyrste|andre|annen|anna|anden|andet|tredje|tredie|ottende|fjerde|femte|sjette|' +
  'sjuende|syvende|åttende|niende|tiende|ellevte|tolvte|one|two|three|four|five|six|seven|eight|nine|ten|' +
  'eleven|twelve|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|siste)';

const KEYWORD_FIRST = new RegExp(`^${KEYWORD}\\s+${NUMBERISH}(?!\\p{L})[.:]?(?:\\s.{0,60})?$`, 'iu');
const NUMBER_FIRST = new RegExp(`^${NUMBERISH}\\s+${KEYWORD}\\.?$`, 'iu');
const STANDALONE = [
  /^(?:prolog|prologue|epilog|epilogue|innledning|innleiing|forord|føreord|etterord|introduction|preface|foreword|afterword)\.?$/iu,
  /^[IVXLCDM]{1,7}\.?$/u,
  /^\d{1,3}\.?$/u,
];

// Lower-case roman numerals are ordinary words in prose: «Del i to.»
const isLowercaseRoman = (token) => /^[ivxlcdm]+$/.test(token);

// True for a short standalone line such as «Kapittel 3», «FØRSTE KAPITEL»,
// «III» or «Chapter 1: The Boy».
export function isChapterHeading(text) {
  const line = text.trim();
  if (line.length === 0 || line.length > 80) return false;
  const keywordFirst = KEYWORD_FIRST.exec(line);
  if (keywordFirst && !isLowercaseRoman(keywordFirst[1])) return true;
  const numberFirst = NUMBER_FIRST.exec(line);
  if (numberFirst && !isLowercaseRoman(numberFirst[1])) return true;
  return STANDALONE.some((pattern) => pattern.test(line));
}

// Groups paragraphs into chapters. `headingAt(i)` returns a title for
// paragraphs that start a new chapter, otherwise null.
export function chaptersFromParagraphs(paragraphs, headingAt, fallbackTitle) {
  const chapters = [];
  let current = null;
  paragraphs.forEach((paragraph, i) => {
    const title = headingAt(i);
    if (title || !current) {
      current = { title: title || fallbackTitle, paragraphs: [] };
      chapters.push(current);
    }
    current.paragraphs.push(paragraph);
  });
  return chapters;
}

export function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || t('book.untitled');
}
