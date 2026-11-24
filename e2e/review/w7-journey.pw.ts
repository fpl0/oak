// Wave 7 review (review:journey): the advanced tracks as the learner meets them, each test from its own dev seed,
// each a regression test for a defect this review found and fixed (the grading itself is pinned in bun tests:
// app/src/lesson/review-w7.test.ts):
//  - R3.L02 S2, a son clave tapped 2-3 where 3-2 plays, five times running: the verdict says which way round it was
//    tapped, alone; it said "All 2 of your pushes landed on the beat" (there are no pushes) under sixteen per-tap
//    lines (app/src/lesson/grading.ts `claveAsked`, `claveFirst`, wiring @oak/pitch `gradeClaveTaps`);
//  - R2.L04 S2, the 3 against 2 tapped one hand at a time: one line names the silent hand in words; it came under
//    twelve "No tap for note n of the rhythm" lines and the whole lane label (`laneFirst`, `laneName`);
//  - J3.L01 S3, the rootless voicing built on the keyboard: the keys picked survive a reload (they came back empty:
//    app/src/lesson/drafts.ts now keeps keyboard, grouping, euclid and slot-choice answers), and the B voicing
//    answered five times for the A leaves an honest way forward (the hint ladder and "Show the answer");
//  - the last session of the course begun at 03:50 and released after the 04:00 rollover: the Coda opens on the
//    course finale, before the release card and the sketch (it sat third, below the fold); Today is "complete"
//    and the day after is an ordinary day;
//  - Claude's note on Today: its music tokens were printed raw ("[[deg:4]] in [[bars:3]]", Glance.tsx
//    `TutorNoteCard`). Today no longer shows Claude's note at all (owner, 2026-11-22, main e890415), so the test
//    now pins that a stored note stays off Today; music tokens still render as chips where Claude's words do
//    appear, the tutor panel (app/src/tutor/e2e/wave3.pw.ts, wave6.pw.ts) and its parser (markdown.test.ts);
//  - J2.L04 opened by URL without U14.CP and a locked track capstone opened by URL each say what holds them.
import { DatabaseSync } from "node:sqlite";
import { expect, type Page, test } from "@playwright/test";
import { AC2_BALLAD } from "../../app/src/capstone/e2e/w7-pieces.ts";
import { doneForToday, setCapstoneCode } from "../journey/w4-day.ts";
import { capstoneDay, checkAllMet, intoWorkspace, releaseToCoda } from "../journey/w7-support.ts";
import { useUiPrefs } from "../support/ui.ts";
import { stack } from "./playwright.config.ts";
import { advanceMinutes, api, clockTo, resetClock, shootAll, snap, watch } from "./support.ts";
import { quietHmr, seedPoint, step, tryAgainIfShown } from "./w4-support.ts";
import { feedback, verdict } from "./w5-support.ts";

test.use({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });

type Dev = { submit(r: unknown): Promise<{ status: string } | null> };
const submit = (page: Page, r: unknown) =>
  page.evaluate((x) => (globalThis as unknown as { __oakLesson: Dev }).__oakLesson.submit(x), r);

async function open(page: Page, lessonId: string, stepId: string): Promise<void> {
  await quietHmr(page);
  await page.goto(`/learn/${lessonId}?step=${stepId}`);
  await expect(step(page)).toHaveAttribute("data-step", stepId, { timeout: 60_000 });
  await page.waitForFunction(() => !!(globalThis as { __oakLesson?: unknown }).__oakLesson);
}

test("R3.L02 S2: a 2-3 clave tapped for 3-2 five times is said as that, and never as pushes", async ({
  page,
  request,
}) => {
  await seedPoint(request, "R3.L02 next");
  const problems = watch(page);
  await open(page, "R3.L02", "S2");
  // 104 BPM: an eighth is 30/104 s. Son 2-3 over four bars (the groove plays 3-2).
  const eighth = 30 / 104;
  const twoThree = [2, 4, 8, 11, 14, 18, 20, 24, 27, 30];
  for (let i = 0; i < 5; i++) {
    const r = await submit(page, { taps: twoThree.map((e) => e * eighth + (i % 2 ? 0.012 : -0.01)) });
    expect(r?.status).toBe("fail");
    await expect(feedback(page)).toHaveAttribute("data-status", "fail");
  }
  const said = await verdict(page);
  expect(said).toContain("Not in time yet. Listen, then tap along again.");
  expect(said).toContain("You tapped the clave 2-3, starting from its two side.");
  expect(said).not.toMatch(/push|one too many|went by without a tap/i);
  // A practice step: Skip is always the way on.
  await expect(page.getByTestId("continue")).toHaveText(/Skip/);
  await expect(page.getByTestId("continue")).toBeEnabled();
  await snap(page, "w7-rj-clave-direction");
  expect(problems).toEqual([]);
});

