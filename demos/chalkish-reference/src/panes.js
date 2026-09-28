// The reference panes: each one builds a Chalkish scene from library primitives only, so
// its code can be copied into a new demo. A pane is plain data plus a few functions:
//
//   scene, camera             what to draw (the board is 16 × 9 world units, y up)
//   update(dt)                optional: advance played animations or streaming data
//   setParameter(key, value)  optional: apply a control change in place; true when done
//   stats()                   [[label, value], …] under the board
//   pick(x, y, tolerance)     optional: the object to drag at a world point
//   drag(object, x, y)        optional: move it
//
// labs.js turns a pane into the gallery's live-model contract (mount, advance, render).

import {
  Arrow, CHALK_NUMBER_FONT_STACK, Camera2D, Circle, COLORMAPS, CurveLayer, DOWN, FadeIn, Group, HistoryBuffer,
  Indicate, Line, MathLabel, MatrixGrid, Panel, PlotAxes, RIGHT, Rectangle, ScalarField,
  Scene, Sequence, TextLabel, Transform, UP, Unwrite, VectorField, Write, arrange,
  chalkStyle, contourSegments, getBounds, hitTest, joinSegments, nextTo, niceTicks,
  texToText, TrailLayer, traceStreamlines,
} from '../../../lib/chalkish/src/index.js';

export const BOARD = Object.freeze({ minX: 0, maxX: 16, minY: 0, maxY: 9 });
const FONT = '"Neucha", "Shantell Sans", "Open Sans", sans-serif';
const NUMBER_FONT = CHALK_NUMBER_FONT_STACK;
const C = Object.freeze({
  white: '#f4f1e7', muted: '#a6b8ad', dim: '#506358', grid: '#2a3a31',
  yellow: '#f0d477', blue: '#8ac8db', red: '#ef9685', green: '#b6d3a0', bg: '#0d1712',
});

// Chalk strokes and text in the site's palette.
const stroke = (color, width = 2, extra = {}) => chalkStyle('dusty', { stroke: color, fill: null, width, passes: 2, roughness: 0.2, ...extra });
const text = (value, x, y, { size = 0.34, color = C.white, align = 'left', baseline = 'middle', ...options } = {}) => new TextLabel(value, {
  x, y, size, minPixelSize: 10, font: `16px ${FONT}`, align, baseline, style: { fill: color, passes: 1 }, ...options,
});
const formula = (tex, x, y, { size = 0.42, color = C.white, align = 'left', baseline = 'middle' } = {}) => new MathLabel(tex, {
  x, y, size, minPixelSize: 10, family: FONT, align, baseline, style: { fill: color, passes: 1 },
});
const fmt = (value, digits = 3) => (Number.isFinite(value) ? String(Number(value.toPrecision(digits))) : String(value));

function board(lang) {
  const scene = new Scene({ background: C.bg });
  const camera = new Camera2D({ centerX: 8, centerY: 4.5, height: 9 });
  const L = (ru, en) => (lang === 'en' ? en : ru);
  return { scene, camera, L };
}

// A curve y = f(x) sampled over [a, b], as data for a PlotFrame.
function sample(f, a, b, n = 240) {
  const xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
  for (let i = 0; i <= n; i += 1) {
    xs[i] = a + (b - a) * i / n;
    ys[i] = f(xs[i]);
  }
  return { xs, ys };
}

// Polylines (packed [x0, y0, …]) as chalk curve layers.
function curveLayers(lines, style) {
  return lines.filter((line) => line.length >= 4).map((line) => {
    const count = line.length / 2, x = new Float32Array(count), y = new Float32Array(count);
    for (let i = 0; i < count; i += 1) { x[i] = line[i * 2]; y[i] = line[i * 2 + 1]; }
    return new CurveLayer({ x, y, count, style });
  });
}

// ---------- text and formulas ----------

