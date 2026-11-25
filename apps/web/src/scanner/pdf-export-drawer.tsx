import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { buildScanPdf } from "@phonebridge/pdf/worker";
import type { PdfPage } from "@phonebridge/pdf/worker";
import { Drawer } from "../ui/overlay";
import { Button, ErrorState, ProgressBar } from "../ui/primitives";
import { useBlobUrl } from "./use-blob-url";

export default function PdfExportDrawer({
  pages,
  onClose,
}: {
  pages: readonly PdfPage[];
  onClose(): void;
}) {
  const [target, setTarget] = useState("500");
  const [progress, setProgress] = useState<number | null>(null);
  const [file, setFile] = useState<Blob>();
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const url = useBlobUrl(file);

  useEffect(() => () => active.current?.abort(), []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const targetBytes = Math.round(Number(target) * 1000);
    if (!Number.isSafeInteger(targetBytes) || targetBytes <= 0) {
      setError("Enter a positive size in KB.");
      return;
    }
    setFile(undefined);
    setError("");
    setProgress(0);
    const job = new AbortController();
    active.current = job;
    try {
      const pdf = await buildScanPdf(
        { pages, targetBytes },
        job.signal,
        setProgress,
      );
      if (!job.signal.aborted) setFile(pdf);
    } catch (failure) {
      if (!job.signal.aborted) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Try creating the PDF again.",
        );
      }
    } finally {
      if (active.current === job) {
        active.current = null;
        if (!job.signal.aborted) setProgress(null);
      }
    }
  }

  return (
    <Drawer open title="Export PDF" onClose={onClose}>
      <p className="muted">
        {pages.length} {pages.length === 1 ? "page" : "pages"} in tray order
      </p>
      <form
        className="pdf-target-form"
        onSubmit={(event) => void create(event)}
      >
        <label>
          <span>Target size (KB)</span>
          <input
            type="number"
            required
            min="0.001"
            step="0.001"
            value={target}
            disabled={progress !== null}
            onChange={(event) => {
              setTarget(event.target.value);
              setFile(undefined);
              setError("");
            }}
          />
        </label>
        <Button type="submit" disabled={progress !== null}>
          Create PDF
        </Button>
      </form>
      {progress !== null && (
        <ProgressBar label="Creating PDF" value={progress} />
      )}
      {error && (
        <ErrorState title="Couldn’t create the PDF" description={error} />
      )}
      {url && file && (
        <div className="pdf-result">
          <output aria-label="Final size">
            {new Intl.NumberFormat(undefined, {
              maximumFractionDigits: 3,
            }).format(file.size / 1000)}{" "}
            KB
          </output>
          <a
            className="ui-button"
            data-variant="primary"
            href={url}
            download="phonebridge-scans.pdf"
          >
            Download PDF
          </a>
        </div>
      )}
    </Drawer>
  );
}
