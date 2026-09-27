// Live experiments for the shared gallery: each lesson model keeps its own Chalkish scene
// (fields, vectors, particles) and the gallery supplies the page around it.
// createLab(id, params, lang) returns a live model; see demos/README.md.

import { mount, screenToWorld } from '../../../lib/chalkish/src/index.js';
import { DerivativeMicroscopeModel } from './derivative-model.js';
import { bindDerivativeMicroscopeView } from './derivative-view.js';
import { lessonMathState } from './lesson-math-state.js';
import { createLessonModel } from './lesson-models.js';
import { lessonPresentation } from './lesson-presentation.js';
import { LESSON_SPECS } from './lesson-specs.js';
import { bindLessonView } from './lesson-views.js';

const FRAME = 1 / 60;
// Model time per real second at 1× speed (the pace of the former page).
const TIME_SCALE = { riemann: 0.12 };
// Where the shown interval ends; the gallery then offers a reset.
const END_TIME = { riemann: 0.5, characteristics: 2, nonlinearity: 2 };

// "t 0.20 · min 0.000 · ⟨u⟩ 0.160" → [['t', '0.20'], ['min', '0.000'], ['⟨u⟩', '0.160']]
export function readoutStats(text) {
  return String(text ?? '').split(' · ').filter(Boolean).map((item) => {
    const match = item.trim().match(/^(.*?)(?:\s*=\s*|\s+)(\S+)$/);
    return match ? [match[1], match[2]] : [item.trim(), ''];
  });
}

function mountCanvas(stage, label, view, fitBounds) {
  const canvas = document.createElement('canvas');
  canvas.className = 'live-canvas';
  canvas.width = 1200;
  canvas.height = 760;
  canvas.setAttribute('aria-label', label);
  stage.append(canvas);
  const app = mount(canvas, {
    scene: view.scene, camera: view.camera, fitBounds, onResize: view.resize, fixedStep: null, adaptiveQuality: false,
  });
  // Chalkish pins the canvas size inline; the CSS size (100% of the stage) must win on resize.
  const observer = new ResizeObserver(() => {
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    app.resize().render();
  });
  observer.observe(stage);
  document.fonts?.ready.then(() => app.render());
  const worldPoint = (event) => {
    const r = canvas.getBoundingClientRect();
    const [x, y] = screenToWorld(view.camera, event.clientX - r.left, event.clientY - r.top, r.width, r.height);
    return { x, y };
  };
  return {
    canvas, app, worldPoint,
    dispose() { observer.disconnect(); app.destroy(); canvas.remove(); },
  };
}

