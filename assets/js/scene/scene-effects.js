/**
 * SceneEffects — micro tween/effects toolkit for the 3D campus.
 *
 * Zero dependencies: a tiny time-based tween list driven by
 * SceneEffects.tick(nowMs) from the scene's rAF loop. Every effect is
 * fire-and-forget and cleans up after itself. The caller is responsible
 * for gating particle effects on the user's particlesEnabled preference.
 */
(function () {
  const tweens = [];

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Registers a tween. spec: { duration (ms), onUpdate(t01), onDone() }.
   * Starts on the next tick (start time captured from the loop clock so
   * effects stay coherent with the render timeline).
   */
  function add(spec) {
    tweens.push({ start: 0, spec });
  }

  /**
   * Termine immédiatement tous les tweens actifs : chaque effet est amené
   * à son état final (onUpdate(1)) puis nettoyé (onDone). Utilisé quand
   * reduce-motion s'active en cours de session — le contrat
   * d'accessibilité exige que les effets déjà en vol s'arrêtent aussi.
   * Retourne true si au moins un tween a été terminé.
   */
  function finishAll() {
    if (!tweens.length) return false;
    const pending = tweens.splice(0, tweens.length);
    pending.forEach(tw => {
      try {
        tw.spec.onUpdate(1);
      } catch (err) { /* l'état final peut échouer, on nettoie quand même */ }
      try {
        if (tw.spec.onDone) tw.spec.onDone();
      } catch (err) { /* rien de plus à faire */ }
    });
    return true;
  }

  /** Advances every tween; returns true while effects are running. */
  function tick(nowMs) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (!tw.start) tw.start = nowMs;
      const t = Math.min(1, (nowMs - tw.start) / tw.spec.duration);
      try {
        tw.spec.onUpdate(t);
      } catch (err) {
        tweens.splice(i, 1);
        // Le nettoyage (retrait de la scène, dispose) vit dans onDone :
        // on le tente même sur le chemin d'erreur pour ne rien orpheliner.
        try {
          if (tw.spec.onDone) tw.spec.onDone();
        } catch (err2) { /* rien à faire de plus */ }
        continue;
      }
      if (t >= 1) {
        tweens.splice(i, 1);
        if (tw.spec.onDone) tw.spec.onDone();
      }
    }
    return tweens.length > 0;
  }

  /** Pop-in: scales a group 0 -> 1 with a springy overshoot. */
  function popIn(group, duration) {
    group.scale.setScalar(0.01);
    add({
      duration: duration || 350,
      onUpdate(t) {
        group.scale.setScalar(Math.max(0.01, easeOutBack(t)));
      },
      onDone() {
        group.scale.setScalar(1);
      }
    });
  }

  /** Quick attention pulse (1 -> 1.06 -> 1) for repeat purchases. */
  function pulse(group, duration) {
    add({
      duration: duration || 260,
      onUpdate(t) {
        group.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.06);
      },
      onDone() {
        group.scale.setScalar(1);
      }
    });
  }

  // Groupes en cours de secousse : un second shake pendant qu'un premier
  // est en vol capturerait une position déplacée et la restaurerait à la
  // fin (décalage permanent). On ignore les shakes redondants.
  const shaking = new WeakSet();

  /** Horizontal shake with decay — a machine acting up. */
  function shake(group, duration) {
    if (shaking.has(group)) return;
    shaking.add(group);
    const baseX = group.position.x;
    add({
      duration: duration || 600,
      onUpdate(t) {
        group.position.x = baseX + Math.sin(t * 26) * 0.06 * (1 - t);
      },
      onDone() {
        group.position.x = baseX;
        shaking.delete(group);
      }
    });
  }

  /**
   * Particle burst: a handful of tiny flat-shaded boxes thrown upward
   * from `origin`, fading by sinking scale. Adds/removes its own group.
   */
  function burst(THREE, scene, origin, colorHex, count) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const parts = [];
    const n = count || 14;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(origin);
      // Trajectoire déterministe par index (pas de Math.random : reste
      // reproductible et suffisant visuellement).
      const a = (i / n) * Math.PI * 2;
      const speed = 1.6 + (i % 3) * 0.5;
      parts.push({ m, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, vy: 2.6 + (i % 4) * 0.4 });
      group.add(m);
    }
    scene.add(group);
    add({
      duration: 750,
      onUpdate(t) {
        parts.forEach(p => {
          p.m.position.set(
            origin.x + p.vx * t,
            Math.max(0.05, origin.y + p.vy * t - 4.5 * t * t),
            origin.z + p.vz * t
          );
          p.m.scale.setScalar(Math.max(0.01, 1 - t));
        });
      },
      onDone() {
        scene.remove(group);
        geo.dispose();
        mat.dispose();
      }
    });
  }

  /** Celebration sweep: eases an azimuth offset through a full turn. */
  function sweep(onAngle, duration, onDone) {
    add({
      duration: duration || 2400,
      onUpdate(t) {
        onAngle(easeOutCubic(t) * Math.PI * 2);
      },
      onDone() {
        onAngle(0);
        if (onDone) onDone();
      }
    });
  }

  window.SceneEffects = { tick, finishAll, add, popIn, pulse, shake, burst, sweep };
})();
