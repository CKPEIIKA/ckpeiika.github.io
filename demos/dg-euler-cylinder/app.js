import { mount } from '../../lib/chalkish/src/index.js';
import {
  DG_FV_DISPLAY_FIELDS,
  DG_FV_INITIAL_CONDITIONS,
  createDgFvLabController,
} from '../../lib/chalkish/examples/boards/_shared/dg-fv-lab-controller.js';
import { BOARD_RENDER_STYLE } from '../../lib/chalkish/examples/board-settings.js';
import { bindStageControls } from '../../lib/chalkish/examples/stage-controls.js';

function required(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`DG/FV board is missing #${id}`);
  return node;
}

const nodes = Object.freeze({
  canvas: required('stage'),
  stageControls: required('stage-controls'),
  pause: required('pause'),
  step: required('step'),
  reset: required('reset'),
  diagnostics: required('diagnostics'),
  caseId: required('case-id'),
  degree: required('degree'),
  resolution: required('resolution'),
  cfl: required('cfl'),
  cflValue: required('cfl-value'),
  fluxAlpha: required('flux-alpha'),
  fluxAlphaValue: required('flux-alpha-value'),
  displayField: required('display-field'),
  bodyShape: required('body-shape'),
  initialCondition: required('initial-condition'),
  velocityField: required('velocity-field'),
  limiter: required('limiter'),
  bodyRow: document.querySelector('[data-control="body"]'),
  initialRow: document.querySelector('[data-control="initial"]'),
  velocityRow: document.querySelector('[data-control="velocity"]'),
});

const CASE_UI = Object.freeze({
  'euler-cylinder': Object.freeze({
    resolutions: Object.freeze(['24x12', '32x16', '48x24', '72x36']),
    resolution: '24x12',
    degree: '0',
    cfl: '0.18',
    limiter: 'minmod',
  }),
  'diamond-translation': Object.freeze({
    resolutions: Object.freeze(['20x12', '28x18', '40x26', '56x36']),
    resolution: '28x18',
    degree: '1',
    cfl: '0.30',
    limiter: 'filter',
  }),
  'scalar-advection': Object.freeze({
    resolutions: Object.freeze(['20x12', '28x18', '40x26', '56x36']),
    resolution: '28x18',
    degree: '1',
    cfl: '0.28',
    limiter: 'filter',
  }),
  burgers: Object.freeze({
    resolutions: Object.freeze(['48x1', '96x1', '160x1', '240x1']),
    resolution: '96x1',
    degree: '1',
    cfl: '0.28',
    limiter: 'minmod',
  }),
});

const DISPLAY_LABELS = Object.freeze({
  schlieren: 'Schlieren |∇ρ|/ρ',
  density: 'Density ρ',
  pressure: 'Pressure p',
  mach: 'Mach number',
  speed: 'Speed |u|',
  vorticity: 'Vorticity',
  entropy: 'Entropy proxy',
  field: 'DG field',
  mean: 'Cell mean',
  error: 'Absolute error',
  modes: 'Higher-mode energy',
});

const INITIAL_LABELS = Object.freeze({
  diamond: 'Diamond',
  blob: 'Gaussian blob',
  two: 'Two signed blobs',
  vortex: 'Radial wave',
  square: 'Square pulse',
  sine: 'Sine wave',
  riemann: 'Riemann states',
  bump: 'Smooth bump',
  constant: 'Constant state',
});

const LIMITERS = Object.freeze({
  'euler-cylinder': Object.freeze(['off', 'pos', 'minmod', 'flatten']),
  'diamond-translation': Object.freeze(['off', 'filter']),
  'scalar-advection': Object.freeze(['off', 'filter']),
  burgers: Object.freeze(['off', 'minmod']),
});

function replaceOptions(select, values, labels = {}) {
  const fragment = document.createDocumentFragment();
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labels[value] ?? value;
    fragment.append(option);
  }
  select.replaceChildren(fragment);
}

function syncCase({ defaults = false } = {}) {
  const caseId = nodes.caseId.value;
  const config = CASE_UI[caseId];
  replaceOptions(nodes.resolution, config.resolutions);
  replaceOptions(
    nodes.displayField,
    DG_FV_DISPLAY_FIELDS[caseId],
    DISPLAY_LABELS,
  );
  replaceOptions(nodes.limiter, LIMITERS[caseId]);
  const initial = DG_FV_INITIAL_CONDITIONS[caseId] ?? [];
  replaceOptions(nodes.initialCondition, initial, INITIAL_LABELS);
  nodes.bodyRow.hidden = caseId !== 'euler-cylinder';
  nodes.initialRow.hidden = initial.length === 0;
  nodes.velocityRow.hidden = caseId !== 'scalar-advection';
  nodes.degree.querySelector('option[value="3"]').disabled = caseId === 'euler-cylinder';
  if (defaults) {
    nodes.resolution.value = config.resolution;
    nodes.degree.value = config.degree;
    nodes.cfl.value = config.cfl;
    nodes.limiter.value = config.limiter;
    nodes.displayField.value = DG_FV_DISPLAY_FIELDS[caseId][0];
    if (initial.length > 0) nodes.initialCondition.value = initial[0];
    nodes.velocityField.value = 'uniform';
  }
  nodes.cflValue.textContent = Number(nodes.cfl.value).toFixed(2);
  nodes.fluxAlphaValue.textContent = Number(nodes.fluxAlpha.value).toFixed(2);
}

