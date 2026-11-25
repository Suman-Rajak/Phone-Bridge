import { expect, test } from "vitest";
import {
  chunkHeaderBytes,
  chunkMaxBytes,
  chunkPayloadMaxBytes,
  decodeChunk,
  encodeChunk,
} from "./bulk.ts";
import { deriveSas, normalizeFingerprint } from "./sas.ts";

const transferId = "00112233-4455-4677-8899-aabbccddeeff";
const sample = {
  transferId,
  index: 0x01020304,
  total: 0x05060708,
  payload: new Uint8Array([9, 10]),
};

test("encodes UUID bytes and big-endian counters and handles a view with an offset", () => {
  const chunk = encodeChunk(sample);
  expect([...chunk.subarray(0, 16)]).toEqual([
    0, 17, 34, 51, 68, 85, 70, 119, 136, 153, 170, 187, 204, 221, 238, 255,
  ]);
  expect([...chunk.subarray(16)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const backing = new Uint8Array(chunk.length + 4);
  backing.set(chunk, 2);
  expect(decodeChunk(backing.subarray(2, -2))).toEqual(sample);
});

test("validates the frame size, UUID, and chunk position", () => {
  const wire = encodeChunk({
    ...sample,
    payload: new Uint8Array(chunkPayloadMaxBytes),
  });
  expect(wire.length).toBe(chunkMaxBytes);
  expect(decodeChunk(wire).payload.length).toBe(chunkPayloadMaxBytes);
  expect(() =>
    encodeChunk({
      ...sample,
      payload: new Uint8Array(chunkPayloadMaxBytes + 1),
    }),
  ).toThrow(RangeError);
  expect(() => encodeChunk({ ...sample, index: -1 })).toThrow(RangeError);
  expect(() => encodeChunk({ ...sample, transferId: "bad" })).toThrow();
  expect(() => decodeChunk(new Uint8Array(chunkHeaderBytes))).toThrow(
    RangeError,
  );
  expect(() => decodeChunk(new Uint8Array(chunkMaxBytes + 1))).toThrow(
    RangeError,
  );
  wire.fill(0, 20, 24);
  expect(() => decodeChunk(wire)).toThrow(RangeError);
});

test("derives the four-digit SAS from canonical fingerprints in either order", async () => {
  const a = "00".repeat(32);
  const b = "FF:".repeat(31) + "FF";
  expect(normalizeFingerprint("sha-256 " + b)).toBe("ff".repeat(32));
  expect(await deriveSas(a, b)).toBe("8846");
  expect(await deriveSas(b, a)).toBe("8846");
  expect(await deriveSas(a, a)).toMatch(/^\d{4}$/);
  await expect(deriveSas(a, "sha-1 " + b)).rejects.toThrow(TypeError);
});
