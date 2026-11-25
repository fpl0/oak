// The lesson and checkpoint players for the advanced tracks (Wave 7): the one line that says why a track lesson is
// not open (J2.L04 waiting for U14.CP named as waiting), track checkpoints that hold back only their capstones, the
// tracks' lenses inside the lesson that teaches them, what the host passes for the Wave 7 answer kinds and the
// tutor's words for them; and a track lesson in the lesson machine at every target, exactly like a core lesson
// (the 15-minute split, "Save and wrap", the completion).
import { describe, expect, test } from "bun:test";
import {
  type AttemptResponse,
  type CheckpointOutcome,
  type Exercise,
  type GradeResult,
  type LessonCompleteResult,
  type LessonDef,
  type StepState,
  TRACK_CHECKPOINTS,
  TRACK_GATES,
  type TrackState,
} from "@oak/api";
import { createActor, waitFor } from "xstate";
import a2l01 from "../../../content/advanced/A2/L01/lesson.ts";
import j1l01 from "../../../content/advanced/J1/L01/lesson.ts";
import r1l01 from "../../../content/advanced/R1/L01/lesson.ts";
import { syllabus } from "../../../content/syllabus.ts";
import { lessonTitles } from "../lib/content-model.ts";
import { CP_KEY, familyResponse, itemKey, trialTapLanes } from "./checkpoint/model.ts";
import { revealValue } from "./feedback.ts";
import { type FinishInput, type LessonDeps, lessonMachine, type QuickSketchInput } from "./machine.ts";
import { partRange, splitPartFor, visibleSteps } from "./model.ts";
import { tutorAnswerOf } from "./public.ts";
import { isSideLesson, reportsToSession } from "./side.ts";
import {
  bpmInUnit,
  capstonesGatedBy,
  chordStyleFor,
  euclidText,
  gateOfLesson,
  groupingText,
  isTrackLesson,
  jazzNumerals,
  lanesResponse,
  lessonTrackLenses,
  opensLesson,
  tapLanesOf,
  trackCheckpointIntro,
  trackCheckpointOf,
  trackCheckpointResult,
  trackLessons,
  trackLockCopy,
  trackOfId,
  voicingAskOf,
  wave7TutorText,
} from "./wave7.ts";

const titles = lessonTitles(syllabus);

function gateState(gateId: string, open: boolean): TrackState["gates"][number] {
  const g = TRACK_GATES.find((x) => x.gateId === gateId);
  if (!g) throw new Error(gateId);
  return {
    gateId,
    trackId: g.trackId,
    opens: g.opens,
    requires: g.requires.map((ref) => ({
      ref,
      kind: ref.endsWith(".CP") ? ("checkpoint" as const) : ("lesson" as const),
      label: ref.endsWith(".CP") ? `${ref.slice(0, 3)} checkpoint passed` : `${ref} completed`,
      met: open,
    })),
    open,
    openedAt: open ? "2026-11-14T10:00:00.000Z" : null,
    lessonsAuthored: 1,
    lessonsTotal: 4,
  };
}

function trackState(trackId: "J" | "R" | "A", gates: Record<string, boolean>): TrackState {
  return {
    trackId,
    title: trackId,
    status: "open",
    openedAt: "2026-11-14T10:00:00.000Z",
    gates: Object.entries(gates).map(([id, open]) => gateState(id, open)),
    sessionsDone: 0,
    sessionsTotal: 34,
    next: null,
    note: "",
  } as TrackState;
}

