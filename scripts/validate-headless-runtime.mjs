#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const files = ["assets/js/persistence.js", "assets/js/modifier-utils.js", "assets/js/godmode-utils.js", "assets/js/economy-analytics.js", "assets/js/progression.js", "assets/js/investment-advice.js", "assets/js/endgame.js", "assets/js/achievements.js", "assets/js/events.js", ...["fr", "en", "de", "lb"].map(lang => "assets/i18n/" + lang + ".js"), "assets/js/app.js"];
const copy = value => JSON.parse(JSON.stringify(value));
const NOW = 1788796800000;
let checks = 0;
function test(label, run) { run(); checks += 1; console.log("✓ " + label); }
function runtime(saved = null, language = "fr", web = false) {
  let random = 123456789;
  let elapsed = 1;
  const math = Object.create(Math);
  math.random = () => { random = (1664525 * random + 1013904223) >>> 0; return random / 4294967296; };
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }
  const sandbox = { Date: ClockDate, Math: math };
  if (web) {
    const noop = () => {};
    const storage = new Map(saved ? [["papersEmpireSave", JSON.stringify(saved)]] : []);
    Object.assign(sandbox, {
      window: sandbox, performance: { now: () => elapsed },
      setTimeout: noop, clearTimeout: noop, setInterval: noop, requestAnimationFrame: noop,
      addEventListener: noop, dispatchEvent: noop, confirm: () => true,
      location: { search: "", pathname: "/", href: "https://papersempire.com/", hash: "" },
      history: { replaceState: noop }, URL, URLSearchParams,
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      document: { addEventListener: noop, activeElement: null, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {}, classList: { contains: () => false } } }
    });
  }
  const context = vm.createContext(sandbox);
  if (!web) vm.runInContext(readFileSync(new URL("assets/js/headless-runtime.js", ROOT), "utf8"), context);
  for (const file of files) {
    let source = readFileSync(new URL(file, ROOT), "utf8");
    if (web && file.endsWith("/app.js")) {
      // This is solely a browser test port, absent from production. The native
      // context below has no DOM or scheduler and executes unmodified sources.
      const close = source.lastIndexOf("})();");
      source = source.slice(0, close) + `
        renderPendingEventControl = () => {};
        host.__webParity = {
          init() { initGame(); currentLang = ${JSON.stringify(language)}; experienceMode = "playing"; showOfflineReport(); },
          tick(dt) { advanceSimulation(dt); renderAll(); return headlessSnapshot(); },
          snapshot: headlessSnapshot, save: buildPersistedState, command: gameCommand,
          openMinigame() { eventState.minigameCode = Events.startMinigame()?.code || null; }
        };
      ` + source.slice(close);
    }
    vm.runInContext(source, context, { filename: file });
  }
  const api = web ? context.__webParity : context.PEHeadless;
  const result = web ? api.init() : api.init(copy(saved), language);
  if (!web) assert.equal(result.ok, true, JSON.stringify(result));
  return { api, context, tick(dt) { elapsed += dt * 1000; return api.tick(dt); } };
}
function seed({ docs = 0, bank = docs, cc = 0, culture = 0, level = 0, legacy = false, event = null } = {}) {
  const fresh = runtime().api.save();
  fresh.resources = { docBank: bank, docTotal: docs, ccTotal: cc, culturePoints: culture };
  fresh.meta.startedAt = docs || level ? NOW - 1000 : null;
  fresh.lastSeen = NOW;
  if (level) for (const building of fresh.buildings) { building.quantity = level; building.isUnlocked = true; }
  if (event) fresh.events.pendingId = event;
  if (legacy) {
    delete fresh.version;
    fresh.stats.imageVbs = fresh.stats.brandImage; delete fresh.stats.brandImage;
    fresh.buildings.find(item => item.id === "clientPortal").id = "vbsPortal";
  }
  return fresh;
}
function state(api) { return copy(api.save()); }
function equivalent(native, web) {
  assert.deepEqual(state(native.api), state(web.api));
  const a = native.api.snapshot(), b = web.api.snapshot();
  for (const key of ["resources", "rates", "stats", "buildings", "upgrades", "career", "progression", "contracts", "objective", "achievements", "incident", "offlineReport"]) {
    assert.deepEqual(copy(a[key]), copy(b[key]), key);
  }
}

