// The contract gate of §7.4 on the whole core: every family of the catalog as content/families.ts tunes it
// (Wave 6: ear stages E and F and the rhythm part of H, the level gates U12–U17 open) and every fact deck, the
// six U12–U17 decks among them (content/decks `WAVE6_DECKS`, in `decks` since contracts 1.7: seventh chords,
// diatonic sevenths, modes, secondary dominants, borrowed chords, pivots; one new card a day each), introduced in
// the default course order to its last session, CF-A.S4 (session 185 of the order since contracts 1.6), and on
// into the tracks. The decks are the core's (content/decks/index.ts `decks`): the advanced tracks' ten are
// simulated with the whole course, all 259 sessions in every order, in simulation-wave7.test.ts.
//
// At 20 and 25 minutes a lesson is one session and about 300 days hold the whole core and four weeks of tracks. At
// 15 minutes a lesson takes two, so the run is about 480 days: the first time the 15-minute learner's review load
// is simulated past U11. The run grows with the core (`daysFor`). The five criteria must hold on every run and target (the gate's seeds and the held-out ones), over the
// stretch that ends with CF-A.S4 and over the whole run: p95 planned warm-up within the budget; at most 12 active
// perceptual and production families on every day; p95 age of the oldest undelivered due card at most 7 days;
// every perceptual and production family's first review set within 7 days of its lesson, none left unreviewed;
// review day p95 at most 720 s, counting the "a little more" review only (the warm-up is budgeted by §9.1; d22,
// contracts 1.7).
//
// Two variants. "padded" is the gate's own conservative assumption (simulation.test.ts): every lesson also adds
// two tested-term cards, about 250 fact cards the course does not have (no term of content/terms.ts carries a
// card today). "as written" has the course's own cards only; it is the run that shows whether the decks drain.
// The table prints the reviews-only day three ways: with the warm-up inside the 12-minute cap (the rule before
// d22), the whole day under d22 (the warm-up outside the cap, which the server builds), and its "a little more"
// part, which is what §7.4 holds.
import { describe, expect, test } from "bun:test";
import { decks, WAVE6_DECKS } from "../../../content/decks/index.ts";
import { families } from "../../../content/families.ts";
import { defaultOrder } from "../../../content/syllabus.ts";
import { terms } from "../../../content/terms.ts";
import {
  createSrs,
  DECISION_2,
  REVIEW_DAY_MAX_SEC,
  recommendedGovernor,
  SIM_GATE,
  WARMUP_BUDGET_SEC,
} from "./index.ts";
import { simCatalogOf } from "./sim/course-catalog.test-util.ts";
import { DEFAULT_LEARNER, type SimResult, simulate } from "./sim/simulate.ts";

const catalog = simCatalogOf(families, decks);
const srs = await createSrs({ factRetention: DECISION_2.factRetention });
const TARGETS = [15, 20, 25] as const;
/** The gate's five seeds and the five held-out ones. */
const SEEDS = ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8", "i9", "j0"];
const GATE_SEEDS = SEEDS.slice(0, 5);
/** The last session of the core in the default order. */
const END = defaultOrder[defaultOrder.length - 1] as string;
/** Sessions of the core at a target: two a lesson at 15 minutes. */
const coreSessions = (t: 15 | 20 | 25, lessons: number, sessions: number) =>
  t === 15 ? sessions + lessons : sessions;
/**
 * Days simulated: the core and about four weeks of tracks after it, the tail in which the last decks drain and
 * resting families come back (the two health tests below are read at the end of the run). The bounds were measured
 * on the core of contracts 1.6, 185 sessions with 125 lessons: 300 days at 20 and 25 minutes (the core ended on day
 * 273), 480 at 15 (day 448). At 5 sessions a week every session the core gains ends it 7/5 of a day later, and the
 * run moves with it so the tail keeps its length: Oak 2.0 W2's five lessons and one gym slot (191 sessions, 130
 * lessons, contracts 2.2) end the core on day 281 and 463 and the run on day 308 and 495.
 */
const CORE_LESSONS = defaultOrder.filter((id) => /\.L\d+$/.test(id)).length;
const daysFor = (t: 15 | 20 | 25) =>
  (t === 15 ? 480 : 300) +
  Math.round(((coreSessions(t, CORE_LESSONS, defaultOrder.length) - coreSessions(t, 125, 185)) * 7) / 5);
const GAPS: [number, number][] = [
  [61, 64],
  [145, 154],
  [229, 232],
];
const p95 = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] as number;
};
/** Perceptual and production families the stretch U12–U17 seeds. */
const WAVE6_FAMILIES = new Set(
  families
    .filter((f) => /^U1[2-7]\./.test(f.unlock.lesson) && f.kind !== "concept")
    .map((f) => f.id as string),
);
const PERCEPTUAL = new Set(
  families.filter((f) => f.kind !== "concept" && !f.generator.startsWith("mix.")).map((f) => f.id as string),
);

