// Oak 2.0 W1 (S3 jam then edit, S4 focus one part): jam hides every critique, the tutor waits with its own notice,
// the rough-pass row only describes, the timebox counts down quietly, focus mutes the other lines.
import { beforeEach, describe, expect, test } from "bun:test";
import { askChat, setSubject, type TutorSubject, useTutorContext } from "../tutor/context.ts";
import { isDescriptive } from "./descriptive.ts";
import {
  FOCUS_ASK,
  FOCUS_NOT_YET,
  FOCUS_YES,
  focusLine,
  focusMutes,
  JAM_TUTOR_NOTICE,
  JAM_WORDS,
  roughPassLine,
  studioChrome,
  TIMEBOX_MINUTES,
  timeboxLeft,
  timeUpQuestion,
} from "./jam.ts";

beforeEach(() => {
  useTutorContext.setState({
    subject: null,
    availability: "ready",
    offReason: null,
    queue: [],
    notice: null,
  });
});

describe("jam chrome", () => {
  test("jam chrome hides every hint, tip and compare and floors lint at error", () => {
    expect(studioChrome({ jam: true })).toEqual({
      tutorOpen: false,
      hints: false,
      tips: false,
      compare: false,
      lintFloor: "error",
    });
    expect(studioChrome({ jam: false })).toEqual({
      tutorOpen: true,
      hints: true,
      tips: true,
      compare: true,
      lintFloor: "info",
    });
  });

  test("the jam subject is closed with the jam notice, not the checkpoint one", () => {
    const jam: TutorSubject = {
      thread: { subjectKind: "sketch", subjectId: "sk_1" },
      title: "Sketch 001",
      tutorOpen: false,
      closedNotice: JAM_TUTOR_NOTICE,
      sketchId: "sk_1",
      code: 'drums: s("bd*4")',
    };
    setSubject(jam);
    const r = askChat("What should I add?");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.notice.kind).toBe("closed");
      expect(r.notice.message).toBe(JAM_TUTOR_NOTICE);
    }
    expect(useTutorContext.getState().queue).toHaveLength(0);
    // A closed subject without its own notice still gets the checkpoint copy.
    const { closedNotice: _n, ...checkpoint } = jam;
    setSubject({ ...checkpoint, thread: { subjectKind: "checkpoint", subjectId: "U01.CP" } });
    const c = askChat("Help?");
    expect(c.ok ? null : c.notice.message).toContain("checkpoints and drill trials are yours alone");
  });

  test("an open subject is not refused because closedNotice is set", () => {
    setSubject({
      thread: { subjectKind: "sketch", subjectId: "sk_2" },
      title: "Sketch 002",
      tutorOpen: true,
      closedNotice: JAM_TUTOR_NOTICE,
      sketchId: "sk_2",
      code: "",
    });
    expect(askChat("Hello").ok).toBe(true);
  });
});

describe("rough pass", () => {
  const all = [
    "setcpm(96/4)",
    'drums: s("bd sd")',
    'bass: note("c2 g2").s("triangle")',
    'chords: chord("<C F>").voicing()',
    'mel: n("0 2 4").scale("C4:major")',
  ].join("\n");
  const drumsBass = 'setcpm(96/4)\ndrums: s("bd sd")\nbass: note("c2")';
  const none = "setcpm(96/4)\n// an idea";

  test("the rough-pass row only describes", () => {
    const lines = [roughPassLine(all), roughPassLine(drumsBass), roughPassLine(none)];
    expect(lines).toEqual([
      "This take has drums, bass, chords and a tune.",
      "This take has drums and bass. Not in it yet: chords, tune.",
      "This take has no part yet.",
    ]);
    for (const l of lines) {
      expect(isDescriptive(l)).toBe(true);
      expect(l).not.toMatch(/[✓✔✗✘/]|\d/);
    }
  });

  test("a muted line does not count; vox is a tune; an other label is not named", () => {
    expect(roughPassLine('drums: s("bd")\n_bass: note("c2")')).toBe(
      "This take has drums. Not in it yet: bass, chords, tune.",
    );
    expect(roughPassLine('vox: n("0 2")\nriff: s("hh*8")')).toBe(
      "This take has a tune. Not in it yet: drums, bass, chords.",
    );
    expect(roughPassLine('kick: s("bd*4")\npad: chord("C").voicing()')).toBe(
      "This take has drums and chords. Not in it yet: bass, tune.",
    );
  });
});

describe("timebox", () => {
  test("the lengths are Oak's call and none is a target", () => {
    expect([...TIMEBOX_MINUTES]).toEqual([5, 10, 15, 20, 25]);
  });

  test("counts down, stops at zero, never negative", () => {
    const t = { task: "groove", minutes: 10, startedAt: 0 };
    expect(timeboxLeft(t, 9 * 60_000 + 59_000)).toEqual({ leftMs: 1000, up: false });
    expect(timeboxLeft(t, 10 * 60_000)).toEqual({ leftMs: 0, up: true });
    expect(timeboxLeft(t, 99 * 60_000)).toEqual({ leftMs: 0, up: true });
    expect(timeboxLeft(t, 0)).toEqual({ leftMs: 600_000, up: false });
  });

  test("the time's-up question names the task", () => {
    expect(timeUpQuestion("groove")).toBe("Time's up for “groove”. Switch to editing?");
  });
});

describe("focus one part", () => {
  test("focusMutes mutes every other line", () => {
    const m = focusMutes(["drums", "bass", "mel"], "bass");
    expect([...m.muted].sort()).toEqual(["drums", "mel"]);
    expect(m.solo).toBeNull();
  });

  test("no focus: no learner mutes", () => {
    const m = focusMutes(["drums", "bass", "mel"], null);
    expect(m.muted.size).toBe(0);
    expect(m.solo).toBeNull();
  });
});

describe("words", () => {
  test("every jam, timebox and focus string describes", () => {
    const strings = [
      JAM_TUTOR_NOTICE,
      FOCUS_ASK,
      FOCUS_YES,
      FOCUS_NOT_YET,
      timeUpQuestion("groove"),
      focusLine("bass"),
      ...Object.values(JAM_WORDS),
    ];
    for (const s of strings) expect({ s, ok: isDescriptive(s) }).toEqual({ s, ok: true });
  });
});
