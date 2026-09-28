// Placing things on the board without hand-typed coordinates: world bounds of any object,
// Manim-style nextTo/arrange/moveTo, picking the object under a point, and panels.
//
// Text has no size until it is drawn, so bounds of text use `measure(text, weight)` → width
// in em (a Canvas measure from tex.js canvasMeasure, or the default estimate), and `yUp`
// says whether world y grows upwards (Camera2D flipY: true, the default) or downwards.

import { Circle, Group, MathLabel, Mobject, Polyline, Rectangle, Scene, TextLabel } from './core.js';
import { CurveLayer } from './curve.js';
import { ScalarField } from './field.js';
import { apply2D, compose2D, multiply2D } from './math.js';
import { layoutTex } from './tex.js';
import { estimateTextWidth, wrapTextLines } from './text-wrap.js';

export { estimateTextWidth, wrapTextLines };

export const RIGHT = Object.freeze([1, 0]);
export const LEFT = Object.freeze([-1, 0]);
export const UP = Object.freeze([0, 1]);
export const DOWN = Object.freeze([0, -1]);

// Object → world matrix, through all parent groups.
export function worldMatrix(object) {
  let matrix = new Float64Array([1, 0, 0, 1, 0, 0]);
  const local = new Float64Array(6), out = new Float64Array(6);
  for (let node = object; node; node = node.parent) {
    compose2D(local, node.x, node.y, node.scaleX, node.scaleY, node.rotation);
    multiply2D(out, local, matrix);
    matrix = Float64Array.from(out);
  }
  return matrix;
}

function textBox(object, measure, yUp) {
  if (object.size === undefined) return null; // pixel-sized text has no world size
  let widthEm, ascentEm = 0.75, descentEm = 0.25, lines = 1;
  if (object instanceof MathLabel) {
    const layout = layoutTex(object.tree, (text) => measure(text));
    widthEm = layout.width;
    ascentEm = layout.ascent;
    descentEm = layout.descent;
  } else if (object.wrap && object.maxWidth !== undefined) {
    const wrapped = wrapTextLines(object.text, object.maxWidth / object.size, measure);
    widthEm = Math.max(...wrapped.map((line) => measure(line)));
    lines = wrapped.length;
  } else {
    widthEm = measure(object.text);
  }
  const size = object.size;
  let width = widthEm * size;
  if (!object.wrap && object.maxWidth !== undefined) width = Math.min(width, object.maxWidth);
  const lineHeight = (object.lineHeight ?? 1.25) * size;
  const height = (ascentEm + descentEm) * size + (lines - 1) * lineHeight;
  const left = object.align === 'center' ? -width / 2 : object.align === 'right' || object.align === 'end' ? -width : 0;
  // Distance of the block's top below the anchor, in the text's own downward direction.
  const baseline = object.baseline;
  const top = baseline === 'top' ? 0
    : baseline === 'middle' ? -height / 2
      : baseline === 'bottom' ? -height
        : -ascentEm * size;
  const sign = yUp ? -1 : 1;
  const y0 = sign * top, y1 = sign * (top + height);
  return { minX: left, maxX: left + width, minY: Math.min(y0, y1), maxY: Math.max(y0, y1) };
}

function pointsBox(xs, ys, count) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let index = 0; index < count; index += 1) {
    const x = xs(index), y = ys(index);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return minX <= maxX ? { minX, maxX, minY, maxY } : null;
}

// Bounds in the object's own coordinates (before its transform), or null.
function localBox(object, measure, yUp) {
  if (object instanceof Polyline) {
    const p = object.points;
    return pointsBox((i) => p[i * 2], (i) => p[i * 2 + 1], p.length / 2);
  }
  if (object instanceof CurveLayer) {
    return pointsBox((i) => object.positionsX[i], (i) => object.positionsY[i], object.count);
  }
  if (object instanceof Circle) return { minX: -object.radius, maxX: object.radius, minY: -object.radius, maxY: object.radius };
  if (object instanceof Rectangle) return { minX: -object.width / 2, maxX: object.width / 2, minY: -object.height / 2, maxY: object.height / 2 };
  if (object instanceof TextLabel || object instanceof MathLabel) return textBox(object, measure, yUp);
  if (object instanceof ScalarField) {
    const d = object.domain;
    return { minX: d.minX, maxX: d.maxX, minY: d.minY, maxY: d.maxY };
  }
  if (Array.isArray(object.localBounds)) {
    const [minX, minY, maxX, maxY] = object.localBounds;
    return { minX, maxX, minY, maxY };
  }
  return null;
}

