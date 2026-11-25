// The 300-day review-load simulation of contracts §7.4, promoted from spikes/s7-srs/sim.ts and re-cut to
// run the production modules end to end: `createSrs` (ts-fsrs behind Oak's floors, caps and day pick),
// `planWarmup`, `smoothBacklog`, the Again-cascade cap, `admitCreated`, `admitNew`, `capLessonFacts`,
// `shouldGraduate`, `earlyGraduate`, `intervalCap`, composite sets with member recall, `stepLevel`,
// `otherWorkCredit`, `makeDayPicker`, `planReviewDay`, and the wait bound of decision 27
// (`planOverdueReleases`, resting families, `pickRestReturn`).
//
// Deterministic: every draw is mulberry32(FNV-1a(seed | event key)); no Math.random, no wall clock.
//
// Simplifications (each named so a reader can judge the result): a level opens at its gate lessons (the
// catalog's `levelGates`), but the categories inside a level are not modelled; repair queues, debt and
// checkpoint failure are not modelled (checkpoints and capstones are always passed); the anchor set is
// evidence only and changes no level; a gym session gives evidence to the dictation families like a lesson.

import { compositeSetSec, memberNeedsRecall, planCompositeSet } from "../composite.ts";
import {
  BLOCKED_INTRO_SETS,
  GOVERNOR,
  WARMUP_BUDGET_SEC,
  WARMUP_GYM_SEC,
  WARMUP_SHORT_SEC,
} from "../constants.ts";
import { dayStartInstant } from "../days.ts";
import type { WaitingCard } from "../governor.ts";
import {
  type ActiveFamily,
  admitCreated,
  capLessonFacts,
  earlyGraduate,
  intakeForecast,
  intervalCap,
  landingDay,
  likelyPracticeDays,
  makeDayPicker,
  otherWorkCredit,
  pickReleases,
  pickRestReturn,
  planOverdueReleases,
  returnMode,
  shouldGraduate,
  smoothBacklog,
} from "../governor.ts";
import { factGrade, stepGrade } from "../grade.ts";
import { type ItemMeta, reviewItem } from "../items.ts";
import { stepLevel } from "../level.ts";
import { planReviewDay, planWarmup } from "../planner.ts";
import type { Card, GovernorConfig, Rating, ReviewItem, ReviewOutcome, Srs } from "../types.ts";
import { buildTimeline, maxOpenLevelOf, type SimEntry, type SimFamily } from "./catalog.ts";
import { memoSrs } from "./memo.ts";

// --- randomness -----------------------------------------------------------------------------------

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] as number;
}

// --- options --------------------------------------------------------------------------------------

export interface LearnerModel {
  /** Per-trial success at a level after k sets there: asymptote − startGap·e^(−k/tau). */
  asymptote: number;
  startGap: number;
  tau: number;
  dayNoise: number;
  /** A set that goes badly for reasons outside skill (tired, distracted): probability and credit lost. */
  badSetProb: number;
  badSetDrop: number;
  nEffMin: number;
  fastProb: number;
  compositeP: number;
  conceptP: number;
  forgetSlope: number;
  layoff3: number;
  layoff10: number;
  factNewP: number;
  factBias: number;
  factFastProb: number;
  factHintProb: number;
  inLessonEvidenceProb: number;
  inLessonWindow: number;
  /**
   * The learner just went through this material with feedback: for a card reviewed within the last
   * `relearnDays` days, the recall that drives forgetting is at least this. Without it the model's learner
   * follows FSRS-7 into a lapse loop no real learner shows: after a few Agains a card's stability falls below
   * a day, its predicted recall the next morning is near zero, and a learner whose success is that recall
   * fails it every session for months (one run in five did, at 70% credit, which is not the contract's learner).
   */
  relearnFloor: number;
  relearnDays: number;
}
/** The contract's simulated learner: about 85% mean credit, about 10% of sets below 0.65. */
export const DEFAULT_LEARNER: LearnerModel = {
  asymptote: 0.95,
  startGap: 0.16,
  tau: 2.5,
  dayNoise: 0.03,
  badSetProb: 0.05,
  badSetDrop: 0.3,
  nEffMin: 8,
  fastProb: 0.4,
  compositeP: 0.9,
  conceptP: 0.88,
  forgetSlope: 0.6,
  layoff3: 0.03,
  layoff10: 0.08,
  factNewP: 0.85,
  factBias: -0.02,
  factFastProb: 0.3,
  factHintProb: 0.05,
  inLessonEvidenceProb: 0.5,
  inLessonWindow: 6,
  relearnFloor: 0.7,
  relearnDays: 3,
};

export interface SimOptions {
  seed: string;
  days: number;
  targetMinutes: 15 | 20 | 25;
  /** 'weekdays' = Monday to Friday; 'random5' = five random days each week. */
  calendar: "weekdays" | "random5";
  /** Inclusive [first, last] day ranges with no practice. */
  gaps: [number, number][];
  governor: GovernorConfig;
  learner: LearnerModel;
  /** Tested terms a lesson would like to turn into fact cards (decision 2 caps the cards at 2). */
  termsPerLesson: number;
  durationJitter: number;
  /** A lesson takes this many sessions: 2 at the 15-minute target (the split of contracts §9.4). */
  sessionsPerLesson?: number;
  /** The catalog to introduce: the course's real one (`COURSE_CATALOG` of course-catalog.test-util.ts). */
  catalog: SimCatalog;
}
/** Families, their later level gates and the fact-deck batches a simulation introduces. */
export interface SimCatalog {
  families: readonly SimFamily[];
  levelGates: Readonly<Record<string, Readonly<Record<number, readonly string[]>>>>;
  deckBatches: readonly (readonly [string, string, number, number])[];
  /** The sessions in the order the learner meets them (lessons, checkpoints, capstones, gym slots). */
  order: readonly string[];
}

// --- results --------------------------------------------------------------------------------------