const FORMULAS = {
  scheme: String.raw`u_i^{n+1} = u_i^n - \frac{a\,\Delta t}{h}\left(u_i^n - u_{i-1}^n\right)`,
  weno: String.raw`\omega_k = \frac{\alpha_k}{\sum_m \alpha_m},\qquad \alpha_k = \frac{d_k}{(\varepsilon + \beta_k)^2}`,
  matrix: String.raw`G = \begin{bmatrix} 1 - \nu & \nu \\ 0 & 1 \end{bmatrix},\qquad \|G^n\|_2 \le \rho(G)^n`,
  integral: String.raw`\bar u_i = \frac{1}{h}\int_{x_{i-½}}^{x_{i+½}} u(x)\,dx`,
  cases: String.raw`\varphi(r) = \begin{cases} 0 & r \le 0 \\ \min(2r, 1) & r > 0 \end{cases}`,
  roots: String.raw`v_g = \frac{\cos(kh)}{\sqrt{1 - \mathrm{Co}^2\sin^2(kh)}}`,
};

export function formulasPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const title = text(L('Формула мелом: MathLabel и TeX', 'Chalk formula: MathLabel and TeX'), 0.8, 8.3, { size: 0.42 });
  const shown = formula(FORMULAS[params.formula], 8, 5.6, { size: params.size, align: 'center' });
  const plain = text('', 8, 3.35, { size: 0.3, color: C.muted, align: 'center' });
  const note = text(L(
    'Размер — в единицах доски, как у линий: при масштабе камеры формула растёт вместе с рисунком. Дроби, индексы, корни, матрицы и скобки раскладываются самим Chalkish, без MathJax.',
    'The size is in board units, like strokes: zooming the camera scales the formula with the drawing. Fractions, scripts, roots, matrices and brackets are laid out by Chalkish itself, without MathJax.',
  ), 0.8, 2, { size: 0.3, color: C.muted, maxWidth: 14.4, wrap: true, baseline: 'top' });
  const box = new Rectangle(1, 1, { style: stroke(C.dim, 1, { dash: [5, 5], passes: 1 }) });
  scene.add(title, box, shown, plain, note);
  const refresh = () => {
    shown.setTex(FORMULAS[params.formula]);
    shown.size = params.size;
    plain.setText(texToText(FORMULAS[params.formula]));
    // The dashed box is the formula's world bounds (layout.getBounds).
    const b = getBounds(shown);
    box.width = b.width + 0.3; box.height = b.height + 0.3;
    box.setPosition(b.centerX, b.centerY).markGeometryDirty();
  };
  refresh();
  return {
    scene, camera,
    setParameter() { refresh(); return true; },
    stats: () => {
      const b = getBounds(shown);
      return [[L('ширина', 'width'), fmt(b.width, 3)], [L('высота', 'height'), fmt(b.height, 3)], [L('символов TeX', 'TeX characters'), String(FORMULAS[params.formula].length)]];
    },
    caption: L('Под формулой — её текстовая версия для экранных чтецов (texToText).', 'Below the formula: its plain-text version for screen readers (texToText).'),
  };
}

// ---------- write, transform, indicate ----------

