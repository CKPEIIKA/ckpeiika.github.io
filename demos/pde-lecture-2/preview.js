import {
  Arrow,
  Camera2D,
  CartesianGrid,
  Circle,
  CurveLayer,
  Line,
  Rectangle,
  Scene,
  TextLabel,
  chalkStyle,
  mount,
} from '../../lib/chalkish/src/index.js';

const PALETTES = Object.freeze({
  board: Object.freeze({
    background: '#0d1611', primary: '#eeeada', cyan: '#72dce5',
    yellow: '#efd677', red: '#ed8e79', grid: '#d8dfd0', frame: '#e5ead584',
  }),
  paper: Object.freeze({
    background: '#d8dde3', primary: '#24282c', cyan: '#3f6268',
    yellow: '#7c6620', red: '#9f2d20', grid: '#7a8288', frame: '#9f2d20',
  }),
  'paper-dark': Object.freeze({
    background: '#181818', primary: '#f1d8c0', cyan: '#9bc7ca',
    yellow: '#efd677', red: '#ef8f7c', grid: '#a8aaa5', frame: '#f1d8c0',
  }),
});

function style(color, width = 1.6, options = {}) {
  return chalkStyle('dusty', {
    stroke: color, fill: null, width, passes: 2, roughness: 0.3, ...options,
  });
}

function curve(scene, fn, { y = 0, scale = 1, color, dash = null } = {}) {
  const count = 81;
  const x = new Float32Array(count);
  const values = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    x[index] = -4 + 8 * index / (count - 1);
    values[index] = y + scale * fn(x[index]);
  }
  scene.add(new CurveLayer({
    x,
    y: values,
    count,
    style: style(color, 1.5, dash ? { dash } : {}),
  }));
}

function arrow(scene, x1, y1, x2, y2, color) {
  scene.add(new Arrow(x1, y1, x2, y2, {
    headLength: 7,
    style: style(color, 1.25),
  }));
}

function baseScene(palette) {
  const scene = new Scene({ background: palette.background });
  scene.add(
    new CartesianGrid({
      columns: 8, rows: 5, minX: -4.5, maxX: 4.5, minY: -2.5, maxY: 2.5,
      zIndex: -2,
      style: style(palette.grid, 0.55, { opacity: 0.13, passes: 1, roughness: 0.1 }),
    }),
    new Rectangle(9, 5, { zIndex: -1, style: style(palette.frame, 1) }),
  );
  return scene;
}

