/**
 * PEWorldTheme — shared art direction for the illustrated industrial world.
 *
 * The scene and the procedural building recipes both consume this file. It
 * deliberately contains no DOM access, textures, loaders or post-processing:
 * the same compact material/geometry library can be reused by another canvas
 * or by a future gameplay view.
 */
(function (root) {
  "use strict";

  var COLORS = Object.freeze({
    ground: 0x66866c,
    concrete: 0xd7c7a5,
    road: 0x40505a,
    marking: 0xf4d89b,
    paper: 0xf5ead2,
    kraft: 0xc89d5e,
    ink: 0x263746,
    steelBlue: 0x355c70,
    steelLight: 0x52798b,
    orange: 0xe7601e,
    amber: 0xffb13b,
    metal: 0x8b9aa0,
    positive: 0x5f824f,
    treeTrunk: 0x6d4b30,
    treeCrown: 0x4f774d,
    skyline: 0xffffff,
    skylineDark: 0x526773,
    smoke: 0xcfc6b4
  });

  var MATERIAL_SPECS = Object.freeze({
    ground: { color: COLORS.ground, roughness: 0.98, metalness: 0 },
    concrete: { color: COLORS.concrete, roughness: 0.94, metalness: 0 },
    road: { color: COLORS.road, roughness: 0.9, metalness: 0.02 },
    marking: { color: COLORS.marking, roughness: 0.88, metalness: 0 },
    paper: { color: COLORS.paper, roughness: 0.96, metalness: 0 },
    kraft: { color: COLORS.kraft, roughness: 0.9, metalness: 0 },
    ink: { color: COLORS.ink, roughness: 0.82, metalness: 0.03 },
    steelBlue: { color: COLORS.steelBlue, roughness: 0.7, metalness: 0.1 },
    steelLight: { color: COLORS.steelLight, roughness: 0.66, metalness: 0.12 },
    orange: { color: COLORS.orange, roughness: 0.64, metalness: 0.03 },
    amber: { color: COLORS.amber, roughness: 0.56, metalness: 0.04 },
    metal: { color: COLORS.metal, roughness: 0.46, metalness: 0.46 },
    positive: { color: COLORS.positive, roughness: 0.82, metalness: 0 },
    window: {
      color: COLORS.amber,
      roughness: 0.48,
      metalness: 0,
      emissive: 0xff8b24,
      emissiveIntensity: 0.52
    },
    treeTrunk: { color: COLORS.treeTrunk, roughness: 1, metalness: 0 },
    treeCrown: { color: COLORS.treeCrown, roughness: 1, metalness: 0 },
    skyline: { color: COLORS.skyline, roughness: 1, metalness: 0 },
    skylineDark: { color: COLORS.skylineDark, roughness: 0.94, metalness: 0 }
  });

  var LIGHTING = Object.freeze({
    hemisphereSky: 0xeaf4ee,
    hemisphereGround: 0x514735,
    hemisphereIntensity: 0.84,
    sunColor: 0xffd394,
    sunIntensity: 2.34,
    sunPosition: Object.freeze({ x: 13, y: 22, z: 15 }),
    rimColor: 0x91d8dd,
    rimIntensity: 0.34,
    rimPosition: Object.freeze({ x: -11, y: 13, z: -14 }),
    fogClear: 0xc9dfdc,
    fogSmog: 0xb8ad82,
    skyClear: 0xe8f4ec,
    skySmog: 0xc4b98c,
    groundClear: 0x4b594e,
    groundSmog: 0x554b38
  });

  var materialStores = new WeakMap();
  var geometryStores = new WeakMap();

  function storeFor(stores, THREE) {
    var store = stores.get(THREE);
    if (!store) {
      store = new Map();
      stores.set(THREE, store);
    }
    return store;
  }

  function roleForColor(colorHex) {
    var roles = Object.keys(COLORS);
    for (var i = 0; i < roles.length; i++) {
      if (COLORS[roles[i]] === colorHex && MATERIAL_SPECS[roles[i]]) return roles[i];
    }
    return null;
  }

  function material(THREE, role, options) {
    options = options || {};
    var base = MATERIAL_SPECS[role] || {
      color: options.color == null ? COLORS.paper : options.color,
      roughness: 0.82,
      metalness: 0
    };
    var key = role + (options.faceted ? ":faceted" : ":smooth") +
      (options.glow ? ":glow:" + options.glow.toString(16) : "");
    var store = storeFor(materialStores, THREE);
    if (store.has(key)) return store.get(key);

    var spec = Object.assign({}, base);
    spec.flatShading = !!options.faceted;
    if (options.glow) {
      spec.color = COLORS.ink;
      spec.roughness = 0.58;
      spec.metalness = 0.06;
      spec.emissive = options.glow;
      spec.emissiveIntensity = 0.74;
    }
    var result = new THREE.MeshStandardMaterial(spec);
    result.name = "pe-world-" + key;
    result.userData.peWorldShared = true;
    store.set(key, result);
    return result;
  }

  function materialForColor(THREE, colorHex, options) {
    options = options || {};
    var role = roleForColor(colorHex);
    if (role) return material(THREE, role, options);
    return material(THREE, "custom-" + colorHex.toString(16), Object.assign({ color: colorHex }, options));
  }

  /** A unit box with clipped vertical corners: 28 triangles instead of 12. */
  function createChamferBox(THREE) {
    var c = 0.105;
    var shape = new THREE.Shape();
    shape.moveTo(-0.5 + c, -0.5);
    shape.lineTo(0.5 - c, -0.5);
    shape.lineTo(0.5, -0.5 + c);
    shape.lineTo(0.5, 0.5 - c);
    shape.lineTo(0.5 - c, 0.5);
    shape.lineTo(-0.5 + c, 0.5);
    shape.lineTo(-0.5, 0.5 - c);
    shape.lineTo(-0.5, -0.5 + c);
    shape.closePath();
    var result = new THREE.ExtrudeGeometry(shape, {
      depth: 1,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 1
    });
    result.translate(0, 0, -0.5);
    result.computeVertexNormals();
    return result;
  }

  function geometry(THREE, kind, segments) {
    var count = segments == null ? 0 : Math.max(4, Math.floor(segments));
    var key = kind + (segments ? ":" + count : "");
    var store = storeFor(geometryStores, THREE);
    if (store.has(key)) return store.get(key);

    var result;
    if (kind === "box") result = new THREE.BoxGeometry(1, 1, 1);
    else if (kind === "chamferBox") result = createChamferBox(THREE);
    else if (kind === "cylinder") result = new THREE.CylinderGeometry(0.5, 0.5, 1, count || 12);
    else if (kind === "cone") result = new THREE.ConeGeometry(0.5, 1, count || 8);
    else if (kind === "ring") result = new THREE.CylinderGeometry(0.5, 0.5, 1, count || 16, 1, true);
    else if (kind === "sphere") result = new THREE.SphereGeometry(0.5, count || 12, 8);
    else if (kind === "icosahedron") result = new THREE.IcosahedronGeometry(0.5, 1);
    else if (kind === "plane") result = new THREE.PlaneGeometry(1, 1);
    else throw new Error("Unknown PE world geometry: " + kind);

    result.name = "pe-world-" + key;
    result.userData.peWorldShared = true;
    store.set(key, result);
    return result;
  }

  function createPalette(THREE) {
    return {
      ground: material(THREE, "ground"),
      concrete: material(THREE, "concrete"),
      road: material(THREE, "road"),
      marking: material(THREE, "marking"),
      paper: material(THREE, "paper"),
      kraft: material(THREE, "kraft"),
      ink: material(THREE, "ink"),
      steelBlue: material(THREE, "steelBlue"),
      steelLight: material(THREE, "steelLight"),
      orange: material(THREE, "orange"),
      amber: material(THREE, "amber"),
      metal: material(THREE, "metal"),
      positive: material(THREE, "positive"),
      window: material(THREE, "window"),
      treeTrunk: material(THREE, "treeTrunk"),
      treeCrown: material(THREE, "treeCrown"),
      skyline: material(THREE, "skyline"),
      skylineDark: material(THREE, "skylineDark")
    };
  }

  function dispose(THREE) {
    var materials = materialStores.get(THREE);
    if (materials) {
      materials.forEach(function (entry) { entry.dispose(); });
      materialStores.delete(THREE);
    }
    var geometries = geometryStores.get(THREE);
    if (geometries) {
      geometries.forEach(function (entry) { entry.dispose(); });
      geometryStores.delete(THREE);
    }
  }

  root.PEWorldTheme = Object.freeze({
    version: 4,
    colors: COLORS,
    materialSpecs: MATERIAL_SPECS,
    lighting: LIGHTING,
    material: material,
    materialForColor: materialForColor,
    geometry: geometry,
    createPalette: createPalette,
    dispose: dispose
  });
})(typeof window !== "undefined" ? window : globalThis);
