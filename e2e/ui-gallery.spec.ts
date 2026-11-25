import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

async function capture(page: Page, name: string) {
  if (process.env.PLAYWRIGHT_EVIDENCE_DIR) {
    await page.screenshot({
      path: join(process.env.PLAYWRIGHT_EVIDENCE_DIR, "T01D-" + name + ".png"),
      animations: "disabled",
    });
  }
}

const views = [
  {
    name: "laptop-light",
    colorScheme: "light",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "phone-dark",
    colorScheme: "dark",
    viewport: { width: 390, height: 844 },
  },
] as const;

for (const { name, colorScheme, viewport } of views) {
  test("gallery components and overlays at " + name, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/ui");
    await expect(
      page.getByRole("heading", { name: "Component gallery" }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
    await expect(page.locator(".gallery-page")).toHaveCSS(
      "color-scheme",
      colorScheme,
    );
    await expect(
      page.getByRole("progressbar", { name: "Preparing pages" }),
    ).toHaveAttribute("value", "64");
    await expect(page.getByText("Starting camera")).toBeVisible();
    await expect(page.getByText("No pages yet")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Camera access is off");
    await expect(page.getByText("Page saved")).toBeVisible();
    await expectAccessible(page);
    await capture(page, "gallery-" + name);

    const modalTrigger = page.getByRole("button", { name: "Open modal" });
    await modalTrigger.click();
    const modal = page.getByRole("dialog", { name: "Save pages" });
    await expect(modal).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(modalTrigger).toBeFocused();

    await page.getByRole("button", { name: "Open drawer" }).click();
    const drawer = page.getByRole("dialog", { name: "Advanced" });
    await expect(drawer).toBeVisible();
    await expectAccessible(page);
    await drawer.getByRole("button", { name: "Close Advanced" }).click();
    await expect(drawer).toBeHidden();

    const preview = page.getByRole("tab", { name: "Preview" });
    await preview.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Pages" })).toBeFocused();
    await expect(page.getByRole("tabpanel", { name: "Pages" })).toBeVisible();

    await page.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(page.getByText("Page saved")).toBeHidden();
    await page.getByRole("button", { name: "Show toast" }).click();
    await expect(page.getByText("Page saved")).toBeVisible();

    const otherTheme = colorScheme === "light" ? "Dark" : "Light";
    const radio = page.getByRole("radio", { name: otherTheme });
    await radio.focus();
    await page.keyboard.press("Space");
    await expect(radio).toBeChecked();
    await expect(page.locator(".gallery-page")).toHaveCSS(
      "color-scheme",
      otherTheme.toLowerCase(),
    );
  });
}

test("laptop and phone shells at their intended viewports", async ({
  page,
}) => {
  await page.setViewportSize(views[0].viewport);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Connect your phone" }),
  ).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await expectAccessible(page);
  await capture(page, "laptop");

  await page.setViewportSize(views[1].viewport);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/p/example");
  await expect(page.getByRole("heading", { name: "Scanner" })).toBeVisible();
  const modeBar = page.getByRole("group", { name: "Phone tools" });
  await expect(modeBar.getByRole("button")).toHaveCount(5);
  await expectAccessible(page);
  await capture(page, "phone");

  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  for (const button of await modeBar.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const live = modeBar.getByRole("button", { name: "Live" });
  await live.click();
  await expect(live).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Document camera" }),
  ).toBeVisible();
});
