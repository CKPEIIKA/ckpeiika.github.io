import {
  assertFinite,
  assertPositive,
} from './math.js';

let nextObjectId = 1;

export const DEFAULT_STYLE = Object.freeze({
  stroke: '#f3f0e8',
  fill: null,
  width: 2,
  opacity: 1,
  roughness: 0,
  passes: 1,
  grain: 0,
  dash: null,
  lineCap: 'round',
  lineJoin: 'round',
  composite: 'source-over',
});

function packedPoints(points, copy) {
  if (!points || typeof points.length !== 'number') {
    throw new TypeError('points must be an array-like packed as [x0,y0,x1,y1,...]');
  }
  if (points.length < 4 || points.length % 2 !== 0) {
    throw new RangeError('points must contain at least two complete points');
  }
  if (!copy && ArrayBuffer.isView(points)) return points;
  return Float32Array.from(points);
}

function applyOptions(object, options) {
  if (options.x !== undefined) object.x = assertFinite(options.x, 'x');
  if (options.y !== undefined) object.y = assertFinite(options.y, 'y');
  if (options.scale !== undefined) {
    object.scaleX = assertFinite(options.scale, 'scale');
    object.scaleY = object.scaleX;
  }
  if (options.scaleX !== undefined) object.scaleX = assertFinite(options.scaleX, 'scaleX');
  if (options.scaleY !== undefined) object.scaleY = assertFinite(options.scaleY, 'scaleY');
  if (options.rotation !== undefined) object.rotation = assertFinite(options.rotation, 'rotation');
  if (options.opacity !== undefined) object.opacity = assertFinite(options.opacity, 'opacity');
  if (options.visible !== undefined) object.visible = Boolean(options.visible);
  if (options.zIndex !== undefined) object.zIndex = assertFinite(options.zIndex, 'zIndex');
  if (options.style) object.style = { ...DEFAULT_STYLE, ...options.style };
  if (options.data !== undefined) object.data = options.data;
}

export class Mobject {
  constructor(kind = 'mobject', options = {}) {
    this.id = nextObjectId++;
    this.kind = kind;
    this.name = options.name ?? '';
    this.x = 0;
    this.y = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.opacity = 1;
    this.visible = true;
    this.zIndex = 0;
    this.style = { ...DEFAULT_STYLE };
    this.data = null;
    this.parent = null;
    this._scene = null;
    this._updaters = [];
    this._geometryVersion = 0;
    this._styleVersion = 0;
    this._transformVersion = 0;
    applyOptions(this, options);
  }

  get geometryVersion() { return this._geometryVersion; }
  get styleVersion() { return this._styleVersion; }
  get transformVersion() { return this._transformVersion; }

  setPosition(x, y) {
    assertFinite(x, 'x');
    assertFinite(y, 'y');
    if (x !== this.x || y !== this.y) {
      this.x = x;
      this.y = y;
      this._transformVersion += 1;
    }
    return this;
  }

  shift(dx, dy) {
    assertFinite(dx, 'dx');
    assertFinite(dy, 'dy');
    return this.setPosition(this.x + dx, this.y + dy);
  }

  setScale(scaleX, scaleY = scaleX) {
    assertFinite(scaleX, 'scaleX');
    assertFinite(scaleY, 'scaleY');
    if (scaleX !== this.scaleX || scaleY !== this.scaleY) {
      this.scaleX = scaleX;
      this.scaleY = scaleY;
      this._transformVersion += 1;
    }
    return this;
  }

  setRotation(rotation) {
    assertFinite(rotation, 'rotation');
    if (rotation !== this.rotation) {
      this.rotation = rotation;
      this._transformVersion += 1;
    }
    return this;
  }

  setOpacity(opacity) {
    assertFinite(opacity, 'opacity');
    if (opacity !== this.opacity) {
      this.opacity = opacity;
      this._styleVersion += 1;
    }
    return this;
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    return this;
  }

  setZIndex(zIndex) {
    assertFinite(zIndex, 'zIndex');
    if (zIndex !== this.zIndex) {
      this.zIndex = zIndex;
      if (this.parent) this.parent._orderDirty = true;
      if (this._scene && !this.parent) this._scene._orderDirty = true;
    }
    return this;
  }

  setStyle(patch) {
    if (!patch || typeof patch !== 'object') throw new TypeError('style patch must be an object');
    Object.assign(this.style, patch);
    this._styleVersion += 1;
    return this;
  }

  markGeometryDirty() {
    this._geometryVersion += 1;
    return this;
  }

  addUpdater(updater) {
    if (typeof updater !== 'function') throw new TypeError('updater must be a function');
    if (!this._updaters.includes(updater)) this._updaters.push(updater);
    return this;
  }

  removeUpdater(updater) {
    const index = this._updaters.indexOf(updater);
    if (index !== -1) this._updaters.splice(index, 1);
    return this;
  }

  clearUpdaters() {
    this._updaters.length = 0;
    return this;
  }

