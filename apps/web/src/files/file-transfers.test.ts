import { expect, test, vi } from "vitest";
import { BulkBuffer } from "@phonebridge/rtc";
import type { PairingSession, TransferMessage } from "@phonebridge/rtc";
import { chunkPayloadMaxBytes } from "@phonebridge/protocol";
import { confirmAboveBytes, maximumFileBytes } from "./file-details";
import { FileTransfers } from "./file-transfers";

const id = "eb43185d-ec64-42ca-92aa-5c368a48e912";
const other = "238f8f1e-681e-4475-b846-8216b68f31af";

function offer(transferId: string, size: number): TransferMessage {
  return {
    v: 1,
    id,
    t: 3,
    type: "file.offer",
    transferId,
    size,
    name: "CON.txt",
    mime: "application/octet-stream",
    kind: "file",
  };
}

function session() {
  let observer: Parameters<PairingSession["observeTransfers"]>[0] = {};
  const sendTransferControl = vi.fn();
  const onStatus = vi.fn();
  const notice = vi.fn();
  const connection = new FileTransfers(
    {
      observeTransfers(value) {
        observer = value;
        return () => {
          observer = {};
        };
      },
      sendTransferBytes: vi.fn().mockResolvedValue(undefined),
      sendTransferControl,
    },
    { status: onStatus, notice, received: vi.fn() },
  );
  return { observer, connection, sendTransferControl, onStatus, notice };
}

test("accepts the exact 50 MB boundary and rejects offers above 500 MB", () => {
  const { observer, connection, sendTransferControl } = session();
  try {
    observer.control?.(offer(id, maximumFileBytes + 1));
    expect(sendTransferControl).toHaveBeenLastCalledWith({
      type: "file.reject",
      transferId: id,
    });
    observer.control?.(offer(other, confirmAboveBytes));
    expect(sendTransferControl).toHaveBeenLastCalledWith({
      type: "file.accept",
      transferId: other,
    });
  } finally {
    connection.close();
  }
});

test("asks above 50 MB and clears the active receiver on cancel", () => {
  const { observer, connection, sendTransferControl, onStatus, notice } =
    session();
  try {
    const size = confirmAboveBytes + 1;
    observer.control?.(offer(id, size));
    expect(sendTransferControl).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith({
      incoming: expect.objectContaining({ phase: "waiting", name: "_CON.txt" }),
      outgoing: null,
    });
    connection.accept();
    expect(sendTransferControl).toHaveBeenLastCalledWith({
      type: "file.accept",
      transferId: id,
    });
    const chunk = {
      transferId: id,
      index: 0,
      total: Math.ceil(size / chunkPayloadMaxBytes),
      payload: new Uint8Array(chunkPayloadMaxBytes),
    };
    observer.bulk?.(chunk);
    connection.cancel("incoming");
    expect(sendTransferControl).toHaveBeenLastCalledWith({
      type: "file.cancel",
      transferId: id,
    });
    expect(onStatus).toHaveBeenLastCalledWith({
      incoming: null,
      outgoing: null,
    });
    expect(notice).toHaveBeenLastCalledWith("canceled");
    observer.bulk?.(chunk);
    observer.control?.(offer(other, 12));
    expect(sendTransferControl).toHaveBeenLastCalledWith({
      type: "file.accept",
      transferId: other,
    });
  } finally {
    connection.close();
  }
});

test("drains retained chunks and supports a zero-byte file", () => {
  const buffer = new BulkBuffer(id, 3);
  expect(
    buffer.push({
      transferId: id,
      index: 0,
      total: 1,
      payload: Uint8Array.of(7, 8, 9),
    }),
  ).toBe(true);
  expect(buffer.receivedBytes).toBe(3);
  expect(buffer.takeParts()).toHaveLength(1);
  expect(buffer.receivedBytes).toBe(0);
  expect(buffer.takeParts()).toHaveLength(0);
  expect(new BulkBuffer(other, 0).complete).toBe(true);
});
