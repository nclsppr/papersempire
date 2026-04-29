import { useState } from "react";
import { Github, Heart, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGameStore } from "@/game/store";
import { formatNumber } from "@/lib/utils";

export function SettingsScreen() {
  const reset = useGameStore((s) => s.reset);
  const totalEarned = useGameStore((s) => s.totalEarned);
  const [confirming, setConfirming] = useState(false);

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-2">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 bg-gradient-to-r from-sky-400 to-blue-500 px-5 py-4 text-white">
          <Heart className="h-6 w-6" />
          <div>
            <div className="text-sm font-extrabold">Lifetime earnings</div>
            <div className="text-xs opacity-90">
              You've made ${formatNumber(totalEarned)} so far. Keep going!
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper-100">
            <RotateCcw className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold">Auto-save</div>
            <div className="text-xs text-muted-foreground">
              Your factory is saved to this device automatically every action.
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold">Reset progress</div>
            <div className="text-xs text-muted-foreground">
              Wipe everything and start a fresh empire from zero.
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {confirming ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  reset();
                  setConfirming(false);
                }}
              >
                Confirm reset
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirming(true)}
            >
              Reset
            </Button>
          )}
        </div>
      </Card>

      <a
        href="https://github.com/nclsppr/papersempire"
        target="_blank"
        rel="noreferrer"
        className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-bold text-muted-foreground shadow-soft ring-1 ring-paper-200"
      >
        <Github className="h-3.5 w-3.5" />
        Papers Empire · v2.0
      </a>
    </main>
  );
}
