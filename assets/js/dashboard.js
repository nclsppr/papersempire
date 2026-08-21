/**
 * Papers Empire · Data Science Zone
 *
 * Read-only consumer for the snapshots produced by app.js. The page never
 * changes the simulation. It accepts the instrumented V2 contract and keeps a
 * deliberately limited V1 compatibility mode for older local saves.
 */
(function () {
  "use strict";

  const assetUrl = window.PEAssetUrl || function (path) { return path; };

  const SNAPSHOT_KEY = "pe-dash-snapshot";
  const HISTORY_KEY = "pe-analytics-history-v1";
  const POLL_MS = 3000;
  const STATUS_TICK_MS = 5000;
  const LIVE_AGE_MS = 12000;
  const FRESH_AGE_MS = 90000;
  const MAX_HISTORY_ROWS = 240;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SUPPORTED_LANGUAGES = ["fr", "en", "de", "lb"];
  const BUILDING_IDS = new Set([
    "reproOperator",
    "reproWorkshop",
    "digitalPress",
    "offsetPress",
    "finishingWorkshop",
    "insertingLine",
    "logistics",
    "clientPortal",
    "comBridge",
    "factory40",
    "pampyAI"
  ]);

  const FALLBACK = {
    "analytics.status.waiting": "En attente de données",
    "analytics.status.live": "Relevé à l'instant",
    "analytics.status.fresh": "Données récentes",
    "analytics.status.stale": "Données anciennes",
    "analytics.status.legacy": "Ancien relevé V1 · date inconnue",
    "analytics.status.invalid": "Données illisibles",
    "analytics.common.now": "à l'instant",
    "analytics.common.unavailable": "Indisponible",
    "analytics.common.unknown": "Inconnu",
    "analytics.common.estimated": "Est.",
    "analytics.common.exact": "Exact",
    "analytics.common.locked": "Verrouillé",
    "analytics.common.current": "En cours",
    "analytics.common.completed": "Prestige",
    "analytics.common.samples": "Mesures : {count}",
    "analytics.common.buildings": "Unités actives : {count}",
    "analytics.duration.lessSecond": "< 1 s",
    "analytics.duration.second": "{value} s",
    "analytics.duration.minute": "{value} min",
    "analytics.duration.hour": "{value} h",
    "analytics.duration.day": "{value} j",
    "analytics.trend.up": "+{value} sur {duration}",
    "analytics.trend.down": "{value} sur {duration}",
    "analytics.trend.flat": "Stable sur {duration}",
    "analytics.trend.single": "Une mesure horodatée",
    "analytics.trend.none": "Chronologie indisponible",
    "analytics.trend.gaps": "Interruptions visibles : {count}",
    "analytics.recommendation.reason": "Retour DOC estimé le plus court parmi les unités débloquées.",
    "analytics.recommendation.saving": "Meilleur retour estimé ; il reste des DOC à produire avant l'achat.",
    "analytics.recommendation.none": "Aucune unité débloquée ne produit encore un gain DOC comparable.",
    "analytics.recommendation.waiting": "Aucun achat à comparer",
    "analytics.projection.base": "{value} DOC automatiques estimés",
    "analytics.projection.delta": "+{value} DOC si l'actif était ajouté maintenant",
    "analytics.flow.autoDoc": "Production automatique",
    "analytics.flow.manualDoc": "Clics manuels",
    "analytics.flow.offlineDoc": "Production hors ligne",
    "analytics.flow.contractDoc": "Contrats",
    "analytics.flow.eventDoc": "Événements (net)",
    "analytics.flow.autoCc": "Confiance automatique",
    "analytics.flow.contractCc": "Contrats",
    "analytics.flow.eventCc": "Événements (net)",
    "analytics.flow.empty": "Joue dans l'atelier pour faire apparaître l'origine des ressources.",
    "analytics.gauge.noHistory": "Pas encore de recul",
    "analytics.gauge.delta": "{value} pt depuis la première mesure",
    "analytics.runs.current": "Cycle courant",
    "analytics.runs.archived": "Cycle du {date}",
    "analytics.runs.prestige": "+{value} culture",
    "analytics.investment.analyzed": "{count} / 11 unités",
    "analytics.investment.imageFallback": "Illustration indisponible",
    "analytics.raw.schema": "Version du relevé",
    "analytics.raw.generatedAt": "Généré le",
    "analytics.raw.runId": "Identifiant du cycle",
    "analytics.raw.historySamples": "Mesures temporelles",
    "analytics.raw.partial": "Historique partiel",
    "analytics.raw.docRate": "Cadence DOC/s",
    "analytics.raw.ccRate": "Cadence CC/s",
    "analytics.raw.docBank": "DOC disponibles",
    "analytics.raw.docTotal": "DOC produits",
    "analytics.raw.ccTotal": "Confiance actuelle",
    "analytics.raw.yes": "Oui",
    "analytics.raw.no": "Non",
    "analytics.raw.unknownDate": "Date inconnue",
    "analytics.meta.modelValue": "V{schema} · calcul {model}",
    "analytics.coverage.legacy": "V1 · historique non suivi",
    "analytics.prestige.gain": "+{value} culture disponible",
    "analytics.prestige.eta": "Au rythme actuel : réorganisation dans ≈ {duration}",
    "analytics.prestige.gap": "{value} CC avant le prestige",
    "analytics.prestige.legacy": "Ancien relevé V1",
    "analytics.role.producer": "Production directe",
    "analytics.role.multiplier": "Effet de réseau",
    "analytics.role.ccMultiplier": "Confiance",
    "analytics.contract.boundaryV1": "Ancien relevé V1 : investissements, flux et archives indisponibles.",
    "analytics.contract.boundaryContinuous": "Suivi local actif depuis {date} ; la courbe peut contenir des interruptions.",
    "analytics.contract.coverageOrigin": "le début du suivi local"
  };

  const state = {
    lang: "fr",
    snapshot: null,
    history: [],
    historyEnvelope: null,
    metric: "docPerSecond",
    sort: { column: "paybackSeconds", direction: "ascending" },
    lastSnapshotRaw: null,
    lastHistoryRaw: null,
    lastRecommendedId: null,
    recommendationImageToken: 0,
    chartGeometry: null,
    pollTimer: null,
    statusTimer: null,
    resizeTimer: null
  };

  let els = null;

  function finite(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function finiteOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function timestampOrNull(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
    return Number.isFinite(new Date(value).getTime()) ? value : null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function interpolate(template, params) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(params || {}, key) ? String(params[key]) : "{" + key + "}";
    });
  }

  function dictionary() {
    const dictionaries = window.I18N || {};
    return dictionaries[state.lang] || dictionaries.fr || {};
  }

  function t(key, fallback, params) {
    const own = dictionary();
    const french = window.I18N && window.I18N.fr ? window.I18N.fr : {};
    const value = own[key] || french[key] || fallback || FALLBACK[key] || key;
    return interpolate(value, params || {});
  }

  function detectLanguage() {
    let candidate = null;
    try {
      candidate = new URLSearchParams(window.location.search).get("lang");
    } catch {
      candidate = null;
    }
    return SUPPORTED_LANGUAGES.includes(candidate) ? candidate : "fr";
  }

  function applyTranslations() {
    document.documentElement.lang = state.lang;
    const own = dictionary();
    const french = window.I18N && window.I18N.fr ? window.I18N.fr : {};

    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      const key = element.getAttribute("data-i18n");
      const value = own[key] || french[key];
      if (value) element.textContent = value;
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
      const key = element.getAttribute("data-i18n-aria-label");
      const value = own[key] || french[key];
      if (value) element.setAttribute("aria-label", value);
    });

    const langQuery = state.lang === "fr" ? "" : "?lang=" + encodeURIComponent(state.lang);
    if (els && els.backToGameLink) els.backToGameLink.href = "/" + langQuery;
    document.querySelectorAll(".data-zone-footer a[href='/']").forEach(function (link) {
      link.href = "/" + langQuery;
    });
  }

  function locale() {
    if (state.lang === "en") return "en-GB";
    if (state.lang === "de") return "de-DE";
    if (state.lang === "lb") return "lb-LU";
    return "fr-FR";
  }

  function formatNumber(value, options) {
    if (!Number.isFinite(value)) return "—";
    const absolute = Math.abs(value);
    const compact = absolute >= 10000;
    const base = compact
      ? { notation: "compact", maximumFractionDigits: 2, minimumFractionDigits: 0 }
      : { maximumFractionDigits: absolute < 1 && absolute !== 0 ? 3 : 2, minimumFractionDigits: 0 };
    return new Intl.NumberFormat(locale(), Object.assign(base, options || {})).format(value);
  }

  function formatSigned(value) {
    if (!Number.isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + formatNumber(value);
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(locale(), { style: "percent", maximumFractionDigits: 1 }).format(value);
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    if (seconds < 1) return t("analytics.duration.lessSecond");
    if (seconds < 60) return t("analytics.duration.second", null, { value: Math.round(seconds) });
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remaining = Math.round(seconds % 60);
      return t("analytics.duration.minute", null, { value: minutes }) + (remaining ? " " + t("analytics.duration.second", null, { value: remaining }) : "");
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return t("analytics.duration.hour", null, { value: hours }) + (minutes ? " " + t("analytics.duration.minute", null, { value: minutes }) : "");
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.round((seconds % 86400) / 3600);
    return t("analytics.duration.day", null, { value: days }) + (hours ? " " + t("analytics.duration.hour", null, { value: hours }) : "");
  }

  function formatDate(timestamp, withSeconds) {
    const safeTimestamp = timestampOrNull(timestamp);
    if (safeTimestamp === null) return t("analytics.raw.unknownDate");
    try {
      return new Intl.DateTimeFormat(locale(), {
        dateStyle: "medium",
        timeStyle: withSeconds ? "medium" : "short"
      }).format(new Date(safeTimestamp));
    } catch {
      return t("analytics.raw.unknownDate");
    }
  }

  function formatChartTime(timestamp, span) {
    const safeTimestamp = timestampOrNull(timestamp);
    if (safeTimestamp === null) return "—";
    const opts = span > 86400000
      ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
      : { hour: "2-digit", minute: "2-digit", second: span < 600000 ? "2-digit" : undefined };
    try {
      return new Intl.DateTimeFormat(locale(), opts).format(new Date(safeTimestamp));
    } catch {
      return "—";
    }
  }

  function formatRelativeAge(timestamp) {
    const safeTimestamp = timestampOrNull(timestamp);
    if (safeTimestamp === null) return t("analytics.raw.unknownDate");
    const elapsed = Math.max(0, Date.now() - safeTimestamp);
    if (elapsed < 5000) return t("analytics.common.now");
    const formatter = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
    if (elapsed < 60000) return formatter.format(-Math.round(elapsed / 1000), "second");
    if (elapsed < 3600000) return formatter.format(-Math.round(elapsed / 60000), "minute");
    if (elapsed < 86400000) return formatter.format(-Math.round(elapsed / 3600000), "hour");
    return formatter.format(-Math.round(elapsed / 86400000), "day");
  }

  function humanizeId(id) {
    if (typeof id !== "string" || !id) return t("analytics.common.unknown");
    return id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, function (letter) {
      return letter.toUpperCase();
    });
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function normalizeStats(raw) {
    const stats = raw && typeof raw === "object" ? raw : {};
    return {
      quality: finiteOrNull(stats.quality),
      footprint: finiteOrNull(stats.footprint),
      brandImage: finiteOrNull(stats.brandImage !== undefined ? stats.brandImage : stats.image)
    };
  }

  function normalizeAnalytics(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const analytics = { ...raw, coverageStart: timestampOrNull(raw.coverageStart) };
    if (raw.currentRun && typeof raw.currentRun === "object" && !Array.isArray(raw.currentRun)) {
      analytics.currentRun = {
        ...raw.currentRun,
        startedAt: timestampOrNull(raw.currentRun.startedAt)
      };
    }
    analytics.runSummaries = Array.isArray(raw.runSummaries)
      ? raw.runSummaries
          .filter(run => run && typeof run === "object" && !Array.isArray(run))
          .slice(-20)
          .map(run => ({
            ...run,
            startedAt: timestampOrNull(run.startedAt),
            endedAt: timestampOrNull(run.endedAt)
          }))
      : [];
    return analytics;
  }

  function normalizeSnapshot(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const schemaVersion = raw.schemaVersion === 2 ? 2 : 1;
    const currentSource = schemaVersion === 2 && raw.current && typeof raw.current === "object" ? raw.current : raw;
    const economics = raw.economics && typeof raw.economics === "object" ? raw.economics : {};
    const automatic = economics.automatic && typeof economics.automatic === "object"
      ? economics.automatic
      : raw.automatic && typeof raw.automatic === "object"
      ? raw.automatic
      : {};
    const analytics = normalizeAnalytics(raw.analytics);
    const investmentsSource = Array.isArray(economics.investments)
      ? economics.investments
      : Array.isArray(economics.investmentRows)
      ? economics.investmentRows
      : Array.isArray(raw.investments)
      ? raw.investments
      : [];
    const prestige = economics.prestige && typeof economics.prestige === "object"
      ? economics.prestige
      : raw.prestige && typeof raw.prestige === "object"
      ? raw.prestige
      : null;
    const buildings = Array.isArray(currentSource.buildings)
      ? currentSource.buildings
      : Array.isArray(raw.buildings)
      ? raw.buildings
      : [];
    const normalizedInvestments = investmentsSource.filter(function (row) {
      return row && typeof row === "object" && !Array.isArray(row);
    });
    if (schemaVersion === 1 && normalizedInvestments.length === 0) {
      buildings.forEach(function (building) {
        if (!building || typeof building !== "object") return;
        normalizedInvestments.push({
          id: typeof building.id === "string" ? building.id : null,
          nameKey: typeof building.nameKey === "string" ? building.nameKey : null,
          role: null,
          quantity: finiteOrNull(building.quantity),
          currentDirectProduction: finiteOrNull(building.production),
          totalInvested: null,
          currentCost: null,
          marginalDocPerSecond: null,
          marginalCcPerSecond: null,
          paybackSeconds: null,
          affordSeconds: null,
          status: "unavailable",
          isUnlocked: null
        });
      });
    }
    const stats = normalizeStats(currentSource.stats || raw.stats);
    const docPerSecond = finiteOrNull(
      currentSource.docPerSecond !== undefined ? currentSource.docPerSecond : automatic.docPerSecond
    );
    const ccPerSecond = finiteOrNull(
      currentSource.ccPerSecond !== undefined
        ? currentSource.ccPerSecond
        : automatic.ccPerSecond !== undefined
        ? automatic.ccPerSecond
        : automatic.automaticCcPerSecond
    );
    const buildingCount = finiteOrNull(currentSource.buildingCount) !== null
      ? finiteOrNull(currentSource.buildingCount)
      : buildings.reduce(function (sum, building) {
          return sum + Math.max(0, finite(building && building.quantity, 0));
        }, 0);

    return {
      schemaVersion: schemaVersion,
      modelVersion: finiteOrNull(raw.modelVersion) || finiteOrNull(automatic.formulaVersion),
      generatedAt: timestampOrNull(raw.generatedAt),
      runId: typeof raw.runId === "string" ? raw.runId : analytics && analytics.currentRun && analytics.currentRun.id,
      coverageStart: timestampOrNull(raw.coverageStart) || (analytics ? analytics.coverageStart : null),
      partialHistory: Boolean(raw.partialHistory || (analytics && analytics.partialHistory) || schemaVersion === 1),
      current: {
        docPerSecond: docPerSecond,
        ccPerSecond: ccPerSecond,
        docBank: finiteOrNull(currentSource.docBank),
        docTotal: finiteOrNull(currentSource.docTotal),
        ccTotal: finiteOrNull(currentSource.ccTotal),
        culturePoints: finiteOrNull(currentSource.culturePoints),
        prestigeMult: finiteOrNull(currentSource.prestigeMult) || finiteOrNull(automatic.prestigeMultiplier),
        buildingCount: buildingCount,
        stats: stats,
        buildings: buildings
      },
      economics: {
        automatic: automatic,
        investments: normalizedInvestments,
        prestige: prestige
      },
      analytics: analytics,
      raw: raw
    };
  }

  function normalizeHistory(raw, snapshot) {
    const envelope = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const source = Array.isArray(raw) ? raw : Array.isArray(envelope.samples) ? envelope.samples : [];
    const byTimestamp = new Map();

    source.forEach(function (sample) {
      if (!sample || typeof sample !== "object") return;
      const generatedAt = timestampOrNull(
        sample.generatedAt !== undefined ? sample.generatedAt : sample.timestamp !== undefined ? sample.timestamp : sample.t
      );
      if (generatedAt === null) return;
      const normalized = {
        generatedAt: generatedAt,
        runId: typeof sample.runId === "string" ? sample.runId : null,
        docPerSecond: finiteOrNull(sample.docPerSecond !== undefined ? sample.docPerSecond : sample.dps),
        ccPerSecond: finiteOrNull(sample.ccPerSecond !== undefined ? sample.ccPerSecond : sample.cps),
        docBank: finiteOrNull(sample.docBank),
        docTotal: finiteOrNull(sample.docTotal !== undefined ? sample.docTotal : sample.total),
        ccTotal: finiteOrNull(sample.ccTotal),
        quality: finiteOrNull(sample.quality),
        footprint: finiteOrNull(sample.footprint),
        brandImage: finiteOrNull(sample.brandImage !== undefined ? sample.brandImage : sample.image)
      };
      byTimestamp.set(String(generatedAt) + "|" + (normalized.runId || ""), normalized);
    });

    if (snapshot && timestampOrNull(snapshot.generatedAt) !== null) {
      const current = snapshot.current;
      const key = String(snapshot.generatedAt) + "|" + (snapshot.runId || "");
      if (!byTimestamp.has(key)) {
        byTimestamp.set(key, {
          generatedAt: snapshot.generatedAt,
          runId: snapshot.runId || null,
          docPerSecond: current.docPerSecond,
          ccPerSecond: current.ccPerSecond,
          docBank: current.docBank,
          docTotal: current.docTotal,
          ccTotal: current.ccTotal,
          quality: current.stats.quality,
          footprint: current.stats.footprint,
          brandImage: current.stats.brandImage
        });
      }
    }

    return Array.from(byTimestamp.values())
      .sort(function (a, b) { return a.generatedAt - b.generatedAt; })
      .slice(-MAX_HISTORY_ROWS);
  }

  function reconcileHistoryCoverage(snapshot, envelope) {
    if (!snapshot) return;
    const samples = Array.isArray(envelope)
      ? envelope
      : envelope && Array.isArray(envelope.samples)
      ? envelope.samples
      : [];
    if (
      snapshot.schemaVersion >= 2 &&
      (!samples.length || samples.length > MAX_HISTORY_ROWS || Boolean(envelope && envelope.partialHistory))
    ) {
      snapshot.partialHistory = true;
    }
  }

  function readLocalStorage() {
    let snapshotRaw = null;
    let historyRaw = null;
    try {
      snapshotRaw = window.localStorage.getItem(SNAPSHOT_KEY);
      historyRaw = window.localStorage.getItem(HISTORY_KEY);
    } catch {
      return { snapshotRaw: null, historyRaw: null };
    }
    return { snapshotRaw: snapshotRaw, historyRaw: historyRaw };
  }

  function readBridge() {
    const bridge = window.__PE_DASH__;
    if (!bridge || typeof bridge.getSnapshot !== "function") return null;
    try {
      return {
        snapshot: bridge.getSnapshot(),
        history: typeof bridge.getHistory === "function" ? bridge.getHistory() : null
      };
    } catch {
      return null;
    }
  }

  function refreshSources(force) {
    const bridgeData = readBridge();
    if (bridgeData) {
      state.snapshot = normalizeSnapshot(bridgeData.snapshot);
      state.historyEnvelope = bridgeData.history;
      reconcileHistoryCoverage(state.snapshot, state.historyEnvelope);
      state.history = normalizeHistory(bridgeData.history, state.snapshot);
      renderAll();
      return;
    }

    const local = readLocalStorage();
    const changed = force || local.snapshotRaw !== state.lastSnapshotRaw || local.historyRaw !== state.lastHistoryRaw;
    if (!changed) {
      renderFreshness();
      return;
    }
    state.lastSnapshotRaw = local.snapshotRaw;
    state.lastHistoryRaw = local.historyRaw;
    const rawSnapshot = safeParse(local.snapshotRaw);
    const rawHistory = safeParse(local.historyRaw);
    state.snapshot = normalizeSnapshot(rawSnapshot);
    state.historyEnvelope = rawHistory;
    reconcileHistoryCoverage(state.snapshot, state.historyEnvelope);
    state.history = normalizeHistory(rawHistory, state.snapshot);
    renderAll();
  }

  function setText(element, value) {
    if (!element) return;
    const next = String(value);
    if (element.textContent !== next) element.textContent = next;
  }

  function renderFreshness() {
    if (!els) return;
    const snapshot = state.snapshot;
    els.dataStateChip.classList.remove("is-live", "is-fresh", "is-stale", "is-legacy", "is-empty", "is-invalid");

    if (!snapshot) {
      els.dataStateChip.classList.add(state.lastSnapshotRaw ? "is-invalid" : "is-empty");
      setText(els.dataStateLabel, t(state.lastSnapshotRaw ? "analytics.status.invalid" : "analytics.status.waiting"));
      setText(els.dataFreshness, "—");
      setText(els.dataCoverage, "—");
      setText(els.dataModelVersion, "—");
      return;
    }

    if (timestampOrNull(snapshot.generatedAt) === null) {
      els.dataStateChip.classList.add("is-legacy");
      setText(els.dataStateLabel, t("analytics.status.legacy"));
      setText(els.dataFreshness, t("analytics.raw.unknownDate"));
    } else {
      const age = Math.max(0, Date.now() - snapshot.generatedAt);
      const status = age <= LIVE_AGE_MS ? "live" : age <= FRESH_AGE_MS ? "fresh" : "stale";
      els.dataStateChip.classList.add("is-" + status);
      setText(els.dataStateLabel, t("analytics.status." + status));
      setText(els.dataFreshness, formatRelativeAge(snapshot.generatedAt));
      els.dataFreshness.title = formatDate(snapshot.generatedAt, true);
    }

    const coverageStart = snapshot.coverageStart || timestampOrNull(state.historyEnvelope && state.historyEnvelope.coverageStart);
    if (timestampOrNull(coverageStart) !== null) {
      const duration = formatDuration(Math.max(0, Date.now() - coverageStart) / 1000);
      setText(els.dataCoverage, (snapshot.partialHistory ? "≈ " : "") + duration);
      els.dataCoverage.title = formatDate(coverageStart, true);
    } else if (state.history.length > 1) {
      setText(els.dataCoverage, formatDuration((state.history[state.history.length - 1].generatedAt - state.history[0].generatedAt) / 1000));
    } else {
      setText(els.dataCoverage, snapshot.schemaVersion === 1 ? t("analytics.coverage.legacy") : "—");
    }

    const model = snapshot.modelVersion
      ? t("analytics.meta.modelValue", null, { schema: snapshot.schemaVersion, model: snapshot.modelVersion })
      : "V" + snapshot.schemaVersion;
    setText(els.dataModelVersion, model);
  }

  function trendReference(metric) {
    const points = state.history.filter(function (sample) { return Number.isFinite(sample[metric]); });
    if (points.length < 2) return null;
    const latest = points[points.length - 1];
    const target = latest.generatedAt - 60000;
    let reference = points[0];
    for (let index = points.length - 2; index >= 0; index -= 1) {
      if (points[index].generatedAt <= target) {
        reference = points[index];
        break;
      }
    }
    return { reference: reference, latest: latest };
  }

  function renderKpis() {
    const snapshot = state.snapshot;
    if (!snapshot) {
      [els.kpiDocRate, els.kpiCcRate, els.kpiDocBank, els.kpiDocTotal, els.kpiCcTotal, els.kpiCulture].forEach(function (element) {
        setText(element, "—");
      });
      setText(els.kpiDocTrend, t("analytics.trend.none"));
      setText(els.kpiPrestigeOutlook, "—");
      setText(els.kpiBuildingCount, "—");
      return;
    }

    const current = snapshot.current;
    setText(els.kpiDocRate, formatNumber(current.docPerSecond) + " DOC/s");
    setText(els.kpiCcRate, Number.isFinite(current.ccPerSecond) ? formatNumber(current.ccPerSecond) + " CC/s" : "—");
    setText(els.kpiDocBank, formatNumber(current.docBank) + " DOC");
    setText(els.kpiDocTotal, formatNumber(current.docTotal) + " DOC");
    setText(els.kpiCcTotal, formatNumber(current.ccTotal) + " CC");
    const multiplier = Number.isFinite(current.prestigeMult) ? " · ×" + formatNumber(current.prestigeMult) : "";
    setText(els.kpiCulture, formatNumber(current.culturePoints) + multiplier);
    setText(els.kpiBuildingCount, t("analytics.common.buildings", null, { count: formatNumber(current.buildingCount) }));

    const trend = trendReference("docPerSecond");
    if (!trend) {
      setText(els.kpiDocTrend, state.history.length ? t("analytics.trend.single") : t("analytics.trend.none"));
    } else {
      const delta = trend.latest.docPerSecond - trend.reference.docPerSecond;
      const duration = formatDuration((trend.latest.generatedAt - trend.reference.generatedAt) / 1000);
      const key = Math.abs(delta) < 0.0005 ? "analytics.trend.flat" : delta > 0 ? "analytics.trend.up" : "analytics.trend.down";
      setText(els.kpiDocTrend, t(key, null, { value: formatSigned(delta) + " DOC/s", duration: duration }));
      els.kpiDocTrend.classList.toggle("is-up", delta > 0.0005);
      els.kpiDocTrend.classList.toggle("is-down", delta < -0.0005);
    }

    const prestige = snapshot.economics.prestige;
    if (prestige && prestige.status !== "unavailable") {
      const gain = finiteOrNull(prestige.potentialCultureGain !== undefined ? prestige.potentialCultureGain : prestige.potentialCulture);
      if (prestige.actionable && Number.isFinite(gain)) {
        setText(els.kpiPrestigeOutlook, t("analytics.prestige.gain", null, { value: formatNumber(gain) }));
      } else if (prestige.etaToRequirement && Number.isFinite(prestige.etaToRequirement.value)) {
        setText(els.kpiPrestigeOutlook, t("analytics.prestige.eta", null, { duration: formatDuration(prestige.etaToRequirement.value) }));
      } else if (Number.isFinite(prestige.ccToRequirement)) {
        setText(els.kpiPrestigeOutlook, t("analytics.prestige.gap", null, { value: formatNumber(prestige.ccToRequirement) }));
      } else {
        setText(els.kpiPrestigeOutlook, "—");
      }
    } else {
      setText(els.kpiPrestigeOutlook, snapshot.schemaVersion === 1 ? t("analytics.prestige.legacy") : "—");
    }
  }

  function svgElement(name, attrs, textContent) {
    const element = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      element.setAttribute(key, String(attrs[key]));
    });
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }

  function niceMaximum(value) {
    if (!(value > 0)) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
  }

  function renderTrendChart() {
    const metric = state.metric;
    const points = state.history.filter(function (sample) {
      return Number.isFinite(sample.generatedAt) && Number.isFinite(sample[metric]);
    });
    const svg = els.analyticsTrendChart;
    const chartTitle = svg.querySelector("title");
    const chartDescription = svg.querySelector("desc");
    svg.replaceChildren(...[chartTitle, chartDescription].filter(Boolean));
    state.chartGeometry = null;

    if (points.length < 2) {
      els.trendEmptyState.hidden = false;
      setText(els.trendSummary, points.length ? t("analytics.trend.single") : t("analytics.trend.none"));
      setText(els.trendChartDescription, t("analytics.trend.none"));
      renderHistoryTable();
      return;
    }

    els.trendEmptyState.hidden = true;
    const width = Math.max(420, els.trendChartWrap.clientWidth || 840);
    const height = 260;
    const pad = { left: 58, right: 18, top: 18, bottom: 42 };
    const minTime = points[0].generatedAt;
    const maxTime = points[points.length - 1].generatedAt;
    const timeSpan = Math.max(1, maxTime - minTime);
    const maxValue = niceMaximum(Math.max.apply(null, points.map(function (point) { return Math.max(0, point[metric]); })) * 1.05);
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const geometry = points.map(function (point) {
      return {
        sample: point,
        x: pad.left + ((point.generatedAt - minTime) / timeSpan) * plotWidth,
        y: pad.top + plotHeight - (clamp(point[metric], 0, maxValue) / maxValue) * plotHeight
      };
    });
    state.chartGeometry = { points: geometry, width: width, height: height, pad: pad, metric: metric };
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);

    [0, 0.25, 0.5, 0.75, 1].forEach(function (ratio) {
      const y = pad.top + plotHeight - ratio * plotHeight;
      svg.appendChild(svgElement("line", { class: "analytics-grid-line", x1: pad.left, y1: y, x2: width - pad.right, y2: y }));
      svg.appendChild(svgElement("text", { class: "analytics-axis-label", x: pad.left - 8, y: y + 4, "text-anchor": "end" }, formatNumber(maxValue * ratio)));
    });

    [0, 0.5, 1].forEach(function (ratio) {
      const timestamp = minTime + ratio * timeSpan;
      const x = pad.left + ratio * plotWidth;
      svg.appendChild(svgElement("text", {
        class: "analytics-axis-label analytics-axis-time",
        x: x,
        y: height - 12,
        "text-anchor": ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"
      }, formatChartTime(timestamp, timeSpan)));
    });

    const intervals = points.slice(1).map(function (point, index) {
      return point.generatedAt - points[index].generatedAt;
    }).filter(function (interval) { return interval > 0; }).sort(function (a, b) { return a - b; });
    const medianInterval = intervals.length ? intervals[Math.floor((intervals.length - 1) / 2)] : timeSpan;
    // A sparse two-point history must not make an overnight interruption the
    // median and connect it as a continuous line. Ninety seconds is already
    // six times the nominal 15 s sampler cadence.
    const gapThreshold = Math.max(30000, Math.min(90000, medianInterval * 3));
    const segments = [[]];
    geometry.forEach(function (point, index) {
      if (index > 0 && point.sample.generatedAt - geometry[index - 1].sample.generatedAt > gapThreshold) {
        segments.push([]);
      }
      segments[segments.length - 1].push(point);
    });
    segments.forEach(function (segment) {
      if (segment.length === 1) {
        svg.appendChild(svgElement("circle", { class: "analytics-chart-dot is-isolated", cx: segment[0].x, cy: segment[0].y, r: 3 }));
        return;
      }
      const pathData = segment.map(function (point, index) {
        return (index ? "L" : "M") + point.x.toFixed(2) + "," + point.y.toFixed(2);
      }).join(" ");
      const areaData = pathData + " L" + segment[segment.length - 1].x.toFixed(2) + "," + (height - pad.bottom) + " L" + segment[0].x.toFixed(2) + "," + (height - pad.bottom) + " Z";
      svg.appendChild(svgElement("path", { class: "analytics-chart-area", d: areaData }));
      svg.appendChild(svgElement("path", { class: "analytics-chart-line", d: pathData }));
    });

    const hover = svgElement("g", { class: "analytics-chart-hover", hidden: "" });
    hover.appendChild(svgElement("line", { class: "analytics-chart-crosshair", y1: pad.top, y2: height - pad.bottom }));
    hover.appendChild(svgElement("circle", { class: "analytics-chart-dot", r: 4 }));
    svg.appendChild(hover);

    const first = points[0];
    const last = points[points.length - 1];
    const delta = last[metric] - first[metric];
    const duration = formatDuration(timeSpan / 1000);
    const unit = metric === "docPerSecond" ? " DOC/s" : " CC/s";
    const summaryKey = Math.abs(delta) < 0.0005 ? "analytics.trend.flat" : delta > 0 ? "analytics.trend.up" : "analytics.trend.down";
    const gapCount = Math.max(0, segments.length - 1);
    const summary = t(summaryKey, null, { value: formatSigned(delta) + unit, duration: duration }) + " · " + t("analytics.common.samples", null, { count: points.length }) + (gapCount ? " · " + t("analytics.trend.gaps", null, { count: gapCount }) : "");
    setText(els.trendSummary, summary);
    setText(els.trendChartDescription, summary + ". " + formatDate(minTime, true) + " — " + formatDate(maxTime, true) + ".");
    renderHistoryTable();
  }

  function closestChartPoint(event) {
    const geometry = state.chartGeometry;
    if (!geometry || !geometry.points.length) return null;
    const rect = els.analyticsTrendChart.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * geometry.width;
    let closest = geometry.points[0];
    let distance = Math.abs(closest.x - viewX);
    geometry.points.forEach(function (point) {
      const nextDistance = Math.abs(point.x - viewX);
      if (nextDistance < distance) {
        closest = point;
        distance = nextDistance;
      }
    });
    return closest;
  }

  function showChartTip(event) {
    const point = closestChartPoint(event);
    const geometry = state.chartGeometry;
    if (!point || !geometry) return;
    const hover = els.analyticsTrendChart.querySelector(".analytics-chart-hover");
    if (hover) {
      hover.removeAttribute("hidden");
      const line = hover.querySelector("line");
      const dot = hover.querySelector("circle");
      line.setAttribute("x1", point.x);
      line.setAttribute("x2", point.x);
      dot.setAttribute("cx", point.x);
      dot.setAttribute("cy", point.y);
    }
    const unit = geometry.metric === "docPerSecond" ? " DOC/s" : " CC/s";
    setText(els.trendChartTip, formatNumber(point.sample[geometry.metric]) + unit + " · " + formatDate(point.sample.generatedAt, true));
    els.trendChartTip.hidden = false;
    const wrapRect = els.trendChartWrap.getBoundingClientRect();
    const chartRect = els.analyticsTrendChart.getBoundingClientRect();
    const left = chartRect.left - wrapRect.left + (point.x / geometry.width) * chartRect.width;
    const top = chartRect.top - wrapRect.top + (point.y / geometry.height) * chartRect.height;
    els.trendChartTip.style.left = clamp(left + 10, 8, Math.max(8, wrapRect.width - 210)) + "px";
    els.trendChartTip.style.top = Math.max(6, top - 42) + "px";
  }

  function hideChartTip() {
    els.trendChartTip.hidden = true;
    const hover = els.analyticsTrendChart.querySelector(".analytics-chart-hover");
    if (hover) hover.setAttribute("hidden", "");
  }

  function renderHistoryTable() {
    if (!els.historyTableDetails.open) return;
    const fragment = document.createDocumentFragment();
    state.history.slice().reverse().forEach(function (sample) {
      const row = document.createElement("tr");
      [
        formatDate(sample.generatedAt, true),
        Number.isFinite(sample.docPerSecond) ? formatNumber(sample.docPerSecond) + " DOC/s" : "—",
        Number.isFinite(sample.ccPerSecond) ? formatNumber(sample.ccPerSecond) + " CC/s" : "—",
        Number.isFinite(sample.docBank) ? formatNumber(sample.docBank) + " DOC" : "—"
      ].forEach(function (value) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      fragment.appendChild(row);
    });
    els.historyTableBody.replaceChildren(fragment);
  }

  function investmentName(row) {
    return t(row.nameKey, humanizeId(row.id));
  }

  function investmentRows() {
    return state.snapshot ? state.snapshot.economics.investments.slice() : [];
  }

  function recommendation(rows) {
    return rows
      .filter(function (row) {
        return row.isUnlocked !== false && row.status !== "unavailable" && Number.isFinite(row.paybackSeconds) && row.paybackSeconds >= 0 && Number.isFinite(row.marginalDocPerSecond) && row.marginalDocPerSecond > 0;
      })
      .sort(function (a, b) {
        if (a.paybackSeconds !== b.paybackSeconds) return a.paybackSeconds - b.paybackSeconds;
        return finite(a.currentCost, Infinity) - finite(b.currentCost, Infinity);
      })[0] || null;
  }

  function updateRecommendationImage(row) {
    const id = row && BUILDING_IDS.has(row.id) ? row.id : null;
    if (id === state.lastRecommendedId) return;
    state.lastRecommendedId = id;
    const requestToken = ++state.recommendationImageToken;
    const visual = els.recommendationImage.closest(".recommendation-visual");
    const animateVisual = function () {
      if (!visual || prefersReducedMotion()) return;
      visual.classList.remove("is-updating");
      void visual.offsetWidth;
      requestAnimationFrame(function () {
        if (requestToken !== state.recommendationImageToken) return;
        visual.classList.add("is-updating");
        window.setTimeout(function () { visual.classList.remove("is-updating"); }, 300);
      });
    };

    if (!id) {
      els.recommendationImage.hidden = true;
      els.recommendationImage.removeAttribute("src");
      els.recommendationPlaceholder.hidden = false;
      animateVisual();
      return;
    }

    const candidates = [
      assetUrl("/assets/images/building-" + id + "-v4.webp"),
      assetUrl("/assets/images/building-" + id + ".webp")
    ];
    const loadCandidate = function (index) {
      const preload = new Image();
      preload.onload = function () {
        if (requestToken !== state.recommendationImageToken) return;
        els.recommendationImage.src = preload.src;
        els.recommendationImage.hidden = false;
        els.recommendationPlaceholder.hidden = true;
        animateVisual();
      };
      preload.onerror = function () {
        if (requestToken !== state.recommendationImageToken) return;
        if (index + 1 < candidates.length) {
          loadCandidate(index + 1);
          return;
        }
        els.recommendationImage.hidden = true;
        els.recommendationPlaceholder.hidden = false;
        els.recommendationPlaceholder.textContent = id.slice(0, 2).toUpperCase();
        els.recommendationPlaceholder.title = t("analytics.investment.imageFallback");
        animateVisual();
      };
      preload.src = candidates[index];
    };
    loadCandidate(0);
  }

  function renderRecommendation() {
    const rows = investmentRows();
    const best = recommendation(rows);
    updateRecommendationImage(best);

    if (!best) {
      setText(els.recommendationTitle, t("analytics.recommendation.waiting"));
      setText(els.recommendationReason, t("analytics.recommendation.none"));
      [els.recommendationCost, els.recommendationDocGain, els.recommendationPayback, els.recommendationAfford, els.projectionValue, els.projectionDelta].forEach(function (element) {
        setText(element, "—");
      });
      els.recommendationPanel.classList.add("is-empty");
      return;
    }

    els.recommendationPanel.classList.remove("is-empty");
    setText(els.recommendationTitle, investmentName(best));
    const affordable = state.snapshot && Number.isFinite(state.snapshot.current.docBank) && Number.isFinite(best.currentCost) && state.snapshot.current.docBank >= best.currentCost;
    setText(els.recommendationReason, t(affordable ? "analytics.recommendation.reason" : "analytics.recommendation.saving"));
    setText(els.recommendationCost, Number.isFinite(best.currentCost) ? formatNumber(best.currentCost) + " DOC" : "—");
    setText(els.recommendationDocGain, Number.isFinite(best.marginalDocPerSecond) ? "+" + formatNumber(best.marginalDocPerSecond) + " DOC/s" : "—");
    setText(els.recommendationPayback, Number.isFinite(best.paybackSeconds) ? "≈ " + formatDuration(best.paybackSeconds) : "—");
    setText(els.recommendationAfford, Number.isFinite(best.affordSeconds) ? (best.affordSeconds === 0 ? t("analytics.common.now") : "≈ " + formatDuration(best.affordSeconds)) : "—");
    renderProjection(best);
  }

  function renderProjection(bestRow) {
    const snapshot = state.snapshot;
    const horizon = Number(els.projectionHorizon.value);
    const currentRate = snapshot ? snapshot.current.docPerSecond : null;
    if (!snapshot || !Number.isFinite(horizon) || !Number.isFinite(currentRate)) {
      setText(els.projectionValue, "—");
      setText(els.projectionDelta, "—");
      return;
    }
    const baseline = currentRate * horizon;
    const delta = bestRow && Number.isFinite(bestRow.marginalDocPerSecond) ? bestRow.marginalDocPerSecond * horizon : null;
    setText(els.projectionValue, t("analytics.projection.base", null, { value: formatNumber(baseline) }));
    setText(els.projectionDelta, Number.isFinite(delta) ? t("analytics.projection.delta", null, { value: formatNumber(delta) }) : "—");
  }

  function compareInvestmentRows(a, b) {
    const column = state.sort.column;
    const direction = state.sort.direction === "ascending" ? 1 : -1;
    let av;
    let bv;
    if (column === "name") {
      av = investmentName(a);
      bv = investmentName(b);
      return av.localeCompare(bv, locale()) * direction;
    }
    if (column === "status") {
      const rank = { exact: 0, estimated: 1, unavailable: 2 };
      av = a.isUnlocked === false ? 3 : rank[a.status] !== undefined ? rank[a.status] : 2;
      bv = b.isUnlocked === false ? 3 : rank[b.status] !== undefined ? rank[b.status] : 2;
    } else {
      av = finiteOrNull(a[column]);
      bv = finiteOrNull(b[column]);
      if (av === null && bv === null) return investmentName(a).localeCompare(investmentName(b), locale());
      if (av === null) return 1;
      if (bv === null) return -1;
    }
    if (av === bv) return investmentName(a).localeCompare(investmentName(b), locale());
    return (av < bv ? -1 : 1) * direction;
  }

  function statusLabel(row) {
    if (row.isUnlocked === false) return t("analytics.common.locked");
    if (row.status === "exact") return t("analytics.common.exact");
    if (row.status === "estimated") return t("analytics.common.estimated");
    return t("analytics.common.unavailable");
  }

  function addTableCell(row, value, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
  }

  function renderInvestmentTable() {
    const rows = investmentRows().sort(compareInvestmentRows);
    setText(els.investmentCount, t("analytics.investment.analyzed", null, { count: rows.length }));
    els.investmentEmptyState.hidden = rows.length > 0;
    els.investmentTable.hidden = rows.length === 0;

    const fragment = document.createDocumentFragment();
    rows.forEach(function (item) {
      const row = document.createElement("tr");
      row.dataset.buildingId = typeof item.id === "string" ? item.id : "unknown";
      row.classList.toggle("is-locked", item.isUnlocked === false);
      row.classList.toggle("is-recommended", state.lastRecommendedId === item.id);

      const nameCell = document.createElement("th");
      nameCell.scope = "row";
      const name = document.createElement("strong");
      name.textContent = investmentName(item);
      nameCell.appendChild(name);
      if (item.role) {
        const role = document.createElement("small");
        role.textContent = t("analytics.role." + item.role, humanizeId(item.role));
        nameCell.appendChild(role);
      }
      row.appendChild(nameCell);

      addTableCell(row, Number.isFinite(item.quantity) ? formatNumber(item.quantity) : "—", "is-number");
      addTableCell(row, Number.isFinite(item.currentDirectProduction) ? formatNumber(item.currentDirectProduction) + " DOC/s" : "—", "is-number");
      addTableCell(row, Number.isFinite(item.totalInvested) ? "≈ " + formatNumber(item.totalInvested) + " DOC" : "—", "is-number is-estimate");
      addTableCell(row, Number.isFinite(item.currentCost) ? formatNumber(item.currentCost) + " DOC" : "—", "is-number");
      addTableCell(row, Number.isFinite(item.marginalDocPerSecond) ? formatSigned(item.marginalDocPerSecond) : "—", "is-number");
      addTableCell(row, Number.isFinite(item.marginalCcPerSecond) ? formatSigned(item.marginalCcPerSecond) : "—", "is-number");
      addTableCell(row, Number.isFinite(item.paybackSeconds) ? "≈ " + formatDuration(item.paybackSeconds) : "—", "is-number is-estimate");
      addTableCell(row, Number.isFinite(item.affordSeconds) ? (item.affordSeconds === 0 ? t("analytics.common.now") : "≈ " + formatDuration(item.affordSeconds)) : "—", "is-number is-estimate");
      const statusCell = addTableCell(row, statusLabel(item), "investment-status");
      statusCell.dataset.status = item.isUnlocked === false ? "locked" : item.status || "unavailable";
      fragment.appendChild(row);
    });
    els.investmentTableBody.replaceChildren(fragment);

    els.investmentTable.querySelectorAll("th[data-sort-column]").forEach(function (header) {
      const active = header.dataset.sortColumn === state.sort.column;
      header.setAttribute("aria-sort", active ? state.sort.direction : "none");
    });
  }

  function renderFlowList(container, definitions) {
    const snapshot = state.snapshot;
    const run = snapshot && snapshot.analytics && snapshot.analytics.currentRun;
    container.replaceChildren();
    if (!run) {
      const empty = document.createElement("p");
      empty.className = "data-empty-state";
      empty.textContent = t("analytics.flow.empty");
      container.appendChild(empty);
      return null;
    }

    const values = definitions.map(function (definition) {
      return { key: definition.key, label: t(definition.label), value: finite(run[definition.key], 0) };
    });
    const totalAbsolute = values.reduce(function (sum, item) { return sum + Math.abs(item.value); }, 0);
    values.forEach(function (item) {
      const row = document.createElement("div");
      row.className = "flow-row";
      if (item.value < 0) row.classList.add("is-negative");
      const head = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = item.label;
      value.textContent = formatSigned(item.value);
      head.append(label, value);
      const track = document.createElement("div");
      track.className = "flow-track";
      track.setAttribute("role", "img");
      const ratio = totalAbsolute > 0 ? Math.abs(item.value) / totalAbsolute : 0;
      track.setAttribute("aria-label", item.label + ": " + formatSigned(item.value) + ", " + formatPercent(ratio));
      const bar = document.createElement("span");
      bar.className = "flow-bar";
      bar.style.width = (ratio * 100).toFixed(2) + "%";
      track.appendChild(bar);
      row.append(head, track);
      container.appendChild(row);
    });
    return values.reduce(function (sum, item) { return sum + item.value; }, 0);
  }

  function renderFlows() {
    const docTotal = renderFlowList(els.docFlowList, [
      { key: "autoDocs", label: "analytics.flow.autoDoc" },
      { key: "manualDocs", label: "analytics.flow.manualDoc" },
      { key: "offlineDocs", label: "analytics.flow.offlineDoc" },
      { key: "contractDocs", label: "analytics.flow.contractDoc" },
      { key: "eventDocNet", label: "analytics.flow.eventDoc" }
    ]);
    const ccTotal = renderFlowList(els.ccFlowList, [
      { key: "autoCc", label: "analytics.flow.autoCc" },
      { key: "contractCc", label: "analytics.flow.contractCc" },
      { key: "eventCcNet", label: "analytics.flow.eventCc" }
    ]);
    setText(els.docFlowTotal, docTotal === null ? "—" : formatSigned(docTotal) + " DOC");
    setText(els.ccFlowTotal, ccTotal === null ? "—" : formatSigned(ccTotal) + " CC");
  }

  function firstHistoricGauge(key) {
    for (let index = 0; index < state.history.length; index += 1) {
      if (Number.isFinite(state.history[index][key])) return state.history[index][key];
    }
    return null;
  }

  function renderGauge(meter, valueElement, deltaElement, value, historyKey, higherIsBetter = true) {
    const safeValue = Number.isFinite(value) ? clamp(value, 0, 1) : 0;
    const semanticScore = higherIsBetter ? safeValue : 1 - safeValue;
    meter.value = safeValue;
    meter.textContent = formatPercent(safeValue);
    meter.classList.toggle("is-warning", semanticScore >= 0.35 && semanticScore < 0.65);
    meter.classList.toggle("is-bad", semanticScore < 0.35);
    setText(valueElement, Number.isFinite(value) ? formatPercent(value) : "—");
    const first = firstHistoricGauge(historyKey);
    if (Number.isFinite(value) && Number.isFinite(first) && state.history.length > 1) {
      const points = (value - first) * 100;
      const semanticPoints = higherIsBetter ? points : -points;
      setText(deltaElement, t("analytics.gauge.delta", null, { value: (points > 0 ? "+" : "") + formatNumber(points) }));
      deltaElement.classList.toggle("is-good", semanticPoints > 0.05);
      deltaElement.classList.toggle("is-bad", semanticPoints < -0.05);
    } else {
      setText(deltaElement, t("analytics.gauge.noHistory"));
      deltaElement.classList.remove("is-good", "is-bad");
    }
  }

  function renderGauges() {
    const stats = state.snapshot ? state.snapshot.current.stats : {};
    renderGauge(els.gaugeQuality, els.gaugeQualityValue, els.gaugeQualityDelta, stats.quality, "quality");
    renderGauge(els.gaugeFootprint, els.gaugeFootprintValue, els.gaugeFootprintDelta, stats.footprint, "footprint", false);
    renderGauge(els.gaugeBrand, els.gaugeBrandValue, els.gaugeBrandDelta, stats.brandImage, "brandImage");
  }

  function runCc(run) {
    return finite(run.autoCc, 0) + finite(run.contractCc, 0) + finite(run.eventCcNet, 0);
  }

  function runSpend(run) {
    return finite(run.buildingSpend, 0) + finite(run.upgradeSpend, 0);
  }

  function appendRunRow(fragment, run, current) {
    const row = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.scope = "row";
    labelCell.textContent = current
      ? t("analytics.runs.current")
      : t("analytics.runs.archived", null, { date: formatDate(finiteOrNull(run.endedAt) || finiteOrNull(run.startedAt), false) });
    row.appendChild(labelCell);
    addTableCell(row, formatDuration(finite(run.activeSeconds, 0)));
    addTableCell(row, formatNumber(finite(run.autoDocs, 0)) + " DOC");
    addTableCell(row, formatNumber(finite(run.manualDocs, 0)) + " DOC");
    addTableCell(row, formatNumber(runSpend(run)) + " DOC");
    addTableCell(row, formatSigned(runCc(run)) + " CC");
    addTableCell(row, current ? t("analytics.common.current") : Number.isFinite(run.cultureEarned) ? t("analytics.runs.prestige", null, { value: formatNumber(run.cultureEarned) }) : t("analytics.common.completed"));
    fragment.appendChild(row);
  }

  function renderRunArchive() {
    const analytics = state.snapshot && state.snapshot.analytics;
    const current = analytics && analytics.currentRun && typeof analytics.currentRun === "object" ? analytics.currentRun : null;
    const archives = analytics && Array.isArray(analytics.runSummaries) ? analytics.runSummaries.slice().reverse() : [];
    const fragment = document.createDocumentFragment();
    if (current) appendRunRow(fragment, current, true);
    archives.forEach(function (run) {
      if (run && typeof run === "object") appendRunRow(fragment, run, false);
    });
    els.runArchiveTableBody.replaceChildren(fragment);
    const hasRows = Boolean(current || archives.length);
    els.runArchiveTable.hidden = !hasRows;
    els.runArchiveEmptyState.hidden = hasRows;
  }

  function rawRows() {
    const snapshot = state.snapshot;
    if (!snapshot) return [];
    return [
      [t("analytics.raw.schema"), "V" + snapshot.schemaVersion],
      [t("analytics.raw.generatedAt"), timestampOrNull(snapshot.generatedAt) !== null ? formatDate(snapshot.generatedAt, true) : t("analytics.raw.unknownDate")],
      [t("analytics.raw.runId"), snapshot.runId || "—"],
      [t("analytics.raw.historySamples"), String(state.history.length)],
      [t("analytics.raw.partial"), snapshot.partialHistory ? t("analytics.raw.yes") : t("analytics.raw.no")],
      [t("analytics.raw.docRate"), formatNumber(snapshot.current.docPerSecond) + " DOC/s"],
      [t("analytics.raw.ccRate"), Number.isFinite(snapshot.current.ccPerSecond) ? formatNumber(snapshot.current.ccPerSecond) + " CC/s" : "—"],
      [t("analytics.raw.docBank"), formatNumber(snapshot.current.docBank) + " DOC"],
      [t("analytics.raw.docTotal"), formatNumber(snapshot.current.docTotal) + " DOC"],
      [t("analytics.raw.ccTotal"), formatNumber(snapshot.current.ccTotal) + " CC"]
    ];
  }

  function renderRawData() {
    if (!els.rawDataDetails.open) return;
    const fragment = document.createDocumentFragment();
    rawRows().forEach(function (entry) {
      const row = document.createElement("tr");
      const header = document.createElement("th");
      const value = document.createElement("td");
      header.scope = "row";
      header.textContent = entry[0];
      value.textContent = entry[1];
      row.append(header, value);
      fragment.appendChild(row);
    });
    els.rawDataTableBody.replaceChildren(fragment);
  }

  function renderCoverageCaveat() {
    if (!state.snapshot) {
      setText(els.dataCoverageCaveat, t("analytics.contract.boundaryPartial", "L'historique peut être partiel après migration ou effacement du stockage."));
      return;
    }
    if (state.snapshot.schemaVersion === 1) {
      setText(els.dataCoverageCaveat, t("analytics.contract.boundaryV1"));
    } else if (state.snapshot.partialHistory) {
      setText(els.dataCoverageCaveat, t("analytics.contract.boundaryPartial", "Historique partiel après migration ou effacement du stockage."));
    } else {
      setText(els.dataCoverageCaveat, t("analytics.contract.boundaryContinuous", null, {
        date: timestampOrNull(state.snapshot.coverageStart) !== null ? formatDate(state.snapshot.coverageStart, true) : t("analytics.contract.coverageOrigin")
      }));
    }
  }

  function renderAll() {
    renderFreshness();
    renderKpis();
    renderTrendChart();
    renderRecommendation();
    renderInvestmentTable();
    renderFlows();
    renderGauges();
    renderRunArchive();
    renderRawData();
    renderCoverageCaveat();
  }

  function collectElements() {
    const byId = function (id) { return document.getElementById(id); };
    return {
      backToGameLink: byId("backToGameLink"),
      dataStateChip: byId("dataStateChip"),
      dataStateLabel: byId("dataStateLabel"),
      dataFreshness: byId("dataFreshness"),
      dataCoverage: byId("dataCoverage"),
      dataModelVersion: byId("dataModelVersion"),
      kpiDocRate: byId("kpiDocRate"),
      kpiDocTrend: byId("kpiDocTrend"),
      kpiCcRate: byId("kpiCcRate"),
      kpiDocBank: byId("kpiDocBank"),
      kpiDocTotal: byId("kpiDocTotal"),
      kpiCcTotal: byId("kpiCcTotal"),
      kpiPrestigeOutlook: byId("kpiPrestigeOutlook"),
      kpiCulture: byId("kpiCulture"),
      kpiBuildingCount: byId("kpiBuildingCount"),
      trendMetricDoc: byId("trendMetricDoc"),
      trendMetricCc: byId("trendMetricCc"),
      trendSummary: byId("trendSummary"),
      trendChartWrap: byId("trendChartWrap"),
      analyticsTrendChart: byId("analyticsTrendChart"),
      trendChartDescription: byId("trendChartDescription"),
      trendChartTip: byId("trendChartTip"),
      trendEmptyState: byId("trendEmptyState"),
      historyTableDetails: byId("historyTableDetails"),
      historyTableBody: byId("historyTableBody"),
      recommendationPanel: byId("recommendationPanel"),
      recommendationTitle: byId("recommendationTitle"),
      recommendationReason: byId("recommendationReason"),
      recommendationImage: byId("recommendationImage"),
      recommendationPlaceholder: byId("recommendationPlaceholder"),
      recommendationCost: byId("recommendationCost"),
      recommendationDocGain: byId("recommendationDocGain"),
      recommendationPayback: byId("recommendationPayback"),
      recommendationAfford: byId("recommendationAfford"),
      projectionHorizon: byId("projectionHorizon"),
      projectionValue: byId("projectionValue"),
      projectionDelta: byId("projectionDelta"),
      investmentCount: byId("investmentCount"),
      investmentTable: byId("investmentTable"),
      investmentTableBody: byId("investmentTableBody"),
      investmentEmptyState: byId("investmentEmptyState"),
      docFlowList: byId("docFlowList"),
      docFlowTotal: byId("docFlowTotal"),
      ccFlowList: byId("ccFlowList"),
      ccFlowTotal: byId("ccFlowTotal"),
      gaugeQuality: byId("gaugeQuality"),
      gaugeQualityValue: byId("gaugeQualityValue"),
      gaugeQualityDelta: byId("gaugeQualityDelta"),
      gaugeFootprint: byId("gaugeFootprint"),
      gaugeFootprintValue: byId("gaugeFootprintValue"),
      gaugeFootprintDelta: byId("gaugeFootprintDelta"),
      gaugeBrand: byId("gaugeBrand"),
      gaugeBrandValue: byId("gaugeBrandValue"),
      gaugeBrandDelta: byId("gaugeBrandDelta"),
      runArchiveTable: byId("runArchiveTable"),
      runArchiveTableBody: byId("runArchiveTableBody"),
      runArchiveEmptyState: byId("runArchiveEmptyState"),
      rawDataDetails: byId("rawDataDetails"),
      rawDataTableBody: byId("rawDataTableBody"),
      dataCoverageCaveat: byId("dataCoverageCaveat")
    };
  }

  function bindInteractions() {
    document.querySelectorAll("[data-trend-metric]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.metric = button.dataset.trendMetric;
        document.querySelectorAll("[data-trend-metric]").forEach(function (candidate) {
          const active = candidate === button;
          candidate.classList.toggle("is-active", active);
          candidate.setAttribute("aria-pressed", String(active));
        });
        renderTrendChart();
      });
    });

    els.analyticsTrendChart.addEventListener("pointermove", showChartTip);
    els.analyticsTrendChart.addEventListener("pointerdown", showChartTip);
    els.analyticsTrendChart.addEventListener("pointerleave", hideChartTip);
    els.historyTableDetails.addEventListener("toggle", renderHistoryTable);
    els.rawDataDetails.addEventListener("toggle", renderRawData);
    els.projectionHorizon.addEventListener("change", function () {
      renderProjection(recommendation(investmentRows()));
    });

    els.investmentTable.querySelectorAll("button[data-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        const column = button.dataset.sort;
        if (state.sort.column === column) {
          state.sort.direction = state.sort.direction === "ascending" ? "descending" : "ascending";
        } else {
          state.sort.column = column;
          state.sort.direction = "ascending";
        }
        renderInvestmentTable();
      });
    });

    window.addEventListener("storage", function (event) {
      if (event.key !== SNAPSHOT_KEY && event.key !== HISTORY_KEY) return;
      refreshSources(true);
    });

    window.addEventListener("resize", function () {
      if (state.resizeTimer) window.clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(renderTrendChart, 120);
    }, { passive: true });
  }

  function prefersReducedMotion() {
    return document.documentElement.classList.contains("pref-reduce-motion") ||
      !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function initDataZoneMotion() {
    const intro = document.querySelector(".data-zone-intro");
    const nav = document.querySelector(".data-zone-nav");
    const targets = [intro, nav].filter(Boolean);
    if (!targets.length) return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach(function (target) { target.classList.add("is-visible"); });
      return;
    }
    document.documentElement.classList.add("data-zone-motion-ready");
    requestAnimationFrame(function () {
      if (intro) intro.classList.add("is-visible");
      if (nav) nav.classList.add("is-visible");
    });
  }

  function boot() {
    els = collectElements();
    if (!els.dataStateChip || !els.analyticsTrendChart || !els.investmentTable) return;
    state.lang = detectLanguage();
    applyTranslations();
    initDataZoneMotion();
    bindInteractions();
    refreshSources(true);
    state.pollTimer = window.setInterval(function () { refreshSources(false); }, POLL_MS);
    state.statusTimer = window.setInterval(renderFreshness, STATUS_TICK_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
