import { sha256 } from "../worker/sha256";
import type { FileHashResponse, FileWorkerMessage } from "./file-hash-client";

const pending: ArrayBuffer[] = [];

function send(message: FileHashResponse) {
  globalThis.postMessage(message);
}

globalThis.onmessage = async ({ data }: MessageEvent<FileWorkerMessage>) => {
  if (data.type === "parts") {
    pending.push(...data.parts);
    return;
  }
  try {
    const file =
      data.type === "digest"
        ? data.file
        : new Blob(pending, { type: "application/octet-stream" });
    pending.length = 0;
    const digest = await sha256(await file.arrayBuffer());
    if (data.type === "verify" && digest !== data.expected)
      throw new Error("Unexpected file digest.");
    send({
      result: { digest, file: data.type === "verify" ? file : undefined },
    });
  } catch {
    send({
      error: {
        code: "integrity_failed",
        message: "The file could not be verified.",
      },
    });
  }
};
