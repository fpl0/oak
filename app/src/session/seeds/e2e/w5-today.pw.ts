// Wave 5 Today on the real planner, each day from a dev seed (wave5.md §6): the optional side lesson offered in one
// calm line beside the core session (never in its place, never a debt; keyboard and Quiet mode), "one more, if you
// like" once the session is over (Today and the Coda), U11.CP offered while U12.L01 is unwritten, the end of the
// written course moved to after X2, and five days of U08–U11 read as the learner would, with what each lesson is for
// and the next unlock on the first screen. Nothing is filled or patched: every Wave 5 field (`SessionPlan.sideLesson`,
// `GET /side-lessons`) is the server's own, and every seed point must exist.
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { api, blockHmr, expectNoOverflow, matrix, SHOTS, seed, settle } from "./support.ts";
import {
  openToday,
  sessionPage,
  sessionState,
  skipWarmup,
  startByEnter,
  toCoda,
  watch,
} from "./w5-helpers.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

/** The day the side lesson is first offered (wave5.md §6 "side lesson offered"): U03.L03 with A1.L01 beside it. */
async function sideDay(request: APIRequestContext): Promise<void> {
  const s = await seed(request, "side lesson offered");
  expect(s.next).toBe("U03.L03");
  const plan = await api<{ sideLesson: { lessonId: string; placement: string; note: string } | null }>(
    request,
    "GET",
    "/api/session/today",
  );
  expect(plan.sideLesson).toMatchObject({ lessonId: "A1.L01", placement: "alternative" });
  expect(plan.sideLesson?.note).toMatch(/^Optional side lesson, about \d+ minutes: Waves & Harmonics\./);
}

test("the side lesson is offered in one calm line beside the core lesson; Enter still starts the core (Quiet mode)", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watch(page);
  await sideDay(request);
  await api(request, "PUT", "/api/voice/quiet", { quiet: true, scope: "today" });
  await useUiPrefs(page, { theme: "paper" });
  const open = async (p: Page) => {
    await openToday(p);
    await expect(p.getByTestId("side-offer")).toBeVisible({ timeout: 20_000 });
  };
  await open(page);
  const card = page.getByTestId("today-card");
  await expect(card).toHaveAttribute("data-state", "normal");
  const offer = page.getByTestId("side-offer");
  await expect(offer).toHaveAttribute("data-placement", "alternative");
  await expect(offer).toHaveAttribute("data-lesson", "A1.L01");
  await expect(page.getByTestId("side-offer-line")).toHaveText(
    /^Optional: hear why one bass sounds bigger than another — Waves & Harmonics, about \d+ minutes$/,
  );
  // What it does for the learner's loop is the server's own line (`SideLessonState.offer`), one source.
  const list = await api<{ items: { lessonId: string; offer?: string }[] }>(
    request,
    "GET",
    "/api/side-lessons",
  );
  const serverOffer = list.items.find((i) => i.lessonId === "A1.L01")?.offer;
  expect(serverOffer).toBeTruthy();
  await expect(page.getByTestId("side-offer").locator("p")).toHaveAttribute("title", serverOffer as string);
  // The core session stays the one decision: the New row is U03.L03 and the primary button starts it.
  const newRow = page.getByTestId("setlist").locator('[data-row="new"]');
  await expect(newRow).not.toContainText("Waves");
  await expect(page.getByTestId("start-session")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/required|behind|side lessons left|overdue/i);
  // The side lesson is not listed twice (its own line, not another "other way").
  await expect(page.getByTestId("other-ways")).not.toContainText("Waves");
  // Keyboard: the offer's button is reachable with Tab and shows a focus ring.
  await page.locator("main").focus();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.getByTestId("side-offer-start").evaluate((el) => el === document.activeElement)) break;
  }
  await expect(page.getByTestId("side-offer-start")).toBeFocused();
  const ring = await page
    .getByTestId("side-offer-start")
    .evaluate(
      (el) => getComputedStyle(el).outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none",
    );
  expect(ring).toBe(true);
  await settle(page);
  await shoot(page, SHOTS, "w5-today-side-focus", "paper");
  await matrix(page, "w5-today-side", open);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper" });
  await open(page);
  await startByEnter(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "lesson" });
  expect((await sessionState(page)).plan?.mapItemId).not.toBe("A1.L01");
  expect(errors).toEqual([]);
});

test("taking the side lesson starts a normal lesson session on A1.L01 (keyboard)", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watch(page);
  await sideDay(request);
  await useUiPrefs(page, { theme: "bark" });
  await openToday(page);
  await page.getByTestId("side-offer-start").focus();
  await page.keyboard.press("Enter");
  await sessionPage(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "lesson", mapItemId: "A1.L01" });
  const day = await api<{ open: { mapItemId: string; kind: string } | null }>(
    request,
    "GET",
    "/api/session/day",
  );
  expect(day.open).toMatchObject({ kind: "lesson", mapItemId: "A1.L01" });
  // Beside today's session it keeps today's warm-up (§7.4); then the side lesson itself opens.
  await skipWarmup(page);
  await expect(page.locator("main")).toContainText("Waves & Harmonics", { timeout: 60_000 });
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-session-side", "bark");
  expect(errors).toEqual([]);
});

