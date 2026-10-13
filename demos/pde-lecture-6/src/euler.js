/**
 * Ideal-gas Euler laboratory. Dependency-free, 64-bit JavaScript arithmetic.
 * Conservative state: [rho, rho*u, rho*v, E]; flux normal is the x direction.
 * All finite-volume updates use one shared flux per face. No density/pressure
 * clipping, artificial viscosity, or undocumented flux substitutions are used.
 *
 * Method definitions: Roe (1981); Harten quadratic acoustic entropy smoothing;
 * HLL with Davis endpoint bounds; HLLE with Einfeldt/Roe bounds; HLLC with
 * Davis endpoint bounds; original van Leer and Steger–Warming FVS;
 * original Liou–Steffen AUSM (side-local sound speeds), and Liou AUSM+-up.
 * Primary references are listed in the lecture page's source catalog.
 */

export const METHODS = [
  { id: 'roe', name: 'Roe', color: '#ffba72', family: 'FDS', short: 'Linearized four-wave fan', detail: 'Unmodified |lambda|; neither entropy correction nor positivity repair.' },
  { id: 'roe-entropy', name: 'Roe + entropy fix', color: '#f28f9d', family: 'FDS', short: 'Harten quadratic acoustic smoothing', detail: 'Acoustic eigenvalues only: psi(lambda)=(lambda²+delta²)/(2 delta) for |lambda|<delta, delta=epsilon*aRoe. Contact and shear use |uRoe|.' },
  { id: 'hll', name: 'HLL (Davis)', color: '#f3db75', family: 'HLL', short: 'Two waves; endpoint speed bounds', detail: 'SL=min(uL-aL,uR-aR), SR=max(uL+aL,uR+aR). The contact wave is not restored.' },
  { id: 'hllc', name: 'HLLC', color: '#a6df99', family: 'HLL', short: 'Restored contact and shear', detail: 'Davis outer speeds and the HLLC middle wave. No shock sensor or positivity fallback is built into the flux.' },
  { id: 'hlle', name: 'HLLE (Einfeldt)', color: '#80d7ce', family: 'HLL', short: 'Two waves; Einfeldt/Roe speed bounds', detail: 'SL=min(uL-aL,uRoe-aRoe), SR=max(uR+aR,uRoe+aRoe), with upwind branching.' },
  { id: 'vanleer', name: 'van Leer FVS', color: '#87c5f7', family: 'FVS', short: 'Smooth polynomial flux splitting', detail: 'Original van Leer subsonic mass, momentum and energy polynomials; this is not a slope limiter or the Hänel energy variant.' },
  { id: 'steger-warming', name: 'Steger–Warming', color: '#b3a3ef', family: 'FVS', short: 'Eigenvalue flux-vector splitting', detail: 'F±=R Lambda± R⁻¹ U with unsmoothed lambda±=(lambda±|lambda|)/2, applied separately on each side.' },
  { id: 'ausm', name: 'AUSM', color: '#e8a8da', family: 'AUSM', short: 'Original advection–pressure splitting', detail: 'Liou–Steffen original AUSM: M2± use each side’s own sound speed; the donor vector is rho*a*[1,u,v,H]; cubic pressure splitting.' },
  { id: 'ausm-up', name: 'AUSM⁺-up', color: '#d0bf9d', family: 'AUSM', short: 'Liou all-speed pressure–velocity coupling', detail: 'M4/P5 splitting, critical interface sound speed, Kp=1/4, Ku=3/4, beta=1/8, sigma=1. The reference Mach cutoff controls fa.' }
];

const METHOD_IDS = new Set(METHODS.map(m => m.id));
const ZERO = () => [0, 0, 0, 0];

export function primitiveToConservative(W, gamma = 1.4) {
  const { rho, u = 0, v = 0, p } = W;
  return [rho, rho * u, rho * v, p / (gamma - 1) + 0.5 * rho * (u * u + v * v)];
}

