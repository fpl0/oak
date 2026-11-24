// Telemetry (contracts §9.7) and the "Report a grading problem" queue (§11.8). Local only.
import type {
  QaReport,
  QaReportCreate,
  SessionTelemetry,
  StepTelemetry,
  TelemetryAggregates,
  TelemetryReport,
} from "@oak/api";
import { WARMUP_BUDGET_SEC, WARMUP_SHORT_SEC } from "@oak/srs";
import { tx } from "../db/index.ts";
import { notFound } from "../errors.ts";
import { LearnerTime, type ServiceContext } from "./context.ts";
import type { MasteryService } from "./mastery.ts";

function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** median(active content time / authored minutes) over the last 10 lessons with telemetry. */
export function rollingMultiplier(steps: readonly StepTelemetry[]): number | null {
  const byLesson = new Map<string, { active: number; authored: number; last: string }>();
  for (const s of steps) {
    if (s.skipped || s.testedOut) continue;
    const a = byLesson.get(s.lessonId) ?? { active: 0, authored: 0, last: s.endedAt };
    a.active += s.activeMs / 60_000;
    a.authored += s.authoredMinutes;
    if (s.endedAt > a.last) a.last = s.endedAt;
    byLesson.set(s.lessonId, a);
  }
  const recent = [...byLesson.values()]
    .filter((a) => a.authored > 0)
    .sort((x, y) => y.last.localeCompare(x.last))
    .slice(0, 10);
  return median(recent.map((a) => a.active / a.authored));
}

/** contracts §9.7: flag a lesson whose active time passes 1.15 × its scaled budget. */
export const LESSON_FLAG_RATIO = 1.15;
/** contracts §9.7: prompt to change BEGINNER_FACTOR when the rolling multiplier leaves this band. */
export const MULTIPLIER_BAND = [1.25, 1.55] as const;

/** The aggregates Progress › Your sessions shows (contracts §9.7), from the stored rows. Pure. */
export function telemetryAggregates(
  steps: readonly StepTelemetry[],
  sessions: readonly SessionTelemetry[],
  rolling: number | null,
): TelemetryAggregates {
  const byLesson = new Map<string, TelemetryAggregates["lessons"][number]>();
  for (const s of steps) {
    const key = `${s.lessonId}@${s.lessonVersion}`;
    const a = byLesson.get(key) ?? {
      lessonId: s.lessonId,
      lessonVersion: s.lessonVersion,
      steps: 0,
      activeMin: 0,
      authoredMin: 0,
      scaledMin: 0,
      ratio: null,
      flagged: false,
      lastAt: s.endedAt,
    };
    a.steps += 1;
    a.activeMin += s.activeMs / 60_000;
    if (!s.skipped && !s.testedOut) {
      a.authoredMin += s.authoredMinutes;
      a.scaledMin += s.scaledMinutes;
    }
    if (s.endedAt > a.lastAt) a.lastAt = s.endedAt;
    byLesson.set(key, a);
  }
  const lessons = [...byLesson.values()]
    .map((a) => {
      const ratio = a.scaledMin > 0 ? a.activeMin / a.scaledMin : null;
      return { ...a, ratio, flagged: ratio !== null && ratio > LESSON_FLAG_RATIO };
    })
    .sort((x, y) => y.lastAt.localeCompare(x.lastAt));
  const byDay = new Map<string, TelemetryAggregates["days"][number]>();
  for (const s of sessions) {
    const budget =
      s.kind === "checkpoint" || s.kind === "capstone"
        ? WARMUP_SHORT_SEC
        : WARMUP_BUDGET_SEC[s.targetMinutes];
    const d = byDay.get(s.day) ?? {
      day: s.day,
      sessions: 0,
      reviewSec: 0,
      plannedSec: 0,
      budgetSec: budget,
      overflowSec: 0,
      activeMin: 0,
    };
    d.sessions += 1;
    d.reviewSec += s.warmupMs / 1000;
    d.plannedSec += s.warmupPlannedSec;
    d.budgetSec = Math.max(d.budgetSec, budget);
    d.overflowSec = Math.max(d.overflowSec, s.overflowSec);
    d.activeMin += s.totalActiveMs / 60_000;
    byDay.set(s.day, d);
  }
  const over = sessions.filter((s) => s.overflowSec > 0);
  return {
    lessons,
    days: [...byDay.values()].sort((x, y) => y.day.localeCompare(x.day)),
    multiplierPrompt: rolling !== null && (rolling < MULTIPLIER_BAND[0] || rolling > MULTIPLIER_BAND[1]),
    overflow: {
      sessions: over.length,
      meanSec: over.length === 0 ? 0 : over.reduce((t, s) => t + s.overflowSec, 0) / over.length,
      maxSec: over.reduce((m, s) => Math.max(m, s.overflowSec), 0),
    },
  };
}

export class OpsService {
  readonly time: LearnerTime;
  constructor(
    private readonly ctx: ServiceContext,
    private readonly mastery: MasteryService,
  ) {
    this.time = new LearnerTime(ctx);
  }

  addSteps(steps: readonly StepTelemetry[]): void {
    this.ctx.repos.ops.addStepTelemetry(steps);
  }

  report(forecastSec: number[], tutor: { cacheHitRatio: number; costUsd: number }): TelemetryReport {
    const steps = this.ctx.repos.ops.stepTelemetry();
    const sessions = this.ctx.repos.ops.sessionTelemetry();
    const rolling = rollingMultiplier(steps);
    return {
      steps,
      sessions,
      aggregates: telemetryAggregates(steps, sessions, rolling),
      rollingMultiplier: rolling,
      forecastSec,
      tutor,
    };
  }

  /**
   * One row in `qa_reports`. With `attemptId`, the attempt is marked disputed: its evidence is removed and
   * the skills it touched are recomputed (no mastery evidence, no SRS rating, contracts §11.8).
   */
  addQa(body: QaReportCreate): QaReport {
    return tx(this.ctx.repos.db, () => {
      if (body.attemptId !== null) {
        const a = this.ctx.repos.lessons.attempt(body.attemptId);
        if (a === null) throw notFound(`attempt ${body.attemptId}`);
        this.ctx.repos.lessons.markDisputed(a.id);
        const sourceId = `${a.lessonId}/${a.exerciseId}#${a.id}`;
        const skills = this.ctx.repos.mastery.removeEvidenceOf(
          ["step", "retry", "predict", "rubric-rule"],
          sourceId,
        );
        for (const s of skills) this.mastery.recompute(s);
      }
      const { attemptId: _a, ...rest } = body;
      return this.ctx.repos.ops.addQa({
        ...rest,
        params: rest.params,
        at: this.time.iso(),
        contentVersion: this.ctx.content.contentVersion,
        appVersion: this.ctx.appVersion,
        status: "open",
      });
    });
  }

  qaList(): QaReport[] {
    return this.ctx.repos.ops.qaList();
  }

  setQaStatus(id: number, status: QaReport["status"]): QaReport {
    const r = this.ctx.repos.ops.setQaStatus(id, status);
    if (r === null) throw notFound(`report ${id}`);
    return r;
  }
}
