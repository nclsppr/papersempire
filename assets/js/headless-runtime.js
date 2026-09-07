/* JavaScriptCore entry point. Load this before the canonical game modules.
 * No DOM, fake browser, timers, storage, network or alternate economy is created.
 * One JSContext owns one game. To confirm an import, initialize a fresh context
 * with previewImport(raw).save, then atomically replace the native saved file.
 */
(() => {
  "use strict";
  const root = globalThis;
  root.PEPlatform = Object.freeze({ headless: true });
  const detached = value => value === undefined ? null : JSON.parse(JSON.stringify(value));
  const engine = () => {
    if (!root.__PE_HEADLESS_ENGINE__) throw new Error("Canonical game modules have not been loaded");
    return root.__PE_HEADLESS_ENGINE__;
  };
  root.PEHeadless = Object.freeze({
    init(save = null, language = "fr") { return detached(engine().init(save, language)); },
    tick(deltaSeconds) { return detached(engine().tick(deltaSeconds)); },
    command(action, payload = {}) { return detached(engine().command(action, payload)); },
    snapshot() { return detached(engine().snapshot()); },
    save() { return detached(engine().save()); },
    translate(key, params = {}) { return engine().translate(key, params); },
    format(value) { return engine().format(value); },
    previewImport(raw) { return detached(root.PESaveCodec.parseImport(raw)); },
    portableSave() { return detached(root.PESaveCodec.createPortable(engine().save())); }
  });
})();
