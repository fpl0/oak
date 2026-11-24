// Loop region, metronome grid and the following roll window: the pure parts of the Wave 2 workbench keys.
import { describe, expect, test } from "bun:test";
import { METERS } from "@oak/theory";
import {
  clampRegion,
  defaultRegion,
  isWholeLoop,
  loopPosition,
  regionLabel,
  stepRegion,
  tutorBarsRegion,
} from "./loop-math.ts";
import { beatOf, beatsUntil, clickValue, firstBeatAt } from "./metronome.ts";
import { followWindow, layoutRoll } from "./roll-layout.ts";
import { shortcutRows, WORKBENCH_LOOP_SHORTCUTS } from "./shortcuts.ts";

describe("tutor bar references (c4)", () => {
  test("bars count from the first full bar: with a pickup, bar n is cycle n", () => {
    expect(tutorBarsRegion({ from: 2, to: 3 }, false)).toEqual({ from: 1, bars: 2 });
    expect(tutorBarsRegion({ from: 2, to: 3 }, true)).toEqual({ from: 2, bars: 2 });
    expect(tutorBarsRegion({ from: 1, to: 1 }, true)).toEqual({ from: 1, bars: 1 });
    // A reversed reference still names the same bars.
    expect(tutorBarsRegion({ from: 4, to: 2 }, false)).toEqual({ from: 1, bars: 3 });
  });
});

describe("loop region", () => {
  test("L loops the first half of the loop first, at least one bar", () => {
    expect(defaultRegion(4)).toEqual({ from: 0, bars: 2 });
    expect(defaultRegion(8)).toEqual({ from: 0, bars: 4 });
    expect(defaultRegion(1)).toEqual({ from: 0, bars: 1 });
    expect(defaultRegion(3)).toEqual({ from: 0, bars: 1 });
  });

  test("[ and ] shrink and extend; at the end of the loop ] grows at the start", () => {
    const r = { from: 0, bars: 2 };
    expect(stepRegion(r, "shrink", 4)).toEqual({ from: 0, bars: 1 });
    expect(stepRegion({ from: 0, bars: 1 }, "shrink", 4)).toEqual({ from: 0, bars: 1 });
    expect(stepRegion(r, "extend", 4)).toEqual({ from: 0, bars: 3 });
    expect(stepRegion({ from: 2, bars: 2 }, "extend", 4)).toEqual({ from: 1, bars: 3 });
    expect(stepRegion({ from: 0, bars: 4 }, "extend", 4)).toEqual({ from: 0, bars: 4 });
  });

  test("Shift+[ and Shift+] move by one bar and stop at the edges", () => {
    expect(stepRegion({ from: 1, bars: 2 }, "earlier", 4)).toEqual({ from: 0, bars: 2 });
    expect(stepRegion({ from: 0, bars: 2 }, "earlier", 4)).toEqual({ from: 0, bars: 2 });
    expect(stepRegion({ from: 0, bars: 2 }, "later", 4)).toEqual({ from: 1, bars: 2 });
    expect(stepRegion({ from: 2, bars: 2 }, "later", 4)).toEqual({ from: 2, bars: 2 });
  });

  test("a region always fits a shorter loop", () => {
    expect(clampRegion({ from: 6, bars: 4 }, 4)).toEqual({ from: 0, bars: 4 });
    expect(clampRegion({ from: 3, bars: 2 }, 4)).toEqual({ from: 2, bars: 2 });
    expect(clampRegion({ from: -2, bars: 0 }, 4)).toEqual({ from: 0, bars: 1 });
  });

  test("labels read as bars, 1-based", () => {
    expect(regionLabel({ from: 0, bars: 2 })).toBe("bars 1–2");
    expect(regionLabel({ from: 2, bars: 1 })).toBe("bar 3");
    expect(isWholeLoop({ from: 0, bars: 4 }, 4)).toBe(true);
    expect(isWholeLoop({ from: 0, bars: 2 }, 4)).toBe(false);
  });

  test("the playhead stays inside the region as the clock grows", () => {
    const r = { from: 2, bars: 2 };
    expect(loopPosition(0, r)).toBe(2);
    expect(loopPosition(1.5, r)).toBe(3.5);
    expect(loopPosition(2, r)).toBe(2);
    expect(loopPosition(7.25, r)).toBe(3.25);
  });
});

