import { lazy, Suspense } from "react";
import { LaptopShell, PhoneShell } from "./shell";
import { Spinner } from "./ui/primitives";

const Gallery = import.meta.env.DEV ? lazy(() => import("./ui/gallery")) : null;
const Diagnostics = lazy(() => import("./diagnostics/diagnostics-page"));

export function App({ pathname = "/" }: { pathname?: string }) {
  const Page =
    pathname === "/diagnostics"
      ? Diagnostics
      : pathname === "/ui"
        ? Gallery
        : null;

  if (Page) {
    return (
      <Suspense
        fallback={
          <main className="grid min-h-dvh place-items-center">
            <Spinner label="Loading page" />
          </main>
        }
      >
        <Page />
      </Suspense>
    );
  }

  const room = /^\/p\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (room) return <PhoneShell room={room} />;
  return <LaptopShell />;
}
