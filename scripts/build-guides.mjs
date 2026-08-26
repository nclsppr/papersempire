#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ARTICLES,
  AUTHOR,
  HUBS,
  LOCALES,
  SITE_ORIGIN,
  absolute,
  articlePath,
} from "../content/guides/index.mjs";

const [siteDir, stamp = ""] = process.argv.slice(2);
if (!siteDir) {
  console.error("Usage: node scripts/build-guides.mjs <site-directory> [sha]");
  process.exit(64);
}

const localeEntries = Object.entries(LOCALES);
const localeCodes = Object.keys(LOCALES);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function escapeXml(value) {
  return escapeAttr(value).replaceAll("'", "&apos;");
}

function jsonLd(value) {
  return JSON.stringify(value, null, 2).replaceAll("<", "\\u003c");
}

function versioned(path) {
  return stamp ? `${path}?v=${stamp}` : path;
}

function cssPath() {
  return `/assets/css/${stamp ? `guides.${stamp}.css` : "guides.css"}`;
}

function assertCatalog() {
  const routes = new Set();
  for (const [lang, locale] of localeEntries) {
    if (!HUBS[lang]) throw new Error(`Missing hub translation for ${lang}`);
    routes.add(locale.homePath);
    if (routes.has(locale.hubPath)) throw new Error(`Duplicate route ${locale.hubPath}`);
    routes.add(locale.hubPath);
  }

  for (const article of ARTICLES) {
    if (!isoDate.test(article.datePublished) || !isoDate.test(article.dateModified) || !isoDate.test(article.sourcesCheckedAt)) {
      throw new Error(`${article.id} must use ISO editorial dates`);
    }
    if (article.dateModified < article.datePublished) {
      throw new Error(`${article.id} dateModified precedes datePublished`);
    }
    if (article.sourcesCheckedAt > article.dateModified) {
      throw new Error(`${article.id} sourcesCheckedAt follows dateModified`);
    }
    if (article.image.includes("?")) throw new Error(`${article.id} image must be a stable path`);
    for (const lang of localeCodes) {
      const translation = article.translations[lang];
      if (!translation) throw new Error(`${article.id} is missing ${lang}`);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(translation.slug)) {
        throw new Error(`${article.id}:${lang} has an invalid slug`);
      }
      if (translation.title.length < 30 || translation.title.length > 85) {
        throw new Error(`${article.id}:${lang} title length is outside 30–85 characters`);
      }
      if (translation.description.length < 100 || translation.description.length > 180) {
        throw new Error(`${article.id}:${lang} description length is outside 100–180 characters`);
      }
      const route = articlePath(article, lang);
      if (routes.has(route)) throw new Error(`Duplicate route ${route}`);
      routes.add(route);
    }
  }
}

function alternateMap(article = null) {
  return Object.fromEntries(localeCodes.map(lang => [
    lang,
    absolute(article ? articlePath(article, lang) : LOCALES[lang].hubPath),
  ]));
}

function alternateLinks(article = null) {
  const alternates = alternateMap(article);
  return [
    ...localeCodes.map(lang =>
      `  <link rel="alternate" hreflang="${lang}" href="${escapeAttr(alternates[lang])}">`),
    `  <link rel="alternate" hreflang="x-default" href="${escapeAttr(alternates.fr)}">`,
  ].join("\n");
}

function localeAlternateMeta(lang) {
  return localeCodes
    .filter(code => code !== lang)
    .map(code => `  <meta property="og:locale:alternate" content="${LOCALES[code].ogLocale}">`)
    .join("\n");
}

