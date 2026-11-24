// Today (contracts §2.5, §7.4, §7.9, §9.1, §9.4): the warm-up plan and the main item of the session — the
// next lesson (or its split half at the 15-minute target), a checkpoint, a capstone session, a gym slot
// (the "every 5th session" rule from U07.L01), a Light lesson after a 10+ day break, or a reviews-only day
// when nothing is left. Storage and the course order are behind the ports below; the server implements
// them over SQLite and the content index (gates are applied by `services/gates.ts` before `next()`).
import type { DueBatch, SessionPlan, TrackFocusId, TrackOffer, WarmupItem } from "@oak/api";
import type { CanDoId, LessonId, SessionId } from "@oak/content-kit";
import {
  dayIndex,
  GYM,
  hash01,
  RETURN,
  type ReturnMode,
  returnMode,
  WARMUP_BUDGET_SEC,
  WARMUP_GYM_SEC,
  WARMUP_SHORT_SEC,
  type WarmupPlan,
} from "@oak/srs";

// --- ports ----------------------------------------------------------------------------------------

export type MapItemKind = "lesson" | "checkpoint" | "capstone" | "gym";
export interface CourseItem {
  id: SessionId;
  kind: Exclude<MapItemKind, "gym">;
  title: string;
  /** Wave 7: the advanced track the item belongs to; absent for the core. */
  trackId?: "J" | "R" | "A";
}
export interface LessonProgressView {
  status: "locked" | "available" | "in_progress" | "completed";
  currentStep: string | null;
  /** The half of a split lesson already done (contracts §9.4), or `null`. */
  splitPart: "A" | "B" | null;
}
export interface SessionPlanCoursePort {
  /**
   * The next item of the learner's order with gates applied, never a gym or CF-T session (those fill
   * transcription slots, decided here). `null` when nothing is left.
   */
  next(day?: string): CourseItem | null;
  /** Completed map sessions in order, oldest first, gym and CF-T sessions included. */
  history(): SessionId[];
  /** CF-T is open (U15.L01 completed) and its next unfinished session, or `null`. */
  nextCftSession(): SessionId | null;
  /** CF-T's title as Today shows it. */
  cftTitle?(): string;
  /** How many gym sessions the learner has started (the next is `GYM.(n+1)`). */
  gymCount(): number;
  hasAudioProject(): boolean;
  lessonProgress(id: LessonId): LessonProgressView | null;
  /** Scaled minutes of the lesson's New + Make content (contracts §9.2). */
  lessonScaledMinutes(id: LessonId): number;
  lastCompletedLesson(): LessonId | null;
  /** Other things Today may offer (an extra gym session, a capstone left open, a side lesson). */
  alternatives(): SessionPlan["alternatives"];
  /**
   * After `next()` returned `null` although the course is not finished (the next lessons are not written yet,
   * or a checkpoint waits for tomorrow): the line Today shows on the review day. `null` otherwise.
   */
  pause?(): string | null;
  /**
   * Wave 4 (contracts §6.6): while X1 waits only for `fam.mel.dictation` to reach its level, the line Today shows
   * ("Two more gym sets open X1"); the planner then schedules gym sessions on days with no other map item.
   * `null` otherwise.
   */
  capstoneGymNote?(): string | null;
  /**
   * Wave 5 (contracts §9.6, wave5.md §5.1): the optional side lesson Today may offer beside (or after) the planned
   * session, given the plan's kind, day and return state; never the New block. `null` when none is offered.
   */
  sideLesson?(
    plan: Pick<SessionPlan, "kind" | "returning" | "day" | "targetMinutes">,
  ): SessionPlan["sideLesson"];
  /**
   * Wave 6 (d19): reviews-only sessions ended since the last transcription session. They count towards the
   * every-5th-session slot, so the gym goes on when there is no new lesson to offer.
   */
  reviewSessionsSinceTranscription?(): number;
  /** Wave 6 (wave6.md §5.5): where the core stands. Absent: `in-progress`. */
  coreStage?(): NonNullable<SessionPlan["core"]>;
  /** Wave 6 (wave6.md §5.3): the open tracks with no lesson to start, in one line; `null` when there is none. */
  planTracks?(): SessionPlan["tracks"];
  /** Wave 7 (wave7.md §5.2): the learner's choice between the core and the tracks; absent: `core`. */
  focus?(): TrackFocusId;
  /** Wave 7: what a track lets the learner start on `day` (a lesson, its checkpoint when due, a capstone session). */
  trackNext?(trackId: "J" | "R" | "A", day: string): CourseItem | null;
  /** Wave 7: the first open lesson of a track not done yet (offered beside its due checkpoint). */
  trackNextLesson?(trackId: "J" | "R" | "A"): CourseItem | null;
  /** Wave 7: Today's track offers, the focused track first, without the session already planned. */
  trackOffers?(target: 15 | 20 | 25, day: string, except: string | null): TrackOffer[];
  /** Wave 7: where a track session stands in its track (`SessionPlan.track`). */
  trackPosition?(trackId: "J" | "R" | "A"): { sessionIndex: number; sessionsTotal: number };
  /** Wave 7 (wave7.md §5.8): the whole course's stage. */
  courseStage?(): NonNullable<SessionPlan["course"]>;
  /**
   * Unit songs (spec 2026-11-24 §5.5): the song of a lesson (its title, style, takes and today's line), or `null` when
   * the lesson is in no song. Absent: plans carry no `song`.
   */
  songOf?(lessonId: LessonId): SessionPlan["song"];
}
export interface SessionPlanLearnerPort {
  profile(): { targetMinutes: 15 | 20 | 25; timeZone: string; rolloverHour: number };
  /** The last qualifying day strictly before `day` (contracts §7.8), or `null`. */
  lastQualifyingDayBefore(day: string): string | null;
  lastCanDo(): CanDoId | null;
  lastSketchId(): string | null;
  /** Rendered from the latest non-retracted tutor note; no API call. */
  tutorNote(): string | null;
}
/** The part of `SrsService` the planner uses. */
export interface SessionPlanSrsPort {
  day(now: Date): string;
  prepareDay(now: Date, gapDays: number): void;
  planWarmup(
    now: Date,
    opts: { budgetSec?: number; gapDays: number },
  ): { plan: WarmupPlan; items: WarmupItem[] };
  planReviewDay(now: Date, gapDays: number): { blocks: WarmupPlan[]; overflow: unknown[] };
}
export interface SessionPlanDeps {
  srs: SessionPlanSrsPort;
  course: SessionPlanCoursePort;
  learner: SessionPlanLearnerPort;
}

