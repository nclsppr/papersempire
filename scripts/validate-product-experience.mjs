#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const copy = value => JSON.parse(JSON.stringify(value));
const NOW = Date.now();
let checks = 0;
const failures = [];
function test(name, run) {
  try { run(); checks += 1; }
  catch (error) { failures.push(name + ": " + error.message); }
}
async function testAsync(name, run) {
  try { await run(); checks += 1; }
  catch (error) { failures.push(name + ": " + error.message); }
}

// Execute the real application in an isolated VM. Only its browser presentation,
// scheduler and persistence ports are replaced. Commands, initial save migration,
// economy, career rules, snapshots and event hooks remain the production code.
// The test-only seam is inserted inside the IIFE; no test globals ship to players.
function application(saved = null) {
  const events = [];
  const noOp = () => {};
  const storage = new Map();
  const sandbox = {
    console, Date: class extends Date { static now() { return NOW; } }, Math, Promise, URL, URLSearchParams, Intl,
    setTimeout: noOp, clearTimeout: noOp, setInterval: noOp, clearInterval: noOp,
    requestAnimationFrame: noOp, cancelAnimationFrame: noOp,
    performance: { now: () => 0 },
    location: { search: "", pathname: "/", hash: "", href: "https://papersempire.com/" },
    history: { replaceState: noOp },
    document: {
      addEventListener: noOp, getElementById: () => null, querySelector: () => null,
      querySelectorAll: () => [], activeElement: null,
      documentElement: { lang: "fr", dataset: {}, classList: { toggle: noOp } },
      body: { dataset: {}, classList: { toggle: noOp } }
    },
    addEventListener: noOp, dispatchEvent: noOp,
    confirm: () => false,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
    },
    Persistence: { load: () => copy(saved), isAvailable: () => false },
    PEEngagement: { record: name => events.push(name), setPlaying: noOp, configure: noOp, isEnabled: () => false }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ["modifier-utils.js", "godmode-utils.js", "economy-analytics.js", "progression.js", "investment-advice.js"]) {
    vm.runInContext(readFileSync(new URL("../assets/js/" + file, import.meta.url), "utf8"), sandbox, { filename: file });
  }
  const source = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");
  const closure = source.lastIndexOf("})();");
  assert.ok(closure > 0, "app IIFE must provide the isolated test entry point");
  const seam = `
    renderAll = () => {};
    logMessage = () => {};
    announceStatus = () => {};
    showOfflineReport = () => {};
    showBuildingFeedback = () => {};
    showEventBanner = () => {};
    notifyScene = () => {};
    applyExperienceMode = () => {};
    t = key => key;
    window.__productTest = {
      initGame, gameState, DOM, handleCareerAction, tickContracts, initOfflineControls, initProductExperience,
      get career() { return careerState; },
      get analytics() { return analyticsState; },
      get started() { return experienceStarted; },
      set started(value) { experienceStarted = value; },
      languageForTest(value) { currentLang = value; },
      economy: buildEconomyState,
      rate: computeDocPerSecond,
      goal: adviceGoal
    };
  `;
  vm.runInContext(source.slice(0, closure) + seam + source.slice(closure), sandbox, { filename: "app.js" });
  sandbox.__productTest.initGame();
  return { sandbox, model: sandbox.__productTest, game: sandbox.__PE_GAME__, events,
    Progression: sandbox.ProgressionModule, Advice: sandbox.PEInvestmentAdvice, Economy: sandbox.EconomyAnalytics };
}

function fundedSave(overrides = {}) {
  return {
    version: 3, savedAt: NOW, lastSeen: NOW, meta: { startedAt: NOW },
    resources: { docBank: 5000, docTotal: 5000, ccTotal: 0, culturePoints: 0 },
    buildings: [], upgrades: [], ...overrides
  };
}

test("building bridge refuses unknown, locked and unaffordable units without mutation", () => {
  const { game, model, events } = application(fundedSave());
  const workshop = model.gameState.buildings.find(item => item.id === "reproWorkshop");
  workshop.isUnlocked = false;
  for (const id of ["missing", "reproWorkshop"]) {
    const before = copy(game.getSave());
    assert.equal(game.command("buyBuilding", { id }).ok, false);
    assert.deepEqual(copy(game.getSave()), before);
  }
  model.gameState.resources.docBank = 14;
  assert.equal(game.command("buyBuilding", { id: "reproOperator" }).ok, false);
  assert.equal(model.gameState.resources.docBank, 14);
  assert.equal(model.gameState.buildings[0].quantity, 0);
  assert.deepEqual(events, []);
});

test("invalid purchase from the introduction must not start a game or a measured session", () => {
  const { game, model, events } = application();
  assert.equal(game.command("buyBuilding", { id: "missing" }).ok, false);
  assert.equal(model.started, false);
  assert.deepEqual(events, []);
});

