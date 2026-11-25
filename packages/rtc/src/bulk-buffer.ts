import { chunkPayloadMaxBytes } from "@phonebridge/protocol";
import type { BulkChunk } from "@phonebridge/protocol";

/** Collect bounded, ordered chunks for one accepted transfer. */
export class BulkBuffer {
  readonly total: number;
  private readonly parts: ArrayBuffer[] = [];
  private count = 0;

  constructor(
    readonly transferId: string,
    readonly bytes: number,
  ) {
    if (!Number.isSafeInteger(bytes) || bytes < 0)
      throw new RangeError("Invalid transfer byte length.");
    this.total = Math.ceil(bytes / chunkPayloadMaxBytes);
  }

  get complete(): boolean {
    return this.parts.length === this.total;
  }

  get receivedBytes(): number {
    return this.count;
  }

  push(chunk: BulkChunk): boolean {
    const size = Math.min(
      chunkPayloadMaxBytes,
      this.bytes - chunk.index * chunkPayloadMaxBytes,
    );
    if (
      chunk.transferId !== this.transferId ||
      chunk.total !== this.total ||
      chunk.index !== this.parts.length ||
      chunk.payload.byteLength !== size ||
      size <= 0
    )
      return false;
    this.parts.push(chunk.payload.slice().buffer);
    this.count += size;
    return true;
  }

  takeParts(): ArrayBuffer[] {
    this.count = 0;
    return this.parts.splice(0);
  }
}
