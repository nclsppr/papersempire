import { Hand } from "lucide-react";
import { BUILDINGS } from "@/game/definitions";
import { useGameStore } from "@/game/store";
import { isBuildingActive } from "@/game/selectors";
import { BuildingTile } from "./BuildingTile";
import { Conveyor } from "./Conveyor";
import { DeliveryTruck } from "./DeliveryTruck";
import { Floaters } from "./Floaters";

export function FactoryScene() {
  const click = useGameStore((s) => s.click);
  const state = useGameStore();

  const segments = [
    {
      from: BUILDINGS[0].position,
      to: BUILDINGS[1].position,
      active: isBuildingActive(state, "paperMaker"),
    },
    {
      from: BUILDINGS[1].position,
      to: BUILDINGS[2].position,
      active:
        isBuildingActive(state, "paperMaker") &&
        isBuildingActive(state, "printingPress"),
    },
    {
      from: BUILDINGS[2].position,
      to: BUILDINGS[3].position,
      active:
        isBuildingActive(state, "paperMaker") &&
        isBuildingActive(state, "printingPress") &&
        isBuildingActive(state, "packaging"),
    },
  ];

  const tutorialActive = state.totalEarned < 5;

  return (
    <div className="relative w-full">
      <div
        className="relative mx-auto aspect-[4/3] w-full max-w-2xl"
        role="region"
        aria-label="Factory"
        onClick={click}
      >
        {/* clipped scenery so the rounded mask hides background spills */}
        <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-paper-200 bg-gradient-to-b from-sky-50 via-white to-emerald-50 shadow-soft">
          <div className="pointer-events-none absolute right-6 top-6 h-12 w-12 rounded-full bg-sun-400 shadow-sun" />
          <div className="pointer-events-none absolute left-10 top-10 h-3 w-12 rounded-full bg-white/80 blur-[2px]" />
          <div className="pointer-events-none absolute right-24 top-12 h-3 w-16 rounded-full bg-white/70 blur-[2px]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-emerald-100 to-transparent" />
          <div
            className="pointer-events-none absolute inset-x-8 bottom-12 h-px"
            style={{
              background:
                "repeating-linear-gradient(90deg, rgba(16,185,129,0.25) 0 6px, transparent 6px 14px)",
            }}
          />
          <DeliveryTruck active={isBuildingActive(state, "delivery")} />
        </div>

        {/* unclipped layer: conveyors + buildings + popups */}
        <div className="absolute inset-0">
          {segments.map((s, i) => (
            <Conveyor
              key={i}
              fromX={s.from.x}
              fromY={s.from.y}
              toX={s.to.x}
              toY={s.to.y}
              active={s.active}
            />
          ))}
          {BUILDINGS.map((b) => (
            <BuildingTile key={b.id} def={b} />
          ))}
          <Floaters />
        </div>

        {tutorialActive && (
          <div className="pointer-events-none absolute left-1/2 bottom-6 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-soft">
            <Hand className="h-4 w-4 text-money-600" />
            <span className="text-xs font-bold text-foreground">
              Tap the world to print money
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