test("upgrade bridge reports rejected unknown, locked, unaffordable and purchased actions", () => {
  const { game, model } = application(fundedSave());
  const state = model.gameState;
  const id = "upg_click_power_1";
  assert.equal(game.command("buyUpgrade", { id: "missing" }).ok, false, "unknown upgrade");
  state.resources.docTotal = 149;
  assert.equal(game.command("buyUpgrade", { id }).ok, false, "locked upgrade");
  state.resources.docTotal = 5000;
  state.resources.docBank = 199;
  assert.equal(game.command("buyUpgrade", { id }).ok, false, "unaffordable upgrade");
  state.resources.docBank = 200;
  assert.equal(game.command("buyUpgrade", { id }).ok, true, "valid upgrade");
  assert.equal(state.resources.docBank, 0);
  assert.equal(state.upgrades[0].purchased, true);
  assert.equal(game.command("buyUpgrade", { id }).ok, false, "already purchased upgrade");
});

test("prestige bridge reports locked and cancelled actions without spending or resets", () => {
  const { game, model } = application(fundedSave());
  const before = copy(game.getSave());
  assert.equal(game.command("prestige").ok, false, "locked prestige");
  assert.deepEqual(copy(game.getSave()), before);
  model.gameState.resources.ccTotal = 10000;
  assert.equal(game.command("prestige").ok, false, "confirmation cancelled");
  assert.equal(model.gameState.resources.ccTotal, 10000);
  assert.equal(model.gameState.resources.culturePoints, 0);
});

test("plan bridge reports unknown selection without claiming success", () => {
  const { game, model } = application(fundedSave());
  assert.equal(game.command("selectPlan", { id: "missing" }).ok, false);
  assert.equal(model.career.activePlan, null);
  assert.equal(game.command("selectPlan", { id: "quality" }).ok, true, "valid selection does not depend on a rendered button");
  assert.equal(model.career.activePlan.id, "quality");
  assert.equal(game.command("selectPlan", { id: "cadence" }).ok, false, "an active Plan cannot be silently replaced");
  assert.equal(model.career.activePlan.id, "quality");
});

test("confirmed prestige reports success and credits one validated Plan reward", () => {
  const { game, model, Progression, sandbox, events } = application(fundedSave());
  game.command("selectPlan", { id: "cadence" });
  model.career.activePlan.stepIndex = Progression.getRankDefinition("cadence", 1).objectives.length;
  model.gameState.resources.ccTotal = 10000;
  sandbox.confirm = () => true;
  assert.equal(game.command("prestige").ok, true);
  assert.equal(model.gameState.resources.ccTotal, 0);
  assert.equal(model.gameState.resources.docBank, 0);
  assert.equal(model.gameState.resources.culturePoints, 4, "three base Culture plus one Plan Culture");
  assert.equal(Progression.totalStamps(model.career), 1);
  assert.deepEqual(events, ["first_plan"]);
  assert.equal(game.command("prestige").ok, false);
  assert.equal(model.gameState.resources.culturePoints, 4);
});

test("contract observation occurs only after the real contract completes", () => {
  const { model, sandbox, events } = application(fundedSave());
  vm.runInContext(readFileSync(new URL("../assets/js/endgame.js", import.meta.url), "utf8"), sandbox, { filename: "endgame.js" });
  const contracts = sandbox.EndgameModule;
  assert.equal(contracts.startContract("expressFlyer", model.gameState).ok, true);
  model.tickContracts(1);
  assert.deepEqual(events, []);
  model.tickContracts(44);
  assert.deepEqual(events, ["first_contract"]);
  assert.equal(model.analytics.currentRun.contractsCompleted, 1);
  assert.equal(model.gameState.resources.docBank, 5600);
  assert.equal(model.gameState.resources.ccTotal, 120);
  model.tickContracts(60);
  assert.deepEqual(events, ["first_contract"], "an already collected contract must not be observed again");
});

test("offline update requires a positively acknowledged save and performs one write", () => {
  const { model, sandbox } = application(fundedSave());
  const nodes = new Map();
  for (const id of ["offlineSettings", "offlineInstallStatus", "applyOfflineUpdate", "prepareOffline", "checkOfflineUpdate", "installGame"]) {
    nodes.set(id, { addEventListener(name, callback) { this[name] = callback; } });
  }
  sandbox.document.getElementById = id => nodes.get(id) || null;
  let flushed;
  sandbox.PEOffline = {
    getState: () => ({ supported: true, phase: "ready", updateReady: true, hasReadableSave: true }),
    applyUpdate: guard => { flushed = guard(); }
  };
  model.initOfflineControls();
  for (const saveResult of [false, undefined, null, true]) {
    let writes = 0;
    sandbox.Persistence.save = () => { writes += 1; return saveResult; };
    nodes.get("applyOfflineUpdate").click();
    assert.equal(flushed, saveResult === true);
    assert.equal(writes, 1, "flush must not perform a second conflicting autosave");
  }
});

test("guide links open production, units or career according to their real destination", () => {
  for (const [hash, expected] of [["#printStation", "production"], ["#buildingsPanel", "units"], ["#upgradesPanel", "career"]]) {
    const { model, sandbox } = application();
    const opened = [];
    sandbox.location.search = "?guide=validated-guide";
    sandbox.location.hash = hash;
    sandbox.PEMobileExperience = { init() {}, openPanel: id => opened.push(id) };
    sandbox.setTimeout = (callback, delay) => { if (delay === 50) callback(); };
    model.initProductExperience();
    assert.equal(model.started, true);
    assert.deepEqual(opened, [expected]);
  }
});

