// Wave 5 journeys (a), (b), (c), (e: the day), (f: the day), (h), (i) and (j: the U08 and U10 days in Quiet mode):
// real daily sessions on the real stack (real server, real content, the scripted fake tutor, Chrome's fake
// microphone), each from a dev seed (wave5.md §6), each Today → the warm-up (reported skipped: gate journey 2 and
// the session-seeds days walk the sets) → the New block → the Coda.
//   (a) "after GYM.03": U08.L01 Roots Down Low (it comes after GYM.03 and before U07.CP and C2 in the default order). The Make is a bass line on the roots under the learner's four-chord loop.
//   (b) "after U09.L01": U09.L02. The form map opens in the step, the sections read A B A B …, and a section loops
//       from the map and from the ribbon by keyboard.
//   (c) "U09.CP due": the Bass & form checkpoint to a pass (sung items left out: they never gate).
//   (e) "after U10.L03": U10.L04, with the minor-degree set (fam.deg.fet-minor, do-based: ♭3 is me) in today's
//       warm-up plan. The set itself (its way home sung, or heard and imagined in Quiet mode) is walked by
//       session-seeds w5-warmups.pw.ts from the same seed; here the warm-up is reported skipped.
//   (f) "after U11.L06": U11.L07. The shuffle: the hats swing (the transport's "Swing 8ths" badge).
//   (h) "side lesson offered": A1.L01 taken from Today's side offer at U03; its scope panel opens in the step and
//       hears the wave; the core lesson stays today's.
//   (i) "ladder L6": the extra gym session beside X2.S1 on ladder L6: the changes stage passed in the session.
//   (j) (a) and (e) again in Quiet mode: nothing asks for the microphone, nothing waits for a voice.

import type { NEvent } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { fakeMic } from "../../app/src/onboarding/e2e/helpers.ts";
import { layerOfTrack, withChanges } from "../../app/src/transcribe/song.ts";
import { stimulusCode } from "../../app/src/transcribe/stimulus-code.ts";
import a1l01 from "../../content/advanced/A1/L01/lesson.ts";
import u08l01 from "../../content/core/U08/L01/lesson.ts";
import u09l02 from "../../content/core/U09/L02/lesson.ts";
import u10l04 from "../../content/core/U10/L04/lesson.ts";
import u11l07 from "../../content/core/U11/L07/lesson.ts";
import { useUiPrefs as setUiPrefs } from "../support/ui.ts";
import { coda, lessonDay, startToday } from "./day.ts";
import { walkLesson } from "./lesson-walk.ts";
import { api, expectClean, noHmr, resetClock, shootAll, type Watch, watch } from "./support.ts";
import { sessionState, skipWarmup, startSession, today } from "./w4-day.ts";

test.use({ launchOptions: { args: fakeMic("voice.wav") }, permissions: ["microphone"] });
test.describe.configure({ mode: "serial" });

/** Counts every request for the microphone the page makes (Quiet mode must make none). */
async function countMicRequests(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    if (!md) return;
    const orig = md.getUserMedia.bind(md);
    (window as unknown as { __oakMicAsks: number }).__oakMicAsks = 0;
    md.getUserMedia = (c) => {
      (window as unknown as { __oakMicAsks: number }).__oakMicAsks++;
      return orig(c);
    };
  });
  return () => page.evaluate(() => (window as unknown as { __oakMicAsks?: number }).__oakMicAsks ?? 0);
}

/** Seeds `point` (Quiet mode: no mic, `voice.quiet` always), cuts HMR, sets the theme; watches the page. */
async function begin(
  page: Page,
  request: APIRequestContext,
  point: string,
  o: { quiet?: boolean; theme?: "paper" | "bark" } = {},
): Promise<{ w: Watch; micAsks: () => Promise<number> }> {
  await resetClock(request);
  await api(request, "POST", "/api/dev/seed", o.quiet ? { point, mic: false } : { point });
  if (o.quiet) await api(request, "PUT", "/api/voice/quiet", { quiet: true, scope: "always" });
  await noHmr(page);
  await setUiPrefs(page, { theme: o.theme ?? (o.quiet ? "bark" : "paper"), motion: "off" });
  const micAsks = await countMicRequests(page);
  return { w: watch(page), micAsks };
}

