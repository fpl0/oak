/// <reference path="../../../types/strudel.d.ts" />
// The headless evaluator needs these declarations; audio's browser-only config does not include them.
import { describe, expect, test } from "bun:test";
import { evalHeadless } from "@oak/grader/testing";
import { type TapGrid, type TapsToMiniOptions, type TapsToMiniResult, tapsToMini } from "./tap-notation.ts";

interface TapCase {
  name: string;
  bpm: number;
  onsets: readonly number[];
  opts?: TapsToMiniOptions;
  expected: TapsToMiniResult;
  cycles: readonly number[];
}

const cases: TapCase[] = [
  {
    name: "AC1 quarter-note taps",
    bpm: 120,
    onsets: [0, 0.5, 1, 1.5],
    expected: { mini: "x x x x", bars: 1, dropped: 0, pickup: false },
    cycles: [0, 1 / 4, 1 / 2, 3 / 4],
  },
  {
    name: "AC2 eighth-note taps keep their rests",
    bpm: 120,
    onsets: [0, 0.25, 0.75, 1.5],
    expected: { mini: "x x ~ x ~ ~ x ~", bars: 1, dropped: 0, pickup: false },
    cycles: [0, 1 / 8, 3 / 8, 3 / 4],
  },
  {
    name: "AC3 reduces to the shortest grid at 90 bpm",
    bpm: 90,
    onsets: [0, 4 / 3, 2],
    expected: { mini: "x ~ x x", bars: 1, dropped: 0, pickup: false },
    cycles: [0, 1 / 2, 3 / 4],
  },
  {
    name: "AC4 writes a requested empty bar",
    bpm: 90,
    onsets: [0],
    opts: { bars: 2 },
    expected: { mini: "<[x] [~]>", bars: 2, dropped: 0, pickup: false },
    cycles: [0],
  },
  {
    name: "AC5 reduces each of two bars independently",
    bpm: 120,
    onsets: [0, 1, 2, 2.5, 3.5],
    expected: { mini: "<[x x] [x x ~ x]>", bars: 2, dropped: 0, pickup: false },
    cycles: [0, 1 / 2, 1, 5 / 4, 7 / 4],
  },
  {
    name: "AC6 writes a pickup before bar 1",
    bpm: 120,
    onsets: [-0.5, -0.25, 0, 1],
    expected: { mini: "<[~ ~ ~ ~ ~ ~ x x] [x x]>", bars: 2, dropped: 0, pickup: true },
    cycles: [3 / 4, 7 / 8, 1, 3 / 2],
  },
  {
    name: "AC7 sixteenth-note taps at 140 bpm",
    bpm: 140,
    onsets: [0, 9 / 28, 18 / 28, 24 / 28, 36 / 28],
    opts: { grid: 16 },
    expected: { mini: "x ~ ~ x ~ ~ x ~ x ~ ~ ~ x ~ ~ ~", bars: 1, dropped: 0, pickup: false },
    cycles: [0, 3 / 16, 3 / 8, 1 / 2, 3 / 4],
  },
  {
    name: "AC8 quarter-note taps in 3/4",
    bpm: 90,
    onsets: [0, 2 / 3, 4 / 3],
    opts: { beatsPerBar: 3 },
    expected: { mini: "x x x", bars: 1, dropped: 0, pickup: false },
    cycles: [0, 1 / 3, 2 / 3],
  },
  {
    name: "AC10 eighth-note triplets",
    bpm: 120,
    onsets: [0, 1 / 6, 1 / 3, 1 / 2, 1],
    opts: { grid: 12 },
    expected: { mini: "x x x x ~ ~ x ~ ~ ~ ~ ~", bars: 1, dropped: 0, pickup: false },
    cycles: [0, 1 / 12, 1 / 6, 1 / 4, 1 / 2],
  },
];

function jitter(onsets: readonly number[]): number[] {
  return onsets.map((t, i) => t + (i % 2 === 0 ? 0.03 : -0.03));
}

