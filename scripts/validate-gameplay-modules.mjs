#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadBrowserModule(relativePath, globalName) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const sandbox = { console, Date, Math, Promise, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: relativePath.replace("../", "") });
  assert.ok(sandbox[globalName], `${relativePath} must expose ${globalName}`);
  return sandbox[globalName];
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

// Embedded browsers may expose CommonJS markers while still loading ordinary
// deferred scripts. The app must receive the same API as module.exports.
const hybridModules = [
  ["modifier-utils.js", "ModifierUtils", "computeBuildingEffects"],
  ["godmode-utils.js", "GodModeUtils", "sanitizeTimeScale"],
  ["achievements.js", "Achievements", "evaluate"],
  ["endgame.js", "EndgameModule", "availableContracts"],
  ["progression.js", "ProgressionModule", "serializeCareer"],
  ["economy-analytics.js", "EconomyAnalytics", "buildInvestmentRows"]
];
for (const [file, globalName, method] of hybridModules) {
  const source = readFileSync(new URL("../assets/js/" + file, import.meta.url), "utf8");
  for (const [browser, requireMarker] of [[true, false], [true, true], [false, false]]) {
    const sandbox = { console, Date, Math, Promise, setTimeout, clearTimeout, module: { exports: {} } };
    if (browser) { sandbox.window = sandbox; sandbox.self = sandbox; }
    if (requireMarker) {
      sandbox.require = () => { throw new Error("Browser loading must not execute a CLI self-test"); };
      sandbox.require.main = sandbox.module;
    }
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: file });
    assert.equal(typeof sandbox.module.exports[method], "function", `${file} must retain its CommonJS API`);
    if (browser) {
      assert.strictEqual(sandbox[globalName], sandbox.module.exports,
        `${file} must expose the same API to the browser and CommonJS`);
      assert.equal(vm.runInContext(`typeof ${globalName}.${method}`, sandbox), "function",
        `${file} must support the app's ordinary global binding`);
    } else {
      assert.equal(sandbox[globalName], undefined, `${file} must not pollute a pure CommonJS global`);
    }
  }
}

const ModifierUtils = loadBrowserModule("../assets/js/modifier-utils.js", "ModifierUtils");
assert.equal(ModifierUtils.getMilestoneMultiplier(9), 1);
assert.equal(ModifierUtils.getMilestoneMultiplier(10), 1.1);
assert.equal(ModifierUtils.getEffectiveQuantity(10), 11);
assert.equal(ModifierUtils.getMilestoneMultiplier(25), 1.25);
assert.equal(ModifierUtils.getEffectiveQuantity(25), 31.25);
assert.deepEqual(copy(ModifierUtils.getNextMilestone(10)), { quantity: 25, multiplier: 1.25 });

const milestoneEffects = ModifierUtils.computeBuildingEffects([
  { quantity: 10, baseProduction: 0, docMultiplierPerUnit: 0.04, qualityBonusPerUnit: 0.01 }
]);
assert.ok(Math.abs(milestoneEffects.docMult - 1.44) < 1e-12);
assert.ok(Math.abs(milestoneEffects.qualityBonus - 0.11) < 1e-12);

const EconomyAnalytics = loadBrowserModule("../assets/js/economy-analytics.js", "EconomyAnalytics");
assert.equal(EconomyAnalytics.computePotentialCultureGain(10_000, 1_000), 3);
assert.equal(EconomyAnalytics.computePotentialCultureGain(1_000_000, 1_000), 9);
assert.equal(EconomyAnalytics.computePotentialCultureGain(-1, 1_000), 0);
assert.ok(Math.abs(EconomyAnalytics.computePrestigeMultiplier(25) - 2) < 1e-12);
assert.deepEqual(copy(EconomyAnalytics.computeCultureGaugeBonuses(10_000)), {
  quality: 0.2,
  brandImage: 0.25
});
function economyState(quantity = 10) {
  return {
    buildings: [{
      id: "reproOperator",
      nameKey: "building.reproOperator.name",
      role: "producer",
      quantity,
      isUnlocked: true,
      baseProduction: 0.5,
      baseCost: 15,
      costMultiplier: 1.15,
      qualityBonusPerUnit: 0.01,
      footprintBonusPerUnit: -0.005,
      imageBonusPerUnit: 0.02
    }],
    upgrades: [],
    resources: { docBank: 0, docTotal: 0, ccTotal: 0, culturePoints: 0 },
    stats: { quality: 0.5, footprint: 0.5, brandImage: 0.5 },
    config: { footprintDriftBase: 0.00001, prestigeCcDivisor: 1000, prestigeRequirement: 10000 },
    careerModifiers: {
      docMultiplier: 2,
      ccMultiplier: 1,
      footprintDriftMultiplier: 1.5,
      buildingCostMultiplier: 1.1
    }
  };
}

