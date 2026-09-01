import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DG_FV_CASES,
  DgFvLabModel,
  createDgFvLabModel,
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