describe("ids and gates", () => {
  test("track of a lesson, a checkpoint and a capstone session", () => {
    expect(trackOfId("J1.L03")).toBe("J");
    expect(trackOfId("J.CP1")).toBe("J");
    expect(trackOfId("JC1.S2")).toBe("J");
    expect(trackOfId("R.CP")).toBe("R");
    expect(trackOfId("A1.L05")).toBe("A");
    expect(trackOfId("AC2.S1")).toBe("A");
    expect(trackOfId("U13.L01")).toBeNull();
    expect(trackOfId("U13.CP")).toBeNull();
    expect(trackOfId("CF-A.S1")).toBeNull();
    expect(isTrackLesson("J5.L05")).toBe(true);
    expect(isTrackLesson("J.CP1")).toBe(false);
  });

  test("each track lesson finds the gate of contracts §4.3 that opens it", () => {
    const of = (id: string) => gateOfLesson(id)?.gateId;
    expect(of("J1.L01")).toBe("J.main");
    expect(of("J2.L03")).toBe("J.main");
    expect(of("J2.L04")).toBe("J.chord-scales");
    expect(of("J3.L04")).toBe("J.main");
    expect(of("J4.L01")).toBe("J.forms");
    expect(of("J5.L05")).toBe("J.reharmonization");
    expect(of("R2.L03")).toBe("R.main");
    expect(of("A1.L02")).toBe("A.side");
    expect(of("A1.L05")).toBe("A.sound");
    expect(of("A2.L06")).toBe("A.arrangement");
    expect(opensLesson("J1, J2.L01–L03, J3", "J2.L04")).toBe(false);
    expect(opensLesson("R1–R3", "R2.L01")).toBe(true);
  });

  test("every lesson of every track has exactly one gate", () => {
    for (const t of ["J", "R", "A"] as const)
      for (const l of trackLessons(syllabus, t)) {
        const gates = TRACK_GATES.filter((g) => opensLesson(g.opens, l.id));
        expect(
          gates.map((g) => g.gateId),
          l.id,
        ).toHaveLength(1);
      }
  });

  test("the track orders: J2.L04 is the one lesson that can be passed over; A1.L01–L04 are side lessons", () => {
    const j = trackLessons(syllabus, "J");
    // Oak 2.0 W2: J3.L05, R1.L06, and A2.L07–L09 in the syllabus.
    expect(j).toHaveLength(23);
    expect(j.filter((l) => l.optional).map((l) => l.id)).toEqual(["J2.L04"]);
    expect(trackLessons(syllabus, "R")).toHaveLength(16);
    const a = trackLessons(syllabus, "A");
    expect(a).toHaveLength(16);
    expect(a.filter((l) => l.side).map((l) => l.id)).toEqual(["A1.L01", "A1.L02", "A1.L03", "A1.L04"]);
  });
});

describe("a track lesson that is not open says the one thing that holds it (DoD 18)", () => {
  const completed = new Set(["J1.L01", "J1.L02", "J1.L03", "J1.L04", "J1.L05", "J2.L01", "J2.L02", "J2.L03"]);

  test("J2.L04 waiting for U14.CP: named as waiting, the track going on, never a failure", () => {
    const c = trackLockCopy("J2.L04", {
      syllabus,
      tracks: [trackState("J", { "J.main": true, "J.chord-scales": false })],
      completed,
    });
    expect(c?.kind).toBe("waiting");
    expect(c?.line).toBe(
      "Chord-Scales is waiting for one thing: U14 checkpoint passed. The track goes on without it, and this lesson opens as soon as that is done.",
    );
    expect(c?.line).not.toMatch(/fail|locked|missing|\d+ more/i);
  });

  test("J3.L01 after J2.L03 with J2.L04 passed over is not held by J2.L04", () => {
    const c = trackLockCopy("J3.L01", {
      syllabus,
      tracks: [trackState("J", { "J.main": true, "J.chord-scales": false })],
      completed: new Set([...completed].filter((x) => x !== "J2.L03")),
    });
    expect(c).toEqual({ kind: "previous", line: "Rootless A/B Voicings opens after J2.L03 Extensions." });
  });

  test("a gate not met: the server's own label, one line", () => {
    const c = trackLockCopy("J4.L01", {
      syllabus,
      tracks: [trackState("J", { "J.main": true, "J.forms": false })],
      completed,
    });
    expect(c?.kind).toBe("gate");
    expect(c?.line).toBe("Turnarounds is waiting for one thing: U15.L06 completed.");
  });

  test("the previous lesson of the track: A1.L05 after the side lesson A1.L04", () => {
    const c = trackLockCopy("A1.L05", {
      syllabus,
      tracks: [trackState("A", { "A.side": true, "A.sound": true })],
      completed: new Set(["A1.L01", "A1.L02", "A1.L03"]),
    });
    expect(c).toEqual({ kind: "previous", line: "Grit opens after A1.L04 Space." });
  });

  test("a track checkpoint never appears as what holds a lesson (DoD 19)", () => {
    // J3.L01 comes after J.CP1 and JC1 in the track's order; neither is a lesson, so neither is named.
    const c = trackLockCopy("J3.L01", {
      syllabus,
      tracks: [trackState("J", { "J.main": true })],
      completed: new Set(["J1.L05"]),
    });
    expect(c?.line).not.toMatch(/CP|checkpoint|Ballad/);
  });

  test("not a track lesson: nothing", () => {
    expect(trackLockCopy("U05.L01", { syllabus, tracks: [], completed: new Set() })).toBeNull();
  });
});

