import { Camera2D } from './core.js';

function assertCamera(camera) {
  if (!(camera instanceof Camera2D)) {
    throw new TypeError('camera must be a Camera2D');
  }
  return camera;
}

function assertViewport(width, height) {
  if (!Number.isFinite(width) || width <= 0
      || !Number.isFinite(height) || height <= 0) {
    throw new RangeError(
      `viewport is ${String(width)} × ${String(height)}; `
      + 'expected positive finite dimensions',
    );
  }
}

function assertCoordinates(x, y, label) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`${label} coordinates must be finite`);
  }
}

function inverseCameraPoint(camera, x, y, width, height) {
  const matrix = new Float64Array(6);
  camera.matrix(matrix, width, height);
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < Number.EPSILON) {
    throw new RangeError('camera matrix is singular; no camera state was changed');
  }
  const translatedX = x - matrix[4];
  const translatedY = y - matrix[5];
  return [
    (matrix[3] * translatedX - matrix[2] * translatedY) / determinant,
    (-matrix[1] * translatedX + matrix[0] * translatedY) / determinant,
  ];
}

export function worldToScreen(camera, worldX, worldY, width, height) {
  assertCamera(camera);
  assertViewport(width, height);
  assertCoordinates(worldX, worldY, 'world');
  const matrix = new Float64Array(6);
  camera.matrix(matrix, width, height);
  return [
    matrix[0] * worldX + matrix[2] * worldY + matrix[4],
    matrix[1] * worldX + matrix[3] * worldY + matrix[5],
  ];
}

export function screenToWorld(camera, screenX, screenY, width, height) {
  assertCamera(camera);
  assertViewport(width, height);
  assertCoordinates(screenX, screenY, 'screen');
  return inverseCameraPoint(camera, screenX, screenY, width, height);
}

export function panCameraByPixels(camera, deltaX, deltaY, width, height) {
  assertCamera(camera);
  assertViewport(width, height);
  assertCoordinates(deltaX, deltaY, 'grab delta');
  const matrix = new Float64Array(6);
  camera.matrix(matrix, width, height);
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < Number.EPSILON) {
    throw new RangeError('camera matrix is singular; no camera state was changed');
  }
  const worldX = (matrix[3] * deltaX - matrix[2] * deltaY) / determinant;
  const worldY = (-matrix[1] * deltaX + matrix[0] * deltaY) / determinant;
  camera.pan(-worldX, -worldY);
  return camera;
}

function validateZoomBounds(minHeight, maxHeight) {
  if (!Number.isFinite(minHeight) || minHeight <= 0
      || !Number.isFinite(maxHeight) || maxHeight < minHeight) {
    throw new RangeError(
      `zoom bounds are ${String(minHeight)} … ${String(maxHeight)}; `
      + 'expected 0 < minHeight <= maxHeight. No interaction state was changed.',
    );
  }
}

export function zoomCameraAt(
  camera,
  factor,
  screenX,
  screenY,
  width,
  height,
  {
    minHeight = 0.05,
    maxHeight = 1e6,
  } = {},
) {
  assertCamera(camera);
  assertViewport(width, height);
  assertCoordinates(screenX, screenY, 'screen');
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new RangeError(
      `zoom factor is ${String(factor)}; expected a finite value greater than zero. `
      + 'No camera state was changed.',
    );
  }
  validateZoomBounds(minHeight, maxHeight);

  const before = inverseCameraPoint(camera, screenX, screenY, width, height);
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, camera.height * factor));
  camera.setHeight(nextHeight);
  const after = inverseCameraPoint(camera, screenX, screenY, width, height);
  camera.pan(before[0] - after[0], before[1] - after[1]);
  return camera;
}

export function cameraView(camera) {
  assertCamera(camera);
  return Object.freeze({
    centerX: camera.centerX,
    centerY: camera.centerY,
    height: camera.height,
    rotation: camera.rotation,
  });
}

