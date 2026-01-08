---
layout: default
title: Обзоры статей
nav_label: "📚 Обзоры статей"
---

Здесь будут краткие обзоры интересных статей по газовой динамике, кинетике и ML.

## 📄 Обзор статей

## Валидация высокоскоростной газовой динамики

---

### 1. Slender Cone Drag (Ballistic Ranges)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Deiwert et al. (1989) - Slender Cone Drag Experiments |
| **Source/DOI** | [NASA NTRS: 19880011504](https://ntrs.nasa.gov/citations/19880011504) |
| **IC/BC/Chem** | **Flow:** Mach 15, $Re=0.4 \times 10^6$; **Chem:** Real gas air ($O_2, N_2$ dissociation); **BC:** Free-flight, adiabatic/cold wall |
| **Domain** | 3D Sharp Cones (5° and 10° half-angles); **Res:** N/A (Flight path stations) |
| **Method** | **Exp:** HFFAF / PBR; Spark shadowgraphs (16-24 stations); **Sim:** PNS (Parabolized Navier-Stokes) |
| **Validation** | **Plots:** $C_D$ vs. $\alpha$ (AoA); **Metrics:** Shock angles, Skin friction ($\approx 40\%$ total drag) |

---

### 2. Oblique Detonation Wave Engine (ODWE)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Deiwert et al. (1989) - ODWE NASA TM-100093 |
| **Source/DOI** | [NASA NTRS: 19880011504](https://ntrs.nasa.gov/citations/19880011504) |
| **IC/BC/Chem** | **Flow:** Mach 4.6, $P=0.015-0.079\text{ atm}$, $T=641-841\text{ K}$; **Chem:** $H_2$-Air finite-rate kinetics; **BC:** Water-cooled 30° wedge |
| **Domain** | 2D Wedge in supersonic stream; **Res:** N/A |
| **Method** | **Exp:** 20-MW Arc-jet; Schlieren, P/T transducers; **Sim:** 1D steady & 2D viscous shock-capturing |
| **Validation** | **Plots:** $T(K)$ vs. Distance (cm); **Metrics:** Ignition delay, Detonation distance ($\approx 5\text{ cm}$ normal to shock) |

---

### 3. Electric Arc Shock Tube (EAST) - Species & Radiation

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Deiwert et al. (1989) - EAST Species & Radiation |
| **Source/DOI** | [NASA NTRS: 19880011504](https://ntrs.nasa.gov/citations/19880011504) |
| **IC/BC/Chem** | **Flow:** $U_s = 4-40\text{ km/s}$, $P_1 = 0.1-3\text{ Torr}$; **Chem:** 11-species air model; **BC:** 1D Shock |
| **Domain** | 1D Shock Tube; $D=10/60\text{ cm}$, $L=12/21\text{ m}$ |
| **Method** | **Exp:** NASA Ames EAST; UV/Emission spectroscopy (1100–9000 Å); Gated diode arrays |
| **Validation** | **Plots:** Intensity ($W/cm^3 \cdot \mu \cdot sr$) vs. $\lambda$, $U_s$ vs. $P_1$; **Metrics:** $n_i$ (ground state), $T_{vib}$ |

---

### 4. RAM-C II Flight Probe Validation

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Deiwert et al. (1989) - RAM-C II Validation |
| **Source/DOI** | [DOI: 10.2514/6.1981-1144](https://doi.org/10.2514/6.1981-1144) |
| **IC/BC/Chem** | **Flow:** $U=7650\text{ m/s}$, Alt: 61, 71, 81 km; **Chem:** 5 & 7-species air models; **BC:** $T_w=1500\text{ K}$, Non-catalytic |
| **Domain** | 2D Sphere-cone ($r_n=0.1524\text{ m}$, 9° half-angle); **Mesh:** $35 \times 50$ (axial x normal) |
| **Method** | **Exp:** RAM-C II Flight; Microwave reflectometers; **Sim:** Shock-capturing CFD (Nonequilibrium) |
| **Validation** | **Plots:** $N_e$ (Peak) vs. $x/r_n$, $N_e$ vs. $\eta/r_n$; **Metrics:** Electron recombination, Wall heat flux |

---

### 5. High-Velocity Flight Radiometry (Fire 2 & PAET)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Deiwert et al. (1989) - Fire 2 & PAET |
| **Source/DOI** | [NASA NTRS: 19670014316](https://ntrs.nasa.gov/citations/19670014316) |
| **IC/BC/Chem** | **Flow:** $U=10-11.4\text{ km/s}$; **Chem:** 11-species ionizing air; **Two-temp model**; **BC:** Stagnation point |
| **Domain** | 3D Spherical nose / Blunt body; $20.9\text{ cm}$ shock-layer depth |
| **Method** | **Exp:** Project Fire 2/PAET Flight; Radiometers; **Sim:** Park’s two-temperature model |
| **Validation** | **Plots:** $q_r$ vs. Time/Altitude, Intensity vs. Time; **Metrics:** Continuum color $T$ (7,000–8,000 K) |

---

### 6. 3.5-Foot Hypersonic Wind Tunnel (HWT)

| Feature        | Technical Specifications                                                                                               |
| :---           | :---                                                                                                                   |
| **Article**    | Deiwert et al. (1989) - 3.5-Foot HWT TAV Validation                                                                    |
| **Source/DOI** | [NASA NTRS: 19880011504](https://ntrs.nasa.gov/citations/19880011504)                                                  |
| **IC/BC/Chem** | **Flow:** Mach 5-14, $Re_L=1-25 \times 10^6$; **Chem:** Perfect gas air (heated); **BC:** Wall P/q; Sting-mount        |
| **Domain**     | 3D All-body TAV (75° delta, elliptic cross-section); $L=3\text{ ft}$                                                   |
| **Method**     | **Exp:** NASA Ames 3.5-ft HWT; LDV, Pitot, Oil flow; **Sim:** N/A (Experimental Baseline)                              |
| **Validation** | **Plots:** Surface P & Heat transfer vs. position; **Metrics:** BL transition, Separation points ($\alpha=0-15^\circ$) |

### 7. EAST Shock-Tube Radiation (New Air Model)

| Feature        | Technical Specifications                                                                                                                                                                                              |
| :---           | :---                                                                                                                                                                                                                  |
| **Article**    | Johnston, C.O. (2008) - A Comparison of EAST Measurements with a New Air Radiation Model                                                                                                                              |
| **Source/DOI** | [DOI: 10.2514/6.2008-1447](https://doi.org/10.2514/6.2008-1447)                                                                                                                                                       |
| **IC/BC/Chem** | **Flow:** $U_s = 9.165–10.34 \text{ km/s}$, $P_1 = 0.1, 0.3 \text{ Torr}$; **Chem:** 11-species air; **Thermo:** Two-temperature nonequilibrium ($T_{tr}, T_{ve}$); **BC:** 1D shock-tube flow ($x=10.16 \text{ cm}$) |
| **Domain**     | 1D shock-tube (modeled as stagnation line of 5 m sphere); **Res:** Spatial smearing $\Delta z_s = 0.078–0.98 \text{ cm}$; Spectral slit width $\Delta\lambda_T = 0.8–2.0 \text{ nm}$                                  |
| **Method**     | **Sim:** LAURA (Navier-Stokes) + HARA (Radiation); Non-Boltzmann population modeling; **Exp:** NASA Ames EAST; Wavelength range 200–1300 nm                                                                           |
| **Validation** | **Plots:** $J_\lambda$ vs. $\lambda$; Integrated Intensity $J_c$ vs. $z$; $N_i$ & $T$ vs. $z$; **Tables:** Shot conditions, Atomic multiplet data ($f_{ij}$, $S_{0,0}$), Integrated intensity components              |

### 8. Orion-Class Air Radiation (VUV to IR)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Bose et al. (2010) - Comparisons of Air Radiation Model with Shock Tube Measurements |
| **Source/DOI** | [NASA NTRS: 20110002167](https://ntrs.nasa.gov/citations/20110002167) / NASA/TM—2010-216391 |
| **IC/BC/Chem** | **Flow:** U_s = 9.5–11.0 km/s, P_1 = 0.2, 0.3, 0.7 Torr; **Chem:** Equilibrium air + 8-12% Carbon impurities; **BC:** 1D Line-of-sight |
| **Domain** | 1D Post-shock region; **Path Length:** 10.16 cm; **Res:** Steady-state temporal averaging |
| **Method** | **Sim:** NEQAIR (Line-by-line), Park’s QSS master equations; **Exp:** NASA Ames EAST; ICCD Imaging Spectrographs (115–1400 nm) |
| **Validation** | **Plots:** Spectral Intensity (9 ranges: VUV to IR), Integrated Intensity vs. Time; **Metrics:** VUV contribution (~40% total), Nonequilibrium zone (2-3 cm) |

### 9. Superorbital Expanding Flow (X2 Tunnel)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Han et al. (2017) - Air Radiation in Superorbital Expanding Flow |
| **Source/DOI** | [DOI: 10.2514/6.2017-0988](https://doi.org/10.2514/6.2017-0988) |
| **IC/BC/Chem** | **Flow:** $U = 9.7-11.8$ km/s, $H_{total} = 50-75$ MJ/kg; **Chem:** 11-species air (Park 1993); **Thermo:** $T_{control} = T_{tr}^{0.7}T_{ve}^{0.3}$; **BC:** Non-slip wall $T=298.15$ K, supersonic inflow |
| **Domain** | 2D Wedge ($54^\circ$ ramp corner); **Width:** 25 mm; **Mesh:** Multi-block structured, 196,299 cells |
| **Method** | **Sim:** Eilmer3 (Navier-Stokes) + NEQAIR v14 (Non-Boltzmann); **Exp:** X2 free-piston expansion tunnel; VUV Spectrometer (118-180 nm) & NIR imaging (777 nm) |
| **Validation** | **Plots:** Spectral Radiance vs. $\lambda$ (VUV); Integrated Radiance vs. distance (149 nm, 174 nm, 777 nm lines); **Tables:** Shock speeds, Inflow properties, Mole fractions |

### 10. Titan Atmospheric Entry (NASA EAST Test 61)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Brandis, A. M., and Cruden, B. A. (2017) - Titan Atmospheric Entry Radiative Heating |
| **Source/DOI** | [DOI: 10.2514/6.2017-3843](https://doi.org/10.2514/6.2017-3843) |
| **IC/BC/Chem** | **Flow:** $U_s = 4.7-8$ km/s, $P_1 = 13.3-62.5$ Pa; **Chem:** 21-species Titan gas ($N_2, CH_4, Ar$ and derivatives); **BC:** 1D Shock-tube (Exp) / 3m sphere stagnation line (Sim) |
| **Domain** | **Exp:** 10.16 cm diameter tube; **Sim:** 2D axis-symmetric sphere; **Res:** 805 grid points (stagnation line refinement) |
| **Method** | **Sim:** DPLR v4.0.4 + NEQAIR v15.0 ($T_{tr}-T_{ev}$ model, CN QSS); **Exp:** NASA Ames EAST; 4 gated ICCD spectrometers (190–1450 nm) |
| **Validation** | **Plots:** Radiance vs. Velocity (VUV to IR), Radiance Profiles vs. distance, Spectral Radiance (CN Violet/Red); **Metrics:** CN Violet > 60% of total radiance |

### 11. Quasi-1D Shock Tube Modeling (HEGEL)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Sharma et al. (2019) - One-dimensional modeling methodology for shock tubes |
| **Source/DOI** | [NASA NTRS: 20190002004](https://ntrs.nasa.gov/citations/20190002004) |
| **IC/BC/Chem** | **Flow:** $P_1 = 26.6 \text{ Pa}$, $T_1 = 300 \text{ K}$, $U_s = 9.5-11.0 \text{ km/s}$; **Chem:** 11-species air + He driver; **BC:** Quasi-1D area source term $\epsilon = \frac{1}{A} \frac{\partial A}{\partial x}$ to model BL growth |
| **Domain** | Quasi-1D; $R = 5 \text{ cm}$, $L = 8.25 \text{ m}$; **Mesh:** $\Delta x = 0.2-1.0 \text{ mm}$, $\Delta t = 0.05-0.1 \text{ ns}$ |
| **Method** | **Sim:** HEGEL (PETSC-based) + PLATO library; NEQAIR radiation; **Exp:** NASA Ames EAST; Piezoelectric transducers, 4-band spectrometers |
| **Validation** | **Plots:** X-T diagram, Velocity vs. $x$, Mole fractions vs. $x$, Spectral radiance vs. $x$ (VUV/UV/Red/IR); **Metrics:** $\delta \approx 14 \text{ mm}$ (BL thickness) |

### 12. Unsteady vs. Steady Shock Tube Modeling (COOLFluiD)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Bensassi et al. (2019) - Computational Modeling for Non-equilibrium Shock Tube Flows |
| **Source/DOI** | [NASA NTRS: 20190028644](https://ntrs.nasa.gov/citations/20190028644) |
| **IC/BC/Chem** | **Driver:** $T=6000\text{ K}, P=12.7\text{ MPa}$ (He/N2); **Test Gas:** $T=300\text{ K}, P=26.77\text{ Pa}$ (Air); **Chem:** 11-species Park; **Thermo:** Landau-Teller / Millikan-White |
| **Domain** | **Unsteady:** 2D 8 m tube; **Stagnation:** 3 m radius cylinder; **Steady:** 0.3 m tube; **Res:** $\Delta x = 1\text{ mm}$ (uniform) |
| **Method** | **Sim:** COOLFluiD (AUSM+-UP, 2nd order, Venkatakrishnan limiter); PLATO library; NEQAIR; **Physics:** Comparing Unsteady vs. Local Steady-State vs. Stagnation-Line |
| **Validation** | **Plots:** $T, T_{ve}$ vs. Distance; Species densities ($N, O, e^-, N_2, N_2^+, NO$) vs. Distance; Total Radiance vs. Distance (viscous vs. inviscid) |
| **Key Metrics** | **Equiv. T:** $9992\text{ K}$ (Inviscid) vs $9509\text{ K}$ (Viscous); **Equilibrium dist:** Steady $\approx 2.5\text{ cm}$, Unsteady (viscous) $\approx 1\text{ cm}$ |

### 13. Hypersonic Boundary Layer Stability (JAXA-HIEST)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Tanno et al. (2011/2012) - Surface pressure fluctuation in hypersonic boundary layer |
| **Source/DOI** | [JAXA Repository (FY2010 Campaign)](https://jaxa.repo.nii.ac.jp/) |
| **IC/BC/Chem** | **Flow:** $U = 2137–4257$ m/s, $H_0 = 2.5–11.0$ MJ/kg; **Chem:** Air ($O_2$ dissoc.) and Pure $N_2$; **BC:** 7° half-angle cone, No-slip, Isothermal |
| **Domain** | 2D Axisymmetric sharp cone; **Dims:** $L=1100$ mm, $R_{nose}=2.5$ mm; **Sensors:** 40 mm (Pressure) / 20 mm (Temp) intervals |
| **Method** | **Exp:** JAXA-HIEST Free-piston shock tunnel; **Diagnostics:** PCB132 transducers ($\geq 1$ MHz), Coaxial thermocouples; **Analysis:** FFT/PSD for 2nd mode instability |
| **Validation** | **Plots:** $St$ vs. $Re$ (Transition), PSD vs. Frequency (Instability identification), Frequency vs. $Re$ contours; **Tables:** 17 shots with full freestream $P, H, \rho, U, M, \gamma$ |
| **Key Metrics** | **2nd Mode:** $300–600$ kHz; **Transition Re:** $2\times 10^6$ to $6\times 10^6$; **Real Gas:** No major air/$N_2$ transition delta observed |

### 14. Pitot Pressure Correction in Non-equilibrium Flow (T6 Stalker)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Sopek et al. (2024) - Effect of non-equilibrium thermochemistry on Pitot pressure |
| **Source/DOI** | [arXiv:2403.06411v1](https://arxiv.org/abs/2403.06411) |
| **IC/BC/Chem** | **Stagnation:** $25.5\text{ MPa}, 2390\text{ K}, 2.67\text{ MJ/kg}$; **Chem:** 5-species air (Gupta/Park models); **BC:** Nozzle wall $T=300\text{ K}$, uniform inflow M=1 at throat |
| **Domain** | 2D Axisymmetric Mach 7 nozzle + Blunt Pitot probe ($r=1.5\text{ mm}$); **Mesh:** $600 \times 80$ (nozzle), $150k$ cells (probe), clustered at throat/wall |
| **Method** | **Sim:** Eilmer (RANS); $k-\omega$ (Wilcox); Pseudo-space-marching; **Exp:** Oxford T6 Stalker (RST mode); Pitot pressure measurements |
| **Validation** | **Plots:** Pitot Pressure vs. Radial distance; Grid convergence; Coefficient $C$ vs. $T$; **Tables:** $C$ for different models ($C_{eq}, C_{chem}, C_{thermo}$), freestream property discrepancies |
| **Key Metrics** | **Mach:** $\approx 7.1$; **BL Transition:** $377–380\text{ mm}$ post-throat; **Result:** $C \approx 0.94$ for $H > 2.6\text{ MJ/kg}$ (revising the standard 0.92) |

### 15. State-to-State Oxygen Kinetics (Reflected Shock)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Kravchenko et al. (2022) - Modeling of state-to-state oxygen kinetics behind reflected shock waves |
| **Source/DOI** | [DOI: 10.21638/spbu01.2022.304](https://doi.org/10.21638/spbu01.2022.304) |
| **IC/BC/Chem** | **Flow:** $U_{is} = 2.22–2.76 \text{ km/s}$, $T_{0tr} = 6230–9560 \text{ K}$; **Chem:** Binary $O_2/O$ StS kinetics (VT, VV exchange); **BC:** 1D Inviscid; Accounts for partial relaxation from incident shock |
| **Domain** | 1D post-reflected shock; **Obs. Line:** $x_d=5 \text{ mm}$ from end wall; **Relaxation Length:** $x_g \approx 10 \text{ cm}$ (incident wave) |
| **Method** | **Sim:** 1D Euler + Vibrational level balance (StS); Kinetics: SSH & FHO models; **Exp:** Stanford HTGL; High-resolution UV laser absorption (223.237 & 236.9 nm) |
| **Validation** | **Plots:** $n_i$ vs. $t$ (5th/6th levels), $T_v$ vs. $t$, Population distribution $n_i$ vs. level $i$; **Tables:** Experimental parameters for 8 cases, $P_0$ comparisons |
| **Key Metrics** | **Best Model:** SSH + Marrone-Treanor ($U=3T$); **Pre-shock effect:** Frozen assumptions underpredict $P_0$ by $10–20\%$ |

### 16. Hypervelocity Shock Standoff on Spheres (X2 Tunnel)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Zander et al. (2014) - Hypervelocity shock standoff on spheres in air |
| **Source/DOI** | [DOI: 10.1007/s00193-013-0488-x](https://doi.org/10.1007/s00193-013-0488-x) |
| **IC/BC/Chem** | **Flow:** $U=8.73-9.75$ km/s, $M \approx 10.3$, $H_{tot} \approx 40-50$ MJ/kg; **Chem:** Air (Frozen, 5-sp Gupta, 11-sp Gupta, Equilibrium); **BC:** Uniform hypervelocity inflow over hemispheres |
| **Domain** | 3D Hemispherical models; **Diameters ($D$):** 40, 60, 80 mm; **Mesh:** Up to $135 \times 135$ multi-block structured (Grid Independent) |
| **Method** | **Sim:** Eilmer (Navier-Stokes); **Exp:** X2 Expansion Tunnel; **Diagnostics:** Self-luminosity via HPV-1 camera (1 MHz); Canny edge detection & Sobel filtering |
| **Validation** | **Plots:** Normalized standoff $\Delta/D$ vs. $U$; $\Delta/D$ vs. Binary scaling $\rho R$; **Tables:** Freestream mass fractions, Stagnation point composition, X2 fill conditions |
| **Key Metrics** | **$\Delta/D$ Range:** $0.03-0.04$; **Correlation:** $\Delta/D = 0.41(\rho_1/\rho_2)$; **Resolution:** Sub-pixel accuracy via geometric fitting |

### 17. Park’s Two-Temperature Kinetic Model (Ionizing Air)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Park, C. (1989) - Assessment of Two-Temperature Kinetic Model for Ionizing Air |
| **Source/DOI** | [DOI: 10.2514/3.23157](https://doi.org/10.2514/3.23157) |
| **IC/BC/Chem** | **Flow:** $V_{\infty} = 10$ km/s, $P_{\infty} = 0.1$ Torr; **Chem:** 11-species air; **Thermo:** $T$ (trans/rot) and $T_v$ (vib/elec/e- trans); **Reaction Control:** $T_a = \sqrt{TT_v}$; **BC:** Density $(1+0.025x)$ and Temp $(1+0.01x)$ BL corrections |
| **Domain** | Constant-area shock tube & Stagnation streamline ($R = 0.5$ cm to $6$ m); **Res:** Spectral intensity folded with 0.5 mm Gaussian slit |
| **Method** | **Sim:** STRAP (Shock-Tube) / SPRAP (Viscous-Shock-Layer); NEQAIR (QSS assumption); Modified Landau-Teller; **Exp:** Project Fire 2, PAET flight data, and lab shock tubes |
| **Validation** | **Plots:** $T, T_v$ and Emission vs. Distance, Species Mole Fractions vs. $x$, Spectral Intensity (0.2–1.5 $\mu$m); **Tables:** Pre-exponential factors ($C$), exponents ($n$), and $E/k$ for all reactions |

### 18. High Enthalpy Double-Wedge (T5 Tunnel)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Olejniczak et al. (1996) - High Enthalpy Double-Wedge Experiments |
| **Source/DOI** | [AIAA Paper 96-2238](https://arc.aiaa.org/doi/10.2514/6.1996-2238) |
| **IC/BC/Chem** | **Flow:** $h_0 = 25.7-28.5 \text{ MJ/kg}$, $U_{\infty} \approx 6100 \text{ m/s}$; **Chem:** Reacting $N_2$ (Vib-Dissoc coupling); **BC:** 3D Symmetry, Non-slip wall, $\alpha = 0^\circ$ to $-12^\circ$ |
| **Domain** | Double-wedge ($18^\circ$ and $48^\circ$); **Span:** $150 \text{ mm}$; **Mesh:** 3D Two-block structured ($256 \times 16 \times 512$ pts), refined for separation |
| **Method** | **Sim:** 3D Navier-Stokes (Steger-Warming), Implicit DP-LUR; **Exp:** T5 Hypervelocity Tunnel; Mach-Zehnder Holographic Interferometry |
| **Validation** | **Plots:** Interferograms (shock positions), Surface maps ($P$ and $q$ vs. $s, y$), Symmetry plane distributions; **Diagnostics:** 18 pressure / 29 heat gauges |

### 19. NO TDLAS Freestream Characterization (T5 Tunnel)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Girard et al. (2020) - Time-Resolved NO Rotational, Vibrational Temperature and Concentration in T5 |
| **Source/DOI** | [Stanford Publications / Caltech T5](https://hdl.handle.net/10133/5690) |
| **IC/BC/Chem** | **Flow:** $h_{0,\infty} \approx 8-18 \text{ MJ/kg}$, $U \approx 3.5-5.0 \text{ km/s}$; **Chem:** NO tracer ($>5\%$ mass fraction); **Thermo:** $T_{rot} = T_{trans}$ assumed, $T_{vib}$ measured independently |
| **Domain** | Nozzle exit / Test section; **Path Length:** $L = 26 \text{ cm}$ (path-averaged); **Res:** $20 \text{ kHz}$ measurement rate over $4 \text{ ms}$ |
| **Method** | **Exp:** Caltech T5 Reflected Shock Tunnel; **Diagnostics:** Mid-IR TDLAS (3 Quantum Cascade Lasers) targeting $5–6 \text{ μm}$ NO band; **Sim:** Axisymmetric reacting Navier-Stokes |
| **Validation** | **Plots:** $T_{rot}, T_{vib}$ vs. Time; $P_{NO}$ vs. Time (Exp vs. CFD vs. Equil); **Tables:** NO/CO/$H_2O$ transitions, Uncertainty analysis ($8-16\%$ range) |
| **Key Metrics** | **Thermal Equilibrium:** $T_{rot} \approx T_{vib}$ (verified); **PNO Discrepancy:** Measured $P_{NO}$ aligns better with equilibrium than CFD at high enthalpy |


### 20. Translational Eucken Factor from Light Scattering (RBS)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Wu et al. (2020) - Extraction of the translational Eucken factor from light scattering |
| **Source/DOI** | [DOI: 10.1017/jfm.2020.444](https://doi.org/10.1017/jfm.2020.444) |
| **IC/BC/Chem** | **Flow:** $T = 255–337$ K, $P = 0.75–5$ bar; **Chem:** $N_2, CO_2, SF_6$; **Transport:** Translational ($f_{tr}$) and Internal ($f_{int}$) Eucken factors, Bulk viscosity ($\mu_b$) |
| **Domain** | 1D local volume; **Scattering $\lambda$:** $259.4–286$ nm; **Res:** FWHM $\approx 0.15$; Iterative convergence in <20 iterations |
| **Method** | **Sim:** Spontaneous Rayleigh–Brillouin scattering (RBS) spectrometer; **Sim:** Linearized Wang-Chang & Uhlenbeck kinetic model; Fast spectral method for Boltzmann operator |
| **Validation** | **Plots:** RBS Spectrum vs. Frequency Shift; Residuals (<1% error); Error function contours; **Tables:** Extracted values for $\mu_b$, $f_{tr}$, and $f_{int}$ for $N_2$ |

### 21. Electron Density in Re-entry Shocks (NASA EAST)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Cruden et al. (2011) - Electron Density Measurement for Lunar Return |
| **Source/DOI** | [DOI: 10.2514/6.2011-3122](https://doi.org/10.2514/6.2011-3122) |
| **IC/BC/Chem** | **Flow:** $V = 8–12 \text{ km/s}$, $P_{\infty} = 0.1–1.0 \text{ Torr}$; **Chem:** Air plasma ($\approx 10,000 \text{ K}$); **BC:** Normal shock with 50 Torr He buffer to stabilize the 4–5 cm test window |
| **Domain** | Cylindrical Shock Tube; $D = 10.16 \text{ cm}$, $L = 7.8 \text{ m}$; **Res:** 2D spectral map; 1 $\mu\text{s}$ exposure ($\approx 1 \text{ cm}$ spatial blur) |
| **Method** | **Exp:** NASA Ames EAST; **Diagnostics:** Stark broadening of $H_{\alpha}, H_{\beta}, N, O$ lines; **Analysis:** Lorentzian fitting convolved with Instrument Lineshape (ILS) |
| **Validation** | **Plots:** $n_e$ vs. Velocity, $n_e(Measured)/n_e(Equilibrium)$ ratio, Spatially resolved $n_e$ vs. $x$; **Metrics:** Nonequilibrium $n_e$ overshoot (20–30% above CEA) |

### 22. Benchmark Radiative Heating (Earth Re-entry)

| Feature        | Technical Specifications                                                                                                                                                                                                       |
| :---           | :---                                                                                                                                                                                                                           |
| **Article**    | Brandis & Cruden (2017) - Benchmark Shock Tube Experiments                                                                                                                                                                     |
| **Source/DOI** | [NASA NTRS: 20170005708](https://ntrs.nasa.gov/citations/20170005708)                                                                                                                                                          |
| **IC/BC/Chem** | **Flow:** $P_1 = 0.1, 0.2 \text{ Torr}$, $U_s = 8-15.5 \text{ km/s}$; **Chem:** Re-entry air (Idealized vs. Ar-inclusive); **BC:** Normal shock analogous to stagnation line; **Normalization:** $D_{tube} = 10.16 \text{ cm}$ |
| **Domain**     | 1D shock profiles (2D radiance maps); **Duration:** $4–10 \text{ μs}$; **Res:** Defined by Instrument Lineshape (ILS) and Spatial Resolution Function (SRF)                                                                    |
| **Method**     | **Exp:** NASA Ames EAST (Campaigns 47-57); **Diagnostics:** 4 spectrometers (VUV to IR); **Sim:** Benchmark for validation of NEQAIR, HARA, DPLR, LAURA                                                                        |
| **Validation** | **Plots:** Radiance vs. Distance, Equilibrium Radiance vs. $U_s$, Spectral Radiance vs. $\lambda$; **Tables:** 45+ benchmark shots; **Appendix:** Reconstruction parameters for ILS/SRF kernels                                |

### 23. Finite-Rate Catalysis and Heat Flux Prediction

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Bonelli et al. (2021) - Effect of finite-rate catalysis on wall heat flux |
| **Source/DOI** | [DOI: 10.1103/PhysRevFluids.6.033201](https://doi.org/10.1103/PhysRevFluids.6.033201) |
| **IC/BC/Chem** | **Stagnation:** $H_0 = 23.8 \text{ MJ/kg}, P_0 = 2.5 \text{ bar}$; **Chem:** 5-species air; **Catalysis:** Finite-rate Copper model (ER, LH, chemisorption, desorption); **BC:** $T_w = 300 \text{ K}$, Hemispherical probe |
| **Domain** | Conical nozzle ($3.1 \text{ m}$ long) + $10 \text{ cm}$ Copper probe; **Mesh:** $280 \times 72$ (nozzle), $228 \times 393$ (probe), wall/shock refinement; **Kn:** $9.7 \times 10^{-3}$ (Continuum) |
| **Method** | **Sim:** Navier-Stokes (Steger-Warming/MUSCL); Park (3-vib energy eq) vs. StS (N2: 68 levels, O2: 47 levels); **StS Variations:** StS-1 (Incoming), StS-2 (Uniform), StS-3 (Highest level) |
| **Validation** | **Plots:** Nozzle centerline profiles ($T, T_v, M$), Stagnation line profiles ($Y_i, T, T_v$), Pressure contours; **Tables:** Exp vs. Sim comparison for $P_{stag}$ (17.9 mbar) and $q_w$ (1543 kW/m²) |

### 24. Evaluation of Kinetic Models for FIRE II Trajectory

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Zhao et al. (2023) - Evaluation of Thermodynamic and Chemical Kinetic Models |
| **Source/DOI** | [DOI: 10.3390/app13179991](https://doi.org/10.3390/app13179991) |
| **IC/BC/Chem** | **Flow:** Ma 29.0–38.9, Alt 48–71 km (FIRE II); **Chem:** 5, 7, 11-species air (Dunn-Kang, Gupta, Park); **Thermo:** 1T (Equil) vs. 2T (Park $T_{tr}-T_{ve}$); **BC:** $T_w = 810–1560\text{ K}$, Non-catalytic |
| **Domain** | 2D Cylinder ($R_N = 1\text{ m}$); **Mesh:** $131 \times 151$ structured; First layer $\Delta y = 10^{-5}\text{ m}$ |
| **Method** | **Sim:** HyFLOW (Navier-Stokes); Blottner/Wilke transport; Eucken thermal conductivity; Thermodynamic source terms for $T_{ve}$ relaxation |
| **Validation** | **Plots:** Stagnation line $T$ vs. Distance, Species $n_i$ ($N, e^-$) behind shock, Wall $Q$ and $P_w$ distributions; **Tables:** Shock standoff ($\delta$), density/pressure ratios for 18 model permutations |
| **Key Metrics** | **Ionization Effect:** 11-species models act as "heat sponges," lowering peak $T$ via endothermic ionization; **Model Sensitivity:** Heat flux varies by up to $25\%$ based on chemistry choice |

### 25. NO Relaxation and Decomposition (High-Temp Argon Dilution)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Streicher et al. (2022) - NO Vibrational Relaxation and Decomposition |
| **Source/DOI** | [DOI: 10.1063/5.0109109](https://doi.org/10.1063/5.0109109) |
| **IC/BC/Chem** | **Flow:** $T_{0tr} = 2200–8700 \text{ K}, P_0 = 0.12–0.97 \text{ atm}$; **Chem:** NO in Ar (0.4%, 1%, 2% NO); **Kinetics:** VT (NO-Ar, NO-NO), Dissociation, Zeldovich, $N_2O$ formation; **BC:** Reflected shock (particle time = lab time) |
| **Domain** | 1D post-reflected shock; **Path Length ($L$):** $15.24 \text{ cm}$; **Window:** $5 \text{ mm}$ from end wall; **Res:** $900 \text{ kHz}$ bandwidth, $2.5 \text{ μs}$ time-zero uncertainty |
| **Method** | **Exp:** Two-color UV laser absorption (224.8 & 226.1 nm); **Sim:** 0D/1D Forward Euler; Bethe–Teller VT relaxation; Two-stage decomposition modeling |
| **Validation** | **Plots:** Absorbance vs. Time (3-stage behavior), Landau–Teller ($\tau$ vs. $T^{-1/3}$), Arrhenius ($k$ vs. $1/T$), Sensitivity analysis; **Tables:** Rate parameters for dissociation and exchange |

### 26. Martian After-Body Radiative Heating (InSight/MSL)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Brandis et al. (2020) - Radiative Heating on the After-Body of Martian Entry Vehicles |
| **Source/DOI** | [DOI: 10.2514/1.T5613](https://doi.org/10.2514/1.T5613) |
| **IC/BC/Chem** | **Flow:** Mars entry (6.3 km/s); peak convective (71.5s) and radiative (87.5s) points; **Chem:** Reacting $CO_2$ (dissociation of $CO_2, CO$); **BC:** 3D Reacting Navier-Stokes; surface catalysis vs. non-catalytic comparisons |
| **Domain** | 3D Aeroshells (InSight/MSL); **Wake Length:** 4–5.07 diameters required for convergence; **Angular Res:** 306–1122 lines of sight per surface point |
| **Method** | **Sim:** LAURA/DPLR (Flow) + NEQAIR/HARA (Radiation); **Integration:** Full angular hemispherical integration via Triangulation/ADT search; **Spectral:** up to 876,000 lines ($CO_2$ MWIR focus) |
| **Validation** | **Plots:** Spectral Radiance ($2.0, 2.7, 4.3 \text{ μm}$ bands), 2D "Fish-eye" radiance maps, Wake length/Angular convergence profiles; **Flight Data:** MEDLI2 / COMARS+ reference |
| **Key Metrics** | **Tangent-Slab Error:** $25\%–58\%$ overprediction on after-body; **Code Agreement:** NEQAIR vs. HARA within $14\%$; **Result:** Radiative flux can dominate convective flux on backshell components |

### 27. Equilibrium Radiative Heating (9.5 to 15.5 km/s)

| Feature | Technical Specifications |
| :--- | :--- |
| **Article** | Brandis et al. (2016) - Equilibrium Radiative Heating for Earth Atmospheric Entry |
| **Source/DOI** | [DOI: 10.2514/1.T4878](https://doi.org/10.2514/1.T4878) |
| **IC/BC/Chem** | **Flow:** $U_s = 9.5-15.5$ km/s, $P_1 = 13.3, 26.6$ Pa; **Chem:** Synthetic Air ($79\% N_2, 21\% O_2$); **Assumption:** Thermal/Chemical Equilibrium (CEA); **BC:** Planar normal shock analogous to stagnation line |
| **Domain** | Cylindrical Shock Tube ($D = 10.16$ cm); **Test Time:** $4–10$ μs (Equilibrium plateau); **Mesh:** $160 \times 245$ (streamwise x normal) for CFD verification |
| **Method** | **Exp:** NASA Ames EAST; **Diagnostics:** 4 Gated Spectrometers (VUV to IR); **Sim:** NEQAIR v14.0 vs. HARA; **Physics:** HARA includes $N^-$ continuum and TOPbase atomic lines |
| **Validation** | **Plots:** Spectral Radiance vs. $\lambda$, Integrated Radiance vs. $U_s$ (with $95\%$ CI), Radiative Cooling profiles ($5\%$ T-drop); **Uncertainty:** Refined to $[+9.0\%, -6.3\%]$ for high-speed entry |








