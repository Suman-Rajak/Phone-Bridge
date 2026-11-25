import { expect, test } from "vitest";
import {
  clipboardMaxBytes,
  decodeMessage,
  messageSchemas,
  validateMessage,
} from "./messages.ts";
import type { Device, Message, MessageChannel } from "./messages.ts";

const id = "00112233-4455-4677-8899-aabbccddeeff";
const base = { v: 1, id, t: 30.25 };
type Case = {
  from: Device;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
};
const phone = "phone";
const laptop = "laptop";
const samples = {
  hello: {
    from: phone,
    valid: { device: phone, caps: ["camera"] },
    invalid: { caps: [true] },
  },
  ping: { from: laptop, valid: { seq: 0 }, invalid: { seq: -1 } },
  pong: {
    from: phone,
    valid: { seq: 0, sentAt: 10, receivedAt: 34, repliedAt: 35 },
    invalid: { repliedAt: null },
  },
  "mode.set": {
    from: phone,
    valid: { mode: "scan" },
    invalid: { mode: "camera" },
  },
  "surface.info": {
    from: laptop,
    valid: { aspect: 16 / 9 },
    invalid: { aspect: 0 },
  },
  "scan.meta": {
    from: phone,
    valid: {
      scanId: id,
      width: 1920,
      height: 1080,
      mime: "image/jpeg",
      bytes: 10,
      capturedAt: 3,
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
    invalid: {
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1.01],
      ],
    },
  },
  "scan.retake": {
    from: laptop,
    valid: { scanId: id },
    invalid: { scanId: "invalid" },
  },
  "file.offer": {
    from: laptop,
    valid: {
      transferId: id,
      name: "scan.jpg",
      size: 0,
      mime: "image/jpeg",
      kind: "file",
    },
    invalid: { kind: "url" },
  },
  "file.accept": {
    from: phone,
    valid: { transferId: id },
    invalid: { transferId: "" },
  },
  "file.reject": {
    from: laptop,
    valid: { transferId: id, reason: "Declined" },
    invalid: { reason: 2 },
  },
  "file.done": {
    from: phone,
    valid: { transferId: id, sha256: "fe".repeat(32) },
    invalid: { sha256: "gg".repeat(32) },
  },
  "file.cancel": {
    from: laptop,
    valid: { transferId: id },
    invalid: { transferId: 5 },
  },
  "clip.text": {
    from: phone,
    valid: { text: "नमस्ते 🌱" },
    invalid: { text: [] },
  },
  "pointer.sample": {
    from: phone,
    valid: { seq: 5, dx: -3.5, dy: 11.9 },
    invalid: { dx: Infinity },
  },
  "pointer.recenter": { from: phone, valid: {}, invalid: { dx: 0 } },
  "laser.set": { from: phone, valid: { on: true }, invalid: { on: "yes" } },
  "slide.next": { from: phone, valid: {}, invalid: { page: 1 } },
  "slide.prev": { from: phone, valid: {}, invalid: { page: 1 } },
  "slide.goto": { from: phone, valid: { page: 2 }, invalid: { page: 0 } },
  "ink.begin": {
    from: phone,
    valid: { strokeId: id, color: "#ff00de", baseWidth: 2 },
    invalid: { color: "blue" },
  },
  "ink.points": {
    from: phone,
    valid: { strokeId: id, pts: [[0.25, 0.75, 4, 1]] },
    invalid: { pts: [[0, 0, 4, -1]] },
  },
  "ink.end": {
    from: phone,
    valid: { strokeId: id },
    invalid: { strokeId: "missing" },
  },
  "ink.undo": { from: phone, valid: {}, invalid: { steps: 3 } },
  "ink.clear": { from: phone, valid: {}, invalid: { all: true } },
  "doccam.state": {
    from: phone,
    valid: { active: true, facingMode: "environment" },
    invalid: { facingMode: "rear" },
  },
  error: {
    from: laptop,
    valid: { code: "room_closed", message: "The session ended." },
    invalid: { code: "" },
  },
} satisfies Record<Message["type"], Case>;

