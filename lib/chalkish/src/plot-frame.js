// The arithmetic of a scientific plot, without drawing: data ↔ target coordinates on
// linear or logarithmic axes, readable ticks, and polylines clipped to the frame.
// Target coordinates are whatever the caller draws in (board units, world units); the
// frame only needs where the data ranges land: xRange → [left, right] and
// yRange → [bottom, top], so "up" may be either sign.

import { formatTick, niceTicks } from './ticks.js';

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

function checkRange(range, scale, name) {
  if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || !(range[0] < range[1])) {
    throw new RangeError(`${name} must be [min, max] with min < max`);
  }
  if (scale === 'log' && !(range[0] > 0)) throw new RangeError(`${name} must be positive on a log axis`);
  if (scale !== 'linear' && scale !== 'log') throw new RangeError(`${name.slice(0, 1)}Scale must be linear or log`);
}

// 10⁻³ style label for a power of ten.
export function formatPower(exponent) {
  return `10${Array.from(String(exponent)).map(character => SUPERSCRIPT[character]).join('')}`;
}

export class PlotFrame {
  constructor({ left, right, bottom, top, xRange, yRange, xScale = 'linear', yScale = 'linear' }) {
    for (const [value, name] of [[left, 'left'], [right, 'right'], [bottom, 'bottom'], [top, 'top']]) {
      if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
    }
    if (left === right || bottom === top) throw new RangeError('the frame must have a nonzero size');
    checkRange(xRange, xScale, 'xRange');
    checkRange(yRange, yScale, 'yRange');
    Object.assign(this, { left, right, bottom, top, xScale, yScale });
    this.xRange = [...xRange];
    this.yRange = [...yRange];
  }

  // Position of a value along an axis as a fraction 0…1 (NaN when it cannot be shown).
  fraction(axis, value) {
    const [min, max] = axis === 'x' ? this.xRange : this.yRange;
    if (!Number.isFinite(value)) return Number.NaN;
    if ((axis === 'x' ? this.xScale : this.yScale) === 'log') {
      return value > 0 ? Math.log(value / min) / Math.log(max / min) : Number.NaN;
    }
    return (value - min) / (max - min);
  }

  valueAt(axis, fraction) {
    const [min, max] = axis === 'x' ? this.xRange : this.yRange;
    return (axis === 'x' ? this.xScale : this.yScale) === 'log'
      ? min * (max / min) ** fraction
      : min + fraction * (max - min);
  }

  x(value) { return this.left + this.fraction('x', value) * (this.right - this.left); }
  y(value) { return this.bottom + this.fraction('y', value) * (this.top - this.bottom); }

  // Target coordinates back to data values.
  value(px, py) {
    return [
      this.valueAt('x', (px - this.left) / (this.right - this.left)),
      this.valueAt('y', (py - this.bottom) / (this.top - this.bottom)),
    ];
  }

  contains(px, py) {
    return px >= Math.min(this.left, this.right) && px <= Math.max(this.left, this.right)
      && py >= Math.min(this.bottom, this.top) && py <= Math.max(this.bottom, this.top);
  }

  // Ticks as [{ value, label, position, priority }]: a number asks for about that many
  // intervals at round values (decades on a log axis); an array gives values or
  // [value, label] pairs. Priority 0 ticks (every other one) should survive crowding.
  ticks(axis, spec = 4, format = formatTick) {
    const [min, max] = axis === 'x' ? this.xRange : this.yRange;
    const position = value => (axis === 'x' ? this.x(value) : this.y(value));
    const inside = value => value >= min - Math.abs(max - min) * 1e-9 && value <= max + Math.abs(max - min) * 1e-9;
    if (Array.isArray(spec)) {
      return spec
        .map(entry => (Array.isArray(entry) ? entry : [entry, format(entry, 0)]))
        .filter(([value]) => Number.isFinite(value) && inside(value))
        .map(([value, label], index) => ({ value, label: String(label), position: position(value), priority: index % 2 }));
    }
    if (!(spec > 0)) return [];
    const count = Math.max(1, Math.round(spec));
    if ((axis === 'x' ? this.xScale : this.yScale) === 'log') {
      const low = Math.ceil(Math.log10(min) - 1e-9);
      const high = Math.floor(Math.log10(max) + 1e-9);
      if (high - low >= 1) {
        const step = Math.max(1, Math.ceil((high - low) / count));
        const ticks = [];
        for (let exponent = Math.ceil(low / step) * step; exponent <= high; exponent += step) {
          ticks.push({ value: 10 ** exponent, label: formatPower(exponent), position: position(10 ** exponent), priority: (exponent / step) % 2 === 0 ? 0 : 1 });
        }
        return ticks;
      }
      // Less than a decade: round values work better than powers of ten.
    }
    const { step, values } = niceTicks(min, max, count);
    return values.map(value => ({
      value,
      label: format(value, step),
      position: position(value),
      priority: Math.abs(Math.round(value / step)) % 2,
    }));
  }

  // Data points → polylines in target coordinates, cut at the frame edge (a segment that
  // leaves the frame ends on it) and at missing values (NaN, or ≤ 0 on a log axis).
  clip(xs, ys) {
    if (xs.length !== ys.length) throw new RangeError('x and y must have the same length');
    const minX = Math.min(this.left, this.right), maxX = Math.max(this.left, this.right);
    const minY = Math.min(this.bottom, this.top), maxY = Math.max(this.bottom, this.top);
    const runs = [];
    let run = null;
    let previous = null;
    const end = () => {
      if (run && run.length >= 4) runs.push(run);
      run = null;
    };
    for (let index = 0; index < xs.length; index += 1) {
      const point = [this.x(xs[index]), this.y(ys[index])];
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
        end();
        previous = null;
        continue;
      }
      if (previous) {
        const segment = clipSegment(previous, point, minX, maxX, minY, maxY);
        if (!segment) end();
        else {
          const [x0, y0, x1, y1, enters, leaves] = segment;
          if (!run || enters) {
            end();
            run = [x0, y0];
          }
          run.push(x1, y1);
          if (leaves) end();
        }
      } else if (point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY) {
        end();
        run = [point[0], point[1]];
      }
      previous = point;
    }
    end();
    return runs;
  }
}

// Liang–Barsky: the part of a segment inside the rectangle, and whether it was cut at
// its start (enters) or end (leaves).
function clipSegment([x0, y0], [x1, y1], minX, maxX, minY, maxY) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x0 - minX], [dx, maxX - x0], [-dy, y0 - minY], [dy, maxY - y0]]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy, t0 > 0, t1 < 1];
}
