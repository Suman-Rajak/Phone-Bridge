import { expect, test } from "vitest";
import { decodeSignalClient, decodeSignalServer } from "./signaling.ts";

const room = "A".repeat(22);
const cases = [
  { type: "join", role: "host", room },
  { type: "sdp", description: { type: "offer", sdp: "v=0\r\n" } },
  {
    type: "ice",
    candidate: {
      candidate: "candidate:1",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: null,
    },
  },
  { type: "ice", candidate: null },
];

test.each(cases)(
  "accepts the $type signaling payload and rejects unknown fields",
  (message) => {
    expect(decodeSignalClient(JSON.stringify(message))).toEqual(message);
    expect(
      decodeSignalClient(JSON.stringify({ ...message, content: "unexpected" })),
    ).toBeNull();
    if (message.type !== "join")
      expect(decodeSignalServer(JSON.stringify(message))).toEqual(message);
  },
);

test.each([
  { type: "peer-joined" },
  { type: "peer-left" },
  { type: "error", code: "room_full" },
])("accepts the $type notification only in the server direction", (message) => {
  expect(decodeSignalServer(JSON.stringify(message))).toEqual(message);
  expect(decodeSignalClient(JSON.stringify(message))).toBeNull();
  expect(
    decodeSignalServer(JSON.stringify({ ...message, data: true })),
  ).toBeNull();
});

test("rejects malformed or oversized signaling frames", () => {
  expect(decodeSignalClient("{")).toBeNull();
  expect(decodeSignalClient(new ArrayBuffer(8))).toBeNull();
  expect(
    decodeSignalClient(
      JSON.stringify({ type: "join", role: "host", room: "short" }),
    ),
  ).toBeNull();
  expect(
    decodeSignalClient(
      JSON.stringify({
        type: "sdp",
        description: { type: "rollback", sdp: "v=0" },
      }),
    ),
  ).toBeNull();
  expect(
    decodeSignalClient(
      JSON.stringify({
        type: "sdp",
        description: { type: "offer", sdp: "x".repeat(65537) },
      }),
    ),
  ).toBeNull();
});
