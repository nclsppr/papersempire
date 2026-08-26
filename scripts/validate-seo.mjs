#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const rootDir = new URL("../", import.meta.url);
const siteDir = new URL("../site/", import.meta.url);
const readRoot = path => readFileSync(new URL(path, rootDir), "utf8");
const readSite = path => readFileSync(new URL(path, siteDir), "utf8");

const PAGES = {
  fr: {
    path: "",
    url: "https://papersempire.com/",
    title: "Papers Empire — Jeu idle gratuit dans le navigateur",
    description: "Joue gratuitement à Papers Empire, un idle game de navigateur où tu transformes une petite imprimerie en usine 4.0. Sans compte, sauvegarde locale."
  },
  en: {
    path: "en/",
    url: "https://papersempire.com/en/",
    title: "Papers Empire — Free browser idle game",
    description: "Play Papers Empire free in your browser. Turn a small print shop into Factory 4.0, unlock 11 production units and keep your progress locally."
  },
  de: {
    path: "de/",
    url: "https://papersempire.com/de/",
    title: "Papers Empire — Kostenloses Idle Game im Browser",
    description: "Spiele Papers Empire kostenlos im Browser. Verwandle eine kleine Druckerei in eine Fabrik 4.0, schalte elf Produktionseinheiten frei und speichere lokal."
  },
  lb: {
    path: "lb/",
    url: "https://papersempire.com/lb/",
    title: "Papers Empire — Gratis Idle Game am Browser",
    description: "Spill Papers Empire gratis am Browser. Maach aus enger klenger Dréckerei eng Fabrick 4.0, schalt eelef Produktiounseenheete fräi a späicher lokal."
  }
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function attribute(html, element, name, value, attributeName = "content") {
  const pattern = new RegExp(
    `<${element}[^>]*${name}=["']${escapeRegExp(value)}["'][^>]*${attributeName}=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<${element}[^>]*${attributeName}=["']([^"']+)["'][^>]*${name}=["']${escapeRegExp(value)}["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern) || html.match(reversePattern);
  assert.ok(match, `${element}[${name}=${value}] must expose ${attributeName}`);
  return match[1];
}

function loadDictionary(lang) {
  const source = readRoot(`assets/i18n/${lang}.js`);
  const window = { I18N: {} };
  new Function("window", source)(window);
  return window.I18N[lang];
}

function structuredData(html) {
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i);
  assert.ok(match, "the game page must expose JSON-LD");
  return JSON.parse(match[1]);
}

function metaContent(html, name) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(match => match[0])
    .find(candidate => new RegExp(`\\bname=["']${escapeRegExp(name)}["']`, "i").test(candidate));
  assert.ok(tag, `meta[name=${name}] must exist`);
  const content = tag.match(/\bcontent=["']([^"']*)["']/i);
  assert.ok(content, `meta[name=${name}] must expose content`);
  return content[1];
}

assert.ok(existsSync(new URL("index.html", siteDir)),
  "site/ is missing; run npm run cloudflare:build before npm run seo:check");

for (const [lang, page] of Object.entries(PAGES)) {
  const html = readSite(`${page.path}index.html`);
  const dict = loadDictionary(lang);

  assert.match(html, new RegExp(`<html lang="${lang}">`), `${page.url} must declare ${lang}`);
  assert.equal(html.match(/<title>([^<]+)<\/title>/i)?.[1], page.title,
    `${page.url} must expose its unique title`);
  assert.equal(attribute(html, "meta", "name", "description"), page.description,
    `${page.url} must expose its unique description`);
  assert.equal(attribute(html, "link", "rel", "canonical", "href"), page.url,
    `${page.url} must self-canonicalize`);
  assert.equal(attribute(html, "meta", "property", "og:url"), page.url,
    `${page.url} Open Graph URL must match its canonical`);
  assert.equal(attribute(html, "meta", "property", "og:title"), page.title,
    `${page.url} Open Graph title must match its title`);
  assert.equal(attribute(html, "meta", "name", "twitter:title"), page.title,
    `${page.url} Twitter title must match its title`);
  assert.doesNotMatch(metaContent(html, "robots"), /(?:^|\s|,)noindex(?:\s|,|$)/i,
    `${page.url} must remain indexable`);
  assert.ok(page.title.length >= 30 && page.title.length <= 65,
    `${page.url} title must remain concise and descriptive`);
  assert.ok(page.description.length >= 100 && page.description.length <= 170,
    `${page.url} description must remain useful without keyword stuffing`);
  assert.equal(dict["app.metaTitle"], page.title,
    `${lang} runtime title must match the static head`);

  const alternateLinks = [...html.matchAll(
    /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g
  )];
  const alternates = Object.fromEntries(alternateLinks.map(([, code, url]) => [code, url]));
  for (const [alternateLang, alternatePage] of Object.entries(PAGES)) {
    assert.equal(alternates[alternateLang], alternatePage.url,
      `${page.url} must link to the ${alternateLang} alternate`);
  }
  assert.equal(alternates["x-default"], PAGES.fr.url,
    `${page.url} must expose the French x-default`);

  for (const key of ["scene.fallback", "footer.kicker", "footer.tagline", "footer.intro"]) {
    const value = dict[key];
    assert.ok(value, `${lang} dictionary must define ${key}`);
    assert.match(html, new RegExp(`data-i18n="${escapeRegExp(key)}"[^>]*>${escapeRegExp(value)}<`),
      `${page.url} must pre-render ${key} without JavaScript`);
  }

  const data = structuredData(html);
  assert.equal(data["@context"], "https://schema.org");
  assert.ok(Array.isArray(data["@graph"]), `${page.url} JSON-LD must expose an @graph`);
  const game = data["@graph"].find(item =>
    Array.isArray(item["@type"]) && item["@type"].includes("VideoGame"));
  const website = data["@graph"].find(item => item["@type"] === "WebSite");
  assert.ok(game, `${page.url} JSON-LD must describe the game`);
  assert.ok(website, `${page.url} JSON-LD must describe the website`);
  assert.equal(game.url, "https://papersempire.com/");
  assert.equal(game.sameAs, "https://github.com/nclsppr/papersempire");
  assert.equal(game.isAccessibleForFree, true);
  assert.equal(game.offers?.price, "0");
}

const sitemap = readSite("sitemap.xml");
assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/,
  "the sitemap must declare UTF-8 XML");
assert.match(sitemap, /<urlset\b[^>]*>/,
  "the sitemap must open a urlset");
assert.match(sitemap, /<\/urlset>\s*$/,
  "the sitemap must close its urlset");
assert.equal((sitemap.match(/<url>/g) || []).length, (sitemap.match(/<\/url>/g) || []).length,
  "every sitemap URL entry must close");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.deepEqual(sitemapUrls, Object.values(PAGES).map(page => page.url),
  "the sitemap must contain exactly the four canonical game pages");
assert.doesNotMatch(sitemap, /<lastmod>/,
  "the sitemap must omit lastmod until dates can be generated accurately");

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

console.log("SEO contracts: ok");
