import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight } from "lucide-react";
import type { PairingSession } from "@phonebridge/rtc";
import { Button, EmptyState, ErrorState } from "../ui/primitives";
import {
  applyTorch,
  canToggleTorch,
  cameraError,
} from "../scanner/camera-controls";

export default function LiveCamera({ session }: { session: PairingSession }) {
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState("");
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torchError, setTorchError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!running || !video.current) return;
    const player = video.current;
    let closed = false;
    let stream: MediaStream | undefined;
    let detach: (() => void) | undefined;
    async function open() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Open PhoneBridge over HTTPS in a browser with camera support.",
        );
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        });
      } catch (error) {
        throw new Error(cameraError(error));
      }
      if (closed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      player.srcObject = stream;
      await player.play();
      if (closed) return;
      detach = session.shareCamera(stream);
      const [camera] = stream.getVideoTracks();
      camera.onended = () => {
        setFailure("The camera stopped. Start it again to share the page.");
        setRunning(false);
      };
      setTrack(camera);
    }
    void open().catch((error: unknown) => {
      if (!closed) {
        setFailure(
          error instanceof Error ? error.message : "Start the camera again.",
        );
        setRunning(false);
      }
    });
    return () => {
      closed = true;
      stream?.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      detach?.();
      player.srcObject = null;
    };
  }, [running, session]);
  function start() {
    setFailure("");
    setTorch(false);
    setBusy(false);
    setTorchError("");
    setTrack(null);
    setRunning(true);
  }
  async function toggle() {
    if (!track) return;
    setBusy(true);
    try {
      await applyTorch(track, !torch);
      setTorch(!torch);
      setTorchError("");
    } catch {
      setTorchError("The flashlight couldn’t change. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const action = (
    <Button onClick={start}>
      {failure ? "Try again" : "Share live camera"}
    </Button>
  );
  if (!running)
    return failure ? (
      <ErrorState
        title="Camera unavailable"
        description={failure}
        action={action}
      />
    ) : (
      <EmptyState
        icon={<Camera />}
        title="Share a live page"
        description="Frame the whole page before starting your camera."
        action={action}
      />
    );
  return (
    <section className="scan-preview">
      <div className="scan-feed">
        <video ref={video} muted playsInline aria-label="Live camera preview" />
      </div>
      <p role="status">
        {track ? "Sharing with your laptop" : "Opening camera…"}
      </p>
      <div className="scan-actions">
        {track && canToggleTorch(track) && (
          <Button
            variant="secondary"
            disabled={busy}
            aria-pressed={torch}
            onClick={() => void toggle()}
          >
            <Flashlight />
            Flashlight
          </Button>
        )}
        <Button variant="secondary" onClick={() => setRunning(false)}>
          Stop sharing
        </Button>
      </div>
      {torchError && <p role="alert">{torchError}</p>}
    </section>
  );
}
