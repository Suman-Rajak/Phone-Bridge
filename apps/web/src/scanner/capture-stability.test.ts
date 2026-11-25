import { expect, test } from "vitest";
import type { Corners } from "@phonebridge/vision";
import { CaptureStability } from "./capture-stability";

const size = { width: 320, height: 240 };
const quad: Corners = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
];
const slide = (dx: number): Corners =>
  quad.map(({ x, y }) => ({ x: x + dx / size.width, y })) as Corners;

test("requires sharp corners within 1.5 percent of the diagonal for 500 ms", () => {
  const stability = new CaptureStability();
  expect(stability.sample(quad, 100, 0, size)).toBe(false);
  expect(stability.sample(slide(5), 100, 499, size)).toBe(false);
  expect(stability.sample(slide(5), 100, 500, size)).toBe(true);
  expect(stability.sample(slide(7), 100, 510, size)).toBe(false);
  expect(stability.sample(slide(7), 99, 800, size)).toBe(false);
  expect(stability.sample(slide(7), 100, 1_000, size)).toBe(false);
  expect(stability.sample(slide(7), 100, 1_500, size)).toBe(true);
});

test("rearms only after the captured page moves or leaves the camera", () => {
  const stability = new CaptureStability();
  stability.markCaptured(quad);
  expect(stability.sample(quad, 120, 1_000, size)).toBe(false);
  expect(stability.sample(null, 0, 1_100, size)).toBe(false);
  expect(stability.sample(quad, 120, 1_200, size)).toBe(false);
  expect(stability.sample(quad, 120, 1_700, size)).toBe(true);
});
