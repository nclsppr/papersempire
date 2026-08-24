#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const rootDir = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, rootDir), "utf8");
const readBuffer = path => readFileSync(new URL(path, rootDir));

function readPngSize(path) {
  const image = readBuffer(path);
  assert.equal(image.subarray(1, 4).toString("ascii"), "PNG", `${path} must remain a PNG`);
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

function readPngMetadata(path) {
  const image = readBuffer(path);
  assert.equal(image.subarray(1, 4).toString("ascii"), "PNG", `${path} must remain a PNG`);
  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
    colorType: image[25]
  };
}

function readJpegSize(path) {
  const image = readBuffer(path);
  assert.equal(image.readUInt16BE(0), 0xffd8, `${path} must remain a JPEG`);
  let offset = 2;

  while (offset < image.length) {
    while (image[offset] === 0xff) offset += 1;
    const marker = image[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const segmentLength = image.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        width: image.readUInt16BE(offset + 5),
        height: image.readUInt16BE(offset + 3)
      };
    }
    offset += segmentLength;
  }

  assert.fail(`${path} must expose JPEG dimensions`);
}

class TestClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    if (force) this.values.add(value);
    else this.values.delete(value);
    return !!force;
  }
}

function verifyHighContrastDoesNotBootWebGL() {
  const stage = { classList: new TestClassList() };
  const canvas = {};
  let initCalls = 0;

  class TestMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
  }

  const sandbox = {
    URL,
    console: { info() {} },
    MutationObserver: TestMutationObserver,
    document: {
      readyState: "complete",
      currentScript: { src: "https://papersempire.test/assets/js/scene/scene-loader.js" },
      documentElement: {
        dataset: { sceneEnabled: "1" },
        classList: new TestClassList(["pref-high-contrast"])
      },
      getElementById(id) {
        return id === "sceneStage" ? stage : id === "cityCanvas" ? canvas : null;
      },
      addEventListener() {}
    }
  };
  sandbox.window = {
    CityScene: { init() { initCalls += 1; } },
    PEWorldTheme: {},
    MutationObserver: TestMutationObserver
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.URL = URL;
  sandbox.window.console = sandbox.console;
  sandbox.window.MutationObserver = TestMutationObserver;

  vm.runInNewContext(read("assets/js/scene/scene-loader.js"), sandbox);
  assert.equal(initCalls, 0, "WebGL must not boot while high contrast is active");
  assert.equal(stage.classList.contains("scene-active"), false,
    "high contrast must keep the progressive fallback visible");
}

