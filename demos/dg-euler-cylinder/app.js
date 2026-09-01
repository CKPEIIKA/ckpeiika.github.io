import {
  Camera2D,
  COLORMAPS,
  CurveLayer,
  ScalarField,
  Scene,
  chalkStyle,
  mount,
} from '../../lib/chalkish/src/index.js';
import {
  DG_FV_DISPLAY_FIELDS,
  DG_FV_INITIAL_CONDITIONS,
  createDgFvLabController,
} from '../../lib/chalkish/examples/boards/_shared/dg-fv-lab-controller.js';
import { BOARD_RENDER_STYLE } from '../../lib/chalkish/examples/board-settings.js';
import { bindStageControls } from '../../lib/chalkish/examples/stage-controls.js';
import {
  markChalkTransition,
  writeChalkText,
} from '../../lib/chalkish/examples/chalk-transition.js';
import { bindLabLanguage, withCommonTranslations } from '../lab-i18n.js';
import { RingHistory } from '../lab-parity.js';

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
    'page.exactMesh': 'Exact mesh',
    'page.stepsPerFrame': 'Steps / frame',
    'page.quality': 'Quality',
    'quality.auto': 'Automatic',
    'quality.high': 'High',
    'quality.balanced': 'Balanced',
    'quality.low': 'Low',
    'quality.minimum': 'Minimum',
    'case.euler': 'Euler / body',
    'case.diamond': 'Diamond translation',
    'case.advection': 'Scalar advection',
    'case.burgers': 'Burgers',
    'body.square': 'Square',
    'body.wedge': '10° wedge',
    'body.cylinder': 'Cylinder',
    'body.none': 'No body',
    'velocity.uniform': 'Uniform',
    'velocity.swirl': 'Periodic swirl',
    'velocity.shear': 'Shear',
    'plot.previous': 'Previous graph',
    'plot.next': 'Next graph',
    'plot.hide': 'Hide graph',
    'plot.show': 'Show graph',
    'analysis.forces': 'Forces',
    'analysis.forcesLegend': 'Cd / Cl',
    'analysis.health': 'Numerical state',
    'analysis.healthLegend': 'jump / residual',
    'analysis.reconstruction': 'Reconstruction',
    'analysis.reconstructionLegend': 'DG / cell mean',
    'analysis.spaceTime': 'Space-time history',
    'analysis.spaceTimeLegend': 'u(x,t)',
    'analysis.spectrum': 'Modal spectrum',
    'analysis.spectrumLegend': 'L2 by order',
    'help.dg': 'Nx and Ny set the exact mesh. P0 is the finite-volume limit. The dashed curve in Burgers mode is the cell mean. For a wedge, dashed rays show the weak attached-shock solution of the theta-beta-Mach relation when it exists.',
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
    'page.exactMesh': 'Точная сетка',
    'page.stepsPerFrame': 'Шагов на кадр',
    'page.quality': 'Качество',
    'quality.auto': 'Автоматически',
    'quality.high': 'Высокое',
    'quality.balanced': 'Сбалансированное',
    'quality.low': 'Низкое',
    'quality.minimum': 'Минимальное',
    'case.euler': 'Уравнения Эйлера / тело',
    'case.diamond': 'Перенос ромба',
    'case.advection': 'Скалярный перенос',
    'case.burgers': 'Уравнение Бюргерса',
    'body.square': 'Квадрат',
    'body.wedge': 'Клин 10°',
    'body.cylinder': 'Цилиндр',
    'body.none': 'Без тела',
    'velocity.uniform': 'Однородное',
    'velocity.swirl': 'Периодический вихрь',
    'velocity.shear': 'Сдвиговое',
    'plot.previous': 'Предыдущий график',
    'plot.next': 'Следующий график',
    'plot.hide': 'Скрыть график',
    'plot.show': 'Показать график',
    'analysis.forces': 'Силы',
    'analysis.forcesLegend': 'Cd / Cl',
    'analysis.health': 'Состояние схемы',
    'analysis.healthLegend': 'скачок / невязка',
    'analysis.reconstruction': 'Реконструкция',
    'analysis.reconstructionLegend': 'DG / среднее',
    'analysis.spaceTime': 'История решения',
    'analysis.spaceTimeLegend': 'u(x,t)',
    'analysis.spectrum': 'Спектр мод',
    'analysis.spectrumLegend': 'норма L2 по порядку',
    'help.dg': 'Nx и Ny задают точное число ячеек. P0 соответствует методу конечных объёмов. В режиме уравнения Бюргерса пунктиром показано среднее по ячейке. Для клина пунктирные лучи задают слабое присоединённое решение соотношения тета-бета-Маха, если оно существует.',
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
  columns: required('mesh-columns'),
  rows: required('mesh-rows'),
  cfl: required('cfl'),
  cflValue: required('cfl-value'),
  fluxAlpha: required('flux-alpha'),
  fluxAlphaValue: required('flux-alpha-value'),
  displayField: required('display-field'),
  bodyShape: required('body-shape'),
  initialCondition: required('initial-condition'),
  velocityField: required('velocity-field'),
  limiter: required('limiter'),
  stepsPerFrame: required('steps-per-frame'),
  mach: required('mach'),
  bodyRadius: required('body-radius'),
  gamma: required('gamma'),
  renderQuality: required('render-quality'),
  help: required('help'),
  helpDialog: required('help-dialog'),
  analysisCanvas: required('analysis-stage'),
  analysisTabs: required('analysis-tabs'),
  analysisPlot: required('analysis-plot'),
  analysisTabLabel: required('analysis-tab-label'),
  analysisTabLegend: required('analysis-tab-legend'),
  previousAnalysis: document.querySelector('[data-action="previous-analysis"]'),
  nextAnalysis: document.querySelector('[data-action="next-analysis"]'),
  toggleAnalysis: document.querySelector('[data-action="toggle-analysis"]'),
  bodyRow: document.querySelector('[data-control="body"]'),
  initialRow: document.querySelector('[data-control="initial"]'),
  velocityRow: document.querySelector('[data-control="velocity"]'),
  eulerRows: [...document.querySelectorAll('[data-control="euler"]')],
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
  en: Object.freeze({ schlieren: 'Schlieren |∇ρ|/ρ', density: 'Density ρ', pressure: 'Pressure p', mach: 'Mach number', speed: 'Speed |u|', vorticity: 'Vorticity', entropy: 'Entropy proxy', jump: 'Density jump', residual: 'Density residual', solid: 'Solid-cell mask', field: 'DG field', mean: 'Cell mean', error: 'Absolute error', modes: 'Higher-mode energy' }),
  ru: Object.freeze({ schlieren: 'Шлирен |∇ρ|/ρ', density: 'Плотность ρ', pressure: 'Давление p', mach: 'Число Маха', speed: 'Скорость |u|', vorticity: 'Завихренность', entropy: 'Мера энтропии', jump: 'Скачок плотности', residual: 'Невязка плотности', solid: 'Маска твёрдых ячеек', field: 'Поле DG', mean: 'Среднее по ячейке', error: 'Абсолютная погрешность', modes: 'Энергия старших мод' }),
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
  for (const row of nodes.eulerRows) row.hidden = caseId !== 'euler-cylinder';
  if (defaults) {
    nodes.resolution.value = config.resolution;
    nodes.degree.value = config.degree;
    nodes.cfl.value = config.cfl;
    nodes.limiter.value = config.limiter;
    nodes.displayField.value = DG_FV_DISPLAY_FIELDS[caseId][0];
    if (initial.length > 0) nodes.initialCondition.value = initial[0];
    nodes.velocityField.value = 'uniform';
    const [columns, rows] = config.resolution.split('x');
    nodes.columns.value = columns;
    nodes.rows.value = rows;
    nodes.mach.value = '1.5';
    nodes.bodyRadius.value = '0.1';
    nodes.gamma.value = '1.4';
  }
  nodes.cflValue.textContent = Number(nodes.cfl.value).toFixed(2);
  nodes.fluxAlphaValue.textContent = Number(nodes.fluxAlpha.value).toFixed(2);
}

