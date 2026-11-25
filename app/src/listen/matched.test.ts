// Oak 2.0 W4 F5: every A/B plays at matched loudness, turning sides down and never up, and the blind compare names
// its sides "1" and "2" until the learner has chosen.
import { describe, expect, test } from "bun:test";
import { blindOrder } from "../capstone/nudge.ts";
import { isDescriptive } from "../studio/descriptive.ts";
import { levelDbOf, MATCHED_COMPARE_LINE, matchedSideGains, sideLabels } from "./matched.ts";

const close = (got: number[], want: number[]) => {
  expect(got).toHaveLength(want.length);
  got.forEach((g, i) => {
    expect(g).toBeCloseTo(want[i] as number, 3);
  });
};

describe("matchedSideGains", () => {
  test("the louder side is turned down to the quieter one", () => {
    close(matchedSideGains([-20, -23]), [0.708, 1]);
    close(matchedSideGains([-23, -20]), [1, 0.708]);
    close(matchedSideGains([-14, -20, -17]), [0.501, 1, 0.708]);
  });

  test("within 0.1 dB, or unmeasurable, a side stays at 1", () => {
    expect(matchedSideGains([-20, -20.05])).toEqual([1, 1]);
    expect(matchedSideGains([Number.NEGATIVE_INFINITY, -20])).toEqual([1, 1]);
    expect(matchedSideGains([Number.NaN, Number.NEGATIVE_INFINITY])).toEqual([1, 1]);
    expect(matchedSideGains([])).toEqual([]);
  });

  test("never turns a side up", () => {
    let s = 12345;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
    for (let k = 0; k < 100; k++) {
      const n = 2 + Math.floor(rand() * 4);
      const levels = Array.from({ length: n }, () =>
        rand() < 0.1 ? Number.NEGATIVE_INFINITY : -60 + rand() * 60,
      );
      for (const g of matchedSideGains(levels)) {
        expect(g).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThan(0);
      }
    }
  });
});

describe("levelDbOf (BS.1770 loudness)", () => {
  const sine = (amp: number, fs: number, seconds: number) =>
    Float32Array.from({ length: fs * seconds }, (_, i) => amp * Math.sin((2 * Math.PI * 1000 * i) / fs));

  test("a 1 kHz sine of amplitude 0.1 on both channels reads -20 LUFS", () => {
    const x = sine(0.1, 48_000, 3);
    expect(Math.abs(levelDbOf({ left: x, right: x, sampleRate: 48_000 }) + 20)).toBeLessThanOrEqual(0.3);
  });

  test("silence reads -Infinity, so its side stays at gain 1", () => {
    const zeros = new Float32Array(48_000);
    const level = levelDbOf({ left: zeros, right: zeros, sampleRate: 48_000 });
    expect(level).toBe(Number.NEGATIVE_INFINITY);
    expect(matchedSideGains([level, -20])).toEqual([1, 1]);
  });

  test("half the amplitude is about 6 dB down", () => {
    const full = sine(0.2, 44_100, 2);
    const half = sine(0.1, 44_100, 2);
    const a = levelDbOf({ left: full, right: full, sampleRate: 44_100 });
    const b = levelDbOf({ left: half, right: half, sampleRate: 44_100 });
    expect(a - b).toBeCloseTo(6.02, 1);
  });
});

describe("sideLabels", () => {
  const sides = [
    { id: "earlier", label: "version 2" },
    { id: "current", label: "your draft now" },
  ];

  test("blind and not revealed: 1 and 2 in blindOrder's order, no label text", () => {
    for (const seed of ["C3:1:2", "C3:2:3", "C3:3:4", "C3:4:live"]) {
      const shown = sideLabels(sides, { blind: true, revealed: false, seed });
      expect(shown.map((s) => s.shown)).toEqual(["1", "2"]);
      expect(shown.map((s) => s.id)).toEqual([...blindOrder(seed)]);
      expect(JSON.stringify(shown.map((s) => s.shown))).not.toContain("version");
    }
  });

  test("revealed: the labels, the buttons in the same places", () => {
    const seed = "C3:2:3";
    const blind = sideLabels(sides, { blind: true, revealed: false, seed });
    const open = sideLabels(sides, { blind: true, revealed: true, seed });
    expect(open.map((s) => s.id)).toEqual(blind.map((s) => s.id));
    expect(open.map((s) => s.shown)).toEqual(
      blind.map((s) => (s.id === "earlier" ? "version 2" : "your draft now")),
    );
  });

  test("not blind: the labels in the given order", () => {
    expect(sideLabels(sides, { blind: false, revealed: false, seed: "x" })).toEqual([
      { id: "earlier", shown: "version 2" },
      { id: "current", shown: "your draft now" },
    ]);
  });
});

test("the matched-compare line is descriptive", () => {
  expect(isDescriptive(MATCHED_COMPARE_LINE)).toBe(true);
});
