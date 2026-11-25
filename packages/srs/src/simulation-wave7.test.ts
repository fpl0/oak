// The contract gate of §7.4 over the WHOLE course, session 1 to session 270 (contracts 2.2 §2.7; 259 before Oak 2.0 W2): every family of
// the catalog as content/families.ts tunes it (Wave 7: stage G, the rest of stage H, the sound families, with the
// level gates of the track lessons) and every fact deck, the advanced tracks' ten among them (content/decks
// wave7.ts, one new card a day each), introduced in complete LEGAL orders of all 270 sessions (§7.6):
//   - "early": each track taken the day it opens, so J1–J3 and R1–R3 interleave with U14–U17 and A1.L01–L04 sit
//     in U03–U09 (the earliest legal route of every track lesson);
//   - "core, then J R A" and the five other orders of the three tracks after the core;
//   - two seeded random interleavings of the core and the tracks.
// Every order runs at 20 minutes, the tightest target (one session a lesson on a 300-second warm-up, Wave 6's
// measurement); the early order and the first random interleaving run at 15 and 25 minutes as well, each to the
// end of its 270 sessions (430 at 15 minutes, where a lesson takes two). On every run, over the whole run: p95
// planned warm-up within the budget; at most 12 active perceptual and production families on every day; p95 age
// of the oldest undelivered due card at most 7 days; every perceptual and production family's first review set
// within 7 days of the lesson that seeded it, none left unreviewed; the "a little more" review day p95 at most
// 720 s. The course as written (no term carries a card); the padded variant is the gate's (simulation.test.ts).
import { describe, expect, test } from "bun:test";
import { WAVE7_DECKS } from "../../../content/decks/wave7.ts";
import { decks, families } from "../../../content/families.ts";
import { createSrs, DECISION_2, recommendedGovernor, SIM_GATE } from "./index.ts";
import { simCatalogOf } from "./sim/course-catalog.test-util.ts";
import { coreThen, EARLY, randomOrder, TRACK_PERMUTATIONS } from "./sim/legal-orders.test-util.ts";
import { DEFAULT_LEARNER, type SimResult, simulate } from "./sim/simulate.ts";

