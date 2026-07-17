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
    detailTab: "contracts"
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
      prestigeRequirement: 10000
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
    unlocked: false
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
    DOM.godModeCard = document.getElementById("godModeCard");
    DOM.godModeStatus = document.getElementById("godModeStatus");
    DOM.achievementsList = document.getElementById("achievementsList");
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
    if (closeEventModal(true)) {
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

  function openModalSurface(overlay, dialog) {
    if (overlay.__peCloseTimer) {
      clearTimeout(overlay.__peCloseTimer);
      overlay.__peCloseTimer = null;
    }
    overlay.classList.remove("hidden", "is-closing");
    if (dialog) dialog.classList.remove("is-closing");
    // Reflow forcé pour que la transition d'entrée parte de l'état repos.
    void overlay.offsetWidth;
    overlay.classList.add("is-open");
    if (dialog) dialog.classList.add("is-open");
  }

  function closeModalSurface(overlay, dialog) {
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
    if (restoreFocus && settingsState.lastTrigger && typeof settingsState.lastTrigger.focus === "function") {
      settingsState.lastTrigger.focus();
      settingsState.lastTrigger = null;
    }
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
      });
    }
    if (DOM.settingsSections && DOM.settingsSections.length) {
      DOM.settingsSections.forEach(sectionEl => {
        const match = sectionEl.getAttribute("data-settings-section") === section;
        sectionEl.classList.toggle("hidden", !match);
      });
    }
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
    }
    if (DOM.journalTab) {
      DOM.journalTab.classList.toggle("active", !showContracts);
      DOM.journalTab.setAttribute("aria-selected", !showContracts ? "true" : "false");
    }
    if (!showContracts && TutorialEngine && typeof TutorialEngine.markMilestone === "function") {
      TutorialEngine.markMilestone("journal");
    }
  }

  function handleRestartTutorial() {
    if (!Settings || !TutorialEngine) return;
    Settings.setPreference("tutorialEnabled", true);
    Settings.setPreference("tutorialCompleted", false);
    if (typeof TutorialEngine.restart === "function") {
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
    if (DOM.langSelect) {
      DOM.langSelect.setAttribute("aria-label", t("actions.languageLabel"));
    }
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

    applyPersistedState(Persistence.load ? Persistence.load() : null);

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
    gameState.time.lastUpdate = performance.now();
    requestAnimationFrame(gameLoop);
  }

  function buildPersistedState() {
    return {
      version: 1,
      resources: { ...gameState.resources },
      stats: { ...gameState.stats },
      buildings: gameState.buildings.map(b => ({ id: b.id, quantity: b.quantity })),
      upgrades: gameState.upgrades.map(u => ({ id: u.id, purchased: !!u.purchased })),
      achievements: achievementsState.unlocked
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

  function queueSave(force = false) {
    if (persistenceDisabled) return;
    if (!Persistence.isAvailable || !Persistence.isAvailable()) return;
    if (force) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      Persistence.save(buildPersistedState());
      return;
    }
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      Persistence.save(buildPersistedState());
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
      parts.push("⚙️ " + t("impact.doc") + " " + formatPercent(impact.docMultiplierBonus));
    }
    if (Math.abs(impact.ccMultiplierBonus) > EPSILON) {
      parts.push("⭐ " + t("impact.cc") + " " + formatPercent(impact.ccMultiplierBonus));
    }
    if (Math.abs(impact.qualityBonus) > EPSILON) {
      parts.push("✅ " + t("impact.quality") + " " + formatPercent(impact.qualityBonus));
    }
    if (Math.abs(impact.footprintBonus) > EPSILON) {
      parts.push("🌳 " + t("impact.footprint") + " " + formatPercent(impact.footprintBonus));
    }
    if (Math.abs(impact.imageBonus) > EPSILON) {
      parts.push("🏅 " + t("impact.image") + " " + formatPercent(impact.imageBonus));
    }

    return parts.join(" • ");
  }

  /** Hides every currently open building tooltip. */
  function hideAllTooltips() {
    document.querySelectorAll(".building-tooltip").forEach(el => {
      if (!el.classList.contains("hidden")) {
        el.classList.add("hidden");
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
    renderLog();
  }

  /** Aggregates all multiplicative bonuses currently active. */
  function computeMultipliers() {
    const buildingEffects = computeBuildingEffects(gameState.buildings);
    let docMult = buildingEffects.docMult;
    let ccMult = buildingEffects.ccMult;
    let clickMult = 1;
    let baseQualityOffset = 0;

    // Passive stat nudge from infrastructure.
    gameState.stats.quality += buildingEffects.qualityBonus * 0.0001;
    gameState.stats.footprint -= buildingEffects.footprintBonus * 0.0001;
    gameState.stats.brandImage += buildingEffects.imageBonus * 0.0001;

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
      baseQualityOffset
    };
  }

  /** Computes automatic production per second. */
  function computeDocPerSecond() {
    const mults = computeMultipliers();
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

    const scaledDt = dt * currentTimeScale();
    update(scaledDt);
    renderAll();
    gameState.time.lastUpdate = timestamp;
    requestAnimationFrame(gameLoop);
  }

  /** Applies resource gains, drifts and unlock checks for a time delta. */
  function update(dt) {
    syncEventsPreference();
    const DOCps = computeDocPerSecond();
    const mults = computeMultipliers();

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
    maybeSpawnSmallEvents(dt);
    checkDynamicEvents(dt);
    tickContracts(dt);
    checkAchievements();
    queueSave();
  }

  /** introduces occasional incidents/optimisations to keep gauges dynamic. */
  function maybeSpawnSmallEvents(dt) {
    if (!eventState.eventsEnabled) return;
    const DOCps = computeDocPerSecond();
    const risk = Math.min(0.0005 * DOCps, 0.05);
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
  function handleClick() {
    const mults = computeMultipliers();
    const base = gameState.config.docPerClickBase;
    const docGain = base * mults.clickMult * prestigeMultiplier();
    gameState.resources.docBank += docGain;
    gameState.resources.docTotal += docGain;
    refreshUpgradeUnlocks();
    checkAchievements();
    queueSave();
    renderAll();
    if (DOM.clickButton) {
      DOM.clickButton.classList.add("pulse");
      setTimeout(() => DOM.clickButton && DOM.clickButton.classList.remove("pulse"), 350);
    }
    UIEffects.playClickEffect(DOM.clickButton);
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
    UIEffects.playPurchaseEffect(sourceEl || DOM.buildingsList);
    if (TutorialEngine && typeof TutorialEngine.markMilestone === "function") {
      TutorialEngine.markMilestone("building");
    }
    if (FINAL_BUILDING_ID && b.id === FINAL_BUILDING_ID && previousQuantity === 0) {
      UIEffects.playCelebrationEffect("finale");
      logMessage("log.finalBuilding", { name: getBuildingName(b) });
    }
  }

  /** Purchases an upgrade if affordable and unlocked. */
  function buyUpgrade(id) {
    const upg = gameState.upgrades.find(x => x.id === id);
    if (!upg || upg.purchased) return;
    if (gameState.resources.docBank < upg.cost) return;
    if (gameState.resources.docTotal < (upg.unlockDocTotal || 0)) return;

    gameState.resources.docBank -= upg.cost;
    upg.purchased = true;
    uiState.upgradesDirty = true;
    logMessage("log.buyUpgrade", { name: getUpgradeName(upg) });
    checkAchievements();
    queueSave();
    renderAll();
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

  /** Renders the live stats ribbons and gauges. */
  function renderStats() {
    const DOCps = computeDocPerSecond();
    if (DOM.docBank) DOM.docBank.textContent = formatNumber(gameState.resources.docBank);
    if (DOM.docTotal) DOM.docTotal.textContent = formatNumber(gameState.resources.docTotal);
    if (DOM.ccTotal) DOM.ccTotal.textContent = formatNumber(gameState.resources.ccTotal);
    if (DOM.docPs) DOM.docPs.textContent = t("stats.docPsValue", { amount: formatNumber(DOCps) });

    const q = clamp01(gameState.stats.quality);
    const f = clamp01(gameState.stats.footprint);
    const img = clamp01(gameState.stats.brandImage);

    if (DOM.qualityLabel) DOM.qualityLabel.textContent = Math.round(q * 100) + " %";
    if (DOM.footprintLabel) DOM.footprintLabel.textContent = Math.round(f * 100) + " %";
    if (DOM.imageLabel) DOM.imageLabel.textContent = Math.round(img * 100) + " %";

    if (DOM.qualityFill) DOM.qualityFill.style.width = (q * 100).toFixed(1) + "%";
    if (DOM.footprintFill) DOM.footprintFill.style.width = (f * 100).toFixed(1) + "%";
    if (DOM.imageFill) DOM.imageFill.style.width = (img * 100).toFixed(1) + "%";

    if (DOM.culturePoints) DOM.culturePoints.textContent = gameState.resources.culturePoints;
    if (DOM.prestigeMult) DOM.prestigeMult.textContent = prestigeMultiplier().toFixed(2);
  }

  /** Updates the prestige card state and CTA messaging. */
  function renderPrestige() {
    if (!DOM.prestigeButton || !DOM.prestigeInfo) return;
    const can = canPrestige();
    const gain = computePotentialCultureGain();
    const locale = LOCALE_BY_LANG[currentLang] || "fr-FR";
    const minValue = gameState.config.prestigeRequirement.toLocaleString(locale);

    if (!can || gain <= 0) {
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
    DOM.logPanel.innerHTML = "";
    const locale = LOCALE_BY_LANG[currentLang] || "fr-FR";
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
      DOM.contractsList.innerHTML = "";
      DOM.activeContractPanel.classList.add("hidden");
      return;
    }
    contractsState.available = window.EndgameModule.availableContracts(gameState);
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
    renderActiveContract();
    queueSave(true);
    renderContractsPanel();
  }

  function renderActiveContract() {
    if (!window.EndgameModule || !DOM.activeContractPanel) return;
    const { activeContract } = window.EndgameModule;
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
      renderActiveContract();
      queueSave(true);
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
    renderContractsPanel();
  }

  function canRerollContracts() {
    if (!contractsState.lastReroll) return true;
    return performance.now() - contractsState.lastReroll >= CONTRACT_REROLL_COOLDOWN;
  }

  function updateRerollButton() {
    if (!DOM.rerollContractsBtn) return;
    if (!window.EndgameModule) {
      DOM.rerollContractsBtn.disabled = true;
      return;
    }
    if (canRerollContracts()) {
      DOM.rerollContractsBtn.disabled = false;
      DOM.rerollContractsBtn.textContent = t("actions.rerollContracts");
      return;
    }
    const elapsed = performance.now() - contractsState.lastReroll;
    const remaining = Math.max(0, CONTRACT_REROLL_COOLDOWN - elapsed);
    DOM.rerollContractsBtn.disabled = true;
    DOM.rerollContractsBtn.textContent = t("contracts.rerollCountdown", {
      seconds: Math.max(1, Math.ceil(remaining / 1000))
    });
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
      const title = document.createElement("div");
      title.className = "achievement-title";
      title.innerHTML = `<span>${t(def.nameKey)}</span><span class="achievement-status">${t(unlockedAt ? "achievements.statusUnlocked" : "achievements.statusLocked")}</span>`;
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
      const btn = row.querySelector(`[data-building-btn="${id}"]`);
      if (btn) {
        btn.classList.toggle("disabled", !canAfford);
        btn.textContent = t(canAfford ? "actions.buy" : "actions.tooExpensive");
      }
      const costEl = row.querySelector(`[data-building-cost="${id}"]`);
      if (costEl) {
        costEl.textContent = t("label.costDoc", { amount: formatNumber(cost) });
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
      btn.textContent = t(canAfford ? "actions.buy" : "actions.tooExpensive");
    });
    container.querySelectorAll("[data-upgrade-cost]").forEach(costEl => {
      const id = costEl.getAttribute("data-upgrade-cost");
      const upgrade = gameState.upgrades.find(x => x.id === id);
      if (!upgrade) return;
      costEl.textContent = t("label.costDoc", { amount: formatNumber(upgrade.cost) });
    });
  }

  /** Renders the list of available buildings, descriptions and stats. */
  function renderBuildings() {
    const container = DOM.buildingsList;
    if (!container) return;
    hideAllTooltips();
    container.innerHTML = "";
    let hasVisible = false;

    for (const b of gameState.buildings) {
      if (!b.isUnlocked) continue;
      hasVisible = true;
      const cost = buildingCost(b);
      const totalProd = b.baseProduction * b.quantity;
      const perUnitImpact = formatBuildingImpactText(b, 1);
      const totalImpactText = b.quantity > 0 ? formatBuildingImpactText(b) : "";

      const row = document.createElement("div");
      row.className = "building-row";
      row.dataset.buildingId = b.id;

      const info = document.createElement("div");
      info.className = "building-info";

      const nameButton = document.createElement("button");
      nameButton.type = "button";
      nameButton.className = "building-name-button";
      const emoji = b.emoji || "🏗️";
      const emojiSpan = document.createElement("span");
      emojiSpan.className = "building-emoji";
      emojiSpan.textContent = emoji;
      const labelSpan = document.createElement("span");
      labelSpan.className = "building-name-label";
      labelSpan.textContent = getBuildingName(b);
      nameButton.appendChild(emojiSpan);
      nameButton.appendChild(labelSpan);

      const tooltip = document.createElement("div");
      tooltip.className = "building-tooltip hidden";
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
        } else {
          tooltip.classList.add("hidden");
        }
      });

      info.appendChild(nameButton);
      const qty = document.createElement("div");
      qty.className = "building-qty";
      qty.textContent = t("label.quantity", { count: b.quantity });
      info.appendChild(qty);

      const metaDesc = document.createElement("div");
      metaDesc.className = "building-meta";
      metaDesc.textContent = getBuildingDesc(b);
      info.appendChild(metaDesc);

      const productionMeta = document.createElement("div");
      productionMeta.className = "building-meta";
      const prodLines = [];
      prodLines.push(
        b.baseProduction
          ? t("label.productionPerUnit", { amount: formatNumber(b.baseProduction) })
          : t("label.modifierOnly")
      );
      prodLines.push(
        b.baseProduction && totalProd
          ? t("label.totalProduction", { amount: formatNumber(totalProd) })
          : t("label.totalProductionNA")
      );
      productionMeta.innerHTML = prodLines.join("<br>");
      info.appendChild(productionMeta);
      info.appendChild(tooltip);

      const buy = document.createElement("div");
      buy.className = "building-buy";

      const costEl = document.createElement("div");
      costEl.className = "small";
      costEl.dataset.buildingCost = b.id;
      costEl.textContent = t("label.costDoc", { amount: formatNumber(cost) });

      const btn = document.createElement("button");
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

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="upgrade-title">${getUpgradeName(u)}</div>
        <div>${getUpgradeDesc(u)}</div>
        <div class="small" data-upgrade-cost="${u.id}">${t("label.costDoc", { amount: formatNumber(u.cost) })}</div>
      `;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";

      const btn = document.createElement("button");
      btn.className = "btn-upgrade";
      btn.dataset.upgradeBtn = u.id;
      btn.textContent = t("actions.buy");
      btn.addEventListener("click", () => buyUpgrade(u.id));

      right.appendChild(btn);
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
    renderStats();
    renderPrestige();
    renderLog();
    renderContractsPanel();
    renderAchievementsPanel();
    renderGodModePanel();
    syncBuildingUnlocks();

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
      return;
    }
    if (!force && !godModeState.dirty) {
      return;
    }

    card.classList.remove("hidden");
    card.setAttribute("aria-hidden", "false");
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
        docPerSecond: computeDocPerSecond(),
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
