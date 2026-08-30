#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/progression.js", import.meta.url), "utf8");
const sandbox = {};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "assets/js/progression.js" });

const Progression = sandbox.ProgressionModule;
assert.ok(Progression, "progression.js must expose window.ProgressionModule");

const NOW = 1_800_000_000_000;

function blankContext() {
  return {
    resources: { docBank: 0, docTotal: 0, ccTotal: 0, culturePoints: 0 },
    stats: { quality: 0.5, footprint: 0.5, brandImage: 0.5 },
    metrics: { docPerSecond: 0 },
    buildings: [
      "reproOperator",
      "digitalPress",
      "offsetPress",
      "prepressStudio",
      "insertingLine",
      "clientPortal",
      "comBridge"
    ].map(id => ({ id, quantity: 0 }))
  };
}

function setBuilding(context, id, quantity) {
  let building = context.buildings.find(item => item.id === id);
  if (!building) {
    building = { id, quantity: 0 };
    context.buildings.push(building);
  }
  building.quantity = quantity;
  return context;
}

function createCareer(options = {}) {
  return Progression.createDefaultCareer({ now: NOW, ...options });
}

function copyAcrossRealm(value) {
  return JSON.parse(JSON.stringify(value));
}

// Catalogue: three plans, three ranks and three sequential objectives each.
assert.equal(Progression.API_VERSION, 1);
assert.equal(Progression.CAREER_SCHEMA_VERSION, 1);
assert.deepEqual(copyAcrossRealm(Progression.PLAN_IDS), ["cadence", "quality", "clientRelations"]);
assert.equal(Progression.PLAN_DEFINITIONS.length, 3);
for (const plan of Progression.PLAN_DEFINITIONS) {
  assert.equal(plan.ranks.length, 3, `${plan.id} must expose three ranks`);
  for (const rank of plan.ranks) {
    assert.equal(rank.objectives.length, 3, `${plan.id} rank ${rank.rank} must expose three objectives`);
  }
}
assert.equal(
  new Set(Progression.PLAN_DEFINITIONS.flatMap(plan => plan.ranks.flatMap(rank => rank.objectives.map(item => item.id)))).size,
  27,
  "all plan objective ids must be unique"
);
assert.deepEqual(copyAcrossRealm(Progression.CHALLENGE_IDS), ["budgetFrozen", "zeroReturns", "everyoneCopied"]);
assert.deepEqual(copyAcrossRealm(Progression.CAMPAIGN_IDS), ["onboarding842", "annualReportSeason", "confidentialMerger"]);
assert.deepEqual(
  copyAcrossRealm(Progression.getRankDefinition("cadence", 3).objectives.map(item => item.target)),
  [25, 20_000, 1_000_000]
);
assert.equal(Progression.getRankDefinition("quality", 3).objectives[0].target, 25);
assert.deepEqual(
  copyAcrossRealm(Progression.getRankDefinition("clientRelations", 3).objectives.map(item => item.target)),
  [25, 4, 10_000_000]
);

