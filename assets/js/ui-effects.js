(function(){
  let audioCtx = null;
  let audioUnlocked = false;
  let activePaperCues = 0;
  const MAX_PAPER_CUES = 18;

  const SOUND_PRESETS = {
    click: { freq: 360, duration: 0.08 },
    purchase: { freq: 520, duration: 0.12 },
    upgrade: { freq: 590, duration: 0.14 },
    contract: { freq: 430, duration: 0.13 },
    celebration: { freq: 640, duration: 0.3 },
    achievement: { freq: 780, duration: 0.18 }
  };

  const CELEBRATION_VARIANTS = {
    finale: { count: 40, classes: ["confetti"], sound: "celebration", lifetime: 2000 },
    prestige: {
      count: 48,
      classes: ["confetti confetti-gold", "confetti confetti-paper"],
      sound: "celebration",
      lifetime: 2700
    },
    achievement: {
      count: 18,
      classes: ["confetti confetti-gold", "confetti confetti-violet"],
      sound: "achievement",
      lifetime: 2000
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
    target.classList.remove(className);
    void target.offsetWidth;
    target.classList.add(className);
    setTimeout(function () {
      if (target.isConnected) target.classList.remove(className);
    }, duration);
  }

  function emitPaperCues(target, count) {
    if (!canCreateParticles()) return;
    for (let i = 0; i < count; i += 1) createPaperCue(target, i);
  }

  function playPurchaseEffect(target) {
    retriggerClass(target, "is-stamped", 420);
    emitPaperCues(target, 5);
    playSound("purchase");
  }

  function playUpgradeEffect(target) {
    retriggerClass(target, "is-upgrade-filed", 420);
    emitPaperCues(target, 4);
    playSound("upgrade");
  }

  function playContractEffect(target) {
    retriggerClass(target, "is-contract-stamped", 430);
    emitPaperCues(target, 3);
    playSound("contract");
  }

  function playClickEffect(target) {
    const press = target && target.closest ? target.closest(".press-console") : null;
    if (press) retriggerClass(press, "is-feeding", 480);
    if (!press) emitPaperCues(target, 1);
    playSound("click");
  }

  function playCelebrationEffect(variant) {
    const cfg = CELEBRATION_VARIANTS[variant] || CELEBRATION_VARIANTS.finale;
    if (canCreateParticles()) {
      const container = document.createElement("div");
      container.className = "celebration";
      container.setAttribute("aria-hidden", "true");
      container.style.animationDuration = cfg.lifetime + "ms";
      for (let i = 0; i < cfg.count; i += 1) {
        const piece = document.createElement("span");
        piece.className = cfg.classes[i % cfg.classes.length];
        piece.style.setProperty("--rand", Math.random().toString());
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
    playCelebrationEffect,
    playClickEffect,
    playSound,
    playHorn
  };
})();
