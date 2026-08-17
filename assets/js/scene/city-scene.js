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

  // Camions de livraison (roadmap 0.18) : InstancedMesh plafonnés, animés
  // seulement hors reduce-motion, nombre croissant avec l'empire.
  let trucks = null;
  let lastTruckMs = 0;
  let smoke = null;      // fumées de cheminées (InstancedMesh)
  let papers = null;     // feuilles de papier volantes (InstancedMesh)
  let prestigeStamp = null; // plane texturé du tampon de prestige
  let decorativeWorld = null; // décor toujours visible, sans vérité de jeu
  let cloudLayer = null; // groupe de nuages instanciés, dérive très lente

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
    const hemi = new THREE.HemisphereLight(0xe9f3e9, 0x4b4434, 1.35);
    scene.add(hemi);
    // Warm, high sun on the camera side: readable facades without realtime
    // shadows (the scene keeps its inexpensive painted blob shadows).
    const sun = new THREE.DirectionalLight(0xffe0a8, 1.8);
    sun.position.set(12, 20, 14);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8fd4db, 0.42);
    rim.position.set(-10, 12, -14);
    scene.add(rim);
    lights = {
      hemi,
      sun,
      rim,
      skyClear: new THREE.Color(0xe8f4ec),
      skySmog: new THREE.Color(0xc4b98c),
      groundClear: new THREE.Color(0x4b594e),
      groundSmog: new THREE.Color(0x554b38),
      fogClear: new THREE.Color(0xc9dfdc),
      fogSmog: new THREE.Color(0xb8ad82)
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
    stepTo(lights.sun, "intensity", 1.55 + Math.max(0, Math.min(1, lastStats.quality)) * 0.55);
    stepTo(lights.rim, "intensity", 0.24 + Math.max(0, Math.min(1, lastStats.brandImage)) * 0.48);
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
      roughness: 0.88,
      metalness: 0,
      flatShading: true
    }, options || {}));
  }

  /** One draw call for an arbitrary set of scaled/rotated boxes. */
  function addBoxBatch(THREE, parent, material, specs, name) {
    if (!specs.length) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
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
    parent.add(mesh);
    return mesh;
  }

  /** One draw call for low-poly columns, chimneys, rolls or lamp posts. */
  function addCylinderBatch(THREE, parent, material, specs, name, segments) {
    if (!specs.length) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1, segments || 8),
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
    parent.add(mesh);
    return mesh;
  }

  function addConeBatch(THREE, parent, material, specs, name) {
    if (!specs.length) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.5, 1, 6),
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
      { x: 8.7, y: 0.06, z: -5.15, w: 5.2, h: 0.11, d: 3.8 }
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
      for (let i = 0; i < 4; i++) {
        paperStacks.push({
          x, y: 0.1 + i * 0.085, z: side ? 4.75 : 5.35,
          w: 0.78, h: 0.075, d: 0.58, ry: (i - 1.5) * 0.035
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
  function buildPrintworksLandmark(THREE, parent, palette) {
    const landmark = new THREE.Group();
    landmark.name = "decorative-printworks";
    landmark.userData.decorative = true;
    landmark.position.set(8.7, 0.12, -5.15);
    landmark.scale.setScalar(1.18);

    addBoxBatch(THREE, landmark, palette.paper, [
      { x: 0, y: 0.68, z: 0, w: 3.75, h: 1.36, d: 2.45 },
      { x: -1.68, y: 0.46, z: 0.55, w: 1.05, h: 0.92, d: 1.35 },
      { x: 0.82, y: 1.48, z: -0.28, w: 1.18, h: 2.96, d: 1.22 },
      { x: 1.55, y: 0.58, z: 0.52, w: 0.58, h: 1.16, d: 1.1 }
    ], "printworks-walls");
    addBoxBatch(THREE, landmark, palette.ink, [
      { x: 0, y: 1.39, z: 0, w: 4.02, h: 0.16, d: 2.65 },
      { x: 0.82, y: 2.99, z: -0.28, w: 1.38, h: 0.15, d: 1.42 },
      { x: -0.2, y: 0.12, z: 1.26, w: 4.2, h: 0.24, d: 0.18 },
      { x: -0.62, y: 0.57, z: 1.245, w: 0.72, h: 0.86, d: 0.08 },
      { x: 0.25, y: 0.57, z: 1.245, w: 0.72, h: 0.86, d: 0.08 }
    ], "printworks-structure");
    const roofTeeth = [-1.2, -0.4, 0.4, 1.2].map((x, i) => ({
      x, y: 1.62 + (i % 2) * 0.025, z: -0.08,
      w: 0.82, h: 0.1, d: 1.7, rz: 0.34
    }));
    roofTeeth.push(
      { x: -1.72, y: 0.96, z: 1.18, w: 0.16, h: 0.18, d: 1.2 },
      { x: 1.72, y: 0.96, z: 1.18, w: 0.16, h: 0.18, d: 1.2 }
    );
    addBoxBatch(THREE, landmark, palette.orange, roofTeeth, "printworks-orange-details");

    const windows = [];
    [-1.35, -0.72, 0.72, 1.35].forEach(x => {
      windows.push({ x, y: 0.76, z: 1.235, w: 0.36, h: 0.34, d: 0.055 });
    });
    [0.96, 1.58, 2.2].forEach(y => {
      windows.push(
        { x: 0.55, y, z: 0.345, w: 0.28, h: 0.36, d: 0.055 },
        { x: 1.09, y, z: 0.345, w: 0.28, h: 0.36, d: 0.055 },
        { x: 1.415, y, z: -0.52, w: 0.055, h: 0.36, d: 0.3 }
      );
    });
    addBoxBatch(THREE, landmark, palette.window, windows, "printworks-windows");

    addCylinderBatch(THREE, landmark, palette.metal, [
      { x: -1.18, y: 2.12, z: -0.62, r: 0.15, h: 1.48 },
      { x: -0.66, y: 1.98, z: -0.68, r: 0.12, h: 1.18 },
      { x: 1.2, y: 3.48, z: -0.38, r: 0.07, h: 0.92 }
    ], "printworks-chimneys", 10);
    addCylinderBatch(THREE, landmark, palette.orange, [
      { x: -1.18, y: 2.84, z: -0.62, r: 0.19, h: 0.16 },
      { x: -0.66, y: 2.55, z: -0.68, r: 0.16, h: 0.14 },
      { x: 1.2, y: 3.9, z: -0.38, r: 0.1, h: 0.12 }
    ], "printworks-chimney-caps", 10);

    // Three paper rolls make the trade legible even before any owned machine
    // appears. Their axes run along x and their amber caps read as press drums.
    addCylinderBatch(THREE, landmark, palette.paper, [-0.95, 0, 0.95].map(x => ({
      x, y: 0.46, z: 1.52, r: 0.29, h: 0.64, rz: Math.PI / 2
    })), "printworks-paper-rolls", 12);
    addCylinderBatch(THREE, landmark, palette.orange, [-0.95, 0, 0.95].flatMap(x => ([
      { x: x - 0.34, y: 0.46, z: 1.52, r: 0.32, h: 0.06, rz: Math.PI / 2 },
      { x: x + 0.34, y: 0.46, z: 1.52, r: 0.32, h: 0.06, rz: Math.PI / 2 }
    ])), "printworks-roll-caps", 12);

    // Text-free paper-and-crown mark on the tower facade.
    addBoxBatch(THREE, landmark, palette.ink, [
      { x: 0.82, y: 2.47, z: 0.355, w: 0.82, h: 0.46, d: 0.08 }
    ], "printworks-signboard");
    addBoxBatch(THREE, landmark, palette.paper, [
      { x: 0.72, y: 2.45, z: 0.41, w: 0.28, h: 0.2, d: 0.035, rz: -0.08 },
      { x: 0.84, y: 2.49, z: 0.415, w: 0.28, h: 0.2, d: 0.035, rz: 0.05 }
    ], "printworks-paper-mark");
    addConeBatch(THREE, landmark, palette.orange, [
      { x: 0.83, y: 2.67, z: 0.42, r: 0.12, h: 0.12, rx: Math.PI / 2, rz: Math.PI / 4 }
    ], "printworks-crown-mark");

    parent.add(landmark);
  }

  /** Distant industrial silhouette and soft low-poly clouds, each batched. */
  function buildHorizon(THREE, parent, palette) {
    const horizon = new THREE.Group();
    horizon.name = "decorative-horizon";
    const skyline = [];
    const skylineColors = [0x6f8290, 0x829392, 0x718889, 0x98a18f, 0x687d87];
    for (let i = 0; i < 13; i++) {
      const h = 1.4 + ((i * 17) % 24) / 10;
      skyline.push({
        x: -14 + i * 2.25,
        y: h / 2 - 0.02,
        z: -10.2 - (i % 3) * 0.65,
        w: 1.35 + (i % 2) * 0.45,
        h,
        d: 1.25 + (i % 3) * 0.22,
        color: skylineColors[i % skylineColors.length]
      });
    }
    const buildings = addBoxBatch(THREE, horizon, palette.skyline, skyline, "distant-skyline");
    if (buildings) buildings.frustumCulled = false;

    const distantWindows = [];
    skyline.forEach((b, i) => {
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
      { x: 12.2, y: 2.45, z: -10.4, r: 0.16, h: 4.9 }
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
      [6.0, 4.4, -6.8, 1.32, 0.48, 0.64]
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
    const palette = {
      ground: scenicMaterial(THREE, 0x66866c, { roughness: 1 }),
      concrete: scenicMaterial(THREE, 0xd7c7a5, { roughness: 0.96 }),
      road: scenicMaterial(THREE, 0x40505a, { roughness: 0.92 }),
      marking: scenicMaterial(THREE, 0xf4d89b, { roughness: 0.9 }),
      paper: scenicMaterial(THREE, 0xf5ead2, { roughness: 0.96 }),
      kraft: scenicMaterial(THREE, 0xc89d5e, { roughness: 0.92 }),
      ink: scenicMaterial(THREE, 0x263746, { roughness: 0.82 }),
      orange: scenicMaterial(THREE, 0xe7601e, { roughness: 0.68 }),
      metal: scenicMaterial(THREE, 0x8b9aa0, { roughness: 0.48, metalness: 0.42 }),
      window: scenicMaterial(THREE, 0xffb13b, {
        roughness: 0.5,
        emissive: 0xff8b24,
        emissiveIntensity: 0.58
      }),
      treeTrunk: scenicMaterial(THREE, 0x6d4b30, { roughness: 1 }),
      treeCrown: scenicMaterial(THREE, 0x4f774d, { roughness: 1 }),
      skyline: scenicMaterial(THREE, 0xffffff, { roughness: 1 }),
      skylineDark: scenicMaterial(THREE, 0x526773, { roughness: 0.94 }),
      cloud: new THREE.MeshBasicMaterial({
        color: 0xfff3db,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        fog: false,
        toneMapped: false
      })
    };
    buildGround(THREE, decorativeWorld, palette);
    buildPrintworksLandmark(THREE, decorativeWorld, palette);
    buildHorizon(THREE, decorativeWorld, palette);
    scene.add(decorativeWorld);
  }

  /**
   * Camions de livraison qui circulent sur les deux routes (z = +/-2.4).
   * Deux InstancedMesh (caisse + cabine) partagent géométrie et matériau :
   * tout le parc tient en 2 draw calls, quel que soit le nombre affiché.
   * Palette atelier : caisse crème, cabine kraft. Cap dur = 8.
   */
  const TRUCK_CAP = 8;

  function buildTrucks(THREE) {
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.26, 0.28);
    const cabGeo = new THREE.BoxGeometry(0.16, 0.2, 0.26);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf4ead2, flatShading: true });
    const cabMat = new THREE.MeshLambertMaterial({ color: 0xbf9d5f, flatShading: true });
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
      const tex = new THREE.TextureLoader().load("/assets/images/seal-crest.png");
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
    const snapshot = bridge ? bridge.getSnapshot() : null;
    if (snapshot && syncBuildings(THREE, snapshot)) {
      needsRender = true;
    }
    const still = reduceMotion();

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
      if (cloudLayer) {
        // Translate the whole instanced layer: one object update, no per-cloud
        // matrices in the hot loop. Reduced-motion freezes its current pose.
        cloudLayer.position.x = Math.sin(t * 0.055) * 0.7;
      }
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
    skyObserver = new MutationObserver(applySkyBackground);
    skyObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
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

  function disposeDecorativeWorld() {
    if (!decorativeWorld) return;
    const geometries = new Set();
    const materials = new Set();
    decorativeWorld.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) {
        object.material.forEach(material => materials.add(material));
      } else if (object.material) {
        materials.add(object.material);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    if (scene) scene.remove(decorativeWorld);
    decorativeWorld = null;
    cloudLayer = null;
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
    if (skyObserver) {
      skyObserver.disconnect();
      skyObserver = null;
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
      trucks.body.material.dispose();
      trucks.cab.geometry.dispose();
      trucks.cab.material.dispose();
      trucks = null;
    }
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
      watchResize(THREE);
      watchSky(THREE);
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
          if (bridge) {
            const total = bridge.getSnapshot().buildings.reduce((a, b) => a + (b.quantity || 0), 0);
            updateTrucks(THREE, 0, true, total);
          }
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
