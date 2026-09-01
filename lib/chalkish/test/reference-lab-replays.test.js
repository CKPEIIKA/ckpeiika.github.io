import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  DG_FV_CASES,
  createDgFvLabModel,
} from '../examples/boards/dg-fv-lab/dg-fv-lab-model.js';
import {
  DSMC_LAB_CASES,
  createDsmcLabModel,
} from '../examples/boards/dsmc-lab/dsmc-lab-model.js';

function digest(...arrays) {
  const hash = createHash('sha256');
  for (const array of arrays) {
    hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest('hex').slice(0, 20);
}

const DG_FIXTURES = Object.freeze({
  'euler-cylinder': 'd9d8f42a18f48460cb5a',
  'diamond-translation': 'c8cef8ad5b46717f3732',
  'scalar-advection': '40b1e2f890758159d7fb',
  burgers: 'aedda9211e602b0d9703',
});

test('all four DG/FV presets retain their fixed two-step replay', () => {
  for (const caseId of DG_FV_CASES) {
    const model = createDgFvLabModel({
      caseId,
      columns: caseId === 'burgers' ? 48 : 24,
      rows: caseId === 'burgers' ? 1 : 12,
      degree: 0,
    });
    model.step(1 / 60).step(1 / 60);
    assert.equal(digest(model.state.scalar), DG_FIXTURES[caseId], caseId);
  }
});

const DSMC_FIXTURES = Object.freeze({
  'equilibrium-box': 'a28eee518312850c9582',
  'heat-transfer-x': '68fda4eaf36ad273180e',
  'rotational-nitrogen': '254d66003574934e5ce8',
  'couette-flow': '474d7eb1388e7bbd6e10',
});

test('all four DSMC presets retain their fixed seeded two-step replay', () => {
  for (const caseId of DSMC_LAB_CASES) {
    const model = createDsmcLabModel({
      caseId,
      particleCount: 256,
      seed: 77,
      cellSize: 1,
    });
    model.step(model.parameters.timeStep).step(model.parameters.timeStep);
    assert.equal(
      digest(
        model.state.positionsX,
        model.state.positionsY,
        model.state.velocityX,
        model.state.rotationalEnergy,
      ),
      DSMC_FIXTURES[caseId],
      caseId,
    );
  }
});