function head({ lang, title, description, canonical, image, imageAlt, type, article = null, structuredData }) {
  const locale = LOCALES[lang];
  return `<!doctype html>
<html lang="${locale.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="author" content="${AUTHOR.name}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#07111f">
  <link rel="canonical" href="${escapeAttr(canonical)}">
${alternateLinks(article)}
  <link rel="icon" type="image/png" sizes="32x32" href="${versioned("/assets/images/favicon-32.png")}">
  <link rel="apple-touch-icon" href="${versioned("/assets/images/apple-touch-icon.png")}">
  <link rel="preload" href="${versioned("/assets/fonts/alfa-slab-one-latin.woff2")}" as="font" type="font/woff2" crossorigin>
  <script>
  // Apply the visual preferences before CSS to avoid a flash of the default theme.
  (function () {
    try {
      var prefs = JSON.parse(localStorage.getItem("pe-accessibility") || "null");
      if (!prefs) return;
      var root = document.documentElement;
      if (prefs.highContrast) root.classList.add("pref-high-contrast");
      if (prefs.largeText) root.classList.add("pref-large-text");
      if (prefs.reduceMotion) root.classList.add("pref-reduce-motion");
    } catch (error) {
      // The guide remains usable with its default presentation.
    }
  })();
  </script>
  <link rel="stylesheet" href="${cssPath()}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Papers Empire">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">
  <meta property="og:image" content="${escapeAttr(image)}">
  <meta property="og:image:type" content="image/webp">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeAttr(imageAlt)}">
  <meta property="og:locale" content="${locale.ogLocale}">
${localeAlternateMeta(lang)}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${escapeAttr(image)}">
  <meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}">
  <script type="application/ld+json">
${jsonLd(structuredData)}
  </script>
</head>`;
}

function languageLinks(article, lang) {
  const alternates = alternateMap(article);
  return localeCodes.map(code => {
    const active = code === lang ? ' aria-current="page"' : "";
    return `<a href="${escapeAttr(alternates[code])}" hreflang="${code}" lang="${code}"${active}>${LOCALES[code].label}</a>`;
  }).join("");
}

function shellStart({ lang, article = null }) {
  const locale = LOCALES[lang];
  return `<body>
  <a class="skip-link" href="#main">${escapeHtml(locale.ui.skip)}</a>
  <header class="guide-header">
    <div class="guide-header__inner">
      <a class="guide-brand" href="${locale.homePath}" aria-label="Papers Empire · ${escapeAttr(locale.ui.home)}">
        <img src="${versioned("/assets/brand/papers-empire-logo-v2-cutout.webp")}" width="175" height="140" alt="" decoding="async">
      </a>
      <nav class="guide-nav" aria-label="${escapeAttr(locale.ui.guides)}">
        <a href="${locale.homePath}">${escapeHtml(locale.ui.home)}</a>
        <a href="${locale.hubPath}"${article ? "" : ' aria-current="page"'}>${escapeHtml(locale.ui.guides)}</a>
      </nav>
      <nav class="language-nav" aria-label="${escapeAttr(locale.ui.language)}">
        ${languageLinks(article, lang)}
      </nav>
    </div>
  </header>`;
}

function breadcrumb({ lang, article = null }) {
  const locale = LOCALES[lang];
  const crumbs = [
    `<li><a href="${locale.homePath}">${escapeHtml(locale.ui.breadcrumbHome)}</a></li>`,
  ];
  if (article) {
    crumbs.push(`<li><a href="${locale.hubPath}">${escapeHtml(locale.ui.breadcrumbHub)}</a></li>`);
    crumbs.push(`<li aria-current="page">${escapeHtml(article.translations[lang].title)}</li>`);
  } else {
    crumbs.push(`<li aria-current="page">${escapeHtml(locale.ui.breadcrumbHub)}</li>`);
  }
  return `<nav class="breadcrumbs" aria-label="${escapeAttr(locale.ui.breadcrumbLabel)}"><ol>${crumbs.join("")}</ol></nav>`;
}

