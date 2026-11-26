import {
  decodeMessage,
  decodeChunk,
  decodeSignalServer,
  deriveSas,
  normalizeFingerprint,
  protocolVersion,
  roomTokenSchema,
} from "@phonebridge/protocol";
import type {
  BulkChunk,
  Message,
  SignalClientMessage,
  SignalRole,
  SignalServerMessage,
} from "@phonebridge/protocol";
import { chooseClock, measureClock } from "./clock.ts";
import type { ClockEstimate } from "./clock.ts";
import { channelNames, connectionStats } from "./diagnostics.ts";
import type { ChannelName } from "./diagnostics.ts";
import {
  acceptRemoteDescription,
  FingerprintError,
  readDtlsFingerprint,
} from "./fingerprint.ts";
import { initialPairing } from "./pairing-state.ts";
import type { PairingFailure, PairingSnapshot } from "./pairing-state.ts";
import { sendBulk } from "./bulk-transfer.ts";

export type TransferMessage = Extract<
  Message,
  {
    type:
      | "scan.meta"
      | "scan.retake"
      | "file.offer"
      | "file.accept"
      | "file.reject"
      | "file.done"
      | "file.cancel"
      | "clip.text";
  }
>;

type ControlPayload<Control extends Message> = Control extends Message
  ? Omit<Control, "v" | "id" | "t">
  : never;
type TransferObserver = {
  control?(message: TransferMessage): void;
  bulk?(chunk: BulkChunk): void;
};

type PairingOptions = {
  role: SignalRole;
  signaling: URL;
  siteOrigin: string;
  publish(snapshot: PairingSnapshot): void;
};

const stallMs = 5_000;
const statsIntervalMs = 2_000;
const clockIntervalMs = 30_000;
const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

/** Own a role's signaling socket, WebRTC connection, and pairing diagnostics. */
export class PairingSession {
  private peer: RTCPeerConnection | undefined;
  private socket: WebSocket | undefined;
  private state: PairingSnapshot;
  private closed = false;
  private hasPeer = false;
  private makingOffer = false;
  private ignoreOffer = false;
  private descriptionSent = false;
  private pin: string | undefined;
  private remoteFingerprint: string | undefined;
  private queuedRemoteIce: (RTCIceCandidateInit | null)[] = [];
  private queuedLocalIce: RTCIceCandidateInit[] = [];
  private incoming = Promise.resolve();
  private readonly abort = new AbortController();
  private readonly channels = new Map<ChannelName, RTCDataChannel>();
  private readonly transferObservers = new Set<TransferObserver>();
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private restartTimer: ReturnType<typeof setTimeout> | undefined;
  private restartAttempts = 0;
  private pingSequence = 0;
  private clock: ClockEstimate | null = null;
  private readonly pendingPings = new Map<number, number>();

  constructor(private readonly options: PairingOptions) {
    this.state = initialPairing(options.role);
  }