export function conservativeToPrimitive(U, gamma = 1.4) {
  const rho = U[0], u = U[1] / rho, v = U[2] / rho;
  const p = (gamma - 1) * (U[3] - 0.5 * (U[1] * u + U[2] * v));
  return { rho, u, v, p };
}

function gas(U, gamma) {
  const W = conservativeToPrimitive(U, gamma);
  W.a = Math.sqrt(gamma * W.p / W.rho);
  W.H = (U[3] + W.p) / W.rho;
  return W;
}

export function physicalFlux(U, gamma = 1.4) {
  const W = conservativeToPrimitive(U, gamma);
  return [U[1], U[1] * W.u + W.p, U[1] * W.v, W.u * (U[3] + W.p)];
}

function roeAverage(L, R, gamma) {
  const l = Math.sqrt(L.rho), r = Math.sqrt(R.rho), inv = 1 / (l + r);
  const u = (l * L.u + r * R.u) * inv;
  const v = (l * L.v + r * R.v) * inv;
  const H = (l * L.H + r * R.H) * inv;
  const a = Math.sqrt((gamma - 1) * (H - 0.5 * (u * u + v * v)));
  return { u, v, H, a, rho: l * r };
}

export function hartenAbsolute(lambda, delta) {
  const a = Math.abs(lambda);
  return delta > 0 && a < delta ? (lambda * lambda + delta * delta) / (2 * delta) : a;
}

function roeFlux(UL, UR, L, R, gamma, entropyFix) {
  const B = roeAverage(L, R, gamma), { u, v, H, a } = B;
  const dp = R.p - L.p, du = R.u - L.u, dv = R.v - L.v;
  const am = (dp - B.rho * a * du) / (2 * a * a);
  const ap = (dp + B.rho * a * du) / (2 * a * a);
  const ac = R.rho - L.rho - dp / (a * a), as = B.rho * dv;
  const delta = entropyFix * a;
  const lm = hartenAbsolute(u - a, delta), lp = hartenAbsolute(u + a, delta), lc = Math.abs(u);
  const rm = [1, u - a, v, H - u * a];
  const rp = [1, u + a, v, H + u * a];
  const rc = [1, u, v, 0.5 * (u * u + v * v)];
  const rs = [0, 0, 1, v];
  const FL = physicalFlux(UL, gamma), FR = physicalFlux(UR, gamma);
  return FL.map((f, k) => 0.5 * (f + FR[k] - lm * am * rm[k] - lp * ap * rp[k] - lc * (ac * rc[k] + as * rs[k])));
}

function waveBounds(L, R, gamma, einfeldt = false) {
  if (!einfeldt) return [Math.min(L.u - L.a, R.u - R.a), Math.max(L.u + L.a, R.u + R.a)];
  const B = roeAverage(L, R, gamma);
  return [Math.min(L.u - L.a, B.u - B.a), Math.max(R.u + R.a, B.u + B.a)];
}

/** Disclosed outer-wave estimates used by HLL, HLLE and HLLC. */
export function estimateWaveSpeeds(method, UL, UR, gamma = 1.4) {
  const L = gas(UL, gamma), R = gas(UR, gamma);
  const [SL, SR] = waveBounds(L, R, gamma, method === 'hlle');
  return { SL, SR, roe: roeAverage(L, R, gamma) };
}

function hllFlux(UL, UR, L, R, gamma, einfeldt) {
  const [SL, SR] = waveBounds(L, R, gamma, einfeldt);
  const FL = physicalFlux(UL, gamma), FR = physicalFlux(UR, gamma);
  if (SL >= 0) return FL;
  if (SR <= 0) return FR;
  return FL.map((f, k) => (SR * f - SL * FR[k] + SL * SR * (UR[k] - UL[k])) / (SR - SL));
}