  update(dt, scene) {
    for (let index = 0; index < this._updaters.length; index += 1) {
      this._updaters[index](this, dt, scene);
    }
  }
}

export class Group extends Mobject {
  constructor(children = [], options = {}) {
    super('group', options);
    this.children = [];
    this._sortedChildren = [];
    this._orderDirty = true;
    this.add(...children);
  }

  _setScene(scene) {
    this._scene = scene;
    for (const child of this.children) {
      child._scene = scene;
      if (child instanceof Group) child._setScene(scene);
    }
  }

  add(...children) {
    for (const child of children) {
      if (!(child instanceof Mobject)) throw new TypeError('group children must be Mobjects');
      if (child === this) throw new Error('a group cannot contain itself');
      if (this.children.includes(child)) continue;
      if (child.parent) child.parent.remove(child);
      if (child._scene && !child.parent) child._scene.remove(child);
      child.parent = this;
      child._scene = this._scene;
      if (child instanceof Group) child._setScene(this._scene);
      this.children.push(child);
      this._orderDirty = true;
    }
    return this;
  }

  remove(...children) {
    for (const child of children) {
      const index = this.children.indexOf(child);
      if (index === -1) continue;
      this.children.splice(index, 1);
      child.parent = null;
      child._scene = null;
      if (child instanceof Group) child._setScene(null);
      this._orderDirty = true;
    }
    return this;
  }

  clear() {
    return this.remove(...this.children);
  }

  sortedChildren() {
    if (this._orderDirty) {
      this._sortedChildren = this.children
        .map((object, index) => ({ object, index }))
        .sort((a, b) => a.object.zIndex - b.object.zIndex || a.index - b.index)
        .map((entry) => entry.object);
      this._orderDirty = false;
    }
    return this._sortedChildren;
  }
}

export class Polyline extends Mobject {
  constructor(points, options = {}) {
    super(options.closed ? 'polygon' : 'polyline', options);
    this.closed = Boolean(options.closed);
    this.points = packedPoints(points, options.copy !== false);
  }

  setPoints(points, { copy = true } = {}) {
    this.points = packedPoints(points, copy);
    return this.markGeometryDirty();
  }
}

export class Polygon extends Polyline {
  constructor(points, options = {}) {
    super(points, { ...options, closed: true });
    if (this.points.length < 6) throw new RangeError('a polygon needs at least three points');
    this.kind = 'polygon';
  }
}

export class Line extends Polyline {
  constructor(x1, y1, x2, y2, options = {}) {
    super(new Float32Array([x1, y1, x2, y2]), { ...options, copy: false });
    this.kind = 'line';
  }

  setEndpoints(x1, y1, x2, y2) {
    assertFinite(x1, 'x1');
    assertFinite(y1, 'y1');
    assertFinite(x2, 'x2');
    assertFinite(y2, 'y2');
    this.points[0] = x1;
    this.points[1] = y1;
    this.points[2] = x2;
    this.points[3] = y2;
    return this.markGeometryDirty();
  }
}

export class Circle extends Mobject {
  constructor(radius = 1, options = {}) {
    super('circle', options);
    this.radius = assertPositive(radius, 'radius');
  }

  setRadius(radius) {
    assertPositive(radius, 'radius');
    if (radius !== this.radius) {
      this.radius = radius;
      this.markGeometryDirty();
    }
    return this;
  }
}

export class Rectangle extends Mobject {
  constructor(width = 1, height = 1, options = {}) {
    super('rectangle', options);
    this.width = assertPositive(width, 'width');
    this.height = assertPositive(height, 'height');
  }

  setSize(width, height) {
    assertPositive(width, 'width');
    assertPositive(height, 'height');
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.markGeometryDirty();
    }
    return this;
  }
}

export class Arrow extends Line {
  constructor(x1, y1, x2, y2, options = {}) {
    super(x1, y1, x2, y2, options);
    this.kind = 'arrow';
    this.headLength = options.headLength ?? 10;
    this.headAngle = options.headAngle ?? Math.PI / 7;
  }
}

export class TextLabel extends Mobject {
  constructor(text, options = {}) {
    super('text', options);
    this.text = String(text);
    this.font = options.font ?? '16px ui-rounded, system-ui, sans-serif';
    this.align = options.align ?? 'center';
    this.baseline = options.baseline ?? 'middle';
    this.maxWidth = options.maxWidth ?? undefined;
  }

  setText(text) {
    const next = String(text);
    if (next !== this.text) {
      this.text = next;
      this.markGeometryDirty();
    }
    return this;
  }
}

export class Scene {
  constructor({ background = '#101412' } = {}) {
    this.background = background;
    this._roots = [];
    this._sortedRoots = [];
    this._orderDirty = true;
    this._animations = [];
    this.time = 0;
  }

  get size() { return this._roots.length; }
  get roots() { return this._roots; }

