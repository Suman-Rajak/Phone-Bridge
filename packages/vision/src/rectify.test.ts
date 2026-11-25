import { readFileSync } from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { fixtureCorners, pageFixture, png } from "../test/page-fixture.ts";
import { loadOpenCv } from "./opencv.ts";
import type { OpenCvRuntime } from "./opencv.ts";
import {
  choosePageCorners,
  rectifiedPageSize,
  rectifyPage,
  validPageCorners,
} from "./rectify.ts";
import type { PageMode } from "./rectify.ts";
import type { Corners } from "./types.ts";

let cv: OpenCvRuntime;
beforeAll(async () => {
  cv = await loadOpenCv();
});

const modes: PageMode[] = ["original", "clean", "grayscale", "black-and-white"];
test.each(modes)("matches the %s golden image", (mode) => {
  const result = rectifyPage(cv, pageFixture(), fixtureCorners, mode, 0);
  const golden = readFileSync(
    new URL("../test/golden/" + mode + ".png", import.meta.url),
  );
  expect(png(result).equals(golden)).toBe(true);
});

test("snaps near-A4 pages, caps dimensions, and preserves non-A4 proportions", () => {
  expect(
    rectifiedPageSize([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 5700 },
      { x: 0, y: 5700 },
    ]),
  ).toEqual({ width: 2480, height: 3507, a4: true });
  expect(
    rectifiedPageSize([
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 1500 },
      { x: 0, y: 1500 },
    ]),
  ).toEqual({ width: 2480, height: 1240, a4: false });
  const bowed = [
    fixtureCorners[0],
    fixtureCorners[2],
    fixtureCorners[1],
    fixtureCorners[3],
  ] as Corners;
  expect(validPageCorners(bowed)).toBe(false);
});

test("uses refinement only when all four corners stay within three percent", () => {
  const size = { width: 600, height: 800 };
  const refined = (dx: number) => ({
    corners: fixtureCorners.map(({ x, y }) => ({
      x: x * size.width + dx,
      y: y * size.height,
    })) as Corners,
    fallback: false,
  });
  expect(choosePageCorners(fixtureCorners, refined(20), size)).not.toEqual(
    fixtureCorners,
  );
  expect(choosePageCorners(fixtureCorners, refined(31), size)).toEqual(
    fixtureCorners,
  );
});

test("rectifies four perspective-distorted landmarks within two pixels and rotates the page", () => {
  const width = 170,
    height = 120;
  const outputQuad = [15, 20, 166, 12, 159, 121, 24, 132];
  const points = [
    [30, 26],
    [142, 27],
    [138, 92],
    [28, 93],
  ];
  const source = new cv.Mat(height, width, cv.CV_8UC4);
  source.data.fill(255);
  for (const [x, y] of points) {
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        source.data.set([255, 0, 0, 255], ((y + dy) * width + x + dx) * 4);
      }
    }
  }
  const start = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    width - 1,
    0,
    width - 1,
    height - 1,
    0,
    height - 1,
  ]);
  const end = cv.matFromArray(4, 1, cv.CV_32FC2, outputQuad);
  const transform = cv.getPerspectiveTransform(start, end);
  const warped = new cv.Mat();
  try {
    const camera = { width: 185, height: 149 };
    cv.warpPerspective(
      source,
      warped,
      transform,
      new cv.Size(camera.width, camera.height),
      cv.INTER_CUBIC,
    );
    const corners = outputQuad
      .filter((_, i) => i % 2 === 0)
      .map((x, i) => ({
        x: x / camera.width,
        y: outputQuad[i * 2 + 1] / camera.height,
      })) as Corners;
    const frame = { ...camera, data: new Uint8ClampedArray(warped.data) };
    const result = rectifyPage(cv, frame, corners, "original", 0);
    for (const [x, y] of points) {
      const referenceX = (x / (width - 1)) * (result.width - 1);
      const referenceY = (y / (height - 1)) * (result.height - 1);
      let sumX = 0,
        sumY = 0,
        count = 0;
      for (
        let row = Math.round(referenceY) - 8;
        row <= Math.round(referenceY) + 8;
        row++
      ) {
        for (
          let col = Math.round(referenceX) - 8;
          col <= Math.round(referenceX) + 8;
          col++
        ) {
          const offset = (row * result.width + col) * 4;
          if (
            result.data[offset] > 200 &&
            result.data[offset + 1] < 70 &&
            result.data[offset + 2] < 70
          ) {
            sumX += col;
            sumY += row;
            count++;
          }
        }
      }
      expect(count).toBeGreaterThan(10);
      expect(
        Math.hypot(sumX / count - referenceX, sumY / count - referenceY),
      ).toBeLessThan(2);
    }
    const turned = rectifyPage(cv, frame, corners, "original", 90);
    expect([turned.width, turned.height]).toEqual([
      result.height,
      result.width,
    ]);
  } finally {
    warped.delete();
    transform.delete();
    end.delete();
    start.delete();
    source.delete();
  }
});
