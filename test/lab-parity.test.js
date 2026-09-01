import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FrameMeter,
  RingHistory,
  makeReplayDocument,
  nextSeed,
  parseReplayDocument,
} from '../demos/lab-parity.js';

test('RingHistory keeps ordered bounded series without per-sample allocation', () => {
  const history = new RingHistory(['time', 'value'], 3);
  for (let index = 0; index < 5; index += 1) {
    history.push({ time: index, value: 10 + index });
  }
  assert.deepEqual([...history.copy('time')], [2, 3, 4]);
  assert.deepEqual([...history.copy('value')], [12, 13, 14]);
  history.clear().push({ time: 8, value: Number.NaN });
  assert.deepEqual([...history.copy('time')], [8]);
  assert.ok(Number.isNaN(history.copy('value')[0]));
});

test('replay documents are versioned, lab-specific, and immutable at the boundary', () => {
  const document = makeReplayDocument('dsmc-lab', { seed: 17, particleCount: 800 });
  const parsed = parseReplayDocument(JSON.stringify(document), 'dsmc-lab');
  assert.deepEqual(parsed, { seed: 17, particleCount: 800 });
  assert.ok(Object.isFrozen(parsed));
  assert.throws(() => parseReplayDocument(document, 'dg-fv-lab'), /expected dg-fv-lab/i);
  assert.throws(() => parseReplayDocument('{}', 'dsmc-lab'), /version 1/i);
});

test('seed sequence and frame telemetry are deterministic', () => {
  assert.equal(nextSeed(2026), nextSeed(2026));
  assert.notEqual(nextSeed(2026), 2026);
  const meter = new FrameMeter(500);
  meter.sample(100);
  meter.sample(350);
  assert.equal(meter.sample(600), 6);
});
