// The server side of the SRS engineer's services (services/srs.ts, services/session-plan.ts): their
// storage and catalog ports over SQLite and the content index, and the `SrsPort` the routes call. The
// drill-session bookkeeping (start, trials, finish: category statistics, confusion pairs, evidence) is
// here; every scheduling decision is `SrsService`'s.
import type {
  DrillFinish,
  DrillSession,
  DueBatch,
  Evidence,
  FamilyState,
  NextSession,
  SessionPlan,
  SrsCard,
  SrsReviewResult,
  TrackFocusId,
  TrackOffer,
  WarmupItem,
} from "@oak/api";
import {
  type FamilyDef,
  type FamilyId,
  type LessonId,
  lessonBudget,
  type SessionId,
  type SkillId,
  skillOf,
} from "@oak/content-kit";
import {
  dayIndex,
  forecastLoad,
  GOVERNOR,
  LISTEN_BLOCK_SEC,
  REVIEW_DAY_MAX_SEC,
  type WarmupPlan,
} from "@oak/srs";
import type { ContentIndex } from "./content/index.ts";
import { tx } from "./db/index.ts";
import type { Repos } from "./db/repos/index.ts";
import type { FamilyStateRow } from "./db/repos/srs.ts";
import { badRequest, notFound } from "./errors.ts";
import { dayStartInstant } from "./lib/days.ts";
import { type Clock, LearnerTime, newId } from "./services/context.ts";
import { openFamilyLevels } from "./services/family-levels.ts";
import type { Services } from "./services/index.ts";
import { evidenceWeight } from "./services/mastery.ts";
import type { DrillSessionCreate, SessionPlannerPort, SrsPort, StepReviewInput } from "./services/ports.ts";
import { keepFirstAnswer } from "./services/retry.ts";
import {
  type CourseItem,
  type SessionPlanCoursePort,
  type SessionPlanLearnerPort,
  SessionPlanService,
  type SessionPlanSrsPort,
  SPLIT_ABOVE_MIN,
  warmupLabel,
} from "./services/session-plan.ts";
import {
  COMPOSITE_IDS,
  type SrsCatalogPort,
  type SrsLearnerPort,
  SrsService,
  type SrsStatePort,
  type SrsWorkingState,
} from "./services/srs.ts";
import { SESSION_TOTAL } from "./services/track-plan.ts";

const STATE_KEY = "srs.state";
/** The family sung resolutions are evidence for (contracts §7.3, §8.3). */
export const RESOLVE_FAMILY = "fam.deg.resolve" as FamilyId;