export interface SessionRow {
  day: number;
  gap: number;
  entry: string;
  kind: SimEntry["kind"] | "light";
  budgetSec: number;
  plannedSec: number;
  /** Seconds the warm-up really took (estimates ± jitter). */
  warmupSec: number;
  /** Everything due at session start, in seconds. */
  dueSec: number;
  overflowSec: number;
  /** Days since the oldest due card still undelivered after the warm-up was due (0 with none). */
  oldestUndeliveredDays: number;
  /** The card that has waited longest among the undelivered ones, and its class (`null` with none). */
  oldestUndelivered: { cardId: string; cls: ReviewItem["cls"] } | null;
  /** A reviews-only day planned from the same due items (`planReviewDay`), in seconds. */
  reviewDaySec: number;
  /**
   * The same day when the warm-up does not count against the 12-minute cap (d22): the whole day, and the part
   * "a little more" adds after the first block.
   */
  reviewDayOpenSec: number;
  reviewMoreSec: number;
  activePerceptual: number;
  deferredCards: number;
  deferredFamilies: number;
  /** Deferred perceptual and production families (the rest of `deferredFamilies` are concept families). */
  deferredPerceptual: number;
  deckPending: number;
}
export interface SimSummary {
  sessions: number;
  mapSessions: number;
  warmupSec: { p50: number; p95: number; max: number };
  plannedSec: { p95: number; max: number };
  oldestUndeliveredDays: { p95: number; max: number };
  deferredCards: { p95: number; max: number; atEnd: number };
  /** p95 of the deferred families, and of the perceptual and production ones among them. */
  deferredFamiliesP95: { all: number; perceptual: number };
  deckPending: { p95: number; atEnd: number };
  reviewDaySec: { p95: number; max: number };
  /** d22 (the warm-up outside the cap): the whole reviews-only day, and its "a little more" part. */
  reviewDayOpenSec: { p95: number; max: number };
  reviewMoreSec: { p95: number; max: number };
  maxActivePerceptual: number;
  overflowSteadySec: { p95: number };
  lateDays: { p95: number };
  families: {
    unlocked: number;
    atMastery: number;
    graduated: number;
    /** Resting in a composite at the end (decision 27), how many times a family rested, and came back. */
    resting: number;
    rests: number;
    returns: number;
    deferredAtEnd: number;
    waitDaysP95: number;
    recalled: number;
  };
  /**
   * Days a perceptual or production family waits from the lesson that seeded it to its first review set
   * (the amendment of the §7.4 gate: a bound on how long a deferred family waits, not on how many wait).
   * Days of the learner's own breaks are not counted. A family still unreviewed at the end counts the days
   * it has waited so far (`censored`). `deferred`: the families created deferred; `all`: every one.
   * `concept` and `conceptPerFamily`: the concept families created deferred, the same way.
   */
  firstReviewWait: {
    deferred: WaitStats;
    all: WaitStats;
    perFamily: FamilyWait[];
    concept: WaitStats;
    conceptPerFamily: FamilyWait[];
  };
  setCredit: { mean: number; below065: number };
  recallAtReview: { set: number; fact: number };
  ratings: Record<Rating, number>;
  /** Sessions after each gap until the overflow is back to at most one set (90 s); -1 = never. */
  sessionsToClearAfterGap: number[];
  factCards: number;
  /** Mean warm-up seconds per session by planned item kind. */
  spentByKind: Record<string, number>;
}
export interface WaitStats {
  n: number;
  p50: number;
  p95: number;
  max: number;
  /** Families not yet reviewed when the run ended. */
  censored: number;
}
export interface FamilyWait {
  family: string;
  seededDeferred: boolean;
  /** Day index of the seeding lesson. */
  seededDay: number;
  waitDays: number;
  censored: boolean;
}
export function waitStats(waits: readonly FamilyWait[]): WaitStats {
  const days = waits.map((w) => w.waitDays);
  return {
    n: waits.length,
    p50: percentile(days, 50),
    p95: percentile(days, 95),
    max: Math.max(0, ...days),
    censored: waits.filter((w) => w.censored).length,
  };
}
export interface SimResult {
  rows: SessionRow[];
  summary: SimSummary;
}

// --- state ----------------------------------------------------------------------------------------

interface FamS {
  def: SimFamily;
  card: Card | null;
  level: number;
  promoDay: number | null;
  /** Sets at the current level (drives the learning curve). */
  k: number;
  blockedRemaining: number;
  unlockDay: number;
  activatedDay: number;
  graduatedDay: number;
  unlockLesson: number;
  recentCredits: number[];
  recalled: boolean;
  deferredSeq: number;
  deferUntil: number;
  /** Created `deferred` by the lesson that seeded it (the intake throttle or the active cap held it back). */
  seededDeferred: boolean;
  /** Day index of the family's first review set (its first blocked-intro set), -1 until then. */
  firstReviewDay: number;
  /** Resting in its composite below its mastery level to make room (decision 27), since `restDay`. */
  resting: boolean;
  restDay: number;
  /** Back from resting: its next set is played with the practice its composite trials kept up. */
  returned: boolean;
}
interface CompS {
  id: string;
  card: Card | null;
  members: FamS[];
  deferUntil: number;
}
interface FactS {
  card: Card;
  deferredSeq: number;
  deferUntil: number;
}

const BASE_DAY_ISO = "2027-01-04"; // a Monday

