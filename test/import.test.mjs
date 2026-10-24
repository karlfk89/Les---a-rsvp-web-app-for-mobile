import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { DOMParser } from 'linkedom';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import { decodeBytes, repairMojibake } from '../app/js/import/decode.js';
import { ImportError, parseBook } from '../app/js/import/index.js';
import { isChapterHeading, joinLines } from '../app/js/import/structure.js';
import { buildIndex } from '../app/js/reader/book-index.js';
import { buildEpub } from './fixtures/build-epub.mjs';
import { BOKMAL_CHAPTERS, ENGLISH_TEXT, NYNORSK_TEXT, bokmalText } from './fixtures/samples.mjs';

const utf8 = (text) => new TextEncoder().encode(text);
const latin1 = (text) => Uint8Array.from(text, (ch) => ch.charCodeAt(0));
const parse = (bytes, filename) => parseBook(bytes, filename, { DOMParserImpl: DOMParser, pdfjs });

test('decodes UTF-8, BOMs, Windows-1252 and double-encoded UTF-8', () => {
  assert.equal(decodeBytes(utf8('blåbærsyltetøy')), 'blåbærsyltetøy');
  assert.equal(decodeBytes(new Uint8Array([0xEF, 0xBB, 0xBF, ...utf8('Ærlig')])), 'Ærlig');
  assert.equal(decodeBytes(latin1('Søt og grønn på Ås')), 'Søt og grønn på Ås');
  const utf16 = new Uint8Array([0xFF, 0xFE, ...Array.from('Øl', (ch) => [ch.charCodeAt(0), 0]).flat()]);
  assert.equal(decodeBytes(utf16), 'Øl');
  assert.equal(repairMojibake('BlÃ¥bÃ¦rsyltetÃ¸y og sÃ¸t grÃ¸t'), 'Blåbærsyltetøy og søt grøt');
  assert.equal(repairMojibake('Blåbær og Ã¸l'), 'Blåbær og Ã¸l');
});

test('chapter headings in plain text', () => {
  for (const heading of ['Kapittel 1', 'KAPITTEL II', 'FØRSTE STYKKE', 'Anden Bog', 'Første kapitel', 'Chapter 3: The Boy', 'III', '12', 'Prolog']) {
    assert.ok(isChapterHeading(heading), heading);
  }
  for (const prose of ['Del i to.', 'Det var en gang en gutt.', 'Kapitlene var lange og mange, og han leste dem alle i løpet av natta.']) {
    assert.ok(!isChapterHeading(prose), prose);
  }
});

test('wrapped lines are rejoined and broken words repaired', () => {
  assert.equal(joinLines(['Det var sam-', 'men om', 'EU-', 'landene.']), 'Det var sammen om EU-landene.');
});

test('Bokmål text file with chapters', async () => {
  const book = await parse(utf8(bokmalText()), 'flyturen.txt');
  assert.equal(book.title, 'flyturen');
  assert.equal(book.lang, 'nb');
  assert.deepEqual(book.chapters.map((c) => c.title), ['flyturen', 'Kapittel 1', 'Kapittel 2']);
  assert.equal(book.chapters[1].paragraphs[2], '– Skal du lese hele veien? spurte mannen i setet ved siden av.');
});

test('Nynorsk and English text files are detected', async () => {
  const nn = await parse(utf8(NYNORSK_TEXT), 'fjellturen.txt');
  assert.equal(nn.lang, 'nn');
  assert.deepEqual(nn.chapters.map((c) => c.title), ['fjellturen', 'Kapittel 1', 'Kapittel 2']);
  const en = await parse(utf8(ENGLISH_TEXT), 'window.txt');
  assert.equal(en.lang, 'en');
});

test('Windows-1252 text file keeps æøå', async () => {
  const book = await parse(latin1('Kapittel 1\n\nBlåbær og rømme på Ørland.\n'), 'gammel.txt');
  assert.equal(book.chapters[0].paragraphs[1], 'Blåbær og rømme på Ørland.');
});

test('Project Gutenberg boilerplate is removed', async () => {
  const text = `The Project Gutenberg eBook of Sult\nTitle: Sult\nAuthor: Knut Hamsun\n\n*** START OF THE PROJECT GUTENBERG EBOOK SULT ***\n\nI\n\nDet var i den tid jeg gik omkring og sulted i Kristiania.\n\n*** END OF THE PROJECT GUTENBERG EBOOK SULT ***\n\nLicence text that must not be read.`;
  const book = await parse(utf8(text), 'pg.txt');
  assert.equal(book.title, 'Sult');
  assert.equal(book.author, 'Knut Hamsun');
  const all = book.chapters.flatMap((c) => c.paragraphs).join(' ');
  assert.ok(!all.includes('Licence'));
  assert.deepEqual(book.chapters.map((c) => c.title), ['I']);
});