function hllcFlux(UL, UR, L, R, gamma) {
  const [SL, SR] = waveBounds(L, R, gamma);
  const FL = physicalFlux(UL, gamma), FR = physicalFlux(UR, gamma);
  if (SL >= 0) return FL;
  if (SR <= 0) return FR;
  const qL = L.rho * (SL - L.u), qR = R.rho * (SR - R.u);
  const SM = (R.p - L.p + qL * L.u - qR * R.u) / (qL - qR);
  const W = SM >= 0 ? L : R, U = SM >= 0 ? UL : UR;
  const S = SM >= 0 ? SL : SR, F = SM >= 0 ? FL : FR;
  const rho = W.rho * (S - W.u) / (S - SM);
  const Es = rho * (U[3] / W.rho + (SM - W.u) * (SM + W.p / (W.rho * (S - W.u))));
  const star = [rho, rho * SM, rho * W.v, Es];
  return F.map((f, k) => f + S * (star[k] - U[k]));
}

function vanLeerSplit(U, W, gamma, s) {
  const M = W.u / W.a;
  if (Math.abs(M) >= 1) return s * W.u > 0 ? physicalFlux(U, gamma) : ZERO();
  const m = s * 0.25 * W.rho * W.a * (M + s) ** 2;
  const z = (gamma - 1) * W.u + s * 2 * W.a;
  return [m, m * z / gamma, m * W.v, m * (z * z / (2 * (gamma * gamma - 1)) + 0.5 * W.v * W.v)];
}

function stegerWarmingSplit(W, gamma, s) {
  const { rho, u, v, a, H } = W;
  const split = x => 0.5 * (x + s * Math.abs(x));
  const lm = split(u - a), lc = split(u), lp = split(u + a);
  const rm = [1, u - a, v, H - u * a], rp = [1, u + a, v, H + u * a];
  const rc = [1, u, v, 0.5 * (u * u + v * v)], c = rho / (2 * gamma);
  return rm.map((r, k) => c * (lm * r + 2 * (gamma - 1) * lc * rc[k] + lp * rp[k]));
}

/** Single-state FVS contribution; sign is +1 or -1. */
export function splitFlux(method, U, sign, gamma = 1.4) {
  if (sign !== 1 && sign !== -1) throw new RangeError('Flux split sign must be +1 or -1.');
  const W = gas(U, gamma);
  if (method === 'vanleer') return vanLeerSplit(U, W, gamma, sign);
  if (method === 'steger-warming') return stegerWarmingSplit(W, gamma, sign);
  throw new Error('Single-state flux splitting is defined here for vanleer and steger-warming.');
}

function mach2(M, s) {
  return Math.abs(M) >= 1 ? 0.5 * (M + s * Math.abs(M)) : s * 0.25 * (M + s) ** 2;
}

function pressure3(M, s) {
  return Math.abs(M) >= 1 ? 0.5 * (1 + s * Math.sign(M)) : 0.25 * (M + s) ** 2 * (2 - s * M);
}

function mach4(M, s) {
  if (Math.abs(M) >= 1) return mach2(M, s);
  return mach2(M, s) * (1 - s * 2 * mach2(M, -s)); // beta=1/8
}

function pressure5(M, s, alpha) {
  if (Math.abs(M) >= 1) return pressure3(M, s);
  return pressure3(M, s) + s * alpha * M * (M * M - 1) ** 2;
}

function ausmFlux(L, R) {
  const ML = L.u / L.a, MR = R.u / R.a;
  const Mf = mach2(ML, 1) + mach2(MR, -1), donor = Mf >= 0 ? L : R;
  const mass = Mf * donor.rho * donor.a;
  const pressure = pressure3(ML, 1) * L.p + pressure3(MR, -1) * R.p;
  return [mass, mass * donor.u + pressure, mass * donor.v, mass * donor.H];
}