function parameters() {
  return {
    caseId: nodes.caseId.value,
    columns: Number(nodes.columns.value),
    rows: nodes.caseId.value === 'burgers' ? 1 : Number(nodes.rows.value),
    degree: Number(nodes.degree.value),
    cfl: Number(nodes.cfl.value),
    fluxAlpha: Number(nodes.fluxAlpha.value),
    displayField: nodes.displayField.value,
    bodyShape: nodes.bodyShape.value,
    initialCondition: nodes.initialCondition.value || 'blob',
    velocityField: nodes.velocityField.value,
    limiter: nodes.limiter.value,
    mach: Number(nodes.mach.value),
    bodyRadius: Number(nodes.bodyRadius.value),
    gamma: Number(nodes.gamma.value),
  };
}

syncCase({ defaults: true });
const controller = createDgFvLabController({
  model: parameters(),
  styleName: BOARD_RENDER_STYLE,
});
const ANALYSIS_CAPACITY = 120;
const analysisHistory = new RingHistory(
  ['time', 'drag', 'lift', 'jump', 'residual'],
  ANALYSIS_CAPACITY,
);
const analysisBuffers = Object.freeze({
  sourceX: new Float64Array(ANALYSIS_CAPACITY),
  sourceA: new Float64Array(ANALYSIS_CAPACITY),
  sourceB: new Float64Array(ANALYSIS_CAPACITY),
  x: new Float64Array(ANALYSIS_CAPACITY),
  a: new Float64Array(ANALYSIS_CAPACITY),
  b: new Float64Array(ANALYSIS_CAPACITY),
});
const analysisScene = new Scene({ background: '#0d1611' });
const analysisCamera = new Camera2D({ centerX: 0.5, centerY: 0.5, height: 1.08 });
const analysisPrimary = new CurveLayer({
  x: analysisBuffers.x,
  y: analysisBuffers.a,
  count: 0,
  zIndex: 2,
  style: chalkStyle('dusty', { stroke: '#f1ecda', width: 2, passes: 2 }),
});
const analysisSecondary = new CurveLayer({
  x: analysisBuffers.x,
  y: analysisBuffers.b,
  count: 0,
  zIndex: 1,
  style: chalkStyle('dusty', {
    stroke: '#efd677', width: 1.4, dash: [5, 4], passes: 2,
  }),
});
let burgersHistory = new Float32Array(60);
let burgersHistoryColumns = 1;
let burgersHistoryRows = 0;
const analysisField = new ScalarField(burgersHistory, 1, 60, {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
  lut: COLORMAPS.chalk,
  interpolation: 'nearest',
  copy: false,
  zIndex: 0,
  visible: false,
  style: { opacity: 0.94 },
});
analysisScene.add(analysisField, analysisSecondary, analysisPrimary);
const analysisApp = mount(nodes.analysisCanvas, {
  scene: analysisScene,
  camera: analysisCamera,
  fixedStep: null,
  adaptiveQuality: false,
});
let analysisModeIndex = 0;
let analysisVisible = true;
let analysisLastStep = -1;

