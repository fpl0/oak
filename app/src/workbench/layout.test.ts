// Roll layout math, degree colouring, transport numbers, keyboard geometry and view rules.
import { describe, expect, test } from "bun:test";
import type { GradeView } from "@oak/content-kit";
import { METERS } from "@oak/theory";
import {
  ghostEvents,
  ladderReducer,
  marksOf,
  summaryText,
  unlocks,
  visibleHints,
  whereText,
} from "./feedback.ts";
import { isBlack, keyboardRange, keyRects, typedMidi } from "./keyboard-layout.ts";
import { pageBarsFor } from "./model.ts";
import { chordRoleOf, chordToneOf, pitchLabel, rowLabel, tooltipText } from "./music.ts";
import { degreeSwatch, functionColor, hatchOf, partColor, prettyDegree } from "./palette.ts";
import {
  barGrid,
  barLabelStep,
  contentWindow,
  cycleAtX,
  hitTest,
  layoutRoll,
  pitchRange,
  playheadCycle,
  type RollInputEvent,
  rowHeight,
  xOfCycle,
} from "./roll-layout.ts";
import {
  barBeat,
  bpmText,
  chipState,
  isSilenced,
  msToNextDownbeat,
  nextPracticeTempo,
  toggleMute,
  toggleSolo,
} from "./transport-math.ts";
import { clampViews, isEarlyUnit, layoutFor } from "./views.ts";

const ev = (
  id: string,
  onset: number,
  end: number,
  midi: number | null,
  s?: string,
  drum?: string,
): RollInputEvent => ({
  id,
  onset,
  end,
  midi,
  track: midi === null ? "drums" : "mel",
  ...(s === undefined ? {} : { s }),
  ...(drum === undefined ? {} : { drum }),
});

describe("palette", () => {
  test("Okabe–Ito degree colours (ux §7.3)", () => {
    expect(degreeSwatch(1).fill).toBe("#D55E00");
    expect(degreeSwatch(5).fill).toBe("#56B4E9");
    expect(degreeSwatch(7, "bark").fill).toBe("#DE97C0");
    expect(degreeSwatch(3).outline).toBe("#8A7A10");
    expect(degreeSwatch(null).fill).toBe("#8A7F72");
    expect(degreeSwatch(8).fill).toBe("#8A7F72");
  });
  test("functions borrow degree colours; alterations hatch", () => {
    expect(functionColor("T")).toBe(degreeSwatch(1).fill);
    expect(functionColor("PD")).toBe(degreeSwatch(4).fill);
    expect(functionColor("D")).toBe(degreeSwatch(5).fill);
    expect(hatchOf(-1)).toBe("flat");
    expect(hatchOf(1)).toBe("sharp");
    expect(hatchOf(0)).toBeNull();
    expect(prettyDegree("b3")).toBe("♭3");
    expect(prettyDegree("#4")).toBe("♯4");
    expect(partColor(0)).toBe(partColor(6));
  });
});

describe("music labels", () => {
  test("degrees are 1-based, major-relative, with movable-do", () => {
    const key = { tonic: "Eb", mode: "major" as const };
    expect(pitchLabel(63, key).name).toBe("Eb4");
    expect(pitchLabel(63, key).degree?.label).toBe("1");
    expect(pitchLabel(70, key).degree?.label).toBe("5");
    expect(pitchLabel(62, key).degree?.label).toBe("7");
    // chromatic: E natural over Eb major is ♭2 (ra)
    expect(pitchLabel(64, key).degree).toMatchObject({ label: "♭2", inKey: false, syllable: "ra" });
    expect(rowLabel(67, key, "degree+solfege")).toBe("3 mi");
    expect(rowLabel(67, null, "degree")).toBe("G4");
    expect(rowLabel(66, { tonic: "G", mode: "major" }, "note")).toBe("F♯4");
  });

  test("chord tones by role", () => {
    expect(chordToneOf(60, "C^7")).toBe("R");
    expect(chordToneOf(64, "C^7")).toBe("3");
    expect(chordToneOf(71, "C^7")).toBe("7");
    expect(chordToneOf(66, "C^7")).toBeNull();
    expect(chordToneOf(63, "Cm7b5")).toBe("3");
    expect(chordToneOf(66, "Cm7b5")).toBe("♭5");
    expect(chordToneOf(69, "Co7")).toBe("7");
    expect(chordRoleOf(62, "C7")).toEqual({ label: "9", kind: "tension" });
    expect(chordRoleOf(63, "C7")).toEqual({ label: "♯9", kind: "tension" });
    expect(chordRoleOf(71, "C7")).toEqual({ label: "7", kind: "non" });
    expect(chordRoleOf(64, "Cm7")).toEqual({ label: "3", kind: "non" });
    expect(chordRoleOf(60, "nonsense")).toBeNull();
  });

  test("tooltip: note name, degree, syllable, chord role, place", () => {
    const text = tooltipText(
      { midi: 66, track: "mel", bar: 2, beatLabel: "1&", chordSymbol: "D" },
      { tonic: "D", mode: "major" },
    );
    expect(text).toBe("F♯4 · degree 3 · mi · 3 of D · mel · bar 2, beat 1&");
    expect(tooltipText({ midi: null, s: "sd", track: "drums", bar: 1, beatLabel: "3" }, null)).toBe(
      "sd · drums · bar 1, beat 3",
    );
  });
});

