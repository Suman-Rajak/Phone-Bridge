import { chunkPayloadMaxBytes, encodeChunk } from "@phonebridge/protocol";

const resumeAt = 1024 * 1024;
const pauseAt = 8 * 1024 * 1024;

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
): Promise<void> {
  const total = Math.ceil(source.size / chunkPayloadMaxBytes);
  channel.bufferedAmountLowThreshold = resumeAt;
  for (let index = 0; index < total; index++) {
    signal.throwIfAborted();
    if (channel.readyState !== "open")
      throw new Error("The bulk channel closed.");
    if (channel.bufferedAmount >= pauseAt)
      await waitForCapacity(channel, signal);
    const offset = index * chunkPayloadMaxBytes;
    const bytes = await source
      .slice(offset, offset + chunkPayloadMaxBytes)
      .arrayBuffer();
    signal.throwIfAborted();
    const frame = encodeChunk({
      transferId,
      index,
      total,
      payload: new Uint8Array(bytes),
    });
    channel.send(frame.buffer as ArrayBuffer);
  }
}
