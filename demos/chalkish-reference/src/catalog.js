// Chalkish reference: one experiment per group of primitives, as data. Texts are [ru, en]
// pairs; the contract is checked by test/demo-consistency.test.js (see demos/README.md).

const R = (key, ru, en, value, min, max, step = 1) => ({ key, label: [ru, en], type: 'range', value, min, max, step });
const S = (key, ru, en, value, options) => ({ key, label: [ru, en], type: 'select', value, options });
const O = (value, ru, en) => ({ value, label: [ru, en] });
const P = (ru, en, values) => ({ label: [ru, en], values });

export const groups = [
  ['Текст и формулы', 'Text and formulas'],
  ['Графики', 'Plots'],
  ['Анимация', 'Animation'],
  ['Раскладка и мышь', 'Layout and pointer'],
  ['Поля', 'Fields'],
  ['Данные', 'Data'],
];

export const sources = {
  manim: { label: 'Manim Community: the animation vocabulary Chalkish follows', url: 'https://docs.manim.community/en/stable/' },
  texbook: { label: 'Knuth, The TeXbook: spacing between atoms and script placement', url: 'https://ctan.org/pkg/texbook' },
  liangBarsky: { label: 'Liang–Barsky line clipping', url: 'https://en.wikipedia.org/wiki/Liang%E2%80%93Barsky_algorithm' },
  marching: { label: 'Marching squares', url: 'https://en.wikipedia.org/wiki/Marching_squares' },
  rk4: { label: 'Runge–Kutta methods', url: 'https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods' },
  ring: { label: 'Circular buffer', url: 'https://en.wikipedia.org/wiki/Circular_buffer' },
};

