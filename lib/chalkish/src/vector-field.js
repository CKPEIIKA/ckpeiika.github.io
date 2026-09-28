// Scientific layers on a plane: level curves of a scalar field (marching squares), arrows
// of a vector field and streamlines. The geometry functions are pure and return packed
// Float64Arrays ([x0, y0, x1, y1, …]) for SegmentLayer, CurveLayer or the gallery's Ink.

import { Group } from './core.js';
import { SegmentLayer } from './segments.js';

function gridSpec({ columns, rows, minX, maxX, minY, maxY }) {
  if (!(Number.isInteger(columns) && columns >= 1 && Number.isInteger(rows) && rows >= 1)) throw new RangeError('columns and rows must be positive integers');
  for (const [value, name] of [[minX, 'minX'], [maxX, 'maxX'], [minY, 'minY'], [maxY, 'maxY']]) {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  }
  if (!(maxX > minX && maxY > minY)) throw new RangeError('the grid must have a positive size');
  return { columns, rows, minX, maxX, minY, maxY, dx: (maxX - minX) / columns, dy: (maxY - minY) / rows };
}

// Level-`level` curve of a field sampled at the (columns+1)×(rows+1) grid nodes, given as
// `fn(x, y)` or row-major `values`. Returns 2-point segments; saddle cells are resolved by
// the cell average. Non-finite samples leave a gap.
export function contourSegments({ fn, values, level = 0, ...grid }) {
  const g = gridSpec(grid);
  const nx = g.columns + 1, ny = g.rows + 1;
  let samples = values;
  if (typeof fn === 'function') {
    samples = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) samples[j * nx + i] = fn(g.minX + i * g.dx, g.minY + j * g.dy);
  } else if (!samples || samples.length !== nx * ny) {
    throw new RangeError(`values must hold (columns + 1) × (rows + 1) = ${nx * ny} samples`);
  }
  const out = [];
  const corner = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let j = 0; j < g.rows; j += 1) {
    for (let i = 0; i < g.columns; i += 1) {
      // A sample exactly on the level counts as just above it, so the curve passes through
      // that node once instead of fanning out to every neighbour.
      const v = corner.map(([a, b]) => {
        const d = samples[(j + b) * nx + i + a] - level;
        return d === 0 ? Number.MIN_VALUE : d;
      });
      const crossings = [];
      for (let k = 0; k < 4; k += 1) {
        const l = (k + 1) % 4;
        if (!Number.isFinite(v[k]) || !Number.isFinite(v[l]) || !((v[k] <= 0 && v[l] > 0) || (v[k] > 0 && v[l] <= 0))) continue;
        // Interpolate from the edge's lower node, so the two cells sharing an edge produce
        // bit-identical points and joinSegments can link them.
        const [from, to] = k < 2 ? [k, l] : [l, k];
        const a = v[from], b = v[to], q = a / (a - b);
        const [ax, ay] = corner[from], [bx, by] = corner[to];
        crossings.push([g.minX + (i + ax + q * (bx - ax)) * g.dx, g.minY + (j + ay + q * (by - ay)) * g.dy]);
      }
      if (crossings.length === 2) out.push(...crossings[0], ...crossings[1]);
      else if (crossings.length === 4) {
        const pairs = (v[0] + v[1] + v[2] + v[3]) / 4 > 0 ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
        for (const [a, b] of pairs) out.push(...crossings[a], ...crossings[b]);
      }
    }
  }
  return Float64Array.from(out);
}

// Joins 2-point segments that share endpoints (within `tolerance`) into polylines, so a
// contour is drawn as a few long strokes instead of many short ones.
export function joinSegments(segments, tolerance = 1e-9) {
  const count = segments.length / 4;
  const key = (x, y) => `${Math.round(x / tolerance)},${Math.round(y / tolerance)}`;
  const ends = new Map();
  const add = (k, index) => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(index); };
  for (let index = 0; index < count; index += 1) {
    add(key(segments[index * 4], segments[index * 4 + 1]), index);
    add(key(segments[index * 4 + 2], segments[index * 4 + 3]), index);
  }
  const used = new Uint8Array(count);
  // Segments shorter than the tolerance (a curve grazing a grid node) only join nothing.
  for (let index = 0; index < count; index += 1) {
    const s = index * 4;
    if (key(segments[s], segments[s + 1]) === key(segments[s + 2], segments[s + 3])) used[index] = 1;
  }
  const other = (index, x, y) => {
    const s = index * 4;
    return key(segments[s], segments[s + 1]) === key(x, y) ? [segments[s + 2], segments[s + 3]] : [segments[s], segments[s + 1]];
  };
  const extend = (line, x, y) => {
    for (;;) {
      const next = (ends.get(key(x, y)) ?? []).find((index) => !used[index]);
      if (next === undefined) return;
      used[next] = 1;
      [x, y] = other(next, x, y);
      line.push(x, y);
    }
  };
  const lines = [];
  for (let index = 0; index < count; index += 1) {
    if (used[index]) continue;
    used[index] = 1;
    const s = index * 4;
    const forward = [segments[s], segments[s + 1], segments[s + 2], segments[s + 3]];
    extend(forward, segments[s + 2], segments[s + 3]);
    const backward = [];
    extend(backward, segments[s], segments[s + 1]);
    const line = [];
    for (let k = backward.length - 2; k >= 0; k -= 2) line.push(backward[k], backward[k + 1]);
    lines.push(Float64Array.from([...line, ...forward]));
  }
  return lines;
}

