(function (root, factory) {
  const api = factory();
  const commonJS = typeof module === "object" && module !== null && module.exports;
  if (commonJS) module.exports = api;
  if (typeof window !== "undefined") {
    window.Achievements = api;
  } else if (!commonJS) {
    root.Achievements = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const countOwnedTypes = state => state.buildings.filter(building => building.quantity > 0).length;
  const maxOwnedQuantity = state => state.buildings.reduce(
    (maximum, building) => Math.max(maximum, building.quantity || 0),
    0
  );
  const countPurchasedUpgrades = state => state.upgrades.filter(upgrade => upgrade.purchased).length;
  const countPrestiges = state => {
    const observed = state && state.analytics && state.analytics.lifetimeObserved
      ? state.analytics.lifetimeObserved.prestiges
      : 0;
    return Number.isFinite(observed) ? Math.max(0, observed) : 0;
  };

  function achievement(id, nameKey, descKey, target, progress, reward) {
    return {
      id,
      nameKey,
      descKey,
      target,
      progress,
      reward,
      condition(state) {
        return progress(state) >= target;
      }
    };
  }

  const definitions = [
    achievement("firstDoc", "ach.firstDoc.name", "ach.firstDoc.desc", 1,
      state => state.resources.docTotal, { doc: 5 }),
    achievement("hundredDocs", "ach.hundredDocs.name", "ach.hundredDocs.desc", 100,
      state => state.resources.docTotal, { doc: 25 }),
    achievement("thousandDocs", "ach.thousandDocs.name", "ach.thousandDocs.desc", 1000,
      state => state.resources.docTotal, { doc: 100 }),
    achievement("firstBuilding", "ach.firstBuilding.name", "ach.firstBuilding.desc", 1,
      state => state.buildings.reduce((sum, building) => sum + building.quantity, 0), { doc: 20 }),
    achievement("firstPrestige", "ach.firstPrestige.name", "ach.firstPrestige.desc", 1,
      countPrestiges, { culture: 1 }),
    achievement("tenKDocs", "ach.tenKDocs.name", "ach.tenKDocs.desc", 10000,
      state => state.resources.docTotal, { doc: 300 }),
    achievement("hundredKDocs", "ach.hundredKDocs.name", "ach.hundredKDocs.desc", 100000,
      state => state.resources.docTotal, { doc: 1000 }),
    achievement("millionDocs", "ach.millionDocs.name", "ach.millionDocs.desc", 1000000,
      state => state.resources.docTotal, { culture: 1 }),
    achievement("firstUpgrade", "ach.firstUpgrade.name", "ach.firstUpgrade.desc", 1,
      countPurchasedUpgrades, { doc: 50 }),
    achievement("fiveBuildingTypes", "ach.fiveBuildingTypes.name", "ach.fiveBuildingTypes.desc", 5,
      countOwnedTypes, { cc: 200 }),
    achievement("fullCampus", "ach.fullCampus.name", "ach.fullCampus.desc", 12,
      countOwnedTypes, { culture: 2 }),
    achievement("tenOfOne", "ach.tenOfOne.name", "ach.tenOfOne.desc", 10,
      maxOwnedQuantity, { doc: 250 }),
    achievement("industrialScale", "ach.industrialScale.name", "ach.industrialScale.desc", 25,
      maxOwnedQuantity, { doc: 1000 }),
    achievement("qualityFreak", "ach.qualityFreak.name", "ach.qualityFreak.desc", 90,
      state => (state.stats.quality || 0) * 100, { cc: 300 }),
    achievement("brandStar", "ach.brandStar.name", "ach.brandStar.desc", 90,
      state => (state.stats.brandImage || 0) * 100, { cc: 300 }),
    achievement("cultureCollector", "ach.cultureCollector.name", "ach.cultureCollector.desc", 10,
      state => state.resources.culturePoints, { culture: 1 })
  ];

  function safeProgress(definition, state) {
    try {
      const value = Number(definition.progress(state));
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    } catch {
      return 0;
    }
  }

  function evaluate(state, unlockedMap) {
    const newlyUnlocked = [];
    for (const definition of definitions) {
      if (unlockedMap[definition.id]) continue;
      if (safeProgress(definition, state) >= definition.target) {
        newlyUnlocked.push(definition.id);
      }
    }
    return newlyUnlocked;
  }

  function getProgress(definition, state) {
    const current = Math.min(definition.target, safeProgress(definition, state));
    return {
      current,
      target: definition.target,
      ratio: definition.target > 0 ? current / definition.target : 1
    };
  }

  return { definitions, evaluate, getProgress };
});
