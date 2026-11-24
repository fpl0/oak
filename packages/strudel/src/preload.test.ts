// The preloader's plan: which values it warms, in what order, and which of them share a file. No audio runs:
// the sounds are registered with stand-in triggers and the warms are recorded.
import { describe, expect, test } from "bun:test";
import * as webaudio from "@strudel/webaudio";
import type { HapValue } from "./pack.ts";
import { fileKeyOf, valuesOfPattern, warmAhead } from "./preload.ts";

const noop = () => undefined;
webaudio.registerSound("t_pitched", noop, {
  type: "sample",
  samples: { c3: ["c3.mp3"], g3: ["g3.mp3"] },
});
// A v4 sample alias: two velocity layers per pitch, the soft one below 0.6.
webaudio.registerSound("t_layered", noop, {
  type: "sample",
  samples: { c3: ["c3_0.mp3", "c3_1.mp3"] },
  layers: 2,
  split: [0.6],
});
webaudio.registerSound("t_font", noop, { type: "soundfont", fonts: ["0000_test"] });

/** A pattern whose query lists haps voice by voice, as a stack does. */
function stackOf(haps: { at: number; value: HapValue }[]) {
  return {
    queryArc(from: number, to: number) {
      return haps
        .filter((h) => h.at >= from && h.at < to)
        .map(
          (h) =>
            ({
              whole: { begin: { valueOf: () => h.at }, end: { valueOf: () => h.at + 0.25 } },
              part: { begin: { valueOf: () => h.at }, end: { valueOf: () => h.at + 0.25 } },
              value: h.value,
              hasOnset: () => true,
            }) as unknown as Strudel.Hap,
        );
    },
  };
}

describe("fileKeyOf", () => {
  test("neighbouring pitches of a pitched map share the file superdough picks for them", () => {
    expect(fileKeyOf({ s: "t_pitched", note: "c3" })).toBe(fileKeyOf({ s: "t_pitched", note: "d3" }));
    expect(fileKeyOf({ s: "t_pitched", note: "c3" })).not.toBe(fileKeyOf({ s: "t_pitched", note: "f3" }));
  });

  test("velocities in the same layer share a file; across the split they do not", () => {
    const at = (velocity: number) => fileKeyOf({ s: "t_layered", note: "c3", velocity });
    expect(at(0.3)).toBe(at(0.5));
    expect(at(0.84)).toBe(at(1));
    expect(at(0.5)).not.toBe(at(0.9));
  });

  test("soundfont zones are per pitch, whatever the velocity; unknown sounds fall back to the value", () => {
    expect(fileKeyOf({ s: "t_font", note: 60, velocity: 0.4 })).toBe(fileKeyOf({ s: "t_font", note: 60 }));
    expect(fileKeyOf({ s: "t_font", note: 60 })).not.toBe(fileKeyOf({ s: "t_font", note: 62 }));
    expect(fileKeyOf({ s: "t_nothing", n: 1 })).not.toBe(fileKeyOf({ s: "t_nothing", n: 2 }));
  });
});

describe("valuesOfPattern / warmAhead", () => {
  // A verse melody note at 2.75 and a chorus pad at 8, listed pad first (the pad's voice comes first).
  const pattern = stackOf([
    { at: 8, value: { s: "t_layered", note: "c3" } },
    { at: 9, value: { s: "t_layered", note: "c3" } },
    { at: 2.75, value: { s: "t_pitched", note: "g3" } },
    { at: 2, value: { s: "t_pitched", note: "c3" } },
  ]);

  test("values come earliest onset first, whatever the voice order", () => {
    expect(valuesOfPattern(pattern, 2, 10).map((v) => v.note)).toEqual(["c3", "g3", "c3", "c3"]);
  });

  test("each chunk warms its new files once, the next bars' first", async () => {
    const warmed: HapValue[][] = [];
    const ahead = warmAhead(pattern, 2, 10, {
      chunk: 8,
      warm: async (values) => {
        warmed.push([...values]);
        return { warmed: values.length, synths: 0, missing: [], ms: 0 };
      },
    });
    const r = await ahead.done;
    expect(warmed.map((c) => c.map((v) => `${v.s} ${v.note}`))).toEqual([
      ["t_pitched c3", "t_pitched g3", "t_layered c3"],
    ]);
    expect(r.cycles).toBe(8);
  });
});