// Default and defensive migration.
{
  const career = createCareer();
  assert.equal(career.schemaVersion, 1);
  assert.equal(career.started, false);
  assert.deepEqual(copyAcrossRealm(career.completedRanks), { cadence: 0, quality: 0, clientRelations: 0 });
  assert.equal(career.activePlan, null);
  assert.equal(career.cycle.startedAt, NOW);
  assert.equal(Progression.totalStamps(career), 0);
  assert.equal(Progression.getConclusion(career).unlocked, false);

  const migrated = Progression.hydrateCareer({
    schemaVersion: 99,
    started: false,
    completedRanks: { cadence: 99, quality: -3, clientRelations: 2, injected: 3 },
    activePlan: { id: "quality", rank: 3, stepIndex: 99 },
    cycle: {
      id: -2,
      startedAt: "yesterday",
      contractsCompleted: -8,
      clausesCompleted: 2,
      contractIds: ["annualReports", "annualReports", "<script>"],
      contractCountsById: { annualReports: 2, bad: -1, "<script>": 20 },
      milestoneIds: ["milestone:press:10", "milestone:press:10"]
    },
    challenges: {
      completedIds: ["zeroReturns", "unknown"],
      active: { id: "zeroReturns", stepIndex: 90 }
    },
    campaigns: {
      completedIds: ["onboarding842", "unknown"],
      active: { id: "confidentialMerger", stepIndex: 3 }
    },
    conclusion: { unlockedAt: NOW - 100, acknowledgedAt: NOW - 50 }
  }, { now: NOW, culturePoints: 7 });

  assert.equal(migrated.started, true, "legacy Culture must mark the career as started");
  assert.deepEqual(copyAcrossRealm(migrated.completedRanks), { cadence: 3, quality: 0, clientRelations: 2 });
  assert.equal(migrated.activePlan, null, "an impossible saved rank must be discarded");
  assert.equal(migrated.cycle.id, 0);
  assert.equal(migrated.cycle.contractsCompleted, 0);
  assert.equal(migrated.cycle.clausesCompleted, 2);
  assert.deepEqual(copyAcrossRealm(migrated.cycle.contractIds), ["annualReports"]);
  assert.deepEqual(copyAcrossRealm(migrated.cycle.contractCountsById), { annualReports: 2 });
  assert.deepEqual(copyAcrossRealm(migrated.challenges.completedIds), ["zeroReturns"]);
  assert.equal(migrated.challenges.active, null, "a completed challenge cannot remain active");
  assert.deepEqual(copyAcrossRealm(migrated.campaigns.completedIds), ["onboarding842"]);
  assert.equal(migrated.campaigns.active, null, "a campaign below its stamp gate must be discarded");
  assert.equal(migrated.conclusion.unlockedAt, null, "a forged conclusion must be removed");
  assert.equal(Object.prototype.hasOwnProperty.call(migrated.completedRanks, "injected"), false);

  const topLevel = Progression.hydrateCareer({ career: migrated }, { now: NOW });
  assert.deepEqual(copyAcrossRealm(topLevel.completedRanks), copyAcrossRealm(migrated.completedRanks));
  const serialized = Progression.serializeCareer(topLevel);
  assert.notEqual(serialized, topLevel);
  assert.deepEqual(copyAcrossRealm(serialized), copyAcrossRealm(topLevel));

  const incompatible = Progression.hydrateCareer({
    completedRanks: { cadence: 0, quality: 0, clientRelations: 0 },
    activePlan: { id: "cadence", rank: 1, stepIndex: 0 },
    challenges: {
      active: { id: "zeroReturns", stepIndex: 0, counters: { qualifiedContracts: 2 } }
    },
    campaigns: {
      completedIds: ["onboarding842", "annualReportSeason", "confidentialMerger"]
    }
  }, { now: NOW });
  assert.equal(incompatible.activePlan.id, "cadence");
  assert.equal(incompatible.challenges.active, null,
    "a challenge from another Plan must not survive defensive hydration");
  assert.deepEqual(copyAcrossRealm(incompatible.campaigns.completedIds), [],
    "campaign badges must not survive below their stamp gate");
}

// Sequential plan objectives capture a fresh action baseline at every step.
{
  const career = createCareer({ started: true });
  const context = blankContext();
  Progression.recordContract(career, { id: "expressFlyer", clauseSucceeded: true, clauseId: "quality" });
  assert.equal(Progression.selectPlan(career, "quality", { now: NOW + 1 }).ok, true);
  setBuilding(context, "prepressStudio", 1);
  context.stats.quality = 0.8;

  const first = Progression.updateProgress(career, context, { now: NOW + 2 });
  assert.deepEqual(
    copyAcrossRealm(first.planObjectivesCompleted.map(item => item.id)),
    ["quality.1.prepress", "quality.1.gauge"]
  );
  assert.equal(career.activePlan.stepIndex, 2);
  assert.equal(Progression.getPlanStatus(career, context).objective.current, 0,
    "a clause completed before its step must not count retroactively");

  Progression.recordContract(career, { id: "finalFinalProof", clauseSucceeded: true, clauseId: "finalFinalProof:quality" });
  const second = Progression.updateProgress(career, context, { now: NOW + 3 });
  assert.deepEqual(copyAcrossRealm(second.planObjectivesCompleted.map(item => item.id)), ["quality.1.clause"]);
  assert.equal(second.planReady, true);
  assert.equal(Progression.isPlanReady(career, context), true);
  assert.equal(career.completedRanks.quality, 0, "finishing objectives alone must not mint a stamp");
}

