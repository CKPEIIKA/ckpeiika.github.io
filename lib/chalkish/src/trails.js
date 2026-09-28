// Fading trails behind moving points (particles, tracers): the last `length` positions of
// each point in a ring buffer, drawn as chalk segments whose opacity falls with age
// (`shades` layers, newest brightest). A step longer than maxJump (a periodic wrap, a
// respawn) breaks the trail instead of drawing a line across the domain.

import { Group } from './core.js';
import { SegmentLayer } from './segments.js';

export class TrailLayer extends Group {
  constructor({ length = 20, shades = 4, maxJump = Infinity, style = {}, ...options } = {}) {
    super([], options);
    if (!(Number.isInteger(length) && length >= 2)) throw new RangeError('length must be an integer of at least 2');
    if (!(Number.isInteger(shades) && shades >= 1)) throw new RangeError('shades must be a positive integer');
    if (!(maxJump > 0)) throw new RangeError('maxJump must be positive');
    Object.assign(this, { length, shades, maxJump });
    const opacity = style.opacity ?? 1;
    // Layer k: older trail parts first (faint), the newest last (full opacity).
    this.layers = Array.from({ length: shades }, (_, k) => new SegmentLayer({
      segments: new Float32Array(0),
      style: { ...style, opacity: opacity * (k + 1) / shades },
    }));
    this.add(...this.layers);
    this.points = 0;
    this.history = new Float32Array(0);
    this.head = 0;
    this.filled = 0;
  }

  // Records the current positions of the first `count` points and redraws the trails.
  // A different count starts the trails afresh.
  push(x, y, count = x.length) {
    if (!(Number.isInteger(count) && count >= 0 && count <= x.length && count <= y.length)) throw new RangeError('count must fit the position arrays');
    if (count !== this.points) {
      this.points = count;
      this.history = new Float32Array(this.length * count * 2);
      this.head = 0;
      this.filled = 0;
    }
    const base = this.head * count * 2;
    for (let i = 0; i < count; i += 1) {
      this.history[base + i * 2] = x[i];
      this.history[base + i * 2 + 1] = y[i];
    }
    this.head = (this.head + 1) % this.length;
    this.filled = Math.min(this.filled + 1, this.length);
    this.redraw();
    return this;
  }

  clear() {
    this.head = 0;
    this.filled = 0;
    this.redraw();
    return this;
  }

  redraw() {
    const count = this.points, buckets = Array.from({ length: this.shades }, () => []);
    const slot = (age) => ((this.head - 1 - age) % this.length + this.length) % this.length;
    for (let age = 0; age < this.filled - 1; age += 1) {
      // age 0 is the newest segment; the oldest ones land in the faintest layer.
      const shade = this.shades - 1 - Math.min(this.shades - 1, Math.floor(age * this.shades / (this.length - 1)));
      const newer = slot(age) * count * 2, older = slot(age + 1) * count * 2;
      for (let i = 0; i < count; i += 1) {
        const x0 = this.history[older + i * 2], y0 = this.history[older + i * 2 + 1];
        const x1 = this.history[newer + i * 2], y1 = this.history[newer + i * 2 + 1];
        if (!Number.isFinite(x0 + y0 + x1 + y1) || Math.hypot(x1 - x0, y1 - y0) > this.maxJump) continue;
        buckets[shade].push(x0, y0, x1, y1);
      }
    }
    buckets.forEach((segments, k) => this.layers[k].setSegments(Float32Array.from(segments), { copy: false }));
  }

  get count() {
    return this.layers.reduce((sum, layer) => sum + layer.count, 0);
  }
}
