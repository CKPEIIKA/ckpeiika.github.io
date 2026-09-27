import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PDE_DEMOS } from '../demos/pde-lecture-2/src/pde-demos.js';
import {
  BalanceLessonModel,
  CurveLessonModel,
  FieldLessonModel,
  IncompressibleLessonModel,
  ShallowWaterLessonModel,
  createLessonModel,
  solveEulerStarState,
} from '../demos/pde-lecture-2/src/lesson-models.js';
import { LESSON_SPECS } from '../demos/pde-lecture-2/src/lesson-specs.js';

function finiteArray(values, allowGaps = false) {
  return values.some(Number.isFinite) && [...values].every(value => Number.isFinite(value) || (allowGaps && Number.isNaN(value)));
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
      for (const curve of panel.curves) {
        const isSpaceTimePanel = panel.label.replace(/[–—]/g, '-') === 'x-t';
        assert.ok(finiteArray(curve.data, isSpaceTimePanel), id);
      }
    }
  }
});

test('two-dimensional lesson fields step without losing their visible state', () => {
  for (const id of ['advection-diffusion', 'sources', 'geometry', 'laplace', 'vector-calculus']) {
    const model = new FieldLessonModel(id);
    model.step(1 / 60);
    assert.equal(model.data.length, model.columns * model.rows, id);
    assert.ok(model.data.some(Number.isFinite), id);
    assert.ok(finiteArray(model.data, id === 'geometry'), id);
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

test('nonlinear shallow-water evolution conserves mean height', () => {
  const model = new ShallowWaterLessonModel();
  const initial = mean(model.height);
  for (let step = 0; step < 12; step += 1) model.step(1 / 240);
  assert.ok(Math.abs(mean(model.height) - initial) < 2e-6);
  assert.ok(model.data.every(Number.isFinite));
});

test('pressure correction leaves a small finite divergence', () => {
  const model = new IncompressibleLessonModel();
  model.inject(0, 0, 0.4, -0.25);
  let maximum = 0;
  for (const value of model.divergence) maximum = Math.max(maximum, Math.abs(value));
  assert.ok(Number.isFinite(maximum));
  assert.ok(maximum < 1e-5, `max divergence ${maximum}`);
});

test('lecture page runs every visible lesson on the shared gallery without server paths', async () => {
  const [html, app, labs, preview, gallery, course] = await Promise.all([
    readFile(new URL('../demos/pde-lecture-2/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/src/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/src/labs.js', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-lecture-2/src/preview.js', import.meta.url), 'utf8'),
    readFile(new URL('../demos/pde-gallery/gallery.js', import.meta.url), 'utf8'),
    readFile(new URL('../pages/cfd2026.md', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /\.\.\/\.\.\/pages\/cfd2026\.html/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /(?:src|href)="\//);
  assert.match(html, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
  assert.match(app, /startGallery\(/);
  assert.match(app, /mountPdePreview\(/);
  assert.match(labs, /createLessonModel\(id\)/);
  assert.match(labs, /model\.step\(/);
  assert.match(gallery, /requestFullscreen/);
  assert.match(preview, /removeProperty\('width'\)/);
  assert.match(course, /\/demos\/pde-lecture-2\/'\s*\|\s*relative_url/);

  const { default: catalog } = await import('../demos/pde-lecture-2/src/catalog.js');
  const visible = PDE_DEMOS.filter((entry) => entry.hidden !== true);
  assert.deepEqual(catalog.demos.map((d) => d.id), visible.map((e) => e.id));
  for (const demo of catalog.demos.filter((d) => d.id !== 'derivatives')) {
    assert.deepEqual(demo.controls.map((c) => c.key), LESSON_SPECS[demo.id].controls.map((c) => c.name), demo.id);
    assert.equal(demo.presets.length, LESSON_SPECS[demo.id].presets.length, demo.id);
  }
});

test('lesson readouts become [label, value] metrics', async () => {
  const { readoutStats } = await import('../demos/pde-lecture-2/src/labs.js');
  assert.deepEqual(readoutStats('t 0.20 · min 0.000 · ⟨u⟩ 0.160'), [['t', '0.20'], ['min', '0.000'], ['⟨u⟩', '0.160']]);
  assert.deepEqual(readoutStats('Pe = ∞ · t 0.20'), [['Pe', '∞'], ['t', '0.20']]);
  assert.deepEqual(readoutStats('max |∇·u| 0.00e+0'), [['max |∇·u|', '0.00e+0']]);
  assert.deepEqual(readoutStats('∇²φ = 0 · ∂φ/∂t = 0'), [['∇²φ', '0'], ['∂φ/∂t', '0']]);
  for (const empty of ['', undefined, null]) assert.deepEqual(readoutStats(empty), []);
  assert.deepEqual(readoutStats('single'), [['single', '']]);
});

test('field chalkification is stable and does not add per-frame random noise', async () => {
  const view = await readFile(new URL('../demos/pde-lecture-2/src/lesson-views.js', import.meta.url), 'utf8');
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
