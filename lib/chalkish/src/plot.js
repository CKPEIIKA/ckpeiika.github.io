import { Group, Line, TextLabel } from './core.js';
import { CurveLayer } from './curve.js';
import { PlotFrame } from './plot-frame.js';
import { CHALK_FONT_STACK, chalkStyle } from './chalk.js';

const lineStyle = chalkStyle('dusty', { stroke: '#e5e8d7', fill: null, width: 0.8, opacity: 0.28, passes: 1 });
const labelStyle = chalkStyle('dusty', { fill: '#eeeada', stroke: null, passes: 2 });

// Grid lines and tick labels for a PlotFrame, as scene objects. Rebuilt only when the
// ranges change, so a live plot can call setRanges every frame. Labels sit outside the
// frame (labelGap away) or, for small insets, inside it along the left and bottom edges.
export class PlotAxes extends Group {
  constructor({
    left, right, bottom, top, xTicks = 4, yTicks = 3, xScale = 'linear', yScale = 'linear',
    labels = 'outside', labelGap = 0.1, font = `12px ${CHALK_FONT_STACK}`,
    gridStyle = lineStyle, textStyle = labelStyle, ...options
  }) {
    super([], options);
    if (labels !== 'outside' && labels !== 'inside') throw new RangeError('labels must be outside or inside');
    Object.assign(this, { left, right, bottom, top, xTicks, yTicks, xScale, yScale, labels, labelGap, font, gridStyle, textStyle });
    this.frame = null;
    this.key = '';
  }

  // Returns true when the axes were rebuilt; scales may change with the ranges.
  setRanges(xRange, yRange, { xScale = this.xScale, yScale = this.yScale } = {}) {
    this.xScale = xScale;
    this.yScale = yScale;
    const key = `${xRange}|${yRange}|${xScale}|${yScale}`;
    if (key === this.key) return false;
    const { left, right, bottom, top, labelGap } = this;
    this.frame = new PlotFrame({ left, right, bottom, top, xRange, yRange, xScale: this.xScale, yScale: this.yScale });
    this.key = key;
    this.clear();
    const lines = [], texts = [];
    for (const x of [left, right]) lines.push(new Line(x, bottom, x, top, { style: this.gridStyle }));
    for (const y of [bottom, top]) lines.push(new Line(left, y, right, y, { style: this.gridStyle }));
    const up = Math.sign(top - bottom), inward = Math.sign(right - left);
    const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(right - left), Math.abs(top - bottom));
    const inside = this.labels === 'inside';
    for (const tick of this.frame.ticks('x', this.xTicks)) {
      if (!near(tick.position, left) && !near(tick.position, right)) lines.push(new Line(tick.position, bottom, tick.position, top, { style: this.gridStyle }));
      if (inside && near(tick.position, left)) continue; // the corner belongs to the y labels
      texts.push(new TextLabel(tick.label, {
        x: tick.position, y: bottom + up * (inside ? labelGap : -labelGap),
        align: inside && near(tick.position, right) ? 'right' : 'center', font: this.font, style: this.textStyle,
      }));
    }
    for (const tick of this.frame.ticks('y', this.yTicks)) {
      if (!near(tick.position, bottom) && !near(tick.position, top)) lines.push(new Line(left, tick.position, right, tick.position, { style: this.gridStyle }));
      texts.push(new TextLabel(tick.label, {
        x: left + inward * (inside ? labelGap * 0.5 : -labelGap * 0.75),
        y: inside ? tick.position + up * (near(tick.position, top) ? -labelGap : labelGap * 0.7) : tick.position,
        align: inside ? 'left' : 'right', font: this.font, style: this.textStyle,
      }));
    }
    this.add(...lines, ...texts);
    return true;
  }
}

// A live, labeled plot with explicit data coordinates. setData never rescales
// the axes; reusable packed buffers keep frequently updated curves inexpensive.
export class SampledPlot extends Group {
  constructor({ xRange = [-1, 1], yRange = [-1, 1], width = 10, height = 3, title = '', ...options } = {}) {
    super([], options);
    if (![width, height].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('positive plot size required');
    this.width = width;
    this.height = height;
    this.axes = new PlotAxes({ left: -width / 2, right: width / 2, bottom: -height / 2, top: height / 2, xTicks: 4, yTicks: 2, labelGap: 0.2 });
    this.records = [];
    this.title = new TextLabel(title, { x: -width / 2, y: height / 2 + 0.3, align: 'left', font: `15px ${CHALK_FONT_STACK}`, style: labelStyle });
    this.add(this.axes, this.title);
    this.setRanges(xRange, yRange);
  }

  // Grid and labels at round values (PlotAxes); the panel edges are always drawn.
  setRanges(xRange, yRange) {
    for (const range of [xRange, yRange]) {
      if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1]) throw new RangeError('plot range must be [min, max]');
    }
    this.xRange = [...xRange];
    this.yRange = [...yRange];
    this.axes.setRanges(xRange, yRange);
    this.frame = this.axes.frame;
    if (this.records) this.update();
    return this;
  }

  format(value) { return String(Number(value.toPrecision(3))); }

  point(x, y, out = [0, 0]) {
    out[0] = this.frame.x(x);
    out[1] = this.frame.y(y);
    return out;
  }

  coordinates(x, y) {
    return this.frame.value(x, y);
  }

  // A curve of data points, cut at the panel edge (one CurveLayer per visible run).
  // record.layer.setCount(n) shows only the first n points, e.g. while a path is traced.
  addCurve(x, y, style = {}) {
    if (x.length !== y.length || x.length < 2) throw new RangeError('matching curve arrays required');
    const record = {
      x, y, limit: x.length, layers: [], group: new Group(),
      style: chalkStyle('dusty', { stroke: '#72dce5', fill: null, width: 1.8, passes: 2, roughness: 0.18, ...style }),
    };
    record.layer = {
      setCount: (count) => {
        if (!(Number.isInteger(count) && count >= 0 && count <= x.length)) throw new RangeError('count must be an integer within the curve');
        record.limit = count;
        this.updateRecord(record);
        return record.layer;
      },
    };
    this.records.push(record);
    this.add(record.group);
    this.updateRecord(record);
    return record;
  }

  updateRecord(record) {
    const whole = record.limit === record.x.length;
    const runs = this.frame.clip(whole ? record.x : Array.prototype.slice.call(record.x, 0, record.limit),
      whole ? record.y : Array.prototype.slice.call(record.y, 0, record.limit));
    runs.forEach((run, index) => {
      const count = run.length / 2;
      let layer = record.layers[index];
      if (!layer || layer.capacity < count) {
        const capacity = Math.max(count, record.x.length);
        const fresh = new CurveLayer({ x: new Float32Array(capacity), y: new Float32Array(capacity), count: 0, style: record.style });
        if (layer) record.group.remove(layer);
        record.layers[index] = layer = fresh;
        record.group.add(layer);
      }
      for (let i = 0; i < count; i += 1) {
        layer.positionsX[i] = run[i * 2];
        layer.positionsY[i] = run[i * 2 + 1];
      }
      layer.visible = true;
      layer.setCount(count);
    });
    for (let index = runs.length; index < record.layers.length; index += 1) record.layers[index].visible = false;
    return this;
  }

  update() {
    for (const record of this.records) this.updateRecord(record);
    return this;
  }
}
