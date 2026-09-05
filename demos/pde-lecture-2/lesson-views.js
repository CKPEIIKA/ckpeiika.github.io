import {
  Arrow,
  Camera2D,
  CartesianGrid,
  Circle,
  CurveLayer,
  Line,
  SampledPlot,
  makeColorLut,
  ParticleCloud,
  Rectangle,
  ScalarField,
  Scene,
  TextLabel,
  chalkStyle,
} from '../../lib/chalkish/src/index.js';

const COLORS = Object.freeze({
  white: '#eeeada', cyan: '#72dce5', yellow: '#efd677', red: '#ed8e79',
});

const CHALK_FIELD_MAP = makeColorLut([
  [0, '#101813'],
  [0.18, '#1c3029'],
  [0.42, '#3d675f'],
  [0.66, '#78a39a'],
  [0.84, '#d2c36e'],
  [1, '#f0e5cf'],
]);
const CHALK_DIVERGING_MAP = makeColorLut([
  [0, '#527d99'],
  [0.28, '#82a8ad'],
  [0.5, '#18261f'],
  [0.72, '#d7a17f'],
  [1, '#b85f54'],
]);

function style(color, width = 1.2, options = {}) {
  return chalkStyle('dusty', {
    stroke: color, fill: null, width, passes: 2, roughness: 0.28, ...options,
  });
}

function maximumAbsolute(values) {
  let maximum = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (Number.isFinite(values[index])) maximum = Math.max(maximum, Math.abs(values[index]));
  }
  return maximum;
}

