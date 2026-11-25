import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PairingSession } from "@phonebridge/rtc";
import type { Corners, Detection } from "@phonebridge/vision";
import { capturePhoto } from "./camera-photo";
import { CaptureStability } from "./capture-stability";
import { overlayDetection } from "./preview-geometry";
import { sendScan } from "./scan-transfer";

type CaptureStage = "idle" | "taking" | "sending" | "sent" | "failed";
type FrameSize = { width: number; height: number };

export function useScanCapture(
  session: PairingSession,
  video: RefObject<HTMLVideoElement | null>,
  track: RefObject<MediaStreamTrack | null>,
) {
  const stability = useRef(new CaptureStability());
  const active = useRef<AbortController | null>(null);
  const corners = useRef<Corners | undefined>(undefined);
  const autoEnabled = useRef(true);
  const [auto, setAuto] = useState(true);
  const [stage, setStage] = useState<CaptureStage>("idle");

  const capture = useCallback(async () => {
    const camera = track.current;
    const frame = video.current;
    if (active.current || !camera || !frame?.videoWidth || !frame.videoHeight)
      return;
    const attempt = new AbortController();
    active.current = attempt;
    const capturedAt = performance.now();
    const previewAspect = frame.videoWidth / frame.videoHeight;
    const detectedCorners = corners.current;
    stability.current.markCaptured(detectedCorners);
    setStage("taking");
    const timeout = setTimeout(
      () => attempt.abort(new Error("Scan timed out.")),
      45_000,
    );
    try {
      const photo = await capturePhoto(frame, camera, attempt.signal);
      attempt.signal.throwIfAborted();
      const cameraCropped =
        Math.abs(photo.width / photo.height / previewAspect - 1) > 0.02;
      const coordinates =
        !cameraCropped && detectedCorners
          ? (detectedCorners.map(({ x, y }) => [x, y]) as [
              [number, number],
              [number, number],
              [number, number],
              [number, number],
            ])
          : undefined;
      setStage("sending");
      await sendScan(
        session,
        photo,
        { capturedAt, corners: coordinates },
        attempt.signal,
      );
      if (active.current === attempt) setStage("sent");
    } catch {
      if (active.current === attempt) setStage("failed");
    } finally {
      clearTimeout(timeout);
      if (active.current === attempt) active.current = null;
    }
  }, [session, track, video]);

  const observe = useCallback(
    (detection: Detection | null, sharpness: number, size: FrameSize) => {
      const page =
        detection && !detection.fallback
          ? overlayDetection(null, detection, size).corners
          : null;
      corners.current = page ?? undefined;
      if (!autoEnabled.current || active.current) return;
      if (stability.current.sample(page, sharpness, performance.now(), size))
        void capture();
    },
    [capture],
  );

  const stopCapture = useCallback(() => {
    const attempt = active.current;
    active.current = null;
    attempt?.abort();
    corners.current = undefined;
    stability.current.reset();
  }, []);

  function toggleAuto() {
    autoEnabled.current = !autoEnabled.current;
    stability.current.reset();
    setAuto(autoEnabled.current);
  }

  return {
    capture,
    observe,
    stopCapture,
    auto,
    toggleAuto,
    stage,
    resetStage: () => setStage("idle"),
  };
}
