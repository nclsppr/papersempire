/**
 * Carries the immutable release stamp from this script tag to assets whose
 * filename is assembled at runtime. Static HTML/CSS/JS URLs are stamped by the
 * build; this closes the dynamic-image gap without changing local development.
 */
(function () {
  "use strict";

  let revision = "";
  try {
    const current = document.currentScript && document.currentScript.src;
    revision = current ? new URL(current, document.baseURI).searchParams.get("v") || "" : "";
  } catch (error) {
    revision = "";
  }

  window.PEAssetUrl = function (path) {
    if (!revision || typeof path !== "string" || !path) return path;
    try {
      const url = new URL(path, document.baseURI);
      if (url.origin !== window.location.origin) return path;
      url.searchParams.set("v", revision);
      return /^https?:\/\//i.test(path)
        ? url.href
        : url.pathname + url.search + url.hash;
    } catch (error) {
      return path;
    }
  };
})();
