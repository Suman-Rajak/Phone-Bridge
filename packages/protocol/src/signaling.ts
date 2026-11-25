import { z } from "zod";

export const roomTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const signalRoleSchema = z.enum(["host", "phone"]);
export type SignalRole = z.infer<typeof signalRoleSchema>;

const join = z.strictObject({
  type: z.literal("join"),
  role: signalRoleSchema,
  room: roomTokenSchema,
});
const sdp = z.strictObject({
  type: z.literal("sdp"),
  description: z.strictObject({
    type: z.enum(["offer", "answer"]),
    sdp: z
      .string()
      .min(1)
      .max(64 * 1024),
  }),
});
const ice = z.strictObject({
  type: z.literal("ice"),
  candidate: z
    .strictObject({
      candidate: z.string().max(4096),
      sdpMid: z.string().max(256).nullable().optional(),
      sdpMLineIndex: z.int().min(0).max(65_535).nullable().optional(),
      usernameFragment: z.string().max(256).nullable().optional(),
    })
    .nullable(),
});
const peerJoined = z.strictObject({ type: z.literal("peer-joined") });
const peerLeft = z.strictObject({ type: z.literal("peer-left") });
const signalErrorCode = z.enum([
  "room_full",
  "room_missing",
  "room_expired",
  "invalid_message",
  "join_required",
  "peer_missing",
]);
const error = z.strictObject({
  type: z.literal("error"),
  code: signalErrorCode,
});

export const signalClientSchema = z.discriminatedUnion("type", [
  join,
  sdp,
  ice,
]);
export const signalServerSchema = z.discriminatedUnion("type", [
  peerJoined,
  peerLeft,
  sdp,
  ice,
  error,
]);
export type SignalClientMessage = z.infer<typeof signalClientSchema>;
export type SignalServerMessage = z.infer<typeof signalServerSchema>;
export type SignalErrorCode = z.infer<typeof signalErrorCode>;

function parseSignalFrame(raw: string | ArrayBuffer): unknown {
  if (typeof raw !== "string" || raw.length > 128 * 1024) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Parse a room participant's signaling frame without returning invalid content in errors. */
export function decodeSignalClient(
  raw: string | ArrayBuffer,
): SignalClientMessage | null {
  return signalClientSchema.safeParse(parseSignalFrame(raw)).data ?? null;
}

/** Parse a signaling response before applying SDP, ICE, or room state. */
export function decodeSignalServer(
  raw: string | ArrayBuffer,
): SignalServerMessage | null {
  return signalServerSchema.safeParse(parseSignalFrame(raw)).data ?? null;
}
