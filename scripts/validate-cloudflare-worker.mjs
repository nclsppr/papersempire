#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../worker/index.js";

const config = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
);

assert.equal(config.name, "papersempire");
assert.equal(config.assets.directory, "./site");
assert.equal(config.assets.binding, "ASSETS");
assert.equal(config.assets.not_found_handling, "404-page");
assert.equal(config.assets.html_handling, "auto-trailing-slash");
assert.equal(config.assets.run_worker_first, true);
assert.deepEqual(config.routes, [
  { pattern: "papersempire.com", custom_domain: true },
  { pattern: "www.papersempire.com", custom_domain: true }
]);

let assetRequests = 0;
const REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const env = {
  ASSETS: {
    async fetch(request) {
      assetRequests += 1;
      const url = new URL(request.url);
      const status = url.pathname === "/assets/js/missing.js" ? 404 : 200;
      return new Response(`asset:${url.pathname}`, {
        status,
        headers: {
          "Cache-Control": REVALIDATE_CACHE_CONTROL,
          "Content-Type": "text/plain"
        }
      });
    }
  }
};

const redirected = await worker.fetch(
  new Request("https://www.papersempire.com/docs/?lang=fr"),
  env
);
assert.equal(redirected.status, 308);
assert.equal(redirected.headers.get("Location"), "https://papersempire.com/docs/?lang=fr");
assert.equal(assetRequests, 0, "www requests must redirect before reading an asset");

const redirectedToHttps = await worker.fetch(
  new Request("http://papersempire.com/en/?welcome=1"),
  env
);
assert.equal(redirectedToHttps.status, 308);
assert.equal(
  redirectedToHttps.headers.get("Location"),
  "https://papersempire.com/en/"
);
assert.equal(assetRequests, 0, "HTTP requests must redirect before reading an asset");

const combinedRedirect = await worker.fetch(
  new Request(
    "http://www.papersempire.com/de?lang=en&welcome=1&utm_campaign=launch"
  ),
  env
);
assert.equal(combinedRedirect.status, 308);
assert.equal(
  combinedRedirect.headers.get("Location"),
  "https://papersempire.com/en/?utm_campaign=launch"
);
assert.doesNotMatch(combinedRedirect.headers.get("Location"), /#/,
  "the redirect must let the browser inherit any fragment that was never sent to the Worker");
assert.equal(assetRequests, 0,
  "host, protocol, language and welcome normalization must happen before assets");

for (const [sourcePath, language, expectedPath] of [
  ["/", "fr", "/"],
  ["/en/", "de", "/de/"],
  ["/de/", "lb", "/lb/"],
  ["/lb/", "en", "/en/"]
]) {
  const localized = await worker.fetch(
    new Request(
      `https://papersempire.com${sourcePath}?ref=legacy&lang=${language}&mode=quiet`
    ),
    env
  );
  assert.equal(localized.status, 308);
  assert.equal(
    localized.headers.get("Location"),
    `https://papersempire.com${expectedPath}?ref=legacy&mode=quiet`
  );
}
assert.equal(assetRequests, 0,
  "localized home redirects must preserve unrelated query parameters");

for (const [sourcePath, expectedPath] of [
  ["/index.html", "/"],
  ["/fr", "/"],
  ["/fr/", "/"],
  ["/fr/index.html", "/"],
  ["/en", "/en/"],
  ["/en/index.html", "/en/"],
  ["/de", "/de/"],
  ["/de/index.html", "/de/"],
  ["/lb", "/lb/"],
  ["/lb/index.html", "/lb/"]
]) {
  const alias = await worker.fetch(
    new Request(`https://papersempire.com${sourcePath}`),
    env
  );
  assert.equal(alias.status, 308);
  assert.equal(alias.headers.get("Location"), `https://papersempire.com${expectedPath}`);
}
assert.equal(assetRequests, 0,
  "home aliases must normalize before Cloudflare Static Assets can add a redirect");

const cleanedLegacyParams = await worker.fetch(
  new Request("https://papersempire.com/en/?lang=unknown&welcome=0&ref=legacy"),
  env
);
assert.equal(cleanedLegacyParams.status, 308);
assert.equal(
  cleanedLegacyParams.headers.get("Location"),
  "https://papersempire.com/en/?ref=legacy"
);
assert.equal(assetRequests, 0,
  "unsupported legacy values must not create crawlable home variants");

