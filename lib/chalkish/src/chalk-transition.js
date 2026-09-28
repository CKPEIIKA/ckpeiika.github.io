// One chalk pen for page text (CSS, demos/shell.css) and board objects (Mobject.reveal,
// Write): write and erase take writeMs, a rewrite takes rewriteMs, erasing until eraseEnd
// of it and writing from writeStart. shell.css repeats the durations; a test keeps them equal.
export const CHALK_TIMING = Object.freeze({ writeMs: 1200, rewriteMs: 1600, eraseEnd: 0.42, writeStart: 0.52 });

const PHASES = new Set(['write', 'erase', 'rewrite']);
const labelAnimations = new WeakMap();

export function reducedMotionRequested(matchMedia = globalThis.matchMedia) {
  return typeof matchMedia === 'function'
    && Boolean(matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function transitionTarget(element) {
  if (!element || typeof element !== 'object' || !element.dataset) {
    throw new TypeError('chalk transition target must expose dataset');
  }
  return element;
}

/** Retrigger a deterministic CSS chalk write or erase pass. */
export function markChalkTransition(element, phase, {
  reducedMotion = reducedMotionRequested(),
} = {}) {
  const target = transitionTarget(element);
  if (!PHASES.has(phase)) {
    throw new RangeError(`chalk transition phase must be write, erase, or rewrite; received ${phase}`);
  }
  delete target.dataset.chalkTransition;
  // Reading layout is intentional: consecutive changes must restart the short animation.
  void target.offsetWidth;
  if (!reducedMotion) target.dataset.chalkTransition = phase;
  return target;
}

export function writeChalkText(element, text, options) {
  const target = transitionTarget(element);
  target.textContent = String(text);
  return markChalkTransition(target, 'write', options);
}

/** Replace DOM text, then visibly erase and rewrite the new chalk marks. */
export function rewriteChalkText(element, text, options) {
  const target = transitionTarget(element);
  const next = String(text);
  if (target.textContent === next) return target;
  target.textContent = next;
  return markChalkTransition(target, 'rewrite', options);
}

/**
 * Erase and rewrite a Canvas label (TextLabel, or MathLabel via setTex) with the same pen
 * as the board: the old text is erased right to left (Mobject.reveal 1 → 0), then the new
 * one written left to right, in the phases of the CSS rewrite. The caller supplies render()
 * so paused applications remain visibly animated.
 */
export function rewriteChalkLabel(label, text, {
  duration = CHALK_TIMING.rewriteMs,
  reducedMotion = reducedMotionRequested(),
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  render = () => {},
} = {}) {
  const math = typeof label?.setTex === 'function';
  if (!label || (!math && typeof label.setText !== 'function') || typeof label.setReveal !== 'function') {
    throw new TypeError('chalk label must be a TextLabel or MathLabel');
  }
  const next = String(text);
  const apply = (value) => (math ? label.setTex(value) : label.setText(value));
  if ((math ? label.tex : label.text) === next) return label;
  const active = labelAnimations.get(label);
  if (active !== undefined && typeof cancelFrame === 'function') cancelFrame(active);
  if (reducedMotion || typeof requestFrame !== 'function' || !(duration > 0)) {
    apply(next);
    label.setReveal(1);
    render();
    return label;
  }

  const { eraseEnd, writeStart } = CHALK_TIMING;
  let startedAt = null;
  let replaced = false;
  const tick = (timestamp) => {
    if (startedAt === null) startedAt = timestamp;
    const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / duration));
    if (progress < eraseEnd) {
      label.setReveal(1 - progress / eraseEnd);
    } else {
      if (!replaced) {
        apply(next);
        replaced = true;
      }
      label.setReveal(progress < writeStart ? 0 : (progress - writeStart) / (1 - writeStart));
    }
    render();
    if (progress < 1) {
      labelAnimations.set(label, requestFrame(tick));
    } else {
      labelAnimations.delete(label);
    }
  };
  labelAnimations.set(label, requestFrame(tick));
  return label;
}
