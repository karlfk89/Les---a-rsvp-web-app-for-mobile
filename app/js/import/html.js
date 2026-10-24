// Extracts readable paragraphs from an (X)HTML document, following the
// rsvpnano conversion spec: skip head/nav/script/style/svg/math, treat block
// elements as paragraph boundaries and headings as chapter candidates.

import { normalizeText } from '../text/normalize.js';

const SKIP = new Set(['head', 'script', 'style', 'nav', 'svg', 'math', 'noscript', 'template', 'rt', 'rp', 'title',
  'button', 'select', 'textarea', 'iframe', 'object', 'video', 'audio', 'canvas']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'main', 'blockquote', 'li',
  'ul', 'ol', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
  'caption', 'pre', 'address', 'hr', 'center', 'body', 'html', 'details', 'summary', 'hgroup', 'form',
  'fieldset', 'legend', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

// Project Gutenberg wraps its licence header and footer in these sections.
const isBoilerplate = (node) => /\bpg-boilerplate\b/.test(node.getAttribute?.('class') || '') ||
  /^pg-(?:header|footer)$/.test(node.getAttribute?.('id') || '');

export const localName = (node) => (node.localName || node.nodeName || '').toLowerCase().replace(/^.*:/, '');

// Returns [{ type: 'p', text, heading }, { type: 'anchor', id }] in document
// order. `anchors` lists element ids that should be reported (TOC targets).
export function extractBlocks(root, anchors = new Set()) {
  const items = [];
  let buffer = '';
  let heading = 0;

  const flush = () => {
    const text = normalizeText(buffer);
    buffer = '';
    if (/[\p{L}\p{N}]/u.test(text)) items.push({ type: 'p', text, heading });
  };

  const walk = (node) => {
    if (node.nodeType === TEXT_NODE) {
      buffer += node.data ?? node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;
    const name = localName(node);
    if (SKIP.has(name) || isBoilerplate(node)) return;
    const id = node.getAttribute?.('id') || (name === 'a' ? node.getAttribute?.('name') : null);
    if (id && anchors.has(id)) {
      flush();
      items.push({ type: 'anchor', id });
    }
    if (name === 'br') {
      flush();
      return;
    }
    const block = BLOCK.has(name);
    const level = /^h[1-6]$/.test(name) ? Number(name[1]) : 0;
    if (block) flush();
    const outerHeading = heading;
    if (level) heading = level;
    for (let child = node.firstChild; child; child = child.nextSibling) walk(child);
    if (block) flush();
    heading = outerHeading;
  };

  walk(root);
  flush();
  return items;
}