function shellEnd(lang) {
  const locale = LOCALES[lang];
  return `  <footer class="guide-footer">
    <div>
      <p class="guide-footer__stamp">PAPERS EMPIRE · ${escapeHtml(locale.ui.breadcrumbHub).toUpperCase()}</p>
      <p>${escapeHtml(locale.ui.footer)}</p>
    </div>
    <div class="guide-footer__links">
      <a href="${locale.homePath}">${escapeHtml(locale.ui.play)}</a>
      <a href="${locale.hubPath}">${escapeHtml(locale.ui.back)}</a>
      <a href="${AUTHOR.url}" rel="author">${AUTHOR.name}</a>
    </div>
  </footer>
</body>
</html>
`;
}

function hubStructuredData(lang) {
  const locale = LOCALES[lang];
  const hub = HUBS[lang];
  const canonical = absolute(locale.hubPath);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#collection`,
        url: canonical,
        name: hub.h1,
        description: hub.description,
        inLanguage: lang,
        author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
        mainEntity: { "@id": `${canonical}#list` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#list`,
        numberOfItems: ARTICLES.length,
        itemListElement: ARTICLES.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: absolute(articlePath(article, lang)),
          name: article.translations[lang].title,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Papers Empire", item: absolute(locale.homePath) },
          { "@type": "ListItem", position: 2, name: hub.h1, item: canonical },
        ],
      },
    ],
  };
}

function renderHub(lang) {
  const locale = LOCALES[lang];
  const hub = HUBS[lang];
  const canonical = absolute(locale.hubPath);
  const image = absolute(ARTICLES[0].image);
  const cards = ARTICLES.map((article, index) => {
    const translation = article.translations[lang];
    return `<article class="guide-card">
      <a class="guide-card__image" href="${articlePath(article, lang)}" tabindex="-1" aria-hidden="true">
        <img src="${versioned(article.image)}" width="1200" height="630" alt="" ${index ? 'loading="lazy"' : ""} decoding="async">
      </a>
      <div class="guide-card__body">
        <p class="eyebrow">${escapeHtml(translation.eyebrow)}</p>
        <h2><a href="${articlePath(article, lang)}">${escapeHtml(translation.title)}</a></h2>
        <p>${escapeHtml(translation.card)}</p>
        <p class="guide-card__meta"><span>${translation.readingMinutes} ${escapeHtml(locale.ui.minutes)}</span><span aria-hidden="true">·</span><time datetime="${article.datePublished}">${formatDate(article.datePublished, lang)}</time></p>
      </div>
    </article>`;
  }).join("\n");

  return `${head({
    lang,
    title: hub.title,
    description: hub.description,
    canonical,
    image,
    imageAlt: ARTICLES[0].translations[lang].imageAlt,
    type: "website",
    structuredData: hubStructuredData(lang),
  })}
${shellStart({ lang })}
  <main id="main">
    <div class="hub-hero">
      ${breadcrumb({ lang })}
      <div class="hub-hero__copy">
        <p class="eyebrow">${escapeHtml(hub.eyebrow)}</p>
        <h1>${escapeHtml(hub.h1)}</h1>
        <p class="hub-hero__lead">${escapeHtml(hub.intro)}</p>
        <p class="hub-hero__promise">${escapeHtml(hub.promise)}</p>
      </div>
      <div class="hub-hero__mark" aria-hidden="true">
        <span>PE</span><strong>${String(ARTICLES.length).padStart(2, "0")}</strong>
      </div>
    </div>
    <section class="guide-grid" aria-label="${escapeAttr(hub.h1)}">
      ${cards}
    </section>
    <aside class="author-note">
      <p class="eyebrow">${escapeHtml(locale.ui.disclosureLabel)}</p>
      <p>${escapeHtml(locale.ui.disclosure)}</p>
      <a href="${AUTHOR.url}" rel="author">${AUTHOR.name} · nicolaspieper.com</a>
    </aside>
  </main>
${shellEnd(lang)}`;
}