function populate(scene, id, palette) {
  const WHITE = palette.primary;
  const CYAN = palette.cyan;
  const YELLOW = palette.yellow;
  const RED = palette.red;
  if (id === 'derivatives') {
    curve(scene, (x) => Math.exp(-x * x), { y: 1.45, scale: 0.65, color: CYAN });
    curve(scene, (x) => -2 * x * Math.exp(-x * x), { scale: 0.55, color: YELLOW });
    curve(scene, (x) => (4 * x * x - 2) * Math.exp(-x * x), { y: -1.45, scale: 0.35, color: RED });
    return;
  }
  if (id === 'pde-field' || id === 'classification') {
    curve(scene, (x) => Math.exp(-2 * (x + 1.7) ** 2), { y: 1.35, scale: 0.65, color: CYAN });
    curve(scene, (x) => Math.exp(-0.55 * x * x), { scale: 0.55, color: YELLOW });
    curve(scene, (x) => Math.cos(2 * x) * Math.exp(-0.3 * x * x), { y: -1.35, scale: 0.5, color: RED });
    return;
  }
  if (id === 'diffusion') {
    for (const [width, opacity] of [[2.2, 0.28], [1.2, 0.55], [0.55, 1]]) {
      curve(scene, (x) => Math.exp(-((x / width) ** 2)), {
        y: -1.25, scale: 2.2 / width * 0.45, color: CYAN,
        ...(opacity < 1 ? { dash: [5, 4] } : {}),
      });
    }
    return;
  }
  if (id === 'boundaries') {
    curve(scene, (x) => 0.22 * x + 0.15 * Math.sin(2 * x), { color: CYAN });
    scene.add(new Line(-4, -2, -4, 2, { style: style(RED, 3) }));
    scene.add(new Line(4, -2, 4, 2, { style: style(YELLOW, 3) }));
    arrow(scene, -3.8, 1.4, -3.1, 1.4, RED);
    arrow(scene, 3.8, -1.4, 3.1, -1.4, YELLOW);
    return;
  }
  if (id === 'wave') {
    curve(scene, (x) => Math.exp(-3 * (x + 1.6) ** 2) + Math.exp(-3 * (x - 1.6) ** 2), { color: CYAN });
    arrow(scene, -0.5, -1.5, -2.5, -1.5);
    arrow(scene, 0.5, -1.5, 2.5, -1.5);
    return;
  }
  if (id === 'characteristics' || id === 'nonlinearity') {
    for (let index = -4; index <= 4; index += 1) {
      const bend = id === 'nonlinearity' ? 0.1 * index * index : 0;
      scene.add(new Line(
        index * 0.75 - 1.2, -2,
        index * 0.75 + 1.2 - bend, 2,
        { style: style(index === 0 ? YELLOW : CYAN, 1.1) },
      ));
    }
    return;
  }
  if (id === 'advection-diffusion' || id === 'sources') {
    scene.add(new Circle(1.05, { x: id === 'sources' ? -1.3 : 0, style: style(CYAN, 1.5, { fill: '#72dce52c' }) }));
    if (id === 'sources') scene.add(new Circle(0.24, { x: -1.3, style: style(RED, 2, { fill: RED }) }));
    for (let y = -1.5; y <= 1.5; y += 0.75) arrow(scene, -3.7, y, 3.4, y);
    return;
  }
  if (id === 'vector-calculus' || id === 'incompressibility') {
    for (let row = -2; row <= 2; row += 1) {
      for (let column = -3; column <= 3; column += 1) {
        const x = column * 1.1;
        const y = row * 0.9;
        const length = Math.max(0.3, Math.hypot(x, y));
        arrow(scene, x, y, x - 0.45 * y / length, y + 0.45 * x / length, CYAN);
      }
    }
    return;
  }
  if (id === 'material-derivative') {
    curve(scene, (x) => Math.sin(1.5 * x), { color: CYAN, scale: 0.8 });
    scene.add(new Circle(0.16, { x: 0.8, y: 0.75, style: style(RED, 1.5, { fill: RED }) }));
    arrow(scene, 0.8, 1.35, 2.4, 1.35);
    return;
  }
  if (id === 'conservation' || id === 'integral-conservation') {
    const size = id === 'integral-conservation' ? 2.1 : 3.2;
    scene.add(new Rectangle(size, 2.5, { style: style(CYAN, 1.8, { dash: [5, 4] }) }));
    arrow(scene, -4, 0.7, -size * 0.5, 0.7);
    arrow(scene, size * 0.5, -0.7, 4, -0.7, RED);
    arrow(scene, 0, -1.8, 0, -0.4, YELLOW);
    return;
  }
  if (id === 'laplace') {
    for (let level = 0.5; level <= 2; level += 0.5) {
      curve(scene, (x) => level * Math.tanh(x / 2), { color: level === 1.5 ? YELLOW : CYAN, scale: 0.75 });
    }
    for (let x = -3; x <= 3; x += 1.5) arrow(scene, x, -1.7, x + 0.5, -1.2, RED);
    return;
  }
  if (id === 'riemann') {
    curve(scene, (x) => (x < -1 ? 1.2 : x < 1.5 ? 0.2 - 0.35 * x : -0.8), { color: CYAN });
    scene.add(new Line(-1.1, -2, -1.1, 2, { style: style(YELLOW, 1, { dash: [4, 4] }) }));
    scene.add(new Line(1.6, -2, 1.6, 2, { style: style(RED, 1, { dash: [4, 4] }) }));
    return;
  }
  if (id === 'shallow-water') {
    for (const radius of [0.55, 1.15, 1.8]) {
      scene.add(new Circle(radius, { style: style(radius === 1.15 ? YELLOW : CYAN, 1.4) }));
    }
    arrow(scene, 0, 0, 2.7, 0);
    return;
  }
  if (id === 'geometry') {
    scene.add(new Circle(0.8, { style: style(YELLOW, 2, { fill: '#0d1611' }) }));
    for (const y of [-1.4, -0.7, 0, 0.7, 1.4]) {
      curve(scene, (x) => y + (Math.abs(y) < 1 ? Math.sign(y || 1) * 0.65 * Math.exp(-x * x) : 0), { color: CYAN });
    }
    return;
  }
  curve(scene, (x) => Math.sin(x), { color: CYAN });
}

export function mountPdePreview(canvas, entry, { surface = 'board' } = {}) {
  const palette = PALETTES[surface];
  if (!palette) throw new RangeError(`unknown PDE preview surface: ${surface}`);
  const scene = baseScene(palette);
  populate(scene, entry.id, palette);
  scene.add(new TextLabel(entry.equation, {
    x: 0,
    y: 2.18,
    maxWidth: 8,
    zIndex: 4,
    font: '11px "Schoolbell", cursive',
    style: chalkStyle('dusty', {
      fill: palette.primary, stroke: null, passes: 2, roughness: 0.25,
    }),
  }));
  const app = mount(canvas, {
    scene,
    camera: new Camera2D({ centerX: 0, centerY: 0, height: 6 }),
    fixedStep: null,
    adaptiveQuality: false,
  });
  app.resize().render();
  return Object.freeze({
    resize() {
      canvas.style.removeProperty('width');
      canvas.style.removeProperty('height');
      app.resize().render();
    },
    dispose() { app.destroy(); scene.clear(); },
  });
}