test("successful first producer spends the real cost and unlocks positive production", () => {
  const { game, model, events } = application(fundedSave());
  assert.equal(model.rate(), 0);
  assert.equal(game.command("buyBuilding", { id: "reproOperator" }).ok, true);
  assert.equal(model.gameState.resources.docBank, 4985);
  assert.equal(model.gameState.resources.docTotal, 5000, "spending is not lost lifetime output");
  assert.equal(model.gameState.buildings[0].quantity, 1);
  assert.ok(model.rate() > 0);
  assert.deepEqual(events, ["first_automation"]);
});

test("modifier-only purchase does not report first automation without a producer", () => {
  const { game, model, events } = application(fundedSave());
  const finishing = model.gameState.buildings.find(item => item.id === "finishingWorkshop");
  finishing.isUnlocked = true;
  assert.equal(game.command("buyBuilding", { id: finishing.id }).ok, true);
  assert.equal(finishing.quantity, 1);
  assert.equal(model.rate(), 0);
  assert.deepEqual(events, []);
});

test("imported automatic production does not become a new first automation on the next purchase", () => {
  const { game, model, events } = application(fundedSave({ buildings: [{ id: "reproOperator", quantity: 1 }] }));
  assert.ok(model.rate() > 0);
  assert.equal(game.command("buyBuilding", { id: "reproOperator" }).ok, true);
  assert.deepEqual(events, []);
});

test("public snapshot is detached from the live model and serialized save", () => {
  const { game, model } = application(fundedSave({ buildings: [{ id: "reproOperator", quantity: 3 }] }));
  const snapshot = game.getSnapshot();
  snapshot.resources.docBank = 0;
  snapshot.buildings[0].quantity = 999;
  snapshot.stats.quality = 0;
  snapshot.savedCareer.completedRanks.cadence = 3;
  assert.equal(model.gameState.resources.docBank, 5000);
  assert.equal(model.gameState.buildings[0].quantity, 3);
  assert.equal(model.gameState.stats.quality, 0.5);
  assert.equal(model.career.completedRanks.cadence, 0);
});

test("abandoning a Plan preserves earned ranks, Culture, badges and cycle progress", () => {
  const { Progression } = application();
  const career = Progression.createDefaultCareer({ now: NOW, started: true });
  career.completedRanks.cadence = 1;
  career.completedRanks.clientRelations = 2;
  career.challenges.completedIds = ["budgetFrozen"];
  career.campaigns.completedIds = ["onboarding842"];
  Progression.recordContract(career, { id: "expressFlyer", clauseSucceeded: true });
  assert.equal(Progression.selectPlan(career, "quality", { now: NOW }).ok, true);
  assert.equal(Progression.acceptChallenge(career, "zeroReturns", { now: NOW }).ok, true);
  const earned = {
    ranks: copy(career.completedRanks), stamps: Progression.totalStamps(career),
    cycle: copy(career.cycle), completed: copy(career.challenges.completedIds),
    campaigns: copy(career.campaigns), modifiers: copy(Progression.getModifiers(career).permanent)
  };
  assert.equal(Progression.abandonPlan(career).ok, true);
  assert.equal(career.activePlan, null);
  assert.equal(career.challenges.active, null);
  assert.equal(career.challenges.attempts.at(-1).outcome, "failed");
  assert.equal(career.challenges.attempts.at(-1).reason, "plan-abandoned");
  assert.deepEqual(copy(career.challenges.failedThisCycleIds), ["zeroReturns"]);
  assert.deepEqual(copy(career.completedRanks), earned.ranks);
  assert.equal(Progression.totalStamps(career), earned.stamps);
  assert.deepEqual(copy(career.cycle), earned.cycle);
  assert.deepEqual(copy(career.challenges.completedIds), earned.completed);
  assert.deepEqual(copy(career.campaigns), earned.campaigns);
  assert.deepEqual(copy(Progression.getModifiers(career).permanent), earned.modifiers);
  assert.equal(Progression.getModifiers(career).active.docMultiplier, 1, "abandoned Plan effects end immediately");
  assert.equal(Progression.getModifiers(career).active.qualityTargetOffset, 0);
  const noPlan = copy(career);
  assert.equal(Progression.abandonPlan(career).ok, false);
  assert.deepEqual(copy(career), noPlan, "repeated abandonment must not add failures");
  assert.equal(Progression.selectPlan(career, "clientRelations", { now: NOW + 1 }).ok, true);
});

test("abandoning a completed unvalidated Plan does not award its stamp or Culture", () => {
  const { Progression, model, game } = application(fundedSave());
  assert.equal(Progression.selectPlan(model.career, "cadence", { now: NOW }).ok, true);
  model.career.activePlan.stepIndex = Progression.getRankDefinition("cadence", 1).objectives.length;
  const resources = copy(model.gameState.resources);
  assert.equal(Progression.abandonPlan(model.career).ok, true);
  assert.equal(Progression.totalStamps(model.career), 0);
  assert.deepEqual(copy(game.getSave().resources), resources);
});

