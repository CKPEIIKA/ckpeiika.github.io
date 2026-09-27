// Numerical kernels: pure functions of numbers and arrays. No DOM, no drawing, no language.
// Keep every formula here so tests can check it without a browser (see test/demo-consistency.test.js).

export const TAU = 2 * Math.PI;

export const FUNCTIONS = Object.freeze({
  sin: Object.freeze({ f: (x) => Math.sin(x), df: (x) => Math.cos(x) }),
  gauss: Object.freeze({ f: (x) => Math.exp(-((x - Math.PI) ** 2)), df: (x) => -2 * (x - Math.PI) * Math.exp(-((x - Math.PI) ** 2)) }),
});

export function centralDifference(f, x, h) {
  return (f(x + h) - f(x - h)) / (2 * h);
}

// Smooth periodic pulse on [0, 1).
export function pulse(x) {
  const d = x - Math.round(x - 0.3) - 0.3;
  return Math.exp(-((d / 0.08) ** 2));
}

// One upwind step for u_t + u_x = 0 on a periodic grid; courant = dt / h.
export function upwindStep(u, courant) {
  const next = new Float64Array(u.length);
  for (let i = 0; i < u.length; i += 1) {
    const left = u[(i - 1 + u.length) % u.length];
    next[i] = u[i] - courant * (u[i] - left);
  }
  return next;
}

export function l1Distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}
