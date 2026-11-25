// Wave 5 Codas and capstone days on the real server, each from a dev seed (wave5.md §6): the own-audio gym Coda's
// own card, the ladder level-up and the realism change announced once (carry-over c10), C3 over three sessions as
// consecutive New blocks resuming from the top with its release naming the album's next track, X2's staged checks,
// and gym days on ladder L5 and L6 from Today to their Coda. Nothing is filled or patched: `SessionSummary.gym` and every
// other Wave 5 field is the server's own, and every seed point must exist.
import type { NEvent } from "@oak/content-kit";
import { expect, type Page, test } from "@playwright/test";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { C3_FULL, C3_GROOVE } from "../../../capstone/e2e/w5-pieces.ts";
import { stimulusCode } from "../../../transcribe/stimulus-code.ts";
import { advanceDays, api, blockHmr, expectNoOverflow, matrix, SHOTS, seed, settle } from "./support.ts";
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

type GymBody = {
  history: { gymId: string; kind: string; transcriptionId: string | null; sessionId: string }[];
};

interface Project {
  id: string;
  bpm: number | null;
  stimulus: { events: NEvent[]; bars: number; cps: number } | null;
}

/**
 * From Today through the gym block to the Coda. `mode`: "save" saves a version (own audio), "pass" writes the ladder
 * item down as heard (from the stimulus events the page receives) and checks it — a graded pass, as the server's
 * level-up and realism rules need — and "leave" finishes with nothing saved (the Make is then the quick sketch).
 */
