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
import { useState } from "react";
import { Brand, Button, Card, EmptyState, StatusPill } from "./ui/primitives";

function AppHeader({ status }: { status: string }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Brand />
        <StatusPill>{status}</StatusPill>
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
  return (
    <div className="app-shell">
      <AppHeader status="No phone connected" />
      <main className="laptop-main">
        <div className="intro">
          <h1>Connect your phone</h1>
          <p>
            Use your phone as a scanner, document camera, clicker, or clipboard
            right from your browser.
          </p>
        </div>
        <Card className="pairing-card">
          <div className="pairing-illustration" aria-hidden="true">
            <QrCode />
          </div>
          <h2>Pair with a QR code</h2>
          <p className="muted">Phone pairing isn’t available yet.</p>
        </Card>
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

export function PhoneShell() {
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]);
  const Icon = mode.icon;

  return (
    <div className="app-shell phone-shell">
      <AppHeader status="Not connected" />
      <main className="phone-main">
        <h1>{mode.title}</h1>
        <Card className="phone-workspace">
          <EmptyState
            icon={<Icon />}
            title="Waiting for your laptop"
            description={mode.text}
          />
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
