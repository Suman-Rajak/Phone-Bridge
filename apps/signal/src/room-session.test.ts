import { expect, test, vi } from "vitest";
import type { SignalRole } from "@phonebridge/protocol";
import { RoomSession } from "./room-session.ts";

const token = "A".repeat(22);
const join = (role: SignalRole, room = token) =>
  JSON.stringify({ type: "join", role, room });
const offer = { type: "sdp", description: { type: "offer", sdp: "v=0\r\n" } };
const candidate = {
  type: "ice",
  candidate: { candidate: "candidate:1", sdpMid: "0" },
};

function fakeSocket() {
  let attachment: SignalRole | undefined;
  const messages: unknown[] = [];
  const socket = {
    messages,
    readyState: 1,
    send: vi.fn((message: string) => messages.push(JSON.parse(message))),
    close: vi.fn((_code: number) => {
      socket.readyState = 3;
    }),
    deserializeAttachment: () => attachment,
    serializeAttachment: (role: SignalRole) => {
      attachment = role;
    },
  };
  return socket;
}

function setup() {
  let now = 0;
  const host = fakeSocket();
  const phone = fakeSocket();
  const extra = fakeSocket();
  const ports = {
    sockets: () => [host, phone, extra],
    matchesRoom: (value: string) => value === token,
    now: () => now,
    markPaired: vi.fn(async () => {}),
    clearRoom: vi.fn(async () => {}),
  };
  const room = new RoomSession(ports);
  room.open(600_000);
  return {
    room,
    ports,
    host,
    phone,
    extra,
    setTime: (value: number) => {
      now = value;
    },
  };
}

test("joins two roles, rejects a second phone, and relays separately in both directions", async () => {
  const { room, ports, host, phone, extra } = setup();
  await room.receive(phone, join("phone"));
  expect(phone.messages).toEqual([]);
  await room.receive(host, join("host"));
  expect(ports.markPaired).toHaveBeenCalledTimes(1);
  expect(host.messages).toEqual([{ type: "peer-joined" }]);
  expect(phone.messages).toEqual([{ type: "peer-joined" }]);

  await room.receive(extra, join("phone"));
  expect(extra.messages).toEqual([{ type: "error", code: "room_full" }]);
  expect(extra.close).toHaveBeenCalledWith(1008);
  await room.receive(host, JSON.stringify(offer));
  await room.receive(phone, JSON.stringify(candidate));
  expect(phone.messages).toEqual([{ type: "peer-joined" }, offer]);
  expect(host.messages).toEqual([{ type: "peer-joined" }, candidate]);
  expect(extra.messages).toHaveLength(1);
});

test("refuses wrong rooms and frames that are invalid or arrive before a peer", async () => {
  const { room, host, phone, extra } = setup();
  await room.receive(extra, join("phone", "B".repeat(22)));
  await room.receive(phone, JSON.stringify(candidate));
  expect(phone.messages).toEqual([{ type: "error", code: "join_required" }]);
  expect(extra.messages).toEqual([{ type: "error", code: "room_missing" }]);

  await room.receive(host, join("host"));
  await room.receive(host, JSON.stringify(offer));
  await room.receive(host, JSON.stringify({ ...offer, content: true }));
  expect(host.messages).toEqual([
    { type: "error", code: "peer_missing" },
    { type: "error", code: "invalid_message" },
  ]);
  expect(phone.messages).toHaveLength(1);
});

test("expires an unpaired room at its deadline and clears its storage once", async () => {
  const { room, ports, host, setTime } = setup();
  await room.receive(host, join("host"));
  setTime(599_999);
  await room.expire();
  expect(room.isActive).toBe(true);
  setTime(600_000);
  await room.expire();
  await room.expire();
  expect(host.messages).toEqual([{ type: "error", code: "room_expired" }]);
  expect(room.isActive).toBe(false);
  expect(ports.clearRoom).toHaveBeenCalledTimes(1);
});

test("keeps a paired room after the original deadline and ends it on peer close after restoration", async () => {
  const { room, ports, host, phone, extra, setTime } = setup();
  await room.receive(host, join("host"));
  await room.leave(extra);
  expect(room.isActive).toBe(true);
  await room.receive(phone, join("phone"));

  const restored = new RoomSession(ports);
  restored.open(null);
  setTime(600_001);
  await restored.expire();
  expect(restored.isActive).toBe(true);
  phone.readyState = 3;
  await restored.leave(phone);
  expect(restored.isActive).toBe(false);
  expect(host.messages).toEqual([
    { type: "peer-joined" },
    { type: "peer-left" },
  ]);
  expect(host.close).toHaveBeenCalledWith(1000);
  expect(ports.clearRoom).toHaveBeenCalledTimes(1);
});
