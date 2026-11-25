import type { OpenCvRuntime } from "./opencv.ts";
import type { Corners, Detection, Frame, Point } from "./types.ts";

export type PageMode = "original" | "clean" | "grayscale" | "black-and-white";
export type PageRotation = 0 | 90 | 180 | 270;
export type PageSize = { width: number; height: number; a4: boolean };

const fullPage: Corners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Check that the four normalized corners form a clockwise, nondegenerate quadrilateral. */
export function validPageCorners(corners: Corners): boolean {
  return corners.every((point, index) => {
    if (!(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1))
      return false;
    const next = corners[(index + 1) % 4];
    const after = corners[(index + 2) % 4];
    return (
      (next.x - point.x) * (after.y - next.y) -
        (next.y - point.y) * (after.x - next.x) >
      1e-7
    );
  });
}

/** Prefer a reliable refinement near the phone estimate. Use the full image when neither is usable. */
export function choosePageCorners(
  phone: Corners | undefined,
  refined: Detection | null,
  { width, height }: Pick<Frame, "width" | "height">,
): Corners {
  const previous = phone && validPageCorners(phone) ? phone : undefined;
  const candidate =
    refined && !refined.fallback
      ? (refined.corners.map(({ x, y }) => ({
          x: Math.min(1, Math.max(0, x / width)),
          y: Math.min(1, Math.max(0, y / height)),
        })) as Corners)
      : undefined;
  if (!candidate || !validPageCorners(candidate)) return previous ?? fullPage;
  if (!previous) return candidate;
  const limit = 0.03 * Math.hypot(width, height);
  return candidate.every(
    (point, index) =>
      Math.hypot(
        (point.x - previous[index].x) * width,
        (point.y - previous[index].y) * height,
      ) <= limit,
  )
    ? candidate
    : previous;
}

function length(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** Compute an aspect-preserving page size and snap near-A4 portrait pages. */
export function rectifiedPageSize([tl, tr, br, bl]: Corners): PageSize {
  const width = Math.max(length(tl, tr), length(bl, br));
  const measuredHeight = Math.max(length(tl, bl), length(tr, br));
  const a4Ratio = 1.414;
  const a4 = Math.abs(measuredHeight / width / a4Ratio - 1) <= 0.05;
  const height = a4 ? width * a4Ratio : measuredHeight;
  const scale = Math.min(1, 2480 / width, 3508 / height);
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
    a4,
  };
}

function cleanColour(
  cv: OpenCvRuntime,
  image: InstanceType<OpenCvRuntime["Mat"]>,
): void {
  const small = new cv.Mat();
  const background = new cv.Mat();
  try {
    const smallWidth = Math.max(1, Math.round(image.cols * 0.25));
    const smallHeight = Math.max(1, Math.round(image.rows * 0.25));
    cv.resize(
      image,
      small,
      new cv.Size(smallWidth, smallHeight),
      0,
      0,
      cv.INTER_AREA,
    );
    cv.GaussianBlur(
      small,
      small,
      new cv.Size(0, 0),
      Math.max(0.1, smallWidth * 0.02),
    );
    cv.resize(
      small,
      background,
      new cv.Size(image.cols, image.rows),
      0,
      0,
      cv.INTER_LINEAR,
    );

    const rgba = image.data;
    const reference = background.data;
    let min = Infinity;
    let max = -Infinity;
    for (let pixel = 0; pixel < rgba.length; pixel += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const index = pixel + channel;
        const ratio = rgba[index] / Math.max(1, reference[index]);
        min = Math.min(min, ratio);
        max = Math.max(max, ratio);
      }
    }
    if (max === min) return;
    const scale = 255 / (max - min);
    const totals = [0, 0, 0];
    for (let pixel = 0; pixel < rgba.length; pixel += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const index = pixel + channel;
        rgba[index] = Math.round(
          (rgba[index] / Math.max(1, reference[index]) - min) * scale,
        );
        totals[channel] += rgba[index];
      }
    }
    const gray = (totals[0] + totals[1] + totals[2]) / 3;
    const gains = totals.map((total) => (total > 0 ? gray / total : 1));
    for (let pixel = 0; pixel < rgba.length; pixel += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const index = pixel + channel;
        rgba[index] = Math.min(255, Math.round(rgba[index] * gains[channel]));
      }
    }
  } finally {
    background.delete();
    small.delete();
  }
}

/** Warp and enhance an RGBA page using the OpenCV runtime owned by the caller. */
export function rectifyPage(
  cv: OpenCvRuntime,
  frame: Frame,
  corners: Corners,
  mode: PageMode,
  rotation: PageRotation,
): Frame & { a4: boolean } {
  if (!validPageCorners(corners))
    throw new RangeError("The page corners must form a quadrilateral.");
  const pixels = corners.map(({ x, y }) => ({
    x: Math.min(frame.width - 1, x * frame.width),
    y: Math.min(frame.height - 1, y * frame.height),
  })) as Corners;
  const { width, height, a4 } = rectifiedPageSize(pixels);
  const source = new cv.Mat(frame.height, frame.width, cv.CV_8UC4);
  const inputQuad = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    pixels.flatMap(({ x, y }) => [x, y]),
  );
  const outputQuad = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    width - 1,
    0,
    width - 1,
    height - 1,
    0,
    height - 1,
  ]);
  const transform = cv.getPerspectiveTransform(inputQuad, outputQuad);
  const output = new cv.Mat();
  const gray = new cv.Mat();
  const rotated = new cv.Mat();
  try {
    source.data.set(frame.data);
    cv.warpPerspective(
      source,
      output,
      transform,
      new cv.Size(width, height),
      cv.INTER_CUBIC,
      cv.BORDER_REPLICATE,
    );
    if (mode !== "original") cleanColour(cv, output);
    if (mode === "grayscale" || mode === "black-and-white") {
      cv.cvtColor(output, gray, cv.COLOR_RGBA2GRAY);
      if (mode === "black-and-white") {
        const blockSize = Math.max(
          3,
          Math.round((width * 0.015 - 1) / 2) * 2 + 1,
        );
        cv.adaptiveThreshold(
          gray,
          gray,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          blockSize,
          10,
        );
      }
      cv.cvtColor(gray, output, cv.COLOR_GRAY2RGBA);
    }
    let result = output;
    if (rotation) {
      const direction =
        rotation === 90
          ? cv.ROTATE_90_CLOCKWISE
          : rotation === 180
            ? cv.ROTATE_180
            : cv.ROTATE_90_COUNTERCLOCKWISE;
      cv.rotate(output, rotated, direction);
      result = rotated;
    }
    return {
      width: result.cols,
      height: result.rows,
      a4,
      data: new Uint8ClampedArray(result.data),
    };
  } finally {
    rotated.delete();
    gray.delete();
    output.delete();
    transform.delete();
    outputQuad.delete();
    inputQuad.delete();
    source.delete();
  }
}