interface SketchRow {
  id: string;
  originId: string | null;
}
interface SketchDetail {
  versions: { code: string }[];
}

/** The code of the latest version of the sketch a lesson's Make saved. */
async function makeCode(request: APIRequestContext, lessonId: string): Promise<string> {
  const list = await api<{ items: SketchRow[] }>(request, "GET", "/api/sketches");
  const sk = list.items.find((s) => s.originId === lessonId);
  expect(sk, `${lessonId}'s Make is saved as a sketch`).toBeTruthy();
  const d = await api<SketchDetail>(request, "GET", `/api/sketches/${sk?.id}`);
  return d.versions.at(-1)?.code ?? "";
}

for (const quiet of [false, true]) {
  test(`(a${quiet ? ", j" : ""}) U08.L01 as a daily session${quiet ? " in Quiet mode" : ""}: a bass line on the roots under the learner's loop`, async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const { w, micAsks } = await begin(page, request, "after GYM.03", { quiet });
    const plan = await lessonDay(page, request, u08l01, {
      warmupSets: 0,
      unlocks: "auto",
      shots: quiet ? "w5-journey-u08-coda-quiet" : "w5-journey-u08-coda",
    });
    expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U08.L01" });
    // The Make: the four-chord loop over the drums, and under it a bass on each chord's root.
    const code = await makeCode(request, "U08.L01");
    expect(code).toMatch(/^bass:/m);
    expect(code).toMatch(/^chords:/m);
    const progress = await api<{ lessons: { lessonId: string; status: string }[] }>(
      request,
      "GET",
      "/api/lessons/progress",
    );
    expect(progress.lessons.find((l) => l.lessonId === "U08.L01")?.status).toBe("completed");
    // Return: Today names the next lesson.
    await today(page);
    await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done");
    if (quiet) expect(await micAsks(), "Quiet mode never asks for the microphone").toBe(0);
    expectClean(w);
  });
}

test("(b) a U09 day: the form map in the step, A B A B, a section looped from the map and from the ribbon", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const { w } = await begin(page, request, "after U09.L01", { theme: "bark" });
  let looped = false;
  await lessonDay(page, request, u09l02, {
    warmupSets: 0,
    unlocks: "auto",
    shots: "w5-journey-u09-coda",
    async before(step) {
      if (step.id !== "S3") return;
      // The step opens the form map (`initialPanels: ["form"]`): the song's sections, read from its arrange().
      const map = page.getByTestId("form-map").first();
      await expect(map).toBeVisible({ timeout: 60_000 });
      const sections = map.getByTestId("form-sections").locator("li");
      await expect(sections.first()).toBeVisible({ timeout: 60_000 });
      expect(await sections.count()).toBeGreaterThanOrEqual(2);
      const letters = await sections.evaluateAll((els) => els.map((e) => e.getAttribute("data-letter")));
      expect(letters.slice(0, 2)).toEqual(["A", "B"]);
      // A click loops the second section (the chorus); a second click stops it.
      const second = sections.nth(1).getByRole("button");
      await second.click();
      await expect(second).toHaveAttribute("aria-pressed", "true");
      await shootAll(page, "w5-journey-u09-form-map");
      await second.click();
      await expect(second).toHaveAttribute("aria-pressed", "false");
      // The ribbon over the roll: Enter loops the focused section, the arrows move along the form.
      const ribbon = page.getByTestId("section-ribbon").first();
      if (await ribbon.isVisible().catch(() => false)) {
        const first = ribbon.locator("button").first();
        await first.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await expect(ribbon.locator("button").nth(1)).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("Enter");
        await expect(ribbon.locator("button").nth(1)).toHaveAttribute("aria-pressed", "false");
      }
      looped = true;
    },
  });
  expect(looped, "the form step was reached").toBe(true);
  expectClean(w);
});

