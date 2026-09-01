import {
  Camera2D,
  Group,
  Scene,
} from './core.js';
import { buildRoughPolyline, passOpacity } from './chalk.js';
import { buildChalkMaterial } from './chalk-material.js';
import { CurveLayer } from './curve.js';
import { finiteRange, mapScalarToRgba, ScalarField } from './field.js';
import {
  apply2D,
  clamp,
  compose2D,
  matrixScaleMagnitude,
  multiply2D,
  TAU,
} from './math.js';
import { ParticleCloud } from './particles.js';
import { SegmentLayer } from './segments.js';

const IDENTITY = new Float64Array([1, 0, 0, 1, 0, 0]);

function matrixEquals(a, b) {
  return a
    && a[0] === b[0]
    && a[1] === b[1]
    && a[2] === b[2]
    && a[3] === b[3]
    && a[4] === b[4]
    && a[5] === b[5];
}

function ensurePacked(cache, length, key) {
  if (!cache[key] || cache[key].length !== length) cache[key] = new Float32Array(length);
  return cache[key];
}

function projectPacked(out, points, matrix) {
  for (let index = 0; index < points.length; index += 2) {
    const x = points[index];
    const y = points[index + 1];
    out[index] = matrix[0] * x + matrix[2] * y + matrix[4];
    out[index + 1] = matrix[1] * x + matrix[3] * y + matrix[5];
  }
  return out;
}

function scaleFontPixels(font, pixelRatio) {
  if (pixelRatio === 1) return font;
  return String(font).replace(/(\d+(?:\.\d+)?)px/, (_match, size) => `${Number(size) * pixelRatio}px`);
}

function usesChalkMaterial(style) {
  if (style.wobble === undefined) return false;
  return style.wobble > 0
    || style.pressure !== 1
    || style.pressureVariation > 0
    || style.coverage < 1
    || style.edgeBreakup > 0
    || style.dust > 0
    || style.softness > 0
    || style.accumulation > 0;
}

function groupSegmentMaterials(materials) {
  const carriers = new Map();
  const deposits = new Map();
  let materialSamples = 0;
  let materialSegments = 0;
  let materialFragments = 0;
  for (const material of materials) {
    materialSamples += material.sampleCount;
    materialSegments += material.segmentCount;
    materialFragments += material.fragmentCount;
    for (const carrier of material.carrierBatches) {
      let group = carriers.get(carrier.pass);
      if (!group) {
        group = { pass: carrier.pass, paths: [], count: 0, width: 0, opacity: 0 };
        carriers.set(carrier.pass, group);
      }
      group.paths.push(carrier.points);
      group.count += 1;
      group.width += carrier.widthScale;
      group.opacity += carrier.opacityScale;
    }
    for (const batch of material.batches) {
      const key = `${batch.pass}:${batch.band}`;
      let group = deposits.get(key);
      if (!group) {
        group = {
          pass: batch.pass,
          band: batch.band,
          runs: [],
          count: 0,
          width: 0,
          opacity: 0,
          brightness: 0,
        };
        deposits.set(key, group);
      }
      group.runs.push(...batch.runs);
      group.count += 1;
      group.width += batch.widthScale;
      group.opacity += batch.opacityScale;
      group.brightness += batch.brightness;
    }
  }
  return {
    pathsByPass: null,
    carrierGroups: [...carriers.values()].sort((a, b) => a.pass - b.pass),
    depositGroups: [...deposits.values()].sort(
      (a, b) => a.pass - b.pass || a.band - b.band,
    ),
    materialSamples,
    materialSegments,
    materialFragments,
  };
}

function createSurface(canvas, width, height) {
  if (typeof OffscreenCanvas === 'function') {
    const surface = new OffscreenCanvas(width, height);
    return { surface, context: surface.getContext('2d', { alpha: true }) };
  }
  const document = canvas?.ownerDocument ?? globalThis.document;
  if (document?.createElement) {
    const surface = document.createElement('canvas');
    surface.width = width;
    surface.height = height;
    return { surface, context: surface.getContext('2d', { alpha: true }) };
  }
  return { surface: null, context: null };
}

