import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { Corners, Point } from "@phonebridge/vision";
import { validPageCorners } from "@phonebridge/vision/rectify";
import { Drawer } from "../ui/overlay";
import { Button } from "../ui/primitives";
import { useBlobUrl } from "./use-blob-url";

const labels = [
  "Top left corner",
  "Top right corner",
  "Bottom right corner",
  "Bottom left corner",
];

export function CornerEditor({
  jpeg,
  corners,
  onClose,
  onSave,
}: {
  jpeg: Blob;
  corners: Corners;
  onClose(): void;
  onSave(corners: Corners): void;
}) {
  const [draft, setDraft] = useState(corners);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const url = useBlobUrl(jpeg);
  const valid = validPageCorners(draft);

  function place(index: number, pixel: Point) {
    setDraft(
      (previous) =>
        previous.map((point, position) =>
          position === index
            ? {
                x: Math.min(1, Math.max(0, pixel.x)),
                y: Math.min(1, Math.max(0, pixel.y)),
              }
            : point,
        ) as Corners,
    );
  }

  function movePointer(event: PointerEvent<HTMLButtonElement>, index: number) {
    const box = stage.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return;
    place(index, {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    });
  }

  function moveByKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.shiftKey ? 0.03 : 0.006;
    const direction = {
      ArrowUp: [0, -step],
      ArrowRight: [step, 0],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    place(index, {
      x: draft[index].x + direction[0],
      y: draft[index].y + direction[1],
    });
  }

  return (
    <Drawer open onClose={onClose} title="Edit corners">
      <p className="muted">
        Drag each handle to a page corner or move it with the arrow keys.
      </p>
      {url && (
        <div className="corner-editor">
          <div className="corner-stage" ref={stage}>
            <img src={url} alt="Original scan" />
            <svg
              className="scan-outline"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              aria-hidden="true"
              data-detection={valid ? "locked" : "fallback"}
            >
              <polygon
                points={draft.map(({ x, y }) => x + "," + y).join(" ")}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {draft.map(({ x, y }, index) => (
              <Button
                key={labels[index]}
                variant="ghost"
                className="corner-handle"
                aria-label={labels[index]}
                style={{ left: x * 100 + "%", top: y * 100 + "%" }}
                onPointerDown={(event) => {
                  drag.current = index;
                  if (
                    typeof event.currentTarget.setPointerCapture === "function"
                  )
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (drag.current === index) movePointer(event, index);
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onKeyDown={(event) => moveByKey(event, index)}
              >
                <span aria-hidden="true" />
              </Button>
            ))}
          </div>
        </div>
      )}
      {!valid && (
        <p role="status">
          Move the handles so each one marks a different corner.
        </p>
      )}
      <Button disabled={!valid || !url} onClick={() => onSave(draft)}>
        Save corners
      </Button>
    </Drawer>
  );
}
