import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { App } from "./App";

test("renders the laptop pairing shell", () => {
  const html = renderToStaticMarkup(<App />);

  expect(html).toMatch(/<h1\b[^>]*>Connect your phone<\/h1>/);
});

test("renders the phone tool navigation for a pairing link", () => {
  const html = renderToStaticMarkup(<App pathname="/p/test-token" />);

  expect(html).toMatch(/<h1\b[^>]*>Scanner<\/h1>/);
  expect(html).toContain('aria-label="Phone tools"');
});