// --- pure rules -----------------------------------------------------------------------------------

/** Contracts §9.1: minutes of the main block per target. */
export const MAIN_MINUTES = {
  lesson: { 15: 10, 20: 13, 25: 18 },
  splitA: 8.5,
  splitB: 9.5,
  checkpoint: 16,
  capstone: { 15: 11, 20: 15, 25: 20 },
  gym: { 15: 10, 20: 14, 25: 19 },
  make: { 15: 3, 20: 4, 25: 5 },
} as const;
/** The last gym ordinal an ID can carry (`GYM.99`). */
export const MAX_GYM = 99;
/** At the 15-minute target a lesson whose scaled content exceeds this is split at `wrapAt`. */
export const SPLIT_ABOVE_MIN = 10;

const isTranscription = (id: string) =>
  id.startsWith("GYM.") || id.startsWith("CF-T.") || /^X\d+\.S\d+$/.test(id);
const isCoreItem = (id: string) => /^U\d+\./.test(id) || /^(C\d+|X\d+|CF-A|CF-T)\.S\d+$/.test(id);
const capstoneSessionNo = (id: string): number | null => {
  const m = /\.S(\d+)$/.exec(id);
  return m && !id.startsWith("GYM.") ? Number(m[1]) : null;
};

/**
 * The transcription slot rule of contracts §2.5. From U07.L01 on, count completed core sessions since the
 * last transcription session (gym, `X#.S#`, `CF-T.S#`); at 4 the next session is a transcription slot,
 * except that a capstone in progress is never interrupted and an `X#` session that is next anyway takes
 * the slot. The rule does not run in the advanced tracks.
 */
