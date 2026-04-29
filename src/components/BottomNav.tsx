import { Factory, TrendingUp, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Screen = "factory" | "upgrades" | "settings";

interface BottomNavProps {
  active: Screen;
  onChange: (s: Screen) => void;
}

const ITEMS: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "factory", label: "Factory", icon: Factory },
  { id: "upgrades", label: "Upgrades", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="sticky bottom-0 z-30 px-3 pb-3 pt-1">
      <div className="mx-auto flex max-w-2xl items-stretch gap-2 rounded-3xl bg-white/95 p-2 shadow-soft ring-1 ring-paper-200 backdrop-blur">
        {ITEMS.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "group relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold transition-all",
                isActive
                  ? "bg-money-500/10 text-money-600"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110",
                )}
              />
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute -top-1.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-money-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
