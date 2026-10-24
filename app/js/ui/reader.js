// Reader: one word at a time with a fixed focus letter, faint previous and
// next words, and a control panel while paused (context paragraph, position,
// chapters, speed). Tap or hold the reading area to read; swipe to step
// through words.

import { buildIndex, chapterIndexAt, estimateMs, paragraphAt, partDurations } from '../reader/book-index.js';
import { Engine } from '../reader/engine.js';
import { splitAtFocus } from '../reader/orp.js';
import { loadSettings, onSettingsChange, stepWpm } from '../settings.js';
import * as db from '../storage/db.js';
import { buildVocabulary, splitLongWord } from '../text/compound.js';
import { loadHyphenator } from '../text/hyphenate.js';
import { h, icon, openSheet, toast } from './dom.js';
import { formatDuration, formatPercent } from './format.js';
import { attachGestures } from './gestures.js';
import { openSettings } from './settings-view.js';

const SAVE_INTERVAL_MS = 4000;
const EDGE_MARGIN = 12;
const HOLD_LEAD_IN_MS = 60;

export async function openReader(root, id) {
  root.replaceChildren(h('div', { class: 'loading' }, 'Åpner boka …'));
  const [book, content] = await Promise.all([db.getBook(id), db.getContent(id)]);
  if (!book || !content) {
    location.hash = '#/';
    return () => {};
  }
  const index = buildIndex(content);
  if (index.words.length === 0) {
    toast('Boka er tom.', { error: true });
    location.hash = '#/';
    return () => {};
  }

  let settings = loadSettings();
  // The book's own speed once − or + has been used while reading it; until
  // then it follows the standard speed from the settings.
  let bookWpm = Number.isFinite(book.wpm) ? book.wpm : null;
  const wpm = () => bookWpm ?? settings.wpm;
  const options = () => ({ wpm: wpm(), pacing: settings.pacing, lang: book.lang });
  let lastSaved = 0;
  let wakeLock = null;
  // Whether the control panel shows while paused. In hold-to-read mode it
  // stays closed between holds and a tap opens it.
  let panelOpen = true;
  let scrubbing = false;

  // Long compounds are shown in parts («sykehus-» «parkerings-» «plassen»).
  // The hyphenation patterns load on demand; parts are cached per word.
  let splitWord = null;
  let vocabulary = null;
  const partsCache = new Map();
  const partsAt = (wordIndex) => {
    if (!splitWord) return [index.words[wordIndex]];
    let parts = partsCache.get(wordIndex);
    if (!parts) {
      parts = splitWord(index.words[wordIndex]);
      partsCache.set(wordIndex, parts);
    }
    return parts;
  };
  async function prepareSplitting() {
    partsCache.clear();
    if (!settings.splitLongWords) {
      splitWord = null;
      return;
    }
    try {
      const points = await loadHyphenator(book.lang);
      vocabulary ||= buildVocabulary(index.words);
      const maxLetters = settings.splitLength;
      splitWord = (word) => splitLongWord(word, { points, vocabulary, maxLetters });
    } catch {
      splitWord = null;
    }
    partsCache.clear();
  }
  await prepareSplitting();

  const engine = new Engine(index, {
    getOptions: options,
    timing: (wordIndex) => partDurations(index, wordIndex, partsAt(wordIndex), options()),
    onChange: (reason) => {
      render(reason);
      if (reason === 'play' || reason === 'pause') updateMode();
      if (reason === 'pause') save();
      else if (Date.now() - lastSaved > SAVE_INTERVAL_MS) save();
    },
    onEnd: () => toast('Du har lest ut boka.'),
  });

  // Saved positions are word indexes; rescale if tokenisation has changed.
  const saved = book.wordCount && book.wordCount !== index.words.length
    ? Math.round((book.position / book.wordCount) * index.words.length)
    : book.position || 0;
  engine.wordIndex = Math.min(Math.max(0, saved), engine.lastIndex);

  // ---------- Elements ----------

  const els = {
    prev: h('span', { class: 'phantom prev' }),
    before: h('span'),
    focus: h('span', { class: 'focus' }),
    after: h('span'),
    next: h('span', { class: 'phantom next' }),
  };
  els.word = h('span', { class: 'word' }, els.before, els.focus, els.after);
  els.line = h('div', { class: 'word-line', 'aria-live': 'off' }, els.prev, els.word, els.next);
  els.stage = h('div', { class: 'stage', role: 'button' },
    h('div', { class: 'guide top' }), els.line, h('div', { class: 'guide bottom' }),
    els.hint = h('div', { class: 'reader-hint' }));
  els.thin = h('span');
  els.chapterTitle = h('span');
  els.context = h('div', { class: 'context', 'aria-label': 'Avsnittet du leser' });
  els.positionLeft = h('span');
  els.positionRight = h('span');
  els.scrubber = h('input', {
    class: 'scrubber', type: 'range', min: 0, max: engine.lastIndex, step: 1, 'aria-label': 'Posisjon i boka',
  });
  els.playIcon = h('span');
  els.wpm = h('output', { 'aria-live': 'polite' });

  const button = (name, label, onclick, extra = {}) =>
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick, ...extra }, icon(name));

  const view = h('div', { class: 'reader' },
    els.stage,
    h('div', { class: 'thin-progress', 'aria-hidden': 'true' }, els.thin),
    h('header', { class: 'reader-top' },
      button('back', 'Til biblioteket', () => { location.hash = '#/'; }),
      h('div', { class: 'reader-titles' }, h('strong', null, book.title), els.chapterTitle),
      button('list', 'Kapitler', () => showChapters())),
    h('div', { class: 'panel' },
      h('div', { class: 'panel-inner' },
        els.context,
        h('div', { class: 'position-row' }, els.positionLeft, els.positionRight),
        els.scrubber,
        h('div', { class: 'transport' },
          button('prevChapter', 'Forrige kapittel', () => engine.jumpChapter(-1)),
          button('rewind', 'Tilbake til starten av setningen', () => engine.rewindSentence()),
          button('stepBack', 'Forrige ord', () => engine.step(-1)),
          h('button', { class: 'play-btn', type: 'button', 'aria-label': 'Spill av', onclick: () => engine.toggle() },
            els.playIcon),
          button('stepForward', 'Neste ord', () => engine.step(1)),
          button('list', 'Kapitler', () => showChapters()),
          button('nextChapter', 'Neste kapittel', () => engine.jumpChapter(1))),
        h('div', { class: 'speed-row' },
          h('div', { class: 'speed' },
            button('minus', 'Saktere', () => changeWpm(-1)),
            els.wpm,
            button('plus', 'Raskere', () => changeWpm(1))),
          button('sliders', 'Innstillinger', () => openReaderSettings())))));

  root.replaceChildren(view);

  // ---------- Rendering ----------

  function applySettings() {
    view.classList.toggle('no-guides', !settings.guides);
    view.classList.toggle('no-context', !settings.showContext);
    view.style.setProperty('--word-size', `${settings.fontSize}px`);
    els.wpm.textContent = `${wpm()} ord/min`;
    els.wpm.title = bookWpm === null ? 'Standardhastighet' : 'Egen hastighet for denne boka';
  }

  function updateMode() {
    view.classList.toggle('playing', engine.playing);
    view.classList.toggle('panel-closed', !engine.playing && !panelOpen);
    els.playIcon.replaceChildren(icon(engine.playing ? 'pause' : 'play'));
    if (engine.playing) lockScreen();
    else releaseScreen();
    updateHint();
  }

  const holdMode = () => settings.readingMode === 'hold';

  function updateHint() {
    const i = engine.wordIndex;
    if (scrubbing) {
      els.hint.textContent = `${formatPercent(i / Math.max(1, engine.lastIndex))} · ` +
        index.chapters[chapterIndexAt(index, i)].title;
    } else if (holdMode()) {
      els.hint.textContent = 'Hold fingeren på skjermen for å lese · trykk for meny';
    } else {
      els.hint.textContent = i === 0 ? 'Trykk på ordet for å begynne' : 'Trykk for å fortsette · sveip for å spole';
    }
    els.stage.setAttribute('aria-label', holdMode() ? 'Hold for å lese, trykk for meny' : 'Spill av eller pause');
  }

  // Places the word so the focus letter's centre sits on the anchor line, and
  // shrinks words that would not fit beside it.
  function positionWord() {
    const width = els.stage.clientWidth;
    const anchorX = Math.round((width * settings.anchor) / 100);
    view.style.setProperty('--anchor-x', `${anchorX}px`);
    els.word.style.fontSize = '';
    const measure = () => {
      const left = els.word.offsetLeft;
      const focusCenter = els.focus.offsetLeft + els.focus.offsetWidth / 2;
      return { left, right: left + els.word.offsetWidth, focusCenter };
    };
    let m = measure();
    const scale = Math.min(1,
      (anchorX - EDGE_MARGIN) / Math.max(1, m.focusCenter - m.left),
      (width - EDGE_MARGIN - anchorX) / Math.max(1, m.right - m.focusCenter));
    if (scale < 1) {
      els.word.style.fontSize = `${Math.max(0.35, scale).toFixed(3)}em`;
      m = measure();
    }
    els.line.style.transform = `translate3d(${anchorX - m.focusCenter}px, -50%, 0)`;
  }

  function renderWord() {
    const i = engine.wordIndex;
    const parts = partsAt(i);
    const part = Math.min(engine.part, parts.length - 1);
    const { before, focus, after } = splitAtFocus(parts[part]);
    els.before.textContent = before;
    els.focus.textContent = focus;
    els.after.textContent = after;
    // The faint neighbours are the neighbouring parts of a split word, else the neighbouring words.
    const paragraph = paragraphAt(index, i);
    const previous = part > 0 ? parts[part - 1] : (i > paragraph.start ? index.words[i - 1] : '');
    const next = part < parts.length - 1 ? parts[part + 1] : (i + 1 < paragraph.end ? index.words[i + 1] : '');
    els.prev.textContent = settings.phantomWords ? previous : '';
    els.next.textContent = settings.phantomWords ? next : '';
    positionWord();
    els.thin.style.width = `${(i / Math.max(1, engine.lastIndex)) * 100}%`;
    updateHint();
  }

  let contextParagraph = -1;
  function renderContext() {
    if (!settings.showContext) return;
    const paragraph = paragraphAt(index, engine.wordIndex);
    const p = index.paragraphOf[engine.wordIndex];
    if (p !== contextParagraph) {
      contextParagraph = p;
      const spans = [];
      for (let w = paragraph.start; w < paragraph.end; w++) {
        spans.push(h('span', { dataset: { w } }, index.words[w]), ' ');
      }
      els.context.replaceChildren(...spans);
    }
    for (const el of els.context.querySelectorAll('.current')) el.classList.remove('current');
    const current = els.context.querySelector(`[data-w="${engine.wordIndex}"]`);
    if (current) {
      current.classList.add('current');
      const top = current.offsetTop - els.context.offsetTop;
      if (top < els.context.scrollTop || top > els.context.scrollTop + els.context.clientHeight - 24) {
        els.context.scrollTop = Math.max(0, top - 24);
      }
    }
  }

  // Remaining time is skipped while swiping, where it would run for every word.
  function renderPanel({ times = true } = {}) {
    const i = engine.wordIndex;
    const c = chapterIndexAt(index, i);
    const chapter = index.chapters[c];
    els.chapterTitle.textContent = `${chapter.title} · ${c + 1}/${index.chapters.length}`;
    els.scrubber.value = String(i);
    els.positionLeft.textContent = formatPercent(i / Math.max(1, engine.lastIndex));
    if (times) {
      const chapterLeft = estimateMs(index, i, chapter.end, options());
      const bookLeft = estimateMs(index, i, index.words.length, options());
      els.positionRight.textContent = `Igjen: ${formatDuration(chapterLeft)} i kapittelet · ${formatDuration(bookLeft)} totalt`;
    }
    renderContext();
  }

  function render(reason) {
    renderWord();
    if (!engine.playing || reason === 'pause') renderPanel({ times: !scrubbing });
  }

  // ---------- Actions ----------

  function setBookWpm(value) {
    bookWpm = value;
    applySettings();
    if (!engine.playing) renderPanel();
    return db.updateBook(book.id, { wpm: value }).catch(() => {});
  }

  const changeWpm = (direction) => setBookWpm(stepWpm(wpm(), direction));
  const openReaderSettings = () => openSettings({
    book: { title: book.title, wpm: bookWpm, resetSpeed: () => setBookWpm(null) },
  });

  function save() {
    lastSaved = Date.now();
    const i = engine.wordIndex;
    db.updateBook(book.id, {
      position: i,
      wordCount: index.words.length,
      openedAt: Date.now(),
      finished: i >= engine.lastIndex,
      remainingMs: estimateMs(index, i, index.words.length, options()),
    }).catch(() => {});
  }

  function showChapters() {
    engine.pause();
    const current = chapterIndexAt(index, engine.wordIndex);
    const items = index.chapters.map((chapter, c) => h('li', { class: c === current ? 'current' : '' },
      h('button', {
        type: 'button',
        onclick: () => {
          engine.seek(chapter.start);
          close();
        },
      },
      h('span', { class: 'num' }, c + 1),
      h('span', { class: 'title' }, chapter.title),
      h('span', { class: 'pct' }, formatPercent(chapter.start / Math.max(1, engine.lastIndex))))));
    const list = h('ul', { class: 'chapter-list' }, items);
    const close = openSheet('Kapitler', list);
    items[current]?.scrollIntoView({ block: 'center' });
  }

  async function lockScreen() {
    try {
      if (!wakeLock && navigator.wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch {
      wakeLock = null;
    }
  }

  function releaseScreen() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  // ---------- Events ----------

  attachGestures(els.stage, {
    holdEnabled: holdMode,
    onTap: () => {
      if (holdMode()) {
        panelOpen = !panelOpen;
        engine.pause();
        updateMode();
      } else {
        panelOpen = true;
        engine.toggle();
      }
    },
    onHoldStart: () => {
      panelOpen = false;
      engine.play({ leadInMs: HOLD_LEAD_IN_MS });
    },
    onHoldEnd: () => engine.pause(),
    onScrubStart: () => {
      scrubbing = true;
      if (!holdMode()) panelOpen = true;
      engine.pause();
      view.classList.add('scrubbing');
      updateMode();
    },
    onScrub: (steps) => engine.step(steps),
    onScrubEnd: () => {
      scrubbing = false;
      view.classList.remove('scrubbing');
      render('scrub-end');
      save();
    },
  });
  els.context.addEventListener('click', (event) => {
    const w = event.target?.dataset?.w;
    if (w !== undefined) engine.seek(Number(w));
  });
  els.scrubber.addEventListener('input', () => engine.seek(Number(els.scrubber.value)));

  const onKey = (event) => {
    if (document.querySelector('.sheet-backdrop') || event.target instanceof HTMLInputElement) return;
    const actions = {
      ' ': () => engine.toggle(),
      Enter: () => engine.toggle(),
      ArrowLeft: () => (event.shiftKey ? engine.rewindSentence() : engine.step(-1)),
      ArrowRight: () => engine.step(1),
      ArrowUp: () => changeWpm(1),
      ArrowDown: () => changeWpm(-1),
      PageUp: () => engine.jumpChapter(-1),
      PageDown: () => engine.jumpChapter(1),
      Escape: () => { location.hash = '#/'; },
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      engine.pause();
      save();
    }
  };
  const onResize = () => positionWord();
  let splitKey = `${settings.splitLongWords}:${settings.splitLength}`;
  const stopSettings = onSettingsChange(async (next) => {
    settings = next;
    if (!holdMode()) panelOpen = true;
    applySettings();
    updateMode();
    contextParagraph = -1;
    const key = `${settings.splitLongWords}:${settings.splitLength}`;
    if (key !== splitKey) {
      splitKey = key;
      engine.part = 0;
      await prepareSplitting();
    }
    render('settings');
  });

  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', onResize);

  applySettings();
  updateMode();
  // Fonts and layout settle after the first frame; position once more then.
  render('open');
  requestAnimationFrame(() => positionWord());
  db.updateBook(book.id, { openedAt: Date.now() }).catch(() => {});

  return () => {
    engine.pause();
    save();
    releaseScreen();
    stopSettings();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', save);
    window.removeEventListener('resize', onResize);
  };
}
