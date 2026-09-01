import {
  Camera2D,
  CartesianGrid,
  COLORMAPS,
  CurveLayer,
  Line,
  Rectangle,
  ScalarField,
  Scene,
  SegmentLayer,
  TextLabel,
  cellMaskBoundarySegments,
  chalkStyle,
} from '../../../src/index.js';
import { BOARD_RENDER_STYLE } from '../../board-settings.js';

function viewError(ErrorType, message) {
  return new ErrorType(`${message} No view state was changed.`);
}

function validate(snapshot) {
  if (!snapshot
      || snapshot.type !== 'dg-fv-lab-state'
      || snapshot.schemaVersion !== 1) {
    throw viewError(RangeError, 'DG/FV view expected dg-fv-lab-state version 1.');
  }
  const {
    columns,
    rows,
    cellsX,
    cellsY,
  } = snapshot.dimensions ?? {};
  if (!Number.isInteger(columns)
      || !Number.isInteger(rows)
      || columns < 1
      || rows < 1) {
    throw viewError(
      RangeError,
      `field dimensions are ${columns} × ${rows}; expected positive integers.`,
    );
  }
  if (!snapshot.state?.scalar
      || snapshot.state.scalar.length !== columns * rows) {
    throw viewError(
      RangeError,
      `scalar length is ${snapshot.state?.scalar?.length}; expected ${columns * rows}.`,
    );
  }
  if (!Number.isInteger(cellsX)
      || !Number.isInteger(cellsY)
      || cellsX < 1
      || cellsY < 1) {
    throw viewError(
      RangeError,
      `solver-cell dimensions are ${cellsX} × ${cellsY}; expected positive integers.`,
    );
  }
  const expectedMaskLength = snapshot.metadata?.caseId === 'euler-cylinder'
    ? cellsX * cellsY
    : 0;
  if (snapshot.state?.solidCellMask?.length !== expectedMaskLength) {
    throw viewError(
      RangeError,
      `solidCellMask length is ${snapshot.state?.solidCellMask?.length}; `
      + `expected ${expectedMaskLength}.`,
    );
  }
  for (const name of ['minX', 'maxX', 'minY', 'maxY']) {
    if (!Number.isFinite(snapshot.domain?.[name])) {
      throw viewError(TypeError, `${name} must be finite.`);
    }
  }
  return snapshot;
}

function styles(styleName) {
  return {
    curve: chalkStyle(styleName, {
      stroke: '#f3eedc',
      fill: null,
      width: 2.45,
      passes: styleName === 'clean' ? 1 : 3,
    }),
    frame: chalkStyle(styleName, {
      stroke: '#eee9d5',
      fill: null,
      width: 1.7,
      opacity: 0.76,
      passes: styleName === 'clean' ? 1 : 2,
    }),
    body: chalkStyle(styleName, {
      stroke: '#f1df98',
      fill: null,
      width: 2.1,
      opacity: 0.95,
      passes: styleName === 'clean' ? 1 : 3,
      grain: 0.18,
    }),
    grid: chalkStyle('clean', {
      stroke: '#d9dfce',
      fill: null,
      width: 0.72,
      opacity: 0.16,
      roughness: styleName === 'clean' ? 0.16 : 0.38,
      wobble: 0,
      grain: 0.24,
      passes: styleName === 'clean' ? 1 : 2,
    }),
    axis: chalkStyle('technical', {
      stroke: '#d9dfce62',
      fill: null,
      width: 1,
      passes: 1,
    }),
    reference: chalkStyle(styleName, {
      stroke: '#efd677',
      fill: null,
      width: 1.25,
      opacity: 0.9,
      dash: [5, 4],
      passes: styleName === 'clean' ? 1 : 2,
    }),
    mean: chalkStyle(styleName, {
      stroke: '#b8d6d2',
      fill: null,
      width: 1.3,
      opacity: 0.9,
      dash: [4, 3],
      passes: styleName === 'clean' ? 1 : 2,
    }),
  };
}

function equation(caseId) {
  if (caseId === 'euler-cylinder') {
    return '∂ₜU + ∂ₓF(U) + ∂ᵧG(U) = 0 · modal DG / FV limit';
  }
  if (caseId === 'burgers') {
    return 'uₜ + (u²/2)ₓ = 0 · periodic modal DG';
  }
  return 'uₜ + ∇·(a u) = 0 · periodic tensor DG';
}

