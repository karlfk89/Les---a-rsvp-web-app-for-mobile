// Small DOM helpers: element builder, icons, bottom sheets and toasts.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'html') el.innerHTML = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/>',
  prevChapter: '<path d="M6 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18.5 5.8v12.4a.7.7 0 0 1-1.1.6L9.6 12.6a.7.7 0 0 1 0-1.2l7.8-6.2a.7.7 0 0 1 1.1.6z" fill="currentColor"/>',
  nextChapter: '<path d="M18 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 5.8v12.4a.7.7 0 0 0 1.1.6l7.8-6.2a.7.7 0 0 0 0-1.2L6.6 5.2a.7.7 0 0 0-1.1.6z" fill="currentColor"/>',
  rewind: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M4 4.5v4.2h4.2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
  stepBack: '<path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  stepForward: '<path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  more: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  minus: '<path d="M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};

export function icon(name) {
  return h('span', { class: 'icon', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24">${PATHS[name]}</svg>` });
}

// Bottom sheet. Returns a function that closes it.
export function openSheet(title, body, { onClose } = {}) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    onClose?.();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-header' },
      h('h2', null, title),
      h('button', { class: 'btn ghost', onclick: close }, 'Ferdig')),
    h('div', { class: 'sheet-body' }, body));
  const backdrop = h('div', {
    class: 'sheet-backdrop',
    onclick: (event) => {
      if (event.target === backdrop) close();
    },
  }, sheet);
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  return close;
}

export function clearToasts() {
  document.getElementById('toasts')?.replaceChildren();
}

export function toast(message, { error = false, duration = 3500 } = {}) {
  const el = h('div', { class: `toast${error ? ' error' : ''}` }, message);
  document.getElementById('toasts').append(el);
  let timer = null;
  const close = () => {
    clearTimeout(timer);
    el.remove();
  };
  const arm = (ms) => {
    clearTimeout(timer);
    if (ms) timer = setTimeout(close, ms);
  };
  arm(duration);
  return {
    update(text, options = {}) {
      el.textContent = text;
      el.classList.toggle('error', Boolean(options.error));
      if ('duration' in options) arm(options.duration);
    },
    close,
  };
}
