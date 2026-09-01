# PDE lecture modules

These modules teach the mathematical problem, not a numerical scheme. Visible
controls represent equations, coefficients, initial data, boundary data,
sources, or geometry. Grid size, timestep, CFL number, flux formula, scheme
order, solver tolerance, and discretization controls do not belong in this
lecture interface.

The course site presents the modules as a picture catalogue. A hash URL opens
one module in place, and a close button restores the catalogue without relying
on server-side routing.

## Shared shell

- [x] equation and one-sentence meaning remain visible;
- [x] responsive simulation/controls workspace;
- [x] one prompt states what the student should investigate;
- [x] standalone static route suitable for a GitHub Pages subpath;
- [x] light/dark site chrome around an inner chalkboard scene;
- [x] shared play, pause, restart, speed, preset, drawing, overlays, and reset
  controls, included only where the equation needs them.

## Modules

- [x] Derivative microscope: linked plots of `u`, `u_x`, and `u_xx`, including
  direct drawing and point probing.
- [x] One field, three PDEs: transport, diffusion, and wave evolution from the
  same initial condition.
- [x] Diffusion: gradients, flux `q = -D grad(u)`, boundary conditions, and the
  mean value of the field.
- [x] Boundary-condition laboratory: prescribed values, prescribed normal
  derivatives, and periodic boundaries.
- [x] Wave equation: finite propagation, displacement, velocity, reflection,
  interference, and heterogeneous wave speed.
- [x] Characteristics for `u_t + a(x)u_x = 0` and curved information paths.
- [x] Advection-diffusion: velocity fields, scalar initial data, overlays, and
  the ratio `Pe = UL/D`.
- [x] Gradient, divergence, and curl playground with moving tracers.
- [x] Material versus spatial derivative along a marked trajectory.
- [x] Conservation bookkeeping in a visible control volume.
- [x] Laplace equation with painted boundary values and global response.
- [x] Elliptic, parabolic, and hyperbolic behavior shown side by side.
- [x] Linear transport versus `u_t + u u_x = 0` with characteristics.
- [x] Exact one-dimensional Euler Riemann problem and named wave regions.
- [x] Coupled shallow-water fields `h`, `u`, and `v`.
- [x] Incompressibility, pressure response, and divergence visualization.
- [x] Advection-diffusion with local, pulsed, moving, and negative sources.
- [x] Geometry comparison with obstacles and channel constrictions.
- [x] Integral and differential conservation as the control volume shrinks.

## Fidelity follow-ups

The baseline catalogue is interactive. These narrower improvements remain:

- [ ] highlight the exact origin of a hovered characteristic;
- [ ] add the optional `x-t` history under the wave field;
- [ ] draw prescribed-value, prescribed-flux, and periodic boundary glyphs;
- [ ] add movable conductors and interior obstacles to the Laplace module;
- [ ] expose a brief tentative-velocity frame before pressure correction;
- [ ] make geometry obstacles draggable with the pointer;
- [ ] add point probes for numerical divergence and curl values.

Each increment should keep one pure model, one Chalkish view, one thin DOM
adapter, deterministic tests, and a browser screenshot check.

## Acceptance gate

Every completed module must satisfy all of these conditions:

- the equation is always visible;
- each control changes a mathematical or physical quantity;
- initial and boundary conditions are visually identifiable;
- the problem can be changed while it runs where evolution is present;
- three to five reproducible presets cover distinct behavior;
- one short prompt identifies the phenomenon to investigate;
- no numerical-method vocabulary is required to use the module;
- reset restores a canonical state;
- the page works as static files under a repository subpath;
- numerical invariants and edge cases have deterministic tests.