function ausmUpFlux(L, R, gamma, cutoff) {
  // Liou 2006: critical sound speed and one common interfacial sound speed.
  const starL2 = 2 * (gamma - 1) * L.H / (gamma + 1);
  const starR2 = 2 * (gamma - 1) * R.H / (gamma + 1);
  const a = Math.min(starL2 / Math.max(Math.sqrt(starL2), L.u), starR2 / Math.max(Math.sqrt(starR2), -R.u));
  const ML = L.u / a, MR = R.u / a, mbar2 = 0.5 * (ML * ML + MR * MR);
  const m0 = Math.sqrt(Math.min(1, Math.max(mbar2, cutoff * cutoff)));
  const fa = m0 * (2 - m0), alpha = 3 / 16 * (-4 + 5 * fa * fa);
  const Pp = pressure5(ML, 1, alpha), Pm = pressure5(MR, -1, alpha);
  const rho = 0.5 * (L.rho + R.rho);
  const Mp = -(0.25 / fa) * Math.max(1 - mbar2, 0) * (R.p - L.p) / (rho * a * a);
  const Mf = mach4(ML, 1) + mach4(MR, -1) + Mp;
  const donor = Mf >= 0 ? L : R, mass = a * Mf * donor.rho;
  const Pu = -0.75 * Pp * Pm * (L.rho + R.rho) * fa * a * (R.u - L.u);
  const pressure = Pp * L.p + Pm * R.p + Pu;
  return [mass, mass * donor.u + pressure, mass * donor.v, mass * donor.H];
}

export function numericalFlux(method, UL, UR, gamma = 1.4, options = {}) {
  const L = gas(UL, gamma), R = gas(UR, gamma);
  switch (method) {
    case 'roe': return roeFlux(UL, UR, L, R, gamma, 0);
    case 'roe-entropy': return roeFlux(UL, UR, L, R, gamma, Math.max(0, options.entropyFix ?? 0.1));
    case 'hll': return hllFlux(UL, UR, L, R, gamma, false);
    case 'hlle': return hllFlux(UL, UR, L, R, gamma, true);
    case 'hllc': return hllcFlux(UL, UR, L, R, gamma);
    case 'vanleer': {
      const P = vanLeerSplit(UL, L, gamma, 1), M = vanLeerSplit(UR, R, gamma, -1);
      return P.map((p, k) => p + M[k]);
    }
    case 'steger-warming': {
      const P = stegerWarmingSplit(L, gamma, 1), M = stegerWarmingSplit(R, gamma, -1);
      return P.map((p, k) => p + M[k]);
    }
    case 'ausm': return ausmFlux(L, R);
    case 'ausm-up': {
      const cutoff = options.lowMachCutoff ?? 0.01;
      if (!(cutoff > 0 && cutoff <= 1)) throw new RangeError('AUSM+-up Mach cutoff must satisfy 0 < M_ref <= 1.');
      return ausmUpFlux(L, R, gamma, cutoff);
    }
    default: throw new Error(`Unknown numerical flux: ${method}`);
  }
}

const W = (rho, u, p, v = 0) => ({ rho, u, v, p });

function reversedShock(gamma = 1.4) {
  const M = 1.5, upstream = W(1, M * Math.sqrt(gamma), 1);
  const ratio = (gamma + 1) * M * M / ((gamma - 1) * M * M + 2);
  const downstream = W(ratio, upstream.u / ratio, (2 * gamma * M * M - (gamma - 1)) / (gamma + 1));
  return { left: downstream, right: upstream };
}

function riemannCase(spec) {
  const item = { xMin: 0, xMax: 1, x0: 0.5, boundary: 'outflow', recommendedCfl: 0.45,
    recommendedMachCutoff: 1, reference: 'Exact Euler Riemann solution', ...spec };
  item.initial = (x, gamma = 1.4) => {
    const states = item.states ? item.states(gamma) : item;
    return { ...(x < item.x0 ? states.left : states.right) };
  };
  return item;
}

