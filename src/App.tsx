import { useState } from "react";
import { ResourceBar } from "@/components/ResourceBar";
import { BottomNav, type Screen } from "@/components/BottomNav";
import { FactoryScreen } from "@/screens/FactoryScreen";
import { UpgradesScreen } from "@/screens/UpgradesScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { useTick } from "@/game/useTick";

export default function App() {
  const [screen, setScreen] = useState<Screen>("factory");
  useTick();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
      <ResourceBar />
      <div className="flex flex-1 flex-col">
        {screen === "factory" && <FactoryScreen />}
        {screen === "upgrades" && <UpgradesScreen />}
        {screen === "settings" && <SettingsScreen />}
      </div>
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  );
}
