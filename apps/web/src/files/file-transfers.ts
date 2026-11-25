import { BulkBuffer } from "@phonebridge/rtc";
import type { PairingSession, TransferMessage } from "@phonebridge/rtc";
import type { BulkChunk } from "@phonebridge/protocol";
import {
  confirmAboveBytes,
  maximumFileBytes,
  safeFileName,
} from "./file-details";
import { hashFile } from "./file-hash-client";

type FilePeer = Pick<
  PairingSession,
  "observeTransfers" | "sendTransferControl" | "sendTransferBytes"
>;
type Phase = "waiting" | "receiving" | "sending" | "verifying";
export type TransferView = {
  id: string;
  name: string;
  size: number;
  bytes: number;
  rate: number;
  phase: Phase;
};
export type ReceivedFile = {
  id: string;
  name: string;
  file: Blob;
  rate: number;
};
export type FileNotice =
  "sent" | "canceled" | "declined" | "too_large" | "failed";
export type FileStatus = {
  incoming: TransferView | null;
  outgoing: TransferView | null;
};

type Active = {
  view: TransferView;
  signal: AbortController;
  started: number;
  sampled: number;
  timer?: ReturnType<typeof setTimeout>;
  digest?: string;
};
type Incoming = Active & { buffer?: BulkBuffer };
type Outgoing = Active & { file: File };

const progressInterval = 125;
const inactiveMs = 30_000;
const confirmationMs = 90_000;

function transfer(id: string, name: string, size: number): Active {
  return {
    view: { id, name, size, bytes: 0, rate: 0, phase: "waiting" },
    signal: new AbortController(),
    started: 0,
    sampled: 0,
  };
}

/** Own one incoming and one outgoing file flow for the paired session. */
export class FileTransfers {
  private incoming: Incoming | undefined;
  private outgoing: Outgoing | undefined;
  private readonly queue: File[] = [];
  private readonly unsubscribe: () => void;

  constructor(
    private readonly peer: FilePeer,
    private readonly callbacks: {
      status(value: FileStatus): void;
      notice(value: FileNotice): void;
      received(value: ReceivedFile): void;
    },
  ) {
    this.unsubscribe = peer.observeTransfers({
      control: (message) => this.handleControl(message),
      bulk: (chunk) => this.handleChunk(chunk),
    });
  }

  close(): void {
    this.unsubscribe();
    this.queue.length = 0;
    if (this.incoming) this.clearIncoming(this.incoming);
    if (this.outgoing) this.clearOutgoing(this.outgoing);
  }

  send(files: readonly File[]): void {
    for (const file of files) {
      if (file.size > maximumFileBytes) this.callbacks.notice("too_large");
      else this.queue.push(file);
    }
    this.offerNext();
  }

  accept(): void {
    const incoming = this.incoming;
    if (!incoming || incoming.view.phase !== "waiting") return;
    incoming.buffer = new BulkBuffer(incoming.view.id, incoming.view.size);
    incoming.started = performance.now();
    this.phase(incoming, "receiving");
    try {
      this.peer.sendTransferControl({
        type: "file.accept",
        transferId: incoming.view.id,
      });
    } catch {
      this.failIncoming(incoming, "failed");
    }
  }

  decline(): void {
    const incoming = this.incoming;
    if (!incoming || incoming.view.phase !== "waiting") return;
    this.reply("file.reject", incoming.view.id);
    this.failIncoming(incoming, "declined");
  }

  cancel(direction: "incoming" | "outgoing"): void {
    const active = direction === "incoming" ? this.incoming : this.outgoing;
    if (!active) return;
    this.reply("file.cancel", active.view.id);
    if (direction === "incoming" && this.incoming)
      this.failIncoming(this.incoming, "canceled");
    if (direction === "outgoing" && this.outgoing)
      this.failOutgoing(this.outgoing, "canceled");
  }

  private publish(): void {
    this.callbacks.status({
      incoming: this.incoming?.view ?? null,
      outgoing: this.outgoing?.view ?? null,
    });
  }

  private phase(job: Active, phase: Phase): void {
    job.view = { ...job.view, phase };
    this.arm(job);
    this.publish();
  }

  private arm(job: Active): void {
    clearTimeout(job.timer);
    job.timer = setTimeout(
      () => {
        if (this.incoming === job) {
          this.reply("file.cancel", job.view.id);
          this.failIncoming(this.incoming, "failed");
        } else if (this.outgoing === job) {
          this.reply("file.cancel", job.view.id);
          this.failOutgoing(this.outgoing, "failed");
        }
      },
      job.view.phase === "waiting" ? confirmationMs : inactiveMs,
    );
  }

  private updateProgress(job: Active, bytes: number): void {
    const time = performance.now();
    if (bytes < job.view.size && time - job.sampled < progressInterval) return;
    job.sampled = time;
    job.view = {
      ...job.view,
      bytes,
      rate: bytes / Math.max(0.001, (time - job.started) / 1000),
    };
    this.arm(job);
    this.publish();
  }

  private reply(type: "file.cancel" | "file.reject", transferId: string): void {
    try {
      this.peer.sendTransferControl({ type, transferId });
    } catch {
      // Local cleanup still applies if the paired connection has already closed.
    }
  }

