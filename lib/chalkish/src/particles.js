import { Mobject } from './core.js';

const DEFAULT_PALETTE = Object.freeze([
  Object.freeze({ fill: '#f3f0e8', stroke: null, radius: 2, opacity: 0.9 }),
]);

function normalizePalette(palette) {
  if (!Array.isArray(palette) || palette.length === 0 || palette.length > 256) {
    throw new RangeError('palette must contain from 1 to 256 entries');
  }
  return palette.map((entry) => {
    const radius = entry.radius ?? 2;
    const opacity = entry.opacity ?? 1;
    if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('particle radius must be positive');
    if (!Number.isFinite(opacity)) throw new TypeError('particle opacity must be finite');
    return {
      fill: entry.fill ?? '#f3f0e8',
      stroke: entry.stroke ?? null,
      radius,
      opacity: Math.max(0, Math.min(1, opacity)),
      width: entry.width ?? 1,
    };
  });
}

export class ParticleCloud extends Mobject {
  constructor({
    x,
    y,
    count = x?.length ?? 0,
    styleIndex = null,
    radius = null,
    palette = DEFAULT_PALETTE,
    shape = 'circle',
    ...options
  } = {}) {
    super('particle-cloud', options);
    if (!x || !y || typeof x.length !== 'number' || typeof y.length !== 'number') {
      throw new TypeError('x and y array-like buffers are required');
    }
    this.positionsX = x;
    this.positionsY = y;
    this.styleIndex = styleIndex;
    this.radius = radius;
    this.palette = normalizePalette(palette);
    this.shape = shape;
    this.count = 0;
    this.dataVersion = 0;
    this.setCount(count);
  }

  get capacity() {
    return Math.min(this.positionsX.length, this.positionsY.length);
  }

  setCount(count) {
    if (!Number.isInteger(count) || count < 0 || count > this.capacity) {
      throw new RangeError(`particle count must be an integer from 0 to ${this.capacity}`);
    }
    if (this.styleIndex && this.styleIndex.length < count) {
      throw new RangeError('styleIndex must cover the active particle range');
    }
    if (this.radius && typeof this.radius !== 'number' && this.radius.length < count) {
      throw new RangeError('radius buffer must cover the active particle range');
    }
    this.count = count;
    return this.markDataDirty();
  }

  setBuffers({ x = this.positionsX, y = this.positionsY, styleIndex = this.styleIndex, radius = this.radius } = {}) {
    this.positionsX = x;
    this.positionsY = y;
    this.styleIndex = styleIndex;
    this.radius = radius;
    if (this.count > this.capacity) this.count = this.capacity;
    if (this.styleIndex && this.styleIndex.length < this.count) {
      throw new RangeError('styleIndex must cover the active particle range');
    }
    return this.markDataDirty();
  }

  setPalette(palette) {
    this.palette = normalizePalette(palette);
    return this.markDataDirty();
  }

  markDataDirty() {
    this.dataVersion += 1;
    return this;
  }
}

export function forEachVisibleParticle(cloud, bounds, stride = 1, callback) {
  if (!(cloud instanceof ParticleCloud)) throw new TypeError('cloud must be a ParticleCloud');
  if (!Number.isInteger(stride) || stride < 1) throw new RangeError('stride must be a positive integer');
  if (typeof callback !== 'function') throw new TypeError('callback must be a function');
  let visible = 0;
  for (let index = 0; index < cloud.count; index += stride) {
    const x = cloud.positionsX[index];
    const y = cloud.positionsY[index];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue;
    callback(index, x, y);
    visible += 1;
  }
  return visible;
}
