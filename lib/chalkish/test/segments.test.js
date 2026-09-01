import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas2DRenderer } from '../src/canvas2d.js';
import { chalkStyle } from '../src/chalk.js';
import { Camera2D, Scene } from '../src/core.js';
import {
  CartesianGrid,
  SegmentLayer,
  cellMaskBoundarySegments,
} from '../src/segments.js';
import { RecordingContext2D } from '../support/recording-context.js';

test('SegmentLayer binds caller-owned packed endpoints and replaces them atomically', () => {
  const segments = new Float32Array([
    0, 0, 1, 0,
    1, 0, 1, 1,
  ]);
  const layer = new SegmentLayer({ segments, copy: false });

  assert.equal(layer.segments, segments);
  assert.equal(layer.count, 2);
  assert.equal(layer.capacity, 2);
  assert.equal(layer.dataVersion, 1);

  assert.throws(
    () => layer.setCount(3),
    /count.*0.*2.*No segment state was changed/i,
  );
  assert.equal(layer.count, 2);

  const previous = layer.segments;
  assert.throws(
    () => layer.setSegments(new Float32Array(4), { count: 2, copy: false }),
    /count.*0.*1.*No segment state was changed/i,
  );
  assert.equal(layer.segments, previous);
  assert.equal(layer.count, 2);

  const replacement = new Float64Array([
    -1, -1, 1, 1,
    -1, 1, 1, -1,
    0, -1, 0, 1,
  ]);
  layer.setSegments(replacement, { copy: false });
  assert.equal(layer.segments, replacement);
  assert.equal(layer.count, 3);
  assert.equal(layer.dataVersion, 2);
});

test('renderer emits one cached path for clean disconnected segments', () => {
  const context = new RecordingContext2D(400, 200);
  const renderer = new Canvas2DRenderer(context);
  const scene = new Scene();
  const layer = new SegmentLayer({
    segments: new Float32Array([
      -1, -0.5, 1, -0.5,
      -1, 0, 1, 0,
      -1, 0.5, 1, 0.5,
    ]),
    style: {
      stroke: '#fff',
      width: 1,
      roughness: 0,
      passes: 1,
    },
  });
  scene.add(layer);
  const camera = new Camera2D({ height: 2 });

  const firstStart = context.commands.length;
  const first = renderer.render(scene, camera);
  const firstCommands = context.commands.slice(firstStart);
  const second = renderer.render(scene, camera);

  assert.equal(first.segments, 3);
  assert.equal(first.drawCalls, 1);
  assert.equal(
    firstCommands.filter(([name]) => name === 'moveTo').length,
    3,
  );
  assert.equal(
    firstCommands.filter(([name]) => name === 'lineTo').length,
    3,
  );
  assert.ok(first.cacheMisses > 0);
  assert.equal(second.cacheMisses, 0);

  layer.segments[1] = -0.25;
  layer.markDataDirty();
  assert.ok(renderer.render(scene, camera).cacheMisses > 0);
});

test('chalk-material segments stay deterministic and batch independently of count', () => {
  const context = new RecordingContext2D(480, 240);
  const renderer = new Canvas2DRenderer(context);
  const scene = new Scene();
  const packed = new Float32Array(64 * 4);
  for (let index = 0; index < 64; index += 1) {
    const x = -1.5 + (index % 8) * 0.4;
    const y = -0.7 + Math.floor(index / 8) * 0.2;
    packed.set([x, y, x + 0.18, y + 0.08], index * 4);
  }
  const layer = new SegmentLayer({
    segments: packed,
    style: chalkStyle('dusty'),
  });
  scene.add(layer);
  const camera = new Camera2D({ height: 2 });

  function capture() {
    const start = context.commands.length;
    const stats = renderer.render(scene, camera);
    return {
      stats,
      commands: context.commands.slice(start),
    };
  }

  const initial = capture();
  const redraw = capture();
  assert.equal(initial.stats.segments, 64);
  assert.equal(initial.stats.materialGroupBuilds, 1);
  assert.equal(redraw.stats.materialGroupBuilds, 0);
  assert.equal(redraw.stats.cacheMisses, 0);
  assert.ok(initial.stats.materialSegments > 64);
  assert.ok(initial.stats.materialFragments > 0);
  assert.ok(initial.stats.drawCalls <= layer.style.passes * 4);
  assert.ok(initial.stats.drawCalls < layer.count);

  camera.setHeight(1.3);
  capture();
  camera.setHeight(2);
  const restored = capture();
  assert.deepEqual(restored.commands, initial.commands);
});

