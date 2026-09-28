import assert from 'node:assert/strict';
import test from 'node:test';

import { easing, Unwrite, Write } from '../src/animation.js';
import { Canvas2DRenderer } from '../src/canvas2d.js';
import { chalkStyle } from '../src/chalk.js';
import { Arrow, Camera2D, Group, Line, MathLabel, Rectangle, Scene, TextLabel } from '../src/core.js';
import { CurveLayer } from '../src/curve.js';
import { RecordingContext2D } from '../support/recording-context.js';

const plain = { stroke: '#fff', width: 1, roughness: 0, passes: 1 };
const camera = () => new Camera2D({ centerX: 50, centerY: 50, height: 100, flipY: false });

function draw(object, { width = 100, height = 100 } = {}) {
  const context = new RecordingContext2D(width, height);
  const scene = new Scene({ background: null });
  scene.add(object);
  new Canvas2DRenderer(context).render(scene, camera());
  return context;
}

const lineTos = context => context.commands.filter(entry => entry[0] === 'lineTo');

test('Write reveals leaves one after another with a lag, Unwrite erases in reverse', () => {
  const a = new Line(0, 0, 1, 0), b = new Line(0, 1, 1, 1);
  const group = new Group([a, b]);
  const writing = new Write(group, { duration: 1, lag: 0.5, ease: easing.linear });
  writing.advance(0);
  assert.deepEqual([a.reveal, b.reveal], [0, 0]);
  // Two leaves with lag 0.5: each takes 2/3 of the time, b starts at 1/3.
  writing.advance(1 / 3);
  assert.ok(Math.abs(a.reveal - 0.5) < 1e-12 && b.reveal === 0);
  writing.advance(1 / 3);
  assert.ok(a.reveal === 1 && Math.abs(b.reveal - 0.5) < 1e-12);
  writing.advance(1);
  assert.ok(writing.done && a.reveal === 1 && b.reveal === 1);

  const erasing = new Unwrite([a, b], { duration: 1, lag: 0.5, ease: easing.linear });
  erasing.advance(1 / 3);
  assert.ok(a.reveal === 1 && Math.abs(b.reveal - 0.5) < 1e-12, 'the last written is erased first');
  erasing.finish();
  assert.deepEqual([a.reveal, b.reveal], [0, 0]);
});

test('Write validates its input and a scene reports when it is animating', () => {
  assert.throws(() => new Write({}), TypeError);
  assert.throws(() => new Write(new Line(0, 0, 1, 1), { lag: 2 }), RangeError);
  assert.throws(() => new Line(0, 0, 1, 1).setReveal(1.5), RangeError);
  assert.throws(() => new Line(0, 0, 1, 1, { reveal: -0.1 }), RangeError);
  const scene = new Scene();
  const line = new Line(0, 0, 1, 1);
  scene.add(line);
  assert.equal(scene.animating, false);
  scene.play(new Write(line, { duration: 0.5 }));
  assert.equal(scene.animating, true);
  scene.update(0.25);
  assert.ok(line.reveal > 0 && line.reveal < 1);
  scene.update(0.5);
  assert.equal(scene.animating, false);
  assert.equal(line.reveal, 1);
});

test('a partly revealed stroke is drawn up to that fraction of its length', () => {
  const half = draw(new Line(10, 50, 90, 50, { style: plain, reveal: 0.5 }));
  assert.deepEqual(lineTos(half).map(entry => entry.slice(1)), [[50, 50]]);
  const rectangle = draw(new Rectangle(20, 20, { x: 50, y: 50, style: plain, reveal: 0.5 }));
  // Half of the 80-unit perimeter: the top edge and the right edge.
  assert.deepEqual(lineTos(rectangle).map(entry => entry.slice(1)), [[60, 40], [60, 60]]);
  assert.equal(rectangle.count('closePath'), 0);
  assert.equal(draw(new Line(10, 50, 90, 50, { style: plain, reveal: 0 })).count('stroke'), 0);
  const curve = new CurveLayer({ x: new Float32Array([0, 10, 20, 30]), y: new Float32Array([0, 0, 0, 0]), style: plain, reveal: 0.5 });
  const drawn = lineTos(draw(curve));
  assert.equal(drawn.at(-1)[1], 15);
});

test('an arrow writes its shaft first and its head last', () => {
  const style = { ...plain };
  const shaftOnly = draw(new Arrow(10, 50, 90, 50, { style, reveal: 0.4 }));
  assert.equal(shaftOnly.count('stroke'), 1);
  assert.equal(lineTos(shaftOnly)[0][1], 50, 'half of the shaft at reveal 0.4');
  assert.equal(draw(new Arrow(10, 50, 90, 50, { style, reveal: 1 })).count('stroke'), 2);
});

test('chalk grain appears only behind the pen', () => {
  const style = chalkStyle('dusty', { stroke: '#fff', width: 2 });
  const count = reveal => lineTos(draw(new Line(5, 50, 95, 50, { style, reveal }), { width: 400, height: 400 })).length;
  const full = count(1), part = count(0.3);
  assert.ok(part > 0 && part < full * 0.5, `${part} of ${full}`);
  const context = draw(new Line(5, 50, 95, 50, { style, reveal: 0.3 }), { width: 400, height: 400 });
  // Everything drawn lies in the first ~30 % of the line (x from 20 to 380 device px).
  const xs = lineTos(context).map(entry => entry[1]);
  assert.ok(Math.max(...xs) < 20 + 0.3 * 360 + 12, `max x ${Math.max(...xs)}`);
});

test('text and formulas are written in reading order', () => {
  const text = draw(new TextLabel('abcd', { x: 50, y: 50, size: 10, align: 'center', reveal: 0.5 }));
  const [, shown, x] = text.commands.find(entry => entry[0] === 'fillText');
  assert.equal(shown, 'ab');
  // Recording measureText is 8 px per character: the full line would start at 50 - 16.
  assert.equal(x, 34);
  const formula = draw(new MathLabel('a+b', { x: 50, y: 50, size: 10, reveal: 0.34 }));
  assert.deepEqual(formula.commands.filter(entry => entry[0] === 'fillText').map(entry => entry[1]), ['a', '+']);
  assert.equal(draw(new MathLabel('a+b', { x: 50, y: 50, size: 10, reveal: 0 })).count('fillText'), 0);
});
