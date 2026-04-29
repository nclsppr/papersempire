import { cn } from "@/lib/utils";

interface ConveyorProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  active?: boolean;
}

/**
 * A flat conveyor belt drawn between two points (% based) inside the
 * factory plane. We render a rotated, padded rectangle and put two animated
 * dots on top to suggest paper sheets gliding by.
 */
export function Conveyor({ fromX, fromY, toX, toY, active }: ConveyorProps) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div
      className="absolute"
      style={{
        left: `${fromX}%`,
        top: `${fromY}%`,
        width: `${length}%`,
        height: 14,
        transform: `translate(-0%, -50%) rotate(${angle}deg)`,
        transformOrigin: "0% 50%",
      }}
      aria-hidden
    >
      <div
        className={cn(
          "h-full w-full rounded-full conveyor-stripes",
          active && "animate-conveyor-flow",
        )}
        style={{ filter: "drop-shadow(0 4px 6px rgba(15, 23, 42, 0.08))" }}
      />
      {active && (
        <>
          <span
            className="absolute top-1/2 -translate-y-1/2 h-2 w-3 rounded-sm bg-white shadow"
            style={{ left: "10%", animation: "conveyor-flow 1.4s linear infinite" }}
          />
          <span
            className="absolute top-1/2 -translate-y-1/2 h-2 w-3 rounded-sm bg-white shadow"
            style={{ left: "55%", animation: "conveyor-flow 1.4s linear infinite", animationDelay: "0.7s" }}
          />
        </>
      )}
    </div>
  );
}
