import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

type ClipboardState = {
  value: string;
  focused: boolean;
  writes: string[];
  denyWrite: boolean;
};
type TestWindow = typeof window & { testClipboard: ClipboardState };

async function mockClipboard(page: Page, value: string) {
  await page.addInitScript((text) => {
    const state: ClipboardState = {
      value: text,
      focused: true,
      writes: [],
      denyWrite: false,
    };
    (window as TestWindow).testClipboard = state;
    Object.defineProperty(document, "hasFocus", { value: () => state.focused });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        readText: async () => state.value,
        writeText: async (received: string) => {
          if (state.denyWrite)
            throw new DOMException(
              "Clipboard permission denied",
              "NotAllowedError",
            );
          state.value = received;
          state.writes.push(received);
        },
      },
    });
  }, value);
}

test("clipboard round-trips Hindi, emoji, and literal text and offers Copy when unfocused", async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(60_000);
  const greeting = "नमस्ते 🌱\n<em>plain text</em>";
  const followup = "फिर मिलेंगे 🌙";
  await laptop.setViewportSize({ width: 1440, height: 900 });
  await laptop.emulateMedia({ colorScheme: "light" });
  await mockClipboard(laptop, "");
  await laptop.goto("/");
  const link = laptop.getByRole("link", { name: "Open pairing link" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  try {
    const phone = await context.newPage();
    await mockClipboard(phone, greeting);
    await phone.goto((await link.getAttribute("href")) ?? "");
    await phone.getByRole("button", { name: "Clipboard", exact: true }).click();
    await expect(
      laptop.getByRole("heading", { name: "Text clipboard" }),
    ).toBeVisible({ timeout: 15_000 });
    await phone.getByRole("button", { name: "Paste from phone" }).click();
    await expect(phone.getByLabel("Text to send")).toHaveValue(greeting);
    await phone.getByRole("button", { name: "Send", exact: true }).click();
    await expect(laptop.getByLabel("Received text")).toHaveValue(greeting);
    await expect(laptop.getByText("Copied to your clipboard.")).toBeVisible();
    expect(
      await laptop.evaluate(() => (window as TestWindow).testClipboard.writes),
    ).toEqual([greeting]);

    await laptop.getByRole("button", { name: "Paste from laptop" }).click();
    await expect(laptop.getByLabel("Text to send")).toHaveValue(greeting);
    await laptop.getByRole("button", { name: "Send", exact: true }).click();
    const phoneReceipt = phone.getByRole("region", {
      name: "Received clipboard",
    });
    await expect(phoneReceipt.getByLabel("Received text")).toHaveValue(
      greeting,
    );
    await expect(phoneReceipt.locator("em")).toHaveCount(0);
    await phoneReceipt
      .getByRole("button", { name: "Copy", exact: true })
      .click();
    await expect(
      phoneReceipt.getByText("Copied to your clipboard."),
    ).toBeVisible();
    expect(
      await phone.evaluate(() => (window as TestWindow).testClipboard.writes),
    ).toEqual([greeting]);

    await laptop.evaluate(() => {
      (window as TestWindow).testClipboard.focused = false;
    });
    await phone.getByLabel("Text to send").fill(followup);
    await phone.getByRole("button", { name: "Send", exact: true }).click();
    const laptopReceipt = laptop.getByRole("region", {
      name: "Received clipboard",
    });
    await expect(laptopReceipt.getByLabel("Received text")).toHaveValue(
      followup,
    );
    await expect(
      laptopReceipt.getByText("Text received from your phone."),
    ).toBeVisible();
    expect(
      await laptop.evaluate(() => (window as TestWindow).testClipboard.writes),
    ).toEqual([greeting]);
    const copy = laptopReceipt.getByRole("button", {
      name: "Copy",
      exact: true,
    });
    await expect(copy).toBeEnabled();

    for (const device of [laptop, phone]) {
      const { violations } = await new AxeBuilder({ page: device }).analyze();
      expect(
        violations.filter(
          ({ impact }) => impact === "serious" || impact === "critical",
        ),
      ).toEqual([]);
    }
    const evidence = process.env.PLAYWRIGHT_EVIDENCE_DIR;
    if (evidence) {
      await laptop.screenshot({
        path: join(evidence, "t14-laptop-clipboard.png"),
      });
      await phone.screenshot({
        path: join(evidence, "t14-phone-clipboard.png"),
      });
    }

    await copy.click();
    await expect(
      laptopReceipt.getByText("Copied to your clipboard."),
    ).toBeVisible();
    expect(
      await laptop.evaluate(() => (window as TestWindow).testClipboard.writes),
    ).toEqual([greeting, followup]);
    await laptop.evaluate(() => {
      (window as TestWindow).testClipboard.denyWrite = true;
    });
    await copy.click();
    await expect(
      laptopReceipt.getByText("Text selected. Use your device’s Copy command."),
    ).toBeVisible();
    expect(
      await laptopReceipt.getByLabel("Received text").evaluate((node) => {
        const field = node as HTMLTextAreaElement;
        return [field.selectionStart, field.selectionEnd];
      }),
    ).toEqual([0, followup.length]);
    await phone.setViewportSize({ width: 360, height: 844 });
    await expect
      .poll(() => phone.evaluate(() => document.documentElement.scrollWidth))
      .toBe(360);
  } finally {
    await context.close();
  }
});
