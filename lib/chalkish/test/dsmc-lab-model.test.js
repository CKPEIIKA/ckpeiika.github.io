import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DSMC_LAB_CASES,
  DSMC_LAB_SPECIES,
  DsmcLabModel,
  createDsmcLabModel,
} from '../examples/boards/dsmc-lab/dsmc-lab-model.js';

test('DSMC lab exposes all four spatial reference presets', () => {
  assert.deepEqual(DSMC_LAB_CASES, [
    'equilibrium-box',
    'heat-transfer-x',
    'rotational-nitrogen',
    'couette-flow',
  ]);
  for (const caseId of DSMC_LAB_CASES) {
    const model = createDsmcLabModel({
      caseId,
      particleCount: 256,
      seed: 77,
      cellSize: 1,
    });
    const snapshot = model.snapshot();
    assert.equal(snapshot.type, 'dsmc-lab-state');
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.metadata.caseId, caseId);
    assert.equal(snapshot.ownership, 'model-readonly-view');
    assert.equal(snapshot.state.positionsX.length, 256);
    assert.ok(snapshot.state.occupancy.length > 0);
    model.step(model.parameters.timeStep);
    assert.ok(model.diagnostics().step >= 1);
  }
});

test('DSMC mixture, boundary, rotation, profile, and event state are explicit', () => {
  assert.deepEqual(DSMC_LAB_SPECIES, ['Ar', 'N2']);
  const model = createDsmcLabModel({
    caseId: 'equilibrium-box',
    particleCount: 512,
    seed: 91,
    cellSize: 0.8,
    timeStep: 0.0004,
    knudsen: 0.08,
    speciesA: 'Ar',
    speciesB: 'N2',
    mixtureFractionA: 0.5,
    xBoundary: 'specular',
    yBoundary: 'mixed',
    wallAccommodation: 0.4,
    rotationalRelaxation: true,
    rotationalCollisionNumber: 3,
    collisionLineProbability: 0.4,
    highlightEvents: true,
  });
  const before = model.snapshot();
  assert.ok(before.state.styleIndex.includes(0));
  assert.ok(before.state.styleIndex.includes(1));
  assert.equal(new Set(before.state.mass).size, 2);
  const profile = before.state.temperatureProfile;
  const collisionSegments = before.state.collisionSegments;
  model.step(model.parameters.timeStep);
  const after = model.snapshot();
  assert.equal(after.state.temperatureProfile, profile);
  assert.equal(after.state.collisionSegments, collisionSegments);
  assert.equal(after.state.profileCoordinate.length, 24);
  assert.ok(after.state.temperatureProfile.every(Number.isFinite));
  assert.ok(after.dimensions.collisionEvents <= 96);
  assert.ok(after.dimensions.rotationalEvents <= 96);
  assert.equal(after.replay.parameters.rotationalCollisionNumber, 3);
  assert.equal(after.replay.parameters.collisionLineProbability, 0.4);
  assert.equal(model.diagnostics().collisionLineProbability, 0.4);
  assert.equal(typeof model.diagnostics().majorantViolationRatio, 'number');
  assert.equal(typeof model.diagnostics().correctiveAction, 'string');
});

test('all DSMC boundary modes advance deterministically', () => {
  for (const boundary of ['periodic', 'specular', 'diffuse', 'mixed']) {
    const options = {
      particleCount: 256,
      seed: 451,
      cellSize: 1,
      xBoundary: boundary,
      yBoundary: boundary,
    };
    const first = createDsmcLabModel(options);
    const second = createDsmcLabModel(options);
    first.step(first.parameters.timeStep);
    second.step(second.parameters.timeStep);
    assert.deepEqual(first.state.positionsX, second.state.positionsX, boundary);
    assert.deepEqual(first.state.velocityY, second.state.velocityY, boundary);
  }
});

test('seeded DSMC spatial replay is bitwise deterministic', () => {
  const options = {
    caseId: 'rotational-nitrogen',
    particleCount: 384,
    seed: 2026,
    cellSize: 0.8,
  };
  const first = createDsmcLabModel(options);
  const second = createDsmcLabModel(options);
  for (let index = 0; index < 3; index += 1) {
    first.step(first.parameters.timeStep);
    second.step(second.parameters.timeStep);
  }
  assert.deepEqual(first.state.positionsX, second.state.positionsX);
  assert.deepEqual(first.state.velocityX, second.state.velocityX);
  assert.deepEqual(first.state.rotationalEnergy, second.state.rotationalEnergy);
  assert.equal(first.snapshot().replay.randomState, second.snapshot().replay.randomState);
  assert.ok(first instanceof DsmcLabModel);
});

test('closed periodic DSMC conserves total momentum and energy to roundoff', () => {
  const model = createDsmcLabModel({
    caseId: 'equilibrium-box',
    particleCount: 512,
    seed: 11,
    cellSize: 1,
  });
  for (let index = 0; index < 8; index += 1) {
    model.step(model.parameters.timeStep);
  }
  const diagnostics = model.diagnostics();
  assert.ok(diagnostics.collisions > 0);
  assert.ok(Math.abs(diagnostics.energyError) < 2e-12);
  assert.ok(Math.abs(diagnostics.momentumError) < 2e-12);
});

test('DSMC validation is atomic and model source has no presentation state', async () => {
  const model = createDsmcLabModel({ particleCount: 256 });
  const before = model.state.positionsX;
  assert.throws(
    () => model.reset({ particleCount: 12 }),
    /particleCount is 12.*integer from 64.*No model state was changed/i,
  );
  assert.equal(model.state.positionsX, before);
  assert.throws(
    () => model.step(-1),
    /dt is -1.*No model state was changed/i,
  );

  const sources = await Promise.all([
    'dsmc-lab-model.js',
    'dsmc-lab-core.js',
    'dsmc-lab-runtime.js',
  ].map((name) => readFile(new URL(`../examples/boards/dsmc-lab/${name}`, import.meta.url), 'utf8')));
  for (const source of sources) {
    assert.doesNotMatch(source, /\b(?:document|window|Canvas|Scene|chalkStyle)\b/);
  }
});
