import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./primitives";

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

function Overlay({
  open,
  onClose,
  title,
  children,
  layout,
}: OverlayProps & { layout: "modal" | "drawer" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (typeof dialog.showModal !== "function") {
      dialog.toggleAttribute("open", open);
      return;
    }

    // Native dialogs keep keyboard focus in the overlay and restore it on close.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="overlay"
      data-layout={layout}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="overlay-header">
        <h2 id={heading}>{title}</h2>
        <Button
          variant="ghost"
          size="small"
          onClick={onClose}
          aria-label={"Close " + title}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="overlay-body">{children}</div>
    </dialog>
  );
}

export function Modal(props: OverlayProps) {
  return <Overlay {...props} layout="modal" />;
}

export function Drawer(props: OverlayProps) {
  return <Overlay {...props} layout="drawer" />;
}
