import { cn } from "@/lib/utils";

interface IsoBuildingProps {
  emoji: string;
  size?: number;
  active?: boolean;
  topClass: string; // tailwind gradient class fragment, e.g. "from-emerald-300 to-emerald-500"
  sideClass: string; // darker tone for sides
}

/**
 * A tiny low-poly cube rendered with three CSS-transformed faces.
 * The whole cube is rotated into a fake-isometric pose; the emoji on top
 * floats just above the roof so it reads at a glance on mobile.
 */
export function IsoBuilding({
  emoji,
  size = 90,
  active = false,
  topClass,
  sideClass,
}: IsoBuildingProps) {
  const half = size / 2;
  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        perspective: 600,
        perspectiveOrigin: "50% 0%",
      }}
    >
      <div
        className={cn(
          "preserve-3d absolute inset-0",
          active && "animate-machine-bob",
        )}
        style={{
          transform: "rotateX(55deg) rotateZ(-45deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* top */}
        <div
          className={cn(
            "absolute inset-0 rounded-md bg-gradient-to-br shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset]",
            topClass,
          )}
          style={{ transform: `translateZ(${half}px)` }}
        />
        {/* front face */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 rounded-md bg-gradient-to-b",
            sideClass,
          )}
          style={{
            height: size,
            transform: `rotateX(-90deg) translateZ(${half}px)`,
            transformOrigin: "top",
          }}
        />
        {/* right face */}
        <div
          className={cn(
            "absolute inset-y-0 right-0 rounded-md bg-gradient-to-b",
            sideClass,
          )}
          style={{
            width: size,
            transform: `rotateY(90deg) translateZ(${half}px)`,
            transformOrigin: "right",
            filter: "brightness(0.9)",
          }}
        />
      </div>

      {/* shadow on the ground */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full bg-slate-900/15 blur-md"
        style={{
          bottom: -8,
          width: size * 1.1,
          height: size * 0.25,
        }}
      />

      {/* emoji floats on top */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-4xl drop-shadow-[0_3px_0_rgba(15,23,42,0.18)]",
          active && "animate-soft-pulse",
        )}
        style={{ transform: "translate(-50%, -55%)" }}
      >
        {emoji}
      </div>

      {active && (
        <div
          className="pointer-events-none absolute left-[60%] top-[-12px] h-3 w-3 rounded-full bg-white/70 blur-[2px] animate-smoke-rise"
          aria-hidden
        />
      )}
    </div>
  );
}
