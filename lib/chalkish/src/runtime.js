import { Canvas2DRenderer } from './canvas2d.js';
import { Camera2D, Scene } from './core.js';
import { clamp } from './math.js';

function validatePlaybackRate(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`playbackRate is ${String(value)}; expected a finite value greater than zero`);
  }
  return value;
}

export class FixedStepClock {
  constructor({ step = 1 / 60, maxSteps = 5, maxDelta = 0.25 } = {}) {
    if (!Number.isFinite(step) || step <= 0) throw new RangeError('step must be positive');
    if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError('maxSteps must be a positive integer');
    if (!Number.isFinite(maxDelta) || maxDelta <= 0) throw new RangeError('maxDelta must be positive');
    this.step = step;
    this.maxSteps = maxSteps;
    this.maxDelta = maxDelta;
    this.lastTime = null;
    this.accumulator = 0;
    this.simulationTime = 0;
  }

  reset(nowMs = null) {
    if (nowMs !== null && !Number.isFinite(nowMs)) {
      throw new TypeError('nowMs must be null or finite');
    }
    this.lastTime = nowMs;
    this.accumulator = 0;
    this.simulationTime = 0;
    return this;
  }

  resume(nowMs = null) {
    if (nowMs !== null && !Number.isFinite(nowMs)) {
      throw new TypeError('nowMs must be null or finite');
    }
    this.lastTime = nowMs;
    this.accumulator = 0;
    return this;
  }

  advance(nowMs, update, playbackRate = 1) {
    if (!Number.isFinite(nowMs)) throw new TypeError('nowMs must be finite');
    if (typeof update !== 'function') throw new TypeError('update must be a function');
    validatePlaybackRate(playbackRate);
    if (this.lastTime === null) {
      this.lastTime = nowMs;
      return { delta: 0, steps: 0, alpha: 0, dropped: false };
    }

    const wallDelta = clamp((nowMs - this.lastTime) / 1000, 0, this.maxDelta);
    const delta = wallDelta * playbackRate;
    this.lastTime = nowMs;
    this.accumulator += delta;
    let steps = 0;
    while (this.accumulator + Number.EPSILON >= this.step && steps < this.maxSteps) {
      update(this.step, this.simulationTime);
      this.accumulator -= this.step;
      this.simulationTime += this.step;
      steps += 1;
    }

    let dropped = false;
    if (this.accumulator >= this.step) {
      dropped = true;
      this.accumulator %= this.step;
    }
    const alpha = clamp(this.accumulator / this.step, 0, 0.999999999);
    return { delta, steps, alpha, dropped };
  }
}

export const QUALITY_PROFILES = Object.freeze([
  Object.freeze({ name: 'high', dprMax: 2, fieldStride: 1, particleStride: 1, curveTolerance: 0.65 }),
  Object.freeze({ name: 'balanced', dprMax: 1.75, fieldStride: 1, particleStride: 2, curveTolerance: 0.9 }),
  Object.freeze({ name: 'low', dprMax: 1.35, fieldStride: 2, particleStride: 3, curveTolerance: 1.25 }),
  Object.freeze({ name: 'minimum', dprMax: 1, fieldStride: 3, particleStride: 5, curveTolerance: 1.8 }),
]);

export class QualityController {
  constructor({
    targetMs = 1000 / 60,
    slowFrames = 30,
    fastFrames = 180,
    cooldownFrames = 90,
    profiles = QUALITY_PROFILES,
  } = {}) {
    if (!Number.isFinite(targetMs) || targetMs <= 0) throw new RangeError('targetMs must be positive');
    if (!Array.isArray(profiles) || profiles.length === 0) throw new TypeError('profiles must be a non-empty array');
    this.targetMs = targetMs;
    this.slowFrames = slowFrames;
    this.fastFrames = fastFrames;
    this.cooldownFrames = cooldownFrames;
    this.profiles = profiles;
    this.level = 0;
    this.emaMs = targetMs;
    this._slowCount = 0;
    this._fastCount = 0;
    this._cooldown = 0;
  }

  get profile() {
    return this.profiles[this.level];
  }

  setLevel(level) {
    this.level = clamp(Math.round(level), 0, this.profiles.length - 1);
    this._slowCount = 0;
    this._fastCount = 0;
    this._cooldown = this.cooldownFrames;
    return this.profile;
  }

