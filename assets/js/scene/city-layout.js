/**
 * CityLayout — deterministic lot placement for the 3D campus.
 *
 * Pure math, zero DOM/three.js access, so it can be unit-tested in Node
 * (see tests/scene-layout.test.js). Same UMD-ish export pattern as
 * modifier-utils.js.
 *
 * World: ground spans x in [-13, +13], z in [-8, +8] (26 x 16), y up.
 * Producers line the front row (z = +5), flux buildings the middle (z = 0),
 * landmarks the back row (z = -5). Roads run at z = +/-2.4.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CityLayout = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const WORLD = { width: 26, depth: 16 };

  /**
   * Lot table: center (x, z), footprint w (along x) x d (along z), and the
   * visual cap = max number of copies drawn for that building.
   *
   * Caps are sized so the copy grid below never leaves the world nor
   * touches a neighbouring lot (bounds arithmetic in duplicateOffsets).
   * Front-row lots have private depth behind them (toward z = +8) so they
   * fold into a 2x2 grid (cap 4); middle and back rows sit between roads /
   * near the edge, so they only gain one extra column (cap 2).
   */
  const LOTS = {
    reproOperator: { x: -10, z: 5, w: 1.2, d: 1.2, cap: 4 },
    reproWorkshop: { x: -6.5, z: 5, w: 1.6, d: 1.4, cap: 4 },
    digitalPress: { x: -2.5, z: 5, w: 2.2, d: 1.2, cap: 4 },
    offsetPress: { x: 2.5, z: 5, w: 2.6, d: 1.4, cap: 3 },
    clientPortal: { x: 7, z: 5, w: 1.0, d: 1.0, cap: 4 },
    finishingWorkshop: { x: -9, z: 0, w: 1.6, d: 1.2, cap: 2 },
    insertingLine: { x: -4.5, z: 0, w: 2.0, d: 1.2, cap: 2 },
    logistics: { x: 0.5, z: 0, w: 2.4, d: 1.6, cap: 2 },
    comBridge: { x: 5.5, z: 0, w: 1.4, d: 1.4, cap: 2 },
    factory40: { x: -4, z: -5, w: 3.0, d: 2.0, cap: 2 },
    pampyAI: { x: 3, z: -5, w: 2.0, d: 2.0, cap: 2 }
  };

  const BUILDING_IDS = Object.keys(LOTS);

  // Copy-grid spacing. Kept deliberately tight so every extra column stays
  // clear of the next lot. Worst gaps at max cap (right edge of copy vs
  // left edge of the neighbouring lot):
  //   reproOperator  -> reproWorkshop : -8.15 vs -7.30 (gap 0.85)
  //   reproWorkshop  -> digitalPress  : -4.05 vs -3.60 (gap 0.45)
  //   digitalPress   -> offsetPress   :  0.85 vs  1.20 (gap 0.35)
  //   offsetPress    -> clientPortal     :  6.45 vs  6.50 (gap 0.05)
  //   logistics      -> comBridge     :  4.15 vs  4.80 (gap 0.65)
  //   factory40      -> pampyAI       :  0.55 vs  2.00 (gap 1.45)
  // Second front row (z + d + 0.25) worst z-edge: reproWorkshop 7.35 < 8.
  const GAP_X = 0.05;
  const GAP_Z = 0.25;

  // Copy index -> grid slot (col along +x, row folding away from the road).
  const GRID = [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 }
  ];

  /** Growth stage for a given owned quantity (1..5). */
  function floorsFor(quantity) {
    const q = Math.max(1, Number(quantity) || 1);
    return Math.min(5, 1 + Math.floor(Math.log2(q)));
  }

  /** Number of copies to draw: 0 when unowned, else quantity up to cap. */
  function copiesFor(buildingId, quantity) {
    const lot = LOTS[buildingId];
    if (!lot) return 0;
    const q = Math.max(0, Number(quantity) || 0);
    if (q === 0) return 0;
    return Math.min(lot.cap, q);
  }

  /**
   * Local offsets (relative to the lot center) for `count` copies.
   * First copy sits on the lot center; extras fill the 2x2 grid, with a
   * tiny deterministic rotY wobble for an organic feel. Rows fold toward
   * +z on the front row (private depth behind the buildings) and toward
   * -z elsewhere. Pure and deterministic: same input, same output.
   */
  function duplicateOffsets(buildingId, count) {
    const lot = LOTS[buildingId];
    if (!lot || !count || count <= 0) return [];
    const n = Math.min(lot.cap, Math.floor(count), GRID.length);
    const stepX = lot.w + GAP_X;
    const stepZ = lot.d + GAP_Z;
    const zDir = lot.z > 0 ? 1 : -1;
    const offsets = [];
    for (let i = 0; i < n; i++) {
      const slot = GRID[i];
      offsets.push({
        x: slot.col * stepX,
        // slot.row 0 must yield exactly +0: zDir(-1) * 0 gives -0, which
        // Object.is-based comparisons (assert.deepStrictEqual) reject.
        z: slot.row === 0 ? 0 : zDir * slot.row * stepZ,
        rotY: i === 0 ? 0 : ((i * 7) % 5 - 2) * 0.02
      });
    }
    return offsets;
  }

  return { WORLD, LOTS, BUILDING_IDS, GAP_X, GAP_Z, floorsFor, copiesFor, duplicateOffsets };
});