describe("track checkpoints gate only their track's capstones (contracts §7.6 rule 5)", () => {
  test("each track checkpoint names the capstones TRACK_CAPSTONE_GATES holds behind it", () => {
    expect(capstonesGatedBy("J.CP1")).toEqual(["JC1"]);
    expect(capstonesGatedBy("J.CP2")).toEqual(["JC3", "JC4"]);
    expect(capstonesGatedBy("R.CP")).toEqual(["RC1", "RC2"]);
    expect(capstonesGatedBy("A.CP")).toEqual(["AC1", "AC2"]);
    for (const cp of TRACK_CHECKPOINTS) expect([...cp.gates]).toEqual(capstonesGatedBy(cp.cpId));
    expect(trackCheckpointOf("U13.CP")).toBeNull();
  });

  test("the result: a pass opens the capstone; not yet holds back only it; never 'failed'", () => {
    const cp = trackCheckpointOf("J.CP1");
    if (!cp) throw new Error("J.CP1");
    const pass = trackCheckpointResult({ passed: true, softPass: false }, cp, titles);
    expect(pass.title).toBe("Checkpoint passed");
    expect(pass.body).toContain("“ii–V Ballad” is open");
    const soft = trackCheckpointResult({ passed: false, softPass: true }, cp, titles);
    expect(soft.title).toBe("On you go");
    expect(soft.body).toContain("“ii–V Ballad” is open");
    const not = trackCheckpointResult({ passed: false, softPass: false }, cp, titles);
    expect(not.title).toBe("Not yet");
    expect(not.body).toContain("next lessons are open either way");
    expect(not.body).toContain("holds back only “ii–V Ballad”");
    for (const c of [pass, soft, not]) expect(`${c.title} ${c.body}`).not.toMatch(/fail|locked/i);
  });

  test("two capstones behind one checkpoint are both named", () => {
    const cp = trackCheckpointOf("R.CP");
    if (!cp) throw new Error("R.CP");
    const pass = trackCheckpointResult({ passed: true, softPass: false }, cp, titles);
    expect(pass.body).toContain("“16th-Note Funk” and “Clave & Polyrhythm” are open");
  });

  test("the intro: what it covers, when it opens, what it holds back", () => {
    const cp = trackCheckpointOf("J.CP1");
    if (!cp) throw new Error("J.CP1");
    const i = trackCheckpointIntro(cp, titles, { status: "locked" });
    expect(i.covers).toContain("J1, J2.L01–L03");
    expect(i.locked).toBe("Opens a session after J2.L03 Extensions. Today has your next step.");
    expect(i.holds).toBe(
      "It holds back only the track's capstone, “ii–V Ballad”. The track's lessons never wait for it.",
    );
    const failed = trackCheckpointIntro(cp, titles, { status: "failed" });
    expect(failed.holds).toContain("and they are open now");
  });

  test("the outcome shape the result reads", () => {
    const o = { passed: false, softPass: false } as Pick<CheckpointOutcome, "passed" | "softPass">;
    expect(trackCheckpointResult(o, TRACK_CHECKPOINTS[3], titles).body).toContain(
      "“One Tune, Two Genres” and “Neo-Soul Ballad”",
    );
  });
});

