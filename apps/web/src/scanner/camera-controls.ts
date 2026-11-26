type TorchCapabilities = MediaTrackCapabilities & {
  torch?: boolean | boolean[];
};
type TorchConstraints = MediaTrackConstraints & { torch: ConstrainBoolean };
type TorchSettings = MediaTrackSettings & { torch?: boolean };

export function canToggleTorch(track: MediaStreamTrack): boolean {
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

export function cameraError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Allow camera access in your browser and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera was found. Connect a camera and try again.";
  }
  return "Close other apps using the camera and try again.";
}

export async function applyTorch(track: MediaStreamTrack, next: boolean) {
  const constraints: TorchConstraints = {
    ...track.getConstraints(),
    torch: { exact: next },
  };
  await track.applyConstraints(constraints);
  const { torch } = track.getSettings() as TorchSettings;
  if (typeof torch === "boolean" && torch !== next)
    throw new Error("Torch did not change");
}