// Active and permanent modifiers are derived, never copied into the save.
{
  const cadence = createCareer({ started: true });
  Progression.selectPlan(cadence, "cadence", { now: NOW });
  let modifiers = Progression.getModifiers(cadence);
  assert.equal(modifiers.docMultiplier, 1.1);
  assert.equal(modifiers.footprintDriftMultiplier, 1.2);
  assert.equal(modifiers.ccMultiplier, 1);

  cadence.completedRanks.cadence = 2;
  cadence.completedRanks.quality = 3;
  cadence.completedRanks.clientRelations = 1;
  // Hydration would reject this deliberately inconsistent active rank; the
  // pure modifier function nevertheless remains deterministic for live state.
  modifiers = Progression.getModifiers(cadence);
  assert.ok(Math.abs(modifiers.docMultiplier - 1.04 * 1.1) < 1e-12);
  assert.ok(Math.abs(modifiers.ccMultiplier - 1.02) < 1e-12);
  assert.ok(Math.abs(modifiers.qualityTargetOffset - 0.03) < 1e-12);

  const relation = createCareer({ started: true });
  Progression.selectPlan(relation, "clientRelations", { now: NOW });
  modifiers = Progression.getModifiers(relation);
  assert.equal(modifiers.ccMultiplier, 1.1);
  assert.equal(modifiers.buildingCostMultiplier, 1.05);
  assert.equal(modifiers.contractRewardMultiplier, 1.1);

  const quality = createCareer({ started: true });
  Progression.selectPlan(quality, "quality", { now: NOW });
  modifiers = Progression.getModifiers(quality);
  assert.equal(modifiers.docMultiplier, 0.95);
  assert.equal(modifiers.qualityTargetOffset, 0.04);
}

// Each Plan rank must be completed in order; rank 4 can never be selected.
{
  const career = createCareer({ started: true });
  const cadenceTargets = [
    { buildingId: "reproOperator", quantity: 10, rate: 25, cc: 15000 },
    { buildingId: "digitalPress", quantity: 10, rate: 500, cc: 75000 },
    { buildingId: "offsetPress", quantity: 25, rate: 20000, cc: 1000000 }
  ];

  for (let rank = 1; rank <= 3; rank += 1) {
    const selected = Progression.selectPlan(career, "cadence", { now: NOW + rank * 10 });
    assert.equal(selected.ok, true);
    assert.equal(selected.rank, rank);
    const context = blankContext();
    const target = cadenceTargets[rank - 1];
    setBuilding(context, target.buildingId, target.quantity);
    context.metrics.docPerSecond = target.rate;
    context.resources.ccTotal = target.cc;
    assert.equal(Progression.updateProgress(career, context, { now: NOW + rank * 10 + 1 }).planReady, true);
    assert.equal(Progression.handlePrestige(career, context, { now: NOW + rank * 10 + 2 }).planCompleted.rank, rank);
  }

  assert.equal(career.completedRanks.cadence, 3);
  assert.equal(Progression.getAvailablePlans(career).some(item => item.plan.id === "cadence"), false);
  assert.equal(Progression.selectPlan(career, "cadence", { now: NOW + 40 }).error, "plan-unavailable");
}

