// A bounded history of several series (time, drag, temperature, …) for streaming plots:
// fixed Float64Array storage, no allocation per sample; copy(key) returns the series in
// order, oldest first. Non-finite samples are kept as NaN (a gap in the plot).

export class HistoryBuffer {
  constructor(keys, capacity = 120) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new TypeError('HistoryBuffer keys must be a non-empty array');
    }
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new RangeError('HistoryBuffer capacity must be an integer of at least two');
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

  // 0, 1, 2, … as an x series for plots against the sample number.
  indices(output = new Float64Array(this.length)) {
    if (output.length < this.length) throw new RangeError('History output buffer is too small');
    for (let index = 0; index < this.length; index += 1) output[index] = index;
    return output.subarray(0, this.length);
  }
}