// --- (c) the U09 checkpoint ------------------------------------------------------------------------

type CpDev = {
  kind(): "family" | "authored" | "make" | null;
  expected(): Record<string, unknown> | null;
  params(): Record<string, unknown> | null;
  trialCode(): string | null;
  exercise(): {
    id: string;
    kind: string;
    tests?: { response: Record<string, unknown>; expect: string }[];
    correct?: unknown;
  } | null;
  answer(r: unknown): Promise<void>;
};

/** Answers the item on screen from what it knows: its own passing test, its drawn trial, its reference. */
async function answerItem(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const d = (globalThis as unknown as { __oakCheckpoint: CpDev }).__oakCheckpoint;
    const kind = d.kind();
    const ex = d.exercise();
    const pass = ex?.tests?.find((t) => t.expect === "pass" && !("pitchFixture" in t.response));
    if (kind === "make" || kind === "authored") {
      if (pass) {
        await d.answer(pass.response);
        return kind;
      }
      await d.answer({ answer: ex?.correct });
      return `${kind}-correct`;
    }
    const exp = d.expected() ?? {};
    const code = d.trialCode();
    if ((exp as { code?: unknown }).code !== undefined || (code && Object.keys(exp).length === 0)) {
      await d.answer({ code });
      return "family-code";
    }
    const params = d.params();
    if (params?.mode === "tap" && Array.isArray(params.tapTargets)) {
      const at = typeof params.responseAt === "number" ? params.responseAt : 0;
      await d.answer({ taps: (params.tapTargets as number[]).map((t) => t + at) });
      return "family-tap";
    }
    await d.answer({ answer: exp });
    return "family";
  });
}

test("(c) U09.CP: the Bass & form checkpoint as a session, to a pass; the Coda follows", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const { w } = await begin(page, request, "U09.CP due");
  const plan = await startToday(page, request, { warmupSets: 0 });
  expect(plan).toMatchObject({ kind: "checkpoint", mapItemId: "U09.CP" });
  await expect(page.getByTestId("checkpoint-intro")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("start-checkpoint").click();
  // No hints and no tutor until the result (contracts §7.6).
  await expect(page.getByTestId("hint")).toHaveCount(0);
  const review = page.getByTestId("checkpoint-review");
  const kinds: string[] = [];
  let sung = 0;
  for (let n = 0; n < 40; n++) {
    await expect(page.getByTestId("lesson-step").or(review).first()).toBeVisible({ timeout: 60_000 });
    if (await review.isVisible().catch(() => false)) break;
    await page.waitForFunction(() => !!(globalThis as { __oakCheckpoint?: unknown }).__oakCheckpoint);
    const step = (await page.getByTestId("lesson-step").getAttribute("data-step")) ?? "";
    const exercise = await page.evaluate(
      () => (globalThis as unknown as { __oakCheckpoint: CpDev }).__oakCheckpoint.exercise()?.kind ?? null,
    );
    if (exercise === "sing") {
      // Singing never gates (contracts §7.6, §8): the sung item is left out.
      sung++;
      await page.getByTestId("skip-item").click();
    } else kinds.push(await answerItem(page));
    await expect(page.getByTestId("lesson-step").or(review).first()).not.toHaveAttribute("data-step", step, {
      timeout: 60_000,
    });
  }
  await expect(review).toBeVisible();
  expect(kinds).toContain("make");
  await page.getByTestId("hand-in").click();
  const result = page.getByTestId("checkpoint-result");
  await expect(result).toBeVisible({ timeout: 60_000 });
  await expect(result).toHaveAttribute("data-passed", "1");
  // Titles, never raw IDs, for what opens now (C3 and the next unit).
  await expect(result).not.toContainText(/\bU\d{2}\.L\d{2}\b|\bfam\.|\btb\./);
  await shootAll(page, "w5-journey-u09cp-passed");
  const p = await api<{ checkpoints: { cpId: string; status: string }[] }>(
    request,
    "GET",
    "/api/lessons/progress",
  );
  expect(p.checkpoints.find((c) => c.cpId === "U09.CP")?.status).toBe("passed");
  test.info().annotations.push({ type: "sung items left out", description: String(sung) });
  await page.getByTestId("checkpoint-done").click();
  await coda(page, { unlocks: "auto" });
  // Return: tomorrow is C3's first session.
  const next = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(next.kind === "capstone" || next.mapItemId === "C3.S1" || next.kind === "lesson").toBe(true);
  expectClean(w);
});