function transformBox(box, matrix) {
  const point = new Float64Array(2);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of [[box.minX, box.minY], [box.maxX, box.minY], [box.minX, box.maxY], [box.maxX, box.maxY]]) {
    apply2D(point, matrix, x, y);
    minX = Math.min(minX, point[0]); maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
  }
  return { minX, maxX, minY, maxY };
}

function union(a, b) {
  if (!a) return b;
  if (!b) return a;
  return { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY) };
}

// World-space bounds { minX, maxX, minY, maxY, width, height, centerX, centerY }, or null
// for something without extent (an empty group, pixel-sized text).
export function getBounds(object, { measure = estimateTextWidth, yUp = true } = {}) {
  let box = null;
  if (object instanceof Group) {
    for (const child of object.children) box = union(box, getBounds(child, { measure, yUp }));
  } else if (object instanceof Mobject) {
    const local = localBox(object, measure, yUp);
    if (local) box = transformBox(local, worldMatrix(object));
  } else {
    throw new TypeError('getBounds needs a Mobject');
  }
  if (!box) return null;
  return {
    ...box,
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
    centerX: (box.minX + box.maxX) / 2,
    centerY: (box.minY + box.maxY) / 2,
  };
}

function requireBounds(object, options, name) {
  const bounds = getBounds(object, options);
  if (!bounds) throw new RangeError(`${name} has no extent to place`);
  return bounds;
}

function checkDirection(direction) {
  if (!Array.isArray(direction) || direction.length !== 2 || !direction.every(Number.isFinite)
    || (direction[0] !== 0) === (direction[1] !== 0)) {
    throw new RangeError('direction must be RIGHT, LEFT, UP or DOWN');
  }
}

// Moves `object` so it sits beside `target` in `direction`, `buff` apart. align: 0 centres
// it across the direction, -1/+1 lines up the lower/upper (left/right) edges.
export function nextTo(object, target, direction = RIGHT, { buff = 0.25, align = 0, ...options } = {}) {
  checkDirection(direction);
  const a = requireBounds(object, options, 'object');
  const b = target instanceof Mobject ? requireBounds(target, options, 'target') : { ...target, centerX: target.x, centerY: target.y, minX: target.x, maxX: target.x, minY: target.y, maxY: target.y };
  let dx = 0, dy = 0;
  const across = (lowA, highA, centerA, lowB, highB, centerB) => (align < 0 ? lowB - lowA : align > 0 ? highB - highA : centerB - centerA);
  if (direction[0] !== 0) {
    dx = direction[0] > 0 ? b.maxX + buff - a.minX : b.minX - buff - a.maxX;
    dy = across(a.minY, a.maxY, a.centerY, b.minY, b.maxY, b.centerY);
  } else {
    dy = direction[1] > 0 ? b.maxY + buff - a.minY : b.minY - buff - a.maxY;
    dx = across(a.minX, a.maxX, a.centerX, b.minX, b.maxX, b.centerX);
  }
  object.shift(dx, dy);
  return object;
}

// Lines objects up one after another; the first one stays where it is.
export function arrange(objects, direction = RIGHT, { buff = 0.25, align = 0, ...options } = {}) {
  const list = objects instanceof Group ? objects.children : objects;
  if (!Array.isArray(list)) throw new TypeError('arrange needs a Group or an array of Mobjects');
  for (let index = 1; index < list.length; index += 1) nextTo(list[index], list[index - 1], direction, { buff, align, ...options });
  return objects;
}

// Moves `object` so the centre of its bounds is at (x, y).
export function moveTo(object, x, y, options = {}) {
  const bounds = requireBounds(object, options, 'object');
  object.shift(x - bounds.centerX, y - bounds.centerY);
  return object;
}

