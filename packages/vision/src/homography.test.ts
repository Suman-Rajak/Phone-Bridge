import { expect, test } from "vitest";
import { loadOpenCv } from "./opencv.ts";
import { pageHomography } from "./homography.ts";
import type { Corners } from "./types.ts";

test("inverse texture map matches OpenCV for flat and tilted pages", async () => {
  const cv = await loadOpenCv();
  const square: Corners = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const tilted: Corners = [
    { x: 0.12, y: 0.21 },
    { x: 0.89, y: 0.04 },
    { x: 0.78, y: 0.95 },
    { x: 0.24, y: 0.81 },
  ];
  for (const corners of [square, tilted]) {
    const points = (q: Corners) =>
      cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        q.flatMap((p) => [p.x, p.y]),
      );
    const src = points(square),
      dst = points(corners);
    const expected = cv.getPerspectiveTransform(src, dst);
    try {
      const actual = pageHomography(corners);
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++)
          expect(actual[col * 3 + row]).toBeCloseTo(
            expected.data64F[row * 3 + col],
            6,
          );
    } finally {
      expected.delete();
      dst.delete();
      src.delete();
    }
  }
  expect(() =>
    pageHomography([square[0], square[0], square[2], square[3]]),
  ).toThrow();
});
