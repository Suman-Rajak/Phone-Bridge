import type { OpenCvRuntime } from "./opencv.ts";
import type {
  Corners,
  Detection,
  DetectionMode,
  Frame,
  Point,
} from "./types.ts";

const longestSide = { preview: 320, refine: 1000 };

function medianIntensity(pixels: Uint8Array): number {
  const counts = new Uint32Array(256);
  for (const intensity of pixels) counts[intensity]++;

  const lower = Math.floor((pixels.length - 1) / 2);
  const upper = Math.floor(pixels.length / 2);
  let seen = 0;
  let lowIntensity = 0;
  for (let intensity = 0; intensity < counts.length; intensity++) {
    if (seen <= lower) lowIntensity = intensity;
    seen += counts[intensity];
    if (seen > upper) return (lowIntensity + intensity) / 2;
  }
  return 0;
}

function orderCorners(points: readonly Point[]): Corners {
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / 4;
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / 4;
  const angle = (point: Point) =>
    Math.atan2(point.y - centerY, point.x - centerX);
  const clockwise = [...points].sort((a, b) => angle(a) - angle(b));
  const topLeft = clockwise.reduce((best, point, index) => {
    const current = clockwise[best];
    const difference = point.x + point.y - current.x - current.y;
    return difference < 0 || (difference === 0 && point.y < current.y)
      ? index
      : best;
  }, 0);

  return [
    clockwise[topLeft],
    clockwise[(topLeft + 1) % 4],
    clockwise[(topLeft + 2) % 4],
    clockwise[(topLeft + 3) % 4],
  ];
}

/** Detect a page in an RGBA frame and return its corners in source-image pixels. */
export function detectDocument(
  cv: OpenCvRuntime,
  frame: Frame,
  mode: DetectionMode = "preview",
): Detection | null {
  const { width, height, data } = frame;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    data.length !== width * height * 4
  ) {
    throw new Error("A vision frame must contain width × height RGBA pixels.");
  }

  const scale = Math.min(1, longestSide[mode] / Math.max(width, height));
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  const rgba = new cv.Mat(height, width, cv.CV_8UC4);
  const scaled = new cv.Mat();
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const approximation = new cv.Mat();

  try {
    rgba.data.set(data);
    if (scale < 1) {
      cv.resize(
        rgba,
        scaled,
        new cv.Size(scaledWidth, scaledHeight),
        0,
        0,
        cv.INTER_AREA,
      );
    }
    cv.cvtColor(scale < 1 ? scaled : rgba, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    const median = medianIntensity(gray.data);
    cv.Canny(gray, edges, 0.67 * median, 1.33 * median);
    cv.dilate(edges, edges, kernel);
    cv.findContours(
      edges,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    );

    const ranked: { index: number; area: number }[] = [];
    for (let index = 0; index < contours.size(); index++) {
      const contour = contours.get(index);
      try {
        ranked.push({ index, area: cv.contourArea(contour) });
      } finally {
        contour.delete();
      }
    }
    ranked.sort((a, b) => b.area - a.area);
    if (ranked.length === 0) return null;

    let best: { points: Corners; score: number } | undefined;
    const minimumArea = 0.2 * scaledWidth * scaledHeight;
    for (const { index } of ranked.slice(0, 5)) {
      const contour = contours.get(index);
      try {
        cv.approxPolyDP(
          contour,
          approximation,
          0.02 * cv.arcLength(contour, true),
          true,
        );
        if (approximation.rows !== 4 || !cv.isContourConvex(approximation))
          continue;

        const area = cv.contourArea(approximation);
        if (area < minimumArea) continue;
        const { size } = cv.minAreaRect(approximation);
        const score = area * (area / (size.width * size.height));
        if (!best || score > best.score) {
          const points = approximation.data32S;
          best = {
            points: [0, 2, 4, 6].map((offset) => ({
              x: points[offset],
              y: points[offset + 1],
            })) as Corners,
            score,
          };
        }
      } finally {
        contour.delete();
      }
    }

    let points: readonly Point[];
    if (best) {
      points = best.points;
    } else {
      const contour = contours.get(ranked[0].index);
      try {
        const rectangle = cv.minAreaRect(contour);
        if (rectangle.size.width === 0 || rectangle.size.height === 0)
          return null;
        points = cv.RotatedRect.points(rectangle);
      } finally {
        contour.delete();
      }
    }

    return {
      corners: orderCorners(
        points.map(({ x, y }) => ({
          x: (x * width) / scaledWidth,
          y: (y * height) / scaledHeight,
        })),
      ),
      fallback: !best,
    };
  } finally {
    approximation.delete();
    hierarchy.delete();
    contours.delete();
    kernel.delete();
    edges.delete();
    gray.delete();
    scaled.delete();
    rgba.delete();
  }
}