describe("tapsToMini", () => {
  for (const c of cases) {
    test(c.name, () => {
      expect(tapsToMini(c.onsets, c.bpm, c.opts)).toEqual(c.expected);
    });

    test(`AC9/AC10 alternating 30 ms jitter: ${c.name}`, () => {
      expect(tapsToMini(jitter(c.onsets), c.bpm, c.opts)).toEqual(c.expected);
    });

    test(`AC15 Strudel plays the expected onsets: ${c.name}`, async () => {
      for (const onsets of [c.onsets, jitter(c.onsets)]) {
        const { mini, bars } = tapsToMini(onsets, c.bpm, c.opts);
        const played = await evalHeadless(`r: note("c3").struct("${mini}")`, bars);
        expect(played.tracks).toEqual(["r"]);
        expect(played.events.filter((e) => e.track === "r").map((e) => e.onset)).toEqual([...c.cycles]);
      }
    });
  }

  test("AC11 close taps merge and count as dropped", () => {
    expect(tapsToMini([0, 0.04, 0.5], 120)).toEqual({
      mini: "x x ~ ~",
      bars: 1,
      dropped: 1,
      pickup: false,
    });
  });

  test("AC12 taps after the last bar or before the pickup are dropped", () => {
    const expected = { mini: "x", bars: 1, dropped: 1, pickup: false };
    expect(tapsToMini([0, 2.5], 120, { bars: 1 })).toEqual(expected);
    expect(tapsToMini([-2.5, 0], 120)).toEqual(expected);
  });

  test("AC13 unsorted input stays unchanged and gives the same result", () => {
    const onsets = Object.freeze([1.5, 0, 1, 0.5]);
    const before = [...onsets];
    const expected = { mini: "x x x x", bars: 1, dropped: 0, pickup: false };
    expect(tapsToMini(onsets, 120)).toEqual(expected);
    expect(tapsToMini(onsets, 120)).toEqual(expected);
    expect(onsets).toEqual(before);
  });

  test("AC14 non-finite onsets are ignored and counted", () => {
    expect(tapsToMini([Number.NaN, 0, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY], 120)).toEqual({
      mini: "x",
      bars: 1,
      dropped: 3,
      pickup: false,
    });
    expect(tapsToMini([Number.NaN, Number.POSITIVE_INFINITY], 120)).toEqual({
      mini: "~",
      bars: 1,
      dropped: 2,
      pickup: false,
    });
  });

  test("empty input writes one rest per requested bar", () => {
    expect(tapsToMini([], 120)).toEqual({ mini: "~", bars: 1, dropped: 0, pickup: false });
    expect(tapsToMini([], 120, { bars: 3 })).toEqual({
      mini: "<[~] [~] [~]>",
      bars: 3,
      dropped: 0,
      pickup: false,
    });
  });

  test("a pickup alone still includes bar 1 and merges repeated pickup taps", () => {
    expect(tapsToMini([-0.5, -0.49, -0.48], 120)).toEqual({
      mini: "<[~ ~ ~ x] [~]>",
      bars: 2,
      dropped: 2,
      pickup: true,
    });
    expect(tapsToMini([-2, 0, 2], 120, { bars: 1 })).toEqual({
      mini: "<[x] [x]>",
      bars: 2,
      dropped: 1,
      pickup: true,
    });
  });

  test("exact half steps round up, including at the pickup and final-bar boundaries", () => {
    expect(tapsToMini([-2.125, -0.125, 0.125, 1.875], 120, { bars: 1 })).toEqual({
      mini: "<[x] [x x ~ ~ ~ ~ ~ ~]>",
      bars: 2,
      dropped: 1,
      pickup: true,
    });
    expect(tapsToMini([1.875], 120)).toEqual({
      mini: "<[~] [x]>",
      bars: 2,
      dropped: 0,
      pickup: false,
    });
  });

  for (const grid of [8, 12, 16] as const satisfies readonly TapGrid[]) {
    for (const beatsPerBar of [2, 3, 4] as const) {
      test(`grid ${grid} in ${beatsPerBar}/4 preserves the step duration and bar boundary`, async () => {
        const steps = (grid * beatsPerBar) / 4;
        const stepSec = 2 / grid;
        const result = tapsToMini([stepSec, beatsPerBar / 2], 120, { grid, beatsPerBar });
        const firstBar = Array.from({ length: steps }, (_, i) => (i === 1 ? "x" : "~")).join(" ");
        expect(result).toEqual({ mini: `<[${firstBar}] [x]>`, bars: 2, dropped: 0, pickup: false });
        const played = await evalHeadless(`r: note("c3").struct("${result.mini}")`, result.bars);
        expect(played.events.map((e) => e.onset)).toEqual([1 / steps, 1]);
      });
    }
  }

  test("invalid bpm throws RangeError", () => {
    for (const bpm of [0, -90, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => tapsToMini([0], bpm)).toThrow(RangeError);
    }
  });

  test("invalid bars throws RangeError", () => {
    for (const bars of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => tapsToMini([0], 120, { bars })).toThrow(RangeError);
    }
  });

  test("invalid grid or beatsPerBar throws RangeError", () => {
    for (const grid of [10, 0, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(() => tapsToMini([0], 120, { grid: grid as never })).toThrow(RangeError);
    }
    for (const beatsPerBar of [0, 1, 2.5, 5, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(() => tapsToMini([0], 120, { beatsPerBar: beatsPerBar as never })).toThrow(RangeError);
    }
  });
});
