export type FileHashRequest =
  | { type: "digest"; file: Blob }
  | { type: "verify"; parts: ArrayBuffer[]; expected: string };
export type FileWorkerMessage =
  | Extract<FileHashRequest, { type: "digest" }>
  | { type: "parts"; parts: ArrayBuffer[] }
  | { type: "verify"; expected: string };
export type FileHashResult = { digest: string; file?: Blob };
export type FileHashResponse =
  | { result: FileHashResult }
  | { error: { code: "integrity_failed"; message: string } };

export async function hashFile(
  request: FileHashRequest,
  signal: AbortSignal,
): Promise<FileHashResult> {
  signal.throwIfAborted();
  if (typeof Worker !== "function")
    throw new Error("This browser cannot verify files.");
  const worker = new Worker(new URL("./file-hash-worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise((resolve, reject) => {
      let finished = false;
      function finish() {
        finished = true;
        signal.removeEventListener("abort", aborted);
      }
      function aborted() {
        finish();
        reject(signal.reason);
      }
      function failed() {
        finish();
        reject(new Error("The file could not be verified."));
      }
      signal.addEventListener("abort", aborted, { once: true });
      worker.onerror = failed;
      worker.onmessageerror = failed;
      worker.onmessage = ({ data }: MessageEvent<FileHashResponse>) => {
        finish();
        if ("error" in data) reject(new Error(data.error.message));
        else resolve(data.result);
      };
      async function submit() {
        if (request.type === "digest") {
          worker.postMessage(request);
          return;
        }
        // Yield between small batches so a large transfer list can't monopolize the page.
        const count = 128;
        for (
          let offset = 0;
          offset < request.parts.length && !finished;
          offset += count
        ) {
          const parts = request.parts.slice(offset, offset + count);
          worker.postMessage(
            { type: "parts", parts } satisfies FileWorkerMessage,
            parts,
          );
          if (offset + count < request.parts.length)
            await new Promise((settled) => setTimeout(settled, 0));
        }
        if (!finished)
          worker.postMessage({
            type: "verify",
            expected: request.expected,
          } satisfies FileWorkerMessage);
      }
      void submit().catch(failed);
    });
  } finally {
    worker.terminate();
  }
}
