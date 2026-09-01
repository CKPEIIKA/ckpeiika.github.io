import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { withCommonTranslations } from '../demos/lab-i18n.js';

const ROOT = new URL('../', import.meta.url);

const DEMOS = [
  {
    directory: 'demos/dg-euler-cylinder/',
    controls: ['case-id', 'degree', 'resolution', 'cfl', 'display-field'],
    controller: 'dg-fv-lab-controller.js',
  },
  {
    directory: 'demos/dsmc/',
    controls: ['case-id', 'particle-count', 'knudsen', 'time-step', 'collision-model'],
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
  assert.match(app, /writeChalkText\(nodes\.distributionTabLabel/);
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
  assert.match(css, /\.stage-footer\s*\{[^}]*border:\s*1px dashed/s);
  assert.match(css, /\.stage-footer\.stage-controls-hidden \.stage-controls\s*\{[^}]*max-width:\s*0/s);
  assert.match(css, /#diagnostics\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(controls, /root\.classList\.toggle\('stage-controls-hidden'\)/);
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
