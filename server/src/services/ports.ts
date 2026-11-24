// Seams to services this folder does not own. `services/srs.ts` and `services/session-plan.ts` belong to
// the SRS engineer; the grader hosts to the grader-runtime engineer. The routes and the course service
// call them only through these interfaces, and `wiring.ts` adapts whatever those modules export.
// Every method may be sync or async.
import type {
  DrillFinish,
  DrillSession,
  DrillSessionCreateSchema,
  DrillTrialRecord,
  DueBatch,
  FamilyState,
  SessionPlan,
  SrsCard,
  SrsReviewRequest,
  SrsReviewResult,
} from "@oak/api";
import type { HintRung } from "@oak/content-kit";
import type { z } from "zod";

type MaybePromise<T> = T | Promise<T>;

export type DrillSessionCreate = z.infer<typeof DrillSessionCreateSchema>;

/** One graded lesson step, for `review-if-due` and the step grade map (contracts §7.2, §7.4). */
export interface StepReviewInput {
  lessonId: string;
  stepId: string;
  /** Global exercise ID. */
  exerciseId: string;
  firstAttempt: boolean;
  adjustedScore: number;
  hintRung: HintRung;
  revealed: boolean;
  extraReplays: number;
  disputed: boolean;
}

export interface SrsPort {
  /** `GET /api/srs/due`. `budgetSec` null: the day's warm-up budget. */
  due(input: { budgetSec: number | null; more: boolean }): MaybePromise<DueBatch>;
  review(req: SrsReviewRequest): MaybePromise<SrsReviewResult>;
  families(): MaybePromise<{ families: FamilyState[]; cards: SrsCard[] }>;
  familyState(familyId: string): MaybePromise<FamilyState | null>;
  startDrill(req: DrillSessionCreate): MaybePromise<DrillSession>;
  recordTrials(drillSessionId: string, trials: readonly DrillTrialRecord[]): MaybePromise<void>;
  /** Everything of `DrillFinish` but the streak, which the server adds. */
  finishDrill(drillSessionId: string): MaybePromise<Omit<DrillFinish, "streak">>;
  /** Families and fact cards a completed lesson seeds: `active` or `deferred` by the governor. */
  seedLesson(lessonId: string): MaybePromise<{ cardId: string; status: SrsCard["status"] }[]>;
  /**
   * Wave 7: the families of every completed lesson that have no card yet (a family a content update added after the
   * learner passed its lesson, the advanced tracks' among them) are seeded as their lesson would have seeded them.
   */
  backfillFamilies?(): MaybePromise<string[]>;
  /** A graded lesson step that reviews a linked card when it is due within 2 days. */
  afterStep(input: StepReviewInput): MaybePromise<SrsReviewResult[]>;
  /** Current recall of a card for mastery R and shading; `null` for an unknown or never-reviewed card. */
  recall(cardId: string): { retrievability: number; desiredRetention: number } | null;
  /** Seconds of review due per day for the next 7 days (Progress › Your sessions). */
  forecast?(): MaybePromise<number[]>;
  /**
   * Wave 4: work outside a drill set that reviews a family's card when it is due within 2 days, else moves only its
   * level staircase (contracts §7.4 "Evidence from other work": a gym set, a graded transcription step).
   */
  otherWork?(input: {
    source: "gym" | "practice" | "lesson";
    familyId: string;
    meanCredit: number;
  }): MaybePromise<{ reviewed: boolean; levelChange: "promoted" | "demoted" | null }>;
}

export interface SessionPlannerPort {
  today(input: { targetMinutes: 15 | 20 | 25 }): MaybePromise<SessionPlan>;
}
