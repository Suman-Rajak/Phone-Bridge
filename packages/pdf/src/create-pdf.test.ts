import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { readPdfPageSizes } from "../test/read-pdf.ts";
import { createPdf, pdfPageSize } from "./create-pdf.ts";
import type { JpegEncoder, PdfPage } from "./create-pdf.ts";

const original = readFileSync(new URL("../test/blank.jpg", import.meta.url));

function sizedJpeg(length: number): Uint8Array {
  let remaining = Math.max(0, length - original.byteLength);
  const segments = [original.subarray(0, 2)];
  while (remaining >= 4) {
    const segment = Buffer.alloc(Math.min(65_537, remaining));
    segment.writeUInt16BE(0xfffe, 0);
    segment.writeUInt16BE(segment.byteLength - 2, 2);
    segments.push(segment);
    remaining -= segment.byteLength;
  }
  segments.push(original.subarray(2));
  return Buffer.concat(segments);
}

function page(width: number, height: number, a4 = false): PdfPage {
  return {
    jpeg: new Blob([original], { type: "image/jpeg" }),
    width,
    height,
    a4,
  };
}

function simulatedEncoder(
  complexity: number,
  onEncode: (quality: number, scale: number) => void = () => undefined,
): JpegEncoder {
  return {
    async encode(quality, scale) {
      onEncode(quality, scale);
      const length = Math.round(complexity * scale * scale * (0.2 + quality));
      return sizedJpeg(length);
    },
    close() {},
  };
}

test("pdf packs five weighted pages between 450 and 500 KB in tray order", async () => {
  const pages = [
    page(640, 900, true),
    page(680, 830),
    page(900, 640, true),
    page(730, 1000),
    page(650, 870),
  ];
  const bytes = await createPdf(pages, 500_000, async (input) =>
    simulatedEncoder(input.width * 160),
  );
  expect(bytes.byteLength).toBeGreaterThanOrEqual(450_000);
  expect(bytes.byteLength).toBeLessThanOrEqual(500_000);
  expect(await readPdfPageSizes(bytes)).toEqual(pages.map(pdfPageSize));
});

test("pdf downscales when minimum quality alone exceeds the budget", async () => {
  const attempted: { quality: number; scale: number }[] = [];
  const input = page(1000, 1800);
  const result = await createPdf([input], 25_000, async () =>
    simulatedEncoder(480_000, (quality, scale) =>
      attempted.push({ quality, scale }),
    ),
  );
  expect(attempted).toContainEqual({ quality: 0.35, scale: 1 });
  expect(attempted).toContainEqual({ quality: 0.35, scale: 0.85 });
  expect(result.byteLength).toBeLessThanOrEqual(25_000);
  expect(await readPdfPageSizes(result)).toEqual([pdfPageSize(input)]);
});

test("pdf reports when the chosen byte budget is too small", async () => {
  await expect(
    createPdf([page(100, 100)], 4_001, async () => simulatedEncoder(20_000)),
  ).rejects.toMatchObject({ code: "target_too_small" });
});
