import type {
  ScanMediaRequest,
  ScanMediaResponse,
  ScanMediaResult,
} from "./scan-media";

export async function runScanMedia(
  request: ScanMediaRequest,
  signal: AbortSignal,
): Promise<ScanMediaResult> {
  signal.throwIfAborted();
  if (typeof Worker !== "function")
    throw new Error("This browser cannot prepare a scan.");
  const worker = new Worker(
    new URL("./scan-media-worker.ts", import.meta.url),
    { type: "module" },
  );
  try {
    return await new Promise((resolve, reject) => {
      function aborted() {
        reject(signal.reason);
      }
      signal.addEventListener("abort", aborted, { once: true });
      worker.onmessage = ({ data }: MessageEvent<ScanMediaResponse>) => {
        signal.removeEventListener("abort", aborted);
        if ("error" in data) reject(new Error(data.error.message));
        else resolve(data.result);
      };
      function failed() {
        signal.removeEventListener("abort", aborted);
        reject(new Error("The scan could not be processed."));
      }
      worker.onerror = failed;
      worker.onmessageerror = failed;
      try {
        const transfer =
          request.type === "verify"
            ? request.parts
            : request.type === "encode" && !(request.source instanceof Blob)
              ? [request.source]
              : [];
        worker.postMessage(request, transfer);
      } catch {
        failed();
      }
    });
  } finally {
    worker.terminate();
  }
}
