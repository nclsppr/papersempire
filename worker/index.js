import { handleEngagement } from "./engagement.mjs";

const CANONICAL_HOSTNAME = "papersempire.com";
const WWW_HOSTNAME = `www.${CANONICAL_HOSTNAME}`;
const HOME_PATH_BY_LANGUAGE = Object.freeze({
  fr: "/",
  en: "/en/",
  de: "/de/",
  lb: "/lb/"
});
const HOME_CANONICAL_PATH_BY_ALIAS = Object.freeze({
  "/": "/",
  "/index.html": "/",
  "/fr": "/",
  "/fr/": "/",
  "/fr/index.html": "/",
  "/en": "/en/",
  "/en/": "/en/",
  "/en/index.html": "/en/",
  "/de": "/de/",
  "/de/": "/de/",
  "/de/index.html": "/de/",
  "/lb": "/lb/",
  "/lb/": "/lb/",
  "/lb/index.html": "/lb/"
});
const ASSET_VERSION_PATTERN = /^[a-f0-9]{8,40}$/i;
const HASHED_CSS_PATH_PATTERN = /\/[^/]+\.[a-f0-9]{8,40}\.css$/i;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const SECURITY_HEADERS = Object.freeze({
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
});

function canonicalTarget(request) {
  const target = new URL(request.url);
  const isProductionHost = target.hostname === CANONICAL_HOSTNAME ||
    target.hostname === WWW_HOSTNAME;
  if (!isProductionHost) return null;

  let shouldRedirect = target.hostname === WWW_HOSTNAME ||
    (target.hostname === CANONICAL_HOSTNAME && target.protocol !== "https:");

  target.protocol = "https:";
  target.hostname = CANONICAL_HOSTNAME;
  target.port = "";

  const canonicalHomePath = HOME_CANONICAL_PATH_BY_ALIAS[target.pathname];
  if (canonicalHomePath) {
    if (target.pathname !== canonicalHomePath) {
      target.pathname = canonicalHomePath;
      shouldRedirect = true;
    }

    const language = target.searchParams.get("lang");
    if (Object.prototype.hasOwnProperty.call(HOME_PATH_BY_LANGUAGE, language)) {
      target.pathname = HOME_PATH_BY_LANGUAGE[language];
    }
    if (target.searchParams.has("lang")) {
      target.searchParams.delete("lang");
      shouldRedirect = true;
    }

    const welcomeValues = target.searchParams.getAll("welcome");
    if (welcomeValues.length > 0) {
      target.searchParams.delete("welcome");
      // Never add a fragment here: browsers inherit the original fragment
      // when a redirect Location omits one, while fragments never reach the
      // Worker. Current internal links already use canonical fragments.
      shouldRedirect = true;
    }
  }

  return shouldRedirect ? target : null;
}

function robotsDirective(url) {
  if (url.hostname !== CANONICAL_HOSTNAME) return "noindex, nofollow";
  if (["/dashboard", "/docs"].some(prefix =>
    url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    return "noindex, follow";
  }
  return null;
}

function isImmutableAsset(url, response) {
  if (response.status !== 200 || !url.pathname.startsWith("/assets/")) {
    return false;
  }

  const versions = url.searchParams.getAll("v");
  const hasVersionQuery = versions.length === 1 &&
    ASSET_VERSION_PATTERN.test(versions[0]);
  return hasVersionQuery || HASHED_CSS_PATH_PATTERN.test(url.pathname);
}

function withSecurityHeaders(response, url, robots = null) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (isImmutableAsset(url, response)) {
    headers.set("Cache-Control", IMMUTABLE_CACHE_CONTROL);
  }
  if (robots) headers.set("X-Robots-Tag", robots);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/engagement") {
      return withSecurityHeaders(await handleEngagement(request, env), url, "noindex, nofollow");
    }
    const redirectTarget = canonicalTarget(request);
    if (redirectTarget) {
      return withSecurityHeaders(Response.redirect(redirectTarget, 308), url);
    }

    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response, url, robotsDirective(url));
  }
};
