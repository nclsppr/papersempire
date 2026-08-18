/**
 * SceneLoader — boots the 3D campus as a progressive enhancement.
 *
 * three.js 0.185.1 is vendored as an ES module (assets/vendor/). This file
 * is a CLASSIC script so the game keeps working everywhere: it feature-
 * detects, loads the tiny shared world theme, then dynamically imports the
 * module. On ANY failure — file:// (module fetches are blocked by CORS),
 * an old browser without dynamic import, missing WebGL, a fetch
 * error — the promise rejects or init returns false, we log one info line
 * and the CSS skyline fallback simply stays visible. The DOM game is never
 * affected.
 */
(function () {
  // Resolved NOW (document.currentScript is only valid during initial
  // execution) into an absolute URL: dynamic-import base-URL rules differ
  // between browsers for Function-wrapped import, absolute URLs do not.
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : "";
  const VENDOR_URL = SCRIPT_URL
    ? new URL("../../vendor/three.module.min.js", SCRIPT_URL).href
    : "assets/vendor/three.module.min.js";
  const THEME_URL = SCRIPT_URL
    ? new URL("./world-theme.js", SCRIPT_URL).href
    : "assets/js/scene/world-theme.js";

  let booted = false;

  function supportsWebGL() {
    try {
      // three r163+ n'accepte plus que WebGL2 : inutile de télécharger le
      // module (~750 Ko) sur un navigateur WebGL1-only.
      const probe = document.createElement("canvas");
      return !!probe.getContext("webgl2");
    } catch (err) {
      return false;
    }
  }

  /**
   * boot() ne tourne qu'une fois au chargement ; si l'utilisateur a la
   * scène désactivée puis la réactive dans les paramètres, on relance le
   * boot dès que data-scene-enabled repasse à "1" (sans rechargement).
   */
  function watchReEnable() {
    if (!("MutationObserver" in window)) return;
    const mo = new MutationObserver(() => {
      if (document.documentElement.dataset.sceneEnabled !== "0" && !booted) {
        mo.disconnect();
        boot();
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-scene-enabled"]
    });
  }

  function boot() {
    if (booted) return;
    const stage = document.getElementById("sceneStage");
    const canvas = document.getElementById("cityCanvas");
    if (!stage || !canvas || !window.CityScene) return;
    if (document.documentElement.dataset.sceneEnabled === "0") {
      watchReEnable();
      return;
    }
    if (!supportsWebGL()) {
      console.info("[scene] WebGL unavailable — keeping the CSS fallback.");
      return;
    }
    // Indirection through Function keeps old parsers from choking on
    // import() at parse time. The specifier is an absolute URL (see
    // VENDOR_URL above), so base-URL resolution quirks cannot bite.
    let importer;
    try {
      importer = new Function("p", "return import(p);");
    } catch (err) {
      console.info("[scene] dynamic import unsupported — keeping the CSS fallback.");
      return;
    }
    const themeReady = window.PEWorldTheme
      ? Promise.resolve()
      : importer(THEME_URL).catch(err => {
        // Theme failure must never take the game down: both scene modules
        // retain compact PBR fallbacks for this path.
        console.info("[scene] shared world theme unavailable:", err && err.message ? err.message : err);
      });
    themeReady.then(() => importer(VENDOR_URL))
      .then(THREE => {
        const ok = window.CityScene.init(THREE, canvas);
        if (ok) {
          booted = true;
          stage.classList.add("scene-active");
        } else {
          console.info("[scene] init declined — keeping the CSS fallback.");
        }
      })
      .catch(err => {
        console.info("[scene] 3D disabled:", err && err.message ? err.message : err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
