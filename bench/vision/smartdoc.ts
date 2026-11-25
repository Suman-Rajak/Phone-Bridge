import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Corners, Frame } from "../../packages/vision/src/types.ts";

type GroundTruth = { index: number; corners: Corners };
const cornersOrder = ["tl", "tr", "br", "bl"] as const;

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(
      ([, name, doubleQuoted, singleQuoted]) => [
        name,
        doubleQuoted ?? singleQuoted,
      ],
    ),
  );
}

/** Read the organizer's video path, one-based frame indices, and named page corners. */
export function parseGroundTruth(xml: string): {
  video: string;
  frames: GroundTruth[];
} {
  const video = xml
    .match(/<source_sample_file>([^<]+)<\/source_sample_file>/)?.[1]
    .trim();
  if (!video)
    throw new Error("SmartDoc ground truth is missing its source video.");

  const frames: GroundTruth[] = [];
  for (const [, frameAttributes, points] of xml.matchAll(
    /<frame\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/frame>)/g,
  )) {
    const { index: frameIndex, rejected } = attributes(frameAttributes);
    if (rejected === "true") continue;
    const index = Number(frameIndex);
    const entries = [...(points ?? "").matchAll(/<point\b([^>]*)>/g)].map(
      ([, values]) => attributes(values),
    );
    if (!Number.isSafeInteger(index) || index < 1 || entries.length !== 4) {
      throw new Error("Invalid annotated SmartDoc frame " + frameIndex + ".");
    }

    const corners = cornersOrder.map((name) => {
      const point = entries.find((entry) => entry.name === name);
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(
          "Invalid SmartDoc corner " + name + " on frame " + frameIndex + ".",
        );
      }
      return { x, y };
    }) as Corners;
    frames.push({ index, corners });
  }
  return { video, frames: frames.sort((a, b) => a.index - b.index) };
}

export async function* readSmartDocSample(
  directory: string,
): AsyncGenerator<{ frame: Frame; corners: Corners }> {
  const entries = (
    await readdir(directory, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  const entriesByRelativePath = new Map(
    entries.map((file) => [
      relative(directory, file).replaceAll("\\", "/"),
      file,
    ]),
  );
  for (const annotation of entries.filter((file) => file.endsWith(".gt.xml"))) {
    const { video, frames } = parseGroundTruth(
      await readFile(annotation, "utf8"),
    );
    if (frames.length === 0) continue;
    const suffix = video.replaceAll("\\", "/").replace(/^\.\//, "");
    const matches = [...entriesByRelativePath].filter(
      ([path]) => path === suffix || path.endsWith("/" + suffix),
    );
    if (matches.length !== 1)
      throw new Error("Expected one SmartDoc video for " + video + ".");
    const videoPath = matches[0][1];
    const { streams } = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=width,height",
          "-of",
          "json",
          videoPath,
        ],
        { encoding: "utf8" },
      ),
    ) as { streams: { width: number; height: number }[] };
    const { width, height } = streams[0];
    const frameBytes = width * height * 4;
    const chosen = new Set(
      [0.25, 0.5, 0.75].map(
        (fraction) => frames[Math.floor((frames.length - 1) * fraction)],
      ),
    );
    for (const { index, corners } of chosen) {
      const rgba = execFileSync(
        "ffmpeg",
        [
          "-nostdin",
          "-v",
          "error",
          "-noautorotate",
          "-i",
          videoPath,
          "-map",
          "0:v:0",
          "-vf",
          "select=eq(n\\," + (index - 1) + ")",
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgba",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { maxBuffer: frameBytes + 1024 },
      );
      if (rgba.length !== frameBytes)
        throw new Error(
          "Cannot decode SmartDoc frame " + index + " in " + video + ".",
        );
      yield {
        frame: { width, height, data: new Uint8ClampedArray(rgba) },
        corners,
      };
    }
  }
}
