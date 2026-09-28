import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas2DRenderer } from '../src/canvas2d.js';
import { Camera2D, Circle, Group, Line, MathLabel, Rectangle, Scene, TextLabel } from '../src/core.js';
import { CurveLayer } from '../src/curve.js';
import { bindPointerDrag } from '../src/interaction.js';
import { arrange, DOWN, getBounds, hitTest, LEFT, moveTo, nextTo, Panel, RIGHT, UP, wrapTextLines } from '../src/layout.js';
import { RecordingContext2D } from '../support/recording-context.js';

const measure = (text) => Array.from(text).length * 0.5;

test('bounds follow shapes through group transforms', () => {
  const rectangle = new Rectangle(2, 1, { x: 3, y: 4 });
  assert.deepEqual(
    (({ minX, maxX, minY, maxY }) => [minX, maxX, minY, maxY])(getBounds(rectangle)),
    [2, 4, 3.5, 4.5],
  );
  const group = new Group([new Line(0, 0, 1, 0), new Circle(0.5, { x: 2 })], { x: 10, scale: 2 });
  const bounds = getBounds(group);
  assert.deepEqual([bounds.minX, bounds.maxX, bounds.minY, bounds.maxY], [10, 15, -1, 1]);
  assert.equal(bounds.centerX, 12.5);
  const curve = new CurveLayer({ x: new Float32Array([0, 1, 2]), y: new Float32Array([0, 3, 1]), count: 2 });
  assert.equal(getBounds(curve).maxY, 3);
  assert.equal(getBounds(new Group()), null);
  assert.equal(getBounds(new TextLabel('pixel text')), null, 'pixel-sized text has no world size');
  assert.throws(() => getBounds({}), TypeError);
});

test('text and formula bounds use the measure, alignment, baseline and y direction', () => {
  const text = new TextLabel('abcd', { size: 1, align: 'center', baseline: 'middle' });
  const up = getBounds(text, { measure });
  assert.deepEqual([up.minX, up.maxX, up.minY, up.maxY], [-1, 1, -0.5, 0.5]);
  const top = getBounds(new TextLabel('ab', { size: 2, align: 'left', baseline: 'top' }), { measure, yUp: false });
  assert.deepEqual([top.minX, top.maxX, top.minY, top.maxY], [0, 2, 0, 2]);
  const wrapped = getBounds(new TextLabel('one two three four', { size: 1, maxWidth: 4.5, wrap: true, align: 'left', baseline: 'top' }), { measure });
  assert.ok(wrapped.width <= 4.5 && wrapped.height > 2, 'several lines');
  const formula = getBounds(new MathLabel('\\frac{a}{b}', { size: 1 }), { measure });
  assert.ok(formula.height > 1, 'a fraction is taller than a line');
});

test('nextTo, arrange and moveTo place objects by their bounds', () => {
  const a = new Rectangle(2, 2);
  const b = new Rectangle(1, 1);
  nextTo(b, a, RIGHT, { buff: 0.5 });
  assert.deepEqual([b.x, b.y], [2, 0]);
  nextTo(b, a, UP, { buff: 0, align: -1 });
  assert.deepEqual([b.x, b.y], [-0.5, 1.5]);
  nextTo(b, a, LEFT);
  assert.equal(getBounds(b).maxX, -1.25);
  nextTo(b, a, DOWN, { align: 1 });
  assert.equal(getBounds(b).maxX, 1);
  const row = [new Rectangle(1, 1), new Rectangle(2, 1), new Rectangle(1, 3)];
  arrange(row, RIGHT, { buff: 0.1 });
  assert.deepEqual(row.map((r) => r.x), [0, 1.6, 3.2]);
  const group = new Group(row);
  moveTo(group, 0, 0);
  assert.ok(Math.abs(getBounds(group).centerX) < 1e-12 && Math.abs(getBounds(group).centerY) < 1e-12);
  assert.throws(() => nextTo(a, b, [1, 1]), RangeError);
  assert.throws(() => nextTo(new Group(), a), RangeError);
});

