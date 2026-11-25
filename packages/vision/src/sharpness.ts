import type { Frame } from "./types.ts";

/** Measure the variance of the four-neighbor Laplacian over a grayscale frame. */
export function laplacianVariance({ width, height, data }: Frame): number {
  if (width < 3 || height < 3) return 0;
  const gray = new Uint8Array(width * height);
  for (let pixel = 0; pixel < gray.length; pixel++) {
    const offset = pixel * 4;
    gray[pixel] =
      (77 * data[offset] +
        150 * data[offset + 1] +
        29 * data[offset + 2] +
        128) >>
      8;
  }
  let sum = 0;
  let squares = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const laplacian =
        gray[index - width] +
        gray[index - 1] +
        gray[index + 1] +
        gray[index + width] -
        4 * gray[index];
      sum += laplacian;
      squares += laplacian * laplacian;
    }
  }
  const pixels = (width - 2) * (height - 2);
  return squares / pixels - (sum / pixels) ** 2;
}
