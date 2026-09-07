#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";

const siteDir = resolve(process.argv[2] || new URL("../site", import.meta.url).pathname);
const built = readFileSync(join(siteDir, "sw.js"), "utf8");
const release = JSON.parse(built.match(/const OFFLINE_RELEASE = (\{[^\n]+\});/)[1]);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const paths = new Map(release.entries.map(entry => [new URL(entry.url, "https://papersempire.com").pathname, entry]));
assert.equal(paths.size, release.entries.length, "Offline paths must be unique");
assert.deepEqual(release.routes, ["/", "/en/", "/de/", "/lb/", "/dashboard/"]);
assert.ok(release.entries.reduce((sum, entry) => sum + entry.bytes, 0) <= 16 * 1024 * 1024);
for (const [path, entry] of paths) {
  assert.ok(!/\/api\/|\/docs\/|\/guides\/|\/sources\/|\.papersempire|\.json$/.test(path), `Private, editorial or source path in offline manifest: ${path}`);
  const filename = path.endsWith("/") ? path.slice(1) + "index.html" : path.slice(1);
  const bytes = readFileSync(join(siteDir, filename));
  assert.equal(sha(bytes), entry.sha256, `Offline fingerprint drift: ${path}`);
  assert.equal(bytes.length, entry.bytes);
}
for (const route of release.routes) {
  const html = readFileSync(join(siteDir, route.slice(1), "index.html"), "utf8");
  for (const match of html.matchAll(/(?:src|href|srcset)=["'](\/assets\/[^"']+)["']/g)) {
    const path = new URL(match[1], "https://papersempire.com").pathname;
    if (/social-card|\/guides\//.test(path)) continue;
    assert.ok(paths.has(path), `Game HTML dependency is not prepared: ${path}`);
  }
}
for (const name of readdirSync(join(siteDir, "assets/images"))) {
  if (/^(building-[\w-]+\.webp|achievement-[\w-]+\.png)$/.test(name)) assert.ok(paths.has(`/assets/images/${name}`), `Missing runtime image ${name}`);
}
assert.ok(paths.has("/assets/js/offline-install.js"), "Offline controls must also work after reload");

// Exercise the worker lifecycle without a browser or a remote service.
const origin = "https://papersempire.com";
const storage = new Map();
const keyFor = request => new URL(typeof request === "string" ? request : request.url, origin).href;
const cacheStorage = {
  async keys() { return [...storage.keys()]; },
  async delete(name) { return storage.delete(name); },
  async open(name) {
    if (!storage.has(name)) storage.set(name, new Map());
    const entries = storage.get(name);
    return {
      async put(request, response) { entries.set(keyFor(request), response.clone()); },
      async match(request) { return entries.get(keyFor(request))?.clone(); },
      async keys() { return [...entries.keys()].map(url => ({ url })); },
      async delete(request) { return entries.delete(keyFor(request)); },
    };
  },
};
const template = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
function fixture(version, stamp, text) {
  const files = new Map([["/", `<html>${text}</html>`], [`/assets/game.js?v=${stamp}`, text]]);
  const entries = [...files].map(([url, body]) => ({ url, sha256: sha(body), bytes: Buffer.byteLength(body) }));
  return { release: { version, stamp, routes: ["/"], entries }, files };
}
function worker(fixture, corrupt = false) {
  const listeners = {};
  const effects = { skipped: 0, claimed: 0, requests: [] };
  class LocalRequest extends Request {
    constructor(input, options) { super(new URL(input, origin), options); }
  }
  const context = vm.createContext({
    URL, Request: LocalRequest, Response, Uint8Array, crypto: webcrypto, caches: cacheStorage,
    fetch: async request => {
      const url = new URL(request.url || request, origin);
      effects.requests.push(url.pathname);
      const body = fixture.files.get(url.pathname + url.search);
      return new Response(corrupt ? "wrong release" : body || "network only", { status: body ? 200 : 404 });
    },
    self: { location: { origin }, addEventListener: (type, fn) => { listeners[type] = fn; },
      clients: { claim: async () => { effects.claimed++; } }, skipWaiting: async () => { effects.skipped++; } },
  });
  vm.runInContext(template.replace("__PE_OFFLINE_RELEASE__", JSON.stringify(fixture.release)), context);
  async function dispatch(type, event = {}) {
    let promise;
    listeners[type]({ ...event, waitUntil: value => { promise = value; }, respondWith: value => { promise = value; } });
    return await promise;
  }
  return { effects, dispatch };
}
const aFixture = fixture("a", "aaaaaaaa", "version-a");
const a = worker(aFixture);
await a.dispatch("install");
assert.equal(a.effects.skipped, 0, "Installing must never skip an open game");
await a.dispatch("activate");
assert.equal((await a.dispatch("fetch", { request: { method: "GET", mode: "navigate", url: origin + "/?guide=first-automation" } })).status, 200);
for (const path of ["/api/gameplay", "/docs/", "/guides/", "/save.papersempire"]) {
  assert.equal(await a.dispatch("fetch", { request: { method: "GET", mode: "navigate", url: origin + path } }), undefined, `${path} must not be intercepted`);
}
const beforeUnknown = (await cacheStorage.open("papers-empire-shell-a")).keys();
await a.dispatch("fetch", { request: { method: "GET", mode: "cors", url: origin + "/assets/unlisted.js" } });
assert.deepEqual(await (await cacheStorage.open("papers-empire-shell-a")).keys(), await beforeUnknown, "Unlisted responses must not populate cache");
const bad = worker(fixture("broken", "bbbbbbbb", "version-b"), true);
await assert.rejects(bad.dispatch("install"), /did not match/);
assert.deepEqual(await cachesNames(), ["papers-empire-shell-a"], "Failed update must preserve the working cache only");
const b = worker(fixture("b", "bbbbbbbb", "version-b"));
await b.dispatch("install");
assert.equal(b.effects.skipped, 0);
await b.dispatch("message", { data: { type: "PE_APPLY_OFFLINE_UPDATE" } });
assert.equal(b.effects.skipped, 1, "Only an explicit update message may skip waiting");
await b.dispatch("activate");
const oldAsset = await b.dispatch("fetch", { request: { method: "GET", mode: "cors", url: origin + "/assets/game.js?v=aaaaaaaa" } });
assert.equal(await oldAsset.text(), "version-a", "An open old tab must retain its lazy assets");
const superseded = worker(fixture("superseded", "dddddddd", "not accepted"));
await superseded.dispatch("install");
const c = worker(fixture("c", "cccccccc", "version-c"));
await c.dispatch("install");
assert.deepEqual(await cachesNames(), ["papers-empire-shell-a", "papers-empire-shell-b", "papers-empire-shell-c"],
  "Repeated declined updates must retain only active, prior and one waiting release");
await c.dispatch("activate");
assert.deepEqual(await cachesNames(), ["papers-empire-shell-b", "papers-empire-shell-c"], "Only active and previous releases may remain");
const rollback = worker(fixture("b", "bbbbbbbb", "version-b"));
await rollback.dispatch("install"); await rollback.dispatch("activate");
const restored = await rollback.dispatch("fetch", { request: { method: "GET", mode: "navigate", url: origin + "/" } });
assert.equal(await restored.text(), "<html>version-b</html>", "Redeployment of the previous release must restore its shell");
assert.equal((await cachesNames()).length, 2);
async function cachesNames() { return (await cacheStorage.keys()).sort(); }
console.log(`Offline contracts: ok (${release.entries.length} exact assets; explicit update, failed update, bounded caches, old tabs and rollback)`);