describe("roll layout", () => {
  test("pitch range is content ±2 semitones and at least 13 rows", () => {
    expect(pitchRange([60, 64, 67])).toEqual({ lo: 57, hi: 69 });
    expect(pitchRange([48, 84])).toEqual({ lo: 46, hi: 86 });
    expect(pitchRange([])).toBeNull();
    expect(rowHeight(13, 180)).toBe(13);
    expect(rowHeight(40, 180)).toBe(10);
    expect(rowHeight(5, 180)).toBe(18);
  });

  test("window zooms to whole bars around the content", () => {
    expect(contentWindow([ev("a", 1.25, 1.5, 60), ev("b", 2.5, 2.75, 62)], 4)).toEqual([1, 3]);
    expect(contentWindow([ev("a", 0, 0.25, 60)], 4, 2)).toEqual([0, 2]);
    expect(contentWindow([ev("a", 3.5, 3.75, 60)], 4, 2)).toEqual([2, 4]);
    expect(contentWindow([], 4, 2)).toEqual([0, 2]);
  });

  test("bar grid of 4/4, 6/8 and 7/8", () => {
    const g44 = barGrid(METERS["4/4"]);
    expect(g44.filter((g) => g.kind === "group").map((g) => g.at)).toEqual([0.25, 0.5, 0.75]);
    expect(g44.filter((g) => g.kind === "sub").length).toBe(4);
    const g68 = barGrid(METERS["6/8"]);
    expect(g68.filter((g) => g.kind === "group").map((g) => g.at)).toEqual([0.5]);
    expect(g68.filter((g) => g.kind === "sub").map((g) => +g.at.toFixed(4))).toEqual([
      0.1667, 0.3333, 0.6667, 0.8333,
    ]);
    const g78 = barGrid(METERS["7/8"]);
    expect(g78.filter((g) => g.kind === "group").map((g) => +g.at.toFixed(4))).toEqual([0.2857, 0.5714]);
  });

  test("notes, drum lanes, grid, hit testing and the playhead", () => {
    const events = [
      ev("n1", 0, 0.25, 60),
      ev("n2", 0.5, 1, 67),
      ev("k", 0, 0.25, null, "bd", "kick"),
      ev("h", 0.5, 0.625, null, "hh", "hatClosed"),
    ];
    const L = layoutRoll(events, {
      width: 444,
      meter: METERS["4/4"],
      key: { tonic: "C", mode: "major" },
      bars: 1,
    });
    expect(L.from).toBe(0);
    expect(L.to).toBe(1);
    expect(L.pxPerCycle).toBe(400);
    expect(L.pitch?.lo).toBe(57); // 58..69 widened to 13 rows
    expect(L.pitch?.hi).toBe(69);
    expect(L.pitch?.rows.find((r) => r.midi === 60)).toMatchObject({ label: "1", tonic: true, inKey: true });
    expect(L.pitch?.rows.find((r) => r.midi === 61)?.inKey).toBe(false);
    // drum lanes: hats above the kick
    expect(L.drums?.lanes.map((l) => l.sound)).toEqual(["hh", "bd"]);
    const bars = L.grid.filter((g) => g.kind === "bar");
    expect(bars.map((g) => g.bar)).toEqual([1, 2]);
    expect(bars.map((g) => g.x)).toEqual([44, 444]);
    const n2 = L.rects.find((r) => r.id === "n2");
    if (!n2) throw new Error("n2 missing");
    expect(n2.x).toBe(244);
    expect(hitTest(L, n2.x + 3, n2.y + 2)).toBe("n2");
    const k = L.rects.find((r) => r.id === "k");
    if (!k) throw new Error("k missing");
    expect(hitTest(L, k.x + k.w / 2, k.y + k.h / 2)).toBe("k");
    expect(hitTest(L, 10, 5)).toBeNull();
    expect(xOfCycle(L, 0.5)).toBe(244);
    expect(cycleAtX(L, 244)).toBe(0.5);
    expect(playheadCycle(5.25, 4)).toBe(1.25);
    expect(playheadCycle(Number.NaN, 4)).toBe(0);
  });
});

