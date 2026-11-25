// Wave 4 days on the real planner, each from a named dev seed (wave4.md §6), from Today to the Coda: U07.CP offered
// while U08.L01 is unwritten; C2 session 1 (the workspace stays mounted when its draft is bound) and session 2
// (resumed from the top, released, the release Coda); a capstone never interrupted by a gym slot; a gym day on the
// graded ladder (gym.start, the item drawn for that gym session, a graded pass, the ladder Coda) and one on the
// learner's own audio; "Two more gym sets open X1"; X1 session 1 and session 3; the end of the written course
// after X1, with Studio and the gym.
import type { NEvent } from "@oak/content-kit";
import { expect, type Page, test } from "@playwright/test";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { stimulusCode } from "../../../transcribe/stimulus-code.ts";
import { api, blockHmr, expectNoOverflow, matrix, SHOTS, seed, settle } from "./support.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

type OakSessionHandle = {
  runner: { toCoda(): void };
  report(r: unknown): void;
  state(): {
    plan: { kind: string; mapItemId: string | null; warmup: { items: { id: string }[] } } | null;
    session: { id: string } | null;
    block: string | null;
  };
};

/** The warm-up is the drills suites' (w4-warmups.pw.ts): reported skipped here, as the learner's skip would. */
async function skipWarmup(page: Page): Promise<void> {
  await expect.poll(async () => (await sessionState(page)).block, { timeout: 30_000 }).not.toBeNull();
  await page.evaluate(() => {
    const o = (window as never as { __oakSession: OakSessionHandle }).__oakSession;
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
const toCoda = (page: Page) =>
  page.evaluate(() => (window as never as { __oakSession: OakSessionHandle }).__oakSession.runner.toCoda());
const sessionState = (page: Page) =>
  page.evaluate(() => (window as never as { __oakSession: OakSessionHandle }).__oakSession.state());

function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Strudel's one error per failed evaluation; Vite's re-optimise.
    if (/\[eval\]|evaluation error|Outdated Optimize Dep|favicon/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return errors;
}

/** Today, loaded and decided (the first visit compiles the route in the dev server: allow for it). */
async function today(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("today-card")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", /.+/, { timeout: 30_000 });
}

/** Enter on Today starts the session; the session page opens (a lost first-compile race is loaded again). */
async function startSession(page: Page): Promise<void> {
  await page.locator("main").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/?$/);
  const header = page.getByTestId("session-header");
  const failed = page.getByRole("heading", { name: "Something went wrong" });
  await expect(header.or(failed)).toBeVisible({ timeout: 60_000 });
  if (await failed.isVisible()) await page.reload();
  await expect(header).toBeVisible({ timeout: 60_000 });
}

/** Counts every time an element with `testId` enters the page (a MutationObserver from the first paint). */
async function countAppearances(page: Page, testId: string): Promise<() => Promise<number>> {
  await page.addInitScript((id) => {
    const w = window as unknown as { __seen?: number };
    w.__seen = 0;
    let present = false;
    new MutationObserver(() => {
      const now = document.querySelector(`[data-testid="${id}"]`) !== null;
      if (now && !present) w.__seen = (w.__seen ?? 0) + 1;
      present = now;
    }).observe(document, { childList: true, subtree: true });
  }, testId);
  return () => page.evaluate(() => (window as unknown as { __seen?: number }).__seen ?? 0);
}

const editorId = (cap: string) => `oak_capstone-${cap}_0_`;
async function setCapstoneCode(page: Page, cap: string, code: string): Promise<void> {
  await page.waitForFunction(
    (id) =>
      !!(globalThis as { __oakStrudel?: { editors: Map<string, unknown> } }).__oakStrudel?.editors.get(id),
    editorId(cap),
    { timeout: 60_000 },
  );
  await page.evaluate(
    ([id, c]) =>
      (
        globalThis as unknown as { __oakStrudel: { editors: Map<string, { setCode(c: string): void }> } }
      ).__oakStrudel.editors
        .get(id as string)
        ?.setCode(c as string),
    [editorId(cap), code],
  );
}

// Session 2's whole piece (the capstone suite's, checked with @oak/grader against the C2 brief): the loop and a
// melody that lands on 1 over I, a perfect authentic cadence.
const C2_FULL = `setcpm(96/4)\n\nchords: n("<[0,2,4] [4,6,8] [5,7,9] [3,5,7] [0,2,4] [4,6,8] [4,6,8] [0,2,4]>").scale("C3:major").s("piano")\nmelody: n("<[4 4 2 ~] [4 4 1 ~] [5 5 2 ~] [3 3 0 ~] [4 4 2 ~] [4 4 1 ~] [4 4 1 ~] [0@4]>").scale("C4:major").s("piano")`;
// Session 1's chords (the capstone suite's): the axis loop twice round and the landing, a melody still to come.
const C2_CHORDS = `setcpm(96/4)\n\nchords: n("<[0,2,4] [4,6,8] [5,7,9] [3,5,7] [0,2,4] [4,6,8] [4,6,8] [0,2,4]>").scale("C3:major").s("piano")\nmelody: n("<0 ~ ~ ~ ~ ~ ~ ~>").scale("C4:major").s("piano")`;

test("U07.CP is offered while U08.L01, before it in the default order, is not written yet", async ({
  page,
  request,
}) => {
  await seed(request, "U07.CP due");
  const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "checkpoint", mapItemId: "U07.CP" });
  await useUiPrefs(page, { theme: "paper" });
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "checkpoint");
  await expect(page.getByRole("heading", { name: "Checkpoint day" })).toBeVisible();
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText("Melody");
  // From U07.L01 the gym is open: an extra session is one of the other ways today.
  await expect(page.getByTestId("other-ways").getByTestId("extra-gym")).toBeVisible();
  await page.goto("/oak?view=tree");
  await expect(page.getByTestId("whats-next")).toContainText("U07.CP");
  await expect(page.getByTestId("whats-next")).not.toContainText("still being written");
});

