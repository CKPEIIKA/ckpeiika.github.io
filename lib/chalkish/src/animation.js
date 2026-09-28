import { clamp, lerp } from './math.js';
import { Group, Mobject, Polyline } from './core.js';
import { CurveLayer } from './curve.js';

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

function drawnLeaves(target, out = []) {
  if (Array.isArray(target)) {
    for (const item of target) drawnLeaves(item, out);
  } else if (target instanceof Group) {
    for (const child of target.sortedChildren()) drawnLeaves(child, out);
  } else if (target instanceof Mobject) {
    if (!(target instanceof ValueTracker)) out.push(target);
  } else {
    throw new TypeError('Write needs a Mobject, a Group or an array of them');
  }
  return out;
}

// Writes objects onto the board as a hand would: each leaf is drawn from 0 to 1 of its
// length (Mobject.reveal), one after another with an overlap of `1 - lag` (Manim's
// lag_ratio). reverse: true erases in the opposite order (Unwrite).
export class Write extends Animation {
  constructor(target, { lag = 0.15, ease = easing.smooth, reverse = false, ...options } = {}) {
    super(options);
    if (!(Number.isFinite(lag) && lag >= 0 && lag <= 1)) throw new RangeError('lag must be between 0 and 1');
    if (typeof ease !== 'function') throw new TypeError('ease must be a function');
    this.leaves = drawnLeaves(target);
    this.lag = lag;
    this.ease = ease;
    this.reverse = reverse;
  }

  onStart() {
    for (const leaf of this.leaves) leaf.reveal = this.reverse ? 1 : 0;
  }

  onUpdate(t) {
    const count = this.leaves.length;
    if (!count) return;
    const progress = this.ease(t);
    // Each leaf takes `span` of the total; leaf i starts at i · lag · span.
    const span = 1 / (1 + (count - 1) * this.lag);
    for (let index = 0; index < count; index += 1) {
      const order = this.reverse ? count - 1 - index : index;
      const local = Math.min(1, Math.max(0, (progress - order * this.lag * span) / span));
      this.leaves[index].reveal = this.reverse ? 1 - local : local;
    }
  }
}

export class Unwrite extends Write {
  constructor(target, options = {}) {
    super(target, { ...options, reverse: true });
  }
}

export function write(target, options) {
  return new Write(target, options);
}

export function unwrite(target, options) {
  return new Unwrite(target, options);
}

// ---------- morphing, fading and highlighting ----------

// A shape's points as packed [x0, y0, x1, y1, …] in its own coordinates.
function shapePoints(shape) {
  if (shape instanceof CurveLayer) {
    const out = new Float64Array(shape.count * 2);
    for (let index = 0; index < shape.count; index += 1) {
      out[index * 2] = shape.positionsX[index];
      out[index * 2 + 1] = shape.positionsY[index];
    }
    return out;
  }
  if (shape instanceof Polyline) return Float64Array.from(shape.points);
  if (ArrayBuffer.isView(shape) || Array.isArray(shape)) return Float64Array.from(shape);
  throw new TypeError('Transform works on lines, polylines, arrows and curve layers');
}

// `count` points spaced evenly along a polyline's length.
function resample(points, count) {
  const n = points.length / 2;
  if (n === count) return points;
  const lengths = [0];
  for (let index = 1; index < n; index += 1) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index * 2] - points[index * 2 - 2], points[index * 2 + 1] - points[index * 2 - 1]));
  }
  const total = lengths[n - 1];
  const out = new Float64Array(count * 2);
  let segment = 0;
  for (let index = 0; index < count; index += 1) {
    const at = count === 1 ? 0 : total * index / (count - 1);
    while (segment < n - 2 && lengths[segment + 1] < at) segment += 1;
    const span = lengths[segment + 1] - lengths[segment];
    const t = n === 1 || span === 0 ? 0 : (at - lengths[segment]) / span;
    const next = Math.min(n - 1, segment + 1);
    out[index * 2] = lerp(points[segment * 2], points[next * 2], t);
    out[index * 2 + 1] = lerp(points[segment * 2 + 1], points[next * 2 + 1], t);
  }
  return out;
}

function parseColor(value) {
  const match = typeof value === 'string' && /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, '$&$&') : match[1];
  return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}

function mixColor(from, to, t) {
  const a = parseColor(from), b = parseColor(to);
  if (!a || !b) return t < 0.5 ? from : to;
  return `#${a.map((value, index) => Math.round(lerp(value, b[index], t)).toString(16).padStart(2, '0')).join('')}`;
}

// Morphs `source` into the shape of `target` (another shape or packed points), resampled
// along its length; the stroke colour blends too. The source object is changed in place.
export class Transform extends Animation {
  constructor(source, target, { ease = easing.inOutCubic, ...options } = {}) {
    super(options);
    if (!(source instanceof CurveLayer || source instanceof Polyline)) throw new TypeError('Transform works on lines, polylines, arrows and curve layers');
    if (typeof ease !== 'function') throw new TypeError('ease must be a function');
    shapePoints(target);
    this.source = source;
    this.target = target;
    this.ease = ease;
  }

