import { createPdf, PdfExportError } from "./create-pdf.ts";
import type { JpegEncoder, PdfPage } from "./create-pdf.ts";
import type { PdfRequest } from "./worker-client.ts";

async function openEncoder(page: PdfPage): Promise<JpegEncoder> {
  if (
    typeof createImageBitmap !== "function" ||
    typeof OffscreenCanvas !== "function"
  ) {
    throw new PdfExportError(
      "encoder_unavailable",
      "Open PhoneBridge in a browser with PDF export support.",
    );
  }
  const bitmap = await createImageBitmap(page.jpeg);
  const canvas = new OffscreenCanvas(1, 1);
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.convertToBlob !== "function") {
    bitmap.close();
    throw new PdfExportError(
      "encoder_unavailable",
      "Open PhoneBridge in a browser with PDF export support.",
    );
  }
  let drawn = false;
  return {
    async encode(quality, scale) {
      const width = Math.max(1, Math.floor(bitmap.width * scale));
      const height = Math.max(1, Math.floor(bitmap.height * scale));
      if (!drawn || canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.drawImage(bitmap, 0, 0, width, height);
        drawn = true;
      }
      const image = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (image.type !== "image/jpeg") {
        throw new PdfExportError(
          "encoder_unavailable",
          "Open PhoneBridge in a browser with JPEG export support.",
        );
      }
      return new Uint8Array(await image.arrayBuffer());
    },
    close: () => bitmap.close(),
  };
}

globalThis.onmessage = async ({ data }: MessageEvent<PdfRequest>) => {
  try {
    const bytes = await createPdf(
      data.pages,
      data.targetBytes,
      openEncoder,
      (progress) => globalThis.postMessage({ progress }),
    );
    const file = new Blob([Uint8Array.from(bytes)], {
      type: "application/pdf",
    });
    globalThis.postMessage({ file });
  } catch (error) {
    const details =
      error instanceof PdfExportError
        ? { code: error.code, message: error.message }
        : { code: "export_failed", message: "Try creating the PDF again." };
    globalThis.postMessage({ error: details });
  }
};
