// PDF with a text layer, via pdf.js. There is no OCR: scanned books without
// text are rejected. Lines are rebuilt into paragraphs from their positions,
// words broken at line ends are rejoined, and page numbers and running
// headers are dropped. Chapters come from the PDF outline when present.

import { ImportError } from './epub.js';
import { normalizeText } from '../text/normalize.js';
import { chaptersFromParagraphs, isChapterHeading, joinLines, titleFromFilename } from './structure.js';

const PAGE_NUMBER = /^[-–—\s]*(?:\d{1,4}|[ivxlcdm]{1,6})[-–—\s]*$/i;
const ENDS_SENTENCE = /[.!?:»"”…)]$/;

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Groups text items into visual lines in content-stream order.
function pageLines(items) {
  const lines = [];
  let line = null;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const [, , c, d, x, y] = item.transform;
    const size = Math.hypot(c, d) || item.height || 10;
    if (!line || Math.abs(y - line.y) > size * 0.5) {
      if (item.str.trim() === '' && !line) continue;
      line = { x, y, size, right: x, text: '' };
      lines.push(line);
    } else if (x - line.right > size * 0.2 && !/\s$/.test(line.text) && !/^\s/.test(item.str)) {
      line.text += ' ';
    }
    line.text += item.str;
    line.right = Math.max(line.right, x + (item.width || 0));
    line.size = Math.max(line.size, size);
    if (item.hasEOL) line = null;
  }
  return lines.filter((l) => l.text.trim() !== '');
}

// Splits one page's lines into paragraphs using line spacing, first-line
// indentation and short closing lines.
function pageParagraphs(lines) {
  if (lines.length === 0) return [];
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y;
    if (gap > 0 && gap < lines[i].size * 3) gaps.push(gap);
  }
  const lineGap = median(gaps) || lines[0].size * 1.2;
  const left = median(lines.map((l) => l.x));
  const right = Math.max(...lines.map((l) => l.right));

  const paragraphs = [];
  let current = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const previous = lines[i - 1];
    const line = lines[i];
    const gap = previous.y - line.y;
    const indented = line.x - left > line.size * 0.8 && line.x - left < (right - left) * 0.3;
    const shortEnding = previous.right < right - previous.size * 4 && ENDS_SENTENCE.test(previous.text.trim());
    if (gap <= 0 || gap > lineGap * 1.45 || indented || shortEnding) {
      paragraphs.push(current);
      current = [];
    }
    current.push(line);
  }
  paragraphs.push(current);
  return paragraphs.map((group) => joinLines(group.map((l) => l.text)));
}

// The two topmost and two bottommost lines of a page, by position. Headers and
// footers are often last in the content stream even when drawn at the top.
function edgeLines(lines) {
  const byHeight = [...lines].sort((a, b) => b.y - a.y);
  return new Set([...byHeight.slice(0, 2), ...byHeight.slice(-2)]);
}

const edgeKey = (text) => text.trim().replace(/\d+/g, '#').toLowerCase();

// Edge lines repeated on many pages (running headers/footers).
function repeatedEdgeKeys(pages) {
  if (pages.length < 2) return new Set();
  const counts = new Map();
  for (const lines of pages) {
    for (const key of new Set([...edgeLines(lines)].map((l) => edgeKey(l.text)))) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.3));
  return new Set([...counts].filter(([, n]) => n >= threshold).map(([key]) => key));
}

async function outlinePages(pdf) {
  const outline = await pdf.getOutline().catch(() => null);
  if (!outline) return [];
  const flat = [];
  const visit = (items, depth) => {
    for (const item of items) {
      flat.push(item);
      if (depth < 1 && item.items?.length) visit(item.items, depth + 1);
    }
  };
  visit(outline, 0);
  const entries = [];
  for (const item of flat) {
    try {
      const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
      if (!Array.isArray(dest)) continue;
      const pageIndex = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
      const title = normalizeText(item.title || '');
      if (title) entries.push({ title, pageIndex });
    } catch {
      // skip entries with broken destinations
    }
  }
  return entries.sort((a, b) => a.pageIndex - b.pageIndex);
}

const usefulTitle = (title) => title && !/^(untitled|microsoft word|document\d*)\b/i.test(title) && !/\.(docx?|pdf)$/i.test(title);

export async function parsePdf(bytes, { filename = '', pdfjs, onProgress } = {}) {
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    if (error?.name === 'PasswordException') throw new ImportError('pdfPassword');
    throw new ImportError('pdfUnreadable');
  }

  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(pageLines(content.items));
    page.cleanup();
    onProgress?.(p / pdf.numPages);
  }

  const repeated = repeatedEdgeKeys(pages);
  // Chapter numbers set larger than the body text are not page numbers.
  const bodySize = median(pages.flat().map((line) => line.size));
  const isPageNumber = (line) => PAGE_NUMBER.test(line.text) && line.size <= bodySize * 1.1;
  const paragraphs = [];
  const paragraphPages = [];
  pages.forEach((lines, pageIndex) => {
    const edges = edgeLines(lines);
    const kept = lines.filter((line) =>
      !(edges.has(line) && (isPageNumber(line) || repeated.has(edgeKey(line.text)))));
    pageParagraphs(kept).forEach((raw, i) => {
      const text = normalizeText(raw);
      if (!/[\p{L}\p{N}]/u.test(text)) return;
      const previous = paragraphs[paragraphs.length - 1];
      // A paragraph continued from the previous page.
      if (i === 0 && previous && !ENDS_SENTENCE.test(previous) && /^\p{Ll}/u.test(text)) {
        paragraphs[paragraphs.length - 1] = joinLines([previous, text]);
        return;
      }
      paragraphs.push(text);
      paragraphPages.push(pageIndex);
    });
  });
  if (paragraphs.length === 0) {
    throw new ImportError('pdfNoText');
  }

  const info = (await pdf.getMetadata().catch(() => null))?.info || {};
  const title = usefulTitle(normalizeText(info.Title || '')) ? normalizeText(info.Title) : titleFromFilename(filename);
  const author = normalizeText(info.Author || '');

  // Chapter starts from the outline: the paragraph on the target page whose
  // text matches the outline title, else the first paragraph on that page.
  const starts = new Map();
  for (const entry of await outlinePages(pdf)) {
    const onPage = paragraphPages.map((page, i) => [page, i]).filter(([page]) => page === entry.pageIndex);
    if (onPage.length === 0) continue;
    const wanted = entry.title.toLowerCase();
    const match = onPage.find(([, i]) => paragraphs[i].toLowerCase().startsWith(wanted));
    const index = match ? match[1] : onPage[0][1];
    if (!starts.has(index)) starts.set(index, entry.title);
  }
  const headingAt = starts.size > 0
    ? (i) => starts.get(i) || null
    : (i) => (isChapterHeading(paragraphs[i]) ? paragraphs[i] : null);

  await loadingTask.destroy();
  return { title, author, chapters: chaptersFromParagraphs(paragraphs, headingAt, title) };
}
