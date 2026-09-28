# Demos: how to build the next one

Every demo on this site looks and behaves the same way: one header, one theme toggle,
one EN/RU switch, one catalogue style, one experiment view, one phone layout. A new
lecture is a copy of `_template/` with its own experiments; it inherits all of that.
The tests in `test/demo-consistency.test.js` find new demo folders by themselves and
fail when a demo leaves the standard.

## Start a lecture

```sh
node scripts/new-lecture.mjs 6 "Название лекции" "Lecture title" \
  --question-ru "Главный вопрос лекции?" --question-en "The lecture's main question?" \
  --summary-ru "Что показывают опыты." --summary-en "What the experiments show."
./preview.sh          # then open /demos/pde-lecture-6/ (add --python to skip Jekyll)
npm test                                       # or: node --test lib/chalkish/test/*.test.js test/*.test.js
```

The script copies `_template/` to `pde-lecture-6/`, fills the titles and adds the link to
`pages/cfd2026.md`. Then replace the two example experiments. `_template/` itself is never
published (Jekyll skips folders starting with `_`), but you can open it locally.

## What a lecture contains

```text
demos/pde-lecture-N/
  index.html        shared page shell; only the titles differ between lectures
  src/app.js        startGallery({...}): titles, catalogue question, debug name
  src/catalog.js    the experiments as data (texts, controls, presets, sources)
  src/labs.js       createLab(id, params, lang): one model per experiment
  src/kernels.js    the numerics: pure functions, no DOM, tested in Node
  src/notes.js      optional: plain-text notes opened from a source link
```

Everything else comes from `demos/pde-gallery/` (engine, board, catalogue and experiment
layout) and `demos/shell.css`, `theme.js`, `locale.js`, `controls-sheet.js`. Do not copy
those into a lecture; change them in one place.

## Catalog contract (`src/catalog.js`)

Every text is a `[ru, en]` pair. `R`, `S`, `O`, `P` in the template build controls,
options and presets.

| Field | Meaning |
| --- | --- |
| `id` | kebab-case, unique; also the URL hash (`#upwind`) |
| `group` | index into `groups` (the catalogue filters) |
| `title`, `short` | card title and one-line description |
| `equation` | chalk TeX `{ tex: String.raw`…` }` or `{ tex: [ru, en] }` (words in `\text{…}`; breaks at `\qquad` on narrow screens), or `[ru, en]` plain text |
| `controls` | `R(key, ru, en, value, min, max, step)`, `S(key, ru, en, value, options)` or `{ type: 'toggle', key, label, value: true }`; optional `help: [ru, en]` under the control; range defaults must lie on the slider grid |
| `presets` | "Try these" buttons: `P(ru, en, { key: value })` |
| `question` | what the student should check |
| `explanation`, `caveat` | the mathematics, and the model's limits and conventions |
| `sources` | keys of `sources`: `https://` links, `../pde-lecture-K/`, or `./NOTE.md` bundled in `notes.js` (may be empty; the section then hides) |
| `visible` | optional `(key, params) => boolean`: hide controls that do not apply in the current mode |
| `dynamic` | `true` if the experiment runs in time (Play / Step) |
| optional | `thumbParams`, `thumbSteps` (catalogue picture), `speed` (steps/s, 2…120), `action`, `stepLabel` (button words) |

## Model contract (`src/labs.js`)

`createLab(id, params, lang)` returns an object; throw on an unknown id.

- `render()` → `{ ink, stats: [[label, value], …], note?, warning?, equation? }`. Required.
  `equation` replaces the catalogue's equation for this state (`{ tex }` or a string).
- `step()` with `count`, `time`, `stop` for dynamic experiments. Set `stop = '■'` at the
  end of the shown interval, or to a sentence when the computation must halt (instability).
  Never clip or hide diverging data; stop and say why.
- `click(x, y)` / `paint(x, y)` → `true` when the board changed. Coordinates are board
  units. Store user choices in `params` so they survive language switches and appear in
  the controls. The gallery shows the "click the diagram" hint automatically.

**Live experiments** (Lecture 2) draw their own Chalkish scene instead of returning `ink`:
`mount(stage, { redraw, pause })` creates the canvas, `advance(seconds)` evolves continuous
time (the speed slider scales it, 24 = 1×), `setParameter(key, value)` returning `true` applies a
change without restarting, `render()` redraws and returns `{ stats, equation?, caption?, note? }`,
optional `tool: { label }` with `setTool(active)` adds the ✎ button, and `dispose()` cleans up.
Pass `preview(host, demo)` to `startGallery` to draw the catalogue pictures yourself.

