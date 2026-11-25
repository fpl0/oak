import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Exercise, flattenExercise } from "@oak/content-kit";
import J from "../advanced/J3/L05/lesson.ts";
import R from "../advanced/R1/L06/lesson.ts";
import U from "../core/U08/L06/lesson.ts";
import { grade } from "./harness.ts";

setDefaultTimeout(60_000);
type Lesson = typeof U;
// As oak2-pins.test.ts target(): use the step's own flattened exercise, never a substitute rubric.
function target(lesson: Lesson, at: string): Exercise {
  const step = lesson.steps.find((s) => s.id === at);
  if (!step || !("exercise" in step) || !step.exercise) throw new Error(`Missing ${lesson.id}/${at}`);
  return flattenExercise(step.exercise).find((x) => x.kind !== "all") ?? step.exercise;
}
function starter(lesson: Lesson, at: string) {
  const ex = target(lesson, at);
  if (!("code" in ex) || typeof ex.code === "string") throw new Error("Expected code exercise with starter");
  return ex.code.starter.replace(/[⟪⟫]/g, "");
}
async function check(lesson: Lesson, at: string, code: string, passed: boolean) {
  const r = await grade(
    target(lesson, at),
    {
      name: `X23 ${lesson.id}/${at}`,
      response: { code },
      expect: passed ? "pass" : "fail",
    },
    lesson as never,
    lesson.id as never,
    "lesson",
  );
  expect(r.decided).toBe(true);
  expect({ passed: r.passed, messages: r.passed === passed ? [] : r.messages }).toEqual({
    passed,
    messages: [],
  });
  if (!passed) expect(r.feedback.filter((id) => /^(eval|lint|form)\./.test(id))).toEqual([]);
  return r;
}
const code = (...lines: string[]) => `setcpm(96/4)\n\n${lines.join("\n")}`;
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.5)';
const bass = (rhythm: string) =>
  `bass: n("<0 4 5 3>").struct("${rhythm}").scale("C2:major").s("ebass").lpf(600)`;
const groove = (rhythm: string) => code(KICK, SNARE, HATS, bass(rhythm));
const drums = (k: string, s: string, h: string) =>
  code(`kick: s("${k}")`, `snare: s("${s}")`, `hats: s("${h}")`);
const simple = drums(
  "bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~",
  "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~",
  "~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~",
);
const timekeeper = drums(
  "~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~",
  "~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd",
  "hh ~ hh hh hh ~ hh hh hh hh hh ~ hh ~ hh ~",
);
const comp = (stacks: string, low: string) =>
  `setcpm(132/4)\n\nchords: note("<${stacks}>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")\nbass: note("<${low}>").s("upright")`;
const thirds = "[f3,a3,c4,e4,g4] [f3,a3,c4,e4,g4] [g3,b3,d4,f#4,a4] [f3,a3,c4,e4,g4]";
const soWhat = "[e3,a3,d4,g4,b4] [e3,a3,d4,g4,b4] [d3,g3,c4,f4,a4] [e3,a3,d4,g4,b4]";