test('SegmentLayer handles empty data and rejects non-finite active endpoints', () => {
  const empty = new SegmentLayer();
  const emptyScene = new Scene();
  emptyScene.add(empty);
  const renderer = new Canvas2DRenderer(new RecordingContext2D());
  const stats = renderer.render(emptyScene);
  assert.equal(stats.segments, 0);
  assert.equal(stats.drawCalls, 0);

  const invalid = new SegmentLayer({
    segments: new Float32Array([0, 0, Number.NaN, 1]),
  });
  const invalidScene = new Scene();
  invalidScene.add(invalid);
  assert.throws(
    () => renderer.render(invalidScene),
    /SegmentLayer endpoint 0 is not finite/i,
  );
});

test('CartesianGrid generates cell boundaries in one packed layer and resets atomically', () => {
  const grid = new CartesianGrid({
    columns: 2,
    rows: 1,
    minX: -1,
    maxX: 1,
    minY: 2,
    maxY: 4,
  });

  assert.equal(grid.count, 5);
  assert.deepEqual(Array.from(grid.segments), [
    -1, 2, -1, 4,
    0, 2, 0, 4,
    1, 2, 1, 4,
    -1, 2, 1, 2,
    -1, 4, 1, 4,
  ]);

  const previousSegments = grid.segments;
  const previousVersion = grid.dataVersion;
  assert.throws(
    () => grid.setGrid({ columns: 0 }),
    /columns.*positive integer.*No grid state was changed/i,
  );
  assert.equal(grid.segments, previousSegments);
  assert.equal(grid.dataVersion, previousVersion);
  assert.equal(grid.columns, 2);

  grid.setGrid({ columns: 3, rows: 2, maxX: 2 });
  assert.equal(grid.columns, 3);
  assert.equal(grid.rows, 2);
  assert.equal(grid.maxX, 2);
  assert.equal(grid.count, 7);

  const context = new RecordingContext2D(400, 200);
  const renderer = new Canvas2DRenderer(context);
  const scene = new Scene();
  scene.add(grid);
  const stats = renderer.render(
    scene,
    new Camera2D({ centerX: 0.5, centerY: 3, height: 3 }),
  );
  assert.equal(stats.segments, 7);
  assert.equal(stats.drawCalls, 1);
});

test('cellMaskBoundarySegments follows cell faces without inventing smooth geometry', () => {
  const mask = new Uint8Array([
    1, 0,
    1, 1,
  ]);
  const boundary = cellMaskBoundarySegments(mask, 2, 2, {
    minX: 0,
    maxX: 2,
    minY: 0,
    maxY: 2,
  });

  assert.ok(boundary instanceof Float32Array);
  assert.equal(boundary.length, 8 * 4);
  const normalized = new Set();
  for (let offset = 0; offset < boundary.length; offset += 4) {
    const a = `${boundary[offset]},${boundary[offset + 1]}`;
    const b = `${boundary[offset + 2]},${boundary[offset + 3]}`;
    normalized.add([a, b].sort().join('→'));
  }
  assert.deepEqual(normalized, new Set([
    '0,0→0,1',
    '0,0→1,0',
    '0,1→0,2',
    '0,2→1,2',
    '1,0→1,1',
    '1,1→2,1',
    '1,2→2,2',
    '2,1→2,2',
  ]));

  assert.equal(
    cellMaskBoundarySegments(new Uint8Array(4), 2, 2).length,
    0,
  );
  assert.throws(
    () => cellMaskBoundarySegments(new Uint8Array(3), 2, 2),
    /mask length is 3.*expected columns × rows = 4/i,
  );
  assert.throws(
    () => cellMaskBoundarySegments(mask, 2, 2, { minX: 1, maxX: 1 }),
    /domain.*increasing.*No boundary geometry was produced/i,
  );
});
