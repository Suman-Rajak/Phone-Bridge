import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type CaptureTestWindow = Window & {
  declaredScan?: { sha256: string; width: number; height: number };
  alterScanHash?: boolean;
};

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

test("scan-capture delivers automatic and manual scans and rejects a mismatched hash", async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(90_000);
  await laptop.setViewportSize({ width: 1440, height: 900 });
  await laptop.emulateMedia({ colorScheme: "light" });
  await laptop.goto("/");
  const link = laptop.getByRole("link", { name: "Open pairing link" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const url = (await link.getAttribute("href")) ?? "";
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  try {
    await context.addInitScript(() => {
      Object.defineProperty(window, "ImageCapture", { value: undefined });
      const original = RTCDataChannel.prototype.send;
      const state = window as CaptureTestWindow;
      let dimensions = { width: 0, height: 0 };
      RTCDataChannel.prototype.send = function (
        data: string | Blob | ArrayBuffer | ArrayBufferView,
      ) {
        if (this.label === "control" && typeof data === "string") {
          const message = JSON.parse(data);
          if (message.type === "scan.meta")
            dimensions = { width: message.width, height: message.height };
          if (message.type === "file.done") {
            state.declaredScan = { sha256: message.sha256, ...dimensions };
            if (state.alterScanHash) {
              message.sha256 =
                (message.sha256[0] === "0" ? "1" : "0") +
                message.sha256.slice(1);
              data = JSON.stringify(message);
            }
          }
        }
        Reflect.apply(original, this, [data]);
      };
    });
    const phone = await context.newPage();
    await phone.goto(url);
    await expect(laptop.getByText("Waiting for a scan")).toBeVisible({
      timeout: 15_000,
    });
    await phone.getByRole("button", { name: "Start camera" }).click();
    const received = laptop.getByRole("img", { name: "Scanned document" });
    await expect(received).toBeVisible({ timeout: 30_000 });
    await expect(phone.getByText("Scan sent to laptop")).toBeVisible();
    const autoCapture = phone.getByRole("button", { name: "Auto capture" });
    await expect(autoCapture).toHaveAttribute("aria-pressed", "true");
    await autoCapture.click();
    const first = await received.getAttribute("src");
    const shutter = phone.getByRole("button", { name: "Capture page" });
    await shutter.click();
    await expect(received).not.toHaveAttribute("src", first ?? "");
    await expect(phone.getByText("Scan sent to laptop")).toBeVisible();

    await laptop.getByRole("button", { name: "Edit corners" }).click();
    const editor = laptop.getByRole("dialog", { name: "Edit corners" });
    const actual = await editor
      .getByRole("img", { name: "Original scan" })
      .evaluate(async (node) => {
        const image = node as HTMLImageElement;
        await image.decode();
        const bytes = await (await fetch(image.src)).arrayBuffer();
        const digest = new Uint8Array(
          await crypto.subtle.digest("SHA-256", bytes),
        );
        return {
          width: image.naturalWidth,
          height: image.naturalHeight,
          sha256: Array.from(digest, (value) =>
            value.toString(16).padStart(2, "0"),
          ).join(""),
        };
      });
    expect(actual).toEqual(
      await phone.evaluate(() => (window as CaptureTestWindow).declaredScan),
    );
    await editor.getByRole("button", { name: "Close Edit corners" }).click();

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
      await laptop.screenshot({ path: join(evidence, "t09-laptop-scan.png") });
      await phone.screenshot({ path: join(evidence, "t09-phone-capture.png") });
    }

    const verified = await received.getAttribute("src");
    await phone.evaluate(() => {
      (window as CaptureTestWindow).alterScanHash = true;
    });
    await shutter.click();
    await expect(laptop.getByRole("alert")).toContainText(
      "Scan couldn’t be received",
    );
    await expect(received).toHaveAttribute("src", verified ?? "");
    await expect(phone.getByRole("alert")).toContainText(
      "Scan couldn’t be sent",
    );
  } finally {
    await context.close();
  }
});