  private offerNext(): void {
    if (this.outgoing) return;
    const file = this.queue.shift();
    if (!file) return;
    const outgoing: Outgoing = {
      ...transfer(crypto.randomUUID(), safeFileName(file.name), file.size),
      file,
    };
    this.outgoing = outgoing;
    this.arm(outgoing);
    this.publish();
    try {
      this.peer.sendTransferControl({
        type: "file.offer",
        transferId: outgoing.view.id,
        name: outgoing.view.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        kind: "file",
      });
    } catch {
      this.failOutgoing(outgoing, "failed");
    }
  }

  private async startSending(outgoing: Outgoing): Promise<void> {
    outgoing.started = performance.now();
    this.phase(outgoing, "sending");
    try {
      const signal = outgoing.signal.signal;
      const [{ digest }] = await Promise.all([
        hashFile({ type: "digest", file: outgoing.file }, signal),
        this.peer.sendTransferBytes(
          outgoing.file,
          outgoing.view.id,
          signal,
          (bytes) => this.updateProgress(outgoing, bytes),
        ),
      ]);
      if (this.outgoing !== outgoing) return;
      this.updateProgress(outgoing, outgoing.view.size);
      outgoing.digest = digest;
      this.phase(outgoing, "verifying");
      this.peer.sendTransferControl({
        type: "file.done",
        transferId: outgoing.view.id,
        sha256: digest,
      });
    } catch {
      if (this.outgoing !== outgoing) return;
      this.reply("file.cancel", outgoing.view.id);
      this.failOutgoing(outgoing, "failed");
    }
  }

  private handleControl(message: TransferMessage): void {
    if (message.type === "file.offer") {
      if (message.kind !== "file") return;
      if (
        this.incoming ||
        message.size > maximumFileBytes ||
        this.outgoing?.view.id === message.transferId
      ) {
        this.reply("file.reject", message.transferId);
        return;
      }
      this.incoming = transfer(
        message.transferId,
        safeFileName(message.name),
        message.size,
      );
      this.arm(this.incoming);
      this.publish();
      if (message.size <= confirmAboveBytes) this.accept();
      return;
    }
    if (!("transferId" in message)) return;
    const incoming =
      this.incoming?.view.id === message.transferId ? this.incoming : undefined;
    const outgoing =
      this.outgoing?.view.id === message.transferId ? this.outgoing : undefined;
    if (message.type === "file.cancel") {
      if (incoming) this.failIncoming(incoming, "canceled");
      if (outgoing) this.failOutgoing(outgoing, "canceled");
    } else if (message.type === "file.reject" && outgoing) {
      this.failOutgoing(
        outgoing,
        outgoing.view.phase === "waiting" ? "declined" : "failed",
      );
    } else if (
      message.type === "file.accept" &&
      outgoing?.view.phase === "waiting"
    ) {
      void this.startSending(outgoing);
    } else if (message.type === "file.done") {
      const digest = message.sha256.toLowerCase();
      if (incoming?.view.phase === "receiving" && !incoming.digest) {
        incoming.digest = digest;
        void this.verifyIncoming(incoming);
      } else if (outgoing?.view.phase === "verifying") {
        if (outgoing.digest === digest) this.finishOutgoing(outgoing, "sent");
        else this.failOutgoing(outgoing, "failed");
      }
    }
  }

  private handleChunk(chunk: BulkChunk): void {
    const incoming = this.incoming;
    if (
      !incoming ||
      incoming.view.phase !== "receiving" ||
      !incoming.buffer ||
      incoming.view.id !== chunk.transferId
    )
      return;
    if (!incoming.buffer.push(chunk)) {
      this.reply("file.reject", incoming.view.id);
      this.failIncoming(incoming, "failed");
      return;
    }
    this.updateProgress(incoming, incoming.buffer.receivedBytes);
    void this.verifyIncoming(incoming);
  }

  private async verifyIncoming(incoming: Incoming): Promise<void> {
    if (
      !incoming.digest ||
      !incoming.buffer?.complete ||
      incoming.view.phase !== "receiving"
    )
      return;
    this.phase(incoming, "verifying");
    try {
      const result = await hashFile(
        {
          type: "verify",
          expected: incoming.digest,
          parts: incoming.buffer.takeParts(),
        },
        incoming.signal.signal,
      );
      if (this.incoming !== incoming || !result.file) return;
      const { id, name, rate } = incoming.view;
      this.peer.sendTransferControl({
        type: "file.done",
        transferId: id,
        sha256: result.digest,
      });
      this.clearIncoming(incoming);
      this.callbacks.received({ id, name, file: result.file, rate });
      this.publish();
    } catch {
      if (this.incoming !== incoming) return;
      this.reply("file.reject", incoming.view.id);
      this.failIncoming(incoming, "failed");
    }
  }

  private clearIncoming(incoming: Incoming) {
    this.incoming = undefined;
    clearTimeout(incoming.timer);
    incoming.signal.abort();
    incoming.buffer?.takeParts();
  }

  private clearOutgoing(outgoing: Outgoing) {
    this.outgoing = undefined;
    clearTimeout(outgoing.timer);
    outgoing.signal.abort();
  }

  private failIncoming(incoming: Incoming, notice: FileNotice) {
    this.clearIncoming(incoming);
    this.callbacks.notice(notice);
    this.publish();
  }

  private finishOutgoing(outgoing: Outgoing, notice: FileNotice) {
    this.clearOutgoing(outgoing);
    this.callbacks.notice(notice);
    this.publish();
    this.offerNext();
  }

  private failOutgoing(outgoing: Outgoing, notice: FileNotice) {
    this.queue.length = 0;
    this.finishOutgoing(outgoing, notice);
  }
}
