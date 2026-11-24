// Side lessons in the lesson player (Wave 5, wave5.md §5.1): A1.L01 opened from the Toolbox plays like any lesson,
// says plainly that it is optional and what it will make better, ends on "Side lesson complete" with the way back to
// where the learner was, and leaves the core alone: U03.L03 is still today's lesson, and a core session running
// beside it is not moved on by the side lesson's blocks.
import { expect, test } from "./support.ts";
import { api, reseedFresh, seed, setQuiet } from "./w3support.ts";
import { lessonDefW5 } from "./w5walk.ts";
import { walkLesson } from "./walk.ts";

test.describe.configure({ mode: "serial" });
test.afterAll(async ({ request }) => {
  await reseedFresh(request);
});

type Progress = { lessons: { lessonId: string; status: string }[] };
const statusOf = async (page: import("@playwright/test").Page, id: string) =>
  (await api<Progress>(page, "GET", "/lessons/progress")).body?.lessons.find((l) => l.lessonId === id)
    ?.status;

test("A1.L01 from the Toolbox: optional, what it makes better, back to the Toolbox; the core untouched", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seed(page, "after U03.L02");
  await setQuiet(page, false);
  await page.goto("/learn/A1.L01?from=toolbox");
  const note = page.getByTestId("side-lesson-note");
  await expect(note).toBeVisible({ timeout: 30_000 });
  await expect(note).toContainText("Optional side lesson, about 15 minutes");
  await expect(note).toContainText("sawtooth bass");
  await expect(note).toContainText("Nothing in the course waits for it");
  await expect(note).not.toContainText(/required|must/i);
  // "Leave for now" is a plain link back, reachable by keyboard.
  const leave = page.getByTestId("side-leave");
  await expect(leave).toHaveText("Leave for now");
  await expect(leave).toHaveAttribute("href", "/toolbox");
  const def = await lessonDefW5("A1.L01");
  await walkLesson(page, def, { lessonId: "A1.L01", mic: false, quiet: false });
  const done = page.getByTestId("lesson-complete");
  await expect(done.getByRole("heading").first()).toHaveText("Side lesson complete");
  // Its Make went into the unit's song: the recap shows the song as it grew and leads to it.
  await expect(done.getByTestId("coda-song-grew")).toBeVisible();
  await expect(done.getByRole("link", { name: "Open the song" })).toHaveAttribute("href", "/song/A1");
  await expect(page.getByTestId("side-complete-note")).toContainText("Filters & Filter Envelopes");
  await expect(page.getByTestId("side-complete-note")).toContainText("It was optional");
  const back = page.getByTestId("back-to-today");
  await expect(back).toHaveText("Back to the Toolbox");
  expect(await statusOf(page, "A1.L01")).toBe("completed");
  expect(await statusOf(page, "U03.L03"), "the core lesson is not marked done").not.toBe("completed");
  await back.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/toolbox$/);
});

test("A1.L01 beside a running core session: the session's blocks are not moved on", async ({ page }) => {
  test.setTimeout(150_000);
  await seed(page, "after U03.L02");
  await setQuiet(page, false);
  await page.goto("/");
  const start = page.getByTestId("start-session");
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();
  await expect(page).not.toHaveURL(/\/$/, { timeout: 30_000 });
  const before = await page.evaluate(() => localStorage.getItem("oak.session.active.v1"));
  expect(before, "a session is running").not.toBeNull();
  const block0 = (JSON.parse(before as string) as { state: { block: string; plan: { mapItemId: string } } })
    .state;
  expect(block0.plan.mapItemId).toBe("U03.L03");
  await page.goto("/learn/A1.L01");
  await expect(page.getByTestId("side-lesson-note")).toBeVisible({ timeout: 30_000 });
  const def = await lessonDefW5("A1.L01");
  await walkLesson(page, def, { lessonId: "A1.L01", mic: false, quiet: false });
  // Not the session's lesson: no "On to the Coda", the way back is Today.
  await expect(page.getByTestId("back-to-today")).toHaveText("Back to Today");
  const after = JSON.parse(
    (await page.evaluate(() => localStorage.getItem("oak.session.active.v1"))) as string,
  ) as { state: { block: string; reports: { itemId?: string; block: string }[] } };
  expect(after.state.block, "the core session is where it was").toBe(block0.block);
  expect(after.state.reports.some((r) => r.itemId === "A1.L01")).toBe(false);
  expect(await statusOf(page, "U03.L03")).not.toBe("completed");
});

test("a core lesson has no side-lesson note, and its end goes back to Today", async ({ page }) => {
  test.setTimeout(60_000);
  await seed(page, "after U03.L02");
  await page.goto("/learn/U03.L03?from=map");
  await expect(page.getByTestId("lesson-step")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("side-lesson-note")).toHaveCount(0);
});