  sample(frameMs) {
    if (!Number.isFinite(frameMs) || frameMs < 0) return this.profile;
    this.emaMs += (frameMs - this.emaMs) * 0.08;
    if (this._cooldown > 0) {
      this._cooldown -= 1;
      return this.profile;
    }

    if (frameMs > this.targetMs * 1.15) {
      this._slowCount += 1;
      this._fastCount = 0;
    } else if (frameMs < this.targetMs * 0.75) {
      this._fastCount += 1;
      this._slowCount = 0;
    } else {
      this._slowCount = 0;
      this._fastCount = 0;
    }

    if (this._slowCount >= this.slowFrames && this.level < this.profiles.length - 1) {
      this.setLevel(this.level + 1);
    } else if (this._fastCount >= this.fastFrames && this.level > 0) {
      this.setLevel(this.level - 1);
    }
    return this.profile;
  }
}

export class TransferPool {
  constructor({ maxPerSize = 2 } = {}) {
    if (!Number.isInteger(maxPerSize) || maxPerSize < 0) {
      throw new RangeError('maxPerSize must be a non-negative integer');
    }
    this.maxPerSize = maxPerSize;
    this._buckets = new Map();
    this.retainedBuffers = 0;
    this.retainedBytes = 0;
  }

  acquire(byteLength) {
    if (!Number.isInteger(byteLength) || byteLength < 0) {
      throw new RangeError('byteLength must be a non-negative integer');
    }
    const bucket = this._buckets.get(byteLength);
    if (bucket?.length) {
      this.retainedBuffers -= 1;
      this.retainedBytes -= byteLength;
      return bucket.pop();
    }
    return new ArrayBuffer(byteLength);
  }

  release(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.detached) return false;
    const byteLength = buffer.byteLength;
    let bucket = this._buckets.get(byteLength);
    if (!bucket) {
      bucket = [];
      this._buckets.set(byteLength, bucket);
    }
    if (bucket.length >= this.maxPerSize) return false;
    bucket.push(buffer);
    this.retainedBuffers += 1;
    this.retainedBytes += byteLength;
    return true;
  }

  clear() {
    this._buckets.clear();
    this.retainedBuffers = 0;
    this.retainedBytes = 0;
  }
}

/** Thin worker wrapper. Message schemas remain application-owned and inspectable. */
export class WorkerBridge {
  constructor(worker, { onMessage = null, onError = null } = {}) {
    if (!worker || typeof worker.postMessage !== 'function') {
      throw new TypeError('worker must provide postMessage');
    }
    this.worker = worker;
    this.onMessage = onMessage;
    this.onError = onError;
    this._handleMessage = (event) => this.onMessage?.(event.data, event);
    this._handleError = (event) => this.onError?.(event);
    worker.addEventListener?.('message', this._handleMessage);
    worker.addEventListener?.('error', this._handleError);
  }

  post(type, payload = null, transfer = []) {
    this.worker.postMessage({ type, payload }, transfer);
    return this;
  }

  dispose({ terminate = false } = {}) {
    this.worker.removeEventListener?.('message', this._handleMessage);
    this.worker.removeEventListener?.('error', this._handleError);
    if (terminate) this.worker.terminate?.();
  }
}

function protocolLabel(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function protocolCallback(value, name) {
  if (value !== null && typeof value !== 'function') {
    throw new TypeError(`${name} must be null or a function`);
  }
  return value;
}

function validateSnapshotBuffers(buffers) {
  if (!Array.isArray(buffers)) {
    throw new TypeError('snapshot buffers must be an array of unique ArrayBuffers');
  }
  const unique = new Set();
  for (const buffer of buffers) {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new TypeError('snapshot buffers must contain only ArrayBuffers');
    }
    if (unique.has(buffer)) {
      throw new RangeError('snapshot buffers must contain unique ArrayBuffers');
    }
    unique.add(buffer);
  }
  return Object.freeze([...buffers]);
}

/**
 * Newest-only, versioned worker snapshot transport.
 *
 * Snapshot envelopes have the form:
 * `{ type, schemaVersion, sequence, payload, buffers }`.
 *
 * Ownership transfers to this bridge when an envelope arrives. Superseded or
 * stale envelopes are returned immediately with a `recycle` message. A
 * delivered envelope is represented by a lease; ownership transfers back only
 * when its idempotent release() method posts that recycle message.
 */
