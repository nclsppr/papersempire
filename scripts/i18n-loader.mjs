import { readFileSync } from "node:fs";

const cache = new Map();

export function loadDictionary(lang) {
  if (cache.has(lang)) return cache.get(lang);

  const source = readFileSync(new URL(`../assets/i18n/${lang}.js`, import.meta.url), "utf8");
  const window = { I18N: {} };
  new Function("window", source)(window);
  const dictionary = window.I18N[lang];
  if (!dictionary) throw new Error(`Missing i18n dictionary for ${lang}`);
  cache.set(lang, dictionary);
  return dictionary;
}
