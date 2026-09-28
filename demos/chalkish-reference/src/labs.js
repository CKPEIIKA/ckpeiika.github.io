// The gallery's live-model contract (demos/README.md) around a reference pane: a canvas
// with a Chalkish app, played time, control changes in place, clicks and dragging.

import { bindPointerDrag, mount, screenToWorld } from '../../../lib/chalkish/src/index.js';
import { BOARD, PANES } from './panes.js';

// Mounts a pane's scene on a new canvas in `host`; the board keeps its 16 × 9 view.
export function mountPane(host, pane, { label = '', className = 'live-canvas' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-label', label);
  host.append(canvas);
  const app = mount(canvas, { scene: pane.scene, camera: pane.camera, fitBounds: BOARD, fixedStep: null, adaptiveQuality: false });
  // Chalkish pins the canvas size inline; the CSS size (100% of the host) must win on resize.
  const observer = new ResizeObserver(() => {
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    app.resize().render();
  });
  observer.observe(host);
  document.fonts?.ready.then(() => app.render());
  return {
    canvas, app,
    dispose() { observer.disconnect(); app.destroy(); canvas.remove(); },
  };
}

export function createLab(id, params, lang = 'ru') {
  const build = PANES[id];
  if (!build) throw new RangeError(`Unknown experiment: ${id}`);
  const pane = build(params, lang);
  let surface = null, drag = null;
  const listeners = [];

  const lab = {
    count: 0,
    time: 0,
    stop: '',
    mount(stage, { redraw }) {
      surface = mountPane(stage, pane, { label: lang === 'en' ? 'Chalkish board' : 'Доска Chalkish' });
      const { canvas } = surface;
      if (pane.pick) {
        drag = bindPointerDrag({
          target: canvas,
          getCamera: () => pane.camera,
          pick: (x, y, tolerance) => pane.pick(x, y, tolerance),
          onDrag: (object, x, y) => { pane.drag(object, x, y); redraw(); },
        });
        canvas.style.touchAction = 'none';
      }
      if (pane.click) {
        const onClick = (event) => {
          const r = canvas.getBoundingClientRect();
          const [x, y] = screenToWorld(pane.camera, event.clientX - r.left, event.clientY - r.top, r.width, r.height);
          if (pane.click(x, y)) redraw();
        };
        canvas.addEventListener('click', onClick);
        listeners.push(['click', onClick]);
      }
      surface.app.render();
    },
    advance(seconds) {
      if (!pane.update || this.stop) return;
      this.time += seconds;
      this.count += 1;
      if (pane.update(seconds)) this.stop = '■';
    },
    // Dynamic experiments also step (the Step button): one 24th of a second.
    step() { this.advance(1 / 24); },
    setParameter(key, value, next) {
      Object.assign(params, next);
      return pane.setParameter?.(key, value) === true;
    },
    render() {
      surface?.app.render();
      return { stats: pane.stats(), caption: pane.caption };
    },
    dispose() {
      drag?.dispose();
      for (const [type, listener] of listeners) surface?.canvas.removeEventListener(type, listener);
      surface?.dispose();
      surface = null;
    },
  };
  return lab;
}

export default { createLab };
