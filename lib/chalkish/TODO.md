# Chalkish CFD Demo TODO

This is the implementation queue for the catalog in `docs/CFD_DEMOS.md`. The registry
in `examples/cfd-demo-registry.js` is the source of truth for IDs and metadata. A
checked box means the named artifact exists and passes its stated gate, not that
somebody opened it once and felt encouraged.

## Status vocabulary

- `[ ]` not started
- `[~]` implementation exists but has not passed the full definition of done
- `[x]` complete under the current gate

Each demo also carries one runtime status: `schematic`, `verified`, `validated`, `reference-data`, or `external-backend`.

## Phase 0: catalog and gallery scaffold

- [x] Define a typed, frozen registry for all study cases.
- [x] Add deterministic filter and lookup functions.
- [x] Add a DOM-free schematic-preview builder for every preview family.
- [x] Add render tests for all registered previews.
- [x] Add the responsive, dependency-free `examples/boards/cfd-gallery/cfd-gallery.html` page.
- [x] Add the staged `examples/cfd-study-gallery/` browser with manual stepping and quality controls.
- [x] Label schematic previews as not being validated numerical results.
- [x] Generate `docs/CFD_DEMOS.md` from the registry.
- [x] Add `AGENTS.md` with tests-first and architecture rules.
- [x] Add a grouped standalone-case migration:
  - [x] Add grouped case roots `examples/cases/foundations/`, `examples/cases/compressible/`, and
    `examples/cases/viscous-rarefied/`.
  - [x] Add implemented portable folders in separate case ID folders:
    - `examples/cases/foundations/linear-advection/`
    - `examples/cases/foundations/burgers-equation/`
    - `examples/cases/foundations/reconstruction-lab/`
    - `examples/cases/foundations/exact-euler-riemann/`
    - `examples/cases/compressible/sod-shock-tube/`
    - `examples/cases/compressible/lax-shock-tube/`
    - `examples/cases/compressible/einfeldt-strong-rarefaction/`
    - `examples/cases/compressible/isentropic-vortex/`
    - `examples/cases/compressible/double-mach-reflection/`
    - `examples/cases/compressible/oblique-shock-expansion/`
    - `examples/cases/viscous/couette-flow/`
    - `examples/cases/viscous/poiseuille-flow/`
    - `examples/cases/viscous/blasius-flat-plate/`
    - `examples/cases/viscous/gresho-vortex/`
    - `examples/cases/viscous/taylor-green-vortex/`
    - `examples/cases/multiphase/zalesak-disk/`
    - `examples/cases/viscous-rarefied/dsmc-equilibrium-box/`
  - [x] Keep reusable models, controllers, views, and dedicated repository
    entries under `examples/cfd-demos/<case-id>/`; every portable case folder
    contains only `index.html`, `physics.js`, `case.js`, and `case.css`.
  - [x] Consolidate board/example entry points under grouped paths and remove legacy root-page wrappers.
  - [x] Make every implemented case `index.html` open from both `file://` and
    static HTTP, and expose its route from both CFD galleries.
  - [x] Keep authoring model entry points presentation-free; controllers/views own
    Chalkish imports and browser integration.
  - [x] Consolidate repeated standard browser mounting into one shared case-page
    runtime while retaining dedicated entries for genuinely distinct controls.
  - [x] Keep both CFD case rails usable at short notebook heights with collapsed
    secondary filters and viewport-bounded stages.
  - [x] Give all 42 entries complete movable folders with local `index.html`,
    DOM-free `physics.js`, drawing-only `case.js`, `case.css`, and an embedded
    static-server import map; retain `schematic` as the honest scientific status
    for the 25 explanatory modules that do not integrate governing equations.
- [ ] Run the gallery on a real low-end Android phone and record a named workload, browser, device, frame-time distribution, memory use, and thermal behavior.
- [ ] Add browser screenshot regression tests once a zero-dependency or explicitly justified browser harness is selected.

## Legacy DG/DSMC full-replacement gate

