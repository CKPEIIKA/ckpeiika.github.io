/**
 * Browser-independent spatial DSMC laboratory model.
 *
 * Positions use a 10 × 6 nondimensional display domain. Molecular velocities,
 * temperature, mass, cross sections, and time use SI units. The represented
 * depth is 1 μm. Arrays use structure-of-arrays particle storage and row-major
 * collision cells. Snapshots expose stable read-only views until reset.
 *
 * This model implements elastic hard-sphere/VHS/VSS collisions and optional
 * rotational Larsen–Borgnakke exchange. It does not model vibration,
 * chemistry, reactions, or a physical out-of-plane geometry.
 */

import { Dsmc } from './dsmc-lab-core.js';
import { DsmcTyped } from './dsmc-lab-runtime.js';

export const DSMC_LAB_CASES = Object.freeze([
  'equilibrium-box',
  'heat-transfer-x',
  'rotational-nitrogen',
  'couette-flow',
]);

const CASE_SET = new Set(DSMC_LAB_CASES);
const COLLISION_MODELS = new Set(['hard-sphere', 'vhs', 'vss']);
const WORLD = Object.freeze({
  width: 10,
  height: 6,
  depth: 1e-6,
});
const HISTOGRAM_BINS = 36;
const HISTOGRAM_MAX_SPEED = 2600;
const CHARACTERISTIC_LENGTH = WORLD.width;
const WALL_PADDING = 0.008;

const PRESETS = Object.freeze({
  'equilibrium-box': Object.freeze({
    baseCase: 'monospecies_heat_bath',
    species: 'Ar',
    collisionModel: 'vhs',
    particleCount: 2400,
    knudsen: 0.2,
    cellSize: 0.16,
    timeStep: 0.0003,
    wallTemperatureLeft: 300,
    wallTemperatureRight: 300,
    wallAccommodation: 1,
    wallSpeed: 0,
    rotationalRelaxation: false,
    initialRotationalTemperature: null,
    xBoundary: 'periodic',
    yBoundary: 'periodic',
  }),
  'heat-transfer-x': Object.freeze({
    baseCase: 'monospecies_heat_bath',
    species: 'Ar',
    collisionModel: 'vhs',
    particleCount: 4000,
    knudsen: 0.2,
    cellSize: 0.2,
    timeStep: 0.0002,
    wallTemperatureLeft: 300,
    wallTemperatureRight: 800,
    wallAccommodation: 1,
    wallSpeed: 0,
    rotationalRelaxation: false,
    initialRotationalTemperature: null,
    xBoundary: 'wall',
    yBoundary: 'periodic',
  }),
  'rotational-nitrogen': Object.freeze({
    baseCase: 'n2_heat_bath',
    species: 'N2',
    collisionModel: 'vss',
    particleCount: 3200,
    knudsen: 0.2,
    cellSize: 0.2,
    timeStep: 0.0002,
    wallTemperatureLeft: 800,
    wallTemperatureRight: 800,
    wallAccommodation: 1,
    wallSpeed: 0,
    rotationalRelaxation: true,
    initialRotationalTemperature: 100,
    xBoundary: 'periodic',
    yBoundary: 'periodic',
  }),
  'couette-flow': Object.freeze({
    baseCase: 'monospecies_heat_bath',
    species: 'Ar',
    collisionModel: 'vhs',
    particleCount: 4000,
    knudsen: 0.15,
    cellSize: 0.2,
    timeStep: 0.00015,
    wallTemperatureLeft: 400,
    wallTemperatureRight: 400,
    wallAccommodation: 1,
    wallSpeed: 250,
    rotationalRelaxation: false,
    initialRotationalTemperature: null,
    xBoundary: 'periodic',
    yBoundary: 'wall',
  }),
});

const DEFAULT_PARAMETERS = Object.freeze({
  caseId: 'equilibrium-box',
  seed: 2026,
  ...PRESETS['equilibrium-box'],
});

function unchangedError(ErrorType, message) {
  return new ErrorType(`${message} No model state was changed.`);
}

function finite(parameters, name) {
  if (!Number.isFinite(parameters[name])) {
    throw unchangedError(
      TypeError,
      `${name} is ${String(parameters[name])}; expected a finite number.`,
    );
  }
}

