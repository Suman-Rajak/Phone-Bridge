import { useEffect, useRef, useState } from "react";
import { pageHomography } from "@phonebridge/vision/homography";
import {
  choosePageCorners,
  rectifiedPageSize,
} from "@phonebridge/vision/rectify";
import { createVisionWorker } from "@phonebridge/vision/worker";
import type { VisionRequest, VisionResponse } from "@phonebridge/vision/worker";
import type { Corners } from "@phonebridge/vision";
import { Button, Card } from "../ui/primitives";
import { createWarpRenderer } from "./warp-renderer";

export default function LivePage({ stream }: { stream: MediaStream }) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false),
    [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  const [contrast, setContrast] = useState(1),
    [brightness, setBrightness] = useState(0);
  const tone = useRef({ contrast, brightness });
  useEffect(() => {
    tone.current = { contrast, brightness };
  }, [contrast, brightness]);
  useEffect(() => {
    const player = video.current,
      output = canvas.current;
    if (!player || !output) return;
    player.srcObject = stream;
    setStatus("Finding page…");
    setFallback(false);
    let renderer: ReturnType<typeof createWarpRenderer> | undefined;
    let worker: Worker | undefined,
      raf = 0,
      disposed = false;
    let matrix = pageHomography(
      choosePageCorners(undefined, null, { width: 1, height: 1 }),
    );
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let measured = false,
      lastTime = -1;
    function raw() {
      clearTimeout(retryTimer);
      cancelAnimationFrame(raf);
      worker?.terminate();
      setFallback(true);
      setStatus(
        "Page flattening is unavailable. Use the live camera view below.",
      );
    }
    function find(v: HTMLVideoElement, c: HTMLCanvasElement) {
      try {
        const frame = document.createElement("canvas");
        frame.width = Math.min(480, v.videoWidth);
        frame.height = Math.max(
          1,
          Math.round((frame.width * v.videoHeight) / v.videoWidth),
        );
        const ctx = frame.getContext("2d");
        if (!ctx) throw new Error("Frame unavailable");
        ctx.drawImage(v, 0, 0, frame.width, frame.height);
        const pixels = ctx.getImageData(0, 0, frame.width, frame.height);
        const detector = createVisionWorker();
        worker = detector;
        detector.onerror = () => {
          detector.terminate();
          setStatus(
            "Page detection is unavailable. Frame the page and try again.",
          );
        };
        detector.onmessage = ({ data }: MessageEvent<VisionResponse>) => {
          detector.terminate();
          if (disposed) return;
          if (
            !("detection" in data) ||
            !data.detection ||
            data.detection.fallback
          ) {
            if (++attempts < 3) {
              retryTimer = setTimeout(() => find(v, c), 400);
              return;
            }
            setStatus("Frame all four corners and find the page again.");
            return;
          }
          const corners = choosePageCorners(undefined, data.detection, frame);
          matrix = pageHomography(corners);
          const size = rectifiedPageSize(
            corners.map((p) => ({
              x: p.x * v.videoWidth,
              y: p.y * v.videoHeight,
            })) as Corners,
          );
          c.width = size.width;
          c.height = size.height;
          setStatus("Page flattened");
        };
        detector.postMessage(
          {
            id: 1,
            mode: "preview",
            frame: {
              width: pixels.width,
              height: pixels.height,
              data: pixels.data,
            },
          } satisfies VisionRequest,
          [pixels.data.buffer],
        );
      } catch {
        setStatus(
          "Page detection is unavailable. Frame the page and try again.",
        );
      }
    }
    function paint() {
      if (disposed || !player || !output || !renderer) return;
      if (
        player.readyState >= 2 &&
        player.videoWidth &&
        lastTime !== player.currentTime
      ) {
        if (!measured) {
          measured = true;
          output.width = player.videoWidth;
          output.height = player.videoHeight;
          find(player, output);
        }
        lastTime = player.currentTime;
        try {
          renderer.draw(
            player,
            matrix,
            tone.current.contrast,
            tone.current.brightness,
          );
        } catch {
          raw();
          return;
        }
      }
      raf = requestAnimationFrame(paint);
    }
    const lost = (event: Event) => {
      event.preventDefault();
      raw();
    };
    const restored = () => setRetry((n) => n + 1);
    output.addEventListener("webglcontextlost", lost);
    output.addEventListener("webglcontextrestored", restored);
    try {
      renderer = createWarpRenderer(output);
      paint();
    } catch {
      raw();
    }
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      cancelAnimationFrame(raf);
      worker?.terminate();
      output.removeEventListener("webglcontextlost", lost);
      output.removeEventListener("webglcontextrestored", restored);
      renderer?.dispose();
      player.srcObject = null;
    };
  }, [stream, retry]);
  return (
    <Card className="scan-inbox live-page">
      <p role="status">{status}</p>
      <div className="live-feed">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          aria-hidden={!fallback}
          aria-label="Live camera view"
        />
        <canvas
          ref={canvas}
          hidden={fallback}
          aria-label="Flattened live page"
          role="img"
        />
      </div>
      {!fallback && (
        <div className="live-controls">
          <label>
            Contrast
            <input
              type="range"
              min=".5"
              max="2"
              step=".05"
              value={contrast}
              onChange={(e) => setContrast(+e.target.value)}
            />
          </label>
          <label>
            Brightness
            <input
              type="range"
              min="-.4"
              max=".4"
              step=".02"
              value={brightness}
              onChange={(e) => setBrightness(+e.target.value)}
            />
          </label>
          <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
            Find page again
          </Button>
        </div>
      )}
    </Card>
  );
}
