import { beforeAll, expect, test } from "vitest";
import { detectDocument } from "./detect.ts";
import { loadOpenCv } from "./opencv.ts";
import type { OpenCvRuntime } from "./opencv.ts";
import { syntheticPage } from "./synthetic-page.ts";

let cv: OpenCvRuntime;
beforeAll(async () => {
  cv = await loadOpenCv();
});

test.each([11, 29, 37, 51, 73, 97])(
  "refines seeded perspective page %i",
  (seed) => {
    const { frame, corners } = syntheticPage(cv, seed);
    const result = detectDocument(cv, frame, "refine");
    expect(result?.fallback).toBe(false);
    const errors = result?.corners.map((point, index) =>
      Math.hypot(point.x - corners[index].x, point.y - corners[index].y),
    );
    expect(Math.max(...errors!)).toBeLessThanOrEqual(2);
  },
);

test("preview output maps back to the source image", () => {
  const { frame, corners } = syntheticPage(cv, 29);
  const result = detectDocument(cv, frame);
  expect(result?.fallback).toBe(false);
  expect(
    result?.corners
      .map((point, index) =>
        Math.hypot(point.x - corners[index].x, point.y - corners[index].y),
      )
      .every((error) => error < 12),
  ).toBe(true);
});

test("uses the largest contour's rectangle for a small region", () => {
  const data = new Uint8ClampedArray(320 * 240 * 4).fill(60);
  for (let y = 70; y < 130; y++) {
    for (let x = 90; x < 155; x++)
      data.fill(245, (y * 320 + x) * 4, (y * 320 + x) * 4 + 3);
  }
  const result = detectDocument(cv, { width: 320, height: 240, data });
  expect(result?.fallback).toBe(true);
  expect(result?.corners[0].x).toBe(88);
});

test("returns no page for a blank image and rejects truncated pixels", () => {
  const data = new Uint8ClampedArray(48 * 32 * 4);
  expect(detectDocument(cv, { width: 48, height: 32, data })).toBeNull();
  expect(() => detectDocument(cv, { width: 49, height: 32, data })).toThrow(
    "RGBA",
  );
});
