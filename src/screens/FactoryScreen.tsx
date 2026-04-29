import { Hand, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactoryScene } from "@/components/factory/FactoryScene";
import { useGameStore } from "@/game/store";
import { BUILDINGS } from "@/game/definitions";
import { getBuildingCost } from "@/game/selectors";
import { formatNumber } from "@/lib/utils";

export function FactoryScreen() {
  const click = useGameStore((s) => s.click);
  const cash = useGameStore((s) => s.cash);
  const state = useGameStore();
  const buildings = state.buildings;

  // Suggest the next building to unlock as the primary call to action.
  const nextBuild = BUILDINGS.find((b) => buildings[b.id].level === 0);
  const nextBuildCost = nextBuild ? getBuildingCost(state, nextBuild.id) : 0;
  const canAffordNext = nextBuild ? cash >= nextBuildCost : false;

  const buyBuilding = useGameStore((s) => s.buyBuilding);

  return (
    <main className="flex flex-1 flex-col gap-4 px-3 pb-2 pt-2">
      <FactoryScene />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <Button
          size="xl"
          className="w-full font-extrabold tracking-wide"
          onClick={click}
        >
          <Hand className="h-5 w-5" />
          Print money
        </Button>

        {nextBuild && (
          <Button
            size="lg"
            variant={canAffordNext ? "accent" : "soft"}
            className="w-full"
            disabled={!canAffordNext}
            onClick={() => buyBuilding(nextBuild.id)}
          >
            <Sparkles className="h-4 w-4" />
            Unlock {nextBuild.name} · ${formatNumber(nextBuildCost)}
          </Button>
        )}
      </div>
    </main>
  );
}
