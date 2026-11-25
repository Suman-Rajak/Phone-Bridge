import { ScanLine } from "lucide-react";
import { useState } from "react";
import { Drawer, Modal } from "./overlay";
import {
  Brand,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
  Spinner,
  StatusPill,
  Toast,
} from "./primitives";
import { SegmentedControl, Tabs } from "./selection";
import "./gallery.css";

const themes = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

export default function Gallery() {
  const [theme, setTheme] = useState("system");
  const [overlay, setOverlay] = useState<"modal" | "drawer" | null>(null);
  const [toast, setToast] = useState(true);

  return (
    <div className="gallery-page" data-theme={theme}>
      <main className="gallery-main">
        <header className="gallery-header">
          <div>
            <Brand />
            <h1>Component gallery</h1>
          </div>
          <SegmentedControl
            label="Gallery theme"
            options={themes}
            value={theme}
            onChange={setTheme}
          />
        </header>

        <div className="gallery-grid">
          <Card className="gallery-card">
            <h2>Actions</h2>
            <div className="button-row">
              <Button onClick={() => setOverlay("modal")}>
                <ScanLine aria-hidden="true" />
                Open modal
              </Button>
              <Button variant="secondary" onClick={() => setOverlay("drawer")}>
                Open drawer
              </Button>
              <Button variant="ghost" onClick={() => setToast(true)}>
                Show toast
              </Button>
            </div>
            <StatusPill>Ready to pair</StatusPill>
          </Card>

          <Card className="gallery-card">
            <h2>Loading</h2>
            <ProgressBar label="Preparing pages" value={64} />
            <Spinner label="Starting camera" />
            <Skeleton />
          </Card>

          <Card className="gallery-card">
            <h2>Selection</h2>
            <Tabs
              label="Scan views"
              items={[
                {
                  label: "Preview",
                  content: <p>Check the page before saving it.</p>,
                },
                {
                  label: "Pages",
                  content: <p>Review the pages you’ve captured.</p>,
                },
              ]}
            />
          </Card>

          <Card className="gallery-card">
            <h2>Feedback</h2>
            <EmptyState
              icon={<ScanLine />}
              title="No pages yet"
              description="Scan a page with your phone to see it here."
            />
            <ErrorState
              title="Camera access is off"
              description="Allow camera access in your browser and try again."
            />
            {toast && (
              <Toast onDismiss={() => setToast(false)}>Page saved</Toast>
            )}
          </Card>
        </div>
        <Modal
          open={overlay === "modal"}
          title="Save pages"
          onClose={() => setOverlay(null)}
        >
          <p>Save the pages you’ve scanned as a PDF.</p>
          <Button
            onClick={() => {
              setOverlay(null);
              setToast(true);
            }}
          >
            Save PDF
          </Button>
        </Modal>
        <Drawer
          open={overlay === "drawer"}
          title="Advanced"
          onClose={() => setOverlay(null)}
        >
          <p>Connection details will appear here after pairing.</p>
          <StatusPill>Ready to pair</StatusPill>
        </Drawer>
      </main>
    </div>
  );
}
