import { Camera2D, Scene, mount } from '../../lib/chalkish/src/index.js';
import {
  createDsmcLabController,
  getDsmcLabPreset,
} from '../../lib/chalkish/examples/boards/_shared/dsmc-lab-controller.js';
import { BOARD_RENDER_STYLE } from '../../lib/chalkish/examples/board-settings.js';
import { bindStageControls } from '../../lib/chalkish/examples/stage-controls.js';
import {
  markChalkTransition,
  writeChalkText,
} from '../../lib/chalkish/examples/chalk-transition.js';
import { bindLabLanguage, withCommonTranslations } from '../lab-i18n.js';

const i18n = bindLabLanguage(withCommonTranslations({
  en: {
    'page.documentTitle': 'DSMC Laboratory',
    'page.description': 'Interactive laboratory for deterministic spatial DSMC experiments.',
    'page.title': 'DSMC',
    'stage.dsmc': 'Spatial DSMC numerical stage',
    'stage.dsmcCanvas': 'Particles, collision-cell occupancy, walls, and speed distribution',
    'controls.dsmc': 'Spatial DSMC controls',
    'page.particles': 'Particles',
    'page.model': 'Model',
    'page.cellClock': 'Cell and time step',
    'page.cellSize': 'Cell size',
    'page.wallControls': 'Wall controls',
    'page.maxwell': 'Maxwell boundary',
    'page.accommodation': 'Accommodation',
    'page.leftTemperature': 'Left T / K',
    'page.rightTemperature': 'Right T / K',
    'page.wallSpeed': 'Wall speed / m s⁻¹',
    'page.reset': 'Reseed calculation',
    'case.equilibrium': 'Equilibrium box',
    'case.heat': 'Heat transfer x',
    'case.rotation': 'Rotational N₂',
    'case.couette': 'Couette flow',
    'model.hs': 'Hard sphere',
    'plot.previous': 'Previous graph',
    'plot.next': 'Next graph',
    'plot.hide': 'Hide graph',
    'plot.show': 'Show graph',
    'plot.speed': 'Speeds',
    'plot.temperature': 'Temperatures',
    'plot.collisions': 'Collisions',
    'plot.speedLegend': 'sample / Maxwellian',
    'plot.temperatureLegend': 'Ttrans / Trot',
    'plot.collisionsLegend': 'accepted / trials',
  },
  ru: {
    'page.documentTitle': 'Лаборатория DSMC',
    'page.description': 'Интерактивная лаборатория пространственных расчётов прямым статистическим моделированием Монте-Карло.',
    'page.title': 'DSMC',
    'stage.dsmc': 'Поле пространственного расчёта DSMC',
    'stage.dsmcCanvas': 'Частицы, заполнение ячеек столкновений, стенки и распределение скоростей',
    'controls.dsmc': 'Параметры расчёта DSMC',
    'page.particles': 'Частицы',
    'page.model': 'Модель',
    'page.cellClock': 'Ячейка и шаг по времени',
    'page.cellSize': 'Размер ячейки',
    'page.wallControls': 'Параметры стенок',
    'page.maxwell': 'Граничное условие Максвелла',
    'page.accommodation': 'Аккомодация',
    'page.leftTemperature': 'Температура слева / К',
    'page.rightTemperature': 'Температура справа / К',
    'page.wallSpeed': 'Скорость стенки / м·с⁻¹',
    'page.reset': 'Перезапустить расчёт',
    'case.equilibrium': 'Равновесный объём',
    'case.heat': 'Теплоперенос по x',
    'case.rotation': 'Вращательная релаксация N₂',
    'case.couette': 'Течение Куэтта',
    'model.hs': 'Твёрдые сферы',
    'plot.previous': 'Предыдущий график',
    'plot.next': 'Следующий график',
    'plot.hide': 'Скрыть график',
    'plot.show': 'Показать график',
    'plot.speed': 'Скорости',
    'plot.temperature': 'Температуры',
    'plot.collisions': 'Столкновения',
    'plot.speedLegend': 'выборка / Максвелл',
    'plot.temperatureLegend': 'Tпост / Tвращ',
    'plot.collisionsLegend': 'принято / попытки',
  },
}));

const CANVAS_METHODS = Object.freeze({
  en: Object.freeze({
    'equilibrium-box': 'NTC collisions · periodic box · elastic VHS',
    'heat-transfer-x': 'NTC collisions · diffuse thermal x-walls · periodic y',
    'rotational-nitrogen': 'NTC collisions · VSS scattering · rotational Larsen–Borgnakke',
    'couette-flow': 'NTC collisions · periodic x · moving diffuse y-walls',
  }),
  ru: Object.freeze({
    'equilibrium-box': 'Столкновения NTC · периодический объём · упругие VHS',
    'heat-transfer-x': 'Столкновения NTC · диффузные тепловые стенки по x · периодичность по y',
    'rotational-nitrogen': 'Столкновения NTC · рассеяние VSS · вращательная модель Ларсена — Боргнакке',
    'couette-flow': 'Столкновения NTC · периодичность по x · движущиеся диффузные стенки по y',
  }),
});