// Streamline through (x, y) of velocity(x, y) → [u, v], integrated with RK4 in both
// directions (or 'forward'/'backward') until it leaves `bounds`, stalls, closes on itself
// or reaches maxSteps. Returns a packed polyline.
export function traceStreamline(velocity, x, y, {
  step = 0.02, maxSteps = 400, bounds = null, direction = 'both', minSpeed = 1e-9,
} = {}) {
  if (typeof velocity !== 'function') throw new TypeError('velocity must be a function (x, y) => [u, v]');
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('the seed must be finite');
  if (!(step > 0) || !(Number.isInteger(maxSteps) && maxSteps > 0)) throw new RangeError('step must be positive and maxSteps a positive integer');
  const inside = (px, py) => !bounds || (px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY);
  // Unit-speed direction field: equal arc length per step, whatever the speed.
  const unit = (px, py) => {
    const [u, v] = velocity(px, py);
    const speed = Math.hypot(u, v);
    return Number.isFinite(speed) && speed > minSpeed ? [u / speed, v / speed] : null;
  };
  const walk = (sign) => {
    const points = [];
    let px = x, py = y;
    for (let n = 0; n < maxSteps; n += 1) {
      const k1 = unit(px, py); if (!k1) break;
      const k2 = unit(px + sign * step * k1[0] / 2, py + sign * step * k1[1] / 2); if (!k2) break;
      const k3 = unit(px + sign * step * k2[0] / 2, py + sign * step * k2[1] / 2); if (!k3) break;
      const k4 = unit(px + sign * step * k3[0], py + sign * step * k3[1]); if (!k4) break;
      px += sign * step * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
      py += sign * step * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
      if (!inside(px, py)) break;
      points.push(px, py);
      // A closed orbit: back near the seed after going some way round.
      if (n > 8 && Math.hypot(px - x, py - y) < step * 0.75) break;
    }
    return points;
  };
  const forward = direction === 'backward' ? [] : walk(1);
  const backward = direction === 'forward' ? [] : walk(-1);
  const line = [];
  for (let k = backward.length - 2; k >= 0; k -= 2) line.push(backward[k], backward[k + 1]);
  line.push(x, y, ...forward);
  return Float64Array.from(line);
}

// One streamline per seed [[x, y], …].
export function traceStreamlines(velocity, seeds, options) {
  return seeds.map(([x, y]) => traceStreamline(velocity, x, y, options));
}

// Arrows of a vector field as chalk segment layers: shaft plus two head strokes per arrow,
// length = min(maxLength, scale · |v|); arrows shorter than minLength are left out. Speed also
// shows as brightness: `shades` layers from faint to full opacity, by |v| relative to the
// fastest arrow (or to referenceMagnitude, to compare frames) — useful where lengths saturate.
export class VectorField extends Group {
  constructor({
    scale = 1, maxLength = Infinity, minLength = 0, headLength = null, headAngle = Math.PI / 7,
    shades = 4, referenceMagnitude = null, style = {}, ...options
  } = {}) {
    super([], options);
    if (!(Number.isInteger(shades) && shades >= 1)) throw new RangeError('shades must be a positive integer');
    Object.assign(this, { scale, maxLength, minLength, headLength, headAngle, shades, referenceMagnitude });
    const opacity = style.opacity ?? 1;
    this.layers = Array.from({ length: shades }, (_, k) => new SegmentLayer({
      segments: new Float32Array(0),
      style: { ...style, opacity: opacity * (shades === 1 ? 1 : 0.3 + 0.7 * (k + 1) / shades) },
    }));
    this.add(...this.layers);
    this.arrowCount = 0;
  }

  // Arrow segments of all shades, in layer order (for tests and exports).
  get segments() {
    return Float32Array.from(this.layers.flatMap((layer) => Array.from(layer.segments.subarray(0, layer.count * 4))));
  }

  get count() {
    return this.layers.reduce((sum, layer) => sum + layer.count, 0);
  }

  // x, y: arrow tails; u, v: vectors (arrays of equal length), or vector(x, y) → [u, v].
  setVectors({ x, y, u = null, v = null, vector = null }) {
    const count = x.length;
    if (y.length !== count || (vector === null && (u?.length !== count || v?.length !== count))) throw new RangeError('x, y, u and v must have the same length');
    const arrows = [];
    let fastest = 0;
    for (let index = 0; index < count; index += 1) {
      const [du, dv] = vector ? vector(x[index], y[index]) : [u[index], v[index]];
      const magnitude = Math.hypot(du, dv);
      if (!Number.isFinite(magnitude) || magnitude === 0) continue;
      const length = Math.min(this.maxLength, this.scale * magnitude);
      if (!(length > this.minLength)) continue;
      arrows.push([x[index], y[index], du / magnitude, dv / magnitude, length, magnitude]);
      fastest = Math.max(fastest, magnitude);
    }
    const reference = this.referenceMagnitude ?? fastest;
    const buckets = Array.from({ length: this.shades }, () => []);
    const cos = Math.cos(this.headAngle), sin = Math.sin(this.headAngle);
    for (const [ax, ay, ex, ey, length, magnitude] of arrows) {
      const shade = Math.min(this.shades - 1, Math.floor(this.shades * magnitude / reference));
      const tx = ax + ex * length, ty = ay + ey * length;
      const head = this.headLength ?? length * 0.3;
      buckets[shade].push(
        ax, ay, tx, ty,
        tx, ty, tx - head * (ex * cos - ey * sin), ty - head * (ey * cos + ex * sin),
        tx, ty, tx - head * (ex * cos + ey * sin), ty - head * (ey * cos - ex * sin),
      );
    }
    buckets.forEach((segments, k) => this.layers[k].setSegments(Float32Array.from(segments), { copy: false }));
    this.arrowCount = arrows.length;
    return this;
  }
}
