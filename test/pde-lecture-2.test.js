import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PDE_DEMOS } from '../demos/pde-lecture-2/catalog.js';
import {
  BalanceLessonModel,
  CurveLessonModel,
  FieldLessonModel,
  IncompressibleLessonModel,
  ShallowWaterLessonModel,
  createLessonModel,
  solveEulerStarState,
} from '../demos/pde-lecture-2/lesson-models.js';
import { LESSON_SPECS } from '../demos/pde-lecture-2/lesson-specs.js';

function finiteArray(values) {
  return [...values].every((value) => Number.isFinite(value) || Number.isNaN(value));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

test('catalogue exposes all nineteen interactive lecture modules', () => {
  assert.equal(PDE_DEMOS.length, 19);
  assert.equal(new Set(PDE_DEMOS.map((entry) => entry.id)).size, 19);
  assert.deepEqual(
    [...PDE_DEMOS.map((entry) => entry.todo)].sort((left, right) => left - right),
    Array.from({ length: 19 }, (_, index) => index + 1),
  );
  assert.ok(PDE_DEMOS.every((entry) => entry.available === true));
  for (const entry of PDE_DEMOS) {
    assert.ok(entry.equation.length > 0, entry.id);
    assert.ok(entry.title.ru && entry.title.en, entry.id);
    if (entry.id !== 'derivatives') {
      assert.ok(LESSON_SPECS[entry.id], `${entry.id}: controls`);
      assert.doesNotThrow(() => createLessonModel(entry.id), entry.id);
    }
  }
});

test('Sod exact Riemann star state matches the standard solution', () => {
  const star = solveEulerStarState(
    { rho: 1, u: 0, p: 1 },
    { rho: 0.125, u: 0, p: 0.1 },
  );
  assert.ok(Math.abs(star.pressure - 0.30313) < 5e-5);
  assert.ok(Math.abs(star.velocity - 0.92745) < 5e-5);
});

test('insulated diffusion conserves the mean while reducing a peak', () => {
  const model = new CurveLessonModel('diffusion');
  model.parameters.boundary = 'insulated';
  model.reset('default');
  const initialMean = mean(model.value);
  const initialMaximum = Math.max(...model.value);
  for (let step = 0; step < 30; step += 1) model.step(1 / 120);
  assert.ok(Math.abs(mean(model.value) - initialMean) < 2e-3);
  assert.ok(Math.max(...model.value) < initialMaximum);
  assert.ok(finiteArray(model.auxiliary));
  assert.ok(finiteArray(model.second));
});

test('all curve lessons remain finite after deterministic evolution', () => {
  for (const id of ['pde-field', 'wave', 'characteristics', 'classification', 'nonlinearity', 'riemann', 'material-derivative']) {
    const model = new CurveLessonModel(id);
    for (let step = 0; step < 8; step += 1) model.step(1 / 120);
    for (const panel of model.panels) {
      for (const curve of panel.curves) assert.ok(finiteArray(curve.data), id);
    }
  }
});

test('two-dimensional lesson fields step without losing their visible state', () => {
  for (const id of ['advection-diffusion', 'sources', 'geometry', 'laplace', 'vector-calculus']) {
    const model = new FieldLessonModel(id);
    model.step(1 / 60);
    assert.equal(model.data.length, model.columns * model.rows, id);
    assert.ok(model.data.some(Number.isFinite), id);
    assert.ok(finiteArray(model.data), id);
  }
});

test('control-volume bookkeeping satisfies accumulation identity', () => {
  const model = new BalanceLessonModel('conservation');
  model.setParameter('inflow', 1.2);
  model.setParameter('outflow', 0.45);
  model.setParameter('source', -0.1);
  assert.ok(Math.abs(model.rate - (1.2 - 0.45 - 0.1)) < 1e-12);
  const stored = model.stored;
  model.step(0.2);
  assert.ok(Math.abs(model.stored - (stored + 0.2 * model.rate)) < 1e-12);
});

test('linear shallow-water evolution approximately conserves mean height', () => {
  const model = new ShallowWaterLessonModel();
  const initial = mean(model.height);
  for (let step = 0; step < 12; step += 1) model.step(1 / 240);
  assert.ok(Math.abs(mean(model.height) - initial) < 2e-3);
  assert.ok(model.data.every(Number.isFinite));
});

test('pressure correction leaves a small finite divergence', () => {
  const model = new IncompressibleLessonModel();
  model.inject(0, 0, 0.4, -0.25);
  let maximum = 0;
  for (const value of model.divergence) maximum = Math.max(maximum, Math.abs(value));
  assert.ok(Number.isFinite(maximum));
  assert.ok(maximum < 0.3, `max divergence ${maximum}`);
});

test('unlisted lecture page routes every card to an interactive module without server paths', async () => {
  const [html, app, shell, controls, toolbar, preview, course] = await Promise.all([
    readFile(new URL('../demos/pde-lecture-2/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/pde-shell.js', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/lesson-demo.js', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/pde-toolbar.js', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/preview.js', import.meta.url), 'utf8'),
    readFile(new URL('../pages/cfd2025.md', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /\.\.\/\.\.\/pages\/cfd2025\.html/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /(?:src|href)="\//);
  assert.match(app, /mountLessonDemo\(shell, entry, language\)/);
  assert.doesNotMatch(app + shell, /mountConceptRecord|module will be added|будет добавлен/);
  assert.match(controls, /createLessonModel\(entry\.id\)/);
  assert.match(controls, /model\.step\(dt\)/);
  assert.match(shell, /board\.append\(concept, stage, stageFooter, notice\)/);
  assert.match(toolbar, /requestFullscreen/);
  assert.match(toolbar, /0\.25, 0\.5, 1, 2/);
  assert.match(preview, /removeProperty\('width'\)/);
  assert.doesNotMatch(course, /pde-lecture-2|интерактивный каталог УЧП/i);
});

test('field chalkification is stable and does not add per-frame random noise', async () => {
  const view = await readFile(new URL('../demos/pde-lecture-2/lesson-views.js', import.meta.url), 'utf8');
  assert.match(view, /function chalkifyField/);
  assert.match(view, /Math\.imul/);
  assert.doesNotMatch(view, /Math\.random/);
});

test('visible lesson controls describe the problem, not numerical settings', () => {
  const visible = JSON.stringify(LESSON_SPECS);
  assert.doesNotMatch(visible, /CFL|timestep|time step|grid resolution|solver tolerance|scheme order/i);
});

test('all demo pages share the persisted light and dark theme control', async () => {
  const files = await Promise.all([
    '../demos/dsmc/index.html',
    '../demos/dg-fvm/index.html',
    '../demos/pde-lecture-2/index.html',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  for (const html of files) {
    assert.match(html, /data-theme-toggle/);
    assert.match(html, /theme-init\.js/);
    assert.match(html, /theme\.js/);
  }
  const theme = await readFile(new URL('../demos/theme.js', import.meta.url), 'utf8');
  assert.match(theme, /site-theme/);
  assert.match(theme, /site-theme-change/);
});
