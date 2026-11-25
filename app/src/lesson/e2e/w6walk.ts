// The Wave 6 lesson walks (walk-u12.pw.ts … walk-u17.pw.ts): each U12–U17 lesson opened from the dev seed just before
// it in the default order of contracts §2.5, version 1.6 (wave6.md §6, as `after <the session before it>`), and walked
// step by step by walk.ts — every graded step gets one of the lesson's own pinned mistakes first and its feedback is
// read, then the right answer; the lesson must end complete on the server. One test per lesson, each under a minute.
//
// A seed replays the default order through the real services, so the point before a lesson exists only once every
// lesson before it is authored. While one is still being written the server answers 400 naming it; the walk then
// plays the lesson as a PREVIEW from the last Wave 5 point (every step in the real app with the real grader, nothing
// saved, the server not asked at the end) and says so in its log line and in a test annotation. The moment the seed
// builds, the same test is the full walk. `PREVIEW_UNTIL_SEEDED = false` makes a missing seed a failure: the
// integrator sets it once all 33 lessons are authored.
import type { Page } from "@playwright/test";
import { lessonBefore } from "./chain.ts";
import { stack } from "./playwright.config.ts";
import { expect, test } from "./support.ts";
import { api, reseedFresh, seed, setQuiet } from "./w3support.ts";
import { lessonDefW5 } from "./w5walk.ts";
import { firstSungStep, shownFrom, walkLesson } from "./walk.ts";

/** A walk whose seed point cannot be built yet plays the lesson as a preview (see the header). */
export const PREVIEW_UNTIL_SEEDED = false;

/** The newest point that needs no Wave 6 lesson but the first exemplar: where a preview walk stands. */
export const PREVIEW_POINT = "after U11.L08";

/**
 * The seed point before each Wave 6 lesson: the session just before it in the default order, as `after <it>`
 * (GYM, checkpoint and capstone sessions included: U12.L02 follows X2.S2, U14.L02 follows U13.CP, U15.L02 follows
 * C6.S2, U17.L01 follows CF-T.S4).
 */
export const W6_BEFORE: Record<string, string> = {
  "U12.L01": "after U11.L08",
  "U12.L02": "after X2.S2",
  "U12.L03": "after U12.L02",
  "U12.L04": "after U12.L03",
  "U12.L05": "after U12.L04",
  "U12.L06": "after GYM.13",
  "U13.L01": "after U12.L06",
  "U13.L02": "after U13.L01",
  "U13.L03": "after U13.L02",
  "U13.L04": "after GYM.14",
  "U13.L05": "after U13.L04",
  "U13.L06": "after U13.L05",
  "U14.L01": "after U13.L06",
  "U14.L02": "after U13.CP",
  "U14.L03": "after U14.L02",
  "U14.L04": "after U14.L03",
  "U14.L05": "after GYM.16",
  "U14.L06": "after U14.L05",
  "U15.L01": "after U14.L06",
  "U15.L02": "after C6.S2",
  "U15.L03": "after U15.L02",
  "U15.L04": "after CF-T.S2",
  "U15.L05": "after U15.L04",
  "U15.L06": "after U15.L05",
  "U16.L01": "after U15.L06",
  "U16.L02": "after CF-T.S3",
  "U16.L03": "after U16.L02",
  "U16.L04": "after U16.L03",
  "U16.L05": "after U16.L04",
  "U17.L01": "after CF-T.S4",
  "U17.L02": "after U17.L01",
  "U17.L03": "after U17.L02",
  "U17.L04": "after U17.L03",
};

const H = { "X-Oak": "1", "Content-Type": "application/json", Origin: stack.baseURL };

/** Why the seed point cannot be built yet (`null`: it can), read from the server's own 400. */
async function seedRefusal(page: Page, point: string): Promise<{ status: number; text: string } | null> {
  const r = await page.request.post(`${stack.apiURL}/api/dev/seed`, {
    headers: H,
    data: { point },
    timeout: 120_000,
  });
  if (r.ok()) return null;
  return { status: r.status(), text: await r.text() };
}

