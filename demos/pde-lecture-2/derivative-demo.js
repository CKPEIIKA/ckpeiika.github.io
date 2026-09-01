import { mount, screenToWorld } from '../../lib/chalkish/src/index.js';
import { markChalkTransition } from '../../lib/chalkish/examples/chalk-transition.js';
import { DerivativeMicroscopeModel } from './derivative-model.js';
import { bindDerivativeMicroscopeView } from './derivative-view.js';
import { createPdeToolbar } from './pde-toolbar.js';

const COPY = Object.freeze({
  ru: Object.freeze({
    preset: 'Форма профиля',
    presetHelp: 'Функция u(x), для которой вычисляются первая и вторая производные.',
    presets: Object.freeze({
      line: 'Прямая', parabola: 'Парабола', gaussian: 'Гауссов профиль',
      sine: 'Синус', 'smooth-step': 'Плавная ступень', drawing: 'Рисунок',
    }),
    amplitude: 'Амплитуда',
    amplitudeHelp: 'Вертикальный масштаб поля u.',
    width: 'Ширина',
    widthHelp: 'Характерная длина, на которой меняется поле.',
    position: 'Положение',
    positionHelp: 'Координата центра профиля.',
    canvas: 'Три синхронизированных графика поля и его производных',
  }),
  en: Object.freeze({
    preset: 'Profile shape',
    presetHelp: 'The function u(x) whose first and second derivatives are shown.',
    presets: Object.freeze({
      line: 'Line', parabola: 'Parabola', gaussian: 'Gaussian',
      sine: 'Sine', 'smooth-step': 'Smooth step', drawing: 'Drawing',
    }),
    amplitude: 'Amplitude',
    amplitudeHelp: 'The vertical scale of the field u.',
    width: 'Width',
    widthHelp: 'The characteristic length over which the field changes.',
    position: 'Position',
    positionHelp: 'The coordinate of the profile center.',
    canvas: 'Three synchronized plots of a field and its derivatives',
  }),
});

function control(labelText, input, explanation) {
  const label = document.createElement('label');
  label.className = 'pde-control';
  const row = document.createElement('span');
  row.className = 'pde-control-row';
  const name = document.createElement('span');
  name.textContent = labelText;
  row.append(name, input);
  const help = document.createElement('small');
  help.textContent = explanation;
  label.append(row, help);
  return label;
}

function range(minimum, maximum, step) {
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(minimum);
  input.max = String(maximum);
  input.step = String(step);
  return input;
}

function outputRange(input, digits = 2) {
  const output = document.createElement('input');
  output.type = 'number';
  output.className = 'pde-number-input';
  output.min = input.min;
  output.max = input.max;
  output.step = input.step;
  output.inputMode = 'decimal';
  const sync = () => { output.value = Number(input.value).toFixed(digits); };
  sync();
  input.addEventListener('input', sync);
  const wrapper = document.createElement('span');
  wrapper.className = 'range-with-output';
  wrapper.append(input, output);
  return { wrapper, output, sync };
}

