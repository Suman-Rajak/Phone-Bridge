import {
  Camera,
  Clipboard,
  Laptop,
  Link2,
  PenLine,
  Presentation,
  QrCode,
  ScanLine,
  Smartphone,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { PairingSnapshot } from "@phonebridge/rtc";
import type { RetakeRequest } from "./scanner/scan-transfer";
import {
  PairingCode,
  PairingError,
  PairingStatus,
  usePairing,
  VerificationCode,
} from "./pairing";
import { Brand, Button, Card, EmptyState, Spinner } from "./ui/primitives";

const LiveCamera = lazy(() => import("./live/live-camera"));
const LivePage = lazy(() => import("./live/live-page"));
const ScanPreview = lazy(() => import("./scanner/scan-preview"));
const ScanInbox = lazy(() => import("./scanner/scan-inbox"));
const FilePanel = lazy(() => import("./files/file-panel"));
const ClipboardPanel = lazy(() => import("./clipboard/clipboard-panel"));

function AppHeader({ snapshot }: { snapshot: PairingSnapshot }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Brand />
        <PairingStatus snapshot={snapshot} />
      </div>
    </header>
  );
}

const pairingSteps = [
  {
    icon: Laptop,
    title: "Keep this tab open",
    text: "This is where your phone’s tools will appear.",
  },
  {
    icon: Smartphone,
    title: "Open your phone’s camera",
    text: "Point it at the code when it appears.",
  },
  {
    icon: Link2,
    title: "Tap the link on your phone",
    text: "Both devices stay in the browser.",
  },
];