// A ready Plan is stamped only by prestige; an early prestige merely restarts it.
{
  const earlyCareer = createCareer({ started: true });
  const earlyContext = blankContext();
  Progression.selectPlan(earlyCareer, "quality", { now: NOW });
  setBuilding(earlyContext, "prepressStudio", 1);
  Progression.updateProgress(earlyCareer, earlyContext, { now: NOW + 1 });
  const assessment = Progression.assessPrestige(earlyCareer, earlyContext);
  assert.equal(assessment.allowedByCareer, true);
  assert.equal(assessment.willRestartPlan, true);
  const early = Progression.handlePrestige(earlyCareer, earlyContext, { now: NOW + 2 });
  assert.equal(early.planCompleted, null);
  assert.equal(early.earlyPlanRestart, true);
  assert.equal(earlyCareer.completedRanks.quality, 0);
  assert.equal(earlyCareer.activePlan.id, "quality");
  assert.equal(earlyCareer.activePlan.stepIndex, 0);
  assert.equal(earlyCareer.activePlan.attempt, 2);
  assert.equal(earlyCareer.cycle.id, 1);

  const readyCareer = createCareer({ started: true });
  const readyContext = blankContext();
  Progression.selectPlan(readyCareer, "cadence", { now: NOW });
  setBuilding(readyContext, "reproOperator", 10);
  readyContext.metrics.docPerSecond = 25;
  readyContext.resources.ccTotal = 15000;
  const progress = Progression.updateProgress(readyCareer, readyContext, { now: NOW + 1 });
  assert.equal(progress.planReady, true);
  assert.equal(readyCareer.completedRanks.cadence, 0);
  const completed = Progression.handlePrestige(readyCareer, readyContext, { now: NOW + 2 });
  assert.deepEqual(copyAcrossRealm(completed.planCompleted), {
    id: "cadence",
    rank: 1,
    stampId: "stamp:cadence:1",
    reward: { culture: 1 }
  });
  assert.equal(readyCareer.completedRanks.cadence, 1);
  assert.deepEqual(copyAcrossRealm(Progression.getStampIds(readyCareer)), ["stamp:cadence:1"]);
  assert.equal(readyCareer.activePlan, null);
  assert.equal(Progression.getModifiers(readyCareer).docMultiplier, 1.02);
}

