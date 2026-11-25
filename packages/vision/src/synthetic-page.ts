import type { OpenCvRuntime } from "./opencv.ts";
import type { Corners, Frame, Point } from "./types.ts";

export function syntheticPage(
  cv: OpenCvRuntime,
  seed: number,
): { frame: Frame; corners: Corners } {
  let state = seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const jitter = (x: number, y: number): Point => ({
    x: x + (random() - 0.5) * 32,
    y: y + (random() - 0.5) * 32,
  });
  const width = 1000;
  const height = 750;
  const paperWidth = 420;
  const paperHeight = 594;
  const corners: Corners = [
    jitter(200, 90),
    jitter(795, 110),
    jitter(770, 655),
    jitter(185, 630),
  ];
  const paper = new cv.Mat(
    paperHeight,
    paperWidth,
    cv.CV_8UC1,
    new cv.Scalar(228),
  );
  const source = cv.matFromArray(4, 1, cv.CV_32FC2, [
    -0.5,
    -0.5,
    paperWidth - 0.5,
    -0.5,
    paperWidth - 0.5,
    paperHeight - 0.5,
    -0.5,
    paperHeight - 0.5,
  ]);
  const target = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    corners.flatMap(({ x, y }) => [x, y]),
  );
  const warp = cv.getPerspectiveTransform(source, target);
  const canvas = new cv.Mat();

  try {
    for (let row = 0; row < 18; row++) {
      cv.putText(
        paper,
        row === 0 ? "Synthetic document" : "Example text for page detection.",
        new cv.Point(28, 54 + row * 28),
        cv.FONT_HERSHEY_SIMPLEX,
        row === 0 ? 0.85 : 0.55,
        new cv.Scalar(43),
        1,
        cv.LINE_AA,
      );
    }
    cv.warpPerspective(
      paper,
      canvas,
      warp,
      new cv.Size(width, height),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(63),
    );
    cv.GaussianBlur(canvas, canvas, new cv.Size(3, 3), 0);

    const pixels = canvas.data;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < pixels.length; index++) {
      const shadow =
        (19 * (index % width)) / width +
        (6 * Math.floor(index / width)) / height;
      const value = pixels[index] - shadow + (random() - 0.5) * 9;
      data[index * 4] = data[index * 4 + 1] = data[index * 4 + 2] = value;
      data[index * 4 + 3] = 255;
    }
    return { frame: { width, height, data }, corners };
  } finally {
    canvas.delete();
    warp.delete();
    target.delete();
    source.delete();
    paper.delete();
  }
}
