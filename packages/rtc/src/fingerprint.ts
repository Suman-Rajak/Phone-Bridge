import { normalizeFingerprint } from "@phonebridge/protocol";

export class FingerprintError extends Error {
  readonly code = "pairing_not_secure";

  constructor() {
    super("Pairing not secure");
  }
}

function fingerprint(attributes: string[]): string | undefined {
  if (attributes.length === 0) return undefined;
  try {
    const values = new Set(attributes.map(normalizeFingerprint));
    if (values.size === 1) return values.values().next().value;
  } catch {
    throw new FingerprintError();
  }
  throw new FingerprintError();
}

/** Return the unambiguous SHA-256 fingerprint effective across the SDP sections. */
export function readDtlsFingerprint(sdp: string): string {
  const session: string[] = [];
  const media: string[][] = [];
  let current = session;
  for (const line of sdp.split(/\r?\n/)) {
    if (line.startsWith("m=")) {
      current = [];
      media.push(current);
    } else if (line.startsWith("a=fingerprint:")) {
      current.push(line.slice("a=fingerprint:".length));
    }
  }
  const inherited = fingerprint(session);
  const effective = new Set(
    media.map((section) => fingerprint(section) ?? inherited),
  );
  const [value] = effective;
  if (effective.size !== 1 || value === undefined) throw new FingerprintError();
  return value;
}

/** Verify the pin before passing an untrusted remote description to the browser. */
export async function acceptRemoteDescription(
  peer: Pick<RTCPeerConnection, "setRemoteDescription">,
  description: RTCSessionDescriptionInit,
  expected?: string,
): Promise<string> {
  const actual = readDtlsFingerprint(description.sdp ?? "");
  if (expected && actual !== expected) throw new FingerprintError();
  await peer.setRemoteDescription(description);
  return actual;
}
