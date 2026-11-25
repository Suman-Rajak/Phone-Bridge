import { useEffect, useState } from "react";

export function useBlobUrl(blob?: Blob): string {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) {
      setEntry(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setEntry({ blob, url: next });
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return entry && entry.blob === blob ? entry.url : "";
}
