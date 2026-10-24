// App entry: hash routing between the library (#/) and the reader (#/bok/<id>).

import { applyAppearance, loadSettings } from './settings.js';
import { clearToasts } from './ui/dom.js';
import { openLibrary } from './ui/library.js';
import { registerServiceWorker } from './ui/offline.js';
import { openReader } from './ui/reader.js';

const root = document.getElementById('app');
let cleanup = () => {};
let navigation = 0;

async function route() {
  const current = ++navigation;
  cleanup();
  cleanup = () => {};
  clearToasts();
  const match = /^#\/bok\/([\w-]+)/.exec(location.hash);
  const next = match ? await openReader(root, match[1]) : openLibrary(root);
  // A newer navigation started while this view was loading.
  if (current !== navigation) next?.();
  else cleanup = next || (() => {});
}

applyAppearance(loadSettings());
window.addEventListener('hashchange', route);
route();
registerServiceWorker();