test("after the core session: 'One more, if you like' in the Coda and on Today, with no second warm-up", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page);
  await sideDay(request);
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openToday(page);
  await startByEnter(page);
  await skipWarmup(page);
  await toCoda(page);
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("coda-title")).toBeVisible({ timeout: 30_000 });
  const next = page.getByTestId("coda-next");
  await expect(next.getByTestId("side-offer")).toHaveAttribute("data-placement", "after-core", {
    timeout: 20_000,
  });
  await expect(next).toContainText("One more, if you like.");
  // The Coda still ends on "Done for today": the offer is not its primary action.
  await expect(page.getByTestId("done-for-today")).toBeFocused();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-coda-side", "paper");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done", { timeout: 30_000 });
  const done = page.getByTestId("today-done");
  await expect(done.getByTestId("side-offer")).toHaveAttribute("data-placement", "after-core");
  await matrix(page, "w5-today-done-side", async (p) => {
    await openToday(p);
    await expect(p.getByTestId("today-done").getByTestId("side-offer")).toBeVisible();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openToday(page);
  await page.getByTestId("today-done").getByTestId("side-offer-start").click();
  await sessionPage(page);
  const s = await sessionState(page);
  expect(s.plan).toMatchObject({ kind: "lesson", mapItemId: "A1.L01" });
  expect(s.plan?.warmup.items).toEqual([]);
  expect(errors).toEqual([]);
});

test("U11.CP is offered while U12.L01, before it in the default order, is not written yet", async ({
  page,
  request,
}) => {
  await seed(request, "U11.CP due");
  const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "checkpoint", mapItemId: "U11.CP" });
  await useUiPrefs(page, { theme: "paper" });
  await openToday(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "checkpoint");
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText("Blues checkpoint");
  await expect(page.getByTestId("side-offer")).toHaveCount(0);
  await page.goto("/oak?view=tree");
  await expect(page.getByTestId("whats-next")).toContainText("U11.CP");
  await expect(page.getByTestId("whats-next")).not.toContainText("still being written");
});

test("past X2: the edge of what's written — a review day with Studio and the gym, never a dead end", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watch(page);
  await seed(request, "X2 released");
  const plan = await api<{ kind: string; mapItemId: string | null }>(request, "GET", "/api/session/today");
  // Wave 6 writes U12–U17: the day after X2 is a lesson again, and the core has no unwritten edge left. Today after
  // the core (never an edge, never empty) is w6-today.pw.ts "the day after the ending".
  test.skip(
    plan.kind !== "review",
    "U12 is written now: no edge of the written course before the end of the core",
  );
  expect(plan.kind).toBe("review");
  await useUiPrefs(page, { theme: "paper" });
  const open = async (p: Page) => {
    await openToday(p);
    await expect(p.getByTestId("today-card")).toHaveAttribute("data-state", "edge");
  };
  await open(page);
  const card = page.getByTestId("today-card");
  await expect(card.getByRole("heading", { name: "The edge of what's written" })).toBeVisible();
  await expect(card).toContainText("Seventh Chords");
  await expect(card).toContainText("Studio and the Transcription Gym are yours");
  await expect(page.getByTestId("start-session")).toBeVisible();
  await expect(page.getByTestId("other-ways").getByTestId("extra-gym")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/behind|failed|lost|error/i);
  await expect(page.getByTestId("album-strip")).toContainText("X2");
  await matrix(page, "w5-today-edge-x2", open);
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/progress");
  await expect(page.getByTestId("progress-edge")).toContainText("Seventh Chords");
  await openToday(page);
  await startByEnter(page);
  await skipWarmup(page);
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("coda-tomorrow")).toContainText("review day");
  expect(errors).toEqual([]);
});

// RETURN: five days of U08–U11 read as the learner, from Today to the Coda (the wave5.md §6 points). Today's first
// screen names the lesson and what it is for, with the next unlock beside it; the Coda says what is next and what it
// is for, and the next unlock. Nothing reads as a debt.
const RETURN_DAYS = [
  { point: "after GYM.04", item: "U08.L05" },
  { point: "after U09.L01", item: "U09.L02" },
  { point: "after U10.L02", item: "U10.L03" },
  { point: "after U11.L03", item: "U11.L04" },
  { point: "after U11.L06", item: "U11.L07" },
] as const;
for (const d of RETURN_DAYS)
  test(`return: the day ${d.item} is next reads as worth opening, from Today to the Coda`, async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const errors = watch(page);
    await seed(request, d.point);
    const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
    expect(plan).toMatchObject({ kind: "lesson", mapItemId: d.item });
    await useUiPrefs(page, { theme: "paper" });
    const open = async (p: Page) => {
      await openToday(p);
      await expect(p.getByTestId("setlist").locator('[data-row="new"]')).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("setlist-sub")).toBeVisible({ timeout: 20_000 });
    };
    await open(page);
    await expect(page.getByTestId("next-unlock")).toBeVisible();
    await expect(page.getByTestId("next-unlock").getByTestId("goal-gradient")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("start-session")).toBeInViewport();
    await expect(page.locator("main")).not.toContainText(/behind|overdue|you lost|failed/i);
    await matrix(page, `w5-return-${d.item}`, open);
    await page.setViewportSize({ width: 1440, height: 900 });
    await useUiPrefs(page, { theme: "paper", motion: "off" });
    await open(page);
    await startByEnter(page);
    await skipWarmup(page);
    await toCoda(page);
    await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
    const next = page.getByTestId("coda-next");
    await expect(next).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("coda-tomorrow")).toContainText("Next time:");
    await expect(page.getByTestId("coda-next-unlock")).toContainText("Next unlock:");
    await settle(page);
    await expectNoOverflow(page);
    await shoot(page, SHOTS, `w5-return-coda-${d.item}`, "paper");
    expect(errors).toEqual([]);
  });