export const CASES = [
  riemannCase({ id: 'sod', name: 'Sod shock tube', left: W(1, 0, 1), right: W(0.125, 0, 0.1), tEnd: 0.2, note: 'Rarefaction, contact, and shock in one test.' }),
  riemannCase({ id: 'contact', name: 'Stationary contact', left: W(1, 0, 1), right: W(0.125, 0, 1), tEnd: 0.25, note: 'A density jump at equal pressure and velocity; exact solution is stationary.' }),
  riemannCase({ id: 'moving-contact', name: 'Moving contact', left: W(1, 0.8, 1), right: W(0.125, 0.8, 1), x0: 0.3, tEnd: 0.3, note: 'Contact resolution does not eliminate first-order advection diffusion.' }),
  riemannCase({ id: 'transonic', name: 'Transonic expansion', ...reversedShock(), states: reversedShock, tEnd: 0.3, note: 'Reversed M=1.5 stationary shock: equal physical fluxes but the expansion jump violates entropy. Unmodified Roe can lock it.' }),
  riemannCase({ id: 'double-rarefaction', name: 'Double rarefaction', left: W(1, -2, 0.4), right: W(1, 2, 0.4), tEnd: 0.15, note: 'Einfeldt 1–2–0–3 near-vacuum test. The exact pressure remains positive; raw fluxes may not.' }),
  {
    id: 'shu-osher', name: 'Shu–Osher interaction', xMin: -5, xMax: 5, x0: -4, tEnd: 1.8,
    left: W(3.857143, 2.629369, 10.333333), right: W(1, 0, 1), boundary: 'outflow',
    recommendedCfl: 0.45, recommendedMachCutoff: 1,
    reference: null, note: 'A Mach-3 shock meets a sinusoidal entropy wave. No analytic post-interaction reference is claimed.',
    initial(x) { return x < -4 ? W(3.857143, 2.629369, 10.333333) : W(1 + 0.2 * Math.sin(5 * x), 0, 1); }
  },
  riemannCase({ id: 'strong-shock', name: 'Strong pressure jump', left: W(1, 0, 1000), right: W(1, 0, 0.01), tEnd: 0.012, note: 'A 100 000:1 pressure ratio; shock accuracy and robustness are separate questions.' }),
  {
    id: 'low-mach', name: 'Low-Mach entropy wave', xMin: 0, xMax: 1, x0: 0.5, tEnd: 5,
    left: W(1, 0.02, 1 / 1.4), right: W(1, 0.02, 1 / 1.4), boundary: 'periodic',
    recommendedCfl: 0.05, recommendedMachCutoff: 0.01,
    reference: 'Exact periodic entropy-wave advection',
    note: 'rho=1+0.2 sin(2 pi x), u=0.02, p=1/gamma. Tests slow entropy transport, not full incompressible pressure accuracy.',
    initial(x, gamma = 1.4) { return W(1 + 0.2 * Math.sin(2 * Math.PI * x), 0.02, 1 / gamma); }
  }
];

const CASE_MAP = new Map(CASES.map(c => [c.id, c]));

function pressureFunction(p, state, gamma) {
  const a = Math.sqrt(gamma * state.p / state.rho);
  if (p > state.p) {
    const A = 2 / ((gamma + 1) * state.rho), B = (gamma - 1) * state.p / (gamma + 1);
    const root = Math.sqrt(A / (p + B));
    return { f: (p - state.p) * root, df: root * (1 - 0.5 * (p - state.p) / (p + B)) };
  }
  const exponent = (gamma - 1) / (2 * gamma), ratio = p / state.p;
  return { f: 2 * a / (gamma - 1) * (ratio ** exponent - 1), df: ratio ** (-(gamma + 1) / (2 * gamma)) / (state.rho * a) };
}

