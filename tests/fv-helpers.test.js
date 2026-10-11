import assert from 'node:assert/strict';
import test from 'node:test';

import { C, Ink, graph } from '../demos/pde-gallery/board.js';

// A frame whose data coordinates map to round board pixels: x ∈ [0, 1] → [100, 500],
// y ∈ [0, 1] → [300, 100].
function frame(options = {}) {
  const ink = new Ink();
  const g = graph(ink, { x: 100, y: 100, w: 400, h: 200, xmin: 0, xmax: 1, ymin: 0, ymax: 1, xticks: 0, yticks: 0, ...options });
  ink.cmd.length = 0;
  return { ink, g };
}

test('cells draw averages as one staircase and break it where a value leaves the frame', () => {
  const { ink, g } = frame();
  g.cells([0.25, 0.5, 0.75, 0.5]);
  const paths = ink.cmd.filter((p) => p.type === 'path');
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0].points, [[100, 250], [200, 250], [200, 200], [300, 200], [300, 150], [400, 150], [400, 200], [500, 200]]);

  const broken = frame();
  broken.g.cells([0.5, 2, NaN, 0.5], { select: 3 });
  const runs = broken.ink.cmd.filter((p) => p.type === 'path');
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((p) => p.points.length), [2, 2]);
  const outline = broken.ink.cmd.find((p) => p.type === 'rect');
  assert.deepEqual([outline.x, outline.y, outline.w, outline.h, outline.color], [400, 100, 100, 200, C.yellow]);
});

test('cells ignore an empty list', () => {
  const { ink, g } = frame();
  g.cells([]);
  assert.equal(ink.cmd.length, 0);
});

test('averages draw a face, a bar and a dot per cell that fits, selected cells in yellow', () => {
  const { ink, g } = frame({ xmin: -1.5, xmax: 1.5 });
  g.averages([0.2, 0.4, 0.6, 0.8], { at: [-1, 0, 1, 2], selected: [0] });
  const bars = ink.cmd.filter((p) => p.type === 'line' && p.y1 === p.y2);
  const faces = ink.cmd.filter((p) => p.type === 'line' && p.x1 === p.x2);
  assert.equal(bars.length, 3, 'the cell at ξ = 2 lies outside the range');
  assert.equal(faces.length, 3);
  assert.equal(ink.cmd.filter((p) => p.type === 'dot').length, 3);
  assert.equal(bars[1].color, C.yellow);
  assert.equal(bars[1].width, 4);
  assert.equal(bars[0].color, C.white);
});

test('averages without faces and with non-finite values', () => {
  const { ink, g } = frame({ xmin: -1.5, xmax: 1.5 });
  g.averages([NaN, 0.5, Infinity], { at: [-1, 0, 1], faces: null });
  assert.equal(ink.cmd.filter((p) => p.type === 'line').length, 1);
});

test('stencil brackets span their cells and stack by row', () => {
  const { ink, g } = frame({ xmin: -2.5, xmax: 2.5 });
  g.stencil(-2, 0, { label: 'S0' });
  g.stencil(-1, 1, { row: 1 });
  const [first, second] = ink.cmd.filter((p) => p.type === 'path');
  assert.equal(first.points[1][0], g.X(-2.5) + 4);
  assert.equal(first.points[2][0], g.X(0.5) - 4);
  assert.ok(second.points[1][1] > first.points[1][1]);
  assert.deepEqual(ink.cmd.filter((p) => p.type === 'text').map((p) => p.text), ['S0']);
});
