import { Download, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PairingSession } from "@phonebridge/rtc";
import { Modal } from "../ui/overlay";
import { Button, Card, ErrorState, ProgressBar } from "../ui/primitives";
import { useBlobUrl } from "../scanner/use-blob-url";
import { confirmAboveBytes, formatFileSize } from "./file-details";
import { FileTransfers } from "./file-transfers";
import type {
  FileNotice,
  FileStatus,
  ReceivedFile,
  TransferView,
} from "./file-transfers";

type SaveWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
  }) => Promise<FileSystemFileHandle>;
};

const idle: FileStatus = { incoming: null, outgoing: null };

function speed(bytesPerSecond: number): string {
  return (
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
      bytesPerSecond / 1_000_000,
    ) + " MB/s"
  );
}

function ReceivedFileRow({
  received,
  remove,
}: {
  received: ReceivedFile;
  remove(): void;
}) {
  const url = useBlobUrl(received.file);
  const picker = (window as SaveWindow).showSaveFilePicker;
  const [fallback, setFallback] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (typeof picker !== "function") return;
    setSaving(true);
    let writable: FileSystemWritableFileStream | undefined;
    try {
      const handle = await picker.call(window, {
        suggestedName: received.name,
      });
      writable = await handle.createWritable();
      await writable.write(received.file);
      await writable.close();
    } catch (error) {
      if (writable) {
        try {
          await writable.abort();
        } catch {
          setFallback(true);
        }
      }
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setFallback(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="file-row">
      <div>
        <p className="state-title file-name">{received.name}</p>
        <p className="muted">
          {formatFileSize(received.file.size)} · {speed(received.rate)}
        </p>
      </div>
      <div className="file-actions">
        {typeof picker === "function" && !fallback ? (
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => void save()}
          >
            <Download aria-hidden="true" /> Save file
          </Button>
        ) : (
          url && (
            <a
              className="ui-button"
              data-variant="secondary"
              href={url}
              download={received.name}
            >
              <Download aria-hidden="true" /> Download file
            </a>
          )
        )}
        <Button variant="ghost" disabled={saving} onClick={remove}>
          Remove
        </Button>
      </div>
      {fallback && (
        <p role="status" className="muted">
          Download the file using your browser.
        </p>
      )}
    </li>
  );
}

function ActiveTransfer({
  transfer,
  direction,
  cancel,
}: {
  transfer: TransferView;
  direction: "incoming" | "outgoing";
  cancel(): void;
}) {
  const percent =
    transfer.size === 0
      ? 100
      : Math.floor((100 * transfer.bytes) / transfer.size);
  const label =
    transfer.phase === "waiting"
      ? "Waiting for approval"
      : transfer.phase === "verifying"
        ? "Checking file"
        : direction === "outgoing"
          ? "Sending file"
          : "Receiving file";

  return (
    <div className="file-row">
      <div>
        <p className="state-title file-name">{transfer.name}</p>
        {transfer.phase === "waiting" ? (
          <p className="muted" role="status">
            {label}
          </p>
        ) : (
          <>
            <ProgressBar label={label} value={percent} />
            <p className="muted">
              {formatFileSize(transfer.bytes)} of{" "}
              {formatFileSize(transfer.size)} · {speed(transfer.rate)}
            </p>
          </>
        )}
      </div>
      <Button
        variant="ghost"
        aria-label={`Cancel ${direction} transfer`}
        onClick={cancel}
      >
        Cancel
      </Button>
    </div>
  );
}

export default function FilePanel({
  session,
  visible = true,
  allowDrop = false,
  showFiles,
}: {
  session: PairingSession | null;
  visible?: boolean;
  allowDrop?: boolean;
  showFiles?: () => void;
}) {
  const controller = useRef<FileTransfers | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<FileStatus>(idle);
  const [received, setReceived] = useState<ReceivedFile[]>([]);
  const [notice, setNotice] = useState<FileNotice | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!session) {
      setStatus(idle);
      return;
    }
    const transfer = new FileTransfers(session, {
      status(value) {
        if (value.incoming?.phase === "waiting") setNotice(null);
        setStatus(value);
      },
      notice: setNotice,
      received(file) {
        setReceived((previous) => [...previous, file]);
      },
    });
    controller.current = transfer;
    return () => {
      controller.current = null;
      transfer.close();
    };
  }, [session]);

  const { incoming, outgoing } = status;
  const confirm =
    incoming &&
    incoming.phase === "waiting" &&
    incoming.size > confirmAboveBytes
      ? incoming
      : null;
  const canSend = Boolean(session) && !outgoing;
  const error =
    notice === "too_large"
      ? "Choose files that are 500 MB or smaller."
      : notice === "failed"
        ? "Keep both devices connected and send the file again."
        : "";

  function send(files: FileList | null) {
    if (!files?.length || !canSend) return;
    setNotice(null);
    controller.current?.send(Array.from(files));
  }

  return (
    <>
      {visible && (
        <Card className="files-panel">
          <h2>Files</h2>
          <div
            className={allowDrop ? "file-drop-zone" : "file-picker"}
            data-dragging={over}
            onDragOver={(event) => {
              if (!allowDrop || !event.dataTransfer.types.includes("Files"))
                return;
              event.preventDefault();
              if (canSend) setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              if (!allowDrop) return;
              event.preventDefault();
              setOver(false);
              send(event.dataTransfer.files);
            }}
          >
            {allowDrop && <p className="muted">Drop files here</p>}
            <Button disabled={!canSend} onClick={() => input.current?.click()}>
              <Upload aria-hidden="true" /> Choose files
            </Button>
            <input
              ref={input}
              type="file"
              hidden
              multiple
              onChange={(event) => {
                send(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          {outgoing && (
            <ActiveTransfer
              transfer={outgoing}
              direction="outgoing"
              cancel={() => controller.current?.cancel("outgoing")}
            />
          )}
          {incoming && !confirm && (
            <ActiveTransfer
              transfer={incoming}
              direction="incoming"
              cancel={() => controller.current?.cancel("incoming")}
            />
          )}
          {error ? (
            <ErrorState title="File transfer stopped" description={error} />
          ) : (
            notice && (
              <p className="muted" role="status">
                {notice === "sent"
                  ? "File sent"
                  : notice === "declined"
                    ? "File declined"
                    : "Transfer canceled"}
              </p>
            )
          )}
          {received.length > 0 && (
            <ul className="file-receipts" aria-label="Received files">
              {received.map((file) => (
                <ReceivedFileRow
                  key={file.id}
                  received={file}
                  remove={() =>
                    setReceived((current) =>
                      current.filter(({ id }) => id !== file.id),
                    )
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      )}
      {!visible &&
        showFiles &&
        (received.length > 0 || (incoming && !confirm)) && (
          <Button variant="secondary" onClick={showFiles}>
            View files
          </Button>
        )}
      {confirm && (
        <Modal
          open
          title="Receive this file?"
          onClose={() => controller.current?.decline()}
        >
          <div>
            <p className="state-title file-name">{confirm.name}</p>
            <p className="muted">{formatFileSize(confirm.size)}</p>
          </div>
          <div className="file-actions">
            <Button
              onClick={() => {
                controller.current?.accept();
                showFiles?.();
              }}
            >
              Receive file
            </Button>
            <Button
              variant="secondary"
              onClick={() => controller.current?.decline()}
            >
              Decline
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