The standalone DG/FV and spatial DSMC laboratories reuse the characterized
numerical kernels from the existing site demos, but they are not yet
feature-parity replacements for those applications. Keep the old demo folders
available until the P0 gate passes, and do not claim full visual/control parity
until P1 passes. Localization is deliberately deferred to the cross-cutting
localization queue below.

Chalkish is the frontend for these and future solvers, not their owner. Every
legacy presentation capability must be expressible as numerical state → thin
adapter → public Chalkish layer/semantic object → renderer. Solver-specific
equations, collision rules, limiters, histories, and control policy remain
outside `src/`; direct Canvas drawing remains inside renderers.

Here, frontend means the reusable scientific-view vocabulary: packed fields,
particles and geometry, semantic annotations, cameras, viewport interaction,
deterministic chalk material, and renderer inspection/export hooks. HTML/CSS
layout, localized DOM controls, fullscreen policy, and case-specific parameter
forms remain application-owned; Chalkish must not grow into a UI framework.

### P0 — safe scientific and deployment replacement

- [x] Publish a DG/DSMC frontend-capability matrix mapping every old drawing
  and interaction to an existing public Chalkish mechanism, a justified new
  generic mechanism, or application-owned composition. A new core abstraction
  needs at least two concrete consumers or a documented reason it cannot wait.
  See `docs/LEGACY_PARITY.md`.
- [x] Make both reference adapters prove the frontend boundary: their page,
  controller, model, and adapter modules must not call `getContext`, `moveTo`,
  `lineTo`, `arc`, `fillRect`, `strokeRect`, or other Canvas drawing commands.
  Renderer command-stream tests must cover every new layer they use.
- [x] Promote solver-neutral viewport behavior from the example-only stage
  controls into an optional public interaction module: screen/world conversion,
  pointer/touch grab, anchored zoom, view capture/reset, and deterministic
  camera updates. Keep button text, fullscreen policy, and localization in the
  application, and prove the API with both DG/FV and DSMC consumers.
- [x] Add a packed Cartesian-grid layer that emits all visible grid lines in
  one renderer path/stroke per render state. It must accept explicit domain and
  solver-cell dimensions, reject invalid dimensions atomically, avoid one
  object per cell/face, remain deterministic under camera/DPR changes, and
  decimate lines only as a presentation choice.
- [x] Add command-stream and invalid-input tests for the packed grid before
  implementation, plus a named dense-grid benchmark.
- [x] Bind the DG/FV grid to `cellsX × cellsY`, never to the higher-order
  sampled field dimensions, and bind the DSMC grid to the actual collision-cell
  `columns × rows`. Grid geometry must update after every mesh/cell-size reset.
- [x] Render the DG embedded-body boundary from the solver-owned solid mask or
  cell-face geometry. A smooth analytic circle/wedge may be shown as a
  separately labelled reference, but must not hide the stair-step numerical
  boundary.
- [ ] Add fixed-configuration parity fixtures for all four DG/FV families and
  all four DSMC presets: initial state, deterministic replay data, selected
  multi-step diagnostics, dimensions, boundary metadata, and display ranges.
  Record the source revision/checksum and fixture-generation procedure.
- [ ] Package each laboratory behind a relocatable static-folder contract.
  Moving the lab folder beside a deployed Chalkish library must not depend on
  its former `../../` repository depth. Verify both `file://` fallback and
  project-path GitHub Pages operation with no network-loaded assets.
- [ ] Add a browser replacement smoke covering case changes, reset, pause,
  single step, mesh/cell-size changes, grab, anchored zoom, view reset, and
  fullscreen for both laboratories.
- [ ] Correct the reference-port documentation paths after the module cleanup
  and document exactly which files must be deployed for native-module and
  local-file modes.

### P1 — full scientific presentation and control parity

- [x] Add a packed disconnected-segment/event layer for data-sized independent
  line segments. Use it for collision flashes, mask boundaries, and similar
  overlays instead of creating one semantic `Line` per event.
