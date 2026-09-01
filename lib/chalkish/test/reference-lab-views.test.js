import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas2DRenderer } from '../src/canvas2d.js';
import { createDgFvLabController } from '../examples/boards/_shared/dg-fv-lab-controller.js';
import { createDsmcLabController } from '../examples/boards/_shared/dsmc-lab-controller.js';
import {
  CartesianGrid,
  SegmentLayer,
  cellMaskBoundarySegments,
} from '../src/segments.js';
import { RecordingContext2D } from '../support/recording-context.js';

function screenY(camera, object, width, height) {
  const matrix = new Float64Array(6);
  camera.matrix(matrix, width, height);
  return matrix[1] * object.x + matrix[3] * object.y + matrix[5];
}

test('DG/FV adapter switches between one batched field and one batched curve', () => {
  const controller = createDgFvLabController({
    model: {
      caseId: 'diamond-translation',
      columns: 20,
      rows: 12,
      degree: 0,
      limiter: 'off',
      displayField: 'field',
    },
    styleName: 'dusty',
  });
  assert.equal(controller.view.layers.field.visible, true);
  assert.equal(controller.view.layers.curve.visible, false);
  assert.equal(controller.view.layers.field.data, controller.model.state.scalar);

  const context = new RecordingContext2D(960, 540);
  const renderer = new Canvas2DRenderer(context);
  controller.update(1 / 60);
  renderer.render(controller.scene, controller.camera);
  assert.ok(
    context.count('drawImage') + context.count('putImageData') >= 1,
    'packed field should emit one image batch',
  );

  controller.reset({
    caseId: 'burgers',
    columns: 64,
    rows: 1,
    degree: 1,
    limiter: 'minmod',
    initialCondition: 'riemann',
    displayField: 'field',
  });
  assert.equal(controller.view.layers.field.visible, false);
  assert.equal(controller.view.layers.curve.visible, true);
  assert.equal(controller.view.layers.curve.positionsY, controller.model.state.scalar);
  renderer.render(controller.scene, controller.camera);
  assert.ok(context.count('stroke') >= 1, 'Burgers curve should use one stroke batch');
  controller.dispose();
});

test('DSMC adapter binds runtime-owned particle and occupancy arrays', () => {
  const controller = createDsmcLabController({
    model: {
      caseId: 'equilibrium-box',
      particleCount: 256,
      seed: 9,
      cellSize: 1,
    },
    styleName: 'dusty',
  });
  const { layers } = controller.view;
  assert.equal(layers.particles.positionsX, controller.model.state.positionsX);
  assert.equal(layers.particles.positionsY, controller.model.state.positionsY);
  assert.equal(layers.occupancy.data, controller.model.state.occupancy);
  assert.equal(layers.particles.count, 256);
  assert.ok(layers.distributionFrame);
  assert.ok(layers.distributionLabel);

  const context = new RecordingContext2D(960, 540);
  const renderer = new Canvas2DRenderer(context);
  controller.update(1 / 60);
  renderer.render(controller.scene, controller.camera);
  assert.ok(
    context.count('drawImage') + context.count('putImageData') >= 1,
    'occupancy should emit one image batch',
  );
  assert.ok(context.count('arc') >= 256, 'particle batch should emit particle arcs');
  assert.ok(context.count('stroke') >= 1, 'domain and wall rules should be stroked');
  controller.dispose();
});

