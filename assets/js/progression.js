/**
 * ProgressionModule — pure career and long-term progression rules.
 *
 * The module owns no DOM, timers, localisation catalogue or game resources.
 * app.js remains responsible for rendering, saving the returned state and
 * crediting Culture rewards returned by challenge completions.
 *
 * Integration contract:
 * - hydrateCareer(save.career, { culturePoints, now }) when the game starts;
 * - call updateProgress(career, context) after relevant state changes;
 * - call recordContract/recordUpgradePurchased/recordBuildingMilestones for
 *   action-based progress before updateProgress;
 * - call handlePrestige after the existing CC confirmation. Prestige is never
 *   blocked here: an unfinished Plan is simply restarted and earns no stamp;
 * - persist serializeCareer(career) in the canonical save.
 *
 * Expected context shape (all fields are optional and default to zero):
 * { resources: { ccTotal }, stats: { quality, brandImage },
 *   metrics: { docPerSecond }, buildings: [{ id, quantity }] }.
 * recordContract accepts { id, clauseSucceeded, clauseId, quality,
 * brandImage }. Culture returned by updateProgress().challengeCompleted or
 * handlePrestige().planCompleted must be credited and saved together by
 * app.js; the completed challenge/rank makes either reward idempotent.
 */
(function (root, factory) {
  const api = factory();
  const commonJS = typeof module === "object" && module !== null && module.exports;
  if (commonJS) module.exports = api;
  if (typeof window !== "undefined") {
    window.ProgressionModule = api;
  } else if (!commonJS) {
    root.ProgressionModule = api;
  }
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const API_VERSION = 1;
  const CAREER_SCHEMA_VERSION = 1;
  const MAX_RANK = 3;
  const MAX_TRACKED_IDS = 128;
  const MAX_ATTEMPTS = 40;
  const PLAN_IDS = ["cadence", "quality", "clientRelations"];
  const CHALLENGE_IDS = ["budgetFrozen", "zeroReturns", "everyoneCopied"];
  const CAMPAIGN_IDS = ["onboarding842", "annualReportSeason", "confidentialMerger"];
  const MILESTONES = [
    { quantity: 10, multiplier: 1.1 },
    { quantity: 25, multiplier: 1.25 }
  ];

  function objective(id, type, target, extra) {
    return Object.assign(
      {
        id,
        type,
        target,
        labelKey: "career.objective." + id
      },
      extra || {}
    );
  }

  /**
   * All provisional balance values live in these declarative definitions.
   * They are deliberately separate from the evaluator so playtest tuning does
   * not require changing progression code.
   */
  const PLAN_DEFINITIONS = [
    {
      id: "cadence",
      nameKey: "career.plan.cadence.name",
      descriptionKey: "career.plan.cadence.description",
      ranks: [
        {
          rank: 1,
          modifiers: { docMultiplier: 1.1, footprintDriftMultiplier: 1.2 },
          objectives: [
            objective("cadence.1.operators", "buildingQuantity", 10, { buildingId: "reproOperator" }),
            objective("cadence.1.rate", "metricAtLeast", 25, { metric: "docPerSecond" }),
            objective("cadence.1.trust", "resourceAtLeast", 15000, { resource: "ccTotal" })
          ]
        },
        {
          rank: 2,
          modifiers: { docMultiplier: 1.15, footprintDriftMultiplier: 1.35 },
          objectives: [
            objective("cadence.2.digital", "buildingQuantity", 10, { buildingId: "digitalPress" }),
            objective("cadence.2.rate", "metricAtLeast", 500, { metric: "docPerSecond" }),
            objective("cadence.2.trust", "resourceAtLeast", 75000, { resource: "ccTotal" })
          ]
        },
        {
          rank: 3,
          modifiers: { docMultiplier: 1.2, footprintDriftMultiplier: 1.5 },
          objectives: [
            objective("cadence.3.offset", "buildingQuantity", 25, { buildingId: "offsetPress" }),
            objective("cadence.3.rate", "metricAtLeast", 20000, { metric: "docPerSecond" }),
            objective("cadence.3.trust", "resourceAtLeast", 1000000, { resource: "ccTotal" })
          ]
        }
      ]
    },
    {
      id: "quality",
      nameKey: "career.plan.quality.name",
      descriptionKey: "career.plan.quality.description",
      ranks: [
        {
          rank: 1,
          modifiers: { docMultiplier: 0.95, qualityTargetOffset: 0.04 },
          objectives: [
            objective("quality.1.prepress", "buildingQuantity", 1, { buildingId: "prepressStudio" }),
            objective("quality.1.gauge", "statAtLeast", 0.75, { stat: "quality" }),
            objective("quality.1.clause", "counterDelta", 1, { counter: "clausesCompleted" })
          ]
        },
        {
          rank: 2,
          modifiers: { docMultiplier: 0.925, qualityTargetOffset: 0.06 },
          objectives: [
            objective("quality.2.prepress", "buildingQuantity", 5, { buildingId: "prepressStudio" }),
            objective("quality.2.gauge", "statAtLeast", 0.85, { stat: "quality" }),
            objective("quality.2.clauses", "counterDelta", 2, { counter: "clausesCompleted" })
          ]
        },
        {
          rank: 3,
          modifiers: { docMultiplier: 0.9, qualityTargetOffset: 0.08 },
          objectives: [
            objective("quality.3.prepress", "buildingQuantity", 25, { buildingId: "prepressStudio" }),
            objective("quality.3.gauge", "statAtLeast", 0.92, { stat: "quality" }),
            objective("quality.3.clauses", "counterDelta", 3, { counter: "clausesCompleted" })
          ]
        }
      ]
    },
    {
      id: "clientRelations",
      nameKey: "career.plan.clientRelations.name",
      descriptionKey: "career.plan.clientRelations.description",
      ranks: [
        {
          rank: 1,
          modifiers: {
            ccMultiplier: 1.1,
            buildingCostMultiplier: 1.05,
            contractRewardMultiplier: 1.1
          },
          objectives: [
            objective("clientRelations.1.image", "statAtLeast", 0.65, { stat: "brandImage" }),
            objective("clientRelations.1.contracts", "counterDelta", 2, { counter: "contractsCompleted" }),
            objective("clientRelations.1.trust", "resourceAtLeast", 25000, { resource: "ccTotal" })
          ]
        },
        {
          rank: 2,
          modifiers: {
            ccMultiplier: 1.15,
            buildingCostMultiplier: 1.075,
            contractRewardMultiplier: 1.2
          },
          objectives: [
            objective("clientRelations.2.portal", "buildingQuantity", 10, { buildingId: "clientPortal" }),
            objective("clientRelations.2.clauses", "counterDelta", 2, { counter: "clausesCompleted" }),
            objective("clientRelations.2.trust", "resourceAtLeast", 100000, { resource: "ccTotal" })
          ]
        },
        {
          rank: 3,
          modifiers: {
            ccMultiplier: 1.2,
            buildingCostMultiplier: 1.1,
            contractRewardMultiplier: 1.3
          },
          objectives: [
            objective("clientRelations.3.comBridge", "buildingQuantity", 25, { buildingId: "comBridge" }),
            objective("clientRelations.3.contracts", "counterDelta", 4, { counter: "contractsCompleted" }),
            objective("clientRelations.3.trust", "resourceAtLeast", 10000000, { resource: "ccTotal" })
          ]
        }
      ]
    }
  ];

  const CHALLENGE_DEFINITIONS = [
    {
      id: "budgetFrozen",
      planId: "cadence",
      nameKey: "career.challenge.budgetFrozen.name",
      descriptionKey: "career.challenge.budgetFrozen.description",
      reward: { culture: 2 },
      objectives: [
        objective("challenge.budgetFrozen.offset", "idCounterDelta", 1, {
          map: "buildingPurchaseCountsById",
          trackedId: "offsetPress"
        })
      ],
      failure: { event: "upgradePurchased", reason: "budget-broken" }
    },
    {
      id: "zeroReturns",
      planId: "quality",
      nameKey: "career.challenge.zeroReturns.name",
      descriptionKey: "career.challenge.zeroReturns.description",
      reward: { culture: 3 },
      threshold: { quality: 0.8 },
      objectives: [
        objective("challenge.zeroReturns.contracts", "runtimeCounter", 3, { counter: "qualifiedContracts" })
      ],
      failure: { event: "contractBelowThreshold", reason: "quality-return" }
    },
    {
      id: "everyoneCopied",
      planId: "clientRelations",
      nameKey: "career.challenge.everyoneCopied.name",
      descriptionKey: "career.challenge.everyoneCopied.description",
      reward: { culture: 4 },
      threshold: { brandImage: 0.75 },
      objectives: [
        objective("challenge.everyoneCopied.contracts", "runtimeUniqueIds", 3, { ids: "qualifiedContractIds" })
      ],
      failure: { event: "contractBelowThreshold", reason: "management-not-copied" }
    }
  ];

  const CAMPAIGN_DEFINITIONS = [
    {
      id: "onboarding842",
      unlockStamps: 3,
      nameKey: "career.campaign.onboarding842.name",
      descriptionKey: "career.campaign.onboarding842.description",
      badgeId: "badgeOnboarding842",
      objectives: [
        objective("campaign.onboarding842.inserting", "buildingQuantity", 5, { buildingId: "insertingLine" }),
        objective("campaign.onboarding842.contract", "idCounterDelta", 1, {
          map: "contractCountsById",
          trackedId: "onboardingKit"
        }),
        objective("campaign.onboarding842.clause", "counterDelta", 1, { counter: "clausesCompleted" })
      ]
    },
    {
      id: "annualReportSeason",
      unlockStamps: 6,
      nameKey: "career.campaign.annualReportSeason.name",
      descriptionKey: "career.campaign.annualReportSeason.description",
      badgeId: "badgeAnnualReportSeason",
      objectives: [
        objective("campaign.annualReportSeason.prepress", "buildingQuantity", 1, { buildingId: "prepressStudio" }),
        objective("campaign.annualReportSeason.quality", "statAtLeast", 0.85, { stat: "quality" }),
        objective("campaign.annualReportSeason.contract", "idCounterDelta", 1, {
          map: "contractCountsById",
          trackedId: "annualReports"
        })
      ]
    },
    {
      id: "confidentialMerger",
      unlockStamps: 9,
      nameKey: "career.campaign.confidentialMerger.name",
      descriptionKey: "career.campaign.confidentialMerger.description",
      badgeId: "badgeConfidentialMerger",
      objectives: [
        objective("campaign.confidentialMerger.portal", "buildingQuantity", 10, { buildingId: "clientPortal" }),
        objective("campaign.confidentialMerger.image", "statAtLeast", 0.9, { stat: "brandImage" }),
        objective("campaign.confidentialMerger.contracts", "uniqueIdDelta", 3, { map: "contractCountsById" })
      ]
    }
  ];

  const PERMANENT_BONUS_PER_RANK = {
    cadenceDocMultiplier: 0.02,
    qualityTargetOffset: 0.01,
    clientCcMultiplier: 0.02
  };

  const CONCLUSION = {
    id: "viceDirectorAssistantPaperOperations",
    titleKey: "career.conclusion.title",
    descriptionKey: "career.conclusion.description",
    requiredStamps: PLAN_IDS.length * MAX_RANK,
    requiredCampaignIds: CAMPAIGN_IDS.slice()
  };

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
  }

  deepFreeze(PLAN_DEFINITIONS);
  deepFreeze(CHALLENGE_DEFINITIONS);
  deepFreeze(CAMPAIGN_DEFINITIONS);
  deepFreeze(PERMANENT_BONUS_PER_RANK);
  deepFreeze(CONCLUSION);
  deepFreeze(MILESTONES);

  function finiteNonNegative(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function nonNegativeInteger(value, fallback, max) {
    if (!Number.isSafeInteger(value) || value < 0) return fallback;
    return typeof max === "number" ? Math.min(max, value) : value;
  }

  function validTimestamp(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function validId(value) {
    return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(value);
  }

  function uniqueIds(values, allowList) {
    const allowed = allowList ? new Set(allowList) : null;
    const result = [];
    if (!Array.isArray(values)) return result;
    for (const value of values) {
      if (!validId(value)) continue;
      if (allowed && !allowed.has(value)) continue;
      if (!result.includes(value)) result.push(value);
      if (result.length >= MAX_TRACKED_IDS) break;
    }
    return result;
  }

  function sanitizeCountMap(raw) {
    const result = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
    for (const [id, value] of Object.entries(raw)) {
      if (!validId(id)) continue;
      const count = nonNegativeInteger(value, 0);
      if (count > 0) result[id] = count;
      if (Object.keys(result).length >= MAX_TRACKED_IDS) break;
    }
    return result;
  }

  function cloneCountMap(map) {
    return Object.assign({}, map || {});
  }

  function incrementCountMap(map, id) {
    const hasId = Object.prototype.hasOwnProperty.call(map, id);
    if (!hasId && Object.keys(map).length >= MAX_TRACKED_IDS) return false;
    map[id] = (map[id] || 0) + 1;
    return true;
  }

  function createCycle(id, now) {
    return {
      id: nonNegativeInteger(id, 0),
      startedAt: validTimestamp(now, Date.now()),
      contractsCompleted: 0,
      clausesCompleted: 0,
      upgradesPurchased: 0,
      contractIds: [],
      clauseIds: [],
      contractCountsById: {},
      clauseCountsById: {},
      buildingPurchaseCountsById: {},
      milestoneIds: []
    };
  }

  function sanitizeCycle(raw, now) {
    const cycle = createCycle(raw && raw.id, validTimestamp(raw && raw.startedAt, now));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return cycle;
    cycle.contractsCompleted = nonNegativeInteger(raw.contractsCompleted, 0);
    cycle.clausesCompleted = nonNegativeInteger(raw.clausesCompleted, 0);
    cycle.upgradesPurchased = nonNegativeInteger(raw.upgradesPurchased, 0);
    cycle.contractIds = uniqueIds(raw.contractIds);
    cycle.clauseIds = uniqueIds(raw.clauseIds);
    cycle.contractCountsById = sanitizeCountMap(raw.contractCountsById);
    cycle.clauseCountsById = sanitizeCountMap(raw.clauseCountsById);
    cycle.buildingPurchaseCountsById = sanitizeCountMap(raw.buildingPurchaseCountsById);
    cycle.milestoneIds = uniqueIds(raw.milestoneIds);
    return cycle;
  }

  function captureBaseline(career) {
    const cycle = career && career.cycle ? career.cycle : createCycle(0, Date.now());
    return {
      contractsCompleted: cycle.contractsCompleted || 0,
      clausesCompleted: cycle.clausesCompleted || 0,
      upgradesPurchased: cycle.upgradesPurchased || 0,
      contractCountsById: cloneCountMap(cycle.contractCountsById),
      clauseCountsById: cloneCountMap(cycle.clauseCountsById),
      buildingPurchaseCountsById: cloneCountMap(cycle.buildingPurchaseCountsById),
      milestoneIds: (cycle.milestoneIds || []).slice()
    };
  }

  function sanitizeBaseline(raw) {
    return {
      contractsCompleted: nonNegativeInteger(raw && raw.contractsCompleted, 0),
      clausesCompleted: nonNegativeInteger(raw && raw.clausesCompleted, 0),
      upgradesPurchased: nonNegativeInteger(raw && raw.upgradesPurchased, 0),
      contractCountsById: sanitizeCountMap(raw && raw.contractCountsById),
      clauseCountsById: sanitizeCountMap(raw && raw.clauseCountsById),
      buildingPurchaseCountsById: sanitizeCountMap(raw && raw.buildingPurchaseCountsById),
      milestoneIds: uniqueIds(raw && raw.milestoneIds)
    };
  }

  function createRuntimeCounters(raw) {
    return {
      qualifiedContracts: nonNegativeInteger(raw && raw.qualifiedContracts, 0),
      qualifiedContractIds: uniqueIds(raw && raw.qualifiedContractIds)
    };
  }

  function createDefaultCareer(options) {
    const settings = options || {};
    const now = validTimestamp(settings.now, Date.now());
    return {
      schemaVersion: CAREER_SCHEMA_VERSION,
      started: settings.started === true || finiteNonNegative(settings.culturePoints, 0) > 0,
      completedRanks: {
        cadence: 0,
        quality: 0,
        clientRelations: 0
      },
      activePlan: null,
      cycle: createCycle(0, now),
      challenges: {
        active: null,
        completedIds: [],
        declinedThisCycleIds: [],
        failedThisCycleIds: [],
        attempts: []
      },
      campaigns: {
        active: null,
        completedIds: []
      },
      conclusion: {
        unlockedAt: null,
        acknowledgedAt: null
      }
    };
  }

  function getPlanDefinition(id) {
    return PLAN_DEFINITIONS.find(definition => definition.id === id) || null;
  }

  function getRankDefinition(planId, rank) {
    const plan = getPlanDefinition(planId);
    return plan ? plan.ranks.find(item => item.rank === rank) || null : null;
  }

  function getChallengeDefinition(id) {
    return CHALLENGE_DEFINITIONS.find(definition => definition.id === id) || null;
  }

  function getCampaignDefinition(id) {
    return CAMPAIGN_DEFINITIONS.find(definition => definition.id === id) || null;
  }

  function totalStamps(career) {
    return PLAN_IDS.reduce((sum, id) => sum + nonNegativeInteger(career.completedRanks[id], 0, MAX_RANK), 0);
  }

  function getStampIds(career) {
    const stamps = [];
    for (const planId of PLAN_IDS) {
      const completed = nonNegativeInteger(career.completedRanks[planId], 0, MAX_RANK);
      for (let rank = 1; rank <= completed; rank += 1) {
        stamps.push("stamp:" + planId + ":" + rank);
      }
    }
    return stamps;
  }

  function getCampaignBadges(career) {
    return CAMPAIGN_DEFINITIONS
      .filter(definition => career.campaigns.completedIds.includes(definition.id))
      .map(definition => definition.badgeId);
  }

  function sanitizeAttempts(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(item => item && typeof item === "object" && CHALLENGE_IDS.includes(item.id))
      .slice(-MAX_ATTEMPTS)
      .map(item => ({
        id: item.id,
        outcome: ["completed", "failed", "declined"].includes(item.outcome) ? item.outcome : "failed",
        reason: validId(item.reason) ? item.reason : null,
        at: validTimestamp(item.at, null),
        cycleId: nonNegativeInteger(item.cycleId, 0)
      }));
  }

  function sanitizeTrack(raw, definition, expectedRank, expectedId) {
    if (!raw || !definition) return null;
    const stepIndex = nonNegativeInteger(raw.stepIndex, 0, definition.objectives.length);
    const track = {
      id: expectedId || definition.id,
      stepIndex,
      baseline: sanitizeBaseline(raw.baseline),
      startedAt: validTimestamp(raw.startedAt, null)
    };
    if (typeof expectedRank === "number") track.rank = expectedRank;
    if (Number.isSafeInteger(raw.attempt) && raw.attempt > 0) track.attempt = raw.attempt;
    return track;
  }

  /**
   * Defensive save migration. Unknown IDs, impossible ranks, negative counters
   * and forged conclusion flags are ignored rather than trusted.
   */
  function hydrateCareer(raw, options) {
    const settings = options || {};
    const now = validTimestamp(settings.now, Date.now());
    const source = raw && raw.career && !raw.completedRanks ? raw.career : raw;
    const career = createDefaultCareer({
      now,
      started: Boolean(source && source.started === true) || settings.started === true,
      culturePoints: settings.culturePoints
    });
    if (!source || typeof source !== "object" || Array.isArray(source)) return career;

    for (const id of PLAN_IDS) {
      career.completedRanks[id] = nonNegativeInteger(
        source.completedRanks && source.completedRanks[id],
        0,
        MAX_RANK
      );
    }
    career.cycle = sanitizeCycle(source.cycle, now);

    const rawPlan = source.activePlan;
    if (rawPlan && PLAN_IDS.includes(rawPlan.id)) {
      const expectedRank = career.completedRanks[rawPlan.id] + 1;
      const rankDefinition = expectedRank <= MAX_RANK ? getRankDefinition(rawPlan.id, expectedRank) : null;
      if (rankDefinition && rawPlan.rank === expectedRank) {
        career.activePlan = sanitizeTrack(rawPlan, rankDefinition, expectedRank, rawPlan.id);
      }
    }

    const rawChallenges = source.challenges;
    if (rawChallenges && typeof rawChallenges === "object" && !Array.isArray(rawChallenges)) {
      career.challenges.completedIds = uniqueIds(rawChallenges.completedIds, CHALLENGE_IDS);
      career.challenges.declinedThisCycleIds = uniqueIds(rawChallenges.declinedThisCycleIds, CHALLENGE_IDS)
        .filter(id => !career.challenges.completedIds.includes(id));
      career.challenges.failedThisCycleIds = uniqueIds(rawChallenges.failedThisCycleIds, CHALLENGE_IDS)
        .filter(id => !career.challenges.completedIds.includes(id));
      career.challenges.attempts = sanitizeAttempts(rawChallenges.attempts);
      const rawActive = rawChallenges.active;
      const challengeDefinition = rawActive && getChallengeDefinition(rawActive.id);
      if (
        challengeDefinition &&
        career.activePlan &&
        career.activePlan.id === challengeDefinition.planId &&
        !career.challenges.completedIds.includes(challengeDefinition.id)
      ) {
        career.challenges.active = sanitizeTrack(rawActive, challengeDefinition);
        career.challenges.active.counters = createRuntimeCounters(rawActive.counters);
      }
    }

    const rawCampaigns = source.campaigns;
    if (rawCampaigns && typeof rawCampaigns === "object" && !Array.isArray(rawCampaigns)) {
      const stamps = totalStamps(career);
      career.campaigns.completedIds = uniqueIds(rawCampaigns.completedIds, CAMPAIGN_IDS)
        .filter(id => stamps >= getCampaignDefinition(id).unlockStamps);
      const rawActive = rawCampaigns.active;
      const campaignDefinition = rawActive && getCampaignDefinition(rawActive.id);
      if (
        campaignDefinition &&
        !career.campaigns.completedIds.includes(campaignDefinition.id) &&
        totalStamps(career) >= campaignDefinition.unlockStamps
      ) {
        career.campaigns.active = sanitizeTrack(rawActive, campaignDefinition);
      }
    }

    const rawConclusion = source.conclusion;
    if (rawConclusion && typeof rawConclusion === "object" && !Array.isArray(rawConclusion)) {
      career.conclusion.unlockedAt = validTimestamp(rawConclusion.unlockedAt, null);
      career.conclusion.acknowledgedAt = validTimestamp(rawConclusion.acknowledgedAt, null);
    }
    refreshConclusion(career, now);
    return career;
  }

  function serializeCareer(career) {
    return JSON.parse(JSON.stringify(hydrateCareer(career, {
      now: career && career.cycle && career.cycle.startedAt,
      started: career && career.started
    })));
  }

  function getAvailablePlans(career) {
    if (!career || career.activePlan) return [];
    return PLAN_DEFINITIONS.reduce((available, definition) => {
      const rank = nonNegativeInteger(career.completedRanks[definition.id], 0, MAX_RANK) + 1;
      if (rank <= MAX_RANK) {
        available.push({ plan: definition, rank, rankDefinition: getRankDefinition(definition.id, rank) });
      }
      return available;
    }, []);
  }

  function selectPlan(career, planId, options) {
    if (!career || career.activePlan) return { ok: false, error: "plan-active" };
    const available = getAvailablePlans(career).find(item => item.plan.id === planId);
    if (!available) return { ok: false, error: "plan-unavailable" };
    const now = validTimestamp(options && options.now, Date.now());
    career.started = true;
    career.activePlan = {
      id: planId,
      rank: available.rank,
      stepIndex: 0,
      baseline: captureBaseline(career),
      startedAt: now,
      attempt: 1
    };
    return { ok: true, plan: available.plan, rank: available.rank };
  }

  function abandonPlan(career) {
    if (!career || !career.activePlan) return { ok: false, error: "no-active-plan" };
    const previousId = career.activePlan.id;
    if (career.challenges.active) failActiveChallenge(career, "plan-abandoned");
    career.activePlan = null;
    return { ok: true, previousId };
  }

  function buildingQuantity(context, buildingId) {
    const buildings = context && Array.isArray(context.buildings) ? context.buildings : [];
    const building = buildings.find(item => item && item.id === buildingId);
    return building ? finiteNonNegative(building.quantity, 0) : 0;
  }

  function contextValue(context, group, key) {
    const source = context && context[group];
    return finiteNonNegative(source && source[key], 0);
  }

  function countMapDelta(current, baseline, trackedId) {
    return Math.max(0, (current && current[trackedId] || 0) - (baseline && baseline[trackedId] || 0));
  }

  function uniqueCountMapDelta(current, baseline) {
    return Object.keys(current || {}).reduce((count, id) => {
      return count + ((current[id] || 0) > (baseline && baseline[id] || 0) ? 1 : 0);
    }, 0);
  }

  function objectiveProgress(definition, career, context, runtime) {
    const baseline = runtime && runtime.baseline ? runtime.baseline : sanitizeBaseline(null);
    const cycle = career.cycle;
    let current = 0;
    let direction = "atLeast";

    switch (definition.type) {
      case "buildingQuantity":
        current = buildingQuantity(context, definition.buildingId);
        break;
      case "metricAtLeast":
        current = contextValue(context, "metrics", definition.metric);
        if (!current && context && definition.metric === "docPerSecond") {
          current = finiteNonNegative(context.docPerSecond, 0);
        }
        break;
      case "resourceAtLeast":
        current = contextValue(context, "resources", definition.resource);
        break;
      case "statAtLeast":
        current = contextValue(context, "stats", definition.stat);
        break;
      case "statAtMost":
        current = contextValue(context, "stats", definition.stat);
        direction = "atMost";
        break;
      case "counterDelta":
        current = Math.max(0, (cycle[definition.counter] || 0) - (baseline[definition.counter] || 0));
        break;
      case "idCounterDelta":
        current = countMapDelta(
          cycle[definition.map],
          baseline[definition.map],
          definition.trackedId
        );
        break;
      case "uniqueIdDelta":
        current = uniqueCountMapDelta(cycle[definition.map], baseline[definition.map]);
        break;
      case "runtimeCounter":
        current = runtime && runtime.counters ? finiteNonNegative(runtime.counters[definition.counter], 0) : 0;
        break;
      case "runtimeUniqueIds":
        current = runtime && runtime.counters ? uniqueIds(runtime.counters[definition.ids]).length : 0;
        break;
      default:
        current = 0;
    }

    const complete = direction === "atMost" ? current <= definition.target : current >= definition.target;
    const ratio = direction === "atMost"
      ? complete ? 1 : Math.max(0, Math.min(1, definition.target / Math.max(current, 1e-9)))
      : Math.max(0, Math.min(1, current / Math.max(definition.target, 1e-9)));
    return {
      id: definition.id,
      type: definition.type,
      labelKey: definition.labelKey,
      current,
      target: definition.target,
      direction,
      ratio,
      complete
    };
  }

  function trackStatus(definition, runtime, career, context) {
    if (!definition || !runtime) return null;
    const complete = runtime.stepIndex >= definition.objectives.length;
    const objectiveDefinition = complete ? null : definition.objectives[runtime.stepIndex];
    return {
      id: definition.id,
      stepIndex: runtime.stepIndex,
      stepNumber: Math.min(definition.objectives.length, runtime.stepIndex + 1),
      stepCount: definition.objectives.length,
      complete,
      objective: objectiveDefinition
        ? objectiveProgress(objectiveDefinition, career, context || {}, runtime)
        : null
    };
  }

  function advanceTrack(definition, runtime, career, context) {
    const completedObjectives = [];
    if (!definition || !runtime) return { completedObjectives, complete: false };
    while (runtime.stepIndex < definition.objectives.length) {
      const currentDefinition = definition.objectives[runtime.stepIndex];
      const progress = objectiveProgress(currentDefinition, career, context || {}, runtime);
      if (!progress.complete) break;
      completedObjectives.push(progress);
      runtime.stepIndex += 1;
      // Sequential action objectives only count actions performed after they
      // become the active step. State objectives may still validate instantly.
      runtime.baseline = captureBaseline(career);
    }
    return {
      completedObjectives,
      complete: runtime.stepIndex >= definition.objectives.length
    };
  }

  function getPlanStatus(career, context) {
    if (!career || !career.activePlan) return null;
    const definition = getRankDefinition(career.activePlan.id, career.activePlan.rank);
    return trackStatus(definition, career.activePlan, career, context || {});
  }

  function isPlanReady(career, context) {
    const status = getPlanStatus(career, context);
    return Boolean(status && status.complete);
  }

  function getAvailableChallenges(career) {
    if (!career || !career.activePlan || career.challenges.active) return [];
    return CHALLENGE_DEFINITIONS.filter(definition => {
      return definition.planId === career.activePlan.id &&
        !career.challenges.completedIds.includes(definition.id) &&
        !career.challenges.declinedThisCycleIds.includes(definition.id) &&
        !career.challenges.failedThisCycleIds.includes(definition.id);
    });
  }

  function recordAttempt(career, id, outcome, reason, now) {
    career.challenges.attempts.push({
      id,
      outcome,
      reason: reason || null,
      at: validTimestamp(now, Date.now()),
      cycleId: career.cycle.id
    });
    career.challenges.attempts = career.challenges.attempts.slice(-MAX_ATTEMPTS);
  }

  function acceptChallenge(career, id, options) {
    const definition = getAvailableChallenges(career).find(item => item.id === id);
    if (!definition) return { ok: false, error: career && career.challenges.active ? "challenge-active" : "challenge-unavailable" };
    career.challenges.active = {
      id,
      stepIndex: 0,
      baseline: captureBaseline(career),
      counters: createRuntimeCounters(),
      startedAt: validTimestamp(options && options.now, Date.now())
    };
    return { ok: true, challenge: definition };
  }

  function declineChallenge(career, id, options) {
    const definition = getAvailableChallenges(career).find(item => item.id === id);
    if (!definition) return { ok: false, error: "challenge-unavailable" };
    career.challenges.declinedThisCycleIds.push(id);
    recordAttempt(career, id, "declined", null, options && options.now);
    return { ok: true, challenge: definition };
  }

  function failActiveChallenge(career, reason, options) {
    if (!career || !career.challenges.active) return null;
    const id = career.challenges.active.id;
    career.challenges.active = null;
    if (!career.challenges.failedThisCycleIds.includes(id)) {
      career.challenges.failedThisCycleIds.push(id);
    }
    recordAttempt(career, id, "failed", reason || "failed", options && options.now);
    return { id, reason: reason || "failed" };
  }

  function getChallengeStatus(career, context) {
    if (!career || !career.challenges.active) return null;
    const definition = getChallengeDefinition(career.challenges.active.id);
    return trackStatus(definition, career.challenges.active, career, context || {});
  }

  function getAvailableCampaigns(career) {
    if (!career || career.campaigns.active) return [];
    const stamps = totalStamps(career);
    return CAMPAIGN_DEFINITIONS.filter(definition => {
      return stamps >= definition.unlockStamps && !career.campaigns.completedIds.includes(definition.id);
    });
  }

  function startCampaign(career, id, options) {
    const definition = getAvailableCampaigns(career).find(item => item.id === id);
    if (!definition) return { ok: false, error: career && career.campaigns.active ? "campaign-active" : "campaign-unavailable" };
    career.campaigns.active = {
      id,
      stepIndex: 0,
      baseline: captureBaseline(career),
      startedAt: validTimestamp(options && options.now, Date.now())
    };
    return { ok: true, campaign: definition };
  }

  function getCampaignStatus(career, context) {
    if (!career || !career.campaigns.active) return null;
    const definition = getCampaignDefinition(career.campaigns.active.id);
    return trackStatus(definition, career.campaigns.active, career, context || {});
  }

  function canUnlockConclusion(career) {
    return totalStamps(career) >= CONCLUSION.requiredStamps &&
      CONCLUSION.requiredCampaignIds.every(id => career.campaigns.completedIds.includes(id));
  }

  function refreshConclusion(career, now) {
    const eligible = canUnlockConclusion(career);
    if (!eligible) {
      career.conclusion.unlockedAt = null;
      career.conclusion.acknowledgedAt = null;
      return false;
    }
    if (!career.conclusion.unlockedAt) {
      career.conclusion.unlockedAt = validTimestamp(now, Date.now());
      return true;
    }
    return false;
  }

  function getConclusion(career) {
    const unlocked = Boolean(career && career.conclusion && career.conclusion.unlockedAt && canUnlockConclusion(career));
    return {
      id: CONCLUSION.id,
      titleKey: CONCLUSION.titleKey,
      descriptionKey: CONCLUSION.descriptionKey,
      unlocked,
      unlockedAt: unlocked ? career.conclusion.unlockedAt : null,
      acknowledgedAt: unlocked ? career.conclusion.acknowledgedAt : null
    };
  }

  function acknowledgeConclusion(career, options) {
    if (!career || !getConclusion(career).unlocked) return false;
    if (!career.conclusion.acknowledgedAt) {
      career.conclusion.acknowledgedAt = validTimestamp(options && options.now, Date.now());
    }
    return true;
  }

  /** Advances Plan, challenge and campaign tracks with the same evaluator. */
  function updateProgress(career, context, options) {
    const now = validTimestamp(options && options.now, Date.now());
    const result = {
      planObjectivesCompleted: [],
      planReady: false,
      challengeObjectivesCompleted: [],
      challengeCompleted: null,
      campaignObjectivesCompleted: [],
      campaignCompleted: null,
      conclusionUnlocked: false
    };

    if (career.activePlan) {
      const definition = getRankDefinition(career.activePlan.id, career.activePlan.rank);
      const progress = advanceTrack(definition, career.activePlan, career, context || {});
      result.planObjectivesCompleted = progress.completedObjectives;
      result.planReady = progress.complete;
    }

    if (career.challenges.active) {
      const definition = getChallengeDefinition(career.challenges.active.id);
      const progress = advanceTrack(definition, career.challenges.active, career, context || {});
      result.challengeObjectivesCompleted = progress.completedObjectives;
      if (progress.complete) {
        const id = definition.id;
        if (!career.challenges.completedIds.includes(id)) career.challenges.completedIds.push(id);
        career.challenges.active = null;
        career.challenges.declinedThisCycleIds = career.challenges.declinedThisCycleIds.filter(item => item !== id);
        career.challenges.failedThisCycleIds = career.challenges.failedThisCycleIds.filter(item => item !== id);
        recordAttempt(career, id, "completed", null, now);
        result.challengeCompleted = {
          id,
          reward: { culture: definition.reward.culture }
        };
      }
    }

    if (career.campaigns.active) {
      const definition = getCampaignDefinition(career.campaigns.active.id);
      const progress = advanceTrack(definition, career.campaigns.active, career, context || {});
      result.campaignObjectivesCompleted = progress.completedObjectives;
      if (progress.complete) {
        const id = definition.id;
        if (!career.campaigns.completedIds.includes(id)) career.campaigns.completedIds.push(id);
        career.campaigns.active = null;
        result.campaignCompleted = { id, badgeId: definition.badgeId };
      }
    }

    result.conclusionUnlocked = refreshConclusion(career, now);
    return result;
  }

  function recordContract(career, payload, options) {
    if (!career || !career.cycle) return { ok: false, error: "career-unavailable" };
    const data = payload || {};
    const contractId = validId(data.id) ? data.id : "unknownContract";
    career.cycle.contractsCompleted += 1;
    const contractIdRecorded = incrementCountMap(career.cycle.contractCountsById, contractId);
    if (contractIdRecorded && !career.cycle.contractIds.includes(contractId) && career.cycle.contractIds.length < MAX_TRACKED_IDS) {
      career.cycle.contractIds.push(contractId);
    }

    if (data.clauseSucceeded === true) {
      const derivedClauseId = contractId.length <= 72 ? contractId + ":clause" : "unknownContract:clause";
      const clauseId = validId(data.clauseId) ? data.clauseId : derivedClauseId;
      career.cycle.clausesCompleted += 1;
      const clauseIdRecorded = incrementCountMap(career.cycle.clauseCountsById, clauseId);
      if (clauseIdRecorded && !career.cycle.clauseIds.includes(clauseId) && career.cycle.clauseIds.length < MAX_TRACKED_IDS) {
        career.cycle.clauseIds.push(clauseId);
      }
    }

    let challengeFailure = null;
    const active = career.challenges.active;
    if (active && active.id === "zeroReturns") {
      if (Number.isFinite(data.quality)) {
        if (data.quality < getChallengeDefinition(active.id).threshold.quality) {
          challengeFailure = failActiveChallenge(career, "quality-return", options);
        } else {
          active.counters.qualifiedContracts += 1;
        }
      }
    } else if (active && active.id === "everyoneCopied") {
      if (Number.isFinite(data.brandImage)) {
        if (data.brandImage < getChallengeDefinition(active.id).threshold.brandImage) {
          challengeFailure = failActiveChallenge(career, "management-not-copied", options);
        } else if (
          !active.counters.qualifiedContractIds.includes(contractId) &&
          active.counters.qualifiedContractIds.length < MAX_TRACKED_IDS
        ) {
          active.counters.qualifiedContractIds.push(contractId);
        }
      }
    }

    return {
      ok: true,
      contractId,
      clauseRecorded: data.clauseSucceeded === true,
      challengeFailure
    };
  }

  function recordUpgradePurchased(career, options) {
    if (!career || !career.cycle) return { ok: false, error: "career-unavailable" };
    career.cycle.upgradesPurchased += 1;
    const challengeFailure = career.challenges.active && career.challenges.active.id === "budgetFrozen"
      ? failActiveChallenge(career, "budget-broken", options)
      : null;
    return { ok: true, challengeFailure };
  }

  function getMilestoneMultiplier(quantity) {
    const safeQuantity = finiteNonNegative(quantity, 0);
    let multiplier = 1;
    for (const milestone of MILESTONES) {
      if (safeQuantity >= milestone.quantity) multiplier = milestone.multiplier;
    }
    return multiplier;
  }

  function getNextMilestone(quantity) {
    const safeQuantity = finiteNonNegative(quantity, 0);
    const milestone = MILESTONES.find(item => safeQuantity < item.quantity);
    return milestone ? { quantity: milestone.quantity, multiplier: milestone.multiplier } : null;
  }

  /** Pure helper: repeated calls with the returned seenIds emit no duplicate. */
  function computeMilestoneEvents(buildingId, previousQuantity, nextQuantity, seenIds) {
    if (!validId(buildingId)) return { events: [], seenIds: uniqueIds(seenIds) };
    const previous = finiteNonNegative(previousQuantity, 0);
    const next = finiteNonNegative(nextQuantity, previous);
    const nextSeen = uniqueIds(seenIds);
    const events = [];
    if (next <= previous) return { events, seenIds: nextSeen };
    for (const milestone of MILESTONES) {
      const id = "milestone:" + buildingId + ":" + milestone.quantity;
      if (previous < milestone.quantity && next >= milestone.quantity && !nextSeen.includes(id)) {
        events.push({
          id,
          buildingId,
          quantity: milestone.quantity,
          multiplier: milestone.multiplier
        });
        nextSeen.push(id);
      }
    }
    return { events, seenIds: nextSeen.slice(-MAX_TRACKED_IDS) };
  }

  function recordBuildingMilestones(career, buildingId, previousQuantity, nextQuantity) {
    if (!career || !career.cycle) return [];
    const previous = nonNegativeInteger(previousQuantity, 0);
    const next = nonNegativeInteger(nextQuantity, previous);
    const purchased = Math.max(0, next - previous);
    if (validId(buildingId) && purchased > 0) {
      const purchases = career.cycle.buildingPurchaseCountsById || {};
      if (
        Object.prototype.hasOwnProperty.call(purchases, buildingId) ||
        Object.keys(purchases).length < MAX_TRACKED_IDS
      ) {
        purchases[buildingId] = Math.min(
          Number.MAX_SAFE_INTEGER,
          nonNegativeInteger(purchases[buildingId], 0) + purchased
        );
      }
      career.cycle.buildingPurchaseCountsById = purchases;
    }
    const result = computeMilestoneEvents(
      buildingId,
      previous,
      next,
      career.cycle.milestoneIds
    );
    career.cycle.milestoneIds = result.seenIds;
    return result.events;
  }

  function getModifiers(career) {
    const completed = career && career.completedRanks ? career.completedRanks : {};
    const permanent = {
      docMultiplier: 1 + nonNegativeInteger(completed.cadence, 0, MAX_RANK) * PERMANENT_BONUS_PER_RANK.cadenceDocMultiplier,
      ccMultiplier: 1 + nonNegativeInteger(completed.clientRelations, 0, MAX_RANK) * PERMANENT_BONUS_PER_RANK.clientCcMultiplier,
      qualityTargetOffset: nonNegativeInteger(completed.quality, 0, MAX_RANK) * PERMANENT_BONUS_PER_RANK.qualityTargetOffset,
      footprintDriftMultiplier: 1,
      buildingCostMultiplier: 1,
      contractRewardMultiplier: 1
    };
    const active = {
      docMultiplier: 1,
      ccMultiplier: 1,
      qualityTargetOffset: 0,
      footprintDriftMultiplier: 1,
      buildingCostMultiplier: 1,
      contractRewardMultiplier: 1
    };
    if (career && career.activePlan) {
      const rank = getRankDefinition(career.activePlan.id, career.activePlan.rank);
      if (rank && rank.modifiers) {
        for (const [key, value] of Object.entries(rank.modifiers)) {
          if (Number.isFinite(value) && Object.prototype.hasOwnProperty.call(active, key)) active[key] = value;
        }
      }
    }
    return {
      docMultiplier: permanent.docMultiplier * active.docMultiplier,
      ccMultiplier: permanent.ccMultiplier * active.ccMultiplier,
      qualityTargetOffset: permanent.qualityTargetOffset + active.qualityTargetOffset,
      footprintDriftMultiplier: active.footprintDriftMultiplier,
      buildingCostMultiplier: active.buildingCostMultiplier,
      contractRewardMultiplier: active.contractRewardMultiplier,
      permanent,
      active
    };
  }

  function assessPrestige(career, context) {
    const status = getPlanStatus(career, context || {});
    return {
      allowedByCareer: true,
      hasActivePlan: Boolean(status),
      planReady: Boolean(status && status.complete),
      willValidatePlan: Boolean(status && status.complete),
      willRestartPlan: Boolean(status && !status.complete),
      warningKey: status && !status.complete ? "career.prestige.planNotValidated" : null
    };
  }

  /**
   * Applies career consequences of a prestige after app.js has checked CC.
   * An incomplete Plan remains selected but restarts from step 1. It never
   * grants a rank or stamp. Active campaigns restart; active challenges fail.
   */
  function handlePrestige(career, context, options) {
    const now = validTimestamp(options && options.now, Date.now());
    const progress = updateProgress(career, context || {}, { now });
    const assessment = assessPrestige(career, context || {});
    const result = {
      progress,
      planCompleted: null,
      earlyPlanRestart: false,
      challengeFailed: null,
      campaignRestarted: null,
      conclusionUnlocked: progress.conclusionUnlocked
    };

    if (career.challenges.active) {
      result.challengeFailed = failActiveChallenge(career, "prestige", { now });
    }

    if (career.activePlan && assessment.planReady) {
      const id = career.activePlan.id;
      const rank = career.activePlan.rank;
      career.completedRanks[id] = Math.max(career.completedRanks[id], rank);
      result.planCompleted = {
        id,
        rank,
        stampId: "stamp:" + id + ":" + rank,
        reward: { culture: rank }
      };
      career.activePlan = null;
    } else if (career.activePlan) {
      career.activePlan.stepIndex = 0;
      career.activePlan.attempt = nonNegativeInteger(career.activePlan.attempt, 1) + 1;
      result.earlyPlanRestart = true;
    }

    const nextCycleId = nonNegativeInteger(career.cycle.id, 0) + 1;
    career.cycle = createCycle(nextCycleId, now);
    career.challenges.declinedThisCycleIds = [];
    career.challenges.failedThisCycleIds = [];
    career.started = true;

    if (career.activePlan) career.activePlan.baseline = captureBaseline(career);
    if (career.campaigns.active) {
      result.campaignRestarted = career.campaigns.active.id;
      career.campaigns.active.stepIndex = 0;
      career.campaigns.active.baseline = captureBaseline(career);
    }

    if (refreshConclusion(career, now)) result.conclusionUnlocked = true;
    result.stamps = getStampIds(career);
    result.modifiers = getModifiers(career);
    return result;
  }

  function getSummary(career, context) {
    return {
      schemaVersion: CAREER_SCHEMA_VERSION,
      started: Boolean(career.started),
      completedRanks: Object.assign({}, career.completedRanks),
      stampIds: getStampIds(career),
      stampCount: totalStamps(career),
      activePlan: career.activePlan ? {
        id: career.activePlan.id,
        rank: career.activePlan.rank,
        status: getPlanStatus(career, context || {})
      } : null,
      availablePlans: getAvailablePlans(career).map(item => ({ id: item.plan.id, rank: item.rank })),
      activeChallenge: career.challenges.active ? {
        id: career.challenges.active.id,
        status: getChallengeStatus(career, context || {})
      } : null,
      availableChallengeIds: getAvailableChallenges(career).map(item => item.id),
      completedChallengeIds: career.challenges.completedIds.slice(),
      activeCampaign: career.campaigns.active ? {
        id: career.campaigns.active.id,
        status: getCampaignStatus(career, context || {})
      } : null,
      availableCampaignIds: getAvailableCampaigns(career).map(item => item.id),
      campaignBadgeIds: getCampaignBadges(career),
      modifiers: getModifiers(career),
      conclusion: getConclusion(career)
    };
  }

  return {
    API_VERSION,
    CAREER_SCHEMA_VERSION,
    MAX_RANK,
    PLAN_IDS: PLAN_IDS.slice(),
    CHALLENGE_IDS: CHALLENGE_IDS.slice(),
    CAMPAIGN_IDS: CAMPAIGN_IDS.slice(),
    MILESTONES,
    PLAN_DEFINITIONS,
    CHALLENGE_DEFINITIONS,
    CAMPAIGN_DEFINITIONS,
    PERMANENT_BONUS_PER_RANK,
    CONCLUSION,
    createDefaultCareer,
    hydrateCareer,
    serializeCareer,
    captureBaseline,
    getPlanDefinition,
    getRankDefinition,
    getAvailablePlans,
    selectPlan,
    abandonPlan,
    getPlanStatus,
    isPlanReady,
    getAvailableChallenges,
    acceptChallenge,
    declineChallenge,
    failActiveChallenge,
    getChallengeStatus,
    getAvailableCampaigns,
    startCampaign,
    getCampaignStatus,
    updateProgress,
    recordContract,
    recordUpgradePurchased,
    getMilestoneMultiplier,
    getNextMilestone,
    computeMilestoneEvents,
    recordBuildingMilestones,
    totalStamps,
    getStampIds,
    getCampaignBadges,
    getModifiers,
    assessPrestige,
    handlePrestige,
    getConclusion,
    acknowledgeConclusion,
    getSummary,
    objectiveProgress
  };
});
