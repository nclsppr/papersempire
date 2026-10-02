/** A user-created PNG from facts in the current local game. No public posting. */
(function () {
  "use strict";
  const KNOWN_BUILDINGS = new Set(["reproOperator", "reproWorkshop", "digitalPress", "offsetPress", "finishingWorkshop", "insertingLine", "logistics", "clientPortal", "comBridge", "prepressStudio", "factory40", "pampyAI"]);
  const KNOWN_CAMPAIGNS = new Set(["onboarding842", "annualReportSeason", "confidentialMerger"]);
  let options = {};
  let dialog;
  let returnFocus;
  let objectUrl;
  let generation = 0;

  function configure(next = {}) { options = { ...options, ...next }; }
  function language() {
    const value = typeof options.locale === "function" ? options.locale() : options.locale;
    const lang = value || document.documentElement.lang || "fr";
    return ["fr", "en", "de", "lb"].includes(lang) ? lang : "fr";
  }
  function t(key, params = {}) {
    return typeof options.translate === "function" ? options.translate(key, params) : key;
  }
  function number(value) {
    return new Intl.NumberFormat(language(), { notation: value >= 1000000 ? "compact" : "standard", maximumFractionDigits: value >= 1000000 ? 1 : 0 }).format(value);
  }
  function describeSnapshot(snapshot) {
    if (!snapshot || snapshot.started === false || !snapshot.resources) return null;
    const resources = snapshot.resources;
    if (!Number.isFinite(resources.docTotal) || resources.docTotal < 0 || !Number.isFinite(snapshot.docPerSecond) || snapshot.docPerSecond < 0) return null;
    const buildings = (Array.isArray(snapshot.buildings) ? snapshot.buildings : []).filter(item => item && KNOWN_BUILDINGS.has(item.id) && Number.isSafeInteger(item.quantity) && item.quantity > 0);
    const ranks = snapshot.career && snapshot.career.completedRanks || {};
    const stamps = ["cadence", "quality", "clientRelations"].reduce((sum, id) => sum + (Number.isInteger(ranks[id]) ? Math.max(0, Math.min(3, ranks[id])) : 0), 0);
    const completed = snapshot.career && snapshot.career.campaigns && snapshot.career.campaigns.completedIds;
    const badges = new Set((Array.isArray(completed) ? completed : []).filter(id => KNOWN_CAMPAIGNS.has(id))).size;
    if (resources.docTotal <= 0 && buildings.length === 0 && stamps === 0) return null;
    return {
      docTotal: resources.docTotal, docPerSecond: snapshot.docPerSecond, stamps, badges,
      ownedTypes: new Set(buildings.map(item => item.id)).size,
      buildings: buildings.slice().sort((a, b) => b.quantity - a.quantity).slice(0, 3)
    };
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function asset(path) { return window.PEAssetUrl ? window.PEAssetUrl(path) : path; }
  function loadImage(path) {
    return new Promise(resolve => {
      const image = new Image();
      const timer = setTimeout(() => { image.onload = image.onerror = null; resolve(null); }, 5000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.src = asset(path);
    });
  }
  function fitText(ctx, text, x, y, width, size, color, weight = 600) {
    let fontSize = size;
    ctx.fillStyle = color;
    do { ctx.font = weight + " " + fontSize + "px Arial, sans-serif"; fontSize -= 1; }
    while (fontSize > 16 && ctx.measureText(text).width > width);
    ctx.fillText(text, x, y, width);
  }
  function containImage(ctx, image, x, y, width, height) {
    if (!image) return;
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
  }
  async function renderCard(facts) {
    const paths = ["/assets/images/hero-horizon-wide.webp", "/assets/brand/papers-empire-logo-v2-cutout.webp", ...facts.buildings.map(item => "/assets/images/building-" + item.id + "-v4.webp")];
    const [horizon, logo, ...buildings] = await Promise.all(paths.map(loadImage));
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#183332";
    ctx.fillRect(0, 0, 1200, 630);
    if (horizon) {
      const scale = Math.max(570 / horizon.naturalWidth, 630 / horizon.naturalHeight);
      ctx.save();
      ctx.beginPath(); ctx.rect(630, 0, 570, 630); ctx.clip();
      ctx.drawImage(horizon, 600 - horizon.naturalWidth * scale * 0.12, 0, horizon.naturalWidth * scale, horizon.naturalHeight * scale);
      ctx.restore();
    }
    ctx.fillStyle = "#142e2d";
    ctx.fillRect(0, 0, 682, 630);
    ctx.fillStyle = "#e8b466";
    ctx.fillRect(46, 180, 48, 3);
    if (logo) containImage(ctx, logo, 38, 28, 320, 127);
    else fitText(ctx, "Papers Empire", 46, 108, 555, 44, "#f9f1df");
    fitText(ctx, t("careerShare.cardTitle"), 46, 239, 585, 39, "#f9f1df");
    fitText(ctx, t("careerShare.cycleDocs"), 46, 302, 530, 20, "#c4d5ca", 400);
    fitText(ctx, number(facts.docTotal) + " DOC", 46, 359, 570, 54, "#f9f1df");
    fitText(ctx, t("careerShare.production"), 46, 416, 285, 18, "#c4d5ca", 400);
    fitText(ctx, number(facts.docPerSecond) + " DOC/s", 46, 459, 310, 33, "#f9f1df");
    fitText(ctx, t("careerShare.stamps"), 383, 416, 240, 18, "#c4d5ca", 400);
    fitText(ctx, facts.stamps + " / 9", 383, 459, 240, 33, "#e8b466");
    fitText(ctx, t("careerShare.collection", { units: facts.ownedTypes, badges: facts.badges }), 46, 519, 575, 18, "#c4d5ca", 400);
    fitText(ctx, "papersempire.com", 46, 588, 530, 22, "#e8b466");
    for (let index = 0; index < buildings.length; index += 1) {
      const x = 708 + (index % 2) * 218;
      const y = index < 2 ? 243 : 398;
      containImage(ctx, buildings[index], x, y, 215, 210);
    }
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve({ blob, canvas }) : reject(new Error("PNG unavailable")), "image/png"));
  }
  function close() { if (dialog && dialog.open) dialog.close(); }
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = node("dialog", "transfer-dialog career-share-dialog");
    dialog.id = "careerShareDialog";
    dialog.setAttribute("aria-labelledby", "careerShareTitle");
    dialog.addEventListener("keydown", event => { if (event.key === "Escape") event.stopPropagation(); });
    dialog.addEventListener("close", () => {
      generation += 1;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      if (returnFocus && returnFocus.isConnected && !returnFocus.closest("[inert], [hidden], .hidden")) returnFocus.focus();
      returnFocus = null;
    });
    document.body.appendChild(dialog);
    return dialog;
  }
  function download(blob) {
    const url = URL.createObjectURL(blob);
    const link = node("a");
    link.href = url;
    link.download = "papers-empire-" + new Date().toISOString().slice(0, 10) + ".png";
    document.body.appendChild(link);
    link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function open() {
    const surface = ensureDialog();
    const request = ++generation;
    if (!surface.open) returnFocus = document.activeElement;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    surface.replaceChildren();
    const title = node("h2", "transfer-dialog-header", t("careerShare.title"));
    title.id = "careerShareTitle";
    const status = node("p", "transfer-status", t("careerShare.preparing"));
    status.setAttribute("role", "status");
    const actions = node("div", "transfer-actions");
    const dismiss = node("button", "btn-slim", t("saveTransfer.close"));
    dismiss.type = "button";
    dismiss.addEventListener("click", close);
    actions.appendChild(dismiss);
    surface.append(title, status, actions);
    if (!surface.open) surface.showModal();
    dismiss.focus();
    try {
      const getter = options.getSnapshot || (window.__PE_GAME__ && window.__PE_GAME__.getSnapshot);
      const facts = getter ? describeSnapshot(getter()) : null;
      if (!facts) { status.textContent = t("careerShare.empty"); return false; }
      const url = "https://papersempire.com/" + (language() === "fr" ? "" : language() + "/");
      const text = t("careerShare.text", { docs: number(facts.docTotal), units: facts.ownedTypes, stamps: facts.stamps });
      const { blob, canvas } = await renderCard(facts);
      if (request !== generation || !surface.open) return false;
      const preview = node("img", "career-share-preview");
      objectUrl = URL.createObjectURL(blob);
      preview.src = objectUrl;
      preview.alt = text;
      preview.width = 1200;
      preview.height = 630;
      surface.insertBefore(preview, status);
      const copy = node("p", "career-share-text", text);
      const link = node("a", "", url);
      link.href = url;
      surface.insertBefore(copy, status);
      surface.insertBefore(link, status);
      status.textContent = t("careerShare.localFacts");
      const downloadButton = node("button", "btn-slim", t("careerShare.download"));
      downloadButton.type = "button";
      downloadButton.addEventListener("click", () => {
        try { download(blob); status.textContent = t("careerShare.downloaded"); }
        catch { status.textContent = t("careerShare.error"); }
      });
      actions.prepend(downloadButton);
      const file = typeof File === "function" ? new File([blob], "papers-empire.png", { type: "image/png" }) : null;
      const native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.papersNative;
      const canShareFile = file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share;
      if (native || canShareFile || navigator.share) {
        const share = node("button", "btn-slim", t("careerShare.share"));
        share.type = "button";
        share.addEventListener("click", async () => {
          try {
            if (native && typeof native.postMessage === "function") native.postMessage({ action: "shareCard", payload: canvas.toDataURL("image/png"), text, url });
            else if (canShareFile) await navigator.share({ files: [file], title: "Papers Empire", text, url });
            else await navigator.share({ title: "Papers Empire", text, url });
            status.textContent = t("careerShare.shared");
          } catch (error) {
            if (!error || error.name !== "AbortError") status.textContent = t("careerShare.error");
          }
        });
        actions.prepend(share);
      }
      return true;
    } catch { if (request === generation) status.textContent = t("careerShare.error"); return false; }
  }

  window.PECareerShare = { configure, open, close, describeSnapshot };
})();