async function gymToCoda(
  page: Page,
  mode: "save" | "pass" | "leave",
  request?: Parameters<typeof api>[0],
  via: "today" | "extra" = "today",
): Promise<void> {
  await openToday(page);
  if (via === "today") {
    await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "gym");
    await startByEnter(page);
  } else {
    // Today's own session is done: "An extra gym session" from the done card.
    await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done");
    await page.getByTestId("extra-gym").first().click();
    await sessionPage(page);
  }
  const sessionId = (await sessionState(page)).session?.id;
  await skipWarmup(page);
  await expect(page.getByTestId("gym-block")).toBeVisible({ timeout: 60_000 });
  if (mode === "save") {
    await page.getByTestId("save-version").click();
    await expect(page.getByTestId("gym-block-made")).toContainText("1 version saved today", {
      timeout: 30_000,
    });
  }
  if (mode === "pass" && request) {
    await expect
      .poll(async () =>
        (await api<GymBody>(request, "GET", "/api/gym")).history.some((g) => g.sessionId === sessionId),
      )
      .toBe(true);
    const row = (await api<GymBody>(request, "GET", "/api/gym")).history.find(
      (g) => g.sessionId === sessionId,
    );
    const p = await api<Project>(request, "GET", `/api/transcriptions/${row?.transcriptionId}`);
    const st = p.stimulus as NonNullable<Project["stimulus"]>;
    // Only the part the level grades, on the track the grader reads (bass at L2, melody at L4); the other parts a
    // fuller mix adds at R2 and up are not written down.
    const level = (await api<{ level: number }>(request, "GET", "/api/ladder")).level;
    const graded =
      level === 2
        ? { ref: "ref_bass", label: "bass" }
        : level === 4
          ? { ref: "ref_mel", label: "melody" }
          : null;
    const { code } = stimulusCode(st.events, st.bars);
    const body = graded
      ? code
          .split("\n")
          .filter(
            (l) => !/^ref_\w+:/.test(l) || l.startsWith(`${graded.ref}:`) || l.startsWith(`${graded.ref}_`),
          )
          .map((l) => l.replace(/^ref_\w+:/, `${graded.label}:`))
          // At R3+ the reference plays on a sound the learner may not have unlocked (vibes, …): the pitches and
          // rhythm are what is graded, so the answer is written on the piano, as a learner would.
          .map((l) => (/^(bass|melody):\s*note\(/.test(l) ? l.replace(/\.s\("[^"]*"\)/, '.s("piano")') : l))
          .join("\n")
      : code
          .split("\n")
          .map((l) => l.replace(/^ref_(\w+?)(_\d+)?:/, (_m, t: string, n?: string) => `${t}${n ?? ""}:`))
          .join("\n");
    const answer = `setcpm(${Math.round(p.bpm ?? st.cps * 240)}/4)\n\n${body}\n`;
    await expect(page.getByTestId("check")).toBeEnabled({ timeout: 30_000 });
    await page.locator(".cm-content").first().click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText(answer);
    await page.getByTestId("check").click();
    await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
    await expect(page.getByTestId("gym-block-made")).toContainText("1 version saved today", {
      timeout: 30_000,
    });
  }
  await page.getByTestId("gym-finish").focus();
  await page.keyboard.press("Enter");
  // Without a saved version the gym day's Make is the quick sketch (contracts §9.1): skipped here.
  if (mode === "leave") {
    await expect(page.getByRole("region", { name: "Quick sketch" })).toBeVisible({ timeout: 30_000 });
    await toCoda(page);
  }
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("done-for-today")).toBeVisible({ timeout: 30_000 });
}

test("the own-audio gym Coda has its own card: versions, bars, the checklist as scored (c10, keyboard)", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await seed(request, "own-audio project");
  const own = (
    await api<{ items: { id: string; sourceKind: string; title: string }[] }>(
      request,
      "GET",
      "/api/transcriptions",
    )
  ).items.find((t) => t.sourceKind === "own-audio");
  expect(own).toBeTruthy();
  // The audio player's modules are bundled on first use; with the HMR socket blocked, open the project once first.
  await page.goto(`/transcribe/${own?.id}`);
  await expect(page.getByTestId("project-title")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  const errors = watch(page);
  await useUiPrefs(page, { theme: "paper" });
  await gymToCoda(page, "save");
  const card = page.getByTestId("coda-own-audio");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText(own?.title ?? "");
  await expect(page.getByTestId("coda-own-audio-line")).toContainText(/\d+ versions? saved/);
  await expect(card.locator('[data-row="contour"]')).toContainText("yes");
  await expect(card).toContainText("It is your own judgement, and it counts.");
  await expect(card).toContainText("never graded");
  // An own-audio day has no ladder card.
  await expect(page.getByTestId("coda-ladder")).toHaveCount(0);
  await expect(page.getByTestId("coda-own-audio-open")).toHaveAttribute("href", `/transcribe/${own?.id}`);
  await matrix(page, "w5-coda-own-audio", async (p) => {
    await p.goto("/session/coda");
    await expect(p.getByTestId("coda-own-audio")).toBeVisible({ timeout: 30_000 });
  });
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/session/coda");
  await expect(page.getByTestId("done-for-today")).toBeFocused({ timeout: 20_000 });
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === "/");
  // The card is the server's own `summary.gym` (c10).
  const day = await api<{ summarySessionId: string | null }>(request, "GET", "/api/session/day");
  const summary = await api<{ gym?: { kind: string; ownAudio: { versionsToday: number } | null } | null }>(
    request,
    "GET",
    `/api/session/${day.summarySessionId}/summary`,
  );
  expect(summary.gym).toMatchObject({ kind: "own-audio", ownAudio: { versionsToday: 1 } });
  expect(errors).toEqual([]);
});

test("the ladder level-up Coda: earned by the second graded pass, offered once, taken with one button (c10)", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  // Ladder L1 at R2 with no graded pass at R2 yet (the "ladder level-up due" seed earned its offer on its own last
  // day, so no session of today could announce it): two days of graded L1 passes at R2 open L2 in the browser.
  // U09.L03: the day before GYM.05 since Oak 2.0 W2 moved the gym slots (decision 103; it was U09.L04).
  await seed(request, "after U09.L03");
  const before = await api<{ level: number; realism: number; levelUp: unknown }>(
    request,
    "GET",
    "/api/ladder",
  );
  expect(before).toMatchObject({ level: 1, levelUp: null });
  expect(before.realism).toBeGreaterThanOrEqual(2);
  const to = before.level + 1;
  const errors = watch(page);
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  // Day 1: GYM.05, a graded pass. One pass is not yet a level-up: no card.
  await gymToCoda(page, "pass", request);
  await expect(page.getByTestId("coda-ladder-today")).toHaveAttribute("data-passed", "true", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("coda-level-up")).toHaveCount(0);
  // Day 2: the lesson day's own session, then an extra gym session whose graded pass earns the offer.
  await advanceDays(request, 1);
  await openToday(page);
  await startByEnter(page);
  await skipWarmup(page);
  await toCoda(page);
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("done-for-today")).toBeVisible({ timeout: 30_000 });
  await gymToCoda(page, "pass", request, "extra");
  const day = await api<{ summarySessionId: string | null }>(request, "GET", "/api/session/day");
  const summary = await api<{ gym?: { ladder: { levelUp: { to: number } | null } | null } | null }>(
    request,
    "GET",
    `/api/session/${day.summarySessionId}/summary`,
  );
  expect(summary.gym?.ladder?.levelUp).toMatchObject({ to });
  const offer = page.getByTestId("coda-level-up");
  await expect(offer).toBeVisible({ timeout: 30_000 });
  await expect(offer).toHaveCount(1);
  await expect(offer).toContainText(`Level ${to} is open`);
  await expect(offer).toContainText("starts clean, at R0");
  await expect(offer).toContainText(`On level ${to} you hear`);
  await expect(page.getByTestId("stay-level")).toBeVisible();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-coda-level-up", "bark");
  // The server offered it: taking it (keyboard) moves the ladder.
  await page.getByTestId("take-level").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("coda-level-taken")).toContainText(`Level ${to}`, { timeout: 20_000 });
  expect((await api<{ level: number }>(request, "GET", "/api/ladder")).level).toBe(to);
  // Announced once: the Coda read again offers it no more.
  await page.goto("/session/coda");
  await expect(page.getByTestId("done-for-today")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("coda-level-up")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a realism change is announced once in the Coda, never mid-item (c10)", async ({ page, request }) => {
  test.setTimeout(240_000);
  await seed(request, "ladder realism-up due");
  const before = await api<{ level: number; realism: number }>(request, "GET", "/api/ladder");
  expect(before).toMatchObject({ level: 2, realism: 1 });
  const errors = watch(page);
  await useUiPrefs(page, { theme: "paper" });
  await openToday(page);
  // Today names the realism the session plays at; nothing announces a change before the Coda.
  await expect(page.getByTestId("gym-explain")).toContainText("Realism R1");
  await expect(page.locator("main")).not.toContainText(/now plays at R/);
  await gymToCoda(page, "pass", request);
  const callout = page
    .getByRole("status")
    .or(page.locator("[role=note]"))
    .filter({ hasText: "now plays at R" });
  await expect(page.locator("main")).toContainText("now plays at R2", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("The grading stays the same.");
  expect(await callout.count()).toBeLessThanOrEqual(1);
  expect((await api<{ realism: number }>(request, "GET", "/api/ladder")).realism).toBe(2);
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-coda-realism", "paper");
  expect(errors).toEqual([]);
});

