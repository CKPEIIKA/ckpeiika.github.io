# Legacy DG/DSMC parity matrix

This matrix compares the Chalkish laboratories with the last standalone site
implementation before migration:

```text
repository: ckpeiika.github.io
revision: cd792b03fd1b099f0778fe5804cbec06e3759caf
DG/FV: demos/dg-euler-cylinder/
DSMC: demos/dsmc/
```

The numerical kernels have already been ported. This document tracks the
scientific presentation and controls around those kernels. `Partial` means the
current model exposes the quantity or behavior but the browser laboratory does
not yet expose the complete old interaction or comparison.

## DG/FV laboratory

| Legacy capability | Status | Current mechanism or required work | Verification |
| --- | --- | --- | --- |
| Euler/body, diamond translation, scalar advection, Burgers | Implemented | `DgFvLabModel` case selection | model and site smoke tests |
| P0/FV through P3 polynomial degree | Implemented | degree control; Euler remains limited to P2 | model validation tests |
| Mesh presets | Implemented | resolution control | site contract test |
| Exact `Nx`, `Ny` entry | Implemented | application-owned numeric controls | model and frontend contract tests |
| CFL | Implemented | range control and model validation | model tests |
| Rusanov dissipation, including central limit `alpha = 0` | Implemented | model and range control both include `0` | boundary-value model and frontend tests |
| Solver steps per displayed frame | Implemented | application loop policy; no renderer change | frontend contract test |
| Scalar initial conditions and velocity fields | Implemented | application controls feeding model reset | model tests |
| Square, wedge, cylinder, and no-body geometry | Implemented | all four model choices are exposed | UI/model parity fixture |
| Editable Mach number, body radius, and gamma | Implemented | exact numeric controls feed atomic model resets | parameter fixture |
| Positivity, minmod, flattening, modal filtering | Implemented | limiter control | model tests |
| Density, pressure, Mach, speed, vorticity, entropy, field, mean, error, modal energy | Implemented | display-field control and packed scalar field | view tests |
| Solver-cell grid and stair-step body boundary | Implemented | `CartesianGrid`, `SegmentLayer` | command-stream tests |
| Chalk rendering on grid, frame, curves, and labels | Implemented | grids use two cheap rough batched passes; short layers may use the full deposit material | view style assertions and `cheap-chalk-grid-cached-redraw-514` benchmark |
| Wedge theta-beta-Mach reference | Implemented | model computes the weak attached branch; batched dashed rays show it | fixed wedge comparison fixture |
| Freestream direction and characteristic arrows | Implemented | one packed segment layer | view command test |
| Cell means versus higher-order reconstruction | Implemented | Burgers overlay and analysis panel compare the DG field with cell means | snapshot and view tests |
| Burgers space-time history and modal spectrum | Implemented | application-owned bounded history feeding packed field/curves | frontend and model fixtures |
| Jump, residual, and solid-mask displays | Implemented | density jump, time residual, and exact solver-cell mask are selectable | display-range fixtures |
| Cd/Cl histories | Implemented | bounded application history in the right-edge analysis tab | ring-buffer and frontend tests |
| Positivity failure, limiter counts, fallback state | Implemented | diagnostics expose health, limiter counts, and a corrective action code | model regression |
| Pause, single step, reset, pan, zoom, view reset, fullscreen | Implemented | shared stage controls and viewport interactions | interaction tests; browser smoke pending |
| Quality mode, FPS/workload, keyboard controls, contextual help | Implemented | adaptive/manual quality, compact telemetry, shortcuts, and a dialog | notebook/phone browser smoke |

## DSMC laboratory

| Legacy capability | Status | Current mechanism or required work | Verification |
| --- | --- | --- | --- |
| Equilibrium, heat transfer, rotational nitrogen, Couette presets | Implemented | deterministic presets | model tests |
| Particle count, Knudsen number, collision-cell size, time step | Implemented | application controls feeding model reset | model validation tests |
| Hard-sphere, VHS, and VSS collisions | Implemented | collision-model control | deterministic solver parity tests |
| Explicit collision-cell occupancy and boundaries | Implemented | packed scalar field plus two-pass rough `CartesianGrid` | view tests and cached-redraw benchmark |
| Wall temperatures, wall speed, Maxwell accommodation | Implemented | wall controls | model tests |
| Species A/B selection and per-species non-color encoding | Implemented | source-backed Ar/N₂ mixtures use circles and square marks as well as color | mixture fixture and view test |
| Periodic, specular, diffuse, and mixed boundary selection | Implemented | x and y selectors feed explicit model boundary modes | one fixture per boundary mode |
| Rotational relaxation control and collision number | Implemented | live Larsen-Borgnakke toggle and `Zrot` parameter | equilibrium and relaxation fixtures |
| Explicit random seed, new seed, replay, export | Implemented | versioned static JSON configuration with strict import validation | replay checksum and format round trip |
| Particle, collision, and rotational-event highlights | Implemented | packed particle and two packed event layers; no per-event objects | event-count and view tests |
| Temperature-derived wall appearance | Implemented | hot/cold wall styles follow boundary state | view command test |
| Speed distribution | Implemented | dedicated Chalkish plot canvas and curves | site/browser plot test |
| Translational/rotational temperature and collision histories | Implemented | application-owned bounded histories | site contract test |
| Velocity, pressure, temperature profiles and moment histories | Implemented | model-owned reusable profile buffers and bounded application histories | deterministic profile fixtures |
| Energy/momentum drift, `dx/lambda`, `dt/tau`, particles per cell | Implemented | one-line diagnostics | model and site tests |
| Majorant violations and explicit validity guidance | Implemented | ratio, health state, and corrective action are explicit | model regression |
| Scientific-clean versus chalk-particle display | Implemented | explicit style control changes particles and board strokes | view test and browser smoke |
| Pause, single step, reset, pan, zoom, view reset, fullscreen | Implemented | shared stage controls and viewport interactions | interaction tests; browser smoke pending |
| Quality mode, FPS/workload, keyboard controls, contextual help | Implemented | adaptive/manual quality, compact telemetry, shortcuts, and a dialog | notebook/phone browser smoke |

## Work orders

### A. Chalk material and transitions

1. Apply deterministic chalk material to grids, frames, curves, icons, and
   board-owned panels. Keep the surrounding course controls in the course
   design language.
2. Use one right-edge DSMC plot component with one frame and one Chalkish
   canvas. The heading is part of that component, not an overlay aligned by
   guessed coordinates.
3. Use short write/erase transitions for panel and label changes. Respect
   `prefers-reduced-motion`; transitions must not delay solver updates.
4. Add screenshot checks at notebook, phone, and fullscreen dimensions.

### B. Scientific and control parity

1. Add fixed replay fixtures for all eight presets before extending controls.
2. Restore model-backed controls already supported by the DG kernel: exact
   mesh, Mach number, radius, gamma, central flux, and steps per frame.
3. Restore DSMC boundary, rotational, seed, and display controls after their
   snapshot fields are explicit and testable.
4. Add teaching layers through existing generic Chalkish objects and
   application-owned histories. Do not move equations or diagnostics into the
   renderer.
5. Remove the legacy paths only after the P0 browser smoke and P1 scientific
   rows above are all implemented.

Completed in the replacement laboratories. The eight default cases have fixed
two-step replay checksums. Model-owned state remains DOM-free; histories,
telemetry, file download, and keyboard policy remain application-owned.
