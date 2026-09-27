// Catalog: every experiment of the lecture, as data. Texts are [ru, en] pairs.
// The contract is checked by test/demo-consistency.test.js; see demos/README.md.

const R = (key, ru, en, value, min, max, step = 1) => ({ key, label: [ru, en], type: 'range', value, min, max, step });
const S = (key, ru, en, value, options) => ({ key, label: [ru, en], type: 'select', value, options });
const O = (value, ru, en) => ({ value, label: [ru, en] });
const P = (ru, en, values) => ({ label: [ru, en], values });

// Filter buttons above the catalogue; an experiment names its group by index.
export const groups = [
  ['Производные', 'Derivatives'],
  ['Перенос', 'Transport'],
];

// Referenced by key from each experiment. External URLs only, or a note file bundled in notes.js.
export const sources = {
  leveque2007: {
    label: 'LeVeque (2007): Finite Difference Methods for ODEs and PDEs',
    url: 'https://doi.org/10.1137/1.9780898717839',
  },
  leveque2002: {
    label: 'LeVeque (2002): Finite Volume Methods for Hyperbolic Problems',
    url: 'https://doi.org/10.1017/CBO9780511791253',
  },
};

export const demos = [
  {
    // A static experiment: the model has render() and, here, click().
    id: 'difference',
    group: 0,
    title: ['Секущая и производная', 'Secant and derivative'],
    short: ['Центральная разность и её ошибка.', 'A centered difference and its error.'],
    equation: ['f′(x) ≈ [f(x+h) − f(x−h)] / 2h', 'f′(x) ≈ [f(x+h) − f(x−h)] / 2h'],
    controls: [
      S('fn', 'Функция', 'Function', 'sin', [O('sin', 'sin x', 'sin x'), O('gauss', 'Гауссов импульс', 'Gaussian pulse')]),
      R('h', 'Шаг h', 'Step h', 0.5, 0.05, 1.5, 0.05),
      R('x', 'Точка x', 'Point x', 1.2, 0.2, 6, 0.1),
    ],
    presets: [
      P('Малый шаг', 'Small step', { h: 0.1 }),
      P('Большой шаг', 'Large step', { h: 1.2 }),
    ],
    question: [
      'Уменьшите h вдвое. Во сколько раз уменьшилась ошибка?',
      'Halve h. By what factor does the error shrink?',
    ],
    explanation: [
      'Центральная разность симметрична, поэтому чётные члены ряда Тейлора сокращаются и ошибка равна h²f‴(x)/6 + O(h⁴).',
      'The centered difference is symmetric, so even Taylor terms cancel and the error is h²f‴(x)/6 + O(h⁴).',
    ],
    caveat: [
      'Арифметика двойной точности; при очень малых h ошибка округления растёт как ε/h.',
      'Double-precision arithmetic; for very small h the round-off error grows like ε/h.',
    ],
    sources: ['leveque2007'],
  },
  {
    // A dynamic experiment: the model also has step(), count, time and stop.
    id: 'upwind',
    group: 1,
    dynamic: true,
    thumbSteps: 30,
    title: ['Перенос против потока', 'Upwind transport'],
    short: ['Импульс движется и расплывается.', 'A pulse moves and smears out.'],
    equation: ['uₜ + uₓ = 0;   uᵢⁿ⁺¹ = uᵢⁿ − Co (uᵢⁿ − uᵢ₋₁ⁿ)', 'uₜ + uₓ = 0;   uᵢⁿ⁺¹ = uᵢⁿ − Co (uᵢⁿ − uᵢ₋₁ⁿ)'],
    controls: [
      R('courant', 'Число Куранта Co', 'Courant number Co', 0.5, 0.1, 1.2, 0.05),
      R('n', 'Число ячеек N', 'Number of cells N', 80, 20, 320, 20),
    ],
    presets: [
      P('Co = 1: точный сдвиг', 'Co = 1: exact shift', { courant: 1 }),
      P('Co > 1: неустойчивость', 'Co > 1: instability', { courant: 1.1 }),
    ],
    question: [
      'Почему при Co = 1 импульс не расплывается, а при Co > 1 расчёт разрушается?',
      'Why does the pulse keep its shape at Co = 1 but blow up for Co > 1?',
    ],
    explanation: [
      'Схема против потока берёт значение слева, откуда приходит информация. При Co ≤ 1 это выпуклая комбинация соседних значений.',
      'The upwind scheme takes the value from the left, where information comes from. For Co ≤ 1 it is a convex combination of neighbours.',
    ],
    caveat: [
      'Периодическая область, скорость переноса 1, расчёт до t = 1 (один оборот).',
      'Periodic domain, transport speed 1, run to t = 1 (one period).',
    ],
    sources: ['leveque2002'],
  },
];

export function defaults(demo) {
  return Object.fromEntries(demo.controls.map((control) => [control.key, control.value]));
}

export function translate(value, lang = 'ru') {
  return Array.isArray(value) ? value[lang === 'en' ? 1 : 0] : String(value ?? '');
}

export default { groups, sources, demos, defaults, translate };