function validateCameraView(view) {
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    throw new TypeError('camera view must be an object. No camera state was changed.');
  }
  for (const name of ['centerX', 'centerY', 'rotation']) {
    if (!Number.isFinite(view[name])) {
      throw new TypeError(
        `camera view ${name} is ${String(view[name])}; expected a finite number. `
        + 'No camera state was changed.',
      );
    }
  }
  if (!Number.isFinite(view.height) || view.height <= 0) {
    throw new RangeError(
      `camera view height is ${String(view.height)}; expected a finite value greater than zero. `
      + 'No camera state was changed.',
    );
  }
  return view;
}

export function restoreCameraView(camera, view) {
  assertCamera(camera);
  const validated = validateCameraView(view);
  camera
    .setCenter(validated.centerX, validated.centerY)
    .setHeight(validated.height)
    .setRotation(validated.rotation);
  return camera;
}

function validateCallback(callback, name) {
  if (typeof callback !== 'function') {
    throw new TypeError(`${name} must be a function`);
  }
}

/**
 * Bind solver-neutral camera interaction to a pointer-event target.
 *
 * The target owns its layout and controls. This module only converts pointer,
 * touch, and wheel gestures into Camera2D mutations and reports those changes.
 */
export function bindViewportInteractions({
  target,
  getCamera,
  onChange = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
  panEnabled = true,
  wheelEnabled = true,
  minHeight = 0.05,
  maxHeight = 1e6,
  wheelSpeed = 0.0018,
} = {}) {
  if (!target
      || typeof target.addEventListener !== 'function'
      || typeof target.removeEventListener !== 'function'
      || typeof target.getBoundingClientRect !== 'function') {
    throw new TypeError(
      'viewport target must provide event listeners and getBoundingClientRect()',
    );
  }
  validateCallback(getCamera, 'getCamera');
  validateCallback(onChange, 'onChange');
  validateCallback(onInteractionStart, 'onInteractionStart');
  validateCallback(onInteractionEnd, 'onInteractionEnd');
  validateZoomBounds(minHeight, maxHeight);
  if (!Number.isFinite(wheelSpeed) || wheelSpeed <= 0) {
    throw new RangeError('wheelSpeed must be a finite value greater than zero');
  }

  const listeners = [];
  const initialViews = new WeakMap();
  const pointers = new Map();
  let allowPan = Boolean(panEnabled);
  let allowWheel = Boolean(wheelEnabled);
  let zoomMin = minHeight;
  let zoomMax = maxHeight;
  let gesture = null;
  let disposed = false;

  function currentCamera() {
    const camera = assertCamera(getCamera());
    if (!initialViews.has(camera)) initialViews.set(camera, cameraView(camera));
    return camera;
  }

  function rectangle() {
    const bounds = target.getBoundingClientRect();
    assertViewport(bounds?.width, bounds?.height);
    const left = bounds.left ?? 0;
    const top = bounds.top ?? 0;
    if (!Number.isFinite(left) || !Number.isFinite(top)) {
      throw new TypeError('viewport left/top coordinates must be finite');
    }
    return {
      left,
      top,
      width: bounds.width,
      height: bounds.height,
    };
  }

  function eventPoint(event, bounds = rectangle()) {
    assertCoordinates(event?.clientX, event?.clientY, 'pointer');
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function metrics() {
    const values = [...pointers.values()];
    if (values.length === 0) return null;
    if (values.length === 1) {
      return {
        count: 1,
        x: values[0].x,
        y: values[0].y,
        distance: 0,
      };
    }
    const first = values[0];
    const second = values[1];
    return {
      count: values.length,
      x: 0.5 * (first.x + second.x),
      y: 0.5 * (first.y + second.y),
      distance: Math.hypot(second.x - first.x, second.y - first.y),
    };
  }

  function notify(type, sourceEvent = null) {
    onChange(Object.freeze({
      type,
      camera: currentCamera(),
      sourceEvent,
    }));
  }

  function on(targetNode, type, listener, options) {
    targetNode.addEventListener(type, listener, options);
    listeners.push([targetNode, type, listener, options]);
  }

  function releasePointers() {
    if (pointers.size > 0) {
      for (const pointerId of pointers.keys()) {
        target.releasePointerCapture?.(pointerId);
      }
      pointers.clear();
      gesture = null;
      onInteractionEnd();
    }
  }

  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    target.releasePointerCapture?.(event.pointerId);
    if (pointers.size === 0) {
      gesture = null;
      onInteractionEnd(event);
    } else {
      gesture = metrics();
    }
    event.preventDefault?.();
  }

  on(target, 'pointerdown', (event) => {
    if (!allowPan) return;
    if (event.pointerType !== 'touch' && event.button !== 0) return;
    const bounds = rectangle();
    const point = eventPoint(event, bounds);
    const starting = pointers.size === 0;
    pointers.set(event.pointerId, point);
    target.setPointerCapture?.(event.pointerId);
    gesture = metrics();
    if (starting) onInteractionStart(event);
    event.preventDefault?.();
  });
  on(target, 'pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const bounds = rectangle();
    const previous = gesture;
    pointers.set(event.pointerId, eventPoint(event, bounds));
    const next = metrics();
    const camera = currentCamera();
    if (previous && next) {
      panCameraByPixels(
        camera,
        next.x - previous.x,
        next.y - previous.y,
        bounds.width,
        bounds.height,
      );
      if (previous.count >= 2
          && next.count >= 2
          && previous.distance > 0
          && next.distance > 0) {
        zoomCameraAt(
          camera,
          previous.distance / next.distance,
          next.x,
          next.y,
          bounds.width,
          bounds.height,
          { minHeight: zoomMin, maxHeight: zoomMax },
        );
      }
      notify(next.count >= 2 ? 'pinch' : 'pan', event);
    }
    gesture = next;
    event.preventDefault?.();
  });
  on(target, 'pointerup', finishPointer);
  on(target, 'pointercancel', finishPointer);
  on(target, 'wheel', (event) => {
    if (!allowWheel) return;
    const bounds = rectangle();
    const point = eventPoint(event, bounds);
    if (!Number.isFinite(event.deltaY)) {
      throw new TypeError('wheel deltaY must be finite');
    }
    const limitedDelta = Math.max(-240, Math.min(240, event.deltaY));
    zoomCameraAt(
      currentCamera(),
      Math.exp(limitedDelta * wheelSpeed),
      point.x,
      point.y,
      bounds.width,
      bounds.height,
      { minHeight: zoomMin, maxHeight: zoomMax },
    );
    notify('wheel', event);
    event.preventDefault?.();
  }, { passive: false });

  currentCamera();

  const controller = {
    setPanEnabled(enabled) {
      allowPan = Boolean(enabled);
      if (!allowPan) releasePointers();
      return controller;
    },
    setWheelEnabled(enabled) {
      allowWheel = Boolean(enabled);
      return controller;
    },
    setZoomBounds(nextMinHeight, nextMaxHeight) {
      validateZoomBounds(nextMinHeight, nextMaxHeight);
      zoomMin = nextMinHeight;
      zoomMax = nextMaxHeight;
      return controller;
    },
    panBy(deltaX, deltaY) {
      const bounds = rectangle();
      panCameraByPixels(currentCamera(), deltaX, deltaY, bounds.width, bounds.height);
      notify('pan');
      return controller;
    },
    zoomAt(factor, screenX = null, screenY = null) {
      const bounds = rectangle();
      const x = screenX ?? bounds.width * 0.5;
      const y = screenY ?? bounds.height * 0.5;
      zoomCameraAt(
        currentCamera(),
        factor,
        x,
        y,
        bounds.width,
        bounds.height,
        { minHeight: zoomMin, maxHeight: zoomMax },
      );
      notify('zoom');
      return controller;
    },
    captureView() {
      const camera = currentCamera();
      initialViews.set(camera, cameraView(camera));
      return controller;
    },
    resetView() {
      const camera = currentCamera();
      restoreCameraView(camera, initialViews.get(camera));
      notify('reset');
      return controller;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releasePointers();
      for (const [node, type, listener, options] of listeners) {
        node.removeEventListener(type, listener, options);
      }
      listeners.length = 0;
    },
  };
  return controller;
}