describe("transport", () => {
  test("bar.beat counter wraps the loop", () => {
    expect(barBeat(0, METERS["4/4"], 4).text).toBe("1.1 / 4");
    expect(barBeat(1.6, METERS["4/4"], 4).text).toBe("2.3 / 4");
    expect(barBeat(5.0, METERS["4/4"], 4).text).toBe("2.1 / 4");
    expect(barBeat(0.5, METERS["6/8"], 2).text).toBe("1.2 / 2");
  });
  test("BPM from cps: setcpm(92/4) shows 92; 6/8 at setcpm(66/2) shows 66", () => {
    expect(bpmText(92 / 4 / 60, METERS["4/4"])).toBe("92");
    expect(bpmText(66 / 2 / 60, METERS["6/8"])).toBe("66");
    expect(bpmText(0.5, METERS["4/4"])).toBe("120");
  });
  test("next downbeat and practice tempo", () => {
    expect(msToNextDownbeat(2, 0.5)).toBe(0);
    expect(msToNextDownbeat(2.5, 0.5)).toBeCloseTo(1000, 6);
    expect(nextPracticeTempo(1)).toBe(0.85);
    expect(nextPracticeTempo(0.5)).toBe(1);
  });
  test("mute and solo chips", () => {
    let m = { muted: new Set<string>() as ReadonlySet<string>, solo: null as string | null };
    m = toggleMute(m, "bass");
    expect(chipState("bass", m)).toBe("muted");
    expect(isSilenced(m, "bass")).toBe(true);
    m = toggleSolo(m, "mel");
    expect(chipState("mel", m)).toBe("solo");
    expect(chipState("drums", m)).toBe("silenced");
    m = toggleSolo(m, "mel");
    expect(m.solo).toBeNull();
    m = toggleMute(m, "bass");
    expect(chipState("bass", m)).toBe("on");
  });
});

describe("keyboard", () => {
  test("two octaves from a tonic, white-key edges", () => {
    expect(keyboardRange({ tonic: "C", mode: "major" }, [])).toEqual({ lo: 48, hi: 72 });
    const d = keyboardRange({ tonic: "D", mode: "major" }, [62, 74]);
    expect(d.hi - d.lo).toBe(24);
    expect(d.lo).toBeLessThanOrEqual(62);
    expect(d.hi).toBeGreaterThanOrEqual(74);
    expect(isBlack(61)).toBe(true);
    const rects = keyRects(48, 72, 300);
    expect(rects.filter((r) => !r.black).length).toBe(15);
    expect(rects.filter((r) => r.black).length).toBe(10);
  });
  test("typing map is relative to the tonic", () => {
    expect(typedMidi("a", { tonic: "D", mode: "major" }, 4)).toBe(62);
    expect(typedMidi("E", { tonic: "D", mode: "major" }, 4)).toBe(65);
    expect(typedMidi("k", null, 4)).toBe(72);
    expect(typedMidi("q", null, 4)).toBeNull();
  });
});

describe("views and layout", () => {
  test("early units show at most two of roll, staff and keyboard", () => {
    expect(isEarlyUnit("U03.L02")).toBe(true);
    expect(isEarlyUnit("U05")).toBe(false);
    expect(isEarlyUnit("J1.L01")).toBe(false);
    expect(clampViews(["roll", "staff", "keyboard"], { early: true })).toEqual(["roll", "staff"]);
    expect(clampViews(["keyboard", "roll", "keyboard"], { early: true })).toEqual(["keyboard", "roll"]);
    expect(clampViews(["roll", "staff", "keyboard"])).toEqual(["roll", "staff", "keyboard"]);
    expect(layoutFor(759)).toBe("tabs");
    expect(layoutFor(760)).toBe("stacked");
    // ux §2.1 height rule: 1280×800 leaves 744 px under the 56 px header → tabs; 1440×900 → stacked.
    expect(layoutFor(1224, 800 - 56)).toBe("tabs");
    expect(layoutFor(1384, 900 - 56)).toBe("stacked");
    expect(layoutFor(1224, 760)).toBe("stacked");
  });
});

