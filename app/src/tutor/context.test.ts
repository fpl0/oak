import { beforeEach, describe, expect, test } from "bun:test";
import { type GradeResult, GradeSnapshotSchema, TutorTurnRequestSchema } from "@oak/api";
import {
  askChat,
  askExplain,
  askHint,
  askListeningNote,
  askReview,
  buildTurnRequest,
  chipsOf,
  clearSubject,
  gradeSnapshotOf,
  openTutor,
  patchSubject,
  setAvailability,
  setSubject,
  type TutorSubject,
  takeAsk,
  useTutorContext,
} from "./context.ts";

const result: GradeResult = {
  exerciseId: "U01.L02/rest-on-three",
  exerciseVersion: 1,
  attemptNo: 1,
  firstAttempt: true,
  mode: "lesson",
  status: "fail",
  score: 0.5,
  adjustedScore: 0.5,
  dims: { rhythm: { score: 0.5, weight: 1 } },
  constraints: [],
  diagnostics: [
    {
      id: "rhythm.displaced",
      severity: "error",
      params: { got: "beat 2", expected: "beat 3" },
      where: { track: "drums", bar: 1, beat: 2, code: [{ from: 20, to: 22 }] },
    },
  ],
  messages: [],
  assist: { rung: 0, revealed: false, tutorHints: 0 },
} as unknown as GradeResult;

const lesson: TutorSubject = {
  thread: { subjectKind: "lesson", subjectId: "U01.L02" },
  title: "U01.L02 · Count to four",
  tutorOpen: true,
  lessonId: "U01.L02",
  stepId: "S2",
  graded: true,
  passed: false,
  code: 'setcpm(96/4)\n\ndrums: s("bd bd bd bd")',
  lastResult: result,
  rung: 1,
};

beforeEach(() => {
  useTutorContext.setState({
    subject: null,
    availability: "ready",
    offReason: null,
    queue: [],
    notice: null,
  });
});

describe("subject", () => {
  test("set, patch only the same thread, clear only the same thread", () => {
    setSubject(lesson);
    patchSubject({ subjectKind: "sketch", subjectId: "sk_1" }, { code: "x" });
    expect(useTutorContext.getState().subject?.code).toBe(lesson.code);
    patchSubject(lesson.thread, { rung: 2 });
    expect(useTutorContext.getState().subject?.rung).toBe(2);
    clearSubject({ subjectKind: "sketch", subjectId: "sk_1" });
    expect(useTutorContext.getState().subject).not.toBeNull();
    clearSubject(lesson.thread);
    expect(useTutorContext.getState().subject).toBeNull();
  });

  test("chips show exactly what the turn carries", () => {
    expect(chipsOf(lesson).map((c) => c.label)).toEqual([
      "U01.L02 · S2",
      "Your code · 3 lines",
      "Last check: 50%",
      "Hints 1/4",
    ]);
  });

  test("a lesson in a unit song shows the song after the step (contracts §5.11 rule 19)", () => {
    const labels = chipsOf({ ...lesson, song: { title: "Porch light" } }).map((c) => c.label);
    expect(labels.slice(0, 2)).toEqual(["U01.L02 · S2", "Song · Porch light"]);
    expect(chipsOf({ ...lesson, song: null }).some((c) => c.id === "song")).toBe(false);
  });
});