function required(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`DSMC board is missing #${id}`);
  return node;
}

const nodes = Object.freeze({
  canvas: required('stage'),
  distributionCanvas: required('distribution-stage'),
  distributionPlot: required('distribution-plot'),
  stageControls: required('stage-controls'),
  pause: required('pause'),
  step: required('step'),
  reset: required('reset'),
  diagnostics: required('diagnostics'),
  caseId: required('case-id'),
  particleCount: required('particle-count'),
  knudsen: required('knudsen'),
  knudsenValue: required('knudsen-value'),
  cellSize: required('cell-size'),
  timeStep: required('time-step'),
  collisionModel: required('collision-model'),
  wallAccommodation: required('wall-accommodation'),
  wallAccommodationValue: required('wall-accommodation-value'),
  wallTemperatureLeft: required('wall-temperature-left'),
  wallTemperatureRight: required('wall-temperature-right'),
  wallSpeed: required('wall-speed'),
  distributionTabs: required('distribution-tabs'),
  distributionTabLabel: required('distribution-tab-label'),
  distributionTabLegend: required('distribution-tab-legend'),
  previousPlot: document.querySelector('[data-action="previous-plot"]'),
  nextPlot: document.querySelector('[data-action="next-plot"]'),
  togglePlot: document.querySelector('[data-action="toggle-plot"]'),
});

function closestOption(select, value) {
  let closest = select.options[0];
  let distance = Infinity;
  for (const option of select.options) {
    const nextDistance = Math.abs(Number(option.value) - Number(value));
    if (nextDistance < distance) {
      closest = option;
      distance = nextDistance;
    }
  }
  return closest.value;
}

function applyPreset(caseId) {
  const preset = getDsmcLabPreset(caseId);
  nodes.particleCount.value = closestOption(nodes.particleCount, preset.particleCount);
  nodes.knudsen.value = String(preset.knudsen);
  nodes.cellSize.value = closestOption(nodes.cellSize, preset.cellSize);
  nodes.timeStep.value = closestOption(nodes.timeStep, preset.timeStep);
  nodes.collisionModel.value = preset.collisionModel;
  nodes.wallAccommodation.value = String(preset.wallAccommodation);
  nodes.wallTemperatureLeft.value = String(preset.wallTemperatureLeft);
  nodes.wallTemperatureRight.value = String(preset.wallTemperatureRight);
  nodes.wallSpeed.value = String(preset.wallSpeed);
  syncOutputs();
}

function syncOutputs() {
  nodes.knudsenValue.textContent = Number(nodes.knudsen.value).toFixed(2);
  nodes.wallAccommodationValue.textContent = Number(
    nodes.wallAccommodation.value,
  ).toFixed(2);
}

function parameters() {
  return {
    ...getDsmcLabPreset(nodes.caseId.value),
    particleCount: Number(nodes.particleCount.value),
    seed: 2026,
    knudsen: Number(nodes.knudsen.value),
    cellSize: Number(nodes.cellSize.value),
    timeStep: Number(nodes.timeStep.value),
    collisionModel: nodes.collisionModel.value,
    wallAccommodation: Number(nodes.wallAccommodation.value),
    wallTemperatureLeft: Number(nodes.wallTemperatureLeft.value),
    wallTemperatureRight: Number(nodes.wallTemperatureRight.value),
    wallSpeed: Number(nodes.wallSpeed.value),
  };
}

applyPreset(nodes.caseId.value);
const controller = createDsmcLabController({
  model: parameters(),
  styleName: BOARD_RENDER_STYLE,
});
const plotScene = new Scene({ background: '#0d1611' });
const plotCamera = new Camera2D({ centerX: 8.05, centerY: 1.05, height: 1.8 });
plotScene.add(
  controller.view.layers.maxwellian,
  controller.view.layers.distribution,
);
controller.view.layers.distributionFrame.setVisible(false);
controller.view.layers.distributionLabel.setVisible(false);
const plotApp = mount(nodes.distributionCanvas, {
  scene: plotScene,
  camera: plotCamera,
  fixedStep: null,
  adaptiveQuality: false,
});
const startsPaused = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let diagnosticsCountdown = 0;
const PLOT_MODES = Object.freeze(['speed', 'temperature', 'collisions']);
const plotHistory = {
  x: [],
  temperature: [],
  rotationalTemperature: [],
  collisions: [],
  attempts: [],
  lastStep: -1,
};
let plotModeIndex = 0;
let plotVisible = true;

