import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DG_FV_CASES,
  DgFvLabModel,
  createDgFvLabModel,
  obliqueShockAngle,
} from '../examples/boards/dg-fv-lab/dg-fv-lab-model.js';

test('DG/FV lab exposes all four reference equation families', () => {
  assert.deepEqual(DG_FV_CASES, [
    'euler-cylinder',
    'diamond-translation',
    'scalar-advection',
    'burgers',
  ]);
  for (const caseId of DG_FV_CASES) {
    const model = createDgFvLabModel({
      caseId,
      columns: caseId === 'burgers' ? 48 : 24,
      rows: caseId === 'burgers' ? 1 : 12,
      degree: 0,
    });
    const snapshot = model.snapshot();
    assert.equal(snapshot.type, 'dg-fv-lab-state');
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.metadata.caseId, caseId);
    assert.equal(snapshot.ownership, 'model-readonly-view');
    assert.ok(snapshot.state.scalar.length > 0);
    model.step(1 / 60);
    assert.ok(model.diagnostics().step >= 1);
  }
});

test('largest UI mesh presets initialize and advance', () => {
  for (const options of [
    { caseId: 'euler-cylinder', columns: 192, rows: 96, degree: 0 },
    { caseId: 'burgers', columns: 320, rows: 1, degree: 1 },
  ]) {
    const model = createDgFvLabModel(options);
    model.step(1 / 60);
    const snapshot = model.snapshot();
    assert.equal(snapshot.dimensions.cellsX, options.columns);
    assert.equal(snapshot.dimensions.cellsY, options.rows);
    assert.equal(model.diagnostics().step, 1);
  }
});

test('periodic scalar DG/FV cases conserve their cell-average mass', () => {
  for (const caseId of ['diamond-translation', 'scalar-advection', 'burgers']) {
    const model = createDgFvLabModel({
      caseId,
      columns: caseId === 'burgers' ? 96 : 28,
      rows: caseId === 'burgers' ? 1 : 18,
      degree: 1,
      limiter: caseId === 'burgers' ? 'minmod' : 'filter',
    });
    const initialMass = model.diagnostics().mass;
    for (let index = 0; index < 4; index += 1) model.step(1 / 60);
    assert.ok(
      Math.abs(model.diagnostics().mass - initialMass) < 2e-10,
      `${caseId} mass drifted`,
    );
  }
});

test('DG/FV replay is deterministic and Euler stays positive with the limiter', () => {
  const options = {
    caseId: 'euler-cylinder',
    columns: 24,
    rows: 12,
    degree: 0,
    bodyShape: 'square',
    limiter: 'minmod',
  };
  const first = createDgFvLabModel(options);
  const second = createDgFvLabModel(options);
  for (let index = 0; index < 3; index += 1) {
    first.step(1 / 60);
    second.step(1 / 60);
  }
  assert.deepEqual(first.state.scalar, second.state.scalar);
  assert.ok(first.diagnostics().minimumDensity > 0);
  assert.ok(first.diagnostics().minimumPressure > 0);
  assert.ok(first instanceof DgFvLabModel);
});

test('DG/FV input validation is atomic and the model is presentation-independent', async () => {
  const model = createDgFvLabModel({ caseId: 'burgers', columns: 64, rows: 1 });
  const before = model.state.scalar;
  assert.throws(
    () => model.reset({ degree: 8 }),
    /degree is 8.*integer from 0 to 3.*No model state was changed/i,
  );
  assert.equal(model.state.scalar, before);
  assert.throws(
    () => model.step(-1),
    /dt is -1.*No model state was changed/i,
  );

  const source = await readFile(
    new URL('../examples/boards/dg-fv-lab/dg-fv-lab-model.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /\b(?:document|window|Canvas|Scene|chalkStyle)\b/);
});

test('DG/FV parity parameters include exact mesh, central flux, and body state', () => {
  const model = createDgFvLabModel({
    caseId: 'euler-cylinder',
    columns: 37,
    rows: 19,
    degree: 1,
    fluxAlpha: 0,
    mach: 1.8,
    bodyRadius: 0.13,
    gamma: 1.33,
    bodyShape: 'none',
    displayField: 'solid',
  });
  assert.equal(model.parameters.columns, 37);
  assert.equal(model.parameters.rows, 19);
  assert.equal(model.parameters.fluxAlpha, 0);
  assert.equal(model.parameters.bodyShape, 'none');
  assert.ok(model.state.scalar.every((value) => value === 0));
});

test('DG/FV teaching fields and modal comparison have stable snapshot buffers', () => {
  const euler = createDgFvLabModel({
    caseId: 'euler-cylinder',
    columns: 24,
    rows: 12,
    degree: 0,
    displayField: 'jump',
  });
  euler.step(1 / 60);
  const jump = euler.snapshot();
  assert.ok(jump.state.scalar.some((value) => Number.isFinite(value) && value >= 0));
  assert.ok(Number.isFinite(euler.diagnostics().maximumJump));
  euler.reset({ displayField: 'residual' }).step(1 / 60);
  assert.ok(Number.isFinite(euler.diagnostics().residualNorm));
  assert.equal(typeof euler.diagnostics().healthy, 'boolean');

  const burgers = createDgFvLabModel({
    caseId: 'burgers',
    columns: 64,
    rows: 1,
    degree: 2,
    displayField: 'field',
  });
  const snapshot = burgers.snapshot();
  assert.equal(snapshot.state.meanScalar.length, snapshot.state.scalar.length);
  assert.equal(snapshot.state.modalSpectrum.length, 3);
  assert.ok(snapshot.state.modalSpectrum.every(Number.isFinite));
});

test('weak theta-beta-Mach branch is exposed only when an attached solution exists', () => {
  const beta = obliqueShockAngle(2, 1.4, 10);
  assert.ok(beta > 39 && beta < 40, `unexpected weak shock angle ${beta}`);
  assert.ok(Number.isNaN(obliqueShockAngle(1.05, 1.4, 30)));
});
