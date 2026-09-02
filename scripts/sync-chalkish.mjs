#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = resolve(process.argv[2] ?? '../chalkish-cfd-starter');
const target = resolve('lib/chalkish');

const directories = [
  'src',
  'examples/boards/dg-fv-lab',
  'examples/boards/dsmc-lab',
];

const omitted = new Set([
  'examples/boards/dg-fv-lab/dg-fv-lab.js',
  'examples/boards/dsmc-lab/dsmc-lab.js',
]);

const files = [
  'LICENSE',
  'TODO.md',
  'docs/LEGACY_PARITY.md',
  'docs/PDE_LECTURE_ROADMAP.md',
  'docs/ROADMAP.md',
  'docs/REFERENCE_DEMO_PORTS.md',
  'examples/board-settings.js',
  'examples/chalkboard-theme.css',
  'examples/chalk-transition.js',
  'examples/reference-labs.css',
  'examples/stage-controls.js',
  'examples/boards/_shared/dg-fv-lab-controller.js',
  'examples/boards/_shared/dsmc-lab-controller.js',
  'examples/cfd-demos/_shared/profile-demo-controller.js',
  'examples/assets/board-grain.png',
  'examples/assets/fonts/LICENSE.txt',
  'examples/assets/fonts/README.md',
  'examples/assets/fonts/schoolbell-regular.woff2',
  'examples/assets/fonts/walter-turncoat-regular.woff2',
  'test/dg-fv-lab-model.test.js',
  'test/dsmc-lab-model.test.js',
  'test/chalk-transition.test.js',
  'test/calculus.test.js',
  'test/reference-lab-views.test.js',
  'test/reference-lab-replays.test.js',
  'test/segments.test.js',
  'support/recording-context.js',
];

for (const directory of directories) {
  const names = await readdir(resolve(source, directory));
  for (const name of names.filter((entry) => entry.endsWith('.js'))) {
    const file = `${directory}/${name}`;
    if (!omitted.has(file)) files.push(file);
  }
}

for (const file of files) {
  const destinationFile = file.replace('/_shared/', '/shared/');
  const destination = resolve(target, destinationFile);
  await mkdir(resolve(destination, '..'), { recursive: true });
  if (file.includes('/_shared/')) {
    // Jekyll skips underscore-prefixed directories even when they are part of
    // a copied static library. Keep the source layout, publish a plain folder.
    const contents = await readFile(resolve(source, file), 'utf8');
    await writeFile(destination, contents.replaceAll('/_shared/', '/shared/'));
  } else {
    await cp(resolve(source, file), destination);
  }
}

const revision = spawnSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
});
if (revision.status !== 0) {
  throw new Error(revision.stderr.trim() || 'Could not read the Chalkish revision');
}
await writeFile(resolve(target, 'SOURCE_REVISION'), revision.stdout.trim() + '\n');

const packageFile = resolve(target, 'package.json');
const packageData = JSON.parse(await readFile(packageFile, 'utf8'));
packageData.version = packageData.version ?? '0.1.0-dev';
await writeFile(packageFile, JSON.stringify(packageData, null, 2) + '\n');

console.log(`Synced Chalkish ${revision.stdout.trim()} (${files.length} files).`);
