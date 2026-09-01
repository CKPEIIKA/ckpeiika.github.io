/** Small numeric helpers. No hidden allocations in hot-path functions. */

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function inverseLerp(a, b, value) {
  return a === b ? 0 : (value - a) / (b - a);
}

export function hash32(value) {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

export function random01(index, seed = 0) {
  return hash32((index | 0) ^ (seed | 0)) / 0x100000000;
}

export function createRng(seed = 0x9e3779b9) {
  let state = (seed | 0) || 0x6d2b79f5;
  return function nextRandom() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export function nextPowerOfTwo(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('value must be a non-negative safe integer');
  }
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

/**
 * Compose an affine matrix [a,b,c,d,e,f] using Canvas2D conventions.
 * The transform is translation * rotation * scale.
 */
export function compose2D(out, x, y, scaleX, scaleY, rotation) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  out[0] = cosine * scaleX;
  out[1] = sine * scaleX;
  out[2] = -sine * scaleY;
  out[3] = cosine * scaleY;
  out[4] = x;
  out[5] = y;
  return out;
}

/** out = left * right. Aliasing with either input is supported. */
export function multiply2D(out, left, right) {
  const la = left[0];
  const lb = left[1];
  const lc = left[2];
  const ld = left[3];
  const le = left[4];
  const lf = left[5];
  const ra = right[0];
  const rb = right[1];
  const rc = right[2];
  const rd = right[3];
  const re = right[4];
  const rf = right[5];

  out[0] = la * ra + lc * rb;
  out[1] = lb * ra + ld * rb;
  out[2] = la * rc + lc * rd;
  out[3] = lb * rc + ld * rd;
  out[4] = la * re + lc * rf + le;
  out[5] = lb * re + ld * rf + lf;
  return out;
}

export function apply2D(out, matrix, x, y) {
  out[0] = matrix[0] * x + matrix[2] * y + matrix[4];
  out[1] = matrix[1] * x + matrix[3] * y + matrix[5];
  return out;
}

export function invert2D(out, matrix) {
  const a = matrix[0];
  const b = matrix[1];
  const c = matrix[2];
  const d = matrix[3];
  const e = matrix[4];
  const f = matrix[5];
  const determinant = a * d - b * c;
  if (Math.abs(determinant) <= Number.EPSILON) return null;

  const inverse = 1 / determinant;
  out[0] = d * inverse;
  out[1] = -b * inverse;
  out[2] = -c * inverse;
  out[3] = a * inverse;
  out[4] = (c * f - d * e) * inverse;
  out[5] = (b * e - a * f) * inverse;
  return out;
}

export function matrixScaleMagnitude(matrix) {
  const xScale = Math.hypot(matrix[0], matrix[1]);
  const yScale = Math.hypot(matrix[2], matrix[3]);
  return Math.sqrt(xScale * yScale);
}

export function assertFinite(value, name = 'value') {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
}

export function assertPositive(value, name = 'value') {
  assertFinite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero`);
  return value;
}
