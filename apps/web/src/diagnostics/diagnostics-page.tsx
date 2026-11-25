import { useEffect, useRef, useState } from "react";
import { Brand, Card, ErrorState, Spinner, StatusPill } from "../ui/primitives";
import { inspectCapabilities } from "./capabilities";
import type { CapabilityId, CapabilityStatus } from "./capabilities";

const copy = {
  camera: {
    name: "Camera",
    fallback: "Try a browser that supports camera access.",
  },
  "image-capture": {
    name: "Photo capture (ImageCapture)",
    fallback: "Use a frame from the video preview.",
  },
  "relative-orientation": {
    name: "Motion sensor (RelativeOrientationSensor)",
    fallback: "Use device orientation if it’s available.",
  },
  "device-orientation": {
    name: "Device orientation",
    fallback: "Use the presentation buttons without the motion pointer.",
  },
  "clipboard-read": {
    name: "Clipboard read",
    fallback: "Paste text manually.",
  },
  "clipboard-write": {
    name: "Clipboard write",
    fallback: "Select and copy text manually.",
  },
  "file-system": {
    name: "File System Access",
    fallback: "Use a regular browser download.",
  },
  webgl2: {
    name: "WebGL2",
    fallback: "Try a browser or device with WebGL2 enabled.",
  },
  webgpu: {
    name: "WebGPU",
    fallback: "Use WebGL2 if it’s available.",
  },
  "document-picture-in-picture": {
    name: "Document Picture-in-Picture",
    fallback: "Use a regular browser window.",
  },
} satisfies Record<CapabilityId, { name: string; fallback: string }>;

const statusLabel: Record<CapabilityStatus, string> = {
  available: "Available",
  unavailable: "Unavailable",
  "needs-https": "Needs HTTPS",
};

export default function DiagnosticsPage() {
  const [report, setReport] =
    useState<ReturnType<typeof inspectCapabilities>>();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    setReport(inspectCapabilities(window));
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a
            href="/"
            aria-label="PhoneBridge home"
            className="inline-flex min-h-touch items-center"
          >
            <Brand />
          </a>
          {report?.secure && <StatusPill>Secure page</StatusPill>}
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-8 sm:py-12">
        <div className="grid gap-3">
          <h1 className="text-heading font-semibold tracking-tight">
            Browser diagnostics
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted sm:text-base">
            See which features this browser offers. Some still need your
            permission or compatible hardware.
          </p>
        </div>
        {report?.secure === false && (
          <ErrorState
            title="Some features need a secure connection"
            description="Open this page over HTTPS or on localhost to check them."
          />
        )}
        <Card>
          {report ? (
            <table
              className="w-full text-left text-sm"
              aria-label="Browser capabilities"
            >
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="px-4 py-3 sm:px-6">
                    Capability
                  </th>
                  <th scope="col" className="px-3 py-3 sm:px-6">
                    Availability
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.capabilities.map(({ id, status }) => (
                  <tr key={id} className="border-b border-line last:border-b-0">
                    <th
                      scope="row"
                      className="px-4 py-3 font-semibold wrap-break-word sm:px-6"
                    >
                      {copy[id].name}
                      {status === "unavailable" && (
                        <span className="mt-1 block font-normal leading-relaxed text-muted">
                          {copy[id].fallback}
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-3 align-top whitespace-nowrap sm:px-6">
                      <StatusPill>{statusLabel[status]}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6">
              <Spinner label="Checking browser capabilities" />
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
