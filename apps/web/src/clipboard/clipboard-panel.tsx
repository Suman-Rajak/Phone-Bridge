import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Copy, Send } from "lucide-react";
import { clipboardMaxBytes } from "@phonebridge/protocol";
import type { PairingSession } from "@phonebridge/rtc";
import { Button, Card, ErrorState, Toast } from "../ui/primitives";

async function writeText(text: string): Promise<boolean> {
  try {
    const clipboard = navigator.clipboard;
    if (!window.isSecureContext || typeof clipboard?.writeText !== "function")
      return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ClipboardPanel({
  session,
  role,
  visible = true,
  showClipboard,
}: {
  session: PairingSession | null;
  role: "host" | "phone";
  visible?: boolean;
  showClipboard?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [received, setReceived] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const output = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!session) return;
    let current = 0;
    let active = true;
    let writes = Promise.resolve();
    const unsubscribe = session.observeTransfers({
      control(message) {
        if (message.type !== "clip.text") return;
        const sequence = ++current;
        const { text } = message;
        setReceived(text);
        setCopyMessage("");
        setPrompt(false);
        if (role !== "host") return;
        writes = writes.then(async () => {
          if (!active || current !== sequence) return;
          const focused =
            typeof document.hasFocus === "function" && document.hasFocus();
          const copied = focused && (await writeText(text));
          if (!active || current !== sequence) return;
          if (copied) setCopyMessage("Copied to your clipboard.");
          else setPrompt(true);
        });
      },
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [role, session]);

  async function paste() {
    const clipboard = navigator.clipboard;
    if (window.isSecureContext && typeof clipboard?.readText === "function") {
      try {
        setDraft(await clipboard.readText());
        setError("");
        setDraftMessage("");
        return;
      } catch {
        setDraftMessage(
          "Paste into the text box using your device’s Paste command.",
        );
      }
    } else {
      setDraftMessage(
        "Paste into the text box using your device’s Paste command.",
      );
    }
    input.current?.focus();
  }

  function send() {
    setError("");
    setDraftMessage("");
    if (!session || !draft.length) return;
    if (
      draft.length > clipboardMaxBytes ||
      new TextEncoder().encode(draft).byteLength > clipboardMaxBytes
    ) {
      setError("Shorten the text to 1 MB or less and try again.");
      return;
    }
    try {
      session.sendTransferControl({ type: "clip.text", text: draft });
      setDraftMessage("Text sent.");
    } catch {
      setError("Reconnect both devices and send the text again.");
    }
  }

  async function copy() {
    if (received === null) return;
    if (await writeText(received)) {
      setCopyMessage("Copied to your clipboard.");
    } else {
      output.current?.focus();
      output.current?.select();
      setCopyMessage("Text selected. Use your device’s Copy command.");
    }
    setPrompt(false);
  }

  if (!visible) {
    return received === null || copyMessage || !showClipboard ? null : (
      <Button variant="secondary" onClick={showClipboard}>
        View clipboard
      </Button>
    );
  }

  const copyButton = (
    <Button variant="secondary" onClick={() => void copy()}>
      <Copy aria-hidden="true" /> Copy
    </Button>
  );
  return (
    <Card className="clipboard-panel">
      <h2>Text clipboard</h2>
      <label className="clipboard-field">
        <span>Text to send</span>
        <textarea
          ref={input}
          value={draft}
          rows={3}
          onChange={(event) => {
            setDraft(event.target.value);
            setDraftMessage("");
            setError("");
          }}
        />
      </label>
      <div className="file-actions">
        <Button variant="secondary" onClick={() => void paste()}>
          <ClipboardPaste aria-hidden="true" />{" "}
          {role === "phone" ? "Paste from phone" : "Paste from laptop"}
        </Button>
        <Button disabled={!session || !draft.length} onClick={send}>
          <Send aria-hidden="true" /> Send
        </Button>
      </div>
      {draftMessage && (
        <p className="muted" role="status">
          {draftMessage}
        </p>
      )}
      {error && <ErrorState title="Couldn’t send text" description={error} />}
      {received !== null && (
        <section className="clipboard-received" aria-label="Received clipboard">
          {prompt && (
            <Toast action={copyButton} onDismiss={() => setPrompt(false)}>
              Text received from your phone.
            </Toast>
          )}
          <label className="clipboard-field">
            <span>Received text</span>
            <textarea ref={output} readOnly rows={3} value={received} />
          </label>
          {!prompt && copyButton}
          {copyMessage && (
            <p className="muted" role="status">
              {copyMessage}
            </p>
          )}
        </section>
      )}
    </Card>
  );
}