  async start(room?: string, fragment?: string): Promise<void> {
    if (
      typeof RTCPeerConnection !== "function" ||
      typeof WebSocket !== "function" ||
      typeof globalThis.crypto?.randomUUID !== "function" ||
      !globalThis.crypto.subtle
    ) {
      this.fail("unsupported");
      return;
    }
    try {
      if (this.options.role === "phone") {
        if (!roomTokenSchema.safeParse(room).success) {
          this.fail("room_missing");
          return;
        }
        try {
          this.pin = normalizeFingerprint(fragment ?? "");
        } catch {
          this.fail("pairing_not_secure");
          return;
        }
      }

      const peer = new RTCPeerConnection({ iceServers });
      this.peer = peer;
      peer.onicecandidate = ({ candidate }) => {
        if (candidate && this.queuedLocalIce.length < 128) {
          this.queuedLocalIce.push(candidate.toJSON());
          this.flushLocalIce();
        }
      };
      peer.ontrack = ({ track, streams }) => {
        const [stream] = streams;
        if (this.options.role !== "host" || track.kind !== "video" || !stream)
          return;
        this.publish({ cameraStream: stream });
        stream.onremovetrack = () => {
          if (
            !stream.getVideoTracks().length &&
            this.state.cameraStream === stream
          )
            this.publish({ cameraStream: undefined });
        };
      };
      peer.ondatachannel = ({ channel }) => this.registerChannel(channel);
      peer.onconnectionstatechange = () => this.updateConnection();
      peer.oniceconnectionstatechange = () => this.updateIce();
      peer.onnegotiationneeded = () => {
        if (this.hasPeer)
          void this.makeOffer().catch((error: unknown) =>
            this.handleFailure(error),
          );
      };

      if (this.options.role === "host") {
        for (const name of channelNames) {
          this.registerChannel(
            peer.createDataChannel(
              name,
              name === "rt"
                ? { ordered: false, maxRetransmits: 0 }
                : { ordered: true },
            ),
          );
        }
        await this.makeOffer();
        if (this.closed) return;
        const fingerprint = readDtlsFingerprint(
          peer.localDescription?.sdp ?? "",
        );
        const response = await fetch(
          new URL("/rooms", this.options.signaling),
          {
            method: "POST",
            signal: this.abort.signal,
          },
        );
        if (!response.ok) throw new Error("Room creation failed");
        const payload = (await response.json()) as { room?: unknown };
        room = roomTokenSchema.parse(payload.room);
        if (this.closed) return;
        const pairingUrl = new URL("/p/" + room, this.options.siteOrigin);
        pairingUrl.hash = "fp=" + fingerprint;
        this.publish({ url: pairingUrl.href });
      }
      this.openSignal(roomTokenSchema.parse(room));
    } catch (error) {
      this.handleFailure(error);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.abort.abort();
    clearInterval(this.statsTimer);
    clearInterval(this.clockTimer);
    clearTimeout(this.restartTimer);
    this.socket?.close();
    this.peer?.close();
    this.pendingPings.clear();
    this.transferObservers.clear();
  }

  /** Share video on the pinned phone connection until the caller releases it. */
  shareCamera(stream: MediaStream): () => void {
    const peer = this.peer;
    const [track] = stream.getVideoTracks();
    if (
      !peer ||
      this.options.role !== "phone" ||
      this.state.phase !== "connected" ||
      !track ||
      typeof peer.addTrack !== "function" ||
      typeof peer.removeTrack !== "function"
    )
      throw new Error("Reconnect in a browser with video sharing support.");
    const sender = peer.addTrack(track, stream);
    return () => {
      if (!this.closed) peer.removeTrack(sender);
    };
  }

  /** Observe transfer messages after wire validation. */
  observeTransfers(observer: TransferObserver): () => void {
    this.transferObservers.add(observer);
    return () => this.transferObservers.delete(observer);
  }

  /** Send one typed transfer message over the ordered control channel. */
  sendTransferControl(payload: ControlPayload<TransferMessage>): void {
    if (
      this.state.phase !== "connected" ||
      this.channels.get("control")?.readyState !== "open"
    ) {
      throw new Error("The transfer connection closed.");
    }
    this.sendControl(payload);
  }

  /** Stream blob bytes over the reliable bulk channel. */
  sendTransferBytes(
    source: Blob,
    transferId: string,
    signal: AbortSignal,
    progress?: (bytes: number) => void,
  ): Promise<void> {
    const channel = this.channels.get("bulk");
    if (this.state.phase !== "connected" || !channel) {
      return Promise.reject(new Error("The transfer connection closed."));
    }
    return sendBulk(channel, source, transferId, signal, progress);
  }

  private publish(update: Partial<PairingSnapshot>): void {
    if (this.closed) return;
    this.state = { ...this.state, ...update };
    this.options.publish(this.state);
  }

  private fail(failure: PairingFailure): void {
    if (this.closed) return;
    this.publish({ phase: "error", failure, url: null, sas: null });
    this.close();
  }

  private handleFailure(error: unknown): void {
    this.fail(
      error instanceof FingerprintError
        ? "pairing_not_secure"
        : "server_unavailable",
    );
  }

  private openSignal(room: string): void {
    const url = new URL("/rooms/" + room, this.options.signaling);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () =>
      this.sendSignal({ type: "join", role: this.options.role, room });
    socket.onmessage = ({ data }) => {
      const message =
        typeof data === "string" ? decodeSignalServer(data) : null;
      if (message) {
        this.incoming = this.incoming
          .then(() => this.handleSignal(message))
          .catch((error: unknown) => this.handleFailure(error));
      } else {
        this.fail("server_unavailable");
      }
    };
    socket.onclose = () =>
      this.fail(this.hasPeer ? "disconnected" : "room_missing");
    socket.onerror = () =>
      this.fail(
        this.options.role === "phone" ? "room_missing" : "server_unavailable",
      );
  }

  private sendSignal(message: SignalClientMessage): void {
    if (!this.closed && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message));
  }

