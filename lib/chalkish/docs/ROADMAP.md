# Chalkish roadmap

The roadmap is organized by acceptance criteria, not calendar guesses. Software
schedules have suffered enough speculative fiction.

The domain-specific CFD curriculum and its per-case implementation gates are
maintained in [docs/CFD_DEMOS.md](docs/CFD_DEMOS.md) and [TODO.md](TODO.md). This roadmap
remains focused on reusable library mechanisms, so it does not attempt to list
all 42 cases twice. Duplication is not documentation; it is synchronized failure
waiting for a calendar invitation.

The student-facing PDE modules for CFD Lecture 2 have their own acceptance-led
plan in [PDE_LECTURE_ROADMAP.md](PDE_LECTURE_ROADMAP.md). The shared library owns
the tested numerical and drawing primitives; the static course site owns the
catalogue, language, lesson text, and URL routing.

## Phase 0: contracts and extraction harness

Goal: make current demo behavior measurable before refactoring.

- [ ] Add Euler flux, boundary, positivity, and deterministic-step tests.
- [ ] Add DSMC seeded movement, cell, collision, and conservation tests.
- [ ] Record representative desktop and phone frame profiles.
- [ ] Define explicit worker snapshot schemas.
- [ ] Define a plain JSON application-config schema for each demo.

Exit criteria:

- physics tests run without a DOM or renderer;
- a failed physics comparison identifies the field and step;
- current allocations and frame timing are recorded for comparison.

## Phase 1: vector core and visual language

Goal: stabilize small semantic diagrams.

Included in this starter:

- [x] scene, groups, primitive mobjects, camera, and updaters;
- [x] deterministic animations;
- [x] dependency-free Canvas2D renderer;
- [x] cached deterministic chalk strokes;
- [x] recording-context renderer tests;
- [x] source-size budget;
- [x] frozen 42-case CFD registry and generated catalog;
- [x] DOM-free schematic previews for all registry entries;
- [x] responsive CFD gallery with explicit non-validation labeling;
- [x] one canonical catalog consumed by both gallery routes;
- [x] local-only module loader with explicit schematic fallback;
- [x] repository-wide `AGENTS.md` contract.
- [x] number lines, axes, packed function plots, legends, braces, Unicode
  formula labels, and scalar value trackers.

Still required:

- [ ] dimension marks, brackets, annotation placement, and glyph-aware
  mathematical layout;
- [ ] clipping groups;
- [ ] hit testing and pointer coordinate conversion;
- [ ] documented theme objects;
- [ ] fixed browser visual-regression harness;
- [ ] keyboard-accessible example controls.

Exit criteria:

- an ENO/WENO stencil scene uses no custom drawing calls;
- stationary scenes allocate negligibly after warm-up;
- all styles remain stable under resize and camera zoom.

## Phase 2: scientific batch layers

Goal: handle dense numerical data without scene-object explosions.

Included in this starter:

- [x] scalar fields with reusable image buffers;
- [x] structure-of-arrays particles;
- [x] structure-of-arrays curves with reusable renderer projection buffers;
- [x] palette batching and viewport culling;
- [x] display-resolution and particle-stride quality controls.

Still required:

- [ ] vector-field arrows with magnitude buckets;
- [ ] indexed unstructured mesh layer;
- [ ] contour extraction in a worker;
- [ ] streamline layer with bounded segment storage;
- [ ] trail/ring-buffer layer;
- [ ] external-buffer streaming plot layer for histories and residuals;
- [ ] field masks and obstacle compositing.

Exit criteria:

- Euler cylinder and DSMC examples use only batch layers plus semantic overlays;
- no per-particle or per-cell JavaScript object is required;
- field and particle buffers can be transferred and recycled.

## Phase 3: runtime and worker path

Goal: keep simulation, rendering, and UI independently replaceable.

Included in this starter:

- [x] fixed-step clock;
- [x] quality controller with hysteresis;
- [x] buffer pool and thin worker bridge;
- [x] optional browser application loop.

Still required:

- [ ] documented `init`, `step`, `snapshot`, `recycle`, `reset`, `dispose` protocol;
- [ ] worker timeout and explicit error-state examples;
- [ ] latest-snapshot mailbox that drops stale render frames safely;
- [ ] optional `transferControlToOffscreen` renderer worker;
- [ ] pause, single-step, deterministic replay, and export controls;
- [ ] frame and simulation telemetry in plain JSON.

Exit criteria:

- a solver can run on the main thread or worker without changing its equations;
- a worker crash leaves a useful diagnostic and does not corrupt saved config;
- stale frames are dropped rather than queued indefinitely.

## Phase 4: domain helpers

Goal: make common scientific explanations short without polluting the core.

### CFD

- [x] function sampling, cell averages, grids, stencils, flux arrows;
- [ ] ENO candidate-stencil and divided-difference helpers;
- [ ] WENO smoothness/weight panels;
- [ ] finite-volume face states and Riemann fans;
- [ ] boundary normals, ghost cells, and characteristic arrows;
- [ ] mesh quality and limiter overlays.

### Physics

- [ ] trajectory, force, velocity, and acceleration annotations;
- [ ] springs, rays, collisions, and control volumes;
- [ ] reusable molecular species palette and trails;
- [ ] phase-space and vector-field helpers.

### Machine learning

- [ ] data clouds and class palettes;
- [ ] regression curves and residuals;
- [ ] decision boundaries and margin bands;
- [ ] loss landscapes and optimizer paths;
- [ ] compact neural-network graph layer;
- [ ] attention, convolution, and feature-map diagrams.

Exit criteria:

- each module can be omitted without affecting core imports or size;
- helpers produce ordinary scene objects or batch layers;
- no helper owns training or solver state.

## Phase 5: measured renderer expansion

Goal: add complexity only where a benchmark forces it.

- [ ] publish named Canvas2D limits on target phones;
- [ ] isolate bottlenecks by fields, particles, meshes, text, and compositing;
- [ ] prototype WebGL2 only for the failing batch layer;
- [ ] keep Canvas2D for text and ordinary vector diagrams if it remains simpler;
- [ ] verify identical scene contracts and graceful fallback;
- [ ] reject a second renderer if the maintenance cost exceeds measured benefit.

Exit criteria:

- every renderer exists because of a documented failing case;
- examples select capability, not renderer brand;
- visual output and data ownership remain consistent.

## Phase 6: stable release

Goal: declare a small API that can remain boring for years.

- [ ] audit names and error contracts;
- [ ] publish migration notes from the starter API;
- [ ] reach project-defined unit and branch coverage thresholds;
- [ ] run visual and performance tests on a browser/device matrix;
- [ ] document accessibility and reduced-motion behavior;
- [ ] freeze core exports for `1.0`;
- [ ] publish source archive, checksums, and changelog.

Exit criteria:

- core source remains within its declared size budget;
- zero dependencies remain the default distribution;
- the Euler, DSMC, ENO/WENO, ML, and basic physics examples share the same core;
- replacing the UI or solver does not require replacing the scene library.
