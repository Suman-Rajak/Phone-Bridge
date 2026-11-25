import { PageSizes, PDFDocument } from "pdf-lib";

export type PdfPage = {
  jpeg: Blob;
  width: number;
  height: number;
  a4: boolean;
};

export type JpegEncoder = {
  encode(quality: number, scale: number): Promise<Uint8Array>;
  close(): void;
};

type OpenEncoder = (page: PdfPage) => Promise<JpegEncoder>;
export type PdfErrorCode =
  "no_pages" | "invalid_target" | "target_too_small" | "encoder_unavailable";

export class PdfExportError extends Error {
  constructor(
    readonly code: PdfErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const overheadPerPage = 4_000;
const minQuality = 0.35;
const maxQuality = 0.95;
const scaleStep = 0.85;

/** Return PDF points, keeping the written page size independent of image downscaling. */
export function pdfPageSize({ width, height, a4 }: PdfPage): [number, number] {
  if (!a4) return [(width * 72) / 200, (height * 72) / 200];
  return width > height
    ? [PageSizes.A4[1], PageSizes.A4[0]]
    : [...PageSizes.A4];
}

function targetTooSmall() {
  return new PdfExportError(
    "target_too_small",
    "Choose a larger PDF size and try again.",
  );
}

async function withEncoder<T>(
  page: PdfPage,
  open: OpenEncoder,
  operation: (encoder: JpegEncoder) => Promise<T>,
): Promise<T> {
  const encoder = await open(page);
  try {
    return await operation(encoder);
  } finally {
    encoder.close();
  }
}

async function encodeWithin(
  page: PdfPage,
  budget: number,
  open: OpenEncoder,
): Promise<Uint8Array> {
  if (budget <= 0) throw targetTooSmall();
  return withEncoder(page, open, async (encoder) => {
    for (let scale = 1; ; scale *= scaleStep) {
      let best = await encoder.encode(minQuality, scale);
      if (best.byteLength > budget) {
        if (Math.floor(Math.max(page.width, page.height) * scale) <= 1)
          throw targetTooSmall();
        continue;
      }
      const top = await encoder.encode(maxQuality, scale);
      if (top.byteLength <= budget) return top;
      let low = minQuality;
      let high = maxQuality;
      for (let attempt = 0; attempt < 8; attempt++) {
        const quality = (low + high) / 2;
        const encoded = await encoder.encode(quality, scale);
        if (encoded.byteLength <= budget) {
          low = quality;
          best = encoded;
        } else {
          high = quality;
        }
      }
      return best;
    }
  });
}

async function assemble(
  pages: readonly PdfPage[],
  images: readonly Uint8Array[],
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages.length; index++) {
    const [width, height] = pdfPageSize(pages[index]);
    const page = document.addPage([width, height]);
    const jpeg = await document.embedJpg(images[index]);
    page.drawImage(jpeg, { x: 0, y: 0, width, height });
  }
  return document.save();
}

/** Create an ordered scan PDF whose serialized length fits the requested byte limit. */
export async function createPdf(
  pages: readonly PdfPage[],
  targetBytes: number,
  open: OpenEncoder,
  progress: (percent: number) => void = () => undefined,
): Promise<Uint8Array> {
  if (!pages.length)
    throw new PdfExportError(
      "no_pages",
      "Capture a page before creating a PDF.",
    );
  if (!Number.isSafeInteger(targetBytes) || targetBytes <= 0) {
    throw new PdfExportError("invalid_target", "Enter a positive size in KB.");
  }
  const available = targetBytes - overheadPerPage * pages.length;
  if (available <= 0) throw targetTooSmall();

  const weights: number[] = [];
  for (const page of pages) {
    weights.push(
      await withEncoder(
        page,
        open,
        async (encoder) => (await encoder.encode(0.8, 1)).byteLength,
      ),
    );
    progress(Math.round((25 * weights.length) / pages.length));
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const budgets = weights.map((weight) =>
    Math.floor((available * weight) / totalWeight),
  );
  const images: Uint8Array[] = [];
  for (let index = 0; index < pages.length; index++) {
    images.push(await encodeWithin(pages[index], budgets[index], open));
    progress(Math.round(25 + (65 * images.length) / pages.length));
  }

  let bytes = await assemble(pages, images);
  while (bytes.byteLength > targetBytes) {
    let largest = 0;
    for (let index = 1; index < images.length; index++) {
      if (images[index].byteLength > images[largest].byteLength)
        largest = index;
    }
    budgets[largest] = Math.floor(budgets[largest] * 0.9);
    images[largest] = await encodeWithin(
      pages[largest],
      budgets[largest],
      open,
    );
    bytes = await assemble(pages, images);
  }
  progress(100);
  return bytes;
}
