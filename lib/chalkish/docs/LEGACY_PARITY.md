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
| Exact `Nx`, `Ny` entry | Missing | application-owned numeric controls | browser smoke required |
| CFL | Implemented | range control and model validation | model tests |
| Rusanov dissipation, including central limit `alpha = 0` | Partial | model accepts `0`; current UI starts at `0.5` | boundary-value UI test required |
| Solver steps per displayed frame | Missing | application loop policy; no renderer change | timing-independent controller test |
| Scalar initial conditions and velocity fields | Implemented | application controls feeding model reset | model tests |
| Square, wedge, cylinder, and no-body geometry | Partial | model supports all four; UI omits no-body | UI/model parity fixture |
| Editable Mach number, body radius, and gamma | Missing | model already accepts all three; add application controls | reset fixture for each parameter |
| Positivity, minmod, flattening, modal filtering | Implemented | limiter control | model tests |
| Density, pressure, Mach, speed, vorticity, entropy, field, mean, error, modal energy | Implemented | display-field control and packed scalar field | view tests |
| Solver-cell grid and stair-step body boundary | Implemented | `CartesianGrid`, `SegmentLayer` | command-stream tests |
| Chalk rendering on grid, frame, curves, and labels | Implemented | grids use two cheap rough batched passes; short layers may use the full deposit material | view style assertions and `cheap-chalk-grid-cached-redraw-514` benchmark |
| Wedge theta-beta-Mach reference | Missing | generic curve/line and annotation layers | fixed wedge comparison fixture |
| Freestream direction and characteristic arrows | Missing | generic arrow/segment layers | command-stream test |
| Cell means versus higher-order reconstruction | Missing | field plus reconstruction overlay | P0/P1/P2 comparison fixture |
| Burgers space-time history and modal spectrum | Missing | application-owned ring buffers feeding field/curves | deterministic history fixture |
| Jump, residual, and solid-mask displays | Partial | solid mask exists; jump and residual views are absent | display-range fixtures |
| Cd/Cl histories | Missing | diagnostics exist only for instantaneous drag | deterministic ring-buffer fixture |
| Positivity failure, limiter counts, fallback state | Partial | minima are shown; explicit state and corrective message absent | induced-failure regression |
| Pause, single step, reset, pan, zoom, view reset, fullscreen | Implemented | shared stage controls and viewport interactions | interaction tests; browser smoke pending |
| Quality mode, FPS/workload, keyboard controls, contextual help | Missing | application-owned controls and telemetry | notebook/phone browser smoke |

## DSMC laboratory

| Legacy capability | Status | Current mechanism or required work | Verification |
| --- | --- | --- | --- |
| Equilibrium, heat transfer, rotational nitrogen, Couette presets | Implemented | deterministic presets | model tests |
| Particle count, Knudsen number, collision-cell size, time step | Implemented | application controls feeding model reset | model validation tests |
| Hard-sphere, VHS, and VSS collisions | Implemented | collision-model control | deterministic solver parity tests |
| Explicit collision-cell occupancy and boundaries | Implemented | packed scalar field plus two-pass rough `CartesianGrid` | view tests and cached-redraw benchmark |
| Wall temperatures, wall speed, Maxwell accommodation | Implemented | wall controls | model tests |
| Species A/B selection and per-species non-color encoding | Missing | requires solver-owned species state before frontend wiring | mixture fixture and accessibility check |
| Periodic, specular, diffuse, and mixed boundary selection | Partial | presets configure boundaries; general boundary selector is absent | one fixture per boundary mode |
| Rotational relaxation control and collision number | Partial | rotational preset exists; live control is absent | equilibrium and relaxation fixtures |
| Explicit random seed, new seed, replay, export | Partial | deterministic seed exists but is fixed and hidden | replay checksum and export round trip |
| Particle, collision, and rotational-event highlights | Missing | packed segment/event layer exists; adapter data is absent | event-count command-stream test |
| Temperature-derived wall appearance | Implemented | hot/cold wall styles follow boundary state | view command test |
| Speed distribution | Implemented | dedicated Chalkish plot canvas and curves | site/browser plot test |
| Translational/rotational temperature and collision histories | Implemented | application-owned bounded histories | site contract test |
| Velocity, pressure, temperature profiles and moment histories | Missing | application-owned ring buffers feeding curves | deterministic profile fixtures |
| Energy/momentum drift, `dx/lambda`, `dt/tau`, particles per cell | Implemented | one-line diagnostics | model and site tests |
| Majorant violations and explicit validity guidance | Partial | model reports collision attempts; violation state and guidance absent | induced-majorant regression |
| Scientific-clean versus chalk-particle display | Missing | retain clean renderer mode as an explicit comparison control | visual regression required |
| Pause, single step, reset, pan, zoom, view reset, fullscreen | Implemented | shared stage controls and viewport interactions | interaction tests; browser smoke pending |
| Quality mode, FPS/workload, keyboard controls, contextual help | Missing | application-owned controls and telemetry | notebook/phone browser smoke |

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
