(function (root, factory) {
  const api = factory();

  const commonJS = typeof module === "object" && module !== null && module.exports;
  if (commonJS) module.exports = api;
  if (typeof window !== "undefined") {
    window.EconomyAnalytics = api;
  } else if (!commonJS) {
    root.EconomyAnalytics = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMULA_VERSION = 3;
  const PRESTIGE_GAIN_LOG_SCALE = 3;
  const PRESTIGE_SQRT_BONUS = 0.2;
  const CULTURE_QUALITY_BONUS = 0.025;
  const CULTURE_QUALITY_BONUS_CAP = 0.2;
  const CULTURE_BRAND_IMAGE_BONUS = 0.03;
  const CULTURE_BRAND_IMAGE_BONUS_CAP = 0.25;
  const INFRA_STAT_RATE_PER_SECOND = 0.024;
  const MAX_RECONSTRUCTED_QUANTITY = 100000;

  function unavailable(reason, extra) {
    return Object.assign(
      {
        status: "unavailable",
        value: null,
        reason
      },
      extra || {}
    );
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function isNonNegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  function optionalFiniteNumber(value, fallback) {
    return typeof value === "undefined"
      ? fallback
      : isFiniteNumber(value)
      ? value
      : null;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  /** Diminishing-return Culture gain from the current run's cumulative CC. */
  function computePotentialCultureGain(ccTotal, divisor) {
    if (!isFiniteNumber(ccTotal) || ccTotal < 0 || !isFiniteNumber(divisor) || divisor <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(PRESTIGE_GAIN_LOG_SCALE * Math.log10(1 + ccTotal / divisor)));
  }

  /** Permanent production bonus with diminishing returns instead of linear runaway. */
  function computePrestigeMultiplier(culturePoints) {
    if (!isFiniteNumber(culturePoints) || culturePoints < 0) return 1;
    return 1 + PRESTIGE_SQRT_BONUS * Math.sqrt(culturePoints);
  }

  /** Bounded Culture contributions to gauge targets. */
  function computeCultureGaugeBonuses(culturePoints) {
    const rootCulture = isFiniteNumber(culturePoints) && culturePoints > 0
      ? Math.sqrt(culturePoints)
      : 0;
    return {
      quality: Math.min(CULTURE_QUALITY_BONUS_CAP, CULTURE_QUALITY_BONUS * rootCulture),
      brandImage: Math.min(CULTURE_BRAND_IMAGE_BONUS_CAP, CULTURE_BRAND_IMAGE_BONUS * rootCulture)
    };
  }

  function milestoneMultiplier(quantity) {
    if (quantity >= 25) return 1.25;
    if (quantity >= 10) return 1.1;
    return 1;
  }

  function effectiveQuantity(building) {
    return building.quantity * milestoneMultiplier(building.quantity);
  }

  function safeProduct(values) {
    const result = values.reduce((product, value) => product * value, 1);
    return Number.isFinite(result) ? result : null;
  }

  function resolveBuilding(buildingOrState, buildingId) {
    if (
      buildingOrState &&
      Array.isArray(buildingOrState.buildings) &&
      typeof buildingId === "string"
    ) {
      return buildingOrState.buildings.find(building => building && building.id === buildingId) || null;
    }

    return buildingOrState && !Array.isArray(buildingOrState.buildings)
      ? buildingOrState
      : null;
  }

  function validateBuilding(building, requireCostModel) {
    if (!building || typeof building !== "object" || Array.isArray(building)) {
      return "invalid-building";
    }
    if (!isNonNegativeInteger(building.quantity)) {
      return "invalid-quantity";
    }
    if (requireCostModel && (!isFiniteNumber(building.baseCost) || building.baseCost < 0)) {
      return "invalid-base-cost";
    }
    if (requireCostModel && (!isFiniteNumber(building.costMultiplier) || building.costMultiplier <= 0)) {
      return "invalid-cost-multiplier";
    }
    return null;
  }

  function validateStateShape(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return "invalid-state";
    }
    if (!Array.isArray(state.buildings)) {
      return "invalid-buildings";
    }
    if (!Array.isArray(state.upgrades)) {
      return "invalid-upgrades";
    }
    if (!state.resources || typeof state.resources !== "object" || Array.isArray(state.resources)) {
      return "invalid-resources";
    }
    if (!state.stats || typeof state.stats !== "object" || Array.isArray(state.stats)) {
      return "invalid-stats";
    }
    if (!state.config || typeof state.config !== "object" || Array.isArray(state.config)) {
      return "invalid-config";
    }
    return null;
  }

  /**
   * Returns the DOC cost of the next unit. Accepts either a building, or a
   * state plus a building id. The formula matches app.js buildingCost().
   */
  function computeNextCost(buildingOrState, buildingId) {
    const building = resolveBuilding(buildingOrState, buildingId);
    if (!building) {
      return unavailable(typeof buildingId === "string" ? "building-not-found" : "invalid-building");
    }

    const validationError = validateBuilding(building, true);
    if (validationError) {
      return unavailable(validationError);
    }

    const stateModifiers = buildingOrState && Array.isArray(buildingOrState.buildings) &&
      buildingOrState.careerModifiers && typeof buildingOrState.careerModifiers === "object"
      ? buildingOrState.careerModifiers
      : {};
    const buildingCostMultiplier = optionalFiniteNumber(stateModifiers.buildingCostMultiplier, 1);
    if (buildingCostMultiplier === null || buildingCostMultiplier <= 0) {
      return unavailable("invalid-career-modifier");
    }
    const rawCost = building.baseCost * Math.pow(building.costMultiplier, building.quantity) * buildingCostMultiplier;
    if (!Number.isFinite(rawCost) || rawCost > Number.MAX_SAFE_INTEGER) {
      return unavailable("cost-out-of-range");
    }

    return {
      status: "exact",
      value: Math.floor(rawCost),
      formula: "geometric-next-cost",
      formulaVersion: FORMULA_VERSION
    };
  }

  /**
   * Reconstructs spend for currently owned units with today's cost model.
   * It is estimated because serialized game state contains no purchase ledger.
   */
  function computeCumulativeCost(buildingOrState, buildingId) {
    const building = resolveBuilding(buildingOrState, buildingId);
    if (!building) {
      return unavailable(typeof buildingId === "string" ? "building-not-found" : "invalid-building");
    }

    const validationError = validateBuilding(building, true);
    if (validationError) {
      return unavailable(validationError);
    }
    if (building.quantity > MAX_RECONSTRUCTED_QUANTITY) {
      return unavailable("quantity-too-large");
    }
    if (building.quantity === 0) {
      return {
        status: "exact",
        value: 0,
        formula: "current-model-reconstruction",
        formulaVersion: FORMULA_VERSION
      };
    }

    const stateModifiers = buildingOrState && Array.isArray(buildingOrState.buildings) &&
      buildingOrState.careerModifiers && typeof buildingOrState.careerModifiers === "object"
      ? buildingOrState.careerModifiers
      : {};
    const buildingCostMultiplier = optionalFiniteNumber(stateModifiers.buildingCostMultiplier, 1);
    if (buildingCostMultiplier === null || buildingCostMultiplier <= 0) {
      return unavailable("invalid-career-modifier");
    }

    let total = 0;
    for (let index = 0; index < building.quantity; index += 1) {
      const rawCost = building.baseCost * Math.pow(building.costMultiplier, index) * buildingCostMultiplier;
      if (!Number.isFinite(rawCost) || rawCost > Number.MAX_SAFE_INTEGER) {
        return unavailable("cost-out-of-range");
      }
      total += Math.floor(rawCost);
      if (!Number.isSafeInteger(total)) {
        return unavailable("cumulative-cost-out-of-range");
      }
    }

    return {
      status: "estimated",
      value: total,
      formula: "current-model-reconstruction",
      formulaVersion: FORMULA_VERSION,
      assumptions: ["unchanged-cost-model"]
    };
  }

  function validateEconomyState(state) {
    const shapeError = validateStateShape(state);
    if (shapeError) return shapeError;

    if (!isFiniteNumber(state.resources.culturePoints) || state.resources.culturePoints < 0) {
      return "invalid-culture-points";
    }
    if (!isFiniteNumber(state.stats.quality)) {
      return "invalid-quality";
    }
    if (!isFiniteNumber(state.stats.brandImage)) {
      return "invalid-brand-image";
    }

    for (const building of state.buildings) {
      const buildingError = validateBuilding(building, false);
      if (buildingError) return buildingError;
      if (!isFiniteNumber(building.baseProduction) || building.baseProduction < 0) {
        return "invalid-base-production";
      }

      const modifierFields = [
        "docMultiplierPerUnit",
        "ccMultiplierPerUnit",
        "qualityBonusPerUnit",
        "footprintBonusPerUnit",
        "imageBonusPerUnit",
        "contractDurationReductionPerUnit"
      ];
      for (const field of modifierFields) {
        if (optionalFiniteNumber(building[field], 0) === null) {
          return "invalid-building-modifier";
        }
      }
    }

    for (const upgrade of state.upgrades) {
      if (!upgrade || typeof upgrade !== "object" || Array.isArray(upgrade)) {
        return "invalid-upgrade";
      }
      if (
        upgrade.purchased &&
        (upgrade.type === "clickMult" ||
          upgrade.type === "globalProdMult" ||
          upgrade.type === "qualityFlat") &&
        !isFiniteNumber(upgrade.value)
      ) {
        return "invalid-upgrade-value";
      }
    }

    return null;
  }

  function computeBuildingEffects(buildings) {
    const effects = {
      docMultiplier: 1,
      ccMultiplier: 1,
      qualityBonus: 0,
      footprintBonus: 0,
      imageBonus: 0
    };

    for (const building of buildings) {
      const quantity = effectiveQuantity(building);
      const docBonus = optionalFiniteNumber(building.docMultiplierPerUnit, 0) * quantity;
      const ccBonus = optionalFiniteNumber(building.ccMultiplierPerUnit, 0) * quantity;

      if (docBonus) effects.docMultiplier *= 1 + docBonus;
      if (ccBonus) effects.ccMultiplier *= 1 + ccBonus;
      effects.qualityBonus += optionalFiniteNumber(building.qualityBonusPerUnit, 0) * quantity;
      effects.footprintBonus += optionalFiniteNumber(building.footprintBonusPerUnit, 0) * quantity;
      effects.imageBonus += optionalFiniteNumber(building.imageBonusPerUnit, 0) * quantity;
    }

    const values = Object.values(effects);
    return values.every(Number.isFinite) ? effects : null;
  }

  /**
   * Computes the current automatic DOC/s and CC/s from a serializable state.
   * CC/s is instantaneous: quality and brand-image gauges are held constant.
   */
  function computeAutomaticEconomics(state) {
    const validationError = validateEconomyState(state);
    if (validationError) {
      return unavailable(validationError);
    }

    const buildingEffects = computeBuildingEffects(state.buildings);
    if (!buildingEffects) {
      return unavailable("building-effects-out-of-range");
    }

    let docMultiplier = buildingEffects.docMultiplier;
    let ccMultiplier = buildingEffects.ccMultiplier;
    let clickMultiplier = 1;
    let baseQualityOffset = 0;

    for (const upgrade of state.upgrades) {
      if (!upgrade.purchased) continue;
      if (upgrade.type === "clickMult") clickMultiplier *= upgrade.value;
      if (upgrade.type === "globalProdMult") docMultiplier *= upgrade.value;
      if (upgrade.type === "qualityFlat") baseQualityOffset += upgrade.value;
    }

    const careerModifiers = state.careerModifiers && typeof state.careerModifiers === "object"
      ? state.careerModifiers
      : {};
    const careerDocMultiplier = optionalFiniteNumber(careerModifiers.docMultiplier, 1);
    const careerCcMultiplier = optionalFiniteNumber(careerModifiers.ccMultiplier, 1);
    if (careerDocMultiplier === null || careerDocMultiplier <= 0 ||
        careerCcMultiplier === null || careerCcMultiplier <= 0) {
      return unavailable("invalid-career-modifier");
    }
    docMultiplier *= careerDocMultiplier;
    ccMultiplier *= careerCcMultiplier;

    const prestigeMultiplier = computePrestigeMultiplier(state.resources.culturePoints);
    const baseProductionPerSecond = state.buildings.reduce(
      (sum, building) => sum + building.baseProduction * effectiveQuantity(building),
      0
    );
    const automaticDocPerSecond = safeProduct([
      baseProductionPerSecond,
      docMultiplier,
      prestigeMultiplier
    ]);
    const qualityFactor = 0.1 + clamp01(state.stats.quality) * 0.9;
    const brandImageFactor = 0.5 + clamp01(state.stats.brandImage) * 0.5;
    const automaticCcPerSecond =
      automaticDocPerSecond === null
        ? null
        : safeProduct([
            automaticDocPerSecond,
            qualityFactor,
            brandImageFactor,
            ccMultiplier
          ]);

    if (
      automaticDocPerSecond === null ||
      automaticCcPerSecond === null ||
      !Number.isFinite(docMultiplier) ||
      !Number.isFinite(clickMultiplier) ||
      !Number.isFinite(baseQualityOffset)
    ) {
      return unavailable("economics-out-of-range");
    }

    const buildings = state.buildings.map(building => {
      const directBaseProductionPerSecond = building.baseProduction * effectiveQuantity(building);
      return {
        id: typeof building.id === "string" ? building.id : null,
        nameKey: typeof building.nameKey === "string" ? building.nameKey : null,
        role: typeof building.role === "string" ? building.role : null,
        quantity: building.quantity,
        baseProductionPerSecond: directBaseProductionPerSecond,
        directAutomaticDocPerSecond:
          directBaseProductionPerSecond * docMultiplier * prestigeMultiplier
      };
    });

    return {
      status: "exact",
      formulaVersion: FORMULA_VERSION,
      docPerSecond: automaticDocPerSecond,
      ccPerSecond: automaticCcPerSecond,
      docMultiplier,
      ccMultiplier,
      baseProductionPerSecond,
      automaticDocPerSecond,
      automaticCcPerSecond,
      prestigeMultiplier,
      multipliers: {
        doc: docMultiplier,
        cc: ccMultiplier,
        click: clickMultiplier
      },
      qualityFactor,
      brandImageFactor,
      baseQualityOffset,
      buildingEffects: {
        qualityBonus: buildingEffects.qualityBonus,
        footprintBonus: buildingEffects.footprintBonus,
        imageBonus: buildingEffects.imageBonus
      },
      buildings,
      assumptions: ["current-gauges-held-constant"]
    };
  }

  function resolveGaugeRateDelta(state, building, deltaDocPerSecond, effectiveQuantityDelta) {
    const drift = state.config.footprintDriftBase;
    if (!isFiniteNumber(drift)) {
      return unavailable("invalid-footprint-drift-base");
    }
    const careerModifiers = state.careerModifiers && typeof state.careerModifiers === "object"
      ? state.careerModifiers
      : {};
    const footprintDriftMultiplier = optionalFiniteNumber(careerModifiers.footprintDriftMultiplier, 1);
    if (footprintDriftMultiplier === null || footprintDriftMultiplier <= 0) {
      return unavailable("invalid-career-modifier");
    }
    const gaugeQuantityDelta = isFiniteNumber(effectiveQuantityDelta) && effectiveQuantityDelta >= 0
      ? effectiveQuantityDelta
      : 1;

    return {
      status: "estimated",
      quality:
        optionalFiniteNumber(building.qualityBonusPerUnit, 0) * gaugeQuantityDelta * INFRA_STAT_RATE_PER_SECOND,
      footprint:
        optionalFiniteNumber(building.footprintBonusPerUnit, 0) * gaugeQuantityDelta * INFRA_STAT_RATE_PER_SECOND +
        drift * footprintDriftMultiplier * deltaDocPerSecond,
      brandImage:
        optionalFiniteNumber(building.imageBonusPerUnit, 0) * gaugeQuantityDelta * INFRA_STAT_RATE_PER_SECOND,
      assumptions: ["linearized-before-clamp-and-recovery"]
    };
  }

  /** Simulates one additional unit without mutating the supplied state. */
  function simulateNextBuilding(state, buildingId) {
    const shapeError = validateStateShape(state);
    if (shapeError) return unavailable(shapeError);
    if (typeof buildingId !== "string") return unavailable("invalid-building-id");

    const targetIndex = state.buildings.findIndex(
      building => building && building.id === buildingId
    );
    if (targetIndex < 0) return unavailable("building-not-found");

    const target = state.buildings[targetIndex];
    const cost = computeNextCost(state, buildingId);
    if (cost.status === "unavailable") {
      return unavailable(cost.reason, { nextCost: cost });
    }

    const before = computeAutomaticEconomics(state);
    if (before.status === "unavailable") {
      return unavailable(before.reason, { nextCost: cost });
    }
    if (target.quantity >= Number.MAX_SAFE_INTEGER) {
      return unavailable("quantity-out-of-range", { nextCost: cost });
    }

    const simulatedBuildings = state.buildings.map((building, index) =>
      index === targetIndex
        ? Object.assign({}, building, { quantity: building.quantity + 1 })
        : building
    );
    const simulatedState = Object.assign({}, state, { buildings: simulatedBuildings });
    const after = computeAutomaticEconomics(simulatedState);
    if (after.status === "unavailable") {
      return unavailable(after.reason, { nextCost: cost });
    }

    const deltaAutomaticDocPerSecond =
      after.automaticDocPerSecond - before.automaticDocPerSecond;
    const deltaAutomaticCcPerSecond =
      after.automaticCcPerSecond - before.automaticCcPerSecond;
    if (
      !Number.isFinite(deltaAutomaticDocPerSecond) ||
      !Number.isFinite(deltaAutomaticCcPerSecond)
    ) {
      return unavailable("simulation-out-of-range", { nextCost: cost });
    }

    const paybackSeconds =
      deltaAutomaticDocPerSecond > 0
        ? {
            status: cost.value === 0 ? "exact" : "estimated",
            value: cost.value === 0 ? 0 : cost.value / deltaAutomaticDocPerSecond,
            unit: "seconds",
            assumptions:
              cost.value === 0 ? [] : ["constant-marginal-doc-rate"]
          }
        : unavailable("no-positive-doc-delta", { unit: "seconds" });
    const efficiencyPer1000Cost =
      cost.value > 0
        ? {
            status: "exact",
            value: (deltaAutomaticDocPerSecond * 1000) / cost.value,
            unit: "doc-per-second-per-1000-doc"
          }
        : unavailable("zero-cost", { unit: "doc-per-second-per-1000-doc" });
    const beforeBuilding = before.buildings[targetIndex];
    const afterBuilding = after.buildings[targetIndex];
    const effectiveQuantityDelta =
      effectiveQuantity(simulatedBuildings[targetIndex]) - effectiveQuantity(target);

    return {
      status: "exact",
      formulaVersion: FORMULA_VERSION,
      buildingId,
      quantityBefore: target.quantity,
      quantityAfter: target.quantity + 1,
      nextCost: cost,
      automaticDocPerSecondBefore: before.automaticDocPerSecond,
      automaticDocPerSecondAfter: after.automaticDocPerSecond,
      deltaAutomaticDocPerSecond,
      automaticCcPerSecondBefore: before.automaticCcPerSecond,
      automaticCcPerSecondAfter: after.automaticCcPerSecond,
      deltaAutomaticCcPerSecond,
      directAutomaticDocPerSecondBefore: beforeBuilding.directAutomaticDocPerSecond,
      directAutomaticDocPerSecondAfter: afterBuilding.directAutomaticDocPerSecond,
      paybackSeconds,
      efficiencyPer1000Cost,
      gaugeRateDeltaPerSecond: resolveGaugeRateDelta(
        state,
        target,
        deltaAutomaticDocPerSecond,
        effectiveQuantityDelta
      ),
      assumptions: ["current-gauges-held-constant"]
    };
  }

  function computeAffordSeconds(nextCost, state, automaticDocPerSecond) {
    const docBank = state.resources.docBank;
    if (!isFiniteNumber(docBank) || docBank < 0) {
      return unavailable("invalid-doc-bank", { unit: "seconds" });
    }
    if (!nextCost || nextCost.status === "unavailable") {
      return unavailable("next-cost-unavailable", { unit: "seconds" });
    }

    const deficit = Math.max(0, nextCost.value - docBank);
    if (deficit === 0) {
      return {
        status: "exact",
        value: 0,
        unit: "seconds"
      };
    }
    if (!isFiniteNumber(automaticDocPerSecond) || automaticDocPerSecond <= 0) {
      return unavailable("no-positive-automatic-doc-rate", { unit: "seconds" });
    }

    return {
      status: "estimated",
      value: deficit / automaticDocPerSecond,
      unit: "seconds",
      assumptions: [
        "constant-automatic-doc-rate",
        "no-intervening-spend",
        "no-manual-doc-gain"
      ]
    };
  }

  function mostConservativeStatus(statuses) {
    if (statuses.includes("unavailable")) return "estimated";
    if (statuses.includes("estimated")) return "estimated";
    return "exact";
  }

  /** Builds a serializable array of per-building investment rows. */
  function buildInvestmentRows(state) {
    const shapeError = validateStateShape(state);
    if (shapeError) return [];

    const automatic = computeAutomaticEconomics(state);

    const rows = state.buildings.map(building => {
      if (!building || typeof building.id !== "string") {
        return {
          id: null,
          nameKey: null,
          role: null,
          quantity: null,
          currentCost: null,
          totalInvested: null,
          currentDirectProduction: null,
          marginalDocPerSecond: null,
          marginalCcPerSecond: null,
          paybackSeconds: null,
          affordSeconds: null,
          qualityDelta: null,
          footprintDelta: null,
          brandDelta: null,
          status: "unavailable",
          reason: "invalid-building-id"
        };
      }

      const simulation = simulateNextBuilding(state, building.id);
      const cumulativeCost = computeCumulativeCost(state, building.id);
      if (simulation.status === "unavailable") {
        const fallbackCost = computeNextCost(state, building.id);
        return {
          id: building.id,
          nameKey: typeof building.nameKey === "string" ? building.nameKey : null,
          role: typeof building.role === "string" ? building.role : null,
          quantity: isNonNegativeInteger(building.quantity) ? building.quantity : null,
          currentCost: fallbackCost.status === "unavailable" ? null : fallbackCost.value,
          totalInvested:
            cumulativeCost.status === "unavailable" ? null : cumulativeCost.value,
          currentDirectProduction: null,
          marginalDocPerSecond: null,
          marginalCcPerSecond: null,
          paybackSeconds: null,
          affordSeconds: null,
          qualityDelta: null,
          footprintDelta: null,
          brandDelta: null,
          status: "unavailable",
          reason: simulation.reason,
          fieldStatus: {
            currentCost: fallbackCost.status,
            totalInvested: cumulativeCost.status,
            currentDirectProduction: "unavailable",
            marginalDocPerSecond: "unavailable",
            marginalCcPerSecond: "unavailable",
            paybackSeconds: "unavailable",
            affordSeconds: "unavailable",
            qualityDelta: "unavailable",
            footprintDelta: "unavailable",
            brandDelta: "unavailable"
          }
        };
      }

      const affordSeconds = computeAffordSeconds(
        simulation.nextCost,
        state,
        automatic.status === "exact" ? automatic.docPerSecond : null
      );
      const gaugeDelta = simulation.gaugeRateDeltaPerSecond;
      const gaugeStatus = gaugeDelta.status;
      const fieldStatus = {
        currentCost: simulation.nextCost.status,
        totalInvested: cumulativeCost.status,
        currentDirectProduction: "exact",
        marginalDocPerSecond: "exact",
        marginalCcPerSecond: "exact",
        paybackSeconds: simulation.paybackSeconds.status,
        affordSeconds: affordSeconds.status,
        qualityDelta: gaugeStatus,
        footprintDelta: gaugeStatus,
        brandDelta: gaugeStatus
      };

      return {
        id: building.id,
        nameKey: typeof building.nameKey === "string" ? building.nameKey : null,
        role: typeof building.role === "string" ? building.role : null,
        quantity: building.quantity,
        currentCost: simulation.nextCost.value,
        totalInvested:
          cumulativeCost.status === "unavailable" ? null : cumulativeCost.value,
        currentDirectProduction: simulation.directAutomaticDocPerSecondBefore,
        marginalDocPerSecond: simulation.deltaAutomaticDocPerSecond,
        marginalCcPerSecond: simulation.deltaAutomaticCcPerSecond,
        paybackSeconds:
          simulation.paybackSeconds.status === "unavailable"
            ? null
            : simulation.paybackSeconds.value,
        affordSeconds:
          affordSeconds.status === "unavailable" ? null : affordSeconds.value,
        qualityDelta:
          gaugeStatus === "unavailable" ? null : gaugeDelta.quality,
        footprintDelta:
          gaugeStatus === "unavailable" ? null : gaugeDelta.footprint,
        brandDelta:
          gaugeStatus === "unavailable" ? null : gaugeDelta.brandImage,
        status: mostConservativeStatus(Object.values(fieldStatus)),
        fieldStatus,
        isUnlocked: Boolean(building.isUnlocked),
        reason: null,
        assumptions: Array.from(
          new Set(
            [
              cumulativeCost.assumptions,
              simulation.paybackSeconds.assumptions,
              affordSeconds.assumptions,
              gaugeDelta.assumptions
            ]
              .filter(Array.isArray)
              .flat()
          )
        )
      };
    });

    return rows;
  }

  function etaForGap(gap, automaticCcPerSecond) {
    if (gap <= 0) {
      return {
        status: "exact",
        value: 0,
        unit: "seconds"
      };
    }
    if (!isFiniteNumber(automaticCcPerSecond) || automaticCcPerSecond <= 0) {
      return unavailable("no-positive-automatic-cc-rate", { unit: "seconds" });
    }
    return {
      status: "estimated",
      value: gap / automaticCcPerSecond,
      unit: "seconds",
      assumptions: ["constant-automatic-cc-rate", "current-gauges-held-constant"]
    };
  }

  /** Computes current prestige gain, thresholds, multipliers and constant-rate ETAs. */
  function computePrestigeOutlook(state) {
    const shapeError = validateStateShape(state);
    if (shapeError) return unavailable(shapeError);

    const ccTotal = state.resources.ccTotal;
    const culturePoints = state.resources.culturePoints;
    const divisor = state.config.prestigeCcDivisor;
    const requirement = state.config.prestigeRequirement;
    if (!isFiniteNumber(ccTotal) || ccTotal < 0) return unavailable("invalid-cc-total");
    if (!isFiniteNumber(culturePoints) || culturePoints < 0) {
      return unavailable("invalid-culture-points");
    }
    if (!isFiniteNumber(divisor) || divisor <= 0) {
      return unavailable("invalid-prestige-cc-divisor");
    }
    if (!isFiniteNumber(requirement) || requirement < 0) {
      return unavailable("invalid-prestige-requirement");
    }

    const potentialCultureGain = computePotentialCultureGain(ccTotal, divisor);
    const ready = ccTotal >= requirement;
    const currentPrestigeMultiplier = computePrestigeMultiplier(culturePoints);
    const prestigeMultiplierAfterReset = computePrestigeMultiplier(culturePoints + potentialCultureGain);
    const nextCultureGain = potentialCultureGain + 1;
    const nextCultureGainThresholdCc =
      divisor * (Math.pow(10, nextCultureGain / PRESTIGE_GAIN_LOG_SCALE) - 1);
    if (!Number.isFinite(nextCultureGainThresholdCc)) {
      return unavailable("prestige-threshold-out-of-range");
    }

    const economics = computeAutomaticEconomics(state);
    const automaticCcPerSecond =
      economics.status === "exact" ? economics.automaticCcPerSecond : null;
    const ccToRequirement = Math.max(0, requirement - ccTotal);
    const ccToNextCultureGain = Math.max(0, nextCultureGainThresholdCc - ccTotal);

    return {
      status: "exact",
      formulaVersion: FORMULA_VERSION,
      available: ready,
      potentialCulture: potentialCultureGain,
      requirement,
      nextCultureCc: nextCultureGainThresholdCc,
      ready,
      actionable: ready && potentialCultureGain > 0,
      currentCcTotal: ccTotal,
      requirementCc: requirement,
      ccToRequirement,
      potentialCultureGain,
      currentCulturePoints: culturePoints,
      currentPrestigeMultiplier,
      prestigeMultiplierAfterReset,
      prestigeMultiplierDelta:
        prestigeMultiplierAfterReset - currentPrestigeMultiplier,
      nextCultureGain,
      nextCultureGainThresholdCc,
      ccToNextCultureGain,
      automaticCcPerSecond:
        economics.status === "exact"
          ? { status: "exact", value: automaticCcPerSecond, unit: "cc-per-second" }
          : unavailable(economics.reason, { unit: "cc-per-second" }),
      etaToRequirement: etaForGap(ccToRequirement, automaticCcPerSecond),
      etaToNextCultureGain: etaForGap(ccToNextCultureGain, automaticCcPerSecond)
    };
  }

  return {
    computePotentialCultureGain,
    computePrestigeMultiplier,
    computeCultureGaugeBonuses,
    computeNextCost,
    computeCumulativeCost,
    computeAutomaticEconomics,
    simulateNextBuilding,
    buildInvestmentRows,
    computePrestigeOutlook
  };
});

if (typeof window === "undefined" && typeof module === "object" && module !== null && module.exports &&
    typeof require === "function" && require.main === module) {
  const assert = require("node:assert/strict");
  const analytics = module.exports;
  const sampleState = {
    buildings: [
      {
        id: "producer",
        nameKey: "building.producer.name",
        baseProduction: 1,
        baseCost: 10,
        costMultiplier: 2,
        quantity: 1,
        isUnlocked: true
      },
      {
        id: "multiplier",
        nameKey: "building.multiplier.name",
        baseProduction: 0,
        baseCost: 100,
        costMultiplier: 2,
        quantity: 1,
        docMultiplierPerUnit: 0.5,
        ccMultiplierPerUnit: 0.1,
        isUnlocked: true
      }
    ],
    upgrades: [
      {
        id: "global",
        purchased: true,
        type: "globalProdMult",
        value: 2
      }
    ],
    resources: {
      docBank: 0,
      docTotal: 0,
      ccTotal: 10000,
      culturePoints: 2
    },
    stats: {
      quality: 0.5,
      footprint: 0.5,
      brandImage: 0.5
    },
    config: {
      footprintDriftBase: 0.00001,
      prestigeCcDivisor: 1000,
      prestigeRequirement: 10000
    }
  };

  assert.equal(analytics.computeNextCost(sampleState, "producer").value, 20);
  assert.deepEqual(
    analytics.computeCumulativeCost(sampleState, "producer"),
    {
      status: "estimated",
      value: 10,
      formula: "current-model-reconstruction",
      formulaVersion: 1,
      assumptions: ["unchanged-cost-model"]
    }
  );

  const automatic = analytics.computeAutomaticEconomics(sampleState);
  const samplePrestigeMultiplier = analytics.computePrestigeMultiplier(2);
  const sampleAutomaticDoc = 3 * samplePrestigeMultiplier;
  assert.equal(automatic.status, "exact");
  assert.equal(automatic.docMultiplier, 3);
  assert.equal(automatic.ccMultiplier, 1.1);
  assert.ok(Math.abs(automatic.automaticDocPerSecond - sampleAutomaticDoc) < 1e-12);
  assert.ok(Math.abs(automatic.automaticCcPerSecond - sampleAutomaticDoc * 0.45375) < 1e-12);
  assert.equal(automatic.docPerSecond, automatic.automaticDocPerSecond);
  assert.equal(automatic.ccPerSecond, automatic.automaticCcPerSecond);

  const simulation = analytics.simulateNextBuilding(sampleState, "producer");
  assert.equal(simulation.status, "exact");
  assert.ok(Math.abs(simulation.deltaAutomaticDocPerSecond - sampleAutomaticDoc) < 1e-12);
  assert.ok(Math.abs(simulation.paybackSeconds.value - 20 / sampleAutomaticDoc) < 1e-12);

  const rows = analytics.buildInvestmentRows(sampleState);
  assert.equal(Array.isArray(rows), true);
  assert.equal(rows[0].id, "producer");
  assert.equal(rows[0].currentCost, 20);
  assert.ok(Math.abs(rows[0].marginalDocPerSecond - sampleAutomaticDoc) < 1e-12);

  const prestige = analytics.computePrestigeOutlook(sampleState);
  assert.equal(prestige.ready, true);
  assert.equal(prestige.available, true);
  assert.equal(prestige.potentialCultureGain, 3);
  assert.equal(prestige.potentialCulture, 3);
  assert.equal(prestige.prestigeMultiplierAfterReset, analytics.computePrestigeMultiplier(5));

  console.log("economy-analytics self-test ok");
}
