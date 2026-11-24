import { describe, expect, test } from "bun:test";
import type { SessionTelemetry, StepTelemetry } from "@oak/api";
import {
  fmtMin,
  forecastBars,
  lessonRows,
  median,
  multiplierVerdict,
  sessionLengths,
  warmupByDay,
} from "./timing.ts";

const step = (over: Partial<StepTelemetry>): StepTelemetry => ({
  sessionId: "s1",
  lessonId: "U01.L01",
  lessonVersion: 1,
  stepId: "S1",
  stepKind: "listen",
  targetMinutes: 20,
  authoredMinutes: 1,
  scaledMinutes: 1.4,
  startedAt: "2026-11-10T18:00:00.000Z",
  endedAt: "2026-11-10T18:01:00.000Z",
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
  sessionId: "s",
  day: "2026-11-10",
  targetMinutes: 20,
  kind: "lesson",
  warmupMs: 300_000,
  newMs: 600_000,
  makeMs: 120_000,
  codaMs: 60_000,
  totalActiveMs: 1_080_000,
  warmupSets: 2,
  warmupPlannedSec: 300,
  dueSecBefore: 400,
  dueSecAfter: 60,
  deferredCards: 0,
  overflowSec: 0,
  wrappedEarly: false,
  split: false,
  ...over,
});

describe("session timing", () => {
  test("per lesson: authored and scaled count once per step, actual sums every run, flag over 1.15×", () => {
    const rows = lessonRows([
      step({ stepId: "S1", activeMs: 90_000 }),
      step({ stepId: "S1", activeMs: 30_000, sessionId: "s2", endedAt: "2026-11-11T18:00:00.000Z" }),
      step({
        stepId: "S2",
        stepKind: "modify",
        authoredMinutes: 2,
        scaledMinutes: 2.8,
        activeMs: 240_000,
        attempts: 3,
        maxHintRung: 2,
      }),
      step({ lessonId: "U01.L02", stepId: "S1", activeMs: 30_000 }),
    ]);
    const l1 = rows.find((r) => r.lessonId === "U01.L01");
    expect(rows[0]?.lessonId).toBe("U01.L01");
    expect(l1?.authoredMin).toBe(3);
    expect(l1?.scaledMin).toBeCloseTo(4.2, 9);
    expect(l1?.actualMin).toBe(6);
    expect(l1?.over).toBe(true);
    expect(l1?.steps.map((s) => [s.stepId, s.runs, s.attempts])).toEqual([
      ["S1", 2, 2],
      ["S2", 1, 3],
    ]);
    expect(rows.find((r) => r.lessonId === "U01.L02")?.over).toBe(false);
  });

  test("warm-up minutes per day and the plan", () => {
    const days = warmupByDay([
      session({ day: "2026-11-09", warmupMs: 120_000 }),
      session({ day: "2026-11-10", warmupMs: 300_000, overflowSec: 60 }),
      session({ day: "2026-11-10", sessionId: "t", warmupMs: 60_000, warmupPlannedSec: 0 }),
    ]);
    expect(days.map((d) => [d.day, d.actualMin, d.plannedMin, d.overflowMin])).toEqual([
      ["2026-11-09", 2, 5, 0],
      ["2026-11-10", 6, 5, 1],
    ]);
  });

  test("median session length against its target", () => {
    const l = sessionLengths([
      session({ totalActiveMs: 18 * 60_000 }),
      session({ totalActiveMs: 24 * 60_000 }),
      session({ totalActiveMs: 21 * 60_000 }),
      session({ targetMinutes: 15, totalActiveMs: 16 * 60_000 }),
    ]);
    expect(l.byTarget.find((t) => t.target === 20)?.medianMin).toBe(21);
    expect(l.byTarget.find((t) => t.target === 20)?.ratio).toBeCloseTo(1.05, 9);
    expect(l.all.sessions).toBe(4);
    expect(median([])).toBeNull();
    expect(median([1, 3])).toBe(2);
  });

  test("multiplier band, forecast bars and minute format", () => {
    expect(multiplierVerdict(null)).toBe("none");
    expect(multiplierVerdict(1.2)).toBe("low");
    expect(multiplierVerdict(1.4)).toBe("ok");
    expect(multiplierVerdict(1.6)).toBe("high");
    expect(forecastBars({ forecastSec: [120, 0, 600] })).toEqual([
      { day: 0, min: 2 },
      { day: 1, min: 0 },
      { day: 2, min: 10 },
    ]);
    expect(fmtMin(2.345)).toBe("2.3 min");
    expect(fmtMin(12.6)).toBe("13 min");
    expect(fmtMin(null)).toBe("–");
  });
});
