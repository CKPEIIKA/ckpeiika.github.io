import { mount } from '../../lib/chalkish/src/index.js';
import {
  DG_FV_DISPLAY_FIELDS,
  DG_FV_INITIAL_CONDITIONS,
  createDgFvLabController,
} from '../../lib/chalkish/examples/boards/_shared/dg-fv-lab-controller.js';
import { BOARD_RENDER_STYLE } from '../../lib/chalkish/examples/board-settings.js';
import { bindStageControls } from '../../lib/chalkish/examples/stage-controls.js';
import { bindLabLanguage, withCommonTranslations } from '../lab-i18n.js';

const i18n = bindLabLanguage(withCommonTranslations({
  en: {
    'page.documentTitle': 'DG / FV Laboratory',
    'page.description': 'Interactive DG and finite-volume laboratory.',
    'page.title': 'DG / FV',
    'stage.dg': 'DG and finite-volume numerical stage',
    'stage.dgCanvas': 'Selected DG or finite-volume solution field',
    'controls.dg': 'DG and finite-volume controls',
    'page.degree': 'Degree',
    'page.mesh': 'Mesh',
    'page.field': 'Field',
    'page.fluxClock': 'Flux and time step',
    'page.caseControls': 'Case-specific controls',
    'page.state': 'Numerical state',
    'page.body': 'Body',
    'page.initial': 'Initial state',
    'page.velocity': 'Velocity',
    'page.stabilizer': 'Stabilizer',
    'page.reset': 'Reset calculation',
    'case.euler': 'Euler / body',
    'case.diamond': 'Diamond translation',
    'case.advection': 'Scalar advection',
    'case.burgers': 'Burgers',
    'body.square': 'Square',
    'body.wedge': '10° wedge',
    'body.cylinder': 'Cylinder',
    'velocity.uniform': 'Uniform',
    'velocity.swirl': 'Periodic swirl',
    'velocity.shear': 'Shear',
  },
  ru: {
    'page.documentTitle': 'Лаборатория DG / FV',
    'page.description': 'Интерактивная лаборатория разрывного метода Галёркина и метода конечных объёмов.',
    'page.title': 'DG / FV',
    'stage.dg': 'Поле решения DG и метода конечных объёмов',
    'stage.dgCanvas': 'Выбранное поле численного решения',
    'controls.dg': 'Параметры DG и метода конечных объёмов',
    'page.degree': 'Степень',
    'page.mesh': 'Сетка',
    'page.field': 'Величина',
    'page.fluxClock': 'Поток и шаг по времени',
    'page.caseControls': 'Параметры расчётного случая',
    'page.state': 'Численная постановка',
    'page.body': 'Тело',
    'page.initial': 'Начальное условие',
    'page.velocity': 'Поле скорости',
    'page.stabilizer': 'Стабилизация',
    'page.reset': 'Сбросить расчёт',
    'case.euler': 'Уравнения Эйлера / тело',
    'case.diamond': 'Перенос ромба',
    'case.advection': 'Скалярный перенос',
    'case.burgers': 'Уравнение Бюргерса',
    'body.square': 'Квадрат',
    'body.wedge': 'Клин 10°',
    'body.cylinder': 'Цилиндр',
    'velocity.uniform': 'Однородное',
    'velocity.swirl': 'Периодический вихрь',
    'velocity.shear': 'Сдвиговое',
  },
}));

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
  en: Object.freeze({ schlieren: 'Schlieren |∇ρ|/ρ', density: 'Density ρ', pressure: 'Pressure p', mach: 'Mach number', speed: 'Speed |u|', vorticity: 'Vorticity', entropy: 'Entropy proxy', field: 'DG field', mean: 'Cell mean', error: 'Absolute error', modes: 'Higher-mode energy' }),
  ru: Object.freeze({ schlieren: 'Шлирен |∇ρ|/ρ', density: 'Плотность ρ', pressure: 'Давление p', mach: 'Число Маха', speed: 'Скорость |u|', vorticity: 'Завихренность', entropy: 'Мера энтропии', field: 'Поле DG', mean: 'Среднее по ячейке', error: 'Абсолютная погрешность', modes: 'Энергия старших мод' }),
});

const INITIAL_LABELS = Object.freeze({
  en: Object.freeze({ diamond: 'Diamond', blob: 'Gaussian blob', two: 'Two signed blobs', vortex: 'Radial wave', square: 'Square pulse', sine: 'Sine wave', riemann: 'Riemann states', bump: 'Smooth bump', constant: 'Constant state' }),
  ru: Object.freeze({ diamond: 'Ромб', blob: 'Гауссов импульс', two: 'Два знакопеременных импульса', vortex: 'Радиальная волна', square: 'Прямоугольный импульс', sine: 'Синусоида', riemann: 'Римановские состояния', bump: 'Гладкий импульс', constant: 'Постоянное состояние' }),
});

const LIMITER_LABELS = Object.freeze({
  en: Object.freeze({ off: 'Off', pos: 'Positivity', minmod: 'Minmod', flatten: 'Flatten', filter: 'Modal filter' }),
  ru: Object.freeze({ off: 'Отключена', pos: 'Положительность', minmod: 'Minmod', flatten: 'Сведение к среднему', filter: 'Модальный фильтр' }),
});

