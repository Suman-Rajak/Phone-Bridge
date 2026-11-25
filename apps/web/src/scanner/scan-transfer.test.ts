import { chunkPayloadMaxBytes } from "@phonebridge/protocol";
import type { TransferMessage } from "@phonebridge/rtc";
import { expect, test } from "vitest";
import { ScanBuffer } from "./scan-transfer";

test("accepts only the announced scan’s complete, correctly sized ordered frames", () => {
  const scanId = "73414609-4799-4e4e-85a3-dca7650a4d70";
  const metadata: Extract<TransferMessage, { type: "scan.meta" }> = {
    v: 1,
    id: scanId,
    t: 20,
    type: "scan.meta",
    scanId,
    width: 320,
    height: 240,
    mime: "image/jpeg",
    capturedAt: 15,
    bytes: chunkPayloadMaxBytes + 2,
  };
  const buffer = new ScanBuffer(metadata);
  const first = {
    transferId: scanId,
    index: 0,
    total: 2,
    payload: new Uint8Array(chunkPayloadMaxBytes),
  };
  const last = {
    transferId: scanId,
    index: 1,
    total: 2,
    payload: Uint8Array.of(31, 35),
  };
  expect(buffer.push(last)).toBe(false);
  expect(buffer.push({ ...first, total: 3 })).toBe(false);
  expect(buffer.push(first)).toBe(true);
  expect(buffer.push(first)).toBe(false);
  expect(buffer.push({ ...last, payload: Uint8Array.of(31, 35, 40) })).toBe(
    false,
  );
  expect(buffer.complete).toBe(false);
  expect(buffer.push(last)).toBe(true);
  expect(buffer.complete).toBe(true);
  expect(new Uint8Array(buffer.takeParts()[1])).toEqual(last.payload);
});
