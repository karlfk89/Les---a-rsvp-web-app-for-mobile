// Global reader settings, kept in localStorage so the theme can be applied
// before the first paint.

import { DEFAULT_PACING } from './reader/pacing.js';

const KEY = 'rsvp-settings';

export const DEFAULT_SETTINGS = {
  wpm: 300,
  pacing: { ...DEFAULT_PACING },
  phantomWords: true,
  showContext: true,
  guides: true,
  focusColor: 'accent',
  anchor: 35,
  theme: 'dark',
  font: 'serif',
  fontSize: 44,
};

export const WPM_MIN = 50;
export const WPM_MAX = 1200;

export const FONTS = {
  serif: { label: 'Serif', css: 'ui-serif, "New York", Georgia, "Times New Roman", serif' },
  sans: { label: 'Sans', css: '-apple-system, system-ui, "SF Pro Text", "Helvetica Neue", Arial, sans-serif' },
  rounded: { label: 'Rund', css: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif' },
  mono: { label: 'Mono', css: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
};

export const FOCUS_COLORS = {
  accent: { label: 'Rød', css: 'var(--accent)' },
  orange: { label: 'Oransje', css: '#ff9f0a' },
  blue: { label: 'Blå', css: '#0a84ff' },
  green: { label: 'Grønn', css: '#30d158' },
  none: { label: 'Av', css: 'var(--text)' },
};

export const THEMES = { dark: 'Mørk', black: 'Svart', light: 'Lys', sepia: 'Sepia' };

const listeners = new Set();
let current = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isObject = (value) => Boolean(value) && typeof value === 'object';
const hasKey = (object, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(object, key);

// Keeps only known settings with valid values, so an old or edited backup file
// cannot put the reader into a broken state.
export function normalizeSettings(raw) {
  const source = isObject(raw) ? raw : {};
  const pacingSource = isObject(source.pacing) ? source.pacing : {};
  const number = (value, fallback, min, max) => (Number.isFinite(value) ? clamp(value, min, max) : fallback);
  const flag = (key) => (typeof source[key] === 'boolean' ? source[key] : DEFAULT_SETTINGS[key]);
  const choice = (key, options) => (hasKey(options, source[key]) ? source[key] : DEFAULT_SETTINGS[key]);
  return {
    wpm: number(source.wpm, DEFAULT_SETTINGS.wpm, WPM_MIN, WPM_MAX),
    pacing: Object.fromEntries(Object.entries(DEFAULT_PACING)
      .map(([key, fallback]) => [key, number(pacingSource[key], fallback, 0, 600)])),
    phantomWords: flag('phantomWords'),
    showContext: flag('showContext'),
    guides: flag('guides'),
    focusColor: choice('focusColor', FOCUS_COLORS),
    anchor: number(source.anchor, DEFAULT_SETTINGS.anchor, 25, 50),
    theme: choice('theme', THEMES),
    font: choice('font', FONTS),
    fontSize: number(source.fontSize, DEFAULT_SETTINGS.fontSize, 24, 96),
  };
}

export function loadSettings() {
  if (current) return current;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    saved = {};
  }
  current = normalizeSettings(saved);
  return current;
}

export function updateSettings(changes) {
  current = { ...loadSettings(), ...changes };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or storage full: keep the settings for this session.
  }
  applyAppearance(current);
  for (const listener of listeners) listener(current);
  return current;
}

export function onSettingsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyAppearance(settings) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.style.setProperty('--font-reader', (FONTS[settings.font] || FONTS.serif).css);
  root.style.setProperty('--focus', (FOCUS_COLORS[settings.focusColor] || FOCUS_COLORS.accent).css);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#121214';
}

// Same speed steps as rsvpnano: 10 up to 100 WPM, 25 above.
export function stepWpm(wpm, direction) {
  const step = (direction > 0 ? wpm < 100 : wpm <= 100) ? 10 : 25;
  let next = wpm + direction * step;
  if ((wpm < 100 && next > 100) || (wpm > 100 && next < 100)) next = 100;
  return Math.min(WPM_MAX, Math.max(WPM_MIN, next));
}
