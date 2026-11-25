import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function readPdfPageSizes(
  bytes: Uint8Array,
): Promise<[number, number][]> {
  const task = getDocument({
    data: Uint8Array.from(bytes),
    stopAtErrors: true,
  });
  try {
    const document = await task.promise;
    const result: [number, number][] = [];
    for (let index = 1; index <= document.numPages; index++) {
      const { view } = await document.getPage(index);
      result.push([view[2] - view[0], view[3] - view[1]]);
    }
    return result;
  } finally {
    await task.destroy();
  }
}