describe("metronome grid", () => {
  test("4/4 clicks four times a bar with the downbeat accented", () => {
    const { beats, next } = beatsUntil(0, 1, 4);
    expect(beats.map((b) => b.cycle)).toEqual([0, 0.25, 0.5, 0.75]);
    expect(beats.map((b) => b.accent)).toEqual([true, false, false, false]);
    expect(next).toBe(4);
  });

  test("3/4 clicks three times; 6/8 twice (dotted quarters)", () => {
    expect(beatsUntil(0, 1, METERS["3/4"].unitsPerBar).beats).toHaveLength(3);
    expect(beatsUntil(0, 1, METERS["6/8"].unitsPerBar).beats.map((b) => b.cycle)).toEqual([0, 0.5]);
  });

  test("scheduling resumes at the next beat and never bursts more than two bars", () => {
    expect(firstBeatAt(1.1, 4)).toBe(5);
    expect(firstBeatAt(2, 4)).toBe(8);
    expect(beatsUntil(0, 100, 4).beats).toHaveLength(8);
    expect(beatsUntil(5, 1.3, 4).beats.map((b) => b.index)).toEqual([5]);
  });

  test("the visual twin lights the beat inside the bar", () => {
    expect(beatOf(0, 4)).toBe(0);
    expect(beatOf(2.26, 4)).toBe(1);
    expect(beatOf(3.99, 4)).toBe(3);
    expect(beatOf(1.6, 3)).toBe(1);
  });

  test("the click is a short synth blip, higher on the downbeat", () => {
    expect(clickValue(true).s).toBe("sine");
    expect(Number(clickValue(true).note)).toBeGreaterThan(Number(clickValue(false).note));
  });
});

describe("a roll that follows the playhead on long loops", () => {
  test("loops that fit are drawn whole", () => {
    expect(followWindow([0, 16], 16, { playhead: 3, page: 0 })).toBeNull();
  });

  test("64 bars show 16 at a time; the page holds the playhead", () => {
    expect(followWindow([0, 64], 16, { playhead: 0.5, page: 0 })).toEqual({
      window: [0, 16],
      page: 0,
      pages: 4,
    });
    expect(followWindow([0, 64], 16, { playhead: 17.2, page: 0 })?.window).toEqual([16, 16]);
    expect(followWindow([0, 64], 16, { playhead: 63.9, page: 0 })?.window).toEqual([48, 16]);
  });

  test("while stopped the chosen page shows; the last page ends at the content", () => {
    expect(followWindow([0, 40], 16, { playhead: null, page: 2 })).toEqual({
      window: [24, 16],
      page: 2,
      pages: 3,
    });
    expect(followWindow([0, 40], 16, { playhead: null, page: 9 })?.page).toBe(2);
  });

  test("a page keeps bar lines and numbers legible (16 bars, not 64)", () => {
    const L = layoutRoll([], {
      width: 600,
      meter: METERS["4/4"],
      key: null,
      bars: 64,
      window: [16, 16],
    });
    expect(L.from).toBe(16);
    expect(L.to).toBe(32);
    const labels = L.grid.filter((g) => g.kind === "bar" && g.label).map((g) => g.bar);
    expect(labels[0]).toBe(17);
    expect(L.grid.some((g) => g.kind === "group")).toBe(true);
  });
});

describe("shortcut sheet rows", () => {
  test("every Wave 2–7 workbench key is listed, display-only", () => {
    const rows = shortcutRows();
    expect(rows.map((r) => r.keys)).toEqual(WORKBENCH_LOOP_SHORTCUTS.map(([k]) => k));
    expect(rows.every((r) => r.when?.({} as never) === false && r.scope === "workbench")).toBe(true);
    expect(rows.map((r) => r.keys)).toEqual([
      "L",
      "[",
      "]",
      "Shift+[",
      "Shift+]",
      "M",
      "D",
      "S",
      "Shift+N",
      "Shift+K",
      "Shift+C",
      "Shift+H",
      "Shift+R",
      "Shift+F",
      "Shift+T",
      "Shift+G",
      "Shift+L",
      "Shift+O",
      "Shift+E",
      "Shift+B",
      "Shift+U",
      "Shift+W",
      "Shift+Y",
      "Shift+P",
      "Shift+I",
      "Shift+J",
      "Shift+V",
      // Wave 7: tensions, chord-scales, density (the only Shift+letters left).
      "Shift+X",
      "Shift+Q",
      "Shift+D",
    ]);
  });
});