test("C2 session 1, Today to the Coda: the workspace stays mounted when its draft is bound (keyboard)", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page);
  const resumeSeen = await countAppearances(page, "capstone-resume");
  await seed(request, "C2 open");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const s1 = async (p: Page) => {
    await today(p);
    await expect(p.getByTestId("today-card")).toHaveAttribute("data-state", "capstone");
    await expect(p.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
      "C2 Four-Chord Song · session 1 of 2: Chords",
      { timeout: 20_000 },
    );
  };
  await s1(page);
  await expect(page.getByTestId("today-card")).toContainText("The first of 2 sessions");
  await expect(page.getByTestId("setlist").locator('[data-row="make"]')).toHaveCount(0);
  await matrix(page, "w4-today-c2-s1", s1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await s1(page);
  await startSession(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "C2.S1" });
  await skipWarmup(page);
  const start = page.getByRole("button", { name: "Start session 1 of 2" });
  const ws = page.getByTestId("capstone-workspace");
  await expect(ws.or(start)).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible()) {
    await start.focus();
    await page.keyboard.press("Enter");
  }
  await expect(ws).toBeVisible({ timeout: 60_000 });
  // The chords of session 1: the draft saves and is bound to C2.S1 (now in progress). The workspace stays.
  await setCapstoneCode(page, "C2", C2_CHORDS);
  await expect(page.getByTestId("saved-state")).toContainText(/Version \d+ saved/, { timeout: 30_000 });
  await expect
    .poll(async () => {
      const s = await api<{ sessions: { capstoneSessionId: string; status: string }[] }>(
        request,
        "GET",
        "/api/capstones/C2/sessions",
      );
      return s.sessions.find((x) => x.capstoneSessionId === "C2.S1")?.status;
    })
    .toBe("in_progress");
  await expect(ws).toBeVisible();
  await page.getByTestId("finish-session").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("coda-title")).toBeVisible({ timeout: 30_000 });
  expect(await resumeSeen()).toBe(0);
  const c2 = await api<{ sessions: string[] }>(request, "GET", "/api/capstones/C2");
  expect(c2.sessions).toContain("C2.S1");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w4-coda-c2-s1", "paper");
  expect(errors).toEqual([]);
});