export function transcriptionSlotDue(
  history: readonly string[],
  next: string | null,
  /** d19: reviews-only sessions since the last transcription session count as sessions too. */
  reviewSessions = 0,
  /**
   * `false` once the core is complete (wave6.md §5.5): the sessions of the core are behind the learner, and the
   * every-5th-session slot goes on over the reviews-only sessions since (the day after session 185 is a review day).
   */
  coreCounts = true,
): boolean {
  // `null`: no other map item can be offered today (the next lessons are not written yet): the slot still runs.
  if (next !== null && !isCoreItem(next)) return false;
  const core = sessionsSinceTranscription(history);
  if (core === null) return false;
  const count = coreCounts ? core : 0;
  if (next !== null && /^X\d+\.S\d+$/.test(next)) return false;
  const n = next === null ? null : capstoneSessionNo(next);
  if (n !== null && n > 1) return false;
  return count + Math.max(0, reviewSessions) >= GYM.slotEvery;
}

/**
 * Completed core sessions since the last transcription session (gym, `X#.S#`, `CF-T.S#`), counted from U07.L01
 * on (contracts §2.5); `null` while the rule does not run (U07.L01 not completed).
 */
export function sessionsSinceTranscription(history: readonly string[]): number | null {
  const start = history.indexOf("U07.L01");
  if (start < 0) return null;
  let count = 0;
  for (let i = history.length - 1; i >= start; i--) {
    const id = history[i] as string;
    if (isTranscription(id)) break;
    if (isCoreItem(id)) count++;
  }
  return count;
}

/** Days missed since the last qualifying day: a weekend off after Friday is 2, practising yesterday is 0. */
export function gapDays(lastQualifyingDay: string | null, today: string): number {
  if (lastQualifyingDay === null) return 0;
  return Math.max(0, dayIndex(today) - dayIndex(lastQualifyingDay) - 1);
}

const LIGHT_CONSTRAINTS = [
  "Keep the groove, but change the key.",
  "Use only three different notes in the melody.",
  "Halve the tempo and fill the space.",
  "Swap the drum pattern for one you have not used here.",
  "Make the bass line move only by step.",
  "End on a note other than the tonic.",
];
/** The one new constraint of a Light lesson: deterministic for a lesson and day. */
export function lightConstraint(lessonId: string, day: string): string {
  const i = Math.floor(hash01(`${lessonId}:${day}`) * LIGHT_CONSTRAINTS.length);
  return LIGHT_CONSTRAINTS[i] as string;
}

export function warmupLabel(plannedSec: number): string {
  if (plannedSec <= 0) return "No review today";
  return `Today's review ≈ ${Math.max(1, Math.round(plannedSec / 60))} min`;
}

// --- the planner ----------------------------------------------------------------------------------

export class SessionPlanService {
  constructor(private readonly deps: SessionPlanDeps) {}
  /** While `peek` runs: no SRS day preparation and no warm-up planning (the New block only). */
  #peeking = false;

  /**
   * Wave 7 (carry f6; wave7.md §5.7): the plan the planner would make at `at` (the next learner day) for its New
   * block, without preparing that day's reviews or planning a warm-up (both belong to that day). Read-only.
   */
  peek(at: Date, targetMinutes?: 15 | 20 | 25): SessionPlan {
    this.#peeking = true;
    try {
      return this.#today(at, targetMinutes);
    } finally {
      this.#peeking = false;
    }
  }

  /**
   * `GET /api/session/today`. Idempotent within a day (the SRS day preparation runs once per day). Wave 5: the
   * optional side lesson is offered beside the plan (`sideLesson`, and as a `lesson` alternative while today's
   * session has not ended), never as its New block.
   */
  today(now: Date, targetMinutes?: 15 | 20 | 25): SessionPlan {
    const plan = this.#withSong(this.#today(now, targetMinutes));
    const side = this.deps.course.sideLesson?.(plan) ?? null;
    if (side === null || side === undefined) return { ...plan, sideLesson: null };
    const alternatives =
      side.placement === "alternative" && !plan.alternatives.some((a) => a.mapItemId === side.lessonId)
        ? [...plan.alternatives, { kind: "lesson" as const, mapItemId: side.lessonId, title: side.title }]
        : plan.alternatives;
    return { ...plan, alternatives, sideLesson: side };
  }