export function animationPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const frame = { left: 1.2, right: 9.8, bottom: 1.2, top: 7.2 };
  const axes = new PlotAxes({ ...frame, xTicks: 4, yTicks: 2, labelGap: 0.3 });
  axes.setRanges([0, 2 * Math.PI], [-1.2, 1.2]);
  const toPoints = (f) => {
    const { xs, ys } = sample(f, 0, 2 * Math.PI, 160);
    return axes.frame.clip(xs, ys)[0];
  };
  const [curve] = curveLayers([toPoints(Math.sin)], stroke(C.blue, 2.4));
  const title = text(L('Анимации: Write, Transform, Indicate, FadeIn, Unwrite', 'Animations: Write, Transform, Indicate, FadeIn, Unwrite'), 0.8, 8.3, { size: 0.4 });
  const label = formula(String.raw`y = \sin x`, 10.6, 6, { color: C.blue });
  const target = formula(String.raw`y = \cos x`, 10.6, 5, { color: C.yellow });
  const arrow = new Arrow(10.6, 3.6, 12.6, 3.6, { headLength: 12, style: stroke(C.yellow, 2) });
  const phase = text('', 10.6, 2.4, { size: 0.32, color: C.muted });
  target.opacity = 0;
  scene.add(axes, curve, title, label, target, arrow, phase);
  // The Transform target: not drawn, only its shape and colour are used.
  const [cosine] = curveLayers([toPoints(Math.cos)], stroke(C.yellow, 2.4));
  let time = 0, program = null;
  const steps = [
    [L('Write: доска пишется мелом', 'Write: the board is written in chalk'), 1.6],
    [L('Transform: sin превращается в cos', 'Transform: sin becomes cos'), 1.4],
    [L('FadeIn: новая подпись', 'FadeIn: a new caption'), 0.8],
    [L('Indicate: указать на стрелку', 'Indicate: point at the arrow'), 0.9],
    [L('Unwrite: стереть подпись', 'Unwrite: erase the caption'), 0.9],
  ];
  const start = () => {
    time = 0;
    program = new Sequence([
      new Write([axes, curve, label, arrow], { duration: steps[0][1], lag: params.lag }),
      new Transform(curve, cosine, { duration: steps[1][1] }),
      new FadeIn(target, { duration: steps[2][1], shift: [0.4, 0] }),
      new Indicate(arrow, { duration: steps[3][1], scale: 1.3 }),
      new Unwrite(label, { duration: steps[4][1] }),
    ]);
    // Reset the shapes that the program changes.
    const p = toPoints(Math.sin);
    for (let i = 0; i < p.length / 2; i += 1) { curve.positionsX[i] = p[2 * i]; curve.positionsY[i] = p[2 * i + 1]; }
    curve.setCount(p.length / 2).setStyle({ stroke: C.blue });
    target.opacity = 0;
    label.setReveal(1);
    // Not advanced yet: until Play the board shows the finished picture (and the preview).
  };
  start();
  const total = steps.reduce((sum, [, duration]) => sum + duration, 0);
  return {
    scene, camera, dynamic: true,
    update(dt) {
      time = Math.min(total, time + dt);
      program.advance(dt);
      let t = time, index = 0;
      while (index < steps.length - 1 && t > steps[index][1]) { t -= steps[index][1]; index += 1; }
      phase.setText(steps[index][0]);
      return time >= total;
    },
    reset: start,
    setParameter(key) { if (key === 'lag') { start(); return true; } return false; },
    stats: () => [[L('время', 'time'), `${time.toFixed(2)} s`], ['lag', fmt(params.lag, 2)]],
    caption: L('Пуск проигрывает программу анимаций через Scene-подобную Sequence.', 'Play runs the animation program as one Sequence.'),
  };
}

// ---------- plots ----------

const PLOT_FUNCTIONS = {
  exp: [(x) => Math.exp(x), String.raw`y = e^x`],
  inverse: [(x) => 1 / x, String.raw`y = 1/x`],
  power: [(x) => x ** 3 - 2 * x, String.raw`y = x^3 - 2x`],
};

export function plotPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const frame = { left: 1.4, right: 11, bottom: 1.2, top: 7.3 };
  const axes = new PlotAxes({ ...frame, xTicks: 5, yTicks: 4, labelGap: 0.3 });
  const curves = new Group();
  const title = text(L('PlotFrame и PlotAxes: оси, деления, отсечение', 'PlotFrame and PlotAxes: axes, ticks, clipping'), 0.8, 8.3, { size: 0.4 });
  const name = formula('y', 11.6, 6.8, { color: C.blue });
  const note = text('', 11.6, 5.8, { size: 0.28, color: C.muted, maxWidth: 4, wrap: true, baseline: 'top' });
  scene.add(title, axes, curves, name, note);
  let runs = 0;
  const refresh = () => {
    const [f, tex] = PLOT_FUNCTIONS[params.fn];
    const log = params.scale === 'log';
    const yRange = log ? [1e-2, 1e3] : [-4, 8];
    axes.setRanges([-3, params.xmax], yRange, { yScale: log ? 'log' : 'linear' });
    const { xs, ys } = sample(f, -3, params.xmax, 400);
    const lines = axes.frame.clip(xs, ys);
    runs = lines.length;
    curves.clear();
    curves.add(...curveLayers(lines, stroke(C.blue, 2.4)));
    name.setTex(tex);
    note.setText(L(
      'Кривая отсечена рамкой, разрывы (x = 0 для 1/x, y ≤ 0 на логарифмической оси) дают отдельные участки.',
      'The curve is cut at the frame; gaps (x = 0 for 1/x, y ≤ 0 on a log axis) split it into runs.',
    ));
  };
  refresh();
  return {
    scene, camera,
    setParameter() { refresh(); return true; },
    stats: () => [[L('участков кривой', 'curve runs'), String(runs)], [L('шкала y', 'y scale'), params.scale], ['x', `−3 … ${params.xmax}`]],
  };
}