function title(caseId) {
  const labels = {
    'euler-cylinder': 'Euler flow over an embedded body',
    'diamond-translation': 'Diamond translation',
    'scalar-advection': 'Scalar advection',
    burgers: 'Burgers shock and rarefaction',
  };
  return labels[caseId] ?? caseId;
}

function diagnosticText(snapshot, diagnostics) {
  if (snapshot.metadata.caseId === 'euler-cylinder') {
    return [
      `t ${diagnostics.time.toFixed(3)}`,
      `ρmin ${diagnostics.minimumDensity.toFixed(3)}`,
      `pmin ${diagnostics.minimumPressure.toFixed(3)}`,
      `Mmax ${diagnostics.maximumMach.toFixed(2)}`,
      `Cd ${diagnostics.dragCoefficient.toFixed(2)}`,
    ].join(' · ');
  }
  return [
    `t ${diagnostics.time.toFixed(3)}`,
    `mass ${diagnostics.mass.toFixed(6)}`,
    Number.isFinite(diagnostics.l2Error)
      ? `L2 ${diagnostics.l2Error.toExponential(2)}`
      : `modes ${diagnostics.modalEnergyFraction.toExponential(2)}`,
  ].join(' · ');
}

function boundarySegments(snapshot) {
  if (snapshot.state.solidCellMask.length === 0) return new Float32Array(0);
  return cellMaskBoundarySegments(
    snapshot.state.solidCellMask,
    snapshot.dimensions.cellsX,
    snapshot.dimensions.cellsY,
    snapshot.domain,
  );
}

function freestreamSegments(snapshot) {
  if (snapshot.metadata.caseId !== 'euler-cylinder') return new Float32Array(0);
  const segments = [];
  for (const y of [0.45, 1, 1.55]) {
    const x0 = 0.12;
    const x1 = 0.58;
    segments.push(x0, y, x1, y, x1, y, x1 - 0.09, y + 0.05, x1, y, x1 - 0.09, y - 0.05);
  }
  return Float32Array.from(segments);
}

function wedgeReferenceSegments(snapshot, diagnostics) {
  const parameters = snapshot.replay.parameters;
  const beta = diagnostics.wedgeShockAngleDegrees;
  if (snapshot.metadata.caseId !== 'euler-cylinder'
      || parameters.bodyShape !== 'wedge'
      || !Number.isFinite(beta)) {
    return new Float32Array(0);
  }
  const slope = Math.tan(beta * Math.PI / 180);
  const dx = Math.min(2.8, 0.96 / Math.max(1e-9, slope));
  return new Float32Array([
    1, 1, 1 + dx, 1 + slope * dx,
    1, 1, 1 + dx, 1 - slope * dx,
  ]);
}

