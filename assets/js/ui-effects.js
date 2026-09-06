(function(){
  let audioCtx = null;
  let audioUnlocked = false;
  let activePaperCues = 0;
  const MAX_PAPER_CUES = 18;
  const PRESS_FEED_DURATION = 510;
  const pressFeedTimers = new WeakMap();
  const classTimers = new WeakMap();

  const SOUND_PRESETS = {
    click: { freq: 360, duration: 0.08 },
    purchase: { freq: 520, duration: 0.12 },
    upgrade: { freq: 590, duration: 0.14 },
    contract: { freq: 430, duration: 0.13 },
    celebration: { freq: 640, duration: 0.3 },
    achievement: { freq: 780, duration: 0.18 }
  };

  const CELEBRATION_VARIANTS = {
    achievement: {
      count: 14,
      layout: "burst",
      classes: ["confetti confetti-paper", "confetti confetti-gold", "confetti confetti-orange"],
      sound: "achievement",
      lifetime: 900
    },
    milestone: {
      count: 18,
      layout: "burst",
      classes: ["confetti confetti-paper", "confetti confetti-orange", "confetti confetti-steel"],
      sound: "achievement",
      lifetime: 1000
    },
    career: {
      count: 20,
      layout: "burst",
      classes: [
        "confetti confetti-paper",
        "confetti confetti-gold",
        "confetti confetti-orange",
        "confetti confetti-steel"
      ],
      sound: "celebration",
      lifetime: 1300
    },
    finale: {
      count: 44,
      layout: "rain",
      classes: [
        "confetti confetti-paper",
        "confetti confetti-orange",
        "confetti confetti-gold",
        "confetti confetti-steel"
      ],
      sound: "celebration",
      lifetime: 2300
    },
    prestige: {
      count: 48,
      layout: "rain",
      classes: [
        "confetti confetti-gold",
        "confetti confetti-paper",
        "confetti confetti-orange"
      ],
      sound: "celebration",
      lifetime: 2700
    }
  };

  function prefersReducedMotion() {
    if (document.documentElement.classList.contains("pref-reduce-motion")) return true;
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function canCreateMotion() {
    return !document.hidden && !prefersReducedMotion();
  }

  function canCreateParticles() {
    return canCreateMotion() && document.documentElement.dataset.particlesEnabled !== "0";
  }

  function ensureAudio() {
    if (typeof window === "undefined" || !audioUnlocked) return null;
    if (audioCtx) return audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  }

  function unlockAudio() {
    audioUnlocked = true;
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
  }

  function playTone(frequency, duration = 0.12) {
    if (document.documentElement.dataset.soundsEnabled === "0" || document.hidden) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.value = 0.16;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.stop(now + duration);
  }

  function playSound(name) {
    const preset = SOUND_PRESETS[name] || SOUND_PRESETS.click;
    playTone(preset.freq, preset.duration);
  }

  function playHorn() {
    playTone(233, 0.16);
    setTimeout(function () {
      if (!document.hidden) playTone(196, 0.24);
    }, 150);
  }

  function getUsableRect(target) {
    if (!target || !target.isConnected || typeof target.getBoundingClientRect !== "function") return null;
    const rect = target.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return rect;
  }

  function createPaperCue(target, index) {
    if (activePaperCues >= MAX_PAPER_CUES) return;
    const rect = getUsableRect(target);
    if (!rect) return;
    const cue = document.createElement("span");
    cue.className = "paper-cue";
    cue.setAttribute("aria-hidden", "true");
    const offset = (index - 2) * 9;
    cue.style.left = Math.round(rect.left + rect.width / 2 - 9 + offset) + "px";
    cue.style.top = Math.round(rect.top + rect.height / 2 - 12) + "px";
    cue.style.setProperty("--cue-x", (offset * 0.7) + "px");
    cue.style.setProperty("--cue-r", ((index % 2 ? 1 : -1) * (6 + index * 2)) + "deg");
    document.body.appendChild(cue);
    activePaperCues += 1;
    let removed = false;
    const cleanup = function () {
      if (removed) return;
      removed = true;
      cue.remove();
      activePaperCues = Math.max(0, activePaperCues - 1);
    };
    cue.addEventListener("animationend", cleanup, { once: true });
    setTimeout(cleanup, 750);
  }

  function retriggerClass(target, className, duration) {
    if (!target || !target.isConnected || !canCreateMotion()) return;
    let timers = classTimers.get(target);
    if (!timers) {
      timers = new Map();
      classTimers.set(target, timers);
    }
    const activeTimer = timers.get(className);
    if (activeTimer) clearTimeout(activeTimer);
    target.classList.remove(className);
    void target.offsetWidth;
    target.classList.add(className);
    const timer = setTimeout(function () {
      if (target.isConnected) target.classList.remove(className);
      if (timers.get(className) === timer) timers.delete(className);
    }, duration);
    timers.set(className, timer);
  }

  function emitPaperCues(target, count) {
    if (!canCreateParticles()) return;
    for (let i = 0; i < count; i += 1) createPaperCue(target, i);
  }

  function playPurchaseEffect(target) {
    retriggerClass(target, "is-stamped", 240);
    emitPaperCues(target, 1);
    playSound("purchase");
  }

  function playUpgradeEffect(target) {
    retriggerClass(target, "is-upgrade-filed", 280);
    emitPaperCues(target, 1);
    playSound("upgrade");
  }

  function playContractEffect(target) {
    retriggerClass(target, "is-contract-stamped", 340);
    emitPaperCues(target, 2);
    playSound("contract");
  }

  function playAchievementEffect(target) {
    playCelebrationEffect("achievement", target);
  }

  function playMilestoneEffect(target) {
    playCelebrationEffect("milestone", target);
  }

  function animatePressFeed(press) {
    if (!press || !canCreateMotion()) return;
    const sheet = press.querySelector(".paper-sheet");
    if (!sheet || press.classList.contains("is-feeding")) return;

    let timer = null;
    let finished = false;
    const cleanup = function () {
      if (finished) return;
      finished = true;
      const activeTimer = timer;
      if (activeTimer !== null) clearTimeout(activeTimer);
      if (press.classList.contains("is-feeding")) press.classList.remove("is-feeding");
      sheet.removeEventListener("animationend", handleAnimationEnd);
      if (pressFeedTimers.get(press) === activeTimer) pressFeedTimers.delete(press);
      timer = null;
    };
    const handleAnimationEnd = function (event) {
      if (event.target === sheet && event.animationName === "press-feed") cleanup();
    };

    press.classList.add("is-feeding");
    sheet.addEventListener("animationend", handleAnimationEnd);
    timer = setTimeout(cleanup, PRESS_FEED_DURATION + 90);
    pressFeedTimers.set(press, timer);
  }

  function playClickEffect(target) {
    const press = target && target.closest ? target.closest(".press-console") : null;
    if (press) animatePressFeed(press);
    if (!press) emitPaperCues(target, 1);
    playSound("click");
  }

  function setRainPieceMotion(piece, lifetime) {
    piece.style.setProperty("--confetti-x", (Math.random() * 100).toFixed(2) + "%");
    piece.style.setProperty("--confetti-drift", Math.round((Math.random() - 0.5) * 180) + "px");
    piece.style.setProperty("--confetti-spin", Math.round(280 + Math.random() * 520) + "deg");
    piece.style.setProperty("--confetti-delay", Math.round(Math.random() * 240) + "ms");
    piece.style.setProperty("--confetti-duration", Math.round(lifetime * (0.72 + Math.random() * 0.2)) + "ms");
  }

  function setBurstPieceMotion(piece, target, index, count, lifetime) {
    const rect = getUsableRect(target);
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const angle = (Math.PI * 2 * index / count) + (Math.random() - 0.5) * 0.34;
    const distance = 46 + Math.random() * 76;
    piece.style.left = Math.round(originX) + "px";
    piece.style.top = Math.round(originY) + "px";
    piece.style.setProperty("--burst-x", Math.round(Math.cos(angle) * distance) + "px");
    piece.style.setProperty("--burst-y", Math.round(Math.sin(angle) * distance - 24) + "px");
    piece.style.setProperty("--confetti-spin", Math.round((Math.random() - 0.5) * 620) + "deg");
    piece.style.setProperty("--confetti-delay", Math.round(Math.random() * 80) + "ms");
    piece.style.setProperty("--confetti-duration", Math.round(lifetime * (0.68 + Math.random() * 0.2)) + "ms");
  }

  function playCelebrationEffect(variant, target) {
    const cfg = CELEBRATION_VARIANTS[variant] || CELEBRATION_VARIANTS.finale;
    if (canCreateParticles()) {
      const container = document.createElement("div");
      container.className = "celebration celebration-" + cfg.layout;
      container.setAttribute("aria-hidden", "true");
      container.style.animationDuration = cfg.lifetime + "ms";
      for (let i = 0; i < cfg.count; i += 1) {
        const piece = document.createElement("span");
        piece.className = cfg.classes[i % cfg.classes.length];
        if (cfg.layout === "burst") setBurstPieceMotion(piece, target, i, cfg.count, cfg.lifetime);
        else setRainPieceMotion(piece, cfg.lifetime);
        container.appendChild(piece);
      }
      document.body.appendChild(container);
      setTimeout(function () { container.remove(); }, cfg.lifetime);
    }
    playSound(cfg.sound);
  }

  function initSectionReveals() {
    const targets = Array.from(document.querySelectorAll(".reveal-target"));
    if (!targets.length) return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach(function (target) { target.classList.add("is-visible"); });
      return;
    }
    document.documentElement.classList.add("ui-reveal-ready");
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -7%", threshold: 0.08 });
    targets.forEach(function (target) { observer.observe(target); });
  }

  document.addEventListener("pointerdown", unlockAudio, { passive: true });
  document.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("DOMContentLoaded", initSectionReveals, { once: true });

  window.UIEffects = {
    playPurchaseEffect,
    playUpgradeEffect,
    playContractEffect,
    playAchievementEffect,
    playMilestoneEffect,
    playCelebrationEffect,
    playClickEffect,
    playSound,
    playHorn
  };
})();