export function ticksPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const title = text(L('niceTicks: круглые деления для любого диапазона', 'niceTicks: round ticks for any range'), 0.8, 8.3, { size: 0.4 });
  const line = new Line(1.5, 4.5, 14.5, 4.5, { style: stroke(C.muted, 1.6) });
  const ticks = new Group();
  const info = text('', 1.5, 2.4, { size: 0.32, color: C.muted });
  scene.add(title, line, ticks, info);
  let result = { step: 0, values: [] };
  const refresh = () => {
    const min = params.min, max = params.min + params.span;
    result = niceTicks(min, max, params.count);
    const x = (v) => 1.5 + 13 * (v - min) / (max - min);
    ticks.clear();
    for (const value of result.values) {
      ticks.add(
        new Line(x(value), 4.3, x(value), 4.7, { style: stroke(C.white, 1.4, { passes: 1 }) }),
        text(fmt(value, 6), x(value), 3.85, { size: 0.3, align: 'center', font: `16px ${NUMBER_FONT}` }),
      );
    }
    ticks.add(text(fmt(min, 4), 1.5, 5.25, { size: 0.26, color: C.dim, align: 'center' }), text(fmt(max, 4), 14.5, 5.25, { size: 0.26, color: C.dim, align: 'center' }));
    info.setText(L(`Шаг ${fmt(result.step, 4)}: 1, 2, 2,5 или 5 × 10ⁿ; делений ${result.values.length}, просили ~${params.count} интервалов.`, `Step ${fmt(result.step, 4)}: 1, 2, 2.5 or 5 × 10ⁿ; ${result.values.length} ticks for about ${params.count} intervals.`));
  };
  refresh();
  return {
    scene, camera,
    setParameter() { refresh(); return true; },
    stats: () => [[L('шаг', 'step'), fmt(result.step, 4)], [L('делений', 'ticks'), String(result.values.length)]],
  };
}

// ---------- layout ----------

const DIRECTIONS = { right: RIGHT, down: DOWN, up: UP };

