import { Group, Line, TextLabel } from './core.js';
import { CurveLayer } from './curve.js';
import { chalkStyle } from './chalk.js';

const lineStyle = chalkStyle('dusty', { stroke: '#e5e8d7', fill: null, width: 0.8, opacity: 0.28, passes: 1 });
const labelStyle = chalkStyle('dusty', { fill: '#eeeada', stroke: null, passes: 2 });

// A live, labeled plot with explicit data coordinates. setData never rescales
// the axes; reusable packed buffers keep frequently updated curves inexpensive.
export class SampledPlot extends Group {
  constructor({ xRange = [-1, 1], yRange = [-1, 1], width = 10, height = 3, title = '', ...options } = {}) {
    super([], options);
    if (![width, height].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('positive plot size required');
    this.width = width;
    this.height = height;
    this.axes = new Group();
    this.records = [];
    this.title = new TextLabel(title, { x: -width / 2, y: height / 2 + 0.3, align: 'left', font: '15px "Schoolbell", cursive', style: labelStyle });
    this.add(this.axes, this.title);
    this.setRanges(xRange, yRange);
  }

  setRanges(xRange, yRange) {
    for (const range of [xRange, yRange]) {
      if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1]) throw new RangeError('plot range must be [min, max]');
    }
    this.xRange = [...xRange];
    this.yRange = [...yRange];
    this.axes.clear();
    for (const fraction of [0, 0.5, 1]) {
      const x = (fraction - 0.5) * this.width, y = (fraction - 0.5) * this.height;
      this.axes.add(
        new Line(x, -this.height / 2, x, this.height / 2, { style: lineStyle }),
        new Line(-this.width / 2, y, this.width / 2, y, { style: lineStyle }),
        new TextLabel(this.format(xRange[0] + fraction * (xRange[1] - xRange[0])), {
          x, y: -this.height / 2 - 0.23, font: '12px "Schoolbell", cursive', style: labelStyle,
        }),
        new TextLabel(this.format(yRange[0] + fraction * (yRange[1] - yRange[0])), {
          x: -this.width / 2 - 0.15, y, align: 'right', font: '12px "Schoolbell", cursive', style: labelStyle,
        }),
      );
    }
    return this;
  }

  format(value) { return String(Number(value.toPrecision(3))); }

  point(x, y, out = [0, 0]) {
    out[0] = ((x - this.xRange[0]) / (this.xRange[1] - this.xRange[0]) - 0.5) * this.width;
    out[1] = ((y - this.yRange[0]) / (this.yRange[1] - this.yRange[0]) - 0.5) * this.height;
    return out;
  }

  coordinates(x, y) {
    return [this.xRange[0] + (x / this.width + 0.5) * (this.xRange[1] - this.xRange[0]),
      this.yRange[0] + (y / this.height + 0.5) * (this.yRange[1] - this.yRange[0])];
  }

  addCurve(x, y, style = {}) {
    if (x.length !== y.length || x.length < 2) throw new RangeError('matching curve arrays required');
    const record = { x, y, px: new Float32Array(x.length), py: new Float32Array(y.length) };
    record.layer = new CurveLayer({ x: record.px, y: record.py, count: x.length,
      style: chalkStyle('dusty', { stroke: '#72dce5', fill: null, width: 1.8, passes: 2, roughness: 0.18, ...style }) });
    this.records.push(record);
    this.add(record.layer);
    this.update();
    return record;
  }

  update() {
    const point = [0, 0];
    for (const record of this.records) {
      for (let i = 0; i < record.x.length; i++) {
        this.point(record.x[i], record.y[i], point);
        record.px[i] = point[0];
        record.py[i] = point[1];
      }
      record.layer.markDataDirty();
    }
    return this;
  }
}
