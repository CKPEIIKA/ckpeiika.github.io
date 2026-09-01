import { clamp, random01 } from './math.js';
import {
  CHALK_MATERIAL_DEFAULTS,
  validateChalkMaterialStyle,
} from './chalk-material.js';

const BASE = Object.freeze({
  stroke: '#f2efe6',
  fill: null,
  width: 2,
  opacity: 1,
  roughness: 0.6,
  passes: 2,
  grain: 0.18,
  ...CHALK_MATERIAL_DEFAULTS,
  velocity: 0,
  dwell: 0,
  dash: null,
  lineCap: 'round',
  lineJoin: 'round',
  composite: 'source-over',
});

export const CHALK_PRESETS = Object.freeze({
  clean: Object.freeze({
    ...BASE,
    roughness: 0,
    passes: 1,
    grain: 0,
    wobble: 0,
    pressure: 1,
    pressureVariation: 0,
    coverage: 1,
    edgeBreakup: 0,
    dust: 0,
    softness: 0,
    accumulation: 0,
  }),
  soft: Object.freeze({ ...BASE, width: 2.2, roughness: 0.55, passes: 2, grain: 0.12 }),
  dusty: Object.freeze({
    ...BASE,
    width: 2.7,
    roughness: 0.9,
    passes: 3,
    grain: 0.32,
    opacity: 0.9,
    wobble: 0.8,
    pressure: 0.58,
    pressureVariation: 0.25,
    coverage: 0.76,
    edgeBreakup: 0.3,
    grainSize: 1.3,
    dust: 0.35,
    softness: 0.55,
    accumulation: 0.25,
  }),
  rough: Object.freeze({
    ...BASE,
    width: 2.4,
    roughness: 1.35,
    passes: 3,
    grain: 0.22,
    wobble: 1.15,
    pressure: 0.7,
    pressureVariation: 0.3,
    coverage: 0.84,
    edgeBreakup: 0.24,
    grainSize: 1.15,
    dust: 0.18,
    softness: 0.25,
    accumulation: 0.18,
  }),
  technical: Object.freeze({
    ...BASE,
    width: 1.5,
    roughness: 0.22,
    passes: 2,
    grain: 0.05,
    wobble: 0.2,
    pressure: 0.76,
    pressureVariation: 0.06,
    coverage: 0.98,
    edgeBreakup: 0.04,
    grainSize: 1.7,
    dust: 0.02,
    softness: 0.12,
    accumulation: 0.05,
  }),
});

function validateStyle(style) {
  if (!Number.isFinite(style.width) || style.width <= 0) {
    throw new RangeError('style.width must be greater than zero');
  }
  if (!Number.isFinite(style.opacity)) throw new TypeError('style.opacity must be finite');
  if (!Number.isFinite(style.roughness) || style.roughness < 0) {
    throw new RangeError('style.roughness must not be negative');
  }
  if (!Number.isFinite(style.grain)) throw new TypeError('style.grain must be finite');
  if (!Number.isFinite(style.passes)) throw new TypeError('style.passes must be finite');
  if (!Number.isFinite(style.velocity) || style.velocity < 0) throw new RangeError('style.velocity must be finite and non-negative');
  if (!Number.isFinite(style.dwell) || style.dwell < 0) throw new RangeError('style.dwell must be finite and non-negative');
  validateChalkMaterialStyle(style);
  style.opacity = clamp(style.opacity, 0, 1);
  style.grain = clamp(style.grain, 0, 1);
  style.passes = clamp(Math.round(style.passes), 1, 4);
  if (style.dash !== null && !Array.isArray(style.dash) && !ArrayBuffer.isView(style.dash)) {
    throw new TypeError('style.dash must be null or an array-like sequence');
  }
  return style;
}

export function chalkStyle(name = 'soft', overrides = {}) {
  const preset = typeof name === 'string' ? CHALK_PRESETS[name] : name;
  if (!preset) throw new RangeError(`unknown chalk preset: ${name}`);
  const style = { ...BASE, ...preset, ...overrides };
  if (
    Object.hasOwn(overrides, 'roughness')
    && !Object.hasOwn(overrides, 'wobble')
  ) {
    style.wobble = overrides.roughness;
  } else if (
    typeof name !== 'string'
    && Object.hasOwn(preset, 'roughness')
    && !Object.hasOwn(preset, 'wobble')
  ) {
    style.wobble = preset.roughness;
  }
  return validateStyle(style);
}

export function styleFingerprint(style) {
  const dash = style.dash ? Array.from(style.dash).join(',') : '';
  return [
    style.stroke,
    style.fill,
    style.width,
    style.opacity,
    style.roughness,
    style.passes,
    style.grain,
    style.wobble,
    style.pressure,
    style.pressureVariation,
    style.coverage,
    style.edgeBreakup,
    style.grainSize,
    style.dust,
    style.softness,
    style.accumulation,
    style.velocity,
    style.dwell,
    dash,
    style.lineCap,
    style.lineJoin,
    style.composite,
  ].join('|');
}

/**
 * Build deterministic screen-space rough paths from packed [x,y] points.
 * Call this only when geometry, transform, camera, or style changes, then cache it.
 */
export function buildRoughPolyline(points, style, seed = 0) {
  if (!points || points.length < 4 || points.length % 2 !== 0) {
    throw new RangeError('points must contain at least two packed 2D points');
  }
  const normalized = validateStyle({ ...BASE, ...style });
  const pointCount = points.length / 2;
  const paths = new Array(normalized.passes);

  for (let pass = 0; pass < normalized.passes; pass += 1) {
    const path = new Float32Array(points.length);
    const passSeed = (seed ^ Math.imul(pass + 1, 0x9e3779b1)) | 0;

    for (let index = 0; index < pointCount; index += 1) {
      const previous = index === 0 ? 0 : index - 1;
      const next = index === pointCount - 1 ? pointCount - 1 : index + 1;
      const px = points[previous * 2];
      const py = points[previous * 2 + 1];
      const nx = points[next * 2];
      const ny = points[next * 2 + 1];
      const dx = nx - px;
      const dy = ny - py;
      const length = Math.hypot(dx, dy) || 1;
      const tangentX = dx / length;
      const tangentY = dy / length;
      const normalX = -tangentY;
      const normalY = tangentX;
      const endpointScale = index === 0 || index === pointCount - 1 ? 0.45 : 1;
      const noiseIndex = index * 4;
      const normalNoise = (random01(noiseIndex, passSeed) * 2 - 1)
        * normalized.roughness * endpointScale;
      const tangentNoise = (random01(noiseIndex + 1, passSeed) * 2 - 1)
        * normalized.roughness * normalized.grain * endpointScale;

      path[index * 2] = points[index * 2]
        + normalX * normalNoise
        + tangentX * tangentNoise;
      path[index * 2 + 1] = points[index * 2 + 1]
        + normalY * normalNoise
        + tangentY * tangentNoise;
    }
    paths[pass] = path;
  }
  return paths;
}

export function passOpacity(style, pass) {
  if (style.passes <= 1) return style.opacity;
  const base = style.opacity / Math.sqrt(style.passes);
  const variation = 1 - style.grain * 0.18 * (pass / (style.passes - 1));
  return clamp(base * variation, 0, 1);
}
