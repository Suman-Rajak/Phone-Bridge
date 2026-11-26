import type { SignalRole } from "@phonebridge/protocol";
import { emptyDiagnostics } from "./diagnostics.ts";
import type { Diagnostics } from "./diagnostics.ts";

export type PairingFailure =
  | "unsupported"
  | "pairing_not_secure"
  | "server_unavailable"
  | "room_full"
  | "room_missing"
  | "disconnected";

export type PairingSnapshot = {
  phase: "waiting" | "connecting" | "connected" | "error";
  url: string | null;
  sas: string | null;
  failure: PairingFailure | null;
  cameraStream?: MediaStream;
  diagnostics: Diagnostics;
};

/** Provide the state shown while the pairing session starts. */
export function initialPairing(role: SignalRole): PairingSnapshot {
  return {
    phase: role === "host" ? "waiting" : "connecting",
    url: null,
    sas: null,
    failure: null,
    diagnostics: emptyDiagnostics(),
  };
}
