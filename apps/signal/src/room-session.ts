import { decodeSignalClient, signalRoleSchema } from "@phonebridge/protocol";
import type {
  SignalErrorCode,
  SignalRole,
  SignalServerMessage,
} from "@phonebridge/protocol";

interface RoomSocket {
  readyState: number;
  send(message: string): void;
  close(code: number): void;
  deserializeAttachment(): unknown;
  serializeAttachment(attachment: SignalRole): void;
}

type RoomPorts = {
  sockets(): RoomSocket[];
  matchesRoom(token: string): boolean;
  now(): number;
  markPaired(): Promise<void>;
  clearRoom(): Promise<void>;
};

function roleOf(socket: RoomSocket): SignalRole | undefined {
  return signalRoleSchema.safeParse(socket.deserializeAttachment()).data;
}

function send(socket: RoomSocket, message: SignalServerMessage): void {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function fail(socket: RoomSocket, code: SignalErrorCode, close = false): void {
  send(socket, { type: "error", code });
  if (close && socket.readyState === 1) socket.close(1008);
}

/** Enforce room membership and relay policy independently of the Cloudflare adapter. */
export class RoomSession {
  private expiresAt: number | null | undefined;

  constructor(private readonly ports: RoomPorts) {}

  get isActive(): boolean {
    return this.expiresAt !== undefined;
  }

  open(expiresAt: number | null): void {
    this.expiresAt = expiresAt;
  }

  private members(): Map<SignalRole, RoomSocket> {
    const members = new Map<SignalRole, RoomSocket>();
    for (const socket of this.ports.sockets()) {
      if (socket.readyState !== 1) continue;
      const role = roleOf(socket);
      if (role) members.set(role, socket);
    }
    return members;
  }

  async expire(): Promise<void> {
    if (typeof this.expiresAt !== "number" || this.ports.now() < this.expiresAt)
      return;

    await this.close({ type: "error", code: "room_expired" });
  }

  async receive(socket: RoomSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.expire();
    if (!this.isActive) {
      fail(socket, "room_missing", true);
      return;
    }

    const message = decodeSignalClient(raw);
    if (!message) {
      fail(socket, "invalid_message");
      return;
    }

    const role = roleOf(socket);
    const members = this.members();
    if (message.type === "join") {
      if (!this.ports.matchesRoom(message.room)) {
        fail(socket, "room_missing", true);
        return;
      }
      if (role) {
        if (role !== message.role) fail(socket, "invalid_message");
        return;
      }
      if (members.has(message.role)) {
        fail(socket, "room_full", true);
        return;
      }

      socket.serializeAttachment(message.role);
      const peer = members.get(message.role === "host" ? "phone" : "host");
      if (peer) {
        this.expiresAt = null;
        await this.ports.markPaired();
        send(peer, { type: "peer-joined" });
        send(socket, { type: "peer-joined" });
      }
      return;
    }

    if (!role) {
      fail(socket, "join_required");
      return;
    }
    const peer = members.get(role === "host" ? "phone" : "host");
    if (peer) send(peer, message);
    else fail(socket, "peer_missing");
  }

  async leave(socket: RoomSocket): Promise<void> {
    if (this.isActive && roleOf(socket))
      await this.close({ type: "peer-left" }, socket);
  }

  private async close(
    message: SignalServerMessage,
    departing?: RoomSocket,
  ): Promise<void> {
    this.expiresAt = undefined;
    for (const socket of this.ports.sockets()) {
      if (socket === departing || socket.readyState !== 1) continue;
      send(socket, message);
      socket.close(1000);
    }
    await this.ports.clearRoom();
  }
}
