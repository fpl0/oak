// Oak 2.0 W3 (PLAN §4 S5): the timing of "play them back to back" (siblings, the chain, the tempo try).
import { describe, expect, test } from "bun:test";
import { isDescriptive } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import { BACK_TO_BACK_WORDS, barSeconds, sequenceTimes, withGain } from "./sequence.ts";

describe("barSeconds", () => {
  test("one bar is one cycle of the code's tempo line", () => {
    expect(barSeconds("setcpm(120/4)", "4/4")).toBe(2);
    expect(Math.abs(barSeconds("setcpm(90/4)", "4/4") - 8 / 3)).toBeLessThan(1e-9);
    expect(barSeconds('setcpm(120/4)\n\ndrums: s("bd sd")', "4/4")).toBe(2);
    expect(barSeconds("setcps(0.5)", "4/4")).toBe(2);
    expect(barSeconds("setcpm(30)", "4/4")).toBe(2);
  });

  test("no tempo line (or one Oak cannot read) plays at Oak's 90 BPM in the meter", () => {
    expect(Math.abs(barSeconds('drums: s("bd sd")', "4/4") - 8 / 3)).toBeLessThan(1e-9);
    expect(Math.abs(barSeconds('drums: s("bd sd")', "3/4") - 2)).toBeLessThan(1e-9);
    expect(Math.abs(barSeconds("const bpm = 96\nsetcpm(bpm/4)", "4/4") - 8 / 3)).toBeLessThan(1e-9);
  });
});

describe("sequenceTimes", () => {
  test("items follow each other with no gap", () => {
    const item = { code: "setcpm(120/4)", bars: 2, meter: "4/4" as const };
    expect(sequenceTimes([item, item])).toEqual([
      { startSec: 0, endSec: 4 },
      { startSec: 4, endSec: 8 },
    ]);
  });

  test("each item keeps its own tempo", () => {
    const times = sequenceTimes([
      { code: "setcpm(120/4)", bars: 1, meter: "4/4" },
      { code: "setcpm(60/4)", bars: 1, meter: "4/4" },
    ]);
    expect(times).toEqual([
      { startSec: 0, endSec: 2 },
      { startSec: 2, endSec: 6 },
    ]);
  });
});

describe("withGain", () => {
  const code = 'setcpm(90/4)\n\ndrums: s("bd sd")\nmel: n("0 2").scale("C4:major").s("piano")\n';
  test("a gain of 1 leaves the code as it is", () => {
    expect(withGain(code, 1)).toBe(code);
  });
  test("another gain scales every line's velocity", () => {
    const out = withGain(code, 0.5);
    expect(out).toContain('drums: s("bd sd").mul(velocity(0.5))');
    expect(out).toContain('.s("piano").mul(velocity(0.5))');
  });
  test("the scaled code evaluates, every event at that velocity, a muted line untouched", async () => {
    const out = withGain(`${code}_hats: s("hh*8");\n`, 0.5);
    expect(out).toContain('_hats: s("hh*8");');
    const r = await evalHeadless(out, 1);
    expect(r.events.length).toBe(4);
    for (const e of r.events) expect(e.value.velocity).toBe(0.5);
  });
});

describe("the player only describes", () => {
  test("its words", () => {
    const words = [
      BACK_TO_BACK_WORDS.stop,
      BACK_TO_BACK_WORDS.empty,
      BACK_TO_BACK_WORDS.playing("Sibling 1", 1, 3),
      BACK_TO_BACK_WORDS.didNotRun("Generation 2"),
    ];
    expect(words.filter((w) => !isDescriptive(w))).toEqual([]);
  });
});
