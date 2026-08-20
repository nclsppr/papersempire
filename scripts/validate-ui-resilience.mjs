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
  const dashboardJs = read("assets/js/dashboard.js");
  const assetHelper = read("assets/js/asset-url.js");
  const css = read("assets/css/style.css");
  const experienceCss = read("assets/css/experience-v4.css");
  const manifest = read("site.webmanifest");
  const build = read("scripts/build-lang-pages.mjs");
  const siteBuild = read("scripts/build-site.sh");
  const workflows = read(".github/workflows/docs.yml") + read(".github/workflows/vps-release.yml");

  for (const [name, html] of [["game", index], ["data zone", dashboard]]) {
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
    "the live status and flavor text must share one non-overlapping stack");
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
  assert.match(index, /papers-empire-logo-v2\.webp[\s\S]*papers-empire-logo-v2\.png/,
    "the interface must retain the painted homepage logo as its canonical brand source");
  assert.doesNotMatch(index, /brand-app-mark|favicon\.svg/,
    "the in-game header must not replace the painted logo with a flat app mark");
  assert.match(experienceCss, /html\[data-experience="playing"\] \.brand-picture\s*\{[^}]*display:\s*block/,
    "the painted homepage logo must remain visible after entering the game");
  assert.match(dashboard, /data-science-zone-emblem-v2\.webp[\s\S]*data-science-zone-emblem-v2\.png/,
    "the Data Science Zone must expose its painted industrial emblem");
  assert.doesNotMatch(dashboard + experienceCss, /data-science-zone-mark\.svg/,
    "the Data Science Zone must not fall back to the flat vector mark");
  assert.equal((manifest.match(/"purpose":\s*"any maskable"/g) || []).length, 2,
    "both installable icon sizes must support full-bleed maskable use");
  assert.deepEqual(readJpegSize("assets/images/social-card.jpg"), { width: 1200, height: 630 },
    "the social card must remain a 1200x630 JPEG");
  assert.deepEqual(readPngSize("assets/brand/data-science-zone-emblem-v2.png"), { width: 512, height: 512 },
    "the Data Science Zone fallback emblem must remain a 512x512 PNG");
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
  assert.match(build, /function stampJavaScriptAssetUrls[\s\S]*three\.core\.min\.js/,
    "JavaScript imports and static assets must share the release stamp");
  assert.match(build, /function stampManifestAssets/,
    "installable icons must share the release stamp");
  assert.match(build, /\/assets\\\/\[\^/,
    "HTML images, srcsets, fonts, scripts and styles must share the release stamp");
  assert.match(siteBuild, /-name sources -prune/,
    "production masters must stay out of the public site archive");
  assert.equal((workflows.match(/npm run ui:check/g) || []).length, 3,
    "Pages, VPS validation and VPS publication must enforce the UI resilience gate");
}

verifyHighContrastDoesNotBootWebGL();
verifyStaticContracts();
console.log("UI resilience contracts: ok");