test("C2 session 2: resumed from the top, released, and the release Coda (Quiet mode, reduced motion)", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  // A browser without MediaRecorder releases without a recording: the take (record-take, take-audio) is the
  // capstone suite's (app/src/capstone/e2e/wave4.pw.ts, C2 session 2); this day is about the release reaching the Coda.
  await page.addInitScript(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
  });
  await seed(request, "C2.S1 done");
  // Quiet mode: nothing on a capstone day waits for a voice.
  await api(request, "PUT", "/api/voice/quiet", { quiet: true, scope: "today" });
  await useUiPrefs(page, { theme: "paper", motion: "on" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const s2 = async (p: Page) => {
    await today(p);
    await expect(p.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
      "C2 Four-Chord Song · session 2 of 2: Melody",
      { timeout: 20_000 },
    );
  };
  await s2(page);
  await expect(page.getByTestId("today-card")).toContainText("plays from the top");
  await expect(page.getByTestId("today-card")).toContainText("release it to your album");
  await matrix(page, "w4-today-c2-s2", s2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper", motion: "on" });
  await s2(page);
  await startSession(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "C2.S2" });
  await skipWarmup(page);
  const card = page.getByTestId("capstone-resume");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Session 2 of 2: Melody");
  await expect(card).toContainText(/Bar \d of 8|Play Four-Chord Song/);
  await expect(card).toContainText("Your draft, from the top", { timeout: 20_000 });
  await expect(card).not.toContainText("doesn't run");
  await expect(page.getByTestId("resume-continue")).toBeFocused();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w4-session-c2-resume", "paper");
  await page.keyboard.press("Enter");
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  // The melody as session 2 writes it: every requirement met, the check recorded, released by keyboard. The
  // release ceremony stays on screen (the session never swaps it for the resume card) and leads to the Coda.
  await setCapstoneCode(page, "C2", C2_FULL);
  await expect(page.getByTestId("req-count")).toHaveText("7 of 7 met", { timeout: 60_000 });
  await page.getByTestId("check-track").click();
  await expect(page.getByRole("status").filter({ hasText: /every requirement is met/ })).toBeVisible({
    timeout: 30_000,
  });
  const releaseButton = page.getByTestId("release");
  await expect(releaseButton).toBeEnabled({ timeout: 30_000 });
  await releaseButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Release to the album|Release a new version/ });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByLabel("Title").fill("Four-Chord Song");
  await dialog.getByRole("button", { name: "Release without a recording" }).focus();
  await page.keyboard.press("Enter");
  const ceremony = page.getByTestId("release-ceremony");
  await expect(ceremony).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expect(ceremony).toBeVisible();
  await expect(page.getByTestId("capstone-resume")).toHaveCount(0);
  await ceremony.getByRole("button", { name: "Continue to the coda" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/coda$/);
  const release = page.getByTestId("coda-release");
  await expect(release).toBeVisible({ timeout: 30_000 });
  await expect(release).toContainText("joins your album");
  await expect(release).toContainText(/Side A · track \d+ · version 1/);
  // What you used: the release's theory tags and the code it uses.
  const used = page.getByTestId("coda-used");
  await expect(used).toContainText("scale(", { timeout: 15_000 });
  // X1, from the server's gate: this learner's melodic dictation is already at its level, so C2's release opens it.
  await expect(page.getByTestId("coda-release-next")).toContainText(
    "Next on the album: X1 Folk Transcription",
  );
  await expect(page.getByTestId("coda-release-next")).toContainText("It is open now");
  await expect(release.getByTestId("coda-open-track")).toHaveAttribute("href", /\/album\/trk_/);
  await expect(page.getByTestId("coda-milestone")).toBeVisible();
  const long = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => Number(a.effect?.getComputedTiming().duration ?? 0) > 120 && a.playState === "running")
      .map((a) => (a as CSSAnimation).animationName ?? "?"),
  );
  expect(long).toEqual([]);
  await matrix(page, "w4-coda-release", async (p) => {
    await p.goto("/session/coda");
    await expect(p.getByTestId("coda-release")).toBeVisible({ timeout: 30_000 });
  });
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/session/coda");
  await expect(page.getByTestId("done-for-today")).toBeFocused({ timeout: 20_000 });
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done");
});

