/** Offline preparation and user-initiated installation/update actions. No save is cached. */
(function () {
  "use strict";
  const native = location.protocol !== "http:" && location.protocol !== "https:";
  const supported = !native && window.isSecureContext && "serviceWorker" in navigator && "caches" in window;
  const state = { supported: Boolean(supported), phase: "idle", updateReady: false, version: null, error: null };
  let registration = null;
  let installPrompt = null;
  let preparing = null;
  let reloadRequested = false;
  let updateTimer = null;
  const watched = new WeakSet();

  function readableSave() {
    try {
      const persistence = window.Persistence;
      return Boolean(persistence && persistence.parseImport(persistence.exportData()).ok);
    } catch { return false; }
  }
  function getState() {
    return { ...state, hasReadableSave: readableSave(), canPromptInstall: Boolean(installPrompt),
      standalone: Boolean(navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches) };
  }
  function notify() { window.dispatchEvent(new CustomEvent("pe:offline-state", { detail: getState() })); }
  function setState(next) { Object.assign(state, next); notify(); }

  async function readStatus() {
    if (!registration?.active) return;
    try {
      const message = await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Offline status timeout")); }, 4000);
        channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
        registration.active.postMessage({ type: "PE_OFFLINE_STATUS" }, [channel.port2]);
      });
      setState({ phase: message.ready ? "ready" : "idle", version: message.version || null,
        updateReady: Boolean(registration.waiting), error: null });
      return message.ready;
    } catch { setState({ phase: "error", error: "status" }); }
  }

  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") {
        if (registration.active) setState({ updateReady: true, error: null });
      }
      if (worker.state === "activated") readStatus();
      if (worker.state === "redundant") {
        // A rejected update leaves the preceding complete version usable.
        setState({ error: "download", phase: registration.active ? state.phase : "error" });
      }
    });
  }
  function observe(value) {
    registration = value;
    registration.addEventListener("updatefound", () => watch(registration.installing));
    watch(registration.installing);
    setState({ updateReady: Boolean(registration.waiting) });
    if (registration.active) readStatus();
  }

  async function prepare() {
    if (!supported) return false;
    if (preparing) return preparing;
    setState({ phase: "preparing", error: null });
    preparing = (async () => {
      try {
        if (!registration) observe(await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }));
        else await registration.update();
        if (registration.active && !await readStatus() && !registration.waiting && !registration.installing) {
          setState({ phase: "preparing" });
          const repaired = await new Promise(resolve => {
            const channel = new MessageChannel();
            const timer = setTimeout(() => { channel.port1.close(); resolve(false); }, 60000);
            channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data.ready); };
            registration.active.postMessage({ type: "PE_REPAIR_OFFLINE_CACHE" }, [channel.port2]);
          });
          if (!repaired) throw new Error("Offline repair failed");
          await readStatus();
        }
        return true;
      } catch { setState({ phase: "error", error: "download" }); return false; }
      finally { preparing = null; }
    })();
    return preparing;
  }

  async function checkForUpdate() {
    if (!supported || !registration) return false;
    try { await registration.update(); await readStatus(); return true; }
    catch { setState({ error: "network" }); return false; }
  }

  async function applyUpdate(beforeReload) {
    if (!registration?.waiting || reloadRequested) return false;
    try {
      // The game supplies its own synchronous/async save flush before reload.
      if (typeof beforeReload === "function" && await beforeReload() === false) return false;
    } catch { return false; }
    reloadRequested = true;
    updateTimer = setTimeout(() => {
      reloadRequested = false;
      setState({ error: "update" });
    }, 20000);
    registration.waiting.postMessage({ type: "PE_APPLY_OFFLINE_UPDATE" });
    return true;
  }

  async function requestInstall() {
    if (!readableSave()) return { ok: false, reason: "save" };
    if (getState().standalone) return { ok: false, reason: "installed" };
    if (!installPrompt) return { ok: false, reason: "manual" };
    const prompt = installPrompt;
    installPrompt = null;
    notify();
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      return { ok: result.outcome === "accepted", reason: result.outcome };
    } catch { return { ok: false, reason: "prompt" }; }
  }

  window.PEOffline = { getState, prepare, checkForUpdate, applyUpdate, requestInstall };
  window.addEventListener("pe:save-health", notify);
  if (!supported) return;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => { installPrompt = null; notify(); });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadRequested) {
      clearTimeout(updateTimer);
      reloadRequested = false;
      location.reload();
    } else if (registration) readStatus();
  });
  // Existing installs are checked silently. The first download is an explicit action.
  navigator.serviceWorker.getRegistration("/").then(value => {
    if (!value || !value.active?.scriptURL.endsWith("/sw.js")) return;
    observe(value);
    value.update().catch(() => {});
  }).catch(() => {});
})();
