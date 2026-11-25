import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const fakeCamera = fileURLToPath(
  new URL("./fixtures/page.y4m", import.meta.url),
);

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-file-for-fake-video-capture=" + fakeCamera,
    ],
  },
});

test("scan-detect locks onto a page and releases the camera when changing tools", async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(60_000);
  await laptop.setViewportSize({ width: 1440, height: 900 });
  await laptop.emulateMedia({ colorScheme: "light" });
  await laptop.goto("/");
  const link = laptop.getByRole("link", { name: "Open pairing link" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const url = new URL((await link.getAttribute("href")) ?? "");
  url.searchParams.set("debug", "1");
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  try {
    const phone = await phoneContext.newPage();
    await phone.emulateMedia({ colorScheme: "dark" });
    await phone.goto(url.href);
    const start = phone.getByRole("button", { name: "Start camera" });
    await expect(start).toBeVisible({ timeout: 15_000 });

    const timing = await phone.evaluateHandle(() => {
      const tasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        tasks.push(...list.getEntries().map((entry) => entry.duration));
      });
      observer.observe({ type: "longtask" });
      return { tasks, observer };
    });

    await start.click();
    await phone.getByRole("button", { name: "Auto capture" }).click();
    await expect(
      phone.getByText("Document detected", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    const polygon = phone.locator('[data-detection="locked"] polygon');
    await expect(polygon).toBeVisible();
    expect((await polygon.getAttribute("points"))?.split(" ")).toHaveLength(4);
    await expect(phone.getByLabel("Detection frame rate")).toHaveText(
      /^[1-9]\d* fps$/,
    );
    const longTasks = await timing.evaluate(({ tasks, observer }) => {
      observer.disconnect();
      return tasks;
    });
    expect(longTasks.filter((duration) => duration > 50)).toEqual([]);
    await timing.dispose();

    for (const device of [laptop, phone]) {
      const { violations } = await new AxeBuilder({ page: device }).analyze();
      expect(
        violations.filter(
          ({ impact }) => impact === "serious" || impact === "critical",
        ),
      ).toEqual([]);
    }

    if (process.env.PLAYWRIGHT_EVIDENCE_DIR) {
      await laptop.screenshot({
        path: join(
          process.env.PLAYWRIGHT_EVIDENCE_DIR,
          "t08-laptop-paired.png",
        ),
      });
      await phone.screenshot({
        path: join(process.env.PLAYWRIGHT_EVIDENCE_DIR, "t08-scan-detect.png"),
      });
    }

    await phone.setViewportSize({ width: 360, height: 844 });
    await expect
      .poll(() =>
        phone.evaluate(() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
        })),
      )
      .toEqual({ viewport: 360, document: 360 });

    const track = await phone
      .locator("video")
      .evaluateHandle(
        (video) =>
          (
            (video as HTMLVideoElement).srcObject as MediaStream
          ).getVideoTracks()[0],
      );
    await phone.getByRole("button", { name: "Live", exact: true }).click();
    await expect(phone.locator("video")).toHaveCount(0);
    await expect
      .poll(() => track.evaluate((camera) => camera.readyState))
      .toBe("ended");
    await track.dispose();

    await phone.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: () =>
          Promise.reject(
            new DOMException("Camera access denied", "NotAllowedError"),
          ),
      });
    });
    await phone.getByRole("button", { name: "Scan", exact: true }).click();
    await phone.getByRole("button", { name: "Start camera" }).click();
    await expect(phone.getByRole("alert")).toContainText(
      "Allow camera access in your browser and try again.",
    );
  } finally {
    await phoneContext.close();
  }
});
