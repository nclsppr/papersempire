import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/game/store";
import {
  getBuildingCost,
  getBuildingRate,
} from "@/game/selectors";
import { formatNumber, formatRate, cn } from "@/lib/utils";
import type { BuildingDef } from "@/game/types";
import { IsoBuilding } from "./IsoBuilding";

const SIDE_TONES: Record<string, string> = {
  "from-emerald-300 to-emerald-500": "from-emerald-500 to-emerald-700",
  "from-sky-300 to-blue-500": "from-blue-500 to-blue-700",
  "from-amber-300 to-amber-500": "from-amber-500 to-amber-700",
  "from-rose-300 to-rose-500": "from-rose-500 to-rose-700",
};

interface BuildingTileProps {
  def: BuildingDef;
}

export function BuildingTile({ def }: BuildingTileProps) {
  const [open, setOpen] = useState(false);
  const cash = useGameStore((s) => s.cash);
  const level = useGameStore((s) => s.buildings[def.id].level);
  const buyBuilding = useGameStore((s) => s.buyBuilding);
  const state = useGameStore();

  const cost = getBuildingCost(state, def.id);
  const rate = getBuildingRate(state, def.id);
  const canAfford = cash >= cost;
  const active = level > 0;
  const sideClass = SIDE_TONES[def.color] ?? "from-slate-400 to-slate-600";

  return (
    <div
      className="absolute"
      style={{
        left: `${def.position.x}%`,
        top: `${def.position.y}%`,
        transform: "translate(-50%, -100%)",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "relative block focus:outline-none",
          !active && "opacity-70 saturate-50",
        )}
        aria-label={def.name}
      >
        <IsoBuilding
          emoji={def.emoji}
          topClass={def.color}
          sideClass={sideClass}
          active={active}
        />
        {/* level badge */}
        <span
          className={cn(
            "absolute -right-1 -top-1 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-xs font-extrabold",
            active
              ? "bg-white text-foreground shadow-soft"
              : "bg-slate-200 text-slate-500",
          )}
        >
          {level > 0 ? `Lv ${level}` : "—"}
        </span>
      </button>

      {/* Floating card — anchored based on building x to stay on screen */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute top-full z-20 mt-3 w-56 origin-top",
          "rounded-2xl border border-paper-200 bg-white/95 p-3 shadow-soft backdrop-blur",
          "transition-all duration-200",
          open
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 -translate-y-1",
        )}
        style={
          def.position.x < 30
            ? { left: 0 }
            : def.position.x > 70
              ? { right: 0 }
              : { left: "50%", transform: "translateX(-50%)" }
        }
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-extrabold leading-tight">
              {def.name}
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {def.tagline}
            </div>
          </div>
          <span className="text-2xl">{def.emoji}</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-paper-100 px-2 py-1.5">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
              Income
            </div>
            <div className="font-extrabold text-money-600">
              {active ? formatRate(rate) : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-paper-100 px-2 py-1.5">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
              Level
            </div>
            <div className="font-extrabold">{level}</div>
          </div>
        </div>

        <Button
          className="mt-3 w-full"
          variant={active ? "default" : "accent"}
          size="md"
          disabled={!canAfford}
          onClick={(e) => {
            e.stopPropagation();
            buyBuilding(def.id);
          }}
        >
          {active ? <Plus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          <span>
            {active ? "Upgrade" : "Build"} · ${formatNumber(cost)}
          </span>
        </Button>
      </div>
    </div>
  );
}
