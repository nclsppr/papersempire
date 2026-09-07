/** An optional graphical presentation of the canonical game. No economy state lives here. */
(function () {
  const enabled = !!window.__PE_NATIVE__ || new URLSearchParams(location.search).get("experience") === "empire";
  if (!enabled) return;
  document.documentElement.classList.add("pe-empire");
  document.documentElement.dataset.empire = "true";
  if (window.__PE_NATIVE__) document.documentElement.classList.add("pe-native");
  window.__PE_SCENE_MODE__ = "playing";
  const COPY = {
    fr: { empire: "Mon empire", documents: "Documents", rate: "DOC / s", build: "Construire", print: "Imprimer", dossiers: "Dossiers", career: "Carrière", archives: "Succès", settings: "Paramètres", close: "Fermer", owned: "unités possédées", cost: "Prochaine unité", gain: "Effet de l’unité", buy: "Construire une unité", locked: "À débloquer", missing: "DOC manquants", zoomIn: "Agrandir la carte", zoomOut: "Réduire la carte", reset: "Recentrer l’empire", overview: "Vue accessible", next: "Prochain dossier", initial: "Imprime tes premiers documents, puis construis sur la parcelle éclairée.", drag: "Déplace la carte. Touche une unité pour l’agrandir.", fallback: "La vue simplifiée garde toutes tes unités et tes actions disponibles.", production: "Production", upgrade: "Améliorations et réorganisation", transfer: "Transférer ma partie", import: "Importer une partie", export: "Exporter ma partie", selected: "Unité sélectionnée", quantity: "Quantité", status: "Unité construite", growth: "Le bâtiment évolue avec la quantité. Le compteur indique le nombre exact.", more: "Toutes les unités" },
    en: { empire: "My empire", documents: "Documents", rate: "DOC / s", build: "Build", print: "Print", dossiers: "Orders", career: "Career", archives: "Achievements", settings: "Settings", close: "Close", owned: "units owned", cost: "Next unit", gain: "Unit effect", buy: "Build one unit", locked: "Not unlocked yet", missing: "DOC needed", zoomIn: "Zoom in", zoomOut: "Zoom out", reset: "Centre the empire", overview: "Accessible view", next: "Next objective", initial: "Print your first documents, then build on the highlighted plot.", drag: "Move the map. Tap a unit to expand it.", fallback: "The simplified view keeps every unit and action available.", production: "Production", upgrade: "Upgrades and reorganisation", transfer: "Transfer my game", import: "Import a game", export: "Export my game", selected: "Selected unit", quantity: "Quantity", status: "Unit built", growth: "Buildings evolve with quantity. The counter shows the exact number.", more: "All units" },
    de: { empire: "Mein Imperium", documents: "Dokumente", rate: "DOC / s", build: "Bauen", print: "Drucken", dossiers: "Aufträge", career: "Karriere", archives: "Erfolge", settings: "Einstellungen", close: "Schließen", owned: "Einheiten im Besitz", cost: "Nächste Einheit", gain: "Wirkung der Einheit", buy: "Eine Einheit bauen", locked: "Noch nicht freigeschaltet", missing: "DOC fehlen", zoomIn: "Vergrößern", zoomOut: "Verkleinern", reset: "Imperium zentrieren", overview: "Barrierefreie Ansicht", next: "Nächstes Ziel", initial: "Drucke erste Dokumente und baue dann auf dem beleuchteten Grundstück.", drag: "Verschiebe die Karte. Tippe auf eine Einheit, um sie auszubauen.", fallback: "Die vereinfachte Ansicht bietet weiterhin alle Einheiten und Aktionen.", production: "Produktion", upgrade: "Verbesserungen und Reorganisation", transfer: "Spielstand übertragen", import: "Spielstand importieren", export: "Spielstand exportieren", selected: "Gewählte Einheit", quantity: "Anzahl", status: "Einheit gebaut", growth: "Gebäude entwickeln sich mit der Anzahl. Der Zähler zeigt die genaue Menge.", more: "Alle Einheiten" },
    lb: { empire: "Mäin Imperium", documents: "Dokumenter", rate: "DOC / s", build: "Bauen", print: "Drécken", dossiers: "Opdräg", career: "Karriär", archives: "Erfolleger", settings: "Astellungen", close: "Zoumaachen", owned: "Eenheeten am Besëtz", cost: "Nächst Eenheet", gain: "Effekt vun der Eenheet", buy: "Eng Eenheet bauen", locked: "Nach net fräigeschalt", missing: "DOC feelen", zoomIn: "Vergréisseren", zoomOut: "Verklengeren", reset: "Imperium zentréieren", overview: "Accessibel Vue", next: "Nächst Zil", initial: "Dréck deng éischt Dokumenter a bau dann op der beliichter Parzell.", drag: "Verréckel d’Kaart. Tipp op eng Eenheet fir se auszebauen.", fallback: "Déi vereinfacht Vue hält all Eenheeten an Aktiounen disponibel.", production: "Produktioun", upgrade: "Verbesserungen a Reorganisatioun", transfer: "Mäi Spill iwwerdroen", import: "E Spill importéieren", export: "Mäi Spill exportéieren", selected: "Ausgewielt Eenheet", quantity: "Zuel", status: "Eenheet gebaut", growth: "D’Gebaier entwéckele sech mat der Zuel. De Compteur weist déi genee Quantitéit.", more: "All Eenheeten" }
  };
  const paths = { build: "M12 3v18M3 12h18", print: "M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6z", dossiers: "M4 5h6l2 3h8v12H4z", career: "M4 19V13h4v6M10 19V9h4v10M16 19V3h4v16", settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6", close: "m6 6 12 12M18 6 6 18", zoomIn: "M5 12h14M12 5v14", zoomOut: "M5 12h14", reset: "M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M9 12h6M12 9v6", overview: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1", archives: "m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z" };
  let shell, panel, panelBody, panelTitle, selected = null, lastSnapshot, mounted = [], returnFocus, polling;
  const lotButtons = new Map();
  const labels = () => COPY[lastSnapshot?.language || document.documentElement.lang] || COPY.fr;
  const word = key => labels()[key] || key;
  const format = value => window.__PE_DASH__?.format?.(Number(value) || 0) || new Intl.NumberFormat(document.documentElement.lang || "fr", { maximumFractionDigits: 1, notation: Math.abs(value) > 99999 ? "compact" : "standard" }).format(Number(value) || 0);
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (paths[name] || paths.build) + '"/></svg>'; }
  function button(label, name, callback, className) {
    const node = document.createElement("button"); node.type = "button"; node.className = className || "empire-icon-button";
    node.innerHTML = icon(name); node.setAttribute("aria-label", label); node.title = label;
    node.addEventListener("click", callback); return node;
  }
  function command(name, payload) {
    const result = window.__PE_GAME__?.command(name, payload || {});
    if (result?.ok === true && (name === "print" || name === "buyBuilding")) window.webkit?.messageHandlers?.papersNative?.postMessage({ action: "haptic", style: name === "print" ? "light" : "success" });
    render(); return result;
  }
  function closePanel() { if (panel?.open) panel.close(); }
  function restoreMounted() {
    mounted.forEach(({ node, marker }) => { marker.replaceWith(node); node.classList.remove("empire-mounted-panel"); });
    mounted = []; selected = null; panelBody.replaceChildren();
  }
  function showPanel(title) {
    if (panel.open) panel.close();
    restoreMounted(); returnFocus = document.activeElement;
    panelTitle.textContent = title; panel.showModal();
    panel.querySelector(".empire-close").focus();
  }
  function openPanel(id) {
    const map = { production: ["printStation"], units: ["buildingsPanel"], dossiers: ["dispatchPanel"], career: ["strategyPanel"], archives: ["progressPanel"] };
    const ids = map[id]; if (!ids) return false;
    showPanel(word(id === "units" ? "build" : id === "career" ? "upgrade" : id));
    ids.forEach(targetId => {
      const node = document.getElementById(targetId); if (!node) return;
      const marker = document.createComment("empire-panel-home"); node.before(marker);
      mounted.push({ node, marker }); panelBody.append(node); node.classList.add("empire-mounted-panel");
      window.__PE_GAME__?.expandPanel?.(targetId);
      node.querySelectorAll("[data-panel-body]").forEach(body => { body.hidden = false; body.removeAttribute("inert"); body.setAttribute("aria-hidden", "false"); });
    });
    return true;
  }
  function openBuilding(id) {
    const building = window.__PE_GAME__?.getSnapshot().buildings.find(item => item.id === id); if (!building) return;
    showPanel(building.name); selected = id;
    window.CityScene?.focusBuilding?.(id);
    const art = document.createElement("img"); art.src = "/assets/images/building-" + id + "-v4.webp"; art.alt = ""; art.className = "empire-building-art"; art.width = 240; art.height = 160;
    const summary = document.createElement("p"); summary.className = "empire-owned"; summary.dataset.empireOwned = "";
    const data = document.createElement("dl"); data.className = "empire-building-data";
    ["cost", "gain"].forEach(key => { const row = document.createElement("div"); const dt = document.createElement("dt"); dt.textContent = word(key); const dd = document.createElement("dd"); dd.dataset.empireValue = key; row.append(dt, dd); data.append(row); });
    const buy = document.createElement("button"); buy.type = "button"; buy.className = "empire-buy"; buy.dataset.empireBuy = "";
    buy.addEventListener("click", () => { const before = lastSnapshot?.buildings.find(b => b.id === id)?.quantity || 0; command("buyBuilding", { id }); const after = window.__PE_GAME__?.getSnapshot().buildings.find(b => b.id === id)?.quantity || 0; if (after > before) shell.querySelector("[data-empire-announcer]").textContent = word("status") + ": " + building.name; });
    const hint = document.createElement("p"); hint.className = "empire-sheet-hint"; hint.textContent = word("growth");
    panelBody.append(art, summary, data, buy, hint); render();
  }
  function openMenu() {
    showPanel(word("settings"));
    const canonicalLanguage = document.getElementById("langSelect");
    if (canonicalLanguage) {
      const label = document.createElement("label"); label.className = "empire-language";
      const caption = document.createElement("span"); caption.textContent = window.__PE_GAME__?.translate("actions.languageLabel") || "Langue";
      const select = document.createElement("select"); select.id = "empireLanguageSelect";
      Array.from(canonicalLanguage.options).forEach(option => select.append(option.cloneNode(true)));
      select.value = lastSnapshot?.language || document.documentElement.lang;
      select.addEventListener("change", () => { canonicalLanguage.value = select.value; canonicalLanguage.dispatchEvent(new Event("change", { bubbles: true })); });
      label.append(caption, select); panelBody.append(label);
    }
    [["settings", () => { closePanel(); command("openSettings"); }], ["production", () => openPanel("production")], ["archives", () => openPanel("archives")], ["overview", () => openPanel("units")], ["export", () => { closePanel(); command("exportSave"); }], ["import", () => { closePanel(); command("openImport"); }]].forEach(([key, action]) => {
      const item = document.createElement("button"); item.type = "button"; item.className = "empire-menu-item"; item.textContent = word(key); item.addEventListener("click", action); panelBody.append(item);
    });
    const share = document.createElement("button"); share.type = "button"; share.className = "empire-menu-item"; share.textContent = window.__PE_GAME__?.translate("mobile.share") || word("empire");
    share.addEventListener("click", () => { closePanel(); command("shareCareer"); }); panelBody.append(share);
  }
  function updateLabels(snapshot) {
    const layer = shell.querySelector(".empire-lot-labels");
    snapshot.buildings.forEach(building => {
      if (!building.unlocked && !building.quantity) { lotButtons.get(building.id)?.remove(); lotButtons.delete(building.id); return; }
      let control = lotButtons.get(building.id);
      if (!control) { control = button("", "build", () => openBuilding(building.id), "empire-lot"); control.dataset.building = building.id; layer.append(control); lotButtons.set(building.id, control); }
      control.classList.toggle("empire-lot-owned", building.quantity > 0);
      control.classList.toggle("empire-lot-affordable", building.canBuy);
      control.dataset.name = building.name;
      control.setAttribute("aria-label", building.name + ", " + building.quantity + " " + word("owned"));
      const display = building.quantity ? String(building.quantity) : "+";
      if (control.dataset.display !== display) { control.innerHTML = ""; const number = document.createElement("strong"); number.textContent = display; control.append(number); control.dataset.display = display; }
    });
    positionLabels();
  }
  function positionLabels() {
    const projected = window.CityScene?.projectLots?.();
    const available = !!projected && document.getElementById("sceneStage")?.classList.contains("scene-active");
    shell.classList.toggle("empire-scene-unavailable", !available);
    lotButtons.forEach((node, id) => {
      const point = projected?.[id];
      if (!available || !point) { node.hidden = false; node.style.removeProperty("left"); node.style.removeProperty("top"); return; }
      node.style.left = point.x + "px"; node.style.top = point.y + "px";
      node.hidden = !point.visible;
    });
  }
  function render() {
    if (!shell || document.hidden) return;
    const snapshot = window.__PE_GAME__?.getSnapshot(); if (!snapshot) return;
    lastSnapshot = snapshot;
    shell.querySelector("[data-empire-docs]").textContent = format(snapshot.resources.documents);
    shell.querySelector("[data-empire-rate]").textContent = format(snapshot.rates.docPerSecond);
    const objective = shell.querySelector("[data-empire-objective]");
    const title = snapshot.objective?.title || word("next");
    const description = snapshot.objective?.description || word("initial");
    objective.querySelector("strong").textContent = title;
    objective.querySelector("span").textContent = description;
    const pending = document.getElementById("pendingEventButton");
    const incident = shell.querySelector(".empire-incident");
    incident.hidden = !pending || pending.classList.contains("hidden") || pending.hidden;
    if (!incident.hidden) incident.textContent = pending.textContent.trim();
    shell.querySelector(".empire-map-hint").textContent = snapshot.buildings.some(b => b.quantity) ? word("drag") : word("initial");
    updateLabels(snapshot);
    if (shell.classList.contains("empire-scene-unavailable")) shell.querySelector(".empire-map-hint").textContent = word("fallback");
    if (selected && panel.open) {
      const building = snapshot.buildings.find(b => b.id === selected); if (!building) return;
      panel.querySelector("[data-empire-owned]").textContent = building.quantity + " " + word("owned");
      panel.querySelector('[data-empire-value="cost"]').textContent = format(building.cost) + " DOC";
      const effect = panel.querySelector('[data-empire-value="gain"]');
      effect.textContent = building.marginalDocPerSecond > 0 ? "+" + format(building.marginalDocPerSecond) + " DOC/s" : building.impact || building.description;
      const buy = panel.querySelector("[data-empire-buy]"); buy.disabled = !building.canBuy;
      buy.textContent = !building.unlocked ? word("locked") : building.canBuy ? word("buy") : format(Math.max(0, building.cost - snapshot.resources.documents)) + " " + word("missing");
    }
  }
  function boot() {
    const stage = document.getElementById("sceneStage"); if (!stage) return;
    if (window.__PE_NATIVE__) {
      const consent = document.getElementById("engagementConsent");
      if (consent) { consent.checked = false; consent.disabled = true; const row = consent.closest("label"); if (row) { row.hidden = true; row.setAttribute("aria-hidden", "true"); } }
      document.querySelectorAll('[data-i18n="engagement.hint"]').forEach(hint => { hint.hidden = true; });
    }
    shell = document.createElement("main"); shell.id = "empireApp"; shell.className = "empire-app"; shell.setAttribute("aria-label", word("empire"));
    const top = document.createElement("header"); top.className = "empire-top";
    const brand = document.createElement("img"); brand.src = "/assets/images/icon-192.png"; brand.width = 46; brand.height = 46; brand.alt = "Papers Empire";
    const resources = document.createElement("dl"); resources.className = "empire-resources";
    resources.innerHTML = '<div><dt>' + word("documents") + '</dt><dd data-empire-docs>0</dd></div><div><dt>' + word("rate") + '</dt><dd data-empire-rate>0</dd></div>';
    top.append(brand, resources, button(word("settings"), "settings", openMenu));
    const objective = document.createElement("button"); objective.type = "button"; objective.className = "empire-objective"; objective.dataset.empireObjective = ""; objective.innerHTML = "<strong></strong><span></span>";
    objective.addEventListener("click", () => openPanel("career"));
    const map = document.createElement("div"); map.className = "empire-map"; map.append(stage);
    stage.removeAttribute("aria-labelledby"); stage.setAttribute("aria-label", word("empire"));
    stage.hidden = false; stage.removeAttribute("inert"); stage.removeAttribute("aria-hidden");
    const lotLayer = document.createElement("div"); lotLayer.className = "empire-lot-labels"; lotLayer.setAttribute("aria-label", word("build")); map.append(lotLayer);
    const toolbar = document.createElement("div"); toolbar.className = "empire-map-tools";
    toolbar.append(button(word("zoomIn"), "zoomIn", () => window.CityScene?.zoomBy?.(1.25)), button(word("zoomOut"), "zoomOut", () => window.CityScene?.zoomBy?.(0.8)), button(word("reset"), "reset", () => window.CityScene?.resetView?.()));
    const hint = document.createElement("p"); hint.className = "empire-map-hint";
    const incident = document.createElement("button"); incident.type = "button"; incident.className = "empire-incident"; incident.hidden = true; incident.addEventListener("click", () => command("openIncident"));
    const saveAlert = document.createElement("button"); saveAlert.type = "button"; saveAlert.className = "empire-save-alert"; saveAlert.hidden = true; saveAlert.setAttribute("role", "alert"); saveAlert.addEventListener("click", () => command("openSettings", { section: "save" }));
    const dock = document.createElement("nav"); dock.className = "empire-dock"; dock.setAttribute("aria-label", word("empire"));
    [["build", "build", () => openPanel("units")], ["dossiers", "dossiers", () => openPanel("dossiers")], ["print", "print", () => command("print")], ["career", "career", () => openPanel("career")]].forEach(([key, glyph, action]) => {
      const control = button(word(key), glyph, action, "empire-dock-button empire-dock-" + key); const label = document.createElement("span"); label.textContent = word(key); control.append(label); dock.append(control);
    });
    const announcer = document.createElement("p"); announcer.className = "sr-only"; announcer.dataset.empireAnnouncer = ""; announcer.setAttribute("role", "status");
    shell.append(map, top, objective, toolbar, incident, saveAlert, hint, dock, announcer); document.body.append(shell);
    panel = document.createElement("dialog"); panel.className = "empire-sheet"; panel.setAttribute("aria-labelledby", "empireSheetTitle");
    const heading = document.createElement("header"); heading.className = "empire-sheet-heading";
    panelTitle = document.createElement("h2"); panelTitle.id = "empireSheetTitle";
    heading.append(panelTitle, button(word("close"), "close", closePanel, "empire-icon-button empire-close"));
    panelBody = document.createElement("div"); panelBody.className = "empire-sheet-body"; panel.append(heading, panelBody); document.body.append(panel);
    panel.addEventListener("close", () => { if (panel.open) return; restoreMounted(); const anotherDialog = document.querySelector('dialog[open], .event-modal:not(.hidden), .settings-modal:not(.hidden)'); if (!anotherDialog && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); });
    panel.addEventListener("keydown", event => { if (event.key === "Escape") event.stopPropagation(); });
    panel.addEventListener("click", event => { if (event.target === panel) { const rect = panel.getBoundingClientRect(); if (event.clientY < rect.top || event.clientX < rect.left || event.clientX > rect.right) closePanel(); } });
    window.addEventListener("pe:empire-select", event => openBuilding(event.detail.id));
    window.addEventListener("pe:empire-camera", positionLabels);
    window.addEventListener("pe:save-health", event => { saveAlert.hidden = !!event.detail.ok; if (!saveAlert.hidden) saveAlert.textContent = window.__PE_GAME__?.translate("mobile.saveFailed") || word("export"); });
    document.addEventListener("visibilitychange", render);
    // Native dialogs must sit above the graphical sheet as well as the map.
    const modalWatcher = new MutationObserver(() => { if (panel.open && Array.from(document.querySelectorAll("#eventModal,#offlineModal,#settingsModal")).some(node => !node.classList.contains("hidden"))) closePanel(); });
    ["eventModal", "offlineModal", "settingsModal"].forEach(id => { const node = document.getElementById(id); if (node) modalWatcher.observe(node, { attributes: true, attributeFilter: ["class"] }); });
    polling = setInterval(render, 180); render();
    window.PEEmpireView = { openPanel, closePanel, openBuilding, render, active: true };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
