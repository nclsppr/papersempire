/**
 * CityScene — illustrated industrial-campus miniature rendered with three.js.
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
  const assetUrl = window.PEAssetUrl || function (path) { return path; };
  const DPR_CAP_DESKTOP = 1.5;
  const MOBILE_MAX_WIDTH = 960;
  // Gentle idle drift: +/-3 degrees over ~40s.
  const DRIFT_AMPLITUDE = (3 * Math.PI) / 180;
  const DRIFT_PERIOD_S = 40;
  const BASE_AZIMUTH = (42 * Math.PI) / 180;
  const ELEVATION = (31 * Math.PI) / 180;
  const CAMERA_DISTANCE = 30;
  // The permanent printworks is the hero's visual anchor. It must remain in
  // frame when the first owned lot appears instead of being pushed out by the
  // dynamic focus logic.
  const HERO_VIEW = { x: 1.15, z: -0.75, zoom: 1.12 };
  const HERO_VIEW_MOBILE = { x: 2.1, z: -2.0, zoom: 1.42 };
  const HERO_VIEW_MOBILE_LANDING = { x: 7.35, z: -4.95, zoom: 1.2 };
  const LANDMARK_BOUNDS = {
    minX: 4.35,
    maxX: 12.25,
    minZ: -8.7,
    maxZ: -1.25
  };

  let renderer = null;
  let THREERef = null;
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
  let lastFrameTick = 0;
  let isMobile = false;
  let disposed = false;
  let applySize = null;
  let sizedW = 0;
  let sizedH = 0;
  let sizedDpr = 0;
  let sizeCheckCountdown = 0;
  let resizeObserver = null;
  let resizeRafId = 0;
  let experienceObserver = null;
  let onWindowResize = null;
  let sleepTimer = 0;
  let lights = null;
  let lastStats = null;
  let raycaster = null;
  let pointerVec = null;
  let lastHoverCheck = 0;
  let sweepOffset = 0;
  let sweepActive = false;
  // Dernières valeurs d'ambiance effectivement rendues (mode still).
  let renderedAmbiance = null;
  let shadowsEnabled = false;
  let sceneMode = "landing";
  let requestedSceneMode = null;
  let firstFrameRendered = false;
  let contextUnavailable = false;
  const decorativeTextures = new Set();

  // Camions de livraison (roadmap 0.18) : InstancedMesh plafonnés, animés
  // seulement hors reduce-motion, nombre croissant avec l'empire.
  let trucks = null;
  let lastTruckMs = 0;
  let smoke = null;      // fumées de cheminées (InstancedMesh)
  let papers = null;     // feuilles de papier volantes (InstancedMesh)
  let prestigeStamp = null; // plane texturé du tampon de prestige
  let decorativeWorld = null; // décor toujours visible, sans vérité de jeu
  let cloudLayer = null; // groupe de nuages instanciés, dérive très lente
  let pressSheetLayer = null; // repères imprimés glissant sur les convoyeurs

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
    return document.documentElement.dataset.sceneEnabled !== "0" &&
      !document.documentElement.classList.contains("pref-high-contrast");
  }

  function finePointerEffects() {
    return window.innerWidth >= 1100 && typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function normalizeSceneMode(value) {
    return value === "playing" || value === "landing" ? value : null;
  }

  function mattePaintingPresent() {
    return !!(stageEl && stageEl.querySelector && stageEl.querySelector(".hero-horizon img"));
  }

  function announceFirstFrame() {
    if (firstFrameRendered || !canvas) return;
    const context = renderer && renderer.getContext ? renderer.getContext() : null;
    if (!context || context.isContextLost()) {
      if (!contextUnavailable) {
        contextUnavailable = true;
        canvas.dispatchEvent(new CustomEvent("pe:scene-unavailable"));
      }
      return;
    }
    firstFrameRendered = true;
    canvas.dispatchEvent(new CustomEvent("pe:scene-first-frame"));
  }

  /**
   * Landing mode assumes a CSS/raster matte behind the transparent canvas and
   * omits the procedural skyline. A future standalone gameplay canvas can set
   * `CityScene.setMode("playing")`, `window.__PE_SCENE_MODE__`, or a
   * data-experience/data-scene-mode attribute before init without depending on
   * hero markup.
   */
  function resolveSceneMode(canvasEl) {
    const explicit = normalizeSceneMode(requestedSceneMode) ||
      normalizeSceneMode(window.__PE_SCENE_MODE__) ||
      normalizeSceneMode(document.documentElement.dataset.experience) ||
      normalizeSceneMode(canvasEl && canvasEl.dataset ? canvasEl.dataset.sceneMode : null) ||
      normalizeSceneMode(stageEl && stageEl.dataset ? stageEl.dataset.sceneMode : null);
    if (explicit) return explicit;
    return mattePaintingPresent() ? "landing" : "playing";
  }

  function worldTheme() {
    return window.PEWorldTheme || null;
  }

  // --- Cadrage dynamique ---------------------------------------------------
  // La caméra cadre la partie OCCUPÉE du campus tout en conservant la grande
  // imprimerie-signature. view.* = état courant (lissé), viewTarget.* = cible.
  const view = { x: HERO_VIEW.x, z: HERO_VIEW.z, zoom: HERO_VIEW.zoom };
  const viewTarget = { x: HERO_VIEW.x, z: HERO_VIEW.z, zoom: HERO_VIEW.zoom };
  const MAX_ZOOM = 1.55;

  /** Positions the ortho camera on the iso axis, looking at the view center. */
  function placeCamera(azimuth) {
    const y = CAMERA_DISTANCE * Math.sin(ELEVATION);
    const r = CAMERA_DISTANCE * Math.cos(ELEVATION);
    camera.position.set(
      view.x + r * Math.cos(azimuth),
      y,
      view.z + r * Math.sin(azimuth)
    );
    const targetY = isMobile && sceneMode === "landing" ? 2.65 : 0.6;
    camera.lookAt(view.x, targetY, view.z);
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
      const hero = isMobile
        ? (sceneMode === "landing" ? HERO_VIEW_MOBILE_LANDING : HERO_VIEW_MOBILE)
        : HERO_VIEW;
      viewTarget.x = hero.x;
      viewTarget.z = hero.z;
      viewTarget.zoom = hero.zoom;
      return;
    }
    // The landmark is permanent scenery, not an owned lot, but it is the
    // compositional anchor of the hero. Unioning its bounds prevents the first
    // purchase from zooming into a tiny kiosk and ejecting the printworks.
    minX = Math.min(minX, LANDMARK_BOUNDS.minX);
    maxX = Math.max(maxX, LANDMARK_BOUNDS.maxX);
    minZ = Math.min(minZ, LANDMARK_BOUNDS.minZ);
    maxZ = Math.max(maxZ, LANDMARK_BOUNDS.maxZ);
    viewTarget.x = (minX + maxX) / 2;
    viewTarget.z = (minZ + maxZ) / 2;
    // Étendue projetée en iso (azimut ~45°) : l'axe écran-x porte (dx+dz)/√2,
    // + marge généreuse pour la dérive de caméra et les toits.
    const spanX = (maxX - minX) + 3.5;
    const spanZ = (maxZ - minZ) + 3.5;
    const projected = (spanX + spanZ) / (2 * Math.SQRT2) + 2.2;
    const halfWorld = 26 * 0.56;
    const fittedZoom = halfWorld / Math.max(4, projected);
    // Portrait canvases dedicate their upper half to the DOM hero copy. A
    // modest crop makes the factory readable in the remaining visual band.
    const minZoom = isMobile ? 1.16 : 1;
    const boost = isMobile ? 1.16 : 1;
    viewTarget.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, fittedZoom * boost));
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
    const theme = worldTheme();
    const rig = theme ? theme.lighting : {
      hemisphereSky: 0xeaf4ee,
      hemisphereGround: 0x514735,
      hemisphereIntensity: 0.84,
      sunColor: 0xffd394,
      sunIntensity: 2.34,
      sunPosition: { x: 13, y: 22, z: 15 },
      rimColor: 0x91d8dd,
      rimIntensity: 0.34,
      rimPosition: { x: -11, y: 13, z: -14 },
      skyClear: 0xe8f4ec,
      skySmog: 0xc4b98c,
      groundClear: 0x4b594e,
      groundSmog: 0x554b38,
      fogClear: 0xc9dfdc,
      fogSmog: 0xb8ad82
    };
    const hemi = new THREE.HemisphereLight(
      rig.hemisphereSky,
      rig.hemisphereGround,
      rig.hemisphereIntensity
    );
    scene.add(hemi);
    // One warm side key supplies long illustrated shadows and catches the
    // chamfered silhouettes. On capable
    // desktop layouts its shadow map is cached: it is refreshed only when the
    // architectural state changes, never for trucks, smoke or flying paper.
    const sun = new THREE.DirectionalLight(rig.sunColor, rig.sunIntensity);
    sun.position.set(rig.sunPosition.x, rig.sunPosition.y, rig.sunPosition.z);
    if (shadowsEnabled) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -18;
      sun.shadow.camera.right = 18;
      sun.shadow.camera.top = 18;
      sun.shadow.camera.bottom = -18;
      sun.shadow.camera.near = 2;
      sun.shadow.camera.far = 58;
      sun.shadow.bias = -0.00045;
      sun.shadow.normalBias = 0.028;
    }
    scene.add(sun);
    // Cool opposing rim separates steel/pipes from the warm painted horizon.
    // It has no shadow map and therefore remains inexpensive on mobile.
    const rim = new THREE.DirectionalLight(rig.rimColor, rig.rimIntensity);
    rim.position.set(rig.rimPosition.x, rig.rimPosition.y, rig.rimPosition.z);
    scene.add(rim);
    lights = {
      hemi,
      sun,
      rim,
      sunMin: rig.sunIntensity - 0.28,
      sunRange: 0.56,
      rimMin: Math.max(0.16, rig.rimIntensity - 0.16),
      rimRange: 0.4,
      skyClear: new THREE.Color(rig.skyClear),
      skySmog: new THREE.Color(rig.skySmog),
      groundClear: new THREE.Color(rig.groundClear),
      groundSmog: new THREE.Color(rig.groundSmog),
      fogClear: new THREE.Color(rig.fogClear),
      fogSmog: new THREE.Color(rig.fogSmog)
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
      scene.fog = new THREE.Fog(0xc9dfdc, 24, 62);
    }
    if (!lights.skyTarget) {
      // Instances réutilisées : pas d'allocation dans la boucle chaude.
      lights.skyTarget = new THREE.Color();
      lights.groundTarget = new THREE.Color();
      lights.fogTarget = new THREE.Color();
    }
    const stepTo = (obj, prop, target) => {
      const next = obj[prop] + (target - obj[prop]) * k;
      obj[prop] = Math.abs(next - target) > 0.002 ? next : target;
    };
    // Le smog rapproche l'horizon et le réchauffe, sans replonger le campus
    // dans la nuit : la silhouette et les couleurs restent toujours lisibles.
    stepTo(scene.fog, "far", 62 - smog * 22);
    stepTo(lights.sun, "intensity", lights.sunMin + Math.max(0, Math.min(1, lastStats.quality)) * lights.sunRange);
    stepTo(lights.rim, "intensity", lights.rimMin + Math.max(0, Math.min(1, lastStats.brandImage)) * lights.rimRange);
    lights.skyTarget.lerpColors(lights.skyClear, lights.skySmog, smog);
    lights.groundTarget.lerpColors(lights.groundClear, lights.groundSmog, smog);
    lights.fogTarget.lerpColors(lights.fogClear, lights.fogSmog, smog);
    if (instant) {
      lights.hemi.color.copy(lights.skyTarget);
      lights.hemi.groundColor.copy(lights.groundTarget);
      scene.fog.color.copy(lights.fogTarget);
    } else {
      lights.hemi.color.lerp(lights.skyTarget, k);
      lights.hemi.groundColor.lerp(lights.groundTarget, k);
      scene.fog.color.lerp(lights.fogTarget, k);
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

  function scenicMaterial(THREE, color, options) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color,
      roughness: 0.82,
      metalness: 0,
      flatShading: false
    }, options || {}));
  }

  function sharedWorldGeometry(THREE, kind, segments) {
    const theme = worldTheme();
    if (theme && theme.geometry) return theme.geometry(THREE, kind, segments);
    if (kind === "box" || kind === "chamferBox") return new THREE.BoxGeometry(1, 1, 1);
    if (kind === "cylinder") return new THREE.CylinderGeometry(0.5, 0.5, 1, segments || 12);
    if (kind === "cone") return new THREE.ConeGeometry(0.5, 1, segments || 8);
    if (kind === "icosahedron") return new THREE.IcosahedronGeometry(0.5, 1);
    if (kind === "plane") return new THREE.PlaneGeometry(1, 1);
    throw new Error("Unknown scenic geometry: " + kind);
  }

  function configureScenicShadows(mesh, name) {
    if (!mesh || !shadowsEnabled) return mesh;
    const label = name || "";
    const receiverOnly = /ground-slab|campus-roads|campus-pads|road-markings|factory-apron/.test(label);
    const unshadowed = /distant-|cloud|windows|sign-logo|paper-web|printed-sheets/.test(label);
    mesh.castShadow = !receiverOnly && !unshadowed && !(mesh.material && mesh.material.transparent);
    mesh.receiveShadow = !unshadowed;
    return mesh;
  }

  function markShadowDirty() {
    if (shadowsEnabled && renderer && renderer.shadowMap) {
      renderer.shadowMap.needsUpdate = true;
    }
  }

  /** One draw call for an arbitrary set of scaled/rotated boxes. */
  function addBoxBatch(THREE, parent, material, specs, name, geometryKind) {
    if (!specs.length) return null;
    const mesh = new THREE.InstancedMesh(
      sharedWorldGeometry(THREE, geometryKind || "box"),
      material,
      specs.length
    );
    const dummy = new THREE.Object3D();
    specs.forEach((spec, index) => {
      dummy.position.set(spec.x || 0, spec.y || 0, spec.z || 0);
      dummy.rotation.set(spec.rx || 0, spec.ry || 0, spec.rz || 0);
      dummy.scale.set(spec.w || 1, spec.h || 1, spec.d || 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (spec.color != null) mesh.setColorAt(index, new THREE.Color(spec.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = name || "scenery-boxes";
    configureScenicShadows(mesh, mesh.name);
    parent.add(mesh);
    return mesh;
  }

  /** One draw call for low-poly columns, chimneys, rolls or lamp posts. */
  function addCylinderBatch(THREE, parent, material, specs, name, segments) {
    if (!specs.length) return null;
    const mesh = new THREE.InstancedMesh(
      sharedWorldGeometry(THREE, "cylinder", Math.max(10, segments || 12)),
      material,
      specs.length
    );
    const dummy = new THREE.Object3D();
    specs.forEach((spec, index) => {
      const radius = spec.r || 0.5;
      dummy.position.set(spec.x || 0, spec.y || 0, spec.z || 0);
      dummy.rotation.set(spec.rx || 0, spec.ry || 0, spec.rz || 0);
      dummy.scale.set(radius * 2, spec.h || 1, radius * 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = name || "scenery-cylinders";
    configureScenicShadows(mesh, mesh.name);
    parent.add(mesh);
    return mesh;
  }

  function addConeBatch(THREE, parent, material, specs, name) {
    if (!specs.length) return null;
    const mesh = new THREE.InstancedMesh(
      sharedWorldGeometry(THREE, "cone", 6),
      material,
      specs.length
    );
    const dummy = new THREE.Object3D();
    specs.forEach((spec, index) => {
      const radius = spec.r || 0.5;
      dummy.position.set(spec.x || 0, spec.y || 0, spec.z || 0);
      dummy.rotation.set(spec.rx || 0, spec.ry || 0, spec.rz || 0);
      dummy.scale.set(radius * 2, spec.h || 1, radius * 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = name || "scenery-cones";
    configureScenicShadows(mesh, mesh.name);
    parent.add(mesh);
    return mesh;
  }

  /** One draw call for pipe elbows, roof tanks and other round details. */
  function addSphereBatch(THREE, parent, material, specs, name) {
    if (!specs.length) return null;
    const mesh = new THREE.InstancedMesh(
      sharedWorldGeometry(THREE, "icosahedron"),
      material,
      specs.length
    );
    const dummy = new THREE.Object3D();
    specs.forEach((spec, index) => {
      dummy.position.set(spec.x || 0, spec.y || 0, spec.z || 0);
      dummy.rotation.set(spec.rx || 0, spec.ry || 0, spec.rz || 0);
      const radius = spec.r || 0.5;
      dummy.scale.set(
        (spec.sx || radius) * 2,
        (spec.sy || radius) * 2,
        (spec.sz || radius) * 2
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = name || "scenery-spheres";
    configureScenicShadows(mesh, mesh.name);
    parent.add(mesh);
    return mesh;
  }

  /**
   * Permanent campus dressing. Empty concrete pads make the world readable at
   * quantity 0 but never imply ownership: they carry no buildingId and are not
   * part of raycastTargets().
   */
  function buildGround(THREE, parent, palette) {
    const ground = new THREE.Group();
    ground.name = "decorative-ground";

    addBoxBatch(THREE, ground, palette.ground, [
      { x: 0, y: -0.3, z: -1.7, w: 31, h: 0.6, d: 23 }
    ], "ground-slab");

    addBoxBatch(THREE, ground, palette.road, [
      { x: 0, y: 0.035, z: 2.4, w: 28, h: 0.07, d: 1.55 },
      { x: 0, y: 0.035, z: -2.4, w: 28, h: 0.07, d: 1.55 },
      { x: 10.8, y: 0.036, z: 0, w: 1.7, h: 0.07, d: 11 }
    ], "campus-roads");

    const pads = Object.keys(window.CityLayout.LOTS).map(id => {
      const lot = window.CityLayout.LOTS[id];
      return { x: lot.x, y: 0.06, z: lot.z, w: lot.w + 0.45, h: 0.1, d: lot.d + 0.45 };
    });
    pads.push(
      { x: 0, y: 0.045, z: 3.45, w: 28, h: 0.09, d: 0.52 },
      { x: 0, y: 0.045, z: 1.35, w: 28, h: 0.09, d: 0.52 },
      { x: 0, y: 0.045, z: -1.35, w: 28, h: 0.09, d: 0.52 },
      { x: 0, y: 0.045, z: -3.45, w: 28, h: 0.09, d: 0.52 },
      // Broad civic apron for the permanent printworks and its demonstration
      // presses. It deliberately covers a short road segment like a factory
      // forecourt, giving the landmark room to dominate the hero composition.
      { x: 8.3, y: 0.065, z: -4.95, w: 8.15, h: 0.12, d: 7.45 }
    );
    addBoxBatch(THREE, ground, palette.concrete, pads, "campus-pads");

    const markings = [];
    for (let x = -12; x <= 12; x += 2.4) {
      markings.push(
        { x, y: 0.079, z: 2.4, w: 1.05, h: 0.018, d: 0.07 },
        { x, y: 0.079, z: -2.4, w: 1.05, h: 0.018, d: 0.07 }
      );
    }
    [-8, 0, 8].forEach(crossingX => {
      [-2, -1, 0, 1, 2].forEach(offset => {
        markings.push(
          { x: crossingX + offset * 0.22, y: 0.081, z: 2.4, w: 0.11, h: 0.02, d: 1.08 },
          { x: crossingX + offset * 0.22, y: 0.081, z: -2.4, w: 0.11, h: 0.02, d: 1.08 }
        );
      });
    });
    for (let z = -6.3; z <= -4.1; z += 0.55) {
      markings.push({ x: 11.16, y: 0.083, z, w: 0.62, h: 0.018, d: 0.055 });
    }
    addBoxBatch(THREE, ground, palette.marking, markings, "road-markings");

    const treePositions = [];
    for (let x = -12; x <= 6; x += 3) treePositions.push({ x, z: -7.55 });
    [-11.8, -7.8, -3.8, 0.2, 4.2, 8.2].forEach(x => treePositions.push({ x, z: 7.55 }));
    addCylinderBatch(THREE, ground, palette.treeTrunk, treePositions.map(p => ({
      x: p.x, y: 0.28, z: p.z, r: 0.085, h: 0.56
    })), "tree-trunks", 5);
    addConeBatch(THREE, ground, palette.treeCrown, treePositions.map((p, i) => ({
      x: p.x, y: 1.02 + (i % 2) * 0.08, z: p.z, r: 0.48, h: 1.1 + (i % 3) * 0.12
    })), "tree-crowns");

    const lampPositions = [];
    [-11, -6, -1, 4, 9].forEach(x => {
      lampPositions.push({ x, z: 3.15 }, { x, z: -3.15 });
    });
    addCylinderBatch(THREE, ground, palette.metal, lampPositions.map(p => ({
      x: p.x, y: 0.72, z: p.z, r: 0.035, h: 1.42
    })), "lamp-posts", 6);
    addBoxBatch(THREE, ground, palette.window, lampPositions.map(p => ({
      x: p.x, y: 1.47, z: p.z, w: 0.18, h: 0.13, d: 0.18
    })), "lamp-heads");

    const crates = [
      { x: -12.2, y: 0.2, z: 6.3, w: 0.58, h: 0.4, d: 0.58, ry: 0.08 },
      { x: -11.55, y: 0.17, z: 6.45, w: 0.48, h: 0.34, d: 0.48, ry: -0.12 },
      { x: 12.15, y: 0.2, z: 5.5, w: 0.58, h: 0.4, d: 0.58, ry: -0.08 },
      { x: 11.65, y: 0.15, z: 6.05, w: 0.42, h: 0.3, d: 0.42, ry: 0.15 }
    ];
    addBoxBatch(THREE, ground, palette.kraft, crates, "shipping-crates");
    const paperStacks = [];
    [-12.15, 12.1].forEach((x, side) => {
      for (let i = 0; i < 7; i++) {
        paperStacks.push({
          x, y: 0.1 + i * 0.07, z: side ? 4.75 : 5.35,
          w: 1.05, h: 0.06, d: 0.76, ry: (i - 3) * 0.025
        });
      }
    });
    addBoxBatch(THREE, ground, palette.paper, paperStacks, "paper-stacks");

    parent.add(ground);
  }

  /**
   * Original municipal printworks landmark. It is permanent scenery rather
   * than a purchasable tier, deliberately has no buildingId and therefore can
   * never consume a game click.
   */
  function addFactoryLogo(THREE, landmark) {
    let plane = null;
    const texture = new THREE.TextureLoader().load(
      assetUrl("/assets/brand/papers-empire-logo-v2.webp"),
      loaded => {
        if (disposed) {
          loaded.dispose();
          decorativeTextures.delete(loaded);
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = renderer
          ? Math.min(4, renderer.capabilities.getMaxAnisotropy())
          : 1;
        loaded.needsUpdate = true;
        if (plane) plane.visible = true;
        needsRender = true;
      },
      undefined,
      () => {
        // The geometric paper-and-crown mark immediately behind the plane is
        // the deliberate offline / missing-asset fallback.
        if (plane) plane.visible = false;
        needsRender = true;
      }
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    decorativeTextures.add(texture);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false
    });
    plane = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.945), material);
    plane.name = "printworks-sign-logo";
    plane.position.set(1.28, 3.22, 0.177);
    plane.visible = false;
    configureScenicShadows(plane, plane.name);
    landmark.add(plane);
  }

  function buildPrintworksLandmark(THREE, parent, palette) {
    const landmark = new THREE.Group();
    landmark.name = "decorative-printworks";
    landmark.userData.decorative = true;
    landmark.position.set(8.25, 0.08, -4.95);
    landmark.scale.setScalar(1.34);

    // A broad paved plinth binds the plant, its loading dock and the two
    // demonstration press lines into one readable industrial campus.
    addBoxBatch(THREE, landmark, palette.concrete, [
      { x: 0, y: 0, z: 0.35, w: 5.9, h: 0.07, d: 5.2 }
    ], "factory-apron");

    const blueBoxes = [
      { x: -0.1, y: 1.0, z: -0.42, w: 4.85, h: 2.0, d: 2.82 },
      { x: 1.28, y: 2.42, z: -0.58, w: 1.55, h: 4.84, d: 1.5 },
      { x: -2.22, y: 0.72, z: 0.04, w: 1.18, h: 1.44, d: 1.72 },
      { x: 2.27, y: 0.82, z: 0.15, w: 0.72, h: 1.64, d: 1.6 },
      // Press housings on the forecourt.
      { x: -1.15, y: 0.72, z: 1.42, w: 1.04, h: 1.18, d: 0.9 },
      { x: 0.58, y: 0.67, z: 1.34, w: 1.0, h: 1.08, d: 0.88 }
    ];
    addBoxBatch(
      THREE,
      landmark,
      palette.steelBlue,
      blueBoxes,
      "printworks-blue-masses",
      "chamferBox"
    );

    const inkBoxes = [
      { x: -0.1, y: 2.03, z: -0.42, w: 5.04, h: 0.16, d: 3.0 },
      { x: 1.28, y: 4.89, z: -0.58, w: 1.75, h: 0.16, d: 1.7 },
      { x: 0, y: 0.16, z: 1.0, w: 5.35, h: 0.24, d: 0.18 },
      // Loading-bay portals and the logo backplate.
      { x: -1.82, y: 0.66, z: 1.005, w: 0.72, h: 1.05, d: 0.09 },
      { x: -0.82, y: 0.66, z: 1.005, w: 0.72, h: 1.05, d: 0.09 },
      { x: 1.28, y: 3.22, z: 0.168, w: 1.38, h: 1.08, d: 0.1 },
      // Two conveyors aimed toward the viewer.
      { x: -1.15, y: 0.29, z: 2.05, w: 0.8, h: 0.26, d: 2.55 },
      { x: 0.58, y: 0.27, z: 1.99, w: 0.78, h: 0.24, d: 2.42 },
      { x: -1.56, y: 0.47, z: 2.05, w: 0.08, h: 0.48, d: 2.58 },
      { x: -0.74, y: 0.47, z: 2.05, w: 0.08, h: 0.48, d: 2.58 },
      { x: 0.18, y: 0.44, z: 1.99, w: 0.07, h: 0.42, d: 2.45 },
      { x: 0.98, y: 0.44, z: 1.99, w: 0.07, h: 0.42, d: 2.45 }
    ];
    [-1.72, -0.86, 0, 0.86].forEach(x => {
      inkBoxes.push({ x, y: 2.22, z: -0.48, w: 1.03, h: 0.11, d: 2.08, rz: 0.39 });
    });
    addBoxBatch(THREE, landmark, palette.ink, inkBoxes, "printworks-ink-structure");

    const paperBoxes = [
      { x: -0.18, y: 1.05, z: 1.01, w: 3.45, h: 1.55, d: 0.08 },
      { x: 1.28, y: 1.22, z: 0.174, w: 1.13, h: 1.28, d: 0.055 },
      { x: -1.15, y: 0.465, z: 2.05, w: 0.62, h: 0.045, d: 2.34 },
      { x: 0.58, y: 0.435, z: 1.99, w: 0.6, h: 0.045, d: 2.21 },
      // Geometric logo fallback behind the asynchronously loaded artwork.
      { x: 1.15, y: 3.18, z: 0.224, w: 0.36, h: 0.27, d: 0.025, rz: -0.08 },
      { x: 1.36, y: 3.23, z: 0.226, w: 0.36, h: 0.27, d: 0.025, rz: 0.07 }
    ];
    for (let i = 0; i < 7; i++) {
      paperBoxes.push({
        x: 1.93,
        y: 0.12 + i * 0.065,
        z: 2.34,
        w: 0.82,
        h: 0.052,
        d: 0.64,
        ry: (i - 3) * 0.028
      });
    }
    addBoxBatch(THREE, landmark, palette.paper, paperBoxes, "printworks-paper-web");

    const orangeBoxes = [
      { x: -2.49, y: 1.18, z: 0.2, w: 0.16, h: 1.75, d: 1.72 },
      { x: 2.49, y: 1.18, z: 0.2, w: 0.16, h: 1.75, d: 1.72 },
      { x: -0.1, y: 1.52, z: 1.058, w: 3.55, h: 0.12, d: 0.06 },
      { x: -1.15, y: 1.33, z: 1.43, w: 1.12, h: 0.11, d: 0.96 },
      { x: 0.58, y: 1.25, z: 1.35, w: 1.08, h: 0.1, d: 0.94 }
    ];
    addBoxBatch(THREE, landmark, palette.orange, orangeBoxes, "printworks-orange-details");

    const printedSheets = [];
    [-1.15, 0.58].forEach((x, line) => {
      for (let i = 0; i < 5; i++) {
        printedSheets.push({
          x,
          y: line ? 0.47 : 0.5,
          z: 1.35 + i * 0.37,
          w: 0.34,
          h: 0.022,
          d: 0.11
        });
      }
    });
    pressSheetLayer = addBoxBatch(
      THREE,
      landmark,
      palette.orange,
      printedSheets,
      "printworks-printed-sheets"
    );

    const windows = [];
    [-1.95, -1.35, -0.75, -0.15, 0.45].forEach(x => {
      windows.push({ x, y: 1.0, z: 1.062, w: 0.35, h: 0.42, d: 0.045 });
    });
    [1.25, 2.0, 2.75, 3.5, 4.25].forEach(y => {
      windows.push(
        { x: 0.98, y, z: 0.178, w: 0.26, h: 0.39, d: 0.04 },
        { x: 1.58, y, z: 0.178, w: 0.26, h: 0.39, d: 0.04 },
        { x: 2.06, y, z: -0.57, w: 0.04, h: 0.38, d: 0.28 }
      );
    });
    addBoxBatch(THREE, landmark, palette.window, windows, "printworks-windows");

    const metalCylinders = [
      { x: -1.72, y: 3.0, z: -0.95, r: 0.18, h: 2.05 },
      { x: -0.95, y: 2.82, z: -1.0, r: 0.15, h: 1.7 },
      { x: 0.05, y: 2.74, z: -1.02, r: 0.13, h: 1.5 },
      { x: 1.72, y: 5.28, z: -0.72, r: 0.09, h: 0.82 },
      // Roof tanks.
      { x: 0.66, y: 2.63, z: -0.7, r: 0.32, h: 0.68 },
      { x: 1.92, y: 1.86, z: -0.86, r: 0.27, h: 0.58 }
    ];
    [-1.15, 0.58].forEach((x, line) => {
      [1.2, 1.68, 2.16].forEach((z, i) => {
        metalCylinders.push({
          x,
          y: (line ? 0.67 : 0.71) + (i % 2) * 0.04,
          z,
          r: line ? 0.19 : 0.22,
          h: line ? 0.84 : 0.9,
          rz: Math.PI / 2
        });
      });
    });
    addCylinderBatch(THREE, landmark, palette.metal, metalCylinders, "printworks-machinery", 12);

    const paperRolls = [-1.15, 0.58].map((x, line) => ({
      x,
      y: line ? 0.65 : 0.7,
      z: 0.86,
      r: line ? 0.3 : 0.34,
      h: line ? 0.82 : 0.9,
      rz: Math.PI / 2
    }));
    addCylinderBatch(THREE, landmark, palette.paper, paperRolls, "printworks-paper-rolls", 14);

    const orangeCylinders = [
      // Chimney and tank caps.
      { x: -1.72, y: 4.01, z: -0.95, r: 0.22, h: 0.16 },
      { x: -0.95, y: 3.65, z: -1, r: 0.19, h: 0.15 },
      { x: 0.05, y: 3.47, z: -1.02, r: 0.17, h: 0.14 },
      { x: 1.72, y: 5.66, z: -0.72, r: 0.13, h: 0.13 },
      // Exterior pipe circuit: vertical risers plus x/z runs.
      { x: 2.5, y: 2.4, z: -0.78, r: 0.09, h: 3.2 },
      { x: 1.42, y: 3.98, z: -0.78, r: 0.09, h: 2.15, rz: Math.PI / 2 },
      { x: 0.36, y: 3.28, z: -0.78, r: 0.08, h: 1.4 },
      { x: 0.36, y: 2.62, z: -0.05, r: 0.08, h: 1.46, rx: Math.PI / 2 },
      { x: -2.43, y: 1.42, z: -1.14, r: 0.075, h: 1.72 },
      { x: -1.74, y: 2.25, z: -1.14, r: 0.075, h: 1.38, rz: Math.PI / 2 }
    ];
    [-1.15, 0.58].forEach((x, line) => {
      const half = line ? 0.46 : 0.5;
      orangeCylinders.push(
        { x: x - half, y: line ? 0.67 : 0.71, z: 1.2, r: line ? 0.22 : 0.25, h: 0.07, rz: Math.PI / 2 },
        { x: x + half, y: line ? 0.67 : 0.71, z: 1.2, r: line ? 0.22 : 0.25, h: 0.07, rz: Math.PI / 2 },
        { x: x - half, y: line ? 0.71 : 0.75, z: 2.16, r: line ? 0.22 : 0.25, h: 0.07, rz: Math.PI / 2 },
        { x: x + half, y: line ? 0.71 : 0.75, z: 2.16, r: line ? 0.22 : 0.25, h: 0.07, rz: Math.PI / 2 }
      );
    });
    addCylinderBatch(THREE, landmark, palette.orange, orangeCylinders, "printworks-orange-pipes", 12);
    addSphereBatch(THREE, landmark, palette.orange, [
      { x: 2.5, y: 3.98, z: -0.78, r: 0.13 },
      { x: 0.36, y: 3.98, z: -0.78, r: 0.12 },
      { x: 0.36, y: 2.62, z: -0.78, r: 0.11 },
      { x: -2.43, y: 2.25, z: -1.14, r: 0.105 }
    ], "printworks-pipe-elbows");

    addConeBatch(THREE, landmark, palette.orange, [
      { x: 1.28, y: 3.72, z: 0.227, r: 0.16, h: 0.16, rx: Math.PI / 2, rz: Math.PI / 4 }
    ], "printworks-crown-mark");

    addFactoryLogo(THREE, landmark);

    parent.add(landmark);
  }

  /** Distant industrial silhouette and soft low-poly clouds, each batched. */
  function buildHorizon(THREE, parent, palette) {
    const horizon = new THREE.Group();
    horizon.name = "decorative-horizon";
    const skyline = [];
    const skylineColors = [0x627987, 0x748b94, 0x829392, 0x91a19d, 0x5b7180, 0x9aa897];
    const layerCounts = [13, 10, 8];
    layerCounts.forEach((count, layer) => {
      const step = 31 / Math.max(1, count - 1);
      for (let i = 0; i < count; i++) {
        const h = 1.05 + ((i * 17 + layer * 9) % 30) / 10 + layer * 0.2;
        skyline.push({
          x: -15.5 + i * step + (layer % 2 ? 0.65 : 0),
          y: h / 2 - 0.05,
          z: -10.5 - layer * 2.2 - (i % 3) * 0.32,
          w: 1.1 + ((i + layer) % 3) * 0.38,
          h,
          d: 1.0 + (i % 3) * 0.18,
          color: skylineColors[(i + layer * 2) % skylineColors.length]
        });
      }
    });
    // A distant editorial-city landmark echoes the reference skyline without
    // competing with the much more saturated foreground printworks.
    skyline.push(
      { x: 13.3, y: 3.25, z: -13.7, w: 1.05, h: 6.5, d: 1.05, color: 0x71858d },
      { x: 13.3, y: 6.78, z: -13.7, w: 0.62, h: 0.56, d: 0.62, color: 0x637985 }
    );
    const buildings = addBoxBatch(THREE, horizon, palette.skyline, skyline, "distant-skyline");
    if (buildings) buildings.frustumCulled = false;

    const distantWindows = [];
    skyline.forEach((b, i) => {
      if (b.z < -12.2 || i % 2) return;
      const rows = Math.max(1, Math.floor(b.h / 0.9));
      for (let row = 0; row < Math.min(3, rows); row++) {
        distantWindows.push({
          x: b.x + (i % 2 ? -0.24 : 0.24),
          y: 0.55 + row * 0.72,
          z: b.z + b.d / 2 + 0.015,
          w: 0.22,
          h: 0.24,
          d: 0.035
        });
      }
    });
    addBoxBatch(THREE, horizon, palette.window, distantWindows, "distant-windows");

    addCylinderBatch(THREE, horizon, palette.skylineDark, [
      { x: -11.5, y: 2.7, z: -10.1, r: 0.18, h: 5.4 },
      { x: -9.8, y: 2.1, z: -10.8, r: 0.13, h: 4.2 },
      { x: 12.2, y: 2.45, z: -10.4, r: 0.16, h: 4.9 },
      { x: 13.3, y: 7.6, z: -13.7, r: 0.085, h: 1.15 }
    ], "distant-stacks", 8);

    cloudLayer = new THREE.Group();
    cloudLayer.name = "cloud-layer";
    const cloudLobes = [
      [-2.8, 3.65, -8.4, 1.45, 0.5, 0.68],
      [-1.65, 3.82, -8.45, 1.05, 0.68, 0.74],
      [-0.6, 3.62, -8.4, 1.35, 0.46, 0.64],
      [0.7, 4.05, -7.4, 1.35, 0.5, 0.66],
      [1.85, 4.22, -7.45, 1.0, 0.68, 0.72],
      [2.85, 4.0, -7.4, 1.28, 0.46, 0.62],
      [3.8, 4.45, -6.8, 1.4, 0.52, 0.68],
      [5.0, 4.62, -6.85, 1.0, 0.7, 0.76],
      [6.0, 4.4, -6.8, 1.32, 0.48, 0.64],
      [-8.4, 5.0, -11.5, 1.25, 0.46, 0.62],
      [-7.35, 5.18, -11.55, 0.94, 0.64, 0.7],
      [-6.38, 4.98, -11.5, 1.18, 0.44, 0.6],
      [9.2, 5.35, -12.2, 1.34, 0.48, 0.64],
      [10.35, 5.52, -12.25, 0.98, 0.66, 0.72],
      [11.35, 5.3, -12.2, 1.2, 0.45, 0.61]
    ];
    const cloudMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.75, 1),
      palette.cloud,
      cloudLobes.length
    );
    const dummy = new THREE.Object3D();
    cloudLobes.forEach((v, i) => {
      dummy.position.set(v[0], v[1], v[2]);
      dummy.scale.set(v[3], v[4], v[5]);
      dummy.rotation.set(0, (i % 3) * 0.16, 0);
      dummy.updateMatrix();
      cloudMesh.setMatrixAt(i, dummy.matrix);
    });
    cloudMesh.instanceMatrix.needsUpdate = true;
    cloudMesh.frustumCulled = false;
    cloudLayer.add(cloudMesh);
    horizon.add(cloudLayer);
    parent.add(horizon);
  }

  function buildDecorativeWorld(THREE) {
    decorativeWorld = new THREE.Group();
    decorativeWorld.name = "decorative-world";
    const theme = worldTheme();
    const palette = theme && theme.createPalette ? theme.createPalette(THREE) : {
      ground: scenicMaterial(THREE, 0x66866c, { roughness: 0.98 }),
      concrete: scenicMaterial(THREE, 0xd7c7a5, { roughness: 0.94 }),
      road: scenicMaterial(THREE, 0x40505a, { roughness: 0.9, metalness: 0.02 }),
      marking: scenicMaterial(THREE, 0xf4d89b, { roughness: 0.88 }),
      paper: scenicMaterial(THREE, 0xf5ead2, { roughness: 0.96 }),
      kraft: scenicMaterial(THREE, 0xc89d5e, { roughness: 0.9 }),
      ink: scenicMaterial(THREE, 0x263746, { roughness: 0.82, metalness: 0.03 }),
      steelBlue: scenicMaterial(THREE, 0x355c70, { roughness: 0.7, metalness: 0.1 }),
      orange: scenicMaterial(THREE, 0xe7601e, { roughness: 0.64, metalness: 0.03 }),
      metal: scenicMaterial(THREE, 0x8b9aa0, { roughness: 0.46, metalness: 0.46 }),
      window: scenicMaterial(THREE, 0xffb13b, {
        roughness: 0.48,
        emissive: 0xff8b24,
        emissiveIntensity: 0.52
      }),
      treeTrunk: scenicMaterial(THREE, 0x6d4b30, { roughness: 1 }),
      treeCrown: scenicMaterial(THREE, 0x4f774d, { roughness: 1 }),
      skyline: scenicMaterial(THREE, 0xffffff, { roughness: 1 }),
      skylineDark: scenicMaterial(THREE, 0x526773, { roughness: 0.94 })
    };
    if (sceneMode === "playing" && !mattePaintingPresent()) {
      // Clouds deliberately remain unlit/translucent. They only exist for a
      // standalone gameplay scene with no raster matte behind the canvas.
      palette.cloud = new THREE.MeshBasicMaterial({
        color: 0xfff3db,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        fog: false,
        toneMapped: false
      });
    }
    buildGround(THREE, decorativeWorld, palette);
    buildPrintworksLandmark(THREE, decorativeWorld, palette);
    if (palette.cloud) {
      buildHorizon(THREE, decorativeWorld, palette);
    }
    scene.add(decorativeWorld);
  }

  /**
   * Camions de livraison qui circulent sur les deux routes (z = +/-2.4).
   * Deux InstancedMesh (caisse + cabine) partagent géométrie et matériau :
   * tout le parc tient en 2 draw calls, quel que soit le nombre affiché.
   * Palette atelier V4 : caisse acier bleu, cabine orange. Cap dur = 8.
   */
  const TRUCK_CAP = 8;

  function buildTrucks(THREE) {
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.26, 0.28);
    const cabGeo = new THREE.BoxGeometry(0.16, 0.2, 0.26);
    const theme = worldTheme();
    const bodyMat = theme
      ? theme.material(THREE, "steelBlue")
      : scenicMaterial(THREE, 0x355c70, { roughness: 0.7, metalness: 0.1 });
    const cabMat = theme
      ? theme.material(THREE, "orange")
      : scenicMaterial(THREE, 0xe7601e, { roughness: 0.64, metalness: 0.03 });
    const body = new THREE.InstancedMesh(bodyGeo, bodyMat, TRUCK_CAP);
    const cab = new THREE.InstancedMesh(cabGeo, cabMat, TRUCK_CAP);
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cab.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Hors du champ tant qu'aucun camion n'est actif (matrice à l'échelle 0).
    body.count = TRUCK_CAP;
    cab.count = TRUCK_CAP;
    scene.add(body, cab);

    // État par camion : route (z de base), sens (+/-x), voie (à droite),
    // position x et vitesse. Répartis sur les deux routes et deux sens.
    const states = [];
    for (let i = 0; i < TRUCK_CAP; i++) {
      const roadZ = i % 2 === 0 ? 2.4 : -2.4;
      const dir = i % 4 < 2 ? 1 : -1;
      states.push({
        roadZ,
        dir,
        lane: roadZ - dir * 0.3,
        x: -13.5 + (i / TRUCK_CAP) * 27,
        speed: 0.9 + ((i * 37) % 70) / 100
      });
    }
    trucks = { body, cab, states, dummy: new THREE.Object3D(), active: -1 };
  }

  /**
   * Fumées de cheminées (roadmap 0.18) : un InstancedMesh de bouffées qui
   * montent et se dissipent au-dessus des bâtiments industriels possédés.
   * Une seule surface transparente = 1 draw call ; animées hors reduce-motion.
   */
  const SMOKE_SOURCES = [
    { id: "factory40", x: -4, y: 1.7, z: -5 },
    { id: "offsetPress", x: 2.5, y: 1.15, z: 5 }
  ];
  const SMOKE_PER_SOURCE = 5;

  function buildSmoke(THREE) {
    const total = SMOKE_SOURCES.length * SMOKE_PER_SOURCE;
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const matSmoke = new THREE.MeshLambertMaterial({
      color: 0xcfc6b4, transparent: true, opacity: 0.42,
      depthWrite: false, flatShading: true
    });
    const mesh = new THREE.InstancedMesh(geo, matSmoke, total);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.renderOrder = 2;
    scene.add(mesh);
    const puffs = [];
    for (let src = 0; src < SMOKE_SOURCES.length; src++) {
      for (let k = 0; k < SMOKE_PER_SOURCE; k++) {
        puffs.push({ src, phase: k / SMOKE_PER_SOURCE, speed: 0.22 + (k % 3) * 0.05, jx: 0 });
      }
    }
    smoke = { mesh, puffs, dummy: new THREE.Object3D() };
  }

  function updateSmoke(THREE, dtSec, still) {
    if (!smoke) return false;
    // Reduce-motion : fumées figées (aucune animation ambiante).
    if (still || !particlesEnabled()) {
      smoke.mesh.visible = false;
      return false;
    }
    smoke.mesh.visible = true;
    const d = smoke.dummy;
    for (let i = 0; i < smoke.puffs.length; i++) {
      const p = smoke.puffs[i];
      const source = SMOKE_SOURCES[p.src];
      const owned = lotGroups[source.id] && lotGroups[source.id].visible;
      if (!owned) {
        d.position.set(0, -50, 0);
        d.scale.set(0.0001, 0.0001, 0.0001);
        d.updateMatrix();
        smoke.mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      p.phase += p.speed * dtSec;
      if (p.phase >= 1) {
        p.phase -= 1;
        p.jx = (((i * 53) % 20) - 10) / 100;
      }
      const rise = p.phase * 1.4;
      // Bouffée : grossit puis s'efface (échelle en cloche).
      const grow = Math.sin(Math.min(1, p.phase) * Math.PI);
      const sc = 0.4 + grow * 0.8;
      d.position.set(source.x + p.jx + p.phase * 0.25, source.y + rise, source.z);
      d.scale.set(sc, sc, sc);
      d.rotation.set(0, p.phase * 1.5, 0);
      d.updateMatrix();
      smoke.mesh.setMatrixAt(i, d.matrix);
    }
    smoke.mesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  /**
   * Feuilles de papier qui s'envolent au-dessus du campus : un InstancedMesh
   * de plans crème dérivant en arc et voletant, respawn continu. 1 draw call,
   * animé hors reduce-motion et si particules activées.
   */
  const PAPER_COUNT = 5;

  function buildPapers(THREE) {
    const geo = new THREE.PlaneGeometry(0.26, 0.34);
    const matPaper = new THREE.MeshLambertMaterial({
      color: 0xf6ecd6, side: THREE.DoubleSide, flatShading: true
    });
    const mesh = new THREE.InstancedMesh(geo, matPaper, PAPER_COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const sheets = [];
    for (let i = 0; i < PAPER_COUNT; i++) {
      sheets.push({
        phase: i / PAPER_COUNT,
        speed: 0.05 + (i % 3) * 0.02,
        z: -6 + i * 2.6,
        spin: 0.6 + (i % 4) * 0.3
      });
    }
    papers = { mesh, sheets, dummy: new THREE.Object3D() };
  }

  function updatePapers(THREE, dtSec, still, timeMs) {
    if (!papers) return false;
    if (still || !particlesEnabled()) {
      papers.mesh.visible = false;
      return false;
    }
    papers.mesh.visible = true;
    const t = (timeMs || 0) / 1000;
    const d = papers.dummy;
    for (let i = 0; i < papers.sheets.length; i++) {
      const p = papers.sheets[i];
      p.phase += p.speed * dtSec;
      if (p.phase >= 1) p.phase -= 1;
      const x = -13 + p.phase * 26;
      // Arc doux + flottement vertical.
      const y = 2.2 + Math.sin(p.phase * Math.PI) * 1.6 + Math.sin(t * 1.5 + i) * 0.2;
      d.position.set(x, y, p.z + Math.sin(t * 0.7 + i) * 0.4);
      d.rotation.set(t * p.spin, t * p.spin * 0.7, t * p.spin * 0.4);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      papers.mesh.setMatrixAt(i, d.matrix);
    }
    papers.mesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  /**
   * Tampon géant « APPROUVÉ » qui s'abat sur le campus au prestige : plane
   * texturé (seal-crest.png) qui descend avec un rebond, marque, puis
   * s'efface. Effet ponctuel via SceneEffects (respecte reduce-motion : le
   * prestige n'appelle cette fonction que hors mode still).
   */
  function spawnPrestigeStamp(THREE) {
    if (!window.SceneEffects) return;
    if (!prestigeStamp) {
      const tex = new THREE.TextureLoader().load(assetUrl("/assets/images/seal-crest.png"));
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(5.5, 5.5);
      const matStamp = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false, depthTest: false
      });
      const mesh = new THREE.Mesh(geo, matStamp);
      mesh.rotation.x = -Math.PI / 2; // à plat sur le sol
      mesh.renderOrder = 10;
      mesh.visible = false;
      scene.add(mesh);
      prestigeStamp = mesh;
    }
    const mesh = prestigeStamp;
    const cx = viewTarget.x;
    const cz = viewTarget.z;
    mesh.visible = true;
    window.SceneEffects.add({
      duration: 1500,
      onUpdate(t) {
        // Descente rebondie (0 -> 0.55), maintien, disparition (0.75 -> 1).
        const drop = Math.min(1, t / 0.55);
        const eased = 1 - Math.pow(1 - drop, 3);
        mesh.position.set(cx, 6.5 - eased * 6.4, cz);
        const appear = Math.min(1, t / 0.4);
        const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        mesh.material.opacity = 0.92 * appear * fade;
        const s = 0.7 + eased * 0.35;
        mesh.scale.set(s, s, s);
        needsRender = true;
      },
      onDone() {
        mesh.visible = false;
        mesh.material.opacity = 0;
      }
    });
  }

  function truckCountFor(totalBuildings) {
    // Two supplier/service vehicles make the campus feel inhabited before the
    // first purchase without claiming player production. Owned buildings still
    // grow the fleet using the exact same capped progression as before.
    return Math.max(2, Math.min(TRUCK_CAP, 1 + Math.floor(totalBuildings / 3)));
  }

  /** Retourne true si une frame doit être rendue (apparition/mouvement). */
  function updateTrucks(THREE, dtSec, still, totalBuildings) {
    if (!trucks) return false;
    const active = truckCountFor(totalBuildings);
    const countChanged = active !== trucks.active;
    trucks.active = active;
    // En reduce-motion, on ne bouge pas : on (re)pose seulement les caisses
    // à un état stationnaire quand leur nombre change.
    if (still && !countChanged) return false;

    const d = trucks.dummy;
    for (let i = 0; i < TRUCK_CAP; i++) {
      const st = trucks.states[i];
      if (i >= active) {
        d.position.set(0, -50, 0);
        d.scale.set(0.0001, 0.0001, 0.0001);
        d.updateMatrix();
        trucks.body.setMatrixAt(i, d.matrix);
        trucks.cab.setMatrixAt(i, d.matrix);
        continue;
      }
      if (!still) {
        st.x += st.dir * st.speed * dtSec;
        if (st.x > 14) st.x = -14;
        else if (st.x < -14) st.x = 14;
      }
      d.scale.set(1, 1, 1);
      d.rotation.set(0, 0, 0);
      d.position.set(st.x, 0.17, st.lane);
      d.updateMatrix();
      trucks.body.setMatrixAt(i, d.matrix);
      d.position.set(st.x + st.dir * 0.29, 0.14, st.lane);
      d.updateMatrix();
      trucks.cab.setMatrixAt(i, d.matrix);
    }
    trucks.body.instanceMatrix.needsUpdate = true;
    trucks.cab.instanceMatrix.needsUpdate = true;
    return true;
  }

  function configureBuildingShadows(group) {
    if (!group) return;
    group.traverse(object => {
      if (!object.isMesh) return;
      if (object.name === "shadow") {
        // The recipe's inexpensive painted blob remains the mobile fallback;
        // showing it together with a real shadow would double-darken the base.
        object.visible = !shadowsEnabled;
        object.castShadow = false;
        object.receiveShadow = false;
        return;
      }
      object.castShadow = shadowsEnabled && !(object.material && object.material.transparent);
      object.receiveShadow = shadowsEnabled;
    });
    // Cached shadow maps must not contain poses from continuously moving parts.
    const moving = [];
    if (group.userData.armSegments) moving.push(...group.userData.armSegments);
    if (group.userData.ring) moving.push(group.userData.ring);
    moving.forEach(node => node.traverse(object => {
      if (object.isMesh) object.castShadow = false;
    }));
  }

  /** Creates (once) the group for each building lot, initially hidden. */
  function buildLots(THREE) {
    const layout = window.CityLayout;
    const recipes = window.BuildingRecipes;
    layout.BUILDING_IDS.forEach(id => {
      const lot = layout.LOTS[id];
      const group = recipes.build(THREE, id);
      if (!group) return;
      configureBuildingShadows(group);
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
      if (o.geometry && !o.geometry.userData.peWorldShared) o.geometry.dispose();
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
        configureBuildingShadows(group);
      }
      if (firstAppearance && !initialSync && window.SceneEffects && !reduceMotion()) {
        window.SceneEffects.popIn(group);
      }
      // Desktop can turn quantity into a small campus. On mobile, the growth
      // stages already communicate progression; extra full recipes would take
      // the scene from ~186 to ~476 draw calls at the visual cap.
      const desktopCopies = layout.copiesFor(b.id, b.quantity);
      const visualCopies = isMobile ? Math.min(1, desktopCopies) : desktopCopies;
      const offsets = layout.duplicateOffsets(b.id, visualCopies);
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
        configureBuildingShadows(copy);
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
        configureBuildingShadows(clone);
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
      markShadowDirty();
    }
    lastStats = snapshot.stats;
    lastQuantities = {};
    snapshot.buildings.forEach(b => {
      lastQuantities[b.id] = b.quantity;
    });
    return changed;
  }

  function scheduleFrame(THREE, delayMs = 0) {
    if (disposed || !running || rafId || sleepTimer) return;
    if (delayMs > 0) {
      sleepTimer = window.setTimeout(() => {
        sleepTimer = 0;
        if (!disposed && running && !rafId) {
          rafId = requestAnimationFrame(t => animate(THREE, t));
        }
      }, delayMs);
      return;
    }
    rafId = requestAnimationFrame(t => animate(THREE, t));
  }

  function wakeScene() {
    if (disposed || !running || !THREERef) return;
    needsRender = true;
    if (sleepTimer) {
      clearTimeout(sleepTimer);
      sleepTimer = 0;
    }
    scheduleFrame(THREERef);
  }

  function animate(THREE, timeMs) {
    if (disposed) return;
    rafId = 0;
    if (!running || !stageInView || document.hidden || !sceneEnabled()) {
      // Personne ne regarde : les notifications de juice accumulées
      // n'auront plus de sens au retour — on les jette au fil de l'eau.
      const queue = window.__PE_SCENE_EVENTS__;
      if (queue && queue.length) queue.length = 0;
      // Keep a very slow poll as a fallback for browsers that throttle
      // observer callbacks; visibility/intersection changes wake immediately.
      scheduleFrame(THREE, 750);
      return;
    }
    const still = reduceMotion();
    scheduleFrame(THREE, still ? 250 : 0);
    // Time-based cap is stable on 60/120/144 Hz panels. Skipping every other
    // rAF would still render 60 fps on an iPhone ProMotion display.
    if (!still) {
      const frameInterval = 1000 / (isMobile ? 30 : 60);
      const sinceLastFrame = timeMs - lastFrameTick;
      if (lastFrameTick && sinceLastFrame < frameInterval) return;
      lastFrameTick = timeMs - (sinceLastFrame % frameInterval);
    }

    // Belt-and-braces sizing: ResizeObserver/timers can be throttled away
    // in hidden or embedded documents, and a stage that was 0-sized at
    // init (background-tab load) would otherwise keep a broken frustum.
    if (--sizeCheckCountdown <= 0) {
      sizeCheckCountdown = 30;
      if (applySize) applySize();
    }

    const bridge = window.__PE_SCENE__;
    const snapshot = bridge ? bridge.getSnapshot() : null;
    if (snapshot && syncBuildings(THREE, snapshot)) {
      needsRender = true;
    }
    if (still && pressSheetLayer && pressSheetLayer.position.z !== 0) {
      pressSheetLayer.position.z = 0;
      needsRender = true;
    }

    // Camions : dt borné (l'onglet a pu être masqué), nombre lié à l'empire.
    const nowMs = timeMs || 0;
    const dtSec = Math.min(0.1, Math.max(0, (nowMs - lastTruckMs) / 1000));
    lastTruckMs = nowMs;
    const truckTotal = snapshot
      ? snapshot.buildings.reduce((sum, b) => sum + (b.quantity || 0), 0)
      : 0;
    if (updateTrucks(THREE, dtSec, still, truckTotal) && still) {
      needsRender = true;
    }
    if (updateSmoke(THREE, dtSec, still)) {
      needsRender = true;
    }
    if (updatePapers(THREE, dtSec, still, nowMs)) {
      needsRender = true;
    }
    drainSceneEvents(THREE);
      if (window.SceneEffects) {
        if (still) {
        // reduce-motion activé en cours de vol : on amène les effets
        // actifs à leur état final (avec nettoyage) au lieu de les
        // laisser s'animer jusqu'au bout.
          if (window.SceneEffects.finishAll()) {
            needsRender = true;
            markShadowDirty();
          }
        } else if (window.SceneEffects.tick(timeMs || 0)) {
          needsRender = true;
          markShadowDirty();
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
      if (cloudLayer) {
        // Translate the whole instanced layer: one object update, no per-cloud
        // matrices in the hot loop. Reduced-motion freezes its current pose.
        cloudLayer.position.x = Math.sin(t * 0.055) * 0.7;
      }
      if (pressSheetLayer) {
        // A tiny synchronized feed motion is enough to make both press lines
        // feel operational without rewriting per-instance matrices.
        pressSheetLayer.position.z = Math.sin(t * 1.15) * 0.055;
      }
      animated.armSegments.forEach((seg, i) => {
        seg.rotation.z = Math.sin(t * 0.8 + i * 0.9) * 0.35;
      });
      animated.rings.forEach(ring => {
        ring.rotation.y = t * 0.4;
      });
    }
    renderer.render(scene, camera);
    announceFirstFrame();
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
      if (lotGroups[id].visible) targets.push(lotGroups[id]);
      lotCopies[id].forEach(copy => {
        if (copy.visible) targets.push(copy);
      });
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
      if (sceneMode !== "playing" || document.documentElement.dataset.experience !== "playing") return;
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
      if (event.pointerType === "touch") return;
      if (sceneMode !== "playing") {
        canvas.style.cursor = "";
        return;
      }
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
            fx.burst(THREE, scene, origin, 0xfbbf24, 12);
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
            spawnPrestigeStamp(THREE);
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

  /**
   * The canvas deliberately stays transparent: the CSS stage owns the sky
   * gradient and can change with .sky-* without an opaque WebGL rectangle.
   * Fog and lights remain bright enough for every time-of-day skin.
   */
  var skyObserver = null;

  function applySkyBackground() {
    if (!scene || !renderer) return;
    scene.background = null;
    renderer.setClearColor(0xffffff, 0);
    needsRender = true;
  }

  function watchSky(THREE) {
    applySkyBackground();
    if (!("MutationObserver" in window)) return;
    skyObserver = new MutationObserver(() => {
      applySkyBackground();
      wakeScene();
    });
    skyObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  function watchExperienceMode() {
    if (!("MutationObserver" in window)) return;
    experienceObserver = new MutationObserver(() => {
      const next = normalizeSceneMode(document.documentElement.dataset.experience);
      if (next && next !== sceneMode) {
        sceneMode = next;
        updateViewTarget();
      }
      wakeScene();
    });
    experienceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-experience", "data-scene-enabled"]
    });
  }

  function watchVisibility() {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          stageInView = e.isIntersecting;
          if (stageInView) wakeScene();
        });
      });
      io.observe(stageEl);
    }
    document.addEventListener("visibilitychange", () => {
      wakeScene();
    });
  }

  function watchResize(THREE) {
    const apply = () => {
      if (!renderer) return;
      const w = stageEl.clientWidth;
      const h = stageEl.clientHeight;
      if (!w || !h) return;
      const wasMobile = isMobile;
      isMobile = window.innerWidth < MOBILE_MAX_WIDTH;
      if (isMobile !== wasMobile) {
        // Copy caps differ across this breakpoint. Invalidating the snapshot
        // removes/adds clones even when game quantities themselves did not move.
        lastQuantities = null;
        updateViewTarget();
      }
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
      resizeObserver = new ResizeObserver(() => {
        if (resizeRafId) return;
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = 0;
          apply();
        });
      });
      resizeObserver.observe(stageEl);
    } else {
      onWindowResize = apply;
      window.addEventListener("resize", onWindowResize);
    }
    apply();
  }

  function disposeDecorativeWorld() {
    if (decorativeWorld) {
      const geometries = new Set();
      const materials = new Set();
      decorativeWorld.traverse(object => {
        if (object.geometry && !object.geometry.userData.peWorldShared) geometries.add(object.geometry);
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            if (!material.userData.peWorldShared) materials.add(material);
          });
        } else if (object.material && !object.material.userData.peWorldShared) {
          materials.add(object.material);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      if (scene) scene.remove(decorativeWorld);
      decorativeWorld = null;
      cloudLayer = null;
      pressSheetLayer = null;
    }
    decorativeTextures.forEach(texture => texture.dispose());
    decorativeTextures.clear();
  }

  function dispose() {
    disposed = true;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (sleepTimer) {
      clearTimeout(sleepTimer);
      sleepTimer = 0;
    }
    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = 0;
    }
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
    if (skyObserver) {
      skyObserver.disconnect();
      skyObserver = null;
    }
    if (experienceObserver) {
      experienceObserver.disconnect();
      experienceObserver = null;
    }
    disposeDecorativeWorld();
    if (papers) {
      papers.mesh.geometry.dispose();
      papers.mesh.material.dispose();
      papers = null;
    }
    if (smoke) {
      smoke.mesh.geometry.dispose();
      smoke.mesh.material.dispose();
      smoke = null;
    }
    if (prestigeStamp) {
      prestigeStamp.geometry.dispose();
      if (prestigeStamp.material.map) prestigeStamp.material.map.dispose();
      prestigeStamp.material.dispose();
      prestigeStamp = null;
    }
    if (trucks) {
      trucks.body.geometry.dispose();
      if (!trucks.body.material.userData.peWorldShared) trucks.body.material.dispose();
      trucks.cab.geometry.dispose();
      if (!trucks.cab.material.userData.peWorldShared) trucks.cab.material.dispose();
      trucks = null;
    }
    if (window.BuildingRecipes && window.BuildingRecipes.disposeResources) {
      window.BuildingRecipes.disposeResources();
    }
    const theme = worldTheme();
    if (theme && theme.dispose && THREERef) theme.dispose(THREERef);
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    THREERef = null;
  }

  window.CityScene = {
    /** Optional pre-init hook for a future full gameplay canvas. */
    setMode(mode) {
      const normalized = normalizeSceneMode(mode);
      if (!normalized || renderer) return false;
      requestedSceneMode = normalized;
      return true;
    },
    /**
     * Boots the diorama. Returns true on success, false when prerequisites
     * are missing — the loader then leaves the CSS fallback in place.
     */
    init(THREE, canvasEl) {
      if (!THREE || !canvasEl || !window.CityLayout || !window.BuildingRecipes) {
        return false;
      }
      canvas = canvasEl;
      THREERef = THREE;
      disposed = false;
      firstFrameRendered = false;
      contextUnavailable = false;
      stageEl = canvas.closest(".stage") || canvas.parentElement;
      sceneMode = resolveSceneMode(canvasEl);
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: finePointerEffects(),
          alpha: true,
          powerPreference: "low-power"
        });
      } catch (err) {
        return false;
      }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;
      renderer.setClearColor(0xffffff, 0);
      shadowsEnabled = finePointerEffects();
      renderer.shadowMap.enabled = shadowsEnabled;
      if (shadowsEnabled) {
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
      }
      scene = new THREE.Scene();
      scene.background = null;
      scene.fog = new THREE.Fog(0xc9dfdc, 24, 62);
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
      placeCamera(BASE_AZIMUTH);
      buildLights(THREE);
      buildDecorativeWorld(THREE);
      buildTrucks(THREE);
      buildSmoke(THREE);
      buildPapers(THREE);
      buildLots(THREE);
      updateViewTarget();
      markShadowDirty();
      watchResize(THREE);
      watchSky(THREE);
      watchExperienceMode();
      watchVisibility();
      wirePointer(THREE);
      // File des notifications de jeu (achats/événements/prestige) que
      // app.js alimente ; absente = no-op côté jeu.
      window.__PE_SCENE_EVENTS__ = [];
      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        contextUnavailable = true;
        dispose();
        if (stageEl) stageEl.classList.remove("scene-active");
        canvas.dispatchEvent(new CustomEvent("pe:scene-unavailable"));
      });
      running = true;
      scheduleFrame(THREE);
      // Debug/measurement handle, including headless environments where
      // document.hidden pauses the normal loop.
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
        trucks: () => trucks ? { active: trucks.active, cap: TRUCK_CAP } : null,
        truckSample: () => trucks && trucks.active > 0
          ? trucks.states.slice(0, trucks.active).map(t => +t.x.toFixed(2))
          : [],
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
          shadowsEnabled,
          needsRender,
          disposed
        }),
        mode: () => sceneMode,
        /** Syncs state and renders a single frame, bypassing pause guards. */
        renderOnce() {
          if (!renderer) return null;
          if (applySize) applySize();
          const bridge = window.__PE_SCENE__;
          if (bridge) syncBuildings(THREE, bridge.getSnapshot());
          drainSceneEvents(THREE);
          if (bridge) {
            const total = bridge.getSnapshot().buildings.reduce((a, b) => a + (b.quantity || 0), 0);
            updateTrucks(THREE, 0, true, total);
          }
          if (window.SceneEffects) window.SceneEffects.tick(performance.now());
          applyAmbiance(THREE, true);
          easeView(true);
          placeCamera(BASE_AZIMUTH);
          renderer.render(scene, camera);
          announceFirstFrame();
          markAmbianceRendered();
          return renderer.info.render.triangles;
        }
      };
      return true;
    },
    dispose
  };
})();
