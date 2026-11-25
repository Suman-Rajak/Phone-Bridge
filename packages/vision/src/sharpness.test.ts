import { expect, test } from "vitest";
import { laplacianVariance } from "./sharpness.ts";

test("measures edge contrast and rejects a flat image", () => {
  const width = 5,
    height = 5;
  const data = new Uint8ClampedArray(width * height * 4).fill(30);
  expect(laplacianVariance({ width, height, data })).toBe(0);
  for (let y = 0; y < height; y++) {
    for (let x = 2; x < width; x++) {
      const offset = (y * width + x) * 4;
      data.fill(220, offset, offset + 3);
    }
  }
  expect(laplacianVariance({ width, height, data })).toBeGreaterThan(100);
});