const automatic = EconomyAnalytics.computeAutomaticEconomics(economyState());
assert.equal(automatic.status, "exact");
assert.ok(Math.abs(automatic.docPerSecond - 11) < 1e-12,
  "analytics must include both the x10 milestone and the career modifier");
const currentCost = EconomyAnalytics.computeNextCost(economyState(), "reproOperator");
assert.equal(currentCost.value, Math.floor(15 * Math.pow(1.15, 10) * 1.1));
const thresholdSimulation = EconomyAnalytics.simulateNextBuilding(economyState(9), "reproOperator");
assert.equal(thresholdSimulation.status, "exact");
assert.ok(thresholdSimulation.deltaAutomaticDocPerSecond > 1,
  "the 9 -> 10 simulation must include the milestone jump for all owned units");
assert.ok(Math.abs(thresholdSimulation.gaugeRateDeltaPerSecond.quality - 0.01 * 2 * 0.024) < 1e-12,
  "the 9 -> 10 gauge forecast must include the milestone jump for all owned units");
assert.ok(Math.abs(thresholdSimulation.gaugeRateDeltaPerSecond.brandImage - 0.02 * 2 * 0.024) < 1e-12);
assert.ok(Math.abs(
  thresholdSimulation.gaugeRateDeltaPerSecond.footprint -
  (-0.005 * 2 * 0.024 + 0.00001 * 1.5 * thresholdSimulation.deltaAutomaticDocPerSecond)
) < 1e-12);

function contractState() {
  return {
    resources: { docBank: 0, docTotal: 100000, ccTotal: 0 },
    stats: { quality: 0.92, footprint: 0.35, brandImage: 0.9 },
    buildings: [{
      id: "prepressStudio",
      quantity: 5,
      contractDurationReductionPerUnit: 0.06
    }]
  };
}

let Endgame = loadBrowserModule("../assets/js/endgame.js", "EndgameModule");
assert.equal(Endgame.definitions.length, 9);
assert.equal(Endgame.definitions.some(contract => contract.id === "finalFinalProof"), true);
let state = contractState();
await Endgame.loadData(state, null);
state.resources.docTotal = 0;
Endgame.setPriorityContracts(["annualReports"], state);
assert.equal(Endgame.availableContracts(state).some(contract => contract.id === "annualReports"), false);
state.resources.docTotal = 500000;
assert.equal(Endgame.availableContracts(state).some(contract => contract.id === "annualReports"), true,
  "a campaign contract must enter the visible offers as soon as it becomes eligible");
Endgame.setPriorityContracts([], state);
state.stats.quality = 0.5;
const optionalPreview = Endgame.getClauseProgress(
  Endgame.definitions.find(contract => contract.id === "expressFlyer"),
  state
);
assert.equal(optionalPreview.met, false);
assert.equal(optionalPreview.failed, false,
  "an offer must show an unmet optional target without claiming it has already failed");
state.stats.quality = 0.92;
const proofPreview = Endgame.previewContract("finalFinalProof", state, {
  contractDocRewardMultiplier: 1.2,
  contractCcRewardMultiplier: 1.2
});
assert.equal(proofPreview.durationReduction, 0.3);
assert.equal(proofPreview.duration, Math.round(165 * 0.7));
assert.equal(Endgame.startContract("finalFinalProof", state, {
  contractDocRewardMultiplier: 1.2,
  contractCcRewardMultiplier: 1.2
}).ok, true);
const successfulProof = Endgame.tickContract(proofPreview.duration + 1, state);
assert.equal(successfulProof.clauseSucceeded, true);
assert.equal(successfulProof.totalReward.doc,
  successfulProof.baseReward.doc + successfulProof.clauseReward.doc);

