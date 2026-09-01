/**
 * Browser-independent numerical model for the compact DG/FV laboratory.
 *
 * Scalar arrays are modal Legendre coefficients. Two-dimensional arrays use
 * row-major cells and mode index `a * (degree + 1) + b`. Euler conservative
 * variables are owned by DGSolver2D; the stable `state.scalar` buffer is only
 * the selected display field consumed by the view.
 *
 * All coordinates and scalar equations are nondimensional. The Euler domain
 * is 4 × 2 with characteristic far-field boundaries and a stair-step embedded
 * slip wall. Scalar cases use [0, 1] periodic domains.
 */

import { DgEngine } from './dg-fv-lab-engine.js';

const {
  EPS,
  Q,
  Euler2D,
  DGSolver2D,
  advectionNormalFlux,
  buildBasis,
  burgersFlux,
  burgersPhysicalFlux,
  eval1,
  eval1AtX,
  eval2AtXY,
  eval2Ref,
  evalModal,
  idx1,
  cellBase2,
  insideShape,
  minmod3,
  projectInitial1D,
  projectInitial2D,
  wrap01,
} = DgEngine;

export const DG_FV_CASES = Object.freeze([
  'euler-cylinder',
  'diamond-translation',
  'scalar-advection',
  'burgers',
]);

const CASE_SET = new Set(DG_FV_CASES);
const DISPLAY_FIELDS = Object.freeze({
  'euler-cylinder': Object.freeze([
    'schlieren',
    'density',
    'pressure',
    'mach',
    'speed',
    'vorticity',
    'entropy',
    'jump',
    'residual',
    'solid',
  ]),
  'diamond-translation': Object.freeze(['field', 'mean', 'error', 'modes']),
  'scalar-advection': Object.freeze(['field', 'mean', 'modes']),
  burgers: Object.freeze(['field', 'mean', 'modes']),
});
const INITIAL_CONDITIONS = Object.freeze({
  'diamond-translation': Object.freeze(['diamond']),
  'scalar-advection': Object.freeze(['blob', 'two', 'vortex', 'square']),
  burgers: Object.freeze(['sine', 'riemann', 'bump', 'square', 'constant']),
});
const LIMITERS = new Set(['off', 'pos', 'minmod', 'flatten', 'filter']);
const BODY_SHAPES = new Set(['square', 'wedge', 'cylinder', 'none']);
const VELOCITY_FIELDS = new Set(['uniform', 'swirl', 'shear']);

