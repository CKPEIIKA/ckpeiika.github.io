# Lecture 6 · Numerical fluxes and Riemann solvers

A bilingual RU/EN companion to [lecture 5](../pde-lecture-5/), using the same Chalkish library, gallery, controls, typography and chalkboard rendering. Fourteen interactive experiments compare nine explicitly defined Euler fluxes. All numerical profiles are computed locally from the selected states and parameters.

## Run locally

The static entrypoint is **`demos/pde-lecture-6/index.html`**, relative to the served site root. From the repository root:

```sh
./preview.sh
```

Open `http://localhost:4000/demos/pde-lecture-6/`. JavaScript modules require HTTP serving. To check a repository subpath, run `./preview.sh 4000 /foo` and open `http://localhost:4000/foo/demos/pde-lecture-6/`.

Paths retain the existing course repository layout:

| Path under the served root | Responsibility |
| --- | --- |
| `demos/pde-lecture-6/src/catalog.js` | RU/EN learning questions, parameters, presets, formulas and source links |
| `demos/pde-lecture-6/src/euler.js` | Nine numerical fluxes, exact 1D Riemann solver and first-order integrator |
| `demos/pde-lecture-6/src/shock2d.js` | Actual two-dimensional stationary-shock computation |
| `demos/pde-lecture-6/src/labs.js` | Experiment models, shared-time comparisons, measured plots and comparison rows |
| `demos/pde-lecture-6/src/app.js` | Gallery setup (catalogue pictures are computed by the shared thumbnail worker) |
| `demos/pde-gallery/` | Shared gallery and board adapter, including Chalkish scalar-field rendering |
| `lib/chalkish/src/` | Chalkish scene, rendering, math and field components |
| `demos/*.js`, `demos/shell.css`, `assets/fonts/` | Existing shared shell, theme, language controls and local fonts |

The lecture uses the course's shared gallery and Chalkish library. The board adapter adds `Ink.field()` using the existing `ScalarField`; the gallery and Chalkish core remain shared. Parameter restoration comes from the shared gallery. The lecture folder does not duplicate those shared assets.

The gallery supports play/pause, one common time step, reset, parameter presets, RU/EN, theme switching and fullscreen. Catalogue pictures are drawn from each experiment's own model at its default state by the shared thumbnail worker; opening an experiment creates a live model.

## Fourteen experiments

| ID | Purpose |
| --- | --- |
| `wave-models` | Compare the approximate Roe, HLL, HLLC and HLLE wave fans; distinguish a retained contact from one averaged middle state |
| `interface-flux` | Evaluate all nine mass, momentum and energy fluxes on the same two states; test consistency and contact diffusion |
| `sod` | Compare rarefaction, contact and shock against the exact Euler Riemann solution |
| `contact` | Separate stationary-contact preservation from errors in moving-contact advection |
| `transonic` | Expose Roe's entropy-violating expansion jump and the effect of acoustic entropy smoothing |
| `double-rarefaction` | Show loss of positive pressure without hiding a failed method |
| `hll-speeds` | Compare Davis and Einfeldt outer speeds and the resulting HLL intermediate states |
| `flux-splitting` | Inspect the positive and negative Steger–Warming and van Leer flux contributions |
| `ausm-split` | Inspect Mach and pressure polynomials, donor selection and the velocity-pressure coupling term |
| `low-mach` | Measure local momentum-flux dissipation divided by the inertial scale `M²` |
| `shu-osher` | Compare diffusion of shock–entropy interaction structures at `N` and `2N` |
| `strong-shock` | Compare front position, narrow density peaks and admissibility across a large pressure ratio |
| `carbuncle` | Evolve a seeded stationary planar shock in 2D and measure transverse growth and front distortion |
| `comparison` | Run a selected pair or all nine fluxes on any of the eight 1D initial-value problems |

Suggested teaching route: interface consistency → stationary contact → Sod → transonic entropy → double rarefaction → splitting diagrams → low Mach → Shu–Osher → strong shock → two-dimensional instability. Use the final comparison lab to test whether a preferred method's advantage survives a change of problem.

## Common numerical method

The gas is calorically perfect with `γ=1.4`. The conservative state includes transverse momentum even in 1D:

\[
U=(\rho,\rho u,\rho v,E)^T,\qquad
p=(\gamma-1)\left[E-\frac{\rho}{2}(u^2+v^2)\right],\qquad
H=(E+p)/\rho.
\]

