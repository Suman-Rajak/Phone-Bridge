import { chunkPayloadMaxBytes } from "@phonebridge/protocol";
import type { BulkChunk } from "@phonebridge/protocol";
import type { PairingSession, TransferMessage } from "@phonebridge/rtc";
import { scanPixelLimit, scanSizeLimit } from "./scan-media";
import type { ScanMediaResult } from "./scan-media";
import { runScanMedia } from "./scan-media-client";

type ScanMeta = Extract<TransferMessage, { type: "scan.meta" }>;
type ScanDetails = Pick<ScanMeta, "corners" | "capturedAt" | "replacesScanId">;
export type RetakeRequest = { scanId: string; requestId: string };
type TransferPeer = Pick<
  PairingSession,
  "observeTransfers" | "sendTransferControl" | "sendTransferBytes"
>;
type ReceivePeer = Pick<
  TransferPeer,
  "observeTransfers" | "sendTransferControl"
>;
const transferTimeoutMs = 45_000;

export type ReceivedScan = { metadata: ScanMeta; jpeg: Blob };

function cancelTransfer(peer: ReceivePeer, transferId: string) {
  try {
    peer.sendTransferControl({ type: "file.cancel", transferId });
  } catch {
    // A closed peer releases its buffers when its session expires.
  }
}

function expectControl(
  peer: TransferPeer,
  transferId: string,
  signal: AbortSignal,
  isExpected: (message: TransferMessage) => boolean,
  publish: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => finish(new Error("The transfer timed out.")),
      transferTimeoutMs,
    );
    const unsubscribe = peer.observeTransfers({
      control(message) {
        if (!("transferId" in message) || message.transferId !== transferId)
          return;
        if (message.type === "file.reject" || message.type === "file.cancel") {
          finish(new Error("The laptop could not receive the scan."));
        } else if (isExpected(message)) {
          finish();
        }
      },
    });
    function finish(error?: unknown) {
      unsubscribe();
      clearTimeout(deadline);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve();
    }
    function aborted() {
      finish(signal.reason);
    }
    signal.addEventListener("abort", aborted, { once: true });
    try {
      signal.throwIfAborted();
      publish();
    } catch (error) {
      finish(error);
    }
  });
}

/** Send and wait for the laptop to acknowledge the verified scan. */
export async function sendScan(
  peer: TransferPeer,
  photo: ScanMediaResult,
  details: ScanDetails,
  signal: AbortSignal,
): Promise<void> {
  const scanId = crypto.randomUUID();
  try {
    await expectControl(
      peer,
      scanId,
      signal,
      (message) => message.type === "file.accept",
      () => {
        peer.sendTransferControl({
          type: "scan.meta",
          scanId,
          width: photo.width,
          height: photo.height,
          mime: "image/jpeg",
          bytes: photo.jpeg.size,
          ...details,
        });
      },
    );
    await peer.sendTransferBytes(photo.jpeg, scanId, signal);
    await expectControl(
      peer,
      scanId,
      signal,
      (message) =>
        message.type === "file.done" && message.sha256 === photo.sha256,
      () =>
        peer.sendTransferControl({
          type: "file.done",
          transferId: scanId,
          sha256: photo.sha256,
        }),
    );
  } catch (error) {
    cancelTransfer(peer, scanId);
    throw error;
  }
}

export class ScanBuffer {
  readonly total: number;
  private readonly parts: ArrayBuffer[] = [];

  constructor(readonly metadata: ScanMeta) {
    this.total = Math.ceil(metadata.bytes / chunkPayloadMaxBytes);
  }

  get complete(): boolean {
    return this.parts.length === this.total;
  }

  push(chunk: BulkChunk): boolean {
    const size = Math.min(
      chunkPayloadMaxBytes,
      this.metadata.bytes - chunk.index * chunkPayloadMaxBytes,
    );
    if (
      chunk.transferId !== this.metadata.scanId ||
      chunk.total !== this.total ||
      chunk.index !== this.parts.length ||
      chunk.payload.byteLength !== size
    )
      return false;
    this.parts.push(chunk.payload.slice().buffer);
    return true;
  }

  takeParts(): ArrayBuffer[] {
    return this.parts.splice(0);
  }
}

type Pending = {
  buffer: ScanBuffer;
  abort: AbortController;
  deadline: ReturnType<typeof setTimeout>;
  sha256?: string;
  verifying: boolean;
};

/** Accept one bounded scan at a time and publish its JPEG after worker verification. */
export function receiveScans(
  peer: ReceivePeer,
  callbacks: {
    received(scan: ReceivedScan): void;
    failed(): void;
    acceptReplacement?(id: string): boolean;
  },
): () => void {
  let active: Pending | undefined;
  function clear(scan: Pending) {
    if (active === scan) active = undefined;
    clearTimeout(scan.deadline);
    scan.abort.abort();
    scan.buffer.takeParts();
  }
  function reject(transferId: string) {
    try {
      peer.sendTransferControl({ type: "file.reject", transferId });
    } catch {
      // Pairing already closed, so there is no recipient to notify.
    }
  }
  function fail(scan: Pending) {
    if (active !== scan) return;
    clear(scan);
    reject(scan.buffer.metadata.scanId);
    callbacks.failed();
  }
  async function verify(scan: Pending) {
    if (scan.verifying || !scan.sha256 || !scan.buffer.complete) return;
    scan.verifying = true;
    const metadata = scan.buffer.metadata;
    try {
      const result = await runScanMedia(
        {
          type: "verify",
          parts: scan.buffer.takeParts(),
          sha256: scan.sha256,
          width: metadata.width,
          height: metadata.height,
        },
        scan.abort.signal,
      );
      if (active !== scan) return;
      peer.sendTransferControl({
        type: "file.done",
        transferId: metadata.scanId,
        sha256: result.sha256,
      });
      clear(scan);
      callbacks.received({ metadata, jpeg: result.jpeg });
    } catch {
      fail(scan);
    }
  }
  const unsubscribe = peer.observeTransfers({
    control(message) {
      if (message.type === "scan.meta") {
        if (
          active ||
          (message.replacesScanId &&
            !callbacks.acceptReplacement?.(message.replacesScanId)) ||
          message.bytes > scanSizeLimit ||
          message.width * message.height > scanPixelLimit
        ) {
          reject(message.scanId);
          return;
        }
        const scan: Pending = {
          buffer: new ScanBuffer(message),
          abort: new AbortController(),
          deadline: setTimeout(() => fail(scan), transferTimeoutMs),
          verifying: false,
        };
        active = scan;
        try {
          peer.sendTransferControl({
            type: "file.accept",
            transferId: message.scanId,
          });
        } catch {
          clear(scan);
        }
        return;
      }
      if (
        !active ||
        !("transferId" in message) ||
        message.transferId !== active.buffer.metadata.scanId
      )
        return;
      if (message.type === "file.cancel") clear(active);
      if (message.type === "file.done" && !active.sha256) {
        active.sha256 = message.sha256.toLowerCase();
        void verify(active);
      }
    },
    bulk(chunk) {
      if (
        !active ||
        active.verifying ||
        chunk.transferId !== active.buffer.metadata.scanId
      )
        return;
      if (!active.buffer.push(chunk)) fail(active);
      else void verify(active);
    },
  });
  return () => {
    unsubscribe();
    if (active) clear(active);
  };
}