/** Today → Enter → past the warm-up → the capstone's workspace (its own session started when it asks). */
async function capstoneWorkspace(page: Page, session: number, of: number): Promise<void> {
  await startByEnter(page);
  await skipWarmup(page);
  const start = page.getByRole("button", { name: `Start session ${session} of ${of}` });
  const resume = page.getByTestId("resume-continue");
  const ws = page.getByTestId("capstone-workspace");
  await expect(ws.or(start).or(resume)).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible()) {
    await start.focus();
    await page.keyboard.press("Enter");
  }
  if (await resume.isVisible()) {
    await resume.focus();
    await page.keyboard.press("Enter");
  }
  await expect(ws).toBeVisible({ timeout: 60_000 });
}

/** Finishes a capstone session that does not release: the Coda opens and names the next session. */
async function finishCapstoneSession(page: Page): Promise<void> {
  await expect(page.getByTestId("saved-state")).toContainText(/Version \d+ saved/, { timeout: 30_000 });
  await page.getByTestId("finish-session").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("done-for-today")).toBeFocused({ timeout: 30_000 });
}

test("C3 day 1, Today to the Coda: four sessions named (d13), groove and changes saved, session 2 next", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "C3 open");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const s1 = async (p: Page) => {
    await openToday(p);
    await expect(p.getByTestId("today-card")).toHaveAttribute("data-state", "capstone");
    await expect(p.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
      "C3 Verse–Chorus Demo · session 1 of 4: Groove & changes",
      { timeout: 20_000 },
    );
  };
  await s1(page);
  await expect(page.getByTestId("today-card")).toContainText("The first of 4 sessions");
  // A capstone day carries no side-lesson offer (wave5.md §5.1).
  await expect(page.getByTestId("side-offer")).toHaveCount(0);
  await matrix(page, "w5-today-c3-s1", s1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await s1(page);
  await capstoneWorkspace(page, 1, 4);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "C3.S1" });
  await setCapstoneCode(page, "C3", C3_GROOVE);
  await expect(page.getByTestId("form-letters")).toHaveText("A B A B", { timeout: 60_000 });
  await finishCapstoneSession(page);
  const c3 = await api<{ sessions: string[] }>(request, "GET", "/api/capstones/C3");
  expect(c3.sessions).toContain("C3.S1");
  await expect(page.getByTestId("coda-tomorrow")).toContainText("C3 Verse–Chorus Demo · session 2");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-coda-c3-s1", "paper");
  expect(errors).toEqual([]);
});

