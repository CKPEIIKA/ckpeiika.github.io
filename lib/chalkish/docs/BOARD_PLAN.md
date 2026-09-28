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
   - [x] `graph()` draws `bars`, `histogram` and `scatter` cut at the frame (Lectures 4–5 use
     them); `PlotAxes` (scene grid and labels for a frame, inside or outside, rebuilt only
     when ranges change) with `niceBounds` gives the DSMC and DG-FV insets real values;
     `SampledPlot` curves are clipped at the panel edge; binary collision picks round ticks
     where its even splits were not round (and its plot captions are now bilingual).
3. **Draw-on animations.**
   - [x] `Mobject.reveal` (0…1): strokes drawn up to that fraction of their length (chalk
     grain included, arrows shaft first), text by characters, formulas by glyphs, fills and
     data layers faded. `Write`/`Unwrite` animate it with a Manim-style lag through
     `Scene.play`; `Scene.animating` lets a host stop its frame loop.
   - [x] The gallery writes a board in when an experiment opens (skipped with reduced motion).
   - [x] `Transform` (lines, polylines, arrows, curve layers; resampled by arc length, colour
     blended), `FadeIn`/`FadeOut` (with drift), `Indicate` (swell and colour about the centre).
   - [x] One chalk pen for board and page: `src/chalk-transition.js` (moved from examples)
     holds `CHALK_TIMING`, which `demos/shell.css` repeats (tested); canvas labels are
     rewritten through `reveal`; the gallery writes the equation bar with its board.
4. **Layout and interaction.**
   - [x] `src/layout.js`: world `getBounds` of any object (text and formulas through a
     measure), `nextTo`/`arrange`/`moveTo` with `RIGHT`/`LEFT`/`UP`/`DOWN`, `hitTest`
     (topmost drawn object near a point), `Panel` (frame, title, clipped content).
   - [x] `Group({ clip })` clips its children; `TextLabel({ wrap: true, maxWidth })` breaks
     into lines; `bindPointerDrag` (interaction.js) drags what a pick function returns.
5. **Scientific layers.**
   - [x] `src/vector-field.js`: `contourSegments` (marching squares, saddles, gaps) and
     `joinSegments` into long strokes; `traceStreamline(s)` (RK4, bounds, stagnation, closed
     orbits); `VectorField`, a chalk segment layer of arrows. Lecture 4's contours use it
     through the gallery's `contourLines`/`g.lines`, Lecture 2's arrows are one VectorField.
   - [x] `HistoryBuffer` (`src/history.js`, the former site RingHistory) streams the DSMC
     and DG-FV histories; `MatrixGrid` draws matrices with `cellAt`/`highlight`, and the
     gallery's `matrix()` does the same on Ink boards (Lecture 4 SBP).
6. **Export.** PNG/SVG of a board state, short video capture for slides (not needed now).

After steps 1–2 the gallery's `board.js` becomes a thin layer over Chalkish objects; then
Lecture 2, the DSMC/DG-FV views and binary collision move their plots onto the same `Plot`.