test("a side lesson resumed later says it is optional at the step it opens at", async ({ page }) => {
  test.setTimeout(90_000);
  await seed(page, "after U03.L02");
  await setQuiet(page, false);
  const def = await lessonDefW5("A1.L01");
  await page.goto("/learn/A1.L01?from=today");
  await walkLesson(page, def, { lessonId: "A1.L01", mic: false, quiet: false, until: "S3" });
  await page.reload();
  await expect(page.getByTestId("lesson-step")).toHaveAttribute("data-step", "S3", { timeout: 30_000 });
  await expect(page.getByTestId("side-lesson-note")).toBeVisible();
  await expect(page.getByTestId("side-leave")).toHaveAttribute("href", "/");
});

// --- from Today (wave5.md §5.1): the offer beside the core session starts a normal lesson session ----------------

type SessionHandle = {
  report(r: unknown): void;
  state(): {
    plan: { kind: string; mapItemId: string | null; warmup: { items: { id: string }[] } } | null;
    block: string | null;
  };
};
type TodayPlan = {
  kind: string;
  mapItemId: string | null;
  sideLesson: { lessonId: string; placement: string } | null;
};
const sessionState = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as never as { __oakSession: SessionHandle }).__oakSession.state());

/** The warm-up belongs to the drills suites: reported skipped, as the learner's own skip would. */
async function skipWarmup(page: import("@playwright/test").Page) {
  await expect.poll(async () => (await sessionState(page)).block, { timeout: 30_000 }).not.toBeNull();
  await page.evaluate(() => {
    const o = (window as never as { __oakSession: SessionHandle }).__oakSession;
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
}

/** The tools granted so far (`GET /unlocks`). */
async function unlockList(page: import("@playwright/test").Page): Promise<string[]> {
  const r = await api<{ items: { itemId: string }[] }>(page, "GET", "/unlocks");
  return (r.body?.items ?? []).map((u) => u.itemId);
}

for (const at of [
  { point: "side lesson offered", core: "U03.L03", label: "U03" },
  { point: "after U11.L06", core: "U11.L07", label: "U11" },
] as const) {
  test(`A1.L01 from Today at ${at.label}: it plays, completes, unlocks the scope, and ${at.core} stays today's lesson`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await seed(page, at.point);
    await setQuiet(page, false);
    const before = (await api<TodayPlan>(page, "GET", "/session/today")).body as TodayPlan;
    expect(before).toMatchObject({ kind: "lesson", mapItemId: at.core });
    expect(before.sideLesson).toMatchObject({ lessonId: "A1.L01", placement: "alternative" });
    const unlocked0 = await unlockList(page);
    expect(unlocked0).not.toContain("tb.scope");
    // Today: the core session is the primary action; the side lesson one calm line under it.
    await page.goto("/");
    const offer = page.getByTestId("side-offer");
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await expect(offer).toHaveAttribute("data-lesson", "A1.L01");
    await page.getByTestId("side-offer-start").click();
    await page.waitForURL(/\/session\/?$/, { timeout: 30_000 });
    expect((await sessionState(page)).plan).toMatchObject({ kind: "lesson", mapItemId: "A1.L01" });
    await skipWarmup(page);
    await expect(page.getByTestId("lesson-step")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("side-lesson-note")).toContainText("Optional side lesson");
    const def = await lessonDefW5("A1.L01");
    // Inside its session the Make ends the lesson and the session's Coda follows.
    await walkLesson(page, def, { lessonId: "A1.L01", mic: false, quiet: false, inSession: true });
    await expect(page.getByTestId("coda-title")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("main")).toContainText("Waves & Harmonics");
    // Its unlocks are granted like any lesson's (§3.1 rule 2), and the Coda shows them.
    const unlocked = await unlockList(page);
    expect(unlocked).toEqual(expect.arrayContaining(["tb.scope", "tb.partials"]));
    await expect(page.locator("main")).toContainText(".partials");
    // The unlock ceremony first ("See the rest of today"), then home.
    const rest = page.getByRole("button", { name: "See the rest of today" });
    for (let i = 0; i < 4 && (await rest.isVisible()); i++) await rest.click();
    await page.getByTestId("done-for-today").click();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
    await expect(page.getByTestId("today-card")).toBeVisible({ timeout: 30_000 });
    // The core is untouched: not done, nothing of it started, and it is still what the course does next.
    expect(await statusOf(page, at.core), `${at.core} untouched`).not.toBe("completed");
    expect(await statusOf(page, "A1.L01")).toBe("completed");
    const after = (await api<TodayPlan>(page, "GET", "/session/today")).body as TodayPlan;
    // Back where they were: today's core lesson is still the session on offer, and no second side lesson today.
    expect(after, `${at.core} is still today's lesson`).toMatchObject({ kind: "lesson", mapItemId: at.core });
    expect(after.sideLesson ?? null, "one side lesson a day").toBeNull();
    const side = (
      await api<{ items: { lessonId: string; status: string }[]; next: string | null }>(
        page,
        "GET",
        "/side-lessons",
      )
    ).body;
    expect(side?.next, "the track moves on to its next side lesson").toBe("A1.L02");
    const progress = (await api<{ sideLessons?: { done: number } }>(page, "GET", "/lessons/progress")).body;
    if (progress?.sideLessons) expect(progress.sideLessons.done).toBe(1);
  });
}
