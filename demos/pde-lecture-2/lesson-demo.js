import { mount, screenToWorld } from '../../lib/chalkish/src/index.js';
import { markChalkTransition } from '../../lib/chalkish/examples/chalk-transition.js';
import { createLessonModel } from './lesson-models.js';
import { lessonSpec, localizedSpec } from './lesson-specs.js';
import { createPdeToolbar } from './pde-toolbar.js';
import { bindLessonView } from './lesson-views.js';

const COPY = Object.freeze({
  ru: Object.freeze({
    parameters: 'Параметры задачи', preset: 'Режим', presetHelp: 'Воспроизводимое начальное и граничное состояние.',
    canvas: 'Интерактивное решение уравнения',
  }),
  en: Object.freeze({
    parameters: 'Problem parameters', preset: 'Preset', presetHelp: 'A reproducible initial and boundary state.',
    canvas: 'Interactive equation solution',
  }),
});

function makeControl(labelText, input, explanation) {
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

function selectInput(options, language) {
  const input = document.createElement('select');
  for (const item of options) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = localizedSpec(item.label, language);
    input.append(option);
  }
  return input;
}

function rangeInput(control) {
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(control.minimum);
  input.max = String(control.maximum);
  input.step = String(control.step);
  const output = document.createElement('input');
  output.type = 'number';
  output.className = 'pde-number-input';
  output.min = String(control.minimum);
  output.max = String(control.maximum);
  output.step = String(control.step);
  output.inputMode = 'decimal';
  output.setAttribute('aria-label', localizedSpec(control.label, 'ru'));
  const wrapper = document.createElement('span');
  wrapper.className = 'range-with-output';
  wrapper.append(input, output);
  return { input, element: wrapper, output };
}

function checkboxInput() {
  const input = document.createElement('input');
  input.type = 'checkbox';
  return { input, element: input, output: null };
}

function formatRange(value, step) {
  const decimals = Math.max(0, Math.min(4, String(step).split('.')[1]?.length ?? 0));
  return Number(value).toFixed(decimals);
}

