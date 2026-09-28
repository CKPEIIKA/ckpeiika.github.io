import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas2DRenderer } from '../src/canvas2d.js';
import { Camera2D, Scene, TextLabel } from '../src/core.js';
import { formatTick, niceBounds, niceStep, niceTicks } from '../src/ticks.js';
import { RecordingContext2D } from '../support/recording-context.js';

// fillText is recorded with the font in effect, since font is a property, not a call.
class FontRecordingContext extends RecordingContext2D {
  fillText(...args) {
    super.fillText(...args);
    this.commands.at(-1).push(this.font);
  }
}

function drawLabel(label, { width, height, cameraHeight, pixelRatio = 1 }) {
  const context = new FontRecordingContext(width * pixelRatio, height * pixelRatio);
  const scene = new Scene();
  scene.add(label);
  new Canvas2DRenderer(context, { pixelRatio })
    .render(scene, new Camera2D({ centerX: 0, centerY: 0, height: cameraHeight, flipY: false }));
  return context.commands.filter(entry => entry[0] === 'fillText');
}

function fontPixels(command) {
  return Number(command.at(-1).match(/([\d.]+)px/)[1]);
}

test('world-unit text scales with the camera like strokes', () => {
  const label = () => new TextLabel('u(x)', { size: 20, font: '16px "Neucha", sans-serif' });
  const full = drawLabel(label(), { width: 1000, height: 610, cameraHeight: 610 });
  const half = drawLabel(label(), { width: 500, height: 305, cameraHeight: 610 });
  assert.equal(fontPixels(full[0]), 20);
  assert.equal(fontPixels(half[0]), 10);
  assert.match(full[0].at(-1), /"Neucha", sans-serif$/);
  const zoomed = drawLabel(label(), { width: 1000, height: 610, cameraHeight: 305 });
  assert.equal(fontPixels(zoomed[0]), 40);
});

test('world-unit text keeps a readable minimum and its world-unit maxWidth', () => {
  const small = drawLabel(
    new TextLabel('title', { size: 20, minPixelSize: 14, maxWidth: 800 }),
    { width: 400, height: 244, cameraHeight: 610, pixelRatio: 2 },
  );
  // 20 units × 0.4 px/unit × 2 = 16 device px < 14 CSS px × 2 = 28 device px.
  assert.equal(fontPixels(small[0]), 28);
  assert.ok(Math.abs(small[0][4] - 800 * 0.4 * 2) < 1e-9, 'maxWidth follows the board, not the enlarged font');
});

test('pixel-font text keeps its previous behaviour', () => {
  const [command] = drawLabel(new TextLabel('old', { font: '16px sans-serif', maxWidth: 50 }),
    { width: 1120, height: 630, cameraHeight: 2 });
  assert.equal(fontPixels(command), 16);
  assert.equal(command[4], 50);
  assert.equal(command.length, 6);
});

test('text size must be a positive world height', () => {
  for (const size of [0, -1, Number.NaN, Infinity]) {
    assert.throws(() => new TextLabel('x', { size }), RangeError);
  }
  assert.throws(() => new TextLabel('x', { size: 1, minPixelSize: -1 }), RangeError);
  const label = new TextLabel('x', { size: 3, font: 'bold serif' });
  assert.equal(fontPixels(drawLabel(label, { width: 100, height: 100, cameraHeight: 100 })[0]), 3);
});

test('nice ticks use steps of 1, 2, 2.5 or 5 and stay inside the range', () => {
  assert.deepEqual(niceTicks(-1.25, 1.25, 4), { step: 0.5, values: [-1, -0.5, 0, 0.5, 1] });
  assert.deepEqual(niceTicks(0, 1, 4).values, [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(niceTicks(0, 1, 5).values, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(0, 100, 4).values, [0, 25, 50, 75, 100]);
  assert.deepEqual(niceTicks(0.0975, 1.23, 4).values, [0.25, 0.5, 0.75, 1]);
  assert.deepEqual(niceTicks(-16, 0, 8).values, [-16, -14, -12, -10, -8, -6, -4, -2, 0]);
  assert.deepEqual(niceTicks(0, 0.3, 3).values, [0, 0.1, 0.2, 0.3]);
  assert.deepEqual(niceTicks(2, 2), { step: 0, values: [2] });
  assert.deepEqual(niceTicks(-1.86e-8, -3.28e-9, 1).values, [-1.5e-8, -1e-8, -5e-9]);
  assert.ok(niceTicks(-0.1, 0.1, 2).values.every(value => !Object.is(value, -0)));
});

test('nice ticks hold their invariants over many ranges', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let run = 0; run < 2000; run += 1) {
    const scale = 10 ** Math.floor(random() * 16 - 8);
    const min = (random() * 2 - 1) * scale;
    const max = min + random() * scale + scale * 1e-6;
    const count = 1 + Math.floor(random() * 10);
    const { step, values } = niceTicks(min, max, count);
    assert.ok(values.length >= 2 && values.length <= 5 * count + 1, `${min} ${max} ${count}: ${values.length}`);
    const mantissa = step / 10 ** Math.floor(Math.log10(step) + 1e-9);
    assert.ok([1, 2, 2.5, 5].some(m => Math.abs(mantissa - m) < 1e-9), `step ${step}`);
    for (let index = 0; index < values.length; index += 1) {
      assert.ok(values[index] >= min - step * 1e-6 && values[index] <= max + step * 1e-6);
      if (index) assert.ok(Math.abs(values[index] - values[index - 1] - step) < step * 1e-6);
    }
  }
});

test('nice ticks reject unusable ranges', () => {
  assert.throws(() => niceTicks(1, 0), RangeError);
  assert.throws(() => niceTicks(0, Number.NaN), RangeError);
  assert.throws(() => niceTicks(0, Infinity), RangeError);
  assert.throws(() => niceStep(0), RangeError);
  assert.throws(() => niceStep(1, 0), RangeError);
});

test('tick labels carry only the digits the step needs', () => {
  assert.equal(formatTick(0.30000000000000004, 0.1), '0.3');
  assert.equal(formatTick(-1, 0.5), '-1');
  assert.equal(formatTick(-0.0001, 0.5), '0');
  assert.equal(formatTick(0, 0.5), '0');
  assert.equal(formatTick(40, 20), '40');
  assert.equal(formatTick(-0.015, 0.005), '-0.015');
  assert.equal(formatTick(2e-4, 5e-5), '2e-4');
  assert.equal(formatTick(-3.5e-4, 5e-5), '-3.5e-4');
  assert.equal(formatTick(250000, 50000), '2.5e5');
  assert.equal(formatTick(0.75, 0.25), '0.75');
  assert.equal(formatTick(-0.025, 0.025), '-0.025');
  assert.equal(formatTick(7.5e-4, 2.5e-4), '7.5e-4');
  assert.equal(formatTick(2.5e-4, 2.5e-4), '2.5e-4');
  assert.equal(formatTick(Number.NaN, 1), 'NaN');
});

test('niceBounds widens a range outward to round ticks', () => {
  assert.deepEqual(niceBounds(0.0975, 1.23, 4), [0, 1.25]);
  assert.deepEqual(niceBounds(-0.37, 2.9, 2), [-2, 4]);
  assert.deepEqual(niceBounds(3, 3, 2), [2.5, 3.5]);
  assert.deepEqual(niceBounds(0, 0, 2), [-1, 1]);
  assert.deepEqual(niceBounds(5, 1, 2), [0, 6], 'swapped ends are accepted');
  assert.throws(() => niceBounds(0, Infinity), RangeError);
});
