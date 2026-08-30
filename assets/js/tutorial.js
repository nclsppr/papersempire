(function(){
  const state = {
    steps: [],
    translate: key => key,
    settings: null,
    overlay: null,
    titleEl: null,
    bodyEl: null,
    stepEl: null,
    nextBtn: null,
    prevBtn: null,
    skipBtn: null,
    activeIndex: -1,
    started: false,
    highlightEl: null,
    onComplete: null,
    onBeforeHighlight: null,
    pendingAutoStart: false,
    returnFocus: null
  };

  document.addEventListener("DOMContentLoaded", () => {
    state.overlay = document.getElementById("tutorialOverlay");
    if (!state.overlay) return;
    state.titleEl = document.getElementById("tutorialTitle");
    state.bodyEl = document.getElementById("tutorialBody");
    state.stepEl = document.getElementById("tutorialStep");
    state.nextBtn = document.getElementById("tutorialNext");
    state.prevBtn = document.getElementById("tutorialPrev");
    state.skipBtn = document.getElementById("tutorialSkip");
    document.addEventListener("keydown", trapTutorialTab, true);

    if (state.nextBtn) {
      state.nextBtn.addEventListener("click", () => advanceStep(1));
    }
    if (state.prevBtn) {
      state.prevBtn.addEventListener("click", () => advanceStep(-1));
    }
    if (state.skipBtn) {
      state.skipBtn.addEventListener("click", () => skip(true));
    }
    if (state.pendingAutoStart) {
      state.pendingAutoStart = false;
      maybeStart();
    }
  });

  function configure(options = {}) {
    state.steps = options.steps || [];
    state.translate = typeof options.translate === "function" ? options.translate : key => key;
    state.settings = options.settings || null;
    state.onComplete = options.onComplete || null;
    state.onBeforeHighlight = typeof options.onBeforeHighlight === "function"
      ? options.onBeforeHighlight
      : null;
    if (options.autoStart) {
      if (state.overlay) {
        maybeStart();
      } else {
        state.pendingAutoStart = true;
      }
    }
  }

  function maybeStart() {
    if (shouldRun()) {
      start(true);
    }
  }

  function shouldRun() {
    if (!state.settings) return false;
    const prefs = state.settings.getPrefs ? state.settings.getPrefs() : {};
    return !!prefs.tutorialEnabled && !prefs.tutorialCompleted;
  }

  function start(force = false) {
    if (!state.overlay || !state.steps.length) return;
    if (!force && !shouldRun()) return;
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== document.body && !state.overlay.contains(activeElement)) {
      state.returnFocus = activeElement;
    }
    state.started = true;
    state.activeIndex = -1;
    state.overlay.inert = false;
    state.overlay.setAttribute("aria-hidden", "false");
    state.overlay.classList.remove("hidden");
    goToStep(0);
    requestAnimationFrame(() => {
      if (state.started && state.nextBtn && state.nextBtn.isConnected) {
        state.nextBtn.focus({ preventScroll: true });
      }
    });
  }

  function restart() {
    if (state.settings) {
      state.settings.setPreference("tutorialCompleted", false);
      state.settings.setPreference("tutorialEnabled", true);
    }
    start(true);
  }

  function skip(markCompleted = false) {
    if (!state.overlay) return;
    removeHighlight();
    state.started = false;
    state.overlay.inert = true;
    state.overlay.setAttribute("aria-hidden", "true");
    state.overlay.classList.add("hidden");
    restoreFocus();
    if (markCompleted && state.settings) {
      state.settings.setPreference("tutorialCompleted", true);
    }
  }

  function advanceStep(direction) {
    if (!state.started) return;
    const nextIndex = state.activeIndex + direction;
    goToStep(nextIndex);
  }

  function trapTutorialTab(event) {
    if (event.key !== "Tab" || !state.started) return;
    const controls = [state.prevBtn, state.nextBtn, state.skipBtn].filter(element => {
      return element && !element.disabled && element.getClientRects().length > 0;
    });
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!state.overlay.contains(document.activeElement)) {
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

  function restoreFocus() {
    const target = state.returnFocus;
    state.returnFocus = null;
    const current = document.activeElement;
    if (current && current !== document.body && current !== document.documentElement &&
        !state.overlay.contains(current)) {
      return;
    }
    if (target && target.isConnected && !target.disabled && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }

  function goToStep(index) {
    if (!state.steps.length) return;
    if (index >= state.steps.length) {
      complete();
      return;
    }
    state.activeIndex = Math.max(0, index);
    const step = state.steps[state.activeIndex];
    if (!step) return;
    updateCopy(step);
    highlight(step.selector);
    updateNavButtons();
  }

  function updateCopy(step) {
    if (state.stepEl) {
      state.stepEl.textContent = state.translate("tutorial.stepLabel", {
        current: state.activeIndex + 1,
        total: state.steps.length
      });
    }
    if (state.titleEl) {
      state.titleEl.textContent = state.translate(step.titleKey);
    }
    if (state.bodyEl) {
      state.bodyEl.textContent = state.translate(step.bodyKey);
    }
    if (state.nextBtn) {
      const isLast = state.activeIndex === state.steps.length - 1;
      const key = isLast ? "actions.finish" : "actions.next";
      state.nextBtn.textContent = state.translate(key);
    }
  }

  function updateNavButtons() {
    if (state.prevBtn) {
      state.prevBtn.disabled = state.activeIndex === 0;
    }
  }

  function highlight(selector) {
    removeHighlight();
    if (!selector) return;
    if (state.onBeforeHighlight) state.onBeforeHighlight(selector);
    const target = document.querySelector(selector);
    if (!target) return;
    state.highlightEl = target;
    target.classList.add("tutorial-highlight");
    if (typeof target.scrollIntoView === "function") {
      const reduceMotion = document.documentElement.classList.contains("pref-reduce-motion") ||
        (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
  }

  function removeHighlight() {
    if (state.highlightEl) {
      state.highlightEl.classList.remove("tutorial-highlight");
      state.highlightEl = null;
    }
  }

  function markMilestone(id) {
    if (!state.started) return;
    const step = state.steps[state.activeIndex];
    if (step && step.milestone === id) {
      goToStep(state.activeIndex + 1);
    }
  }

  function complete() {
    if (!state.overlay) return;
    state.started = false;
    state.overlay.inert = true;
    state.overlay.setAttribute("aria-hidden", "true");
    state.overlay.classList.add("hidden");
    removeHighlight();
    restoreFocus();
    if (state.settings) {
      state.settings.setPreference("tutorialCompleted", true);
    }
    if (typeof state.onComplete === "function") {
      state.onComplete();
    }
  }

  window.Tutorial = {
    configure,
    maybeStart,
    start,
    skip,
    restart,
    markMilestone,
    isActive() {
      return !!state.started;
    }
  };
  window.__PE_DEBUG = window.__PE_DEBUG || {};
  window.__PE_DEBUG.tutorial = {
    state,
    forceStart: () => start(true)
  };
})();
