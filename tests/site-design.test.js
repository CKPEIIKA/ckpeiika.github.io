import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8');

test('site pages remember the theme shared with the demos', async () => {
  const [head, defaultLayout, standalone, nav, script] = await Promise.all([
    read('_includes/head.html'), read('_layouts/default.html'), read('_layouts/standalone.html'),
    read('_includes/nav.html'), read('site-theme.js'),
  ]);
  assert.match(head, /demos\/theme-init\.js/);
  assert.match(head, /site-theme\.js' \| relative_url \}\}\?v=\{\{ v \}\}" defer/);
  // Versioned CSS/JS links, so a browser never pairs new HTML with an old cached stylesheet.
  for (const link of head.match(/(?:href|src)="\{\{ [^}]*\.(?:css|js)'? \| relative_url \}\}[^"]*"/g)) {
    if (/open-sans\.css|theme-init\.js|mathjax/.test(link)) continue;
    assert.match(link, /\?v=\{\{ v \}\}"$/, link);
  }
  for (const layout of [defaultLayout, standalone]) {
    assert.match(layout, /\{% include head\.html %\}/);
    assert.match(layout, /\{% include site-header\.html %\}/);
    assert.match(layout, /\{% include site-footer\.html %\}/);
  }
  assert.match(nav, /id="site-theme-toggle"/, 'the checkbox still works without JavaScript');
  assert.match(script, /localStorage\.setItem\('site-theme'/, 'same key as demos/theme.js');
  assert.match(nav, /aria-current="page"/, 'the navigation marks the current page');
});

test('standalone pages keep their code in files listed in front matter', async () => {
  const pages = (await readdir(new URL('pages/', ROOT))).filter((name) => /\.(md|html)$/.test(name));
  let count = 0;
  for (const name of pages) {
    const source = await read(`pages/${name}`);
    if (!/^layout: standalone$/m.test(source)) continue;
    count += 1;
    const body = source.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    assert.doesNotMatch(body, /<script|<style/, `${name}: no inline script or style`);
    for (const [, file] of source.matchAll(/^\s+- (\/[\w/.-]+\.(?:css|js))$/gm)) {
      await read(file.slice(1)); // throws if the listed file is missing
    }
  }
  assert.ok(count >= 1);
  const roster = await read('pages/ml-assignments.html');
  const cells = roster.match(/<td\b[^>]*>/g);
  assert.ok(cells.every((cell) => /data-label="/.test(cell)), 'every roster cell labels itself on phones');
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

test('the assignments page lists problem 2 with its common requirements and 19 variants', async () => {
  const page = await read('pages/ml-assignments.html');
  assert.match(page, /<details id="task-2" class="assignment-detail">/, 'the roster link #task-2 has a target');
  const ids = [...page.matchAll(/<details id="(problem2-variant-\d+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, Array.from({ length: 19 }, (_, i) => `problem2-variant-${i + 1}`));
  assert.equal((page.match(/<details\b/g) ?? []).length, (page.match(/<\/details>/g) ?? []).length, 'every details element is closed');
});
