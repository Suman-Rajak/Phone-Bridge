export type ScanMediaRequest =
  | { type: "encode"; source: Blob | ImageBitmap }
  | { type: "check"; jpeg: Blob }
  | {
      type: "verify";
      parts: ArrayBuffer[];
      sha256: string;
      width: number;
      height: number;
    };

export type ScanMediaResult = {
  jpeg: Blob;
  width: number;
  height: number;
  sha256: string;
};

export type ScanMediaResponse =
  | { result: ScanMediaResult }
  | { error: { code: "invalid_image" | "media_failed"; message: string } };

export const scanSizeLimit = 32 * 1024 * 1024;
export const scanPixelLimit = 64_000_000;
export const jpegQuality = 0.92;
