#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { handleEngagement, validateEngagement } from "../worker/engagement.mjs";
import worker from "../worker/index.js";
const ORIGIN = "https://papersempire.com";
const event = { version: 1, consent: true, event: "start", lang: "fr", source: "direct", cohort: new Date().toISOString().slice(0, 10), activeSeconds: 10, elapsedSeconds: 20 };
const points = [];
const env = { ENGAGEMENT: { writeDataPoint(point) { points.push(point); } }, ASSETS: { fetch() { throw new Error("API must not enter asset serving"); } } };
function request(body = event, changes = {}) {
  return new Request(ORIGIN + "/api/engagement", {
    method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
    body: typeof body === "string" ? body : JSON.stringify(body), ...changes
  });
}
assert.equal(validateEngagement(event), true);
const accepted = await worker.fetch(request(), env);
assert.equal(accepted.status, 204);
assert.equal(accepted.headers.get("Cache-Control"), "no-store");
assert.equal(accepted.headers.get("X-Robots-Tag"), "noindex, nofollow");
assert.equal(accepted.headers.get("Access-Control-Allow-Origin"), null);
assert.deepEqual(points[0], { blobs: ["start", "fr", "direct", event.cohort, "1"], doubles: [1, 10, 20], indexes: [event.cohort] });
for (const change of [
  { consent: false }, { consent: "true" }, { version: 2 }, { event: "unknown" }, { lang: "xx" }, { source: "https://sensitive.example" },
  { cohort: "2026-02-31" }, { cohort: "2099-01-01" }, { activeSeconds: -1 }, { activeSeconds: 21 }, { elapsedSeconds: "20" },
  { activeSeconds: 1.3 }, { elapsedSeconds: 1e100 }, { playerId: "private" }, { save: { resources: { docBank: 123 } } },
  { referrer: "private" }, { url: "https://example/?secret=private" }, { ip: "private" }
]) assert.equal((await handleEngagement(request({ ...event, ...change }), env)).status, 400);
for (const raw of ["null", "[]", "{", "{}", JSON.stringify(event).replace('"activeSeconds":10', '"activeSeconds":1e400')]) {
  assert.equal((await handleEngagement(request(raw), env)).status, 400);
}
assert.equal((await handleEngagement(new Request(ORIGIN + "/api/engagement"), env)).status, 405);
assert.equal((await handleEngagement(request(event, { method: "OPTIONS", body: undefined }), env)).status, 405);
assert.equal((await handleEngagement(request(event, { headers: { "Content-Type": "application/json" } }), env)).status, 403);
assert.equal((await handleEngagement(request(event, { headers: { Origin: "https://other.example", "Content-Type": "application/json" } }), env)).status, 403);
assert.equal((await handleEngagement(request(event, { headers: { Origin: ORIGIN, "Content-Type": "text/plain" } }), env)).status, 415);
assert.equal((await handleEngagement(request(event, { headers: { Origin: ORIGIN, "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" } }), env)).status, 403);
for (const url of ["http://papersempire.com/api/engagement", "https://preview.workers.dev/api/engagement", ORIGIN + "/api/engagement?secret=private"]) {
  assert.equal((await handleEngagement(new Request(url, { method: "POST", headers: { Origin: new URL(url).origin, "Content-Type": "application/json" }, body: JSON.stringify(event) }), env)).status, 403);
}
assert.equal((await handleEngagement(request("x".repeat(1025)), env)).status, 413);
const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(700)); controller.enqueue(new Uint8Array(700)); controller.close(); } });
assert.equal((await handleEngagement(request(null, { body: stream, duplex: "half" }), env)).status, 413, "actual stream size is bounded without Content-Length");
assert.equal((await handleEngagement(request(event, { headers: { Origin: ORIGIN, "Content-Type": "application/json", "Content-Length": "999999" } }), env)).status, 413);
assert.equal((await handleEngagement(request(), {})).status, 503, "missing binding never claims a write");
assert.equal((await handleEngagement(request(), { ENGAGEMENT: { writeDataPoint() { throw new Error("Unavailable"); } } })).status, 503);
assert.equal(points.length, 1, "only a validated whitelisted event reaches Analytics Engine");