function validateParameters(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw unchangedError(TypeError, 'parameters must be an object.');
  }
  const requestedCase = patch.caseId ?? base.caseId;
  if (!CASE_SET.has(requestedCase)) {
    throw unchangedError(
      RangeError,
      `caseId is ${String(requestedCase)}; expected one of ${DSMC_LAB_CASES.join(', ')}.`,
    );
  }
  const changedCase = requestedCase !== base.caseId;
  const parameters = changedCase
    ? {
      seed: base.seed,
      caseId: requestedCase,
      ...PRESETS[requestedCase],
      ...patch,
    }
    : { ...base, ...patch };
  if (!Number.isInteger(parameters.particleCount)
      || parameters.particleCount < 64
      || parameters.particleCount > 50_000) {
    throw unchangedError(
      RangeError,
      `particleCount is ${parameters.particleCount}; expected an integer from 64 to 50000.`,
    );
  }
  if (!Number.isInteger(parameters.seed)
      || parameters.seed < 0
      || parameters.seed > 0xffff_ffff) {
    throw unchangedError(
      RangeError,
      `seed is ${parameters.seed}; expected an integer from 0 to 4294967295.`,
    );
  }
  for (const name of [
    'knudsen',
    'cellSize',
    'timeStep',
    'wallTemperatureLeft',
    'wallTemperatureRight',
    'wallAccommodation',
    'wallSpeed',
  ]) {
    finite(parameters, name);
  }
  if (parameters.knudsen <= 0 || parameters.knudsen > 5) {
    throw unchangedError(
      RangeError,
      `knudsen is ${parameters.knudsen}; expected 0 < knudsen <= 5.`,
    );
  }
  if (parameters.cellSize < 0.05 || parameters.cellSize > 5) {
    throw unchangedError(
      RangeError,
      `cellSize is ${parameters.cellSize}; expected a value from 0.05 to 5.`,
    );
  }
  if (parameters.timeStep <= 0 || parameters.timeStep > 0.02) {
    throw unchangedError(
      RangeError,
      `timeStep is ${parameters.timeStep}; expected 0 < timeStep <= 0.02 s.`,
    );
  }
  if (parameters.wallTemperatureLeft <= 0 || parameters.wallTemperatureRight <= 0) {
    throw unchangedError(
      RangeError,
      'wall temperatures must be strictly positive.',
    );
  }
  if (parameters.wallAccommodation < 0 || parameters.wallAccommodation > 1) {
    throw unchangedError(
      RangeError,
      `wallAccommodation is ${parameters.wallAccommodation}; expected a value from 0 to 1.`,
    );
  }
  if (!COLLISION_MODELS.has(parameters.collisionModel)) {
    throw unchangedError(
      RangeError,
      `collisionModel is ${String(parameters.collisionModel)}; expected hard-sphere, vhs, or vss.`,
    );
  }
  return Object.freeze(parameters);
}

function wrapCoordinate(value, minimum, maximum) {
  const length = maximum - minimum;
  const normalized = (value - minimum) % length;
  return minimum + (normalized < 0 ? normalized + length : normalized);
}

function kineticEnergy(mass, velocity) {
  return 0.5 * mass * (
    velocity[0] * velocity[0]
    + velocity[1] * velocity[1]
    + velocity[2] * velocity[2]
  );
}

function totalInvariants(state) {
  let energy = 0;
  let momentumX = 0;
  let momentumY = 0;
  let momentumZ = 0;
  for (let index = 0; index < state.count; index += 1) {
    const mass = state.mass[index];
    const velocityX = state.vx[index];
    const velocityY = state.vy[index];
    const velocityZ = state.vz[index];
    energy += 0.5 * mass * (
      velocityX * velocityX
      + velocityY * velocityY
      + velocityZ * velocityZ
    ) + state.eRot[index];
    momentumX += mass * velocityX;
    momentumY += mass * velocityY;
    momentumZ += mass * velocityZ;
  }
  return Object.freeze({
    energy,
    momentumX,
    momentumY,
    momentumZ,
  });
}

function copyState(state) {
  const output = {};
  for (const [name, value] of Object.entries(state)) {
    output[name] = ArrayBuffer.isView(value) ? value.slice() : value;
  }
  return Object.freeze(output);
}

function maxwellianSpeedDensity(speed, mass, temperature) {
  if (!(mass > 0) || !(temperature > 0)) return 0;
  const factor = mass / (2 * Math.PI * Dsmc.KB * temperature);
  return 4 * Math.PI * factor ** 1.5 * speed * speed
    * Math.exp(-mass * speed * speed / (2 * Dsmc.KB * temperature));
}

