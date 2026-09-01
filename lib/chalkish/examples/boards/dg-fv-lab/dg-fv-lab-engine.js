/**
 * Numerical DG engine adapted from the user-owned CKPEIIKA demo.
 * Upstream SHA-256: 8ea16424cb737960b69dafebe8f1b11a24d6a4404bbebc7c0d3889ec821fcd9a
 * Presentation-independent; see docs/REFERENCE_DEMO_PORTS.md.
 */
let DgEngine;
(function () {
  'use strict';

  const TAU = 2 * Math.PI;
  const EPS = 1e-13;

  const Q = Object.freeze({
    x: Object.freeze([-0.9061798459386640, -0.5384693101056831, 0, 0.5384693101056831, 0.9061798459386640]),
    w: Object.freeze([0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891]),
  });

  const EQ = Object.freeze({
    x: Object.freeze([-0.7745966692414834, 0, 0.7745966692414834]),
    w: Object.freeze([0.5555555555555556, 0.8888888888888888, 0.5555555555555556]),
  });

  const FACE = Object.freeze({
    INTERIOR: 0,
    INLET: 1,
    OUTFLOW: 2,
    FARFIELD: 3,
    WALL: 4,
  });

  function clamp(x, lo, hi) {
    return x < lo ? lo : (x > hi ? hi : x);
  }

  function wrap01(x) {
    x -= Math.floor(x);
    return x < 0 ? x + 1 : x;
  }

  function legendre(n, x) {
    if (n === 0) return 1;
    if (n === 1) return x;
    if (n === 2) return 0.5 * (3 * x * x - 1);
    if (n === 3) return 0.5 * (5 * x * x * x - 3 * x);
    return 0;
  }

  function dLegendre(n, x) {
    if (n === 0) return 0;
    if (n === 1) return 1;
    if (n === 2) return 3 * x;
    if (n === 3) return 0.5 * (15 * x * x - 3);
    return 0;
  }

  function minmod3(a, b, c) {
    if (a > 0 && b > 0 && c > 0) return Math.min(a, b, c);
    if (a < 0 && b < 0 && c < 0) return Math.max(a, b, c);
    return 0;
  }

  // Obstacle shapes for the Euler case, shared by the main thread and the
  // worker so both build the identical solid mask. All shapes have frontal
  // height 2r, so drag coefficients are directly comparable across shapes.
  const WEDGE_HALF_ANGLE = 10 * Math.PI / 180;

  function insideShape(shape, x, y, cx, cy, r) {
    if (shape === 'square') {
      return Math.abs(x - cx) < r && Math.abs(y - cy) < r;
    }
    if (shape === 'wedge') {
      // Triangle pointing upstream: sharp tip, flat axis-aligned base.
      const L = r / Math.tan(WEDGE_HALF_ANGLE);
      const xt = cx - 0.5 * L;
      return x > xt && x < xt + L && Math.abs(y - cy) < (x - xt) * Math.tan(WEDGE_HALF_ANGLE);
    }
    return Math.hypot(x - cx, y - cy) < r;
  }

  // Weak-branch solution of the θ–β–M oblique-shock relation
  //   tan θ = 2 cot β (M² sin²β − 1) / (M²(γ + cos 2β) + 2).
  // Returns NaN when the shock is detached (θ > θmax(M)) or M ≤ 1.
  function obliqueShockBeta(M, theta, gamma) {
    if (!(M > 1) || !(theta > 0)) return NaN;
    const f = (b) => {
      const s = Math.sin(b);
      return 2 * (M * M * s * s - 1) / (Math.tan(b) * (M * M * (gamma + Math.cos(2 * b)) + 2)) - Math.tan(theta);
    };
    const bMin = Math.asin(1 / M) + 1e-9;
    const bMax = Math.PI / 2 - 1e-9;
    const n = 400;
    let prevB = bMin, prevF = f(bMin);
    for (let k = 1; k <= n; k++) {
      const b = bMin + (bMax - bMin) * k / n;
      const fb = f(b);
      if (prevF <= 0 && fb >= 0) {
        let lo = prevB, hi = b;
        for (let it = 0; it < 50; it++) {
          const mid = 0.5 * (lo + hi);
          if (f(mid) < 0) lo = mid; else hi = mid;
        }
        return 0.5 * (lo + hi);
      }
      prevB = b;
      prevF = fb;
    }
    return NaN;
  }

  function buildBasis(p) {
    const np = p + 1;
    const phi = [];
    const dphi = [];
    const ephi = [];
    const edphi = [];
    for (let q = 0; q < Q.x.length; q++) {
      phi[q] = new Float64Array(np);
      dphi[q] = new Float64Array(np);
      for (let m = 0; m < np; m++) {
        phi[q][m] = legendre(m, Q.x[q]);
        dphi[q][m] = dLegendre(m, Q.x[q]);
      }
    }
    for (let q = 0; q < EQ.x.length; q++) {
      ephi[q] = new Float64Array(np);
      edphi[q] = new Float64Array(np);
      for (let m = 0; m < np; m++) {
        ephi[q][m] = legendre(m, EQ.x[q]);
        edphi[q][m] = dLegendre(m, EQ.x[q]);
      }
    }

    const left = new Float64Array(np);
    const right = new Float64Array(np);
    const mass = new Float64Array(np);
    for (let m = 0; m < np; m++) {
      left[m] = legendre(m, -1);
      right[m] = legendre(m, 1);
      mass[m] = 2 / (2 * m + 1);
    }

    const nm2 = np * np;
    const sqn = Q.x.length;
    const volPhi = new Float64Array(sqn * sqn * nm2);
    const volDxi = new Float64Array(sqn * sqn * nm2);
    const volDeta = new Float64Array(sqn * sqn * nm2);
    const volW = new Float64Array(sqn * sqn);
    const invMassUnit = new Float64Array(nm2);
    for (let a = 0; a < np; a++) {
      for (let b = 0; b < np; b++) invMassUnit[a * np + b] = (2 * a + 1) * (2 * b + 1);
    }
    for (let qx = 0; qx < sqn; qx++) {
      for (let qy = 0; qy < sqn; qy++) {
        const qo = qx * sqn + qy;
        volW[qo] = Q.w[qx] * Q.w[qy];
        const bo = qo * nm2;
        for (let a = 0; a < np; a++) {
          for (let b = 0; b < np; b++) {
            const mode = a * np + b;
            volPhi[bo + mode] = phi[qx][a] * phi[qy][b];
            volDxi[bo + mode] = dphi[qx][a] * phi[qy][b];
            volDeta[bo + mode] = phi[qx][a] * dphi[qy][b];
          }
        }
      }
    }

    const faceL = new Float64Array(sqn * nm2);
    const faceR = new Float64Array(sqn * nm2);
    const faceB = new Float64Array(sqn * nm2);
    const faceT = new Float64Array(sqn * nm2);
    for (let q = 0; q < sqn; q++) {
      const bo = q * nm2;
      for (let a = 0; a < np; a++) {
        for (let b = 0; b < np; b++) {
          const mode = a * np + b;
          faceL[bo + mode] = left[a] * phi[q][b];
          faceR[bo + mode] = right[a] * phi[q][b];
          faceB[bo + mode] = phi[q][a] * left[b];
          faceT[bo + mode] = phi[q][a] * right[b];
        }
      }
    }

    const qn = EQ.x.length;
    const eVolPhi = new Float64Array(qn * qn * nm2);
    const eVolDxi = new Float64Array(qn * qn * nm2);
    const eVolDeta = new Float64Array(qn * qn * nm2);
    const eVolW = new Float64Array(qn * qn);
    const eInvMassUnit = new Float64Array(nm2);
    for (let a = 0; a < np; a++) {
      for (let b = 0; b < np; b++) eInvMassUnit[a * np + b] = (2 * a + 1) * (2 * b + 1);
    }
    for (let qx = 0; qx < qn; qx++) {
      for (let qy = 0; qy < qn; qy++) {
        const qo = qx * qn + qy;
        eVolW[qo] = EQ.w[qx] * EQ.w[qy];
        const bo = qo * nm2;
        for (let a = 0; a < np; a++) {
          for (let b = 0; b < np; b++) {
            const mode = a * np + b;
            eVolPhi[bo + mode] = ephi[qx][a] * ephi[qy][b];
            eVolDxi[bo + mode] = edphi[qx][a] * ephi[qy][b];
            eVolDeta[bo + mode] = ephi[qx][a] * edphi[qy][b];
          }
        }
      }
    }

    const eFaceL = new Float64Array(qn * nm2);
    const eFaceR = new Float64Array(qn * nm2);
    const eFaceB = new Float64Array(qn * nm2);
    const eFaceT = new Float64Array(qn * nm2);
    for (let q = 0; q < qn; q++) {
      const bo = q * nm2;
      for (let a = 0; a < np; a++) {
        for (let b = 0; b < np; b++) {
          const mode = a * np + b;
          eFaceL[bo + mode] = left[a] * ephi[q][b];
          eFaceR[bo + mode] = right[a] * ephi[q][b];
          eFaceB[bo + mode] = ephi[q][a] * left[b];
          eFaceT[bo + mode] = ephi[q][a] * right[b];
        }
      }
    }

    return {
      p, np, nm1: np, nm2, phi, dphi, ephi, edphi, left, right, mass,
      volPhi, volDxi, volDeta, volW, invMassUnit, faceL, faceR, faceB, faceT,
      eVolPhi, eVolDxi, eVolDeta, eVolW, eInvMassUnit, eFaceL, eFaceR, eFaceB, eFaceT,
    };
  }

  function burgersPhysicalFlux(u) {
    return 0.5 * u * u;
  }

  function burgersFlux(um, up, alpha) {
    const c = Math.max(Math.abs(um), Math.abs(up));
    return 0.5 * (burgersPhysicalFlux(um) + burgersPhysicalFlux(up)) + 0.5 * alpha * c * (um - up);
  }

  function advectionNormalFlux(speedNormal, um, up, alpha) {
    return 0.5 * speedNormal * (um + up) + 0.5 * alpha * Math.abs(speedNormal) * (um - up);
  }

  function idx1(state, i, m) {
    return i * state.basis.np + m;
  }

  function cellBase2(state, i, j) {
    return (j * state.nx + i) * state.basis.nm2;
  }

  function eval1(state, U, i, xi) {
    const np = state.basis.np;
    const base = i * np;
    let s = 0;
    for (let m = 0; m < np; m++) s += U[base + m] * legendre(m, xi);
    return s;
  }

  function eval1AtX(state, U, x) {
    x = wrap01(x);
    const xx = x * state.nx;
    let i = Math.floor(xx);
    if (i >= state.nx) i = state.nx - 1;
    const xi = 2 * (xx - i) - 1;
    return eval1(state, U, i, xi);
  }

  function eval2Ref(state, U, base, xi, eta) {
    const np = state.basis.np;
    let s = 0;
    for (let a = 0; a < np; a++) {
      const pa = legendre(a, xi);
      const row = base + a * np;
      for (let b = 0; b < np; b++) s += U[row + b] * pa * legendre(b, eta);
    }
    return s;
  }

  function evalModal(U, base, coeffs, offset, count) {
    let s = 0;
    for (let mode = 0; mode < count; mode++) s += U[base + mode] * coeffs[offset + mode];
    return s;
  }

  function eval2AtXY(state, U, x, y) {
    x = wrap01(x);
    y = wrap01(y);
    const gx = x * state.nx;
    const gy = y * state.ny;
    let i = Math.floor(gx);
    let j = Math.floor(gy);
    if (i >= state.nx) i = state.nx - 1;
    if (j >= state.ny) j = state.ny - 1;
    const xi = 2 * (gx - i) - 1;
    const eta = 2 * (gy - j) - 1;
    return eval2Ref(state, U, cellBase2(state, i, j), xi, eta);
  }

  function mean2AtXY(state, U, x, y) {
    x = wrap01(x);
    y = wrap01(y);
    const i = Math.min(state.nx - 1, Math.floor(x * state.nx));
    const j = Math.min(state.ny - 1, Math.floor(y * state.ny));
    return U[cellBase2(state, i, j)];
  }

  function projectInitial1D(state, U, initial) {
    const { np, phi } = state.basis;
    U.fill(0);
    for (let i = 0; i < state.nx; i++) {
      const x0 = i / state.nx;
      const h = 1 / state.nx;
      for (let m = 0; m < np; m++) {
        let integral = 0;
        for (let q = 0; q < Q.x.length; q++) {
          const x = x0 + 0.5 * h * (Q.x[q] + 1);
          integral += Q.w[q] * initial(wrap01(x)) * phi[q][m];
        }
        U[idx1(state, i, m)] = 0.5 * (2 * m + 1) * integral;
      }
    }
  }

  function projectInitial2D(state, U, initial) {
    const { np, phi } = state.basis;
    U.fill(0);
    const hx = 1 / state.nx;
    const hy = 1 / state.ny;
    for (let j = 0; j < state.ny; j++) {
      for (let i = 0; i < state.nx; i++) {
        const base = cellBase2(state, i, j);
        for (let a = 0; a < np; a++) {
          for (let b = 0; b < np; b++) {
            let integral = 0;
            for (let qx = 0; qx < Q.x.length; qx++) {
              const x = (i + 0.5 * (Q.x[qx] + 1)) * hx;
              for (let qy = 0; qy < Q.x.length; qy++) {
                const y = (j + 0.5 * (Q.x[qy] + 1)) * hy;
                integral += Q.w[qx] * Q.w[qy] * initial(wrap01(x), wrap01(y)) * phi[qx][a] * phi[qy][b];
              }
            }
            U[base + a * np + b] = 0.25 * (2 * a + 1) * (2 * b + 1) * integral;
          }
        }
      }
    }
  }

  function createEquation(config) {
    return Object.freeze({
      kind: String(config.kind),
      nvar: Number(config.nvar || 1),
      fluxX: config.fluxX || null,
      fluxY: config.fluxY || null,
      maxSpeedX: config.maxSpeedX || null,
      maxSpeedY: config.maxSpeedY || null,
      primitive: config.primitive || null,
      positivity: config.positivity || null,
    });
  }

  const Equations = Object.freeze({
    burgers1D: createEquation({
      kind: 'burgers1d',
      nvar: 1,
      fluxX: burgersPhysicalFlux,
      maxSpeedX: u => Math.abs(u),
    }),
    scalarAdvection2D: createEquation({
      kind: 'scalar-advection2d',
      nvar: 1,
      fluxX: (u, ax) => ax * u,
      fluxY: (u, ay) => ay * u,
      maxSpeedX: ax => Math.abs(ax),
      maxSpeedY: ay => Math.abs(ay),
    }),
    euler2D: createEquation({
      kind: 'euler2d',
      nvar: 4,
    }),
  });

  const NumericalFlux = Object.freeze({
    scalarAdvectionNormal: advectionNormalFlux,
    burgersRusanov: burgersFlux,
  });

  const Euler2D = {
    name: 'Euler2D',
    nvar: 4,
    consFromPrim(rho, u, v, p, gamma, out) {
      out[0] = rho;
      out[1] = rho * u;
      out[2] = rho * v;
      out[3] = p / (gamma - 1) + 0.5 * rho * (u * u + v * v);
    },
    prim(U, gamma, out) {
      const rho = Math.max(1e-12, U[0]);
      const u = U[1] / rho;
      const v = U[2] / rho;
      const p = this.pressureSafe(U, gamma);
      out[0] = rho;
      out[1] = u;
      out[2] = v;
      out[3] = p;
      out[4] = Math.sqrt(gamma * p / rho);
    },
    pressureRaw(U, gamma) {
      const rho = U[0];
      if (!(rho > 0)) return -Infinity;
      const u = U[1] / rho;
      const v = U[2] / rho;
      return (gamma - 1) * (U[3] - 0.5 * rho * (u * u + v * v));
    },
    pressureSafe(U, gamma) {
      if (!(U[0] > 0)) return 1e-12;
      return Math.max(1e-12, this.pressureRaw(U, gamma));
    },
    pressure(U, gamma) {
      return this.pressureSafe(U, gamma);
    },
    fluxX(U, gamma, out) {
      const rho = Math.max(1e-12, U[0]);
      const u = U[1] / rho;
      const v = U[2] / rho;
      const p = this.pressure(U, gamma);
      out[0] = U[1];
      out[1] = U[1] * u + p;
      out[2] = U[1] * v;
      out[3] = (U[3] + p) * u;
    },
    fluxY(U, gamma, out) {
      const rho = Math.max(1e-12, U[0]);
      const u = U[1] / rho;
      const v = U[2] / rho;
      const p = this.pressure(U, gamma);
      out[0] = U[2];
      out[1] = U[2] * u;
      out[2] = U[2] * v + p;
      out[3] = (U[3] + p) * v;
    },
    maxNormalSpeed(U, nx, ny, gamma) {
      const rho = Math.max(1e-12, U[0]);
      const u = U[1] / rho;
      const v = U[2] / rho;
      const p = this.pressure(U, gamma);
      return Math.abs(u * nx + v * ny) + Math.sqrt(gamma * p / rho);
    },
    rusanovFlux(UL, UR, nx, ny, gamma, alpha, out, scratch) {
      const FL = scratch.fluxXL, GL = scratch.fluxYL, FR = scratch.fluxXR, GR = scratch.fluxYR;
      if (ny === 0) {
        this.fluxX(UL, gamma, FL);
        this.fluxX(UR, gamma, FR);
      } else if (nx === 0) {
        this.fluxY(UL, gamma, GL);
        this.fluxY(UR, gamma, GR);
      } else {
        this.fluxX(UL, gamma, FL);
        this.fluxY(UL, gamma, GL);
        this.fluxX(UR, gamma, FR);
        this.fluxY(UR, gamma, GR);
      }
      const a = alpha * Math.max(this.maxNormalSpeed(UL, nx, ny, gamma), this.maxNormalSpeed(UR, nx, ny, gamma));
      for (let v = 0; v < 4; v++) {
        const left = ny === 0 ? nx * FL[v] : (nx === 0 ? ny * GL[v] : nx * FL[v] + ny * GL[v]);
        const right = ny === 0 ? nx * FR[v] : (nx === 0 ? ny * GR[v] : nx * FR[v] + ny * GR[v]);
        out[v] = 0.5 * (left + right) - 0.5 * a * (UR[v] - UL[v]);
      }
    },
    wallFlux(Uinside, nx, ny, gamma, out) {
      const p = this.pressure(Uinside, gamma);
      out[0] = 0;
      out[1] = p * nx;
      out[2] = p * ny;
      out[3] = 0;
    },
    boundaryState(type, Uinside, x, y, nx, ny, params, out) {
      if (type === FACE.WALL) {
        out.set(Uinside);
        return;
      }
      params.farfield(EULER_FAR);
      this.characteristicGhost(Uinside, EULER_FAR, nx, ny, params.gamma, out);
    },
    // Riemann-invariant far-field state for an exterior face with outward
    // normal (nx,ny). Handles sub/supersonic in/outflow uniformly, so inlet,
    // outlet, and the lateral boundaries all behave correctly at any Mach.
    characteristicGhost(Ui, Uf, nx, ny, gamma, out) {
      const gm1 = gamma - 1;
      const ri = Math.max(1e-12, Ui[0]);
      const ui = Ui[1] / ri, vi = Ui[2] / ri;
      const pi = this.pressureSafe(Ui, gamma);
      const ci = Math.sqrt(gamma * pi / ri);
      const rf = Math.max(1e-12, Uf[0]);
      const uf = Uf[1] / rf, vf = Uf[2] / rf;
      const pf = Math.max(1e-12, gm1 * (Uf[3] - 0.5 * rf * (uf * uf + vf * vf)));
      const cf = Math.sqrt(gamma * pf / rf);
      const uni = ui * nx + vi * ny;
      const unf = uf * nx + vf * ny;
      if (uni >= ci) { out.set(Ui); return; }
      if (unf <= -cf) { out.set(Uf); return; }
      const Rp = uni + 2 * ci / gm1;
      const Rm = unf - 2 * cf / gm1;
      const unb = 0.5 * (Rp + Rm);
      const cb = Math.max(1e-9, 0.25 * gm1 * (Rp - Rm));
      let sEnt, ut, vt;
      if (unb >= 0) {
        sEnt = pi / Math.pow(ri, gamma);
        ut = ui - uni * nx; vt = vi - uni * ny;
      } else {
        sEnt = pf / Math.pow(rf, gamma);
        ut = uf - unf * nx; vt = vf - unf * ny;
      }
      const rb = Math.pow(cb * cb / (gamma * Math.max(1e-12, sEnt)), 1 / gm1);
      const pb = rb * cb * cb / gamma;
      this.consFromPrim(rb, ut + unb * nx, vt + unb * ny, pb, gamma, out);
    },
    positivityMeanOk(Umean, gamma) {
      return Umean[0] > 1e-10 && this.pressureRaw(Umean, gamma) > 1e-10;
    },
  };

  const EULER_FAR = new Float64Array(4);

  class DGSolver2D {
    constructor({ nx, ny, p, equation, params = {}, solid = null, initialCondition = null }) {
      this.nx = nx;
      this.ny = ny;
      this.nCells = nx * ny;
      this.basis = buildBasis(p);
      this.p = p;
      this.equation = equation;
      this.params = params;
      this.nvar = equation.nvar;
      this.nm = this.basis.nm2;
      this.cellStride = this.nCells;
      this.varStride = this.nm * this.nCells;
      this.solid = solid || new Uint8Array(this.nCells);
      // 'off' | 'pos' | 'minmod' | 'flatten' — see limit().
      this.limiterMode = params.limiter || 'minmod';
      this.limPos = 0;
      this.limTC = 0;
      this.U = new Float64Array(this.nvar * this.nm * this.nCells);
      this.R = new Float64Array(this.U.length);
      this.A = new Float64Array(this.U.length);
      this.B = new Float64Array(this.U.length);
      this.scratch = {
        UL: new Float64Array(this.nvar),
        UR: new Float64Array(this.nvar),
        Fn: new Float64Array(this.nvar),
        Fx: new Float64Array(this.nvar),
        Fy: new Float64Array(this.nvar),
        mean: new Float64Array(this.nvar),
        point: new Float64Array(this.nvar),
        fluxXL: new Float64Array(this.nvar),
        fluxYL: new Float64Array(this.nvar),
        fluxXR: new Float64Array(this.nvar),
        fluxYR: new Float64Array(this.nvar),
      };
      this.buildFaces();
      if (initialCondition) this.project(initialCondition);
    }

    id(v, m, c) { return ((v * this.nm + m) * this.nCells + c); }
    cell(i, j) { return j * this.nx + i; }
    isSolid(i, j) { return i < 0 || i >= this.nx || j < 0 || j >= this.ny ? 0 : this.solid[this.cell(i, j)]; }

    buildFaces() {
      const xInteriorL = [], xInteriorR = [], xWallCell = [], xWallSign = [], xInlet = [], xOut = [];
      const yInteriorB = [], yInteriorT = [], yWallCell = [], yWallSign = [], yBottom = [], yTop = [];
      for (let j = 0; j < this.ny; j++) {
        for (let i = 0; i <= this.nx; i++) {
          const hasL = i > 0 && !this.isSolid(i - 1, j);
          const hasR = i < this.nx && !this.isSolid(i, j);
          if (hasL && hasR) { xInteriorL.push(this.cell(i - 1, j)); xInteriorR.push(this.cell(i, j)); }
          else if (hasL && i < this.nx) { xWallCell.push(this.cell(i - 1, j)); xWallSign.push(1); }
          else if (hasR && i > 0) { xWallCell.push(this.cell(i, j)); xWallSign.push(-1); }
          else if (hasR && i === 0) xInlet.push(this.cell(i, j));
          else if (hasL && i === this.nx) xOut.push(this.cell(i - 1, j));
        }
      }
      for (let j = 0; j <= this.ny; j++) {
        for (let i = 0; i < this.nx; i++) {
          const hasB = j > 0 && !this.isSolid(i, j - 1);
          const hasT = j < this.ny && !this.isSolid(i, j);
          if (hasB && hasT) { yInteriorB.push(this.cell(i, j - 1)); yInteriorT.push(this.cell(i, j)); }
          else if (hasB && j < this.ny) { yWallCell.push(this.cell(i, j - 1)); yWallSign.push(1); }
          else if (hasT && j > 0) { yWallCell.push(this.cell(i, j)); yWallSign.push(-1); }
          else if (hasT && j === 0) yBottom.push(this.cell(i, j));
          else if (hasB && j === this.ny) yTop.push(this.cell(i, j - 1));
        }
      }
      this.faces = {
        xInteriorL: Int32Array.from(xInteriorL),
        xInteriorR: Int32Array.from(xInteriorR),
        xWallCell: Int32Array.from(xWallCell),
        xWallSign: Int8Array.from(xWallSign),
        xInlet: Int32Array.from(xInlet),
        xOut: Int32Array.from(xOut),
        yInteriorB: Int32Array.from(yInteriorB),
        yInteriorT: Int32Array.from(yInteriorT),
        yWallCell: Int32Array.from(yWallCell),
        yWallSign: Int8Array.from(yWallSign),
        yBottom: Int32Array.from(yBottom),
        yTop: Int32Array.from(yTop),
      };
    }

    project(initialCondition) {
      const { nm2, volPhi, volW, invMassUnit } = this.basis;
      const qn = Q.x.length;
      const Uq = this.scratch.UL;
      for (let c = 0; c < this.nCells; c++) {
        if (this.solid[c]) continue;
        const i = c % this.nx, j = (c / this.nx) | 0;
        for (let q = 0; q < qn * qn; q++) {
          const qx = (q / qn) | 0, qy = q - qx * qn;
          const x = (i + 0.5 * (Q.x[qx] + 1)) / this.nx;
          const y = (j + 0.5 * (Q.x[qy] + 1)) / this.ny;
          initialCondition(x, y, Uq);
          const off = q * nm2;
          for (let m = 0; m < nm2; m++) {
            const w = 0.25 * volW[q] * volPhi[off + m] * invMassUnit[m];
            for (let v = 0; v < this.nvar; v++) this.U[this.id(v, m, c)] += w * Uq[v];
          }
        }
      }
    }

    evalAt(U, c, coeffs, off, out) {
      for (let v = 0; v < this.nvar; v++) {
        const base = v * this.varStride + c;
        let s = 0;
        for (let m = 0; m < this.nm; m++) s += U[base + m * this.cellStride] * coeffs[off + m];
        out[v] = s;
      }
    }

    mean(U, c, out) {
      for (let v = 0; v < this.nvar; v++) out[v] = U[v * this.varStride + c];
    }

    eulerQuadratureTables() {
      if (this.p > 1) {
        const b = this.basis;
        return {
          q: Q,
          qn: Q.x.length,
          volPhi: b.volPhi,
          volDxi: b.volDxi,
          volDeta: b.volDeta,
          volW: b.volW,
          invMassUnit: b.invMassUnit,
          faceL: b.faceL,
          faceR: b.faceR,
          faceB: b.faceB,
          faceT: b.faceT,
        };
      }
      const b = this.basis;
      return {
        q: EQ,
        qn: EQ.x.length,
        volPhi: b.eVolPhi,
        volDxi: b.eVolDxi,
        volDeta: b.eVolDeta,
        volW: b.eVolW,
        invMassUnit: b.eInvMassUnit,
        faceL: b.eFaceL,
        faceR: b.eFaceR,
        faceB: b.eFaceB,
        faceT: b.eFaceT,
      };
    }

    addFlux(R, c, sign, faceJac, Fn, coeffs, off) {
      for (let m = 0; m < this.nm; m++) {
        const fac = sign * faceJac * coeffs[off + m];
        const mo = m * this.cellStride + c;
        for (let v = 0; v < this.nvar; v++) R[v * this.varStride + mo] += fac * Fn[v];
      }
    }

    rhs(U, R) {
      const { nm2 } = this.basis;
      const qt = this.eulerQuadratureTables();
      const { q: quad, qn, volPhi, volDxi, volDeta, volW, invMassUnit, faceL, faceR, faceB, faceT } = qt;
      const dx = this.params.Lx / this.nx, dy = this.params.Ly / this.ny;
      const eq = this.equation, gamma = this.params.gamma, alpha = this.params.alpha;
      const s = this.scratch;
      R.fill(0);
      for (let c = 0; c < this.nCells; c++) {
        if (this.solid[c]) continue;
        for (let qi = 0; qi < qn * qn; qi++) {
          const off = qi * nm2;
          this.evalAt(U, c, volPhi, off, s.UL);
          eq.fluxX(s.UL, gamma, s.Fx);
          eq.fluxY(s.UL, gamma, s.Fy);
          for (let m = 0; m < nm2; m++) {
            const wx = 0.5 * dy * volW[qi] * volDxi[off + m];
            const wy = 0.5 * dx * volW[qi] * volDeta[off + m];
            const mo = m * this.cellStride + c;
            for (let v = 0; v < this.nvar; v++) R[v * this.varStride + mo] += wx * s.Fx[v] + wy * s.Fy[v];
          }
        }
      }
      const f = this.faces;
      for (let k = 0; k < f.xInteriorL.length; k++) {
        const L = f.xInteriorL[k], Rcell = f.xInteriorR[k];
        for (let qi = 0; qi < qn; qi++) {
          const off = qi * nm2;
          this.evalAt(U, L, faceR, off, s.UL);
          this.evalAt(U, Rcell, faceL, off, s.UR);
          eq.rusanovFlux(s.UL, s.UR, 1, 0, gamma, alpha, s.Fn, s);
          this.addFlux(R, L, -0.5 * dy * quad.w[qi], 1, s.Fn, faceR, off);
          this.addFlux(R, Rcell, 0.5 * dy * quad.w[qi], 1, s.Fn, faceL, off);
        }
      }
      for (let k = 0; k < f.yInteriorB.length; k++) {
        const B = f.yInteriorB[k], T = f.yInteriorT[k];
        for (let qi = 0; qi < qn; qi++) {
          const off = qi * nm2;
          this.evalAt(U, B, faceT, off, s.UL);
          this.evalAt(U, T, faceB, off, s.UR);
          eq.rusanovFlux(s.UL, s.UR, 0, 1, gamma, alpha, s.Fn, s);
          this.addFlux(R, B, -0.5 * dx * quad.w[qi], 1, s.Fn, faceT, off);
          this.addFlux(R, T, 0.5 * dx * quad.w[qi], 1, s.Fn, faceB, off);
        }
      }
      this.boundaryFaces(U, R, f.xWallCell, f.xWallSign, 0, faceL, faceR, 0.5 * dy, qn, quad);
      this.boundaryFaces(U, R, f.yWallCell, f.yWallSign, 1, faceB, faceT, 0.5 * dx, qn, quad);
      this.boundaryFaces(U, R, f.xInlet, null, 2, faceL, faceL, 0.5 * dy, qn, quad);
      this.boundaryFaces(U, R, f.xOut, null, 3, faceR, faceR, 0.5 * dy, qn, quad);
      this.boundaryFaces(U, R, f.yBottom, null, 4, faceB, faceB, 0.5 * dx, qn, quad);
      this.boundaryFaces(U, R, f.yTop, null, 5, faceT, faceT, 0.5 * dx, qn, quad);

      const invArea = 1 / (dx * dy);
      for (let c = 0; c < this.nCells; c++) {
        if (this.solid[c]) continue;
        for (let m = 0; m < nm2; m++) {
          const fac = invMassUnit[m] * invArea;
          const mo = m * this.cellStride + c;
          for (let v = 0; v < this.nvar; v++) R[v * this.varStride + mo] *= fac;
        }
      }
    }

    boundaryFaces(U, R, cells, signs, kind, faceNeg, facePos, jac, qn, quad) {
      const eq = this.equation, gamma = this.params.gamma, alpha = this.params.alpha;
      const nm2 = this.nm, s = this.scratch;
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k];
        let nx = 0, ny = 0, coeffs = facePos, sign = -1, type = FACE.OUTFLOW;
        if (kind === 0) { nx = signs[k]; coeffs = nx > 0 ? facePos : faceNeg; sign = -1; type = FACE.WALL; }
        else if (kind === 1) { ny = signs[k]; coeffs = ny > 0 ? facePos : faceNeg; sign = -1; type = FACE.WALL; }
        else if (kind === 2) { nx = -1; coeffs = faceNeg; sign = -1; type = FACE.INLET; }
        else if (kind === 3) { nx = 1; coeffs = facePos; sign = -1; type = FACE.OUTFLOW; }
        else if (kind === 4) { ny = -1; coeffs = faceNeg; sign = -1; type = FACE.FARFIELD; }
        else if (kind === 5) { ny = 1; coeffs = facePos; sign = -1; type = FACE.FARFIELD; }
        for (let q = 0; q < qn; q++) {
          const off = q * nm2;
          this.evalAt(U, c, coeffs, off, s.UL);
          if (type === FACE.WALL) eq.wallFlux(s.UL, nx, ny, gamma, s.Fn);
          else {
            eq.boundaryState(type, s.UL, 0, 0, nx, ny, this.params, s.UR);
            eq.rusanovFlux(s.UL, s.UR, nx, ny, gamma, alpha, s.Fn, s);
          }
          this.addFlux(R, c, sign * jac * quad.w[q], 1, s.Fn, coeffs, off);
        }
      }
    }

    // Returns the Zhang–Shu scaling factor needed so that density and
    // pressure stay above eps at the quadrature point coeffs[off..]; assumes
    // this.scratch.mean already holds the (admissible) cell mean.
    pointTheta(U, c, coeffs, off, theta, epsRho, epsP) {
      const s = this.scratch, eq = this.equation, gamma = this.params.gamma;
      this.evalAt(U, c, coeffs, off, s.point);
      if (s.point[0] < epsRho) {
        theta = Math.min(theta, (s.mean[0] - epsRho) / (s.mean[0] - s.point[0] + 1e-14));
      }
      if (eq.pressureRaw(s.point, gamma) < epsP) {
        let lo = 0, hi = theta;
        for (let it = 0; it < 18; it++) {
          const mid = 0.5 * (lo + hi);
          for (let v = 0; v < this.nvar; v++) s.UR[v] = s.mean[v] + mid * (s.point[v] - s.mean[v]);
          if (eq.pressureRaw(s.UR, gamma) >= epsP) lo = mid; else hi = mid;
        }
        theta = Math.min(theta, lo);
      }
      return theta;
    }

    positivityLimiter(U) {
      if (this.nm === 1) return 0;
      const epsRho = 1e-7, epsP = 1e-7;
      const qt = this.eulerQuadratureTables();
      const qn = qt.qn, s = this.scratch, eq = this.equation, gamma = this.params.gamma;
      const faceSets = [qt.faceL, qt.faceR, qt.faceB, qt.faceT];
      let fixed = 0;
      for (let c = 0; c < this.nCells; c++) {
        if (this.solid[c]) continue;
        this.mean(U, c, s.mean);
        if (!eq.positivityMeanOk(s.mean, gamma)) {
          this.params.farfield(s.mean);
          for (let v = 0; v < this.nvar; v++) U[v * this.varStride + c] = s.mean[v];
          for (let m = 1; m < this.nm; m++) {
            const mo = m * this.cellStride + c;
            for (let v = 0; v < this.nvar; v++) U[v * this.varStride + mo] = 0;
          }
          fixed++;
          continue;
        }
        let theta = 1;
        for (let q = 0; q < qn * qn; q++) {
          theta = this.pointTheta(U, c, qt.volPhi, q * this.nm, theta, epsRho, epsP);
        }
        for (const face of faceSets) {
          for (let q = 0; q < qn; q++) theta = this.pointTheta(U, c, face, q * this.nm, theta, epsRho, epsP);
        }
        if (theta < 0.999999) {
          theta = Math.max(0, theta);
          for (let m = 1; m < this.nm; m++) {
            const mo = m * this.cellStride + c;
            for (let v = 0; v < this.nvar; v++) U[v * this.varStride + mo] *= theta;
          }
          fixed++;
        }
      }
      return fixed;
    }

    // Troubled-cell limiter. In 'flatten' mode high modes of flagged cells are
    // dropped to the cell mean (very robust, very dissipative). In 'minmod'
    // mode flagged cells are reduced to limited linears, Cockburn–Shu style:
    // slope coefficients are minmod-compared against neighbour mean
    // differences, all other high modes are dropped.
    troubledLimiter(U) {
      if (this.p < 1) return 0;
      const mode = this.limiterMode;
      if (mode !== 'minmod' && mode !== 'flatten') return 0;
      const np = this.basis.np;
      const threshold = this.p === 1 ? 0.08 : 0.18;
      const qt = this.eulerQuadratureTables();
      const qn = qt.qn;
      const phi = qt.volPhi;
      const eq = this.equation;
      const gamma = this.params.gamma;
      const s = this.scratch;
      let count = 0;
      for (let c = 0; c < this.nCells; c++) {
        if (this.solid[c]) continue;
        let high = 0, low = 1e-16;
        for (let v = 0; v < this.nvar; v++) low += U[v * this.varStride + c] ** 2;
        for (let m = 1; m < this.nm; m++) {
          const mo = m * this.cellStride + c;
          for (let v = 0; v < this.nvar; v++) high += U[v * this.varStride + mo] ** 2;
        }
        let troubled = high / low > threshold;
        if (!troubled) {
          this.mean(U, c, s.mean);
          const meanRho = Math.max(1e-12, s.mean[0]);
          const meanP = Math.max(1e-12, eq.pressureRaw(s.mean, gamma));
          for (let q = 0; q < qn * qn; q++) {
            this.evalAt(U, c, phi, q * this.nm, s.point);
            const p = eq.pressureRaw(s.point, gamma);
            if (
              s.point[0] < 0.25 * meanRho ||
              s.point[0] > 4.0 * meanRho ||
              p < 0.20 * meanP ||
              p > 5.0 * meanP
            ) {
              troubled = true;
              break;
            }
          }
        }
        if (!troubled) continue;
        count++;
        const i = c % this.nx, j = (c / this.nx) | 0;
        for (let v = 0; v < this.nvar; v++) {
          const meanIdx = v * this.varStride + c;
          let sx = 0, sy = 0;
          if (mode === 'minmod') {
            const mC = U[meanIdx];
            // Solid/domain-edge neighbours fall back to the own mean, which
            // makes minmod return 0 there: slopes flatten at walls.
            const mL = i > 0 && !this.solid[c - 1] ? U[meanIdx - 1] : mC;
            const mR = i < this.nx - 1 && !this.solid[c + 1] ? U[meanIdx + 1] : mC;
            const mB = j > 0 && !this.solid[c - this.nx] ? U[meanIdx - this.nx] : mC;
            const mT = j < this.ny - 1 && !this.solid[c + this.nx] ? U[meanIdx + this.nx] : mC;
            sx = minmod3(U[(v * this.nm + np) * this.nCells + c], mR - mC, mC - mL);
            sy = minmod3(U[(v * this.nm + 1) * this.nCells + c], mT - mC, mC - mB);
          }
          for (let m = 1; m < this.nm; m++) U[(v * this.nm + m) * this.nCells + c] = 0;
          if (this.nm > 1) U[(v * this.nm + 1) * this.nCells + c] = sy;
          if (np > 1) U[(v * this.nm + np) * this.nCells + c] = sx;
        }
      }
      return count;
    }

    limit(U) {
      if (this.limiterMode === 'off') return;
      this.limTC += this.troubledLimiter(U);
      this.limPos += this.positivityLimiter(U);
    }

    maxLambda() {
      const dx = this.params.Lx / this.nx, dy = this.params.Ly / this.ny;
      let lam = 1e-12;
      const mean = this.scratch.mean;
      for (let c = 0; c < this.nCells; c++) {
        if (this.solid[c]) continue;
        this.mean(this.U, c, mean);
        lam = Math.max(lam, (this.equation.maxNormalSpeed(mean, 1, 0, this.params.gamma) / dx) + (this.equation.maxNormalSpeed(mean, 0, 1, this.params.gamma) / dy));
      }
      return (2 * this.p + 1) * lam;
    }

    step(dt) {
      this.limPos = 0;
      this.limTC = 0;
      const U = this.U, A = this.A, B = this.B, R = this.R;
      this.rhs(U, R);
      for (let i = 0; i < U.length; i++) A[i] = U[i] + dt * R[i];
      this.limit(A);
      this.rhs(A, R);
      for (let i = 0; i < U.length; i++) B[i] = 0.75 * U[i] + 0.25 * (A[i] + dt * R[i]);
      this.limit(B);
      this.rhs(B, R);
      for (let i = 0; i < U.length; i++) U[i] = (1 / 3) * U[i] + (2 / 3) * (B[i] + dt * R[i]);
      this.limit(U);
    }

    syncMeanAoS(out) {
      for (let c = 0; c < this.nCells; c++) {
        const b = 4 * c;
        for (let v = 0; v < this.nvar; v++) out[b + v] = this.U[v * this.varStride + c];
      }
    }

    // Evaluates the DG polynomial at k×k uniformly spaced points per cell and
    // writes them AoS into out (nvar values per point, row-major over the
    // nx*k × ny*k fine grid). Solid cells are marked with NaN. This is what
    // makes subcell DG structure visible: P0 reproduces the FV cell-average
    // picture, higher degrees show in-cell variation.
    sampleFieldAoS(out, k) {
      const np = this.basis.np, nm = this.nm, nvar = this.nvar;
      if (!this._sub || this._sub.k !== k || this._sub.np !== np) {
        const tbl = new Float64Array(k * k * nm);
        for (let sy = 0; sy < k; sy++) {
          const eta = -1 + (2 * sy + 1) / k;
          for (let sx = 0; sx < k; sx++) {
            const xi = -1 + (2 * sx + 1) / k;
            const o = (sy * k + sx) * nm;
            for (let a = 0; a < np; a++) {
              const pa = legendre(a, xi);
              for (let b = 0; b < np; b++) tbl[o + a * np + b] = pa * legendre(b, eta);
            }
          }
        }
        this._sub = { k, np, tbl };
      }
      const tbl = this._sub.tbl;
      const FW = this.nx * k;
      const s = this.scratch;
      for (let c = 0; c < this.nCells; c++) {
        const i = c % this.nx, j = (c / this.nx) | 0;
        if (this.solid[c]) {
          for (let sy = 0; sy < k; sy++) {
            const row = (j * k + sy) * FW + i * k;
            for (let sx = 0; sx < k; sx++) {
              const o = nvar * (row + sx);
              for (let v = 0; v < nvar; v++) out[o + v] = NaN;
            }
          }
          continue;
        }
        for (let sy = 0; sy < k; sy++) {
          const row = (j * k + sy) * FW + i * k;
          for (let sx = 0; sx < k; sx++) {
            this.evalAt(this.U, c, tbl, (sy * k + sx) * nm, s.point);
            const o = nvar * (row + sx);
            for (let v = 0; v < nvar; v++) out[o + v] = s.point[v];
          }
        }
      }
    }

    // Pressure force on the embedded body: ∮ p n ds over the stair-step wall
    // faces, with n pointing from fluid into the body. out = [Fx, Fy].
    wallForces(out) {
      const qt = this.eulerQuadratureTables();
      const qn = qt.qn, quad = qt.q;
      const dx = this.params.Lx / this.nx, dy = this.params.Ly / this.ny;
      const gamma = this.params.gamma;
      const eq = this.equation, s = this.scratch, f = this.faces;
      let fx = 0, fy = 0;
      for (let k = 0; k < f.xWallCell.length; k++) {
        const c = f.xWallCell[k], sgn = f.xWallSign[k];
        const coeffs = sgn > 0 ? qt.faceR : qt.faceL;
        for (let q = 0; q < qn; q++) {
          this.evalAt(this.U, c, coeffs, q * this.nm, s.UL);
          fx += sgn * eq.pressureSafe(s.UL, gamma) * 0.5 * dy * quad.w[q];
        }
      }
      for (let k = 0; k < f.yWallCell.length; k++) {
        const c = f.yWallCell[k], sgn = f.yWallSign[k];
        const coeffs = sgn > 0 ? qt.faceT : qt.faceB;
        for (let q = 0; q < qn; q++) {
          this.evalAt(this.U, c, coeffs, q * this.nm, s.UL);
          fy += sgn * eq.pressureSafe(s.UL, gamma) * 0.5 * dx * quad.w[q];
        }
      }
      out[0] = fx;
      out[1] = fy;
    }
  }

  function createMesh(config) {
    const nx = Number(config.nx);
    const ny = Number(config.ny || 1);
    return Object.freeze({
      nx,
      ny,
      dx: Number(config.dx || 1 / nx),
      dy: Number(config.dy || 1 / ny),
      solid: config.solid || null,
      xFaces: config.xFaces || null,
      yFaces: config.yFaces || null,
    });
  }

  function createCase(config) {
    return Object.freeze({
      name: String(config.name),
      equation: config.equation,
      mesh: config.mesh || null,
      initialCondition: config.initialCondition || null,
      boundaryCondition: config.boundaryCondition || null,
      numericalFlux: config.numericalFlux || null,
      displayFields: Object.freeze([...(config.displayFields || [])]),
    });
  }

  const Stepper = Object.freeze({
    euler: 'euler',
    rk2: 'rk2',
    rk3: 'rk3',
  });

  DgEngine = Object.freeze({
    TAU,
    EPS,
    Q,
    EQ,
    clamp,
    wrap01,
    legendre,
    dLegendre,
    minmod3,
    WEDGE_HALF_ANGLE,
    insideShape,
    obliqueShockBeta,
    buildBasis,
    burgersPhysicalFlux,
    burgersFlux,
    advectionNormalFlux,
    idx1,
    cellBase2,
    eval1,
    eval1AtX,
    eval2Ref,
    evalModal,
    eval2AtXY,
    mean2AtXY,
    projectInitial1D,
    projectInitial2D,
    FACE,
    Equations,
    NumericalFlux,
    createEquation,
    createMesh,
    createCase,
    Stepper,
    Euler2D,
    DGSolver2D,
  });
})();

export { DgEngine };
