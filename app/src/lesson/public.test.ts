import { describe, expect, test } from "bun:test";
import type { Exercise } from "@oak/content-kit";
import { chipsOf } from "../tutor/context.ts";
import {
  clearLesson,
  lessonSubject,
  publishLesson,
  stepLabels,
  tutorAnswerOf,
  useLessonPublic,
} from "./public.ts";
import type { LessonSnapshot } from "./types.ts";

const snap: LessonSnapshot = {
  lessonId: "U01.L02",
  lessonVersion: 1,
  title: "Count to four",
  status: "step",
  stepId: "S2",
  stepIndex: 1,
  stepKind: "modify",
  graded: true,
  passed: false,
  code: 'setcpm(96/4)\n\ndrums: s("bd bd ~ bd")',
  lastResult: null,
  rung: 2,
  attempts: 1,
  splitPart: null,
};

describe("the lesson's public snapshot", () => {
  test("publish and clear (only the lesson still shown)", () => {
    publishLesson(snap);
    clearLesson("U01.L03");
    expect(useLessonPublic.getState().lesson?.stepId).toBe("S2");
    clearLesson("U01.L02");
    expect(useLessonPublic.getState().lesson).toBeNull();
  });

  test("becomes a lesson tutor subject whose chips name the step, the code and the hints", () => {
    const s = lessonSubject(snap);
    expect(s.thread).toEqual({ subjectKind: "lesson", subjectId: "U01.L02" });
    expect(chipsOf(s).map((c) => c.id)).toEqual(["step", "code", "hints"]);
  });

  test("a lesson in a unit song names its song, so the tutor shows the song chip", () => {
    const s = lessonSubject(snap, { song: { title: "Count me in" } });
    expect(s.song).toEqual({ title: "Count me in" });
    expect(chipsOf(s).map((c) => c.id)).toEqual(["step", "song", "code", "hints"]);
    expect(chipsOf(s).find((c) => c.id === "song")?.label).toBe("Song · Count me in");
    expect(lessonSubject(snap, { song: null })).not.toHaveProperty("song");
  });
});

describe("what the tutor reads of a Wave 3 step", () => {
  const C = { tonic: "C", mode: "major" } as const;
  const staffEx = {
    kind: "staff-write",
    prompt: "Write the D major key signature",
    answer: {
      ui: "staff-input",
      clef: "treble",
      bars: 1,
      palette: { durations: ["4"], accidentals: true, ties: false, rests: false },
      key: { tonic: "D", mode: "major" },
      mode: "key-signature",
    },
  } as unknown as Exercise;

  test("a key signature goes as the placed accidentals, in the step's key", () => {
    expect(tutorAnswerOf(staffEx, { answer: { text: ["C#", "F#"] } }, { key: C })).toEqual({
      kind: "staff",
      notes: "C# F#",
      clef: "treble",
      key: { tonic: "D", mode: "major" },
      mode: "key-signature",
    });
  });

  test("staff notes go as the note list; the lesson's key when the answer names none", () => {
    const ex = {
      ...staffEx,
      answer: { ...(staffEx as { answer: object }).answer, key: undefined, mode: "notes" },
    };
    expect(tutorAnswerOf(ex as Exercise, { staff: "C4:4 E4:4" }, { key: C })).toMatchObject({
      kind: "staff",
      notes: "C4:4 E4:4",
      key: C,
      mode: "notes",
    });
  });

  test("a sung take names the target degrees and the cents, never the expected pitches", () => {
    const ex = {
      kind: "sing",
      prompt: "Sing 1 2 1",
      target: { from: "degrees", degrees: [1, 2, 1] },
    } as unknown as Exercise;
    const got = tutorAnswerOf(
      ex,
      {
        sung: [
          { midi: 60, cents: 4, credit: 1 },
          { midi: null, cents: null, credit: 0 },
          { midi: 60, cents: -30, credit: 0.5 },
        ],
      },
      { tolCents: 25 },
    );
    expect(got).toEqual({
      kind: "sung",
      notes: [
        { target: "1", cents: 4 },
        { target: "2", cents: null },
        { target: "1", cents: -30 },
      ],
      tolCents: 25,
    });
    expect(tutorAnswerOf(ex, { skipped: true })).toEqual({ kind: "sung", notes: [], quiet: true });
  });

  test("an ear step's degrees, a picked option by its label, a number: what the learner chose", () => {
    const ear = { kind: "identify", prompt: "1, 3 or 5?" } as unknown as Exercise;
    expect(tutorAnswerOf(ear, { answer: { degrees: ["3"] } })).toEqual({
      kind: "text",
      prompt: "1, 3 or 5?",
      value: "degree 3",
    });
    const pick = {
      kind: "identify",
      prompt: "Which one?",
      answer: { ui: "choice", options: [{ id: 'n("0 2")', label: "the first code" }] },
    } as unknown as Exercise;
    expect(tutorAnswerOf(pick, { answer: { choice: ['n("0 2")'] } })).toMatchObject({
      value: "the first code",
    });
    expect(tutorAnswerOf(ear, { answer: { number: 3 } })).toMatchObject({ value: "3" });
  });

  test("a code step gives no answer (its code is the subject's code)", () => {
    expect(
      tutorAnswerOf({ kind: "code-modify", prompt: "x" } as unknown as Exercise, { code: "n(0)" }),
    ).toBeNull();
  });

  test("the step's own labels; none when the step sets none", () => {
    expect(stepLabels({ ui: { staffLabels: "degree+solfege" } } as never)).toEqual({
      degrees: true,
      solfege: true,
      noteNames: false,
    });
    expect(stepLabels({ ui: {} } as never)).toBeNull();
    const s = lessonSubject(snap, { key: { tonic: "G", mode: "major" }, labels: null, answer: null });
    expect(s.key).toEqual({ tonic: "G", mode: "major" });
  });
});

