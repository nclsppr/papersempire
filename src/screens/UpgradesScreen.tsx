import { Check, Lock, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BUILDINGS_BY_ID,
  UPGRADES,
  WORKER_BONUS,
  WORKER_MAX,
} from "@/game/definitions";
import { getWorkerCost } from "@/game/selectors";
import { useGameStore } from "@/game/store";
import { cn, formatNumber } from "@/lib/utils";

export function UpgradesScreen() {
  const cash = useGameStore((s) => s.cash);
  const upgrades = useGameStore((s) => s.upgrades);
  const buildings = useGameStore((s) => s.buildings);
  const workers = useGameStore((s) => s.workers);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const hireWorker = useGameStore((s) => s.hireWorker);

  const state = useGameStore();
  const workerCost = getWorkerCost(state);

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-2">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 bg-gradient-to-r from-sun-400 to-sun-500 px-5 py-4 text-amber-950">
          <Users className="h-6 w-6" />
          <div className="flex-1">
            <div className="text-sm font-extrabold">Hire workers</div>
            <div className="text-xs opacity-90">
              Each worker gives +{Math.round(WORKER_BONUS * 100)}% to all
              buildings.
            </div>
          </div>
          <span className="rounded-full bg-white/40 px-2 py-0.5 text-xs font-bold">
            {workers}/{WORKER_MAX}
          </span>
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Next worker
            </div>
            <div className="text-xl font-extrabold text-money-600">
              ${formatNumber(workerCost)}
            </div>
          </div>
          <Button
            variant="accent"
            size="lg"
            onClick={hireWorker}
            disabled={workers >= WORKER_MAX || cash < workerCost}
          >
            Hire
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-2 px-1 pt-1 text-sm font-extrabold text-muted-foreground">
        <ShoppingBag className="h-4 w-4" />
        Boosters
      </div>

      <div className="grid grid-cols-1 gap-3">
        {UPGRADES.map((u) => {
          const owned = upgrades[u.id];
          const targetUnlocked =
            u.target === "all" ||
            (buildings[u.target]?.level ?? 0) > 0;
          const canAfford = cash >= u.cost;
          const targetName =
            u.target === "all" ? "All" : BUILDINGS_BY_ID[u.target].name;
          const locked = !owned && !targetUnlocked;
          return (
            <Card
              key={u.id}
              className={cn(
                "flex items-center gap-3 p-4 transition-all",
                owned && "bg-money-500/5 border-money-500/30",
                locked && "opacity-60",
              )}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-paper-100 text-2xl">
                {locked ? <Lock className="h-5 w-5 text-muted-foreground" /> : u.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-extrabold">
                    {u.name}
                  </div>
                  <span className="rounded-full bg-paper-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {targetName}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.description}
                </div>
              </div>
              {owned ? (
                <span className="flex items-center gap-1 rounded-full bg-money-500/15 px-3 py-1 text-xs font-extrabold text-money-600">
                  <Check className="h-3.5 w-3.5" /> Owned
                </span>
              ) : (
                <Button
                  size="md"
                  variant={canAfford && !locked ? "default" : "soft"}
                  disabled={!canAfford || locked}
                  onClick={() => buyUpgrade(u.id)}
                >
                  ${formatNumber(u.cost)}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
