// Corrections pass (before the learner starts the course): the U01 findings of the outside review, each pinned on
// the SHIPPED step it was found in, graded as content CI and the app grade it. Each counterexample used the new
// syntax without its musical effect and passed; it now fails with a line the learner can act on, and right answers
// written another way still pass. (The authored variants in each lesson.ts pin pass/fail; this file pins the words.)
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { Exercise, GradeResult, LessonDef, SessionId } from "@oak/content-kit";
import { gradeExercise, initRealm, renderFeedback } from "@oak/grader";
import { courseGraph } from "../../index.ts";
import { unlockedAt } from "../../lib/course.ts";
import { toolbox } from "../../toolbox.ts";
import checkpointU01 from "./CP/checkpoint.ts";
import L02 from "./L02/lesson.ts";
import L04 from "./L04/lesson.ts";
import L05 from "./L05/lesson.ts";
import L07 from "./L07/lesson.ts";
import L09 from "./L09/lesson.ts";

setDefaultTimeout(120_000);
beforeAll(async () => {
  await initRealm({ toolbox: [...toolbox], lockdown: false });
});

const exerciseOf = (lesson: LessonDef, step: string): Exercise => {
  const ex = lesson.steps.find((s) => s.id === step)?.exercise;
  if (!ex) throw new Error(`${lesson.id} ${step}: no exercise`);
  return ex as Exercise;
};
const grade = (lesson: LessonDef, step: string, code: string): Promise<GradeResult> => {
  const exercise = exerciseOf(lesson, step);
  return gradeExercise({
    exercise,
    response: { code },
    ctx: {
      exerciseGlobalId: `${lesson.id}/${exercise.id}`,
      mode: "lesson",
      key: lesson.key,
      meter: lesson.meter,
      bpm: lesson.bpm,
      params: {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0,
      tutorHints: 0,
      extraReplays: 0,
      lint: {
        profile: "graded",
        unlocked: unlockedAt(courseGraph(), toolbox, lesson.id as SessionId),
        allowPreview: false,
        meter: lesson.meter,
        key: lesson.key,
      },
    },
  } as never);
};
/** What the learner reads for each unmet rule. */
const unmet = (r: GradeResult): string[] =>
  r.diagnostics.filter((d) => d.id === "rubric.unmet").map((d) => renderFeedback(d));

const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;

describe("U01.L02 S8: a silent beat is silent in every line", () => {
  test("a rest in the drums under hats that play through it fails, and says why", async () => {
    const r = await grade(L02, "S8", `${T(96)}drums: s("bd sd ~ sd")\nhats: s("hh*8").gain(.6)`);
    expect(r.status).toBe("fail");
    expect(unmet(r).join("\n")).toContain(
      "One whole beat where every line is silent, hats included: 0 silent beats; at least 1. A silent beat is empty in every part",
    );
  });
  test("right answers pass", async () => {
    for (const code of [
      `${T(96)}drums: s("bd sd ~ sd")\nhats: s("hh hh ~ hh").gain(.6)`,
      `${T(96)}drums: s("cr ~ sd ~")\nkick: s("bd ~ bd ~")`,
      `${T(96)}drums: s("bd ~ sd ~").gain("1 .5 .8 .5")`,
    ])
      expect((await grade(L02, "S8", code)).status).toBe("pass");
  });
});

describe("U01.L04 S8: a split beat, not brackets round the bar", () => {
  test("`[hh hh hh hh]` over the whole bar fails", async () => {
    const r = await grade(
      L04,
      "S8",
      `${T(100)}kick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd")\nhats: s("[hh hh hh hh]")`,
    );
    expect(r.status).toBe("fail");
    expect(unmet(r).join("\n")).toContain(
      "At least one beat split in two on any line, with `[ ]`: no beat is split",
    );
  });
  test("right answers pass", async () => {
    for (const code of [
      `${T(100)}kick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd")\nhats: s("[hh hh] [hh hh] [hh hh] [hh hh]")`,
      `${T(100)}kick: s("bd [~ bd] ~ ~")\nsnare: s("~ sd ~ sd")`,
      `${T(100)}kick: s("bd ~ bd ~")\nsnare: s("~ sd ~ [sd sd]")\nhats: s("hh hh hh hh")`,
    ])
      expect((await grade(L04, "S8", code)).status).toBe("pass");
  });
});

describe("U01.L05 S7: a held sound, not `@1`", () => {
  test("`cr@1 bd sd sd` fails", async () => {
    const r = await grade(L05, "S7", `${T(88)}drums: s("cr@1 bd sd sd")\nhats: s("hh*8").gain(.5)`);
    expect(r.status).toBe("fail");
    expect(unmet(r).join("\n")).toContain("`@1` keeps a sound one step long; write `@2` or more");
  });
  test("right answers pass", async () => {
    for (const drums of ["cr@2 bd sd", "cr _ bd sd", "bd sd@3", "bd ~ sd@2"])
      expect((await grade(L05, "S7", `${T(88)}drums: s("${drums}")\nhats: s("hh*8").gain(.5)`)).status).toBe(
        "pass",
      );
  });
});

describe("U01.L07 S7: bars that change, not a `< >` with one choice", () => {
  test("`<[~ sd ~ sd]>` fails", async () => {
    const r = await grade(
      L07,
      "S7",
      `${T(100)}kick: s("bd ~ bd ~")\nsnare: s("<[~ sd ~ sd]>")\nhats: s("hh*8").gain(.6)`,
    );
    expect(r.status).toBe("fail");
    expect(unmet(r).join("\n")).toContain("a `< >` with one choice repeats it");
  });
  test("right answers pass", async () => {
    for (const code of [
      `${T(100)}kick: s("bd ~ bd ~")\nsnare: s("<[~ sd ~ sd]!3 [sd sd lt lt]>")\nhats: s("hh*8").gain(.6)`,
      `${T(100)}kick: s("<[bd ~ bd ~]!3 [bd bd [bd bd] [bd bd]]>")\nsnare: s("~ sd ~ sd")`,
      `${T(100)}kick: s("bd ~ bd ~")\nsnare: s("<[~ sd ~ sd] [~ sd ~ [sd sd]]>")`,
    ])
      expect((await grade(L07, "S7", code)).status).toBe("pass");
  });
});

describe("U01.L09 S6: a real change of speed", () => {
  const linn = (label: string, pattern: string, time = "") =>
    `${label}: s("${pattern}")${time}.bank("LinnDrum")`;
  test("`.slow(1)` fails", async () => {
    const r = await grade(
      L09,
      "S6",
      `${T(96)}${linn("kick", "bd ~ [~ bd] ~", ".slow(1)")}\n${linn("snare", "~ sd ~ sd")}\n${linn("hats", "hh*8")}`,
    );
    expect(r.status).toBe("fail");
    expect(unmet(r).join("\n")).toContain("`.slow(1)` keeps the speed it had");
  });
  test("right answers pass", async () => {
    for (const code of [
      `${T(96)}${linn("kick", "bd ~ bd ~")}\n${linn("snare", "~ sd ~ sd", ".slow(2)")}`,
      `${T(96)}${linn("kick", "bd ~ bd ~")}\n${linn("hats", "hh*8", ".fast(2)")}`,
      `${T(96)}${linn("kick", "bd ~ [~ bd] ~", ".slow(2)")}\n${linn("snare", "~ sd ~ sd", ".slow(2)")}`,
    ])
      expect((await grade(L09, "S6", code)).status).toBe("pass");
  });
});

describe("U01.CP Make: the optional `< >` praise needs bars that differ", () => {
  const cp = (code: string) =>
    gradeExercise({
      exercise: checkpointU01.make as Exercise,
      response: { code },
      ctx: {
        exerciseGlobalId: "U01.CP/checkpoint-groove",
        mode: "lesson",
        key: { tonic: "C", mode: "major" },
        meter: "4/4",
        bpm: 96,
        params: {},
        attemptNo: 1,
        firstAttempt: true,
        rung: 0,
        tutorHints: 0,
        extraReplays: 0,
        lint: {
          profile: "graded",
          unlocked: unlockedAt(courseGraph(), toolbox, "U01.CP" as SessionId),
          allowPreview: false,
          meter: "4/4",
          key: null,
        },
      },
    } as never);
  test("a one-choice `< >` passes the backbeat but earns no praise for two bars", async () => {
    const r = await cp(`${T(96)}kick: s("bd ~ [~ bd] ~")\nsnare: s("<[~ sd ~ sd]>")\nhats: s("hh*8")`);
    expect(r.status).toBe("pass");
    expect(r.rubric?.find((x) => x.ruleId === "two-bars")?.ok).toBe(false);
  });
  test("two different bars earn it", async () => {
    const r = await cp(
      `${T(96)}kick: s("bd ~ bd ~")\nsnare: s("<[~ sd ~ sd] [~ sd ~ [sd sd]]>")\nhats: s("hh*8")`,
    );
    expect(r.rubric?.find((x) => x.ruleId === "two-bars")?.ok).toBe(true);
  });
});
