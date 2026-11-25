import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight } from "lucide-react";
import type { PairingSession } from "@phonebridge/rtc";
import type { Detection } from "@phonebridge/vision";
import { createVisionWorker } from "@phonebridge/vision/worker";
import type { VisionRequest, VisionResponse } from "@phonebridge/vision/worker";
import { Button, EmptyState, ErrorState, ProgressBar } from "../ui/primitives";
import { overlayDetection, previewSize } from "./preview-geometry";
import { useScanCapture } from "./use-scan-capture";
import type { RetakeRequest } from "./scan-transfer";

type TorchCapabilities = MediaTrackCapabilities & {
  torch?: boolean | boolean[];
};
type TorchConstraints = MediaTrackConstraints & { torch: ConstrainBoolean };
type TorchSettings = MediaTrackSettings & { torch?: boolean };

const scanIntervalMs = 1000 / 15;

function canToggleTorch(track: MediaStreamTrack): boolean {
  if (
    typeof track.getCapabilities !== "function" ||
    typeof track.applyConstraints !== "function"
  )
    return false;
  const { torch } = track.getCapabilities() as TorchCapabilities;
  return (
    torch === true ||
    (Array.isArray(torch) && torch.includes(true) && torch.includes(false))
  );
}

function cameraError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Allow camera access in your browser and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera was found. Connect a camera and try again.";
  }
  return "Close other apps using the camera and try again.";
}