function lessonLab(id, params, lang) {
  const L = (ru, en) => (lang === 'en' ? en : ru);
  const spec = LESSON_SPECS[id];
  const model = createLessonModel(id);
  const canonical = { ...model.parameters };
  const keys = spec.controls.map((c) => c.name).filter((name) => name !== 'time');
  model.reset(params.preset ?? spec.presets[0].value);
  // Values the user changed from the canonical defaults survive a reset; the preset sets the rest.
  for (const key of keys) {
    if (params[key] !== undefined && params[key] !== canonical[key] && params[key] !== model.parameters[key]) {
      model.setParameter(key, params[key]);
    }
  }
  for (const key of keys) if (key in model.parameters) params[key] = model.parameters[key];
  if (spec.controls.some((c) => c.name === 'time')) params.time = model.time;

  const entry = { id, equation: '' };
  let view = null, surface = null, ctx = null, toolActive = false, pointerStart = null, probeText = '';
  const drawable = Boolean(spec.paint || spec.inject);

  const lab = {
    count: 0,
    get time() { return model.time; },
    stop: '',
    hint: drawable
      ? L('Параметры меняются на ходу. Кнопка ✎ включает рисование на доске.', 'Parameters change live. The ✎ button lets you draw on the board.')
      : L('Параметры меняются на ходу. Пробел — пуск, N — шаг.', 'Parameters change live. Space: play; N: step.'),
    tool: drawable ? { label: spec.inject ? ['Импульс', 'Impulse'] : ['Рисовать', 'Draw'] } : null,
    get toolActive() { return toolActive; },

    mount(stage, context) {
      ctx = context;
      view = bindLessonView(model);
      surface = mountCanvas(stage, L('Интерактивное решение уравнения', 'Interactive equation solution'), view, view.bounds);
      const { canvas, worldPoint } = surface;
      let pointerActive = false;
      const apply = (event) => {
        const world = worldPoint(event);
        if (spec.inject && typeof model.inject === 'function') {
          pointerStart ??= world;
          model.inject(pointerStart.x, pointerStart.y, 1.8 * (world.x - pointerStart.x), 1.8 * (world.y - pointerStart.y));
          pointerStart = world;
        } else if (model.panels && typeof model.drawAt === 'function') {
          const point = view.profilePoint(world.x, world.y);
          if (point.inside) model.drawAt(point.x, point.value);
        } else if (typeof model.paintAt === 'function') {
          const point = view.fieldPoint(world.x, world.y);
          if (point.inside) model.paintAt(point.x, point.y, Number(model.parameters.amplitude ?? model.parameters.brushValue ?? 1));
        }
        ctx.redraw();
      };
      canvas.addEventListener('pointerdown', (event) => {
        if (!toolActive) return;
        pointerActive = true;
        pointerStart = worldPoint(event);
        canvas.setPointerCapture(event.pointerId);
        apply(event);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (pointerActive) { apply(event); return; }
        const world = worldPoint(event);
        if (id === 'characteristics') {
          const point = view.profilePoint(world.x, world.y);
          if (!point.inside) return;
          const probe = model.probe(point.x);
          probeText = `x = ${probe.x.toFixed(2)} ← x₀ = ${probe.origin.toFixed(2)} · u = ${probe.value.toFixed(3)}`;
          ctx.redraw();
        } else if (id === 'vector-calculus') {
          const point = view.fieldPoint(world.x, world.y);
          if (!point.inside) return;
          const probe = model.probeAt(point.x, point.y);
          probeText = `x ${probe.x.toFixed(2)} · y ${probe.y.toFixed(2)} · ${model.parameters.display === 'curl' ? '∂v/∂x − ∂u/∂y' : '∇·v'} = ${probe.value.toFixed(3)}`;
          ctx.redraw();
        }
      });
      const release = (event) => {
        pointerActive = false;
        pointerStart = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
    },

    advance(seconds) {
      if (this.stop) return;
      const scale = TIME_SCALE[id] ?? 0.4;
      for (let left = seconds; left > 1e-9; left -= FRAME) model.step(Math.min(left, FRAME) * scale);
      if (params.time !== undefined) params.time = model.time;
      if (END_TIME[id] !== undefined && model.time >= END_TIME[id]) this.stop = '■';
    },

    step() {
      this.advance(4 * FRAME);
      this.count += 1;
    },

    setParameter(key, value) {
      if (key === 'time') {
        model.time = value;
        ctx?.pause();
      }
      model.setParameter(key, value);
      if (key === 'time' || key === 'preset') this.stop = '';
      view?.resetRanges?.();
      return true;
    },

    setTool(active) {
      toolActive = active;
      surface?.canvas.classList.toggle('is-drawing', active && !spec.inject);
    },

    render() {
      if (view) {
        view.update();
        surface.app.render();
      }
      const presentation = lessonPresentation(model, { ...entry, equation: undefined, id }, lang);
      return {
        stats: readoutStats(model.observable),
        equation: presentation.equation,
        caption: presentation.detail,
        note: probeText || lessonMathState(model, { id }, lang),
      };
    },

    dispose() {
      surface?.dispose();
      view?.dispose();
    },
  };
  return lab;
}

function derivativeLab(params, lang) {
  const L = (ru, en) => (lang === 'en' ? en : ru);
  const model = new DerivativeMicroscopeModel();
  model.setParameters({ preset: params.preset, amplitude: params.amplitude, width: params.width, position: params.position });
  let view = null, surface = null, ctx = null, probe = model.parameters.position;
  return {
    hint: L('Наведите на график: слева направо показаны u, uₓ и uₓₓ в одной точке. ✎ — нарисовать свою функцию.', 'Hover over the plots to read u, uₓ and uₓₓ at one point. ✎ draws your own function.'),
    tool: { label: ['Рисовать', 'Draw'] },
    get toolActive() { return model.parameters.preset === 'drawing'; },

    mount(stage, context) {
      ctx = context;
      view = bindDerivativeMicroscopeView(model);
      surface = mountCanvas(stage, L('Три синхронизированных графика поля и его производных', 'Three synchronized plots of a field and its derivatives'), view, { minX: -6.3, maxX: 5.3, minY: -3.9, maxY: 3.9 });
      const { canvas, worldPoint } = surface;
      let drawing = false, previous = null;
      const point = (event) => {
        const world = worldPoint(event);
        return { worldX: world.x, worldY: world.y, x: view.worldToProfileX(world.x), value: view.topPanelValue(world.y) };
      };
      canvas.addEventListener('pointerdown', (event) => {
        const p = point(event);
        if (model.parameters.preset !== 'drawing' || !view.isInsideTopPanel(p.worldX, p.worldY)) return;
        drawing = true;
        previous = p;
        canvas.setPointerCapture(event.pointerId);
        model.drawSegment(p.x, p.value, p.x, p.value);
        probe = p.x;
        ctx.redraw();
      });
      canvas.addEventListener('pointermove', (event) => {
        const p = point(event);
        if (drawing && previous) {
          model.drawSegment(previous.x, previous.value, p.x, p.value);
          previous = p;
        }
        probe = p.x;
        ctx.redraw();
      });
      const finish = (event) => {
        drawing = false;
        previous = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      canvas.addEventListener('pointerup', finish);
      canvas.addEventListener('pointercancel', finish);
    },

    setParameter(key, value) {
      model.setParameters({ [key]: value });
      if (key === 'position') probe = value;
      return true;
    },

    setTool(active) {
      model.setParameters({ preset: active ? 'drawing' : 'gaussian' });
      params.preset = model.parameters.preset;
      surface?.canvas.classList.toggle('is-drawing', active);
    },

    render() {
      let values = null;
      if (view) {
        view.update();
        values = view.setProbe(probe);
        surface.app.render();
      }
      values ??= model.probe(probe);
      return {
        stats: [['x', values.x.toFixed(3)], ['u', values.value.toFixed(3)], ['uₓ', values.first.toFixed(3)], ['uₓₓ', values.second.toFixed(3)]],
      };
    },

    dispose() {
      surface?.dispose();
      view?.dispose();
    },
  };
}

export function createLab(id, params, lang = 'ru') {
  if (id === 'derivatives') return derivativeLab(params, lang);
  if (!LESSON_SPECS[id]) throw new Error(`Unknown experiment: ${id}`);
  return lessonLab(id, params, lang);
}

export default { createLab };
