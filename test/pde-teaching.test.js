import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonModel, solveEulerStarState, sampleEulerRiemann } from '../demos/pde-lecture-2/lesson-models.js';
import { bindLessonView } from '../demos/pde-lecture-2/lesson-views.js';

const advance = (model, time) => {
  for (let t = 0; t < time - 1e-10; t += 1 / 120) model.step(Math.min(1 / 120, time - t));
};
const integral = values => (values.reduce((sum, value) => sum + value, 0)
  - (values[0] + values.at(-1)) / 2) * 2 / (values.length - 1);
const finite = values => assert.ok(values.every(Number.isFinite));

test('Euler state edits survive restarting; presets remain reproducible', () => {
  const model = createLessonModel('riemann').reset('sod');
  model.setParameter('pL', 2);
  assert.equal(model.parameters.pL, 2);
  assert.equal(model.second[0], 2);
  model.restart();
  assert.equal(model.parameters.pL, 2);
  model.reset('sod');
  assert.equal(model.parameters.pL, 1);
});

test('insulated diffusion conserves heat, periodic diffusion conserves mean', () => {
  for (const boundary of ['insulated', 'periodic']) {
    const model = createLessonModel('diffusion').reset('step');
    model.setParameter('boundary', boundary);
    const before = integral(model.value);
    advance(model, 1);
    finite(model.value);
    assert.ok(Math.abs(integral(model.value) - before) < 2e-6, boundary);
    assert.ok(Math.max(...model.value) < 1);
    if (boundary === 'insulated') assert.ok(model.second[0] === 0 && model.second.at(-1) === 0);
  }
});

test('positive outward normal derivatives add heat from both ends', () => {
  const model = createLessonModel('boundaries').reset('insulated');
  model.setParameter('leftFlux', 0.5);
  model.setParameter('rightFlux', 0.5);
  const before = integral(model.value);
  advance(model, 0.2);
  assert.ok(Math.abs(integral(model.value) - before - model.parameters.D * 0.2) < 2e-6);
});

test('absorbing wave boundaries transmit a pulse instead of reflecting it', () => {
  const energies = [];
  for (const boundary of ['free', 'absorbing']) {
    const model = createLessonModel('wave');
    model.setParameter('boundary', boundary);
    advance(model, 3.4);
    finite(model.value);
    energies.push(model.value.reduce((sum, v) => sum + v * v, 0));
  }
  assert.ok(energies[1] < energies[0] * 0.03, String(energies));
});

test('variable-speed transport follows dx/dt = a(x), not x − a(x)t', () => {
  const model = createLessonModel('characteristics').reset('increasing');
  const x0 = -0.4;
  const x = model.characteristicPosition(x0, 0.8);
  const b = 0.45 * model.parameters.speed;
  assert.ok(Math.abs(x - ((x0 + 1 / 0.45) * Math.exp(b * 0.8) - 1 / 0.45)) < 1e-10);
  assert.ok(Math.abs(model.characteristicOrigin(x, 0.8) - x0) < 1e-10);
  model.step(0.8);
  const peak = model.x[model.value.indexOf(Math.max(...model.value))];
  assert.ok(Math.abs(peak - x) < 0.025);
});

test('diffusion plot scale does not grow as the peak decays', () => {
  const model = createLessonModel('diffusion');
  const view = bindLessonView(model);
  const before = view.profilePoint(0, 2.7).value;
  advance(model, 0.7);
  view.update();
  assert.equal(view.profilePoint(0, 2.7).value, before);
  view.dispose();
});

test('drawn initial data survive changing the introductory PDE', () => {
  const model = createLessonModel('pde-field');
  model.drawAt(0, -0.5);
  const initial = model.initial.slice();
  model.setParameter('mode', 'wave');
  assert.deepEqual(model.initial, initial);
  assert.deepEqual(model.value, initial);
});

test('hot/cold restart and its dashed reference preserve the same initial field', () => {
  const model = createLessonModel('boundaries').reset('hot-cold');
  const initial = model.value.slice();
  assert.deepEqual(model.initial, initial);
  model.step(0.2);
  model.restart();
  assert.deepEqual(model.value, initial);
});

