import path from "node:path";
import { test, expect } from "@playwright/test";

const htmlPath = path.resolve(__dirname, "../../index.html");

const fileUrl = "file://" + htmlPath.replace(/\\/g, "/");

test.describe("mobile layout", () => {
  test("app remains centered on iPhone 15 Pro Max dimensions", async ({ page }) => {
    await page.goto(fileUrl);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const app = page.locator(".app");
    await expect(app).toBeVisible();
    const box = await app.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const expectedLeft = (viewportWidth - box.width) / 2;
      expect(Math.abs(box.x - expectedLeft)).toBeLessThanOrEqual(2);
      expect(box.width).toBeLessThanOrEqual(viewportWidth);
    }
    const header = page.locator(".app-header");
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    if (headerBox) {
      expect(headerBox.width).toBeGreaterThanOrEqual(viewportWidth - 2);
    }
  });

  test("scene stage is centered and does not overflow", async ({ page }) => {
    await page.goto(fileUrl);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const stage = page.locator("#sceneStage");
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const expectedLeft = (viewportWidth - box.width) / 2;
      expect(Math.abs(box.x - expectedLeft)).toBeLessThanOrEqual(2);
      expect(box.width).toBeLessThanOrEqual(viewportWidth);
    }
  });

  test("click button is not covered by the sticky header after scroll", async ({ page }) => {
    await page.goto(fileUrl);
    const clickButton = page.locator("#clickButton");
    await expect(clickButton).toBeVisible();
    await clickButton.evaluate(el => el.scrollIntoView());
    const buttonBox = await clickButton.boundingBox();
    const headerBox = await page.locator(".app-header").boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    if (buttonBox && headerBox) {
      expect(buttonBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    }
    // The button must actually receive the click (nothing overlapping it).
    await clickButton.click({ trial: true });
  });
});