export class DsmcLabModel {
  constructor(options = {}) {
    this.metadata = Object.freeze({
      id: 'dsmc-lab',
      status: 'verified',
      seed: options.seed ?? DEFAULT_PARAMETERS.seed,
      units: 'SI velocities, temperature, mass, cross section, and time; nondimensional display position',
    });
    this.disposed = false;
    this._parameters = DEFAULT_PARAMETERS;
    this._time = 0;
    this._stepCount = 0;
    this.reset(options);
  }

  get parameters() {
    return this._parameters;
  }

  get state() {
    this._assertActive();
    return this._state;
  }

  get time() {
    return this._time;
  }

  _assertActive() {
    if (this.disposed) {
      throw unchangedError(Error, 'dsmc-lab model is disposed.');
    }
  }

  reset(parameters = {}) {
    this._assertActive();
    const next = validateParameters(this._parameters, parameters);
    const core = DsmcTyped.createRuntime();
    const loadedCase = Dsmc.loadHeatBathCase(next.baseCase);
    const species = loadedCase.species[next.species];
    if (!species) {
      throw unchangedError(
        RangeError,
        `species ${next.species} is unavailable in ${next.baseCase}.`,
      );
    }
    core.setSeed(next.seed);
    core.configureGrid(WORLD.width, WORLD.height, next.cellSize);
    const particles = this._seedParticles(core, species, next);
    core.loadParticles(particles);
    core.buildCellCache(false);

    const count = core.state.count;
    const speedBins = new Float64Array(HISTOGRAM_BINS);
    const speedHistogram = new Float64Array(HISTOGRAM_BINS);
    const maxwellian = new Float64Array(HISTOGRAM_BINS);
    for (let bin = 0; bin < HISTOGRAM_BINS; bin += 1) {
      speedBins[bin] = (bin + 0.5) * HISTOGRAM_MAX_SPEED / HISTOGRAM_BINS;
    }
    const state = Object.freeze({
      positionsX: core.state.x.subarray(0, count),
      positionsY: core.state.y.subarray(0, count),
      velocityX: core.state.vx.subarray(0, count),
      velocityY: core.state.vy.subarray(0, count),
      velocityZ: core.state.vz.subarray(0, count),
      mass: core.state.mass.subarray(0, count),
      rotationalEnergy: core.state.eRot.subarray(0, count),
      styleIndex: core.state.speciesIndex.subarray(0, count),
      occupancy: core.cells.counts.subarray(0, core.cells.totalCells),
      speedBins,
      speedHistogram,
      maxwellian,
    });

    this._parameters = next;
    this._core = core;
    this._loadedCase = loadedCase;
    this._species = species;
    this._state = state;
    this._time = 0;
    this._stepCount = 0;
    this._collisionCount = 0;
    this._lastCollisionResult = Object.freeze({
      collided: 0,
      attempted: 0,
      majorantViolations: 0,
      candidateOverflow: 0,
      rotEvents: 0,
      overflowed: false,
    });
    this._wallEnergy = {
      left: 0,
      right: 0,
      bottom: 0,
      top: 0,
    };
    this._initialInvariants = totalInvariants(core.state);
    this._ntcWeight = this._computeNtcWeight();
    this._refreshDistribution();
    this._diagnostics = this._computeDiagnostics();
    return this;
  }

  _seedParticles(core, species, parameters) {
    const count = parameters.particleCount;
    const temperature = 0.5 * (
      parameters.wallTemperatureLeft + parameters.wallTemperatureRight
    );
    const boundaryX = parameters.xBoundary === 'periodic' ? 0 : WALL_PADDING;
    const boundaryY = parameters.yBoundary === 'periodic' ? 0 : WALL_PADDING;
    const particles = new Array(count);
    const velocities = Dsmc.maxwellVelocities(
      count,
      species.mass_kg,
      temperature,
      [0, 0, 0],
      () => core.random(),
    );
    let meanX = 0;
    let meanY = 0;
    let meanZ = 0;
    for (const velocity of velocities) {
      meanX += velocity[0];
      meanY += velocity[1];
      meanZ += velocity[2];
    }
    meanX /= count;
    meanY /= count;
    meanZ /= count;
    let variance = 0;
    for (const velocity of velocities) {
      variance += (velocity[0] - meanX) ** 2
        + (velocity[1] - meanY) ** 2
        + (velocity[2] - meanZ) ** 2;
    }
    const targetVariance = 3 * Dsmc.KB * temperature / species.mass_kg;
    const scale = variance > 0 ? Math.sqrt(count * targetVariance / variance) : 1;
    const rotationalDof = Math.max(
      0,
      Number(species.rotational_degrees_of_freedom || 0),
    );
    const rotationalTemperature = Number.isFinite(parameters.initialRotationalTemperature)
      ? parameters.initialRotationalTemperature
      : temperature;

    for (let index = 0; index < count; index += 1) {
      const velocity = velocities[index];
      particles[index] = {
        x: boundaryX + core.random() * (WORLD.width - 2 * boundaryX),
        y: boundaryY + core.random() * (WORLD.height - 2 * boundaryY),
        vx: (velocity[0] - meanX) * scale,
        vy: (velocity[1] - meanY) * scale,
        vz: (velocity[2] - meanZ) * scale,
        mass: species.mass_kg,
        species: species.name,
        speciesData: species,
        rotDof: rotationalDof,
        eRot: 0.5 * rotationalDof * Dsmc.KB * rotationalTemperature,
        color: '#ece9d8',
        renderJitterX: 0,
        renderJitterY: 0,
      };
    }
    return particles;
  }