function analysisModes() {
  const caseId = controller.model.parameters.caseId;
  if (caseId === 'euler-cylinder') return ['forces', 'health'];
  if (caseId === 'burgers') return ['reconstruction', 'spaceTime', 'spectrum'];
  return ['reconstruction', 'spectrum'];
}

function normalizeAnalysis(x, first, second, count) {
  const outputCount = Math.min(ANALYSIS_CAPACITY, count);
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;
  for (let index = 0; index < outputCount; index += 1) {
    const sourceIndex = outputCount === count
      ? index
      : Math.round(index * (count - 1) / Math.max(1, outputCount - 1));
    if (Number.isFinite(x[sourceIndex])) {
      minimumX = Math.min(minimumX, x[sourceIndex]);
      maximumX = Math.max(maximumX, x[sourceIndex]);
    }
    for (const value of [first[sourceIndex], second[sourceIndex]]) {
      if (!Number.isFinite(value)) continue;
      minimumY = Math.min(minimumY, value);
      maximumY = Math.max(maximumY, value);
    }
  }
  const spanX = Math.max(1e-12, maximumX - minimumX);
  const spanY = Math.max(1e-12, maximumY - minimumY);
  for (let index = 0; index < outputCount; index += 1) {
    const sourceIndex = outputCount === count
      ? index
      : Math.round(index * (count - 1) / Math.max(1, outputCount - 1));
    analysisBuffers.x[index] = 0.06 + 0.88 * (x[sourceIndex] - minimumX) / spanX;
    analysisBuffers.a[index] = Number.isFinite(first[sourceIndex])
      ? 0.08 + 0.84 * (first[sourceIndex] - minimumY) / spanY
      : Number.NaN;
    analysisBuffers.b[index] = Number.isFinite(second[sourceIndex])
      ? 0.08 + 0.84 * (second[sourceIndex] - minimumY) / spanY
      : Number.NaN;
  }
  analysisPrimary.setBuffers({ x: analysisBuffers.x, y: analysisBuffers.a, count: outputCount });
  analysisSecondary.setBuffers({ x: analysisBuffers.x, y: analysisBuffers.b, count: outputCount });
}

