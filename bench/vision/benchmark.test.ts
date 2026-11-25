import { expect, test } from "vitest";
import type { Corners } from "../../packages/vision/src/types.ts";
import { polygonIoU } from "./polygon-iou.ts";
import { parseGroundTruth } from "./smartdoc.ts";

function square(x: number, side: number): Corners {
  return [
    { x, y: 0 },
    { x: x + side, y: 0 },
    { x: x + side, y: side },
    { x, y: side },
  ];
}

test("scores identical, overlapping, contained, and disjoint convex polygons", () => {
  const left = square(0, 4);
  expect(polygonIoU(left, square(0, 4))).toBe(1);
  expect(polygonIoU(left, square(2, 4))).toBeCloseTo(1 / 3);
  expect(polygonIoU(left, square(1, 2))).toBe(0.25);
  expect(polygonIoU(left, square(6, 4))).toBe(0);
  const [a, b, c, d] = square(2, 4);
  expect(polygonIoU(left, [d, c, b, a])).toBeCloseTo(1 / 3);
});

test("reads one-based annotated frame indices and orders named corners", () => {
  const data = parseGroundTruth(`
    <ground_truth>
      <source_sample_file>background01/example.mp4</source_sample_file>
      <segmentation_results>
        <frame index="1" rejected="true"/>
        <frame rejected='false' index='3'>
          <point name="bl" x="1" y="2"/>
          <point x="1" name="tl" y="0"/>
          <point name="br" x="3" y="2"/>
          <point name="tr" x="3" y="0"/>
        </frame>
      </segmentation_results>
    </ground_truth>
  `);
  expect(data).toEqual({
    video: "background01/example.mp4",
    frames: [{ index: 3, corners: square(1, 2) }],
  });
});

test("rejects incomplete annotated frames", () => {
  expect(() =>
    parseGroundTruth(`
    <ground_truth>
      <source_sample_file>example.mp4</source_sample_file>
      <frame index="1" rejected="false"><point name="tl" x="1" y="0"/></frame>
    </ground_truth>
  `),
  ).toThrow("Invalid annotated SmartDoc frame 1");
});