  _referenceCrossSection() {
    const species = this._species;
    const reducedMass = Dsmc.reducedMass(species.mass_kg, species.mass_kg);
    const referenceTemperature = this._loadedCase.reference_temperature_k;
    const relativeSpeed = Math.sqrt(
      8 * Dsmc.KB * referenceTemperature / (Math.PI * reducedMass),
    );
    const sigmaTimesSpeed = this._parameters.collisionModel === 'hard-sphere'
      ? Dsmc.hardSphereSigmaTCr(species, species, relativeSpeed)
      : Dsmc.vhsVssSigmaTCr(
        species,
        species,
        relativeSpeed,
        referenceTemperature,
      );
    return sigmaTimesSpeed / relativeSpeed;
  }

  _computeNtcWeight() {
    const crossSection = Math.max(1e-30, this._referenceCrossSection());
    const meanFreePath = this._parameters.knudsen * CHARACTERISTIC_LENGTH;
    const numberDensity = 1 / (Math.SQRT2 * crossSection * meanFreePath);
    const volume = WORLD.width * WORLD.height * WORLD.depth;
    return numberDensity * volume / this._parameters.particleCount;
  }

  _wallTemperature(normal, axis) {
    if (axis === 'x') {
      return normal[0] > 0
        ? this._parameters.wallTemperatureLeft
        : this._parameters.wallTemperatureRight;
    }
    return 0.5 * (
      this._parameters.wallTemperatureLeft
      + this._parameters.wallTemperatureRight
    );
  }

  _wallVelocity(normal, axis) {
    if (axis === 'y' && this._parameters.caseId === 'couette-flow') {
      return [
        normal[1] < 0 ? this._parameters.wallSpeed : -this._parameters.wallSpeed,
        0,
        0,
      ];
    }
    return [0, 0, 0];
  }

  _reflectVelocity(mass, velocity, normal, axis) {
    const diffuse = this._core.random() < this._parameters.wallAccommodation;
    if (!diffuse) return Dsmc.specularReflection(velocity, normal);
    const before = kineticEnergy(mass, velocity);
    const sampled = Dsmc.diffuseWallVelocity(
      this._wallTemperature(normal, axis),
      mass,
      normal,
      this._wallVelocity(normal, axis),
      () => this._core.random(),
    );
    if (axis === 'x') {
      sampled[0] = normal[0] > 0 ? Math.abs(sampled[0]) : -Math.abs(sampled[0]);
    } else {
      sampled[1] = normal[1] > 0 ? Math.abs(sampled[1]) : -Math.abs(sampled[1]);
    }
    const wall = axis === 'x'
      ? (normal[0] > 0 ? 'left' : 'right')
      : (normal[1] > 0 ? 'bottom' : 'top');
    this._wallEnergy[wall] += kineticEnergy(mass, sampled) - before;
    return sampled;
  }