interface Window {
  reached: boolean;
  sessions: number;
  day: number;
  plannedP95: number;
  activeMax: number;
  oldestP95: number;
  reviewDayP95: number;
  reviewOpenP95: number;
  reviewMoreP95: number;
  waitMax: number;
  waitCensored: number;
  wave6WaitMax: number;
  wave6Seeded: number;
  seeded: number;
  activeAtEnd: number;
  deckPendingAtEnd: number;
}
/** The criteria over the sessions up to and including the core's last session. */
function windowOf(r: SimResult): Window {
  const last = r.rows.map((x) => x.entry).lastIndexOf(END);
  const rows = last >= 0 ? r.rows.slice(0, last + 1) : r.rows;
  const day = rows.at(-1)?.day ?? 0;
  const waits = r.summary.firstReviewWait.perFamily.filter((w) => w.seededDay <= day);
  const wave6 = waits.filter((w) => WAVE6_FAMILIES.has(w.family));
  return {
    reached: last >= 0,
    sessions: rows.length,
    day,
    plannedP95: p95(rows.map((x) => x.plannedSec)),
    activeMax: Math.max(0, ...rows.map((x) => x.activePerceptual)),
    oldestP95: p95(rows.map((x) => x.oldestUndeliveredDays)),
    reviewDayP95: p95(rows.map((x) => x.reviewDaySec)),
    reviewOpenP95: p95(rows.map((x) => x.reviewDayOpenSec)),
    reviewMoreP95: p95(rows.map((x) => x.reviewMoreSec)),
    waitMax: Math.max(0, ...waits.map((w) => w.waitDays)),
    waitCensored: waits.filter((w) => w.censored && w.seededDay < day).length,
    wave6WaitMax: Math.max(0, ...wave6.map((w) => w.waitDays)),
    wave6Seeded: wave6.length,
    seeded: waits.length,
    activeAtEnd: rows.at(-1)?.activePerceptual ?? 0,
    deckPendingAtEnd: rows.at(-1)?.deckPending ?? 0,
  };
}
const run = (t: 15 | 20 | 25, seed: string, termsPerLesson: number) => {
  const r = simulate(srs, {
    seed,
    days: daysFor(t),
    targetMinutes: t,
    calendar: "weekdays",
    gaps: GAPS,
    governor: recommendedGovernor(t),
    learner: DEFAULT_LEARNER,
    termsPerLesson,
    durationJitter: 0.12,
    catalog,
  });
  return { t, seed, s: r.summary, w: windowOf(r) };
};
const padded = TARGETS.flatMap((t) => SEEDS.map((seed) => run(t, seed, 3)));
/** The course's own tested-term cards (none carries a card today). */
const TERM_CARDS = terms.filter((x) => (x as { card?: unknown }).card !== undefined).length;
const written = TARGETS.flatMap((t) => GATE_SEEDS.map((seed) => run(t, seed, TERM_CARDS === 0 ? 0 : 3)));

const cards = catalog.deckBatches.reduce((n, b) => n + (b[2] as number), 0);
const line = ({ t, seed, s, w }: (typeof padded)[number]) =>
  `${t} ${seed} | ${w.sessions} (${w.day}) | ${Math.round(w.plannedP95)} | ${w.activeMax} | ${w.oldestP95} | ${w.waitMax} (${w.wave6WaitMax}) [${w.waitCensored}] | ${Math.round(w.reviewDayP95)} | ${Math.round(w.reviewOpenP95)} | ${Math.round(w.reviewMoreP95)} | ${w.seeded} / ${w.activeAtEnd} | ${w.deckPendingAtEnd} || ${Math.round(s.plannedSec.p95)} | ${s.maxActivePerceptual} | ${s.oldestUndeliveredDays.p95} | ${s.firstReviewWait.all.max} [${s.firstReviewWait.all.censored}] | ${Math.round(s.reviewDaySec.p95)} | ${Math.round(s.reviewDayOpenSec.p95)} | ${Math.round(s.reviewMoreSec.p95)} | ${s.families.graduated}+${s.families.resting} | ${s.deckPending.atEnd} | ${s.factCards}`;
const header = (name: string) =>
  `Wave 6 catalog, ${name} (${PERCEPTUAL.size} perceptual and production families, ${cards} deck cards in ${decks.length} decks): target seed | through ${END}: sessions (day) | planned warm-up p95 s | active max | oldest undelivered p95 d | first-review wait max d (U12–U17 families) [never] | review day p95 s | review day with the warm-up outside the cap (d22) p95 s | its "a little more" p95 s (the §7.4 criterion) | families seeded / active at the end | deck cards not yet dealt || whole run: planned p95 | active max | oldest p95 | wait max [never] | review day p95 | d22 review day p95 | d22 a little more p95 | graduated+resting at the end | deck cards not yet dealt | fact cards`;