const CANVAS_FORMULAS = Object.freeze({
  en: Object.freeze({
    'euler-cylinder': '∂ₜU + ∂ₓF(U) + ∂ᵧG(U) = 0 · modal DG / FV limit',
    'diamond-translation': 'uₜ + ∇·(a u) = 0 · periodic tensor DG',
    'scalar-advection': 'uₜ + ∇·(a u) = 0 · periodic tensor DG',
    burgers: 'uₜ + (u²/2)ₓ = 0 · periodic modal DG',
  }),
  ru: Object.freeze({
    'euler-cylinder': '∂ₜU + ∂ₓF(U) + ∂ᵧG(U) = 0 · модальный DG / предел FV',
    'diamond-translation': 'uₜ + ∇·(a u) = 0 · периодический тензорный DG',
    'scalar-advection': 'uₜ + ∇·(a u) = 0 · периодический тензорный DG',
    burgers: 'uₜ + (u²/2)ₓ = 0 · периодический модальный DG',
  }),
});

const LIMITERS = Object.freeze({
  'euler-cylinder': Object.freeze(['off', 'pos', 'minmod', 'flatten']),
  'diamond-translation': Object.freeze(['off', 'filter']),
  'scalar-advection': Object.freeze(['off', 'filter']),
  burgers: Object.freeze(['off', 'minmod']),
});

function replaceOptions(select, values, labels = {}) {
  const previous = select.value;
  const fragment = document.createDocumentFragment();
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labels[value] ?? value;
    fragment.append(option);
  }
  select.replaceChildren(fragment);
  if (values.includes(previous)) select.value = previous;
}

function syncCase({ defaults = false } = {}) {
  const caseId = nodes.caseId.value;
  const config = CASE_UI[caseId];
  replaceOptions(nodes.resolution, config.resolutions);
  replaceOptions(
    nodes.displayField,
    DG_FV_DISPLAY_FIELDS[caseId],
    DISPLAY_LABELS[i18n.language],
  );
  replaceOptions(nodes.limiter, LIMITERS[caseId], LIMITER_LABELS[i18n.language]);
  const initial = DG_FV_INITIAL_CONDITIONS[caseId] ?? [];
  replaceOptions(nodes.initialCondition, initial, INITIAL_LABELS[i18n.language]);
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

function localizeCanvas() {
  const values = controller.diagnostics();
  const caseId = values.caseId;
  controller.view.layers.heading.setText('');
  controller.view.layers.formula.setText(CANVAS_FORMULAS[i18n.language][caseId]);
  controller.view.layers.status.setText('');
  if (caseId === 'burgers') {
    controller.camera.setCenter(0.5, 0.45).setHeight(1.65);
  } else {
    const width = nodes.canvas.clientWidth || nodes.canvas.width;
    const canvasHeight = nodes.canvas.clientHeight || nodes.canvas.height;
    const aspect = Math.max(0.25, width / Math.max(1, canvasHeight));
    const domainWidth = caseId === 'euler-cylinder' ? 4.08 : 1.04;
    const height = Math.max(caseId === 'euler-cylinder' ? 2.25 : 1.16, domainWidth / aspect);
    controller.camera
      .setCenter(caseId === 'euler-cylinder' ? 2 : 0.5, caseId === 'euler-cylinder' ? 1.08 : 0.54)
      .setHeight(height);
  }
}

function updateDiagnostics() {
  const values = controller.diagnostics();
  const ru = i18n.language === 'ru';
  const parameters = controller.model.parameters;
  const common = ru
    ? `t ${values.time.toFixed(4)} · шаг ${values.step} · ${parameters.columns}×${parameters.rows} / P${parameters.degree} · CFL ${parameters.cfl.toFixed(2)}`
    : `t ${values.time.toFixed(4)} · step ${values.step} · ${parameters.columns}×${parameters.rows} / P${parameters.degree} · CFL ${parameters.cfl.toFixed(2)}`;
  if (values.caseId === 'euler-cylinder') {
    nodes.diagnostics.textContent = ru
      ? `${common} · ρмин ${values.minimumDensity.toFixed(3)} · pмин ${values.minimumPressure.toFixed(3)} · Mмакс ${values.maximumMach.toFixed(2)} · Cd ${values.dragCoefficient.toFixed(2)}`
      : `${common} · ρmin ${values.minimumDensity.toFixed(3)} · pmin ${values.minimumPressure.toFixed(3)} · Mmax ${values.maximumMach.toFixed(2)} · Cd ${values.dragCoefficient.toFixed(2)}`;
    return;
  }
  const accuracy = Number.isFinite(values.l2Error)
    ? `L2 ${values.l2Error.toExponential(2)}`
    : `${ru ? 'старшие моды' : 'higher modes'} ${values.modalEnergyFraction.toExponential(2)}`;
  nodes.diagnostics.textContent = `${common} · ${ru ? 'масса' : 'mass'} ${values.mass.toFixed(6)} · ${accuracy}`;
}

const app = mount(nodes.canvas, {
  scene: controller.scene,
  camera: controller.camera,
  fixedStep: 1 / 30,
  update: ({ dt }) => {
    controller.update(dt);
    localizeCanvas();
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
  translate: i18n.t,
});

function reset() {
  controller.reset(parameters());
  localizeCanvas();
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

i18n.onChange(() => {
  syncCase();
  updateDiagnostics();
  localizeCanvas();
  stageControls.sync();
  app.render();
});

globalThis.addEventListener?.('pagehide', () => {
  stageControls.dispose();
  app.destroy();
  controller.dispose();
}, { once: true });

updateDiagnostics();
localizeCanvas();
app.render();
stageControls.captureView();
stageControls.setPaused(startsPaused);