test("R2.L04 S2: the 3 against 2 tapped one hand at a time names the silent hand once, in words", async ({
  page,
  request,
}) => {
  await seedPoint(request, "R2.L04 next");
  const problems = watch(page);
  await open(page, "R2.L04", "S2");
  const bar = (4 * 60) / 66;
  const at = (places: number[]) => [0, 1, 2, 3].flatMap((b) => places.map((x) => (b + x) * bar));
  expect((await submit(page, { lanes: [at([0, 1 / 2]), []] }))?.status).toBe("fail");
  expect(await verdict(page)).toBe(
    "Not in time yet. Listen, then tap along again.No taps on J: that hand plays the three while the other plays the two.",
  );
  expect((await submit(page, { lanes: [[], at([0, 1 / 3, 2 / 3])] }))?.status).toBe("fail");
  expect(await verdict(page)).toBe(
    "Not in time yet. Listen, then tap along again.No taps on F: that hand plays the two while the other plays the three.",
  );
  expect(problems).toEqual([]);
});

test("J3.L01 S3: the keys picked survive a reload; the B voicing five times leaves the hints and the answer", async ({
  page,
  request,
}) => {
  await seedPoint(request, "after J2.L04");
  const problems = watch(page);
  await open(page, "J3.L01", "S3");
  const s = step(page);
  const picked = page.getByText(/^Picked:/).locator("..");
  for (const m of [57, 60, 64]) await s.locator(`[data-midi="${m}"]`).click();
  await expect(picked).toContainText("A3C4E4");
  await page.reload();
  await expect(s).toHaveAttribute("data-step", "S3", { timeout: 60_000 });
  await expect(picked).toContainText("A3C4E4");
  // The B voicing (E G A C) where the A (A C E G) is asked, five times.
  const down = s.locator('[data-midi][aria-pressed="true"]');
  for (let i = 0; i < 5; i++) {
    // After each verdict the answer is changed through Try again (docs/design/retry.md §2.5).
    await tryAgainIfShown(page);
    const clear = s.getByRole("button", { name: "Clear", exact: true });
    if ((await down.count()) > 0) await clear.click();
    await expect(down).toHaveCount(0);
    for (const m of [52, 55, 57, 60]) await s.locator(`[data-midi="${m}"]`).click();
    await expect(down).toHaveCount(4);
    await expect(page.getByTestId("check")).toBeEnabled();
    await page.getByTestId("check").click();
    await expect(feedback(page)).toHaveAttribute("data-status", "fail", { timeout: 30_000 });
  }
  await expect(page.getByTestId("reveal-button")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Hint/ })).toBeVisible();
  // The hint ladder's second rung says what kind of mistake it is, in words (it said only "bass"), never the notes.
  await page.getByRole("button", { name: /^Hint/ }).click();
  await page.getByRole("button", { name: /^Hint/ }).click();
  await tryAgainIfShown(page);
  await page.getByTestId("check").click();
  await expect(feedback(page)).toContainText("The lowest note is not the one this chord stands on.", {
    timeout: 30_000,
  });
  await expect(feedback(page)).not.toContainText(/\b[A-G][#b]?\d\b/);
  await page.getByTestId("reveal-button").click();
  await expect(page.getByTestId("continue")).toBeEnabled({ timeout: 30_000 });
  expect(problems).toEqual([]);
});