export function layoutPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const title = text(L('Раскладка: arrange, nextTo, Panel', 'Layout: arrange, nextTo, Panel'), 0.8, 8.3, { size: 0.4 });
  const shapes = [
    new Rectangle(1.4, 1, { style: stroke(C.blue, 2) }),
    new Circle(0.6, { style: stroke(C.yellow, 2) }),
    new Rectangle(0.8, 1.6, { style: stroke(C.green, 2) }),
    formula(String.raw`\frac{a}{b}`, 0, 0, { color: C.red }),
  ];
  const row = new Group(shapes);
  const bounds = new Rectangle(1, 1, { style: stroke(C.dim, 1, { dash: [5, 5], passes: 1 }) });
  const caption = text(L('подпись: nextTo(..., DOWN)', 'caption: nextTo(..., DOWN)'), 0, 0, { size: 0.3, color: C.muted });
  const panel = new Panel({
    x: 12.6, y: 4.4, width: 5.6, height: 5.2, title: L('Panel', 'Panel'), titleSize: 0.34, padding: 0.3, family: FONT,
  });
  const paragraph = text(L(
    'Текст внутри панели переносится по словам (wrap) и обрезается её рамкой (Group clip). Круг ниже выходит за край и срезан.',
    'Text inside the panel wraps at spaces (wrap) and is clipped by its frame (Group clip). The circle below runs past the edge and is cut.',
  ), 0, 0, { size: 0.3, maxWidth: panel.innerWidth, wrap: true, baseline: 'top' });
  const overflow = new Circle(1.2, { x: panel.innerWidth - 0.3, y: -panel.innerHeight + 0.4, style: stroke(C.red, 2) });
  panel.content.add(paragraph, overflow);
  scene.add(title, bounds, row, caption, panel);
  const refresh = () => {
    shapes.forEach((shape) => shape.setPosition(0, 0));
    shapes[0].setPosition(2, 6);
    arrange(shapes, DIRECTIONS[params.direction], { buff: params.buff });
    const b = getBounds(row);
    bounds.width = b.width + 0.2; bounds.height = b.height + 0.2;
    bounds.setPosition(b.centerX, b.centerY).markGeometryDirty();
    caption.setPosition(0, 0);
    nextTo(caption, row, DOWN, { buff: 0.35, align: -1 });
  };
  refresh();
  return {
    scene, camera,
    setParameter() { refresh(); return true; },
    stats: () => {
      const b = getBounds(row);
      return [[L('ширина ряда', 'row width'), fmt(b.width, 3)], [L('высота ряда', 'row height'), fmt(b.height, 3)]];
    },
  };
}

// ---------- picking and dragging ----------

export function dragPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const frame = { left: 1.4, right: 10.6, bottom: 1.2, top: 7.3 };
  const axes = new PlotAxes({ ...frame, xTicks: 4, yTicks: 3, labelGap: 0.3 });
  axes.setRanges([-2, 2], [-1, 3]);
  const f = (x) => x * x - 0.5;
  const { xs, ys } = sample(f, -2, 2, 200);
  const title = text(L('hitTest и bindPointerDrag: перетащите точку', 'hitTest and bindPointerDrag: drag the point'), 0.8, 8.3, { size: 0.4 });
  const tangent = new Line(0, 0, 1, 1, { style: stroke(C.yellow, 1.6, { dash: [7, 6] }) });
  const handle = new Circle(0.18, { style: stroke(C.yellow, 2, { fill: C.yellow }) });
  handle.name = 'handle';
  const readout = formula('', 11.3, 6.6, { color: C.yellow });
  const hint = text(L('Та же величина — ползунком x слева: у перетаскивания всегда есть клавиатурная замена.', 'The same value is on the x slider: dragging always has a keyboard alternative.'), 11.3, 5.6, { size: 0.28, color: C.muted, maxWidth: 4.3, wrap: true, baseline: 'top' });
  scene.add(axes, ...curveLayers(axes.frame.clip(xs, ys), stroke(C.blue, 2.4)), tangent, handle, title, readout, hint);
  const place = () => {
    const x = params.x, y = f(x), slope = 2 * x;
    handle.setPosition(axes.frame.x(x), axes.frame.y(y));
    const x0 = Math.max(-2, x - 0.8), x1 = Math.min(2, x + 0.8);
    tangent.setEndpoints(axes.frame.x(x0), axes.frame.y(y + slope * (x0 - x)), axes.frame.x(x1), axes.frame.y(y + slope * (x1 - x)));
    readout.setTex(String.raw`f'(${fmt(x, 3)}) = ${fmt(slope, 3)}`);
  };
  place();
  return {
    scene, camera,
    setParameter(key) { if (key === 'x') { place(); return true; } return false; },
    pick: (x, y, tolerance) => {
      const hit = hitTest(scene, x, y, { tolerance });
      return hit?.object === handle ? handle : null;
    },
    drag(_object, x) {
      // The point stays on the curve: only its x follows the pointer, rounded to the slider grid.
      params.x = Math.round(Math.max(-2, Math.min(2, axes.frame.value(x, 0)[0])) * 100) / 100;
      place();
    },
    stats: () => [['x', fmt(params.x, 3)], ["f'(x)", fmt(2 * params.x, 3)]],
  };
}

