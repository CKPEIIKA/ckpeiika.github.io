        (() => {
            "use strict";

            const canvas = document.getElementById("scene");
            const ctx = canvas.getContext("2d", {
                alpha: false,
                desynchronized: true,
            });
            const statusEl = document.getElementById("status");
            const fpsEl = document.getElementById("fps");
            const stepEl = document.getElementById("f-step");
            const countEl = document.getElementById("count");
            const meanSpeedEl = document.getElementById("mean-speed");
            const occupancyEl = document.getElementById("cell-occupancy");
            const deltaEEl = document.getElementById("delta-e");
            const deltaPEl = document.getElementById("delta-p");
            const diagTempEl = document.getElementById("diag-temp");
            const diagCollisionsEl = document.getElementById("diag-collisions");
            const diagTrotEl = document.getElementById("diag-trot");
            const diagRotEventsEl = document.getElementById("diag-rot-events");
            const miniCanvas = document.getElementById("minimap");
            const miniCtx = miniCanvas.getContext("2d", {
                alpha: false,
                desynchronized: true,
            });
            const miniPanel = document.getElementById("mini-panel");
            const miniMetricAEl = document.getElementById("mini-metric-a");
            const miniMetricBEl = document.getElementById("mini-metric-b");
            const miniMetricCEl = document.getElementById("mini-metric-c");
            const miniMetricALabelEl = document.getElementById("mini-metric-a-label");
            const miniMetricBLabelEl = document.getElementById("mini-metric-b-label");
            const miniMetricCLabelEl = document.getElementById("mini-metric-c-label");
            const caseSelect = document.getElementById("case-id");
            const speciesList = document.getElementById("species-presets");
            const speciesAInput = document.getElementById("species-a");
            const speciesBInput = document.getElementById("species-b");
            const validityDxOverLambdaEl = document.getElementById("validity-dx-over-lambda");
            const validityDtOverTauEl = document.getElementById("validity-dt-over-tau");
            const validityNpcellEl = document.getElementById("validity-npcell");
            const validityMajorantEl = document.getElementById("validity-majorant");
            const densityScaleInput = document.getElementById("density-scale");
            const densityScaleDisplay = document.getElementById("density-scale-display");
            const wallTempLeftInput = document.getElementById("wall-temp-left");
            const wallTempRightInput = document.getElementById("wall-temp-right");
            const wallMixedAccommodationInput = document.getElementById("wall-mixed-accom");
            const wallMixedRow = document.getElementById("wall-mixed-row");
            const cellSizeInput = document.getElementById("cell-size");
            const simDtInput = document.getElementById("sim-dt");
            const cellSizeDecBtn = document.getElementById("cell-size-dec");
            const cellSizeIncBtn = document.getElementById("cell-size-inc");
            const dtDecBtn = document.getElementById("dt-dec");
            const dtIncBtn = document.getElementById("dt-inc");
            const boundaryModeSelect = document.getElementById("boundary-mode");
            const collisionModelSelect = document.getElementById("collision-model");
            const miniViewSelect = document.getElementById("mini-view");
            const renderQualitySelect = document.getElementById("render-quality");
            const fieldHelp = document.getElementById("field-help");
            const fieldHelpText = document.getElementById("field-help-text");
            const fieldHelpEntry = document.getElementById("field-help-entry");
            const fieldHelpList = document.getElementById("field-help-items");
            const fieldHelpMeta = document.getElementById("field-help-meta");
            const tokCaseBtn = document.getElementById("tok-case");
            const tokGasBtn = document.getElementById("tok-gas");
            const tokRhoBtn = document.getElementById("tok-rho");
            const tokTlBtn = document.getElementById("tok-tl");
            const tokTrBtn = document.getElementById("tok-tr");
            const tokWallBtn = document.getElementById("tok-wall");
            const tokNBtn = document.getElementById("tok-n");
            const tokDxBtn = document.getElementById("tok-dx");
            const tokDtBtn = document.getElementById("tok-dt");
            const tokModelBtn = document.getElementById("tok-model");
            const tokPlotBtn = document.getElementById("tok-plot");
            const tokHelpBtn = document.getElementById("tok-help");
            const tokHelpFooterBtn = document.getElementById("tok-help-footer");
            const tokToggleBtn = document.getElementById("tok-toggle");
            const uiCaseEl = document.getElementById("ui-case");
            const uiGasEl = document.getElementById("ui-gas");
            const uiRhoEl = document.getElementById("ui-rho");
            const uiTlEl = document.getElementById("ui-tl");
            const uiTrEl = document.getElementById("ui-tr");
            const uiWallEl = document.getElementById("ui-wall");
            const uiNEl = document.getElementById("ui-n");
            const uiDxEl = document.getElementById("ui-dx");
            const uiDtEl = document.getElementById("ui-dt");
            const uiModelEl = document.getElementById("ui-model");
            const uiPlotEl = document.getElementById("ui-plot");
            let activeHelpTarget = null;
            let activeHudToken = null;

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const world = {
                width: 10.0,
                height: 6.0,
            };
            const dsmcDomainDepth = 1e-6;
            const simParticleRadiusPx = 0.62;
            const speciesColorPalette = [
                "#22d3ee",
                "#f97316",
                "#a78bfa",
                "#22c55e",
                "#f59e0b",
                "#f43f5e",
                "#34d399",
                "#60a5fa",
                "#fb923c",
                "#e879f9",
            ];
            const collisionLines = [];
            const maxCollisionLines = 900;
            const collisionLineTtl = 1.45;
            const speciesColors = new Map();
            const miniState = {
                bins: 28,
                historyLength: 180,
                meanHistory: new Float32Array(180),
                rmsHistory: new Float32Array(180),
                tempHistory: new Float32Array(180),
                bulkSpeedHistory: new Float32Array(180),
                pressureHistory: new Float32Array(180),
                historyCount: 0,
                historyHead: 0,
                ready: false,
                speedScratch: new Float32Array(1024),
                histogram: new Float32Array(28),
            };
            const miniPalette = {
                mean: "#22d3ee",
                rms: "#34d399",
                temp: "#f59e0b",
            };
            const worldArea = world.width * world.height;
            const miniModeConfig = {
                dist: {
                    title: "dist",
                    rows: [
                        { key: "mean", label: "μv", kind: "speed", history: "meanHistory" },
                        { key: "rms", label: "rms", kind: "speed", history: "rmsHistory" },
                        { key: "temp", label: "σT", kind: "temp", history: "tempHistory" },
                    ],
                },
                moments: {
                    title: "moments",
                    rows: [
                        { key: "mean", label: "μv", kind: "speed", history: "meanHistory" },
                        { key: "rms", label: "rms", kind: "speed", history: "rmsHistory" },
                        { key: "temp", label: "σT", kind: "temp", history: "tempHistory" },
                    ],
                },
                vpt: {
                    title: "v,p,T",
                    rows: [
                        { key: "bulk", label: "v", kind: "speed", history: "bulkSpeedHistory" },
                        { key: "pressure", label: "p", kind: "pressure", history: "pressureHistory" },
                        { key: "temp", label: "T", kind: "temp", history: "tempHistory" },
                    ],
                },
            };
            const CASE_LABEL = {
                preset_eq_box: "eq",
                preset_diffuse_wall: "wallT",
                monospecies_heat_bath: "mono",
                five_species_heat_bath: "5sp",
                seven_species_lab_mix: "7sp",
                argon_hydrogen_arcs: "ArH2",
            };
            const WALL_LABEL = {
                specular: "refl",
                diffuse: "diff",
                mixed: "mix",
                periodic: "per",
            };
            const MODEL_LABEL = {
                "hard-sphere": "HS",
                vhs: "VHS",
                vss: "VSS",
            };
            const PLOT_LABEL = {
                off: "off",
                dist: "dist",
                moments: "mom",
                vpt: "v,p,T",
            };
            const QUICK_PRESETS = {
                preset_eq_box: {
                    label: "eq",
                    baseCase: "monospecies_heat_bath",
                    speciesA: "Ar",
                    speciesB: "Ar",
                    collisionModel: "vhs",
                    boundaryMode: "periodic",
                    kn: 0.20,
                    particleCount: 2400,
                    cellSize: 0.16,
                    dt: 0.00030,
                    wallTemps: { left: 300, right: 300 },
                    wallAccommodation: 0.5,
                    plot: "dist",
                    enableRotationalLB: false,
                },
                preset_diffuse_wall: {
                    label: "wallT",
                    baseCase: "monospecies_heat_bath",
                    speciesA: "Ar",
                    speciesB: "Ar",
                    collisionModel: "vhs",
                    boundaryMode: "diffuse",
                    kn: 0.25,
                    particleCount: 2600,
                    cellSize: 0.18,
                    dt: 0.00024,
                    wallTemps: { left: 260, right: 520 },
                    wallAccommodation: 0.5,
                    plot: "moments",
                    enableRotationalLB: false,
                },
            };
            const core = DsmcTyped.createRuntime();
            const cellState = core.cells;
            const formatMiniValue = (value, kind) => {
                if (!Number.isFinite(value)) {
                    return "--";
                }
                if (kind === "temp") {
                    return `${value.toFixed(0)}`;
                }
                if (kind === "pressure") {
                    return `${value.toExponential(1)}`;
                }
                return `${value.toFixed(2)}`;
            };

            const resolveMiniMode = (value) => {
                if (value === "off") {
                    return "off";
                }
                return miniModeConfig[value] ? value : "moments";
            };

            const getMiniModeRows = (mode) => {
                const resolved = resolveMiniMode(mode);
                return resolved === "off" ? miniModeConfig.moments.rows : miniModeConfig[resolved].rows;
            };

            const getQuickPreset = () => QUICK_PRESETS[caseSelect.value] || null;

            const sim = {
                running: false,
                dt: 0.00052,
                substeps: 1,
                frameId: null,
                collisionsThisFrame: 0,
                boundaryMode: "specular",
                loadedCase: null,
                ntcWeight: 1.0,
                ntcMargin: 1.2,
                collisionModel: "vhs",
                wallMixedAccommodation: 0.5,
                densityScale: 0.20,
                renderQuality: "quality",
                visualFrameDtBase: 0.00052,
                maxAdaptiveStepsPerFrame: 48,
                collisionsLastStep: 0,
                collisionAttemptsLastStep: 0,
                majorantViolationsLastStep: 0,
                rotEventsLastStep: 0,
                stepCount: 0,
                enableRotationalLB: false,
                metrics: {
                    fps: 0,
                    translTemp: NaN,
                    rotationalTemp: NaN,
                    collisionCount: 0,
                    deltaE: NaN,
                    deltaP: NaN,
                    dxOverLambda: NaN,
                    dtOverTau: NaN,
                    npcell: NaN,
                    majorantCount: 0,
                    majorantAttempts: 0,
                    ntcOverflow: false,
                    solverStepsPerFrame: 1,
                },
            };
            const simRandom = () => core.random();
            let invariantRef = null;
            const defaultKn = 0.20;
            const characteristicLength = world.width;

            const toWorldScaleX = canvasWidth / world.width;
            const toWorldScaleY = canvasHeight / world.height;
            const invScaleX = 1 / toWorldScaleX;
            const invScaleY = 1 / toWorldScaleY;
            const invWorldScale = (invScaleX + invScaleY) / 2.0;
            const simParticleRadiusWorld = simParticleRadiusPx * invWorldScale;
            const simParticleDiameterWorld = simParticleRadiusWorld * 2.0;
            const wallPadX = invScaleX * simParticleRadiusPx;
            const wallPadY = invScaleY * simParticleRadiusPx;
            const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
            const clamp01 = (value) => clamp(value, 0, 1);

            const toFixedNumber = (value, digits) => Number(value).toFixed(digits);

            const adjustCellSize = (direction) => {
                const parsed = Number(cellSizeInput.value);
                if (!Number.isFinite(parsed)) {
                    return;
                }
                const step = Math.max(0.02, parsed * 0.08);
                const next = clamp(parsed + direction * step, 0.05, world.width * 0.75);
                cellSizeInput.value = toFixedNumber(next, 2);
                cellSizeInput.dispatchEvent(new Event("change"));
            };

            const adjustDt = (direction) => {
                const parsed = Number(simDtInput.value);
                if (!Number.isFinite(parsed)) {
                    return;
                }
                const next = clamp(parsed * (direction > 0 ? 1.2 : 1 / 1.2), 1e-6, 0.02);
                simDtInput.value = toFixedNumber(next, 5);
                simDtInput.dispatchEvent(new Event("change"));
            };

            const normalizeSpeciesInput = (value, fallback) => {
                if (!sim.loadedCase) {
                    return fallback;
                }
                const names = Object.keys(sim.loadedCase.species);
                if (names.length === 0) {
                    return fallback;
                }
                const candidate = String(value || "").trim();
                return names.includes(candidate) ? candidate : names[0];
            };

            const getActiveSpeciesPair = () => {
                if (!sim.loadedCase) {
                    return [];
                }
                const names = Object.keys(sim.loadedCase.species);
                if (names.length === 0) {
                    return [];
                }
                const fallback = names[0];
                const speciesAName = normalizeSpeciesInput(speciesAInput?.value, fallback);
                const speciesBName = normalizeSpeciesInput(speciesBInput?.value, names.length > 1 ? names[1] : fallback);
                return [...new Set([speciesAName, speciesBName])];
            };

            const getSpeciesColor = (speciesName) => {
                if (!speciesName) {
                    return "#94a3b8";
                }
                const name = String(speciesName);
                if (!speciesColors.has(name)) {
                    const idx = speciesColors.size % speciesColorPalette.length;
                    speciesColors.set(name, speciesColorPalette[idx]);
                }
                return speciesColors.get(name) || "#94a3b8";
            };

            const syncSpeciesColors = () => {
                speciesColors.clear();
                if (!sim.loadedCase) {
                    return;
                }
                const names = Object.keys(sim.loadedCase.species);
                for (const name of names) {
                    getSpeciesColor(name);
                }
            };

            const getBoundaryProfile = () => {
                return { xMode: sim.boundaryMode, yMode: sim.boundaryMode };
            };

            const applyQuickPresetControls = (presetId) => {
                const preset = QUICK_PRESETS[presetId];
                if (!preset) {
                    return false;
                }
                speciesAInput.value = preset.speciesA;
                speciesBInput.value = preset.speciesB;
                collisionModelSelect.value = preset.collisionModel;
                boundaryModeSelect.value = preset.boundaryMode;
                densityScaleInput.value = preset.kn.toFixed(2);
                wallTempLeftInput.value = String(preset.wallTemps.left);
                wallTempRightInput.value = String(preset.wallTemps.right);
                wallMixedAccommodationInput.value = String(preset.wallAccommodation);
                document.getElementById("particle-count").value = String(preset.particleCount);
                cellSizeInput.value = preset.cellSize.toFixed(2);
                simDtInput.value = preset.dt.toFixed(5);
                miniViewSelect.value = preset.plot;
                sim.enableRotationalLB = preset.enableRotationalLB === true;
                return true;
            };

            const updateGridLayout = () => {
                core.configureGrid(world.width, world.height, Number(cellSizeInput.value));
            };

            const resetCollisionLines = () => {
                collisionLines.length = 0;
            };

            const addCollisionLine = (x1, y1, x2, y2) => {
                collisionLines.push({
                    x1,
                    y1,
                    x2,
                    y2,
                    life: 1,
                });
                if (collisionLines.length > maxCollisionLines) {
                    collisionLines.shift();
                }
            };

            const decayCollisionLines = (dtFrame) => {
                const decay = dtFrame / collisionLineTtl;
                let write = 0;
                for (let i = 0; i < collisionLines.length; i += 1) {
                    const mark = collisionLines[i];
                    mark.life -= decay;
                    if (mark.life > 0) {
                        collisionLines[write] = mark;
                        write += 1;
                    }
                }
                collisionLines.length = write;
            };

            const buildCellCache = (opts = {}) => {
                core.buildCellCache(opts.preserveRemainders !== false);
            };

            const estimateReferenceCrossSection = () => {
                if (!sim.loadedCase) {
                    return null;
                }
                const activePair = getActiveSpeciesPair();
                if (activePair.length === 0) {
                    return null;
                }
                const sa = getSpecies(activePair[0]);
                const sb = getSpecies(activePair[Math.min(1, activePair.length - 1)] || activePair[0]);
                const referenceTemperature = sim.loadedCase.reference_temperature_k
                    || 0.5 * ((Number(wallTempLeftInput.value) || 300) + (Number(wallTempRightInput.value) || 300));
                const reducedMass = Dsmc.reducedMass(sa.mass_kg, sb.mass_kg);
                const relSpeedRef = Math.max(
                    1.0e-9,
                    Math.sqrt((8.0 * Dsmc.KB * referenceTemperature) / (Math.PI * reducedMass)),
                );
                const sigmaTcRef = getCollisionSigmaTc(sa, sb, relSpeedRef, referenceTemperature);
                const sigmaRef = Math.max(1.0e-30, sigmaTcRef / relSpeedRef);
                return {
                    sigmaRef,
                    relSpeedRef,
                    referenceTemperature,
                };
            };

            const updatePhysicalScaling = () => {
                const particleCount = Math.max(
                    1,
                    Math.round(Number(document.getElementById("particle-count").value) || core.state.count || 1),
                );
                const estimate = estimateReferenceCrossSection();
                if (!estimate) {
                    sim.ntcWeight = 1.0;
                    return;
                }
                const targetKn = Math.max(0.01, Number(densityScaleInput.value) || defaultKn);
                const lambda = Math.max(1.0e-12, targetKn * characteristicLength);
                const targetNumberDensity = 1.0 / (Math.SQRT2 * estimate.sigmaRef * lambda);
                const worldVolume = worldArea * dsmcDomainDepth;
                sim.ntcWeight = (targetNumberDensity * worldVolume) / particleCount;
            };

            const getAdaptiveSolverStepsPerFrame = () => {
                const targetAdvance = Math.max(sim.visualFrameDtBase, sim.dt);
                const desired = Math.max(1, Math.ceil(targetAdvance / Math.max(1.0e-6, sim.dt)));
                const budget = sim.renderQuality === "fast" ? sim.maxAdaptiveStepsPerFrame : Math.max(8, Math.floor(sim.maxAdaptiveStepsPerFrame * 0.5));
                return clamp(desired, 1, budget);
            };

            const num = (id) => {
                const value = Number(document.getElementById(id).value);
                if (!Number.isFinite(value)) {
                    throw new Error(`Invalid input: ${id}`);
                }
                return value;
            };

            const syncSimInputs = () => {
                const dt = num("sim-dt");
                const densityScale = num("density-scale");
                const wallAccom = num("wall-mixed-accom");
                const cellSize = Number(cellSizeInput.value);
                if (!Number.isFinite(cellSize)) {
                    throw new Error("cell size must be numeric");
                }
                if (!(dt > 0)) {
                    throw new Error("dt must be greater than 0");
                }
                if (!(densityScale > 0)) {
                    throw new Error("Kn must be positive");
                }
                if (!(wallAccom >= 0 && wallAccom <= 1)) {
                    throw new Error("wall accommodation must be between 0 and 1");
                }
                sim.dt = dt;
                sim.densityScale = densityScale;
                sim.wallMixedAccommodation = wallAccom;
                sim.collisionModel = collisionModelSelect.value;
                sim.renderQuality = renderQualitySelect && renderQualitySelect.value === "fast" ? "fast" : "quality";
                cellState.cols = Math.max(8, Math.round(world.width / clamp(cellSize, 0.05, 0.75 * world.width)));
                updateGridLayout();
                updatePhysicalScaling();
            };

            const clampMetricClass = (value, good, warn) => {
                if (!Number.isFinite(value)) {
                    return "validity-bad";
                }
                if (value <= good) {
                    return "validity-good";
                }
                if (value <= warn) {
                    return "validity-warn";
                }
                return "validity-bad";
            };

            const captureInvariantReference = () => {
                const count = core.state.count;
                const vx = core.state.vx;
                const vy = core.state.vy;
                const vz = core.state.vz;
                const mass = core.state.mass;
                const eRot = core.state.eRot;
                let energy = 0.0;
                let px = 0.0;
                let py = 0.0;
                let pz = 0.0;
                for (let i = 0; i < count; i += 1) {
                    const speed2 = (vx[i] * vx[i]) + (vy[i] * vy[i]) + (vz[i] * vz[i]);
                    energy += 0.5 * mass[i] * speed2 + Number(eRot[i] || 0.0);
                    px += mass[i] * vx[i];
                    py += mass[i] * vy[i];
                    pz += mass[i] * vz[i];
                }
                const momentumSq = (px * px) + (py * py) + (pz * pz);
                invariantRef = {
                    energy,
                    momentum: [px, py, pz],
                    momentumMag: Math.sqrt(momentumSq),
                };
            };

            const resolveDatalistValues = (targetOrListId) => {
                const listId = typeof targetOrListId === "string"
                    ? targetOrListId
                    : targetOrListId.getAttribute("list");
                if (!listId) {
                    return [];
                }
                const list = document.getElementById(listId);
                if (!list) {
                    return [];
                }
                const values = [];
                for (const option of list.options) {
                    const value = String(option.value || "").trim();
                    if (value) {
                        values.push(value);
                    }
                }
                return values;
            };

            const formatCompactDecimal = (value, digits = 2) => {
                const text = Number(value).toFixed(digits);
                return text.startsWith("0") ? text.slice(1) : text;
            };

            const formatCompactExponential = (value, digits = 1) => {
                return Number(value).toExponential(digits).replace("e-0", "e-").replace("e+0", "e+");
            };

            const cycleSelectValue = (select, step = 1) => {
                const options = select.options;
                if (options.length === 0) {
                    return;
                }
                const next = ((select.selectedIndex + step) % options.length + options.length) % options.length;
                select.selectedIndex = next;
                select.dispatchEvent(new Event("change"));
            };

            const setActiveToken = (tokenEl) => {
                if (activeHudToken && activeHudToken !== tokenEl) {
                    activeHudToken.classList.remove("active");
                }
                activeHudToken = tokenEl;
                if (activeHudToken) {
                    activeHudToken.classList.add("active");
                }
            };

            const positionHelpPopup = (anchor) => {
                requestAnimationFrame(() => {
                    const bounds = anchor.getBoundingClientRect();
                    const rect = document.querySelector(".visual-card").getBoundingClientRect();
                    const left = Math.max(6, Math.min(bounds.left - rect.left, rect.width - fieldHelp.offsetWidth - 6));
                    const below = bounds.bottom - rect.top + 6;
                    const above = bounds.top - rect.top - fieldHelp.offsetHeight - 6;
                    const maxTop = rect.height - fieldHelp.offsetHeight - 10;
                    const top = below + fieldHelp.offsetHeight > rect.height - 10
                        ? Math.max(8, above)
                        : Math.min(maxTop, below);
                    fieldHelp.style.left = `${left}px`;
                    fieldHelp.style.top = `${top}px`;
                });
            };

            const buildHelpPopup = (config) => {
                if (!config || !config.anchor) {
                    return;
                }
                const title = config.title || config.anchor.title || config.anchor.getAttribute("aria-label") || "edit";
                const items = Array.isArray(config.items) ? config.items : [];
                const inputValue = config.inputValue ?? "";
                const inputMode = config.inputMode || "text";
                const meta = config.meta || "";
                fieldHelpText.textContent = title;
                fieldHelpList.innerHTML = "";
                fieldHelpMeta.textContent = meta;
                fieldHelpEntry.value = inputValue;
                fieldHelpEntry.inputMode = inputMode;
                fieldHelpEntry.classList.toggle("visible", !!config.withInput);

                for (const candidate of items) {
                    const item = document.createElement("button");
                    item.type = "button";
                    item.dataset.value = candidate.value;
                    item.textContent = candidate.label || candidate.value;
                    item.className = "inline-suggestion";
                    const row = document.createElement("li");
                    row.appendChild(item);
                    fieldHelpList.appendChild(row);
                }

                fieldHelp.classList.add("visible");
                fieldHelp.setAttribute("aria-hidden", "false");
                positionHelpPopup(config.anchor);
                activeHelpTarget = config;
                setActiveToken(config.anchor);
                if (config.withInput) {
                    requestAnimationFrame(() => {
                        fieldHelpEntry.focus();
                        fieldHelpEntry.select();
                    });
                }
            };

            const hideHelpPopup = () => {
                fieldHelp.classList.remove("visible");
                fieldHelp.setAttribute("aria-hidden", "true");
                fieldHelpEntry.classList.remove("visible");
                fieldHelpMeta.textContent = "";
                activeHelpTarget = null;
            };

            const applyHelpValue = (value) => {
                if (!activeHelpTarget) {
                    return;
                }
                if (typeof activeHelpTarget.apply === "function") {
                    activeHelpTarget.apply(value);
                }
                hideHelpPopup();
            };

            const withTry = (fn) => {
                try {
                    fn();
                    setStatus("ok", true);
                } catch (err) {
                    setStatus("err", false, err.message);
                    console.error(err);
                }
            };

            const setStatus = (text, ok = true, detail = "") => {
                statusEl.textContent = text;
                statusEl.className = `tok ${ok ? "neutral" : "bad"}`;
                statusEl.title = detail || text;
            };

            const isTextInputTarget = (target) => {
                if (!target || target.tagName === undefined) {
                    return false;
                }
                const tag = target.tagName.toLowerCase();
                return (
                    tag === "input"
                    || tag === "textarea"
                    || tag === "select"
                    || target.isContentEditable
                );
            };

            const runKeybindAction = (action) => {
                withTry(action);
            };

            const syncToggleButtons = () => {
                const running = sim.running;
                if (tokToggleBtn) {
                    tokToggleBtn.textContent = running ? "||" : "▶";
                    tokToggleBtn.title = running ? "pause" : "run";
                }
                const footerToggle = document.getElementById("toggle");
                if (footerToggle) {
                    footerToggle.textContent = running ? "Space pause" : "Space run";
                }
            };

            const setRunning = (running) => {
                sim.running = !!running;
                syncToggleButtons();
                setStatus(sim.running ? "run" : "ok", true);
            };

            const toggleRotationalLB = () => {
                sim.enableRotationalLB = !sim.enableRotationalLB;
                setStatus(sim.enableRotationalLB ? "rot on" : "rot off", true);
            };

            const syncHudTokens = () => {
                const caseId = caseSelect.value;
                const wall = boundaryModeSelect.value;
                const plot = miniViewSelect.value;
                const model = MODEL_LABEL[collisionModelSelect.value] || collisionModelSelect.value;
                uiCaseEl.textContent = CASE_LABEL[caseId] || caseId;
                uiGasEl.textContent = `${speciesAInput.value || "--"}:${speciesBInput.value || "--"}`;
                uiRhoEl.textContent = formatCompactDecimal(densityScaleInput.value, 2);
                uiTlEl.textContent = String(Math.round(Number(wallTempLeftInput.value) || 0));
                uiTrEl.textContent = String(Math.round(Number(wallTempRightInput.value) || 0));
                uiWallEl.textContent = wall === "mixed"
                    ? `${WALL_LABEL[wall] || wall} α${formatCompactDecimal(wallMixedAccommodationInput.value, 2)}`
                    : (WALL_LABEL[wall] || wall);
                uiNEl.textContent = String(Math.round(Number(document.getElementById("particle-count").value) || 0));
                uiDxEl.textContent = formatCompactDecimal(cellSizeInput.value, 2);
                uiDtEl.textContent = formatCompactExponential(simDtInput.value, 1);
                uiModelEl.textContent = model;
                uiPlotEl.textContent = PLOT_LABEL[plot] || plot;
                if (miniPanel) {
                    miniPanel.style.display = plot === "off" ? "none" : "block";
                }
                syncToggleButtons();
            };

            const setInputValue = (input, value, eventName = "change") => {
                input.value = value;
                input.dispatchEvent(new Event(eventName));
                syncHudTokens();
            };

            const openValuePopup = (anchor, title, input, values, meta = "") => {
                buildHelpPopup({
                    anchor,
                    title,
                    items: values.slice(0, 14).map((value) => ({ value, label: value })),
                    withInput: true,
                    inputValue: input.value,
                    inputMode: input.inputMode || "text",
                    meta,
                    apply: (value) => {
                        setInputValue(input, value);
                    },
                });
            };

            const openSelectPopup = (anchor, title, select, labelMap = null, meta = "") => {
                const items = Array.from(select.options, (option) => ({
                    value: option.value,
                    label: labelMap && labelMap[option.value] ? labelMap[option.value] : option.textContent,
                }));
                buildHelpPopup({
                    anchor,
                    title,
                    items,
                    withInput: false,
                    meta,
                    apply: (value) => {
                        select.value = value;
                        select.dispatchEvent(new Event("change"));
                    },
                });
            };

            const openGasPopup = () => {
                if (!sim.loadedCase) {
                    return;
                }
                const names = Object.keys(sim.loadedCase.species);
                const items = [];
                for (const name of names) {
                    items.push({ value: `A|${name}`, label: `A ${name}` });
                }
                for (const name of names) {
                    items.push({ value: `B|${name}`, label: `B ${name}` });
                }
                buildHelpPopup({
                    anchor: tokGasBtn,
                    title: "gas A:B",
                    items,
                    withInput: false,
                    meta: "[ and ] tune focused token",
                    apply: (value) => {
                        const [target, species] = String(value).split("|");
                        if (target === "A") {
                            setInputValue(speciesAInput, species);
                        } else {
                            setInputValue(speciesBInput, species);
                        }
                        render(1 / 60, true);
                    },
                });
            };

            const openWallPopup = () => {
                const wallItems = Array.from(boundaryModeSelect.options, (option) => ({
                    value: `wall|${option.value}`,
                    label: WALL_LABEL[option.value] || option.value,
                }));
                const items = wallItems.slice();
                if (boundaryModeSelect.value === "mixed") {
                    for (const value of ["0.10", "0.25", "0.50", "0.75", "0.90"]) {
                        items.push({ value: `alpha|${value}`, label: `α ${value}` });
                    }
                }
                buildHelpPopup({
                    anchor: tokWallBtn,
                    title: "wall / accommodation",
                    items,
                    withInput: boundaryModeSelect.value === "mixed",
                    inputValue: wallMixedAccommodationInput.value,
                    inputMode: "decimal",
                    meta: "X cycle wall",
                    apply: (value) => {
                        const [kind, payload] = String(value).split("|");
                        if (kind === "wall") {
                            boundaryModeSelect.value = payload;
                            boundaryModeSelect.dispatchEvent(new Event("change"));
                        } else if (kind === "alpha") {
                            setInputValue(wallMixedAccommodationInput, payload);
                        } else {
                            setInputValue(wallMixedAccommodationInput, value);
                        }
                        syncHudTokens();
                    },
                });
            };

            const showHelpOverlay = (anchor) => {
                buildHelpPopup({
                    anchor,
                    title: "keys",
                    items: [
                        { value: "", label: "R seed" },
                        { value: "", label: "S step" },
                        { value: "", label: "Space run" },
                        { value: "", label: "C case" },
                        { value: "", label: "X wall" },
                        { value: "", label: "M plot" },
                        { value: "", label: "L rot" },
                        { value: "", label: "[ / ] tune" },
                    ],
                    withInput: false,
                    meta: "header edits run, footer judges it | quick cases: eq, wallT",
                    apply: () => {},
                });
            };

            const buildAdviceItems = (lines) => lines.map((line, index) => ({
                value: `noop-${index}`,
                label: line,
            }));

            const describeMetricState = (el) => {
                if (!el) {
                    return "neutral";
                }
                if (el.classList.contains("good")) {
                    return "green";
                }
                if (el.classList.contains("warn")) {
                    return "yellow";
                }
                if (el.classList.contains("bad")) {
                    return "red";
                }
                return "neutral";
            };

            const openFooterAdvice = (anchor, key) => {
                const metric = sim.metrics;
                let title = anchor.textContent.trim();
                let meta = "header changes run, footer judges it";
                let items = [];
                switch (key) {
                    case "status":
                        title = `status ${statusEl.textContent.trim()}`;
                        items = buildAdviceItems([
                            "green target: status stays ok or run",
                            "if red, click ? and fix the last invalid input",
                            "most common fix: lower dt, lower dx, or reseed with R",
                        ]);
                        break;
                    case "fps":
                        title = `fps ${Number.isFinite(metric.fps) ? metric.fps.toFixed(0) : "--"}`;
                        items = buildAdviceItems([
                            "green target: keep fps above 50",
                            "to raise fps: reduce N, increase dx, or set plot off",
                            "small dt now batches several solver steps per frame without changing the animation pace",
                        ]);
                        break;
                    case "step":
                        title = `step ${sim.stepCount}`;
                        items = buildAdviceItems([
                            "step is neutral: it counts solver advances",
                            "use S for one step or Space to run continuously",
                            "watch dE/E0, dP/P0, dx/λ, dt/τ, npc, and maj as step grows",
                        ]);
                        break;
                    case "temp":
                        title = `T ${Number.isFinite(metric.translTemp) ? metric.translTemp.toFixed(0) : "--"}K`;
                        items = buildAdviceItems([
                            "temperature turns green when it is finite and stable",
                            "change TL/TR or wall mode to drive the bath temperature",
                            "for invariant checks use periodic or spec walls first",
                        ]);
                        break;
                    case "col":
                        title = `col ${metric.collisionCount ?? 0}`;
                        items = buildAdviceItems([
                            "green target: visible nonzero collisions with stable dE and maj",
                            "to increase collisions: lower Kn, raise N, or increase dt slightly",
                            "if particles cluster or maj turns red, back dt down again",
                        ]);
                        break;
                    case "trot":
                        title = Number.isFinite(metric.rotationalTemp) ? `Trot ${metric.rotationalTemp.toFixed(0)}K` : "Trot --";
                        items = buildAdviceItems([
                            "green target: finite Trot for molecules with rotational dof",
                            "to see Trot, choose H2, N2, O2, NO, or CO and press L to enable rotational LB",
                            "monoatomic gases like Ar, He, Ne, N, O have no rotational temperature",
                        ]);
                        meta = "rotational temperature is separate from translational T";
                        break;
                    case "rot":
                        title = `rot ${sim.rotEventsLastStep || 0}`;
                        items = buildAdviceItems([
                            "green target: nonzero rot events for diatomic/polyatomic mixtures when L is on",
                            "to increase rot events: choose molecular species and lower Kn carefully",
                            "if rot stays zero for Ar-only runs, that is expected",
                        ]);
                        meta = "rot counts Larsen-Borgnakke rotational exchanges in the last step";
                        break;
                    case "dE":
                        title = `dE/E0 ${Number.isFinite(metric.deltaE) ? metric.deltaE.toFixed(3) : "--"}`;
                        items = buildAdviceItems([
                            "green target: dE <= .02",
                            "to reduce dE: lower dt first, then reduce dx",
                            "check invariants in periodic or spec walls, not diffuse walls",
                        ]);
                        meta = `current ${describeMetricState(deltaEEl)} | use mono or ArH2 periodic for clean checks`;
                        break;
                    case "dP":
                        title = `dP/P0 ${Number.isFinite(metric.deltaP) ? metric.deltaP.toExponential(1) : "--"}`;
                        items = buildAdviceItems([
                            "green target: dP <= 2e-2",
                            "to reduce dP: use periodic or spec walls and lower dt",
                            "diffuse or mixed walls inject wall momentum by design",
                        ]);
                        meta = `current ${describeMetricState(deltaPEl)} | pressure walls are not invariant tests`;
                        break;
                    case "dxl":
                        title = `dx/λ ${Number.isFinite(metric.dxOverLambda) ? metric.dxOverLambda.toFixed(2) : "--"}`;
                        items = buildAdviceItems([
                            "green target: dx/λ <= .30",
                            "to make it greener: reduce dx or raise Kn",
                            "if npc becomes too low after reducing dx, raise N",
                        ]);
                        meta = `current ${describeMetricState(validityDxOverLambdaEl)} | cell width should stay below mean free path`;
                        break;
                    case "dtt":
                        title = `dt/τ ${Number.isFinite(metric.dtOverTau) ? metric.dtOverTau.toFixed(2) : "--"}`;
                        items = buildAdviceItems([
                            "green target: dt/τ <= .20",
                            "to make it greener: lower dt",
                            "if collisions become too rare after lowering dt, lower Kn carefully",
                        ]);
                        meta = `current ${describeMetricState(validityDtOverTauEl)} | timestep should stay below collision time`;
                        break;
                    case "npc":
                        title = `npc ${Number.isFinite(metric.npcell) ? metric.npcell.toFixed(1) : "--"}`;
                        items = buildAdviceItems([
                            "green target: 5 <= npc <= 30",
                            "to raise npc: increase N or increase dx",
                            "to lower npc: reduce N or reduce dx if cells are too crowded",
                        ]);
                        meta = `current ${describeMetricState(validityNpcellEl)} | particles per cell controls collision noise`;
                        break;
                    case "maj":
                        title = `maj ${metric.majorantCount}/${metric.majorantAttempts}`;
                        items = buildAdviceItems([
                            "green target: maj 0/attempts",
                            "to make it greener: lower dt, raise Kn, or soften strong wall temperature jumps",
                            metric.ntcOverflow
                                ? "NTC overflow: raise Kn, lower dt, or lower particle weight"
                                : "if maj stays red, run a calmer case before increasing density again",
                        ]);
                        meta = `current ${describeMetricState(validityMajorantEl)} | majorant violations mean the NTC envelope is too weak`;
                        break;
                    default:
                        items = buildAdviceItems([
                            "green target depends on the selected token",
                            "use the top row to change the run",
                            "use this footer to verify the run is numerically healthy",
                        ]);
                        break;
                }

                buildHelpPopup({
                    anchor,
                    title,
                    items,
                    withInput: false,
                    meta,
                    apply: () => {},
                });
            };

            const adjustFocusedToken = (direction) => {
                if (!activeHudToken) {
                    return false;
                }
                const token = activeHudToken.dataset.token;
                switch (token) {
                    case "case":
                        cycleCase(direction);
                        return true;
                    case "rho": {
                        const next = clamp(Number(densityScaleInput.value) + direction * 0.05, 0.05, 1.2);
                        densityScaleInput.value = next.toFixed(2);
                        densityScaleInput.dispatchEvent(new Event("input"));
                        syncHudTokens();
                        return true;
                    }
                    case "tl": {
                        const next = Math.max(50, (Number(wallTempLeftInput.value) || 300) + direction * 50);
                        setInputValue(wallTempLeftInput, String(next));
                        return true;
                    }
                    case "tr": {
                        const next = Math.max(50, (Number(wallTempRightInput.value) || 300) + direction * 50);
                        setInputValue(wallTempRightInput, String(next));
                        return true;
                    }
                    case "wall":
                        cycleBoundaryMode(direction);
                        return true;
                    case "n": {
                        const next = clamp(Math.round((Number(document.getElementById("particle-count").value) || 3200) + direction * 200), 250, 8000);
                        setInputValue(document.getElementById("particle-count"), String(next));
                        return true;
                    }
                    case "dx":
                        adjustCellSize(direction);
                        return true;
                    case "dt":
                        adjustDt(direction);
                        return true;
                    case "model":
                        cycleSelectValue(collisionModelSelect, direction);
                        syncHudTokens();
                        return true;
                    case "plot":
                        cycleSelectValue(miniViewSelect, direction);
                        syncHudTokens();
                        return true;
                    default:
                        return false;
                }
            };

            const getSpecies = (id) => {
                if (!sim.loadedCase || !sim.loadedCase.species[id]) {
                    throw new Error("load a case and species first");
                }
                return sim.loadedCase.species[id];
            };

            const computeMixtureMoments = () => {
                const count = core.state.count;
                const worldVolume = worldArea * dsmcDomainDepth;
                if (count === 0 || !(worldVolume > 0)) {
                    return {
                        bulkVelocity: [0, 0, 0],
                        temperature: 0,
                        pressure: 0,
                        thermalKinetic: 0,
                        numberDensity: 0,
                    };
                }

                let totalMass = 0.0;
                let momentumX = 0.0;
                let momentumY = 0.0;
                let momentumZ = 0.0;
                const vx = core.state.vx;
                const vy = core.state.vy;
                const vz = core.state.vz;
                const mass = core.state.mass;
                for (let i = 0; i < count; i += 1) {
                    totalMass += mass[i];
                    momentumX += mass[i] * vx[i];
                    momentumY += mass[i] * vy[i];
                    momentumZ += mass[i] * vz[i];
                }

                const invTotalMass = totalMass > 0 ? 1.0 / totalMass : 0.0;
                const bulkX = momentumX * invTotalMass;
                const bulkY = momentumY * invTotalMass;
                const bulkZ = momentumZ * invTotalMass;
                let thermalKinetic = 0.0;
                for (let i = 0; i < count; i += 1) {
                    const cx = vx[i] - bulkX;
                    const cy = vy[i] - bulkY;
                    const cz = vz[i] - bulkZ;
                    thermalKinetic += 0.5 * mass[i] * (cx * cx + cy * cy + cz * cz);
                }
                const numberDensity = count / worldVolume;
                const temperature = (2.0 * thermalKinetic) / (3.0 * count * Dsmc.KB);
                const pressure = numberDensity * Dsmc.KB * temperature;
                return {
                    bulkVelocity: [bulkX, bulkY, bulkZ],
                    temperature,
                    pressure,
                    thermalKinetic,
                    numberDensity,
                };
            };

            const computeRotationalTemperature = () => {
                const count = core.state.count;
                if (count === 0) {
                    return NaN;
                }
                const eRot = core.state.eRot;
                const rotDof = core.state.rotDof;
                let sumERot = 0.0;
                let sumDof = 0.0;
                for (let i = 0; i < count; i += 1) {
                    const dof = Number(rotDof[i] || 0);
                    if (dof > 0.0) {
                        sumERot += Number(eRot[i] || 0.0);
                        sumDof += dof;
                    }
                }
                if (!(sumDof > 0.0)) {
                    return NaN;
                }
                return 2.0 * sumERot / (sumDof * Dsmc.KB);
            };

            const populateSpecies = () => {
                speciesList.innerHTML = "";
                if (!sim.loadedCase) return;
                const names = Object.keys(sim.loadedCase.species);
                for (const name of names) {
                    const option = document.createElement("option");
                    option.value = name;
                    option.textContent = name;
                    speciesList.appendChild(option);
                }

                if (speciesAInput) {
                    const namesSafe = Object.keys(sim.loadedCase.species);
                    const fallbackA = namesSafe[0] || "";
                    const fallbackB = namesSafe[1] || namesSafe[0] || "";
                    const aValue = normalizeSpeciesInput(speciesAInput.value, fallbackA);
                    const bValue = normalizeSpeciesInput(speciesBInput?.value, fallbackB);
                    speciesAInput.value = aValue;
                    if (speciesBInput) {
                        speciesBInput.value = bValue;
                    }
                }
            };

            const loadCase = () => {
                const preset = getQuickPreset();
                if (preset) {
                    applyQuickPresetControls(caseSelect.value);
                    sim.loadedCase = Dsmc.loadHeatBathCase(preset.baseCase);
                } else {
                    sim.loadedCase = Dsmc.loadHeatBathCase(caseSelect.value);
                }
                invariantRef = null;
                syncSpeciesColors();
                populateSpecies();
                const tl = num("wall-temp-left");
                const tr = num("wall-temp-right");
                const base = sim.loadedCase.reference_temperature_k || 300;
                if (!Number.isFinite(tl) || tl <= 0) {
                    wallTempLeftInput.value = String(base);
                }
                if (!Number.isFinite(tr) || tr <= 0) {
                    wallTempRightInput.value = String(base);
                }
                setStatus("ok", true);
                syncHudTokens();
            };

            const ensureMiniBuffers = (count) => {
                if (miniState.speedScratch.length < count) {
                    let next = miniState.speedScratch.length;
                    if (next <= 0) {
                        next = 128;
                    }
                    while (next < count) {
                        next *= 2;
                    }
                    miniState.speedScratch = new Float32Array(next);
                }
                if (miniState.histogram.length !== miniState.bins) {
                    miniState.histogram = new Float32Array(miniState.bins);
                }
            };

            const pushMiniHistory = (
                meanSpeed,
                rmsSpeed,
                translTemp,
                bulkSpeed,
                pressure,
            ) => {
                const index = miniState.historyHead;
                miniState.meanHistory[index] = meanSpeed;
                miniState.rmsHistory[index] = rmsSpeed;
                miniState.tempHistory[index] = translTemp;
                miniState.bulkSpeedHistory[index] = bulkSpeed;
                miniState.pressureHistory[index] = pressure;
                miniState.historyHead = (index + 1) % miniState.historyLength;
                miniState.historyCount = Math.min(miniState.historyCount + 1, miniState.historyLength);
            };

            const renderMiniPanel = (mode, speedMax, sampleCount, meanMass = 0, translTemp = 0) => {
                const activeMode = resolveMiniMode(mode);
                if (activeMode === "off") {
                    return;
                }
                const rows = getMiniModeRows(activeMode);
                const title = miniModeConfig[activeMode].title;
                const plotRows = rows.length;
                const rowConfigs = rows.map((row, index) => {
                    return {
                        history: miniState[row.history],
                        label: row.label,
                        kind: row.kind,
                        color: index === 0 ? miniPalette.mean : index === 1 ? miniPalette.rms : miniPalette.temp,
                    };
                });

                const w = miniCanvas.width;
                const h = miniCanvas.height;
                miniCtx.clearRect(0, 0, w, h);
                miniCtx.fillStyle = "rgba(2, 6, 23, 0.96)";
                miniCtx.fillRect(0, 0, w, h);

                const bins = miniState.bins;
                const hist = miniState.histogram;
                const padX = 28;
                const padY = 6;
                const chartTop = padY;
                const chartLeft = padX;
                const chartRight = w - 6;
                const chartBottom = activeMode === "dist" ? h - 58 : h - 10;
                const chartHeight = Math.max(16, chartBottom - padY);
                const chartWidth = Math.max(1, chartRight - chartLeft);
                const showDist = activeMode === "dist";
                const trendTop = showDist ? chartBottom + 5 : chartTop;
                const trendBottom = h - 4;
                const trendHeight = Math.max(1, trendBottom - trendTop);
                const trendWidth = Math.max(1, chartWidth);
                const rowHeight = trendHeight / plotRows;
                const drawTitle = (text, x, y) => {
                    miniCtx.fillStyle = "#94a3b8";
                    miniCtx.font = "7px system-ui, sans-serif";
                    miniCtx.textAlign = "left";
                    miniCtx.textBaseline = "top";
                    miniCtx.fillText(text, x, y);
                };

                if (showDist) {
                    miniCtx.strokeStyle = "rgba(148, 163, 184, 0.45)";
                    miniCtx.lineWidth = 1;
                    miniCtx.strokeRect(chartLeft, chartTop, chartWidth, chartHeight);
                    miniCtx.fillStyle = "rgba(148, 163, 184, 0.25)";
                    miniCtx.fillRect(chartLeft, chartTop, chartWidth, chartHeight);
                }

                for (let i = 0; i < bins; i += 1) {
                    hist[i] = 0;
                }

                if (showDist && sampleCount > 0 && speedMax > 0) {
                    const speedScale = bins / (speedMax * 1.25);
                    const speeds = miniState.speedScratch;
                    for (let i = 0; i < sampleCount; i += 1) {
                        const bin = Math.min(
                            bins - 1,
                            Math.floor(speeds[i] * speedScale),
                        );
                        if (bin >= 0 && bin < bins) {
                            hist[bin] += 1;
                        }
                    }

                    let histMax = 1;
                    for (let i = 0; i < bins; i += 1) {
                        if (hist[i] > histMax) {
                            histMax = hist[i];
                        }
                    }
                    const barW = chartWidth / bins;
                    for (let i = 0; i < bins; i += 1) {
                        const value = hist[i];
                        const bh = (value / histMax) * (chartHeight - 6);
                        const x = chartLeft + i * barW;
                        miniCtx.fillStyle = `rgba(34, 211, 238, ${0.25 + (0.55 * value) / histMax})`;
                        miniCtx.fillRect(x + 1, chartTop + chartHeight - bh - 2, Math.max(1, barW - 1), bh);
                    }

                    miniCtx.beginPath();
                    miniCtx.strokeStyle = "rgba(34, 211, 238, 0.82)";
                    miniCtx.lineWidth = 1;
                    for (let i = 0; i < bins; i += 1) {
                        const x = chartLeft + (i + 0.5) * barW;
                        const top = chartTop + chartHeight - (hist[i] / histMax) * (chartHeight - 6) - 2;
                        if (i === 0) {
                            miniCtx.moveTo(x, top);
                        } else {
                            miniCtx.lineTo(x, top);
                        }
                    }
                    miniCtx.stroke();

                    if (translTemp > 0 && Number.isFinite(meanMass) && meanMass > 0) {
                        const speedSpan = Math.max(1e-12, speedMax * 1.25);
                        const modelScale = bins / speedSpan;
                        const binWidth = 1 / modelScale;
                        const beta = meanMass / (Dsmc.KB * Math.max(1e-12, translTemp));
                        const fit = new Float32Array(bins);
                        let maxModel = 1e-12;
                        for (let i = 0; i < bins; i += 1) {
                            const v = (i + 0.5) / modelScale;
                            const expected = beta * v * Math.exp(-0.5 * beta * v * v) * sampleCount * binWidth;
                            fit[i] = expected;
                            if (expected > maxModel) {
                                maxModel = expected;
                            }
                        }

                        miniCtx.beginPath();
                        miniCtx.strokeStyle = "rgba(251, 146, 60, 0.95)";
                        miniCtx.lineWidth = 1;
                        for (let i = 0; i < bins; i += 1) {
                            const x = chartLeft + i * barW;
                            const y = chartTop + chartHeight - 2 - (fit[i] / maxModel) * (chartHeight - 6);
                            if (i === 0) {
                                miniCtx.moveTo(x, y);
                            } else {
                                miniCtx.lineTo(x, y);
                            }
                        }
                        miniCtx.stroke();
                    }
                }

                if (!showDist) {
                    miniCtx.strokeStyle = "rgba(148, 163, 184, 0.32)";
                    miniCtx.lineWidth = 1;
                    miniCtx.setLineDash([2, 3]);
                    miniCtx.beginPath();
                    miniCtx.moveTo(chartLeft, chartTop);
                    miniCtx.lineTo(chartLeft, trendBottom);
                    miniCtx.lineTo(chartRight, trendBottom);
                    miniCtx.stroke();
                    miniCtx.setLineDash([]);
                }

                if (miniState.historyCount > 1) {
                    const count = miniState.historyCount;
                    const start = (miniState.historyHead - count + miniState.historyLength) % miniState.historyLength;
                    const xStep = trendWidth / Math.max(1, count - 1);

                    miniCtx.fillStyle = "rgba(148, 163, 184, 0.45)";
                    miniCtx.fillRect(chartLeft, trendTop - 2, trendWidth, trendHeight);

                    for (let row = 0; row < plotRows; row += 1) {
                        const config = rowConfigs[row];
                        const history = config.history;
                        let rowMin = Infinity;
                        let rowMax = -Infinity;
                        for (let i = 0; i < count; i += 1) {
                            const value = history[(start + i) % miniState.historyLength];
                            if (Number.isFinite(value)) {
                                if (value < rowMin) rowMin = value;
                                if (value > rowMax) rowMax = value;
                            }
                        }

                        if (!Number.isFinite(rowMin) || !Number.isFinite(rowMax)) {
                            continue;
                        }

                        const rowRange = Math.max(1e-6, rowMax - rowMin);
                        const top = trendTop + row * rowHeight;
                        const bottom = top + rowHeight - 2;
                        miniCtx.strokeStyle = config.color;
                        miniCtx.lineWidth = 1.2;
                        miniCtx.beginPath();
                        for (let i = 0; i < count; i += 1) {
                            const idx = (start + i) % miniState.historyLength;
                            const v = history[idx];
                            const x = chartLeft + xStep * i;
                            const y = bottom - ((v - rowMin) / rowRange) * (rowHeight - 4);
                            if (i === 0) {
                                miniCtx.moveTo(x, y);
                            } else {
                                miniCtx.lineTo(x, y);
                            }
                        }
                        miniCtx.stroke();
                        miniCtx.fillStyle = config.color;
                        miniCtx.fillText(config.label, chartLeft, top + 2);
                    }
                }

                drawTitle(showDist ? "speed dist" : title, chartLeft - 20, chartTop + 1);
            };

            const updateMiniMetricText = (mode, stats) => {
                const activeMode = resolveMiniMode(mode);
                const rows = getMiniModeRows(activeMode);
                const valueMap = {
                    mean: stats.meanSpeed,
                    rms: stats.rmsSpeed,
                    temp: stats.translTemp,
                    bulk: stats.bulkSpeed,
                    pressure: stats.pressure,
                };
                const values = [
                    valueMap[rows[0].key],
                    valueMap[rows[1].key],
                    valueMap[rows[2].key],
                ];
                miniMetricALabelEl.textContent = rows[0].label;
                miniMetricAEl.textContent = formatMiniValue(values[0], rows[0].kind);
                miniMetricBLabelEl.textContent = rows[1].label;
                miniMetricBEl.textContent = formatMiniValue(values[1], rows[1].kind);
                miniMetricCLabelEl.textContent = rows[2].label;
                miniMetricCEl.textContent = formatMiniValue(values[2], rows[2].kind);
            };

            const worldToPixelX = (x) => x * toWorldScaleX;
            const worldToPixelY = (y) => y * toWorldScaleY;

            const seed = () => {
                syncSimInputs();
                const n = Math.max(250, Math.min(8000, Math.floor(num("particle-count"))));
                const wallLeft = num("wall-temp-left");
                const wallRight = num("wall-temp-right");
                const t = (wallLeft + wallRight) * 0.5;
                core.setSeed(((Date.now() >>> 0) ^ ((performance.now() * 1000) >>> 0) ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0);
                if (!sim.loadedCase) {
                    throw new Error("load a case first");
                }
                const names = getActiveSpeciesPair();
                const indexBySpecies = {};
                if (names.length === 0) {
                    throw new Error("no valid species selected");
                }
                for (const name of names) {
                    getSpecies(name);
                }
                const particles = new Array(n);

                const isPeriodic = sim.boundaryMode === "periodic";
                const boundaryX = isPeriodic ? 0.0 : wallPadX;
                const boundaryY = isPeriodic ? 0.0 : wallPadY;
                for (let i = 0; i < n; i += 1) {
                    const species = names[(simRandom() * names.length) | 0];
                    const speciesData = getSpecies(species);
                    const x = simRandom() * (world.width - 2 * boundaryX) + boundaryX;
                    const y = simRandom() * (world.height - 2 * boundaryY) + boundaryY;
                    const rotDof = Math.max(0, Number(speciesData.rotational_degrees_of_freedom || 0));
                    const initialRotTemperature = t;

                    if (!indexBySpecies[species]) {
                        indexBySpecies[species] = [];
                    }
                    indexBySpecies[species].push(i);
                    particles[i] = {
                        x,
                        y,
                        vx: 0.0,
                        vy: 0.0,
                        vz: 0.0,
                        mass: speciesData.mass_kg,
                        species: speciesData.name,
                        speciesData,
                        rotDof,
                        eRot: 0.5 * rotDof * Dsmc.KB * initialRotTemperature,
                        color: getSpeciesColor(speciesData.name),
                        renderJitterX: (simRandom() - 0.5) * 0.7,
                        renderJitterY: (simRandom() - 0.5) * 0.7,
                    };
                }
                for (const name of names) {
                    const indices = indexBySpecies[name] || [];
                    if (indices.length === 0) {
                        continue;
                    }
                    const sample = Dsmc.maxwellVelocities(indices.length, getSpecies(name).mass_kg, t, [0, 0, 0], simRandom);
                    for (let i = 0; i < indices.length; i += 1) {
                        const pIndex = particles[indices[i]];
                        const [vx, vy, vz] = sample[i];
                        pIndex.vx = vx;
                        pIndex.vy = vy;
                        pIndex.vz = vz;
                    }
                }
                core.loadParticles(particles);
                resetCollisionLines();
                captureInvariantReference();
                buildCellCache({ preserveRemainders: false });
                countEl.textContent = String(core.state.count);
                sim.collisionsThisFrame = 0;
                sim.collisionsLastStep = 0;
                sim.collisionAttemptsLastStep = 0;
                sim.majorantViolationsLastStep = 0;
                sim.rotEventsLastStep = 0;
                sim.metrics.ntcOverflow = false;
                sim.stepCount = 0;
                stepEl.textContent = "step 0";
                syncHudTokens();
            };

            const wrapCoord = (value, min, max) => {
                const span = max - min;
                if (!(span > 0)) {
                    return min;
                }
                let wrapped = (value - min) % span;
                if (wrapped < 0) {
                    wrapped += span;
                }
                return min + wrapped;
            };

            const getCollisionSigmaTc = (speciesA, speciesB, relSpeed, referenceTemperatureK) => {
                if (sim.collisionModel === "hard-sphere") {
                    return Dsmc.hardSphereSigmaTCr(speciesA, speciesB, relSpeed);
                }
                return Dsmc.vhsVssSigmaTCr(speciesA, speciesB, relSpeed, referenceTemperatureK);
            };

            const getBoundaryWallTemperature = (normal, axis) => {
                if (axis === "x") {
                    return normal[0] > 0 ? num("wall-temp-left") : num("wall-temp-right");
                }
                const left = num("wall-temp-left");
                const right = num("wall-temp-right");
                return 0.5 * (left + right);
            };

            const getBoundaryWallVelocity = (normal, axis) => {
                return [0, 0, 0];
            };

            const sampleBoundaryVelocity = (mass, velocity, normal, axis = "x") => {
                const mode = sim.boundaryMode;
                const useDiffuse = mode === "diffuse" || (mode === "mixed" && simRandom() < sim.wallMixedAccommodation);
                if (useDiffuse) {
                    const wallTemperature = getBoundaryWallTemperature(normal, axis);
                    const sampled = Dsmc.diffuseWallVelocity(
                        wallTemperature,
                        mass,
                        normal,
                        getBoundaryWallVelocity(normal, axis),
                        simRandom,
                    );
                    if (axis === "x") {
                        if (normal[0] > 0 && sampled[0] < 0) {
                            sampled[0] = Math.abs(sampled[0]);
                        } else if (normal[0] < 0 && sampled[0] > 0) {
                            sampled[0] = -Math.abs(sampled[0]);
                        }
                    } else {
                        if (normal[1] > 0 && sampled[1] < 0) {
                            sampled[1] = Math.abs(sampled[1]);
                        } else if (normal[1] < 0 && sampled[1] > 0) {
                            sampled[1] = -Math.abs(sampled[1]);
                        }
                    }
                    return sampled;
                }
                return Dsmc.specularReflection(velocity, normal);
            };

            const move = (dt) => {
                const boundaryProfile = getBoundaryProfile();
                core.moveParticles(dt, {
                    boundaryMode: sim.boundaryMode,
                    xMode: boundaryProfile.xMode,
                    yMode: boundaryProfile.yMode,
                    left: boundaryProfile.xMode === "periodic" ? 0.0 : wallPadX,
                    right: boundaryProfile.xMode === "periodic" ? world.width : world.width - wallPadX,
                    bottom: boundaryProfile.yMode === "periodic" ? 0.0 : wallPadY,
                    top: boundaryProfile.yMode === "periodic" ? world.height : world.height - wallPadY,
                    wrapCoord,
                    reflectVelocity: (_index, normal, axis, mass, velocity) => sampleBoundaryVelocity(mass, velocity, normal, axis),
                });
            };

            const advanceSubstep = (dt) => {
                move(dt);
                buildCellCache();
                return collisionStep(dt);
            };

            const collisionStep = (dt) => {
                const stepDt = Math.max(1e-6, Number(dt) || sim.dt / Math.max(1, sim.substeps | 0));
                if (core.state.count < 2) {
                    sim.collisionsThisFrame = 0;
                    sim.collisionsLastStep = 0;
                    sim.collisionAttemptsLastStep = 0;
                    sim.majorantViolationsLastStep = 0;
                    sim.metrics.ntcOverflow = false;
                    return 0;
                }
                const result = core.collisionStep({
                    dt: stepDt,
                    ntcWeight: sim.ntcWeight,
                    ntcMargin: sim.ntcMargin,
                    referenceTemperatureK: sim.loadedCase ? sim.loadedCase.reference_temperature_k : 300.0,
                    cellVolume: cellState.cellW * cellState.cellH * dsmcDomainDepth,
                    collisionModel: sim.collisionModel,
                    enableRotationalLB: sim.enableRotationalLB === true,
                    random: simRandom,
                    collisionLineProbability: 0.25,
                    onCollision: addCollisionLine,
                });
                sim.collisionsThisFrame = result.collided;
                sim.collisionsLastStep = result.collided;
                sim.collisionAttemptsLastStep = result.attempted;
                sim.majorantViolationsLastStep = result.majorantViolations;
                sim.rotEventsLastStep = result.rotEvents || 0;
                sim.metrics.ntcOverflow = !!result.overflowed || (result.candidateOverflow || 0) > 0;
                return result.collided;
            };

            const render = (dtFrame = 1 / 60, trackStats = false) => {
                decayCollisionLines(dtFrame);
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                ctx.fillStyle = "#020617";
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                ctx.strokeStyle = "rgba(148, 163, 184, 0.72)";
                ctx.lineWidth = 1.2;
                ctx.strokeRect(0.5, 0.5, canvasWidth - 1, canvasHeight - 1);

                // Draw cells and occupancy heatmap.
                const cols = cellState.cols;
                const rows = cellState.rows;
                const maxCount = Math.max(1, cellState.maxCount);
                const cellPxW = cellState.cellW * toWorldScaleX;
                const cellPxH = cellState.cellH * toWorldScaleY;
                const isFastRender = sim.renderQuality === "fast";
                const drawGrid = !isFastRender && Math.max(cellState.cols, cellState.rows) <= 96;
                if (!isFastRender) {
                    for (let gy = 0; gy < rows; gy += 1) {
                        for (let gx = 0; gx < cols; gx += 1) {
                            const idx = gy * cols + gx;
                            const count = cellState.counts[idx];
                            const intensity = clamp01(count / maxCount);
                            const x1 = gx * cellPxW;
                            const y1 = gy * cellPxH;
                            if (count > 0) {
                                const alpha = Math.min(0.4, 0.05 + 0.35 * intensity);
                                ctx.fillStyle = `rgba(34, 211, 238, ${alpha.toFixed(3)})`;
                                ctx.fillRect(x1, y1, cellPxW, cellPxH);
                            }
                            if (drawGrid) {
                                ctx.strokeStyle = "rgba(148, 163, 184, 0.32)";
                                ctx.strokeRect(x1 + 0.5, y1 + 0.5, cellPxW - 1, cellPxH - 1);
                            }
                        }
                    }
                }

                // Draw collision markers.
                if (!isFastRender) {
                    for (let i = 0; i < collisionLines.length; i += 1) {
                        const mark = collisionLines[i];
                        const alpha = clamp01(mark.life * 0.9);
                        if (alpha <= 0) {
                            continue;
                        }
                        ctx.strokeStyle = `rgba(248, 113, 113, ${alpha.toFixed(3)})`;
                        ctx.lineWidth = 1.8;
                        ctx.beginPath();
                        ctx.moveTo(worldToPixelX(mark.x1), worldToPixelY(mark.y1));
                        ctx.lineTo(worldToPixelX(mark.x2), worldToPixelY(mark.y2));
                        ctx.stroke();
                    }
                }

                // Draw particles.
                const count = core.state.count;
                const xState = core.state.x;
                const yState = core.state.y;
                const vxState = core.state.vx;
                const vyState = core.state.vy;
                const vzState = core.state.vz;
                const massState = core.state.mass;
                const eRotState = core.state.eRot;
                const jitterXState = core.state.renderJitterX;
                const jitterYState = core.state.renderJitterY;
                const speciesIndexState = core.state.speciesIndex;
                const speciesColorsState = core.state.speciesColors;
                let speedSum = 0.0;
                let speedSqSum = 0.0;
                let kinetic = 0.0;
                let rotationalEnergy = 0.0;
                let speedMax = 0.0;
                let drawn = 0;
                let momentumXSum = 0.0;
                let momentumYSum = 0.0;
                let momentumZSum = 0.0;
                let massSum = 0.0;
                ensureMiniBuffers(count);
                const speedScratch = miniState.speedScratch;
                const supportsPath2D = typeof Path2D !== "undefined";
                const speciesPaths = !isFastRender && supportsPath2D ? new Array(speciesColorsState.length) : null;
                const speciesFastPaths = isFastRender && supportsPath2D ? new Array(speciesColorsState.length) : null;
                if (isFastRender) {
                    ctx.globalAlpha = 0.55;
                }
                for (let i = 0; i < count; i += 1) {
                    const speed2 = vxState[i] * vxState[i] + vyState[i] * vyState[i] + vzState[i] * vzState[i];
                    const speed = Math.sqrt(speed2);
                    speedSum += speed;
                    speedSqSum += speed2;
                    kinetic += 0.5 * massState[i] * speed2;
                    rotationalEnergy += Number(eRotState[i] || 0.0);
                    speedMax = Math.max(speedMax, speed);
                    momentumXSum += massState[i] * vxState[i];
                    momentumYSum += massState[i] * vyState[i];
                    momentumZSum += massState[i] * vzState[i];
                    massSum += massState[i];
                    speedScratch[drawn] = speed;
                    const px = worldToPixelX(xState[i]);
                    const py = worldToPixelY(yState[i]);
                    const color = speciesColorsState[speciesIndexState[i]] || "#94a3b8";
                    if (isFastRender && speciesFastPaths) {
                        const jitterScale = Number.isFinite(jitterXState[i]) ? jitterXState[i] : 0;
                        const x = px + jitterScale;
                        const y = py + (Number.isFinite(jitterYState[i]) ? jitterYState[i] : 0);
                        const speciesIdx = speciesIndexState[i];
                        let path = speciesFastPaths[speciesIdx];
                        if (!path) {
                            path = new Path2D();
                            speciesFastPaths[speciesIdx] = path;
                        }
                        path.rect(x - 1.1, y - 1.1, 2.2, 2.2);
                    } else if (isFastRender) {
                        const jitterScale = Number.isFinite(jitterXState[i]) ? jitterXState[i] : 0;
                        ctx.fillStyle = color;
                        const offset = 1.1;
                        const x = px + jitterScale;
                        const y = py + (Number.isFinite(jitterYState[i]) ? jitterYState[i] : 0);
                        ctx.fillRect(x - offset, y - offset, 2.2, 2.2);
                    } else if (speciesPaths) {
                        const jitterX = jitterXState[i] || 0;
                        const jitterY = jitterYState[i] || 0;
                        const speciesIdx = speciesIndexState[i];
                        let path = speciesPaths[speciesIdx];
                        if (!path) {
                            path = new Path2D();
                            speciesPaths[speciesIdx] = path;
                        }
                        path.moveTo(px + jitterX + simParticleRadiusPx, py + jitterY);
                        path.arc(
                            px + jitterX,
                            py + jitterY,
                            simParticleRadiusPx,
                            0,
                            Math.PI * 2,
                        );
                    } else {
                        ctx.beginPath();
                        ctx.globalAlpha = 0.78;
                        ctx.fillStyle = color;
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 1.0;
                        ctx.arc(
                            px + (jitterXState[i] || 0),
                            py + (jitterYState[i] || 0),
                            simParticleRadiusPx,
                            0,
                            Math.PI * 2,
                        );
                        ctx.fill();
                        ctx.stroke();
                        ctx.globalAlpha = 1.0;
                    }
                    drawn += 1;
                }
                if (speciesFastPaths) {
                    for (let i = 0; i < speciesFastPaths.length; i += 1) {
                        const path = speciesFastPaths[i];
                        if (!path) {
                            continue;
                        }
                        ctx.fillStyle = speciesColorsState[i] || "#94a3b8";
                        ctx.fill(path);
                    }
                }
                if (speciesPaths) {
                    ctx.globalAlpha = 0.78;
                    ctx.lineWidth = 1.0;
                    for (let i = 0; i < speciesPaths.length; i += 1) {
                        const path = speciesPaths[i];
                        if (!path) {
                            continue;
                        }
                        const color = speciesColorsState[i] || "#94a3b8";
                        ctx.fillStyle = color;
                        ctx.strokeStyle = color;
                        ctx.fill(path);
                        ctx.stroke(path);
                    }
                    ctx.globalAlpha = 1.0;
                }
                if (isFastRender) {
                    ctx.globalAlpha = 1.0;
                }
                if (drawn === 0) {
                    ctx.fillStyle = "#f8fafc";
                    ctx.font = "bold 18px Arial, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("0 PARTICLES - check case loading", canvasWidth / 2, canvasHeight / 2);
                }
                const n = Math.max(1, count);
                const avg = speedSum / n;
                const rms = Math.sqrt(Math.max(0, speedSqSum / n));
                const moments = computeMixtureMoments();
                const tRot = computeRotationalTemperature();
                const translTemp = moments.temperature;
                const bulkSpeed = Math.hypot(moments.bulkVelocity[0], moments.bulkVelocity[1]);
                const meanMass = massSum / n;
                const worldVolume = worldArea * dsmcDomainDepth;
                const density = moments.numberDensity;
                const pressure = moments.pressure;
                meanSpeedEl.textContent = avg.toFixed(1);
                countEl.textContent = count;
                occupancyEl.textContent = `${cellState.occupiedCells}/${cellState.totalCells}`;
                const nParticles = count;
                const npcell = nParticles > 0 ? nParticles / Math.max(1, cellState.totalCells) : 0;
                const realDensity = nParticles * sim.ntcWeight / worldVolume;
                const names = Object.keys(sim.loadedCase?.species || {});
                const activePair = getActiveSpeciesPair();
                sim.metrics.translTemp = translTemp;
                sim.metrics.collisionCount = sim.collisionsThisFrame;
                sim.metrics.npcell = npcell;
                sim.metrics.majorantCount = sim.majorantViolationsLastStep;
                sim.metrics.majorantAttempts = sim.collisionAttemptsLastStep;
                sim.metrics.rotationalTemp = tRot;
                sim.metrics.dxOverLambda = NaN;
                sim.metrics.dtOverTau = NaN;
                let validityResolved = false;
                if (names.length > 0 && nParticles > 0 && realDensity > 0) {
                    const sa = getSpecies(activePair[0]);
                    const sb = getSpecies(activePair[Math.min(1, Math.max(0, activePair.length - 1))] || activePair[0]);
                    const relSpeedForDiag = Math.max(1e-12, Math.sqrt(2) * rms);
                    const invRef = sim.loadedCase ? sim.loadedCase.reference_temperature_k : Math.max(1, translTemp);
                    const sigmaTc = getCollisionSigmaTc(sa, sb, relSpeedForDiag, invRef);
                    const collisionXsection = Math.max(1e-30, sigmaTc / relSpeedForDiag);
                    const lambda = Math.max(1e-12, Dsmc.meanFreePathM(realDensity, collisionXsection));
                    const tau = Math.max(1e-12, 1 / (realDensity * collisionXsection * relSpeedForDiag));
                    const dxOverLambda = cellState.cellW / lambda;
                    const dtOverTau = sim.dt / tau;
                    const collisionCount = sim.collisionsThisFrame;
                    const cRate = collisionCount / Math.max(1, nParticles);
                    sim.metrics.dxOverLambda = dxOverLambda;
                    sim.metrics.dtOverTau = dtOverTau;

                    const setValidity = (el, value, label, green, yellow) => {
                        const text = Number.isFinite(value) ? value.toFixed(2) : "--";
                        el.textContent = `${label} ${text}`;
                        let cls = "bad";
                        if (value <= green) {
                            cls = "good";
                        } else if (value <= yellow) {
                            cls = "warn";
                        }
                        if (!Number.isFinite(value) || value < 0) {
                            cls = "bad";
                        }
                        el.className = `tok ${cls}`;
                    };

                    setValidity(validityDxOverLambdaEl, dxOverLambda, "dx/λ", 0.3, 0.6);
                    setValidity(validityDtOverTauEl, dtOverTau, "dt/τ", 0.2, 0.4);
                    const majorantAttempts = sim.collisionAttemptsLastStep;
                    const majorantCount = sim.majorantViolationsLastStep;
                    const majorantRatio = majorantAttempts > 0 ? majorantCount / majorantAttempts : 0;
                    if (sim.metrics.ntcOverflow) {
                        validityMajorantEl.textContent = "NTC overflow";
                        validityMajorantEl.className = "tok bad";
                        validityMajorantEl.title = "NTC overflow: raise Kn, lower dt, or lower particle weight";
                    } else if (majorantAttempts > 0) {
                        setValidity(validityMajorantEl, majorantRatio, "maj", 0.0, 0.02);
                        validityMajorantEl.textContent = `maj ${majorantCount}/${majorantAttempts}`;
                        validityMajorantEl.title = "";
                    } else {
                        validityMajorantEl.textContent = "maj --";
                        validityMajorantEl.className = "tok neutral";
                        validityMajorantEl.title = "";
                    }
                    validityNpcellEl.textContent = `npc ${npcell.toFixed(1)}`;
                    if (npcell >= 5 && npcell <= 30) {
                        validityNpcellEl.className = "tok good";
                    } else if (npcell >= 2 && npcell <= 80) {
                        validityNpcellEl.className = "tok warn";
                    } else {
                        validityNpcellEl.className = "tok bad";
                    }
                    validityResolved = true;
                }
                if (!validityResolved) {
                    validityDxOverLambdaEl.className = "tok bad";
                    validityDtOverTauEl.className = "tok bad";
                    validityNpcellEl.className = "tok bad";
                    validityMajorantEl.className = "tok bad";
                    validityDxOverLambdaEl.textContent = "dx/λ --";
                    validityDtOverTauEl.textContent = "dt/τ --";
                    validityNpcellEl.textContent = `npc ${npcell.toFixed(1)}`;
                    validityMajorantEl.textContent = "maj --";
                }

                const setDiagnosticMetric = (el, value, text, green, yellow) => {
                    el.textContent = text;
                    el.className = `tok ${clampMetricClass(value, green, yellow).replace("validity-", "")}`;
                };
                const collisionCount = sim.collisionsThisFrame;
                const cRate = collisionCount / Math.max(1, nParticles);
                if (invariantRef) {
                    const refEnergy = invariantRef.energy;
                    const refMomentum = invariantRef.momentum;
                    const refMomentumMag = invariantRef.momentumMag;
                    if (refEnergy > 0) {
                        const deltaE = Math.abs((kinetic + rotationalEnergy) - refEnergy) / refEnergy;
                        sim.metrics.deltaE = deltaE;
                        setDiagnosticMetric(deltaEEl, deltaE, `dE/E0 ${deltaE.toFixed(3)}`, 0.02, 0.06);
                    } else {
                        sim.metrics.deltaE = NaN;
                        deltaEEl.textContent = "dE/E0 --";
                        deltaEEl.className = "tok bad";
                    }

                    const dpx = momentumXSum - refMomentum[0];
                    const dpy = momentumYSum - refMomentum[1];
                    const dpz = momentumZSum - refMomentum[2];
                    const deltaPAbs = Math.hypot(dpx, dpy, dpz);
                    if (refMomentumMag > 1e-30) {
                        const deltaP = deltaPAbs / refMomentumMag;
                        sim.metrics.deltaP = deltaP;
                        setDiagnosticMetric(deltaPEl, deltaP, `dP/P0 ${deltaP.toExponential(1)}`, 0.02, 0.06);
                    } else {
                        sim.metrics.deltaP = NaN;
                        deltaPEl.textContent = "dP/P0 --";
                        deltaPEl.className = "tok neutral";
                    }
                } else {
                    sim.metrics.deltaE = NaN;
                    sim.metrics.deltaP = NaN;
                    deltaEEl.textContent = "dE/E0 --";
                    deltaPEl.textContent = "dP/P0 --";
                    deltaEEl.className = "tok bad";
                    deltaPEl.className = "tok bad";
                }
                diagTempEl.textContent = `T ${Number.isFinite(translTemp) ? `${translTemp.toFixed(0)}K` : "--"}`;
                diagTempEl.className = `tok ${Number.isFinite(translTemp) ? "good" : "bad"}`;
                setDiagnosticMetric(diagCollisionsEl, cRate, `col ${collisionCount}`, 0.1, 0.3);
                if (diagTrotEl) {
                    diagTrotEl.textContent = Number.isFinite(tRot) ? `Trot ${tRot.toFixed(0)}K` : "Trot --";
                    diagTrotEl.className = `tok ${Number.isFinite(tRot) ? "good" : "neutral"}`;
                }
                if (diagRotEventsEl) {
                    diagRotEventsEl.textContent = `rot ${sim.rotEventsLastStep || 0}`;
                    diagRotEventsEl.className = `tok ${(sim.rotEventsLastStep || 0) > 0 ? "good" : "neutral"}`;
                }
                stepEl.textContent = `step ${sim.stepCount}`;

                if (trackStats) {
                    miniFrameTick += 1;
                    const activeMiniMode = resolveMiniMode(miniViewSelect.value);
                    if (activeMiniMode === "off") {
                        return;
                    }
                    const shouldTrackMini = !isFastRender || (miniFrameTick % 4 === 0);
                    if (shouldTrackMini) {
                        pushMiniHistory(avg, rms, translTemp, bulkSpeed, pressure);
                        updateMiniMetricText(activeMiniMode, {
                            meanSpeed: avg,
                            rmsSpeed: rms,
                            translTemp,
                            bulkSpeed,
                            pressure,
                        });
                        renderMiniPanel(activeMiniMode, speedMax, drawn, meanMass, translTemp);
                    }
                }
            };

            const stepSimulation = (solverSteps = 1) => {
                syncSimInputs();
                const totalSolverSteps = Math.max(1, solverSteps | 0);
                const substeps = Math.max(1, sim.substeps | 0);
                const dt = sim.dt / substeps;
                let collided = 0;
                for (let stepIndex = 0; stepIndex < totalSolverSteps; stepIndex += 1) {
                    for (let s = 0; s < substeps; s += 1) {
                        collided += advanceSubstep(dt);
                    }
                }
                sim.collisionsThisFrame = collided;
                sim.stepCount += totalSolverSteps;
                sim.metrics.solverStepsPerFrame = totalSolverSteps;
                render(1 / 60, true);
            };

            let lastFrame = performance.now();
            let frameCounter = 0;
            let fpsAccum = 0;
            let miniFrameTick = 0;
            const loop = (time) => {
                const dtFrame = Math.max(0.001, (time - lastFrame) / 1000);
                lastFrame = time;
                fpsAccum += dtFrame;
                frameCounter += 1;
                if (fpsAccum > 0.7) {
                    sim.metrics.fps = frameCounter / fpsAccum;
                    fpsEl.textContent = `fps ${sim.metrics.fps.toFixed(0)}`;
                    frameCounter = 0;
                    fpsAccum = 0;
                }

                if (sim.running) {
                    stepSimulation(getAdaptiveSolverStepsPerFrame());
                } else {
                        sim.metrics.solverStepsPerFrame = 0;
                        render(dtFrame, false);
                }
                sim.frameId = requestAnimationFrame(loop);
            };

            const reconfigureCells = () => {
                const prevTotalCells = cellState.totalCells;
                const prevCols = cellState.cols;
                const prevRows = cellState.rows;
                updateGridLayout();
                const resized = prevTotalCells !== cellState.totalCells || prevCols !== cellState.cols || prevRows !== cellState.rows;
                buildCellCache({ preserveRemainders: !resized });
            };

            const registerHudTokens = () => {
                const numericBindings = [
                    [tokRhoBtn, "Knudsen number", densityScaleInput, ["0.05", "0.10", "0.20", "0.30", "0.50", "0.80", "1.20"], "click, [ ] tune"],
                    [tokTlBtn, "left wall temperature", wallTempLeftInput, resolveDatalistValues("wall-temp-presets"), "click or type"],
                    [tokTrBtn, "right wall temperature", wallTempRightInput, resolveDatalistValues("wall-temp-presets"), "click or type"],
                    [tokNBtn, "particle count", document.getElementById("particle-count"), resolveDatalistValues("particle-presets"), "click or type"],
                    [tokDxBtn, "cell size", cellSizeInput, resolveDatalistValues("cell-size-presets"), "click or [ ] tune"],
                    [tokDtBtn, "time step", simDtInput, resolveDatalistValues("dt-presets"), "click or [ ] tune"],
                ];
                for (const [button, title, input, values, meta] of numericBindings) {
                    button.addEventListener("click", () => {
                        openValuePopup(button, title, input, values, meta);
                    });
                }

                tokCaseBtn.addEventListener("click", () => {
                    openSelectPopup(tokCaseBtn, "case", caseSelect, CASE_LABEL, "C/V cycle case | eq periodic Ar box | wallT diffuse wall Ar");
                });
                tokGasBtn.addEventListener("click", openGasPopup);
                tokWallBtn.addEventListener("click", openWallPopup);
                tokModelBtn.addEventListener("click", () => {
                    openSelectPopup(tokModelBtn, "collision model", collisionModelSelect, {
                        "hard-sphere": "HS",
                        vhs: "VHS",
                        vss: "VSS",
                    }, "HS isotropic | VHS speed-dependent | VSS anisotropic");
                });
                tokPlotBtn.addEventListener("click", () => {
                    openSelectPopup(tokPlotBtn, "plot", miniViewSelect, PLOT_LABEL, "M cycle plot");
                });
                tokHelpBtn.addEventListener("click", () => showHelpOverlay(tokHelpBtn));
                if (tokHelpFooterBtn) {
                    tokHelpFooterBtn.addEventListener("click", () => showHelpOverlay(tokHelpFooterBtn));
                }
                if (tokToggleBtn) {
                    tokToggleBtn.addEventListener("click", () => setRunning(!sim.running));
                }
                [
                    [statusEl, "status"],
                    [fpsEl, "fps"],
                    [stepEl, "step"],
                    [diagTempEl, "temp"],
                    [diagCollisionsEl, "col"],
                    [diagTrotEl, "trot"],
                    [diagRotEventsEl, "rot"],
                    [deltaEEl, "dE"],
                    [deltaPEl, "dP"],
                    [validityDxOverLambdaEl, "dxl"],
                    [validityDtOverTauEl, "dtt"],
                    [validityNpcellEl, "npc"],
                    [validityMajorantEl, "maj"],
                ].forEach(([el, key]) => {
                    if (!el) {
                        return;
                    }
                    el.classList.add("helpable");
                    el.addEventListener("click", () => openFooterAdvice(el, key));
                });

                fieldHelpAddEvents();
            };

            const fieldHelpAddEvents = () => {
                fieldHelpList.addEventListener("click", (event) => {
                    const button = event.target.closest("button");
                    if (!button || button.dataset.value === undefined) {
                        return;
                    }
                    applyHelpValue(button.dataset.value);
                });
                fieldHelpEntry.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        applyHelpValue(fieldHelpEntry.value);
                    } else if (event.key === "Escape") {
                        hideHelpPopup();
                    }
                });
                document.addEventListener("mousedown", (event) => {
                    if (!fieldHelp.contains(event.target)) {
                        hideHelpPopup();
                    }
                });
                window.addEventListener("scroll", hideHelpPopup, true);
                window.addEventListener("resize", hideHelpPopup);
            };

            const cycleCase = (step = 1) => {
                const options = caseSelect.options;
                if (options.length === 0) {
                    return;
                }
                const next = ((caseSelect.selectedIndex + step) % options.length + options.length) % options.length;
                caseSelect.selectedIndex = next;
                caseSelect.dispatchEvent(new Event("change"));
            };

            const cycleBoundaryMode = (step = 1) => {
                const options = boundaryModeSelect.options;
                if (options.length === 0) {
                    return;
                }
                const next = ((boundaryModeSelect.selectedIndex + step) % options.length + options.length) % options.length;
                boundaryModeSelect.selectedIndex = next;
                boundaryModeSelect.dispatchEvent(new Event("change"));
            };

            const refreshDensityDisplay = () => {
                densityScaleDisplay.textContent = Number(densityScaleInput.value).toFixed(2);
            };
            const updateBoundaryRowState = () => {
                if (wallMixedRow) {
                    wallMixedRow.style.display = boundaryModeSelect.value === "mixed" ? "flex" : "none";
                }
            };
            const refreshInputs = () => {
                withTry(() => {
                    syncSimInputs();
                    reconfigureCells();
                    syncHudTokens();
                    render(1 / 60, true);
                });
            };

            densityScaleInput.addEventListener("input", () => {
                refreshDensityDisplay();
                refreshInputs();
            });
            densityScaleInput.addEventListener("change", () => {
                refreshDensityDisplay();
                refreshInputs();
            });
            wallTempLeftInput.addEventListener("change", refreshInputs);
            wallTempRightInput.addEventListener("change", refreshInputs);
            wallMixedAccommodationInput.addEventListener("change", refreshInputs);
            cellSizeInput.addEventListener("change", refreshInputs);
            simDtInput.addEventListener("change", refreshInputs);
            document.getElementById("particle-count").addEventListener("change", () => {
                withTry(() => {
                    setRunning(false);
                    seed();
                    render(1 / 60, true);
                });
            });
            speciesAInput.addEventListener("change", () => {
                withTry(() => {
                    setRunning(false);
                    seed();
                    render(1 / 60, true);
                });
            });
            speciesBInput.addEventListener("change", () => {
                withTry(() => {
                    setRunning(false);
                    seed();
                    render(1 / 60, true);
                });
            });
            collisionModelSelect.addEventListener("change", refreshInputs);
            renderQualitySelect.addEventListener("change", refreshInputs);
            miniViewSelect.addEventListener("change", () => {
                withTry(() => {
                    syncHudTokens();
                    render(1 / 60, true);
                });
            });
            caseSelect.addEventListener("change", () => {
                withTry(() => {
                    setRunning(false);
                    loadCase();
                    seed();
                    syncHudTokens();
                    render(1 / 60, true);
                });
            });
            document.getElementById("seed").addEventListener("click", () => {
                withTry(() => {
                    seed();
                    setRunning(false);
                    render(1 / 60, true);
                });
            });
            document.getElementById("step").addEventListener("click", () => {
                withTry(() => {
                    setRunning(false);
                    stepSimulation();
                });
            });
            [simDtInput, wallTempLeftInput, wallTempRightInput, wallMixedAccommodationInput, cellSizeInput].forEach((control) => {
                control.addEventListener("change", () => {
                    withTry(syncSimInputs);
                });
            });
            if (cellSizeDecBtn) {
                cellSizeDecBtn.addEventListener("click", () => {
                    withTry(() => {
                        adjustCellSize(-1);
                    });
                });
            }
            if (cellSizeIncBtn) {
                cellSizeIncBtn.addEventListener("click", () => {
                    withTry(() => {
                        adjustCellSize(1);
                    });
                });
            }
            if (dtDecBtn) {
                dtDecBtn.addEventListener("click", () => {
                    withTry(() => {
                        adjustDt(-1);
                    });
                });
            }
            if (dtIncBtn) {
                dtIncBtn.addEventListener("click", () => {
                    withTry(() => {
                        adjustDt(1);
                    });
                });
            }
            const burstBtn = document.getElementById("burst");
            if (burstBtn) {
                burstBtn.addEventListener("click", () => {
                    withTry(() => {
                        syncSimInputs();
                        const substeps = Math.max(1, sim.substeps | 0);
                        const dt = sim.dt / substeps;
                        let total = 0;
                        const burstCycles = 6;
                        for (let i = 0; i < burstCycles; i += 1) {
                            total += advanceSubstep(dt);
                        }
                        sim.collisionsThisFrame = total;
                        sim.stepCount += burstCycles;
                        render(1 / 60, true);
                    });
                });
            }
            document.getElementById("toggle").addEventListener("click", () => {
                setRunning(!sim.running);
            });
            document.addEventListener("keydown", (event) => {
                if (isTextInputTarget(event.target)) {
                    return;
                }
                if (event.code === "BracketLeft") {
                    event.preventDefault();
                    if (adjustFocusedToken(-1)) {
                        return;
                    }
                }
                if (event.code === "BracketRight") {
                    event.preventDefault();
                    if (adjustFocusedToken(1)) {
                        return;
                    }
                }
                if (event.code === "Space") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        document.getElementById("toggle").click();
                    });
                    return;
                }
                if (event.code === "KeyR") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        seed();
                        setRunning(false);
                        render(1 / 60, true);
                    });
                    return;
                }
                if (event.code === "KeyS") {
                    event.preventDefault();
                    runKeybindAction(stepSimulation);
                    return;
                }
                if (event.code === "KeyB") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        syncSimInputs();
                        const substeps = Math.max(1, sim.substeps | 0);
                        const dt = sim.dt / substeps;
                        let total = 0;
                        const burstCycles = 6;
                        for (let i = 0; i < burstCycles; i += 1) {
                            total += advanceSubstep(dt);
                        }
                        sim.collisionsThisFrame = total;
                        sim.stepCount += burstCycles;
                        render(1 / 60, true);
                    });
                    return;
                }
                if (event.code === "KeyC") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        cycleCase(1);
                    });
                    return;
                }
                if (event.code === "KeyV") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        cycleCase(-1);
                    });
                    return;
                }
                if (event.code === "KeyX") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        cycleBoundaryMode(1);
                    });
                    return;
                }
                if (event.code === "KeyL") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        toggleRotationalLB();
                    });
                    return;
                }
                if (event.code === "KeyM") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        cycleSelectValue(miniViewSelect, 1);
                        syncHudTokens();
                    });
                    return;
                }
                if (event.code === "Slash") {
                    event.preventDefault();
                    runKeybindAction(() => {
                        showHelpOverlay(tokHelpBtn || tokHelpFooterBtn);
                    });
                    return;
                }
            });
            boundaryModeSelect.addEventListener("change", (ev) => {
                sim.boundaryMode = ev.target.value;
                updateBoundaryRowState();
                const isPeriodic = sim.boundaryMode === "periodic";
                core.applyBoundaries({
                    boundaryMode: sim.boundaryMode,
                    left: isPeriodic ? 0.0 : wallPadX,
                    right: isPeriodic ? world.width : world.width - wallPadX,
                    bottom: isPeriodic ? 0.0 : wallPadY,
                    top: isPeriodic ? world.height : world.height - wallPadY,
                    wrapCoord,
                    reflectVelocity: (_index, normal, axis, mass, velocity) => sampleBoundaryVelocity(mass, velocity, normal, axis),
                });
                buildCellCache();
                setStatus("ok", true);
                syncHudTokens();
            });

            withTry(() => {
                registerHudTokens();
                sim.boundaryMode = boundaryModeSelect.value || "specular";
                sim.collisionModel = collisionModelSelect.value || "vhs";
                refreshDensityDisplay();
                updateBoundaryRowState();
                loadCase();
                syncSimInputs();
                updateGridLayout();
                seed();
                buildCellCache();
                syncHudTokens();
                render(1 / 60, true);
                sim.frameId = requestAnimationFrame(loop);
            });
        })();
    