test('transport actually moves tracer particles', () => {
  const model = createLessonModel('advection-diffusion').reset('pure-advection');
  const before = model.particlesX.slice();
  model.step(0.1);
  assert.notDeepEqual(model.particlesX, before);
});

test('Euler expansion into vacuum is explicit and finite', () => {
  const left = { rho: 1, p: 0.02, u: -2 };
  const right = { rho: 1, p: 0.02, u: 2 };
  const star = solveEulerStarState(left, right);
  assert.equal(star.vacuum, true);
  const center = sampleEulerRiemann(0, left, right, star);
  assert.equal(center.rho, 0);
  assert.equal(center.p, 0);
  for (const x of [-5, -2, -1, 0, 1, 2, 5]) finite(Object.values(sampleEulerRiemann(x, left, right, star)));
});

test('all exposed presets and control boundaries keep physical state finite', () => {
  for (const id of ['wave', 'riemann', 'shallow-water', 'incompressibility']) {
    const model = createLessonModel(id);
    for (const preset of id === 'wave' ? ['standing', 'heterogeneous', 'interference'] : id === 'riemann' ? ['sod','collision','expansion','strong-shock','contact'] : id === 'shallow-water' ? ['drop','dam-break','circular','counterflow'] : ['channel','vortex']) {
      model.reset(preset);
      if (id === 'wave') model.setParameter('c2Ratio', 1.75);
      advance(model, 0.3);
      for (const key of ['value','height','u','v','pressure']) if (model[key]) finite(model[key]);
      if (model.height) assert.ok(model.height.every(h => h > 0));
    }
  }
});

test('Laplace boundary painting changes the interior without simulating time', () => {
  const model = createLessonModel('laplace').reset('cold-walls');
  const middle = Math.floor(model.rows / 2) * model.columns + Math.floor(model.columns / 2);
  assert.equal(model.scalar[middle], 0);
  model.paintAt(-1, 0, 1);
  assert.ok(model.scalar[middle] > 0.01);
  finite(model.scalar);
  assert.equal(model.time, 0);
  const ax = ((model.columns - 1) / 2) ** 2, ay = ((model.rows - 1) / 1.2) ** 2;
  let residual = 0;
  for (let y = 1; y < model.rows - 1; y++) for (let x = 1; x < model.columns - 1; x++) {
    const i = y * model.columns + x, s = model.scalar;
    residual = Math.max(residual, Math.abs(ax * (s[i-1]-2*s[i]+s[i+1]) + ay * (s[i-model.columns]-2*s[i]+s[i+model.columns])));
  }
  assert.ok(residual < 5e-4, `residual ${residual}`);
});

test('constant velocity is not damped by viscosity', () => {
  const model = createLessonModel('incompressibility');
  model.setParameter('viscosity', 0.08);
  const before = model.u.slice();
  advance(model, 0.3);
  assert.deepEqual(model.u, before);
});

test('scalar transport preserves a uniform field and the total in periodic uniform flow', () => {
  const model = createLessonModel('advection-diffusion').reset('pure-advection');
  const before = model.scalar.reduce((a,b)=>a+b,0);
  advance(model, 0.4);
  assert.ok(Math.abs(model.scalar.reduce((a,b)=>a+b,0)-before) < 1e-4);
  model.scalar.fill(0.4);
  model.setParameter('velocityField', 'rotation');
  advance(model, 0.1);
  assert.ok(model.scalar.every(x => Math.abs(x-0.4)<1e-6));
});

test('shrinking a control volume preserves its local accumulation rate', () => {
  const model = createLessonModel('integral-conservation').reset('filling');
  model.step(0.2);
  const densityRate = model.rate / model.parameters.size;
  model.setParameter('size', 0.1);
  assert.ok(Math.abs(model.rate / 0.1 - densityRate) < 1e-12);
  const before = model.stored;
  model.setParameter('position', 0.4);
  assert.notEqual(model.stored, before);
  assert.ok(Math.abs(model.rate - (model.fluxIn-model.fluxOut+0.1*model.parameters.source)) < 1e-12);
});