test("C3 day 2, Today to the Coda: the draft resumes from the top, session 3 next", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "after C3.S1");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await openToday(page);
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "C3 Verse–Chorus Demo · session 2 of 4",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("today-card")).toContainText("plays from the top");
  await capstoneWorkspace(page, 2, 4);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "C3.S2" });
  // Session 2 writes the melodies over the groove.
  await setCapstoneCode(page, "C3", C3_FULL);
  await finishCapstoneSession(page);
  const c3 = await api<{ sessions: string[] }>(request, "GET", "/api/capstones/C3");
  expect(c3.sessions).toContain("C3.S2");
  await expect(page.getByTestId("coda-tomorrow")).toContainText("C3 Verse–Chorus Demo · session 3");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-coda-c3-s2", "bark");
  expect(errors).toEqual([]);
});

test("C3 day 3, Today to the Coda: resumed from the top, arranged; it no longer releases, session 4 is next (d13)", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "C3.S2 done");
  const sessions = await api<{ sessions: { draft: unknown }[] }>(
    request,
    "GET",
    "/api/capstones/C3/sessions",
  );
  // Contracts 1.6: C3 has four sessions; the drafts of S1 and S2 are there to resume from.
  expect(sessions.sessions).toHaveLength(4);
  expect(sessions.sessions.some((x) => x.draft !== null)).toBe(true);
  const s3 = async (p: Page) => {
    await openToday(p);
    await expect(p.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
      "C3 Verse–Chorus Demo · session 3 of 4: Arrange",
      { timeout: 20_000 },
    );
  };
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await s3(page);
  await expect(page.getByTestId("today-card")).toContainText("plays from the top");
  // The third session arranges; the take and the release are the fourth's.
  await expect(page.getByTestId("today-card")).toContainText("carries on from where the draft stands");
  await expect(page.getByTestId("today-card")).not.toContainText("release it to your album");
  await matrix(page, "w5-today-c3-s3", s3);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await s3(page);
  await startByEnter(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "C3.S3" });
  await skipWarmup(page);
  const card = page.getByTestId("capstone-resume");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Session 3 of 4");
  await expect(card).toContainText("Your draft, from the top", { timeout: 20_000 });
  await expect(page.getByTestId("resume-continue")).toBeFocused();
  await expect(page.getByTestId("resume-continue")).toContainText("On to session 3: Arrange");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-session-c3-resume", "paper");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  await setCapstoneCode(page, "C3", C3_FULL);
  await finishCapstoneSession(page);
  const c3 = await api<{ sessions: string[] }>(request, "GET", "/api/capstones/C3");
  expect(c3.sessions).toContain("C3.S3");
  // Nothing was released today: no release card, and tomorrow is the take.
  await expect(page.getByTestId("coda-release")).toHaveCount(0);
  await expect(page.getByTestId("coda-tomorrow")).toContainText(
    "C3 Verse–Chorus Demo · session 4 of 4: Take & release",
  );
  expect(errors).toEqual([]);
});

