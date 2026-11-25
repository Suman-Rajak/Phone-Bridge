import { z } from "zod";

export const protocolVersion = 1;
export const clipboardMaxBytes = 1_000_000;
export const uuidSchema = z.uuid();

const device = z.enum(["laptop", "phone"]);
const milliseconds = z.number().nonnegative();
const sequence = z.int().min(0).max(0xffff_ffff);
const normalized = z.number().min(0).max(1);
const point = z.tuple([normalized, normalized]);
const transfer = { transferId: uuidSchema };
const stroke = { strokeId: uuidSchema };
const envelope = z.strictObject({
  v: z.literal(protocolVersion),
  id: uuidSchema,
  t: milliseconds,
});
const utf8 = new TextEncoder();

export const messageSchemas = {
  hello: envelope.extend({
    type: z.literal("hello"),
    device,
    caps: z.array(z.string()),
  }),
  ping: envelope.extend({ type: z.literal("ping"), seq: sequence }),
  pong: envelope.extend({
    type: z.literal("pong"),
    seq: sequence,
    sentAt: milliseconds,
    receivedAt: milliseconds,
    repliedAt: milliseconds,
  }),
  "mode.set": envelope.extend({
    type: z.literal("mode.set"),
    mode: z.enum(["scan", "doccam", "clicker", "ink", "clipboard"]),
  }),
  "surface.info": envelope.extend({
    type: z.literal("surface.info"),
    aspect: z.number().positive(),
  }),
  "scan.meta": envelope.extend({
    type: z.literal("scan.meta"),
    scanId: uuidSchema,
    width: z.int().positive(),
    height: z.int().positive(),
    mime: z.literal("image/jpeg"),
    bytes: z.int().positive(),
    corners: z.tuple([point, point, point, point]).optional(),
    replacesScanId: uuidSchema.optional(),
    capturedAt: milliseconds,
  }),
  "scan.retake": envelope.extend({
    type: z.literal("scan.retake"),
    scanId: uuidSchema,
  }),
  "file.offer": envelope.extend({
    type: z.literal("file.offer"),
    ...transfer,
    name: z.string().min(1),
    size: z.int().nonnegative(),
    mime: z.string(),
    kind: z.enum(["file", "scan", "clip-image"]),
  }),
  "file.accept": envelope.extend({
    type: z.literal("file.accept"),
    ...transfer,
  }),
  "file.reject": envelope.extend({
    type: z.literal("file.reject"),
    ...transfer,
    reason: z.string().optional(),
  }),
  "file.done": envelope.extend({
    type: z.literal("file.done"),
    ...transfer,
    sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  }),
  "file.cancel": envelope.extend({
    type: z.literal("file.cancel"),
    ...transfer,
  }),
  "clip.text": envelope.extend({
    type: z.literal("clip.text"),
    text: z
      .string()
      .max(clipboardMaxBytes)
      .refine(
        (text) =>
          text.length <= clipboardMaxBytes &&
          utf8.encode(text).byteLength <= clipboardMaxBytes,
        "Clipboard text exceeds the UTF-8 size limit.",
      ),
  }),
  "pointer.sample": envelope.extend({
    type: z.literal("pointer.sample"),
    seq: sequence,
    dx: z.number(),
    dy: z.number(),
  }),
  "pointer.recenter": envelope.extend({ type: z.literal("pointer.recenter") }),
  "laser.set": envelope.extend({
    type: z.literal("laser.set"),
    on: z.boolean(),
  }),
  "slide.next": envelope.extend({ type: z.literal("slide.next") }),
  "slide.prev": envelope.extend({ type: z.literal("slide.prev") }),
  "slide.goto": envelope.extend({
    type: z.literal("slide.goto"),
    page: z.int().positive(),
  }),
  "ink.begin": envelope.extend({
    type: z.literal("ink.begin"),
    ...stroke,
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    baseWidth: z.number().positive(),
  }),
  "ink.points": envelope.extend({
    type: z.literal("ink.points"),
    ...stroke,
    pts: z
      .array(z.tuple([normalized, normalized, milliseconds, normalized]))
      .min(1)
      .max(256),
  }),
  "ink.end": envelope.extend({ type: z.literal("ink.end"), ...stroke }),
  "ink.undo": envelope.extend({ type: z.literal("ink.undo") }),
  "ink.clear": envelope.extend({ type: z.literal("ink.clear") }),
  "doccam.state": envelope.extend({
    type: z.literal("doccam.state"),
    active: z.boolean(),
    facingMode: z.enum(["environment", "user"]),
  }),
  error: envelope.extend({
    type: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
};

const { hello, ...otherSchemas } = messageSchemas;
export const messageSchema = z.discriminatedUnion("type", [
  hello,
  ...Object.values(otherSchemas),
]);
export type Message = z.infer<typeof messageSchema>;
export type Device = z.infer<typeof device>;
export type MessageChannel = "control" | "rt";

type MessageContext = { from: Device; channel: MessageChannel };
type ErrorPayload = Pick<
  Extract<Message, { type: "error" }>,
  "type" | "code" | "message"
>;
export type MessageResult =
  | { ok: true; message: Message }
  | { ok: false; code: "invalid_message" | "wrong_channel" | "wrong_sender" }
  | { ok: false; code: "version_mismatch"; reply: ErrorPayload | null };

const versionHeader = z.object({ v: z.int(), type: z.string().optional() });
const phoneMessages = new Set<Message["type"]>([
  "mode.set",
  "scan.meta",
  "pointer.sample",
  "pointer.recenter",
  "laser.set",
  "slide.next",
  "slide.prev",
  "slide.goto",
  "ink.begin",
  "ink.points",
  "ink.end",
  "ink.undo",
  "ink.clear",
  "doccam.state",
]);

/** Validate a parsed JSON value against the peer and channel that delivered it. */
export function validateMessage(
  value: unknown,
  context: MessageContext,
): MessageResult {
  const header = versionHeader.safeParse(value);
  if (header.success && header.data.v !== protocolVersion) {
    return {
      ok: false,
      code: "version_mismatch",
      // A mismatched error must not trigger an error exchange between incompatible peers.
      reply:
        header.data.type === "error"
          ? null
          : {
              type: "error",
              code: "version_mismatch",
              message: "This peer uses an unsupported protocol version.",
            },
    };
  }
  const parsed = messageSchema.safeParse(value);
  if (!parsed.success) return { ok: false, code: "invalid_message" };

  const { data: message } = parsed;
  const expectedChannel = message.type === "pointer.sample" ? "rt" : "control";
  if (context.channel !== expectedChannel)
    return { ok: false, code: "wrong_channel" };
  if (
    (message.type === "hello" && message.device !== context.from) ||
    (message.type === "surface.info" && context.from !== "laptop") ||
    (message.type === "scan.retake" && context.from !== "laptop") ||
    (phoneMessages.has(message.type) && context.from !== "phone")
  ) {
    return { ok: false, code: "wrong_sender" };
  }
  return { ok: true, message };
}

/** Decode a data channel text frame without exposing malformed user payloads in errors. */
export function decodeMessage(
  raw: string,
  context: MessageContext,
): MessageResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid_message" };
  }
  return validateMessage(value, context);
}