// ---------- fields ----------

const SCALARS = {
  ripple: (x, y) => Math.sin(1.4 * x) * Math.cos(1.1 * y),
  saddle: (x, y) => (x * x - y * y) / 4,
  bump: (x, y) => Math.exp(-((x - 0.8) ** 2 + y * y)) - Math.exp(-((x + 1) ** 2 + (y - 0.5) ** 2) / 0.6),
};

export function contourPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const domain = { minX: -3, maxX: 3, minY: -2, maxY: 2 };
  const columns = 96, rows = 64;
  const values = new Float32Array(columns * rows);
  // The board shows the field domain in [2, 14] × [1, 7] (scale 2).
  const field = new ScalarField(values, columns, rows, { minX: 2, maxX: 14, minY: 1, maxY: 7, lut: COLORMAPS.diverging, min: -1, max: 1, style: { opacity: 0.75 } });
  const lines = new Group();
  const title = text(L('contourSegments + joinSegments: изолинии поля', 'contourSegments + joinSegments: level curves of a field'), 0.8, 8.3, { size: 0.4 });
  scene.add(field, lines, new Rectangle(12, 6, { x: 8, y: 4, style: stroke(C.muted, 1.2, { passes: 1 }) }), title);
  let strokes = 0;
  const refresh = () => {
    const f = SCALARS[params.field];
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < columns; i += 1) {
        values[j * columns + i] = f(domain.minX + (i + 0.5) * 6 / columns, domain.minY + (j + 0.5) * 4 / rows);
      }
    }
    field.markDataDirty();
    lines.clear();
    strokes = 0;
    for (let k = 1; k <= params.levels; k += 1) {
      const level = -0.9 + 1.8 * k / (params.levels + 1);
      const segments = contourSegments({ fn: (x, y) => f(x, y), level, columns: 72, rows: 48, ...domain });
      // Field coordinates → board coordinates.
      const joined = joinSegments(segments, 1e-9).map((line) => line.map((v, i) => (i % 2 ? 4 + 1.5 * v : 8 + 2 * v)));
      strokes += joined.length;
      lines.add(...curveLayers(joined, stroke(level > 0 ? C.yellow : C.blue, 1.6, { passes: 1 })));
    }
  };
  refresh();
  return {
    scene, camera,
    setParameter() { refresh(); return true; },
    stats: () => [[L('уровней', 'levels'), String(params.levels)], [L('штрихов', 'strokes'), String(strokes)]],
  };
}

const FLOWS = {
  vortex: (x, y) => [-y, x],
  saddle: (x, y) => [x, -y],
  source: (x, y) => [x, y],
  gyre: (x, y) => [-Math.PI * Math.sin(Math.PI * x / 3) * Math.cos(Math.PI * y / 2), Math.PI * Math.cos(Math.PI * x / 3) * Math.sin(Math.PI * y / 2)],
};

