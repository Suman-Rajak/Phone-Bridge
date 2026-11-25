import { AlertCircle, Check, Link2, LoaderCircle, X } from "lucide-react";
import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Link2 aria-hidden="true" />
      </span>
      PhoneBridge
    </div>
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "small" | "medium" | "large";
};

export function Button({
  variant = "primary",
  size = "medium",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={["ui-button", className].join(" ")}
      data-variant={variant}
      data-size={size}
    />
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={["ui-card", className].join(" ")} />;
}

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="status-pill">
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function ProgressBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const id = useId();
  return (
    <div className="progress-group">
      <label htmlFor={id}>{label}</label>
      <span aria-hidden="true">{value}%</span>
      <progress id={id} max={100} value={value} />
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="spinner" role="status">
      <LoaderCircle aria-hidden="true" />
      {label}
    </span>
  );
}

export function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

type StateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: StateProps) {
  return (
    <div className="empty-state">
      <span className="icon-tile" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="state-title">{title}</p>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: Omit<StateProps, "icon">) {
  return (
    <div className="error-state">
      <AlertCircle aria-hidden="true" />
      <div role="alert">
        <p className="state-title">{title}</p>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Toast({
  children,
  action,
  onDismiss,
}: {
  children: ReactNode;
  action?: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="toast" data-action={Boolean(action)}>
      <Check aria-hidden="true" />
      <p role="status">{children}</p>
      {action}
      <Button
        variant="ghost"
        size="small"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
