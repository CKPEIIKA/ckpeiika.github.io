// A matrix or table on the board: one cell per value with a sign-coloured fill and the
// value written in it, optional row and column labels, the cell under a point, and a
// highlighted cell. The anchor (x, y) is the top-left corner; rows go down the board.

import { Group, Rectangle, TextLabel } from './core.js';
import { invert2D } from './math.js';
import { worldMatrix } from './layout.js';

const defaultFill = (value) => (value > 1e-10 ? '#38503a' : value < -1e-10 ? '#603f39' : null);
const defaultFormat = (value) => (typeof value === 'number' ? String(Number(value.toPrecision(3))) : String(value));

export class MatrixGrid extends Group {
  constructor(values, {
    cell = 0.5, yUp = true, fill = defaultFill, format = defaultFormat, hide = (value) => value === 0,
    textSize = null, rowLabels = null, columnLabels = null,
    gridStyle = { stroke: '#2a3a31', width: 1, roughness: 0.2, passes: 1 },
    textStyle = { fill: '#f4f1e7', passes: 1 }, labelStyle = { fill: '#a6b8ad', passes: 1 },
    highlightStyle = { stroke: '#f0d477', width: 2.5, roughness: 0.2, passes: 1 },
    ...options
  } = {}) {
    super([], options);
    if (!(cell > 0)) throw new RangeError('cell must be positive');
    Object.assign(this, { cell, yUp, fill, format, hide, textSize, rowLabels, columnLabels, gridStyle, textStyle, labelStyle });
    this.marker = new Rectangle(cell, cell, { visible: false, zIndex: 2, style: highlightStyle });
    this.setValues(values);
  }

  // Cell centre (i, j) in the grid's own coordinates.
  center(row, column) {
    const down = this.yUp ? -1 : 1;
    return [(column + 0.5) * this.cell, down * (row + 0.5) * this.cell];
  }

  setValues(values) {
    if (!Array.isArray(values) || !values.every(Array.isArray)) throw new TypeError('values must be an array of rows');
    this.values = values;
    this.rows = values.length;
    this.columns = Math.max(0, ...values.map((row) => row.length));
    this.clear();
    const size = this.textSize ?? this.cell * 0.36;
    const cells = [], texts = [];
    values.forEach((row, i) => row.forEach((value, j) => {
      const [cx, cy] = this.center(i, j);
      cells.push(new Rectangle(this.cell * 0.97, this.cell * 0.97, { x: cx, y: cy, style: { ...this.gridStyle, fill: this.fill(value, i, j) } }));
      if (!this.hide(value, i, j)) {
        texts.push(new TextLabel(this.format(value, i, j), { x: cx, y: cy, size, align: 'center', baseline: 'middle', maxWidth: this.cell * 0.92, style: this.textStyle }));
      }
    }));
    const down = this.yUp ? -1 : 1;
    (this.rowLabels ?? []).forEach((label, i) => texts.push(new TextLabel(String(label), {
      x: -this.cell * 0.2, y: down * (i + 0.5) * this.cell, size, align: 'right', baseline: 'middle', style: this.labelStyle,
    })));
    (this.columnLabels ?? []).forEach((label, j) => texts.push(new TextLabel(String(label), {
      x: (j + 0.5) * this.cell, y: -down * this.cell * 0.35, size, align: 'center', baseline: 'middle', style: this.labelStyle,
    })));
    this.add(...cells, ...texts, this.marker);
    return this;
  }

  // [row, column] under a world point, or null.
  cellAt(worldX, worldY) {
    const inverse = new Float64Array(6);
    invert2D(inverse, worldMatrix(this));
    const x = inverse[0] * worldX + inverse[2] * worldY + inverse[4];
    const y = inverse[1] * worldX + inverse[3] * worldY + inverse[5];
    const column = Math.floor(x / this.cell);
    const row = Math.floor((this.yUp ? -y : y) / this.cell);
    return row >= 0 && column >= 0 && row < this.rows && column < this.columns ? [row, column] : null;
  }

  // Frames one cell (null hides the frame).
  highlight(cell) {
    if (!cell) {
      this.marker.setVisible(false);
      return this;
    }
    const [cx, cy] = this.center(cell[0], cell[1]);
    this.marker.setPosition(cx, cy).setVisible(true);
    return this;
  }
}
