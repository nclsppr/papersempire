import { useEffect } from "react";
import { useGameStore } from "@/game/store";
import { formatNumber } from "@/lib/utils";

export function Floaters() {
  const floaters = useGameStore((s) => s.floaters);
  const popFloaters = useGameStore((s) => s.popFloaters);

  useEffect(() => {
    if (floaters.length === 0) return;
    const ids = floaters.map((f) => f.id);
    const t = window.setTimeout(() => popFloaters(ids), 1300);
    return () => window.clearTimeout(t);
  }, [floaters, popFloaters]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {floaters.map((f) => (
        <span
          key={f.id}
          className="absolute font-extrabold text-money-600 drop-shadow-[0_2px_0_rgba(255,255,255,0.6)] animate-float-up"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          +${formatNumber(f.amount)}
        </span>
      ))}
    </div>
  );
}
