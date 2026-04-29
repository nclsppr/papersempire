import { Coins, Scroll, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGameStore } from "@/game/store";
import { getTotalRate } from "@/game/selectors";
import { formatNumber, formatRate } from "@/lib/utils";

export function ResourceBar() {
  const cash = useGameStore((s) => s.cash);
  const workers = useGameStore((s) => s.workers);
  const buildings = useGameStore((s) => s.buildings);
  const upgrades = useGameStore((s) => s.upgrades);
  const rate = getTotalRate({
    cash,
    workers,
    buildings,
    upgrades,
    totalEarned: 0,
    lastTick: 0,
  });

  const totalLevels = Object.values(buildings).reduce(
    (sum, b) => sum + b.level,
    0,
  );

  return (
    <header className="sticky top-0 z-30 px-3 pb-2 pt-3">
      <div className="mx-auto flex max-w-2xl items-stretch gap-2">
        <Stat
          icon={Coins}
          label="Cash"
          value={`$${formatNumber(cash)}`}
          sub={formatRate(rate)}
          tone="primary"
        />
        <Stat
          icon={Scroll}
          label="Buildings"
          value={String(totalLevels)}
          sub={`${Object.values(buildings).filter((b) => b.level > 0).length}/4`}
          tone="secondary"
        />
        <Stat
          icon={Users}
          label="Workers"
          value={String(workers)}
          sub={workers > 0 ? `+${(workers * 5).toFixed(0)}%` : "hire team"}
          tone="accent"
        />
      </div>
    </header>
  );
}

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "secondary" | "accent";
}

function Stat({ icon: Icon, label, value, sub, tone }: StatProps) {
  const toneRing =
    tone === "primary"
      ? "ring-money-500/30 bg-money-500/10 text-money-600"
      : tone === "secondary"
        ? "ring-blue-500/30 bg-blue-500/10 text-blue-600"
        : "ring-sun-500/30 bg-sun-500/10 text-sun-500";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/95 p-2.5 shadow-soft ring-1 ring-paper-200 backdrop-blur">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${toneRing}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-base font-extrabold leading-tight text-foreground">
          {value}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
