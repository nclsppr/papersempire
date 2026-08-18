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
  const assetUrl = window.PEAssetUrl || function (path) { return path; };
  const VENDOR_URL = SCRIPT_URL
    ? assetUrl(new URL("../../vendor/three.module.min.js", SCRIPT_URL).href)
    : assetUrl("assets/vendor/three.module.min.js");
  const THEME_URL = SCRIPT_URL
    ? assetUrl(new URL("./world-theme.js", SCRIPT_URL).href)
    : assetUrl("assets/js/scene/world-theme.js");

  let booted = false;
  let booting = false;
  let rendered = false;
  let unavailable = false;
  let preferenceObserver = null;

  function sceneAllowed() {
    const root = document.documentElement;
    return root.dataset.sceneEnabled !== "0" && !root.classList.contains("pref-high-contrast");
  }

  function syncStageState() {
    const stage = document.getElementById("sceneStage");
    if (!stage) return;
    const active = rendered && sceneAllowed();
    stage.classList.toggle("scene-active", active);
    stage.classList.toggle("scene-loading", booted && !rendered && !unavailable && sceneAllowed());
  }

  function supportsWebGL() {
    try {
      // three r163+ n'accepte plus que WebGL2 : inutile de télécharger le
      // module (~750 Ko) sur un navigateur WebGL1-only.
      const probe = document.createElement("canvas");
      const context = probe.getContext("webgl2");
      if (context) {
        const loseContext = context.getExtension("WEBGL_lose_context");
        if (loseContext) loseContext.loseContext();
      }
      return !!context;
    } catch (err) {
      return false;
    }
  }

  /**
   * boot() ne tourne qu'une fois au chargement ; si l'utilisateur a la
   * scène désactivée puis la réactive dans les paramètres, on relance le
   * boot dès que data-scene-enabled repasse à "1" (sans rechargement).
   */
  function watchPreferences() {
    if (preferenceObserver || !("MutationObserver" in window)) return;
    preferenceObserver = new MutationObserver(() => {
      syncStageState();
      if (sceneAllowed() && !booted) boot();
    });
    preferenceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-scene-enabled"]
    });
  }

  function boot() {
    if (booted || booting) return;
    const stage = document.getElementById("sceneStage");
    const canvas = document.getElementById("cityCanvas");
    if (!stage || !canvas || !window.CityScene) return;
    watchPreferences();
    if (!sceneAllowed()) {
      syncStageState();
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
    booting = true;
    const themeReady = window.PEWorldTheme
      ? Promise.resolve()
      : importer(THEME_URL).catch(err => {
        // Theme failure must never take the game down: both scene modules
        // retain compact PBR fallbacks for this path.
        console.info("[scene] shared world theme unavailable:", err && err.message ? err.message : err);
      });
    themeReady.then(() => importer(VENDOR_URL))
      .then(THREE => {
        const markReady = () => {
          unavailable = false;
          rendered = true;
          syncStageState();
        };
        const markUnavailable = () => {
          unavailable = true;
          rendered = false;
          syncStageState();
        };
        canvas.addEventListener("pe:scene-first-frame", markReady, { once: true });
        canvas.addEventListener("pe:scene-unavailable", markUnavailable);
        const ok = window.CityScene.init(THREE, canvas);
        if (ok) {
          booting = false;
          booted = true;
          syncStageState();
        } else {
          booting = false;
          canvas.removeEventListener("pe:scene-first-frame", markReady);
          canvas.removeEventListener("pe:scene-unavailable", markUnavailable);
          console.info("[scene] init declined — keeping the CSS fallback.");
        }
      })
      .catch(err => {
        booting = false;
        rendered = false;
        syncStageState();
        console.info("[scene] 3D disabled:", err && err.message ? err.message : err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
