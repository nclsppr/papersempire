import path from "node:path";
import { test, expect } from "@playwright/test";

const htmlPath = path.resolve(__dirname, "../../index.html");
const fileUrl = "file://" + htmlPath.replace(/\\/g, "/");

test.describe("tutorial & settings", () => {
  test.beforeEach(async ({ page }) => {
    // addInitScript re-runs on every navigation, including page.reload(),
    // so an unconditional clear() would wipe preferences a test just saved.
    // Guard with a marker so the wipe only happens on the first document.
    await page.addInitScript(() => {
      if (!window.localStorage.getItem("__pe_test_cleared")) {
        window.localStorage.clear();
        window.localStorage.setItem("__pe_test_cleared", "1");
      }
    });
  });

  test("completes guided tutorial through in-game actions", async ({ page }) => {
    await page.goto(fileUrl);
    const prefs = await page.evaluate(() => window.Settings && window.Settings.getPrefs());
    const tutorialState = await page.evaluate(() => {
      const ref = window.__PE_DEBUG && window.__PE_DEBUG.tutorial;
      return {
        tutorialType: typeof window.Tutorial,
        refPresent: !!ref,
        started: ref?.state?.started ?? null,
        pendingAutoStart: ref?.state?.pendingAutoStart ?? null
      };
    });
    console.log("tutorial prefs", prefs, tutorialState);
    const overlay = page.locator("#tutorialOverlay");
    await expect(overlay).toBeVisible();
    await page.click("#clickButton");
    for (let i = 0; i < 40; i += 1) {
      await page.click("#clickButton");
    }
    await page.waitForSelector('[data-building-btn="reproOperator"]');
    await page.click('[data-building-btn="reproOperator"]');
    await page.click("#journalTab");
    await page.click("#settingsGearButton");
    await expect(overlay).toBeHidden();
  });

  test("settings modal toggles persist preferences", async ({ page }) => {
    await page.goto(fileUrl);
    await page.evaluate(() => {
      if (window.Tutorial && typeof window.Tutorial.skip === "function") {
        window.Tutorial.skip(true);
      }
    });
    await page.click("#settingsGearButton");
    const modal = page.locator("#settingsModal");
    await expect(modal).toBeVisible();
    await page.check("#toggleHighContrast");
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("pref-high-contrast"))).toBeTruthy();
    await page.click("#closeSettingsBtn");
    await expect(modal).toBeHidden();
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/pref-high-contrast/);
    await page.evaluate(() => window.localStorage.removeItem("pe-accessibility"));
  });
});
