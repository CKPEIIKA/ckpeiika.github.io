// Student-facing statements describe the implemented problem, including its
// domain and boundary data. Numerical implementation notes live in docs.
const pair = (ru, en) => ({ ru, en });
const conditions = {
  'pde-field': pair('Периодические края: u(-1)=u(1), uₓ(-1)=uₓ(1). Для волны uₜ(x,0)=0.', 'Periodic ends: u(-1)=u(1), uₓ(-1)=uₓ(1). For the wave, uₜ(x,0)=0.'),
  diffusion: pair('Сверху вниз: поле, его градиент и поток. q направлен против градиента.', 'Top to bottom: field, gradient, and flux. q points against the gradient.'),
  boundaries: pair('Положительная ∂u/∂n добавляет тепло: наружный поток равен −D∂u/∂n.', 'Positive ∂u/∂n adds heat: outward flux is −D∂u/∂n.'),
  wave: pair('Сплошная: смещение сейчас, штриховая: начальное. Ниже: скорость смещения uₜ.', 'Solid: current displacement; dashed: initial displacement. Below: displacement velocity uₜ.'),
  characteristics: pair('Наведите на профиль: жёлтая точка показывает, откуда пришло значение. Внизу x по горизонтали, t вверх. На входе сохраняется крайнее начальное значение.', 'Hover over the profile: yellow marks where its value came from. Below: x horizontally, t upward. Inflow holds the initial endpoint value.'),
  'advection-diffusion': pair('Края соединены. Pe=2V/D: Pe≫1 ⇒ перенос, Pe≪1 ⇒ диффузия.', 'Periodic edges. Pe=2V/D: Pe≫1 ⇒ transport, Pe≪1 ⇒ diffusion.'),
  'vector-calculus': pair('Цвет показывает выбранную производную, стрелки показывают скорость. Нулевая дивергенция не означает отсутствие движения.', 'Color: selected derivative; arrows: velocity. Zero divergence does not mean no motion.'),
  'material-derivative': pair('Красная точка движется вместе с полем. ∂u/∂t измеряется при x=0; Du/Dt вдоль частицы равно нулю.', 'The red point moves with the field. ∂u/∂t is measured at x=0; Du/Dt along the particle is zero.'),
  conservation: pair('M: запас; Q: количество за единицу времени. При опустошении отток ограничен доступным запасом.', 'M: stored amount; Q: amount per unit time. When empty, removal is limited by available storage.'),
  laplace: pair('Времени здесь нет. Рисуйте значения на границе: стационарное поле меняется во всей области.', 'There is no time variable. Paint boundary values: the steady field changes throughout the interior.'),
  classification: pair('Вверху: стационарный профиль с u(−1)=A, u(1)=0. Ниже: диффузия и волна на бесконечной прямой. Показано окно −1≤x≤1.', 'Top: steady profile with u(−1)=A, u(1)=0. Below: diffusion and waves on the infinite line, viewed through −1≤x≤1.'),
  nonlinearity: pair('Края соединены. Характеристики показаны до пересечения; после него многозначный профиль заменяет разрыв.', 'Periodic ends. Characteristics describe the solution until they cross; a discontinuity then replaces the multivalued profile.'),
  riemann: pair('Идеальный газ, γ=1.4; разрыв в x=0. Ползунок времени позволяет рассмотреть волны до выхода из окна.', 'Ideal gas, γ=1.4; initial jump at x=0. Use the time slider to inspect waves before they leave the view.'),
  'shallow-water': pair('Плоское дно; глубина h>0. Внешние стенки отражают волны. Цвет показывает выбранное поле, стрелки показывают скорость воды.', 'Flat bed; wet depth h>0. Outer walls reflect waves. Color: selected field; arrows: water velocity.'),
  incompressibility: pair('Нестационарное течение Стокса в периодической области. Нажмите «Импульс» и проведите по полю; давление устраняет добавленную дивергенцию.', 'Unsteady Stokes flow in a periodic domain. Select “Impulse” and drag: pressure removes the added divergence.'),
  sources: pair('Периодические края: u(-1)=u(1). u: знакопеременное отклонение температуры; S<0 ⇒ охлаждение.', 'Periodic edges: u(-1)=u(1). u is a signed temperature deviation; S<0 ⇒ cooling.'),
  geometry: pair('Диффузия без течения. Стенки и препятствия теплоизолированы: тепло распространяется только по связной части области.', 'Diffusion without flow. Walls and obstacles are insulated: heat spreads only through connected parts of the domain.'),
  'integral-conservation': pair('Деление баланса на размер области даёт среднюю скорость накопления: Ṁ/|Ω| = −(Qout−Qin)/|Ω|+S.', 'Dividing by the region size gives mean accumulation: Ṁ/|Ω| = −(Qout−Qin)/|Ω|+S.'),
};

