// Playback clock. Each word gets an absolute deadline measured with
// performance.now(), so timer jitter does not accumulate into a slower pace.
// A late tick shows the next word immediately to catch up, like rsvpnano;
// after a long stall (screen locked, app in background) the clock restarts.

import { chapterIndexAt, durationAt, sentenceStartAtOrBefore } from './book-index.js';

const LEAD_IN_MS = 250;
const MAX_LAG_MS = 1000;

export class Engine {
  constructor(index, { getOptions, onChange, onEnd }) {
    this.index = index;
    this.getOptions = getOptions;
    this.onChange = onChange;
    this.onEnd = onEnd;
    this.wordIndex = 0;
    this.playing = false;
    this.timer = null;
    this.deadline = 0;
  }

  get lastIndex() {
    return Math.max(0, this.index.words.length - 1);
  }

  duration(wordIndex = this.wordIndex) {
    return durationAt(this.index, wordIndex, this.getOptions());
  }

  play() {
    if (this.playing || this.index.words.length === 0) return;
    if (this.wordIndex >= this.lastIndex) this.wordIndex = 0;
    this.playing = true;
    this.deadline = performance.now() + LEAD_IN_MS + this.duration();
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
    if (this.wordIndex >= this.lastIndex) {
      this.pause();
      this.onEnd?.();
      return;
    }
    this.wordIndex++;
    this.deadline += this.duration();
    this.onChange('word');
    this.schedule();
  }

  seek(wordIndex) {
    this.wordIndex = Math.min(Math.max(0, wordIndex), this.lastIndex);
    if (this.playing) {
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
