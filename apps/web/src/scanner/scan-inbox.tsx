import { ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import type { PairingSession } from "@phonebridge/rtc";
import { Card, EmptyState, ErrorState } from "../ui/primitives";
import { receiveScans } from "./scan-transfer";

export default function ScanInbox({ session }: { session: PairingSession }) {
  const [preview, setPreview] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = "";
    const unsubscribe = receiveScans(session, {
      received({ jpeg }) {
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(jpeg);
        setPreview(url);
        setFailed(false);
      },
      failed() {
        setFailed(true);
      },
    });
    return () => {
      unsubscribe();
      if (url) URL.revokeObjectURL(url);
    };
  }, [session]);

  return (
    <Card className="scan-inbox">
      <h2>Latest scan</h2>
      {failed && (
        <ErrorState
          title="Scan couldn’t be received"
          description="Keep both devices connected and capture the page again."
        />
      )}
      {preview ? (
        <figure>
          <img src={preview} alt="Scanned document" />
          <figcaption role="status">Scan received</figcaption>
        </figure>
      ) : (
        <EmptyState
          icon={<ScanLine />}
          title="Waiting for a scan"
          description="Start the camera in Scan on your phone."
        />
      )}
    </Card>
  );
}