function verifyStaticContracts() {
  const index = read("index.html");
  const dashboard = read("dashboard/index.html");
  const loader = read("assets/js/scene/scene-loader.js");
  const city = read("assets/js/scene/city-scene.js");
  const app = read("assets/js/app.js");
  const events = read("assets/js/events.js");
  const dashboardJs = read("assets/js/dashboard.js");
  const assetHelper = read("assets/js/asset-url.js");
  const css = read("assets/css/style.css");
  const experienceCss = read("assets/css/experience-v4.css");
  const manifest = read("site.webmanifest");
  const build = read("scripts/build-lang-pages.mjs");
  const siteBuild = read("scripts/build-site.sh");
  const workflow = read(".github/workflows/validate.yml");

  for (const [name, html] of [["game", index], ["data zone", dashboard]]) {
    assert.ok(
      html.indexOf('localStorage.getItem("pe-accessibility")') < html.indexOf('rel="stylesheet"'),
      `${name} must apply saved visual preferences before loading CSS`
    );
    assert.match(html, /pageshow[\s\S]*event\.persisted[\s\S]*location\.reload/,
      `${name} must refresh versioned assets after a BFCache restore`);
  }
  assert.match(loader, /pe:scene-first-frame/,
    "the loader must wait for a rendered frame before exposing the canvas");
  assert.doesNotMatch(loader, /stage\.classList\.add\("scene-active"\)/,
    "the loader must not expose an unrendered canvas");
  assert.match(css, /pref-high-contrast \.stage\.scene-active \.stage-fallback[\s\S]*display: flex !important/,
    "high contrast must override a previously active scene");
  assert.match(index, /class="press-intake"[\s\S]*class="paper-sheet"[\s\S]*class="press-slot press-slot-in"/,
    "the paper sheet and intake lip must share one clipping viewport");
  assert.match(index, /class="stage-live-copy"[\s\S]*class="stage-status"[\s\S]*class="stage-flavor"/,
    "the live campus status lines must share one non-overlapping stack");
  assert.doesNotMatch(app, /FLAVOR_KEYS|initFlavorTicker|flavor\.paperJam/,
    "the campus status must come from game state, not invented random anecdotes");
  assert.match(index, /id="currentObjective"[\s\S]*id="contractsList"/,
    "one current job must appear before client offers");
  assert.doesNotMatch(index, /id="(?:activeContractPanel|machineUnlockPanel)"/,
    "legacy objective panels must not duplicate the current job");
  assert.match(app, /playContractEffect\(DOM\.currentObjective\)/,
    "contract activation feedback must target the current job");
  assert.match(index, /id="disableEventInterruptions"[\s\S]*data-i18n="events\.optOut"/,
    "every random interruption must expose its persistent opt-out");
  assert.match(index, /id="eventModal"[^>]*aria-describedby="eventDescription"/,
    "random interruption dialogs must describe themselves to assistive technology");
  assert.match(css, /\.event-dialog\s*\{[^}]*max-height:\s*calc\(100dvh - 24px\)[^}]*overflow-y:\s*auto/,
    "interruption controls must remain reachable on short mobile viewports");
  assert.match(app, /function disableEventInterruptions\([\s\S]*setPreference\("eventsEnabled", false\)[\s\S]*syncEventsPreference\(\)/,
    "the interruption opt-out must reuse the persistent interface preference");
  assert.match(app, /function closeEventModal\([\s\S]*cancelActive\(\)[\s\S]*eventState\.active = null/,
    "dismissing an interruption must cancel it without applying a choice");
  assert.match(app, /function showEventBanner\([\s\S]*setTimeout\([\s\S]*hideEventBanner\(\)[\s\S]*6000/,
    "event result banners must leave the screen automatically");
  assert.match(events, /BASE_INTERVAL = 90[\s\S]*MIN_COOLDOWN = 180[\s\S]*spawnChancePerSecond[\s\S]*Math\.pow/,
    "random interruptions must be sparse and frame-rate independent");
  assert.match(app, /const frameDt = Math\.min\(dt, 5\)[\s\S]*update\(scaledDt, frameDt\)[\s\S]*function update\(dt, realDt = dt\)[\s\S]*maybeSpawnSmallEvents\(realDt, DOCps\)[\s\S]*checkDynamicEvents\(realDt\)/,
    "God mode must not accelerate interruption timing or fill the journal with incidents");
  assert.match(css, /--ops-positive:\s*#4f712e/,
    "small positive-status text must keep sufficient contrast on paper surfaces");
  assert.match(app, /function renderWorkOrder\([\s\S]*activeContract\.timer[\s\S]*progressValue: elapsed/,
    "the client job must expose real elapsed-time progress");
  assert.match(index, /role="progressbar"[^>]*aria-valuenow="50"/,
    "workshop gauges must expose their current value accessibly");
  assert.match(dashboardJs, /function setText\(element, value\)[\s\S]*element\.textContent !== next/,
    "Data Science live regions must not be rewritten with identical text on every poll");
  assert.doesNotMatch(css + experienceCss, /transition\s*:\s*all\b/,
    "UI motion must continue to name the properties it changes");
  assert.match(css, /--hero-width:\s*1920px/,
    "the desktop production twin must retain its large-screen canvas budget");
  assert.match(experienceCss, /html\[data-experience="playing"\] \.stage\s*\{[^}]*clamp\(430px,[^;]+620px\)/,
    "the playing scene must keep the expanded MacBook and desktop height range");
  assert.match(css, /\.empire-hud-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    "HUD labels and values must remain vertically stacked");
  assert.match(css, /\.operations-deck > #printStation\s*\{[^}]*position:\s*static/,
    "the print console must stay in document flow");
  assert.doesNotMatch(css, /\.operations-deck > #printStation\s*\{[^}]*position:\s*sticky/,
    "the print console must never cover later cards while scrolling");
  assert.match(experienceCss, /\.data-kpi-value\s*\{[^}]*overflow:\s*visible[^}]*white-space:\s*normal/,
    "Data Science KPI values must remain unclipped and wrappable");
  assert.match(index, /papers-empire-logo-v2-cutout\.webp[\s\S]*papers-empire-logo-v2-cutout\.png/,
    "the interface must use the transparent derivative of the painted homepage logo");
  assert.doesNotMatch(index, /brand-app-mark|favicon\.svg/,
    "the in-game header must not replace the painted logo with a flat app mark");
  assert.match(experienceCss, /html\[data-experience="playing"\] \.brand-picture\s*\{[^}]*display:\s*block/,
    "the painted homepage logo must remain visible after entering the game");
  assert.match(dashboard, /data-science-zone-emblem-v2-cutout\.webp[\s\S]*data-science-zone-emblem-v2-cutout\.png/,
    "the Data Science Zone must use the transparent derivative of its painted industrial emblem");
  assert.match(city, /papers-empire-logo-v2-cutout\.webp[\s\S]*transparent:\s*true[\s\S]*alphaTest:\s*0\.04/,
    "the 3D printworks sign must place a transparent painted mark on its physical backplate");
  assert.doesNotMatch(dashboard + experienceCss, /data-science-zone-mark\.svg/,
    "the Data Science Zone must not fall back to the flat vector mark");
  assert.equal((manifest.match(/"purpose":\s*"any maskable"/g) || []).length, 2,
    "both installable icon sizes must support full-bleed maskable use");
  assert.deepEqual(readJpegSize("assets/images/social-card.jpg"), { width: 1200, height: 630 },
    "the social card must remain a 1200x630 JPEG");
  assert.deepEqual(readPngSize("assets/brand/data-science-zone-emblem-v2.png"), { width: 512, height: 512 },
    "the Data Science Zone fallback emblem must remain a 512x512 PNG");
  assert.deepEqual(
    readPngMetadata("assets/brand/papers-empire-logo-v2-cutout.png"),
    { width: 700, height: 560, colorType: 6 },
    "the Papers Empire UI derivative must remain a 700x560 RGBA PNG"
  );
  assert.deepEqual(
    readPngMetadata("assets/brand/data-science-zone-emblem-v2-cutout.png"),
    { width: 512, height: 512, colorType: 6 },
    "the Data Science Zone UI derivative must remain a 512x512 RGBA PNG"
  );
  for (const [path, size] of [
    ["assets/images/favicon-32.png", 32],
    ["assets/images/apple-touch-icon.png", 180],
    ["assets/images/icon-192.png", 192],
    ["assets/images/icon-512.png", 512]
  ]) {
    assert.deepEqual(readPngSize(path), { width: size, height: size },
      `${path} must retain its declared square dimensions`);
  }
  assert.match(assetHelper, /document\.currentScript[\s\S]*searchParams\.get\("v"\)/,
    "runtime-generated asset names must inherit the release stamp");
  for (const [name, source] of [["game", app], ["data zone", dashboardJs], ["3D scene", city], ["3D loader", loader]]) {
    assert.match(source, /PEAssetUrl/,
      `${name} runtime assets must use the shared version resolver`);
  }
  assert.match(build, /function stampCssAssetUrls[\s\S]*url\\\(/,
    "CSS-owned images and fonts must share the release stamp");
  assert.match(build, /CSS_FILES[\s\S]*replaceAll[\s\S]*renameSync\(cssPath, versionedPath\)/,
    "published CSS must use revisioned filenames instead of stable cache keys");
  assert.match(build, /function stampJavaScriptAssetUrls[\s\S]*three\.core\.min\.js/,
    "JavaScript imports and static assets must share the release stamp");
  assert.match(build, /function stampManifestAssets/,
    "installable icons must share the release stamp");
  assert.match(build, /\/assets\\\/\[\^/,
    "HTML images, srcsets, fonts, scripts and styles must share the release stamp");
  assert.match(siteBuild, /-name sources -prune/,
    "production masters must stay out of the public site archive");
  assert.match(workflow, /npm run cloudflare:check/,
    "Cloudflare validation must enforce the complete release gate");
}

verifyHighContrastDoesNotBootWebGL();
verifyStaticContracts();
console.log("UI resilience contracts: ok");
