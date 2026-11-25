// Wave 7 Today on the real planner, each day from a dev seed (wave7.md §6): the choice between tracks once the core
// is complete — each open track offered beside an ordinary day, a pick remembered as the focus, never locked in; a
// track day with the focus on it (one primary action, the other tracks one row each); and the day after the whole
// course, an ordinary day with what stays open. `plan.trackOffers`, `plan.track`, `plan.focus`, `tracks.focus` and
// `course.whole` are the server's own.
import { DatabaseSync } from "node:sqlite";
import { expect, type Page, test } from "@playwright/test";
import { useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";
import { api, blockHmr, matrix, seed } from "./support.ts";
import { openToday, sessionPage, sessionState, startByEnter, watch } from "./w5-helpers.ts";
import { focus7, NEVER7, plan7 } from "./w7-helpers.ts";
import {
  answerChoice,
  countMic,
  nextTrial,
  startDay,
  toFamily,
  totalOf,
  trialNo,
  wire,
} from "./warmup-helpers.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

const offers = (page: Page) => page.getByTestId("track-offers");

test("after the core, no track chosen: an ordinary day, each open track offered beside it; a pick is remembered", async ({
  page,
  request,
}) => {
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "core complete, tracks untouched");
  const plan = await plan7(request);
  expect(plan).toMatchObject({ core: "complete", focus: "core" });
  expect(["review", "gym", "keepalive", "studio"]).toContain(plan.kind);
  expect(plan.trackOffers?.map((o) => o.trackId)).toEqual(["J", "R", "A"]);
  await useUiPrefs(page, { theme: "paper" });
  const open = async (p: Page) => {
    await openToday(p);
    await expect(offers(p)).toBeVisible({ timeout: 20_000 });
  };
  await open(page);
  // One primary action (the day's own session); each track is one quiet row with its next session and its place.
  await expect(page.getByTestId("start-session")).toHaveCount(1);
  for (const o of plan.trackOffers ?? []) {
    const row = offers(page).locator(`[data-offer="${o.trackId}"]`);
    await expect(row).toContainText(o.next.mapItemId ?? "no id");
    await expect(row).toContainText(`session ${o.sessionsDone + 1} of ${o.sessionsTotal}`);
  }
  await expect(offers(page).getByTestId("start-offer")).toHaveCount(3);
  await expect(offers(page).getByTestId("track-lead")).toContainText("Today remembers it");
  await expect(page.getByTestId("track-focus").getByRole("radio", { name: "No track" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // The tracks are not listed twice ("Open to you" keeps the gym, Studio and reviews).
  await expect(page.getByTestId("open-to-you").locator('[data-open="track"]')).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(NEVER7);
  await matrix(page, "w7-today-after-core", open);
  // Pick Rhythm: it starts today, and the focus records it for tomorrow.
  const r = plan.trackOffers?.find((o) => o.trackId === "R");
  await offers(page).locator('[data-offer="R"]').getByTestId("start-offer").click();
  await sessionPage(page);
  expect((await sessionState(page)).plan).toMatchObject({ mapItemId: r?.next.mapItemId });
  expect((await focus7(request)).focus).toBe("R");
  expect(errors).toEqual([]);
});

test("a track in focus: its next session is the day's; the core is done, the other tracks wait one row away; the switch changes it (keyboard)", async ({
  page,
  request,
}) => {
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "two tracks in progress");
  const plan = await plan7(request);
  expect(plan).toMatchObject({ kind: "lesson", mapItemId: "J1.L04", focus: "J" });
  expect(plan.track).toMatchObject({ trackId: "J", sessionIndex: 4, sessionsTotal: 35 });
  await useUiPrefs(page, { theme: "bark" });
  await openToday(page);
  await expect(page.getByTestId("track-session")).toHaveText("Jazz Harmony · session 4 of 35", {
    timeout: 20_000,
  });
  await expect(offers(page).getByTestId("track-lead")).toHaveText(/^Today is your Jazz track\./);
  // The Jazz session is not offered again; Rhythm comes first among the others (wave7.md §6: J, then R1.L03, then A).
  await expect(offers(page).locator('[data-offer="J"]')).toHaveCount(0);
  await expect(offers(page).locator("[data-offer]").first()).toHaveAttribute("data-offer", "R");
  await expect(offers(page).locator('[data-offer="R"]')).toContainText("R1.L03");
  await expect(page.locator("main")).not.toContainText(NEVER7);
  // Keyboard: the focus switch is a radio group; choosing Rhythm moves the New block to Rhythm's next lesson.
  const radio = page.getByTestId("track-focus").getByRole("radio", { name: "Jazz Harmony" });
  await radio.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await focus7(request)).focus).toBe("R");
  await expect(page.getByTestId("track-session")).toHaveText(/^Advanced Rhythm · session 3 of 21$/, {
    timeout: 20_000,
  });
  await startByEnter(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "lesson", mapItemId: "R1.L03" });
  // Never locked in: back to Jazz for tomorrow (the API, as the switch would).
  await api(request, "PUT", "/api/tracks/focus", { focus: "J" });
  expect((await focus7(request)).focus).toBe("J");
  expect(errors).toEqual([]);
});

