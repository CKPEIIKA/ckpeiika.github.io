import { mount } from '../../lib/chalkish/src/index.js';
import {
  createDsmcLabController,
  getDsmcLabPreset,
} from '../../lib/chalkish/examples/boards/_shared/dsmc-lab-controller.js';
import { BOARD_RENDER_STYLE } from '../../lib/chalkish/examples/board-settings.js';
import { bindStageControls } from '../../lib/chalkish/examples/stage-controls.js';

function required(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`DSMC board is missing #${id}`);
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
const startsPaused = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let diagnosticsCountdown = 0;

function formatRotational(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} K` : 'not active';
}

function updateDiagnostics() {
  const values = controller.diagnostics();
  const closed = values.closedSystem
    ? `closed ΔE ${values.energyError.toExponential(3)} · Δp ${values.momentumError.toExponential(3)}`
    : `wall-driven q ${Object.values(values.wallEnergy).reduce((sum, value) => sum + value, 0).toExponential(3)} J`;
  nodes.diagnostics.textContent = [
    `case / model  ${values.caseId} / ${controller.model.parameters.collisionModel}`,
    `time / step   ${(1e3 * values.time).toFixed(4)} ms / ${values.step}`,
    `particles     ${values.particles} · cells ${values.cells} · occupied ${values.occupiedCells}`,
    `Ttrans / Trot ${values.temperature.toFixed(2)} K / ${formatRotational(values.rotationalTemperature)}`,
    `bulk velocity ${values.bulkVelocityX.toFixed(3)}, ${values.bulkVelocityY.toFixed(3)} m s⁻¹`,
    `collisions    ${values.collisions} total · ${values.collisionsLastStep}/${values.collisionAttemptsLastStep} last`,
    `validity      dx/λ ${values.dxOverMeanFreePath.toFixed(3)} · dt/τ ${values.dtOverMeanCollisionTime.toFixed(3)} · npc ${values.particlesPerCell.toFixed(2)}`,
    `majorant      ${values.majorantViolations} violations · overflow ${values.overflowed ? 'yes' : 'no'}`,
    `invariants    ${closed}`,
  ].join('\n');
}

const app = mount(nodes.canvas, {
  scene: controller.scene,
  camera: controller.camera,
  fixedStep: 1 / 30,
  update: () => {
    controller.update();
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

globalThis.addEventListener?.('pagehide', () => {
  stageControls.dispose();
  app.destroy();
  controller.dispose();
}, { once: true });

updateDiagnostics();
app.render();
stageControls.captureView();
stageControls.setPaused(startsPaused);
