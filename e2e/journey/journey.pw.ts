// The Wave 2 gate journey (docs/design/wave2.md §9) on the real stack: real server, real content, the scripted fake
// tutor, Chrome's fake microphone. Split at the final gate of Wave 3 into five tests of a few minutes each, every one
// starting from a dev seed (wave2.md §5) instead of replaying the days before it: onboarding with a microphone (a
// fresh learner); U00.L02 and U01.L01 as daily sessions with their warm-ups; U01.L02 with a tutor hint and an
// explanation, then the Studio sketch (no listening note: removed 2026-11-22), the Toolbox and the Oak; the U01
// checkpoint; C0 made, released and found on the album with its cover, audio and liner notes. Zero console errors
// (beyond Strudel's learner-error line) and zero requests off this machine. A last test does onboarding in Quiet mode
// (no microphone) and one session.
import { expect, type Page, test } from "@playwright/test";
import {
  expectStep,
  fakeMic,
  partContinue,
  reactContinue,
  shootAll as shootOnboarding,
  throughTheLoop,
  watchErrors,
} from "../../app/src/onboarding/e2e/helpers.ts";
import { capstones } from "../../content/capstones.ts";
import u00l02 from "../../content/core/U00/L02/lesson.ts";
import u01l01 from "../../content/core/U01/L01/lesson.ts";
import u01l02 from "../../content/core/U01/L02/lesson.ts";
import { useUiPrefs } from "../support/ui.ts";
import { walkCapstone } from "./capstone-walk.ts";
import { walkCheckpoint } from "./checkpoint-walk.ts";
import { coda, lessonDay, startToday } from "./day.ts";
import { passingResponse, setCode, walkLesson } from "./lesson-walk.ts";
import {
  advanceDays,
  api,
  expectClean,
  noHmr,
  openToday,
  resetClock,
  seed,
  shootAll,
  watch,
} from "./support.ts";

test.use({ launchOptions: { args: fakeMic("voice.wav") }, permissions: ["microphone"] });

const SING_HOME = { sung: [{ midi: 60, cents: 0, credit: 1 }] };

/** The latency screen's 16 taps: one Space as each dot lights (as the onboarding suite does). */
async function tapAlong(page: Page) {
  await page.getByTestId("tap-start").click();
  await page.evaluate(() => {
    const list = document.querySelector('[data-testid="latency-tap"] ol');
    let last = -1;
    const obs = new MutationObserver(() => {
      const i = [...(list?.children ?? [])].findIndex((li) => li.getAttribute("aria-current") === "step");
      if (i > last) {
        last = i;
        setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " })), 15);
      }
    });
    if (list) obs.observe(list, { subtree: true, attributes: true });
  });
}

const tutorMessage = (page: Page) => page.getByTestId("tutor-chat").getByTestId("tutor-message").last();
async function tutorDone(page: Page) {
  await expect(tutorMessage(page)).toHaveAttribute("data-status", /done/, { timeout: 30_000 });
}