function recordAnalysis(values) {
  if (values.step === analysisLastStep) return;
  analysisLastStep = values.step;
  analysisHistory.push({
    time: values.time,
    drag: values.dragCoefficient,
    lift: values.liftCoefficient,
    jump: values.maximumJump,
    residual: values.residualNorm,
  });
  if (values.caseId !== 'burgers') return;
  const snapshot = controller.snapshot();
  const columns = snapshot.state.scalar.length;
  if (columns !== burgersHistoryColumns) {
    burgersHistoryColumns = columns;
    burgersHistory = new Float32Array(columns * 60);
    burgersHistoryRows = 0;
  }
  if (burgersHistoryRows < 60) burgersHistoryRows += 1;
  else burgersHistory.copyWithin(0, columns);
  const offset = (burgersHistoryRows - 1) * columns;
  burgersHistory.set(snapshot.state.scalar, offset);
}

function renderAnalysis() {
  const modes = analysisModes();
  analysisModeIndex = ((analysisModeIndex % modes.length) + modes.length) % modes.length;
  const mode = modes[analysisModeIndex];
  nodes.analysisTabs.dataset.expanded = String(analysisVisible);
  nodes.toggleAnalysis.setAttribute('aria-expanded', String(analysisVisible));
  const action = i18n.t(analysisVisible ? 'plot.hide' : 'plot.show');
  nodes.toggleAnalysis.setAttribute('aria-label', action);
  nodes.toggleAnalysis.setAttribute('title', action);
  const label = analysisVisible ? i18n.t(`analysis.${mode}`) : `‹ ${i18n.t('plot.show')}`;
  const legend = i18n.t(`analysis.${mode}Legend`);
  if (nodes.analysisTabLabel.textContent !== label) writeChalkText(nodes.analysisTabLabel, label);
  if (nodes.analysisTabLegend.textContent !== legend) {
    writeChalkText(nodes.analysisTabLegend, legend);
  }
  analysisPrimary.setVisible(analysisVisible && mode !== 'spaceTime');
  analysisSecondary.setVisible(analysisVisible && mode !== 'spaceTime' && mode !== 'spectrum');
  analysisField.setVisible(analysisVisible && mode === 'spaceTime');
  if (!analysisVisible) {
    analysisApp.render();
    return;
  }
  const snapshot = controller.snapshot();
  if (mode === 'forces' || mode === 'health') {
    const count = analysisHistory.length;
    const x = analysisHistory.copy('time', analysisBuffers.sourceX);
    const first = analysisHistory.copy(mode === 'forces' ? 'drag' : 'jump', analysisBuffers.sourceA);
    const second = analysisHistory.copy(mode === 'forces' ? 'lift' : 'residual', analysisBuffers.sourceB);
    normalizeAnalysis(x, first, second, count);
  } else if (mode === 'reconstruction') {
    normalizeAnalysis(
      snapshot.state.coordinatesX,
      snapshot.state.scalar,
      snapshot.state.meanScalar,
      snapshot.state.coordinatesX.length,
    );
  } else if (mode === 'spectrum') {
    const count = snapshot.state.modalSpectrum.length;
    for (let index = 0; index < count; index += 1) {
      analysisBuffers.sourceX[index] = index;
      analysisBuffers.sourceA[index] = snapshot.state.modalSpectrum[index];
      analysisBuffers.sourceB[index] = Number.NaN;
    }
    normalizeAnalysis(
      analysisBuffers.sourceX,
      analysisBuffers.sourceA,
      analysisBuffers.sourceB,
      count,
    );
  } else {
    analysisField.columns = burgersHistoryColumns;
    analysisField.rows = 60;
    analysisField.setData(burgersHistory, { copy: false });
  }
  analysisApp.render();
}
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
  positionAnalysisPanel();
}