type Progress = { lessons: { lessonId: string; status: string }[] };

/**
 * Whether the learner the test before left is the one `point` builds (chain.ts): that test (`prev`) walked the
 * lesson the point ends on, it is completed on the server and `id` is not begun. Then no seed is built.
 */
async function chained(page: Page, id: string, point: string, prev: string | null): Promise<boolean> {
  if (prev === null || lessonBefore(point) !== prev) return false;
  const p = await api<Progress>(page, "GET", "/lessons/progress");
  const status = (l: string) => p.body?.lessons.find((x) => x.lessonId === l)?.status;
  const now = status(id);
  if (status(prev) !== "completed" || now === "completed" || now === "in_progress") return false;
  console.log(`[chain] ${id}: the learner ${prev} left (no seed of "${point}")`);
  return true;
}

export interface W6WalkOptions {
  quiet?: boolean;
}

/** Registers one walk test per lesson (serial: they share the stack's one learner). */
export function walkSuiteW6(ids: readonly string[], o: W6WalkOptions = {}): void {
  test.describe.configure({ mode: "serial" });
  test.afterAll(async ({ request }) => {
    await reseedFresh(request);
  });
  for (const [i, id] of ids.entries()) {
    const name = o.quiet ? `${id} in Quiet mode` : id;
    const title = o.quiet
      ? `${name}: from its first sung step, each sung step its fallback, a pinned mistake first on each graded one, complete`
      : `${name}: every step, a pinned mistake first on each graded one, complete`;
    test(title, async ({ page }) => {
      test.setTimeout(120_000);
      const t0 = Date.now();
      const point = W6_BEFORE[id];
      expect(point, `${id}: a seed point`).toBeDefined();
      const prev = ids[i - 1] ?? null;
      // The learner the test before left (chain.ts), else the seed; a point that cannot be built yet is a preview.
      let preview = false;
      if (!(await chained(page, id, point as string, prev))) {
        const refused = await seedRefusal(page, point as string);
        if (refused !== null) {
          const notYet = refused.status === 400;
          expect(
            notYet && PREVIEW_UNTIL_SEEDED,
            `seed "${point}": ${refused.status} ${refused.text.slice(0, 300)}`,
          ).toBe(true);
          preview = true;
          await seed(page, PREVIEW_POINT);
          test.info().annotations.push({
            type: "preview",
            description: `${id}: the seed "${point}" cannot be built yet (${refused.text.slice(0, 160)})`,
          });
        }
      }
      expect((await api(page, "PUT", "/profile", { targetMinutes: 20 })).status).toBe(200);
      await setQuiet(page, o.quiet === true);
      const tSeed = Date.now();
      const def = await lessonDefW5(id);
      // Quiet mode changes only the sung steps: the walk starts at the first of them (walk.ts firstSungStep).
      const from = o.quiet ? firstSungStep(def) : undefined;
      const query = [preview ? "preview=true" : "", from ? `step=${from}` : ""].filter(Boolean).join("&");
      await page.goto(`/learn/${id}${query ? `?${query}` : ""}`);
      const seen = await walkLesson(page, def, {
        lessonId: id,
        mic: false,
        quiet: o.quiet === true,
        listen: i < ids.length - 1 ? "short" : "first",
        ...(preview ? { preview: true } : {}),
        ...(from ? { from } : {}),
      });
      const shown = shownFrom(def, from);
      for (const s of shown) expect(seen, `${id}: ${s} walked`).toContain(s);
      const walkS = Math.round((Date.now() - tSeed) / 1000);
      console.log(
        `[walk] ${name}${preview ? " (PREVIEW: its seed point is not built yet)" : ""}: ${seen.length} steps in ${walkS} s (seed ${Math.round((tSeed - t0) / 1000)} s)`,
      );
      expect(walkS, `${id}: the walk itself takes under a minute`).toBeLessThan(60);
    });
  }
}