  onStart() {
    const from = shapePoints(this.source);
    const to = shapePoints(this.target);
    // Lines and arrows keep their two points; other shapes take the finer resolution.
    const fixed = this.source.kind === 'line' || this.source.kind === 'arrow';
    const count = fixed ? from.length / 2 : Math.max(from.length, to.length) / 2;
    this.from = resample(from, count);
    this.to = resample(to, count);
    if (this.source instanceof CurveLayer && this.source.capacity < count) {
      this.source.setBuffers({ x: new Float32Array(count), y: new Float32Array(count), count });
    } else if (this.source instanceof CurveLayer) {
      this.source.setCount(count);
    } else if (!fixed && this.source.points.length !== count * 2) {
      this.source.setPoints(new Float32Array(count * 2), { copy: false });
    }
    this.strokeFrom = this.source.style.stroke;
    this.strokeTo = this.target instanceof Mobject ? this.target.style.stroke : this.strokeFrom;
  }

  onUpdate(t) {
    const e = this.ease(t);
    const count = this.from.length / 2;
    for (let index = 0; index < count; index += 1) {
      const x = lerp(this.from[index * 2], this.to[index * 2], e);
      const y = lerp(this.from[index * 2 + 1], this.to[index * 2 + 1], e);
      if (this.source instanceof CurveLayer) {
        this.source.positionsX[index] = x;
        this.source.positionsY[index] = y;
      } else {
        this.source.points[index * 2] = x;
        this.source.points[index * 2 + 1] = y;
      }
    }
    if (this.source instanceof CurveLayer) this.source.markDataDirty();
    else this.source.markGeometryDirty();
    if (this.strokeFrom !== this.strokeTo) this.source.setStyle({ stroke: mixColor(this.strokeFrom, this.strokeTo, e) });
  }
}

// Opacity from 0 to the object's own opacity, optionally drifting in by `shift` [dx, dy].
export class FadeIn extends Animation {
  constructor(target, { shift = [0, 0], ease = easing.smooth, out = false, ...options } = {}) {
    super(options);
    if (!(target instanceof Mobject)) throw new TypeError('FadeIn needs a Mobject');
    if (!Array.isArray(shift) || shift.length !== 2 || !shift.every(Number.isFinite)) throw new TypeError('shift must be [dx, dy]');
    Object.assign(this, { target, shift, ease, out });
  }

  onStart() {
    this.opacity = this.target.opacity;
    this.x = this.target.x;
    this.y = this.target.y;
    if (!this.out) this.target.visible = true;
  }

  onUpdate(t) {
    const e = this.ease(t);
    const visible = this.out ? 1 - e : e;
    const away = 1 - visible;
    this.target.opacity = this.opacity * visible;
    this.target.setPosition(this.x + (this.out ? this.shift[0] * e : -this.shift[0] * away), this.y + (this.out ? this.shift[1] * e : -this.shift[1] * away));
  }

  onFinish() {
    // A faded-out object keeps its opacity setting but is hidden; its place is restored.
    if (this.out) {
      this.target.visible = false;
      this.target.opacity = this.opacity;
      this.target.setPosition(this.x, this.y);
    }
  }
}

export class FadeOut extends FadeIn {
  constructor(target, options = {}) {
    super(target, { ...options, out: true });
  }
}

function centerOf(object) {
  if (object instanceof Group) {
    const centers = object.children.map(centerOf);
    if (!centers.length) return [object.x, object.y];
    const [sx, sy] = centers.reduce(([a, b], [c, d]) => [a + c, b + d], [0, 0]);
    return [object.x + object.scaleX * sx / centers.length, object.y + object.scaleY * sy / centers.length];
  }
  let points = null;
  if (object instanceof Polyline || object instanceof CurveLayer) points = shapePoints(object);
  if (!points || !points.length) return [object.x, object.y];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let index = 0; index < points.length; index += 2) {
    minX = Math.min(minX, points[index]); maxX = Math.max(maxX, points[index]);
    minY = Math.min(minY, points[index + 1]); maxY = Math.max(maxY, points[index + 1]);
  }
  return [object.x + object.scaleX * (minX + maxX) / 2, object.y + object.scaleY * (minY + maxY) / 2];
}

// Draws attention: the object swells by `scale` about its centre and takes `color`, then
// returns exactly to how it was.
export class Indicate extends Animation {
  constructor(target, { scale = 1.2, color = '#f0d477', ...options } = {}) {
    super(options);
    if (!(target instanceof Mobject)) throw new TypeError('Indicate needs a Mobject');
    if (!(Number.isFinite(scale) && scale > 0)) throw new RangeError('scale must be positive');
    Object.assign(this, { target, scale, color });
  }

  onStart() {
    const target = this.target;
    this.saved = { x: target.x, y: target.y, scaleX: target.scaleX, scaleY: target.scaleY };
    this.center = centerOf(target);
    this.leaves = target instanceof Group ? drawnLeaves(target) : [target];
    this.styles = this.leaves.map(leaf => ({ stroke: leaf.style.stroke, fill: leaf.style.fill }));
  }

  onUpdate(t) {
    const pulse = Math.sin(Math.PI * t); // there and back
    const k = 1 + (this.scale - 1) * pulse;
    const { x, y, scaleX, scaleY } = this.saved;
    const target = this.target;
    target.setPosition(this.center[0] + k * (x - this.center[0]), this.center[1] + k * (y - this.center[1]));
    target.scaleX = scaleX * k;
    target.scaleY = scaleY * k;
    target._transformVersion += 1;
    this.leaves.forEach((leaf, index) => {
      const saved = this.styles[index];
      leaf.setStyle({
        stroke: saved.stroke ? mixColor(saved.stroke, this.color, pulse) : saved.stroke,
        fill: saved.fill ? mixColor(saved.fill, this.color, pulse) : saved.fill,
      });
    });
  }

  onFinish() {
    Object.assign(this.target, this.saved);
    this.target._transformVersion += 1;
    this.leaves.forEach((leaf, index) => leaf.setStyle(this.styles[index]));
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