test("the application asks for abandonment confirmation and preserves resources on either choice", () => {
  const { Progression, model, game, sandbox } = application(fundedSave());
  Progression.selectPlan(model.career, "quality", { now: NOW });
  Progression.acceptChallenge(model.career, "zeroReturns", { now: NOW });
  const event = { target: { closest: selector => selector === "[data-career-abandon]" ? {} : null } };
  const before = copy(game.getSave());
  model.handleCareerAction(event);
  assert.deepEqual(copy(game.getSave()), before, "cancelled confirmation preserves the entire save");
  sandbox.confirm = () => true;
  model.handleCareerAction(event);
  assert.equal(model.career.activePlan, null);
  assert.equal(model.career.challenges.active, null);
  assert.equal(model.career.challenges.attempts.at(-1).reason, "plan-abandoned");
  assert.deepEqual(copy(game.getSave().resources), before.resources);
});

test("objective advice follows the active Plan before a simultaneous campaign", () => {
  const { Progression, model, game } = application(fundedSave());
  model.career.completedRanks.clientRelations = 3;
  assert.equal(Progression.selectPlan(model.career, "quality", { now: NOW }).ok, true);
  assert.equal(Progression.startCampaign(model.career, "onboarding842", { now: NOW }).ok, true);
  const prepress = model.gameState.buildings.find(item => item.id === "prepressStudio");
  prepress.isUnlocked = true;
  const snapshot = game.getSnapshot();
  assert.equal(snapshot.objective.goal.buildingId, "prepressStudio");
  assert.equal(snapshot.advice.id, "prepressStudio");
  assert.equal(snapshot.advice.canBuy, false, "an objective may advise saving for an unlocked unit");
});

// These alternatives describe distinct useful outcomes, including a pure CC
// multiplier. Assertions check user goals rather than restating the comparator.
test("investment goals distinguish production, client confidence and improving gauges", () => {
  const { Advice } = application();
  const rows = [
    { id: "press", isUnlocked: true, status: "exact", currentCost: 100, marginalDocPerSecond: 12, marginalCcPerSecond: 1, qualityDelta: 0, footprintDelta: 0.01, brandDelta: 0 },
    { id: "bridge", isUnlocked: true, status: "estimated", currentCost: 100, marginalDocPerSecond: 0, marginalCcPerSecond: 5, qualityDelta: 0.001, footprintDelta: -0.001, brandDelta: 0.005 },
    { id: "quality", isUnlocked: true, status: "estimated", currentCost: 100, marginalDocPerSecond: 0, marginalCcPerSecond: 0, qualityDelta: 0.02, footprintDelta: -0.002, brandDelta: 0.001 },
    { id: "recycling", isUnlocked: true, status: "estimated", currentCost: 100, marginalDocPerSecond: 0, marginalCcPerSecond: 0, qualityDelta: 0, footprintDelta: -0.04, brandDelta: 0 },
    { id: "locked", isUnlocked: false, status: "exact", currentCost: 1, marginalDocPerSecond: 999, marginalCcPerSecond: 999, qualityDelta: 999 },
    { id: "unknown", status: "unavailable", currentCost: 1, marginalDocPerSecond: 999 }
  ];
  assert.equal(Advice.recommend(rows, "docs").row.id, "press");
  assert.equal(Advice.recommend(rows, "cc").row.id, "bridge");
  assert.equal(Advice.recommend(rows, "quality").row.id, "quality");
  assert.equal(Advice.recommend(rows, "footprint").row.id, "recycling");
  assert.equal(Advice.recommend(rows, "objective", { resource: "ccTotal" }).row.id, "bridge");
  assert.equal(Advice.recommend(rows, "objective", { stat: "quality" }).row.id, "quality");
  assert.equal(Advice.recommend(rows, "objective", { stat: "brandImage" }).row.id, "bridge");
  assert.equal(Advice.recommend(rows, "objective", { buildingId: "recycling" }).row.id, "recycling");
  assert.equal(Advice.recommend([], "docs"), null);
  assert.equal(Advice.recommend([rows[1]], "docs"), null, "zero DOC gain is not a production recommendation");
});

test("advice consumes real economy rows, including pure confidence and footprint effects", () => {
  const { model, Economy, Advice } = application(fundedSave({ buildings: [{ id: "offsetPress", quantity: 1 }] }));
  model.gameState.buildings.forEach(item => { item.isUnlocked = true; });
  const state = model.economy();
  const rows = Economy.buildInvestmentRows(state);
  const bridge = rows.find(item => item.id === "comBridge");
  assert.equal(bridge.marginalDocPerSecond, 0);
  assert.ok(bridge.marginalCcPerSecond > 0);
  assert.equal(Advice.recommend([bridge], "cc").row.id, "comBridge");
  assert.equal(Advice.recommend([bridge], "docs"), null);
  assert.equal(Advice.recommend(rows, "objective", { buildingId: "digitalPress" }).row.id, "digitalPress");
  const footprint = Advice.recommend(rows, "footprint");
  assert.ok(footprint.row.footprintDelta < 0, "footprint advice must reduce its projected change");
  const quality = Advice.recommend(rows, "quality");
  assert.ok(quality.row.qualityDelta > 0);
  const before = copy(state);
  Advice.recommend(rows, "objective", { resource: "ccTotal" });
  assert.deepEqual(copy(state), before, "recommendations never buy a unit or mutate simulation input");
});

