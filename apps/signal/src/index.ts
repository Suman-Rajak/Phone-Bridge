/// <reference types="@cloudflare/workers-types" />

import { roomTokenSchema } from "@phonebridge/protocol";
import { DurableObject } from "cloudflare:workers";
import { RoomSession } from "./room-session.ts";

const roomLifetimeMs = 10 * 60 * 1000;
const roomDeadlineKey = "expiresAt";

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS: string;
}

function createRoomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function json(body: unknown, status: number, origin?: string): Response {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return Response.json(body, { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (
      origin &&
      !(env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim())
        .includes(origin)
    ) {
      return json({ type: "error", code: "origin_not_allowed" }, 403);
    }

    if (pathname === "/rooms" && request.method === "OPTIONS" && origin) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        },
      });
    }

    if (pathname === "/rooms" && request.method === "POST") {
      const room = createRoomToken();
      const stub = env.ROOMS.getByName(room);
      const initialized = await stub.fetch("https://room.internal/create", {
        method: "POST",
      });
      if (!initialized.ok)
        return json(
          { type: "error", code: "room_unavailable" },
          503,
          origin ?? undefined,
        );
      return json({ room }, 201, origin ?? undefined);
    }

    const match = pathname.match(/^\/rooms\/([^/]+)$/);
    const room = roomTokenSchema.safeParse(match?.[1]);
    if (!room.success || request.method !== "GET") {
      return json(
        { type: "error", code: "room_missing" },
        404,
        origin ?? undefined,
      );
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json(
        { type: "error", code: "upgrade_required" },
        426,
        origin ?? undefined,
      );
    }
    return env.ROOMS.getByName(room.data).fetch(request);
  },
};

export class Room extends DurableObject<Env> {
  private readonly session: RoomSession;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.session = new RoomSession({
      sockets: () => ctx.getWebSockets(),
      matchesRoom: (token) => env.ROOMS.idFromName(token).equals(ctx.id),
      now: () => Date.now(),
      markPaired: async () => {
        await ctx.storage.put(roomDeadlineKey, null);
        await ctx.storage.deleteAlarm();
      },
      clearRoom: async () => {
        await ctx.storage.deleteAll();
        await ctx.storage.deleteAlarm();
      },
    });
    void ctx.blockConcurrencyWhile(async () => {
      const deadline = await ctx.storage.get<number | null>(roomDeadlineKey);
      if (deadline !== undefined) this.session.open(deadline);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (
      request.method === "POST" &&
      new URL(request.url).pathname === "/create"
    ) {
      if (this.session.isActive) return new Response(null, { status: 409 });
      const deadline = Date.now() + roomLifetimeMs;
      await this.ctx.storage.setAlarm(deadline);
      await this.ctx.storage.put(roomDeadlineKey, deadline);
      this.session.open(deadline);
      return new Response(null, { status: 201 });
    }

    await this.session.expire();
    if (!this.session.isActive)
      return json({ type: "error", code: "room_missing" }, 404);

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    return this.session.receive(socket, message);
  }

  webSocketClose(socket: WebSocket): Promise<void> {
    return this.session.leave(socket);
  }

  webSocketError(socket: WebSocket): Promise<void> {
    return this.session.leave(socket);
  }

  alarm(): Promise<void> {
    return this.session.expire();
  }
}