test("the last session of the course across the 04:00 rollover: the finale first; Today complete; the day after", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await clockTo(request, "2026-11-12T03:20:00Z");
  await seedPoint(request, "after AC2.S2");
  await clockTo(request, "2026-11-12T03:50:00Z");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  const problems = watch(page);
  await capstoneDay(page, /Neo-Soul Ballad · session 3 of 3/, "AC2.S3");
  await intoWorkspace(page, 3, 3);
  await setCapstoneCode(page, "AC2", AC2_BALLAD);
  await checkAllMet(page);
  await advanceMinutes(request, 25);
  await releaseToCoda(page, "Slow Light", "Ninths and elevenths by hand, the snare a breath behind.");
  const finale = page.getByTestId("coda-course-finale");
  await expect(finale).toBeVisible({ timeout: 30_000 });
  // Before anything else: the finale comes before the release card and the saved sketch, on the first screen.
  await expect(page.getByTestId("coda-release")).toBeVisible({ timeout: 30_000 });
  const order = await page.evaluate(() => {
    const ids = ["coda-course-finale", "coda-release"];
    const els = ids.map((id) => document.querySelector(`[data-testid="${id}"]`));
    return els[0] && els[1] ? els[0].compareDocumentPosition(els[1]) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
  });
  expect(order, "the finale precedes the release card").toBeGreaterThan(0);
  const box = await page.getByTestId("course-finale-heading").boundingBox();
  expect(box !== null && box.y + box.height <= 800, "the finale's heading is on the first screen").toBe(true);
  await snap(page, "w7-rj-course-finale-0350");
  await doneForToday(page);
  // Still the learner day it began on (it began before 04:00): Today says it is complete, no new setlist.
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
  // The next learner day: an ordinary day; what stays open is named.
  await clockTo(request, "2026-11-13T04:10:00Z");
  await page.reload();
  await expect(page.getByTestId("course-first-day")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("start-session")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/track you chose|still being written|\[\[/);
  const whole = await api<{ stage: string; sessionsDone: number }>(request, "GET", "/api/course/whole");
  expect(whole).toMatchObject({ stage: "complete", sessionsDone: 259 });
  expect(problems).toEqual([]);
  await resetClock(request);
});

test("Today shows no note from Claude, even with one stored, and never raw markup", async ({
  page,
  request,
}) => {
  await resetClock(request);
  await seedPoint(request, "whole course complete");
  const db = new DatabaseSync(`${process.env.OAK_REVIEW_DATA_DIR ?? stack.dataDir}/oak.db`);
  try {
    db.prepare(
      "INSERT INTO tutor_notes (id, day, subject_kind, subject_id, source, text, at) VALUES (?, ?, 'general', 'today', 'observation', ?, ?)",
    ).run(
      "note-review-w7",
      "2026-11-14",
      "The bass holds [[deg:1]] for two bars and then steps up to [[deg:4]] in [[bars:3]].",
      new Date(Date.now() + 60_000).toISOString(),
    );
  } finally {
    db.close();
  }
  await quietHmr(page);
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const problems = watch(page);
  await page.goto("/");
  // Today has loaded once its card has (the glance column renders with it); the stored note is not on it.
  await expect(page.getByTestId("today-card")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("album-strip")).toBeVisible();
  await expect(page.getByTestId("tutor-note")).toHaveCount(0);
  const main = page.locator("main");
  await expect(main).not.toContainText("The bass holds");
  await expect(main).not.toContainText("[[");
  await shootAll(page, "w7-rj-today-note");
  expect(problems).toEqual([]);
});

test("J2.L04 without U14.CP and a locked track capstone, each opened by URL, say what holds them", async ({
  page,
  request,
}) => {
  await resetClock(request);
  await seedPoint(request, "J2.L04 locked (U14.CP not passed)");
  await quietHmr(page);
  const problems = watch(page);
  await page.goto("/learn/J2.L04");
  const main = page.locator("main");
  await expect(main).toContainText("This lesson isn't open yet", { timeout: 60_000 });
  await expect(main).toContainText("The track goes on without it");
  await expect(page.getByRole("link", { name: "Back to Today" })).toBeVisible();
  await page.goto("/capstone/JC1");
  await expect(main).toContainText("Not open yet", { timeout: 60_000 });
  await expect(main).toContainText("A capstone never holds back a lesson");
  await expect(main).not.toContainText(/failed|behind/i);
  expect(problems).toEqual([]);
});