- [ ] Restore the DG/FV teaching layers: wedge theta-beta-Mach reference,
  freestream direction, solver-cell means versus higher-order reconstruction,
  Burgers space-time history, modal spectrum, jump/residual/solid displays,
  Cd/Cl histories, and explicit blow-up/fallback state.
- [ ] Restore the DG/FV controls that affect scientific interpretation:
  editable Mach number, body radius, gamma, exact Nx/Ny, scalar dissipation
  including the central limit, and solver steps per displayed frame.
- [ ] Restore the DSMC teaching layers: visible collision-cell boundaries,
  collision/rotational-event highlights, temperature-derived wall treatment,
  per-species encoding, speed distribution, moment histories, and `v,p,T`
  histories. Color must not be the only carrier of species or wall meaning.
- [ ] Restore the DSMC controls for species A/B, boundary mode, rotational
  relaxation, plot mode, and scientific-clean versus chalk-particle display.
  Keep stochastic state explicitly seeded and exportable even when the UI
  offers a new-seed action.
- [ ] Expose the same numerical-health information as the old applications:
  conservation drift, positivity/failure state, limiter counts, majorant
  violations, cell/time-step validity, wall exchange, and clear corrective
  guidance without moving those calculations into the renderer.
- [ ] Implement histories with application-owned ring buffers feeding existing
  `Axes` and `CurveLayer` objects. Do not add a generic chart framework unless
  at least two real cases cannot be expressed with those mechanisms.

### P2 — performance and convenience parity

- [x] Add a generic versioned worker snapshot bridge with explicit leases,
  newest-pending-snapshot retention, recycling, stale-frame rejection, and
  dropped-visual-snapshot diagnostics.
- [ ] Bind the generic snapshot bridge to a DG-owned worker adapter before
  exposing the original high-resolution mesh range.
- [ ] Restore optional render-quality modes, FPS/workload reporting, keyboard
  shortcuts, and contextual help without coupling them to numerical models.
- [ ] Compare old and replacement pages at notebook and phone dimensions, then
  record visual diffs and named frame-time/memory evidence before removing the
  old paths.

## Phase 1: one-dimensional and analytic foundations

Target: every case runs locally without a worker, has an exact/reference solution, and remains comfortably interactive on phones.

### Transport and reconstruction

- [x] `linear-advection`: finite-volume model with selectable upwind, Lax–Wendroff, MUSCL-TVD, ENO, WENO-JS, and WENO-Z reconstruction.
- [~] `reconstruction-lab`: model and compact moving-interface view expose candidate stencils, limiter decisions, WENO-JS, and WENO-Z; dedicated divided-difference and weight panels remain.
- [~] `linear-advection`: model API exposes ENO/WENO candidate values, smoothness indicators, nonlinear weights, and stencil indices; the interactive stencil panel remains.
- [~] `linear-advection`: live error norms, total variation, and conservation diagnostics exist; dedicated dispersion and dissipation views remain.
- [x] `burgers-equation`: exact scalar Riemann solver with shock/rarefaction classification and a conservative Godunov update.
- [ ] `burgers-equation`: conservative versus nonconservative discretization comparison.

### Compressible wave mechanics

- [x] `exact-euler-riemann`: robust ideal-gas exact solver with vacuum checks and root-solver tests.
- [~] `sod-shock-tube`: HLL solution, exact overlay, positivity/conservation tests, and three-grid convergence exist; wave markers and an interactive convergence panel remain.
- [~] `lax-shock-tube`: HLL solution and exact overlay exist; limiter and approximate-Riemann-solver comparison remains.
- [ ] `shu-osher`: high-resolution reference fixture and post-shock spectrum.
- [ ] `interacting-blast-waves`: positivity-preserving update and fine-grid reference fixture.
- [~] `einfeldt-strong-rarefaction`: HLL and exact/reference profiles with positivity and conservation assertions exist; solver-fallback comparison remains.
- [~] `double-mach-reflection`: deterministic first-order HLL/Rusanov 2D Euler
  finite volume, Euler/SSPRK2 time integration, standard Mach-ten state and
  boundary data, packed field view, positivity and boundary-flux conservation
  tests, and a named 120×30 benchmark exist; grid-refined wave-position and
  standard-time contour comparisons remain.
