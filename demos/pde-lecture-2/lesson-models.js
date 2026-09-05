import { diffuse1D as diffuse, advanceWave1D as advanceWave, affineCharacteristic, nodalIntegral, advanceShallowWater, projectPeriodic, advanceScalar2D } from '../../lib/chalkish/src/pde.js';

const CURVE_SAMPLES = 161;
const GAMMA = 1.4;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function makeCoordinates(count = CURVE_SAMPLES) {
  const values = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    values[index] = -1 + 2 * index / (count - 1);
  }
  return values;
}

function deterministicNoise(index) {
  const value = Math.sin((index + 17) * 12.9898) * 43758.5453;
  return 2 * (value - Math.floor(value)) - 1;
}

function profileAt(x, profile, parameters = {}) {
  const amplitude = Number(parameters.amplitude ?? 1);
  const width = Math.max(0.03, Number(parameters.width ?? 0.22));
  const position = Number(parameters.position ?? 0);
  const z = (x - position) / width;
  if (profile === 'step') return x < position ? amplitude : 0;
  if (profile === 'sine') return amplitude * Math.sin(Math.PI * (x - position));
  if (profile === 'two') {
    return amplitude * (Math.exp(-(((x + 0.38) / width) ** 2))
      + 0.75 * Math.exp(-(((x - 0.34) / (width * 1.35)) ** 2)));
  }
  if (profile === 'square') return Math.abs(x - position) < width ? amplitude : 0;
  if (profile === 'noise') return amplitude * deterministicNoise(Math.round((x + 1) * 1000));
  return amplitude * Math.exp(-(z ** 2));
}

function fillProfile(target, x, profile, parameters) {
  for (let index = 0; index < target.length; index += 1) {
    target[index] = profileAt(x[index], profile, parameters);
  }
}

function sampleLinear(values, coordinate, periodic = true) {
  let s = (coordinate + 1) * 0.5 * (values.length - 1);
  if (periodic) {
    const period = values.length - 1;
    s = ((s % period) + period) % period;
  } else {
    s = clamp(s, 0, values.length - 1);
  }
  const left = Math.floor(s);
  const right = periodic ? (left + 1) % (values.length - 1) : Math.min(values.length - 1, left + 1);
  const fraction = s - left;
  return values[left] * (1 - fraction) + values[right] * fraction;
}

function updateDerivatives(values, first, second, spacing) {
  const last = values.length - 1;
  for (let index = 1; index < last; index += 1) {
    first[index] = (values[index + 1] - values[index - 1]) / (2 * spacing);
    second[index] = (values[index + 1] - 2 * values[index] + values[index - 1]) / (spacing ** 2);
  }
  first[0] = (values[1] - values[0]) / spacing;
  first[last] = (values[last] - values[last - 1]) / spacing;
  second[0] = second[1];
  second[last] = second[last - 1];
}

function advanceBurgers(model, elapsed) {
  const { value, scratch, x } = model;
  const spacing = x[1] - x[0];
  const maxSpeed = Math.max(0.05, ...value.map((entry) => Math.abs(entry)));
  const steps = Math.max(1, Math.ceil(elapsed / (0.35 * spacing / maxSpeed)));
  const dt = elapsed / steps;
  const last = value.length - 1;
  for (let step = 0; step < steps; step += 1) {
    for (let index = 0; index <= last; index += 1) {
      const leftIndex = index === 0 ? last - 1 : index - 1;
      const rightIndex = index === last ? 1 : index + 1;
      const left = value[leftIndex];
      const center = value[index];
      const right = value[rightIndex];
      const fluxLeft = 0.25 * (left ** 2 + center ** 2)
        - 0.5 * Math.max(Math.abs(left), Math.abs(center)) * (center - left);
      const fluxRight = 0.25 * (center ** 2 + right ** 2)
        - 0.5 * Math.max(Math.abs(center), Math.abs(right)) * (right - center);
      scratch[index] = center - dt / spacing * (fluxRight - fluxLeft);
    }
    value.set(scratch);
    value[last] = value[0];
  }
}

function riemannPressureFunction(pressure, state) {
  const sound = Math.sqrt(GAMMA * state.p / state.rho);
  if (pressure > state.p) {
    const a = 2 / ((GAMMA + 1) * state.rho);
    const b = (GAMMA - 1) / (GAMMA + 1) * state.p;
    const root = Math.sqrt(a / (pressure + b));
    return {
      value: (pressure - state.p) * root,
      derivative: root * (1 - 0.5 * (pressure - state.p) / (pressure + b)),
    };
  }
  const exponent = (GAMMA - 1) / (2 * GAMMA);
  const ratio = pressure / state.p;
  return {
    value: 2 * sound / (GAMMA - 1) * (ratio ** exponent - 1),
    derivative: ratio ** (-(GAMMA + 1) / (2 * GAMMA)) / (state.rho * sound),
  };
}

export function solveEulerStarState(left, right) {
  for (const state of [left, right]) {
    if (![state.rho, state.p, state.u].every(Number.isFinite) || !(state.rho > 0) || !(state.p > 0)) {
      throw new RangeError('Euler states require rho > 0, p > 0, and finite velocity');
    }
  }
  const aLeft = Math.sqrt(GAMMA * left.p / left.rho);
  const aRight = Math.sqrt(GAMMA * right.p / right.rho);
  if (right.u - left.u >= 2 * (aLeft + aRight) / (GAMMA - 1)) {
    return Object.freeze({ pressure: 0, velocity: (left.u + right.u) / 2, vacuum: true });
  }
  let pressure = Math.max(1e-8, 0.5 * (left.p + right.p)
    - 0.125 * (right.u - left.u) * (left.rho + right.rho) * (aLeft + aRight));
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const fLeft = riemannPressureFunction(pressure, left);
    const fRight = riemannPressureFunction(pressure, right);
    const next = Math.max(1e-10, pressure
      - (fLeft.value + fRight.value + right.u - left.u)
      / (fLeft.derivative + fRight.derivative));
    if (Math.abs(next - pressure) <= 1e-9 * Math.max(1, pressure)) {
      pressure = next;
      break;
    }
    pressure = next;
  }
  const fLeft = riemannPressureFunction(pressure, left).value;
  const fRight = riemannPressureFunction(pressure, right).value;
  return Object.freeze({ pressure, velocity: 0.5 * (left.u + right.u + fRight - fLeft) });
}

