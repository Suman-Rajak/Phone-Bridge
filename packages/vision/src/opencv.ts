import { createRequire } from "node:module";
import type * as OpenCv from "@techstark/opencv-js";

export type OpenCvRuntime = typeof OpenCv;

let runtime: Promise<OpenCvRuntime> | undefined;
const require = createRequire(import.meta.url);

/** Load the pinned OpenCV WebAssembly runtime once in a Node process. */
export function loadOpenCv(): Promise<OpenCvRuntime> {
  // Read the actual CommonJS promise before test runners can wrap it in a namespace.
  runtime ??= Promise.resolve(require("@techstark/opencv-js") as unknown).then(
    (module) => {
      const ready = module as OpenCvRuntime;
      if (typeof ready?.Mat !== "function") {
        throw new Error(
          "OpenCV could not initialize its image-processing runtime.",
        );
      }
      return ready;
    },
  );
  return runtime;
}
