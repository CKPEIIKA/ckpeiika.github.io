window.DgEulerCylinderLab = {
  init() {
  'use strict';

  const Engine = window.DgEngine;
  if (!Engine) throw new Error('dg-engine.js must be loaded before app.js');
  const {
    TAU,
    EPS,
    Q,
    EQ,
    FACE,
    clamp,
    wrap01,
    legendre: P,
    dLegendre: dP,
    minmod3,
    WEDGE_HALF_ANGLE,
    insideShape,
    obliqueShockBeta,
    buildBasis,
    burgersPhysicalFlux,
    burgersFlux,
    advectionNormalFlux,
    idx1: engineIdx1,
    cellBase2: engineCellBase2,
    eval1: engineEval1,
    eval1AtX: engineEval1AtX,
    eval2Ref: engineEval2Ref,
    evalModal: engineEvalModal,
    eval2AtXY: engineEval2AtXY,
    mean2AtXY: engineMean2AtXY,
    projectInitial1D: engineProjectInitial1D,
    projectInitial2D: engineProjectInitial2D,
    Equations,
    NumericalFlux,
    createMesh,
    createCase,
    Stepper,
    Euler2D,
    DGSolver2D,
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
    shapeChip: document.getElementById('shapeChip'),
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
  const ALPHASE = [0.75, 1.0, 1.25, 1.6, 2.0];
  const CFLS = [0.08, 0.14, 0.20, 0.32, 0.48, 0.72, 1.00];
  const FLOWS = ['uniform', 'swirl', 'shear'];
  const EULER_LIMITERS = ['off', 'pos', 'minmod', 'flatten'];
  const INIT2 = ['diamond', 'blob', 'two', 'vortex', 'square'];
  const INIT1 = ['sine', 'riemann', 'bump', 'square'];
  const DISPLAY2 = ['field', 'mean', 'jump', 'modes', 'residual', 'error'];
  const DISPLAY1 = ['field', 'mean', 'jump', 'modes', 'residual', 'history'];
  const DISPLAYE = ['schlieren', 'rho', 'pressure', 'mach', 'speed', 'vorticity', 'entropy', 'solid'];
  const MESH2 = [
    [28, 18], [40, 26], [56, 36], [72, 46], [92, 58],
  ];
  const MESHE = [
    [48, 24], [72, 36], [96, 48], [128, 64], [160, 80],
  ];
  const MESH1 = [96, 160, 240, 360, 520];

  const sim = {
    running: false,
    caseName: 'euler',
    p: 1,
    meshIndex: 1,
    nx: 72,
    ny: 36,
    cfl: 0.18,
    alpha: 1.0,
    flow: 'uniform',
    init: 'blob',
    stab: 'off',
    eulerLimiter: 'minmod',
    display: 'schlieren',
    stepsPerFrame: 1,
    gamma: 1.4,
    mach: 1.5,
    shape: 'square',
    cylR: 0.10,
    Lx: 4.0,
    Ly: 2.0,
    cylX: 1.0,
    cylY: 1.0,
    bodyRect: null,
    eU: null,
    eSolver: null,
    solid: null,
    eFluidCells: null,
    eFine: null,
    eFineRecycle: null,
    eFineK: 1,
    eFineW: 0,
    eFineH: 0,
    eForces: [0, 0],
    limLast: [0, 0],
    eHist: null,
    activeCase: null,
    activeMesh: null,
    stepper: Stepper.rk3,
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
    perfWarning: '',
    solverMs: 0,
    eulerStepping: false,
    eulerGeneration: 0,
    workerPool: null,
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
      dispField: null,
      imageData: null,
      image32: null,
    },
  };

  let off = document.createElement('canvas');
  let offCtx = off.getContext('2d', { alpha: false });
  let dpr = 1;
  let lastFrame = performance.now();
  let fpsEMA = 60;
  let frameId = 0;

  function isEuler() { return sim.caseName === 'euler'; }
  function is1D() { return sim.caseName === 'burgers'; }
  function is2D() { return !is1D(); }
  function isScalar2D() { return !isEuler() && !is1D(); }
  function isConstantAdvection() {
    return sim.caseName === 'diamond' || (sim.caseName === 'advection' && sim.flow === 'uniform');
  }

  function configureActiveCase() {
    const equation = isEuler()
      ? Euler2D
      : (is1D() ? Equations.burgers1D : Equations.scalarAdvection2D);
    sim.activeMesh = createMesh({
      nx: sim.nx,
      ny: sim.ny,
      dx: isEuler() ? sim.Lx / sim.nx : 1 / sim.nx,
      dy: is1D() ? 1 : (isEuler() ? sim.Ly / sim.ny : 1 / sim.ny),
      solid: isEuler() ? sim.solid : null,
    });
    sim.activeCase = createCase({
      name: sim.caseName,
      equation,
      mesh: sim.activeMesh,
      numericalFlux: is1D() ? NumericalFlux.burgersRusanov : NumericalFlux.scalarAdvectionNormal,
      displayFields: currentDisplayList(),
    });
    sim.stepper = Stepper.rk3;
  }

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
    if (sim.caseName === 'diamond' || sim.flow === 'uniform') return [1.0, 0.38];
    if (sim.flow === 'shear') return [1.0, 0.52 * Math.sin(TAU * x)];
    // Periodic, divergence-free toy field: div(sin(2πy), sin(2πx)) = 0.
    return [Math.sin(TAU * y), Math.sin(TAU * x)];
  }

  function maxVelocity() {
    if (isConstantAdvection()) return Math.hypot(1.0, 0.38);
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
  // Compressible Euler cylinder case. Vector-valued modal DG for conservative
  // variables; P0 is the finite-volume limit of the same weak form. It solves
  //   ∂t U + ∂x F(U) + ∂y G(U) = 0,
  //   U=(ρ,ρu,ρv,E), p=(γ-1)(E-ρ(u²+v²)/2),
  // with local Lax-Friedrichs/Rusanov numerical fluxes.

  function eCell(i, j) { return j * sim.nx + i; }
  function eBase(i, j) { return 4 * eCell(i, j); }

  function eFarVars() {
    const g = sim.gamma;
    const rho = 1.0;
    const p = 1.0 / g;       // c = sqrt(g p / rho) = 1, so u∞ = M∞.
    const u = sim.mach;
    const v = 0.0;
    const E = p / (g - 1) + 0.5 * rho * (u * u + v * v);
    return [rho, rho * u, rho * v, E];
  }

  function destroyEulerWorkers() {
    if (!sim.workerPool) return;
    for (const item of sim.workerPool.workers) item.worker.terminate();
    sim.workerPool = null;
  }

  function timeout(ms) {
    return new Promise(resolve => setTimeout(() => resolve(null), ms));
  }

  function createEulerWorkerPool() {
    destroyEulerWorkers();
    if (!window.Worker) return null;
    try {
      const worker = new Worker('./dg-worker.js');
      let seq = 0;
      const pending = new Map();
      const ready = new Promise((resolve, reject) => {
        worker.onerror = reject;
        worker.onmessage = (event) => {
          const msg = event.data || {};
          if (msg.type === 'readyFull') {
            resolve(true);
            return;
          }
          if (msg.type === 'stepped') {
            const done = pending.get(msg.seq);
            if (done) {
              pending.delete(msg.seq);
              done(msg);
            }
          }
        };
      }).catch(() => false);
      worker.postMessage({
        type: 'initFull',
        nx: sim.nx,
        ny: sim.ny,
        p: sim.p,
        gamma: sim.gamma,
        alpha: sim.alpha,
        mach: sim.mach,
        Lx: sim.Lx,
        Ly: sim.Ly,
        cylX: sim.cylX,
        cylY: sim.cylY,
        cylR: sim.cylR,
        shape: sim.shape,
        limiter: sim.eulerLimiter,
        fineK: sim.eFineK,
      });
      return {
        mode: 'owned',
        workers: [{ worker }],
        ready,
        step(count) {
          seq += 1;
          const id = seq;
          const promise = new Promise(resolve => pending.set(id, resolve));
          const transfers = [];
          let recycle = null;
          if (sim.eFineRecycle && sim.eFineRecycle.buffer.byteLength) {
            recycle = sim.eFineRecycle.buffer;
            transfers.push(recycle);
          }
          sim.eFineRecycle = null;
          try {
            worker.postMessage({
              type: 'stepFull',
              seq: id,
              count,
              cfl: sim.cfl,
              alpha: sim.alpha,
              gamma: sim.gamma,
              limiter: sim.eulerLimiter,
              recycle,
            }, transfers);
          } catch (error) {
            pending.delete(id);
            return Promise.resolve(null);
          }
          return promise;
        },
      };
    } catch (error) {
      return null;
    }
  }

  function eSolidAt(i, j) {
    if (i < 0 || i >= sim.nx || j < 0 || j >= sim.ny) return 0;
    return sim.solid[eCell(i, j)];
  }

  function eulerFineK() {
    let k = sim.p === 0 ? 1 : (sim.p === 1 ? 3 : 4);
    while (k > 1 && sim.nx * k * sim.ny * k > 260000) k--;
    return k;
  }

  function initEuler() {
    sim.eulerGeneration += 1;
    sim.eulerStepping = false;
    const n = sim.nx * sim.ny;
    sim.solid = new Uint8Array(n);
    const fluid = [];
    const dx = sim.Lx / sim.nx, dy = sim.Ly / sim.ny;
    const inside = (x, y) => insideShape(sim.shape, x, y, sim.cylX, sim.cylY, sim.cylR);
    let iMin = sim.nx, iMax = -1, jMin = sim.ny, jMax = -1;
    for (let j = 0; j < sim.ny; j++) {
      const y = (j + 0.5) * dy;
      for (let i = 0; i < sim.nx; i++) {
        const x = (i + 0.5) * dx;
        const c = eCell(i, j);
        const solidHere = inside(x, y);
        sim.solid[c] = solidHere ? 1 : 0;
        if (solidHere) {
          if (i < iMin) iMin = i;
          if (i > iMax) iMax = i;
          if (j < jMin) jMin = j;
          if (j > jMax) jMax = j;
        } else {
          fluid.push(c);
        }
      }
    }
    sim.eFluidCells = Int32Array.from(fluid);
    // Extent of the discrete (cell-quantized) body; for the square this is
    // the exact wall location since cell faces coincide with the geometry.
    sim.bodyRect = iMax >= 0
      ? { x0: iMin * dx, x1: (iMax + 1) * dx, y0: jMin * dy, y1: (jMax + 1) * dy }
      : null;
    const far = eFarVars();
    const farfield = (out) => { out[0] = far[0]; out[1] = far[1]; out[2] = far[2]; out[3] = far[3]; };
    sim.eSolver = new DGSolver2D({
      nx: sim.nx,
      ny: sim.ny,
      p: sim.p,
      equation: Euler2D,
      solid: sim.solid,
      params: {
        gamma: sim.gamma,
        alpha: sim.alpha,
        Lx: sim.Lx,
        Ly: sim.Ly,
        farfield,
      },
      initialCondition: (xUnit, yUnit, out) => {
        const x = xUnit * sim.Lx;
        const y = yUnit * sim.Ly;
        if (inside(x, y)) {
          out[0] = far[0]; out[1] = 0; out[2] = 0; out[3] = far[3];
        } else {
          out[0] = far[0]; out[1] = far[1]; out[2] = far[2]; out[3] = far[3];
        }
      },
    });
    sim.eSolver.limiterMode = sim.eulerLimiter;
    sim.eU = new Float64Array(4 * n);
    sim.eSolver.syncMeanAoS(sim.eU);
    sim.eFineK = eulerFineK();
    sim.eFineW = sim.nx * sim.eFineK;
    sim.eFineH = sim.ny * sim.eFineK;
    sim.eFine = new Float32Array(4 * sim.eFineW * sim.eFineH);
    sim.eFineRecycle = null;
    sim.eSolver.sampleFieldAoS(sim.eFine, sim.eFineK);
    sim.eForces = [0, 0];
    sim.limLast = [0, 0];
    sim.eHist = { t: [], cd: [], cl: [] };
    sim.workerPool = createEulerWorkerPool();
    configureActiveCase();
    sim.t = 0;
    sim.dt = 0;
    sim.step = 0;
    sim.bad = false;
    sim.perfWarning = '';
    sim.solverMs = 0;
  }

  function eulerDof() {
    return sim.nx * sim.ny * (sim.p + 1) * (sim.p + 1) * 4;
  }

  function eulerTooLargeForLiveRun() {
    return isEuler() && eulerDof() > 130000;
  }

  function guardEulerRuntime() {
    if (!isEuler()) return;
    if (!sim.workerPool && eulerTooLargeForLiveRun()) {
      sim.perfWarning = 'large DG mesh is running on one UI thread; Web Workers unavailable';
    }
  }

  function computeEulerDt() {
    sim.dt = sim.cfl / Math.max(1e-12, sim.eSolver ? sim.eSolver.maxLambda() : 1.0);
    sim.dt = Math.min(sim.dt, 0.02);
    return sim.dt;
  }

  function eulerStep() {
    if (sim.bad) return;
    const dt = computeEulerDt();
    sim.eSolver.params.alpha = sim.alpha;
    sim.eSolver.params.gamma = sim.gamma;
    sim.eSolver.limiterMode = sim.eulerLimiter;
    const t0 = performance.now();
    sim.eSolver.step(dt);
    sim.solverMs = performance.now() - t0;
    sim.eSolver.syncMeanAoS(sim.eU);
    sim.t += dt;
    sim.step += 1;
    checkEulerFinite();
  }

  function pushForceHistory() {
    if (!sim.eHist) return;
    const qref = Math.max(1e-9, sim.mach * sim.mach * sim.cylR); // ½ρ∞u∞²·(2R)
    const h = sim.eHist;
    h.t.push(sim.t);
    h.cd.push(sim.eForces[0] / qref);
    h.cl.push(sim.eForces[1] / qref);
    if (h.t.length > 900) {
      h.t.splice(0, h.t.length - 900);
      h.cd.splice(0, h.cd.length - 900);
      h.cl.splice(0, h.cl.length - 900);
    }
  }

  function refreshEulerDerived() {
    if (!sim.eSolver || !sim.eFine) return;
    sim.eSolver.sampleFieldAoS(sim.eFine, sim.eFineK);
    sim.eSolver.wallForces(sim.eForces);
    sim.limLast = [sim.eSolver.limPos || 0, sim.eSolver.limTC || 0];
    pushForceHistory();
  }

  async function eulerStepAsync(count = 1) {
    if (sim.bad || sim.eulerStepping) return;
    const generation = sim.eulerGeneration;
    sim.eulerStepping = true;
    try {
      if (sim.workerPool && sim.workerPool.mode === 'owned') {
        const ready = await Promise.race([sim.workerPool.ready, timeout(5000)]);
        if (generation !== sim.eulerGeneration) return;
        if (ready) {
          const msg = await Promise.race([
            sim.workerPool.step(count),
            timeout(10000),
          ]);
          if (generation !== sim.eulerGeneration) return;
          if (msg && msg.eU) {
            sim.eU = new Float64Array(msg.eU);
            if (msg.field) {
              if (sim.eFine && sim.eFine.buffer.byteLength) sim.eFineRecycle = sim.eFine;
              sim.eFine = new Float32Array(msg.field);
            }
            if (msg.forces) sim.eForces = msg.forces;
            if (msg.lim) {
              const denom = Math.max(1, count);
              sim.limLast = [msg.lim[0] / denom, msg.lim[1] / denom];
            }
            sim.t = msg.t;
            sim.step = msg.step;
            sim.dt = msg.dt;
            sim.solverMs = msg.solverMs;
            pushForceHistory();
            sim.stats = computeStats();
            checkEulerFinite();
            return;
          }
        }
        destroyEulerWorkers();
        sim.running = false;
        sim.perfWarning = 'worker stalled; reset required before continuing';
        return;
      }

      for (let stepIndex = 0; stepIndex < count && !sim.bad; stepIndex++) {
        if (generation !== sim.eulerGeneration) return;
        eulerStep();
      }
      refreshEulerDerived();
      sim.stats = computeStats();
    } finally {
      if (generation === sim.eulerGeneration) sim.eulerStepping = false;
    }
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
    for (let ci = 0; ci < fluidCells.length; ci++) {
        const cidx = fluidCells[ci];
        const i = cidx % sim.nx;
        const j = (cidx / sim.nx) | 0;
        const b = 4 * cidx;
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
    const qref = Math.max(1e-9, sim.mach * sim.mach * sim.cylR);
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
      cd: sim.eForces[0] / qref,
      cl: sim.eForces[1] / qref,
    };
  }

  // Builds the scalar field to plot from the subcell-sampled conserved
  // variables in sim.eFine and returns the colour-mapping info.
  function buildEulerDisplayField() {
    const FW = sim.eFineW, FH = sim.eFineH, F = sim.eFine, g = sim.gamma;
    const n = FW * FH;
    let D = sim.scratch.dispField;
    if (!D || D.length !== n) {
      D = new Float32Array(n);
      sim.scratch.dispField = D;
    }
    const disp = sim.display;
    if (disp === 'solid') {
      for (let q = 0; q < n; q++) D[q] = Number.isFinite(F[4 * q]) ? 0 : 1;
      return { kind: 'linear', lo: 0, hi: 1 };
    }
    if (disp === 'schlieren' || disp === 'vorticity') {
      const dxf = sim.Lx / FW, dyf = sim.Ly / FH;
      for (let fy = 0; fy < FH; fy++) {
        for (let fx = 0; fx < FW; fx++) {
          const q = fy * FW + fx;
          const rho = F[4 * q];
          if (!Number.isFinite(rho) || rho <= 0) { D[q] = NaN; continue; }
          const qL = fx > 0 && Number.isFinite(F[4 * (q - 1)]) ? q - 1 : q;
          const qR = fx < FW - 1 && Number.isFinite(F[4 * (q + 1)]) ? q + 1 : q;
          const qB = fy > 0 && Number.isFinite(F[4 * (q - FW)]) ? q - FW : q;
          const qT = fy < FH - 1 && Number.isFinite(F[4 * (q + FW)]) ? q + FW : q;
          const sx = Math.max(1, qR - qL) * dxf;
          const sy = Math.max(1, (qT - qB) / FW) * dyf;
          if (disp === 'schlieren') {
            D[q] = Math.hypot((F[4 * qR] - F[4 * qL]) / sx, (F[4 * qT] - F[4 * qB]) / sy) / rho;
          } else {
            const vR = F[4 * qR + 2] / F[4 * qR], vL = F[4 * qL + 2] / F[4 * qL];
            const uT = F[4 * qT + 1] / F[4 * qT], uB = F[4 * qB + 1] / F[4 * qB];
            D[q] = (vR - vL) / sx - (uT - uB) / sy;
          }
        }
      }
    } else {
      for (let q = 0; q < n; q++) {
        const rho = F[4 * q];
        if (!Number.isFinite(rho) || rho <= 0) { D[q] = NaN; continue; }
        const u = F[4 * q + 1] / rho, v = F[4 * q + 2] / rho;
        const p = Math.max(1e-12, (g - 1) * (F[4 * q + 3] - 0.5 * rho * (u * u + v * v)));
        if (disp === 'rho') D[q] = rho;
        else if (disp === 'pressure') D[q] = p;
        else if (disp === 'speed') D[q] = Math.hypot(u, v);
        else if (disp === 'mach') D[q] = Math.hypot(u, v) / Math.sqrt(g * p / rho);
        else if (disp === 'entropy') D[q] = g * p / Math.pow(rho, g) - 1;
        else D[q] = rho;
      }
    }
    let lo = Infinity, hi = -Infinity;
    for (let q = 0; q < n; q++) {
      const v = D[q];
      if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    if (!(hi >= lo)) { lo = 0; hi = 1; }
    if (disp === 'schlieren') return { kind: 'schlieren', lo: 0, hi: Math.max(1e-9, hi) };
    if (disp === 'vorticity') {
      const s = Math.max(Math.abs(lo), Math.abs(hi), 1e-9);
      return { kind: 'div', lo: -s, hi: s };
    }
    if (disp === 'mach') return { kind: 'linear', lo: 0, hi: Math.max(1.2, hi) };
    if (disp === 'speed') return { kind: 'linear', lo: 0, hi: Math.max(1e-9, hi) };
    return { kind: 'linear', lo, hi: hi > lo ? hi : lo + 1 };
  }

  function eulerColorMapped(v, info) {
    if (!Number.isFinite(v)) return (255 << 24) | (2 << 16) | (2 << 8) | 0;
    let t;
    if (info.kind === 'schlieren') t = 1 - Math.exp(-4.5 * v / info.hi);
    else t = (v - info.lo) / (info.hi - info.lo);
    t = clamp(t, 0, 1);
    if (info.kind === 'div') {
      const a = 2 * (t - 0.5);
      const m = Math.abs(a);
      const r = Math.round(4 + 30 * m);
      const g = a > 0 ? Math.round(14 + 215 * m) : Math.round(10 + 40 * m);
      const b = a > 0 ? Math.round(8 + 40 * m) : Math.round(30 + 215 * m);
      return (255 << 24) | (b << 16) | (g << 8) | r;
    }
    const r = Math.round(2 + 24 * t + 150 * Math.max(0, t - 0.82));
    const g = Math.round(8 + 75 * Math.sqrt(t) + 170 * t);
    const b = Math.round(4 + 26 * t + 26 * Math.max(0, t - 0.72));
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }

  function drawEuler() {
    const W = canvas.width, H = canvas.height;
    const FW = sim.eFineW, FH = sim.eFineH;
    if (!sim.eFine || !FW || !FH) return;
    const info = buildEulerDisplayField();
    if (off.width !== FW || off.height !== FH || !sim.scratch.imageData || sim.scratch.imageData.width !== FW || sim.scratch.imageData.height !== FH) {
      off.width = FW;
      off.height = FH;
      sim.scratch.imageData = offCtx.createImageData(FW, FH);
      sim.scratch.image32 = new Uint32Array(sim.scratch.imageData.data.buffer);
    }
    const D = sim.scratch.dispField;
    const data = sim.scratch.image32;
    for (let py = 0; py < FH; py++) {
      const rowD = (FH - 1 - py) * FW;
      const rowI = py * FW;
      for (let px = 0; px < FW; px++) data[rowI + px] = eulerColorMapped(D[rowD + px], info);
    }
    offCtx.putImageData(sim.scratch.imageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W, H);
    drawEulerOverlay(W, H);
  }

  function drawEulerOverlay(W, H) {
    const X = x => W * x / sim.Lx;
    const Yp = y => H * (1 - y / sim.Ly);
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
    ctx.fillStyle = 'rgba(0,8,2,.95)';
    ctx.strokeStyle = 'rgba(166,255,122,.75)';
    ctx.lineWidth = Math.max(1.5, 1.5 * dpr);
    if (sim.shape === 'square') {
      // The discrete body is exactly this rectangle: cell faces are the wall.
      const r = sim.bodyRect;
      if (r) {
        ctx.beginPath();
        ctx.rect(X(r.x0), Yp(r.y1), X(r.x1) - X(r.x0), Yp(r.y0) - Yp(r.y1));
        ctx.fill();
        ctx.stroke();
      }
    } else if (sim.shape === 'wedge') {
      const L = sim.cylR / Math.tan(WEDGE_HALF_ANGLE);
      const xt = sim.cylX - 0.5 * L;
      ctx.beginPath();
      ctx.moveTo(X(xt), Yp(sim.cylY));
      ctx.lineTo(X(xt + L), Yp(sim.cylY + sim.cylR));
      ctx.lineTo(X(xt + L), Yp(sim.cylY - sim.cylR));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const beta = obliqueShockBeta(sim.mach, WEDGE_HALF_ANGLE, sim.gamma);
      if (Number.isFinite(beta)) {
        const cosB = Math.cos(beta), sinB = Math.sin(beta);
        const tTop = Math.min((sim.Lx - xt) / cosB, (sim.Ly - sim.cylY) / sinB);
        const tBot = Math.min((sim.Lx - xt) / cosB, sim.cylY / sinB);
        ctx.setLineDash([6 * dpr, 5 * dpr]);
        ctx.strokeStyle = 'rgba(69,216,255,.62)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(X(xt), Yp(sim.cylY));
        ctx.lineTo(X(xt + tTop * cosB), Yp(sim.cylY + tTop * sinB));
        ctx.moveTo(X(xt), Yp(sim.cylY));
        ctx.lineTo(X(xt + tBot * cosB), Yp(sim.cylY - tBot * sinB));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(69,216,255,.8)';
        ctx.font = `${11 * dpr}px ui-monospace`;
        ctx.fillText(
          `β=${(beta * 180 / Math.PI).toFixed(1)}° theory`,
          X(xt + 0.55 * tTop * cosB) + 8 * dpr,
          Yp(sim.cylY + 0.55 * tTop * sinB),
        );
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(X(sim.cylX), Yp(sim.cylY), W * sim.cylR / sim.Lx, H * sim.cylR / sim.Ly, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // Freestream arrow.
    ctx.strokeStyle = 'rgba(166,255,122,.45)';
    ctx.fillStyle = 'rgba(166,255,122,.55)';
    ctx.lineWidth = 1.4 * dpr;
    const y = Yp(sim.cylY + 1.35 * sim.cylR);
    ctx.beginPath(); ctx.moveTo(0.07 * W, y); ctx.lineTo(0.19 * W, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.19 * W, y); ctx.lineTo(0.175 * W, y - 5 * dpr); ctx.lineTo(0.175 * W, y + 5 * dpr); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Time history of the pressure force on the cylinder: Cd flattening out
  // shows convergence to steady state, oscillating Cl reveals unsteadiness.
  function drawMiniEuler(W, H) {
    const h = sim.eHist;
    miniCtx.font = `${10 * dpr}px ui-monospace`;
    miniCtx.textAlign = 'left';
    if (!h || h.t.length < 2) {
      miniCtx.fillStyle = 'rgba(189,236,203,.6)';
      miniCtx.fillText('Cd/Cl history appears as the run advances', 8 * dpr, H * 0.5);
      return;
    }
    const n = h.t.length;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < n; k++) {
      const a = h.cd[k], b = h.cl[k];
      if (Number.isFinite(a)) { if (a < lo) lo = a; if (a > hi) hi = a; }
      if (Number.isFinite(b)) { if (b < lo) lo = b; if (b > hi) hi = b; }
    }
    if (!(hi > lo)) { lo -= 0.5; hi += 0.5; }
    const pad = 0.1 * (hi - lo) + 1e-9;
    lo -= pad; hi += pad;
    const yOf = v => H - 14 * dpr - (H - 24 * dpr) * (v - lo) / (hi - lo);
    const xOf = k => (n === 1 ? W : W * k / (n - 1));
    if (lo < 0 && hi > 0) {
      miniCtx.strokeStyle = 'rgba(189,236,203,.25)';
      miniCtx.lineWidth = dpr;
      miniCtx.beginPath();
      miniCtx.moveTo(0, yOf(0));
      miniCtx.lineTo(W, yOf(0));
      miniCtx.stroke();
    }
    const series = [
      [h.cd, 'rgba(166,255,122,.92)'],
      [h.cl, 'rgba(69,216,255,.92)'],
    ];
    for (const [vals, color] of series) {
      miniCtx.strokeStyle = color;
      miniCtx.lineWidth = 1.5 * dpr;
      miniCtx.beginPath();
      for (let k = 0; k < n; k++) {
        const y = yOf(Number.isFinite(vals[k]) ? vals[k] : 0);
        if (k === 0) miniCtx.moveTo(xOf(k), y); else miniCtx.lineTo(xOf(k), y);
      }
      miniCtx.stroke();
    }
    miniCtx.fillStyle = 'rgba(166,255,122,.92)';
    miniCtx.fillText(`Cd ${fmt(h.cd[n - 1], 3)}`, 8 * dpr, 13 * dpr);
    miniCtx.fillStyle = 'rgba(69,216,255,.92)';
    miniCtx.fillText(`Cl ${fmt(h.cl[n - 1], 3)}`, 8 * dpr + 92 * dpr, 13 * dpr);
    miniCtx.fillStyle = 'rgba(189,236,203,.6)';
    miniCtx.fillText(`t ${fmt(h.t[0], 1)} … ${fmt(h.t[n - 1], 1)}`, 8 * dpr, H - 4 * dpr);
  }


  function allocate() {
    applyMeshFromIndex();
    sim.basis = buildBasis(sim.p);
    if (isEuler()) {
      if (!EULER_DEGREES.includes(sim.p)) sim.p = 0;
      sim.basis = buildBasis(sim.p);
      if (!DISPLAYE.includes(sim.display)) sim.display = 'schlieren';
      initEuler();
      sim.stats = computeStats();
      guardEulerRuntime();
      updateFormula();
      syncControlsFromSim();
      updateUI();
      return;
    }
    // Leaving the Euler case: invalidate any in-flight worker replies so the
    // stall watchdog cannot fire against the scalar run later.
    sim.eulerGeneration += 1;
    sim.eulerStepping = false;
    destroyEulerWorkers();
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
    configureActiveCase();
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
      if (!currentDisplayList().includes(sim.display)) sim.display = 'field';
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
    const { np, nm2, volPhi, volDxi, volDeta, volW, invMassUnit, faceL, faceR, faceB, faceT } = sim.basis;
    const nx = sim.nx, ny = sim.ny;
    const hx = 1 / nx, hy = 1 / ny;
    const qn = Q.x.length;
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

        for (let q = 0; q < volW.length; q++) {
          const qx = (q / qn) | 0;
          const qy = q - qx * qn;
          const xi = Q.x[qx];
          const x = (i + 0.5 * (xi + 1)) * hx;
          const eta = Q.x[qy];
          const y = (j + 0.5 * (eta + 1)) * hy;
          const off = q * nm2;
          const u = engineEvalModal(U, base, volPhi, off, nm2);
          const vel = velocity(wrap01(x), wrap01(y));
          const wx = 0.5 * hy * vel[0];
          const wy = 0.5 * hx * vel[1];
          const w = volW[q] * u;
          for (let mode = 0; mode < nm2; mode++) {
            tmp[mode] += w * (wx * volDxi[off + mode] + wy * volDeta[off + mode]);
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

        for (let q = 0; q < qn; q++) {
          const eta = Q.x[q];
          const y = (j + 0.5 * (eta + 1)) * hy;
          const off = q * nm2;
          // Right face, n=(1,0)
          let x = (i + 1) * hx;
          let s = velocity(wrap01(x), wrap01(y))[0];
          let um = engineEvalModal(U, base, faceR, off, nm2);
          let up = engineEvalModal(U, baseR, faceL, off, nm2);
          let fhat = fluxAdvectionNormal(s, um, up);
          let scale = 0.5 * hy * Q.w[q] * fhat;
          for (let mode = 0; mode < nm2; mode++) tmp[mode] -= scale * faceR[off + mode];
          // Left face, n=(-1,0)
          x = i * hx;
          s = -velocity(wrap01(x), wrap01(y))[0];
          um = engineEvalModal(U, base, faceL, off, nm2);
          up = engineEvalModal(U, baseL, faceR, off, nm2);
          fhat = fluxAdvectionNormal(s, um, up);
          scale = 0.5 * hy * Q.w[q] * fhat;
          for (let mode = 0; mode < nm2; mode++) tmp[mode] -= scale * faceL[off + mode];
        }

        for (let q = 0; q < qn; q++) {
          const xi = Q.x[q];
          const x = (i + 0.5 * (xi + 1)) * hx;
          const off = q * nm2;
          // Top face, n=(0,1)
          let y = (j + 1) * hy;
          let s = velocity(wrap01(x), wrap01(y))[1];
          let um = engineEvalModal(U, base, faceT, off, nm2);
          let up = engineEvalModal(U, baseT, faceB, off, nm2);
          let fhat = fluxAdvectionNormal(s, um, up);
          let scale = 0.5 * hx * Q.w[q] * fhat;
          for (let mode = 0; mode < nm2; mode++) tmp[mode] -= scale * faceT[off + mode];
          // Bottom face, n=(0,-1)
          y = j * hy;
          s = -velocity(wrap01(x), wrap01(y))[1];
          um = engineEvalModal(U, base, faceB, off, nm2);
          up = engineEvalModal(U, baseB, faceT, off, nm2);
          fhat = fluxAdvectionNormal(s, um, up);
          scale = 0.5 * hx * Q.w[q] * fhat;
          for (let mode = 0; mode < nm2; mode++) tmp[mode] -= scale * faceB[off + mode];
        }

        const invCellArea = 1 / (hx * hy);
        for (let mode = 0; mode < nm2; mode++) R[base + mode] = tmp[mode] * invMassUnit[mode] * invCellArea;
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
        if (isConstantAdvection()) {
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
      error: isConstantAdvection() ? Math.sqrt(err) : NaN,
      dof: sim.U.length,
    };
  }

  function sample2DDisplay(x, y) {
    const disp = sim.display;
    if (disp === 'mean') return mean2AtXY(sim.U, x, y);
    if (disp === 'error' && isConstantAdvection()) return Math.abs(eval2AtXY(sim.U, x, y) - exact2D(x, y));
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

  function drawBlowupBanner() {
    if (!sim.bad) return;
    const W = canvas.width, H = canvas.height;
    const msg = 'solution diverged — press R to reset (lower CFL, raise α, or strengthen the limiter)';
    ctx.save();
    ctx.font = `${14 * dpr}px ui-monospace`;
    ctx.textAlign = 'center';
    const w = Math.min(W - 20 * dpr, ctx.measureText(msg).width + 44 * dpr);
    const y = H * 0.5;
    ctx.fillStyle = 'rgba(1,4,2,.82)';
    ctx.fillRect(W * 0.5 - w / 2, y - 24 * dpr, w, 42 * dpr);
    ctx.strokeStyle = 'rgba(255,189,100,.85)';
    ctx.lineWidth = dpr;
    ctx.strokeRect(W * 0.5 - w / 2, y - 24 * dpr, w, 42 * dpr);
    ctx.fillStyle = '#ffbd64';
    ctx.fillText(msg, W * 0.5, y + 3 * dpr);
    ctx.restore();
  }

  function draw() {
    drawBackground();
    if (isEuler()) drawEuler();
    else if (is1D()) drawBurgers();
    else draw2D();
    drawMini();
    drawBlowupBanner();
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
    const fluxName = isEuler() ? 'Rusanov' : (sim.alpha === 0 ? 'central' : (sim.alpha === 1 ? (is1D() ? 'rusanov' : 'upwind') : `α=${sim.alpha}`));
    ui.fluxChip.style.display = isEuler() ? 'none' : '';
    ui.fluxChip.innerHTML = `flux <b>${fluxName}</b>`;
    ui.alphaChip.innerHTML = `α <b>${sim.alpha.toFixed(2)}</b>`;
    ui.cflChip.innerHTML = `CFL <b>${sim.cfl.toFixed(2).replace(/^0/, '')}</b>`;
    if (ui.spfChip) ui.spfChip.innerHTML = `spf <b>${sim.stepsPerFrame}</b>`;
    ui.initChip.style.display = isEuler() || sim.caseName === 'diamond' ? 'none' : '';
    ui.initChip.innerHTML = `init <b>${sim.init}</b>`;
    ui.flowChip.style.display = sim.caseName === 'advection' ? '' : 'none';
    ui.flowChip.innerHTML = `vel <b>${sim.flow}</b>`;
    if (ui.shapeChip) ui.shapeChip.innerHTML = `body <b>${sim.shape}</b>`;
    if (ui.machChip) ui.machChip.innerHTML = `M∞ <b>${sim.mach.toFixed(2)}</b>`;
    if (ui.radiusChip) ui.radiusChip.innerHTML = `R <b>${sim.cylR.toFixed(2).replace(/^0/, '')}</b>`;
    if (ui.gammaChip) ui.gammaChip.innerHTML = `γ <b>${sim.gamma.toFixed(2)}</b>`;
    ui.limiterChip.innerHTML = isEuler() ? `stab <b>${sim.eulerLimiter}</b>` : `${is1D() ? 'lim' : 'stab'} <b>${sim.stab}</b>`;
    ui.displayChip.innerHTML = `plot <b>${sim.display}</b>`;
    ui.runChip.textContent = sim.running ? 'Ⅱ' : '▶';

    const st = sim.stats || {};
    ui.okChip.textContent = sim.bad ? 'blown' : (sim.perfWarning ? 'warn' : 'ok');
    ui.okChip.style.color = sim.bad || sim.perfWarning ? 'var(--bad)' : 'var(--hot)';
    ui.stepChip.textContent = `step ${sim.step}`;
    ui.timeChip.textContent = `t ${fmt(sim.t, 3)}`;
    ui.dtChip.textContent = `dt ${fmt(sim.dt, 2)}`;
    ui.massChip.textContent = `mass ${fmt(st.mass, 4)}`;
    if (isEuler()) {
      ui.errChip.textContent = `Mmax ${fmt(st.machMax, 2)}`;
      ui.jumpChip.textContent = `Cd ${fmt(st.cd, 2)}`;
      ui.modeChip.textContent = `lim ${Math.round(sim.limLast[0])}/${Math.round(sim.limLast[1])}`;
    } else {
      ui.errChip.textContent = Number.isFinite(st.error) ? `err ${fmt(st.error, 2)}` : `L2 ${fmt(st.l2, 3)}`;
      ui.jumpChip.textContent = `jump ${fmt(st.jump, 2)}`;
      ui.modeChip.textContent = `mode ${fmt(st.mode, 2)}`;
    }
    ui.dofChip.textContent = `dof ${st.dof || '--'}`;

    ui.hudTitle.textContent = isEuler() ? 'Euler DG diagnostics' : (is1D() ? 'Burgers diagnostics' : 'DG diagnostics');
    ui.hudText.textContent = hudText();
  }

  function eulerBodyDesc() {
    if (sim.shape === 'square') return `square, half-side ${sim.cylR} (walls on cell faces: exact geometry)`;
    if (sim.shape === 'wedge') {
      const beta = obliqueShockBeta(sim.mach, WEDGE_HALF_ANGLE, sim.gamma);
      const state = Number.isFinite(beta)
        ? `attached, theory β=${(beta * 180 / Math.PI).toFixed(1)}°`
        : (sim.mach > 1 ? 'detached (θ>θmax)' : 'subsonic');
      return `wedge θ=10°, half-height ${sim.cylR}; ${state}`;
    }
    return `cylinder R=${sim.cylR} (stair-step wall)`;
  }

  function hudText() {
    const st = sim.stats || {};
    if (isEuler()) {
      return [
        `equation   2D compressible Euler (inviscid)`,
        `scheme     vector modal DG P${sim.p} (P0 = FV), SSP-RK3; Rusanov flux ×α=${sim.alpha}`,
        `limiter    ${sim.eulerLimiter}; cells limited/step pos ${Math.round(sim.limLast[0])}, troubled ${Math.round(sim.limLast[1])}`,
        `boundary   characteristic far-field; slip wall on body`,
        `body       ${eulerBodyDesc()}`,
        `domain     ${sim.Lx}×${sim.Ly}; mesh ${sim.nx}×${sim.ny}; M∞=${sim.mach}; γ=${sim.gamma}`,
        `forces     Cd ${fmt(st.cd, 3)}   Cl ${fmt(st.cl, 3)}   (pressure only)`,
        `ranges     ρ [${fmt(st.rhoMin, 3)}, ${fmt(st.rhoMax, 3)}]   p [${fmt(st.pMin, 3)}, ${fmt(st.pMax, 3)}]`,
        `runtime    ${sim.solverMs ? Math.round(sim.solverMs) + ' ms/step' : '--'}; workers ${sim.workerPool ? sim.workerPool.workers.length : 0}; render ${sim.eFineK}×${sim.eFineK} subcells${sim.perfWarning ? '; ' + sim.perfWarning : ''}`,
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
      `velocity   ${sim.caseName === 'diamond' ? 'constant (1, 0.38)' : (sim.flow === 'uniform' ? 'constant (1, 0.38), exact solution known' : sim.flow + ', divergence-free, periodic')}`,
      `mass       ${fmt(st.mass, 6)}   ${Number.isFinite(st.error) ? 'err ' + fmt(st.error, 3) : 'res ' + fmt(st.residual, 3)}`,
    ].join('\n');
  }

  function updateFormula() {
    if (isEuler()) {
      ui.formulaText.innerHTML =
        `<code>∂t U + ∂x F(U) + ∂y G(U) = 0</code><br>` +
        `<code>U=(ρ,ρu,ρv,E)</code>, <code>p=(γ−1)(E−ρ(u²+v²)/2)</code>.<br>` +
        `Vector DG update: <code>d/dt ∫K U_h φ dx − ∫K F(U_h)·∇φ dx + ∫∂K F̂n φ ds = 0</code>.<br>` +
        `Rusanov normal flux: <code>F̂n=½(Fn_L+Fn_R)−½α a_max(U_R−U_L)</code>.<br>` +
        `Body walls use the exact slip-wall flux <code>Fwall=(0,p nx,p ny,0)</code>: the square is exactly aligned with cell faces, ` +
        `while curved/slanted walls (cylinder, wedge) are stair-step approximations on the Cartesian mesh. ` +
        `Exterior boundaries use Riemann-invariant (characteristic) far-field states, valid for sub- and supersonic M∞.<br>` +
        `Limiting: Zhang–Shu positivity scaling toward the cell mean plus a troubled-cell limiter ` +
        `(minmod-limited linears or flattening to means).`;
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
    frameId += 1;
    const dtWall = Math.max(1e-3, (now - lastFrame) / 1000);
    lastFrame = now;
    fpsEMA = 0.92 * fpsEMA + 0.08 * (1 / dtWall);

    if (sim.running && !sim.bad) {
      const steps = Math.max(1, Math.min(50, sim.stepsPerFrame | 0));
      if (isEuler()) {
        if (!sim.eulerStepping) eulerStepAsync(steps);
      } else {
        for (let k = 0; k < steps && sim.running && !sim.bad; k++) rk3Step();
        if (is1D()) recordHistory(false);
        if ((frameId & 7) === 0) sim.stats = computeStats();
      }
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

  function pauseForControl() {
    if (!sim.running) return;
    sim.running = false;
    updateUI();
  }

  function handleAction(act) {
    if (!act) return;
    if (act === 'about' || act === 'help') {
      const opening = !ui.helpOverlay.classList.contains('open');
      ui.helpOverlay.classList.toggle('open');
      if (opening) {
        sim.resumeAfterHelp = sim.running;
        pauseForControl();
      } else if (sim.resumeAfterHelp && !sim.bad) {
        sim.resumeAfterHelp = false;
        sim.running = true;
        updateUI();
      }
      return;
    }
    if (act === 'run') {
      sim.running = !sim.running;
      if (sim.running) sim.perfWarning = '';
      updateUI();
      return;
    }
    if (act === 'step') {
      if (isEuler()) {
        sim.running = false;
        eulerStepAsync(1).then(() => {
          updateUI();
          draw();
        });
        return;
      }
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
      if (sim.caseName === 'advection') openOptionPanel('flow', ui.flowChip);
      return;
    }
    if (act === 'shape') {
      if (isEuler()) openOptionPanel('shape', ui.shapeChip);
      return;
    }
    if (act === 'limiter') {
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
      if (!DISPLAYE.includes(sim.display)) sim.display = 'schlieren';
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
    if (isEuler()) return DISPLAYE;
    if (is1D()) return DISPLAY1;
    // The pointwise error plot needs the exact solution, i.e. constant advection.
    return isConstantAdvection() ? DISPLAY2 : DISPLAY2.filter(name => name !== 'error');
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
      meta: 'Courant number; dt already includes the 1/(2p+1) degree factor, so ≈1 is the explicit stability edge',
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
      title: 'body half-height R',
      input: 'radiusInput',
      values: [0.05, 0.08, 0.10, 0.12, 0.16],
      meta: 'Frontal height is 2R for every shape, so Cd is comparable; changing R resets the case',
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
        meta: isEuler()
          ? 'Euler uses the vector DG operator; P0 is the finite-volume limit'
          : 'Q0 is the finite-volume limit; higher degree adds modal DG structure',
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
          { value: 'central', label: 'central (α=0)' },
          { value: 'upwind', label: is1D() ? 'rusanov (α=1)' : 'upwind (α=1)' },
          { value: 'llf', label: 'extra (α=1.5)' },
        ],
        meta: 'α scales the jump-dissipation term of the interface flux; α=0 is dispersive and oscillates at fronts',
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
        meta: 'uniform has an exact solution (enables the error plot); swirl and shear are divergence-free variable fields',
      };
    }
    if (key === 'shape') {
      return {
        title: 'body shape',
        value: sim.shape,
        values: [
          { value: 'square', label: 'square' },
          { value: 'wedge', label: 'wedge 10°' },
          { value: 'cylinder', label: 'cylinder' },
        ],
        meta: 'square walls coincide with cell faces (exact geometry); the wedge overlays the θ–β–M oblique-shock angle when attached; the cylinder shows the stair-step approximation. All have frontal height 2R.',
      };
    }
    if (key === 'limiter') {
      if (isEuler()) {
        return {
          title: 'Euler limiting',
          value: sim.eulerLimiter,
          values: [
            { value: 'off', label: 'off' },
            { value: 'pos', label: 'positivity' },
            { value: 'minmod', label: 'pos + minmod' },
            { value: 'flatten', label: 'pos + flatten' },
          ],
          meta: 'Applies live. off: raw DG, expect blow-up at shocks. positivity: Zhang–Shu scaling only. minmod: troubled cells reduced to limited linears. flatten: troubled cells dropped to means (most dissipative).',
        };
      }
      const list = is1D() ? ['off', 'minmod'] : ['off', 'filter'];
      return {
        title: is1D() ? 'limiter' : 'stabilizer',
        value: sim.stab,
        values: list.map(name => ({ value: name, label: name })),
        meta: is1D() ? 'Mean-preserving troubled-cell limiter for Burgers shocks' : 'Modal filter for scalar 2D cases (acts on degree ≥ 2 modes)',
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
    } else if (key === 'shape') {
      if (['square', 'wedge', 'cylinder'].includes(value)) sim.shape = value;
      allocate();
    } else if (key === 'limiter') {
      if (isEuler()) {
        sim.eulerLimiter = EULER_LIMITERS.includes(value) ? value : 'minmod';
        if (sim.eSolver) sim.eSolver.limiterMode = sim.eulerLimiter;
      } else {
        sim.stab = value;
      }
      updateUI();
    } else if (key === 'display') {
      sim.display = value;
      if (sim.display === 'error' && !isConstantAdvection()) sim.display = 'field';
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
    ui.tokenEditorMeta.textContent = 'Euler flow over a body, diamond, smooth advection, or Burgers';
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
    // Controls apply live: structural changes (case, mesh, degree, …) reset
    // the state but keep the run going; tuning knobs (α, CFL, plot, limiter)
    // take effect without interrupting the solver.
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
      else if (ev.key === 'h' || ev.key === 'H' || ev.key === '?') handleAction('help');
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
    sim.running = true;
    requestAnimationFrame((t) => { lastFrame = t; requestAnimationFrame(animationLoop); });
  }

  init();
  }
};

window.DgEulerCylinderLab.init();