function sampleEulerSide(similarity, state, star, side) {
  const sign = side === 'left' ? 1 : -1;
  const sound = Math.sqrt(GAMMA * state.p / state.rho);
  const pressureRatio = star.pressure / state.p;
  if (star.pressure > state.p) {
    const shockSpeed = state.u - sign * sound
      * Math.sqrt((GAMMA + 1) / (2 * GAMMA) * pressureRatio
        + (GAMMA - 1) / (2 * GAMMA));
    const outside = side === 'left' ? similarity < shockSpeed : similarity > shockSpeed;
    if (outside) return state;
    const ratio = (pressureRatio + (GAMMA - 1) / (GAMMA + 1))
      / ((GAMMA - 1) / (GAMMA + 1) * pressureRatio + 1);
    return { rho: state.rho * ratio, u: star.velocity, p: star.pressure };
  }
  const starSound = sound * pressureRatio ** ((GAMMA - 1) / (2 * GAMMA));
  const head = state.u - sign * sound;
  const tail = star.velocity - sign * starSound;
  const outside = side === 'left' ? similarity < head : similarity > head;
  if (outside) return state;
  const insideStar = side === 'left' ? similarity > tail : similarity < tail;
  if (insideStar) {
    return {
      rho: state.rho * pressureRatio ** (1 / GAMMA),
      u: star.velocity,
      p: star.pressure,
    };
  }
  const velocity = 2 / (GAMMA + 1)
    * (sound + 0.5 * (GAMMA - 1) * state.u + sign * similarity);
  const localSound = 2 / (GAMMA + 1)
    * (sound + 0.5 * (GAMMA - 1) * sign * (state.u - similarity));
  const ratio = Math.max(1e-12, localSound / sound);
  return {
    rho: state.rho * ratio ** (2 / (GAMMA - 1)),
    u: velocity,
    p: state.p * ratio ** (2 * GAMMA / (GAMMA - 1)),
  };
}

export function sampleEulerRiemann(similarity, left, right, star = solveEulerStarState(left, right)) {
  if (star.vacuum) {
    const tailLeft = left.u + 2 * Math.sqrt(GAMMA * left.p / left.rho) / (GAMMA - 1);
    const tailRight = right.u - 2 * Math.sqrt(GAMMA * right.p / right.rho) / (GAMMA - 1);
    if (similarity >= tailLeft && similarity <= tailRight) return { rho: 0, u: similarity, p: 0 };
    return similarity < tailLeft
      ? sampleEulerSide(similarity, left, { pressure: 0, velocity: tailLeft }, 'left')
      : sampleEulerSide(similarity, right, { pressure: 0, velocity: tailRight }, 'right');
  }
  return similarity <= star.velocity
    ? sampleEulerSide(similarity, left, star, 'left')
    : sampleEulerSide(similarity, right, star, 'right');
}

const CURVE_DEFAULTS = Object.freeze({
  'pde-field': { mode: 'transport', amplitude: 1, width: 0.2, position: -0.35, c: 0.65, D: 0.08 },
  diffusion: { D: 0.08, amplitude: 1, width: 0.18, position: 0, boundary: 'insulated' },
  boundaries: {
    D: 0.08, amplitude: 1, width: 0.18, position: 0,
    leftBoundary: 'fixed', rightBoundary: 'fixed', leftValue: 1, rightValue: 0,
    leftFlux: 0, rightFlux: 0,
  },
  wave: {
    c: 0.8, c2Ratio: 0.55, amplitude: 1, width: 0.15, position: 0,
    initialVelocity: 0, boundary: 'free', source: 'pulse', medium: 'uniform',
  },
  characteristics: { speed: 0.7, field: 'constant', amplitude: 1, width: 0.2, position: -0.4 },
  classification: { D: 0.08, c: 0.8, amplitude: 1, width: 0.16, position: 0 },
  nonlinearity: { law: 'nonlinear', amplitude: 0.8, width: 0.28, position: -0.25 },
  riemann: { rhoL: 1, uL: 0, pL: 1, rhoR: 0.125, uR: 0, pR: 0.1 },
  'material-derivative': { velocity: 0.55, amplitude: 1, wavelength: 0.75, observer: 'both' },
});

export class CurveLessonModel {
  constructor(id) {
    if (!(id in CURVE_DEFAULTS)) throw new RangeError(`unsupported curve lesson: ${id}`);
    this.id = id;
    this.x = makeCoordinates();
    this.value = new Float32Array(this.x.length);
    this.initial = new Float32Array(this.x.length);
    this.auxiliary = new Float32Array(this.x.length);
    this.second = new Float32Array(this.x.length);
    this.scratch = new Float32Array(this.x.length);
    this.velocity = new Float32Array(this.x.length);
    this.parameters = { ...CURVE_DEFAULTS[id] };
    this.time = 0;
    this.preset = 'default';
    this.marker = null;
    this.panels = this.#makePanels();
    this.reset();
  }

