/** Optional web-only product events. Never copy request metadata into a point. */
export const ENGAGEMENT_EVENTS = Object.freeze(["start", "first_automation", "first_upgrade", "first_contract", "first_plan", "return_j1", "return_j7"]);
export const ENGAGEMENT_SOURCES = Object.freeze(["direct", "guide", "internal", "search", "external", "installed"]);
const LANGUAGES = ["fr", "en", "de", "lb"];
const FIELDS = ["version", "consent", "event", "lang", "source", "cohort", "activeSeconds", "elapsedSeconds"];
const MAX_BODY_BYTES = 1024;
const MAX_SECONDS = 366 * 86400;

function response(status) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
function validDay(value, now) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value && timestamp <= now + 86400000 && timestamp >= now - MAX_SECONDS * 1000;
}
export function validateEngagement(value, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).length !== FIELDS.length || Object.keys(value).some(key => !FIELDS.includes(key))) return false;
  if (value.version !== 1 || value.consent !== true || !ENGAGEMENT_EVENTS.includes(value.event) || !LANGUAGES.includes(value.lang) || !ENGAGEMENT_SOURCES.includes(value.source) || !validDay(value.cohort, now)) return false;
  for (const key of ["activeSeconds", "elapsedSeconds"]) {
    if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > MAX_SECONDS) return false;
  }
  return value.activeSeconds <= value.elapsedSeconds;
}

async function readBoundedBody(request) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) return { status: 413 };
  if (!request.body) return { status: 400 };
  const reader = request.body.getReader();
  const parts = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return { status: 413 };
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch { return { status: 400 }; }
  finally { reader.releaseLock(); }
}

export async function handleEngagement(request, env) {
  if (request.method !== "POST") return response(405);
  const url = new URL(request.url);
  // Production only. Local/native origins and previews cannot contaminate the
  // dataset. Same-origin is an abuse boundary, not proof of human consent.
  if (url.origin !== "https://papersempire.com" || url.search || request.headers.get("Origin") !== url.origin) return response(403);
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return response(403);
  if ((request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase() !== "application/json") return response(415);
  const body = await readBoundedBody(request);
  if (body.status) return response(body.status);
  if (!validateEngagement(body.value)) return response(400);
  if (!env.ENGAGEMENT || typeof env.ENGAGEMENT.writeDataPoint !== "function") return response(503);
  const event = body.value;
  try {
    // Binding API is synchronous; Cloudflare manages delivery after return.
    // Do not add IP, user agent, Referer, request URLs or a per-player index.
    env.ENGAGEMENT.writeDataPoint({
      blobs: [event.event, event.lang, event.source, event.cohort, "1"],
      doubles: [1, event.activeSeconds, event.elapsedSeconds],
      indexes: [event.cohort]
    });
    return response(204);
  } catch { return response(503); }
}
