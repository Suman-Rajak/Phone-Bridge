import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

async function pairingUrl(laptop: Page): Promise<URL> {
  await laptop.goto("/");
  const link = laptop.getByRole("link", { name: "Open pairing link" });
  await expect(
    link.getByRole("img", { name: "Pairing QR code" }),
  ).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/\/p\/[A-Za-z0-9_-]{22}#fp=[a-f0-9]{64}$/);
  return new URL(href ?? "");
}

test("pairing opens all three channels and rejects a second phone", async ({
  page: laptop,
  browser,
}) => {
  const url = await pairingUrl(laptop);
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const extraContext = await browser.newContext();

  try {
    const phone = await phoneContext.newPage();
    const started = performance.now();
    await phone.goto(url.href, { waitUntil: "commit" });
    const connected = { name: /^Connected/ };
    await Promise.all([
      expect(phone.getByRole("button", connected)).toBeVisible({
        timeout: 5_000,
      }),
      expect(laptop.getByRole("button", connected)).toBeVisible({
        timeout: 5_000,
      }),
    ]);
    expect(performance.now() - started).toBeLessThan(5_000);

    const sas = phone.getByLabel("Verification code");
    await expect(sas).toHaveText(/^\d{4}$/);
    await expect(laptop.getByLabel("Verification code")).toHaveText(
      await sas.innerText(),
    );

    const evidence = process.env.PLAYWRIGHT_EVIDENCE_DIR;
    if (evidence) {
      await laptop.screenshot({
        path: join(evidence, "t06-laptop-paired.png"),
      });
      await phone.screenshot({ path: join(evidence, "t06-phone-paired.png") });
    }

    for (const device of [laptop, phone]) {
      await device.getByRole("button", connected).click();
      const drawer = device.getByRole("dialog", { name: "Advanced" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText("open", { exact: true })).toHaveCount(3);
      await expect(
        drawer.getByRole("button", { name: "Copy diagnostics" }),
      ).toBeEnabled();
    }

    const extra = await extraContext.newPage();
    await extra.goto(url.href);
    await expect(extra.getByRole("alert")).toContainText("Room is full");
    await expect(phone.getByRole("dialog", { name: "Advanced" })).toBeVisible();
  } finally {
    await Promise.all([extraContext.close(), phoneContext.close()]);
  }
});

test("pairing aborts when the QR fingerprint is tampered with", async ({
  page: laptop,
  browser,
}) => {
  const url = await pairingUrl(laptop);
  const actual = new URLSearchParams(url.hash.slice(1)).get("fp") ?? "";
  url.hash = "fp=" + (actual[0] === "a" ? "b" : "a") + actual.slice(1);
  const phone = await browser.newPage();
  try {
    await phone.goto(url.href);
    await expect(phone.getByRole("alert")).toContainText("Pairing not secure");
    await expect(phone.getByRole("button", { name: /^Connected/ })).toHaveCount(
      0,
    );
    await expect(phone.getByLabel("Verification code")).toHaveCount(0);
  } finally {
    await phone.close();
  }
});
