// Wave 5 shell: the shortcut sheet's new section and its honest locked rows (a Workbench key whose tool is not
// unlocked says when it opens), side lessons in the command palette (optional, and where they stand), and
// Settings › Data's album recordings with their sizes. Every test seeds its learner and blocks Vite's HMR socket.
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { origin: stack.baseURL, "x-oak": "1" };

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

async function api<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  const res = await page.request.fetch(`${stack.apiURL}/api${path}`, {
    method,
    headers: { ...HEADERS, "content-type": "application/json" },
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
    timeout: 120_000,
  });
  expect(res.status(), `${method} ${path}: ${await res.text()}`).toBeLessThan(300);
  return (await res.json()) as T;
}

async function seed(page: Page, point: string) {
  await api(page, "PUT", "/dev/clock", { reset: true });
  await api(page, "POST", "/dev/seed", { point });
}

test("the shortcut sheet lists the section, chart and control keys, and says when a locked Workbench key opens", async ({
  page,
}) => {
  await seed(page, "after U04.CP");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/settings/keys");
  await page.locator("#main").focus();
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  const fs = sheet.locator('[data-sheet-section="form-sound"]');
  await expect(fs.getByRole("heading", { name: "Sections, charts and sound controls" })).toBeVisible();
  for (const t of [
    "Sections: loop the focused section",
    "Bar chart: the bar a line down",
    "Sound control: a fine step",
  ])
    await expect(fs).toContainText(t);

  // After U04 the form lens (U09), bass roles (U08), blue notes (U11), the chart (U11) and the scope (A1) are ahead.
  const wb = sheet.locator('[data-sheet-section="workbench"]');
  const row = (k: string) => wb.locator(`[data-sheet-row="${k}"]`);
  await expect(row("Shift+O")).toHaveAttribute("data-locked", "true");
  await expect(row("Shift+O")).toContainText("Opens with unit 9, Form.");
  await expect(row("Shift+E")).toContainText("Opens with unit 9, Form.");
  await expect(row("Shift+B")).toContainText("Opens with unit 8, Bass Lines.");
  await expect(row("Shift+U")).toContainText("Opens with unit 11, Pentatonic & Blues.");
  await expect(row("Shift+W")).toContainText("Opens with the side lesson");
  // What the learner has is not marked: the loop, the degree lens (U03.L02), the key panel (U03.L06).
  for (const k of ["L", "D", "Shift+K"]) await expect(row(k)).not.toHaveAttribute("data-locked", "true");
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    await row("Shift+O").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/w5-shortcuts-${m.theme}-${m.width}x${m.height}.png` });
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // Once the form lens is unlocked its rows lose the lock.
  await page.route("**/api/unlocks", async (route) => {
    try {
      const res = await route.fetch();
      const body = (await res.json()) as { items: { itemId: string }[] };
      body.items.push({ ...body.items[0], itemId: "tb.lens.form" } as { itemId: string });
      await route.fulfill({ response: res, json: body });
    } catch {
      // A request a navigation aborted.
    }
  });
  await page.reload();
  await page.locator("#main").focus();
  await page.keyboard.press("?");
  await expect(row("Shift+O")).not.toHaveAttribute("data-locked", "true");
  await expect(row("Shift+O")).not.toContainText("Opens with");
});

test("side lessons in the palette say they are optional, and before U03.L02 when they open", async ({
  page,
}) => {
  await seed(page, "after U04.CP");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto("/progress");
  await expect(page.getByTestId("page-title")).toHaveText(/Progress/);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("combobox", { name: /Search commands/ });
  await expect(input).toBeFocused();
  await input.fill("A1.L01");
  const first = page.getByRole("option").first();
  await expect(first).toContainText("Waves & Harmonics");
  await expect(first).toContainText("Optional side lesson");
  // A core lesson still shows its ID.
  await input.fill("U03.L02");
  await expect(page.getByRole("option").first()).toContainText("U03.L02");
  await page.keyboard.press("Escape");

  // A learner before the gate (U03.L02 not done yet): the side lesson says when it opens.
  await seed(page, "onboarded");
  await page.reload();
  await expect(page.getByTestId("page-title")).toHaveText(/Progress/);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ControlOrMeta+k");
  await input.fill("A1.L02");
  await expect(page.getByRole("option").first()).toContainText(/Side lesson · opens after /);
});

test("Settings › Data lists the album's recordings with their sizes", async ({ page }) => {
  await seed(page, "after U04.CP");
  const album = await api<{ tracks: { id: string; title: string }[] }>(page, "GET", "/album");
  expect(album.tracks.length).toBeGreaterThan(0);
  const info = await api<{ albumAudioBytes: number }>(page, "GET", "/backup");
  expect(info.albumAudioBytes).toBeGreaterThan(0);
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/settings/data");

  const list = page.getByRole("list", { name: "Takes on the album" });
  await expect(list.getByRole("listitem")).toHaveCount(album.tracks.length);
  for (const t of album.tracks) {
    const item = list.getByRole("listitem").filter({ hasText: t.title });
    await expect(item).toContainText(/Side A · track \d+ · v1/);
    await expect(item).toContainText(/\d+(\.\d)? (KB|MB)/);
    await expect(item).toContainText("On the album");
  }
  const total = page.getByTestId("album-audio-total");
  await expect(total).toContainText(`${album.tracks.length} recording`);
  await expect(total).not.toContainText("measuring");
  // The backup help names the album's share, and the help says a backup includes them.
  await expect(page.getByText(/The album's recordings are \d/)).toBeVisible();
  await expect(page.getByText("A backup includes them.")).toBeVisible();
  // Keyboard: the first recording's link is reachable and opens the track.
  const link = list.getByRole("link").first();
  await link.focus();
  await expect(link).toBeFocused();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    await shoot(page, SHOTS, "w5-data", m.theme);
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/album\/[^/]+$/);
});

test("Settings › Data before any release says where album recordings come from", async ({ page }) => {
  await seed(page, "onboarded");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto("/settings/data");
  const empty = page.getByTestId("album-audio-empty");
  await expect(empty).toContainText("No album recordings yet.");
  await empty.getByRole("link", { name: "Open the album" }).click();
  await expect(page).toHaveURL(/\/album$/);
});
