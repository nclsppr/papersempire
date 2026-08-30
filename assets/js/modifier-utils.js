(function (rootFactory) {
  const factory = () => {
    const BUILDING_MILESTONES = Object.freeze([
      Object.freeze({ quantity: 10, multiplier: 1.1 }),
      Object.freeze({ quantity: 25, multiplier: 1.25 })
    ]);

    function numberOrZero(value) {
      return typeof value === "number" && !Number.isNaN(value) ? value : 0;
    }

    function getMilestoneMultiplier(quantity) {
      const safeQuantity = Math.max(0, numberOrZero(quantity));
      let multiplier = 1;
      for (const milestone of BUILDING_MILESTONES) {
        if (safeQuantity >= milestone.quantity) multiplier = milestone.multiplier;
      }
      return multiplier;
    }

    function getEffectiveQuantity(quantity) {
      const safeQuantity = Math.max(0, numberOrZero(quantity));
      return safeQuantity * getMilestoneMultiplier(safeQuantity);
    }

    function getNextMilestone(quantity) {
      const safeQuantity = Math.max(0, numberOrZero(quantity));
      return BUILDING_MILESTONES.find(milestone => safeQuantity < milestone.quantity) || null;
    }

    function getBuildingImpact(building, quantityOverride) {
      if (!building) {
        return {
          docMultiplierBonus: 0,
          ccMultiplierBonus: 0,
          qualityBonus: 0,
          footprintBonus: 0,
          imageBonus: 0,
          contractDurationReduction: 0
        };
      }

      const quantity =
        typeof quantityOverride === "number"
          ? quantityOverride
          : numberOrZero(building.quantity);

      const effectiveQuantity = getEffectiveQuantity(quantity);
      const impactPerUnit = {
        docMultiplierBonus: numberOrZero(building.docMultiplierPerUnit),
        ccMultiplierBonus: numberOrZero(building.ccMultiplierPerUnit),
        qualityBonus: numberOrZero(building.qualityBonusPerUnit),
        footprintBonus: numberOrZero(building.footprintBonusPerUnit),
        imageBonus: numberOrZero(building.imageBonusPerUnit),
        contractDurationReduction: numberOrZero(building.contractDurationReductionPerUnit)
      };

      return {
        docMultiplierBonus: impactPerUnit.docMultiplierBonus * effectiveQuantity,
        ccMultiplierBonus: impactPerUnit.ccMultiplierBonus * effectiveQuantity,
        qualityBonus: impactPerUnit.qualityBonus * effectiveQuantity,
        footprintBonus: impactPerUnit.footprintBonus * effectiveQuantity,
        imageBonus: impactPerUnit.imageBonus * effectiveQuantity,
        contractDurationReduction: impactPerUnit.contractDurationReduction * effectiveQuantity
      };
    }

    function computeBuildingEffects(buildings = []) {
      return buildings.reduce(
        (acc, building) => {
          const impact = getBuildingImpact(building);

          if (impact.docMultiplierBonus) {
            acc.docMult *= 1 + impact.docMultiplierBonus;
          }
          if (impact.ccMultiplierBonus) {
            acc.ccMult *= 1 + impact.ccMultiplierBonus;
          }

          acc.qualityBonus += impact.qualityBonus;
          acc.footprintBonus += impact.footprintBonus;
          acc.imageBonus += impact.imageBonus;
          acc.contractDurationReduction += impact.contractDurationReduction;

          return acc;
        },
        {
          docMult: 1,
          ccMult: 1,
          qualityBonus: 0,
          footprintBonus: 0,
          imageBonus: 0,
          contractDurationReduction: 0
        }
      );
    }

    return {
      BUILDING_MILESTONES,
      getMilestoneMultiplier,
      getEffectiveQuantity,
      getNextMilestone,
      getBuildingImpact,
      computeBuildingEffects
    };
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const globalObject =
      typeof self !== "undefined"
        ? self
        : typeof window !== "undefined"
        ? window
        : globalThis;
    globalObject.ModifierUtils = factory();
  }
})();
