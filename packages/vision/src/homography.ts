import type { Corners } from "./types.ts";
import { validPageCorners } from "./rectify.ts";

/** Map normalized output coordinates onto the source page, in WebGL column-major order. */
export function pageHomography(corners: Corners): Float32Array {
  if (!validPageCorners(corners)) throw new RangeError("Invalid page corners");
  const [a, b, c, d] = corners;
  // The projected fourth corner fixes the two perspective coefficients.
  const dx1 = b.x - c.x,
    dx2 = d.x - c.x,
    dy1 = b.y - c.y,
    dy2 = d.y - c.y;
  const sx = a.x - b.x + c.x - d.x,
    sy = a.y - b.y + c.y - d.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / determinant;
  const h = (dx1 * sy - sx * dy1) / determinant;
  return new Float32Array([
    b.x - a.x + g * b.x,
    b.y - a.y + g * b.y,
    g,
    d.x - a.x + h * d.x,
    d.y - a.y + h * d.y,
    h,
    a.x,
    a.y,
    1,
  ]);
}
