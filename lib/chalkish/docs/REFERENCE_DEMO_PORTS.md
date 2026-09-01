# Euler/DG and DSMC reference-demo ports

## Scope and ownership

The two standalone laboratories were reconstructed from user-provided source
under the adjacent site demo tree. That tree was read only; no personal source
file was edited. The original presentation files were studied for case
coverage, parameter defaults, equations, and limitations, but their neon
token-based HTML/CSS and monolithic application loops were not copied.

Three numerical source files were brought into this repository at the user's
direction and converted from browser globals to ES modules:

| Local module | Source role | Original SHA-256 |
| --- | --- | --- |
| `examples/boards/dg-fv-lab/dg-fv-lab-engine.js` | modal basis, fluxes, Euler operator, limiter, field sampling | `8ea16424cb737960b69dafebe8f1b11a24d6a4404bbebc7c0d3889ec821fcd9a` |
| `examples/boards/dsmc-lab/dsmc-lab-core.js` | species data, gas relations, collision and wall helpers | `0dc31795c07e02a3b7ae2de95dfa4a614b4951701987c7d48a4e826f57330c18` |
| `examples/boards/dsmc-lab/dsmc-lab-runtime.js` | seeded particle/cell SoA and NTC collision runtime | `8943a745170f88a21309cbf9f21e15232e83c0013ea4d99dd7c26ba4551ea260` |

No separate license header was present in those user-provided files. Their
same-owner inclusion is recorded here so the origin is not mistaken for an
unattributed third-party dependency.

## Architectural changes

The global exports were the only mechanical changes to the three engine files.
New model modules own configuration, integration, snapshots, replay data, and
diagnostics without importing rendering or UI code:

- `dg-fv-lab-model.js` owns the four DG/FV equation families;
- `dsmc-lab-model.js` owns the four spatial kinetic presets;
- the corresponding view modules bind model-owned typed arrays to one packed
  field, curve, occupancy field, particle cloud, Cartesian cell grid, or
  disconnected-segment boundary layer;
- the top-level page modules contain only controls, mounting, and textual
  diagnostics.

The original Euler worker was not imported. The compact board uses a bounded
main-thread mesh so it remains usable through the generated local-file
fallback. Chalkish now supplies a versioned newest-only snapshot bridge with
explicit buffer leases and stale-frame recycling. A DG-owned worker adapter
must bind that generic transport to the numerical model before larger meshes
are exposed.

Both laboratories use the same adaptive workbench contract: controls occupy a
scrollable left rail, one packed numerical stage owns the center, and textual
diagnostics occupy a ruled right rail. At narrow widths the diagnostics move
below the stage and the controls stack without changing model state. Playback,
grab, anchored zoom, view reset, and fullscreen remain shared example-layer
controls rather than solver concerns.

## DG/FV scientific boundary

The board implements:

- two-dimensional inviscid ideal-gas Euler with Rusanov flux, SSP-RK3,
  characteristic exterior states, and embedded Cartesian slip walls;
- periodic two-dimensional scalar advection with modal tensor-product DG;
- periodic one-dimensional inviscid Burgers with Rusanov flux;
- P0/FV through P3 for scalar equations and P0 through P2 for Euler;
- positivity, minmod/flattening, or modal-filter stabilization as applicable.

Automated checks cover deterministic replay, scalar cell-average mass, positive
limited Euler density/pressure, stable typed-array snapshots, and packed
rendering. The displayed grid uses `cellsX × cellsY`, not the higher-order
sampled field dimensions. The embedded-body outline is extracted directly from
the solver-owned cell mask, so an unresolved body is not replaced with a smooth
analytic drawing. The square is grid-aligned only for compatible meshes; the
wedge and cylinder are stair-step geometries. Euler drag is inviscid
pressure/numerical wave drag. The board is **verified**, not experimentally
validated.

## DSMC scientific boundary

The board implements:

- periodic equilibrium, thermal x-wall, rotational N₂, and Couette presets;
- cell-based no-time-counter elastic collisions;
- hard-sphere, VHS, and VSS collision choices;
- Maxwell mixed wall accommodation and moving diffuse Couette walls;
- optional rotational Larsen–Borgnakke energy exchange;
- deterministic seeds, replay state, occupancy, speed distribution, and
  validity diagnostics.

Automated checks cover bitwise seeded replay, closed periodic momentum and
energy, buffer ownership, model/view separation, all four preset paths, and a
visible Cartesian grid bound to the actual collision-cell dimensions.
Vibration, chemistry, reactions, physical out-of-plane geometry, uncertainty
estimation, and configuration-matched benchmark data are absent. The board is
**verified**, not validated.
