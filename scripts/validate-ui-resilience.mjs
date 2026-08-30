#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const THREE = await import(new URL("../assets/vendor/three.module.min.js", import.meta.url));

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

function readWebpMetadata(path) {
  const image = readBuffer(path);
  assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF", `${path} must remain a RIFF WebP`);
  assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP", `${path} must remain a WebP`);
  assert.equal(image.subarray(12, 16).toString("ascii"), "VP8X", `${path} must expose extended WebP metadata`);
  const readUInt24LE = offset => image[offset] | image[offset + 1] << 8 | image[offset + 2] << 16;
  return {
    width: readUInt24LE(24) + 1,
    height: readUInt24LE(27) + 1,
    hasAlpha: Boolean(image[20] & 0x10)
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

function object3dSignature(root) {
  const signature = [];
  root.traverse(object => {
    signature.push({
      type: object.type,
      name: object.name,
      position: object.position.toArray().map(value => Number(value.toFixed(6))),
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z]
        .map(value => Number(value.toFixed(6))),
      scale: object.scale.toArray().map(value => Number(value.toFixed(6))),
      color: object.material && object.material.color
        ? object.material.color.getHex()
        : null
    });
  });
  return signature;
}

function verifyPrepressCampusContracts() {
  const layoutSandbox = {};
  vm.runInNewContext(read("assets/js/scene/city-layout.js"), layoutSandbox);
  const layout = layoutSandbox.CityLayout;
  assert.ok(layout, "city layout must expose its pure API");
  assert.equal(layout.BUILDING_IDS.length, 12,
    "the campus must expose twelve purchasable building lots");
  assert.ok(layout.BUILDING_IDS.includes("prepressStudio"),
    "the prepress studio must have a campus lot");
  assert.deepEqual(
    JSON.parse(JSON.stringify(layout.LOTS.prepressStudio)),
    { x: -9.5, z: -5, w: 2, d: 1.6, cap: 2 },
    "the prepress lot must keep its collision-reviewed footprint"
  );
  assert.equal(layout.copiesFor("prepressStudio", 99), 2,
    "the prepress studio must respect its visual copy cap");

  const occupied = layout.BUILDING_IDS.map(id => {
    const lot = layout.LOTS[id];
    const offsets = layout.duplicateOffsets(id, lot.cap);
    return {
      id,
      row: lot.z,
      minX: Math.min(...offsets.map(offset => lot.x + offset.x - lot.w / 2)),
      maxX: Math.max(...offsets.map(offset => lot.x + offset.x + lot.w / 2)),
      minZ: Math.min(...offsets.map(offset => lot.z + offset.z - lot.d / 2)),
      maxZ: Math.max(...offsets.map(offset => lot.z + offset.z + lot.d / 2))
    };
  });
  occupied.forEach(bounds => {
    assert.ok(bounds.minX >= -layout.WORLD.width / 2 && bounds.maxX <= layout.WORLD.width / 2,
      `${bounds.id} visual copies must stay inside the campus width`);
    assert.ok(bounds.minZ >= -layout.WORLD.depth / 2 && bounds.maxZ <= layout.WORLD.depth / 2,
      `${bounds.id} visual copies must stay inside the campus depth`);
  });
  occupied.forEach((left, index) => {
    occupied.slice(index + 1).forEach(right => {
      if (left.row !== right.row) return;
      assert.ok(left.maxX <= right.minX || right.maxX <= left.minX,
        `${left.id} and ${right.id} visual copies must not overlap`);
    });
  });

  const recipeSandbox = { window: {} };
  vm.runInNewContext(read("assets/js/scene/building-recipes.js"), recipeSandbox);
  const recipes = recipeSandbox.window.BuildingRecipes;
  assert.ok(recipes, "building recipes must expose their browser API");
  const studio = recipes.build(THREE, "prepressStudio");
  assert.ok(studio, "the prepress studio recipe must build a Three.js group");
  assert.equal(studio.userData.buildingId, "prepressStudio");
  const initialSignature = object3dSignature(studio);
  recipes.applyQuantity(THREE, studio, 10);
  const grownSignature = object3dSignature(studio);
  assert.notDeepEqual(grownSignature, initialSignature,
    "the prepress miniature must visibly grow with its quantity");
  assert.equal(studio.userData.floorCount, 4,
    "quantity ten must use the shared fourth growth stage");
  recipes.applyQuantity(THREE, studio, 10);
  assert.deepEqual(object3dSignature(studio), grownSignature,
    "reapplying a prepress growth stage must be idempotent");

  const shadow = studio.getObjectByName("shadow");
  if (shadow && shadow.parent) shadow.parent.remove(shadow);
  const bounds = new THREE.Box3().setFromObject(studio);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x <= layout.LOTS.prepressStudio.w + 0.01,
    "the prepress recipe must fit its lot width");
  assert.ok(size.z <= layout.LOTS.prepressStudio.d + 0.01,
    "the prepress recipe must fit its lot depth");
  recipes.disposeResources();
}

