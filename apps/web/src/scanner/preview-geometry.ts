import type { Corners, Detection, Point } from "@phonebridge/vision";

const longestSide = 320;
const alpha = 0.4;

export function previewSize(width: number, height: number) {
  const scale = Math.min(1, longestSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function overlayDetection(
  previous: Detection | null,
  next: Detection,
  { width, height }: { width: number; height: number },
): Detection {
  const corners = next.corners.map(({ x, y }, index): Point => {
    const target = {
      x: Math.min(1, Math.max(0, x / width)),
      y: Math.min(1, Math.max(0, y / height)),
    };
    if (!previous || previous.fallback !== next.fallback) return target;
    const from = previous.corners[index];
    return {
      x: from.x + alpha * (target.x - from.x),
      y: from.y + alpha * (target.y - from.y),
    };
  }) as Corners;
  return { corners, fallback: next.fallback };
}
