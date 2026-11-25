// The contract gate of §7.4 with Wave 5's catalog: the U08–U11 families as content/families.ts tunes them (stage E,
// the minor and blues ladders, groove lock, form, swing) and every fact deck of the catalog: since contracts 1.6
// (Wave 6 Foundation, d1) that is all twelve, the U04–U07 decks (interval names, triad spellings, numerals,
// cadences) and the U10–U11 decks (content/decks `WAVE5_DECKS`: minor keys, minor-key chords, scales as degrees,
// the twelve bars, dominant sevenths) beside the three older ones, each promoted deck at one new card a day,
// introduced in course order. The five criteria must hold on every run and target (the gate's seeds and the
// held-out ones) over the 300 days, and again over the stretch that ends with X2.S2 (session 137 of the default
// order since 1.6 added U05.L09 and C3.S4, the end of Wave 5's course). The table is printed for the report.
import { describe, expect, test } from "bun:test";
import { PROMOTED_DECKS, WAVE5_DECKS } from "../../../content/decks/index.ts";
import { decks, families } from "../../../content/families.ts";
import { defaultOrder } from "../../../content/syllabus.ts";
import { createSrs, DECISION_2, recommendedGovernor, SIM_GATE } from "./index.ts";
import { simCatalogOf } from "./sim/course-catalog.test-util.ts";
import { DEFAULT_LEARNER, type SimResult, simulate } from "./sim/simulate.ts";

/** Every deck of the catalog, the nine promoted by contracts 1.6 among them. */
const catalog = simCatalogOf(families, decks);
const srs = await createSrs({ factRetention: DECISION_2.factRetention });
const TARGETS = [15, 20, 25] as const;
/** The gate's five seeds and the five held-out ones. */
const SEEDS = ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8", "i9", "j0"];
const END = "X2.S2";
const p95 = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] as number;
};

interface Window {
  sessions: number;
  day: number;
  plannedP95: number;
  activeMax: number;
  oldestP95: number;
  reviewDayP95: number;
  reviewMoreP95: number;
  waitMax: number;
  waitCensored: number;
  wave5WaitMax: number;
}
/** The criteria over the sessions up to and including X2.S2 (both sessions of a split lesson count). */
function windowOf(r: SimResult): Window {
  const last = r.rows.map((x) => x.entry).lastIndexOf(END);
  const rows = last >= 0 ? r.rows.slice(0, last + 1) : r.rows;
  const day = rows.at(-1)?.day ?? 0;
  const waits = r.summary.firstReviewWait.perFamily.filter((w) => w.seededDay <= day);
  const wave5 = new Set(
    families
      .filter((f) => /^U(08|09|10|11)\./.test(f.unlock.lesson) && f.kind !== "concept")
      .map((f) => f.id as string),
  );
  return {
    sessions: rows.length,
    day,
    plannedP95: p95(rows.map((x) => x.plannedSec)),
    activeMax: Math.max(0, ...rows.map((x) => x.activePerceptual)),
    oldestP95: p95(rows.map((x) => x.oldestUndeliveredDays)),
    reviewDayP95: p95(rows.map((x) => x.reviewDaySec)),
    reviewMoreP95: p95(rows.map((x) => x.reviewMoreSec)),
    waitMax: Math.max(0, ...waits.map((w) => w.waitDays)),
    waitCensored: waits.filter((w) => w.censored).length,
    wave5WaitMax: Math.max(0, ...waits.filter((w) => wave5.has(w.family)).map((w) => w.waitDays)),
  };
}