export function LaptopShell() {
  const { snapshot, session, reconnect } = usePairing("host");
  const { failure, phase, sas, url } = snapshot;
  const connected = phase === "connected";
  const cameraStream = connected ? snapshot.cameraStream : undefined;
  const [hasTray, setHasTray] = useState(false);
  useEffect(() => {
    if (connected) setHasTray(true);
  }, [connected]);

  return (
    <div className="app-shell">
      <AppHeader snapshot={snapshot} />
      <main
        className="laptop-main"
        data-connected={connected}
        data-live={Boolean(cameraStream)}
      >
        <div className="intro">
          <h1>
            {cameraStream
              ? "Document camera"
              : connected
                ? "Scanner"
                : "Connect your phone"}
          </h1>
          {!connected && (
            <p>
              Use your phone as a scanner, document camera, clicker, or
              clipboard right from your browser.
            </p>
          )}
        </div>
        <div className="laptop-side">
          <Card className="pairing-card">
            {failure ? (
              <PairingError failure={failure} reconnect={reconnect} />
            ) : connected && sas ? (
              <VerificationCode sas={sas} />
            ) : (
              <>
                {url && phase === "waiting" ? (
                  <PairingCode key={url} url={url} />
                ) : (
                  <div className="pairing-illustration" aria-hidden="true">
                    <QrCode />
                  </div>
                )}
                <h2>Pair with a QR code</h2>
                <p className="muted">
                  {phase === "connecting"
                    ? "Connecting to your phone…"
                    : url
                      ? "Scan with your phone’s camera."
                      : "Preparing your pairing code…"}
                </p>
              </>
            )}
          </Card>
          {(connected || hasTray) && (
            <Suspense fallback={<Spinner label="Loading clipboard" />}>
              <ClipboardPanel
                session={connected ? session : null}
                role="host"
              />
            </Suspense>
          )}
          {(connected || hasTray) && (
            <Suspense fallback={<Spinner label="Loading files" />}>
              <FilePanel session={connected ? session : null} allowDrop />
            </Suspense>
          )}
        </div>
        {(connected || hasTray) && (
          <Suspense fallback={<Spinner label="Loading scanner" />}>
            <ScanInbox session={connected ? session : null} />
          </Suspense>
        )}
        {cameraStream && (
          <Suspense fallback={<Spinner label="Loading live page" />}>
            <LivePage stream={cameraStream} />
          </Suspense>
        )}
        {!connected && !hasTray && (
          <section
            className="pairing-steps"
            aria-labelledby="pairing-steps-title"
          >
            <h2 id="pairing-steps-title">How it works</h2>
            <ol>
              {pairingSteps.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <span className="icon-tile">
                    <Icon aria-hidden="true" />
                  </span>
                  <div>
                    <p className="step-title">{title}</p>
                    <p className="muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}

const modes = [
  {
    id: "scan",
    label: "Scan",
    title: "Scanner",
    icon: ScanLine,
    text: "Connect to your laptop to scan a document.",
  },
  {
    id: "live",
    label: "Live",
    title: "Document camera",
    icon: Camera,
    text: "Connect to your laptop to share a live view.",
  },
  {
    id: "present",
    label: "Present",
    title: "Presenter",
    icon: Presentation,
    text: "Connect to your laptop to control slides.",
  },
  {
    id: "draw",
    label: "Draw",
    title: "Drawing tablet",
    icon: PenLine,
    text: "Connect to your laptop to draw.",
  },
  {
    id: "clipboard",
    label: "Clipboard",
    title: "Clipboard",
    icon: Clipboard,
    text: "Connect to your laptop to share text and files.",
  },
] as const;

export function PhoneShell({ room }: { room: string }) {
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]);
  const { snapshot, session } = usePairing("phone", room);
  const { failure, phase, sas } = snapshot;
  const showScanner = phase === "connected" && mode.id === "scan";
  const [retake, setRetake] = useState<RetakeRequest | null>(null);
  useEffect(
    () =>
      session?.observeTransfers({
        control(message) {
          if (message.type === "scan.retake") {
            setRetake({ scanId: message.scanId, requestId: message.id });
            setMode(modes[0]);
          }
        },
      }),
    [session],
  );
  const completeRetake = useCallback((requestId: string) => {
    setRetake((request) => (request?.requestId === requestId ? null : request));
  }, []);
  const Icon = mode.icon;

  return (
    <div className="app-shell phone-shell">
      <AppHeader snapshot={snapshot} />
      <main className="phone-main">
        <h1>{mode.title}</h1>
        {session && (
          <Suspense
            fallback={
              mode.id === "clipboard" ? (
                <Spinner label="Loading clipboard" />
              ) : null
            }
          >
            <ClipboardPanel
              session={phase === "connected" ? session : null}
              role="phone"
              visible={mode.id === "clipboard"}
              showClipboard={() => setMode(modes[4])}
            />
          </Suspense>
        )}
        {session && (
          <Suspense
            fallback={
              mode.id === "clipboard" ? <Spinner label="Loading files" /> : null
            }
          >
            <FilePanel
              session={phase === "connected" ? session : null}
              visible={mode.id === "clipboard"}
              showFiles={() => setMode(modes[4])}
            />
          </Suspense>
        )}
        <Card
          className={
            showScanner || mode.id === "live"
              ? "scan-workspace"
              : "phone-workspace"
          }
        >
          {failure ? (
            <PairingError failure={failure} />
          ) : phase === "connected" && sas ? (
            <>
              {mode.id === "live" && session && (
                <Suspense fallback={<Spinner label="Loading camera" />}>
                  <LiveCamera session={session} />
                </Suspense>
              )}
              {showScanner && session && (
                <Suspense fallback={<Spinner label="Loading scanner" />}>
                  <ScanPreview
                    session={session}
                    retake={retake}
                    completeRetake={completeRetake}
                  />
                </Suspense>
              )}
              <VerificationCode sas={sas} />
            </>
          ) : (
            <EmptyState
              icon={<Icon />}
              title="Waiting for your laptop"
              description={mode.text}
            />
          )}
        </Card>
      </main>
      <div className="mode-bar" role="group" aria-label="Phone tools">
        {modes.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className="mode-button"
            aria-pressed={mode.id === item.id}
            onClick={() => setMode(item)}
          >
            <item.icon aria-hidden="true" />
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