  private async handleSignal(message: SignalServerMessage): Promise<void> {
    if (this.closed || !this.peer) return;
    switch (message.type) {
      case "peer-joined":
        this.hasPeer = true;
        this.publish({ phase: "connecting" });
        if (this.options.role === "host") this.sendLocalDescription();
        return;
      case "peer-left":
        this.fail("disconnected");
        return;
      case "error":
        this.fail(
          message.code === "room_full"
            ? "room_full"
            : message.code === "room_expired" || message.code === "room_missing"
              ? "room_missing"
              : "server_unavailable",
        );
        return;
      case "sdp":
        await this.handleDescription(message.description);
        return;
      case "ice":
        if (this.ignoreOffer) return;
        if (!this.peer.remoteDescription) {
          if (this.queuedRemoteIce.length < 128)
            this.queuedRemoteIce.push(message.candidate);
        } else {
          await this.addCandidate(message.candidate);
        }
    }
  }

  private async makeOffer(): Promise<void> {
    const peer = this.peer;
    if (
      !peer ||
      this.closed ||
      this.makingOffer ||
      peer.signalingState !== "stable"
    )
      return;
    this.makingOffer = true;
    this.descriptionSent = false;
    try {
      await peer.setLocalDescription();
      if (this.hasPeer) this.sendLocalDescription();
    } finally {
      this.makingOffer = false;
    }
  }

  private sendLocalDescription(): void {
    const description = this.peer?.localDescription;
    if (
      !description ||
      (description.type !== "offer" && description.type !== "answer")
    )
      return;
    this.sendSignal({
      type: "sdp",
      description: { type: description.type, sdp: description.sdp },
    });
    this.descriptionSent = true;
    this.flushLocalIce();
  }

  private flushLocalIce(): void {
    if (!this.hasPeer || !this.descriptionSent) return;
    for (const candidate of this.queuedLocalIce.splice(0))
      this.sendSignal({
        type: "ice",
        candidate: { ...candidate, candidate: candidate.candidate ?? "" },
      });
  }

  private async handleDescription(
    description: RTCSessionDescriptionInit,
  ): Promise<void> {
    const peer = this.peer!;
    const collision =
      description.type === "offer" &&
      (this.makingOffer || peer.signalingState !== "stable");
    this.ignoreOffer = this.options.role === "host" && collision;
    if (this.ignoreOffer) return;

    // The phone always compares the QR pin before setRemoteDescription. The host
    // also holds the first phone fingerprint fixed for the lifetime of its room.
    this.remoteFingerprint = await acceptRemoteDescription(
      peer,
      description,
      this.pin ?? this.remoteFingerprint,
    );
    if (this.closed) return;
    for (const candidate of this.queuedRemoteIce.splice(0))
      await this.addCandidate(candidate);
    if (description.type === "offer") {
      this.descriptionSent = false;
      await peer.setLocalDescription();
      this.sendLocalDescription();
    }
    const sas = await deriveSas(
      readDtlsFingerprint(peer.localDescription?.sdp ?? ""),
      this.remoteFingerprint,
    );
    this.publish({ sas });
    this.updateConnection();
  }

  private async addCandidate(
    candidate: RTCIceCandidateInit | null,
  ): Promise<void> {
    const peer = this.peer!;
    const fragment = candidate?.usernameFragment;
    if (
      fragment &&
      !peer.remoteDescription?.sdp
        .split(/\r?\n/)
        .includes("a=ice-ufrag:" + fragment)
    )
      return;
    await peer.addIceCandidate(candidate ?? undefined);
  }

  private registerChannel(channel: RTCDataChannel): void {
    const name = channelNames.find((entry) => entry === channel.label);
    if (
      !name ||
      this.channels.has(name) ||
      channel.maxPacketLifeTime !== null ||
      (name === "rt"
        ? channel.ordered || channel.maxRetransmits !== 0
        : !channel.ordered || channel.maxRetransmits !== null)
    ) {
      channel.close();
      return;
    }
    this.channels.set(name, channel);
    if (name === "bulk") {
      channel.binaryType = "arraybuffer";
      channel.onmessage = ({ data }) => {
        if (!(data instanceof ArrayBuffer)) return;
        let chunk: BulkChunk;
        try {
          chunk = decodeChunk(new Uint8Array(data));
        } catch {
          // Malformed frames must never reach a transfer consumer.
          return;
        }
        for (const observer of this.transferObservers) observer.bulk?.(chunk);
      };
    }
    channel.onopen = () => this.updateConnection();
    channel.onclose = () => {
      if (this.state.phase === "connected") this.fail("disconnected");
    };
    if (name === "control")
      channel.onmessage = ({ data }) => {
        if (typeof data === "string") this.handleControl(data);
      };
    this.updateConnection();
  }

