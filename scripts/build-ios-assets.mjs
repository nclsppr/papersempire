#!/usr/bin/env node
/** Package only local game resources; Xcode and web always use the same source files. */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "ios", "WebAssets");
if (existsSync(target)) rmSync(target, { recursive: true });
mkdirSync(target, { recursive: true });
cpSync(join(root, "index.html"), join(target, "index.html"));
cpSync(join(root, "assets"), join(target, "assets"), { recursive: true, filter: source => !source.split("/").includes("sources") });
for (const file of ["site.webmanifest", "site.en.webmanifest", "site.de.webmanifest", "site.lb.webmanifest"]) cpSync(join(root, file), join(target, file));
execFileSync(process.execPath, [join(root, "scripts/build-lang-pages.mjs"), target], { cwd: root, stdio: "inherit" });
// Network telemetry and marketing routes are deliberately not bundled with the game.
for (const language of ["", "en", "de", "lb"]) {
  const path = join(target, language, "index.html");
  let html = readFileSync(path, "utf8");
  html = html.replace(/<script[^>]+src=["']https:\/\/static\.cloudflareinsights\.com[^>]*><\/script>/g, "");
  writeFileSync(path, html);
}
console.log("Bundled offline game assets: " + target);
