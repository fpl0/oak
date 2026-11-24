import { describe, expect, test } from "bun:test";
import type { SessionTelemetry, StepTelemetry } from "@oak/api";
import { telemetryAggregates } from "./ops.ts";

const step = (over: Partial<StepTelemetry>): StepTelemetry => ({
  sessionId: "s1",
  lessonId: "U01.L02",
  lessonVersion: 1,
  stepId: "S1",
  stepKind: "modify",
  targetMinutes: 20,
  authoredMinutes: 1,
  scaledMinutes: 1.4,
  startedAt: "2026-11-11T18:00:00.000Z",
  endedAt: "2026-11-11T18:02:00.000Z",
  activeMs: 60_000,
  attempts: 1,
  maxHintRung: 0,
  tutorMessages: 0,
  passed: true,
  skipped: false,
  testedOut: false,
  splitPart: null,
  ...over,
});
const session = (over: Partial<SessionTelemetry>): SessionTelemetry => ({
  sessionId: "s1",
  day: "2026-11-11",
  targetMinutes: 20,
  kind: "lesson",
  warmupMs: 240_000,
  newMs: 540_000,
  makeMs: 240_000,
  codaMs: 60_000,
  totalActiveMs: 1_080_000,
  warmupSets: 3,
  warmupPlannedSec: 280,
  dueSecBefore: 400,
  dueSecAfter: 120,
  deferredCards: 0,
  overflowSec: 120,
  wrappedEarly: false,
  split: false,
  ...over,
});

describe("Your sessions aggregates (contracts §9.7)", () => {
  test("actual vs scaled minutes per lesson, flagged above 1.15 × the scaled budget", () => {
    const a = telemetryAggregates(
      [
        step({ stepId: "S1", activeMs: 60_000, scaledMinutes: 1.4 }),
        step({ stepId: "S2", activeMs: 120_000, scaledMinutes: 1.4 }),
        // A skipped step's minutes are not part of the budget but its time still counts.
        step({ stepId: "S3", activeMs: 30_000, scaledMinutes: 5, skipped: true }),
        step({ lessonId: "U01.L03", activeMs: 60_000, scaledMinutes: 1.4 }),
      ],
      [],
      1.4,
    );
    const l02 = a.lessons.find((l) => l.lessonId === "U01.L02");
    expect(l02).toMatchObject({ steps: 3, scaledMin: 2.8, authoredMin: 2 });
    expect(l02?.activeMin).toBeCloseTo(3.5);
    expect(l02?.ratio).toBeCloseTo(3.5 / 2.8);
    expect(l02?.flagged).toBe(true); // 1.25 > 1.15
    expect(a.lessons.find((l) => l.lessonId === "U01.L03")?.flagged).toBe(false); // 0.71
    expect(a.multiplierPrompt).toBe(false);
  });

  test("daily review seconds against the warm-up budget; overflow; the multiplier prompt", () => {
    const a = telemetryAggregates(
      [],
      [
        session({}),
        session({
          sessionId: "s2",
          kind: "keepalive",
          warmupMs: 60_000,
          warmupPlannedSec: 60,
          overflowSec: 0,
        }),
        session({
          sessionId: "s3",
          day: "2026-11-12",
          kind: "checkpoint",
          warmupPlannedSec: 150,
          overflowSec: 0,
        }),
      ],
      1.7,
    );
    expect(a.days).toEqual([
      expect.objectContaining({ day: "2026-11-12", budgetSec: 180, plannedSec: 150, sessions: 1 }),
      expect.objectContaining({
        day: "2026-11-11",
        budgetSec: 300,
        plannedSec: 340,
        reviewSec: 300,
        sessions: 2,
      }),
    ]);
    expect(a.overflow).toEqual({ sessions: 1, meanSec: 120, maxSec: 120 });
    expect(a.multiplierPrompt).toBe(true);
    expect(telemetryAggregates([], [], 1.2).multiplierPrompt).toBe(true);
    expect(telemetryAggregates([], [], null).multiplierPrompt).toBe(false);
  });
});
