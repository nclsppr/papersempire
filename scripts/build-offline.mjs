#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, extname, posix } from "node:path";

const [siteDir, stamp] = process.argv.slice(2);
if (!siteDir || !/^[a-f0-9]{8,40}$/.test(stamp || "")) throw new Error("Usage: build-offline <built-site> <revision>");
const origin = "https://papersempire.com";
const routes = ["/", "/en/", "/de/", "/lb/", "/dashboard/"];
const files = new Map();
const queue = [];
const textExtensions = new Set([".html", ".css", ".js", ".webmanifest"]);
function fileFor(path) { return join(siteDir, path.endsWith("/") ? path.slice(1) + "index.html" : path.slice(1)); }
function add(path) {
  if (files.has(path)) return;
  if (!(routes.includes(path) || path.startsWith("/assets/") || /^\/site(?:\.(en|de|lb))?\.webmanifest$/.test(path))) return;
  if (/\/sources\/|\/guides\/|docs-header|social-card/.test(path)) return;
  const file = fileFor(path);
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error("Offline dependency missing: " + path);
  const bytes = readFileSync(file);
  const versionedCss = /\.[a-f0-9]{8,40}\.css$/.test(path);
  const url = routes.includes(path) || versionedCss ? path : `${path}?v=${stamp}`;
  files.set(path, { url, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
  if (routes.includes(path) || textExtensions.has(extname(path))) queue.push([path, bytes.toString("utf8")]);
}
function walkAssets(directory) {
  for (const entry of readdirSync(join(siteDir, directory), { withFileTypes: true })) {
    if (entry.name === "sources") continue;
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory()) walkAssets(path);
    else if (/\.js$/.test(path)) add("/" + path);
  }
}
for (const route of routes) add(route);
for (const locale of ["", ".en", ".de", ".lb"]) add(`/site${locale}.webmanifest`);
// Dynamic language loading, scene imports and runtime icon names are finite game catalogs.
for (const dir of ["assets/js", "assets/i18n", "assets/vendor"]) walkAssets(dir);
for (const filename of readdirSync(join(siteDir, "assets/images"))) {
  if (/^(building-[\w-]+\.webp|achievement-[\w-]+\.png)$/.test(filename)) add("/assets/images/" + filename);
}
while (queue.length) {
  const [path, source] = queue.shift();
  const references = [
    ...source.matchAll(/(?:src|href|srcset)=["']([^"']+)["']/g),
    ...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g),
    ...source.matchAll(/["'`]((?:\.{1,2}\/|\/)?assets\/[^\s"'`<>${}]+|\.{1,2}\/[^\s"'`<>${}]+\.(?:js|webp|png|woff2)(?:\?[^\s"'`<>${}]+)?)["'`]/g),
    ...source.matchAll(/"src"\s*:\s*"([^"]+)"/g),
  ];
  for (const match of references) {
    const value = match[1].split(/\s*,\s*/)[0].split(/\s+/)[0];
    const url = new URL(value.startsWith("assets/") ? "/" + value : value, origin + path);
    if (url.origin === origin && url.pathname.startsWith("/assets/") &&
        /\.(?:js|css|webp|png|jpe?g|svg|woff2)$/.test(url.pathname)) add(url.pathname);
  }
}
const entries = [...files.values()].sort((a, b) => a.url.localeCompare(b.url));
const bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
if (bytes > 16 * 1024 * 1024) throw new Error(`Offline shell exceeds 16 MiB: ${bytes}`);
const template = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const version = createHash("sha256").update(template).update(JSON.stringify(entries)).digest("hex").slice(0, 20);
const release = { version, stamp, routes, entries };
writeFileSync(join(siteDir, "sw.js"), template.replace("__PE_OFFLINE_RELEASE__", JSON.stringify(release)));
console.log(`Offline: ${entries.length} verified resources, ${(bytes / 1024 / 1024).toFixed(2)} MiB, fingerprint ${version}`);
