// Form controls used in the settings sheet: slider, switch and segmented buttons.

import { h } from './dom.js';

export function range({ label, min, max, step, value, format, help, onInput }) {
  const output = h('output', null, format(value));
  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  input.addEventListener('input', () => {
    output.textContent = format(Number(input.value));
    onInput(Number(input.value));
  });
  return h('div', { class: 'setting' },
    h('div', { class: 'setting-label' }, h('span', null, label), output),
    input,
    help ? h('div', { class: 'setting-help' }, help) : null);
}

export function toggle({ label, checked, help, onChange }) {
  const input = h('input', { type: 'checkbox', role: 'switch', 'aria-label': label, checked });
  input.addEventListener('change', () => onChange(input.checked));
  return h('div', { class: 'setting' },
    h('label', { class: 'setting-label' }, h('span', null, label), h('span', { class: 'switch' }, input, h('span'))),
    help ? h('div', { class: 'setting-help' }, help) : null);
}

export function segmented({ label, options, value, help, onChange }) {
  const keys = Object.keys(options);
  const buttons = keys.map((key) => h('button', {
    type: 'button',
    'aria-pressed': String(key === value),
    onclick: () => {
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(keys[i] === key)));
      onChange(key);
    },
  }, options[key]));
  return h('div', { class: 'setting' }, h('div', { class: 'setting-label' }, h('span', null, label)),
    h('div', { class: 'segmented', role: 'group', 'aria-label': label }, buttons),
    help ? h('div', { class: 'setting-help' }, help) : null);
}
