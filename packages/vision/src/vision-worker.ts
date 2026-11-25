import cvModule from "@techstark/opencv-js";
import { detectDocument } from "./detect.ts";
import type { OpenCvRuntime } from "./opencv.ts";
import type { Frame } from "./types.ts";
import type { VisionRequest, VisionResponse } from "./worker-client.ts";

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<VisionRequest>) => void) | null;
  postMessage(message: VisionResponse): void;
};

let surface: OffscreenCanvas | undefined;
let context: OffscreenCanvasRenderingContext2D | null = null;

function frameFromBitmap(bitmap: ImageBitmap): Frame {
  if (!surface || !context)
    throw new Error("The worker cannot read camera frames.");
  const { width, height } = bitmap;
  if (surface.width !== width || surface.height !== height) {
    surface.width = width;
    surface.height = height;
  }
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, width, height);
}

worker.onmessage = async ({ data: request }) => {
  const { id } = request;
  try {
    const cv = (await cvModule) as OpenCvRuntime;
    if ("initialize" in request) {
      if (typeof OffscreenCanvas === "function") {
        surface ??= new OffscreenCanvas(1, 1);
        context = surface.getContext("2d", { willReadFrequently: true });
      }
      worker.postMessage({ id, ready: true, acceptsBitmap: context !== null });
    } else {
      const frame =
        "bitmap" in request ? frameFromBitmap(request.bitmap) : request.frame;
      worker.postMessage({
        id,
        detection: detectDocument(cv, frame, request.mode),
      });
    }
  } catch (error) {
    worker.postMessage({
      id,
      error: {
        code: "vision_failed",
        message:
          error instanceof Error ? error.message : "Document detection failed.",
      },
    });
  } finally {
    if ("bitmap" in request) request.bitmap.close();
  }
};