export class Canvas2DRenderer {
  constructor(target, {
    alpha = false,
    desynchronized = true,
    pixelRatio = 1,
  } = {}) {
    if (!target) throw new TypeError('a canvas or CanvasRenderingContext2D is required');
    if (typeof target.getContext === 'function') {
      this.canvas = target;
      this.context = target.getContext('2d', { alpha, desynchronized });
    } else {
      this.context = target;
      this.canvas = target.canvas;
    }
    if (!this.context) throw new Error('Canvas2D context is unavailable');
    this.pixelRatio = pixelRatio;
    this._cache = new WeakMap();
    this._localMatrices = [];
    this._combinedMatrices = [];
    this._cameraMatrix = new Float64Array(6);
    this._point = new Float64Array(2);
    this._stats = null;
  }

  resize(cssWidth, cssHeight, pixelRatio = this.pixelRatio) {
    if (!Number.isFinite(cssWidth) || cssWidth <= 0 || !Number.isFinite(cssHeight) || cssHeight <= 0) {
      throw new RangeError('canvas size must be positive and finite');
    }
    if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) throw new RangeError('pixelRatio must be positive');
    this.pixelRatio = pixelRatio;
    const width = Math.max(1, Math.round(cssWidth * pixelRatio));
    const height = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (this.canvas.style) {
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
    }
    return this;
  }

  clearCache(object = null) {
    if (object) this._cache.delete(object);
    else this._cache = new WeakMap();
    return this;
  }

  render(scene, camera = new Camera2D(), quality = {}) {
    if (!(scene instanceof Scene)) throw new TypeError('scene must be a Scene');
    if (!(camera instanceof Camera2D)) throw new TypeError('camera must be a Camera2D');
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!(width > 0 && height > 0)) throw new RangeError('canvas backing size must be positive');

    const context = this.context;
    const stats = {
      objects: 0,
      drawCalls: 0,
      particles: 0,
      curvePoints: 0,
      segments: 0,
      fieldPixels: 0,
      cacheMisses: 0,
      materialSamples: 0,
      materialSegments: 0,
      materialFragments: 0,
      materialGroupBuilds: 0,
    };
    this._stats = stats;
    this._quality = {
      particleStride: Math.max(1, Math.round(quality.particleStride ?? 1)),
      fieldStride: Math.max(1, Math.round(quality.fieldStride ?? 1)),
      curveTolerance: Math.max(0.25, quality.curveTolerance ?? 0.75),
    };

    context.save();
    if (typeof context.setTransform === 'function') context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    if (scene.background === null || scene.background === 'transparent') {
      context.clearRect(0, 0, width, height);
    } else {
      context.fillStyle = scene.background;
      context.fillRect(0, 0, width, height);
    }

    camera.matrix(this._cameraMatrix, width, height);
    for (const object of scene.sortedRoots()) {
      this._drawObject(object, this._cameraMatrix, 1, 0);
    }
    context.restore();
    this._stats = null;
    return stats;
  }

  _matrixAt(storage, depth) {
    if (!storage[depth]) storage[depth] = new Float64Array(6);
    return storage[depth];
  }

  _drawObject(object, parentMatrix, parentOpacity, depth) {
    if (!object.visible || object.opacity <= 0) return;
    const local = this._matrixAt(this._localMatrices, depth);
    const combined = this._matrixAt(this._combinedMatrices, depth);
    compose2D(local, object.x, object.y, object.scaleX, object.scaleY, object.rotation);
    multiply2D(combined, parentMatrix, local);
    const opacity = parentOpacity * object.opacity;

    if (object instanceof Group) {
      for (const child of object.sortedChildren()) {
        this._drawObject(child, combined, opacity, depth + 1);
      }
      return;
    }

    this._stats.objects += 1;
    if (object instanceof ScalarField) {
      this._drawScalarField(object, combined, opacity);
    } else if (object instanceof ParticleCloud) {
      this._drawParticleCloud(object, combined, opacity);
    } else if (object instanceof SegmentLayer) {
      this._drawSegmentLayer(object, combined, opacity);
    } else if (object instanceof CurveLayer) {
      this._drawCurveLayer(object, combined, opacity);
    } else {
      this._drawVectorObject(object, combined, opacity);
    }
  }

  _cacheFor(object) {
    let cache = this._cache.get(object);
    if (!cache) {
      cache = { matrix: new Float64Array(6).fill(Number.NaN) };
      this._cache.set(object, cache);
    }
    return cache;
  }

  _vectorCacheDirty(object, cache, matrix, extra = 0) {
    return cache.geometryVersion !== object.geometryVersion
      || cache.styleVersion !== object.styleVersion
      || cache.extra !== extra
      || cache.pixelRatio !== this.pixelRatio
      || !matrixEquals(cache.matrix, matrix);
  }

  _commitVectorCache(object, cache, matrix, extra = 0) {
    cache.geometryVersion = object.geometryVersion;
    cache.styleVersion = object.styleVersion;
    cache.extra = extra;
    cache.pixelRatio = this.pixelRatio;
    cache.matrix.set(matrix);
    this._stats.cacheMisses += 1;
  }

  _buildStroke(points, style, seed, closed) {
    if (usesChalkMaterial(style)) {
      const spacing = clamp(style.grainSize ?? 1.5, 1, 2) * this.pixelRatio;
      return {
        material: buildChalkMaterial(points, {
          ...style,
          wobble: style.wobble * this.pixelRatio,
        }, seed, {
          closed, spacing, velocity: style.velocity ?? null, dwell: style.dwell ?? null,
          strokeWidth: (style.width ?? 1) * this.pixelRatio,
        }),
        paths: null,
      };
    }
    return {
      material: null,
      paths: buildRoughPolyline(points, {
        ...style,
        roughness: (style.roughness ?? 0) * this.pixelRatio,
      }, seed),
    };
  }

  _drawVectorObject(object, matrix, inheritedOpacity) {
    switch (object.kind) {
      case 'line':
      case 'polyline':
      case 'polygon':
        this._drawPackedObject(object, object.points, matrix, inheritedOpacity, object.closed);
        break;
      case 'circle':
        this._drawCircle(object, matrix, inheritedOpacity);
        break;
      case 'rectangle':
        this._drawRectangle(object, matrix, inheritedOpacity);
        break;
      case 'arrow':
        this._drawArrow(object, matrix, inheritedOpacity);
        break;
      case 'text':
        this._drawText(object, matrix, inheritedOpacity);
        break;
      default:
        throw new Error(`unsupported mobject kind: ${object.kind}`);
    }
  }

  _drawPackedObject(object, localPoints, matrix, inheritedOpacity, closed) {
    const cache = this._cacheFor(object);
    if (this._vectorCacheDirty(object, cache, matrix, localPoints.length)) {
      const projected = ensurePacked(cache, localPoints.length, 'projected');
      projectPacked(projected, localPoints, matrix);
      cache.stroke = this._buildStroke(projected, object.style, object.id, closed);
      this._commitVectorCache(object, cache, matrix, localPoints.length);
    }
    this._fillPath(cache.projected, object.style, inheritedOpacity, closed);
    this._strokeCached(cache.stroke, object.style, inheritedOpacity, closed);
  }

  _drawCircle(object, matrix, inheritedOpacity) {
    const pixelRadius = object.radius * matrixScaleMagnitude(matrix);
    const segments = Math.max(16, Math.min(160, Math.ceil(
      TAU * Math.sqrt(Math.max(pixelRadius, 1) / this._quality.curveTolerance),
    )));
    const cache = this._cacheFor(object);
    if (this._vectorCacheDirty(object, cache, matrix, segments)) {
      const local = ensurePacked(cache, segments * 2, 'local');
      for (let index = 0; index < segments; index += 1) {
        const angle = TAU * index / segments;
        local[index * 2] = Math.cos(angle) * object.radius;
        local[index * 2 + 1] = Math.sin(angle) * object.radius;
      }
      const projected = ensurePacked(cache, local.length, 'projected');
      projectPacked(projected, local, matrix);
      cache.stroke = this._buildStroke(projected, object.style, object.id, true);
      this._commitVectorCache(object, cache, matrix, segments);
    }
    this._fillPath(cache.projected, object.style, inheritedOpacity, true);
    this._strokeCached(cache.stroke, object.style, inheritedOpacity, true);
  }

  _drawRectangle(object, matrix, inheritedOpacity) {
    const cache = this._cacheFor(object);
    if (this._vectorCacheDirty(object, cache, matrix, 8)) {
      const halfWidth = object.width * 0.5;
      const halfHeight = object.height * 0.5;
      const local = ensurePacked(cache, 8, 'local');
      local.set([
        -halfWidth, -halfHeight,
        halfWidth, -halfHeight,
        halfWidth, halfHeight,
        -halfWidth, halfHeight,
      ]);
      const projected = ensurePacked(cache, 8, 'projected');
      projectPacked(projected, local, matrix);
      cache.stroke = this._buildStroke(projected, object.style, object.id, true);
      this._commitVectorCache(object, cache, matrix, 8);
    }
    this._fillPath(cache.projected, object.style, inheritedOpacity, true);
    this._strokeCached(cache.stroke, object.style, inheritedOpacity, true);
  }

  _drawArrow(object, matrix, inheritedOpacity) {
    const cache = this._cacheFor(object);
    if (this._vectorCacheDirty(object, cache, matrix, object.headLength)) {
      const projected = ensurePacked(cache, 4, 'projected');
      projectPacked(projected, object.points, matrix);
      cache.stroke = this._buildStroke(projected, object.style, object.id, false);
      const x1 = projected[0];
      const y1 = projected[1];
      const x2 = projected[2];
      const y2 = projected[3];
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const length = object.headLength * this.pixelRatio;
      const head = ensurePacked(cache, 6, 'head');
      head[0] = x2 - Math.cos(angle - object.headAngle) * length;
      head[1] = y2 - Math.sin(angle - object.headAngle) * length;
      head[2] = x2;
      head[3] = y2;
      head[4] = x2 - Math.cos(angle + object.headAngle) * length;
      head[5] = y2 - Math.sin(angle + object.headAngle) * length;
      cache.headStroke = this._buildStroke(
        head,
        object.style,
        object.id ^ 0x5f3759df,
        false,
      );
      this._commitVectorCache(object, cache, matrix, object.headLength);
    }
    this._strokeCached(cache.stroke, object.style, inheritedOpacity, false);
    this._strokeCached(cache.headStroke, object.style, inheritedOpacity, false);
  }

  _beginPackedPath(points, closed) {
    const context = this.context;
    context.beginPath();
    this._appendPackedPath(points, closed);
  }

  _appendPackedPath(points, closed = false) {
    const context = this.context;
    context.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) {
      context.lineTo(points[index], points[index + 1]);
    }
    if (closed) context.closePath();
  }

  _fillPath(points, style, inheritedOpacity, closed) {
    if (!closed || !style.fill) return;
    const context = this.context;
    this._beginPackedPath(points, true);
    context.fillStyle = style.fill;
    context.globalAlpha = inheritedOpacity * (style.opacity ?? 1);
    context.globalCompositeOperation = style.composite ?? 'source-over';
    context.fill();
    this._stats.drawCalls += 1;
  }

  _strokePaths(paths, style, inheritedOpacity, closed) {
    if (!style.stroke || !paths) return;
    const context = this.context;
    context.strokeStyle = style.stroke;
    context.lineWidth = (style.width ?? 1) * this.pixelRatio;
    context.lineCap = style.lineCap ?? 'round';
    context.lineJoin = style.lineJoin ?? 'round';
    context.globalCompositeOperation = style.composite ?? 'source-over';
    if (typeof context.setLineDash === 'function') {
      if (style.dash) context.setLineDash(Array.from(style.dash, (value) => value * this.pixelRatio));
      else context.setLineDash([]);
    }

    for (let pass = 0; pass < paths.length; pass += 1) {
      this._beginPackedPath(paths[pass], closed);
      context.globalAlpha = inheritedOpacity * passOpacity(style, pass);
      context.stroke();
      this._stats.drawCalls += 1;
    }
  }

  _strokeCached(stroke, style, inheritedOpacity, closed) {
    if (stroke?.material) {
      this._strokeMaterial(stroke.material, style, inheritedOpacity);
    } else {
      this._strokePaths(stroke?.paths, style, inheritedOpacity, closed);
    }
  }

  _strokeMaterial(material, style, inheritedOpacity) {
    if (!style.stroke || !material) return;
    const context = this.context;
    context.strokeStyle = style.stroke;
    context.lineCap = style.lineCap ?? 'round';
    context.lineJoin = style.lineJoin ?? 'round';
    context.globalCompositeOperation = style.composite ?? 'source-over';
    if (typeof context.setLineDash === 'function') {
      if (style.dash) context.setLineDash(Array.from(style.dash, (value) => value * this.pixelRatio));
      else context.setLineDash([]);
    }

    this._stats.materialSamples += material.sampleCount;
    this._stats.materialSegments += material.segmentCount;
    this._stats.materialFragments += material.fragmentCount;
    for (const carrier of material.carrierBatches) {
      this._beginPackedPath(carrier.points, carrier.closed);
      context.lineWidth = (style.width ?? 1) * this.pixelRatio * carrier.widthScale;
      context.globalAlpha = inheritedOpacity * passOpacity(style, carrier.pass)
        * carrier.opacityScale;
      context.stroke();
      this._stats.drawCalls += 1;
    }
    for (const batch of material.batches) {
      context.beginPath();
      for (const run of batch.runs) {
        context.moveTo(run[0], run[1]);
        for (let index = 2; index < run.length; index += 2) {
          context.lineTo(run[index], run[index + 1]);
        }
      }
      context.lineWidth = (style.width ?? 1)
        * this.pixelRatio
        * batch.widthScale;
      context.globalAlpha = inheritedOpacity
        * passOpacity(style, batch.pass)
        * batch.opacityScale
        * (0.82 + batch.brightness * 0.18);
      context.stroke();
      this._stats.drawCalls += 1;
    }
  }

  _drawText(object, matrix, inheritedOpacity) {
    apply2D(this._point, matrix, 0, 0);
    const context = this.context;
    context.font = scaleFontPixels(object.font, this.pixelRatio);
    context.textAlign = object.align;
    context.textBaseline = object.baseline;
    context.fillStyle = object.style.fill ?? object.style.stroke ?? '#f3f0e8';
    context.globalAlpha = inheritedOpacity * (object.style.opacity ?? 1);
    context.globalCompositeOperation = object.style.composite ?? 'source-over';
    const passes = Math.max(1, Math.min(3, object.style.passes ?? 1));
    const roughness = (object.style.roughness ?? 0) * this.pixelRatio * 0.25;
    for (let pass = 0; pass < passes; pass += 1) {
      const offset = passes === 1 ? 0 : (pass - (passes - 1) / 2) * roughness;
      if (object.maxWidth === undefined) {
        context.fillText(object.text, this._point[0] + offset, this._point[1] - offset);
      } else {
        context.fillText(
          object.text,
          this._point[0] + offset,
          this._point[1] - offset,
          object.maxWidth * this.pixelRatio,
        );
      }
      this._stats.drawCalls += 1;
    }
  }

  _drawCurveLayer(curve, matrix, inheritedOpacity) {
    this._stats.curvePoints += curve.count;
    if (curve.count < 2) return;
    const cache = this._cacheFor(curve);
    const dirty = this._vectorCacheDirty(curve, cache, matrix, curve.count)
      || cache.dataVersion !== curve.dataVersion
      || cache.positionsX !== curve.positionsX
      || cache.positionsY !== curve.positionsY;
    if (dirty) {
      const projected = ensurePacked(cache, curve.count * 2, 'projected');
      for (let index = 0; index < curve.count; index += 1) {
        const x = curve.positionsX[index];
        const y = curve.positionsY[index];
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new RangeError(
            `CurveLayer coordinate at index ${index} is not finite; `
            + 'mark missing samples explicitly in a separate segment.',
          );
        }
        projected[index * 2] = matrix[0] * x + matrix[2] * y + matrix[4];
        projected[index * 2 + 1] = matrix[1] * x + matrix[3] * y + matrix[5];
      }
      cache.stroke = this._buildStroke(projected, curve.style, curve.id, false);
      cache.dataVersion = curve.dataVersion;
      cache.positionsX = curve.positionsX;
      cache.positionsY = curve.positionsY;
      this._commitVectorCache(curve, cache, matrix, curve.count);
    }
    this._strokeCached(cache.stroke, curve.style, inheritedOpacity, false);
  }

  _buildSegmentCollection(projected, style, seed) {
    const segmentCount = projected.length / 4;
    if (usesChalkMaterial(style)) {
      const materials = new Array(segmentCount);
      const spacing = clamp(style.grainSize ?? 1.5, 1, 2) * this.pixelRatio;
      for (let index = 0; index < segmentCount; index += 1) {
        const endpoints = projected.subarray(index * 4, index * 4 + 4);
        materials[index] = buildChalkMaterial(
          endpoints,
          {
            ...style,
            wobble: style.wobble * this.pixelRatio,
          },
          seed ^ Math.imul(index + 1, 0x9e3779b1),
          {
            spacing,
            strokeWidth: (style.width ?? 1) * this.pixelRatio,
            velocity: typeof style.velocity === 'number' ? style.velocity : null,
            dwell: typeof style.dwell === 'number' ? style.dwell : null,
          },
        );
      }
      this._stats.materialGroupBuilds += 1;
      return groupSegmentMaterials(materials);
    }

    const passCount = Math.max(1, Math.round(style.passes ?? 1));
    const pathsByPass = Array.from({ length: passCount }, () => []);
    for (let index = 0; index < segmentCount; index += 1) {
      const endpoints = projected.subarray(index * 4, index * 4 + 4);
      const paths = buildRoughPolyline(
        endpoints,
        {
          ...style,
          roughness: (style.roughness ?? 0) * this.pixelRatio,
        },
        seed ^ Math.imul(index + 1, 0x9e3779b1),
      );
      for (let pass = 0; pass < paths.length; pass += 1) {
        pathsByPass[pass].push(paths[pass]);
      }
    }
    return { materials: null, pathsByPass };
  }

  _applySegmentStrokeStyle(style) {
    const context = this.context;
    context.strokeStyle = style.stroke;
    context.lineCap = style.lineCap ?? 'round';
    context.lineJoin = style.lineJoin ?? 'round';
    context.globalCompositeOperation = style.composite ?? 'source-over';
    if (typeof context.setLineDash === 'function') {
      if (style.dash) {
        context.setLineDash(Array.from(style.dash, (value) => value * this.pixelRatio));
      } else {
        context.setLineDash([]);
      }
    }
  }

  _strokeSegmentCollection(collection, style, inheritedOpacity) {
    if (!style.stroke || !collection) return;
    const context = this.context;
    this._applySegmentStrokeStyle(style);

    if (collection.pathsByPass) {
      for (let pass = 0; pass < collection.pathsByPass.length; pass += 1) {
        const paths = collection.pathsByPass[pass];
        if (paths.length === 0) continue;
        context.beginPath();
        for (const points of paths) this._appendPackedPath(points);
        context.lineWidth = (style.width ?? 1) * this.pixelRatio;
        context.globalAlpha = inheritedOpacity * passOpacity(style, pass);
        context.stroke();
        this._stats.drawCalls += 1;
      }
      return;
    }

    this._stats.materialSamples += collection.materialSamples;
    this._stats.materialSegments += collection.materialSegments;
    this._stats.materialFragments += collection.materialFragments;
    for (const group of collection.carrierGroups) {
      if (group.paths.length === 0) continue;
      context.beginPath();
      for (const points of group.paths) this._appendPackedPath(points);
      context.lineWidth = (style.width ?? 1) * this.pixelRatio
        * group.width / group.count;
      context.globalAlpha = inheritedOpacity * passOpacity(style, group.pass)
        * group.opacity / group.count;
      context.stroke();
      this._stats.drawCalls += 1;
    }
    for (const group of collection.depositGroups) {
      if (group.runs.length === 0) continue;
      context.beginPath();
      for (const run of group.runs) this._appendPackedPath(run);
      context.lineWidth = (style.width ?? 1) * this.pixelRatio
        * group.width / group.count;
      context.globalAlpha = inheritedOpacity
        * passOpacity(style, group.pass)
        * group.opacity / group.count
        * (0.82 + (group.brightness / group.count) * 0.18);
      context.stroke();
      this._stats.drawCalls += 1;
    }
  }

  _drawSegmentLayer(layer, matrix, inheritedOpacity) {
    if (layer.count === 0) return;
    const cache = this._cacheFor(layer);
    const dirty = this._vectorCacheDirty(layer, cache, matrix, layer.count)
      || cache.dataVersion !== layer.dataVersion
      || cache.segments !== layer.segments;
    if (dirty) {
      const visible = ensurePacked(cache, layer.count * 4, 'visibleSegments');
      const padding = Math.max(1, (layer.style.width ?? 1) * this.pixelRatio);
      let visibleLength = 0;
      for (let index = 0; index < layer.count; index += 1) {
        const offset = index * 4;
        const x1 = layer.segments[offset];
        const y1 = layer.segments[offset + 1];
        const x2 = layer.segments[offset + 2];
        const y2 = layer.segments[offset + 3];
        if (![x1, y1, x2, y2].every(Number.isFinite)) {
          throw new RangeError(
            `SegmentLayer endpoint ${index} is not finite; `
            + 'No segment command stream was emitted.',
          );
        }
        const px1 = matrix[0] * x1 + matrix[2] * y1 + matrix[4];
        const py1 = matrix[1] * x1 + matrix[3] * y1 + matrix[5];
        const px2 = matrix[0] * x2 + matrix[2] * y2 + matrix[4];
        const py2 = matrix[1] * x2 + matrix[3] * y2 + matrix[5];
        if (Math.max(px1, px2) < -padding
            || Math.min(px1, px2) > this.canvas.width + padding
            || Math.max(py1, py2) < -padding
            || Math.min(py1, py2) > this.canvas.height + padding) {
          continue;
        }
        visible[visibleLength] = px1;
        visible[visibleLength + 1] = py1;
        visible[visibleLength + 2] = px2;
        visible[visibleLength + 3] = py2;
        visibleLength += 4;
      }
      cache.segmentCollection = this._buildSegmentCollection(
        visible.subarray(0, visibleLength),
        layer.style,
        layer.id,
      );
      cache.visibleCount = visibleLength / 4;
      cache.dataVersion = layer.dataVersion;
      cache.segments = layer.segments;
      this._commitVectorCache(layer, cache, matrix, layer.count);
    }
    this._stats.segments += cache.visibleCount;
    this._strokeSegmentCollection(
      cache.segmentCollection,
      layer.style,
      inheritedOpacity,
    );
  }

  _drawParticleCloud(cloud, matrix, inheritedOpacity) {
    const context = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const stride = this._quality.particleStride;
    let visibleTotal = 0;

    for (let paletteIndex = 0; paletteIndex < cloud.palette.length; paletteIndex += 1) {
      const style = cloud.palette[paletteIndex];
      let visible = 0;
      context.beginPath();
      for (let index = 0; index < cloud.count; index += stride) {
        if (cloud.styleIndex && cloud.styleIndex[index] !== paletteIndex) continue;
        const x = cloud.positionsX[index];
        const y = cloud.positionsY[index];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const px = matrix[0] * x + matrix[2] * y + matrix[4];
        const py = matrix[1] * x + matrix[3] * y + matrix[5];
        const baseRadius = typeof cloud.radius === 'number'
          ? cloud.radius
          : cloud.radius
            ? cloud.radius[index]
            : style.radius;
        const radius = Math.max(0.5, baseRadius * this.pixelRatio);
        if (px < -radius || px > width + radius || py < -radius || py > height + radius) continue;
        if (cloud.shape === 'pixel' || radius <= 0.75) {
          context.rect(px - radius, py - radius, radius * 2, radius * 2);
        } else {
          context.moveTo(px + radius, py);
          context.arc(px, py, radius, 0, TAU);
        }
        visible += 1;
      }
      if (visible === 0) continue;

      context.globalAlpha = inheritedOpacity * style.opacity;
      context.globalCompositeOperation = cloud.style.composite ?? 'source-over';
      if (style.fill) {
        context.fillStyle = style.fill;
        context.fill();
        this._stats.drawCalls += 1;
      }
      if (style.stroke) {
        context.strokeStyle = style.stroke;
        context.lineWidth = style.width * this.pixelRatio;
        context.stroke();
        this._stats.drawCalls += 1;
      }
      visibleTotal += visible;
    }
    this._stats.particles += visibleTotal;
  }

  _drawScalarField(field, matrix, inheritedOpacity) {
    const stride = this._quality.fieldStride;
    const columns = Math.ceil(field.columns / stride);
    const rows = Math.ceil(field.rows / stride);
    const cache = this._cacheFor(field);
    const surfaceChanged = !cache.surfaceInitialized || cache.columns !== columns || cache.rows !== rows;
    if (surfaceChanged) {
      const created = createSurface(this.canvas, columns, rows);
      cache.surface = created.surface;
      cache.surfaceContext = created.context;
      cache.surfaceInitialized = true;
      cache.columns = columns;
      cache.rows = rows;
      cache.imageData = (cache.surfaceContext ?? this.context).createImageData(columns, rows);
      cache.sampled = stride === 1 ? null : new Float32Array(columns * rows);
      if (cache.surface) {
        cache.surface.width = columns;
        cache.surface.height = rows;
      }
    }

    const needsPixels = surfaceChanged
      || cache.dataVersion !== field.dataVersion
      || cache.data !== field.data
      || cache.lut !== field.lut
      || cache.min !== field.min
      || cache.max !== field.max
      || cache.stride !== stride;

    if (needsPixels) {
      let source = field.data;
      if (stride > 1) {
        const sampled = cache.sampled && cache.sampled.length === columns * rows
          ? cache.sampled
          : new Float32Array(columns * rows);
        cache.sampled = sampled;
        let output = 0;
        for (let row = 0; row < field.rows; row += stride) {
          const offset = row * field.columns;
          for (let column = 0; column < field.columns; column += stride) {
            sampled[output++] = field.data[offset + column];
          }
        }
        source = sampled;
      }
      const range = field.min === null || field.max === null
        ? finiteRange(source)
        : [field.min, field.max];
      mapScalarToRgba(
        source,
        cache.imageData.data,
        field.lut,
        range[0],
        range[1],
        field.invalidColor,
      );
      if (cache.surfaceContext) cache.surfaceContext.putImageData(cache.imageData, 0, 0);
      cache.dataVersion = field.dataVersion;
      cache.data = field.data;
      cache.lut = field.lut;
      cache.min = field.min;
      cache.max = field.max;
      cache.stride = stride;
      this._stats.cacheMisses += 1;
    }

    const domain = field.domain;
    const domainWidth = domain.maxX - domain.minX;
    const domainHeight = domain.maxY - domain.minY;
    const context = this.context;
    context.save();
    context.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
    context.globalAlpha = inheritedOpacity * (field.style.opacity ?? 1);
    context.imageSmoothingEnabled = field.interpolation !== 'nearest';
    if (cache.surface) {
      context.drawImage(cache.surface, domain.minX, domain.minY, domainWidth, domainHeight);
    } else {
      apply2D(this._point, matrix, domain.minX, domain.minY);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.putImageData(cache.imageData, Math.round(this._point[0]), Math.round(this._point[1]));
    }
    context.restore();
    this._stats.drawCalls += 1;
    this._stats.fieldPixels += columns * rows;
  }
}

export function supportsOffscreenCanvas() {
  return typeof OffscreenCanvas === 'function';
}

export function supportsCanvasTransfer(canvas) {
  return Boolean(canvas && typeof canvas.transferControlToOffscreen === 'function');
}

export { IDENTITY };
