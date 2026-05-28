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

  window.DgEngine = Object.freeze({
    TAU,
    EPS,
    Q,
    EQ,
    clamp,
    wrap01,
    legendre,
    dLegendre,
    minmod3,
    buildBasis,
    burgersPhysicalFlux,
    burgersFlux,
    advectionNormalFlux,
    idx1,
    cellBase2,
    eval1,
    eval1AtX,
    eval2Ref,
    eval2AtXY,
    mean2AtXY,
    projectInitial1D,
    projectInitial2D,
  });
})();