test('Markdown headings become chapters', async () => {
  const book = await parse(utf8('# Flyturen\n\n## Avgang\n\nHun leste **mye** og _fort_.\n\n## Landing\n\nFerdig.'), 'a.md');
  assert.equal(book.title, 'Flyturen');
  assert.deepEqual(book.chapters.map((c) => c.title), ['Flyturen', 'Avgang', 'Landing']);
  assert.equal(book.chapters[1].paragraphs[1], 'Hun leste mye og fort.');
});

for (const version of [2, 3]) {
  test(`EPUB ${version} with table of contents`, async () => {
    const bytes = buildEpub({ title: 'Flyturen', author: 'Testforfatter', lang: 'nb-NO', chapters: BOKMAL_CHAPTERS, version });
    const book = await parse(bytes, 'flyturen.epub');
    assert.equal(book.title, 'Flyturen');
    assert.equal(book.author, 'Testforfatter');
    assert.equal(book.lang, 'nb');
    assert.equal(book.format, 'epub');
    assert.deepEqual(book.chapters.map((c) => c.title), ['Kapittel 1', 'Kapittel 2']);
    assert.equal(book.chapters[0].paragraphs[0], 'Kapittel 1');
    assert.equal(book.chapters[1].paragraphs[2], BOKMAL_CHAPTERS[1].paragraphs[1]);
  });
}

test('EPUB language tag nn and en', async () => {
  const nn = await parse(buildEpub({ title: 'T', lang: 'nn', chapters: BOKMAL_CHAPTERS }), 'x.epub');
  assert.equal(nn.lang, 'nn');
});

test('EPUB with DRM is rejected, font obfuscation is allowed', async () => {
  const drm = `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
<enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/>
<enc:CipherData><enc:CipherReference URI="OEBPS/text/kapittel 1.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>`;
  await assert.rejects(parse(buildEpub({ title: 'T', chapters: BOKMAL_CHAPTERS, encryption: drm }), 'drm.epub'),
    (error) => error instanceof ImportError && error.code === 'drm');
  const fonts = `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
<enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/>
<enc:CipherData><enc:CipherReference URI="OEBPS/fonts/a.otf"/></enc:CipherData></enc:EncryptedData></encryption>`;
  const book = await parse(buildEpub({ title: 'T', chapters: BOKMAL_CHAPTERS, encryption: fonts }), 'fonts.epub');
  assert.equal(book.chapters.length, 2);
});

test('PDF with outline, running header and page numbers', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/flyturen.pdf', import.meta.url)));
  const book = await parse(bytes, 'flyturen.pdf');
  assert.equal(book.format, 'pdf');
  assert.equal(book.lang, 'nb');
  assert.deepEqual(book.chapters.map((c) => c.title), ['Kapittel 1', 'Kapittel 2']);
  const paragraphs = book.chapters.flatMap((c) => c.paragraphs);
  assert.ok(!paragraphs.includes('Flyturen'), 'running header removed');
  assert.ok(!paragraphs.some((p) => /^\d+$/.test(p)), 'page numbers removed');
  assert.ok(paragraphs.includes(BOKMAL_CHAPTERS[0].paragraphs[0]), paragraphs.join('\n'));
  assert.ok(paragraphs.includes(BOKMAL_CHAPTERS[1].paragraphs[1]), paragraphs.join('\n'));
  assert.ok(paragraphs.some((p) => p.includes('klappet for kapteinen som')), 'soft hyphen line break rejoined');
});

test('book index exposes words, paragraphs and chapters', async () => {
  const book = await parse(utf8(bokmalText()), 'flyturen.txt');
  const index = buildIndex(book);
  assert.equal(index.words.length, book.wordCount);
  assert.equal(index.chapters.length, 3);
  assert.equal(index.words[index.chapters[1].start], 'Kapittel');
  assert.ok(index.words.includes('1 500'));
});

test('unsupported formats give a clear message', async () => {
  await assert.rejects(parse(new Uint8Array([1, 2, 0, 0, 5]), 'bok.mobi'), { code: 'kindle' });
  await assert.rejects(parse(new Uint8Array([1, 2, 0, 0, 5]), 'bok.bin'), { code: 'unknownFormat' });
});
