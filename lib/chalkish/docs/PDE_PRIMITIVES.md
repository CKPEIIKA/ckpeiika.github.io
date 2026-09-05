# PDE scenes and numerical contracts

The production entry point is `src/index.js`. All modules run directly in the
browser. Node is only needed for development tests; no package installation or
build is required. Existing DSMC/DG/FV kernels are unchanged.

## Live plots

`SampledPlot` is a `Group`: it can be added to a `Scene`, positioned, faded, and
used with the existing animation primitives. It owns a small labeled frame and
one `CurveLayer` per curve. Data arrays remain caller-owned. Updating a plot
reuses packed buffers; it does **not** silently change the axis scales.

```js
import { Scene, SampledPlot, mount } from './lib/chalkish/src/index.js';

const x = Float32Array.of(-1, 0, 1);
const y = Float32Array.of(0, 1, 0);
const plot = new SampledPlot({
  xRange: [-1, 1], yRange: [-1.2, 1.2], title: 'u(x,t)',
});
plot.addCurve(x, y);
const scene = new Scene();
scene.add(plot);
const app = mount(document.querySelector('canvas'), {
  scene,
  fitBounds: { minX: -6, maxX: 5.5, minY: -2, maxY: 2.2 },
});
y[1] = 0.5;
plot.update();
app.render();
```

Use `point(x,y)` and `coordinates(worldX,worldY)` for probes in the plot's local
coordinate frame. `setRanges([xmin,xmax],[ymin,ymax])` explicitly changes the
scale. Coordinate arrays must be finite; split disconnected curves or shorten
their `CurveLayer` count rather than inserting NaNs. Curves are not automatically
clipped to the axes; the caller chooses ranges covering the displayed data.

`Camera2D.fitBounds(bounds,width,height,padding)` fits a rectangle at the viewport
aspect ratio, including a rotated camera. `mount({fitBounds,onResize})` reapplies
the fit after resizing. `onResize({width,height,camera})` can lay out graphs
before fitting. Physical 2-D domains keep their aspect ratio; graph axes can
stretch independently. Paused scenes redraw on resize too.

`TextLabel.font` and `maxWidth` are CSS-pixel quantities, **not world units**.
Do not pass a world-space width such as `maxWidth: 8` for a long equation.

## Kernel contracts

The `pde.js` functions mutate caller-owned Float32/Float64 buffers. They do not
know about canvases, language, DOM controls, or animation clocks. Parameters are
nondimensional in the lecture; the equations and boundaries are stated on each
board. These are teaching kernels, not experimental CFD validation cases.

| Kernel | Model and boundaries | Verification |
| --- | --- | --- |
| `diffuse1D` | Nodal `u_t=D u_xx` on `[-1,1]`; fixed values, outward normal derivatives, or paired periodic ends | Trapezoidal integral conservation; correct signs of both boundary inputs; sine decay |
| `advanceWave1D` | `u_tt=c(x)^2 u_xx`; fixed/free/outgoing ends. Constant tension, variable string density: continuous displacement and slope at the interface | Reflected versus transmitted pulse; stable evolution at maximum speed ratio |
| `affineCharacteristic` | Exact flow of `dx/dt=a+bx`; negative time gives the origin | Composition/inverse and zero-speed limit |
| `advanceScalar2D` | Limited linear reconstruction, SSP RK2; periodic scalar transport/diffusion. A solid mask selects insulated diffusion geometry | Constant-field preservation; periodic total under uniform transport |
| `advanceShallowWater` | Nonlinear conservative shallow water, flat bed, wet cells; local Lax–Friedrichs flux and reflective walls | Water-volume conservation; positive finite depth across the lecture presets |
| `projectPeriodic` | Backward divergence and forward gradient; their composition is the periodic Laplacian solved by conjugate gradients | Divergence residual and mean-velocity preservation |

The 2-D transport, projection, and water kernels use cell-centered grids over
`[-1,1] × [-0.6,0.6]`. Solid faces carry zero normal mass/heat flux. The Laplace
lesson uses a separate nodal grid, spacing-weighted relaxation, and fixed outer
values; it solves after an edit without displaying relaxation as physical time.

`projectPeriodic` returns a pressure **impulse** in its pressure buffer.
Divide by the elapsed physical time to obtain `p/rho`. A pointer impulse is
instantaneous; its displayed pressure field represents that correction impulse.
The lecture evolves **unsteady Stokes flow**, not full Navier–Stokes: no nonlinear
momentum advection. Uniform velocity is not artificially damped by viscosity.

The exact Euler solver remains in `lesson-models.js`. It uses ideal-gas
`gamma=1.4`, handles vacuum-forming expansion, and labels shocks, contacts, and
rarefaction edges. The time slider samples the self-similar solution directly.

## Teaching limits

- Fixed plot scales make decay visible. Parameter or initial-data changes may
  choose a new scale, but playback does not rescale it.
- Color keys give the displayed range. Chalk grain is a small, deterministic
  multiplicative change to rendering only; an exactly zero field stays zero.
- Scalar transport and shallow-water fronts have numerical smoothing. These
  displays do not establish convergence or resolve boundary layers.
- Geometry demonstrates **diffusion around insulated obstacles**. No synthetic
  velocity field is used to suggest physical wakes around arbitrary shapes.
- Classification compares a finite-interval steady solution with exact
  infinite-line heat/wave solutions. This difference in domains is stated on
  the board; they are not a single common boundary-value problem.
- The material-derivative example uses `sin(2π(x−s(t))/λ)`, with `s'=V`.
  The marked point re-enters at an equivalent wave period.
- The integral-law example uses linear `F(x)` and `u(x,0)=1+0.2x`.
  Moving/resizing the volume changes the integration region, not the PDE.
- Remaining features are tracked separately in the lecture roadmap. A card
  being accessible does not mean every original TODO interaction is complete.

## Reproduce the checks

From the site root:

```sh
node --test --test-concurrency=1 lib/chalkish/test/*.test.js test/*.test.js
python3 -m http.server 8000
```

Open `http://localhost:8000/test/pde-browser.html` for the browser rendering
checks. It renders all 72 non-microscope presets before and after evolution and
exercises characteristic probing. The microscope has separate numerical tests;
the gallery audit also opens it in Chromium.

The September 2026 visual audit used Chromium at 1366×768 and 390×844 under a
repository subpath. It checked all 19 cards, toolbar placement, mobile settings,
gallery return, manual Euler input, EN/RU state preservation, and both themes.
This is not a Safari/Firefox or real-device certification.

## Sources

- Ketcheson, LeVeque, del Razo, *Riemann Problems and Jupyter Solutions*:
  [Euler](https://www.clawpack.org/riemann_book/html/Euler.html),
  [shallow water](https://www.clawpack.org/riemann_book/html/Shallow_water.html),
  [acoustics and reflecting boundaries](https://www.clawpack.org/riemann_book/html/Acoustics.html).
- Diffusion boundary signs follow directly from
  `d/dt ∫u dx = D[u_x] = D(g_left+g_right)` when `g=∂u/∂n`.
- Affine characteristic flow follows by integrating `x'=a+bx`:
  `x(t)=x0 exp(bt)+a expm1(bt)/b`, with limit `x0+at`.
- Pressure compatibility is algebraic: `(backward div)(forward grad)` is
  exactly the five-point periodic Laplacian used in the solve.