  #makePanels() {
    const curve = (data, color, dash = null) => ({ data, color, dash });
    if (this.id === 'diffusion') {
      return [
        { label: 'u', curves: [curve(this.value, '#72dce5')] },
        { label: '∂u/∂x', curves: [curve(this.auxiliary, '#efd677')] },
        { label: 'q = −D∂u/∂x', curves: [curve(this.second, '#ed8e79')] },
      ];
    }
    if (this.id === 'wave') {
      return [
        { label: 'u', curves: [curve(this.value, '#72dce5'), curve(this.initial, '#eeeada', [5, 4])] },
        { label: 'uₜ', curves: [curve(this.velocity, '#efd677')] },
      ];
    }
    if (this.id === 'classification') {
      return [
        { label: '∇²u = 0', curves: [curve(this.value, '#ed8e79')] },
        { label: 'uₜ = D∇²u', curves: [curve(this.auxiliary, '#efd677')] },
        { label: 'uₜₜ = c²∇²u', curves: [curve(this.second, '#72dce5')] },
      ];
    }
    if (this.id === 'characteristics' || this.id === 'nonlinearity') {
      const paths = Array.from({ length:  ninePathCount() }, () => new Float32Array(this.x.length));
      this.pathArrays = paths;
      return [
        { label: 'u(x,t)', curves: [curve(this.value, '#72dce5'), curve(this.initial, '#eeeada', [5, 4])] },
        { label: 'x–t', curves: paths.map((data, index) => curve(data, index === 4 ? '#efd677' : '#ed8e79')) },
      ];
    }
    if (this.id === 'riemann') {
      return [
        { label: 'ρ', curves: [curve(this.value, '#72dce5')] },
        { label: 'u', curves: [curve(this.auxiliary, '#efd677')] },
        { label: 'p', curves: [curve(this.second, '#ed8e79')] },
      ];
    }
    return [{
      label: this.id === 'material-derivative' ? 'u(x,t)' : 'u(x,t)',
      curves: [curve(this.value, '#72dce5'), curve(this.initial, '#eeeada', [5, 4])],
    }];
  }

  setParameter(name, value) {
    this.parameters[name] = value;
    this.revision = (this.revision ?? 0) + 1;
    if (name === 'leftBoundary' || name === 'rightBoundary') {
      const other = name === 'leftBoundary' ? 'rightBoundary' : 'leftBoundary';
      if (value === 'periodic') this.parameters[other] = value;
      else if (this.parameters[other] === 'periodic') this.parameters[other] = 'insulated';
    }
    if (name === 'boundary' && value === 'periodic') this.value[this.value.length - 1] = this.value[0];
    const initialData = new Set([
      'mode', 'amplitude', 'width', 'position', 'initialVelocity', 'wavelength',
      'rhoL', 'uL', 'pL', 'rhoR', 'uR', 'pR',
    ]);
    if (initialData.has(name) || name === 'law' || name === 'field' || name === 'speed') this.restart();
    else { this.#enforceBoundary(); this.#refreshDerived(); }
  }

  restart() { return this.reset(this.preset, true); }

  reset(preset = this.preset, keepParameters = false) {
    this.revision = (this.revision ?? 0) + 1;
    const drawing = preset === 'drawing' ? this.initial.slice() : null;
    if (!keepParameters) this.parameters = { ...CURVE_DEFAULTS[this.id] };
    this.preset = preset;
    this.time = 0;
    this.transportDistance = 0;
    this.velocity.fill(Number(this.parameters.initialVelocity ?? 0));
    let profile = 'gaussian';
    if (['step', 'sine', 'two', 'noise', 'square'].includes(preset)) profile = preset;
    if (this.id === 'wave' && !keepParameters) {
      this.parameters.medium = 'uniform';
      if (preset === 'standing') profile = 'sine';
      if (preset === 'standing') this.parameters.boundary = 'fixed';
      if (preset === 'interference') profile = 'two';
      if (preset === 'fixed-reflection') this.parameters.boundary = 'fixed';
      if (preset === 'free-reflection') this.parameters.boundary = 'free';
      if (preset === 'heterogeneous') this.parameters.medium = 'two-regions';
    }
    if (this.id === 'wave' && preset === 'standing') profile = 'sine';
    if (this.id === 'wave' && preset === 'interference') profile = 'two';
    if (this.id === 'boundaries' && !keepParameters) {
      if (preset === 'cold-walls') {
        this.parameters.leftBoundary = 'fixed';
        this.parameters.rightBoundary = 'fixed';
        this.parameters.leftValue = 0;
        this.parameters.rightValue = 0;
      } else if (preset === 'insulated') {
        this.parameters.leftBoundary = 'insulated';
        this.parameters.rightBoundary = 'insulated';
      } else if (preset === 'periodic') {
        this.parameters.leftBoundary = 'periodic';
        this.parameters.rightBoundary = 'periodic';
      }
    }
    if (!keepParameters && this.id === 'characteristics' && ['constant', 'increasing', 'decreasing'].includes(preset)) {
      this.parameters.field = preset;
    }
    if (this.id === 'nonlinearity' && preset === 'rarefaction') {
      profile = 'step';
      if (!keepParameters) this.parameters.amplitude = -0.8;
    }
    fillProfile(this.initial, this.x, profile, this.parameters);
    if (drawing) this.initial.set(drawing);
    this.value.set(this.initial);
    if (this.id === 'boundaries' && preset === 'hot-cold') {
      if (!keepParameters) {
        this.parameters.leftBoundary = 'fixed';
        this.parameters.rightBoundary = 'fixed';
        this.parameters.leftValue = 1;
        this.parameters.rightValue = 0;
      }
      this.value.fill(0.5);
    }
    if (this.id === 'riemann' && !keepParameters) this.#applyRiemannPreset(preset);
    if (this.id === 'riemann') this.#updateRiemann();
    if (this.id === 'material-derivative') {
      for (let index = 0; index < this.x.length; index += 1) {
        this.initial[index] = Number(this.parameters.amplitude)
          * Math.sin(2 * Math.PI * this.x[index] / Number(this.parameters.wavelength));
      }
      this.value.set(this.initial);
    }
    this.#updatePaths();
    this.#enforceBoundary();
    if (this.id === 'boundaries') this.initial.set(this.value);
    if (this.id === 'classification') this.#updateClassification();
    this.#refreshDerived();
    return this;
  }

  #applyRiemannPreset(preset) {
    const states = {
      sod: [1, 0, 1, 0.125, 0, 0.1],
      collision: [1, 1, 1, 1, -1, 1],
      expansion: [1, -1, 0.4, 1, 1, 0.4],
      'strong-shock': [1, 0, 5, 1, 0, 0.02],
      contact: [1, 0.3, 1, 0.25, 0.3, 1],
    }[preset];
    if (states) {
      [this.parameters.rhoL, this.parameters.uL, this.parameters.pL,
        this.parameters.rhoR, this.parameters.uR, this.parameters.pR] = states;
    }
    this.#updateRiemann();
  }

  #updateRiemann() {
    const left = { rho: Number(this.parameters.rhoL), u: Number(this.parameters.uL), p: Number(this.parameters.pL) };
    const right = { rho: Number(this.parameters.rhoR), u: Number(this.parameters.uR), p: Number(this.parameters.pR) };
    const star = solveEulerStarState(left, right);
    for (let index = 0; index < this.x.length; index += 1) {
      const state = this.time <= 1e-8
        ? (this.x[index] < 0 ? left : right)
        : sampleEulerRiemann(this.x[index] / this.time, left, right, star);
      this.value[index] = state.rho;
      this.auxiliary[index] = state.u;
      this.second[index] = state.p;
    }
    this.star = star;
    const starDensity = state => {
      const ratio = star.pressure / state.p, k = (GAMMA - 1) / (GAMMA + 1);
      return state.rho * (ratio > 1 ? (ratio + k) / (k * ratio + 1) : ratio ** (1 / GAMMA));
    };
    this.plotBounds = [Math.max(left.rho, right.rho, starDensity(left), starDensity(right)),
      Math.max(0.2, Math.abs(left.u), Math.abs(right.u), Math.abs(star.velocity)),
      Math.max(left.p, right.p, star.pressure)];
    this.waveFronts = [];
    this.waveKinds = [];
    for (const [state, sign] of [[left, -1], [right, 1]]) {
      const a = Math.sqrt(GAMMA * state.p / state.rho);
      const ratio = star.pressure / state.p;
      if (Math.abs(ratio - 1) < 1e-9) { this.waveKinds.push('none'); continue; }
      if (ratio > 1) {
        this.waveKinds.push('shock');
        this.waveFronts.push({ speed: state.u + sign * a * Math.sqrt((GAMMA + 1) / (2 * GAMMA) * ratio + (GAMMA - 1) / (2 * GAMMA)), kind: 'shock' });
      } else {
        this.waveKinds.push('fan');
        this.waveFronts.push({ speed: state.u + sign * a, kind: 'fan' });
        this.waveFronts.push({ speed: star.vacuum ? state.u - sign * 2 * a / (GAMMA - 1) : star.velocity + sign * a * ratio ** ((GAMMA - 1) / (2 * GAMMA)), kind: 'fan' });
      }
    }
    if (!star.vacuum) this.waveFronts.push({ speed: star.velocity, kind: 'contact' });
    this.observable = `t ${this.time.toFixed(3)} · p* ${star.pressure.toFixed(3)} · u* ${star.velocity.toFixed(3)}`;
  }

  #refreshDerived() {
    if (this.id === 'riemann') { this.#updateRiemann(); return; }
    if (this.id === 'diffusion') {
      updateDerivatives(this.value, this.auxiliary, this.scratch, this.x[1] - this.x[0]);
      if (this.parameters.boundary === 'insulated') this.auxiliary[0] = this.auxiliary[this.auxiliary.length - 1] = 0;
      if (this.parameters.boundary === 'periodic') {
        this.auxiliary[0] = (this.value[1] - this.value[this.value.length - 2]) / (2 * (this.x[1] - this.x[0]));
        this.auxiliary[this.auxiliary.length - 1] = this.auxiliary[0];
      }
      const diffusivity = Number(this.parameters.D);
      for (let index = 0; index < this.second.length; index += 1) {
        this.second[index] = -diffusivity * this.auxiliary[index];
      }
      let mean = 0;
      let minimum = Infinity;
      let maximum = -Infinity;
      for (const value of this.value) {
        mean += value;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
      this.observable = `t ${this.time.toFixed(2)} · min ${minimum.toFixed(3)} · max ${maximum.toFixed(3)} · ⟨u⟩ ${(nodalIntegral(this.value) / 2).toFixed(3)}`;
    } else if (this.id === 'material-derivative') {
      const particleX = -0.75 + this.transportDistance;
      const wavelength = Number(this.parameters.wavelength);
      // Re-enter an equivalent wave period, so the marked value stays constant.
      const wrapped = particleX - wavelength * Math.ceil(Math.max(0, particleX - 1) / wavelength)
        + wavelength * Math.ceil(Math.max(0, -1 - particleX) / wavelength);
      const k = 2 * Math.PI / wavelength;
      this.marker = { x: wrapped, y: Number(this.parameters.amplitude) * Math.sin(-0.75 * k), panel: 0 };
      const phase = -k * this.transportDistance;
      const partial = -Number(this.parameters.velocity) * k * Number(this.parameters.amplitude) * Math.cos(phase);
      this.observable = `∂u/∂t ${partial.toFixed(3)} · Du/Dt 0.000`;
    } else if (this.id === 'boundaries') {
      this.observable = `t ${this.time.toFixed(2)} · ⟨u⟩ ${(nodalIntegral(this.value) / 2).toFixed(3)}`;
    } else {
      this.observable = `t ${this.time.toFixed(2)}`;
    }
  }

  #updatePaths() {
    if (!this.pathArrays) return;
    const pathCount = this.pathArrays.length;
    for (let path = 0; path < pathCount; path += 1) {
      const origin = -0.8 + 1.6 * path / (pathCount - 1);
      const initialValue = sampleLinear(this.initial, origin, false);
      for (let index = 0; index < this.x.length; index += 1) {
        const x = this.x[index];
        const speed = this.id === 'nonlinearity'
          ? (this.parameters.law === 'nonlinear' ? initialValue : 0.6) : this.#transportSpeed(origin);
        const b = this.#speedSlope();
        const ratio = speed === 0 ? -1 : this.#transportSpeed(x) / speed;
        const time = this.id === 'characteristics' && b !== 0
          ? (ratio > 0 ? Math.log(ratio) / b : Number.NaN)
          : speed === 0 ? Number.NaN : (x - origin) / speed;
        this.pathArrays[path][index] = time >= 0 && time <= 2 ? time : Number.NaN;
      }
    }
  }

  #transportSpeed(x) {
    const base = Number(this.parameters.speed ?? 0.7);
    if (this.parameters.field === 'increasing') return base * (1 + 0.45 * x);
    if (this.parameters.field === 'decreasing') return base * (1 - 0.45 * x);
    return base;
  }

  #speedSlope() {
    return Number(this.parameters.speed ?? 0.7)
      * (this.parameters.field === 'increasing' ? 0.45 : this.parameters.field === 'decreasing' ? -0.45 : 0);
  }

  characteristicPosition(origin, time) {
    return affineCharacteristic(origin, time, Number(this.parameters.speed), this.#speedSlope());
  }

  characteristicOrigin(x, time = this.time) { return this.characteristicPosition(x, -time); }

  probe(x) {
    const origin = this.characteristicOrigin(x);
    this.probePoint = { x, origin, value: sampleLinear(this.initial, origin, false) };
    return this.probePoint;
  }

  #enforceBoundary() {
    const p = this.parameters, last = this.value.length - 1;
    if (p.leftBoundary === 'fixed' || p.boundary === 'fixed') this.value[0] = Number(p.leftValue ?? 0);
    if (p.rightBoundary === 'fixed' || p.boundary === 'fixed') this.value[last] = Number(p.rightValue ?? 0);
    if (p.leftBoundary === 'periodic' || p.boundary === 'periodic' || this.id === 'pde-field') {
      this.value[last] = this.value[0];
      this.initial[last] = this.initial[0];
    }
  }

  #updateClassification() {
    const sine = this.preset === 'sine';
    const { amplitude: A, width: w, D, c } = this.parameters;
    const variance = w * w + 4 * D * this.time;
    for (let i = 0; i < this.x.length; i++) {
      const x = this.x[i];
      this.value[i] = A * (1 - x) / 2;
      this.auxiliary[i] = sine ? A * Math.sin(Math.PI * x) * Math.exp(-D * Math.PI ** 2 * this.time)
        : A * w / Math.sqrt(variance) * Math.exp(-x * x / variance);
      this.second[i] = sine ? A * Math.sin(Math.PI * x) * Math.cos(c * Math.PI * this.time)
        : 0.5 * (profileAt(x - c * this.time, 'gaussian', this.parameters) + profileAt(x + c * this.time, 'gaussian', this.parameters));
    }
  }

  step(elapsed) {
    if (!(elapsed > 0)) return;
    this.time += elapsed;
    if (this.id === 'pde-field') {
      const mode = this.parameters.mode;
      if (mode === 'transport') {
        this.transportDistance += Number(this.parameters.c) * elapsed;
        const shift = this.transportDistance;
        for (let index = 0; index < this.x.length; index += 1) {
          this.value[index] = sampleLinear(this.initial, this.x[index] - shift);
        }
      } else if (mode === 'diffusion') {
        diffuse(this.value, this.scratch, Number(this.parameters.D), elapsed, { boundary: 'periodic' });
      } else {
        const shift = Number(this.parameters.c) * this.time;
        for (let i = 0; i < this.x.length; i++) this.value[i] = 0.5 * (
          sampleLinear(this.initial, this.x[i] - shift) + sampleLinear(this.initial, this.x[i] + shift));
      }
    } else if (this.id === 'diffusion' || this.id === 'boundaries') {
      diffuse(this.value, this.scratch, Number(this.parameters.D), elapsed, this.parameters);
    } else if (this.id === 'wave') {
      advanceWave(this, elapsed);
      if (this.parameters.source === 'oscillator') {
        this.velocity[Math.floor(this.value.length / 2)] += 6 * elapsed * Math.sin(7 * this.time);
      }
    } else if (this.id === 'characteristics') {
      for (let index = 0; index < this.x.length; index += 1) {
        this.value[index] = sampleLinear(this.initial, this.characteristicOrigin(this.x[index]), false);
      }
      this.#updatePaths();
    } else if (this.id === 'classification') {
      this.#updateClassification();
    } else if (this.id === 'nonlinearity') {
      if (this.parameters.law === 'linear') {
        for (let index = 0; index < this.x.length; index += 1) {
          this.value[index] = sampleLinear(this.initial, this.x[index] - 0.6 * this.time);
        }
      } else {
        advanceBurgers(this, elapsed);
      }
      this.#updatePaths();
    } else if (this.id === 'riemann') {
      this.#updateRiemann();
    } else if (this.id === 'material-derivative') {
      const speed = Number(this.parameters.velocity);
      this.transportDistance += speed * elapsed;
      const wavelength = Number(this.parameters.wavelength);
      for (let index = 0; index < this.x.length; index += 1) {
        this.value[index] = Number(this.parameters.amplitude)
          * Math.sin(2 * Math.PI * (this.x[index] - this.transportDistance) / wavelength);
      }
    }
    this.#refreshDerived();
  }

  drawAt(x, value) {
    if (this.time > 0) this.initial.set(this.value);
    const index = clamp(Math.round((x + 1) * 0.5 * (this.x.length - 1)), 0, this.x.length - 1);
    this.initial[index] = clamp(value, -2, 2);
    this.value[index] = this.initial[index];
    this.preset = 'drawing';
    this.time = 0;
    this.velocity.fill(Number(this.parameters.initialVelocity ?? 0));
    this.#enforceBoundary();
    this.#refreshDerived();
  }
}