for (const [type, { from, valid, invalid }] of Object.entries(samples)) {
  test(type + " accepts a valid payload and rejects an invalid payload", () => {
    const channel: MessageChannel =
      type === "pointer.sample" ? "rt" : "control";
    const message = { ...base, type, ...valid };
    expect(decodeMessage(JSON.stringify(message), { from, channel })).toEqual({
      ok: true,
      message,
    });
    expect(
      validateMessage({ ...message, ...invalid }, { from, channel }),
    ).toEqual({ ok: false, code: "invalid_message" });
  });
}

test("enforces the UTF-8 clipboard boundary with multibyte text", () => {
  const context = { from: phone, channel: "control" } as const;
  const text = "🌱".repeat(clipboardMaxBytes / 4);
  const message = { ...base, type: "clip.text", text };
  expect(validateMessage(message, context).ok).toBe(true);
  expect(validateMessage({ ...message, text: text + "x" }, context)).toEqual({
    ok: false,
    code: "invalid_message",
  });
});

test("rejects messages on the wrong channel or from the wrong peer", () => {
  expect(
    validateMessage(
      { ...base, type: "scan.retake", scanId: id },
      { from: phone, channel: "control" },
    ),
  ).toEqual({ ok: false, code: "wrong_sender" });
  expect(
    validateMessage(
      { ...base, type: "pointer.sample", ...samples["pointer.sample"].valid },
      { from: phone, channel: "control" },
    ),
  ).toEqual({ ok: false, code: "wrong_channel" });
  expect(
    validateMessage(
      { ...base, type: "ping", seq: 0 },
      { from: laptop, channel: "rt" },
    ),
  ).toEqual({ ok: false, code: "wrong_channel" });
  expect(
    validateMessage(
      { ...base, type: "slide.next" },
      { from: laptop, channel: "control" },
    ),
  ).toEqual({ ok: false, code: "wrong_sender" });
  expect(
    validateMessage(
      { ...base, type: "hello", device: phone, caps: [] },
      { from: laptop, channel: "control" },
    ),
  ).toEqual({ ok: false, code: "wrong_sender" });
  expect(
    validateMessage(
      { ...base, type: "surface.info", aspect: 1 },
      { from: phone, channel: "control" },
    ),
  ).toEqual({ ok: false, code: "wrong_sender" });
});

test("validates the optional replacement ID on scan metadata", () => {
  const message = { ...base, type: "scan.meta", ...samples["scan.meta"].valid };
  const context = { from: phone, channel: "control" } as const;
  expect(validateMessage({ ...message, replacesScanId: id }, context).ok).toBe(
    true,
  );
  expect(
    validateMessage({ ...message, replacesScanId: "invalid" }, context),
  ).toEqual({ ok: false, code: "invalid_message" });
});

test("returns a v1 error payload for an unsupported version without creating an error loop", () => {
  const context = { from: phone, channel: "control" } as const;
  const result = validateMessage({ ...base, v: 2, type: "hello" }, context);
  expect(result).toMatchObject({
    ok: false,
    code: "version_mismatch",
    reply: { type: "error", code: "version_mismatch" },
  });
  if (result.ok || result.code !== "version_mismatch")
    throw new Error("Expected a version rejection");
  expect(
    messageSchemas.error.safeParse({ ...base, ...result.reply }).success,
  ).toBe(true);
  expect(validateMessage({ ...base, v: 2, type: "error" }, context)).toEqual({
    ok: false,
    code: "version_mismatch",
    reply: null,
  });
  expect(
    validateMessage({ ...base, v: "1", type: "slide.next" }, context),
  ).toEqual({ ok: false, code: "invalid_message" });
  expect(decodeMessage("{", context)).toEqual({
    ok: false,
    code: "invalid_message",
  });
});
