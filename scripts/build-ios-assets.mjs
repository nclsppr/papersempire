#!/usr/bin/env node
/** Bundle canonical headless rules and native artwork; never website resources. */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gameTarget = join(root, "ios", "GameAssets");
const artTarget = join(root, "ios", "NativeAssets");
const scripts = [
  "assets/js/headless-runtime.js", "assets/js/persistence.js", "assets/js/modifier-utils.js",
  "assets/js/godmode-utils.js", "assets/js/economy-analytics.js", "assets/js/progression.js",
  "assets/js/investment-advice.js", "assets/js/endgame.js", "assets/js/achievements.js",
  "assets/js/events.js", "assets/i18n/fr.js", "assets/i18n/en.js", "assets/i18n/de.js",
  "assets/i18n/lb.js", "assets/js/app.js"
];
const buildings = ["reproOperator", "reproWorkshop", "prepressStudio", "digitalPress", "offsetPress", "finishingWorkshop", "insertingLine", "logistics", "clientPortal", "comBridge", "pampyAI", "factory40"];
for (const file of scripts) if (!existsSync(join(root, file))) throw new Error("Missing canonical native rules: " + file);
for (const id of buildings) if (!existsSync(join(root, "assets/images/buildings-v4/sources/building-" + id + "-v4.png"))) throw new Error("Missing canonical native artwork: " + id);
for (const target of [gameTarget, artTarget]) { if (existsSync(target)) rmSync(target, { recursive: true }); mkdirSync(target, { recursive: true }); }
const bundledScripts = [];
for (const source of scripts) {
  const relative = source.replace(/^assets\//, "");
  const destination = join(gameTarget, relative);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(root, source), destination);
  bundledScripts.push(relative);
}
writeFileSync(join(gameTarget, "runtime.json"), JSON.stringify({ version: 1, scripts: bundledScripts }, null, 2) + "\n");
for (const id of buildings) cpSync(join(root, "assets/images/buildings-v4/sources/building-" + id + "-v4.png"), join(artTarget, "building-" + id + "-v4.png"));
for (const name of readdirSync(join(root, "assets/images"))) {
  if (/^(achievement-.+|icon-192|icon-512|seal-crest)\.png$/.test(name)) cpSync(join(root, "assets/images", name), join(artTarget, name));
}
console.log("Bundled native game: " + scripts.length + " canonical rule/localization scripts, " + buildings.length + " building textures; no HTML, CSS, browser engine or Three.js assets.");