describe("asks", () => {
  test("a hint is queued with the subject's code and snapshot, and opens the panel", () => {
    setSubject(lesson);
    const before = useTutorContext.getState().openRequests;
    const r = askHint();
    expect(r.ok).toBe(true);
    expect(useTutorContext.getState().openRequests).toBe(before + 1);
    const a = takeAsk();
    expect(a?.kind).toBe("hint");
    expect(TutorTurnRequestSchema.safeParse(a?.request).success).toBe(true);
    expect(a?.request).toMatchObject({ lessonId: "U01.L02", stepId: "S2", learnerCode: lesson.code });
    expect(takeAsk()).toBeNull();
  });

  test("with the tutor off every ask is a visible no-op", () => {
    setAvailability({ tutor: "missing_key", tutorBackend: null });
    setSubject(lesson);
    for (const r of [askHint(), askExplain(), askChat("why?")]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.notice.kind).toBe("off");
    }
    expect(useTutorContext.getState().queue).toEqual([]);
    expect(useTutorContext.getState().notice?.message).toContain("no API key");
    openTutor();
  });

  test("closed subjects (checkpoint, drill trial) refuse; hints need a graded unpassed step", () => {
    setSubject({ ...lesson, thread: { subjectKind: "checkpoint", subjectId: "U01.CP" }, tutorOpen: false });
    const r = askChat("help");
    expect(r.ok ? null : r.notice.kind).toBe("closed");
    setSubject({ ...lesson, passed: true });
    const h = askHint();
    expect(h.ok ? null : h.notice.kind).toBe("no-subject");
  });

  test("listening notes and reviews carry their own subject", () => {
    const n = askListeningNote({ sketchId: "sk_7", title: "Sketch 007", code: 'n("0 2 4")' });
    const v = askReview({ capstoneId: "C1", title: "C1 draft", code: 'n("0")' });
    expect(n.ok && n.ask.request.thread).toEqual({ subjectKind: "sketch", subjectId: "sk_7" });
    expect(v.ok && v.ask.kind).toBe("review-capstone");
    expect(v.ok && v.ask.request.thread).toEqual({ subjectKind: "capstone", subjectId: "C1" });
  });
});

describe("requests", () => {
  test("the grade snapshot is valid wire data", () => {
    const snap = gradeSnapshotOf(result);
    expect(GradeSnapshotSchema.safeParse(snap).success).toBe(true);
    expect(snap.issues[0]).toMatchObject({
      where: { track: "drums", bar: 1, beat: 2, code: { from: 20, to: 22 } },
      expected: "beat 3",
      got: "beat 2",
    });
    expect(buildTurnRequest({ ...lesson, code: null, lastResult: null }, "chat", "hi")).toEqual({
      thread: lesson.thread,
      kind: "chat",
      userText: "hi",
      lessonId: "U01.L02",
      stepId: "S2",
    });
  });
});

describe("chips, exclusions and hosts", () => {
  test("switched-off chips leave the request; identity chips cannot be switched off", async () => {
    const { toggleChip, chipRemovable } = await import("./context.ts");
    setSubject({ ...lesson, selection: 'n("0 2")' });
    toggleChip("result");
    toggleChip("step");
    expect(useTutorContext.getState().excluded).toEqual(["result"]);
    const r = askChat("why bar 2?");
    const req = r.ok ? r.ask.request : null;
    expect(req?.graderResult).toBeUndefined();
    expect(req?.learnerCode).toBe(lesson.code as string);
    expect(req?.userText).toContain('Selected code:\n```\nn("0 2")\n```');
    expect(chipRemovable("code", "listening")).toBe(false);
    expect(chipRemovable("hints")).toBe(false);
    // A new thread starts with every chip on.
    setSubject({ ...lesson, thread: { subjectKind: "sketch", subjectId: "sk_1" } });
    expect(useTutorContext.getState().excluded).toEqual([]);
  });

  test("explain needs a lesson step; hosts register per thread", async () => {
    const { registerTutorHost, tutorHostFor, showBars, TUTOR_BARS_EVENT } = await import("./context.ts");
    setSubject({
      thread: { subjectKind: "sketch", subjectId: "sk_2" },
      title: "Sketch",
      tutorOpen: true,
      code: "x",
    });
    const e = askExplain();
    expect(e.ok ? null : e.notice.kind).toBe("no-subject");
    const seen: number[][] = [];
    const off = registerTutorHost({
      thread: { subjectKind: "sketch", subjectId: "sk_2" },
      showBars: (a, b) => seen.push([a, b]),
    });
    expect(tutorHostFor({ subjectKind: "sketch", subjectId: "sk_2" })).not.toBeNull();
    showBars({ subjectKind: "sketch", subjectId: "sk_2" }, 3, 4);
    expect(seen).toEqual([[3, 4]]);
    off();
    expect(tutorHostFor({ subjectKind: "sketch", subjectId: "sk_2" })).toBeNull();
    expect(TUTOR_BARS_EVENT).toBe("oak:tutor-bars");
  });
});
