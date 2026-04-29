import {
  BUILDINGS,
  BUILDINGS_BY_ID,
  UPGRADES,
  WORKER_BASE_COST,
  WORKER_BONUS,
  WORKER_COST_MULTIPLIER,
} from "./definitions";
import type { BuildingId, GameState } from "./types";

export function getBuildingCost(state: GameState, id: BuildingId): number {
  const def = BUILDINGS_BY_ID[id];
  const level = state.buildings[id].level;
  return Math.ceil(def.baseCost * Math.pow(def.costMultiplier, level));
}

export function getWorkerCost(state: GameState): number {
  return Math.ceil(
    WORKER_BASE_COST * Math.pow(WORKER_COST_MULTIPLIER, state.workers),
  );
}

export function getGlobalMultiplier(state: GameState): number {
  let mult = 1 + state.workers * WORKER_BONUS;
  for (const upgrade of UPGRADES) {
    if (upgrade.target === "all" && state.upgrades[upgrade.id]) {
      mult *= upgrade.multiplier;
    }
  }
  return mult;
}

export function getBuildingMultiplier(
  state: GameState,
  id: BuildingId,
): number {
  let mult = 1;
  for (const upgrade of UPGRADES) {
    if (upgrade.target === id && state.upgrades[upgrade.id]) {
      mult *= upgrade.multiplier;
    }
  }
  return mult;
}

export function getBuildingRate(state: GameState, id: BuildingId): number {
  const def = BUILDINGS_BY_ID[id];
  const level = state.buildings[id].level;
  if (level <= 0) return 0;
  return (
    def.baseRate *
    level *
    getBuildingMultiplier(state, id) *
    getGlobalMultiplier(state)
  );
}

export function getTotalRate(state: GameState): number {
  return BUILDINGS.reduce(
    (sum, def) => sum + getBuildingRate(state, def.id),
    0,
  );
}

export function isBuildingActive(state: GameState, id: BuildingId): boolean {
  return state.buildings[id].level > 0;
}