test("gate journey 1: a fresh learner goes through onboarding with a microphone", async ({
  page,
  request,
}) => {
  await resetClock(request);
  await seed(request, "fresh");
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const w = watch(page);
  // The onboarding area's own watcher as well (its walk of these screens was merged into this test): every console
  // error and page error counts but a 501's line. The journey's watch lets Strudel's report of a learner's broken
  // code pass, and nothing on this path breaks code on purpose, so both must be clean at the end.
  const problems = watchErrors(page);

  // --- day 1: onboarding with a microphone (it completes U00.L01 on the map) ----------------------------------
  await openToday(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "first-run");
  await page.getByTestId("begin-onboarding").click();
  // The onboarding area's own walk of every screen (merged from app/src/onboarding/e2e/onboarding.pw.ts, which
  // walked these same screens in real time): its choices, checks and reference screenshots
  // (app/src/onboarding/e2e/screenshots, both themes at both sizes) are made here.
  await throughTheLoop(page, 6, { shots: true });
  await expect(page.getByText("6 plays B, leaning up toward home")).toBeVisible({ timeout: 5_000 });
  await reactContinue(page).click();

  // Preferences: a flavour previewed and chosen, 25 minutes a day.
  await expectStep(page, "prefs");
  await page.getByTestId("flavour-jazz-soul").click();
  await page.getByTestId("preview-jazz-soul").click();
  await expect(page.getByTestId("preview-jazz-soul")).toHaveText("Stop", { timeout: 15_000 });
  await shootOnboarding(page, "05-prefs");
  await page.getByRole("radio", { name: "25 min" }).click();
  await page.getByTestId("prefs-continue").click();

  // The tutor (scripted fake backend: ready through the "Claude login").
  await expectStep(page, "tutor");
  await expect(page.getByTestId("tutor-ready")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("tutor-sends")).toContainText("Never your voice", { timeout: 5_000 });
  await page.getByTestId("tutor-ask").click();
  await expect(page.getByTestId("tutor-asked")).toBeVisible({ timeout: 5_000 });
  await shootOnboarding(page, "06-tutor");
  await page.getByTestId("tutor-continue").click();

  // Headphones: left/right.
  await expectStep(page, "headphones");
  await page.getByTestId("lr-play").click();
  await page.getByTestId("lr-left").click({ timeout: 10_000 });
  await shootOnboarding(page, "07-headphones");
  await partContinue(page).click();

  // Microphone: the privacy line, permission, a live signal, the quiet room, no bleed.
  await expectStep(page, "mic");
  await expect(page.getByTestId("privacy-line")).toHaveText(
    "Your voice is analysed live on this computer. Nothing is recorded or sent.",
    { timeout: 5_000 },
  );
  await expect(page.getByRole("button", { name: /Microphone is live/ })).toHaveCount(0, { timeout: 5_000 });
  await shootOnboarding(page, "08-mic-ask");
  await page.getByTestId("mic-allow").click();
  await expect(page.getByTestId("mic-live")).toBeVisible({ timeout: 15_000 });
  // The shell's indicator is truthful: on while the stream is open.
  await expect(page.getByRole("button", { name: /Microphone is live/ })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Oak can hear you.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("mic-note")).toHaveText(/^C4 /, { timeout: 5_000 });
  await shootOnboarding(page, "09-mic-live");
  await partContinue(page).click();
  await page.getByTestId("noise-start").click();
  await expect(page.getByText("Quiet enough")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Microphone is live/ })).toHaveCount(0, { timeout: 5_000 });
  await partContinue(page).click();
  await page.getByTestId("bleed-start").click();
  await expect(page.getByText("The mic doesn't hear your speakers")).toBeVisible({ timeout: 15_000 });
  await shootOnboarding(page, "10-mic-done");
  await partContinue(page).click();

  // Range: the sweep hears A2 and E4.
  await expectStep(page, "range");
  await page.getByTestId("range-start").click();
  await expect(page.getByTestId("range-sweeping")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("range-detail")).toContainText("A2–E4", { timeout: 20_000 });
  await shootOnboarding(page, "11-range");
  await partContinue(page).click();

  // Timing: 16 taps (dispatched on each click as the dots light), then 8 sung "da"s from the fake mic.
  await expectStep(page, "latency");
  await tapAlong(page);
  await expect(page.getByText(/Your taps land \d+ ms (after|before) the click/)).toBeVisible({
    timeout: 20_000,
  });
  // Timing has two sub-steps: tapping, then singing.
  await partContinue(page).click();
  await page.getByTestId("sing-start").click();
  await expect(page.getByText(/Your voice lands \d+ ms/)).toBeVisible({ timeout: 20_000 });
  await shootOnboarding(page, "12-latency");
  await partContinue(page).click();

  // The first sung note: C, any octave.
  await expectStep(page, "first-sing");
  await page.getByTestId("first-sing-start").click();
  await expect(page.getByText("That note is 1: home.")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("button", { name: /Microphone is live/ })).toHaveCount(0, { timeout: 5_000 });
  await shootOnboarding(page, "13-first-sing");
  await partContinue(page).click();

  // Sketch 001.
  await expectStep(page, "sketch");
  await expect(page.getByTestId("workbench")).toBeVisible({ timeout: 30_000 });
  await shootOnboarding(page, "14-sketch");
  await page.getByTestId("sketch-save").click();
  await expectStep(page, "coda");
  await expect(page.getByTestId("coda-rows")).toContainText("You changed the last note to 6", {
    timeout: 5_000,
  });
  await expect(page.getByTestId("coda-rows")).toContainText("Jazz-soul · 25 minutes a day", {
    timeout: 5_000,
  });
  await expect(page.getByTestId("coda-rows")).toContainText("Comfortable", { timeout: 5_000 });
  await expect(page.getByTestId("coda-rows")).toContainText("Sung: that note is home", { timeout: 5_000 });
  await shootOnboarding(page, "15-coda");
  // The review's first-day regressions (merged from e2e/review/onboarding-day.pw.ts, which walked these same
  // screens): the Coda's toolbox uses plain tool names and leaves out the Sing panel (it arrives with U00.L02),
  // and its "Next time" names the lesson Today will offer (it said "Heartbeat", which is U01.L01).
  const box = page.getByTestId("coda-toolbox");
  await expect(box).toContainText("Band layer");
  await expect(box).not.toContainText("(");
  await expect(box).not.toContainText("Sing panel");
  await expect(box).not.toContainText("lowercase track labels");
  await expect(box).toContainText("label: pattern");
  await expect(page.getByTestId("screen-coda")).toContainText("Next time: Set Up & First Sing.");
  await shootAll(page, "onboarding-coda");
  await page.getByTestId("coda-done").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("today-card")).toBeVisible();
  const p1 = await api<{ lessons: { lessonId: string; status: string }[] }>(
    request,
    "GET",
    "/api/lessons/progress",
  );
  expect(p1.lessons.find((l) => l.lessonId === "U00.L01")?.status).toBe("completed");
  // Everything was stored through the API.
  const profile = await api<{
    onboardedAt: string | null;
    flavour: string;
    targetMinutes: number;
    vocalLowMidi: number | null;
    vocalHighMidi: number | null;
    noiseFloorDb: number | null;
    tapLatencyMs: number | null;
    singLatencyMs: number | null;
    quiet: boolean;
  }>(request, "GET", "/api/profile");
  expect(profile.onboardedAt).not.toBeNull();
  expect(profile.flavour).toBe("flavour.jazz-soul");
  expect(profile.targetMinutes).toBe(25);
  expect(profile.vocalLowMidi).toBe(45);
  expect(profile.vocalHighMidi).toBe(64);
  expect(profile.noiseFloorDb).toBeLessThan(-45);
  expect(profile.tapLatencyMs).not.toBeNull();
  expect(profile.singLatencyMs).not.toBeNull();
  expect(profile.quiet).toBe(false);
  const sketches = await api<{ items: { title: string }[] }>(request, "GET", "/api/sketches");
  expect(sketches.items.map((s) => s.title)).toContain("Sketch 001");
  // The first day ends done and counted (not a full 20-minute session offered again; the onboarding day on the
  // week strip), and Today names the next unlock plainly.
  const card = page.getByTestId("today-card");
  await expect(card).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("today-done")).toContainText("Next time: Set Up & First Sing");
  await expect(page.getByRole("button", { name: "Start another session" })).toBeVisible();
  const unlock = page.getByTestId("next-unlock");
  await expect(unlock).toContainText("Sing panel");
  await expect(unlock).not.toContainText("PitchLane");
  const boot = await api<{ streak: { todayQualified: boolean; thisWeek: { qualifyingDays: number } } }>(
    request,
    "GET",
    "/api/bootstrap",
  );
  expect(boot.streak.todayQualified).toBe(true);
  expect(boot.streak.thisWeek.qualifyingDays).toBe(1);
  // The first week's goal is pro-rated by the server: on a Sunday it is one day, and the day's session meets it.
  await expect(page.getByText(/1 of \d days? this week|This week's goal is met: 1 of 1 day/)).toBeVisible();
  await shootAll(page, "today-day1");
  // A reload keeps the done state (it is remembered in this browser).
  await page.reload();
  await expect(card).toHaveAttribute("data-state", "done");

  expect(problems, "console and page errors, evaluation errors included").toEqual([]);
  expectClean(w);
});

