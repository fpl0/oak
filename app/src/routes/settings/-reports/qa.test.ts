import { describe, expect, test } from "bun:test";
import type { GradeResult, QaReport } from "@oak/api";
import { codeOf, countByStatus, testResponseOf, toTestCase } from "./qa.ts";

const grade = (status: GradeResult["status"]): GradeResult =>
  ({ status, score: status === "pass" ? 1 : 0.3, diagnostics: [], messages: [] }) as unknown as GradeResult;

const report = (over: Partial<QaReport>): QaReport => ({
  id: 7,
  at: "2026-11-11T10:00:00.000Z",
  kind: "lesson-step",
  lessonId: "U01.L01",
  stepId: "S5",
  exerciseId: "busy-hats",
  exerciseVersion: 1,
  familyId: null,
  trialSeed: null,
  params: null,
  response: { code: 'drums: s("bd sd")' },
  gradeResult: grade("fail"),
  hintRung: 0,
  note: "My hats were on the eighths.",
  contentVersion: null,
  appVersion: "0.0.0",
  status: "open",
  ...over,
});

describe("qa", () => {
  test("a reported fail becomes a test that expects a pass, with the note in its name", () => {
    const t = toTestCase(report({}));
    if (!t.ok) throw new Error(t.why);
    expect(t.test).toEqual({
      name: "qa#7: My hats were on the eighths.",
      response: { code: 'drums: s("bd sd")' },
      expect: "pass",
    });
    expect(t.source).toContain("report #7 (U01.L01 / busy-hats)");
    expect(t.source.trimEnd().endsWith("},")).toBe(true);
  });

  test("a reported pass expects a fail; params are pinned", () => {
    const t = toTestCase(report({ gradeResult: grade("pass"), params: { root: 60 }, note: null }));
    if (!t.ok) throw new Error(t.why);
    expect(t.test.expect).toBe("fail");
    expect(t.test.params).toEqual({ root: 60 });
    expect(t.test.name).toBe("qa#7");
  });

  test("response shapes map to test responses; sung and skipped explain why not", () => {
    expect(testResponseOf({ taps: [0, 0.5] })).toEqual({ ok: true, value: { taps: [0, 0.5] } });
    expect(testResponseOf({ answer: { kind: "choice", value: "b" } }).ok).toBe(true);
    expect(testResponseOf('s("bd")')).toEqual({ ok: true, value: { code: 's("bd")' } });
    expect(testResponseOf({ sung: [] }).ok).toBe(false);
    expect(testResponseOf({ skipped: true }).ok).toBe(false);
    expect(testResponseOf(null).ok).toBe(false);
  });

  test("code for the replay player, counts by status", () => {
    expect(codeOf(report({}))).toBe('drums: s("bd sd")');
    expect(codeOf(report({ response: { taps: [] } }))).toBeNull();
    expect(countByStatus([report({}), report({ status: "fixed" })])).toEqual({
      all: 2,
      open: 1,
      triaged: 0,
      fixed: 1,
      wontfix: 0,
    });
  });
});
