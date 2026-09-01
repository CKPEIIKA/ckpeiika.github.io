import assert from 'node:assert/strict';
import test from 'node:test';

import { differentiateUniform1D } from '../src/calculus.js';

test('uniform derivatives recover a quadratic including both boundaries', () => {
  const count = 17;
  const spacing = 2 / (count - 1);
  const values = new Float64Array(count);
  const first = new Float64Array(count);
  const second = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const x = -1 + index * spacing;
    values[index] = 2 * x * x - 3 * x + 4;
  }

  const result = differentiateUniform1D(values, spacing, first, second);
  assert.equal(result.first, first);
  assert.equal(result.second, second);
  for (let index = 0; index < count; index += 1) {
    const x = -1 + index * spacing;
    assert.ok(Math.abs(first[index] - (4 * x - 3)) < 1e-12);
    assert.ok(Math.abs(second[index] - 4) < 1e-11);
  }
});

test('uniform derivatives converge for a smooth trigonometric profile', () => {
  const error = (count) => {
    const spacing = 2 * Math.PI / (count - 1);
    const values = Float64Array.from(
      { length: count },
      (_, index) => Math.sin(index * spacing),
    );
    const first = new Float64Array(count);
    const second = new Float64Array(count);
    differentiateUniform1D(values, spacing, first, second);
    let maximum = 0;
    for (let index = 1; index < count - 1; index += 1) {
      maximum = Math.max(maximum, Math.abs(second[index] + values[index]));
    }
    return maximum;
  };

  assert.ok(error(129) < 0.27 * error(65));
});

test('uniform derivative validation leaves output buffers unchanged', () => {
  const values = new Float64Array([0, 1, Number.NaN, 3]);
  const first = new Float64Array(4).fill(7);
  const second = new Float64Array(4).fill(9);
  assert.throws(
    () => differentiateUniform1D(values, 1, first, second),
    /values\[2\] must be finite/,
  );
  assert.deepEqual([...first], [7, 7, 7, 7]);
  assert.deepEqual([...second], [9, 9, 9, 9]);
  assert.throws(
    () => differentiateUniform1D(new Float64Array(4), 0, first, second),
    /spacing must be a positive finite number/,
  );
  assert.throws(
    () => differentiateUniform1D(new Float64Array(4), 1, first, first),
    /must be distinct buffers/,
  );
});
