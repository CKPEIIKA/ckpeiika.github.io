import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('the default layout uses local Open Sans and local MathJax', async () => {
  const layout = await readFile(new URL('_layouts/default.html', root), 'utf8');
  assert.match(layout, /assets\/fonts\/open-sans\/open-sans\.css/);
  assert.match(layout, /vendor\/mathjax\/es5\/tex-mml-chtml\.js/);
  assert.doesNotMatch(layout, /cdn\.jsdelivr\.net|fonts\.googleapis\.com/);
});

test('Open Sans includes Latin, Cyrillic, and Greek in both site weights', async () => {
  const css = await readFile(
    new URL('assets/fonts/open-sans/open-sans.css', root),
    'utf8',
  );
  for (const subset of ['latin', 'cyrillic', 'greek', 'greek-ext']) {
    for (const weight of [400, 700]) {
      const filename = `open-sans-${subset}-${weight}-normal.woff2`;
      assert.match(css, new RegExp(filename));
      await access(new URL(`assets/fonts/open-sans/${filename}`, root));
    }
  }
  assert.match(css, /U\+0400-045F/);
  assert.match(css, /U\+0370-0377/);
  assert.match(css, /U\+1F00-1FFF/);
  await access(new URL('assets/fonts/open-sans/LICENSE.txt', root));
});

test('the local MathJax component and its fonts are present', async () => {
  const component = new URL('vendor/mathjax/es5/tex-mml-chtml.js', root);
  assert.ok((await stat(component)).size > 500_000);
  const font = new URL(
    'vendor/mathjax/es5/output/chtml/fonts/woff-v2/MathJax_Main-Regular.woff',
    root,
  );
  assert.ok((await stat(font)).size > 10_000);
  await access(new URL('vendor/mathjax/LICENSE', root));
});

test('every standalone demo loads the shared local font stylesheet', async () => {
  for (const page of [
    'demos/dsmc/index.html',
    'demos/dg-fvm/index.html',
    'demos/pde-lecture-2/index.html',
  ]) {
    const html = await readFile(new URL(page, root), 'utf8');
    assert.match(html, /\.\.\/\.\.\/assets\/fonts\/open-sans\/open-sans\.css/);
  }
});
