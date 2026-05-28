window.FvmEulerCylinderLab = {
  init() {
  'use strict';

  const Engine = window.DgEngine;
  if (!Engine) throw new Error('dg-engine.js must be loaded before fvm.js');
  const {
    TAU,
    EPS,
    Q,
    EQ,
    clamp,
    wrap01,
    legendre: P,
    dLegendre: dP,
    minmod3,
    buildBasis,
    burgersPhysicalFlux,
    burgersFlux,
    advectionNormalFlux,
    idx1: engineIdx1,
    cellBase2: engineCellBase2,
    eval1: engineEval1,
    eval1AtX: engineEval1AtX,
    eval2Ref: engineEval2Ref,
    eval2AtXY: engineEval2AtXY,
    mean2AtXY: engineMean2AtXY,
    projectInitial1D: engineProjectInitial1D,
    projectInitial2D: engineProjectInitial2D,
  } = Engine;

  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d', { alpha: false });
  const mini = document.getElementById('mini');
  const miniCtx = mini.getContext('2d');

  const ui = {
    caseChip: document.getElementById('caseChip'),
    degreeChip: document.getElementById('degreeChip'),
    meshChip: document.getElementById('meshChip'),
    nxChip: document.getElementById('nxChip'),
    nyChip: document.getElementById('nyChip'),
    fluxChip: document.getElementById('fluxChip'),
    alphaChip: document.getElementById('alphaChip'),
    cflChip: document.getElementById('cflChip'),
    spfChip: document.getElementById('spfChip'),
    initChip: document.getElementById('initChip'),
    flowChip: document.getElementById('flowChip'),
    machChip: document.getElementById('machChip'),
    radiusChip: document.getElementById('radiusChip'),
    gammaChip: document.getElementById('gammaChip'),
    limiterChip: document.getElementById('limiterChip'),
    displayChip: document.getElementById('displayChip'),
    runChip: document.getElementById('runChip'),
    okChip: document.getElementById('okChip'),
    fpsChip: document.getElementById('fpsChip'),
    stepChip: document.getElementById('stepChip'),
    timeChip: document.getElementById('timeChip'),
    dtChip: document.getElementById('dtChip'),
    massChip: document.getElementById('massChip'),
    errChip: document.getElementById('errChip'),
    jumpChip: document.getElementById('jumpChip'),
    modeChip: document.getElementById('modeChip'),
    dofChip: document.getElementById('dofChip'),
    hudTitle: document.getElementById('hudTitle'),
    hudText: document.getElementById('hudText'),
    formulaText: document.getElementById('formulaText'),
    helpOverlay: document.getElementById('helpOverlay'),
    nxInput: document.getElementById('nxInput'),
    nyInput: document.getElementById('nyInput'),
    cflInput: document.getElementById('cflInput'),
    spfInput: document.getElementById('spfInput'),
    machInput: document.getElementById('machInput'),
    radiusInput: document.getElementById('radiusInput'),
    gammaInput: document.getElementById('gammaInput'),
    plotSelect: document.getElementById('plotSelect'),
    tip: document.getElementById('tip'),
    tokenEditor: document.getElementById('tokenEditor'),
    tokenEditorTitle: document.getElementById('tokenEditorTitle'),
    tokenEditorEntry: document.getElementById('tokenEditorEntry'),
    tokenEditorItems: document.getElementById('tokenEditorItems'),
    tokenEditorMeta: document.getElementById('tokenEditorMeta'),
  };

  const CASES = ['euler', 'diamond', 'advection', 'burgers'];
  const DEGREES = [0, 1, 2, 3];
  const EULER_DEGREES = [0, 1, 2];
  const ALPHAS = [0, 0.25, 0.5, 1.0, 1.5];
  const ALPHASE = [0.65, 1.0, 1.25, 1.6, 2.0];
  const CFLS = [0.08, 0.14, 0.20, 0.32, 0.48, 0.72, 1.00];
  const FLOWS = ['swirl', 'shear', 'uniform'];
  const INIT2 = ['diamond', 'blob', 'two', 'vortex', 'square'];
  const INIT1 = ['sine', 'riemann', 'bump', 'square'];
  const DISPLAY2 = ['field', 'mean', 'jump', 'modes', 'residual', 'error'];
  const DISPLAY1 = ['field', 'mean', 'jump', 'modes', 'residual', 'history'];
  const DISPLAYE = ['schlieren', 'rho', 'pressure', 'mach', 'speed', 'vorticity', 'solid'];
  const MESH2 = [
    [28, 18], [40, 26], [56, 36], [72, 46], [92, 58],
  ];
  const MESHE = [
    [48, 24], [72, 36], [96, 48], [128, 64], [160, 80],
  ];
  const MESH1 = [96, 160, 240, 360, 520];

  const sim = {
    running: true,
    caseName: 'euler',
    p: 1,
    meshIndex: 1,
    nx: 72,
    ny: 36,
    cfl: 0.35,
    alpha: 1.0,
    flow: 'swirl',
    init: 'blob',
    stab: 'off',
    display: 'schlieren',
    stepsPerFrame: 1,
    gamma: 1.4,
    mach: 1.5,
    cylR: 0.10,
    Lx: 4.0,
    Ly: 2.0,
    cylX: 1.0,
    cylY: 1.0,
    eU: null,
    eA: null,
    eR: null,
    solid: null,
    eFluidCells: null,
    eVFaces: null,
    eVFaceFlags: null,
    eHFaces: null,
    eHFaceFlags: null,
    posFix: 0,
    t: 0,
    dt: 0,
    step: 0,
    U: null,
    A: null,
    B: null,
    R: null,
    lastR: null,
    basis: null,
    bad: false,
    stats: {},
    history: null,
    histW: 512,
    histH: 230,
    histHead: 0,
    particles: [],
    scratch: {
      eFlux: new Float64Array(4),
      eGhost: new Float64Array(4),
      eLeft: new Float64Array(4),
      eRight: new Float64Array(4),
      rhs2: new Float64Array(1),
      miniBins: new Float64Array(1),
      miniCounts: new Float64Array(1),
    },
  };

  let off = document.createElement('canvas');
  let offCtx = off.getContext('2d', { alpha: false });
  let dpr = 1;
  let lastFrame = performance.now();
  let fpsEMA = 60;

  function isEuler() { return sim.caseName === 'euler'; }
  function is1D() { return sim.caseName === 'burgers'; }
  function is2D() { return !is1D(); }
  function isScalar2D() { return !isEuler() && !is1D(); }
  function isConstantAdvection() { return sim.caseName === 'advection' || sim.caseName === 'diamond'; }

  function applyMeshFromIndex() {
    if (sim.meshIndex < 0) {
      if (is1D()) sim.ny = 1;
      return;
    }
    if (isEuler()) {
      const m = MESHE[sim.meshIndex % MESHE.length];
      sim.nx = m[0];
      sim.ny = m[1];
    } else if (is1D()) {
      sim.nx = MESH1[sim.meshIndex % MESH1.length];
      sim.ny = 1;
    } else {
      const m = MESH2[sim.meshIndex % MESH2.length];
      sim.nx = m[0];
      sim.ny = m[1];
    }
  }

  function coeffCount() {
    if (isEuler()) return sim.nx * sim.ny * sim.basis.nm2 * 4;
    const np = sim.p + 1;
    return is1D() ? sim.nx * np : sim.nx * sim.ny * np * np;
  }

  function idx1(i, m) {
    return engineIdx1(sim, i, m);
  }

  function idx2(i, j, a, b) {
    const np = sim.basis.np;
    return ((j * sim.nx + i) * np + a) * np + b;
  }

  function cellBase2(i, j) {
    return engineCellBase2(sim, i, j);
  }

  function eval1(U, i, xi) {
    return engineEval1(sim, U, i, xi);
  }

  function eval1AtX(U, x) {
    return engineEval1AtX(sim, U, x);
  }

  function eval2Ref(U, base, xi, eta) {
    return engineEval2Ref(sim, U, base, xi, eta);
  }

  function eval2AtXY(U, x, y) {
    return engineEval2AtXY(sim, U, x, y);
  }

  function mean2AtXY(U, x, y) {
    return engineMean2AtXY(sim, U, x, y);
  }

  function fluxBurgers(um, up) {
    return burgersFlux(um, up, sim.alpha);
  }

  function fluxB(u) {
    return burgersPhysicalFlux(u);
  }

  function fluxAdvectionNormal(s, um, up) {
    return advectionNormalFlux(s, um, up, sim.alpha);
  }

  function velocity(x, y) {
    if (isConstantAdvection()) {
      return [1.0, 0.38];
    }
    if (sim.flow === 'uniform') return [1.0, 0.38];
    if (sim.flow === 'shear') return [1.0, 0.52 * Math.sin(TAU * x)];
    // Periodic, divergence-free toy field: div(sin(2πy), sin(2πx)) = 0.
    return [Math.sin(TAU * y), Math.sin(TAU * x)];
  }

  function maxVelocity() {
    if (isConstantAdvection() || sim.flow === 'uniform') return Math.hypot(1.0, 0.38);
    if (sim.flow === 'shear') return Math.hypot(1.0, 0.52);
    return Math.SQRT2;
  }

  function periodicDelta(x, c) {
    let d = x - c;
    d -= Math.round(d);
    return d;
  }

  function init2D(x, y) {
    if (sim.init === 'diamond') {
      const d = Math.abs(periodicDelta(x, 0.50)) + Math.abs(periodicDelta(y, 0.50));
      return d < 0.24 ? 1.0 : 0.0;
    }
    if (sim.init === 'two') {
      const r1 = periodicDelta(x, 0.32) ** 2 + periodicDelta(y, 0.52) ** 2;
      const r2 = periodicDelta(x, 0.72) ** 2 + periodicDelta(y, 0.32) ** 2;
      return Math.exp(-90 * r1) - 0.65 * Math.exp(-130 * r2);
    }
    if (sim.init === 'vortex') {
      const r = Math.hypot(periodicDelta(x, 0.5), periodicDelta(y, 0.5));
      return Math.sin(7 * TAU * r) * Math.exp(-24 * r * r);
    }
    if (sim.init === 'square') {
      const dx = Math.abs(periodicDelta(x, 0.50));
      const dy = Math.abs(periodicDelta(y, 0.50));
      return dx < 0.16 && dy < 0.16 ? 1 : 0;
    }
    const r = periodicDelta(x, 0.35) ** 2 + periodicDelta(y, 0.48) ** 2;
    return Math.exp(-85 * r);
  }

  function init1D(x) {
    if (sim.init === 'riemann') {
      return x > 0.16 && x < 0.56 ? 1.0 : -0.25;
    }
    if (sim.init === 'bump') {
      return 0.12 + 0.9 * Math.exp(-160 * periodicDelta(x, 0.35) ** 2);
    }
    if (sim.init === 'square') {
      return x > 0.25 && x < 0.55 ? 1.0 : 0.0;
    }
    return 0.45 + 0.42 * Math.sin(TAU * x);
  }

  function exact2D(x, y) {
    // Only for constant-velocity periodic advection.
    return init2D(wrap01(x - 1.0 * sim.t), wrap01(y - 0.38 * sim.t));
  }

  function projectInitial1D() {
    engineProjectInitial1D(sim, sim.U, init1D);
  }

  function projectInitial2D() {
    engineProjectInitial2D(sim, sim.U, init2D);
  }

  // ---------------------------------------------------------------------------
  // Compressible Euler cylinder case. Modal tensor-product DG for conservative
  // coefficients; P0 is the finite-volume limit of the same weak form. It solves
  //   ∂t U + ∂x F(U) + ∂y G(U) = 0,
  //   U=(ρ,ρu,ρv,E), p=(γ-1)(E-ρ(u²+v²)/2),
  // with local Lax-Friedrichs/Rusanov numerical fluxes.

  function eCell(i, j) { return j * sim.nx + i; }
  function eBase(i, j) { return 4 * (eCell(i, j) * sim.basis.nm2); }
  function eModeBase(i, j, mode) { return 4 * (eCell(i, j) * sim.basis.nm2 + mode); }

  function eFarVars() {
    const g = sim.gamma;
    const rho = 1.0;
    const p = 1.0 / g;       // c = sqrt(g p / rho) = 1, so u∞ = M∞.
    const u = sim.mach;
    const v = 0.0;
    const E = p / (g - 1) + 0.5 * rho * (u * u + v * v);
    return [rho, rho * u, rho * v, E];
  }

  function ePrimitive(U, base) {
    const g = sim.gamma;
    const rho = Math.max(1e-9, U[base]);
    const u = U[base + 1] / rho;
    const v = U[base + 2] / rho;
    let p = (g - 1) * (U[base + 3] - 0.5 * rho * (u * u + v * v));
    if (!Number.isFinite(p)) p = 1e-8;
    p = Math.max(1e-8, p);
    const c = Math.sqrt(g * p / rho);
    return [rho, u, v, p, c];
  }

  function eEvalState(U, i, j, xi, eta, out) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    const np = sim.basis.np;
    for (let a = 0; a < np; a++) {
      const pa = P(a, xi);
      for (let b = 0; b < np; b++) {
        const pb = P(b, eta);
        const w = pa * pb;
        const k = eModeBase(i, j, a * np + b);
        out[0] += U[k] * w;
        out[1] += U[k + 1] * w;
        out[2] += U[k + 2] * w;
        out[3] += U[k + 3] * w;
      }
    }
  }

  function eEvalModal(U, base, coeffs, coeffOffset, out) {
    const nm2 = sim.basis.nm2;
    if (nm2 === 1) {
      out[0] = U[base];
      out[1] = U[base + 1];
      out[2] = U[base + 2];
      out[3] = U[base + 3];
      return;
    }
    if (nm2 === 4) {
      const c0 = coeffs[coeffOffset], c1 = coeffs[coeffOffset + 1];
      const c2 = coeffs[coeffOffset + 2], c3 = coeffs[coeffOffset + 3];
      const b1 = base + 4, b2 = base + 8, b3 = base + 12;
      out[0] = U[base] * c0 + U[b1] * c1 + U[b2] * c2 + U[b3] * c3;
      out[1] = U[base + 1] * c0 + U[b1 + 1] * c1 + U[b2 + 1] * c2 + U[b3 + 1] * c3;
      out[2] = U[base + 2] * c0 + U[b1 + 2] * c1 + U[b2 + 2] * c2 + U[b3 + 2] * c3;
      out[3] = U[base + 3] * c0 + U[b1 + 3] * c1 + U[b2 + 3] * c2 + U[b3 + 3] * c3;
      return;
    }
    let r = 0, ru = 0, rv = 0, E = 0;
    for (let mode = 0; mode < nm2; mode++) {
      const c = coeffs[coeffOffset + mode];
      const k = base + 4 * mode;
      r += U[k] * c;
      ru += U[k + 1] * c;
      rv += U[k + 2] * c;
      E += U[k + 3] * c;
    }
    out[0] = r;
    out[1] = ru;
    out[2] = rv;
    out[3] = E;
  }

  function ePressureVars(r, ru, rv, E) {
    const g = sim.gamma;
    const rho = Math.max(1e-12, r);
    const u = ru / rho, v = rv / rho;
    return Math.max(1e-10, (g - 1) * (E - 0.5 * rho * (u * u + v * v)));
  }

  function eFluxX(rL, ruL, rvL, EL, rR, ruR, rvR, ER, out) {
    const g = sim.gamma;
    const rhoL = Math.max(1e-12, rL), rhoR = Math.max(1e-12, rR);
    const uL = ruL / rhoL, vL = rvL / rhoL;
    const uR = ruR / rhoR, vR = rvR / rhoR;
    const pL = Math.max(1e-10, (g - 1) * (EL - 0.5 * rhoL * (uL * uL + vL * vL)));
    const pR = Math.max(1e-10, (g - 1) * (ER - 0.5 * rhoR * (uR * uR + vR * vR)));
    const cL = Math.sqrt(g * pL / rhoL), cR = Math.sqrt(g * pR / rhoR);
    const a = sim.alpha * Math.max(Math.abs(uL) + cL, Math.abs(uR) + cR);
    const FL0 = ruL;
    const FL1 = ruL * uL + pL;
    const FL2 = ruL * vL;
    const FL3 = (EL + pL) * uL;
    const FR0 = ruR;
    const FR1 = ruR * uR + pR;
    const FR2 = ruR * vR;
    const FR3 = (ER + pR) * uR;
    out[0] = 0.5 * (FL0 + FR0) - 0.5 * a * (rR - rL);
    out[1] = 0.5 * (FL1 + FR1) - 0.5 * a * (ruR - ruL);
    out[2] = 0.5 * (FL2 + FR2) - 0.5 * a * (rvR - rvL);
    out[3] = 0.5 * (FL3 + FR3) - 0.5 * a * (ER - EL);
  }

  function eFluxY(rL, ruL, rvL, EL, rR, ruR, rvR, ER, out) {
    const g = sim.gamma;
    const rhoL = Math.max(1e-12, rL), rhoR = Math.max(1e-12, rR);
    const uL = ruL / rhoL, vL = rvL / rhoL;
    const uR = ruR / rhoR, vR = rvR / rhoR;
    const pL = Math.max(1e-10, (g - 1) * (EL - 0.5 * rhoL * (uL * uL + vL * vL)));
    const pR = Math.max(1e-10, (g - 1) * (ER - 0.5 * rhoR * (uR * uR + vR * vR)));
    const cL = Math.sqrt(g * pL / rhoL), cR = Math.sqrt(g * pR / rhoR);
    const a = sim.alpha * Math.max(Math.abs(vL) + cL, Math.abs(vR) + cR);
    const GL0 = rvL;
    const GL1 = rvL * uL;
    const GL2 = rvL * vL + pL;
    const GL3 = (EL + pL) * vL;
    const GR0 = rvR;
    const GR1 = rvR * uR;
    const GR2 = rvR * vR + pR;
    const GR3 = (ER + pR) * vR;
    out[0] = 0.5 * (GL0 + GR0) - 0.5 * a * (rR - rL);
    out[1] = 0.5 * (GL1 + GR1) - 0.5 * a * (ruR - ruL);
    out[2] = 0.5 * (GL2 + GR2) - 0.5 * a * (rvR - rvL);
    out[3] = 0.5 * (GL3 + GR3) - 0.5 * a * (ER - EL);
  }

  function eReflectVars(r, ru, rv, E, x, y, out) {
    const rho = Math.max(1e-12, r);
    const u = ru / rho, v = rv / rho;
    let nx = x - sim.cylX;
    let ny = y - sim.cylY;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const un = u * nx + v * ny;
    const ug = u - 2 * un * nx;
    const vg = v - 2 * un * ny;
    out[0] = rho;
    out[1] = rho * ug;
    out[2] = rho * vg;
    out[3] = E;
  }

  function eSolidAt(i, j) {
    if (i < 0 || i >= sim.nx || j < 0 || j >= sim.ny) return 0;
    return sim.solid[eCell(i, j)];
  }

  function initEuler() {
    const n = sim.nx * sim.ny;
    const nm2 = sim.basis.nm2;
    sim.eU = new Float64Array(4 * n * nm2);
    sim.eA = new Float64Array(4 * n * nm2);
    sim.eR = new Float64Array(4 * n * nm2);
    sim.solid = new Uint8Array(n);
    const fluid = [];
    const far = eFarVars();
    const dx = sim.Lx / sim.nx, dy = sim.Ly / sim.ny;
    for (let j = 0; j < sim.ny; j++) {
      const y = (j + 0.5) * dy;
      for (let i = 0; i < sim.nx; i++) {
        const x = (i + 0.5) * dx;
        const c = eCell(i, j);
        const b = 4 * c * nm2;
        const inside = Math.hypot(x - sim.cylX, y - sim.cylY) < sim.cylR;
        sim.solid[c] = inside ? 1 : 0;
        sim.eU[b] = far[0];
        sim.eU[b + 1] = inside ? 0 : far[1];
        sim.eU[b + 2] = 0;
        sim.eU[b + 3] = far[3];
        if (!inside) fluid.push(c);
      }
    }
    sim.eFluidCells = Int32Array.from(fluid);
    const vFaces = [];
    const vFlags = [];
    const vLeftBase = [];
    const vRightBase = [];
    const vX = [];
    const vY = [];
    for (let j = 0; j < sim.ny; j++) {
      for (let i = 0; i <= sim.nx; i++) {
        const hasL = i > 0 && !eSolidAt(i - 1, j);
        const hasR = i < sim.nx && !eSolidAt(i, j);
        if (hasL || hasR) {
          vFaces.push(j * (sim.nx + 1) + i);
          vFlags.push((hasL ? 1 : 0) | (hasR ? 2 : 0));
          vLeftBase.push(i > 0 ? eBase(i - 1, j) : -1);
          vRightBase.push(i < sim.nx ? eBase(i, j) : -1);
          vX.push(i * dx);
          vY.push((j + 0.5) * dy);
        }
      }
    }
    const hFaces = [];
    const hFlags = [];
    const hBottomBase = [];
    const hTopBase = [];
    const hX = [];
    const hY = [];
    for (let j = 0; j <= sim.ny; j++) {
      for (let i = 0; i < sim.nx; i++) {
        const hasB = j > 0 && !eSolidAt(i, j - 1);
        const hasT = j < sim.ny && !eSolidAt(i, j);
        if (hasB || hasT) {
          hFaces.push(j * sim.nx + i);
          hFlags.push((hasB ? 1 : 0) | (hasT ? 2 : 0));
          hBottomBase.push(j > 0 ? eBase(i, j - 1) : -1);
          hTopBase.push(j < sim.ny ? eBase(i, j) : -1);
          hX.push((i + 0.5) * dx);
          hY.push(j * dy);
        }
      }
    }
    sim.eVFaces = Int32Array.from(vFaces);
    sim.eVFaceFlags = Uint8Array.from(vFlags);
    sim.eVLeftBase = Int32Array.from(vLeftBase);
    sim.eVRightBase = Int32Array.from(vRightBase);
    sim.eVX = Float64Array.from(vX);
    sim.eVY = Float64Array.from(vY);
    sim.eHFaces = Int32Array.from(hFaces);
    sim.eHFaceFlags = Uint8Array.from(hFlags);
    sim.eHBottomBase = Int32Array.from(hBottomBase);
    sim.eHTopBase = Int32Array.from(hTopBase);
    sim.eHX = Float64Array.from(hX);
    sim.eHY = Float64Array.from(hY);
    sim.t = 0;
    sim.dt = 0;
    sim.step = 0;
    sim.bad = false;
    sim.posFix = 0;
  }

  function eulerMaxLambda(U) {
    const g = sim.gamma;
    const dx = sim.Lx / sim.nx, dy = sim.Ly / sim.ny;
    let lam = 1e-12;
    const fluidCells = sim.eFluidCells || [];
    const stride = 4 * sim.basis.nm2;
    for (let ci = 0; ci < fluidCells.length; ci++) {
        const b = fluidCells[ci] * stride;
        const rho = Math.max(1e-12, U[b]);
        const u = U[b + 1] / rho, v = U[b + 2] / rho;
        const p = Math.max(1e-10, (g - 1) * (U[b + 3] - 0.5 * rho * (u * u + v * v)));
        const c = Math.sqrt(g * p / rho);
        lam = Math.max(lam, (Math.abs(u) + c) / dx + (Math.abs(v) + c) / dy);
    }
    return lam;
  }

  function computeEulerDt() {
    sim.dt = sim.cfl / ((2 * sim.p + 1) * eulerMaxLambda(sim.eU));
    sim.dt = Math.min(sim.dt, 0.02);
    return sim.dt;
  }

  function eulerRHS(U, R) {
    const nx = sim.nx, ny = sim.ny;
    const dx = sim.Lx / nx, dy = sim.Ly / ny;
    const far = eFarVars();
    const f = sim.scratch.eFlux;
    const gstate = sim.scratch.eGhost;
    const left = sim.scratch.eLeft;
    const right = sim.scratch.eRight;
    const {
      np, nm2, eVolPhi, eVolDxi, eVolDeta, eVolW,
      eInvMassUnit, eFaceL, eFaceR, eFaceB, eFaceT,
    } = sim.basis;
    const qn = EQ.x.length;
    R.fill(0);

    if (np > 1) {
      const fluidCells = sim.eFluidCells || [];
      for (let ci = 0; ci < fluidCells.length; ci++) {
        const cellBase = fluidCells[ci] * 4 * nm2;
          for (let q = 0; q < eVolW.length; q++) {
            const qo = q * nm2;
            const w = eVolW[q];
            eEvalModal(U, cellBase, eVolPhi, qo, left);
            eFluxX(left[0], left[1], left[2], left[3], left[0], left[1], left[2], left[3], f);
            eFluxY(left[0], left[1], left[2], left[3], left[0], left[1], left[2], left[3], gstate);
            for (let mode = 0; mode < nm2; mode++) {
              const rb = cellBase + 4 * mode;
              const wx = 0.5 * dy * w * eVolDxi[qo + mode];
              const wy = 0.5 * dx * w * eVolDeta[qo + mode];
              R[rb] += wx * f[0] + wy * gstate[0];
              R[rb + 1] += wx * f[1] + wy * gstate[1];
              R[rb + 2] += wx * f[2] + wy * gstate[2];
              R[rb + 3] += wx * f[3] + wy * gstate[3];
            }
          }
      }
    }

    const vFaces = sim.eVFaces || [];
    const vFaceFlags = sim.eVFaceFlags || [];
    const vLeftBase = sim.eVLeftBase || [];
    const vRightBase = sim.eVRightBase || [];
    const vX = sim.eVX || [];
    const vY = sim.eVY || [];
    for (let fi = 0; fi < vFaces.length; fi++) {
      const flags = vFaceFlags[fi];
      const hasL = (flags & 1) !== 0;
      const hasR = (flags & 2) !== 0;
      const leftBase = vLeftBase[fi];
      const rightBase = vRightBase[fi];
      const xFace = vX[fi];
      const y = vY[fi];
      for (let q = 0; q < qn; q++) {
          const qo = q * nm2;
          if (hasL) eEvalModal(U, leftBase, eFaceR, qo, left);
          else if (leftBase < 0) left.set(far);
          else {
            eEvalModal(U, rightBase, eFaceL, qo, right);
            eReflectVars(right[0], right[1], right[2], right[3], xFace, y, left);
          }
          if (hasR) eEvalModal(U, rightBase, eFaceL, qo, right);
          else if (rightBase < 0) right.set(left);
          else {
            eEvalModal(U, leftBase, eFaceR, qo, left);
            eReflectVars(left[0], left[1], left[2], left[3], xFace, y, right);
          }
          eFluxX(left[0], left[1], left[2], left[3], right[0], right[1], right[2], right[3], f);
          const s = 0.5 * dy * EQ.w[q];
          if (hasL) {
            for (let mode = 0; mode < nm2; mode++) {
              const fac = s * eFaceR[qo + mode];
              const rb = leftBase + 4 * mode;
              R[rb] -= fac * f[0];
              R[rb + 1] -= fac * f[1];
              R[rb + 2] -= fac * f[2];
              R[rb + 3] -= fac * f[3];
            }
          }
          if (hasR) {
            for (let mode = 0; mode < nm2; mode++) {
              const fac = s * eFaceL[qo + mode];
              const rb = rightBase + 4 * mode;
              R[rb] += fac * f[0];
              R[rb + 1] += fac * f[1];
              R[rb + 2] += fac * f[2];
              R[rb + 3] += fac * f[3];
            }
          }
      }
    }

    const hFaces = sim.eHFaces || [];
    const hFaceFlags = sim.eHFaceFlags || [];
    const hBottomBase = sim.eHBottomBase || [];
    const hTopBase = sim.eHTopBase || [];
    const hX = sim.eHX || [];
    const hY = sim.eHY || [];
    for (let fi = 0; fi < hFaces.length; fi++) {
      const flags = hFaceFlags[fi];
      const hasB = (flags & 1) !== 0;
      const hasT = (flags & 2) !== 0;
      const bottomBase = hBottomBase[fi];
      const topBase = hTopBase[fi];
      const x = hX[fi];
      const yFace = hY[fi];
      for (let q = 0; q < qn; q++) {
          const qo = q * nm2;
          if (hasB) eEvalModal(U, bottomBase, eFaceT, qo, left);
          else if (bottomBase < 0) left.set(far);
          else {
            eEvalModal(U, topBase, eFaceB, qo, right);
            eReflectVars(right[0], right[1], right[2], right[3], x, yFace, left);
          }
          if (hasT) eEvalModal(U, topBase, eFaceB, qo, right);
          else if (topBase < 0) right.set(far);
          else {
            eEvalModal(U, bottomBase, eFaceT, qo, left);
            eReflectVars(left[0], left[1], left[2], left[3], x, yFace, right);
          }
          eFluxY(left[0], left[1], left[2], left[3], right[0], right[1], right[2], right[3], f);
          const s = 0.5 * dx * EQ.w[q];
          if (hasB) {
            for (let mode = 0; mode < nm2; mode++) {
              const fac = s * eFaceT[qo + mode];
              const rb = bottomBase + 4 * mode;
              R[rb] -= fac * f[0];
              R[rb + 1] -= fac * f[1];
              R[rb + 2] -= fac * f[2];
              R[rb + 3] -= fac * f[3];
            }
          }
          if (hasT) {
            for (let mode = 0; mode < nm2; mode++) {
              const fac = s * eFaceB[qo + mode];
              const rb = topBase + 4 * mode;
              R[rb] += fac * f[0];
              R[rb + 1] += fac * f[1];
              R[rb + 2] += fac * f[2];
              R[rb + 3] += fac * f[3];
            }
          }
      }
    }

    const fluidCells = sim.eFluidCells || [];
    const invCellMass = 1 / (dx * dy);
    for (let ci = 0; ci < fluidCells.length; ci++) {
      const cellBase = fluidCells[ci] * 4 * nm2;
      for (let a = 0; a < np; a++) {
        for (let b = 0; b < np; b++) {
          const mode = a * np + b;
          const fac = eInvMassUnit[mode] * invCellMass;
          const rb = cellBase + 4 * mode;
          R[rb] *= fac;
          R[rb + 1] *= fac;
          R[rb + 2] *= fac;
          R[rb + 3] *= fac;
        }
      }
    }
  }

  function eulerPositivityFix(U) {
    const g = sim.gamma;
    const far = eFarVars();
    const { nm2, eVolPhi } = sim.basis;
    const probe = sim.scratch.eLeft;
    let fixes = 0;
    const fluidCells = sim.eFluidCells || [];
    for (let ci = 0; ci < fluidCells.length; ci++) {
        const base = fluidCells[ci] * 4 * nm2;
        let rho = U[base];
        if (!Number.isFinite(rho) || rho < 1e-6) {
          U[base] = far[0]; U[base + 1] = far[1]; U[base + 2] = 0; U[base + 3] = far[3];
          for (let mode = 1; mode < nm2; mode++) {
            const mb = base + 4 * mode;
            U[mb] = 0; U[mb + 1] = 0; U[mb + 2] = 0; U[mb + 3] = 0;
          }
          fixes++; continue;
        }
        const u = U[base + 1] / rho;
        const v = U[base + 2] / rho;
        let p = (g - 1) * (U[base + 3] - 0.5 * rho * (u * u + v * v));
        if (!Number.isFinite(p) || p < 1e-7) {
          p = 1e-7;
          U[base + 3] = p / (g - 1) + 0.5 * rho * (u * u + v * v);
          fixes++;
        }
        let troubled = false;
        if (nm2 > 1) {
          for (let q = 0; q < EQ.x.length * EQ.x.length; q++) {
              eEvalModal(U, base, eVolPhi, q * nm2, probe);
              const rr = probe[0];
              const uu = probe[1] / Math.max(1e-12, rr);
              const vv = probe[2] / Math.max(1e-12, rr);
              const pp = (g - 1) * (probe[3] - 0.5 * rr * (uu * uu + vv * vv));
              if (!(rr > 1e-7) || !(pp > 1e-7) || !Number.isFinite(pp)) {
                troubled = true;
                break;
              }
          }
        }
        if (troubled) {
          for (let mode = 1; mode < nm2; mode++) {
            const mb = base + 4 * mode;
            U[mb] = 0; U[mb + 1] = 0; U[mb + 2] = 0; U[mb + 3] = 0;
          }
          fixes++;
        }
    }
    sim.posFix += fixes;
  }

  function eulerStep() {
    if (sim.bad) return;
    const U = sim.eU, A = sim.eA, R = sim.eR;
    const dt = computeEulerDt();
    eulerRHS(U, R);
    for (let k = 0; k < U.length; k++) A[k] = U[k] + dt * R[k];
    eulerPositivityFix(A);
    eulerRHS(A, R);
    for (let k = 0; k < U.length; k++) U[k] = 0.5 * U[k] + 0.5 * (A[k] + dt * R[k]);
    eulerPositivityFix(U);
    sim.t += dt;
    sim.step += 1;
    checkEulerFinite();
  }

  function checkEulerFinite() {
    let bad = false;
    for (let k = 0; k < sim.eU.length; k++) {
      const v = sim.eU[k];
      if (!Number.isFinite(v) || Math.abs(v) > 1e7) { bad = true; break; }
    }
    if (bad) { sim.bad = true; sim.running = false; }
  }

  function computeEulerStats() {
    const U = sim.eU;
    if (!U) return {};
    const g = sim.gamma;
    const dx = sim.Lx / sim.nx, dy = sim.Ly / sim.ny;
    let mass = 0, minR = Infinity, maxR = -Infinity, minP = Infinity, maxP = -Infinity, maxM = 0, fluid = 0;
    let grad = 0, gradN = 0;
    const fluidCells = sim.eFluidCells || [];
    const stride = 4 * sim.basis.nm2;
    for (let ci = 0; ci < fluidCells.length; ci++) {
        const cidx = fluidCells[ci];
        const i = cidx % sim.nx;
        const j = (cidx / sim.nx) | 0;
        const b = cidx * stride;
        const rho = Math.max(1e-12, U[b]);
        const u = U[b + 1] / rho;
        const v = U[b + 2] / rho;
        const p = Math.max(1e-10, (g - 1) * (U[b + 3] - 0.5 * rho * (u * u + v * v)));
        const c = Math.sqrt(g * p / rho);
        mass += rho * dx * dy;
        minR = Math.min(minR, rho); maxR = Math.max(maxR, rho);
        minP = Math.min(minP, p); maxP = Math.max(maxP, p);
        maxM = Math.max(maxM, Math.hypot(u, v) / c);
        fluid++;
        const ir = Math.min(sim.nx - 1, i + 1), il = Math.max(0, i - 1);
        const jt = Math.min(sim.ny - 1, j + 1), jb = Math.max(0, j - 1);
        if (!eSolidAt(ir, j) && !eSolidAt(il, j) && !eSolidAt(i, jt) && !eSolidAt(i, jb)) {
          const gx = (U[eBase(ir, j)] - U[eBase(il, j)]) / (Math.max(1, ir - il) * dx);
          const gy = (U[eBase(i, jt)] - U[eBase(i, jb)]) / (Math.max(1, jt - jb) * dy);
          grad += gx * gx + gy * gy; gradN++;
        }
    }
    sim.rhoMin = minR; sim.rhoMax = maxR; sim.pMin = minP; sim.pMax = maxP; sim.machMax = maxM;
    return {
      mass,
      l2: Math.sqrt(Math.max(0, grad / Math.max(1, gradN))),
      mode: 0,
      jump: Math.sqrt(Math.max(0, grad / Math.max(1, gradN))),
      residual: 0,
      maxAbs: maxM,
      error: NaN,
      dof: fluid * sim.basis.nm2 * 4,
      rhoMin: minR, rhoMax: maxR, pMin: minP, pMax: maxP, machMax: maxM,
    };
  }

  function eVelocityAt(i, j, comp, fallback) {
    if (i < 0) i = 0; if (i >= sim.nx) i = sim.nx - 1;
    if (j < 0) j = 0; if (j >= sim.ny) j = sim.ny - 1;
    if (eSolidAt(i, j)) return fallback;
    const b = eBase(i, j);
    const rho = Math.max(1e-12, sim.eU[b]);
    return comp === 0 ? sim.eU[b + 1] / rho : sim.eU[b + 2] / rho;
  }

  function eSampleCell(i, j) {
    if (i < 0) i = 0; if (i >= sim.nx) i = sim.nx - 1;
    if (j < 0) j = 0; if (j >= sim.ny) j = sim.ny - 1;
    if (sim.display === 'solid') return eSolidAt(i, j) ? 1 : 0;
    if (eSolidAt(i, j)) return NaN;
    const U = sim.eU;
    const g = sim.gamma;
    const b = eBase(i, j);
    const rho = Math.max(1e-12, U[b]);
    const u = U[b + 1] / rho;
    const v = U[b + 2] / rho;
    const p = Math.max(1e-10, (g - 1) * (U[b + 3] - 0.5 * rho * (u * u + v * v)));
    const c = Math.sqrt(g * p / rho);
    if (sim.display === 'rho') return rho;
    if (sim.display === 'pressure') return p;
    if (sim.display === 'mach') return Math.hypot(u, v) / c;
    if (sim.display === 'speed') return Math.hypot(u, v);
    if (sim.display === 'vorticity') {
      const il = Math.max(0, i - 1), ir = Math.min(sim.nx - 1, i + 1);
      const jb = Math.max(0, j - 1), jt = Math.min(sim.ny - 1, j + 1);
      const dx = sim.Lx / sim.nx, dy = sim.Ly / sim.ny;
      const vR = eVelocityAt(ir, j, 1, v);
      const vL = eVelocityAt(il, j, 1, v);
      const uT = eVelocityAt(i, jt, 0, u);
      const uB = eVelocityAt(i, jb, 0, u);
      return (vR - vL) / (Math.max(1, ir - il) * dx) - (uT - uB) / (Math.max(1, jt - jb) * dy);
    }
    // Schlieren-like density-gradient diagnostic.
    const il = Math.max(0, i - 1), ir = Math.min(sim.nx - 1, i + 1);
    const jb = Math.max(0, j - 1), jt = Math.min(sim.ny - 1, j + 1);
    const dx = sim.Lx / sim.nx, dy = sim.Ly / sim.ny;
    const rR = eSolidAt(ir, j) ? rho : U[eBase(ir, j)];
    const rL = eSolidAt(il, j) ? rho : U[eBase(il, j)];
    const rT = eSolidAt(i, jt) ? rho : U[eBase(i, jt)];
    const rB = eSolidAt(i, jb) ? rho : U[eBase(i, jb)];
    const gr = Math.hypot((rR - rL) / (Math.max(1, ir - il) * dx), (rT - rB) / (Math.max(1, jt - jb) * dy));
    return gr / (rho + 1e-6);
  }

  function eulerColor(v) {
    if (!Number.isFinite(v)) return [0, 2, 0];
    let t = 0;
    if (sim.display === 'rho') t = (v - (sim.rhoMin || 0.3)) / (((sim.rhoMax || 2) - (sim.rhoMin || 0.3)) + 1e-9);
    else if (sim.display === 'pressure') t = (v - (sim.pMin || 0.1)) / (((sim.pMax || 2) - (sim.pMin || 0.1)) + 1e-9);
    else if (sim.display === 'mach') t = v / Math.max(2.0, sim.machMax || 2.0);
    else if (sim.display === 'speed') t = v / Math.max(1.5, sim.mach + 0.8);
    else if (sim.display === 'vorticity') t = 0.5 + 0.5 * Math.tanh(0.12 * v);
    else if (sim.display === 'solid') t = v;
    else t = 1 - Math.exp(-8.0 * Math.abs(v));
    t = clamp(t, 0, 1);
    const r = Math.round(2 + 24 * t + 150 * Math.max(0, t - 0.82));
    const g = Math.round(8 + 75 * Math.sqrt(t) + 170 * t);
    const b = Math.round(4 + 26 * t + 26 * Math.max(0, t - 0.72));
    return [r, g, b];
  }

  function drawEuler() {
    const W = canvas.width, H = canvas.height;
    const rw = Math.min(sim.nx, 360);
    const rh = Math.min(sim.ny, 180);
    if (off.width !== rw || off.height !== rh) { off.width = rw; off.height = rh; }
    const img = offCtx.createImageData(rw, rh);
    const data = img.data;
    for (let py = 0; py < rh; py++) {
      const j = Math.min(sim.ny - 1, Math.floor((1 - py / Math.max(1, rh - 1)) * sim.ny));
      for (let px = 0; px < rw; px++) {
        const i = Math.min(sim.nx - 1, Math.floor(px / Math.max(1, rw - 1) * sim.nx));
        const c = eulerColor(eSampleCell(i, j));
        const k = 4 * (py * rw + px);
        data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W, H);
    drawEulerGridAndCylinder(W, H);
  }

  function drawEulerGridAndCylinder(W, H) {
    ctx.save();
    if (sim.nx <= 360) {
      ctx.lineWidth = Math.max(1, dpr * 0.45);
      ctx.strokeStyle = 'rgba(145,255,181,.10)';
      const sx = Math.max(1, Math.ceil(sim.nx / 160));
      const sy = Math.max(1, Math.ceil(sim.ny / 100));
      ctx.beginPath();
      for (let i = 0; i <= sim.nx; i += sx) { const x = W * i / sim.nx; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let j = 0; j <= sim.ny; j += sy) { const y = H * j / sim.ny; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    const cx = W * sim.cylX / sim.Lx;
    const cy = H * (1 - sim.cylY / sim.Ly);
    const rx = W * sim.cylR / sim.Lx;
    const ry = H * sim.cylR / sim.Ly;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,8,2,.95)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 1.5 * dpr);
    ctx.strokeStyle = 'rgba(166,255,122,.75)';
    ctx.stroke();
    // Freestream arrow.
    ctx.strokeStyle = 'rgba(166,255,122,.45)';
    ctx.fillStyle = 'rgba(166,255,122,.55)';
    ctx.lineWidth = 1.4 * dpr;
    const y = cy - 1.35 * ry;
    ctx.beginPath(); ctx.moveTo(0.07 * W, y); ctx.lineTo(0.19 * W, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.19 * W, y); ctx.lineTo(0.175 * W, y - 5 * dpr); ctx.lineTo(0.175 * W, y + 5 * dpr); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawMiniEuler(W, H) {
    const st = sim.stats || {};
    const vals = [
      ['ρ', st.rhoMax || 1],
      ['p', st.pMax || 1],
      ['M', st.machMax || 0],
      ['∇ρ', st.jump || 0],
    ];
    let maxv = 1e-12;
    for (const v of vals) maxv = Math.max(maxv, Math.abs(v[1]));
    const bw = W / vals.length;
    miniCtx.font = `${10 * dpr}px ui-monospace`;
    miniCtx.textAlign = 'center';
    for (let k = 0; k < vals.length; k++) {
      const h = H * 0.75 * Math.sqrt(Math.abs(vals[k][1]) / maxv);
      miniCtx.fillStyle = 'rgba(166,255,122,.78)';
      miniCtx.fillRect(k * bw + 6 * dpr, H - h - 16 * dpr, Math.max(1, bw - 12 * dpr), h);
      miniCtx.fillStyle = 'rgba(189,236,203,.85)';
      miniCtx.fillText(vals[k][0], k * bw + 0.5 * bw, H - 12 * dpr);
    }
  }


  function allocate() {
    applyMeshFromIndex();
    sim.basis = buildBasis(sim.p);
    if (isEuler()) {
      if (!EULER_DEGREES.includes(sim.p)) sim.p = 1;
      sim.basis = buildBasis(sim.p);
      if (!DISPLAYE.includes(sim.display)) sim.display = 'schlieren';
      initEuler();
      sim.stats = computeStats();
      updateFormula();
      syncControlsFromSim();
      updateUI();
      return;
    }
    const n = coeffCount();
    sim.U = new Float64Array(n);
    sim.A = new Float64Array(n);
    sim.B = new Float64Array(n);
    sim.R = new Float64Array(n);
    sim.lastR = new Float64Array(n);
    sim.t = 0;
    sim.dt = 0;
    sim.step = 0;
    sim.bad = false;
    if (is1D()) {
      if (!['off', 'minmod'].includes(sim.stab)) sim.stab = 'off';
      if (!INIT1.includes(sim.init)) sim.init = 'sine';
      if (!DISPLAY1.includes(sim.display)) sim.display = 'field';
      projectInitial1D();
      resetHistory();
    } else {
      if (!['off', 'filter'].includes(sim.stab)) sim.stab = 'off';
      if (sim.caseName === 'diamond') sim.init = 'diamond';
      else if (!INIT2.includes(sim.init) || sim.init === 'diamond') sim.init = 'blob';
      if (!DISPLAY2.includes(sim.display)) sim.display = 'field';
      projectInitial2D();
      initParticles();
    }
    sim.stats = computeStats();
    updateFormula();
    syncControlsFromSim();
    updateUI();
  }

  function rhsBurgers(U, R) {
    const { np, phi, dphi, left, right, mass } = sim.basis;
    const nx = sim.nx;
    const dx = 1 / nx;
    R.fill(0);

    for (let i = 0; i < nx; i++) {
      const im = (i - 1 + nx) % nx;
      const ip = (i + 1) % nx;
      const uLm = eval1(U, im, 1);
      const uLp = eval1(U, i, -1);
      const uRm = eval1(U, i, 1);
      const uRp = eval1(U, ip, -1);
      const fL = fluxBurgers(uLm, uLp);
      const fR = fluxBurgers(uRm, uRp);
      const base = i * np;
      for (let m = 0; m < np; m++) {
        let vol = 0;
        for (let q = 0; q < Q.x.length; q++) {
          const u = eval1(U, i, Q.x[q]);
          vol += Q.w[q] * fluxB(u) * dphi[q][m];
        }
        const surf = fR * right[m] - fL * left[m];
        R[base + m] = (2 / (dx * mass[m])) * (vol - surf);
      }
    }
  }

  function rhs2D(U, R) {
    const { np, nm2, phi, dphi, left, right, mass } = sim.basis;
    const nx = sim.nx, ny = sim.ny;
    const hx = 1 / nx, hy = 1 / ny;
    R.fill(0);

    let tmp = sim.scratch.rhs2;
    if (tmp.length < nm2) {
      tmp = new Float64Array(nm2);
      sim.scratch.rhs2 = tmp;
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const base = cellBase2(i, j);
        tmp.fill(0);

        // Volume term: ∫_K (a u_h)·∇φ dxdy in the weak DG form.
        for (let qx = 0; qx < Q.x.length; qx++) {
          const xi = Q.x[qx];
          const x = (i + 0.5 * (xi + 1)) * hx;
          for (let qy = 0; qy < Q.x.length; qy++) {
            const eta = Q.x[qy];
            const y = (j + 0.5 * (eta + 1)) * hy;
            const w = Q.w[qx] * Q.w[qy];
            const u = eval2Ref(U, base, xi, eta);
            const vel = velocity(wrap01(x), wrap01(y));
            for (let a = 0; a < np; a++) {
              const pa = phi[qx][a], dpa = dphi[qx][a];
              for (let b = 0; b < np; b++) {
                const pb = phi[qy][b], dpb = dphi[qy][b];
                tmp[a * np + b] += w * u * (0.5 * hy * vel[0] * dpa * pb + 0.5 * hx * vel[1] * pa * dpb);
              }
            }
          }
        }

        // Surface term: ∫_∂K fhat_n φ ds, all normals outward from the current cell.
        const il = (i - 1 + nx) % nx;
        const ir = (i + 1) % nx;
        const jb = (j - 1 + ny) % ny;
        const jt = (j + 1) % ny;
        const baseL = cellBase2(il, j);
        const baseR = cellBase2(ir, j);
        const baseB = cellBase2(i, jb);
        const baseT = cellBase2(i, jt);

        for (let q = 0; q < Q.x.length; q++) {
          const eta = Q.x[q];
          const y = (j + 0.5 * (eta + 1)) * hy;
          // Right face, n=(1,0)
          let x = (i + 1) * hx;
          let s = velocity(wrap01(x), wrap01(y))[0];
          let um = eval2Ref(U, base, 1, eta);
          let up = eval2Ref(U, baseR, -1, eta);
          let fhat = fluxAdvectionNormal(s, um, up);
          for (let a = 0; a < np; a++) {
            const pax = right[a];
            for (let b = 0; b < np; b++) tmp[a * np + b] -= 0.5 * hy * Q.w[q] * fhat * pax * phi[q][b];
          }
          // Left face, n=(-1,0)
          x = i * hx;
          s = -velocity(wrap01(x), wrap01(y))[0];
          um = eval2Ref(U, base, -1, eta);
          up = eval2Ref(U, baseL, 1, eta);
          fhat = fluxAdvectionNormal(s, um, up);
          for (let a = 0; a < np; a++) {
            const pax = left[a];
            for (let b = 0; b < np; b++) tmp[a * np + b] -= 0.5 * hy * Q.w[q] * fhat * pax * phi[q][b];
          }
        }

        for (let q = 0; q < Q.x.length; q++) {
          const xi = Q.x[q];
          const x = (i + 0.5 * (xi + 1)) * hx;
          // Top face, n=(0,1)
          let y = (j + 1) * hy;
          let s = velocity(wrap01(x), wrap01(y))[1];
          let um = eval2Ref(U, base, xi, 1);
          let up = eval2Ref(U, baseT, xi, -1);
          let fhat = fluxAdvectionNormal(s, um, up);
          for (let a = 0; a < np; a++) {
            for (let b = 0; b < np; b++) tmp[a * np + b] -= 0.5 * hx * Q.w[q] * fhat * phi[q][a] * right[b];
          }
          // Bottom face, n=(0,-1)
          y = j * hy;
          s = -velocity(wrap01(x), wrap01(y))[1];
          um = eval2Ref(U, base, xi, -1);
          up = eval2Ref(U, baseB, xi, 1);
          fhat = fluxAdvectionNormal(s, um, up);
          for (let a = 0; a < np; a++) {
            for (let b = 0; b < np; b++) tmp[a * np + b] -= 0.5 * hx * Q.w[q] * fhat * phi[q][a] * left[b];
          }
        }

        for (let a = 0; a < np; a++) {
          for (let b = 0; b < np; b++) {
            const mode = a * np + b;
            const mPhys = hx * hy / ((2 * a + 1) * (2 * b + 1));
            R[base + mode] = tmp[mode] / mPhys;
          }
        }
      }
    }
  }

  function computeDt() {
    if (is1D()) {
      let maxu = 0.05;
      for (let i = 0; i < sim.nx; i++) {
        const ul = Math.abs(eval1(sim.U, i, -1));
        const uc = Math.abs(sim.U[idx1(i, 0)]);
        const ur = Math.abs(eval1(sim.U, i, 1));
        maxu = Math.max(maxu, ul, uc, ur);
      }
      sim.dt = sim.cfl * (1 / sim.nx) / ((2 * sim.p + 1) * maxu + EPS);
    } else {
      const h = Math.min(1 / sim.nx, 1 / sim.ny);
      sim.dt = sim.cfl * h / ((2 * sim.p + 1) * maxVelocity() + EPS);
    }
    // Avoid huge jumps after a catastrophic blowup.
    sim.dt = Math.min(sim.dt, 0.05);
    return sim.dt;
  }

  function axpy(out, a, X, b, Y) {
    for (let i = 0; i < out.length; i++) out[i] = a * X[i] + b * Y[i];
  }

  function addScaled(out, X, dt, R) {
    for (let i = 0; i < out.length; i++) out[i] = X[i] + dt * R[i];
  }

  function applyBurgersLimiter(U) {
    if (sim.p === 0 || sim.stab !== 'minmod') return;
    const nx = sim.nx;
    const np = sim.basis.np;
    const means = new Float64Array(nx);
    for (let i = 0; i < nx; i++) means[i] = U[idx1(i, 0)];
    const theta = 1.45;
    const tvb = 20 / (nx * nx);
    for (let i = 0; i < nx; i++) {
      const im = (i - 1 + nx) % nx;
      const ip = (i + 1) % nx;
      const mean = means[i];
      const ul = eval1(U, i, -1);
      const ur = eval1(U, i, 1);
      const lo = Math.min(means[im], mean, means[ip]) - tvb;
      const hi = Math.max(means[im], mean, means[ip]) + tvb;
      let high = 0;
      for (let m = 2; m < np; m++) high += U[idx1(i, m)] * U[idx1(i, m)];
      const troubled = ul < lo || ul > hi || ur < lo || ur > hi || high > 0.25 * (U[idx1(i, 1)] ** 2 + EPS);
      if (!troubled) continue;
      const duL = means[i] - means[im];
      const duR = means[ip] - means[i];
      U[idx1(i, 1)] = minmod3(U[idx1(i, 1)], 0.5 * theta * duL, 0.5 * theta * duR);
      for (let m = 2; m < np; m++) U[idx1(i, m)] = 0;
    }
  }

  function apply2DFilter(U) {
    if (sim.p < 2 || sim.stab !== 'filter') return;
    const np = sim.basis.np;
    const cells = sim.nx * sim.ny;
    const sigma = 0.06;
    for (let c = 0; c < cells; c++) {
      const base = c * np * np;
      for (let a = 0; a < np; a++) {
        for (let b = 0; b < np; b++) {
          const order = a + b;
          if (order <= 1) continue;
          const fac = Math.exp(-sigma * (order / (2 * sim.p)) ** 8 * 256);
          U[base + a * np + b] *= fac;
        }
      }
    }
  }

  function stabilize(U) {
    if (is1D()) applyBurgersLimiter(U);
    else apply2DFilter(U);
  }

  function rhs(U, R) {
    if (is1D()) rhsBurgers(U, R);
    else rhs2D(U, R);
  }

  function rk3Step() {
    if (isEuler()) { eulerStep(); return; }
    if (sim.bad) return;
    const U = sim.U, A = sim.A, B = sim.B, R = sim.R;
    const dt = computeDt();

    rhs(U, R);
    sim.lastR.set(R);
    addScaled(A, U, dt, R);
    stabilize(A);

    rhs(A, R);
    for (let i = 0; i < U.length; i++) B[i] = 0.75 * U[i] + 0.25 * (A[i] + dt * R[i]);
    stabilize(B);

    rhs(B, R);
    for (let i = 0; i < U.length; i++) U[i] = (1 / 3) * U[i] + (2 / 3) * (B[i] + dt * R[i]);
    stabilize(U);

    sim.t += dt;
    sim.step += 1;
    sim.lastR.set(R);
    checkFinite();
  }

  function checkFinite() {
    if (isEuler()) { checkEulerFinite(); return; }
    let max = 0;
    for (let i = 0; i < sim.U.length; i++) {
      const v = sim.U[i];
      if (!Number.isFinite(v)) { sim.bad = true; break; }
      max = Math.max(max, Math.abs(v));
    }
    if (max > 1e6) sim.bad = true;
    if (sim.bad) sim.running = false;
  }

  function computeStats() {
    if (isEuler()) return computeEulerStats();
    if (!sim.U) return {};
    if (is1D()) return computeStats1D();
    return computeStats2D();
  }

  function computeStats1D() {
    const { np, mass } = sim.basis;
    const nx = sim.nx;
    const dx = 1 / nx;
    let massTot = 0, l2 = 0, high = 0, all = 0, maxAbs = 0;
    let jump2 = 0, jumpN = 0, res2 = 0;
    for (let i = 0; i < nx; i++) {
      massTot += sim.U[idx1(i, 0)] * dx;
      for (let m = 0; m < np; m++) {
        const c = sim.U[idx1(i, m)];
        const e = dx * 0.5 * mass[m] * c * c;
        l2 += e;
        all += e;
        if (m > 0) high += e;
      }
      maxAbs = Math.max(maxAbs, Math.abs(eval1(sim.U, i, -1)), Math.abs(eval1(sim.U, i, 0)), Math.abs(eval1(sim.U, i, 1)));
      const ip = (i + 1) % nx;
      const jmp = eval1(sim.U, i, 1) - eval1(sim.U, ip, -1);
      jump2 += jmp * jmp;
      jumpN++;
      for (let m = 0; m < np; m++) res2 += sim.lastR[idx1(i, m)] ** 2;
    }
    return {
      mass: massTot,
      l2: Math.sqrt(l2),
      mode: Math.sqrt(high / (all + EPS)),
      jump: Math.sqrt(jump2 / Math.max(1, jumpN)),
      residual: Math.sqrt(res2 / sim.U.length),
      maxAbs,
      error: NaN,
      dof: sim.U.length,
    };
  }

  function computeStats2D() {
    const { np } = sim.basis;
    const nx = sim.nx, ny = sim.ny;
    const hx = 1 / nx, hy = 1 / ny;
    let massTot = 0, l2 = 0, high = 0, all = 0, err = 0, jump2 = 0, jumpN = 0, res2 = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const base = cellBase2(i, j);
        massTot += sim.U[base] * hx * hy;
        for (let a = 0; a < np; a++) {
          for (let b = 0; b < np; b++) {
            const c = sim.U[base + a * np + b];
            const e = hx * hy * c * c / ((2 * a + 1) * (2 * b + 1));
            all += e;
            if (a + b > 0) high += e;
            l2 += e;
            res2 += sim.lastR[base + a * np + b] ** 2;
          }
        }
        if (sim.caseName === 'advection') {
          for (let qx = 0; qx < Q.x.length; qx++) {
            const xi = Q.x[qx];
            const x = (i + 0.5 * (xi + 1)) * hx;
            for (let qy = 0; qy < Q.x.length; qy++) {
              const eta = Q.x[qy];
              const y = (j + 0.5 * (eta + 1)) * hy;
              const e = eval2Ref(sim.U, base, xi, eta) - exact2D(x, y);
              err += 0.25 * hx * hy * Q.w[qx] * Q.w[qy] * e * e;
            }
          }
        }
        const ir = (i + 1) % nx;
        const jt = (j + 1) % ny;
        const baseR = cellBase2(ir, j);
        const baseT = cellBase2(i, jt);
        for (let q = 0; q < Q.x.length; q++) {
          const eta = Q.x[q];
          let d = eval2Ref(sim.U, base, 1, eta) - eval2Ref(sim.U, baseR, -1, eta);
          jump2 += d * d; jumpN++;
          const xi = Q.x[q];
          d = eval2Ref(sim.U, base, xi, 1) - eval2Ref(sim.U, baseT, xi, -1);
          jump2 += d * d; jumpN++;
        }
      }
    }
    return {
      mass: massTot,
      l2: Math.sqrt(l2),
      mode: Math.sqrt(high / (all + EPS)),
      jump: Math.sqrt(jump2 / Math.max(1, jumpN)),
      residual: Math.sqrt(res2 / sim.U.length),
      maxAbs: Math.sqrt(l2),
      error: sim.caseName === 'advection' ? Math.sqrt(err) : NaN,
      dof: sim.U.length,
    };
  }

  function sample2DDisplay(x, y) {
    const disp = sim.display;
    if (disp === 'mean') return mean2AtXY(sim.U, x, y);
    if (disp === 'error' && sim.caseName === 'advection') return Math.abs(eval2AtXY(sim.U, x, y) - exact2D(x, y));
    if (disp === 'jump') return jumpSensor2D(x, y);
    if (disp === 'modes') return modeSensor2D(x, y);
    if (disp === 'residual') return residualSensor2D(x, y);
    return eval2AtXY(sim.U, x, y);
  }

  function sample1DDisplay(x, y) {
    const disp = sim.display;
    if (disp === 'mean') {
      const i = Math.min(sim.nx - 1, Math.floor(wrap01(x) * sim.nx));
      return sim.U[idx1(i, 0)];
    }
    if (disp === 'jump') return jumpSensor1D(x);
    if (disp === 'modes') return modeSensor1D(x);
    if (disp === 'residual') return residualSensor1D(x);
    return eval1AtX(sim.U, x);
  }

  function jumpSensor1D(x) {
    const gx = wrap01(x) * sim.nx;
    const i = Math.floor(gx);
    const edgeDist = Math.abs((gx - i) - Math.round(gx - i));
    const ii = Math.min(sim.nx - 1, Math.max(0, i));
    const ip = (ii + 1) % sim.nx;
    const jm = Math.abs(eval1(sim.U, ii, 1) - eval1(sim.U, ip, -1));
    return jm * Math.exp(-80 * edgeDist * edgeDist);
  }

  function modeSensor1D(x) {
    const i = Math.min(sim.nx - 1, Math.floor(wrap01(x) * sim.nx));
    const np = sim.basis.np;
    let h = 0, a = EPS;
    for (let m = 0; m < np; m++) {
      const c = sim.U[idx1(i, m)];
      a += c * c;
      if (m > 0) h += c * c;
    }
    return Math.sqrt(h / a);
  }

  function residualSensor1D(x) {
    const i = Math.min(sim.nx - 1, Math.floor(wrap01(x) * sim.nx));
    const np = sim.basis.np;
    let r = 0;
    for (let m = 0; m < np; m++) r += sim.lastR[idx1(i, m)] ** 2;
    return Math.sqrt(r / np);
  }

  function jumpSensor2D(x, y) {
    const gx = wrap01(x) * sim.nx;
    const gy = wrap01(y) * sim.ny;
    const i = Math.min(sim.nx - 1, Math.floor(gx));
    const j = Math.min(sim.ny - 1, Math.floor(gy));
    const fx = gx - i, fy = gy - j;
    const base = cellBase2(i, j);
    const ir = (i + 1) % sim.nx, il = (i - 1 + sim.nx) % sim.nx;
    const jt = (j + 1) % sim.ny, jb = (j - 1 + sim.ny) % sim.ny;
    let val = 0;
    if (fx > 0.88) val = Math.max(val, Math.abs(eval2Ref(sim.U, base, 1, 2 * fy - 1) - eval2Ref(sim.U, cellBase2(ir, j), -1, 2 * fy - 1)));
    if (fx < 0.12) val = Math.max(val, Math.abs(eval2Ref(sim.U, base, -1, 2 * fy - 1) - eval2Ref(sim.U, cellBase2(il, j), 1, 2 * fy - 1)));
    if (fy > 0.88) val = Math.max(val, Math.abs(eval2Ref(sim.U, base, 2 * fx - 1, 1) - eval2Ref(sim.U, cellBase2(i, jt), 2 * fx - 1, -1)));
    if (fy < 0.12) val = Math.max(val, Math.abs(eval2Ref(sim.U, base, 2 * fx - 1, -1) - eval2Ref(sim.U, cellBase2(i, jb), 2 * fx - 1, 1)));
    return val;
  }

  function modeSensor2D(x, y) {
    x = wrap01(x); y = wrap01(y);
    const i = Math.min(sim.nx - 1, Math.floor(x * sim.nx));
    const j = Math.min(sim.ny - 1, Math.floor(y * sim.ny));
    const base = cellBase2(i, j);
    const np = sim.basis.np;
    let h = 0, a = EPS;
    for (let m = 0; m < np * np; m++) {
      const c = sim.U[base + m];
      a += c * c;
      if (m > 0) h += c * c;
    }
    return Math.sqrt(h / a);
  }

  function residualSensor2D(x, y) {
    x = wrap01(x); y = wrap01(y);
    const i = Math.min(sim.nx - 1, Math.floor(x * sim.nx));
    const j = Math.min(sim.ny - 1, Math.floor(y * sim.ny));
    const base = cellBase2(i, j);
    const np = sim.basis.np;
    let r = 0;
    for (let m = 0; m < np * np; m++) r += sim.lastR[base + m] ** 2;
    return Math.sqrt(r / (np * np));
  }

  function colorMap(v, kind) {
    let t = v;
    if (kind === 'error' || kind === 'jump' || kind === 'modes' || kind === 'residual') {
      t = Math.log10(1 + 8 * Math.abs(v));
      t = clamp(t / 2.0, 0, 1);
    } else if (is1D()) {
      t = (v + 0.35) / 1.55;
    } else if (sim.init === 'two' || sim.init === 'vortex') {
      t = 0.5 + 0.5 * clamp(v, -1, 1);
    } else {
      t = v;
    }
    t = clamp(t, 0, 1);
    const r = Math.round(3 + 42 * t + 160 * Math.max(0, t - 0.76));
    const g = Math.round(10 + 75 * Math.sqrt(t) + 165 * t);
    const b = Math.round(7 + 31 * t + 30 * Math.max(0, t - 0.7));
    return [r, g, b];
  }

  function drawBackground() {
    const W = canvas.width, H = canvas.height;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#03120b');
    grd.addColorStop(1, '#010402');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  function draw2D() {
    const W = canvas.width, H = canvas.height;
    const rw = Math.min(860, Math.max(260, Math.floor(W / 2.0)));
    const rh = Math.min(560, Math.max(190, Math.floor(H / 2.0)));
    if (off.width !== rw || off.height !== rh) { off.width = rw; off.height = rh; }
    const img = offCtx.createImageData(rw, rh);
    const data = img.data;
    const kind = sim.display;
    for (let py = 0; py < rh; py++) {
      const y = 1 - py / Math.max(1, rh - 1);
      for (let px = 0; px < rw; px++) {
        const x = px / Math.max(1, rw - 1);
        const v = sample2DDisplay(x, y);
        const c = colorMap(v, kind);
        const k = 4 * (py * rw + px);
        data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W, H);

    draw2DGrid(W, H);
    drawParticles(W, H);
  }

  function draw2DGrid(W, H) {
    ctx.save();
    ctx.lineWidth = Math.max(1, dpr * 0.7);
    ctx.strokeStyle = 'rgba(145,255,181,.18)';
    const maxLines = 110;
    const sx = Math.max(1, Math.ceil(sim.nx / maxLines));
    const sy = Math.max(1, Math.ceil(sim.ny / maxLines));
    ctx.beginPath();
    for (let i = 0; i <= sim.nx; i += sx) {
      const x = W * i / sim.nx;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let j = 0; j <= sim.ny; j += sy) {
      const y = H * j / sim.ny;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function initParticles() {
    sim.particles = [];
    const n = 1200;
    let seed = 1234567;
    function rnd() {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let k = 0; k < n; k++) sim.particles.push([rnd(), rnd(), rnd()]);
  }

  function drawParticles(W, H) {
    if (is1D()) return;
    const dt = Math.min(0.01, sim.dt || 0.002);
    ctx.save();
    ctx.fillStyle = 'rgba(116,255,161,.58)';
    for (const p of sim.particles) {
      if (sim.running && !sim.bad) {
        const v = velocity(p[0], p[1]);
        p[0] = wrap01(p[0] + 0.18 * dt * v[0]);
        p[1] = wrap01(p[1] + 0.18 * dt * v[1]);
      }
      const x = p[0] * W, y = (1 - p[1]) * H;
      const r = dpr * (0.75 + 0.8 * p[2]);
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.restore();
  }

  function resetHistory() {
    sim.histW = 512;
    sim.histH = 230;
    sim.history = new Float32Array(sim.histW * sim.histH);
    sim.histHead = 0;
    for (let r = 0; r < sim.histH; r++) {
      sim.histHead = r;
      recordHistory(true);
    }
    sim.histHead = 0;
  }

  function recordHistory(noAdvance = false) {
    if (!is1D() || !sim.history) return;
    const row = sim.histHead;
    for (let px = 0; px < sim.histW; px++) {
      const x = px / sim.histW;
      sim.history[row * sim.histW + px] = eval1AtX(sim.U, x);
    }
    if (!noAdvance) sim.histHead = (sim.histHead + 1) % sim.histH;
  }

  function drawBurgers() {
    const W = canvas.width, H = canvas.height;
    const rw = Math.min(900, Math.max(300, Math.floor(W / 1.75)));
    const rh = Math.min(420, Math.max(180, Math.floor(H / 2.25)));
    if (off.width !== rw || off.height !== rh) { off.width = rw; off.height = rh; }
    const img = offCtx.createImageData(rw, rh);
    const data = img.data;
    const kind = sim.display === 'history' ? 'field' : sim.display;

    for (let py = 0; py < rh; py++) {
      const histRow = (sim.histHead + Math.floor(py / rh * sim.histH)) % sim.histH;
      for (let px = 0; px < rw; px++) {
        const x = px / Math.max(1, rw - 1);
        let v;
        if (sim.display === 'history' || py > rh * 0.45) {
          const hx = Math.floor(px / rw * sim.histW);
          v = sim.history[histRow * sim.histW + hx];
        } else {
          const y01 = 1 - py / (rh * 0.45);
          const u = sample1DDisplay(x, 0);
          const curve = clamp((u + 0.35) / 1.55, 0, 1);
          v = Math.abs(y01 - curve) < 0.015 ? 1.2 : 0.04 + 0.15 * sample1DDisplay(x, 0);
        }
        const c = colorMap(v, kind);
        const k = 4 * (py * rw + px);
        data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W, H);

    drawBurgersGridAndCurve(W, H);
  }

  function drawBurgersGridAndCurve(W, H) {
    ctx.save();
    ctx.lineWidth = Math.max(1, dpr * 0.75);
    ctx.strokeStyle = 'rgba(145,255,181,.16)';
    ctx.beginPath();
    const step = Math.max(1, Math.ceil(sim.nx / 140));
    for (let i = 0; i <= sim.nx; i += step) {
      const x = W * i / sim.nx;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let k = 0; k < 10; k++) {
      const y = H * k / 10;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();

    const top = 65 * dpr;
    const bottom = Math.max(top + 80 * dpr, H * 0.43);
    ctx.strokeStyle = 'rgba(166,255,122,.95)';
    ctx.lineWidth = 2.0 * dpr;
    ctx.beginPath();
    for (let px = 0; px <= W; px += Math.max(1, Math.floor(W / 900))) {
      const x = px / W;
      const u = sim.display === 'mean' ? sample1DDisplay(x, 0) : eval1AtX(sim.U, x);
      const yy = bottom - clamp((u + 0.35) / 1.55, 0, 1) * (bottom - top);
      if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(69,216,255,.65)';
    ctx.lineWidth = 1.25 * dpr;
    ctx.beginPath();
    for (let i = 0; i < sim.nx; i++) {
      const x0 = W * i / sim.nx;
      const x1 = W * (i + 1) / sim.nx;
      const u = sim.U[idx1(i, 0)];
      const yy = bottom - clamp((u + 0.35) / 1.55, 0, 1) * (bottom - top);
      ctx.moveTo(x0, yy); ctx.lineTo(x1, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawMini() {
    const rect = mini.getBoundingClientRect();
    const W = Math.max(20, Math.floor(rect.width * dpr));
    const H = Math.max(20, Math.floor(rect.height * dpr));
    if (mini.width !== W || mini.height !== H) { mini.width = W; mini.height = H; }
    miniCtx.clearRect(0, 0, W, H);
    miniCtx.fillStyle = '#010604';
    miniCtx.fillRect(0, 0, W, H);
    miniCtx.strokeStyle = 'rgba(69,216,255,.15)';
    miniCtx.lineWidth = Math.max(1, dpr);
    for (let i = 0; i < 6; i++) {
      const y = H * (i + 1) / 7;
      miniCtx.beginPath(); miniCtx.moveTo(0, y); miniCtx.lineTo(W, y); miniCtx.stroke();
    }
    if (isEuler()) drawMiniEuler(W, H);
    else if (is1D()) drawMiniBurgers(W, H);
    else drawMiniModes(W, H);
  }

  function drawMiniBurgers(W, H) {
    miniCtx.strokeStyle = 'rgba(166,255,122,.95)';
    miniCtx.lineWidth = 1.6 * dpr;
    miniCtx.beginPath();
    for (let px = 0; px < W; px++) {
      const x = px / Math.max(1, W - 1);
      const u = eval1AtX(sim.U, x);
      const y = H - clamp((u + 0.35) / 1.55, 0, 1) * H;
      if (px === 0) miniCtx.moveTo(px, y); else miniCtx.lineTo(px, y);
    }
    miniCtx.stroke();
  }

  function drawMiniModes(W, H) {
    const np = sim.basis.np;
    const binCount = 2 * sim.p + 1;
    if (sim.scratch.miniBins.length < binCount) {
      sim.scratch.miniBins = new Float64Array(binCount);
      sim.scratch.miniCounts = new Float64Array(binCount);
    }
    const bins = sim.scratch.miniBins;
    const counts = sim.scratch.miniCounts;
    bins.fill(0, 0, binCount);
    counts.fill(0, 0, binCount);
    for (let j = 0; j < sim.ny; j++) {
      for (let i = 0; i < sim.nx; i++) {
        const base = cellBase2(i, j);
        for (let a = 0; a < np; a++) {
          for (let b = 0; b < np; b++) {
            const ord = a + b;
            bins[ord] += sim.U[base + a * np + b] ** 2;
            counts[ord]++;
          }
        }
      }
    }
    let maxv = EPS;
    for (let k = 0; k < binCount; k++) maxv = Math.max(maxv, bins[k] / Math.max(1, counts[k]));
    const bw = W / binCount;
    for (let k = 0; k < binCount; k++) {
      const v = bins[k] / Math.max(1, counts[k]);
      const h = H * Math.sqrt(v / maxv);
      miniCtx.fillStyle = k === 0 ? 'rgba(69,216,255,.72)' : 'rgba(166,255,122,.76)';
      miniCtx.fillRect(k * bw + 2 * dpr, H - h, Math.max(1, bw - 4 * dpr), h);
    }
  }

  function draw() {
    drawBackground();
    if (isEuler()) drawEuler();
    else if (is1D()) drawBurgers();
    else draw2D();
    drawMini();
  }

  function fmt(x, n = 3) {
    if (!Number.isFinite(x)) return '--';
    if (Math.abs(x) >= 1000 || Math.abs(x) < 1e-3 && x !== 0) return x.toExponential(1);
    return x.toFixed(n);
  }

  function updateUI() {
    ui.caseChip.innerHTML = `case <b>${sim.caseName}</b>`;
    ui.degreeChip.innerHTML = isEuler() ? `deg <b>P${sim.p}</b>` : `deg <b>Q${sim.p}</b>`;
    ui.meshChip.innerHTML = is1D() ? `mesh <b>${sim.nx}</b>` : `mesh <b>${sim.nx}×${sim.ny}</b>`;
    if (ui.nxChip) ui.nxChip.innerHTML = `Nx <b>${sim.nx}</b>`;
    if (ui.nyChip) {
      ui.nyChip.style.display = is1D() ? 'none' : '';
      ui.nyChip.innerHTML = `Ny <b>${sim.ny}</b>`;
    }
    const fluxName = isEuler() ? 'Rusanov' : (sim.alpha === 0 ? 'central' : (sim.alpha === 1 ? 'upwind' : `LLF`));
    ui.fluxChip.style.display = isEuler() ? 'none' : '';
    ui.fluxChip.innerHTML = `flux <b>${fluxName}</b>`;
    ui.alphaChip.innerHTML = `α <b>${sim.alpha.toFixed(2)}</b>`;
    ui.cflChip.innerHTML = `CFL <b>${sim.cfl.toFixed(2).replace(/^0/, '')}</b>`;
    if (ui.spfChip) ui.spfChip.innerHTML = `spf <b>${sim.stepsPerFrame}</b>`;
    ui.initChip.style.display = isEuler() || sim.caseName === 'diamond' ? 'none' : '';
    ui.initChip.innerHTML = `init <b>${sim.init}</b>`;
    ui.flowChip.style.display = isScalar2D() && !isConstantAdvection() ? '' : 'none';
    ui.flowChip.innerHTML = `vel <b>${sim.caseName === 'advection' ? 'constant' : sim.flow}</b>`;
    if (ui.machChip) ui.machChip.innerHTML = `M∞ <b>${sim.mach.toFixed(2)}</b>`;
    if (ui.radiusChip) ui.radiusChip.innerHTML = `R <b>${sim.cylR.toFixed(2).replace(/^0/, '')}</b>`;
    if (ui.gammaChip) ui.gammaChip.innerHTML = `γ <b>${sim.gamma.toFixed(2)}</b>`;
    ui.limiterChip.style.display = isEuler() ? 'none' : '';
    ui.limiterChip.innerHTML = isEuler() ? `stab <b>pos</b>` : `${is1D() ? 'lim' : 'stab'} <b>${sim.stab}</b>`;
    ui.displayChip.innerHTML = `plot <b>${sim.display}</b>`;
    ui.runChip.textContent = sim.running ? 'Ⅱ' : '▶';

    const st = sim.stats || {};
    ui.okChip.textContent = sim.bad ? 'blown' : 'ok';
    ui.okChip.style.color = sim.bad ? 'var(--bad)' : 'var(--hot)';
    ui.stepChip.textContent = `step ${sim.step}`;
    ui.timeChip.textContent = `t ${fmt(sim.t, 3)}`;
    ui.dtChip.textContent = `dt ${fmt(sim.dt, 2)}`;
    ui.massChip.textContent = `mass ${fmt(st.mass, 4)}`;
    if (isEuler()) {
      ui.errChip.textContent = `Mmax ${fmt(st.machMax, 2)}`;
      ui.jumpChip.textContent = `∇ρ ${fmt(st.jump, 2)}`;
      ui.modeChip.textContent = `fix ${sim.posFix || 0}`;
    } else {
      ui.errChip.textContent = Number.isFinite(st.error) ? `err ${fmt(st.error, 2)}` : `L2 ${fmt(st.l2, 3)}`;
      ui.jumpChip.textContent = `jump ${fmt(st.jump, 2)}`;
      ui.modeChip.textContent = `mode ${fmt(st.mode, 2)}`;
    }
    ui.dofChip.textContent = `dof ${st.dof || '--'}`;

    ui.hudTitle.textContent = isEuler() ? 'DG Euler cylinder diagnostics' : (is1D() ? 'Burgers diagnostics' : 'DG diagnostics');
    ui.hudText.textContent = hudText();
  }

  function hudText() {
    const st = sim.stats || {};
    if (isEuler()) {
      return [
        `equation   2D compressible Euler`,
        `scheme     modal DG P${sim.p}; Rusanov flux α=${sim.alpha}`,
        `domain     ${sim.Lx}×${sim.Ly}; mesh ${sim.nx}×${sim.ny}; cylinder R=${sim.cylR}`,
        `freestream M∞=${sim.mach}, γ=${sim.gamma}; reflective embedded wall`,
        `ranges     ρ [${fmt(st.rhoMin, 3)}, ${fmt(st.rhoMax, 3)}]   p [${fmt(st.pMin, 3)}, ${fmt(st.pMax, 3)}]`,
        `model      inviscid Euler + embedded reflective wall; positivity fallback`,
      ].join('\n');
    }
    if (is1D()) {
      return [
        `equation   u_t + (u²/2)_x = 0`,
        `scheme     modal DG P${sim.p}; Q0 is FVM`,
        `flux       local Lax-Friedrichs / Rusanov, α=${sim.alpha}`,
        `limiter    ${sim.stab === 'minmod' ? 'troubled-cell minmod, mean preserving' : 'off: oscillations near shocks are expected'}`,
        `mass       ${fmt(st.mass, 6)}   L2 ${fmt(st.l2, 4)}`,
      ].join('\n');
    }
    return [
      `equation   u_t + div(a u) = 0`,
      `scheme     tensor-product modal DG Q${sim.p}; Q0 is FVM`,
      `flux       fhat_n = ½s(u-+u+) + ½α|s|(u--u+)`,
      `velocity   constant periodic field`,
      `mass       ${fmt(st.mass, 6)}   ${Number.isFinite(st.error) ? 'err ' + fmt(st.error, 3) : 'res ' + fmt(st.residual, 3)}`,
    ].join('\n');
  }

  function updateFormula() {
    if (isEuler()) {
      ui.formulaText.innerHTML =
        `<code>∂t U + ∂x F(U) + ∂y G(U) = 0</code><br>` +
        `<code>U=(ρ,ρu,ρv,E)</code>, <code>p=(γ−1)(E−ρ(u²+v²)/2)</code>.<br>` +
        `Modal DG update: <code>d/dt ∫K U φ dx + Σf ∫f F̂ φ ds = ∫K F(U)·∇φ dx</code>.<br>` +
        `Rusanov face flux: <code>F̂=½(F_L+F_R)−½α a_max(U_R−U_L)</code>.<br>` +
        `Cylinder wall is imposed by a reflected ghost state: normal velocity changes sign, density and pressure are copied.`;
      return;
    }
    if (is1D()) {
      ui.formulaText.innerHTML =
        `<code>u_t + (u²/2)_x = 0</code><br>` +
        `For each cell <code>K_j</code>: <code>∫ u_t φ dx − ∫ f(u_h) φ_x dx + f̂_R φ_R − f̂_L φ_L = 0</code>.<br>` +
        `Burgers flux: <code>f(u)=u²/2</code>. Numerical flux: <code>f̂=½(f(u⁻)+f(u⁺))+½α max(|u⁻|,|u⁺|)(u⁻−u⁺)</code>.<br>` +
        `<code>Q0</code> leaves only <code>φ=1</code>, so the update is the finite-volume flux difference.`;
    } else {
      ui.formulaText.innerHTML =
        `<code>u_t + ∇·(a u)=0</code>, periodic domain.<br>` +
        `Weak DG: <code>∫_K u_t φ dx − ∫_K (a u_h)·∇φ dx + ∫_∂K f̂_n φ ds = 0</code>.<br>` +
        `Scalar face flux: <code>f̂_n=½s(u⁻+u⁺)+½α|s|(u⁻−u⁺)</code>, <code>s=a·n</code>.<br>` +
        `With <code>Q0</code>, the volume term vanishes and the scheme is exactly the cell-average finite-volume update.`;
    }
  }

  function animationLoop(now) {
    const dtWall = Math.max(1e-3, (now - lastFrame) / 1000);
    lastFrame = now;
    fpsEMA = 0.92 * fpsEMA + 0.08 * (1 / dtWall);

    if (sim.running && !sim.bad) {
      const steps = Math.max(1, Math.min(50, sim.stepsPerFrame | 0));
      for (let k = 0; k < steps; k++) rk3Step();
      if (is1D()) recordHistory(false);
      sim.stats = computeStats();
    }

    draw();
    ui.fpsChip.textContent = `fps ${Math.round(fpsEMA)}`;
    updateUI();
    requestAnimationFrame(animationLoop);
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }

  function handleAction(act) {
    if (!act) return;
    if (act === 'about' || act === 'help') {
      ui.helpOverlay.classList.toggle('open');
      return;
    }
    if (act === 'run') {
      sim.running = !sim.running;
      updateUI();
      return;
    }
    if (act === 'step') {
      sim.running = false;
      rk3Step();
      if (is1D()) recordHistory(false);
      sim.stats = computeStats();
      updateUI();
      draw();
      return;
    }
    if (act === 'apply') {
      applyTypedControls();
      return;
    }
    if (act === 'reset') {
      allocate();
      return;
    }
    if (act === 'case') {
      openCasePanel(ui.caseChip);
      return;
    }
    if (act === 'degree') {
      openOptionPanel('degree', ui.degreeChip);
      return;
    }
    if (act === 'mesh') {
      openOptionPanel('mesh', ui.meshChip);
      return;
    }
    if (act === 'flux') {
      openOptionPanel('flux', ui.fluxChip);
      return;
    }
    if (act === 'alpha') {
      openOptionPanel('alpha', ui.alphaChip);
      return;
    }
    if (act === 'cfl') {
      openTokenEditor('cfl', ui.cflChip);
      return;
    }
    if (act === 'init') {
      if (isEuler() || sim.caseName === 'diamond') return;
      openOptionPanel('init', ui.initChip);
      return;
    }
    if (act === 'flow') {
      if (isEuler()) {
        openTokenEditor('mach', ui.machChip || ui.flowChip);
        return;
      }
      if (is1D() || isConstantAdvection()) return;
      openOptionPanel('flow', ui.flowChip);
      return;
    }
    if (act === 'limiter') {
      if (isEuler()) return;
      openOptionPanel('limiter', ui.limiterChip);
      return;
    }
    if (act === 'display') {
      openOptionPanel('display', ui.displayChip);
      return;
    }
  }

  function setCase(name) {
    if (!CASES.includes(name)) return;
    sim.caseName = name;
    sim.meshIndex = Math.max(0, Math.min(1, sim.meshIndex));
    if (sim.caseName === 'euler') {
      if (!EULER_DEGREES.includes(sim.p)) sim.p = 1;
      sim.display = 'schlieren';
    } else if (sim.caseName === 'burgers') {
      if (!INIT1.includes(sim.init)) sim.init = 'sine';
      if (!DISPLAY1.includes(sim.display)) sim.display = 'field';
    } else {
      sim.init = sim.caseName === 'diamond' ? 'diamond' : 'blob';
      if (!DISPLAY2.includes(sim.display)) sim.display = 'field';
    }
    allocate();
  }

  function currentDisplayList() {
    return isEuler() ? DISPLAYE : (is1D() ? DISPLAY1 : DISPLAY2);
  }

  function syncPlotSelect() {
    const list = currentDisplayList();
    if (!ui.plotSelect) return;
    const old = ui.plotSelect.value;
    ui.plotSelect.innerHTML = '';
    for (const name of list) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      ui.plotSelect.appendChild(opt);
    }
    ui.plotSelect.value = list.includes(sim.display) ? sim.display : (list.includes(old) ? old : list[0]);
  }

  function syncControlsFromSim() {
    if (!ui.nxInput) return;
    ui.nxInput.value = sim.nx;
    ui.nyInput.value = sim.ny;
    ui.cflInput.value = sim.cfl.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    ui.spfInput.value = sim.stepsPerFrame;
    ui.machInput.value = sim.mach.toFixed(2);
    ui.radiusInput.value = sim.cylR.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    ui.gammaInput.value = sim.gamma.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    const eOnly = document.querySelectorAll('.eulerOnly');
    eOnly.forEach(el => { el.style.display = isEuler() ? 'inline-flex' : 'none'; });
    syncPlotSelect();
  }

  function readNumInput(el, fallback, lo, hi, integer = false) {
    let v = Number(el && el.value);
    if (!Number.isFinite(v)) v = fallback;
    v = clamp(v, lo, hi);
    if (integer) v = Math.round(v);
    return v;
  }

  function applyTypedControls() {
    sim.meshIndex = -1;
    const maxNx = isEuler() ? 360 : (is1D() ? 1200 : 360);
    sim.nx = readNumInput(ui.nxInput, sim.nx, is1D() ? 16 : 32, maxNx, true);
    sim.ny = is1D() ? 1 : readNumInput(ui.nyInput, sim.ny, 8, isEuler() ? 180 : 220, true);
    sim.cfl = readNumInput(ui.cflInput, sim.cfl, 0.01, isEuler() ? 1.2 : 1.4, false);
    sim.stepsPerFrame = readNumInput(ui.spfInput, sim.stepsPerFrame, 1, 50, true);
    sim.mach = readNumInput(ui.machInput, sim.mach, 0.1, 5.0, false);
    sim.cylR = readNumInput(ui.radiusInput, sim.cylR, 0.03, 0.25, false);
    sim.gamma = readNumInput(ui.gammaInput, sim.gamma, 1.05, 1.80, false);
    if (ui.plotSelect && currentDisplayList().includes(ui.plotSelect.value)) sim.display = ui.plotSelect.value;
    allocate();
  }

  const editorConfigs = {
    nx: {
      title: 'Nx cells',
      input: 'nxInput',
      values: [48, 72, 96, 128, 160],
      meta: 'Enter applies and resets the mesh; higher DG degree should use fewer cells',
    },
    ny: {
      title: 'Ny cells',
      input: 'nyInput',
      values: [24, 36, 48, 64, 80],
      meta: 'Use roughly Nx/2 for the Euler cylinder domain',
    },
    cfl: {
      title: 'CFL',
      input: 'cflInput',
      values: [0.08, 0.14, 0.2, 0.32, 0.48, 0.72, 1.0],
      meta: 'Explicit time-step Courant number',
    },
    spf: {
      title: 'steps per frame',
      input: 'spfInput',
      values: [1, 2, 4, 8, 16, 32],
      meta: 'Higher values advance physical time faster',
    },
    mach: {
      title: 'freestream Mach',
      input: 'machInput',
      values: [0.5, 0.8, 1.2, 1.5, 2.0, 3.0],
      meta: 'Applies to the Euler cylinder case',
    },
    radius: {
      title: 'cylinder radius',
      input: 'radiusInput',
      values: [0.05, 0.08, 0.10, 0.12, 0.16],
      meta: 'Domain units; changing it resets the case',
    },
    gamma: {
      title: 'ratio of specific heats',
      input: 'gammaInput',
      values: [1.2, 1.3, 1.4, 1.5, 1.67],
      meta: 'γ in p=(γ−1)(E−kinetic energy)',
    },
  };

  function meshOptions() {
    const meshes = isEuler() ? MESHE : (is1D() ? MESH1 : MESH2);
    return meshes.map((mesh, index) => {
      const label = Array.isArray(mesh) ? `${mesh[0]}×${mesh[1]}` : String(mesh);
      return { value: String(index), label };
    });
  }

  function scalarInitOptions() {
    return (is1D() ? INIT1 : INIT2.filter(name => name !== 'diamond')).map(name => ({ value: name, label: name }));
  }

  function optionConfig(key) {
    if (key === 'degree') {
      return {
        title: 'degree',
        value: String(sim.p),
        values: (isEuler() ? EULER_DEGREES : DEGREES).map(p => ({ value: String(p), label: isEuler() ? `P${p}` : `Q${p}` })),
        meta: 'P0/Q0 is the finite-volume limit; higher degree adds modal DG structure',
      };
    }
    if (key === 'mesh') {
      return {
        title: 'mesh',
        value: String(Math.max(0, sim.meshIndex)),
        values: meshOptions(),
        meta: 'Mesh presets reset the current case; exact Nx/Ny remain available in the backing controls',
      };
    }
    if (key === 'flux') {
      return {
        title: 'flux',
        value: sim.alpha === 0 ? 'central' : (sim.alpha === 1 ? 'upwind' : 'llf'),
        values: [
          { value: 'central', label: 'central' },
          { value: 'upwind', label: 'upwind' },
          { value: 'llf', label: 'LLF' },
        ],
        meta: 'Scalar numerical flux choice; LLF uses stronger dissipation',
      };
    }
    if (key === 'alpha') {
      return {
        title: 'dissipation alpha',
        value: String(sim.alpha),
        values: (isEuler() ? ALPHASE : ALPHAS).map(a => ({ value: String(a), label: a.toFixed(2) })),
        meta: 'Multiplier in the numerical flux dissipation term',
      };
    }
    if (key === 'init') {
      return {
        title: 'initial condition',
        value: sim.init,
        values: scalarInitOptions(),
        meta: 'Initial data for scalar DG cases',
      };
    }
    if (key === 'flow') {
      return {
        title: 'velocity field',
        value: sim.flow,
        values: FLOWS.map(name => ({ value: name, label: name })),
        meta: 'Velocity field for the variable-coefficient scalar advection case',
      };
    }
    if (key === 'limiter') {
      const list = is1D() ? ['off', 'minmod'] : ['off', 'filter'];
      return {
        title: is1D() ? 'limiter' : 'stabilizer',
        value: sim.stab,
        values: list.map(name => ({ value: name, label: name })),
        meta: is1D() ? 'Mean-preserving troubled-cell limiter for Burgers shocks' : 'Modal filter for scalar 2D cases',
      };
    }
    if (key === 'display') {
      return {
        title: 'plot',
        value: sim.display,
        values: currentDisplayList().map(name => ({ value: name, label: name })),
        meta: 'Field shown on the main canvas',
      };
    }
    return null;
  }

  function applyOptionValue(key, value) {
    if (key === 'degree') {
      sim.p = Number(value);
      allocate();
    } else if (key === 'mesh') {
      sim.meshIndex = Number(value) | 0;
      allocate();
    } else if (key === 'flux') {
      sim.alpha = value === 'central' ? 0 : (value === 'upwind' ? 1 : 1.5);
      updateFormula();
      updateUI();
    } else if (key === 'alpha') {
      sim.alpha = Number(value);
      updateFormula();
      updateUI();
    } else if (key === 'init') {
      sim.init = value;
      allocate();
    } else if (key === 'flow') {
      sim.flow = value;
      allocate();
    } else if (key === 'limiter') {
      sim.stab = value;
      updateUI();
    } else if (key === 'display') {
      sim.display = value;
      if (sim.display === 'error' && sim.caseName !== 'advection') sim.display = 'field';
      syncPlotSelect();
      updateUI();
    }
    hideTokenEditor();
  }

  function hideTokenEditor() {
    if (!ui.tokenEditor) return;
    ui.tokenEditor.classList.remove('visible');
    ui.tokenEditor.setAttribute('aria-hidden', 'true');
    if (ui.tokenEditorEntry) ui.tokenEditorEntry.style.display = '';
  }

  function applyEditorValue(key, value) {
    const cfg = editorConfigs[key];
    if (!cfg) return;
    const input = ui[cfg.input];
    if (!input) return;
    input.value = String(value);
    if (key === 'cfl') {
      sim.cfl = readNumInput(input, sim.cfl, 0.01, isEuler() ? 1.2 : 1.4, false);
      syncControlsFromSim();
      updateUI();
      hideTokenEditor();
      return;
    }
    if (key === 'spf') {
      sim.stepsPerFrame = readNumInput(input, sim.stepsPerFrame, 1, 50, true);
      syncControlsFromSim();
      updateUI();
      hideTokenEditor();
      return;
    }
    applyTypedControls();
    hideTokenEditor();
  }

  function openTokenEditor(key, anchor) {
    const cfg = editorConfigs[key];
    if (!cfg || !ui.tokenEditor) return;
    const input = ui[cfg.input];
    ui.tokenEditorEntry.style.display = '';
    ui.tokenEditorTitle.textContent = cfg.title;
    ui.tokenEditorEntry.value = input ? input.value : '';
    ui.tokenEditorEntry.dataset.key = key;
    ui.tokenEditorMeta.textContent = cfg.meta || '';
    ui.tokenEditorItems.innerHTML = '';
    for (const value of cfg.values) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inline-suggestion';
      button.dataset.key = key;
      button.dataset.value = String(value);
      button.textContent = String(value);
      li.appendChild(button);
      ui.tokenEditorItems.appendChild(li);
    }

    const rect = anchor.getBoundingClientRect();
    const editorWidth = Math.min(360, window.innerWidth - 24);
    ui.tokenEditor.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - editorWidth - 8))}px`;
    ui.tokenEditor.style.top = `${Math.max(54, rect.bottom + 8)}px`;
    ui.tokenEditor.classList.add('visible');
    ui.tokenEditor.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      ui.tokenEditorEntry.focus();
      ui.tokenEditorEntry.select();
    });
  }

  function openOptionPanel(key, anchor) {
    const cfg = optionConfig(key);
    if (!cfg || !ui.tokenEditor || !anchor) return;
    ui.tokenEditorTitle.textContent = cfg.title;
    ui.tokenEditorEntry.style.display = 'none';
    ui.tokenEditorEntry.dataset.key = '';
    ui.tokenEditorItems.innerHTML = '';
    for (const item of cfg.values) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inline-suggestion';
      button.dataset.optionKey = key;
      button.dataset.optionValue = item.value;
      button.textContent = item.label;
      if (item.value === cfg.value) button.classList.add('selected');
      li.appendChild(button);
      ui.tokenEditorItems.appendChild(li);
    }
    ui.tokenEditorMeta.textContent = cfg.meta || '';
    const rect = anchor.getBoundingClientRect();
    const editorWidth = Math.min(360, window.innerWidth - 24);
    ui.tokenEditor.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - editorWidth - 8))}px`;
    ui.tokenEditor.style.top = `${Math.max(54, rect.bottom + 8)}px`;
    ui.tokenEditor.classList.add('visible');
    ui.tokenEditor.setAttribute('aria-hidden', 'false');
  }

  const footerStatusActions = {
    ok: {
      title: 'status',
      meta: 'If this turns bad, reduce CFL, mesh, degree, or reset.',
      actions: [['edit', 'cfl', 'CFL'], ['act', 'degree', 'degree'], ['edit', 'nx', 'Nx'], ['act', 'reset', 'reset']],
    },
    fps: {
      title: 'performance',
      meta: 'Most speed comes from fewer cells, lower degree, and fewer solver steps per frame.',
      actions: [['edit', 'spf', 'spf'], ['act', 'degree', 'degree'], ['edit', 'nx', 'Nx'], ['edit', 'ny', 'Ny']],
    },
    step: {
      title: 'advance',
      meta: 'Step count changes with run, step, reset, and spf.',
      actions: [['act', 'run', 'run/pause'], ['act', 'step', 'single step'], ['edit', 'spf', 'spf'], ['act', 'reset', 'reset']],
    },
    time: {
      title: 'physical time',
      meta: 'Physical time advances by the CFL-limited explicit time step.',
      actions: [['edit', 'cfl', 'CFL'], ['edit', 'spf', 'spf'], ['act', 'run', 'run/pause'], ['act', 'reset', 'reset']],
    },
    dt: {
      title: 'time step',
      meta: 'The solver computes dt from CFL, mesh size, degree, and wave speed.',
      actions: [['edit', 'cfl', 'CFL'], ['act', 'degree', 'degree'], ['edit', 'nx', 'Nx'], ['edit', 'mach', 'Mach']],
    },
    mass: {
      title: 'mass',
      meta: 'Mass changes should mainly reflect boundary flow in Euler; scalar cases are periodic.',
      actions: [['edit', 'nx', 'Nx'], ['edit', 'ny', 'Ny'], ['act', 'reset', 'reset'], ['act', 'display', 'plot']],
    },
    err: {
      title: 'error / extrema',
      meta: 'Use plot, degree, and dissipation to inspect or stabilize the field.',
      actions: [['act', 'display', 'plot'], ['act', 'degree', 'degree'], ['act', 'alpha', 'alpha'], ['act', 'limiter', 'limiter']],
    },
    jump: {
      title: 'jumps / gradients',
      meta: 'Large jumps usually need more dissipation, more cells, or a limiter where available.',
      actions: [['act', 'alpha', 'alpha'], ['act', 'limiter', 'limiter'], ['edit', 'nx', 'Nx'], ['act', 'display', 'plot']],
    },
    mode: {
      title: 'mode / fix',
      meta: 'High mode content or positivity fixes respond to degree, dissipation, limiter, and CFL.',
      actions: [['act', 'degree', 'degree'], ['act', 'alpha', 'alpha'], ['edit', 'cfl', 'CFL'], ['act', 'limiter', 'limiter']],
    },
    dof: {
      title: 'degrees of freedom',
      meta: 'DOF is controlled by mesh size and DG degree.',
      actions: [['act', 'degree', 'degree'], ['edit', 'nx', 'Nx'], ['edit', 'ny', 'Ny'], ['act', 'mesh', 'mesh']],
    },
  };

  const actionAnchors = {
    degree: 'degreeChip',
    mesh: 'meshChip',
    alpha: 'alphaChip',
    limiter: 'limiterChip',
    display: 'displayChip',
    run: 'runChip',
    reset: null,
    step: null,
  };

  const editAnchors = {
    nx: 'nxChip',
    ny: 'nyChip',
    cfl: 'cflChip',
    spf: 'spfChip',
    mach: 'machChip',
    radius: 'radiusChip',
    gamma: 'gammaChip',
  };

  function runFooterAction(kind, key, source) {
    hideTokenEditor();
    if (kind === 'edit') {
      const anchor = ui[editAnchors[key]] || source;
      openTokenEditor(key, anchor);
      return;
    }
    handleAction(key);
  }

  function openStatusPanel(key, anchor) {
    const cfg = footerStatusActions[key];
    if (!cfg || !ui.tokenEditor) return;
    ui.tokenEditorTitle.textContent = `${cfg.title} ${anchor.textContent.trim()}`;
    ui.tokenEditorEntry.style.display = 'none';
    ui.tokenEditorEntry.dataset.key = '';
    ui.tokenEditorItems.innerHTML = '';
    for (const [kind, action, label] of cfg.actions) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inline-suggestion';
      button.dataset.statusKind = kind;
      button.dataset.statusAction = action;
      button.textContent = label;
      li.appendChild(button);
      ui.tokenEditorItems.appendChild(li);
    }
    ui.tokenEditorMeta.textContent = cfg.meta;
    const rect = anchor.getBoundingClientRect();
    const editorWidth = Math.min(360, window.innerWidth - 24);
    ui.tokenEditor.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - editorWidth - 8))}px`;
    ui.tokenEditor.style.top = `${Math.max(54, rect.top - 154)}px`;
    ui.tokenEditor.classList.add('visible');
    ui.tokenEditor.setAttribute('aria-hidden', 'false');
  }

  function openCasePanel(anchor) {
    if (!ui.tokenEditor) return;
    ui.tokenEditorTitle.textContent = 'case';
    ui.tokenEditorEntry.style.display = 'none';
    ui.tokenEditorEntry.dataset.key = '';
    ui.tokenEditorItems.innerHTML = '';
    for (const name of CASES) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inline-suggestion';
      button.dataset.case = name;
      button.textContent = name;
      if (name === sim.caseName) button.classList.add('selected');
      li.appendChild(button);
      ui.tokenEditorItems.appendChild(li);
    }
    ui.tokenEditorMeta.textContent = 'Euler cylinder, diamond, smooth advection, or Burgers';
    const rect = anchor.getBoundingClientRect();
    const editorWidth = Math.min(360, window.innerWidth - 24);
    ui.tokenEditor.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - editorWidth - 8))}px`;
    ui.tokenEditor.style.top = `${Math.max(54, rect.bottom + 8)}px`;
    ui.tokenEditor.classList.add('visible');
    ui.tokenEditor.setAttribute('aria-hidden', 'false');
  }

  function showTipFor(target, ev) {
    if (!ui.tip) return;
    const text = target && target.dataset ? target.dataset.help : '';
    if (!text) { ui.tip.style.display = 'none'; return; }
    ui.tip.textContent = text;
    ui.tip.style.display = 'block';
    const pad = 14;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    const rect = ui.tip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = ev.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = ev.clientY - rect.height - pad;
    ui.tip.style.left = `${Math.max(8, x)}px`;
    ui.tip.style.top = `${Math.max(8, y)}px`;
  }


  function bind() {
    document.addEventListener('click', (ev) => {
      const clickTarget = ev.target instanceof Element ? ev.target : null;
      const editTarget = clickTarget ? clickTarget.closest('[data-edit]') : null;
      if (editTarget) {
        openTokenEditor(editTarget.dataset.edit, editTarget);
        return;
      }
      if (clickTarget && ui.tokenEditor && ui.tokenEditor.contains(clickTarget)) {
        const optionTarget = clickTarget.closest('[data-option-key]');
        if (optionTarget) {
          applyOptionValue(optionTarget.dataset.optionKey, optionTarget.dataset.optionValue);
          return;
        }
        const caseTarget = clickTarget.closest('[data-case]');
        if (caseTarget) {
          setCase(caseTarget.dataset.case);
          hideTokenEditor();
          return;
        }
        const statusAction = clickTarget.closest('[data-status-action]');
        if (statusAction) {
          runFooterAction(statusAction.dataset.statusKind, statusAction.dataset.statusAction, statusAction);
          return;
        }
        const suggestion = clickTarget.closest('.inline-suggestion');
        if (suggestion) applyEditorValue(suggestion.dataset.key, suggestion.dataset.value);
        return;
      }
      const caseTarget = clickTarget ? clickTarget.closest('[data-case]') : null;
      if (caseTarget) {
        setCase(caseTarget.dataset.case);
        return;
      }
      const statusTarget = clickTarget ? clickTarget.closest('[data-status]') : null;
      if (statusTarget) {
        openStatusPanel(statusTarget.dataset.status, statusTarget);
        return;
      }
      const target = clickTarget ? clickTarget.closest('[data-act]') : null;
      if (target) handleAction(target.dataset.act);
      else hideTokenEditor();
    });
    if (ui.tokenEditorEntry) {
      ui.tokenEditorEntry.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          applyEditorValue(ui.tokenEditorEntry.dataset.key, ui.tokenEditorEntry.value);
        } else if (ev.key === 'Escape') {
          hideTokenEditor();
        }
      });
    }
    if (ui.plotSelect) ui.plotSelect.addEventListener('change', () => { sim.display = ui.plotSelect.value; updateUI(); });
    for (const el of [ui.nxInput, ui.nyInput, ui.cflInput, ui.spfInput, ui.machInput, ui.radiusInput, ui.gammaInput]) {
      if (!el) continue;
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') applyTypedControls(); });
    }
    document.addEventListener('mousemove', (ev) => {
      const target = ev.target instanceof Element ? ev.target.closest('[data-help]') : null;
      showTipFor(target, ev);
    });
    document.addEventListener('mouseleave', () => { if (ui.tip) ui.tip.style.display = 'none'; });
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (ev) => {
      if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
      if (ev.code === 'Space') { ev.preventDefault(); handleAction('run'); }
      else if (ev.key === 'r' || ev.key === 'R') handleAction('reset');
      else if (ev.key === 's' || ev.key === 'S') handleAction('step');
      else if (ev.key === '[') { sim.p = Math.max(0, sim.p - 1); if (isEuler()) sim.p = Math.min(2, sim.p); allocate(); }
      else if (ev.key === ']') { sim.p = Math.min(isEuler() ? 2 : 3, sim.p + 1); allocate(); }
      else if (ev.key === '1') setCase('euler');
      else if (ev.key === '2') setCase('diamond');
      else if (ev.key === '3') setCase('advection');
      else if (ev.key === '4') setCase('burgers');
    });
  }

  function init() {
    bind();
    resize();
    allocate();
    requestAnimationFrame((t) => { lastFrame = t; requestAnimationFrame(animationLoop); });
  }

  init();
  }
};
