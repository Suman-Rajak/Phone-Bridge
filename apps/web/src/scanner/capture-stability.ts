import type { Corners } from "@phonebridge/vision";

type FrameSize = { width: number; height: number };
type Anchor = { corners: Corners; since: number };

const sharpnessThreshold = 100;
const holdMs = 500;
const movementLimit = 0.015;

/** Track a stable document against the first sample, including slow cumulative drift. */
export class CaptureStability {
  private anchor: Anchor | undefined;
  private captured: Corners | undefined;

  reset(): void {
    this.anchor = undefined;
    this.captured = undefined;
  }

  markCaptured(corners?: Corners): void {
    this.anchor = undefined;
    this.captured = corners;
  }

  sample(
    corners: Corners | null,
    sharpness: number,
    at: number,
    size: FrameSize,
  ): boolean {
    if (!corners) {
      this.reset();
      return false;
    }
    if (this.captured) {
      if (withinDistance(this.captured, corners, size)) return false;
      this.reset();
    }
    if (sharpness < sharpnessThreshold) {
      this.anchor = undefined;
      return false;
    }
    if (!this.anchor || !withinDistance(this.anchor.corners, corners, size)) {
      this.anchor = { corners, since: at };
      return false;
    }
    return at - this.anchor.since >= holdMs;
  }
}

function withinDistance(
  from: Corners,
  to: Corners,
  { width, height }: FrameSize,
): boolean {
  const limit = movementLimit * Math.hypot(width, height);
  return from.every((point, index) => {
    const difference = to[index];
    return (
      Math.hypot(
        (point.x - difference.x) * width,
        (point.y - difference.y) * height,
      ) <= limit
    );
  });
}
