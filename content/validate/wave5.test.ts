// Wave 5 tooling: the checks content CI adds for the Wave 5 shapes (AUTHORING §18). A "match this sound"
// step compares only controls with an unlocked, audible toolbox row; a probe needs its row; a side lesson is
// judged at the earliest point a learner can take it (unlocks through the course graph, terms through
// `laterTerms`, singing before U03.L08); the U08 exemplar sits where the default order puts it.
import { describe, expect, test } from "bun:test";
import type { Exercise, SessionId } from "@oak/content-kit";
import { courseGraph, registries } from "../index.ts";
import { orderPoint } from "./authoring.ts";
import { controlIssues, controlToolIds } from "./checks.ts";
import { unlockedFor } from "./harness.ts";

const ORDER = registries.syllabus.defaultOrder as readonly string[];
const match = (controls: { control: string; scale: "linear" | "log" | "exact"; tol: number }[]) =>
  ({
    kind: "code-modify",
    id: "match",
    version: 1,
    prompt: "p",
    skills: [{ skill: "D03", w: 1 }],
    role: "practice",
    hints: null,
    tests: [],
    code: { starter: "" },
    reference: { solutions: [""], bars: 1 },
    matcher: { m: "controls", controls },
    target: { audible: true },
  }) as unknown as Exercise;

describe("controls: only unlocked, audible controls with a toolbox row", () => {
  test("control names map to toolbox rows by the lint's names", () => {
    expect(controlToolIds("lpf")).toContain("tb.lpf");
    expect(controlToolIds("lpq")).toContain("tb.lpq");
    expect(controlToolIds("release")).toContain("tb.adsr");
    expect(controlToolIds("delaytime")).toContain("tb.delaytime");
    expect(controlToolIds("leslie")).toEqual([]);
  });
  test("at A1.L02 cutoff and resonance may be matched; at A1.L01 both are locked", () => {
    const ex = match([
      { control: "lpf", scale: "log", tol: 0.5 },
      { control: "lpq", scale: "linear", tol: 3 },
    ]);
    expect(controlIssues(ex, "S4/match", unlockedFor("A1.L02" as SessionId))).toEqual([]);
    // `.lpf()` is C1.S1's (START) or A1.L02's: at A1.L01 neither is guaranteed (C1 may not have started, and
    // its fallback grant comes with U03.L03, after the side lessons' gate).
    expect(controlIssues(ex, "S4/match", unlockedFor("A1.L01" as SessionId))).toEqual([
      "S4/match: control lpf (tb.lpf) is locked here",
      "S4/match: control lpq (tb.lpq) is locked here",
    ]);
  });
  test("a control Oak never teaches is refused", () => {
    expect(controlIssues(match([{ control: "leslie", scale: "linear", tol: 1 }]), "x", new Set())).toEqual([
      "x: control leslie has no toolbox row",
    ]);
  });
});

describe("side lessons are judged at their gate", () => {
  test("A1.L01–L04 sit just after U03.L02; core lessons keep their index", () => {
    const gate = ORDER.indexOf("U03.L02");
    for (const id of ["A1.L01", "A1.L02", "A1.L03", "A1.L04"]) expect(orderPoint(id)).toBe(gate + 0.5);
    expect(orderPoint("U08.L01")).toBe(ORDER.indexOf("U08.L01"));
    // so a side lesson sings on numbers: it can come before U03.L08
    expect(orderPoint("A1.L03")).toBeLessThan(ORDER.indexOf("U03.L08"));
  });
  test("what a side lesson may use is what U03.L02 has, plus the side lessons before it", () => {
    const at = unlockedFor("A1.L02" as SessionId);
    expect(at.has("tb.scale" as never)).toBe(true); // U03.L02
    expect(at.has("tb.n.range" as never)).toBe(false); // U03.L03
    expect(at.has("tb.scope" as never)).toBe(true); // A1.L01
    expect(at.has("tb.lpf" as never)).toBe(true); // its own alternative site (contracts §3.1 rule 11)
    expect(at.has("snd.ebass" as never)).toBe(false); // C1.S1 may not have started; fallback after U03.L03
    const g = courseGraph();
    expect(g.before("A1.L04" as SessionId).has("A1.L03" as SessionId)).toBe(true);
  });
});

describe("the U08 exemplar and the default order", () => {
  test("U08.L01 is session 79, before U07.CP; U08.L02–L06 follow X1 (contracts §2.5)", () => {
    expect(ORDER.indexOf("U08.L01") + 1).toBe(79);
    expect(ORDER.indexOf("U07.CP")).toBeGreaterThan(ORDER.indexOf("U08.L01"));
    expect(ORDER.slice(ORDER.indexOf("X1.S3") + 1, ORDER.indexOf("X1.S3") + 7)).toEqual([
      "U08.L02",
      "U08.L03",
      "U08.L04",
      "U08.L06",
      "GYM.04",
      "U08.L05",
    ]);
  });
  test("every Wave 5 session of §2.5 is in the default order, gym slots included, through X2.S2 (session 137)", () => {
    expect(ORDER.indexOf("X2.S2") + 1).toBe(137);
    const gyms = ORDER.slice(ORDER.indexOf("U08.L01"), 137).filter((s) => s.startsWith("GYM."));
    expect(gyms).toEqual([
      "GYM.04",
      "GYM.05",
      "GYM.06",
      "GYM.07",
      "GYM.08",
      "GYM.09",
      "GYM.10",
      "GYM.11",
      "GYM.12",
    ]);
    for (const c of ["C3.S1", "C3.S2", "C3.S3", "C3.S4", "C4.S1", "C4.S2", "C5.S1", "C5.S2", "X2.S1"])
      expect(ORDER).toContain(c);
  });
});
