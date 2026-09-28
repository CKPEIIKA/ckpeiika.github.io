// The plot canvas under the collision stage, drawn with Chalkish. The chapter functions in
// app.js describe each frame with a few calls in CSS-pixel coordinates (x right, y down),
// mainly into three layers (a fourth, 'top', is cached above 'dynamic'): 'axes' and 'data' are cached Chalkish groups, each rebuilt only when
// its own content changes (a histogram growing during playback rebuilds 'data', not the
// axes); 'dynamic' (markers, a moving time line) is redrawn every frame.

import {
  CHALK_FONT_STACK, CHALK_NUMBER_FONT_STACK, Camera2D, Circle, Group, Polygon, Polyline,
  Rectangle, Scene, SegmentLayer, TextLabel, chalkStyle, mount,
} from '../../lib/chalkish/src/index.js';

const FAMILIES = { chalk: CHALK_FONT_STACK, number: CHALK_NUMBER_FONT_STACK };

// Chalk strokes: static lines in Chalkish's technical chalk (dense, for plot lines); dynamic ones and those marked
// light (a histogram redrawn every frame) in a cheaper rough stroke.
function strokeStyle({ color, width = 1, dash = null, alpha = 1, light = false }, dynamic) {
  return dynamic || light
    ? { stroke: color, fill: null, width, dash, opacity: alpha, roughness: 0.25, passes: 2 }
    : chalkStyle('technical', { stroke: color, fill: null, width, dash, opacity: alpha });
}

function build(command, dynamic) {
  switch (command.type) {
    case 'line':
      return command.points.length >= 4 ? new Polyline(Float32Array.from(command.points), { style: strokeStyle(command, dynamic) }) : null;
    case 'segments':
      return command.segments.length >= 4 ? new SegmentLayer({ segments: Float32Array.from(command.segments), style: strokeStyle(command, dynamic) }) : null;
    case 'fill-rect':
      return new Rectangle(Math.max(command.w, 1e-6), Math.max(command.h, 1e-6), {
        x: command.x + command.w / 2, y: command.y + command.h / 2,
        style: { fill: command.color, stroke: null, opacity: command.alpha },
      });
    case 'stroke-rect':
      return new Rectangle(Math.max(command.w, 1e-6), Math.max(command.h, 1e-6), {
        x: command.x + command.w / 2, y: command.y + command.h / 2, style: strokeStyle(command, dynamic),
      });
    case 'circle':
      return new Circle(command.r, {
        x: command.x, y: command.y,
        style: command.fill
          ? { fill: command.fill, stroke: command.color ?? null, width: command.width ?? 1, opacity: command.alpha ?? 1, roughness: 0.15, passes: 1 }
          : strokeStyle(command, dynamic),
      });
    case 'polygon':
      return new Polygon(Float32Array.from(command.points), { style: { fill: command.color, stroke: null, opacity: command.alpha } });
    case 'text':
      return new TextLabel(command.text, {
        x: command.x, y: command.y, size: command.size, align: command.align, baseline: 'alphabetic',
        font: `${command.italic ? 'italic ' : ''}16px ${FAMILIES[command.family]}`,
        style: { fill: command.color, passes: 1 },
      });
    case 'clip': {
      const group = new Group([], { clip: command.rect });
      for (const child of command.children) {
        const object = build(child, dynamic);
        if (object) group.add(object);
      }
      return group;
    }
    default:
      throw new Error(`Unknown plot command ${command.type}`);
  }
}

export class PlotBoard {
  // onResize: the panel changed size (the caller marks the plot for redrawing).
  constructor(canvas, { onResize = () => {} } = {}) {
    this.canvas = canvas;
    this.scene = new Scene({ background: '#0b100d' });
    this.camera = new Camera2D({ centerX: 0, centerY: 0, height: 1, flipY: false });
    this.layers = {
      axes: { group: new Group([], { cache: true, zIndex: 0 }), key: '', cached: true },
      data: { group: new Group([], { cache: true, zIndex: 1 }), key: '', cached: true },
      dynamic: { group: new Group([], { zIndex: 2 }), key: '', cached: false },
      top: { group: new Group([], { cache: true, zIndex: 3 }), key: '', cached: true },
    };
    this.scene.add(...Object.values(this.layers).map((layer) => layer.group));
    this.app = mount(canvas, { scene: this.scene, camera: this.camera, fixedStep: null, adaptiveQuality: false, dprMax: 2 });
    this.size = '';
    // Chalkish pins the canvas to an inline size, so watch the panel around it: on a resize,
    // unpin, so that the CSS size is measured again at the next frame.
    this.observer = new ResizeObserver(() => {
      canvas.style.removeProperty('width');
      canvas.style.removeProperty('height');
      this.size = '';
      onResize();
    });
    this.observer.observe(canvas.parentElement);
  }

