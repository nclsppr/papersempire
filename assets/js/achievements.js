(function () {
  const definitions = [
    {
      id: "firstDoc",
      nameKey: "ach.firstDoc.name",
      descKey: "ach.firstDoc.desc",
      condition: state => state.resources.docTotal >= 1
    },
    {
      id: "hundredDocs",
      nameKey: "ach.hundredDocs.name",
      descKey: "ach.hundredDocs.desc",
      condition: state => state.resources.docTotal >= 100
    },
    {
      id: "thousandDocs",
      nameKey: "ach.thousandDocs.name",
      descKey: "ach.thousandDocs.desc",
      condition: state => state.resources.docTotal >= 1000
    },
    {
      id: "firstBuilding",
      nameKey: "ach.firstBuilding.name",
      descKey: "ach.firstBuilding.desc",
      condition: state => state.buildings.some(b => b.quantity > 0)
    },
    {
      id: "firstPrestige",
      nameKey: "ach.firstPrestige.name",
      descKey: "ach.firstPrestige.desc",
      condition: state => state.resources.culturePoints > 0
    },
    {
      id: "tenKDocs",
      nameKey: "ach.tenKDocs.name",
      descKey: "ach.tenKDocs.desc",
      condition: state => state.resources.docTotal >= 10000
    },
    {
      id: "hundredKDocs",
      nameKey: "ach.hundredKDocs.name",
      descKey: "ach.hundredKDocs.desc",
      condition: state => state.resources.docTotal >= 100000
    },
    {
      id: "millionDocs",
      nameKey: "ach.millionDocs.name",
      descKey: "ach.millionDocs.desc",
      condition: state => state.resources.docTotal >= 1000000
    },
    {
      id: "firstUpgrade",
      nameKey: "ach.firstUpgrade.name",
      descKey: "ach.firstUpgrade.desc",
      condition: state => state.upgrades.some(u => u.purchased)
    },
    {
      id: "fiveBuildingTypes",
      nameKey: "ach.fiveBuildingTypes.name",
      descKey: "ach.fiveBuildingTypes.desc",
      condition: state => state.buildings.filter(b => b.quantity > 0).length >= 5
    },
    {
      id: "fullCampus",
      nameKey: "ach.fullCampus.name",
      descKey: "ach.fullCampus.desc",
      condition: state => state.buildings.every(b => b.quantity > 0)
    },
    {
      id: "tenOfOne",
      nameKey: "ach.tenOfOne.name",
      descKey: "ach.tenOfOne.desc",
      condition: state => state.buildings.some(b => b.quantity >= 10)
    },
    {
      id: "industrialScale",
      nameKey: "ach.industrialScale.name",
      descKey: "ach.industrialScale.desc",
      condition: state => state.buildings.some(b => b.quantity >= 25)
    },
    {
      id: "qualityFreak",
      nameKey: "ach.qualityFreak.name",
      descKey: "ach.qualityFreak.desc",
      condition: state => state.stats.quality >= 0.9
    },
    {
      id: "brandStar",
      nameKey: "ach.brandStar.name",
      descKey: "ach.brandStar.desc",
      condition: state => state.stats.brandImage >= 0.9
    },
    {
      id: "cultureCollector",
      nameKey: "ach.cultureCollector.name",
      descKey: "ach.cultureCollector.desc",
      condition: state => state.resources.culturePoints >= 10
    }
  ];

  function evaluate(state, unlockedMap) {
    const newlyUnlocked = [];
    for (const def of definitions) {
      if (unlockedMap[def.id]) continue;
      try {
        if (def.condition(state)) {
          newlyUnlocked.push(def.id);
        }
      } catch {
        // ignore faulty condition
      }
    }
    return newlyUnlocked;
  }

  window.Achievements = {
    definitions,
    evaluate
  };
})();
