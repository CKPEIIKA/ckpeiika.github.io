import {
  Camera2D,
  CartesianGrid,
  COLORMAPS,
  CurveLayer,
  Line,
  ParticleCloud,
  Rectangle,
  ScalarField,
  Scene,
  SegmentLayer,
  TextLabel,
  chalkStyle,
} from '../../../src/index.js';
import { BOARD_RENDER_STYLE } from '../../board-settings.js';

function viewError(ErrorType, message) {
  return new ErrorType(`${message} No view state was changed.`);
}

function validate(snapshot) {
  if (!snapshot
      || snapshot.type !== 'dsmc-lab-state'
      || snapshot.schemaVersion !== 1) {
    throw viewError(RangeError, 'DSMC view expected dsmc-lab-state version 1.');
  }
  const {
    particles, columns, rows, histogramBins,
  } = snapshot.dimensions ?? {};
  if (!Number.isInteger(particles) || particles < 64) {
    throw viewError(
      RangeError,
      `particle count is ${particles}; expected an integer >= 64.`,
    );
  }
  if (!Number.isInteger(columns)
      || !Number.isInteger(rows)
      || columns < 1
      || rows < 1) {
    throw viewError(
      RangeError,
      `cell dimensions are ${columns} × ${rows}; expected positive integers.`,
    );
  }
  for (const name of ['positionsX', 'positionsY', 'styleIndex']) {
    if (!snapshot.state?.[name] || snapshot.state[name].length !== particles) {
      throw viewError(
        RangeError,
        `${name} length is ${snapshot.state?.[name]?.length}; expected ${particles}.`,
      );
    }
  }
  if (snapshot.state?.occupancy?.length !== columns * rows) {
    throw viewError(
      RangeError,
      `occupancy length is ${snapshot.state?.occupancy?.length}; expected ${columns * rows}.`,
    );
  }
  for (const name of ['speedBins', 'speedHistogram', 'maxwellian']) {
    if (snapshot.state?.[name]?.length !== histogramBins) {
      throw viewError(
        RangeError,
        `${name} length is ${snapshot.state?.[name]?.length}; expected ${histogramBins}.`,
      );
    }
  }
  return snapshot;
}

