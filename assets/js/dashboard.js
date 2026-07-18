/**
 * Tableau de bord "startup" : KPIs temps réel, courbe de production,
 * répartition par bâtiment et petits multiples des jauges.
 *
 * Lecture seule : tout passe par le pont window.__PE_DASH__ exposé par
 * app.js (même philosophie que __PE_SCENE__ : un snapshot jetable par tick,
 * le dashboard ne peut jamais muter la simulation).
 *
 * Les libellés statiques utilisent data-i18n (traduits par app.js) ; seuls
 * les contenus dynamiques (tooltips, table) traduisent ici via window.I18N.
 */
(function () {
  "use strict";

  const SAMPLE_MS = 3000;      // un point toutes les 3 s
  const WINDOW_SIZE = 100;     // ~5 minutes d'historique glissant
  const MAX_BARS = 8;          // au-delà : repli dans « Autres »

  const CHART = {
    height: 150,
    gaugeHeight: 90,
    padLeft: 44,
    padRight: 10,
    padY: 12
  };

  const samples = [];
  let els = null;
  let lastBarsSignature = "";

  /* Source de données : le pont app.js sur la page du jeu, sinon le mode
     autonome de la page /dashboard/ — dernier snapshot persisté par le jeu
     (clé pe-dash-snapshot), rafraîchi en direct par les événements storage
     quand un onglet de jeu est ouvert à côté. */
  let standaloneSource = null;

  function bridge() {
    return window.__PE_DASH__ || standaloneSource;
  }

  function standaloneFormat(n) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + " Md";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + " M";
    if (n >= 10_000) return (n / 1_000).toFixed(1) + " k";
    if (n >= 1000) return (n / 1_000).toFixed(2) + " k";
    if (n === 0) return "0";
    if (n < 1) return n.toFixed(3);
    return n.toFixed(1);
  }

  function detectStandaloneLang() {
    const supported = ["fr", "en", "de", "lb"];
    let lang = null;
    try {
      lang = new URLSearchParams(window.location.search).get("lang");
    } catch {
      lang = null;
    }
    if (supported.includes(lang)) return lang;
    return "fr";
  }

  function setupStandalone() {
    const lang = detectStandaloneLang();
    document.documentElement.lang = lang;
    const all = window.I18N || {};
    const d = all[lang] || {};
    const fr = all.fr || {};
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const value = d[key] || fr[key];
      if (value) el.textContent = value;
    });
    const back = document.getElementById("backToGameLink");
    if (back) back.setAttribute("href", lang === "fr" ? "/" : "/?lang=" + lang);

    let lastSnapshot = null;
    try {
      lastSnapshot = JSON.parse(window.localStorage.getItem("pe-dash-snapshot"));
    } catch {
      lastSnapshot = null;
    }
    window.addEventListener("storage", event => {
      if (event.key !== "pe-dash-snapshot" || !event.newValue) return;
      try {
        lastSnapshot = JSON.parse(event.newValue);
      } catch {
        return;
      }
      sample();
    });
    standaloneSource = {
      format: standaloneFormat,
      getSnapshot() {
        return lastSnapshot;
      }
    };
  }

  function dict() {
    const lang = document.documentElement.lang || "fr";
    const all = window.I18N || {};
    return all[lang] || all.fr || {};
  }

  function t(key) {
    const d = dict();
    return d[key] || (window.I18N && window.I18N.fr && window.I18N.fr[key]) || key;
  }

  function fmt(n) {
    const b = bridge();
    return b && b.format ? b.format(n) : String(Math.round(n * 10) / 10);
  }

  // -------------------------------
  // Échantillonnage
  // -------------------------------

  function sample() {
    const b = bridge();
    if (!b) return;
    const snap = b.getSnapshot();
    if (!snap) return;
    samples.push({
      t: Date.now(),
      dps: snap.docPerSecond,
      total: snap.docTotal,
      quality: snap.stats.quality,
      footprint: snap.stats.footprint,
      image: snap.stats.brandImage
    });
    // Couverture de TOUTE la session : au-delà de la fenêtre, on décime
    // (1 point sur 2) au lieu de faire glisser — la courbe garde le début.
    if (samples.length > WINDOW_SIZE * 2) {
      const thinned = samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1);
      samples.length = 0;
      Array.prototype.push.apply(samples, thinned);
    }
    render(snap);
  }

  // -------------------------------
  // Tuiles KPI
  // -------------------------------

  function renderKpis(snap) {
    els.kpiProduction.textContent = fmt(snap.docPerSecond) + " DOC/s";
    els.kpiBank.textContent = fmt(snap.docBank);
    els.kpiTotal.textContent = fmt(snap.docTotal);
    els.kpiTrust.textContent = fmt(snap.ccTotal);
    els.kpiCulture.textContent = fmt(snap.culturePoints) + " · x" + snap.prestigeMult.toFixed(2);
    els.kpiBuildings.textContent = String(snap.buildingCount);

    // Tendance de production vs il y a ~1 min (20 échantillons)
    const ref = samples[Math.max(0, samples.length - 21)];
    const cur = samples[samples.length - 1];
    let trend = "";
    if (ref && cur && samples.length > 5) {
      const delta = cur.dps - ref.dps;
      if (Math.abs(delta) >= 0.05) {
        trend = (delta > 0 ? "▲ +" : "▼ ") + fmt(delta) + " DOC/s";
      } else {
        trend = "→";
      }
    }
    els.kpiTrend.textContent = trend;
    els.kpiTrend.classList.toggle("is-up", trend.startsWith("▲"));
    els.kpiTrend.classList.toggle("is-down", trend.startsWith("▼"));
  }

  // -------------------------------
  // Courbe de production (série unique, or)
  // -------------------------------

  function niceMax(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function lineGeometry(width, height, values, maxValue) {
    const x0 = CHART.padLeft;
    const x1 = width - CHART.padRight;
    const y0 = height - CHART.padY;
    const y1 = CHART.padY;
    const n = values.length;
    const pts = values.map((v, i) => {
      const x = n === 1 ? x1 : x0 + ((x1 - x0) * i) / (n - 1);
      const y = y0 - ((y0 - y1) * Math.min(v, maxValue)) / maxValue;
      return [x, y];
    });
    return { pts, x0, x1, y0, y1 };
  }

  function renderProductionChart() {
    const svg = els.prodChart;
    const width = svg.clientWidth || 600;
    const height = CHART.height;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);

    if (samples.length < 2) {
      svg.innerHTML = "";
      els.prodEmpty.hidden = false;
      return;
    }
    els.prodEmpty.hidden = true;

    // Documents cumulés depuis le début de la session : normalisation
    // min-max avec marge, pour une courbe qui monte au lieu d'une ligne
    // collée au plafond (la production instantanée reste dans les tuiles).
    const values = samples.map(s => s.total);
    const vmin = Math.min.apply(null, values);
    const vmax = Math.max.apply(null, values);
    const span = Math.max(vmax - vmin, 1);
    const x0 = CHART.padLeft;
    const x1 = width - CHART.padRight;
    const y0 = height - CHART.padY;
    const y1 = CHART.padY;
    const n = values.length;
    const pts = values.map((v, i) => {
      const x = x0 + ((x1 - x0) * i) / (n - 1);
      const y = y0 - ((y0 - y1) * 0.92 * (v - vmin)) / span;
      return [x, y];
    });
    const g = { pts, x0, x1, y0, y1 };
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const area = line + " L" + x1.toFixed(1) + "," + y0 + " L" + pts[0][0].toFixed(1) + "," + y0 + " Z";

    let out = "";
    for (const tickValue of [vmin, vmin + span / 2, vmax]) {
      const y = y0 - ((y0 - y1) * 0.92 * (tickValue - vmin)) / span;
      out += '<line class="dash-grid" x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '"></line>';
      out += '<text class="dash-axis" x="' + (x0 - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + fmt(tickValue) + "</text>";
    }
    out += '<path class="dash-area" d="' + area + '"></path>';
    out += '<path class="dash-line" d="' + line + '"></path>';
    out += '<g class="dash-hover" hidden><line class="dash-crosshair" y1="' + y1 + '" y2="' + y0 + '"></line><circle class="dash-dot" r="4"></circle></g>';
    svg.innerHTML = out;
    svg.__geometry = { g, values };
  }

  function attachProductionHover() {
    const svg = els.prodChart;
    const tip = els.prodTip;
    svg.addEventListener("pointermove", event => {
      const geo = svg.__geometry;
      if (!geo || samples.length < 2) return;
      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const { g, values } = geo;
      const n = values.length;
      const idx = Math.round(((x - g.x0) / (g.x1 - g.x0)) * (n - 1));
      if (idx < 0 || idx >= n) return;
      const [px, py] = g.pts[idx];
      const hover = svg.querySelector(".dash-hover");
      hover.hidden = false;
      hover.querySelector(".dash-crosshair").setAttribute("x1", px);
      hover.querySelector(".dash-crosshair").setAttribute("x2", px);
      const dot = hover.querySelector(".dash-dot");
      dot.setAttribute("cx", px);
      dot.setAttribute("cy", py);
      const agoSec = Math.max(0, Math.round((Date.now() - samples[idx].t) / 1000));
      const ago = agoSec >= 120 ? "-" + Math.round(agoSec / 60) + " min" : "-" + agoSec + " s";
      tip.hidden = false;
      tip.textContent = fmt(values[idx]) + " DOC · " + ago;
      tip.style.left = Math.min(px + 10, (svg.clientWidth || 600) - 120) + "px";
      tip.style.top = Math.max(py - 30, 0) + "px";
    });
    svg.addEventListener("pointerleave", () => {
      tip.hidden = true;
      const hover = svg.querySelector(".dash-hover");
      if (hover) hover.hidden = true;
    });
  }

  // -------------------------------
  // Barres : production par bâtiment (teinte unique, libellés directs)
  // -------------------------------

  function renderBuildingBars(snap) {
    const producing = snap.buildings
      .filter(b => b.production > 0)
      .sort((a, b) => b.production - a.production);
    const total = producing.reduce((sum, b) => sum + b.production, 0);

    const rows = producing.slice(0, MAX_BARS);
    const rest = producing.slice(MAX_BARS);
    if (rest.length) {
      rows.push({
        nameKey: "dashboard.other",
        production: rest.reduce((sum, b) => sum + b.production, 0)
      });
    }

    const signature = document.documentElement.lang + "|" +
      rows.map(r => r.nameKey + ":" + r.production.toFixed(2)).join(",");
    if (signature === lastBarsSignature) return;
    lastBarsSignature = signature;

    if (!rows.length) {
      els.barsWrap.innerHTML = '<p class="dash-empty" data-i18n="dashboard.emptyBars">' + t("dashboard.emptyBars") + "</p>";
      return;
    }

    const max = rows[0].production;
    let out = "";
    for (const row of rows) {
      const pct = total > 0 ? Math.round((row.production / total) * 100) : 0;
      const w = Math.max(2, (row.production / max) * 100);
      out +=
        '<div class="dash-bar-row" title="' + t(row.nameKey) + " · " + fmt(row.production) + " DOC/s (" + pct + ' %)">' +
        '<span class="dash-bar-label">' + t(row.nameKey) + "</span>" +
        '<span class="dash-bar-track"><span class="dash-bar-fill" style="width:' + w.toFixed(1) + '%"></span></span>' +
        '<span class="dash-bar-value">' + fmt(row.production) + "</span>" +
        "</div>";
    }
    els.barsWrap.innerHTML = out;
  }

  // -------------------------------
  // Petits multiples : jauges (échelle commune 0-100 %)
  // -------------------------------

  function renderGaugeSparks() {
    const specs = [
      { key: "quality", cls: "is-quality" },
      { key: "footprint", cls: "is-footprint" },
      { key: "image", cls: "is-image" }
    ];
    for (const spec of specs) {
      const svg = els.gauges[spec.key];
      const width = svg.clientWidth || 200;
      const height = CHART.gaugeHeight;
      svg.setAttribute("viewBox", "0 0 " + width + " " + height);
      if (samples.length < 2) {
        svg.innerHTML = "";
        continue;
      }
      const values = samples.map(s => s[spec.key] * 100);
      const g = lineGeometry(width, height, values, 100);
      const line = g.pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
      const mid = g.y0 - (g.y0 - g.y1) / 2;
      const current = Math.round(values[values.length - 1]);
      let out = '<line class="dash-grid" x1="' + g.x0 + '" y1="' + mid + '" x2="' + g.x1 + '" y2="' + mid + '"></line>';
      out += '<text class="dash-axis" x="' + (g.x0 - 6) + '" y="' + (g.y1 + 3) + '" text-anchor="end">100</text>';
      out += '<text class="dash-axis" x="' + (g.x0 - 6) + '" y="' + (g.y0 + 3) + '" text-anchor="end">0</text>';
      out += '<path class="dash-line dash-gauge-line ' + spec.cls + '" d="' + line + '"></path>';
      out += '<text class="dash-gauge-value ' + spec.cls + '" x="' + g.x1 + '" y="' + (g.pts[g.pts.length - 1][1] - 6) + '" text-anchor="end">' + current + " %</text>";
      svg.innerHTML = out;
    }
  }

  // -------------------------------
  // Vue table (accessibilité / données brutes)
  // -------------------------------

  function renderTable(snap) {
    if (!els.tableDetails.open) return;
    const rows = [
      ["dashboard.kpi.production", fmt(snap.docPerSecond) + " DOC/s"],
      ["dashboard.kpi.docBank", fmt(snap.docBank)],
      ["dashboard.kpi.docTotal", fmt(snap.docTotal)],
      ["dashboard.kpi.trust", fmt(snap.ccTotal)],
      ["dashboard.kpi.culture", fmt(snap.culturePoints)],
      ["gauges.quality", Math.round(snap.stats.quality * 100) + " %"],
      ["gauges.footprint", Math.round(snap.stats.footprint * 100) + " %"],
      ["gauges.image", Math.round(snap.stats.brandImage * 100) + " %"]
    ].concat(
      snap.buildings
        .filter(b => b.quantity > 0)
        .map(b => [b.nameKey, b.quantity + " · " + fmt(b.production) + " DOC/s"])
    );
    els.tableBody.innerHTML = rows
      .map(r => "<tr><th scope=\"row\">" + t(r[0]) + "</th><td>" + r[1] + "</td></tr>")
      .join("");
  }

  // -------------------------------
  // Boot
  // -------------------------------

  function collectEls() {
    const root = document.getElementById("dashboardCard");
    if (!root) return null;
    return {
      root,
      kpiProduction: root.querySelector("[data-dash-kpi=production]"),
      kpiTrend: root.querySelector("[data-dash-kpi=trend]"),
      kpiBank: root.querySelector("[data-dash-kpi=bank]"),
      kpiTotal: root.querySelector("[data-dash-kpi=total]"),
      kpiTrust: root.querySelector("[data-dash-kpi=trust]"),
      kpiCulture: root.querySelector("[data-dash-kpi=culture]"),
      kpiBuildings: root.querySelector("[data-dash-kpi=buildings]"),
      prodChart: root.querySelector("#dashProdChart"),
      prodTip: root.querySelector("#dashProdTip"),
      prodEmpty: root.querySelector("#dashProdEmpty"),
      barsWrap: root.querySelector("#dashBars"),
      gauges: {
        quality: root.querySelector("#dashGaugeQuality"),
        footprint: root.querySelector("#dashGaugeFootprint"),
        image: root.querySelector("#dashGaugeImage")
      },
      tableDetails: root.querySelector("#dashTableDetails"),
      tableBody: root.querySelector("#dashTableBody")
    };
  }

  function render(snap) {
    renderKpis(snap);
    renderProductionChart();
    renderBuildingBars(snap);
    renderGaugeSparks();
    renderTable(snap);
  }

  function boot() {
    els = collectEls();
    if (!els) return;
    attachProductionHover();
    els.tableDetails.addEventListener("toggle", () => {
      const b = bridge();
      if (b && els.tableDetails.open) renderTable(b.getSnapshot());
    });
    // Page /dashboard/ (pas de jeu, pas de pont) : mode autonome.
    if (!window.__PE_DASH__ && document.body.classList.contains("dash-standalone")) {
      setupStandalone();
    }
    // Le pont n'existe qu'une fois app.js initialisé (defer garantit l'ordre,
    // mais on reste défensif : premier échantillon dès que la source répond).
    const waiter = setInterval(() => {
      if (bridge()) {
        clearInterval(waiter);
        sample();
        setInterval(sample, SAMPLE_MS);
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
