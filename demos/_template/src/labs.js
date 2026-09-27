// Experiment models. createLab(id, params, lang) returns an object the gallery drives:
//   render()      -> { ink, stats: [[label, value], ...], note?, warning? }   (required)
//   click(x, y)   -> true if the board changed                 (optional, board coordinates)
//   paint(x, y)   -> true if the board changed while dragging  (optional)
//   step()        advances one numerical step; with count, time, stop (dynamic experiments)
// The board is 1000 × 610 design units; draw with Ink and graph() from the shared board module.

import { C, Ink, fmt, graph, legend } from '../../pde-gallery/board.js';
import { FUNCTIONS, TAU, centralDifference, l1Distance, pulse, upwindStep } from './kernels.js';

function difference(p, L) {
  let plot = null;
  return {
    // Clicking the graph moves the evaluation point; params are shared with the controls.
    click(x, y) {
      if (!plot?.contains(x, y)) return false;
      const [value] = plot.inverse(x, y);
      p.x = Math.round(Math.min(6, Math.max(0.2, value)) * 10) / 10;
      return true;
    },
    render() {
      const { f, df } = FUNCTIONS[p.fn];
      const slope = centralDifference(f, p.x, p.h);
      const error = Math.abs(slope - df(p.x));
      const ink = new Ink();
      ink.title(L('Секущая приближает касательную', 'A secant approximates the tangent'), L('Нажмите на график, чтобы выбрать точку x', 'Click the graph to choose x'));
      plot = graph(ink, { xmin: 0, xmax: TAU, ymin: -1.3, ymax: 1.3, xlabel: 'x', ylabel: 'f' });
      plot.curve(f, C.white, 2);
      const line = (k, color) => plot.curve((t) => f(p.x) + k * (t - p.x), color, 1.6, 200, true);
      line(df(p.x), C.blue);
      line(slope, C.yellow);
      plot.dot(p.x - p.h, f(p.x - p.h), 4, C.yellow);
      plot.dot(p.x + p.h, f(p.x + p.h), 4, C.yellow);
      plot.dot(p.x, f(p.x), 5, C.red);
      legend(ink, [[L('Функция', 'Function'), C.white], [L('Касательная', 'Tangent'), C.blue], [L('Секущая', 'Secant'), C.yellow]]);
      return {
        ink,
        stats: [['h', fmt(p.h)], ["f′(x)", fmt(df(p.x))], [L('Разность', 'Difference'), fmt(slope)], [L('Ошибка', 'Error'), fmt(error)]],
      };
    },
  };
}

function upwind(p, L) {
  const n = p.n, h = 1 / n, dt = p.courant * h;
  const cells = Array.from({ length: n }, (_, i) => (i + 0.5) * h);
  let u = Float64Array.from(cells, pulse);
  return {
    count: 0,
    time: 0,
    stop: '',
    step() {
      if (this.time >= 1 - 1e-12) { this.stop = '■'; return; } // The gallery explains '■' as "end of interval".
      u = upwindStep(u, p.courant);
      this.count += 1;
      this.time = this.count * dt;
      // Report instability instead of clipping the data.
      if (u.some((v) => !(Math.abs(v) < 1e6))) this.stop = L('Решение превысило 10⁶: схема неустойчива.', 'The solution exceeded 10⁶: the scheme is unstable.');
    },
    render() {
      const exact = cells.map((x) => pulse(x - this.time));
      const ink = new Ink();
      ink.title(L('Численный и точный импульс', 'Numerical and exact pulse'), L('Белое — точное решение, жёлтое — схема', 'White: exact solution, yellow: scheme'));
      const plot = graph(ink, { xmin: 0, xmax: 1, ymin: -0.4, ymax: 1.3, xlabel: 'x', ylabel: 'u' });
      plot.series(cells, exact, C.white, 1.6);
      plot.series(cells, Array.from(u), C.yellow, 2.2, n <= 80);
      return {
        ink,
        stats: [['t', fmt(this.time, 3)], [L('Шаг', 'Step'), String(this.count)], ['Co', fmt(p.courant)], [L('Ошибка L¹', 'L¹ error'), fmt(l1Distance(u, exact))]],
      };
    },
  };
}

const FACTORIES = { difference, upwind };

export function createLab(id, params, lang = 'ru') {
  const factory = FACTORIES[id];
  if (!factory) throw new Error(`Unknown experiment: ${id}`);
  return factory(params, (ru, en) => (lang === 'en' ? en : ru));
}