describe("X23 lesson acceptance", () => {
  test("AC7 U08 Make accepts both held composites and rejects attacks on kicks; S4/S5 stay strict", async () => {
    await check(U, "S6", code(KICK, SNARE, bass("~ x@4 ~ x@2")), true);
    await check(U, "S6", code('kick: s("bd*4")', SNARE, bass("~ x@3 ~ x@2 ~")), true);
    const wrong = await check(U, "S6", code(KICK, SNARE, bass("x@2 x@2")), false);
    expect(wrong.feedback).toContain("rubric.unmet");
    await check(U, "S5", groove("~ x@2 x"), false);
    const held = await check(U, "S4", groove("~ x@4 ~ x@2"), false);
    expect(held.messages?.join("\n")).toContain("Shorten");
    for (const at of ["S4", "S5"]) {
      const ex = target(U, at);
      expect(JSON.stringify("matcher" in ex ? ex.matcher : null)).not.toContain("onsetsOnly");
    }
  });
  test("AC8 R1 simple linear drumming passes and extra sixteenths still fail the timekeeper clause", async () => {
    await check(R, "S6", simple, true);
    const r = await check(R, "S6", timekeeper, false);
    expect(r.messages?.join("\n")).toContain("Break up the evenly spaced hits");
    expect(r.rubric?.some((item) => item.ruleId === "two-hands")).toBe(false);
    const ex = target(R, "S6");
    if (ex.kind !== "code-make") throw new Error("Expected Make");
    expect(ex.rubric.some((item) => item.id === "two-hands")).toBe(false);
  });
  test("AC8 R1 optional grouping accepts the book's 3+3+2 and S1 line but not ordinary linear 4/4", async () => {
    const book = drums(
      "bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~",
      "~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~",
      "~ ~ hh ~ ~ ~ ~ ~ hh ~ ~ ~ ~ ~ hh ~",
    );
    const s1 = R.steps.find((s) => s.id === "S1");
    if (!s1 || !("example" in s1) || !s1.example) throw new Error("Missing S1 example");
    for (const [piece, grouped] of [
      [book, true],
      [simple, false],
      [s1.example.code, true],
    ] as const) {
      const r = await check(R, "S6", piece, true);
      expect(r.rubric?.find((item) => item.ruleId === "three-three-two-accents")).toMatchObject({
        required: false,
        ok: grouped,
      });
    }
  });
  test("AC8 R1 S4's original hats-in-gaps answer still passes", async () => {
    const answer = starter(R, "S4").replace('s("hh*8")', 's("~ ~ hh ~ ~ ~ hh ~ hh ~ ~ ~ ~ ~ hh ~")');
    await check(R, "S4", answer, true);
  });
  test("AC9 J3 Make requires stacks and m11 together, accepts So What and three-note stacks", async () => {
    const wrong = await check(J, "S6", comp(thirds, "d2 d2 e2 d2"), false);
    expect(wrong.feedback).toContain("rubric.unmet");
    expect(wrong.messages?.join("\n")).toContain("The chords are stacks of 4ths");
    await check(J, "S6", comp(soWhat, "e2 e2 d2 e2"), true);
    await check(J, "S6", comp("[g3,c4,f4] [g3,c4,f4] [a3,d4,g4] [g3,c4,f4]", "d2 d2 e2 d2"), true);
    await check(J, "S6", starter(J, "S6"), false);
    const ex = target(J, "S6");
    if (ex.kind !== "code-make") throw new Error("Expected Make");
    expect(ex.rubric.filter((item) => item.required)).toHaveLength(1);
  });
  test("AC9 J3 S4 retains its all-through-the-bar quality check without stack", async () => {
    const original = starter(J, "S4");
    await check(J, "S4", original.replace("[g1 c2]", "[g1 d2]"), false);
    await check(J, "S4", original.replace("[g1 c2]", "d1"), true);
    const ex = target(J, "S4");
    expect(JSON.stringify("matcher" in ex ? ex.matcher : null)).not.toContain('"stack"');
  });
  test("AC10 learner copy contains no Oak quotas or removed checklist wording", () => {
    const forbidden =
      /at least (two|2|six|6)\b|three quarters|\b4 soft|\b2 loud|two hands|on no other eighth/i;
    // Base cb2475f source inspection found matches in U08 S4/S6, R1 ONE_LINE_LABEL/S6 and J3 S6.
    // Recursing catches rubric labels inside matchers and nested exercise prompts as well as Make rubrics.
    const copy: string[] = [];
    const collect = (value: unknown, field = "") => {
      if (typeof value === "string") {
        if (["prompt", "label", "caption", "text", "hints", "feedbackText"].includes(field)) copy.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) collect(item, field);
      } else if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value))
          collect(item, field === "feedbackText" ? field : key);
      }
    };
    for (const [lesson, path] of [
      [U, "core/U08/L06"],
      [R, "advanced/R1/L06"],
      [J, "advanced/J3/L05"],
    ] as const) {
      for (const step of lesson.steps) if ("exercise" in step) collect(step.exercise);
      copy.push(readFileSync(join(import.meta.dir, "..", path, "lesson.mdx"), "utf8"));
    }
    expect(copy.length).toBeGreaterThan(100);
    expect(copy.filter((text) => forbidden.test(text))).toEqual([]);
  });
  test("AC11 lesson and exercise versions follow the owner calls", () => {
    for (const lesson of [U, R, J]) expect(lesson.version).toBe(2);
    for (const [lesson, steps] of [
      [U, ["S6"]],
      [R, ["S4", "S5", "S6"]],
      [J, ["S6"]],
    ] as const)
      for (const at of steps) expect(target(lesson, at).version).toBe(2);
    for (const [lesson, steps] of [
      [U, ["S4", "S5"]],
      [J, ["S3", "S4"]],
    ] as const)
      for (const at of steps) expect(target(lesson, at).version).toBe(1);
  });
});
