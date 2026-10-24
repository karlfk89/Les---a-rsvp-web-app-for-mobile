// EPUB 2 and 3, following the rsvpnano conversion spec: container.xml -> OPF,
// spine reading order, NCX or nav document for chapters. Books with DRM are
// rejected; font obfuscation (common in free EPUBs) is allowed.

import { unzipSync } from '../../vendor/fflate.js';
import { normalizeLang } from '../text/language.js';
import { normalizeText } from '../text/normalize.js';
import { decodeBytes } from './decode.js';
import { extractBlocks, localName } from './html.js';
import { titleFromFilename } from './structure.js';

export class ImportError extends Error {}

const FONT_OBFUSCATION = new Set(['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC']);
const NON_CONTENT_TITLES = new Set(['cover', 'omslag', 'forside', 'title page', 'titlepage', 'tittelside', 'tittel',
  'contents', 'table of contents', 'toc', 'innhold', 'innholdsfortegnelse', 'innhaldsliste', 'copyright',
  'kolofon', 'colophon', 'halvtittel', 'half title', 'half-title']);

// Elements by local name, ignoring namespace prefixes and case (dc:title, navPoint).
function elements(root, name) {
  const target = name.toLowerCase();
  const found = [];
  const visit = (node) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1) continue;
      if (localName(child) === target) found.push(child);
      visit(child);
    }
  };
  visit(root);
  return found;
}

const first = (root, name) => elements(root, name)[0] || null;
const textOf = (node) => normalizeText(node?.textContent || '');

function resolvePath(base, href) {
  const [path] = href.split('#');
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // keep the raw path
  }
  const parts = (decoded.startsWith('/') ? decoded.slice(1) : base + decoded).split('/');
  const resolved = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.' && part !== '') resolved.push(part);
  }
  return resolved.join('/');
}

function fragmentOf(href) {
  const hash = href.indexOf('#');
  if (hash < 0) return '';
  try {
    return decodeURIComponent(href.slice(hash + 1));
  } catch {
    return href.slice(hash + 1);
  }
}

const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');

