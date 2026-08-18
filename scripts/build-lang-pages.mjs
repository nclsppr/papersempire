#!/usr/bin/env node
/**
 * Génère les pages statiques par langue (/en/, /de/, /lb/) à partir
 * d'index.html, avec head entièrement localisé (title, description, og:*,
 * canonical auto-référent) et textes pré-remplis traduits via les
 * dictionnaires du jeu. Optionnellement, estampille les URLs d'assets
 * (?v=<sha>) de toutes les pages produites pour le cache-busting.
 *
 * Usage : node scripts/build-lang-pages.mjs <dossier-site> [sha]
 *   <dossier-site> : racine du site déployé (contient index.html)
 *   [sha]          : version pour ?v= (ex. ${GITHUB_SHA::8}) — optionnel
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [siteDir, stamp] = process.argv.slice(2);
if (!siteDir) {
  console.error("Usage: node scripts/build-lang-pages.mjs <dossier-site> [sha]");
  process.exit(1);
}

const CANON = "https://papersempire.com";
const LANGS = ["en", "de", "lb"];

const META = {
  en: {
    locale: "en_US",
    title: "Papers Empire, a free idle game: print shop to Factory 4.0",
    description:
      "Grow a tiny print shop into a 4.0 omnichannel factory: buildings, premium contracts, strategic reorgs and paper jams. Free idle game in your browser.",
    ogTitle: "Papers Empire: print shop to Factory 4.0",
    ogDescription: "Click, print, automate: build your document empire in this free browser idle game.",
    imageAlt: "3D diorama of the Papers Empire campus at dusk, with the game title",
  },
  de: {
    locale: "de_DE",
    title: "Papers Empire: Idle Game von der Druckerei zur Fabrik 4.0",
    description:
      "Verwandle eine kleine Druckerei in eine 4.0-Omnichannel-Fabrik: Gebäude, Premium-Verträge, strategische Reorgs und Papierstaus. Gratis Idle Game im Browser.",
    ogTitle: "Papers Empire: von der Druckerei zur Fabrik 4.0",
    ogDescription: "Klicken, drucken, automatisieren: Bau dein Dokumenten-Imperium im kostenlosen Idle Game.",
    imageAlt: "3D-Diorama des Papers-Empire-Campus in der Abenddämmerung mit dem Spieltitel",
  },
  lb: {
    locale: "lb_LU",
    title: "Papers Empire: Idle Game vun der Dréckerei bis d'Fabrick 4.0",
    description:
      "Maach deng kleng Dréckerei zu enger 4.0 Omnichannel-Fabrick: Gebaier, Premium-Kontrakter, strategesch Reorgen a Pabeierstau. Gratis Idle Game am Browser.",
    ogTitle: "Papers Empire: vun der Dréckerei bis d'Fabrick 4.0",
    ogDescription: "Klicken, drécken, automatiséieren: Bau däin Dokumenten-Empire am gratis Idle Game.",
    imageAlt: "3D-Diorama vum Papers-Empire-Campus an der Dämmerung mam Spilltitel",
  },
};

/** Clés data-i18n dont le HTML statique embarque le texte (SEO sans JS). */
const PREFILLED_KEYS = [
  "actions.skipToContent",
  "actions.openSettings",
  "actions.close",
  "actions.previous",
  "actions.next",
  "actions.skip",
  "sections.buildingsTitle",
  "sections.buildingsHint",
  "sections.upgradesTitle",
  "sections.prestigeTitle",
  "sections.progressTitle",
  "sections.godModeTitle",
  "settings.title",
  "prestige.buttonLocked",
  "actions.printDocument",
  "actions.playNow",
  "actions.enterFactory",
  "actions.printNow",
  "actions.exploreFactory",
  "app.tagline",
  "nav.factory",
  "nav.gameOverview",
  "nav.production",
  "nav.buildings",
  "nav.upgrades",
  "nav.dashboard",
  "hero.kicker",
  "hero.line1",
  "hero.line2",
  "hero.line3",
  "hero.lede",
  "hero.benefitIdle",
  "hero.benefitGrow",
  "hero.benefitFree",
  "hud.title",
  "hud.documents",
  "hud.production",
  "hud.prestige",
  "hud.culture",
  "scene.liveCampus",
  "roadmap.eyebrow",
  "roadmap.title",
  "roadmap.subtitle",
  "roadmap.step.print.title",
  "roadmap.step.print.body",
  "roadmap.step.automate.title",
  "roadmap.step.automate.body",
  "roadmap.step.research.title",
  "roadmap.step.research.body",
  "roadmap.step.produce.title",
  "roadmap.step.produce.body",
  "roadmap.step.expand.title",
  "roadmap.step.expand.body",
  "roadmap.step.prestige.title",
  "roadmap.step.prestige.body",
  "roadmap.catalogue.eyebrow",
  "roadmap.catalogue.title",
  "roadmap.catalogue.cta",
  "roadmap.proof.title",
  "roadmap.proof.free",
  "roadmap.proof.noAccount",
  "roadmap.proof.localSave",
  "roadmap.proof.languages",
  "roadmap.proof.source",
  "operations.eyebrow",
  "operations.title",
  "operations.subtitle",
  "operations.availableDocs",
  "operations.cadence",
  "operations.activeTypes",
  "operations.navProduction",
  "operations.navMachines",
  "operations.navStrategy",
  "operations.navArchives",
  "operations.productionKicker",
  "operations.productionTitle",
  "operations.pressCaption",
  "operations.barometers",
  "operations.machinesKicker",
  "operations.nextMachine",
  "operations.strategyKicker",
  "operations.dispatchKicker",
  "operations.dispatchTitle",
  "operations.archivesKicker",
  "operations.archivesHint",
  "operations.achievementsUnlocked",
  "offline.title",
  "offline.subtitle",
  "offline.duration",
  "offline.produced",
  "offline.hint",
  "offline.resume",
  "stats.docBank",
  "stats.docTotal",
  "stats.ccTotal",
  "stats.docPs",
  "gauges.quality",
  "gauges.footprint",
  "gauges.image",
  "sections.contractsTitle",
  "sections.logTitle",
  "actions.rerollContracts",
  "building.reproOperator.name",
  "building.reproWorkshop.name",
  "building.digitalPress.name",
  "building.offsetPress.name",
  "building.finishingWorkshop.name",
  "building.logistics.name",
  "footer.madeBy",
  "footer.docs",
  "footer.source",
];

