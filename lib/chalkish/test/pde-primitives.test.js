import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera2D, SampledPlot, affineCharacteristic, diffuse1D, nodalIntegral, projectPeriodic } from '../src/index.js';

test('camera fits all corners at desktop, phone, and rotated aspect ratios', () => {
  const bounds = { minX: -5, maxX: 5, minY: -2, maxY: 2 };
  for (const [width, height] of [[1200, 500], [320, 600], [900, 900]]) for (const rotation of [0, 0.4]) {
    const camera = new Camera2D({ rotation }).fitBounds(bounds, width, height);
    const matrix = new Float64Array(6);
    camera.matrix(matrix, width, height);
    for (const x of [-5, 5]) for (const y of [-2, 2]) {
      const px = matrix[0] * x + matrix[2] * y + matrix[4];
      const py = matrix[1] * x + matrix[3] * y + matrix[5];
      assert.ok(px >= 0 && px <= width && py >= 0 && py <= height);
    }
  }
  assert.throws(() => new Camera2D().fitBounds(bounds, 0, 10));
});

test('live plot has fixed data scales, reversible coordinates, reusable buffers', () => {
  const x = Float32Array.of(-1, 0, 1), y = Float32Array.of(0, 1, 0);
  const plot = new SampledPlot({ xRange: [-1, 1], yRange: [-2, 2] });
  const record = plot.addCurve(x, y), buffer = record.py;
  const before = record.py[1];
  y[1] /= 2; plot.update();
  assert.equal(record.py, buffer);
  assert.equal(record.py[1], before / 2);
  assert.deepEqual(plot.coordinates(...plot.point(0.2, 0.75)).map(x => +x.toFixed(8)), [0.2, 0.75]);
  assert.throws(() => plot.setRanges([1, 1], [-1, 1]));
  assert.throws(() => plot.addCurve([], []));
});

test('affine characteristics compose, reverse, and include zero-speed paths', () => {
  for (const a of [-1, 0, 1]) for (const b of [-0.4, 0, 0.4]) {
    const x = affineCharacteristic(0.2, 0.7, a, b);
    assert.ok(Math.abs(affineCharacteristic(x, -0.7, a, b) - 0.2) < 1e-12);
  }
  assert.equal(affineCharacteristic(0.3, 4, 0, 0), 0.3);
  assert.throws(() => affineCharacteristic(NaN, 1, 1));
});

test('periodic sine diffusion has the analytic decay rate and no mean drift', () => {
  const data = Float64Array.from({ length: 161 }, (_, i) => 1 + Math.sin(2 * Math.PI * i / 160));
  const before = nodalIntegral(data);
  diffuse1D(data, new Float64Array(161), 0.08, 0.3, { boundary: 'periodic' });
  assert.ok(Math.abs(data[40] - 1 - Math.exp(-0.08 * Math.PI ** 2 * 0.3)) < 1e-4);
  assert.ok(Math.abs(nodalIntegral(data) - before) < 1e-12);
});

test('PDE kernels reject invalid shapes and negative coefficients', () => {
  assert.throws(() => diffuse1D(null, null, 1, 1));
  assert.throws(() => diffuse1D(new Float64Array(3), new Float64Array(2), 1, 1));
  assert.throws(() => diffuse1D(new Float64Array(3), new Float64Array(3), -1, 1));
  assert.throws(() => diffuse1D(new Float64Array(3), new Float64Array(3), 1, Infinity));
});

test('compatible pressure projection preserves mean velocity and removes divergence', () => {
  const nx = 32, ny = 20;
  const u = Float64Array.from({ length: nx * ny }, (_, i) => 0.4 + Math.sin(i * 0.4));
  const v = Float64Array.from(u, (_, i) => Math.cos(i * 0.3));
  const p = new Float64Array(u.length), divergence = p.slice();
  const sum = array => array.reduce((a, b) => a + b, 0);
  const before = sum(u);
  projectPeriodic(u, v, nx, ny, 2 / nx, 1.2 / ny, p, divergence);
  assert.ok(Math.max(...divergence.map(Math.abs)) < 2e-6);
  assert.ok(Math.abs(sum(u) - before) < 1e-10);
});