// Minimal document tree with actual descendant selection and click bubbling.
// This deliberately includes <html data-mobile-panel>, ordinary guide links
// and a generated download outside the nav, reproducing the ancestor trap.
function mobileDocument() {
  class Node {
    constructor(tag, attributes = {}) {
      this.tag = tag;
      this.attributes = { ...attributes };
      this.dataset = {};
      this.children = [];
      this.listeners = new Map();
      this.textContent = "";
      for (const [key, value] of Object.entries(attributes)) if (key.startsWith("data-")) this.dataset[this.dataKey(key)] = value;
      const classes = new Set((attributes.class || "").split(" ").filter(Boolean));
      this.classList = { contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key), toggle(key, value) { if (value ?? !classes.has(key)) classes.add(key); else classes.delete(key); } };
    }
    dataKey(key) { return key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parent = this; } }
    getAttribute(key) { return key.startsWith("data-") ? this.dataset[this.dataKey(key)] ?? null : this.attributes[key] ?? null; }
    setAttribute(key, value) { if (key.startsWith("data-")) this.dataset[this.dataKey(key)] = String(value); else this.attributes[key] = String(value); }
    removeAttribute(key) { if (key.startsWith("data-")) delete this.dataset[this.dataKey(key)]; else delete this.attributes[key]; }
    addEventListener(type, callback) { const list = this.listeners.get(type) || []; list.push(callback); this.listeners.set(type, list); }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    contains(node) { return this === node || this.descendants().includes(node); }
    get isConnected() { return this.tag === "document" || Boolean(this.parent?.isConnected); }
    matches(selector) {
      if (selector.includes(",")) return selector.split(",").some(part => this.matches(part.trim()));
      if (selector.endsWith(":not(:disabled)")) return !this.disabled && this.matches(selector.slice(0, -":not(:disabled)".length));
      if (selector.startsWith("#")) return this.getAttribute("id") === selector.slice(1);
      if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
      const parsed = selector.match(/^([a-z]+)?(?:\[([\w-]+)(?:(\^?=)['"]?([^'"\]]*)['"]?)?\])?$/);
      if (!parsed) throw new Error("DOM fixture does not implement selector: " + selector);
      const [, tag, key, comparison, expected] = parsed;
      if (tag && this.tag !== tag) return false;
      if (!key) return true;
      const value = this.getAttribute(key);
      return value !== null && (!comparison || (comparison === "^=" ? value.startsWith(expected) : value === expected));
    }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
    querySelectorAll(selector) {
      if (selector.includes(",")) return [...new Set(selector.split(",").flatMap(part => this.querySelectorAll(part.trim())))];
      const parts = selector.trim().split(/\s+/);
      const target = parts.pop();
      return this.descendants().filter(node => {
        if (!node.matches(target)) return false;
        let ancestor = node.parent;
        for (let index = parts.length - 1; index >= 0; index--) {
          while (ancestor && !ancestor.matches(parts[index])) ancestor = ancestor.parent;
          if (!ancestor) return false;
          ancestor = ancestor.parent;
        }
        return true;
      });
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    focus() { this.focused = true; let root = this; while (root.parent) root = root.parent; root.activeElement = this; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, height: 0, width: 0 }; }
    scrollIntoView() {}
    click(target = this) {
      const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      for (let node = target; node; node = node.parent) for (const callback of node.listeners.get("click") || []) callback(event);
      return event;
    }
  }
  const document = new Node("document");
  const html = new Node("html");
  const body = new Node("body");
  const nav = new Node("nav", { class: "mobile-game-nav" });
  const units = new Node("a", { "data-mobile-panel": "units", href: "#buildingsPanel" });
  const navLabel = new Node("span");
  units.append(navLabel);
  nav.append(units, new Node("a", { "data-mobile-panel": "production", href: "#printStation" }));
  const guide = new Node("a", { href: "/guides/real-help/" });
  const external = new Node("a", { href: "https://papersempire.com/en/guides/real-help/" });
  const download = new Node("a", { href: "blob:save-download", download: "papers-empire.papersempire" });
  const hint = new Node("p", { id: "nextPurchaseText" });
  body.append(nav, guide, external, download, hint);
  for (const id of ["printStation", "buildingsPanel", "dispatchPanel", "strategyPanel", "progressPanel"]) body.append(new Node("section", { id }));
  html.append(body);
  document.append(html);
  document.documentElement = html;
  document.body = body;
  document.getElementById = id => document.descendants().find(node => node.getAttribute("id") === id) || null;
  return { Node, document, html, body, units, navLabel, guide, external, download, hint };
}