function styles(styleName) {
  return {
    frame: chalkStyle(styleName, {
      stroke: '#eee9d5',
      fill: null,
      width: 1.7,
      opacity: 0.76,
      passes: styleName === 'clean' ? 1 : 2,
    }),
    wallCold: chalkStyle(styleName, {
      stroke: '#b8d6d2',
      fill: null,
      width: 3,
      passes: styleName === 'clean' ? 1 : 3,
    }),
    wallHot: chalkStyle(styleName, {
      stroke: '#f0d07d',
      fill: null,
      width: 3,
      passes: styleName === 'clean' ? 1 : 3,
    }),
    histogram: chalkStyle(styleName, {
      stroke: '#f1ecda',
      fill: null,
      width: 2.1,
      passes: styleName === 'clean' ? 1 : 3,
    }),
    reference: chalkStyle(styleName, {
      stroke: '#efd677',
      fill: null,
      width: 1.2,
      dash: [6, 5],
      opacity: 0.8,
      passes: styleName === 'clean' ? 1 : 2,
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
    collision: chalkStyle(styleName, {
      stroke: '#f47c70',
      fill: null,
      width: 1.1,
      opacity: 0.66,
      passes: styleName === 'clean' ? 1 : 2,
    }),
    rotation: chalkStyle(styleName, {
      stroke: '#bb9cff',
      fill: null,
      width: 1.5,
      opacity: 0.9,
      passes: styleName === 'clean' ? 1 : 3,
    }),
  };
}

function speciesColors(name) {
  if (name === 'N2') return { fill: '#f3a25e', stroke: '#ffd0a3' };
  return { fill: '#4fd9e8', stroke: '#b8f4f2' };
}

function particlePalettes(styleName, speciesA = 'Ar', speciesB = 'N2') {
  const clean = styleName === 'clean';
  const first = speciesColors(speciesA);
  const second = speciesColors(speciesB);
  return {
    primary: [
      {
        fill: first.fill,
        stroke: first.stroke,
        radius: clean ? 0.9 : 1.15,
        opacity: clean ? 0.9 : 0.76,
        width: clean ? 0.35 : 0.6,
      },
      { fill: '#efd47d00', stroke: null, radius: 1, opacity: 0 },
    ],
    secondary: [
      { fill: '#efd47d00', stroke: null, radius: 1, opacity: 0 },
      {
        fill: second.fill,
        stroke: second.stroke,
        radius: clean ? 0.85 : 1.05,
        opacity: clean ? 0.9 : 0.76,
        width: 0.55,
      },
    ],
  };
}

function title(caseId) {
  const labels = {
    'equilibrium-box': 'Equilibrium box',
    'heat-transfer-x': 'Rarefied heat transfer',
    'rotational-nitrogen': 'N₂ rotational relaxation',
    'couette-flow': 'Rarefied Couette flow',
  };
  return labels[caseId] ?? caseId;
}

function formula(caseId) {
  if (caseId === 'rotational-nitrogen') {
    return 'NTC collisions · VSS scattering · rotational Larsen–Borgnakke';
  }
  if (caseId === 'heat-transfer-x') {
    return 'NTC collisions · diffuse thermal x-walls · periodic y';
  }
  if (caseId === 'couette-flow') {
    return 'NTC collisions · periodic x · moving diffuse y-walls';
  }
  return 'NTC collisions · periodic box · elastic VHS';
}

function diagnosticText(snapshot, diagnostics) {
  return [
    `t ${(1e3 * diagnostics.time).toFixed(2)} ms`,
    `T ${diagnostics.temperature.toFixed(0)} K`,
    `col ${diagnostics.collisions}`,
    `dx/λ ${diagnostics.dxOverMeanFreePath.toFixed(2)}`,
    `npc ${diagnostics.particlesPerCell.toFixed(1)}`,
  ].join(' · ');
}

export function bindDsmcLabView(
  model,
  { styleName = BOARD_RENDER_STYLE } = {},
) {
  if (!model || typeof model.snapshot !== 'function' || typeof model.diagnostics !== 'function') {
    throw new TypeError('model must provide snapshot() and diagnostics()');
  }
  const initial = validate(model.snapshot());
  const appearance = styles(styleName);
  const initialParticles = particlePalettes(
    styleName,
    initial.replay.parameters.speciesA,
    initial.replay.parameters.speciesB,
  );
  const scene = new Scene({ background: '#0d1611' });
  const camera = new Camera2D({ centerX: 5, centerY: 3, height: 9 });
  const occupancy = new ScalarField(
    initial.state.occupancy,
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
      style: { opacity: 0.22 },
    },
  );
  const grid = new CartesianGrid({
    columns: initial.dimensions.columns,
    rows: initial.dimensions.rows,
    minX: initial.domain.minX,
    maxX: initial.domain.maxX,
    minY: initial.domain.minY,
    maxY: initial.domain.maxY,
    zIndex: -2,
    style: appearance.grid,
  });
  const particles = new ParticleCloud({
    x: initial.state.positionsX,
    y: initial.state.positionsY,
    styleIndex: initial.state.styleIndex,
    count: initial.dimensions.particles,
    palette: initialParticles.primary,
    zIndex: 0,
  });
  const speciesBMarks = new ParticleCloud({
    x: initial.state.positionsX,
    y: initial.state.positionsY,
    styleIndex: initial.state.styleIndex,
    count: initial.dimensions.particles,
    palette: initialParticles.secondary,
    shape: 'pixel',
    zIndex: 1,
  });
  const collisionEvents = new SegmentLayer({
    segments: initial.state.collisionSegments,
    count: initial.dimensions.collisionEvents,
    copy: false,
    zIndex: 2,
    style: appearance.collision,
  });
  const rotationalEvents = new SegmentLayer({
    segments: initial.state.rotationalSegments,
    count: initial.dimensions.rotationalEvents,
    copy: false,
    zIndex: 3,
    style: appearance.rotation,
  });
  const frame = new Rectangle(10, 6, {
    x: 5,
    y: 3,
    zIndex: 2,
    style: appearance.frame,
  });
  const leftWall = new Line(0, 0, 0, 6, {
    visible: false,
    zIndex: 3,
    style: appearance.wallCold,
  });
  const rightWall = new Line(10, 0, 10, 6, {
    visible: false,
    zIndex: 3,
    style: appearance.wallHot,
  });
  const bottomWall = new Line(0, 0, 10, 0, {
    visible: false,
    zIndex: 3,
    style: appearance.wallCold,
  });
  const topWall = new Line(0, 6, 10, 6, {
    visible: false,
    zIndex: 3,
    style: appearance.wallHot,
  });
  const distributionFrame = new Rectangle(3.35, 1.55, {
    x: 8.05,
    y: 1.05,
    zIndex: 2,
    style: chalkStyle(styleName, {
      stroke: '#d9dfce75',
      fill: '#0d1611cc',
      width: 1,
      passes: styleName === 'clean' ? 1 : 2,
    }),
  });
  const distribution = new CurveLayer({
    x: initial.state.speedBins,
    y: initial.state.speedHistogram,
    count: initial.dimensions.histogramBins,
    zIndex: 4,
    style: appearance.histogram,
  });
  const maxwellian = new CurveLayer({
    x: initial.state.speedBins,
    y: initial.state.maxwellian,
    count: initial.dimensions.histogramBins,
    zIndex: 3,
    style: appearance.reference,
  });
  const distributionLabel = new TextLabel('speed sample —   Maxwellian ╌', {
    x: 8.05,
    y: 1.66,
    zIndex: 5,
    font: '10px "Schoolbell", cursive',
    style: chalkStyle('dusty', {
      stroke: null,
      fill: '#d4dccf',
      roughness: 0.3,
      passes: 2,
    }),
  });
  const heading = new TextLabel(title(initial.metadata.caseId), {
    x: 5,
    y: 7,
    zIndex: 5,
    font: '18px "Schoolbell", cursive',
    style: chalkStyle('dusty', {
      stroke: null,
      fill: '#f3eedc',
      roughness: 0.4,
      passes: 2,
    }),
  });
  const method = new TextLabel(formula(initial.metadata.caseId), {
    x: 5,
    y: 6.27,
    zIndex: 5,
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
      x: 5,
      y: -0.35,
      zIndex: 5,
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
    occupancy,
    grid,
    particles,
    speciesBMarks,
    collisionEvents,
    rotationalEvents,
    frame,
    leftWall,
    rightWall,
    bottomWall,
    topWall,
    distributionFrame,
    maxwellian,
    distribution,
    distributionLabel,
    heading,
    method,
    status,
  );
  let disposed = false;
  let activeStyleName = styleName;
  let activeCaseId = initial.metadata.caseId;
  let particlePaletteKey = [
    styleName,
    initial.replay.parameters.speciesA,
    initial.replay.parameters.speciesB,
  ].join(':');

  function assertActive() {
    if (disposed) {
      throw new Error('DSMC view is disposed. No view state was changed.');
    }
  }

  function configure(snapshot) {
    const parameters = snapshot.replay.parameters;
    const nextPaletteKey = [activeStyleName, parameters.speciesA, parameters.speciesB].join(':');
    if (nextPaletteKey !== particlePaletteKey) {
      const palettes = particlePalettes(
        activeStyleName,
        parameters.speciesA,
        parameters.speciesB,
      );
      particles.setPalette(palettes.primary);
      speciesBMarks.setPalette(palettes.secondary);
      particlePaletteKey = nextPaletteKey;
    }
    const xWalls = parameters.xBoundary !== 'periodic';
    const yWalls = parameters.yBoundary !== 'periodic';
    leftWall.setVisible(xWalls);
    rightWall.setVisible(xWalls);
    bottomWall.setVisible(yWalls);
    topWall.setVisible(yWalls);
    const maximum = Math.max(
      1e-12,
      ...snapshot.state.speedHistogram,
      ...snapshot.state.maxwellian,
    );
    const scaleX = 3.05 / Math.max(1, snapshot.state.speedBins.at(-1));
    const scaleY = 1.1 / maximum;
    distribution.setScale(scaleX, scaleY).setPosition(6.52, 0.43);
    maxwellian.setScale(scaleX, scaleY).setPosition(6.52, 0.43);
  }

  function updateView(snapshot, diagnostics = null) {
    assertActive();
    const next = validate(snapshot);
    occupancy.columns = next.dimensions.columns;
    occupancy.rows = next.dimensions.rows;
    occupancy.domain = {
      minX: next.domain.minX,
      maxX: next.domain.maxX,
      minY: next.domain.minY,
      maxY: next.domain.maxY,
    };
    occupancy.setData(next.state.occupancy, { copy: false });
    grid.setGrid({
      columns: next.dimensions.columns,
      rows: next.dimensions.rows,
      minX: next.domain.minX,
      maxX: next.domain.maxX,
      minY: next.domain.minY,
      maxY: next.domain.maxY,
    });
    particles
      .setBuffers({
        x: next.state.positionsX,
        y: next.state.positionsY,
        styleIndex: next.state.styleIndex,
      })
      .setCount(next.dimensions.particles);
    speciesBMarks
      .setBuffers({
        x: next.state.positionsX,
        y: next.state.positionsY,
        styleIndex: next.state.styleIndex,
      })
      .setCount(next.dimensions.particles)
      .setVisible(next.replay.parameters.speciesA !== next.replay.parameters.speciesB);
    collisionEvents
      .setSegments(next.state.collisionSegments, {
        count: next.dimensions.collisionEvents,
        copy: false,
      });
    rotationalEvents
      .setSegments(next.state.rotationalSegments, {
        count: next.dimensions.rotationalEvents,
        copy: false,
      });
    distribution.setBuffers({
      x: next.state.speedBins,
      y: next.state.speedHistogram,
      count: next.dimensions.histogramBins,
    });
    maxwellian.setBuffers({
      x: next.state.speedBins,
      y: next.state.maxwellian,
      count: next.dimensions.histogramBins,
    });
    if (next.metadata.caseId !== activeCaseId) {
      activeCaseId = next.metadata.caseId;
      heading.setText(title(activeCaseId));
      method.setText(formula(activeCaseId));
    }
    status.setText(diagnosticText(next, diagnostics ?? model.diagnostics()));
    configure(next);
    return view;
  }

  function setStyle(name) {
    assertActive();
    const next = styles(name);
    grid.setStyle(next.grid);
    frame.setStyle(next.frame);
    leftWall.setStyle(next.wallCold);
    rightWall.setStyle(next.wallHot);
    bottomWall.setStyle(next.wallCold);
    topWall.setStyle(next.wallHot);
    distribution.setStyle(next.histogram);
    maxwellian.setStyle(next.reference);
    collisionEvents.setStyle(next.collision);
    rotationalEvents.setStyle(next.rotation);
    activeStyleName = name;
    const parameters = model.parameters;
    const particleStyles = particlePalettes(name, parameters.speciesA, parameters.speciesB);
    particles.setPalette(particleStyles.primary);
    speciesBMarks.setPalette(particleStyles.secondary);
    particlePaletteKey = [name, parameters.speciesA, parameters.speciesB].join(':');
    return view;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.clear();
  }

  const layers = Object.freeze({
    occupancy,
    grid,
    particles,
    speciesBMarks,
    collisionEvents,
    rotationalEvents,
    frame,
    leftWall,
    rightWall,
    bottomWall,
    topWall,
    distribution,
    maxwellian,
    distributionFrame,
    distributionLabel,
    heading,
    method,
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
