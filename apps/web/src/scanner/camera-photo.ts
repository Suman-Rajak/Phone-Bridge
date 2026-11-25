import { jpegQuality, scanPixelLimit } from "./scan-media";
import type { ScanMediaResult } from "./scan-media";
import { runScanMedia } from "./scan-media-client";

type PhotoCapture = { takePhoto?: () => Promise<Blob> };
type CameraWindow = Window & {
  ImageCapture?: new (track: MediaStreamTrack) => PhotoCapture;
};

async function videoJpeg(video: HTMLVideoElement): Promise<Blob> {
  if (
    !video.videoWidth ||
    !video.videoHeight ||
    video.videoWidth * video.videoHeight > scanPixelLimit
  ) {
    throw new Error("The camera feed is unavailable.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.toBlob !== "function") {
    throw new Error("This browser cannot capture a photo.");
  }
  context.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (jpeg) => {
        if (jpeg?.type === "image/jpeg") resolve(jpeg);
        else reject(new Error("The camera frame could not be saved."));
      },
      "image/jpeg",
      jpegQuality,
    );
  });
}

export async function capturePhoto(
  video: HTMLVideoElement,
  track: MediaStreamTrack,
  signal: AbortSignal,
): Promise<ScanMediaResult> {
  const Capture = (window as CameraWindow).ImageCapture;
  if (
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas === "function"
  ) {
    if (typeof Capture === "function") {
      try {
        const camera = new Capture(track);
        if (typeof camera.takePhoto === "function") {
          const source = await camera.takePhoto();
          return await runScanMedia({ type: "encode", source }, signal);
        }
      } catch {
        signal.throwIfAborted();
        // A track can expose ImageCapture without supporting still photos.
      }
    }
    const bitmap = await createImageBitmap(video).catch(() => null);
    if (bitmap) {
      try {
        return await runScanMedia({ type: "encode", source: bitmap }, signal);
      } finally {
        bitmap.close();
      }
    }
  }
  return runScanMedia({ type: "check", jpeg: await videoJpeg(video) }, signal);
}
