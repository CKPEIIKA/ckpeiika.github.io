import assert from 'node:assert/strict';
import {
  METHODS, CASES, primitiveToConservative as cons, conservativeToPrimitive as prim,
  physicalFlux, numericalFlux, Euler1D, exactRiemann, exactProfile, hartenAbsolute,
  splitFlux, estimateWaveSpeeds
} from '../demos/pde-lecture-6/src/euler.js';

const near = (a, b, tolerance = 2e-11) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const nearVector = (a, b, tolerance) => a.forEach((x, k) => near(x, b[k], tolerance));
const state = (rho, u, p, v = 0) => cons({ rho, u, v, p });

// Consistency includes supersonic signs, subsonic flow, transverse kinetic
// energy, and a non-default gamma. This catches wrong FVS energy polynomials.
for (const gamma of [1.4, 5 / 3]) for (const u of [-3.4, -0.23, 0, 0.41, 4.2]) {
  const U = cons({ rho: 0.71, u, v: 0.62, p: 1.13 }, gamma);
  for (const m of METHODS) nearVector(numericalFlux(m.id, U, U, gamma), physicalFlux(U, gamma));
  for (const m of ['vanleer', 'steger-warming']) {
    const plus = splitFlux(m, U, 1, gamma), minus = splitFlux(m, U, -1, gamma);
    nearVector(plus.map((p, k) => p + minus[k]), physicalFlux(U, gamma));
  }
}
console.log('PASS uniform-state flux consistency: all 9 methods, transverse velocity, gamma 1.4 and 5/3');

// Exact Sod star values and analytic symmetric two-rarefaction result.
const sod = exactRiemann({ rho: 1, u: 0, p: 1 }, { rho: 0.125, u: 0, p: 0.1 });
near(sod.pStar, 0.3031301780506468); near(sod.uStar, 0.9274526200489499);
near(sod.rhoStarLeft, 0.4263194281784952); near(sod.rhoStarRight, 0.2655737117053071);
const rare = exactRiemann({ rho: 1, u: -2, p: 0.4 }, { rho: 1, u: 2, p: 0.4 });
near(rare.pStar, 0.0018938734200547643); near(rare.rhoStarLeft, 0.021852118206812838);
near(rare.uStar, 0); assert.equal(rare.vacuum, false);
const vacuum = exactRiemann({ rho: 1, u: -6, p: 0.4 }, { rho: 1, u: 6, p: 0.4 });
assert.equal(vacuum.vacuum, true); assert.equal(vacuum.sample(0).rho, 0);
console.log('PASS exact Riemann solver: Sod star values, positive near-vacuum star, true-vacuum guard');

// The transonic preset is a stationary discontinuity with equal fluxes.
// Roe locks its entropy-violating expansion; the acoustic fix must change it.
const transonic = CASES.find(c => c.id === 'transonic');
const TL = cons(transonic.left), TR = cons(transonic.right);
nearVector(physicalFlux(TL), physicalFlux(TR));
nearVector(numericalFlux('roe', TL, TR), physicalFlux(TL));
assert.ok(numericalFlux('roe-entropy', TL, TR).some((f, k) => Math.abs(f - physicalFlux(TL)[k]) > 1e-3));
near(hartenAbsolute(0, 0.2), 0.1); near(hartenAbsolute(0.3, 0.2), 0.3);
console.log('PASS entropy diagnostic: raw Roe locks stationary expansion, acoustic Harten fix changes flux');

// A stationary contact with tangential-velocity jump exercises both contact
// and shear waves. Contact-resolving solvers must preserve the physical flux.
const CL = state(1, 0, 1, 0.3), CR = state(0.125, 0, 1, -0.5);
for (const method of ['roe', 'roe-entropy', 'hllc', 'ausm', 'ausm-up']) nearVector(numericalFlux(method, CL, CR), [0, 1, 0, 0]);
assert.ok(Math.abs(numericalFlux('hlle', CL, CR)[0]) > 0.1);
console.log('PASS stationary contact/shear resolution and acoustic-only entropy correction');

// Check the advertised distinction between the two HLL speed estimates.
const dl = state(1, 0, 1000), dr = state(1, 0, 0.01);
const davis = estimateWaveSpeeds('hll', dl, dr), einfeldt = estimateWaveSpeeds('hlle', dl, dr);
assert.ok(davis.SR > einfeldt.SR);
console.log('PASS Davis/Einfeldt wave-bound distinction');

// Conservation uses the measured boundary flux budget, not presumed closed
// boundaries. A periodic profile additionally checks face n equals face 0.
const results = [];
for (const method of METHODS.map(m => m.id)) {
  const solver = new Euler1D({ method, caseId: 'sod', n: 100 });
  const before = solver.totals();
  solver.advanceTo(0.2);
  assert.equal(solver.failed, false, `${method}: ${solver.failureReason}`);
  solver.totals().forEach((x, k) => near(x - before[k], solver.boundaryExchange[k], 5e-11));
  const ref = exactProfile('sod', solver.x, solver.time);
  const l1 = solver.profile('rho').reduce((s, r, i) => s + Math.abs(r - ref[i].rho), 0) / solver.n;
  assert.ok(l1 < 0.1, `${method} Sod density L1 too large: ${l1}`);
  results.push({ method, steps: solver.steps, minP: +solver.minP.toPrecision(5), SodDensityL1: +l1.toPrecision(5) });
}
const periodic = new Euler1D({ method: 'ausm-up', caseId: 'low-mach', n: 80 });
const periodicBefore = periodic.totals(); periodic.advanceTo(0.5);
assert.equal(periodic.cfl, 0.05); assert.equal(periodic.failed, false);
near(periodic.minP, 1 / 1.4);
nearVector(periodic.totals(), periodicBefore, 5e-11);
console.log('PASS all-method conservative Sod integration with positive states and exact-reference error check');
console.table(results);

// This explicitly tests the intended visible failure, and a separately
// labeled conservative repair mode; neither may clip density/pressure.
const raw = new Euler1D({ method: 'roe', caseId: 'double-rarefaction', n: 120 });
const rawU = raw.U.map(U => [...U]); raw.advanceTo(0.15);
assert.equal(raw.failed, true); assert.ok(raw.minP < 0); assert.equal(raw.fallbackCount, 0);
assert.deepEqual(raw.U, rawU); assert.equal(raw.steps, 0);
const hlle = new Euler1D({ method: 'hlle', caseId: 'double-rarefaction', n: 120 }); hlle.advanceTo(0.15);
assert.equal(hlle.failed, false); assert.ok(hlle.minP > 0);
const repaired = new Euler1D({ method: 'roe', caseId: 'double-rarefaction', n: 120, safety: 'hlle' });
const repairedBefore = repaired.totals(); repaired.advanceTo(0.15);
assert.equal(repaired.failed, false); assert.ok(repaired.fallbackCount > 0);
repaired.totals().forEach((x, k) => near(x - repairedBefore[k], repaired.boundaryExchange[k], 5e-11));
console.log(`PASS rarefaction: raw Roe halts with p=${raw.minP}; HLLE positive; explicit Roe/HLLE repair uses ${repaired.fallbackCount} face replacements and conserves U`);
console.log('All Euler core checks passed.');