export function bindCurveLessonView(model) {
  const panelCount = model.panels.length;
  const centers = panelCount === 1 ? [0] : panelCount === 2 ? [1.9, -1.9] : [2.8, 0, -2.8];
  const halfHeight = panelCount === 1 ? 2.1 : panelCount === 2 ? 1.3 : 0.85;
  const scene = new Scene({ background: '#0d1611' });
  const camera = new Camera2D({ height: 9 });
  const plots = [];
  const pathPanel = model.id === 'characteristics' || model.id === 'nonlinearity';
  let previousTime = -1;
  let previousRevision = -1;
  const timeCoordinates = Float32Array.from(model.x, x => x + 1);
  const pathPositions = [];
  const bounds = { minX: -6.1, maxX: 5.35, minY: centers.at(-1) - halfHeight - 0.4, maxY: centers[0] + halfHeight + 0.6 };
  for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
    const panel = model.panels[panelIndex];
    const plot = new SampledPlot({ width: 10, height: 2 * halfHeight, y: centers[panelIndex], title: panel.label });
    for (const curve of panel.curves) {
      if (pathPanel && panelIndex === 1) {
        const positions = new Float32Array(model.x.length);
        pathPositions.push(positions);
        plot.addCurve(positions, timeCoordinates, { stroke: curve.color, opacity: 0.65 });
      } else plot.addCurve(model.x, curve.data, { stroke: curve.color, ...(curve.dash ? { dash: curve.dash, opacity: 0.55 } : {}) });
    }
    if (model.id === 'diffusion' && panelIndex === 0) plot.addCurve(model.x, model.initial, { stroke: COLORS.white, dash: [5, 4], opacity: 0.45 });
    plots.push(plot);
    scene.add(plot);
  }
  const marker = new Circle(0.065, { zIndex: 5, visible: false, style: style(COLORS.red, 1.3, { fill: COLORS.red }) });
  const originMarker = new Circle(0.065, { zIndex: 5, visible: false, style: style(COLORS.yellow, 1.3, { fill: COLORS.yellow }) });
  const timeLine = new Line(-5, 0, 5, 0, { visible: pathPanel, style: style(COLORS.white, 1, { dash: [4, 4] }) });
  const probeX = new Float32Array(41), probeY = new Float32Array(41);
  const originLine = new CurveLayer({ x: probeX, y: probeY, visible: false, style: style(COLORS.yellow, 1.4) });
  scene.add(marker, originMarker, timeLine, originLine);
  const waveLines = model.id === 'riemann' ? Array.from({ length: 5 }, () => {
    const line = new Line(0, -3.7, 0, 3.7, { visible: false, style: style(COLORS.yellow, 0.8, { opacity: 0.6, dash: [4, 4] }) });
    scene.add(line);
    return line;
  }) : [];

  function resetRanges() {
    plots.forEach((plot, i) => {
      let max = Math.max(0.1, ...model.panels[i].curves.map(curve => maximumAbsolute(curve.data)));
      if (model.id === 'wave' && i === 1) max = Math.max(max, Number(model.parameters.c) * Number(model.parameters.amplitude) / Number(model.parameters.width));
      if (model.id === 'riemann') max = model.plotBounds[i];
      if (model.preset === 'drawing') max = Math.max(max, 2);
      plot.setRanges([-1, 1], pathPanel && i === 1 ? [0, 2]
        : model.id === 'riemann' && i !== 1 ? [0, max * 1.15] : [-max * 1.15, max * 1.15]);
    });
  }

  function place(object, x, y, panel = 0) {
    const p = plots[panel].point(x, y);
    object.setVisible(x >= -1 && x <= 1).setPosition(p[0], centers[panel] + p[1]);
  }

  function update() {
    if (previousTime < 0 || model.time < previousTime || model.revision !== previousRevision) resetRanges();
    previousRevision = model.revision;
    previousTime = model.time;
    for (let path = 0; path < pathPositions.length; path++) {
      const origin = -0.8 + 1.6 * path / (pathPositions.length - 1);
      const value = model.initial[Math.round((origin + 1) / 2 * (model.initial.length - 1))];
      for (let i = 0; i < timeCoordinates.length; i++) {
        const t = timeCoordinates[i];
        const x = model.id === 'characteristics' ? model.characteristicPosition(origin, t)
          : origin + (model.parameters.law === 'linear' ? 0.6 : value) * t;
        pathPositions[path][i] = x;
      }
      const count = pathPositions[path].findIndex(x => Math.abs(x) > 1);
      plots[1].records[path].layer.setCount(count < 0 ? model.x.length : count);
    }
    plots.forEach(plot => plot.update());
    waveLines.forEach((line, i) => {
      const front = model.waveFronts[i];
      const x = front ? front.speed * model.time : 2;
      line.setVisible(model.time > 0 && Math.abs(x) <= 1);
      if (front) {
        const px = plots[0].point(x, 0)[0];
        line.setEndpoints(px, centers.at(-1) - halfHeight, px, centers[0] + halfHeight);
        line.setStyle({ stroke: front.kind === 'contact' ? COLORS.yellow : front.kind === 'shock' ? COLORS.red : COLORS.cyan });
      }
    });
    if (model.marker) place(marker, model.marker.x, model.marker.y);
    else marker.setVisible(false);
    if (pathPanel) {
      const t = Math.min(2, model.time);
      const p = plots[1].point(0, t);
      timeLine.setEndpoints(-plots[1].width / 2, centers[1] + p[1], plots[1].width / 2, centers[1] + p[1]);
    }
    if (model.probePoint) {
      const probe = model.probe(model.probePoint.x);
      place(marker, probe.x, probe.value);
      place(originMarker, probe.origin, probe.value);
      for (let i = 0; i < probeX.length; i++) {
        const t = Math.min(2, model.time) * i / (probeX.length - 1);
        const point = plots[1].point(model.characteristicPosition(probe.origin, t), t);
        probeX[i] = point[0]; probeY[i] = point[1] + centers[1];
      }
      originLine.setVisible(Math.abs(probe.origin) <= 1).markDataDirty();
    }
    return view;
  }

  const view = Object.freeze({
    scene,
    camera,
    bounds,
    plots,
    update,
    resetRanges,
    resize({ width, height }) {
      // Plot axes stretch independently; a physical 2-D domain keeps its aspect.
      const w = Math.max(3, (bounds.maxY - bounds.minY) * width / height - 1.6);
      for (const plot of plots) {
        plot.width = w;
        plot.title.setPosition(-w / 2, halfHeight + 0.3);
        plot.setRanges(plot.xRange, plot.yRange);
      }
      bounds.minX = -w / 2 - 1;
      bounds.maxX = w / 2 + 0.3;
      update();
    },
    profilePoint(worldXValue, worldYValue) {
      return {
        x: Math.max(-1, Math.min(1, worldXValue * 2 / plots[0].width)),
        value: plots[0].coordinates(worldXValue, worldYValue - centers[0])[1],
        inside: Math.abs(worldXValue) <= plots[0].width / 2 && Math.abs(worldYValue - centers[0]) <= halfHeight,
      };
    },
    dispose() { scene.clear(); },
  });
  update();
  return view;
}

