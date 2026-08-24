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
const env = {
  ASSETS: {
    async fetch(request) {
      assetRequests += 1;
      return new Response(`asset:${new URL(request.url).pathname}`, {
        headers: { "Content-Type": "text/plain" }
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

const served = await worker.fetch(
  new Request("https://papersempire.com/dashboard/"),
  env
);
assert.equal(served.status, 200);
assert.equal(await served.text(), "asset:/dashboard/");
assert.equal(assetRequests, 1);

for (const [name, expected] of Object.entries({
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
})) {
  assert.equal(served.headers.get(name), expected, `${name} must be set on static assets`);
  assert.equal(redirected.headers.get(name), expected, `${name} must be set on redirects`);
}

console.log("Cloudflare Worker contracts: ok");
