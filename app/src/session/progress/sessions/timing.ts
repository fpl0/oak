// Progress › Your sessions: the arithmetic (contracts §9.7): actual vs authored and scaled minutes per lesson
// (flag over 1.15 × the scaled budget), each step of a lesson, warm-up minutes per day against the plan, the
// median session length against its target, and the rolling multiplier's 1.25–1.55 band. Pure.
import type { SessionTelemetry, StepTelemetry, TelemetryReport } from "@oak/api";

export const OVER_BUDGET = 1.15;
export const MULTIPLIER_BAND: readonly [number, number] = [1.25, 1.55];

export interface StepRow {
  stepId: string;
  stepKind: string;
  authoredMin: number;
  scaledMin: number;
  actualMin: number;
  attempts: number;
  maxHintRung: number;
  tutorMessages: number;
  passed: boolean;
  skipped: boolean;
  /** How many times the step was run (rows). */
  runs: number;
}

export interface LessonRow {
  lessonId: string;
  version: number;
  authoredMin: number;
  scaledMin: number;
  actualMin: number;
  /** actual / scaled; null without a scaled budget. */
  ratio: number | null;
  over: boolean;
  steps: StepRow[];
  lastAt: string;
}

const min = (ms: number) => ms / 60_000;

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** One row per lesson, newest first; a step's authored and scaled minutes count once however often it ran. */
export function lessonRows(steps: readonly StepTelemetry[]): LessonRow[] {
  const byLesson = new Map<string, StepTelemetry[]>();
  for (const s of steps) {
    const list = byLesson.get(s.lessonId);
    if (list) list.push(s);
    else byLesson.set(s.lessonId, [s]);
  }
  const out: LessonRow[] = [];
  for (const [lessonId, rows] of byLesson) {
    const bySteps = new Map<string, StepTelemetry[]>();
    for (const r of rows) {
      const list = bySteps.get(r.stepId);
      if (list) list.push(r);
      else bySteps.set(r.stepId, [r]);
    }
    const stepRows: StepRow[] = [...bySteps.entries()].map(([stepId, rs]) => {
      const first = rs[0] as StepTelemetry;
      return {
        stepId,
        stepKind: first.stepKind,
        authoredMin: Math.max(...rs.map((r) => r.authoredMinutes)),
        scaledMin: Math.max(...rs.map((r) => r.scaledMinutes)),
        actualMin: min(rs.reduce((a, r) => a + r.activeMs, 0)),
        attempts: rs.reduce((a, r) => a + r.attempts, 0),
        maxHintRung: Math.max(...rs.map((r) => r.maxHintRung)),
        tutorMessages: rs.reduce((a, r) => a + r.tutorMessages, 0),
        passed: rs.some((r) => r.passed),
        skipped: rs.every((r) => r.skipped),
        runs: rs.length,
      };
    });
    stepRows.sort((a, b) => a.stepId.localeCompare(b.stepId, undefined, { numeric: true }));
    const authoredMin = stepRows.reduce((a, s) => a + s.authoredMin, 0);
    const scaledMin = stepRows.reduce((a, s) => a + s.scaledMin, 0);
    const actualMin = stepRows.reduce((a, s) => a + s.actualMin, 0);
    const ratio = scaledMin > 0 ? actualMin / scaledMin : null;
    out.push({
      lessonId,
      version: Math.max(...rows.map((r) => r.lessonVersion)),
      authoredMin,
      scaledMin,
      actualMin,
      ratio,
      over: ratio !== null && ratio > OVER_BUDGET,
      steps: stepRows,
      lastAt:
        rows
          .map((r) => r.endedAt)
          .sort()
          .at(-1) ?? "",
    });
  }
  return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export interface WarmupDay {
  day: string;
  actualMin: number;
  plannedMin: number;
  overflowMin: number;
}

/** Warm-up minutes per day (sessions summed), oldest first. */
export function warmupByDay(sessions: readonly SessionTelemetry[]): WarmupDay[] {
  const days = new Map<string, WarmupDay>();
  for (const s of sessions) {
    const d = days.get(s.day) ?? { day: s.day, actualMin: 0, plannedMin: 0, overflowMin: 0 };
    d.actualMin += min(s.warmupMs);
    d.plannedMin += s.warmupPlannedSec / 60;
    d.overflowMin += s.overflowSec / 60;
    days.set(s.day, d);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface SessionLength {
  /** Target minutes (the median target for the "all" row); null without sessions. */
  target: number | null;
  sessions: number;
  medianMin: number | null;
  /** median / target. */
  ratio: number | null;
}

/** Median active session length per daily target, and over all sessions against the median target. */
export function sessionLengths(sessions: readonly SessionTelemetry[]): {
  all: SessionLength;
  byTarget: SessionLength[];
} {
  const of = (target: number | null, rows: readonly SessionTelemetry[]): SessionLength => {
    const m = median(rows.map((s) => min(s.totalActiveMs)));
    return { target, sessions: rows.length, medianMin: m, ratio: m === null || !target ? null : m / target };
  };
  const targets = [...new Set(sessions.map((s) => s.targetMinutes))].sort((a, b) => a - b);
  return {
    all: of(median(sessions.map((s) => s.targetMinutes)), sessions),
    byTarget: targets.map((t) =>
      of(
        t,
        sessions.filter((s) => s.targetMinutes === t),
      ),
    ),
  };
}

export type MultiplierVerdict = "none" | "low" | "ok" | "high";

export function multiplierVerdict(m: number | null): MultiplierVerdict {
  if (m === null) return "none";
  if (m < MULTIPLIER_BAND[0]) return "low";
  if (m > MULTIPLIER_BAND[1]) return "high";
  return "ok";
}

export interface ForecastBar {
  day: number;
  min: number;
}

/** The next days' review load in minutes (`forecastSec[0]` is today). */
export function forecastBars(report: Pick<TelemetryReport, "forecastSec">): ForecastBar[] {
  return report.forecastSec.map((s, day) => ({ day, min: s / 60 }));
}

export function fmtMin(m: number | null): string {
  if (m === null || Number.isNaN(m)) return "–";
  return m < 10 ? `${m.toFixed(1)} min` : `${Math.round(m)} min`;
}
