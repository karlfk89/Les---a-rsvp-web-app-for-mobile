// Playback clock. Each word gets an absolute deadline measured with
// performance.now(), so timer jitter does not accumulate into a slower pace.
// A late tick shows the next word immediately to catch up, like rsvpnano;
// after a long stall (screen locked, app in background) the clock restarts.
// A long word can be shown in parts: `timing(wordIndex)` returns one display
// time per part, and `part` says which part is showing.

import { chapterIndexAt, durationAt, sentenceStartAtOrBefore } from './book-index.js';

const LEAD_IN_MS = 250;
const MAX_LAG_MS = 1000;
// With `smoothStart`, the first words after starting are shown a little
// longer so the eyes can find the rhythm.
const SMOOTH_START = [1.6, 1.45, 1.3, 1.15];

export class Engine {
  constructor(index, { getOptions, onChange, onEnd, timing }) {
    this.index = index;
    this.getOptions = getOptions;
    this.onChange = onChange;
    this.onEnd = onEnd;
    this.timing = timing || ((wordIndex) => [durationAt(index, wordIndex, getOptions())]);
    this.wordIndex = 0;
    this.part = 0;
    this.shown = 0;
    this.playing = false;
    this.timer = null;
    this.deadline = 0;
  }

  get lastIndex() {
    return Math.max(0, this.index.words.length - 1);
  }

  duration() {
    const times = this.timing(this.wordIndex);
    const ramp = this.getOptions().smoothStart ? SMOOTH_START[this.shown] ?? 1 : 1;
    return times[Math.min(this.part, times.length - 1)] * ramp;
  }

  // The lead-in gives the eye time to settle on the first word; hold-to-read
  // passes a shorter one since the hold delay already gives that time.
  play({ leadInMs = LEAD_IN_MS } = {}) {
    if (this.playing || this.index.words.length === 0) return;
    if (this.wordIndex >= this.lastIndex && this.part >= this.timing(this.wordIndex).length - 1) {
      this.wordIndex = 0;
      this.part = 0;
    }
    this.playing = true;
    this.shown = 0;
    this.deadline = performance.now() + leadInMs + this.duration();
    this.schedule();
    this.onChange('play');
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.timer);
    this.timer = null;
    this.onChange('pause');
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), Math.max(0, this.deadline - performance.now()));
  }

  tick() {
    if (!this.playing) return;
    const now = performance.now();
    if (now - this.deadline > MAX_LAG_MS) this.deadline = now;
    if (this.part < this.timing(this.wordIndex).length - 1) {
      this.part++;
    } else if (this.wordIndex >= this.lastIndex) {
      this.pause();
      this.onEnd?.();
      return;
    } else {
      this.wordIndex++;
      this.part = 0;
    }
    this.shown++;
    this.deadline += this.duration();
    this.onChange('word');
    this.schedule();
  }

  seek(wordIndex) {
    this.wordIndex = Math.min(Math.max(0, wordIndex), this.lastIndex);
    this.part = 0;
    if (this.playing) {
      this.shown = 0;
      this.deadline = performance.now() + LEAD_IN_MS + this.duration();
      this.schedule();
    }
    this.onChange('seek');
  }

  step(delta) {
    this.seek(this.wordIndex + delta);
  }

  rewindSentence() {
    const { lang } = this.getOptions();
    const start = sentenceStartAtOrBefore(this.index, this.wordIndex, lang);
    const target = start === this.wordIndex && this.wordIndex > 0
      ? sentenceStartAtOrBefore(this.index, this.wordIndex - 1, lang)
      : start;
    this.seek(target);
  }

  chapterIndex() {
    return chapterIndexAt(this.index, this.wordIndex);
  }

  jumpChapter(delta) {
    const chapters = this.index.chapters;
    const current = this.chapterIndex();
    // Going back from inside a chapter returns to its start first.
    const target = delta < 0 && this.wordIndex > chapters[current].start + 5 ? current : current + delta;
    if (target < 0 || target >= chapters.length) return;
    this.seek(chapters[target].start);
  }
}
