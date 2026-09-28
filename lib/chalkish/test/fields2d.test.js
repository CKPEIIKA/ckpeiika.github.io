import assert from 'node:assert/strict';
import test from 'node:test';

import { HistoryBuffer } from '../src/history.js';
import { MatrixGrid } from '../src/matrix-grid.js';
import { contourSegments, joinSegments, traceStreamline, traceStreamlines, VectorField } from '../src/vector-field.js';

const grid = { columns: 40, rows: 40, minX: -2, maxX: 2, minY: -2, maxY: 2 };

test('contours of a circle lie on the circle and join into one closed line', () => {
  const segments = contourSegments({ ...grid, fn: (x, y) => x * x + y * y, level: 1 });
  assert.ok(segments.length > 0 && segments.length % 4 === 0);
  for (let i = 0; i < segments.length; i += 2) {
    assert.ok(Math.abs(Math.hypot(segments[i], segments[i + 1]) - 1) < 0.02);
  }
  const lines = joinSegments(segments, 1e-9);
  assert.equal(lines.length, 1);
  const line = lines[0];
  assert.ok(Math.hypot(line[0] - line.at(-2), line[1] - line.at(-1)) < 1e-9, 'closed');
  // Sampled values give the same curve as the function.
  const values = new Float64Array(41 * 41);
  for (let j = 0; j <= 40; j += 1) for (let i = 0; i <= 40; i += 1) values[j * 41 + i] = (-2 + i * 0.1) ** 2 + (-2 + j * 0.1) ** 2;
  assert.deepEqual(Array.from(contourSegments({ ...grid, values, level: 1 })), Array.from(segments));
});

test('contours handle saddles, gaps and bad input', () => {
  const saddle = contourSegments({ columns: 1, rows: 1, minX: 0, maxX: 1, minY: 0, maxY: 1, values: [1, -1, -1, 1], level: 0 });
  assert.equal(saddle.length, 8, 'a saddle cell gives two segments');
  const gap = contourSegments({ columns: 2, rows: 1, minX: 0, maxX: 2, minY: 0, maxY: 1, values: [1, NaN, -1, 1, NaN, -1], level: 0 });
  assert.equal(gap.length, 0, 'no crossing is invented next to a missing sample');
  assert.throws(() => contourSegments({ ...grid, values: [1, 2, 3] }), RangeError);
  assert.throws(() => contourSegments({ ...grid, columns: 0, fn: () => 0 }), RangeError);
});

test('streamlines of a rotation are circles and stop at the bounds', () => {
  const rotation = (x, y) => [-y, x];
  const circle = traceStreamline(rotation, 1, 0, { step: 0.05, maxSteps: 400, direction: 'forward' });
  for (let i = 0; i < circle.length; i += 2) assert.ok(Math.abs(Math.hypot(circle[i], circle[i + 1]) - 1) < 1e-4);
  assert.ok(circle.length / 2 < 150, 'it stops after closing the orbit');
  const flow = traceStreamline(() => [1, 0], 0, 0, { step: 0.1, bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 } });
  assert.ok(Math.abs(flow[0] + 1) < 0.1 && Math.abs(flow.at(-2) - 1) < 0.1, 'both directions, cut at the bounds');
  assert.equal(traceStreamline(() => [0, 0], 0.3, 0.4).length, 2, 'a stagnation point is just the seed');
  assert.equal(traceStreamlines(rotation, [[1, 0], [0.5, 0]]).length, 2);
  assert.throws(() => traceStreamline(null, 0, 0), TypeError);
  assert.throws(() => traceStreamline(rotation, 0, 0, { step: 0 }), RangeError);
});

test('a vector field writes three chalk segments per visible arrow', () => {
  const field = new VectorField({ scale: 0.5, maxLength: 1, minLength: 1e-6, headLength: 0.1, shades: 1 });
  field.setVectors({ x: [0, 1, 2], y: [0, 0, 0], u: [1, 0, 10], v: [0, 0, 0] });
  assert.equal(field.arrowCount, 2, 'the zero vector is left out');
  assert.equal(field.count, 6);
  assert.deepEqual(Array.from(field.segments.slice(0, 4)), [0, 0, 0.5, 0]);
  assert.deepEqual(Array.from(field.segments.slice(12, 16)), [2, 0, 3, 0], 'capped at maxLength');
  field.setVectors({ x: [0], y: [0], vector: () => [0, 2] });
  assert.ok(Math.abs(field.segments[3] - 1) < 1e-6);
  assert.throws(() => field.setVectors({ x: [0, 1], y: [0], u: [1], v: [1] }), RangeError);
});

