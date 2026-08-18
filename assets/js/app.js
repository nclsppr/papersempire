(() => {
  "use strict";

  /**
   * Cache of frequently accessed DOM nodes to avoid repeated lookups.
   * Filled once during initialization.
   */
  const DOM = {};

  const GAME_TITLE = window.GAME_TITLE || "Papers Empire";
  const { computeBuildingEffects, getBuildingImpact } = ModifierUtils;
  const { sanitizeTimeScale, updateCheatProgress } = GodModeUtils;
  const Events = window.Events;
  const Settings = window.Settings;
  const TutorialEngine = window.Tutorial;
  const UIEffects = window.UIEffects || {
    playPurchaseEffect() {},
    playUpgradeEffect() {},
    playContractEffect() {},
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
  const DOM_RENDER_INTERVAL_MS = 100;
  // Equivalent au rythme nominal historique à 60 Hz, mais désormais appliqué
  // une seule fois par tick et proportionnel au temps simulé.
  const INFRA_STAT_RATE_PER_SECOND = 0.024;
  const LOCALE_BY_LANG = { fr: "fr-FR", en: "en-US", de: "de-DE", lb: "lb-LU" };
  // Langue initiale, par priorité : ?lang=xx (bascule client partageable),
  // puis le préfixe de chemin des pages construites par langue (/en/, /de/,
  // /lb/), puis le français. PAS de navigator.language : la langue rendue
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
  let currentLang = (urlLang || pathLang || DEFAULT_LANG).slice(0, 2).toLowerCase();
  if (!SUPPORTED_LANGS.includes(currentLang)) {
    currentLang = DEFAULT_LANG;
  }

  /** Tracks which sections need a render refresh. */
  const uiState = {
    buildingsDirty: true,
    upgradesDirty: true,
    detailTab: "contracts",
    logRenderSignature: "",
    lastFrameRender: 0
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

  const achievementsState = {
    unlocked: {}
  };

  const eventState = {
    modalCanClose: false,
    bannerTone: "mixed",
    bannerKey: null,
    bannerParams: null,
    eventsEnabled: true
  };

  const contractsState = {
    available: [],
    rerollCount: 0,
    lastReroll: 0,
    unlocked: false,
    listRenderSignature: "",
    activeRenderSignature: ""
  };
  const CONTRACT_REROLL_COOLDOWN = 30000;
  const CONTRACTS_UNLOCK_DOC_TOTAL = 1500;

  let saveTimer = null;
  let bannerHideTimer = null;
  let persistenceDisabled = false;

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
    eventState.eventsEnabled = areEventsAllowed();
    initGame();
    initGodModeControls();
    initTutorialGuidance();
    initFlavorTicker();
    applyTimeOfDaySky();
    setInterval(applyTimeOfDaySky, 10 * 60 * 1000);
    greetConsoleVisitors();
  }

  /* Ticker d'ambiance : une ligne de vie d'atelier tourne en bas de
     la scène 3D (décorative, la scène est aria-hidden). L'index de
     départ est aléatoire pour que chaque session ouvre sur une
     anecdote différente. */
  const FLAVOR_KEYS = [
    "flavor.paperJam",
    "flavor.tonerLow",
    "flavor.coffee",
    "flavor.a4",
    "flavor.recto",
    "flavor.stapler"
  ];
  const FLAVOR_INTERVAL_MS = 22000;
  let flavorIndex = 0;

  function showFlavorLine(immediate = false) {
    const el = DOM.flavorLine;
    if (!el) return;
    const key = FLAVOR_KEYS[flavorIndex % FLAVOR_KEYS.length];
    el.dataset.i18nKey = key;
    if (immediate) {
      el.textContent = t(key);
      return;
    }
    el.classList.add("flavor-fading");
    setTimeout(() => {
      el.textContent = t(key);
      el.classList.remove("flavor-fading");
    }, 300);
  }

  function initFlavorTicker() {
    if (!DOM.flavorLine) return;
    flavorIndex = Math.floor(Math.random() * FLAVOR_KEYS.length);
    showFlavorLine(true);
    setInterval(() => {
      flavorIndex += 1;
      showFlavorLine();
    }, FLAVOR_INTERVAL_MS);
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
    DOM.machineUnlockPanel = document.getElementById("machineUnlockPanel");
    DOM.nextBuildingName = document.getElementById("nextBuildingName");
    DOM.nextBuildingCost = document.getElementById("nextBuildingCost");
    DOM.nextBuildingTrack = document.getElementById("nextBuildingTrack");
    DOM.prestigeButton = document.getElementById("prestigeButton");
    DOM.prestigeInfo = document.getElementById("prestigeInfo");
    DOM.buildingsList = document.getElementById("buildingsList");
    DOM.upgradesList = document.getElementById("upgradesList");
    DOM.logPanel = document.getElementById("logPanel");
    DOM.contractsTab = document.getElementById("contractsTab");
    DOM.journalTab = document.getElementById("journalTab");
    DOM.contractsPanel = document.getElementById("contractsPanel");
    DOM.journalPanel = document.getElementById("journalPanel");
    DOM.rerollContractsBtn = document.getElementById("rerollContractsBtn");
    DOM.contractsList = document.getElementById("contractsList");
    DOM.activeContractPanel = document.getElementById("activeContractPanel");
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
    DOM.eventBannerEmoji = document.getElementById("eventBannerEmoji");
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
  }

  /** Hooks click events to the main CTAs. */
  function bindUIEvents() {
    if (DOM.clickButton) {
      DOM.clickButton.addEventListener("click", handleClick);
    }
    if (DOM.heroClickButton) {
      DOM.heroClickButton.addEventListener("click", handleClick);
    }
    if (DOM.prestigeButton) {
      DOM.prestigeButton.addEventListener("click", () => {
        if (!canPrestige()) return;
        const gain = computePotentialCultureGain();
        if (gain <= 0) return;
        if (confirm(t("prestige.confirm", { gain }))) {
          doPrestige();
        }
      });
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

    document.addEventListener("click", event => {
      if (!event.target.closest(".building-name-button") && !event.target.closest(".building-tooltip")) {
        hideAllTooltips();
      }
    });

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
    hideAllTooltips();
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
      DOM.closeEventModal.setAttribute("aria-label", t("actions.close"));
    }
    if (DOM.flavorLine && DOM.flavorLine.dataset.i18nKey) {
      DOM.flavorLine.textContent = t(DOM.flavorLine.dataset.i18nKey);
    }
    applyGameTitle();
    renderGodModePanel(true);
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
    } catch {
      // ignore storage errors
    }
    location.reload();
  }

  /** Updates the current language and re-renders the UI. */
  function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) {
      lang = DEFAULT_LANG;
    }
    currentLang = lang;
    if (DOM.langSelect && DOM.langSelect.value !== lang) {
      DOM.langSelect.value = lang;
    }
    applyStaticTranslations();
    renderContractsPanel();
    document.documentElement.setAttribute("lang", lang);
    try {
      // La langue de base de l'URL est celle du chemin (/en/…) ou le français
      // sur / : on ne garde ?lang que quand il s'en écarte, pour des URLs
      // propres qui survivent au rechargement et au partage.
      const url = new URL(window.location.href);
      const baseLang = pathLang || DEFAULT_LANG;
      if (lang === baseLang) {
        url.searchParams.delete("lang");
      } else {
        url.searchParams.set("lang", lang);
      }
      window.history.replaceState(null, "", url);
    } catch {
      // environnements sans History API (file://) : on garde l'URL telle quelle
    }
    uiState.buildingsDirty = true;
    uiState.upgradesDirty = true;
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
      onComplete: () => logMessage("log.tutorialComplete"),
      autoStart: true
    });
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
    applyPersistedState(savedState);
    offlineReport = settleOfflineProgress(savedState);

    if (window.EndgameModule) {
      window.EndgameModule.loadData(gameState).then(() => {
        renderContractsPanel();
      });
    }

    uiState.buildingsDirty = true;
    uiState.upgradesDirty = true;
    refreshUpgradeUnlocks(true);
    logMessage("log.welcome");
    renderAll(true);
    showOfflineReport();
    gameState.time.lastUpdate = performance.now();
    requestAnimationFrame(gameLoop);
    // Autosave périodique (débouncé) : alimente aussi la page /dashboard/.
    setInterval(() => queueSave(), 5000);
  }

  function buildPersistedState() {
    return {
      version: 1,
      resources: { ...gameState.resources },
      stats: { ...gameState.stats },
      buildings: gameState.buildings.map(b => ({ id: b.id, quantity: b.quantity })),
      upgrades: gameState.upgrades.map(u => ({ id: u.id, purchased: !!u.purchased })),
      achievements: achievementsState.unlocked,
      lastSeen: Date.now()
    };
  }

  function applyPersistedState(saved) {
    if (!saved) return;
    // Migration des sauvegardes d'avant le renommage des identifiants
    // (imageVbs -> brandImage, vbsPortal -> clientPortal).
    if (saved.stats && "imageVbs" in saved.stats) {
      if (!("brandImage" in saved.stats)) {
        saved.stats.brandImage = saved.stats.imageVbs;
      }
      delete saved.stats.imageVbs;
    }
    if (Array.isArray(saved.buildings)) {
      for (const entry of saved.buildings) {
        if (entry && entry.id === "vbsPortal") {
          entry.id = "clientPortal";
        }
      }
    }
    if (saved.resources) {
      Object.assign(gameState.resources, saved.resources);
    }
    if (saved.stats) {
      Object.assign(gameState.stats, saved.stats);
    }
    if (Array.isArray(saved.buildings)) {
      for (const entry of saved.buildings) {
        const target = gameState.buildings.find(b => b.id === entry.id);
        if (target && typeof entry.quantity === "number") {
          target.quantity = entry.quantity;
          // isUnlocked is not persisted: keep owned buildings visible even
          // when the current bank is below their (grown) next-unit cost.
          if (target.quantity > 0) {
            target.isUnlocked = true;
          }
        }
      }
    }
    if (Array.isArray(saved.upgrades)) {
      for (const entry of saved.upgrades) {
        const target = gameState.upgrades.find(u => u.id === entry.id);
        if (target) {
          target.purchased = !!entry.purchased;
        }
      }
    }
    if (saved.achievements) {
      achievementsState.unlocked = { ...saved.achievements };
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
    const close = () => {
      closeModalSurface(modal, dialog);
      restoreModalFocus(modal);
      document.removeEventListener("keydown", onKey);
    };
    const onKey = event => {
      if (event.key === "Escape") close();
    };
    openModalSurface(modal, dialog);
    document.addEventListener("keydown", onKey);
    const closeBtn = document.getElementById("closeOfflineModal");
    const resumeBtn = document.getElementById("offlineResume");
    if (closeBtn) closeBtn.addEventListener("click", close, { once: true });
    if (resumeBtn) {
      resumeBtn.addEventListener("click", close, { once: true });
      resumeBtn.focus();
    }
    offlineReport = null;
    queueSave(true);
  }

  /** Écrit la sauvegarde ET le snapshot du dashboard : la page /dashboard/
      lit ce dernier via localStorage + événements storage (live inter-onglets). */
  function persistNow() {
    Persistence.save(buildPersistedState());
    try {
      window.localStorage.setItem("pe-dash-snapshot", JSON.stringify(window.__PE_DASH__.getSnapshot()));
    } catch {
      // quota plein : le jeu reste prioritaire, le dashboard vivra sans live
    }
  }

  function queueSave(force = false) {
    if (persistenceDisabled) return;
    if (!Persistence.isAvailable || !Persistence.isAvailable()) return;
    if (force) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      persistNow();
      return;
    }
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      persistNow();
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

    return parts.join(" • ");
  }

  /** Hides every currently open building tooltip. */
  function hideAllTooltips() {
    document.querySelectorAll(".building-tooltip").forEach(el => {
      if (!el.classList.contains("hidden")) {
        el.classList.add("hidden");
      }
      if (el.id) {
        const controller = document.querySelector(`[aria-controls="${el.id}"]`);
        if (controller) controller.setAttribute("aria-expanded", "false");
      }
    });
  }

  /** Unlocks buildings once the player holds enough DOC to buy the next unit. */
  function syncBuildingUnlocks() {
    let unlockedAny = false;
    const bank = gameState.resources.docBank;
    for (const b of gameState.buildings) {
      if (!b.isUnlocked && bank >= buildingCost(b)) {
        b.isUnlocked = true;
        unlockedAny = true;
      }
    }
    if (unlockedAny) {
      uiState.buildingsDirty = true;
    }
  }

  /** Returns the current cost of buying the next unit of a building. */
  function buildingCost(building) {
    return Math.floor(building.baseCost * Math.pow(building.costMultiplier, building.quantity));
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
    if (DOM.gameStatusAnnouncer) {
      setTextIfChanged(DOM.gameStatusAnnouncer, t(key, params));
    }
    renderLog();
  }

  /** Aggregates all multiplicative bonuses currently active. */
  function computeMultipliers() {
    const buildingEffects = computeBuildingEffects(gameState.buildings);
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

    return {
      docMult,
      ccMult,
      clickMult,
      baseQualityOffset,
      buildingEffects
    };
  }

  /** Computes automatic production per second. */
  function computeDocPerSecond(multipliers) {
    const mults = multipliers || computeMultipliers();
    let DOCps = 0;

    for (const b of gameState.buildings) {
      if (!b.baseProduction) continue;
      DOCps += b.baseProduction * b.quantity;
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

    const scaledDt = Math.min(dt, 5) * currentTimeScale();
    update(scaledDt);
    if (timestamp - uiState.lastFrameRender >= DOM_RENDER_INTERVAL_MS) {
      renderAll();
    }
    gameState.time.lastUpdate = timestamp;
    requestAnimationFrame(gameLoop);
  }

  /** Applies resource gains, drifts and unlock checks for a time delta. */
  function update(dt) {
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

    const ccGainPerSec =
      DOCps *
      (0.1 + clamp01(gameState.stats.quality) * 0.9) *
      (0.5 + clamp01(gameState.stats.brandImage) * 0.5) *
      mults.ccMult;

    const ccGain = ccGainPerSec * dt;
    gameState.resources.ccTotal += ccGain;

    const targetQualityBase = 0.3 + mults.baseQualityOffset + gameState.resources.culturePoints * 0.02;
    const targetQuality = clamp01(targetQualityBase);
    gameState.stats.quality += (targetQuality - gameState.stats.quality) * gameState.config.qualityRecoveryRate * dt;

    const targetImage = clamp01(0.4 + gameState.resources.culturePoints * 0.03);
    gameState.stats.brandImage += (targetImage - gameState.stats.brandImage) * gameState.config.imageRecoveryRate * dt;

    gameState.stats.footprint += gameState.config.footprintDriftBase * DOCps * dt;
    gameState.stats.footprint = clamp01(gameState.stats.footprint);

    refreshUpgradeUnlocks();
    maybeSpawnSmallEvents(dt, DOCps);
    checkDynamicEvents(dt);
    tickContracts(dt);
    checkAchievements();
    queueSave();
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
    const mults = computeMultipliers();
    const base = gameState.config.docPerClickBase;
    const docGain = base * mults.clickMult * prestigeMultiplier();
    gameState.resources.docBank += docGain;
    gameState.resources.docTotal += docGain;
    refreshUpgradeUnlocks();
    checkAchievements();
    queueSave();
    renderAll();
    const sourceButton = event && event.currentTarget ? event.currentTarget : DOM.clickButton;
    if (sourceButton) {
      sourceButton.classList.add("pulse");
      setTimeout(() => sourceButton.isConnected && sourceButton.classList.remove("pulse"), 350);
    }
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
    gameState.resources.docBank -= cost;
    const previousQuantity = b.quantity;
    b.quantity += 1;
    uiState.buildingsDirty = true;
    notifyScene("purchase", b.id);
    logMessage("log.buyBuilding", { name: getBuildingName(b), total: b.quantity });
    refreshUpgradeUnlocks();
    checkAchievements();
    queueSave();
    renderAll();
    const installedRow = DOM.buildingsList
      ? DOM.buildingsList.querySelector(`[data-building-id="${id}"]`)
      : null;
    if (shouldRestoreFocus && installedRow) {
      const replacementButton = installedRow.querySelector(`[data-building-btn="${id}"]`);
      const focusTarget = replacementButton && !replacementButton.disabled
        ? replacementButton
        : installedRow.querySelector(".building-name-button");
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
    UIEffects.playPurchaseEffect(installedRow || sourceEl || DOM.buildingsList);
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
    gameState.resources.docBank -= upg.cost;
    upg.purchased = true;
    uiState.upgradesDirty = true;
    logMessage("log.buyUpgrade", { name: getUpgradeName(upg) });
    checkAchievements();
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
    UIEffects.playUpgradeEffect(DOM.upgradesList || sourceEl);
  }

  /** Whether the prestige reset is currently available. */
  function canPrestige() {
    return gameState.resources.ccTotal >= gameState.config.prestigeRequirement;
  }

  /** How much culture would be earned by prestiging right now. */
  function computePotentialCultureGain() {
    return Math.floor(Math.sqrt(gameState.resources.ccTotal / gameState.config.prestigeCcDivisor));
  }

  /** Executes the prestige reset flow and reinitialises the run. */
  function doPrestige() {
    if (!canPrestige()) return;
    const gain = computePotentialCultureGain();
    if (gain <= 0) return;

    notifyScene("prestige");
    gameState.resources.culturePoints += gain;
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
    }

    gameState.stats.quality = 0.5;
    gameState.stats.footprint = 0.5;
    gameState.stats.brandImage = 0.5;

    uiState.buildingsDirty = true;
    uiState.upgradesDirty = true;
    logMessage("log.prestige", { amount: gain });
    UIEffects.playCelebrationEffect("prestige");
    checkAchievements();
    queueSave(true);
    renderAll(true);
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

  /** Updates the real progression strip above the machine catalogue. */
  function renderOperationsStatus() {
    const activeTypes = gameState.buildings.filter(building => building.quantity > 0).length;
    setTextIfChanged(DOM.opsBuildingCount, activeTypes);

    if (!DOM.machineUnlockPanel) return;
    const nextBuilding = gameState.buildings.find(building => !building.isUnlocked);
    if (!nextBuilding) {
      DOM.machineUnlockPanel.classList.add("is-complete");
      setTextIfChanged(DOM.nextBuildingName, t("operations.allMachinesUnlocked"));
      setTextIfChanged(DOM.nextBuildingCost, t("operations.catalogueComplete"));
      if (DOM.nextBuildingTrack) {
        if (DOM.nextBuildingTrack.value !== 100) DOM.nextBuildingTrack.value = 100;
        setTextIfChanged(DOM.nextBuildingTrack, "100 %");
        DOM.nextBuildingTrack.setAttribute("aria-label", t("operations.catalogueComplete"));
      }
      return;
    }

    DOM.machineUnlockPanel.classList.remove("is-complete");
    const nextCost = buildingCost(nextBuilding);
    const progress = Math.max(0, Math.min(100, gameState.resources.docBank / Math.max(1, nextCost) * 100));
    setTextIfChanged(DOM.nextBuildingName, getBuildingName(nextBuilding));
    setTextIfChanged(DOM.nextBuildingCost, t("operations.nextMachineCost", { amount: formatNumber(nextCost) }));
    if (DOM.nextBuildingTrack) {
      const progressValue = Number(progress.toFixed(1));
      if (DOM.nextBuildingTrack.value !== progressValue) DOM.nextBuildingTrack.value = progressValue;
      setTextIfChanged(DOM.nextBuildingTrack, Math.round(progress) + " %");
      DOM.nextBuildingTrack.setAttribute("aria-label", t("operations.nextMachineProgress", {
        name: getBuildingName(nextBuilding),
        percent: Math.round(progress)
      }));
    }
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

    const q = clamp01(gameState.stats.quality);
    const f = clamp01(gameState.stats.footprint);
    const img = clamp01(gameState.stats.brandImage);

    setTextIfChanged(DOM.qualityLabel, Math.round(q * 100) + " %");
    setTextIfChanged(DOM.footprintLabel, Math.round(f * 100) + " %");
    setTextIfChanged(DOM.imageLabel, Math.round(img * 100) + " %");

    setWidthIfChanged(DOM.qualityFill, (q * 100).toFixed(1) + "%");
    setWidthIfChanged(DOM.footprintFill, (f * 100).toFixed(1) + "%");
    setWidthIfChanged(DOM.imageFill, (img * 100).toFixed(1) + "%");

    setTextIfChanged(DOM.culturePoints, gameState.resources.culturePoints);
    setTextIfChanged(DOM.prestigeMult, formattedPrestige);
    renderOperationsStatus();
  }

  /** Updates the prestige card state and CTA messaging. */
  function renderPrestige() {
    if (!DOM.prestigeButton || !DOM.prestigeInfo) return;
    const can = canPrestige();
    const gain = computePotentialCultureGain();
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
      DOM.prestigeInfo.textContent = t("prestige.infoAvailable", { gain });
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
    if (bannerHideTimer) {
      clearTimeout(bannerHideTimer);
      bannerHideTimer = null;
    }
    DOM.eventBanner.classList.remove("hidden");
    requestAnimationFrame(() => {
      if (DOM.eventBanner) {
        DOM.eventBanner.classList.add("banner-visible");
      }
    });
  }

  function hideEventBanner() {
    if (!DOM.eventBanner || DOM.eventBanner.classList.contains("hidden")) return;
    DOM.eventBanner.classList.remove("banner-visible");
    eventState.bannerKey = null;
    eventState.bannerParams = null;
    eventState.bannerTone = "mixed";
    refreshEventBanner();
    if (bannerHideTimer) {
      clearTimeout(bannerHideTimer);
    }
    bannerHideTimer = setTimeout(() => {
      if (DOM.eventBanner && !DOM.eventBanner.classList.contains("banner-visible")) {
        DOM.eventBanner.classList.add("hidden");
      }
    }, 280);
  }

  function refreshEventBanner() {
    if (!DOM.eventBanner) return;
    DOM.eventBanner.classList.remove("banner-positive", "banner-mixed", "banner-negative");
    if (!eventState.bannerKey) {
      if (DOM.eventBannerText) DOM.eventBannerText.textContent = "";
      if (DOM.eventBannerEmoji) DOM.eventBannerEmoji.textContent = "";
      return;
    }
    const tone = eventState.bannerTone || "mixed";
    const cls = tone === "positive" ? "banner-positive" : tone === "negative" ? "banner-negative" : "banner-mixed";
    DOM.eventBanner.classList.add(cls);
    const text = t(eventState.bannerKey, eventState.bannerParams || {});
    if (DOM.eventBannerText) {
      DOM.eventBannerText.textContent = text;
    }
    if (DOM.eventBannerEmoji) {
      DOM.eventBannerEmoji.textContent = getBannerEmoji(tone);
    }
  }

  function getBannerEmoji(tone) {
    if (tone === "positive") return "✨";
    if (tone === "negative") return "⚠️";
    return "🔔";
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
      closeEventModal(true);
      hideEventBanner();
    }
  }

  function checkDynamicEvents(dt) {
    if (!eventState.eventsEnabled) return;
    if (!window.Events) return;
    if (TutorialEngine && typeof TutorialEngine.isActive === "function" && TutorialEngine.isActive()) return;
    if (offlineReport || isModalSurfaceOpen(DOM.settingsModal) ||
        isModalSurfaceOpen(DOM.offlineModal)) return;
    const newEvent = Events.tick(gameState, dt);
    if (newEvent) {
      logMessage("log.event", { name: t(newEvent.titleKey) });
      handleEventSpawn(newEvent);
    }
  }

  function handleEventSpawn(eventDef) {
    if (!eventState.eventsEnabled) return;
    eventState.active = eventDef;
    eventState.modalCanClose = false;
    notifyScene("event", eventDef.id);
    showEventModal(eventDef);
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
    DOM.closeEventModal.disabled = true;
    DOM.closeEventModal.setAttribute("aria-disabled", "true");
    if (eventDef.type === "choice") {
      DOM.eventChoices.classList.remove("hidden");
      DOM.minigameContainer.classList.add("hidden");
      for (const choice of eventDef.choices) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event-choice-btn";
        btn.dataset.choice = choice.id;
        btn.textContent = t(choice.labelKey);
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
    closeModalSurface(DOM.eventModal, DOM.eventDialog);
    DOM.eventModal.setAttribute("aria-hidden", "true");
    restoreModalFocus(DOM.eventModal);
    schedulePendingOfflineReport();
    return true;
  }

  function handleEventChoiceClick(event) {
    const btn = event.target.closest("[data-choice]");
    if (!btn) return;
    const choiceId = btn.dataset.choice;
    const result = Events.resolveChoice(choiceId, gameState);
    if (!result) return;
    DOM.eventResult.textContent = t(result.resultKey);
    logMessage("log.eventResult", { result: t(result.resultKey) });
    queueSave(true);
    eventState.active = null;
    eventState.modalCanClose = true;
    DOM.closeEventModal.disabled = false;
    DOM.closeEventModal.removeAttribute("aria-disabled");
    closeEventModal(true);
    showEventBanner(result.resultKey, result.tone || "mixed");
  }

  function renderContractsPanel() {
    updateRerollButton();
    if (!window.EndgameModule) return;
    if (!DOM.contractsList || !DOM.activeContractPanel) return;
    if (!contractsState.unlocked) {
      if (contractsState.listRenderSignature !== "locked") {
        DOM.contractsList.innerHTML = "";
        DOM.activeContractPanel.classList.add("hidden");
        contractsState.listRenderSignature = "locked";
        contractsState.activeRenderSignature = "locked";
      }
      return;
    }
    contractsState.available = window.EndgameModule.availableContracts(gameState);
    const listSignature = currentLang + "|" + contractsState.available.map(contract => contract.id).join(",");
    if (listSignature === contractsState.listRenderSignature) {
      renderActiveContract();
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
        const card = document.createElement("div");
        card.className = "contract-card";
        card.innerHTML = `
          <strong>${t(contract.nameKey)}</strong>
          <div>${t(contract.descKey)}</div>
          <div class="contract-requirements">${t("contracts.requirements", {
            quality: Math.round((contract.requirements.quality || 0) * 100),
            image: Math.round((contract.requirements.image || 0) * 100),
            volume: formatNumber(contract.requirements.volume || 0)
          })}</div>
        `;
        const actions = document.createElement("div");
        actions.className = "contract-actions";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-slim";
        btn.dataset.contract = contract.id;
        btn.textContent = t("contracts.start");
        actions.appendChild(btn);
        card.appendChild(actions);
        DOM.contractsList.appendChild(card);
      }
      DOM.contractsList.querySelectorAll("[data-contract]").forEach(btn => {
        btn.addEventListener("click", () => startContract(btn.dataset.contract));
      });
    }
    renderActiveContract();
  }

  function startContract(contractId) {
    if (!window.EndgameModule) return;
    const result = window.EndgameModule.startContract(contractId, gameState);
    if (!result || !result.ok) {
      const key = result && result.error === "requirements" ? "contracts.requirementsNotMet" : "contracts.alreadyRunning";
      alert(t(key));
      return;
    }
    logMessage("log.contractStart", { name: t(result.contract.nameKey) });
    queueSave(true);
    contractsState.listRenderSignature = "";
    contractsState.activeRenderSignature = "";
    renderContractsPanel();
    UIEffects.playContractEffect(DOM.dispatchPanel || DOM.activeContractPanel);
  }

  function renderActiveContract() {
    if (!window.EndgameModule || !DOM.activeContractPanel) return;
    const { activeContract } = window.EndgameModule;
    const activeSignature = activeContract.current
      ? currentLang + "|" + activeContract.current.id + "|" + Math.ceil(activeContract.timer)
      : currentLang + "|none";
    if (activeSignature === contractsState.activeRenderSignature) return;
    contractsState.activeRenderSignature = activeSignature;
    if (!activeContract.current) {
      DOM.activeContractPanel.classList.add("hidden");
      DOM.activeContractPanel.innerHTML = "";
      return;
    }
    DOM.activeContractPanel.classList.remove("hidden");
    DOM.activeContractPanel.innerHTML = `
      <div><strong>${t(activeContract.current.nameKey)}</strong></div>
      <div>${t("contracts.remaining", { seconds: Math.ceil(activeContract.timer) })}</div>
      <div>${t("contracts.reward", {
        doc: formatNumber(activeContract.current.reward.doc || 0),
        cc: formatNumber(activeContract.current.reward.cc || 0),
        cards: activeContract.current.reward.cards || 0
      })}</div>
    `;
  }

  function tickContracts(dt) {
    if (!window.EndgameModule) return;
    const result = window.EndgameModule.tickContract(dt, gameState);
    if (result) {
      logMessage("log.contractComplete", { name: t(result.nameKey) });
      showEventBanner("contracts.banner.completed", "positive", { name: t(result.nameKey) });
      if (UIEffects && typeof UIEffects.playHorn === "function") UIEffects.playHorn();
      queueSave(true);
      contractsState.listRenderSignature = "";
      contractsState.activeRenderSignature = "";
      renderContractsPanel();
    } else {
      renderActiveContract();
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
    const result = Events.resolveMinigame(answer, gameState);
    if (!result) return;
    DOM.eventResult.textContent = t(result.resultKey);
    logMessage("log.eventResult", { result: t(result.resultKey) });
    queueSave(true);
    eventState.active = null;
    eventState.modalCanClose = true;
    DOM.closeEventModal.disabled = false;
    DOM.closeEventModal.removeAttribute("aria-disabled");
    closeEventModal(true);
    showEventBanner(result.resultKey, result.tone || "mixed");
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
      Achievements.definitions.map(def => def.id + ":" + (achievementsState.unlocked[def.id] ? 1 : 0)).join(",");
    if (signature === achievementsState.renderSignature) return;
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
      if (unlockedAt) {
        // Visa tamponné (style.css ::after content: attr(data-stamp)) :
        // texte traduit, jamais en dur dans le CSS.
        item.setAttribute("data-stamp", t("achievements.stampVisa"));
      }
      // Tampon-badge illustré (images-todo P3), retiré silencieusement si absent.
      const badge = document.createElement("img");
      badge.className = "achievement-badge";
      badge.src = "/assets/images/achievement-" + def.id + ".png";
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
      item.appendChild(title);
      item.appendChild(desc);
      container.appendChild(item);
    }
  }

  function checkAchievements() {
    if (!window.Achievements) return;
    const unlockedMap = achievementsState.unlocked;
    const newly = Achievements.evaluate(gameState, unlockedMap);
    if (!newly.length) return;
    const now = Date.now();
    for (const id of newly) {
      unlockedMap[id] = now;
      const def = Achievements.definitions.find(d => d.id === id);
      if (def) {
        logMessage("log.achievement", { name: t(def.nameKey) });
      }
    }
    UIEffects.playCelebrationEffect("achievement");
    renderAchievementsPanel();
    queueSave(true);
  }

  /** Toggles the affordability state for each building action button. */
  function updateBuildingButtons() {
    const container = DOM.buildingsList;
    if (!container) return;
    const bank = gameState.resources.docBank;
    container.querySelectorAll("[data-building-id]").forEach(row => {
      const id = row.getAttribute("data-building-id");
      const building = gameState.buildings.find(x => x.id === id);
      if (!building) return;
      const cost = buildingCost(building);
      const canAfford = bank >= cost;
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
      }
      const costEl = row.querySelector(`[data-building-cost="${id}"]`);
      if (costEl) {
        setTextIfChanged(costEl, t("label.costDoc", { amount: formatNumber(cost) }));
      }
    });
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
    hideAllTooltips();
    container.innerHTML = "";
    let hasVisible = false;

    for (const [buildingIndex, b] of gameState.buildings.entries()) {
      if (!b.isUnlocked) continue;
      hasVisible = true;
      const cost = buildingCost(b);
      const totalProd = b.baseProduction * b.quantity;
      const perUnitImpact = formatBuildingImpactText(b, 1);
      const totalImpactText = b.quantity > 0 ? formatBuildingImpactText(b) : "";

      const row = document.createElement("div");
      row.className = "building-row" + (b.quantity > 0 ? " is-owned" : "");
      row.dataset.buildingId = b.id;

      const sequence = document.createElement("span");
      sequence.className = "building-sequence";
      sequence.setAttribute("aria-hidden", "true");
      sequence.textContent = "PLAN " + String(buildingIndex + 1).padStart(2, "0");
      row.appendChild(sequence);

      const info = document.createElement("div");
      info.className = "building-info";

      const nameButton = document.createElement("button");
      nameButton.type = "button";
      nameButton.className = "building-name-button";
      nameButton.setAttribute("aria-expanded", "false");
      const emoji = b.emoji || "🏗️";
      const emojiSpan = document.createElement("span");
      emojiSpan.className = "building-emoji";
      // Sticker illustré (images-todo P2) avec repli emoji si absent/404.
      const sticker = document.createElement("img");
      sticker.className = "building-sticker";
      sticker.src = "/assets/images/building-" + b.id + ".webp";
      sticker.alt = "";
      sticker.decoding = "async";
      sticker.loading = "lazy";
      sticker.addEventListener("error", () => {
        sticker.remove();
        emojiSpan.textContent = emoji;
      }, { once: true });
      emojiSpan.appendChild(sticker);
      const labelSpan = document.createElement("span");
      labelSpan.className = "building-name-label";
      labelSpan.textContent = getBuildingName(b);
      nameButton.appendChild(emojiSpan);
      nameButton.appendChild(labelSpan);

      const tooltip = document.createElement("div");
      tooltip.className = "building-tooltip hidden";
      tooltip.id = "building-details-" + b.id;
      nameButton.setAttribute("aria-controls", tooltip.id);
      const tooltipLines = [];
      if (perUnitImpact) {
        tooltipLines.push(t("label.modifierPerUnit", { impact: perUnitImpact }));
      } else {
        tooltipLines.push(t("label.modifierPerUnitNA"));
      }
      if (totalImpactText) {
        tooltipLines.push(t("label.modifierTotal", { impact: totalImpactText }));
      } else {
        tooltipLines.push(t("label.modifierImpactNA"));
      }
      tooltip.innerHTML = tooltipLines.join("<br>");

      nameButton.addEventListener("click", event => {
        event.stopPropagation();
        const wasHidden = tooltip.classList.contains("hidden");
        hideAllTooltips();
        if (wasHidden) {
          tooltip.classList.remove("hidden");
          nameButton.setAttribute("aria-expanded", "true");
        } else {
          tooltip.classList.add("hidden");
          nameButton.setAttribute("aria-expanded", "false");
        }
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
        ? formatNumber(b.baseProduction) + " ×" + b.quantity + " = " +
          formatNumber(totalProd || 0) + " DOC/s"
        : t("label.modifierOnly");
      info.appendChild(productionMeta);
      info.appendChild(tooltip);

      const buy = document.createElement("div");
      buy.className = "building-buy";

      const costEl = document.createElement("div");
      costEl.className = "building-cost";
      costEl.dataset.buildingCost = b.id;
      costEl.textContent = t("label.costDoc", { amount: formatNumber(cost) });

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-buy";
      btn.dataset.buildingBtn = b.id;
      btn.textContent = t("actions.buy");
      btn.addEventListener("click", () => buyBuilding(b.id, btn));

      buy.appendChild(costEl);
      buy.appendChild(btn);

      row.appendChild(info);
      row.appendChild(buy);
      container.appendChild(row);
    }

    if (!hasVisible) {
      container.innerHTML = `<div class="building-placeholder">${t("buildings.noneAffordable")}</div>`;
    }
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
    return 1 + gameState.resources.culturePoints * 0.05;
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
    getSnapshot() {
      const mults = computeMultipliers();
      const prestige = prestigeMultiplier();
      return {
        docPerSecond: computeDocPerSecond(mults),
        docBank: gameState.resources.docBank,
        docTotal: gameState.resources.docTotal,
        ccTotal: gameState.resources.ccTotal,
        culturePoints: gameState.resources.culturePoints,
        prestigeMult: prestige,
        buildingCount: gameState.buildings.reduce((sum, b) => sum + b.quantity, 0),
        stats: {
          quality: gameState.stats.quality,
          footprint: gameState.stats.footprint,
          brandImage: gameState.stats.brandImage
        },
        buildings: gameState.buildings.map(b => ({
          id: b.id,
          nameKey: b.nameKey,
          quantity: b.quantity,
          production: (b.baseProduction || 0) * b.quantity * mults.docMult * prestige
        }))
      };
    }
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