function canvasAspect() {
  const width = nodes.canvas.clientWidth || nodes.canvas.width;
  const height = nodes.canvas.clientHeight || nodes.canvas.height;
  return Math.max(0.25, width / Math.max(1, height));
}

const plotAnchorMatrix = new Float64Array(6);

function positionPlotPanel() {
  const ratio = app.renderer.pixelRatio || 1;
  const backingWidth = nodes.canvas.width;
  const backingHeight = nodes.canvas.height;
  const width = backingWidth / ratio;
  const height = backingHeight / ratio;
  const { domain } = controller.snapshot();
  controller.camera.matrix(plotAnchorMatrix, backingWidth, backingHeight);
  const x = (plotAnchorMatrix[0] * domain.maxX
    + plotAnchorMatrix[2] * domain.minY
    + plotAnchorMatrix[4]) / ratio;
  const y = (plotAnchorMatrix[1] * domain.maxX
    + plotAnchorMatrix[3] * domain.minY
    + plotAnchorMatrix[5]) / ratio;
  nodes.distributionTabs.style.setProperty('--plot-right', `${Math.max(0, width - x)}px`);
  nodes.distributionTabs.style.setProperty('--plot-bottom', `${Math.max(0, height - y)}px`);
}

function recordPlotHistory(values) {
  if (values.step === plotHistory.lastStep) return;
  plotHistory.lastStep = values.step;
  plotHistory.x.push(plotHistory.x.length);
  plotHistory.temperature.push(values.temperature);
  plotHistory.rotationalTemperature.push(
    Number.isFinite(values.rotationalTemperature) ? values.rotationalTemperature : 0,
  );
  plotHistory.collisions.push(values.collisionsLastStep);
  plotHistory.attempts.push(values.collisionAttemptsLastStep);
  if (plotHistory.x.length > 80) {
    for (const valuesArray of Object.values(plotHistory)) {
      if (Array.isArray(valuesArray)) valuesArray.shift();
    }
    for (let index = 0; index < plotHistory.x.length; index += 1) {
      plotHistory.x[index] = index;
    }
  }
}

function setPlotBuffers(x, primary, reference, { referenceVisible = true } = {}) {
  const count = Math.min(x.length, primary.length, reference.length);
  const maximum = Math.max(1e-12, ...primary, ...reference);
  const maximumX = Math.max(1, ...x);
  const scaleX = 3.05 / maximumX;
  const scaleY = 1.1 / maximum;
  controller.view.layers.distribution
    .setBuffers({ x, y: primary, count })
    .setScale(scaleX, scaleY)
    .setPosition(6.52, 0.43)
    .setVisible(plotVisible);
  controller.view.layers.maxwellian
    .setBuffers({ x, y: reference, count })
    .setScale(scaleX, scaleY)
    .setPosition(6.52, 0.43)
    .setVisible(plotVisible && referenceVisible);
}

function renderPlot() {
  const mode = PLOT_MODES[plotModeIndex];
  const layers = controller.view.layers;
  layers.distributionFrame.setVisible(false);
  layers.distributionLabel.setVisible(false);
  const wasVisible = nodes.distributionTabs.dataset.expanded === 'true';
  if (wasVisible !== plotVisible) {
    markChalkTransition(nodes.distributionPlot, plotVisible ? 'write' : 'erase');
  }
  nodes.distributionTabs.dataset.expanded = String(plotVisible);
  nodes.togglePlot.setAttribute('aria-expanded', String(plotVisible));
  const action = i18n.t(plotVisible ? 'plot.hide' : 'plot.show');
  nodes.togglePlot.setAttribute('aria-label', action);
  nodes.togglePlot.setAttribute('title', action);
  const label = plotVisible
    ? i18n.t(`plot.${mode}`)
    : `‹ ${i18n.t('plot.show')}`;
  const legend = i18n.t(`plot.${mode}Legend`);
  if (nodes.distributionTabLabel.textContent !== label) {
    writeChalkText(nodes.distributionTabLabel, label);
  }
  if (nodes.distributionTabLegend.textContent !== legend) {
    writeChalkText(nodes.distributionTabLegend, legend);
  }
  if (!plotVisible) {
    layers.distribution.setVisible(false);
    layers.maxwellian.setVisible(false);
    plotApp.render();
    return;
  }

  if (mode === 'speed') {
    const snapshot = controller.snapshot();
    setPlotBuffers(
      snapshot.state.speedBins,
      snapshot.state.speedHistogram,
      snapshot.state.maxwellian,
    );
    plotApp.render();
    return;
  }

  if (mode === 'temperature') {
    const rotationalVisible = plotHistory.rotationalTemperature.some((value) => value > 0);
    setPlotBuffers(
      plotHistory.x,
      plotHistory.temperature,
      plotHistory.rotationalTemperature,
      { referenceVisible: rotationalVisible },
    );
    plotApp.render();
    return;
  }

  setPlotBuffers(
    plotHistory.x,
    plotHistory.collisions,
    plotHistory.attempts,
  );
  plotApp.render();
}

