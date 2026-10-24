// Service worker registration and the offline/installation status shown to the user.

import { h } from './dom.js';

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

let waitingWorker = null;
const updateListeners = new Set();

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((registration) => {
    const track = (worker) => {
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announce(worker);
      });
    };
    if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);
    track(registration.installing);
    registration.addEventListener('updatefound', () => track(registration.installing));
  }).catch(() => {
    // Without a service worker the app still works online.
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !waitingWorker) return;
    reloading = true;
    location.reload();
  });
}

function announce(worker) {
  waitingWorker = worker;
  for (const listener of updateListeners) listener();
}

export function onUpdateAvailable(listener) {
  updateListeners.add(listener);
  if (waitingWorker) listener();
  return () => updateListeners.delete(listener);
}

export function applyUpdate() {
  waitingWorker?.postMessage('skipWaiting');
}

export function updateBanner() {
  return h('div', { class: 'banner' },
    h('span', null, 'En ny versjon av appen er klar.'),
    h('button', { class: 'btn primary', type: 'button', onclick: applyUpdate }, 'Oppdater'));
}

export async function offlineStatus() {
  if (!('serviceWorker' in navigator)) return 'Nettleseren støtter ikke lesing uten nett.';
  if (!window.isSecureContext) return 'Lesing uten nett krever HTTPS.';
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) return 'Laster ned appen for bruk uten nett …';
  return '✓ Klar for bruk uten nett.';
}

export async function storageSummary() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    if (!estimate) return '';
    const mb = (estimate.usage || 0) / (1024 * 1024);
    return `${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB brukt${persisted ? ' · varig lagring' : ''}`;
  } catch {
    return '';
  }
}

// Asks the browser not to evict the library under storage pressure.
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