export function flowPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const toBoard = (x, y) => [8 + 2 * x, 4 + 1.5 * y];
  const title = text(L('VectorField, traceStreamlines, TrailLayer', 'VectorField, traceStreamlines, TrailLayer'), 0.8, 8.3, { size: 0.4 });
  const arrows = new VectorField({ scale: 0.35, maxLength: 0.55, minLength: 0.02, headLength: 0.14, style: stroke(C.muted, 1.3, { passes: 1 }) });
  const streamlines = new Group();
  // Play: tracer points ride the flow and leave fading trails; a point leaving the box comes
  // back at its start, and that jump (longer than maxJump) breaks its trail.
  const trails = new TrailLayer({ length: 30, maxJump: 1, style: stroke(C.blue, 1.4, { passes: 1 }) });
  scene.add(new Rectangle(12, 6, { x: 8, y: 4, style: stroke(C.muted, 1.2, { passes: 1 }) }), arrows, streamlines, trails, title);
  const TRACERS = 40;
  const startX = Float64Array.from({ length: TRACERS }, (_, k) => -2.7 + 5.4 * ((k * 0.618034) % 1));
  const startY = Float64Array.from({ length: TRACERS }, (_, k) => -1.8 + 3.6 * (k + 0.5) / TRACERS);
  const tracerX = Float64Array.from(startX), tracerY = Float64Array.from(startY);
  const boardX = new Float64Array(TRACERS), boardY = new Float64Array(TRACERS);
  let points = 0, time = 0;
  const refresh = () => {
    const v = FLOWS[params.flow];
    const x = [], y = [];
    for (let j = 0; j < 9; j += 1) for (let i = 0; i < 17; i += 1) { const [bx, by] = toBoard(-3 + 6 * (i + 0.5) / 17, -2 + 4 * (j + 0.5) / 9); x.push(bx); y.push(by); }
    // Arrows in board coordinates: the flow is evaluated at the matching field point.
    arrows.setVectors({ x, y, vector: (bx, by) => { const [u, w] = v((bx - 8) / 2, (by - 4) / 1.5); return [2 * u, 1.5 * w]; } });
    const seeds = Array.from({ length: params.seeds }, (_, k) => [-2.6 + 5.2 * (k + 0.5) / params.seeds, 0.35 + 0.9 * Math.sin(2.4 * k)]);
    const lines = traceStreamlines(v, seeds, { step: 0.03, maxSteps: 500, bounds: { minX: -3, maxX: 3, minY: -2, maxY: 2 } })
      .map((line) => line.map((value, i) => (i % 2 ? 4 + 1.5 * value : 8 + 2 * value)));
    points = lines.reduce((sum, line) => sum + line.length / 2, 0);
    streamlines.clear();
    streamlines.add(...curveLayers(lines, stroke(C.yellow, 2)));
  };
  refresh();
  return {
    scene, camera, dynamic: true,
    update(dt) {
      const v = FLOWS[params.flow], h = Math.min(dt, 0.05);
      for (let i = 0; i < TRACERS; i += 1) {
        // Midpoint rule; the field is fixed, so this is a pathline.
        const [u0, w0] = v(tracerX[i], tracerY[i]);
        const [u1, w1] = v(tracerX[i] + 0.5 * h * u0, tracerY[i] + 0.5 * h * w0);
        tracerX[i] += h * u1;
        tracerY[i] += h * w1;
        if (!(Math.abs(tracerX[i]) <= 3 && Math.abs(tracerY[i]) <= 2)) { tracerX[i] = startX[i]; tracerY[i] = startY[i]; }
        [boardX[i], boardY[i]] = toBoard(tracerX[i], tracerY[i]);
      }
      trails.push(boardX, boardY);
      time += dt;
      return false;
    },
    setParameter(key) {
      refresh();
      if (key === 'flow') { tracerX.set(startX); tracerY.set(startY); trails.clear(); }
      return true;
    },
    stats: () => [[L('стрелок', 'arrows'), String(arrows.arrowCount)], [L('линий тока', 'streamlines'), String(params.seeds)], [L('точек', 'points'), String(points)], [L('время', 'time'), `${time.toFixed(1)} s`]],
  };
}

// ---------- data ----------

// The central-difference matrix (u_{i+1} − u_{i−1}) / 2h on N points, one-sided at the ends.
function differenceMatrix(n) {
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 1; i < n - 1; i += 1) { m[i][i - 1] = -0.5; m[i][i + 1] = 0.5; }
  m[0][0] = -1; m[0][1] = 1; m[n - 1][n - 2] = -1; m[n - 1][n - 1] = 1;
  return m;
}