  private updateConnection(): void {
    if (this.closed || !this.peer) return;
    const channels = this.state.diagnostics.channels;
    const states = { ...channels };
    for (const name of channelNames)
      states[name] = this.channels.get(name)?.readyState ?? "unavailable";
    this.publish({
      diagnostics: { ...this.state.diagnostics, channels: states },
    });
    if (
      !this.state.sas ||
      this.peer.connectionState !== "connected" ||
      !channelNames.every((name) => states[name] === "open")
    )
      return;
    if (this.state.phase === "connected") return;
    this.publish({ phase: "connected" });
    this.sendControl({
      type: "hello",
      device: this.options.role === "host" ? "laptop" : "phone",
      caps: [],
    });
    this.syncClock();
    this.clockTimer ??= setInterval(() => this.syncClock(), clockIntervalMs);
    void this.readStats();
    this.statsTimer ??= setInterval(
      () => void this.readStats(),
      statsIntervalMs,
    );
  }

  private updateIce(): void {
    if (!this.peer || this.closed) return;
    const state = this.peer.iceConnectionState;
    if (state === "connected" || state === "completed") {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
      this.restartAttempts = 0;
      this.updateConnection();
    } else if (
      (state === "disconnected" || state === "failed") &&
      this.hasPeer
    ) {
      this.publish({ phase: "connecting" });
      this.restartTimer ??= setTimeout(() => this.restartIce(), stallMs);
    }
  }

  private restartIce(): void {
    const peer = this.peer;
    if (!peer || this.closed) return;
    this.restartTimer = undefined;
    if (
      peer.iceConnectionState === "connected" ||
      peer.iceConnectionState === "completed"
    )
      return;
    if (this.restartAttempts >= 3 || typeof peer.restartIce !== "function") {
      this.fail("disconnected");
      return;
    }
    this.restartAttempts++;
    peer.restartIce();
    this.restartTimer = setTimeout(() => this.restartIce(), stallMs);
  }

  private sendControl(
    payload:
      | ControlPayload<
          Extract<Message, { type: "hello" | "ping" | "pong" | "error" }>
        >
      | ControlPayload<TransferMessage>,
    t = performance.now(),
  ): void {
    const channel = this.channels.get("control");
    if (channel?.readyState === "open") {
      channel.send(
        JSON.stringify({
          v: protocolVersion,
          id: crypto.randomUUID(),
          t,
          ...payload,
        }),
      );
    }
  }

  private syncClock(): void {
    if (this.state.phase !== "connected") return;
    this.pendingPings.clear();
    this.clock = null;
    for (let sample = 0; sample < 8; sample++) {
      this.pingSequence = (this.pingSequence + 1) >>> 0;
      const t = performance.now();
      this.pendingPings.set(this.pingSequence, t);
      this.sendControl({ type: "ping", seq: this.pingSequence }, t);
    }
  }

  private handleControl(raw: string): void {
    const arrival = performance.now();
    const received = decodeMessage(raw, {
      channel: "control",
      from: this.options.role === "host" ? "phone" : "laptop",
    });
    if (!received.ok) {
      if (received.code === "version_mismatch") {
        if (received.reply) this.sendControl(received.reply);
        this.fail("disconnected");
      }
      return;
    }
    const message = received.message;
    switch (message.type) {
      case "scan.meta":
      case "scan.retake":
      case "file.offer":
      case "file.accept":
      case "file.reject":
      case "file.done":
      case "file.cancel":
      case "clip.text":
        for (const observer of this.transferObservers)
          observer.control?.(message);
        return;
    }
    if (message.type === "ping") {
      const reply = performance.now();
      this.sendControl(
        {
          type: "pong",
          seq: message.seq,
          sentAt: message.t,
          receivedAt: arrival,
          repliedAt: reply,
        },
        reply,
      );
    } else if (
      message.type === "pong" &&
      this.pendingPings.get(message.seq) === message.sentAt
    ) {
      this.pendingPings.delete(message.seq);
      this.clock = chooseClock(
        this.clock,
        measureClock(
          message.sentAt,
          message.receivedAt,
          message.repliedAt,
          arrival,
        ),
      );
    }
  }

  private async readStats(): Promise<void> {
    if (!this.peer || this.closed || this.state.phase !== "connected") return;
    try {
      const report = await this.peer.getStats();
      const rows: { id: string; type: string }[] = [];
      report.forEach((row) => rows.push(row));
      const stats = connectionStats(rows);
      this.publish({
        diagnostics: {
          ...this.state.diagnostics,
          ...stats,
          rttMs: stats.rttMs ?? this.clock?.rttMs ?? null,
        },
      });
    } catch {
      this.publish({
        diagnostics: {
          ...this.state.diagnostics,
          connection: "unknown",
          outgoingBps: null,
          rttMs: this.clock?.rttMs ?? null,
        },
      });
    }
  }
}
