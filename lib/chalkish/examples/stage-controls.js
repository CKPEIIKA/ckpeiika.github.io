import { Camera2D } from '../src/core.js';
import {
  bindViewportInteractions,
  panCameraByPixels,
  zoomCameraAt,
} from '../src/interaction.js';
import { markChalkTransition } from './chalk-transition.js';

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
    'stage.showControls': 'Show toolbar',
    'stage.hideControls': 'Hide toolbar',
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

function addChalkEcho(svg) {
  if (svg.dataset.chalkEcho === 'true') return;
  const documentValue = svg.ownerDocument;
  if (!documentValue?.createElementNS) return;
  const echo = documentValue.createElementNS('http://www.w3.org/2000/svg', 'g');
  echo.setAttribute('class', 'chalk-icon-echo');
  for (const child of [...svg.children]) echo.append(child.cloneNode(true));
  svg.prepend(echo);
  svg.dataset.chalkEcho = 'true';
}

const CONTROL_ERASE_DELAY_MS = 1250;

export function bindStageControls({
  root,
  canvas,
  app,
  getCamera = () => app.camera,
  zoomStep = 0.8,
  translate = defaultTranslate,
  schedule = globalThis.setTimeout?.bind(globalThis),
  cancelScheduled = globalThis.clearTimeout?.bind(globalThis),
  controlEraseDelay = CONTROL_ERASE_DELAY_MS,
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
  if (typeof schedule !== 'function' || typeof cancelScheduled !== 'function') {
    throw new TypeError('stage controls require timer functions');
  }
  if (!Number.isFinite(controlEraseDelay) || controlEraseDelay < 0) {
    throw new RangeError('controlEraseDelay must be a non-negative finite number');
  }
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
    toggleControls: root.querySelector('[data-action="toggle-controls"]'),
    controlSet: root.querySelector('[data-stage-control-set]'),
    fullscreen: required(root, '[data-action="fullscreen"]'),
    playbackRate: required(root, '[data-playback-rate]'),
  });
  if (typeof root.querySelectorAll === 'function') {
    for (const icon of root.querySelectorAll('[data-stage-icon]')) addChalkEcho(icon);
  }
  const ownerDocument = root.ownerDocument
    ?? canvas.ownerDocument
    ?? globalThis.document
    ?? null;
  const fullscreenTarget = canvas.closest?.('[data-stage-viewport]') ?? canvas;
  const listeners = [];
  let grabEnabled = false;
  let controlsHideTimer = null;

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

  function resizeFullscreen() {
    app.resize?.();
    app.render();
  }

  function syncFullscreenLayout() {
    syncFullscreen();
    resizeFullscreen();
    globalThis.requestAnimationFrame?.(resizeFullscreen);
  }

  function syncControlsVisibility() {
    if (!nodes.toggleControls) return;
    const hidden = root.classList.contains('stage-controls-hidden');
    const label = translate(hidden ? 'stage.showControls' : 'stage.hideControls');
    nodes.toggleControls.setAttribute('aria-pressed', String(hidden));
    nodes.toggleControls.setAttribute('aria-label', label);
    nodes.toggleControls.setAttribute('title', label);
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
      syncFullscreenLayout();
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
  if (nodes.toggleControls) {
    on(nodes.toggleControls, 'click', () => {
      const hidden = root.classList.contains('stage-controls-hidden');
      if (controlsHideTimer !== null) {
        cancelScheduled(controlsHideTimer);
        controlsHideTimer = null;
      }
      if (hidden) {
        root.classList.remove('stage-controls-hidden');
        if (nodes.controlSet) markChalkTransition(nodes.controlSet, 'write');
        syncControlsVisibility();
        app.render();
        return;
      }
      if (nodes.controlSet) markChalkTransition(nodes.controlSet, 'erase');
      const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ?? false;
      const collapse = () => {
        controlsHideTimer = null;
        root.classList.toggle('stage-controls-hidden', true);
        syncControlsVisibility();
        app.render();
      };
      if (reducedMotion) collapse();
      else controlsHideTimer = schedule(collapse, controlEraseDelay);
    });
  }
  on(nodes.fullscreen, 'click', () => {
    void toggleFullscreen();
  });
  if (ownerDocument?.addEventListener) {
    on(ownerDocument, 'fullscreenchange', syncFullscreenLayout);
  }
  nodes.playbackRate.value = String(app.playbackRate ?? 1);
  nodes.grab.setAttribute('aria-pressed', 'false');
  syncPause();
  syncControlsVisibility();
  syncFullscreen();

  const controls = {
    setPaused,
    sync() {
      syncPause();
      syncControlsVisibility();
      syncFullscreen();
      return controls;
    },
    captureView() {
      captureView();
      return controls;
    },
    dispose() {
      if (controlsHideTimer !== null) cancelScheduled(controlsHideTimer);
      controlsHideTimer = null;
      viewportInteractions.dispose();
      for (const [target, type, listener, options] of listeners) {
        target.removeEventListener(type, listener, options);
      }
      listeners.length = 0;
      canvas.classList.toggle('is-grabbable', false);
      canvas.classList.toggle('is-dragging', false);
      root.classList?.remove?.('stage-controls-hidden');
    },
  };
  return controls;
}
