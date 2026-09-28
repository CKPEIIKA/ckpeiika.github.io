# Chalkish as a board: the plan

Chalkish was meant to be a Manim alternative in plain JavaScript, with a chalkboard look:
everything a lecture needs is written on the board. This file records where it stands
against the site's demos (2026-09) and the order in which the gaps are closed. The general
library roadmap stays in [ROADMAP.md](ROADMAP.md).

## Where it stands

The rendering core carries every demo: `Scene`, `Camera2D`, `mount`, primitive shapes,
chalk stroke styles, `CurveLayer`, `ScalarField`, `ParticleCloud`, `SegmentLayer`, the 3D
collision scene and the PDE kernels.

The layer that would make it Manim-like exists only as a starter and no demo uses it:
`ValueTracker`, `Tween`, `Sequence`, `Parallel`, `Axes`, `NumberLine`, `FormulaLabel`,
`Legend`, `Brace`, `Group` layout.

So the demos draw around it:

| Board need | Chalkish before this plan | What the demos did instead |
| --- | --- | --- |
| Axes, ticks, plots | `Axes` with hand-given tick steps; no framed plot, no automatic ticks, no clipping | the gallery's `graph()` split every range evenly (33 of 43 experiments showed labels like `0.0975 0.475 0.853`); binary collision draws its own plot canvas |
| Text | `TextLabel` in screen pixels, scaled by a fixed 1120 × 630 reference, not by the camera | the gallery drew all labels on a second canvas above the board |
| Formulas | `FormulaLabel` is a plain string | DOM equation bars, HTML lesson panels, Unicode sub/superscripts |
| Animation | property tweens only; no write/erase of strokes | each demo family has its own play loop; the chalk write effect exists only for HTML text |
| Layout | position, shift, scale | fixed coordinates on the 1000 × 610 board |
| Interaction | screen↔world, pan/zoom | hand-written click mapping in the labs |
| Scientific layers | fields, particles, segments | own contours (Lecture 4), bars/matrices/tables from rectangles and text |
| Output | live canvas only | nothing |

## Steps, in order of payoff

1. **Board text and chalk formulas.**
   - [x] `TextLabel({ size })`: text height in world units, scaled by the camera like every
     stroke; `minPixelSize` keeps it readable on phones; `maxWidth` in world units too.
   - [x] The gallery draws its labels in the Chalkish scene (the overlay canvas remains only
     for the plain Canvas 2D fallback and thumbnails).
   - [x] Formulas on the board: `MathLabel` lays out a TeX subset (`src/tex.js`: scripts,
     fractions, roots, accents, `\left…\right`, Greek, operators, functions, spacing) in the
     chalk handwriting font, with the TeX source as accessible text. The site bundles only
     MathJax's HTML output, and its SVG output would add ~2 MB and Computer Modern glyphs
     that do not look written on a board, so the layout is Chalkish's own. `paintTex` draws
     the same layout on any 2D context (thumbnails, the Canvas 2D fallback).
   - [x] Lecture 5's board formulas are TeX (`ink.math`, `fmtTex`); tests parse all of them.
   - [x] Lectures 3–4 board formulas and all 43 equation bars are TeX. `renderTexElement`
     (`src/tex-element.js`) paints TeX into a page element in its own font, breaking long
     formulas at `\qquad` gaps on narrow screens; `texToText` gives the accessible name.
     The subset gained matrices (`matrix`, `pmatrix`, `bmatrix`, `vmatrix`, `cases`).
2. **A framed scientific plot.**
   - [x] `niceTicks(min, max, count)` and `formatTick(value, step)` (`src/ticks.js`, no
     imports).
   - [x] The gallery's `graph()` uses them; `xticks`/`yticks` also accept explicit
     `[value, label]` pairs (e.g. multiples of π).
   - [x] `PlotFrame` (`src/plot-frame.js`, pure): data ↔ target coordinates on linear or
     log axes, round/decade/explicit ticks with alternating priority, polylines clipped at
     the frame edge (Liang–Barsky) and at gaps. The gallery's `graph()` (now with
     `xscale`/`yscale: 'log'`) and Lecture 2's `SampledPlot` are built on it.
   - [x] Fewer labels when they would collide: the gallery Board measures tick labels at
     their painted size and drops the lower-priority ones (phones), keeping all on desktop.
   - [ ] Bars, histograms, scatter and legend as frame helpers (the labs still draw their
     own bars and legends); the binary-collision plots and the DSMC/DG-FV history panels
     on the frame; `SampledPlot` curves clipped like the gallery's.
3. **Draw-on animations.**
   - [x] `Mobject.reveal` (0…1): strokes drawn up to that fraction of their length (chalk
     grain included, arrows shaft first), text by characters, formulas by glyphs, fills and
     data layers faded. `Write`/`Unwrite` animate it with a Manim-style lag through
     `Scene.play`; `Scene.animating` lets a host stop its frame loop.
   - [x] The gallery writes a board in when an experiment opens (skipped with reduced motion).
   - [x] `Transform` (lines, polylines, arrows, curve layers; resampled by arc length, colour
     blended), `FadeIn`/`FadeOut` (with drift), `Indicate` (swell and colour about the centre).
   - [ ] One chalk-writing effect for board and page (the page's `chalk-transition.js`).
4. **Layout and interaction.** `nextTo`/`arrange`, panels, text wrapping, clipping groups,
   hit-testing, draggable points.
5. **Open roadmap layers.** Contours, vector-field arrows, streamlines, streaming histories,
   matrix/table grids.
6. **Export.** PNG/SVG of a board state, short video capture for slides.

After steps 1–2 the gallery's `board.js` becomes a thin layer over Chalkish objects; then
Lecture 2, the DSMC/DG-FV views and binary collision move their plots onto the same `Plot`.