// The base dispatch is always paid, even when the optional clause is lost.
Endgame.resetForPrestige(state);
state.resources.docTotal = 100000;
state.stats.quality = 0.7;
state.stats.brandImage = 0.9;
assert.equal(Endgame.startContract("expressFlyer", state).ok, true);
state.stats.quality = 0.1;
const failedClause = Endgame.tickContract(60, state);
assert.equal(failedClause.clauseSucceeded, false);
assert.deepEqual(copy(failedClause.clauseReward), { doc: 0, cc: 0 });
assert.deepEqual(copy(failedClause.totalReward), copy(failedClause.baseReward));

// Frozen terms must survive a reload instead of reverting to x1 rewards.
Endgame.resetForPrestige(state);
state.resources.docTotal = 100000;
state.stats.quality = 0.8;
assert.equal(Endgame.startContract("expressFlyer", state, {
  contractDocRewardMultiplier: 1.5,
  contractCcRewardMultiplier: 1.6
}).ok, true);
const savedContract = Endgame.exportActiveContract();
Endgame = loadBrowserModule("../assets/js/endgame.js", "EndgameModule");
await Endgame.loadData(state, savedContract);
const restored = Endgame.tickContract(savedContract.timer + 1, state);
assert.equal(restored.baseReward.doc, 900);
assert.equal(restored.baseReward.cc, 192);

const Achievements = loadBrowserModule("../assets/js/achievements.js", "Achievements");
assert.equal(Achievements.definitions.length, 16);
for (const definition of Achievements.definitions) {
  assert.ok(definition.target > 0, `${definition.id} must expose a positive target`);
  assert.ok(definition.reward && Object.keys(definition.reward).length > 0,
    `${definition.id} must expose a visible one-time reward`);
}
const firstDoc = Achievements.definitions.find(definition => definition.id === "firstDoc");
const firstPrestige = Achievements.definitions.find(definition => definition.id === "firstPrestige");
const fullCampus = Achievements.definitions.find(definition => definition.id === "fullCampus");
const achievementState = {
  resources: { docTotal: 1, culturePoints: 0 },
  buildings: [],
  upgrades: [],
  stats: { quality: 0.5, brandImage: 0.5 },
  analytics: { lifetimeObserved: { prestiges: 0 } }
};
assert.deepEqual(copy(Achievements.getProgress(firstDoc, achievementState)), {
  current: 1,
  target: 1,
  ratio: 1
});
achievementState.resources.culturePoints = 5;
assert.equal(Achievements.getProgress(firstPrestige, achievementState).current, 0,
  "Culture earned from challenges must not impersonate a prestige");
achievementState.analytics.lifetimeObserved.prestiges = 1;
assert.equal(Achievements.getProgress(firstPrestige, achievementState).current, 1);
const cascadingUnlocks = [];
const cascadingUnlockedMap = {};
achievementState.resources.culturePoints = 9;
while (cascadingUnlocks.length < Achievements.definitions.length) {
  const unlockWave = Achievements.evaluate(achievementState, cascadingUnlockedMap);
  if (!unlockWave.length) break;
  for (const id of unlockWave) {
    cascadingUnlockedMap[id] = true;
    cascadingUnlocks.push(id);
    const definition = Achievements.definitions.find(candidate => candidate.id === id);
    if (definition && definition.reward && definition.reward.culture) {
      achievementState.resources.culturePoints += definition.reward.culture;
    }
  }
}
assert.equal(cascadingUnlocks.includes("firstPrestige"), true);
assert.equal(cascadingUnlocks.includes("cultureCollector"), true,
  "a first-prestige Culture reward must unlock cultureCollector in the same batch");
achievementState.stats.quality = 0.895;
assert.equal(Achievements.evaluate(achievementState, {}).includes("qualityFreak"), false,
  "an 89.5% gauge must not be rounded into the 90% achievement");
achievementState.stats.quality = 0.9;
assert.equal(Achievements.evaluate(achievementState, {}).includes("qualityFreak"), true);
achievementState.buildings = Array.from({ length: 11 }, (_, index) => ({ id: "building" + index, quantity: 1 }));
assert.deepEqual(copy(Achievements.getProgress(fullCampus, achievementState)), {
  current: 11,
  target: 12,
  ratio: 11 / 12
});

console.log("Gameplay module integration: ok");