function ninePathCount() {
  return 9;
}

const FIELD_COLUMNS = 72;
const FIELD_ROWS = 44;

function fieldIndex(column, row, columns = FIELD_COLUMNS) {
  return row * columns + column;
}

function bilinear(data, columns, rows, x, y, periodic = true) {
  let sx = (x + 1) * 0.5 * (columns - 1);
  let sy = (y + 0.6) / 1.2 * (rows - 1);
  if (periodic) {
    sx = ((sx % columns) + columns) % columns;
    sy = ((sy % rows) + rows) % rows;
  } else {
    sx = clamp(sx, 0, columns - 1);
    sy = clamp(sy, 0, rows - 1);
  }
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = periodic ? (x0 + 1) % columns : Math.min(columns - 1, x0 + 1);
  const y1 = periodic ? (y0 + 1) % rows : Math.min(rows - 1, y0 + 1);
  const tx = sx - x0;
  const ty = sy - y0;
  return data[fieldIndex(x0, y0, columns)] * (1 - tx) * (1 - ty)
    + data[fieldIndex(x1, y0, columns)] * tx * (1 - ty)
    + data[fieldIndex(x0, y1, columns)] * (1 - tx) * ty
    + data[fieldIndex(x1, y1, columns)] * tx * ty;
}

const FIELD_DEFAULTS = Object.freeze({
  'advection-diffusion': {
    speed: 0.55, angle: 0, D: 0.006, velocityField: 'uniform', profile: 'blob',
    showVectors: true, showParticles: false,
  },
  sources: {
    speed: 0.4, angle: 0, D: 0.008, sourceStrength: 0.8, sourceRadius: 0.12,
    sourceX: -0.45, sourceY: 0, sourceMode: 'steady', showVectors: true, showParticles: false,
  },
  geometry: {
    speed: 0, D: 0.02, geometry: 'circle', obstacleX: 0, obstacleY: 0,
    showVectors: true, showParticles: false,
  },
  laplace: { brushValue: 1, preset: 'hot-cold', showVectors: true, showParticles: false },
  'vector-calculus': {
    field: 'vortex', display: 'divergence', strength: 0.7,
    showVectors: true, showParticles: true,
  },
});