describe("the tracks' lenses inside a lesson", () => {
  const off = {
    tensions: false,
    voicings: false,
    chordScales: false,
    clave: false,
    polyLanes: false,
    microtiming: false,
    registers: false,
    density: false,
  };
  const on = Object.fromEntries(Object.keys(off).map((k) => [k, true])) as typeof off;

  test("the lesson that teaches a lens has it, the learner's switch still wins", () => {
    expect(lessonTrackLenses("R3.L02", { prefs: on, available: off }).clave).toBe(true);
    expect(lessonTrackLenses("A2.L01", { prefs: on, available: off }).registers).toBe(true);
    expect(lessonTrackLenses("A2.L01", { prefs: on, available: off }).clave).toBe(false);
    expect(lessonTrackLenses("R3.L02", { prefs: { ...on, clave: false }, available: off }).clave).toBe(false);
  });

  test("elsewhere: opened (a tool or a completed lesson) and switched on", () => {
    expect(lessonTrackLenses("J4.L01", { prefs: on, available: { ...off, voicings: true } }).voicings).toBe(
      true,
    );
    expect(lessonTrackLenses("J1.L01", { prefs: on, available: off }).voicings).toBe(false);
  });
});

describe("the Wave 7 answer kinds", () => {
  const tapEx = {
    kind: "tap",
    id: "x",
    lanes: [
      { label: "Left hand: the 2", track: "@perc" },
      { label: "Right hand: the 3", track: "@bell", key: "K" },
    ],
  } as unknown as Exercise;

  test("the jazz chord style once the glyphs are on (J1.L02)", () => {
    expect(chordStyleFor(new Set(["tb.feature.jazz-glyphs"]))).toBe("jazz");
    expect(chordStyleFor(new Set())).toBe("lead-sheet");
  });

  test("two lanes: their labels in the exercise's order (F the first, J the second); one lane is no lanes", () => {
    expect(tapLanesOf(tapEx)).toEqual([{ label: "Left hand: the 2" }, { label: "Right hand: the 3" }]);
    expect(tapLanesOf({ kind: "tap", id: "y" } as unknown as Exercise)).toBeNull();
  });

  test("two-lane taps become seconds from bar 1, split by the lane each tap came on", () => {
    expect(lanesResponse([10.5, 10.75, 11.25], [0, 1, 0], 10)).toEqual({
      lanes: [[0.5, 1.25], [0.75]],
    } as never);
    expect(lanesResponse([], [], 10)).toEqual({ lanes: [[], []] } as never);
  });

  test("a two-lane checkpoint item reaches the drill grader per lane, shifted to its response window", () => {
    const r = familyResponse({ lanes: [[1.5, 2.5], [1.75]] } as unknown as AttemptResponse, 900, 0, 1);
    expect(r).toMatchObject({ taps: [0.5, 0.75, 1.5], lanes: [[0.5, 1.5], [0.75]], rtMs: 900, replays: 0 });
    expect(r.skipped).toBeUndefined();
  });

  test("a grouping in 7/8 inside a 4/4 lesson plays its eighths at the lesson's tempo", () => {
    expect(bpmInUnit(96, "quarter", "eighth")).toBe(192);
    expect(bpmInUnit(180, "eighth", "eighth")).toBe(180);
    expect(bpmInUnit(60, "dottedQuarter", "eighth")).toBe(180);
  });

  test("the jazz numerals from J2 on, in the jazz checkpoints and capstones; not in J1 or the other tracks", () => {
    expect(jazzNumerals("J2.L02")).toBe(true);
    expect(jazzNumerals("J5.L05")).toBe(true);
    expect(jazzNumerals("J.CP1")).toBe(true);
    expect(jazzNumerals("JC4.S2")).toBe(true);
    expect(jazzNumerals("J1.L05")).toBe(false);
    expect(jazzNumerals("R2.L01")).toBe(false);
    expect(jazzNumerals("U15.L02")).toBe(false);
  });

  test("a reveal (rung 4) shows the grouping and the Euclidean numbers the step expects", () => {
    const g = {
      kind: "identify",
      id: "g",
      answer: { ui: "grouping", meter: "7/8" },
      correct: { grouping: [2, 2, 3] },
    };
    expect(revealValue(g as unknown as Exercise, g.answer as never, null)).toEqual([2, 2, 3]);
    const e = {
      kind: "fact",
      id: "e",
      answer: { ui: "euclid", maxSteps: 8, rotation: true },
      correct: { euclid: [5, 8, 1] },
    };
    expect(revealValue(e as unknown as Exercise, e.answer as never, null)).toEqual([5, 8, 1]);
  });

  test("the voicing a keyboard or chord staff asks for, as the prompt names it", () => {
    const kb = {
      kind: "keyboard",
      id: "k",
      expect: { voicing: { shape: "rootless-a", symbol: "Dm7" } },
    } as unknown as Exercise;
    expect(voicingAskOf(kb)).toEqual({ symbol: "Dm7", shape: "rootless-a" });
    const st = {
      kind: "staff-write",
      id: "s",
      expect: {
        e: "chords",
        symbols: ["Dm7", "G7"],
        spelling: "enharmonic",
        bass: false,
        voicing: ["drop-2"],
      },
    } as unknown as Exercise;
    expect(voicingAskOf(st)).toEqual({ symbol: ["Dm7", "G7"], shape: ["drop-2"] });
    expect(
      voicingAskOf({ kind: "keyboard", id: "p", expect: { pcs: [0, 4, 7] } } as unknown as Exercise),
    ).toBeNull();
  });

  test("the tutor reads a grouping, a Euclidean rhythm and two-lane taps in words, never the answer key", () => {
    const ex = { kind: "identify", id: "g", prompt: "Group it", answer: { ui: "grouping", meter: "7/8" } };
    expect(groupingText([2, 2, 3])).toBe("2+2+3");
    expect(euclidText([3, 8])).toBe("3 hits in 8 steps");
    expect(euclidText([5, 8, 1])).toBe("5 hits in 8 steps, rotated by 1");
    expect(euclidText([1, 4])).toBe("1 hit in 4 steps");
    const g = tutorAnswerOf(
      ex as unknown as Exercise,
      { answer: { grouping: [3, 2, 2] } } as AttemptResponse,
    );
    expect(g).toEqual({ kind: "text", prompt: "Group it", value: "the bar grouped 3+2+2" });
    const e = tutorAnswerOf(ex as unknown as Exercise, { answer: { euclid: [3, 8] } } as AttemptResponse);
    expect(e).toMatchObject({ kind: "text", value: "3 hits in 8 steps" });
    expect(wave7TutorText(tapEx, { lanes: [[0.5, 1], [0.7]] } as unknown as AttemptResponse)).toBe(
      "Left hand: the 2: 2 taps; Right hand: the 3: 1 tap",
    );
  });
});