test("the last day of the course: AC2's last session is the day's, said as what it is; nothing counts down", async ({
  page,
  request,
}) => {
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "after AC2.S2");
  const plan = await plan7(request);
  expect(plan).toMatchObject({ kind: "capstone", mapItemId: "AC2.S3", focus: "A", course: "in-progress" });
  expect(plan.track).toMatchObject({ trackId: "A", sessionIndex: 23, sessionsTotal: 23 });
  const whole = await api<{ stage: string; sessionsDone: number }>(request, "GET", "/api/course/whole");
  expect(whole).toMatchObject({ stage: "in-progress", sessionsDone: 269 });
  await useUiPrefs(page, { theme: "paper" });
  await openToday(page);
  await expect(page.getByTestId("track-session")).toHaveText("Arrangement & Sound · session 23 of 23", {
    timeout: 20_000,
  });
  await expect(page.getByTestId("start-session")).toHaveCount(1);
  // The day's session is not offered again beside itself, and no other track has anything left to offer.
  await expect(offers(page).locator("[data-offer]")).toHaveCount(0);
  // "The last session" of AC2 is the capstone's own plan; nothing says the course is about to end.
  await expect(page.getByTestId("today-card")).toContainText("The last session: finish the piece");
  await expect(page.locator("main")).not.toContainText(
    /sessions? (left|to go)|one more session|last day|almost (done|there)|end of the course/i,
  );
  await expect(page.locator("main")).not.toContainText(NEVER7);
  expect(errors).toEqual([]);
});

test("the day after the whole course: an ordinary day, one line back to the record, what stays open", async ({
  page,
  request,
}) => {
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "whole course complete");
  const plan = await plan7(request);
  expect(plan.course).toBe("complete");
  const whole = await api<{ stage: string; open: { kind: string; title: string; available: boolean }[] }>(
    request,
    "GET",
    "/api/course/whole",
  );
  expect(whole.stage).toBe("complete");
  await useUiPrefs(page, { theme: "paper" });
  const open = async (p: Page) => {
    await openToday(p);
    await expect(p.getByTestId("open-to-you")).toBeVisible({ timeout: 20_000 });
  };
  await open(page);
  // An ordinary day with its own Start; never an empty page, never "the end".
  await expect(page.getByTestId("start-session")).toBeVisible();
  await expect(page.getByTestId("course-first-day")).toHaveText(
    "Both sides of the record are complete. Play Side B.",
  );
  await expect(page.getByTestId("course-first-day-play")).toHaveAttribute("href", "/album");
  await expect(page.getByTestId("first-day")).toHaveCount(0);
  const list = page.getByTestId("open-to-you");
  for (const o of whole.open.filter((x) => x.available && x.kind !== plan.kind && x.kind !== "side-lesson"))
    await expect(list).toContainText(o.title);
  await expect(page.getByTestId("course-keep-playing")).toContainText("The Oak keeps its leaves green");
  await expect(offers(page)).toHaveCount(0);
  // Every track is complete: the planner's "nothing of the track you chose" fallback is not said.
  await expect(page.locator("main")).not.toContainText(/track you chose/);
  await expect(page.locator("main")).not.toContainText(NEVER7);
  await matrix(page, "w7-today-after-course", open);
  expect(errors).toEqual([]);
});

test("a jazz day in Quiet mode: Today names the track session; the warm-up's ii–V–I set plays, is answered and moves on; the mic never opens", async ({
  page,
  request,
}) => {
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "J3.L02 next");
  // When the ii–V–I set falls due is the seeded learner's own review history: since Oak 2.0 W2 put J3.L05 before
  // J3.L02 it is not due on this day, so it is made due (the warm-up's planner reads `srs_cards.due_at`).
  const db = new DatabaseSync(`${stack.dataDir}/oak.db`);
  try {
    db.prepare("UPDATE srs_cards SET due_at = ? WHERE card_id = ?").run(
      new Date(Date.now() - 86_400_000).toISOString(),
      "fam.jzz.ii-v",
    );
  } finally {
    db.close();
  }
  await api(request, "PUT", "/api/voice/quiet", { quiet: true, scope: "today" });
  const plan = await plan7(request);
  expect(plan).toMatchObject({ kind: "lesson", mapItemId: "J3.L02", focus: "J" });
  const micAsked = await countMic(page);
  const { trials } = wire(page);
  await useUiPrefs(page, { theme: "bark" });
  await openToday(page);
  await expect(page.getByTestId("track-session")).toHaveText("Jazz Harmony · session 15 of 35", {
    timeout: 20_000,
  });
  await startDay(page, "J3.L02");
  // The sets before it are passed over as a learner's skip would (they stay due); this one is heard through.
  const item = await toFamily(page, "fam.jzz.ii-v", { kind: "family-set" });
  const total = await totalOf(page);
  const t = await trialNo(page, 1, total);
  expect(t.family).toBe("fam.jzz.ii-v");
  expect(t.level).toBe(item.level);
  await answerChoice(page, t);
  await expect(page.getByTestId("hear-alone")).toBeVisible();
  await expect.poll(() => trials.get(0)?.familyId).toBe("fam.jzz.ii-v");
  await nextTrial(page);
  await trialNo(page, 2, total);
  expect(micAsked(), "Quiet mode: nothing asks for the microphone").toBe(0);
  await expect(page.locator("main")).not.toContainText(NEVER7);
  expect(errors).toEqual([]);
});
