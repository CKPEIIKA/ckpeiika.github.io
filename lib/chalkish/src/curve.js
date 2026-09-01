import { Mobject } from './core.js';

function requireBuffers(x, y) {
  if (!x || !y || typeof x.length !== 'number' || typeof y.length !== 'number') {
    throw new TypeError('CurveLayer x and y array-like buffers are required');
  }
}

function validateCount(count, capacity) {
  if (!Number.isInteger(count) || count < 0 || count > capacity) {
    throw new RangeError(
      `CurveLayer count is ${count}; expected an integer from 0 to ${capacity}. `
      + 'No curve state was changed.',
    );
  }
}

/**
 * Dense curve backed by separate x/y arrays.
 *
 * Buffers are bound by reference and remain caller-owned. Mutate them in place,
 * then call markDataDirty(). The renderer emits one path rather than one scene
 * object per sample.
 */
export class CurveLayer extends Mobject {
  constructor({
    x,
    y,
    count = x?.length ?? 0,
    ...options
  } = {}) {
    super('curve-layer', options);
    requireBuffers(x, y);
    const capacity = Math.min(x.length, y.length);
    validateCount(count, capacity);
    this.positionsX = x;
    this.positionsY = y;
    this.count = count;
    this.dataVersion = 1;
  }

  get capacity() {
    return Math.min(this.positionsX.length, this.positionsY.length);
  }

  setCount(count) {
    validateCount(count, this.capacity);
    this.count = count;
    return this.markDataDirty();
  }

  setBuffers({
    x = this.positionsX,
    y = this.positionsY,
    count = this.count,
  } = {}) {
    requireBuffers(x, y);
    const capacity = Math.min(x.length, y.length);
    validateCount(count, capacity);
    this.positionsX = x;
    this.positionsY = y;
    this.count = count;
    return this.markDataDirty();
  }

  markDataDirty() {
    this.dataVersion += 1;
    return this;
  }
}
