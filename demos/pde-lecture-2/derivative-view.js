import {
  Camera2D,
  CartesianGrid,
  Circle,
  CurveLayer,
  Line,
  Rectangle,
  Scene,
  TextLabel,
  chalkStyle,
} from '../../lib/chalkish/src/index.js';

const PANEL_CENTERS = [2.65, 0, -2.65];
const PANEL_HALF_HEIGHT = 0.92;
const GRAPH_HALF_WIDTH = 5;

const COLORS = Object.freeze({
  value: '#6fdde6',
  first: '#efd677',
  second: '#ef8f7c',
});

function maximumAbsolute(values) {
  let maximum = 0;
  for (let index = 0; index < values.length; index += 1) {
    maximum = Math.max(maximum, Math.abs(values[index]));
  }
  return maximum;
}

export function bindDerivativeMicroscopeView(model) {
  if (!model || typeof model.probe !== 'function') {
    throw new TypeError('derivative view requires a derivative microscope model');
  }
  const scene = new Scene({ background: '#0d1611' });
  const camera = new Camera2D({ centerX: 0, centerY: 0, height: 8.25 });
  const x = new Float32Array(model.samples);
  const plotted = [
    new Float32Array(model.samples),
    new Float32Array(model.samples),
    new Float32Array(model.samples),
  ];
  for (let index = 0; index < model.samples; index += 1) {
    x[index] = model.x[index] * GRAPH_HALF_WIDTH;
  }

  const frameStyle = chalkStyle('dusty', {
    stroke: '#e8eadb8f', fill: null, width: 1.1, passes: 2, roughness: 0.28,
  });
  const gridStyle = chalkStyle('clean', {
    stroke: '#d8dfd0', fill: null, width: 0.65, opacity: 0.15,
    passes: 1, roughness: 0.18, grain: 0.2,
  });
  const zeroStyle = chalkStyle('dusty', {
    stroke: '#dce3d560', fill: null, width: 0.8, passes: 2,
  });
  const curves = [COLORS.value, COLORS.first, COLORS.second].map(
    (color, index) => new CurveLayer({
      x,
      y: plotted[index],
      count: model.samples,
      zIndex: 2,
      style: chalkStyle('dusty', {
        stroke: color, fill: null, width: 2, passes: 3, roughness: 0.32,
      }),
    }),
  );

  for (let panel = 0; panel < PANEL_CENTERS.length; panel += 1) {
    const centerY = PANEL_CENTERS[panel];
    scene.add(
      new Rectangle(GRAPH_HALF_WIDTH * 2, PANEL_HALF_HEIGHT * 2, {
        x: 0, y: centerY, zIndex: -1, style: frameStyle,
      }),
      new CartesianGrid({
        columns: 8,
        rows: 2,
        minX: -GRAPH_HALF_WIDTH,
        maxX: GRAPH_HALF_WIDTH,
        minY: centerY - PANEL_HALF_HEIGHT,
        maxY: centerY + PANEL_HALF_HEIGHT,
        zIndex: -2,
        style: gridStyle,
      }),
      new Line(-GRAPH_HALF_WIDTH, centerY, GRAPH_HALF_WIDTH, centerY, {
        zIndex: 0, style: zeroStyle,
      }),
      curves[panel],
    );
  }

  const labels = ['u', 'uₓ', 'uₓₓ'].map((text, index) => new TextLabel(text, {
    x: -5.48,
    y: PANEL_CENTERS[index],
    align: 'right',
    zIndex: 4,
    font: '18px "Schoolbell", cursive',
    style: chalkStyle('dusty', {
      fill: [COLORS.value, COLORS.first, COLORS.second][index],
      stroke: null,
      passes: 2,
      roughness: 0.25,
    }),
  }));
  const probeLine = new Line(0, -3.6, 0, 3.6, {
    zIndex: 3,
    style: chalkStyle('dusty', {
      stroke: '#f4f0df', fill: null, width: 1, dash: [4, 4], opacity: 0.7,
      passes: 2,
    }),
  });
  const markers = [COLORS.value, COLORS.first, COLORS.second].map(
    (color) => new Circle(0.07, {
      zIndex: 5,
      style: chalkStyle('dusty', {
        stroke: '#f5f2e9', fill: color, width: 1.2, passes: 2,
      }),
    }),
  );
  scene.add(...labels, probeLine, ...markers);

  let scales = [1, 1, 1];
  let probeX = model.parameters.position;

  function update() {
    const valueScale = model.parameters.preset === 'drawing'
      ? PANEL_HALF_HEIGHT / 2.5
      : PANEL_HALF_HEIGHT / Math.max(1, 1.08 * maximumAbsolute(model.value));
    scales = [
      valueScale,
      PANEL_HALF_HEIGHT / Math.max(1, 1.08 * maximumAbsolute(model.first)),
      PANEL_HALF_HEIGHT / Math.max(1, 1.08 * maximumAbsolute(model.second)),
    ];
    const sources = [model.value, model.first, model.second];
    for (let panel = 0; panel < plotted.length; panel += 1) {
      for (let index = 0; index < model.samples; index += 1) {
        plotted[panel][index] = PANEL_CENTERS[panel] + sources[panel][index] * scales[panel];
      }
      curves[panel].markDataDirty();
    }
    setProbe(probeX);
    return view;
  }

  function setProbe(xValue) {
    const values = model.probe(xValue);
    probeX = values.x;
    const worldX = values.x * GRAPH_HALF_WIDTH;
    probeLine.setEndpoints(worldX, -3.6, worldX, 3.6);
    [values.value, values.first, values.second].forEach((value, index) => {
      markers[index].setPosition(
        worldX,
        PANEL_CENTERS[index] + value * scales[index],
      );
    });
    return values;
  }

  function topPanelValue(worldY) {
    return (worldY - PANEL_CENTERS[0]) / scales[0];
  }

  const view = Object.freeze({
    scene,
    camera,
    layers: Object.freeze({ curves, labels, probeLine, markers }),
    update,
    setProbe,
    topPanelValue,
    isInsideTopPanel(worldX, worldY) {
      return Math.abs(worldX) <= GRAPH_HALF_WIDTH
        && Math.abs(worldY - PANEL_CENTERS[0]) <= PANEL_HALF_HEIGHT;
    },
    worldToProfileX(worldX) {
      return Math.max(-1, Math.min(1, worldX / GRAPH_HALF_WIDTH));
    },
    dispose() {
      scene.clear();
    },
  });
  update();
  return view;
}
