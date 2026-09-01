const text = (ru, en) => Object.freeze({ ru, en });

export const PDE_DEMOS = Object.freeze([
  {
    id: 'derivatives',
    todo: 16,
    available: true,
    title: text('Производные поля', 'Derivative microscope'),
    equation: 'u(x),   uₓ,   uₓₓ',
    meaning: text(
      'Локальный наклон поля и изменение самого наклона.',
      'The local slope of a field and the change of that slope.',
    ),
    prompt: text(
      'Почему в вершине гладкого максимума uₓ = 0, но uₓₓ < 0?',
      'Why is uₓ = 0 but uₓₓ < 0 at a smooth maximum?',
    ),
    controls: text('форма, амплитуда, ширина, положение', 'shape, amplitude, width, position'),
  },
  {
    id: 'pde-field', todo: 1,
    title: text('Что задаёт УЧП?', 'What does a PDE determine?'),
    equation: 'uₜ + cuₓ = 0   |   uₜ = Duₓₓ   |   uₜₜ = c²uₓₓ',
    meaning: text('Одно начальное поле подчиняется трём разным законам изменения.', 'One initial field follows three different laws of change.'),
    prompt: text('Что меняется: положение, ширина, амплитуда или форма?', 'What changes: position, width, amplitude, or shape?'),
    controls: text('начальная форма, амплитуда, ширина, положение', 'initial shape, amplitude, width, position'),
  },
  {
    id: 'diffusion', todo: 2,
    title: text('Диффузия', 'Diffusion'), equation: 'uₜ = D∇²u',
    meaning: text('Поток направлен против градиента, поэтому неоднородности сглаживаются.', 'Flux opposes the gradient, so nonuniformities are smoothed.'),
    prompt: text('Почему узкий максимум исчезает быстрее широкого?', 'Why does a narrow maximum disappear faster than a broad one?'),
    controls: text('D, начальное поле, границы, градиент и поток', 'D, initial field, boundaries, gradient, and flux'),
  },
  {
    id: 'boundaries', todo: 3,
    title: text('Граничные условия', 'Boundary conditions'), equation: 'uₜ = D∇²u',
    meaning: text('На границе задают значение поля либо его нормальный поток.', 'A boundary prescribes either the field value or its normal flux.'),
    prompt: text('Что задано на каждой стенке: значение или поток?', 'What is prescribed at each wall: value or flux?'),
    controls: text('левая и правая границы, u_b, ∂u/∂n', 'left and right boundaries, u_b, ∂u/∂n'),
  },
  {
    id: 'wave', todo: 4,
    title: text('Волновое уравнение', 'Wave equation'), equation: 'uₜₜ = c²∇²u',
    meaning: text('Возмущение распространяется с конечной скоростью и отражается от границ.', 'A disturbance propagates at finite speed and reflects from boundaries.'),
    prompt: text('Чем различаются начальное смещение и начальная скорость?', 'How do initial displacement and initial velocity differ?'),
    controls: text('c, смещение, скорость, источник, границы', 'c, displacement, velocity, source, boundaries'),
  },
  {
    id: 'characteristics', todo: 5,
    title: text('Характеристики', 'Characteristics'), equation: 'uₜ + a(x)uₓ = 0',
    meaning: text('Характеристики показывают путь информации в пространстве-времени.', 'Characteristics trace information through spacetime.'),
    prompt: text('Из какой точки начального профиля пришло выбранное значение?', 'Where on the initial profile did the selected value originate?'),
    controls: text('скорость переноса, направление, профиль a(x)', 'transport speed, direction, a(x) profile'),
  },
  {
    id: 'advection-diffusion', todo: 6,
    title: text('Перенос и диффузия', 'Advection and diffusion'), equation: 'uₜ + v·∇u = D∇²u',
    meaning: text('Перенос перемещает поле, диффузия сглаживает его.', 'Advection moves the field; diffusion smooths it.'),
    prompt: text('При каком Pe начинает преобладать сглаживание?', 'At what Pe does smoothing begin to dominate?'),
    controls: text('|v|, направление, D, поле скорости, начальное пятно', '|v|, direction, D, velocity field, initial patch'),
  },
  {
    id: 'vector-calculus', todo: 17,
    title: text('Дивергенция и ротор', 'Divergence and curl'), equation: '∇·v,   ∇×v',
    meaning: text('Дивергенция измеряет локальное расширение, ротор — локальное вращение.', 'Divergence measures local expansion; curl measures local rotation.'),
    prompt: text('Где поле расширяется, сжимается и вращается?', 'Where does the field expand, contract, and rotate?'),
    controls: text('источник, сток, вихрь, сдвиг, точка измерения', 'source, sink, vortex, shear, probe point'),
  },
  {
    id: 'material-derivative', todo: 18,
    title: text('Материальная производная', 'Material derivative'), equation: 'Du/Dt = uₜ + v·∇u',
    meaning: text('Изменение в фиксированной точке отличается от изменения вдоль траектории частицы.', 'Change at a fixed point differs from change along a particle path.'),
    prompt: text('Почему частица может видеть постоянное u, когда uₜ ≠ 0?', 'Why can a particle observe constant u while uₜ ≠ 0?'),
    controls: text('скорость, поле, неподвижный наблюдатель, движущаяся частица', 'velocity, field, fixed observer, moving particle'),
  },
  {
    id: 'conservation', todo: 7,
    title: text('Закон сохранения', 'Conservation law'), equation: 'uₜ + ∇·F = S',
    meaning: text('Накопление равно притоку минус отток плюс источники.', 'Accumulation equals inflow minus outflow plus sources.'),
    prompt: text('Согласуется ли изменение запаса с потоками через границу?', 'Does the stored amount agree with boundary fluxes?'),
    controls: text('приток, отток, источник, положение и размер объёма', 'inflow, outflow, source, volume position and size'),
  },
  {
    id: 'laplace', todo: 8,
    title: text('Уравнение Лапласа', 'Laplace equation'), equation: '∇²φ = 0',
    meaning: text('Поле удовлетворяет пространственному ограничению сразу во всей области.', 'The field satisfies a spatial constraint throughout the domain.'),
    prompt: text('Почему изменение малого участка границы влияет на всю область?', 'Why does changing a small boundary segment affect the whole domain?'),
    controls: text('граничные значения, проводники, препятствия, линии уровня', 'boundary values, conductors, obstacles, contours'),
  },
  {
    id: 'classification', todo: 9,
    title: text('Три типа УЧП', 'Three PDE families'), equation: '∇²u=0   |   uₜ=D∇²u   |   uₜₜ=c²∇²u',
    meaning: text('Эллиптические, параболические и гиперболические уравнения узнаются по поведению решений.', 'Elliptic, parabolic, and hyperbolic equations can be recognized by solution behavior.'),
    prompt: text('Где есть сглаживание и где возмущение распространяется с конечной скоростью?', 'Where is there smoothing, and where does a disturbance propagate at finite speed?'),
    controls: text('возмущение, границы, D или c', 'disturbance, boundaries, D or c'),
  },
  {
    id: 'nonlinearity', todo: 10,
    title: text('Нелинейный перенос', 'Nonlinear transport'), equation: 'uₜ + uuₓ = 0',
    meaning: text('Разные части профиля движутся с разными скоростями.', 'Different parts of the profile move at different speeds.'),
    prompt: text('Когда гладкий профиль начинает опрокидываться?', 'When does a smooth profile begin to overturn?'),
    controls: text('форма, амплитуда, линейный или нелинейный закон', 'shape, amplitude, linear or nonlinear law'),
  },
  {
    id: 'riemann', todo: 11,
    title: text('Задача Римана для уравнений Эйлера', 'Euler Riemann problem'), equation: 'Uₜ + F(U)ₓ = 0',
    meaning: text('Один начальный разрыв распадается на ударную волну, контактный разрыв и волну разрежения.', 'One initial jump separates into a shock, contact discontinuity, and rarefaction.'),
    prompt: text('Какие волны меняют давление, скорость и плотность?', 'Which waves change pressure, velocity, and density?'),
    controls: text('ρ_L, u_L, p_L, ρ_R, u_R, p_R, время', 'ρ_L, u_L, p_L, ρ_R, u_R, p_R, time'),
  },
  {
    id: 'shallow-water', todo: 12,
    title: text('Связанная система: мелкая вода', 'Coupled system: shallow water'), equation: 'hₜ + ∇·(hu)=0,   (hu)ₜ + … = 0',
    meaning: text('Высота слоя и скорость изменяют друг друга.', 'Water depth and velocity change one another.'),
    prompt: text('Как возмущение высоты порождает движение воды?', 'How does a height disturbance generate water motion?'),
    controls: text('высота, начальная скорость, g, препятствие, возмущение', 'height, initial velocity, g, obstacle, disturbance'),
  },
  {
    id: 'incompressibility', todo: 13,
    title: text('Несжимаемость и давление', 'Incompressibility and pressure'), equation: '∇·u = 0',
    meaning: text('Давление согласует поле скорости с условием несжимаемости.', 'Pressure reconciles the velocity field with incompressibility.'),
    prompt: text('Как меняется давление после локального возмущения скорости?', 'How does pressure respond to a local velocity perturbation?'),
    controls: text('импульс, вязкость, препятствие, скорость входа, отображаемое поле', 'momentum impulse, viscosity, obstacle, inflow speed, displayed field'),
  },
  {
    id: 'sources', todo: 15,
    title: text('Источники и стоки', 'Sources and sinks'), equation: 'uₜ + v·∇u = D∇²u + S',
    meaning: text('Источник создаёт или уничтожает величину локально, а перенос и диффузия перераспределяют её.', 'A source creates or destroys a quantity locally; transport and diffusion redistribute it.'),
    prompt: text('Как отличить локальное производство от переноса?', 'How can local production be distinguished from transport?'),
    controls: text('положение, мощность и радиус источника, v, D', 'source position, strength and radius, v, D'),
  },
  {
    id: 'geometry', todo: 14,
    title: text('Роль геометрии', 'Geometry matters'), equation: 'УЧП + НУ + ГУ + область',
    meaning: text('Форма области меняет градиенты, линии тока и след за препятствием.', 'Domain shape changes gradients, streamlines, and obstacle wakes.'),
    prompt: text('Что изменилось, если уравнение и параметры остались прежними?', 'What changed when the equation and parameters stayed the same?'),
    controls: text('форма и положение препятствия, сужение канала', 'obstacle shape and position, channel contraction'),
  },
  {
    id: 'integral-conservation', todo: 19,
    title: text('От интегрального закона к локальному', 'Integral to differential conservation'),
    equation: 'd/dt ∫Ωu dV = −∫∂ΩF·n dS + ∫ΩS dV',
    meaning: text('Локальное уравнение возникает при рассмотрении всё меньшего контрольного объёма.', 'The local equation emerges as the control volume becomes smaller.'),
    prompt: text('Что сохраняется при уменьшении контрольного объёма?', 'What remains invariant as the control volume shrinks?'),
    controls: text('размер и положение контрольного объёма, поток, источник', 'control-volume size and position, flux, source'),
  },
].map((entry) => Object.freeze({ ...entry, available: true })));

export function findPdeDemo(id) {
  return PDE_DEMOS.find((entry) => entry.id === id) ?? null;
}

export function localized(value, language) {
  return value?.[language] ?? value?.ru ?? String(value ?? '');
}