// --- a track lesson is a lesson (contracts §9.6, wave7.md §5.1): budget, save and wrap, the completion -----------

function stateOf(stepId: string, patch: Partial<StepState> = {}): StepState {
  return {
    lessonId: "L",
    stepId,
    rung: 0,
    passed: false,
    attempts: 0,
    seriesNo: 0,
    revealAvailable: false,
    result: null,
    ...patch,
  };
}

function result(status: GradeResult["status"]): GradeResult {
  const score = status === "pass" ? 1 : 0;
  return {
    exerciseId: "x",
    exerciseVersion: 1,
    attemptNo: 1,
    firstAttempt: true,
    mode: "lesson",
    status,
    score,
    adjustedScore: score,
    dims: {},
    constraints: [],
    diagnostics: [],
    messages: [],
    assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
  };
}

function run(
  def: LessonDef,
  target: 15 | 20 | 25,
  splitPart: "A" | "B" | null,
  resume: string | null = null,
) {
  const finish: FinishInput[] = [];
  const quick: QuickSketchInput[] = [];
  const deps: LessonDeps = {
    async postAttempt(a) {
      return { state: stateOf(a.stepId, { passed: a.result.status === "pass", attempts: 1 }), testedOut: [] };
    },
    async hint(stepId, reveal) {
      return stateOf(stepId, { rung: reveal ? 4 : 1 });
    },
    async newSeries(stepId) {
      return stateOf(stepId, { seriesNo: 1 });
    },
    async finish(f) {
      finish.push(f);
      return {
        sketchId: "sk_track",
        result: { opened: [], gatesOpened: [] } as unknown as LessonCompleteResult,
      };
    },
    async quickSketch(q) {
      quick.push(q);
      return { sketchId: "sk_quick" };
    },
    position() {},
  };
  const actor = createActor(lessonMachine, {
    input: { lessonId: def.id, target, sessionId: "s_track", deps },
  }).start();
  actor.send({ type: "LOADED", lesson: def, resumeStep: resume, splitPart });
  return { actor, finish, quick };
}

