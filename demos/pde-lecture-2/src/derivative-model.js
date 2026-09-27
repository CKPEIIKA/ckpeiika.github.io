import { differentiateUniform1D } from '../../lib/chalkish/src/calculus.js';

export const DERIVATIVE_PRESETS = Object.freeze([
  'line',
  'parabola',
  'gaussian',
  'sine',
  'smooth-step',
  'drawing',
]);

const DEFAULTS = Object.freeze({
  preset: 'gaussian',
  amplitude: 1,
  width: 0.28,
  position: 0,
});

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function presetValue(preset, x, amplitude, width, position) {
  const z = (x - position) / width;
  if (preset === 'line') return amplitude * z;
  if (preset === 'parabola') return amplitude * (1 - z * z);
  if (preset === 'gaussian') return amplitude * Math.exp(-0.5 * z * z);
  if (preset === 'sine') return amplitude * Math.sin(Math.PI * z);
  if (preset === 'smooth-step') return amplitude * Math.tanh(z);
  return 0;
}

export class DerivativeMicroscopeModel {
  constructor({ samples = 257, ...parameters } = {}) {
    if (!Number.isInteger(samples) || samples < 33 || samples > 4097) {
      throw new RangeError('samples must be an integer from 33 to 4097');
    }
    this.samples = samples;
    this.minX = -1;
    this.maxX = 1;
    this.spacing = (this.maxX - this.minX) / (samples - 1);
    this.x = new Float64Array(samples);
    this.value = new Float64Array(samples);
    this.first = new Float64Array(samples);
    this.second = new Float64Array(samples);
    for (let index = 0; index < samples; index += 1) {
      this.x[index] = this.minX + index * this.spacing;
    }
    this.parameters = { ...DEFAULTS };
    this.reset(parameters);
  }

  reset(parameters = {}) {
    const next = { ...DEFAULTS, ...parameters };
    this.setParameters(next, { forcePreset: true });
    return this;
  }

  setParameters(patch, { forcePreset = false } = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('parameter patch must be an object');
    }
    const next = { ...this.parameters, ...patch };
    if (!DERIVATIVE_PRESETS.includes(next.preset)) {
      throw new RangeError(`unknown derivative preset ${String(next.preset)}`);
    }
    finite(next.amplitude, 'amplitude');
    finite(next.width, 'width');
    finite(next.position, 'position');
    if (next.amplitude < 0.1 || next.amplitude > 2) {
      throw new RangeError('amplitude must be between 0.1 and 2');
    }
    if (next.width < 0.08 || next.width > 1) {
      throw new RangeError('width must be between 0.08 and 1');
    }
    if (next.position < this.minX || next.position > this.maxX) {
      throw new RangeError('position must be inside the profile domain');
    }
    const presetChanged = next.preset !== this.parameters.preset;
    this.parameters = Object.freeze(next);
    if (next.preset !== 'drawing') {
      for (let index = 0; index < this.samples; index += 1) {
        this.value[index] = presetValue(
          next.preset,
          this.x[index],
          next.amplitude,
          next.width,
          next.position,
        );
      }
    } else if (presetChanged || forcePreset) {
      this.value.fill(0);
    }
    this._differentiate();
    return this;
  }

  drawSegment(startX, startValue, endX, endValue) {
    for (const [value, name] of [
      [startX, 'startX'], [startValue, 'startValue'],
      [endX, 'endX'], [endValue, 'endValue'],
    ]) finite(value, name);
    if (this.parameters.preset !== 'drawing') {
      this.setParameters({ preset: 'drawing' });
    }
    const firstIndex = Math.round(
      (clamp(startX, this.minX, this.maxX) - this.minX) / this.spacing,
    );
    const lastIndex = Math.round(
      (clamp(endX, this.minX, this.maxX) - this.minX) / this.spacing,
    );
    const direction = firstIndex <= lastIndex ? 1 : -1;
    const count = Math.abs(lastIndex - firstIndex);
    for (let offset = 0; offset <= count; offset += 1) {
      const fraction = count === 0 ? 1 : offset / count;
      const index = firstIndex + direction * offset;
      this.value[index] = clamp(
        startValue + (endValue - startValue) * fraction,
        -2.5,
        2.5,
      );
    }
    this._differentiate();
    return this;
  }

  probe(x) {
    finite(x, 'probe x');
    const bounded = clamp(x, this.minX, this.maxX);
    const coordinate = (bounded - this.minX) / this.spacing;
    const left = Math.min(this.samples - 2, Math.max(0, Math.floor(coordinate)));
    const fraction = coordinate - left;
    const interpolate = (values) => (
      values[left] + (values[left + 1] - values[left]) * fraction
    );
    return Object.freeze({
      x: bounded,
      value: interpolate(this.value),
      first: interpolate(this.first),
      second: interpolate(this.second),
    });
  }

  _differentiate() {
    differentiateUniform1D(this.value, this.spacing, this.first, this.second);
  }
}
