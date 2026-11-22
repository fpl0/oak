// Corrections pass (before the learner starts the course): the U04 findings of the outside review (theory-c A1,
// A2), each pinned on the SHIPPED step it was found in and graded as content CI grades it. Each counterexample
// passed before; it now fails with a line the learner can act on, and right answers written another way still
// pass. (The authored variants in each lesson.ts pin pass and fail; this file pins the words.)
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { Exercise, LessonDef, SessionId } from "@oak/content-kit";
import { grade } from "../../validate/harness.ts";
import checkpoint from "./CP/checkpoint.ts";
import L02 from "./L02/lesson.ts";
import L03 from "./L03/lesson.ts";
import L04 from "./L04/lesson.ts";

setDefaultTimeout(120_000);

const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const step = (lesson: LessonDef, id: string): Exercise => {
  const ex = lesson.steps.find((s) => s.id === id)?.exercise;
  if (!ex) throw new Error(`${lesson.id} ${id}: no exercise`);
  return ex as Exercise;
};
const run = (ex: Exercise, lesson: Pick<LessonDef, "id" | "key" | "meter" | "bpm">, code: string) =>
  grade(ex, { name: "probe", response: { code }, expect: "pass" }, lesson, lesson.id as SessionId);
const said = (r: { messages?: string[] }) => (r.messages ?? []).join("\n");

describe("U04.L03 S4: play what the page shows, at its octave (theory-c A1)", () => {
  const ex = step(L03, "S4");
  const keys = (p: string) => `${T(84)}keys: note("${p}").s("piano")`;
  test("the upper notes an octave up (10ths, not the 3rd and 6th on the page) fail and say so", async () => {
    const r = await run(ex, L03, keys("[c4,e5] [c4,a5] [b3,f5] [c4,e5]"));
    expect(r.passed).toBe(false);
    expect(said(r)).toContain("the right letter, but an octave higher than the page shows");
  });
  test("right answers written other ways pass", async () => {
    for (const code of [
      keys("[c4,e4] [c4,a4] [b3,f4] [c4,e4]"),
      keys("[e4,c4] [a4,c4] [f4,b3] [e4,c4]"),
      `${T(84)}keys: n("[0, 2] [0, 5] [-1, 3] [0, 2]").scale("C4:major").s("piano")`,
      `${T(84)}keys: note("[60,64] [60,69] [59,65] [60,64]").s("piano").room(.3)`,
    ])
      expect((await run(ex, L03, code)).passed).toBe(true);
  });
});

describe("U04.CP thirds-together: a 3rd above, not a 6th below or a 10th (theory-c A1)", () => {
  const ex = checkpoint.authored.find((e) => e.id === "thirds-together") as Exercise;
  const ctx = {
    id: "U04.CP",
    key: { tonic: "C", mode: "major" },
    meter: "4/4",
    bpm: 96,
  } as unknown as LessonDef;
  const deg = (p: string) => `${T(96)}mel: n("${p}").scale("C4:major").s("piano")`;
  test("the reviewer's answer, a 6th below, fails and names the distance", async () => {
    const r = await run(ex, ctx, deg("<[[0,-5] [1,-4] [2,-3] [0,-5]] [[3,-2] [2,-3] [1,-4] ~]>"));
    expect(r.passed).toBe(false);
    expect(said(r)).toContain("E3 to C4 is 8 half steps");
    expect(said(r)).toContain("`n` 0 becomes `[0,2]`");
  });
  test("the 10th fails and names the distance", async () => {
    const r = await run(ex, ctx, deg("<[[0,9] [1,10] [2,11] [0,9]] [[3,12] [2,11] [1,10] ~]>"));
    expect(r.passed).toBe(false);
    expect(said(r)).toContain("C4 to E5 is 16 half steps");
  });
  test("right answers pass, in any written order", async () => {
    for (const code of [
      deg("<[[0,2] [1,3] [2,4] [0,2]] [[3,5] [2,4] [1,3] ~]>"),
      deg("<[[2,0] [3,1] [4,2] [2,0]] [[5,3] [4,2] [3,1] ~]>"),
      deg("<[0 1 2 0] [3 2 1 ~]>, <[2 3 4 2] [5 4 3 ~]>"),
      `${T(96)}mel: note("<[[c4, e4] [d4, f4] [e4, g4] [c4, e4]] [[f4, a4] [e4, g4] [d4, f4] ~]>").s("piano")`,
    ])
      expect((await run(ex, ctx, code)).passed).toBe(true);
  });
});

describe("U04.L04 S7: bar 2 is bar 1 moved, every distance kept (theory-c A2)", () => {
  const ex = step(L04, "S7");
  const mel = (p: string, link = "") => `${T(96)}mel: note("${p}")${link}.s("piano")`;
  // The corrections gate removed the "{label}: not yet." override: the rule's own detail reaches the learner.
  const label = "Bar 2 plays bar 1's notes, all moved up or down by the same number of half steps: ";
  test("the reviewer's answer, its last note bent home (−2 becomes +1), fails", async () => {
    const r = await run(ex, L04, mel("<[c4 e4 g4 [e4 d4]] [g4 b4 d5 [b4 c5]]>"));
    expect(r.passed).toBe(false);
    expect(said(r)).toContain(`${label}bar 2 does not bring back bar 1`);
  });
  test("a copy at the same pitch is no move", async () => {
    expect(said(await run(ex, L04, mel("<[c4 e4 g4 e4] [c4 e4 g4 e4]>")))).toContain(
      `${label}bar 2 plays bar 1 again at the same height`,
    );
  });
  test("exact copies pass, by hand or by a named interval, up or down", async () => {
    for (const code of [
      mel("<[c4 e4 g4 [e4 d4]] [g4 b4 d5 [b4 a4]]>"),
      mel("<[c4 e4 g4@2] [d4 f#4 a4@2]>"),
      mel("[c4 e4 g4 e4]", '.transpose("<1P -4P>")'),
      mel("[c4 e4 g4 e4]", '.transpose("<1P 3M>")'),
    ])
      expect((await run(ex, L04, code)).passed).toBe(true);
  });
});

describe("U04.L02 S7: the harmony line really is moved", () => {
  const ex = step(L02, "S7");
  const pair = (link: string) =>
    `${T(92)}mel: note("<[c4 g4 c4 ~] [f4 g4 f4 ~]>").s("piano")\nvox: note("<[c4 g4 c4 ~] [f4 g4 f4 ~]>")${link}.s("piano").gain(.6)`;
  test('a unison, `.transpose("1P")`, is named but moves nothing: fail', async () => {
    expect((await run(ex, L02, pair('.transpose("1P")'))).passed).toBe(false);
  });
  test("named moves pass", async () => {
    for (const link of ['.transpose("3M")', '.transpose("6M")', '.transpose("-4P")'])
      expect((await run(ex, L02, pair(link))).passed).toBe(true);
  });
});
