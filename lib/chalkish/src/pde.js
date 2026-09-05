function nonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
}

function buffers(size, ...arrays) {
  if (!Number.isInteger(size) || size < 3) throw new RangeError('at least three samples required');
  for (const array of arrays) {
    if (!(array instanceof Float32Array || array instanceof Float64Array) || array.length !== size) throw new TypeError('matching Float32Array/Float64Array buffers required');
  }
}

// Nodal 1-D fields on [-1, 1]. Neumann data are OUTWARD normal
// derivatives, not physical fluxes: q·n = -D ∂u/∂n.
export function diffuse1D(values, scratch, diffusivity, elapsed, parameters = {}) {
  buffers(values?.length, values, scratch);
  nonnegative(diffusivity, 'diffusivity'); nonnegative(elapsed, 'elapsed time');
  if (!(diffusivity > 0) || !(elapsed > 0)) return;
  const last = values.length - 1;
  const dx = 2 / last;
  const left = parameters.leftBoundary ?? parameters.boundary ?? 'insulated';
  const right = parameters.rightBoundary ?? parameters.boundary ?? 'insulated';
  const periodic = left === 'periodic' && right === 'periodic';
  const steps = Math.max(1, Math.ceil(elapsed * diffusivity / (0.42 * dx * dx)));
  const r = diffusivity * elapsed / steps / (dx * dx);
  for (let step = 0; step < steps; step++) {
    if (left === 'fixed') values[0] = Number(parameters.leftValue ?? parameters.boundaryValue ?? 0);
    if (right === 'fixed') values[last] = Number(parameters.rightValue ?? parameters.boundaryValue ?? 0);
    for (let i = 1; i < last; i++) scratch[i] = values[i] + r * (values[i - 1] - 2 * values[i] + values[i + 1]);
    if (periodic) {
      scratch[0] = values[0] + r * (values[last - 1] - 2 * values[0] + values[1]);
      scratch[last] = scratch[0];
    } else {
      scratch[0] = left === 'fixed' ? values[0]
        : values[0] + 2 * r * (values[1] - values[0] + dx * Number(parameters.leftFlux ?? 0));
      scratch[last] = right === 'fixed' ? values[last]
        : values[last] + 2 * r * (values[last - 1] - values[last] + dx * Number(parameters.rightFlux ?? 0));
    }
    values.set(scratch);
  }
}

// u_tt = c(x)^2 u_xx; displacement and slope are continuous at the
// interface (a string with constant tension, variable linear density).
export function advanceWave1D(model, elapsed) {
  const { value, velocity, scratch, x, parameters } = model;
  const dx = x[1] - x[0];
  const c = Number(parameters.c);
  const ratio = parameters.medium === 'two-regions' ? Number(parameters.c2Ratio) : 1;
  buffers(value.length, value, velocity, scratch, x);
  nonnegative(elapsed, 'elapsed time');
  if (!(c > 0) || !(ratio > 0) || !Number.isFinite(c * ratio)) throw new RangeError('finite positive wave speeds required');
  if (elapsed === 0) return;
  const steps = Math.max(1, Math.ceil(elapsed * c * Math.max(1, ratio) / (0.4 * dx)));
  const dt = elapsed / steps;
  const last = value.length - 1;
  for (let step = 0; step < steps; step++) {
    for (let i = 1; i < last; i++) {
      const speed = x[i] >= 0 ? c * ratio : c;
      velocity[i] += dt * speed * speed * (value[i - 1] - 2 * value[i] + value[i + 1]) / (dx * dx);
      scratch[i] = value[i] + dt * velocity[i];
    }
    if (parameters.boundary === 'fixed') {
      scratch[0] = scratch[last] = velocity[0] = velocity[last] = 0;
    } else if (parameters.boundary === 'absorbing') {
      // Outgoing characteristics: u_t = c u_x on the left, -c u_x on the right.
      scratch[0] = value[0] + c * dt / dx * (value[1] - value[0]);
      scratch[last] = value[last] + c * ratio * dt / dx * (value[last - 1] - value[last]);
      velocity[0] = (scratch[0] - value[0]) / dt;
      velocity[last] = (scratch[last] - value[last]) / dt;
    } else {
      velocity[0] += 2 * dt * c * c * (value[1] - value[0]) / (dx * dx);
      velocity[last] += 2 * dt * (c * ratio) ** 2 * (value[last - 1] - value[last]) / (dx * dx);
      scratch[0] = value[0] + dt * velocity[0];
      scratch[last] = value[last] + dt * velocity[last];
    }
    value.set(scratch);
  }
}

// Exact characteristic flow for dx/dt = a + b x, including b → 0.
export function affineCharacteristic(origin, time, a, b = 0) {
  if (![origin, time, a, b].every(Number.isFinite)) throw new RangeError('finite characteristic data required');
  return b === 0 ? origin + a * time : origin * Math.exp(b * time) + a * Math.expm1(b * time) / b;
}

export function nodalIntegral(values, length = 2) {
  let sum = (values[0] + values.at(-1)) / 2;
  for (let i = 1; i < values.length - 1; i++) sum += values[i];
  return sum * length / (values.length - 1);
}