test("unmodified runtime runs without any browser, DOM, timer, storage, network or performance global", () => {
  const game = runtime();
  for (const name of ["window", "document", "navigator", "location", "localStorage", "fetch", "performance", "setTimeout", "requestAnimationFrame"]) assert.equal(vm.runInContext("typeof " + name, game.context), "undefined", name);
  assert.equal(game.api.snapshot().buildings.length, 12);
  assert.equal(game.api.snapshot().upgrades.length, 3);
  assert.equal(game.api.snapshot().progression.plans.length, 3);
  assert.equal(game.api.snapshot().progression.challenges.length, 3);
  assert.equal(game.api.snapshot().progression.campaigns.length, 3);
  assert.equal(game.api.snapshot().achievements.length, game.context.Achievements.definitions.length);
});

test("early web/native parity: first rewards, print, automation, unlocks, purchases, invalid commands", () => {
  const native = runtime(), web = runtime(null, "fr", true);
  equivalent(native, web);
  for (const command of [["unknown"], ["buyBuilding", { id: "offsetPress" }], ["buyUpgrade", { id: "upg_click_power_1" }]]) {
    const before = state(native.api);
    assert.equal(native.api.command(...command).ok, false);
    assert.deepEqual(state(native.api), before);
    web.api.command(...command);
  }
  for (let i = 0; i < 30; i++) { native.api.command("print"); web.api.command("print"); }
  for (const game of [native, web]) assert.equal(game.api.command("buyBuilding", { id: "reproOperator" }).ok, true);
  for (let i = 0; i < 10; i++) { native.tick(0.25); web.tick(0.25); }
  equivalent(native, web);
  assert.ok(native.api.snapshot().rates.docPerSecond > 0);
});

test("mid-game web/native parity: upgrades, Plan, challenge failure and confirmed abandonment", () => {
  const save = seed({ docs: 6000, bank: 9000, cc: 3000, level: 1 });
  const native = runtime(save), web = runtime(save, "fr", true);
  for (const [name, payload] of [["selectPlan", { id: "cadence" }], ["acceptChallenge", { id: "budgetFrozen" }], ["buyUpgrade", { id: "upg_click_power_1" }]]) {
    for (const game of [native, web]) assert.equal(game.api.command(name, payload).ok, true);
    equivalent(native, web);
  }
  assert.ok(native.api.save().career.challenges.failedThisCycleIds.includes("budgetFrozen"));
  const before = state(native.api);
  assert.equal(native.api.command("abandonPlan").error, "confirmation-required");
  assert.deepEqual(state(native.api), before);
  for (const game of [native, web]) assert.equal(game.api.command("abandonPlan", { confirmed: true }).ok, true);
  equivalent(native, web);
  assert.deepEqual(copy(native.api.save().resources), before.resources);
});

test("late web/native parity: 12 level-25 units, all modifiers, active Plan and prestige", () => {
  const save = seed({ docs: 5e7, bank: 1e7, cc: 5e6, culture: 36, level: 25 });
  const native = runtime(save), web = runtime(save, "fr", true);
  for (const game of [native, web]) assert.equal(game.api.command("selectPlan", { id: "quality" }).ok, true);
  for (let i = 0; i < 16; i++) { native.tick(0.125); web.tick(0.125); }
  equivalent(native, web);
  const before = state(native.api);
  assert.equal(native.api.command("prestige").error, "confirmation-required");
  assert.deepEqual(state(native.api), before);
  for (const game of [native, web]) assert.equal(game.api.command("prestige", { confirmed: true }).ok, true);
  equivalent(native, web);
  assert.ok(native.api.save().resources.culturePoints > 36);
  assert.ok(native.api.save().buildings.every(item => item.quantity === 0));
});