export function lessonPresentation(model, entry, language) {
  const p = model.parameters;
  let equation = entry.equation;
  if (model.id === 'pde-field') equation = { transport: 'uₜ + cuₓ = 0', diffusion: 'uₜ = Duₓₓ', wave: 'uₜₜ = c²uₓₓ' }[p.mode];
  if (model.id === 'wave') equation = p.source === 'oscillator' ? 'uₜₜ = c(x)²uₓₓ + f(x,t)' : 'uₜₜ = c(x)²uₓₓ';
  if (model.id === 'nonlinearity') equation = p.law === 'linear' ? 'uₜ + 0.6uₓ = 0' : 'uₜ + (u²/2)ₓ = 0';
  if (model.id === 'geometry') equation = 'uₜ = D∇²u · ∂u/∂n = 0';
  if (model.id === 'incompressibility') equation = 'vₜ = −∇p/ρ + ν∇²v · ∇·v = 0';
  if (model.id === 'shallow-water') equation = 'hₜ + ∇·(hv) = 0 · (hv)ₜ + ∇·(hv⊗v + gh²I/2) = 0';
  let detail = conditions[model.id]?.[language] ?? '';
  if (model.id === 'riemann') {
    const names = language === 'ru' ? { shock: 'ударная', fan: 'разрежение', none: 'нет волны' } : { shock: 'shock', fan: 'rarefaction', none: 'no wave' };
    detail += ` L: ${names[model.waveKinds[0]]}; R: ${names[model.waveKinds[1]]}. `;
    if (model.star.vacuum) detail += language === 'ru' ? 'Между волнами: вакуум.' : 'Vacuum between the fans.';
    else detail += language === 'ru' ? 'Жёлтая линия: контакт; красные линии: ударные волны; голубые линии: границы разрежения.' : 'Yellow: contact; red: shocks; blue: rarefaction edges.';
  }
  if (model.id === 'wave' && p.medium === 'two-regions') detail += language === 'ru'
    ? ' Граница сред x=0: непрерывны u и uₓ; натяжение постоянно.' : ' Interface at x=0: u and uₓ are continuous; tension is constant.';
  if (model.id === 'diffusion' || model.id === 'boundaries') {
    const boundary = (side) => {
      const type = p[`${side}Boundary`] ?? p.boundary;
      return type === 'periodic' ? (language === 'ru' ? '↔ периодическая связь' : '↔ periodic')
        : type === 'fixed' ? `u = ${p[`${side}Value`] ?? 0}` : `∂u/∂n = ${p[`${side}Flux`] ?? 0}`;
    };
    detail += ` ${language === 'ru' ? 'Слева' : 'Left'}: ${boundary('left')}; ${language === 'ru' ? 'справа' : 'right'}: ${boundary('right')}.`;
  }
  return { equation, detail };
}

export function controlVisible(id, name, p) {
  if (id === 'pde-field' && name === 'D') return p.mode === 'diffusion';
  if (id === 'pde-field' && name === 'c') return p.mode !== 'diffusion';
  if (id === 'wave' && name === 'c2Ratio') return p.medium === 'two-regions';
  if (id === 'advection-diffusion' && name === 'angle') return p.velocityField === 'uniform';
  if (id === 'boundaries') for (const side of ['left', 'right']) {
    if (name === `${side}Value`) return p[`${side}Boundary`] === 'fixed';
    if (name === `${side}Flux`) return p[`${side}Boundary`] === 'insulated';
  }
  return true;
}
