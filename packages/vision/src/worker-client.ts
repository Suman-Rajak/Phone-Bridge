import type { Corners, Detection, DetectionMode, Frame } from "./types.ts";
import type { PageMode, PageRotation, PageSize } from "./rectify.ts";

export type PageRequest = {
  jpeg: Blob;
  phoneCorners?: Corners;
  corners?: Corners;
  mode: PageMode;
  rotation: PageRotation;
};

export type PageResult = PageSize & {
  jpeg: Blob;
  thumbnail: Blob;
  corners: Corners;
};

export type VisionRequest =
  | { id: number; initialize: true }
  | { id: number; page: PageRequest }
  | { id: number; frame: Frame; mode: DetectionMode }
  | { id: number; bitmap: ImageBitmap; mode: DetectionMode };
export type VisionResponse =
  | { id: number; ready: true; acceptsBitmap: boolean }
  | { id: number; page: PageResult }
  | { id: number; detection: Detection | null; sharpness?: number }
  | { id: number; error: { code: "vision_failed"; message: string } };

/** Start a dedicated worker that owns OpenCV and accepts RGBA detection requests. */
export function createVisionWorker(): Worker {
  if (typeof Worker !== "function") {
    throw new Error(
      "Document detection requires a browser with web worker support.",
    );
  }
  return new Worker(new URL("./vision-worker.ts", import.meta.url), {
    type: "module",
  });
}