test("a capstone in progress is never interrupted by a gym slot", async ({ page, request }) => {
  await seed(request, "C2.S1 done");
  // A plan that puts a gym slot on this day (the planner never does; the rule holds on Today all the same).
  await page.route("**/api/session/today*", async (route) => {
    const real = (await (await route.fetch()).json()) as Record<string, unknown>;
    await route.fulfill({
      json: {
        ...real,
        kind: "gym",
        mapItemId: "GYM.04",
        title: "Transcription Gym: ladder",
        note: null,
        alternatives: [{ kind: "capstone", mapItemId: "C2.S2", title: "C2 Four-Chord Song" }],
      },
    });
  });
  await useUiPrefs(page, { theme: "paper" });
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "capstone");
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText("session 2 of 2", {
    timeout: 20_000,
  });
  await expect(page.getByTestId("gym-explain")).toHaveCount(0);
  await expect(page.getByTestId("other-ways").getByTestId("extra-gym")).toBeVisible();
});

interface Project {
  id: string;
  bpm: number | null;
  gymId?: string | null;
  gradedPass?: boolean;
  versions: unknown[];
  stimulus: { events: NEvent[]; bars: number; cps: number } | null;
}
interface GymPlanBody {
  history: { gymId: string; sessionId: string | null; kind: string; transcriptionId: string | null }[];
  next: { gymId: string } | null;
}

test("a gym day on the graded ladder: gym.start, the item for GYM.01, a graded pass, the ladder Coda", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page);
  await seed(request, "after U07.L03 (gym due)");
  const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.01" });
  await useUiPrefs(page, { theme: "paper" });
  const gymToday = async (p: Page) => {
    await today(p);
    await expect(p.getByTestId("today-card")).toHaveAttribute("data-state", "gym");
    await expect(p.getByTestId("gym-explain")).toBeVisible();
  };
  await gymToday(page);
  await expect(page.getByRole("heading", { name: "Transcription Gym" })).toBeVisible();
  await expect(page.getByTestId("today-card")).toContainText("Every fifth session is a transcription slot");
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "GYM.01 · Ladder, level 1: drum loops · R0",
  );
  await expect(page.getByTestId("gym-explain")).toHaveAttribute("data-kind", "ladder");
  await expect(page.getByTestId("gym-explain")).toContainText("85% or better is a pass");
  // Never a word of loss or failure. "Nothing is lost by resting" (the week's goal met, on a Saturday) is the one
  // calm use of the word and is allowed.
  await expect(page.locator("main")).not.toContainText(/behind|failed|(?<!nothing is )lost/i);
  await matrix(page, "w4-today-gym-ladder", gymToday);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper" });
  await gymToday(page);
  await startSession(page);
  const sessionId = (await sessionState(page)).session?.id;
  await skipWarmup(page);

  // The New block: the gym session starts on the server and its ladder item opens in place.
  const block = page.getByTestId("gym-block");
  await expect(block).toHaveAttribute("data-gym", "GYM.01", { timeout: 60_000 });
  await expect(block).toHaveAttribute("data-kind", "ladder");
  await expect(page.getByTestId("gym-block-title")).toContainText("GYM.01 · Ladder, level 1: drum loops");
  await expect(page.getByTestId("ladder-panel")).toContainText("Level 1", { timeout: 60_000 });
  const gym = await api<GymPlanBody>(request, "GET", "/api/gym");
  const row = gym.history.find((g) => g.gymId === "GYM.01");
  expect(row).toMatchObject({ sessionId, kind: "ladder" });
  const projectId = row?.transcriptionId as string;
  expect(projectId).toBeTruthy();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w4-session-gym-ladder", "paper");

  // A reload resumes the same gym session and item: nothing new starts.
  await page.reload();
  await expect(block).toHaveAttribute("data-gym", "GYM.01", { timeout: 60_000 });
  expect((await api<GymPlanBody>(request, "GET", "/api/gym")).history).toHaveLength(gym.history.length);

  // The groove as heard (written from the stimulus events the page receives), checked: a graded pass.
  const p = await api<Project>(request, "GET", `/api/transcriptions/${projectId}`);
  expect(p.gymId).toBe("GYM.01");
  const st = p.stimulus as NonNullable<Project["stimulus"]>;
  const answer = `setcpm(${Math.round(p.bpm ?? st.cps * 240)}/4)\n\n${stimulusCode(st.events, st.bars).code}\n`;
  await expect(page.getByTestId("check")).toBeEnabled({ timeout: 30_000 });
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(answer);
  await page.getByTestId("check").click();
  await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
  await expect(page.getByTestId("gym-block-made")).toContainText("1 version saved today", {
    timeout: 30_000,
  });
  await page.getByTestId("gym-finish").click();
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  const ladder = page.getByTestId("coda-ladder-today");
  await expect(ladder).toBeVisible({ timeout: 30_000 });
  await expect(ladder).toHaveAttribute("data-passed", "true");
  await expect(ladder).toContainText("Level 1, drum loops, at R0");
  await expect(ladder).toContainText("a graded pass");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w4-coda-gym-ladder", "paper");
  const saved = await api<Project>(request, "GET", `/api/transcriptions/${projectId}`);
  expect(saved.gradedPass).toBe(true);
  // The slot is taken: the next gym session is GYM.02.
  expect((await api<GymPlanBody>(request, "GET", "/api/gym")).next?.gymId ?? "GYM.02").toBe("GYM.02");
  await page.getByTestId("done-for-today").click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done");
  expect(errors).toEqual([]);
});

