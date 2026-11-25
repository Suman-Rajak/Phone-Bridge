import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { detectDocument, loadOpenCv } from "../../packages/vision/src/index.ts";
import { downloadSmartDoc } from "../../scripts/download-smartdoc.ts";
import { polygonIoU } from "./polygon-iou.ts";
import { readSmartDocSample } from "./smartdoc.ts";

try {
  const sample = await downloadSmartDoc();
  const cv = await loadOpenCv();
  let frames = 0;
  let sum = 0;
  for await (const { frame, corners } of readSmartDocSample(sample)) {
    const detection = detectDocument(cv, frame);
    sum += detection ? polygonIoU(detection.corners, corners) : 0;
    frames++;
  }
  if (frames === 0)
    throw new Error(
      "The SmartDoc archive contains no annotated sample frames.",
    );

  const result = {
    dataset: "SmartDoc 2015 Challenge 1 official sample",
    mode: "preview",
    frames,
    meanIoU: sum / frames,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  const baseline = resolve(import.meta.dirname, "../baseline.json");
  if (!existsSync(baseline)) {
    await writeFile(baseline, JSON.stringify(result, null, 2) + "\n", {
      flag: "wx",
    });
  }
} catch (error) {
  process.stderr.write(
    "Vision benchmark could not run: " +
      (error instanceof Error ? error.message : String(error)) +
      "\n",
  );
  process.exitCode = 1;
}
