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
    returnFocus: null,
    describedTarget: null,
    previousDescription: null,
    positionFrame: 0,
    focusPending: false
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
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && state.started && !event.defaultPrevented) {
        event.preventDefault();
        skip(false);
      }
    });
    // Browser scroll restoration and late page layout can run after the first
    // highlight. Reconcile from geometry after those lifecycle events.
    window.addEventListener("load", () => queuePosition());
    window.addEventListener("pageshow", () => queuePosition());
    window.addEventListener("resize", () => queuePosition());
    if (window.visualViewport) window.visualViewport.addEventListener("resize", () => queuePosition());

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
    const control = highlightedControl();
    if (control) {
      state.describedTarget = control;
      state.previousDescription = control.getAttribute("aria-describedby");
      const ids = new Set((state.previousDescription || "").split(/\s+/).filter(Boolean));
      ids.add("tutorialBody");
      control.setAttribute("aria-describedby", [...ids].join(" "));
    }
    if (typeof target.scrollIntoView === "function") {
      // Instant positioning avoids a smooth scroll racing with reload/history
      // restoration. The next frame clamps the action above the coach card.
      target.scrollIntoView({ behavior: "instant", block: "center" });
    }
    queuePosition(true);
  }

  function highlightedControl() {
    const target = state.highlightEl;
    if (!target) return null;
    const controls = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)";
    if (target.matches(controls)) return target;
    return target.querySelector("[data-building-btn]:not(:disabled)") || target.querySelector(controls);
  }

  function positionHighlightedTarget() {
    if (!state.started || !state.highlightEl || !state.highlightEl.isConnected) return;
    const target = highlightedControl() || state.highlightEl;
    const rect = target.getBoundingClientRect();
    const card = state.overlay.querySelector(".tutorial-card")?.getBoundingClientRect();
    const header = document.querySelector(".app-header")?.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const top = Math.max(viewportTop, header?.bottom || 0) + 12;
    let bottom = viewportTop + (viewport?.height || window.innerHeight) - 12;
    if (card && rect.left < card.right && rect.right > card.left) bottom = Math.min(bottom, card.top - 12);
    const height = Math.max(1, bottom - top);
    let desiredTop = rect.top;
    if (rect.top < top || rect.height > height) desiredTop = top;
    else if (rect.bottom > bottom) desiredTop = bottom - rect.height;
    if (Math.abs(rect.top - desiredTop) > 1) window.scrollBy({ top: rect.top - desiredTop, left: 0, behavior: "instant" });
  }

  function queuePosition(focus = false) {
    if (!state.started || !state.highlightEl) return;
    state.focusPending = state.focusPending || focus;
    if (state.positionFrame) return;
    state.positionFrame = requestAnimationFrame(() => {
      state.positionFrame = 0;
      positionHighlightedTarget();
      if (state.focusPending && state.started) {
        state.focusPending = false;
        const control = highlightedControl() || state.nextBtn;
        if (control?.isConnected) control.focus({ preventScroll: true });
      }
      // One layout frame also covers restored scroll and the newly revealed
      // mobile panel. This is bounded; it never follows ordinary user scrolling.
      state.positionFrame = requestAnimationFrame(() => {
        state.positionFrame = 0;
        positionHighlightedTarget();
      });
    });
  }

  function removeHighlight() {
    if (state.positionFrame) cancelAnimationFrame(state.positionFrame);
    state.positionFrame = 0;
    state.focusPending = false;
    if (state.describedTarget) {
      if (state.previousDescription === null) state.describedTarget.removeAttribute("aria-describedby");
      else state.describedTarget.setAttribute("aria-describedby", state.previousDescription);
      state.describedTarget = null;
      state.previousDescription = null;
    }
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
