(function (root, factory) {
  const api = factory();
  const commonJS = typeof module === "object" && module !== null && module.exports;
  if (commonJS) module.exports = api;
  if (typeof window !== "undefined") {
    window.EndgameModule = api;
  } else if (!commonJS) {
    root.EndgameModule = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MAX_VISIBLE_CONTRACTS = 3;
  const MAX_PREPRESS_DURATION_REDUCTION = 0.3;

  function clause(id, source, comparison, target, doc, cc) {
    return {
      id,
      source,
      comparison,
      target,
      nameKey: "contracts.clause." + id + ".name",
      descKey: "contracts.clause." + id + ".desc",
      reward: { doc, cc }
    };
  }

  const CONTRACT_DEFS = [
    {
      id: "expressFlyer",
      category: "cadence",
      nameKey: "contracts.expressFlyer.name",
      descKey: "contracts.expressFlyer.desc",
      minDocTotal: 0,
      duration: 45,
      requirements: { quality: 0.45, image: 0.35, volume: 800 },
      reward: { doc: 600, cc: 120 },
      clause: clause("quality", "quality", "minimum", 0.62, 240, 60)
    },
    {
      id: "onboardingKit",
      category: "clientRelations",
      nameKey: "contracts.onboardingKit.name",
      descKey: "contracts.onboardingKit.desc",
      minDocTotal: 1500,
      duration: 75,
      requirements: { quality: 0.55, image: 0.45, volume: 2500 },
      reward: { doc: 2200, cc: 420 },
      clause: clause("footprint", "footprint", "maximum", 0.52, 850, 160)
    },
    {
      id: "crossMedia",
      category: "clientRelations",
      nameKey: "contracts.crossMedia.name",
      descKey: "contracts.crossMedia.desc",
      minDocTotal: 5000,
      duration: 110,
      requirements: { quality: 0.65, image: 0.6, volume: 6000 },
      reward: { doc: 5200, cc: 900 },
      clause: clause("image", "brandImage", "minimum", 0.72, 1600, 300)
    },
    {
      id: "governancePack",
      category: "quality",
      nameKey: "contracts.governancePack.name",
      descKey: "contracts.governancePack.desc",
      minDocTotal: 12000,
      duration: 150,
      requirements: { quality: 0.75, image: 0.7, volume: 14000 },
      reward: { doc: 12000, cc: 1800 },
      clause: clause("quality", "quality", "minimum", 0.82, 3600, 600)
    },
    {
      id: "finalFinalProof",
      category: "quality",
      nameKey: "contracts.finalFinalProof.name",
      descKey: "contracts.finalFinalProof.desc",
      minDocTotal: 25000,
      duration: 165,
      requirements: {
        quality: 0.76,
        image: 0.68,
        volume: 30000,
        buildings: { prepressStudio: 1 }
      },
      reward: { doc: 26000, cc: 3900 },
      clause: clause("quality", "quality", "minimum", 0.86, 7800, 1200)
    },
    {
      id: "tradeFair",
      category: "clientRelations",
      nameKey: "contracts.tradeFair.name",
      descKey: "contracts.tradeFair.desc",
      minDocTotal: 40000,
      duration: 180,
      requirements: { quality: 0.78, image: 0.72, volume: 45000 },
      reward: { doc: 40000, cc: 6000 },
      clause: clause("image", "brandImage", "minimum", 0.82, 12000, 1800)
    },
    {
      id: "electionPack",
      category: "cadence",
      nameKey: "contracts.electionPack.name",
      descKey: "contracts.electionPack.desc",
      minDocTotal: 120000,
      duration: 220,
      requirements: { quality: 0.8, image: 0.74, volume: 140000 },
      reward: { doc: 120000, cc: 18000 },
      clause: clause("footprint", "footprint", "maximum", 0.48, 36000, 4800)
    },
    {
      id: "annualReports",
      category: "quality",
      nameKey: "contracts.annualReports.name",
      descKey: "contracts.annualReports.desc",
      minDocTotal: 400000,
      duration: 260,
      requirements: { quality: 0.82, image: 0.77, volume: 450000 },
      reward: { doc: 400000, cc: 55000 },
      clause: clause("quality", "quality", "minimum", 0.9, 120000, 12000)
    },
    {
      id: "nationalCensus",
      category: "cadence",
      nameKey: "contracts.nationalCensus.name",
      descKey: "contracts.nationalCensus.desc",
      minDocTotal: 1000000,
      duration: 300,
      requirements: { quality: 0.85, image: 0.8, volume: 1100000 },
      reward: { doc: 1000000, cc: 130000 },
      clause: clause("footprint", "footprint", "maximum", 0.42, 300000, 32000)
    }
  ];

  const activeContract = {
    current: null,
    timer: 0,
    duration: 0,
    terms: null,
    clauseState: null
  };
  let availableContracts = [];
  let priorityContractIds = [];

  function finitePositive(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normaliseModifiers(modifiers) {
    const source = modifiers && typeof modifiers === "object" ? modifiers : {};
    return {
      // The public integration uses the contract* names while persisted active
      // terms already contain the compact names. Accept both so a page reload
      // cannot silently remove the reward conditions frozen at acceptance.
      durationMultiplier: finitePositive(source.contractDurationMultiplier, finitePositive(source.durationMultiplier, 1)),
      docRewardMultiplier: finitePositive(source.contractDocRewardMultiplier, finitePositive(source.docRewardMultiplier, 1)),
      ccRewardMultiplier: finitePositive(source.contractCcRewardMultiplier, finitePositive(source.ccRewardMultiplier, 1)),
      clauseRewardMultiplier: finitePositive(source.clauseRewardMultiplier, 1)
    };
  }

  function prepressDurationReduction(gameState) {
    const buildings = gameState && Array.isArray(gameState.buildings) ? gameState.buildings : [];
    const studio = buildings.find(building => building && building.id === "prepressStudio");
    if (!studio) return 0;
    const quantity = Number.isFinite(studio.quantity) ? Math.max(0, studio.quantity) : 0;
    const perUnit = Number.isFinite(studio.contractDurationReductionPerUnit)
      ? Math.max(0, studio.contractDurationReductionPerUnit)
      : 0;
    return Math.min(MAX_PREPRESS_DURATION_REDUCTION, quantity * perUnit);
  }

  function scaledReward(reward, docMultiplier, ccMultiplier) {
    const source = reward || {};
    return {
      doc: Math.max(0, Math.round((source.doc || 0) * docMultiplier)),
      cc: Math.max(0, Math.round((source.cc || 0) * ccMultiplier))
    };
  }

  function previewContract(contractOrId, gameState, modifiers) {
    const contract = typeof contractOrId === "string"
      ? CONTRACT_DEFS.find(def => def.id === contractOrId)
      : contractOrId;
    if (!contract) return null;
    const terms = normaliseModifiers(modifiers);
    const reduction = prepressDurationReduction(gameState);
    const duration = Math.max(15, Math.round(contract.duration * (1 - reduction) * terms.durationMultiplier));
    return {
      duration,
      durationReduction: reduction,
      baseReward: scaledReward(contract.reward, terms.docRewardMultiplier, terms.ccRewardMultiplier),
      clauseReward: scaledReward(
        contract.clause && contract.clause.reward,
        terms.docRewardMultiplier * terms.clauseRewardMultiplier,
        terms.ccRewardMultiplier * terms.clauseRewardMultiplier
      ),
      terms
    };
  }

  function loadData(gameState, savedContract) {
    restoreActiveContract(savedContract, gameState);
    availableContracts = [];
    refillContracts(gameState);
    return Promise.resolve(CONTRACT_DEFS.length);
  }

  function safeClauseState(saved, contract, gameState) {
    if (!contract.clause) return null;
    const fallback = createClauseState(contract.clause, gameState);
    if (!saved || typeof saved !== "object") return fallback;
    const observed = Number(saved.observed);
    if (!Number.isFinite(observed)) return fallback;
    return {
      clauseId: contract.clause.id,
      observed: clamp(observed, 0, 1),
      failed: saved.failed === true
    };
  }

  function restoreActiveContract(savedContract, gameState) {
    clearActiveContract();
    if (!savedContract || typeof savedContract !== "object") return;
    const contract = CONTRACT_DEFS.find(def => def.id === savedContract.id);
    const timer = Number(savedContract.timer);
    if (!contract || !Number.isFinite(timer) || timer <= 0) return;
    const savedDuration = finitePositive(Number(savedContract.duration), contract.duration);
    activeContract.current = contract;
    activeContract.duration = Math.max(timer, savedDuration);
    activeContract.timer = Math.min(activeContract.duration, timer);
    activeContract.terms = normaliseModifiers(savedContract.terms);
    activeContract.clauseState = safeClauseState(savedContract.clauseState, contract, gameState);
  }

  function exportActiveContract() {
    if (!activeContract.current) return null;
    return {
      schemaVersion: 2,
      id: activeContract.current.id,
      timer: Math.max(0, activeContract.timer),
      duration: Math.max(1, activeContract.duration),
      terms: { ...activeContract.terms },
      clauseState: activeContract.clauseState ? { ...activeContract.clauseState } : null
    };
  }

  function clearActiveContract() {
    activeContract.current = null;
    activeContract.timer = 0;
    activeContract.duration = 0;
    activeContract.terms = null;
    activeContract.clauseState = null;
  }

  function cancelActiveContract() {
    const hadActiveContract = Boolean(activeContract.current);
    clearActiveContract();
    return hadActiveContract;
  }

  function resetForPrestige(gameState) {
    cancelActiveContract();
    availableContracts = [];
    priorityContractIds = [];
    refillContracts(gameState);
  }

  function getAvailableContracts(gameState) {
    ensureContracts(gameState);
    return availableContracts.slice();
  }

  function rerollContracts(gameState) {
    availableContracts = [];
    refillContracts(gameState);
    return availableContracts.slice();
  }

  function setPriorityContracts(ids, gameState) {
    priorityContractIds = Array.isArray(ids)
      ? ids.filter((id, index) => typeof id === "string" && ids.indexOf(id) === index)
      : [];
    if (gameState) {
      ensureContracts(gameState);
    }
  }

  function startContract(id, gameState, modifiers) {
    if (activeContract.current) return { ok: false, error: "running" };
    const contract = CONTRACT_DEFS.find(def => def.id === id);
    if (!contract) return { ok: false, error: "notFound" };
    if (!meetsRequirements(contract, gameState)) return { ok: false, error: "requirements" };
    const preview = previewContract(contract, gameState, modifiers);
    activeContract.current = contract;
    activeContract.timer = preview.duration;
    activeContract.duration = preview.duration;
    activeContract.terms = preview.terms;
    activeContract.clauseState = createClauseState(contract.clause, gameState);
    removeFromAvailable(contract.id);
    refillContracts(gameState);
    return { ok: true, contract, preview };
  }

  function createClauseState(clauseDef, gameState) {
    if (!clauseDef) return null;
    const current = readClauseSource(clauseDef, gameState);
    return {
      clauseId: clauseDef.id,
      observed: current,
      failed: clauseDef.comparison === "minimum"
        ? current < clauseDef.target
        : current > clauseDef.target
    };
  }

  function readClauseSource(clauseDef, gameState) {
    const stats = gameState && gameState.stats ? gameState.stats : {};
    return clamp(Number(stats[clauseDef.source]) || 0, 0, 1);
  }

  function updateClauseState(contract, gameState) {
    if (!contract || !contract.clause || !activeContract.clauseState) return;
    const current = readClauseSource(contract.clause, gameState);
    if (contract.clause.comparison === "minimum") {
      activeContract.clauseState.observed = Math.min(activeContract.clauseState.observed, current);
      if (current < contract.clause.target) activeContract.clauseState.failed = true;
    } else {
      activeContract.clauseState.observed = Math.max(activeContract.clauseState.observed, current);
      if (current > contract.clause.target) activeContract.clauseState.failed = true;
    }
  }

  function clauseSucceeded(contract, state) {
    if (!contract || !contract.clause || !state || state.failed) return false;
    return contract.clause.comparison === "minimum"
      ? state.observed >= contract.clause.target
      : state.observed <= contract.clause.target;
  }

  function getClauseProgress(contract, gameState, stateOverride) {
    if (!contract || !contract.clause) return null;
    const isTracked = Boolean(stateOverride) || Boolean(
      activeContract.current && activeContract.current.id === contract.id
    );
    const state = stateOverride || (isTracked
      ? activeContract.clauseState
      : {
          clauseId: contract.clause.id,
          observed: readClauseSource(contract.clause, gameState),
          failed: false
        });
    const current = state ? state.observed : readClauseSource(contract.clause, gameState);
    const target = contract.clause.target;
    const ratio = contract.clause.comparison === "minimum"
      ? clamp(current / Math.max(0.0001, target), 0, 1)
      : clamp((1 - current) / Math.max(0.0001, 1 - target), 0, 1);
    return {
      id: contract.clause.id,
      comparison: contract.clause.comparison,
      current,
      target,
      ratio,
      failed: Boolean(isTracked && state && state.failed),
      met: clauseSucceeded(contract, state),
      nameKey: contract.clause.nameKey,
      descKey: contract.clause.descKey,
      reward: contract.clause.reward
    };
  }

  function tickContract(dt, gameState) {
    if (!activeContract.current) return null;
    updateClauseState(activeContract.current, gameState);
    activeContract.timer -= dt;
    if (activeContract.timer > 0) return null;

    const finished = activeContract.current;
    const terms = activeContract.terms || normaliseModifiers();
    const state = activeContract.clauseState ? { ...activeContract.clauseState } : null;
    const baseReward = scaledReward(finished.reward, terms.docRewardMultiplier, terms.ccRewardMultiplier);
    const succeeded = clauseSucceeded(finished, state);
    const clauseReward = succeeded
      ? scaledReward(
          finished.clause && finished.clause.reward,
          terms.docRewardMultiplier * terms.clauseRewardMultiplier,
          terms.ccRewardMultiplier * terms.clauseRewardMultiplier
        )
      : { doc: 0, cc: 0 };
    const totalReward = {
      doc: baseReward.doc + clauseReward.doc,
      cc: baseReward.cc + clauseReward.cc
    };
    applyRewards(totalReward, gameState);
    const result = {
      ...finished,
      baseReward,
      clauseReward,
      totalReward,
      clauseSucceeded: succeeded,
      clauseState: state,
      effectiveDuration: activeContract.duration
    };
    clearActiveContract();
    refillContracts(gameState);
    return result;
  }

  function ensureContracts(gameState) {
    const docTotal = gameState && gameState.resources ? gameState.resources.docTotal || 0 : 0;
    const eligiblePriorityIds = priorityContractIds.filter(id => {
      const contract = CONTRACT_DEFS.find(definition => definition.id === id);
      return contract && docTotal >= contract.minDocTotal &&
        (!activeContract.current || activeContract.current.id !== id);
    });
    const hasMissingPriority = eligiblePriorityIds.some(id => {
      return !availableContracts.some(contract => contract.id === id);
    });
    if (hasMissingPriority) {
      // A campaign target that becomes eligible later in the run must enter
      // the three visible offers without asking the player to reroll blindly.
      // Keep already visible priority jobs; refill prioritises every missing
      // one before choosing ordinary offers for the remaining slots.
      availableContracts = availableContracts.filter(contract => {
        return eligiblePriorityIds.includes(contract.id);
      });
    }
    if (availableContracts.length < MAX_VISIBLE_CONTRACTS) refillContracts(gameState);
  }

  function refillContracts(gameState) {
    const docTotal = gameState && gameState.resources ? gameState.resources.docTotal || 0 : 0;
    const eligible = CONTRACT_DEFS.filter(def => {
      if (docTotal < def.minDocTotal) return false;
      if (availableContracts.some(item => item.id === def.id)) return false;
      if (activeContract.current && activeContract.current.id === def.id) return false;
      return true;
    });
    const orderedPriority = priorityContractIds
      .map(id => eligible.find(contract => contract.id === id))
      .filter(Boolean);
    for (const contract of orderedPriority) {
      if (availableContracts.length >= MAX_VISIBLE_CONTRACTS) break;
      availableContracts.push(contract);
      eligible.splice(eligible.indexOf(contract), 1);
    }
    while (availableContracts.length < MAX_VISIBLE_CONTRACTS && eligible.length) {
      const index = Math.floor(Math.random() * eligible.length);
      availableContracts.push(eligible.splice(index, 1)[0]);
    }
    if (!availableContracts.length && CONTRACT_DEFS.length) availableContracts.push(CONTRACT_DEFS[0]);
  }

  function removeFromAvailable(id) {
    availableContracts = availableContracts.filter(contract => contract.id !== id);
  }

  function getRequirementsStatus(contract, gameState) {
    if (!contract) return [];
    const stats = gameState && gameState.stats ? gameState.stats : {};
    const resources = gameState && gameState.resources ? gameState.resources : {};
    const buildings = gameState && Array.isArray(gameState.buildings) ? gameState.buildings : [];
    const requirements = contract.requirements || {};
    const result = [
      { type: "quality", current: stats.quality || 0, required: requirements.quality || 0 },
      { type: "image", current: stats.brandImage || 0, required: requirements.image || 0 },
      { type: "volume", current: resources.docTotal || 0, required: requirements.volume || 0 }
    ].map(item => ({ ...item, met: item.current >= item.required }));
    const requiredBuildings = requirements.buildings && typeof requirements.buildings === "object"
      ? requirements.buildings
      : {};
    for (const [id, required] of Object.entries(requiredBuildings)) {
      const building = buildings.find(item => item && item.id === id);
      const current = building && Number.isFinite(building.quantity) ? building.quantity : 0;
      result.push({ type: "building", id, current, required, met: current >= required });
    }
    return result;
  }

  function meetsRequirements(contract, gameState) {
    return getRequirementsStatus(contract, gameState).every(requirement => requirement.met);
  }

  function applyRewards(reward, gameState) {
    if (!gameState || !gameState.resources) return;
    if (reward.doc) {
      gameState.resources.docBank += reward.doc;
      gameState.resources.docTotal += reward.doc;
    }
    if (reward.cc) gameState.resources.ccTotal += reward.cc;
  }

  return {
    definitions: CONTRACT_DEFS,
    loadData,
    availableContracts: getAvailableContracts,
    rerollContracts,
    setPriorityContracts,
    meetsRequirements,
    getRequirementsStatus,
    previewContract,
    getClauseProgress,
    startContract,
    tickContract,
    exportActiveContract,
    cancelActiveContract,
    resetForPrestige,
    activeContract,
    MAX_PREPRESS_DURATION_REDUCTION
  };
});
