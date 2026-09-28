import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas2DRenderer } from '../src/canvas2d.js';
import { Camera2D, Circle, Group, Line, Scene, TextLabel } from '../src/core.js';
import { RecordingContext2D } from '../support/recording-context.js';

const plain = { stroke: '#fff', width: 1, roughness: 0, passes: 1 };

function setup() {
  const main = new RecordingContext2D(200, 100);
  const layers = [];
  const renderer = new Canvas2DRenderer(main, {
    createLayer: (width, height) => {
      const context = new RecordingContext2D(width, height);
      layers.push(context);
      return { canvas: context.canvas, context };
    },
  });
  const axes = new Group([new Line(0, 0, 10, 0, { style: plain }), new TextLabel('0', { size: 1 })], { cache: true });
  const marker = new Circle(1, { style: plain });
  const scene = new Scene();
  scene.add(axes, marker);
  const camera = new Camera2D({ height: 20 });
  const frame = () => {
    const start = main.commands.length;
    const stats = renderer.render(scene, camera);
    return { stats, commands: main.commands.slice(start) };
  };
  return { main, layers, renderer, axes, marker, scene, camera, frame };
}

test('a cached group is drawn once into its layer and blitted while unchanged', () => {
  const { layers, marker, frame } = setup();
  const first = frame();
  assert.equal(layers.length, 1);
  assert.equal(layers[0].count('stroke'), 1, 'the line was drawn into the layer');
  assert.equal(first.commands.filter((c) => c[0] === 'drawImage').length, 1);
  const strokesInLayer = layers[0].count('stroke');
  marker.setPosition(3, 2);
  const second = frame();
  assert.equal(layers[0].count('stroke'), strokesInLayer, 'the axes were not drawn again');
  assert.equal(second.stats.layerHits, 1);
  assert.equal(second.commands.filter((c) => c[0] === 'drawImage').length, 1);
  assert.ok(second.commands.some((c) => c[0] === 'arc' || c[0] === 'lineTo'), 'the marker is drawn directly');
});

test('changes inside the group, to its transform or to the camera redraw the layer', () => {
  const { layers, axes, camera, frame } = setup();
  frame();
  const count = () => layers[0].count('stroke');
  let before = count();
  axes.children[0].setEndpoints(0, 0, 5, 5);
  frame();
  assert.ok(count() > before, 'geometry change');
  before = layers[0].count('fillText');
  axes.children[1].setText('1');
  frame();
  assert.ok(layers[0].count('fillText') > before, 'text change');
  before = layers[0].commands.length;
  axes.setPosition(1, 0);
  frame();
  assert.ok(layers[0].commands.length > before, 'group moved');
  before = layers[0].commands.length;
  camera.zoom(2);
  frame();
  assert.ok(layers[0].commands.length > before, 'camera changed');
  before = layers[0].commands.length;
  axes.children[0].setStyle({ stroke: '#f00' });
  frame();
  assert.ok(layers[0].commands.length > before, 'style changed');
  before = layers[0].commands.length;
  frame();
  assert.equal(layers[0].commands.length, before, 'nothing changed: nothing redrawn');
});

test('without offscreen canvases a cached group is simply drawn every frame', () => {
  const main = new RecordingContext2D(200, 100);
  const renderer = new Canvas2DRenderer(main, { createLayer: () => null });
  const scene = new Scene();
  scene.add(new Group([new Line(0, 0, 1, 0, { style: plain })], { cache: true }));
  renderer.render(scene, new Camera2D());
  renderer.render(scene, new Camera2D());
  assert.equal(main.count('stroke'), 2);
  assert.equal(main.count('drawImage'), 0);
});
