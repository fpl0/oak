// Studio under load: a sketchbook of 200 sketches, a 64-bar sketch, A/B toggled hard while playing, and leaving
// the page while it plays (nothing may keep sounding, nothing may keep a stream open).
import { expect, type Page, test } from "@playwright/test";
import { useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { api, createSketch, expectNoHorizontalOverflow, matrix, seed } from "./support.ts";

const WB = "[data-testid=workbench]";

async function rms(page: Page, ms = 1200): Promise<number> {
  return page.evaluate(async (ms) => {
    const o = (globalThis as { __oakStrudel?: { master: { level(): { rms: number } } } }).__oakStrudel;
    let peak = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      peak = Math.max(peak, o?.master.level().rms ?? 0);
      await new Promise((r) => setTimeout(r, 20));
    }
    return peak;
  }, ms);
}

test.describe.configure({ mode: "serial" });

// Other engineers edit the shared tree while this suite runs: Vite's HMR socket must not reload the page mid-test.
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await seed(page, "after U02.L08");
  await page.close();
});

test("a sketchbook of 200 sketches lists, searches and stays inside the page", async ({ page }) => {
  test.setTimeout(240_000);
  for (let i = 1; i <= 200; i++)
    await createSketch(
      page,
      i % 17 === 0
        ? `A very long sketch title that keeps going well past the card width, number ${i}`
        : `Stress ${String(i).padStart(3, "0")}`,
      `setcpm(90/4)\n\ndrums: s("bd hh sd hh")\n`,
    );
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const t0 = Date.now();
  await page.goto("/studio");
  const cards = page.getByTestId("sketch-card");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(Date.now() - t0).toBeLessThan(15_000);
  expect(await cards.count()).toBeGreaterThanOrEqual(200);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("searchbox").fill("Stress 19");
  await expect(cards).toHaveCount(10); // Stress 190 … Stress 199
  await page.getByRole("searchbox").fill("");
  await matrix(page, "/studio", "stress-200-sketches", async (p) => {
    await expect(p.getByTestId("sketch-card").first()).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(p);
  });
});

test("a 64-bar sketch renders, loops and scrolls without overflowing", async ({ page }) => {
  const names = ["c", "d", "e", "f", "g", "a", "b"];
  const melody = Array.from({ length: 64 }, (_, i) => `${names[i % 7]}${3 + (Math.floor(i / 7) % 2)}`).join(
    " ",
  );
  const id = await createSketch(
    page,
    "Sixty-four bars",
    `setcpm(90/4)\n\nmel: note("<${melody}>").s("piano")\ndrums: s("bd hh sd hh")\n`,
  );
  await page.addInitScript((sid) => localStorage.setItem(`oak.studio.length.${sid}`, "64"), id);
  await matrix(page, `/studio/${id}`, "stress-64-bars", async (p) => {
    await expect(p.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
    await expectNoHorizontalOverflow(p);
  });
  await page.getByTestId("play-toggle").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  expect(await rms(page)).toBeGreaterThan(0.001);
  await page.getByTestId("play-toggle").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "0");
});

test("A/B hammered while playing, then leaving the page: silence, one player", async ({ page }) => {
  const id = await createSketch(page, "AB storm", `setcpm(90/4)\n\ndrums: s("bd hh sd hh")\n`);
  const v2 = await api(page, "POST", `/sketches/${id}/versions`, {
    sessionId: null,
    code: `setcpm(90/4)\n\ndrums: s("bd*2 hh sd hh")\nbass: note("c2 g1").s("sawtooth")\n`,
    bpm: 90,
    meter: "4/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: true,
  });
  expect([200, 201]).toContain(v2.status);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto(`/studio/${id}`);
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("play-toggle").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  expect(await rms(page)).toBeGreaterThan(0.001);
  // Oak 2.0 W4 (PLAN F5): the version compare is the matched card (offline renders at the same loudness).
  await page.getByRole("button", { name: "Compare with version 1" }).click();
  const card = page.getByTestId("matched-version-compare");
  await card.getByTestId("compare-b").click();
  await expect(card.getByTestId("compare-note")).toContainText(
    /Matched in loudness|already play at the same loudness/,
    { timeout: 90_000 },
  );
  for (let i = 0; i < 12; i++) await card.getByTestId(i % 2 ? "compare-b" : "compare-a").click();
  await expect(card.getByTestId("compare-b")).toHaveAttribute("aria-pressed", "true");
  // Away while it plays: the Studio's sound stops with the page.
  await page.getByRole("link", { name: "Toolbox" }).click();
  await expect(page).toHaveURL(/\/toolbox$/);
  await page.waitForTimeout(600);
  expect(await rms(page, 1500)).toBeLessThan(0.0005);
  expect(errors).toEqual([]);
});