test("contracts preserve requirements, actual duration, clause failure, rewards and progression", () => {
  const save = seed({ docs: 6000, cc: 1000 });
  const native = runtime(save), web = runtime(save, "fr", true);
  assert.equal(native.api.command("startContract", { id: "governancePack" }).ok, false);
  for (const game of [native, web]) assert.equal(game.api.command("startContract", { id: "expressFlyer" }).ok, true);
  assert.equal(native.api.snapshot().contracts.active.duration, 45);
  for (let i = 0; i < 45; i++) { native.tick(1); web.tick(1); }
  equivalent(native, web);
  assert.equal(native.api.snapshot().contracts.active, null);
  assert.equal(native.api.save().analytics.currentRun.contractsCompleted, 1);
  assert.equal(native.api.save().analytics.currentRun.contractDocs, 600);
  assert.equal(native.api.save().analytics.currentRun.contractCc, 120);
  const count = native.api.save().analytics.currentRun.contractsCompleted;
  native.tick(1); assert.equal(native.api.save().analytics.currentRun.contractsCompleted, count);
});

test("choice incidents share the canonical effects and cannot be resolved twice", () => {
  for (const definition of runtime().context.Events.definitions.filter(item => item.type === "choice")) {
    for (const choice of definition.choices) {
      const save = seed({ docs: 10000, cc: 3000, event: definition.id });
      const native = runtime(save), web = runtime(save, "fr", true);
      assert.equal(native.api.snapshot().incident.id, definition.id);
      for (const game of [native, web]) assert.equal(game.api.command("eventChoice", { id: choice.id }).ok, true);
      equivalent(native, web);
      const before = state(native.api);
      assert.equal(native.api.command("eventChoice", { id: choice.id }).ok, false);
      assert.deepEqual(state(native.api), before);
    }
  }
});

test("calibration uses the actual generated code and real win/loss effects, with no browser prompt", () => {
  const event = runtime().context.Events.definitions.find(item => item.type === "minigame").id;
  for (const correct of [true, false]) {
    const save = seed({ docs: 10000, event });
    const native = runtime(save), web = runtime(save, "fr", true);
    assert.equal(native.api.command("minigameResponse", { answer: 1 }).ok, false);
    native.api.command("openIncident"); web.api.openMinigame();
    const code = native.api.snapshot().incident.minigame.code;
    assert.ok([1, 2, 3].includes(code));
    const answer = correct ? code : code % 3 + 1;
    for (const game of [native, web]) assert.equal(game.api.command("minigameResponse", { answer }).success, correct);
    equivalent(native, web);
  }
});

test("offline settlement and long frames keep web caps and never advance contracts", () => {
  const running = runtime(seed({ docs: 6000, level: 1 }));
  assert.equal(running.api.command("startContract", { id: "expressFlyer" }).ok, true);
  const save = running.api.save();
  const remaining = save.endgame.activeContract.timer;
  save.lastSeen = NOW - 20 * 3600 * 1000;
  const native = runtime(save), web = runtime(save, "fr", true);
  equivalent(native, web);
  assert.equal(native.api.snapshot().offlineReport.cappedSeconds, 8 * 3600);
  for (const game of [native, web]) {
    game.api.command("dismissOfflineReport");
    game.tick(3600);
  }
  equivalent(native, web);
  assert.equal(native.api.snapshot().contracts.active.remaining, remaining);
});

test("short absences credit silently while longer absences expose the shared report on both hosts", () => {
  for (const seconds of [120, 301]) {
    const save = seed({ docs: 6000, level: 1 });
    const baseline = runtime(save).api.snapshot();
    const expectedGain = baseline.rates.docPerSecond * seconds * 0.5;
    save.lastSeen = NOW - seconds * 1000;
    const native = runtime(save), web = runtime(save, "fr", true);
    equivalent(native, web);
    assert.equal(native.api.save().resources.docBank, baseline.resources.docBank + expectedGain);
    assert.equal(native.api.save().analytics.currentRun.offlineDocs, expectedGain);
    if (seconds === 120) assert.equal(native.api.snapshot().offlineReport, null);
    else {
      assert.equal(native.api.snapshot().offlineReport.elapsedSeconds, seconds);
      assert.equal(native.api.snapshot().offlineReport.earnedDocs, expectedGain);
    }
    for (const game of [native, web]) {
      game.api.command("dismissOfflineReport");
      game.tick(seconds);
      assert.equal(game.api.snapshot().offlineReport === null, seconds === 120);
    }
    equivalent(native, web);
  }
});

