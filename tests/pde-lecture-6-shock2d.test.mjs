import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Shock2D, normalShockStates, SHOCK2D_DESCRIPTION } from '../demos/pde-lecture-6/src/shock2d.js';
import { METHODS, physicalFlux, primitiveToConservative } from '../demos/pde-lecture-6/src/euler.js';

function advanceTo(solver, target) {
  let guard = 0;
  while (solver.time < target - 1e-13 && !solver.failed) {
    const dt = solver.step(target - solver.time);
    assert.ok(dt > 0, solver.failureReason || 'The solver must advance.');
    assert.ok(++guard < 30000, 'Time advancement must finish in a bounded number of steps.');
  }
  assert.equal(solver.failed, false, solver.failureReason);
  assert.ok(Math.abs(solver.time - target) < 1e-12);
  return solver.metrics();
}

function near(a, b, tolerance, message) {
  assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${message}: ${a} versus ${b}`);
}

test('normal shock initialization satisfies all Rankine–Hugoniot flux balances', () => {
  for (const mach of [1.01, 3, 6, 20]) {
    const { left, right } = normalShockStates(mach);
    const fL = physicalFlux(primitiveToConservative(left));
    const fR = physicalFlux(primitiveToConservative(right));
    for (let c = 0; c < 4; c++) near(fL[c], fR[c], 2e-14, `M=${mach}, component ${c}`);
    assert.ok(right.rho > left.rho && right.p > left.p && right.u < left.u);
  }
});

test('all nine methods preserve a uniform two-dimensional moving state', () => {
  for (const { id } of METHODS) {
    const s = new Shock2D({ method: id, nx: 12, ny: 6, uniformState: { rho: 1.3, u: 0.7, v: -0.23, p: 1.2 } });
    const initial = s.U.slice();
    advanceTo(s, 0.15);
    for (let k = 0; k < s.U.length; k++) near(s.U[k], initial[k], 1e-13, `${id}, index ${k}`);
    assert.equal(s.metrics().growth, null, 'A zero initial fluctuation has no defined amplification ratio.');
  }
});

test('the seeded central kick has the same orientation on different grids and preserves initial pressure', () => {
  for (const ny of [24, 26, 32]) {
    const s = new Shock2D({ nx: 80, ny, perturbation: 0.001 });
    const below = 4 * ((ny / 2 - 1) * s.nx + s.shockColumn);
    const above = 4 * ((ny / 2) * s.nx + s.shockColumn);
    assert.ok(s.U[below + 2] < 0 && s.U[above + 2] > 0, 'Grid refinement must not silently reverse the imposed perturbation.');
    const p = s.pressureField();
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < s.nx; i++) near(p[j * s.nx + i], i < s.shockColumn ? s.left.p : s.right.p, 3e-13, 'Initial pressure is retained.');
    }
  }
});

test('a zero-seed shock remains exactly planar in a two-dimensional calculation', () => {
  for (const method of ['roe', 'roe-entropy', 'hllc', 'hlle']) {
    const s = new Shock2D({ method, nx: 40, ny: 12, perturbation: 0 });
    const m = advanceTo(s, 0.8);
    assert.equal(m.densityRms, 0, `${method}: no arithmetic-order-induced transverse density noise`);
    assert.equal(m.transverseRms, 0, `${method}: no transverse-velocity forcing`);
    assert.equal(m.ripple, 0, `${method}: planar density contour`);
    assert.equal(m.growth, null);
  }
});

test('an inadmissible state stops explicitly without clipping or hidden recovery', () => {
  const s = new Shock2D({ nx: 12, ny: 6 });
  s.U[0] = -1;
  const corrupted = s.U.slice();
  assert.equal(s.step(), 0);
  assert.equal(s.failed, true);
  assert.match(s.failureReason, /Nonphysical input state/);
  assert.deepEqual(s.U, corrupted, 'The input has not been clipped or replaced.');
  assert.equal(s.steps, 0);
  assert.equal(s.time, 0);
});

test('localized shock perturbation: measured growth, positivity, conservative balances, and wave-speed dependence', () => {
  const options = { nx: 96, ny: 32, mach: 6, perturbation: 0.001, cfl: 0.35, perturbationShape: 'localized', lowMachCutoff: 1 };
  const histories = [];
  const fields = [];
  const atTwo = new Map();
  for (const { id: method } of METHODS) {
    const s = new Shock2D({ ...options, method });
    const history = [s.metrics()];
    for (const target of [0.5, 1, 2, 3]) {
      const m = advanceTo(s, target);
      assert.ok(m.minRho > 0 && m.minP > 0, `${method}: positive physical state at t=${target}`);
      assert.ok(Math.abs(m.relativeMassBalanceError) < 5e-11, `${method}: mass balance must include physical boundaries`);
      assert.ok(Math.abs(m.energyBalanceError) < 5e-11, `${method}: energy balance must include physical boundaries`);
      history.push({ ...m });
      if (target === 2) atTwo.set(method, { ...m });
      if ((target === 2 || target === 3) && ['roe', 'roe-entropy', 'hllc', 'hlle', 'hll'].includes(method)) {
        fields.push({ method, time: s.time, nx: s.nx, ny: s.ny, xMin: s.xMin, xMax: s.xMax, yMin: s.yMin, yMax: s.yMax,
          metrics: m, rho: Array.from(s.densityField()), v: Array.from(s.transverseVelocityField()) });
      }
    }
    histories.push({ method, initialAmplitude: s.initialAmplitude, history });
  }
  const roe = atTwo.get('roe'), hlle = atTwo.get('hlle'), hll = atTwo.get('hll'), fixed = atTwo.get('roe-entropy');
  assert.ok(roe.growth > 100, 'The one-time small Roe perturbation must actually amplify.');
  assert.ok(roe.ripple > 0.8, 'Roe must develop a visible, measured shock contour distortion.');
  assert.ok(roe.ripple > 20 * hlle.ripple, 'Roe distortion must materially exceed the observed HLLE distortion.');
  assert.ok(roe.densityRms > 8 * hlle.densityRms, 'Density diagnostics must independently confirm the difference.');
  assert.ok(fixed.growth > 100, 'Acoustic entropy smoothing is not being misrepresented as a carbuncle cure.');
  assert.ok(hll.growth < 0.01, 'Davis two-wave HLL must damp this particular seed.');

  // One additional grid checks that the main observation is not unique to the
  // chosen display resolution. It does not establish grid convergence.
  const coarse = {};
  for (const method of ['roe', 'hlle']) {
    const s = new Shock2D({ ...options, method, nx: 64, ny: 24 });
    coarse[method] = advanceTo(s, 2);
  }
  assert.ok(coarse.roe.ripple > 5 * coarse.hlle.ripple, 'The contrast persists on the second square-cell grid.');

  const result = {
    formatVersion: 1,
    description: SHOCK2D_DESCRIPTION,
    options,
    normalization: 'rho1=u1=Lx=1; p1=1/(gamma M1^2); gamma=1.4',
    seed: 'v/u1 = epsilon*(-1)^(j-floor(ny/2))*exp(-((j-(ny-1)/2)/(0.1*ny))^2), applied once in columns ishock-1 ... ishock+2; E includes added transverse kinetic energy',
    diagnostics: {
      ripple: 'RMS of midpoint-density front position across rows, divided by dx; cell units',
      amplitude: 'hypot(global transverse density RMS/rho2, global v RMS/u1)',
      growth: 'amplitude divided by its measured value at t=0',
      relativeMassBalanceError: '(mass(t)-mass(0)-integral_boundary_in_minus_out_flux)/mass(0)',
    },
    observations: [
      'Roe and acoustic-entropy-corrected Roe exhibit visible growing planar shock instability.',
      'Canonical Einfeldt HLLE has much smaller distortion but measurable residual growth in this setup; no universal immunity is claimed.',
      'Davis-speed HLLC grows later than Roe in this setup; complete-solver vulnerability is case- and wave-speed-dependent.',
      'Davis-speed HLL and the tested FVS/AUSM variants damp this seed at the stated finite times.',
      'This planar stationary-shock educational variant is in the carbuncle family; it is neither a cylinder bow shock nor the original distorted-grid Quirk test.',
      'These diagnostics are finite-grid inviscid Euler computations, not experimental validation or a proof of nonlinear stability.',
    ],
    histories,
    secondGrid: { options: { ...options, nx: 64, ny: 24 }, atTimeTwo: coarse },
  };
  if (process.env.SHOCK2D_RECORD === '1') {
    fs.writeFileSync(fileURLToPath(new URL('./pde-lecture-6-shock2d-validation.json', import.meta.url)), JSON.stringify(result, null, 2) + '\n');
    fs.writeFileSync(fileURLToPath(new URL('./pde-lecture-6-shock2d-snapshots.json', import.meta.url)), JSON.stringify({ options, fields }) + '\n');
  }
});