export function bindDgFvLabView(
  model,
  { styleName = BOARD_RENDER_STYLE } = {},
) {
  if (!model || typeof model.snapshot !== 'function' || typeof model.diagnostics !== 'function') {
    throw new TypeError('model must provide snapshot() and diagnostics()');
  }
  const initial = validate(model.snapshot());
  const appearance = styles(styleName);
  const scene = new Scene({ background: '#0d1611' });
  const camera = new Camera2D({ centerX: 2, centerY: 1, height: 2.45 });
  const field = new ScalarField(
    initial.state.scalar,
    initial.dimensions.columns,
    initial.dimensions.rows,
    {
      minX: initial.domain.minX,
      maxX: initial.domain.maxX,
      minY: initial.domain.minY,
      maxY: initial.domain.maxY,
      lut: COLORMAPS.chalk,
      interpolation: 'nearest',
      copy: false,
      zIndex: -3,
      style: { opacity: 0.92 },
    },
  );
  const curve = new CurveLayer({
    x: initial.state.coordinatesX,
    y: initial.state.scalar,
    count: Math.min(
      initial.state.coordinatesX.length,
      initial.state.scalar.length,
    ),
    visible: false,
    zIndex: 1,
    style: appearance.curve,
  });
  const meanCurve = new CurveLayer({
    x: initial.state.coordinatesX,
    y: initial.state.meanScalar,
    count: Math.min(initial.state.coordinatesX.length, initial.state.meanScalar.length),
    visible: false,
    zIndex: 2,
    style: appearance.mean,
  });
  const grid = new CartesianGrid({
    columns: initial.dimensions.cellsX,
    rows: initial.dimensions.cellsY,
    minX: initial.domain.minX,
    maxX: initial.domain.maxX,
    minY: initial.domain.minY,
    maxY: initial.domain.maxY,
    zIndex: -2,
    style: appearance.grid,
  });
  const horizontalAxis = new Line(0, 0, 1, 0, {
    visible: false,
    zIndex: -1,
    style: appearance.axis,
  });
  const verticalAxis = new Line(0, -0.3, 0, 1.1, {
    visible: false,
    zIndex: -1,
    style: appearance.axis,
  });
  const frame = new Rectangle(4, 2, {
    x: 2,
    y: 1,
    zIndex: 2,
    style: appearance.frame,
  });
  const bodyBoundary = new SegmentLayer({
    segments: boundarySegments(initial),
    copy: false,
    visible: initial.metadata.caseId === 'euler-cylinder',
    zIndex: 3,
    style: appearance.body,
  });
  const freestream = new SegmentLayer({
    segments: freestreamSegments(initial),
    copy: false,
    visible: initial.metadata.caseId === 'euler-cylinder',
    zIndex: 3,
    style: appearance.reference,
  });
  const wedgeReference = new SegmentLayer({
    segments: wedgeReferenceSegments(initial, model.diagnostics()),
    copy: false,
    visible: false,
    zIndex: 3,
    style: appearance.reference,
  });
  const heading = new TextLabel(title(initial.metadata.caseId), {
    x: 2,
    y: 2.17,
    zIndex: 4,
    font: '18px "Schoolbell", cursive',
    style: chalkStyle('dusty', {
      stroke: null,
      fill: '#f3eedc',
      roughness: 0.4,
      passes: 2,
    }),
  });
  const formula = new TextLabel(equation(initial.metadata.caseId), {
    x: 2,
    y: 2.06,
    zIndex: 4,
    font: '12px "Schoolbell", cursive',
    style: chalkStyle('dusty', {
      stroke: null,
      fill: '#c5d0c3',
      roughness: 0.32,
      passes: 2,
    }),
  });
  const status = new TextLabel(
    diagnosticText(initial, model.diagnostics()),
    {
      x: 2,
      y: -0.12,
      zIndex: 4,
      font: '11px "Walter Turncoat", sans-serif',
      style: chalkStyle('dusty', {
        stroke: null,
        fill: '#d8dfd1',
        roughness: 0.3,
        passes: 2,
      }),
    },
  );
  scene.add(
    field,
    grid,
    horizontalAxis,
    verticalAxis,
    curve,
    meanCurve,
    frame,
    bodyBoundary,
    freestream,
    wedgeReference,
    heading,
    formula,
    status,
  );
  let boundaryMask = initial.state.solidCellMask;
  let boundaryKey = [
    initial.dimensions.cellsX,
    initial.dimensions.cellsY,
    initial.domain.minX,
    initial.domain.maxX,
    initial.domain.minY,
    initial.domain.maxY,
  ].join(':');
  let disposed = false;
  let activeCaseId = initial.metadata.caseId;

  function assertActive() {
    if (disposed) {
      throw new Error('DG/FV view is disposed. No view state was changed.');
    }
  }

  function configure(snapshot, diagnostics = model.diagnostics()) {
    const parameters = snapshot.replay.parameters;
    const caseId = snapshot.metadata.caseId;
    const isCurve = caseId === 'burgers';
    field.setVisible(!isCurve);
    curve.setVisible(isCurve);
    meanCurve.setVisible(
      isCurve
      && parameters.degree > 0
      && parameters.displayField === 'field',
    );
    horizontalAxis.setVisible(isCurve);
    verticalAxis.setVisible(isCurve);
    if (isCurve) {
      camera.setCenter(0.5, 0.42).setHeight(2.1);
      frame.setSize(1, 1.4).setPosition(0.5, 0.4);
      heading.setPosition(0.5, 1.36);
      formula.setPosition(0.5, 1.18);
      status.setPosition(0.5, -0.24);
    } else {
      const width = snapshot.domain.maxX - snapshot.domain.minX;
      const height = snapshot.domain.maxY - snapshot.domain.minY;
      const centerX = 0.5 * (snapshot.domain.minX + snapshot.domain.maxX);
      const centerY = 0.5 * (snapshot.domain.minY + snapshot.domain.maxY);
      camera.setCenter(centerX, centerY).setHeight(height * 1.5);
      frame.setSize(width, height).setPosition(centerX, centerY);
      heading.setPosition(centerX, snapshot.domain.maxY + 0.167 * height);
      formula.setPosition(centerX, snapshot.domain.maxY + 0.045 * height);
      status.setPosition(centerX, snapshot.domain.minY - 0.06 * height);
    }
    const showBody = caseId === 'euler-cylinder' && parameters.bodyShape !== 'none';
    bodyBoundary.setVisible(showBody && bodyBoundary.count > 0);
    freestream.setVisible(caseId === 'euler-cylinder');
    wedgeReference.setSegments(wedgeReferenceSegments(snapshot, diagnostics), { copy: false });
    wedgeReference.setVisible(wedgeReference.count > 0);
    field.setColorMap(
      parameters.displayField === 'vorticity'
        ? COLORMAPS.diverging
        : COLORMAPS.chalk,
    );
  }

  function updateView(snapshot, diagnostics = null) {
    assertActive();
    const next = validate(snapshot);
    field.columns = next.dimensions.columns;
    field.rows = next.dimensions.rows;
    field.domain = {
      minX: next.domain.minX,
      maxX: next.domain.maxX,
      minY: next.domain.minY,
      maxY: next.domain.maxY,
    };
    field.setData(next.state.scalar, { copy: false });
    grid.setGrid({
      columns: next.dimensions.cellsX,
      rows: next.dimensions.cellsY,
      minX: next.domain.minX,
      maxX: next.domain.maxX,
      minY: next.domain.minY,
      maxY: next.domain.maxY,
    });
    const nextBoundaryKey = [
      next.dimensions.cellsX,
      next.dimensions.cellsY,
      next.domain.minX,
      next.domain.maxX,
      next.domain.minY,
      next.domain.maxY,
    ].join(':');
    if (next.state.solidCellMask !== boundaryMask || nextBoundaryKey !== boundaryKey) {
      bodyBoundary.setSegments(boundarySegments(next), { copy: false });
      boundaryMask = next.state.solidCellMask;
      boundaryKey = nextBoundaryKey;
    }
    curve.setBuffers({
      x: next.state.coordinatesX,
      y: next.state.scalar,
      count: Math.min(next.state.coordinatesX.length, next.state.scalar.length),
    });
    meanCurve.setBuffers({
      x: next.state.coordinatesX,
      y: next.state.meanScalar,
      count: Math.min(next.state.coordinatesX.length, next.state.meanScalar.length),
    });
    if (next.metadata.caseId !== activeCaseId) {
      activeCaseId = next.metadata.caseId;
      heading.setText(title(activeCaseId));
      formula.setText(equation(activeCaseId));
    }
    status.setText(diagnosticText(next, diagnostics ?? model.diagnostics()));
    configure(next, diagnostics ?? model.diagnostics());
    return view;
  }

  function setStyle(name) {
    assertActive();
    const next = styles(name);
    curve.setStyle(next.curve);
    grid.setStyle(next.grid);
    frame.setStyle(next.frame);
    bodyBoundary.setStyle(next.body);
    horizontalAxis.setStyle(next.axis);
    verticalAxis.setStyle(next.axis);
    freestream.setStyle(next.reference);
    wedgeReference.setStyle(next.reference);
    meanCurve.setStyle(next.mean);
    return view;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.clear();
  }

  const layers = Object.freeze({
    field,
    grid,
    curve,
    meanCurve,
    frame,
    horizontalAxis,
    verticalAxis,
    bodyBoundary,
    freestream,
    wedgeReference,
    heading,
    formula,
    status,
  });
  const view = Object.freeze({
    scene,
    camera,
    layers,
    updateView,
    setStyle,
    dispose,
  });
  configure(initial);
  return view;
}
