import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--enable-unsafe-swiftshader",
      "--use-file-for-fake-video-capture=" +
        fileURLToPath(new URL("./fixtures/page.y4m", import.meta.url)),
    ],
  },
});
test("doccam shares and flattens a page, handles graphics loss, and releases the camera", async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(90_000);
  await laptop.setViewportSize({ width: 1440, height: 900 });
  await laptop.goto("/");
  const link = laptop.getByRole("link", { name: "Open pairing link" });
  await expect(link).toBeVisible({ timeout: 15000 });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  try {
    const page = await phone.newPage();
    await page.goto((await link.getAttribute("href"))!);
    await page.getByRole("button", { name: "Live", exact: true }).click();
    await page.getByRole("button", { name: "Share live camera" }).click();
    await expect(laptop.getByText("Page flattened")).toBeVisible({
      timeout: 35000,
    });
    const canvas = laptop.getByRole("img", { name: "Flattened live page" });
    const image = await canvas.screenshot();
    const measurements = await laptop.evaluate(async (base64) => {
      const source =
        document.querySelector<HTMLVideoElement>(".live-page video")!;
      const picture = new Image();
      picture.src = "data:image/png;base64," + base64;
      await picture.decode();
      function sample(input: CanvasImageSource) {
        const surface = document.createElement("canvas");
        surface.width = surface.height = 100;
        const ctx = surface.getContext("2d")!;
        ctx.drawImage(input, 0, 0, 100, 100);
        return ctx.getImageData(5, 5, 1, 1).data[0];
      }
      return { raw: sample(source), flattened: sample(picture) };
    }, image.toString("base64"));
    expect(measurements.flattened).toBeGreaterThan(measurements.raw + 60);
    for (const device of [laptop, page]) {
      const { violations } = await new AxeBuilder({ page: device }).analyze();
      expect(
        violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
    }
    if (process.env.PLAYWRIGHT_EVIDENCE_DIR) {
      await laptop.screenshot({
        path: join(process.env.PLAYWRIGHT_EVIDENCE_DIR, "t16-laptop.png"),
      });
      await page.screenshot({
        path: join(process.env.PLAYWRIGHT_EVIDENCE_DIR, "t16-phone.png"),
      });
    }
    await page.setViewportSize({ width: 360, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
    const lost = await canvas.evaluate((node) => {
      const ext = (node as HTMLCanvasElement)
        .getContext("webgl2")
        ?.getExtension("WEBGL_lose_context");
      ext?.loseContext();
      return Boolean(ext);
    });
    if (lost) await expect(laptop.getByLabel("Live camera view")).toBeVisible();
    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(laptop.getByText("Waiting for a scan")).toBeVisible({
      timeout: 15000,
    });
  } finally {
    await phone.close();
  }
});