  add(...objects) {
    for (const object of objects) {
      if (!(object instanceof Mobject)) throw new TypeError('scene roots must be Mobjects');
      if (this._roots.includes(object)) continue;
      if (object.parent) object.parent.remove(object);
      if (object._scene && object._scene !== this) object._scene.remove(object);
      object.parent = null;
      object._scene = this;
      if (object instanceof Group) object._setScene(this);
      this._roots.push(object);
      this._orderDirty = true;
    }
    return this;
  }

  remove(...objects) {
    for (const object of objects) {
      const index = this._roots.indexOf(object);
      if (index === -1) continue;
      this._roots.splice(index, 1);
      object._scene = null;
      if (object instanceof Group) object._setScene(null);
      this._orderDirty = true;
    }
    return this;
  }

  clear() {
    this.remove(...this._roots);
    this._animations.length = 0;
    return this;
  }

  sortedRoots() {
    if (this._orderDirty) {
      this._sortedRoots = this._roots
        .map((object, index) => ({ object, index }))
        .sort((a, b) => a.object.zIndex - b.object.zIndex || a.index - b.index)
        .map((entry) => entry.object);
      this._orderDirty = false;
    }
    return this._sortedRoots;
  }

  play(...animations) {
    for (const animation of animations) {
      if (!animation || typeof animation.advance !== 'function') {
        throw new TypeError('scene animations must implement advance(dt)');
      }
      this._animations.push(animation);
    }
    return animations.length === 1 ? animations[0] : animations;
  }

  update(dt) {
    assertFinite(dt, 'dt');
    if (dt < 0) throw new RangeError('dt must not be negative');
    this.time += dt;

    for (let index = this._animations.length - 1; index >= 0; index -= 1) {
      const animation = this._animations[index];
      animation.advance(dt);
      if (animation.done) this._animations.splice(index, 1);
    }

    const visit = (object) => {
      object.update(dt, this);
      if (object instanceof Group) {
        for (const child of object.children) visit(child);
      }
    };
    for (const root of this._roots) visit(root);
    return this;
  }

  findById(id) {
    let result = null;
    const visit = (object) => {
      if (object.id === id) {
        result = object;
        return;
      }
      if (object instanceof Group) {
        for (const child of object.children) {
          visit(child);
          if (result) return;
        }
      }
    };
    for (const root of this._roots) {
      visit(root);
      if (result) break;
    }
    return result;
  }
}

export class Camera2D {
  constructor({
    centerX = 0,
    centerY = 0,
    height = 2,
    rotation = 0,
    flipY = true,
  } = {}) {
    this.centerX = assertFinite(centerX, 'centerX');
    this.centerY = assertFinite(centerY, 'centerY');
    this.height = assertPositive(height, 'height');
    this.rotation = assertFinite(rotation, 'rotation');
    this.flipY = Boolean(flipY);
    this.version = 0;
  }

  setCenter(x, y) {
    assertFinite(x, 'x');
    assertFinite(y, 'y');
    if (x !== this.centerX || y !== this.centerY) {
      this.centerX = x;
      this.centerY = y;
      this.version += 1;
    }
    return this;
  }

  pan(dx, dy) {
    return this.setCenter(this.centerX + dx, this.centerY + dy);
  }

  setHeight(height) {
    assertPositive(height, 'height');
    if (height !== this.height) {
      this.height = height;
      this.version += 1;
    }
    return this;
  }

  zoom(factor) {
    assertPositive(factor, 'factor');
    return this.setHeight(this.height * factor);
  }

  setRotation(rotation) {
    assertFinite(rotation, 'rotation');
    if (rotation !== this.rotation) {
      this.rotation = rotation;
      this.version += 1;
    }
    return this;
  }

  matrix(out, width, height) {
    assertPositive(width, 'width');
    assertPositive(height, 'height');
    const pixelsPerUnit = height / this.height;
    const scaleX = pixelsPerUnit;
    const scaleY = this.flipY ? -pixelsPerUnit : pixelsPerUnit;
    const cosine = Math.cos(this.rotation);
    const sine = Math.sin(this.rotation);

    out[0] = scaleX * cosine;
    out[1] = -scaleY * sine;
    out[2] = scaleX * sine;
    out[3] = scaleY * cosine;
    out[4] = width * 0.5 - out[0] * this.centerX - out[2] * this.centerY;
    out[5] = height * 0.5 - out[1] * this.centerX - out[3] * this.centerY;
    return out;
  }

  visibleBounds(width, height, padding = 0) {
    assertPositive(width, 'width');
    assertPositive(height, 'height');
    const halfHeight = this.height * 0.5;
    const halfWidth = halfHeight * width / height;
    const cosine = Math.abs(Math.cos(this.rotation));
    const sine = Math.abs(Math.sin(this.rotation));
    const extentX = cosine * halfWidth + sine * halfHeight + padding;
    const extentY = sine * halfWidth + cosine * halfHeight + padding;
    return {
      minX: this.centerX - extentX,
      minY: this.centerY - extentY,
      maxX: this.centerX + extentX,
      maxY: this.centerY + extentY,
    };
  }
}