/** Exact entropy Riemann solution; sample argument is xi=(x-x0)/t. */
export function exactRiemann(left, right, gamma = 1.4) {
  const L = { v: 0, ...left }, R = { v: 0, ...right };
  if (!(gamma > 1 && L.rho > 0 && R.rho > 0 && L.p > 0 && R.p > 0)) throw new RangeError('Exact Riemann data must have positive density and pressure.');
  const aL = Math.sqrt(gamma * L.p / L.rho), aR = Math.sqrt(gamma * R.p / R.rho);
  const gm = gamma - 1, gp = gamma + 1;
  const vacuum = R.u - L.u >= 2 * (aL + aR) / gm;
  const leftFan = xi => {
    const u = 2 / gp * (aL + 0.5 * gm * L.u + xi);
    const a = 2 / gp * (aL + 0.5 * gm * (L.u - xi));
    return W(L.rho * (a / aL) ** (2 / gm), u, L.p * (a / aL) ** (2 * gamma / gm), L.v);
  };
  const rightFan = xi => {
    const u = 2 / gp * (-aR + 0.5 * gm * R.u + xi);
    const a = 2 / gp * (aR - 0.5 * gm * (R.u - xi));
    return W(R.rho * (a / aR) ** (2 / gm), u, R.p * (a / aR) ** (2 * gamma / gm), R.v);
  };
  if (vacuum) {
    const tailL = L.u + 2 * aL / gm, tailR = R.u - 2 * aR / gm;
    return { vacuum: true, pStar: 0, uStar: 0.5 * (tailL + tailR),
      sample(xi) {
        if (xi <= L.u - aL) return { ...L };
        if (xi < tailL) return leftFan(xi);
        if (xi <= tailR) return W(0, xi, 0);
        if (xi < R.u + aR) return rightFan(xi);
        return { ...R };
      }
    };
  }
  const f = p => pressureFunction(p, L, gamma).f + pressureFunction(p, R, gamma).f + R.u - L.u;
  let lo = 0, hi = Math.max(L.p, R.p);
  while (f(hi) < 0) hi *= 2;
  // Bracketed Newton: even extreme rarefactions never use a negative pressure.
  let p = Math.min(hi, Math.max(hi * 1e-12, 0.5 * (L.p + R.p) - 0.125 * (R.u - L.u) * (L.rho + R.rho) * (aL + aR)));
  for (let iter = 0; iter < 180; iter++) {
    const l = pressureFunction(p, L, gamma), r = pressureFunction(p, R, gamma), value = l.f + r.f + R.u - L.u;
    if (value > 0) hi = p; else lo = p;
    if (Math.abs(value) < 2e-13 * (aL + aR + Math.abs(L.u) + Math.abs(R.u))) break;
    let next = p - value / (l.df + r.df);
    if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
    if (Math.abs(next - p) < 2e-14 * Math.max(p, 1e-100)) { p = next; break; }
    p = next;
  }
  const u = 0.5 * (L.u + R.u + pressureFunction(p, R, gamma).f - pressureFunction(p, L, gamma).f);
  const ratio = gm / gp;
  const rhoStar = S => p > S.p ? S.rho * (p / S.p + ratio) / (ratio * p / S.p + 1) : S.rho * (p / S.p) ** (1 / gamma);
  const rhoL = rhoStar(L), rhoR = rhoStar(R);
  const aStarL = aL * (p / L.p) ** (gm / (2 * gamma)), aStarR = aR * (p / R.p) ** (gm / (2 * gamma));
  const shockL = L.u - aL * Math.sqrt(gp / (2 * gamma) * p / L.p + gm / (2 * gamma));
  const shockR = R.u + aR * Math.sqrt(gp / (2 * gamma) * p / R.p + gm / (2 * gamma));
  return { vacuum: false, pStar: p, uStar: u, rhoStarLeft: rhoL, rhoStarRight: rhoR,
    sample(xi) {
      if (xi <= u) {
        if (p > L.p) return xi <= shockL ? { ...L } : W(rhoL, u, p, L.v);
        if (xi <= L.u - aL) return { ...L };
        if (xi >= u - aStarL) return W(rhoL, u, p, L.v);
        return leftFan(xi);
      }
      if (p > R.p) return xi >= shockR ? { ...R } : W(rhoR, u, p, R.v);
      if (xi >= R.u + aR) return { ...R };
      if (xi <= u + aStarR) return W(rhoR, u, p, R.v);
      return rightFan(xi);
    }
  };
}

