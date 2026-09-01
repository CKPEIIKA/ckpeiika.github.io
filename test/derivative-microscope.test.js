import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DERIVATIVE_PRESETS,
  DerivativeMicroscopeModel,
} from '../demos/pde-lecture-2/derivative-model.js';

test('derivative presets remain finite and share stable buffers', () => {
  const model = new DerivativeMicroscopeModel();
  const buffers = [model.value, model.first, model.second];
  for (const preset of DERIVATIVE_PRESETS) {
    model.setParameters({ preset });
    assert.equal(model.value, buffers[0]);
    assert.equal(model.first, buffers[1]);
    assert.equal(model.second, buffers[2]);
    for (const values of buffers) assert.ok(values.every(Number.isFinite));
  }
});

test('Gaussian maximum has zero slope and negative curvature', () => {
  const model = new DerivativeMicroscopeModel({
    preset: 'gaussian', amplitude: 1.4, width: 0.3, position: 0.125,
  });
  const center = model.probe(0.125);
  assert.ok(Math.abs(center.first) < 0.02);
  assert.ok(center.second < -10);
  assert.ok(Math.abs(center.second + 1.4 / 0.3 ** 2) < 0.2);
});

test('drawn segments update the field and both derivatives reproducibly', () => {
  const model = new DerivativeMicroscopeModel({ preset: 'drawing' });
  model.drawSegment(-0.5, -1, 0.5, 1);
  assert.ok(Math.abs(model.probe(0).value) < 0.02);
  assert.ok(model.probe(0).first > 1.8);
  const firstReplay = [...model.value];
  model.reset({ preset: 'drawing' });
  model.drawSegment(-0.5, -1, 0.5, 1);
  assert.deepEqual([...model.value], firstReplay);
});