/** The governor's working state as one JSON value in `settings` (not a learner setting: `SettingsRepo.all` skips it). */
export function settingsStatePort(repos: Repos, clock: Clock): SrsStatePort {
  return {
    get() {
      const row = repos.db.query("SELECT value_json FROM settings WHERE key = ?").get(STATE_KEY) as {
        value_json: string;
      } | null;
      if (row === null) return null;
      try {
        return JSON.parse(row.value_json) as SrsWorkingState;
      } catch {
        return null;
      }
    },
    put(state) {
      repos.db
        .query(
          `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
        )
        .run(STATE_KEY, JSON.stringify(state), clock.now().toISOString());
    },
  };
}

export class CatalogAdapter implements SrsCatalogPort {
  constructor(
    private readonly content: ContentIndex,
    private readonly services: Services,
  ) {}
  #done(lesson: string): boolean {
    return this.services.gates.lessonCompleted(lesson);
  }
  family(id: FamilyId): FamilyDef | null {
    return this.content.family(id);
  }
  /**
   * Contracts §7.3 "Level and category gates": a category is open when its lesson is completed; a level opens at
   * its gate (every gate lesson completed) and needs at least one of the categories it adds open; a family is
   * promoted past a level only when every category of that level is open. The rule is the engine's own
   * (`maxOpenLevel` in @oak/drills), so the server never plays a level whose new material is still closed.
   */
  levelLimits(id: FamilyId): { maxOpenLevel: number; topLevel: number; openCategories: string[] } {
    const def = this.content.family(id);
    if (def === null) return { maxOpenLevel: 1, topLevel: 1, openCategories: [] };
    return openFamilyLevels(def, (l) => this.#done(l));
  }
  fact(cardId: string): { fastRtMs: number; skills: SkillId[] } | null {
    const f = this.content.fact(cardId);
    if (f !== null) return { fastRtMs: f.deck.fastRtMs, skills: [f.deck.unlock.skill] };
    // A tested term (`TermDef.card`): the skills its lesson introduces.
    for (const lesson of this.content.source.lessons)
      if (lesson.terms.some((t) => t.id === cardId && t.card !== undefined))
        return { fastRtMs: 4000, skills: [...lesson.introduces] };
    return null;
  }
  openDeckCards(): { cardId: string; deckId: string; newPerDay: number }[] {
    const out: { cardId: string; deckId: string; newPerDay: number }[] = [];
    for (const deck of this.content.source.decks)
      for (const card of deck.cards)
        if (this.#done(card.gate ?? deck.unlock.lesson))
          out.push({ cardId: card.id, deckId: deck.id, newPerDay: deck.newPerDay });
    return out;
  }
}

export class LearnerAdapter implements SrsLearnerPort {
  constructor(
    private readonly repos: Repos,
    private readonly content: ContentIndex,
    private readonly services: Services,
  ) {}
  profile() {
    const p = this.repos.profile.get();
    return {
      targetMinutes: p.targetMinutes,
      timeZone: p.timezone,
      rolloverHour: p.rolloverHour,
      // Quiet mode as the server decides it today (wave3.md §5.3): for today, always, or no usable mic.
      quiet: this.services.voice.quiet(),
      weeklyGoal: p.weeklyGoal,
      singToleranceCents: p.singToleranceCents,
    };
  }
  repairFamilies(): FamilyId[] {
    return [
      ...new Set(
        this.repos.checkpoints
          .repairs()
          .flatMap((r) => (r.familyId === null ? [] : [r.familyId as FamilyId])),
      ),
    ];
  }
  debtSkills(): SkillId[] {
    return this.services.mastery.debts() as SkillId[];
  }
  dayFloor(): string | null {
    return this.services.streak.time.activityFloor();
  }
  /** The next `n` sessions of the default order still to do (a split lesson at 15 minutes is two). */
  upcomingSessions(n: number): ("lesson" | "checkpoint" | "capstone" | "gym")[] {
    const out: ("lesson" | "checkpoint" | "capstone" | "gym")[] = [];
    const g = this.services.gates;
    const target = this.repos.profile.get().targetMinutes;
    for (const id of this.content.defaultOrder()) {
      if (out.length >= n) break;
      if (g.sessionDone(id)) continue;
      if (id.startsWith("GYM.") || id.startsWith("CF-T.")) out.push("gym");
      else if (this.content.checkpointMeta(id) !== null) out.push("checkpoint");
      else if (this.content.lessonSite(id) === null) out.push("capstone");
      else {
        const def = this.content.lessonDef(id);
        const split = target === 15 && def !== null && lessonBudget(def).scaledMinutes > SPLIT_ABOVE_MIN;
        const part = this.services.gates.lessonProgress(id).splitPart;
        out.push("lesson");
        if (split && part !== "A") out.push("lesson");
      }
    }
    return out.slice(0, n);
  }
  nextLessonSkills(): SkillId[] {
    const next = this.services.gates.nextMapItem();
    const meta = next === null ? null : this.content.lessonSite(next)?.meta;
    return meta === undefined || meta === null ? [] : [...meta.introduces, ...meta.practises];
  }
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** `SrsPort` over `SrsService`, plus the drill-set bookkeeping. */
export class SrsAdapter implements SrsPort {
  #recall: { at: number; map: Map<string, { retrievability: number; desiredRetention: number }> } | null =
    null;
  constructor(
    readonly service: SrsService,
    private readonly repos: Repos,
    private readonly content: ContentIndex,
    private readonly services: Services,
    private readonly catalog: CatalogAdapter,
    private readonly clock: Clock,
  ) {}

  #now(): Date {
    return this.clock.now();
  }
  #gap(): number {
    const day = this.service.day(this.#now());
    const last = this.repos.streak.lastQualifiedDay(day);
    return last === null ? 0 : dayIndex(day) - dayIndex(last);
  }
  #touched(): void {
    this.#recall = null;
  }

  /**
   * The scheduler counts days in the learner's zone: after a time-zone or rollover change in the profile it
   * is rebuilt before the next scheduling call (cards keep their instants; only the day arithmetic moves).
   */
  async ensureZone(): Promise<void> {
    if (await this.service.rezone()) this.#touched();
  }
  /**
   * Runs `fn` now when the scheduler's zone is current (the usual case: synchronous, so a request's whole
   * write happens before another request reads), after rebuilding it otherwise.
   */
  #zoned<T>(fn: () => T): T | Promise<T> {
    return this.service.zoneCurrent() ? fn() : this.ensureZone().then(fn);
  }

  /** One transaction: a failure part-way leaves no card without its revlog, no half-recorded set. */
  due(input: { budgetSec: number | null; more: boolean }): DueBatch | Promise<DueBatch> {
    return this.#zoned(() => tx(this.repos.db, () => this.#due(input)));
  }
  #due(input: { budgetSec: number | null; more: boolean }): DueBatch {
    const now = this.#now();
    this.service.prepareDay(now, this.#gap());
    const gapDays = this.#gap();
    const plan1 = (budgetSec: number | null, continuation: boolean) =>
      this.service.planWarmup(now, {
        gapDays,
        ...(budgetSec === null ? {} : { budgetSec }),
        ...(continuation ? { continuation: true } : {}),
      });
    // "A little more" stops at 12 minutes on top of whatever the warm-up took (d22, the learner's decision of
    // 2026-11-13, reversing decision 23: the warm-up's seconds are no longer counted against the cap). The count
    // comes from the "more" sets and fact cards already done today, so a reload of /practice/review cannot start
    // it again.
    if (input.more) this.#markMore(now);
    const left = REVIEW_DAY_MAX_SEC - this.moreDoneTodaySec();
    let { plan, items } = plan1(input.budgetSec, input.more);
    if (input.more) {
      if (left <= 0)
        return {
          budgetSec: plan.budgetSec,
          plannedSec: 0,
          items: [],
          label: warmupLabel(0),
          moreAvailable: false,
        };
      if (plan.plannedSec > left) ({ plan, items } = plan1(Math.min(plan.budgetSec, left), true));
    }
    // "More" is offered only when a next block would hold something: the overflow can be all items that
    // wait for another day (the return policy's relearning cap, a spread backlog), and a button that
    // opens an empty block is a dead end.
    // The probe plans this block and the next together and looks for a card this block does not hold.
    let moreAvailable = false;
    // The first block (the warm-up) leaves the whole of "a little more" untouched; a "more" block uses it up.
    const space = input.more ? left - plan.plannedSec : left;
    if (plan.overflow.length > 0 && space > 0) {
      const here = new Set(
        items.flatMap((i) => [...i.cardIds, ...(i.familyId === null ? [] : [i.familyId])]),
      );
      const probe = plan1(plan.plannedSec + Math.min(plan.budgetSec, space), true);
      moreAvailable = probe.items.some(
        (i) =>
          i.kind !== "listen" &&
          [...i.cardIds, ...(i.familyId === null ? [] : [i.familyId])].some((c) => !here.has(c)),
      );
    }
    return {
      budgetSec: plan.budgetSec,
      plannedSec: plan.plannedSec,
      items,
      label: warmupLabel(plan.plannedSec),
      moreAvailable,
    };
  }

  /** When "a little more" was first asked for on a learner day (d22): fact cards after it count against its cap. */
  #firstMore: { day: string; at: string } | null = null;
  #markMore(now: Date): void {
    const day = this.services.streak.time.day();
    if (this.#firstMore?.day !== day) this.#firstMore = { day, at: now.toISOString() };
  }

  #dayStart(): string {
    const time = this.services.streak.time;
    const p = time.profile();
    return dayStartInstant(time.day(), p.timezone, p.rolloverHour).toISOString();
  }

  /** Seconds of finished review sets since `since` (trials × the family's trial time), and how many sets. */
  #setsSec(since: string, moreOnly: boolean): { sec: number; sets: number } {
    const sets = this.repos.db
      .query(
        `SELECT family_ids, trials_total FROM drill_sessions
         WHERE finished_at >= ? AND purpose NOT IN ('lesson', 'checkpoint')${moreOnly ? " AND warmup_item_id LIKE '%:m:%'" : ""}`,
      )
      .all(since) as { family_ids: string; trials_total: number }[];
    let sec = 0;
    for (const s of sets) {
      let ids: string[] = [];
      try {
        ids = JSON.parse(s.family_ids) as string[];
      } catch {
        /* an unreadable row counts at the default trial time */
      }
      const per = Math.max(0, ...ids.map((id) => this.content.family(id)?.estTrialSec ?? 0));
      sec += s.trials_total * (per > 0 ? per : GOVERNOR.factCardSec);
    }
    return { sec, sets: sets.length };
  }

  /** Estimated seconds of review done today: finished review sets (trials × the family's trial time) and fact cards. */
  reviewedTodaySec(): number {
    const since = this.#dayStart();
    const { sec, sets } = this.#setsSec(since, false);
    const facts = this.repos.db
      .query("SELECT COUNT(*) AS n FROM srs_revlog WHERE drill_session_id IS NULL AND reviewed_at >= ?")
      .get(since) as { n: number };
    // The plan puts a listen-only block after every second perceptual set; it is time spent too.
    return sec + Math.floor(sets / 2) * LISTEN_BLOCK_SEC + facts.n * GOVERNOR.factCardSec;
  }

  /**
   * d22: seconds of "a little more" done today — the sets of its blocks (their warm-up item ids carry `:m:`) and the
   * fact cards answered since it was first asked for. The warm-up (the day's first block) is not in it.
   */
  moreDoneTodaySec(): number {
    const since = this.#dayStart();
    const { sec, sets } = this.#setsSec(since, true);
    const firstSet = this.repos.db
      .query(
        "SELECT MIN(started_at) AS at FROM drill_sessions WHERE started_at >= ? AND warmup_item_id LIKE '%:m:%'",
      )
      .get(since) as { at: string | null };
    const day = this.services.streak.time.day();
    const marks = [firstSet.at, this.#firstMore?.day === day ? this.#firstMore.at : null].filter(
      (x): x is string => x !== null,
    );
    const from = marks.sort()[0];
    const facts =
      from === undefined
        ? 0
        : (
            this.repos.db
              .query(
                "SELECT COUNT(*) AS n FROM srs_revlog WHERE drill_session_id IS NULL AND reviewed_at >= ?",
              )
              .get(from) as { n: number }
          ).n;
    return sec + Math.floor(sets / 2) * LISTEN_BLOCK_SEC + facts * GOVERNOR.factCardSec;
  }

  /** One transaction: a failure part-way leaves no card without its revlog, no half-recorded set. */
  review(req: Parameters<SrsPort["review"]>[0]): SrsReviewResult | Promise<SrsReviewResult> {
    return this.#zoned(() => tx(this.repos.db, () => this.#review(req)));
  }
  #review(req: Parameters<SrsPort["review"]>[0]): SrsReviewResult {
    const trials =
      req.drillSessionId === null
        ? undefined
        : this.repos.srs.trials(req.drillSessionId).map((t) => ({ familyId: t.familyId, credit: t.credit }));
    if (this.repos.srs.card(req.cardId) === null) throw notFound(`card ${req.cardId}`);
    const r = this.service.review({ ...req, ...(trials === undefined ? {} : { trials }) }, this.#now());
    this.#touched();
    // A fact answered on its own is evidence for the deck's skill.
    if (req.drillSessionId === null && r.rating !== null) {
      const fact = this.catalog.fact(req.cardId);
      if (fact !== null)
        this.services.mastery.addEvidence(
          fact.skills.map((skill) => ({
            skillId: skill,
            category: null,
            score: req.outcome.meanCredit,
            weight: evidenceWeight("srs-set"),
            sourceKind: "srs-set",
            sourceId: `${req.cardId}#${this.#now().toISOString()}`,
          })),
        );
    }
    return r.familyState === null ? r : { ...r, familyState: this.#withResting(r.familyState) };
  }

  #familyDto(id: string): FamilyState | null {
    if (this.content.family(id) === null) return null;
    const row: FamilyStateRow = this.repos.srs.family(id) ?? {
      familyId: id,
      level: 1,
      promoDay: null,
      categoryStats: {},
      confusion: {},
      blockedRemaining: 0,
      compositeId: null,
      graduatedAt: null,
      updatedAt: this.#now().toISOString(),
    };
    return this.#withResting(this.service.familyDto(row));
  }

  /** Families resting in their composite (decision 27): family → the learner day it began resting. */
  #resting(): Record<string, string> {
    const state = settingsStatePort(this.repos, this.clock).get() as { resting?: unknown } | null;
    const r = state?.resting;
    return r !== null && typeof r === "object" && !Array.isArray(r) ? (r as Record<string, string>) : {};
  }
  /**
   * The DTO with `restingSince` (wave3: the app says "resting in mixed practice" from it) and, for families whose
   * sets ask for sung resolutions (`degree-id`, the FET families), `sungStats` (Wave 4, wave4.md §5.6).
   */
  #withResting(dto: FamilyState, resting: Record<string, string> = this.#resting()): FamilyState {
    const since = resting[dto.familyId];
    const out: FamilyState = { ...dto, restingSince: typeof since === "string" ? since : null };
    if (this.content.family(dto.familyId)?.generator === "degree-id")
      out.sungStats = this.repos.srs.sungStats(dto.familyId);
    return out;
  }

  families(): { families: FamilyState[]; cards: SrsCard[] } {
    const now = this.#now();
    const resting = this.#resting();
    return {
      families: this.repos.srs.families().map((r) => this.#withResting(this.service.familyDto(r), resting)),
      cards: this.repos.srs.cards().map((c) => this.service.cardDto(c, now)),
    };
  }

  familyState(familyId: string): FamilyState | null {
    return this.#familyDto(familyId);
  }

  /** One transaction: a failure part-way leaves no card without its revlog, no half-recorded set. */
  startDrill(req: DrillSessionCreate): DrillSession {
    return tx(this.repos.db, () => this.#startDrill(req));
  }
  #startDrill(req: DrillSessionCreate): DrillSession {
    // One set per warm-up item: a second browser, or a double click, gets the set already open for this item of
    // this session (the client reads its trials back with drills.get), never a second set that would also count.
    if (req.sessionId !== null && req.warmupItemId !== null) {
      const open = this.repos.srs.openDrillFor(req.sessionId, req.warmupItemId);
      if (
        open !== null &&
        open.purpose === req.purpose &&
        open.familyIds.join(",") === req.familyIds.join(",")
      ) {
        const { warmupItemId: _w, meanCredit: _m, ...session } = open;
        return session;
      }
    }
    const levels: Record<string, number> = {};
    const openCategories: Record<string, string[]> = {};
    const focus: Record<string, string | null> = {};
    let trials = 0;
    for (const id of req.familyIds) {
      const def = this.content.family(id);
      if (def === null) throw notFound(`family ${id}`);
      const dto = this.#familyDto(id) as FamilyState;
      // An anchor set is four trials one level down (contracts §7.4).
      const level = Math.max(1, Math.min(dto.level, dto.maxOpenLevel) - (req.purpose === "anchor" ? 1 : 0));
      levels[id] = level;
      openCategories[id] = dto.openCategories;
      let worst: { id: string; acc: number } | null = null;
      for (const c of dto.openCategories) {
        const s = dto.categoryStats[c];
        const acc = s === undefined || s.n === 0 ? 0 : s.hits / s.n;
        if (worst === null || acc < worst.acc) worst = { id: c, acc };
      }
      focus[id] = worst?.id ?? null;
      trials += req.purpose === "anchor" ? 4 : req.familyIds.length > 1 ? 2 : def.trialsPerSet;
    }
    if (req.sessionId !== null && this.repos.sessions.get(req.sessionId) === null)
      throw notFound(`session ${req.sessionId}`);
    const id = newId("drl");
    const session: DrillSession = {
      id,
      sessionId: req.sessionId,
      purpose: req.purpose,
      familyIds: req.familyIds,
      setId: id,
      levels,
      openCategories,
      focus,
      trialsPlanned: req.familyIds.length > 1 ? Math.min(10, trials) : trials,
      startedAt: this.#now().toISOString(),
      finishedAt: null,
    };
    this.repos.srs.createDrill(session, req.warmupItemId);
    return session;
  }

  /** One transaction: a failure part-way leaves no card without its revlog, no half-recorded set. */
  recordTrials(drillSessionId: string, trials: Parameters<SrsPort["recordTrials"]>[1]): void {
    tx(this.repos.db, () => this.#recordTrials(drillSessionId, trials));
  }
  #recordTrials(drillSessionId: string, trials: Parameters<SrsPort["recordTrials"]>[1]): void {
    const drill = this.repos.srs.drill(drillSessionId);
    if (drill === null) throw notFound(`drill session ${drillSessionId}`);
    for (const t of trials)
      if (!drill.familyIds.includes(t.familyId))
        throw badRequest(`trial ${t.idx} is not of this set's families`);
    // A revealed trial has credit 0 and gives no evidence (wave3.md §5.3), whatever the client sent. A trial
    // already stored keeps its first answer (docs/design/retry.md §3.3): a retry inside a trial is practice.
    const before = new Map(this.repos.srs.trials(drillSessionId).map((t) => [t.idx, t]));
    const stored = trials
      .map((t) => (t.revealed === true ? { ...t, credit: 0, correct: false } : t))
      .map((t) => keepFirstAnswer(before.get(t.idx), t));
    this.repos.srs.saveTrials(drillSessionId, stored);
    // Graded sung notes (sung trials, sung resolutions) feed the tolerance ladder; a re-post replaces them.
    for (const t of stored)
      this.services.voice.recordTrial(drillSessionId, t, this.content.family(t.familyId)?.mic ?? false);
  }

  /** One transaction: a failure part-way leaves no card without its revlog, no half-recorded set. */
  finishDrill(drillSessionId: string): Omit<DrillFinish, "streak"> | Promise<Omit<DrillFinish, "streak">> {
    return this.#zoned(() => tx(this.repos.db, () => this.#finishDrill(drillSessionId)));
  }
  #finishDrill(drillSessionId: string): Omit<DrillFinish, "streak"> {
    const drill = this.repos.srs.drill(drillSessionId);
    if (drill === null) throw notFound(`drill session ${drillSessionId}`);
    const now = this.#now();
    const at = now.toISOString();
    const trials = this.repos.srs.trials(drillSessionId).filter((t) => !t.response.skipped);
    const meanCredit = trials.length === 0 ? 0 : trials.reduce((s, t) => s + t.credit, 0) / trials.length;
    const medianRtMs = median(trials.map((t) => t.rtMs));
    const reviews: SrsReviewResult[] = [];
    const evidence: Omit<Evidence, "at" | "day">[] = [];
    if (drill.finishedAt === null && trials.length > 0) {
      // Category statistics and confusion pairs live in family_state (contracts §7.1).
      for (const familyId of drill.familyIds) {
        const mine = trials.filter((t) => t.familyId === familyId);
        if (mine.length === 0) continue;
        const def = this.content.family(familyId);
        const row = this.repos.srs.family(familyId) ?? {
          familyId,
          level: 1,
          promoDay: null,
          categoryStats: {},
          confusion: {},
          blockedRemaining: 0,
          compositeId: null,
          graduatedAt: null,
          updatedAt: at,
        };
        const stats = structuredClone(row.categoryStats);
        const confusion = { ...row.confusion };
        for (const t of mine) {
          const s = stats[t.category] ?? { n: 0, hits: 0, lastAt: null };
          stats[t.category] = { n: s.n + 1, hits: s.hits + t.credit, lastAt: t.at };
          if (t.confusion !== null) {
            const key = `${t.confusion[0]}|${t.confusion[1]}`;
            confusion[key] = (confusion[key] ?? 0) + 1;
          }
        }
        this.repos.srs.saveFamily({ ...row, categoryStats: stats, confusion, updatedAt: at });

        const mean = mine.reduce((s, t) => s + t.credit, 0) / mine.length;
        const played = Math.round(mine.reduce((s, t) => s + t.level, 0) / mine.length);
        const limit =
          (def?.levels[played - 1] as { replays?: number } | undefined)?.replays ?? Number.POSITIVE_INFINITY;
        const extraReplays = mine.reduce((s, t) => s + Math.max(0, t.replays - limit), 0);
        const cents = mine.map((t) => t.centsError).filter((c): c is number => c !== null);
        const outcome = {
          meanCredit: mean,
          medianRtMs: median(mine.map((t) => t.rtMs)),
          extraReplays,
          hintRung: 0 as const,
          revealed: false,
          playedLevel: played,
          meanAbsCents: cents.length === 0 ? null : cents.reduce((s, c) => s + Math.abs(c), 0) / cents.length,
        };
        if (drill.familyIds.length === 1 && this.repos.srs.card(familyId) !== null) {
          if (drill.purpose === "srs" || drill.purpose === "repair" || drill.purpose === "keepalive") {
            reviews.push(this.service.review({ cardId: familyId, drillSessionId, outcome }, now));
          } else if (drill.purpose !== "anchor") {
            const source =
              drill.purpose === "gym"
                ? "gym"
                : drill.purpose === "checkpoint"
                  ? "checkpoint"
                  : drill.purpose === "lesson"
                    ? "lesson"
                    : "practice";
            const r = this.service.otherWork(
              {
                source,
                familyId: familyId as FamilyId,
                meanCredit: mean,
                medianRtMs: outcome.medianRtMs,
                playedLevel: played,
              },
              now,
            );
            if (r.reviewed !== null) reviews.push(r.reviewed);
          }
        }
        // Evidence for the family's skills: SRS set 1.0 (+0.5 per category with ≥ 2 trials), gym and anchor sets 0.5.
        // A revealed trial gives none, and a mic family's trial taken in Quiet mode or as its fallback gives no
        // voice evidence (contracts §8.5, wave3.md §5.3).
        const informative = mine.filter(
          (t) => t.revealed !== true && !(def?.mic === true && (t.modality ?? "normal") !== "normal"),
        );
        if (informative.length > 0) {
          const score = informative.reduce((sum, t) => sum + t.credit, 0) / informative.length;
          const perCategory = new Map<string, number>();
          for (const t of informative) perCategory.set(t.category, (perCategory.get(t.category) ?? 0) + 1);
          const bonus = [...perCategory.values()].filter((n) => n >= 2).length;
          const sourceKind: Evidence["sourceKind"] =
            drill.purpose === "gym" ? "gym-set" : drill.purpose === "anchor" ? "anchor-set" : "srs-set";
          for (const sw of def?.skills ?? [])
            evidence.push({
              skillId: skillOf(sw.skill) as Evidence["skillId"],
              category: sw.skill.includes("/") ? sw.skill : null,
              score,
              weight: evidenceWeight(sourceKind, sourceKind === "srs-set" ? bonus : 0) * sw.w,
              sourceKind,
              sourceId: `${drillSessionId}#${familyId}`,
            });
        }
      }
      // Sung resolutions of functional-ear trials (contracts §8.3): they never change a trial's credit; they are
      // evidence for the resolution family (`fam.deg.resolve`) and, when its card is due, its review.
      const sungPaths = trials.filter(
        (t) =>
          t.sungResolution != null &&
          !t.sungResolution.skipped &&
          !t.sungResolution.quiet &&
          (t.modality ?? "normal") === "normal",
      );
      const resolve = this.content.family(RESOLVE_FAMILY);
      if (sungPaths.length > 0 && resolve !== null) {
        const credit =
          sungPaths.reduce((sum, t) => sum + (t.sungResolution?.credit ?? 0), 0) / sungPaths.length;
        for (const sw of resolve.skills)
          evidence.push({
            skillId: skillOf(sw.skill) as Evidence["skillId"],
            category: sw.skill.includes("/") ? sw.skill : null,
            score: credit,
            weight: evidenceWeight("srs-set") * sw.w,
            sourceKind: "srs-set",
            sourceId: `${drillSessionId}#${RESOLVE_FAMILY}`,
          });
        if (this.repos.srs.card(RESOLVE_FAMILY) !== null) {
          const r = this.service.otherWork(
            {
              source: "practice",
              familyId: RESOLVE_FAMILY,
              meanCredit: credit,
              medianRtMs: 0,
              playedLevel: null,
            },
            now,
          );
          if (r.reviewed !== null) reviews.push(r.reviewed);
        }
      }
      // A composite set reviews the composite card once, with each member's trial credits.
      if (drill.familyIds.length > 1 && drill.purpose === "srs") {
        const mix = this.content.family(drill.familyIds[0] as string)?.mix;
        const compositeId = mix === undefined || mix === null ? null : COMPOSITE_IDS[mix];
        if (compositeId !== null && this.repos.srs.card(compositeId) !== null)
          reviews.push(
            this.service.review(
              {
                cardId: compositeId,
                drillSessionId,
                outcome: {
                  meanCredit,
                  medianRtMs,
                  extraReplays: 0,
                  hintRung: 0,
                  revealed: false,
                  playedLevel: null,
                  meanAbsCents: null,
                },
                trials: trials.map((t) => ({ familyId: t.familyId, credit: t.credit })),
              },
              now,
            ),
          );
      }
      this.repos.srs.finishDrill(drillSessionId, at, trials.length, meanCredit);
      this.#touched();
    }
    const added = this.services.mastery.addEvidence(evidence);
    if (added.length > 0)
      this.services.cando.evaluate({
        skills: added.map((e) => e.skillId),
        evidence: { kind: "set", id: drillSessionId },
      });
    const session = this.repos.srs.drill(drillSessionId) as DrillSession & {
      warmupItemId: string | null;
      meanCredit: number | null;
    };
    const { warmupItemId: _w, meanCredit: _m, ...dto } = session;
    const resting = this.#resting();
    return {
      session: dto,
      meanCredit,
      medianRtMs,
      reviews: reviews.map((r) =>
        r.familyState === null ? r : { ...r, familyState: this.#withResting(r.familyState, resting) },
      ),
      evidence: added,
    };
  }

  /** One transaction: a failure part-way leaves no card without its revlog, no half-recorded set. */
  seedLesson(
    lessonId: string,
  ):
    | { cardId: string; status: SrsCard["status"] }[]
    | Promise<{ cardId: string; status: SrsCard["status"] }[]> {
    return this.#zoned(() => tx(this.repos.db, () => this.#seedLesson(lessonId)));
  }
  #seedLesson(lessonId: string): { cardId: string; status: SrsCard["status"] }[] {
    const now = this.#now();
    const lesson = this.content.lessonDef(lessonId);
    // A composite (`fam.mix.*`) is never seeded: its card is created when its first member graduates
    // (contracts §7.4). Seeding it at its lesson put member-less composite sets of 0 trials in warm-ups.
    const families = this.content
      .families()
      .filter(
        (f) =>
          f.unlock.lesson === lessonId && !f.id.startsWith("fam.mix.") && !f.generator.startsWith("mix."),
      )
      .map((f) => f.id);
    // Concept cards get their first rating from the lesson step that seeded them: its first-attempt score.
    const attempts = this.repos.lessons.attemptsOfLesson(lessonId).filter((a) => !a.disputed);
    const conceptScores: Partial<Record<FamilyId, number>> = {};
    for (const step of lesson?.steps ?? []) {
      const links = step.exercise?.srs ?? [];
      for (const link of links) {
        if (link.family === undefined || link.mode !== "seed") continue;
        const first = attempts.find((a) => a.stepId === step.id && a.attemptNo === 1);
        if (first !== undefined) conceptScores[link.family] = first.adjusted;
      }
    }
    const terms = (lesson?.terms ?? [])
      .filter((t) => t.card !== undefined)
      .map((t) => {
        const first = attempts.find((a) => a.stepId === t.step && a.attemptNo === 1);
        return { factId: t.id as string, score: first?.adjusted ?? 1 };
      });
    const r = this.service.seedFromLesson({ lessonId, families, conceptScores, terms }, now);
    this.service.recallOpenedLadders(now);
    this.#touched();
    return [
      ...r.active.map((cardId) => ({ cardId, status: "active" as const })),
      ...r.deferred.map((cardId) => ({ cardId, status: "deferred" as const })),
    ];
  }

  /**
   * Wave 7 (start-up): every family whose unlock lesson is completed and that has no card yet is seeded through its
   * lesson (cards that exist are never touched). Returns the families seeded.
   */
  backfillFamilies(): string[] | Promise<string[]> {
    const missing = new Map<string, string[]>();
    for (const f of this.content.families()) {
      if (f.id.startsWith("fam.mix.") || f.generator.startsWith("mix.")) continue;
      if (this.repos.lessons.progress(f.unlock.lesson)?.status !== "completed") continue;
      if (this.repos.srs.card(f.id) !== null) continue;
      missing.set(f.unlock.lesson, [...(missing.get(f.unlock.lesson) ?? []), f.id]);
    }
    if (missing.size === 0) return [];
    return this.#zoned(() =>
      tx(this.repos.db, () => {
        for (const lessonId of missing.keys()) this.#seedLesson(lessonId);
        return [...missing.values()].flat().filter((id) => this.repos.srs.card(id) !== null);
      }),
    );
  }

  /** One transaction: a failure part-way leaves no card without its revlog, no half-recorded set. */
  afterStep(input: StepReviewInput): SrsReviewResult[] | Promise<SrsReviewResult[]> {
    return this.#zoned(() => tx(this.repos.db, () => this.#afterStep(input)));
  }
  #afterStep(input: StepReviewInput): SrsReviewResult[] {
    if (!input.firstAttempt || input.disputed) return [];
    const site = this.content.exercise(input.exerciseId);
    const out: SrsReviewResult[] = [];
    for (const link of site?.exercise.srs ?? []) {
      if (link.family === undefined || link.mode === "evidence-only" || link.mode === "seed") continue;
      const r = this.service.otherWork(
        {
          source: "lesson",
          familyId: link.family,
          meanCredit: input.adjustedScore,
          medianRtMs: 0,
          playedLevel: null,
        },
        this.#now(),
      );
      if (r.reviewed !== null) out.push(r.reviewed);
    }
    if (out.length > 0) this.#touched();
    return out;
  }

  recall(cardId: string): { retrievability: number; desiredRetention: number } | null {
    const now = this.#now().getTime();
    if (this.#recall === null || Math.abs(this.#recall.at - now) > 1000) {
      const map = new Map<string, { retrievability: number; desiredRetention: number }>();
      for (const r of this.service.cardRecalls(new Date(now)))
        map.set(r.cardId, { retrievability: r.retrievability, desiredRetention: r.desiredRetention });
      this.#recall = { at: now, map };
    }
    return this.#recall.map.get(cardId) ?? null;
  }

  /** Wave 4: a graded transcription (a ladder item) as other work on its family (contracts §7.4). */
  otherWork(input: { source: "gym" | "practice" | "lesson"; familyId: string; meanCredit: number }) {
    return this.#zoned(() =>
      tx(this.repos.db, () => {
        if (this.content.family(input.familyId) === null) return { reviewed: false, levelChange: null };
        const r = this.service.otherWork(
          {
            source: input.source,
            familyId: input.familyId as FamilyId,
            meanCredit: input.meanCredit,
            medianRtMs: 0,
            playedLevel: null,
          },
          this.#now(),
        );
        this.#touched();
        return { reviewed: r.reviewed !== null, levelChange: r.levelChange };
      }),
    );
  }

  forecast(): number[] {
    const now = this.#now();
    return forecastLoad(this.service.reviewItems(now), this.service.srs.dayOf(now), 7);
  }
}

