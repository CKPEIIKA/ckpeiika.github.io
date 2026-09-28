import assert from 'node:assert/strict';
import test from 'node:test';

import { easing, FadeIn, FadeOut, Indicate, Transform } from '../src/animation.js';
import { Arrow, Group, Line, Polyline, Scene } from '../src/core.js';
import { CurveLayer } from '../src/curve.js';

const linear = { duration: 1, ease: easing.linear };
const close = (a, b) => Math.abs(a - b) < 1e-6;

test('Transform morphs a line into another line and blends its colour', () => {
  const line = new Line(0, 0, 1, 0, { style: { stroke: '#000000' } });
  const morph = new Transform(line, new Line(0, 2, 1, 2, { style: { stroke: '#ffffff' } }), linear);
  morph.advance(0.5);
  assert.deepEqual(Array.from(line.points), [0, 1, 1, 1]);
  assert.equal(line.style.stroke, '#808080');
  morph.finish();
  assert.deepEqual(Array.from(line.points), [0, 2, 1, 2]);
  assert.equal(line.style.stroke, '#ffffff');
});

test('Transform resamples shapes with different point counts along their length', () => {
  const curve = new CurveLayer({ x: new Float32Array([0, 1]), y: new Float32Array([0, 0]) });
  const target = new Polyline(new Float32Array([0, 0, 1, 1, 2, 0]));
  const morph = new Transform(curve, target, linear);
  morph.finish();
  assert.equal(curve.count, 3);
  assert.deepEqual(Array.from(curve.positionsX.slice(0, 3)), [0, 1, 2]);
  assert.deepEqual(Array.from(curve.positionsY.slice(0, 3)), [0, 1, 0]);
  // A polyline takes the finer resolution; the halfway shape lies between the two.
  const path = new Polyline(new Float32Array([0, 0, 2, 0]));
  const halfway = new Transform(path, new Float32Array([0, 2, 1, 2, 2, 2]), linear);
  halfway.advance(0.5);
  assert.deepEqual(Array.from(path.points), [0, 1, 1, 1, 2, 1]);
  // An arrow keeps its two points.
  const arrow = new Arrow(0, 0, 1, 0);
  new Transform(arrow, new Float32Array([0, 0, 0, 5, 3, 5]), linear).finish();
  assert.equal(arrow.points.length, 4);
  assert.deepEqual(Array.from(arrow.points), [0, 0, 3, 5]);
  assert.throws(() => new Transform(new Group(), arrow), TypeError);
});

test('FadeIn and FadeOut change opacity, drift and visibility, then restore the place', () => {
  const line = new Line(0, 0, 1, 0, { x: 5, y: 5, opacity: 0.8 });
  const fadeIn = new FadeIn(line, { ...linear, shift: [2, 0] });
  fadeIn.advance(0);
  assert.equal(line.opacity, 0);
  assert.equal(line.x, 3);
  fadeIn.finish();
  assert.ok(close(line.opacity, 0.8) && line.x === 5);
  const fadeOut = new FadeOut(line, linear);
  fadeOut.advance(0.5);
  assert.ok(close(line.opacity, 0.4));
  fadeOut.finish();
  assert.equal(line.visible, false);
  assert.ok(close(line.opacity, 0.8));
  new FadeIn(line, linear).finish();
  assert.equal(line.visible, true);
});

test('Indicate swells an object about its centre and returns it exactly', () => {
  const line = new Line(10, 0, 20, 0, { style: { stroke: '#000000' } });
  const indicate = new Indicate(line, { ...linear, scale: 2, color: '#ffffff' });
  indicate.advance(0.5);
  // Doubled about (15, 0): the line now spans 5…25.
  assert.equal(line.scaleX, 2);
  assert.equal(line.x + line.scaleX * 10, 5);
  assert.equal(line.x + line.scaleX * 20, 25);
  assert.equal(line.style.stroke, '#ffffff');
  indicate.finish();
  assert.deepEqual([line.x, line.y, line.scaleX, line.scaleY], [0, 0, 1, 1]);
  assert.equal(line.style.stroke, '#000000');
  const group = new Group([new Line(0, 0, 2, 0), new Line(0, 2, 2, 2)]);
  const scene = new Scene();
  scene.add(group);
  scene.play(new Indicate(group, { duration: 0.5 }));
  scene.update(0.25);
  assert.ok(group.scaleX > 1);
  scene.update(0.5);
  assert.equal(group.scaleX, 1);
  assert.equal(scene.animating, false);
});
