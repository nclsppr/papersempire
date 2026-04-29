import { create } from "zustand";
import { BUILDINGS, CLICK_REWARD, UPGRADES, WORKER_MAX } from "./definitions";
import {
  getBuildingCost,
  getTotalRate,
  getWorkerCost,
} from "./selectors";
import type { BuildingId, GameState, UpgradeId } from "./types";

const SAVE_KEY = "papers-empire/v2";

function createInitialState(): GameState {
  const buildings = BUILDINGS.reduce(
    (acc, b) => {
      acc[b.id] = { level: 0 };
      return acc;
    },
    {} as GameState["buildings"],
  );
  const upgrades = UPGRADES.reduce(
    (acc, u) => {
      acc[u.id] = false;
      return acc;
    },
    {} as GameState["upgrades"],
  );

  return {
    cash: 0,
    totalEarned: 0,
    workers: 0,
    buildings,
    upgrades,
    lastTick: Date.now(),
  };
}

function loadState(): GameState {
  if (typeof window === "undefined") return createInitialState();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    const base = createInitialState();
    return {
      ...base,
      ...parsed,
      buildings: { ...base.buildings, ...(parsed.buildings ?? {}) },
      upgrades: { ...base.upgrades, ...(parsed.upgrades ?? {}) },
      lastTick: Date.now(),
    };
  } catch {
    return createInitialState();
  }
}

function persist(state: GameState) {
  if (typeof window === "undefined") return;
  try {
    const snapshot: GameState = {
      cash: state.cash,
      totalEarned: state.totalEarned,
      workers: state.workers,
      buildings: state.buildings,
      upgrades: state.upgrades,
      lastTick: state.lastTick,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota or private mode */
  }
}

let lastPersistAt = 0;
const PERSIST_INTERVAL_MS = 1500;

function maybePersist(state: GameState) {
  const now = Date.now();
  if (now - lastPersistAt < PERSIST_INTERVAL_MS) return;
  lastPersistAt = now;
  persist(state);
}

interface Floater {
  id: number;
  amount: number;
  x: number;
  y: number;
}

interface GameActions {
  tick: (now: number) => void;
  click: () => void;
  buyBuilding: (id: BuildingId) => void;
  buyUpgrade: (id: UpgradeId) => void;
  hireWorker: () => void;
  reset: () => void;
  popFloaters: (ids: number[]) => void;
}

interface GameStore extends GameState, GameActions {
  floaters: Floater[];
}

let floaterCounter = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  ...loadState(),
  floaters: [],

  tick: (now) => {
    const state = get();
    const elapsed = Math.max(0, (now - state.lastTick) / 1000);
    if (elapsed <= 0) return;
    const rate = getTotalRate(state);
    const earned = rate * elapsed;
    if (earned <= 0) {
      set({ lastTick: now });
      return;
    }
    const next: GameState = {
      ...state,
      cash: state.cash + earned,
      totalEarned: state.totalEarned + earned,
      lastTick: now,
    };
    set(next);
    maybePersist(next);
  },

  click: () => {
    const state = get();
    const reward = Math.max(CLICK_REWARD, getTotalRate(state) * 0.5);
    const x = 40 + Math.random() * 20;
    const y = 30 + Math.random() * 10;
    const id = ++floaterCounter;
    const next: GameState = {
      ...state,
      cash: state.cash + reward,
      totalEarned: state.totalEarned + reward,
    };
    set({
      ...next,
      floaters: [...state.floaters, { id, amount: reward, x, y }],
    });
    persist(next);
  },

  buyBuilding: (id) => {
    const state = get();
    const cost = getBuildingCost(state, id);
    if (state.cash < cost) return;
    const next: GameState = {
      ...state,
      cash: state.cash - cost,
      buildings: {
        ...state.buildings,
        [id]: { level: state.buildings[id].level + 1 },
      },
    };
    set(next);
    persist(next);
  },

  buyUpgrade: (id) => {
    const state = get();
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return;
    if (state.upgrades[id]) return;
    if (state.cash < upgrade.cost) return;
    const next: GameState = {
      ...state,
      cash: state.cash - upgrade.cost,
      upgrades: { ...state.upgrades, [id]: true },
    };
    set(next);
    persist(next);
  },

  hireWorker: () => {
    const state = get();
    if (state.workers >= WORKER_MAX) return;
    const cost = getWorkerCost(state);
    if (state.cash < cost) return;
    const next: GameState = {
      ...state,
      cash: state.cash - cost,
      workers: state.workers + 1,
    };
    set(next);
    persist(next);
  },

  reset: () => {
    const next = createInitialState();
    set({ ...next, floaters: [] });
    persist(next);
  },

  popFloaters: (ids) => {
    if (ids.length === 0) return;
    const setIds = new Set(ids);
    set((s) => ({ floaters: s.floaters.filter((f) => !setIds.has(f.id)) }));
  },
}));