export class LatestSnapshotWorkerBridge {
  constructor(worker, {
    schemaVersion = 1,
    snapshotType = 'snapshot',
    recycleType = 'recycle',
    onSnapshotAvailable = null,
    onMessage = null,
    onError = null,
  } = {}) {
    if (!worker || typeof worker.postMessage !== 'function') {
      throw new TypeError('worker must provide postMessage');
    }
    if (typeof worker.addEventListener !== 'function'
        || typeof worker.removeEventListener !== 'function') {
      throw new TypeError('worker must provide addEventListener and removeEventListener');
    }
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
      throw new RangeError('schemaVersion must be a positive integer');
    }
    this.worker = worker;
    this.schemaVersion = schemaVersion;
    this.snapshotType = protocolLabel(snapshotType, 'snapshotType');
    this.recycleType = protocolLabel(recycleType, 'recycleType');
    if (this.snapshotType === this.recycleType) {
      throw new RangeError('snapshotType and recycleType must be different');
    }
    this.onSnapshotAvailable = protocolCallback(
      onSnapshotAvailable,
      'onSnapshotAvailable',
    );
    this.onMessage = protocolCallback(onMessage, 'onMessage');
    this.onError = protocolCallback(onError, 'onError');
    this._pending = null;
    this._leases = new Set();
    this._latestSequence = -1;
    this._receivedSnapshots = 0;
    this._deliveredSnapshots = 0;
    this._droppedSnapshots = 0;
    this._recycledSnapshots = 0;
    this._disposed = false;
    this._terminated = false;
    this._handleMessage = (event) => {
      try {
        this._receive(event?.data);
      } catch (error) {
        this._reportError(error);
      }
    };
    this._handleError = (event) => this._reportError(event);
    worker.addEventListener('message', this._handleMessage);
    worker.addEventListener('error', this._handleError);
  }

  _reportError(error) {
    if (this.onError) {
      this.onError(error);
      return;
    }
    throw error;
  }

  _validateEnvelope(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new TypeError('snapshot envelope must be an object');
    }
    if (message.schemaVersion !== this.schemaVersion) {
      throw new RangeError(
        `snapshot schemaVersion is ${String(message.schemaVersion)}; `
        + `expected ${this.schemaVersion}. No pending snapshot was replaced.`,
      );
    }
    if (!Number.isInteger(message.sequence) || message.sequence < 0) {
      throw new RangeError(
        `snapshot sequence is ${String(message.sequence)}; `
        + 'expected a non-negative integer. No pending snapshot was replaced.',
      );
    }
    if (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload)) {
      throw new TypeError(
        'snapshot payload must be an object. No pending snapshot was replaced.',
      );
    }
    return Object.freeze({
      sequence: message.sequence,
      payload: message.payload,
      buffers: validateSnapshotBuffers(message.buffers ?? []),
    });
  }

  _receive(message) {
    if (!message || typeof message !== 'object') {
      throw new TypeError('worker message must be an object with a type');
    }
    if (message.type !== this.snapshotType) {
      this.onMessage?.(message);
      return;
    }
    const envelope = this._validateEnvelope(message);
    this._receivedSnapshots += 1;
    if (envelope.sequence <= this._latestSequence) {
      this._droppedSnapshots += 1;
      this._recycle(envelope);
      return;
    }
    if (this._pending) {
      this._droppedSnapshots += 1;
      this._recycle(this._pending);
    }
    this._latestSequence = envelope.sequence;
    this._pending = envelope;
    this.onSnapshotAvailable?.(this, envelope.sequence);
  }

  _recycle(envelope) {
    if (this._terminated) return false;
    this.worker.postMessage({
      type: this.recycleType,
      schemaVersion: this.schemaVersion,
      sequence: envelope.sequence,
      buffers: envelope.buffers,
    }, envelope.buffers);
    this._recycledSnapshots += 1;
    return true;
  }

  post(type, payload = null, transfer = []) {
    if (this._disposed) {
      throw new Error('latest snapshot bridge is disposed; no worker message was posted');
    }
    protocolLabel(type, 'message type');
    if (!Array.isArray(transfer)) throw new TypeError('transfer must be an array');
    this.worker.postMessage({
      type,
      schemaVersion: this.schemaVersion,
      payload,
    }, transfer);
    return this;
  }

  takeLatest() {
    if (!this._pending) return null;
    const envelope = this._pending;
    this._pending = null;
    this._deliveredSnapshots += 1;
    const token = {};
    this._leases.add(token);
    let released = false;
    const lease = Object.freeze({
      sequence: envelope.sequence,
      payload: envelope.payload,
      buffers: envelope.buffers,
      release: () => {
        if (released) return false;
        if (this._terminated) return false;
        released = true;
        this._leases.delete(token);
        this._recycle(envelope);
        return true;
      },
    });
    return lease;
  }

  diagnostics() {
    return Object.freeze({
      receivedSnapshots: this._receivedSnapshots,
      deliveredSnapshots: this._deliveredSnapshots,
      droppedSnapshots: this._droppedSnapshots,
      recycledSnapshots: this._recycledSnapshots,
      latestSequence: this._latestSequence < 0 ? null : this._latestSequence,
      pendingSequence: this._pending?.sequence ?? null,
      leasedSnapshots: this._leases.size,
    });
  }

  dispose({ terminate = false } = {}) {
    if (this._disposed) return;
    if (this._pending) {
      this._recycle(this._pending);
      this._pending = null;
    }
    this.worker.removeEventListener('message', this._handleMessage);
    this.worker.removeEventListener('error', this._handleError);
    this._disposed = true;
    if (terminate) {
      this.worker.terminate?.();
      this._terminated = true;
    }
  }
}

