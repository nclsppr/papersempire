import type { BuildingDef, BuildingId, UpgradeDef } from "./types";

/**
 * Buildings are placed along a left-to-right flow: paper is made, printed,
 * packaged, then delivered for cash. Positions are percentages within the
 * isometric factory plane.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: "paperMaker",
    name: "Paper Mill",
    tagline: "Pulps trees into fresh sheets.",
    emoji: "🌲",
    baseCost: 15,
    costMultiplier: 1.15,
    baseRate: 0.4,
    color: "from-emerald-300 to-emerald-500",
    position: { x: 14, y: 62 },
  },
  {
    id: "printingPress",
    name: "Printing Press",
    tagline: "Stamps ink onto every page.",
    emoji: "🖨️",
    baseCost: 120,
    costMultiplier: 1.18,
    baseRate: 2.4,
    color: "from-sky-300 to-blue-500",
    position: { x: 38, y: 38 },
  },
  {
    id: "packaging",
    name: "Packaging",
    tagline: "Wraps stacks into neat boxes.",
    emoji: "📦",
    baseCost: 1100,
    costMultiplier: 1.2,
    baseRate: 14,
    color: "from-amber-300 to-amber-500",
    position: { x: 62, y: 62 },
  },
  {
    id: "delivery",
    name: "Delivery",
    tagline: "Drives boxes to the cash.",
    emoji: "🚚",
    baseCost: 12000,
    costMultiplier: 1.22,
    baseRate: 80,
    color: "from-rose-300 to-rose-500",
    position: { x: 86, y: 38 },
  },
];

export const BUILDINGS_BY_ID: Record<BuildingId, BuildingDef> =
  BUILDINGS.reduce(
    (acc, b) => {
      acc[b.id] = b;
      return acc;
    },
    {} as Record<BuildingId, BuildingDef>,
  );

export const UPGRADES: UpgradeDef[] = [
  {
    id: "betterPulp",
    name: "Better Pulp",
    description: "Paper Mill produces 2× faster.",
    emoji: "🌿",
    cost: 250,
    target: "paperMaker",
    multiplier: 2,
  },
  {
    id: "fastInk",
    name: "Fast-Drying Ink",
    description: "Printing Press 2× output.",
    emoji: "💧",
    cost: 2500,
    target: "printingPress",
    multiplier: 2,
  },
  {
    id: "stickyTape",
    name: "Sticky Tape",
    description: "Packaging line 2× faster.",
    emoji: "🩹",
    cost: 25000,
    target: "packaging",
    multiplier: 2,
  },
  {
    id: "expressFleet",
    name: "Express Fleet",
    description: "Delivery 2× faster.",
    emoji: "⚡",
    cost: 250000,
    target: "delivery",
    multiplier: 2,
  },
  {
    id: "happyTeam",
    name: "Happy Team",
    description: "All buildings +25%.",
    emoji: "😊",
    cost: 50000,
    target: "all",
    multiplier: 1.25,
  },
  {
    id: "marketing",
    name: "Marketing Push",
    description: "All buildings +50%.",
    emoji: "📣",
    cost: 1000000,
    target: "all",
    multiplier: 1.5,
  },
];

/** Each hired worker gives a small global multiplier. */
export const WORKER_BASE_COST = 50;
export const WORKER_COST_MULTIPLIER = 1.35;
export const WORKER_BONUS = 0.05; // +5% per worker
export const WORKER_MAX = 25;

/** A manual click rewards this much, scaled by total earnings tier. */
export const CLICK_REWARD = 1;