const EARLY_FOR_TIME = process.env.NOEARLY !== "1";
export function simulate(srsIn: Srs, o: SimOptions): SimResult {
  // A read-through cache of the pure questions asked many times a day (sim/memo.ts): the same answers, faster.
  const srs = memoSrs(srsIn);
  const cfg = o.governor;
  const L = o.learner;
  const rng = (key: string) => mulberry32(fnv1a(`${o.seed}|${key}`));
  const base = srs.dayOf(dayStartInstant(BASE_DAY_ISO, srs.timeZone, srs.rolloverHour));
  const timeline = buildTimeline(o.catalog.order);
  const sessionsPerLesson = o.sessionsPerLesson ?? (o.targetMinutes === 15 ? 2 : 1);
  const lessonBudget = WARMUP_BUDGET_SEC[o.targetMinutes];

  // practice calendar
  const practice = new Array<boolean>(o.days).fill(false);
  const onBreak = new Array<boolean>(o.days).fill(false);
  for (const [a, b] of o.gaps) for (let d = a; d <= b && d < o.days; d++) onBreak[d] = true;
  /** Days from `from` to `to` (day indices), not counting the days of the learner's own breaks. */
  const ageDays = (from: number, to: number): number => {
    let n = 0;
    for (let d = from + 1; d <= to; d++) if (!onBreak[d - base]) n++;
    return n;
  };
  for (let w = 0; w * 7 < o.days; w++) {
    let off = [5, 6];
    if (o.calendar === "random5") {
      const r = rng(`week:${w}`);
      const a = Math.floor(r() * 7);
      let b = Math.floor(r() * 6);
      if (b >= a) b++;
      off = [a, b];
    }
    for (let d = 0; d < 7 && w * 7 + d < o.days; d++) practice[w * 7 + d] = !off.includes(d);
  }
  for (const [a, b] of o.gaps) for (let d = a; d <= b && d < o.days; d++) practice[d] = false;

  const catalog = o.catalog;
  const fams: FamS[] = catalog.families.map((def) => ({
    def,
    card: null,
    level: 1,
    promoDay: null,
    k: 0,
    blockedRemaining: 0,
    unlockDay: -1,
    activatedDay: -1,
    graduatedDay: -1,
    unlockLesson: -1,
    recentCredits: [],
    recalled: false,
    deferredSeq: 0,
    deferUntil: -1,
    seededDeferred: false,
    firstReviewDay: -1,
    resting: false,
    restDay: -1,
    returned: false,
  }));
  const famById = new Map(fams.map((f) => [f.def.id as string, f]));
  const comps = new Map<string, CompS>(
    (["pitch", "harmony", "rhythm"] as const).map((g) => [
      `fam.mix.${g}`,
      { id: `fam.mix.${g}`, card: null, members: [], deferUntil: -1 },
    ]),
  );
  const facts = new Map<string, FactS>();
  const deckQueue: { id: string; deck: string; perDay: number }[] = [];
  let seq = 0;
  let factSeq = 0;

  const isP = (f: FamS) => f.def.kind !== "C";
  const activeP = () => fams.filter((f) => isP(f) && f.card?.status === "active").length;
  const deferredCount = () =>
    fams.filter((f) => f.card?.status === "deferred").length +
    [...facts.values()].filter((x) => x.card.status === "deferred").length;

  const famMeta = (f: FamS, today: number): ItemMeta => ({
    cls: isP(f) ? "family" : "concept",
    family: f.def.id,
    domain: f.def.domain,
    sec: f.def.trialsPerSet * f.def.estTrialSec,
    mic: f.def.mic,
    perceptual: isP(f),
    skills: [],
    blockedIntroPending: f.blockedRemaining > 0,
    ...(isP(f) && cfg.activeMaxIntervalDays !== null ? { repeatDays: cfg.activeMaxIntervalDays } : {}),
    ...(f.deferUntil > today ? { deferUntilDay: f.deferUntil } : {}),
  });
  const compMeta = (c: CompS, today: number): ItemMeta => ({
    cls: "composite",
    family: c.id as SimFamily["id"],
    domain: `mix.${c.id}`,
    sec: compositeSetSec(c.members.length),
    mic: false,
    perceptual: true,
    skills: [],
    ...(c.deferUntil > today ? { deferUntilDay: c.deferUntil } : {}),
  });
  const factMetaOf = (x: FactS, today: number): ItemMeta => ({
    cls: "fact",
    family: null,
    domain: "fact",
    sec: GOVERNOR.factCardSec,
    mic: false,
    perceptual: false,
    skills: [],
    ...(x.deferUntil > today ? { deferUntilDay: x.deferUntil } : {}),
  });

  /** Every active card as a planner item. */
  const allItems = (now: Date, today: number): ReviewItem[] => {
    const out: ReviewItem[] = [];
    for (const f of fams)
      if (f.card?.status === "active") out.push(reviewItem(srs, f.card, famMeta(f, today), now));
    for (const c of comps.values())
      if (c.card && c.members.length > 0) out.push(reviewItem(srs, c.card, compMeta(c, today), now));
    for (const x of facts.values())
      if (x.card.status === "active") out.push(reviewItem(srs, x.card, factMetaOf(x, today), now));
    return out;
  };

  // metrics
  const rows: SessionRow[] = [];
  const late: number[] = [];
  const setCredits: number[] = [];
  const recallSet: number[] = [];
  const recallFact: number[] = [];
  const ratings: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let recalledCount = 0;
  let restCount = 0;
  let returnCount = 0;
  let lastDay = -1;
  let cursor = 0;
  let lessonPart = 0;
  let lessonsDone = 0;
  let backlogUntil = -1;
  const sessionDays: number[] = [];
  const firstOffer = new Map<string, number>();
  const completed = new Set<string>();
  const openLevel = (f: FamS) => maxOpenLevelOf(f.def, catalog.levelGates[f.def.id] ?? {}, completed);
  const spent = new Map<string, number>();

  /** The recall that drives the simulated learner's forgetting on a set (`relearnFloor`). */
  const learnerRecall = (card: Card, predicted: number, now: Date): number => {
    if (!card.lastReviewAt) return predicted;
    const days = (now.getTime() - new Date(card.lastReviewAt).getTime()) / 86_400_000;
    return days <= L.relearnDays ? Math.max(predicted, L.relearnFloor) : predicted;
  };
  const pTrial = (f: FamS) =>
    f.def.kind === "C" ? L.conceptP : L.asymptote - L.startGap * Math.exp(-f.k / L.tau);
  const setOutcome = (
    key: string,
    p0: number,
    trials: number,
    recall: number,
    target: number,
    layoff: number,
    fastRtMs: number,
  ): ReviewOutcome => {
    const r = rng(key);
    const bad = r() < L.badSetProb ? L.badSetDrop : 0;
    const p = clamp(
      p0 + L.dayNoise * gauss(r) - L.forgetSlope * Math.max(0, target - recall) - layoff - bad,
      0.2,
      0.99,
    );
    const n = Math.max(trials, L.nEffMin);
    const meanCredit = clamp(p + Math.sqrt((p * (1 - p)) / n) * gauss(r), 0, 1);
    const fast = r() < L.fastProb;
    return {
      meanCredit,
      medianRtMs: fast ? 0.8 * fastRtMs : 1.3 * fastRtMs,
      fastRtMs,
      extraReplays: 0,
      hintRung: 0,
      revealed: false,
      atOrAboveLevel: true,
    };
  };

  for (let d = 0; d < o.days; d++) {
    if (!practice[d]) continue;
    const today = base + d;
    const hour = 7 + 14 * rng(`hour:${d}`)();
    const now = new Date(
      dayStartInstant(today, srs.timeZone, srs.rolloverHour).getTime() +
        (hour - srs.rolloverHour) * 3_600_000,
    );
    const gap = lastDay < 0 ? 0 : d - lastDay - 1;
    const mode = returnMode(gap);
    const layoff = gap >= 10 ? L.layoff10 : gap >= 3 ? L.layoff3 : 0;
    const likely = likelyPracticeDays(sessionDays, today);

    // What the New block is today.
    const light = (mode === "light" || mode === "light+loosen") && cursor < timeline.length;
    const entry: SimEntry | null = light ? null : (timeline[cursor] ?? null);
    const kind: SessionRow["kind"] = light ? "light" : (entry?.kind ?? "lesson");
    const budgetSec =
      kind === "checkpoint" || kind === "capstone"
        ? WARMUP_SHORT_SEC
        : kind === "gym"
          ? WARMUP_GYM_SEC
          : lessonBudget;
    const dayCfg: GovernorConfig = { ...cfg, budgetSec };
    // The intake throttle measures the forecast against the warm-up budget of the sessions the window
    // will really hold: checkpoint, capstone and gym days have shorter warm-ups than lesson days.
    const intakeCfg: GovernorConfig = intakeCfgNow();

    // (1) After a gap of 3 days or more: spread the overdue backlog over 5 to 7 days.
    if (gap >= 3) {
      const overdue = allItems(now, today).filter((it) => it.dueDay <= today);
      const spread = smoothBacklog(overdue, today, intakeCfg);
      for (const [id, until] of spread) {
        const f = famById.get(id);
        const c = comps.get(id);
        const x = facts.get(id);
        if (f) f.deferUntil = until;
        else if (c) c.deferUntil = until;
        else if (x) x.deferUntil = until;
        backlogUntil = Math.max(backlogUntil, until);
      }
    }
    const backlogMode = today <= backlogUntil;
    const newToday = { families: 0, facts: 0 };

    // (2) Releases and deck introductions (never while a backlog is being cleared, except the wait bound).
    if (!backlogMode) {
      // A recalled composite member takes the first free slot.
      for (const f of fams) {
        if (!f.recalled || !f.card || activeP() >= cfg.maxActivePerceptual) continue;
        f.recalled = false;
        f.resting = false;
        f.card = srs.rate({ ...f.card, status: "active" }, 1, now).card;
        for (const c of comps.values()) c.members = c.members.filter((m) => m !== f);
      }
    }
    // The wait bound (decision 27): a family past it is released today, and room is made for it.
    const overdue = planOverdueReleases({
      items: allItems(now, today),
      waiting: waitingCards(today),
      active: activeFamilies(),
      activePerceptual: activeP(),
      today,
      cfg: intakeCfg,
    });
    for (const id of overdue.graduate) graduate(famById.get(id) as FamS, now, d);
    for (const id of overdue.rest) {
      graduate(famById.get(id) as FamS, now, d, true);
      restCount++;
    }
    for (const id of overdue.release) release(famById.get(id) as FamS, today, now);
    if (!backlogMode) {
      const items = allItems(now, today);
      const releaseCfg: GovernorConfig = {
        ...intakeCfg,
        releasePerDay: {
          ...intakeCfg.releasePerDay,
          families: Math.max(0, intakeCfg.releasePerDay.families - overdue.release.length),
        },
      };
      for (const id of pickReleases(items, waitingCards(today), activeP(), today, releaseCfg)) {
        const f = famById.get(id);
        const x = facts.get(id);
        if (f) release(f, today, now);
        else if (x) x.card = { ...x.card, status: "active", dueAt: now.toISOString() };
      }
      // A resting family comes back to its own card once nothing waits.
      const back = pickRestReturn({
        items: allItems(now, today),
        resting: fams
          .filter((f) => f.resting && !f.recalled)
          .map((f) => ({ cardId: f.def.id, restedDays: d - f.restDay, mic: f.def.mic })),
        waitingFamilies: fams.filter((f) => isP(f) && f.card?.status === "deferred").length,
        activePerceptual: activeP(),
        today,
        cfg: intakeCfg,
      });
      if (back !== null) {
        const f = famById.get(back) as FamS;
        f.resting = false;
        f.returned = true;
        f.card = { ...(f.card as Card), status: "active", dueAt: now.toISOString() };
        for (const c of comps.values()) c.members = c.members.filter((m) => m !== f);
        returnCount++;
      }

      // Deck cards not yet created are newer than any deferred fact card: they wait while one does.
      const factsWaiting = [...facts.values()].some((x) => x.card.status === "deferred");
      if (!factsWaiting && intakeForecast(items, today, intakeCfg, 0, "facts").state !== "closed") {
        const perDeck = new Map<string, number>();
        for (let i = 0; i < deckQueue.length && newToday.facts < cfg.newPerDay.facts; ) {
          const q = deckQueue[i] as (typeof deckQueue)[number];
          const used = perDeck.get(q.deck) ?? 0;
          if (used >= q.perDay) {
            i++;
            continue;
          }
          perDeck.set(q.deck, used + 1);
          deckQueue.splice(i, 1);
          facts.set(q.id, { card: srs.createCard("fact", q.id, now), deferredSeq: 0, deferUntil: -1 });
          newToday.facts++;
        }
      }
    }

    // (3) Plan the warm-up.
    const items = allItems(now, today);
    const due = items.filter((it) => it.dueDay <= today);
    const dueSec = due.filter((it) => !it.fresh).reduce((a, it) => a + it.sec, 0);
    const mastered = fams
      .filter((f) => isP(f) && !f.def.mic && f.card && f.card.reps > 0 && f.level >= f.def.masteryLevel)
      .sort((a, b) => b.level - a.level || (a.def.id < b.def.id ? -1 : 1))[0];
    const anchorFallback = mastered
      ? {
          ...reviewItem(srs, mastered.card as Card, famMeta(mastered, today), now),
          sec: GOVERNOR.anchorTrials * mastered.def.estTrialSec,
        }
      : null;
    const plan = planWarmup(due, { today, gapDays: gap, anchorFallback, budgetSec }, dayCfg);
    const reviewDay = planReviewDay(
      due,
      { today, gapDays: gap, anchorFallback },
      { ...cfg, budgetSec: lessonBudget },
    );
    const reviewDayOpen = planReviewDay(
      due,
      { today, gapDays: gap, anchorFallback },
      { ...cfg, budgetSec: lessonBudget },
      { warmupCounts: false },
    );

    // (4) Run it.
    const loadByDay = new Map<number, number>();
    const addLoad = (day: number, sec: number) => {
      const land = landingDay(day, likely);
      loadByDay.set(land, (loadByDay.get(land) ?? 0) + sec);
    };
    for (const it of items) if (it.dueDay > today) addLoad(it.dueDay, it.sec);
    let warmupSec = 0;
    let againsToday = 0;
    const held: ReviewItem[] = [];
    const quickRecall: FactS[] = [];
    const spend = (sec: number, key: string) => {
      warmupSec += sec * (1 + o.durationJitter * (2 * rng(`dur:${key}`)() - 1));
      const k = key.split(":")[0] as string;
      spent.set(k, (spent.get(k) ?? 0) + sec);
    };
    const review = (card: Card, outcome: ReviewOutcome, sec: number, cap: number | undefined) => {
      const res = srs.review(card, outcome, now, {
        pickDay: makeDayPicker(loadByDay, today, likely),
        ...(cap !== undefined ? { maxIntervalDays: cap } : {}),
      });
      ratings[res.rating]++;
      if (res.rating === 1 && card.state === 2) againsToday++;
      addLoad(srs.dayOf(res.card.dueAt), sec);
      return res;
    };
    const heldBack = (it: ReviewItem) =>
      backlogMode && againsToday >= 3 && !it.fresh && !it.firstSet && it.recall < 0.6;

    for (const p of plan.items) {
      const key = `${p.kind}:${p.item.cardId}:${d}`;
      if (p.kind === "listen" || p.kind === "anchor") {
        spend(p.estSec, key);
        continue;
      }
      if (p.kind === "fact-set") {
        for (const id of p.cardIds) {
          const x = facts.get(id);
          if (!x) continue;
          const it = due.find((u) => u.cardId === id);
          if (it && heldBack(it)) {
            held.push(it);
            continue;
          }
          const recall = srs.retrievability(x.card, now);
          const isNew = x.card.reps === 0;
          const r = rng(`fact:${id}:${x.card.reps}`);
          const correct = r() < (isNew ? L.factNewP : clamp(recall + L.factBias - layoff, 0.2, 0.99));
          const u = r();
          const rt = u < L.factFastProb ? 2000 : u > 0.92 ? 9000 : 4000;
          const rating = factGrade(correct, rt, 2500, r() < L.factHintProb);
          if (!isNew) {
            recallFact.push(recall);
            late.push(today - srs.dayOf(x.card.dueAt));
          }
          const before = x.card;
          const res = srs.rate(x.card, rating, now, { pickDay: makeDayPicker(loadByDay, today, likely) });
          ratings[rating]++;
          if (rating === 1 && before.state === 2) againsToday++;
          addLoad(srs.dayOf(res.card.dueAt), GOVERNOR.factCardSec);
          x.card = res.card;
          x.deferUntil = -1;
          spend(GOVERNOR.factCardSec, `${key}:${id}`);
          if (!correct) quickRecall.push(x);
        }
        continue;
      }
      const it = p.item;
      if (heldBack(it)) {
        held.push(it);
        continue;
      }
      late.push(today - it.dueDay);
      if (it.cls === "composite") {
        const c = comps.get(it.cardId) as CompS;
        if (!c.card) continue;
        recallSet.push(it.recall);
        const setPlan = planCompositeSet(
          c.members.map((m) => ({
            family: m.def.id,
            recentCredits: m.recentCredits,
            mic: m.def.mic,
            recalled: m.recalled,
          })),
          { quiet: cfg.quiet, setKey: `${c.id}:${c.card.reps}` },
        );
        let sum = 0;
        let n = 0;
        for (const m of setPlan.members) {
          const f = famById.get(m.family) as FamS;
          for (let t = 0; t < m.trials; t++) {
            const r = rng(`comp:${c.id}:${c.card.reps}:${m.family}:${t}`);
            const p0 = clamp(
              L.compositeP -
                L.forgetSlope * Math.max(0, srs.desiredRetention("composite") - it.recall) -
                layoff,
              0.2,
              0.99,
            );
            const credit = r() < p0 ? 1 : 0;
            f.recentCredits = [...f.recentCredits, credit].slice(-GOVERNOR.recallWindow);
            sum += credit;
            n++;
          }
          if (!f.recalled && memberNeedsRecall(f.recentCredits)) {
            f.resting = false;
            f.recalled = true;
            recalledCount++;
          }
        }
        const meanCredit = n === 0 ? 0.875 : sum / n;
        setCredits.push(meanCredit);
        const outcome: ReviewOutcome = {
          meanCredit,
          medianRtMs: 2000,
          fastRtMs: 2500,
          extraReplays: 0,
          hintRung: 0,
          revealed: false,
          atOrAboveLevel: true,
        };
        c.card = review(c.card, outcome, it.sec, intervalCap(c.card, true, cfg)).card;
        c.deferUntil = -1;
        spend(it.sec, key);
        continue;
      }
      const f = famById.get(it.cardId) as FamS;
      if (!f.card) continue;
      if (f.card.reps > 0) recallSet.push(it.recall);
      else if (f.firstReviewDay < 0) f.firstReviewDay = d;
      // Back from resting: its composite trials kept it in practice, so the composite's recall applies.
      const restedRecall = f.returned ? compRecall(f, now) : 0;
      f.returned = false;
      const outcome = setOutcome(
        `set:${key}`,
        pTrial(f),
        f.def.trialsPerSet,
        f.card.reps === 0 ? 1 : Math.max(restedRecall, learnerRecall(f.card, it.recall, now)),
        srs.desiredRetention(f.card.kind),
        layoff,
        f.def.fastRtMs,
      );
      setCredits.push(outcome.meanCredit);
      f.card = review(f.card, outcome, it.sec, intervalCap(f.card, isP(f), cfg)).card;
      f.deferUntil = -1;
      if (f.blockedRemaining > 0) f.blockedRemaining--;
      spend(it.sec, key);
      climb(f, outcome.meanCredit, today);
      maybeGraduate(f, now, today, d);
    }
    // A missed fact's 5-minute step lands in the quick-recall strip (outside the warm-up), at most 3 cards.
    for (const x of quickRecall.slice(0, 3)) {
      const later = new Date(now.getTime() + 20 * 60_000);
      const r = rng(`qr:${x.card.id}:${x.card.reps}`);
      const rating: Rating = r() < 0.9 ? 3 : 1;
      x.card = srs.rate(x.card, rating, later).card;
      ratings[rating]++;
    }

    const undelivered = [...plan.overflow, ...held];
    // Age of an undelivered card: days since the first session that offered it (its due day, or the day
    // backlog smoothing gave it). Days of the learner's own break are not the governor's to count.
    const stillDue = new Set(undelivered.map((it) => it.cardId));
    for (const id of [...firstOffer.keys()]) if (!stillDue.has(id)) firstOffer.delete(id);
    for (const it of undelivered) {
      if ((it.deferUntilDay ?? today) > today) continue;
      if (!firstOffer.has(it.cardId)) firstOffer.set(it.cardId, today);
    }
    let oldest = 0;
    let oldestItem: ReviewItem | null = null;
    for (const it of undelivered) {
      const age = ageDays(firstOffer.get(it.cardId) ?? today, today);
      if (age > oldest) {
        oldest = age;
        oldestItem = it;
      }
    }
    const overflowSec = undelivered.filter((it) => !it.fresh).reduce((a, it) => a + it.sec, 0);

    // (5) The New block.
    let entryLabel = light ? "light" : (entry?.id ?? "free");
    if (!light && entry) {
      let finishes = true;
      if (entry.kind === "lesson" && sessionsPerLesson > 1) {
        lessonPart++;
        finishes = lessonPart >= sessionsPerLesson;
        if (!finishes) entryLabel = `${entry.id}(A)`;
      }
      if (finishes) {
        lessonPart = 0;
        cursor++;
        if (entry.kind === "lesson") {
          lessonsDone++;
          completed.add(entry.id);
          // A graduated member whose next level just opened is recalled and climbs on (contracts §7.4).
          for (const f of fams) {
            if (f.card?.status !== "graduated" || f.recalled || f.resting) continue;
            if (f.level < f.def.masteryLevel && openLevel(f) > f.level) {
              f.recalled = true;
              recalledCount++;
            }
          }
        }
        // In-lesson and gym evidence for recently unlocked families (contracts §7.4 review-if-due).
        if (entry.kind === "lesson" || entry.kind === "gym" || entry.kind === "checkpoint") {
          for (const f of fams) {
            // Active families, and deferred ones: a waiting family's in-lesson practice still counts as evidence.
            if (!f.card || (f.card.status !== "active" && f.card.status !== "deferred")) continue;
            if (f.card.status === "active" && f.card.reps === 0) continue;
            if (entry.kind === "gym" && f.def.trialsPerSet * f.def.estTrialSec < 85) continue;
            if (entry.kind !== "gym" && lessonsDone - f.unlockLesson > L.inLessonWindow) continue;
            const key = `lesson:${entry.id}:${f.def.id}`;
            if (rng(key)() >= L.inLessonEvidenceProb) continue;
            const recall =
              f.card.reps === 0 ? 1 : learnerRecall(f.card, srs.retrievability(f.card, now), now);
            const outcome = setOutcome(
              `set:${key}`,
              pTrial(f),
              f.def.trialsPerSet,
              recall,
              srs.desiredRetention(f.card.kind),
              0,
              f.def.fastRtMs,
            );
            climb(f, outcome.meanCredit, today);
            const verdict = otherWorkCredit({
              source: otherWorkSource(entry.kind),
              status: f.card.status,
              dueDay: srs.dayOf(f.card.dueAt),
              today,
            });
            if (verdict === "review") {
              f.card = review(
                f.card,
                outcome,
                f.def.trialsPerSet * f.def.estTrialSec,
                intervalCap(f.card, isP(f), cfg),
              ).card;
            }
            maybeGraduate(f, now, today, d);
          }
        }
        if (entry.kind === "lesson") seedLesson(entry.id, now, today, d, newToday);
      }
    }

    rows.push({
      day: d,
      gap,
      entry: entryLabel,
      kind,
      budgetSec,
      plannedSec: plan.plannedSec,
      warmupSec,
      dueSec,
      overflowSec,
      oldestUndeliveredDays: oldest,
      oldestUndelivered: oldestItem ? { cardId: oldestItem.cardId, cls: oldestItem.cls } : null,
      reviewDaySec: reviewDay.plannedSec,
      reviewDayOpenSec: reviewDayOpen.plannedSec,
      reviewMoreSec: reviewDayOpen.moreSec,
      activePerceptual: activeP(),
      deferredCards: deferredCount(),
      deferredFamilies: fams.filter((f) => f.card?.status === "deferred").length,
      deferredPerceptual: fams.filter((f) => isP(f) && f.card?.status === "deferred").length,
      deckPending: deckQueue.length,
    });
    lastDay = d;
    sessionDays.push(today);
  }

  // --- helpers that close over the state ---

  function intakeCfgNow(): GovernorConfig {
    return { ...cfg, budgetSec: upcomingBudget(cursor, lessonPart) };
  }
  /** Mean warm-up budget of the next sessions of the course (as many as the forecast window holds). */
  function upcomingBudget(from: number, part: number): number {
    const n = Math.max(1, Math.round((cfg.forecastDays * Math.min(7, cfg.sessionsPerWeek)) / 7));
    const budgets: number[] = [];
    let i = from;
    let p = part;
    while (budgets.length < n && i < timeline.length) {
      const e = timeline[i] as SimEntry;
      budgets.push(budgetOf(e.kind));
      if (e.kind === "lesson" && ++p < sessionsPerLesson) continue;
      p = 0;
      i++;
    }
    while (budgets.length < n) budgets.push(lessonBudget);
    return budgets.reduce((a, b) => a + b, 0) / budgets.length;
  }
  function budgetOf(kind: SessionRow["kind"]): number {
    return kind === "checkpoint" || kind === "capstone"
      ? WARMUP_SHORT_SEC
      : kind === "gym"
        ? WARMUP_GYM_SEC
        : lessonBudget;
  }

  /** Active perceptual families that could join a composite, as `earlyGraduate` reads them. */
  function graduationCandidates() {
    return fams
      .filter((f) => isP(f) && f.card?.status === "active" && f.def.mix)
      .map((f) => ({
        cardId: f.def.id,
        level: f.level,
        masteryLevel: f.def.masteryLevel,
        maxOpenLevel: openLevel(f),
        t90Days: srs.intervalAt(f.card as Card, 0.9),
        lastRatings: (f.card as Card).lastRatings,
      }));
  }
  /** Every deferred card as `pickReleases` reads it. */
  function waitingCards(today: number): WaitingCard[] {
    return [
      ...fams
        .filter((f) => f.card?.status === "deferred")
        .map(
          (f): WaitingCard => ({
            cardId: f.def.id,
            kind: !isP(f) ? "concept" : f.def.mic ? "production" : "perceptual",
            seq: f.deferredSeq,
            waitedDays: ageDays(base + f.unlockDay, today),
          }),
        ),
      ...[...facts.entries()]
        .filter(([, x]) => x.card.status === "deferred")
        .map(([id, x]): WaitingCard => ({ cardId: id, kind: "fact", seq: x.deferredSeq })),
    ];
  }
  /** Active perceptual families with a composite, as the wait bound's room-making reads them. */
  function activeFamilies(): ActiveFamily[] {
    return graduationCandidates().map((g) => {
      const f = famById.get(g.cardId) as FamS;
      return {
        ...g,
        mic: f.def.mic,
        reps: (f.card as Card).reps,
        blockedIntroPending: f.blockedRemaining > 0,
      };
    });
  }
  /** The recall of the composite a family is a member of (0 with none). */
  function compRecall(f: FamS, now: Date): number {
    const c = f.def.mix ? comps.get(`fam.mix.${f.def.mix}`) : undefined;
    return c?.card ? srs.retrievability(c.card, now) : 0;
  }
  function release(f: FamS, today: number, now: Date) {
    if (!f.card) return;
    f.card = { ...f.card, status: "active", dueAt: now.toISOString() };
    f.activatedDay = today - base;
    f.blockedRemaining = isP(f) ? BLOCKED_INTRO_SETS : 0;
  }
  function climb(f: FamS, credit: number, today: number) {
    const before = f.level;
    const next = stepLevel({ level: f.level, promoDay: f.promoDay }, credit, today, {
      maxOpenLevel: openLevel(f),
      topLevel: f.def.topLevel,
    });
    f.level = next.level;
    f.promoDay = next.promoDay;
    f.k = next.level === before ? f.k + 1 : next.change === "demoted" ? 3 : 0;
  }
  function graduate(f: FamS, now: Date, d: number, rest = false) {
    if (!f.card || !f.def.mix) return;
    f.card = { ...f.card, status: "graduated" };
    f.graduatedDay = d;
    f.resting = rest;
    f.restDay = rest ? d : -1;
    const c = comps.get(`fam.mix.${f.def.mix}`) as CompS;
    c.members.push(f);
    if (!c.card) {
      // The graduating set doubles as the composite card's first review.
      c.card = srs.rate(srs.createCard("composite", c.id, now), 3, now).card;
    }
  }
  function maybeGraduate(f: FamS, now: Date, _today: number, d: number) {
    if (!isP(f) || !f.card || f.card.status !== "active" || !f.def.mix) return;
    if (
      shouldGraduate(
        {
          level: f.level,
          masteryLevel: f.def.masteryLevel,
          maxOpenLevel: openLevel(f),
          t90Days: srs.intervalAt(f.card, 0.9),
          lastRatings: f.card.lastRatings,
        },
        cfg,
      )
    ) {
      graduate(f, now, d);
    }
  }
  function seedLesson(
    lessonId: string,
    now: Date,
    today: number,
    d: number,
    newToday: { families: number; facts: number },
  ) {
    const unlocking = fams.filter((f) => f.def.unlock === lessonId && !f.card);
    const perceptual = unlocking.filter((f) => isP(f) && !f.def.mic);
    const production = unlocking.filter((f) => isP(f) && f.def.mic);
    const concept = unlocking.filter((f) => !isP(f));
    const terms = Array.from(
      { length: o.termsPerLesson },
      (_, i) => `fact.${lessonId.toLowerCase()}.t${i + 1}`,
    );
    const tested = capLessonFacts(terms, cfg).cards;
    const candidates = graduationCandidates;
    // The cap is hit: graduate the strongest family at its mastery level early, if there is one.
    while (
      perceptual.length + production.length > 0 &&
      activeP() + perceptual.length + production.length > cfg.maxActivePerceptual
    ) {
      const pick = earlyGraduate(candidates(), cfg);
      if (!pick) break;
      graduate(famById.get(pick) as FamS, now, d);
    }
    const admitNow = () =>
      admitCreated({
        items: allItems(now, today),
        today,
        perceptual: perceptual.length,
        production: production.length,
        concept: concept.length,
        facts: tested.length,
        activePerceptual: activeP(),
        newToday,
        cfg: intakeCfgNow(),
      });
    let admit = admitNow();
    // The time cap is hit (the throttle would leave a new family waiting): the same rule.
    while (
      EARLY_FOR_TIME &&
      admit.perceptual + admit.production < perceptual.length + production.length &&
      newToday.families + admit.perceptual + admit.production + admit.concept < cfg.newPerDay.families
    ) {
      const pick = earlyGraduate(candidates(), cfg, "time");
      if (!pick) break;
      graduate(famById.get(pick) as FamS, now, d);
      admit = admitNow();
    }
    newToday.families += admit.perceptual + admit.production + admit.concept;
    newToday.facts += admit.facts;
    // The lesson step that seeds a concept or term card rates it on its first-attempt score (contracts
    // §7.2); a perceptual family's first sets are blocked-intro sets in the next warm-ups (§7.4).
    const stepRating = (key: string, p: number): Rating => {
      const r = rng(key);
      const score = clamp(p + 0.08 * gauss(r), 0, 1);
      return stepGrade(score, { hintRung: 0, revealed: false, extraReplays: 0 });
    };
    const seed = (f: FamS, active: boolean) => {
      f.unlockDay = d;
      f.unlockLesson = lessonsDone;
      f.card = srs.createCard(isP(f) ? "family" : "concept", f.def.id, now, active ? "active" : "deferred");
      f.seededDeferred = !active;
      if (active) release(f, today, now);
      else f.deferredSeq = ++seq;
      if (active && !isP(f)) {
        const rating = stepRating(`seed:${f.def.id}`, L.conceptP);
        f.card = srs.rate(f.card, rating, now).card;
        ratings[rating]++;
      }
    };
    perceptual.forEach((f, i) => {
      seed(f, i < admit.perceptual);
    });
    production.forEach((f, i) => {
      seed(f, i < admit.production);
    });
    concept.forEach((f, i) => {
      seed(f, i < admit.concept);
    });
    tested.forEach((id, i) => {
      const active = i < admit.facts;
      let card = srs.createCard("fact", id, now, active ? "active" : "deferred");
      if (active) {
        const rating = stepRating(`seed:${id}`, L.factNewP + 0.05);
        card = srs.rate(card, rating, now).card;
        ratings[rating]++;
      }
      facts.set(id, { card, deferredSeq: active ? 0 : ++seq, deferUntil: -1 });
    });
    for (const [deck, lesson, n, perDay] of catalog.deckBatches) {
      if (lesson !== lessonId) continue;
      for (let i = 0; i < n; i++) deckQueue.push({ id: `fact.${deck.slice(5)}.${factSeq++}`, deck, perDay });
    }
  }

  // --- summary ---
  const perceptual = fams.filter(isP);
  const unlocked = perceptual.filter((f) => f.card);
  const waits = unlocked.map((f) => (f.activatedDay >= 0 ? f.activatedDay : o.days - 1) - f.unlockDay);
  const lastPractised = rows[rows.length - 1]?.day ?? o.days - 1;
  const firstReview: FamilyWait[] = unlocked.map((f) => {
    const censored = f.firstReviewDay < 0;
    const end = censored ? lastPractised : f.firstReviewDay;
    return {
      family: f.def.id,
      seededDeferred: f.seededDeferred,
      seededDay: f.unlockDay,
      waitDays: ageDays(base + f.unlockDay, base + end),
      censored,
    };
  });
  // Concept families (no active slot): a lesson's seeding step rates one created active, so only those
  // created deferred wait, until their first set.
  const conceptWaits: FamilyWait[] = fams
    .filter((f) => !isP(f) && f.card && f.seededDeferred)
    .map((f) => {
      const censored = f.firstReviewDay < 0;
      return {
        family: f.def.id,
        seededDeferred: true,
        seededDay: f.unlockDay,
        waitDays: ageDays(base + f.unlockDay, base + (censored ? lastPractised : f.firstReviewDay)),
        censored,
      };
    });
  const inReturn = new Set<number>();
  const sessionsToClearAfterGap = o.gaps.map(([, end]) => {
    const i = rows.findIndex((r) => r.day > end);
    if (i < 0) return -1;
    for (let k = i; k < Math.min(rows.length, i + 8); k++) inReturn.add(k);
    const j = rows.findIndex((r, idx) => idx >= i && r.overflowSec <= 90);
    return j < 0 ? -1 : j - i + 1;
  });
  const steady = rows.filter((_, i) => !inReturn.has(i));
  const mean = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
  const last = rows[rows.length - 1];
  const summary: SimSummary = {
    sessions: rows.length,
    mapSessions: cursor,
    warmupSec: {
      p50: percentile(
        rows.map((r) => r.warmupSec),
        50,
      ),
      p95: percentile(
        rows.map((r) => r.warmupSec),
        95,
      ),
      max: Math.max(0, ...rows.map((r) => r.warmupSec)),
    },
    plannedSec: {
      p95: percentile(
        rows.map((r) => r.plannedSec),
        95,
      ),
      max: Math.max(0, ...rows.map((r) => r.plannedSec)),
    },
    oldestUndeliveredDays: {
      p95: percentile(
        rows.map((r) => r.oldestUndeliveredDays),
        95,
      ),
      max: Math.max(0, ...rows.map((r) => r.oldestUndeliveredDays)),
    },
    deferredCards: {
      p95: percentile(
        rows.map((r) => r.deferredCards),
        95,
      ),
      max: Math.max(0, ...rows.map((r) => r.deferredCards)),
      atEnd: last?.deferredCards ?? 0,
    },
    deferredFamiliesP95: {
      all: percentile(
        rows.map((r) => r.deferredFamilies),
        95,
      ),
      perceptual: percentile(
        rows.map((r) => r.deferredPerceptual),
        95,
      ),
    },
    deckPending: {
      p95: percentile(
        rows.map((r) => r.deckPending),
        95,
      ),
      atEnd: last?.deckPending ?? 0,
    },
    reviewDaySec: {
      p95: percentile(
        rows.map((r) => r.reviewDaySec),
        95,
      ),
      max: Math.max(0, ...rows.map((r) => r.reviewDaySec)),
    },
    reviewDayOpenSec: {
      p95: percentile(
        rows.map((r) => r.reviewDayOpenSec),
        95,
      ),
      max: Math.max(0, ...rows.map((r) => r.reviewDayOpenSec)),
    },
    reviewMoreSec: {
      p95: percentile(
        rows.map((r) => r.reviewMoreSec),
        95,
      ),
      max: Math.max(0, ...rows.map((r) => r.reviewMoreSec)),
    },
    maxActivePerceptual: Math.max(0, ...rows.map((r) => r.activePerceptual)),
    overflowSteadySec: {
      p95: percentile(
        steady.map((r) => r.overflowSec),
        95,
      ),
    },
    lateDays: { p95: percentile(late, 95) },
    families: {
      unlocked: unlocked.length,
      atMastery: unlocked.filter((f) => f.level >= f.def.masteryLevel).length,
      graduated: perceptual.filter((f) => f.card?.status === "graduated" && !f.resting).length,
      resting: perceptual.filter((f) => f.card?.status === "graduated" && f.resting).length,
      rests: restCount,
      returns: returnCount,
      deferredAtEnd: perceptual.filter((f) => f.card?.status === "deferred").length,
      waitDaysP95: percentile(waits, 95),
      recalled: recalledCount,
    },
    firstReviewWait: {
      deferred: waitStats(firstReview.filter((w) => w.seededDeferred)),
      all: waitStats(firstReview),
      perFamily: firstReview,
      concept: waitStats(conceptWaits),
      conceptPerFamily: conceptWaits,
    },
    setCredit: {
      mean: mean(setCredits),
      below065: setCredits.filter((c) => c < 0.65).length / Math.max(1, setCredits.length),
    },
    recallAtReview: { set: mean(recallSet), fact: mean(recallFact) },
    ratings,
    sessionsToClearAfterGap,
    factCards: facts.size,
    spentByKind: Object.fromEntries(
      [...spent].map(([k, v]) => [k, Math.round(v / Math.max(1, rows.length))]),
    ),
  };
  return { rows, summary };
}

function otherWorkSource(kind: SimEntry["kind"]): "lesson" | "gym" | "checkpoint" {
  return kind === "gym" ? "gym" : kind === "checkpoint" ? "checkpoint" : "lesson";
}