export class FieldLessonModel {
  constructor(id) {
    if (!(id in FIELD_DEFAULTS)) throw new RangeError(`unsupported field lesson: ${id}`);
    this.id = id;
    this.columns = FIELD_COLUMNS;
    this.rows = FIELD_ROWS;
    this.data = new Float32Array(this.columns * this.rows);
    this.scalar = id === 'laplace' ? new Float64Array(this.data.length) : new Float32Array(this.data.length);
    this.scratch = new Float32Array(this.data.length);
    this.parameters = { ...FIELD_DEFAULTS[id] };
    this.time = 0;
    this.preset = 'default';
    this.particlesX = new Float32Array(96);
    this.particlesY = new Float32Array(96);
    this.reset();
  }

  setParameter(name, value) {
    this.parameters[name] = value;
    if (this.id === 'geometry' && ['geometry', 'obstacleX', 'obstacleY'].includes(name)) { this.restart(); return; }
    this.#refreshDisplay();
  }

  restart() { return this.reset(this.preset, true); }

  reset(preset = this.preset, keepParameters = false) {
    this.preset = preset;
    this.time = 0;
    this.data.fill(0);
    this.scalar.fill(0);
    if (this.id === 'laplace') this.#resetLaplace(preset);
    else if (this.id === 'vector-calculus') {
      if (['uniform', 'source', 'sink', 'vortex', 'shear', 'source-vortex'].includes(preset)) {
        this.parameters.field = preset;
      }
      this.#resetParticles();
    } else {
      if (this.id === 'advection-diffusion' && !keepParameters) {
        const values = {
          'pure-advection': [0.55, 0, 'uniform'],
          'pure-diffusion': [0, 0.02, 'uniform'],
          'weak-diffusion': [0.7, 0.003, 'uniform'],
          'strong-diffusion': [0.35, 0.025, 'uniform'],
          rotation: [0.65, 0.005, 'rotation'],
          shear: [0.65, 0.004, 'shear'],
        }[preset];
        if (values) [this.parameters.speed, this.parameters.D, this.parameters.velocityField] = values;
      }
      if (this.id === 'sources' && !keepParameters) {
        this.parameters.sourceMode = 'steady';
        this.parameters.speed = preset === 'heated' ? 0 : 0.4;
        if (preset === 'source-sink') this.parameters.sourceStrength = -0.8;
        else if (preset === 'pulsed') this.parameters.sourceMode = 'pulsed';
        else this.parameters.sourceStrength = Math.abs(Number(this.parameters.sourceStrength));
      }
      if (!keepParameters && this.id === 'geometry'
        && ['none', 'circle', 'square', 'two-cylinders', 'narrowing'].includes(preset)) {
        this.parameters.geometry = preset;
      }
      this.#resetScalar(preset);
      if (this.id === 'sources' && preset !== 'source-sink') this.scalar.fill(0);
    }
    this.#refreshDisplay();
    return this;
  }

