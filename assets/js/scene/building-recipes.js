/**
 * building-recipes.js — procedural illustrated miniatures for the industrial
 * campus (Papers Empire). Browser-only IIFE attaching
 * window.BuildingRecipes. three.js is NEVER imported here: every public
 * function receives the THREE namespace as its first parameter.
 *
 * World contract (shared with the scene):
 * - Ground plane y=0, buildings sit on the ground (base at y=0), +y up.
 * - Each recipe fits inside its lot footprint (w along x, d along z).
 * - floorsFor(quantity) = min(5, 1 + floor(log2(max(1, quantity)))).
 *
 * Only a compact shared geometry kit is used: chamfered boxes, smooth low-poly
 * rollers/pipes, faceted cones, planes and spheres. No texture or model load.
 */
(function () {
  "use strict";

  /** Palette V4 — same numeric values as PEWorldTheme for the fallback path. */
  var PALETTE = {
    paper: 0xf5ead2,
    accent: 0xe7601e,
    glass: 0x52798b,
    amber: 0xffb13b,
    hivis: 0xe7601e,
    good: 0x5f824f,
    slate: 0x355c70,
    roof: 0x263746,
    metal: 0x8b9aa0,
    dark: 0x263746
  };

  // --------------------------------------------------------------------------
  // Shared resources. PEWorldTheme owns the normal runtime caches; these local
  // maps preserve progressive enhancement if that tiny module fails to load.
  // --------------------------------------------------------------------------
  var materialCache = new Map();
  var emissiveCache = new Map();
  var geometryCache = new Map();
  var shadowMaterial = null;     // single shared MeshBasicMaterial

  function worldTheme() {
    return typeof window !== "undefined" ? window.PEWorldTheme : null;
  }

  function mat(THREE, colorHex, options) {
    options = options || {};
    var theme = worldTheme();
    if (theme && theme.materialForColor) {
      return theme.materialForColor(THREE, colorHex, options);
    }
    var key = colorHex + (options.faceted ? ":faceted" : ":smooth");
    var m = materialCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: colorHex === PALETTE.metal ? 0.46 : 0.78,
        metalness: colorHex === PALETTE.metal ? 0.46 : 0.04,
        flatShading: !!options.faceted
      });
      m.userData.peWorldShared = true;
      materialCache.set(key, m);
    }
    return m;
  }

  function glowMat(THREE, emissiveHex) {
    var theme = worldTheme();
    if (theme && theme.materialForColor) {
      return theme.materialForColor(THREE, emissiveHex, { glow: emissiveHex });
    }
    var m = emissiveCache.get(emissiveHex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: PALETTE.dark,
        roughness: 0.58,
        metalness: 0.06,
        emissive: emissiveHex,
        emissiveIntensity: 0.74,
        flatShading: false
      });
      m.userData.peWorldShared = true;
      emissiveCache.set(emissiveHex, m);
    }
    return m;
  }

  function getShadowMaterial(THREE) {
    if (!shadowMaterial) {
      shadowMaterial = new THREE.MeshBasicMaterial({
        color: 0x241b0f,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      shadowMaterial.userData.peWorldShared = true;
    }
    return shadowMaterial;
  }

  function sharedGeometry(THREE, kind, segments) {
    var theme = worldTheme();
    if (theme && theme.geometry) return theme.geometry(THREE, kind, segments);
    var key = kind + (segments ? ":" + segments : "");
    if (geometryCache.has(key)) return geometryCache.get(key);
    var geo;
    // The fallback deliberately uses the lightest core primitives. The normal
    // runtime path receives the chamfered box from PEWorldTheme.
    if (kind === "box" || kind === "chamferBox") geo = new THREE.BoxGeometry(1, 1, 1);
    else if (kind === "cylinder") geo = new THREE.CylinderGeometry(0.5, 0.5, 1, segments || 12);
    else if (kind === "cone") geo = new THREE.ConeGeometry(0.5, 1, segments || 8);
    else if (kind === "ring") geo = new THREE.CylinderGeometry(0.5, 0.5, 1, segments || 16, 1, true);
    else if (kind === "sphere") geo = new THREE.SphereGeometry(0.5, segments || 12, 8);
    else if (kind === "plane") geo = new THREE.PlaneGeometry(1, 1);
    else throw new Error("Unknown building geometry: " + kind);
    geo.userData.peWorldShared = true;
    geometryCache.set(key, geo);
    return geo;
  }

  // --------------------------------------------------------------------------
  // Small mesh helpers. Unit geometries are scaled per mesh: dozens of objects
  // now share a handful of GPU buffers while retaining independent transforms.
  // --------------------------------------------------------------------------
  function addBox(THREE, parent, colorHex, w, h, d, x, y, z) {
    var rounded = Math.min(Math.abs(w), Math.abs(h), Math.abs(d)) >= 0.065;
    var mesh = new THREE.Mesh(sharedGeometry(THREE, rounded ? "chamferBox" : "box"), mat(THREE, colorHex));
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function addGlowBox(THREE, parent, emissiveHex, w, h, d, x, y, z) {
    var rounded = Math.min(Math.abs(w), Math.abs(h), Math.abs(d)) >= 0.065;
    var mesh = new THREE.Mesh(sharedGeometry(THREE, rounded ? "chamferBox" : "box"), glowMat(THREE, emissiveHex));
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
  function addCylinder(THREE, parent, colorHex, rTop, rBottom, h, seg, x, y, z) {
    var equalRadius = Math.abs(rTop - rBottom) < 0.0001;
    var geometry = equalRadius
      ? sharedGeometry(THREE, "cylinder", Math.max(10, seg || 12))
      : new THREE.CylinderGeometry(rTop, rBottom, 1, Math.max(10, seg || 12));
    var mesh = new THREE.Mesh(geometry, mat(THREE, colorHex));
    if (equalRadius) mesh.scale.set(rTop * 2, h, rTop * 2);
    else mesh.scale.y = h;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // ConeGeometry(radius, height, radialSegments)
  function addCone(THREE, parent, colorHex, r, h, seg, x, y, z) {
    var mesh = new THREE.Mesh(
      sharedGeometry(THREE, "cone", seg || 8),
      mat(THREE, colorHex, { faceted: true })
    );
    mesh.scale.set(r * 2, h, r * 2);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Thin open-ended cylinder used as a glowing "ring" (no torus in the kit).
  function addGlowRing(THREE, parent, emissiveHex, radius, height, x, y, z) {
    var geo = sharedGeometry(THREE, "ring", 16);
    var mesh = new THREE.Mesh(geo, glowMat(THREE, emissiveHex));
    mesh.scale.set(radius * 2, height, radius * 2);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Tiny worker: hivis box torso + paper sphere head.
  function addWorker(THREE, parent, x, z) {
    addBox(THREE, parent, PALETTE.hivis, 0.18, 0.28, 0.12, x, 0.14, z);
    var head = new THREE.Mesh(sharedGeometry(THREE, "sphere", 10), mat(THREE, PALETTE.paper));
    head.scale.setScalar(0.18);
    head.position.set(x, 0.37, z);
    parent.add(head);
  }

  // Lowpoly truck: slate cab + paper trailer on 4 tiny dark cylinder wheels.
  // Faces +z (toward the dock apron). Returns the truck sub-group.
  function addTruck(THREE, parent, x, z) {
    var truck = new THREE.Group();
    truck.position.set(x, 0, z);
    addBox(THREE, truck, PALETTE.paper, 0.28, 0.28, 0.46, 0, 0.26, -0.06);
    addBox(THREE, truck, PALETTE.slate, 0.24, 0.2, 0.2, 0, 0.2, 0.28);
    var wheelSpots = [[-0.13, 0.12], [0.13, 0.12], [-0.13, -0.2], [0.13, -0.2]];
    for (var i = 0; i < wheelSpots.length; i++) {
      var wheel = new THREE.Mesh(
        sharedGeometry(THREE, "cylinder", 10),
        mat(THREE, PALETTE.dark)
      );
      wheel.scale.set(0.12, 0.05, 0.12);
      wheel.rotation.z = Math.PI / 2; // axle along x
      wheel.position.set(wheelSpots[i][0], 0.06, wheelSpots[i][1]);
      truck.add(wheel);
    }
    parent.add(truck);
    return truck;
  }

  // Fake blob shadow under the building.
  function addShadowPlane(THREE, group, w, d) {
    var mesh = new THREE.Mesh(
      sharedGeometry(THREE, "plane"),
      getShadowMaterial(THREE)
    );
    mesh.scale.set(w + 0.3, d + 0.3, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.name = "shadow";
    group.add(mesh);
  }

  // Removes every child of a node. Shared world geometries stay alive; only a
  // rare custom frustum, if introduced by a recipe, is owned by the child.
  function clearGroup(node) {
    for (var i = node.children.length - 1; i >= 0; i--) {
      var child = node.children[i];
      child.traverse(function (obj) {
        if (obj.geometry && !obj.geometry.userData.peWorldShared) obj.geometry.dispose();
      });
      node.remove(child);
    }
  }

  // Stores an Object3D reference on userData as a NON-enumerable property.
  // three's Object3D.copy() clones userData with JSON.parse(JSON.stringify());
  // enumerable mesh refs are circular and would crash group.clone(). Reads
  // like group.userData.armSegments still work exactly the same.
  function setHiddenRef(userData, key, value) {
    Object.defineProperty(userData, key, {
      value: value,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  /**
   * Shared growth formula (same as the scene side).
   * @param {number} quantity Owned copies of the building.
   * @returns {number} Floors in [1, 5].
   */
  function floorsFor(quantity) {
    var q = typeof quantity === "number" && isFinite(quantity) ? quantity : 1;
    return Math.min(5, 1 + Math.floor(Math.log2(Math.max(1, q))));
  }

  // --------------------------------------------------------------------------
  // The 11 recipes. Each entry: lot footprint (w x d), a static build(THREE,
  // group) pass and a grow(THREE, group, growth, floors) pass. grow() runs on
  // a freshly cleared "growth" sub-group, so it is idempotent by construction.
  // --------------------------------------------------------------------------
  var RECIPES = {

    // 1. Kiosk: paper box, slate 4-sided pyramid roof, tiny workers in a row.
    reproOperator: {
      w: 1.2, d: 1.2,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.paper, 1.0, 0.9, 0.9, 0, 0.45, 0);
        var roof = addCone(THREE, group, PALETTE.slate, 0.75, 0.5, 4, 0, 1.15, 0);
        roof.rotation.y = Math.PI / 4; // align pyramid faces with the walls
        addBox(THREE, group, PALETTE.dark, 0.28, 0.5, 0.04, 0, 0.25, 0.47);
      },
      grow: function (THREE, group, growth, floors) {
        var workers = floors; // worker count = floors
        for (var i = 0; i < workers; i++) {
          addWorker(THREE, growth, (i - (workers - 1) / 2) * 0.24, 0.51);
        }
      }
    },

    // 2. Workshop: slate hall that lengthens, amber skylight strips multiply.
    reproWorkshop: {
      w: 1.6, d: 1.4,
      build: function () { /* whole hall is rebuilt in grow() */ },
      grow: function (THREE, group, growth, floors) {
        var hallLen = 1.1 + floors * 0.08; // 1.18 .. 1.5, fits the 1.6 lot
        addBox(THREE, growth, PALETTE.slate, hallLen, 0.6, 1.0, 0, 0.3, 0);
        addBox(THREE, growth, PALETTE.paper, 0.18, 0.42, 0.04, -0.1, 0.21, 0.51);
        addBox(THREE, growth, PALETTE.paper, 0.18, 0.42, 0.04, 0.1, 0.21, 0.51);
        for (var i = 0; i < floors; i++) { // more strips instead of brighter ones
          addGlowBox(THREE, growth, PALETTE.amber, 0.16, 0.05, 0.84,
            (i - (floors - 1) / 2) * 0.26, 0.62, 0);
        }
      }
    },

    // 3. Long low press: paper body, accent stripe, roof rollers, output tray
    //    with a paper stack; extra press modules append lengthwise (max 3).
    digitalPress: {
      w: 2.2, d: 1.2,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.paper, 0.9, 0.55, 0.9, -0.6, 0.275, 0);
        addBox(THREE, group, PALETTE.accent, 0.9, 0.09, 0.03, -0.6, 0.3, 0.46);
        var r1 = addCylinder(THREE, group, PALETTE.metal, 0.12, 0.12, 0.7, 8, -0.75, 0.55, 0);
        r1.rotation.x = Math.PI / 2; // half-sunk roller, axis along z
        var r2 = addCylinder(THREE, group, PALETTE.metal, 0.12, 0.12, 0.7, 8, -0.45, 0.55, 0);
        r2.rotation.x = Math.PI / 2;
        addBox(THREE, group, PALETTE.metal, 0.32, 0.05, 0.6, 0.84, 0.28, 0); // tray
        addBox(THREE, group, PALETTE.dark, 0.06, 0.26, 0.06, 0.84, 0.13, 0); // tray leg
      },
      grow: function (THREE, group, growth, floors) {
        var modules = Math.min(3, Math.max(0, floors - 1));
        for (var i = 0; i < modules; i++) {
          var cx = -0.03 + i * 0.26;
          addBox(THREE, growth, PALETTE.paper, 0.24, 0.45, 0.8, cx, 0.225, 0);
          addBox(THREE, growth, PALETTE.metal, 0.12, 0.06, 0.3, cx, 0.48, 0);
        }
        var stack = 1 + floors; // stack height = 1 + floors tiny boxes
        for (var j = 0; j < stack; j++) {
          var sheet = addBox(THREE, growth, PALETTE.paper, 0.18, 0.05, 0.24,
            0.84, 0.33 + j * 0.055, 0);
          sheet.rotation.y = j * 0.15;
        }
      }
    },

    // 4. Industrial: slate hall, big roof drums with amber end caps, chimney.
    offsetPress: {
      w: 2.6, d: 1.4,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.slate, 2.2, 0.7, 1.1, 0, 0.35, 0);
        addCylinder(THREE, group, PALETTE.metal, 0.07, 0.07, 0.6, 8, 0.85, 1.0, -0.35);
      },
      grow: function (THREE, group, growth, floors) {
        var drums = Math.min(3, floors);
        var radius = drums === 1 ? 0.3 : (drums === 2 ? 0.26 : 0.19);
        var zSpots = drums === 1 ? [0] : (drums === 2 ? [-0.3, 0.3] : [-0.44, 0, 0.44]);
        for (var i = 0; i < drums; i++) {
          var y = 0.7 + radius * 0.55; // slightly sunk into the roof
          var drum = addCylinder(THREE, growth, PALETTE.metal,
            radius, radius, 1.3, 10, -0.1, y, zSpots[i]);
          drum.rotation.z = Math.PI / 2; // axis along x
          for (var s = -1; s <= 1; s += 2) {
            var cap = addCylinder(THREE, growth, PALETTE.amber,
              radius + 0.03, radius + 0.03, 0.08, 10, -0.1 + s * 0.69, y, zSpots[i]);
            cap.rotation.z = Math.PI / 2;
          }
        }
      }
    },

    // 5. Shed: paper box, slanted roof, giant crossed-scissors sign; pallets.
    finishingWorkshop: {
      w: 1.6, d: 1.2,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.paper, 1.2, 0.55, 0.9, 0, 0.275, 0);
        var roof = addBox(THREE, group, PALETTE.roof, 1.3, 0.08, 1.0, 0, 0.62, 0);
        roof.rotation.z = 0.18; // slanted shed roof
        addBox(THREE, group, PALETTE.metal, 0.05, 0.75, 0.05, 0.58, 0.375, 0.42);
        var bladeA = addBox(THREE, group, PALETTE.metal, 0.42, 0.06, 0.03, 0.58, 0.82, 0.41);
        bladeA.rotation.z = 0.55;
        var bladeB = addBox(THREE, group, PALETTE.metal, 0.42, 0.06, 0.03, 0.58, 0.82, 0.44);
        bladeB.rotation.z = -0.55; // crossed scissors
      },
      grow: function (THREE, group, growth, floors) {
        var pallets = Math.min(4, floors);
        for (var i = 0; i < pallets; i++) {
          var p = addBox(THREE, growth, PALETTE.paper, 0.2, 0.16, 0.2,
            -0.5 + i * 0.3, 0.08, 0.47);
          p.rotation.y = i * 0.1;
        }
        if (floors >= 5) { // one extra pallet stacked on top
          var top = addBox(THREE, growth, PALETTE.paper, 0.2, 0.16, 0.2, -0.5, 0.24, 0.47);
          top.rotation.y = 0.25;
        }
      }
    },

    // 6. Mail line: slate box, glowing slot strips, envelope sign on a pole.
    insertingLine: {
      w: 2.0, d: 1.2,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.slate, 1.7, 0.65, 0.9, 0, 0.325, 0);
      },
      grow: function (THREE, group, growth, floors) {
        for (var i = 0; i < floors; i++) { // extra slot strip per floor
          addGlowBox(THREE, growth, PALETTE.accent, 1.4, 0.08, 0.03,
            0, 0.16 + i * 0.1, 0.46);
        }
        var poleH = 0.25 + floors * 0.1; // taller pole with growth
        addBox(THREE, growth, PALETTE.metal, 0.05, poleH, 0.05, 0, 0.65 + poleH / 2, 0);
        var signY = 0.65 + poleH + 0.15;
        addBox(THREE, growth, PALETTE.paper, 0.5, 0.3, 0.05, 0, signY, 0);
        var flap = addCone(THREE, growth, PALETTE.accent, 0.16, 0.14, 4, 0, signY + 0.06, 0.035);
        flap.rotation.x = Math.PI; // apex points down: envelope flap
        flap.rotation.y = Math.PI / 4;
      }
    },

    // 7. Depot: metal box, 2 dock doors, trucks on the apron, roof antennas.
    logistics: {
      w: 2.4, d: 1.6,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.metal, 2.0, 0.8, 1.0, 0, 0.4, -0.25);
        addBox(THREE, group, PALETTE.dark, 0.5, 0.5, 0.04, -0.5, 0.28, 0.26);
        addBox(THREE, group, PALETTE.dark, 0.5, 0.5, 0.04, 0.5, 0.28, 0.26);
        addTruck(THREE, group, -0.45, 0.4);
        addTruck(THREE, group, 0.25, 0.4);
      },
      grow: function (THREE, group, growth, floors) {
        if (floors >= 2) addTruck(THREE, growth, 0.85, 0.4); // third truck
        if (floors >= 3) {
          var antennas = Math.min(3, floors - 2);
          for (var i = 0; i < antennas; i++) {
            var x = -0.5 + i * 0.5;
            addBox(THREE, growth, PALETTE.metal, 0.03, 0.45, 0.03, x, 1.025, -0.5);
            addGlowBox(THREE, growth, PALETTE.amber, 0.05, 0.05, 0.05, x, 1.27, -0.5);
          }
        }
      }
    },

    // 8. Glass office tower: stacked glass storeys, antenna ring, billboard.
    clientPortal: {
      w: 1.0, d: 1.0,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.dark, 0.3, 0.4, 0.06, 0, 0.2, 0.41); // entrance
        var billboard = new THREE.Mesh(
          sharedGeometry(THREE, "plane"),
          glowMat(THREE, PALETTE.accent)
        );
        billboard.scale.set(0.34, 0.22, 1);
        billboard.position.set(0.25, 0.32, 0.44);
        group.add(billboard);
      },
      grow: function (THREE, group, growth, floors) {
        var storeys = 1 + floors; // starts at 2 storeys (quantity 1)
        for (var i = 0; i < storeys; i++) {
          var baseY = i * 0.61;
          addBox(THREE, growth, PALETTE.glass, 0.8, 0.55, 0.8, 0, baseY + 0.275, 0);
          addBox(THREE, growth, PALETTE.slate, 0.84, 0.06, 0.84, 0, baseY + 0.58, 0);
        }
        var topY = storeys * 0.61; // re-top the antenna
        addBox(THREE, growth, PALETTE.metal, 0.04, 0.34, 0.04, 0, topY + 0.17, 0);
        addGlowRing(THREE, growth, PALETTE.accent, 0.18, 0.06, 0, topY + 0.34, 0);
        group.userData.storeys = storeys;
      }
    },

    // 9. Comms: slate base cube, growing mast, tilted dish, signal lamps.
    comBridge: {
      w: 1.4, d: 1.4,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.slate, 0.9, 0.5, 0.9, 0, 0.25, 0);
        addBox(THREE, group, PALETTE.dark, 0.24, 0.36, 0.04, 0, 0.2, 0.46);
      },
      grow: function (THREE, group, growth, floors) {
        var mastH = 0.8 + floors * 0.2;
        addBox(THREE, growth, PALETTE.metal, 0.07, mastH, 0.07, 0, 0.5 + mastH / 2, 0);
        var lamps = 2 + floors; // 3 lamps at floors=1, +1 per floor
        for (var i = 0; i < lamps; i++) {
          addGlowBox(THREE, growth, PALETTE.accent, 0.06, 0.06, 0.06,
            0.065, 0.5 + mastH * (i + 1) / (lamps + 1), 0);
        }
        var dish = addCone(THREE, growth, PALETTE.metal, 0.28, 0.12, 8,
          0.12, 0.5 + mastH + 0.04, 0);
        dish.rotation.x = Math.PI; // bowl opens upward
        dish.rotation.z = -0.5;    // tilted up toward the sky
      }
    },

    // 10. Landmark hall 2.6x1.1x1.7: sawtooth roof, facade strips, robot arm.
    factory40: {
      w: 3.0, d: 2.0,
      build: function (THREE, group) {
        addBox(THREE, group, PALETTE.slate, 2.6, 1.1, 1.7, 0, 0.55, 0);
        addCylinder(THREE, group, PALETTE.metal, 0.09, 0.09, 0.08, 8, 0.95, 1.14, 0.65);
        // Robot arm: 3 hinged amber segments; the scene animates the joints.
        var lens = [0.42, 0.34, 0.26];
        var pose = [0.3, -0.8, -0.6];
        var segments = [];
        var parentNode = group;
        for (var i = 0; i < 3; i++) {
          var joint = new THREE.Group();
          joint.name = "armSeg" + i;
          if (i === 0) {
            joint.position.set(0.95, 1.18, 0.65);
            joint.rotation.y = 0.6;
          } else {
            joint.position.set(0, lens[i - 1], 0);
          }
          joint.rotation.z = pose[i];
          addBox(THREE, joint, PALETTE.amber, 0.07, lens[i], 0.07, 0, lens[i] / 2, 0);
          parentNode.add(joint);
          parentNode = joint;
          segments.push(joint);
        }
        setHiddenRef(group.userData, "armSegments", segments);
      },
      grow: function (THREE, group, growth, floors) {
        var teeth = 3 + Math.min(2, Math.max(0, floors - 1)); // +1 bay, max +2
        var centers = [-0.5, 0, 0.5, 1.0, -1.0];
        for (var i = 0; i < teeth; i++) {
          var cx = centers[i];
          var panel = addBox(THREE, growth, PALETTE.slate, 0.5, 0.05, 1.1,
            cx - 0.06, 1.23, 0);
          panel.rotation.z = 0.5; // slanted sawtooth panel
          addGlowBox(THREE, growth, PALETTE.accent, 0.04, 0.24, 1.0,
            cx + 0.2, 1.22, 0); // vertical glass face of the tooth
        }
        for (var j = 0; j < floors; j++) { // emissive facade strip per floor
          addGlowBox(THREE, growth, PALETTE.amber, 2.2, 0.06, 0.03,
            0, 0.18 + j * 0.18, 0.87);
        }
        // Re-resolve the arm joints by name so clones get wired too.
        var segs = [];
        for (var k = 0; k < 3; k++) {
          var seg = group.getObjectByName("armSeg" + k);
          if (seg) segs.push(seg);
        }
        setHiddenRef(group.userData, "armSegments", segs);
      }
    },

    // 11. Landmark: dark plinth storeys, glowing brain dome, tilted data ring.
    pampyAI: {
      w: 2.0, d: 2.0,
      build: function () { /* plinth height varies, all built in grow() */ },
      grow: function (THREE, group, growth, floors) {
        var storeys = Math.min(3, Math.max(1, floors)); // plinth storeys, max 3
        for (var i = 0; i < storeys; i++) {
          var size = 1.5 - i * 0.18;
          addBox(THREE, growth, PALETTE.dark, size, 0.34, size, 0, 0.17 + i * 0.34, 0);
        }
        addGlowBox(THREE, growth, PALETTE.accent, 0.5, 0.06, 0.03, 0, 0.17, 0.76);
        var topY = storeys * 0.34;
        var dome = new THREE.Mesh(
          sharedGeometry(THREE, "sphere", 12),
          glowMat(THREE, PALETTE.accent)
        );
        dome.scale.setScalar(1.1);
        dome.position.set(0, topY + 0.42, 0);
        dome.name = "dome";
        growth.add(dome);
        var ring = addGlowRing(THREE, growth, PALETTE.accent, 0.8, 0.06, 0, topY + 0.42, 0);
        ring.rotation.z = 0.4; // tilted orbiting data ring
        ring.name = "ring";
        setHiddenRef(group.userData, "ring", ring);
        setHiddenRef(group.userData, "dome", dome);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Builds a lowpoly building for the given id.
   * @param {Object} THREE The three.js namespace.
   * @param {string} buildingId One of the 11 campus building ids.
   * @returns {Object|null} THREE.Group with userData.buildingId, base at y=0,
   *   fitting the lot footprint; null for unknown ids.
   */
  function build(THREE, buildingId) {
    var recipe = RECIPES[buildingId];
    if (!recipe) return null;
    var group = new THREE.Group();
    group.userData.buildingId = buildingId;
    recipe.build(THREE, group);
    var growth = new THREE.Group();
    growth.name = "growth";
    group.add(growth);
    addShadowPlane(THREE, group, recipe.w, recipe.d);
    applyQuantity(THREE, group, 1);
    return group;
  }

  /**
   * Idempotently adjusts a building's growth details for the current owned
   * quantity (called on every purchase). The "growth" sub-group is cleared
   * and rebuilt, so calling twice with the same quantity yields the same
   * result. Duplicating copies across the lot is the scene's job, not ours.
   * @param {Object} THREE The three.js namespace.
   * @param {Object} group A group produced by build() (or a clone of one).
   * @param {number} quantity Owned copies of the building.
   * @returns {Object} The same group, for chaining.
   */
  function applyQuantity(THREE, group, quantity) {
    if (!group || !group.userData) return group;
    var recipe = RECIPES[group.userData.buildingId];
    if (!recipe) return group;
    var growth = group.getObjectByName("growth");
    if (!growth) {
      growth = new THREE.Group();
      growth.name = "growth";
      group.add(growth);
    }
    var floors = floorsFor(quantity);
    clearGroup(growth);
    recipe.grow(THREE, group, growth, floors);
    group.userData.floorCount = floors;
    return group;
  }

  /** Releases only resources owned by the local progressive-enhancement path. */
  function disposeResources() {
    materialCache.forEach(function (material) { material.dispose(); });
    emissiveCache.forEach(function (material) { material.dispose(); });
    geometryCache.forEach(function (geometry) { geometry.dispose(); });
    materialCache.clear();
    emissiveCache.clear();
    geometryCache.clear();
    if (shadowMaterial) {
      shadowMaterial.dispose();
      shadowMaterial = null;
    }
  }

  window.BuildingRecipes = {
    PALETTE: PALETTE,
    floorsFor: floorsFor,
    build: build,
    applyQuantity: applyQuantity,
    disposeResources: disposeResources
  };
})();
