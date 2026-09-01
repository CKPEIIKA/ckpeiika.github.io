import { Mobject } from './core.js';

function unchanged(ErrorType, message, subject = 'segment') {
  if (subject === 'boundary geometry') {
    return new ErrorType(`${message} No boundary geometry was produced.`);
  }
  return new ErrorType(`${message} No ${subject} state was changed.`);
}

function packedSegments(segments, copy) {
  if (!segments || typeof segments.length !== 'number') {
    throw unchanged(
      TypeError,
      'segments must be an array-like packed as [x1,y1,x2,y2,...].',
    );
  }
  if (!Number.isInteger(segments.length) || segments.length % 4 !== 0) {
    throw unchanged(
      RangeError,
      `segments length is ${String(segments.length)}; expected a multiple of four.`,
    );
  }
  if (!copy && ArrayBuffer.isView(segments)) return segments;
  return Float32Array.from(segments);
}

function validateCount(count, capacity) {
  if (!Number.isInteger(count) || count < 0 || count > capacity) {
    throw unchanged(
      RangeError,
      `SegmentLayer count is ${count}; expected an integer from 0 to ${capacity}.`,
    );
  }
}

/**
 * Data-sized independent line segments backed by packed caller-owned endpoints.
 *
 * Each segment occupies four consecutive values: [x1, y1, x2, y2]. Mutate a
 * bound typed array in place, then call markDataDirty(). The renderer batches
 * every active segment by render state instead of creating one Mobject per line.
 */
export class SegmentLayer extends Mobject {
  constructor({
    segments = new Float32Array(0),
    count = undefined,
    copy = false,
    ...options
  } = {}) {
    super('segment-layer', options);
    const packed = packedSegments(segments, copy);
    const capacity = packed.length / 4;
    const activeCount = count ?? capacity;
    validateCount(activeCount, capacity);
    this.segments = packed;
    this.count = activeCount;
    this.dataVersion = 1;
  }

  get capacity() {
    return this.segments.length / 4;
  }

  setCount(count) {
    validateCount(count, this.capacity);
    if (count !== this.count) {
      this.count = count;
      this.markDataDirty();
    }
    return this;
  }

  setSegments(segments, {
    count = undefined,
    copy = false,
  } = {}) {
    const packed = packedSegments(segments, copy);
    const capacity = packed.length / 4;
    const activeCount = count ?? capacity;
    validateCount(activeCount, capacity);
    this.segments = packed;
    this.count = activeCount;
    return this.markDataDirty();
  }

  markDataDirty() {
    this.dataVersion += 1;
    return this;
  }
}

function validateGrid({
  columns,
  rows,
  minX,
  maxX,
  minY,
  maxY,
}, subject = 'grid') {
  for (const [name, value] of [['columns', columns], ['rows', rows]]) {
    if (!Number.isInteger(value) || value < 1) {
      throw unchanged(
        RangeError,
        `${name} is ${String(value)}; expected a positive integer.`,
        subject,
      );
    }
  }
  for (const [name, value] of [
    ['minX', minX],
    ['maxX', maxX],
    ['minY', minY],
    ['maxY', maxY],
  ]) {
    if (!Number.isFinite(value)) {
      throw unchanged(
        TypeError,
        `${name} is ${String(value)}; expected a finite number.`,
        subject,
      );
    }
  }
  if (minX >= maxX || minY >= maxY) {
    throw unchanged(
      RangeError,
      `grid domain is [${minX}, ${maxX}] × [${minY}, ${maxY}]; expected increasing bounds.`,
      subject,
    );
  }
  return {
    columns,
    rows,
    minX,
    maxX,
    minY,
    maxY,
  };
}

function gridSegments(config) {
  const {
    columns,
    rows,
    minX,
    maxX,
    minY,
    maxY,
  } = config;
  const output = new Float32Array((columns + rows + 2) * 4);
  const stepX = (maxX - minX) / columns;
  const stepY = (maxY - minY) / rows;
  let offset = 0;
  for (let column = 0; column <= columns; column += 1) {
    const x = column === columns ? maxX : minX + column * stepX;
    output[offset] = x;
    output[offset + 1] = minY;
    output[offset + 2] = x;
    output[offset + 3] = maxY;
    offset += 4;
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = row === rows ? maxY : minY + row * stepY;
    output[offset] = minX;
    output[offset + 1] = y;
    output[offset + 2] = maxX;
    output[offset + 3] = y;
    offset += 4;
  }
  return output;
}

