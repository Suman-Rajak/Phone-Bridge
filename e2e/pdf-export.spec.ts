import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPdfPageSizes } from "../packages/pdf/test/read-pdf";

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

test("pdf worker fits five actual JPEG fixtures within 500 KB", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.route("**/pdf-worker-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>PDF worker test</title>",
    }),
  );
  await page.goto("/pdf-worker-test");
  const client = fileURLToPath(
    new URL("../packages/pdf/src/worker-client.ts", import.meta.url),
  );
  const result = await page.evaluate(
    async (modulePath) => {
      const { buildScanPdf } = await import(modulePath);
      const pages: {
        jpeg: Blob;
        width: number;
        height: number;
        a4: boolean;
      }[] = [];
      for (let index = 0; index < 5; index++) {
        const width = 560 + index * 37;
        const height = 740 + index * 23;
        const surface = new OffscreenCanvas(width, height);
        const context = surface.getContext("2d");
        if (!context) throw new Error("Fixture encoder unavailable");
        const pixels = context.createImageData(width, height);
        let seed = 10 + index;
        for (let offset = 0; offset < pixels.data.length; offset += 4) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const luminance = 20 + Math.floor((seed >>> 24) * 0.84);
          pixels.data[offset] = luminance;
          pixels.data[offset + 1] = luminance;
          pixels.data[offset + 2] = luminance;
          pixels.data[offset + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
        pages.push({
          jpeg: await surface.convertToBlob({
            type: "image/jpeg",
            quality: 0.92,
          }),
          width,
          height,
          a4: false,
        });
      }
      const file: Blob = await buildScanPdf(
        { pages, targetBytes: 500_000 },
        new AbortController().signal,
        () => undefined,
      );
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return {
        encoded,
        sizes: pages.map(({ width, height }) => [
          (width * 72) / 200,
          (height * 72) / 200,
        ]),
      };
    },
    "/@fs/" + client.replaceAll("\\", "/"),
  );
  const bytes = Buffer.from(result.encoded, "base64");
  expect(bytes.byteLength).toBeGreaterThanOrEqual(450_000);
  expect(bytes.byteLength).toBeLessThanOrEqual(500_000);
  expect(await readPdfPageSizes(bytes)).toEqual(result.sizes);
  await test.info().attach("five-page PDF byte count", {
    body: String(bytes.byteLength),
    contentType: "text/plain",
  });
});

test("pdf export downloads an ordered scan and shows the exact file size", async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(120_000);
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
    await phone.getByRole("button", { name: "Auto capture" }).click();
    await phone.getByRole("button", { name: "Capture page" }).click();
    const exportPdf = laptop.getByRole("button", {
      name: "Export PDF",
      exact: true,
    });
    await expect(exportPdf).toBeEnabled({ timeout: 30_000 });
    await exportPdf.click();
    const drawer = laptop.getByRole("dialog", { name: "Export PDF" });
    await expect(drawer).toBeVisible();
    const target = drawer.getByLabel("Target size (KB)");
    const create = drawer.getByRole("button", { name: "Create PDF" });
    await target.fill("1");
    await create.click();
    await expect(drawer.getByRole("alert")).toContainText(
      "Choose a larger PDF size",
    );
    await target.fill("50");
    await create.click();
    const downloadLink = drawer.getByRole("link", { name: "Download PDF" });
    await expect(downloadLink).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([
      laptop.waitForEvent("download"),
      downloadLink.click(),
    ]);
    expect(download.suggestedFilename()).toBe("phonebridge-scans.pdf");
    const bytes = await readFile(await download.path());
    expect(bytes.byteLength).toBeLessThanOrEqual(50_000);
    expect(await readPdfPageSizes(bytes)).toHaveLength(1);
    const expected = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 3,
    }).format(bytes.byteLength / 1000);
    await expect(drawer.getByLabel("Final size")).toHaveText(expected + " KB");
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
      await laptop.screenshot({ path: join(evidence, "t11-laptop-pdf.png") });
      await phone.screenshot({ path: join(evidence, "t11-phone-scanner.png") });
    }
  } finally {
    await context.close();
  }
});