/** Walks every step of the part: graded steps pass, everything else continues; returns the steps seen. */
async function walkPart(a: ReturnType<typeof run>["actor"]): Promise<string[]> {
  const seen: string[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const s = a.getSnapshot();
    if (!s.matches("active")) break;
    const c = s.context;
    const step = c.steps[c.index] as LessonDef["steps"][number];
    if (seen.at(-1) !== step.id) seen.push(step.id);
    if (step.kind === "make") break;
    if (step.graded && step.exercise) {
      a.send({ type: "CHECK" });
      a.send({
        type: "SUBMIT",
        response: { code: "x" },
        result: result("pass"),
        extraReplays: 0,
        exercise: step.exercise as Exercise,
        seriesNo: 0,
        params: {},
      });
      await waitFor(a, (x) => x.matches({ active: "idle" }));
    } else a.send({ type: "DONE", stepId: step.id });
    a.send({ type: "CONTINUE" });
  }
  return seen;
}

describe("a track lesson in the lesson machine behaves exactly like a core lesson", () => {
  test("not a side lesson (A1.L05 onwards included); the session's own lesson reports to it", () => {
    expect(isSideLesson("J1.L01", null)).toBe(false);
    expect(isSideLesson("A1.L05", { side: undefined })).toBe(false);
    expect(isSideLesson("A1.L04", null)).toBe(true);
    expect(reportsToSession("J1.L01", { mapItemId: "J1.L01" })).toBe(true);
    expect(reportsToSession("J1.L01", { mapItemId: "U14.L02" })).toBe(false);
  });

  test("the budget: each exemplar fits its 20 minutes and splits at 15 the way its wrapAt says", () => {
    for (const def of [j1l01, r1l01, a2l01]) {
      expect(visibleSteps(def, 20).length, def.id).toBe(def.steps.filter((s) => !s.optional).length);
      expect(splitPartFor(def, 20, null)).toBeNull();
      const at15 = splitPartFor(def, 15, null);
      if (at15 === "A") {
        const [from, to] = partRange(def.steps, def.wrapAt, "A");
        expect(def.steps[to]?.id, def.id).toBe(def.wrapAt);
        expect(from).toBe(0);
      }
    }
  });

  test("J1.L01 at 20 minutes: every step to the Make, saved and complete", async () => {
    const { actor, finish } = run(j1l01, 20, null);
    const seen = await walkPart(actor);
    expect(seen).toEqual(j1l01.steps.filter((s) => !s.optional).map((s) => s.id));
    actor.send({ type: "SAVE_MAKE", code: "setcpm(120/4)", title: "Ride" });
    await waitFor(actor, (s) => s.matches("complete"));
    expect(finish[0]).toMatchObject({ code: "setcpm(120/4)", title: "Ride" });
  });

  test("J1.L01 at 15 minutes: part A ends on the quick sketch, part B resumes after it", async () => {
    const split = splitPartFor(j1l01, 15, null);
    expect(split).toBe("A");
    const a = run(j1l01, 15, "A");
    const seenA = await walkPart(a.actor);
    expect(seenA.at(-1)).toBe(j1l01.wrapAt);
    await waitFor(a.actor, (s) => s.matches("wrapping"));
    a.actor.send({ type: "SAVE_QUICK", code: "setcpm(120/4)", title: "Ride, part A" });
    await waitFor(a.actor, (s) => s.matches("complete"));
    expect(a.quick[0]).toMatchObject({ part: "A" });
    const next = j1l01.steps[j1l01.steps.findIndex((s) => s.id === j1l01.wrapAt) + 1]?.id;
    expect(a.quick[0]?.resumeStep).toBe(next as string);
    // Part B the next day: from the step after the wrap to the Make.
    expect(splitPartFor(j1l01, 15, { splitPart: "A", status: "in_progress" })).toBe("B");
    const b = run(j1l01, 15, "B");
    const seenB = await walkPart(b.actor);
    expect(seenB[0]).toBe(next as string);
    b.actor.send({ type: "SAVE_MAKE", code: "setcpm(120/4)", title: "Ride" });
    await waitFor(b.actor, (s) => s.matches("complete"));
    expect(b.finish).toHaveLength(1);
  });

  test("Save and wrap mid-lesson: the quick sketch, and the lesson resumes at the next unfinished step", async () => {
    const { actor, quick } = run(r1l01, 20, null);
    actor.send({ type: "DONE", stepId: "S1" });
    actor.send({ type: "CONTINUE" });
    actor.send({ type: "WRAP_UP" });
    await waitFor(actor, (s) => s.matches("wrapping"));
    actor.send({ type: "SAVE_QUICK", code: "setcpm(96/4)", title: "Weight" });
    await waitFor(actor, (s) => s.matches("complete"));
    expect(quick[0]).toMatchObject({ part: null, resumeStep: "S2" });
  });
});