function segmentDistance(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / length));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function insidePolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i], yi = points[i + 1], xj = points[j], yj = points[j + 1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function worldPoints(object, local) {
  const matrix = worldMatrix(object), point = new Float64Array(2), out = new Float64Array(local.length);
  for (let index = 0; index < local.length; index += 2) {
    apply2D(point, matrix, local[index], local[index + 1]);
    out[index] = point[0];
    out[index + 1] = point[1];
  }
  return out;
}

// Distance from a world point to what the object draws (0 inside filled shapes and text).
function distanceTo(object, x, y, options) {
  let points = null, closed = false;
  if (object instanceof Polyline) {
    points = worldPoints(object, object.points);
    closed = object.closed;
  } else if (object instanceof CurveLayer) {
    const local = new Float64Array(object.count * 2);
    for (let index = 0; index < object.count; index += 1) {
      local[index * 2] = object.positionsX[index];
      local[index * 2 + 1] = object.positionsY[index];
    }
    points = worldPoints(object, local);
  } else if (object instanceof Rectangle) {
    const w = object.width / 2, h = object.height / 2;
    points = worldPoints(object, new Float64Array([-w, -h, w, -h, w, h, -w, h]));
    closed = true;
  } else if (object instanceof Circle) {
    const matrix = worldMatrix(object);
    const radius = object.radius * Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]));
    const d = Math.hypot(x - matrix[4], y - matrix[5]);
    return object.style.fill && d <= radius ? 0 : Math.abs(d - radius);
  } else {
    const bounds = getBounds(object, options);
    if (!bounds) return Infinity;
    const dx = Math.max(bounds.minX - x, 0, x - bounds.maxX), dy = Math.max(bounds.minY - y, 0, y - bounds.maxY);
    return Math.hypot(dx, dy);
  }
  if (points.length < 2) return Infinity;
  if (closed && object.style.fill && insidePolygon(x, y, points)) return 0;
  let best = Infinity;
  const count = points.length / 2, edges = closed ? count : count - 1;
  for (let edge = 0; edge < edges; edge += 1) {
    const next = (edge + 1) % count;
    best = Math.min(best, segmentDistance(x, y, points[edge * 2], points[edge * 2 + 1], points[next * 2], points[next * 2 + 1]));
  }
  return count === 1 ? Math.hypot(x - points[0], y - points[1]) : best;
}

// The topmost visible object whose drawing is within `tolerance` (world units) of (x, y),
// searching a Scene, Group or array in reverse draw order: { object, distance } or null.
// Objects with `interactive = false` are skipped; data layers are hit inside their bounds.
export function hitTest(root, x, y, { tolerance = 0.05, ...options } = {}) {
  const visit = (object) => {
    if (!object.visible || object.opacity <= 0 || object.interactive === false || (object.reveal ?? 1) <= 0) return null;
    if (object instanceof Group) {
      const children = object.sortedChildren();
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const hit = visit(children[index]);
        if (hit) return hit;
      }
      return null;
    }
    const distance = distanceTo(object, x, y, options);
    return distance <= tolerance ? { object, distance } : null;
  };
  const roots = root instanceof Scene ? root.sortedRoots() : Array.isArray(root) ? root : [root];
  for (let index = roots.length - 1; index >= 0; index -= 1) {
    const hit = visit(roots[index]);
    if (hit) return hit;
  }
  return null;
}

// A framed area with a title and a content group clipped to the inside. Content
// coordinates start at the inner top-left corner: x to the right, y along the world's y.
export class Panel extends Group {
  constructor({
    x = 0, y = 0, width, height, title = '', titleSize = 0.3, padding = 0.2, yUp = true,
    frameStyle = { stroke: '#d9dfce75', fill: '#0d1611cc', width: 1, passes: 1 },
    titleStyle = { fill: '#f1ecda', passes: 1 }, family, ...options
  }) {
    super([], options);
    if (!(width > 0 && height > 0)) throw new RangeError('a panel needs a positive width and height');
    const down = yUp ? -1 : 1;
    this.frame = new Rectangle(width, height, { x, y, style: frameStyle });
    this.title = new TextLabel(title, {
      x: x - width / 2 + padding, y: y - down * (height / 2 - padding), size: titleSize,
      align: 'left', baseline: 'top', style: titleStyle, ...(family ? { font: `16px ${family}` } : {}),
    });
    const titleHeight = title ? titleSize * 1.4 : 0;
    this.innerWidth = width - 2 * padding;
    this.innerHeight = height - 2 * padding - titleHeight;
    this.content = new Group([], {
      x: x - width / 2 + padding,
      y: y - down * (height / 2 - padding - titleHeight),
      clip: yUp
        ? { minX: 0, maxX: this.innerWidth, minY: -this.innerHeight, maxY: 0 }
        : { minX: 0, maxX: this.innerWidth, minY: 0, maxY: this.innerHeight },
    });
    this.add(this.frame, this.title, this.content);
  }
}