// --- the planner's ports ------------------------------------------------------------------------------

const isTranscriptionSlot = (id: string) => id.startsWith("GYM.") || id.startsWith("CF-T.");

export class CourseAdapter implements SessionPlanCoursePort {
  constructor(
    private readonly repos: Repos,
    private readonly content: ContentIndex,
    private readonly services: Services,
  ) {}
  /** Unit songs (spec 2026-11-24 §5.5): `SessionPlan.song` for a planned lesson in a song. */
  songOf(lessonId: LessonId): SessionPlan["song"] {
    return this.services.unitSongs?.planSong(lessonId) ?? null;
  }
  #title(id: string): string {
    return (
      this.content.lessonDef(id)?.title ??
      this.content.lessonSite(id)?.meta.title ??
      this.content.checkpointMeta(id)?.title ??
      this.content.capstoneMeta(id.replace(/\.S\d+$/, ""))?.title ??
      id
    );
  }
  #kind(id: string): CourseItem["kind"] {
    if (this.content.lessonSite(id) !== null) return "lesson";
    if (this.content.checkpointMeta(id) !== null) return "checkpoint";
    return "capstone";
  }
  /**
   * The next item of the default order that can be offered today. When the course runs out of authored
   * lessons (a unit still being written), Today never offers a lesson without its lesson file: the scan goes
   * on to a checkpoint or capstone session that is open (U04.CP waits for U05.L01 in the default order; while
   * U05 is not written, U04.CP comes the day after U04.L04), and otherwise there is nothing to offer and the day
   * is a review day (`pause` says why). A checkpoint is never offered on the day its unit's last lesson was
   * completed (contracts §2.5: it falls on a later day).
   */
  next(day?: string): CourseItem | null {
    this.#pause = null;
    const g = this.services.gates;
    const today = day ?? this.services.streak.time.day();
    let unwritten = false;
    for (const id of this.content.defaultOrder()) {
      if (isTranscriptionSlot(id) || g.sessionDone(id) || !g.sessionOpen(id)) continue;
      if (this.content.lessonSite(id) !== null && this.content.lessonDef(id) === null) {
        unwritten = true;
        continue;
      }
      // Wave 5: a transcription capstone whose songs are not written yet (X2 before St. Louis Blues or Careless
      // Love exists) is not offered either: its sessions have nothing to transcribe.
      if (this.#songsMissing(id)) {
        unwritten = true;
        continue;
      }
      if (this.content.checkpointMeta(id) !== null && this.#unitEndedOn(id) === today) {
        this.#pause = `${this.#title(id)} is ready tomorrow. Today: a review, then Studio.`;
        return null;
      }
      return { id: id as SessionId, kind: this.#kind(id), title: this.#title(id) };
    }
    // Wave 7 (wave7.md §5.2): the tracks are never the core's next item. With the focus on the core they are
    // offered beside it (`SessionPlan.trackOffers`); with the focus on a track the planner asks `trackNext`.
    if (unwritten) this.#pause = "The next lessons are still being written. Today: a review, then Studio.";
    return null;
  }
  /** Wave 7: the learner's focus (`tracks.focus`). */
  focus(): TrackFocusId {
    return this.services.trackPlan.focus().focus;
  }
  /** Wave 7: what a track lets the learner start on `day`. */
  trackNext(trackId: "J" | "R" | "A", day: string): CourseItem | null {
    const n = this.services.trackPlan.nextSession(trackId, day);
    return n === null ? null : { id: n.id as SessionId, kind: n.kind, title: n.title, trackId };
  }
  trackNextLesson(trackId: "J" | "R" | "A"): CourseItem | null {
    const n = this.services.trackPlan.nextLesson(trackId);
    return n === null ? null : { id: n.id as SessionId, kind: n.kind, title: n.title, trackId };
  }
  trackOffers(target: 15 | 20 | 25, day: string, except: string | null): TrackOffer[] {
    return this.services.trackPlan.offers(target, { day, except });
  }
  trackPosition(trackId: "J" | "R" | "A") {
    const p = this.services.trackPlan;
    return {
      sessionIndex: Math.min(p.sessionsTotal(trackId), p.sessionsDone(trackId) + 1),
      sessionsTotal: p.sessionsTotal(trackId),
    };
  }
  courseStage() {
    return this.services.tracks.courseStage();
  }
  #pause: string | null = null;
  /** A session of a transcribe capstone none of whose songs has an answer key yet. */
  #songsMissing(id: string): boolean {
    const m = /^(.+)\.S\d+$/.exec(id);
    if (m === null || id.startsWith("GYM.")) return false;
    const def = this.content.capstoneDef(m[1] as string);
    if (def === null || def.kind !== "transcribe") return false;
    const songs = (def as { song?: readonly string[] }).song ?? [];
    return songs.length > 0 && !songs.some((sid) => this.content.source.songs.some((x) => x.id === sid));
  }
  /** Why `next()` had nothing to offer although the course is not finished, or `null`. */
  pause(): string | null {
    return this.#pause;
  }
  /** The learner day the last lesson a checkpoint covers was completed on, or `null`. */
  #unitEndedOn(cpId: string): string | null {
    let last: string | null = null;
    for (const l of this.content.lessonsCovered(cpId)) {
      const at = this.repos.lessons.progress(l)?.completedAt ?? null;
      if (at !== null && (last === null || at > last)) last = at;
    }
    return last === null ? null : this.services.streak.time.day(new Date(last));
  }
  /**
   * Wave 4 (contracts §6.6): X1 (any capstone opened by a family level) waits only for gym sets: its other opening
   * conditions are met, it is not started, and the gym rule runs. Today then says "Two more gym sets open X1".
   */
  capstoneGymNote(): string | null {
    if (!this.services.gates.lessonCompleted("U07.L01")) return null;
    // The sets count on different days (contracts §7.3): after a gym day, the next one comes a day later.
    const time = this.services.streak.time;
    const last = this.repos.gym.list().at(-1);
    if (last !== undefined && dayIndex(time.day()) - dayIndex(time.day(new Date(last.at))) <= 1) return null;
    for (const c of this.content.capstones()) {
      if ((c.opensAfter.familyLevels ?? []).length === 0) continue;
      if (this.repos.capstones.get(c.id) !== null) continue;
      const gate = this.services.capstoneSessions.gate(c.id);
      if (gate.open) continue;
      const others = gate.conditions.filter((x) => !x.met && x.kind !== "family-level");
      if (others.length === 0 && (gate.gymSetsToOpen ?? 0) > 0) return gate.message;
    }
    return null;
  }
  history(): SessionId[] {
    const done: { id: string; at: string }[] = [];
    for (const p of this.repos.lessons.allProgress())
      if (p.status === "completed") done.push({ id: p.lessonId, at: p.completedAt ?? p.updatedAt });
    for (const a of this.repos.checkpoints.allAttempts())
      if ((a.passed || a.softPass) && a.finishedAt !== null) done.push({ id: a.cpId, at: a.finishedAt });
    for (const c of this.repos.capstones.all())
      for (const [i, s] of c.sessions.entries())
        done.push({ id: s, at: this.repos.capstoneSessions.get(s)?.completedAt ?? `${c.updatedAt}#${i}` });
    for (const g of this.repos.gym.list()) done.push({ id: g.gymId, at: g.at });
    const seen = new Set<string>();
    return done
      .sort((x, y) => x.at.localeCompare(y.at))
      .filter((x) => !seen.has(x.id) && seen.add(x.id))
      .map((x) => x.id as SessionId);
  }
  /**
   * CF-T's next unfinished session once it is open (contracts §2.4: U15.L01 completed), or `null`: not open yet,
   * released, or none of its standards has an answer key yet (then there is nothing to transcribe and the slot
   * stays a gym session).
   */
  nextCftSession(): SessionId | null {
    const meta = this.content.capstoneMeta("CF-T");
    if (meta === null || !this.services.gates.capstoneOpen(meta)) return null;
    const row = this.repos.capstones.get("CF-T");
    if (row?.status === "released") return null;
    const ids = this.content.capstoneSessionIds("CF-T");
    const done = new Set(row?.sessions ?? []);
    const next = ids.find((s) => !done.has(s));
    if (next === undefined || this.#songsMissing(next)) return null;
    return next as SessionId;
  }
  cftTitle(): string {
    return this.#title("CF-T.S1");
  }
  /**
   * d19: reviews-only sessions ended since the last transcription session (a gym session, an `X#` or CF-T session),
   * from U07.L01 on. They count towards the every-5th-session slot like core sessions do.
   */
  reviewSessionsSinceTranscription(): number {
    const start = this.repos.lessons.progress("U07.L01");
    if (start?.status !== "completed") return 0;
    let since = start.completedAt ?? start.updatedAt;
    for (const g of this.repos.gym.list()) if (g.at > since) since = g.at;
    for (const c of this.repos.capstones.all()) {
      if (!/^(X\d+|CF-T)$/.test(c.capstoneId)) continue;
      for (const sid of c.sessions) {
        const at = this.repos.capstoneSessions.get(sid)?.completedAt ?? c.updatedAt;
        if (at > since) since = at;
      }
    }
    // Once the core is complete the count starts there (the day after session 185 is a review day, wave6.md §5.5).
    const done = this.repos.coreState.get()?.completedAt;
    if (done !== undefined && done > since) since = done;
    return (
      this.repos.db
        .query(
          "SELECT COUNT(*) AS n FROM sessions WHERE kind = 'review' AND ended_at IS NOT NULL AND ended_at > ?",
        )
        .get(since) as { n: number }
    ).n;
  }
  coreStage() {
    return this.services.tracks.coreStage();
  }
  planTracks(): SessionPlan["tracks"] {
    return this.services.tracks.planTracks();
  }
  gymCount(): number {
    return this.repos.gym.list().length;
  }
  hasAudioProject(): boolean {
    return this.repos.transcriptions.list().some((t) => t.sourceKind === "own-audio" && t.status !== "done");
  }
  lessonProgress(id: LessonId) {
    if (this.content.lessonSite(id) === null) return null;
    const p = this.services.gates.lessonProgress(id);
    return { status: p.status, currentStep: p.currentStep, splitPart: p.splitPart };
  }
  lessonScaledMinutes(id: LessonId): number {
    const def = this.content.lessonDef(id);
    return def === null ? 0 : lessonBudget(def).scaledMinutes;
  }
  /** Wave 5: the side lesson Today offers beside the plan (`services/side-lessons.ts`). */
  sideLesson(
    plan: Pick<SessionPlan, "kind" | "returning" | "day" | "targetMinutes">,
  ): SessionPlan["sideLesson"] {
    return this.services.sideLessons.offer(plan);
  }
  /** The last core lesson completed (a Light lesson replays its Make; a side lesson never stands in for it). */
  lastCompletedLesson(): LessonId | null {
    const done = this.repos.lessons
      .allProgress()
      .filter((p) => p.status === "completed" && this.content.lessonSite(p.lessonId)?.meta.side !== true)
      .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
    return done.at(-1)?.lessonId ?? null;
  }
  alternatives(): SessionPlan["alternatives"] {
    const out: SessionPlan["alternatives"] = [];
    for (const c of this.content.capstones()) {
      const st = this.services.gates.capstoneStatus(c.id);
      if (st.status !== "open" && st.status !== "in_progress") continue;
      const next = this.content.capstoneSessionIds(c.id)[st.sessionsDone];
      // A transcribe capstone none of whose songs is written yet has nothing to open (CF-T before its standards).
      if (next !== undefined && !this.#songsMissing(next))
        out.push({ kind: "capstone", mapItemId: next as SessionId, title: c.title });
    }
    // The Transcription Gym opens with U07.L01 (its slots run every 5th session from there, contracts §2.5); before
    // that it is not offered (the page is not part of the first units).
    const gymOpen = this.repos.lessons
      .allProgress()
      .some((p) => p.lessonId === "U07.L01" && p.status === "completed");
    // `GYM.nn` has two digits (contracts §1.2): after GYM.99 the gym is no longer offered.
    if (gymOpen && this.gymCount() < 99) {
      const gym = `GYM.${String(this.gymCount() + 1).padStart(2, "0")}` as SessionId;
      out.push({ kind: "gym", mapItemId: gym, title: "Transcription Gym" });
    }
    return out;
  }
}

export class PlanLearnerAdapter implements SessionPlanLearnerPort {
  constructor(private readonly repos: Repos) {}
  profile() {
    const p = this.repos.profile.get();
    return { targetMinutes: p.targetMinutes, timeZone: p.timezone, rolloverHour: p.rolloverHour };
  }
  lastQualifyingDayBefore(day: string): string | null {
    return this.repos.streak.lastQualifiedDay(day);
  }
  lastCanDo() {
    return this.repos.cando.current().at(-1)?.candoId ?? null;
  }
  lastSketchId(): string | null {
    return this.repos.sketches.latest()?.id ?? null;
  }
  tutorNote(): string | null {
    const note = this.repos.tutor.notes({ limit: 1 })[0];
    return note === undefined ? null : note.text;
  }
}

/** The SRS side of a planner that only peeks at the New block: no day preparation, no warm-up (wave7.md §5.7). */
function peekSrs(time: LearnerTime): SessionPlanSrsPort {
  const empty = { plan: { plannedSec: 0 } as WarmupPlan, items: [] as WarmupItem[] };
  return {
    day: (now) => time.day(now),
    prepareDay: () => {},
    planWarmup: () => empty,
    planReviewDay: () => ({ blocks: [], overflow: [] }),
  };
}

/**
 * Wave 7 (carry f6; wave7.md §5.7): what the planner will put in the New block on the next learner day, given the
 * learner's state now, as the Coda's "next" line: a core or track lesson, a checkpoint, a capstone session (CF-T
 * included), a gym slot, or a reviews-only day (`mapItemId: null`); `null` once the whole course is complete and
 * nothing is due tomorrow.
 */
export function nextSessionOf(services: Services): NextSession | null {
  const ctx = services.ctx;
  const time = new LearnerTime(ctx);
  const course = new CourseAdapter(ctx.repos, ctx.content, services);
  const plan = new SessionPlanService({
    srs: peekSrs(time),
    course,
    learner: new PlanLearnerAdapter(ctx.repos),
  });
  // The next learner day: the rollover after now (a day later at this time of day is that day for every zone).
  const tomorrow = new Date(ctx.clock.now().getTime() + 86_400_000);
  const p = plan.peek(tomorrow);
  const target = p.targetMinutes;
  const trackId = (p.track?.trackId ?? null) as NextSession["trackId"];
  const id = p.mapItemId as string | null;
  if (id === null) {
    const due = ctx.repos.srs.due(new Date(tomorrow.getTime() + 86_400_000).toISOString()).length;
    if (services.tracks.courseStage() === "complete" && due === 0) return null;
    return {
      kind: p.kind,
      mapItemId: null,
      title: p.kind === "review" ? "Review" : p.title,
      goal:
        due > 0
          ? "Today's reviews, then Studio or the gym."
          : "A short review, then Studio: start the next song.",
      estMinutes: SESSION_TOTAL.review[target],
      trackId: null,
      slot: null,
      day: "tomorrow",
    };
  }
  const kind = p.kind === "light" || p.kind === "keepalive" || p.kind === "studio" ? "lesson" : p.kind;
  const total =
    kind === "lesson" || kind === "checkpoint" || kind === "capstone" || kind === "gym"
      ? SESSION_TOTAL[kind][target]
      : SESSION_TOTAL.review[target];
  const gymLevel = kind === "gym" ? ctx.repos.ladder.state().level : null;
  return {
    kind: p.kind,
    mapItemId: id as NextSession["mapItemId"],
    title: p.title,
    goal:
      kind === "gym"
        ? p.title.includes("own audio")
          ? "Transcription Gym: your own audio."
          : `Transcription Gym: ladder L${gymLevel}.`
        : services.trackPlan.goal(id),
    estMinutes: total,
    trackId,
    slot: p.slot?.fills ?? null,
    day: "tomorrow",
  };
}

export interface SrsWiring {
  srs: SrsAdapter;
  planner: SessionPlannerPort;
}

/** Builds the SRS service and the planner over this server's storage. */
export async function createSrsWiring(d: {
  repos: Repos;
  content: ContentIndex;
  services: Services;
  clock: Clock;
}): Promise<SrsWiring> {
  const catalog = new CatalogAdapter(d.content, d.services);
  const service = await SrsService.create({
    store: d.repos.srs,
    state: settingsStatePort(d.repos, d.clock),
    catalog,
    learner: new LearnerAdapter(d.repos, d.content, d.services),
  });
  const srs = new SrsAdapter(service, d.repos, d.content, d.services, catalog, d.clock);
  const plan = new SessionPlanService({
    srs: service,
    course: new CourseAdapter(d.repos, d.content, d.services),
    learner: new PlanLearnerAdapter(d.repos),
  });
  return {
    srs,
    planner: {
      today: async ({ targetMinutes }) => {
        if (!service.zoneCurrent()) await srs.ensureZone();
        const today = plan.today(d.clock.now(), targetMinutes);
        // Decision 29: a checkpoint the planner offers holds the sing-tolerance ladder until it is passed.
        if (today.kind === "checkpoint") d.services.voice.recordOffer(today.mapItemId, today.day);
        return today;
      },
    },
  };
}