function formatDate(date, lang) {
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function renderTable(table) {
  const headers = table.headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join("");
  const rows = table.rows.map(row => `<tr>${row.map((cell, index) => index === 0
    ? `<th scope="row">${cell}</th>`
    : `<td>${cell}</td>`).join("")}</tr>`).join("");
  return `<div class="table-scroll" tabindex="0">
    <table>
      <caption>${escapeHtml(table.caption)}</caption>
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderSection(section, index) {
  const paragraphs = section.paragraphs?.map(paragraph => `<p>${paragraph}</p>`).join("\n") ?? "";
  const bullets = section.bullets?.length
    ? `<ul>${section.bullets.map(item => `<li>${item}</li>`).join("")}</ul>`
    : "";
  return `<section aria-labelledby="section-${index + 1}">
    <h2 id="section-${index + 1}">${escapeHtml(section.title)}</h2>
    ${paragraphs}
    ${bullets}
    ${section.table ? renderTable(section.table) : ""}
  </section>`;
}

function articleStructuredData(article, lang) {
  const locale = LOCALES[lang];
  const translation = article.translations[lang];
  const canonical = absolute(articlePath(article, lang));
  const image = absolute(article.image);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        url: canonical,
        mainEntityOfPage: canonical,
        headline: translation.title,
        description: translation.description,
        image: { "@type": "ImageObject", url: image, width: 1200, height: 630 },
        datePublished: article.datePublished,
        dateModified: article.dateModified,
        inLanguage: lang,
        author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
        publisher: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
        isPartOf: { "@type": "WebSite", name: "Papers Empire", url: SITE_ORIGIN },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Papers Empire", item: absolute(locale.homePath) },
          { "@type": "ListItem", position: 2, name: HUBS[lang].h1, item: absolute(locale.hubPath) },
          { "@type": "ListItem", position: 3, name: translation.title, item: canonical },
        ],
      },
    ],
  };
}

function renderArticle(article, lang) {
  const locale = LOCALES[lang];
  const translation = article.translations[lang];
  const canonical = absolute(articlePath(article, lang));
  const image = absolute(article.image);
  const editorialDateLabel = article.dateModified === article.datePublished
    ? locale.ui.published
    : locale.ui.updated;
  const related = ARTICLES.filter(candidate => candidate.id !== article.id).map(candidate => {
    const item = candidate.translations[lang];
    return `<li><a href="${articlePath(candidate, lang)}"><span>${escapeHtml(item.eyebrow)}</span>${escapeHtml(item.title)}</a></li>`;
  }).join("");
  const sources = article.sources.map(source => {
    const label = typeof source.label === "string" ? source.label : source.label[lang];
    if (!label) throw new Error(`${article.id} source ${source.url} is missing its ${lang} label`);
    return `<li><a href="${escapeAttr(source.url)}" rel="external">${escapeHtml(label)}</a></li>`;
  }).join("");

  return `${head({
    lang,
    title: translation.title,
    description: translation.description,
    canonical,
    image,
    imageAlt: translation.imageAlt,
    type: "article",
    article,
    structuredData: articleStructuredData(article, lang),
  })}
${shellStart({ lang, article })}
  <main id="main">
    <article class="guide-article" data-guide-id="${escapeAttr(article.id)}">
      <header class="article-hero">
        ${breadcrumb({ lang, article })}
        <p class="eyebrow">${escapeHtml(translation.eyebrow)}</p>
        <h1>${escapeHtml(translation.title)}</h1>
        <p class="article-hero__lead">${escapeHtml(translation.lead)}</p>
        <div class="article-byline">
          <span>${escapeHtml(locale.ui.by)} <a href="${AUTHOR.url}" rel="author">${AUTHOR.name}</a></span>
          <span aria-hidden="true">·</span>
          <span>${translation.readingMinutes} ${escapeHtml(locale.ui.minutes)}</span>
          <span aria-hidden="true">·</span>
          <span>${escapeHtml(editorialDateLabel)} <time datetime="${article.dateModified}">${formatDate(article.dateModified, lang)}</time></span>
        </div>
      </header>
      <figure class="article-visual">
        <img src="${versioned(article.image)}" width="1200" height="630" alt="${escapeAttr(translation.imageAlt)}" decoding="async" fetchpriority="high">
        <figcaption>${escapeHtml(locale.ui.imageCaption)}</figcaption>
      </figure>
      <aside class="disclosure" aria-label="${escapeAttr(locale.ui.disclosureLabel)}">
        <strong>${escapeHtml(locale.ui.disclosureLabel)}</strong>
        <p>${escapeHtml(locale.ui.disclosure)}</p>
      </aside>
      <div class="article-layout">
        <div class="article-prose">
          ${translation.sections.map(renderSection).join("\n")}
        </div>
        <aside class="article-rail">
          <div class="rail-card">
            <p class="eyebrow">${escapeHtml(locale.ui.sources)}</p>
            <ul>${sources}</ul>
            <p>${escapeHtml(locale.ui.sourceChecked)} <time datetime="${article.sourcesCheckedAt}">${formatDate(article.sourcesCheckedAt, lang)}</time>.</p>
          </div>
          <a class="play-cta" href="${locale.homePath}">${escapeHtml(locale.ui.play)}<span aria-hidden="true">→</span></a>
        </aside>
      </div>
      <nav class="related-guides" aria-label="${escapeAttr(locale.ui.related)}">
        <p class="eyebrow">${escapeHtml(locale.ui.related)}</p>
        <ul>${related}</ul>
      </nav>
    </article>
  </main>
${shellEnd(lang)}`;
}

function writeRoute(path, html) {
  const target = join(siteDir, path.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

function sitemapEntry({ path, article = null, lang, family = "hub" }) {
  const canonical = absolute(path);
  const alternate = article
    ? alternateMap(article)
    : Object.fromEntries(localeCodes.map(code => [
      code,
      absolute(family === "home" ? LOCALES[code].homePath : LOCALES[code].hubPath),
    ]));
  const alternates = localeCodes.map(code =>
    `    <xhtml:link rel="alternate" hreflang="${code}" href="${escapeXml(alternate[code])}"/>`).join("\n");
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(alternate.fr)}"/>`;
  const lastmod = article ? `\n    <lastmod>${article.dateModified}</lastmod>` : "";
  const image = article ? `\n    <image:image>\n      <image:loc>${escapeXml(absolute(article.image))}</image:loc>\n      <image:title>${escapeXml(article.translations[lang].title)}</image:title>\n    </image:image>` : "";
  return `  <url>\n    <loc>${escapeXml(canonical)}</loc>\n${alternates}\n${xDefault}${lastmod}${image}\n  </url>`;
}

function buildSitemap() {
  const entries = [];
  for (const [lang, locale] of localeEntries) {
    entries.push(sitemapEntry({ path: locale.homePath, lang, family: "home" }));
  }
  for (const [lang, locale] of localeEntries) {
    entries.push(sitemapEntry({ path: locale.hubPath, lang }));
  }
  for (const article of ARTICLES) {
    for (const lang of localeCodes) {
      entries.push(sitemapEntry({ path: articlePath(article, lang), article, lang }));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>
`;
}

assertCatalog();

for (const lang of localeCodes) {
  writeRoute(LOCALES[lang].hubPath, renderHub(lang));
  for (const article of ARTICLES) {
    writeRoute(articlePath(article, lang), renderArticle(article, lang));
  }
}

writeFileSync(join(siteDir, "sitemap.xml"), buildSitemap());
console.log(`Guides: ${localeCodes.length} hubs and ${ARTICLES.length * localeCodes.length} articles generated`);
console.log(`Sitemap: ${localeCodes.length * 2 + ARTICLES.length * localeCodes.length} canonical URLs generated`);