const analysisAnchorMatrix = new Float64Array(6);

function positionAnalysisPanel() {
  const ratio = app.renderer.pixelRatio || 1;
  const backingWidth = nodes.canvas.width;
  const backingHeight = nodes.canvas.height;
  const width = backingWidth / ratio;
  const height = backingHeight / ratio;
  const { domain } = controller.snapshot();
  controller.camera.matrix(analysisAnchorMatrix, backingWidth, backingHeight);
  const x = (analysisAnchorMatrix[0] * domain.maxX
    + analysisAnchorMatrix[2] * domain.minY
    + analysisAnchorMatrix[4]) / ratio;
  const y = (analysisAnchorMatrix[1] * domain.maxX
    + analysisAnchorMatrix[3] * domain.minY
    + analysisAnchorMatrix[5]) / ratio;
  nodes.analysisTabs.style.setProperty('--plot-right', `${Math.max(0, width - x)}px`);
  nodes.analysisTabs.style.setProperty('--plot-bottom', `${Math.max(0, height - y)}px`);
}

function updateDiagnostics() {
  const values = controller.diagnostics();
  recordAnalysis(values);
  const ru = i18n.language === 'ru';
  const parameters = controller.model.parameters;
  const fps = 1000 / Math.max(1e-9, app.quality.emaMs);
  const common = ru
    ? `t ${values.time.toFixed(4)} · шаг ${values.step} · ${parameters.columns}×${parameters.rows} / P${parameters.degree} · CFL ${parameters.cfl.toFixed(2)} · ${fps.toFixed(0)} кадр/с`
    : `t ${values.time.toFixed(4)} · step ${values.step} · ${parameters.columns}×${parameters.rows} / P${parameters.degree} · CFL ${parameters.cfl.toFixed(2)} · ${fps.toFixed(0)} fps`;
  if (values.caseId === 'euler-cylinder') {
    nodes.diagnostics.textContent = ru
      ? `${common} · ρмин ${values.minimumDensity.toFixed(3)} · pмин ${values.minimumPressure.toFixed(3)} · Cd ${values.dragCoefficient.toFixed(2)} · Cl ${values.liftCoefficient.toFixed(2)} · огр. ${values.positivityLimitedCells}/${values.troubledCells} · ${values.healthy ? 'норма' : 'снизьте CFL или включите ограничитель положительности'}`
      : `${common} · ρmin ${values.minimumDensity.toFixed(3)} · pmin ${values.minimumPressure.toFixed(3)} · Cd ${values.dragCoefficient.toFixed(2)} · Cl ${values.liftCoefficient.toFixed(2)} · limited ${values.positivityLimitedCells}/${values.troubledCells} · ${values.healthy ? 'healthy' : 'reduce CFL or enable positivity'}`;
    renderAnalysis();
    return;
  }
  const accuracy = Number.isFinite(values.l2Error)
    ? `L2 ${values.l2Error.toExponential(2)}`
    : `${ru ? 'старшие моды' : 'higher modes'} ${values.modalEnergyFraction.toExponential(2)}`;
  nodes.diagnostics.textContent = `${common} · ${ru ? 'масса' : 'mass'} ${values.mass.toFixed(6)} · ${accuracy} · ${ru ? 'невязка' : 'residual'} ${values.residualNorm.toExponential(2)}`;
  renderAnalysis();
}