test("gate journey 2: U00.L02 and U01.L01 as daily sessions, warm-ups included", async ({
  page,
  request,
}) => {
  // Onboarding (U00.L01) finished yesterday.
  await resetClock(request);
  await seed(request, "onboarded");
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const w = watch(page);

  // --- day 2: U00.L02; the set-up parts done in onboarding are kept, the first note is sung --------------------
  await lessonDay(page, request, u00l02, { answers: { S5: SING_HOME } });

  // --- day 3: the warm-up the plan holds, then U01.L01 and its Make over the Band ------------------------------
  await advanceDays(request, 1);
  await lessonDay(page, request, u01l01, { makeTitle: "First beat" });

  expectClean(w);
});

test("gate journey 3: U01.L02 with a tutor hint and an explanation, then Studio, Toolbox and the Oak", async ({
  page,
  request,
}) => {
  // The Oak as it stands the day after onboarding, to compare with after U01.L02 (one lesson alone may grow no
  // leaf); then U01.L01 done yesterday, today U01.L02.
  await resetClock(request);
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  await seed(request, "onboarded");
  const leavesBefore = await grownLeaves(page);
  await seed(request, "after U01.L01");
  const w = watch(page);

  // --- day 4: U01.L02 with a tutor hint and an explanation on its first graded step ----------------------------
  // The warm-up is reported skipped (gate journey 2 walks whole warm-ups): this day is about the tutor.
  await lessonDay(page, request, u01l02, {
    warmupSets: 0,
    makeTitle: "Count to four",
    before: async (step) => {
      if (step.id !== "S5") return;
      const wrong = (
        step.exercise as { tests: { response: { code?: string }; expect: string }[] }
      ).tests.find((t) => t.expect === "fail" && t.response.code);
      expect(passingResponse(step)).not.toBeNull();
      await setCode(page, wrong?.response.code as string);
      await page.getByTestId("check").click();
      await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
      // A nudge from Claude (hint 1 through the tutor), then "Explain my mistake" from the panel.
      await page.getByTestId("ask-nudge").click();
      await tutorDone(page);
      const actions = page.getByTestId("tutor-chat").getByTestId("quick-actions");
      await actions.getByRole("button", { name: "Explain my mistake" }).click();
      await tutorDone(page);
      // Two answers from Claude in the lesson's thread (the hint, then the explanation).
      await expect(page.getByTestId("tutor-chat").getByTestId("tutor-message")).toHaveCount(2);
      await expect(tutorMessage(page)).not.toBeEmpty();
      const st = await api<{ rung: number; attempts: number }>(
        request,
        "GET",
        "/api/lessons/U01.L02/steps/S5",
      );
      expect(st.rung).toBeGreaterThanOrEqual(2);
    },
  });

  // --- the Studio: the day's sketch opens; Claude's listening note is gone (owner, 2026-11-22) -----------------
  await page.goto("/studio");
  const card = page.getByTestId("sketch-card").filter({ hasText: "Count to four" }).first();
  await card.click();
  await expect(page).toHaveURL(/\/studio\/[^/]+$/);
  await expect(page.getByTestId("sketch-title")).toHaveText("Count to four", { timeout: 30_000 });
  await expect(page.getByTestId("ask-listening")).toHaveCount(0);
  await expect(page.getByTestId("listening-note")).toHaveCount(0);

  // --- the Toolbox shows the tools U01.L02 opened -------------------------------------------------------------
  await page.goto("/toolbox/tb.gain");
  await expect(page.getByTestId("tool-example")).toBeVisible({ timeout: 30_000 });

  // --- the Oak has grown since day 1 ------------------------------------------------------------------------------
  const leavesNow = await grownLeaves(page);
  expect(leavesNow).toBeGreaterThan(leavesBefore);
  await page.goto("/oak");
  await expect(page.getByRole("heading", { name: /The Oak/ }).first()).toBeVisible();

  expectClean(w);
});

