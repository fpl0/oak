// The Toolbox against the real server: every entry grouped by kind, locked ones dimmed with their concept and
// unlock site, an unlocked tool's page with a live editable example and "Open in Studio", a locked tool's
// page with its unlock condition and a listen-only teaser, the unlock moment (replay, Esc), keyboard use and
// the screenshots of both themes and sizes.
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { rms, unlockFirstLessons, WB } from "./helpers.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test("every tool is listed by kind; locked ones are dimmed with their concept and unlock site", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/toolbox");
  await expect(page.getByRole("heading", { level: 1, name: "Toolbox" })).toBeVisible();
  await expect(page.getByText(/15 of \d+ unlocked/)).toBeVisible();
  for (const h of ["Code", "Sounds", "Scales", "Chords", "Features", "Lenses", "Templates"])
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${h}`) })).toBeVisible();
  const cards = page.getByTestId("tool-card");
  expect(await cards.count()).toBeGreaterThan(200);
  // Unlocked first: `s("…")` is learned in U01.L01.
  const s = cards.filter({ hasText: 's("…")' }).first();
  await expect(s).toHaveAttribute("data-locked", "0");
  await expect(s).toContainText("Learned in Heartbeat");
  const gain = cards.filter({ hasText: ".gain(x)" }).first();
  await expect(gain).toHaveAttribute("data-locked", "1");
  await expect(gain).toContainText("Concept:");
  await expect(gain).toContainText("Unlocks at Count to Four");
  // The category tab narrows the grid and keeps it in the URL.
  await page.getByRole("tab", { name: "Sounds" }).click();
  await expect(page).toHaveURL(/cat=sound/);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
  // "Show locked" off: only what is unlocked.
  await page.getByRole("checkbox", { name: "Show locked" }).uncheck();
  await expect(page.locator("[data-testid=tool-card][data-locked='1']")).toHaveCount(0);
  await expect(page.locator("[data-testid=tool-card][data-locked='0']")).toHaveCount(5);
  await page.getByRole("tab", { name: "All" }).click();
  await page.getByRole("checkbox", { name: "Show locked" }).check();
  await page.getByRole("searchbox", { name: "Search the toolbox" }).fill("tempo");
  await expect(cards.filter({ hasText: "setcpm(bpm/4)" }).first()).toBeVisible();
  await expect(cards.filter({ hasText: ".gain(x)" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an unlocked tool: concept, a live editable example that plays, the lessons, Open in Studio", async ({
  page,
}) => {
  await page.goto("/toolbox/tb.mini.repeat");
  await expect(page.getByTestId("tool-name")).toHaveText("x*n");
  await expect(page.getByText("Why it's in your toolbox")).toBeVisible();
  await expect(page.getByTestId("tool-lessons")).toContainText("Learned in Heartbeat");
  const example = page.getByTestId("tool-example");
  await expect(example.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(example.locator(".cm-content")).toContainText('hats: s("hh*8")');
  // Edit the example and play it.
  await example.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nsnare: s("~ sd")');
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(example.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  expect(await rms(page, 1200)).toBeGreaterThan(0.005);
  await page.keyboard.press("ControlOrMeta+.");
  await page.getByTestId("open-in-studio").click();
  await expect(page).toHaveURL(/\/studio\/sk/);
  await expect(page.getByTestId("sketch-title")).toHaveText("Trying x*n");
  await expect(page.locator(".cm-content")).toContainText('snare: s("~ sd")', { timeout: 60_000 });
});

test("a locked tool: its unlock condition and a teaser you can hear but not open", async ({ page }) => {
  await page.goto("/toolbox/tb.gain");
  await expect(page.getByTestId("tool-name")).toContainText(".gain(x)");
  await expect(page.getByTestId("unlock-condition")).toContainText(
    "Unlocks when you complete “Count to Four”",
  );
  // The lesson is named by its title, not its course id.
  await expect(page.getByTestId("unlock-condition")).not.toContainText("U01.L02");
  await expect(page.getByTestId("tool-example")).toHaveCount(0);
  await expect(page.locator(".cm-content")).toHaveCount(0);
  await page.getByTestId("teaser").click();
  await expect(page.getByTestId("teaser")).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  expect(await rms(page, 1200)).toBeGreaterThan(0.005);
  await page.getByTestId("teaser").click();
  await expect(page.getByTestId("teaser")).toHaveAttribute("aria-pressed", "false");
  // A START row with its fallback, and the voicing gate, say so.
  await page.goto("/toolbox/snd.ebass");
  await expect(page.getByTestId("unlock-condition")).toContainText("Unlocks when you start “C1 First Loop”");
  await expect(page.getByTestId("unlock-condition")).toContainText("“Restless Neighbours”");
  await page.goto("/toolbox/tb.voicing");
  await expect(page.getByTestId("unlock-condition")).toContainText("90% or more");
  // A locked Studio template: what its song is, the capstone that unlocks it, and its song to hear.
  await page.goto("/toolbox/tb.template.four-chord-pop");
  await expect(page.getByText("A pop song in G on I–V–vi–IV")).toBeVisible();
  await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  await expect(page.getByTestId("unlock-condition")).toContainText("“C2 Four-Chord Song”");
  await page.getByRole("button", { name: "Hear it" }).click();
  await expect(page.getByTestId("teaser")).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  expect(await rms(page, 1200)).toBeGreaterThan(0.005);
  await page.getByTestId("teaser").click();
  await page.goto("/toolbox/tb.nope");
  await expect(page.getByText("Not in the toolbox")).toBeVisible();
});

test("the unlock moment replays from the Toolbox; Esc skips it; keyboard only", async ({ page }) => {
  await page.goto("/toolbox");
  // Keyboard: Tab to the first unlocked card and open it.
  const first = page.locator("[data-testid=tool-card][data-locked='0']").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/toolbox\/tb\./);
  await page.getByRole("button", { name: "Replay the unlock moment" }).focus();
  await page.keyboard.press("Enter");
  const moment = page.getByTestId("unlock-moment");
  await expect(moment).toBeVisible();
  await expect(moment).toContainText("New in your toolbox");
  await expect(moment).toContainText("Now in autocomplete");
  await page.keyboard.press("Escape");
  await expect(moment).toHaveCount(0);
  // Continue closes it as well.
  await page.getByRole("button", { name: "Replay the unlock moment" }).click();
  await page.getByTestId("unlock-continue").click();
  await expect(page.getByTestId("unlock-moment")).toHaveCount(0);
});

test("reduced motion: the unlock moment appears without movement longer than 120 ms", async ({ page }) => {
  await useUiPrefs(page, { theme: "paper", motion: "on" });
  await page.goto("/toolbox/tb.s");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.getByRole("button", { name: "Replay the unlock moment" }).click();
  const card = page.getByTestId("unlock-moment").locator("li").first();
  await expect(card).toBeVisible();
  const ms = await card.evaluate((el) => {
    const d = getComputedStyle(el).animationDuration;
    return d.endsWith("ms") ? Number.parseFloat(d) : Number.parseFloat(d) * 1000;
  });
  expect(ms).toBeLessThanOrEqual(120);
  await page.screenshot({ path: `${SHOTS}/unlock-moment-paper-reduced.png` });
  await page.keyboard.press("Escape");
});

for (const m of SCREENSHOT_MATRIX) {
  test(`toolbox screens in ${m.theme} at ${m.width}x${m.height}`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    await page.goto("/toolbox");
    await expect(page.getByTestId("tool-card").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/toolbox-${m.theme}-${m.width}x${m.height}.png` });
    await page.goto("/toolbox/tb.setcpm");
    await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
    await shoot(page, SHOTS, "tool-unlocked", m.theme);
    await page.goto("/toolbox/tb.gain");
    await expect(page.getByTestId("unlock-condition")).toBeVisible();
    await shoot(page, SHOTS, "tool-locked", m.theme);
    await page.goto("/toolbox/tb.s");
    await page.getByRole("button", { name: "Replay the unlock moment" }).click();
    await expect(page.getByTestId("unlock-moment")).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/unlock-moment-${m.theme}-${m.width}x${m.height}.png` });
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
}
