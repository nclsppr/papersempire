#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ARTICLES,
  AUTHOR,
  HUBS,
  LOCALES,
  SITE_ORIGIN,
  absolute,
  articlePath,
} from "../content/guides/index.mjs";

const rootDir = new URL("../", import.meta.url);
const siteDir = new URL("../site/", import.meta.url);
const readRoot = path => readFileSync(new URL(path, rootDir), "utf8");
const readSite = path => readFileSync(new URL(path, siteDir), "utf8");
const localeCodes = Object.keys(LOCALES);
const HOME_AND_HUB_LASTMOD = "2026-08-31";
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const AUTHOR_ID = `${AUTHOR.url}#person`;
const SEO_FALLBACK_KEYS = Object.freeze([
  "hero.kicker",
  "hero.line1",
  "hero.line2",
  "hero.line3",
  "hero.lede",
  "roadmap.title",
  "roadmap.subtitle",
  "operations.title",
  "operations.subtitle",
  "operations.unitInspectorKicker",
  "scene.fallback",
  "footer.kicker",
  "footer.tagline",
  "footer.intro",
]);

const HOME_PAGES = Object.freeze({
  fr: {
    title: "Papers Empire — Jeu idle gratuit dans le navigateur",
    description: "Joue gratuitement à Papers Empire, un idle game de navigateur où tu transformes une petite imprimerie en usine 4.0. Sans compte, sauvegarde locale.",
  },
  en: {
    title: "Papers Empire — Free browser idle game",
    description: "Play Papers Empire free in your browser. Turn a small print shop into Factory 4.0, unlock 12 production units and keep your progress locally.",
  },
  de: {
    title: "Papers Empire — Kostenloses Idle Game im Browser",
    description: "Spiele Papers Empire kostenlos im Browser. Verwandle eine kleine Druckerei in eine Fabrik 4.0, schalte zwölf Produktionseinheiten frei und speichere lokal.",
  },
  lb: {
    title: "Papers Empire — Gratis Idle Game am Browser",
    description: "Spill Papers Empire gratis am Browser. Maach aus enger klenger Dréckerei eng Fabrick 4.0, schalt zwielef Produktiounseenheete fräi a späicher lokal.",
  },
});

const MANIFESTS = Object.freeze({
  fr: {
    path: "/site.webmanifest",
    startUrl: "/",
    description: "Jeu idle gratuit dans le navigateur : transforme ton imprimerie en usine 4.0.",
  },
  en: {
    path: "/site.en.webmanifest",
    startUrl: "/en/",
    description: "Play Papers Empire free in your browser. Turn a small print shop into Factory 4.0 and keep your progress locally.",
  },
  de: {
    path: "/site.de.webmanifest",
    startUrl: "/de/",
    description: "Spiele Papers Empire kostenlos im Browser. Verwandle eine kleine Druckerei in eine Fabrik 4.0 und speichere deinen Fortschritt lokal.",
  },
  lb: {
    path: "/site.lb.webmanifest",
    startUrl: "/lb/",
    description: "Spill Papers Empire gratis am Browser. Maach aus enger klenger Dréckerei eng Fabrick 4.0 a späicher däi Fortschrëtt lokal.",
  },
});

function routeFile(path) {
  return `${path.replace(/^\//, "")}index.html`;
}

function familyAlternates(kind, article = null) {
  return Object.fromEntries(localeCodes.map(lang => [
    lang,
    absolute(kind === "home"
      ? LOCALES[lang].homePath
      : kind === "hub"
        ? LOCALES[lang].hubPath
        : articlePath(article, lang)),
  ]));
}

const PAGES = [];
for (const lang of localeCodes) {
  PAGES.push({
    kind: "home",
    lang,
    path: LOCALES[lang].homePath,
    url: absolute(LOCALES[lang].homePath),
    ...HOME_PAGES[lang],
    alternates: familyAlternates("home"),
  });
}
for (const lang of localeCodes) {
  PAGES.push({
    kind: "hub",
    lang,
    path: LOCALES[lang].hubPath,
    url: absolute(LOCALES[lang].hubPath),
    title: HUBS[lang].title,
    description: HUBS[lang].description,
    alternates: familyAlternates("hub"),
  });
}
for (const article of ARTICLES) {
  for (const lang of localeCodes) {
    PAGES.push({
      kind: "article",
      lang,
      article,
      path: articlePath(article, lang),
      url: absolute(articlePath(article, lang)),
      title: article.translations[lang].title,
      description: article.translations[lang].description,
      alternates: familyAlternates("article", article),
    });
  }
}

function parseAttributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)]
    .map(([, name, , value]) => [name.toLowerCase(), value]));
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(match => ({
    raw: match[0],
    attrs: parseAttributes(match[0]),
  }));
}