test("legacy aliases migrate in the same model and portable native saves roundtrip into web unchanged", () => {
  const native = runtime(seed({ docs: 1e6, cc: 10000, level: 10, legacy: true }));
  assert.equal(native.api.save().buildings.some(item => item.id === "vbsPortal"), false);
  assert.equal(native.api.save().stats.imageVbs, undefined);
  const portable = native.api.portableSave(); assert.equal(portable.ok, true);
  const parsed = native.api.previewImport(portable.raw); assert.equal(parsed.ok, true);
  assert.deepEqual(JSON.parse(parsed.raw), copy(parsed.save));
  const web = runtime(parsed.save, "fr", true);
  assert.deepEqual(state(web.api), state(native.api));
  const returned = runtime(web.api.save());
  assert.deepEqual(state(returned.api), state(native.api));
});

test("validated Plans award the same stamp, permanent bonus and Culture exactly once", () => {
  const save = seed({ docs: 5e7, cc: 1e6, culture: 36, level: 25 });
  const native = runtime(save), web = runtime(save, "fr", true);
  for (const game of [native, web]) assert.equal(game.api.command("selectPlan", { id: "cadence" }).ok, true);
  assert.equal(native.api.snapshot().progression.plans.find(item => item.id === "cadence").state, "ready");
  assert.equal(native.api.snapshot().progression.prestige.planGain, 1);
  for (const game of [native, web]) assert.equal(game.api.command("prestige", { confirmed: true }).ok, true);
  equivalent(native, web);
  assert.equal(native.api.save().career.completedRanks.cadence, 1);
  assert.equal(native.api.snapshot().career.stampCount, 1);
  const before = state(native.api);
  assert.equal(native.api.command("prestige", { confirmed: true }).ok, false);
  assert.deepEqual(state(native.api), before);
});

test("campaign priority, sequential dossiers and clause completion award the canonical badge", () => {
  const save = seed({ docs: 9000, cc: 2000, culture: 20 });
  save.buildings.find(item => item.id === "insertingLine").quantity = 5;
  save.buildings.find(item => item.id === "prepressStudio").quantity = 10;
  save.career.completedRanks.cadence = 3;
  save.stats = { quality: 0.9, footprint: 0.2, brandImage: 0.9 };
  const native = runtime(save), web = runtime(save, "fr", true);
  for (const game of [native, web]) {
    assert.equal(game.api.command("startCampaign", { id: "onboarding842" }).ok, true);
    assert.equal(game.api.command("startContract", { id: "onboardingKit" }).ok, true);
  }
  equivalent(native, web);
  const duration = native.api.snapshot().contracts.active.duration;
  assert.ok(duration < 75, "the real prepress reduction applies");
  for (let index = 0; index < duration; index++) { native.tick(1); web.tick(1); }
  equivalent(native, web);
  assert.equal(native.api.save().career.campaigns.active.stepIndex, 2,
    "the clause dossier starts after the named delivery and needs a later action");
  for (const game of [native, web]) assert.equal(game.api.command("startContract", { id: "onboardingKit" }).ok, true);
  for (let index = 0; index < duration; index++) { native.tick(1); web.tick(1); }
  equivalent(native, web);
  assert.ok(native.api.save().career.campaigns.completedIds.includes("onboarding842"));
  assert.ok(native.api.snapshot().career.campaignBadgeIds.includes("badgeOnboarding842"));
  assert.equal(native.api.command("startCampaign", { id: "onboarding842" }).ok, false);
});

