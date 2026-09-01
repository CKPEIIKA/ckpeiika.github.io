import {
  Arrow,
  Group,
  Line,
  Polyline,
  Rectangle,
  TextLabel,
} from './core.js';
import { chalkStyle } from './chalk.js';

export function sampleFunction(fn, minX, maxX, samples = 128, options = {}) {
  if (typeof fn !== 'function') throw new TypeError('fn must be a function');
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX >= maxX) {
    throw new RangeError('sample interval must satisfy finite minX < maxX');
  }
  if (!Number.isInteger(samples) || samples < 2) throw new RangeError('samples must be an integer >= 2');
  const points = new Float32Array(samples * 2);
  const step = (maxX - minX) / (samples - 1);
  for (let index = 0; index < samples; index += 1) {
    const x = index === samples - 1 ? maxX : minX + index * step;
    points[index * 2] = x;
    points[index * 2 + 1] = fn(x, index);
  }
  return new Polyline(points, {
    ...options,
    copy: false,
    style: chalkStyle('technical', options.style),
  });
}

export function makeCellAverageDiagram(values, {
  x0 = 0,
  dx = 1,
  baseline = 0,
  fillFraction = 0.9,
  positiveFill = '#9fcab722',
  negativeFill = '#d27b7022',
  style = {},
  baselineStyle = {},
} = {}) {
  if (!values || typeof values.length !== 'number') throw new TypeError('values must be array-like');
  if (!Number.isFinite(dx) || dx <= 0) throw new RangeError('dx must be positive');
  const group = new Group([], { data: { values, x0, dx, baseline } });
  const cellStyle = chalkStyle('technical', style);

  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index]);
    if (!Number.isFinite(value)) continue;
    const height = Math.max(Math.abs(value - baseline), Number.EPSILON);
    const rectangle = new Rectangle(dx * fillFraction, height, {
      x: x0 + (index + 0.5) * dx,
      y: (value + baseline) * 0.5,
      style: {
        ...cellStyle,
        fill: value >= baseline ? positiveFill : negativeFill,
      },
      data: { index, value },
    });
    group.add(rectangle);
  }

  group.add(new Line(
    x0,
    baseline,
    x0 + values.length * dx,
    baseline,
    { style: chalkStyle('clean', baselineStyle), zIndex: 2 },
  ));
  return group;
}

export function makeStencil1D({
  center = 0,
  offsets = [-1, 0, 1],
  dx = 1,
  x0 = 0,
  y = 0,
  height = 0.7,
  label = (index) => String(index),
  style = {},
  centerStyle = {},
  labelStyle = {},
} = {}) {
  if (!Number.isInteger(center)) throw new TypeError('center must be an integer');
  if (!Array.isArray(offsets) || offsets.length === 0 || !offsets.every(Number.isInteger)) {
    throw new TypeError('offsets must be a non-empty array of integers');
  }
  if (!Number.isFinite(dx) || dx <= 0) throw new RangeError('dx must be positive');
  const indices = offsets.map((offset) => center + offset);
  const group = new Group([], {
    data: { center, offsets: offsets.slice(), indices, dx, x0 },
  });

  for (let position = 0; position < indices.length; position += 1) {
    const index = indices[position];
    const isCenter = index === center;
    const x = x0 + (index + 0.5) * dx;
    group.add(new Rectangle(dx * 0.92, height, {
      x,
      y,
      style: chalkStyle('technical', {
        fill: isCenter ? '#f6d86b22' : '#f3f0e80d',
        ...style,
        ...(isCenter ? centerStyle : null),
      }),
      data: { index, offset: offsets[position], isCenter },
    }));
    group.add(new TextLabel(label(index), {
      x,
      y,
      style: chalkStyle('clean', { fill: '#f3f0e8', stroke: null, ...labelStyle }),
      data: { index },
    }));
  }
  return group;
}

export function makeUniformGrid({
  columns,
  rows,
  minX = 0,
  minY = 0,
  dx = 1,
  dy = 1,
  style = {},
} = {}) {
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
    throw new RangeError('columns and rows must be positive integers');
  }
  const group = new Group([], {
    data: { columns, rows, minX, minY, dx, dy },
  });
  const lineStyle = chalkStyle('technical', style);
  for (let column = 0; column <= columns; column += 1) {
    const x = minX + column * dx;
    group.add(new Line(x, minY, x, minY + rows * dy, { style: lineStyle }));
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = minY + row * dy;
    group.add(new Line(minX, y, minX + columns * dx, y, { style: lineStyle }));
  }
  return group;
}

export function makeFluxArrows(fluxX, fluxY, {
  columns,
  rows,
  minX = 0,
  minY = 0,
  dx = 1,
  dy = 1,
  scale = 0.35,
  style = {},
} = {}) {
  if (!fluxX || !fluxY || fluxX.length < columns * rows || fluxY.length < columns * rows) {
    throw new RangeError('flux arrays must cover columns * rows entries');
  }
  const group = new Group([], { data: { fluxX, fluxY, columns, rows } });
  const arrowStyle = chalkStyle('technical', style);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const x = minX + (column + 0.5) * dx;
      const y = minY + (row + 0.5) * dy;
      group.add(new Arrow(
        x,
        y,
        x + fluxX[index] * scale,
        y + fluxY[index] * scale,
        { style: arrowStyle, data: { index } },
      ));
    }
  }
  return group;
}
