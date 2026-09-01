import {
  Arrow,
  Camera2D,
  CartesianGrid,
  Circle,
  CurveLayer,
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
  [0.5, '#e9e6d6'],
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
  const centers = panelCount === 1 ? [0] : panelCount === 2 ? [1.55, -1.55] : [2.35, 0, -2.35];
  const halfHeight = panelCount === 1 ? 2.45 : panelCount === 2 ? 1.12 : 0.78;
  const cameraHeight = panelCount === 1 ? 6 : panelCount === 2 ? 7 : 7.4;
  const scene = new Scene({ background: '#0d1611' });
  const camera = new Camera2D({ centerX: 0, centerY: 0, height: cameraHeight });
  const worldX = new Float32Array(model.x.length);
  for (let index = 0; index < worldX.length; index += 1) worldX[index] = model.x[index] * 5;
  const curveRecords = [];
  const scales = new Float32Array(panelCount);
  const frame = style('#e8eadb8f', 1.1);
  const grid = style('#d8dfd0', 0.55, { opacity: 0.13, passes: 1, roughness: 0.12 });

  for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
    const panel = model.panels[panelIndex];
    const centerY = centers[panelIndex];
    scene.add(
      new Rectangle(10, 2 * halfHeight, { x: 0, y: centerY, zIndex: -1, style: frame }),
      new CartesianGrid({
        columns: 10, rows: panelCount === 1 ? 6 : 2,
        minX: -5, maxX: 5, minY: centerY - halfHeight, maxY: centerY + halfHeight,
        zIndex: -2, style: grid,
      }),
      new TextLabel(panel.label, {
        x: -4.85, y: centerY + halfHeight * 0.72, align: 'left', zIndex: 4,
        font: '14px "Schoolbell", cursive',
        style: chalkStyle('dusty', { fill: COLORS.yellow, stroke: null, passes: 2 }),
      }),
    );
    for (const curve of panel.curves) {
      const plotted = new Float32Array(model.x.length);
      const layer = new CurveLayer({
        x: worldX, y: plotted, count: plotted.length, zIndex: 2,
        style: style(curve.color ?? COLORS.cyan, 1.7, curve.dash ? { dash: curve.dash } : {}),
      });
      curveRecords.push({ source: curve.data, plotted, layer, panelIndex });
      scene.add(layer);
    }
  }

  const marker = new Circle(0.08, {
    zIndex: 5,
    visible: false,
    style: style(COLORS.red, 1.3, { fill: COLORS.red }),
  });
  scene.add(marker);

  function update() {
    for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
      let maximum = 0;
      for (const record of curveRecords) {
        if (record.panelIndex === panelIndex) maximum = Math.max(maximum, maximumAbsolute(record.source));
      }
      scales[panelIndex] = halfHeight * 0.8 / Math.max(0.25, maximum);
    }
    for (const record of curveRecords) {
      const centerY = centers[record.panelIndex];
      const scale = scales[record.panelIndex];
      for (let index = 0; index < record.plotted.length; index += 1) {
        const value = record.source[index];
        record.plotted[index] = Number.isFinite(value) ? centerY + value * scale : Number.NaN;
      }
      record.layer.markDataDirty();
    }
    if (model.marker) {
      const panel = model.marker.panel ?? 0;
      marker.setVisible(true).setPosition(
        model.marker.x * 5,
        centers[panel] + model.marker.y * scales[panel],
      );
    } else marker.setVisible(false);
    return view;
  }

  const view = Object.freeze({
    scene,
    camera,
    update,
    profilePoint(worldXValue, worldYValue) {
      return {
        x: Math.max(-1, Math.min(1, worldXValue / 5)),
        value: (worldYValue - centers[0]) / scales[0],
        inside: Math.abs(worldXValue) <= 5 && Math.abs(worldYValue - centers[0]) <= halfHeight,
      };
    },
    dispose() { scene.clear(); },
  });
  update();
  return view;
}

function fieldRange(model) {
  if (model.id === 'laplace' || model.id === 'vector-calculus') return [-1, 1];
  if (model.id === 'shallow-water' && model.parameters.display === 'height') return [0.7, 1.4];
  if (model.id === 'incompressibility' && model.parameters.display !== 'velocity') return [-1, 1];
  if (model.id === 'sources') return [-0.2, 1.2];
  return [0, 1.2];
}

function chalkifyField(source, target, minimum, maximum) {
  const tonalStep = (maximum - minimum) / 14;
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
    const grain = ((hash & 255) / 255 - 0.5) * tonalStep * 2.2;
    const quantized = minimum
      + Math.round((value + grain - minimum) / tonalStep) * tonalStep;
    target[index] = Math.max(minimum, Math.min(maximum, quantized));
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

  function update() {
    const [minimum, maximum] = fieldRange(model);
    chalkifyField(model.data, chalkData, minimum, maximum);
    field.markDataDirty();
    field.setRange(minimum, maximum);
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
    update,
    fieldPoint(worldX, worldY) {
      return { x: Math.max(-1, Math.min(1, worldX)), y: Math.max(-0.6, Math.min(0.6, worldY)) };
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
    x: 0, y: 0, maxWidth: 2.8, font: '25px "Schoolbell", cursive',
    style: chalkStyle('dusty', { fill: COLORS.white, stroke: null, passes: 2 }),
  });
  const balance = new TextLabel('', {
    x: 0, y: 2.25, maxWidth: 9.5, font: '17px "Schoolbell", cursive',
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
    balance.setText(model.observable);
    return view;
  }

  const view = Object.freeze({ scene, camera, update, dispose() { scene.clear(); } });
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
