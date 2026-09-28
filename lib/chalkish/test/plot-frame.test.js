import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPower, PlotFrame } from '../src/plot-frame.js';

// A board-style frame: y grows downwards, so the data maximum is at the top (y = 100).
const board = (options = {}) => new PlotFrame({ left: 100, right: 500, bottom: 300, top: 100, xRange: [0, 1], yRange: [-1, 1], ...options });
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('maps data to the frame and back on linear and log axes', () => {
  const frame = board();
  assert.equal(frame.x(0.5), 300);
  assert.equal(frame.y(1), 100);
  assert.equal(frame.y(-1), 300);
  assert.deepEqual(frame.value(300, 200), [0.5, 0]);
  const log = board({ xRange: [1e-3, 10], xScale: 'log', yRange: [1e-16, 1], yScale: 'log' });
  assert.ok(close(log.x(1e-2), 200));
  assert.ok(close(log.value(200, 300)[0], 1e-2));
  assert.ok(close(log.value(200, 300)[1], 1e-16));
  assert.ok(Number.isNaN(log.x(0)) && Number.isNaN(log.x(-1)), 'no position for ≤ 0 on a log axis');
  // World-style frame: y up.
  const world = new PlotFrame({ left: -5, right: 5, bottom: -1, top: 1, xRange: [0, 10], yRange: [0, 2] });
  assert.equal(world.y(2), 1);
  assert.ok(world.contains(0, 0) && !world.contains(0, 1.5));
});

test('rejects unusable frames', () => {
  assert.throws(() => board({ xRange: [1, 1] }), RangeError);
  assert.throws(() => board({ xRange: [0, 1], xScale: 'log' }), RangeError);
  assert.throws(() => board({ yScale: 'sqrt' }), RangeError);
  assert.throws(() => board({ left: 100, right: 100 }), RangeError);
  assert.throws(() => board({ xRange: [0, Infinity] }), RangeError);
  assert.throws(() => board().clip([0, 1], [0]), RangeError);
});

test('ticks: round values, decades on log axes, explicit labels, alternating priority', () => {
  const frame = board();
  assert.deepEqual(frame.ticks('y', 4).map(t => t.label), ['-1', '-0.5', '0', '0.5', '1']);
  assert.deepEqual(frame.ticks('y', 4).map(t => t.priority), [0, 1, 0, 1, 0]);
  assert.deepEqual(frame.ticks('x', 4).map(t => t.position), [100, 200, 300, 400, 500]);
  const log = board({ yRange: [1e-16, 1], yScale: 'log' });
  assert.deepEqual(log.ticks('y', 4).map(t => t.label), ['10⁻¹⁶', '10⁻¹²', '10⁻⁸', '10⁻⁴', '10⁰']);
  assert.deepEqual(board({ xRange: [2, 8], xScale: 'log' }).ticks('x', 3).map(t => t.value), [2, 4, 6, 8], 'under a decade: round values');
  assert.deepEqual(frame.ticks('x', [[0, 'a'], [0.5, 'b'], [2, 'outside']]).map(t => t.label), ['a', 'b']);
  assert.deepEqual(frame.ticks('x', 0), []);
  assert.equal(formatPower(-3), '10⁻³');
});

test('clip cuts lines at the frame edge and at missing values', () => {
  const frame = board();
  // Up through the top edge at x = 0.5 and back down: two runs meeting the edge.
  const [first, second] = frame.clip([0, 0.5, 1], [0, 2, 0]);
  assert.equal(first.length, 4);
  assert.deepEqual([first[0], first[1]], [100, 200]);
  assert.ok(close(first[3], 100), 'the first run ends on the top edge');
  assert.ok(close(second[1], 100) && close(second[2], 500));
  assert.equal(frame.clip([0, 0.5, 1], [0, Number.NaN, 0]).length, 0, 'isolated points draw nothing');
  assert.equal(frame.clip([0, 0.25, 0.5, 0.75], [0, 0, Number.NaN, 0]).length, 1);
  assert.equal(frame.clip([0, 1], [5, 5]).length, 0, 'entirely outside');
  const through = frame.clip([-1, 2], [0, 0]);
  assert.deepEqual(through, [[100, 200, 500, 200]], 'a segment crossing the whole frame');
  const log = board({ yRange: [1e-3, 1], yScale: 'log' });
  assert.equal(log.clip([0, 0.5, 1], [0.1, 0, 0.1]).length, 0, 'zero on a log axis is a gap');
});

test('clipped runs stay inside the frame for many random polylines', () => {
  let seed = 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const frame = board();
  for (let run = 0; run < 300; run += 1) {
    const n = 2 + Math.floor(random() * 20);
    const xs = Array.from({ length: n }, () => random() * 1.6 - 0.3);
    const ys = Array.from({ length: n }, () => (random() < 0.05 ? Number.NaN : random() * 4 - 2));
    for (const line of frame.clip(xs, ys)) {
      assert.ok(line.length >= 4 && line.length % 2 === 0);
      for (let i = 0; i < line.length; i += 2) {
        assert.ok(line[i] >= 100 - 1e-9 && line[i] <= 500 + 1e-9 && line[i + 1] >= 100 - 1e-9 && line[i + 1] <= 300 + 1e-9);
      }
    }
  }
});