export function mountDerivativeDemo(shell, language) {
  const copy = COPY[language] ?? COPY.ru;
  const model = new DerivativeMicroscopeModel();
  const view = bindDerivativeMicroscopeView(model);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 760;
  canvas.setAttribute('aria-label', copy.canvas);
  shell.stage.append(canvas);
  const app = mount(canvas, {
    scene: view.scene,
    camera: view.camera,
    fixedStep: null,
    adaptiveQuality: false,
  });

  const preset = document.createElement('select');
  for (const id of Object.keys(copy.presets)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = copy.presets[id];
    preset.append(option);
  }
  preset.value = model.parameters.preset;
  const amplitude = range(0.1, 2, 0.05);
  const width = range(0.08, 1, 0.01);
  const position = range(-1, 1, 0.01);
  const amplitudeOutput = outputRange(amplitude);
  const widthOutput = outputRange(width);
  const positionOutput = outputRange(position);
  amplitude.value = String(model.parameters.amplitude);
  width.value = String(model.parameters.width);
  position.value = String(model.parameters.position);
  amplitudeOutput.sync();
  widthOutput.sync();
  positionOutput.sync();
  amplitudeOutput.output.setAttribute('aria-label', copy.amplitude);
  widthOutput.output.setAttribute('aria-label', copy.width);
  positionOutput.output.setAttribute('aria-label', copy.position);

  const toolbar = createPdeToolbar(shell, language, { animated: false, drawable: true });
  const readout = toolbar.readout;
  shell.controls.append(
    control(copy.preset, preset, copy.presetHelp),
    control(copy.amplitude, amplitudeOutput.wrapper, copy.amplitudeHelp),
    control(copy.width, widthOutput.wrapper, copy.widthHelp),
    control(copy.position, positionOutput.wrapper, copy.positionHelp),
  );

  function syncDrawingState() {
    const drawing = preset.value === 'drawing';
    toolbar.draw.setAttribute('aria-pressed', String(drawing));
    amplitude.disabled = drawing;
    width.disabled = drawing;
    position.disabled = drawing;
    canvas.classList.toggle('is-drawing', drawing);
  }

  function updateProbe(x) {
    const values = view.setProbe(x);
    readout.textContent = [
      `x ${values.x.toFixed(3)}`,
      `u ${values.value.toFixed(3)}`,
      `uₓ ${values.first.toFixed(3)}`,
      `uₓₓ ${values.second.toFixed(3)}`,
      `uₜ/D ${values.second.toFixed(3)}`,
    ].join('  ·  ');
    app.render();
  }

  function updateModel() {
    model.setParameters({
      preset: preset.value,
      amplitude: Number(amplitude.value),
      width: Number(width.value),
      position: Number(position.value),
    });
    view.update();
    syncDrawingState();
    updateProbe(model.parameters.position);
  }

  preset.addEventListener('change', () => {
    updateModel();
    markChalkTransition(canvas, 'rewrite');
  });
  for (const input of [amplitude, width, position]) input.addEventListener('input', updateModel);
  for (const [input, linked] of [
    [amplitudeOutput.output, amplitude],
    [widthOutput.output, width],
    [positionOutput.output, position],
  ]) {
    input.addEventListener('change', () => {
      const value = Math.max(Number(linked.min), Math.min(Number(linked.max), Number(input.value)));
      if (!Number.isFinite(value)) {
        input.value = Number(linked.value).toFixed(2);
        return;
      }
      linked.value = String(value);
      updateModel();
      input.value = Number(linked.value).toFixed(2);
    });
  }
  toolbar.draw.addEventListener('click', () => {
    const active = toolbar.draw.getAttribute('aria-pressed') !== 'true';
    preset.value = active ? 'drawing' : 'gaussian';
    updateModel();
  });
  toolbar.restart.addEventListener('click', () => {
    model.reset();
    preset.value = model.parameters.preset;
    amplitude.value = String(model.parameters.amplitude);
    width.value = String(model.parameters.width);
    position.value = String(model.parameters.position);
    amplitudeOutput.sync();
    widthOutput.sync();
    positionOutput.sync();
    view.update();
    syncDrawingState();
    updateProbe(model.parameters.position);
    markChalkTransition(canvas, 'rewrite');
  });

  let drawing = false;
  let previous = null;

  function pointerPosition(event) {
    const rectangle = canvas.getBoundingClientRect();
    const world = screenToWorld(
      view.camera,
      event.clientX - rectangle.left,
      event.clientY - rectangle.top,
      rectangle.width,
      rectangle.height,
    );
    return {
      worldX: world[0],
      worldY: world[1],
      x: view.worldToProfileX(world[0]),
      value: view.topPanelValue(world[1]),
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const point = pointerPosition(event);
    if (toolbar.draw.getAttribute('aria-pressed') !== 'true'
        || !view.isInsideTopPanel(point.worldX, point.worldY)) return;
    drawing = true;
    previous = point;
    canvas.setPointerCapture(event.pointerId);
    model.drawSegment(point.x, point.value, point.x, point.value);
    view.update();
    updateProbe(point.x);
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = pointerPosition(event);
    if (drawing && previous) {
      model.drawSegment(previous.x, previous.value, point.x, point.value);
      previous = point;
      view.update();
    }
    updateProbe(point.x);
  });
  const finishDrawing = (event) => {
    if (!drawing) return;
    drawing = false;
    previous = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', finishDrawing);
  canvas.addEventListener('pointercancel', finishDrawing);

  const observer = new ResizeObserver(() => app.resize().render());
  observer.observe(canvas);
  syncDrawingState();
  view.update();
  app.resize();
  updateProbe(model.parameters.position);

  return Object.freeze({
    dispose() {
      toolbar.dispose();
      observer.disconnect();
      app.destroy();
      view.dispose();
    },
  });
}
