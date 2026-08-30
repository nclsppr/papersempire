(() => {
  "use strict";

  /**
   * Cache of frequently accessed DOM nodes to avoid repeated lookups.
   * Filled once during initialization.
   */
  const DOM = {};
  const assetUrl = window.PEAssetUrl || function (path) { return path; };

  const GAME_TITLE = window.GAME_TITLE || "Papers Empire";
  const {
    computeBuildingEffects,
    getBuildingImpact,
    getEffectiveQuantity,
    getMilestoneMultiplier,
    getNextMilestone
  } = ModifierUtils;
  const EconomyAnalytics = window.EconomyAnalytics || null;
  const Progression = window.ProgressionModule || null;
  const { sanitizeTimeScale, updateCheatProgress } = GodModeUtils;
  const Events = window.Events;
  const Settings = window.Settings;
  const TutorialEngine = window.Tutorial;
  const UIEffects = window.UIEffects || {
    playPurchaseEffect() {},
    playUpgradeEffect() {},
    playContractEffect() {},
    playAchievementEffect() {},
    playCelebrationEffect() {},
    playClickEffect() {},
    playSound() {}
  };
  const settingsState = {
    activeTab: "accessibility",
    lastTrigger: null
  };

  // -------------------------------
  // Internationalisation + état UI
  // -------------------------------

  const SUPPORTED_LANGS = ["fr", "en", "de", "lb"];
  const DEFAULT_LANG = "fr";
  const LANDING_HASHES = ["#sceneStage", "#roadmapTitle"];
  const COLLAPSIBLE_PANEL_IDS = ["print", "buildings", "strategy", "dispatch", "progress"];
  const DOM_RENDER_INTERVAL_MS = 100;
  const DASH_SNAPSHOT_KEY = "pe-dash-snapshot";
  const ANALYTICS_HISTORY_KEY = "pe-analytics-history-v1";
  const DASH_SNAPSHOT_INTERVAL_MS = 3000;
  const ANALYTICS_SAMPLE_INTERVAL_MS = 15000;
  const ANALYTICS_MAX_SAMPLES = 240;
  // Equivalent au rythme nominal historique à 60 Hz, mais désormais appliqué
  // une seule fois par tick et proportionnel au temps simulé.
  const INFRA_STAT_RATE_PER_SECOND = 0.024;
  const LOCALE_BY_LANG = { fr: "fr-FR", en: "en-US", de: "de-DE", lb: "lb-LU" };
  // Langue initiale, par priorité : le préfixe de chemin des pages construites
  // par langue (/en/, /de/, /lb/), puis l'ancien ?lang=xx comme filet local,
  // puis le français. PAS de navigator.language : la langue rendue
  // doit être déterministe par URL (Googlebot rend en en-US, ce qui ferait
  // de / un duplicat anglais de /en/ alors qu'elle est déclarée hreflang fr).
  const urlLang = (() => {
    try {
      return new URLSearchParams(window.location.search).get("lang");
    } catch {
      return null;
    }
  })();
  const pathLang = (window.location.pathname.match(/^\/(en|de|lb)\//) || [])[1] || null;
  let currentLang = (pathLang || urlLang || DEFAULT_LANG).slice(0, 2).toLowerCase();
  if (!SUPPORTED_LANGS.includes(currentLang)) {
    currentLang = DEFAULT_LANG;
  }

  /** Tracks which sections need a render refresh. */
  const uiState = {
    buildingsDirty: true,
    upgradesDirty: true,
    detailTab: "contracts",
    logRenderSignature: "",
    lastFrameRender: 0,
    lastAction: null,
    completionReceipt: null,
    initialRenderComplete: false
  };

  /** Global model of the player progression. */
  const gameState = {
    resources: {
      docBank: 0,
      docTotal: 0,
      ccTotal: 0,
      culturePoints: 0
    },
    stats: {
      quality: 0.5,
      footprint: 0.5,
      brandImage: 0.5
    },
    config: {
      docPerClickBase: 1,
      globalProductionMultiplierBase: 1,
      qualityRecoveryRate: 0.02,
      imageRecoveryRate: 0.01,
      footprintDriftBase: 0.00001,
      prestigeCcDivisor: 1000,
      prestigeRequirement: 10000,
      // Gains hors-ligne (roadmap 0.13) : rendement réduit et plafonné.
      offlineRate: 0.5,
      offlineCapHours: 8,
      offlineMinSeconds: 60,
      offlineModalMinSeconds: 300
    },
    time: {
      lastUpdate: performance.now()
    },
    buildings: [],
    upgrades: [],
    log: []
  };

  let careerState = null;

  const achievementsState = {
    unlocked: {},
    rewarded: {},
    renderSignature: ""
  };

  const eventState = {
    active: null,
    modalCanClose: false,
    bannerTone: "mixed",
    bannerKey: null,
    bannerParams: null,
    eventsEnabled: true
  };

  const careerUiState = {
    renderSignature: ""
  };

  const contractsState = {
    available: [],
    rerollCount: 0,
    lastReroll: 0,
    unlocked: false,
    listRenderSignature: ""
  };
  const CONTRACT_REROLL_COOLDOWN = 30000;
  const CONTRACTS_UNLOCK_DOC_TOTAL = 1500;
  const buildingInspectorState = {
    selectedId: null,
    feedback: null,
    feedbackTimer: null
  };

  let saveTimer = null;
  let bannerHideTimer = null;
  let statusAnnouncementToken = 0;
  let persistenceDisabled = false;
  let experienceStarted = false;
  let experienceStartedAt = null;
  let experienceMode = "landing";
  let lastDashboardPersistAt = 0;
  let lastAnalyticsSampleAt = 0;
  let analyticsHistory = [];

  function createRunId() {
    return "run-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function createAnalyticsState(partialHistory = false) {
    const now = Date.now();
    return {
      schemaVersion: 1,
      coverageStart: now,
      partialHistory: !!partialHistory,
      currentRun: {
        id: createRunId(),
        startedAt: now,
        activeSeconds: 0,
        autoDocs: 0,
        manualDocs: 0,
        offlineDocs: 0,
        contractDocs: 0,
        eventDocNet: 0,
        autoCc: 0,
        contractCc: 0,
        eventCcNet: 0,
        buildingSpend: 0,
        upgradeSpend: 0,
        clicks: 0,
        contractsCompleted: 0,
        eventsResolved: 0,
        achievementDocs: 0,
        achievementCc: 0,
        achievementCulture: 0,
        careerCulture: 0,
        prestigeCulture: 0
      },
      lifetimeObserved: {
        prestiges: 0,
        docs: 0,
        cc: 0
      },
      runSummaries: []
    };
  }

  let analyticsState = createAnalyticsState(false);

  /** Static blueprint for every building available in the MVP. */
  const BUILDING_DEFS = [
    {
      id: "reproOperator",
      emoji: "👷",
      nameKey: "building.reproOperator.name",
      descKey: "building.reproOperator.desc",
      baseProduction: 0.5,
      baseCost: 15,
      costMultiplier: 1.15,
      role: "producer",
      qualityBonusPerUnit: 0.0,
      footprintBonusPerUnit: 0.0,
      imageBonusPerUnit: 0.0
    },
    {
      id: "reproWorkshop",
      emoji: "🛠️",
      nameKey: "building.reproWorkshop.name",
      descKey: "building.reproWorkshop.desc",
      baseProduction: 3,
      baseCost: 100,
      costMultiplier: 1.15,
      role: "producer",
      qualityBonusPerUnit: 0.005,
      footprintBonusPerUnit: -0.002,
      imageBonusPerUnit: 0.0
    },
    {
      id: "digitalPress",
      emoji: "🖨️",
      nameKey: "building.digitalPress.name",
      descKey: "building.digitalPress.desc",
      baseProduction: 20,
      baseCost: 1000,
      costMultiplier: 1.15,
      role: "producer",
      qualityBonusPerUnit: 0.01,
      footprintBonusPerUnit: 0.003,
      imageBonusPerUnit: 0.005
    },
    {
      id: "offsetPress",
      emoji: "🗞️",
      nameKey: "building.offsetPress.name",
      descKey: "building.offsetPress.desc",
      baseProduction: 120,
      baseCost: 10000,
      costMultiplier: 1.15,
      role: "producer",
      qualityBonusPerUnit: 0.015,
      footprintBonusPerUnit: 0.01,
      imageBonusPerUnit: 0.01
    },
    {
      id: "finishingWorkshop",
      emoji: "✂️",
      nameKey: "building.finishingWorkshop.name",
      descKey: "building.finishingWorkshop.desc",
      baseProduction: 0,
      baseCost: 1500,
      costMultiplier: 1.15,
      role: "multiplier",
      docMultiplierPerUnit: 0.03,
      qualityBonusPerUnit: 0.01,
      footprintBonusPerUnit: -0.004,
      imageBonusPerUnit: 0.0
    },
    {
      id: "insertingLine",
      emoji: "📬",
      nameKey: "building.insertingLine.name",
      descKey: "building.insertingLine.desc",
      baseProduction: 0,
      baseCost: 3000,
      costMultiplier: 1.15,
      role: "multiplier",
      docMultiplierPerUnit: 0.02,
      ccMultiplierPerUnit: 0.05,
      qualityBonusPerUnit: 0.01,
      footprintBonusPerUnit: -0.002,
      imageBonusPerUnit: 0.01
    },
    {
      id: "logistics",
      emoji: "🚚",
      nameKey: "building.logistics.name",
      descKey: "building.logistics.desc",
      baseProduction: 0,
      baseCost: 5000,
      costMultiplier: 1.15,
      role: "multiplier",
      docMultiplierPerUnit: 0.01,
      ccMultiplierPerUnit: 0.08,
      qualityBonusPerUnit: 0.0,
      footprintBonusPerUnit: -0.005,
      imageBonusPerUnit: 0.02
    },
    {
      id: "clientPortal",
      emoji: "🌐",
      nameKey: "building.clientPortal.name",
      descKey: "building.clientPortal.desc",
      baseProduction: 5,
      baseCost: 8000,
      costMultiplier: 1.15,
      role: "producer",
      qualityBonusPerUnit: 0.015,
      footprintBonusPerUnit: -0.01,
      imageBonusPerUnit: 0.02
    },
    {
      id: "comBridge",
      emoji: "📡",
      nameKey: "building.comBridge.name",
      descKey: "building.comBridge.desc",
      baseProduction: 0,
      baseCost: 20000,
      costMultiplier: 1.2,
      role: "ccMultiplier",
      ccMultiplierPerUnit: 0.12,
      qualityBonusPerUnit: 0.02,
      footprintBonusPerUnit: -0.015,
      imageBonusPerUnit: 0.04
    },
    {
      id: "prepressStudio",
      emoji: "🖥️",
      nameKey: "building.prepressStudio.name",
      descKey: "building.prepressStudio.desc",
      baseProduction: 0,
      baseCost: 30000,
      costMultiplier: 1.2,
      role: "multiplier",
      docMultiplierPerUnit: 0.04,
      qualityBonusPerUnit: 0.025,
      footprintBonusPerUnit: -0.012,
      imageBonusPerUnit: 0.01,
      contractDurationReductionPerUnit: 0.06
    },
    {
      id: "factory40",
      emoji: "🤖",
      nameKey: "building.factory40.name",
      descKey: "building.factory40.desc",
      baseProduction: 0,
      baseCost: 50000,
      costMultiplier: 1.2,
      role: "multiplier",
      docMultiplierPerUnit: 0.08,
      ccMultiplierPerUnit: 0.08,
      qualityBonusPerUnit: 0.02,
      footprintBonusPerUnit: -0.02,
      imageBonusPerUnit: 0.05
    },
    {
      id: "pampyAI",
      emoji: "🧠",
      nameKey: "building.pampyAI.name",
      descKey: "building.pampyAI.desc",
      baseProduction: 0,
      baseCost: 100000,
      costMultiplier: 1.25,
      role: "multiplier",
      docMultiplierPerUnit: 0.05,
      ccMultiplierPerUnit: 0.1,
      qualityBonusPerUnit: 0.03,
      footprintBonusPerUnit: -0.04,
      imageBonusPerUnit: 0.06
    }
  ];

  const finalBuildingDef = BUILDING_DEFS.reduce((best, def) => {
    if (!best) return def;
    const bestCost = best.baseCost || 0;
    const defCost = def.baseCost || 0;
    return defCost > bestCost ? def : best;
  }, BUILDING_DEFS[0]);
  const FINAL_BUILDING_ID = finalBuildingDef ? finalBuildingDef.id : BUILDING_DEFS[0] ? BUILDING_DEFS[0].id : null;

  const GOD_MODE_SCALES = [1, 10, 100, 1000];
  const godModeState = {
    unlocked: false,
    buffer: "",
    timeScale: 1,
    codeWord: "renard",
    dirty: false
  };

  document.addEventListener("DOMContentLoaded", initApp);

  /** Entry point that wires DOM, localisation and gameplay. */
  function initApp() {
    cacheDomReferences();
    bindUIEvents();
    initLocalization();
    initCollapsiblePanels();
    eventState.eventsEnabled = areEventsAllowed();
    initGame();
    initExperienceMode();
    initGodModeControls();
    initTutorialGuidance();
    applyTimeOfDaySky();
    setInterval(applyTimeOfDaySky, 10 * 60 * 1000);
    greetConsoleVisitors();
  }

  function hasMeaningfulProgress(saved) {
    if (!saved) return false;
    const resources = saved.resources || {};
    if (resources.docTotal > 0 || resources.docBank > 0 || resources.ccTotal > 0 || resources.culturePoints > 0) {
      return true;
    }
    if (Array.isArray(saved.buildings) && saved.buildings.some(item => item && item.quantity > 0)) {
      return true;
    }
    if (Array.isArray(saved.upgrades) && saved.upgrades.some(item => item && item.purchased)) {
      return true;
    }
    if (saved.career && (
      saved.career.started ||
      saved.career.activePlan ||
      Object.values(saved.career.completedRanks || {}).some(value => Number(value) > 0)
    )) {
      return true;
    }
    const savedAchievements = saved.achievements && saved.achievements.unlocked
      ? saved.achievements.unlocked
      : saved.achievements;
    return !!(savedAchievements && Object.values(savedAchievements).some(Boolean));
  }

  function wantsLandingView() {
    try {
      return new URLSearchParams(window.location.search).get("welcome") === "1" ||
        LANDING_HASHES.includes(window.location.hash);
    } catch {
      return false;
    }
  }

  function updateExperienceUrl(hash) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      if (typeof hash === "string" && hash) url.hash = hash;
      window.history.replaceState(null, "", url);
    } catch {
      // file:// and privacy-hardened contexts may reject History mutations.
    }
  }

  function applyExperienceMode(mode, options = {}) {
    experienceMode = mode === "playing" ? "playing" : "landing";
    document.documentElement.dataset.experience = experienceMode;
    const playing = experienceMode === "playing";
    if (DOM.gameSurface) {
      DOM.gameSurface.inert = !playing;
      DOM.gameSurface.setAttribute("aria-hidden", playing ? "false" : "true");
    }
    if (DOM.sceneStage) {
      DOM.sceneStage.setAttribute("aria-labelledby", playing ? "empireHudTitle" : "heroTitle");
    }
    if (DOM.skipLink) {
      DOM.skipLink.setAttribute("href", playing ? "#gameViewTitle" : "#heroTitle");
    }
    document.querySelectorAll("[data-landing-only]").forEach(element => {
      element.inert = playing;
      element.setAttribute("aria-hidden", playing ? "true" : "false");
    });
    window.__PE_SCENE_MODE__ = experienceMode;
    if (options.updateUrl !== false) updateExperienceUrl();
  }

  function initExperienceMode() {
    const showLanding = wantsLandingView();
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("welcome")) {
        const canonicalLandingHash = LANDING_HASHES.includes(window.location.hash)
          ? window.location.hash
          : params.get("welcome") === "1"
            ? "#sceneStage"
            : window.location.hash;
        updateExperienceUrl(canonicalLandingHash);
      }
    } catch {
      // The current URL already remains usable if query parsing is unavailable.
    }
    applyExperienceMode(showLanding || !experienceStarted ? "landing" : "playing", { updateUrl: false });
    window.addEventListener("hashchange", () => {
      if (LANDING_HASHES.includes(window.location.hash)) {
        applyExperienceMode("landing", { updateUrl: false });
      }
    });
    if (experienceMode === "playing") {
      requestAnimationFrame(showOfflineReport);
    }
  }

  function startExperience(event) {
    if (event) event.preventDefault();
    const firstStart = !experienceStarted;
    experienceStarted = true;
    if (!experienceStartedAt) experienceStartedAt = Date.now();
    if (firstStart) {
      // Instrumentation starts with the actual game, not while someone reads
      // the landing. This keeps coverage and run duration product-truthful.
      analyticsState = createAnalyticsState(false);
      analyticsState.coverageStart = experienceStartedAt;
      analyticsState.currentRun.startedAt = experienceStartedAt;
      analyticsHistory = [];
      lastAnalyticsSampleAt = 0;
    }
    applyExperienceMode("playing");
    if (firstStart) gameState.time.lastUpdate = performance.now();
    queueSave(true);
    showOfflineReport();
    const targetSelector = event && event.currentTarget
      ? event.currentTarget.getAttribute("href")
      : null;
    const target = targetSelector && targetSelector.startsWith("#")
      ? document.querySelector(targetSelector)
      : DOM.gameSurface;
    if (targetSelector) expandPanelForTarget(target, { persist: true });
    updateExperienceUrl(targetSelector || "#gameViewTitle");
    requestAnimationFrame(() => {
      if ([DOM.offlineModal, DOM.eventModal, DOM.settingsModal].some(isModalSurfaceOpen)) {
        return;
      }
      const destination = target || DOM.gameSurface || DOM.clickButton;
      const focusTarget = destination && destination.matches && destination.matches("button, a, [tabindex]")
        ? destination
        : destination && destination.querySelector
        ? destination.querySelector("h1[tabindex], h2[tabindex], [tabindex='-1']") || DOM.gameViewTitle
        : DOM.gameViewTitle || DOM.clickButton;
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus({ preventScroll: true });
      }
      const settleDelay = reduceMotionPreferred() ? 0 : 580;
      setTimeout(() => {
        const tutorialActive = TutorialEngine && typeof TutorialEngine.isActive === "function" && TutorialEngine.isActive();
        if (tutorialActive || [DOM.offlineModal, DOM.eventModal, DOM.settingsModal].some(isModalSurfaceOpen)) {
          return;
        }
        if (destination && typeof destination.scrollIntoView === "function") {
          destination.scrollIntoView({ behavior: reduceMotionPreferred() ? "auto" : "smooth", block: "start" });
        }
      }, settleDelay);
    });
    if (TutorialEngine && typeof TutorialEngine.maybeStart === "function") {
      setTimeout(() => TutorialEngine.maybeStart(), reduceMotionPreferred() ? 0 : 420);
    }
  }

  function showIntro(event) {
    if (event) event.preventDefault();
    if (TutorialEngine && typeof TutorialEngine.isActive === "function" && TutorialEngine.isActive()) {
      TutorialEngine.skip(false);
    }
    applyExperienceMode("landing");
    updateExperienceUrl("#sceneStage");
    requestAnimationFrame(() => {
      if (DOM.sceneStage && typeof DOM.sceneStage.scrollIntoView === "function") {
        DOM.sceneStage.scrollIntoView({ behavior: reduceMotionPreferred() ? "auto" : "smooth", block: "start" });
      }
      if (DOM.heroClickButton) DOM.heroClickButton.focus({ preventScroll: true });
    });
  }

  function reduceMotionPreferred() {
    return document.documentElement.classList.contains("pref-reduce-motion") ||
      !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* Ciel selon l'heure locale : ne décale que la teinte du dégradé
     (classes sky-* dans style.css). 17 h - 22 h garde le crépuscule,
     la teinte par défaut de la marque. */
  function applyTimeOfDaySky() {
    const root = document.documentElement;
    root.classList.remove("sky-dawn", "sky-day", "sky-night");
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) {
      root.classList.add("sky-dawn");
    } else if (hour >= 10 && hour < 17) {
      root.classList.add("sky-day");
    } else if (hour >= 22 || hour < 6) {
      root.classList.add("sky-night");
    }
  }

  /* Clin d'œil aux curieux qui ouvrent la console. */
  function greetConsoleVisitors() {
    if (typeof console === "undefined" || typeof console.log !== "function") return;
    console.log(
      "%c🖨️ Papers Empire %c\nBourrage papier ? Jamais ici.\n%cTu fouilles sous le capot ? window.__PE_DEBUG t'ouvre l'atelier.",
      "font-weight: bold; font-size: 14px; color: #fbbf24;",
      "color: #cfc8e4;",
      "color: #a79ec4; font-style: italic;"
    );
  }

  /** Stores every frequently used DOM node locally for fast access. */
  function cacheDomReferences() {
    DOM.gameSurface = document.querySelector("[data-game-surface]");
    DOM.sceneStage = document.getElementById("sceneStage");
    DOM.heroTitle = document.getElementById("heroTitle");
    DOM.gameViewTitle = document.getElementById("gameViewTitle");
    DOM.skipLink = document.querySelector(".skip-link");
    DOM.startTriggers = document.querySelectorAll("[data-start-game]");
    DOM.introTriggers = document.querySelectorAll("[data-show-intro]");
    DOM.langSelect = document.getElementById("langSelect");
    DOM.docBank = document.getElementById("docBank");
    DOM.docTotal = document.getElementById("docTotal");
    DOM.ccTotal = document.getElementById("ccTotal");
    DOM.docPs = document.getElementById("docPs");
    DOM.qualityLabel = document.getElementById("qualityLabel");
    DOM.footprintLabel = document.getElementById("footprintLabel");
    DOM.imageLabel = document.getElementById("imageLabel");
    DOM.qualityFill = document.getElementById("qualityFill");
    DOM.footprintFill = document.getElementById("footprintFill");
    DOM.imageFill = document.getElementById("imageFill");
    DOM.culturePoints = document.getElementById("culturePoints");
    DOM.prestigeMult = document.getElementById("prestigeMult");
    DOM.clickButton = document.getElementById("clickButton");
    DOM.heroClickButton = document.getElementById("heroClickButton");
    DOM.heroDocBank = document.getElementById("heroDocBank");
    DOM.heroDocPs = document.getElementById("heroDocPs");
    DOM.heroPrestige = document.getElementById("heroPrestige");
    DOM.heroCulture = document.getElementById("heroCulture");
    DOM.opsDocBank = document.getElementById("opsDocBank");
    DOM.opsDocPs = document.getElementById("opsDocPs");
    DOM.opsBuildingCount = document.getElementById("opsBuildingCount");
    DOM.manualGain = document.getElementById("manualGain");
    DOM.currentObjective = document.getElementById("currentObjective");
    DOM.workOrderType = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-type]");
    DOM.workOrderStatus = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-status]");
    DOM.workOrderName = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-name]");
    DOM.workOrderInstruction = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-instruction]");
    DOM.workOrderMeta = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-meta]");
    DOM.workOrderProgress = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-progress]");
    DOM.workOrderLastAction = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-last-action]");
    DOM.workOrderNext = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-next]");
    DOM.workOrderContext = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-context]");
    DOM.workOrderPlan = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-plan]");
    DOM.workOrderStep = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-step]");
    DOM.workOrderSteps = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-steps]");
    DOM.workOrderCriteria = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-criteria]");
    DOM.workOrderOutcome = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-outcome]");
    DOM.workOrderReward = DOM.currentObjective && DOM.currentObjective.querySelector("[data-work-order-reward]");
    DOM.pendingEventButton = document.getElementById("pendingEventButton");
    DOM.pendingEventLabel = DOM.pendingEventButton && DOM.pendingEventButton.querySelector("[data-work-order-incident-label]");
    DOM.pendingEventHint = document.querySelector("[data-work-order-incident-hint]");
    DOM.qualityGauge = DOM.qualityFill && DOM.qualityFill.closest('[role="progressbar"]');
    DOM.footprintGauge = DOM.footprintFill && DOM.footprintFill.closest('[role="progressbar"]');
    DOM.imageGauge = DOM.imageFill && DOM.imageFill.closest('[role="progressbar"]');
    DOM.prestigeButton = document.getElementById("prestigeButton");
    DOM.prestigeInfo = document.getElementById("prestigeInfo");
    DOM.careerPlanContainer = document.getElementById("careerPlanContainer");
    DOM.careerPlanKicker = DOM.careerPlanContainer && DOM.careerPlanContainer.querySelector("[data-career-plan-kicker]");
    DOM.careerPlanTitle = document.getElementById("careerPlanTitle");
    DOM.careerPlanProgress = DOM.careerPlanContainer && DOM.careerPlanContainer.querySelector("[data-career-plan-progress]");
    DOM.careerPlanIntro = document.getElementById("careerPlanIntro");
    DOM.careerPlanChoices = document.getElementById("careerPlanChoices");
    DOM.careerPlanEffect = document.getElementById("careerPlanEffect");
    DOM.careerPlanStamps = DOM.careerPlanContainer && DOM.careerPlanContainer.querySelector("[data-career-plan-stamps]");
    DOM.buildingsList = document.getElementById("buildingsList");
    DOM.buildingInspector = document.getElementById("buildingInspector");
    DOM.buildingInspectorTitle = DOM.buildingInspector && DOM.buildingInspector.querySelector("[data-building-inspector-title]");
    DOM.buildingInspectorPrimary = DOM.buildingInspector && DOM.buildingInspector.querySelector("[data-building-inspector-primary]");
    DOM.buildingInspectorSecondary = DOM.buildingInspector && DOM.buildingInspector.querySelector("[data-building-inspector-secondary]");
    DOM.panelToggles = document.querySelectorAll("[data-panel-toggle]");
    DOM.upgradesList = document.getElementById("upgradesList");
    DOM.logPanel = document.getElementById("logPanel");
    DOM.contractsTab = document.getElementById("contractsTab");
    DOM.journalTab = document.getElementById("journalTab");
    DOM.contractsPanel = document.getElementById("contractsPanel");
    DOM.journalPanel = document.getElementById("journalPanel");
    DOM.rerollContractsBtn = document.getElementById("rerollContractsBtn");
    DOM.contractsList = document.getElementById("contractsList");
    DOM.dispatchPanel = document.getElementById("dispatchPanel");
    DOM.godModeCard = document.getElementById("godModeCard");
    DOM.godModeStatus = document.getElementById("godModeStatus");
    DOM.achievementsList = document.getElementById("achievementsList");
    DOM.achievementUnlockedCount = document.getElementById("achievementUnlockedCount");
    DOM.achievementTotalCount = document.getElementById("achievementTotalCount");
    DOM.gameStatusAnnouncer = document.getElementById("gameStatusAnnouncer");
    DOM.exportSaveBtn = document.getElementById("exportSaveBtn");
    DOM.importSaveBtn = document.getElementById("importSaveBtn");
    DOM.resetSaveBtn = document.getElementById("resetSaveBtn");
    DOM.settingsModal = document.getElementById("settingsModal");
    DOM.settingsDialog = DOM.settingsModal ? DOM.settingsModal.querySelector(".settings-dialog") : null;
    DOM.settingsTabs = document.querySelectorAll("[data-settings-tab]");
    DOM.settingsSections = document.querySelectorAll("[data-settings-section]");
    DOM.settingsTriggers = document.querySelectorAll("[data-open-settings]");
    DOM.closeSettingsBtn = document.getElementById("closeSettingsBtn");
    DOM.restartTutorialBtn = document.getElementById("restartTutorialBtn");
    DOM.flavorLine = document.getElementById("flavorLine");
    DOM.eventBanner = document.getElementById("eventBanner");
    DOM.eventBannerText = document.getElementById("eventBannerText");
    DOM.eventBannerIconUse = document.getElementById("eventBannerIconUse");
    DOM.closeEventBanner = document.getElementById("closeEventBanner");
    DOM.eventModal = document.getElementById("eventModal");
    DOM.eventDialog = DOM.eventModal ? DOM.eventModal.querySelector(".event-dialog") : null;
    DOM.offlineModal = document.getElementById("offlineModal");
    DOM.eventTitle = document.getElementById("eventTitle");
    DOM.eventDescription = document.getElementById("eventDescription");
    DOM.eventChoices = document.getElementById("eventChoices");
    DOM.eventResult = document.getElementById("eventResult");
    DOM.minigameContainer = document.getElementById("minigameContainer");
    DOM.minigamePrompt = document.getElementById("minigamePrompt");
    DOM.closeEventModal = document.getElementById("closeEventModal");
    DOM.disableEventInterruptions = document.getElementById("disableEventInterruptions");
  }

  /** Hooks click events to the main CTAs. */
  function bindUIEvents() {
    if (DOM.clickButton) {
      DOM.clickButton.addEventListener("click", handleClick);
    }
    if (DOM.startTriggers && DOM.startTriggers.length) {
      DOM.startTriggers.forEach(trigger => trigger.addEventListener("click", startExperience));
    }
    if (DOM.introTriggers && DOM.introTriggers.length) {
      DOM.introTriggers.forEach(trigger => trigger.addEventListener("click", showIntro));
    }
    document.querySelectorAll("[data-dashboard-link]").forEach(link => {
      link.addEventListener("click", () => queueSave(true));
    });
    const flushOnLifecycleBoundary = () => {
      if (experienceStarted) queueSave(true);
    };
    window.addEventListener("pagehide", flushOnLifecycleBoundary);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushOnLifecycleBoundary();
    });
    if (DOM.prestigeButton) {
      DOM.prestigeButton.addEventListener("click", handlePrestigeClick);
    }
    if (DOM.careerPlanChoices) {
      DOM.careerPlanChoices.addEventListener("click", handleCareerAction);
    }
    if (DOM.pendingEventButton) {
      DOM.pendingEventButton.addEventListener("click", openPendingEvent);
    }

    if (DOM.exportSaveBtn) {
      DOM.exportSaveBtn.addEventListener("click", handleExportSave);
    }
    if (DOM.importSaveBtn) {
      DOM.importSaveBtn.addEventListener("click", handleImportSave);
    }
    if (DOM.resetSaveBtn) {
      DOM.resetSaveBtn.addEventListener("click", handleResetSave);
    }

    if (DOM.settingsTriggers && DOM.settingsTriggers.length) {
      DOM.settingsTriggers.forEach(btn => {
        btn.addEventListener("click", event => {
          settingsState.lastTrigger = event.currentTarget;
          openSettingsModal();
        });
      });
    }
    if (DOM.closeSettingsBtn) {
      DOM.closeSettingsBtn.addEventListener("click", () => closeSettingsModal());
    }
    if (DOM.settingsModal) {
      DOM.settingsModal.addEventListener("click", event => {
        if (event.target === DOM.settingsModal) {
          closeSettingsModal();
        }
      });
    }
    if (DOM.settingsTabs && DOM.settingsTabs.length) {
      DOM.settingsTabs.forEach(tab => {
        tab.addEventListener("click", () => activateSettingsTab(tab.getAttribute("data-settings-tab")));
        tab.addEventListener("keydown", handleSettingsTabKeydown);
      });
    }
    if (DOM.restartTutorialBtn) {
      DOM.restartTutorialBtn.addEventListener("click", handleRestartTutorial);
    }

    if (DOM.eventChoices) {
      DOM.eventChoices.addEventListener("click", handleEventChoiceClick);
    }
    if (DOM.minigameContainer) {
      DOM.minigameContainer.addEventListener("click", handleMinigameResponse);
    }
    if (DOM.closeEventModal) {
      DOM.closeEventModal.addEventListener("click", () => closeEventModal());
    }
    if (DOM.disableEventInterruptions) {
      DOM.disableEventInterruptions.addEventListener("click", disableEventInterruptions);
    }
    if (DOM.closeEventBanner) {
      DOM.closeEventBanner.addEventListener("click", hideEventBanner);
    }

    if (DOM.contractsTab) {
      DOM.contractsTab.addEventListener("click", () => switchDetailTab("contracts"));
    }
    if (DOM.journalTab) {
      DOM.journalTab.addEventListener("click", () => switchDetailTab("journal"));
    }
    [DOM.contractsTab, DOM.journalTab].filter(Boolean).forEach(tab => {
      tab.addEventListener("keydown", event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const target = tab === DOM.contractsTab ? DOM.journalTab : DOM.contractsTab;
        if (!target || target.classList.contains("hidden")) return;
        switchDetailTab(target === DOM.contractsTab ? "contracts" : "journal");
        target.focus();
      });
    });
    if (DOM.rerollContractsBtn) {
      DOM.rerollContractsBtn.addEventListener("click", handleContractsReroll);
    }

    document.addEventListener("keydown", handleGlobalKeydown);

    contractsState.unlocked = areContractsUnlocked();
    switchDetailTab(contractsState.unlocked ? "contracts" : "journal");
  }

  function handleGlobalKeydown(event) {
    if (event.key !== "Escape") return;
    if (TutorialEngine && typeof TutorialEngine.isActive === "function" && TutorialEngine.isActive()) {
      if (typeof TutorialEngine.skip === "function") {
        TutorialEngine.skip(true);
      }
      event.preventDefault();
      return;
    }
    const eventModalOpen = DOM.eventModal &&
      !DOM.eventModal.classList.contains("hidden") &&
      !DOM.eventModal.classList.contains("is-closing");
    if (eventModalOpen) {
      if (eventState.modalCanClose) closeEventModal();
      event.preventDefault();
      return;
    }
    if (closeSettingsModal()) {
      event.preventDefault();
      return;
    }
    if (clearBuildingInspectorSelection()) event.preventDefault();
  }

  /* Motion des modales (pattern transitions-dev) : le voile cross-fade,
     le dialog .t-modal scale ; .hidden ne revient qu'après la transition
     de fermeture pour que la sortie reste visible. */
  function modalCloseMs() {
    const root = document.documentElement;
    if (root.classList.contains("pref-reduce-motion")) return 0;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
    const value = parseFloat(getComputedStyle(root).getPropertyValue("--modal-close-dur"));
    return Number.isFinite(value) ? value : 150;
  }

  function trapModalTab(event, dialog) {
    if (event.key !== "Tab" || !dialog) return;
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "select:not([disabled])",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    const focusable = Array.from(dialog.querySelectorAll(selector)).filter(element => {
      return !element.closest(".hidden") && element.getClientRects().length > 0;
    });
    if (!focusable.length) {
      event.preventDefault();
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      dialog.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function openModalSurface(overlay, dialog) {
    if (overlay.__peCloseTimer) {
      clearTimeout(overlay.__peCloseTimer);
      overlay.__peCloseTimer = null;
    }
    const activeElement = document.activeElement;
    if (activeElement && !overlay.contains(activeElement)) {
      overlay.__peReturnFocus = activeElement;
    }
    if (overlay.__peFocusTrap) overlay.removeEventListener("keydown", overlay.__peFocusTrap);
    overlay.__peFocusTrap = event => trapModalTab(event, dialog);
    overlay.addEventListener("keydown", overlay.__peFocusTrap);
    overlay.inert = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.remove("hidden", "is-closing");
    if (dialog) dialog.classList.remove("is-closing");
    // Reflow forcé pour que la transition d'entrée parte de l'état repos.
    void overlay.offsetWidth;
    overlay.classList.add("is-open");
    if (dialog) dialog.classList.add("is-open");
  }

  function closeModalSurface(overlay, dialog) {
    if (overlay.__peFocusTrap) {
      overlay.removeEventListener("keydown", overlay.__peFocusTrap);
      overlay.__peFocusTrap = null;
    }
    overlay.inert = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.classList.remove("is-open");
    overlay.classList.add("is-closing");
    if (dialog) {
      dialog.classList.remove("is-open");
      dialog.classList.add("is-closing");
    }
    overlay.__peCloseTimer = setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("is-closing");
      if (dialog) dialog.classList.remove("is-closing");
      overlay.__peCloseTimer = null;
    }, modalCloseMs());
  }

  function restoreModalFocus(overlay, preferredTarget) {
    const storedTarget = overlay && overlay.__peReturnFocus;
    if (overlay) overlay.__peReturnFocus = null;
    const candidates = [preferredTarget, storedTarget, DOM.clickButton, DOM.heroClickButton];
    const target = candidates.find(candidate => {
      return candidate && candidate !== document.body && candidate !== document.documentElement &&
        candidate.isConnected && !candidate.disabled &&
        !candidate.closest('[inert], [aria-hidden="true"], [hidden], .hidden') &&
        (!overlay || !overlay.contains(candidate));
    });
    if (target && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }

  function isModalSurfaceOpen(overlay) {
    return !!overlay && overlay.classList.contains("is-open") &&
      !overlay.classList.contains("is-closing");
  }

  function schedulePendingOfflineReport() {
    if (!offlineReport) return;
    setTimeout(() => showOfflineReport(), modalCloseMs() + 20);
  }

  function openSettingsModal(section) {
    if (!DOM.settingsModal) return;
    const targetTab = section || settingsState.activeTab || "accessibility";
    openModalSurface(DOM.settingsModal, DOM.settingsDialog);
    DOM.settingsModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    activateSettingsTab(targetTab);
    if (Settings && typeof Settings.refresh === "function") {
      Settings.refresh();
    }
    if (DOM.settingsDialog) {
      DOM.settingsDialog.setAttribute("tabindex", "-1");
      DOM.settingsDialog.focus();
    }
    if (TutorialEngine && typeof TutorialEngine.markMilestone === "function") {
      TutorialEngine.markMilestone("settings");
    }
  }

  function closeSettingsModal(restoreFocus = true) {
    if (
      !DOM.settingsModal ||
      DOM.settingsModal.classList.contains("hidden") ||
      DOM.settingsModal.classList.contains("is-closing")
    ) {
      return false;
    }
    closeModalSurface(DOM.settingsModal, DOM.settingsDialog);
    DOM.settingsModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (restoreFocus) restoreModalFocus(DOM.settingsModal, settingsState.lastTrigger);
    settingsState.lastTrigger = null;
    schedulePendingOfflineReport();
    return true;
  }

  function activateSettingsTab(section) {
    if (!section) return;
    settingsState.activeTab = section;
    if (DOM.settingsTabs && DOM.settingsTabs.length) {
      DOM.settingsTabs.forEach(tab => {
        const match = tab.getAttribute("data-settings-tab") === section;
        tab.classList.toggle("active", match);
        tab.setAttribute("aria-selected", match ? "true" : "false");
        tab.tabIndex = match ? 0 : -1;
      });
    }
    if (DOM.settingsSections && DOM.settingsSections.length) {
      DOM.settingsSections.forEach(sectionEl => {
        const match = sectionEl.getAttribute("data-settings-section") === section;
        sectionEl.classList.toggle("hidden", !match);
      });
    }
  }

  function handleSettingsTabKeydown(event) {
    const tabs = Array.from(DOM.settingsTabs || []);
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0) return;
    let nextIndex = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const target = tabs[nextIndex];
    activateSettingsTab(target.getAttribute("data-settings-tab"));
    target.focus({ preventScroll: true });
  }

  function switchDetailTab(tab) {
    if (!DOM.contractsPanel || !DOM.journalPanel) return;
    const unlocked = areContractsUnlocked();
    const showContracts = tab === "contracts" && unlocked;
    uiState.detailTab = showContracts ? "contracts" : "journal";
    DOM.contractsPanel.classList.toggle("hidden", !showContracts);
    DOM.journalPanel.classList.toggle("hidden", showContracts);
    if (DOM.contractsTab) {
      DOM.contractsTab.classList.toggle("hidden", !unlocked);
      DOM.contractsTab.classList.toggle("active", showContracts);
      DOM.contractsTab.setAttribute("aria-selected", showContracts ? "true" : "false");
      DOM.contractsTab.setAttribute("aria-hidden", unlocked ? "false" : "true");
      DOM.contractsTab.tabIndex = showContracts ? 0 : -1;
    }
    if (DOM.journalTab) {
      DOM.journalTab.classList.toggle("active", !showContracts);
      DOM.journalTab.setAttribute("aria-selected", !showContracts ? "true" : "false");
      DOM.journalTab.tabIndex = showContracts ? -1 : 0;
    }
    if (!showContracts && TutorialEngine && typeof TutorialEngine.markMilestone === "function") {
      TutorialEngine.markMilestone("journal");
    }
  }

  function handleRestartTutorial() {
    if (!Settings || !TutorialEngine) return;
    Settings.setPreference("tutorialEnabled", true);
    Settings.setPreference("tutorialCompleted", false);
    if (typeof TutorialEngine.restart !== "function") return;
    const didCloseSettings = closeSettingsModal();
    if (didCloseSettings) {
      setTimeout(() => TutorialEngine.restart(), modalCloseMs() + 20);
    } else {
      TutorialEngine.restart();
    }
  }

  /** Simple translation helper that handles string interpolation. */
  function getI18nDict(lang) {
    const dicts = window.I18N || {};
    return dicts[lang] || dicts[DEFAULT_LANG] || {};
  }

  function t(key, params = {}) {
    const dict = getI18nDict(currentLang);
    const fallbackDict = getI18nDict(DEFAULT_LANG);
    const template = dict[key] || fallbackDict[key] || key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, token) => {
      return params[token] !== undefined ? params[token] : "";
    });
  }

  /** Applies text labels to every DOM node declaring data-i18n. */
  function applyStaticTranslations() {
    // Titre SEO localisé (mots-clés) plutôt que le seul nom du jeu : Google
    // indexe le title rendu, qui doit rester aligné avec le <head> statique.
    document.title = t("app.metaTitle");
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
      const key = el.getAttribute("data-i18n-aria-label");
      el.setAttribute("aria-label", t(key));
    });
    if (DOM.langSelect) {
      DOM.langSelect.setAttribute("aria-label", t("actions.languageLabel"));
    }
    document.querySelectorAll("[data-dashboard-link]").forEach(dashLink => {
      dashLink.setAttribute(
        "href",
        currentLang === DEFAULT_LANG ? "/dashboard/" : "/dashboard/?lang=" + currentLang
      );
    });
    if (DOM.closeEventBanner) {
      DOM.closeEventBanner.setAttribute("aria-label", t("actions.closeBanner"));
    }
    if (DOM.closeEventModal) {
      DOM.closeEventModal.setAttribute("aria-label", t("events.dismiss"));
    }
    applyGameTitle();
    renderGodModePanel(true);
    careerUiState.renderSignature = "";
    renderCareerPanel(true);
    renderAchievementsPanel();
    refreshEventBanner();
  }

  function applyGameTitle() {
    document.querySelectorAll("[data-game-title]").forEach(el => {
      el.textContent = "";
      /* Une lettre par span pour l'animation logo-pop du wordmark ;
         les spans sont aria-hidden, le titre complet reste lisible
         par les lecteurs d'écran via le span sr-only. */
      const srTitle = document.createElement("span");
      srTitle.className = "sr-only";
      srTitle.textContent = GAME_TITLE;
      el.appendChild(srTitle);
      Array.from(GAME_TITLE).forEach((char, index) => {
        if (char === " ") {
          el.appendChild(document.createTextNode(" "));
          return;
        }
        const span = document.createElement("span");
        span.className = "logo-char";
        span.setAttribute("aria-hidden", "true");
        span.style.setProperty("--i", String(index));
        span.textContent = char;
        el.appendChild(span);
      });
    });
  }

  function handleExportSave() {
    if (!Persistence.isAvailable || !Persistence.isAvailable()) {
      alert(t("actions.saveUnavailable"));
      return;
    }
    queueSave(true);
    const data = Persistence.exportData();
    if (!data) {
      alert(t("actions.exportError"));
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(data).then(
        () => alert(t("actions.exportSuccess")),
        () => prompt(t("actions.exportPrompt"), data)
      );
    } else {
      prompt(t("actions.exportPrompt"), data);
    }
  }

  function handleImportSave() {
    const raw = prompt(t("actions.importPrompt"));
    if (!raw) return;
    const ok = Persistence.importData ? Persistence.importData(raw) : false;
    if (!ok) {
      alert(t("actions.importError"));
      return;
    }
    try {
      window.localStorage.removeItem(DASH_SNAPSHOT_KEY);
      window.localStorage.removeItem(ANALYTICS_HISTORY_KEY);
    } catch {
      // The imported save remains the source of truth.
    }
    disablePersistence();
    location.reload();
  }

  function handleResetSave() {
    if (!confirm(t("actions.resetConfirm"))) return;
    disablePersistence();
    if (Persistence && typeof Persistence.clear === "function") {
      Persistence.clear();
    }
    try {
      window.localStorage.removeItem("pe-accessibility");
      window.localStorage.removeItem(DASH_SNAPSHOT_KEY);
      window.localStorage.removeItem(ANALYTICS_HISTORY_KEY);
    } catch {
      // ignore storage errors
    }
    location.reload();
  }

  /** Navigates to the canonical static page for the requested language. */
  function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) {
      lang = DEFAULT_LANG;
    }
    try {
      const path = lang === DEFAULT_LANG ? "/" : `/${lang}/`;
      const url = new URL(path, window.location.origin);
      url.hash = window.location.hash;
      window.location.assign(url.href);
      return;
    } catch {
      // file:// et environnements sans navigation : conserver le filet client.
    }
    currentLang = lang;
    if (DOM.langSelect && DOM.langSelect.value !== lang) DOM.langSelect.value = lang;
    applyStaticTranslations();
    renderCollapsiblePanelControls();
    renderContractsPanel();
    document.documentElement.setAttribute("lang", lang);
    uiState.buildingsDirty = true;
    uiState.upgradesDirty = true;
    uiState.lastAction = null;
    uiState.completionReceipt = null;
    careerUiState.renderSignature = "";
    achievementsState.renderSignature = "";
    contractsState.listRenderSignature = "";
    renderAll(true);
  }

  /** Configures the language selector and runs the initial translation pass. */
  function initLocalization() {
    if (DOM.langSelect) {
      DOM.langSelect.value = currentLang;
      DOM.langSelect.addEventListener("change", event => {
        setLanguage(event.target.value);
      });
    }
    applyStaticTranslations();
  }

  function sanitizeCollapsedPanelIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(panelId => COLLAPSIBLE_PANEL_IDS.includes(panelId)))];
  }

  function panelForTarget(target) {
    if (!target || !target.matches) return null;
    if (target.matches("[data-collapsible-panel]")) return target;
    const ancestor = target.closest("[data-collapsible-panel]");
    if (ancestor) return ancestor;
    return target.querySelector ? target.querySelector("[data-collapsible-panel]") : null;
  }

  function panelName(panel) {
    if (!panel) return "";
    const headingId = panel.getAttribute("aria-labelledby");
    const heading = headingId ? document.getElementById(headingId) : null;
    return heading ? heading.textContent.trim() : "";
  }

  function updatePanelToggle(button, panel, collapsed) {
    if (!button) return;
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const label = button.querySelector("[data-panel-toggle-label]");
    setTextIfChanged(label, t(collapsed ? "actions.expand" : "actions.collapse"));
    button.setAttribute("aria-label", t(collapsed ? "actions.expandPanel" : "actions.collapsePanel", {
      name: panelName(panel)
    }));
  }

  function setPanelCollapsed(panelId, collapsed, options = {}) {
    if (!COLLAPSIBLE_PANEL_IDS.includes(panelId)) return false;
    const panel = document.querySelector(`[data-collapsible-panel="${panelId}"]`);
    const body = document.querySelector(`[data-panel-body="${panelId}"]`);
    const button = document.querySelector(`[data-panel-toggle="${panelId}"]`);
    if (!panel || !body || !button) return false;
    panel.classList.toggle("is-collapsed", collapsed);
    body.hidden = collapsed;
    document.documentElement.classList.toggle("panel-collapsed-" + panelId, collapsed);
    updatePanelToggle(button, panel, collapsed);
    if (options.persist !== false && Settings && typeof Settings.setPreference === "function") {
      const previous = sanitizeCollapsedPanelIds(Settings.getPreference("collapsedPanels"));
      const next = collapsed
        ? [...new Set([...previous, panelId])]
        : previous.filter(id => id !== panelId);
      Settings.setPreference("collapsedPanels", next);
    }
    return true;
  }

  function renderCollapsiblePanelControls() {
    const collapsedPanels = sanitizeCollapsedPanelIds(
      Settings && typeof Settings.getPreference === "function"
        ? Settings.getPreference("collapsedPanels")
        : []
    );
    COLLAPSIBLE_PANEL_IDS.forEach(panelId => {
      setPanelCollapsed(panelId, collapsedPanels.includes(panelId), { persist: false });
    });
  }

  function expandPanelForTarget(target, options = {}) {
    const panel = panelForTarget(target);
    if (!panel) return false;
    const panelId = panel.getAttribute("data-collapsible-panel");
    return setPanelCollapsed(panelId, false, options);
  }

  function targetFromHash(hash) {
    if (!hash || hash.charAt(0) !== "#") return null;
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return null;
    }
  }

  function initCollapsiblePanels() {
    renderCollapsiblePanelControls();
    if (DOM.panelToggles) {
      DOM.panelToggles.forEach(button => {
        button.addEventListener("click", () => {
          const panelId = button.getAttribute("data-panel-toggle");
          const collapsed = button.getAttribute("aria-expanded") === "true";
          setPanelCollapsed(panelId, collapsed, { persist: true });
        });
      });
    }
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener("click", () => {
        expandPanelForTarget(targetFromHash(link.getAttribute("href")), { persist: true });
      });
    });
    window.addEventListener("hashchange", () => {
      expandPanelForTarget(targetFromHash(window.location.hash), { persist: true });
    });
    expandPanelForTarget(targetFromHash(window.location.hash), { persist: true });
  }

  function initTutorialGuidance() {
    if (!TutorialEngine || !Settings) return;
    const steps = [
      {
        id: "click",
        titleKey: "tutorial.step.click.title",
        bodyKey: "tutorial.step.click.body",
        selector: "#clickButton",
        milestone: "click"
      },
      {
        id: "building",
        titleKey: "tutorial.step.building.title",
        bodyKey: "tutorial.step.building.body",
        selector: "#buildingsList",
        milestone: "building"
      },
      {
        id: "journal",
        titleKey: "tutorial.step.journal.title",
        bodyKey: "tutorial.step.journal.body",
        selector: "#journalTab",
        milestone: "journal"
      },
      {
        id: "settings",
        titleKey: "tutorial.step.settings.title",
        bodyKey: "tutorial.step.settings.body",
        selector: "#settingsGearButton",
        milestone: "settings"
      }
    ];
    TutorialEngine.configure({
      steps,
      translate: t,
      settings: Settings,
      onBeforeHighlight: selector => {
        const target = selector ? document.querySelector(selector) : null;
        expandPanelForTarget(target, { persist: true });
      },
      onComplete: () => logMessage("log.tutorialComplete"),
      autoStart: experienceStarted && experienceMode === "playing"
    });
  }

  function assignFiniteNumbers(target, source) {
    if (!source || typeof source !== "object") return;
    Object.keys(target).forEach(key => {
      if (typeof target[key] !== "number") return;
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        target[key] = value;
      }
    });
  }

  function isValidTimestamp(value) {
    return Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime());
  }

  function hydrateAnalyticsState(savedAnalytics, partialHistory) {
    const next = createAnalyticsState(partialHistory);
    if (!savedAnalytics || typeof savedAnalytics !== "object") return next;
    if (isValidTimestamp(savedAnalytics.coverageStart)) {
      next.coverageStart = savedAnalytics.coverageStart;
    }
    next.partialHistory = !!savedAnalytics.partialHistory;
    const savedRun = savedAnalytics.currentRun;
    if (savedRun && typeof savedRun === "object") {
      if (typeof savedRun.id === "string" && savedRun.id) next.currentRun.id = savedRun.id;
      const defaultStartedAt = next.currentRun.startedAt;
      assignFiniteNumbers(next.currentRun, savedRun);
      next.currentRun.startedAt = isValidTimestamp(savedRun.startedAt)
        ? savedRun.startedAt
        : defaultStartedAt;
    }
    assignFiniteNumbers(next.lifetimeObserved, savedAnalytics.lifetimeObserved);
    if (Array.isArray(savedAnalytics.runSummaries)) {
      next.runSummaries = savedAnalytics.runSummaries
        .filter(item => item && typeof item === "object")
        .slice(-20)
        .map(item => {
          const summary = { ...item };
          summary.startedAt = isValidTimestamp(item.startedAt) ? item.startedAt : null;
          summary.endedAt = isValidTimestamp(item.endedAt) ? item.endedAt : null;
          return summary;
        });
    }
    return next;
  }

  function loadAnalyticsHistory() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(ANALYTICS_HISTORY_KEY) || "null");
      if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.samples)) return [];
      return raw.samples
        .filter(sample => sample && isValidTimestamp(sample.generatedAt))
        .slice(-ANALYTICS_MAX_SAMPLES);
    } catch {
      return [];
    }
  }

  /** Initialises the building deck, upgrades and kicks off the loop. */
  function initGame() {
    gameState.buildings = BUILDING_DEFS.map((def, index) => ({
      ...def,
      quantity: 0,
      // The first tier is always visible so new players immediately see
      // what to save up for; later tiers unlock via syncBuildingUnlocks().
      isUnlocked: index === 0
    }));

    gameState.upgrades = [
      {
        id: "upg_click_power_1",
        nameKey: "upgrade.upg_click_power_1.name",
        descKey: "upgrade.upg_click_power_1.desc",
        purchased: false,
        cost: 200,
        type: "clickMult",
        value: 2,
        unlockDocTotal: 150,
        unlocked: false
      },
      {
        id: "upg_global_prod_1",
        nameKey: "upgrade.upg_global_prod_1.name",
        descKey: "upgrade.upg_global_prod_1.desc",
        purchased: false,
        cost: 1000,
        type: "globalProdMult",
        value: 1.2,
        unlockDocTotal: 1500,
        unlocked: false
      },
      {
        id: "upg_quality_boost_1",
        nameKey: "upgrade.upg_quality_boost_1.name",
        descKey: "upgrade.upg_quality_boost_1.desc",
        purchased: false,
        cost: 1800,
        type: "qualityFlat",
        value: 0.1,
        unlockDocTotal: 2000,
        unlocked: false
      }
    ];

    const savedState = Persistence.load ? Persistence.load() : null;
    experienceStartedAt = savedState && savedState.meta && isValidTimestamp(savedState.meta.startedAt)
      ? savedState.meta.startedAt
      : null;
    experienceStarted = !!experienceStartedAt || hasMeaningfulProgress(savedState);
    if (experienceStarted && !experienceStartedAt) {
      experienceStartedAt = savedState && isValidTimestamp(savedState.savedAt)
        ? savedState.savedAt
        : Date.now();
    }
    analyticsState = hydrateAnalyticsState(savedState && savedState.analytics, !!savedState && !savedState.analytics);
    if (
      savedState &&
      !savedState.analytics &&
      savedState.resources &&
      Number(savedState.resources.culturePoints) > 0
    ) {
      // Avant l'historique analytique, la Culture ne pouvait provenir que
      // d'une réorganisation. Conserver ce fait sans faire la même déduction
      // pour les sauvegardes V3, où défis et succès donnent aussi de la Culture.
      analyticsState.lifetimeObserved.prestiges = 1;
    }
    analyticsHistory = loadAnalyticsHistory();
    if (savedState && savedState.analytics && analyticsHistory.length === 0) {
      // An imported/cleared profile may retain aggregate counters without the
      // separate time-series key. Never present that situation as complete.
      analyticsState.partialHistory = true;
    }
    if (analyticsHistory.length) {
      lastAnalyticsSampleAt = analyticsHistory[analyticsHistory.length - 1].generatedAt;
    }
    applyPersistedState(savedState);
    careerState = Progression && typeof Progression.hydrateCareer === "function"
      ? Progression.hydrateCareer(savedState && savedState.career, {
          culturePoints: gameState.resources.culturePoints,
          now: Date.now()
        })
      : null;
    restorePendingEvent(savedState);
    offlineReport = settleOfflineProgress(savedState);
    const loadProgress = updateCareerProgress({ notify: false, save: false });
    const careerProgressNeedsSave = Boolean(loadProgress && (
      (loadProgress.planObjectivesCompleted || []).length ||
      (loadProgress.challengeObjectivesCompleted || []).length ||
      (loadProgress.campaignObjectivesCompleted || []).length ||
      loadProgress.challengeCompleted ||
      loadProgress.campaignCompleted ||
      loadProgress.conclusionUnlocked
    ));

    if (window.EndgameModule) {
      const savedContract = savedState && savedState.endgame
        ? savedState.endgame.activeContract
        : null;
      window.EndgameModule.loadData(gameState, savedContract).then(() => {
        syncCampaignContractPriority();
        renderContractsPanel();
        renderWorkOrder();
        if (careerProgressNeedsSave) {
          // Progress and any Culture reward must land in the same transaction,
          // after the active contract was restored.
          queueSave(true);
        }
      });
    } else if (careerProgressNeedsSave) {
      queueSave(true);
    }

    uiState.buildingsDirty = true;
    uiState.upgradesDirty = true;
    refreshUpgradeUnlocks(true);
    logMessage("log.welcome");
    renderAll(true);
    uiState.initialRenderComplete = true;
    showOfflineReport();
    gameState.time.lastUpdate = performance.now();
    requestAnimationFrame(gameLoop);
    // Autosave périodique seulement après l'entrée dans le jeu : la landing
    // ne crée plus une fausse sauvegarde ni une fausse session analytique.
    setInterval(() => {
      if (experienceStarted) queueSave();
    }, 5000);
  }

  function buildPersistedState() {
    return {
      version: 3,
      meta: { startedAt: experienceStartedAt },
      resources: { ...gameState.resources },
      stats: { ...gameState.stats },
      buildings: gameState.buildings.map(b => ({
        id: b.id,
        quantity: b.quantity,
        isUnlocked: !!b.isUnlocked
      })),
      upgrades: gameState.upgrades.map(u => ({ id: u.id, purchased: !!u.purchased })),
      achievements: {
        unlocked: { ...achievementsState.unlocked },
        rewarded: { ...achievementsState.rewarded }
      },
      career: Progression && careerState && typeof Progression.serializeCareer === "function"
        ? Progression.serializeCareer(careerState)
        : null,
      endgame: {
        activeContract: window.EndgameModule && typeof window.EndgameModule.exportActiveContract === "function"
          ? window.EndgameModule.exportActiveContract()
          : null
      },
      events: {
        pendingId: eventState.active && typeof eventState.active.id === "string"
          ? eventState.active.id
          : null
      },
      analytics: JSON.parse(JSON.stringify(analyticsState)),
      lastSeen: Date.now()
    };
  }

  function isStateRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function restoreResourceNumbers(savedResources) {
    if (!isStateRecord(savedResources)) return;
    Object.keys(gameState.resources).forEach(key => {
      const value = savedResources[key];
      // Les monnaies sont des valeurs continues et peuvent légitimement
      // dépasser MAX_SAFE_INTEGER dans une partie avancée. La contrainte
      // d'entier sûr reste réservée aux quantités de bâtiments.
      if (Number.isFinite(value) && value >= 0) {
        gameState.resources[key] = value;
      }
    });
  }

  function applyPersistedState(saved) {
    if (!isStateRecord(saved)) return;
    // Migration des sauvegardes d'avant le renommage des identifiants
    // (imageVbs -> brandImage, vbsPortal -> clientPortal).
    const savedStats = isStateRecord(saved.stats) ? saved.stats : null;
    restoreResourceNumbers(saved.resources);
    if (savedStats) {
      const brandImage = Number.isFinite(savedStats.brandImage)
        ? savedStats.brandImage
        : savedStats.imageVbs;
      if (Number.isFinite(savedStats.quality)) gameState.stats.quality = clamp01(savedStats.quality);
      if (Number.isFinite(savedStats.footprint)) gameState.stats.footprint = clamp01(savedStats.footprint);
      if (Number.isFinite(brandImage)) gameState.stats.brandImage = clamp01(brandImage);
    }
    if (Array.isArray(saved.buildings)) {
      for (const entry of saved.buildings) {
        if (!isStateRecord(entry)) continue;
        const buildingId = entry.id === "vbsPortal" ? "clientPortal" : entry.id;
        const target = gameState.buildings.find(b => b.id === buildingId);
        if (target && Number.isSafeInteger(entry.quantity) && entry.quantity >= 0) {
          target.quantity = entry.quantity;
          // Older saves do not expose isUnlocked; owned buildings still
          // migrate as visible, while newer saves retain opened blueprints.
          if (entry.isUnlocked === true || target.quantity > 0) {
            target.isUnlocked = true;
          }
        }
      }
    }
    if (Array.isArray(saved.upgrades)) {
      for (const entry of saved.upgrades) {
        if (!isStateRecord(entry)) continue;
        const target = gameState.upgrades.find(u => u.id === entry.id);
        if (target) {
          target.purchased = entry.purchased === true;
        }
      }
    }
    if (isStateRecord(saved.achievements)) {
      const achievementIds = new Set(
        window.Achievements && Array.isArray(window.Achievements.definitions)
          ? window.Achievements.definitions.map(definition => definition.id)
          : []
      );
      const rawUnlocked = isStateRecord(saved.achievements.unlocked)
        ? saved.achievements.unlocked
        : saved.achievements;
      achievementsState.unlocked = Object.fromEntries(
        Object.entries(rawUnlocked).flatMap(([id, unlocked]) => {
          if (!achievementIds.has(id)) return [];
          if (unlocked !== true && !(Number.isFinite(unlocked) && unlocked > 0)) return [];
          const timestamp = Number.isFinite(unlocked) && unlocked > 0
            ? unlocked
            : isValidTimestamp(saved.savedAt) ? saved.savedAt : Date.now();
          return [[id, timestamp]];
        })
      );
      const rawRewarded = isStateRecord(saved.achievements.rewarded)
        ? saved.achievements.rewarded
        : rawUnlocked;
      achievementsState.rewarded = Object.fromEntries(
        Object.entries(rawRewarded).flatMap(([id, rewarded]) => {
          if (!achievementsState.unlocked[id]) return [];
          if (rewarded !== true && !(Number.isFinite(rewarded) && rewarded > 0)) return [];
          return [[id, Number.isFinite(rewarded) && rewarded > 0 ? rewarded : achievementsState.unlocked[id]]];
        })
      );
    }
  }

  /** Rapport d'activité hors-ligne : crédite la production accumulée
      pendant l'absence (rendement réduit, plafonné) et décrit le résultat. */
  let offlineReport = null;

  /** Barème d'absence, partagé entre sauvegarde rechargée et onglet masqué :
      rendement réduit, plafonné, sans confiance ni dérive de jauges. */
  function applyAwayGain(elapsedSeconds) {
    const cfg = gameState.config;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < cfg.offlineMinSeconds) {
      return null;
    }
    const cappedSeconds = Math.min(elapsedSeconds, cfg.offlineCapHours * 3600);
    const gain = computeDocPerSecond() * cappedSeconds * cfg.offlineRate;
    if (gain < 1) return null;
    gameState.resources.docBank += gain;
    gameState.resources.docTotal += gain;
    analyticsState.currentRun.offlineDocs += gain;
    analyticsState.lifetimeObserved.docs += gain;
    return { elapsedSeconds, cappedSeconds, gain };
  }

  function settleOfflineProgress(saved) {
    if (!saved || typeof saved.lastSeen !== "number") return null;
    return applyAwayGain((Date.now() - saved.lastSeen) / 1000);
  }

  function formatOfflineDuration(seconds) {
    const totalMinutes = Math.max(1, Math.floor(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return t("offline.durationHours", { hours, minutes });
    }
    return t("offline.durationMinutes", { minutes });
  }

  function showOfflineReport() {
    if (!offlineReport) return;
    if (experienceMode !== "playing") return;
    // Sous ~5 min d'absence : crédit silencieux, pas de modale plein écran
    // à chaque pause café (fatigue de modale).
    if (offlineReport.elapsedSeconds < gameState.config.offlineModalMinSeconds) {
      offlineReport = null;
      queueSave(true);
      return;
    }
    if (isModalSurfaceOpen(DOM.settingsModal) || isModalSurfaceOpen(DOM.eventModal)) {
      return;
    }
    // Ne pas concurrencer le tutoriel : le rapport attendra la prochaine
    // visite (les documents sont crédités dans tous les cas).
    if (window.Settings && Settings.getPreference("tutorialEnabled") &&
        !Settings.getPreference("tutorialCompleted")) {
      offlineReport = null;
      queueSave(true);
      return;
    }
    const modal = DOM.offlineModal;
    if (!modal) return;
    const dialog = modal.querySelector(".offline-dialog");
    if (dialog) {
      dialog.setAttribute("data-stamp", t("offline.stampVisa"));
    }
    const duration = document.getElementById("offlineDuration");
    const docs = document.getElementById("offlineDocs");
    if (duration) {
      let text = formatOfflineDuration(offlineReport.elapsedSeconds);
      if (offlineReport.cappedSeconds < offlineReport.elapsedSeconds - 1) {
        text = t("offline.durationCapped", {
          real: text,
          kept: formatOfflineDuration(offlineReport.cappedSeconds)
        });
      }
      duration.textContent = text;
    }
    if (docs) docs.textContent = "+" + formatNumber(offlineReport.gain) + " DOC";
    const listeners = new AbortController();
    const close = (restoreFocus = true) => {
      closeModalSurface(modal, dialog);
      if (restoreFocus) restoreModalFocus(modal);
      listeners.abort();
    };
    const onKey = event => {
      if (event.key === "Escape") close();
    };
    openModalSurface(modal, dialog);
    document.addEventListener("keydown", onKey, { signal: listeners.signal });
    const closeBtn = document.getElementById("closeOfflineModal");
    const resumeBtn = document.getElementById("offlineResume");
    const objectiveBtn = document.getElementById("offlineObjective");
    const once = { once: true, signal: listeners.signal };
    if (closeBtn) closeBtn.addEventListener("click", () => close(), once);
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => close(), once);
      resumeBtn.focus();
    }
    if (objectiveBtn) {
      objectiveBtn.addEventListener("click", () => {
        close(false);
        setTimeout(() => {
          if (!DOM.currentObjective) return;
          DOM.currentObjective.scrollIntoView({
            block: "center",
            behavior: reduceMotionPreferred() ? "auto" : "smooth"
          });
          DOM.currentObjective.focus({ preventScroll: true });
        }, modalCloseMs() + 20);
      }, once);
    }
    offlineReport = null;
    queueSave(true);
  }

  /** Projection sérialisable de l'économie. Le module analytique reste pur :
      lire la Data Science Zone ne peut jamais modifier la simulation. */
  function buildEconomyState() {
    return {
      buildings: gameState.buildings.map(building => ({ ...building })),
      upgrades: gameState.upgrades.map(upgrade => ({ ...upgrade })),
      resources: { ...gameState.resources },
      stats: { ...gameState.stats },
      config: { ...gameState.config },
      careerModifiers: { ...getCareerModifiers() }
    };
  }

  function buildDashboardSnapshot() {
    const generatedAt = Date.now();
    const economyState = buildEconomyState();
    const fallbackMultipliers = computeMultipliers();
    const fallbackDocPerSecond = computeDocPerSecond(fallbackMultipliers);
    const automatic = EconomyAnalytics && typeof EconomyAnalytics.computeAutomaticEconomics === "function"
      ? EconomyAnalytics.computeAutomaticEconomics(economyState)
      : { status: "unavailable", reason: "analytics-module-missing" };
    const investments = EconomyAnalytics && typeof EconomyAnalytics.buildInvestmentRows === "function"
      ? EconomyAnalytics.buildInvestmentRows(economyState)
      : [];
    const prestige = EconomyAnalytics && typeof EconomyAnalytics.computePrestigeOutlook === "function"
      ? EconomyAnalytics.computePrestigeOutlook(economyState)
      : null;
    const docPerSecond = automatic.status === "exact"
      ? automatic.docPerSecond
      : fallbackDocPerSecond;
    const ccPerSecond = automatic.status === "exact"
      ? automatic.ccPerSecond
      : docPerSecond *
        (0.1 + clamp01(gameState.stats.quality) * 0.9) *
        (0.5 + clamp01(gameState.stats.brandImage) * 0.5) *
        fallbackMultipliers.ccMult;
    const productionById = new Map(
      automatic.status === "exact" && Array.isArray(automatic.buildings)
        ? automatic.buildings.map(item => [item.id, item.directAutomaticDocPerSecond])
        : []
    );
    const careerSummary = Progression && careerState && typeof Progression.getSummary === "function"
      ? Progression.getSummary(careerState, buildCareerContext(docPerSecond))
      : null;
    const careerModifiers = getCareerModifiers();

    return {
      schemaVersion: 2,
      modelVersion: automatic.formulaVersion || 1,
      generatedAt,
      runId: analyticsState.currentRun.id,
      coverageStart: analyticsState.coverageStart,
      partialHistory: analyticsState.partialHistory,
      current: {
        docPerSecond,
        ccPerSecond,
        docBank: gameState.resources.docBank,
        docTotal: gameState.resources.docTotal,
        ccTotal: gameState.resources.ccTotal,
        culturePoints: gameState.resources.culturePoints,
        prestigeMult: prestigeMultiplier(),
        buildingCount: gameState.buildings.reduce((sum, building) => sum + building.quantity, 0),
        modifiers: { ...careerModifiers },
        stats: { ...gameState.stats },
        buildings: gameState.buildings.map(building => ({
          id: building.id,
          nameKey: building.nameKey,
          quantity: building.quantity,
          production: productionById.get(building.id) || 0
        }))
      },
      economics: {
        automatic,
        investments,
        prestige,
        modifiers: { ...careerModifiers }
      },
      career: careerSummary,
      analytics: JSON.parse(JSON.stringify(analyticsState))
    };
  }

  function analyticsHistoryEnvelope() {
    return {
      schemaVersion: 1,
      coverageStart: analyticsState.coverageStart,
      partialHistory: analyticsState.partialHistory,
      samples: analyticsHistory.map(sample => ({ ...sample }))
    };
  }

  function recordAnalyticsSample(snapshot) {
    if (!snapshot || snapshot.generatedAt - lastAnalyticsSampleAt < ANALYTICS_SAMPLE_INTERVAL_MS) return;
    const current = snapshot.current;
    analyticsHistory.push({
      generatedAt: snapshot.generatedAt,
      runId: snapshot.runId,
      docPerSecond: current.docPerSecond,
      ccPerSecond: current.ccPerSecond,
      docBank: current.docBank,
      docTotal: current.docTotal,
      ccTotal: current.ccTotal,
      quality: current.stats.quality,
      footprint: current.stats.footprint,
      brandImage: current.stats.brandImage
    });
    if (analyticsHistory.length > ANALYTICS_MAX_SAMPLES) {
      analyticsHistory = analyticsHistory.slice(-ANALYTICS_MAX_SAMPLES);
      analyticsState.partialHistory = true;
      snapshot.partialHistory = true;
      if (snapshot.analytics) snapshot.analytics.partialHistory = true;
    }
    lastAnalyticsSampleAt = snapshot.generatedAt;
    window.localStorage.setItem(ANALYTICS_HISTORY_KEY, JSON.stringify(analyticsHistoryEnvelope()));
  }

  /** Écrit la sauvegarde et publie un snapshot analytique borné. La page
      /dashboard/ le suit via localStorage et l'événement storage. */
  function persistNow(forceDashboard = false) {
    try {
      const now = Date.now();
      if (forceDashboard || now - lastDashboardPersistAt >= DASH_SNAPSHOT_INTERVAL_MS) {
        const snapshot = buildDashboardSnapshot();
        recordAnalyticsSample(snapshot);
        window.localStorage.setItem(DASH_SNAPSHOT_KEY, JSON.stringify(snapshot));
        lastDashboardPersistAt = snapshot.generatedAt;
      }
    } catch {
      // quota plein : le jeu reste prioritaire, le dashboard vivra sans live
    }
    // Keep the canonical save independent from analytics storage failures and
    // persist any partial-history flag raised while bounding the time series.
    Persistence.save(buildPersistedState());
  }

  function queueSave(force = false) {
    if (!experienceStarted) return;
    if (persistenceDisabled) return;
    if (!Persistence.isAvailable || !Persistence.isAvailable()) return;
    if (force) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      persistNow(true);
      return;
    }
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      persistNow(false);
      saveTimer = null;
    }, 500);
  }

  function disablePersistence() {
    persistenceDisabled = true;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  /** Formats numbers following simple thresholds for readability. */
  function formatNumber(n) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + " Md";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + " M";
    if (n >= 10_000) return (n / 1_000).toFixed(1) + " k";
    if (n >= 1000) return (n / 1_000).toFixed(2) + " k";
    if (n === 0) return "0";
    if (n < 1) return n.toFixed(3);
    return n.toFixed(1);
  }

  /** Pretty-prints a multiplier or stat impact as a percentage string. */
  function formatPercent(value) {
    if (value === 0) return "0 %";
    const scaled = value * 100;
    const precision = Math.abs(scaled) >= 10 ? 1 : 2;
    const formatted = scaled.toFixed(precision);
    const sign = value > 0 ? "+" : "";
    return sign + formatted + " %";
  }

  /** Formats completion percentages with the active language's spacing. */
  function formatProgressPercent(value) {
    const locale = LOCALE_BY_LANG[currentLang] || LOCALE_BY_LANG.fr;
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0
    }).format(Math.max(0, Math.min(1, value)));
  }

  /** Returns the current god mode multiplier (defaults to 1). */
  function currentTimeScale() {
    return godModeState.timeScale || 1;
  }

  /**
   * Builds a string describing the modifier impact for one unit or N units.
   */
  function formatBuildingImpactText(building, quantityOverride) {
    const EPSILON = 1e-6;
    const impact = getBuildingImpact(
      building,
      typeof quantityOverride === "number" ? quantityOverride : undefined
    );
    const parts = [];

    if (Math.abs(impact.docMultiplierBonus) > EPSILON) {
      parts.push(t("impact.doc") + " " + formatPercent(impact.docMultiplierBonus));
    }
    if (Math.abs(impact.ccMultiplierBonus) > EPSILON) {
      parts.push(t("impact.cc") + " " + formatPercent(impact.ccMultiplierBonus));
    }
    if (Math.abs(impact.qualityBonus) > EPSILON) {
      parts.push(t("impact.quality") + " " + formatPercent(impact.qualityBonus));
    }
    if (Math.abs(impact.footprintBonus) > EPSILON) {
      parts.push(t("impact.footprint") + " " + formatPercent(impact.footprintBonus));
    }
    if (Math.abs(impact.imageBonus) > EPSILON) {
      parts.push(t("impact.image") + " " + formatPercent(impact.imageBonus));
    }
    if (Math.abs(impact.contractDurationReduction) > EPSILON) {
      // Les paliers de production multiplient les capacités industrielles,
      // mais le BAT reste une réduction calendaire brute par Studio, plafonnée
      // par EndgameModule. L'aperçu doit donc raconter exactement le délai que
      // le moteur figera au lancement du contrat.
      const rawQuantity = typeof quantityOverride === "number"
        ? Math.max(0, quantityOverride)
        : Math.max(0, building.quantity || 0);
      const durationCap = window.EndgameModule && Number.isFinite(window.EndgameModule.MAX_PREPRESS_DURATION_REDUCTION)
        ? window.EndgameModule.MAX_PREPRESS_DURATION_REDUCTION
        : 0.3;
      const durationReduction = Math.min(
        durationCap,
        Math.max(0, building.contractDurationReductionPerUnit || 0) * rawQuantity
      );
      parts.push(t("impact.contractDuration") + " " + formatPercent(-durationReduction));
    }

    return parts.join(" • ");
  }

  function syncBuildingInspectorButtons() {
    if (!DOM.buildingsList) return;
    DOM.buildingsList.querySelectorAll(".building-name-button").forEach(button => {
      const selected = button.getAttribute("data-building-select") === buildingInspectorState.selectedId;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      if (selected) {
        button.setAttribute(
          "aria-describedby",
          "buildingInspectorTitle buildingInspectorPrimary buildingInspectorSecondary"
        );
      } else {
        button.removeAttribute("aria-describedby");
      }
    });
  }

  function renderBuildingInspector() {
    if (!DOM.buildingInspector) return;
    const feedback = buildingInspectorState.feedback;
    const selectedBuilding = gameState.buildings.find(building => {
      return building.id === buildingInspectorState.selectedId && building.isUnlocked;
    });
    if (!feedback && buildingInspectorState.selectedId && !selectedBuilding) {
      buildingInspectorState.selectedId = null;
    }

    DOM.buildingInspector.classList.toggle("is-success", !!feedback);
    DOM.buildingInspector.classList.toggle("is-empty", !feedback && !selectedBuilding);
    if (feedback) {
      setTextIfChanged(DOM.buildingInspectorTitle, getBuildingName(
        gameState.buildings.find(building => building.id === feedback.id) || { nameKey: "" }
      ));
      setTextIfChanged(DOM.buildingInspectorPrimary, feedback.primary);
      setTextIfChanged(DOM.buildingInspectorSecondary, feedback.detail || "");
    } else if (selectedBuilding) {
      const perUnitImpact = formatBuildingImpactText(selectedBuilding, 1);
      const totalImpact = selectedBuilding.quantity > 0
        ? formatBuildingImpactText(selectedBuilding)
        : "";
      setTextIfChanged(DOM.buildingInspectorTitle, getBuildingName(selectedBuilding));
      setTextIfChanged(DOM.buildingInspectorPrimary, getBuildingDesc(selectedBuilding));
      setTextIfChanged(DOM.buildingInspectorSecondary, [
        perUnitImpact
          ? t("label.modifierPerUnit", { impact: perUnitImpact })
          : t("label.modifierPerUnitNA"),
        totalImpact
          ? t("label.modifierTotal", { impact: totalImpact })
          : t("label.modifierImpactNA")
      ].join(" · "));
    } else {
      setTextIfChanged(DOM.buildingInspectorTitle, t("operations.unitInspectorEmptyTitle"));
      setTextIfChanged(DOM.buildingInspectorPrimary, t("operations.unitInspectorEmptyHint"));
      setTextIfChanged(DOM.buildingInspectorSecondary, "");
    }
    syncBuildingInspectorButtons();
  }

  function clearBuildingInspectorFeedback() {
    if (buildingInspectorState.feedbackTimer) {
      clearTimeout(buildingInspectorState.feedbackTimer);
      buildingInspectorState.feedbackTimer = null;
    }
    buildingInspectorState.feedback = null;
  }

  function selectBuildingForInspector(id) {
    clearBuildingInspectorFeedback();
    buildingInspectorState.selectedId = buildingInspectorState.selectedId === id ? null : id;
    renderBuildingInspector();
    const selectedBuilding = gameState.buildings.find(building => {
      return building.id === buildingInspectorState.selectedId && building.isUnlocked;
    });
    if (!selectedBuilding) {
      announceStatus(t("operations.unitInspectorEmptyHint"));
      return;
    }
    const detail = formatBuildingImpactText(selectedBuilding, 1);
    announceStatus([
      getBuildingName(selectedBuilding),
      getBuildingDesc(selectedBuilding),
      detail ? t("label.modifierPerUnit", { impact: detail }) : t("label.modifierPerUnitNA")
    ].join(". "));
  }

  function clearBuildingInspectorSelection() {
    if (!buildingInspectorState.selectedId && !buildingInspectorState.feedback) return false;
    clearBuildingInspectorFeedback();
    buildingInspectorState.selectedId = null;
    renderBuildingInspector();
    return true;
  }

  /** Unlocks buildings once the player holds enough DOC to buy the next unit. */
  function syncBuildingUnlocks() {
    const unlocked = [];
    const bank = gameState.resources.docBank;
    for (const b of gameState.buildings) {
      if (!b.isUnlocked && bank >= buildingCost(b)) {
        b.isUnlocked = true;
        unlocked.push(b);
      }
    }
    if (unlocked.length) {
      uiState.buildingsDirty = true;
      if (uiState.initialRenderComplete) {
        for (const building of unlocked) {
          logMessage("feedback.unitAvailable", { name: getBuildingName(building) });
        }
        const latest = unlocked[unlocked.length - 1];
        setLastAction("feedback.unitAvailable", { name: getBuildingName(latest) });
        showEventBanner("feedback.unitAvailable", "positive", { name: getBuildingName(latest) });
      }
    }
    return unlocked;
  }

  /** Returns the current cost of buying the next unit of a building. */
  function buildingCost(building) {
    return Math.floor(
      building.baseCost *
      Math.pow(building.costMultiplier, building.quantity) *
      getCareerModifiers().buildingCostMultiplier
    );
  }

  /** Finds the real next locked plan, independent of catalogue order. */
  function getNextLockedBuilding() {
    return gameState.buildings.reduce((next, building) => {
      if (building.isUnlocked) return next;
      if (!next) return building;
      return buildingCost(building) < buildingCost(next) ? building : next;
    }, null);
  }

  /** Chooses one workshop objective when no client order is running. */
  function getInternalObjective() {
    if (canPrestige()) {
      return {
        kind: "prestige",
        target: gameState.config.prestigeRequirement
      };
    }
    const installable = gameState.buildings.reduce((next, building) => {
      if (!building.isUnlocked || building.quantity > 0) return next;
      if (!next) return building;
      return buildingCost(building) < buildingCost(next) ? building : next;
    }, null);
    if (installable) {
      return { kind: "install", building: installable, target: buildingCost(installable) };
    }
    const locked = getNextLockedBuilding();
    if (locked) {
      return { kind: "unlock", building: locked, target: buildingCost(locked) };
    }
    return {
      kind: "prestige",
      target: gameState.config.prestigeRequirement
    };
  }

  /** Projects the exact automatic rate after buying one unit. */
  function projectedDocPerSecond(building) {
    const quantity = building.quantity;
    building.quantity = quantity + 1;
    try {
      return computeDocPerSecond();
    } finally {
      building.quantity = quantity;
    }
  }

  function setLastAction(key, params = {}, detailKey = null, detailParams = {}, detailText = "") {
    uiState.lastAction = { key, params, detailKey, detailParams, detailText };
  }

  /** Localises the display name for a building. */
  function getBuildingName(building) {
    return building.nameKey ? t(building.nameKey) : building.name;
  }

  /** Localises the flavour description for a building. */
  function getBuildingDesc(building) {
    return building.descKey ? t(building.descKey) : building.desc || "";
  }

  /** Localises an upgrade name. */
  function getUpgradeName(upgrade) {
    return upgrade.nameKey ? t(upgrade.nameKey) : upgrade.name;
  }

  /** Localises an upgrade description. */
  function getUpgradeDesc(upgrade) {
    return upgrade.descKey ? t(upgrade.descKey) : upgrade.desc || "";
  }

  /** Adds an entry to the activity log and keeps the log bounded. */
  function logMessage(key, params = {}) {
    const entry = { time: new Date(), key, params };
    gameState.log.unshift(entry);
    if (gameState.log.length > 50) {
      gameState.log.pop();
    }
    uiState.logRenderSignature = "";
    renderLog();
  }

  /** Re-announces repeated outcomes while collapsing log + banner races. */
  function announceStatus(message) {
    if (!DOM.gameStatusAnnouncer) return;
    const token = ++statusAnnouncementToken;
    DOM.gameStatusAnnouncer.textContent = "";
    requestAnimationFrame(() => {
      if (token === statusAnnouncementToken && DOM.gameStatusAnnouncer) {
        DOM.gameStatusAnnouncer.textContent = message;
      }
    });
  }

  function getCareerModifiers() {
    if (!Progression || !careerState || typeof Progression.getModifiers !== "function") {
      return {
        docMultiplier: 1,
        ccMultiplier: 1,
        qualityTargetOffset: 0,
        footprintDriftMultiplier: 1,
        buildingCostMultiplier: 1,
        contractRewardMultiplier: 1
      };
    }
    return Progression.getModifiers(careerState);
  }

  function getContractModifiers() {
    const modifiers = getCareerModifiers();
    return {
      contractDocRewardMultiplier: modifiers.contractRewardMultiplier,
      contractCcRewardMultiplier: modifiers.contractRewardMultiplier,
      clauseRewardMultiplier: 1
    };
  }

  function buildCareerContext(docPerSecond) {
    const rate = Number.isFinite(docPerSecond) ? docPerSecond : computeDocPerSecond();
    return {
      resources: {
        ccTotal: gameState.resources.ccTotal
      },
      stats: {
        quality: gameState.stats.quality,
        footprint: gameState.stats.footprint,
        brandImage: gameState.stats.brandImage
      },
      metrics: {
        docPerSecond: rate
      },
      buildings: gameState.buildings.map(building => ({
        id: building.id,
        quantity: building.quantity
      }))
    };
  }

  function applyCareerCultureReward(amount) {
    const reward = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (!reward) return 0;
    gameState.resources.culturePoints += reward;
    analyticsState.currentRun.careerCulture += reward;
    return reward;
  }

  function triggerStamp(element, className) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => {
      if (element.isConnected) element.classList.remove(className);
    }, 240);
  }

  function getChallengeDefinition(id) {
    return Progression && typeof Progression.getChallengeDefinition === "function"
      ? Progression.getChallengeDefinition(id)
      : Progression && Array.isArray(Progression.CHALLENGE_DEFINITIONS)
        ? Progression.CHALLENGE_DEFINITIONS.find(definition => definition.id === id) || null
        : null;
  }

  function getCampaignDefinition(id) {
    return Progression && typeof Progression.getCampaignDefinition === "function"
      ? Progression.getCampaignDefinition(id)
      : Progression && Array.isArray(Progression.CAMPAIGN_DEFINITIONS)
        ? Progression.CAMPAIGN_DEFINITIONS.find(definition => definition.id === id) || null
        : null;
  }

  function handleChallengeFailure(failure, notify = true) {
    if (!failure) return;
    const definition = getChallengeDefinition(failure.id);
    const name = definition ? t(definition.nameKey) : failure.id;
    const reason = t("career.challenge.failure." + (failure.reason || "prestige"));
    logMessage("log.challengeFailed", { name, reason });
    if (notify) showEventBanner("feedback.challengeFailed", "negative", { name });
  }

  function handleCareerProgressResult(result, options = {}) {
    if (!result) return false;
    const notify = options.notify !== false;
    let changed = false;
    const completedPlanObjectives = result.planObjectivesCompleted || [];
    const completedChallengeObjectives = result.challengeObjectivesCompleted || [];
    const completedCampaignObjectives = result.campaignObjectivesCompleted || [];
    if (completedPlanObjectives.length || completedChallengeObjectives.length || completedCampaignObjectives.length) {
      changed = true;
    }

    const completedVisibleObjectives = completedCampaignObjectives.length
      ? completedCampaignObjectives
      : completedPlanObjectives;
    if (completedVisibleObjectives.length && notify) {
      const latest = completedVisibleObjectives[completedVisibleObjectives.length - 1];
      setLastAction("career.dossier.stepCompleted", { name: t(latest.labelKey) });
      showEventBanner("career.dossier.stepCompleted", "positive", { name: t(latest.labelKey) });
      triggerStamp(DOM.currentObjective, "is-plan-stamped");
    }

    if (result.challengeCompleted) {
      changed = true;
      const definition = getChallengeDefinition(result.challengeCompleted.id);
      const name = definition ? t(definition.nameKey) : result.challengeCompleted.id;
      const culture = applyCareerCultureReward(result.challengeCompleted.reward && result.challengeCompleted.reward.culture);
      logMessage("log.challengeCompleted", { name, culture });
      if (notify) showEventBanner("feedback.challengeCompleted", "positive", { name, culture });
    }

    if (result.campaignCompleted) {
      changed = true;
      const definition = getCampaignDefinition(result.campaignCompleted.id);
      const name = definition ? t(definition.nameKey) : result.campaignCompleted.id;
      const badge = t("career.badge." + result.campaignCompleted.badgeId);
      logMessage("log.campaignCompleted", { name, badge });
      if (notify) showEventBanner("feedback.campaignCompleted", "positive", { name, badge });
      syncCampaignContractPriority();
    }

    if (result.conclusionUnlocked) {
      changed = true;
      logMessage("log.conclusionUnlocked");
      if (notify) showEventBanner("feedback.conclusionUnlocked", "positive");
    }

    if (changed) {
      careerUiState.renderSignature = "";
      contractsState.listRenderSignature = "";
      if (options.save !== false) queueSave(true);
    }
    return changed;
  }

  function updateCareerProgress(options = {}) {
    if (!Progression || !careerState || typeof Progression.updateProgress !== "function") return null;
    const result = Progression.updateProgress(careerState, buildCareerContext(), { now: Date.now() });
    handleCareerProgressResult(result, options);
    return result;
  }

  function syncCampaignContractPriority() {
    if (!window.EndgameModule || typeof window.EndgameModule.setPriorityContracts !== "function") return;
    const campaignId = careerState && careerState.campaigns && careerState.campaigns.active
      ? careerState.campaigns.active.id
      : null;
    const priorities = campaignId === "onboarding842"
      ? ["onboardingKit"]
      : campaignId === "annualReportSeason"
        ? ["annualReports"]
        : [];
    window.EndgameModule.setPriorityContracts(priorities, gameState);
    contractsState.listRenderSignature = "";
  }

  /** Aggregates all multiplicative bonuses currently active. */
  function computeMultipliers() {
    const buildingEffects = computeBuildingEffects(gameState.buildings);
    const careerModifiers = getCareerModifiers();
    let docMult = buildingEffects.docMult;
    let ccMult = buildingEffects.ccMult;
    let clickMult = 1;
    let baseQualityOffset = 0;

    for (const upg of gameState.upgrades) {
      if (!upg.purchased) continue;
      if (upg.type === "clickMult") {
        clickMult *= upg.value;
      }
      if (upg.type === "globalProdMult") {
        docMult *= upg.value;
      }
      if (upg.type === "qualityFlat") {
        baseQualityOffset += upg.value;
      }
    }

    docMult *= careerModifiers.docMultiplier;
    ccMult *= careerModifiers.ccMultiplier;
    baseQualityOffset += careerModifiers.qualityTargetOffset;

    return {
      docMult,
      ccMult,
      clickMult,
      baseQualityOffset,
      buildingEffects,
      careerModifiers
    };
  }

  /** Computes automatic production per second. */
  function computeDocPerSecond(multipliers) {
    const mults = multipliers || computeMultipliers();
    let DOCps = 0;

    for (const b of gameState.buildings) {
      if (!b.baseProduction) continue;
      DOCps += b.baseProduction * getEffectiveQuantity(b.quantity);
    }

    DOCps *= mults.docMult;
    DOCps *= prestigeMultiplier();

    return DOCps;
  }

  /** Main game loop executed roughly every frame. */
  function gameLoop(timestamp) {
    const dt = (timestamp - gameState.time.lastUpdate) / 1000;
    if (dt <= 0) {
      gameState.time.lastUpdate = timestamp;
      requestAnimationFrame(gameLoop);
      return;
    }

    if (!experienceStarted) {
      gameState.time.lastUpdate = timestamp;
      if (timestamp - uiState.lastFrameRender >= DOM_RENDER_INTERVAL_MS) {
        renderAll();
      }
      requestAnimationFrame(gameLoop);
      return;
    }

    // Onglet resté masqué (rAF suspendu) : la longue absence passe par le
    // barème hors-ligne (rendement réduit, plafond, sans confiance) au lieu
    // d'être rejouée à 100 % dans update() — sinon « ne jamais fermer
    // l'onglet » dominerait strictement le jeu. Et dt reste borné en jeu
    // normal : aucune frame ne rejoue plus de quelques secondes.
    if (dt > gameState.config.offlineMinSeconds) {
      offlineReport = applyAwayGain(dt);
      gameState.time.lastUpdate = timestamp;
      showOfflineReport();
      queueSave(true);
      requestAnimationFrame(gameLoop);
      return;
    }

    const frameDt = Math.min(dt, 5);
    const scaledDt = frameDt * currentTimeScale();
    update(scaledDt, frameDt);
    if (timestamp - uiState.lastFrameRender >= DOM_RENDER_INTERVAL_MS) {
      renderAll();
    }
    gameState.time.lastUpdate = timestamp;
    requestAnimationFrame(gameLoop);
  }

  /** Applies resource gains, drifts and unlock checks for a time delta. */
  function update(dt, realDt = dt) {
    syncEventsPreference();
    const mults = computeMultipliers();
    const DOCps = computeDocPerSecond(mults);
    const infrastructureStep = INFRA_STAT_RATE_PER_SECOND * dt;

    gameState.stats.quality = clamp01(
      gameState.stats.quality + mults.buildingEffects.qualityBonus * infrastructureStep
    );
    gameState.stats.footprint = clamp01(
      gameState.stats.footprint + mults.buildingEffects.footprintBonus * infrastructureStep
    );
    gameState.stats.brandImage = clamp01(
      gameState.stats.brandImage + mults.buildingEffects.imageBonus * infrastructureStep
    );

    const docGain = DOCps * dt;
    gameState.resources.docBank += docGain;
    gameState.resources.docTotal += docGain;
    analyticsState.currentRun.activeSeconds += dt;
    analyticsState.currentRun.autoDocs += docGain;
    analyticsState.lifetimeObserved.docs += docGain;

    const ccGainPerSec =
      DOCps *
      (0.1 + clamp01(gameState.stats.quality) * 0.9) *
      (0.5 + clamp01(gameState.stats.brandImage) * 0.5) *
      mults.ccMult;

    const ccGain = ccGainPerSec * dt;
    gameState.resources.ccTotal += ccGain;
    analyticsState.currentRun.autoCc += ccGain;
    analyticsState.lifetimeObserved.cc += ccGain;

    const cultureGaugeBonuses = computeCultureGaugeBonuses();
    const targetQualityBase = 0.3 + mults.baseQualityOffset + cultureGaugeBonuses.quality;
    const targetQuality = clamp01(targetQualityBase);
    gameState.stats.quality += (targetQuality - gameState.stats.quality) * gameState.config.qualityRecoveryRate * dt;

    const targetImage = clamp01(0.4 + cultureGaugeBonuses.brandImage);
    gameState.stats.brandImage += (targetImage - gameState.stats.brandImage) * gameState.config.imageRecoveryRate * dt;

    gameState.stats.footprint +=
      gameState.config.footprintDriftBase *
      DOCps *
      mults.careerModifiers.footprintDriftMultiplier *
      dt;
    gameState.stats.footprint = clamp01(gameState.stats.footprint);

    refreshUpgradeUnlocks();
    if (experienceMode === "playing") {
      maybeSpawnSmallEvents(realDt, DOCps);
      checkDynamicEvents(realDt);
      tickContracts(dt);
    }
    updateCareerProgress();
    checkAchievements();
  }

  /** introduces occasional incidents/optimisations to keep gauges dynamic. */
  function maybeSpawnSmallEvents(dt, docPerSecond) {
    if (!eventState.eventsEnabled) return;
    const risk = Math.min(0.0005 * docPerSecond, 0.05);
    if (Math.random() < risk * dt) {
      const r = Math.random();
      if (r < 0.5) {
        gameState.stats.quality -= 0.03;
        gameState.stats.footprint += 0.02;
        logMessage("log.incident");
      } else {
        gameState.stats.footprint -= 0.03;
        gameState.stats.brandImage += 0.01;
        logMessage("log.optimization");
      }
      gameState.stats.quality = clamp01(gameState.stats.quality);
      gameState.stats.footprint = clamp01(gameState.stats.footprint);
      gameState.stats.brandImage = clamp01(gameState.stats.brandImage);
    }
  }

  /** Handles manual clicks to print documents immediately. */
  function handleClick(event) {
    if (!experienceStarted) startExperience();
    const mults = computeMultipliers();
    const base = gameState.config.docPerClickBase;
    const docGain = base * mults.clickMult * prestigeMultiplier();
    gameState.resources.docBank += docGain;
    gameState.resources.docTotal += docGain;
    analyticsState.currentRun.manualDocs += docGain;
    analyticsState.currentRun.clicks += 1;
    analyticsState.lifetimeObserved.docs += docGain;
    refreshUpgradeUnlocks();
    checkAchievements();
    queueSave();
    renderAll();
    const sourceButton = event && event.currentTarget ? event.currentTarget : DOM.clickButton;
    UIEffects.playClickEffect(sourceButton, { value: docGain });
    if (TutorialEngine && typeof TutorialEngine.markMilestone === "function") {
      TutorialEngine.markMilestone("click");
    }
  }

  /** Purchases a building if the player can afford it. */
  function buyBuilding(id, sourceEl) {
    const b = gameState.buildings.find(x => x.id === id);
    if (!b) return;
    const cost = buildingCost(b);
    if (gameState.resources.docBank < cost) return;

    const shouldRestoreFocus = document.activeElement === sourceEl;
    const beforeRate = computeDocPerSecond();
    gameState.resources.docBank -= cost;
    analyticsState.currentRun.buildingSpend += cost;
    const previousQuantity = b.quantity;
    b.quantity += 1;
    const milestoneEvents = Progression && careerState && typeof Progression.recordBuildingMilestones === "function"
      ? Progression.recordBuildingMilestones(careerState, b.id, previousQuantity, b.quantity)
      : [];
    const afterRate = computeDocPerSecond();
    const primaryParams = { name: getBuildingName(b) };
    const rateChanged = Math.abs(afterRate - beforeRate) > 1e-9;
    const detailKey = rateChanged ? "feedback.cadenceChange" : null;
    const detailParams = rateChanged ? {
      before: formatNumber(beforeRate),
      after: formatNumber(afterRate)
    } : {};
    const detailText = rateChanged ? "" : formatBuildingImpactText(b, 1);
    setLastAction("feedback.unitInstalled", primaryParams, detailKey, detailParams, detailText);
    uiState.buildingsDirty = true;
    contractsState.listRenderSignature = "";
    notifyScene("purchase", b.id);
    logMessage("log.buyBuilding", { name: getBuildingName(b), total: b.quantity });
    for (const milestone of milestoneEvents) {
      logMessage("log.buildingMilestone", {
        name: getBuildingName(b),
        quantity: milestone.quantity,
        multiplier: milestone.multiplier.toFixed(2)
      });
    }
    refreshUpgradeUnlocks();
    updateCareerProgress();
    const unlockedAchievement = checkAchievements();
    queueSave();
    renderAll();
    const installedRow = DOM.buildingsList
      ? DOM.buildingsList.querySelector(`[data-building-id="${id}"]`)
      : null;
    const replacementButton = installedRow
      ? installedRow.querySelector(`[data-building-btn="${id}"]`)
      : null;
    if (shouldRestoreFocus && installedRow) {
      const focusTarget = replacementButton && !replacementButton.disabled
        ? replacementButton
        : installedRow.querySelector(".building-name-button");
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
    const primaryText = t("feedback.unitInstalled", primaryParams);
    const detailTextValue = rateChanged ? t(detailKey, detailParams) : detailText;
    showBuildingFeedback(id, primaryText, detailTextValue);
    let purchaseAnnouncement = detailTextValue ? primaryText + ". " + detailTextValue : primaryText;
    if (milestoneEvents.length) {
      const milestone = milestoneEvents[milestoneEvents.length - 1];
      const milestoneParams = {
        name: getBuildingName(b),
        quantity: milestone.quantity,
        multiplier: milestone.multiplier.toFixed(2)
      };
      purchaseAnnouncement += ". " + t("feedback.buildingMilestone", milestoneParams);
      showEventBanner("feedback.buildingMilestone", "positive", milestoneParams);
      const milestoneRow = DOM.buildingsList
        ? DOM.buildingsList.querySelector(`[data-building-id="${id}"] .building-milestone`)
        : null;
      triggerStamp(milestoneRow, "is-stamped");
    }
    if (unlockedAchievement) {
      purchaseAnnouncement += ". " + t("log.achievement", { name: t(unlockedAchievement.nameKey) });
    }
    announceStatus(purchaseAnnouncement);
    // Le reçu reste attaché au bouton remplacé par le rendu : il demeure sous
    // les yeux et sous le pointeur, même au bas d'un long catalogue. Son effet
    // ne peint qu'un contour, sans transformer la carte ni déplacer l'action.
    UIEffects.playPurchaseEffect(replacementButton || sourceEl || DOM.buildingInspector || DOM.buildingsList);
    if (TutorialEngine && typeof TutorialEngine.markMilestone === "function") {
      TutorialEngine.markMilestone("building");
    }
    if (FINAL_BUILDING_ID && b.id === FINAL_BUILDING_ID && previousQuantity === 0) {
      UIEffects.playCelebrationEffect("finale");
      logMessage("log.finalBuilding", { name: getBuildingName(b) });
    }
  }

  /** Purchases an upgrade if affordable and unlocked. */
  function buyUpgrade(id, sourceEl) {
    const upg = gameState.upgrades.find(x => x.id === id);
    if (!upg || upg.purchased) return;
    if (gameState.resources.docBank < upg.cost) return;
    if (gameState.resources.docTotal < (upg.unlockDocTotal || 0)) return;

    const shouldRestoreFocus = document.activeElement === sourceEl;
    const beforeRate = computeDocPerSecond();
    gameState.resources.docBank -= upg.cost;
    analyticsState.currentRun.upgradeSpend += upg.cost;
    upg.purchased = true;
    const progressionRecord = Progression && careerState && typeof Progression.recordUpgradePurchased === "function"
      ? Progression.recordUpgradePurchased(careerState, { now: Date.now() })
      : null;
    if (progressionRecord && progressionRecord.challengeFailure) {
      handleChallengeFailure(progressionRecord.challengeFailure);
    }
    const afterRate = computeDocPerSecond();
    const rateChanged = Math.abs(afterRate - beforeRate) > 1e-9;
    const primaryParams = { name: getUpgradeName(upg) };
    const detailKey = rateChanged ? "feedback.cadenceChange" : null;
    const detailParams = rateChanged ? {
      before: formatNumber(beforeRate),
      after: formatNumber(afterRate)
    } : {};
    const detailText = rateChanged ? "" : getUpgradeDesc(upg);
    setLastAction("feedback.upgradeInstalled", primaryParams, detailKey, detailParams, detailText);
    uiState.upgradesDirty = true;
    logMessage("log.buyUpgrade", { name: getUpgradeName(upg) });
    updateCareerProgress();
    const unlockedAchievement = checkAchievements();
    queueSave();
    renderAll();
    if (shouldRestoreFocus) {
      const nextAction = DOM.upgradesList && DOM.upgradesList.querySelector("[data-upgrade-btn]:not(:disabled)");
      const prestigeAction = DOM.prestigeButton && !DOM.prestigeButton.disabled
        ? DOM.prestigeButton
        : null;
      const focusTarget = nextAction || prestigeAction || document.getElementById("upgradesPanelTitle");
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
    const primaryText = t("feedback.upgradeInstalled", primaryParams);
    const detail = rateChanged ? t(detailKey, detailParams) : detailText;
    let upgradeAnnouncement = detail ? primaryText + ". " + detail : primaryText;
    if (unlockedAchievement) {
      upgradeAnnouncement += ". " + t("log.achievement", { name: t(unlockedAchievement.nameKey) });
    }
    announceStatus(upgradeAnnouncement);
    UIEffects.playUpgradeEffect(DOM.upgradesList || sourceEl);
  }

  /** Whether the prestige reset is currently available. */
  function canPrestige() {
    return gameState.resources.ccTotal >= gameState.config.prestigeRequirement;
  }

  /** How much culture would be earned by prestiging right now. */
  function computePotentialCultureGain() {
    const ccTotal = Math.max(0, gameState.resources.ccTotal || 0);
    const divisor = Math.max(1, gameState.config.prestigeCcDivisor || 1);
    if (EconomyAnalytics && typeof EconomyAnalytics.computePotentialCultureGain === "function") {
      try {
        const sharedGain = EconomyAnalytics.computePotentialCultureGain(ccTotal, divisor);
        if (Number.isFinite(sharedGain) && sharedGain >= 0) return Math.floor(sharedGain);
      } catch {
        // Le moteur de jeu conserve la formule canonique en filet local.
      }
    }
    return Math.floor(3 * Math.log10(1 + ccTotal / divisor));
  }

  function computeCultureGaugeBonuses() {
    const culture = Math.max(0, gameState.resources.culturePoints || 0);
    if (EconomyAnalytics && typeof EconomyAnalytics.computeCultureGaugeBonuses === "function") {
      try {
        const shared = EconomyAnalytics.computeCultureGaugeBonuses(culture);
        if (shared && Number.isFinite(shared.quality) && Number.isFinite(shared.brandImage)) {
          return {
            quality: Math.max(0, Math.min(0.2, shared.quality)),
            brandImage: Math.max(0, Math.min(0.25, shared.brandImage))
          };
        }
      } catch {
        // Le moteur de jeu conserve la formule canonique en filet local.
      }
    }
    const cultureRoot = Math.sqrt(culture);
    return {
      quality: Math.min(0.2, 0.025 * cultureRoot),
      brandImage: Math.min(0.25, 0.03 * cultureRoot)
    };
  }

  function getPrestigeCareerPreview() {
    const assessment = Progression && careerState && typeof Progression.assessPrestige === "function"
      ? Progression.assessPrestige(careerState, buildCareerContext())
      : null;
    const activePlan = careerState && careerState.activePlan;
    const plan = activePlan && Progression && typeof Progression.getPlanDefinition === "function"
      ? Progression.getPlanDefinition(activePlan.id)
      : null;
    const planCulture = assessment && assessment.willValidatePlan && activePlan
      ? activePlan.rank
      : 0;
    const activeCampaign = careerState && careerState.campaigns && careerState.campaigns.active;
    const campaign = activeCampaign && Progression && typeof Progression.getCampaignDefinition === "function"
      ? Progression.getCampaignDefinition(activeCampaign.id)
      : null;
    const campaignStatus = activeCampaign && Progression && typeof Progression.getCampaignStatus === "function"
      ? Progression.getCampaignStatus(careerState, buildCareerContext())
      : null;
    const activeChallenge = careerState && careerState.challenges && careerState.challenges.active;
    const challenge = activeChallenge ? getChallengeDefinition(activeChallenge.id) : null;
    const challengeStatus = activeChallenge && Progression && typeof Progression.getChallengeStatus === "function"
      ? Progression.getChallengeStatus(careerState, buildCareerContext())
      : null;
    return {
      assessment,
      activePlan,
      plan,
      planCulture,
      activeCampaign,
      campaign,
      campaignStatus,
      activeChallenge,
      challenge,
      challengeStatus,
      baseCulture: computePotentialCultureGain(),
      totalCulture: computePotentialCultureGain() + planCulture
    };
  }

  function prestigeCampaignRestartCopy(preview, completed = false) {
    if (!preview || !preview.activeCampaign) return "";
    const status = preview.campaignStatus;
    return t(completed
      ? "career.prestige.campaignRestarted"
      : "career.prestige.campaignWillRestart", {
      campaign: preview.campaign ? t(preview.campaign.nameKey) : preview.activeCampaign.id,
      current: status ? status.stepNumber : 1,
      total: status ? status.stepCount : 3
    });
  }

  function prestigeChallengeFailureCopy(preview, completed = false) {
    if (!preview || !preview.activeChallenge) return "";
    const progress = preview.challengeStatus && preview.challengeStatus.objective;
    return t(completed
      ? "career.prestige.challengeFailed"
      : "career.prestige.challengeWillFail", {
      challenge: preview.challenge ? t(preview.challenge.nameKey) : preview.activeChallenge.id,
      current: progress ? formatNumber(progress.current) : "0",
      target: progress ? formatNumber(progress.target) : "1"
    });
  }

  function handlePrestigeClick() {
    if (!canPrestige()) return;
    const preview = getPrestigeCareerPreview();
    if (preview.totalCulture <= 0) return;
    let confirmation = t("prestige.confirm", { gain: preview.totalCulture });
    if (preview.assessment && preview.assessment.willRestartPlan) {
      confirmation += "\n\n" + t("career.prestige.planNotValidated");
    } else if (preview.assessment && preview.assessment.willValidatePlan && preview.activePlan) {
      confirmation += "\n\n" + t("career.prestige.planValidated", {
        plan: preview.plan ? t(preview.plan.nameKey) : preview.activePlan.id,
        rank: preview.activePlan.rank,
        culture: preview.planCulture
      });
    }
    const campaignWarning = prestigeCampaignRestartCopy(preview);
    if (campaignWarning) confirmation += "\n\n" + campaignWarning;
    const challengeWarning = prestigeChallengeFailureCopy(preview);
    if (challengeWarning) confirmation += "\n\n" + challengeWarning;
    if (confirm(confirmation)) doPrestige();
  }

  /** Executes the prestige reset flow and reinitialises the run. */
  function doPrestige() {
    if (!canPrestige()) return;
    const baseGain = computePotentialCultureGain();
    if (baseGain <= 0) return;
    const multiplierBefore = prestigeMultiplier();
    const cultureBefore = gameState.resources.culturePoints;
    const prestigePreview = getPrestigeCareerPreview();
    const careerResult = Progression && careerState && typeof Progression.handlePrestige === "function"
      ? Progression.handlePrestige(careerState, buildCareerContext(), { now: Date.now() })
      : null;
    if (careerResult && careerResult.progress) {
      handleCareerProgressResult(careerResult.progress, { notify: false, save: false });
    }
    const planCulture = careerResult && careerResult.planCompleted && careerResult.planCompleted.reward
      ? applyCareerCultureReward(careerResult.planCompleted.reward.culture)
      : 0;
    gameState.resources.culturePoints += baseGain;
    analyticsState.currentRun.prestigeCulture += baseGain;
    const runCultureEarned =
      analyticsState.currentRun.prestigeCulture +
      analyticsState.currentRun.careerCulture +
      analyticsState.currentRun.achievementCulture;

    notifyScene("prestige");
    const completedAt = Date.now();
    const completedRunSummary = {
      ...analyticsState.currentRun,
      endedAt: completedAt,
      docTotal: gameState.resources.docTotal,
      ccTotal: gameState.resources.ccTotal,
      cultureEarned: runCultureEarned
    };
    analyticsState.runSummaries.push(completedRunSummary);
    analyticsState.runSummaries = analyticsState.runSummaries.slice(-20);
    analyticsState.lifetimeObserved.prestiges += 1;
    analyticsState.currentRun = createAnalyticsState(false).currentRun;
    analyticsState.currentRun.startedAt = completedAt;
    gameState.resources.docBank = 0;
    gameState.resources.docTotal = 0;
    gameState.resources.ccTotal = 0;

    for (const b of gameState.buildings) {
      b.quantity = 0;
      // Keep the first tier visible after a reset (same rule as initGame).
      b.isUnlocked = b === gameState.buildings[0];
    }

    for (const upg of gameState.upgrades) {
      upg.purchased = false;
      upg.unlocked = false;
    }
    refreshUpgradeUnlocks(true);

    gameState.stats.quality = 0.5;
    gameState.stats.footprint = 0.5;
    gameState.stats.brandImage = 0.5;
    if (window.EndgameModule && typeof window.EndgameModule.resetForPrestige === "function") {
      window.EndgameModule.resetForPrestige(gameState);
    }
    syncCampaignContractPriority();

    uiState.buildingsDirty = true;
    uiState.upgradesDirty = true;
    careerUiState.renderSignature = "";
    contractsState.listRenderSignature = "";
    let prestigeCareerDetail = "";
    if (careerResult && careerResult.planCompleted) {
      const plan = Progression.getPlanDefinition(careerResult.planCompleted.id);
      const params = {
        plan: plan ? t(plan.nameKey) : careerResult.planCompleted.id,
        rank: careerResult.planCompleted.rank,
        culture: planCulture
      };
      logMessage("log.planValidated", params);
      prestigeCareerDetail = t("career.prestige.planValidated", params);
    } else if (careerResult && careerResult.earlyPlanRestart && careerState.activePlan) {
      const plan = Progression.getPlanDefinition(careerState.activePlan.id);
      const params = { plan: plan ? t(plan.nameKey) : careerState.activePlan.id };
      logMessage("log.planRestarted", params);
      prestigeCareerDetail = t("career.prestige.planLost", params);
    }
    if (careerResult && careerResult.challengeFailed) {
      handleChallengeFailure(careerResult.challengeFailed, false);
      const challengeDetail = prestigeChallengeFailureCopy(prestigePreview, true);
      prestigeCareerDetail = [prestigeCareerDetail, challengeDetail].filter(Boolean).join(" ");
    }
    if (careerResult && careerResult.campaignRestarted) {
      const campaign = getCampaignDefinition(careerResult.campaignRestarted);
      const params = {
        campaign: campaign ? t(campaign.nameKey) : careerResult.campaignRestarted
      };
      logMessage("log.campaignRestarted", params);
      const campaignDetail = prestigeCampaignRestartCopy(prestigePreview, true);
      prestigeCareerDetail = [prestigeCareerDetail, campaignDetail].filter(Boolean).join(" ");
    }
    if (careerResult && careerResult.conclusionUnlocked &&
        !(careerResult.progress && careerResult.progress.conclusionUnlocked)) {
      logMessage("log.conclusionUnlocked");
    }
    const prestigeUnlockedDefinitions = [];
    const prestigeGrantedRewards = [];
    checkAchievements({
      notify: false,
      save: false,
      unlockedDefinitions: prestigeUnlockedDefinitions,
      grantedRewards: prestigeGrantedRewards
    });
    const prestigeAchievementCulture = analyticsState.currentRun.achievementCulture;
    if (prestigeAchievementCulture > 0) {
      completedRunSummary.achievementCulture =
        (completedRunSummary.achievementCulture || 0) + prestigeAchievementCulture;
      completedRunSummary.cultureEarned += prestigeAchievementCulture;
      analyticsState.currentRun.achievementCulture = 0;
    }
    if (prestigeUnlockedDefinitions.length) {
      const achievementDetails = prestigeUnlockedDefinitions.map(definition => {
        const granted = prestigeGrantedRewards.find(item => item.definition.id === definition.id);
        return granted
          ? t("feedback.achievementReward", { name: t(definition.nameKey), reward: granted.reward })
          : t("log.achievement", { name: t(definition.nameKey) });
      });
      prestigeCareerDetail = [prestigeCareerDetail, ...achievementDetails].filter(Boolean).join(" ");
    }
    const prestigeDelta = Math.max(0, gameState.resources.culturePoints - cultureBefore);
    const multiplierAfter = prestigeMultiplier();
    const receiptParams = {
      gain: prestigeDelta,
      before: multiplierBefore.toFixed(2),
      after: multiplierAfter.toFixed(2)
    };
    uiState.completionReceipt = {
      kind: "prestige-receipt",
      name: t("objective.prestigeComplete"),
      detailKey: "feedback.prestigeReceipt",
      detailParams: receiptParams,
      detailText: prestigeCareerDetail,
      expiresAt: Date.now() + 2800
    };
    setLastAction("objective.prestigeComplete", {}, "feedback.prestigeReceipt", receiptParams);
    logMessage("log.prestige", { amount: prestigeDelta });
    UIEffects.playCelebrationEffect("prestige");
    showEventBanner("feedback.prestigeReceipt", "positive", receiptParams);
    queueSave(true);
    renderAll(true);
    setTimeout(() => {
      if (uiState.completionReceipt && uiState.completionReceipt.expiresAt <= Date.now()) {
        uiState.completionReceipt = null;
        renderWorkOrder();
      }
    }, 2850);
  }

  function setTextIfChanged(element, value) {
    if (!element) return;
    const next = String(value);
    if (element.textContent !== next) element.textContent = next;
  }

  function setWidthIfChanged(element, value) {
    if (!element || element.style.width === value) return;
    element.style.width = value;
  }

  function describeLastAction() {
    const action = uiState.lastAction;
    if (!action) return "";
    const primary = t(action.key, action.params || {});
    const detail = action.detailKey
      ? t(action.detailKey, action.detailParams || {})
      : action.detailText || "";
    return t("objective.lastAction", {
      action: detail ? primary + " · " + detail : primary
    });
  }

  function internalObjectiveName(objective) {
    if (Progression && careerState && careerState.activePlan) {
      const status = Progression.getPlanStatus(careerState, buildCareerContext());
      if (status && status.objective) return t(status.objective.labelKey);
      const plan = Progression.getPlanDefinition(careerState.activePlan.id);
      if (plan) return t(plan.nameKey);
    }
    if (objective && objective.building) return getBuildingName(objective.building);
    return t("objective.prestigeName");
  }

  function setHiddenState(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    element.classList.toggle("hidden", hidden);
  }

  function careerProgressValues(progress) {
    if (!progress) return { current: 0, target: 1 };
    const percentMetric = progress.type === "statAtLeast" || progress.type === "statAtMost";
    return {
      current: percentMetric ? Math.round(progress.current * 100) + " %" : formatNumber(progress.current),
      target: percentMetric ? Math.round(progress.target * 100) + " %" : formatNumber(progress.target)
    };
  }

  function formatCareerCriterion(progress) {
    const values = careerProgressValues(progress);
    return t(progress && progress.direction === "atMost"
      ? "career.dossier.criterionAtMost"
      : "career.dossier.criterion", values);
  }

  function appendDossierCriterion(container, options) {
    if (!container || !options) return;
    const item = document.createElement("li");
    item.className = options.className || "work-order-criterion";
    if (options.complete) item.classList.add("is-met");
    else if (options.failed) item.classList.add("is-failed");
    else item.classList.add("is-current");
    if (options.optional) item.classList.add("is-optional");
    const mark = document.createElement("span");
    mark.className = "work-order-criterion-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = options.complete ? "✓" : options.failed ? "×" : "•";
    const text = document.createElement("span");
    text.textContent = options.text;
    item.appendChild(mark);
    item.appendChild(text);
    container.appendChild(item);
  }

  function renderWorkOrderDossierExtras() {
    const hasCareerPlan = Boolean(Progression && careerState && careerState.activePlan);
    const context = hasCareerPlan ? buildCareerContext() : null;
    const plan = hasCareerPlan ? Progression.getPlanDefinition(careerState.activePlan.id) : null;
    const rankDefinition = hasCareerPlan
      ? Progression.getRankDefinition(careerState.activePlan.id, careerState.activePlan.rank)
      : null;
    const status = hasCareerPlan ? Progression.getPlanStatus(careerState, context) : null;

    setHiddenState(DOM.workOrderContext, !hasCareerPlan);
    setHiddenState(DOM.workOrderSteps, !hasCareerPlan);
    if (hasCareerPlan && plan && status) {
      setTextIfChanged(DOM.workOrderPlan, t("career.dossier.planContext", {
        plan: t(plan.nameKey),
        rank: careerState.activePlan.rank
      }));
      setTextIfChanged(DOM.workOrderStep, t("career.dossier.step", {
        current: status.complete ? status.stepCount : status.stepNumber,
        total: status.stepCount
      }));
      DOM.workOrderSteps.innerHTML = "";
      for (const [index, objective] of rankDefinition.objectives.entries()) {
        const item = document.createElement("li");
        item.className = "work-order-step";
        if (index < status.stepIndex || status.complete) item.classList.add("is-complete");
        else if (index === status.stepIndex) item.classList.add("is-current");
        const mark = document.createElement("span");
        mark.className = "work-order-step-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = index < status.stepIndex || status.complete ? "✓" : String(index + 1);
        const label = document.createElement("span");
        label.textContent = t(objective.labelKey);
        if (index === status.stepIndex && status.objective) {
          label.textContent += " · " + formatCareerCriterion(status.objective);
        }
        item.appendChild(mark);
        item.appendChild(label);
        DOM.workOrderSteps.appendChild(item);
      }
    }

    if (DOM.workOrderCriteria) DOM.workOrderCriteria.innerHTML = "";
    let criterionCount = 0;
    if (Progression && careerState && careerState.challenges && careerState.challenges.active) {
      const definition = getChallengeDefinition(careerState.challenges.active.id);
      const challengeStatus = Progression.getChallengeStatus(careerState, context || buildCareerContext());
      const progress = challengeStatus && challengeStatus.objective;
      appendDossierCriterion(DOM.workOrderCriteria, {
        optional: true,
        complete: Boolean(challengeStatus && challengeStatus.complete),
        text: t("career.challenge.label") + " · " + (definition ? t(definition.nameKey) : "") +
          (progress ? " · " + formatCareerCriterion(progress) : "")
      });
      criterionCount += 1;
    }
    if (Progression && careerState && careerState.campaigns && careerState.campaigns.active) {
      const definition = getCampaignDefinition(careerState.campaigns.active.id);
      const campaignStatus = Progression.getCampaignStatus(careerState, context || buildCareerContext());
      const progress = campaignStatus && campaignStatus.objective;
      appendDossierCriterion(DOM.workOrderCriteria, {
        complete: Boolean(campaignStatus && campaignStatus.complete),
        text: t("career.campaign.label") + " · " + (definition ? t(definition.nameKey) : "") +
          (progress ? " · " + formatCareerCriterion(progress) : "")
      });
      criterionCount += 1;
    }
    const activeContract = window.EndgameModule && window.EndgameModule.activeContract;
    if (activeContract && activeContract.current && typeof window.EndgameModule.getClauseProgress === "function") {
      const clause = window.EndgameModule.getClauseProgress(activeContract.current, gameState);
      if (clause) {
        const values = careerProgressValues({
          type: clause.id === "footprint" ? "statAtMost" : "statAtLeast",
          direction: clause.comparison === "maximum" ? "atMost" : "atLeast",
          current: clause.current,
          target: clause.target
        });
        appendDossierCriterion(DOM.workOrderCriteria, {
          className: "contract-clause",
          optional: true,
          complete: clause.met,
          failed: clause.failed,
          text: t(clause.nameKey) + " · " + t(clause.descKey, { target: values.target.replace(" %", "") }) +
            " · " + t("contracts.clause.deliveryGuaranteed")
        });
        criterionCount += 1;
      }
    }
    setHiddenState(DOM.workOrderCriteria, criterionCount === 0);

    const dossierRewards = [];
    if (hasCareerPlan && plan) {
      dossierRewards.push(t("career.dossier.planReward", {
        plan: t(plan.nameKey),
        rank: careerState.activePlan.rank,
        culture: careerState.activePlan.rank
      }));
    }
    if (careerState && careerState.challenges && careerState.challenges.active) {
      const challenge = getChallengeDefinition(careerState.challenges.active.id);
      if (challenge && challenge.reward) {
        dossierRewards.push(t("career.dossier.challengeReward", {
          culture: challenge.reward.culture || 0
        }));
      }
    }
    if (careerState && careerState.campaigns && careerState.campaigns.active) {
      const campaign = getCampaignDefinition(careerState.campaigns.active.id);
      if (campaign) {
        dossierRewards.push(t("career.dossier.campaignReward", {
          badge: t("career.badge." + campaign.badgeId)
        }));
      }
    }
    setHiddenState(DOM.workOrderReward, dossierRewards.length === 0);
    setTextIfChanged(DOM.workOrderReward, dossierRewards.join(" · "));
    renderPendingEventControl();
    setHiddenState(DOM.workOrderOutcome, dossierRewards.length === 0 && !eventState.active);
  }

  function renderWorkOrderState({ kind, type, status, name, instruction, meta, progressMax, progressValue, next }) {
    if (!DOM.currentObjective) return;
    DOM.currentObjective.dataset.kind = kind;
    DOM.currentObjective.classList.toggle("is-client", kind === "client" || kind === "delivery");
    DOM.currentObjective.classList.toggle("is-complete", kind === "delivery" || kind === "prestige-receipt");
    setTextIfChanged(DOM.workOrderType, type);
    setTextIfChanged(DOM.workOrderStatus, status);
    setTextIfChanged(DOM.workOrderName, name);
    setTextIfChanged(DOM.workOrderInstruction, instruction);
    setTextIfChanged(DOM.workOrderMeta, meta);
    if (DOM.workOrderProgress) {
      const max = Math.max(1, Number(progressMax) || 1);
      const value = Math.max(0, Math.min(max, Number(progressValue) || 0));
      if (DOM.workOrderProgress.max !== max) DOM.workOrderProgress.max = max;
      if (DOM.workOrderProgress.value !== value) DOM.workOrderProgress.value = value;
      setTextIfChanged(DOM.workOrderProgress, formatProgressPercent(value / max));
    }
    const lastAction = kind === "delivery" || kind === "prestige-receipt" ? "" : describeLastAction();
    if (DOM.workOrderLastAction) {
      DOM.workOrderLastAction.setAttribute("aria-hidden", lastAction ? "false" : "true");
      setTextIfChanged(DOM.workOrderLastAction, lastAction);
    }
    setTextIfChanged(DOM.workOrderNext, t("objective.next", { next }));
    renderWorkOrderDossierExtras();
  }

  /** Renders one persistent job, with client work taking priority. */
  function renderWorkOrder() {
    if (!DOM.currentObjective) return;
    const receipt = uiState.completionReceipt;
    if (receipt && receipt.expiresAt <= Date.now()) {
      uiState.completionReceipt = null;
    }
    if (uiState.completionReceipt) {
      const completed = uiState.completionReceipt;
      const nextObjective = getInternalObjective();
      renderWorkOrderState({
        kind: completed.kind,
        type: t(completed.kind === "delivery" ? "objective.client" : "objective.internal"),
        status: t(completed.kind === "delivery" ? "objective.status.delivered" : "objective.status.validated"),
        name: completed.name,
        instruction: t(completed.detailKey, completed.detailParams) +
          (completed.detailText ? " · " + completed.detailText : ""),
        meta: formatProgressPercent(1),
        progressMax: 100,
        progressValue: 100,
        next: internalObjectiveName(nextObjective)
      });
      return;
    }

    const activeContract = window.EndgameModule && window.EndgameModule.activeContract
      ? window.EndgameModule.activeContract
      : null;
    if (activeContract && activeContract.current) {
      const duration = Math.max(1, activeContract.duration || activeContract.current.duration || 1);
      const remaining = Math.max(0, activeContract.timer || 0);
      const elapsed = Math.max(0, Math.min(duration, duration - remaining));
      const terms = activeContract.terms || {};
      const baseReward = {
        doc: Math.round((activeContract.current.reward.doc || 0) * (terms.docRewardMultiplier || 1)),
        cc: Math.round((activeContract.current.reward.cc || 0) * (terms.ccRewardMultiplier || 1))
      };
      renderWorkOrderState({
        kind: "client",
        type: t("objective.client"),
        status: t("contracts.runningBadge"),
        name: t(activeContract.current.nameKey),
        instruction: t(activeContract.current.descKey),
        meta: t("contracts.remaining", { seconds: Math.ceil(remaining) }),
        progressMax: duration,
        progressValue: elapsed,
        next: t("contracts.reward", {
          doc: formatNumber(baseReward.doc),
          cc: formatNumber(baseReward.cc)
        })
      });
      return;
    }

    if (Progression && careerState && careerState.activePlan) {
      const context = buildCareerContext();
      const plan = Progression.getPlanDefinition(careerState.activePlan.id);
      const rankDefinition = Progression.getRankDefinition(careerState.activePlan.id, careerState.activePlan.rank);
      const status = Progression.getPlanStatus(careerState, context);
      const progress = status && status.objective;
      const nextDefinition = status && !status.complete
        ? rankDefinition.objectives[status.stepIndex + 1] || null
        : null;
      renderWorkOrderState({
        kind: "career",
        type: t("career.kicker"),
        status: t(status && status.complete ? "career.status.ready" : "career.status.active"),
        name: progress ? t(progress.labelKey) : t(plan.nameKey),
        instruction: status && status.complete ? t("career.dossier.ready") : t(plan.descriptionKey),
        meta: progress ? formatCareerCriterion(progress) : formatProgressPercent(1),
        progressMax: 1,
        progressValue: progress ? progress.ratio : 1,
        next: status && status.complete
          ? t("career.dossier.ready")
          : nextDefinition ? t(nextDefinition.labelKey) : t("objective.nextPrestige")
      });
      return;
    }

    if (Progression && careerState && careerState.campaigns && careerState.campaigns.active) {
      const campaign = getCampaignDefinition(careerState.campaigns.active.id);
      const status = Progression.getCampaignStatus(careerState, buildCareerContext());
      const progress = status && status.objective;
      const nextDefinition = campaign && status && !status.complete
        ? campaign.objectives[status.stepIndex + 1] || null
        : null;
      renderWorkOrderState({
        kind: "campaign",
        type: t("career.campaign.label"),
        status: t(status && status.complete ? "career.status.ready" : "career.status.active"),
        name: progress ? t(progress.labelKey) : campaign ? t(campaign.nameKey) : careerState.campaigns.active.id,
        instruction: campaign ? t(campaign.descriptionKey) : "",
        meta: progress ? formatCareerCriterion(progress) : formatProgressPercent(1),
        progressMax: 1,
        progressValue: progress ? progress.ratio : 1,
        next: status && status.complete
          ? t("career.campaign.status.completed")
          : nextDefinition ? t(nextDefinition.labelKey) : t("career.campaign.status.active")
      });
      return;
    }

    const objective = getInternalObjective();
    if (objective.kind === "prestige") {
      const current = gameState.resources.ccTotal;
      const target = objective.target;
      renderWorkOrderState({
        kind: "internal",
        type: t("objective.internal"),
        status: t(canPrestige() ? "objective.status.available" : "objective.status.inProgress"),
        name: t("objective.prestigeName"),
        instruction: t("objective.prestigeInstruction", { amount: formatNumber(target) }),
        meta: t("objective.progressTrust", { current: formatNumber(current), target: formatNumber(target) }),
        progressMax: target,
        progressValue: current,
        next: t(canPrestige() ? "objective.nextPrestige" : "objective.missingTrust", {
          amount: formatNumber(Math.max(0, target - current))
        })
      });
      return;
    }

    const current = gameState.resources.docBank;
    const missing = Math.max(0, objective.target - current);
    const rate = computeDocPerSecond();
    let next = t(objective.kind === "install" && missing <= 0 ? "objective.nextInstall" : "feedback.missingDocs", {
      name: getBuildingName(objective.building),
      amount: formatNumber(missing)
    });
    if (missing > 0 && rate > 0) {
      next += " · " + t("feedback.affordEta", { seconds: Math.max(1, Math.ceil(missing / rate)) });
    }
    renderWorkOrderState({
      kind: "internal",
      type: t("objective.internal"),
      status: t(missing <= 0 ? "objective.status.available" : "objective.status.inProgress"),
      name: getBuildingName(objective.building),
      instruction: t(objective.kind === "install" ? "objective.installInstruction" : "objective.unlockInstruction", {
        amount: formatNumber(objective.target)
      }),
      meta: t("objective.progressDocs", {
        current: formatNumber(current),
        target: formatNumber(objective.target)
      }),
      progressMax: objective.target,
      progressValue: current,
      next
    });
  }

  function formatCareerPercent(value) {
    const locale = LOCALE_BY_LANG[currentLang] || LOCALE_BY_LANG.fr;
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(value) * 100);
  }

  function careerPlanCopy(plan, rankDefinition) {
    const modifiers = rankDefinition && rankDefinition.modifiers ? rankDefinition.modifiers : {};
    if (plan.id === "cadence") {
      return {
        benefit: t("career.plan.cadence.benefit", {
          bonus: formatCareerPercent((modifiers.docMultiplier || 1) - 1)
        }),
        tradeoff: t("career.plan.cadence.tradeoff", {
          multiplier: Number(modifiers.footprintDriftMultiplier || 1).toFixed(2)
        })
      };
    }
    if (plan.id === "quality") {
      return {
        benefit: t("career.plan.quality.benefit", {
          bonus: formatCareerPercent(modifiers.qualityTargetOffset || 0)
        }),
        tradeoff: t("career.plan.quality.tradeoff", {
          penalty: formatCareerPercent(1 - (modifiers.docMultiplier || 1))
        })
      };
    }
    return {
      benefit: t("career.plan.clientRelations.benefit", {
        bonus: formatCareerPercent(Math.max(
          (modifiers.ccMultiplier || 1) - 1,
          (modifiers.contractRewardMultiplier || 1) - 1
        ))
      }),
      tradeoff: t("career.plan.clientRelations.tradeoff", {
        penalty: formatCareerPercent((modifiers.buildingCostMultiplier || 1) - 1)
      })
    };
  }

  function appendCareerLine(parent, className, text) {
    if (!parent || !text) return null;
    const line = document.createElement("span");
    line.className = className;
    line.textContent = text;
    parent.appendChild(line);
    return line;
  }

  function createCareerInfoCard(title, description, status, extraClass = "") {
    const card = document.createElement("div");
    card.className = "career-plan-choice" + (extraClass ? " " + extraClass : "");
    appendCareerLine(card, "career-plan-choice-name", title);
    if (description) appendCareerLine(card, "career-plan-choice-benefit", description);
    if (status) appendCareerLine(card, "career-plan-choice-tradeoff", status);
    return card;
  }

  function appendCareerAction(card, label, dataName, dataValue) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-slim";
    button.dataset[dataName] = dataValue;
    button.textContent = label;
    card.appendChild(button);
    return button;
  }

  function careerStatusSignature(status) {
    if (!status) return null;
    const progress = status.objective;
    return {
      stepIndex: status.stepIndex,
      complete: status.complete,
      objective: progress ? {
        id: progress.id,
        current: formatNumber(progress.current),
        target: formatNumber(progress.target),
        complete: progress.complete
      } : null
    };
  }

  function renderCareerPanel(force = false) {
    if (!DOM.careerPlanContainer) return;
    if (!Progression || !careerState || typeof Progression.getSummary !== "function") {
      setHiddenState(DOM.careerPlanContainer, true);
      return;
    }
    const context = buildCareerContext();
    const summary = Progression.getSummary(careerState, context);
    const signature = currentLang + "|" + JSON.stringify({
      completedRanks: summary.completedRanks,
      activePlan: summary.activePlan && {
        id: summary.activePlan.id,
        rank: summary.activePlan.rank,
        status: careerStatusSignature(summary.activePlan.status)
      },
      availablePlans: summary.availablePlans,
      activeChallenge: summary.activeChallenge && {
        id: summary.activeChallenge.id,
        status: careerStatusSignature(summary.activeChallenge.status)
      },
      availableChallengeIds: summary.availableChallengeIds,
      completedChallengeIds: summary.completedChallengeIds,
      activeCampaign: summary.activeCampaign && {
        id: summary.activeCampaign.id,
        status: careerStatusSignature(summary.activeCampaign.status)
      },
      availableCampaignIds: summary.availableCampaignIds,
      campaignBadgeIds: summary.campaignBadgeIds,
      conclusion: summary.conclusion
    });
    setHiddenState(DOM.careerPlanContainer, false);
    if (!force && careerUiState.renderSignature === signature) return;
    careerUiState.renderSignature = signature;

    setTextIfChanged(DOM.careerPlanKicker, t("career.kicker"));
    setTextIfChanged(DOM.careerPlanProgress, t("career.stamps", { count: summary.stampCount }));
    const activePlan = summary.activePlan;
    const activePlanDefinition = activePlan ? Progression.getPlanDefinition(activePlan.id) : null;
    if (activePlan && activePlanDefinition) {
      setTextIfChanged(DOM.careerPlanTitle, t(activePlanDefinition.nameKey));
      setTextIfChanged(DOM.careerPlanIntro, t(activePlanDefinition.descriptionKey));
      const rankDefinition = Progression.getRankDefinition(activePlan.id, activePlan.rank);
      const copy = careerPlanCopy(activePlanDefinition, rankDefinition);
      setTextIfChanged(DOM.careerPlanEffect,
        t("career.benefit") + " : " + copy.benefit + " · " +
        t("career.tradeoff") + " : " + copy.tradeoff + " · " +
        t("career.permanent") + " : " + t("career.plan." + activePlan.id + ".permanent"));
    } else {
      const conclusionUnlocked = Boolean(summary.conclusion && summary.conclusion.unlocked);
      setTextIfChanged(DOM.careerPlanTitle,
        summary.availablePlans.length
          ? t("career.choose.title")
          : conclusionUnlocked
            ? t("career.conclusion.title")
            : t("career.conclusion.pendingTitle"));
      setTextIfChanged(DOM.careerPlanIntro,
        summary.availablePlans.length
          ? t("career.choose.intro")
          : conclusionUnlocked
            ? t("career.conclusion.description")
            : t("career.conclusion.pendingDescription"));
      setTextIfChanged(DOM.careerPlanEffect, "");
    }

    DOM.careerPlanChoices.innerHTML = "";
    if (!activePlan) {
      for (const available of Progression.getAvailablePlans(careerState)) {
        const plan = available.plan;
        const copy = careerPlanCopy(plan, available.rankDefinition);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "career-plan-choice";
        button.dataset.careerSelectPlan = plan.id;
        button.setAttribute("aria-label", t("career.choose.action", { plan: t(plan.nameKey) }));
        appendCareerLine(button, "career-plan-choice-name",
          t(plan.nameKey) + " · " + t("career.rank", { rank: available.rank }));
        appendCareerLine(button, "career-plan-choice-benefit", copy.benefit);
        appendCareerLine(button, "career-plan-choice-tradeoff", copy.tradeoff);
        appendCareerLine(button, "career-plan-choice-benefit", t("career.plan." + plan.id + ".permanent"));
        appendCareerLine(button, "career-plan-choice-benefit", t("career.plan.cultureReward", {
          culture: available.rank
        }));
        DOM.careerPlanChoices.appendChild(button);
      }
    }

    if (summary.activeChallenge) {
      const definition = getChallengeDefinition(summary.activeChallenge.id);
      const status = summary.activeChallenge.status;
      const progress = status && status.objective;
      const card = createCareerInfoCard(
        t("career.challenge.label") + " · " + (definition ? t(definition.nameKey) : summary.activeChallenge.id),
        definition ? t(definition.descriptionKey) : "",
        t("career.challenge.status.active") + (progress ? " · " + formatCareerCriterion(progress) : ""),
        "is-selected"
      );
      if (definition) {
        appendCareerLine(card, "career-plan-choice-benefit", t("career.challenge.reward", {
          culture: definition.reward.culture
        }));
      }
      DOM.careerPlanChoices.appendChild(card);
    } else {
      for (const challengeId of summary.availableChallengeIds) {
        const definition = getChallengeDefinition(challengeId);
        if (!definition) continue;
        const card = createCareerInfoCard(
          t("career.challenge.label") + " · " + t(definition.nameKey),
          t(definition.descriptionKey),
          t("career.challenge.reward", { culture: definition.reward.culture })
        );
        appendCareerAction(card, t("career.challenge.accept"), "careerAcceptChallenge", challengeId);
        appendCareerAction(card, t("career.challenge.decline"), "careerDeclineChallenge", challengeId);
        DOM.careerPlanChoices.appendChild(card);
      }
    }

    for (const campaignId of summary.availableCampaignIds) {
      const definition = getCampaignDefinition(campaignId);
      if (!definition) continue;
      const card = createCareerInfoCard(
        t("career.campaign.label") + " · " + t(definition.nameKey),
        t(definition.descriptionKey),
        t("career.campaign.status.available")
      );
      appendCareerAction(card, t("career.campaign.start"), "careerStartCampaign", campaignId);
      DOM.careerPlanChoices.appendChild(card);
    }
    const visibleCampaignIds = new Set([
      ...summary.availableCampaignIds,
      ...summary.campaignBadgeIds.map(badgeId => {
        const definition = Progression.CAMPAIGN_DEFINITIONS.find(item => item.badgeId === badgeId);
        return definition ? definition.id : "";
      }),
      summary.activeCampaign ? summary.activeCampaign.id : ""
    ]);
    for (const definition of Progression.CAMPAIGN_DEFINITIONS) {
      if (visibleCampaignIds.has(definition.id)) continue;
      DOM.careerPlanChoices.appendChild(createCareerInfoCard(
        t("career.campaign.label") + " · " + t(definition.nameKey),
        t(definition.descriptionKey),
        summary.activeCampaign && summary.stampCount >= definition.unlockStamps
          ? t("career.campaign.status.blocked")
          : t("career.campaign.unlock", { stamps: definition.unlockStamps })
      ));
    }
    if (summary.activeCampaign) {
      const definition = getCampaignDefinition(summary.activeCampaign.id);
      const status = summary.activeCampaign.status;
      const progress = status && status.objective;
      DOM.careerPlanChoices.appendChild(createCareerInfoCard(
        t("career.campaign.label") + " · " + (definition ? t(definition.nameKey) : summary.activeCampaign.id),
        definition ? t(definition.descriptionKey) : "",
        t("career.campaign.status.active") + (progress ? " · " + formatCareerCriterion(progress) : ""),
        "is-selected"
      ));
    }
    for (const badgeId of summary.campaignBadgeIds) {
      DOM.careerPlanChoices.appendChild(createCareerInfoCard(
        t("career.campaign.status.completed"),
        t("career.badge." + badgeId),
        t("career.status.completed"),
        "is-selected"
      ));
    }
    if (summary.conclusion && summary.conclusion.unlocked) {
      const card = createCareerInfoCard(
        t(summary.conclusion.titleKey),
        t(summary.conclusion.descriptionKey),
        t("career.status.completed"),
        "is-selected"
      );
      if (!summary.conclusion.acknowledgedAt) {
        appendCareerAction(card, t("career.conclusion.acknowledge"), "careerAcknowledge", summary.conclusion.id);
      }
      DOM.careerPlanChoices.appendChild(card);
    }

    DOM.careerPlanStamps.innerHTML = "";
    const earnedStamps = new Set(summary.stampIds);
    for (const planId of Progression.PLAN_IDS) {
      const plan = Progression.getPlanDefinition(planId);
      for (let rank = 1; rank <= Progression.MAX_RANK; rank += 1) {
        const stamp = document.createElement("li");
        stamp.className = "career-plan-stamp";
        if (earnedStamps.has("stamp:" + planId + ":" + rank)) stamp.classList.add("is-earned");
        stamp.textContent = (plan ? t(plan.nameKey) : planId) + " · " + t("career.rank", { rank });
        DOM.careerPlanStamps.appendChild(stamp);
      }
    }
    setHiddenState(DOM.careerPlanStamps, false);
  }

  function finishCareerAction() {
    careerUiState.renderSignature = "";
    contractsState.listRenderSignature = "";
    queueSave(true);
    renderAll();
    requestAnimationFrame(() => {
      if (DOM.currentObjective) DOM.currentObjective.focus({ preventScroll: true });
    });
  }

  function handleCareerAction(event) {
    if (!Progression || !careerState) return;
    const planButton = event.target.closest("[data-career-select-plan]");
    if (planButton) {
      const result = Progression.selectPlan(careerState, planButton.dataset.careerSelectPlan, { now: Date.now() });
      if (!result || !result.ok) return;
      const params = { plan: t(result.plan.nameKey), rank: result.rank };
      logMessage("log.planSelected", params);
      setLastAction("feedback.planSelected", params);
      showEventBanner("feedback.planSelected", "positive", params);
      updateCareerProgress({ save: false });
      finishCareerAction();
      return;
    }

    const acceptButton = event.target.closest("[data-career-accept-challenge]");
    if (acceptButton) {
      const result = Progression.acceptChallenge(careerState, acceptButton.dataset.careerAcceptChallenge, { now: Date.now() });
      if (!result || !result.ok) return;
      const name = t(result.challenge.nameKey);
      logMessage("log.challengeAccepted", { name });
      showEventBanner("feedback.challengeAccepted", "positive", { name });
      updateCareerProgress({ save: false });
      finishCareerAction();
      return;
    }

    const declineButton = event.target.closest("[data-career-decline-challenge]");
    if (declineButton) {
      const challengeId = declineButton.dataset.careerDeclineChallenge;
      const definition = getChallengeDefinition(challengeId);
      const result = Progression.declineChallenge(careerState, challengeId, { now: Date.now() });
      if (!result || !result.ok) return;
      logMessage("log.challengeDeclined", { name: definition ? t(definition.nameKey) : challengeId });
      finishCareerAction();
      return;
    }

    const campaignButton = event.target.closest("[data-career-start-campaign]");
    if (campaignButton) {
      const result = Progression.startCampaign(careerState, campaignButton.dataset.careerStartCampaign, { now: Date.now() });
      if (!result || !result.ok) return;
      const name = t(result.campaign.nameKey);
      logMessage("log.campaignStarted", { name });
      showEventBanner("feedback.campaignStarted", "positive", { name });
      syncCampaignContractPriority();
      updateCareerProgress({ save: false });
      finishCareerAction();
      return;
    }

    const acknowledgeButton = event.target.closest("[data-career-acknowledge]");
    if (acknowledgeButton && Progression.acknowledgeConclusion(careerState, { now: Date.now() })) {
      finishCareerAction();
    }
  }

  /** Updates the compact workshop readout. */
  function renderOperationsStatus() {
    const activeTypes = gameState.buildings.filter(building => building.quantity > 0).length;
    setTextIfChanged(DOM.opsBuildingCount, activeTypes);
  }

  /** Renders the live stats ribbons and gauges without rewriting unchanged DOM. */
  function renderStats() {
    const mults = computeMultipliers();
    const DOCps = computeDocPerSecond(mults);
    const formattedBank = formatNumber(gameState.resources.docBank);
    const formattedDocPs = t("stats.docPsValue", { amount: formatNumber(DOCps) });
    const formattedPrestige = prestigeMultiplier().toFixed(2);
    const manualGain = gameState.config.docPerClickBase * mults.clickMult * prestigeMultiplier();
    setTextIfChanged(DOM.docBank, formattedBank);
    setTextIfChanged(DOM.docTotal, formatNumber(gameState.resources.docTotal));
    setTextIfChanged(DOM.ccTotal, formatNumber(gameState.resources.ccTotal));
    setTextIfChanged(DOM.docPs, formattedDocPs);
    setTextIfChanged(DOM.heroDocBank, formattedBank);
    setTextIfChanged(DOM.heroDocPs, formattedDocPs);
    setTextIfChanged(DOM.heroPrestige, formattedPrestige);
    setTextIfChanged(DOM.heroCulture, gameState.resources.culturePoints);
    setTextIfChanged(DOM.opsDocBank, formattedBank);
    setTextIfChanged(DOM.opsDocPs, formattedDocPs);
    setTextIfChanged(DOM.manualGain, t("stats.manualGainValue", { amount: formatNumber(manualGain) }));
    renderStageStatus(DOCps);

    const q = clamp01(gameState.stats.quality);
    const f = clamp01(gameState.stats.footprint);
    const img = clamp01(gameState.stats.brandImage);

    setTextIfChanged(DOM.qualityLabel, Math.round(q * 100) + " %");
    setTextIfChanged(DOM.footprintLabel, Math.round(f * 100) + " %");
    setTextIfChanged(DOM.imageLabel, Math.round(img * 100) + " %");

    setWidthIfChanged(DOM.qualityFill, (q * 100).toFixed(1) + "%");
    setWidthIfChanged(DOM.footprintFill, (f * 100).toFixed(1) + "%");
    setWidthIfChanged(DOM.imageFill, (img * 100).toFixed(1) + "%");
    if (DOM.qualityGauge) DOM.qualityGauge.setAttribute("aria-valuenow", String(Math.round(q * 100)));
    if (DOM.footprintGauge) DOM.footprintGauge.setAttribute("aria-valuenow", String(Math.round(f * 100)));
    if (DOM.imageGauge) DOM.imageGauge.setAttribute("aria-valuenow", String(Math.round(img * 100)));

    setTextIfChanged(DOM.culturePoints, gameState.resources.culturePoints);
    setTextIfChanged(DOM.prestigeMult, formattedPrestige);
    renderOperationsStatus();
    renderWorkOrder();
  }

  /** Keeps the line under the campus tied to real game state. */
  function renderStageStatus(docPerSecond) {
    if (!DOM.flavorLine) return;
    if (!experienceStarted) {
      setTextIfChanged(DOM.flavorLine, t("scene.status.awaiting"));
      return;
    }
    const machineCount = gameState.buildings.reduce((sum, building) => sum + Math.max(0, building.quantity || 0), 0);
    if (machineCount === 0) {
      setTextIfChanged(DOM.flavorLine, t("scene.status.manual", {
        bank: formatNumber(gameState.resources.docBank)
      }));
      return;
    }
    setTextIfChanged(DOM.flavorLine, t("scene.status.production", {
      count: formatNumber(machineCount),
      rate: t("stats.docPsValue", { amount: formatNumber(docPerSecond) })
    }));
  }

  /** Updates the prestige card state and CTA messaging. */
  function renderPrestige() {
    if (!DOM.prestigeButton || !DOM.prestigeInfo) return;
    const can = canPrestige();
    const careerPreview = getPrestigeCareerPreview();
    const gain = careerPreview.totalCulture;
    const locale = LOCALE_BY_LANG[currentLang] || "fr-FR";
    const minValue = gameState.config.prestigeRequirement.toLocaleString(locale);

    const unavailable = !can || gain <= 0;
    DOM.prestigeButton.disabled = unavailable;
    DOM.prestigeButton.setAttribute("aria-disabled", unavailable ? "true" : "false");

    if (unavailable) {
      DOM.prestigeButton.classList.add("disabled");
      DOM.prestigeButton.textContent = t("prestige.buttonLocked");
      DOM.prestigeInfo.textContent = t("prestige.infoLocked", { min: minValue });
    } else {
      DOM.prestigeButton.classList.remove("disabled");
      DOM.prestigeButton.textContent = t("prestige.buttonAvailable", { gain });
      let information = t("prestige.infoAvailable", { gain });
      if (careerPreview.assessment && careerPreview.assessment.willRestartPlan) {
        information += " " + t("career.prestige.planNotValidated");
      } else if (careerPreview.assessment && careerPreview.assessment.willValidatePlan && careerPreview.activePlan) {
        information += " " + t("career.prestige.planValidated", {
          plan: careerPreview.plan ? t(careerPreview.plan.nameKey) : careerPreview.activePlan.id,
          rank: careerPreview.activePlan.rank,
          culture: careerPreview.planCulture
        });
      }
      const campaignWarning = prestigeCampaignRestartCopy(careerPreview);
      if (campaignWarning) information += " " + campaignWarning;
      const challengeWarning = prestigeChallengeFailureCopy(careerPreview);
      if (challengeWarning) information += " " + challengeWarning;
      DOM.prestigeInfo.textContent = information;
    }
  }

  /** Shows the latest entries in the activity log. */
  function renderLog() {
    if (!DOM.logPanel) return;
    const locale = LOCALE_BY_LANG[currentLang] || "fr-FR";
    const signature = currentLang + "|" + gameState.log.map(entry => {
      const time = entry.time instanceof Date ? entry.time.getTime() : entry.time;
      return time + ":" + (entry.key || entry.text || "") + ":" + JSON.stringify(entry.params || {});
    }).join(";");
    if (signature === uiState.logRenderSignature) return;
    uiState.logRenderSignature = signature;
    DOM.logPanel.innerHTML = "";
    for (const entry of gameState.log) {
      const div = document.createElement("div");
      div.className = "log-entry";
      const timeLabel = entry.time instanceof Date ? entry.time.toLocaleTimeString(locale, { hour12: false }) : entry.time;
      const text = entry.key ? t(entry.key, entry.params || {}) : entry.text;
      div.textContent = "[" + timeLabel + "] " + text;
      DOM.logPanel.appendChild(div);
    }
  }

  function showEventBanner(key, tone = "mixed", params = {}) {
    if (!DOM.eventBanner) return;
    eventState.bannerTone = tone;
    eventState.bannerKey = key;
    eventState.bannerParams = params || {};
    refreshEventBanner();
    announceStatus(t(key, params));
    if (bannerHideTimer) {
      clearTimeout(bannerHideTimer);
      bannerHideTimer = null;
    }
    DOM.eventBanner.classList.remove("banner-visible", "hidden");
    void DOM.eventBanner.offsetWidth;
    DOM.eventBanner.classList.add("banner-visible");
    bannerHideTimer = setTimeout(() => {
      bannerHideTimer = null;
      hideEventBanner();
    }, 6000);
  }

  function hideEventBanner() {
    if (!DOM.eventBanner || DOM.eventBanner.classList.contains("hidden")) return;
    DOM.eventBanner.classList.remove("banner-visible");
    if (bannerHideTimer) {
      clearTimeout(bannerHideTimer);
    }
    bannerHideTimer = setTimeout(() => {
      bannerHideTimer = null;
      DOM.eventBanner.classList.add("hidden");
      eventState.bannerKey = null;
      eventState.bannerParams = null;
      eventState.bannerTone = "mixed";
      refreshEventBanner();
    }, reduceMotionPreferred() ? 0 : 320);
  }

  function refreshEventBanner() {
    if (!DOM.eventBanner) return;
    DOM.eventBanner.classList.remove("banner-positive", "banner-mixed", "banner-negative");
    if (!eventState.bannerKey) {
      if (DOM.eventBannerText) DOM.eventBannerText.textContent = "";
      return;
    }
    const tone = eventState.bannerTone || "mixed";
    const cls = tone === "positive" ? "banner-positive" : tone === "negative" ? "banner-negative" : "banner-mixed";
    DOM.eventBanner.classList.add(cls);
    const text = t(eventState.bannerKey, eventState.bannerParams || {});
    if (DOM.eventBannerText) {
      DOM.eventBannerText.textContent = text;
    }
    if (DOM.eventBannerIconUse) {
      const iconId = tone === "positive" ? "#pe-icon-trophy" : tone === "negative" ? "#pe-icon-quality" : "#pe-icon-journal";
      DOM.eventBannerIconUse.setAttribute("href", iconId);
    }
  }

  function areContractsUnlocked() {
    return (gameState.resources?.docTotal || 0) >= CONTRACTS_UNLOCK_DOC_TOTAL;
  }

  function areEventsAllowed() {
    if (!Settings || typeof Settings.getPreference !== "function") {
      return true;
    }
    return Settings.getPreference("eventsEnabled") !== false;
  }

  function syncEventsPreference() {
    const allowed = areEventsAllowed();
    if (eventState.eventsEnabled === allowed) return;
    eventState.eventsEnabled = allowed;
    if (!allowed) {
      if (window.Events && typeof window.Events.cancelActive === "function") {
        window.Events.cancelActive();
      }
      eventState.active = null;
      closeEventModal(true);
      hideEventBanner();
      renderPendingEventControl();
    }
  }

  function restorePendingEvent(savedState) {
    if (!eventState.eventsEnabled || !Events || !savedState || !savedState.events) return;
    const pendingId = savedState.events.pendingId;
    if (typeof pendingId !== "string" || !Array.isArray(Events.definitions)) return;
    const definition = Events.definitions.find(item => item.id === pendingId);
    if (!definition) return;
    const restored = typeof Events.debugForceEvent === "function"
      ? Events.debugForceEvent(pendingId)
      : definition;
    eventState.active = restored || definition;
    eventState.modalCanClose = true;
  }

  function renderPendingEventControl() {
    const pending = eventState.eventsEnabled ? eventState.active : null;
    setHiddenState(DOM.pendingEventButton, !pending);
    if (pending) {
      setTextIfChanged(DOM.pendingEventLabel, t("events.open"));
      const name = t(pending.titleKey);
      setTextIfChanged(DOM.pendingEventHint,
        t("events.pending.named", { name }) + " " + t("events.pending.hint"));
      DOM.pendingEventButton.setAttribute("aria-label", t("events.pending.named", { name }));
    } else {
      setTextIfChanged(DOM.pendingEventLabel, "");
      setTextIfChanged(DOM.pendingEventHint, "");
      if (DOM.pendingEventButton) DOM.pendingEventButton.removeAttribute("aria-label");
    }
  }

  function openPendingEvent() {
    if (!eventState.eventsEnabled || !eventState.active) return;
    showEventModal(eventState.active);
  }

  function disableEventInterruptions() {
    if (!Settings || typeof Settings.setPreference !== "function") return;
    Settings.setPreference("eventsEnabled", false);
    syncEventsPreference();
  }

  function checkDynamicEvents(dt) {
    if (!eventState.eventsEnabled) return;
    if (!window.Events) return;
    if (TutorialEngine && typeof TutorialEngine.isActive === "function" && TutorialEngine.isActive()) return;
    if (offlineReport || isModalSurfaceOpen(DOM.settingsModal) ||
        isModalSurfaceOpen(DOM.offlineModal)) return;
    const newEvent = Events.tick(gameState, dt);
    if (newEvent) {
      handleEventSpawn(newEvent);
    }
  }

  function handleEventSpawn(eventDef) {
    if (!eventState.eventsEnabled) return;
    eventState.active = eventDef;
    eventState.modalCanClose = true;
    notifyScene("event", eventDef.id);
    const name = t(eventDef.titleKey);
    logMessage("log.incidentPending", { name });
    setLastAction("feedback.incidentPending", { name });
    renderPendingEventControl();
    renderWorkOrder();
    showEventBanner("feedback.incidentPending", "mixed", { name });
    queueSave(true);
  }

  /**
   * Fire-and-forget notifications for the 3D campus (juice only — state
   * truth still flows through the polled snapshot). The queue is created
   * by the scene; when the 3D layer is absent this is a no-op.
   */
  function notifyScene(type, id) {
    const queue = window.__PE_SCENE_EVENTS__;
    if (queue && typeof queue.push === "function") {
      queue.push({ type, id });
    }
  }

  function showEventModal(eventDef) {
    if (!DOM.eventModal) return;
    openModalSurface(DOM.eventModal, DOM.eventDialog);
    DOM.eventModal.setAttribute("aria-hidden", "false");
    DOM.eventTitle.textContent = t(eventDef.titleKey);
    DOM.eventDescription.textContent = t(eventDef.descriptionKey);
    DOM.eventResult.textContent = "";
    DOM.eventChoices.innerHTML = "";
    DOM.closeEventModal.disabled = false;
    DOM.closeEventModal.removeAttribute("aria-disabled");
    DOM.closeEventModal.setAttribute("aria-label", t("events.archive"));
    DOM.closeEventModal.setAttribute("title", t("events.archive"));
    if (eventDef.type === "choice") {
      DOM.eventChoices.classList.remove("hidden");
      DOM.minigameContainer.classList.add("hidden");
      for (const choice of eventDef.choices) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event-choice-btn";
        btn.dataset.choice = choice.id;
        const label = document.createElement("span");
        label.className = "event-choice-label";
        label.textContent = t(choice.labelKey);
        const effect = document.createElement("span");
        effect.className = "event-choice-effect";
        effect.textContent = t(choice.resultKey);
        btn.appendChild(label);
        btn.appendChild(effect);
        DOM.eventChoices.appendChild(btn);
      }
      const first = DOM.eventChoices.querySelector("button");
      if (first) {
        first.focus();
      }
    } else {
      DOM.eventChoices.classList.add("hidden");
      DOM.minigameContainer.classList.remove("hidden");
      const info = Events.startMinigame();
      const code = info ? info.code : 1;
      DOM.minigamePrompt.textContent = t("events.calibration.prompt", { code });
      DOM.minigameContainer.querySelector("button").focus();
    }
  }

  function closeEventModal(force = false) {
    if (
      !DOM.eventModal ||
      DOM.eventModal.classList.contains("hidden") ||
      DOM.eventModal.classList.contains("is-closing")
    ) {
      return false;
    }
    if (!eventState.modalCanClose && !force) return false;
    const archivedEvent = eventState.active;
    if (archivedEvent) {
      if (window.Events && typeof window.Events.cancelActive === "function") {
        window.Events.cancelActive();
      }
      eventState.active = null;
    }
    closeModalSurface(DOM.eventModal, DOM.eventDialog);
    DOM.eventModal.setAttribute("aria-hidden", "true");
    renderPendingEventControl();
    renderWorkOrder();
    restoreModalFocus(DOM.eventModal, DOM.currentObjective);
    schedulePendingOfflineReport();
    if (archivedEvent) {
      const name = t(archivedEvent.titleKey);
      logMessage("log.incidentArchived", { name });
      showEventBanner("feedback.incidentArchived", "mixed", { name });
      queueSave(true);
    }
    return true;
  }

  function captureResourceTotals() {
    return {
      docBank: gameState.resources.docBank,
      docTotal: gameState.resources.docTotal,
      ccTotal: gameState.resources.ccTotal
    };
  }

  function recordEventOutcome(before) {
    if (!before) return;
    analyticsState.currentRun.eventDocNet += gameState.resources.docBank - before.docBank;
    analyticsState.currentRun.eventCcNet += gameState.resources.ccTotal - before.ccTotal;
    analyticsState.currentRun.eventsResolved += 1;
  }

  function handleEventChoiceClick(event) {
    const btn = event.target.closest("[data-choice]");
    if (!btn) return;
    const choiceId = btn.dataset.choice;
    const before = captureResourceTotals();
    const result = Events.resolveChoice(choiceId, gameState);
    if (!result) return;
    recordEventOutcome(before);
    DOM.eventResult.textContent = t(result.resultKey);
    logMessage("log.eventResult", { result: t(result.resultKey) });
    eventState.active = null;
    eventState.modalCanClose = true;
    DOM.closeEventModal.disabled = false;
    DOM.closeEventModal.removeAttribute("aria-disabled");
    queueSave(true);
    closeEventModal(true);
    renderPendingEventControl();
    renderWorkOrder();
    showEventBanner(result.resultKey, result.tone || "mixed");
  }

  function contractRequirementKey(requirement) {
    return requirement.type + (requirement.id ? ":" + requirement.id : "");
  }

  function formatContractRequirement(requirement) {
    if (requirement.type === "quality") {
      return t("contracts.requirementQuality", {
        current: Math.round(requirement.current * 100),
        required: Math.round(requirement.required * 100)
      });
    }
    if (requirement.type === "image") {
      return t("contracts.requirementImage", {
        current: Math.round(requirement.current * 100),
        required: Math.round(requirement.required * 100)
      });
    }
    if (requirement.type === "volume") {
      return t("contracts.requirementVolume", {
        current: formatNumber(requirement.current),
        required: formatNumber(requirement.required)
      });
    }
    const building = gameState.buildings.find(item => item.id === requirement.id);
    return t("contracts.requirementBuilding", {
      name: building ? getBuildingName(building) : requirement.id,
      current: formatNumber(requirement.current),
      required: formatNumber(requirement.required)
    });
  }

  function appendContractClause(card, contract, preview) {
    if (!contract.clause) return null;
    const clauseId = "contract-clause-" + contract.id;
    const clause = document.createElement("div");
    clause.className = "contract-clause is-optional";
    clause.id = clauseId;
    clause.dataset.contractClause = contract.id;
    const head = document.createElement("div");
    head.className = "contract-clause-head";
    const label = document.createElement("strong");
    label.className = "contract-clause-label";
    label.textContent = t("contracts.clause.label") + " · " + t(contract.clause.nameKey);
    const status = document.createElement("span");
    status.className = "contract-clause-status";
    status.textContent = t("contracts.clause.active");
    head.appendChild(label);
    head.appendChild(status);
    const description = document.createElement("div");
    description.className = "contract-clause-description";
    description.textContent = t(contract.clause.descKey, {
      target: Math.round(contract.clause.target * 100)
    }) + " " + t("contracts.clause.deliveryGuaranteed");
    const progress = document.createElement("div");
    progress.className = "contract-clause-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.appendChild(document.createElement("span"));
    const reward = document.createElement("div");
    reward.className = "contract-clause-reward";
    reward.textContent = t("contracts.clause.reward", {
      doc: formatNumber(preview.clauseReward.doc || 0),
      cc: formatNumber(preview.clauseReward.cc || 0)
    });
    clause.appendChild(head);
    clause.appendChild(description);
    clause.appendChild(progress);
    clause.appendChild(reward);
    card.appendChild(clause);
    return clauseId;
  }

  function renderContractsPanel() {
    updateRerollButton();
    if (!window.EndgameModule) return;
    if (!DOM.contractsList) return;
    if (!contractsState.unlocked) {
      DOM.contractsTab.classList.remove("has-active-contract");
      if (contractsState.listRenderSignature !== "locked") {
        DOM.contractsList.innerHTML = "";
        contractsState.listRenderSignature = "locked";
      }
      return;
    }
    contractsState.available = window.EndgameModule.availableContracts(gameState);
    const runningContract = window.EndgameModule.activeContract && window.EndgameModule.activeContract.current;
    DOM.contractsTab.classList.toggle("has-active-contract", !!runningContract);
    const contractModifiers = getContractModifiers();
    const prepressStudio = gameState.buildings.find(building => building.id === "prepressStudio");
    const listSignature = currentLang + "|" + contractsState.available.map(contract => contract.id).join(",") +
      "|active:" + (runningContract ? runningContract.id : "none") +
      "|prepress:" + (prepressStudio ? prepressStudio.quantity : 0) +
      "|modifiers:" + JSON.stringify(contractModifiers);
    if (listSignature === contractsState.listRenderSignature) {
      updateContractCards(runningContract);
      return;
    }
    contractsState.listRenderSignature = listSignature;
    DOM.contractsList.innerHTML = "";
    if (!contractsState.available.length) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.textContent = t("contracts.noneAvailable");
      DOM.contractsList.appendChild(empty);
    } else {
      for (const contract of contractsState.available) {
        const preview = typeof window.EndgameModule.previewContract === "function"
          ? window.EndgameModule.previewContract(contract, gameState, contractModifiers)
          : {
              duration: contract.duration,
              durationReduction: 0,
              baseReward: { ...contract.reward },
              clauseReward: contract.clause ? { ...contract.clause.reward } : { doc: 0, cc: 0 }
            };
        const card = document.createElement("div");
        card.className = "contract-card";
        card.dataset.contractCard = contract.id;
        const requirementsId = "contract-requirements-" + contract.id;
        const title = document.createElement("strong");
        title.textContent = t(contract.nameKey);
        const description = document.createElement("div");
        description.textContent = t(contract.descKey);
        const requirements = document.createElement("ul");
        requirements.className = "contract-requirements";
        requirements.id = requirementsId;
        const requirementStatus = typeof window.EndgameModule.getRequirementsStatus === "function"
          ? window.EndgameModule.getRequirementsStatus(contract, gameState)
          : [];
        for (const requirement of requirementStatus) {
          const row = document.createElement("li");
          row.dataset.contractRequirement = contractRequirementKey(requirement);
          const mark = document.createElement("span");
          mark.setAttribute("aria-hidden", "true");
          const copy = document.createElement("b");
          row.appendChild(mark);
          row.appendChild(copy);
          requirements.appendChild(row);
        }
        const terms = document.createElement("div");
        terms.className = "contract-terms";
        const duration = document.createElement("span");
        duration.textContent = t("contracts.effectiveDuration", { seconds: preview.duration });
        const baseReward = document.createElement("span");
        baseReward.textContent = t("contracts.reward", {
          doc: formatNumber(preview.baseReward.doc || 0),
          cc: formatNumber(preview.baseReward.cc || 0)
        });
        terms.appendChild(duration);
        terms.appendChild(baseReward);
        if (preview.durationReduction > 0) {
          const reduction = document.createElement("span");
          reduction.textContent = t("contracts.prepressReduction", {
            percent: Math.round(preview.durationReduction * 100)
          });
          terms.appendChild(reduction);
        }
        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(requirements);
        const clauseId = appendContractClause(card, contract, preview);
        card.appendChild(terms);
        const actions = document.createElement("div");
        actions.className = "contract-actions";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-slim";
        btn.dataset.contract = contract.id;
        btn.textContent = t("contracts.start");
        btn.setAttribute("aria-describedby", [requirementsId, clauseId].filter(Boolean).join(" "));
        actions.appendChild(btn);
        card.appendChild(actions);
        DOM.contractsList.appendChild(card);
      }
      DOM.contractsList.querySelectorAll("[data-contract]").forEach(btn => {
        btn.addEventListener("click", () => startContract(btn.dataset.contract));
      });
    }
    updateContractCards(runningContract);
  }

  function updateContractCards(runningContract) {
    if (!DOM.contractsList || !window.EndgameModule) return;
    for (const contract of contractsState.available) {
      const card = DOM.contractsList.querySelector(`[data-contract-card="${contract.id}"]`);
      if (!card) continue;
      const requirementRows = typeof window.EndgameModule.getRequirementsStatus === "function"
        ? window.EndgameModule.getRequirementsStatus(contract, gameState)
        : [];
      for (const requirement of requirementRows) {
        const key = contractRequirementKey(requirement);
        const row = Array.from(card.querySelectorAll("[data-contract-requirement]")).find(item => {
          return item.dataset.contractRequirement === key;
        });
        if (!row) continue;
        row.classList.toggle("is-met", requirement.met);
        setTextIfChanged(row.querySelector("span"), requirement.met ? "✓" : "×");
        setTextIfChanged(row.querySelector("b"), formatContractRequirement(requirement));
      }
      if (contract.clause && typeof window.EndgameModule.getClauseProgress === "function") {
        const clauseProgress = window.EndgameModule.getClauseProgress(contract, gameState);
        const clause = card.querySelector(`[data-contract-clause="${contract.id}"]`);
        if (clause && clauseProgress) {
          clause.classList.toggle("is-met", clauseProgress.met);
          const status = clause.querySelector(".contract-clause-status");
          setTextIfChanged(status, t(clauseProgress.met
            ? "contracts.clause.succeeded"
            : "contracts.clause.active"));
          clause.style.setProperty("--clause-progress", (clauseProgress.ratio * 100).toFixed(1) + "%");
        }
      }
      const canStart = typeof window.EndgameModule.meetsRequirements === "function"
        ? window.EndgameModule.meetsRequirements(contract, gameState)
        : requirementRows.every(requirement => requirement.met);
      const btn = card.querySelector(`[data-contract="${contract.id}"]`);
      if (!btn) continue;
      const disabled = !!runningContract || !canStart;
      btn.disabled = disabled;
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      btn.setAttribute("aria-label", runningContract
        ? t("contracts.alreadyRunning")
        : canStart
          ? t("contracts.startNamed", { name: t(contract.nameKey) })
          : t(contract.nameKey) + " · " + t("contracts.startLocked"));
      setTextIfChanged(btn, t(runningContract
        ? "contracts.runningBadge"
        : canStart ? "contracts.start" : "contracts.startLocked"));
    }
  }

  function startContract(contractId) {
    if (!window.EndgameModule) return;
    const result = window.EndgameModule.startContract(contractId, gameState, getContractModifiers());
    if (!result || !result.ok) {
      const key = result && result.error === "requirements" ? "contracts.requirementsNotMet" : "contracts.alreadyRunning";
      showEventBanner(key, "negative");
      return;
    }
    logMessage("log.contractStart", { name: t(result.contract.nameKey) });
    setLastAction("contracts.banner.started", { name: t(result.contract.nameKey) });
    uiState.completionReceipt = null;
    queueSave(true);
    contractsState.listRenderSignature = "";
    renderContractsPanel();
    renderWorkOrder();
    if (DOM.currentObjective) {
      DOM.currentObjective.focus({ preventScroll: true });
      DOM.currentObjective.scrollIntoView({
        behavior: reduceMotionPreferred() ? "auto" : "smooth",
        block: "center"
      });
    }
    showEventBanner("contracts.banner.started", "positive", { name: t(result.contract.nameKey) });
    requestAnimationFrame(() => UIEffects.playContractEffect(DOM.currentObjective));
  }

  function tickContracts(dt) {
    if (!window.EndgameModule) return;
    const before = captureResourceTotals();
    const result = window.EndgameModule.tickContract(dt, gameState);
    if (result) {
      const restoreContractFocus = DOM.currentObjective && document.activeElement === DOM.currentObjective;
      const docGain = Math.max(0, gameState.resources.docTotal - before.docTotal);
      const ccGain = Math.max(0, gameState.resources.ccTotal - before.ccTotal);
      analyticsState.currentRun.contractDocs += docGain;
      analyticsState.currentRun.contractCc += ccGain;
      analyticsState.currentRun.contractsCompleted += 1;
      analyticsState.lifetimeObserved.docs += docGain;
      analyticsState.lifetimeObserved.cc += ccGain;
      const contractName = t(result.nameKey);
      const receiptParams = { doc: formatNumber(docGain), cc: formatNumber(ccGain) };
      const clauseParams = {
        doc: formatNumber(result.clauseReward && result.clauseReward.doc || 0),
        cc: formatNumber(result.clauseReward && result.clauseReward.cc || 0)
      };
      const clauseKey = result.clauseSucceeded ? "feedback.clauseSucceeded" : "feedback.clauseFailed";
      const progressionRecord = Progression && careerState && typeof Progression.recordContract === "function"
        ? Progression.recordContract(careerState, {
            id: result.id,
            clauseSucceeded: result.clauseSucceeded,
            clauseId: result.clause && result.clause.id,
            quality: gameState.stats.quality,
            brandImage: gameState.stats.brandImage
          }, { now: Date.now() })
        : null;
      if (progressionRecord && progressionRecord.challengeFailure) {
        handleChallengeFailure(progressionRecord.challengeFailure);
      }
      updateCareerProgress({ save: false });
      uiState.completionReceipt = {
        kind: "delivery",
        name: contractName,
        detailKey: "feedback.deliveryReceipt",
        detailParams: receiptParams,
        detailText: t(clauseKey, clauseParams),
        expiresAt: Date.now() + 1200
      };
      setLastAction("feedback.contractDelivered", { name: contractName }, "feedback.deliveryReceipt", receiptParams);
      logMessage("log.contractComplete", { name: contractName });
      logMessage(result.clauseSucceeded ? "log.clauseSucceeded" : "log.clauseFailed", {
        name: contractName,
        ...clauseParams
      });
      showEventBanner(clauseKey, result.clauseSucceeded ? "positive" : "mixed", clauseParams);
      announceStatus(
        t("feedback.contractDelivered", { name: contractName }) + ". " +
        t("feedback.deliveryReceipt", receiptParams) + ". " + t(clauseKey, clauseParams)
      );
      if (UIEffects && typeof UIEffects.playHorn === "function") UIEffects.playHorn();
      queueSave(true);
      contractsState.listRenderSignature = "";
      renderContractsPanel();
      renderWorkOrder();
      requestAnimationFrame(() => UIEffects.playContractEffect(DOM.currentObjective));
      setTimeout(() => {
        if (uiState.completionReceipt && uiState.completionReceipt.expiresAt <= Date.now()) {
          uiState.completionReceipt = null;
          renderWorkOrder();
        }
      }, 1250);
      if (restoreContractFocus) {
        const nextOffer = DOM.contractsList && DOM.contractsList.querySelector("[data-contract]:not(:disabled)");
        (nextOffer || DOM.contractsTab).focus();
      }
    }
  }

  function handleContractsReroll() {
    if (!window.EndgameModule || !canRerollContracts()) return;
    window.EndgameModule.rerollContracts(gameState);
    contractsState.lastReroll = performance.now();
    contractsState.rerollCount += 1;
    contractsState.listRenderSignature = "";
    renderContractsPanel();
  }

  function canRerollContracts() {
    if (!contractsState.lastReroll) return true;
    return performance.now() - contractsState.lastReroll >= CONTRACT_REROLL_COOLDOWN;
  }

  function updateRerollButton() {
    if (!DOM.rerollContractsBtn) return;
    if (!window.EndgameModule) {
      if (!DOM.rerollContractsBtn.disabled) DOM.rerollContractsBtn.disabled = true;
      return;
    }
    if (canRerollContracts()) {
      if (DOM.rerollContractsBtn.disabled) DOM.rerollContractsBtn.disabled = false;
      setTextIfChanged(DOM.rerollContractsBtn, t("actions.rerollContracts"));
      return;
    }
    const elapsed = performance.now() - contractsState.lastReroll;
    const remaining = Math.max(0, CONTRACT_REROLL_COOLDOWN - elapsed);
    if (!DOM.rerollContractsBtn.disabled) DOM.rerollContractsBtn.disabled = true;
    setTextIfChanged(DOM.rerollContractsBtn, t("contracts.rerollCountdown", {
      seconds: Math.max(1, Math.ceil(remaining / 1000))
    }));
  }

  function handleMinigameResponse(event) {
    const btn = event.target.closest("[data-minigame-response]");
    if (!btn) return;
    const answer = btn.getAttribute("data-minigame-response");
    const before = captureResourceTotals();
    const result = Events.resolveMinigame(answer, gameState);
    if (!result) return;
    recordEventOutcome(before);
    DOM.eventResult.textContent = t(result.resultKey);
    logMessage("log.eventResult", { result: t(result.resultKey) });
    eventState.active = null;
    eventState.modalCanClose = true;
    DOM.closeEventModal.disabled = false;
    DOM.closeEventModal.removeAttribute("aria-disabled");
    queueSave(true);
    closeEventModal(true);
    renderPendingEventControl();
    renderWorkOrder();
    showEventBanner(result.resultKey, result.tone || "mixed");
  }

  function formatAchievementReward(definition) {
    const reward = definition && definition.reward ? definition.reward : {};
    const parts = [];
    if (reward.doc) parts.push(t("achievements.rewardDoc", { amount: formatNumber(reward.doc) }));
    if (reward.cc) parts.push(t("achievements.rewardCc", { amount: formatNumber(reward.cc) }));
    if (reward.culture) parts.push(t("achievements.rewardCulture", { amount: formatNumber(reward.culture) }));
    return parts.join(" · ");
  }

  function buildAchievementContext() {
    return {
      resources: gameState.resources,
      buildings: gameState.buildings,
      upgrades: gameState.upgrades,
      stats: gameState.stats,
      analytics: analyticsState
    };
  }

  function applyAchievementReward(definition, unlockedAt) {
    if (!definition || achievementsState.rewarded[definition.id]) return "";
    const reward = definition.reward || {};
    if (Number.isFinite(reward.doc) && reward.doc > 0) {
      gameState.resources.docBank += reward.doc;
      gameState.resources.docTotal += reward.doc;
      analyticsState.currentRun.achievementDocs += reward.doc;
      analyticsState.lifetimeObserved.docs += reward.doc;
    }
    if (Number.isFinite(reward.cc) && reward.cc > 0) {
      gameState.resources.ccTotal += reward.cc;
      analyticsState.currentRun.achievementCc += reward.cc;
      analyticsState.lifetimeObserved.cc += reward.cc;
    }
    if (Number.isFinite(reward.culture) && reward.culture > 0) {
      gameState.resources.culturePoints += reward.culture;
      analyticsState.currentRun.achievementCulture += reward.culture;
    }
    achievementsState.rewarded[definition.id] = unlockedAt || Date.now();
    return formatAchievementReward(definition);
  }

  function updateAchievementProgressNodes() {
    if (!DOM.achievementsList || !window.Achievements || typeof Achievements.getProgress !== "function") return;
    const achievementContext = buildAchievementContext();
    for (const definition of Achievements.definitions) {
      const item = DOM.achievementsList.querySelector(`[data-achievement-id="${definition.id}"]`);
      if (!item) continue;
      const progress = Achievements.getProgress(definition, achievementContext);
      const bar = item.querySelector(".achievement-progress");
      const text = item.querySelector(".achievement-progress-text");
      if (bar) {
        bar.style.setProperty("--achievement-progress", (progress.ratio * 100).toFixed(1) + "%");
        bar.setAttribute("aria-valuenow", String(progress.current));
        bar.setAttribute("aria-valuemax", String(progress.target));
        bar.setAttribute("aria-label", t("achievements.progress", {
          current: formatNumber(progress.current),
          target: formatNumber(progress.target)
        }));
      }
      setTextIfChanged(text, t("achievements.progress", {
        current: formatNumber(progress.current),
        target: formatNumber(progress.target)
      }));
    }
  }

  function renderAchievementsPanel() {
    const container = DOM.achievementsList;
    if (!container || !window.Achievements) return;
    const unlockedCount = Achievements.definitions.reduce((count, definition) => {
      return count + (achievementsState.unlocked[definition.id] ? 1 : 0);
    }, 0);
    setTextIfChanged(DOM.achievementUnlockedCount, unlockedCount);
    setTextIfChanged(DOM.achievementTotalCount, Achievements.definitions.length);
    // Garde de vue (aucun effet de jeu) : renderAll() repasse ici à chaque
    // frame ; sans mémo, le innerHTML serait reconstruit 60 fois/s, les
    // animations d'apparition (paper-pop, visa stamp-slam) redémarreraient
    // en boucle et la zone aria-live pourrait ré-annoncer du contenu
    // identique. On ne reconstruit que si succès ou langue changent.
    const signature = document.documentElement.lang + "|" +
      Achievements.definitions.map(def => {
        return def.id + ":" + (achievementsState.unlocked[def.id] ? 1 : 0) +
          ":" + (achievementsState.rewarded[def.id] ? 1 : 0);
      }).join(",");
    if (signature === achievementsState.renderSignature) {
      updateAchievementProgressNodes();
      return;
    }
    achievementsState.renderSignature = signature;
    container.innerHTML = "";
    if (!Achievements.definitions.length) {
      container.innerHTML = `<div class="small">${t("achievements.empty")}</div>`;
      return;
    }
    for (const def of Achievements.definitions) {
      const unlockedAt = achievementsState.unlocked[def.id];
      const item = document.createElement("div");
      item.className = "achievement-item" + (unlockedAt ? " unlocked" : "");
      item.dataset.achievementId = def.id;
      if (unlockedAt) {
        // Visa tamponné (style.css ::after content: attr(data-stamp)) :
        // texte traduit, jamais en dur dans le CSS.
        item.setAttribute("data-stamp", t("achievements.stampVisa"));
      }
      // Tampon-badge illustré (images-todo P3), retiré silencieusement si absent.
      const badge = document.createElement("img");
      badge.className = "achievement-badge";
      badge.src = assetUrl("/assets/images/achievement-" + def.id + ".png");
      badge.alt = "";
      badge.decoding = "async";
      badge.loading = "lazy";
      badge.addEventListener("error", () => badge.remove(), { once: true });
      const title = document.createElement("div");
      title.className = "achievement-title";
      title.innerHTML = `<span>${t(def.nameKey)}</span><span class="achievement-status">${t(unlockedAt ? "achievements.statusUnlocked" : "achievements.statusLocked")}</span>`;
      item.appendChild(badge);
      const desc = document.createElement("div");
      desc.textContent = t(def.descKey);
      const progressRow = document.createElement("div");
      progressRow.className = "achievement-progress-row";
      progressRow.style.gridColumn = "2";
      const progressBar = document.createElement("div");
      progressBar.className = "achievement-progress";
      progressBar.setAttribute("role", "progressbar");
      progressBar.setAttribute("aria-valuemin", "0");
      progressBar.appendChild(document.createElement("span"));
      const progressText = document.createElement("span");
      progressText.className = "achievement-progress-text";
      progressRow.appendChild(progressBar);
      progressRow.appendChild(progressText);
      const reward = document.createElement("div");
      reward.className = "small achievement-reward";
      reward.style.gridColumn = "2";
      const rewardText = formatAchievementReward(def);
      reward.textContent = t("achievements.reward", { reward: rewardText }) +
        (achievementsState.rewarded[def.id] ? " · " + t("achievements.rewardGranted") : "");
      item.appendChild(title);
      item.appendChild(desc);
      item.appendChild(progressRow);
      item.appendChild(reward);
      container.appendChild(item);
    }
    updateAchievementProgressNodes();
  }

  function checkAchievements(options = {}) {
    if (!window.Achievements) return null;
    const notify = options.notify !== false;
    const unlockedMap = achievementsState.unlocked;
    const newly = [];
    const now = Date.now();
    let firstDefinition = null;
    const grantedRewards = [];
    // A reward can itself cross another achievement threshold (for example,
    // firstPrestige can raise Culture to cultureCollector). Resolve the whole
    // chain as one atomic batch so receipts, notifications and run analytics
    // all describe the same player action.
    while (newly.length < Achievements.definitions.length) {
      const unlockWave = Achievements.evaluate(buildAchievementContext(), unlockedMap);
      if (!unlockWave.length) break;
      for (const id of unlockWave) {
        unlockedMap[id] = now;
        newly.push(id);
        const def = Achievements.definitions.find(d => d.id === id);
        if (def) {
          if (!firstDefinition) firstDefinition = def;
          logMessage("log.achievement", { name: t(def.nameKey) });
          const reward = applyAchievementReward(def, now);
          if (reward) {
            grantedRewards.push({ definition: def, reward });
            logMessage("log.achievementReward", { name: t(def.nameKey), reward });
          }
        }
      }
    }
    if (!newly.length) return null;
    if (Array.isArray(options.unlockedDefinitions)) {
      options.unlockedDefinitions.push(...newly.map(id => {
        return Achievements.definitions.find(definition => definition.id === id);
      }).filter(Boolean));
    }
    if (Array.isArray(options.grantedRewards)) {
      options.grantedRewards.push(...grantedRewards);
    }
    updateCareerProgress({ save: false });
    if (firstDefinition && notify) {
      if (newly.length > 1) {
        showEventBanner("achievements.batchUnlocked", "positive", { count: newly.length });
      } else if (grantedRewards[0]) {
        showEventBanner("feedback.achievementReward", "positive", {
          name: t(grantedRewards[0].definition.nameKey),
          reward: grantedRewards[0].reward
        });
      } else {
        showEventBanner("log.achievement", "positive", { name: t(firstDefinition.nameKey) });
      }
      UIEffects.playAchievementEffect(DOM.eventBanner);
    }
    achievementsState.renderSignature = "";
    renderAchievementsPanel();
    requestAnimationFrame(() => {
      for (const id of newly) {
        const item = DOM.achievementsList && DOM.achievementsList.querySelector(`[data-achievement-id="${id}"]`);
        triggerStamp(item, "is-stamped");
      }
    });
    if (options.save !== false) queueSave(true);
    return firstDefinition;
  }

  /** Toggles the affordability state for each building action button. */
  function updateBuildingButtons() {
    const container = DOM.buildingsList;
    if (!container) return;
    const bank = gameState.resources.docBank;
    const currentRate = computeDocPerSecond();
    container.querySelectorAll("[data-building-id]").forEach(row => {
      const id = row.getAttribute("data-building-id");
      const building = gameState.buildings.find(x => x.id === id);
      if (!building) return;
      const cost = buildingCost(building);
      const canAfford = bank >= cost;
      const missing = Math.max(0, cost - bank);
      const affordability = Math.max(0, Math.min(100, bank / Math.max(1, cost) * 100));
      row.classList.toggle("is-affordable", canAfford);
      row.classList.toggle("is-owned", building.quantity > 0);
      row.style.setProperty("--afford-progress", affordability.toFixed(1) + "%");
      const btn = row.querySelector(`[data-building-btn="${id}"]`);
      if (btn) {
        btn.classList.toggle("disabled", !canAfford);
        if (btn.disabled !== !canAfford) btn.disabled = !canAfford;
        btn.setAttribute("aria-disabled", canAfford ? "false" : "true");
        setTextIfChanged(btn, t(canAfford ? "actions.buy" : "actions.tooExpensive"));
        btn.setAttribute("aria-label", t("feedback.buyBuildingLabel", {
          name: getBuildingName(building),
          cost: formatNumber(cost)
        }));
      }
      const costEl = row.querySelector(`[data-building-cost="${id}"]`);
      if (costEl) {
        setTextIfChanged(costEl, t("label.costDoc", { amount: formatNumber(cost) }));
      }
      const projectedRate = projectedDocPerSecond(building);
      const rateChanged = Math.abs(projectedRate - currentRate) > 1e-9;
      const effectEl = row.querySelector(`[data-building-effect="${id}"]`);
      if (effectEl) {
        const impact = formatBuildingImpactText(building, 1);
        setTextIfChanged(effectEl, rateChanged
          ? t("feedback.purchaseRatePreview", { amount: formatNumber(projectedRate) })
          : t("feedback.purchaseImpactPreview", { impact: impact || getBuildingDesc(building) }));
      }
      const readiness = row.querySelector(`[data-building-readiness="${id}"]`);
      if (readiness) {
        let message = canAfford
          ? t("feedback.readyToInstall")
          : t("feedback.missingDocs", { amount: formatNumber(missing) });
        if (!canAfford && currentRate > 0) {
          message += " · " + t("feedback.affordEta", {
            seconds: Math.max(1, Math.ceil(missing / currentRate))
          });
        }
        setTextIfChanged(readiness, message);
      }
    });
  }

  function showBuildingFeedback(id, primary, detail) {
    clearBuildingInspectorFeedback();
    buildingInspectorState.selectedId = id;
    buildingInspectorState.feedback = { id, primary, detail: detail || "" };
    renderBuildingInspector();
    buildingInspectorState.feedbackTimer = setTimeout(() => {
      buildingInspectorState.feedback = null;
      buildingInspectorState.feedbackTimer = null;
      renderBuildingInspector();
    }, 2000);
  }

  /** Toggles the affordability state for each upgrade action button. */
  function updateUpgradeButtons() {
    const container = DOM.upgradesList;
    if (!container) return;
    const bank = gameState.resources.docBank;
    container.querySelectorAll("[data-upgrade-btn]").forEach(btn => {
      const id = btn.getAttribute("data-upgrade-btn");
      const upgrade = gameState.upgrades.find(x => x.id === id);
      if (!upgrade) return;
      const canAfford = bank >= upgrade.cost;
      btn.classList.toggle("disabled", !canAfford);
      if (btn.disabled !== !canAfford) btn.disabled = !canAfford;
      btn.setAttribute("aria-disabled", canAfford ? "false" : "true");
      setTextIfChanged(btn, t(canAfford ? "actions.buy" : "actions.tooExpensive"));
    });
    container.querySelectorAll("[data-upgrade-cost]").forEach(costEl => {
      const id = costEl.getAttribute("data-upgrade-cost");
      const upgrade = gameState.upgrades.find(x => x.id === id);
      if (!upgrade) return;
      setTextIfChanged(costEl, t("label.costDoc", { amount: formatNumber(upgrade.cost) }));
    });
  }

  function createPeIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    svg.setAttribute("class", "pe-icon");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", "#pe-icon-" + name);
    svg.appendChild(use);
    return svg;
  }

  /** Renders the list of available buildings, descriptions and stats. */
  function renderBuildings() {
    const container = DOM.buildingsList;
    if (!container) return;
    container.innerHTML = "";
    let hasVisible = false;

    for (const [buildingIndex, b] of gameState.buildings.entries()) {
      if (!b.isUnlocked) continue;
      hasVisible = true;
      const cost = buildingCost(b);
      const milestoneMultiplier = getMilestoneMultiplier(b.quantity);
      const totalProd = b.baseProduction * getEffectiveQuantity(b.quantity);

      const row = document.createElement("div");
      row.className = "building-row" + (b.quantity > 0 ? " is-owned" : "");
      row.dataset.buildingId = b.id;

      const sequence = document.createElement("span");
      sequence.className = "building-sequence";
      sequence.setAttribute("aria-hidden", "true");
      sequence.textContent = t("building.planLabel", {
        number: String(buildingIndex + 1).padStart(2, "0")
      });
      row.appendChild(sequence);

      const info = document.createElement("div");
      info.className = "building-info";

      const nameButton = document.createElement("button");
      nameButton.type = "button";
      nameButton.className = "building-name-button";
      nameButton.dataset.buildingSelect = b.id;
      nameButton.setAttribute("aria-controls", "buildingInspector");
      nameButton.setAttribute("aria-pressed", buildingInspectorState.selectedId === b.id ? "true" : "false");
      nameButton.setAttribute("aria-label", t("feedback.unitDetailsLabel", { name: getBuildingName(b) }));
      const emoji = b.emoji || "🏗️";
      const emojiSpan = document.createElement("span");
      emojiSpan.className = "building-emoji";
      // Miniature industrielle V4 avec repli vers l'ancien sticker, puis emoji.
      const sticker = document.createElement("img");
      sticker.className = "building-sticker";
      sticker.src = assetUrl("/assets/images/building-" + b.id + "-v4.webp");
      sticker.alt = "";
      sticker.decoding = "async";
      sticker.loading = "lazy";
      let triedLegacySticker = false;
      sticker.addEventListener("error", () => {
        if (!triedLegacySticker) {
          triedLegacySticker = true;
          sticker.src = assetUrl("/assets/images/building-" + b.id + ".webp");
          return;
        }
        sticker.remove();
        emojiSpan.textContent = emoji;
      });
      emojiSpan.appendChild(sticker);
      const labelSpan = document.createElement("span");
      labelSpan.className = "building-name-label";
      labelSpan.textContent = getBuildingName(b);
      nameButton.appendChild(emojiSpan);
      nameButton.appendChild(labelSpan);

      nameButton.addEventListener("click", event => {
        event.stopPropagation();
        selectBuildingForInspector(b.id);
      });

      info.appendChild(nameButton);
      // Compactage (feedback 2026-07-18) : la quantité devient une pastille
      // dans la ligne du nom, la description vit dans le tooltip (clic sur
      // le nom), et la production tient en une ligne arithmétique
      // universelle « 0,5 ×6 = 3,0 DOC/s ».
      const qtyChip = document.createElement("span");
      qtyChip.className = "building-qty-chip";
      qtyChip.textContent = "×" + b.quantity;
      nameButton.appendChild(qtyChip);

      const productionMeta = document.createElement("div");
      productionMeta.className = "building-meta";
      productionMeta.textContent = b.baseProduction
        ? formatNumber(b.baseProduction) + " ×" + b.quantity +
          (milestoneMultiplier > 1 ? " ×" + milestoneMultiplier.toFixed(2) : "") + " = " +
          formatNumber(totalProd || 0) + " DOC/s"
        : t("label.modifierOnly");
      info.appendChild(productionMeta);

      const effectPreview = document.createElement("div");
      effectPreview.className = "building-effect-preview";
      effectPreview.dataset.buildingEffect = b.id;
      effectPreview.id = "building-effect-" + b.id;
      info.appendChild(effectPreview);

      const milestone = document.createElement("div");
      milestone.className = "building-milestone";
      milestone.dataset.buildingMilestone = b.id;
      const nextMilestone = getNextMilestone(b.quantity);
      if (nextMilestone) {
        milestone.textContent = t("career.dossier.next", {
          action: t("building." + b.id + ".milestone" + nextMilestone.quantity)
        });
      } else {
        milestone.classList.add("is-reached");
        milestone.textContent = t("building." + b.id + ".officeNote");
      }
      info.appendChild(milestone);

      const buy = document.createElement("div");
      buy.className = "building-buy";

      const costEl = document.createElement("div");
      costEl.className = "building-cost";
      costEl.dataset.buildingCost = b.id;
      costEl.textContent = t("label.costDoc", { amount: formatNumber(cost) });

      const readiness = document.createElement("div");
      readiness.className = "building-readiness";
      readiness.dataset.buildingReadiness = b.id;
      readiness.id = "building-readiness-" + b.id;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-buy";
      btn.dataset.buildingBtn = b.id;
      btn.setAttribute("aria-describedby", effectPreview.id + " " + readiness.id);
      btn.textContent = t("actions.buy");
      btn.addEventListener("click", () => buyBuilding(b.id, btn));

      buy.appendChild(costEl);
      buy.appendChild(readiness);
      buy.appendChild(btn);

      row.appendChild(info);
      row.appendChild(buy);
      container.appendChild(row);
    }

    if (!hasVisible) {
      container.innerHTML = `<div class="building-placeholder">${t("buildings.noneAffordable")}</div>`;
    }
    renderBuildingInspector();
  }

  /** Renders unlocked upgrades or a placeholder when none are ready. */
  function renderUpgrades() {
    const container = DOM.upgradesList;
    if (!container) return;
    container.innerHTML = "";
    let hasUpgrade = false;

    for (const u of gameState.upgrades) {
      if (u.purchased || !u.unlocked) continue;
      hasUpgrade = true;

      const div = document.createElement("div");
      div.className = "upgrade-item";

      const mark = document.createElement("span");
      mark.className = "upgrade-mark";
      mark.appendChild(createPeIcon("upgrade"));

      const left = document.createElement("div");
      left.className = "upgrade-copy";
      const title = document.createElement("div");
      title.className = "upgrade-title";
      title.textContent = getUpgradeName(u);
      const description = document.createElement("div");
      description.className = "upgrade-description";
      description.textContent = getUpgradeDesc(u);
      const cost = document.createElement("div");
      cost.className = "small";
      cost.dataset.upgradeCost = u.id;
      cost.textContent = t("label.costDoc", { amount: formatNumber(u.cost) });
      left.appendChild(title);
      left.appendChild(description);
      left.appendChild(cost);

      const right = document.createElement("div");
      right.className = "upgrade-action";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-upgrade";
      btn.dataset.upgradeBtn = u.id;
      btn.textContent = t("actions.buy");
      btn.addEventListener("click", () => buyUpgrade(u.id, btn));

      right.appendChild(btn);
      div.appendChild(mark);
      div.appendChild(left);
      div.appendChild(right);
      container.appendChild(div);
    }

    if (!hasUpgrade) {
      container.innerHTML = `<div class="small">${t("label.noUpgrade")}</div>`;
    }
  }

  /** Ensures upgrades become visible once their docTotal threshold is met. */
  function refreshUpgradeUnlocks(forceRender = false) {
    let unlockedSomething = false;
    for (const upg of gameState.upgrades) {
      const threshold = upg.unlockDocTotal || 0;
      if (!upg.unlocked && gameState.resources.docTotal >= threshold) {
        upg.unlocked = true;
        unlockedSomething = true;
      }
    }
    if (unlockedSomething || forceRender) {
      uiState.upgradesDirty = true;
    }
  }

  /** Draws all UI sections, honouring the dirty flags for heavy lists. */
  function renderAll(forceFull = false) {
    ensureContractsUnlockState();
    syncBuildingUnlocks();
    renderStats();
    renderPrestige();
    renderCareerPanel(forceFull);
    renderLog();
    renderContractsPanel();
    renderAchievementsPanel();
    renderGodModePanel();

    if (forceFull || uiState.buildingsDirty) {
      renderBuildings();
      uiState.buildingsDirty = false;
    }
    updateBuildingButtons();

    if (forceFull || uiState.upgradesDirty) {
      renderUpgrades();
      uiState.upgradesDirty = false;
    }
    updateUpgradeButtons();
    uiState.lastFrameRender = performance.now();
  }

  function ensureContractsUnlockState() {
    const unlocked = areContractsUnlocked();
    if (contractsState.unlocked === unlocked) {
      updateContractsTabVisibility(unlocked);
      return;
    }
    contractsState.unlocked = unlocked;
    updateContractsTabVisibility(unlocked);
    switchDetailTab(unlocked ? "contracts" : "journal");
    // Le déblocage peut arriver APRÈS le premier rendu (sauvegarde chargée
    // au-dessus du seuil) : sans repaint ici, la liste restait vide jusqu'à
    // un changement de langue ou un reroll manuel.
    renderContractsPanel();
  }

  function updateContractsTabVisibility(unlocked) {
    if (DOM.contractsTab) {
      DOM.contractsTab.classList.toggle("hidden", !unlocked);
      DOM.contractsTab.setAttribute("aria-hidden", unlocked ? "false" : "true");
    }
    if (!unlocked && DOM.contractsPanel) {
      DOM.contractsPanel.classList.add("hidden");
    }
  }

  /** Adds listeners to god mode controls and the hidden key sequence. */
  function initGodModeControls() {
    if (DOM.godModeCard) {
      DOM.godModeCard.querySelectorAll("[data-god-scale]").forEach(btn => {
        btn.addEventListener("click", () => {
          const val = Number(btn.getAttribute("data-god-scale"));
          setGodModeTimeScale(val);
        });
      });
    }
    window.addEventListener("keydown", handleGodModeKey);
  }

  /** Updates the faux time multiplier when the player chooses a new speed. */
  function setGodModeTimeScale(scale) {
    if (!godModeState.unlocked) return;
    godModeState.timeScale = sanitizeTimeScale(scale, GOD_MODE_SCALES);
    godModeState.dirty = true;
    renderGodModePanel();
  }

  /** Reveals the hidden panel and resets state when the cheat code is typed. */
  function unlockGodMode() {
    if (godModeState.unlocked) return;
    godModeState.unlocked = true;
    godModeState.timeScale = GOD_MODE_SCALES[0];
    godModeState.dirty = true;
    renderGodModePanel(true);
  }

  /** Handles the secret key sequence logic needed to unlock the panel. */
  function handleGodModeKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }
    const result = updateCheatProgress(godModeState.buffer, event.key, godModeState.codeWord);
    godModeState.buffer = result.buffer;
    if (result.unlocked) {
      unlockGodMode();
    }
  }

  /** Shows or hides the god mode card depending on the unlock state. */
  function renderGodModePanel(force = false) {
    const card = DOM.godModeCard;
    if (!card) return;
    if (!godModeState.unlocked) {
      card.classList.add("hidden");
      card.setAttribute("aria-hidden", "true");
      card.inert = true;
      return;
    }
    if (!force && !godModeState.dirty) {
      return;
    }

    card.classList.remove("hidden");
    card.setAttribute("aria-hidden", "false");
    card.inert = false;
    if (DOM.godModeStatus) {
      DOM.godModeStatus.textContent = t("godMode.status", { scale: godModeState.timeScale });
    }
    card.querySelectorAll("[data-god-scale]").forEach(btn => {
      const val = Number(btn.getAttribute("data-god-scale"));
      btn.classList.toggle("active", val === godModeState.timeScale);
    });
    godModeState.dirty = false;
  }

  /** Returns the prestige multiplier contributed by culture points. */
  function prestigeMultiplier() {
    const culture = Math.max(0, gameState.resources.culturePoints || 0);
    if (EconomyAnalytics && typeof EconomyAnalytics.computePrestigeMultiplier === "function") {
      try {
        const sharedMultiplier = EconomyAnalytics.computePrestigeMultiplier(culture);
        if (Number.isFinite(sharedMultiplier) && sharedMultiplier >= 1) return sharedMultiplier;
      } catch {
        // Le moteur de jeu conserve la formule canonique en filet local.
      }
    }
    return 1 + 0.2 * Math.sqrt(culture);
  }

  /** Basic clamp helper between 0 and 1. */
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  window.__PE_DEBUG = window.__PE_DEBUG || {};
  window.__PE_DEBUG.spawnEvent = id => {
    if (!window.Events) return;
    const ev = window.Events.debugForceEvent(id);
    if (ev) {
      handleEventSpawn(ev);
    }
  };

  /**
   * Read-only bridge for the 3D campus scene (assets/js/scene/).
   * The scene polls this each frame instead of reaching into gameState:
   * the snapshot is a fresh plain object, so the renderer can never
   * mutate simulation state. Must stay cheap (called ~60x/s).
   */
  /**
   * Read-only bridge for the dashboard (assets/js/dashboard.js). Same
   * philosophy as __PE_SCENE__: a fresh plain snapshot per call, so the
   * dashboard can never mutate the simulation.
   */
  window.__PE_DASH__ = {
    format: formatNumber,
    getSnapshot: buildDashboardSnapshot,
    getHistory: analyticsHistoryEnvelope
  };

  window.__PE_SCENE__ = {
    getSnapshot() {
      return {
        buildings: gameState.buildings.map(b => ({
          id: b.id,
          quantity: b.quantity,
          unlocked: !!b.isUnlocked
        })),
        stats: {
          quality: gameState.stats.quality,
          footprint: gameState.stats.footprint,
          brandImage: gameState.stats.brandImage
        },
        culturePoints: gameState.resources.culturePoints
      };
    }
  };
})();
