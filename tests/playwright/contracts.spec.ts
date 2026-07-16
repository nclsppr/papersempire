import path from "node:path";
import { test, expect } from "@playwright/test";

const htmlPath = path.resolve(__dirname, "../../index.html");
const fileUrl = "file://" + htmlPath.replace(/\\/g, "/");

test.describe("contracts tab", () => {
  test("is gated behind the doc-total unlock on a fresh game", async ({ page }) => {
    await page.goto(fileUrl);
    await expect(page.locator("#journalPanel")).toBeVisible();
    await expect(page.locator("#contractsPanel")).toBeHidden();
    await expect(page.locator("#contractsTab")).toBeHidden();
  });

  test("switches tabs and renders contracts once unlocked", async ({ page }) => {
    // Contracts unlock at docTotal >= 1500; seed a save past the threshold
    // via addInitScript so it is in place before the game scripts read it.
    await page.addInitScript(() => {
      localStorage.setItem("papersEmpireSave", JSON.stringify({
        version: 1,
        resources: { docBank: 2000, docTotal: 2000, ccTotal: 0, culturePoints: 0 },
        stats: { quality: 0.5, footprint: 0.5, imageVbs: 0.5 },
        buildings: [],
        upgrades: [],
        achievements: {}
      }));
    });
    await page.goto(fileUrl);
    await expect(page.locator("#contractsPanel")).toBeVisible();
    await page.locator("#journalTab").click();
    await expect(page.locator("#journalPanel")).toBeVisible();
    await page.locator("#contractsTab").click();
    await expect(page.locator("#contractsPanel")).toBeVisible();
  });
});
