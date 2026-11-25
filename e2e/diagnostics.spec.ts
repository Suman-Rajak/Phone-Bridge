import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { join } from "node:path";

const views = [
  { name: "laptop", width: 1440, height: 900, colorScheme: "light" },
  { name: "phone", width: 390, height: 844, colorScheme: "dark" },
] as const;

for (const { name, width, height, colorScheme } of views) {
  test(
    "diagnostics reports browser capabilities on " + name,
    async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await page.goto("/diagnostics");
      await expect(
        page.getByRole("heading", { name: "Browser diagnostics" }),
      ).toBeVisible();
      await expect(page.getByText("Secure page")).toBeVisible();
      const table = page.getByRole("table", { name: "Browser capabilities" });
      await expect(table.getByRole("row")).toHaveCount(11);
      await expect(
        table.getByRole("row", { name: "Camera Available" }),
      ).toBeVisible();
      await expect(
        table.getByRole("rowheader", { name: "Clipboard read", exact: false }),
      ).toBeVisible();
      await expect(
        table.getByRole("rowheader", { name: "Clipboard write", exact: false }),
      ).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(
        violations.filter(
          ({ impact }) => impact === "serious" || impact === "critical",
        ),
      ).toEqual([]);

      if (process.env.PLAYWRIGHT_EVIDENCE_DIR) {
        await page.screenshot({
          path: join(
            process.env.PLAYWRIGHT_EVIDENCE_DIR,
            "T02-diagnostics-" + name + ".png",
          ),
          animations: "disabled",
        });
      }
      if (name === "phone") {
        await page.setViewportSize({ width: 360, height });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(360);
      }
      await page.getByRole("link", { name: "PhoneBridge home" }).click();
      await expect(
        page.getByRole("heading", { name: "Connect your phone" }),
      ).toBeVisible();
    },
  );
}

test("diagnostics explains how to enable secure-context checks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", { value: false });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: () => null,
    });
  });
  await page.goto("/diagnostics");

  await expect(page.getByRole("alert")).toContainText(
    "Open this page over HTTPS or on localhost",
  );
  await expect(page.getByRole("cell", { name: "Needs HTTPS" })).toHaveCount(9);
  const webgl = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: /^WebGL2/ }),
  });
  await expect(webgl.getByRole("cell", { name: "Unavailable" })).toBeVisible();
  await expect(webgl).toContainText(
    "Try a browser or device with WebGL2 enabled.",
  );
});
