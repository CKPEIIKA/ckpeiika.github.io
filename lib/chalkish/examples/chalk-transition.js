const PHASES = new Set(['write', 'erase']);

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
    throw new RangeError(`chalk transition phase must be write or erase; received ${phase}`);
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