const source = readFileSync(new URL("../assets/js/engagement.js", import.meta.url), "utf8");
function browser(storage = new Map(), origin = ORIGIN, nowValue = Date.now()) {
  let now = nowValue;
  const sends = [];
  const intervals = new Map();
  const documentListeners = {};
  const windowListeners = {};
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = {
    Date: Clock, URL, Math, Number, String, Object, Array, Set, JSON, Promise, AbortController,
    document: { visibilityState: "visible", documentElement: { lang: "fr" }, referrer: "https://papersempire.com/guides/example/?private=1", addEventListener(type, callback) { documentListeners[type] = callback; } },
    location: { origin },
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); }, removeItem(key) { storage.delete(key); } },
    addEventListener(type, callback) { windowListeners[type] = callback; },
    matchMedia() { return { matches: false }; },
    setInterval(callback) { const id = intervals.size + 1; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); },
    fetch(url, options) { sends.push({ url, options, body: JSON.parse(options.body) }); return new Promise(() => {}); }
  };
  context.window = context;
  vm.createContext(context); vm.runInContext(source, context);
  return { api: context.PEEngagement, context, sends, storage, intervals, windowListeners,
    advance(ms) { now += ms; for (const callback of intervals.values()) callback(); },
    hide() { context.document.visibilityState = "hidden"; documentListeners.visibilitychange(); },
    show() { context.document.visibilityState = "visible"; documentListeners.visibilitychange(); },
    now: () => now
  };
}
const client = browser();
assert.equal(client.api.configure({ locale: () => "en" }), false);
client.api.record("start"); client.api.record("first_automation"); client.advance(10000);
assert.equal(client.sends.length, 0);
assert.equal(client.storage.size, 0, "no measurement storage before opt-in");
assert.equal(client.api.setEnabled(true), true);
client.api.record("start"); client.api.record("start");
assert.equal(client.sends.length, 1);
client.advance(15000);
client.api.record("first_automation"); client.api.record("first_automation");
assert.equal(client.sends.length, 2);
assert.equal(client.sends[1].body.activeSeconds, 15);
assert.equal(client.sends[1].body.elapsedSeconds, 15);
assert.equal(client.sends[1].body.source, "guide");
assert.equal(client.sends[1].body.lang, "en");
assert.equal(client.sends[1].options.credentials, "omit");
assert.equal(client.sends[1].options.referrerPolicy, "no-referrer");
assert.equal(client.sends[1].url, "/api/engagement");
assert.equal(JSON.stringify(client.sends[1].body).includes("private"), false);
client.hide(); client.advance(600000); client.show();
assert.equal(client.api.getLocalReport().activeSeconds, 15, "hidden time excluded from active seconds");
assert.equal(client.api.getLocalReport().elapsedSeconds, 615);
const tomorrow = browser(client.storage, ORIGIN, client.now() + 86400000);
tomorrow.api.configure(); tomorrow.api.record("start"); tomorrow.api.record("start");
assert.deepEqual(tomorrow.sends.map(send => send.body.event), ["return_j1"], "J1 once and no repeated enrollment after reload");
const tomorrowAgain = browser(client.storage, ORIGIN, tomorrow.now());
tomorrowAgain.api.configure(); tomorrowAgain.api.record("start");
assert.equal(tomorrowAgain.sends.length, 0, "same calendar day dedup survives another reload");
const lateEvening = new Date();
lateEvening.setHours(23, 59, 0, 0);
const calendar = browser(new Map(), ORIGIN, lateEvening.getTime());
calendar.api.configure(); calendar.api.setEnabled(true); calendar.api.record("start");
calendar.advance(120000); calendar.api.record("start");
assert.deepEqual(calendar.sends.map(send => send.body.event), ["start", "return_j1"], "calendar J1 can occur before 24 elapsed hours");
const intro = browser();
intro.api.configure(); intro.api.setEnabled(true); intro.advance(15000); intro.api.record("start");
assert.equal(intro.api.getLocalReport().activeSeconds, 0, "introductory page time does not become active game time");
intro.advance(15000); intro.api.setPlaying(false); intro.advance(15000);
assert.equal(intro.api.getLocalReport().activeSeconds, 15, "returning to the introduction stops active game time");
const week = browser(client.storage, ORIGIN, client.now() + 7 * 86400000);
week.api.configure(); week.api.record("start"); week.api.record("start");
assert.deepEqual(week.sends.map(send => send.body.event), ["return_j7"]);
week.api.setEnabled(false);
week.api.record("first_plan"); week.advance(15000);
assert.equal(week.sends.length, 1);
assert.equal(week.sends[0].options.signal.aborted, true, "withdrawal aborts outstanding transmission");
assert.equal(week.storage.size, 0, "withdrawal removes local observation and consent");
client.windowListeners.storage({ key: "pe-engagement-consent-v1", newValue: null });
assert.equal(client.api.isEnabled(), false, "withdrawal in another tab stops tracking here");
for (const origin of ["papers-empire://app", "null", "http://localhost:8000", "https://preview.workers.dev"]) {
  const local = browser(new Map(), origin); local.api.configure(); local.api.setEnabled(true); local.api.record("start"); local.api.record("first_plan");
  assert.equal(local.sends.length, 0, "native/local/preview origin never transmits");
  assert.equal(local.api.getLocalReport().observed.includes("first_plan"), true);
}
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
assert.deepEqual(config.analytics_engine_datasets, [{ binding: "ENGAGEMENT", dataset: "papers_empire_engagement" }]);
console.log("Engagement: consent/withdrawal, J1/J7 dedup, active time, source minimization, strict endpoint and binding checks passed.");
