import { Group, Line, Polyline, TextLabel } from './core.js';

const FONT = '14px "Schoolbell", cursive';
const AXIS_STYLE = Object.freeze({
  stroke: '#b8c6bb', width: 1.1, opacity: 0.72, roughness: 0.14, passes: 1,
});
const TEXT_STYLE = Object.freeze({
  fill: '#e2e2d6', opacity: 0.88, roughness: 0.2, passes: 2,
});
const BRACE_PROFILE = [
  0, 0, 0.04, 0.45, 0.1, 0.65, 0.35, 0.65, 0.44, 0.72, 0.48, 1, 0.5, 1.12,
  0.52, 1, 0.56, 0.72, 0.65, 0.65, 0.9, 0.65, 0.96, 0.45, 1, 0,
];

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
}

function validateStyle(value, name) {
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) throw new TypeError(`${name} must be an object`);
}

function nonempty(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${name} must not be empty. No label state was changed.`);
  return value;
}

function outputBuffer(out) {
  if (!out || typeof out.length !== 'number' || out.length < 2) throw new TypeError('out needs two entries');
}

function validateRange(value, name = 'range') {
  if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3)) {
    throw new TypeError(`${name} must be [min,max] or [min,max,step]. No line state was changed.`);
  }
  const [min, max, suppliedStep] = value;
  const step = suppliedStep ?? 1;
  if (![min, max, step].every(Number.isFinite)) {
    throw new TypeError(`${name} entries must be finite. No line state was changed.`);
  }
  if (min >= max) {
    throw new RangeError(`${name} min ${min} must be less than max ${max}. No line state was changed.`);
  }
  if (step <= 0) {
    throw new RangeError(`${name} step ${step} must be positive. No line state was changed.`);
  }
  return Object.freeze([min, max, step]);
}

function tickCount([min, max, step]) {
  return Math.floor((max - min + step * 1e-9) / step) + 1;
}

function tickValue(range, index) {
  const value = range[0] + index * range[2];
  return Math.abs(value) <= range[2] * 1e-10 ? 0 : value;
}

function formatNumber(value, step) {
  const digits = Math.min(10, Math.max(0, Math.ceil(-Math.log10(step)) + 1));
  return String(Number(value.toFixed(digits)));
}

export class FormulaLabel extends TextLabel {
  constructor(text, options = {}) {
    const formula = nonempty(text, 'formula text');
    const accessibleText = nonempty(options.accessibleText ?? formula, 'accessible formula text');
    super(formula, options);
    this.data = { kind: 'formula-label', accessibleText };
  }

  setFormula(text, { accessibleText = text } = {}) {
    const formula = nonempty(text, 'formula text');
    const accessible = nonempty(accessibleText, 'accessible formula text');
    this.setText(formula);
    this.data = { ...this.data, accessibleText: accessible };
    return this;
  }
}

export class NumberLine extends Group {
  constructor({
    range = [-1, 1, 1], length = 4,
    orientation = 'horizontal',
    includeTicks = true, includeNumbers = false,
    tickSize = 0.08, labelOffset = 0.18, labelSide = -1, maxTicks = 512,
    formatter = null,
    font = FONT,
    axisStyle = AXIS_STYLE, tickStyle = axisStyle, labelStyle = TEXT_STYLE,
    ...options
  } = {}) {
    super([], options);
    this.length = positive(length, 'length');
    if (!['horizontal', 'vertical'].includes(orientation)) throw new RangeError('orientation must be horizontal or vertical');
    if (![-1, 1].includes(labelSide)) throw new RangeError('labelSide must be -1 or 1');
    if (formatter !== null && typeof formatter !== 'function') throw new TypeError('formatter must be a function or null');
    validateStyle(axisStyle, 'axisStyle');
    validateStyle(tickStyle, 'tickStyle');
    validateStyle(labelStyle, 'labelStyle');
    Object.assign(this, {
      orientation,
      includeTicks: Boolean(includeTicks),
      includeNumbers: Boolean(includeNumbers),
      tickSize: positive(tickSize, 'tickSize'),
      labelOffset: positive(labelOffset, 'labelOffset'),
      labelSide,
      maxTicks,
      formatter,
      font,
      axisStyle,
      tickStyle,
      labelStyle,
      range: validateRange(range),
    });
    positiveInteger(maxTicks, 'maxTicks');
    this.data = { range: this.range };
    this._checkTickLimit(this.range);
    this._build();
  }

  _checkTickLimit(range) {
    const count = tickCount(range);
    if (count > this.maxTicks) {
      throw new RangeError(`tick count ${count} exceeds maxTicks ${this.maxTicks}. No line state was changed.`);
    }
    return count;
  }

  _build() {
    const horizontal = this.orientation === 'horizontal';
    const half = this.length * 0.5;
    this.axis = new Line(
      horizontal ? -half : 0, horizontal ? 0 : -half,
      horizontal ? half : 0, horizontal ? 0 : half,
      { style: this.axisStyle },
    );
    this.ticks = new Group();
    this.numbers = new Group();
    const count = tickCount(this.range);
    for (let index = 0; index < count; index += 1) {
      const value = tickValue(this.range, index);
      const coordinate = (value - this.range[0])
        / (this.range[1] - this.range[0]) * this.length - half;
      if (this.includeTicks) {
        this.ticks.add(new Line(
          horizontal ? coordinate : -this.tickSize * 0.5,
          horizontal ? -this.tickSize * 0.5 : coordinate,
          horizontal ? coordinate : this.tickSize * 0.5,
          horizontal ? this.tickSize * 0.5 : coordinate,
          { style: this.tickStyle },
        ));
      }
      if (this.includeNumbers) {
        const text = this.formatter
          ? String(this.formatter(value, this.range))
          : formatNumber(value, this.range[2]);
        this.numbers.add(new TextLabel(text, {
          x: horizontal ? coordinate : this.labelSide * this.labelOffset,
          y: horizontal ? this.labelSide * this.labelOffset : coordinate,
          align: horizontal ? 'center' : this.labelSide < 0 ? 'right' : 'left',
          font: this.font, style: this.labelStyle,
        }));
      }
    }
    this.add(this.axis, this.ticks, this.numbers);
  }

  setRange(range) {
    const next = validateRange(range);
    this._checkTickLimit(next);
    this.range = next;
    this.data = { range: next };
    this.clear();
    this._build();
    return this;
  }

  numberToPoint(value, out = [0, 0]) {
    finite(value, 'value');
    outputBuffer(out);
    const coordinate = (value - this.range[0])
      / (this.range[1] - this.range[0]) * this.length - this.length * 0.5;
    out[0] = this.orientation === 'horizontal' ? coordinate : 0;
    out[1] = this.orientation === 'horizontal' ? 0 : coordinate;
    return out;
  }

  pointToNumber(x, y) {
    finite(x, 'x');
    finite(y, 'y');
    const coordinate = this.orientation === 'horizontal' ? x : y;
    return this.range[0]
      + (coordinate / this.length + 0.5) * (this.range[1] - this.range[0]);
  }
}

export class Axes extends Group {
  constructor({
    xRange = [-1, 1, 1], yRange = [-1, 1, 1],
    width = 6, height = 4,
    includeTicks = true, includeNumbers = false,
    xLabel = '', yLabel = '',
    font = FONT,
    axisStyle = AXIS_STYLE, tickStyle = axisStyle, labelStyle = TEXT_STYLE,
    maxTicks = 512,
    ...options
  } = {}) {
    super([], options);
    this.width = positive(width, 'width');
    this.height = positive(height, 'height');
    this.xRange = validateRange(xRange, 'xRange');
    this.yRange = validateRange(yRange, 'yRange');
    const shared = {
      includeTicks, includeNumbers, font, axisStyle, tickStyle, labelStyle, maxTicks,
    };
    this.xAxis = new NumberLine({
      ...shared, range: this.xRange, length: this.width,
    });
    this.yAxis = new NumberLine({
      ...shared, range: this.yRange, length: this.height, orientation: 'vertical',
    });
    const zeroY = Math.max(this.yRange[0], Math.min(0, this.yRange[1]));
    const zeroX = Math.max(this.xRange[0], Math.min(0, this.xRange[1]));
    this.xAxis.setPosition(0, this.coordsToPoint(0, zeroY)[1]);
    this.yAxis.setPosition(this.coordsToPoint(zeroX, 0)[0], 0);
    this.add(this.xAxis, this.yAxis);
    this.xLabel = xLabel
      ? new FormulaLabel(String(xLabel), {
        x: this.width * 0.5 + 0.22, y: this.xAxis.y, font, style: labelStyle,
      })
      : null;
    this.yLabel = yLabel
      ? new FormulaLabel(String(yLabel), {
        x: this.yAxis.x, y: this.height * 0.5 + 0.22, font, style: labelStyle,
      })
      : null;
    if (this.xLabel) this.add(this.xLabel);
    if (this.yLabel) this.add(this.yLabel);
  }

  coordsToPoint(x, y, out = [0, 0]) {
    finite(x, 'x');
    finite(y, 'y');
    outputBuffer(out);
    out[0] = (x - this.xRange[0]) / (this.xRange[1] - this.xRange[0])
      * this.width - this.width * 0.5;
    out[1] = (y - this.yRange[0]) / (this.yRange[1] - this.yRange[0])
      * this.height - this.height * 0.5;
    return out;
  }

  pointToCoords(x, y, out = [0, 0]) {
    finite(x, 'x');
    finite(y, 'y');
    outputBuffer(out);
    out[0] = this.xRange[0]
      + (x / this.width + 0.5) * (this.xRange[1] - this.xRange[0]);
    out[1] = this.yRange[0]
      + (y / this.height + 0.5) * (this.yRange[1] - this.yRange[0]);
    return out;
  }

  plot(fn, {
    xRange = [this.xRange[0], this.xRange[1]],
    samples = 256, attach = true, style = {}, data = {},
    ...options
  } = {}) {
    if (typeof fn !== 'function') throw new TypeError('plot fn must be a function');
    if (!Array.isArray(xRange) || xRange.length !== 2
        || !xRange.every(Number.isFinite) || xRange[0] >= xRange[1]) {
      throw new RangeError('plot xRange must contain finite min < max');
    }
    positiveInteger(samples, 'samples');
    if (samples < 2) throw new RangeError('samples must be at least 2');
    if (samples > 1e6) throw new RangeError('samples must not exceed 1000000');
    validateStyle(style, 'plot style');
    validateStyle(data, 'plot data');

    const points = new Float32Array(samples * 2);
    const [minX, maxX] = xRange;
    const xScale = this.width / (this.xRange[1] - this.xRange[0]);
    const yScale = this.height / (this.yRange[1] - this.yRange[0]);
    for (let index = 0; index < samples; index += 1) {
      const x = minX + (maxX - minX) * index / (samples - 1);
      const y = fn(x, index);
      if (!Number.isFinite(y)) {
        throw new RangeError(`plot sample ${index} at x=${x} is not finite. No plot was attached.`);
      }
      points[index * 2] = (x - this.xRange[0]) * xScale - this.width * 0.5;
      points[index * 2 + 1] = (y - this.yRange[0]) * yScale - this.height * 0.5;
    }
    const plot = new Polyline(points, {
      ...options,
      copy: false,
      style,
      data: { ...data, samples, xRange: [minX, maxX] },
    });
    if (attach) this.add(plot);
    return plot;
  }
}

function validateEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError(`legend entry ${index} must be an object`);
  }
  if (typeof entry.label !== 'string' || entry.label.trim().length === 0) {
    throw new TypeError(`legend entry ${index} label must not be empty`);
  }
  validateStyle(entry.style, `legend entry ${index} style`);
  return { label: entry.label, style: { ...(entry.style ?? {}) } };
}

export class Legend extends Group {
  constructor(entries, {
    direction = 'vertical',
    rowHeight = 0.32, columnWidth = 1.8, lineLength = 0.42, labelGap = 0.1,
    font = FONT,
    labelStyle = TEXT_STYLE,
    ...options
  } = {}) {
    super([], options);
    if (!Array.isArray(entries) || entries.length === 0) throw new TypeError('legend entries must be a non-empty array');
    if (!['horizontal', 'vertical'].includes(direction)) throw new RangeError('legend direction must be horizontal or vertical');
    for (const [value, name] of [
      [rowHeight, 'rowHeight'], [columnWidth, 'columnWidth'],
      [lineLength, 'lineLength'], [labelGap, 'labelGap'],
    ]) positive(value, name);
    validateStyle(labelStyle, 'labelStyle');
    this.entries = entries.map(validateEntry);
    this.rows = this.entries.map((entry, index) => {
      const swatch = new Line(0, 0, lineLength, 0, { style: entry.style });
      const label = new TextLabel(entry.label, {
        x: lineLength + labelGap, align: 'left', font, style: labelStyle,
      });
      const row = new Group([swatch, label], direction === 'horizontal'
        ? { x: index * columnWidth }
        : { y: -index * rowHeight });
      Object.assign(row, { swatch, label });
      return row;
    });
    this.add(...this.rows);
  }

  setEntry(index, patch) {
    if (!Number.isInteger(index) || index < 0 || index >= this.rows.length) {
      throw new RangeError(`legend entry index ${index} is out of range`);
    }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError(`legend entry ${index} patch must be an object`);
    }
    const current = this.entries[index];
    const next = validateEntry({
      label: patch.label ?? current.label,
      style: patch.style ?? {},
    }, index);
    if (patch.label !== undefined) this.rows[index].label.setText(next.label);
    if (patch.style !== undefined) this.rows[index].swatch.setStyle(next.style);
    this.entries[index] = {
      label: next.label,
      style: { ...current.style, ...(patch.style ?? {}) },
    };
    return this;
  }
}

export class Brace extends Group {
  constructor(x1, y1, x2, y2, {
    depth = 0.18, side = 1, label = '', labelGap = 0.12,
    font = FONT,
    style = AXIS_STYLE,
    labelStyle = TEXT_STYLE,
    ...options
  } = {}) {
    super([], options);
    this.depth = positive(depth, 'depth');
    this.labelGap = positive(labelGap, 'labelGap');
    if (![-1, 1].includes(side)) throw new RangeError('side must be -1 or 1');
    this.side = side;
    validateStyle(style, 'brace style');
    validateStyle(labelStyle, 'brace labelStyle');
    this.curve = new Polyline(new Float32Array(BRACE_PROFILE.length), {
      copy: false, style,
    });
    this.label = label
      ? new FormulaLabel(String(label), { font, style: labelStyle })
      : null;
    this.add(this.curve);
    if (this.label) this.add(this.label);
    this.setEndpoints(x1, y1, x2, y2);
  }

  setEndpoints(x1, y1, x2, y2) {
    for (const [value, name] of [[x1, 'x1'], [y1, 'y1'], [x2, 'x2'], [y2, 'y2']]) {
      if (!Number.isFinite(value)) {
        throw new TypeError(`${name} must be finite. No brace state was changed.`);
      }
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length <= Number.EPSILON) {
      throw new RangeError('brace endpoints must be distinct. No brace state was changed.');
    }
    const nx = -dy / length * this.side;
    const ny = dx / length * this.side;
    for (let index = 0; index < BRACE_PROFILE.length; index += 2) {
      const t = BRACE_PROFILE[index];
      const offset = BRACE_PROFILE[index + 1] * this.depth;
      this.curve.points[index] = x1 + dx * t + nx * offset;
      this.curve.points[index + 1] = y1 + dy * t + ny * offset;
    }
    this.curve.markGeometryDirty();
    if (this.label) {
      const offset = this.depth * 1.12 + this.labelGap;
      this.label.setPosition(
        (x1 + x2) * 0.5 + nx * offset,
        (y1 + y2) * 0.5 + ny * offset,
      );
    }
    return this;
  }
}