- [x] `oblique-shock-expansion`: analytic theta–beta–Mach and Prandtl–Meyer calculators.
- [ ] `shock-diffraction`: Liska–Wendroff corner geometry, positivity checks, and refined-grid contour comparison.
- [~] `supersonic-cylinder`: the existing DG Euler backend is characterized,
  converted to a DOM-free module, and rendered by the standalone DG/FV
  laboratory; gallery integration, worker ownership, force convergence, and a
  configuration-matched reference remain.

### Phase 1 gate

- [x] Exact-solution unit tests cover implemented limiting and failure cases.
- [x] Conservation error is tested to a documented tolerance for the implemented finite-volume cases.
- [ ] At least three grid levels recover the expected order in smooth problems.
- [x] Every implemented nonlinear reconstruction exposes its actual stencil and weights to the view adapter.
- [x] No numerical model module imports Chalkish, Canvas, DOM, or browser globals.

## Phase 2: viscous and incompressible flow

Target: reusable incompressible/viscous adapters, worker protocol, field layers, probes, and convergence tooling.

- [x] `couette-flow`: finite-difference transient plus analytic transient and steady profiles.
- [x] `poiseuille-flow`: finite-difference transient plus analytic flow rate, wall shear, and profile verification.
- [x] `blasius-flat-plate`: bracketed-shooting similarity ODE integrator and profile/thickness diagnostics.
- [ ] `lid-driven-cavity`: centerline comparison with Ghia data and divergence histories.
- [ ] `backward-facing-step`: Armaly configuration and reattachment-length extraction.
- [ ] `flow-past-cylinder`: Schäfer–Turek geometry, force integration, and shedding spectrum.
- [~] `gresho-vortex`: packed analytic vorticity and radial-balance diagnostics exist; time-discretized kinetic-energy preservation remains.
- [~] `taylor-green-vortex`: exact packed 2D decay and energy/divergence diagnostics exist; reference-data mode for 3D remains.
- [ ] Common pressure, velocity-vector, streamline, vorticity, wall-shear, and probe layers.
- [ ] Common grid, boundary-condition, time-step, and residual inspectors.

### Phase 2 gate

- [ ] Pressure–velocity solver tests include divergence reduction and temporal consistency.
- [ ] Force and wall-flux integration have analytic geometry tests.
- [ ] Worker messages use explicit schemas and transferred typed arrays.
- [ ] The renderer can drop obsolete snapshots instead of building a latency museum.

## Phase 3: thermal flow, interfaces, and instabilities

- [ ] `natural-convection-cavity`: de Vahl Davis Nusselt and velocity benchmarks.
- [ ] `rayleigh-benard`: conductive state, onset study, modal growth, and Nusselt history.
- [~] `zalesak-disk`: packed semi-Lagrangian rotation, exact geometry, boundedness, area, and L1/grid-convergence metrics exist; interface-length and symmetric-difference metrics remain.
- [ ] `dam-break`: front/height histories and strict mass conservation.
- [ ] `rising-bubble`: Hysing center-of-mass, velocity, circularity, and volume metrics.
- [ ] `kelvin-helmholtz`: smooth well-posed setup with linear-growth reference.
- [ ] `rayleigh-taylor`: single-mode linear-growth verification before nonlinear mixing.
- [ ] `shock-bubble-interaction`: multi-material conservation and Haas–Sturtevant comparison mode.
- [ ] Shared interface, contour, adaptive probe, and uncertainty-band layers.

### Phase 3 gate

- [ ] Interface topology is represented by packed buffers, never one JavaScript object per segment.
- [ ] Surface-tension and curvature tests include a static-drop pressure jump.
- [ ] Every instability demo records the initial perturbation spectrum and random seed.
- [ ] Numerical perturbations are never described as physical turbulence without evidence.

## Phase 4: turbulence and external aerodynamics