function findTag(html, name, expected) {
  const matches = tags(html, name).filter(candidate => Object.entries(expected)
    .every(([key, value]) => candidate.attrs[key] === value));
  assert.equal(matches.length, 1,
    `<${name}> must expose ${JSON.stringify(expected)} exactly once`);
  return matches[0];
}

function meta(html, key, value) {
  const expected = key === "name" ? { name: value } : { property: value };
  return findTag(html, "meta", expected).attrs.content;
}

function linksByRel(html, rel) {
  return tags(html, "link").filter(tag => tag.attrs.rel?.split(/\s+/).includes(rel));
}

function pageTitle(html) {
  const matches = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
  assert.equal(matches.length, 1, "each page must expose one title");
  return matches[0][1].trim();
}

function pageH1(html) {
  const matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  assert.equal(matches.length, 1, "each page must expose one h1");
  return matches[0][1].replace(/<[^>]*>/g, "").trim();
}

function jsonLdItems(html) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(blocks.length > 0, "each indexable page must expose JSON-LD");
  return blocks.flatMap(([, source]) => {
    const data = JSON.parse(source);
    assert.equal(data["@context"], "https://schema.org", "JSON-LD must use schema.org");
    return Array.isArray(data["@graph"]) ? data["@graph"] : [data];
  });
}

function hreflangMap(html) {
  const alternates = linksByRel(html, "alternate").filter(link => link.attrs.hreflang);
  const codes = alternates.map(link => link.attrs.hreflang);
  assert.equal(new Set(codes).size, codes.length, "hreflang links must be unique");
  return Object.fromEntries(alternates.map(link => [link.attrs.hreflang, link.attrs.href]));
}

function classTokens(tag) {
  return new Set((tag.attrs.class || "").split(/\s+/).filter(Boolean));
}

function tagsWithClass(html, name, className) {
  return tags(html, name).filter(tag => classTokens(tag).has(className));
}

