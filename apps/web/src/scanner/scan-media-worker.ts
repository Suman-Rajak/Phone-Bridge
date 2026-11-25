import { jpegQuality, scanPixelLimit, scanSizeLimit } from "./scan-media";
import type {
  ScanMediaRequest,
  ScanMediaResponse,
  ScanMediaResult,
} from "./scan-media";

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ScanMediaRequest>) => void) | null;
  postMessage(response: ScanMediaResponse): void;
};

function jpegDimensions(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let offset = 2; offset + 4 < bytes.length;) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    // The start-of-frame segment stores the decoded image dimensions.
    if (
      length >= 8 &&
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

async function encodeJpeg(source: Blob | ImageBitmap): Promise<Blob> {
  const image =
    source instanceof Blob ? await createImageBitmap(source) : source;
  try {
    if (
      !image.width ||
      !image.height ||
      image.width * image.height > scanPixelLimit
    ) {
      throw new Error("The photo is too large.");
    }
    if (typeof OffscreenCanvas !== "function")
      throw new Error("This browser cannot prepare the photo.");
    const surface = new OffscreenCanvas(image.width, image.height);
    const context = surface.getContext("2d");
    if (!context || typeof surface.convertToBlob !== "function")
      throw new Error("This browser cannot prepare the photo.");
    context.drawImage(image, 0, 0);
    return await surface.convertToBlob({
      type: "image/jpeg",
      quality: jpegQuality,
    });
  } finally {
    image.close();
  }
}

async function inspect(jpeg: Blob): Promise<ScanMediaResult> {
  if (jpeg.size === 0 || jpeg.size > scanSizeLimit)
    throw new Error("The photo exceeds the scan size limit.");
  const bytes = await jpeg.arrayBuffer();
  const size = jpegDimensions(new Uint8Array(bytes));
  if (
    !size ||
    !size.width ||
    !size.height ||
    size.width * size.height > scanPixelLimit
  ) {
    throw new Error("The scan is not a supported JPEG.");
  }
  if (typeof globalThis.crypto?.subtle?.digest !== "function") {
    throw new Error("This browser cannot verify scan integrity.");
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return {
    jpeg,
    ...size,
    sha256: Array.from(digest, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
  };
}

worker.onmessage = async ({ data }) => {
  try {
    const jpeg =
      data.type === "encode"
        ? await encodeJpeg(data.source)
        : data.type === "check"
          ? data.jpeg
          : new Blob(data.parts, { type: "image/jpeg" });
    const result = await inspect(jpeg);
    if (
      data.type === "verify" &&
      (result.sha256 !== data.sha256 ||
        result.width !== data.width ||
        result.height !== data.height)
    ) {
      worker.postMessage({
        error: {
          code: "invalid_image",
          message: "The received scan did not pass verification.",
        },
      });
      return;
    }
    worker.postMessage({ result });
  } catch {
    worker.postMessage({
      error: {
        code: "media_failed",
        message: "The photo could not be processed.",
      },
    });
  }
};
