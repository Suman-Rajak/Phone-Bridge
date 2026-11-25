import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ScanLine,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import type { PairingSession } from "@phonebridge/rtc";
import type { PageMode, PageRotation } from "@phonebridge/vision/rectify";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Spinner,
} from "../ui/primitives";
import { SegmentedControl } from "../ui/selection";
import { CornerEditor } from "./corner-editor";
import { useBlobUrl } from "./use-blob-url";
import { useScanPages } from "./use-scan-pages";
import type { ScanPage } from "./use-scan-pages";

const modes: { value: PageMode; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "clean", label: "Clean colour" },
  { value: "grayscale", label: "Grayscale" },
  { value: "black-and-white", label: "Black & white" },
];

function Thumbnail({
  page,
  number,
  selected,
  onSelect,
}: {
  page: ScanPage;
  number: number;
  selected: boolean;
  onSelect(): void;
}) {
  const url = useBlobUrl(page.result?.thumbnail);
  return (
    <Button
      variant="ghost"
      className="scan-thumbnail"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {url ? <img alt="" src={url} /> : <ScanLine aria-hidden="true" />}
      Page {number}
    </Button>
  );
}

export default function ScanInbox({
  session,
}: {
  session: PairingSession | null;
}) {
  const {
    pages,
    selected,
    transferFailed,
    retakeId,
    selectPage,
    updatePage,
    orderPage,
    requestRetake,
    removePage,
  } = useScanPages(session);
  const [editingId, setEditingId] = useState("");
  const drag = useRef<string | null>(null);
  const index = selected ? pages.indexOf(selected) : -1;
  const preview = useBlobUrl(
    selected?.result?.jpeg ??
      (selected?.stage === "failed" ? selected.request.jpeg : undefined),
  );

  return (
    <Card className="scan-inbox">
      <h2>Pages</h2>
      {transferFailed && (
        <ErrorState
          title="Scan couldn’t be received"
          description="Keep both devices connected and capture the page again."
        />
      )}
      {!selected ? (
        <EmptyState
          icon={<ScanLine />}
          title="Waiting for a scan"
          description="Start the camera in Scan on your phone."
        />
      ) : (
        <>
          <ol className="scan-tray" aria-label="Scan pages">
            {pages.map((page, position) => (
              <li
                key={page.id}
                draggable={pages.length > 1}
                onDragStart={(event) => {
                  drag.current = page.id;
                  event.dataTransfer.setData("text/plain", "Page");
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (drag.current) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (drag.current) orderPage(drag.current, page.id);
                  drag.current = null;
                }}
                onDragEnd={() => {
                  drag.current = null;
                }}
              >
                <Thumbnail
                  page={page}
                  number={position + 1}
                  selected={page === selected}
                  onSelect={() => selectPage(page.id)}
                />
              </li>
            ))}
          </ol>
          {preview && (
            <figure>
              <img src={preview} alt="Scanned document" />
            </figure>
          )}
          {selected.stage === "working" && (
            <Spinner label="Straightening page" />
          )}
          {selected.stage === "failed" && (
            <ErrorState
              title="Couldn’t straighten this page"
              description="Try again to prepare the scan."
              action={
                <Button
                  variant="secondary"
                  onClick={() => updatePage(selected, {})}
                >
                  Try again
                </Button>
              }
            />
          )}
          {retakeId === selected.id && (
            <p className="muted" role="status">
              Waiting for a replacement from your phone.
            </p>
          )}
          <SegmentedControl
            label="Page appearance"
            options={modes}
            value={selected.request.mode}
            onChange={(value) => {
              const mode = modes.find((option) => option.value === value);
              if (mode) updatePage(selected, { mode: mode.value });
            }}
          />
          <div
            className="scan-page-actions"
            role="group"
            aria-label="Page actions"
          >
            <Button
              variant="secondary"
              disabled={selected.stage === "working"}
              onClick={() =>
                updatePage(selected, {
                  rotation: ((selected.request.rotation + 90) %
                    360) as PageRotation,
                })
              }
            >
              <RotateCw aria-hidden="true" /> Rotate
            </Button>
            <Button
              variant="secondary"
              disabled={!selected.result || selected.stage === "working"}
              onClick={() => setEditingId(selected.id)}
            >
              Edit corners
            </Button>
            <Button
              variant="ghost"
              disabled={!session}
              onClick={() => requestRetake(selected.id)}
            >
              Retake
            </Button>
            <Button variant="ghost" onClick={() => removePage(selected.id)}>
              <Trash2 aria-hidden="true" /> Delete
            </Button>
            {pages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  aria-label="Move page earlier"
                  disabled={index <= 0}
                  onClick={() => orderPage(selected.id, pages[index - 1].id)}
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Move page later"
                  disabled={index >= pages.length - 1}
                  onClick={() => orderPage(selected.id, pages[index + 1].id)}
                >
                  <ArrowRight aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
          {editingId === selected.id && selected.result && (
            <CornerEditor
              key={selected.version}
              jpeg={selected.request.jpeg}
              corners={selected.result.corners}
              onClose={() => setEditingId("")}
              onSave={(corners) => {
                setEditingId("");
                updatePage(selected, { corners });
              }}
            />
          )}
        </>
      )}
    </Card>
  );
}