export class ChalkishApp {
  constructor(canvas, {
    scene = new Scene(),
    camera = new Camera2D(),
    renderer = null,
    update = null,
    fixedStep = 1 / 60,
    adaptiveQuality = true,
    quality = null,
    dprMax = 2,
    playbackRate = 1,
  } = {}) {
    if (!canvas) throw new TypeError('canvas is required');
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer ?? new Canvas2DRenderer(canvas);
    this.update = update;
    this.clock = fixedStep ? new FixedStepClock({ step: fixedStep }) : null;
    this.quality = quality ?? new QualityController();
    this.adaptiveQuality = adaptiveQuality;
    this.dprMax = dprMax;
    this.playbackRate = validatePlaybackRate(playbackRate);
    this.running = false;
    this._frameHandle = null;
    this._lastFrameMs = null;
    this._boundFrame = (now) => this._frame(now);
    this._resizeObserver = null;
    this.lastRenderStats = null;

    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(canvas);
    }
    this.resize();
  }

  resize() {
    const rectangle = this.canvas.getBoundingClientRect?.();
    const cssWidth = Math.max(1, rectangle?.width ?? this.canvas.clientWidth ?? this.canvas.width ?? 1);
    const cssHeight = Math.max(1, rectangle?.height ?? this.canvas.clientHeight ?? this.canvas.height ?? 1);
    const deviceRatio = globalThis.devicePixelRatio ?? 1;
    const profileCap = this.quality.profile.dprMax ?? this.dprMax;
    const ratio = Math.min(deviceRatio, this.dprMax, profileCap);
    this.renderer.resize(cssWidth, cssHeight, ratio);
    return this;
  }

  _step(dt, simulationTime) {
    this.update?.({ dt, time: simulationTime, scene: this.scene, camera: this.camera, app: this });
    this.scene.update(dt);
  }

  _frame(nowMs) {
    if (!this.running) return;
    if (this._lastFrameMs !== null && this.adaptiveQuality) {
      const oldLevel = this.quality.level;
      this.quality.sample(nowMs - this._lastFrameMs);
      if (this.quality.level !== oldLevel) this.resize();
    }
    this._lastFrameMs = nowMs;

    if (this.clock) {
      this.clock.advance(
        nowMs,
        (dt, time) => this._step(dt, time),
        this.playbackRate,
      );
    } else {
      const dt = this._previousNow === undefined
        ? 0
        : clamp((nowMs - this._previousNow) / 1000, 0, 0.1) * this.playbackRate;
      this._previousNow = nowMs;
      this._step(dt, this.scene.time);
    }
    this.lastRenderStats = this.renderer.render(this.scene, this.camera, this.quality.profile);
    this._frameHandle = globalThis.requestAnimationFrame(this._boundFrame);
  }

  start() {
    if (this.running) return this;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      throw new Error('requestAnimationFrame is unavailable in this environment');
    }
    this.running = true;
    this._lastFrameMs = null;
    this._previousNow = undefined;
    this.clock?.resume(null);
    this._frameHandle = globalThis.requestAnimationFrame(this._boundFrame);
    return this;
  }

  stop() {
    this.running = false;
    if (this._frameHandle !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this._frameHandle);
    }
    this._frameHandle = null;
    return this;
  }

  render() {
    this.lastRenderStats = this.renderer.render(this.scene, this.camera, this.quality.profile);
    return this.lastRenderStats;
  }

  setPlaybackRate(value) {
    this.playbackRate = validatePlaybackRate(value);
    return this;
  }

  stepOnce(dt = this.clock?.step ?? 1 / 60) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be non-negative and finite');
    this._step(dt, this.scene.time);
    return this.render();
  }

  destroy() {
    this.stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }
}

export function mount(canvas, options) {
  return new ChalkishApp(canvas, options);
}
