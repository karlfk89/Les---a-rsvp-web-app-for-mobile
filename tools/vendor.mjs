// Copies third-party browser bundles from node_modules into app/vendor so the
// app can be served as static files without a build step or CDN at runtime.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'app', 'vendor');

const files = [
  ['node_modules/fflate/esm/browser.js', 'fflate.js'],
  ['node_modules/fflate/LICENSE', 'fflate.LICENSE'],
  // The legacy build carries polyfills for older iOS Safari versions.
  ['node_modules/pdfjs-dist/legacy/build/pdf.min.mjs', 'pdfjs/pdf.min.mjs'],
  ['node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.mjs'],
  ['node_modules/pdfjs-dist/LICENSE', 'pdfjs/LICENSE'],
];

for (const [from, to] of files) {
  const target = join(vendor, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, from), target);
  console.log(`${from} -> app/vendor/${to}`);
}
