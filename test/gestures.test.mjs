import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attachGestures } from '../app/js/ui/gestures.js';

// A fake reading area that records which gesture handlers were called.
function setup(t, { hold = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let time = 0;
  const calls = [];
  const element = new EventTarget();
  const record = (name) => (...args) => calls.push(args.length ? [name, ...args] : [name]);
  attachGestures(element, {
    holdEnabled: () => hold,
    onTap: record('tap'),
    onHoldStart: record('holdStart'),
    onHoldEnd: record('holdEnd'),
    onScrubStart: record('scrubStart'),
    onScrub: record('scrub'),
    onScrubEnd: record('scrubEnd'),
  }, { now: () => time });
  const fire = (type, x, y = 100) => element.dispatchEvent(
    Object.assign(new Event(type), { pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y }));
  const advance = (ms) => {
    time += ms;
    t.mock.timers.tick(ms);
  };
  return { calls, fire, advance };
}

test('a press without movement is a tap', (t) => {
  const { calls, fire, advance } = setup(t);
  fire('pointerdown', 200);
  advance(600);
  fire('pointerup', 202);
  assert.deepEqual(calls, [['tap']]);
});

test('swiping left steps forward, swiping right steps back', (t) => {
  const { calls, fire, advance } = setup(t);
  fire('pointerdown', 300);
  for (let x = 290; x >= 100; x -= 10) {
    advance(50);
    fire('pointermove', x);
  }
  fire('pointerup', 100);
  const forward = calls.filter(([name]) => name === 'scrub').reduce((sum, [, steps]) => sum + steps, 0);
  assert.equal(calls[0][0], 'scrubStart');
  assert.equal(calls[calls.length - 1][0], 'scrubEnd');
  assert.ok(forward >= 7 && forward <= 9, `slow swipe moved ${forward} words`);
  assert.ok(!calls.some(([name]) => name === 'tap'));

  calls.length = 0;
  fire('pointerdown', 100);
  for (let x = 120; x <= 300; x += 20) {
    advance(5);
    fire('pointermove', x);
  }
  fire('pointerup', 300);
  const back = calls.filter(([name]) => name === 'scrub').reduce((sum, [, steps]) => sum + steps, 0);
  assert.ok(back < -15, `fast swipe back moved ${back} words`);
});

test('vertical movement is neither a tap nor a swipe', (t) => {
  const { calls, fire } = setup(t);
  fire('pointerdown', 200, 100);
  fire('pointermove', 203, 160);
  fire('pointerup', 203, 160);
  assert.deepEqual(calls, []);
});

test('hold to read starts after a short delay and stops on release', (t) => {
  const { calls, fire, advance } = setup(t, { hold: true });
  fire('pointerdown', 200);
  advance(100);
  assert.deepEqual(calls, []);
  advance(100);
  assert.deepEqual(calls, [['holdStart']]);
  advance(3000);
  fire('pointermove', 225);
  fire('pointerup', 225);
  assert.deepEqual(calls, [['holdStart'], ['holdEnd']]);
});

test('in hold mode a quick tap is a tap, and a cancelled press stops reading', (t) => {
  const { calls, fire, advance } = setup(t, { hold: true });
  fire('pointerdown', 200);
  advance(80);
  fire('pointerup', 200);
  advance(500);
  assert.deepEqual(calls, [['tap']]);

  calls.length = 0;
  fire('pointerdown', 200);
  advance(400);
  fire('pointercancel', 200);
  assert.deepEqual(calls, [['holdStart'], ['holdEnd']]);
});

test('swiping while holding stops reading and scrubs', (t) => {
  const { calls, fire, advance } = setup(t, { hold: true });
  fire('pointerdown', 300);
  advance(400);
  advance(50);
  fire('pointermove', 250);
  assert.deepEqual(calls.slice(0, 3), [['holdStart'], ['holdEnd'], ['scrubStart']]);
  fire('pointerup', 250);
  assert.equal(calls[calls.length - 1][0], 'scrubEnd');
});
