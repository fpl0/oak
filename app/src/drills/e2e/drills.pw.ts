// The drill runner against the real Oak server (own stack, throwaway data): the Practice hub's stages and
// states, keyboard-only free practice, a full warm-up with a tap set and a sing set on Chromium's fake mic,
// resume after a reload, the trial rows the server stored, and screenshots in both themes at both sizes.
//
// A fresh data dir has no lessons completed (and U00 is still being written), so nothing is due and nothing is
// unlocked. Two GETs are stubbed to stand in for a learner a few lessons in: `/api/lessons/progress` (which
// lessons are completed) and `/api/srs/due` (the planned warm-up). Everything the runner writes — drill
// sessions, trial records, finishing the set — goes to the real server and is read back from it.
import { fileURLToPath } from "node:url";
import { expect, type Page, type Route, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const today = new Date().toISOString().slice(0, 10);

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    // `voice.get` answers a typed 501 until the server builds it; the runner falls back to the profile.
    if (m.type() === "error" && !/status of 501/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/** Marks lessons completed in `/api/lessons/progress` (the rest of the response is the server's own). */
async function completeLessons(page: Page, ids: string[]): Promise<void> {
  await page.route("**/api/lessons/progress", async (route: Route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { lessons: { lessonId: string; status: string }[] };
    for (const l of body.lessons) if (ids.includes(l.lessonId)) l.status = "completed";
    await route.fulfill({ response: res, json: body });
  });
}

const item = (i: number, familyId: string, trials: number, mic: boolean, kind = "family-set") => ({
  id: `${today}:w:${i}`,
  kind,
  familyId,
  members: [],
  cardIds: [familyId],
  level: 1,
  trials,
  estSec: trials * 8,
  mic,
  rated: kind !== "anchor",
});

/** A planned warm-up: a tap set (the pulse) then a sing set (pitch match). */
async function planWarmup(page: Page): Promise<void> {
  // A fresh learner has no microphone set up, which is Quiet mode on the server (wave3.md §5.3): this warm-up
  // sings, so the learner has a built-in mic (Chromium's fake one).
  const res = await page.request.put(`${stack.apiURL}/api/profile`, {
    headers: { "X-Oak": "1", Origin: stack.baseURL, "Content-Type": "application/json" },
    data: { inputKind: "builtin" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  await page.route(/\/api\/srs\/due(\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        budgetSec: 300,
        plannedSec: 80,
        items: [item(0, "fam.rhy.pulse", 4, false), item(1, "fam.pit.match", 5, true)],
        label: "Today's review ≈ 2 min",
        moreAvailable: false,
      },
    }),
  );
}

async function familyState(page: Page, familyId: string) {
  const res = await page.request.get(`${stack.apiURL}/api/drills/difficulty/${familyId}`, {
    headers: { "X-Oak": "1", Origin: stack.baseURL },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    level: number;
    categoryStats: Record<string, { n: number; hits: number }>;
  };
}
const trialsOf = (s: { categoryStats: Record<string, { n: number }> }) =>
  Object.values(s.categoryStats).reduce((a, c) => a + c.n, 0);

async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe.configure({ mode: "serial" });

// Other engineers' edits must not reload the page mid-test (wave3.md §8): Vite's HMR socket is blocked.
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

test("the hub groups families by stage, with locked, later and open states", async ({ page }) => {
  const problems = watch(page);
  await completeLessons(page, ["U00.L01", "U00.L02", "U01.L01", "U02.L01"]);
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/practice");
  await expect(page.getByRole("heading", { level: 1, name: "Practice" })).toBeVisible();
  const stageA = page.getByTestId("stage-A");
  await expect(stageA.getByRole("heading", { name: /Stage A/ })).toBeVisible();
  // Open: completed lessons open their families.
  await expect(page.locator('[data-family="fam.pit.compare"]')).toHaveAttribute("data-status", "unlocked");
  await expect(page.locator('[data-family="fam.rhy.pulse"]')).toHaveAttribute("data-status", "unlocked");
  // Locked: later lessons.
  const tonic = page.locator('[data-family="fam.deg.tonic"]');
  await expect(tonic).toHaveAttribute("data-status", "locked");
  await expect(tonic).toContainText("Unlocks in U03");
  // Every generator is built now (Wave 2): a jazz-track family is simply locked until its track opens. The
  // "pending" state ("Arrives with J5") is covered by model.test.ts.
  const subs = page.locator('[data-family="fam.jzz.subs"]');
  await expect(subs).toHaveAttribute("data-status", "locked");
  // No raw due counts anywhere.
  await expect(page.locator("body")).not.toContainText(/\d+ due/);
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", m.theme);
    await expect(page.getByTestId("stage-A")).toBeVisible();
    await noHorizontalOverflow(page);
    await shoot(page, SHOTS, "hub", m.theme);
  }
  expect(problems).toEqual([]);
});

test("free practice runs a full set from the keyboard alone", async ({ page }) => {
  const problems = watch(page);
  await completeLessons(page, ["U02.L01"]);
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/practice/fam.pit.compare");
  const start = page.getByTestId("start-set");
  await expect(start).toBeFocused({ timeout: 30_000 });
  await shoot(page, SHOTS, "practice-setup", "paper");
  await page.keyboard.press("Enter");
  const runner = page.getByTestId("drill-runner");
  await expect(runner).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("trial-counter")).toHaveText("Trial 1 of 10");
  let shot = false;
  for (let i = 0; i < 10; i++) {
    await expect(page.getByTestId("trial-counter")).toHaveText(`Trial ${i + 1} of 10`);
    await expect(page.getByRole("group", { name: /Your answer/ })).toBeVisible();
    if (!shot) {
      await shoot(page, SHOTS, "trial-answering", "paper");
    }
    // Answer with a digit (1 higher, 2 lower, 3 same); the pad has focus.
    await page.keyboard.press(String((i % 3) + 1));
    await expect(page.getByTestId("trial-feedback")).toBeVisible();
    if (!shot) {
      await shoot(page, SHOTS, "trial-feedback", "paper");
      shot = true;
      // The shortcut sheet lists the drill keys that work here.
      await page.keyboard.press("?");
      const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
      await expect(sheet).toContainText("Hear it again");
      await expect(sheet).toContainText("Hear the answer");
      await expect(sheet).not.toContainText("Cadence again");
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await page.getByTestId("drill-runner").focus();
    }
    await page.keyboard.press("Enter");
  }
  const summary = page.getByTestId("set-summary");
  await expect(summary).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("summary-next")).toHaveText(/schedule stays as it is/);
  await shoot(page, SHOTS, "summary", "paper");
  const state = await familyState(page, "fam.pit.compare");
  expect(trialsOf(state)).toBe(10);
  // Between sets the tutor is open again: the confusion question goes to the fake tutor's panel.
  const ask = page.getByRole("button", { name: /Ask Claude: How do I hear/ });
  await expect(ask).toBeVisible();
  const question = ((await ask.textContent()) ?? "").replace("Ask Claude: ", "");
  await ask.click();
  await expect(page.getByRole("complementary").filter({ hasText: question }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Another set/ }).focus();
  // Another set starts from the keyboard too.
  await expect(page.getByRole("button", { name: /Another set/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText("Trial 1 of 10", { timeout: 60_000 });
  expect(problems).toEqual([]);
});

test("a warm-up runs a tap set and a sing set, writes its trials, and resumes after a reload", async ({
  page,
}) => {
  const problems = watch(page);
  await planWarmup(page);
  await useUiPrefs(page, { theme: "bark" });
  await page.goto("/practice/review");
  await expect(page.getByTestId("warmup-position")).toHaveText("Warm-up · 1 of 2");
  const counter = page.getByTestId("trial-counter");
  await expect(counter).toHaveText("Trial 1 of 4", { timeout: 60_000 });
  // The pulse: tap along on the beat while the pad is armed.
  for (let i = 0; i < 4; i++) {
    await expect(counter).toHaveText(`Trial ${i + 1} of 4`);
    await expect(page.getByTestId("stage-text")).toHaveText("Your turn: tap with Space.", {
      timeout: 15_000,
    });
    for (let k = 0; k < 6; k++) {
      await page.waitForTimeout(450);
      await page.keyboard.press("Space");
    }
    if (i === 0) await shoot(page, SHOTS, "tap-respond", "bark");
    await expect(page.getByTestId("trial-feedback")).toBeVisible({ timeout: 20_000 });
    // One feedback line, never a hidden duplicate.
    await expect(page.getByTestId("trial-feedback")).toHaveCount(1);
    if (i === 0) {
      await expect(page.getByTestId("tap-timeline")).toHaveAttribute("aria-label", /hits matched/);
      await shoot(page, SHOTS, "tap-feedback", "bark");
    }
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("set-summary")).toHaveCount(1);
  await page.keyboard.press("Enter");
  // Pitch match on the fake microphone: the Mic-live dot shows while it listens.
  await expect(page.getByTestId("warmup-position")).toHaveText("Warm-up · 2 of 2");
  await expect(counter).toHaveText("Trial 1 of 5", { timeout: 60_000 });
  for (let i = 0; i < 2; i++) {
    await expect(counter).toHaveText(`Trial ${i + 1} of 5`);
    // A sung trial waits for Start: nothing plays and the mic stays closed until then.
    await page.getByTestId("drill-start").click({ timeout: 15_000 });
    if (i === 0) {
      await expect(page.getByTestId("stage-text")).toHaveText(/sing now|Listen/, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Microphone is live. Close it" })).toBeVisible();
      await shoot(page, SHOTS, "sing", "bark");
    }
    await expect(page.getByTestId("trial-feedback")).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Enter");
  }
  await expect(counter).toHaveText("Trial 3 of 5");
  // Reload mid-set: the same set resumes at its next trial; the finished tap set is not offered again.
  await page.reload();
  await expect(page.getByTestId("warmup-position")).toHaveText("Warm-up · 1 of 1", { timeout: 30_000 });
  await expect(counter).toHaveText("Trial 3 of 5", { timeout: 60_000 });
  for (let i = 2; i < 5; i++) {
    await expect(counter).toHaveText(`Trial ${i + 1} of 5`);
    await page.getByTestId("drill-start").click({ timeout: 15_000 });
    // Shift+S skips one sung part: logged, no penalty.
    if (i === 3) {
      await expect(page.getByTestId("stage-text")).toHaveText(/sing now|Listen/, { timeout: 15_000 });
      await page.keyboard.press("Shift+S");
      await expect(page.getByTestId("trial-feedback")).toContainText("Skipped");
    }
    await expect(page.getByTestId("trial-feedback")).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("set-summary")).toContainText("1 skipped, no penalty");
  await shoot(page, SHOTS, "warmup-summary", "bark");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("review-done")).toBeVisible();
  await shoot(page, SHOTS, "review-done", "bark");

  // The server stored every trial exactly once: 4 taps, 5 pitch matches (the skipped one is kept as skipped
  // and left out of the statistics).
  expect(trialsOf(await familyState(page, "fam.rhy.pulse"))).toBe(4);
  expect(trialsOf(await familyState(page, "fam.pit.match"))).toBe(4);
  expect(problems.filter((p) => !/favicon/.test(p))).toEqual([]);
});

test("the trial frame fits at both sizes in both themes, and a practice set resumes where it was left", async ({
  page,
}) => {
  await completeLessons(page, ["U02.L01"]);
  for (const [i, m] of SCREENSHOT_MATRIX.entries()) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme, motion: "off" });
    await page.goto("/practice/fam.pit.compare");
    // The first visit starts a set; every later visit resumes it at its next trial.
    if (i === 0) await page.getByTestId("start-set").click({ timeout: 30_000 });
    await expect(page.getByTestId("trial-counter")).toHaveText(`Trial ${i + 1} of 10`, { timeout: 60_000 });
    await page.keyboard.press("2");
    const next = page.getByTestId("next-trial");
    await expect(next).toBeVisible();
    await expect(next).toBeInViewport();
    await noHorizontalOverflow(page);
    await shoot(page, SHOTS, "trial-frame", m.theme);
    // Escape leaves focus mode for Today; the place is kept.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(`${stack.baseURL}/`);
  }
});

test("each Stage A and reading family opens on a playable first trial", async ({ page }) => {
  const problems = watch(page);
  await completeLessons(page, ["U01.L04", "U01.L05", "U02.L02", "U02.L08", "U03.L01"]);
  await useUiPrefs(page, { theme: "paper" });
  const cases: [string, (p: Page) => Promise<void>][] = [
    [
      "fam.rhy.echo",
      async (p) => {
        await expect(p.getByTestId("tap-timeline")).toBeVisible();
        await expect(p.getByTestId("stage-text")).toHaveText(/Count-in|Listening|Your turn/, {
          timeout: 15_000,
        });
      },
    ],
    [
      "fam.rhy.read",
      async (p) => {
        await expect(p.getByTestId("trial-staff").locator("svg")).toBeVisible({ timeout: 15_000 });
        await expect(p.getByTestId("tap-timeline")).toBeVisible();
      },
    ],
    [
      "fam.deg.tonic",
      async (p) => {
        await expect(p.getByRole("group", { name: /Your answer/ })).toBeVisible();
      },
    ],
    [
      "fam.not.read",
      async (p) => {
        await expect(p.getByTestId("trial-staff").locator("svg")).toBeVisible({ timeout: 15_000 });
      },
    ],
    [
      "fam.pit.keyboard",
      async (p) => {
        await expect(p.getByTestId("key-highlight")).toBeVisible();
      },
    ],
  ];
  for (const [familyId, check] of cases) {
    await page.goto(`/practice/${familyId}`);
    await page.getByTestId("start-set").click({ timeout: 30_000 });
    await expect(page.getByTestId("trial-counter")).toHaveText(/Trial 1 of \d+/, { timeout: 60_000 });
    await check(page);
    await shoot(page, SHOTS, `first-${familyId.replace(/^fam\./, "")}`, "paper");
    // Escape inside a code editor stays in the editor; from the frame it leaves focus mode.
    await page.getByTestId("drill-runner").focus();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(`${stack.baseURL}/`);
  }
  expect(problems).toEqual([]);
});
