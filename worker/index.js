const CANONICAL_HOSTNAME = "papersempire.com";
const WWW_HOSTNAME = `www.${CANONICAL_HOSTNAME}`;

const SECURITY_HEADERS = Object.freeze({
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
});

function canonicalRedirect(requestUrl) {
  const canonicalUrl = new URL(requestUrl);
  canonicalUrl.hostname = CANONICAL_HOSTNAME;
  return Response.redirect(canonicalUrl, 308);
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === WWW_HOSTNAME) {
      return withSecurityHeaders(canonicalRedirect(url));
    }

    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response);
  }
};
