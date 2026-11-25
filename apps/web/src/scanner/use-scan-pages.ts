import { useCallback, useEffect, useRef, useState } from "react";
import type { PairingSession } from "@phonebridge/rtc";
import type { Corners } from "@phonebridge/vision";
import type { PageRequest, PageResult } from "@phonebridge/vision/worker";
import { PageRenderer } from "./page-renderer";
import { receiveScans } from "./scan-transfer";

export type ScanPage = {
  id: string;
  request: PageRequest;
  version: number;
  stage: "working" | "ready" | "failed";
  result?: PageResult;
};

export function useScanPages(session: PairingSession | null) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [transferFailed, setTransferFailed] = useState(false);
  const [retakeId, setRetakeId] = useState<string | null>(null);
  const retake = useRef<string | null>(null);
  const renderer = useRef<PageRenderer | null>(null);
  const sequence = useRef(0);

  const renderPage = useCallback((page: ScanPage) => {
    const worker = renderer.current;
    if (!worker) return;
    function update(change: (entry: ScanPage) => ScanPage) {
      if (renderer.current !== worker) return;
      setPages((current) =>
        current.map((entry) =>
          entry.id === page.id && entry.version === page.version
            ? change(entry)
            : entry,
        ),
      );
    }
    void worker.render(page.request).then(
      (result) =>
        update((entry) => ({
          ...entry,
          stage: "ready",
          result,
          request: { ...entry.request, corners: result.corners },
        })),
      () => update((entry) => ({ ...entry, stage: "failed" })),
    );
  }, []);

  useEffect(() => {
    const worker = new PageRenderer();
    renderer.current = worker;
    return () => {
      renderer.current = null;
      worker.close();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      retake.current = null;
      setRetakeId(null);
      return;
    }
    return receiveScans(session, {
      acceptReplacement: (id) => retake.current === id,
      received({ jpeg, metadata }) {
        const id = metadata.replacesScanId ?? metadata.scanId;
        if (retake.current === id) {
          retake.current = null;
          setRetakeId(null);
        }
        const page: ScanPage = {
          id,
          version: ++sequence.current,
          stage: "working",
          request: {
            jpeg,
            mode: "clean",
            rotation: 0,
            phoneCorners: metadata.corners?.map(([x, y]) => ({ x, y })) as
              Corners | undefined,
          },
        };
        setPages((current) =>
          current.some((entry) => entry.id === id)
            ? current.map((entry) => (entry.id === id ? page : entry))
            : [...current, page],
        );
        setSelectedId(id);
        setTransferFailed(false);
        renderPage(page);
      },
      failed() {
        setTransferFailed(true);
      },
    });
  }, [renderPage, session]);

  const selected = pages.find(({ id }) => id === selectedId) ?? pages[0];

  function updatePage(
    page: ScanPage,
    changes: Partial<Pick<PageRequest, "corners" | "mode" | "rotation">>,
  ) {
    const next: ScanPage = {
      ...page,
      version: ++sequence.current,
      stage: "working",
      request: { ...page.request, ...changes },
    };
    setPages((current) =>
      current.map((entry) => (entry.id === page.id ? next : entry)),
    );
    renderPage(next);
  }

  function orderPage(id: string, target: string) {
    setPages((current) => {
      const from = current.findIndex((page) => page.id === id);
      const to = current.findIndex((page) => page.id === target);
      if (from < 0 || to < 0 || from === to) return current;
      const next = current.slice();
      const [page] = next.splice(from, 1);
      next.splice(to, 0, page);
      return next;
    });
  }

  function requestRetake(id: string) {
    if (!session) return;
    try {
      session.sendTransferControl({ type: "scan.retake", scanId: id });
      retake.current = id;
      setRetakeId(id);
      setTransferFailed(false);
    } catch {
      setTransferFailed(true);
    }
  }

  return {
    pages,
    selected,
    transferFailed,
    retakeId,
    selectPage: setSelectedId,
    updatePage,
    orderPage,
    requestRetake,
    removePage: (id: string) =>
      setPages((current) => current.filter((page) => page.id !== id)),
  };
}