export const demos = [
  {
    id: 'formulas',
    group: 0,
    title: ['Формула мелом', 'A formula in chalk'],
    short: ['MathLabel: TeX, разложенный рукописным шрифтом.', 'MathLabel: TeX laid out in the chalk hand.'],
    equation: { tex: String.raw`\text{new MathLabel}(\text{tex},\ \{\,\text{size}\,\})` },
    controls: [
      S('formula', 'Формула', 'Formula', 'scheme', [
        O('scheme', 'Схема против потока', 'Upwind scheme'),
        O('weno', 'Веса WENO', 'WENO weights'),
        O('matrix', 'Матрица перехода', 'Transition matrix'),
        O('integral', 'Среднее по ячейке', 'Cell average'),
        O('cases', 'Ограничитель (cases)', 'Limiter (cases)'),
        O('roots', 'Групповая скорость', 'Group velocity'),
      ]),
      R('size', 'Размер, единиц доски', 'Size, board units', 0.5, 0.3, 0.8, 0.05),
    ],
    presets: [P('Матрица крупно', 'Large matrix', { formula: 'matrix', size: 0.75 }), P('Дробь в корне', 'Fraction under a root', { formula: 'roots', size: 0.5 })],
    question: ['Сравните рамку формулы (getBounds) с её видом: где матрица и cases добавляют высоту?', 'Compare the formula’s box (getBounds) with its look: where do the matrix and cases add height?'],
    explanation: [
      'MathLabel(tex, { size }) разбирает подмножество TeX (src/tex.js) и раскладывает его в единицах em шрифта доски: индексы, дроби, корни, акценты, \\left…\\right, матрицы и cases. Рендерер рисует глифы мелом; texToText даёт ту же формулу текстом для экранных чтецов.',
      'MathLabel(tex, { size }) parses a TeX subset (src/tex.js) and lays it out in em of the board font: scripts, fractions, roots, accents, \\left…\\right, matrices and cases. The renderer draws the glyphs in chalk; texToText gives the same formula as text for screen readers.',
    ],
    caveat: ['Неизвестная команда вызывает TexError при создании, а не рисуется неправильно. Шрифт — Neucha; начертание математики упрощено.', 'An unknown command throws a TexError at creation instead of drawing wrongly. The font is Neucha; math typography is simplified.'],
    sources: ['texbook'],
  },
  {
    id: 'animation',
    group: 2,
    dynamic: true,
    speed: 24,
    title: ['Пишем, превращаем, выделяем', 'Write, transform, indicate'],
    short: ['Write, Transform, FadeIn, Indicate, Unwrite в одной Sequence.', 'Write, Transform, FadeIn, Indicate, Unwrite in one Sequence.'],
    equation: { tex: String.raw`\text{Sequence}\left[\,\text{Write},\ \text{Transform},\ \text{FadeIn},\ \text{Indicate},\ \text{Unwrite}\,\right]` },
    controls: [R('lag', 'Запаздывание lag', 'Lag between strokes', 0.15, 0, 0.5, 0.05)],
    presets: [P('Все штрихи сразу', 'All strokes at once', { lag: 0 }), P('Штрих за штрихом', 'Stroke after stroke', { lag: 0.5 })],
    question: ['Как lag меняет порядок, в котором доска пишется мелом?', 'How does lag change the order in which the board is written?'],
    explanation: [
      'Каждый объект имеет reveal от 0 до 1: штрих рисуется до этой доли длины, текст — по буквам, формула — по глифам. Write/Unwrite двигают reveal с запаздыванием lag между объектами; Transform перестраивает кривую по длине дуги и смешивает цвет; Indicate раздувает объект вокруг центра и возвращает точно.',
      'Every object has reveal from 0 to 1: a stroke is drawn to that fraction of its length, text by characters, a formula by glyphs. Write/Unwrite move reveal with a lag between objects; Transform resamples a curve by arc length and blends colour; Indicate swells an object about its centre and restores it exactly.',
    ],
    caveat: ['Пуск проигрывает программу один раз; сброс начинает заново. Скорость 24 — реальное время.', 'Play runs the program once; reset starts again. Speed 24 is real time.'],
    sources: ['manim'],
  },
  {
    id: 'plot',
    group: 1,
    title: ['Оси, деления, отсечение', 'Axes, ticks, clipping'],
    short: ['PlotFrame и PlotAxes: линейная и логарифмическая шкалы.', 'PlotFrame and PlotAxes: linear and log scales.'],
    equation: { tex: String.raw`\text{frame.clip}(x, y)\ \to\ \text{runs inside the frame}` },
    controls: [
      S('fn', 'Функция', 'Function', 'inverse', [O('exp', 'eˣ', 'eˣ'), O('inverse', '1/x', '1/x'), O('power', 'x³ − 2x', 'x³ − 2x')]),
      S('scale', 'Шкала y', 'y scale', 'linear', [O('linear', 'линейная', 'linear'), O('log', 'логарифмическая', 'log')]),
      R('xmax', 'Правый край x', 'Right end of x', 3, 1, 5, 0.5),
    ],
    presets: [P('Экспонента в логарифмах', 'Exponential on a log axis', { fn: 'exp', scale: 'log', xmax: 5 }), P('Разрыв 1/x', 'The 1/x gap', { fn: 'inverse', scale: 'linear' })],
    question: ['Почему eˣ на логарифмической оси — прямая, а 1/x распадается на участки?', 'Why is eˣ a straight line on a log axis, and why does 1/x split into runs?'],
    explanation: [
      'PlotFrame переводит данные в координаты доски на линейной или логарифмической оси и отсекает ломаные по рамке (Liang–Barsky); точки вне области определения (x = 0, y ≤ 0 на лог-оси) разрывают линию. PlotAxes рисует сетку и подписи круглых делений и перестраивается только при смене диапазонов.',
      'PlotFrame maps data to board coordinates on a linear or log axis and clips polylines to the frame (Liang–Barsky); points outside the domain (x = 0, y ≤ 0 on a log axis) break the line. PlotAxes draws the grid and round tick labels and rebuilds only when the ranges change.',
    ],
    caveat: ['Диапазон y задан: [−4, 8] или [10⁻², 10³].', 'The y range is fixed: [−4, 8] or [10⁻², 10³].'],
    sources: ['liangBarsky'],
  },
  {
    id: 'ticks',
    group: 1,
    title: ['Круглые деления', 'Round ticks'],
    short: ['niceTicks: шаг 1, 2, 2,5 или 5 × 10ⁿ.', 'niceTicks: steps of 1, 2, 2.5 or 5 × 10ⁿ.'],
    equation: { tex: String.raw`\text{step} \in \{1,\ 2,\ 2.5,\ 5\} \cdot 10^k` },
    controls: [
      R('min', 'Начало диапазона', 'Range start', 0.1, -5, 5, 0.05),
      S('span', 'Длина диапазона', 'Range length', 1.13, [O(0.004, '0,004', '0.004'), O(1.13, '1,13', '1.13'), O(7, '7', '7'), O(250, '250', '250'), O(18000, '18 000', '18 000')]),
      R('count', 'Желаемое число интервалов', 'Wanted intervals', 4, 1, 10, 1),
    ],
    presets: [P('Малый диапазон', 'Tiny range', { span: 0.004, count: 4 }), P('Много делений', 'Many ticks', { span: 250, count: 10 })],
    question: ['При каком числе интервалов шаг переходит с 2 на 2,5 или на 5?', 'At what number of intervals does the step jump from 2 to 2.5 or 5?'],
    explanation: [
      'niceTicks(min, max, count) берёт шаг около длины/count, округляет его мантиссу до 1, 2, 2,5 или 5 и ставит деления на кратных шага внутри диапазона (не меньше двух). formatTick пишет только нужные шагу цифры; niceBounds расширяет диапазон до круглых значений.',
      'niceTicks(min, max, count) takes a step near length/count, rounds its mantissa to 1, 2, 2.5 or 5 and places ticks at its multiples inside the range (at least two). formatTick writes only the digits the step needs; niceBounds widens a range to round values.',
    ],
    caveat: ['Края диапазона подписаны серым: деление на крае — только если оно кратно шагу.', 'The range ends are labelled in grey: an end gets a tick only when it is a multiple of the step.'],
    sources: [],
  },
  {
    id: 'layout',
    group: 3,
    title: ['Раскладка без координат', 'Layout without coordinates'],
    short: ['arrange, nextTo, Panel, перенос текста и обрезка.', 'arrange, nextTo, Panel, text wrapping and clipping.'],
    equation: { tex: String.raw`\text{arrange}(\text{shapes},\ \text{RIGHT},\ \{\,\text{buff}\,\});\quad \text{nextTo}(\text{caption},\ \text{row},\ \text{DOWN})` },
    controls: [
      S('direction', 'Направление', 'Direction', 'right', [O('right', 'вправо', 'right'), O('down', 'вниз', 'down'), O('up', 'вверх', 'up')]),
      R('buff', 'Зазор buff', 'Gap buff', 0.25, 0, 0.8, 0.05),
    ],
    presets: [P('Столбик', 'A column', { direction: 'down', buff: 0.15 }), P('Вплотную', 'Touching', { buff: 0 })],
    question: ['Почему подпись всегда оказывается под рядом, как бы он ни был выложен?', 'Why does the caption always end up below the row, however it is laid out?'],
    explanation: [
      'getBounds даёт мировые границы любого объекта, включая текст и формулы; arrange ставит объекты друг за другом, nextTo — рядом с другим объектом, moveTo — по центру. Panel — рамка, заголовок и группа содержимого с обрезкой (Group clip); TextLabel с wrap переносит слова в пределах maxWidth.',
      'getBounds gives the world bounds of any object, text and formulas included; arrange places objects one after another, nextTo beside another object, moveTo centred on a point. Panel is a frame, a title and a content group with clipping (Group clip); a TextLabel with wrap breaks words within maxWidth.',
    ],
    caveat: ['Ширина текста до отрисовки оценивается (0,52 em на знак) или измеряется функцией measure.', 'Before drawing, text width is estimated (0.52 em per character) or measured by a measure function.'],
    sources: ['manim'],
  },
  {
    id: 'drag',
    group: 3,
    title: ['Точку можно тянуть', 'A point you can drag'],
    short: ['hitTest и bindPointerDrag: касательная к параболе.', 'hitTest and bindPointerDrag: a tangent to a parabola.'],
    equation: { tex: String.raw`f(x) = x^2 - \frac12,\qquad f'(x) = 2x` },
    controls: [R('x', 'Точка x', 'Point x', 0.8, -2, 2, 0.01)],
    presets: [P('Вершина', 'The vertex', { x: 0 }), P('Край', 'The edge', { x: -1.8 })],
    question: ['Перетащите точку мышью или пальцем: совпадает ли наклон касательной с f′(x)?', 'Drag the point with a mouse or finger: does the tangent’s slope match f′(x)?'],
    explanation: [
      'bindPointerDrag переводит указатель в мировые координаты и спрашивает pick, что тянуть; здесь pick — это hitTest(scene, x, y, { tolerance }), который находит верхний нарисованный объект у точки. Перетаскивание меняет тот же параметр, что и ползунок x.',
      'bindPointerDrag turns the pointer into world coordinates and asks pick what to drag; here pick is hitTest(scene, x, y, { tolerance }), which finds the topmost drawn object near the point. Dragging changes the same parameter as the x slider.',
    ],
    caveat: ['Точка остаётся на кривой: за указателем следует только x, округлённый до шага ползунка.', 'The point stays on the curve: only its x follows the pointer, rounded to the slider step.'],
    sources: [],
  },
  {
    id: 'contours',
    group: 4,
    title: ['Изолинии поля', 'Level curves'],
    short: ['contourSegments и joinSegments над ScalarField.', 'contourSegments and joinSegments over a ScalarField.'],
    equation: { tex: String.raw`\{(x, y) : f(x, y) = c_k\},\qquad c_k = -0.9 + \frac{1.8\,k}{K + 1}` },
    controls: [
      S('field', 'Поле', 'Field', 'ripple', [O('ripple', 'волны', 'ripples'), O('saddle', 'седло', 'saddle'), O('bump', 'два холма', 'two bumps')]),
      R('levels', 'Число уровней K', 'Levels K', 5, 1, 9, 1),
    ],
    presets: [P('Седло', 'Saddle', { field: 'saddle', levels: 7 }), P('Один уровень', 'One level', { levels: 1 })],
    question: ['Как изолинии седла проходят через седловую точку?', 'How do the saddle’s level curves pass through the saddle point?'],
    explanation: [
      'contourSegments — марширующие квадраты по сетке узлов (fn или values) с разрешением седловых ячеек по среднему; joinSegments сшивает отрезки в длинные ломаные, и уровень рисуется несколькими штрихами мела вместо сотен. Фон — ScalarField с расходящейся палитрой.',
      'contourSegments is marching squares over grid nodes (fn or values), resolving saddle cells by their average; joinSegments stitches segments into long polylines, so a level is drawn with a few chalk strokes instead of hundreds. The background is a ScalarField with a diverging palette.',
    ],
    caveat: ['Сетка 72 × 48; значения ровно на уровне считаются чуть выше него.', 'A 72 × 48 grid; values exactly on the level count as just above it.'],
    sources: ['marching'],
  },
  {
    id: 'flow',
    group: 4,
    title: ['Стрелки и линии тока', 'Arrows and streamlines'],
    short: ['VectorField и traceStreamlines (RK4).', 'VectorField and traceStreamlines (RK4).'],
    equation: { tex: String.raw`\frac{d\mathbf{x}}{ds} = \frac{\mathbf{v}(\mathbf{x})}{|\mathbf{v}(\mathbf{x})|}` },
    controls: [
      S('flow', 'Поле скорости', 'Velocity field', 'gyre', [O('vortex', 'вихрь', 'vortex'), O('saddle', 'седло', 'saddle'), O('source', 'источник', 'source'), O('gyre', 'двойной круговорот', 'double gyre')]),
      R('seeds', 'Число линий тока', 'Streamlines', 8, 2, 16, 1),
    ],
    presets: [P('Вихрь', 'Vortex', { flow: 'vortex', seeds: 6 }), P('Седло', 'Saddle', { flow: 'saddle', seeds: 12 })],
    question: ['Почему линии тока вихря замыкаются, а у источника уходят к краю?', 'Why do the vortex’s streamlines close while the source’s run to the edge?'],
    explanation: [
      'VectorField — один слой отрезков мела: древко и два штриха головки на стрелку, длина min(maxLength, scale·|v|). traceStreamline интегрирует единичное поле направлений методом RK4 в обе стороны и останавливается на границе, в точке застоя или при замыкании орбиты.',
      'VectorField is one layer of chalk segments: a shaft and two head strokes per arrow, length min(maxLength, scale·|v|). traceStreamline integrates the unit direction field with RK4 both ways and stops at the bounds, at a stagnation point, or when an orbit closes.',
    ],
    caveat: ['Шаг 0,03 по длине дуги, не больше 500 шагов в каждую сторону.', 'Step 0.03 in arc length, at most 500 steps each way.'],
    sources: ['rk4'],
  },
  {
    id: 'matrix',
    group: 5,
    title: ['Матрица на доске', 'A matrix on the board'],
    short: ['MatrixGrid: ячейки, значения, выбор щелчком.', 'MatrixGrid: cells, values, a click to select.'],
    equation: { tex: String.raw`D = \frac{1}{2h}\begin{bmatrix} -2 & 2 & & \\ -1 & 0 & 1 & \\ & \ddots & \ddots & \ddots \\ & & -2 & 2 \end{bmatrix}` },
    controls: [R('n', 'Размер N', 'Size N', 6, 3, 9, 1)],
    presets: [P('Малая', 'Small', { n: 3 }), P('Крупная', 'Large', { n: 9 })],
    question: ['Щёлкните по ячейкам: почему сумма каждой строки равна нулю?', 'Click the cells: why does every row sum to zero?'],
    explanation: [
      'MatrixGrid(values, { cell }) рисует ячейки с заливкой по знаку и значением внутри, cellAt(x, y) находит ячейку под точкой мира, highlight рамкой выделяет выбранную. Для досок галереи тот же приём — matrix(ink, M, …) с cellAt.',
      'MatrixGrid(values, { cell }) draws sign-coloured cells with their values, cellAt(x, y) finds the cell under a world point, highlight frames the selected one. On gallery boards the same idea is matrix(ink, M, …) with cellAt.',
    ],
    caveat: ['Пустые ячейки — нули; на краях односторонние разности.', 'Blank cells are zeros; the ends use one-sided differences.'],
    sources: [],
  },
  {
    id: 'history',
    group: 5,
    dynamic: true,
    speed: 24,
    title: ['Поток данных', 'Streaming data'],
    short: ['HistoryBuffer: последние отсчёты без выделения памяти.', 'HistoryBuffer: the latest samples without allocation.'],
    equation: { tex: String.raw`\ddot x = -\omega^2 x - 2\zeta\omega\,\dot x,\qquad \omega = 2\pi f` },
    controls: [
      R('frequency', 'Частота f', 'Frequency f', 0.3, 0.1, 1, 0.05),
      R('damping', 'Затухание ζ', 'Damping ζ', 0.08, 0, 0.5, 0.01),
    ],
    presets: [P('Без затухания', 'Undamped', { damping: 0 }), P('Сильное затухание', 'Heavy damping', { damping: 0.4 })],
    question: ['Что происходит со старыми отсчётами, когда буфер заполнен?', 'What happens to old samples once the buffer is full?'],
    explanation: [
      'HistoryBuffer(keys, capacity) хранит несколько рядов в кольцевых Float64Array: push добавляет отсчёт, copy(key, out) выдаёт ряд от старого к новому, indices — номера отсчётов. Ни один кадр не выделяет память; так же устроены истории DSMC и DG-FV.',
      'HistoryBuffer(keys, capacity) keeps several series in ring Float64Arrays: push adds a sample, copy(key, out) returns a series oldest first, indices numbers the samples. No frame allocates memory; the DSMC and DG-FV histories work the same way.',
    ],
    caveat: ['240 отсчётов, по одному на кадр; скорость — в долях реального времени.', '240 samples, one per frame; speed scales real time.'],
    sources: ['ring'],
  },
];

export function defaults(demo) {
  return Object.fromEntries(demo.controls.map((control) => [control.key, control.value]));
}

export function translate(value, lang = 'ru') {
  return Array.isArray(value) ? value[lang === 'en' ? 1 : 0] : String(value ?? '');
}

export default { groups, sources, demos, defaults, translate };
