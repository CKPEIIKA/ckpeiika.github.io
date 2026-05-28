    const Dsmc = (() => {
    "use strict";

    const KB = 1.380649e-23;
    const ATM_PA = 101325.0;
    const GAS_CONSTANT = 8.31446261815324;
    const AMU = 1.66053906660e-27;

    const ACTIVE_COLLISION_MODEL_LABEL = "elastic_hs_vhs_vss";

    const SPECIES_OVERRIDES = Object.freeze({
        H2:  { mass_kg: 2.01588 * AMU, rotational_degrees_of_freedom: 2, rotational_relaxation_collision_number: 5.0 },
        N2:  { mass_kg: 28.0134 * AMU, rotational_degrees_of_freedom: 2, rotational_relaxation_collision_number: 5.0 },
        O2:  { mass_kg: 31.9980 * AMU, rotational_degrees_of_freedom: 2, rotational_relaxation_collision_number: 5.0 },
        NO:  { mass_kg: 30.0060 * AMU, rotational_degrees_of_freedom: 2, rotational_relaxation_collision_number: 5.0 },
        CO:  { mass_kg: 28.0101 * AMU, rotational_degrees_of_freedom: 2, rotational_relaxation_collision_number: 5.0 },

        CO2: { mass_kg: 44.0095 * AMU, rotational_degrees_of_freedom: 2, rotational_relaxation_collision_number: 10.0 },
        CH4: { mass_kg: 16.0430 * AMU, rotational_degrees_of_freedom: 3, rotational_relaxation_collision_number: 10.0 },

        Ar:  { mass_kg: 39.9480 * AMU, rotational_degrees_of_freedom: 0, rotational_relaxation_collision_number: Infinity },
        He:  { mass_kg: 4.00260 * AMU, rotational_degrees_of_freedom: 0, rotational_relaxation_collision_number: Infinity },
        Ne:  { mass_kg: 20.1797 * AMU, rotational_degrees_of_freedom: 0, rotational_relaxation_collision_number: Infinity },
        N:   { mass_kg: 14.0067 * AMU, rotational_degrees_of_freedom: 0, rotational_relaxation_collision_number: Infinity },
        O:   { mass_kg: 15.9990 * AMU, rotational_degrees_of_freedom: 0, rotational_relaxation_collision_number: Infinity },
    });

    const DSMC_CASES = {
        metadata: {
            role: "elastic_dsmc_demo",
            case_count: 2,
        },
        cases: [
            {
                case_id: "monospecies_heat_bath",
                collision_model: ACTIVE_COLLISION_MODEL_LABEL,
                partner_selection: "no_time_counter",
                rotational_relaxation_collision_number: 1.0,
                vibrational_relaxation_collision_number: 1.0,
                electronic_relaxation_collision_number: 1.0,
                reference_temperature_k: 300.0,
                species: [
                    {
                        name: "Ar",
                        mass_kg: 39.948 * AMU,
                        diameter_m: 3.542e-10,
                        viscosity_temperature_exponent: 0.81,
                        vss_alpha: 1.0,
                        rotational_degrees_of_freedom: 0,
                        vibrational_characteristic_temperatures_k: [],
                        vibrational_dissociation_temperatures_k: [],
                        vibrational_z_ref: [],
                        vibrational_z_ref_temperature_k: [],
                    },
                ],
            },
            {
                case_id: "n2_heat_bath",
                collision_model: ACTIVE_COLLISION_MODEL_LABEL,
                partner_selection: "no_time_counter",
                rotational_relaxation_collision_number: 1.0,
                vibrational_relaxation_collision_number: 1.0,
                electronic_relaxation_collision_number: 1.0,
                reference_temperature_k: 300.0,
                species: [
                    {
                        name: "N2",
                        mass_kg: 28.0134 * AMU,
                        diameter_m: 4.17e-10,
                        viscosity_temperature_exponent: 0.74,
                        vss_alpha: 1.36,
                        rotational_degrees_of_freedom: 2,
                        vibrational_characteristic_temperatures_k: [3371.0],
                        vibrational_dissociation_temperatures_k: [113500.0],
                        vibrational_z_ref: [52560.0],
                        vibrational_z_ref_temperature_k: [3371.0],
                    },
                ],
            },
        ],
    };

    class DsmcSpecies {
        constructor({
            name,
            mass_kg,
            diameter_m,
            viscosity_temperature_exponent,
            vss_alpha = 1.0,
            rotational_degrees_of_freedom = 0,
            rotational_relaxation_collision_number = null,
            vibrational_characteristic_temperatures_k = [],
            vibrational_dissociation_temperatures_k = [],
            vibrational_z_ref = [],
            vibrational_z_ref_temperature_k = [],
        }) {
            this.name = String(name);
            this.mass_kg = Number(mass_kg);
            this.diameter_m = Number(diameter_m);
            this.viscosity_temperature_exponent = Number(viscosity_temperature_exponent);
            this.vss_alpha = Number(vss_alpha);
            this.rotational_degrees_of_freedom = Number(rotational_degrees_of_freedom);
            const zRot = Number(rotational_relaxation_collision_number);
            this.rotational_relaxation_collision_number = this.rotational_degrees_of_freedom > 0
                ? (Number.isFinite(zRot) && zRot > 0.0 ? zRot : 5.0)
                : Infinity;
            this.vibrational_characteristic_temperatures_k = Array.from(vibrational_characteristic_temperatures_k, Number);
            this.vibrational_dissociation_temperatures_k = Array.from(vibrational_dissociation_temperatures_k, Number);
            this.vibrational_z_ref = Array.from(vibrational_z_ref, Number);
            this.vibrational_z_ref_temperature_k = Array.from(vibrational_z_ref_temperature_k, Number);
            if (!(this.mass_kg > 0.0) || !(this.diameter_m > 0.0)) {
                fail(`invalid species data for ${this.name}`);
            }
            Object.freeze(this);
        }
    }

    class HeatBathCase {
        constructor({
            case_id,
            collision_model,
            partner_selection,
            reference_temperature_k,
            rotational_relaxation_collision_number,
            vibrational_relaxation_collision_number,
            electronic_relaxation_collision_number,
            species,
        }) {
            this.case_id = String(case_id);
            this.collision_model = String(collision_model);
            this.partner_selection = String(partner_selection);
            this.reference_temperature_k = Number(reference_temperature_k);
            this.rotational_relaxation_collision_number = Number(rotational_relaxation_collision_number);
            this.vibrational_relaxation_collision_number = Number(vibrational_relaxation_collision_number);
            this.electronic_relaxation_collision_number = Number(electronic_relaxation_collision_number);
            this.species = species;
            Object.freeze(this.species);
            Object.freeze(this);
        }
    }

    function fail(message) {
        throw new Error(message);
    }

    function asVector3(value, name) {
        if (!Array.isArray(value) && !(value instanceof Float64Array)) {
            fail(`${name} must be an array-like`);
        }
        if (value.length !== 3) {
            fail(`${name} must be a 3-vector`);
        }
        const vector = [Number(value[0]), Number(value[1]), Number(value[2])];
        if (!vector.every((x) => Number.isFinite(x))) {
            fail(`${name} must contain finite numbers`);
        }
        return vector;
    }

    function unitVector(value, name) {
        const vector = asVector3(value, name);
        const norm = Math.hypot(vector[0], vector[1], vector[2]);
        if (!(norm > 0.0)) {
            fail(`${name} must be nonzero`);
        }
        return [vector[0] / norm, vector[1] / norm, vector[2] / norm];
    }

    function cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ];
    }

    function dot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    function orthonormalTangentBasis(normal) {
        const helper = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const t1 = cross(normal, helper);
        const t1Norm = Math.hypot(t1[0], t1[1], t1[2]);
        if (!(t1Norm > 0.0)) {
            fail("failed to construct tangent basis");
        }
        t1[0] /= t1Norm;
        t1[1] /= t1Norm;
        t1[2] /= t1Norm;
        const t2 = cross(normal, t1);
        return [t1, t2];
    }

    function reducedMass(massAkg, massBkg) {
        const massA = Number(massAkg);
        const massB = Number(massBkg);
        if (!(massA > 0.0) || !(massB > 0.0)) {
            fail("masses must be positive");
        }
        return (massA * massB) / (massA + massB);
    }

    function safeLn(x) {
        return Math.log(x <= 0 ? Number.EPSILON : x);
    }

    function randomNormal(rand) {
        const u1 = Math.max(Number.EPSILON, rand());
        const u2 = rand();
        return Math.sqrt(-2.0 * safeLn(u1)) * Math.cos(2.0 * Math.PI * u2);
    }

    function maxwellVelocities(
        particleCount,
        massKg,
        temperatureK,
        bulkVelocityMs = [0.0, 0.0, 0.0],
        rand = Math.random,
    ) {
        const count = Number(particleCount);
        const mass = Number(massKg);
        const temperature = Number(temperatureK);
        if (!Number.isInteger(count) || count < 0 || !(mass > 0.0) || !(temperature > 0.0)) {
            fail("particle_count, mass, and temperature are invalid");
        }
        const bulk = asVector3(bulkVelocityMs, "bulk_velocity_m_s");
        if (typeof rand !== "function") {
            fail("rand must be a function");
        }
        const sigma = Math.sqrt(KB * temperature / mass);
        const out = new Array(count);
        for (let i = 0; i < count; i += 1) {
            out[i] = [
                bulk[0] + sigma * randomNormal(rand),
                bulk[1] + sigma * randomNormal(rand),
                bulk[2] + sigma * randomNormal(rand),
            ];
        }
        return out;
    }

    function elasticCollisionVelocities(
        velocityAMs,
        velocityBMs,
        massAkg,
        massBkg,
        cosTheta,
        azimuthRad,
    ) {
        const va = asVector3(velocityAMs, "velocity_a_m_s");
        const vb = asVector3(velocityBMs, "velocity_b_m_s");
        const massA = Number(massAkg);
        const massB = Number(massBkg);
        if (!(massA > 0.0) || !(massB > 0.0)) {
            fail("elastic collision inputs are invalid");
        }
        const cosine = Number(cosTheta);
        if (!(cosine >= -1.0 && cosine <= 1.0)) {
            fail("elastic collision inputs are invalid");
        }
        const rel = [
            va[0] - vb[0],
            va[1] - vb[1],
            va[2] - vb[2],
        ];
        const relSpeed = Math.hypot(rel[0], rel[1], rel[2]);
        const azimuth = Number(azimuthRad);
        const direction = scatteredRelativeDirection(rel, cosine, azimuth);
        const muSum = massA + massB;
        const centerOfMass = [
            (massA * va[0] + massB * vb[0]) / muSum,
            (massA * va[1] + massB * vb[1]) / muSum,
            (massA * va[2] + massB * vb[2]) / muSum,
        ];
        const factorA = massB / muSum;
        const factorB = massA / muSum;
        return [
            [
                centerOfMass[0] + factorA * relSpeed * direction[0],
                centerOfMass[1] + factorA * relSpeed * direction[1],
                centerOfMass[2] + factorA * relSpeed * direction[2],
            ],
            [
                centerOfMass[0] - factorB * relSpeed * direction[0],
                centerOfMass[1] - factorB * relSpeed * direction[1],
                centerOfMass[2] - factorB * relSpeed * direction[2],
            ],
        ];
    }

    function scatteredRelativeDirection(relVelocity, cosTheta, azimuthRad) {
        const rel = asVector3(relVelocity, "relative_velocity_m_s");
        const cosine = Number(cosTheta);
        if (!(cosine >= -1.0 && cosine <= 1.0)) {
            fail("elastic collision inputs are invalid");
        }
        const azimuth = Number(azimuthRad);
        const relSpeed = Math.hypot(rel[0], rel[1], rel[2]);
        if (!(relSpeed > 0.0)) {
            fail("relative speed must be positive");
        }
        const unitRel = [rel[0] / relSpeed, rel[1] / relSpeed, rel[2] / relSpeed];
        const [t1, t2] = orthonormalTangentBasis(unitRel);
        const sinTheta = Math.sqrt(Math.max(0.0, 1.0 - cosine * cosine));
        const c1 = Math.cos(azimuth);
        const c2 = Math.sin(azimuth);
        return [
            cosine * unitRel[0] + sinTheta * (c1 * t1[0] + c2 * t2[0]),
            cosine * unitRel[1] + sinTheta * (c1 * t1[1] + c2 * t2[1]),
            cosine * unitRel[2] + sinTheta * (c1 * t1[2] + c2 * t2[2]),
        ];
    }

    function specularReflection(velocityMs, wallNormal) {
        const velocity = asVector3(velocityMs, "velocity_m_s");
        const normal = unitVector(wallNormal, "wall_normal");
        const vDotN = dot(velocity, normal);
        return [
            velocity[0] - 2.0 * vDotN * normal[0],
            velocity[1] - 2.0 * vDotN * normal[1],
            velocity[2] - 2.0 * vDotN * normal[2],
        ];
    }

    function diffuseWallVelocity(
        wallTemperatureK,
        massKg,
        wallNormal,
        wallVelocityMs = [0.0, 0.0, 0.0],
        rand = Math.random,
    ) {
        const temperature = Number(wallTemperatureK);
        const mass = Number(massKg);
        if (!(temperature > 0.0) || !(mass > 0.0)) {
            fail("wall temperature and mass must be positive");
        }
        if (typeof rand !== "function") {
            fail("rand must be a function");
        }
        const normal = unitVector(wallNormal, "wall_normal");
        const [t1, t2] = orthonormalTangentBasis(normal);
        const sigma = Math.sqrt(KB * temperature / mass);
        const normalSpeed = sigma * Math.sqrt(-2.0 * safeLn(Math.max(rand(), Number.EPSILON)));
        const tangential = [randomNormal(rand) * sigma, randomNormal(rand) * sigma];
        const wallVelocity = asVector3(wallVelocityMs, "wall_velocity_m_s");
        return [
            wallVelocity[0] + normalSpeed * normal[0] + tangential[0] * t1[0] + tangential[1] * t2[0],
            wallVelocity[1] + normalSpeed * normal[1] + tangential[0] * t1[1] + tangential[1] * t2[1],
            wallVelocity[2] + normalSpeed * normal[2] + tangential[0] * t1[2] + tangential[1] * t2[2],
        ];
    }

    function macroscopicMoments(velocitiesMs, massKg, realParticlesPerSimParticle, cellVolumeM3) {
        const mass = Number(massKg);
        const weight = Number(realParticlesPerSimParticle);
        const volume = Number(cellVolumeM3);
        if (!Array.isArray(velocitiesMs) || velocitiesMs.length === 0) {
            fail("velocities_m_s must have shape (N, 3)");
        }
        if (!(mass > 0.0) || !(weight > 0.0) || !(volume > 0.0)) {
            fail("moment inputs are invalid");
        }
        const n = velocitiesMs.length;
        let bulk = [0.0, 0.0, 0.0];
        for (const v of velocitiesMs) {
            const vv = asVector3(v, "velocities_m_s");
            bulk[0] += vv[0];
            bulk[1] += vv[1];
            bulk[2] += vv[2];
        }
        bulk = [bulk[0] / n, bulk[1] / n, bulk[2] / n];

        const pressure = [
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
        ];
        for (const v of velocitiesMs) {
            const vv = asVector3(v, "velocities_m_s");
            const cx = vv[0] - bulk[0];
            const cy = vv[1] - bulk[1];
            const cz = vv[2] - bulk[2];
            pressure[0][0] += cx * cx;
            pressure[0][1] += cx * cy;
            pressure[0][2] += cx * cz;
            pressure[1][0] += cy * cx;
            pressure[1][1] += cy * cy;
            pressure[1][2] += cy * cz;
            pressure[2][0] += cz * cx;
            pressure[2][1] += cz * cy;
            pressure[2][2] += cz * cz;
        }
        const scale = (weight * mass) / volume;
        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
                pressure[i][j] *= scale;
            }
        }
        const trace = pressure[0][0] + pressure[1][1] + pressure[2][2];
        const numberDensity = (weight * n) / volume;
        const temperature = trace / (3.0 * numberDensity * KB);
        return {
            number_density_m3: numberDensity,
            bulk_velocity_m_s: bulk,
            temperature_k: temperature,
            pressure_tensor_pa: pressure,
        };
    }

    function macroscopicMomentsMixed(velocitiesMs, massesKg, realParticlesPerSimParticle, cellVolumeM3) {
        const weight = Number(realParticlesPerSimParticle);
        const volume = Number(cellVolumeM3);
        if (!Array.isArray(velocitiesMs) || velocitiesMs.length === 0) {
            fail("velocities_m_s must have shape (N, 3)");
        }
        if (!Array.isArray(massesKg) || massesKg.length !== velocitiesMs.length) {
            fail("masses_kg must be an array with same length as velocities");
        }
        if (weight <= 0.0 || !(volume > 0.0)) {
            fail("moment inputs are invalid");
        }

        const n = velocitiesMs.length;
        let bulkMass = 0.0;
        let bulk = [0.0, 0.0, 0.0];
        for (let i = 0; i < n; i += 1) {
            const vv = asVector3(velocitiesMs[i], `velocities_m_s[${i}]`);
            const mass = Number(massesKg[i]);
            if (!(mass > 0.0)) {
                fail("mass_kg must be positive");
            }
            bulk[0] += mass * vv[0];
            bulk[1] += mass * vv[1];
            bulk[2] += mass * vv[2];
            bulkMass += mass;
        }
        if (!(bulkMass > 0.0)) {
            fail("total mass must be positive");
        }
        bulk = [bulk[0] / bulkMass, bulk[1] / bulkMass, bulk[2] / bulkMass];

        const pressure = [
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
        ];
        for (let i = 0; i < n; i += 1) {
            const vv = asVector3(velocitiesMs[i], `velocities_m_s[${i}]`);
            const mass = Number(massesKg[i]);
            const cx = vv[0] - bulk[0];
            const cy = vv[1] - bulk[1];
            const cz = vv[2] - bulk[2];
            pressure[0][0] += mass * cx * cx;
            pressure[0][1] += mass * cx * cy;
            pressure[0][2] += mass * cx * cz;
            pressure[1][0] += mass * cy * cx;
            pressure[1][1] += mass * cy * cy;
            pressure[1][2] += mass * cy * cz;
            pressure[2][0] += mass * cz * cx;
            pressure[2][1] += mass * cz * cy;
            pressure[2][2] += mass * cz * cz;
        }
        const scale = weight / volume;
        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
                pressure[i][j] *= scale;
            }
        }

        const trace = pressure[0][0] + pressure[1][1] + pressure[2][2];
        const numberDensity = (weight * n) / volume;
        const temperature = trace / (3.0 * numberDensity * KB);
        return {
            number_density_m3: numberDensity,
            bulk_velocity_m_s: bulk,
            temperature_k: temperature,
            pressure_tensor_pa: pressure,
        };
    }

    function meanFreePathM(numberDensityM3, collisionCrossSectionM2) {
        const density = Number(numberDensityM3);
        const crossSection = Number(collisionCrossSectionM2);
        if (!(density > 0.0) || !(crossSection > 0.0)) {
            fail("density and cross section must be positive");
        }
        return 1.0 / (Math.sqrt(2.0) * density * crossSection);
    }

    function pairCollisionProbability(sigmaTCr, realParticlesPerSimParticle, timeStepS, cellVolumeM3) {
        const sigma = Number(sigmaTCr);
        const weight = Number(realParticlesPerSimParticle);
        const dt = Number(timeStepS);
        const volume = Number(cellVolumeM3);
        if (sigma < 0.0 || weight < 0.0 || dt < 0.0 || !(volume > 0.0)) {
            fail("pair collision probability inputs are invalid");
        }
        return weight * sigma * dt / volume;
    }

    function reactionProbability(reactionCrossSectionM2, totalCrossSectionM2) {
        const sigmaReaction = Number(reactionCrossSectionM2);
        const sigmaTotal = Number(totalCrossSectionM2);
        if (sigmaReaction < 0.0 || !(sigmaTotal > 0.0) || sigmaReaction > sigmaTotal) {
            fail("reaction and total cross sections are inconsistent");
        }
        return sigmaReaction / sigmaTotal;
    }

    function lanczosLogGamma(z) {
        const p = [
            676.5203681215039,
            -1259.1392167224028,
            771.3234287776531,
            -176.6150291621406,
            12.507343278686905,
            -0.13857109526572012,
            9.984369578019572e-6,
            1.5056327351493116e-7,
        ];
        if (z < 0.5) {
            return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - lanczosLogGamma(1.0 - z);
        }
        const zz = z - 1.0;
        let x = 0.9999999999998099;
        for (let i = 0; i < p.length; i += 1) {
            x += p[i] / (zz + i + 1.0);
        }
        const t = zz + p.length - 0.5;
        return 0.9189385332046727 + (zz + 0.5) * Math.log(t) - t + Math.log(x);
    }

    function vhsVssSigmaTCr(speciesA, speciesB, relativeSpeedMs, referenceTemperatureK) {
        const cRel = Number(relativeSpeedMs);
        const tref = Number(referenceTemperatureK);
        if (!(cRel > 0.0) || !(tref > 0.0)) {
            fail("relative speed and reference temperature must be positive");
        }
        const diameter = 0.5 * (speciesA.diameter_m + speciesB.diameter_m);
        if (!(diameter > 0.0)) {
            fail("species diameters must be positive");
        }
        const omega = 0.5 * (speciesA.viscosity_temperature_exponent + speciesB.viscosity_temperature_exponent);
        const mu = reducedMass(speciesA.mass_kg, speciesB.mass_kg);
        const sigmaT = Math.PI
            * diameter * diameter
            * Math.pow(2.0 * KB * tref / (mu * cRel * cRel), omega - 0.5)
            / Math.exp(lanczosLogGamma(2.5 - omega));
        return sigmaT * cRel;
    }

    function hardSphereSigmaTCr(speciesA, speciesB, relativeSpeedMs) {
        const cRel = Number(relativeSpeedMs);
        if (!(cRel > 0.0)) {
            fail("relative speed must be positive");
        }
        const diameter = 0.5 * (speciesA.diameter_m + speciesB.diameter_m);
        if (!(diameter > 0.0)) {
            fail("species diameters must be positive");
        }
        return Math.PI * diameter * diameter * cRel;
    }

    function softSphereSigmaTCr(speciesA, speciesB, relativeSpeedMs, referenceTemperatureK, softness = 0.6) {
        const cRel = Number(relativeSpeedMs);
        const tref = Number(referenceTemperatureK);
        const mix = Math.min(1.0, Math.max(0.0, Number(softness)));
        if (!(cRel > 0.0) || !(tref > 0.0)) {
            fail("relative speed and reference temperature must be positive");
        }
        const diameter = 0.5 * (speciesA.diameter_m + speciesB.diameter_m);
        if (!(diameter > 0.0)) {
            fail("species diameters must be positive");
        }
        const omega = 0.5 * (speciesA.viscosity_temperature_exponent + speciesB.viscosity_temperature_exponent);
        const mu = reducedMass(speciesA.mass_kg, speciesB.mass_kg);
        const hard = Math.PI * diameter * diameter * cRel;
        const speedScale = Math.pow(
            Math.max(1.0e-12, 2.0 * KB * tref / (mu * cRel * cRel)),
            Math.max(0.0, omega - 0.5) * mix,
        );
        return hard * speedScale;
    }

    function bird1994OmegaToInputExponent(omegaBird1994) {
        const omega = Number(omegaBird1994);
        if (!(omega > 0.5)) {
            fail("Bird 1994 omega must be greater than 0.5 for this convention");
        }
        return omega - 0.5;
    }

    function inputExponentToBird1994Omega(inputExponent) {
        const exponent = Number(inputExponent);
        if (exponent < 0.0) {
            fail("input exponent must be nonnegative");
        }
        return exponent + 0.5;
    }

    function vhsVssSigmaTCrFromInputExponent(
        speciesA,
        speciesB,
        relativeSpeedMs,
        referenceTemperatureK,
        inputExponentA,
        inputExponentB,
    ) {
        const convertedA = Object.assign({}, speciesA, {
            viscosity_temperature_exponent: inputExponentToBird1994Omega(inputExponentA),
        });
        const convertedB = Object.assign({}, speciesB, {
            viscosity_temperature_exponent: inputExponentToBird1994Omega(inputExponentB),
        });
        return vhsVssSigmaTCr(convertedA, convertedB, relativeSpeedMs, referenceTemperatureK);
    }

    function vssCosTheta(randomUnit, alphaA, alphaB) {
        const u = Number(randomUnit);
        if (!(u >= 0.0 && u <= 1.0)) {
            fail("random_unit must be in [0, 1]");
        }
        const alpha = 0.5 * (Number(alphaA) + Number(alphaB));
        if (!(alpha > 0.0)) {
            fail("VSS alpha must be positive");
        }
        return 2.0 * Math.pow(u, 1.0 / alpha) - 1.0;
    }

    function ntcCandidateCount(
        particleCount,
        realParticlesPerSimParticle,
        sigmaTCrMax,
        timeStepS,
        cellVolumeM3,
        carriedRemainder = 0.0,
    ) {
        const count = Number(particleCount);
        const weight = Number(realParticlesPerSimParticle);
        const sigmaMax = Number(sigmaTCrMax);
        const dt = Number(timeStepS);
        const volume = Number(cellVolumeM3);
        const remainder = Number(carriedRemainder);
        if (!Number.isInteger(count) || count < 0) {
            fail("particle_count must be nonnegative");
        }
        if (weight < 0.0 || sigmaMax < 0.0 || dt < 0.0 || !(volume > 0.0)) {
            fail("NTC scale inputs must be nonnegative and volume positive");
        }
        const raw = remainder + 0.5 * count * (count - 1) * weight * sigmaMax * dt / volume;
        const candidates = Math.floor(raw);
        return {
            candidates,
            remainder: raw - candidates,
            raw,
        };
    }

    function ntcAcceptsCollision(sigmaTCr, sigmaTCrMax, randomUnit) {
        const sigma = Number(sigmaTCr);
        const sigmaMax = Number(sigmaTCrMax);
        const u = Number(randomUnit);
        if (sigma < 0.0 || !(sigmaMax > 0.0)) {
            fail("sigma_t_cr must be nonnegative and sigma_t_cr_max positive");
        }
        if (!(u >= 0.0 && u <= 1.0)) {
            fail("random_unit must be in [0, 1]");
        }
        const ratio = sigma / sigmaMax;
        return {
            accepted: ratio >= 1.0 || ratio > u,
            majorantViolated: ratio > 1.0,
            ratio,
        };
    }

    function birdVibrationalCollisionNumber(
        temperatureK,
        dissociationTemperatureK,
        zRef,
        zRefTemperatureK,
        viscosityTemperatureExponent,
    ) {
        const temperature = Number(temperatureK);
        const thetaD = Number(dissociationTemperatureK);
        const zReference = Number(zRef);
        const tref = Number(zRefTemperatureK);
        const omega = Number(viscosityTemperatureExponent);
        if (!(temperature > 0.0) || !(thetaD > 0.0) || !(zReference > 0.0) || !(tref > 0.0)) {
            fail("Bird vibrational inputs must be positive");
        }
        const pow1 = Math.pow(thetaD / temperature, 1.0 / 3.0) - 1.0;
        const pow2 = Math.pow(thetaD / tref, 1.0 / 3.0) - 1.0;
        const factor1 = Math.pow(thetaD / temperature, omega);
        const factor2 = Math.pow(zReference * Math.pow(thetaD / tref, -omega), pow1 / pow2);
        return factor1 * factor2;
    }

    function birdVibrationalEventProbability(
        temperatureK,
        dissociationTemperatureK,
        zRef,
        zRefTemperatureK,
        viscosityTemperatureExponent,
        formulation = "post_2008",
    ) {
        const zV = birdVibrationalCollisionNumber(
            temperatureK,
            dissociationTemperatureK,
            zRef,
            zRefTemperatureK,
            viscosityTemperatureExponent,
        );
        if (formulation === "post_2008") {
            return 1.0 / (5.0 * zV);
        }
        if (formulation === "pre_2008" || formulation === "2008") {
            return 1.0 / zV;
        }
        fail(`unknown vibrational formulation: ${formulation}`);
    }

    function larsenBorgnakkeVibrationalLevelWeights(
        maximumLevel,
        characteristicTemperatureK,
        collisionEnergyJ,
        viscosityTemperatureExponent,
    ) {
        const iMax = Math.floor(Number(maximumLevel));
        const theta = Number(characteristicTemperatureK);
        const energy = Number(collisionEnergyJ);
        const omega = Number(viscosityTemperatureExponent);
        if (!(iMax >= 0) || !(theta > 0.0) || !(energy > 0.0) || !Number.isFinite(omega)) {
            fail("invalid vibrational LB inputs");
        }

        const weights = new Array(iMax + 1).fill(0.0);
        let total = 0.0;
        for (let i = 0; i <= iMax; i += 1) {
            const levelEnergy = i * KB * theta;
            const accessible = 1.0 - levelEnergy / energy;
            if (accessible > 0.0) {
                const weight = accessible ** (1.5 - omega);
                weights[i] = weight;
                total += weight;
            }
        }

        if (!(total > 0.0) || !Number.isFinite(total)) {
            fail("no accessible vibrational levels");
        }
        return weights.map((w) => w / total);
    }

    function millikanWhiteParkTauS(
        temperatureK,
        pressurePa,
        colliderNumberDensityM3,
        vibratorMolarMassGMol,
        a,
        b,
        limitingCrossSectionM2,
        offset = 18.42,
        limitingCrossSectionTemperatureK = 5.0e4,
    ) {
        const temperature = Number(temperatureK);
        const pressure = Number(pressurePa);
        const density = Number(colliderNumberDensityM3);
        const molarMassGMol = Number(vibratorMolarMassGMol);
        const sigma = Number(limitingCrossSectionM2);
        if (!(temperature > 0.0) || !(pressure > 0.0) || !(molarMassGMol > 0.0) || !(sigma > 0.0) || density < 0.0) {
            fail("Millikan-White/Park inputs are invalid");
        }
        const mwTerm = ATM_PA / pressure * Math.exp(Number(a) * (Math.pow(temperature, -1.0 / 3.0) - Number(b)) - Number(offset));
        const thermalSpeed = Math.sqrt(8.0 * GAS_CONSTANT * 1000.0 * temperature / (Math.PI * molarMassGMol));
        const parkSigma = sigma * Math.pow(limitingCrossSectionTemperatureK / temperature, 2.0);
        const parkTerm = 1.0 / Math.max(thermalSpeed * parkSigma * density, Number.EPSILON);
        return mwTerm + parkTerm;
    }

    function sshReducedTauS(temperatureK, characteristicVibrationalTemperatureK, p10Probability, collisionFrequencyS) {
        const temperature = Number(temperatureK);
        const theta = Number(characteristicVibrationalTemperatureK);
        const p10 = Number(p10Probability);
        const frequency = Number(collisionFrequencyS);
        if (!(temperature > 0.0) || !(theta > 0.0) || !(p10 > 0.0) || !(frequency > 0.0)) {
            fail("SSH reduced-relaxation inputs must be positive");
        }
        return 1.0 / ((1.0 - Math.exp(-theta / temperature)) * p10 * frequency);
    }

    function loadHeatBathCase(caseId = "monospecies_heat_bath") {
        const row = DSMC_CASES.cases.find((item) => item.case_id === caseId);
        if (!row) {
            throw new Error(caseId);
        }
        return caseFromRow(row);
    }

    function caseFromRow(row) {
        const species = {};
        for (const item of row.species || []) {
            const sp = speciesFromRow(item);
            species[sp.name] = sp;
        }
        return new HeatBathCase({
            case_id: row.case_id,
            collision_model: ACTIVE_COLLISION_MODEL_LABEL,
            partner_selection: row.partner_selection,
            reference_temperature_k: row.reference_temperature_k,
            rotational_relaxation_collision_number: row.rotational_relaxation_collision_number,
            vibrational_relaxation_collision_number: row.vibrational_relaxation_collision_number,
            electronic_relaxation_collision_number: row.electronic_relaxation_collision_number,
            species,
        });
    }

    function speciesFromRow(row) {
        const override = SPECIES_OVERRIDES[row.name] || {};
        const rotDof = override.rotational_degrees_of_freedom
            ?? row.rotational_degrees_of_freedom
            ?? 0;
        return new DsmcSpecies({
            name: row.name,
            mass_kg: override.mass_kg ?? row.mass_kg,
            diameter_m: row.diameter_m,
            viscosity_temperature_exponent: row.viscosity_temperature_exponent,
            vss_alpha: row.vss_alpha,
            rotational_degrees_of_freedom: rotDof,
            rotational_relaxation_collision_number:
                override.rotational_relaxation_collision_number
                ?? row.rotational_relaxation_collision_number
                ?? null,
            vibrational_characteristic_temperatures_k: row.vibrational_characteristic_temperatures_k || [],
            vibrational_dissociation_temperatures_k: row.vibrational_dissociation_temperatures_k || [],
            vibrational_z_ref: row.vibrational_z_ref || [],
            vibrational_z_ref_temperature_k: row.vibrational_z_ref_temperature_k || [],
        });
    }

    function writeRowsCsv(rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return "";
        }
        const header = Object.keys(rows[0]);
        const lines = [header.join(",")];
        for (const row of rows) {
            const line = header.map((key) => {
                const value = row[key];
                const text = value === null || value === undefined ? "" : String(value);
                const escaped = text.includes(",") ? `"${text.replace(/"/g, "\"\"")}"` : text;
                return escaped;
            });
            lines.push(line.join(","));
        }
        return lines.join("\n");
    }

    return {
        DsmcSpecies,
        HeatBathCase,
        KB,
        AMU,
        constants: {
            ATM_PA,
            GAS_CONSTANT,
        },
        loadHeatBathCase,
        reducedMass,
        reduced_mass: reducedMass,
        maxwellVelocities,
        maxwell_velocities: maxwellVelocities,
        elasticCollisionVelocities,
        elastic_collision_velocities: elasticCollisionVelocities,
        specularReflection,
        specular_reflection: specularReflection,
        diffuseWallVelocity,
        diffuse_wall_velocity: diffuseWallVelocity,
        macroscopicMoments,
        macroscopic_moments: macroscopicMoments,
        macroscopicMomentsMixed,
        macroscopic_moments_mixed: macroscopicMomentsMixed,
        meanFreePathM,
        mean_free_path_m: meanFreePathM,
        pairCollisionProbability,
        pair_collision_probability: pairCollisionProbability,
        reactionProbability,
        reaction_probability: reactionProbability,
        vhsVssSigmaTCr,
        vhs_vss_sigma_t_cr: vhsVssSigmaTCr,
        bird1994OmegaToInputExponent,
        bird1994_omega_to_input_exponent: bird1994OmegaToInputExponent,
        inputExponentToBird1994Omega,
        input_exponent_to_bird1994_omega: inputExponentToBird1994Omega,
        vhsVssSigmaTCrFromInputExponent,
        vhs_vss_sigma_t_cr_from_input_exponent: vhsVssSigmaTCrFromInputExponent,
        hardSphereSigmaTCr,
        hard_sphere_sigma_t_cr: hardSphereSigmaTCr,
        softSphereSigmaTCr,
        soft_sphere_sigma_t_cr: softSphereSigmaTCr,
        vssCosTheta,
        vss_cos_theta: vssCosTheta,
        ntcCandidateCount,
        ntc_candidate_count: ntcCandidateCount,
        ntcAcceptsCollision,
        ntc_accepts_collision: ntcAcceptsCollision,
        birdVibrationalCollisionNumber,
        bird_vibrational_collision_number: birdVibrationalCollisionNumber,
        birdVibrationalEventProbability,
        bird_vibrational_event_probability: birdVibrationalEventProbability,
        larsenBorgnakkeVibrationalLevelWeights,
        larsen_borgnakke_vibrational_level_weights: larsenBorgnakkeVibrationalLevelWeights,
        millikanWhiteParkTauS,
        millikan_white_park_tau_s: millikanWhiteParkTauS,
        sshReducedTauS,
        ssh_reduced_tau_s: sshReducedTauS,
        writeRowsCsv,
    };
})();

if (typeof window !== "undefined") {
    window.Dsmc = Dsmc;
}