/** Charge un dictionnaire i18n du jeu dans Node (fichiers window.I18N.xx). */
function loadDict(lang) {
  const src = readFileSync(join(process.cwd(), "assets/i18n", `${lang}.js`), "utf8");
  const window = { I18N: {} };
  new Function("window", src)(window);
  return window.I18N[lang];
}

function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

const rootHtml = readFileSync(join(siteDir, "index.html"), "utf8");

function localize(html, lang) {
  const m = META[lang];
  const dict = loadDict(lang);

  html = html.replace('<html lang="fr">', `<html lang="${lang}">`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(m.title)}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[^"]*(">)/,
    `$1${escapeAttr(m.description)}$2`
  );
  html = html.replace(
    '<link rel="canonical" href="https://papersempire.com/">',
    `<link rel="canonical" href="${CANON}/${lang}/">`
  );
  html = html.replace(
    '<meta property="og:url" content="https://papersempire.com/">',
    `<meta property="og:url" content="${CANON}/${lang}/">`
  );
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(">)/,
    `$1${escapeAttr(m.ogTitle)}$2`
  );
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(">)/,
    `$1${escapeAttr(m.ogDescription)}$2`
  );
  html = html.replace(
    /(<meta property="og:image:alt" content=")[^"]*(">)/,
    `$1${escapeAttr(m.imageAlt)}$2`
  );
  html = html.replace(
    /(<meta name="twitter:image:alt" content=")[^"]*(">)/,
    `$1${escapeAttr(m.imageAlt)}$2`
  );
  html = html.replace(
    /("description": )"[^"]*"(,\n\s*"inLanguage")/,
    `$1${JSON.stringify(m.description)}$2`
  );
  // og:locale : la langue de la page devient principale, le fr passe en alternate
  html = html.replace('<meta property="og:locale" content="fr_FR">',
    `<meta property="og:locale" content="${m.locale}">`);
  html = html.replace(`<meta property="og:locale:alternate" content="${m.locale}">`,
    '<meta property="og:locale:alternate" content="fr_FR">');

  // Textes pré-remplis du body traduits (les crawlers sans JS lisent la bonne langue)
  for (const key of PREFILLED_KEYS) {
    const value = dict[key];
    if (!value) continue;
    const re = new RegExp(`(data-i18n="${key.replaceAll(".", "\\.")}"[^>]*>)[^<]*(<)`, "g");
    html = html.replace(re, `$1${escapeHtml(value)}$2`);
  }
  html = html.replace(
    /aria-label="[^"]*" data-i18n-aria-label="([^"]+)"/g,
    (match, key) => dict[key]
      ? `aria-label="${escapeAttr(dict[key])}" data-i18n-aria-label="${key}"`
      : match
  );
  return html;
}

function stampAssets(html) {
  if (!stamp) return html;
  // Toutes les ressources locales portent la révision, pas seulement CSS/JS.
  // Safari peut sinon combiner un HTML neuf avec une image, une police ou un
  // srcset conservé pendant la durée du cache partagé.
  return html.replace(
    /(\/(?:assets\/[^"'()<>,\s?]+|favicon\.svg|site\.webmanifest))/g,
    `$1?v=${stamp}`
  );
}

function stampCssAssetUrls(css) {
  if (!stamp) return css;
  return css.replace(
    /url\((["']?)((?:\.\.\/|\/assets\/)[^)"'?]+)\1\)/g,
    (match, quote, assetPath) => `url(${quote}${assetPath}?v=${stamp}${quote})`
  );
}

function stampJavaScriptAssetUrls(js) {
  if (!stamp) return js;
  // Les imports ES relatifs (dont three.core.min.js) et les URLs statiques
  // construites depuis JavaScript doivent suivre la même révision que la page.
  // Les chemins assemblés dynamiquement passent, eux, par PEAssetUrl au runtime.
  return js.replace(
    /(["'`])((?:\/assets\/|assets\/|\.{1,2}\/)[^"'`\r\n?]+?\.(?:js|css|png|webp|svg|jpe?g|gif|avif|woff2?))\1/g,
    (match, quote, assetPath) => `${quote}${assetPath}?v=${stamp}${quote}`
  );
}

function visitJavaScriptFiles(directory, callback) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visitJavaScriptFiles(path, callback);
    else if (entry.isFile() && entry.name.endsWith(".js")) callback(path);
  }
}

function stampManifestAssets(manifest) {
  if (!stamp) return manifest;
  return manifest.replace(/(\/assets\/[^"?]+)(")/g, `$1?v=${stamp}$2`);
}

for (const lang of LANGS) {
  const dir = join(siteDir, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), stampAssets(localize(rootHtml, lang)));
  console.log(`${lang}/index.html ok`);
}

if (stamp) {
  writeFileSync(join(siteDir, "index.html"), stampAssets(rootHtml));
  console.log(`index.html estampillé ?v=${stamp}`);

  const dashboardPath = join(siteDir, "dashboard", "index.html");
  if (existsSync(dashboardPath)) {
    const dashboardHtml = readFileSync(dashboardPath, "utf8");
    writeFileSync(dashboardPath, stampAssets(dashboardHtml));
    console.log(`dashboard/index.html estampillé ?v=${stamp}`);
  }

  for (const cssName of ["style.css", "experience-v4.css"]) {
    const cssPath = join(siteDir, "assets", "css", cssName);
    if (!existsSync(cssPath)) continue;
    writeFileSync(cssPath, stampCssAssetUrls(readFileSync(cssPath, "utf8")));
    console.log(`${cssName} : assets internes estampillés ?v=${stamp}`);
  }

  visitJavaScriptFiles(join(siteDir, "assets"), jsPath => {
    writeFileSync(jsPath, stampJavaScriptAssetUrls(readFileSync(jsPath, "utf8")));
  });
  console.log(`JavaScript : imports et assets statiques estampillés ?v=${stamp}`);

  const manifestPath = join(siteDir, "site.webmanifest");
  if (existsSync(manifestPath)) {
    writeFileSync(manifestPath, stampManifestAssets(readFileSync(manifestPath, "utf8")));
    console.log(`site.webmanifest : icônes estampillées ?v=${stamp}`);
  }

  const notFoundPath = join(siteDir, "404.html");
  if (existsSync(notFoundPath)) {
    writeFileSync(notFoundPath, stampAssets(readFileSync(notFoundPath, "utf8")));
    console.log(`404.html estampillé ?v=${stamp}`);
  }
}