test("a gym day on the learner's own audio: GYM.02 opens their project, a saved version is the Make", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await seed(request, "own-audio project");
  const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.02" });
  const own = (
    await api<{ items: { id: string; sourceKind: string; title: string }[] }>(
      request,
      "GET",
      "/api/transcriptions",
    )
  ).items.find((t) => t.sourceKind === "own-audio");
  expect(own).toBeTruthy();
  // The dev server bundles the audio player's modules on their first use; with the HMR socket blocked the page
  // would keep the stale copies, so the project page is opened once first (outside the session).
  await page.goto(`/transcribe/${own?.id}`);
  await expect(page.getByTestId("project-title")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  const errors = watch(page);
  await useUiPrefs(page, { theme: "bark" });
  await today(page);
  await expect(page.getByTestId("gym-explain")).toHaveAttribute("data-kind", "own-audio");
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText("your own audio");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w4-today-gym-own", "bark");
  await startSession(page);
  await skipWarmup(page);
  const block = page.getByTestId("gym-block");
  await expect(block).toHaveAttribute("data-gym", "GYM.02", { timeout: 60_000 });
  await expect(block).toHaveAttribute("data-kind", "own-audio");
  await expect(page.getByTestId("project-title")).toContainText(own?.title as string, { timeout: 60_000 });
  const row = (await api<GymPlanBody>(request, "GET", "/api/gym")).history.find((g) => g.gymId === "GYM.02");
  expect(row).toMatchObject({ kind: "own-audio", transcriptionId: own?.id });
  await expect(page.getByTestId("gym-block-made")).toContainText("Save a version");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w4-session-gym-own", "bark");
  await page.getByTestId("save-version").click();
  await expect(page.getByTestId("gym-block-made")).toContainText("1 version saved today", {
    timeout: 30_000,
  });
  await page.getByTestId("gym-finish").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("done-for-today")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("C2 released, X1 waits on melodic dictation: a gym day, 'Two more gym sets open X1', the album strip", async ({
  page,
  request,
}) => {
  await seed(request, "C2 released");
  const plan = await api<{ kind: string; note: string | null }>(request, "GET", "/api/session/today");
  // Nothing else waits for X1: a gym day while U08.L02 was unwritten; since Wave 5 wrote it, that lesson's day.
  expect(["gym", "lesson"]).toContain(plan.kind);
  if (plan.kind === "gym") expect(plan.note).toBe("Two more gym sets open X1");
  await useUiPrefs(page, { theme: "paper" });
  const open = async (p: Page) => {
    await today(p);
    await expect(p.getByTestId("x1-gate")).toBeVisible();
  };
  await open(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute(
    "data-state",
    plan.kind === "gym" ? "gym" : "normal",
  );
  await expect(page.getByTestId("x1-gate")).toContainText("Two more gym sets open X1");
  await expect(page.getByTestId("x1-gate")).toContainText("level 3 now, 4 opens it");
  await expect(page.getByTestId("x1-gate")).toContainText("nothing else waits for X1");
  // The album strip: C1 and C2 released, X1 the next slot to fill.
  const strip = page.getByTestId("album-strip");
  await expect(strip.getByRole("link", { name: /released/ })).toHaveCount(2);
  await expect(strip).toContainText("X1 Folk Transcription");
  await matrix(page, "w4-today-x1-waits", open);
});

test("X1 session 1, Today to the Coda: the song chosen, both phrases revealed, the session finished", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page);
  await seed(request, "X1 open");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "capstone");
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "X1 Folk Transcription · session 1 of 3",
    { timeout: 20_000 },
  );
  await startSession(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "X1.S1" });
  await skipWarmup(page);
  const ws = page.getByTestId("capstone-workspace");
  const start = page.getByRole("button", { name: "Start session 1 of 3" });
  await expect(ws.or(start)).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible()) {
    await page.getByRole("radiogroup", { name: "The song" }).getByRole("radio", { name: "Aura Lee" }).click();
    await start.click();
  }
  await expect(ws).toHaveAttribute("data-kind", "transcribe", { timeout: 60_000 });
  await expect(page.getByTestId("x1-song")).toContainText("Aura Lee");
  for (const id of ["phrase-1", "phrase-2"]) {
    const row = page.locator(`[data-check="${id}"]`);
    await row.getByRole("button", { name: /^Reveal / }).click();
    await row.getByTestId("confirm-reveal").click();
    await expect(row).toHaveAttribute("data-state", "revealed", { timeout: 60_000 });
  }
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w4-session-x1-s1", "paper");
  await page.getByTestId("finish-session").click();
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("coda-title")).toBeVisible({ timeout: 30_000 });
  const x1 = await api<{ sessions: string[] }>(request, "GET", "/api/capstones/X1");
  expect(x1.sessions).toContain("X1.S1");
  expect(errors).toEqual([]);
});

