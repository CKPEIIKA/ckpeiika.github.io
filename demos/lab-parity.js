const REPLAY_SCHEMA = 'chalkish-lab-replay';
const REPLAY_VERSION = 1;

// The streaming history buffer now lives in Chalkish; this name stays for the labs.
export { HistoryBuffer as RingHistory } from '../lib/chalkish/src/history.js';

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