describe("integration: track checkpoints in the player", () => {
  const titles = lessonTitles(syllabus);
  test("a track checkpoint's result names its capstones without their IDs (its own headline, no “Open now” line)", () => {
    const jcp1 = TRACK_CHECKPOINTS.find((c) => c.cpId === "J.CP1") as (typeof TRACK_CHECKPOINTS)[number];
    expect(titles.get("JC1")).toBe("JC1 ii–V Ballad");
    const r = trackCheckpointResult({ passed: true, softPass: false, opened: ["JC1"] }, jcp1, titles);
    expect(r.body).toStartWith("“ii–V Ballad” is open.");
    expect(r.body).not.toMatch(/\b[JRA]C\d\b/);
  });
  test("a polyrhythm trial tapped with two hands is drawn as two lanes, F then J, and graded on both", () => {
    const params = {
      tapLanes: [
        { label: "Left hand: the 2, with the kick", key: "f", targets: [2, 3] },
        { label: "Right hand: the 3, after it stops", key: "j", targets: [2, 2.667, 3.333] },
      ],
    };
    expect(trialTapLanes({ params })).toEqual([
      { label: "Left hand: the 2, with the kick", track: "drill", key: "f" },
      { label: "Right hand: the 3, after it stops", track: "drill", key: "j" },
    ]);
    expect(trialTapLanes({ params: { tapTargets: [1, 2] } })).toBeNull();
    expect(trialTapLanes({ params: { tapLanes: [{ label: "one" }] } })).toBeNull();
    // The take reaches the drill grader as both lanes, each in the response window, and as one stream in order.
    const r = familyResponse(
      {
        lanes: [
          [2, 3],
          [2.01, 2.67],
        ],
      } as unknown as AttemptResponse,
      900,
      1,
      0,
    );
    expect(r).toMatchObject({
      lanes: [
        [2, 3],
        [2.01, 2.67],
      ],
      taps: [2, 2.01, 2.67, 3],
    });
  });
  test("an item is graded in its own key, else its trial's, else the checkpoint's", () => {
    const ex = { kind: "identify" } as unknown as Exercise;
    const own = { kind: "identify", key: { tonic: "F", mode: "major" } } as unknown as Exercise;
    const bb = { tonic: "Bb", mode: "major" } as const;
    expect(itemKey(own, { params: { key: bb } }, CP_KEY)).toEqual({ tonic: "F", mode: "major" });
    expect(itemKey(ex, { params: { key: bb } }, CP_KEY)).toEqual(bb);
    expect(itemKey(ex, null, CP_KEY)).toEqual(CP_KEY);
  });
});

describe("integration: a track checkpoint names only the capstones it really opens", () => {
  const titles = lessonTitles(syllabus);
  const acp = TRACK_CHECKPOINTS.find((c) => c.cpId === "A.CP") as (typeof TRACK_CHECKPOINTS)[number];
  test("A.CP soft-passed before J3.L04 and R1.L05: AC1 is open, AC2 waits for its other lessons", () => {
    for (const opened of [["AC1"], ["AC1.S1"]]) {
      const r = trackCheckpointResult({ passed: false, softPass: true, opened }, acp, titles);
      expect(r.title).toBe("On you go");
      expect(r.body).toStartWith(
        "“One Tune, Two Genres” is open. “Neo-Soul Ballad” also waits for its other lessons.",
      );
      expect(r.body).not.toContain("are open");
    }
  });
  test("with both opened (or no list from the server) both are named open", () => {
    for (const opened of [["AC1", "AC2"], undefined]) {
      const r = trackCheckpointResult(
        { passed: true, softPass: false, ...(opened ? { opened } : {}) },
        acp,
        titles,
      );
      expect(r.body).toStartWith("“One Tune, Two Genres” and “Neo-Soul Ballad” are open.");
      expect(r.body).not.toContain("waits");
    }
  });
});
