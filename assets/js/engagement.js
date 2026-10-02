/** Opt-in aggregate observation. No player identifier is generated or sent. */
(function () {
  "use strict";
  const CONSENT_KEY = "pe-engagement-consent-v1";
  const STATE_KEY = "pe-engagement-v1";
  const EVENTS = ["start", "first_automation", "first_upgrade", "first_contract", "first_plan", "return_j1", "return_j7"];
  const SOURCES = ["direct", "guide", "internal", "search", "external", "installed"];
  const MAX_SECONDS = 366 * 86400;
  let options = {};
  let enabled = false;
  let state = null;
  let inGame = false;
  let lastTick = Date.now();
  let wasVisible = true;
  let timer = null;
  const requests = new Set();

  function supportedOrigin() { return window.location.origin === "https://papersempire.com"; }
  function getConsent() {
    try { return window.localStorage.getItem(CONSENT_KEY) === "yes"; }
    catch { return false; }
  }
  function localDay(now) {
    const date = new Date(now);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function calendarDifference(first, last) {
    return Math.round((Date.parse(last + "T00:00:00Z") - Date.parse(first + "T00:00:00Z")) / 86400000);
  }
  function locale() {
    const value = typeof options.locale === "function" ? options.locale() : options.locale;
    const language = value || document.documentElement.lang || "fr";
    return ["fr", "en", "de", "lb"].includes(language) ? language : "fr";
  }
  function sourceCategory() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return "installed";
    if (!document.referrer) return "direct";
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin) return referrer.pathname.includes("/guides/") ? "guide" : "internal";
      if (/^(www\.)?(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(referrer.hostname)) return "search";
    } catch { return "external"; }
    return "external";
  }
  function loadState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STATE_KEY) || "null");
      if (!saved || saved.version !== 1 || !Number.isFinite(saved.startedAt) || saved.startedAt < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(saved.cohort) || !SOURCES.includes(saved.source) || !Number.isFinite(saved.activeSeconds) || saved.activeSeconds < 0 || !Array.isArray(saved.reported)) return null;
      return { version: 1, startedAt: saved.startedAt, cohort: saved.cohort, source: saved.source, activeSeconds: Math.min(MAX_SECONDS, saved.activeSeconds), reported: EVENTS.filter(name => saved.reported.includes(name)) };
    } catch { return null; }
  }
  function saveState() {
    if (!enabled || !getConsent() || !state) return;
    const stored = loadState();
    if (stored && stored.startedAt === state.startedAt && stored.cohort === state.cohort) {
      state.reported = EVENTS.filter(name => state.reported.includes(name) || stored.reported.includes(name));
      state.activeSeconds = Math.max(state.activeSeconds, stored.activeSeconds);
    }
    try { window.localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
    catch { /* Opt-in remains revocable; no repeated network retries at quota. */ }
  }
  function elapsedSeconds(now = Date.now()) {
    return state ? Math.max(0, Math.min(MAX_SECONDS, Math.floor((now - state.startedAt) / 1000))) : 0;
  }
  function tick() {
    const now = Date.now();
    const delta = Math.max(0, (now - lastTick) / 1000);
    if (enabled && state && inGame && wasVisible) {
      // Long suspended ticks are not represented as foreground active time.
      state.activeSeconds = Math.min(elapsedSeconds(now), state.activeSeconds + Math.min(delta, 30));
    }
    lastTick = now;
    wasVisible = document.visibilityState !== "hidden";
    saveState();
  }
  function ensureState() {
    if (state) return;
    state = loadState();
    if (!state) {
      const now = Date.now();
      state = { version: 1, startedAt: now, cohort: localDay(now), source: sourceCategory(), activeSeconds: 0, reported: [] };
    }
    lastTick = Date.now();
    wasVisible = document.visibilityState !== "hidden";
  }
  function abortRequests() { for (const request of requests) request.abort(); requests.clear(); }
  function stop() {
    enabled = false;
    state = null;
    if (timer !== null) clearInterval(timer);
    timer = null;
    abortRequests();
  }
  function setEnabled(value) {
    if (value !== true) {
      stop();
      try { window.localStorage.removeItem(CONSENT_KEY); window.localStorage.removeItem(STATE_KEY); } catch { /* No network while disabled even if storage cannot be cleared. */ }
      return false;
    }
    try { window.localStorage.setItem(CONSENT_KEY, "yes"); }
    catch { stop(); return false; }
    enabled = true;
    ensureState();
    if (timer === null) timer = setInterval(tick, 15000);
    try {
      const bridge = window.__PE_GAME__;
      if (bridge && bridge.getSnapshot && bridge.getSnapshot().started) record("start");
    } catch { /* Root also records actual game entry explicitly. */ }
    return true;
  }
  function configure(next = {}) {
    options = { ...options, ...next };
    if (Object.prototype.hasOwnProperty.call(next, "enabled")) return setEnabled(next.enabled);
    enabled = getConsent();
    if (enabled) {
      ensureState();
      if (timer === null) timer = setInterval(tick, 15000);
    }
    return enabled;
  }
  function emit(name) {
    if (!enabled || !getConsent() || !state || !EVENTS.includes(name) || state.reported.includes(name)) return false;
    // Refresh flags from another tab, preserving the most recent local counts.
    const stored = loadState();
    if (stored && stored.cohort === state.cohort && stored.startedAt === state.startedAt) {
      state.reported = EVENTS.filter(event => state.reported.includes(event) || stored.reported.includes(event));
      state.activeSeconds = Math.max(state.activeSeconds, stored.activeSeconds);
    }
    if (state.reported.includes(name)) return false;
    state.reported.push(name);
    saveState();
    // Native/offline/preview versions keep local observations only.
    if (!supportedOrigin()) return false;
    const elapsed = elapsedSeconds();
    const data = {
      version: 1, consent: true, event: name, lang: locale(), source: state.source, cohort: state.cohort,
      activeSeconds: Math.min(elapsed, Math.floor(state.activeSeconds)), elapsedSeconds: elapsed
    };
    const controller = new AbortController();
    requests.add(controller);
    // No retries or queue: withdrawal cannot release previously buffered events.
    // Omit credentials and Referer, including the current page query string.
    try {
      fetch("/api/engagement", {
        method: "POST", mode: "same-origin", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        keepalive: true, signal: controller.signal
      }).catch(() => {}).finally(() => requests.delete(controller));
    } catch { requests.delete(controller); return false; }
    return true;
  }
  function record(name) {
    if (!EVENTS.includes(name)) return false;
    if (name === "start") { tick(); inGame = true; }
    if (!enabled || !getConsent()) return false;
    ensureState();
    tick();
    emit("start");
    const days = calendarDifference(state.cohort, localDay(Date.now()));
    if (days === 1) emit("return_j1");
    if (days === 7) emit("return_j7");
    if (name === "return_j1" && days !== 1 || name === "return_j7" && days !== 7) return false;
    return name === "start" ? true : emit(name);
  }
  function getLocalReport() {
    tick();
    return { enabled, webTransmission: enabled && supportedOrigin(), cohort: state ? state.cohort : null, activeSeconds: state ? Math.floor(state.activeSeconds) : 0, elapsedSeconds: elapsedSeconds(), observed: state ? state.reported.slice() : [] };
  }
  function setPlaying(value) { tick(); inGame = value === true; }
  document.addEventListener("visibilitychange", () => {
    tick();
    if (enabled && inGame && document.visibilityState !== "hidden") record("start");
  });
  window.addEventListener("pagehide", tick);
  window.addEventListener("storage", event => {
    if (event.key === CONSENT_KEY && event.newValue !== "yes" || event.key === null) stop();
  });
  window.PEEngagement = { configure, setEnabled, isEnabled: () => enabled && getConsent(), record, setPlaying, getLocalReport };
})();