  #resetScalar(preset) {
    const profile = preset === 'square' || preset === 'stripe' ? preset : 'blob';
    for (let row = 0; row < this.rows; row += 1) {
      const y = -0.6 + 1.2 * (row + 0.5) / this.rows;
      for (let column = 0; column < this.columns; column += 1) {
        const x = -1 + 2 * (column + 0.5) / this.columns;
        let value;
        if (profile === 'square') value = Math.abs(x + 0.45) < 0.17 && Math.abs(y) < 0.17 ? 1 : 0;
        else if (profile === 'stripe') value = Math.abs(x + 0.45) < 0.12 ? 1 : 0;
        else value = Math.exp(-((x + 0.48) ** 2 + y ** 2) / 0.035);
        this.scalar[fieldIndex(column, row, this.columns)] = value;
      }
    }
    this.#resetParticles();
  }

  #resetParticles() {
    for (let index = 0; index < this.particlesX.length; index += 1) {
      this.particlesX[index] = -0.9 + 1.8 * ((index * 37) % this.particlesX.length) / this.particlesX.length;
      this.particlesY[index] = -0.5 + ((index * 53) % this.particlesY.length) / this.particlesY.length;
    }
  }

  #resetLaplace(preset) {
    const lastColumn = this.columns - 1;
    const lastRow = this.rows - 1;
    for (let row = 0; row < this.rows; row += 1) {
      this.scalar[fieldIndex(0, row, this.columns)] = preset === 'cold-walls' ? 0 : 1;
      this.scalar[fieldIndex(lastColumn, row, this.columns)] = 0;
    }
    if (preset === 'two-electrodes') {
      for (let column = 0; column < this.columns; column += 1) {
        this.scalar[fieldIndex(column, 0, this.columns)] = column < this.columns / 2 ? 1 : -1;
        this.scalar[fieldIndex(column, lastRow, this.columns)] = column < this.columns / 2 ? -1 : 1;
      }
    }
    if (preset === 'point-electrode') {
      this.scalar.fill(0);
      for (let r = Math.floor(this.rows / 2) - 2; r <= Math.floor(this.rows / 2) + 2; r++) this.scalar[r * this.columns] = 1;
    }
    this.#relaxLaplace(2400);
  }

  velocityAt(x, y) {
    if (this.id === 'geometry') return [0, 0];
    if (this.id === 'laplace') {
      const hx = 2 / (this.columns - 1);
      const hy = 1.2 / (this.rows - 1);
      const gx = (bilinear(this.scalar, this.columns, this.rows, x + hx, y, false)
        - bilinear(this.scalar, this.columns, this.rows, x - hx, y, false)) / (2 * hx);
      const gy = (bilinear(this.scalar, this.columns, this.rows, x, y + hy, false)
        - bilinear(this.scalar, this.columns, this.rows, x, y - hy, false)) / (2 * hy);
      return [-gx, -gy];
    }
    const strength = Number(this.parameters.speed ?? this.parameters.strength ?? 0.6);
    const field = this.parameters.velocityField ?? this.parameters.field ?? 'uniform';
    if (field === 'rotation' || field === 'vortex') {
      const radius2 = x * x + y * y + 0.08;
      const factor = field === 'vortex' ? strength / radius2 : strength;
      return [-factor * y, factor * x];
    }
    if (field === 'shear') return [strength * (0.25 + y), 0];
    if (field === 'source') {
      const radius = Math.hypot(x, y) + 0.1;
      return [strength * x / radius, strength * y / radius];
    }
    if (field === 'sink') {
      const radius = Math.hypot(x, y) + 0.1;
      return [-strength * x / radius, -strength * y / radius];
    }
    if (field === 'source-vortex') {
      const radius2 = x * x + y * y + 0.08;
      return [strength * (x - y) / radius2, strength * (y + x) / radius2];
    }
    const angle = Number(this.parameters.angle ?? 0);
    let vx = strength * Math.cos(angle);
    let vy = strength * Math.sin(angle);
    return [vx, vy];
  }

  #advectDiffuse(elapsed) {
    advanceScalar2D(this, elapsed, this.id === 'geometry' ? (x, y) => this.#insideObstacle(x, y) : null);
  }

  #insideObstacle(x, y) {
    const geometry = this.parameters.geometry;
    if (geometry === 'none') return false;
    const dx = x - Number(this.parameters.obstacleX ?? 0);
    const dy = y - Number(this.parameters.obstacleY ?? 0);
    if (geometry === 'square') return Math.abs(dx) < 0.25 && Math.abs(dy) < 0.2;
    if (geometry === 'two-cylinders') {
      return (dx + 0.22) ** 2 + (dy - 0.16) ** 2 < 0.035
        || (dx - 0.22) ** 2 + (dy + 0.16) ** 2 < 0.035;
    }
    if (geometry === 'narrowing') return dx > -0.1 && dx < 0.35 && Math.abs(dy) > 0.3;
    return dx * dx + dy * dy < 0.075;
  }

  #relaxLaplace(iterations = 30) {
    const ax = ((this.columns - 1) / 2) ** 2, ay = ((this.rows - 1) / 1.2) ** 2;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      let change = 0;
      for (let row = 1; row < this.rows - 1; row += 1) {
        for (let column = 1; column < this.columns - 1; column += 1) {
          const i = fieldIndex(column, row, this.columns);
          const target = (ax * (this.scalar[i - 1] + this.scalar[i + 1])
            + ay * (this.scalar[i - this.columns] + this.scalar[i + this.columns])) / (2 * (ax + ay));
          const delta = 1.75 * (target - this.scalar[i]);
          this.scalar[i] += delta;
          change = Math.max(change, Math.abs(delta));
        }
      }
      if (change < 1e-7) break;
    }
  }

  #refreshVectorCalculus() {
    const spacingX = 2 / (this.columns - 1);
    const spacingY = 1.2 / (this.rows - 1);
    for (let row = 0; row < this.rows; row += 1) {
      const y = -0.6 + 1.2 * row / (this.rows - 1);
      for (let column = 0; column < this.columns; column += 1) {
        const x = -1 + 2 * column / (this.columns - 1);
        const [vxLeft, vyLeft] = this.velocityAt(x - spacingX, y);
        const [vxRight, vyRight] = this.velocityAt(x + spacingX, y);
        const [vxDown, vyDown] = this.velocityAt(x, y - spacingY);
        const [vxUp, vyUp] = this.velocityAt(x, y + spacingY);
        const divergence = (vxRight - vxLeft) / (2 * spacingX) + (vyUp - vyDown) / (2 * spacingY);
        const curl = (vyRight - vyLeft) / (2 * spacingX) - (vxUp - vxDown) / (2 * spacingY);
        this.scalar[fieldIndex(column, row, this.columns)] = this.parameters.display === 'curl' ? curl : divergence;
      }
    }
  }

  #refreshDisplay() {
    if (this.id === 'vector-calculus') this.#refreshVectorCalculus();
    this.data.set(this.scalar);
    if (this.id === 'geometry') {
      for (let row = 0; row < this.rows; row += 1) {
        const y = -0.6 + 1.2 * (row + 0.5) / this.rows;
        for (let column = 0; column < this.columns; column += 1) {
          const x = -1 + 2 * (column + 0.5) / this.columns;
          if (this.#insideObstacle(x, y)) this.data[fieldIndex(column, row, this.columns)] = Number.NaN;
        }
      }
    }
    let mean = 0;
    let count = 0;
    for (const value of this.data) {
      if (Number.isFinite(value)) {
        mean += value;
        count += 1;
      }
    }
    const pe = Number(this.parameters.D) > 0 ? (2 * Number(this.parameters.speed) / Number(this.parameters.D)).toFixed(1) : '∞';
    this.observable = this.id === 'laplace' ? '∇²φ = 0 · t —'
      : `${this.id === 'advection-diffusion' ? `Pe = ${pe} · ` : ''}t ${this.time.toFixed(2)} · ⟨u⟩ ${count ? (mean / count).toFixed(3) : '—'}`;
  }

  step(elapsed) {
    if (!(elapsed > 0)) return;
    if (this.id === 'laplace') return;
    this.time += elapsed;
    if (this.id !== 'vector-calculus') this.#advectDiffuse(elapsed);
    {
      for (let index = 0; index < this.particlesX.length; index += 1) {
        const [vx, vy] = this.velocityAt(this.particlesX[index], this.particlesY[index]);
        this.particlesX[index] = ((this.particlesX[index] + vx * elapsed + 1) % 2 + 2) % 2 - 1;
        this.particlesY[index] = ((this.particlesY[index] + vy * elapsed + 0.6) % 1.2 + 1.2) % 1.2 - 0.6;
      }
    }
    this.#refreshDisplay();
  }

  paintAt(x, y, value = 1) {
    const column = clamp(Math.round((x + 1) * 0.5 * (this.columns - 1)), 0, this.columns - 1);
    const row = clamp(Math.round((y + 0.6) / 1.2 * (this.rows - 1)), 0, this.rows - 1);
    const radius = 3;
    if (this.id === 'laplace') {
      const distances = [column, this.columns - 1 - column, row, this.rows - 1 - row];
      const nearest = distances.indexOf(Math.min(...distances));
      for (let offset = -radius; offset <= radius; offset += 1) {
        const c = nearest < 2 ? (nearest === 0 ? 0 : this.columns - 1) : clamp(column + offset, 0, this.columns - 1);
        const r = nearest >= 2 ? (nearest === 2 ? 0 : this.rows - 1) : clamp(row + offset, 0, this.rows - 1);
        this.scalar[fieldIndex(c, r, this.columns)] = Number(this.parameters.brushValue ?? value);
      }
      this.#relaxLaplace(2400);
    } else {
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const c = clamp(column + ox, 0, this.columns - 1);
          const r = clamp(row + oy, 0, this.rows - 1);
          const weight = Math.exp(-(ox * ox + oy * oy) / 5);
          this.scalar[fieldIndex(c, r, this.columns)] = value * weight;
        }
      }
    }
    this.#refreshDisplay();
  }

  probeAt(x, y) {
    const c = clamp(Math.round((x + 1) / 2 * (this.columns - 1)), 0, this.columns - 1);
    const r = clamp(Math.round((y + 0.6) / 1.2 * (this.rows - 1)), 0, this.rows - 1);
    return { x, y, value: this.data[r * this.columns + c] };
  }
}