test("mobile navigation handles its own links without cancelling guide or download clicks", () => {
  const { game, sandbox } = application(fundedSave());
  const dom = mobileDocument();
  sandbox.document = dom.document;
  const expanded = [];
  vm.runInContext(readFileSync(new URL("../assets/js/mobile-experience.js", import.meta.url), "utf8"), sandbox, { filename: "mobile-experience.js" });
  sandbox.PEMobileExperience.init({ game: { ...game, expandPanel: id => expanded.push(id) }, translate: key => key });
  assert.equal(dom.html.dataset.mobilePanel, "production");
  assert.equal((dom.html.listeners.get("click") || []).length, 0, "the HTML state attribute must not turn the page into a nav control");
  assert.equal((dom.body.listeners.get("click") || []).length, 0);
  assert.equal(dom.html.getAttribute("aria-current"), null);
  for (const link of [dom.guide, dom.external, dom.download]) assert.equal(link.click().defaultPrevented, false, link.getAttribute("href") + " must retain its normal click action");
  assert.equal(dom.units.click(dom.navLabel).defaultPrevented, true, "a child click in the real nav is handled");
  assert.equal(dom.html.dataset.mobilePanel, "units");
  assert.equal(dom.units.getAttribute("aria-current"), "page");
  assert.ok(expanded.includes("buildingsPanel"));
  assert.equal(dom.html.getAttribute("aria-current"), null, "selection state belongs only to actual nav controls");
  assert.equal(dom.download.click().defaultPrevented, false, "download still works after changing panel");
});

test("real translated purchase hints interpolate values in all four languages", () => {
  const { game, model, sandbox } = application(fundedSave());
  for (const locale of ["fr", "en", "de", "lb"]) vm.runInContext(readFileSync(new URL("../assets/i18n/" + locale + ".js", import.meta.url), "utf8"), sandbox, { filename: locale + ".js" });
  const dom = mobileDocument();
  sandbox.document = dom.document;
  vm.runInContext(readFileSync(new URL("../assets/js/mobile-experience.js", import.meta.url), "utf8"), sandbox, { filename: "mobile-experience.js" });
  sandbox.PEMobileExperience.init({ game: { ...game, expandPanel() {} }, translate: game.translate });
  for (const locale of ["fr", "en", "de", "lb"]) {
    model.languageForTest(locale);
    const tokens = { name: "Atelier QA", cost: "123,4", gain: "5,6", cc: "7,8" };
    const mobile = game.translate("mobile.purchaseHint", tokens);
    assert.equal(mobile, "Atelier QA · 123,4 DOC · +5,6 DOC/s · +7,8 CC/s", locale);
    for (const key of ["offline.purchaseReady", "offline.purchaseNext"]) {
      const translated = game.translate(key, tokens);
      assert.ok(translated.includes(tokens.name) && translated.includes(tokens.cost), locale + " " + key);
      assert.ok(!translated.includes("{") && !translated.includes("}"), locale + " " + key + " has no literal tokens");
    }
    sandbox.PEMobileExperience.render();
    const advice = game.getSnapshot().advice;
    const expected = game.translate("mobile.purchaseHint", { name: advice.name, cost: game.format(advice.cost), gain: game.format(advice.docGain), cc: game.format(advice.ccGain) });
    assert.equal(dom.hint.textContent, expected, locale + " actual mobile renderer uses the real translator");
    assert.ok(!dom.hint.textContent.includes("{") && !dom.hint.textContent.includes("}"));
  }
});

