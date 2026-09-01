import { clamp, random01 } from './math.js';

export const CHALK_MATERIAL_DEFAULTS = Object.freeze({
  wobble: 0.55,
  pressure: 0.72,
  pressureVariation: 0.14,
  coverage: 0.94,
  edgeBreakup: 0.1,
  grainSize: 1.5,
  dust: 0.08,
  softness: 0.35,
  accumulation: 0.12,
});

const UNIT_PARAMETERS = Object.freeze([
  'pressure',
  'pressureVariation',
  'coverage',
  'edgeBreakup',
  'dust',
  'softness',
  'accumulation',
]);

function validateUnitParameter(style, name) {
  const value = style[name];
  if (!Number.isFinite(value)) throw new TypeError(`style.${name} must be finite`);
  if (value < 0 || value > 1) {
    throw new RangeError(`style.${name} must be between zero and one; received ${value}`);
  }
}

export function validateChalkMaterialStyle(style) {
  if (!Number.isFinite(style.wobble) || style.wobble < 0) {
    throw new RangeError('style.wobble must be finite and must not be negative');
  }
  if (!Number.isFinite(style.grainSize) || style.grainSize <= 0) {
    throw new RangeError('style.grainSize must be finite and greater than zero');
  }
  for (const name of UNIT_PARAMETERS) validateUnitParameter(style, name);
  return style;
}

function normalizedMaterialStyle(style) {
  const normalized = {
    ...CHALK_MATERIAL_DEFAULTS,
    ...style,
    wobble: style.wobble ?? style.roughness ?? CHALK_MATERIAL_DEFAULTS.wobble,
  };
  return validateChalkMaterialStyle(normalized);
}

function validatePackedPoints(points) {
  if (!points || typeof points.length !== 'number') {
    throw new TypeError('points must be an array-like packed as [x0,y0,x1,y1,...]');
  }
  if (points.length < 4 || points.length % 2 !== 0) {
    throw new RangeError('points must contain at least two complete packed 2D points');
  }
  for (let index = 0; index < points.length; index += 2) {
    if (!Number.isFinite(points[index]) || !Number.isFinite(points[index + 1])) {
      throw new RangeError(
        `point ${index / 2} is not finite; No resampled geometry was produced.`,
      );
    }
  }
}

/**
 * Resample packed screen-space geometry at uniform arc-length intervals.
 * Closed paths omit the duplicate terminal point; material runs add it only
 * when a surviving segment crosses the closing edge.
 */
export function resamplePolyline(points, {
  spacing = 1.5,
  closed = false,
} = {}) {
  validatePackedPoints(points);
  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new RangeError('spacing must be finite and greater than zero');
  }
  if (typeof closed !== 'boolean') throw new TypeError('closed must be a boolean');

  const pointCount = points.length / 2;
  const segmentCount = closed ? pointCount : pointCount - 1;
  const lengths = new Float64Array(segmentCount);
  let totalLength = 0;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const next = (segment + 1) % pointCount;
    const length = Math.hypot(
      points[next * 2] - points[segment * 2],
      points[next * 2 + 1] - points[segment * 2 + 1],
    );
    lengths[segment] = length;
    totalLength += length;
  }

  if (totalLength === 0) {
    return new Float32Array([points[0], points[1], points[2], points[3]]);
  }

  const sampleCount = closed
    ? Math.max(2, Math.ceil(totalLength / spacing))
    : Math.ceil(totalLength / spacing) + 1;
  const output = new Float32Array(sampleCount * 2);
  let segment = 0;
  let segmentStartDistance = 0;

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const distance = !closed && sample === sampleCount - 1
      ? totalLength
      : Math.min(sample * spacing, totalLength);
    while (
      segment < segmentCount - 1
      && distance > segmentStartDistance + lengths[segment]
    ) {
      segmentStartDistance += lengths[segment];
      segment += 1;
    }
    const next = (segment + 1) % pointCount;
    const length = lengths[segment];
    const fraction = length === 0 ? 0 : clamp(
      (distance - segmentStartDistance) / length,
      0,
      1,
    );
    output[sample * 2] = points[segment * 2]
      + (points[next * 2] - points[segment * 2]) * fraction;
    output[sample * 2 + 1] = points[segment * 2 + 1]
      + (points[next * 2 + 1] - points[segment * 2 + 1]) * fraction;
  }
  if (!closed) {
    output[output.length - 2] = points[points.length - 2];
    output[output.length - 1] = points[points.length - 1];
  }
  return output;
}

