// Corrections pass (before the learner starts the course): the U06 findings of the outside review (theory-d 1–4,
// 6, 7), each pinned on the SHIPPED step it was found in and graded as content CI grades it, and each musical claim
// the fix makes checked by evaluating Strudel headless or with @oak/theory. (The authored variants in each
// lesson.ts pin pass and fail; this file pins the words and the claims.)
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Exercise, LessonDef, SessionId } from "@oak/content-kit";
import { readChord } from "@oak/theory";
import { evaluate, grade } from "../../validate/harness.ts";
import L04 from "./L04/lesson.ts";
import L05 from "./L05/lesson.ts";
import L08 from "./L08/lesson.ts";
import L10 from "./L10/lesson.ts";
import L12 from "./L12/lesson.ts";

setDefaultTimeout(120_000);

const T = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const step = (lesson: LessonDef, id: string): Exercise => {
  const ex = lesson.steps.find((s) => s.id === id)?.exercise;
  if (!ex) throw new Error(`${lesson.id} ${id}: no exercise`);
  return ex as Exercise;
};
const run = (lesson: LessonDef, id: string, response: Record<string, unknown>) =>
  grade(
    step(lesson, id),
    { name: "probe", response, expect: "pass" } as never,
    lesson,
    lesson.id as SessionId,
  );
const said = (r: { messages?: string[] }) => (r.messages ?? []).join("\n");
const triads = (roots: string, bpm: number) =>
  `${T(bpm)}chords: n("${roots}").add(n("[0,2,4]")).scale("C3:major").s("piano")`;

describe("U06.L04 S7: bar 8 comes home with V, not vii° (theory-d 1)", () => {
  test("the reviewer's vii° → I fails on the required rule", async () => {
    const r = await run(L04, "S7", { code: triads("<0 3 0 4 0 3 6 0>", 88) });
    expect(r.passed).toBe(false);
    expect(said(r)).toContain("Bars 7 and 8 go V to I: not yet.");
  });
  test("V → I passes, written as stacks or by name over a bass", async () => {
    for (const code of [
      triads("<0 3 0 4 0 3 4 0>", 88),
      triads("<0 5 1 4 0 3 4 0>", 88),
      `${T(88)}chords: chord("<C F C G Am F G C>").voicing().s("piano")\nbass: note("<c2 f2 c2 g2 a2 f2 g2 c2>").s("ebass").lpf(800)`,
    ])
      expect((await run(L04, "S7", { code })).passed).toBe(true);
  });
});

describe("U06.L05 S6: a note of the chord on beat 1 of EVERY bar (theory-d 2)", () => {
  const chords = 'chords: chord("<C G Am F>").voicing().s("piano").gain(.5)';
  const bass = (p: string) => `${T(88)}bass: n("${p}").scale("C2:major").s("ebass").lpf(800)\n${chords}`;
  test("a bass only in bar 1 fails", async () => {
    const r = await run(L05, "S6", { code: bass("<0 ~ ~ ~>") });
    expect(r.passed).toBe(false);
    expect(said(r)).toContain("On beat 1 of every bar, `bass` plays a note of that bar's chord: not yet.");
  });
  test("roots, 5ths, 3rds with a walk, or a rest after each root all pass", async () => {
    for (const p of [
      "<0 4 5 3>",
      "<4 1 2 0>",
      "<[2 ~ 1 0] [6 ~ 5 4] [0 ~ 6 5] [5 ~ 4 3]>",
      "<[0 ~ ~ 4] [4 ~ ~ 1] [5 ~ ~ 2] [3 ~ ~ 0]>",
    ])
      expect((await run(L05, "S6", { code: bass(p) })).passed).toBe(true);
  });
});

describe("U06.L08 S7: one chord in some bars, two in others (theory-d 3)", () => {
  test("the hint's own answer and the eight-bar loop with one doubled bar now pass", async () => {
    for (const roots of ["<0 5 1 [4 0]>", "<0 5 1 4 0 5 3 [1 4]>", "<0 5 [3 1] [4 0]>"])
      expect((await run(L08, "S7", { code: triads(roots, 100) })).passed).toBe(true);
  });
  test("two chords in every bar fails, and says what the brief asks", async () => {
    const r = await run(L08, "S7", { code: triads("<[0 5] [3 4] [0 5] [1 4]>", 100) });
    expect(r.passed).toBe(false);
    expect(said(r)).toContain(
      "over 4 bars: 0 with one chord, 4 with two or more; the brief asks for at least 1 bar with one chord",
    );
  });
  test("one chord in every bar fails", async () => {
    const r = await run(L08, "S7", { code: triads("<0 5 1 4>", 100) });
    expect(said(r)).toContain("the brief asks for at least 1 bar with two chords");
  });
});

describe("U06.L10 S1: the plain-triad version sounds no 7th, in the chords or the tune (theory-d 6)", () => {
  test("every tune note of the triad version is a note of the triad under it", async () => {
    const item = (step(L10, "S1") as Exercise & { items: { code: string }[] }).items[1] as { code: string };
    const r = await evaluate(item.code, 4);
    for (let b = 0; b < 4; b++) {
      const inBar = r.events.filter((e) => Math.floor(e.onset) === b);
      const chord = new Set(inBar.filter((e) => e.track === "chords").map((e) => (e.midi as number) % 12));
      expect(chord.size).toBe(3);
      for (const e of inBar.filter((x) => x.track === "mel"))
        expect(chord.has((e.midi as number) % 12)).toBe(true);
    }
  });
});

describe("U06.L11 S3: G under A minor adds a note, it is not one of the triad's (theory-d 4)", () => {
  test("@oak/theory reads A C E over G as Am7/G", () => {
    // A, C, E over G (pitch classes 9, 0, 4 and 7, the bass 7), as `bun run theory read A3 C4 E4 G2 --bass G`.
    expect(readChord([9, 0, 4, 7], 7)?.leadSheet).toBe("Am7/G");
  });
  test("the lesson says so", () => {
    const text = readFileSync(new URL("./L11/lesson.mdx", import.meta.url), "utf8");
    expect(text).not.toContain("the bass chose other notes of them");
    expect(text).toContain("Under the second Am it plays G, which is not a note of the A minor chord");
    // G is in the key of A minor; seventh-chord names (Am7) come in U12.L01 (attack:theory A3).
    expect(text).not.toContain("not in A minor at all");
    expect(text).not.toContain("Am7");
  });
});

describe("U06.L12 S3: which rhythm hits ONLY with the snare (theory-d 7)", () => {
  test("the question says 'only', and every beat is a wrong answer to it", async () => {
    const ex = step(L12, "S3") as Exercise & { questions: { prompt: string }[] };
    expect(ex.questions[0]?.prompt).toBe("Which rhythm hits only with the snare?");
    const r = await run(L12, "S3", { answer: { choice: ["every-beat"], number: 2 } });
    expect(r.passed).toBe(false);
    expect(said(r)).toContain("a rhythm that also hits on beats 1 and 3 plays between the snares too");
  });
});
