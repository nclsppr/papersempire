const assert = require("node:assert");
const CityLayout = require("../assets/js/scene/city-layout.js");

const { WORLD, LOTS, BUILDING_IDS, GAP_X, floorsFor, copiesFor, duplicateOffsets } = CityLayout;

// --- Lot table sanity -------------------------------------------------------
assert.strictEqual(BUILDING_IDS.length, 11, "11 buildings expected");
const EXPECTED_IDS = [
  "reproOperator", "reproWorkshop", "digitalPress", "offsetPress", "vbsPortal",
  "finishingWorkshop", "insertingLine", "logistics", "comBridge",
  "factory40", "pampyAI"
];
assert.deepStrictEqual(BUILDING_IDS, EXPECTED_IDS, "ids in lot-table order");

const halfW = WORLD.width / 2;
const halfD = WORLD.depth / 2;
for (const id of BUILDING_IDS) {
  const lot = LOTS[id];
  assert.ok(lot.w > 0 && lot.d > 0 && lot.cap > 0, id + ": positive dims/cap");
  assert.ok(Math.abs(lot.x) + lot.w / 2 <= halfW, id + ": inside world (x)");
  assert.ok(Math.abs(lot.z) + lot.d / 2 <= halfD, id + ": inside world (z)");
}

// --- floorsFor ---------------------------------------------------------------
assert.strictEqual(floorsFor(0), 1);
assert.strictEqual(floorsFor(1), 1);
assert.strictEqual(floorsFor(2), 2);
assert.strictEqual(floorsFor(4), 3);
assert.strictEqual(floorsFor(8), 4);
assert.strictEqual(floorsFor(16), 5);
assert.strictEqual(floorsFor(1000), 5, "capped at 5");

// --- copiesFor ---------------------------------------------------------------
assert.strictEqual(copiesFor("reproOperator", 0), 0);
assert.strictEqual(copiesFor("reproOperator", 1), 1);
assert.strictEqual(copiesFor("reproOperator", 3), 3);
assert.strictEqual(
  copiesFor("reproOperator", LOTS.reproOperator.cap + 10),
  LOTS.reproOperator.cap,
  "clamped to cap"
);
assert.strictEqual(copiesFor("unknown", 5), 0);

// --- duplicateOffsets --------------------------------------------------------
assert.deepStrictEqual(duplicateOffsets("unknown", 3), []);
assert.deepStrictEqual(duplicateOffsets("reproOperator", 0), []);
assert.deepStrictEqual(duplicateOffsets("reproOperator", -2), []);

for (const id of BUILDING_IDS) {
  const lot = LOTS[id];
  const offs = duplicateOffsets(id, lot.cap + 5);
  assert.strictEqual(offs.length, lot.cap, id + ": clamped to cap");
  assert.deepStrictEqual(offs[0], { x: 0, z: 0, rotY: 0 }, id + ": first at center");
  // Determinism.
  assert.deepStrictEqual(offs, duplicateOffsets(id, lot.cap + 5), id + ": deterministic");
  const seen = new Set();
  for (const o of offs) {
    // Copies stay inside the world including their footprint.
    assert.ok(Math.abs(lot.x + o.x) + lot.w / 2 <= halfW + 1e-9, id + ": copy x in world");
    assert.ok(Math.abs(lot.z + o.z) + lot.d / 2 <= halfD + 1e-9, id + ": copy z in world");
    // No two copies share a slot.
    const key = o.x.toFixed(3) + "|" + o.z.toFixed(3);
    assert.ok(!seen.has(key), id + ": no colliding offsets");
    seen.add(key);
    // Within-lot spread stays bounded (one extra column at most).
    assert.ok(Math.abs(o.x) <= lot.w + GAP_X + 1e-9, id + ": x spread bounded");
  }
}

console.log("City layout is deterministic and stays inside the world bounds.");