export class BalanceLessonModel {
  constructor(id) {
    if (id !== 'conservation' && id !== 'integral-conservation') {
      throw new RangeError(`unsupported balance lesson: ${id}`);
    }
    this.id = id;
    this.parameters = {
      inflow: 1, outflow: 0.65, source: 0.1, position: 0, size: 0.55, interpretation: 'mass',
    };
    this.reset();
  }

  setParameter(name, value) {
    this.parameters[name] = value;
    this.#update();
  }

  reset(preset = 'balanced') {
    this.preset = preset;
    const values = {
      balanced: [1, 1, 0],
      filling: [1.2, 0.4, 0],
      draining: [0.35, 1, 0],
      source: [0.5, 0.5, 0.6],
      sink: [0.7, 0.5, -0.4],
    }[preset] ?? [1, 1, 0];
    [this.parameters.inflow, this.parameters.outflow, this.parameters.source] = values;
    this.time = 0;
    this.stored = 1;
    this.density = 1;
    this.#update();
    return this;
  }

  restart() {
    this.time = 0; this.density = 1; this.stored = 1;
    this.#update();
    return this;
  }

  #update() {
    const volume = this.id === 'integral-conservation' ? Number(this.parameters.size) : 1;
    const p = this.parameters;
    this.sourceRate = Number(p.source) * volume;
    if (this.id === 'integral-conservation') {
      const gradient = (Number(p.outflow) - Number(p.inflow)) / 2;
      const flux = x => Number(p.inflow) + gradient * (x + 1);
      this.fluxIn = flux(Number(p.position) - volume / 2);
      this.fluxOut = flux(Number(p.position) + volume / 2);
      this.stored = volume * (this.density + 0.2 * Number(p.position));
      this.rate = volume * (Number(p.source) - gradient);
    } else {
      this.fluxIn = Number(p.inflow);
      this.fluxOut = Number(p.outflow);
      this.rate = this.fluxIn - this.fluxOut + Number(p.source);
      if (this.stored <= 0 && this.rate < 0) {
        // A prescribed removal cannot take mass from an empty volume.
        this.sourceRate = Math.max(Number(p.source), -this.fluxIn);
        this.fluxOut = Math.max(0, this.fluxIn + this.sourceRate);
        this.rate = 0;
      }
    }
    this.observable = `M ${this.stored.toFixed(3)} · Qᵢₙ ${this.fluxIn.toFixed(2)} · Qₒᵤₜ ${this.fluxOut.toFixed(2)} · dM/dt ${this.rate.toFixed(3)}${this.id === 'integral-conservation' ? ` · Ṁ/|Ω| ${(this.rate / volume).toFixed(3)}` : ''}`;
  }

  step(elapsed) {
    this.time += elapsed;
    this.density += (Number(this.parameters.source) - (Number(this.parameters.outflow) - Number(this.parameters.inflow)) / 2) * elapsed;
    this.stored = Math.max(0, this.stored + this.rate * elapsed);
    this.#update();
  }
}

export class ShallowWaterLessonModel {
  constructor() {
    this.id = 'shallow-water';
    this.columns = 64;
    this.rows = 40;
    const size = this.columns * this.rows;
    this.height = new Float32Array(size);
    this.u = new Float32Array(size);
    this.v = new Float32Array(size);
    this.nextHeight = new Float32Array(size);
    this.nextU = new Float32Array(size);
    this.nextV = new Float32Array(size);
    this.data = new Float32Array(size);
    this.parameters = { gravity: 1, amplitude: 0.35, initialVelocity: 0, display: 'height', obstacle: 'none' };
    this.reset();
  }

  setParameter(name, value) {
    this.parameters[name] = value;
    if (name === 'amplitude' || name === 'initialVelocity') this.reset(this.preset);
    else this.#refreshDisplay();
  }

