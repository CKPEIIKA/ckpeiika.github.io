import { clamp, lerp } from './math.js';
import { Mobject } from './core.js';

export const easing = Object.freeze({
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutCubic: (t) => (t < 0.5
    ? 4 * t * t * t
    : 1 - ((-2 * t + 2) ** 3) / 2),
  smooth: (t) => t * t * (3 - 2 * t),
});

export class ValueTracker extends Mobject {
  constructor(value = 0, options = {}) {
    if (!Number.isFinite(value)) throw new TypeError('value must be finite');
    super('value-tracker', { ...options, visible: false });
    this.value = value;
  }

  getValue() { return this.value; }

  setValue(value) {
    if (!Number.isFinite(value)) throw new TypeError('value must be finite. No tracker state was changed.');
    this.value = value;
    return this;
  }

  incrementValue(delta) {
    if (!Number.isFinite(delta) || !Number.isFinite(this.value + delta)) throw new TypeError('tracker increment must remain finite. No tracker state was changed.');
    this.value += delta;
    return this;
  }
}

export class Animation {
  constructor({ duration = 1, delay = 0 } = {}) {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new RangeError('duration must be a non-negative finite number');
    }
    if (!Number.isFinite(delay) || delay < 0) {
      throw new RangeError('delay must be a non-negative finite number');
    }
    this.duration = duration;
    this.delay = delay;
    this.elapsed = 0;
    this.started = false;
    this.done = false;
  }

  onStart() {}
  onUpdate(_t) {}
  onFinish() {}

  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be non-negative and finite');
    if (this.done) return dt;

    const previous = this.elapsed;
    const total = this.delay + this.duration;
    const next = previous + dt;

    if (!this.started && next >= this.delay) {
      this.started = true;
      this.onStart();
    }

    this.elapsed = Math.min(next, total);
    if (this.started) {
      const t = this.duration === 0
        ? 1
        : clamp((this.elapsed - this.delay) / this.duration, 0, 1);
      this.onUpdate(t);
    }

    if (next >= total) {
      this.done = true;
      this.onFinish();
      return next - total;
    }
    return 0;
  }

  finish() {
    if (!this.done) this.advance(this.delay + this.duration - this.elapsed);
    return this;
  }
}

function markTweenedTarget(target, properties) {
  let transformChanged = false;
  let styleChanged = false;
  for (const property of properties) {
    if (property === 'x'
      || property === 'y'
      || property === 'scaleX'
      || property === 'scaleY'
      || property === 'rotation') {
      transformChanged = true;
    } else if (property === 'opacity') {
      styleChanged = true;
    }
  }
  if (transformChanged && Number.isInteger(target._transformVersion)) {
    target._transformVersion += 1;
  }
  if (styleChanged && Number.isInteger(target._styleVersion)) {
    target._styleVersion += 1;
  }
}

export class Tween extends Animation {
  constructor(target, to, options = {}) {
    super(options);
    if (!target || typeof target !== 'object') throw new TypeError('target must be an object');
    if (!to || typeof to !== 'object') throw new TypeError('to must be an object');
    this.target = target;
    this.to = { ...to };
    this.from = Object.create(null);
    this.properties = Object.keys(to);
    this.ease = options.ease ?? easing.inOutCubic;
    if (typeof this.ease !== 'function') throw new TypeError('ease must be a function');
    this.afterUpdate = options.onUpdate ?? null;
  }

  onStart() {
    for (const property of this.properties) {
      const start = this.target[property];
      const end = this.to[property];
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new TypeError(`Tween property ${property} must have finite numeric endpoints`);
      }
      this.from[property] = start;
    }
  }

  onUpdate(t) {
    const eased = this.ease(t);
    for (const property of this.properties) {
      this.target[property] = lerp(this.from[property], this.to[property], eased);
    }
    markTweenedTarget(this.target, this.properties);
    if (this.afterUpdate) this.afterUpdate(this.target, eased);
  }
}

export class Sequence {
  constructor(animations = []) {
    if (!Array.isArray(animations)) throw new TypeError('animations must be an array');
    this.animations = animations;
    this.index = 0;
    this.done = animations.length === 0;
  }

  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be non-negative and finite');
    if (this.done) return dt;

    let remaining = dt;
    while (this.index < this.animations.length) {
      const current = this.animations[this.index];
      remaining = current.advance(remaining);
      if (!current.done) return 0;
      this.index += 1;
      if (remaining <= 0) break;
    }

    if (this.index >= this.animations.length) this.done = true;
    return this.done ? remaining : 0;
  }
}

export class Parallel {
  constructor(animations = []) {
    if (!Array.isArray(animations)) throw new TypeError('animations must be an array');
    this.animations = animations;
    this.done = animations.length === 0;
  }

  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be non-negative and finite');
    if (this.done) return dt;

    let minimumLeftover = dt;
    let allDone = true;
    for (const animation of this.animations) {
      const leftover = animation.advance(dt);
      minimumLeftover = Math.min(minimumLeftover, leftover);
      allDone = allDone && animation.done;
    }
    this.done = allDone;
    return allDone ? minimumLeftover : 0;
  }
}

export function tween(target, to, options) {
  return new Tween(target, to, options);
}

export function sequence(...animations) {
  return new Sequence(animations.flat());
}

export function parallel(...animations) {
  return new Parallel(animations.flat());
}
