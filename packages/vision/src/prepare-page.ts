import { detectDocument } from "./detect.ts";
import type { OpenCvRuntime } from "./opencv.ts";
import { choosePageCorners, rectifyPage } from "./rectify.ts";
import type { PageRequest, PageResult } from "./worker-client.ts";

function canvas2D(width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.convertToBlob !== "function") {
    throw new Error(
      "Page editing requires a browser with worker canvas support.",
    );
  }
  return { canvas, context };
}

async function jpegFrom(canvas: OffscreenCanvas): Promise<Blob> {
  const jpeg = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.92,
  });
  if (jpeg.type !== "image/jpeg")
    throw new Error("The browser could not encode the page.");
  return jpeg;
}

/** Refine, warp, and encode a page and its thumbnail inside the vision worker. */
export async function preparePage(
  cv: OpenCvRuntime,
  request: PageRequest,
): Promise<PageResult> {
  if (
    typeof OffscreenCanvas !== "function" ||
    typeof createImageBitmap !== "function"
  ) {
    throw new Error(
      "Page editing requires a browser with worker canvas support.",
    );
  }
  const image = await createImageBitmap(request.jpeg);
  const frame = (() => {
    try {
      const source = canvas2D(image.width, image.height);
      source.context.drawImage(image, 0, 0);
      return source.context.getImageData(0, 0, image.width, image.height);
    } finally {
      image.close();
    }
  })();
  const corners =
    request.corners ??
    choosePageCorners(
      request.phoneCorners,
      detectDocument(cv, frame, "refine"),
      frame,
    );
  const { width, height, data, a4 } = rectifyPage(
    cv,
    frame,
    corners,
    request.mode,
    request.rotation,
  );
  const output = canvas2D(width, height);
  output.context.putImageData(
    new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height),
    0,
    0,
  );
  const scale = Math.min(1, 176 / Math.max(width, height));
  const thumbnail = canvas2D(
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
  );
  thumbnail.context.drawImage(
    output.canvas,
    0,
    0,
    thumbnail.canvas.width,
    thumbnail.canvas.height,
  );
  const [jpeg, preview] = await Promise.all([
    jpegFrom(output.canvas),
    jpegFrom(thumbnail.canvas),
  ]);
  return { jpeg, thumbnail: preview, corners, width, height, a4 };
}
