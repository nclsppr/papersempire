#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";

const rootDir = new URL("../", import.meta.url);
const localeCodes = Object.freeze(["fr", "en", "de", "lb"]);
const localeFiles = Object.fromEntries(localeCodes.map(lang => [
  lang,
  new URL(`assets/i18n/${lang}.js`, rootDir),
]));

function read(path) {
  return readFileSync(path, "utf8");
}

function declaredKeys(source, lang) {
  const keys = [...source.matchAll(/^\s*"([^"]+)"\s*:/gm)].map(match => match[1]);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  assert.deepEqual([...new Set(duplicates)], [], `${lang} must not declare duplicate keys`);
  return keys;
}

function loadDictionary(lang) {
  const source = read(localeFiles[lang]);
  declaredKeys(source, lang);
  const window = { I18N: {} };
  new Function("window", source)(window);
  const dictionary = window.I18N[lang];
  assert.ok(dictionary && typeof dictionary === "object" && !Array.isArray(dictionary),
    `${lang} must expose window.I18N.${lang}`);
  return dictionary;
}

function placeholders(value) {
  const found = [];
  const pattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}|\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}/g;
  let match;
  while ((match = pattern.exec(value))) {
    found.push(`${match[1] ? "double" : "single"}:${match[1] || match[2]}`);
  }
  const remainder = value.replace(pattern, "");
  assert.doesNotMatch(remainder, /[{}]/, `malformed placeholder in ${JSON.stringify(value)}`);
  return found.sort();
}

const dictionaries = Object.fromEntries(localeCodes.map(lang => [lang, loadDictionary(lang)]));
const referenceKeys = Object.keys(dictionaries.fr).sort();

for (const lang of localeCodes) {
  const dictionary = dictionaries[lang];
  const keys = Object.keys(dictionary).sort();
  assert.deepEqual(keys, referenceKeys, `${lang} key set must exactly match fr`);
  for (const key of referenceKeys) {
    assert.equal(typeof dictionary[key], "string", `${lang}.${key} must be a string`);
    assert.ok(dictionary[key].trim(), `${lang}.${key} must not be empty`);
    assert.deepEqual(
      placeholders(dictionary[key]),
      placeholders(dictionaries.fr[key]),
      `${lang}.${key} placeholders must exactly match fr`
    );
  }
}

function walkFiles(relativeDirectory) {
  const directory = new URL(relativeDirectory, rootDir);
  const result = [];
  for (const entry of readdirSync(directory)) {
    const url = new URL(entry, directory.href.endsWith("/") ? directory : new URL("./", directory));
    if (statSync(url).isDirectory()) result.push(...walkFiles(`${relativeDirectory}${entry}/`));
    else result.push(url);
  }
  return result;
}

const runtimeFiles = [
  new URL("index.html", rootDir),
  new URL("dashboard/index.html", rootDir),
  ...walkFiles("assets/js/"),
].filter(url => /\.(?:html|js|mjs)$/.test(url.pathname));

const requiredKeys = new Set();
for (const file of runtimeFiles) {
  const source = read(file);
  const patterns = [
    /\bdata-i18n(?:-aria-label)?=["']([^"']+)["']/g,
    /\bt\(\s*["']([A-Za-z0-9_.:-]+)["']/g,
    /\b(?:nameKey|descKey|descriptionKey|titleKey|labelKey|resultKey)\s*:\s*["']([A-Za-z0-9_.:-]+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (!match[1].endsWith(".")) requiredKeys.add(match[1]);
    }
  }
}

const progressionSource = read(new URL("assets/js/progression.js", rootDir));
for (const match of progressionSource.matchAll(/\bobjective\(\s*["']([^"']+)["']/g)) {
  requiredKeys.add(`career.objective.${match[1]}`);
}
for (const match of progressionSource.matchAll(/\bbadgeId\s*:\s*["']([^"']+)["']/g)) {
  requiredKeys.add(`career.badge.${match[1]}`);
}
for (const match of progressionSource.matchAll(/\breason\s*:\s*["']([^"']+)["']/g)) {
  requiredKeys.add(`career.challenge.failure.${match[1]}`);
}
requiredKeys.add("career.challenge.failure.prestige");

const endgameSource = read(new URL("assets/js/endgame.js", rootDir));
for (const match of endgameSource.matchAll(/\bclause\(\s*["']([^"']+)["']/g)) {
  requiredKeys.add(`contracts.clause.${match[1]}.name`);
  requiredKeys.add(`contracts.clause.${match[1]}.desc`);
}

const appSource = read(new URL("assets/js/app.js", rootDir));
const buildingsBlock = appSource.match(/const BUILDING_DEFS\s*=\s*\[([\s\S]*?)\n\s*\];/);
assert.ok(buildingsBlock, "app.js must expose BUILDING_DEFS");
const buildingIds = [...buildingsBlock[1].matchAll(/\bid\s*:\s*["']([^"']+)["']/g)]
  .map(match => match[1]);
assert.equal(new Set(buildingIds).size, buildingIds.length, "BUILDING_DEFS IDs must be unique");
for (const id of buildingIds) {
  requiredKeys.add(`building.${id}.milestone10`);
  requiredKeys.add(`building.${id}.milestone25`);
  requiredKeys.add(`building.${id}.officeNote`);
}

const missingRuntimeKeys = [...requiredKeys]
  .filter(key => !(key in dictionaries.fr))
  .sort();
assert.deepEqual(missingRuntimeKeys, [], "all runtime translation keys must exist");

console.log(
  `i18n validation passed: ${referenceKeys.length} keys × ${localeCodes.length} locales; ` +
  `${requiredKeys.size} runtime keys resolved.`
);
