import { lazy, Suspense } from "react";
import { LaptopShell, PhoneShell } from "./shell";
import { Spinner } from "./ui/primitives";

const Gallery = import.meta.env.DEV ? lazy(() => import("./ui/gallery")) : null;

export function App({ pathname = "/" }: { pathname?: string }) {
  if (Gallery && pathname === "/ui") {
    return (
      <Suspense
        fallback={
          <main className="grid min-h-dvh place-items-center">
            <Spinner label="Loading components" />
          </main>
        }
      >
        <Gallery />
      </Suspense>
    );
  }

  if (/^\/p\/[^/]+\/?$/.test(pathname)) return <PhoneShell />;
  return <LaptopShell />;
}