export async function parseEpub(bytes, { filename = '', DOMParserImpl = globalThis.DOMParser } = {}) {
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ImportError('Filen er ikke en gyldig EPUB (kunne ikke pakkes ut).');
  }
  const lowerCaseIndex = new Map(Object.keys(files).map((name) => [name.toLowerCase(), name]));
  const file = (path) => files[path] || files[lowerCaseIndex.get(path.toLowerCase())] || null;
  const parser = new DOMParserImpl();
  const parseXml = (data) => parser.parseFromString(decodeBytes(data), 'application/xml');
  const parseXhtml = (data) => {
    const text = decodeBytes(data);
    const doc = parser.parseFromString(text, 'application/xhtml+xml');
    const failed = !doc.documentElement || elements(doc, 'parsererror').length > 0;
    return failed ? parser.parseFromString(text, 'text/html') : doc;
  };

  rejectDrm(file, parseXml);

  const container = file('META-INF/container.xml');
  if (!container) throw new ImportError('EPUB-en mangler META-INF/container.xml.');
  const opfPath = first(parseXml(container), 'rootfile')?.getAttribute('full-path');
  const opfData = opfPath && file(opfPath);
  if (!opfData) throw new ImportError('Fant ikke pakkefilen (OPF) i EPUB-en.');
  const opf = parseXml(opfData);
  const opfDir = dirOf(opfPath);

  const metadata = first(opf, 'metadata') || opf;
  const title = textOf(first(metadata, 'title')) || titleFromFilename(filename);
  const author = elements(metadata, 'creator').map(textOf).filter(Boolean).join(', ');
  const declaredLang = normalizeLang(textOf(first(metadata, 'language')));

  const manifest = new Map();
  for (const item of elements(first(opf, 'manifest') || opf, 'item')) {
    manifest.set(item.getAttribute('id'), {
      path: resolvePath(opfDir, item.getAttribute('href') || ''),
      mediaType: item.getAttribute('media-type') || '',
      properties: item.getAttribute('properties') || '',
    });
  }
  const spineElement = first(opf, 'spine');
  const isContent = (item) => /html/.test(item.mediaType) || /\.x?html?$/i.test(item.path);
  let spine = elements(spineElement || opf, 'itemref')
    .filter((ref) => ref.getAttribute('linear') !== 'no')
    .map((ref) => manifest.get(ref.getAttribute('idref')))
    .filter((item) => item && isContent(item));
  if (spine.length === 0) spine = [...manifest.values()].filter(isContent);

  const epub3 = (first(opf, 'package')?.getAttribute('version') || opf.documentElement?.getAttribute('version') || '')
    .startsWith('3');
  const readNav = () => {
    const item = [...manifest.values()].find((entry) => entry.properties.split(/\s+/).includes('nav'));
    const data = item && file(item.path);
    return data ? tocFromNav(parseXhtml(data), dirOf(item.path)) : [];
  };
  const readNcx = () => {
    const tocId = spineElement?.getAttribute('toc');
    const item = (tocId && manifest.get(tocId)) ||
      [...manifest.values()].find((entry) => entry.mediaType === 'application/x-dtbncx+xml');
    const data = item && file(item.path);
    return data ? tocFromNcx(parseXml(data), dirOf(item.path)) : [];
  };
  let toc = epub3 ? readNav() : readNcx();
  if (toc.length === 0) toc = epub3 ? readNcx() : readNav();
  toc = toc.filter((entry) => entry.title && !NON_CONTENT_TITLES.has(entry.title.toLowerCase()) &&
    entry.title.toLowerCase() !== title.toLowerCase());

  const tocByFile = new Map();
  for (const entry of toc) {
    if (!tocByFile.has(entry.path)) tocByFile.set(entry.path, []);
    tocByFile.get(entry.path).push(entry);
  }

  const chapters = [];
  let current = null;
  const startChapter = (chapterTitle) => {
    if (current && current.paragraphs.length === 0) current.title = chapterTitle;
    else {
      current = { title: chapterTitle, paragraphs: [] };
      chapters.push(current);
    }
  };

  for (const item of spine) {
    const data = file(item.path);
    if (!data) continue;
    const doc = parseXhtml(data);
    const entries = tocByFile.get(item.path) || [];
    const anchors = new Map(entries.filter((entry) => entry.fragment).map((entry) => [entry.fragment, entry]));
    const atStart = entries.find((entry) => !entry.fragment);
    if (atStart) startChapter(atStart.title);
    const root = first(doc, 'body') || doc.documentElement;
    for (const block of extractBlocks(root, new Set(anchors.keys()))) {
      if (block.type === 'anchor') {
        startChapter(anchors.get(block.id).title);
        continue;
      }
      if (toc.length === 0 && block.heading && block.heading <= 2) startChapter(block.text);
      if (!current) startChapter(title);
      current.paragraphs.push(block.text);
    }
  }

  const nonEmpty = chapters.filter((chapter) => chapter.paragraphs.length > 0);
  if (nonEmpty.length === 0) throw new ImportError('Fant ingen lesbar tekst i EPUB-en.');
  return { title, author, declaredLang, chapters: nonEmpty };
}

function rejectDrm(file, parseXml) {
  if (file('META-INF/rights.xml') || file('META-INF/sinf.xml')) {
    throw new ImportError('Boka er DRM-beskyttet og kan ikke åpnes.');
  }
  const encryption = file('META-INF/encryption.xml');
  if (!encryption) return;
  for (const data of elements(parseXml(encryption), 'EncryptedData')) {
    const algorithm = first(data, 'EncryptionMethod')?.getAttribute('Algorithm') || '';
    const uri = first(data, 'CipherReference')?.getAttribute('URI') || '';
    if (!FONT_OBFUSCATION.has(algorithm) || !/\.(?:ttf|otf|woff2?)$/i.test(uri)) {
      throw new ImportError('Boka er DRM-beskyttet og kan ikke åpnes.');
    }
  }
}

function tocFromNav(doc, baseDir) {
  const navs = elements(doc, 'nav');
  const isToc = (nav) => /(^|\s)toc(\s|$)/.test(nav.getAttribute('epub:type') || '') ||
    nav.getAttribute('role') === 'doc-toc';
  const nav = navs.find(isToc) || navs[0];
  if (!nav) return [];
  return elements(nav, 'a')
    .filter((link) => link.getAttribute('href'))
    .map((link) => {
      const href = link.getAttribute('href');
      return { title: textOf(link), path: resolvePath(baseDir, href), fragment: fragmentOf(href) };
    });
}

function tocFromNcx(doc, baseDir) {
  return elements(doc, 'navPoint')
    .map((point) => {
      const label = first(point, 'navLabel');
      const src = first(point, 'content')?.getAttribute('src');
      if (!src) return null;
      return { title: textOf(first(label || point, 'text')), path: resolvePath(baseDir, src), fragment: fragmentOf(src) };
    })
    .filter(Boolean);
}