function fieldRange(model) {
  if (model.id === 'laplace') return [-1, 1];
  if (model.id === 'vector-calculus') return [-30, 30];
  if (model.id === 'shallow-water' && model.parameters.display === 'height') return [0.5, 2];
  if (model.id === 'incompressibility' && model.parameters.display !== 'velocity') return [-1, 1];
  if (model.id === 'sources') return [-2, 2];
  return [0, 1.2];
}

function chalkifyField(source, target, minimum, maximum) {
  for (let index = 0; index < source.length; index += 1) {
    const value = source[index];
    if (!Number.isFinite(value)) {
      target[index] = Number.NaN;
      continue;
    }
    let hash = index + 0x6d2b79f5;
    hash = Math.imul(hash ^ (hash >>> 15), hash | 1);
    hash ^= hash + Math.imul(hash ^ (hash >>> 7), hash | 61);
    hash = (hash ^ (hash >>> 14)) >>> 0;
    // Multiplicative, weak, static grain: zero remains exactly zero.
    const grain = 1 - (hash & 255) / 255 * 0.025;
    target[index] = Math.max(minimum, Math.min(maximum, value * grain));
  }
}

export function bindFieldLessonView(model) {
  const scene = new Scene({ background: '#0d1611' });
  const camera = new Camera2D({ centerX: 0, centerY: 0, height: 1.48 });
  const range = fieldRange(model);
  const chalkData = new Float32Array(model.data.length);
  chalkifyField(model.data, chalkData, range[0], range[1]);
  const field = new ScalarField(chalkData, model.columns, model.rows, {
    minX: -1, maxX: 1, minY: -0.6, maxY: 0.6,
    min: range[0], max: range[1],
    lut: model.id === 'laplace' || model.id === 'vector-calculus' || model.id === 'incompressibility'
      ? CHALK_DIVERGING_MAP
      : CHALK_FIELD_MAP,
    interpolation: 'linear',
  });
  const frame = new Rectangle(2, 1.2, {
    zIndex: 3, style: style('#eeeada9c', 1),
  });
  const fieldGrid = new CartesianGrid({
    columns: 12, rows: 7, minX: -1, maxX: 1, minY: -0.6, maxY: 0.6, zIndex: 2,
    style: style('#d8dfd0', 0.7, { opacity: 0.1, passes: 1, roughness: 0.18 }),
  });
  scene.add(field, fieldGrid, frame);

  const arrows = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const arrow = new Arrow(0, 0, 0, 0, {
        zIndex: 4,
        headLength: 7,
        style: style(COLORS.yellow, 1.15),
      });
      arrows.push({ arrow, x: -0.84 + 1.68 * column / 8, y: -0.48 + 0.96 * row / 4 });
      scene.add(arrow);
    }
  }

  const particles = model.particlesX ? new ParticleCloud({
    x: model.particlesX,
    y: model.particlesY,
    count: model.particlesX.length,
    zIndex: 5,
    palette: [{ fill: '#eeeada', radius: 1.8, opacity: 0.72 }],
  }) : null;
  if (particles) scene.add(particles);

  const obstacle = new Circle(0.275, {
    zIndex: 5, visible: false,
    style: style(COLORS.white, 1.2, { fill: '#0d1611' }),
  });
  const obstacle2 = new Circle(0.185, {
    zIndex: 5, visible: false,
    style: style(COLORS.white, 1.2, { fill: '#0d1611' }),
  });
  const square = new Rectangle(0.5, 0.4, {
    zIndex: 5, visible: false,
    style: style(COLORS.white, 1.2, { fill: '#0d1611' }),
  });
  const source = new Circle(0.035, {
    zIndex: 6, visible: false,
    style: style(COLORS.red, 1.2, { fill: COLORS.red }),
  });
  scene.add(obstacle, obstacle2, square, source);
  const legendData = Float32Array.from({ length: 128 }, (_, i) => i / 127);
  const legend = new ScalarField(legendData, 128, 1, {
    minX: -0.65, maxX: 0.65, minY: -0.75, maxY: -0.71, min: 0, max: 1,
    lut: field.lut, interpolation: 'linear',
  });
  const legendLabels = [-1, 0, 1].map((_, i) => new TextLabel('', {
    x: -0.65 + 0.65 * i, y: -0.81, font: '13px "Schoolbell", cursive',
    style: chalkStyle('dusty', { fill: COLORS.white, stroke: null, passes: 2 }),
  }));
  const fieldName = new TextLabel('', { x: -1, y: 0.66, align: 'left', font: '14px "Schoolbell", cursive', style: chalkStyle('dusty', { fill: COLORS.white, stroke: null }) });
  scene.add(legend, ...legendLabels, fieldName);
  const constrictions = [new Rectangle(0.45, 0.3, { visible: false, zIndex: 5, style: style(COLORS.white, 1.2, { fill: '#0d1611' }) }), new Rectangle(0.45, 0.3, { visible: false, zIndex: 5, style: style(COLORS.white, 1.2, { fill: '#0d1611' }) })];
  scene.add(...constrictions);

  function update() {
    const [minimum, maximum] = fieldRange(model);
    chalkifyField(model.data, chalkData, minimum, maximum);
    field.markDataDirty();
    field.setRange(minimum, maximum);
    const diverging = ['laplace', 'vector-calculus', 'sources'].includes(model.id) || (model.id === 'incompressibility' && model.parameters.display !== 'velocity');
    field.lut = legend.lut = diverging ? CHALK_DIVERGING_MAP : CHALK_FIELD_MAP;
    legend.markDataDirty();
    [minimum, (minimum + maximum) / 2, maximum].forEach((v, i) => legendLabels[i].setText(String(Number(v.toPrecision(3)))));
    fieldName.setText(model.id === 'laplace' ? 'φ · −∇φ →' : model.id === 'vector-calculus' ? (model.parameters.display === 'curl' ? '∂v/∂x − ∂u/∂y' : '∂u/∂x + ∂v/∂y') : model.parameters.display === 'height' ? 'h · v →' : model.parameters.display === 'pressure' ? 'p/ρ' : model.parameters.display === 'divergence' ? '∇·v' : model.parameters.display === 'velocity' || model.parameters.display === 'speed' ? '|v| · v →' : 'u · v →');
    const vectorsVisible = model.parameters.showVectors !== false;
    for (const record of arrows) {
      const velocity = model.velocityAt?.(record.x, record.y) ?? [0, 0];
      const magnitude = Math.hypot(velocity[0], velocity[1]);
      const scale = magnitude > 0 ? Math.min(0.13 / magnitude, 0.22) : 0;
      record.arrow.setVisible(vectorsVisible && magnitude > 1e-5);
      record.arrow.setEndpoints(
        record.x, record.y,
        record.x + velocity[0] * scale,
        record.y + velocity[1] * scale,
      );
    }
    particles?.markDataDirty().setVisible(model.parameters.showParticles !== false);
    const geometry = model.parameters.geometry ?? (model.parameters.obstacle === 'circle' ? 'circle' : 'none');
    obstacle.setVisible(geometry === 'circle' || geometry === 'two-cylinders');
    obstacle2.setVisible(geometry === 'two-cylinders');
    square.setVisible(geometry === 'square');
    const obstacleX = Number(model.parameters.obstacleX ?? 0);
    const obstacleY = Number(model.parameters.obstacleY ?? 0);
    obstacle.setRadius(model.id === 'shallow-water' ? Math.sqrt(0.045) : geometry === 'two-cylinders' ? Math.sqrt(0.035) : Math.sqrt(0.075));
    constrictions.forEach((box, i) => box.setVisible(geometry === 'narrowing').setPosition(obstacleX + 0.125, obstacleY + (i === 0 ? -0.45 : 0.45)));
    if (geometry === 'two-cylinders') {
      obstacle.setPosition(obstacleX - 0.22, obstacleY + 0.16);
      obstacle2.setPosition(obstacleX + 0.22, obstacleY - 0.16);
    } else obstacle.setPosition(obstacleX, obstacleY);
    square.setPosition(obstacleX, obstacleY);
    source.setVisible(model.id === 'sources').setPosition(
      Number(model.parameters.sourceX ?? 0),
      Number(model.parameters.sourceY ?? 0),
    );
    return view;
  }

  const view = Object.freeze({
    scene,
    camera,
    bounds: { minX: -1.04, maxX: 1.04, minY: -0.87, maxY: 0.71 },
    update,
    fieldPoint(worldX, worldY) {
      return { x: worldX, y: worldY, inside: Math.abs(worldX) <= 1 && Math.abs(worldY) <= 0.6 };
    },
    dispose() { scene.clear(); },
  });
  update();
  return view;
}

