const text = (ru, en) => Object.freeze({ ru, en });
const option = (value, ru, en) => Object.freeze({ value, label: text(ru, en) });
const range = (name, ru, en, helpRu, helpEn, minimum, maximum, step) => Object.freeze({
  type: 'range', name, label: text(ru, en), help: text(helpRu, helpEn), minimum, maximum, step,
});
const select = (name, ru, en, helpRu, helpEn, options) => Object.freeze({
  type: 'select', name, label: text(ru, en), help: text(helpRu, helpEn), options,
});
const checkbox = (name, ru, en, helpRu, helpEn) => Object.freeze({
  type: 'checkbox', name, label: text(ru, en), help: text(helpRu, helpEn),
});

const boundaryOptions = [
  option('fixed', 'заданное значение', 'fixed value'),
  option('insulated', 'нулевой поток', 'zero flux'),
  option('periodic', 'периодическая связь', 'periodic'),
];
const profilePresets = [
  option('default', 'гауссов профиль', 'Gaussian'),
  option('step', 'ступень', 'step'),
  option('sine', 'синус', 'sine'),
  option('drawing', 'рисунок', 'drawing'),
];

export const LESSON_SPECS = Object.freeze({
  'pde-field': {
    presets: profilePresets,
    paint: true,
    controls: [
      select('mode', 'Уравнение', 'Equation', 'Закон, по которому изменяется одно и то же поле.', 'The law that evolves the same field.', [
        option('transport', 'перенос', 'transport'), option('diffusion', 'диффузия', 'diffusion'), option('wave', 'волна', 'wave'),
      ]),
      range('amplitude', 'Амплитуда', 'Amplitude', 'Начальная величина возмущения.', 'Initial disturbance magnitude.', 0.1, 1.8, 0.05),
      range('width', 'Ширина', 'Width', 'Характерный размер начального возмущения.', 'Characteristic width of the initial disturbance.', 0.06, 0.5, 0.01),
      range('c', 'Скорость c', 'Speed c', 'Скорость переноса или распространения волны.', 'Transport or wave propagation speed.', 0.1, 1.4, 0.05),
      range('D', 'Коэффициент D', 'Diffusivity D', 'Интенсивность диффузионного сглаживания.', 'Strength of diffusive smoothing.', 0.005, 0.2, 0.005),
    ],
  },
  diffusion: {
    presets: [option('default', 'горячее пятно', 'hot spot'), option('two', 'два пятна', 'two hot spots'), option('step', 'ступень', 'step'), option('noise', 'случайные неоднородности', 'random variations'), option('drawing', 'рисунок', 'drawing')],
    paint: true,
    controls: [
      range('D', 'Коэффициент D', 'Diffusivity D', 'Связывает поток с градиентом: q = −D∂u/∂x.', 'Relates flux to gradient: q = −D∂u/∂x.', 0.005, 0.2, 0.005),
      select('boundary', 'Границы', 'Boundaries', 'Определяют обмен величиной с внешней средой.', 'Determine exchange with the surroundings.', boundaryOptions),
      range('amplitude', 'Наносимое значение', 'Paint value', 'Значение поля, задаваемое указателем.', 'Field value deposited by the pointer.', -1, 2, 0.05),
    ],
  },
  boundaries: {
    presets: [option('cold-walls', 'холодные стенки', 'cold walls'), option('insulated', 'изолированная область', 'insulated box'), option('periodic', 'периодическая область', 'periodic universe'), option('hot-cold', 'горячая слева, холодная справа', 'hot left / cold right')],
    controls: [
      range('D', 'Коэффициент D', 'Diffusivity D', 'Определяет скорость выравнивания поля.', 'Controls the rate of equalization.', 0.005, 0.2, 0.005),
      select('leftBoundary', 'Левая граница', 'Left boundary', 'Задаёт значение поля или его нормальную производную.', 'Prescribes the field value or normal derivative.', boundaryOptions),
      range('leftValue', 'Значение слева', 'Left value', 'Используется при заданном значении поля.', 'Used for a fixed field value.', -1, 2, 0.05),
      range('leftFlux', 'Поток слева', 'Left flux', 'Нормальная производная на левой границе.', 'Normal derivative at the left boundary.', -1, 1, 0.05),
      select('rightBoundary', 'Правая граница', 'Right boundary', 'Задаёт значение поля или его нормальную производную.', 'Prescribes the field value or normal derivative.', boundaryOptions),
      range('rightValue', 'Значение справа', 'Right value', 'Используется при заданном значении поля.', 'Used for a fixed field value.', -1, 2, 0.05),
      range('rightFlux', 'Поток справа', 'Right flux', 'Нормальная производная на правой границе.', 'Normal derivative at the right boundary.', -1, 1, 0.05),
    ],
  },
  wave: {
    presets: [option('default', 'разделение импульса', 'splitting pulse'), option('fixed-reflection', 'отражение от закреплённой границы', 'fixed-wall reflection'), option('free-reflection', 'отражение от свободной границы', 'free-wall reflection'), option('standing', 'стоячая волна', 'standing wave'), option('interference', 'интерференция', 'interference'), option('heterogeneous', 'две среды', 'two media')],
    paint: true,
    controls: [
      range('c', 'Скорость c', 'Wave speed c', 'Скорость распространения возмущения в первой области.', 'Propagation speed in the first region.', 0.2, 1.4, 0.05),
      range('c2Ratio', 'Отношение c₂/c₁', 'Ratio c₂/c₁', 'Изменяет скорость волны справа от границы сред.', 'Changes wave speed to the right of the material interface.', 0.25, 1.75, 0.05),
      range('initialVelocity', 'Начальная скорость uₜ', 'Initial velocity uₜ', 'Второе независимое начальное условие волнового уравнения.', 'The second independent initial condition for the wave equation.', -1, 1, 0.05),
      select('boundary', 'Граница', 'Boundary', 'Определяет характер отражения или выхода волны.', 'Controls reflection or wave exit.', [option('fixed', 'закреплённая', 'fixed'), option('free', 'свободная', 'free'), option('absorbing', 'поглощающая', 'absorbing')]),
      select('source', 'Источник', 'Source', 'Однократное возмущение или периодическое возбуждение.', 'A single disturbance or periodic forcing.', [option('pulse', 'один импульс', 'one pulse'), option('oscillator', 'периодический осциллятор', 'periodic oscillator')]),
    ],
  },
  characteristics: {
    presets: [option('constant', 'постоянная скорость', 'constant speed'), option('increasing', 'скорость растёт вправо', 'speed increases rightward'), option('decreasing', 'скорость убывает вправо', 'speed decreases rightward')],
    controls: [
      range('speed', 'Скорость переноса', 'Transport speed', 'Задаёт наклон характеристик при постоянном поле.', 'Sets characteristic slope for a constant field.', -1.2, 1.2, 0.05),
      select('field', 'Поле a(x)', 'Field a(x)', 'Пространственная зависимость скорости искривляет характеристики.', 'Spatially varying speed bends characteristics.', [option('constant', 'постоянное', 'constant'), option('increasing', 'возрастающее', 'increasing'), option('decreasing', 'убывающее', 'decreasing')]),
      range('amplitude', 'Амплитуда профиля', 'Profile amplitude', 'Значение, переносимое вдоль характеристики.', 'Value carried along a characteristic.', 0.1, 1.5, 0.05),
    ],
  },
  'advection-diffusion': {
    presets: [option('pure-advection', 'чистый перенос', 'pure advection'), option('pure-diffusion', 'чистая диффузия', 'pure diffusion'), option('weak-diffusion', 'слабая диффузия', 'weak diffusion'), option('strong-diffusion', 'сильная диффузия', 'strong diffusion'), option('rotation', 'вращение пятна', 'rotating scalar'), option('shear', 'сдвиговая деформация', 'shear deformation')],
    paint: true,
    controls: [
      range('speed', 'Скорость V', 'Speed V', 'Модуль поля скорости.', 'Magnitude of the velocity field.', 0, 1.2, 0.05),
      range('angle', 'Направление θ', 'Direction θ', 'Угол однородного потока в радианах.', 'Angle of uniform flow in radians.', -3.14, 3.14, 0.05),
      range('D', 'Коэффициент D', 'Diffusivity D', 'Интенсивность сглаживания скаляра.', 'Strength of scalar smoothing.', 0, 0.03, 0.001),
      select('velocityField', 'Поле скорости', 'Velocity field', 'Определяет траектории переноса.', 'Determines transport paths.', [option('uniform', 'однородное', 'uniform'), option('rotation', 'вращение', 'rotation'), option('shear', 'сдвиг', 'shear'), option('vortex', 'вихрь', 'vortex')]),
      checkbox('showVectors', 'Векторы скорости', 'Velocity vectors', 'Показывает направление и относительную величину скорости.', 'Shows velocity direction and relative magnitude.'),
      checkbox('showParticles', 'Меченые частицы', 'Tracer particles', 'Показывает движение отдельных точек вместе с полем.', 'Shows individual tracers moving with the field.'),
    ],
  },
  'vector-calculus': {
    presets: [option('uniform', 'однородный поток', 'uniform flow'), option('source', 'источник', 'source'), option('sink', 'сток', 'sink'), option('vortex', 'вихрь', 'vortex'), option('shear', 'сдвиг', 'shear'), option('source-vortex', 'источник и вихрь', 'source + vortex')],
    controls: [
      select('field', 'Векторное поле', 'Vector field', 'Задаёт локальное расширение и вращение.', 'Sets local expansion and rotation.', [option('uniform', 'однородное', 'uniform'), option('source', 'источник', 'source'), option('sink', 'сток', 'sink'), option('vortex', 'вихрь', 'vortex'), option('shear', 'сдвиг', 'shear'), option('source-vortex', 'источник и вихрь', 'source + vortex')]),
      select('display', 'Цветовое поле', 'Color field', 'Выбирает дивергенцию или ротор.', 'Selects divergence or curl.', [option('divergence', 'дивергенция', 'divergence'), option('curl', 'ротор', 'curl')]),
      range('strength', 'Интенсивность', 'Strength', 'Масштаб скорости выбранного поля.', 'Velocity scale of the selected field.', 0.1, 1.2, 0.05),
      checkbox('showParticles', 'Меченые частицы', 'Tracer particles', 'Показывает движение точек в поле скорости.', 'Shows tracer motion in the velocity field.'),
    ],
  },
  'material-derivative': {
    presets: [option('default', 'бегущая волна', 'travelling wave'), option('sine', 'синусоидальное поле', 'sinusoidal field')],
    controls: [
      range('velocity', 'Скорость V', 'Velocity V', 'Скорость поля и отмеченной частицы.', 'Speed of the field and marked particle.', -1, 1, 0.05),
      range('amplitude', 'Амплитуда', 'Amplitude', 'Величина переносимого поля.', 'Magnitude of the transported field.', 0.1, 1.5, 0.05),
      range('wavelength', 'Длина волны', 'Wavelength', 'Пространственный период поля.', 'Spatial period of the field.', 0.3, 1.5, 0.05),
    ],
  },
  conservation: {
    presets: [option('balanced', 'стационарный запас', 'steady storage'), option('filling', 'накопление', 'filling'), option('draining', 'опустошение', 'draining'), option('source', 'внутренний источник', 'internal source'), option('sink', 'внутренний сток', 'internal sink')],
    controls: [
      range('inflow', 'Приток', 'Inflow', 'Количество, входящее через границу за единицу времени.', 'Amount entering through the boundary per unit time.', 0, 2, 0.05),
      range('outflow', 'Отток', 'Outflow', 'Количество, выходящее через границу за единицу времени.', 'Amount leaving through the boundary per unit time.', 0, 2, 0.05),
      range('source', 'Источник S', 'Source S', 'Локальное производство; отрицательное значение означает сток.', 'Local production; a negative value is a sink.', -1, 1, 0.05),
      select('interpretation', 'Сохраняемая величина', 'Stored quantity', 'Один баланс применим к массе, теплу и пассивной примеси.', 'The same balance applies to mass, heat, and passive scalar.', [option('mass', 'масса', 'mass'), option('heat', 'тепло', 'heat'), option('scalar', 'пассивная примесь', 'passive scalar')]),
    ],
  },
  laplace: {
    presets: [option('hot-cold', 'горячая слева, холодная справа', 'hot left / cold right'), option('point-electrode', 'малый электрод', 'point electrode'), option('two-electrodes', 'два электрода', 'two electrodes'), option('cold-walls', 'нулевые границы', 'zero boundaries')],
    paint: true,
    controls: [
      range('brushValue', 'Граничное значение', 'Boundary value', 'Значение φ, наносимое на ближайший участок границы.', 'Value of φ painted on the nearest boundary segment.', -1, 1, 0.05),
      checkbox('showVectors', 'Поле −∇φ', 'Field −∇φ', 'Показывает направление наиболее быстрого убывания потенциала.', 'Shows the direction of fastest potential decrease.'),
    ],
  },
  classification: {
    presets: [option('default', 'локальное возмущение', 'localized disturbance'), option('sine', 'синусоидальное возмущение', 'sinusoidal disturbance')],
    controls: [
      range('D', 'Коэффициент D', 'Diffusivity D', 'Определяет скорость параболического сглаживания.', 'Controls parabolic smoothing rate.', 0.005, 0.2, 0.005),
      range('c', 'Скорость c', 'Wave speed c', 'Определяет скорость гиперболического распространения.', 'Controls hyperbolic propagation speed.', 0.2, 1.4, 0.05),
      range('amplitude', 'Возмущение', 'Disturbance', 'Амплитуда сравниваемого начального поля.', 'Amplitude of the compared initial field.', 0.1, 1.5, 0.05),
    ],
  },
  nonlinearity: {
    presets: [option('default', 'гладкий максимум', 'smooth hump'), option('step', 'ступень', 'step'), option('rarefaction', 'разбегание', 'rarefaction')],
    controls: [
      select('law', 'Закон переноса', 'Transport law', 'При нелинейном законе локальная скорость равна u.', 'For nonlinear transport, local speed equals u.', [option('linear', 'линейный: uₜ + cuₓ = 0', 'linear: uₜ + cuₓ = 0'), option('nonlinear', 'нелинейный: uₜ + uuₓ = 0', 'nonlinear: uₜ + uuₓ = 0')]),
      range('amplitude', 'Амплитуда', 'Amplitude', 'Разброс локальных скоростей в нелинейном случае.', 'Spread of local speeds in the nonlinear case.', -1.2, 1.2, 0.05),
      range('width', 'Ширина профиля', 'Profile width', 'Характерный пространственный размер начальных данных.', 'Characteristic spatial scale of the initial data.', 0.08, 0.5, 0.01),
    ],
  },
  riemann: {
    presets: [option('sod', 'задача Сода', 'Sod'), option('collision', 'симметричное столкновение', 'symmetric collision'), option('expansion', 'симметричное расширение', 'expansion'), option('strong-shock', 'сильная ударная волна', 'strong shock'), option('contact', 'только контактный разрыв', 'contact only')],
    controls: [
      range('rhoL', 'ρ слева', 'ρ left', 'Начальная плотность слева от разрыва.', 'Initial density left of the discontinuity.', 0.05, 2, 0.05),
      range('uL', 'u слева', 'u left', 'Начальная скорость слева от разрыва.', 'Initial velocity left of the discontinuity.', -2, 2, 0.05),
      range('pL', 'p слева', 'p left', 'Начальное давление слева от разрыва.', 'Initial pressure left of the discontinuity.', 0.02, 5, 0.02),
      range('rhoR', 'ρ справа', 'ρ right', 'Начальная плотность справа от разрыва.', 'Initial density right of the discontinuity.', 0.05, 2, 0.05),
      range('uR', 'u справа', 'u right', 'Начальная скорость справа от разрыва.', 'Initial velocity right of the discontinuity.', -2, 2, 0.05),
      range('pR', 'p справа', 'p right', 'Начальное давление справа от разрыва.', 'Initial pressure right of the discontinuity.', 0.02, 5, 0.02),
    ],
  },
  'shallow-water': {
    presets: [option('drop', 'падение столба воды', 'dropped water column'), option('dam-break', 'разрушение плотины', 'dam break'), option('circular', 'круговая волна', 'circular wave'), option('counterflow', 'встречные потоки', 'counterflow')],
    controls: [
      range('amplitude', 'Начальная высота', 'Initial height', 'Высота начального возмущения свободной поверхности.', 'Height of the initial free-surface disturbance.', 0.05, 0.8, 0.05),
      range('gravity', 'Ускорение g', 'Gravity g', 'Определяет скорость длинных волн.', 'Controls long-wave speed.', 0.2, 2, 0.05),
      range('initialVelocity', 'Начальная скорость', 'Initial velocity', 'Начальное горизонтальное движение слоя.', 'Initial horizontal motion of the layer.', -0.6, 0.6, 0.05),
      select('obstacle', 'Препятствие', 'Obstacle', 'Меняет область, в которой движется вода.', 'Changes the domain in which water moves.', [option('none', 'нет', 'none'), option('circle', 'круг', 'circle')]),
      select('display', 'Отображаемое поле', 'Displayed field', 'Переключает высоту и модуль скорости.', 'Switches between height and speed.', [option('height', 'высота h', 'height h'), option('speed', 'скорость |u|', 'speed |u|')]),
    ],
  },
  incompressibility: {
    presets: [option('channel', 'однородный поток', 'uniform channel flow'), option('vortex', 'локальный импульс', 'local impulse')],
    inject: true,
    controls: [
      range('viscosity', 'Вязкость ν', 'Viscosity ν', 'Ослабляет мелкомасштабные неоднородности скорости.', 'Damps small-scale velocity variations.', 0, 0.08, 0.002),
      range('inflow', 'Скорость на входе', 'Inflow speed', 'Задаёт движение жидкости у левой границы.', 'Prescribes fluid motion at the left boundary.', 0, 1, 0.05),
      select('display', 'Отображаемое поле', 'Displayed field', 'Показывает скорость, давление или остаточную дивергенцию.', 'Shows speed, pressure, or residual divergence.', [option('velocity', 'скорость', 'velocity'), option('pressure', 'давление', 'pressure'), option('divergence', 'дивергенция', 'divergence')]),
      checkbox('showVectors', 'Векторы скорости', 'Velocity vectors', 'Показывает направление течения.', 'Shows flow direction.'),
    ],
  },
  sources: {
    presets: [option('smoke', 'дым в ветре', 'smoke in wind'), option('heated', 'нагреваемое пятно', 'heated spot'), option('pulsed', 'импульсный источник', 'pulsed source'), option('source-sink', 'сток', 'sink')],
    paint: true,
    controls: [
      range('sourceX', 'Положение источника x', 'Source position x', 'Горизонтальная координата локального производства.', 'Horizontal coordinate of local production.', -0.8, 0.8, 0.05),
      range('sourceY', 'Положение источника y', 'Source position y', 'Вертикальная координата локального производства.', 'Vertical coordinate of local production.', -0.45, 0.45, 0.05),
      range('sourceStrength', 'Мощность S', 'Source strength S', 'Положительное значение создаёт поле, отрицательное уничтожает.', 'Positive values create the field; negative values destroy it.', -1.5, 1.5, 0.05),
      range('sourceRadius', 'Радиус источника', 'Source radius', 'Размер области локального производства.', 'Size of the local production region.', 0.04, 0.3, 0.01),
      range('speed', 'Скорость переноса', 'Transport speed', 'Скорость фонового потока.', 'Background-flow speed.', 0, 1, 0.05),
      range('D', 'Коэффициент D', 'Diffusivity D', 'Интенсивность диффузионного рассеивания.', 'Strength of diffusive spreading.', 0, 0.03, 0.001),
    ],
  },
  geometry: {
    presets: [option('none', 'без препятствия', 'no obstacle'), option('circle', 'круг', 'circle'), option('square', 'квадрат', 'square'), option('two-cylinders', 'два цилиндра', 'two cylinders'), option('narrowing', 'сужение канала', 'narrowing channel')],
    paint: true,
    controls: [
      select('geometry', 'Форма области', 'Domain geometry', 'Препятствие входит в математическую постановку задачи.', 'The obstacle is part of the mathematical problem.', [option('none', 'без препятствия', 'none'), option('circle', 'круг', 'circle'), option('square', 'квадрат', 'square'), option('two-cylinders', 'два цилиндра', 'two cylinders'), option('narrowing', 'сужение', 'narrowing')]),
      range('obstacleX', 'Положение x', 'Position x', 'Горизонтальная координата препятствия.', 'Horizontal obstacle coordinate.', -0.6, 0.6, 0.05),
      range('obstacleY', 'Положение y', 'Position y', 'Вертикальная координата препятствия.', 'Vertical obstacle coordinate.', -0.3, 0.3, 0.05),
      range('speed', 'Скорость потока', 'Flow speed', 'Скорость одного и того же потока для разных областей.', 'Speed of the same flow in different domains.', 0.1, 1, 0.05),
      range('D', 'Коэффициент D', 'Diffusivity D', 'Сглаживание переносимого поля.', 'Smoothing of the transported field.', 0, 0.02, 0.001),
    ],
  },
  'integral-conservation': {
    presets: [option('balanced', 'равновесный баланс', 'balanced'), option('filling', 'накопление', 'accumulation'), option('source', 'распределённый источник', 'distributed source')],
    controls: [
      range('size', 'Размер объёма', 'Control-volume size', 'Уменьшает область, к которой применён интегральный баланс.', 'Shrinks the region used by the integral balance.', 0.08, 0.9, 0.02),
      range('position', 'Положение объёма', 'Volume position', 'Перемещает контрольную область.', 'Moves the control region.', -0.5, 0.5, 0.05),
      range('inflow', 'Поток на входе', 'Flux in', 'Интеграл входящего потока по границе.', 'Integral of incoming flux over the boundary.', 0, 2, 0.05),
      range('outflow', 'Поток на выходе', 'Flux out', 'Интеграл выходящего потока по границе.', 'Integral of outgoing flux over the boundary.', 0, 2, 0.05),
      range('source', 'Объёмный источник S', 'Volume source S', 'Производство величины внутри контрольного объёма.', 'Production inside the control volume.', -1, 1, 0.05),
    ],
  },
});

export function localizedSpec(value, language) {
  return value?.[language] ?? value?.ru ?? String(value ?? '');
}

export function lessonSpec(id) {
  const spec = LESSON_SPECS[id];
  if (!spec) throw new RangeError(`no lesson controls for ${id}`);
  return spec;
}
