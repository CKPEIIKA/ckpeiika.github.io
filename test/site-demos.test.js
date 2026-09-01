import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

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
    assert.doesNotMatch(html, /example-loader|dsmc_typed\.js|dg-engine\.js/);
    assert.match(app, /lib\/chalkish\/src\/index\.js/);
    assert.match(app, new RegExp(`lib/chalkish/.+${demo.controller}`));
    assert.doesNotMatch(app, /\.getContext\s*\(|\.(?:fillRect|strokeRect|arc|lineTo)\s*\(/);

    for (const id of ['stage', 'stage-controls', 'pause', 'step', 'reset', ...demo.controls]) {
      assert.match(html, new RegExp(`id=["']${id}["']`), `${demo.directory} misses #${id}`);
    }
  }
});

test('all local module imports used by the demo entry points resolve', async () => {
  const queue = DEMOS.map((demo) => new URL(`${demo.directory}app.js`, ROOT));
  const visited = new Set();

  while (queue.length > 0) {
    const url = queue.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const source = await readFile(url, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)) {
      const imported = new URL(match[1], url);
      await access(imported);
      queue.push(imported);
    }
  }

  assert.ok(visited.size > 20, `expected a real module graph, found ${visited.size} files`);
});
