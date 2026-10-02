#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/persistence.js", import.meta.url), "utf8");
const PRIMARY = "papersEmpireSave";
const BACKUP = "papersEmpireSave.previous";
const GENERATION = "papersEmpireSave.generation";
const clone = value => JSON.parse(JSON.stringify(value));
function harness(storage = new Map(), behavior = {}) {
  const events = [];
  const listeners = new Map();
  const context = {
    Date, Math, JSON, Set, Object, Array, Number, String, TextEncoder, Blob,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    addEventListener(type, callback) { const callbacks = listeners.get(type) || []; callbacks.push(callback); listeners.set(type, callbacks); },
    dispatchEvent(event) { events.push(event); for (const callback of listeners.get(event.type) || []) callback(event); },
    localStorage: {
      getItem(key) {
        if (behavior.readError) throw Object.assign(new Error("Denied"), { name: "SecurityError" });
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        if (behavior.quotaKey === key || behavior.rejectWrite?.(key, value)) throw Object.assign(new Error("Full"), { name: "QuotaExceededError" });
        if (behavior.corruptOnce === key) { behavior.corruptOnce = null; storage.set(key, "broken"); return; }
        storage.set(key, String(value));
        behavior.afterWrite?.(key, String(value));
      },
      removeItem(key) { storage.delete(key); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { api: context.Persistence, context, storage, events };
}
const legacy = {
  resources: { docBank: 1200.5, docTotal: 2600.75, ccTotal: 340, culturePoints: 1 },
  stats: { quality: 0.5, footprint: 0.4, imageVbs: 0.65 },
  buildings: [{ id: "reproOperator", quantity: 10 }, { id: "vbsPortal", quantity: 1 }],
  upgrades: [{ id: "upg_click_power_1", purchased: true }],
  achievements: { firstDoc: true, firstBuilding: true },
  lastSeen: 1700000000000
};
const modern = {
  ...clone(legacy), version: 3, meta: { startedAt: 1700000000000 },
  stats: { quality: 0.7, footprint: 0.3, brandImage: 0.6 },
  resources: { docBank: 3e20, docTotal: 4e20, ccTotal: 100000, culturePoints: 12 },
  buildings: [{ id: "reproOperator", quantity: 25, isUnlocked: true }, { id: "prepressStudio", quantity: 2, isUnlocked: true }],
  achievements: { unlocked: { firstDoc: 1700000000000 }, rewarded: { firstDoc: 1700000000000 } },
  endgame: { activeContract: null }, events: { pendingId: null },
  analytics: { schemaVersion: 1, currentRun: { eventDocNet: -120 }, runSummaries: [], partialHistory: true }
};
const initial = harness();
vm.runInContext(readFileSync(new URL("../assets/js/progression.js", import.meta.url), "utf8"), initial.context);
modern.career = clone(initial.context.ProgressionModule.createDefaultCareer({ now: 1700000000000 }));
modern.career.completedRanks.cadence = 2;
modern.career.completedRanks.quality = 1;
const encodedLegacy = JSON.stringify(legacy);
const encodedModern = JSON.stringify(modern);

assert.equal(initial.api.parseImport(encodedLegacy).ok, true, "unversioned historical save remains accepted");
for (const version of [1, 2, 3]) assert.equal(initial.api.parseImport(JSON.stringify({ ...legacy, version })).ok, true);
assert.equal(initial.api.parseImport(encodedModern).ok, true, "large finite currencies and negative event nets are legitimate");
assert.equal(initial.api.parseImport(encodedModern).preview.stamps, 3);
assert.equal(initial.api.parseImport(encodedModern).preview.unitCount, 27);
assert.equal(initial.storage.size, 0, "preview is read-only");
const portable = initial.api.createPortable(modern);
assert.equal(portable.ok, true);
assert.equal(JSON.parse(portable.raw).format, "papers-empire-save");
assert.deepEqual(clone(initial.api.parseImport(portable.raw).save), modern, "web/native portable roundtrip preserves all V3 fields");
assert.deepEqual(clone(initial.api.parseImport("\uFEFF" + encodedLegacy).save), legacy, "JSON files with UTF-8 BOM import");

for (const raw of ["", "null", "[]", "{}", "true", "{", '{"resources":{"docBank":1}}', '{"resources":{"docBank":0,"docTotal":1e400}}']) {
  assert.equal(initial.api.parseImport(raw).ok, false, "reject malformed/non-game JSON: " + raw);
}
for (const mutation of [
  save => { save.resources.ccTotal = -1; },
  save => { save.resources.docTotal = "22"; },
  save => { save.buildings[0].quantity = 1.5; },
  save => { save.buildings[0].quantity = -1; },
  save => { save.buildings[0].quantity = Number.MAX_SAFE_INTEGER + 1; },
  save => { save.buildings[0].id = "constructor"; },
  save => { save.buildings.push({ ...save.buildings[0] }); },
  save => { save.buildings.push({ id: "clientPortal", quantity: 1 }); },
  save => { save.stats.quality = 2; },
  save => { save.savedAt = 1e99; },
  save => { save.upgrades[0].purchased = "yes"; },
  save => { save.career = { schemaVersion: 1, completedRanks: { cadence: 1e20 } }; },
  save => { save.career = { schemaVersion: 1, cycle: { contractIds: ["__proto__"] } }; }
]) {
  const changed = clone(legacy); mutation(changed);
  assert.equal(initial.api.parseImport(JSON.stringify(changed)).ok, false);
}
for (const raw of [
  encodedLegacy.replace('"resources":', '"__proto__":{"polluted":true},"resources":'),
  encodedLegacy.replace('"resources":', '"career":{"constructor":{"prototype":{"polluted":true}}},"resources":')
]) assert.equal(initial.api.parseImport(raw).ok, false, "prototype keys rejected at every depth");
assert.equal({}.polluted, undefined);
for (const save of [{ ...modern, version: 4 }, { ...modern, career: { schemaVersion: 2 } }]) {
  assert.equal(initial.api.parseImport(JSON.stringify(save)).reason, "version");
}
assert.equal(initial.api.parseImport(JSON.stringify({ format: "papers-empire-save", formatVersion: 2, save: modern })).reason, "version");
assert.equal(initial.api.parseImport(JSON.stringify({ format: "another-game", formatVersion: 1, save: modern })).ok, false);
assert.equal(initial.api.parseImport(" ".repeat(initial.api.MAX_BYTES + 1) + encodedLegacy).reason, "size");

assert.equal(initial.api.save(legacy), true);
const savedLegacy = initial.storage.get(PRIMARY);
assert.equal(initial.api.importData(portable.raw), true);
assert.equal(initial.storage.get(BACKUP), savedLegacy, "valid old file copied before import");
assert.deepEqual(JSON.parse(initial.storage.get(PRIMARY)), modern);
assert.equal(initial.api.save(legacy), false, "queued old-state autosave cannot overwrite successful import");
assert.equal(initial.events.at(-1).type, "pe:save-health");
assert.equal(initial.events.at(-1).detail.ok, true);
const restored = harness(initial.storage);
assert.deepEqual(clone(restored.api.load()), modern);
assert.equal(restored.api.recoverPrevious(), true);
assert.equal(restored.storage.get(PRIMARY), savedLegacy);
assert.deepEqual(JSON.parse(restored.storage.get(BACKUP)), modern, "recovery retains the just-replaced file");

for (const quotaKey of [BACKUP, PRIMARY, GENERATION]) {
  const storage = new Map([[PRIMARY, savedLegacy]]);
  const test = harness(storage, { quotaKey });
  assert.equal(test.api.importData(encodedModern), false);
  assert.equal(storage.get(PRIMARY), savedLegacy, "quota failure leaves previous primary intact");
  assert.equal(test.api.getHealth().reason, "quota");
  assert.equal(test.api.exportData(), savedLegacy, "full storage can still be exported");
}
const corruptWrite = harness(new Map([[PRIMARY, savedLegacy]]), { corruptOnce: PRIMARY });
assert.equal(corruptWrite.api.importData(encodedModern), false);
assert.equal(corruptWrite.storage.get(PRIMARY), savedLegacy, "failed write verification rolls back to old primary");
assert.equal(corruptWrite.storage.get(BACKUP), savedLegacy);
const quotaAutosave = harness(new Map([[PRIMARY, savedLegacy]]), { quotaKey: PRIMARY });
assert.equal(quotaAutosave.api.save(modern), false);
assert.equal(quotaAutosave.api.getHealth().reason, "quota");
assert.equal(quotaAutosave.api.getHealth().ok, false);
const denied = harness(new Map(), { readError: true });
assert.equal(denied.api.isAvailable(), false);
assert.equal(denied.api.getHealth().reason, "storage");
assert.equal(denied.api.createPortable(modern).ok, true, "in-memory game can export when local storage is unavailable");
const damaged = harness(new Map([[PRIMARY, "broken"], [BACKUP, savedLegacy]]));
assert.equal(damaged.api.load(), null);
assert.equal(damaged.api.getHealth().backupAvailable, true);
assert.equal(damaged.api.save(modern), false, "damaged data is not silently overwritten by new-game autosave");
assert.equal(damaged.api.recoverPrevious(), true);
assert.equal(damaged.storage.get(PRIMARY), savedLegacy);
const reset = harness(new Map([[PRIMARY, savedLegacy], [BACKUP, encodedModern]]));
assert.equal(reset.api.clear(), true);
assert.equal(reset.storage.has(PRIMARY), false, "explicit reset removes the game");
assert.equal(reset.storage.has(BACKUP), false, "explicit reset removes old recovery data too");
assert.equal(reset.storage.size, 1, "reset retains only its cross-tab generation tombstone");

const shared = new Map([[PRIMARY, savedLegacy]]);
const importTab = harness(shared);
const oldTab = harness(shared);
assert.equal(oldTab.api.load().resources.docBank, legacy.resources.docBank);
assert.equal(importTab.api.importData(encodedModern), true);
const importedGeneration = shared.get(GENERATION);
assert.match(importedGeneration, /^done:/);
assert.equal(oldTab.api.save(legacy), false, "old tab cannot autosave over a different tab's import, even without a storage event");
assert.equal(oldTab.api.getHealth().reason, "stale");
assert.equal(oldTab.api.getHealth().reloadRequired, true);
assert.equal(shared.get(PRIMARY), encodedModern);
assert.equal(oldTab.api.importData(encodedLegacy), false, "stale tab cannot replace a game it has not loaded");
assert.equal(oldTab.api.recoverPrevious(), false, "stale recovery cannot erase another tab's import");
assert.equal(oldTab.api.clear(), false, "stale reset cannot erase another tab's import");
assert.equal(shared.get(PRIMARY), encodedModern);
assert.equal(shared.get(GENERATION), importedGeneration);
assert.equal(oldTab.api.createPortable(legacy).ok, true, "stale in-memory game remains exportable");
const reloadedTab = harness(shared);
assert.deepEqual(clone(reloadedTab.api.load()), modern);
assert.equal(reloadedTab.api.save(modern), true, "reload adopts the committed generation");
assert.equal(reloadedTab.api.recoverPrevious(), true);
assert.notEqual(shared.get(GENERATION), importedGeneration, "recovery also advances the generation");
assert.equal(harness(shared).api.load().resources.docBank, legacy.resources.docBank);

const eventStorage = new Map([[PRIMARY, savedLegacy]]);
const eventTab = harness(eventStorage);
assert.equal(harness(eventStorage).api.importData(encodedModern), true);
eventTab.context.dispatchEvent({ type: "storage", key: GENERATION });
assert.equal(eventTab.events.at(-1).type, "pe:save-health");
assert.equal(eventTab.events.at(-1).detail.reason, "stale", "storage notification reports conflict before the next autosave");
assert.equal(eventTab.events.at(-1).detail.reloadRequired, true);

const duringStorage = new Map([[PRIMARY, savedLegacy]]);
let midTransfer;
const duringTab = harness(duringStorage, { afterWrite(key, value) {
  if (key === GENERATION && value.startsWith("pending:")) {
    midTransfer = harness(duringStorage);
    assert.equal(midTransfer.api.load(), null, "page opened mid-transfer does not load a temporary primary");
    assert.equal(midTransfer.api.save(legacy), false);
  }
} });
assert.equal(duringTab.api.importData(encodedModern), true);
assert.equal(midTransfer.api.save(legacy), false, "page opened mid-transfer also requires reload after commit");
assert.equal(duringStorage.get(PRIMARY), encodedModern);

const serializationStorage = new Map([[PRIMARY, savedLegacy]]);
const serializationTab = harness(serializationStorage);
const concurrentImporter = harness(serializationStorage);
const interruptedPayload = { ...clone(legacy) };
Object.defineProperty(interruptedPayload, "meta", { enumerable: true, get() {
  assert.equal(concurrentImporter.api.importData(encodedModern), true);
  return {};
} });
assert.equal(serializationTab.api.save(interruptedPayload), false, "generation is rechecked after payload serialization");
assert.equal(serializationStorage.get(PRIMARY), encodedModern);

const rollbackStorage = new Map([[PRIMARY, savedLegacy]]);
const rollbackObserver = harness(rollbackStorage);
const rollbackTab = harness(rollbackStorage, { corruptOnce: PRIMARY });
assert.equal(rollbackTab.api.importData(encodedModern), false);
assert.equal(rollbackStorage.get(PRIMARY), savedLegacy);
assert.match(rollbackStorage.get(GENERATION), /^done:/, "rollback leaves a completed revision readable on reload");
assert.equal(rollbackObserver.api.save(modern), false, "rollback does not resurrect old tabs' write authority");
assert.equal(harness(rollbackStorage).api.save(legacy), true);

const blockedCommitStorage = new Map([[PRIMARY, savedLegacy]]);
const blockedCommit = harness(blockedCommitStorage, { rejectWrite: (key, value) => key === GENERATION && value.startsWith("done:") });
assert.equal(blockedCommit.api.importData(encodedModern), false);
assert.equal(blockedCommitStorage.get(PRIMARY), savedLegacy, "commit failure restores the primary before reporting failure");
assert.equal(blockedCommit.api.getHealth().reason, "rollback");
assert.equal(blockedCommit.api.save(modern), false);
const retryAfterQuota = harness(blockedCommitStorage);
assert.equal(retryAfterQuota.api.save(modern), false, "interrupted transfer never grants automatic save permission");
assert.equal(retryAfterQuota.api.recoverPrevious(), true, "reloaded page can explicitly recover once storage works again");
assert.equal(harness(blockedCommitStorage).api.save(legacy), true);

const replacedDuringFailure = new Map([[PRIMARY, savedLegacy]]);
const replacementRace = harness(replacedDuringFailure, { afterWrite(key) {
  if (key === PRIMARY) {
    replacedDuringFailure.set(GENERATION, "done:other-tab");
    replacedDuringFailure.set(PRIMARY, encodedLegacy);
  }
} });
assert.equal(replacementRace.api.importData(encodedModern), false);
assert.equal(replacedDuringFailure.get(PRIMARY), encodedLegacy, "failed transfer never rolls back over a new generation owned elsewhere");
assert.equal(replacementRace.api.getHealth().reason, "stale");

const resetStorage = new Map([[PRIMARY, savedLegacy]]);
const beforeReset = harness(resetStorage);
assert.equal(harness(resetStorage).api.clear(), true);
assert.equal(beforeReset.api.save(legacy), false, "old tab cannot recreate the game after explicit reset");
assert.equal(resetStorage.has(PRIMARY), false);
assert.equal(harness(resetStorage).api.save(legacy), true, "new page can start a game after reset");

const shareHarness = harness();
vm.runInContext(readFileSync(new URL("../assets/js/career-share.js", import.meta.url), "utf8"), shareHarness.context);
const describe = shareHarness.context.PECareerShare.describeSnapshot;
assert.equal(describe({ resources: { docTotal: 0 }, docPerSecond: 0, buildings: [] }), null);
const facts = describe({ ...modern, docPerSecond: 120, started: true });
assert.equal(facts.stamps, 3);
assert.equal(facts.ownedTypes, 2);
assert.equal(facts.docTotal, 4e20);
assert.equal(describe({ ...modern, docPerSecond: Infinity }), null);
assert.equal(describe({ ...modern, docPerSecond: 120, started: false }), null);
console.log("Portable saves: legacy/V3 roundtrip, invalid imports, cross-tab import/recovery/reset protection, interrupted transfer recovery, backup/rollback, quota and factual share checks passed.");
