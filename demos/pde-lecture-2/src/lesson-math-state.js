function number(value, digits = 2) {
  const parsed = Number(value);
  if (parsed === 0) return '0';
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '?';
}

function signed(value, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '?';
  return `${parsed >= 0 ? '+' : ''}${parsed.toFixed(digits)}`;
}

function profile(parameters) {
  return `u₀: A=${number(parameters.amplitude)}, ℓ=${number(parameters.width)}, x₀=${signed(parameters.position)}`;
}

function boundaryCondition(parameters, side) {
  const coordinate = side === 'left' ? '-1' : '1';
  const boundary = parameters[`${side}Boundary`];
  if (boundary === 'fixed') {
    return `u(${coordinate})=${number(parameters[`${side}Value`])}`;
  }
  if (boundary === 'periodic') return 'u(-1)=u(1), uₓ(-1)=uₓ(1)';
  return `(∂u/∂n)|x=${coordinate}=${number(parameters[`${side}Flux`])}`;
}

function waveForcing(source) {
  return source === 'oscillator'
    ? 'f_i(t)=6 sin(7t)·δ_{i,i_c}'
    : 'f(x,t)=0';
}

const NOTATION = Object.freeze({
  boundary: Object.freeze({
    fixed: 'u(-1,t)=u(1,t)=0',
    flux: '(∂u/∂n)|∂Ω=0',
    insulated: '(∂u/∂n)|∂Ω=0',
    periodic: 'u(-1)=u(1), uₓ(-1)=uₓ(1)',
    free: '(∂u/∂n)|∂Ω=0',
    absorbing: 'uₜ±cuₓ=0',
  }),
  mode: Object.freeze({
    transport: 'uₜ+c uₓ=0',
    diffusion: 'uₜ−D uₓₓ=0',
    wave: 'uₜₜ−c²uₓₓ=0',
  }),
  diffusionBoundary: Object.freeze({
    fixed: 'u(-1)=u(1)=0',
    insulated: '(∂u/∂n)|∂Ω=0',
    periodic: 'u(-1)=u(1), uₓ(-1)=uₓ(1)',
  }),
  waveBoundary: Object.freeze({
    fixed: 'u(-1,t)=u(1,t)=0',
    free: '(∂u/∂n)|∂Ω=0',
    absorbing: 'uₜ±cuₓ=0',
  }),
  characteristics: Object.freeze({
    constant: 'a(x)=const',
    increasing: "a'(x)>0",
    decreasing: "a'(x)<0",
  }),
  velocity: Object.freeze({
    uniform: 'v(x,y)=v₀',
    rotation: 'v=Ω×r',
    shear: 'v=(γy,0)',
    vortex: 'v=Γ(-y,x)/r²',
  }),
  vectorField: Object.freeze({
    uniform: 'v=const',
    source: '∇·v>0',
    sink: '∇·v<0',
    vortex: '∇×v≠0',
    shear: '∂v/∂x≠0',
    'source-vortex': '∇·v>0, ∇×v≠0',
  }),
  display: Object.freeze({
    divergence: '∇·v',
    curl: '∇×v',
    velocity: '|v|',
    pressure: 'p',
    height: 'h',
    speed: '|v|',
  }),
  observer: Object.freeze({
    both: '{x=const, x=xₚ(t)}',
    fixed: 'x=const',
    particle: 'x=xₚ(t)',
  }),
  preset: Object.freeze({
    'hot-cold': 'φ|Γ_L=1, φ|Γ_R=0, φ|Γ_0=0',
    'point-electrode': 'φ|∂Ω=0, φ|Γ_e=1',
    'two-electrodes': 'φ|Γ_+=1, φ|Γ_-=-1',
    'cold-walls': 'φ|∂Ω=0',
  }),
  law: Object.freeze({
    linear: '∂²F/∂u²=0',
    nonlinear: '∂²F/∂u²≠0',
  }),
  obstacle: Object.freeze({
    none: '∅',
    circle: 'Bᵣ',
  }),
  geometry: Object.freeze({
    none: '∅',
    circle: 'Bᵣ',
    square: 'Q',
    'two-cylinders': 'B₁∪B₂',
    narrowing: 'Ωₙ',
  }),
});

function notation(group, value) {
  return NOTATION[group]?.[value] ?? value ?? '?';
}