function correlatedNoise(index, seed, span) {
  const position = index / Math.max(1, span);
  const left = Math.floor(position);
  const fraction = position - left;
  const smooth = fraction * fraction * (3 - 2 * fraction);
  const a = random01(left, seed) * 2 - 1;
  const b = random01(left + 1, seed) * 2 - 1;
  return a + (b - a) * smooth;
}

function nonNegativeProfileAt(profile, name, index, sampleCount) {
  if (profile == null) return 0;
  if (typeof profile === 'number') {
    if (!Number.isFinite(profile) || profile < 0) {
      throw new RangeError(`${name} must be finite and non-negative`);
    }
    return profile;
  }
  if (typeof profile.length !== 'number') {
    throw new TypeError(`${name} must be a non-negative number or an array-like profile`);
  }
  if (profile.length !== sampleCount) {
    throw new RangeError(
      `${name} length is ${profile.length}; expected material sample count ${sampleCount}`,
    );
  }
  const value = profile[index];
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} at sample ${index} must be finite and non-negative`);
  }
  return value;
}

function pressureBand(pressure) {
  if (pressure < 0.45) return 0;
  if (pressure < 0.78) return 1;
  return 2;
}

function makeProfiles(sampleCount, style, seed, velocity, dwell, lowSpan) {
  const pressure = new Float32Array(sampleCount);
  const width = new Float32Array(sampleCount);
  const opacity = new Float32Array(sampleCount);
  const coverage = new Float32Array(sampleCount);
  const brightness = new Float32Array(sampleCount);
  const dust = new Float32Array(sampleCount);
  const accumulation = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const pressureNoise = correlatedNoise(index, seed ^ 0x51ed270b, lowSpan);
    const speed = nonNegativeProfileAt(velocity, 'velocity', index, sampleCount);
    const dwellTime = nonNegativeProfileAt(dwell, 'dwell', index, sampleCount);
    const dwellResponse = 1 - Math.exp(-dwellTime);
    const localAccumulation = style.accumulation * dwellResponse;
    const speedFactor = 1 / (1 + style.softness * speed);
    const movingPressure = clamp(
      (style.pressure + style.pressureVariation * pressureNoise) * speedFactor,
      0,
      1,
    );
    const localPressure = clamp(
      movingPressure + localAccumulation * (1 - movingPressure) * 0.68, 0, 1,
    );
    const speedResponse = speed / (1 + speed);
    pressure[index] = localPressure;
    accumulation[index] = localAccumulation;
    width[index] = clamp(0.64 + 0.32 * localPressure + 0.11 * localAccumulation, 0.5, 1.08);
    opacity[index] = clamp(0.34 + 0.58 * localPressure + 0.12 * localAccumulation, 0, 1);
    coverage[index] = clamp(
      style.coverage * (0.5 + 0.43 * localPressure + 0.18 * localAccumulation), 0, 1,
    );
    brightness[index] = clamp(
      localPressure * (1 - style.softness * 0.2) + localAccumulation * 0.24, 0, 1,
    );
    dust[index] = clamp(
      style.dust * (0.28 + 0.52 * (1 - localPressure) + 0.28 * speedResponse)
        + localAccumulation * 0.14, 0, 1,
    );
  }
  return Object.freeze({ pressure, width, opacity, coverage, brightness, dust, accumulation });
}

function deformCenterline(points, style, pass, seed, closed, lowSpan, highSpan) {
  const pointCount = points.length / 2;
  const output = new Float32Array(points.length);
  const passSeed = (seed ^ Math.imul(pass + 1, 0x9e3779b1)) | 0;
  for (let index = 0; index < pointCount; index += 1) {
    const previous = closed
      ? (index + pointCount - 1) % pointCount
      : Math.max(0, index - 1);
    const next = closed ? (index + 1) % pointCount : Math.min(pointCount - 1, index + 1);
    const dx = points[next * 2] - points[previous * 2];
    const dy = points[next * 2 + 1] - points[previous * 2 + 1];
    const length = Math.hypot(dx, dy) || 1;
    const tangentX = dx / length;
    const tangentY = dy / length;
    const normalX = -tangentY;
    const normalY = tangentX;
    const edgeDistance = Math.min(index, pointCount - 1 - index);
    const endpointScale = closed ? 1 : Math.min(1, 0.45 + edgeDistance * 0.28);
    const wander = correlatedNoise(index, passSeed ^ 0x68bc21eb, lowSpan)
      * style.wobble * endpointScale;
    const grain = correlatedNoise(index, passSeed ^ 0x02e5be93, highSpan)
      * style.wobble * (style.grain ?? 0) * 0.24 * endpointScale;
    output[index * 2] = points[index * 2] + normalX * wander + tangentX * grain;
    output[index * 2 + 1] = points[index * 2 + 1] + normalY * wander + tangentY * grain;
  }
  return output;
}

function appendSegment(runs, state, points, start, end, band) {
  let run;
  if (state.kept && state.band === band) {
    run = runs[band].at(-1);
    run.push(points[end * 2], points[end * 2 + 1]);
  } else {
    run = [
      points[start * 2],
      points[start * 2 + 1],
      points[end * 2],
      points[end * 2 + 1],
    ];
    runs[band].push(run);
  }
  state.kept = true;
  state.band = band;
}

const DEPOSIT_OFFSETS = Object.freeze([-0.28, 0, 0.28]);

function buildDepositFiber(centerline, profiles, strokeWidth, offsetScale, seed, closed) {
  const pointCount = centerline.length / 2;
  const output = new Float32Array(centerline.length);

  for (let index = 0; index < pointCount; index += 1) {
    const previous = closed
      ? (index + pointCount - 1) % pointCount
      : Math.max(0, index - 1);
    const next = closed ? (index + 1) % pointCount : Math.min(pointCount - 1, index + 1);
    const dx = centerline[next * 2] - centerline[previous * 2];
    const dy = centerline[next * 2 + 1] - centerline[previous * 2 + 1];
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    const jitter = random01(index, seed ^ 0x165667b1) * 2 - 1;
    const offset = offsetScale * strokeWidth * profiles.width[index]
      + jitter * strokeWidth * (0.035 + profiles.dust[index] * 0.09);
    output[index * 2] = centerline[index * 2] + normalX * offset;
    output[index * 2 + 1] = centerline[index * 2 + 1] + normalY * offset;
  }
  return output;
}

function buildPassDeposits(centerline, profiles, style, strokeWidth, pass, seed, closed) {
  const pointCount = centerline.length / 2;
  const edgeCount = closed ? pointCount : pointCount - 1;
  const runs = [[], [], []];
  const totals = Array.from({ length: 3 }, () => ({
    count: 0,
    width: 0,
    opacity: 0,
    brightness: 0,
  }));
  const passSeed = (seed ^ Math.imul(pass + 1, 0x7f4a7c15)) | 0;
  let fragmentCount = 0;

  for (let fiber = 0; fiber < DEPOSIT_OFFSETS.length; fiber += 1) {
    const fiberSeed = (passSeed ^ Math.imul(fiber + 1, 0x6c8e9cf5)) | 0;
    const fiberPoints = buildDepositFiber(
      centerline,
      profiles,
      strokeWidth,
      DEPOSIT_OFFSETS[fiber],
      fiberSeed,
      closed,
    );
    const state = { kept: false, band: -1 };

    for (let edge = 0; edge < edgeCount; edge += 1) {
      const next = (edge + 1) % pointCount;
      const pressure = (profiles.pressure[edge] + profiles.pressure[next]) * 0.5;
      const coverage = (profiles.coverage[edge] + profiles.coverage[next]) * 0.5;
      const edgeNoise = random01(edge, fiberSeed ^ 0x1b56c4e9);
      const decision = random01(edge, fiberSeed ^ 0x2c1b3c6d);
      const fiberBias = fiber === 1 ? 0.04 : -0.015;
      const depositProbability = clamp(
        coverage * (1 - style.edgeBreakup * (0.12 + edgeNoise * 0.3)) + fiberBias,
        0, 1,
      );
      if (decision >= depositProbability) {
        state.kept = false;
        state.band = -1;
        continue;
      }

      const band = pressureBand(pressure);
      appendSegment(runs, state, fiberPoints, edge, next, band);
      const width = (profiles.width[edge] + profiles.width[next]) * 0.5;
      const opacity = (profiles.opacity[edge] + profiles.opacity[next]) * 0.5;
      const brightness = (profiles.brightness[edge] + profiles.brightness[next]) * 0.5;
      const dust = (profiles.dust[edge] + profiles.dust[next]) * 0.5;
      const total = totals[band];
      total.count += 1;
      total.width += 0.12 + width * 0.13 + dust * 0.035;
      total.opacity += clamp(0.58 + opacity * 0.4, 0, 1);
      total.brightness += brightness;
      fragmentCount += 1;
    }
  }

  const batches = [];
  for (let band = 0; band < runs.length; band += 1) {
    const total = totals[band];
    if (total.count === 0) continue;
    batches.push(Object.freeze({
      pass,
      band,
      widthScale: total.width / total.count,
      opacityScale: total.opacity / total.count,
      brightness: total.brightness / total.count,
      runs: Object.freeze(runs[band].map((run) => Float32Array.from(run))),
    }));
  }
  return { batches, fragmentCount };
}

/** Build deterministic screen-space presentation state without mutating source geometry. */
export function buildChalkMaterial(points, style = {}, seed = 0, {
  spacing = clamp(style.grainSize ?? CHALK_MATERIAL_DEFAULTS.grainSize, 1, 2),
  closed = false,
  velocity = null,
  dwell = null,
  strokeWidth = style.width ?? 1,
} = {}) {
  if (!Number.isFinite(seed)) throw new TypeError('seed must be finite');
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    throw new RangeError('strokeWidth must be finite and greater than zero');
  }
  const normalized = normalizedMaterialStyle(style);
  const resampled = resamplePolyline(points, { spacing, closed });
  const sampleCount = resampled.length / 2;
  const lowSpan = Math.max(4, Math.round(10 + normalized.grainSize * 2));
  const highSpan = Math.max(1, Math.round(normalized.grainSize));
  const profiles = makeProfiles(
    sampleCount,
    normalized,
    seed | 0,
    velocity,
    dwell,
    lowSpan,
  );
  const passes = Math.max(1, Math.min(4, Math.round(style.passes ?? 1)));
  const clean = normalized.pressure === 1
    && normalized.coverage === 1
    && normalized.wobble + normalized.pressureVariation + normalized.edgeBreakup
      + normalized.dust + normalized.softness + normalized.accumulation
      + (normalized.grain ?? 0) === 0;
  const carrierBatches = [];
  const batches = [];
  let segmentCount = 0;
  let fragmentCount = 0;

  for (let pass = 0; pass < passes; pass += 1) {
    const centerline = deformCenterline(
      resampled,
      normalized,
      pass,
      seed | 0,
      closed,
      lowSpan,
      highSpan,
    );
    carrierBatches.push(Object.freeze({
      pass, widthScale: clean ? 1 : 0.88, opacityScale: clean ? 1 : 0.22,
      points: centerline, closed,
    }));
    segmentCount += closed ? sampleCount : sampleCount - 1;
    if (clean) continue;

    const passMaterial = buildPassDeposits(
      centerline,
      profiles,
      normalized,
      strokeWidth,
      pass,
      seed | 0,
      closed,
    );
    batches.push(...passMaterial.batches);
    fragmentCount += passMaterial.fragmentCount;
  }

  return Object.freeze({
    resampled, sampleCount, segmentCount, fragmentCount, profiles,
    carrierBatches: Object.freeze(carrierBatches),
    batches: Object.freeze(batches),
  });
}
