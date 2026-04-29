import { useEffect } from "react";
import { useGameStore } from "./store";

const TICK_INTERVAL_MS = 100;

/**
 * Drives the idle production loop. We tick at 10Hz instead of 60fps so the
 * UI stays buttery on mobile while still feeling continuous.
 */
export function useTick() {
  const tick = useGameStore((s) => s.tick);
  useEffect(() => {
    const interval = window.setInterval(() => {
      tick(Date.now());
    }, TICK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tick]);
}