export function matrixPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const title = text(L('MatrixGrid: матрица на доске, щёлкните по ячейке', 'MatrixGrid: a matrix on the board, click a cell'), 0.8, 8.3, { size: 0.4 });
  const grid = new MatrixGrid(differenceMatrix(params.n), { cell: 0.7, x: 1.6, y: 7.2, rowLabels: [], textSize: 0.24 });
  const readout = formula('', 10.6, 6.5, { color: C.yellow });
  const operator = formula(String.raw`(Du)_i = \frac{u_{i+1} - u_{i-1}}{2h}`, 10.6, 4.8);
  scene.add(title, grid, readout, operator);
  let selected = [1, 0];
  const show = () => {
    grid.highlight(selected);
    const value = grid.values[selected[0]]?.[selected[1]] ?? 0;
    readout.setTex(String.raw`D_{${selected[0]},${selected[1]}} = ${fmt(value, 3)}`);
  };
  const refresh = () => {
    grid.cell = Math.min(0.7, 6.4 / params.n);
    grid.textSize = grid.cell * 0.36;
    grid.setValues(differenceMatrix(params.n));
    selected = [Math.min(selected[0], params.n - 1), Math.min(selected[1], params.n - 1)];
    show();
  };
  refresh();
  return {
    scene, camera,
    setParameter() { refresh(); return true; },
    click(x, y) {
      const cell = grid.cellAt(x, y);
      if (!cell) return false;
      selected = cell;
      show();
      return true;
    },
    stats: () => [['N', String(params.n)], [L('ячейка', 'cell'), `${selected[0]}, ${selected[1]}`]],
  };
}

export function historyPane(params, lang) {
  const { scene, camera, L } = board(lang);
  const frame = { left: 1.4, right: 14.6, bottom: 1.2, top: 7.3 };
  const axes = new PlotAxes({ ...frame, xTicks: 5, yTicks: 2, labelGap: 0.3 });
  const history = new HistoryBuffer(['x', 'v'], 240);
  const buffers = { index: new Float64Array(240), x: new Float64Array(240), v: new Float64Array(240) };
  const position = new CurveLayer({ x: new Float32Array(240), y: new Float32Array(240), count: 0, style: stroke(C.blue, 2.2) });
  const velocity = new CurveLayer({ x: new Float32Array(240), y: new Float32Array(240), count: 0, style: stroke(C.yellow, 1.6, { dash: [6, 5] }) });
  const title = text(L('HistoryBuffer: поток данных без выделения памяти', 'HistoryBuffer: streaming data without allocation'), 0.8, 8.3, { size: 0.4 });
  const legend = formula(String.raw`x(t)\qquad \dot x(t)/\omega`, 14.6, 7.7, { align: 'right', size: 0.32, color: C.muted });
  scene.add(axes, position, velocity, title, legend);
  // A damped oscillator: x'' = −ω²x − 2ζωx', sampled once per frame.
  let x = 1, v = 0, time = 0;
  const fill = (layer, key) => {
    const indices = history.indices(buffers.index), values = history.copy(key, buffers[key]);
    for (let i = 0; i < values.length; i += 1) {
      const p = axes.frame;
      layer.positionsX[i] = p.x(indices[i]);
      layer.positionsY[i] = p.y(Math.max(-1.5, Math.min(1.5, values[i])));
    }
    layer.setCount(values.length);
  };
  const redraw = () => {
    axes.setRanges([0, 240], [-1.5, 1.5]);
    fill(position, 'x');
    fill(velocity, 'v');
  };
  const reset = () => { x = 1; v = 0; time = 0; history.clear(); history.push({ x, v }); redraw(); };
  reset();
  return {
    scene, camera, dynamic: true,
    update(dt) {
      const omega = 2 * Math.PI * params.frequency, zeta = params.damping;
      const steps = Math.max(1, Math.round(dt / 0.01));
      for (let k = 0; k < steps; k += 1) {
        const h = dt / steps;
        v += h * (-omega * omega * x - 2 * zeta * omega * v);
        x += h * v;
      }
      time += dt;
      history.push({ x, v: v / omega });
      redraw();
      return false;
    },
    reset,
    setParameter() { return true; },
    stats: () => [[L('время', 'time'), `${time.toFixed(1)} s`], [L('отсчётов', 'samples'), String(history.length)], ['x', fmt(x, 3)]],
  };
}

export const PANES = {
  formulas: formulasPane,
  animation: animationPane,
  plot: plotPane,
  ticks: ticksPane,
  layout: layoutPane,
  drag: dragPane,
  contours: contourPane,
  flow: flowPane,
  matrix: matrixPane,
  history: historyPane,
};

export { C, FONT };