export function exactProfile(caseId, xArray, t, gamma = 1.4) {
  const c = typeof caseId === 'string' ? CASE_MAP.get(caseId) : caseId;
  if (!c) throw new Error(`Unknown case: ${caseId}`);
  if (t <= 0) return Array.from(xArray, x => c.initial(x, gamma));
  if (c.id === 'low-mach') return Array.from(xArray, x => c.initial(x - 0.02 * t, gamma));
  if (!c.reference) return null;
  const states = c.states ? c.states(gamma) : c;
  const solution = exactRiemann(states.left, states.right, gamma);
  return Array.from(xArray, x => solution.sample((x - c.x0) / t));
}

function inspect(U, gamma) {
  let minRho = Infinity, minP = Infinity;
  const bad = [];
  for (let i = 0; i < U.length; i++) {
    const w = conservativeToPrimitive(U[i], gamma);
    minRho = Math.min(minRho, w.rho); minP = Math.min(minP, w.p);
    if (!(w.rho > 0 && w.p > 0 && U[i].every(Number.isFinite))) bad.push(i);
  }
  return { bad, minRho, minP };
}

/**
 * First-order finite-volume / forward-Euler integrator, uniform cell centers.
 * Public U is an array of n arrays [rho,rhou,rhov,E]. step(maxDt) returns an
 * accepted dt, or 0 on failure/end. Failed steps retain the last accepted U.
 * The low-Mach preset defaults to CFL=.05 for every flux because the explicit
 * AUSM+-up pressure correction introduces an additional stiffness at small
 * reference Mach. Other cases default to CFL=.45 and reference Mach 1.
 * safety='hlle' replaces shared faces around inadmissible trial cells, counts
 * every replacement, and retries the same dt. It never clips primitive data.
 */
export class Euler1D {
  constructor({ method = 'roe', caseId = 'sod', n = 200, cfl = caseId === 'low-mach' ? 0.05 : 0.45, gamma = 1.4, order = 1,
    entropyFix = 0.1, lowMachCutoff = caseId === 'low-mach' ? 0.01 : 1, safety = 'strict' } = {}) {
    if (!METHOD_IDS.has(method)) throw new Error(`Unknown method: ${method}`);
    if (!CASE_MAP.has(caseId)) throw new Error(`Unknown case: ${caseId}`);
    if (!(Number.isInteger(n) && n >= 8 && cfl > 0 && cfl <= 1 && gamma > 1)) throw new RangeError('Invalid grid, CFL, or gamma.');
    if (order !== 1) throw new RangeError('This comparison uses first-order finite volumes for every flux (order=1).');
    if (!['strict', 'hlle'].includes(safety)) throw new RangeError('Safety must be strict or hlle.');
    Object.assign(this, { method, caseId, n, cfl, gamma, order, entropyFix, lowMachCutoff, safety });
    this.case = CASE_MAP.get(caseId);
    this.dx = (this.case.xMax - this.case.xMin) / n;
    this.x = Float64Array.from({ length: n }, (_, i) => this.case.xMin + (i + 0.5) * this.dx);
    this.U = Array.from(this.x, x => primitiveToConservative(this.case.initial(x, gamma), gamma));
    this.time = 0; this.steps = 0; this.failed = false; this.failureReason = '';
    this.fallbackCount = 0; this.lastFallbackCount = 0; this.lastDt = 0;
    this.boundaryExchange = ZERO();
    const status = inspect(this.U, gamma);
    this.minRho = status.minRho; this.minP = status.minP;
  }

