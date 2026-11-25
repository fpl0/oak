// Wave 4 review (review:journey), breaking it on purpose. Defects found and fixed:
//  - a reload in the middle of a staged chord dictation (U06.L09 S2) threw away the stages already found: the
//    learner had to take the bass down again. The found stages and their answers now survive a reload of the tab
//    (they are not attempts: nothing is graded or saved by it);
//  - the degree pad of that bass stage offers 1–6 but its key hint said "1–7";
//  - at 1280×720 a step with the roll and the grand staff (U06.L11 "Watch the bass on the lower staff") opened on
//    the Roll tab, the staff hidden; it now opens on Both.
// And, with no defect: a gym session that crosses the 04:00 day boundary belongs to the day it began.
import { expect, type Page, test } from "@playwright/test";
import { useUiPrefs } from "../support/ui.ts";
import { api, clockTo, resetClock, shootAll, watch } from "./support.ts";
import { openStep, quietHmr, seedPoint, step } from "./w4-support.ts";

test.afterEach(async ({ request }) => {
  await resetClock(request);
});

const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    "no sideways scroll",
  ).toBeLessThanOrEqual(0);

test("staged dictation in a lesson: a reload keeps the bass already found", async ({ page, request }) => {
  test.setTimeout(200_000);
  await resetClock(request);
  await seedPoint(request, "after U06.L08");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  await openStep(page, "U06.L09", "S2");
  const staged = page.getByTestId("staged");
  // The pad answers 1 to 6 here, and its hint says so.
  await expect(staged.locator("[data-degree]")).toHaveCount(6);
  await expect(staged).toContainText("1–6");
  await staged.locator("[data-degree]").first().focus();
  for (const d of ["1", "3", "6", "4"]) await page.keyboard.press(d);
  await page.getByTestId("check-stage").click();
  await expect(page.getByTestId("check-stage")).toHaveText("Check the quality", { timeout: 30_000 });
  await page.reload();
  await expect(step(page)).toHaveAttribute("data-step", "S2", { timeout: 60_000 });
  // Back where the learner was: the bass found (with its answer), the quality open.
  await expect(page.getByTestId("check-stage")).toHaveText("Check the quality", { timeout: 30_000 });
  await expect(staged).toContainText(/Your answer:\s*1, 3, 6, 4/);
  await shootAll(page, "w4-break-staged-reload");
  // Then the rest, to the step's pass: the qualities, then the numerals.
  await staged.locator('[data-stage="quality"] [data-option]').first().focus();
  for (const q of ["1", "2", "2", "1"]) await page.keyboard.press(q);
  await page.getByTestId("check-stage").click();
  await expect(page.getByTestId("check-stage")).toHaveText("Check the numerals", { timeout: 30_000 });
  await staged.locator('[data-stage="rn"] [data-rn-slot]').first().focus();
  for (const d of ["1", "3", "6", "4"]) await page.keyboard.press(d);
  await page.getByTestId("check-stage").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass", { timeout: 30_000 });
  expect(problems).toEqual([]);
});

test("grand staff and chord lenses at 1280×720: the staff in view, the actions on screen", async ({
  page,
  request,
}) => {
  test.setTimeout(200_000);
  await resetClock(request);
  await seedPoint(request, "after U06.L10");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "bark" });
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watch(page);
  for (const s of ["S1", "S3", "S5", "S8"]) {
    await openStep(page, "U06.L11", s);
    await noOverflow(page);
    const primary = page.getByTestId(s === "S8" ? "save-sketch" : "continue");
    const box = await primary.boundingBox();
    expect(box !== null && box.y + box.height <= 720, `${s}: the step's action is on screen`).toBe(true);
    if (s === "S3" || s === "S8") {
      // Roll and grand staff tabbed by the height rule: the step opens on Both, so the lower staff is in view.
      await expect(page.getByTestId("tab-both")).toHaveAttribute("aria-selected", "true", {
        timeout: 30_000,
      });
      await expect(page.locator(".oak-wb-views svg").first()).toBeVisible({ timeout: 30_000 });
    }
    await page.screenshot({
      path: `${import.meta.dirname}/screenshots/w4-break-grand-${s}-bark-1280x720.png`,
      animations: "disabled",
    });
  }
  expect(problems).toEqual([]);
});

test("a gym session across 04:00 belongs to the day it began", async ({ page, request }) => {
  test.setTimeout(200_000);
  await clockTo(request, "2026-11-12T03:30:00Z");
  await seedPoint(request, "after U07.L03 (gym due)");
  await clockTo(request, "2026-11-12T03:45:00Z");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  const plan = await api<{ kind: string; mapItemId: string; day: string }>(
    request,
    "GET",
    "/api/session/today",
  );
  expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.01", day: "2026-11-11" });
  await page.goto("/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "gym", { timeout: 60_000 });
  await page.getByTestId("start-session").click();
  await page.waitForURL(/\/session\/?$/);
  await expect(page.getByTestId("session-header")).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => {
    type H = { report(r: unknown): void; state(): { plan: { warmup: { items: { id: string }[] } } | null } };
    const o = (window as never as { __oakSession: H }).__oakSession;
    for (const item of o.state().plan?.warmup.items ?? [])
      o.report({
        block: "warmup",
        source: "drills",
        warmupItemId: item.id,
        drillSessionId: null,
        meanCredit: null,
        skipped: true,
      });
  });
  await expect(page.getByTestId("gym-block")).toHaveAttribute("data-gym", "GYM.01", { timeout: 60_000 });
  await expect(page.getByTestId("check")).toBeEnabled({ timeout: 60_000 });
  // 04:10: a new learner day has begun while the gym session is open.
  await clockTo(request, "2026-11-12T04:10:00Z");
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText('setcpm(90/4)\n\ndrums: s("bd sd")\n');
  await page.getByTestId("check").click();
  await expect(page.getByTestId("verdict")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("gym-finish").click();
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await page.getByTestId("done-for-today").click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  // The session counted for the day it began; Today is done, not a second setlist straight away.
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done", { timeout: 30_000 });
  const gym = await api<{ history: { gymId: string }[]; next: { gymId: string } | null }>(
    request,
    "GET",
    "/api/gym",
  );
  expect(gym.history.map((g) => g.gymId)).toEqual(["GYM.01"]);
  expect(gym.next?.gymId).toBe("GYM.02");
  // The next learner day is a lesson again: the gym slot was counted, never repeated. (Since Oak 2.0 W2 GYM.01 sits
  // after U07.L11 and before U07.L03 in the default order, so the lesson after it is U07.L03.)
  const next = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(next).toMatchObject({ kind: "lesson", mapItemId: "U07.L03" });
  expect(problems).toEqual([]);
});