function parameters() {
  const [columns, rows] = nodes.resolution.value.split('x').map(Number);
  return {
    caseId: nodes.caseId.value,
    columns,
    rows,
    degree: Number(nodes.degree.value),
    cfl: Number(nodes.cfl.value),
    fluxAlpha: Number(nodes.fluxAlpha.value),
    displayField: nodes.displayField.value,
    bodyShape: nodes.bodyShape.value,
    initialCondition: nodes.initialCondition.value || 'blob',
    velocityField: nodes.velocityField.value,
    limiter: nodes.limiter.value,
    mach: 1.5,
    bodyRadius: 0.1,
    gamma: 1.4,
  };
}

syncCase({ defaults: true });
const controller = createDgFvLabController({
  model: parameters(),
  styleName: BOARD_RENDER_STYLE,
});
const startsPaused = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let diagnosticsCountdown = 0;

function updateDiagnostics() {
  const values = controller.diagnostics();
  const common = [
    `case / degree ${values.caseId} / P${controller.model.parameters.degree}`,
    `mesh / dof    ${controller.model.parameters.columns} × ${controller.model.parameters.rows} / ${values.degreesOfFreedom}`,
    `time / step   ${values.time.toFixed(6)} / ${values.step}`,
    `dt / CFL      ${values.numericalTimeStep.toExponential(3)} / ${controller.model.parameters.cfl.toFixed(2)}`,
  ];
  if (values.caseId === 'euler-cylinder') {
    common.push(
      `ρ range       ${values.minimumDensity.toFixed(5)} … ${values.maximumDensity.toFixed(5)}`,
      `p range       ${values.minimumPressure.toFixed(5)} … ${values.maximumPressure.toFixed(5)}`,
      `Mmax / Cd     ${values.maximumMach.toFixed(4)} / ${values.dragCoefficient.toFixed(4)}`,
      `limited       positivity ${values.positivityLimitedCells} · troubled ${values.troubledCells}`,
      'boundary      characteristic far field · embedded slip wall',
    );
  } else {
    common.push(
      `mass          ${values.mass.toFixed(10)}`,
      `mode fraction ${values.modalEnergyFraction.toExponential(4)}`,
      Number.isFinite(values.l2Error)
        ? `L2 error      ${values.l2Error.toExponential(5)}`
        : 'L2 error      no analytic reference for this velocity field',
      'boundary      periodic',
    );
  }
  nodes.diagnostics.textContent = common.join('\n');
}

const app = mount(nodes.canvas, {
  scene: controller.scene,
  camera: controller.camera,
  fixedStep: 1 / 30,
  update: ({ dt }) => {
    controller.update(dt);
    diagnosticsCountdown -= 1;
    if (diagnosticsCountdown <= 0) {
      diagnosticsCountdown = 4;
      updateDiagnostics();
    }
  },
});
const stageControls = bindStageControls({
  root: nodes.stageControls,
  canvas: nodes.canvas,
  app,
});

function reset() {
  controller.reset(parameters());
  app.clock?.reset(null);
  diagnosticsCountdown = 0;
  updateDiagnostics();
  app.render();
  stageControls.captureView();
}

function safeReset() {
  try {
    reset();
  } catch (error) {
    nodes.diagnostics.setAttribute('role', 'alert');
    nodes.diagnostics.textContent = error instanceof Error ? error.message : String(error);
  }
}

nodes.caseId.addEventListener('change', () => {
  syncCase({ defaults: true });
  safeReset();
});
for (const control of [
  nodes.degree,
  nodes.resolution,
  nodes.displayField,
  nodes.bodyShape,
  nodes.initialCondition,
  nodes.velocityField,
  nodes.limiter,
]) {
  control.addEventListener('change', safeReset);
}
nodes.cfl.addEventListener('input', () => {
  nodes.cflValue.textContent = Number(nodes.cfl.value).toFixed(2);
});
nodes.fluxAlpha.addEventListener('input', () => {
  nodes.fluxAlphaValue.textContent = Number(nodes.fluxAlpha.value).toFixed(2);
});
nodes.cfl.addEventListener('change', safeReset);
nodes.fluxAlpha.addEventListener('change', safeReset);
nodes.reset.addEventListener('click', safeReset);
nodes.step.addEventListener('click', updateDiagnostics);

globalThis.addEventListener?.('pagehide', () => {
  stageControls.dispose();
  app.destroy();
  controller.dispose();
}, { once: true });

updateDiagnostics();
app.render();
stageControls.captureView();
stageControls.setPaused(startsPaused);
