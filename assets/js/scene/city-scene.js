/**
 * CityScene — lowpoly industrial-campus diorama rendered with three.js.
 *
 * Progressive enhancement layer: scene-loader.js dynamically imports the
 * vendored three.js module and calls CityScene.init(THREE, canvas). If that
 * never happens (file://, old browser, WebGL unavailable, user toggle off),
 * the game is untouched — every piece of information shown here also exists
 * in the DOM UI, and the canvas stays aria-hidden.
 *
 * State flows one way: the scene polls window.__PE_SCENE__.getSnapshot()
 * (a defensive copy exposed by app.js) inside its own rAF loop and diffs
 * building quantities. It never mutates game state.
 */
(function () {
  const DPR_CAP_DESKTOP = 1.5;
  const MOBILE_MAX_WIDTH = 960;
  // Gentle idle drift: +/-3 degrees over ~40s.
  const DRIFT_AMPLITUDE = (3 * Math.PI) / 180;
  const DRIFT_PERIOD_S = 40;
  const BASE_AZIMUTH = Math.PI / 4;
  const ELEVATION = (35 * Math.PI) / 180;
  const CAMERA_DISTANCE = 30;

  let renderer = null;
  let scene = null;
  let camera = null;
  let canvas = null;
  let stageEl = null;
  let rafId = 0;
  let running = false;
  let stageInView = true;
  let lastQuantities = null;
  let lotGroups = {};
  let lotCopies = {};
  let animated = { armSegments: [], rings: [] };
  let needsRender = true;
  let frameToggle = false;
  let isMobile = false;
  let disposed = false;
  let applySize = null;
  let sizedW = 0;
  let sizedH = 0;
  let sizedDpr = 0;
  let sizeCheckCountdown = 0;
  let resizeObserver = null;
  let onWindowResize = null;
  let lights = null;
  let lastStats = null;
  let raycaster = null;
  let pointerVec = null;
  let lastHoverCheck = 0;
  let sweepOffset = 0;
  let sweepActive = false;
  // Dernières valeurs d'ambiance effectivement rendues (mode still).
  let renderedAmbiance = null;

  // Quel bâtiment secouer pour chaque événement narratif (juice PR3).
  const EVENT_TARGETS = {
    machineBreakdown: "digitalPress",
    auditQuality: "finishingWorkshop",
    newContract: "logistics",
    cyberAttack: "clientPortal",
    sabotage: "insertingLine",
    calibrationChallenge: "offsetPress"
  };

  function particlesEnabled() {
    return document.documentElement.dataset.particlesEnabled !== "0";
  }

  const osReducedMotion = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  function reduceMotion() {
    // Honore la préférence in-game ET la préférence système.
    return document.documentElement.classList.contains("pref-reduce-motion") ||
      !!(osReducedMotion && osReducedMotion.matches);
  }

  function sceneEnabled() {
    return document.documentElement.dataset.sceneEnabled !== "0";
  }

  // --- Cadrage dynamique ---------------------------------------------------
  // La caméra cadre la partie OCCUPÉE du campus : plein cadre sur le premier
  // kiosque, puis dézoome à mesure que l'empire s'étend, jusqu'au monde
  // entier. view.* = état courant (lissé), viewTarget.* = cible du cadrage.
  const view = { x: 0, z: 0, zoom: 1 };
  const viewTarget = { x: 0, z: 0, zoom: 1 };
  const MAX_ZOOM = 2.6;

  /** Positions the ortho camera on the iso axis, looking at the view center. */
  function placeCamera(azimuth) {
    const y = CAMERA_DISTANCE * Math.sin(ELEVATION);
    const r = CAMERA_DISTANCE * Math.cos(ELEVATION);
    camera.position.set(
      view.x + r * Math.cos(azimuth),
      y,
      view.z + r * Math.sin(azimuth)
    );
    camera.lookAt(view.x, 0.6, view.z);
    if (camera.zoom !== view.zoom) {
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Recomputes the framing target from the buildings currently visible:
   * center of their footprint bounding box, zoom inversely proportional to
   * its projected extent. No visible building -> whole world (zoom 1).
   */
  function updateViewTarget() {
    const layout = window.CityLayout;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let any = false;
    Object.keys(lotGroups).forEach(id => {
      if (!lotGroups[id].visible) return;
      const lot = layout.LOTS[id];
      const bounds = [lotGroups[id]].concat(lotCopies[id]);
      bounds.forEach(g => {
        any = true;
        minX = Math.min(minX, g.position.x - lot.w / 2);
        maxX = Math.max(maxX, g.position.x + lot.w / 2);
        minZ = Math.min(minZ, g.position.z - lot.d / 2);
        maxZ = Math.max(maxZ, g.position.z + lot.d / 2);
      });
    });
    if (!any) {
      viewTarget.x = 0;
      viewTarget.z = 0;
      viewTarget.zoom = 1;
      return;
    }
    viewTarget.x = (minX + maxX) / 2;
    viewTarget.z = (minZ + maxZ) / 2;
    // Étendue projetée en iso (azimut ~45°) : l'axe écran-x porte (dx+dz)/√2,
    // + marge généreuse pour la dérive de caméra et les toits.
    const spanX = (maxX - minX) + 3.5;
    const spanZ = (maxZ - minZ) + 3.5;
    const projected = (spanX + spanZ) / (2 * Math.SQRT2) + 2.2;
    const halfWorld = 26 * 0.56;
    viewTarget.zoom = Math.max(1, Math.min(MAX_ZOOM, halfWorld / Math.max(4, projected)));
  }

  /** Glisse la vue vers sa cible ; retourne true tant que ça bouge. */
  function easeView(snap) {
    const k = snap ? 1 : 0.06;
    let moving = false;
    ["x", "z", "zoom"].forEach(key => {
      const delta = viewTarget[key] - view[key];
      if (Math.abs(delta) > (key === "zoom" ? 0.001 : 0.01)) {
        view[key] += delta * k;
        moving = true;
      } else {
        view[key] = viewTarget[key];
      }
    });
    return moving;
  }

  /** Recomputes the ortho frustum so the whole campus fits the canvas. */
  function frameWorld(THREE, width, height) {
    const aspect = width / Math.max(1, height);
    // World footprint is 26x16; from the iso angle the projected extent is
    // wider than either axis alone, so frame on the diagonal with margin.
    const halfWorld = 26 * 0.56;
    let halfW = halfWorld;
    let halfH = halfWorld / aspect;
    const minHalfH = 7.2;
    if (halfH < minHalfH) {
      halfH = minHalfH;
      halfW = halfH * aspect;
    }
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = 0.1;
    camera.far = 120;
    camera.updateProjectionMatrix();
  }

  function buildLights(THREE) {
    const hemi = new THREE.HemisphereLight(0x9fc4e0, 0x14203a, 1.15);
    scene.add(hemi);
    // Warm sun on the camera side so the facades facing the player are lit.
    const sun = new THREE.DirectionalLight(0xffe1b3, 1.35);
    sun.position.set(12, 20, 14);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.35);
    rim.position.set(-10, 12, -14);
    scene.add(rim);
    lights = {
      hemi,
      sun,
      rim,
      skyClear: new THREE.Color(0x9fc4e0),
      skySmog: new THREE.Color(0x8a7f5e),
      groundClear: new THREE.Color(0x14203a),
      groundSmog: new THREE.Color(0x2b2417)
    };
  }

  /**
   * Ambiances pilotées par les jauges : l'empreinte papier assombrit et
   * enfume le ciel (brouillard + teinte), la qualité éclaircit le soleil,
   * l'image de marque fait briller le liseré cyan. Lerp doux par frame ; sous
   * reduce-motion la cible est appliquée directement au changement.
   */
  function applyAmbiance(THREE, instant) {
    if (!lights || !lastStats) return;
    const k = instant ? 1 : 0.04;
    const smog = Math.max(0, Math.min(1, lastStats.footprint));
    if (!scene.fog) {
      scene.fog = new THREE.Fog(0x0b1226, 30, 90);
    }
    if (!lights.skyTarget) {
      // Instances réutilisées : pas d'allocation dans la boucle chaude.
      lights.skyTarget = new THREE.Color();
      lights.groundTarget = new THREE.Color();
    }
    const stepTo = (obj, prop, target) => {
      const next = obj[prop] + (target - obj[prop]) * k;
      obj[prop] = Math.abs(next - target) > 0.002 ? next : target;
    };
    // Brouillard : lointain et discret à 0, proche et dense à 1.
    stepTo(scene.fog, "far", 90 - smog * 48);
    stepTo(lights.sun, "intensity", 1.15 + Math.max(0, Math.min(1, lastStats.quality)) * 0.45);
    stepTo(lights.rim, "intensity", 0.15 + Math.max(0, Math.min(1, lastStats.brandImage)) * 0.55);
    lights.skyTarget.lerpColors(lights.skyClear, lights.skySmog, smog);
    lights.groundTarget.lerpColors(lights.groundClear, lights.groundSmog, smog);
    if (instant) {
      lights.hemi.color.copy(lights.skyTarget);
      lights.hemi.groundColor.copy(lights.groundTarget);
    } else {
      lights.hemi.color.lerp(lights.skyTarget, k);
      lights.hemi.groundColor.lerp(lights.groundTarget, k);
    }
  }

  /**
   * Mode still (reduce-motion, rendu à la demande) : détecte un changement
   * d'ambiance suffisant pour mériter un repaint — sinon les jauges qui
   * dérivent muteraient fog/lumières sans jamais redessiner (état figé
   * puis saut visuel au prochain rendu).
   */
  function ambianceNeedsRender() {
    if (!lastStats) return false;
    if (!renderedAmbiance) return true;
    return ["quality", "footprint", "brandImage"].some(
      key => Math.abs(lastStats[key] - renderedAmbiance[key]) > 0.03
    );
  }

  function markAmbianceRendered() {
    if (!lastStats) return;
    renderedAmbiance = {
      quality: lastStats.quality,
      footprint: lastStats.footprint,
      brandImage: lastStats.brandImage
    };
  }

  /** Ground: grass base, two asphalt roads, sidewalk strip per row. */
  function buildGround(THREE) {
    const ground = new THREE.Group();
    const mkBox = (w, h, d, color, x, y, z) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color, flatShading: true })
      );
      m.position.set(x, y, z);
      ground.add(m);
      return m;
    };
    // Base slab (grass, slightly darker at dusk).
    mkBox(27, 0.5, 17, 0x14532d, 0, -0.25, 0);
    // Roads between the rows.
    mkBox(27, 0.06, 1.4, 0x1e293b, 0, 0.005, 2.4);
    mkBox(27, 0.06, 1.4, 0x1e293b, 0, 0.005, -2.4);
    // Central plaza connector.
    mkBox(1.6, 0.06, 10, 0x334155, 10.8, 0.006, 0);
    // Low-poly border trees along the back edge (merged look, cheap).
    for (let i = 0; i < 9; i++) {
      const x = -12 + i * 3;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.5, 5),
        new THREE.MeshLambertMaterial({ color: 0x7c4a1e, flatShading: true })
      );
      trunk.position.set(x, 0.25, -7.4);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 1.0, 6),
        new THREE.MeshLambertMaterial({ color: 0x166534, flatShading: true })
      );
      crown.position.set(x, 1.0, -7.4);
      ground.add(trunk, crown);
    }
    scene.add(ground);
  }

  /** Creates (once) the group for each building lot, initially hidden. */
  function buildLots(THREE) {
    const layout = window.CityLayout;
    const recipes = window.BuildingRecipes;
    layout.BUILDING_IDS.forEach(id => {
      const lot = layout.LOTS[id];
      const group = recipes.build(THREE, id);
      if (!group) return;
      group.position.set(lot.x, 0, lot.z);
      group.visible = false;
      scene.add(group);
      lotGroups[id] = group;
      lotCopies[id] = [];
    });
  }

  function collectAnimated(group) {
    if (group.userData.armSegments) {
      animated.armSegments.push(...group.userData.armSegments);
    }
    if (group.userData.ring) {
      animated.rings.push(group.userData.ring);
    }
  }

  /**
   * applyQuantity rebuilds each group's "growth" subgroup, so any animated
   * refs captured earlier (pampyAI ring...) go stale: rebuild the whole
   * list from the up-to-date originals and copies. Cheap — runs only when
   * a quantity actually changed.
   */
  function recollectAnimated() {
    animated.armSegments.length = 0;
    animated.rings.length = 0;
    Object.keys(lotGroups).forEach(id => {
      if (!lotGroups[id].visible) return;
      collectAnimated(lotGroups[id]);
      lotCopies[id].forEach(collectAnimated);
    });
  }

  /** Disposes the geometries a removed copy owns (its rebuilt "growth"
   * meshes are unique; static meshes still share the original's geometry
   * and must NOT be disposed). */
  function disposeCopy(copy) {
    const growth = copy.getObjectByName("growth");
    if (!growth) return;
    growth.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
  }

  /**
   * Syncs the campus with a snapshot: shows/hides lots, applies growth to
   * the original AND every copy (so appearance is a pure function of the
   * snapshot, not of purchase order), clones/removes duplicate copies.
   * Returns true when anything changed.
   */
  function syncBuildings(THREE, snapshot) {
    const layout = window.CityLayout;
    const recipes = window.BuildingRecipes;
    // Premier sync (chargement d'une sauvegarde) : on matérialise l'état
    // sans effets — le pop est réservé aux vrais achats en session.
    const initialSync = lastQuantities === null;
    let changed = false;
    snapshot.buildings.forEach(b => {
      const group = lotGroups[b.id];
      if (!group) return;
      const prev = lastQuantities ? lastQuantities[b.id] || 0 : 0;
      if (b.quantity === prev) return;
      changed = true;
      const firstAppearance = prev === 0 && b.quantity > 0;
      group.visible = b.quantity > 0;
      if (b.quantity > 0) {
        recipes.applyQuantity(THREE, group, b.quantity);
      }
      if (firstAppearance && !initialSync && window.SceneEffects && !reduceMotion()) {
        window.SceneEffects.popIn(group);
      }
      // Duplicate copies beyond the first, up to the lot's visual cap.
      const offsets = layout.duplicateOffsets(b.id, layout.copiesFor(b.id, b.quantity));
      const copies = lotCopies[b.id];
      while (copies.length > Math.max(0, offsets.length - 1)) {
        const dead = copies.pop();
        scene.remove(dead);
        disposeCopy(dead);
      }
      // Existing copies re-apply the current growth stage (their "growth"
      // meshes are unique, so the recipes can dispose/rebuild them safely).
      copies.forEach(copy => {
        recipes.applyQuantity(THREE, copy, b.quantity);
      });
      for (let i = copies.length; i < offsets.length - 1; i++) {
        const off = offsets[i + 1];
        const clone = group.clone(true);
        // The clone's growth meshes share the original's geometries: strip
        // them WITHOUT dispose, then rebuild unique ones for this copy.
        const clonedGrowth = clone.getObjectByName("growth");
        if (clonedGrowth) {
          while (clonedGrowth.children.length) {
            clonedGrowth.remove(clonedGrowth.children[0]);
          }
        }
        recipes.applyQuantity(THREE, clone, b.quantity);
        clone.position.set(group.position.x + off.x, 0, group.position.z + off.z);
        clone.rotation.y = off.rotY;
        clone.visible = true;
        scene.add(clone);
        copies.push(clone);
        if (!initialSync && window.SceneEffects && !reduceMotion()) {
          window.SceneEffects.popIn(clone);
        }
      }
    });
    if (changed) {
      recollectAnimated();
      updateViewTarget();
    }
    lastStats = snapshot.stats;
    lastQuantities = {};
    snapshot.buildings.forEach(b => {
      lastQuantities[b.id] = b.quantity;
    });
    return changed;
  }

  function animate(THREE, timeMs) {
    if (disposed) return;
    rafId = requestAnimationFrame(t => animate(THREE, t));
    if (!running || !stageInView || document.hidden || !sceneEnabled()) {
      // Personne ne regarde : les notifications de juice accumulées
      // n'auront plus de sens au retour — on les jette au fil de l'eau.
      const queue = window.__PE_SCENE_EVENTS__;
      if (queue && queue.length) queue.length = 0;
      return;
    }
    // Mobile renders every other frame (~30fps).
    frameToggle = !frameToggle;
    if (isMobile && frameToggle) return;

    // Belt-and-braces sizing: ResizeObserver/timers can be throttled away
    // in hidden or embedded documents, and a stage that was 0-sized at
    // init (background-tab load) would otherwise keep a broken frustum.
    if (--sizeCheckCountdown <= 0) {
      sizeCheckCountdown = 30;
      if (applySize) applySize();
    }

    const bridge = window.__PE_SCENE__;
    if (bridge && syncBuildings(THREE, bridge.getSnapshot())) {
      needsRender = true;
    }
    const still = reduceMotion();
    drainSceneEvents(THREE);
    if (window.SceneEffects) {
      if (still) {
        // reduce-motion activé en cours de vol : on amène les effets
        // actifs à leur état final (avec nettoyage) au lieu de les
        // laisser s'animer jusqu'au bout.
        if (window.SceneEffects.finishAll()) needsRender = true;
      } else if (window.SceneEffects.tick(timeMs || 0)) {
        needsRender = true;
      }
    }

    if (still && ambianceNeedsRender()) needsRender = true;
    applyAmbiance(THREE, still);
    if (still) {
      // On-demand rendering only: draw when the campus changed. The view
      // snaps straight to its target (no travelling shot).
      if (easeView(true)) needsRender = true;
      placeCamera(BASE_AZIMUTH);
      if (!needsRender) return;
    } else {
      if (easeView(false)) needsRender = true;
      const t = (timeMs || 0) / 1000;
      placeCamera(BASE_AZIMUTH + sweepOffset + Math.sin((t * 2 * Math.PI) / DRIFT_PERIOD_S) * DRIFT_AMPLITUDE);
      animated.armSegments.forEach((seg, i) => {
        seg.rotation.z = Math.sin(t * 0.8 + i * 0.9) * 0.35;
      });
      animated.rings.forEach(ring => {
        ring.rotation.y = t * 0.4;
      });
    }
    renderer.render(scene, camera);
    markAmbianceRendered();
    needsRender = false;
  }

  /**
   * Remonte du mesh touché vers le groupe de parcelle (buildingId).
   * Le Raycaster de three ne filtre PAS sur visible : on écarte
   * explicitement les bâtiments cachés (parcelles pas encore achetées).
   */
  function buildingFromIntersections(hits) {
    for (let i = 0; i < hits.length; i++) {
      let node = hits[i].object;
      let id = null;
      let hidden = false;
      while (node) {
        if (node.visible === false) hidden = true;
        if (node.userData && node.userData.buildingId) {
          id = node.userData.buildingId;
          break;
        }
        node = node.parent;
      }
      if (id && !hidden) return id;
    }
    return null;
  }

  /** Cibles cliquables uniquement : parcelles + copies (pas le sol, pas
   * les particules en vol qui avaleraient le clic). */
  function raycastTargets() {
    const targets = [];
    Object.keys(lotGroups).forEach(id => {
      targets.push(lotGroups[id]);
      lotCopies[id].forEach(copy => targets.push(copy));
    });
    return targets;
  }

  function raycastBuilding(THREE, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerVec.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerVec, camera);
    return buildingFromIntersections(raycaster.intersectObjects(raycastTargets(), true));
  }

  /**
   * Clic sur un bâtiment 3D = clic sur son bouton « Acheter » du DOM :
   * on réutilise 100 % de la logique existante (coûts, tutoriel, sons,
   * log). La liste DOM reste le chemin accessible principal — le canvas
   * est un raccourci pour souris/tactile.
   */
  function wirePointer(THREE) {
    raycaster = new THREE.Raycaster();
    pointerVec = new THREE.Vector2();
    // "click" plutôt que pointerdown : clic gauche uniquement, et le
    // navigateur l'annule si le geste devient un drag/scroll (tactile).
    canvas.addEventListener("click", event => {
      if (!running || !renderer) return;
      const id = raycastBuilding(THREE, event.clientX, event.clientY);
      if (!id) return;
      const btn = document.querySelector('[data-building-btn="' + id + '"]');
      // L'inabordabilité est signalée par la classe CSS "disabled"
      // (app.js ne pose pas l'attribut disabled).
      if (btn && !btn.classList.contains("disabled")) {
        btn.click();
      }
    });
    canvas.addEventListener("pointermove", event => {
      if (!running || !renderer) return;
      const now = performance.now();
      if (now - lastHoverCheck < 120) return;
      lastHoverCheck = now;
      const id = raycastBuilding(THREE, event.clientX, event.clientY);
      canvas.style.cursor = id ? "pointer" : "";
    });
  }

  /** Vide la file d'événements poussée par app.js (juice uniquement). */
  function drainSceneEvents(THREE) {
    const queue = window.__PE_SCENE_EVENTS__;
    const fx = window.SceneEffects;
    if (!queue || !queue.length || !fx) {
      if (queue) queue.length = 0;
      return;
    }
    const still = reduceMotion();
    while (queue.length) {
      const ev = queue.shift();
      if (ev.type === "purchase" && ev.id && lotGroups[ev.id]) {
        const group = lotGroups[ev.id];
        if (!still) {
          fx.pulse(group);
          // Contrat d'accessibilité (docs/accessibility.md) : les effets
          // se coupent si reduce-motion OU particules désactivées.
          if (particlesEnabled()) {
            const origin = group.position.clone();
            origin.y = 0.8;
            fx.burst(THREE, scene, origin, 0x38bdf8, 12);
          }
        }
        needsRender = true;
      } else if (ev.type === "event" && EVENT_TARGETS[ev.id] && lotGroups[EVENT_TARGETS[ev.id]]) {
        const target = lotGroups[EVENT_TARGETS[ev.id]];
        if (target.visible && !still) {
          fx.shake(target);
          needsRender = true;
        }
      } else if (ev.type === "prestige") {
        if (!still) {
          if (particlesEnabled()) {
            const center = new THREE.Vector3(viewTarget.x, 1.2, viewTarget.z);
            fx.burst(THREE, scene, center, 0xfacc15, 22);
          }
          if (!sweepActive) {
            sweepActive = true;
            fx.sweep(angle => {
              sweepOffset = angle;
            }, 2400, () => {
              sweepActive = false;
            });
          }
        }
        needsRender = true;
      }
    }
  }

  function watchVisibility() {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          stageInView = e.isIntersecting;
        });
      });
      io.observe(stageEl);
    }
    document.addEventListener("visibilitychange", () => {
      needsRender = true;
    });
  }

  function watchResize(THREE) {
    const apply = () => {
      if (!renderer) return;
      const w = stageEl.clientWidth;
      const h = stageEl.clientHeight;
      if (!w || !h) return;
      isMobile = window.innerWidth < MOBILE_MAX_WIDTH;
      // Le DPR fait partie de l'état de taille : glisser la fenêtre vers un
      // écran de densité différente ne change pas les pixels CSS du stage.
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : DPR_CAP_DESKTOP);
      if (w === sizedW && h === sizedH && dpr === sizedDpr) return;
      sizedW = w;
      sizedH = h;
      sizedDpr = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      frameWorld(THREE, w, h);
      needsRender = true;
    };
    applySize = apply;
    if ("ResizeObserver" in window) {
      let pending = 0;
      resizeObserver = new ResizeObserver(() => {
        clearTimeout(pending);
        pending = setTimeout(apply, 80);
      });
      resizeObserver.observe(stageEl);
    } else {
      onWindowResize = apply;
      window.addEventListener("resize", onWindowResize);
    }
    apply();
  }

  function dispose() {
    disposed = true;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (onWindowResize) {
      window.removeEventListener("resize", onWindowResize);
      onWindowResize = null;
    }
    applySize = null;
    // Plus personne ne draine la file : on la retire pour que app.js
    // redevienne no-op au lieu d'accumuler des notifications.
    window.__PE_SCENE_EVENTS__ = null;
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
  }

  window.CityScene = {
    /**
     * Boots the diorama. Returns true on success, false when prerequisites
     * are missing — the loader then leaves the CSS fallback in place.
     */
    init(THREE, canvasEl) {
      if (!THREE || !canvasEl || !window.CityLayout || !window.BuildingRecipes) {
        return false;
      }
      canvas = canvasEl;
      stageEl = canvas.closest(".stage") || canvas.parentElement;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: window.innerWidth >= MOBILE_MAX_WIDTH,
          powerPreference: "low-power"
        });
      } catch (err) {
        return false;
      }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1226);
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
      placeCamera(BASE_AZIMUTH);
      buildLights(THREE);
      buildGround(THREE);
      buildLots(THREE);
      watchResize(THREE);
      watchVisibility();
      wirePointer(THREE);
      // File des notifications de jeu (achats/événements/prestige) que
      // app.js alimente ; absente = no-op côté jeu.
      window.__PE_SCENE_EVENTS__ = [];
      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        dispose();
        if (stageEl) stageEl.classList.remove("scene-active");
      });
      running = true;
      rafId = requestAnimationFrame(t => animate(THREE, t));
      // Debug/test handle (also used by Playwright specs and headless
      // environments where document.hidden pauses the normal loop).
      window.__PE_SCENE_DEBUG__ = {
        get info() {
          return renderer ? renderer.info.render : null;
        },
        lotVisibility() {
          const out = {};
          Object.keys(lotGroups).forEach(id => {
            out[id] = lotGroups[id].visible;
          });
          return out;
        },
        camera: () => camera,
        scene: () => scene,
        sceneChildren: () => scene.children.length,
        animated: () => animated,
        lotGroup: id => lotGroups[id],
        lotCopies: id => lotCopies[id],
        guards: () => ({
          running,
          stageInView,
          documentHidden: document.hidden,
          sceneEnabled: sceneEnabled(),
          isMobile,
          reduceMotion: reduceMotion(),
          needsRender,
          disposed
        }),
        /** Syncs state and renders a single frame, bypassing pause guards. */
        renderOnce() {
          if (!renderer) return null;
          if (applySize) applySize();
          const bridge = window.__PE_SCENE__;
          if (bridge) syncBuildings(THREE, bridge.getSnapshot());
          drainSceneEvents(THREE);
          if (window.SceneEffects) window.SceneEffects.tick(performance.now());
          applyAmbiance(THREE, true);
          easeView(true);
          placeCamera(BASE_AZIMUTH);
          renderer.render(scene, camera);
          markAmbianceRendered();
          return renderer.info.render.triangles;
        }
      };
      return true;
    },
    dispose
  };
})();