test("X1 session 3: Today names the checks so far; the transcription resumes from the top", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await seed(request, "X1.S2 done");
  await useUiPrefs(page, { theme: "bark" });
  const s3 = async (p: Page) => {
    await today(p);
    await expect(p.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
      "X1 Folk Transcription · session 3 of 3",
      { timeout: 20_000 },
    );
  };
  await s3(page);
  await expect(page.getByTestId("capstone-checks")).toContainText(/revealed/i);
  await matrix(page, "w4-today-x1-s3", s3);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "bark" });
  await s3(page);
  await startSession(page);
  await skipWarmup(page);
  const card = page.getByTestId("capstone-resume");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Session 3 of 3");
  await expect(page.getByTestId("resume-continue")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("capstone-workspace")).toHaveAttribute("data-kind", "transcribe", {
    timeout: 60_000,
  });
  await toCoda(page);
  await page.waitForURL(/\/session\/coda$/);
  await expect(page.getByTestId("done-for-today")).toBeVisible({ timeout: 30_000 });
});

test("past X1: the edge of what's written — a review day with Studio and the gym, never a dead end", async ({
  page,
  request,
}) => {
  await seed(request, "X1 released");
  const plan = await api<{ kind: string; note: string | null }>(request, "GET", "/api/session/today");
  // Wave 5 writes U08: the day after X1 is a lesson again, and the edge moves to after X2 (w5-today.pw.ts).
  test.skip(plan.kind !== "review", "U08 is written now: the edge of the written course is past X2");
  expect(plan.kind).toBe("review");
  await useUiPrefs(page, { theme: "paper" });
  const open = async (p: Page) => {
    await today(p);
    await expect(p.getByTestId("today-card")).toHaveAttribute("data-state", "edge");
  };
  await open(page);
  const card = page.getByTestId("today-card");
  await expect(card.getByRole("heading", { name: "The edge of what's written" })).toBeVisible();
  await expect(card).toContainText("Bass Lines is still being written");
  await expect(card).toContainText("Studio and the Transcription Gym are yours");
  await expect(page.getByTestId("start-session")).toBeVisible();
  const other = page.getByTestId("other-ways");
  await expect(other.getByTestId("extra-gym")).toBeVisible();
  await expect(other.getByRole("link", { name: "Studio" })).toHaveCount(1);
  await expect(other.getByRole("link", { name: "Practice" })).toHaveAttribute("href", "/practice");
  await expect(page.locator("main")).not.toContainText(/behind|failed|(?<!nothing is )lost|error/i);
  // Three album tracks now: C0 or C1, C2 and X1.
  await expect(page.getByTestId("album-strip")).toContainText("X1");
  await matrix(page, "w4-today-edge-x1", open);
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/oak?view=tree");
  await expect(page.getByTestId("whats-next")).toContainText("still being written");
  // The review day runs: Today → the session → the Coda, which says what comes next.
  await today(page);
  await startSession(page);
  await skipWarmup(page);
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("done-for-today")).toBeVisible({ timeout: 30_000 });
});
