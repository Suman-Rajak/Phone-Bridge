import { Check, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { initialPairing } from "@phonebridge/rtc/state";
import type {
  Diagnostics,
  PairingFailure,
  PairingSession,
  PairingSnapshot,
} from "@phonebridge/rtc";
import { Drawer } from "./ui/overlay";
import { Button, ErrorState, StatusPill } from "./ui/primitives";

const failures: Record<PairingFailure, { title: string; description: string }> =
  {
    unsupported: {
      title: "Pairing unavailable",
      description:
        "Open PhoneBridge in a browser that supports WebRTC over HTTPS.",
    },
    pairing_not_secure: {
      title: "Pairing not secure",
      description: "Scan a fresh QR code from your laptop.",
    },
    server_unavailable: {
      title: "Couldn’t connect",
      description: "Check that both devices can reach the signaling service.",
    },
    room_full: {
      title: "Room is full",
      description: "Another phone is already connected to this laptop.",
    },
    room_missing: {
      title: "Pairing link expired",
      description: "Open PhoneBridge on your laptop and scan its QR code.",
    },
    disconnected: {
      title: "Connection lost",
      description: "Start a new pairing session on your laptop.",
    },
  };

export function usePairing(role: "host" | "phone", room?: string) {
  const [snapshot, setSnapshot] = useState(() => initialPairing(role));
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const { origin, protocol, hostname, hash } = window.location;
    const loopback = hostname === "localhost" || hostname === "127.0.0.1";
    const configured = import.meta.env.VITE_SIGNAL_URL as string | undefined;
    const endpoint =
      configured ||
      (protocol === "http:" && loopback ? "http://127.0.0.1:8787" : "");
    let signaling: URL;
    try {
      signaling = new URL(endpoint);
      if (
        signaling.protocol !== "https:" &&
        !(signaling.protocol === "http:" && protocol === "http:" && loopback)
      ) {
        throw new Error("Invalid signaling origin");
      }
    } catch {
      setSnapshot({
        ...initialPairing(role),
        phase: "error",
        failure: "server_unavailable",
      });
      return;
    }

    const fingerprint =
      new URLSearchParams(hash.slice(1)).get("fp") ?? undefined;
    let active = true;
    let session: PairingSession | undefined;
    setSnapshot(initialPairing(role));
    void import("@phonebridge/rtc").then(
      ({ PairingSession }) => {
        if (!active) return;
        session = new PairingSession({
          role,
          signaling,
          siteOrigin: origin,
          publish: setSnapshot,
        });
        return session.start(room, fingerprint);
      },
      () => {
        if (active)
          setSnapshot({
            ...initialPairing(role),
            phase: "error",
            failure: "server_unavailable",
          });
      },
    );
    return () => {
      active = false;
      session?.close();
    };
  }, [role, room, generation]);

  return { snapshot, reconnect: () => setGeneration((current) => current + 1) };
}

export function PairingError({
  failure,
  reconnect,
}: {
  failure: PairingFailure;
  reconnect?: () => void;
}) {
  return (
    <ErrorState
      {...failures[failure]}
      action={reconnect && <Button onClick={reconnect}>Reconnect</Button>}
    />
  );
}

export function PairingCode({ url }: { url: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then(({ default: qrCode }) =>
        qrCode.toDataURL(url, { width: 256, margin: 4 }),
      )
      .then(
        (imageUrl) => {
          if (active) setImage(imageUrl);
        },
        () => {
          if (active) setImage("");
        },
      );
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <a
      className="pairing-link"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Open pairing link"
    >
      {image ? (
        <img alt="Pairing QR code" src={image} width={256} height={256} />
      ) : (
        <QrCode aria-hidden="true" />
      )}
      Open pairing link
    </a>
  );
}

export function VerificationCode({ sas }: { sas: string }) {
  return (
    <div className="verification-code">
      <span className="icon-tile">
        <Check aria-hidden="true" />
      </span>
      <div>
        <p className="state-title">Verification code</p>
        <output aria-label="Verification code">{sas}</output>
      </div>
      <p className="muted">Check that both devices show the same code.</p>
    </div>
  );
}

const connectionNames: Record<Diagnostics["connection"], string> = {
  "same-network": "same Wi-Fi",
  nat: "through NAT",
  relay: "TURN relay",
  unknown: "unavailable",
};

function ConnectionDiagnostics({ diagnostics }: { diagnostics: Diagnostics }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const { connection, rttMs, outgoingBps, channels } = diagnostics;
  const readings = [
    ["Connection type", connectionNames[connection]],
    [
      "Round-trip time",
      rttMs === null ? "Unavailable" : `${rttMs.toFixed(1)} ms`,
    ],
    [
      "Available outgoing bitrate",
      outgoingBps === null
        ? "Unavailable"
        : `${Math.round(outgoingBps / 1000)} kbps`,
    ],
    ...Object.entries(channels),
  ];
  const details = readings
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");

  async function copyDiagnostics() {
    if (typeof navigator.clipboard?.writeText === "function") {
      try {
        await navigator.clipboard.writeText(details);
        setCopy("copied");
        return;
      } catch {
        setCopy("manual");
        return;
      }
    }
    setCopy("manual");
  }

  return (
    <>
      <dl className="connection-readings">
        {readings.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Button variant="secondary" onClick={() => void copyDiagnostics()}>
        Copy diagnostics
      </Button>
      {copy === "copied" && <p role="status">Diagnostics copied.</p>}
      {copy === "manual" && (
        <textarea
          aria-label="Diagnostics to copy"
          readOnly
          value={details}
          rows={6}
          onFocus={(event) => event.target.select()}
        />
      )}
    </>
  );
}

export function PairingStatus({ snapshot }: { snapshot: PairingSnapshot }) {
  const [advanced, setAdvanced] = useState(false);
  const { phase, diagnostics } = snapshot;
  if (phase !== "connected") {
    const status = {
      waiting: "Waiting",
      connecting: "Connecting",
      error: "Disconnected",
    };
    return (
      <span role="status">
        <StatusPill>{status[phase]}</StatusPill>
      </span>
    );
  }
  const label =
    diagnostics.connection === "unknown"
      ? "Connected"
      : "Connected · " + connectionNames[diagnostics.connection];
  return (
    <>
      <button
        className="connection-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={advanced}
        onClick={() => setAdvanced(true)}
      >
        <StatusPill>{label}</StatusPill>
      </button>
      <Drawer
        open={advanced}
        onClose={() => setAdvanced(false)}
        title="Advanced"
      >
        {advanced && <ConnectionDiagnostics diagnostics={diagnostics} />}
      </Drawer>
    </>
  );
}