describe("Wave 4 answers for the tutor: what the learner entered, never the step's answer", () => {
  const stepOf = async (unit: string, lesson: string, step: string) => {
    const mod = (await import(`../../../content/core/${unit}/${lesson}/lesson.ts`)) as {
      default: { steps: { id: string; exercise?: Exercise }[] };
    };
    return mod.default.steps.find((s) => s.id === step)?.exercise as Exercise;
  };

  test("numerals placed on the RN palette (U06.L02 S5), bar by bar", async () => {
    const ex = await stepOf("U06", "L02", "S5");
    const right = (ex as { correct: { rn: string[] } }).correct.rn;
    const mine = [...right].reverse();
    const a = tutorAnswerOf(ex, { answer: { rn: mine } });
    expect(a).toMatchObject({ kind: "numerals", numerals: mine.map((rn, i) => ({ bar: i + 1, rn })) });
    expect(JSON.stringify(a)).not.toContain(JSON.stringify(right));
  });

  test("a function strip (U06.L03 S6) by its slot labels and option labels", async () => {
    const ex = await stepOf("U06", "L03", "S6");
    const a = tutorAnswerOf(ex, { answer: { choice: ["T", "T", "", "T"] } });
    expect(a).toEqual({
      kind: "slots",
      prompt: (ex as { prompt: string }).prompt,
      slots: [
        { label: "Bar 1", value: "T: home (tonic)" },
        { label: "Bar 2", value: "T: home (tonic)" },
        { label: "Bar 3", value: null },
        { label: "Bar 4", value: "T: home (tonic)" },
      ],
    });
  });

  test("a staged chord dictation so far (U06.L09 S2): the stages answered, the last one named", async () => {
    const ex = await stepOf("U06", "L09", "S2");
    const a = tutorAnswerOf(ex, { answer: { stages: { bass: ["1", "3", "5", "4"] } } } as never);
    expect(a).toEqual({
      kind: "stages",
      stage: "bass",
      answers: [{ stage: "bass", values: ["1", "3", "5", "4"] }],
    });
    const all = tutorAnswerOf(ex, {
      answer: { stages: { bass: ["1", "3", "6", "4"], quality: ["maj", "min", "min", "maj"], rn: ["I"] } },
    } as never);
    expect(all).toMatchObject({ kind: "stages", stage: "rn" });
  });

  test("a chord built on the keyboard is spelled in the step's key; a chord name typed is a chord", async () => {
    const kb = await stepOf("U05", "L01", "S5");
    expect(tutorAnswerOf(kb, { answer: { midi: [60, 64, 67] } })).toMatchObject({
      kind: "text",
      value: "notes C4 E4 G4",
    });
    // Contracts 1.6 (d17): chord names moved from U05.L04 to U05.L09 "Chord Names" (S4 "Name the stack").
    const named = await stepOf("U05", "L09", "S4");
    expect(tutorAnswerOf(named, { answer: { text: ["Cm"] } })).toMatchObject({
      kind: "chords",
      chords: [{ symbol: "Cm" }],
    });
    const q = tutorAnswerOf(await stepOf("U05", "L02", "S5"), { answer: { qualities: ["min"] } });
    expect(q?.kind).toBe("chords");
  });
});