function verifyStaticContracts() {
  const index = read("index.html");
  const dashboard = read("dashboard/index.html");
  const notFound = read("404.html");
  const loader = read("assets/js/scene/scene-loader.js");
  const city = read("assets/js/scene/city-scene.js");
  const app = read("assets/js/app.js");
  const events = read("assets/js/events.js");
  const dashboardJs = read("assets/js/dashboard.js");
  const assetHelper = read("assets/js/asset-url.js");
  const css = read("assets/css/style.css");
  const siteHeaderCss = read("assets/css/site-header.css");
  const experienceCss = read("assets/css/experience-v4.css");
  const guidesCss = read("assets/css/guides.css");
  const fr = read("assets/i18n/fr.js");
  const siteHeaderJs = read("assets/js/site-header.js");
  const guidesBuild = read("scripts/build-guides.mjs");
  const guidesCatalog = read("content/guides/index.mjs");
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
  const objectiveStart = index.indexOf('id="currentObjective"');
  const objectiveEnd = index.indexOf("</section>", objectiveStart);
  const objectiveMarkup = index.slice(objectiveStart, objectiveEnd);
  for (const hook of [
    "data-work-order-context",
    "data-work-order-plan",
    "data-work-order-step",
    "data-work-order-steps",
    "data-work-order-criteria",
    "data-work-order-outcome",
    "data-work-order-reward",
    "data-work-order-incident",
    "data-work-order-incident-label",
    "data-work-order-incident-hint"
  ]) {
    assert.ok(objectiveMarkup.includes(hook), `the current job must expose the ${hook} hook`);
  }
  assert.match(index, /class="prestige-card"[\s\S]*id="careerPlanContainer"[\s\S]*id="careerPlanChoices"[\s\S]*id="prestigeButton"/,
    "career choices must stay inside the existing strategic reorganisation card");
  assert.match(app, /const conclusionUnlocked = Boolean\(summary\.conclusion && summary\.conclusion\.unlocked\)[\s\S]*career\.conclusion\.pendingTitle/,
    "the final job title must stay hidden until all major campaigns are archived");
  assert.match(app, /function careerStatusSignature\([\s\S]*current: formatNumber\(progress\.current\)[\s\S]*activeCampaign:[\s\S]*status: careerStatusSignature/,
    "career cards must invalidate their render cache when an active objective advances");
  assert.match(app, /function handlePrestigeClick\([\s\S]*prestigeCampaignRestartCopy\(preview\)[\s\S]*prestigeChallengeFailureCopy\(preview\)/,
    "reorganisation confirmation must disclose restarted campaigns and abandoned challenges");
  assert.match(app, /const runCultureEarned =[\s\S]*const prestigeDelta = Math\.max\(0, gameState\.resources\.culturePoints - cultureBefore\)[\s\S]*gain: prestigeDelta/,
    "the archive's run culture and the reorganisation receipt delta must stay distinct");
  assert.match(app, /unlockedDefinitions: prestigeUnlockedDefinitions[\s\S]*grantedRewards: prestigeGrantedRewards[\s\S]*prestigeUnlockedDefinitions\.map/,
    "a reorganisation receipt must explain every achievement reward in the unlocked batch");
  assert.match(app, /function checkAchievements\([\s\S]*while \(newly\.length < Achievements\.definitions\.length\)[\s\S]*Achievements\.evaluate\(buildAchievementContext\(\), unlockedMap\)[\s\S]*applyAchievementReward/,
    "achievement rewards must resolve cascading unlocks in one atomic batch");
  assert.match(fr, /"prestige\.confirm": "[^"]*Gain garanti hors récompenses de succès\s*:[^"]*récompenses de succès seront ajoutées au reçu/,
    "the reorganisation confirmation must distinguish guaranteed gain from achievement rewards");
  assert.match(index, /building-prepressStudio-v4\.webp[\s\S]*data-i18n="building\.prepressStudio\.name"/,
    "the public workshop catalogue must introduce the prepress studio");
  assert.deepEqual(
    readPngMetadata("assets/images/buildings-v4/sources/building-prepressStudio-v4.png"),
    { width: 512, height: 512, colorType: 6 },
    "the traceable prepress master must remain a 512px RGBA PNG"
  );
  assert.deepEqual(
    readWebpMetadata("assets/images/building-prepressStudio-v4.webp"),
    { width: 512, height: 512, hasAlpha: true },
    "the shipped prepress thumbnail must remain a transparent 512px WebP"
  );
  assert.match(index, /id="careerPlanContainer"[^>]*role="group"[^>]*aria-labelledby="careerPlanTitle"[^>]*aria-describedby="careerPlanIntro careerPlanEffect"/,
    "dynamic career choices must expose a labelled and described accessible group");
  assert.match(index, /data-work-order-reward[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,
    "job rewards must announce their complete feedback without making the live job card noisy");
  assert.doesNotMatch(index, /id="(?:plansPanel|careerPanel|incidentsPanel|clausesPanel)"/,
    "long-term progression must not add another top-level dashboard panel");
  for (const selector of [
    ".work-order-context",
    ".work-order-steps",
    ".work-order-criteria",
    ".work-order-outcome",
    ".work-order-reward",
    ".work-order-incident",
    ".career-plan",
    ".career-plan-choices",
    ".contract-clause",
    ".building-milestone",
    ".achievement-progress",
    ".event-choice-label",
    ".event-choice-effect"
  ]) {
    assert.ok(css.includes(selector), `the long-term progression UI must style ${selector}`);
  }
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.work-order-steps,[\s\S]*\.career-plan-choices\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    "job steps, criteria and career choices must collapse to one mobile column");
  assert.match(css, /@media \(any-pointer:\s*coarse\)[\s\S]*\.work-order-incident,[\s\S]*\.career-plan-choice,[\s\S]*\.career-plan-option label,[\s\S]*min-height:\s*44px/,
    "new progression controls must retain coarse-pointer touch targets");
  assert.ok(css.includes(".pref-high-contrast .career-plan"),
    "career planning must provide an explicit high-contrast surface");
  assert.ok(css.includes(".pref-high-contrast .work-order-criterion"),
    "job criteria must provide explicit high-contrast states");
  assert.ok(css.includes("html:not(.pref-reduce-motion) .work-order.is-plan-stamped"),
    "stamp confirmation motion must only run when reduced motion is not requested");
  assert.ok(css.includes(".pref-reduce-motion .work-order.is-plan-stamped"),
    "stamp confirmation must expose a stable reduced-motion state");
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
  assert.match(app, /function closeEventModal\([\s\S]*renderPendingEventControl\(\)[\s\S]*restoreModalFocus\(DOM\.eventModal, DOM\.currentObjective\)/,
    "closing an interruption must hide its pending trigger before restoring focus to the dossier");
  assert.match(app, /function handleEventChoiceClick\([\s\S]*eventState\.active = null[\s\S]*queueSave\(true\)/,
    "a resolved event choice must clear the pending incident before persisting");
  assert.match(app, /function handleMinigameResponse\([\s\S]*eventState\.active = null[\s\S]*queueSave\(true\)/,
    "a resolved calibration must clear the pending incident before persisting");
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
  assert.match(app, /careerState\.campaigns\.active[\s\S]*getCampaignStatus[\s\S]*kind: "campaign"/,
    "an active campaign must remain the current dossier between two Plans");
  assert.match(index, /role="progressbar"[^>]*aria-valuenow="50"/,
    "workshop gauges must expose their current value accessibly");
  assert.match(dashboardJs, /function setText\(element, value\)[\s\S]*element\.textContent !== next/,
    "Data Science live regions must not be rewritten with identical text on every poll");
  assert.match(dashboardJs, /const BUILDING_IDS = new Set\([\s\S]*"prepressStudio"/,
    "Data Science must recognize the prepress studio snapshot row");
  assert.match(dashboard, /id="docFlowList"[\s\S]*id="ccFlowList"[\s\S]*id="cultureFlowList"/,
    "Data Science must expose separate DOC, trust and culture source lists");
  assert.match(dashboardJs, /achievementDocs[\s\S]*achievementCc[\s\S]*careerCulture[\s\S]*achievementCulture/,
    "Data Science resource origins must include achievement and career rewards");
  assert.match(dashboardJs, /function catalogSizedText\([\s\S]*const total = BUILDING_IDS\.size/,
    "Data Science catalog labels must follow the runtime catalog size");
  assert.match(dashboardJs, /catalogSizedText\("analytics\.investment\.analyzed"/,
    "the analyzed-building total must use the dynamic catalog label");
  assert.match(dashboardJs, /catalogSizedText\("analytics\.matrix\.title"/,
    "the comparison heading must use the dynamic catalog label");
  assert.doesNotMatch(dashboard, /id="investmentCount">0 \/ 11/,
    "the Data Science placeholder must not freeze the former catalog size");
  assert.doesNotMatch(dashboard, /Comparer les 11 unités/,
    "the Data Science fallback heading must not freeze the former catalog size");
  assert.doesNotMatch(css + siteHeaderCss + experienceCss + guidesCss, /transition\s*:\s*all\b/,
    "UI motion must continue to name the properties it changes");
  for (const [name, html] of [["game", index], ["404", notFound], ["generated guides", guidesBuild]]) {
    assert.match(html, /<header\b[^>]*class="app-header site-header[^"]*"[^>]*>[\s\S]*?<div\b[^>]*class="header-inner"[^>]*>[\s\S]*?<div\b[^>]*class="header-top"/,
      `${name} must use the shared global header hierarchy`);
    assert.doesNotMatch(html, /guide-header/,
      `${name} must not restore the retired editorial-only header`);
  }
  assert.match(index, /rel="stylesheet" href="\/assets\/css\/site-header\.css"/,
    "the game must load the shared site header stylesheet");
  assert.match(notFound, /href="\/assets\/css\/guides\.css"[\s\S]*href="\/assets\/css\/site-header\.css"/,
    "the 404 must load editorial styles before the shared header overrides");
  assert.match(guidesBuild, /cssPath\("guides"\)[\s\S]*cssPath\("site-header"\)/,
    "generated guides must load editorial styles before the shared header overrides");
  for (const [name, html] of [["404", notFound], ["generated guides", guidesBuild]]) {
    assert.match(html, /assets\/js\/site-header\.js/,
      `${name} must load only the lightweight shared-header controller`);
    assert.match(html, /papers-empire-logo-v2-cutout\.webp[\s\S]*papers-empire-logo-v2-cutout\.png/,
      `${name} header must retain WebP and PNG variants of the painted logo`);
  }
  assert.match(guidesBuild, /class="site-nav-guides active"/,
    "guide hubs and articles must expose the workshop as the active global section");
  assert.match(guidesBuild, /const dashboardPath = lang === "fr" \? "\/dashboard\/" : `\/dashboard\/\?lang=\$\{lang\}`[\s\S]*class="nav-dash-link"[^>]*href="\$\{dashboardPath\}"/,
    "generated guide headers must expose the localized Data Science Zone route");
  assert.match(guidesBuild, /function languageOptions\([\s\S]*article \? articlePath\(article, code\) : LOCALES\[code\]\.hubPath[\s\S]*<option value=[\s\S]*class="lang-select"[^>]*data-locale-select/,
    "generated guide headers must render all language alternates into the shared selector");
  assert.match(siteHeaderJs, /addEventListener\(["']change["']/,
    "the lightweight header controller must react to language changes");
  assert.match(siteHeaderJs, /\.value/,
    "the lightweight header controller must navigate from the selected alternate URL");
  assert.doesNotMatch(siteHeaderJs, /papersEmpireSave|WebGL|three\.(?:module|core)|pe-dash-snapshot/,
    "the shared header controller must stay independent from game and analytics runtimes");
  assert.match(siteHeaderCss, /\.site-header\b/,
    "the global header chrome must live in its shared stylesheet");
  assert.match(index, /class="site-nav-guides" href="guides\/" data-i18n="nav\.guides"/,
    "the desktop game navigation must keep the workshop guides visible in landing and playing states");
  assert.doesNotMatch(index, /class="[^"]*landing-nav-only[^"]*"[^>]*href="guides\/"/,
    "the workshop guides must not disappear after the player enters the game");
  assert.match(index, /class="header-guides-link home-guides-link"[^>]*href="guides\/"[^>]*data-i18n-aria-label="nav\.guides"/,
    "the compact header must expose a localized workshop link when the primary navigation collapses");
  assert.match(siteHeaderCss, /@media \(max-width:\s*1080px\)[\s\S]*\.primary-nav\s*\{[^}]*display:\s*none[\s\S]*\.home-guides-link\s*\{[^}]*display:\s*inline-flex/,
    "the compact workshop link must become visible at the primary-navigation breakpoint");
  assert.match(siteHeaderCss, /@media \(max-width:\s*470px\)[\s\S]*\.site-header \.header-brand\s*\{[^}]*width:\s*74px[\s\S]*grid-template-columns:[^;]*44px 58px/,
    "the narrow game header must reserve non-overlapping tracks for its logo and controls");
  assert.match(siteHeaderCss, /@media \(max-width:\s*360px\)[\s\S]*grid-template-columns:\s*50px 48px 44px 58px/,
    "the smallest game header tracks must fit within the available actions width");
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*#buildingsPanelTitle\s*\{[^}]*overflow-wrap:\s*anywhere/,
    "the localized production heading must wrap without widening the mobile game");
  assert.match(siteHeaderCss, /@media \(any-pointer:\s*coarse\)[\s\S]*\.site-header \.header-guides-link,[\s\S]*min-height:\s*44px/,
    "the compact workshop link must retain a 44px coarse-pointer target");
  assert.match(siteHeaderCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.header-guides-link,[\s\S]*transition:\s*none/,
    "the workshop link must honor the system reduced-motion preference");
  assert.match(dashboard, /class="header-guides-link data-zone-guides-link"[^>]*data-guides-link[^>]*href="\/guides\/"/,
    "the Data Science Zone header must expose the workshop before its footer");
  assert.match(dashboard, /class="header-guides-link data-zone-guides-link"[\s\S]*data-i18n="nav\.guides"/,
    "the Data Science Zone must name the guides explicitly instead of duplicating the game workshop label");
  assert.match(dashboard, /class="footer-links"[\s\S]*data-guides-link href="\/guides\/" data-i18n="nav\.guides"/,
    "the Data Science Zone footer must retain a workshop fallback link");
  assert.match(dashboardJs, /const guidesPath = gamePath \+ "guides\/"[\s\S]*querySelectorAll\("\[data-guides-link\]"\)[\s\S]*link\.href = guidesPath/,
    "the Data Science Zone workshop links must follow the active language route");
  assert.match(dashboardJs, /querySelectorAll\("\[data-home-link\]"\)[\s\S]*link\.href = gamePath/,
    "the Data Science Zone brand must return to the active language home");
  assert.match(experienceCss, /\.data-zone-shell \.data-zone-guides-link\s*\{[^}]*min-height:\s*44px/,
    "the Data Science Zone workshop link must retain a 44px touch target after cascade overrides");
  for (const label of ["Guides de l’atelier", "Workshop guides", "Werkstatt-Guides", "Atelier-Guiden"]) {
    assert.ok(guidesCatalog.includes(`guides: "${label}"`),
      `the editorial shell must retain its complete localized workshop name: ${label}`);
  }
  assert.match(guidesCss, /\.play-cta\s*\{[^}]*background:\s*var\(--orange\)/,
    "guide play CTAs must use the global primary-action orange");
  assert.match(notFound, /rel="stylesheet" href="\/assets\/css\/guides\.css"[\s\S]*rel="stylesheet" href="\/assets\/css\/site-header\.css"/,
    "the 404 page must combine editorial content styles with the global header chrome");
  assert.match(notFound, /href="\/guides\/">Guides de l’atelier<\/a>/,
    "the 404 recovery path must expose the workshop guides");
  assert.match(notFound, /var guidesPath = homePath \+ "guides\/"[\s\S]*querySelectorAll\("\[data-guides-link\]"\)/,
    "the 404 recovery links must preserve EN, DE and LB routes");
  assert.doesNotMatch(notFound, /#241b47|#0b0617|#fcd34d/,
    "the 404 page must not restore the retired violet and yellow palette");
  assert.doesNotMatch(guidesCss, /guide-header/,
    "editorial styles must not retain a second header implementation");
  assert.match(guidesCss, /--reading:\s*70ch/,
    "long-form guide copy must retain a readable measure");
  assert.match(guidesCss, /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--night\)[^}]*box-shadow:\s*0 0 0 6px var\(--lime\)/,
    "guide keyboard focus must contrast on both night and paper surfaces");
  assert.match(guidesCss, /\.hub-hero a:hover,[\s\S]*\.article-hero a:hover,[\s\S]*\.rail-card a:hover\s*\{[^}]*color:\s*var\(--stamp\)/,
    "links on paper surfaces must retain a dark hover color");
  assert.match(guidesCss, /@media \(max-width:\s*600px\)[\s\S]*\.article-rail,[\s\S]*grid-template-columns:\s*1fr/,
    "guide sidebars and related content must collapse on narrow screens");
  assert.match(siteHeaderCss, /@media \(any-pointer:\s*coarse\)[\s\S]*\.lang-select[\s\S]*min-height:\s*44px/,
    "the shared language selector must retain a 44px coarse-pointer target");
  assert.match(guidesCss, /@media \(prefers-reduced-motion:\s*reduce\)/,
    "guides must respect reduced-motion preferences");
  assert.ok(
    guidesBuild.indexOf('localStorage.getItem("pe-accessibility")') < guidesBuild.indexOf('rel="stylesheet"'),
    "guides must apply saved visual preferences before loading CSS"
  );
  assert.match(guidesCss, /:root\.pref-large-text\s*\{[^}]*font-size:\s*clamp\(17px,\s*2vw,\s*20px\)/,
    "guides must honor the saved large-text preference");
  assert.match(guidesCss, /:root\.pref-high-contrast\s*\{[^}]*--paper:\s*#1a1230[^}]*--ink:\s*#fff/,
    "guides must honor the saved high-contrast preference");
  assert.match(guidesCss, /\.pref-reduce-motion \*,[\s\S]*transition:\s*none !important[\s\S]*animation:\s*none !important/,
    "guides must honor the saved reduced-motion preference");
  for (const inset of ["top", "right", "bottom", "left"]) {
    assert.match(guidesCss + siteHeaderCss, new RegExp(`env\\(safe-area-inset-${inset}\\)`),
      `the editorial shell and shared header must consume the ${inset} safe-area inset`);
  }
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
  for (const stylesheet of ["guides.css", "site-header.css"]) {
    assert.match(build, new RegExp(`CSS_FILES\\s*=\\s*\\[[\\s\\S]*["']${stylesheet.replace(".", "\\.")}["']`),
      `${stylesheet} must receive the same immutable release name as the game CSS`);
  }
  assert.match(build, /function stampJavaScriptAssetUrls[\s\S]*three\.core\.min\.js/,
    "JavaScript imports and static assets must share the release stamp");
  assert.match(build, /function stampManifestAssets/,
    "installable icons must share the release stamp");
  assert.match(build, /\/assets\\\/\[\^/,
    "HTML images, srcsets, fonts, scripts and styles must share the release stamp");
  assert.match(siteBuild, /-name sources -prune/,
    "production masters must stay out of the public site archive");
  assert.match(siteBuild, /build-guides\.mjs/,
    "the guide catalog must generate pages and the production sitemap at build time");
  assert.doesNotMatch(siteBuild, /cp .*sitemap\.xml/,
    "the production sitemap must not drift from the guide catalog");
  assert.match(workflow, /npm run cloudflare:check/,
    "Cloudflare validation must enforce the complete release gate");
}

verifyHighContrastDoesNotBootWebGL();
verifyPrepressCampusContracts();
verifyStaticContracts();
console.log("UI resilience contracts: ok");
