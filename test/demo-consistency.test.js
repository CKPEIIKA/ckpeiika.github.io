import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { actionForEvent, KEY_MAP } from '../demos/keys.js';
import { initialLanguage } from '../demos/locale.js';
import { paramsFromState, quantize } from '../demos/pde-gallery/gallery.js';
import { layoutTex, parseTex } from '../lib/chalkish/src/tex.js';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8');

// Discovered, not listed: a new demo folder is checked as soon as it exists.
async function demoDirs() {
  const entries = await readdir(new URL('demos/', ROOT), { withFileTypes: true });
  const dirs = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = `demos/${entry.name}/`;
    if (await access(new URL(`${dir}index.html`, ROOT)).then(() => true, () => false)) dirs.push(dir);
  }
  return dirs;
}

// Gallery lectures (and the template) are the demos built on ../pde-gallery.
async function galleryDirs() {
  const dirs = [];
  for (const dir of await demoDirs()) {
    const app = await read(`${dir}src/app.js`).catch(() => '');
    if (app.includes('startGallery(')) dirs.push(dir);
  }
  return dirs;
}

const PAGES = await demoDirs();
const GALLERIES = await galleryDirs();

async function demoSources() {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(new URL(dir, ROOT), { withFileTypes: true })) {
      const path = `${dir}${entry.name}`;
      if (entry.isDirectory()) await walk(`${path}/`);
      else if (/\.(html|css|js)$/.test(entry.name)) files.push(path);
    }
  }
  await walk('demos/');
  return files;
}

test('every chalkboard demo uses the one shared header, theme and language switch', async () => {
  for (const page of PAGES) {
    const html = await read(`${page}index.html`);
    const header = html.match(/<header class="demo-header">[\s\S]*?<\/header>/)?.[0];
    assert.ok(header, `${page} lacks the shared header`);
    assert.match(header, /<a class="demo-home" href="\.\.\/\.\.\/pages\/[\w-]+\.html"/, page);
    assert.match(header, /<span class="demo-home-label"/, page);
    assert.match(header, /<h1[ >]/, page);
    assert.match(header, /<button class="demo-theme-toggle" type="button" data-theme-toggle/, page);
    assert.match(header, /<button class="demo-help-toggle" type="button" data-help-toggle/, page);
    assert.match(header, /<nav class="demo-locale" data-locale-switch[\s\S]*data-lang="en"[\s\S]*data-lang="ru"/, page);
    assert.match(html, /<script src="\.\.\/theme-init\.js"><\/script>/, page);
    assert.match(html, /<link rel="stylesheet" href="\.\.\/shell\.css"/, page);
    assert.match(html, /\.\.\/theme\.js/, `${page} must use the shared theme toggle`);
  }
});

