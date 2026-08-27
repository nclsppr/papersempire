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

const HOME_PAGES = Object.freeze({
  fr: {
    title: "Papers Empire — Jeu idle gratuit dans le navigateur",
    description: "Joue gratuitement à Papers Empire, un idle game de navigateur où tu transformes une petite imprimerie en usine 4.0. Sans compte, sauvegarde locale.",
  },
  en: {
    title: "Papers Empire — Free browser idle game",
    description: "Play Papers Empire free in your browser. Turn a small print shop into Factory 4.0, unlock 11 production units and keep your progress locally.",
  },
  de: {
    title: "Papers Empire — Kostenloses Idle Game im Browser",
    description: "Spiele Papers Empire kostenlos im Browser. Verwandle eine kleine Druckerei in eine Fabrik 4.0, schalte elf Produktionseinheiten frei und speichere lokal.",
  },
  lb: {
    title: "Papers Empire — Gratis Idle Game am Browser",
    description: "Spill Papers Empire gratis am Browser. Maach aus enger klenger Dréckerei eng Fabrick 4.0, schalt eelef Produktiounseenheete fräi a späicher lokal.",
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
  assert.ok(page.title.length >= 30 && page.title.length <= (page.kind === "home" ? 65 : 85),
    `${page.url} title must remain concise`);
  assert.ok(page.description.length >= 100 && page.description.length <= 180,
    `${page.url} description must remain useful`);

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

  for (const key of ["scene.fallback", "footer.kicker", "footer.tagline", "footer.intro"]) {
    const value = dict[key];
    assert.ok(value, `${page.lang} dictionary must define ${key}`);
    assert.ok(html.includes(`data-i18n="${key}"`) && html.includes(`>${value}<`),
      `${page.url} must pre-render ${key} without JavaScript`);
  }

  const items = jsonLdItems(html);
  const game = items.find(item => Array.isArray(item["@type"]) && item["@type"].includes("VideoGame"));
  const website = items.find(item => item["@type"] === "WebSite");
  assert.ok(game, `${page.url} JSON-LD must describe the game`);
  assert.ok(website, `${page.url} JSON-LD must describe the website`);
  assert.equal(game.url, `${SITE_ORIGIN}/`);
  assert.equal(game.sameAs, "https://github.com/nclsppr/papersempire");
  assert.equal(game.isAccessibleForFree, true);
  assert.equal(game.offers?.price, "0");
}

function validateGuide(page, html) {
  assert.equal((html.match(/<main\b/gi) || []).length, 1, `${page.url} must expose one main`);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${page.url} must expose one h1`);
  assert.match(html, /class="skip-link" href="#main"/, `${page.url} must expose a skip link`);
  assert.match(html, new RegExp(`class="breadcrumbs"[^>]*aria-label="${LOCALES[page.lang].ui.breadcrumbLabel}"[\\s\\S]*<ol>`),
    `${page.url} must expose an ordered visible breadcrumb`);
  assert.doesNotMatch(html, /assets\/js\/(?:app|scene|persistence|events)|three\.module/,
    `${page.url} must not load the game runtime`);
  assert.doesNotMatch(html, /tabindex=["'][1-9]/,
    `${page.url} must not alter keyboard order`);

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
    ...linksByRel(html, "stylesheet").map(tag => tag.attrs.href),
  ].filter(path => path?.startsWith("/assets/")).map(path => path.split("?")[0]);
  for (const path of localAssets) {
    assert.ok(existsSync(new URL(`.${path}`, siteDir)), `${page.url} references missing ${path}`);
  }
}

function validateHub(page, html) {
  validateGuide(page, html);
  assert.equal(meta(html, "property", "og:type"), "website");
  const items = jsonLdItems(html);
  const collection = items.find(item => item["@type"] === "CollectionPage");
  const list = items.find(item => item["@type"] === "ItemList");
  const breadcrumb = items.find(item => item["@type"] === "BreadcrumbList");
  assert.ok(collection && list && breadcrumb, `${page.url} needs CollectionPage, ItemList and BreadcrumbList`);
  assert.equal(collection.url, page.url);
  assert.equal(collection.inLanguage, page.lang);
  assert.equal(collection.author?.url, AUTHOR.url);
  assert.equal(list.numberOfItems, ARTICLES.length);
  assert.equal(list.itemListElement.length, ARTICLES.length);
  assert.deepEqual(list.itemListElement.map(item => item.position), [1, 2, 3]);
  assert.equal(breadcrumb.itemListElement.at(-1).item, page.url);
}

function validateArticle(page, html) {
  validateGuide(page, html);
  assert.equal(meta(html, "property", "og:type"), "article");
  assert.equal((html.match(/<article\b/gi) || []).length, 1, `${page.url} must expose one article`);
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
  assert.equal(article.author?.name, AUTHOR.name);
  assert.equal(article.author?.url, AUTHOR.url);
  assert.equal(article.datePublished, page.article.datePublished);
  assert.equal(article.dateModified, page.article.dateModified);
  assert.ok(article.dateModified >= article.datePublished);
  assert.match(html, new RegExp(`<time datetime=["']${page.article.sourcesCheckedAt}["']>`),
    `${page.url} must expose a machine-readable source-check date`);
  assert.equal(article.image?.url, absolute(page.article.image));
  assert.deepEqual([article.image?.width, article.image?.height], [1200, 630]);
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
const notFoundStyles = linksByRel(notFound, "stylesheet")
  .map(link => link.attrs.href)
  .filter(path => path?.startsWith("/assets/"));
assert.equal(notFoundStyles.length, 1, "the 404 page must load one local editorial stylesheet");
assert.match(notFoundStyles[0], /^\/assets\/css\/guides\.[a-f0-9]+\.css$/,
  "the built 404 page must load the versioned workshop stylesheet");
assert.ok(existsSync(new URL(`.${notFoundStyles[0]}`, siteDir)),
  `the built 404 page references missing ${notFoundStyles[0]}`);
const notFoundGuideLink = tags(notFound, "a").find(anchor => anchor.attrs.href === "/guides/");
assert.ok(notFoundGuideLink, "the built 404 page must retain a workshop recovery link");

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
assert.equal((sitemap.match(/<url>/g) || []).length, (sitemap.match(/<\/url>/g) || []).length,
  "every sitemap URL entry must close");
const sitemapBlocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => block);
const sitemapUrls = sitemapBlocks.map(block => block.match(/<loc>([^<]+)<\/loc>/)?.[1]);
assert.deepEqual(sitemapUrls, PAGES.map(page => page.url),
  "the sitemap must contain exactly every canonical game and guide page");
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "sitemap URLs must be unique");
for (const [index, block] of sitemapBlocks.entries()) {
  const page = PAGES[index];
  const alternates = Object.fromEntries([...block.matchAll(/<xhtml:link\b([^>]+)\/>/g)]
    .map(([, attrs]) => {
      const parsed = parseAttributes(`<xhtml:link ${attrs}>`);
      return [parsed.hreflang, parsed.href];
    }));
  assert.deepEqual(alternates, { ...page.alternates, "x-default": page.alternates.fr },
    `${page.url} sitemap hreflang must match its HTML cluster`);
  if (page.kind === "article") {
    assert.match(block, new RegExp(`<lastmod>${page.article.dateModified}<\\/lastmod>`));
    assert.match(block, new RegExp(`<image:loc>${absolute(page.article.image)}<\\/image:loc>`));
  } else {
    assert.doesNotMatch(block, /<lastmod>|<image:image>/,
      `${page.url} must not invent an editorial date or image entry`);
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
