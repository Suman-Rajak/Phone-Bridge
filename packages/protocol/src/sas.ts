/** Accept a SHA-256 DTLS fingerprint and return lowercase hex without separators. */
export function normalizeFingerprint(value: string): string {
  const fingerprint = value.trim().replace(/^sha-256\s+/i, "");
  if (
    !/^(?:[0-9a-f]{64}|[0-9a-f]{2}(?::[0-9a-f]{2}){31})$/i.test(fingerprint)
  ) {
    throw new TypeError("Expected a SHA-256 DTLS fingerprint.");
  }
  return fingerprint.replaceAll(":", "").toLowerCase();
}

/** Derive the four display digits from the sorted fingerprints using Web Crypto. */
export async function deriveSas(
  first: string,
  second: string,
): Promise<string> {
  const input = [normalizeFingerprint(first), normalizeFingerprint(second)]
    .sort()
    .join("");
  if (typeof globalThis.crypto?.subtle?.digest !== "function") {
    throw new Error(
      "Pairing verification requires Web Crypto in a secure context.",
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return (new DataView(digest).getUint32(0, false) % 10_000)
    .toString()
    .padStart(4, "0");
}
