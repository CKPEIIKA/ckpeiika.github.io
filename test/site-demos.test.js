import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { withCommonTranslations } from '../demos/lab-i18n.js';

const ROOT = new URL('../', import.meta.url);

const DEMOS = [
  {
    directory: 'demos/dg-fvm/',
    controls: [
      'case-id', 'degree', 'resolution', 'mesh-columns', 'mesh-rows', 'cfl',
      'flux-alpha', 'steps-per-frame', 'mach', 'body-radius', 'gamma',
      'display-field', 'render-quality',
    ],
    controller: 'dg-fv-lab-controller.js',
  },
  {
    directory: 'demos/dsmc/',
    controls: [
      'case-id', 'particle-count', 'knudsen', 'time-step', 'collision-model',
      'species-a', 'species-b', 'boundary-x', 'boundary-y',
      'rotational-relaxation', 'rotational-collision-number', 'random-seed',
      'event-highlights', 'collision-sample', 'board-style',
      'new-seed', 'export-replay', 'import-replay', 'render-quality',
    ],
    controller: 'dsmc-lab-controller.js',
  },
];

test('both demos are static ES-module frontends backed by the vendored library', async () => {
  for (const demo of DEMOS) {
    const [html, app] = await Promise.all([
      readFile(new URL(`${demo.directory}index.html`, ROOT), 'utf8'),
      readFile(new URL(`${demo.directory}app.js`, ROOT), 'utf8'),
    ]);

    assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
    assert.match(html, /lib\/chalkish\/examples\/reference-labs\.css/);
    assert.match(html, /data-locale-switch/);
    assert.match(html, /data-lang="en"/);
    assert.match(html, /data-lang="ru"/);
    assert.match(html, /data-mobile-controls-toggle/);
    assert.match(html, /id="lab-controls"/);
    assert.match(html, /data-action="toggle-controls"/);
    assert.doesNotMatch(html, /example-loader|dsmc_typed\.js|dg-engine\.js/);
    assert.doesNotMatch(html, /verified numerical model|not validated|data-i18n="page\.(?:lede|note|status)"/i);
    assert.match(app, /lib\/chalkish\/src\/index\.js/);
    assert.match(app, /\.\.\/lab-i18n\.js/);
    assert.match(app, new RegExp(`lib/chalkish/.+${demo.controller}`));
    assert.doesNotMatch(app, /\.getContext\s*\(|\.(?:fillRect|strokeRect|arc|lineTo)\s*\(/);

    for (const id of ['stage', 'stage-controls', 'pause', 'step', 'reset', ...demo.controls]) {
      assert.match(html, new RegExp(`id=["']${id}["']`), `${demo.directory} misses #${id}`);
    }
    assert.match(html, /class="stage-canvas"/);
  }
});

test('mobile parameter panels are collapsed until explicitly opened', async () => {
  const [css, i18n, dsmc, dg] = await Promise.all([
    readFile(new URL('demos/lab-overrides.css', ROOT), 'utf8'),
    readFile(new URL('demos/lab-i18n.js', ROOT), 'utf8'),
    readFile(new URL('demos/dsmc/app.js', ROOT), 'utf8'),
    readFile(new URL('demos/dg-fvm/app.js', ROOT), 'utf8'),
  ]);
  assert.match(css, /\.lab-layout\s*\{[\s\S]*grid-template-areas:\s*\n\s*"stage"\s*\n\s*"controls"/);
  assert.match(css, /\.lab-controls\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.lab-controls\.mobile-controls-open\s*\{[\s\S]*display:\s*grid/);
  assert.match(i18n, /export function bindMobileControls/);
  assert.match(dsmc, /mobileControls\.sync\(\)/);
  assert.match(dg, /mobileControls\.sync\(\)/);
});

test('legacy scientific controls and teaching panels are model-backed', async () => {
  const [dgHtml, dgApp, dgModel, dsmcHtml, dsmcApp, dsmcModel] = await Promise.all([
    readFile(new URL('demos/dg-fvm/index.html', ROOT), 'utf8'),
    readFile(new URL('demos/dg-fvm/app.js', ROOT), 'utf8'),
    readFile(new URL('lib/chalkish/examples/boards/dg-fv-lab/dg-fv-lab-model.js', ROOT), 'utf8'),
    readFile(new URL('demos/dsmc/index.html', ROOT), 'utf8'),
    readFile(new URL('demos/dsmc/app.js', ROOT), 'utf8'),
    readFile(new URL('lib/chalkish/examples/boards/dsmc-lab/dsmc-lab-model.js', ROOT), 'utf8'),
  ]);

  assert.match(dgHtml, /id="analysis-tabs"[\s\S]+id="analysis-stage"/);
  assert.match(dgHtml, /id="flux-alpha"[^>]+min="0"/);
  assert.match(dgApp, /analysis\.spaceTime/);
  assert.match(dgApp, /stepsPerFrame/);
  assert.match(dgApp, /'192x96'/);
  assert.match(dgApp, /'320x1'/);
  assert.match(dgModel, /wedgeShockAngleDegrees/);
  assert.match(dgModel, /positivityLimitedCells/);
  assert.match(dgModel, /meanScalar/);
  assert.match(dgModel, /modalSpectrum/);

  assert.match(dsmcHtml, /id="replay-file"[^>]+hidden/);
  assert.match(dsmcHtml, /<details id="model-controls" open>/);
  assert.match(dsmcApp, /parseReplayDocument/);
  assert.match(dsmcApp, /profileTemperature/);
  assert.match(dsmcModel, /collisionSegments/);
  assert.match(dsmcModel, /rotationalCollisionNumber/);
  assert.match(dsmcModel, /collisionLineProbability/);
  assert.match(dsmcModel, /temperatureProfile/);
  assert.match(dsmcModel, /majorantViolationRatio/);
});

test('DSMC plot is a localized right-edge tab with selectable contents', async () => {
  const [html, app, view, css] = await Promise.all([
    readFile(new URL('demos/dsmc/index.html', ROOT), 'utf8'),
    readFile(new URL('demos/dsmc/app.js', ROOT), 'utf8'),
    readFile(new URL('lib/chalkish/examples/boards/dsmc-lab/dsmc-lab-view.js', ROOT), 'utf8'),
    readFile(new URL('demos/lab-overrides.css', ROOT), 'utf8'),
  ]);

  assert.match(html, /data-action="previous-plot"/);
  assert.match(html, /data-action="next-plot"/);
  assert.match(html, /data-action="toggle-plot"/);
  assert.match(html, /class="distribution-plot"[^>]*>[\s\S]*id="distribution-stage"/);
  assert.match(app, /PLOT_MODES[^;]+speed[^;]+temperature[^;]+collisions/s);
  assert.match(app, /rewriteChalkText\(nodes\.distributionTabLabel/);
  assert.match(app, /markChalkTransition\(nodes\.distributionPlot/);
  assert.match(app, /'plot\.speed': 'Скорости'/);
  assert.match(view, /distributionFrame,\s*distributionLabel,/s);
  assert.match(css, /\.distribution-tabs\s*\{[^}]*right:\s*var\(--plot-right, 0\);[^}]*bottom:\s*var\(--plot-bottom, 0\)/s);
  assert.match(css, /\.distribution-tabs\s*\{[^}]*grid-template-rows:[^}]*border:\s*1px dashed/s);
  assert.match(app, /new Scene\(\{ background: '#0d1611' \}\)/);
  assert.match(app, /controller\.camera\.matrix\(plotAnchorMatrix, backingWidth, backingHeight\)/);
  assert.match(app, /app\.renderer\.pixelRatio/);
  assert.match(app, /domain\.maxX[\s\S]+domain\.minY/);
});

test('stage controls stay outside the canvas and can collapse independently', async () => {
  const [css, controls] = await Promise.all([
    readFile(new URL('demos/lab-overrides.css', ROOT), 'utf8'),
    readFile(new URL('lib/chalkish/examples/stage-controls.js', ROOT), 'utf8'),
  ]);

  assert.match(css, /\.stage-viewport\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto/s);
  assert.match(css, /\.stage-canvas canvas\s*\{[^}]*width:\s*100%\s*!important;[^}]*height:\s*100%\s*!important/s);
  assert.match(css, /\.stage-controls\s*\{[^}]*position:\s*static/s);
  assert.match(css, /\.stage-footer\s*\{[^}]*border:\s*0/s);
  assert.match(css, /\.stage-footer::before\s*\{[^}]*radial-gradient/s);
  assert.match(css, /--board-texture:\s*url\("\.\.\/lib\/chalkish\/examples\/assets\/board-grain\.png"\)/);
  assert.match(css, /\.stage-footer\.stage-controls-hidden \.stage-controls\s*\{[^}]*max-width:\s*0/s);
  assert.match(css, /#diagnostics\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /#diagnostics\s*\{[^}]*font-family:\s*var\(--font-chalk\)/s);
  assert.doesNotMatch(css, /#diagnostics\s*\{[^}]*ui-monospace/s);
  assert.match(controls, /markChalkTransition\(nodes\.controlSet, 'erase'\)/);
  assert.match(controls, /schedule\(collapse, controlEraseDelay\)/);
});

test('all local module imports used by the demo entry points resolve', async () => {
  const queue = DEMOS.map((demo) => new URL(`${demo.directory}app.js`, ROOT));
  const visited = new Set();

  while (queue.length > 0) {
    const url = queue.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const source = await readFile(url, 'utf8');
    assert.doesNotMatch(source, /(?:from\s+["']node:|\brequire\s*\(|\bprocess\.|\b__dirname\b)/);
    for (const match of source.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)) {
      const imported = new URL(match[1], url);
      await access(imported);
      queue.push(imported);
    }
  }

  assert.ok(visited.size > 20, `expected a real module graph, found ${visited.size} files`);
});

test('shared translations provide both languages without mutating the input', () => {
  const local = {
    en: { 'page.title': 'Demo' },
    ru: { 'page.title': 'Демо' },
  };
  const translations = withCommonTranslations(local);

  assert.equal(translations.en['page.title'], 'Demo');
  assert.equal(translations.ru['page.title'], 'Демо');
  assert.equal(translations.en['stage.pause'], 'Pause animation');
  assert.equal(translations.ru['stage.pause'], 'Приостановить расчёт');
  assert.deepEqual(local, {
    en: { 'page.title': 'Demo' },
    ru: { 'page.title': 'Демо' },
  });
});

test('site and demo links do not assume deployment at the domain root', async () => {
  const files = [
    '_layouts/default.html',
    '_includes/nav.html',
    'index.html',
    'pages/fvm-demo.md',
    'pages/dsmc-demo.md',
    ...DEMOS.map((demo) => `${demo.directory}index.html`),
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, ROOT), 'utf8');
    assert.doesNotMatch(
      source,
      /(?:href|src)=["']\/(?!\/)/,
      `${file} contains a root-relative URL`,
    );
  }
});

test('runtime demo controllers are published from non-underscore directories', async () => {
  const [dsmc, dg, profile] = await Promise.all([
    readFile(new URL('demos/dsmc/app.js', ROOT), 'utf8'),
    readFile(new URL('demos/dg-fvm/app.js', ROOT), 'utf8'),
    readFile(new URL('lib/chalkish/examples/boards/shared/dg-fv-lab-controller.js', ROOT), 'utf8'),
  ]);
  for (const source of [dsmc, dg, profile]) {
    assert.doesNotMatch(source, /examples\/[^\n]*\/\_shared\//);
  }
  assert.match(dsmc, /examples\/boards\/shared\/dsmc-lab-controller\.js/);
  assert.match(dg, /examples\/boards\/shared\/dg-fv-lab-controller\.js/);
  assert.match(profile, /cfd-demos\/shared\/profile-demo-controller\.js/);
});

test('primary navigation keeps the requested teaching order', async () => {
  const nav = await readFile(new URL('_includes/nav.html', ROOT), 'utf8');
  const orderedPaths = [
    'pages/resources.md',
    'pages/eucken.md',
    'pages/paper-reviews.md',
    'pages/cfd2025.md',
    'pages/ml2025.md',
    'pages/dsmc-demo.md',
    'pages/fvm-demo.md',
  ];

  let previous = -1;
  for (const path of orderedPaths) {
    const position = nav.indexOf(path);
    assert.ok(position > previous, `${path} is out of menu order`);
    previous = position;
  }
  assert.doesNotMatch(nav, /sort:\s*["']title["']/);

  const expectedLabels = [
    ['pages/resources.md', 'Полезные ссылки'],
    ['pages/eucken.md', 'О поправке Эйкена'],
    ['pages/paper-reviews.md', 'Обзоры статей'],
    ['pages/cfd2025.md', 'CFD 2026'],
    ['pages/ml2025.md', 'ML 2026'],
    ['pages/dsmc-demo.md', 'DSMC DEMO'],
    ['pages/fvm-demo.md', 'DG/FV DEMO'],
  ];
  for (const [path, label] of expectedLabels) {
    const source = await readFile(new URL(path, ROOT), 'utf8');
    assert.match(source, new RegExp(`^nav_label:.*${label.replace('/', '\\/')}`, 'm'));
  }
});

test('the two demo landing pages opt into the local MathJax bundle', async () => {
  const [dsmc, dg] = await Promise.all([
    readFile(new URL('pages/dsmc-demo.md', ROOT), 'utf8'),
    readFile(new URL('pages/fvm-demo.md', ROOT), 'utf8'),
  ]);
  assert.match(dsmc, /^math:\s*true\s*$/m);
  assert.match(dg, /^math:\s*true\s*$/m);
});
