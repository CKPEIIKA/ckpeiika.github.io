importScripts('./dg-engine.js');

let solver = null;
let meanState = null;
let simTime = 0;
let simStep = 0;
let fineK = 1;
const forces = new Float64Array(2);

function farVars(mach, gamma) {
  const rho = 1.0;
  const p = 1.0 / gamma;
  const u = mach;
  const v = 0.0;
  const E = p / (gamma - 1) + 0.5 * rho * (u * u + v * v);
  return [rho, rho * u, rho * v, E];
}

function initFullSolver(msg) {
  const far = farVars(msg.mach, msg.gamma);
  const n = msg.nx * msg.ny;
  const solid = new Uint8Array(n);
  const dx = msg.Lx / msg.nx;
  const dy = msg.Ly / msg.ny;
  const inside = (x, y) => self.DgEngine.insideShape(msg.shape || 'cylinder', x, y, msg.cylX, msg.cylY, msg.cylR);
  for (let j = 0; j < msg.ny; j += 1) {
    const y = (j + 0.5) * dy;
    for (let i = 0; i < msg.nx; i += 1) {
      const x = (i + 0.5) * dx;
      solid[j * msg.nx + i] = inside(x, y) ? 1 : 0;
    }
  }
  solver = new self.DgEngine.DGSolver2D({
    nx: msg.nx,
    ny: msg.ny,
    p: msg.p,
    equation: self.DgEngine.Euler2D,
    solid,
    params: {
      gamma: msg.gamma,
      alpha: msg.alpha,
      Lx: msg.Lx,
      Ly: msg.Ly,
      farfield(out) {
        out[0] = far[0];
        out[1] = far[1];
        out[2] = far[2];
        out[3] = far[3];
      },
    },
    initialCondition(xUnit, yUnit, out) {
      const x = xUnit * msg.Lx;
      const y = yUnit * msg.Ly;
      if (inside(x, y)) {
        out[0] = far[0]; out[1] = 0; out[2] = 0; out[3] = far[3];
      } else {
        out[0] = far[0]; out[1] = far[1]; out[2] = far[2]; out[3] = far[3];
      }
    },
  });
  solver.limiterMode = msg.limiter || 'minmod';
  fineK = Math.max(1, msg.fineK | 0);
  meanState = new Float64Array(4 * n);
  solver.syncMeanAoS(meanState);
  simTime = 0;
  simStep = 0;
  const out = meanState.slice();
  self.postMessage({
    type: 'readyFull',
    eU: out.buffer,
  }, [out.buffer]);
}

function stepFullSolver(msg) {
  solver.params.alpha = msg.alpha;
  solver.params.gamma = msg.gamma;
  if (msg.limiter) solver.limiterMode = msg.limiter;
  let dt = 0;
  let limPos = 0;
  let limTC = 0;
  const t0 = performance.now();
  const count = Math.max(1, msg.count | 0);
  for (let k = 0; k < count; k += 1) {
    dt = msg.cfl / Math.max(1e-12, solver.maxLambda());
    dt = Math.min(dt, 0.02);
    solver.step(dt);
    limPos += solver.limPos;
    limTC += solver.limTC;
    simTime += dt;
    simStep += 1;
  }
  solver.syncMeanAoS(meanState);
  const out = meanState.slice();
  const fineLen = 4 * solver.nx * fineK * solver.ny * fineK;
  // The main thread sends back the previous frame's buffer so steady-state
  // runs do not churn one multi-MB allocation per frame.
  const field = msg.recycle && msg.recycle.byteLength === 4 * fineLen
    ? new Float32Array(msg.recycle)
    : new Float32Array(fineLen);
  solver.sampleFieldAoS(field, fineK);
  solver.wallForces(forces);
  self.postMessage({
    type: 'stepped',
    seq: msg.seq,
    eU: out.buffer,
    field: field.buffer,
    k: fineK,
    forces: [forces[0], forces[1]],
    lim: [limPos, limTC],
    t: simTime,
    step: simStep,
    dt,
    solverMs: (performance.now() - t0) / count,
  }, [out.buffer, field.buffer]);
}

self.onmessage = (event) => {
  const msg = event.data || {};
  if (msg.type === 'initFull') {
    initFullSolver(msg);
    return;
  }

  if (msg.type === 'stepFull') {
    stepFullSolver(msg);
    return;
  }
};
