/** Portable local saves. Importing always previews before replacing progress. */
(function () {
  "use strict";
  let options = {};
  let dialog = null;
  let fileInput = null;
  let pending = null;
  let restoreTarget = null;

  function configure(next = {}) { options = { ...options, ...next }; }
  function language() {
    const value = typeof options.locale === "function" ? options.locale() : options.locale;
    return value || document.documentElement.lang || "fr";
  }
  function t(key, params = {}) {
    const value = typeof options.translate === "function" ? options.translate(key, params) : key;
    return String(value);
  }
  function number(value) {
    return new Intl.NumberFormat(language(), { maximumFractionDigits: 0 }).format(value);
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function errorCopy(reason) { return t("saveTransfer.error." + (reason || "invalid")); }
  function status(message, failed = false) {
    let target = document.getElementById("saveTransferStatus");
    if (!target) {
      target = node("p", "transfer-status small");
      target.id = "saveTransferStatus";
      target.setAttribute("role", "status");
      (document.getElementById("settingsPanelSave") || document.body).appendChild(target);
    }
    target.textContent = message;
    target.dataset.error = String(failed);
  }
  function closeDialog() {
    pending = null;
    if (dialog && dialog.open) dialog.close();
  }
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = node("dialog", "transfer-dialog");
    dialog.id = "saveTransferDialog";
    dialog.setAttribute("aria-labelledby", "saveTransferTitle");
    // Native dialog supplies focus containment/inert background. Escape must
    // not also close the underlying Settings dialog through global handlers.
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") event.stopPropagation();
    });
    dialog.addEventListener("cancel", () => { pending = null; });
    dialog.addEventListener("close", () => {
      pending = null;
      if (restoreTarget && restoreTarget.isConnected && !restoreTarget.closest("[inert], [hidden], .hidden")) restoreTarget.focus();
      restoreTarget = null;
    });
    document.body.appendChild(dialog);
    return dialog;
  }
  function summaryRows(preview) {
    return [
      [t("saveTransfer.documents"), number(preview.resources.docBank) + " DOC"],
      [t("saveTransfer.trust"), number(preview.resources.ccTotal) + " CC"],
      [t("saveTransfer.culture"), number(preview.resources.culturePoints)],
      [t("saveTransfer.units"), number(preview.unitCount)],
      [t("saveTransfer.stamps"), number(preview.stamps) + " / 9"]
    ];
  }
  function makeSummary(preview) {
    const list = node("dl", "transfer-summary");
    for (const [label, value] of summaryRows(preview)) {
      const row = node("div");
      row.append(node("dt", "", label), node("dd", "", value));
      list.appendChild(row);
    }
    return list;
  }
  function showPreview(result, recovery = false) {
    const surface = ensureDialog();
    if (!surface.open) restoreTarget = document.activeElement;
    pending = result.ok ? { raw: result.raw, recovery } : null;
    surface.replaceChildren();
    const title = node("h2", "transfer-dialog-header", t(recovery ? "saveTransfer.recoverTitle" : "saveTransfer.importTitle"));
    title.id = "saveTransferTitle";
    surface.appendChild(title);
    if (result.ok) {
      surface.appendChild(node("p", "", t("saveTransfer.previewHint")));
      if (result.preview.savedAt) {
        surface.appendChild(node("p", "small", t("saveTransfer.savedAt", {
          date: new Intl.DateTimeFormat(language(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.preview.savedAt))
        })));
      }
      surface.appendChild(makeSummary(result.preview));
      surface.appendChild(node("p", "", t("saveTransfer.replaceWarning")));
    } else {
      surface.appendChild(node("p", "transfer-status", errorCopy(result.reason)));
    }
    const inlineStatus = node("p", "transfer-status");
    inlineStatus.setAttribute("role", "status");
    surface.appendChild(inlineStatus);
    const actions = node("div", "transfer-actions");
    const cancel = node("button", "btn-slim", t(result.ok ? "saveTransfer.cancel" : "saveTransfer.close"));
    cancel.type = "button";
    cancel.autofocus = true;
    cancel.addEventListener("click", closeDialog);
    actions.appendChild(cancel);
    if (result.ok) {
      const confirm = node("button", "btn-slim", t(recovery ? "saveTransfer.recoverConfirm" : "saveTransfer.replaceConfirm"));
      confirm.type = "button";
      confirm.addEventListener("click", () => {
        if (!pending) return;
        const chosen = pending;
        // The bytes reviewed above are the bytes imported, even if another
        // tab changes the backup while this dialog remains open.
        const replaced = window.Persistence.importData(chosen.raw);
        if (!replaced) {
          inlineStatus.textContent = errorCopy(window.Persistence.getHealth().reason);
          return;
        }
        pending = null;
        confirm.disabled = true;
        if (typeof options.onReplaced === "function") options.onReplaced();
        else window.location.reload();
      });
      actions.appendChild(confirm);
    }
    surface.appendChild(actions);
    if (!surface.open) surface.showModal();
    cancel.focus();
    return { ok: result.ok, reason: result.reason || null };
  }
  function previewImport(raw) {
    return showPreview(window.Persistence.parseImport(raw));
  }
  function previewRecovery() { return showPreview(window.Persistence.getBackup(), true); }
  function chooseImport() {
    const native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.papersNative;
    if (native && typeof native.postMessage === "function") {
      try { native.postMessage({ action: "importSave" }); }
      catch { status(errorCopy("read"), true); }
      return;
    }
    if (fileInput) fileInput.remove();
    fileInput = node("input");
    fileInput.type = "file";
    fileInput.accept = ".papersempire,.json,application/json,application/x-papersempire";
    fileInput.hidden = true;
    fileInput.setAttribute("aria-label", t("saveTransfer.chooseFile"));
    const input = fileInput;
    input.addEventListener("cancel", () => input.remove(), { once: true });
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      if (file.size > window.Persistence.MAX_BYTES) {
        showPreview({ ok: false, reason: "size" });
        return;
      }
      try { previewImport(await file.text()); }
      catch { showPreview({ ok: false, reason: "read" }); }
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = node("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function exportSave() {
    let payload;
    try {
      const getter = options.getSave || (window.__PE_GAME__ && window.__PE_GAME__.getSave);
      payload = getter ? getter() : window.Persistence.exportData();
    } catch { status(errorCopy("invalid"), true); return false; }
    const portable = window.Persistence.createPortable(payload);
    if (!portable.ok) { status(errorCopy(portable.reason), true); return false; }
    const native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.papersNative;
    if (native && typeof native.postMessage === "function") {
      try {
        native.postMessage({ action: "exportSave", payload: portable.raw });
        status(t("saveTransfer.exportOpened"));
        return true;
      } catch { status(errorCopy("export"), true); return false; }
    }
    const filename = "papers-empire-" + new Date().toISOString().slice(0, 10) + ".papersempire";
    const blob = new Blob([portable.raw], { type: "application/json" });
    try {
      const file = typeof File === "function" ? new File([blob], filename, { type: "application/json" }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: t("saveTransfer.exportTitle") });
        status(t("saveTransfer.exportOpened"));
      } else {
        download(blob, filename);
        status(t("saveTransfer.exportDownloaded"));
      }
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") return false;
      try {
        download(blob, filename);
        status(t("saveTransfer.exportDownloaded"));
        return true;
      } catch { status(errorCopy("export"), true); return false; }
    }
  }

  window.PESaveTransfer = { configure, chooseImport, previewImport, previewRecovery, exportSave, close: closeDialog };
})();
