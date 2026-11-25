export const maximumFileBytes = 500_000_000;
export const confirmAboveBytes = 50_000_000;

/** Create a safe leaf name for an untrusted file offer on all supported operating systems. */
export function safeFileName(name: string): string {
  const stripped = name
    .slice(0, 1024)
    .normalize("NFC")
    .replace(
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]+/g,
      "_",
    )
    .trim()
    .replace(/^\.+|[.\s]+$/g, "");
  const utf8 = new TextEncoder();
  let length = 0;
  let limited = "";
  for (const point of stripped) {
    length += utf8.encode(point).byteLength;
    if (length > 240) break;
    limited += point;
  }
  const leaf = limited.trim().replace(/[.\s]+$/g, "");
  const stem = leaf.split(".", 1)[0].trimEnd();
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) return "_" + leaf;
  return leaf || "download";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1000) return bytes + (bytes === 1 ? " byte" : " bytes");
  const unit = bytes >= 1_000_000 ? " MB" : " KB";
  const divisor = bytes >= 1_000_000 ? 1_000_000 : 1000;
  return (
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
      bytes / divisor,
    ) + unit
  );
}
