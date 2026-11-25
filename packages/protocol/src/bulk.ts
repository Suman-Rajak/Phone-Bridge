import { uuidSchema } from "./messages.ts";

export const chunkMaxBytes = 16 * 1024;
export const chunkHeaderBytes = 24;
export const chunkPayloadMaxBytes = chunkMaxBytes - chunkHeaderBytes;
const uint32Max = 0xffff_ffff;

export type BulkChunk = {
  transferId: string;
  index: number;
  total: number;
  payload: Uint8Array;
};

function validateChunk(index: number, total: number, length: number): void {
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    index < 0 ||
    total > uint32Max ||
    index >= total
  ) {
    throw new RangeError(
      "Chunk index must be within the declared uint32 chunk count.",
    );
  }
  if (length < 1 || length > chunkPayloadMaxBytes) {
    throw new RangeError("Chunk payload length is outside the wire bounds.");
  }
}

/** Encode a UUID and big-endian chunk counters into the 24-byte bulk header. */
export function encodeChunk({
  transferId,
  index,
  total,
  payload,
}: BulkChunk): Uint8Array {
  validateChunk(index, total, payload.byteLength);
  const hex = uuidSchema.parse(transferId).replaceAll("-", "");
  const wire = new Uint8Array(chunkHeaderBytes + payload.byteLength);
  for (let byte = 0; byte < 16; byte++) {
    wire[byte] = Number.parseInt(hex.slice(byte * 2, byte * 2 + 2), 16);
  }
  const header = new DataView(wire.buffer);
  header.setUint32(16, index, false);
  header.setUint32(20, total, false);
  wire.set(payload, chunkHeaderBytes);
  return wire;
}

/** Check bulk frame bounds and return a payload view of the supplied bytes. */
export function decodeChunk(wire: Uint8Array): BulkChunk {
  if (wire.byteLength <= chunkHeaderBytes || wire.byteLength > chunkMaxBytes) {
    throw new RangeError("Bulk frame length is outside the wire bounds.");
  }
  const header = new DataView(wire.buffer, wire.byteOffset, wire.byteLength);
  const index = header.getUint32(16, false);
  const total = header.getUint32(20, false);
  const payload = wire.subarray(chunkHeaderBytes);
  validateChunk(index, total, payload.byteLength);
  const hex = Array.from(wire.subarray(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const transferId = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
  return { transferId: uuidSchema.parse(transferId), index, total, payload };
}
