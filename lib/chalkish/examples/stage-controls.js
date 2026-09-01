import { Camera2D } from '../src/core.js';
import {
  bindViewportInteractions,
  panCameraByPixels,
  zoomCameraAt,
} from '../src/interaction.js';

export {
  panCameraByPixels,
  zoomCameraAt,
};

function defaultTranslate(key) {
  return ({
    'stage.play': 'Play animation',
    'stage.pause': 'Pause animation',
    'stage.enterFullscreen': 'Enter fullscreen',
    'stage.exitFullscreen': 'Exit fullscreen',
    'stage.fullscreenUnavailable': 'Fullscreen unavailable',
  })[key] ?? key;
}

function assertCamera(camera) {
  if (!(camera instanceof Camera2D)) {
    throw new TypeError('getCamera() must return a Camera2D');
  }
  return camera;
}

function required(root, selector) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`stage controls are missing ${selector}`);
  return node;
}

export function bindStageControls({
  root,
  canvas,
  app,
  getCamera = () => app.camera,
  zoomStep = 0.8,
  translate = defaultTranslate,
} = {}) {
  if (!root || typeof root.querySelector !== 'function') {
    throw new TypeError('stage-control root must provide querySelector');
  }
  if (!canvas || typeof canvas.addEventListener !== 'function') {
    throw new TypeError('stage-control canvas must provide addEventListener');
  }
  for (const method of ['start', 'stop', 'stepOnce', 'render', 'setPlaybackRate']) {
    if (!app || typeof app[method] !== 'function') {
      throw new TypeError(`stage-control app must provide ${method}()`);
    }
  }
  if (typeof getCamera !== 'function') throw new TypeError('getCamera must be a function');
  if (typeof translate !== 'function') throw new TypeError('translate must be a function');
  if (!Number.isFinite(zoomStep) || zoomStep <= 0 || zoomStep >= 1) {
    throw new RangeError('zoomStep must be between zero and one');
  }

  const nodes = Object.freeze({
    pause: required(root, '[data-action="pause"]'),
    step: required(root, '[data-action="step"]'),
    grab: required(root, '[data-action="grab"]'),
    zoomIn: required(root, '[data-action="zoom-in"]'),
    zoomOut: required(root, '[data-action="zoom-out"]'),
    resetView: required(root, '[data-action="reset-view"]'),
    fullscreen: required(root, '[data-action="fullscreen"]'),
    playbackRate: required(root, '[data-playback-rate]'),
  });
  const ownerDocument = root.ownerDocument
    ?? canvas.ownerDocument
    ?? globalThis.document
    ?? null;
  const fullscreenTarget = canvas.closest?.('[data-stage-viewport]') ?? canvas;
  const listeners = [];
  let grabEnabled = false;

  function camera() {
    return assertCamera(getCamera());
  }

  function on(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    listeners.push([target, type, listener, options]);
  }

  function syncPause() {
    const paused = !app.running;
    const label = translate(paused ? 'stage.play' : 'stage.pause');
    nodes.pause.setAttribute('aria-pressed', String(paused));
    nodes.pause.setAttribute('aria-label', label);
    nodes.pause.setAttribute('title', label);
    nodes.step.disabled = !paused;
  }

  function setPaused(paused) {
    if (paused) app.stop();
    else app.start();
    syncPause();
    return controls;
  }

  function syncFullscreen() {
    const supported = Boolean(
      ownerDocument
      && typeof fullscreenTarget.requestFullscreen === 'function'
      && typeof ownerDocument.exitFullscreen === 'function',
    );
    const active = supported && ownerDocument.fullscreenElement === fullscreenTarget;
    const label = supported
      ? translate(active ? 'stage.exitFullscreen' : 'stage.enterFullscreen')
      : translate('stage.fullscreenUnavailable');
    nodes.fullscreen.disabled = !supported;
    nodes.fullscreen.setAttribute('aria-pressed', String(active));
    nodes.fullscreen.setAttribute('aria-label', label);
    nodes.fullscreen.setAttribute('title', label);
  }

  async function toggleFullscreen() {
    if (nodes.fullscreen.disabled) return;
    try {
      if (ownerDocument.fullscreenElement === fullscreenTarget) {
        await ownerDocument.exitFullscreen();
      } else {
        if (ownerDocument.fullscreenElement) await ownerDocument.exitFullscreen();
        await fullscreenTarget.requestFullscreen();
      }
      nodes.fullscreen.removeAttribute?.('data-fullscreen-error');
      syncFullscreen();
      app.render();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      nodes.fullscreen.setAttribute('data-fullscreen-error', detail);
      nodes.fullscreen.setAttribute('title', detail);
      globalThis.console?.error?.(`Could not change fullscreen state: ${detail}`);
    }
  }

  function viewport() {
    const rectangle = canvas.getBoundingClientRect();
    if (!Number.isFinite(rectangle.width) || rectangle.width <= 0
        || !Number.isFinite(rectangle.height) || rectangle.height <= 0) {
      throw new RangeError(
        `viewport is ${String(rectangle.width)} × ${String(rectangle.height)}; `
        + 'expected positive finite dimensions',
      );
    }
    return rectangle;
  }

  function zoom(factor, clientX = null, clientY = null) {
    const rectangle = viewport();
    const x = clientX === null ? rectangle.width * 0.5 : clientX - rectangle.left;
    const y = clientY === null ? rectangle.height * 0.5 : clientY - rectangle.top;
    viewportInteractions.zoomAt(factor, x, y);
  }

  function captureView() {
    const current = camera();
    viewportInteractions
      .captureView()
      .setZoomBounds(current.height * 0.15, current.height * 8);
  }

  const viewportInteractions = bindViewportInteractions({
    target: canvas,
    getCamera: camera,
    panEnabled: false,
    wheelEnabled: true,
    onChange: () => app.render(),
    onInteractionStart: () => canvas.classList.toggle('is-dragging', true),
    onInteractionEnd: () => canvas.classList.toggle('is-dragging', false),
  });
  captureView();

  on(nodes.pause, 'click', () => setPaused(app.running));
  on(nodes.step, 'click', () => {
    if (app.running) app.stop();
    app.stepOnce();
    syncPause();
  });
  on(nodes.playbackRate, 'change', () => {
    app.setPlaybackRate(Number(nodes.playbackRate.value));
  });
  on(nodes.grab, 'click', () => {
    grabEnabled = !grabEnabled;
    nodes.grab.setAttribute('aria-pressed', String(grabEnabled));
    canvas.classList.toggle('is-grabbable', grabEnabled);
    viewportInteractions.setPanEnabled(grabEnabled);
  });
  on(nodes.zoomIn, 'click', () => zoom(zoomStep));
  on(nodes.zoomOut, 'click', () => zoom(1 / zoomStep));
  on(nodes.resetView, 'click', () => {
    viewportInteractions.resetView();
  });
  on(nodes.fullscreen, 'click', () => {
    void toggleFullscreen();
  });
  if (ownerDocument?.addEventListener) {
    on(ownerDocument, 'fullscreenchange', syncFullscreen);
  }
  nodes.playbackRate.value = String(app.playbackRate ?? 1);
  nodes.grab.setAttribute('aria-pressed', 'false');
  syncPause();
  syncFullscreen();

  const controls = {
    setPaused,
    sync() {
      syncPause();
      syncFullscreen();
      return controls;
    },
    captureView() {
      captureView();
      return controls;
    },
    dispose() {
      viewportInteractions.dispose();
      for (const [target, type, listener, options] of listeners) {
        target.removeEventListener(type, listener, options);
      }
      listeners.length = 0;
      canvas.classList.toggle('is-grabbable', false);
      canvas.classList.toggle('is-dragging', false);
    },
  };
  return controls;
}