  step(dt) {
    this._assertActive();
    if (!Number.isFinite(dt)) {
      throw unchangedError(TypeError, `dt is ${String(dt)}; expected a finite number.`);
    }
    if (dt < 0) {
      throw unchangedError(RangeError, `dt is ${dt}; expected a non-negative value.`);
    }
    if (dt === 0) return this;
    const xPeriodic = this._parameters.xBoundary === 'periodic';
    const yPeriodic = this._parameters.yBoundary === 'periodic';
    this._core.moveParticles(dt, {
      boundaryMode: 'mixed',
      xMode: xPeriodic ? 'periodic' : 'mixed',
      yMode: yPeriodic ? 'periodic' : 'mixed',
      left: xPeriodic ? 0 : WALL_PADDING,
      right: xPeriodic ? WORLD.width : WORLD.width - WALL_PADDING,
      bottom: yPeriodic ? 0 : WALL_PADDING,
      top: yPeriodic ? WORLD.height : WORLD.height - WALL_PADDING,
      wrapCoord: wrapCoordinate,
      reflectVelocity: (_index, normal, axis, mass, velocity) => (
        this._reflectVelocity(mass, velocity, normal, axis)
      ),
    });
    this._core.buildCellCache();
    const result = this._core.collisionStep({
      dt,
      ntcWeight: this._ntcWeight,
      ntcMargin: 1.2,
      referenceTemperatureK: this._loadedCase.reference_temperature_k,
      cellVolume: this._core.cells.cellW * this._core.cells.cellH * WORLD.depth,
      collisionModel: this._parameters.collisionModel,
      enableRotationalLB: this._parameters.rotationalRelaxation,
      random: () => this._core.random(),
      collisionLineProbability: 0,
    });
    this._lastCollisionResult = Object.freeze(result);
    this._collisionCount += result.collided;
    this._time += dt;
    this._stepCount += 1;
    this._refreshDistribution();
    this._diagnostics = this._computeDiagnostics();
    return this;
  }

  _moments() {
    const state = this._core.state;
    let totalMass = 0;
    let momentumX = 0;
    let momentumY = 0;
    let momentumZ = 0;
    for (let index = 0; index < state.count; index += 1) {
      const mass = state.mass[index];
      totalMass += mass;
      momentumX += mass * state.vx[index];
      momentumY += mass * state.vy[index];
      momentumZ += mass * state.vz[index];
    }
    const bulkX = momentumX / totalMass;
    const bulkY = momentumY / totalMass;
    const bulkZ = momentumZ / totalMass;
    let thermalEnergy = 0;
    let rotationalEnergy = 0;
    let rotationalDof = 0;
    for (let index = 0; index < state.count; index += 1) {
      const fluctuationX = state.vx[index] - bulkX;
      const fluctuationY = state.vy[index] - bulkY;
      const fluctuationZ = state.vz[index] - bulkZ;
      thermalEnergy += 0.5 * state.mass[index] * (
        fluctuationX * fluctuationX
        + fluctuationY * fluctuationY
        + fluctuationZ * fluctuationZ
      );
      rotationalEnergy += state.eRot[index];
      rotationalDof += state.rotDof[index];
    }
    const temperature = 2 * thermalEnergy / (3 * state.count * Dsmc.KB);
    const rotationalTemperature = rotationalDof > 0
      ? 2 * rotationalEnergy / (rotationalDof * Dsmc.KB)
      : Number.NaN;
    return {
      bulkX,
      bulkY,
      bulkZ,
      temperature,
      rotationalTemperature,
      thermalEnergy,
      rotationalEnergy,
      meanMass: totalMass / state.count,
    };
  }

  _refreshDistribution() {
    const histogram = this._state.speedHistogram;
    const reference = this._state.maxwellian;
    histogram.fill(0);
    const state = this._core.state;
    for (let index = 0; index < state.count; index += 1) {
      const speed = Math.hypot(state.vx[index], state.vy[index], state.vz[index]);
      const bin = Math.min(
        HISTOGRAM_BINS - 1,
        Math.floor(speed * HISTOGRAM_BINS / HISTOGRAM_MAX_SPEED),
      );
      if (bin >= 0) histogram[bin] += 1;
    }
    const binWidth = HISTOGRAM_MAX_SPEED / HISTOGRAM_BINS;
    const normalization = Math.max(1, state.count * binWidth);
    const moments = this._moments();
    for (let bin = 0; bin < HISTOGRAM_BINS; bin += 1) {
      histogram[bin] /= normalization;
      reference[bin] = maxwellianSpeedDensity(
        this._state.speedBins[bin],
        moments.meanMass,
        moments.temperature,
      );
    }
  }

