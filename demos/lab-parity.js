const REPLAY_SCHEMA = 'chalkish-lab-replay';
const REPLAY_VERSION = 1;

export class RingHistory {
  constructor(keys, capacity = 120) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new TypeError('RingHistory keys must be a non-empty array');
    }
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new RangeError('RingHistory capacity must be an integer of at least two');
    }
    this.keys = Object.freeze([...keys]);
    this.capacity = capacity;
    this.buffers = Object.fromEntries(keys.map((key) => [key, new Float64Array(capacity)]));
    this.head = 0;
    this.length = 0;
  }

  clear() {
    this.head = 0;
    this.length = 0;
    return this;
  }

  push(sample) {
    for (const key of this.keys) {
      const value = Number(sample[key]);
      this.buffers[key][this.head] = Number.isFinite(value) ? value : Number.NaN;
    }
    this.head = (this.head + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
    return this;
  }

  copy(key, output = new Float64Array(this.length)) {
    if (!this.buffers[key]) throw new RangeError(`Unknown history key: ${key}`);
    if (output.length < this.length) throw new RangeError('History output buffer is too small');
    const start = (this.head - this.length + this.capacity) % this.capacity;
    for (let index = 0; index < this.length; index += 1) {
      output[index] = this.buffers[key][(start + index) % this.capacity];
    }
    return output.subarray(0, this.length);
  }
}

export class FrameMeter {
  constructor(windowMs = 700) {
    this.windowMs = windowMs;
    this.reset();
  }

  reset(now = 0) {
    this.started = now;
    this.frames = 0;
    this.fps = 0;
    return this;
  }

  sample(now) {
    if (!Number.isFinite(now)) return this.fps;
    if (this.started === 0) this.started = now;
    this.frames += 1;
    const elapsed = now - this.started;
    if (elapsed >= this.windowMs) {
      this.fps = 1000 * this.frames / Math.max(1, elapsed);
      this.started = now;
      this.frames = 0;
    }
    return this.fps;
  }
}

export function makeReplayDocument(lab, parameters) {
  if (typeof lab !== 'string' || lab.length === 0) throw new TypeError('Replay lab is required');
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new TypeError('Replay parameters must be an object');
  }
  return Object.freeze({
    schema: REPLAY_SCHEMA,
    version: REPLAY_VERSION,
    lab,
    parameters: Object.freeze({ ...parameters }),
  });
}

export function parseReplayDocument(source, expectedLab) {
  const value = typeof source === 'string' ? JSON.parse(source) : source;
  if (!value || value.schema !== REPLAY_SCHEMA || value.version !== REPLAY_VERSION) {
    throw new RangeError(`Expected ${REPLAY_SCHEMA} version ${REPLAY_VERSION}`);
  }
  if (value.lab !== expectedLab) {
    throw new RangeError(`Replay is for ${String(value.lab)}, expected ${expectedLab}`);
  }
  if (!value.parameters || typeof value.parameters !== 'object' || Array.isArray(value.parameters)) {
    throw new TypeError('Replay parameters must be an object');
  }
  return Object.freeze({ ...value.parameters });
}

export function nextSeed(seed) {
  const value = Number(seed);
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer');
  }
  return (Math.imul(value ^ 0xa5a5a5a5, 1664525) + 1013904223) >>> 0;
}