function localizeCanvas() {
  const values = controller.diagnostics();
  controller.view.layers.heading.setText('');
  controller.view.layers.method.setText(CANVAS_METHODS[i18n.language][values.caseId]);
  controller.view.layers.status.setText('');
  controller.camera
    .setCenter(5, 3.2)
    .setHeight(Math.max(6.7, 10.35 / canvasAspect()));
  positionPlotPanel();
  renderPlot();
}

function formatRotational(value) {
  return Number.isFinite(value)
    ? `${value.toFixed(1)} K`
    : i18n.language === 'ru' ? 'не учитывается' : 'not active';
}

function updateDiagnostics() {
  const values = controller.diagnostics();
  recordPlotHistory(values);
  const wallHeat = Object.values(values.wallEnergy)
    .reduce((sum, value) => sum + value, 0)
    .toExponential(3);
  const ru = i18n.language === 'ru';
  const balance = values.closedSystem
    ? `ΔE ${values.energyError.toExponential(2)} · Δp ${values.momentumError.toExponential(2)}`
    : `${ru ? 'qст' : 'qwall'} ${wallHeat} ${ru ? 'Дж' : 'J'}`;
  nodes.diagnostics.textContent = [
    `t ${(1e3 * values.time).toFixed(2)} ${ru ? 'мс' : 'ms'}`,
    `${ru ? 'шаг' : 'step'} ${values.step}`,
    `N ${values.particles}`,
    `${ru ? 'Tпост' : 'Ttrans'} ${values.temperature.toFixed(1)} K`,
    `${ru ? 'Tвращ' : 'Trot'} ${formatRotational(values.rotationalTemperature)}`,
    `${ru ? 'столкновения' : 'collisions'} ${values.collisions}`,
    `dx/λ ${values.dxOverMeanFreePath.toFixed(2)}`,
    `dt/τ ${values.dtOverMeanCollisionTime.toFixed(2)}`,
    `${ru ? 'Nяч' : 'npc'} ${values.particlesPerCell.toFixed(1)}`,
    balance,
  ].join(' · ');
}

const app = mount(nodes.canvas, {
  scene: controller.scene,
  camera: controller.camera,
  fixedStep: 1 / 30,
  update: () => {
    controller.update();
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
  for (const valuesArray of Object.values(plotHistory)) {
    if (Array.isArray(valuesArray)) valuesArray.length = 0;
  }
  plotHistory.lastStep = -1;
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
  applyPreset(nodes.caseId.value);
  safeReset();
});
for (const control of [
  nodes.particleCount,
  nodes.cellSize,
  nodes.timeStep,
  nodes.collisionModel,
  nodes.wallTemperatureLeft,
  nodes.wallTemperatureRight,
  nodes.wallSpeed,
]) {
  control.addEventListener('change', safeReset);
}
nodes.knudsen.addEventListener('input', syncOutputs);
nodes.wallAccommodation.addEventListener('input', syncOutputs);
nodes.knudsen.addEventListener('change', safeReset);
nodes.wallAccommodation.addEventListener('change', safeReset);
nodes.reset.addEventListener('click', safeReset);
nodes.step.addEventListener('click', updateDiagnostics);
nodes.previousPlot.addEventListener('click', () => {
  plotModeIndex = (plotModeIndex - 1 + PLOT_MODES.length) % PLOT_MODES.length;
  renderPlot();
  app.render();
});
nodes.nextPlot.addEventListener('click', () => {
  plotModeIndex = (plotModeIndex + 1) % PLOT_MODES.length;
  renderPlot();
  app.render();
});
nodes.togglePlot.addEventListener('click', () => {
  plotVisible = !plotVisible;
  renderPlot();
  app.render();
});

i18n.onChange(() => {
  updateDiagnostics();
  localizeCanvas();
  stageControls.sync();
  app.render();
});

globalThis.addEventListener?.('pagehide', () => {
  stageControls.dispose();
  plotApp.destroy();
  plotScene.clear();
  app.destroy();
  controller.dispose();
}, { once: true });

updateDiagnostics();
localizeCanvas();
app.render();
stageControls.captureView();
stageControls.setPaused(startsPaused);