  _computeDiagnostics() {
    const current = totalInvariants(this._core.state);
    const initial = this._initialInvariants;
    const energyScale = Math.max(Number.MIN_VALUE, Math.abs(initial.energy));
    const momentumScale = Math.max(
      Number.MIN_VALUE,
      Math.sqrt(
        initial.momentumX ** 2
        + initial.momentumY ** 2
        + initial.momentumZ ** 2,
      ),
      Math.sqrt(2 * initial.energy * this._core.state.mass[0]),
    );
    const momentumDifference = Math.hypot(
      current.momentumX - initial.momentumX,
      current.momentumY - initial.momentumY,
      current.momentumZ - initial.momentumZ,
    );
    const moments = this._moments();
    const volume = WORLD.width * WORLD.height * WORLD.depth;
    const numberDensity = this._core.state.count * this._ntcWeight / volume;
    const crossSection = Math.max(1e-30, this._referenceCrossSection());
    const meanFreePath = Dsmc.meanFreePathM(numberDensity, crossSection);
    const relativeSpeed = Math.max(
      1e-12,
      Math.sqrt(8 * Dsmc.KB * moments.temperature / (Math.PI * moments.meanMass)),
    );
    const meanCollisionTime = 1 / (numberDensity * crossSection * relativeSpeed);
    let histogramL1Error = 0;
    const binWidth = HISTOGRAM_MAX_SPEED / HISTOGRAM_BINS;
    for (let bin = 0; bin < HISTOGRAM_BINS; bin += 1) {
      histogramL1Error += Math.abs(
        this._state.speedHistogram[bin] - this._state.maxwellian[bin],
      ) * binWidth;
    }
    const closedSystem = this._parameters.xBoundary === 'periodic'
      && this._parameters.yBoundary === 'periodic';
    return Object.freeze({
      caseId: this._parameters.caseId,
      time: this._time,
      step: this._stepCount,
      particles: this._core.state.count,
      cells: this._core.cells.totalCells,
      occupiedCells: this._core.cells.occupiedCells,
      particlesPerCell: this._core.state.count / this._core.cells.totalCells,
      collisions: this._collisionCount,
      collisionsLastStep: this._lastCollisionResult.collided,
      collisionAttemptsLastStep: this._lastCollisionResult.attempted,
      majorantViolations: this._lastCollisionResult.majorantViolations,
      candidateOverflow: this._lastCollisionResult.candidateOverflow,
      rotationalEvents: this._lastCollisionResult.rotEvents,
      overflowed: this._lastCollisionResult.overflowed,
      temperature: moments.temperature,
      rotationalTemperature: moments.rotationalTemperature,
      bulkVelocityX: moments.bulkX,
      bulkVelocityY: moments.bulkY,
      pressure: numberDensity * Dsmc.KB * moments.temperature,
      histogramL1Error,
      meanFreePath,
      meanCollisionTime,
      dxOverMeanFreePath: this._core.cells.cellW / meanFreePath,
      dtOverMeanCollisionTime: this._parameters.timeStep / meanCollisionTime,
      closedSystem,
      energyError: (current.energy - initial.energy) / energyScale,
      momentumError: momentumDifference / momentumScale,
      wallEnergy: Object.freeze({ ...this._wallEnergy }),
    });
  }

  diagnostics() {
    this._assertActive();
    return this._diagnostics;
  }

  snapshot({ copy = false } = {}) {
    this._assertActive();
    return Object.freeze({
      type: 'dsmc-lab-state',
      schemaVersion: 1,
      ownership: copy ? 'snapshot-copy' : 'model-readonly-view',
      metadata: Object.freeze({
        ...this.metadata,
        caseId: this._parameters.caseId,
        seed: this._parameters.seed,
        status: 'verified',
      }),
      dimensions: Object.freeze({
        particles: this._core.state.count,
        columns: this._core.cells.cols,
        rows: this._core.cells.rows,
        histogramBins: HISTOGRAM_BINS,
      }),
      domain: Object.freeze({
        minX: 0,
        maxX: WORLD.width,
        minY: 0,
        maxY: WORLD.height,
        depth: WORLD.depth,
      }),
      time: this._time,
      step: this._stepCount,
      state: copy ? copyState(this._state) : this._state,
      replay: Object.freeze({
        parameters: this._parameters,
        randomState: this._core.state.rngState,
      }),
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._core = null;
    this._state = null;
  }
}

export function getDsmcLabPreset(caseId) {
  if (!CASE_SET.has(caseId)) {
    throw new RangeError(
      `caseId is ${String(caseId)}; expected one of ${DSMC_LAB_CASES.join(', ')}`,
    );
  }
  return Object.freeze({
    caseId,
    ...PRESETS[caseId],
  });
}

export function createDsmcLabModel(options = {}) {
  return new DsmcLabModel(options);
}