export function mountLessonDemo(shell, entry, language) {
  const copy = COPY[language] ?? COPY.ru;
  const spec = lessonSpec(entry.id);
  const model = createLessonModel(entry.id);
  model.reset(spec.presets[0].value);
  const view = bindLessonView(model);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 760;
  canvas.setAttribute('aria-label', `${copy.canvas}: ${localizedSpec(entry.title, language)}`);
  shell.stage.append(canvas);

  let paused = false;
  let readoutFrames = 0;
  const toolbar = createPdeToolbar(shell, language, {
    animated: true,
    drawable: spec.paint || spec.inject,
    inject: spec.inject,
  });
  const readout = toolbar.readout;
  const app = mount(canvas, {
    scene: view.scene,
    camera: view.camera,
    fixedStep: 1 / 60,
    adaptiveQuality: false,
    update: ({ dt }) => {
      if (!paused) model.step(dt);
      view.update();
      readoutFrames += 1;
      if (readoutFrames % 6 === 0) readout.textContent = model.observable ?? '';
    },
  });

  const heading = document.createElement('h3');
  heading.textContent = copy.parameters;

  const preset = selectInput(spec.presets, language);
  preset.value = model.preset;
  const controlRecords = new Map();
  shell.controls.append(heading, makeControl(copy.preset, preset, copy.presetHelp));

  for (const definition of spec.controls) {
    let record;
    if (definition.type === 'range') record = rangeInput(definition);
    else if (definition.type === 'checkbox') record = checkboxInput();
    else {
      const input = selectInput(definition.options, language);
      record = { input, element: input, output: null };
    }
    controlRecords.set(definition.name, { ...record, definition });
    shell.controls.append(makeControl(
      localizedSpec(definition.label, language),
      record.element,
      localizedSpec(definition.help, language),
    ));
  }

  const drawToggle = toolbar.draw;

  function syncControls() {
    preset.value = model.preset;
    for (const [name, record] of controlRecords) {
      const value = model.parameters[name];
      if (record.definition.type === 'checkbox') {
        record.input.checked = value !== false;
      } else {
        record.input.value = String(value ?? record.definition.options?.[0]?.value ?? 0);
      }
      if (record.output) record.output.value = formatRange(record.input.value, record.definition.step);
    }
    readout.textContent = model.observable ?? '';
  }

  function redraw(phase = null) {
    view.update();
    app.render();
    readout.textContent = model.observable ?? '';
    if (phase) markChalkTransition(canvas, phase);
  }

  toolbar.pause.addEventListener('click', () => {
    paused = !paused;
    toolbar.setPaused(paused);
  });
  toolbar.restart.addEventListener('click', () => {
    model.reset(preset.value);
    syncControls();
    redraw('rewrite');
  });
  toolbar.speed.addEventListener('change', () => app.setPlaybackRate(Number(toolbar.speed.value)));
  preset.addEventListener('change', () => {
    model.reset(preset.value);
    syncControls();
    redraw('rewrite');
  });

  for (const [name, record] of controlRecords) {
    const eventName = record.definition.type === 'range' ? 'input' : 'change';
    record.input.addEventListener(eventName, () => {
      const value = record.definition.type === 'range'
        ? Number(record.input.value)
        : record.definition.type === 'checkbox'
          ? record.input.checked
          : record.input.value;
      model.setParameter(name, value);
      if (record.output) record.output.value = formatRange(value, record.definition.step);
      redraw(eventName === 'change' ? 'rewrite' : null);
    });
    if (record.output) {
      record.output.setAttribute('aria-label', localizedSpec(record.definition.label, language));
      record.output.addEventListener('change', () => {
        const value = Math.max(
          Number(record.definition.minimum),
          Math.min(Number(record.definition.maximum), Number(record.output.value)),
        );
        if (!Number.isFinite(value)) {
          record.output.value = formatRange(record.input.value, record.definition.step);
          return;
        }
        record.input.value = String(value);
        record.output.value = formatRange(value, record.definition.step);
        model.setParameter(name, value);
        redraw('rewrite');
      });
    }
  }

  let pointerActive = false;
  let pointerStart = null;

  drawToggle?.addEventListener('click', () => {
    const active = drawToggle.getAttribute('aria-pressed') !== 'true';
    drawToggle.setAttribute('aria-pressed', String(active));
    canvas.classList.toggle('is-drawing', active && !spec.inject);
  });

  function worldPoint(event) {
    const rectangle = canvas.getBoundingClientRect();
    const point = screenToWorld(
      view.camera,
      event.clientX - rectangle.left,
      event.clientY - rectangle.top,
      rectangle.width,
      rectangle.height,
    );
    return { x: point[0], y: point[1] };
  }

  function applyPointer(event) {
    if (drawToggle?.getAttribute('aria-pressed') !== 'true') return;
    const world = worldPoint(event);
    if (spec.inject && typeof model.inject === 'function') {
      if (!pointerStart) pointerStart = world;
      model.inject(pointerStart.x, pointerStart.y, 1.8 * (world.x - pointerStart.x), 1.8 * (world.y - pointerStart.y));
      pointerStart = world;
    } else if (model.panels && typeof model.drawAt === 'function') {
      const point = view.profilePoint(world.x, world.y);
      if (point.inside) model.drawAt(point.x, point.value);
    } else if (typeof model.paintAt === 'function') {
      const point = view.fieldPoint(world.x, world.y);
      const paintValue = Number(model.parameters.amplitude ?? model.parameters.brushValue ?? 1);
      model.paintAt(point.x, point.y, paintValue);
    }
    redraw();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (drawToggle?.getAttribute('aria-pressed') !== 'true') return;
    pointerActive = true;
    pointerStart = worldPoint(event);
    canvas.setPointerCapture(event.pointerId);
    applyPointer(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointerActive) applyPointer(event);
  });
  const releasePointer = (event) => {
    pointerActive = false;
    pointerStart = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  syncControls();
  app.resize();
  redraw();
  app.start();

  return Object.freeze({
    dispose() {
      toolbar.dispose();
      app.destroy();
      view.dispose();
    },
  });
}