// Cell-centred scalar transport with limited linear reconstruction and SSP RK2.
// Periodic transport; an optional solid mask instead gives insulating walls.
export function advanceScalar2D(model, elapsed, solid = null) {
  const { columns: nx, rows: ny, scalar: data, parameters: p } = model;
  const dx = 2 / nx, dy = 1.2 / ny, D = Number(p.D ?? 0);
  const n = data.length;
  buffers(nx * ny, data);
  nonnegative(elapsed, 'elapsed time'); nonnegative(D, 'diffusivity');
  const sx = new Float64Array(n), sy = new Float64Array(n), rhs = new Float64Array(n);
  const stage = new Float64Array(n), initial = new Float64Array(n);
  const vx = new Float64Array(n), vy = new Float64Array(n), mask = new Uint8Array(n);
  let rate = 2 * D * (1 / dx ** 2 + 1 / dy ** 2);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x, xx = -1 + (x + 0.5) * dx, yy = -0.6 + (y + 0.5) * dy;
    [vx[i], vy[i]] = model.velocityAt(xx, yy);
    mask[i] = solid?.(xx, yy) ?? false;
    rate = Math.max(rate, Math.abs(vx[i]) / dx + Math.abs(vy[i]) / dy + 2 * D * (1 / dx ** 2 + 1 / dy ** 2));
  }
  const steps = Math.max(1, Math.ceil(elapsed * rate / 0.4)), dt = elapsed / steps;
  const index = (x, y) => ((y + ny) % ny) * nx + (x + nx) % nx;
  const slope = (a, b) => a * b <= 0 ? 0 : Math.sign(a) * Math.min(2 * Math.abs(a), 2 * Math.abs(b), Math.abs(a + b) / 2);
  const evaluate = values => {
    rhs.fill(0);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = index(x, y);
      sx[i] = slope(values[i] - values[index(x - 1, y)], values[index(x + 1, y)] - values[i]);
      sy[i] = slope(values[i] - values[index(x, y - 1)], values[index(x, y + 1)] - values[i]);
    }
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = index(x, y);
      for (let axis = 0; axis < 2; axis++) {
        const j = axis === 0 ? index(x + 1, y) : index(x, y + 1);
        if (mask[i] || mask[j] || (solid && (axis === 0 ? x === nx - 1 : y === ny - 1))) continue;
        const h = axis === 0 ? dx : dy, velocity = axis === 0 ? vx : vy, slopes = axis === 0 ? sx : sy;
        const a = (velocity[i] + velocity[j]) / 2;
        const face = a >= 0 ? values[i] + slopes[i] / 2 : values[j] - slopes[j] / 2;
        const flux = a * face - D * (values[j] - values[i]) / h;
        // u_t + v·grad u, not the compressible density equation.
        rhs[i] -= (flux - a * values[i]) / h;
        rhs[j] += (flux - a * values[j]) / h;
      }
      if (model.id === 'sources') {
        const xx = -1 + (x + 0.5) * dx, yy = -0.6 + (y + 0.5) * dy;
        const pulse = p.sourceMode === 'pulsed' ? Math.max(0, Math.sin(5 * model.time)) : 1;
        rhs[i] += p.sourceStrength * pulse * Math.exp(-((xx - p.sourceX) ** 2 + (yy - p.sourceY) ** 2) / p.sourceRadius ** 2);
      }
    }
  };
  for (let step = 0; step < steps; step++) {
    initial.set(data);
    evaluate(initial);
    for (let i = 0; i < n; i++) stage[i] = initial[i] + dt * rhs[i];
    evaluate(stage);
    for (let i = 0; i < n; i++) data[i] = (initial[i] + stage[i] + dt * rhs[i]) / 2;
  }
}

