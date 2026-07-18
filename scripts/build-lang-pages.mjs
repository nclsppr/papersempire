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
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  },
  de: {
    locale: "de_DE",
    title: "Papers Empire: Idle Game von der Druckerei zur Fabrik 4.0",
    description:
      "Verwandle eine kleine Druckerei in eine 4.0-Omnichannel-Fabrik: Gebäude, Premium-Verträge, strategische Reorgs und Papierstaus. Gratis Idle Game im Browser.",
    ogTitle: "Papers Empire: von der Druckerei zur Fabrik 4.0",
    ogDescription: "Klicken, drucken, automatisieren: Bau dein Dokumenten-Imperium im kostenlosen Idle Game.",
  },
  lb: {
    locale: "lb_LU",
    title: "Papers Empire: Idle Game vun der Dréckerei bis d'Fabrick 4.0",
    description:
      "Maach deng kleng Dréckerei zu enger 4.0 Omnichannel-Fabrick: Gebaier, Premium-Kontrakter, strategesch Reorgen a Pabeierstau. Gratis Idle Game am Browser.",
    ogTitle: "Papers Empire: vun der Dréckerei bis d'Fabrick 4.0",
    ogDescription: "Klicken, drécken, automatiséieren: Bau däin Dokumenten-Empire am gratis Idle Game.",
  },
};

/** Clés data-i18n dont le HTML statique embarque le texte (SEO sans JS). */
const PREFILLED_KEYS = [
  "actions.skipToContent",
  "sections.buildingsTitle",
  "sections.buildingsHint",
  "sections.upgradesTitle",
  "sections.prestigeTitle",
  "sections.progressTitle",
  "actions.printDocument",
  "app.tagline",
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
  // og:locale : la langue de la page devient principale, le fr passe en alternate
  html = html.replace('<meta property="og:locale" content="fr_FR">',
    `<meta property="og:locale" content="${m.locale}">`);
  html = html.replace(`<meta property="og:locale:alternate" content="${m.locale}">`,
    '<meta property="og:locale:alternate" content="fr_FR">');

  // Textes pré-remplis du body traduits (les crawlers sans JS lisent la bonne langue)
  for (const key of PREFILLED_KEYS) {
    const value = dict[key];
    if (!value) continue;
    const re = new RegExp(`(data-i18n="${key.replace(".", "\\.")}"[^>]*>)[^<]*(<)`);
    html = html.replace(re, `$1${escapeHtml(value)}$2`);
  }
  return html;
}

function stampAssets(html) {
  if (!stamp) return html;
  return html
    .replace(/(href="\/assets\/[^"?]+\.css)"/g, `$1?v=${stamp}"`)
    .replace(/(src="\/assets\/[^"?]+\.js)"/g, `$1?v=${stamp}"`);
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
}
