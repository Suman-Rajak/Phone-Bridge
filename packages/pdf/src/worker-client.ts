import type { PdfErrorCode, PdfPage } from "./create-pdf.ts";

export type { PdfPage } from "./create-pdf.ts";

export type PdfRequest = { pages: readonly PdfPage[]; targetBytes: number };
type PdfResponse =
  | { progress: number }
  | { file: Blob }
  | { error: { code: PdfErrorCode | "export_failed"; message: string } };

/** Build a PDF off the main thread and release the worker when the job finishes. */
export async function buildScanPdf(
  request: PdfRequest,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<Blob> {
  signal.throwIfAborted();
  if (typeof Worker !== "function") {
    throw new Error("Open PhoneBridge in a browser with PDF export support.");
  }
  const worker = new Worker(new URL("./pdf-worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise((resolve, reject) => {
      function aborted() {
        reject(signal.reason);
      }
      function finish() {
        signal.removeEventListener("abort", aborted);
      }
      function failed() {
        finish();
        reject(new Error("Try creating the PDF again."));
      }
      signal.addEventListener("abort", aborted, { once: true });
      worker.onerror = failed;
      worker.onmessageerror = failed;
      worker.onmessage = ({ data }: MessageEvent<PdfResponse>) => {
        if ("progress" in data) {
          onProgress(data.progress);
        } else {
          finish();
          if ("error" in data) reject(new Error(data.error.message));
          else resolve(data.file);
        }
      };
      try {
        worker.postMessage(request);
      } catch {
        failed();
      }
    });
  } finally {
    worker.terminate();
  }
}