  dispose() {
    this.observer.disconnect();
    this.app.destroy();
  }

  // Starts a frame; returns the CSS size of the canvas.
  begin(background) {
    this.scene.background = background;
    this.commands = { axes: [], data: [], dynamic: [], top: [] };
    this.target = this.commands.data;
    this.width = Math.max(1, this.canvas.clientWidth);
    this.height = Math.max(1, this.canvas.clientHeight);
    return { w: this.width, h: this.height };
  }

  // Draws fn into a layer: 'axes', 'data' (the default), 'dynamic' (changes every frame) or
  // 'top' (cached, above the dynamic layer: a reference curve over a growing histogram).
  layer(name, fn) {
    const previous = this.target;
    this.target = this.commands[name];
    try { fn(); } finally { this.target = previous; }
  }

  dynamic(fn) { this.layer('dynamic', fn); }

  // Everything drawn in fn is cut at the rectangle.
  clip(rect, fn) {
    const previous = this.target;
    const children = [];
    this.target = children;
    try { fn(); } finally { this.target = previous; }
    if (children.length) previous.push({ type: 'clip', rect, children });
  }

  line(points, { color, width = 1, dash = null, alpha = 1, light = false } = {}) {
    this.target.push({ type: 'line', points: Array.from(points), color, width, dash: dash?.length ? dash : null, alpha, light });
  }

  // Many separate strokes of one style as one layer: [x0, y0, x1, y1, …] per segment.
  segments(segments, { color, width = 1, alpha = 1, light = false } = {}) {
    this.target.push({ type: 'segments', segments: Array.from(segments), color, width, dash: null, alpha, light });
  }

  fillRect(x, y, w, h, color, alpha = 1) { this.target.push({ type: 'fill-rect', x, y, w, h, color, alpha }); }

  strokeRect(x, y, w, h, options) { this.target.push({ type: 'stroke-rect', x, y, w, h, ...options }); }

  circle(x, y, r, options) { this.target.push({ type: 'circle', x, y, r, ...options }); }

  polygon(points, color, alpha = 1) { this.target.push({ type: 'polygon', points: Array.from(points), color, alpha }); }

  text(x, y, text, { size = 10, color, align = 'left', family = 'chalk', italic = false } = {}) {
    this.target.push({ type: 'text', x, y, text: String(text), size, color, align, family, italic });
  }

  // Width of a text in CSS px, for placing legends.
  measure(text, { size = 10, family = 'chalk' } = {}) {
    const context = this.measureContext ??= document.createElement('canvas').getContext('2d');
    context.font = `${size}px ${FAMILIES[family]}`;
    return context.measureText(String(text)).width;
  }

  // Replaces the scene content (static only when it changed) and renders.
  end() {
    const size = `${this.width}x${this.height}`;
    if (size !== this.size) {
      // Chalkish pins the canvas to an inline size; clear it so the CSS size is measured.
      this.canvas.style.removeProperty('width');
      this.canvas.style.removeProperty('height');
      this.camera.setCenter(this.width / 2, this.height / 2);
      this.camera.setHeight(this.height);
      this.app.resize();
      this.size = size;
    }
    for (const [name, layer] of Object.entries(this.layers)) {
      const key = layer.cached ? JSON.stringify(this.commands[name]) : null;
      if (layer.cached && key === layer.key) continue;
      layer.group.clear();
      for (const command of this.commands[name]) {
        const object = build(command, !layer.cached);
        if (object) layer.group.add(object);
      }
      layer.key = key;
    }
    return this.app.render();
  }
}