test("C3 day 4, Today to the Coda: the last session releases; the album grows and names C4 (d13)", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page, [/\/api\/tutor/]);
  // A browser without MediaRecorder releases without a recording (the take is the capstone suite's): this day is
  // about the release reaching the Coda.
  await page.addInitScript(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
  });
  // `C3.S3 done`: C3.S1–S3 completed with the arranged draft and the lead-sheet check passed; today is C3.S4.
  await seed(request, "C3.S3 done");
  const s4 = async (p: Page) => {
    await openToday(p);
    await expect(p.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
      "C3 Verse–Chorus Demo · session 4 of 4: Take & release",
      { timeout: 20_000 },
    );
  };
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await s4(page);
  await expect(page.getByTestId("today-card")).toContainText("plays from the top");
  await expect(page.getByTestId("today-card")).toContainText("release it to your album");
  await startByEnter(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "C3.S4" });
  await skipWarmup(page);
  const card = page.getByTestId("capstone-resume");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Session 4 of 4");
  await expect(page.getByTestId("resume-continue")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("req-count")).toHaveText(/^(\d+) of \1 met$/, { timeout: 90_000 });
  await page.getByTestId("check-track").click();
  await expect(page.getByRole("status").filter({ hasText: /every requirement is met/ })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId("release")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("release").click();
  const dialog = page.getByRole("dialog", { name: /Release to the album/ });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByLabel("Title").fill("Verse–Chorus Demo");
  await dialog.getByRole("button", { name: "Release without a recording" }).click();
  const ceremony = page.getByTestId("release-ceremony");
  await expect(ceremony).toBeVisible({ timeout: 30_000 });
  await ceremony.getByRole("button", { name: "Continue to the coda" }).click();
  await page.waitForURL(/\/session\/coda$/);
  const release = page.getByTestId("coda-release");
  await expect(release).toBeVisible({ timeout: 30_000 });
  await expect(release).toContainText("joins your album");
  await expect(page.getByTestId("coda-release-next")).toHaveAttribute("data-next", "C4");
  await expect(page.getByTestId("coda-release-next")).toContainText(
    "Next on the album: C4 Minor Indie Ballad.",
  );
  await expect(page.getByTestId("coda-album-count")).toContainText(/Your album now holds \d+ tracks\./);
  await matrix(page, "w5-coda-release-c3", async (p) => {
    await p.goto("/session/coda");
    await expect(p.getByTestId("coda-release")).toBeVisible({ timeout: 30_000 });
  });
  expect(errors).toEqual([]);
});

// C4 as session 2 writes it (the capstones author's "pop" reference, content/capstones.ts): verse on the Aeolian loop
// i–VI–III–VII with a tune that sings C (♭3) and F (♭6), the chorus iv–VII–V–i (Dm G E Am, E with its G♯) landing
// on A over Am, one arrange() per labelled track, 80 BPM; verse and chorus once each (the author's "minimal" plan).
const C4_FULL =
  'setcpm(80/4)\n\nconst kickVerse = s("bd ~ ~ ~")\nconst kickChorus = s("bd ~ bd ~")\nconst snareVerse = s("~ ~ sd ~")\nconst snareChorus = s("~ sd ~ sd")\nconst hatsVerse = s("hh*4").gain(.4)\nconst hatsChorus = s("hh*8").gain(.45)\nconst chordsVerse = chord("<Am F C G>").voicing()\nconst chordsChorus = chord("<Dm G E Am>").voicing()\nconst bassVerse = n("<0 5 2 6>").scale("A1:minor")\nconst bassChorus = n("<3 6 4 0>").scale("A1:minor")\nconst melVerse = n("<[4 ~ 2 ~] [5 ~ 7 ~] [4 ~ 2 ~] [1 ~ ~ ~]>").scale("A3:minor")\nconst melChorus = n("<[3 5 7 5] [6 8 10 8] [8 ~ 4 ~] [7 ~ ~ ~]>").scale("A3:minor")\n\nkick: arrange([8, kickVerse], [8, kickChorus])\nsnare: arrange([8, snareVerse], [8, snareChorus])\nhats: arrange([8, hatsVerse], [8, hatsChorus])\nchords: arrange([8, chordsVerse], [8, chordsChorus]).s("piano")\nbass: arrange([8, bassVerse], [8, bassChorus]).s("ebass").lpf(600)\nmel: arrange([8, melVerse], [8, melChorus]).s("piano")';

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

