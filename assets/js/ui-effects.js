(function(){
  let audioCtx = null;
  const SOUND_PRESETS = {
    click: { freq: 360, duration: 0.08 },
    purchase: { freq: 520, duration: 0.12 },
    celebration: { freq: 640, duration: 0.3 },
    achievement: { freq: 780, duration: 0.18 }
  };

  /* Chaque grand moment a sa pluie : multicolore pour le bâtiment
     final, or et feuilles de papier pour le prestige, salve courte
     or/violet pour un succès (les classes confetti-* sont stylées
     dans style.css). */
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

  function ensureAudio() {
    if (typeof window === "undefined") return null;
    if (audioCtx) return audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  }

  function playTone(frequency, duration = 0.12) {
    if (document?.documentElement?.dataset?.soundsEnabled === "0") return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.value = 0.2;
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

  function createParticle(target) {
    const particle = document.createElement("span");
    particle.className = "particle";
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() * 40 - 20);
    const y = rect.top + (Math.random() * 30 - 15);
    particle.style.left = x + "px";
    particle.style.top = y + "px";
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 600);
  }

  function playPurchaseEffect(target) {
    if (target && document.documentElement.dataset.particlesEnabled !== "0") {
      for (let i = 0; i < 6; i++) {
        createParticle(target);
      }
    }
    playSound("purchase");
  }

  function playClickEffect(target) {
    if (target && document.documentElement.dataset.particlesEnabled !== "0") {
      createParticle(target);
    }
    playSound("click");
  }

  function playCelebrationEffect(variant) {
    const cfg = CELEBRATION_VARIANTS[variant] || CELEBRATION_VARIANTS.finale;
    if (document.documentElement.dataset.particlesEnabled !== "0") {
      const container = document.createElement("div");
      container.className = "celebration";
      container.style.animationDuration = cfg.lifetime + "ms";
      for (let i = 0; i < cfg.count; i++) {
        const piece = document.createElement("span");
        piece.className = cfg.classes[i % cfg.classes.length];
        piece.style.setProperty("--rand", Math.random().toString());
        container.appendChild(piece);
      }
      document.body.appendChild(container);
      setTimeout(() => container.remove(), cfg.lifetime);
    }
    playSound(cfg.sound);
  }

  window.UIEffects = {
    playPurchaseEffect,
    playCelebrationEffect,
    playClickEffect,
    playSound
  };
})();
