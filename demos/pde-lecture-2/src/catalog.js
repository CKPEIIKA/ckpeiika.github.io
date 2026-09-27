// Gallery catalog for Lecture 2, generated from the lesson data so it cannot drift from it:
// texts from pde-demos.js, controls from lesson-specs.js, defaults from the models themselves.

import { DERIVATIVE_PRESETS, DerivativeMicroscopeModel } from './derivative-model.js';
import { createLessonModel } from './lesson-models.js';
import { conditions, controlVisible } from './lesson-presentation.js';
import { LESSON_SPECS } from './lesson-specs.js';
import { PDE_DEMOS } from './pde-demos.js';

const pair = (text) => [text.ru, text.en];

export const groups = [['Уравнения в частных производных', 'Partial differential equations']];
export const sources = {};

const CAVEAT = [
  'Величины безразмерные. Кнопки «Попробуйте» восстанавливают исходные задачи.',
  'All quantities are nondimensional. “Try these” restores the original problems.',
];

// Model state with no default in the model (the former page showed these switched on).
const MISSING_DEFAULTS = { showVectors: true };

function lessonControls(id) {
  const model = createLessonModel(id);
  return LESSON_SPECS[id].controls.map((spec) => {
    const value = spec.name === 'time' ? 0 : model.parameters[spec.name] ?? MISSING_DEFAULTS[spec.name];
    const base = { key: spec.name, label: pair(spec.label), help: pair(spec.help) };
    if (spec.type === 'range') return { ...base, type: 'range', value, min: spec.minimum, max: spec.maximum, step: spec.step };
    if (spec.type === 'checkbox') return { ...base, type: 'toggle', value: value !== false };
    return { ...base, type: 'select', value, options: spec.options.map((o) => ({ value: o.value, label: pair(o.label) })) };
  });
}

const DERIVATIVE_NAMES = {
  line: ['Прямая', 'Line'], parabola: ['Парабола', 'Parabola'], gaussian: ['Гауссов профиль', 'Gaussian'],
  sine: ['Синус', 'Sine'], 'smooth-step': ['Плавная ступень', 'Smooth step'], drawing: ['Рисунок', 'Drawing'],
};

function derivativeControls() {
  const p = new DerivativeMicroscopeModel().parameters;
  const range = (key, label, help, min, max, step) => ({ key, label, help, type: 'range', value: p[key], min, max, step });
  return [
    {
      key: 'preset', type: 'select', value: p.preset, label: ['u(x)', 'u(x)'],
      help: ['Форма поля u(x), для которой вычисляются uₓ и uₓₓ.', 'The field shape u(x) whose uₓ and uₓₓ are shown.'],
      options: DERIVATIVE_PRESETS.map((preset) => ({ value: preset.id ?? preset, label: DERIVATIVE_NAMES[preset.id ?? preset] ?? [String(preset.id ?? preset), String(preset.id ?? preset)] })),
    },
    range('amplitude', ['A', 'A'], ['Масштаб поля u.', 'The scale of the field u.'], 0.1, 2, 0.05),
    range('width', ['ℓ', 'ℓ'], ['Характерная длина изменения u.', 'The characteristic length of change in u.'], 0.08, 1, 0.01),
    range('position', ['x₀', 'x₀'], ['Центр профиля.', 'The profile center.'], -1, 1, 0.01),
  ];
}

export const demos = PDE_DEMOS.filter((entry) => entry.hidden !== true).map((entry) => {
  const derivative = entry.id === 'derivatives';
  const spec = LESSON_SPECS[entry.id];
  return Object.freeze({
    id: entry.id,
    group: 0,
    dynamic: !derivative && entry.id !== 'laplace',
    title: pair(entry.title),
    short: pair(entry.meaning),
    equation: entry.equation,
    question: pair(entry.prompt),
    explanation: derivative
      ? ['Три графика: поле u, наклон uₓ и изменение наклона uₓₓ в одних и тех же точках x.', 'Three plots: the field u, its slope uₓ and the change of slope uₓₓ at the same points x.']
      : pair(conditions[entry.id]),
    caveat: CAVEAT,
    sources: [],
    controls: derivative ? derivativeControls() : lessonControls(entry.id),
    // Named initial states of the model ("Режим" in the former page).
    presets: derivative ? [] : spec.presets.map((option) => ({ label: pair(option.label), values: { preset: option.value } })),
    visible: (key, params) => controlVisible(entry.id, key, params),
  });
});

export function defaults(demo) {
  return Object.fromEntries(demo.controls.map((control) => [control.key, control.value]));
}

export function translate(value, lang = 'ru') {
  return Array.isArray(value) ? value[lang === 'en' ? 1 : 0] : String(value ?? '');
}

export default { groups, sources, demos, defaults, translate };