These are primarily reference-data and external-backend demos in the browser. Trying to run a serious ONERA M6 RANS calculation inside a phone tab would be less “portable science” and more “battery-assisted hand warmer.”

- [ ] `turbulent-channel`: package selected DNS statistics with wall-unit conversions and budgets.
- [ ] `nasa-wall-hump`: package NASA/TMR geometry and comparison profiles.
- [ ] `naca-0012`: analytic inviscid checks plus TMR verification dataset.
- [ ] `rae-2822`: package Case 6 geometry, Cp, and boundary-layer profiles.
- [ ] `onera-m6`: package Test 2308 geometry and seven sectional Cp datasets.
- [ ] `ahmed-body`: package a clearly specified geometry/angle dataset and wake/force references.
- [ ] Add surface-data, section-cut, uncertainty, residual, y+, and force-history components.
- [ ] Define a generic external-solver snapshot schema for OpenFOAM, SU2, hy2Foam, and custom codes.

### Reference data and checksum gate

- [ ] Every reference data file has a provenance record, license note, original checksum, transformed checksum, units, and case conditions.
- [ ] Every transformation is reproducible by a checked-in script.
- [ ] Tests compare known rows, extrema, dimensions, and integrals after transformation.
- [ ] No remote fetch is required to run the packaged gallery.

## Phase 5: rarefied gas dynamics and hypersonics

- [~] `dsmc-equilibrium-box`: seeded homogeneous and spatial cell-based
  variants, elastic VHS/VSS/HS collision sampling, conserved moments, and
  Maxwellian histogram comparison exist; uncertainty estimates remain.
- [ ] `rarefied-couette`: accommodation, slip, temperature, and shear profiles.
- [ ] `normal-shock-structure`: end-state jump checks and normalized internal profiles.
- [ ] `hypersonic-blunt-body`: continuum/reference-data/DSMC adapters with shock stand-off and surface heating.
- [ ] `thermal-creep-knudsen-pump`: thermal-gradient microchannel and mass-flow sweep.
- [x] Extract the existing DSMC backend behind a DOM-free model interface and
  bind its SoA buffers to packed Chalkish layers.
- [ ] Add particle sampling bins, distributions, collision-cell overlays, wall-interaction events, and confidence intervals.
- [ ] Add optional multi-species and internal-energy visual encodings without turning each particle into an object.

### Phase 5 gate

- [x] Seeded homogeneous-box runs reproduce particle initialization and collision fixtures bitwise.
- [ ] Conservation and sampling uncertainty are reported separately.
- [ ] Collision-model, wall-model, particle weighting, and cell/time-step constraints are visible in the UI.
- [ ] Any continuum comparison uses matched gas properties, units, and boundary conditions.

## Chalk realism materialization pass

The core architecture is in place; this phase upgrades rendering fidelity so objects look like physical chalk on textured board media.

### Phase 6: material model and geometry foundation

- [x] Replace coarse `roughness`-only behavior with material parameters in `chalkStyle`, including `wobble`, `pressure`, `pressureVariation`, `coverage`, `edgeBreakup`, `grainSize`, `dust`, `softness`, and `accumulation`.
- [x] Introduce a cached chalk-material module (for example `src/chalk-material.js`).
- [x] Implement arc-length resampling in screen space (roughly per 1–2 px) before stroke deformation.
- [x] Use low-frequency correlated noise for centerline wandering and higher-frequency correlated noise for edge breakup/coverage.
- [x] Add pressure profiles along arc length and make width/opacity/coverage/bright/dust terms depend on pressure, optional velocity, and dwell accumulation.

### Phase 7: stroke deposition pipeline

- [x] Keep one faint continuous carrier per pass; default material coverage no longer creates full-width gaps.
- [x] Express porosity as deterministic fine holes among narrow, brighter deposits inside the carrier.
- [x] Batch deposits into at most three pressure bands per pass and expose carrier/deposit counts.

Current implementation boundary:

- This is a batched additive deposition pipeline, not yet the full offscreen alpha-mask/erosion pipeline.
- Text masking, explicit dust-particle halos, and progressive stroke drawing remain future work.

- [ ] Render strokes through an alpha-mask style pipeline rather than geometric distortion alone:
  - broad low-opacity base deposition,
  - deterministic hole punching (`destination-out` style erosion),
  - bright/edge deposit fragments,
  - edge grain particles,
  - final composite.
- [ ] Cache generated stroke masks by geometry/style/camera/DPR changes and avoid per-frame recalculation.
- [ ] Ensure mask generation is deterministic and seed-dependent.
- [ ] Add three-band stroke decomposition (dust halo, incomplete main body, bright deposits).
- [ ] Add slow-turn/end-point accumulation behavior in pressure-driven stroke shape.

### Phase 8: board and text materiality

- [x] Replace conspicuous CSS stripes with one local, fine-grain board texture shared by examples and portable cases.
- [ ] Add deterministic `BoardTexture` support (new module, for example `src/board.js`) with:
  - low-frequency variation,
  - fine luminance grain,
  - occasional wipe marks,
  - sparse scratches,
  - faint ghosting.
- [ ] Render text via text-mask workflow (glyph-to-mask, erosion, edge breakup) rather than direct `fillText` repeats.
- [ ] Introduce non-digital fill modes (`hatch`, `crosshatch`, `smudge`, `stipple`) and make them available to diagram layers.
- [ ] Provide a portability strategy for labels/math (system text + mask, or compact built-in vector glyph subset).

### Phase 9: fields and particles visual modes

- [ ] Add scientific-safe field presentation modes: `continuous`, `chalk-contours`, `chalk-bands`, and `chalk-wash`.
- [ ] Keep scalar data exact in all modes; change only presentation, not interpolation/invariant meaning.
- [ ] Add optional chalkized particle rendering via a small deterministic sprite atlas (per-id variant, multiple radii/coverage patterns).
- [ ] Keep scientific-clean particle mode available for high-clarity regimes (e.g., dense DSMC point clouds).

### Phase 10: interaction, animation, and milestone evidence

- [ ] Add progressive stroke deposition and textured erase/reveal behavior.
- [ ] Add tests before renderer changes for:
  - seed determinism of material output,
  - cache hit behavior across repeated renders,
  - visual stability across frames,
  - tessellation invariance,
  - DPR stability,
  - coverage/coverage-bound preservation,
  - mask reuse and texture caching.
- [ ] Add browser image regression for a canonical scene (line/curve/circle/text/hatch/field contour/particles).
- [ ] Add chalk-realism benchmark workload and report on desktop/mobile targets.

### Chalk realism milestone

- [x] Deterministic board texture shipped and cached by the browser.
- [ ] Arc-length stroke sampling integrated.
- [ ] Pressure and coverage masks integrated.
- [ ] Broken edges + fractured deposits integrated.
- [ ] Chalk text masks available.
- [ ] Hatch/smudge fills available.
- [ ] Visual regression coverage added and passing.

## Cross-cutting library work

### Core API

- [x] Add a separate-buffer `CurveLayer` for dense numerical profiles without interleaved adapter copies.
- [x] Add reusable number lines, axes, packed function plots, legends, braces,
  Unicode formula labels, and scalar value trackers.
- [ ] Add dimension marks, callouts, brackets, and general annotation placement.
- [ ] Add contour, vector-field, mesh, trail, graph, and uncertainty-band batch layers.
- [x] Add camera pan/zoom with touch and pointer events in an optional interaction module.
- [ ] Add deterministic transform and morph helpers inspired by useful Manim concepts without importing its architecture wholesale.
- [ ] Add reference-data loaders that accept local buffers/files and never own the scientific state.

### Manim-inspired capability priorities

The local Manim reference at commit `6199a00` informs vocabulary and composition,
not a direct Python class-tree port. Chalkish keeps semantic 2D exposition
shallow and keeps data-sized geometry in packed batch layers.

