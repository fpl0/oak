import { describe, expect, test } from "bun:test";
import type { GradeResult } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import {
  checkLines,
  currentStage,
  type Given,
  givenChips,
  lineText,
  stageStatus,
  starterCode,
  verdictText,
} from "./ladder.ts";

const G: Given = { bpm: 96, meter: "4/4", key: { tonic: "G", mode: "major" }, pickupBeats: null, bars: 2 };

const result = (over: Partial<GradeResult>): GradeResult =>
  ({
    exerciseId: "lad.1.5",
    exerciseVersion: 1,
    attemptNo: 1,
    firstAttempt: true,
    mode: "lesson",
    status: "fail",
    score: 0.6,
    adjustedScore: 0.6,
    dims: {},
    constraints: [],
    diagnostics: [],
    messages: [],
    assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
    ...over,
  }) as GradeResult;

describe("starter code", () => {
  test("every level's starter runs, keeps the given tempo and names its tracks as the grader reads them", async () => {
    const want = { 1: ["kick", "snare", "hats"], 2: ["bass"], 3: ["bass", "chords"], 4: ["melody"] } as const;
    for (const level of [1, 2, 3, 4] as const) {
      const code = starterCode(level, G);
      expect(code.startsWith("setcpm(96/4)")).toBe(true);
      const out = await evalHeadless(code, 2);
      expect(out.cps).toBeCloseTo(96 / 4 / 60, 6);
      expect(out.tracks).toEqual([...want[level]]);
    }
  });
  test("degrees start on the tonic of the given key: n(0) is degree 1", async () => {
    const out = await evalHeadless(starterCode(4, G), 2);
    expect(out.events.filter((e) => e.track === "melody").map((e) => e.midi)).toEqual([67, 67]);
    const bass = await evalHeadless(starterCode(2, G), 2);
    expect(bass.events.map((e) => e.midi)).toEqual([43, 43]);
    const l3 = await evalHeadless(starterCode(3, G), 1);
    expect(l3.events.filter((e) => e.track === "chords").map((e) => e.midi)).toEqual([55, 59, 62]);
  });
  test("a one-bar item has no alternation", () => {
    expect(starterCode(2, { ...G, bars: 1 })).toContain('n("0")');
  });
});

describe("givens", () => {
  test("chips", () => {
    expect(givenChips(G)).toEqual(["96 BPM", "4/4", "G major", "2 bars"]);
    expect(givenChips({ ...G, pickupBeats: 1 })).toContain("pickup of 1 beat");
  });
});

describe("L3 stages", () => {
  const stages = ["bass", "quality", "rn"] as const;
  test("bass first, then each stage after the one before", () => {
    expect(currentStage(stages, {})).toBe("bass");
    expect(currentStage(stages, { bass: "passed" })).toBe("quality");
    expect(currentStage(stages, { bass: "passed", quality: "revealed", rn: "passed" })).toBeNull();
    expect(currentStage(null, {})).toBeNull();
    expect(stageStatus(stages, { bass: "passed" }).map((s) => s.status)).toEqual([
      "passed",
      "open",
      "locked",
    ]);
  });
});

describe("a check as lines", () => {
  const r = result({
    messages: [
      { id: "rhythm.late" as never, text: "The second kick is late.", where: { bar: 2, beat: 3 } },
      { id: "rhythm.missing" as never, text: "Bar 1: a hat is missing.", where: { bar: 1 } },
      { id: "general" as never, text: "two more notes than the reference." },
    ],
  });
  test('the grader\'s own place prefix becomes "Bar 1, beat 2"', () => {
    const g = result({
      messages: [
        {
          id: "rhythm.missing" as never,
          text: "Bar 1, 2&: missing hit (kick).",
          where: { bar: 1, beat: 2.5, beatLabel: "2&" },
        },
        {
          id: "melody.missing-note" as never,
          text: "Bar 2, 1: note 4 missing.",
          where: { bar: 2, beatLabel: "1" },
        },
      ],
    });
    expect(checkLines(g).map(lineText)).toEqual([
      "Bar 1, beat 2&: missing hit (kick).",
      "Bar 2, beat 1: 4 (fa) missing.",
    ]);
  });
  test("per bar, in bar order, the place said once", () => {
    expect(checkLines(r).map(lineText)).toEqual([
      "Bar 1: a hat is missing.",
      "Bar 2: the second kick is late.",
      "Two more notes than the reference.",
    ]);
  });
  test("verdicts are calm and name the bars", () => {
    expect(verdictText({ passed: false, result: r }, null)).toBe(
      "Not quite: 60% right; 85% passes. Bars 1 and 2 differ. Loop it and listen again.",
    );
    expect(verdictText({ passed: true, result: result({ status: "pass", score: 0.93 }) }, null)).toBe(
      "That's it: 93%. You wrote what you heard.",
    );
    expect(verdictText({ passed: true, result: result({ status: "pass", score: 0.9 }) }, "bass")).toContain(
      "On to the next stage",
    );
    expect(verdictText({ passed: false, result: result({ status: "error" }) }, null)).toContain("didn't run");
  });
});
