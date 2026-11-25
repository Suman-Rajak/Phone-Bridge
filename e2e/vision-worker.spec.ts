import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import type { VisionResponse } from "../packages/vision/src/worker-client.ts";

test("vision worker detects a page in Chromium", async ({ page }) => {
  // A bare document avoids Vite's app HMR client reloading the test during dependency discovery.
  await page.route("**/vision-worker-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Vision worker test</title>",
    }),
  );
  await page.goto("/vision-worker-test");
  const client = fileURLToPath(
    new URL("../packages/vision/src/worker-client.ts", import.meta.url),
  );
  const response = await page.evaluate(
    async (workerModule) => {
      const { createVisionWorker } = await import(workerModule);
      const worker: Worker = createVisionWorker();
      const width = 320;
      const height = 240;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4;
          data.fill(
            x >= 55 && x < 263 && y >= 37 && y < 203 ? 247 : 62,
            offset,
            offset + 3,
          );
          data[offset + 3] = 255;
        }
      }
      try {
        return await new Promise<VisionResponse>((resolve, reject) => {
          worker.addEventListener("message", (event) => resolve(event.data), {
            once: true,
          });
          worker.addEventListener(
            "error",
            (event) =>
              reject(new Error(event.message || "Vision worker failed")),
            { once: true },
          );
          worker.postMessage(
            { id: 1, mode: "preview", frame: { width, height, data } },
            [data.buffer],
          );
        });
      } finally {
        worker.terminate();
      }
    },
    "/@fs/" + client.replaceAll("\\", "/"),
  );

  expect(response).toMatchObject({ id: 1, detection: { fallback: false } });
  if (!("detection" in response) || !response.detection)
    throw new Error("No page detected");
  expect(
    Math.hypot(
      response.detection.corners[0].x - 55,
      response.detection.corners[0].y - 37,
    ),
  ).toBeLessThan(4);
});
