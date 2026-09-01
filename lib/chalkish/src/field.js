import { Mobject } from './core.js';
import { clamp } from './math.js';

function parseHexColor(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    if (value.length < 3 || value.length > 4) throw new RangeError('color arrays need 3 or 4 channels');
    return [
      clamp(Math.round(value[0]), 0, 255),
      clamp(Math.round(value[1]), 0, 255),
      clamp(Math.round(value[2]), 0, 255),
      value.length === 4 ? clamp(Math.round(value[3]), 0, 255) : 255,
    ];
  }
  if (typeof value !== 'string' || value[0] !== '#') {
    throw new TypeError('colors must use #rgb, #rgba, #rrggbb, or #rrggbbaa notation');
  }
  const hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    return [
      Number.parseInt(hex[0] + hex[0], 16),
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
      hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) : 255,
    ];
  }
  if (hex.length === 6 || hex.length === 8) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
    ];
  }
  throw new RangeError(`invalid hex color: ${value}`);
}

export const COLORMAP_STOPS = Object.freeze({
  chalk: Object.freeze([
    Object.freeze([0, '#18231f']),
    Object.freeze([0.35, '#54776c']),
    Object.freeze([0.7, '#c8d8c7']),
    Object.freeze([1, '#fff8df']),
  ]),
  thermal: Object.freeze([
    Object.freeze([0, '#11132b']),
    Object.freeze([0.3, '#4d2a7a']),
    Object.freeze([0.6, '#d4533d']),
    Object.freeze([0.82, '#f2b84b']),
    Object.freeze([1, '#fff4bd']),
  ]),
  diverging: Object.freeze([
    Object.freeze([0, '#386cb0']),
    Object.freeze([0.5, '#f7f7f2']),
    Object.freeze([1, '#c43c39']),
  ]),
});

export function makeColorLut(stops, size = 256) {
  if (!Array.isArray(stops) || stops.length < 2) {
    throw new TypeError('stops must contain at least two [position, color] entries');
  }
  if (!Number.isInteger(size) || size < 2 || size > 65536) {
    throw new RangeError('size must be an integer from 2 to 65536');
  }

  const parsed = stops
    .map(([position, color]) => {
      if (!Number.isFinite(position)) throw new TypeError('stop positions must be finite');
      return [clamp(position, 0, 1), parseHexColor(color)];
    })
    .sort((a, b) => a[0] - b[0]);

  const lut = new Uint8ClampedArray(size * 4);
  let segment = 0;
  for (let index = 0; index < size; index += 1) {
    const t = index / (size - 1);
    while (segment < parsed.length - 2 && t > parsed[segment + 1][0]) segment += 1;
    const left = parsed[segment];
    const right = parsed[segment + 1];
    const local = right[0] === left[0]
      ? 0
      : clamp((t - left[0]) / (right[0] - left[0]), 0, 1);
    const offset = index * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      lut[offset + channel] = Math.round(left[1][channel]
        + (right[1][channel] - left[1][channel]) * local);
    }
  }
  return lut;
}

export const COLORMAPS = Object.freeze({
  chalk: makeColorLut(COLORMAP_STOPS.chalk),
  thermal: makeColorLut(COLORMAP_STOPS.thermal),
  diverging: makeColorLut(COLORMAP_STOPS.diverging),
});

export function finiteRange(data) {
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index < data.length; index += 1) {
    const value = data[index];
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return min === Infinity ? [0, 1] : min === max ? [min - 0.5, max + 0.5] : [min, max];
}

export function mapScalarToRgba(data, rgba, lut, min, max, invalid = [0, 0, 0, 0]) {
  if (!data || !rgba || !lut) throw new TypeError('data, rgba, and lut are required');
  if (rgba.length < data.length * 4) throw new RangeError('rgba output buffer is too small');
  if (lut.length < 8 || lut.length % 4 !== 0) throw new RangeError('lut must contain at least two RGBA colors');
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    throw new RangeError('range must satisfy finite min < max');
  }
  const lutSize = lut.length / 4;
  const inverseRange = 1 / (max - min);

  for (let index = 0; index < data.length; index += 1) {
    const value = data[index];
    const output = index * 4;
    if (!Number.isFinite(value)) {
      rgba[output] = invalid[0];
      rgba[output + 1] = invalid[1];
      rgba[output + 2] = invalid[2];
      rgba[output + 3] = invalid[3];
      continue;
    }
    const t = clamp((value - min) * inverseRange, 0, 1);
    const color = Math.round(t * (lutSize - 1)) * 4;
    rgba[output] = lut[color];
    rgba[output + 1] = lut[color + 1];
    rgba[output + 2] = lut[color + 2];
    rgba[output + 3] = lut[color + 3];
  }
  return rgba;
}

export class ScalarField extends Mobject {
  constructor(data, columns, rows, options = {}) {
    super('scalar-field', options);
    if (!Number.isInteger(columns) || columns <= 0) throw new RangeError('columns must be positive');
    if (!Number.isInteger(rows) || rows <= 0) throw new RangeError('rows must be positive');
    if (!data || data.length !== columns * rows) {
      throw new RangeError(`data length must equal columns * rows (${columns * rows})`);
    }
    this.columns = columns;
    this.rows = rows;
    this.data = options.copy === true ? Float32Array.from(data) : data;
    this.domain = {
      minX: options.minX ?? -1,
      minY: options.minY ?? -1,
      maxX: options.maxX ?? 1,
      maxY: options.maxY ?? 1,
    };
    this.min = options.min ?? null;
    this.max = options.max ?? null;
    this.lut = options.lut ?? COLORMAPS.chalk;
    this.invalidColor = options.invalidColor ?? [0, 0, 0, 0];
    this.interpolation = options.interpolation ?? 'linear';
    this.dataVersion = 0;
  }

  setData(data, { copy = false } = {}) {
    if (!data || data.length !== this.columns * this.rows) {
      throw new RangeError(`data length must equal ${this.columns * this.rows}`);
    }
    this.data = copy ? Float32Array.from(data) : data;
    return this.markDataDirty();
  }

  markDataDirty() {
    this.dataVersion += 1;
    return this;
  }

  setRange(min, max) {
    if (min === null || max === null) {
      this.min = null;
      this.max = null;
      return this.markDataDirty();
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      throw new RangeError('range must satisfy finite min < max');
    }
    this.min = min;
    this.max = max;
    return this.markDataDirty();
  }

  setColorMap(lut) {
    if (!lut || lut.length < 8 || lut.length % 4 !== 0) {
      throw new RangeError('lut must contain at least two RGBA colors');
    }
    this.lut = lut;
    return this.markDataDirty();
  }
}