const app = mount(nodes.canvas, {
  scene: controller.scene,
  camera: controller.camera,
  fixedStep: 1 / 30,
  update: ({ dt }) => {
    const steps = Number(nodes.stepsPerFrame.value);
    for (let index = 0; index < steps; index += 1) controller.update(dt);
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
const layoutObserver = new ResizeObserver(() => {
  localizeCanvas();
  renderAnalysis();
  app.render();
});
layoutObserver.observe(nodes.canvas);

function reset() {
  controller.reset(parameters());
  analysisHistory.clear();
  analysisLastStep = -1;
  burgersHistoryColumns = 1;
  burgersHistoryRows = 0;
  burgersHistory = new Float32Array(60);
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
nodes.resolution.addEventListener('change', () => {
  const [columns, rows] = nodes.resolution.value.split('x');
  nodes.columns.value = columns;
  nodes.rows.value = rows;
  safeReset();
});
for (const control of [
  nodes.degree,
  nodes.columns,
  nodes.rows,
  nodes.displayField,
  nodes.bodyShape,
  nodes.initialCondition,
  nodes.velocityField,
  nodes.limiter,
  nodes.mach,
  nodes.bodyRadius,
  nodes.gamma,
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
nodes.renderQuality.addEventListener('change', () => {
  app.adaptiveQuality = nodes.renderQuality.value === 'auto';
  if (!app.adaptiveQuality) app.quality.setLevel(Number(nodes.renderQuality.value));
  app.resize().render();
});
nodes.previousAnalysis.addEventListener('click', () => {
  analysisModeIndex -= 1;
  renderAnalysis();
});
nodes.nextAnalysis.addEventListener('click', () => {
  analysisModeIndex += 1;
  renderAnalysis();
});
nodes.toggleAnalysis.addEventListener('click', () => {
  analysisVisible = !analysisVisible;
  markChalkTransition(nodes.analysisPlot, analysisVisible ? 'write' : 'erase');
  renderAnalysis();
});
nodes.help.addEventListener('click', () => nodes.helpDialog.showModal());

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement
      || event.target instanceof HTMLSelectElement
      || event.target instanceof HTMLTextAreaElement) return;
  const key = event.key.toLowerCase();
  if (key === ' ') {
    event.preventDefault();
    nodes.pause.click();
  } else if (key === 's') nodes.step.click();
  else if (key === 'r') nodes.reset.click();
  else if (key === 'h') nodes.helpDialog.open ? nodes.helpDialog.close() : nodes.helpDialog.showModal();
  else if (['1', '2', '3', '4'].includes(key)) {
    nodes.caseId.selectedIndex = Number(key) - 1;
    nodes.caseId.dispatchEvent(new Event('change'));
  } else if (key === '[' || key === ']') {
    const direction = key === ']' ? 1 : -1;
    const options = [...nodes.degree.options].filter((option) => !option.disabled);
    const index = options.indexOf(nodes.degree.selectedOptions[0]);
    nodes.degree.value = options[(index + direction + options.length) % options.length].value;
    nodes.degree.dispatchEvent(new Event('change'));
  }
});

i18n.onChange(() => {
  syncCase();
  localizeCanvas();
  updateDiagnostics();
  stageControls.sync();
  app.render();
});

globalThis.addEventListener?.('pagehide', () => {
  layoutObserver.disconnect();
  stageControls.dispose();
  analysisApp.destroy();
  analysisScene.clear();
  app.destroy();
  controller.dispose();
}, { once: true });

localizeCanvas();
updateDiagnostics();
app.render();
stageControls.captureView();
stageControls.setPaused(startsPaused);
