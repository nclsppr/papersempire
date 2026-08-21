(function(){
  const PREF_KEY = "pe-accessibility";
  const defaultPrefs = {
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    soundsEnabled: true,
    particlesEnabled: true,
    tutorialEnabled: true,
    tutorialCompleted: false,
    eventsEnabled: true,
    sceneEnabled: true
  };

  function loadPrefs() {
    try {
      const raw = window.localStorage.getItem(PREF_KEY);
      return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : { ...defaultPrefs };
    } catch {
      return { ...defaultPrefs };
    }
  }

  function savePrefs(prefs) {
    try {
      window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {
      // ignore quota errors
    }
  }

  function applyPrefs(prefs) {
    const root = document.documentElement;
    root.classList.toggle("pref-high-contrast", !!prefs.highContrast);
    root.classList.toggle("pref-large-text", !!prefs.largeText);
    root.classList.toggle("pref-reduce-motion", !!prefs.reduceMotion);
    root.dataset.soundsEnabled = prefs.soundsEnabled ? "1" : "0";
    root.dataset.particlesEnabled = prefs.particlesEnabled ? "1" : "0";
    root.dataset.sceneEnabled = prefs.sceneEnabled ? "1" : "0";
  }

  const toggleWatchers = [];

  function wireToggle(id, key, prefs) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!prefs[key];
    el.addEventListener("change", () => {
      prefs[key] = el.checked;
      applyPrefs(prefs);
      savePrefs(prefs);
      refreshToggles();
    });
    toggleWatchers.push(() => {
      if (document.body.contains(el)) {
        el.checked = !!prefs[key];
      }
    });
  }

  function init(prefs) {
    wireToggle("toggleHighContrast", "highContrast", prefs);
    wireToggle("toggleLargeText", "largeText", prefs);
    wireToggle("toggleReduceMotion", "reduceMotion", prefs);
    wireToggle("toggleSounds", "soundsEnabled", prefs);
    wireToggle("toggleParticles", "particlesEnabled", prefs);
    wireToggle("toggleTutorial", "tutorialEnabled", prefs);
    wireToggle("toggleEvents", "eventsEnabled", prefs);
    wireToggle("toggleScene", "sceneEnabled", prefs);
    refreshToggles();
  }

  function refreshToggles() {
    toggleWatchers.forEach(fn => fn());
  }

  /** Runs the decorative footer conveyor only while it can actually be seen. */
  function initFooterMotion() {
    const footer = document.querySelector(".app-footer");
    if (!footer) return;

    let isInView = false;
    const refresh = () => {
      footer.classList.toggle("footer-in-view", isInView && !document.hidden);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        isInView = entries.some(entry => entry.isIntersecting);
        refresh();
      }, { rootMargin: "80px 0px" });
      observer.observe(footer);
    } else {
      isInView = true;
      refresh();
    }

    document.addEventListener("visibilitychange", refresh);
  }

  const initialPrefs = loadPrefs();
  applyPrefs(initialPrefs);
  window.Settings = {
    getPrefs() {
      return { ...initialPrefs };
    },
    getPreference(key) {
      return initialPrefs[key];
    },
    setPreference(key, value) {
      initialPrefs[key] = value;
      applyPrefs(initialPrefs);
      savePrefs(initialPrefs);
      refreshToggles();
    },
    refresh() {
      refreshToggles();
    }
  };
  window.addEventListener("DOMContentLoaded", () => {
    init(initialPrefs);
    initFooterMotion();
  });
})();