const srs = await createSrs({ factRetention: DECISION_2.factRetention });
/** A 4-day break every 12 weeks and a 10-day one every 24 (the gate's pattern, carried through the year). */
const GAPS: [number, number][] = [
  [61, 64],
  [145, 154],
  [229, 232],
  [313, 316],
  [397, 406],
  [481, 484],
  [565, 568],
  [649, 658],
];
const daysFor = (t: 15 | 20 | 25) => (t === 15 ? 700 : 440);
const ORDERS: Readonly<Record<string, readonly string[]>> = {
  early: EARLY,
  ...Object.fromEntries(TRACK_PERMUTATIONS.map((p) => [`core, then ${p.join(" ")}`, coreThen(p)])),
  "random 1": randomOrder(7),
  "random 2": randomOrder(11),
};
const RUNS: [string, 15 | 20 | 25, string][] = [
  ...Object.keys(ORDERS).map(
    (o, i) => [o, 20, ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8", "i9"][i]] as [string, 20, string],
  ),
  ["early", 15, "j0"],
  ["early", 25, "k1"],
  ["random 1", 15, "l2"],
  ["random 1", 25, "m3"],
];
const PERCEPTUAL = new Set(
  families.filter((f) => f.kind !== "concept" && !f.generator.startsWith("mix.")).map((f) => f.id as string),
);
/** Perceptual and production families the tracks seed or open levels in (stages G, H and the sound families). */
const TRACK_FAMILIES = new Set(
  families
    .filter((f) => /^[JRA]\d\.L\d\d$/.test(f.unlock.lesson) && PERCEPTUAL.has(f.id as string))
    .map((f) => f.id as string),
);

interface Run {
  order: string;
  t: 15 | 20 | 25;
  seed: string;
  r: SimResult;
  /** The index of the order's last session in the rows (−1: not reached). */
  end: number;
  last: string;
}
const runs: Run[] = RUNS.map(([order, t, seed]) => {
  const list = ORDERS[order] as readonly string[];
  const r = simulate(srs, {
    seed,
    days: daysFor(t),
    targetMinutes: t,
    calendar: "weekdays",
    gaps: GAPS,
    governor: recommendedGovernor(t),
    learner: DEFAULT_LEARNER,
    termsPerLesson: 0,
    durationJitter: 0.12,
    catalog: simCatalogOf(families, decks, list),
  });
  const last = list[list.length - 1] as string;
  return { order, t, seed, r, end: r.rows.map((x) => x.entry).lastIndexOf(last), last };
});

const trackWait = (r: SimResult) =>
  Math.max(
    0,
    ...r.summary.firstReviewWait.perFamily.filter((w) => TRACK_FAMILIES.has(w.family)).map((w) => w.waitDays),
  );
const line = ({ order, t, seed, r, end }: Run) => {
  const s = r.summary;
  return `${order.padEnd(18)} ${t} ${seed} | ${end + 1} (${r.rows[end]?.day ?? "—"}) | ${Math.round(s.plannedSec.p95)} | ${s.maxActivePerceptual} | ${s.oldestUndeliveredDays.p95} | ${s.firstReviewWait.all.max} (${trackWait(r)}) [${s.firstReviewWait.all.censored}] | ${Math.round(s.reviewMoreSec.p95)} | ${Math.round(s.reviewDayOpenSec.p95)} | ${s.firstReviewWait.perFamily.length} / ${s.families.graduated}+${s.families.resting} | ${s.deckPending.atEnd} | ${s.factCards}`;
};
const cards = decks.reduce((n, d) => n + d.cards.length, 0);
console.log(
  [
    `Whole course (270 sessions), ${PERCEPTUAL.size} perceptual and production families (${TRACK_FAMILIES.size} opened by the tracks), ${cards} deck cards in ${decks.length} decks: order target seed | sessions to the last of the 270 (day) | planned warm-up p95 s | active max | oldest undelivered p95 d | first-review wait max d (track families) [never] | "a little more" p95 s (§7.4) | review day under d22 p95 s | families seeded / graduated+resting at the end | deck cards not yet dealt | fact cards`,
    ...runs.map(line),
  ].join("\n"),
);

describe("§7.4 over the whole course, 270 sessions, the tracks in every order", () => {
  test("the orders are complete and legal, and really differ: early interleaves the tracks with U14–U17", () => {
    for (const [name, list] of Object.entries(ORDERS)) {
      expect([name, list.length, new Set(list).size]).toEqual([name, 270, 270]);
    }
    const early = ORDERS.early as readonly string[];
    expect(early.indexOf("J1.L01")).toBeLessThan(early.indexOf("U14.L03"));
    expect(early.indexOf("R1.L01")).toBeLessThan(early.indexOf("U14.L03"));
    for (const p of TRACK_PERMUTATIONS) {
      const list = ORDERS[`core, then ${p.join(" ")}`] as readonly string[];
      expect(list.indexOf("CF-A.S4")).toBeLessThan(list.indexOf(`${p[0]}1.L01`));
    }
    // The ten track decks are in the catalog with their cards.
    const ids = new Set(simCatalogOf(families, decks, early).deckBatches.map(([id]) => id));
    for (const d of WAVE7_DECKS) expect([d.id, ids.has(d.id)]).toEqual([d.id, true]);
    expect(TRACK_FAMILIES.size).toBeGreaterThanOrEqual(6);
  });

  test("every run reaches session 270 of its order", () => {
    for (const { order, t, seed, end, last } of runs)
      expect([order, t, seed, last, end >= 0]).toEqual([order, t, seed, last, true]);
  });

  test("budget, 12 active, oldest due 7 d, first review within 7 d (none unreviewed), 'a little more' p95 720 s, on every run", () => {
    for (const { order, t, seed, r } of runs) {
      const s = r.summary;
      const where = [order, t, seed];
      expect([...where, s.plannedSec.p95 <= SIM_GATE.p95WarmupSec[t]]).toEqual([...where, true]);
      expect([...where, s.maxActivePerceptual <= SIM_GATE.maxActive]).toEqual([...where, true]);
      expect([...where, s.oldestUndeliveredDays.p95 <= SIM_GATE.p95OldestDueDays]).toEqual([...where, true]);
      expect([...where, s.firstReviewWait.all.max <= SIM_GATE.firstReviewWaitDays]).toEqual([...where, true]);
      expect([...where, s.firstReviewWait.all.censored]).toEqual([...where, 0]);
      expect([...where, s.reviewMoreSec.p95 <= SIM_GATE.p95ReviewDaySec]).toEqual([...where, true]);
    }
  });

  test("the track families are all seeded and reviewed on every run; never more than 12 active on any day", () => {
    for (const { order, t, seed, r } of runs) {
      const seeded = new Set(r.summary.firstReviewWait.perFamily.map((w) => w.family));
      for (const f of TRACK_FAMILIES)
        expect([order, t, seed, f, seeded.has(f)]).toEqual([order, t, seed, f, true]);
      expect([order, t, seed, Math.max(...r.rows.map((x) => x.activePerceptual))]).toEqual([
        order,
        t,
        seed,
        r.summary.maxActivePerceptual,
      ]);
    }
  });

  test("the decks drain: the track decks' cards are dealt by the end of every run (a handful at most still to come)", () => {
    for (const { order, t, seed, r } of runs) {
      expect([order, t, seed, r.summary.deckPending.atEnd <= 10]).toEqual([order, t, seed, true]);
      expect(r.summary.factCards).toBeGreaterThanOrEqual(cards - 10);
    }
  });
});
