export type BuildingId =
  | "paperMaker"
  | "printingPress"
  | "packaging"
  | "delivery";

export type UpgradeId =
  | "betterPulp"
  | "fastInk"
  | "stickyTape"
  | "expressFleet"
  | "happyTeam"
  | "marketing";

export interface BuildingDef {
  id: BuildingId;
  name: string;
  tagline: string;
  emoji: string;
  baseCost: number;
  costMultiplier: number;
  baseRate: number; // cash / second per level
  color: string; // tailwind color class fragment
  position: { x: number; y: number }; // % within factory plane (0..100)
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  emoji: string;
  cost: number;
  /** Multiplier applied to a target building, or "all" for global. */
  target: BuildingId | "all";
  multiplier: number;
}

export interface BuildingState {
  level: number;
}

export interface GameState {
  cash: number;
  totalEarned: number;
  workers: number;
  buildings: Record<BuildingId, BuildingState>;
  upgrades: Record<UpgradeId, boolean>;
  lastTick: number;
}