  reset(preset = 'drop') {
    this.preset = preset;
    this.time = 0;
    for (let row = 0; row < this.rows; row += 1) {
      const y = -0.6 + 1.2 * (row + 0.5) / this.rows;
      for (let column = 0; column < this.columns; column += 1) {
        const x = -1 + 2 * (column + 0.5) / this.columns;
        let perturbation = Number(this.parameters.amplitude) * Math.exp(-(x * x + y * y) / 0.025);
        if (preset === 'circular') perturbation = Number(this.parameters.amplitude) * Math.exp(-(((Math.hypot(x, y) - 0.25) / 0.06) ** 2));
        if (preset === 'dam-break') perturbation = x < -0.2 ? Number(this.parameters.amplitude) : 0;
        if (preset === 'counterflow') perturbation = 0;
        const index = fieldIndex(column, row, this.columns);
        this.height[index] = 1 + perturbation;
        this.u[index] = preset === 'counterflow' ? (y > 0 ? 0.35 : -0.35) : Number(this.parameters.initialVelocity);
        this.v[index] = 0;
      }
    }
    this.#refreshDisplay();
    return this;
  }

  #obstacle(x, y) {
    return this.parameters.obstacle === 'circle' && x * x + y * y < 0.045;
  }

  step(elapsed) {
    if (!(elapsed > 0)) return;
    advanceShallowWater(this, elapsed, (x, y) => this.#obstacle(x, y));
    this.time += elapsed;
    this.#refreshDisplay();
  }

  velocityAt(x, y) {
    const column = clamp(Math.round((x + 1) * 0.5 * (this.columns - 1)), 0, this.columns - 1);
    const row = clamp(Math.round((y + 0.6) / 1.2 * (this.rows - 1)), 0, this.rows - 1);
    const index = fieldIndex(column, row, this.columns);
    return [this.u[index], this.v[index]];
  }

  #refreshDisplay() {
    if (this.parameters.display === 'speed') {
      for (let index = 0; index < this.data.length; index += 1) {
        this.data[index] = Math.hypot(this.u[index], this.v[index]);
      }
    } else this.data.set(this.height);
    if (this.parameters.obstacle === 'circle') {
      for (let row = 0; row < this.rows; row += 1) {
        const y = -0.6 + 1.2 * (row + 0.5) / this.rows;
        for (let column = 0; column < this.columns; column += 1) {
          const x = -1 + 2 * (column + 0.5) / this.columns;
          if (this.#obstacle(x, y)) this.data[fieldIndex(column, row, this.columns)] = Number.NaN;
        }
      }
    }
    this.observable = `t ${this.time.toFixed(2)} · ⟨h⟩ ${(this.height.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) / this.height.length).toFixed(3)}`;
  }
}

export class IncompressibleLessonModel {
  constructor() {
    this.id = 'incompressibility';
    this.columns = 48;
    this.rows = 30;
    const size = this.columns * this.rows;
    this.u = new Float32Array(size);
    this.v = new Float32Array(size);
    this.pressure = new Float64Array(size);
    this.nextU = new Float32Array(size);
    this.nextV = new Float32Array(size);
    this.divergence = new Float32Array(size);
    this.data = new Float32Array(size);
    this.parameters = { viscosity: 0.01, inflow: 0.45, display: 'velocity', obstacle: 'none' };
    this.reset();
  }

  setParameter(name, value) {
    const previous = this.parameters[name];
    this.parameters[name] = value;
    if (name === 'inflow') for (let i = 0; i < this.u.length; i++) this.u[i] += Number(value) - Number(previous);
    this.#refreshDisplay();
  }

  reset(preset = 'channel') {
    this.preset = preset;
    this.time = 0;
    this.u.fill(Number(this.parameters.inflow));
    this.v.fill(0);
    this.pressure.fill(0);
    if (preset === 'vortex') this.inject(0, 0, 0, 1);
    this.#project();
    this.#refreshDisplay();
    return this;
  }

  inject(x, y, vx, vy) {
    const centerColumn = clamp(Math.round((x + 1) * 0.5 * (this.columns - 1)), 1, this.columns - 2);
    const centerRow = clamp(Math.round((y + 0.6) / 1.2 * (this.rows - 1)), 1, this.rows - 2);
    for (let oy = -3; oy <= 3; oy += 1) {
      for (let ox = -3; ox <= 3; ox += 1) {
        const weight = Math.exp(-(ox * ox + oy * oy) / 5);
        const index = fieldIndex((centerColumn + ox + this.columns) % this.columns, (centerRow + oy + this.rows) % this.rows, this.columns);
        this.u[index] += vx * weight;
        this.v[index] += vy * weight;
      }
    }
    this.#project();
    this.#refreshDisplay();
  }

  #project() {
    projectPeriodic(this.u, this.v, this.columns, this.rows, 2 / this.columns, 1.2 / this.rows, this.pressure, this.divergence);
  }

  step(elapsed) {
    if (!(elapsed > 0)) return;
    const nx = this.columns, ny = this.rows, dx = 2 / nx, dy = 1.2 / ny;
    const viscosity = Number(this.parameters.viscosity);
    const steps = Math.max(1, Math.ceil(elapsed * viscosity * (1 / dx ** 2 + 1 / dy ** 2) / 0.4));
    const dt = elapsed / steps;
    // Unsteady Stokes flow: viscosity diffuses velocity; uniform flow is unchanged.
    for (let step = 0; step < steps; step++) {
      for (const [field, next] of [[this.u, this.nextU], [this.v, this.nextV]]) {
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          const i = y * nx + x;
          next[i] = field[i] + viscosity * dt * (
            (field[y * nx + (x + nx - 1) % nx] - 2 * field[i] + field[y * nx + (x + 1) % nx]) / dx ** 2
            + (field[(y + ny - 1) % ny * nx + x] - 2 * field[i] + field[(y + 1) % ny * nx + x]) / dy ** 2);
        }
      }
      this.u.set(this.nextU); this.v.set(this.nextV);
    }
    this.#project();
    for (let i = 0; i < this.pressure.length; i++) this.pressure[i] /= elapsed;
    this.time += elapsed;
    this.#refreshDisplay();
  }

  velocityAt(x, y) {
    const column = clamp(Math.round((x + 1) * 0.5 * (this.columns - 1)), 0, this.columns - 1);
    const row = clamp(Math.round((y + 0.6) / 1.2 * (this.rows - 1)), 0, this.rows - 1);
    const index = fieldIndex(column, row, this.columns);
    return [this.u[index], this.v[index]];
  }

  #refreshDisplay() {
    if (this.parameters.display === 'pressure') this.data.set(this.pressure);
    else if (this.parameters.display === 'divergence') this.data.set(this.divergence);
    else {
      for (let index = 0; index < this.data.length; index += 1) {
        this.data[index] = Math.hypot(this.u[index], this.v[index]);
      }
    }
    let maxDivergence = 0;
    for (const value of this.divergence) maxDivergence = Math.max(maxDivergence, Math.abs(value));
    this.observable = `max |∇·u| ${maxDivergence.toExponential(2)}`;
  }
}

export function createLessonModel(id) {
  if (id in CURVE_DEFAULTS) return new CurveLessonModel(id);
  if (id in FIELD_DEFAULTS) return new FieldLessonModel(id);
  if (id === 'conservation' || id === 'integral-conservation') return new BalanceLessonModel(id);
  if (id === 'shallow-water') return new ShallowWaterLessonModel();
  if (id === 'incompressibility') return new IncompressibleLessonModel();
  throw new RangeError(`no interactive lesson model for ${id}`);
}
