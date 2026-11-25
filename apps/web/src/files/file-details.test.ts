import { expect, test } from "vitest";
import { safeFileName } from "./file-details";

test("strips path components, control characters, and bidirectional overrides", () => {
  const name = safeFileName("..\\../camera\u0000\u202e?.jpg");
  expect(name).toBe("_.._camera_.jpg");
  expect(safeFileName("... ")).toBe("download");
});

test("protects reserved system names and keeps valid Unicode within filesystem bounds", () => {
  expect(safeFileName("CON.txt")).toBe("_CON.txt");
  expect(safeFileName("COM1 .txt")).toBe("_COM1 .txt");
  expect(safeFileName("Résumé 1.pdf")).toBe("Résumé 1.pdf");
  expect(
    new TextEncoder().encode(safeFileName("📄".repeat(300))).byteLength,
  ).toBe(240);
});
