// The Wave 7 lesson walks (walk-j1.pw.ts … walk-a2.pw.ts, wave7.md §7.3). Two kinds of test per unit file:
//
// - FULL WALKS (`walkSuiteW7`): the unit's exemplar and one more lesson, each from the dev seed just before it
//   (wave7.md §6: a named Wave 7 point, else the generic `after <session>`, which walks the core and then the
//   tracks in the order J, R, A; a lesson right after the one the test before completed is chained, no seed), walked
//   step by step by walk.ts — every graded step gets one of the lesson's own pinned mistakes first and its feedback
//   is read (clean, the pinned codes, not the answer), then the right answer; the lesson ends complete on the server.
//   One test per lesson, each walk under a minute.
// - ONE SMOKE TEST PER UNIT (`smokeSuiteW7`) for the unit's other lessons: each is opened as a preview (dev only,
//   nothing saved) from the core's end and every step is opened, played (a listening loop heard playing and moving,
//   a stimulus started) and given its reference, which must pass; the Make is written from its passing piece and
//   its rule that counts must tick. The mistakes of those lessons are proven, every authored test of every track
//   lesson, by app/src/lesson/wave7-grading.test.ts through the player's own grading path.
//
// Every seed point builds since integrate:server (wave7.md §6); a point that does not is a failure.
import type { Page } from "@playwright/test";
import { lessonBefore } from "./chain.ts";
import { stack } from "./playwright.config.ts";
import { expect, test } from "./support.ts";
import { api, reseedFresh, seed, setQuiet } from "./w3support.ts";
import { lessonDefW5 } from "./w5walk.ts";
import { firstSungStep, shownFrom, walkLesson } from "./walk.ts";

/** Where a smoke walk stands: the core complete, no track lesson begun (every later track lesson is locked). */
export const SMOKE_POINT = "core complete, tracks untouched";

/**
 * The seed points before each track lesson, tried in order (the first that builds is used): the Wave 7 point
 * whose "today" is the lesson (wave7.md §6), else the generic point of the session just before it in its track's
 * order (`trackOrder` in content/syllabus.ts; a track's lessons follow the core and the tracks before it).
 */
export const W7_BEFORE: Record<string, readonly string[]> = {
  "J1.L01": ["core complete, tracks untouched", "core complete"],
  "J1.L02": ["after J1.L01"],
  "J1.L03": ["J1.L03 next", "after J1.L02"],
  "J1.L04": ["after J1.L03"],
  "J1.L05": ["after J1.L04"],
  "J2.L01": ["after J1.L05"],
  "J2.L02": ["after J2.L01"],
  "J2.L03": ["after J2.L02"],
  "J2.L04": ["JC1 released", "after JC1.S2"],
  "J3.L01": ["after JC1.S2"],
  "J3.L02": ["J3.L02 next", "after J3.L05"],
  "J3.L03": ["after J3.L02"],
  "J3.L04": ["after J3.L03"],
  "J4.L01": ["after J3.L04"],
  "J4.L02": ["after J4.L01"],
  "J4.L03": ["J4.L03 next", "after J4.L02"],
  "J4.L04": ["after J4.L03"],
  "J5.L01": ["after JC2.S2"],
  "J5.L02": ["after J5.L01"],
  "J5.L03": ["after J5.L02"],
  "J5.L04": ["after J5.L03"],
  "J5.L05": ["after J5.L04"],
  "R1.L01": ["core complete, tracks untouched", "core complete"],
  "R1.L02": ["after R1.L01"],
  "R1.L03": ["R1.L03 next", "after R1.L02"],
  "R1.L04": ["after R1.L03"],
  "R1.L05": ["after R1.L06"],
  "R2.L01": ["after R1.L05"],
  "R2.L02": ["after R2.L01"],
  "R2.L03": ["after R2.L02"],
  "R2.L04": ["R2.L04 next", "after R2.L03"],
  "R2.L05": ["after R2.L04"],
  "R3.L01": ["after R2.L05"],
  "R3.L02": ["R3.L02 next", "after R3.L01"],
  "R3.L03": ["after R3.L02"],
  "R3.L04": ["after R3.L03"],
  "R3.L05": ["after R3.L04"],
  "A1.L05": ["A1.L05 next", "after A1.L04"],
  "A1.L06": ["after A1.L05"],
  "A1.L07": ["after A1.L06"],
  "A2.L01": ["after A1.L07"],
  "A2.L02": ["after A2.L01"],
  "A2.L03": ["after A2.L09"],
  "A2.L04": ["A2.L04 next", "after A2.L07"],
  "A2.L05": ["after A2.L04"],
  "A2.L06": ["after A2.L05"],
};

const H = { "X-Oak": "1", "Content-Type": "application/json", Origin: stack.baseURL };