All displayed evolutions use piecewise-constant reconstruction and forward Euler:

\[
\bar U_i^{n+1}=\bar U_i^n-
\frac{\Delta t}{\Delta x}(F_{i+1/2}-F_{i-1/2}).
\]

There is one shared numerical flux per face. The 2D update uses the unsplit sum of the x and y flux divergences; transverse faces rotate the state before calling the same flux routines. Compared runs share their grid, initial data, parameters and accepted physical times. Each common step uses the most restrictive acoustic rate among the active runs.

The gallery runs in **strict mode**. A nonfinite state, `ρ≤0` or `p≤0` stops that method and reports the attempted failure time. Its last accepted state remains available internally, but its failed curve is excluded from the common-time comparison. There is no clipping, automatic time-step retry or hidden flux replacement in the displayed experiments. The standalone `Euler1D` API also contains an explicit, counted `safety:'hlle'` research option; the gallery does not enable it.

## Exact meanings of the nine method names

| Method ID | Implemented definition | Primary reference |
| --- | --- | --- |
| `roe` | Square-root-density Roe averages; absolute eigenvalues without an entropy correction | [Roe, 1981](https://doi.org/10.1016/0021-9991(81)90128-5) |
| `roe-entropy` | The same flux with Harten quadratic smoothing applied only to the two acoustic eigenvalues | [Harten, 1983](https://doi.org/10.1016/0021-9991(83)90136-5) |
| `hll` | Two-wave HLL flux with Davis endpoint wave-speed bounds | [Harten, Lax & van Leer, 1983](https://doi.org/10.1137/1025002); [Davis, 1988](https://doi.org/10.1137/0909030) |
| `hllc` | Contact-restoring HLLC with the same Davis outer speeds, without a shock sensor or positivity fallback | [Toro, Spruce & Speares, 1994](https://doi.org/10.1007/BF01414629) |
| `hlle` | Two-wave HLL flux with Einfeldt/Roe bounds | [Einfeldt, 1988](https://doi.org/10.1137/0725021) |
| `vanleer` | Original van Leer Euler flux-vector splitting, including its original energy polynomial | [van Leer, 1982](https://doi.org/10.1007/3-540-11948-5_66) |
| `steger-warming` | Original eigenvalue flux-vector splitting with unsmoothed positive/negative parts | [Steger & Warming, 1981](https://doi.org/10.1016/0021-9991(81)90210-2) |
| `ausm` | Original Liou–Steffen AUSM: local sound speeds on the two sides, quadratic Mach splitting and cubic pressure splitting | [Liou & Steffen, 1993](https://doi.org/10.1006/jcph.1993.1122); [full NASA memorandum](https://ntrs.nasa.gov/citations/19910013501) |
| `ausm-up` | Liou AUSM+up with one critical interface sound speed, fourth/fifth-order splitting polynomials and pressure/velocity coupling | [Liou, 2006](https://doi.org/10.1016/j.jcp.2005.09.020); [official SU2 implementation cross-check](https://github.com/su2code/SU2/blob/master/SU2_CFD/src/numerics/flow/convection/ausm_slau.cpp) |

### Roe and its entropy modification

The Roe velocity and enthalpy are weighted by `√ρ`; `ã²=(γ−1)[H̃−(ũ²+ṽ²)/2]`. The flux is the arithmetic physical-flux average minus half the characteristic dissipation. For `roe-entropy`, replace the acoustic absolute values by

\[
\psi_\delta(\lambda)=
\begin{cases}|\lambda|,&|\lambda|\ge\delta,\\
(\lambda^2+\delta^2)/(2\delta),&|\lambda|<\delta,
\end{cases}
\qquad \delta=\epsilon\tilde a.
\]

The contact and shear waves retain `|ũ|`. Setting `ε=0` recovers unmodified Roe. This is the page's explicit interpretation of “modified Roe”; it is not the full Harten–Hyman procedure, a positivity repair or a general shock-instability cure.

### HLL, HLLE and HLLC

For `S_L<0<S_R`, both two-wave methods use

\[
F_{HLL}=\frac{S_RF_L-S_LF_R+S_LS_R(U_R-U_L)}{S_R-S_L}.
\]

The supersonic branches return `F_L` or `F_R`. HLL–Davis uses
`S_L=min(u_L−a_L,u_R−a_R)` and `S_R=max(u_L+a_L,u_R+a_R)`.
HLLE–Einfeldt uses
`S_L=min(u_L−a_L,ũ−ã)` and `S_R=max(u_R+a_R,ũ+ã)`.
Thus HLL and HLLE are a disclosed choice of wave bounds within the same template, rather than unrelated flux formulas. The latter bounds also match the [Clawpack Euler implementation](https://www.clawpack.org/riemann_book/html/Euler_approximate.html).

HLLC adds the middle speed

\[
S_*=rac{p_R-p_L+\rho_Lu_L(S_L-u_L)-\rho_Ru_R(S_R-u_R)}
{\rho_L(S_L-u_L)-\rho_R(S_R-u_R)},
\]

and constructs the two star states from Rankine–Hugoniot relations. The wave-model diagram uses this implemented estimate, not the exact Riemann contact speed.

### Flux-vector splitting

Steger–Warming computes `F±=RΛ±R⁻¹U` on each side with
`λ±=(λ±|λ|)/2`, then combines `F⁺(U_L)+F⁻(U_R)`.
For van Leer, let `s=±1`, `M=u/a` and, for `|M|<1`,

\[
m^s=s\rho a(M+s)^2/4,\qquad z_s=(\gamma-1)u+2sa,
\]
\[
F^s=m^s\left(1,\frac{z_s}{\gamma},v,
\frac{z_s^2}{2(\gamma^2-1)}+\frac{v^2}{2}\right)^T.
\]

Both use the physical one-sided flux in the supersonic limits. This van Leer method is neither the slope limiter from lecture 5 nor the Hänel energy variant.

### AUSM and AUSM+up

Original AUSM sets `M_L=u_L/a_L`, `M_R=u_R/a_R` and
`M_f=M₂⁺(M_L)+M₂⁻(M_R)`. For `|M|<1`,
`M₂±=±(M±1)²/4` and `P₃±=(M±1)²(2∓M)/4`.
The convective flux is `M_f(ρa)[1,u,v,H]` from the donor selected by the sign of `M_f`; interface pressure is `P₃⁺p_L+P₃⁻p_R`.

For AUSM+up,

\[
a_{*,K}^2=\frac{2(\gamma-1)}{\gamma+1}H_K,\qquad
a_f=\min\left(\frac{a_{*,L}^2}{\max(a_{*,L},u_L)},
\frac{a_{*,R}^2}{\max(a_{*,R},-u_R)}\right).
\]

Both Mach numbers use `a_f`. Define `M̄²=(M_L²+M_R²)/2`,
`M₀²=min(1,max(M̄²,Mref²))`, `f_a=M₀(2−M₀)`,
`β=1/8`, `α=3(−4+5f_a²)/16`, `K_p=1/4`, `K_u=3/4`, `σ=1`.
In the subsonic interval,
`M₄±=M₂±±β(M²−1)²` and
`P₅±=P₃±±αM(M²−1)²`.
Their supersonic branches are the usual signed Mach and pressure switches. With `ρ_f=(ρ_L+ρ_R)/2`, the extra terms are

\[
M_p=-\frac{K_p}{f_a}\max(1-\sigma\bar M^2,0)
\frac{p_R-p_L}{\rho_fa_f^2},\qquad
P_u=-K_uf_aP_5^+(M_L)P_5^-(M_R)(\rho_L+\rho_R)a_f(u_R-u_L).
\]

Then `M_f=M₄⁺+M₄⁻+M_p`, `ṁ=a_f M_f ρ_donor`,
`p_f=P₅⁺p_L+P₅⁻p_R+P_u`, and
`F=ṁ[1,u,v,H]_donor+[0,p_f,0,0]`.
The polynomial lab normalizes coefficients to illustrate this algebra; use the interface-flux lab for a complete flux evaluation from thermodynamic states.

The compressible presets explicitly use `Mref=1`. The slow-advection preset uses `Mref=.01` and a shared `CFL=.05`; the pressure correction becomes stiff in an explicit update as the reference Mach decreases. A low reference Mach should not be silently imposed on a zero-velocity shock-tube discontinuity.

## Reproducible initial data

Primitive tuples below are `(ρ,u,p)`; `v=0`. Except where stated, the domain is `[0,1]`, the discontinuity is at `x=.5`, and the boundaries extrapolate the interior state.

| Case | Initial data | Final time |
| --- | --- | --- |
| Sod | Left `(1,0,1)`, right `(.125,0,.1)` | `.2` |
| Stationary contact | Left `(1,0,1)`, right `(.125,0,1)` | `.25` |
| Moving contact | Same density/pressure jump, `u=.8`, initial location `.3` | `.3` |
| Transonic expansion | Reverse the two states of a stationary normal shock with upstream `(ρ,p)=(1,1)` and `M=1.5`; downstream state on the left | `.3` |
| Double rarefaction | Left `(1,−2,.4)`, right `(1,2,.4)` | `.15` |
| Shu–Osher | Domain `[−5,5]`; left of `−4`: `(3.857143,2.629369,10.333333)`; right: `(1+.2sin(5x),0,1)` | `1.8` |
| Strong pressure jump | Left `(1,0,1000)`, right `(1,0,.01)` | `.012` |
| Slow entropy advection | Periodic `[0,1]`; `ρ=1+.2sin(2πx)`, `u=.02`, `p=1/γ` | `5` |

The double-rarefaction solution has positive star values `p*=.00189387342005` and `ρ*=.0218521182068`; this test does not contain an exact vacuum. The exact solver also handles genuinely vacuum-producing input separately. The Shu–Osher data follow the [NASA workshop specification](https://turbmodels.larc.nasa.gov/Highfidelitycfd2021/UnsteadySupHypersonic_Shu-Osher_HFW_2021.pdf).

Exact Riemann profiles and the exact advected entropy wave are sampled at cell centers. The displayed density error is a mean absolute difference at those centers, not an integral against exact cell averages. Shu–Osher has no analytic reference curve in this page. Initial smooth data are also sampled at cell centers.

## The two-dimensional shock experiment

The default uses `96×32` square cells, `M₁=6`, a shock at the grid face nearest `x=.4`, seed amplitude `.001`, `CFL=.3` and final nondimensional time `3`. The domain is `[0,1]×[0,1/3]`. Normalize upstream `ρ₁=u₁=1` and `p₁=1/(γM₁²)`; downstream states satisfy the normal-shock Rankine–Hugoniot relations.

A localized alternating transverse velocity is assigned once in four columns around the front:

\[
v_j/u_1=\epsilon(-1)^{j-\lfloor n_y/2\rfloor}
\exp\left[-\left(\frac{j-(n_y-1)/2}{0.1n_y}\right)^2\right].
\]

Added transverse kinetic energy preserves the initial pressure. The subsequent evolution is computed from Euler fluxes. Boundaries are periodic in `y`, prescribed supersonic inflow at the left, and prescribed downstream pressure with extrapolated density and velocity at the right.

The board shows the front ripple (the RMS displacement of the midpoint-density front in cell widths) and the history of `RMS(v)`; the cards under it report `RMS(v)` and elapsed time. Both panels use one color scale. Setting the seed to zero tests whether an initially planar state stays planar.

This is an educational stationary-shock variant in the carbuncle family, informed by [stationary thin-shock studies](https://arxiv.org/abs/1803.04954) and [Quirk's solver analysis](https://ntrs.nasa.gov/citations/19930015894). It is not the cylinder bow-shock geometry or Quirk's original perturbed-grid experiment. The measured result depends on wave-speed choices, grid, outlet, seed and final time. In particular, do not infer universal HLLE immunity or universal HLLC failure from one finite-grid run.

## Validation and limitations

From the project root:

```sh
npm test
```

The first command checks flux consistency for all nine methods, exact Riemann values, contact/shear resolution, conservative boundary-flux budgets, positive Sod evolution, explicit rarefaction failure, every gallery preset, shared-time comparisons and parameter restoration. The same command also checks 2D normal-shock balance, uniform states, zero-seed planarity, pressure-preserving initialization, strict failure, measured instability growth and a second grid.

To regenerate the detailed 2D validation JSON and field snapshots:

```sh
SHOCK2D_RECORD=1 node --test tests/pde-lecture-6-shock2d.test.mjs
```

The recorded all-method 2D test uses `CFL=.35`; the gallery defaults to `.3`. Always read the stored options before comparing numerical values.

These experiments isolate flux differences within a first-order method. They do not rank full production solvers with higher-order reconstruction, time integration, shock sensors, positivity limiters or all-speed preconditioning. Stationary-contact preservation does not imply exact moving-contact advection. An entropy fix does not imply positivity. The local low-Mach dissipation test and periodic entropy transport do not establish vortex preservation or acoustic accuracy.

Numerical/model validation and rendered board inspection are distinct from native browser interaction checks. Check interactive desktop and phone behavior in the target browser before classroom use.