// --- (e) the U10 day with the minor-degree warm-up -----------------------------------------------------

for (const quiet of [false, true]) {
  test(`(e${quiet ? ", j" : ""}) a U10 day${quiet ? " in Quiet mode" : ""}: the minor-degree set in today's warm-up (do-based), then U10.L04`, async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const { w, micAsks } = await begin(page, request, "after U10.L03", { quiet });
    await today(page);
    await startSession(page);
    type Item = { id: string; familyId?: string | null };
    const st = (await sessionState(page)) as unknown as {
      plan: { kind: string; mapItemId: string; warmup: { items: Item[] } } | null;
    };
    expect(st.plan).toMatchObject({ kind: "lesson", mapItemId: "U10.L04" });
    const items = st.plan?.warmup.items ?? [];
    const at = items.findIndex((i) => i.familyId === "fam.deg.fet-minor");
    expect(
      at,
      `the minor degrees in today's warm-up: ${items.map((i) => i.familyId).join(", ")}`,
    ).toBeGreaterThanOrEqual(0);
    // The warm-up is reported skipped (the learner's skip). The minor-degree set itself, with its way home sung on
    // the fake microphone or heard in Quiet mode (the trials on the wire, the mic never asked), is walked by
    // app/src/session/seeds/e2e/w5-warmups.pw.ts "a U10 day …" and its Quiet twin, from this same seed.
    await skipWarmup(page);
    await expect(page.getByTestId("warmup")).toBeHidden({ timeout: 30_000 });
    await walkLesson(page, u10l04);
    await coda(page, { unlocks: "auto", shots: quiet ? "w5-journey-u10-coda-quiet" : "w5-journey-u10-coda" });
    const progress = await api<{ lessons: { lessonId: string; status: string }[] }>(
      request,
      "GET",
      "/api/lessons/progress",
    );
    expect(progress.lessons.find((l) => l.lessonId === "U10.L04")?.status).toBe("completed");
    if (quiet) expect(await micAsks(), "Quiet mode never asks for the microphone").toBe(0);
    expectClean(w);
  });
}

test("(f) a U11 day: U11.L07, the shuffle — the hats swing, the transport says so", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const { w } = await begin(page, request, "after U11.L06", { theme: "bark" });
  let swung = false;
  await lessonDay(page, request, u11l07, {
    warmupSets: 0,
    unlocks: "auto",
    shots: "w5-journey-u11-coda",
    async before(step) {
      if (step.kind !== "make") return;
      // The Make as the learner leaves it: the blues shuffles; the hats' chip carries "Swing 8ths".
      const ex = step.exercise as { tests?: { response: { code?: string }; expect: string }[] } | undefined;
      const code = ex?.tests?.find((t) => t.expect === "pass" && t.response.code)?.response.code;
      expect(code, "the Make has a passing piece").toBeTruthy();
      await page.evaluate(
        (c) =>
          (globalThis as unknown as { __oakLesson: { setCode(c: string): void } }).__oakLesson.setCode(c),
        code as string,
      );
      const play = page.getByTestId("play-toggle").first();
      await play.click();
      await expect(page.locator('[data-testid^="swing-"]').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid^="swing-"]').first()).toContainText(/Swing/);
      await shootAll(page, "w5-journey-u11-shuffle");
      await play.click();
      swung = true;
    },
  });
  expect(swung).toBe(true);
  expectClean(w);
});

