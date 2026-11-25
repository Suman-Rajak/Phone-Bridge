import { describe, expect, it, vi } from "vitest";
import { chooseClock, measureClock } from "./clock.ts";
import { connectionStats } from "./diagnostics.ts";
import {
  acceptRemoteDescription,
  FingerprintError,
  readDtlsFingerprint,
} from "./fingerprint.ts";

const hostFingerprint = "ab".repeat(32);
const otherFingerprint = "ef".repeat(32);
const attribute = (hex: string) =>
  "a=fingerprint:sha-256 " + hex.match(/../g)?.join(":");
const application = "m=application 9 UDP/DTLS/SCTP webrtc-datachannel";
const video = "m=video 9 UDP/TLS/RTP/SAVPF 96";

describe("SDP fingerprint", () => {
  it("matches across session inheritance and a media-level fingerprint", () => {
    const description = [
      attribute(hostFingerprint),
      application,
      video,
      attribute(hostFingerprint.toUpperCase()),
    ].join("\r\n");
    expect(readDtlsFingerprint(description)).toBe(hostFingerprint);
  });

  it.each([
    [application],
    [
      attribute(hostFingerprint),
      application,
      video,
      attribute(otherFingerprint),
    ],
    [application, attribute(hostFingerprint), attribute(otherFingerprint)],
    [application, "a=fingerprint:sha-1 ab"],
    [application, "a=fingerprint:sha-256 ab"],
    [application, attribute(hostFingerprint), video],
  ])(
    "rejects missing, invalid, or conflicting effective fingerprints",
    (...lines: string[]) => {
      expect(() => readDtlsFingerprint(lines.join("\r\n"))).toThrow(
        FingerprintError,
      );
    },
  );

  it("validates the QR fingerprint before calling setRemoteDescription", async () => {
    const peer = { setRemoteDescription: vi.fn().mockResolvedValue(undefined) };
    const description = {
      type: "offer",
      sdp: [application, attribute(hostFingerprint)].join("\r\n"),
    } as const;
    await expect(
      acceptRemoteDescription(peer, description, otherFingerprint),
    ).rejects.toThrow(FingerprintError);
    expect(peer.setRemoteDescription).not.toHaveBeenCalled();
    await expect(
      acceptRemoteDescription(peer, description, hostFingerprint),
    ).resolves.toBe(hostFingerprint);
    expect(peer.setRemoteDescription).toHaveBeenCalledExactlyOnceWith(
      description,
    );
  });
});

describe("clock synchronization", () => {
  it("excludes remote processing time and keeps the smallest RTT", () => {
    const slower = measureClock(0, 155, 157, 12);
    const faster = measureClock(0, 152, 155, 7);
    expect(faster).toEqual({ offsetMs: 150, rttMs: 4 });
    expect(chooseClock(slower, faster)).toBe(faster);
    expect(chooseClock(faster, slower)).toBe(faster);
    expect(measureClock(0, 10, 25, 5)).toBeNull();
  });
});

describe("connection diagnostics", () => {
  it("uses the transport-selected pair and omits candidate addresses", () => {
    expect(
      connectionStats([
        {
          id: "transport",
          type: "transport",
          selectedCandidatePairId: "selected",
        },
        {
          id: "other",
          type: "candidate-pair",
          state: "succeeded",
          nominated: true,
          currentRoundTripTime: 1,
        },
        {
          id: "selected",
          type: "candidate-pair",
          localCandidateId: "local",
          remoteCandidateId: "remote",
          currentRoundTripTime: 0.014,
        },
        {
          id: "local",
          type: "local-candidate",
          candidateType: "srflx",
          address: "192.0.2.123",
        },
        { id: "remote", type: "remote-candidate", candidateType: "host" },
      ]),
    ).toEqual({ connection: "nat", rttMs: 14, outgoingBps: null });
  });
});