function siteHeaderBlock(html, pageUrl) {
  const matches = [...html.matchAll(/<header\b[^>]*class=["']app-header site-header[^"']*["'][^>]*>[\s\S]*?<\/header>/gi)];
  assert.equal(matches.length, 1, `${pageUrl} must expose one shared global header`);
  const header = matches[0][0];
  assert.match(header, /<div\b[^>]*class=["']header-inner["'][^>]*>[\s\S]*?<div\b[^>]*class=["']header-top["']/,
    `${pageUrl} must retain header-inner > header-top hierarchy`);
  assert.doesNotMatch(header, /guide-header/,
    `${pageUrl} must not restore the retired editorial-only header`);
  return header;
}

function localStyles(html) {
  return linksByRel(html, "stylesheet")
    .map(link => link.attrs.href)
    .filter(path => path?.startsWith("/assets/css/"));
}

function assertVersionedStyles(html, expectedNames, pageUrl) {
  const styles = localStyles(html);
  assert.equal(styles.length, expectedNames.length,
    `${pageUrl} must load exactly ${expectedNames.length} local stylesheets`);
  expectedNames.forEach((name, index) => {
    const escapedName = name.replace(".", "\\.");
    assert.match(styles[index], new RegExp(`^/assets/css/${escapedName.replace("\\.css", "")}\\.[a-f0-9]+\\.css$`),
      `${pageUrl} must load versioned ${name} in the shared cascade order`);
    assert.ok(existsSync(new URL(`.${styles[index]}`, siteDir)),
      `${pageUrl} references missing ${styles[index]}`);
  });
}

function localScriptSources(html) {
  return tags(html, "script")
    .map(script => script.attrs.src)
    .filter(path => path?.startsWith("/assets/"));
}

function assertLightweightHeaderRuntime(html, pageUrl) {
  const scripts = localScriptSources(html);
  assert.equal(scripts.length, 1,
    `${pageUrl} must load only one local controller outside its editorial HTML`);
  assert.match(scripts[0], /^\/assets\/js\/site-header\.js\?v=[a-f0-9]+$/,
    `${pageUrl} must load only the revisioned shared-header controller`);
  assert.ok(existsSync(new URL(`.${scripts[0].split("?")[0]}`, siteDir)),
    `${pageUrl} references missing ${scripts[0]}`);
}

function validateAppIconLinks(html, pageUrl, lang = "fr") {
  const icon = findTag(html, "link", { rel: "icon", type: "image/png", sizes: "192x192" });
  assert.match(icon.attrs.href, /^\/assets\/images\/icon-192\.png\?v=[a-f0-9]+$/,
    `${pageUrl} must expose the revisioned 192px PNG favicon`);
  assert.ok(existsSync(new URL(`.${icon.attrs.href.split("?")[0]}`, siteDir)),
    `${pageUrl} references a missing 192px PNG favicon`);

  const manifest = findTag(html, "link", { rel: "manifest" });
  const expectedManifest = MANIFESTS[lang];
  const escapedPath = expectedManifest.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(manifest.attrs.href, new RegExp(`^${escapedPath}\\?v=[a-f0-9]+$`),
    `${pageUrl} must expose its revisioned ${lang} web manifest`);
  const manifestUrl = new URL(`.${expectedManifest.path}`, siteDir);
  assert.ok(existsSync(manifestUrl),
    `${pageUrl} references a missing web manifest`);
  const manifestData = JSON.parse(readFileSync(manifestUrl, "utf8"));
  assert.equal(manifestData.name, "Papers Empire");
  assert.equal(manifestData.lang, lang, `${pageUrl} manifest must use ${lang}`);
  assert.equal(manifestData.id, "/", `${pageUrl} manifests must share one app identity`);
  assert.equal(manifestData.scope, "/", `${pageUrl} manifest must cover the whole app`);
  assert.equal(manifestData.start_url, expectedManifest.startUrl,
    `${pageUrl} manifest must launch its localized home`);
  assert.equal(manifestData.description, expectedManifest.description,
    `${pageUrl} manifest description must match its language`);
  for (const iconSize of ["192x192", "512x512"]) {
    const icons = manifestData.icons.filter(iconEntry => iconEntry.sizes === iconSize);
    assert.equal(icons.length, 1, `${pageUrl} manifest must expose one ${iconSize} icon`);
    const dimension = iconSize.split("x")[0];
    assert.match(icons[0].src, new RegExp(`^/assets/images/icon-${dimension}\\.png\\?v=[a-f0-9]+$`),
      `${pageUrl} manifest icons must be revisioned`);
  }
}

function validateSiteHeader(page, html) {
  const header = siteHeaderBlock(html, page.url);
  const styles = localStyles(html);
  assert.equal(styles.filter(path => /^\/assets\/css\/site-header\.[a-f0-9]+\.css$/.test(path)).length, 1,
    `${page.url} must load one immutable shared-header stylesheet`);

  const webpLogo = tags(header, "source").find(source =>
    source.attrs.srcset?.includes("/assets/brand/papers-empire-logo-v2-cutout.webp"));
  const pngLogo = tags(header, "img").find(image =>
    image.attrs.src?.startsWith("/assets/brand/papers-empire-logo-v2-cutout.png"));
  assert.ok(webpLogo && pngLogo,
    `${page.url} shared header must expose WebP and PNG variants of the painted logo`);

  const workshopLinks = tagsWithClass(header, "a", "site-nav-guides");
  assert.equal(workshopLinks.length, 1,
    `${page.url} must expose one desktop workshop link in the shared header`);
  const workshop = workshopLinks[0];
  assert.equal(new URL(workshop.attrs.href, page.url).pathname, LOCALES[page.lang].hubPath,
    `${page.url} shared header must target its localized workshop hub`);
  if (page.kind === "hub" || page.kind === "article") {
    assert.ok(classTokens(workshop).has("active"),
      `${page.url} must show the workshop as its active global section`);
    assert.equal(workshop.attrs["aria-current"], page.kind === "hub" ? "page" : "location",
      `${page.url} must distinguish the workshop hub from an article location`);
  }

  const dataLinks = tagsWithClass(header, "a", "nav-dash-link");
  assert.equal(dataLinks.length, 1,
    `${page.url} must expose one Data Science Zone link in the shared header`);
  if (page.kind !== "home") {
    const dataUrl = new URL(dataLinks[0].attrs.href, page.url);
    assert.equal(dataUrl.pathname, "/dashboard/",
      `${page.url} Data Science Zone link must retain its canonical path`);
    assert.equal(dataUrl.search, page.lang === "fr" ? "" : `?lang=${page.lang}`,
      `${page.url} Data Science Zone link must preserve the editorial language`);
  }

  return header;
}

function validateHeaderLanguageAlternates(page, header) {
  const selects = tagsWithClass(header, "select", "lang-select")
    .filter(select => /\bdata-(?:language|locale)-select\b/.test(select.raw));
  assert.equal(selects.length, 1,
    `${page.url} must expose one shared language selector`);
  const selectBlockMatch = header.match(new RegExp(`${selects[0].raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s\\S]*?)<\\/select>`));
  assert.ok(selectBlockMatch, `${page.url} language selector must close`);
  const options = [...selectBlockMatch[0].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/gi)]
    .map((match) => ({
      raw: match[0].slice(0, match[0].indexOf(">") + 1),
      attrs: parseAttributes(`<option ${match[1]}>`),
      label: match[2].trim(),
    }));
  assert.equal(options.length, localeCodes.length,
    `${page.url} language selector must expose every locale exactly once`);

  const byLanguage = new Map();
  for (const option of options) {
    const lang = option.attrs["data-lang"] || option.label.toLowerCase();
    assert.ok(localeCodes.includes(lang), `${page.url} language option needs a supported data-lang`);
    assert.equal(byLanguage.has(lang), false, `${page.url} must not duplicate ${lang} in its language selector`);
    assert.ok(option.attrs.value, `${page.url} ${lang} language option needs an alternate URL`);
    byLanguage.set(lang, option);
  }

  for (const lang of localeCodes) {
    const option = byLanguage.get(lang);
    assert.ok(option, `${page.url} language selector is missing ${lang}`);
    assert.equal(new URL(option.attrs.value, page.url).href, page.alternates[lang],
      `${page.url} ${lang} selector option must preserve the equivalent editorial page`);
  }
  const selected = options.filter(option => /\sselected(?:\s|>|=)/i.test(option.raw));
  assert.equal(selected.length, 1, `${page.url} language selector needs one selected option`);
  assert.equal(selected[0].attrs["data-lang"] || selected[0].label.toLowerCase(), page.lang,
    `${page.url} language selector must select its current locale`);
}

