/** Hash transferred bytes from a dedicated worker. */
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== "function") {
    throw new Error("This browser cannot verify file integrity.");
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