test("a C4 release: the album grows, and the Coda names the next track and what opens it", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors = watch(page, [/\/api\/tutor/]);
  // A browser without MediaRecorder releases without a recording, as C3 day 3 does: the take (record-take,
  // take-audio) is the capstone suite's (app/src/capstone/e2e/w5-c4-c5.pw.ts, C4); this day is about the release
  // reaching the Coda.
  await page.addInitScript(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
  });
  await seed(request, "after C4.S1");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openToday(page);
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "C4 Minor Indie Ballad · session 2 of 2: Chorus cadence",
    { timeout: 20_000 },
  );
  await startByEnter(page);
  await skipWarmup(page);
  const start = page.getByRole("button", { name: "Start session 2 of 2" });
  const resume = page.getByTestId("resume-continue");
  const ws = page.getByTestId("capstone-workspace");
  await expect(ws.or(start).or(resume)).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible()) await start.click();
  if (await resume.isVisible()) await resume.click();
  await expect(ws).toBeVisible({ timeout: 60_000 });
  await setCapstoneCode(page, "C4", C4_FULL);
  await expect(page.getByTestId("req-count")).toHaveText(/^(\d+) of \1 met$/, { timeout: 60_000 });
  await page.getByTestId("check-track").click();
  await expect(page.getByRole("status").filter({ hasText: /every requirement is met/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("release")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("release").click();
  const dialog = page.getByRole("dialog", { name: /Release to the album|Release a new version/ });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByLabel("Title").fill("Minor Indie Ballad");
  await dialog.getByRole("button", { name: "Release without a recording" }).click();
  const ceremony = page.getByTestId("release-ceremony");
  await expect(ceremony).toBeVisible({ timeout: 30_000 });
  await ceremony.getByRole("button", { name: "Continue to the coda" }).click();
  await page.waitForURL(/\/session\/coda$/);
  const release = page.getByTestId("coda-release");
  await expect(release).toBeVisible({ timeout: 30_000 });
  await expect(release).toContainText("joins your album");
  await expect(page.getByTestId("coda-release-next")).toHaveAttribute("data-next", "C5");
  await expect(page.getByTestId("coda-release-next")).toContainText("Next on the album: C5 12-Bar Shuffle.");
  await expect(page.getByTestId("coda-release-next")).toContainText("It opens after the Blues checkpoint.");
  await expect(page.getByTestId("coda-album-count")).toContainText(/Your album now holds \d+ tracks\./);
  await matrix(page, "w5-coda-release-c4", async (p) => {
    await p.goto("/session/coda");
    await expect(p.getByTestId("coda-release")).toBeVisible({ timeout: 30_000 });
  });
  // Seeded drafts are saved without the starter's "⟪…⟫" slots (wave5.md §5): playing one from the top is clean.
  expect(errors).toEqual([]);
});

test("X2 session 2: Today names the stages passed; the transcription resumes from the top", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watch(page, [/\/api\/tutor/]);
  await seed(request, "X2.S1 done");
  await useUiPrefs(page, { theme: "paper" });
  await openToday(page);
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "X2 Blues Transcription · session 2 of 2: Melody",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("capstone-checks")).toContainText("The bass passed at");
  await expect(page.getByTestId("capstone-checks")).toContainText("next, the melody line by line");
  await expect(page.getByTestId("today-card")).toContainText("Your transcription plays from the top first");
  await matrix(page, "w5-today-x2-s2", async (p) => {
    await openToday(p);
    await expect(p.getByTestId("capstone-checks")).toBeVisible({ timeout: 20_000 });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper" });
  await openToday(page);
  await startByEnter(page);
  expect((await sessionState(page)).plan).toMatchObject({ kind: "capstone", mapItemId: "X2.S2" });
  await skipWarmup(page);
  const card = page.getByTestId("capstone-resume");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Session 2 of 2");
  await expect(page.getByTestId("resume-continue")).toBeFocused();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-session-x2-resume", "paper");
  expect(errors).toEqual([]);
});

/** Today → the gym block (Enter, or the extra gym session beside a capstone day) → finished as it is → the Coda. */
async function gymDayToCoda(page: Page, via: "today" | "extra"): Promise<void> {
  if (via === "today") await startByEnter(page);
  else {
    await page.getByTestId("other-ways").getByTestId("extra-gym").click();
    await page.waitForURL(/\/session\/?$/);
    await expect(page.getByTestId("session-header")).toBeVisible({ timeout: 60_000 });
  }
  expect((await sessionState(page)).plan).toMatchObject({ kind: "gym" });
  await skipWarmup(page);
  await expect(page.getByTestId("gym-block")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("gym-finish").focus();
  await page.keyboard.press("Enter");
  // Nothing saved: the gym day's Make is the quick sketch (contracts §9.1), left for the Coda.
  await expect(page.getByRole("region", { name: "Quick sketch" })).toBeVisible({ timeout: 30_000 });
  await toCoda(page);
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  await expect(page.getByTestId("done-for-today")).toBeVisible({ timeout: 30_000 });
}

test("a gym day on ladder L5: the folk song and its next phrase, explained, and its Coda", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watch(page);
  await seed(request, "ladder L5");
  const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.07" });
  await useUiPrefs(page, { theme: "paper" });
  const open = async (p: Page) => {
    await openToday(p);
    await expect(p.getByTestId("gym-explain")).toBeVisible({ timeout: 20_000 });
  };
  await open(page);
  const row = page.getByTestId("setlist").locator('[data-row="new"]');
  await expect(row).toContainText("level 5: folk songs");
  // The song by name and the phrase that comes next (GET /ladder/songs), never "a generated piece".
  await expect(row).toContainText(/Aura Lee: phrase 2 of \d+ next/, { timeout: 20_000 });
  await expect(page.getByTestId("gym-explain")).toContainText("Each phrase is graded on its own");
  await matrix(page, "w5-today-gym-l5", open);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper" });
  await open(page);
  await gymDayToCoda(page, "today");
  const today = page.getByTestId("coda-ladder-today");
  await expect(today).toBeVisible({ timeout: 30_000 });
  await expect(today).toContainText("Level 5, folk songs");
  await expect(today).toContainText("Aura Lee");
  await expect(page.getByTestId("coda-level-up")).toHaveCount(0);
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-coda-gym-l5", "paper");
  expect(errors).toEqual([]);
});

test("ladder L6 beside X2: the blues gym as another way today, its stages explained, and its Coda", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors = watch(page);
  await seed(request, "ladder L6");
  const ladder = await api<{ level: number }>(request, "GET", "/api/ladder");
  expect(ladder.level).toBe(6);
  const songs = await api<{ items: { title: string; level: number; passedStages: string[] }[] }>(
    request,
    "GET",
    "/api/ladder/songs",
  );
  const started = songs.items.find((x) => x.level === 6 && x.passedStages.includes("bass"));
  expect(started?.title).toBeTruthy();
  await useUiPrefs(page, { theme: "bark" });
  await openToday(page);
  // Today is X2's first session; the gym waits beside it, never instead of it.
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "X2 Blues Transcription",
  );
  await expect(page.getByTestId("other-ways").getByTestId("extra-gym")).toBeVisible();
  await gymDayToCoda(page, "extra");
  const today = page.getByTestId("coda-ladder-today");
  await expect(today).toBeVisible({ timeout: 30_000 });
  await expect(today).toContainText("Level 6, blues");
  await expect(today).toContainText(started?.title as string);
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w5-coda-gym-l6", "bark");
  expect(errors).toEqual([]);
});