test('faster arrows are brighter: one layer per speed band', () => {
  const field = new VectorField({ shades: 4, style: { stroke: '#fff', opacity: 1 } });
  field.setVectors({ x: [0, 1, 2, 3], y: [0, 0, 0, 0], u: [0.1, 0.4, 0.6, 1], v: [0, 0, 0, 0] });
  assert.deepEqual(field.layers.map((layer) => layer.count / 3), [1, 1, 1, 1]);
  const opacities = field.layers.map((layer) => layer.style.opacity);
  assert.ok(opacities.every((value, k) => k === 0 || value > opacities[k - 1]), 'fainter to brighter');
  // A fixed reference compares frames: the same field, half as fast, is dimmer.
  const fixed = new VectorField({ shades: 4, referenceMagnitude: 2 });
  fixed.setVectors({ x: [0], y: [0], u: [1], v: [0] });
  assert.equal(fixed.layers[2].count, 3);
  assert.throws(() => new VectorField({ shades: 0 }), RangeError);
});

test('a history buffer keeps the latest samples in order and numbers them', () => {
  const history = new HistoryBuffer(['t', 'value'], 3);
  for (let i = 0; i < 5; i += 1) history.push({ t: i, value: i * i });
  assert.deepEqual(Array.from(history.copy('value')), [4, 9, 16]);
  assert.deepEqual(Array.from(history.indices()), [0, 1, 2]);
  assert.throws(() => history.copy('nope'), RangeError);
});

test('a matrix grid draws its cells, finds the cell under a point and highlights it', () => {
  const grid2 = new MatrixGrid([[1, 0], [-2, 3]], { cell: 1, x: 10, y: 5, rowLabels: ['a', 'b'] });
  const texts = grid2.children.filter((child) => child.kind === 'text').map((child) => child.text);
  assert.deepEqual(texts, ['1', '-2', '3', 'a', 'b'], 'zero cells stay blank');
  assert.deepEqual(grid2.cellAt(10.5, 4.5), [0, 0]);
  assert.deepEqual(grid2.cellAt(11.5, 3.5), [1, 1]);
  assert.equal(grid2.cellAt(9, 4.5), null);
  grid2.highlight([1, 0]);
  assert.equal(grid2.marker.visible, true);
  assert.deepEqual([grid2.marker.x, grid2.marker.y], [0.5, -1.5]);
  grid2.highlight(null);
  assert.equal(grid2.marker.visible, false);
  assert.throws(() => new MatrixGrid('x'), TypeError);
});

test('trails keep the latest positions, fade with age and break at jumps', async () => {
  const { TrailLayer } = await import('../src/trails.js');
  const trail = new TrailLayer({ length: 4, shades: 3, maxJump: 1.5 });
  trail.push([0, 10], [0, 0]);
  assert.equal(trail.count, 0, 'one position is not a trail yet');
  trail.push([1, 11], [0, 0]);
  trail.push([2, 12], [0, 0]);
  assert.equal(trail.count, 4, 'two segments for each of two points');
  const newest = trail.layers.at(-1);
  assert.deepEqual(Array.from(newest.segments.subarray(0, 4)), [1, 0, 2, 0], 'the newest segment is in the brightest layer');
  assert.ok(trail.layers[0].style.opacity < trail.layers.at(-1).style.opacity);
  trail.push([3, 13], [0, 0]);
  trail.push([4, 14], [0, 0]);
  assert.equal(trail.count, 6, 'the ring keeps length − 1 segments per point');
  trail.push([5, 0], [0, 0]); // the second point wraps around: no line across the box
  const segments = trail.layers.flatMap((layer) => Array.from(layer.segments.subarray(0, layer.count * 4)));
  for (let k = 0; k < segments.length; k += 4) assert.ok(Math.hypot(segments[k + 2] - segments[k], segments[k + 3] - segments[k + 1]) <= 1.5);
  trail.push([0, 0, 0], [0, 0, 0]);
  assert.equal(trail.count, 0, 'a different point count starts afresh');
  trail.clear();
  assert.equal(trail.count, 0);
  assert.throws(() => new TrailLayer({ length: 1 }), RangeError);
  assert.throws(() => trail.push([0], [0], 2), RangeError);
});