const served = await worker.fetch(
  new Request("https://papersempire.com/dashboard/"),
  env
);
assert.equal(served.status, 200);
assert.equal(await served.text(), "asset:/dashboard/");
assert.equal(assetRequests, 1);
assert.equal(served.headers.get("X-Robots-Tag"), "noindex, follow");

const docs = await worker.fetch(
  new Request("https://papersempire.com/docs/architecture/"),
  env
);
assert.equal(docs.headers.get("X-Robots-Tag"), "noindex, follow");

const preview = await worker.fetch(
  new Request("https://papersempire.example-account.workers.dev/en/"),
  env
);
assert.equal(preview.status, 200);
assert.equal(preview.headers.get("X-Robots-Tag"), "noindex, nofollow");

const previewLegacyVariant = await worker.fetch(
  new Request("https://papersempire.example-account.workers.dev/en?lang=de&welcome=1"),
  env
);
assert.equal(previewLegacyVariant.status, 200,
  "preview hosts must stay on their own origin during legacy-query QA");
assert.equal(await previewLegacyVariant.text(), "asset:/en");
assert.equal(previewLegacyVariant.headers.get("X-Robots-Tag"), "noindex, nofollow");

const canonical = await worker.fetch(
  new Request("https://papersempire.com/en/"),
  env
);
assert.equal(canonical.headers.get("X-Robots-Tag"), null);

const guide = await worker.fetch(
  new Request("https://papersempire.com/guides/jeu-idle-clicker-incremental-differences/"),
  env
);
assert.equal(guide.status, 200);
assert.equal(guide.headers.get("X-Robots-Tag"), null,
  "canonical workshop guides must remain indexable");

const guidePreview = await worker.fetch(
  new Request("https://papersempire.example-account.workers.dev/en/guides/idle-game-clicker-incremental-differences/"),
  env
);
assert.equal(guidePreview.status, 200);
assert.equal(guidePreview.headers.get("X-Robots-Tag"), "noindex, nofollow",
  "preview guide routes must stay out of search indexes");

for (const path of [
  "/assets/js/app.js?v=a4f991ce",
  "/assets/images/hero.webp?v=0123456789abcdef0123456789abcdef01234567",
  "/assets/css/style.a4f991ce.css"
]) {
  const immutable = await worker.fetch(
    new Request(`https://papersempire.com${path}`),
    env
  );
  assert.equal(immutable.status, 200);
  assert.equal(
    immutable.headers.get("Cache-Control"),
    "public, max-age=31536000, immutable",
    `${path} must receive immutable caching`
  );
}

for (const path of [
  "/assets/js/app.js",
  "/assets/js/app.js?v=a4f991c",
  "/assets/js/app.js?v=0123456789abcdef0123456789abcdef012345678",
  "/assets/js/app.js?v=nothex00",
  "/assets/js/app.js?v=a4f991ce&v=deadbeef",
  "/style.a4f991ce.css",
  "/en/?v=a4f991ce",
  "/sitemap.xml?v=a4f991ce",
  "/robots.txt?v=a4f991ce"
]) {
  const revalidated = await worker.fetch(
    new Request(`https://papersempire.com${path}`),
    env
  );
  assert.equal(
    revalidated.headers.get("Cache-Control"),
    REVALIDATE_CACHE_CONTROL,
    `${path} must keep revalidation caching`
  );
}

const missingVersionedAsset = await worker.fetch(
  new Request("https://papersempire.com/assets/js/missing.js?v=a4f991ce"),
  env
);
assert.equal(missingVersionedAsset.status, 404);
assert.equal(
  missingVersionedAsset.headers.get("Cache-Control"),
  REVALIDATE_CACHE_CONTROL,
  "versioned error responses must not receive immutable caching"
);

for (const [name, expected] of Object.entries({
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
})) {
  assert.equal(served.headers.get(name), expected, `${name} must be set on static assets`);
  assert.equal(redirected.headers.get(name), expected, `${name} must be set on redirects`);
  assert.equal(redirectedToHttps.headers.get(name), expected,
    `${name} must be set on HTTP redirects`);
  assert.equal(combinedRedirect.headers.get(name), expected,
    `${name} must be set on combined redirects`);
}

console.log("Cloudflare Worker contracts: ok");
