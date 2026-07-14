import path from "node:path";
import { test, expect } from "@playwright/test";

const htmlPath = path.resolve(__dirname, "../../index.html");

const fileUrl = "file://" + htmlPath.replace(/\\/g, "/");

/**
 * Under file:// the dynamic import() of the vendored three.js module is
 * blocked by CORS — by design. These tests pin the graceful-degradation
 * contract: the game must be fully playable without the 3D layer, with the
 * CSS skyline fallback shown instead of the canvas.
 */
test.describe("3D scene progressive enhancement", () => {
  test("degrades gracefully when the module cannot load", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", err => pageErrors.push(err));

    await page.goto(fileUrl);

    // Stage present with the CSS fallback; the 3D layer never activated.
    const stage = page.locator("#sceneStage");
    await expect(stage).toBeVisible();
    await expect(page.locator("#stageFallback")).toBeVisible();
    // Give the loader a beat: scene-active must NOT appear under file://.
    await page.waitForTimeout(500);
    await expect(stage).not.toHaveClass(/scene-active/);
    await expect(page.locator("#cityCanvas")).toBeHidden();

    // The game itself is untouched: clicking produces documents.
    const clickButton = page.locator("#clickButton");
    await clickButton.click();
    await expect(page.locator("#docTotal")).not.toHaveText("0");

    expect(pageErrors).toEqual([]);
  });

  test("scene notifications are a no-op when the 3D layer is absent", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", err => pageErrors.push(err));

    // Under file:// the scene never boots, so __PE_SCENE_EVENTS__ stays
    // undefined and app.js notifications must be silent no-ops: buying
    // (purchase notify) and a story event (event notify) must not throw.
    // The save is seeded via addInitScript (runs before the game scripts)
    // so the debounced autosave cannot race and overwrite it.
    await page.addInitScript(() => {
      localStorage.setItem("papersEmpireSave", JSON.stringify({
        version: 1,
        resources: { docBank: 100, docTotal: 100, ccTotal: 0, culturePoints: 0 },
        stats: { quality: 0.5, footprint: 0.5, imageVbs: 0.5 },
        buildings: [],
        upgrades: [],
        achievements: {}
      }));
    });
    await page.goto(fileUrl);
    const buyButton = page.locator('[data-building-btn="reproOperator"]');
    await buyButton.click();
    await page.evaluate(() => (window as any).__PE_DEBUG.spawnEvent("machineBreakdown"));
    await expect(page.locator("#eventModal")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("scene bridge exposes a defensive snapshot", async ({ page }) => {
    await page.goto(fileUrl);
    const result = await page.evaluate(() => {
      const bridge = (window as any).__PE_SCENE__;
      if (!bridge) return { ok: false, reason: "missing bridge" };
      const snap = bridge.getSnapshot();
      const shapeOk =
        Array.isArray(snap.buildings) &&
        snap.buildings.length > 0 &&
        typeof snap.buildings[0].id === "string" &&
        typeof snap.buildings[0].quantity === "number" &&
        typeof snap.stats.quality === "number";
      // Mutating the snapshot must not leak into the next one.
      snap.buildings[0].quantity = 9999;
      snap.stats.quality = -1;
      const snap2 = bridge.getSnapshot();
      return {
        ok: shapeOk && snap2.buildings[0].quantity !== 9999 && snap2.stats.quality !== -1
      };
    });
    expect(result.ok).toBe(true);
  });

  test("layout helpers are loaded and deterministic in the page", async ({ page }) => {
    await page.goto(fileUrl);
    const result = await page.evaluate(() => {
      const L = (window as any).CityLayout;
      if (!L) return { ok: false };
      const a = JSON.stringify(L.duplicateOffsets("reproOperator", 5));
      const b = JSON.stringify(L.duplicateOffsets("reproOperator", 5));
      return {
        ok:
          L.BUILDING_IDS.length === 11 &&
          a === b &&
          L.floorsFor(0) === 1 &&
          L.floorsFor(16) === 5 &&
          L.copiesFor("reproOperator", 0) === 0
      };
    });
    expect(result.ok).toBe(true);
  });
});
