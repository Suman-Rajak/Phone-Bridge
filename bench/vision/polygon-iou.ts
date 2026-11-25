import type { Corners, Point } from "../../packages/vision/src/types.ts";

function signedArea(points: readonly Point[]): number {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - point.y * next.x;
    }, 0) / 2
  );
}

/** Compute intersection over union for two convex, cyclically ordered quadrilaterals. */
export function polygonIoU(left: Corners, right: Corners): number {
  const orientation = Math.sign(signedArea(right));
  const areaLeft = Math.abs(signedArea(left));
  const areaRight = Math.abs(signedArea(right));
  if (areaLeft === 0 || areaRight === 0) return 0;

  // Clip the first quadrilateral to each interior half-plane of the second.
  let polygon: readonly Point[] = left;
  for (let edge = 0; edge < right.length && polygon.length > 0; edge++) {
    const a = right[edge];
    const b = right[(edge + 1) % right.length];
    const side = (point: Point) =>
      orientation *
      ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x));
    const output: Point[] = [];
    let previous = polygon[polygon.length - 1];
    let previousSide = side(previous);
    for (const point of polygon) {
      const currentSide = side(point);
      if (previousSide < 0 !== currentSide < 0) {
        const fraction = previousSide / (previousSide - currentSide);
        output.push({
          x: previous.x + (point.x - previous.x) * fraction,
          y: previous.y + (point.y - previous.y) * fraction,
        });
      }
      if (currentSide >= 0) output.push(point);
      previous = point;
      previousSide = currentSide;
    }
    polygon = output;
  }

  const intersection = Math.min(
    areaLeft,
    areaRight,
    Math.abs(signedArea(polygon)),
  );
  return intersection / (areaLeft + areaRight - intersection);
}
