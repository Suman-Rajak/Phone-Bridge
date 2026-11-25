import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-file-for-fake-video-capture=" +
        fileURLToPath(new URL("./fixtures/page.y4m", import.meta.url)),
    ],
  },
});

test("tray reorders, rotates, edits, retakes and deletes captured pages", async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(150_000);
  await laptop.setViewportSize({ width: 1440, height: 900 });
  await laptop.emulateMedia({ colorScheme: "light" });
  await laptop.goto("/");
  const link = laptop.getByRole("link", { name: "Open pairing link" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  try {
    await context.addInitScript(() => {
      Object.defineProperty(window, "ImageCapture", { value: undefined });
    });
    const phone = await context.newPage();
    await phone.goto((await link.getAttribute("href")) ?? "");
    await phone.getByRole("button", { name: "Start camera" }).click();
    const automatic = phone.getByRole("button", { name: "Auto capture" });
    await automatic.click();
    const shutter = phone.getByRole("button", { name: "Capture page" });
    const pages = laptop
      .getByRole("list", { name: "Scan pages" })
      .getByRole("listitem");
    const image = laptop.getByRole("img", { name: "Scanned document" });
    const ready = laptop.getByRole("button", { name: "Edit corners" });

    await shutter.click();
    await expect(ready).toBeEnabled({ timeout: 30_000 });
    await expect(pages).toHaveCount(1);
    await expect(
      laptop.getByRole("radio", { name: "Clean colour" }),
    ).toBeChecked();
    const first = pages.nth(0).locator("img");
    await expect(first).toHaveAttribute("src", /^blob:/);
    const firstUrl = await first.getAttribute("src");
    await expect(phone.getByText("Scan sent to laptop")).toBeVisible();
    await shutter.click();
    await expect(pages).toHaveCount(2);
    await expect(ready).toBeEnabled({ timeout: 30_000 });
    await pages.nth(0).dragTo(pages.nth(1));
    await expect(pages.nth(1).locator("img")).toHaveAttribute(
      "src",
      firstUrl ?? "",
    );

    const dimensions = await image.evaluate(async (node) => {
      const page = node as HTMLImageElement;
      await page.decode();
      return [page.naturalWidth, page.naturalHeight];
    });
    const beforeTurn = await image.getAttribute("src");
    await laptop.getByRole("button", { name: "Rotate" }).click();
    await expect(image).not.toHaveAttribute("src", beforeTurn ?? "");
    await expect
      .poll(() =>
        image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBe(dimensions[1]);

    const beforeMode = await image.getAttribute("src");
    await laptop.getByText("Black & white", { exact: true }).click();
    await expect(image).not.toHaveAttribute("src", beforeMode ?? "");
    await expect(
      laptop.getByRole("radio", { name: "Black & white" }),
    ).toBeChecked();
    await ready.click();
    const drawer = laptop.getByRole("dialog", { name: "Edit corners" });
    await expect(drawer.getByRole("button", { name: /corner$/ })).toHaveCount(
      4,
    );
    const corner = drawer.getByRole("button", { name: "Top left corner" });
    const prior = await corner.getAttribute("style");
    await corner.press("ArrowRight");
    await expect(corner).not.toHaveAttribute("style", prior ?? "");
    const drawerAxe = await new AxeBuilder({ page: laptop }).analyze();
    expect(
      drawerAxe.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
    const beforeEdit = await image.getAttribute("src");
    await drawer.getByRole("button", { name: "Save corners" }).click();
    await expect(drawer).toHaveCount(0);
    await expect(image).not.toHaveAttribute("src", beforeEdit ?? "", {
      timeout: 30_000,
    });

    for (const device of [laptop, phone]) {
      const { violations } = await new AxeBuilder({ page: device }).analyze();
      expect(
        violations.filter(
          ({ impact }) => impact === "serious" || impact === "critical",
        ),
      ).toEqual([]);
    }
    const evidence = process.env.PLAYWRIGHT_EVIDENCE_DIR;
    if (evidence) {
      await laptop.screenshot({ path: join(evidence, "t10-laptop-tray.png") });
      await phone.screenshot({ path: join(evidence, "t10-phone-scanner.png") });
    }

    const beforeRetake = await image.getAttribute("src");
    await phone.getByRole("button", { name: "Live", exact: true }).click();
    await laptop.getByRole("button", { name: "Retake" }).click();
    await expect(phone.getByText("Retake the page")).toBeVisible();
    await expect(image).toHaveAttribute("src", beforeRetake ?? "");
    await phone.getByRole("button", { name: "Start camera" }).click();
    await automatic.click();
    await shutter.click();
    await expect(image).not.toHaveAttribute("src", beforeRetake ?? "", {
      timeout: 30_000,
    });
    await expect(ready).toBeEnabled({ timeout: 30_000 });
    await expect(pages).toHaveCount(2);
    await laptop.getByRole("button", { name: "Delete" }).click();
    await expect(pages).toHaveCount(1);
    await expect(image).toBeVisible();
    const retained = await image.getAttribute("src");
    await phone.close();
    await expect(
      laptop.getByRole("button", { name: "Reconnect" }),
    ).toBeVisible();
    await expect(image).toHaveAttribute("src", retained ?? "");
  } finally {
    await context.close();
  }
});