  /** Unit songs (spec 2026-11-24 §5.5): a planned lesson that is in a song carries that song; no key otherwise. */
  #withSong(plan: SessionPlan): SessionPlan {
    if (plan.kind !== "lesson" || plan.mapItemId === null || this.deps.course.songOf === undefined)
      return plan;
    const song = this.deps.course.songOf(plan.mapItemId as LessonId) ?? null;
    return song === null ? plan : { ...plan, song };
  }

  #today(now: Date, targetMinutes?: 15 | 20 | 25): SessionPlan {
    const { srs, course, learner } = this.deps;
    const target = targetMinutes ?? learner.profile().targetMinutes;
    const day = srs.day(now);
    const gap = gapDays(learner.lastQualifyingDayBefore(day), day);
    const mode: ReturnMode = returnMode(gap);
    if (!this.#peeking) srs.prepareDay(now, gap);

    const returning: SessionPlan["returning"] =
      gap >= RETURN.warmupGap
        ? {
            recap: { canDoId: learner.lastCanDo(), sketchId: learner.lastSketchId() },
            offerLoosen: mode === "light+loosen",
          }
        : null;
    // Wave 6: where the core stands and the tracks' line ride on every plan; `slot` is set on a slot day.
    const core = course.coreStage?.() ?? "in-progress";
    // Wave 7: the learner's focus, the whole course's stage, Today's track offers (filled in once the New block is
    // known, so the offers never repeat it).
    const focus = course.focus?.() ?? "core";
    const wave7 = course.focus !== undefined;
    const base = {
      day,
      targetMinutes: target,
      returning,
      alternatives: course.alternatives(),
      tutorNote: learner.tutorNote(),
      slot: null as SessionPlan["slot"],
      tracks: course.planTracks?.() ?? null,
      core,
      ...(wave7
        ? {
            focus,
            course: course.courseStage?.() ?? "in-progress",
            track: null as SessionPlan["track"],
            trackOffers: [] as TrackOffer[],
          }
        : {}),
    };

    // A Light lesson after a break of 10 days or more: the last lesson's Make with one new constraint.
    const lastLesson = course.lastCompletedLesson();
    if ((mode === "light" || mode === "light+loosen") && lastLesson !== null) {
      return {
        ...base,
        kind: "light",
        mapItemId: null,
        title: "A light session",
        note: null,
        warmup: this.warmup(now, WARMUP_BUDGET_SEC[target], gap),
        main: {
          resumeStep: null,
          splitPart: null,
          light: { lessonId: lastLesson, constraint: lightConstraint(lastLesson, day) },
          estMinutes: MAIN_MINUTES.make[target],
        },
      };
    }

    let next = course.next(day);
    // Wave 7 (wave7.md §5.2): with the focus on a track, that track's next session is the New block and the core's
    // next item the first alternative — except that a due core checkpoint and a core capstone already under way stay
    // the New block (they are scheduled, §7.6). A track with nothing to start falls back to the core for the day.
    let trackNote: string | null = null;
    if (focus !== "core" && course.trackNext !== undefined) {
      const t = course.trackNext(focus, day);
      const coreHolds =
        next !== null && (next.kind === "checkpoint" || (capstoneSessionNo(next.id) ?? 0) > 1);
      if (t !== null && !coreHolds) {
        if (next !== null && !base.alternatives.some((a) => a.mapItemId === next?.id))
          base.alternatives = [
            { kind: next.kind, mapItemId: next.id, title: next.title },
            ...base.alternatives,
          ];
        next = t;
        // A track checkpoint gates only its capstones (§7.6 rule 5): while it is the New block (due, or its retake
        // after a failed attempt) the track's next lesson stays open and is offered beside it (review:robustness:
        // after a failed J.CP1, J2.L04 could not be started from Today until the checkpoint was passed).
        const lesson = t.kind === "checkpoint" ? (course.trackNextLesson?.(focus) ?? null) : null;
        if (lesson !== null && !base.alternatives.some((a) => a.mapItemId === lesson.id))
          base.alternatives = [
            { kind: lesson.kind, mapItemId: lesson.id, title: lesson.title },
            ...base.alternatives,
          ];
      } else if (t === null && next !== null && core !== "complete")
        // Only while the core has a session to give instead (after the core there is none: wave 7 closer).
        trackNote = "Nothing of the track you chose can be started today: the core's next session instead.";
    }
    const withTracks = <P extends SessionPlan>(plan: P): P => {
      if (!wave7) return plan;
      const offers = course.trackOffers?.(target, day, plan.mapItemId as string | null) ?? [];
      const trackId = next?.trackId;
      const isTrack = trackId !== undefined && plan.mapItemId === next?.id;
      return {
        ...plan,
        trackOffers: offers,
        track:
          isTrack && course.trackPosition !== undefined
            ? { trackId, ...course.trackPosition(trackId) }
            : null,
        note: plan.note ?? (plan.mapItemId === null || !isTrack ? trackNote : null),
      };
    };
    return withTracks(this.#main(now, target, gap, mode, base, next, day));
  }

  #main(
    now: Date,
    target: 15 | 20 | 25,
    gap: number,
    _mode: ReturnMode,
    base: Omit<SessionPlan, "kind" | "mapItemId" | "title" | "note" | "warmup" | "main"> & {
      alternatives: SessionPlan["alternatives"];
    },
    next: CourseItem | null,
    _day: string,
  ): SessionPlan {
    const { srs, course } = this.deps;
    const core = base.core ?? "in-progress";
    // `GYM.nn` has two digits (contracts §1.2): after GYM.99 the gym is no longer scheduled.
    const gymRoom = course.gymCount() < MAX_GYM;
    const gymNote = gymRoom ? (course.capstoneGymNote?.() ?? null) : null;
    const history = course.history();
    const reviewSessions = course.reviewSessionsSinceTranscription?.() ?? 0;
    const coreCounts = core !== "complete";
    const sinceLast = (coreCounts ? (sessionsSinceTranscription(history) ?? 0) : 0) + reviewSessions;
    const cft = course.nextCftSession();
    // A CF-T session is a capstone day (3 + work + 1, contracts §9.1) that fills the transcription slot.
    const cftDay = (id: SessionId) => ({
      ...base,
      kind: "capstone" as const,
      mapItemId: id,
      title: course.cftTitle?.() ?? "Standard Transcription",
      note: null,
      slot: { fills: "cf-t" as const, sinceLast },
      warmup: this.warmup(now, WARMUP_SHORT_SEC, gap),
      main: { resumeStep: null, splitPart: null, light: null, estMinutes: MAIN_MINUTES.capstone[target] },
    });
    // A transcription slot (contracts §2.5), also on a day whose next lessons are not written yet and on a
    // reviews-only day (d19). While CF-T is open and unfinished the slot is its next session; else a gym session.
    if (transcriptionSlotDue(history, next?.id ?? null, reviewSessions, coreCounts)) {
      if (cft !== null) return cftDay(cft);
      if (gymRoom)
        return { ...base, ...this.gym(now, gap, target, gymNote), slot: { fills: "gym", sinceLast } };
    }
    // The lessons and checkpoints of the core are behind the learner and only CF-T is left of the map: its next
    // session is today's (a capstone left open comes first after the core, wave6.md §5.5); it is the transcription
    // session of its slot whenever it is worked.
    if (next === null && cft !== null && core !== "in-progress") return cftDay(cft);
    // X1 waits for its gym sets (contracts §6.6): on a day with no other map item, schedule a gym session.
    if (next === null && gymNote !== null) return { ...base, ...this.gym(now, gap, target, gymNote) };
    if (next === null) {
      // Nothing to offer from the map today (the course is done, its next lessons are not written yet, or a
      // checkpoint waits for tomorrow): a reviews-only day (`/practice/review` offers "a little more"), with
      // Studio as the alternative. Never an error.
      const review = srs.planReviewDay(now, gap);
      const first = srs.planWarmup(now, { budgetSec: WARMUP_BUDGET_SEC[target], gapDays: gap });
      const alternatives = base.alternatives.some((a) => a.kind === "studio")
        ? base.alternatives
        : [...base.alternatives, { kind: "studio" as const, mapItemId: null, title: "Studio" }];
      return {
        ...base,
        alternatives,
        kind: "review",
        mapItemId: null,
        title: "Review",
        note: course.pause?.() ?? null,
        warmup: {
          ...this.batch(first, WARMUP_BUDGET_SEC[target]),
          moreAvailable: review.blocks.length > 1 || review.overflow.length > 0,
        },
        main: null,
      };
    }

    if (next.kind === "checkpoint") {
      return {
        ...base,
        kind: "checkpoint",
        mapItemId: next.id,
        title: next.title,
        note: target === 15 ? "Checkpoint day: about 20 minutes" : null,
        warmup: this.warmup(now, WARMUP_SHORT_SEC, gap),
        main: { resumeStep: null, splitPart: null, light: null, estMinutes: MAIN_MINUTES.checkpoint },
      };
    }
    if (next.kind === "capstone") {
      // An `X#` session that is next anyway takes the slot (contracts §2.5).
      const takesSlot =
        /^X\d+\.S\d+$/.test(next.id) &&
        sessionsSinceTranscription(history) !== null &&
        sinceLast >= GYM.slotEvery;
      return {
        ...base,
        kind: "capstone",
        mapItemId: next.id,
        title: next.title,
        note: null,
        slot: takesSlot ? { fills: "x", sinceLast } : null,
        warmup: this.warmup(now, WARMUP_SHORT_SEC, gap),
        main: { resumeStep: null, splitPart: null, light: null, estMinutes: MAIN_MINUTES.capstone[target] },
      };
    }

    // A lesson: resume where it stopped; at the 15-minute target a long lesson is split at `wrapAt`.
    const lessonId = next.id as LessonId;
    const progress = course.lessonProgress(lessonId);
    const split = target === 15 && course.lessonScaledMinutes(lessonId) > SPLIT_ABOVE_MIN;
    const splitPart: "A" | "B" | null = split ? (progress?.splitPart === "A" ? "B" : "A") : null;
    const resumeStep = progress?.status === "in_progress" ? progress.currentStep : null;
    return {
      ...base,
      kind: "lesson",
      mapItemId: next.id,
      title: next.title,
      note: null,
      warmup: this.warmup(now, WARMUP_BUDGET_SEC[target], gap),
      main: {
        resumeStep,
        splitPart,
        light: null,
        estMinutes:
          splitPart === "A"
            ? MAIN_MINUTES.splitA
            : splitPart === "B"
              ? MAIN_MINUTES.splitB
              : MAIN_MINUTES.lesson[target],
      },
    };
  }

  /** A gym session in the slot (contracts §2.5): odd ladder, even own audio (a ladder one realism up without audio). */
  private gym(
    now: Date,
    gap: number,
    target: 15 | 20 | 25,
    note: string | null,
  ): Pick<SessionPlan, "kind" | "mapItemId" | "title" | "note" | "warmup" | "main"> {
    const { course } = this.deps;
    const n = course.gymCount() + 1;
    const ladder = n % 2 === 1 || !course.hasAudioProject();
    const fallback = n % 2 === 0 && ladder;
    return {
      kind: "gym",
      mapItemId: `GYM.${String(n).padStart(2, "0")}` as SessionId,
      title: ladder ? "Transcription Gym: ladder" : "Transcription Gym: your own audio",
      note: note ?? (fallback ? "No audio project yet: a ladder session one realism level up." : null),
      warmup: this.warmup(now, WARMUP_GYM_SEC, gap),
      main: { resumeStep: null, splitPart: null, light: null, estMinutes: MAIN_MINUTES.gym[target] },
    };
  }

  private warmup(now: Date, budgetSec: number, gap: number): DueBatch {
    return this.batch(this.deps.srs.planWarmup(now, { budgetSec, gapDays: gap }), budgetSec);
  }
  private batch(p: { plan: WarmupPlan; items: WarmupItem[] }, budgetSec: number): DueBatch {
    return {
      budgetSec,
      plannedSec: p.plan.plannedSec,
      items: p.items,
      label: warmupLabel(p.plan.plannedSec),
      moreAvailable: false,
    };
  }
}
