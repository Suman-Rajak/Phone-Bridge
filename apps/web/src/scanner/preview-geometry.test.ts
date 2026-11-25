import { expect, test } from "vitest";
import type { Detection } from "@phonebridge/vision";
import { overlayDetection, previewSize } from "./preview-geometry";

test("caps the preview’s longer side at 320 pixels and preserves orientation", () => {
  expect(previewSize(1920, 1080)).toEqual({ width: 320, height: 180 });
  expect(previewSize(1080, 1920)).toEqual({ width: 180, height: 320 });
  expect(previewSize(160, 90)).toEqual({ width: 160, height: 90 });
});

test("blends four normalized corners with alpha 0.4 and resets on fallback", () => {
  const before: Detection = {
    corners: [
      { x: 0.1, y: 0.1 },
      { x: 0.8, y: 0.1 },
      { x: 0.8, y: 0.8 },
      { x: 0.1, y: 0.8 },
    ],
    fallback: false,
  };
  const target: Detection = {
    corners: [
      { x: 64, y: 48 },
      { x: 256, y: 48 },
      { x: 256, y: 192 },
      { x: 64, y: 192 },
    ],
    fallback: false,
  };
  const size = { width: 320, height: 240 };
  const smoothed = overlayDetection(before, target, size);
  expect(smoothed.corners[0].x).toBeCloseTo(0.14);
  expect(smoothed.corners[0].y).toBeCloseTo(0.14);
  expect(smoothed.corners[2]).toEqual({ x: 0.8, y: 0.8 });
  expect(
    overlayDetection(smoothed, { ...target, fallback: true }, size).corners[0],
  ).toEqual({ x: 0.2, y: 0.2 });
});
