/**
 * Typed spatial DSMC runtime adapted from the user-owned CKPEIIKA demo.
 * Upstream SHA-256: 8943a745170f88a21309cbf9f21e15232e83c0013ea4d99dd7c26ba4551ea260
 * Presentation-independent; see docs/REFERENCE_DEMO_PORTS.md.
 */
import { Dsmc } from './dsmc-lab-core.js';

const DsmcTyped = (() => {
    "use strict";

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const MAX_ATTEMPTS_PER_CELL = 256;
    const MAX_ATTEMPTS_PER_STEP = 200000;

    const createRuntime = () => {
        const cells = {
            cols: 1,
            rows: 1,
            totalCells: 1,
            cellW: 1,
            cellH: 1,
            invCellW: 1,
            invCellH: 1,
            counts: new Int32Array(1),
            ntcRemainders: new Float32Array(1),
            members: new Int32Array(1),
            offsets: new Int32Array(2),
            cursor: new Int32Array(1),
            particleCellIndex: new Int32Array(1),
            sigmaMajorants: new Float64Array(1),
            occupiedCells: 0,
            maxCount: 0,
        };

        const state = {
            count: 0,
            x: new Float64Array(1),
            y: new Float64Array(1),
            vx: new Float64Array(1),
            vy: new Float64Array(1),
            vz: new Float64Array(1),
            mass: new Float64Array(1),
            eRot: new Float64Array(1),
            rotDof: new Uint8Array(1),
            speciesIndex: new Int32Array(1),
            renderJitterX: new Float32Array(1),
            renderJitterY: new Float32Array(1),
            speciesMeta: [],
            speciesColors: [],
            speciesLookup: new Map(),
            pairCache: [],
            rngState: 0x9e3779b9 >>> 0,
            cells,
        };

        const setSeed = (seed) => {
            let next = Number(seed) >>> 0;
            if (next === 0) {
                next = 0x6d2b79f5;
            }
            state.rngState = next >>> 0;
        };

        const random = () => {
            let x = state.rngState >>> 0;
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            state.rngState = x >>> 0;
            return (state.rngState >>> 0) / 4294967296;
        };

        const ensureParticleCapacity = (count) => {
            const next = Math.max(1, count | 0);
            const ensureArray = (key, Type) => {
                if (!(state[key] instanceof Type) || state[key].length < next) {
                    let size = state[key] && state[key].length ? state[key].length : 1;
                    while (size < next) {
                        size *= 2;
                    }
                    state[key] = new Type(size);
                }
            };
            ensureArray("x", Float64Array);
            ensureArray("y", Float64Array);
            ensureArray("vx", Float64Array);
            ensureArray("vy", Float64Array);
            ensureArray("vz", Float64Array);
            ensureArray("mass", Float64Array);
            ensureArray("eRot", Float64Array);
            ensureArray("rotDof", Uint8Array);
            ensureArray("speciesIndex", Int32Array);
            ensureArray("renderJitterX", Float32Array);
            ensureArray("renderJitterY", Float32Array);
        };

        const ensureCellCapacity = (particleCount) => {
            const n = Math.max(1, cells.totalCells | 0);
            const pCount = Math.max(1, particleCount | 0);
            if (!(cells.counts instanceof Int32Array) || cells.counts.length < n) {
                cells.counts = new Int32Array(n);
            }
            if (!(cells.ntcRemainders instanceof Float32Array) || cells.ntcRemainders.length < n) {
                cells.ntcRemainders = new Float32Array(n);
            }
            if (!(cells.members instanceof Int32Array) || cells.members.length < pCount) {
                cells.members = new Int32Array(pCount);
            }
            if (!(cells.particleCellIndex instanceof Int32Array) || cells.particleCellIndex.length < pCount) {
                cells.particleCellIndex = new Int32Array(pCount);
            }
            if (!(cells.offsets instanceof Int32Array) || cells.offsets.length < n + 1) {
                cells.offsets = new Int32Array(n + 1);
            }
            if (!(cells.cursor instanceof Int32Array) || cells.cursor.length < n) {
                cells.cursor = new Int32Array(n);
            }
            if (!(cells.sigmaMajorants instanceof Float64Array) || cells.sigmaMajorants.length < n) {
                cells.sigmaMajorants = new Float64Array(n);
            }
        };

        const configureGrid = (worldWidth, worldHeight, requestedCellSize) => {
            const cellW = clamp(Number(requestedCellSize) || 0.2, 0.05, worldWidth * 0.75);
            const cols = Math.max(8, Math.round(worldWidth / cellW));
            const rows = Math.max(4, Math.round(cols * worldHeight / worldWidth));
            cells.cols = cols;
            cells.rows = rows;
            cells.totalCells = cols * rows;
            cells.cellW = worldWidth / cols;
            cells.cellH = worldHeight / rows;
            cells.invCellW = 1 / cells.cellW;
            cells.invCellH = 1 / cells.cellH;
            ensureCellCapacity(state.count);
        };

        const loadParticles = (particles) => {
            const list = Array.isArray(particles) ? particles : [];
            const count = list.length;
            state.count = count;
            ensureParticleCapacity(count);
            state.speciesMeta = [];
            state.speciesColors = [];
            state.speciesLookup = new Map();
            for (let i = 0; i < count; i += 1) {
                const particle = list[i];
                state.x[i] = particle.x;
                state.y[i] = particle.y;
                state.vx[i] = particle.vx;
                state.vy[i] = particle.vy;
                state.vz[i] = particle.vz;
                state.mass[i] = particle.mass;
                state.eRot[i] = Number.isFinite(Number(particle.eRot)) ? Number(particle.eRot) : 0.0;
                state.renderJitterX[i] = Number(particle.renderJitterX) || 0.0;
                state.renderJitterY[i] = Number(particle.renderJitterY) || 0.0;
                const name = particle.species || (particle.speciesData && particle.speciesData.name) || `species-${i}`;
                let idx = state.speciesLookup.get(name);
                if (idx === undefined) {
                    idx = state.speciesMeta.length;
                    state.speciesLookup.set(name, idx);
                    state.speciesMeta.push(particle.speciesData || { name, mass_kg: particle.mass, vss_alpha: 1.0 });
                    state.speciesColors[idx] = particle.color || "#94a3b8";
                }
                state.speciesIndex[i] = idx;
                const meta = state.speciesMeta[idx];
                const dof = Number.isFinite(Number(particle.rotDof))
                    ? Number(particle.rotDof)
                    : Number(meta.rotational_degrees_of_freedom || 0);
                state.rotDof[i] = Math.max(0, Math.min(255, Math.round(dof)));
            }
            state.pairCache = buildPairCache();
            ensureCellCapacity(count);
        };

        const buildPairCache = () => {
            const species = state.speciesMeta;
            const ns = species.length;
            const pairCache = new Array(ns * ns);
            for (let i = 0; i < ns; i += 1) {
                for (let j = 0; j < ns; j += 1) {
                    const sa = species[i];
                    const sb = species[j];
                    const diameter = 0.5 * (sa.diameter_m + sb.diameter_m);
                    const omega = 0.5 * (sa.viscosity_temperature_exponent + sb.viscosity_temperature_exponent);
                    const mu = Dsmc.reducedMass(sa.mass_kg, sb.mass_kg);
                    pairCache[i * ns + j] = {
                        diameterSqPi: Math.PI * diameter * diameter,
                        omega,
                        mu,
                        massA: sa.mass_kg,
                        massB: sb.mass_kg,
                        alphaA: sa.vss_alpha,
                        alphaB: sb.vss_alpha,
                    };
                }
            }
            return pairCache;
        };

        const lanczosLogGamma = (z) => {
            const p = [
                676.5203681215039,
                -1259.1392167224028,
                771.3234287776531,
                -176.6150291621406,
                12.507343278686905,
                -0.13857109526572012,
                9.984369578019572e-6,
                1.5056327351493116e-7,
            ];
            if (z < 0.5) {
                return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - lanczosLogGamma(1.0 - z);
            }
            const zz = z - 1.0;
            let x = 0.9999999999998099;
            for (let i = 0; i < p.length; i += 1) {
                x += p[i] / (zz + i + 1.0);
            }
            const t = zz + p.length - 0.5;
            return 0.9189385332046727 + (zz + 0.5) * Math.log(t) - t + Math.log(x);
        };

        const clearCellState = (preserveRemainders) => {
            for (let i = 0; i < cells.totalCells; i += 1) {
                cells.counts[i] = 0;
                if (!preserveRemainders) {
                    cells.ntcRemainders[i] = 0.0;
                }
            }
            cells.occupiedCells = 0;
            cells.maxCount = 0;
        };

        const buildCellCache = (preserveRemainders = true) => {
            ensureCellCapacity(state.count);
            clearCellState(preserveRemainders);
            const cols = cells.cols;
            const maxCellX = cols - 1;
            const maxCellY = cells.rows - 1;
            let maxCount = 0;
            let occupied = 0;
            for (let i = 0; i < state.count; i += 1) {
                const cx = clamp((state.x[i] * cells.invCellW) | 0, 0, maxCellX);
                const cy = clamp((state.y[i] * cells.invCellH) | 0, 0, maxCellY);
                const idx = cy * cols + cx;
                cells.particleCellIndex[i] = idx;
                const next = (cells.counts[idx] += 1);
                if (next === 1) {
                    occupied += 1;
                }
                if (next > maxCount) {
                    maxCount = next;
                }
            }

            let offset = 0;
            for (let ci = 0; ci < cells.totalCells; ci += 1) {
                cells.offsets[ci] = offset;
                cells.cursor[ci] = offset;
                offset += cells.counts[ci];
            }
            cells.offsets[cells.totalCells] = offset;

            for (let i = 0; i < state.count; i += 1) {
                const cellIdx = cells.particleCellIndex[i];
                cells.members[cells.cursor[cellIdx]++] = i;
            }
            cells.occupiedCells = occupied;
            cells.maxCount = maxCount;
        };

        const applyBoundaries = (config) => {
            const left = config.left;
            const right = config.right;
            const bottom = config.bottom;
            const top = config.top;
            const boundaryMode = config.boundaryMode;
            const xMode = config.xMode || boundaryMode;
            const yMode = config.yMode || boundaryMode;
            const reflectVelocity = config.reflectVelocity;
            const wrapCoord = config.wrapCoord;

            for (let i = 0; i < state.count; i += 1) {
                if (xMode === "periodic") {
                    state.x[i] = wrapCoord(state.x[i], left, right);
                } else if (state.x[i] < left) {
                    state.x[i] = left;
                    const next = reflectVelocity(i, [1, 0, 0], "x", state.mass[i], [state.vx[i], state.vy[i], state.vz[i]]);
                    state.vx[i] = next[0];
                    state.vy[i] = next[1];
                    state.vz[i] = next[2];
                } else if (state.x[i] > right) {
                    state.x[i] = right;
                    const next = reflectVelocity(i, [-1, 0, 0], "x", state.mass[i], [state.vx[i], state.vy[i], state.vz[i]]);
                    state.vx[i] = next[0];
                    state.vy[i] = next[1];
                    state.vz[i] = next[2];
                }

                if (yMode === "periodic") {
                    state.y[i] = wrapCoord(state.y[i], bottom, top);
                } else if (state.y[i] < bottom) {
                    state.y[i] = bottom;
                    const next = reflectVelocity(i, [0, 1, 0], "y", state.mass[i], [state.vx[i], state.vy[i], state.vz[i]]);
                    state.vx[i] = next[0];
                    state.vy[i] = next[1];
                    state.vz[i] = next[2];
                } else if (state.y[i] > top) {
                    state.y[i] = top;
                    const next = reflectVelocity(i, [0, -1, 0], "y", state.mass[i], [state.vx[i], state.vy[i], state.vz[i]]);
                    state.vx[i] = next[0];
                    state.vy[i] = next[1];
                    state.vz[i] = next[2];
                }
            }
        };

        const moveParticles = (dt, config) => {
            for (let i = 0; i < state.count; i += 1) {
                state.x[i] += state.vx[i] * dt;
                state.y[i] += state.vy[i] * dt;
            }
            applyBoundaries(config);
        };

        const randomNormal = (rand) => {
            const u1 = Math.max(Number.EPSILON, rand());
            const u2 = rand();
            return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        };

        const sampleGamma = (shape, rand) => {
            const a = Number(shape);
            if (!(a > 0.0)) {
                throw new Error("gamma shape must be positive");
            }
            if (a < 1.0) {
                const u = Math.max(Number.EPSILON, rand());
                return sampleGamma(a + 1.0, rand) * Math.pow(u, 1.0 / a);
            }
            const d = a - 1.0 / 3.0;
            const c = 1.0 / Math.sqrt(9.0 * d);
            for (;;) {
                const x = randomNormal(rand);
                const vBase = 1.0 + c * x;
                if (vBase <= 0.0) {
                    continue;
                }
                const v = vBase * vBase * vBase;
                const u = rand();
                if (u < 1.0 - 0.0331 * x * x * x * x) {
                    return d * v;
                }
                if (Math.log(Math.max(Number.EPSILON, u)) < 0.5 * x * x + d * (1.0 - v + Math.log(v))) {
                    return d * v;
                }
            }
        };

        const sampleBeta = (a, b, rand) => {
            const x = sampleGamma(a, rand);
            const y = sampleGamma(b, rand);
            return x / (x + y);
        };

        const setPostCollisionVelocities = (ia, ib, relSpeedOut, cosTheta, azimuth) => {
            const vax = state.vx[ia];
            const vay = state.vy[ia];
            const vaz = state.vz[ia];
            const vbx = state.vx[ib];
            const vby = state.vy[ib];
            const vbz = state.vz[ib];
            const relX = vax - vbx;
            const relY = vay - vby;
            const relZ = vaz - vbz;
            const relSpeedIn = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
            if (!(relSpeedIn > 1e-14)) {
                return false;
            }
            const ex = relX / relSpeedIn;
            const ey = relY / relSpeedIn;
            const ez = relZ / relSpeedIn;
            const hx = Math.abs(ex) < 0.9 ? 1.0 : 0.0;
            const hy = Math.abs(ex) < 0.9 ? 0.0 : 1.0;
            let t1x = -ez * hy;
            let t1y = ez * hx;
            let t1z = ex * hy - ey * hx;
            const t1n = Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z);
            if (!(t1n > 0.0)) {
                return false;
            }
            t1x /= t1n;
            t1y /= t1n;
            t1z /= t1n;
            const t2x = ey * t1z - ez * t1y;
            const t2y = ez * t1x - ex * t1z;
            const t2z = ex * t1y - ey * t1x;
            const c = clamp(cosTheta, -1.0, 1.0);
            const s = Math.sqrt(Math.max(0.0, 1.0 - c * c));
            const ca = Math.cos(azimuth);
            const sa = Math.sin(azimuth);
            const dirX = c * ex + s * (ca * t1x + sa * t2x);
            const dirY = c * ey + s * (ca * t1y + sa * t2y);
            const dirZ = c * ez + s * (ca * t1z + sa * t2z);
            const ma = state.mass[ia];
            const mb = state.mass[ib];
            const mt = ma + mb;
            const cmx = (ma * vax + mb * vbx) / mt;
            const cmy = (ma * vay + mb * vby) / mt;
            const cmz = (ma * vaz + mb * vbz) / mt;
            const fa = mb / mt;
            const fb = ma / mt;
            state.vx[ia] = cmx + fa * relSpeedOut * dirX;
            state.vy[ia] = cmy + fa * relSpeedOut * dirY;
            state.vz[ia] = cmz + fa * relSpeedOut * dirZ;
            state.vx[ib] = cmx - fb * relSpeedOut * dirX;
            state.vy[ib] = cmy - fb * relSpeedOut * dirY;
            state.vz[ib] = cmz - fb * relSpeedOut * dirZ;
            return true;
        };

        const collisionStep = (config) => {
            const dt = Math.max(1e-9, Number(config.dt) || 1e-9);
            if (state.count < 2) {
                return {
                    collided: 0,
                    attempted: 0,
                    majorantViolations: 0,
                    candidateOverflow: 0,
                    rawCandidates: 0,
                    rotEvents: 0,
                    overflowed: false,
                };
            }

            const ntcWeight = Number(config.ntcWeight);
            const ntcMargin = Number(config.ntcMargin || 1.2);
            const referenceTemperatureK = Number(config.referenceTemperatureK || 300.0);
            const cellVolume = Number(config.cellVolume);
            const collisionModel = config.collisionModel || "vhs";
            const rand = config.random || random;
            const collisionLineProbability = Number(config.collisionLineProbability || 0.0);
            const onCollision = typeof config.onCollision === "function" ? config.onCollision : null;
            const enableRotationalLB = config.enableRotationalLB === true;
            const forcedZRot = Number(config.rotCollisionNumber);
            const maxAttemptsPerCell = Number.isFinite(Number(config.maxAttemptsPerCell))
                ? Math.max(1, Math.floor(Number(config.maxAttemptsPerCell)))
                : MAX_ATTEMPTS_PER_CELL;
            const maxAttemptsPerStep = Number.isFinite(Number(config.maxAttemptsPerStep))
                ? Math.max(1, Math.floor(Number(config.maxAttemptsPerStep)))
                : MAX_ATTEMPTS_PER_STEP;

            let collided = 0;
            let attempted = 0;
            let majorantViolations = 0;
            let candidateOverflow = 0;
            let rawCandidates = 0;
            let rotEvents = 0;
            let overflowed = false;

            const sigmaTCr = (pairMeta, relSpeed) => {
                if (collisionModel === "hard-sphere") {
                    return pairMeta.diameterSqPi * relSpeed;
                }
                const exponent = pairMeta.omega - 0.5;
                const sigmaT = pairMeta.diameterSqPi
                    * Math.pow(2.0 * Dsmc.KB * referenceTemperatureK / (pairMeta.mu * relSpeed * relSpeed), exponent)
                    / Math.exp(lanczosLogGamma(2.5 - pairMeta.omega));
                return sigmaT * relSpeed;
            };

            const pairZRot = (sa, sb) => {
                if (Number.isFinite(forcedZRot) && forcedZRot > 0.0) {
                    return forcedZRot;
                }
                const za = Number(sa.rotational_relaxation_collision_number);
                const zb = Number(sb.rotational_relaxation_collision_number);
                const goodA = Number.isFinite(za) && za > 0.0;
                const goodB = Number.isFinite(zb) && zb > 0.0;
                if (goodA && goodB) {
                    return Math.max(1.0, 0.5 * (za + zb));
                }
                if (goodA) {
                    return Math.max(1.0, za);
                }
                if (goodB) {
                    return Math.max(1.0, zb);
                }
                return Infinity;
            };

            for (let ci = 0; ci < cells.totalCells; ci += 1) {
                const n = cells.counts[ci];
                if (n < 2) {
                    continue;
                }

                const base = cells.offsets[ci];
                const probe = Math.min(24, Math.max(6, Math.floor(Math.sqrt(n) * 1.5)));
                let sigmaMax = 0.0;
                for (let p = 0; p < probe; p += 1) {
                    const aSlot = (rand() * n) | 0;
                    let bSlot = (rand() * (n - 1)) | 0;
                    if (bSlot >= aSlot) {
                        bSlot += 1;
                    }
                    const a = cells.members[base + aSlot];
                    const b = cells.members[base + bSlot];
                    const relX = state.vx[a] - state.vx[b];
                    const relY = state.vy[a] - state.vy[b];
                    const relZ = state.vz[a] - state.vz[b];
                    const relSpeed = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
                    if (relSpeed < 1e-12) {
                        continue;
                    }
                    const pairMeta = state.pairCache[state.speciesIndex[a] * state.speciesMeta.length + state.speciesIndex[b]];
                    const sigmaTc = sigmaTCr(pairMeta, relSpeed);
                    if (sigmaTc > sigmaMax) {
                        sigmaMax = sigmaTc;
                    }
                }

                const previousMajorant = cells.sigmaMajorants[ci] || 0.0;
                let sigmaMajorant = Math.max(previousMajorant * 0.985, sigmaMax * ntcMargin);
                if (!(sigmaMajorant > 0.0)) {
                    continue;
                }
                const candidatesInfo = Dsmc.ntcCandidateCount(
                    n,
                    ntcWeight,
                    sigmaMajorant,
                    dt,
                    cellVolume,
                    cells.ntcRemainders[ci],
                );
                cells.ntcRemainders[ci] = candidatesInfo.remainder;
                rawCandidates += candidatesInfo.raw;

                let attempts = Math.floor(candidatesInfo.candidates);
                if (attempts > maxAttemptsPerCell) {
                    candidateOverflow += attempts - maxAttemptsPerCell;
                    attempts = maxAttemptsPerCell;
                }
                if (attempted + attempts > maxAttemptsPerStep) {
                    candidateOverflow += attempted + attempts - maxAttemptsPerStep;
                    attempts = Math.max(0, maxAttemptsPerStep - attempted);
                }
                if (candidateOverflow > 0) {
                    overflowed = true;
                }
                if (attempts <= 0) {
                    if (attempted >= maxAttemptsPerStep) {
                        overflowed = true;
                        break;
                    }
                    continue;
                }

                for (let k = 0; k < attempts; k += 1) {
                    const aSlot = (rand() * n) | 0;
                    let bSlot = (rand() * (n - 1)) | 0;
                    if (bSlot >= aSlot) {
                        bSlot += 1;
                    }
                    const ia = cells.members[base + aSlot];
                    const ib = cells.members[base + bSlot];
                    attempted += 1;

                    const relX = state.vx[ia] - state.vx[ib];
                    const relY = state.vy[ia] - state.vy[ib];
                    const relZ = state.vz[ia] - state.vz[ib];
                    const relSpeed = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
                    if (relSpeed < 1e-12) {
                        continue;
                    }

                    const pairMeta = state.pairCache[state.speciesIndex[ia] * state.speciesMeta.length + state.speciesIndex[ib]];
                    const sigmaTc = sigmaTCr(pairMeta, relSpeed);
                    const rawAcceptance = Dsmc.ntcAcceptsCollision(sigmaTc, sigmaMajorant, rand());
                    const acceptance = typeof rawAcceptance === "boolean"
                        ? {
                            accepted: rawAcceptance,
                            majorantViolated: sigmaTc > sigmaMajorant,
                            ratio: sigmaTc / sigmaMajorant,
                        }
                        : rawAcceptance;
                    if (acceptance.majorantViolated) {
                        majorantViolations += 1;
                        sigmaMajorant = Math.max(sigmaMajorant, sigmaTc * ntcMargin);
                    }
                    if (!acceptance.accepted) {
                        continue;
                    }

                    const ma = state.mass[ia];
                    const mb = state.mass[ib];
                    const mu = (ma * mb) / (ma + mb);
                    let gOut = relSpeed;
                    let didRot = false;
                    if (enableRotationalLB) {
                        const dofA = state.rotDof[ia] | 0;
                        const dofB = state.rotDof[ib] | 0;
                        const zetaRot = dofA + dofB;
                        if (zetaRot > 0) {
                            const sa = state.speciesMeta[state.speciesIndex[ia]];
                            const sb = state.speciesMeta[state.speciesIndex[ib]];
                            const zRot = pairZRot(sa, sb);
                            const pRot = Number.isFinite(zRot) && zRot > 0.0 ? Math.min(1.0, 1.0 / zRot) : 0.0;
                            if (rand() < pRot) {
                                const eTr = 0.5 * mu * relSpeed * relSpeed;
                                const ePool = eTr + state.eRot[ia] + state.eRot[ib];
                                if (ePool > 0.0) {
                                    const fTr = sampleBeta(1.5, 0.5 * zetaRot, rand);
                                    const eTrNew = Math.max(0.0, fTr * ePool);
                                    const eRotPool = Math.max(0.0, ePool - eTrNew);
                                    if (dofA > 0 && dofB > 0) {
                                        const fA = sampleBeta(0.5 * dofA, 0.5 * dofB, rand);
                                        state.eRot[ia] = fA * eRotPool;
                                        state.eRot[ib] = (1.0 - fA) * eRotPool;
                                    } else if (dofA > 0) {
                                        state.eRot[ia] = eRotPool;
                                        state.eRot[ib] = 0.0;
                                    } else {
                                        state.eRot[ia] = 0.0;
                                        state.eRot[ib] = eRotPool;
                                    }
                                    gOut = Math.sqrt(Math.max(0.0, 2.0 * eTrNew / mu));
                                    didRot = true;
                                    rotEvents += 1;
                                }
                            }
                        }
                    }

                    const cosTheta = collisionModel === "vss"
                        ? Dsmc.vssCosTheta(rand(), pairMeta.alphaA, pairMeta.alphaB)
                        : (2.0 * rand() - 1.0);
                    const azimuth = rand() * Math.PI * 2;
                    if (!setPostCollisionVelocities(ia, ib, gOut, cosTheta, azimuth)) {
                        continue;
                    }
                    collided += 1;

                    if (onCollision && rand() < collisionLineProbability) {
                        const reactiveThresholdJ = 2.0 * Dsmc.KB * 10000.0;
                        const hot = 0.5 * mu * relSpeed * relSpeed > reactiveThresholdJ;
                        onCollision(state.x[ia], state.y[ia], state.x[ib], state.y[ib], didRot ? "rot" : (hot ? "hot" : "normal"));
                    }
                }
                cells.sigmaMajorants[ci] = sigmaMajorant;
                if (attempted >= maxAttemptsPerStep) {
                    overflowed = true;
                    break;
                }
            }

            return {
                collided,
                attempted,
                majorantViolations,
                candidateOverflow,
                rawCandidates,
                rotEvents,
                overflowed,
            };
        };

        return {
            cells,
            state,
            configureGrid,
            loadParticles,
            buildCellCache,
            applyBoundaries,
            moveParticles,
            collisionStep,
            setSeed,
            random,
        };
    };

    return Object.freeze({ createRuntime });
})();

export { DsmcTyped };