// Periodic compatible pair: backward divergence, forward pressure gradient.
// Thus div(grad p) is exactly the five-point Laplacian solved by CG.
// Returns the pressure impulse; divide by elapsed time for p/rho.
export function projectPeriodic(u, v, columns, rows, dx, dy, pressure, divergence) {
  buffers(columns * rows, u, v, pressure, divergence);
  if (![columns, rows].every(n => Number.isInteger(n) && n >= 2) || ![dx, dy].every(h => Number.isFinite(h) && h > 0)) throw new RangeError('valid grid sizes and positive spacing required');
  const size = u.length;
  const r = new Float64Array(size), direction = new Float64Array(size), applied = new Float64Array(size);
  const laplace = (values, out) => {
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const i = y * columns + x;
      const l = y * columns + (x + columns - 1) % columns, rr = y * columns + (x + 1) % columns;
      const b = (y + rows - 1) % rows * columns + x, t = (y + 1) % rows * columns + x;
      out[i] = (2 * values[i] - values[l] - values[rr]) / (dx * dx)
        + (2 * values[i] - values[b] - values[t]) / (dy * dy);
    }
  };
  const divergenceOf = () => {
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const i = y * columns + x;
      divergence[i] = (u[i] - u[y * columns + (x + columns - 1) % columns]) / dx
        + (v[i] - v[(y + rows - 1) % rows * columns + x]) / dy;
    }
  };
  divergenceOf();
  const mean = divergence.reduce((a, b) => a + b, 0) / size;
  let norm = 0;
  pressure.fill(0);
  for (let i = 0; i < size; i++) { r[i] = direction[i] = -divergence[i] + mean; norm += r[i] ** 2; }
  const target = Math.max(1e-18, norm * 1e-16);
  for (let iteration = 0; iteration < 300 && norm > target; iteration++) {
    laplace(direction, applied);
    let dot = 0;
    for (let i = 0; i < size; i++) dot += direction[i] * applied[i];
    const alpha = norm / dot;
    let nextNorm = 0;
    for (let i = 0; i < size; i++) {
      pressure[i] += alpha * direction[i];
      r[i] -= alpha * applied[i];
      nextNorm += r[i] ** 2;
    }
    for (let i = 0; i < size; i++) direction[i] = r[i] + nextNorm / norm * direction[i];
    norm = nextNorm;
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const i = y * columns + x;
    u[i] -= (pressure[y * columns + (x + 1) % columns] - pressure[i]) / dx;
    v[i] -= (pressure[(y + 1) % rows * columns + x] - pressure[i]) / dy;
  }
  divergenceOf();
}

// Flat-bed nonlinear shallow water, reflective outer/solid walls.
// Conservative local Lax–Friedrichs face fluxes; h stays wet in these lessons.
export function advanceShallowWater(model, elapsed, solid) {
  const { height: h, u, v, nextHeight: nh, nextU: nu, nextV: nv, columns: nx, rows: ny } = model;
  const dx = 2 / nx, dy = 1.2 / ny, g = Number(model.parameters.gravity);
  buffers(nx * ny, h, u, v, nh, nu, nv);
  nonnegative(elapsed, 'elapsed time');
  if (!Number.isFinite(g) || g <= 0 || !h.every(value => Number.isFinite(value) && value > 0)) throw new RangeError('wet finite depths and positive gravity required');
  const mask = new Uint8Array(h.length);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) mask[y * nx + x] = solid(-1 + (x + 0.5) * dx, -0.6 + (y + 0.5) * dy);
  let remaining = elapsed;
  while (remaining > 1e-12) {
    let frequency = 0;
    for (let i = 0; i < h.length; i++) frequency = Math.max(frequency, (Math.abs(u[i]) + Math.sqrt(g * h[i])) / dx + (Math.abs(v[i]) + Math.sqrt(g * h[i])) / dy);
    const dt = Math.min(remaining, 0.4 / frequency);
    nh.set(h);
    for (let i = 0; i < h.length; i++) { nu[i] = h[i] * u[i]; nv[i] = h[i] * v[i]; }
    for (let axis = 0; axis < 2; axis++) {
      const count = axis === 0 ? nx : ny, lines = axis === 0 ? ny : nx;
      for (let line = 0; line < lines; line++) for (let face = 0; face <= count; face++) {
        const index = k => axis === 0 ? line * nx + k : k * nx + line;
        const il = face > 0 ? index(face - 1) : -1, ir = face < count ? index(face) : -1;
        const wallL = il < 0 || mask[il], wallR = ir < 0 || mask[ir];
        if (wallL && wallR) continue;
        const l = wallL ? ir : il, r = wallR ? il : ir;
        const hl = h[l], hr = h[r];
        const ul = u[l] * (wallL && axis === 0 ? -1 : 1), ur = u[r] * (wallR && axis === 0 ? -1 : 1);
        const vl = v[l] * (wallL && axis === 1 ? -1 : 1), vr = v[r] * (wallR && axis === 1 ? -1 : 1);
        const al = axis === 0 ? ul : vl, ar = axis === 0 ? ur : vr;
        const speed = Math.max(Math.abs(al) + Math.sqrt(g * hl), Math.abs(ar) + Math.sqrt(g * hr));
        const mass = 0.5 * (hl * al + hr * ar - speed * (hr - hl));
        const mx = 0.5 * (hl * al * ul + hr * ar * ur + (axis === 0 ? 0.5 * g * (hl * hl + hr * hr) : 0) - speed * (hr * ur - hl * ul));
        const my = 0.5 * (hl * al * vl + hr * ar * vr + (axis === 1 ? 0.5 * g * (hl * hl + hr * hr) : 0) - speed * (hr * vr - hl * vl));
        const scale = dt / (axis === 0 ? dx : dy);
        if (!wallL) { nh[il] -= scale * mass; nu[il] -= scale * mx; nv[il] -= scale * my; }
        if (!wallR) { nh[ir] += scale * mass; nu[ir] += scale * mx; nv[ir] += scale * my; }
      }
    }
    for (let i = 0; i < h.length; i++) {
      if (mask[i]) { u[i] = v[i] = 0; continue; }
      h[i] = nh[i]; u[i] = nu[i] / h[i]; v[i] = nv[i] / h[i];
    }
    remaining -= dt;
  }
}