test('hitTest finds the topmost drawn object near a point', () => {
  const scene = new Scene();
  const line = new Line(0, 0, 10, 0);
  const disk = new Circle(1, { x: 5, style: { fill: '#fff' } });
  const ring = new Circle(1, { x: 8 });
  const label = new TextLabel('xyz', { x: 2, y: 3, size: 1, align: 'left', baseline: 'middle' });
  scene.add(line, disk, ring, new Group([label]));
  assert.equal(hitTest(scene, 5, 0.2)?.object, disk, 'the disk is drawn above the line');
  assert.equal(hitTest(scene, 2, 0.03)?.object, line);
  assert.equal(hitTest(scene, 8, 0.5), null, 'inside an unfilled ring is empty');
  assert.equal(hitTest(scene, 9, 0)?.object, ring);
  assert.equal(hitTest(scene, 2.5, 3, { measure })?.object, label);
  disk.visible = false;
  assert.equal(hitTest(scene, 5, 0.02)?.object, line);
  line.interactive = false;
  assert.equal(hitTest(scene, 2, 0.03), null);
});

test('clipping groups and wrapped text reach the canvas', () => {
  const context = new RecordingContext2D(100, 100);
  const scene = new Scene({ background: null });
  const clipped = new Group([new Line(-5, 0, 5, 0, { style: { stroke: '#fff', roughness: 0, passes: 1 } })], { clip: { minX: -1, maxX: 1, minY: -1, maxY: 1 } });
  const text = new TextLabel('one two three four five', { x: 0, y: 0, size: 10, maxWidth: 60, wrap: true, align: 'left', baseline: 'top' });
  scene.add(clipped, text);
  new Canvas2DRenderer(context).render(scene, new Camera2D({ height: 100, flipY: false }));
  assert.equal(context.commands.filter((entry) => entry[0] === 'save').length >= 2, true);
  assert.equal(context.count('clip'), 1);
  assert.ok(context.commands.some((entry) => entry[0] === 'restore'));
  const lines = context.commands.filter((entry) => entry[0] === 'fillText').map((entry) => entry[1]);
  // Recording measureText: 8 px per character, 60 px per line.
  assert.deepEqual(lines, ['one two', 'three', 'four', 'five']);
  assert.throws(() => new Group([], { clip: { minX: 0 } }), RangeError);
  assert.throws(() => new TextLabel('x', { wrap: true }), RangeError);
  assert.deepEqual(wrapTextLines('a b c\nd', 2, measure), ['a b', 'c', 'd']);
});

test('a panel holds a title and clipped content inside its frame', () => {
  const panel = new Panel({ x: 0, y: 0, width: 4, height: 3, title: 'Speeds', titleSize: 0.3, padding: 0.2 });
  assert.equal(panel.children.length, 3);
  assert.ok(panel.content.clip);
  assert.ok(Math.abs(panel.innerHeight - (3 - 0.4 - 0.42)) < 1e-12);
  const dot = new Circle(0.1, { x: 0.5, y: -0.5 });
  panel.content.add(dot);
  const bounds = getBounds(dot);
  assert.ok(bounds.minX > -2 && bounds.maxY < 1.5, 'content starts at the inner top-left corner');
  assert.throws(() => new Panel({ width: 0, height: 1 }), RangeError);
});

test('bindPointerDrag picks at the pointer and moves the picked object', () => {
  const listeners = {};
  const target = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type) => { delete listeners[type]; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    setPointerCapture() {}, releasePointerCapture() {},
  };
  const camera = new Camera2D({ centerX: 0, centerY: 0, height: 10 });
  const handle = new Circle(0.3, { x: 0, y: 0 });
  const moves = [];
  const drag = bindPointerDrag({
    target, getCamera: () => camera,
    pick: (x, y, tolerance) => (Math.hypot(x - handle.x, y - handle.y) <= handle.radius + tolerance ? handle : null),
    onDrag: (object, x, y) => { object.setPosition(x, y); moves.push([x, y]); },
  });
  const event = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, preventDefault() {}, stopPropagation() {} });
  listeners.pointerdown(event(100, 50));
  assert.equal(drag.dragging, handle);
  listeners.pointermove(event(120, 40));
  assert.deepEqual(moves.at(-1), [2, 1], '20 px right and 10 px up at 10 px per unit');
  listeners.pointerup(event(120, 40));
  assert.equal(drag.dragging, null);
  listeners.pointerdown(event(10, 10));
  assert.equal(drag.dragging, null, 'nothing picked there');
  drag.dispose();
  assert.deepEqual(Object.keys(listeners), []);
});
