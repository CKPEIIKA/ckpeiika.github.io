import { mount, screenToWorld } from '../../lib/chalkish/src/index.js';
import { createLessonModel } from './lesson-models.js';
import { lessonSpec, localizedSpec } from './lesson-specs.js';
import { createPdeToolbar } from './pde-toolbar.js';
import { bindLessonView } from './lesson-views.js';
import { lessonPresentation, controlVisible } from './lesson-presentation.js';
import { lessonMathState } from './lesson-math-state.js';

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

export function mountLessonDemo(shell, entry, language, saved = null) {
  const copy = COPY[language] ?? COPY.ru;
  const spec = lessonSpec(entry.id);
  const model = saved?.model ?? createLessonModel(entry.id);
  if (!saved) model.reset(spec.presets[0].value);
  const view = bindLessonView(model);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 760;
  canvas.setAttribute('aria-label', `${copy.canvas}: ${localizedSpec(entry.title, language)}`);
  shell.stage.append(canvas);

  let paused = saved?.paused ?? true;
  let disposed = false;
  let readoutFrames = 0;
  const toolbar = createPdeToolbar(shell, language, {
    animated: entry.id !== 'laplace',
    drawable: spec.paint || spec.inject,
    inject: spec.inject,
  });
  const readout = toolbar.readout;
  const app = mount(canvas, {
    scene: view.scene,
    camera: view.camera,
    fitBounds: view.bounds,
    onResize: view.resize,
    fixedStep: 1 / 60,
    adaptiveQuality: false,
    update: ({ dt }) => {
      if (!paused) {
        model.step(entry.id === 'riemann' ? dt * 0.12 : dt * 0.4);
        view.update();
        if (entry.id === 'riemann' && model.time >= 0.5) { paused = true; toolbar.setPaused(true); }
        if (['characteristics', 'nonlinearity'].includes(entry.id) && model.time >= 2) { paused = true; toolbar.setPaused(true); }
      }
      readoutFrames += 1;
      if (readoutFrames % 6 === 0) {
        readout.textContent = model.observable ?? '';
        mathState.textContent = lessonMathState(model, entry, language);
        const timeControl = controlRecords.get('time');
        if (timeControl && !paused) { timeControl.input.value = model.time; timeControl.output.value = model.time.toFixed(3); }
      }
    },
  });

  const heading = document.createElement('h3');
  heading.textContent = copy.parameters;

  const preset = selectInput(spec.presets, language);
  preset.value = model.preset;
  const controlRecords = new Map();
  shell.controls.append(heading, makeControl(copy.preset, preset, copy.presetHelp));
  const context = document.createElement('p');
  context.className = 'pde-context';
  shell.concept.append(context);
  const mathState = document.createElement('p');
  mathState.className = 'pde-math-state';
  mathState.setAttribute('aria-live', 'polite');
  shell.concept.append(mathState);
  const units = document.createElement('p');
  units.className = 'pde-units';
  units.textContent = language === 'ru' ? 'Величины безразмерные. «Режим» восстанавливает исходную задачу.' : 'All quantities are nondimensional. Presets restore the original problem.';
  shell.controls.append(units);

  for (const definition of spec.controls) {
    let record;
    if (definition.type === 'range') record = rangeInput(definition);
    else if (definition.type === 'checkbox') record = checkboxInput();
    else {
      const input = selectInput(definition.options, language);
      record = { input, element: input, output: null };
    }
    record.label = makeControl(
      localizedSpec(definition.label, language),
      record.element,
      localizedSpec(definition.help, language),
    );
    controlRecords.set(definition.name, { ...record, definition });
    record.input.setAttribute('aria-label', localizedSpec(definition.label, language));
    shell.controls.append(record.label);
  }

  const drawToggle = toolbar.draw;

  function syncControls() {
    preset.value = model.preset;
    for (const [name, record] of controlRecords) {
      const value = name === 'time' ? model.time : model.parameters[name];
      record.label.hidden = !controlVisible(entry.id, name, model.parameters);
      if (record.definition.type === 'checkbox') {
        record.input.checked = value !== false;
      } else {
        record.input.value = String(value ?? record.definition.options?.[0]?.value ?? 0);
      }
      if (record.output) record.output.value = formatRange(record.input.value, record.definition.step);
    }
    readout.textContent = model.observable ?? '';
    const presentation = lessonPresentation(model, entry, language);
    shell.equation.textContent = presentation.equation;
    context.textContent = presentation.detail;
    mathState.textContent = lessonMathState(model, entry, language);
  }

  function redraw(phase = null) {
    view.update();
    app.render();
    readout.textContent = model.observable ?? '';
    if (phase) { syncControls(); view.resetRanges?.(); view.update(); app.render(); }
  }

  const defaults = document.createElement('button');
  defaults.type = 'button';
  defaults.className = 'pde-defaults';
  defaults.textContent = language === 'ru' ? 'Исходная задача' : 'Reset defaults';
  defaults.addEventListener('click', () => {
    const canonical = createLessonModel(entry.id);
    Object.assign(model.parameters, canonical.parameters);
    model.reset(spec.presets[0].value);
    paused = true; toolbar.setPaused(true); syncControls(); redraw('rewrite');
  });
  shell.controls.append(defaults);

  toolbar.pause?.addEventListener('click', () => {
    paused = !paused;
    toolbar.setPaused(paused);
  });
  toolbar.restart.addEventListener('click', () => {
    if (model.restart) model.restart();
    else model.reset(preset.value);
    paused = true;
    toolbar.setPaused(true);
    syncControls();
    redraw('rewrite');
  });
  toolbar.speed?.addEventListener('change', () => app.setPlaybackRate(Number(toolbar.speed.value)));
  preset.addEventListener('change', () => {
    Object.assign(model.parameters, createLessonModel(entry.id).parameters);
    model.reset(preset.value);
    paused = true;
    toolbar.setPaused(true);
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
      if (name === 'time') { model.time = value; model.setParameter('time', value); paused = true; toolbar.setPaused(true); }
      else model.setParameter(name, value);
      syncControls();
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
        if (!Number.isFinite(value) || record.output.value.trim() === '') {
          record.output.value = formatRange(record.input.value, record.definition.step);
          return;
        }
        record.input.value = String(value);
        record.output.value = formatRange(value, record.definition.step);
        if (name === 'time') model.time = value;
        model.setParameter(name, value);
        syncControls();
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
    if (active) { paused = true; toolbar.setPaused(true); }
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
      if (point.inside) model.paintAt(point.x, point.y, paintValue);
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
    else if (entry.id === 'characteristics') {
      const world = worldPoint(event), point = view.profilePoint(world.x, world.y);
      if (point.inside) {
        const probe = model.probe(point.x);
        view.update(); app.render();
        readout.textContent = `x = ${probe.x.toFixed(2)} ← x₀ = ${probe.origin.toFixed(2)} · u = ${probe.value.toFixed(3)}`;
      }
    }
    else if (entry.id === 'vector-calculus') {
      const world = worldPoint(event), point = view.fieldPoint(world.x, world.y);
      if (point.inside) {
        const probe = model.probeAt(point.x, point.y);
        readout.textContent = `x ${probe.x.toFixed(2)} · y ${probe.y.toFixed(2)} · ${model.parameters.display === 'curl' ? '∂v/∂x − ∂u/∂y' : '∇·v'} = ${probe.value.toFixed(3)}`;
      }
    }
  });
  const releasePointer = (event) => {
    pointerActive = false;
    pointerStart = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  syncControls();
  toolbar.setPaused(paused);
  app.resize();
  redraw();
  document.fonts.ready.then(() => { if (!disposed) app.render(); });
  if (entry.id !== 'laplace') app.start();

  return Object.freeze({
    snapshot() { return { model, paused }; },
    dispose() {
      disposed = true;
      shell.dispose();
      toolbar.dispose();
      app.destroy();
      view.dispose();
    },
  });
}
