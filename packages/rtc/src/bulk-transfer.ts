import { chunkPayloadMaxBytes, encodeChunk } from "@phonebridge/protocol";

const resumeAt = 1024 * 1024;
const pauseAt = 8 * 1024 * 1024;
const readBytes = 64 * chunkPayloadMaxBytes;

function waitForCapacity(
  channel: RTCDataChannel,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    function cleanup() {
      channel.removeEventListener("bufferedamountlow", ready);
      channel.removeEventListener("close", closed);
      channel.removeEventListener("error", closed);
      signal.removeEventListener("abort", aborted);
    }
    function ready() {
      cleanup();
      resolve();
    }
    function closed() {
      cleanup();
      reject(new Error("The bulk channel closed."));
    }
    function aborted() {
      cleanup();
      reject(signal.reason);
    }
    channel.addEventListener("bufferedamountlow", ready);
    channel.addEventListener("close", closed);
    channel.addEventListener("error", closed);
    signal.addEventListener("abort", aborted);
    if (signal.aborted) aborted();
    else if (channel.readyState !== "open") closed();
    else if (channel.bufferedAmount <= resumeAt) ready();
  });
}

/** Send a blob as protocol frames, pausing when the reliable bulk channel backs up. */
export async function sendBulk(
  channel: RTCDataChannel,
  source: Blob,
  transferId: string,
  signal: AbortSignal,
  progress?: (bytes: number) => void,
): Promise<void> {
  const total = Math.ceil(source.size / chunkPayloadMaxBytes);
  channel.bufferedAmountLowThreshold = resumeAt;
  for (let offset = 0; offset < source.size; offset += readBytes) {
    signal.throwIfAborted();
    const block = new Uint8Array(
      await source.slice(offset, offset + readBytes).arrayBuffer(),
    );
    for (
      let cursor = 0;
      cursor < block.byteLength;
      cursor += chunkPayloadMaxBytes
    ) {
      signal.throwIfAborted();
      if (channel.readyState !== "open")
        throw new Error("The bulk channel closed.");
      if (channel.bufferedAmount >= pauseAt)
        await waitForCapacity(channel, signal);
      signal.throwIfAborted();
      const payload = block.subarray(cursor, cursor + chunkPayloadMaxBytes);
      const frame = encodeChunk({
        transferId,
        index: (offset + cursor) / chunkPayloadMaxBytes,
        total,
        payload,
      });
      channel.send(frame.buffer as ArrayBuffer);
      progress?.(offset + cursor + payload.byteLength);
    }
  }
}
