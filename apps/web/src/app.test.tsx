import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { App } from "./App";

test("renders the PhoneBridge heading", () => {
  const html = renderToStaticMarkup(<App />);

  expect(html).toMatch(/<h1\b[^>]*>PhoneBridge<\/h1>/);
});
