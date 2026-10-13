/**
 * Two-dimensional ideal-gas Euler finite-volume experiment.
 *
 * U[4*(j*nx+i)+k], k = density, x-momentum, y-momentum, total energy.
 * First-order piecewise-constant reconstruction + forward Euler, unsplit
 * divergence; one shared flux per face. No state clipping, flux substitution,
 * or artificial instability forcing. An inadmissible candidate stops the run.
 *
 * The default problem is a stationary normal shock, normalized by upstream
 * rho_1 = u_1 = 1, p_1 = 1/(gamma*M_1^2), in [0,1] x [0,ny/nx].
 * Initial v perturbations are seeded once, in a narrow band around the shock.
 * Periodic transverse boundaries. Supersonic upstream state at x=0;
 * prescribed downstream pressure + extrapolated rho,u,v at x=1.
 *
 * This is a compact stationary-shock / odd-even-decoupling experiment in the
 * carbuncle family, not the bow-shock-over-a-cylinder geometry. Related setup:
 * Simon & Mandal (2018), arXiv:1803.04954, section 5.0.2; see also
 * Dumbser, Moschetta & Gressier (2004), JCP 197, 647–670.
 */
import { numericalFlux, primitiveToConservative } from './euler.js';

export const SHOCK2D_DESCRIPTION = Object.freeze({
  model: '2D inviscid Euler, calorically perfect gas',
  discretization: 'first-order finite volume, unsplit forward Euler',
  initialization: 'Rankine–Hugoniot stationary normal shock; seeded transverse-velocity perturbation applied once',
  boundaries: 'fixed supersonic inflow; fixed-pressure subsonic outflow; periodic in y',
  normalization: 'rho1 = u1 = 1, p1 = 1/(gamma M1²); t = dimensional time × u1/Lx',
  source: 'https://arxiv.org/pdf/1803.04954',
  sourceSection: '5.0.2; educational variant of the stationary thin shock experiment',
});

export function normalShockStates(mach = 6, gamma = 1.4) {
  if (!(Number.isFinite(mach) && mach > 1 && Number.isFinite(gamma) && gamma > 1)) {
    throw new RangeError('A normal compressive shock requires M > 1 and gamma > 1.');
  }
  const m2 = mach * mach;
  const ratio = (gamma + 1) * m2 / ((gamma - 1) * m2 + 2);
  const left = { rho: 1, u: 1, v: 0, p: 1 / (gamma * m2) };
  const right = {
    rho: ratio,
    u: 1 / ratio,
    v: 0,
    p: left.p * (2 * gamma * m2 - (gamma - 1)) / (gamma + 1),
  };
  return { left, right, densityRatio: ratio };
}

function boundedInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}].`);
  }
  return value;
}

function loadState(U, index, out, rotate = false) {
  out[0] = U[index];
  out[1] = U[index + (rotate ? 2 : 1)];
  out[2] = U[index + (rotate ? 1 : 2)];
  out[3] = U[index + 3];
}

export class Shock2D {
  constructor(options = {}) {
    this.method = options.method ?? 'roe';
    this.nx = boundedInteger(options.nx ?? 96, 'nx', 4, 600);
    this.ny = boundedInteger(options.ny ?? 32, 'ny', 2, 400);
    this.gamma = options.gamma ?? 1.4;
    this.mach = options.mach ?? 6;
    this.perturbation = options.perturbation ?? 0.001;
    this.cfl = options.cfl ?? 0.35;
    if (!(this.cfl > 0 && this.cfl <= 0.8)) throw new RangeError('CFL must be in (0, 0.8].');
    if (!(Number.isFinite(this.perturbation) && this.perturbation >= 0 && this.perturbation <= 0.2)) {
      throw new RangeError('Perturbation must lie in [0, 0.2].');
    }
    this.xMin = options.xMin ?? 0;
    this.xMax = options.xMax ?? 1;
    this.yMin = options.yMin ?? 0;
    this.yMax = options.yMax ?? ((this.xMax - this.xMin) * this.ny / this.nx);
    this.dx = (this.xMax - this.xMin) / this.nx;
    this.dy = (this.yMax - this.yMin) / this.ny;
    if (!(this.dx > 0 && this.dy > 0)) throw new RangeError('The domain must have positive area.');
    this.fluxOptions = {
      entropyFix: options.entropyFix ?? 0.1,
      // Reference inlet Mach is supersonic; the all-speed AUSM factor is 1.
      lowMachCutoff: options.lowMachCutoff ?? 1,
    };
    this.outlet = options.outlet ?? 'pressure';
    if (!['pressure', 'fixed', 'extrapolate'].includes(this.outlet)) throw new RangeError('Unknown outlet boundary.');
    this.perturbationMode = options.perturbationMode ?? 'velocity';
    if (!['velocity', 'shock-position'].includes(this.perturbationMode)) throw new RangeError('Unknown perturbation mode.');
    this.perturbationShape = options.perturbationShape ?? 'localized';
    if (!['localized', 'odd-even'].includes(this.perturbationShape)) throw new RangeError('Unknown perturbation shape.');
    const shock = normalShockStates(this.mach, this.gamma);
    this.left = options.uniformState ? { v: 0, ...options.uniformState } : shock.left;
    this.right = options.uniformState ? { v: 0, ...options.uniformState } : shock.right;
    this.leftU = primitiveToConservative(this.left, this.gamma);
    this.rightU = primitiveToConservative(this.right, this.gamma);
    this.isUniform = Boolean(options.uniformState);
    const fraction = options.shockFraction ?? 0.4;
    this.shockColumn = Math.max(2, Math.min(this.nx - 3, Math.round(fraction * this.nx)));
    this.shockX = this.xMin + this.shockColumn * this.dx;
    this.time = 0;
    this.steps = 0;
    this.lastDt = 0;
    this.failed = false;
    this.failureReason = '';
    this.failureCell = null;
    this.U = new Float64Array(4 * this.nx * this.ny);
    this._next = new Float64Array(this.U.length);
    this._fluxX = new Float64Array(4 * (this.nx + 1) * this.ny);
    this._fluxY = new Float64Array(this.U.length);
    this._leftWork = [0, 0, 0, 0];
    this._rightWork = [0, 0, 0, 0];
    this._boundaryIntegral = new Float64Array(4);
    this._initialTotals = new Float64Array(4);
    this._metricsCache = null;
    this._initialize();
    const firstMetrics = this.metrics();
    this.initialAmplitude = this.perturbation > 0 && !this.isUniform ? firstMetrics.amplitude : 0;
    this.initialTransverseRms = firstMetrics.transverseRms;
    this.initialRipple = firstMetrics.ripple;
    this.initialMetrics = { ...firstMetrics, growth: firstMetrics.amplitude > 0 ? 1 : null };
    this._metricsCache = null;
  }

  _initialize() {
    for (let j = 0; j < this.ny; j++) {
      // Anchor the sign to the middle row so changing ny cannot silently turn
      // the central outward kick into an inward kick (ny mod 4 effect).
      const parity = (j - Math.floor(this.ny / 2)) % 2 ? -1 : 1;
      const envelope = this.perturbationShape === 'localized'
        ? Math.exp(-(((j - 0.5 * (this.ny - 1)) / (0.1 * this.ny)) ** 2)) : 1;
      // The shock-position mode uses conservative subcell averages; its
      // amplitude is measured in cells, and it is an optional alternative.
      const rowShock = this.shockX + (this.perturbationMode === 'shock-position'
        ? this.perturbation * this.dx * parity * envelope : 0);
      for (let i = 0; i < this.nx; i++) {
        const k = 4 * (j * this.nx + i);
        const xLo = this.xMin + i * this.dx;
        const leftFraction = this.isUniform ? 1 : Math.max(0, Math.min(1, (rowShock - xLo) / this.dx));
        for (let c = 0; c < 4; c++) {
          this.U[k + c] = leftFraction * this.leftU[c] + (1 - leftFraction) * this.rightU[c];
        }
        if (!this.isUniform && this.perturbationMode === 'velocity' && this.perturbation > 0) {
          const offset = i - this.shockColumn;
          const band = offset >= -1 && offset <= 2;
          if (band) {
            // Localized odd-even mode, deterministic and identical for every
            // solver. Added kinetic energy keeps pressure unchanged. There is
            // no further forcing after this initial assignment.
            const v = this.perturbation * this.left.u * parity * envelope;
            this.U[k + 2] += this.U[k] * v;
            this.U[k + 3] += 0.5 * this.U[k] * v * v;
          }
        }
        for (let c = 0; c < 4; c++) this._initialTotals[c] += this.U[k + c] * this.dx * this.dy;
      }
    }
  }

  _stop(message, cell = null) {
    this.failed = true;
    this.failureReason = message;
    this.failureCell = cell;
    this._metricsCache = null;
    return 0;
  }

  _stableDt() {
    let maxRate = 0;
    const gm1 = this.gamma - 1;
    for (let k = 0; k < this.U.length; k += 4) {
      const rho = this.U[k];
      const u = this.U[k + 1] / rho;
      const v = this.U[k + 2] / rho;
      const p = gm1 * (this.U[k + 3] - 0.5 * rho * (u * u + v * v));
      if (!(rho > 0 && p > 0 && Number.isFinite(p) && Number.isFinite(u) && Number.isFinite(v))) {
        return this._stop(`Nonphysical input state: rho=${rho}, p=${p}.`, k / 4);
      }
      const a = Math.sqrt(this.gamma * p / rho);
      maxRate = Math.max(maxRate, (Math.abs(u) + a) / this.dx + (Math.abs(v) + a) / this.dy);
    }
    return this.cfl / maxRate;
  }

  /** Public CFL bound so paired solvers can advance with the same time step. */
  stableDt() {
    return this.failed ? 0 : this._stableDt();
  }

  /** Advance one conservative unsplit step; returns accepted dt, or 0 on failure. */
  step(maxDt = Infinity) {
    if (this.failed || !(maxDt > 0)) return 0;
    const dt = Math.min(maxDt, this._stableDt());
    if (this.failed || !(dt > 0 && Number.isFinite(dt))) return 0;
    const U = this.U, next = this._next;
    const Fx = this._fluxX, Fy = this._fluxY;
    const L = this._leftWork, R = this._rightWork;
    const nx = this.nx, ny = this.ny;
    const sx = dt / this.dx, sy = dt / this.dy;
    const boundaryStep = [0, 0, 0, 0];
    try {
      // x-normal faces, including the two physical boundary faces.
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i <= nx; i++) {
          const kLeft = 4 * (j * nx + i - 1);
          const kRight = kLeft + 4;
          if (i === 0) {
            for (let c = 0; c < 4; c++) L[c] = this.leftU[c];
          } else loadState(U, kLeft, L);
          if (i < nx) loadState(U, kRight, R);
          else if (this.outlet === 'fixed' || this.isUniform) {
            for (let c = 0; c < 4; c++) R[c] = this.rightU[c];
          } else {
            loadState(U, kLeft, R);
            if (this.outlet === 'pressure') {
              R[3] = this.right.p / (this.gamma - 1) + 0.5 * (R[1] * R[1] + R[2] * R[2]) / R[0];
            }
          }
          const flux = numericalFlux(this.method, L, R, this.gamma, this.fluxOptions);
          const face = 4 * (j * (nx + 1) + i);
          for (let c = 0; c < 4; c++) {
            if (!Number.isFinite(flux[c])) throw new Error(`Nonfinite x-face flux at (${i},${j}).`);
            Fx[face + c] = flux[c];
            if (i === 0) boundaryStep[c] += dt * this.dy * flux[c];
            if (i === nx) boundaryStep[c] -= dt * this.dy * flux[c];
          }
        }
      }
      // Each periodic y face is visited exactly once. Swap normal/tangential
      // momentum into the same flux API and swap the returned momenta back.
      for (let j = 0; j < ny; j++) {
        const jNext = (j + 1) % ny;
        for (let i = 0; i < nx; i++) {
          const lower = 4 * (j * nx + i), upper = 4 * (jNext * nx + i);
          loadState(U, lower, L, true);
          loadState(U, upper, R, true);
          const flux = numericalFlux(this.method, L, R, this.gamma, this.fluxOptions);
          for (let c = 0; c < 4; c++) {
            const fc = c === 1 ? flux[2] : c === 2 ? flux[1] : flux[c];
            if (!Number.isFinite(fc)) throw new Error(`Nonfinite y-face flux at (${i},${j}).`);
            Fy[lower + c] = fc;
          }
        }
      }
    } catch (error) {
      return this._stop(error.message || String(error));
    }
    // Check the full candidate before committing. Retain the last valid field
    // for an honest stopped-run plot, and expose the attempted failure state.
    const gm1 = this.gamma - 1;
    for (let j = 0; j < ny; j++) {
      const jPrev = (j + ny - 1) % ny;
      for (let i = 0; i < nx; i++) {
        const k = 4 * (j * nx + i);
        const leftFace = 4 * (j * (nx + 1) + i);
        const bottomFace = 4 * (jPrev * nx + i);
        for (let c = 0; c < 4; c++) {
          next[k + c] = U[k + c]
            - sx * (Fx[leftFace + 4 + c] - Fx[leftFace + c])
            - sy * (Fy[k + c] - Fy[bottomFace + c]);
        }
      }
    }
    for (let k = 0; k < next.length; k += 4) {
      const rho = next[k];
      const p = gm1 * (next[k + 3] - 0.5 * (next[k + 1] ** 2 + next[k + 2] ** 2) / rho);
      if (!(rho > 0 && p > 0 && Number.isFinite(p) && Number.isFinite(rho))) {
        this.failedAtTime = this.time + dt;
        this.failedState = { rho, p, U: Array.from(next.subarray(k, k + 4)) };
        return this._stop(`Step rejected at t=${(this.time + dt).toPrecision(5)}: rho=${rho.toPrecision(5)}, p=${p.toPrecision(5)}. No clipping or fallback.`, k / 4);
      }
    }
    this.U = next;
    this._next = U;
    for (let c = 0; c < 4; c++) this._boundaryIntegral[c] += boundaryStep[c];
    this.time += dt;
    this.steps++;
    this.lastDt = dt;
    this._metricsCache = null;
    return dt;
  }

  densityField() {
    const field = new Float64Array(this.nx * this.ny);
    for (let q = 0; q < field.length; q++) field[q] = this.U[4 * q];
    return field;
  }

  transverseVelocityField() {
    const field = new Float64Array(this.nx * this.ny);
    for (let q = 0; q < field.length; q++) field[q] = this.U[4 * q + 2] / this.U[4 * q];
    return field;
  }

  pressureField() {
    const field = new Float64Array(this.nx * this.ny);
    for (let q = 0; q < field.length; q++) {
      const k = 4 * q;
      field[q] = (this.gamma - 1) * (this.U[k + 3] - 0.5 * (this.U[k + 1] ** 2 + this.U[k + 2] ** 2) / this.U[k]);
    }
    return field;
  }

  /**
   * ripple: rms of density-midpoint shock positions, measured in x cells.
   * amplitude: hypot(global rowwise density RMS/rho2, global v RMS/u1).
   * growth: amplitude / its measured initial value; null for an exact zero seed.
   * Neither the colour field nor these diagnostics contain a prescribed pattern.
   */
  metrics() {
    if (this._metricsCache) return this._metricsCache;
    const nx = this.nx, ny = this.ny, n = nx * ny;
    const means = new Float64Array(nx);
    // Accumulate differences from row zero so a perfectly planar field has
    // exactly zero transverse density diagnostic, even in floating point.
    for (let i = 0; i < nx; i++) means[i] = this.U[4 * i];
    const totals = new Float64Array(4);
    let minRho = Infinity, minP = Infinity, maxRho = -Infinity, maxP = -Infinity;
    let vsum = 0, v2sum = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = 4 * (j * nx + i);
        const rho = this.U[k], v = this.U[k + 2] / rho;
        const p = (this.gamma - 1) * (this.U[k + 3] - 0.5 * (this.U[k + 1] ** 2 + this.U[k + 2] ** 2) / rho);
        means[i] += (rho - this.U[4 * i]) / ny;
        minRho = Math.min(minRho, rho); maxRho = Math.max(maxRho, rho);
        minP = Math.min(minP, p); maxP = Math.max(maxP, p);
        vsum += v; v2sum += v * v;
        for (let c = 0; c < 4; c++) totals[c] += this.U[k + c] * this.dx * this.dy;
      }
    }
    let densitySum = 0, maxColumnRms = 0, oddEven = 0;
    for (let i = 0; i < nx; i++) {
      let local = 0, alt = 0;
      for (let j = 0; j < ny; j++) {
        const fluctuation = this.U[4 * (j * nx + i)] - means[i];
        local += fluctuation * fluctuation;
        alt += (j % 2 ? -1 : 1) * fluctuation / ny;
      }
      densitySum += local;
      maxColumnRms = Math.max(maxColumnRms, Math.sqrt(local / ny) / this.right.rho);
      oddEven = Math.max(oddEven, Math.abs(alt) / this.right.rho);
    }
    const shockPositions = new Float64Array(ny);
    const midpoint = 0.5 * (this.left.rho + this.right.rho);
    for (let j = 0; j < ny; j++) {
      let found = this.shockX, closest = Infinity;
      for (let i = 0; i < nx - 1; i++) {
        const r0 = this.U[4 * (j * nx + i)], r1 = this.U[4 * (j * nx + i + 1)];
        if (r0 <= midpoint && r1 > midpoint) {
          const pos = this.xMin + (i + 0.5 + (midpoint - r0) / (r1 - r0)) * this.dx;
          if (Math.abs(pos - this.shockX) < closest) {
            found = pos; closest = Math.abs(pos - this.shockX);
          }
        }
      }
      shockPositions[j] = found;
    }
    const meanShockPosition = shockPositions[0]
      + shockPositions.reduce((a, x) => a + (x - shockPositions[0]), 0) / ny;
    const ripple = Math.sqrt(shockPositions.reduce((a, x) => a + (x - meanShockPosition) ** 2, 0) / ny) / this.dx;
    const densityRms = Math.sqrt(densitySum / n) / this.right.rho;
    const transverseRms = Math.sqrt(v2sum / n);
    const amplitude = Math.hypot(densityRms, transverseRms / Math.abs(this.left.u || 1));
    const massBalanceError = totals[0] - this._initialTotals[0] - this._boundaryIntegral[0];
    this._metricsCache = {
      time: this.time, steps: this.steps, ripple, meanShockPosition,
      amplitude, growth: this.initialAmplitude > 1e-30 ? amplitude / this.initialAmplitude : null,
      densityRms, maxColumnRms, oddEven,
      transverseRms, transverseMean: vsum / n,
      minP, minRho, maxP, maxRho, mass: totals[0], energy: totals[3],
      massBalanceError, relativeMassBalanceError: massBalanceError / this._initialTotals[0],
      energyBalanceError: totals[3] - this._initialTotals[3] - this._boundaryIntegral[3],
      failed: this.failed,
    };
    return this._metricsCache;
  }
}