export function lessonMathState(model, entry) {
  const parameters = model.parameters ?? {};
  const id = entry.id;

  if (id === 'pde-field') {
    const coefficient = parameters.mode === 'transport'
      ? `c=${number(parameters.c)}`
      : parameters.mode === 'diffusion'
        ? `D=${number(parameters.D, 3)}`
        : `c=${number(parameters.c)}`;
    return `mode=${notation('mode', parameters.mode)}; ${coefficient}; ${profile(parameters)}`;
  }
  if (id === 'diffusion') {
    return `D=${number(parameters.D, 3)}; ${profile(parameters)}; ${notation('diffusionBoundary', parameters.boundary)}`;
  }
  if (id === 'boundaries') {
    const left = boundaryCondition(parameters, 'left');
    const right = boundaryCondition(parameters, 'right');
    const periodic = parameters.leftBoundary === 'periodic' || parameters.rightBoundary === 'periodic';
    return `D=${number(parameters.D, 3)}; ${periodic ? left : `x=-1: ${left}; x=1: ${right}`}`;
  }
  if (id === 'wave') {
    return `c=${number(parameters.c)}; c₂/c₁=${number(parameters.c2Ratio)}; uₜ(x,0)=${number(parameters.initialVelocity)}; ${notation('waveBoundary', parameters.boundary)}; ${waveForcing(parameters.source)}`;
  }
  if (id === 'characteristics') {
    return `a=${number(parameters.speed)}; ${notation('characteristics', parameters.field)}; ${profile(parameters)}`;
  }
  if (id === 'advection-diffusion') {
    const peclet = Number(parameters.D) > 0 ? 2 * Number(parameters.speed) / Number(parameters.D) : Infinity;
    return `|v|=${number(parameters.speed)}; θ=${number(parameters.angle)} rad; D=${number(parameters.D, 3)}; Pe=${Number.isFinite(peclet) ? number(peclet, 1) : '∞'}; ${notation('velocity', parameters.velocityField)}`;
  }
  if (id === 'vector-calculus') {
    return `${notation('vectorField', parameters.field)}; view=${notation('display', parameters.display)}; α=${number(parameters.strength)}`;
  }
  if (id === 'material-derivative') {
    return `v=${number(parameters.velocity)}; A=${number(parameters.amplitude)}; λ=${number(parameters.wavelength)}; obs=${notation('observer', parameters.observer)}`;
  }
  if (id === 'laplace') {
    return `φ|∂Ω=${number(parameters.brushValue)}; ${notation('preset', parameters.preset)}`;
  }
  if (id === 'classification') {
    return `D=${number(parameters.D, 3)}; c=${number(parameters.c)}; ${profile(parameters)}`;
  }
  if (id === 'nonlinearity') {
    return `${notation('law', parameters.law)}; ${profile(parameters)}`;
  }
  if (id === 'riemann') {
    return `t=${number(model.time, 3)}; U_L=(ρ,u,p)=(${number(parameters.rhoL)},${number(parameters.uL)},${number(parameters.pL)}); U_R=(ρ,u,p)=(${number(parameters.rhoR)},${number(parameters.uR)},${number(parameters.pR)})`;
  }
  if (id === 'shallow-water') {
    return `g=${number(parameters.gravity)}; δh=${number(parameters.amplitude)}; v₀=${number(parameters.initialVelocity)}; obstacle=${notation('obstacle', parameters.obstacle)}; view=${notation('display', parameters.display)}`;
  }
  if (id === 'incompressibility') {
    return `ν=${number(parameters.viscosity, 3)}; v_in=${number(parameters.inflow)}; view=${notation('display', parameters.display)}`;
  }
  if (id === 'sources') {
    return `|v|=${number(parameters.speed)}; θ=${number(parameters.angle)} rad; D=${number(parameters.D, 3)}; S(x₀,y₀): σ=${number(parameters.sourceStrength)}, r=${number(parameters.sourceRadius)}, (x₀,y₀)=(${number(parameters.sourceX)},${number(parameters.sourceY)})`;
  }
  if (id === 'geometry') {
    return `D=${number(parameters.D, 3)}; Ω=${notation('geometry', parameters.geometry)}; obstacle center=(${number(parameters.obstacleX)},${number(parameters.obstacleY)})`;
  }
  return '';
}