test("(h) a side lesson from Today at U03: A1.L01, the scope panel hears the wave; the core lesson stays today's", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const { w } = await begin(page, request, "side lesson offered");
  const plan = await api<{ mapItemId: string; sideLesson: { lessonId: string } | null }>(
    request,
    "GET",
    "/api/session/today",
  );
  expect(plan).toMatchObject({ mapItemId: "U03.L03", sideLesson: { lessonId: "A1.L01" } });
  await today(page);
  const offer = page.getByTestId("side-offer");
  await expect(offer).toBeVisible({ timeout: 30_000 });
  await expect(offer).not.toContainText(/required|behind|overdue/i);
  await shootAll(page, "w5-journey-side-offer");
  await page.getByTestId("side-offer-start").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/?$/);
  await expect(page.getByTestId("session-header")).toBeVisible({ timeout: 60_000 });
  expect((await sessionState(page)).plan).toMatchObject({ mapItemId: "A1.L01" });
  await skipWarmup(page);
  let scoped = false;
  await walkLesson(page, a1l01, {
    async before(step) {
      if (step.id !== "S3") return;
      // The step opens Oak's scope panel (`initialPanels: ["scope"]`); playing draws the wave it hears.
      const scope = page.getByTestId("scope-panel").first();
      await expect(scope).toBeVisible({ timeout: 60_000 });
      await expect(scope.getByTestId("scope-wave")).toBeVisible();
      await expect(scope.getByTestId("scope-idle")).toContainText("Press Play");
      const play = page.getByTestId("play-toggle").first();
      await play.click();
      await expect(scope).toHaveAttribute("data-heard", "1", { timeout: 30_000 });
      await shootAll(page, "w5-journey-a1-scope");
      await play.click();
      scoped = true;
    },
  });
  expect(scoped, "the scope step was reached").toBe(true);
  await coda(page, { unlocks: "auto", shots: "w5-journey-a1-coda" });
  const side = await api<{ items: { lessonId: string; status: string }[] }>(
    request,
    "GET",
    "/api/side-lessons",
  );
  expect(side.items.find((i) => i.lessonId === "A1.L01")?.status).toBe("done");
  // Optional: the core lesson is still today's, never displaced.
  const progress = await api<{ lessons: { lessonId: string; status: string }[] }>(
    request,
    "GET",
    "/api/lessons/progress",
  );
  expect(progress.lessons.find((l) => l.lessonId === "U03.L03")?.status).not.toBe("completed");
  const after = await api<{ mapItemId: string }>(request, "GET", "/api/session/today");
  expect(after.mapItemId).toBe("U03.L03");
  expectClean(w);
});

// --- (i) a gym day on ladder L6 ------------------------------------------------------------------------

interface Project {
  id: string;
  stimulus: { events: NEvent[]; bars: number; cps: number } | null;
}

/** A layer of the reference written down as heard, on the line the grader reads. */
function layerLine(p: Project, layer: "melody" | "bass" | "chords", label: string): string {
  const st = p.stimulus as NonNullable<Project["stimulus"]>;
  const { code } = stimulusCode(
    st.events.filter((e) => layerOfTrack(e.track) === layer),
    st.bars,
  );
  return code.replace(/^ref_\w+:/gm, `${label}:`);
}
const replaceLayer = (code: string, label: string, line: string) => {
  const layer = layerOfTrack(label);
  const lines = code.split("\n");
  const is = (l: string) => {
    const m = /^([A-Za-z_]\w*)\s*:/.exec(l);
    return m !== null && layerOfTrack(m[1] as string) === layer;
  };
  const at = lines.findIndex(is);
  if (at < 0) return `${code.trimEnd()}\n${line}\n`;
  return lines
    .map((l, i) => (i === at ? line : l))
    .filter((l, i) => i === at || !is(l))
    .join("\n");
};
const editorCode = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".cm-content .cm-line")].map((l) => l.textContent ?? "").join("\n"),
  );