// Contextual challenges: decline, failure, retry next cycle and one-time rewards.
{
  const budget = createCareer({ started: true });
  Progression.selectPlan(budget, "cadence", { now: NOW });
  assert.deepEqual(copyAcrossRealm(Progression.getAvailableChallenges(budget).map(item => item.id)), ["budgetFrozen"]);
  assert.equal(Progression.acceptChallenge(budget, "budgetFrozen", { now: NOW + 1 }).ok, true);
  const broken = Progression.recordUpgradePurchased(budget, { now: NOW + 2 });
  assert.equal(broken.challengeFailure.id, "budgetFrozen");
  assert.equal(broken.challengeFailure.reason, "budget-broken");
  assert.equal(budget.challenges.active, null);
  assert.deepEqual(copyAcrossRealm(budget.challenges.failedThisCycleIds), ["budgetFrozen"]);
  assert.equal(Progression.getAvailableChallenges(budget).length, 0);
  Progression.handlePrestige(budget, blankContext(), { now: NOW + 3 });
  assert.deepEqual(copyAcrossRealm(Progression.getAvailableChallenges(budget).map(item => item.id)), ["budgetFrozen"],
    "a failed challenge may be retried in a later cycle");

  const budgetSuccess = createCareer({ started: true });
  const budgetContext = blankContext();
  setBuilding(budgetContext, "offsetPress", 1);
  Progression.selectPlan(budgetSuccess, "cadence", { now: NOW });
  Progression.acceptChallenge(budgetSuccess, "budgetFrozen", { now: NOW + 1 });
  assert.equal(
    Progression.updateProgress(budgetSuccess, budgetContext, { now: NOW + 2 }).challengeCompleted,
    null,
    "an offset press owned before accepting the challenge must not grant its reward"
  );
  Progression.recordBuildingMilestones(budgetSuccess, "offsetPress", 1, 2);
  setBuilding(budgetContext, "offsetPress", 2);
  assert.deepEqual(copyAcrossRealm(
    Progression.updateProgress(budgetSuccess, budgetContext, { now: NOW + 3 }).challengeCompleted
  ), { id: "budgetFrozen", reward: { culture: 2 } });

  const declined = createCareer({ started: true });
  Progression.selectPlan(declined, "clientRelations", { now: NOW });
  assert.equal(Progression.declineChallenge(declined, "everyoneCopied", { now: NOW + 1 }).ok, true);
  assert.equal(Progression.getAvailableChallenges(declined).length, 0);
  assert.equal(declined.challenges.attempts.at(-1).outcome, "declined");
  Progression.handlePrestige(declined, blankContext(), { now: NOW + 2 });
  assert.deepEqual(copyAcrossRealm(Progression.getAvailableChallenges(declined).map(item => item.id)), ["everyoneCopied"]);

  const quality = createCareer({ started: true });
  Progression.selectPlan(quality, "quality", { now: NOW });
  Progression.acceptChallenge(quality, "zeroReturns", { now: NOW + 1 });
  for (const id of ["expressFlyer", "onboardingKit", "crossMedia"]) {
    Progression.recordContract(quality, { id, quality: 0.8 }, { now: NOW + 2 });
  }
  const reward = Progression.updateProgress(quality, blankContext(), { now: NOW + 3 });
  assert.deepEqual(copyAcrossRealm(reward.challengeCompleted), { id: "zeroReturns", reward: { culture: 3 } });
  assert.deepEqual(copyAcrossRealm(quality.challenges.completedIds), ["zeroReturns"]);
  assert.equal(Progression.updateProgress(quality, blankContext(), { now: NOW + 4 }).challengeCompleted, null,
    "a challenge Culture reward must be emitted exactly once");

  const returned = createCareer({ started: true });
  Progression.selectPlan(returned, "quality", { now: NOW });
  Progression.acceptChallenge(returned, "zeroReturns", { now: NOW + 1 });
  const failed = Progression.recordContract(returned, { id: "expressFlyer", quality: 0.79 }, { now: NOW + 2 });
  assert.equal(failed.challengeFailure.reason, "quality-return");

  const copied = createCareer({ started: true });
  Progression.selectPlan(copied, "clientRelations", { now: NOW });
  Progression.acceptChallenge(copied, "everyoneCopied", { now: NOW + 1 });
  for (const id of ["expressFlyer", "expressFlyer", "onboardingKit", "crossMedia"]) {
    Progression.recordContract(copied, { id, brandImage: 0.8 }, { now: NOW + 2 });
  }
  const copiedReward = Progression.updateProgress(copied, blankContext(), { now: NOW + 3 });
  assert.deepEqual(copyAcrossRealm(copiedReward.challengeCompleted), {
    id: "everyoneCopied",
    reward: { culture: 4 }
  });

  const prestigeFailure = createCareer({ started: true });
  Progression.selectPlan(prestigeFailure, "cadence", { now: NOW });
  Progression.acceptChallenge(prestigeFailure, "budgetFrozen", { now: NOW + 1 });
  const prestige = Progression.handlePrestige(prestigeFailure, blankContext(), { now: NOW + 2 });
  assert.equal(prestige.challengeFailed.reason, "prestige");
}

// Contract/clause counters retain exact IDs and counts for plan/campaign baselines.
{
  const career = createCareer({ started: true });
  Progression.recordContract(career, {
    id: "annualReports",
    clauseSucceeded: true,
    clauseId: "annualReports:quality",
    quality: 0.9,
    brandImage: 0.9
  });
  Progression.recordContract(career, { id: "annualReports", clauseSucceeded: false });
  assert.equal(career.cycle.contractsCompleted, 2);
  assert.equal(career.cycle.clausesCompleted, 1);
  assert.deepEqual(copyAcrossRealm(career.cycle.contractIds), ["annualReports"]);
  assert.equal(career.cycle.contractCountsById.annualReports, 2);
  assert.equal(career.cycle.clauseCountsById["annualReports:quality"], 1);

  const bounded = createCareer({ started: true });
  for (let index = 0; index < 130; index += 1) {
    Progression.recordContract(bounded, { id: "contract" + index });
  }
  assert.equal(bounded.cycle.contractsCompleted, 130);
  assert.equal(Object.keys(bounded.cycle.contractCountsById).length, 128,
    "untrusted dynamic IDs must not grow the save forever");
}

