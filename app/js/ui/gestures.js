// Gestures on the reading area, from pointer events (touch, pen or mouse):
//   tap               – a press released without moving
//   press and hold    – reading while the finger stays down (when enabled)
//   horizontal swipe  – step through words; finger to the left moves forward,
//                       and faster swipes move further

const MOVE_THRESHOLD_PX = 10;
// While reading with a held finger, small drift must not turn into a swipe.
const HOLD_MOVE_THRESHOLD_PX = 40;
const HOLD_DELAY_MS = 150;
const PX_PER_WORD = 24;
const MAX_SPEED_BOOST = 3;

export function attachGestures(element, handlers, { now = () => performance.now() } = {}) {
  const { holdEnabled, onTap, onHoldStart, onHoldEnd, onScrubStart, onScrub, onScrubEnd } = handlers;
  let press = null;

  const startScrub = (event) => {
    clearTimeout(press.holdTimer);
    if (press.mode === 'hold') onHoldEnd();
    press.mode = 'scrub';
    press.lastX = event.clientX;
    press.lastTime = now();
    onScrubStart();
  };

  const onDown = (event) => {
    if (press || (event.pointerType === 'mouse' && event.button !== 0)) return;
    element.setPointerCapture?.(event.pointerId);
    press = { id: event.pointerId, startX: event.clientX, startY: event.clientY, mode: 'pending', distance: 0 };
    if (holdEnabled()) {
      press.holdTimer = setTimeout(() => {
        if (press?.mode !== 'pending') return;
        press.mode = 'hold';
        onHoldStart();
      }, HOLD_DELAY_MS);
    }
  };

  const onMove = (event) => {
    if (!press || event.pointerId !== press.id) return;
    if (press.mode !== 'scrub') {
      const dx = event.clientX - press.startX;
      const dy = event.clientY - press.startY;
      const threshold = press.mode === 'hold' ? HOLD_MOVE_THRESHOLD_PX : MOVE_THRESHOLD_PX;
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) startScrub(event);
      else if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX && press.mode === 'pending') press.mode = 'moved';
      return;
    }
    const time = now();
    const delta = event.clientX - press.lastX;
    const speed = Math.abs(delta) / Math.max(1, time - press.lastTime);
    press.distance += delta * (1 + Math.min(MAX_SPEED_BOOST, speed));
    press.lastX = event.clientX;
    press.lastTime = time;
    const steps = Math.trunc(press.distance / PX_PER_WORD);
    if (steps !== 0) {
      press.distance -= steps * PX_PER_WORD;
      onScrub(-steps);
    }
  };

  const onEnd = (event) => {
    if (!press || event.pointerId !== press.id) return;
    const { mode } = press;
    clearTimeout(press.holdTimer);
    press = null;
    if (mode === 'pending' && event.type === 'pointerup') onTap();
    else if (mode === 'hold') onHoldEnd();
    else if (mode === 'scrub') onScrubEnd();
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onEnd);
  element.addEventListener('pointercancel', onEnd);
  // A long press must not open a context menu.
  element.addEventListener('contextmenu', (event) => event.preventDefault());
}