function validateFooterLanguageAlternates(page, html) {
  const footerMatches = [...html.matchAll(/<footer\b[^>]*class=["'][^"']*\bguide-footer\b[^"']*["'][^>]*>[\s\S]*?<\/footer>/gi)];
  assert.equal(footerMatches.length, 1, `${page.url} must expose one editorial footer`);
  const footer = footerMatches[0][0];
  const navMatches = [...footer.matchAll(/<nav\b[^>]*class=["'][^"']*\bguide-footer__links\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi)];
  assert.equal(navMatches.length, 1,
    `${page.url} footer must expose one visible language navigation`);
  const nav = navMatches[0][0];
  const navTag = tags(nav, "nav")[0];
  assert.equal(navTag.attrs["aria-label"], LOCALES[page.lang].ui.language,
    `${page.url} footer language navigation needs a localized accessible name`);

  const anchors = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
    attrs: parseAttributes(`<a ${match[1]}>`),
    label: match[2].replace(/<[^>]*>/g, "").trim(),
  }));
  assert.equal(anchors.length, localeCodes.length,
    `${page.url} footer must expose four language links`);

  const byLanguage = new Map();
  for (const anchor of anchors) {
    const code = anchor.attrs.hreflang;
    assert.ok(localeCodes.includes(code), `${page.url} footer language link needs a supported hreflang`);
    assert.equal(byLanguage.has(code), false, `${page.url} footer must not duplicate ${code}`);
    assert.ok(anchor.attrs.rel?.split(/\s+/).includes("alternate"),
      `${page.url} footer ${code} link must declare rel=alternate`);
    assert.equal(anchor.attrs.lang, LOCALES[code].htmlLang,
      `${page.url} footer ${code} link must declare its text language`);
    assert.equal(anchor.label, LOCALES[code].nativeName,
      `${page.url} footer ${code} link must use its native language name`);
    assert.equal(new URL(anchor.attrs.href, page.url).href, page.alternates[code],
      `${page.url} footer ${code} link must target the equivalent page`);
    byLanguage.set(code, anchor);
  }

  const current = anchors.filter(anchor => anchor.attrs["aria-current"] === "page");
  assert.equal(current.length, 1, `${page.url} footer needs one current language`);
  assert.equal(current[0].attrs.hreflang, page.lang,
    `${page.url} footer must mark its active language as current`);
}

function validateHomeFooterLanguageAlternates(page, html) {
  const navMatches = [...html.matchAll(/<nav\b[^>]*class=["'][^"']*\bfooter-language-nav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi)];
  assert.equal(navMatches.length, 1,
    `${page.url} must expose one visible footer language navigation`);
  const anchors = [...navMatches[0][0].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(match => ({
    attrs: parseAttributes(`<a ${match[1]}>`),
    label: match[2].replace(/<[^>]*>/g, "").trim(),
  }));
  assert.equal(anchors.length, localeCodes.length,
    `${page.url} footer must expose every home language`);

  for (const code of localeCodes) {
    const matches = anchors.filter(anchor => anchor.attrs["data-home-lang"] === code);
    assert.equal(matches.length, 1, `${page.url} footer must expose ${code} once`);
    const anchor = matches[0];
    assert.equal(anchor.attrs.hreflang, code);
    assert.equal(anchor.attrs.lang, LOCALES[code].htmlLang);
    assert.ok(anchor.attrs.rel?.split(/\s+/).includes("alternate"));
    assert.equal(anchor.label, code.toUpperCase());
    assert.equal(new URL(anchor.attrs.href, page.url).href, page.alternates[code]);
  }

  const current = anchors.filter(anchor => anchor.attrs["aria-current"] === "page");
  assert.equal(current.length, 1, `${page.url} footer needs one current language`);
  assert.equal(current[0].attrs["data-home-lang"], page.lang);
}

function validateIdentityGraph(items, pageUrl) {
  const website = items.find(item => item["@type"] === "WebSite" && item["@id"] === WEBSITE_ID);
  const person = items.find(item => item["@type"] === "Person" && item["@id"] === AUTHOR_ID);
  assert.ok(website && person, `${pageUrl} JSON-LD must define its WebSite and Person entities`);
  assert.equal(website.url, `${SITE_ORIGIN}/`);
  assert.equal(website.name, "Papers Empire");
  assert.deepEqual(website.publisher, { "@id": AUTHOR_ID });
  assert.equal(person.name, AUTHOR.name);
  assert.equal(person.url, AUTHOR.url);
}

function hasNestedKey(value, keys) {
  if (Array.isArray(value)) return value.some(item => hasNestedKey(item, keys));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => keys.has(key) || hasNestedKey(nested, keys));
}

function assertNoInventedRatings(items, pageUrl) {
  assert.equal(hasNestedKey(items, new Set(["aggregateRating", "review", "ratingValue"])), false,
    `${pageUrl} structured data must not invent ratings or reviews`);
}

function loadDictionary(lang) {
  const source = readRoot(`assets/i18n/${lang}.js`);
  const window = { I18N: {} };
  new Function("window", source)(window);
  return window.I18N[lang];
}

function readWebPSize(path) {
  const image = readFileSync(path);
  assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF", `${path} must be RIFF`);
  assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP", `${path} must be WebP`);
  let offset = 12;
  while (offset + 8 <= image.length) {
    const chunk = image.subarray(offset, offset + 4).toString("ascii");
    const length = image.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunk === "VP8X") {
      return {
        width: 1 + image.readUIntLE(data + 4, 3),
        height: 1 + image.readUIntLE(data + 7, 3),
      };
    }
    if (chunk === "VP8 ") {
      assert.equal(image.subarray(data + 3, data + 6).toString("hex"), "9d012a",
        `${path} must expose a VP8 frame header`);
      return {
        width: image.readUInt16LE(data + 6) & 0x3fff,
        height: image.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const bits = image.readUInt32LE(data + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    offset = data + length + (length % 2);
  }
  assert.fail(`${path} must expose WebP dimensions`);
}

function validateCommon(page, html) {
  assert.match(html, new RegExp(`<html\\s+lang=["']${page.lang}["']`),
    `${page.url} must declare ${page.lang}`);
  assert.equal(pageTitle(html), page.title, `${page.url} must expose its registered title`);
  assert.equal(meta(html, "name", "description"), page.description,
    `${page.url} must expose its registered description`);
  assert.equal(findTag(html, "link", { rel: "canonical" }).attrs.href, page.url,
    `${page.url} must self-canonicalize`);
  assert.equal(meta(html, "property", "og:url"), page.url,
    `${page.url} og:url must equal canonical`);
  assert.equal(meta(html, "property", "og:title"), page.title,
    `${page.url} Open Graph title must match`);
  const ogDescription = meta(html, "property", "og:description");
  assert.equal(meta(html, "name", "twitter:title"), page.title,
    `${page.url} Twitter title must match`);
  const twitterDescription = meta(html, "name", "twitter:description");
  assert.equal(twitterDescription, ogDescription,
    `${page.url} social descriptions must match each other`);
  if (page.kind !== "home") {
    assert.equal(ogDescription, page.description,
      `${page.url} guide social description must match its meta description`);
  }
  assert.doesNotMatch(meta(html, "name", "robots"), /(?:^|\s|,)noindex(?:\s|,|$)/i,
    `${page.url} must remain indexable`);
  assert.ok(page.title.length >= 30 && page.title.length <= 65,
    `${page.url} title must remain within 30–65 characters`);
  assert.ok(page.description.length >= 100 && page.description.length <= 180,
    `${page.url} description must remain useful`);
  validateSiteHeader(page, html);

  const alternates = hreflangMap(html);
  assert.deepEqual(Object.keys(alternates).sort(), [...localeCodes, "x-default"].sort(),
    `${page.url} must expose one complete hreflang cluster`);
  for (const code of localeCodes) {
    assert.equal(alternates[code], page.alternates[code],
      `${page.url} must link to its ${code} equivalent`);
  }
  assert.equal(alternates["x-default"], page.alternates.fr,
    `${page.url} x-default must point to the French equivalent`);

  for (const anchor of tags(html, "a")) {
    if (!anchor.attrs.href) continue;
    assert.doesNotMatch(anchor.attrs.href, /(?:[?&])welcome=1(?:[&#]|$)/,
      `${page.url} must not link to the legacy welcome query`);
    const target = new URL(anchor.attrs.href, page.url);
    if (target.origin !== SITE_ORIGIN) continue;
    const targetPath = target.pathname.endsWith("/")
      ? routeFile(target.pathname)
      : target.pathname.replace(/^\//, "");
    const direct = new URL(targetPath, siteDir);
    const directoryIndex = new URL(`${targetPath}/index.html`, siteDir);
    assert.ok(existsSync(direct) || existsSync(directoryIndex),
      `${page.url} links to missing ${target.pathname}`);
  }
}

function validateHome(page, html) {
  const dict = loadDictionary(page.lang);
  assert.equal(dict["app.metaTitle"], page.title,
    `${page.lang} runtime title must match the static head`);
  assertVersionedStyles(html, ["style.css", "site-header.css", "experience-v4.css"], page.url);
  for (const key of ["nav.guides", "nav.guidesShort"]) {
    const renderedGuideLabel = html.match(new RegExp(`data-i18n="${key.replaceAll(".", "\\.")}"[^>]*>([^<]+)<`))?.[1];
    assert.equal(renderedGuideLabel, dict[key],
      `${page.url} must pre-render the ${key} navigation label`);
  }

  for (const className of ["site-nav-guides", "home-guides-link"]) {
    const matches = tags(html, "a").filter(anchor =>
      anchor.attrs.class?.split(/\s+/).includes(className));
    assert.equal(matches.length, 1,
      `${page.url} must expose one ${className} workshop link`);
    const target = new URL(matches[0].attrs.href, page.url);
    assert.equal(target.origin, SITE_ORIGIN,
      `${page.url} ${className} must remain on the canonical site`);
    assert.equal(target.pathname, LOCALES[page.lang].hubPath,
      `${page.url} ${className} must open the ${page.lang} workshop hub`);
  }

  for (const key of SEO_FALLBACK_KEYS) {
    const value = dict[key];
    assert.ok(value, `${page.lang} dictionary must define ${key}`);
    const rendered = html.match(new RegExp(`data-i18n="${key.replaceAll(".", "\\.")}"[^>]*>([^<]+)<`))?.[1];
    assert.equal(rendered, value,
      `${page.url} must pre-render ${key} without JavaScript`);
  }

  const dictionaries = localScriptSources(html)
    .filter(path => /^\/assets\/i18n\/[a-z]+\.js\?v=[a-f0-9]+$/.test(path));
  assert.equal(dictionaries.length, 1,
    `${page.url} must load exactly one locale dictionary`);
  assert.match(dictionaries[0], new RegExp(`^/assets/i18n/${page.lang}\\.js\\?v=[a-f0-9]+$`),
    `${page.url} must load only its own locale dictionary`);
  validateAppIconLinks(html, page.url, page.lang);
  validateHomeFooterLanguageAlternates(page, html);

  const items = jsonLdItems(html);
  const game = items.find(item => Array.isArray(item["@type"]) && item["@type"].includes("VideoGame"));
  const website = items.find(item => item["@type"] === "WebSite");
  assert.ok(game, `${page.url} JSON-LD must describe the game`);
  assert.ok(website, `${page.url} JSON-LD must describe the website`);
  assert.equal(game.url, `${SITE_ORIGIN}/`);
  assert.equal(game.sameAs, "https://github.com/nclsppr/papersempire");
  assert.deepEqual(game.author, { "@id": AUTHOR_ID });
  assert.equal(game.isAccessibleForFree, true);
  assert.equal(game.offers?.price, "0");
  validateIdentityGraph(items, page.url);
}

function validateGuide(page, html) {
  assert.equal((html.match(/<main\b/gi) || []).length, 1, `${page.url} must expose one main`);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${page.url} must expose one h1`);
  assert.match(html, /class="skip-link" href="#main"/, `${page.url} must expose a skip link`);
  assert.match(html, new RegExp(`class="breadcrumbs"[^>]*aria-label="${LOCALES[page.lang].ui.breadcrumbLabel}"[\\s\\S]*<ol>`),
    `${page.url} must expose an ordered visible breadcrumb`);
  assertVersionedStyles(html, ["guides.css", "site-header.css"], page.url);
  assertLightweightHeaderRuntime(html, page.url);
  validateHeaderLanguageAlternates(page, siteHeaderBlock(html, page.url));
  validateFooterLanguageAlternates(page, html);
  assert.doesNotMatch(html, /tabindex=["'][1-9]/,
    `${page.url} must not alter keyboard order`);

  validateAppIconLinks(html, page.url, page.lang);

  const imageUrl = meta(html, "property", "og:image");
  assert.equal(meta(html, "name", "twitter:image"), imageUrl,
    `${page.url} must share one social image`);
  assert.equal(meta(html, "property", "og:image:width"), "1200");
  assert.equal(meta(html, "property", "og:image:height"), "630");
  assert.ok(meta(html, "property", "og:image:alt"), `${page.url} needs localized image alt`);
  assert.equal(meta(html, "name", "twitter:image:alt"), meta(html, "property", "og:image:alt"));

  for (const image of tags(html, "img")) {
    assert.ok("alt" in image.attrs, `${page.url} images must expose alt`);
    assert.ok(image.attrs.width && image.attrs.height, `${page.url} images must declare dimensions`);
  }

  const localAssets = [
    ...tags(html, "img").map(tag => tag.attrs.src),
    ...tags(html, "source").map(tag => tag.attrs.srcset),
    ...linksByRel(html, "stylesheet").map(tag => tag.attrs.href),
    ...localScriptSources(html),
  ].filter(path => path?.startsWith("/assets/")).map(path => path.split("?")[0]);
  for (const path of localAssets) {
    assert.ok(existsSync(new URL(`.${path}`, siteDir)), `${page.url} references missing ${path}`);
  }
}

function validateHub(page, html) {
  validateGuide(page, html);
  assert.equal(meta(html, "property", "og:type"), "website");
  assert.equal(pageH1(html), HUBS[page.lang].h1,
    `${page.url} h1 must describe its browser idle game guides`);
  for (const property of ["article:published_time", "article:modified_time", "article:author"]) {
    assert.equal(tags(html, "meta").filter(tag => tag.attrs.property === property).length, 0,
      `${page.url} must not expose article-only Open Graph metadata`);
  }
  const items = jsonLdItems(html);
  const collection = items.find(item => item["@type"] === "CollectionPage");
  const list = items.find(item => item["@type"] === "ItemList");
  const breadcrumb = items.find(item => item["@type"] === "BreadcrumbList");
  assert.ok(collection && list && breadcrumb, `${page.url} needs CollectionPage, ItemList and BreadcrumbList`);
  assert.equal(collection.url, page.url);
  assert.equal(collection.inLanguage, page.lang);
  assert.deepEqual(collection.author, { "@id": AUTHOR_ID });
  assert.deepEqual(collection.publisher, { "@id": AUTHOR_ID });
  assert.deepEqual(collection.isPartOf, { "@id": WEBSITE_ID });
  validateIdentityGraph(items, page.url);
  assertNoInventedRatings(items, page.url);
  assert.equal(list.numberOfItems, ARTICLES.length);
  assert.equal(list.itemListElement.length, ARTICLES.length);
  assert.deepEqual(
    list.itemListElement.map(item => item.position),
    ARTICLES.map((_, index) => index + 1),
  );
  assert.equal(breadcrumb.itemListElement.at(-1).item, page.url);
}

function validateArticle(page, html) {
  validateGuide(page, html);
  assert.equal(meta(html, "property", "og:type"), "article");
  assert.equal(meta(html, "property", "article:published_time"), page.article.datePublished);
  assert.equal(meta(html, "property", "article:modified_time"), page.article.dateModified);
  assert.equal(meta(html, "property", "article:author"), AUTHOR.url);
  assert.equal((html.match(/<article\b/gi) || []).length, 1, `${page.url} must expose one article`);
  assert.equal(pageH1(html), page.title, `${page.url} h1 must match its article title`);
  assert.match(html, new RegExp(`rel=["']author["'][^>]*>${AUTHOR.name}<`),
    `${page.url} must visibly credit Nicolas Pieper`);
  assert.ok((html.match(/<section\b/gi) || []).length >= 4,
    `${page.url} must provide substantial structured content`);

  const items = jsonLdItems(html);
  const article = items.find(item => item["@type"] === "Article");
  const breadcrumb = items.find(item => item["@type"] === "BreadcrumbList");
  assert.ok(article && breadcrumb, `${page.url} needs Article and BreadcrumbList`);
  assert.equal(article.url, page.url);
  assert.equal(article.mainEntityOfPage, page.url);
  assert.equal(article.headline, page.title);
  assert.equal(article.description, page.description);
  assert.equal(article.inLanguage, page.lang);
  assert.deepEqual(article.author, { "@id": AUTHOR_ID });
  assert.deepEqual(article.publisher, { "@id": AUTHOR_ID });
  assert.deepEqual(article.isPartOf, { "@id": WEBSITE_ID });
  assert.equal(article.datePublished, page.article.datePublished);
  assert.equal(article.dateModified, page.article.dateModified);
  assert.ok(article.dateModified >= article.datePublished);
  assert.match(html, new RegExp(`<time datetime=["']${page.article.sourcesCheckedAt}["']>`),
    `${page.url} must expose a machine-readable source-check date`);
  assert.equal(article.image?.url, absolute(page.article.image));
  assert.deepEqual([article.image?.width, article.image?.height], [1200, 630]);
  validateIdentityGraph(items, page.url);
  assertNoInventedRatings(items, page.url);
  assert.deepEqual(breadcrumb.itemListElement.map(item => item.position), [1, 2, 3]);
  assert.equal(breadcrumb.itemListElement.at(-1).item, page.url);
}

assert.ok(existsSync(new URL("index.html", siteDir)),
  "site/ is missing; run npm run cloudflare:build before npm run seo:check");

const seenTitles = new Set();
const seenDescriptions = new Set();
for (const page of PAGES) {
  const html = readSite(routeFile(page.path));
  validateCommon(page, html);
  assert.ok(!seenTitles.has(page.title), `duplicate title: ${page.title}`);
  assert.ok(!seenDescriptions.has(page.description), `duplicate description: ${page.description}`);
  seenTitles.add(page.title);
  seenDescriptions.add(page.description);
  if (page.kind === "home") validateHome(page, html);
  if (page.kind === "hub") validateHub(page, html);
  if (page.kind === "article") validateArticle(page, html);
}

const notFound = readSite("404.html");
const notFoundPage = { kind: "404", lang: "fr", url: `${SITE_ORIGIN}/404.html` };
validateSiteHeader(notFoundPage, notFound);
assertVersionedStyles(notFound, ["guides.css", "site-header.css"], notFoundPage.url);
assertLightweightHeaderRuntime(notFound, notFoundPage.url);
validateAppIconLinks(notFound, notFoundPage.url);
const notFoundGuideLink = tags(notFound, "a").find(anchor => anchor.attrs.href === "/guides/");
assert.ok(notFoundGuideLink, "the built 404 page must retain a workshop recovery link");

const dashboard = readSite("dashboard/index.html");
validateAppIconLinks(dashboard, `${SITE_ORIGIN}/dashboard/`);

for (const article of ARTICLES) {
  const sourcePath = fileURLToPath(new URL(`.${article.image}`, rootDir));
  assert.ok(existsSync(sourcePath), `${article.id} must provide its social image`);
  assert.deepEqual(readWebPSize(sourcePath), { width: 1200, height: 630 },
    `${article.id} social image must remain 1200x630`);
}

const sitemap = readSite("sitemap.xml");
assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/,
  "the sitemap must declare UTF-8 XML");
assert.match(sitemap, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/,
  "the sitemap must expose the hreflang namespace");
assert.match(sitemap, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/,
  "the sitemap must expose the image namespace");
assert.doesNotMatch(sitemap, /<image:title>/,
  "the sitemap must not use the deprecated image:title element");
assert.equal((sitemap.match(/<url>/g) || []).length, (sitemap.match(/<\/url>/g) || []).length,
  "every sitemap URL entry must close");
const sitemapBlocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => block);
const sitemapUrls = sitemapBlocks.map(block => block.match(/<loc>([^<]+)<\/loc>/)?.[1]);
assert.deepEqual(sitemapUrls, PAGES.map(page => page.url),
  "the sitemap must contain exactly every canonical game and guide page");
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "sitemap URLs must be unique");
for (const [index, block] of sitemapBlocks.entries()) {
  const page = PAGES[index];
  const alternateTags = [...block.matchAll(/<xhtml:link\b([^>]+)\/>/g)];
  assert.equal(alternateTags.length, localeCodes.length + 1,
    `${page.url} sitemap must expose exactly one alternate per language plus x-default`);
  const alternateEntries = alternateTags.map(([, attrs]) => {
    const parsed = parseAttributes(`<xhtml:link ${attrs}>`);
    return [parsed.hreflang, parsed.href];
  });
  assert.equal(new Set(alternateEntries.map(([code]) => code)).size, alternateEntries.length,
    `${page.url} sitemap hreflang values must be unique`);
  const alternates = Object.fromEntries(alternateEntries);
  assert.deepEqual(alternates, { ...page.alternates, "x-default": page.alternates.fr },
    `${page.url} sitemap hreflang must match its HTML cluster`);
  const expectedLastmod = page.kind === "article" ? page.article.dateModified : HOME_AND_HUB_LASTMOD;
  const lastmods = [...block.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(match => match[1]);
  assert.deepEqual(lastmods, [expectedLastmod],
    `${page.url} sitemap must expose one exact lastmod`);
  if (page.kind === "article") {
    assert.match(block, new RegExp(`<image:loc>${absolute(page.article.image)}<\\/image:loc>`));
  } else {
    assert.doesNotMatch(block, /<image:image>/,
      `${page.url} must not invent an image entry`);
  }
}

const robots = readSite("robots.txt");
assert.match(robots, /User-agent: \*\s+Allow: \//,
  "robots.txt must allow search crawling");
assert.equal((robots.match(/^Sitemap:/gm) || []).length, 1,
  "robots.txt must advertise only the player-facing sitemap");
assert.match(robots, /^Sitemap: https:\/\/papersempire\.com\/sitemap\.xml$/m);
assert.doesNotMatch(robots, /docs\/sitemap\.xml/,
  "technical documentation must not be advertised for indexing");

const app = readRoot("assets/js/app.js");
assert.match(app, /window\.location\.assign\(url\.href\)/,
  "language changes must navigate to canonical static pages");
assert.doesNotMatch(app, /url\.searchParams\.set\("lang"/,
  "language changes must not create contradictory ?lang variants");

console.log(`SEO contracts: ok (${PAGES.length} indexable pages, ${ARTICLES.length} guides × ${localeCodes.length} languages)`);
