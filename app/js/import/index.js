// Chooses the importer by file content and extension, and finishes the book
// record (language, word count, id).

import { DEFAULT_LANGUAGE, detectLanguage } from '../text/language.js';
import { tokenizeParagraph } from '../text/tokenize.js';
import { decodeBytes } from './decode.js';
import { ImportError, parseEpub } from './epub.js';
import { extractBlocks } from './html.js';
import { parsePdf } from './pdf.js';
import { chaptersFromParagraphs, titleFromFilename } from './structure.js';
import { parseText } from './txt.js';

export { ImportError };

export const ACCEPTED_FILES = '.epub,.pdf,.txt,.text,.md,.markdown,.html,.htm,.xhtml,' +
  'application/epub+zip,application/pdf,text/plain,text/markdown,text/html';

let pdfjsPromise = null;

// pdf.js is large, so it is only loaded when a PDF is imported.
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../../vendor/pdfjs/pdf.min.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

const extension = (name) => (/\.([^.]+)$/.exec(name)?.[1] || '').toLowerCase();

function parseHtml(bytes, filename, DOMParserImpl) {
  const doc = new DOMParserImpl().parseFromString(decodeBytes(bytes), 'text/html');
  const title = (doc.querySelector('title')?.textContent || '').trim() || titleFromFilename(filename);
  const blocks = extractBlocks(doc.body || doc.documentElement).filter((b) => b.type === 'p');
  const paragraphs = blocks.map((b) => b.text);
  const chapters = chaptersFromParagraphs(paragraphs, (i) => (blocks[i].heading && blocks[i].heading <= 2
    ? blocks[i].text : null), title);
  return { title, author: '', chapters, declaredLang: null };
}

export async function parseBook(bytes, filename, { DOMParserImpl = globalThis.DOMParser, pdfjs, onProgress } = {}) {
  const ext = extension(filename);
  const magic = String.fromCharCode(...bytes.subarray(0, 5));
  let parsed;
  if (magic.startsWith('PK')) {
    parsed = await parseEpub(bytes, { filename, DOMParserImpl });
  } else if (magic === '%PDF-') {
    parsed = await parsePdf(bytes, { filename, pdfjs: pdfjs || await loadPdfjs(), onProgress });
  } else if (['html', 'htm', 'xhtml'].includes(ext)) {
    parsed = parseHtml(bytes, filename, DOMParserImpl);
  } else if (['mobi', 'azw', 'azw3', 'kfx'].includes(ext)) {
    throw new ImportError('Kindle-formater støttes ikke. Last ned boka som EPUB i stedet.');
  } else if (['txt', 'text', 'md', 'markdown'].includes(ext) || !bytes.subarray(0, 4096).includes(0)) {
    parsed = parseText(decodeBytes(bytes), { filename, markdown: ext === 'md' || ext === 'markdown' });
  } else {
    throw new ImportError('Ukjent filformat. Bruk EPUB, PDF eller tekstfil.');
  }
  if (!parsed || parsed.chapters.length === 0) throw new ImportError('Fant ingen lesbar tekst i filen.');

  const sample = parsed.chapters.flatMap((c) => c.paragraphs).slice(0, 400).join(' ');
  const lang = parsed.declaredLang || detectLanguage(sample, DEFAULT_LANGUAGE);
  const wordCount = parsed.chapters.reduce((sum, chapter) =>
    sum + chapter.paragraphs.reduce((n, paragraph) => n + tokenizeParagraph(paragraph).length, 0), 0);
  if (wordCount === 0) throw new ImportError('Fant ingen lesbar tekst i filen.');

  return {
    title: parsed.title,
    author: parsed.author || '',
    lang,
    format: magic.startsWith('PK') ? 'epub' : magic === '%PDF-' ? 'pdf' : ext || 'txt',
    wordCount,
    chapters: parsed.chapters,
  };
}

export async function bookId(bytes) {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest).subarray(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