test("(i) a gym day on ladder L6: the blues song continues at its changes, passed in the session; the Coda", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const { w } = await begin(page, request, "ladder L6");
  expect((await api<{ level: number }>(request, "GET", "/api/ladder")).level).toBe(6);
  await today(page);
  // Today is X2's first session; the blues gym waits beside it as another way, never instead of it.
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "X2 Blues Transcription",
  );
  await page.getByTestId("other-ways").getByTestId("extra-gym").click();
  await page.waitForURL(/\/session\/?$/);
  await expect(page.getByTestId("session-header")).toBeVisible({ timeout: 60_000 });
  const sessionId = (await sessionState(page)).session?.id;
  expect((await sessionState(page)).plan).toMatchObject({ kind: "gym" });
  await skipWarmup(page);
  await expect(page.getByTestId("gym-block")).toBeVisible({ timeout: 60_000 });
  // The block names what opened: a ladder session, never "your own audio" (closer: the extra gym's label).
  await expect(page.getByTestId("gym-block")).toHaveAttribute("data-kind", "ladder");
  await expect(page.getByTestId("gym-block-title")).not.toContainText("own audio");
  const check = page.getByTestId("check");
  await expect(check).toHaveText("Check the changes", { timeout: 60_000 });
  await expect(page.getByTestId("given")).toContainText("Swing 8ths");
  type GymBody = { history: { sessionId: string; transcriptionId: string | null }[] };
  await expect
    .poll(async () =>
      (await api<GymBody>(request, "GET", "/api/gym")).history.some((g) => g.sessionId === sessionId),
    )
    .toBe(true);
  const row = (await api<GymBody>(request, "GET", "/api/gym")).history.find((g) => g.sessionId === sessionId);
  const project = await api<Project>(request, "GET", `/api/transcriptions/${row?.transcriptionId}`);
  const st = project.stimulus as NonNullable<Project["stimulus"]>;
  // The changes as heard, one chord a bar, written through the chart's own writer.
  const pickup = !st.events.some((e) => layerOfTrack(e.track) === "bass" && R.toNum(e.onset) < 1);
  const full = st.bars - (pickup ? 1 : 0);
  const chart = Array.from({ length: full }, (_, i) => {
    const cycle = i + (pickup ? 1 : 0);
    return (
      st.events.find(
        (x) => layerOfTrack(x.track) === "chords" && Math.floor(R.toNum(x.onset)) === cycle && x.chordSymbol,
      )?.chordSymbol ?? ""
    );
  });
  let code = await editorCode(page);
  code = chart.every((c) => c)
    ? withChanges(code, chart, pickup)
    : replaceLayer(code, "chords", layerLine(project, "chords", "chords"));
  code = replaceLayer(code, "bass", layerLine(project, "bass", "bass"));
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  await check.click();
  await expect(page.getByTestId("verdict")).toHaveText(/^The changes: that's it/, { timeout: 60_000 });
  await expect(page.getByTestId("stages").locator("li").nth(2)).toHaveAttribute("data-status", "open");
  await shootAll(page, "w5-journey-gym-l6");
  await page.getByTestId("gym-finish").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  const ladder = page.getByTestId("coda-ladder-today");
  await expect(ladder).toBeVisible({ timeout: 30_000 });
  await expect(ladder).toContainText("Level 6, blues");
  const songs = await api<{ items: { level: number; passedStages: string[] }[] }>(
    request,
    "GET",
    "/api/ladder/songs",
  );
  expect(songs.items.some((s) => s.level === 6 && s.passedStages.includes("changes"))).toBe(true);
  await page.getByTestId("done-for-today").click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  expectClean(w);
});