/** Seeds the first point that builds; `null` when none can (each refusal's text, for the preview's note). */
export async function seedFirst(
  page: Page,
  points: readonly string[],
): Promise<{ point: string } | { refused: string }> {
  const why: string[] = [];
  for (const point of points) {
    const r = await page.request.post(`${stack.apiURL}/api/dev/seed`, {
      headers: H,
      data: { point },
      timeout: 180_000,
    });
    if (r.ok()) return { point };
    const text = await r.text();
    expect(r.status(), `seed "${point}": ${r.status()} ${text.slice(0, 300)}`).toBe(400);
    why.push(`"${point}": ${text.slice(0, 160)}`);
  }
  return { refused: why.join("; ") };
}

type Progress = { lessons: { lessonId: string; status: string }[] };

/** Whether the learner the test before left is the one the lesson's generic point builds (chain.ts). */
async function chained(page: Page, id: string, prev: string | null): Promise<boolean> {
  const generic = (W7_BEFORE[id] ?? []).find((p) => lessonBefore(p) !== null);
  if (prev === null || !generic || lessonBefore(generic) !== prev) return false;
  const p = await api<Progress>(page, "GET", "/lessons/progress");
  const status = (l: string) => p.body?.lessons.find((x) => x.lessonId === l)?.status;
  const now = status(id);
  if (status(prev) !== "completed" || now === "completed" || now === "in_progress") return false;
  console.log(`[chain] ${id}: the learner ${prev} left (no seed of "${generic}")`);
  return true;
}

export interface W7WalkOptions {
  /** Quiet mode for the day: the walk starts at the lesson's first sung step (walk.ts firstSungStep). */
  quiet?: boolean;
}

/** Registers one full walk per lesson (serial: they share the stack's one learner). */
export function walkSuiteW7(ids: readonly string[], o: W7WalkOptions = {}): void {
  test.describe.configure({ mode: "serial" });
  test.afterAll(async ({ request }) => {
    await reseedFresh(request);
  });
  for (const [i, id] of ids.entries()) {
    const name = o.quiet ? `${id} in Quiet mode` : id;
    test(`${name}: every step, a pinned mistake first on each graded one, complete`, async ({ page }) => {
      test.setTimeout(150_000);
      const t0 = Date.now();
      const points = W7_BEFORE[id];
      expect(points, `${id}: a seed point`).toBeDefined();
      if (!(await chained(page, id, ids[i - 1] ?? null))) {
        const got = await seedFirst(page, points as readonly string[]);
        expect("point" in got, `${id}: a seed point builds (${"refused" in got ? got.refused : ""})`).toBe(
          true,
        );
      }
      expect((await api(page, "PUT", "/profile", { targetMinutes: 20 })).status).toBe(200);
      await setQuiet(page, o.quiet === true);
      const tSeed = Date.now();
      const def = await lessonDefW5(id);
      const from = o.quiet ? firstSungStep(def) : undefined;
      await page.goto(`/learn/${id}${from ? `?step=${from}` : ""}`);
      const seen = await walkLesson(page, def, {
        lessonId: id,
        mic: false,
        quiet: o.quiet === true,
        listen: i < ids.length - 1 ? "short" : "first",
        ...(from ? { from } : {}),
      });
      for (const s of shownFrom(def, from)) expect(seen, `${id}: ${s} walked`).toContain(s);
      const walkS = Math.round((Date.now() - tSeed) / 1000);
      console.log(
        `[walk] ${name}: ${seen.length} steps in ${walkS} s (seed ${Math.round((tSeed - t0) / 1000)} s)`,
      );
      expect(walkS, `${id}: the walk itself takes under a minute`).toBeLessThan(60);
    });
  }
}

export interface W7SmokeOptions {
  /** These lessons are walked in Quiet mode (their sung steps are the fallbacks; nothing waits for a voice). */
  quiet?: readonly string[];
}

/**
 * One test for the unit's other lessons (see the header): each opened as a preview from the core's end, every
 * step opened, played and given its reference; the walk ends on the lesson's complete screen. Registered after
 * the unit's full walks, in the same serial file.
 */
export function smokeSuiteW7(unit: string, ids: readonly string[], o: W7SmokeOptions = {}): void {
  test(`${unit}: ${ids.join(", ")} — every step opens, plays and accepts its reference`, async ({ page }) => {
    test.setTimeout(150_000);
    await seed(page, SMOKE_POINT);
    expect((await api(page, "PUT", "/profile", { targetMinutes: 20 })).status).toBe(200);
    const t0 = Date.now();
    for (const id of ids) {
      const t = Date.now();
      const quiet = o.quiet?.includes(id) === true;
      await setQuiet(page, quiet);
      const def = await lessonDefW5(id);
      await page.goto(`/learn/${id}?preview=true`);
      const seen = await walkLesson(page, def, {
        lessonId: id,
        mic: false,
        quiet,
        preview: true,
        mistakes: false,
        listen: "short",
      });
      for (const s of shownFrom(def)) expect(seen, `${id}: ${s} opened`).toContain(s);
      console.log(
        `[smoke] ${id}${quiet ? " in Quiet mode" : ""}: ${seen.length} steps in ${Math.round((Date.now() - t) / 1000)} s`,
      );
    }
    await setQuiet(page, false);
    expect(Date.now() - t0, `${unit}: the smoke walks take under a minute`).toBeLessThan(60_000);
  });
}