test('DG/FV adapter draws solver cells and the exact solver-owned mask boundary', () => {
  const controller = createDgFvLabController({
    model: {
      caseId: 'euler-cylinder',
      columns: 24,
      rows: 12,
      degree: 1,
      bodyShape: 'cylinder',
      bodyRadius: 0.2,
      displayField: 'density',
    },
    styleName: 'dusty',
  });
  const snapshot = controller.snapshot();
  const { grid, bodyBoundary } = controller.view.layers;

  assert.ok(grid instanceof CartesianGrid);
  assert.ok(grid.style.roughness > 0, 'the solver grid must use rough chalk strokes');
  assert.equal(grid.style.wobble, 0, 'the solver grid must avoid the costly deposit material');
  assert.equal(grid.style.passes, 2, 'the solver grid must use two cheap chalk passes');
  assert.equal(grid.columns, snapshot.dimensions.cellsX);
  assert.equal(grid.rows, snapshot.dimensions.cellsY);
  assert.equal(grid.count, 24 + 12 + 2);
  assert.ok(
    snapshot.dimensions.columns > grid.columns,
    'the grid must describe solver cells, not higher-order display samples',
  );

  assert.ok(bodyBoundary instanceof SegmentLayer);
  assert.equal(
    snapshot.state.solidCellMask.length,
    snapshot.dimensions.cellsX * snapshot.dimensions.cellsY,
  );
  const expected = cellMaskBoundarySegments(
    snapshot.state.solidCellMask,
    snapshot.dimensions.cellsX,
    snapshot.dimensions.cellsY,
    snapshot.domain,
  );
  assert.deepEqual(bodyBoundary.segments, expected);
  assert.ok(bodyBoundary.count > 0);
  assert.equal(bodyBoundary.visible, true);

  const dx = (snapshot.domain.maxX - snapshot.domain.minX) / snapshot.dimensions.cellsX;
  const dy = (snapshot.domain.maxY - snapshot.domain.minY) / snapshot.dimensions.cellsY;
  for (const coordinate of bodyBoundary.segments) {
    const alignedX = Math.abs(
      (coordinate - snapshot.domain.minX) / dx
      - Math.round((coordinate - snapshot.domain.minX) / dx),
    ) < 2e-6;
    const alignedY = Math.abs(
      (coordinate - snapshot.domain.minY) / dy
      - Math.round((coordinate - snapshot.domain.minY) / dy),
    ) < 2e-6;
    assert.ok(alignedX || alignedY, `boundary coordinate ${coordinate} is off the cell grid`);
  }

  controller.reset({
    columns: 32,
    rows: 16,
    degree: 0,
    bodyShape: 'none',
  });
  assert.equal(grid.columns, 32);
  assert.equal(grid.rows, 16);
  assert.equal(grid.count, 50);
  assert.equal(bodyBoundary.count, 0);
  assert.equal(bodyBoundary.visible, false);
  controller.dispose();
});

test('DSMC adapter draws the actual collision-cell grid and follows cell-size resets', () => {
  const controller = createDsmcLabController({
    model: {
      caseId: 'equilibrium-box',
      particleCount: 256,
      seed: 17,
      cellSize: 1,
    },
    styleName: 'dusty',
  });
  const { grid } = controller.view.layers;
  let snapshot = controller.snapshot();

  assert.ok(grid instanceof CartesianGrid);
  assert.ok(grid.style.roughness > 0, 'the collision-cell grid must use rough chalk strokes');
  assert.equal(grid.style.wobble, 0, 'the collision-cell grid must avoid the costly deposit material');
  assert.equal(grid.style.passes, 2, 'the collision-cell grid must use two cheap chalk passes');
  assert.equal(grid.columns, snapshot.dimensions.columns);
  assert.equal(grid.rows, snapshot.dimensions.rows);
  assert.equal(
    grid.count,
    snapshot.dimensions.columns + snapshot.dimensions.rows + 2,
  );
  assert.deepEqual(
    [grid.minX, grid.maxX, grid.minY, grid.maxY],
    [
      snapshot.domain.minX,
      snapshot.domain.maxX,
      snapshot.domain.minY,
      snapshot.domain.maxY,
    ],
  );

  controller.reset({ cellSize: 0.5 });
  snapshot = controller.snapshot();
  assert.equal(grid.columns, snapshot.dimensions.columns);
  assert.equal(grid.rows, snapshot.dimensions.rows);
  assert.equal(
    grid.count,
    snapshot.dimensions.columns + snapshot.dimensions.rows + 2,
  );
  controller.dispose();
});

test('lab headings remain separated and unclipped in a narrow viewport', () => {
  const controllers = [
    createDgFvLabController({
      model: {
        caseId: 'euler-cylinder',
        columns: 24,
        rows: 12,
        degree: 0,
      },
    }),
    createDsmcLabController({
      model: {
        particleCount: 256,
        cellSize: 1,
      },
    }),
  ];

  for (const controller of controllers) {
    const heading = controller.view.layers.heading;
    const method = controller.view.layers.formula ?? controller.view.layers.method;
    const frame = controller.view.layers.frame;
    const headingY = screenY(controller.camera, heading, 352, 198);
    const methodY = screenY(controller.camera, method, 352, 198);
    assert.ok(headingY >= 10, `heading begins too close to the top edge: ${headingY}`);
    assert.ok(methodY - headingY >= 16, `heading and method overlap: ${methodY - headingY}`);
    assert.ok(
      method.y >= frame.y + frame.height / 2,
      'method annotation must not obscure the numerical field',
    );
    controller.dispose();
  }
});
