// Plain text and Markdown. Paragraphs are separated by blank lines; files
// without blank lines get one paragraph per line. Project Gutenberg headers
// and licence footers are removed.

import { normalizeText } from '../text/normalize.js';
import { chaptersFromParagraphs, isChapterHeading, joinLines, titleFromFilename } from './structure.js';

const GUTENBERG_START = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;
const GUTENBERG_END = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*$/im;

function stripGutenberg(text) {
  const start = GUTENBERG_START.exec(text);
  if (!start) return { body: text, header: '' };
  const header = text.slice(0, start.index);
  let body = text.slice(start.index + start[0].length);
  const end = GUTENBERG_END.exec(body);
  if (end) body = body.slice(0, end.index);
  return { body, header };
}

const headerField = (header, name) => new RegExp(`^${name}:\\s*(.+)$`, 'im').exec(header)?.[1].trim() || '';

function stripMarkdown(line) {
  return line
    .replace(/^\s{0,3}>\s?/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\p{L}\p{N}])([*_])([^*_]+?)\2(?=$|[^\p{L}\p{N}])/gu, '$1$3')
    .replace(/`([^`]+)`/g, '$1');
}

export function parseText(text, { filename = '', markdown = false } = {}) {
  const { body, header } = stripGutenberg(text.replace(/\r\n?/g, '\n'));
  const lines = body.split('\n');
  const blankLines = lines.filter((line) => line.trim() === '').length;
  const onePerLine = lines.length > 20 && blankLines < lines.length / 20;

  const blocks = [];
  let block = [];
  const flush = () => {
    if (block.length) blocks.push(block);
    block = [];
  };
  for (const line of lines) {
    if (line.trim() === '') flush();
    else if (onePerLine || (markdown && /^\s{0,3}#{1,6}\s/.test(line))) {
      flush();
      blocks.push([line]);
    } else block.push(line);
  }
  flush();

  const paragraphs = [];
  const headings = [];
  let title = headerField(header, 'Title');
  for (const blockLines of blocks) {
    const heading = markdown ? /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(blockLines[0]) : null;
    const source = heading ? [heading[2]] : blockLines;
    const paragraph = normalizeText(joinLines(markdown ? source.map(stripMarkdown) : source));
    if (!paragraph) continue;
    const isHeading = heading ? heading[1].length <= 2 : (blockLines.length === 1 && isChapterHeading(paragraph));
    if (heading && heading[1].length === 1 && !title) title = paragraph;
    headings.push(isHeading ? paragraph : null);
    paragraphs.push(paragraph);
  }

  title = title || titleFromFilename(filename);
  const chapters = chaptersFromParagraphs(paragraphs, (i) => headings[i], title);
  return { title, author: headerField(header, 'Author'), chapters };
}