const DEFAULT_PARAMETERS = Object.freeze({
  caseId: 'euler-cylinder',
  columns: 48,
  rows: 24,
  degree: 1,
  cfl: 0.18,
  fluxAlpha: 1,
  initialCondition: 'blob',
  velocityField: 'uniform',
  limiter: 'minmod',
  displayField: 'schlieren',
  bodyShape: 'square',
  mach: 1.5,
  bodyRadius: 0.1,
  gamma: 1.4,
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
  const parameters = { ...base, ...patch };
  if (!CASE_SET.has(parameters.caseId)) {
    throw unchangedError(
      RangeError,
      `caseId is ${String(parameters.caseId)}; expected one of ${DG_FV_CASES.join(', ')}.`,
    );
  }
  if (!Number.isInteger(parameters.degree)
      || parameters.degree < 0
      || parameters.degree > 3) {
    throw unchangedError(
      RangeError,
      `degree is ${parameters.degree}; expected an integer from 0 to 3.`,
    );
  }
  if (parameters.caseId === 'euler-cylinder' && parameters.degree > 2) {
    throw unchangedError(
      RangeError,
      `degree is ${parameters.degree}; Euler expected an integer from 0 to 2.`,
    );
  }
  if (!Number.isInteger(parameters.columns)
      || parameters.columns < 16
      || parameters.columns > 320) {
    throw unchangedError(
      RangeError,
      `columns is ${parameters.columns}; expected an integer from 16 to 320.`,
    );
  }
  if (!Number.isInteger(parameters.rows)
      || parameters.rows < 1
      || parameters.rows > 192) {
    throw unchangedError(
      RangeError,
      `rows is ${parameters.rows}; expected an integer from 1 to 192.`,
    );
  }
  if (parameters.caseId !== 'burgers' && parameters.rows < 8) {
    throw unchangedError(
      RangeError,
      `rows is ${parameters.rows}; a two-dimensional case expected an integer from 8 to 192.`,
    );
  }
  for (const name of ['cfl', 'fluxAlpha', 'mach', 'bodyRadius', 'gamma']) {
    finite(parameters, name);
  }
  if (parameters.cfl <= 0 || parameters.cfl > 1) {
    throw unchangedError(
      RangeError,
      `cfl is ${parameters.cfl}; expected 0 < cfl <= 1.`,
    );
  }
  if (parameters.fluxAlpha < 0 || parameters.fluxAlpha > 3) {
    throw unchangedError(
      RangeError,
      `fluxAlpha is ${parameters.fluxAlpha}; expected a value from 0 to 3.`,
    );
  }
  if (parameters.mach <= 0 || parameters.mach > 5) {
    throw unchangedError(
      RangeError,
      `mach is ${parameters.mach}; expected 0 < mach <= 5.`,
    );
  }
  if (parameters.bodyRadius <= 0.02 || parameters.bodyRadius > 0.4) {
    throw unchangedError(
      RangeError,
      `bodyRadius is ${parameters.bodyRadius}; expected 0.02 < bodyRadius <= 0.4.`,
    );
  }
  if (parameters.gamma <= 1 || parameters.gamma > 2) {
    throw unchangedError(
      RangeError,
      `gamma is ${parameters.gamma}; expected 1 < gamma <= 2.`,
    );
  }
  if (!LIMITERS.has(parameters.limiter)) {
    throw unchangedError(
      RangeError,
      `limiter is ${String(parameters.limiter)}; expected off, pos, minmod, flatten, or filter.`,
    );
  }
  if (!BODY_SHAPES.has(parameters.bodyShape)) {
    throw unchangedError(
      RangeError,
      `bodyShape is ${String(parameters.bodyShape)}; expected square, wedge, cylinder, or none.`,
    );
  }
  if (!VELOCITY_FIELDS.has(parameters.velocityField)) {
    throw unchangedError(
      RangeError,
      `velocityField is ${String(parameters.velocityField)}; expected uniform, swirl, or shear.`,
    );
  }

  const displays = DISPLAY_FIELDS[parameters.caseId];
  if (!displays.includes(parameters.displayField)) {
    const changedCase = patch.caseId !== undefined && patch.displayField === undefined;
    parameters.displayField = changedCase ? displays[0] : parameters.displayField;
  }
  if (!displays.includes(parameters.displayField)) {
    throw unchangedError(
      RangeError,
      `displayField is ${String(parameters.displayField)}; ${parameters.caseId} expected `
      + `${displays.join(', ')}.`,
    );
  }
  const initial = INITIAL_CONDITIONS[parameters.caseId];
  if (initial) {
    if (parameters.caseId === 'diamond-translation') {
      parameters.initialCondition = 'diamond';
    } else if (!initial.includes(parameters.initialCondition)) {
      const changedCase = patch.caseId !== undefined && patch.initialCondition === undefined;
      parameters.initialCondition = changedCase ? initial[0] : parameters.initialCondition;
    }
    if (!initial.includes(parameters.initialCondition)) {
      throw unchangedError(
        RangeError,
        `initialCondition is ${String(parameters.initialCondition)}; `
        + `${parameters.caseId} expected ${initial.join(', ')}.`,
      );
    }
  }
  if (parameters.caseId === 'burgers') parameters.rows = 1;
  if (parameters.caseId === 'euler-cylinder'
      && !['off', 'pos', 'minmod', 'flatten'].includes(parameters.limiter)) {
    parameters.limiter = 'minmod';
  }
  if (parameters.caseId !== 'euler-cylinder'
      && parameters.caseId !== 'burgers'
      && !['off', 'filter'].includes(parameters.limiter)) {
    parameters.limiter = 'filter';
  }
  if (parameters.caseId === 'burgers'
      && !['off', 'minmod'].includes(parameters.limiter)) {
    parameters.limiter = 'minmod';
  }
  return Object.freeze(parameters);
}

function periodicDelta(value, center) {
  const delta = value - center;
  return delta - Math.round(delta);
}

function scalarInitial2D(x, y, parameters) {
  const name = parameters.initialCondition;
  if (name === 'diamond') {
    const distance = Math.abs(periodicDelta(x, 0.5)) + Math.abs(periodicDelta(y, 0.5));
    return distance < 0.24 ? 1 : 0;
  }
  if (name === 'two') {
    const first = periodicDelta(x, 0.32) ** 2 + periodicDelta(y, 0.52) ** 2;
    const second = periodicDelta(x, 0.72) ** 2 + periodicDelta(y, 0.32) ** 2;
    return Math.exp(-90 * first) - 0.65 * Math.exp(-130 * second);
  }
  if (name === 'vortex') {
    const radius = Math.hypot(periodicDelta(x, 0.5), periodicDelta(y, 0.5));
    return Math.sin(14 * Math.PI * radius) * Math.exp(-24 * radius * radius);
  }
  if (name === 'square') {
    return Math.abs(periodicDelta(x, 0.5)) < 0.16
      && Math.abs(periodicDelta(y, 0.5)) < 0.16
      ? 1
      : 0;
  }
  const radiusSquared = periodicDelta(x, 0.35) ** 2 + periodicDelta(y, 0.48) ** 2;
  return Math.exp(-85 * radiusSquared);
}

function scalarInitial1D(x, parameters) {
  const name = parameters.initialCondition;
  if (name === 'riemann') return x > 0.16 && x < 0.56 ? 1 : -0.25;
  if (name === 'bump') return 0.12 + 0.9 * Math.exp(-160 * periodicDelta(x, 0.35) ** 2);
  if (name === 'square') return x > 0.25 && x < 0.55 ? 1 : 0;
  if (name === 'constant') return 0.42;
  return 0.45 + 0.42 * Math.sin(2 * Math.PI * x);
}

function velocityXAt(_x, y, parameters) {
  if (parameters.caseId === 'diamond-translation' || parameters.velocityField === 'uniform') {
    return 1;
  }
  if (parameters.velocityField === 'shear') {
    return 1;
  }
  return Math.sin(2 * Math.PI * y);
}

function velocityYAt(x, _y, parameters) {
  if (parameters.caseId === 'diamond-translation' || parameters.velocityField === 'uniform') {
    return 0.38;
  }
  if (parameters.velocityField === 'shear') {
    return 0.52 * Math.sin(2 * Math.PI * x);
  }
  return Math.sin(2 * Math.PI * x);
}

function maximumVelocity(parameters) {
  if (parameters.caseId === 'diamond-translation' || parameters.velocityField === 'uniform') {
    return Math.hypot(1, 0.38);
  }
  if (parameters.velocityField === 'shear') return Math.hypot(1, 0.52);
  return Math.SQRT2;
}

export function obliqueShockAngle(mach, gamma = 1.4, thetaDegrees = 10) {
  if (!(mach > 1) || !(gamma > 1) || !(thetaDegrees > 0 && thetaDegrees < 90)) {
    return Number.NaN;
  }
  const theta = thetaDegrees * Math.PI / 180;
  const betaMinimum = Math.asin(1 / mach) + 1e-6;
  const betaMaximum = 0.5 * Math.PI - 1e-6;
  const relation = (beta) => (
    2 / Math.tan(beta)
    * (mach * mach * Math.sin(beta) ** 2 - 1)
    / (mach * mach * (gamma + Math.cos(2 * beta)) + 2)
    - Math.tan(theta)
  );
  let previousBeta = betaMinimum;
  let previousValue = relation(previousBeta);
  for (let index = 1; index <= 512; index += 1) {
    const beta = betaMinimum + (betaMaximum - betaMinimum) * index / 512;
    const value = relation(beta);
    if (previousValue <= 0 && value >= 0) {
      let low = previousBeta;
      let high = beta;
      for (let iteration = 0; iteration < 48; iteration += 1) {
        const middle = 0.5 * (low + high);
        if (relation(middle) >= 0) high = middle;
        else low = middle;
      }
      return 0.5 * (low + high) * 180 / Math.PI;
    }
    previousBeta = beta;
    previousValue = value;
  }
  return Number.NaN;
}

function copyState(state) {
  const output = {};
  for (const [name, value] of Object.entries(state)) {
    output[name] = ArrayBuffer.isView(value) ? value.slice() : value;
  }
  return Object.freeze(output);
}

export class DgFvLabModel {
  constructor(options = {}) {
    this.metadata = Object.freeze({
      id: 'dg-fv-lab',
      status: 'verified',
      seed: null,
      units: 'nondimensional',
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
      throw unchangedError(Error, 'dg-fv-lab model is disposed.');
    }
  }

  reset(parameters = {}) {
    this._assertActive();
    const next = validateParameters(this._parameters, parameters);
    const prepared = next.caseId === 'euler-cylinder'
      ? this._prepareEuler(next)
      : this._prepareScalar(next);
    this._parameters = next;
    Object.assign(this, prepared.private);
    this._state = Object.freeze(prepared.state);
    this._time = 0;
    this._stepCount = 0;
    this._refreshDisplay();
    this._diagnostics = this._computeDiagnostics();
    return this;
  }

  _prepareEuler(parameters) {
    const {
      columns,
      rows,
      degree,
      bodyShape,
      bodyRadius,
      gamma,
      mach,
      fluxAlpha,
    } = parameters;
    const domain = Object.freeze({
      minX: 0,
      maxX: 4,
      minY: 0,
      maxY: 2,
    });
    const centerX = 1;
    const centerY = 1;
    const solid = new Uint8Array(columns * rows);
    const fluidCells = [];
    const spacingX = 4 / columns;
    const spacingY = 2 / rows;
    for (let row = 0; row < rows; row += 1) {
      const y = (row + 0.5) * spacingY;
      for (let column = 0; column < columns; column += 1) {
        const x = (column + 0.5) * spacingX;
        const index = row * columns + column;
        const isSolid = bodyShape !== 'none'
          && insideShape(bodyShape, x, y, centerX, centerY, bodyRadius);
        solid[index] = isSolid ? 1 : 0;
        if (!isSolid) fluidCells.push(index);
      }
    }
    const density = 1;
    const pressure = 1 / gamma;
    const velocityX = mach;
    const totalEnergy = pressure / (gamma - 1) + 0.5 * density * velocityX * velocityX;
    const far = new Float64Array([density, density * velocityX, 0, totalEnergy]);
    const solver = new DGSolver2D({
      nx: columns,
      ny: rows,
      p: degree,
      equation: Euler2D,
      solid,
      params: {
        gamma,
        alpha: fluxAlpha,
        Lx: 4,
        Ly: 2,
        limiter: parameters.limiter,
        farfield(out) {
          out.set(far);
        },
      },
      initialCondition: (_x, _y, out) => {
        out.set(far);
      },
    });
    solver.limiterMode = parameters.limiter;
    let subcell = degree === 0 ? 1 : degree + 1;
    while (columns * subcell * rows * subcell > 120_000) subcell -= 1;
    const sampleColumns = columns * subcell;
    const sampleRows = rows * subcell;
    const fineConserved = new Float32Array(4 * sampleColumns * sampleRows);
    const meanConserved = new Float64Array(4 * columns * rows);
    const scalar = new Float32Array(sampleColumns * sampleRows);
    const solidFine = new Uint8Array(sampleColumns * sampleRows);
    for (let row = 0; row < sampleRows; row += 1) {
      for (let column = 0; column < sampleColumns; column += 1) {
        solidFine[row * sampleColumns + column] = solid[
          Math.floor(row / subcell) * columns + Math.floor(column / subcell)
        ];
      }
    }
    solver.syncMeanAoS(meanConserved);
    solver.sampleFieldAoS(fineConserved, subcell);
    return {
      private: {
        _basis: solver.basis,
        _solver: solver,
        _solid: solid,
        _solidFine: solidFine,
        _fluidCells: Int32Array.from(fluidCells),
        _fineConserved: fineConserved,
        _meanConserved: meanConserved,
        _subcell: subcell,
        _coefficients: null,
        _scratchA: null,
        _scratchB: null,
        _residual: null,
        _lastResidual: null,
        _rhsAccumulator: null,
        _cellMeans: null,
        _forces: new Float64Array(2),
        _currentDensity: new Float32Array(sampleColumns * sampleRows),
        _previousDensity: new Float32Array(sampleColumns * sampleRows),
        _meanDisplay: new Float32Array(0),
        _modalSpectrum: new Float64Array(0),
        _lastStepDt: 0,
        _maximumJump: 0,
        _residualNorm: 0,
      },
      state: {
        scalar,
        solidMask: solidFine,
        solidCellMask: solid,
        coordinatesX: new Float64Array(0),
        meanScalar: new Float32Array(0),
        modalSpectrum: new Float64Array(0),
      },
    };
  }

  _prepareScalar(parameters) {
    const basis = buildBasis(parameters.degree);
    const isOneDimensional = parameters.caseId === 'burgers';
    const coefficientCount = isOneDimensional
      ? parameters.columns * basis.np
      : parameters.columns * parameters.rows * basis.nm2;
    const coefficients = new Float64Array(coefficientCount);
    const context = {
      nx: parameters.columns,
      ny: parameters.rows,
      basis,
    };
    if (isOneDimensional) {
      projectInitial1D(
        context,
        coefficients,
        (x) => scalarInitial1D(x, parameters),
      );
    } else {
      projectInitial2D(
        context,
        coefficients,
        (x, y) => scalarInitial2D(x, y, parameters),
      );
    }
    const subcell = Math.max(1, parameters.degree + 1);
    const sampleColumns = parameters.columns * subcell;
    const sampleRows = isOneDimensional ? 1 : parameters.rows * subcell;
    const coordinatesX = new Float64Array(sampleColumns);
    for (let index = 0; index < sampleColumns; index += 1) {
      coordinatesX[index] = (index + 0.5) / sampleColumns;
    }
    const meanDisplay = new Float32Array(sampleColumns * sampleRows);
    const modalSpectrum = new Float64Array(parameters.degree + 1);
    return {
      private: {
        _basis: basis,
        _solver: null,
        _solid: null,
        _solidFine: null,
        _fluidCells: null,
        _fineConserved: null,
        _meanConserved: null,
        _subcell: subcell,
        _coefficients: coefficients,
        _scratchA: new Float64Array(coefficientCount),
        _scratchB: new Float64Array(coefficientCount),
        _residual: new Float64Array(coefficientCount),
        _lastResidual: new Float64Array(coefficientCount),
        _rhsAccumulator: isOneDimensional ? null : new Float64Array(basis.nm2),
        _cellMeans: isOneDimensional ? new Float64Array(parameters.columns) : null,
        _forces: null,
        _currentDensity: null,
        _previousDensity: null,
        _meanDisplay: meanDisplay,
        _modalSpectrum: modalSpectrum,
        _lastStepDt: 0,
        _maximumJump: 0,
        _residualNorm: 0,
      },
      state: {
        scalar: new Float32Array(sampleColumns * sampleRows),
        solidMask: new Uint8Array(0),
        solidCellMask: new Uint8Array(0),
        coordinatesX,
        meanScalar: meanDisplay,
        modalSpectrum,
      },
    };
  }

  _context() {
    return {
      nx: this._parameters.columns,
      ny: this._parameters.rows,
      basis: this._basis,
    };
  }

  _rhsBurgers(input, output) {
    const context = this._context();
    const {
      np, phi, dphi, left, right, mass,
    } = this._basis;
    const columns = this._parameters.columns;
    const spacing = 1 / columns;
    output.fill(0);
    for (let column = 0; column < columns; column += 1) {
      const previous = (column - 1 + columns) % columns;
      const next = (column + 1) % columns;
      const leftFlux = burgersFlux(
        eval1(context, input, previous, 1),
        eval1(context, input, column, -1),
        this._parameters.fluxAlpha,
      );
      const rightFlux = burgersFlux(
        eval1(context, input, column, 1),
        eval1(context, input, next, -1),
        this._parameters.fluxAlpha,
      );
      const base = column * np;
      for (let mode = 0; mode < np; mode += 1) {
        let volume = 0;
        for (let quadrature = 0; quadrature < Q.x.length; quadrature += 1) {
          const value = eval1(context, input, column, Q.x[quadrature]);
          volume += Q.w[quadrature] * burgersPhysicalFlux(value) * dphi[quadrature][mode];
        }
        const surface = rightFlux * right[mode] - leftFlux * left[mode];
        output[base + mode] = (2 / (spacing * mass[mode])) * (volume - surface);
      }
    }
  }

  _rhsAdvection(input, output) {
    const context = this._context();
    const {
      nm2,
      volPhi,
      volDxi,
      volDeta,
      volW,
      invMassUnit,
      faceL,
      faceR,
      faceB,
      faceT,
    } = this._basis;
    const { columns, rows, fluxAlpha } = this._parameters;
    const spacingX = 1 / columns;
    const spacingY = 1 / rows;
    const quadratureCount = Q.x.length;
    const accumulator = this._rhsAccumulator;
    output.fill(0);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const base = cellBase2(context, column, row);
        accumulator.fill(0);
        for (let quadrature = 0; quadrature < volW.length; quadrature += 1) {
          const qx = Math.floor(quadrature / quadratureCount);
          const qy = quadrature - qx * quadratureCount;
          const x = (column + 0.5 * (Q.x[qx] + 1)) * spacingX;
          const y = (row + 0.5 * (Q.x[qy] + 1)) * spacingY;
          const offset = quadrature * nm2;
          const value = evalModal(input, base, volPhi, offset, nm2);
          const velocityX = velocityXAt(x, y, this._parameters);
          const velocityY = velocityYAt(x, y, this._parameters);
          const weight = volW[quadrature] * value;
          for (let mode = 0; mode < nm2; mode += 1) {
            accumulator[mode] += weight * (
              0.5 * spacingY * velocityX * volDxi[offset + mode]
              + 0.5 * spacingX * velocityY * volDeta[offset + mode]
            );
          }
        }

        const leftColumn = (column - 1 + columns) % columns;
        const rightColumn = (column + 1) % columns;
        const bottomRow = (row - 1 + rows) % rows;
        const topRow = (row + 1) % rows;
        const baseLeft = cellBase2(context, leftColumn, row);
        const baseRight = cellBase2(context, rightColumn, row);
        const baseBottom = cellBase2(context, column, bottomRow);
        const baseTop = cellBase2(context, column, topRow);

        for (let q = 0; q < quadratureCount; q += 1) {
          const offset = q * nm2;
          const y = (row + 0.5 * (Q.x[q] + 1)) * spacingY;
          let speed = velocityXAt((column + 1) * spacingX, y, this._parameters);
          let flux = advectionNormalFlux(
            speed,
            evalModal(input, base, faceR, offset, nm2),
            evalModal(input, baseRight, faceL, offset, nm2),
            fluxAlpha,
          );
          let scale = 0.5 * spacingY * Q.w[q] * flux;
          for (let mode = 0; mode < nm2; mode += 1) {
            accumulator[mode] -= scale * faceR[offset + mode];
          }

          speed = -velocityXAt(column * spacingX, y, this._parameters);
          flux = advectionNormalFlux(
            speed,
            evalModal(input, base, faceL, offset, nm2),
            evalModal(input, baseLeft, faceR, offset, nm2),
            fluxAlpha,
          );
          scale = 0.5 * spacingY * Q.w[q] * flux;
          for (let mode = 0; mode < nm2; mode += 1) {
            accumulator[mode] -= scale * faceL[offset + mode];
          }
        }

        for (let q = 0; q < quadratureCount; q += 1) {
          const offset = q * nm2;
          const x = (column + 0.5 * (Q.x[q] + 1)) * spacingX;
          let speed = velocityYAt(x, (row + 1) * spacingY, this._parameters);
          let flux = advectionNormalFlux(
            speed,
            evalModal(input, base, faceT, offset, nm2),
            evalModal(input, baseTop, faceB, offset, nm2),
            fluxAlpha,
          );
          let scale = 0.5 * spacingX * Q.w[q] * flux;
          for (let mode = 0; mode < nm2; mode += 1) {
            accumulator[mode] -= scale * faceT[offset + mode];
          }

          speed = -velocityYAt(x, row * spacingY, this._parameters);
          flux = advectionNormalFlux(
            speed,
            evalModal(input, base, faceB, offset, nm2),
            evalModal(input, baseBottom, faceT, offset, nm2),
            fluxAlpha,
          );
          scale = 0.5 * spacingX * Q.w[q] * flux;
          for (let mode = 0; mode < nm2; mode += 1) {
            accumulator[mode] -= scale * faceB[offset + mode];
          }
        }

        const inverseArea = 1 / (spacingX * spacingY);
        for (let mode = 0; mode < nm2; mode += 1) {
          output[base + mode] = accumulator[mode] * invMassUnit[mode] * inverseArea;
        }
      }
    }
  }

  _stabilize(input) {
    if (this._parameters.caseId === 'burgers') {
      if (this._parameters.degree === 0 || this._parameters.limiter !== 'minmod') return;
      const context = this._context();
      const { columns } = this._parameters;
      const { np } = this._basis;
      const means = this._cellMeans;
      for (let column = 0; column < columns; column += 1) {
        means[column] = input[idx1(context, column, 0)];
      }
      const tolerance = 20 / (columns * columns);
      for (let column = 0; column < columns; column += 1) {
        const previous = (column - 1 + columns) % columns;
        const next = (column + 1) % columns;
        const mean = means[column];
        const low = Math.min(means[previous], mean, means[next]) - tolerance;
        const high = Math.max(means[previous], mean, means[next]) + tolerance;
        const left = eval1(context, input, column, -1);
        const right = eval1(context, input, column, 1);
        if (left >= low && left <= high && right >= low && right <= high) continue;
        input[idx1(context, column, 1)] = minmod3(
          input[idx1(context, column, 1)],
          0.725 * (mean - means[previous]),
          0.725 * (means[next] - mean),
        );
        for (let mode = 2; mode < np; mode += 1) input[idx1(context, column, mode)] = 0;
      }
      return;
    }
    if (this._parameters.degree < 2 || this._parameters.limiter !== 'filter') return;
    const { np } = this._basis;
    const cells = this._parameters.columns * this._parameters.rows;
    for (let cell = 0; cell < cells; cell += 1) {
      const base = cell * np * np;
      for (let a = 0; a < np; a += 1) {
        for (let b = 0; b < np; b += 1) {
          const order = a + b;
          if (order <= 1) continue;
          const factor = Math.exp(-15.36 * (order / (2 * this._parameters.degree)) ** 8);
          input[base + a * np + b] *= factor;
        }
      }
    }
  }

  _scalarTimeStep() {
    const {
      caseId, columns, rows, degree, cfl,
    } = this._parameters;
    if (caseId === 'burgers') {
      const context = this._context();
      let maximum = 0.05;
      for (let column = 0; column < columns; column += 1) {
        maximum = Math.max(
          maximum,
          Math.abs(eval1(context, this._coefficients, column, -1)),
          Math.abs(eval1(context, this._coefficients, column, 0)),
          Math.abs(eval1(context, this._coefficients, column, 1)),
        );
      }
      return Math.min(0.05, cfl / (columns * ((2 * degree + 1) * maximum + EPS)));
    }
    const spacing = Math.min(1 / columns, 1 / rows);
    return Math.min(0.05, cfl * spacing / ((2 * degree + 1) * maximumVelocity(this._parameters) + EPS));
  }

  _stepScalar() {
    const input = this._coefficients;
    const stageA = this._scratchA;
    const stageB = this._scratchB;
    const residual = this._residual;
    const numericalDt = this._scalarTimeStep();
    const rhs = this._parameters.caseId === 'burgers'
      ? this._rhsBurgers.bind(this)
      : this._rhsAdvection.bind(this);

    rhs(input, residual);
    this._lastResidual.set(residual);
    for (let index = 0; index < input.length; index += 1) {
      stageA[index] = input[index] + numericalDt * residual[index];
    }
    this._stabilize(stageA);
    rhs(stageA, residual);
    for (let index = 0; index < input.length; index += 1) {
      stageB[index] = 0.75 * input[index]
        + 0.25 * (stageA[index] + numericalDt * residual[index]);
    }
    this._stabilize(stageB);
    rhs(stageB, residual);
    for (let index = 0; index < input.length; index += 1) {
      input[index] = input[index] / 3
        + (2 / 3) * (stageB[index] + numericalDt * residual[index]);
    }
    this._stabilize(input);
    this._lastResidual.set(residual);
    this._time += numericalDt;
  }

  _stepEuler() {
    const numericalDt = Math.min(
      0.02,
      this._parameters.cfl / Math.max(1e-12, this._solver.maxLambda()),
    );
    this._solver.params.alpha = this._parameters.fluxAlpha;
    this._solver.params.gamma = this._parameters.gamma;
    this._solver.limiterMode = this._parameters.limiter;
    this._solver.step(numericalDt);
    this._solver.syncMeanAoS(this._meanConserved);
    this._solver.sampleFieldAoS(this._fineConserved, this._subcell);
    this._lastStepDt = numericalDt;
    this._time += numericalDt;
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
    if (this._parameters.caseId === 'euler-cylinder') this._stepEuler();
    else this._stepScalar();
    this._stepCount += 1;
    this._refreshDisplay();
    this._diagnostics = this._computeDiagnostics();
    return this;
  }

  _refreshDisplay() {
    if (this._parameters.caseId === 'euler-cylinder') this._refreshEulerDisplay();
    else this._refreshScalarDisplay();
  }

  _refreshScalarDisplay() {
    const output = this._state.scalar;
    const means = this._meanDisplay;
    const spectrum = this._modalSpectrum;
    spectrum.fill(0);
    const context = this._context();
    const columns = this._parameters.columns * this._subcell;
    if (this._parameters.caseId === 'burgers') {
      for (let column = 0; column < columns; column += 1) {
        const x = (column + 0.5) / columns;
        const cell = Math.min(this._parameters.columns - 1, Math.floor(x * this._parameters.columns));
        means[column] = this._coefficients[idx1(context, cell, 0)];
        if (this._parameters.displayField === 'mean') {
          output[column] = means[column];
        } else if (this._parameters.displayField === 'modes') {
          const cell = Math.min(this._parameters.columns - 1, Math.floor(x * this._parameters.columns));
          let high = 0;
          let all = EPS;
          for (let mode = 0; mode < this._basis.np; mode += 1) {
            const value = this._coefficients[idx1(context, cell, mode)];
            all += value * value;
            if (mode > 0) high += value * value;
          }
          output[column] = Math.sqrt(high / all);
        } else {
          output[column] = eval1AtX(context, this._coefficients, x);
        }
      }
      for (let column = 0; column < this._parameters.columns; column += 1) {
        for (let mode = 0; mode < this._basis.np; mode += 1) {
          const value = this._coefficients[idx1(context, column, mode)];
          spectrum[mode] += value * value;
        }
      }
      for (let mode = 0; mode < spectrum.length; mode += 1) {
        spectrum[mode] = Math.sqrt(spectrum[mode] / this._parameters.columns);
      }
      return;
    }

    const rows = this._parameters.rows * this._subcell;
    for (let row = 0; row < rows; row += 1) {
      const y = (row + 0.5) / rows;
      for (let column = 0; column < columns; column += 1) {
        const x = (column + 0.5) / columns;
        const index = row * columns + column;
        const cellColumn = Math.min(this._parameters.columns - 1, Math.floor(x * this._parameters.columns));
        const cellRow = Math.min(this._parameters.rows - 1, Math.floor(y * this._parameters.rows));
        const base = cellBase2(context, cellColumn, cellRow);
        means[index] = this._coefficients[base];
        if (this._parameters.displayField === 'mean') {
          output[index] = means[index];
        } else if (this._parameters.displayField === 'error') {
          const exact = scalarInitial2D(
            wrap01(x - this._time),
            wrap01(y - 0.38 * this._time),
            this._parameters,
          );
          output[index] = Math.abs(eval2AtXY(context, this._coefficients, x, y) - exact);
        } else if (this._parameters.displayField === 'modes') {
          let high = 0;
          let all = EPS;
          for (let mode = 0; mode < this._basis.nm2; mode += 1) {
            const value = this._coefficients[base + mode];
            all += value * value;
            if (mode > 0) high += value * value;
          }
          output[index] = Math.sqrt(high / all);
        } else {
          output[index] = eval2AtXY(context, this._coefficients, x, y);
        }
      }
    }
    for (let cell = 0; cell < this._parameters.columns * this._parameters.rows; cell += 1) {
      const base = cell * this._basis.nm2;
      for (let a = 0; a < this._basis.np; a += 1) {
        for (let b = 0; b < this._basis.np; b += 1) {
          const order = Math.min(spectrum.length - 1, Math.max(a, b));
          const value = this._coefficients[base + a * this._basis.np + b];
          spectrum[order] += value * value;
        }
      }
    }
    const cells = this._parameters.columns * this._parameters.rows;
    for (let mode = 0; mode < spectrum.length; mode += 1) {
      spectrum[mode] = Math.sqrt(spectrum[mode] / cells);
    }
  }

  _refreshEulerDisplay() {
    const output = this._state.scalar;
    const input = this._fineConserved;
    const solid = this._solidFine;
    const columns = this._parameters.columns * this._subcell;
    const rows = this._parameters.rows * this._subcell;
    const { gamma, displayField } = this._parameters;
    const densityField = this._currentDensity;
    let jumpSquared = 0;
    let jumpMaximum = 0;
    let residualSquared = 0;

    for (let index = 0; index < densityField.length; index += 1) {
      densityField[index] = solid[index] ? Number.NaN : input[4 * index];
    }

    if (displayField === 'solid') {
      for (let index = 0; index < output.length; index += 1) output[index] = solid[index];
      this._maximumJump = 0;
      this._residualNorm = 0;
      this._previousDensity.set(densityField);
      return;
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        if (solid[index]) continue;
        let jump = 0;
        if (column > 0 && !solid[index - 1]) jump = Math.max(jump, Math.abs(densityField[index] - densityField[index - 1]));
        if (row > 0 && !solid[index - columns]) jump = Math.max(jump, Math.abs(densityField[index] - densityField[index - columns]));
        jumpMaximum = Math.max(jumpMaximum, jump);
        jumpSquared += jump * jump;
        const previous = this._previousDensity[index];
        const residual = this._stepCount > 0 && Number.isFinite(previous)
          ? Math.abs(densityField[index] - previous) / Math.max(EPS, this._lastStepDt)
          : 0;
        residualSquared += residual * residual;
        if (displayField === 'jump') output[index] = jump;
        if (displayField === 'residual') output[index] = residual;
      }
    }
    this._maximumJump = jumpMaximum;
    this._residualNorm = Math.sqrt(residualSquared / Math.max(1, output.length));

    if (displayField === 'jump' || displayField === 'residual') {
      this._previousDensity.set(densityField);
      return;
    }

    if (displayField === 'schlieren' || displayField === 'vorticity') {
      const spacingX = 4 / columns;
      const spacingY = 2 / rows;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          if (solid[index]) {
            output[index] = Number.NaN;
            continue;
          }
          const left = column > 0 && !solid[index - 1] ? index - 1 : index;
          const right = column + 1 < columns && !solid[index + 1] ? index + 1 : index;
          const bottom = row > 0 && !solid[index - columns] ? index - columns : index;
          const top = row + 1 < rows && !solid[index + columns] ? index + columns : index;
          const deltaX = Math.max(1, right - left) * spacingX;
          const deltaY = Math.max(1, (top - bottom) / columns) * spacingY;
          if (displayField === 'schlieren') {
            const density = Math.max(1e-12, input[4 * index]);
            output[index] = Math.hypot(
              (input[4 * right] - input[4 * left]) / deltaX,
              (input[4 * top] - input[4 * bottom]) / deltaY,
            ) / density;
          } else {
            const velocityRight = input[4 * right + 2] / input[4 * right];
            const velocityLeft = input[4 * left + 2] / input[4 * left];
            const velocityTop = input[4 * top + 1] / input[4 * top];
            const velocityBottom = input[4 * bottom + 1] / input[4 * bottom];
            output[index] = (velocityRight - velocityLeft) / deltaX
              - (velocityTop - velocityBottom) / deltaY;
          }
        }
      }
      return;
    }

    for (let index = 0; index < output.length; index += 1) {
      const density = input[4 * index];
      if (solid[index] || !Number.isFinite(density) || density <= 0) {
        output[index] = Number.NaN;
        continue;
      }
      const velocityX = input[4 * index + 1] / density;
      const velocityY = input[4 * index + 2] / density;
      const pressure = Math.max(
        1e-12,
        (gamma - 1) * (
          input[4 * index + 3]
          - 0.5 * density * (velocityX * velocityX + velocityY * velocityY)
        ),
      );
      if (displayField === 'density') output[index] = density;
      else if (displayField === 'pressure') output[index] = pressure;
      else if (displayField === 'mach') {
        output[index] = Math.hypot(velocityX, velocityY)
          / Math.sqrt(gamma * pressure / density);
      } else if (displayField === 'speed') {
        output[index] = Math.hypot(velocityX, velocityY);
      } else {
        output[index] = gamma * pressure / density ** gamma - 1;
      }
    }
    this._previousDensity.set(densityField);
  }

  _computeDiagnostics() {
    if (this._parameters.caseId === 'euler-cylinder') {
      const {
        columns, rows, gamma, mach, bodyRadius,
      } = this._parameters;
      const spacingX = 4 / columns;
      const spacingY = 2 / rows;
      let mass = 0;
      let minimumDensity = Infinity;
      let maximumDensity = -Infinity;
      let minimumPressure = Infinity;
      let maximumPressure = -Infinity;
      let maximumMach = 0;
      for (const cell of this._fluidCells) {
        const offset = 4 * cell;
        const density = this._meanConserved[offset];
        const velocityX = this._meanConserved[offset + 1] / density;
        const velocityY = this._meanConserved[offset + 2] / density;
        const pressure = (gamma - 1) * (
          this._meanConserved[offset + 3]
          - 0.5 * density * (velocityX * velocityX + velocityY * velocityY)
        );
        mass += density * spacingX * spacingY;
        minimumDensity = Math.min(minimumDensity, density);
        maximumDensity = Math.max(maximumDensity, density);
        minimumPressure = Math.min(minimumPressure, pressure);
        maximumPressure = Math.max(maximumPressure, pressure);
        maximumMach = Math.max(
          maximumMach,
          Math.hypot(velocityX, velocityY) / Math.sqrt(gamma * pressure / density),
        );
      }
      this._solver.wallForces(this._forces);
      const referenceForce = Math.max(1e-12, mach * mach * bodyRadius);
      const healthy = Number.isFinite(minimumDensity)
        && Number.isFinite(minimumPressure)
        && minimumDensity > 0
        && minimumPressure > 0;
      const wedgeShockAngleDegrees = this._parameters.bodyShape === 'wedge'
        ? obliqueShockAngle(mach, gamma, 10)
        : Number.NaN;
      return Object.freeze({
        caseId: this._parameters.caseId,
        time: this._time,
        step: this._stepCount,
        numericalTimeStep: this._stepCount === 0 ? 0 : this._time / this._stepCount,
        mass,
        minimumDensity,
        maximumDensity,
        minimumPressure,
        maximumPressure,
        maximumMach,
        dragCoefficient: this._forces[0] / referenceForce,
        liftCoefficient: this._forces[1] / referenceForce,
        positivityLimitedCells: this._solver.limPos,
        troubledCells: this._solver.limTC,
        maximumJump: this._maximumJump,
        residualNorm: this._residualNorm,
        healthy,
        correctiveAction: healthy ? 'none' : 'reduce-cfl-or-enable-positivity',
        wedgeShockAngleDegrees,
        wedgeAttached: Number.isFinite(wedgeShockAngleDegrees),
        degreesOfFreedom: this._solver.U.length,
      });
    }

    const context = this._context();
    const { columns, rows, caseId } = this._parameters;
    let mass = 0;
    let minimum = Infinity;
    let maximum = -Infinity;
    let modeEnergy = 0;
    let totalEnergy = EPS;
    if (caseId === 'burgers') {
      for (let column = 0; column < columns; column += 1) {
        mass += this._coefficients[idx1(context, column, 0)] / columns;
        for (let mode = 0; mode < this._basis.np; mode += 1) {
          const value = this._coefficients[idx1(context, column, mode)];
          totalEnergy += value * value;
          if (mode > 0) modeEnergy += value * value;
        }
      }
    } else {
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const base = cellBase2(context, column, row);
          mass += this._coefficients[base] / (columns * rows);
          for (let mode = 0; mode < this._basis.nm2; mode += 1) {
            const value = this._coefficients[base + mode];
            totalEnergy += value * value;
            if (mode > 0) modeEnergy += value * value;
          }
        }
      }
    }
    for (const value of this._state.scalar) {
      if (!Number.isFinite(value)) continue;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    let l2Error = Number.NaN;
    if (caseId === 'diamond-translation'
        || (caseId === 'scalar-advection' && this._parameters.velocityField === 'uniform')) {
      let squared = 0;
      const sampleColumns = columns * this._subcell;
      const sampleRows = rows * this._subcell;
      for (let row = 0; row < sampleRows; row += 1) {
        const y = (row + 0.5) / sampleRows;
        for (let column = 0; column < sampleColumns; column += 1) {
          const x = (column + 0.5) / sampleColumns;
          const numerical = eval2AtXY(context, this._coefficients, x, y);
          const exact = scalarInitial2D(
            wrap01(x - this._time),
            wrap01(y - 0.38 * this._time),
            this._parameters,
          );
          squared += (numerical - exact) ** 2;
        }
      }
      l2Error = Math.sqrt(squared / (sampleColumns * sampleRows));
    }
    return Object.freeze({
      caseId,
      time: this._time,
      step: this._stepCount,
      numericalTimeStep: this._stepCount === 0 ? 0 : this._time / this._stepCount,
      mass,
      minimum,
      maximum,
      modalEnergyFraction: Math.sqrt(modeEnergy / totalEnergy),
      l2Error,
      degreesOfFreedom: this._coefficients.length,
      residualNorm: this._lastResidual
        ? Math.sqrt(this._lastResidual.reduce((sum, value) => sum + value * value, 0)
          / Math.max(1, this._lastResidual.length))
        : 0,
      healthy: Number.isFinite(minimum) && Number.isFinite(maximum),
      correctiveAction: Number.isFinite(minimum) && Number.isFinite(maximum)
        ? 'none'
        : 'reduce-cfl-or-enable-limiter',
    });
  }

  diagnostics() {
    this._assertActive();
    return this._diagnostics;
  }

  snapshot({ copy = false } = {}) {
    this._assertActive();
    const isEuler = this._parameters.caseId === 'euler-cylinder';
    const columns = this._parameters.columns * this._subcell;
    const rows = this._parameters.caseId === 'burgers'
      ? 1
      : this._parameters.rows * this._subcell;
    return Object.freeze({
      type: 'dg-fv-lab-state',
      schemaVersion: 1,
      ownership: copy ? 'snapshot-copy' : 'model-readonly-view',
      metadata: Object.freeze({
        ...this.metadata,
        caseId: this._parameters.caseId,
        equationFamily: isEuler
          ? 'compressible-euler-2d'
          : this._parameters.caseId === 'burgers'
            ? 'inviscid-burgers-1d'
            : 'scalar-advection-2d',
        status: 'verified',
      }),
      dimensions: Object.freeze({
        columns,
        rows,
        cellsX: this._parameters.columns,
        cellsY: this._parameters.rows,
        components: isEuler ? 4 : 1,
      }),
      domain: isEuler
        ? Object.freeze({
          minX: 0,
          maxX: 4,
          minY: 0,
          maxY: 2,
        })
        : Object.freeze({
          minX: 0,
          maxX: 1,
          minY: 0,
          maxY: 1,
        }),
      time: this._time,
      step: this._stepCount,
      state: copy ? copyState(this._state) : this._state,
      replay: Object.freeze({
        parameters: this._parameters,
      }),
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._solver = null;
    this._coefficients = null;
    this._rhsAccumulator = null;
    this._cellMeans = null;
    this._forces = null;
    this._currentDensity = null;
    this._previousDensity = null;
    this._meanDisplay = null;
    this._modalSpectrum = null;
    this._state = null;
  }
}

export function createDgFvLabModel(options = {}) {
  return new DgFvLabModel(options);
}

export {
  DISPLAY_FIELDS as DG_FV_DISPLAY_FIELDS,
  INITIAL_CONDITIONS as DG_FV_INITIAL_CONDITIONS,
};