Drawing uses `../../pde-gallery/board.js`: the board is **1000 × 610** units; `Ink` has
`line`, `arrow`, `rect`, `dot`, `path`, `text`, `math`, `title(text, subtitle)`; `graph(ink, {…})`
returns `curve`, `series`, `dot`, `contains`, `inverse`; `legend`, `fmt` and the chalk
colours `C` complete it. `xticks`/`yticks` ask for about that many intervals at round values,
or take explicit values / `[value, label]` pairs (e.g. `[[Math.PI, 'π']]`). Text is drawn as
chalk in the Chalkish scene, in board units, never below 10 px. Formulas on the board are
`ink.math(x, y, tex, size, color, align)` with the TeX subset listed at the top of
`lib/chalkish/src/tex.js` (scripts, `\frac`, `\sqrt`, accents, `\left…\right`, Greek,
operators); put numbers in with `fmtTex(value)` and words with `\text{…}`, e.g.
``String.raw`u^{n+1}_i = ${fmtTex(v)}` ``. The tests parse every formula of every preset. Thumbnails keep only text between y = 70 and y = 520, so put
essential labels there and the title at the top.

## Reference: every Chalkish primitive in use

`demos/chalkish-reference/` is a hidden lecture (not linked from the site, `noindex`) with one
experiment per group of primitives: formulas (`MathLabel`), plots (`PlotFrame`, `PlotAxes`,
`niceTicks`), animation (`Write`, `Transform`, `FadeIn`, `Indicate`, `Unwrite`), layout
(`arrange`, `nextTo`, `Panel`), picking and dragging (`hitTest`, `bindPointerDrag`), fields
(`contourSegments`, `VectorField`, `traceStreamlines`; `TrailLayer` for particle tracks) and data (`MatrixGrid`,
`HistoryBuffer`). `src/panes.js` builds each board from library calls only; copy from it.
For live scenes, put what stays still (axes, grids, backdrops) in `new Group([...], { cache: true })`:
it is kept as a bitmap and blitted until something in it changes (`PlotAxes` does this itself).
Data that changes every frame draws faster with a light rough stroke than with `dusty` chalk.
A page can stay out of the navigation on purpose with
`<meta name="site-listing" content="unlisted">` plus `noindex` (the site tests check both).

## Behaviour every demo shares

- **Language:** `?lang=ru|en`, otherwise the browser language. Every visible string exists in both.
- **Words:** one run is an *опыт / experiment*; the left panel is *условия опыта / experiment parameters*.
- **Keys** (every demo, from `keys.js`): Space play/pause · N (Т) step · R (К) reset · ← → previous/next · Esc or Q back · ? help. A page binds only the actions it has; its help dialog (header `?` button) lists exactly those, plus page-specific keys.
- **Phone (≤ 760 px):** the experiment fills the screen; the board takes about 70 % and the
  controls a scrolling sheet below (about 30 %); the bar between them hides the sheet.
- **Minimums:** text at least 10 px; buttons, links and inputs at least 24 px tall.
- **Theme:** light/dark comes from `shell.css` tokens. The board is always dark chalk.
- **Write-in:** opening an experiment writes its board in stroke by stroke and its equation
  with it (Chalkish `Write` and the page pen of `src/chalk-transition.js`, one timing
  `CHALK_TIMING`); parameter changes redraw at once, and reduced motion skips it.
- **Deep links:** `#id` opens an experiment; the browser Back button returns to the catalogue.

## Preview

`./preview.sh` serves the whole site with Jekyll as GitHub Pages builds it (it installs Jekyll into
`~/.cache/ckpeiika-jekyll` on the first run). `./preview.sh --python` serves plain files instead: the
demos work, Jekyll pages do not. Add a port and a sub-path, e.g. `./preview.sh 4000 /foo`, to check
that nothing assumes the domain root.

## Do not add

These were removed from earlier lecture packages and the tests reject them:
CSV export, share-link buttons, "engine status" labels, offline or `*_OFFLINE` switches, private `keydown` handlers (use `keys.js`),
inline `<style>`/`<script>`, private copies of the header, theme or language code,
CDN scripts, and root-relative paths (`/demos/…`). Everything must work as static files
under a GitHub Pages subpath.

## A standalone lab instead of a lecture

A large single simulation (like `dsmc/` or `dg-fvm/`) may have its own page, but it still uses
the shared header markup (copy it from any `index.html`), `shell.css`, `theme-init.js`/`theme.js`,
`lab-i18n.js` (which uses `locale.js`), and a `.sheet-toggle` bar between the stage and
`#lab-controls` for the phone layout.

## Before publishing

1. `npm test` passes; the contract tests list your lecture by folder name.
2. Open it through `./preview.sh` (not `file://`), also once as `./preview.sh 4000 /foo`: catalogue, every experiment, EN/RU, dark theme.
3. Check a phone width (390 px): board about 70 %, controls sheet, hide bar, no page scroll.
4. Each experiment answers its `question` on the board itself, with numbers in `stats`.
