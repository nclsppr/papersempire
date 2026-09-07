(function () {
  "use strict";
  const panels = { production: "printStation", units: "buildingsPanel", dossiers: "dispatchPanel", career: "strategyPanel", archives: "progressPanel" };
  let game, translate, active = "production";
  let conflictReason = null, conflictExporting = false, conflictStatus = null;
  function renderSaveConflict() {
    const warning = document.getElementById("saveConflict");
    if (!warning) return;
    warning.hidden = !conflictReason;
    if (!conflictReason) return;
    const copy = {
      saveConflictTitle: conflictReason === "stale" ? "saveConflict.title" : "saveConflict.interruptedTitle",
      saveConflictBody: "saveConflict.body",
      saveConflictExport: "saveConflict.export",
      saveConflictReload: "saveConflict.reload"
    };
    for (const [id, key] of Object.entries(copy)) {
      const node = document.getElementById(id);
      if (node) node.textContent = translate(key);
    }
    const status = document.getElementById("saveConflictStatus");
    if (status) {
      status.hidden = !conflictStatus;
      status.textContent = conflictStatus ? translate(conflictStatus) : "";
    }
    for (const id of ["saveConflictExport", "saveConflictReload"]) {
      const action = document.getElementById(id);
      if (action) action.disabled = conflictExporting;
    }
  }
  function handleSaveHealth(detail = {}) {
    if (detail.reloadRequired === true) {
      // Once this view is blocked, an unrelated quota/health event must not
      // erase its recovery instructions. Only navigation adopts the new save.
      if (detail.reason === "stale" || !conflictReason) conflictReason = detail.reason || "interrupted";
    }
    renderSaveConflict();
    const status = document.getElementById("saveHealth");
    if (!status) return;
    status.textContent = translate(conflictReason ? "saveConflict.body" : detail.ok ? "mobile.saveHealthy" : "mobile.saveFailed");
    status.dataset.status = conflictReason || !detail.ok ? "error" : "saved";
    status.setAttribute("role", conflictReason || !detail.ok ? "alert" : "status");
  }
  async function exportConflictingGame() {
    if (conflictExporting || !conflictReason) return false;
    conflictExporting = true;
    conflictStatus = "saveConflict.exporting";
    renderSaveConflict();
    let exported = false;
    try {
      // This API uses app.js's getSave callback: export this view's memory,
      // not the replacement that another tab just wrote to localStorage.
      exported = await window.PESaveTransfer?.exportSave?.() === true;
    } catch { /* Keep the open game and offer a retry. */ }
    conflictExporting = false;
    conflictStatus = exported ? "saveConflict.exportOpened" : "saveConflict.exportFailed";
    renderSaveConflict();
    return exported;
  }
  function openPanel(id, options = {}) {
    if (!panels[id]) return;
    active = id === "archives" ? "career" : id;
    document.documentElement.dataset.mobilePanel = active;
    const target = document.getElementById(panels[id]);
    if (game) game.expandPanel(panels[id]);
    document.querySelectorAll(".mobile-game-nav [data-mobile-panel]").forEach(link => {
      const selected = link.dataset.mobilePanel === active;
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (options.focus !== false && target) {
      const focus = target.querySelector("h2") || target;
      focus.setAttribute("tabindex", "-1");
      focus.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
  function targetPanel(target) {
    if (!target) return null;
    return Object.keys(panels).find(id => {
      const panel = document.getElementById(panels[id]);
      return panel && (panel === target || panel.contains(target));
    });
  }
  function revealTarget(target) {
    const id = targetPanel(target);
    if (id) openPanel(id, { focus: false });
  }
  function render() {
    if (!game || document.hidden) return;
    renderSaveConflict();
    const snap = game.getSnapshot();
    const set = (id, value) => {
      const node = document.getElementById(id);
      if (node && node.textContent !== value) node.textContent = value;
    };
    const advice = snap.advice;
    set("nextPurchaseText", advice ? translate("mobile.purchaseHint", {
      name: advice.name, cost: game.format(advice.cost), gain: game.format(advice.docGain), cc: game.format(advice.ccGain)
    }) : translate("mobile.noPurchase"));
    const purchase = document.getElementById("nextPurchaseButton");
    if (purchase) {
      purchase.hidden = !advice;
      purchase.disabled = !advice || !advice.canBuy;
      purchase.textContent = translate(advice && advice.canBuy ? "mobile.buySuggested" : "mobile.saveForSuggested");
    }
    const share = document.getElementById("shareCareerBtn");
    if (share) share.disabled = !(snap.resources.totalDocuments > 0);
  }
  function init(options) {
    game = options.game;
    translate = options.translate;
    document.documentElement.classList.add("mobile-ready");
    document.documentElement.dataset.mobilePanel = active;
    document.querySelectorAll(".mobile-game-nav [data-mobile-panel]").forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      openPanel(link.dataset.mobilePanel);
    }));
    document.addEventListener("click", event => {
      const link = event.target.closest("a[href^='#']");
      if (!link) return;
      const hash = link.getAttribute("href");
      if (!/^#[a-zA-Z][\w-]*$/.test(hash)) return;
      const target = document.getElementById(hash.slice(1));
      const id = hash === "#upgradesPanel" ? "career" : targetPanel(target);
      if (id) openPanel(id, { focus: false });
    });
    window.addEventListener("hashchange", () => {
      const id = location.hash === "#upgradesPanel" ? "career" : targetPanel(document.getElementById(location.hash.slice(1)));
      if (id) openPanel(id);
    });
    document.getElementById("nextPurchaseButton")?.addEventListener("click", () => {
      const advice = game.getSnapshot().advice;
      if (advice && advice.canBuy) game.command("buyBuilding", { id: advice.id });
      render();
    });
    document.getElementById("nextPurchaseDetails")?.addEventListener("click", () => openPanel("units"));
    window.addEventListener("pe:save-health", event => handleSaveHealth(event.detail));
    document.getElementById("saveConflictExport")?.addEventListener("click", exportConflictingGame);
    document.getElementById("saveConflictReload")?.addEventListener("click", () => {
      if (conflictReason && !conflictExporting) window.location.reload();
    });
    const health = window.Persistence?.getHealth?.();
    if (health) handleSaveHealth(health);
    render();
    // The graphical shell already refreshes its own visible counters.
    if (!window.__PE_NATIVE__ && new URLSearchParams(location.search).get("experience") !== "empire") setInterval(render, 1000);
    return { openPanel, revealTarget };
  }
  window.PEMobileExperience = { init, openPanel, revealTarget, render };
})();