- **P0 — complete:** `NumberLine`, `Axes` with coordinate conversion and one
  packed `Polyline` per sampled plot, `Legend`, `Brace`, accessible
  `FormulaLabel`, and updater-compatible `ValueTracker`.
- **P1 — next:** partial-stroke draw/write animations, fade/grow helpers,
  transform/morph and matching transforms, bounds/layout/alignment, hit
  testing, arcs and Bézier paths, traced paths, and dimension annotations.
- **P2 — later:** local SVG import, clipping and alpha masks, boolean geometry,
  glyph-aware mathematical text, and packed vector, contour, streamline, mesh,
  uncertainty, and trail layers.
- **P3 — evidence-gated:** optional 3D cameras and surface rendering, a full TeX
  toolchain, and offline video/audio export. None may become a baseline runtime
  dependency or weaken direct static-host operation.

### Performance

- [~] Establish benchmark workloads for packed function plots, 1D curves,
  scalar fields, vector glyphs, contours, meshes, and particle clouds; plots,
  curves, scalar fields, and particles are covered.
- [ ] Test on named desktop and mobile devices; publish median, p95, and worst frame time.
- [ ] Record memory allocations and garbage-collection spikes for long runs.
- [ ] Add WebGL2 only after a named Canvas2D workload fails a named device target.
- [ ] Keep quality degradation ordered and scientific-state preserving.

### Accessibility and teaching

- [ ] Keyboard-operable gallery and controls.
- [ ] Reduced-motion mode that preserves static explanatory content.
- [ ] Text alternatives for color maps, line styles, and status.
- [ ] Never encode meaning only in color.
- [ ] Add a “show equations / show discretization / show diagnostics” teaching progression.
- [ ] Add citations and status badges directly to every demo.

### Localization

- [x] Make `en` and `ru` an explicit standalone-page contract with URL,
  safe-storage, browser-language, and English-fallback precedence.
- [x] Localize common controls, accessibility labels, page status language,
  schematic captions, and the title/summary/solver/scientific target of all
  42 portable CFD cases without changing the four-file case layout.
- [ ] After the DG/FV and DSMC replacement mechanics stabilize, localize their
  runtime-generated canvas labels, option labels, diagnostics, help, and error
  text in English and Russian. Keep numerical IDs and snapshot keys stable.
- [ ] Translate the detailed learning/layer/diagnostic prose in both CFD
  galleries and the 47 case-specific MATLAB atlas narratives. Raw diagnostic
  field identifiers remain stable until aliases are specified and tested.

## Definition of done for one demo

A demo is complete only when all applicable items below are true:

1. **Problem definition:** equations, domain, initial/boundary conditions, units, nondimensional numbers, and output time are explicit.
2. **Source:** original or authoritative reference is cited; deviations from it are listed.
3. **Model isolation:** numerical model runs under Node with no DOM, Canvas, renderer, or UI imports.
4. **Tests first:** the behavioral test was written failing before implementation, then committed with the smallest passing mechanism.
5. **Determinism:** all stochastic behavior is seeded; replay metadata is exportable.
6. **Conservation/sanity:** conserved quantities, positivity, boundedness, divergence, or equivalent invariants are tested where relevant.
7. **Verification:** exact/reference comparison and grid/time/sampling convergence are automated.
8. **Validation:** where claimed, comparison data and uncertainty are documented; otherwise the status is not `validated`.
9. **Reference data:** provenance, license, transformation, units, and checksum are present.
10. **View adapter:** typed model buffers bind to a small number of semantic or batch layers without redundant copies.
11. **Performance:** a named workload passes its named desktop and mobile target; adaptive quality does not alter solver fidelity.
12. **Accessibility:** controls are keyboard usable, reduced motion works, and no meaning depends only on color.
13. **Failure quality:** invalid states produce specific errors naming what failed, why, what changed, and the corrective action.
14. **Documentation:** catalog metadata, equations, diagnostics, validation status, and limitations are current.
15. **Release gate:** tests, coverage, size, examples, gallery contract, checksums, and archive verification pass.
