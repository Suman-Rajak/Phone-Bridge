import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const megabytes = 100;
const fixtureName = "transfer-100MB.bin";
type TestWindow = Window & { pauseFileBulk?: boolean; fileChunks?: number };

async function createFixture(path: string): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  const file = await open(path, "w");
  const hash = createHash("sha256");
  try {
    for (let part = 0; part < megabytes; part++) {
      const block = Buffer.alloc(1_000_000, part);
      await file.writeFile(block);
      hash.update(block);
    }
  } finally {
    await file.close();
  }
  return hash.digest("hex");
}

async function downloadAndCheck(
  receiver: Page,
  digest: string,
): Promise<string> {
  const list = receiver.getByRole("list", { name: "Received files" });
  const row = list.getByRole("listitem").filter({ hasText: fixtureName });
  const link = row.getByRole("link", { name: "Download file" });
  await expect(link).toBeVisible({ timeout: 60_000 });
  const [download] = await Promise.all([
    receiver.waitForEvent("download"),
    link.click(),
  ]);
  expect(download.suggestedFilename()).toBe(fixtureName);
  const path = await download.path();
  expect((await stat(path)).size).toBe(megabytes * 1_000_000);
  const actual = createHash("sha256");
  for await (const bytes of createReadStream(path)) actual.update(bytes);
  expect(actual.digest("hex")).toBe(digest);
  return await row.getByText(/MB\/s/).innerText();
}

test("files transfer 100 MB both ways, confirm large files, and cancel on both devices", async ({
  page: laptop,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const path = info.outputPath(fixtureName);
  const digest = await createFixture(path);
  await laptop.setViewportSize({ width: 1440, height: 900 });
  await laptop.emulateMedia({ colorScheme: "light" });
  await laptop.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined });
    const state = window as TestWindow;
    const original = RTCDataChannel.prototype.send;
    const amount = Object.getOwnPropertyDescriptor(
      RTCDataChannel.prototype,
      "bufferedAmount",
    )?.get;
    if (!amount)
      throw new Error("Chromium does not expose the bulk buffer counter.");
    Object.defineProperty(RTCDataChannel.prototype, "bufferedAmount", {
      configurable: true,
      get(this: RTCDataChannel) {
        if (
          state.pauseFileBulk &&
          this.label === "bulk" &&
          (state.fileChunks ?? 0) >= 32
        )
          return 9 * 1024 * 1024;
        return amount.call(this);
      },
    });
    RTCDataChannel.prototype.send = function (
      data: string | Blob | ArrayBuffer | ArrayBufferView,
    ) {
      if (state.pauseFileBulk && this.label === "bulk")
        state.fileChunks = (state.fileChunks ?? 0) + 1;
      Reflect.apply(original, this, [data]);
    };
  });
  await laptop.goto("/");
  const pairing = laptop.getByRole("link", { name: "Open pairing link" });
  await expect(pairing).toBeVisible({ timeout: 15_000 });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  try {
    await context.addInitScript(() => {
      Object.defineProperty(window, "showSaveFilePicker", { value: undefined });
    });
    const phone = await context.newPage();
    await phone.goto((await pairing.getAttribute("href")) ?? "");
    await phone.getByRole("button", { name: "Clipboard", exact: true }).click();
    await expect(
      phone.getByRole("button", { name: "Choose files" }),
    ).toBeEnabled({ timeout: 15_000 });
    await expect(
      laptop.getByRole("button", { name: "Choose files" }),
    ).toBeEnabled();

    const drop = await laptop.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(["PhoneBridge file fixture"], "sample.txt", {
          type: "text/plain",
        }),
      );
      return transfer;
    });
    await laptop
      .locator(".file-drop-zone")
      .dispatchEvent("drop", { dataTransfer: drop });
    await drop.dispose();
    const received = phone.getByRole("list", { name: "Received files" });
    await expect(
      received.getByRole("listitem").filter({ hasText: "sample.txt" }),
    ).toBeVisible();
    await expect(
      phone.getByRole("dialog", { name: "Receive this file?" }),
    ).toHaveCount(0);
    await received.getByRole("button", { name: "Remove" }).click();

    await laptop.locator('input[type="file"]').setInputFiles(path);
    let confirm = phone.getByRole("dialog", { name: "Receive this file?" });
    await expect(confirm).toContainText("100 MB");
    await laptop
      .getByRole("button", { name: "Cancel outgoing transfer" })
      .click();
    await expect(confirm).toHaveCount(0);
    await expect(phone.getByText("Transfer canceled")).toBeVisible();
    await expect(received).toHaveCount(0);
    await expect(laptop.getByText("Transfer canceled")).toBeVisible();

    await laptop.evaluate(() => {
      const state = window as TestWindow;
      state.fileChunks = 0;
      state.pauseFileBulk = true;
    });
    await laptop.locator('input[type="file"]').setInputFiles(path);
    await confirm.getByRole("button", { name: "Receive file" }).click();
    await expect
      .poll(() => laptop.evaluate(() => (window as TestWindow).fileChunks ?? 0))
      .toBeGreaterThanOrEqual(32);
    const cancelIncoming = phone.getByRole("button", {
      name: "Cancel incoming transfer",
    });
    await cancelIncoming.click();
    await expect(cancelIncoming).toHaveCount(0);
    await expect(
      laptop.getByRole("button", { name: "Cancel outgoing transfer" }),
    ).toHaveCount(0);
    await expect(phone.getByText("Transfer canceled")).toBeVisible();
    await expect(laptop.getByText("Transfer canceled")).toBeVisible();
    await expect(received).toHaveCount(0);
    await laptop.evaluate(() => {
      (window as TestWindow).pauseFileBulk = false;
    });

    await laptop.locator('input[type="file"]').setInputFiles(path);
    await confirm.getByRole("button", { name: "Receive file" }).click();
    const laptopToPhone = await downloadAndCheck(phone, digest);
    await expect(laptop.getByText("File sent", { exact: true })).toBeVisible();

    await phone.locator('input[type="file"]').setInputFiles(path);
    confirm = laptop.getByRole("dialog", { name: "Receive this file?" });
    await expect(confirm).toContainText("100 MB");
    await confirm.getByRole("button", { name: "Receive file" }).click();
    const phoneToLaptop = await downloadAndCheck(laptop, digest);
    await expect(phone.getByText("File sent", { exact: true })).toBeVisible();
    await info.attach("100 MB receiver throughput", {
      body:
        "Laptop to phone: " +
        laptopToPhone +
        "\nPhone to laptop: " +
        phoneToLaptop,
      contentType: "text/plain",
    });
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
      await laptop.screenshot({ path: join(evidence, "t13-laptop-files.png") });
      await phone.screenshot({ path: join(evidence, "t13-phone-files.png") });
    }
    await phone.setViewportSize({ width: 360, height: 844 });
    await expect
      .poll(() => phone.evaluate(() => document.documentElement.scrollWidth))
      .toBe(360);
  } finally {
    await context.close();
  }
});