describe("feedback", () => {
  const view: GradeView = {
    status: "fail",
    score: 0.6,
    facets: [{ dim: "pitch", score: 0.5, weight: 1 }],
    counts: { missing: 1, extra: 0, wrong: 1 },
    issues: [
      {
        severity: "error",
        where: { bar: 2, beat: 3, beatLabel: "3", noteIds: ["e1"], code: [{ from: 4, to: 6 }] },
      },
      { severity: "warn", where: { bar: 4, beat: 1 } },
    ],
    ghosts: [
      {
        id: "g1",
        track: "mel",
        onset: [5, 4],
        dur: [1, 4],
        midi: 67,
        pitchSource: "note-str",
        gain: 0.8,
        locs: [],
      },
    ],
  };
  test("rung-0 copy says where and how many", () => {
    expect(summaryText(view)).toBe("2 notes differ: bars 2 and 4.");
    expect(whereText(view.issues[0] as GradeView["issues"][number])).toBe("Bar 2, beat 3");
    // A finding with no place says nothing in front of its words (never "Somewhere in the piece").
    expect(whereText({ where: {} })).toBe("");
    expect(summaryText({ ...view, status: "pass" })).toBe("That's it.");
  });
  test("issues map to roll rings, editor marks and bar markers; ghosts become roll events", () => {
    const marks = marksOf(view);
    expect(marks.issues.get("e1")).toBe("error");
    expect(marks.code).toEqual([{ range: { from: 4, to: 6 }, kind: "error" }]);
    expect(marks.barMarks).toEqual([{ bar: 4, beat: 1, severity: "warn" }]);
    expect(ghostEvents(view)).toEqual([{ id: "ghost:g1", onset: 1.25, end: 1.5, midi: 67, track: "mel" }]);
  });
  test("ladder: never goes down, A/B from rung 2, ghosts from rung 3", () => {
    let s = ladderReducer({ rung: 0, pending: false }, { type: "request" });
    expect(s.pending).toBe(true);
    s = ladderReducer(s, { type: "granted", rung: 2 });
    expect(s).toEqual({ rung: 2, pending: false });
    s = ladderReducer(s, { type: "granted", rung: 1 });
    expect(s.rung).toBe(2);
    expect(unlocks(1)).toEqual({ ab: false, ghosts: false, nextLabel: "Pointer" });
    expect(unlocks(2)).toEqual({ ab: true, ghosts: false, nextLabel: "Partial" });
    expect(unlocks(3).ghosts).toBe(true);
    expect(unlocks(4).nextLabel).toBeNull();
    expect(unlocks(0, { abAudible: "always" }).ab).toBe(true);
    expect(unlocks(0, { passed: true }).ghosts).toBe(true);
    const ladder = [{ text: "n" }, { text: "p" }, { text: "q" }, "auto"] as const;
    expect(visibleHints(ladder, 2).map((h) => h.rung)).toEqual([1, 2]);
  });
});

describe("long rolls stay legible (runtime review: 64 bars)", () => {
  test("bar numbers are thinned to powers of two so they never overlap", () => {
    expect(barLabelStep(100)).toBe(1);
    expect(barLabelStep(26)).toBe(1);
    expect(barLabelStep(10)).toBe(4);
    expect(barLabelStep(9)).toBe(4);
    expect(barLabelStep(6)).toBe(8);
  });
  test("a 64-bar roll keeps bar lines, labels every 8th bar, and drops sub-beat lines", () => {
    const L = layoutRoll([], { width: 600, meter: METERS["4/4"], key: null, bars: 64, minBars: 64 });
    const bars = L.grid.filter((g) => g.kind === "bar");
    expect(bars.length).toBe(65);
    const labelled = bars.filter((g) => g.label).map((g) => g.bar);
    expect(labelled[0]).toBe(1);
    const xs = bars.filter((g) => g.label).map((g) => g.x);
    for (let i = 1; i < xs.length; i++)
      expect((xs[i] as number) - (xs[i - 1] as number)).toBeGreaterThanOrEqual(26);
    expect(L.grid.some((g) => g.kind === "sub")).toBe(false);
  });
  test("a 1-bar roll keeps every line and every number", () => {
    const L = layoutRoll([], { width: 600, meter: METERS["4/4"], key: null, bars: 1 });
    expect(L.grid.filter((g) => g.kind === "bar").every((g) => g.label)).toBe(true);
    expect(L.grid.some((g) => g.kind === "sub")).toBe(true);
  });
});

describe("staff pages with lens lines (pageBarsFor)", () => {
  test("at most four lines of music, three under two or more lens lines, half for a grand staff", () => {
    // One bar a line (a narrow host, names under busy bars): 4 bars a page, 3 with two text lines.
    expect(pageBarsFor(8, 1, 1, 1)).toBe(4);
    expect(pageBarsFor(8, 1, 1, 3)).toBe(3);
    expect(pageBarsFor(8, 2, 1, 3)).toBe(6);
    expect(pageBarsFor(8, 1, 2, 1)).toBe(2);
    expect(pageBarsFor(8, 1, 2, 2)).toBe(1);
    // Never more than the source's own page; never below one bar.
    expect(pageBarsFor(8, 4, 1, 1)).toBe(8);
    expect(pageBarsFor(2, 4, 1, 3)).toBe(2);
    expect(pageBarsFor(8, 0, 2, 3)).toBe(1);
  });
});
