(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PEInvestmentAdvice = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const MODES = ["objective", "docs", "cc", "quality", "footprint"];
  function recommend(rows, mode = "objective", goal = null) {
    if (!MODES.includes(mode)) mode = "objective";
    const candidates = (Array.isArray(rows) ? rows : []).filter(row =>
      row && row.isUnlocked !== false && row.status !== "unavailable" &&
      Number.isFinite(row.currentCost) && row.currentCost > 0);
    if (mode === "objective" && goal && goal.buildingId) {
      const row = candidates.find(item => item.id === goal.buildingId);
      if (row) return { row, reason: "target", mode };
    }
    const effective = mode === "objective"
      ? goal && goal.resource === "ccTotal" ? "cc"
        : goal && goal.stat === "quality" ? "quality"
          : goal && goal.stat === "footprint" ? "footprint"
            : goal && goal.stat === "brandImage" ? "brand" : "docs"
      : mode;
    const field = { docs: "marginalDocPerSecond", cc: "marginalCcPerSecond", quality: "qualityDelta", footprint: "footprintDelta", brand: "brandDelta" }[effective];
    const sign = effective === "footprint" ? -1 : 1;
    const scored = candidates.map(row => ({ row, gain: sign * row[field] }))
      .filter(item => Number.isFinite(item.gain) && item.gain > 1e-12)
      .sort((a, b) => b.gain / b.row.currentCost - a.gain / a.row.currentCost || a.row.currentCost - b.row.currentCost);
    return scored.length ? { row: scored[0].row, reason: effective, mode } : null;
  }
  return { MODES, recommend };
});
