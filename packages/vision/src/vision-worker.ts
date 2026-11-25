import cvModule from "@techstark/opencv-js";
import { detectDocument } from "./detect.ts";
import type { OpenCvRuntime } from "./opencv.ts";
import type { VisionRequest, VisionResponse } from "./worker-client.ts";

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<VisionRequest>) => void) | null;
  postMessage(message: VisionResponse): void;
};

worker.onmessage = async ({ data: { id, frame, mode } }) => {
  try {
    const cv = (await cvModule) as OpenCvRuntime;
    worker.postMessage({ id, detection: detectDocument(cv, frame, mode) });
  } catch (error) {
    worker.postMessage({
      id,
      error: {
        code: "vision_failed",
        message:
          error instanceof Error ? error.message : "Document detection failed.",
      },
    });
  }
};