console.log(
  [header("padded with two term cards a lesson (the gate's assumption)"), ...padded.map(line)].join("\n"),
);
console.log([header(`as written (${TERM_CARDS} term cards)`), ...written.map(line)].join("\n"));

describe("§7.4 over the whole core with the U12–U17 families and decks", () => {
  test("the catalog: the six U12–U17 decks card by card in their lessons, the seven families the stretch seeds, the order to CF-A.S4", () => {
    const ids = new Set(catalog.deckBatches.map(([id]) => id));
    for (const d of WAVE6_DECKS) expect([d.id, decks.includes(d), ids.has(d.id)]).toEqual([d.id, true, true]);
    expect(ids.size).toBe(decks.length);
    for (const [id, lesson] of catalog.deckBatches)
      if (WAVE6_DECKS.some((d) => d.id === id))
        expect([
          id,
          lesson,
          /^U1[2-7]\.L\d\d$/.test(lesson) && defaultOrder.includes(lesson as never),
        ]).toEqual([id, lesson, true]);
    expect([...WAVE6_FAMILIES].sort()).toEqual(
      [
        "fam.chd.quality-7th",
        "fam.int.isolated",
        "fam.rhy.syncopation",
        "fam.rhy.subdivision",
        "fam.deg.fet-chromatic",
        "fam.har.chromatic",
        "fam.har.modulation",
      ].sort(),
    );
    expect(END).toBe("CF-A.S4");
    // 185 before Oak 2.0 W2's five core lessons and one more gym slot (contracts 2.2).
    expect(defaultOrder.length).toBe(191);
    // The run grows with the core: 8 days at 20 and 25 minutes, 15 at 15 (`daysFor`).
    expect([CORE_LESSONS, daysFor(15), daysFor(20), daysFor(25)]).toEqual([130, 495, 308, 308]);
    // Every level gate of a core lesson names a session of the order (a gate on a lesson nobody reaches would
    // hold a family at its level for ever).
    for (const [id, gates] of Object.entries(catalog.levelGates))
      for (const lessons of Object.values(gates))
        for (const l of lessons) expect([id, l, catalog.order.includes(l)]).toEqual([id, l, true]);
  });

  test("every run reaches the end of the core, at 15 minutes too, and seeds all seven families on the way", () => {
    for (const { t, seed, w } of [...padded, ...written]) {
      expect([t, seed, w.reached]).toEqual([t, seed, true]);
      expect([t, seed, w.wave6Seeded]).toEqual([t, seed, WAVE6_FAMILIES.size]);
      // 125 lessons, two sessions each at 15 minutes, and 60 other sessions; light sessions after a long break add a few.
      if (t === 15) expect(w.sessions).toBeGreaterThanOrEqual(125 * 2 + 60);
      else expect(w.sessions).toBeGreaterThanOrEqual(191);
    }
  });

  for (const [name, runs] of [
    ["padded", padded],
    ["as written", written],
  ] as const) {
    test(`${name}, through ${END}: budget, 12 active, oldest due 7 d, first review 7 d, "a little more" p95 720 s, on every run and target`, () => {
      for (const { t, seed, w } of runs) {
        const where = [t, seed];
        expect([...where, w.plannedP95 <= SIM_GATE.p95WarmupSec[t]]).toEqual([...where, true]);
        expect([...where, w.activeMax <= SIM_GATE.maxActive]).toEqual([...where, true]);
        expect([...where, w.oldestP95 <= SIM_GATE.p95OldestDueDays]).toEqual([...where, true]);
        expect([...where, w.waitMax <= SIM_GATE.firstReviewWaitDays]).toEqual([...where, true]);
        expect([...where, w.waitCensored]).toEqual([...where, 0]);
        expect([...where, w.reviewMoreP95 <= SIM_GATE.p95ReviewDaySec]).toEqual([...where, true]);
      }
    });
    test(`${name}, the whole run (into the tracks): the same five criteria, and no family left unreviewed`, () => {
      for (const { t, seed, s } of runs) {
        const where = [t, seed];
        expect([...where, s.plannedSec.p95 <= SIM_GATE.p95WarmupSec[t]]).toEqual([...where, true]);
        expect([...where, s.maxActivePerceptual <= SIM_GATE.maxActive]).toEqual([...where, true]);
        expect([...where, s.oldestUndeliveredDays.p95 <= SIM_GATE.p95OldestDueDays]).toEqual([
          ...where,
          true,
        ]);
        expect([...where, s.firstReviewWait.all.max <= SIM_GATE.firstReviewWaitDays]).toEqual([
          ...where,
          true,
        ]);
        expect([...where, s.firstReviewWait.all.censored]).toEqual([...where, 0]);
        expect([...where, s.reviewMoreSec.p95 <= SIM_GATE.p95ReviewDaySec]).toEqual([...where, true]);
      }
    });
  }

  test("the first review of a new family now has room to spare: at most 5 days on every run (the bound is 7)", () => {
    // Measured 3 to 4 days on all 45 runs since a first set is no longer spread over the days after a break
    // (governor.ts `smoothBacklog`); before, a family seeded on the eve of the 10-day break waited the full 7.
    for (const { t, seed, s, w } of [...padded, ...written]) {
      expect([t, seed, s.firstReviewWait.all.max <= 5]).toEqual([t, seed, true]);
      expect([t, seed, w.wave6WaitMax <= 5]).toEqual([t, seed, true]);
    }
  });

  test("graduation and resting carry the load: about forty families seeded by the end of the core, never more than 12 active", () => {
    for (const { t, seed, s, w } of padded) {
      expect([t, seed, w.seeded >= 38]).toEqual([t, seed, true]);
      expect([t, seed, w.activeAtEnd <= SIM_GATE.maxActive]).toEqual([t, seed, true]);
      // By the end of the run most of them live in the three composites, a few of those resting.
      expect([t, seed, s.families.graduated + s.families.resting >= w.seeded - SIM_GATE.maxActive]).toEqual([
        t,
        seed,
        true,
      ]);
      expect([t, seed, s.families.graduated >= 18]).toEqual([t, seed, true]);
    }
  });

  test("as written, the decks drain: a few dozen cards of the last units are still to come when the core ends, a handful at the end of the run", () => {
    // U16 and U17 open their decks 20 and 13 sessions before the core ends, at one new card a day each, so their
    // last cards are dealt after it (measured: 0 at 15 minutes, up to 31 of 341 at 20 and 25; 1 at most at the end
    // of the run). Oak 2.0 W2 (191 sessions): 0 at 15 minutes, up to 15 at 20 and 25, none at the end of the run;
    // with the run still 300 days long its tail after the core was 8 days shorter and 20 d4 ended with 11.
    for (const { t, seed, s, w } of written) {
      expect([t, seed, w.deckPendingAtEnd <= 40]).toEqual([t, seed, true]);
      expect([t, seed, s.deckPending.atEnd <= 5]).toEqual([t, seed, true]);
      expect(s.factCards).toBeGreaterThanOrEqual(cards - 5);
    }
  });

  test("as written, the engine is in good health: resting families come back, the deferred queue is short, most families reach their mastery level", () => {
    for (const { t, seed, s } of written) {
      const where = [t, seed];
      // The composite is a place to wait, not a sink (decision 27): at most 6 resting at the end, 60% back.
      expect([...where, s.families.resting <= 6]).toEqual([...where, true]);
      expect([...where, s.families.returns >= 0.6 * s.families.rests]).toEqual([...where, true]);
      // The Wave 2 criterion decision 27 replaced ("deferred queue p95 ≤ 4 cards") holds again: measured 1 to 2.
      expect([...where, s.deferredCards.p95 <= SIM_GATE.p95DeferredCards]).toEqual([...where, true]);
      expect([...where, s.families.atMastery / s.families.unlocked >= 0.7]).toEqual([...where, true]);
      expect([...where, s.families.graduated >= 28]).toEqual([...where, true]);
      // The simulated learner is the contract's: about 85% mean credit, about 10% of sets below 0.65.
      expect(s.setCredit.mean).toBeGreaterThan(0.8);
      expect(s.setCredit.mean).toBeLessThan(0.88);
      expect(s.setCredit.below065).toBeGreaterThan(0.04);
      expect(s.setCredit.below065).toBeLessThan(0.18);
      // Overflow at p95 stays under two budgets (measured: 0.70 to 1.53), and reviews are rarely late.
      expect([...where, s.overflowSteadySec.p95 <= 1.6 * WARMUP_BUDGET_SEC[t]]).toEqual([...where, true]);
      expect([...where, s.lateDays.p95 <= 7]).toEqual([...where, true]);
    }
  });

  test("d22, measured: with the warm-up outside the cap 'a little more' stays inside 12 minutes and the whole day inside the budget plus 12", () => {
    for (const { t, seed, s } of [...padded, ...written]) {
      expect([t, seed, s.reviewMoreSec.max <= REVIEW_DAY_MAX_SEC]).toEqual([t, seed, true]);
      expect([t, seed, s.reviewDayOpenSec.max <= WARMUP_BUDGET_SEC[t] + REVIEW_DAY_MAX_SEC]).toEqual([
        t,
        seed,
        true,
      ]);
      // The day is never shorter than under the old cap.
      expect([t, seed, s.reviewDayOpenSec.p95 >= s.reviewDaySec.p95]).toEqual([t, seed, true]);
    }
  });
});