  _faceStates(j) {
    if (this.case.boundary === 'periodic') return [this.U[(j - 1 + this.n) % this.n], this.U[j % this.n]];
    return [this.U[Math.max(0, j - 1)], this.U[Math.min(this.n - 1, j)]];
  }

  step(maxDt = Infinity) {
    if (this.failed || !(maxDt > 0)) return 0;
    let speed = 0;
    for (const U of this.U) {
      const w = gas(U, this.gamma);
      speed = Math.max(speed, Math.abs(w.u) + w.a);
    }
    const dt = Math.min(maxDt, this.cfl * this.dx / speed);
    if (!(dt > 0 && Number.isFinite(dt))) {
      this.failed = true; this.failureReason = 'No finite positive time step.'; return 0;
    }
    const options = { entropyFix: this.entropyFix, lowMachCutoff: this.lowMachCutoff };
    const fluxes = Array.from({ length: this.n + 1 }, (_, j) => numericalFlux(this.method, ...this._faceStates(j), this.gamma, options));
    if (this.case.boundary === 'periodic') fluxes[this.n] = fluxes[0];
    const makeTrial = () => this.U.map((U, i) => U.map((u, k) => u - dt / this.dx * (fluxes[i + 1][k] - fluxes[i][k])));
    let trial = makeTrial(), status = inspect(trial, this.gamma);
    const replaced = new Set();
    this.lastFallbackCount = 0;
    if (status.bad.length && this.safety === 'hlle') {
      // Each pass grows the repaired region only when a neighboring update
      // needs it. A shared face is replaced at most once, conserving all U.
      for (let pass = 0; pass <= this.n && status.bad.length; pass++) {
        let changed = false;
        for (const i of status.bad) for (let j of [i, i + 1]) {
          if (this.case.boundary === 'periodic' && j === this.n) j = 0;
          if (replaced.has(j)) continue;
          replaced.add(j); changed = true;
          fluxes[j] = numericalFlux('hlle', ...this._faceStates(j), this.gamma, options);
          if (this.case.boundary === 'periodic' && j === 0) fluxes[this.n] = fluxes[0];
        }
        if (!changed) break;
        trial = makeTrial(); status = inspect(trial, this.gamma);
      }
      this.lastFallbackCount = replaced.size; this.fallbackCount += replaced.size;
    }
    if (status.bad.length) {
      this.failed = true;
      this.minRho = status.minRho; this.minP = status.minP;
      this.failureTime = this.time + dt;
      this.failureCell = status.bad[0];
      this.failureReason = `Nonphysical trial at t=${this.failureTime.toPrecision(5)}, cell ${this.failureCell}: min rho=${status.minRho.toExponential(3)}, min p=${status.minP.toExponential(3)}. Last accepted state retained.`;
      return 0;
    }
    for (let k = 0; k < 4; k++) this.boundaryExchange[k] += dt * (fluxes[0][k] - fluxes[this.n][k]);
    this.U = trial; this.time += dt; this.steps++; this.lastDt = dt;
    this.minRho = status.minRho; this.minP = status.minP;
    return dt;
  }

  advanceTo(target, maxSteps = 100000) {
    let count = 0;
    while (!this.failed && this.time < target - 1e-13 * Math.max(1, target) && count < maxSteps) {
      if (!this.step(target - this.time)) break;
      count++;
    }
    return this;
  }

  profile(variable = 'rho') {
    return Float64Array.from(this.U, U => {
      const w = conservativeToPrimitive(U, this.gamma);
      if (variable === 'mach') return w.u / Math.sqrt(this.gamma * w.p / w.rho);
      if (variable === 'e') return w.p / ((this.gamma - 1) * w.rho);
      if (variable === 'entropy' || variable === 's') return Math.log(w.p / w.rho ** this.gamma);
      if (variable === 'E') return U[3];
      return w[variable];
    });
  }

  totals() {
    const total = ZERO();
    for (const U of this.U) for (let k = 0; k < 4; k++) total[k] += U[k] * this.dx;
    return total;
  }
}
