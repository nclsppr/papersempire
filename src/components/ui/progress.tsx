import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0..1
  tone?: "primary" | "accent" | "secondary";
}

export function Progress({
  value,
  tone = "primary",
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const toneClass =
    tone === "accent"
      ? "bg-gradient-to-r from-sun-400 to-sun-500"
      : tone === "secondary"
        ? "bg-gradient-to-r from-sky-400 to-sky-500"
        : "bg-gradient-to-r from-money-400 to-money-600";

  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-paper-200",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          toneClass,
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
