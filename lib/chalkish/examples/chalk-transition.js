const PHASES = new Set(['write', 'erase', 'rewrite']);
const labelAnimations = new WeakMap();

function reducedMotionRequested(matchMedia = globalThis.matchMedia) {
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
 * Erase and rewrite a Canvas TextLabel one character at a time.
 * The caller supplies render() so paused applications remain visibly animated.
 */
export function rewriteChalkLabel(label, text, {
  duration = 1600,
  reducedMotion = reducedMotionRequested(),
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  render = () => {},
} = {}) {
  if (!label || typeof label.setText !== 'function') {
    throw new TypeError('chalk label must provide setText()');
  }
  const next = String(text);
  if (label.text === next) return label;
  const active = labelAnimations.get(label);
  if (active !== undefined && typeof cancelFrame === 'function') cancelFrame(active);
  if (reducedMotion || typeof requestFrame !== 'function' || !(duration > 0)) {
    label.setText(next);
    render();
    return label;
  }

  const previous = String(label.text ?? '');
  let startedAt = null;
  const tick = (timestamp) => {
    if (startedAt === null) startedAt = timestamp;
    const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / duration));
    let visible;
    if (progress < 0.42) {
      const remaining = Math.ceil(previous.length * (1 - progress / 0.42));
      visible = previous.slice(0, remaining);
    } else if (progress < 0.52) {
      visible = '';
    } else {
      const written = Math.floor(next.length * (progress - 0.52) / 0.48);
      visible = next.slice(0, written);
    }
    label.setText(progress === 1 ? next : visible);
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
