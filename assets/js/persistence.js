(function () {
  "use strict";

  const STORAGE_KEY = "papersEmpireSave";
  const BACKUP_KEY = "papersEmpireSave.previous";
  const GENERATION_KEY = "papersEmpireSave.generation";
  const FORMAT = "papers-empire-save";
  const FORMAT_VERSION = 1;
  const MAX_BYTES = 2 * 1024 * 1024;
  const RESERVED = new Set(["__proto__", "prototype", "constructor"]);
  const RESOURCE_KEYS = ["docBank", "docTotal", "ccTotal", "culturePoints"];
  let replacementPending = false;
  let loadedGeneration;
  let generationCaptured = false;
  let health = { ok: true, operation: "idle", reason: null, savedAt: null, backupAvailable: false, reloadRequired: false };

  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const nonNegative = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const idValid = value => typeof value === "string" && /^[a-zA-Z0-9_:-]{1,120}$/.test(value) && !RESERVED.has(value);

  function report(ok, operation, reason = null, extra = {}) {
    health = { ...health, ok, operation, reason, reloadRequired: reason === "stale", ...extra };
    try { window.dispatchEvent(new CustomEvent("pe:save-health", { detail: { ...health } })); }
    catch { /* A storage result remains usable without browser events. */ }
    return { ...health };
  }

  function errorReason(error) {
    return error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") ? "quota" : "storage";
  }

  // This local revision is not part of a save file or analytics. A page only
  // writes the generation it opened; importing in another tab invalidates it.
  // It guards stale pages; localStorage still has no atomic cross-process CAS.
  function checkGeneration(operation, allowPending = false) {
    try {
      const current = window.localStorage.getItem(GENERATION_KEY);
      if (!generationCaptured || current !== loadedGeneration || (!allowPending && current?.startsWith("pending:"))) {
        report(false, operation, "stale", { reloadRequired: true });
        return false;
      }
      return true;
    } catch (error) { report(false, operation, errorReason(error)); return false; }
  }

  function newGeneration() {
    return typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : Date.now().toString(36) + ":" + Math.random().toString(36).slice(2) + ":" + Math.random().toString(36).slice(2);
  }

  function byteLength(raw) {
    return typeof TextEncoder === "function" ? new TextEncoder().encode(raw).length : new Blob([raw]).size;
  }

  // Inspect nested historical fields before merging. Continuous currency may
  // exceed MAX_SAFE_INTEGER; quantities may not. Limits bound untrusted files.
  function safeTree(value, depth = 0, budget = { count: 0 }) {
    if (depth > 40 || ++budget.count > 50000) return false;
    if (value === null || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return value.length <= 131072 && !RESERVED.has(value);
    if (Array.isArray(value)) return value.length <= 10000 && value.every(item => safeTree(item, depth + 1, budget));
    if (!record(value)) return false;
    return Object.entries(value).every(([key, item]) => {
      if (RESERVED.has(key)) return false;
      if ((key === "id" || key.endsWith("Id")) && typeof item === "string" && RESERVED.has(item)) return false;
      return safeTree(item, depth + 1, budget);
    });
  }

  function validateSave(save) {
    if (!record(save) || !safeTree(save)) return { ok: false, reason: "invalid" };
    if (save.version !== undefined && (!Number.isInteger(save.version) || save.version < 1 || save.version > 3)) return { ok: false, reason: "version" };
    if (!record(save.resources) || !nonNegative(save.resources.docBank) || !nonNegative(save.resources.docTotal)) return { ok: false, reason: "invalid" };
    if (RESOURCE_KEYS.some(key => save.resources[key] !== undefined && !nonNegative(save.resources[key]))) return { ok: false, reason: "invalid" };
    if (save.stats !== undefined && (!record(save.stats) || Object.values(save.stats).some(value => !nonNegative(value) || value > 1))) return { ok: false, reason: "invalid" };
    for (const key of ["savedAt", "lastSeen"]) {
      if (save[key] !== undefined && (!nonNegative(save[key]) || save[key] > 8640000000000000)) return { ok: false, reason: "invalid" };
    }
    for (const key of ["buildings", "upgrades"]) {
      if (save[key] === undefined) continue;
      if (!Array.isArray(save[key]) || save[key].length > 128) return { ok: false, reason: "invalid" };
      const ids = new Set();
      for (const entry of save[key]) {
        if (!record(entry) || !idValid(entry.id)) return { ok: false, reason: "invalid" };
        const canonicalId = entry.id === "vbsPortal" ? "clientPortal" : entry.id;
        if (ids.has(canonicalId)) return { ok: false, reason: "invalid" };
        ids.add(canonicalId);
        if (key === "buildings" && (!Number.isSafeInteger(entry.quantity) || entry.quantity < 0)) return { ok: false, reason: "invalid" };
        if (key === "upgrades" && entry.purchased !== undefined && typeof entry.purchased !== "boolean") return { ok: false, reason: "invalid" };
      }
    }
    for (const key of ["career", "analytics", "endgame", "events", "achievements", "meta"]) {
      if (save[key] !== undefined && save[key] !== null && !record(save[key])) return { ok: false, reason: "invalid" };
    }
    for (const key of ["career", "analytics"]) {
      if (save[key] && save[key].schemaVersion !== undefined && save[key].schemaVersion !== 1) return { ok: false, reason: "version" };
    }
    const ranks = save.career && save.career.completedRanks;
    if (ranks !== undefined && (!record(ranks) || ["cadence", "quality", "clientRelations"].some(key => ranks[key] !== undefined && (!Number.isSafeInteger(ranks[key]) || ranks[key] < 0 || ranks[key] > 3)))) return { ok: false, reason: "invalid" };
    return { ok: true, save };
  }

  function preview(save) {
    const ranks = save.career && save.career.completedRanks || {};
    const stamps = ["cadence", "quality", "clientRelations"].reduce((sum, key) => sum + (Number.isSafeInteger(ranks[key]) ? Math.max(0, Math.min(3, ranks[key])) : 0), 0);
    return {
      version: save.version || 1,
      savedAt: save.savedAt || save.lastSeen || null,
      resources: Object.fromEntries(RESOURCE_KEYS.map(key => [key, save.resources[key] || 0])),
      unitCount: (save.buildings || []).reduce((sum, building) => sum + building.quantity, 0),
      ownedTypes: (save.buildings || []).filter(building => building.quantity > 0).length,
      stamps
    };
  }

  function parseImport(raw) {
    if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "invalid" };
    if (raw.length > MAX_BYTES || byteLength(raw) > MAX_BYTES) return { ok: false, reason: "size" };
    let parsed;
    try { parsed = JSON.parse(raw.replace(/^\uFEFF/, "")); }
    catch { return { ok: false, reason: "invalid" }; }
    if (!record(parsed) || !safeTree(parsed)) return { ok: false, reason: "invalid" };
    let save = parsed;
    if (Object.prototype.hasOwnProperty.call(parsed, "format")) {
      if (parsed.format !== FORMAT) return { ok: false, reason: "invalid" };
      if (parsed.formatVersion !== FORMAT_VERSION) return { ok: false, reason: "version" };
      save = parsed.save;
    }
    const result = validateSave(save);
    return result.ok ? { ok: true, save, preview: preview(save), raw: JSON.stringify(save) } : result;
  }

  function isAvailable() {
    try {
      // Reading remains possible at quota; the actual write reports failure.
      window.localStorage.getItem(STORAGE_KEY);
      return true;
    } catch (error) { report(false, "availability", errorReason(error)); return false; }
  }

  function readRaw() {
    try { return window.localStorage.getItem(STORAGE_KEY); }
    catch (error) { report(false, "read", errorReason(error)); return null; }
  }

  function getBackup() {
    try {
      const raw = window.localStorage.getItem(BACKUP_KEY);
      return raw ? parseImport(raw) : { ok: false, reason: "noBackup" };
    } catch (error) { return { ok: false, reason: errorReason(error) }; }
  }

  function load() {
    health.backupAvailable = getBackup().ok;
    if (!checkGeneration("load")) return null;
    const raw = readRaw();
    const backupAvailable = getBackup().ok;
    if (!raw) { health.backupAvailable = backupAvailable; return null; }
    const result = parseImport(raw);
    if (!result.ok) {
      // Preserve damaged primary data until explicit recovery/import/reset.
      replacementPending = true;
      report(false, "load", result.reason, { backupAvailable });
      return null;
    }
    report(true, "load", null, { savedAt: result.preview.savedAt, backupAvailable });
    return result.save;
  }

  function save(payload) {
    if (replacementPending) return false;
    if (!checkGeneration("save")) return false;
    let raw;
    try { raw = JSON.stringify({ ...payload, savedAt: Date.now() }); }
    catch { report(false, "save", "invalid"); return false; }
    const result = parseImport(raw);
    if (!result.ok) { report(false, "save", result.reason); return false; }
    try {
      // Recheck immediately before the write, including after serialization.
      if (!checkGeneration("save")) return false;
      window.localStorage.setItem(STORAGE_KEY, result.raw);
      if (window.localStorage.getItem(STORAGE_KEY) !== result.raw) throw new Error("Save verification failed");
      if (!checkGeneration("save")) return false;
      report(true, "save", null, { savedAt: result.save.savedAt });
      return true;
    } catch (error) { report(false, "save", errorReason(error)); return false; }
  }

  function clear() {
    return replace(null, "clear");
  }

  function exportData() { return readRaw() || ""; }

  function createPortable(payload) {
    let raw;
    try { raw = typeof payload === "string" ? payload : JSON.stringify(payload); }
    catch { return { ok: false, reason: "invalid" }; }
    const result = parseImport(raw);
    if (!result.ok) return result;
    const portable = JSON.stringify({ format: FORMAT, formatVersion: FORMAT_VERSION, exportedAt: Date.now(), save: result.save }, null, 2);
    if (byteLength(portable) > MAX_BYTES) return { ok: false, reason: "size" };
    return { ok: true, raw: portable, preview: result.preview };
  }

  function replace(raw, operation) {
    const clearing = operation === "clear";
    const result = clearing ? { ok: true, raw: null, preview: { savedAt: null } } : parseImport(raw);
    if (!result.ok) { report(false, operation, result.reason); return false; }
    // A freshly reloaded page may explicitly recover an interrupted transfer.
    // Older pages still fail the generation comparison, including for reset.
    if (!checkGeneration(operation, true)) return false;
    const token = newGeneration();
    const pending = "pending:" + token;
    const committed = "done:" + token;
    let previous, previousBackup;
    let primaryWritten = false;
    let generationWritten = false;
    try {
      const storage = window.localStorage;
      previous = storage.getItem(STORAGE_KEY);
      previousBackup = storage.getItem(BACKUP_KEY);
      // Backup must succeed before touching the primary key, also at quota.
      if (!clearing && previous && parseImport(previous).ok) {
        storage.setItem(BACKUP_KEY, previous);
        if (storage.getItem(BACKUP_KEY) !== previous) throw new Error("Backup verification failed");
      }
      if (!checkGeneration(operation, true)) return false;
      // Invalidate old pages before replacing data. Pages opened mid-transfer
      // also fail closed until a reload sees the completed generation.
      storage.setItem(GENERATION_KEY, pending);
      generationWritten = true;
      if (storage.getItem(GENERATION_KEY) !== pending) throw new Error("Generation verification failed");
      if (storage.getItem(STORAGE_KEY) !== previous) throw new Error("Primary changed during transfer");
      if (clearing) storage.removeItem(STORAGE_KEY);
      else storage.setItem(STORAGE_KEY, result.raw);
      primaryWritten = true;
      if (storage.getItem(STORAGE_KEY) !== result.raw) throw new Error("Import verification failed");
      if (clearing) {
        storage.removeItem(BACKUP_KEY);
        if (storage.getItem(BACKUP_KEY) !== null) throw new Error("Reset verification failed");
      }
      if (storage.getItem(GENERATION_KEY) !== pending) throw new Error("Generation changed during transfer");
      storage.setItem(GENERATION_KEY, committed);
      if (storage.getItem(GENERATION_KEY) !== committed) throw new Error("Generation commit failed");
      // A queued autosave must not replace the import before the app reloads.
      replacementPending = true;
      report(true, operation, null, { savedAt: result.preview.savedAt, backupAvailable: getBackup().ok });
      return true;
    } catch (error) {
      if (generationWritten) {
        try {
          const storage = window.localStorage;
          // Never roll back over a replacement completed by a different tab.
          if (storage.getItem(GENERATION_KEY) !== pending) {
            replacementPending = true;
            report(false, operation, "stale", { backupAvailable: getBackup().ok });
            return false;
          }
          if (primaryWritten) {
            if (previous === null) storage.removeItem(STORAGE_KEY);
            else storage.setItem(STORAGE_KEY, previous);
            if (storage.getItem(STORAGE_KEY) !== previous) throw new Error("Rollback verification failed");
            if (clearing) {
              if (previousBackup === null) storage.removeItem(BACKUP_KEY);
              else storage.setItem(BACKUP_KEY, previousBackup);
              if (storage.getItem(BACKUP_KEY) !== previousBackup) throw new Error("Backup rollback failed");
            }
          }
          storage.setItem(GENERATION_KEY, committed);
          if (storage.getItem(GENERATION_KEY) !== committed) throw new Error("Rollback generation failed");
          replacementPending = true;
        } catch {
          replacementPending = true;
          report(false, operation, "rollback", { backupAvailable: getBackup().ok, reloadRequired: true });
          return false;
        }
      }
      report(false, operation, errorReason(error), { backupAvailable: getBackup().ok, reloadRequired: generationWritten });
      return false;
    }
  }

  function importData(raw) { return replace(raw, "import"); }
  function recoverPrevious() {
    const backup = getBackup();
    if (!backup.ok) { report(false, "recover", backup.reason); return false; }
    return replace(backup.raw, "recover");
  }

  try {
    loadedGeneration = window.localStorage.getItem(GENERATION_KEY);
    generationCaptured = true;
  } catch (error) { report(false, "availability", errorReason(error)); }
  window.addEventListener?.("storage", event => {
    if (event.key === GENERATION_KEY || event.key === null) checkGeneration("sync");
  });

  window.Persistence = {
    isAvailable, load, save, clear, exportData, importData,
    parseImport, createPortable, getBackup, recoverPrevious,
    getHealth: () => ({ ...health }),
    MAX_BYTES, FORMAT, FORMAT_VERSION
  };
})();
