import { createVisionWorker } from "@phonebridge/vision/worker";
import type {
  PageRequest,
  PageResult,
  VisionRequest,
  VisionResponse,
} from "@phonebridge/vision/worker";

type PendingPage = {
  id: number;
  resolve(page: PageResult): void;
  reject(error: Error): void;
};

/** Serialize edits to keep the vision worker's memory bounded. */
export class PageRenderer {
  private queue = Promise.resolve();
  private worker: Worker | undefined;
  private pending: PendingPage | undefined;
  private sequence = 0;
  private closed = false;

  render(page: PageRequest): Promise<PageResult> {
    const result = this.queue.then(() => this.submit(page));
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  close(): void {
    this.closed = true;
    this.fail("The editor closed.");
  }

  private fail(message: string): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending?.reject(new Error(message));
    this.pending = undefined;
  }

  private submit(page: PageRequest): Promise<PageResult> {
    if (this.closed) return Promise.reject(new Error("The editor closed."));
    if (!this.worker) {
      this.worker = createVisionWorker();
      this.worker.onerror = () => this.fail("The page editor could not load.");
      this.worker.onmessageerror = () =>
        this.fail("The page editor could not read the scan.");
      this.worker.onmessage = ({ data }: MessageEvent<VisionResponse>) => {
        const pending = this.pending;
        if (!pending || data.id !== pending.id) return;
        this.pending = undefined;
        if ("page" in data) pending.resolve(data.page);
        else pending.reject(new Error("The page could not be straightened."));
      };
    }
    const worker = this.worker;
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending = { id, resolve, reject };
      try {
        worker.postMessage({ id, page } satisfies VisionRequest);
      } catch {
        this.fail("The page editor could not accept the scan.");
      }
    });
  }
}