export function bindBalanceLessonView(model) {
  const scene = new Scene({ background: '#0d1611' });
  const camera = new Camera2D({ centerX: 0, centerY: 0, height: 6 });
  const box = new Rectangle(3, 2.6, {
    style: style(COLORS.cyan, 1.6, { dash: [6, 4], fill: '#72dce512' }),
  });
  const inflow = new Arrow(-4.7, 0.7, -1.5, 0.7, { headLength: 9, style: style(COLORS.yellow, 2) });
  const outflow = new Arrow(1.5, -0.7, 4.7, -0.7, { headLength: 9, style: style(COLORS.red, 2) });
  const source = new Arrow(0, -2.5, 0, -1.3, { headLength: 9, style: style(COLORS.cyan, 2) });
  const stored = new TextLabel('', {
    x: 0, y: 0, font: '25px "Schoolbell", cursive',
    style: chalkStyle('dusty', { fill: COLORS.white, stroke: null, passes: 2 }),
  });
  const balance = new TextLabel('', {
    x: 0, y: 2.25, font: '17px "Schoolbell", cursive',
    style: chalkStyle('dusty', { fill: COLORS.yellow, stroke: null, passes: 2 }),
  });
  scene.add(box, inflow, outflow, source, stored, balance);

  function update() {
    const size = model.id === 'integral-conservation' ? Number(model.parameters.size) : 0.55;
    const width = 1.5 + 4 * size;
    box.setSize(width, 2.6).setPosition(Number(model.parameters.position), 0);
    inflow.setEndpoints(-4.7, 0.7, -width / 2 + Number(model.parameters.position), 0.7);
    outflow.setEndpoints(width / 2 + Number(model.parameters.position), -0.7, 4.7, -0.7);
    source.setVisible(Number(model.parameters.source) !== 0);
    source.setStyle({ stroke: Number(model.parameters.source) >= 0 ? COLORS.cyan : COLORS.red });
    stored.setText(`M = ${model.stored.toFixed(3)}`);
    balance.setText(model.stored === 0 && model.id === 'conservation' ? 'M = 0 · dM/dt = 0' : `dM/dt = ${model.fluxIn.toFixed(2)} − ${model.fluxOut.toFixed(2)} + ${(Number(model.parameters.source) * (model.id === 'integral-conservation' ? Number(model.parameters.size) : 1)).toFixed(2)} = ${model.rate.toFixed(2)}`);
    return view;
  }

  const view = Object.freeze({ scene, camera, bounds: { minX: -5, maxX: 5, minY: -2.8, maxY: 2.8 }, update, dispose() { scene.clear(); } });
  update();
  return view;
}

export function bindLessonView(model) {
  if (model.panels) return bindCurveLessonView(model);
  if (model.id === 'conservation' || model.id === 'integral-conservation') {
    return bindBalanceLessonView(model);
  }
  return bindFieldLessonView(model);
}