test("tutorial coaching keeps the real action accessible and repositions after restored scroll", () => {
  const { sandbox } = application();
  const dom = mobileDocument();
  const markup = readFileSync(new URL("../index.html", import.meta.url), "utf8").match(/<div\b[^>]*id="tutorialOverlay"[^>]*>/)?.[0];
  assert.ok(markup, "the real tutorial container is present");
  const attributes = Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  const overlay = new dom.Node("div", attributes);
  const card = new dom.Node("div", { class: "tutorial-card" });
  const title = new dom.Node("h3", { id: "tutorialTitle" });
  const body = new dom.Node("p", { id: "tutorialBody" });
  const label = new dom.Node("div", { id: "tutorialStep" });
  const next = new dom.Node("button", { id: "tutorialNext" });
  const prev = new dom.Node("button", { id: "tutorialPrev" });
  const skip = new dom.Node("button", { id: "tutorialSkip" });
  card.append(title, body, label, next, prev, skip);
  overlay.append(card);
  dom.body.append(overlay);
  const header = new dom.Node("header", { class: "app-header" });
  const print = new dom.Node("button", { id: "clickButton", "aria-describedby": "existingHelp" });
  const buildings = new dom.Node("div", { id: "buildingsList" });
  const buy = new dom.Node("button", { "data-building-btn": "reproOperator" });
  buildings.append(buy);
  dom.body.append(header, print, buildings);
  let scrollY = 1492;
  let cardTop = 593;
  const targetRect = () => ({ left: 24, right: 366, top: 1500 - scrollY, bottom: 1600 - scrollY, height: 100, width: 342 });
  print.getBoundingClientRect = targetRect;
  buildings.getBoundingClientRect = targetRect;
  buy.getBoundingClientRect = targetRect;
  card.getBoundingClientRect = () => ({ top: cardTop, bottom: 832, left: 12, right: 378, height: 832 - cardTop });
  header.getBoundingClientRect = () => ({ top: 0, bottom: 124, left: 0, right: 390, height: 124 });
  const positioning = [];
  print.scrollIntoView = options => { positioning.push(options); scrollY = 1500 - (844 - 100) / 2; };
  buildings.scrollIntoView = print.scrollIntoView;
  dom.document.activeElement = dom.guide;
  sandbox.document = dom.document;
  sandbox.innerHeight = 844;
  sandbox.scrollBy = options => { positioning.push(options); scrollY += options.top; };
  const frames = new Map();
  let frameId = 0;
  sandbox.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  sandbox.cancelAnimationFrame = id => frames.delete(id);
  const frame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
  const windowEvents = new Map();
  sandbox.addEventListener = (name, callback) => { const handlers = windowEvents.get(name) || []; handlers.push(callback); windowEvents.set(name, handlers); };
  const sendWindowEvent = name => (windowEvents.get(name) || []).forEach(callback => callback());
  let timers = 0;
  sandbox.setTimeout = () => { timers++; };
  vm.runInContext(readFileSync(new URL("../assets/js/tutorial.js", import.meta.url), "utf8"), sandbox, { filename: "tutorial.js" });
  (dom.document.listeners.get("DOMContentLoaded") || []).forEach(callback => callback());
  const prefs = { tutorialEnabled: true, tutorialCompleted: false };
  sandbox.Tutorial.configure({
    steps: [{ selector: "#clickButton", milestone: "click", titleKey: "print-title", bodyKey: "print-body" }, { selector: "#buildingsList", milestone: "building", titleKey: "buy-title", bodyKey: "buy-body" }],
    settings: { getPrefs: () => prefs, setPreference: (key, value) => { prefs[key] = value; } },
    autoStart: true
  });
  frame(); frame();
  assert.equal(overlay.getAttribute("role"), "region", "coach semantics must not hide the required action outside it");
  assert.notEqual(overlay.getAttribute("aria-modal"), "true");
  assert.equal(overlay.getAttribute("aria-labelledby"), "tutorialTitle");
  assert.equal(overlay.inert, false);
  assert.ok(dom.document.activeElement === print, "the action, rather than Next, receives initial focus");
  assert.equal(print.getAttribute("aria-describedby"), "existingHelp tutorialBody");
  const tab = { key: "Tab", defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  dom.document.activeElement = skip;
  (dom.document.listeners.get("keydown") || []).forEach(callback => callback(tab));
  assert.equal(tab.defaultPrevented, false, "nonmodal guidance must not trap keyboard users");
  // Model the browser restoring the old scroll after the initial highlight.
  scrollY = 1492;
  assert.equal(targetRect().top, 8);
  sendWindowEvent("load"); sendWindowEvent("pageshow");
  frame(); frame();
  assert.ok(targetRect().top >= 136, "target is below the sticky header after reload");
  assert.ok(targetRect().bottom <= cardTop - 12, "target stays above the coach card");
  scrollY = 1100;
  cardTop = 450;
  sendWindowEvent("resize"); frame(); frame();
  assert.ok(targetRect().bottom <= 438, "resized tutorial card cannot cover the action");
  assert.equal(timers, 0, "positioning follows lifecycle/layout frames rather than arbitrary delays");
  assert.ok(positioning.every(options => options.behavior === "instant"));
  sandbox.Tutorial.markMilestone("click"); frame(); frame();
  assert.equal(print.getAttribute("aria-describedby"), "existingHelp", "previous accessible description is restored");
  assert.ok(dom.document.activeElement === buy, "the unlocked purchase action receives the next step focus");
  assert.equal(buy.getAttribute("aria-describedby"), "tutorialBody");
  const escape = { key: "Escape", defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  (dom.document.listeners.get("keydown") || []).forEach(callback => callback(escape));
  assert.equal(sandbox.Tutorial.isActive(), false);
  assert.equal(overlay.inert, true);
  assert.equal(buy.getAttribute("aria-describedby"), null);
  assert.equal(prefs.tutorialCompleted, false, "Escape dismisses without marking unfinished guidance complete");
  assert.equal(frames.size, 0);
});

function addConflictWarning(dom) {
  const warning = new dom.Node("aside", { id: "saveConflict", class: "save-conflict" });
  warning.hidden = true;
  for (const [tag, id] of [["strong", "saveConflictTitle"], ["p", "saveConflictBody"], ["button", "saveConflictExport"], ["button", "saveConflictReload"], ["p", "saveConflictStatus"]]) warning.append(new dom.Node(tag, { id }));
  dom.body.append(warning, new dom.Node("p", { id: "saveHealth" }), new dom.Node("p", { id: "saveTransferStatus" }));
  return warning;
}

await testAsync("a stale tab retains its warning and exports live memory before an explicit reload", async () => {
  const { game, model, sandbox } = application(fundedSave());
  const dom = mobileDocument();
  const warning = addConflictWarning(dom);
  sandbox.document = dom.document;
  sandbox.TextEncoder = TextEncoder;
  sandbox.Blob = Blob;
  const windowEvents = new Map();
  sandbox.addEventListener = (name, callback) => { const handlers = windowEvents.get(name) || []; handlers.push(callback); windowEvents.set(name, handlers); };
  sandbox.dispatchEvent = event => { (windowEvents.get(event.type) || []).forEach(callback => callback(event)); return true; };
  sandbox.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  let reloads = 0;
  sandbox.location.reload = () => { reloads++; };
  const nativeExports = [];
  sandbox.webkit = { messageHandlers: { papersNative: { postMessage: message => nativeExports.push(message) } } };
  sandbox.localStorage.setItem("papersEmpireSave", JSON.stringify(game.getSave()));
  for (const path of ["assets/i18n/fr.js", "assets/js/persistence.js", "assets/js/save-transfer.js", "assets/js/mobile-experience.js"]) vm.runInContext(readFileSync(new URL("../" + path, import.meta.url), "utf8"), sandbox, { filename: path });
  sandbox.Persistence.load();
  sandbox.PESaveTransfer.configure({ getSave: game.getSave, translate: game.translate, locale: "fr" });
  sandbox.PEMobileExperience.init({ game: { ...game, expandPanel() {} }, translate: game.translate });
  assert.equal(warning.hidden, true);
  const elsewhere = copy(game.getSave());
  elsewhere.resources.docBank = 987654;
  sandbox.localStorage.setItem("papersEmpireSave", JSON.stringify(elsewhere));
  sandbox.localStorage.setItem("papersEmpireSave.generation", "external-replacement");
  dom.guide.focus();
  sandbox.dispatchEvent({ type: "storage", key: "papersEmpireSave.generation", newValue: "external-replacement" });
  assert.equal(sandbox.Persistence.getHealth().reason, "stale");
  assert.equal(warning.hidden, false);
  assert.equal(reloads, 0, "a cross-tab replacement must never discard memory automatically");
  assert.ok(dom.document.activeElement === dom.guide, "warning is nonmodal and does not steal focus");
  const title = dom.document.getElementById("saveConflictTitle").textContent;
  for (const detail of [{ ok: false, reason: "quota" }, { ok: true, operation: "save" }]) sandbox.dispatchEvent({ type: "pe:save-health", detail });
  assert.equal(warning.hidden, false);
  assert.equal(dom.document.getElementById("saveConflictTitle").textContent, title);
  assert.equal(dom.document.getElementById("saveHealth").textContent, game.translate("saveConflict.body"));
  const exportButton = dom.document.getElementById("saveConflictExport");
  const reloadButton = dom.document.getElementById("saveConflictReload");
  const pendingExport = exportButton.listeners.get("click")[0]();
  assert.equal(exportButton.disabled, true);
  assert.equal(reloadButton.disabled, true);
  reloadButton.click();
  assert.equal(reloads, 0, "reload cannot interrupt a pending export");
  assert.equal(await pendingExport, true);
  assert.equal(nativeExports.length, 1);
  assert.equal(nativeExports[0].action, "exportSave");
  const portable = sandbox.Persistence.parseImport(nativeExports[0].payload);
  assert.equal(portable.ok, true);
  assert.equal(portable.save.resources.docBank, model.gameState.resources.docBank, "export must contain this view's live game");
  assert.notEqual(portable.save.resources.docBank, elsewhere.resources.docBank);
  assert.equal(JSON.parse(sandbox.localStorage.getItem("papersEmpireSave")).resources.docBank, elsewhere.resources.docBank, "export does not overwrite the replacement");
  assert.equal(warning.hidden, false, "successful export does not imply the user has adopted another save");
  assert.equal(reloads, 0);
  sandbox.PESaveTransfer.exportSave = async () => false;
  assert.equal(await exportButton.listeners.get("click")[0](), false);
  assert.equal(warning.hidden, false);
  assert.equal(dom.document.getElementById("saveConflictStatus").textContent, game.translate("saveConflict.exportFailed"));
  assert.equal(exportButton.disabled, false);
  reloadButton.click();
  assert.equal(reloads, 1, "only the explicit reload action adopts the current persisted save");
});

test("blocked save health discovered during initialization remains visible in native mode", () => {
  for (const reason of ["stale", "rollback"]) {
    const { game, sandbox } = application(fundedSave());
    const dom = mobileDocument();
    const warning = addConflictWarning(dom);
    sandbox.document = dom.document;
    sandbox.__PE_NATIVE__ = { platform: "ios" };
    dom.html.classList.add("pe-empire");
    sandbox.Persistence.getHealth = () => ({ ok: false, reason, reloadRequired: true });
    vm.runInContext(readFileSync(new URL("../assets/js/mobile-experience.js", import.meta.url), "utf8"), sandbox, { filename: "mobile-experience.js" });
    sandbox.PEMobileExperience.init({ game: { ...game, expandPanel() {} }, translate: key => key });
    assert.equal(warning.hidden, false);
    assert.ok(warning.parent === dom.body, "the warning belongs outside the native and hidden game surfaces");
    assert.equal(dom.document.getElementById("saveConflictTitle").textContent, reason === "stale" ? "saveConflict.title" : "saveConflict.interruptedTitle");
  }
});

if (failures.length) {
  console.error(failures.map(item => "FAIL " + item).join("\n"));
  console.error(`${failures.length} failures; ${checks} behavioral checks passed.`);
  process.exitCode = 1;
} else console.log(`Product experience: ${checks} behavioral checks passed.`);