export default function ScanPreview({
  session,
  retake,
  completeRetake,
}: {
  session: PairingSession;
  retake: RetakeRequest | null;
  completeRetake: (requestId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack>(null);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState("");
  const [progress, setProgress] = useState(0);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [torchError, setTorchError] = useState("");
  const [fps, setFps] = useState(0);
  const { capture, observe, stopCapture, auto, toggleAuto, stage, resetStage } =
    useScanCapture(session, videoRef, trackRef, retake, completeRetake);
  const debug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  function start() {
    resetStage();
    setFailure("");
    setProgress(10);
    setDetection(null);
    setTorchAvailable(false);
    setTorchActive(false);
    setTorchBusy(false);
    setTorchError("");
    setFps(0);
    setRunning(true);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!running || !video) return;

    let disposed = false;
    let stream: MediaStream | undefined;
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let bitmapSupported = false;
    let canvas: HTMLCanvasElement | undefined;
    let fallbackContext: CanvasRenderingContext2D | null = null;
    let request: { id: number; width: number; height: number } | undefined;
    let nextId = 0;
    let lastFrameTime = -1;
    let fpsStartedAt = 0;
    let processedFrames = 0;

    function stop() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      stopCapture();
      worker?.terminate();
      stream?.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      trackRef.current = null;
      video!.srcObject = null;
    }

    function fail(message: string) {
      if (disposed) return;
      stop();
      setFailure(message);
      setRunning(false);
    }

    async function sendFrame(player: HTMLVideoElement, detector: Worker) {
      if (
        disposed ||
        request ||
        !player.videoWidth ||
        !player.videoHeight ||
        player.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        player.currentTime === lastFrameTime
      )
        return;
      lastFrameTime = player.currentTime;
      const { width, height } = previewSize(
        player.videoWidth,
        player.videoHeight,
      );
      const id = ++nextId;
      request = { id, width, height };
      try {
        if (bitmapSupported) {
          // Transfer the frame so the worker reads its pixels alongside OpenCV.
          const bitmap = await createImageBitmap(player, {
            resizeWidth: width,
            resizeHeight: height,
          }).catch(() => null);
          if (bitmap?.width === width && bitmap.height === height) {
            if (disposed) bitmap.close();
            else {
              try {
                detector.postMessage(
                  { id, mode: "preview", bitmap } satisfies VisionRequest,
                  [bitmap],
                );
              } catch (error) {
                bitmap.close();
                throw error;
              }
            }
            return;
          }
          bitmap?.close();
          bitmapSupported = false;
        }
        if (disposed) return;
        canvas ??= document.createElement("canvas");
        fallbackContext ??= canvas.getContext("2d", {
          willReadFrequently: true,
        });
        if (!fallbackContext) throw new Error("No 2D context");
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        fallbackContext.drawImage(player, 0, 0, width, height);
        const { data } = fallbackContext.getImageData(0, 0, width, height);
        detector.postMessage(
          {
            id,
            mode: "preview",
            frame: { width, height, data },
          } satisfies VisionRequest,
          [data.buffer],
        );
      } catch {
        fail("The browser couldn’t read camera frames for detection.");
      }
    }

    async function enableCamera(player: HTMLVideoElement) {
      if (
        !window.isSecureContext ||
        typeof navigator.mediaDevices?.getUserMedia !== "function"
      ) {
        fail("Open PhoneBridge over HTTPS in a browser with camera support.");
        return;
      }
      let opened: MediaStream;
      try {
        opened = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (error) {
        fail(cameraError(error));
        return;
      }
      if (disposed) {
        opened.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = opened;
      const [track] = stream.getVideoTracks();
      if (!track) {
        fail("The browser couldn’t open a video track.");
        return;
      }
      trackRef.current = track;
      track.onended = () =>
        fail("The camera stopped. Start it again to continue scanning.");
      setTorchAvailable(canToggleTorch(track));
      player.srcObject = stream;
      try {
        await player.play();
      } catch {
        fail("The camera preview couldn’t start. Try again.");
        return;
      }
      if (disposed) return;
      setProgress(40);
      let detector: Worker;
      try {
        detector = createVisionWorker();
      } catch {
        fail("Document detection requires a browser with Web Worker support.");
        return;
      }
      worker = detector;
      detector.onerror = () =>
        fail("The document detector couldn’t load. Try again.");
      detector.onmessageerror = () =>
        fail("The document detector couldn’t read a frame.");
      detector.onmessage = ({ data }: MessageEvent<VisionResponse>) => {
        if (disposed) return;
        if ("error" in data) {
          fail(
            "The document detector couldn’t process the preview. Try again.",
          );
          return;
        }
        if ("ready" in data) {
          bitmapSupported =
            data.acceptsBitmap && typeof createImageBitmap === "function";
          setProgress(75);
          fpsStartedAt = performance.now();
          timer = setInterval(
            () => void sendFrame(player, detector),
            scanIntervalMs,
          );
          void sendFrame(player, detector);
          return;
        }
        if (!("detection" in data) || !request || request.id !== data.id)
          return;
        const size = request;
        request = undefined;
        const next = data.detection;
        observe(next, data.sharpness ?? 0, size);
        setDetection((previous) =>
          next ? overlayDetection(previous, next, size) : null,
        );
        setProgress(100);
        if (debug) {
          processedFrames++;
          const now = performance.now();
          const elapsed = now - fpsStartedAt;
          if (elapsed >= 1_000) {
            setFps(Math.round((processedFrames * 1000) / elapsed));
            processedFrames = 0;
            fpsStartedAt = now;
          }
        }
      };
      detector.postMessage({ id: 0, initialize: true } satisfies VisionRequest);
    }

    void enableCamera(video).catch(() =>
      fail("The camera preview couldn’t start. Try again."),
    );
    return stop;
  }, [debug, observe, running, stopCapture]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track || torchBusy) return;
    setTorchBusy(true);
    setTorchError("");
    const next = !torchActive;
    try {
      const constraints: TorchConstraints = {
        ...track.getConstraints(),
        torch: { exact: next },
      };
      await track.applyConstraints(constraints);
      const { torch } = track.getSettings() as TorchSettings;
      if (typeof torch === "boolean" && torch !== next)
        throw new Error("Torch did not change");
      if (trackRef.current === track) setTorchActive(next);
    } catch {
      if (trackRef.current === track)
        setTorchError("The camera flashlight couldn’t change.");
    } finally {
      if (trackRef.current === track) setTorchBusy(false);
    }
  }

  if (!running) {
    const action = (
      <Button onClick={start}>{failure ? "Try again" : "Start camera"}</Button>
    );
    return failure ? (
      <ErrorState
        title="Scanner unavailable"
        description={failure}
        action={action}
      />
    ) : (
      <EmptyState
        icon={<Camera />}
        title={retake ? "Retake the page" : "Scan a document"}
        description={
          retake
            ? "Frame the page and capture a replacement."
            : "Point your rear camera at a page on a flat surface."
        }
        action={action}
      />
    );
  }

  return (
    <section className="scan-preview" aria-label="Scanner preview">
      <div className="scan-feed">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        {detection && (
          <svg
            className="scan-outline"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden="true"
            data-detection={detection.fallback ? "fallback" : "locked"}
          >
            <polygon
              points={detection.corners
                .map(({ x, y }) => x + "," + y)
                .join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {debug && progress === 100 && (
          <output className="scan-fps" aria-label="Detection frame rate">
            {fps} fps
          </output>
        )}
      </div>
      {progress < 100 ? (
        <ProgressBar
          label={
            progress < 40 ? "Starting camera" : "Loading document detector"
          }
          value={progress}
        />
      ) : (
        <p role="status" className="muted">
          {detection?.fallback
            ? "Move closer and place all four corners in view."
            : detection
              ? "Document detected"
              : "Looking for a document…"}
        </p>
      )}
      <div className="scan-actions">
        <Button
          disabled={progress < 40 || stage === "taking" || stage === "sending"}
          onClick={() => void capture()}
        >
          <Camera aria-hidden="true" /> Capture page
        </Button>
        <Button
          variant={auto ? "secondary" : "ghost"}
          aria-pressed={auto}
          onClick={toggleAuto}
        >
          Auto capture
        </Button>
        {torchAvailable && (
          <Button
            variant="secondary"
            disabled={torchBusy}
            aria-pressed={torchActive}
            onClick={() => void toggleTorch()}
          >
            <Flashlight aria-hidden="true" /> Flashlight
          </Button>
        )}
        <Button variant="ghost" onClick={() => setRunning(false)}>
          Stop camera
        </Button>
      </div>
      {stage === "failed" ? (
        <ErrorState
          title="Scan couldn’t be sent"
          description="Keep both devices connected and capture the page again."
        />
      ) : (
        stage !== "idle" && (
          <p role="status" className="muted">
            {stage === "taking"
              ? "Taking photo…"
              : stage === "sending"
                ? "Sending to laptop…"
                : "Scan sent to laptop"}
          </p>
        )
      )}
      {torchError && <p role="alert">{torchError}</p>}
    </section>
  );
}