test("the conclusion stays pending until all nine stamps and three campaigns, then acknowledges once", () => {
  const fresh = runtime();
  assert.equal(fresh.api.snapshot().progression.conclusion.title, fresh.api.translate("career.conclusion.pendingTitle"));
  assert.equal(fresh.api.snapshot().progression.conclusion.canAcknowledge, false);
  assert.equal(fresh.api.command("acknowledgeConclusion").ok, false);
  const save = seed({ docs: 1000, culture: 30 });
  for (const id of ["cadence", "quality", "clientRelations"]) save.career.completedRanks[id] = 3;
  save.career.campaigns.completedIds = ["onboarding842", "annualReportSeason", "confidentialMerger"];
  const native = runtime(save), web = runtime(save, "fr", true);
  assert.equal(native.api.snapshot().progression.conclusion.canAcknowledge, true);
  for (const game of [native, web]) assert.equal(game.api.command("acknowledgeConclusion").ok, true);
  equivalent(native, web);
  assert.equal(native.api.snapshot().progression.conclusion.canAcknowledge, false);
});

test("contract rerolls retain the real monotonic 30-second cooldown", () => {
  const game = runtime(seed({ docs: 6000 }));
  assert.equal(game.api.snapshot().contracts.canReroll, true);
  assert.equal(game.api.command("rerollContracts").ok, true);
  assert.equal(game.api.snapshot().contracts.rerollSeconds, 30);
  assert.equal(game.api.command("rerollContracts").ok, false);
  game.tick(29);
  assert.equal(game.api.snapshot().contracts.rerollSeconds, 1);
  assert.equal(game.api.command("rerollContracts").ok, false);
  game.tick(1);
  assert.equal(game.api.command("rerollContracts").ok, true);
});

test("archiving a pending incident and disabling incidents applies no choice or reward", () => {
  const game = runtime(seed({ docs: 10000, event: "paperShortage" }));
  const before = state(game.api);
  assert.equal(game.api.command("archiveIncident").ok, true);
  assert.equal(game.api.snapshot().incident, null);
  assert.deepEqual(copy(game.api.save().resources), before.resources);
  assert.deepEqual(copy(game.api.save().stats), before.stats);
  assert.equal(game.api.save().analytics.currentRun.eventsResolved, before.analytics.currentRun.eventsResolved);
  assert.equal(game.api.command("archiveIncident").ok, false);
  assert.equal(game.api.command("setEventsEnabled", { enabled: false }).ok, true);
  assert.equal(game.api.snapshot().eventsEnabled, false);
});

test("native import preview rejects malformed/oversize/prototype/future saves without changing the running game", () => {
  const game = runtime(seed({ docs: 900 }));
  const before = state(game.api);
  const malformed = ["", "{", '{"resources":{"docBank":1,"docTotal":1},"__proto__":{}}', JSON.stringify({ ...before, version: 99 }), "é".repeat(1100000)];
  for (const raw of malformed) assert.equal(game.api.previewImport(raw).ok, false);
  assert.deepEqual(state(game.api), before);
  assert.equal(game.api.init(null, "fr").reason, "already-initialized");
  assert.equal(game.tick(NaN).reason, "invalid-delta");
  assert.deepEqual(state(game.api), before);
});

test("all four catalogues interpolate native objectives and snapshots remain detached", () => {
  const names = new Set();
  for (const language of ["fr", "en", "de", "lb"]) {
    const game = runtime(null, language);
    names.add(game.api.snapshot().buildings[0].name);
    const text = game.api.translate("mobile.purchaseHint", { name: "UNIT", cost: 42, gain: 3 });
    assert.ok(text.includes("UNIT") && text.includes("42") && text.includes("3"));
    assert.ok(!/\{\{|career\.plan\./.test(game.api.snapshot().objective.description + game.api.snapshot().progression.plans.map(item => item.name).join(" ")));
    const snapshot = game.api.snapshot(); snapshot.buildings[0].quantity = 999; snapshot.resources.docBank = 999;
    assert.equal(game.api.save().buildings[0].quantity, 0);
    assert.equal(game.api.save().resources.docBank, 0);
  }
  assert.ok(names.size >= 3);
});
console.log(`Headless canonical engine: ${checks} behavioral checks passed.`);