test("gate journey 4: the U01 checkpoint day, passed", async ({ page, request }) => {
  await resetClock(request);
  await seed(request, "U01.CP due");
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const w = watch(page);

  // --- skip ahead (dev seeder): U01.L03 … U02.L01 done one day each, today's New block is the U01 checkpoint -----
  // The seed replays the course one day per session up to yesterday on the real clock.
  // The warm-up is reported skipped (gate journey 2 walks whole warm-ups): this day is about the checkpoint.
  const cpPlan = await startToday(page, request, { warmupSets: 0 });
  expect(cpPlan).toMatchObject({ kind: "checkpoint", mapItemId: "U01.CP" });
  const tap = (await api<{ tapLatencyMs: number | null }>(request, "GET", "/api/profile")).tapLatencyMs ?? 0;
  expect(await walkCheckpoint(page, tap)).toEqual({ passed: true });
  await page.getByTestId("checkpoint-done").click();
  await coda(page, { unlocks: false });

  expectClean(w);
});

test("gate journey 5: C0 made, released and found on the album", async ({ page, request }) => {
  // U01.CP passed yesterday: C0 is open and today's New block is C0.S1.
  await resetClock(request);
  await seed(request, "C0 ready");
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const w = watch(page);

  // --- the next day: C0, checked and released to the album -------------------------------------------------------
  // The warm-up is reported skipped (gate journey 2 walks whole warm-ups): this day is about C0.
  const c0Plan = await startToday(page, request, { warmupSets: 0 });
  expect(c0Plan).toMatchObject({ kind: "capstone", mapItemId: "C0.S1" });
  const ref = capstones
    .find((c) => c.id === "C0")
    ?.brief?.tests.find((t) => t.name === "four bars, tom fill in bar 4");
  if (!ref || !("code" in ref.response))
    throw new Error("C0's reference piece is not in content/capstones.ts");
  await walkCapstone(page, {
    id: "C0",
    code: ref.response.code,
    rules: 6,
    linerLine: "Straight time, then the toms take bar 4.",
  });
  await shootAll(page, "release-ceremony");
  await page.getByRole("button", { name: "Continue to the coda" }).click();
  await coda(page, { unlocks: false });

  // --- the album: track 1 with its cover, its recording and its liner notes ------------------------------------
  const c0 = await api<{ status: string; trackId: string }>(request, "GET", "/api/capstones/C0");
  expect(c0.status).toBe("released");
  await page.goto("/album");
  const row = page.locator(`[data-track="${c0.trackId}"]`);
  await expect(row.locator("svg[data-cover-rings]")).toHaveAttribute("data-cover-rings", "4", {
    timeout: 30_000,
  });
  await row.getByRole("button", { name: "Liner notes" }).click();
  await expect(row.getByTestId("liner-notes")).toContainText("Straight time, then the toms take bar 4.");
  await row.getByRole("link", { name: "Intro" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Intro" })).toBeVisible();
  await expect(page.getByTestId("track-audio")).toBeVisible();
  // The recording the release made: real audio bytes, served to the page.
  const bytes = await page.evaluate(async (id) => {
    const res = await fetch(`/api/album/tracks/${id}/versions/1/audio`);
    return res.ok ? (await res.arrayBuffer()).byteLength : -res.status;
  }, c0.trackId);
  expect(bytes).toBeGreaterThan(4000);
  // Today's album strip shows the released track's own cover.
  await openToday(page);
  await expect(page.getByTestId("album-strip").getByRole("link", { name: /Intro, released/ })).toBeVisible();

  expectClean(w);
});

test("Quiet mode: onboarding without a microphone, then one session", async ({ page, request }) => {
  await resetClock(request);
  await seed(request, "fresh");
  await noHmr(page);
  await useUiPrefs(page, { theme: "bark" });
  const w = watch(page);
  await openToday(page);
  await page.getByTestId("begin-onboarding").click();
  await throughTheLoop(page, 5);
  await reactContinue(page).click();
  await expectStep(page, "prefs");
  await page.getByTestId("prefs-continue").click();
  await expectStep(page, "tutor");
  await page.getByTestId("tutor-continue").click();
  await expectStep(page, "headphones");
  await page.getByTestId("lr-play").click();
  await page.getByTestId("lr-left").click({ timeout: 10_000 });
  await partContinue(page).click();
  await expectStep(page, "mic");
  await page.getByTestId("mic-quiet").click();
  // Quiet mode passes over the range; the latency screen keeps only taps, which can wait; the first note is a
  // listening step.
  await expectStep(page, "latency");
  await expect(page.getByTestId("onboarding")).toHaveAttribute("data-quiet", "1");
  await page.getByTestId("part-skip").click();
  await expectStep(page, "first-sing");
  await page.getByTestId("first-sing-start").click();
  await partContinue(page).click();
  await expectStep(page, "sketch");
  await expect(page.getByTestId("workbench")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("sketch-save").click();
  await expectStep(page, "coda");
  await page.getByTestId("coda-done").click();
  await expect(page).toHaveURL(/\/$/);
  expect((await api<{ quiet: boolean }>(request, "GET", "/api/profile")).quiet).toBe(true);

  // Day 2 in Quiet mode: U00.L02's sung step passes over, the rest of the session runs.
  await advanceDays(request, 1);
  const plan = await startToday(page, request);
  expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U00.L02" });
  await walkLesson(page, u00l02, { answers: { S5: SING_HOME } });
  await coda(page, { unlocks: true });
  expectClean(w);
});

/** The grown-leaves count of Today's Oak thumbnail (its link names it). */
async function grownLeaves(page: Page): Promise<number> {
  await openToday(page);
  const link = page.getByTestId("oak-glance").getByRole("link").first();
  await expect(link).toHaveAttribute("aria-label", /leaves grown/, { timeout: 30_000 });
  const label = (await link.getAttribute("aria-label")) ?? "";
  return Number(/(\d+) of \d+ leaves grown/.exec(label)?.[1] ?? "0");
}