// Campaign gates, shared sequential evaluator, badges and final title.
{
  const gated = createCareer({ started: true });
  gated.completedRanks.cadence = 2;
  assert.equal(Progression.getAvailableCampaigns(gated).length, 0);
  gated.completedRanks.cadence = 3;
  assert.deepEqual(copyAcrossRealm(Progression.getAvailableCampaigns(gated).map(item => item.id)), ["onboarding842"]);
  gated.completedRanks.quality = 3;
  assert.deepEqual(copyAcrossRealm(Progression.getAvailableCampaigns(gated).map(item => item.id)), [
    "onboarding842",
    "annualReportSeason"
  ]);

  const campaignCareer = createCareer({ started: true });
  campaignCareer.completedRanks.cadence = 3;
  const campaignContext = blankContext();
  assert.equal(Progression.startCampaign(campaignCareer, "onboarding842", { now: NOW }).ok, true);
  setBuilding(campaignContext, "insertingLine", 5);
  Progression.updateProgress(campaignCareer, campaignContext, { now: NOW + 1 });
  Progression.recordContract(campaignCareer, { id: "onboardingKit", clauseSucceeded: true, clauseId: "onboarding:urgent" });
  const contractStep = Progression.updateProgress(campaignCareer, campaignContext, { now: NOW + 2 });
  assert.deepEqual(copyAcrossRealm(contractStep.campaignObjectivesCompleted.map(item => item.id)), [
    "campaign.onboarding842.contract"
  ]);
  assert.equal(Progression.getCampaignStatus(campaignCareer, campaignContext).objective.current, 0,
    "the clause on the contract step must not also satisfy the next sequential step");
  Progression.recordContract(campaignCareer, { id: "expressFlyer", clauseSucceeded: true, clauseId: "express:quality" });
  const campaignDone = Progression.updateProgress(campaignCareer, campaignContext, { now: NOW + 3 });
  assert.deepEqual(copyAcrossRealm(campaignDone.campaignCompleted), {
    id: "onboarding842",
    badgeId: "badgeOnboarding842"
  });
  assert.deepEqual(copyAcrossRealm(Progression.getCampaignBadges(campaignCareer)), ["badgeOnboarding842"]);

  const annualCareer = createCareer({ started: true });
  annualCareer.completedRanks.cadence = 3;
  annualCareer.completedRanks.quality = 3;
  const annualContext = blankContext();
  assert.equal(Progression.startCampaign(annualCareer, "annualReportSeason", { now: NOW }).ok, true);
  setBuilding(annualContext, "prepressStudio", 1);
  annualContext.stats.quality = 0.85;
  Progression.updateProgress(annualCareer, annualContext, { now: NOW + 1 });
  Progression.recordContract(annualCareer, { id: "annualReports" });
  assert.deepEqual(copyAcrossRealm(
    Progression.updateProgress(annualCareer, annualContext, { now: NOW + 2 }).campaignCompleted
  ), { id: "annualReportSeason", badgeId: "badgeAnnualReportSeason" });

  const resetCampaign = createCareer({ started: true });
  resetCampaign.completedRanks.cadence = 3;
  Progression.startCampaign(resetCampaign, "onboarding842", { now: NOW });
  setBuilding(campaignContext, "insertingLine", 5);
  Progression.updateProgress(resetCampaign, campaignContext, { now: NOW + 1 });
  assert.equal(resetCampaign.campaigns.active.stepIndex, 1);
  const resetResult = Progression.handlePrestige(resetCampaign, blankContext(), { now: NOW + 2 });
  assert.equal(resetResult.campaignRestarted, "onboarding842");
  assert.equal(resetCampaign.campaigns.active.stepIndex, 0);

  const finale = createCareer({ started: true });
  finale.completedRanks.cadence = 3;
  finale.completedRanks.quality = 3;
  finale.completedRanks.clientRelations = 3;
  finale.campaigns.completedIds = ["onboarding842", "annualReportSeason"];
  assert.equal(Progression.totalStamps(finale), 9);
  assert.equal(Progression.getConclusion(finale).unlocked, false,
    "nine Plan stamps alone must not skip the campaigns");
  assert.deepEqual(copyAcrossRealm(Progression.getAvailableCampaigns(finale).map(item => item.id)), ["confidentialMerger"]);
  Progression.startCampaign(finale, "confidentialMerger", { now: NOW });
  const finalContext = blankContext();
  setBuilding(finalContext, "clientPortal", 10);
  finalContext.stats.brandImage = 0.9;
  Progression.updateProgress(finale, finalContext, { now: NOW + 1 });
  for (const id of ["governancePack", "annualReports", "nationalCensus"]) {
    Progression.recordContract(finale, { id });
  }
  const finalProgress = Progression.updateProgress(finale, finalContext, { now: NOW + 2 });
  assert.deepEqual(copyAcrossRealm(finalProgress.campaignCompleted), {
    id: "confidentialMerger",
    badgeId: "badgeConfidentialMerger"
  });
  assert.equal(finalProgress.conclusionUnlocked, true);
  assert.equal(Progression.getConclusion(finale).unlocked, true);
  assert.equal(Progression.getConclusion(finale).id, "viceDirectorAssistantPaperOperations");
  assert.equal(Progression.acknowledgeConclusion(finale, { now: NOW + 3 }), true);
  assert.equal(Progression.getConclusion(finale).acknowledgedAt, NOW + 3);
}

