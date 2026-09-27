import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8');

test('site pages remember the theme shared with the demos', async () => {
  const [layout, nav, script, assignments] = await Promise.all([
    read('_layouts/default.html'), read('_includes/nav.html'), read('site-theme.js'), read('pages/ml-assignments.html'),
  ]);
  for (const html of [layout, assignments]) {
    assert.match(html, /demos\/theme-init\.js/);
    assert.match(html, /site-theme\.js"? defer|site-theme\.js' \| relative_url \}\}" defer/);
  }
  assert.match(nav, /id="site-theme-toggle"/, 'the checkbox still works without JavaScript');
  assert.match(script, /localStorage\.setItem\('site-theme'/, 'same key as demos/theme.js');
  assert.match(nav, /aria-current="page"/, 'the navigation marks the current page');
});

test('decorative motion stops for visitors who ask for less motion', async () => {
  const css = await read('style.css');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.blink,\s*\.marquee span\s*\{\s*animation:\s*none/);
});

test('markdown pages use kramdown maths and no root-relative links', async () => {
  const pages = (await readdir(new URL('pages/', ROOT))).filter((name) => name.endsWith('.md'));
  for (const name of ['../index.html', ...pages]) {
    const source = await read(`pages/${name}`);
    // Markdown turns \( into a plain "(", so MathJax would never see the formula.
    assert.doesNotMatch(source, /\\\(/, `${name}: write inline maths as $$…$$`);
    assert.doesNotMatch(source, /\]\(\/(?!\/)|href="\/(?!\/)/, `${name}: use relative_url for site links`);
  }
});