test('no page keeps a private copy of the header, theme or language code', async () => {
  const legacy = /lab-header|lecture-header|site-header|board-home|header-tools|(?<!data-)locale-switch\b|course-label|language-button|theme-button|data-theme=|pde[34]-theme/;
  const offenders = [];
  for (const file of await demoSources()) {
    if (legacy.test(await read(file))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test('the site palette and fonts are declared once, in shell.css', async () => {
  const declaring = [];
  for (const file of await demoSources()) {
    const source = await read(file);
    if (/--site-background\s*:/.test(source) || /@font-face/.test(source)) declaring.push(file);
  }
  assert.deepEqual(declaring, ['demos/shell.css']);
});

test('language comes from ?lang, then the browser, and never from junk', () => {
  const page = 'https://user.github.io/project/demos/dsmc/';
  assert.equal(initialLanguage(`${page}?lang=ru`, 'en-US'), 'ru');
  assert.equal(initialLanguage(`${page}?lang=en`, 'ru-RU'), 'en');
  assert.equal(initialLanguage(page, 'ru-RU'), 'ru');
  assert.equal(initialLanguage(page, 'RU'), 'ru');
  assert.equal(initialLanguage(page, 'en-GB'), 'en');
  for (const junk of ['', 'de', 'EN', 'ru ', '<script>', 'ru&lang=en']) {
    assert.equal(initialLanguage(`${page}?lang=${encodeURIComponent(junk)}`, 'en'), 'en', junk);
  }
  for (const preferred of [undefined, null, '', 'xx', 42]) {
    assert.equal(initialLanguage(page, preferred), 'en', String(preferred));
  }
  assert.equal(initialLanguage(`${page}?lang=ru&lang=en`, 'en'), 'ru');
});

test('gallery ?state only restores values the experiment controls allow', () => {
  const demo = {
    id: 'stencil',
    controls: [
      { key: 'h', type: 'range', min: 0.05, max: 1, step: 0.05 },
      { key: 'fn', type: 'select', options: [{ value: 'sin' }, { value: 'exp' }] },
    ],
  };
  const base = Object.freeze({ h: 0.5, fn: 'sin' });
  const state = (value) => JSON.stringify(value);

  assert.deepEqual(paramsFromState(demo, base, null), base);
  assert.deepEqual(paramsFromState(demo, base, '{not json'), base);
  assert.deepEqual(paramsFromState(demo, base, 'null'), base);
  assert.deepEqual(paramsFromState(demo, base, state({ id: 'other', p: { h: 0.1 } })), base);
  assert.deepEqual(paramsFromState(demo, base, state({ id: 'stencil', p: { h: 0.23, fn: 'exp' } })), { h: 0.25, fn: 'exp' });
  assert.deepEqual(paramsFromState(demo, base, state({ id: 'stencil', p: { h: 99, fn: 'eval' } })), { h: 1, fn: 'sin' });
  assert.deepEqual(paramsFromState(demo, base, state({ id: 'stencil', p: { h: '0.2', extra: 1 } })), base);
  assert.deepEqual(
    paramsFromState(demo, base, state({ id: 'stencil', p: { nodes: [2, -1, 2, 0.5, 9, -3, 'x'] } })).nodes,
    [-3, -1, 2],
  );
  assert.equal(quantize(-5, demo.controls[0]), 0.05);
  assert.equal(quantize(0.1 + 0.2, demo.controls[0]), 0.3);
});

test('all demo entry points resolve their local module graphs without Node APIs', async () => {
  const queue = PAGES.map((page) => new URL(`${page}${GALLERIES.includes(page) ? 'src/' : ''}app.js`, ROOT));
  const visited = new Set();
  while (queue.length > 0) {
    const url = queue.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const source = await readFile(url, 'utf8');
    assert.doesNotMatch(source, /(?:from\s+["']node:|\brequire\s*\(|\bprocess\.|\b__dirname\b)/, url.pathname);
    for (const match of source.matchAll(/(?:from\s+|import\s*\(?\s*)["'](\.[^"']+)["']/g)) {
      const imported = new URL(match[1], url);
      await access(imported);
      queue.push(imported);
    }
  }
  assert.ok([...visited].some((href) => href.endsWith('/demos/pde-gallery/gallery.js')));
});

test('every gallery lecture is the same page shell around its own catalogue', async () => {
  assert.ok(GALLERIES.includes('demos/_template/') && GALLERIES.includes('demos/pde-lecture-2/') && GALLERIES.length >= 5, GALLERIES.join());
  const shell = (html) => html
    .replace(/<meta name="description" content="[^"]*">/, '')
    .replace(/\n[ \t]*<meta name="robots" content="[^"]*">/, '')
    .replace(/\n[ \t]*<meta name="site-listing" content="[^"]*">/, '')
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<h1 id="page-title">[^<]*<\/h1>/, '')
    .replace(/<h2 id="catalogue-title">[^<]*<\/h2>/, '')
    .replace(/<p id="catalogue-description">[^<]*<\/p>/, '')
    .replace(/<strong id="catalogue-count">\d+<\/strong>/, '');
  const pages = await Promise.all(GALLERIES.map((dir) => read(`${dir}index.html`)));
  pages.forEach((html, k) => {
    assert.equal(shell(html), shell(pages[0]), `${GALLERIES[k]} differs from the shared shell`);
    assert.doesNotMatch(html, /<style|<script>/, 'no inline styles or scripts');
    // Features removed from the site must not come back with a new lecture package.
    assert.doesNotMatch(html, /id="(?:csv|share|share-url|engine-status|source-link)"/);
  });
});

// The gallery contract documented in demos/README.md, checked for every lecture and the template.
const pair = (value) => Array.isArray(value) && value.length === 2 && value.every((s) => typeof s === 'string' && s.trim() !== '');
const text = (value) => pair(value) || (typeof value === 'string' && value.trim() !== '');

for (const dir of GALLERIES) {
  test(`${dir}: catalog follows the gallery contract`, async () => {
    const catalog = (await import(`../${dir}src/catalog.js`)).default;
    const { groups, sources, demos, defaults, translate } = catalog;
    assert.equal(typeof defaults, 'function');
    assert.equal(typeof translate, 'function');
    assert.ok(groups.length > 0 && groups.every(pair), 'groups are [ru, en] pairs');
    for (const [key, source] of Object.entries(sources)) {
      assert.equal(typeof source.label, 'string', key);
      assert.match(source.url, /^(https:\/\/|\.\/[\w-]+\.md$|\.\.\/pde-lecture-\d+\/$)/, `${key}: https URL, a bundled ./NOTE.md or another lecture`);
    }
    const ids = new Set();
    for (const demo of demos) {
      const where = `${dir}#${demo.id}`;
      assert.match(demo.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${where}: kebab-case id`);
      assert.ok(!ids.has(demo.id), `${where}: duplicate id`);
      ids.add(demo.id);
      assert.ok(Number.isInteger(demo.group) && groups[demo.group], `${where}: group index`);
      for (const field of ['title', 'short', 'question', 'explanation', 'caveat']) assert.ok(pair(demo[field]), `${where}: ${field} is a [ru, en] pair`);
      // An equation is chalk TeX ({ tex } or { tex: [ru, en] }), plain text or fixed markup.
      if (demo.equation?.tex !== undefined) {
        for (const tex of [].concat(demo.equation.tex)) assert.doesNotThrow(() => parseTex(tex), `${where}: equation ${tex}`);
        assert.ok(typeof demo.equation.tex === 'string' || pair(demo.equation.tex), `${where}: equation.tex`);
      } else {
        assert.ok(text(demo.equation), `${where}: equation`);
      }
      assert.ok(Array.isArray(demo.sources) && demo.sources.every((key) => sources[key]), `${where}: sources exist`);
      if (demo.visible !== undefined) assert.equal(typeof demo.visible, 'function', `${where}: visible(key, params)`);
      for (const field of ['action', 'stepLabel']) if (demo[field] !== undefined) assert.ok(pair(demo[field]), `${where}: ${field}`);
      if (demo.speed !== undefined) assert.ok(demo.speed >= 2 && demo.speed <= 120 && demo.speed % 2 === 0, `${where}: speed on the 2…120 slider`);
      if (demo.thumbSteps !== undefined) assert.ok(Number.isInteger(demo.thumbSteps) && demo.thumbSteps >= 0, `${where}: thumbSteps`);

      const keys = new Set();
      for (const control of demo.controls) {
        const at = `${where}.${control.key}`;
        assert.ok(!keys.has(control.key), `${at}: duplicate control`);
        keys.add(control.key);
        assert.ok(pair(control.label), `${at}: label`);
        if (control.help !== undefined) assert.ok(pair(control.help), `${at}: help`);
        if (control.type === 'toggle') {
          assert.equal(typeof control.value, 'boolean', `${at}: toggle default`);
        } else if (control.type === 'range') {
          assert.ok([control.min, control.max, control.step].every(Number.isFinite) && control.min < control.max && control.step > 0, `${at}: range`);
          assert.equal(quantize(control.value, control), control.value, `${at}: default ${control.value} lies on the slider grid`);
        } else {
          assert.equal(control.type, 'select', `${at}: type`);
          assert.ok(control.options.length > 0 && control.options.every((o) => pair(o.label)), `${at}: options`);
          assert.ok(control.options.some((o) => o.value === control.value), `${at}: default is an option`);
        }
      }
      for (const preset of demo.presets) {
        assert.ok(pair(preset.label), `${where}: preset label`);
        for (const [key, value] of Object.entries(preset.values)) {
          const control = demo.controls.find((c) => c.key === key);
          if (!control) continue; // Model-only state (e.g. drawn values) is allowed in presets.
          if (control.type === 'toggle') assert.equal(typeof value, 'boolean', `${where}: preset ${key}`);
          else if (control.type === 'range') assert.equal(quantize(value, control), value, `${where}: preset ${key}=${value} on the slider grid`);
          else assert.ok(control.options.some((o) => o.value === value), `${where}: preset ${key}=${value} is an option`);
        }
      }
      assert.deepEqual(Object.keys(defaults(demo)), demo.controls.map((c) => c.key));
      assert.equal(translate(demo.title, 'en'), demo.title[1]);
    }
  });

  test(`${dir}: every experiment builds, steps and draws finite commands in both languages`, async () => {
    const catalog = (await import(`../${dir}src/catalog.js`)).default;
    const labs = await import(`../${dir}src/labs.js`);
    const createLab = labs.createLab ?? labs.default.createLab;
    assert.throws(() => createLab('no-such-experiment', {}, 'ru'));
    for (const lang of ['ru', 'en']) {
      for (const demo of catalog.demos) {
        const where = `${dir}#${demo.id} (${lang})`;
        const model = createLab(demo.id, { ...catalog.defaults(demo), ...demo.thumbParams }, lang);
        if (demo.dynamic) {
          assert.equal(typeof model.step, 'function', `${where}: dynamic experiments step`);
          for (let i = 0; i < (demo.thumbSteps ?? 12); i += 1) model.step();
          assert.ok(Number.isFinite(model.time) && Number.isInteger(model.count), `${where}: time and count`);
          assert.equal(typeof model.stop, 'string', `${where}: stop is a message or ''`);
        }
        if (typeof model.mount === 'function') {
          // A live model draws its own scene once mounted; without a page it still evolves and reports.
          if (model.advance) {
            model.advance(0.5);
            assert.ok(Number.isFinite(model.time), `${where}: live time`);
          }
          const view = model.render();
          assert.ok(Array.isArray(view.stats) && view.stats.every((s) => s.length === 2), `${where}: stats are [label, value]`);
          model.dispose?.();
          continue;
        }
        const view = model.render();
        assert.ok(view.ink.cmd.length > 0, `${where}: draws something`);
        assert.ok(Array.isArray(view.stats) && view.stats.every((s) => s.length === 2), `${where}: stats are [label, value]`);
        for (const command of view.ink.cmd) {
          for (const [key, value] of Object.entries(command)) {
            if (typeof value === 'number') assert.ok(Number.isFinite(value), `${where}: ${command.type}.${key} = ${value}`);
          }
        }
      }
    }
  });

  test(`${dir}: every board formula is valid chalk TeX in every preset`, async () => {
    const catalog = (await import(`../${dir}src/catalog.js`)).default;
    const labs = await import(`../${dir}src/labs.js`);
    const createLab = labs.createLab ?? labs.default.createLab;
    const measure = (text) => Array.from(text).length * 0.5;
    for (const lang of ['ru', 'en']) {
      for (const demo of catalog.demos) {
        for (const preset of [{ values: {} }, ...(demo.presets ?? [])]) {
          const model = createLab(demo.id, { ...catalog.defaults(demo), ...preset.values }, lang);
          if (typeof model.mount === 'function') continue;
          if (demo.dynamic) for (let i = 0; i < 3; i += 1) model.step();
          const view = model.render();
          if (view.equation?.tex) for (const tex of [].concat(view.equation.tex)) assert.doesNotThrow(() => parseTex(tex), `${dir}#${demo.id}: ${tex}`);
          for (const command of view.ink.cmd.filter((c) => c.type === 'math')) {
            assert.doesNotThrow(() => layoutTex(command.tex, measure), `${dir}#${demo.id} (${lang}): ${command.tex}`);
          }
        }
      }
    }
  });
}

test('fmtTex writes numbers as formula TeX', async () => {
  globalThis.location ??= { search: '' };
  const { fmtTex } = await import('../demos/pde-gallery/board.js');
  const cases = [[0, '0'], [0.55, '0.55'], [-3, '-3'], [1.86e-4, '1.86\\cdot 10^{-4}'], [1e-6, '10^{-6}'],
    [-1e-6, '-10^{-6}'], [2.5e5, '2.5\\cdot 10^{5}'], [Infinity, '\\infty'], [-Infinity, '-\\infty'], [NaN, '\\text{NaN}']];
  const measure = (text) => Array.from(text).length * 0.5;
  for (const [value, tex] of cases) {
    assert.equal(fmtTex(value), tex);
    assert.doesNotThrow(() => layoutTex(tex, measure));
  }
});

test('on phones every experiment view uses the shared 70/30 controls sheet', async () => {
  // Pages whose controls live in static markup carry the bar next to the controls it hides.
  for (const page of ['demos/dsmc/', 'demos/dg-fvm/', ...GALLERIES]) {
    const html = await read(`${page}index.html`);
    assert.match(html, /<button [^>]*class="sheet-toggle"[^>]*aria-controls="(?:lab-controls|controls-panel)"[^>]*aria-expanded="true"/, page);
  }
  const [labI18n, gallery, shell, overrides, galleryCss] = await Promise.all([
    read('demos/lab-i18n.js'), read('demos/pde-gallery/gallery.js'),
    read('demos/shell.css'), read('demos/lab-overrides.css'), read('demos/pde-gallery/gallery.css'),
  ]);
  for (const source of [labI18n, gallery]) assert.match(source, /bindControlsSheet\(/);
  assert.match(shell, /\.sheet-toggle\s*\{\s*display:\s*none/);
  for (const css of [overrides, galleryCss]) {
    assert.match(css, /minmax\(0, ?7fr\) auto minmax\(0, ?3fr\)/);
    assert.match(css, /controls-collapsed/);
  }
});

test('one keyboard map: the same key means the same action on every demo', () => {
  const press = (key, extra = {}) => actionForEvent({ key, ...extra });
  assert.equal(press(' '), 'play');
  for (const key of ['n', 'N', 'т', 'Т']) assert.equal(press(key), 'step', key);
  for (const key of ['r', 'R', 'к']) assert.equal(press(key), 'reset', key);
  assert.equal(press('ArrowLeft'), 'previous');
  assert.equal(press('ArrowRight'), 'next');
  for (const key of ['Escape', 'q', 'й']) assert.equal(press(key), 'back', key);
  assert.equal(press('?', { shiftKey: true }), 'help');
  assert.equal(press(',', { shiftKey: true }), 'help', 'Russian layout, US ? position');
  assert.equal(press(','), null, 'a plain comma is not help');
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) assert.equal(press('r', { [modifier]: true }), null, modifier);
  for (const key of ['s', 'h', 'g', '', undefined, 'Enter']) assert.equal(press(key), null, String(key));
  const all = KEY_MAP.flatMap((entry) => entry.keys);
  assert.equal(new Set(all).size, all.length, 'no key belongs to two actions');
});

test('only the shared keys module listens to the keyboard in demos', async () => {
  const listeners = [];
  for (const file of await demoSources()) {
    if (file === 'demos/keys.js' || !file.endsWith('.js')) continue;
    if (/addEventListener\(\s*['"]keydown/.test(await read(file))) listeners.push(file);
  }
  assert.deepEqual(listeners, []);
});

test('the page background is plain on every demo; only boards use chalk', async () => {
  const shell = await read('demos/shell.css');
  assert.match(shell, /body\s*\{\s*background-color:\s*var\(--site-background\);\s*background-image:\s*none;/);
  assert.match(shell, /body::after\s*\{\s*display:\s*none;/);
  for (const page of PAGES) {
    const html = await read(`${page}index.html`);
    const theme = html.indexOf('chalkboard-theme.css');
    // The Chalkish example theme paints the whole page; shell.css must come after it.
    if (theme !== -1) assert.ok(theme < html.indexOf('../shell.css'), `${page}: shell.css after chalkboard-theme.css`);
  }
});