// Unit milestones are derived at 10/25, and event IDs are idempotent per cycle.
{
  assert.equal(Progression.getMilestoneMultiplier(0), 1);
  assert.equal(Progression.getMilestoneMultiplier(9), 1);
  assert.equal(Progression.getMilestoneMultiplier(10), 1.1);
  assert.equal(Progression.getMilestoneMultiplier(24), 1.1);
  assert.equal(Progression.getMilestoneMultiplier(25), 1.25);
  assert.deepEqual(copyAcrossRealm(Progression.getNextMilestone(9)), { quantity: 10, multiplier: 1.1 });
  assert.deepEqual(copyAcrossRealm(Progression.getNextMilestone(10)), { quantity: 25, multiplier: 1.25 });
  assert.equal(Progression.getNextMilestone(25), null);

  const first = Progression.computeMilestoneEvents("digitalPress", 9, 10, []);
  assert.deepEqual(copyAcrossRealm(first.events), [{
    id: "milestone:digitalPress:10",
    buildingId: "digitalPress",
    quantity: 10,
    multiplier: 1.1
  }]);
  const repeated = Progression.computeMilestoneEvents("digitalPress", 9, 10, first.seenIds);
  assert.equal(repeated.events.length, 0);
  const jumped = Progression.computeMilestoneEvents("offsetPress", 9, 26, []);
  assert.deepEqual(copyAcrossRealm(jumped.events.map(item => item.quantity)), [10, 25]);

  const career = createCareer({ started: true });
  assert.equal(Progression.recordBuildingMilestones(career, "prepressStudio", 9, 10).length, 1);
  assert.equal(Progression.recordBuildingMilestones(career, "prepressStudio", 9, 10).length, 0);
  Progression.handlePrestige(career, blankContext(), { now: NOW + 1 });
  assert.equal(Progression.recordBuildingMilestones(career, "prepressStudio", 9, 10).length, 1,
    "a new prestige cycle may earn the run milestone again");
}

// Lower-is-better objectives remain supported by the common objective engine.
{
  const career = createCareer();
  const context = blankContext();
  context.stats.footprint = 0.35;
  const progress = Progression.objectiveProgress({
    id: "test.footprint",
    type: "statAtMost",
    stat: "footprint",
    target: 0.4,
    labelKey: "test"
  }, career, context, { baseline: Progression.captureBaseline(career) });
  assert.equal(progress.complete, true);
  assert.equal(progress.direction, "atMost");
}

console.log("Progression contracts: ok");