const runs = TARGETS.flatMap((t) =>
  SEEDS.map((seed) => {
    const r = simulate(srs, {
      seed,
      days: 300,
      targetMinutes: t,
      calendar: "weekdays",
      gaps: [
        [61, 64],
        [145, 154],
        [229, 232],
      ],
      governor: recommendedGovernor(t),
      learner: DEFAULT_LEARNER,
      termsPerLesson: 3,
      durationJitter: 0.12,
      catalog,
    });
    return { t, seed, s: r.summary, w: windowOf(r) };
  }),
);
console.log(
  [
    `Wave 5 catalog (families + every deck, ${catalog.deckBatches.reduce((n, b) => n + (b[2] as number), 0)} fact cards): target seed | through ${END}: sessions (day) | planned warm-up p95 s | active max | oldest undelivered p95 d | first-review wait max d (U08–U11 families) [never] | review day p95 s || 300 days: planned p95 | active max | oldest p95 | wait max [never] | review day p95 | fact cards`,
    ...runs.map(
      ({ t, seed, s, w }) =>
        `${t} ${seed} | ${w.sessions} (${w.day}) | ${Math.round(w.plannedP95)} | ${w.activeMax} | ${w.oldestP95} | ${w.waitMax} (${w.wave5WaitMax}) [${w.waitCensored}] | ${Math.round(w.reviewDayP95)} || ${Math.round(s.plannedSec.p95)} | ${s.maxActivePerceptual} | ${s.oldestUndeliveredDays.p95} | ${s.firstReviewWait.all.max} [${s.firstReviewWait.all.censored}] | ${Math.round(s.reviewDaySec.p95)} | ${s.factCards}`,
    ),
  ].join("\n"),
);

describe("§7.4 with Wave 5's families and every deck, through X2.S2 and over 300 days", () => {
  test("the U08–U11 decks are in the simulated catalog, card by card in their lessons", () => {
    const ids = new Set(catalog.deckBatches.map(([id]) => id));
    for (const d of PROMOTED_DECKS) expect(ids.has(d.id)).toBe(true);
    expect(ids.size).toBe(decks.length);
    const wave5 = new Set(WAVE5_DECKS.map((d) => d.id as string));
    for (const [id, lesson] of catalog.deckBatches)
      if (wave5.has(id))
        expect([id, lesson, defaultOrder.includes(lesson as never)]).toEqual([id, lesson, true]);
    // At 20 and 25 minutes a lesson is one session, so X2.S2 is session 137 of the default order (131 before Oak 2.0
    // W2's five core lessons and one more gym slot); at 15 minutes a
    // lesson takes two sessions and the 300 days end before X2 (the window is then the whole run).
    expect(defaultOrder.indexOf("X2.S2") + 1).toBe(137);
    for (const { t, w } of runs) if (t !== 15) expect(w.sessions).toBe(137 + 1);
  });
  test("through X2.S2: p95 planned warm-up within budget; ≤ 12 active; oldest due p95 ≤ 7 d; first review ≤ 7 d; review day ≤ 12 min", () => {
    for (const { t, seed, w } of runs) {
      const where = [t, seed];
      expect([...where, w.plannedP95 <= SIM_GATE.p95WarmupSec[t]]).toEqual([...where, true]);
      expect([...where, w.activeMax <= SIM_GATE.maxActive]).toEqual([...where, true]);
      // Held to the contract's 7 days over this shorter window too since Wave 6 (it was allowed 8: a deck card
      // dealt before the 10-day break of days 145–154 was outranked by the backlog for weeks; such a card now
      // waits like any due card after two days, planner.ts `freshPriority`).
      expect([...where, w.oldestP95 <= SIM_GATE.p95OldestDueDays]).toEqual([...where, true]);
      expect([...where, w.waitMax <= SIM_GATE.firstReviewWaitDays]).toEqual([...where, true]);
      expect([...where, w.waitCensored]).toEqual([...where, 0]);
      // The review day as contracts 1.7 counts it: the "a little more" review only (d22).
      expect([...where, w.reviewMoreP95 <= SIM_GATE.p95ReviewDaySec]).toEqual([...where, true]);
    }
  });
  test("300 days: the same five criteria, and no family left unreviewed", () => {
    for (const { t, seed, s } of runs) {
      const where = [t, seed];
      expect([...where, s.plannedSec.p95 <= SIM_GATE.p95WarmupSec[t]]).toEqual([...where, true]);
      expect([...where, s.maxActivePerceptual <= SIM_GATE.maxActive]).toEqual([...where, true]);
      expect([...where, s.oldestUndeliveredDays.p95 <= SIM_GATE.p95OldestDueDays]).toEqual([...where, true]);
      expect([...where, s.firstReviewWait.all.max <= SIM_GATE.firstReviewWaitDays]).toEqual([...where, true]);
      expect([...where, s.firstReviewWait.all.censored]).toEqual([...where, 0]);
      expect([...where, s.reviewMoreSec.p95 <= SIM_GATE.p95ReviewDaySec]).toEqual([...where, true]);
    }
  });
});