/**
 * Uniform Cartesian cell boundaries represented as one packed SegmentLayer.
 */
export class CartesianGrid extends SegmentLayer {
  constructor({
    columns = 1,
    rows = 1,
    minX = 0,
    maxX = 1,
    minY = 0,
    maxY = 1,
    ...options
  } = {}) {
    const config = validateGrid({
      columns,
      rows,
      minX,
      maxX,
      minY,
      maxY,
    });
    super({
      segments: gridSegments(config),
      copy: false,
      ...options,
    });
    this.kind = 'cartesian-grid';
    Object.assign(this, config);
  }

  setGrid(patch = {}) {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
      throw unchanged(TypeError, 'grid patch must be an object.', 'grid');
    }
    const config = validateGrid({
      columns: patch.columns ?? this.columns,
      rows: patch.rows ?? this.rows,
      minX: patch.minX ?? this.minX,
      maxX: patch.maxX ?? this.maxX,
      minY: patch.minY ?? this.minY,
      maxY: patch.maxY ?? this.maxY,
    });
    if (config.columns === this.columns
        && config.rows === this.rows
        && config.minX === this.minX
        && config.maxX === this.maxX
        && config.minY === this.minY
        && config.maxY === this.maxY) {
      return this;
    }
    const segments = gridSegments(config);
    this.setSegments(segments, { copy: false });
    Object.assign(this, config);
    return this;
  }
}

function validateMask(mask, columns, rows) {
  if (!mask || typeof mask.length !== 'number') {
    throw unchanged(
      TypeError,
      'mask must be an array-like row-major cell mask.',
      'boundary geometry',
    );
  }
  if (!Number.isInteger(columns) || columns < 1
      || !Number.isInteger(rows) || rows < 1) {
    throw unchanged(
      RangeError,
      `mask dimensions are ${columns} × ${rows}; expected positive integers.`,
      'boundary geometry',
    );
  }
  const expected = columns * rows;
  if (mask.length !== expected) {
    throw unchanged(
      RangeError,
      `mask length is ${mask.length}; expected columns × rows = ${expected}.`,
      'boundary geometry',
    );
  }
}

/**
 * Convert a row-major cell mask into exact cell-face boundary segments.
 *
 * Non-zero cells are treated as occupied. The result is drawing geometry only:
 * it does not infer what occupancy means and does not smooth the cell boundary.
 */
export function cellMaskBoundarySegments(mask, columns, rows, {
  minX = 0,
  maxX = 1,
  minY = 0,
  maxY = 1,
} = {}) {
  validateMask(mask, columns, rows);
  const domain = validateGrid({
    columns,
    rows,
    minX,
    maxX,
    minY,
    maxY,
  }, 'boundary geometry');
  const occupied = (column, row) => (
    column >= 0
    && column < columns
    && row >= 0
    && row < rows
    && Boolean(mask[row * columns + column])
  );
  let count = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!occupied(column, row)) continue;
      if (!occupied(column - 1, row)) count += 1;
      if (!occupied(column + 1, row)) count += 1;
      if (!occupied(column, row - 1)) count += 1;
      if (!occupied(column, row + 1)) count += 1;
    }
  }
  if (count === 0) return new Float32Array(0);

  const output = new Float32Array(count * 4);
  const stepX = (domain.maxX - domain.minX) / columns;
  const stepY = (domain.maxY - domain.minY) / rows;
  let offset = 0;
  const append = (x1, y1, x2, y2) => {
    output[offset] = x1;
    output[offset + 1] = y1;
    output[offset + 2] = x2;
    output[offset + 3] = y2;
    offset += 4;
  };

  for (let row = 0; row < rows; row += 1) {
    const y0 = domain.minY + row * stepY;
    const y1 = row + 1 === rows ? domain.maxY : y0 + stepY;
    for (let column = 0; column < columns; column += 1) {
      if (!occupied(column, row)) continue;
      const x0 = domain.minX + column * stepX;
      const x1 = column + 1 === columns ? domain.maxX : x0 + stepX;
      if (!occupied(column - 1, row)) append(x0, y0, x0, y1);
      if (!occupied(column + 1, row)) append(x1, y0, x1, y1);
      if (!occupied(column, row - 1)) append(x0, y0, x1, y0);
      if (!occupied(column, row + 1)) append(x0, y1, x1, y1);
    }
  }
  return output;
}
