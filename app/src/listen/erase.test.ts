// Oak 2.0 W4 F3: the erase pass's parts, its code writes (leave out, thin) and Oak's reading of crowded registers.
import { describe, expect, test } from "bun:test";
import { evalHeadless } from "@oak/grader/testing";
import { isDescriptive } from "../studio/descriptive.ts";
import {
  crowdedPairs,
  crowdedSentence,
  crowdingHaps,
  ERASE_COPY,
  erasableParts,
  leaveOut,
  midiOfValue,
  REGISTER_WINDOW,
  thinLine,
  withPartMuted,
} from "./erase.ts";

const CODE = 'drums: s("bd*4")\nbass: note("c2")\n_pad: note("c3")\nbass: note("e2")';

describe("parts and code writes", () => {
  test("erasableParts: unmuted labelled lines, source order, one per label", () => {
    expect(erasableParts(CODE)).toEqual(["drums", "bass"]);
    expect(erasableParts('setcpm(90/4)\n$: s("bd")\nmel: n("0")')).toEqual(["mel"]);
    expect(erasableParts("setcpm(90/4)")).toEqual([]);
  });

  test("leaveOut writes _<label>: and keeps every other byte", () => {
    const out = leaveOut(CODE, "bass");
    expect(out).toBe('drums: s("bd*4")\n_bass: note("c2")\n_pad: note("c3")\nbass: note("e2")');
    expect(out.replace("_bass:", "bass:")).toBe(CODE);
    expect(leaveOut(CODE, "nope")).toBe(CODE);
  });

  test('thinLine: every other bar is .mask("<1 0>"), shorter notes .legato(0.5)', () => {
    expect(thinLine(CODE, "bass", "every-other-bar")).toBe(
      'drums: s("bd*4")\nbass: note("c2").mask("<1 0>")\n_pad: note("c3")\nbass: note("e2")',
    );
    expect(thinLine(CODE, "bass", "shorter")).toBe(
      'drums: s("bd*4")\nbass: note("c2").legato(0.5)\n_pad: note("c3")\nbass: note("e2")',
    );
  });

  test("every other bar plays in bars 1 and 3, not 2 and 4", async () => {
    const code = thinLine('setcpm(90/4)\nbass: note("c2*2").s("triangle")', "bass", "every-other-bar");
    const { events } = await evalHeadless(code, 4);
    const bars = new Set(events.filter((e) => e.track === "bass").map((e) => Math.floor(e.onset) + 1));
    expect([...bars].sort()).toEqual([1, 3]);
  });

  test("withPartMuted adds the part to the learner's own mutes; null leaves them", () => {
    const before = { muted: new Set(["kick"]), solo: null };
    const m = withPartMuted(before, "bass");
    expect([...m.muted].sort()).toEqual(["bass", "kick"]);
    expect(before.muted.has("bass")).toBe(false);
    expect(withPartMuted(before, null)).toEqual(before);
    expect(withPartMuted({ muted: new Set(), solo: "mel" }, "bass").solo).toBeNull();
  });
});

describe("crowdedPairs", () => {
  const n = (track: string, begin: number, end: number, midi: number | null) => ({ track, begin, end, midi });

  test("a bass at C3 under a C3 triad in bar 1 crowds the chords near C3", () => {
    const haps = [n("bass", 0, 1, 48), n("chords", 0, 1, 48), n("chords", 0, 1, 52), n("chords", 0, 1, 55)];
    expect(crowdedPairs(haps, { cyclesPerBar: 1 })).toEqual([
      { a: "bass", b: "chords", bars: [[1, 1]], near: "C3" },
    ]);
  });

  test("a bass at C2 under chords at C4 is apart", () => {
    const haps = [n("bass", 0, 1, 36), n("chords", 0, 1, 60), n("chords", 0, 1, 64)];
    expect(crowdedPairs(haps, { cyclesPerBar: 1 })).toEqual([]);
  });

  test("the same register at different times is not crowding", () => {
    const haps = [
      n("mel", 0, 0.5, 60),
      n("chords", 0.5, 1, 60),
      n("mel", 1, 1.5, 62),
      n("chords", 1.5, 2, 62),
    ];
    expect(crowdedPairs(haps, { cyclesPerBar: 1 })).toEqual([]);
  });

  test("drums, kick and the Band never appear; unpitched haps are ignored", () => {
    const haps = [
      n("kick", 0, 1, 48),
      n("drums", 0, 1, 48),
      n("band.bass", 0, 1, 48),
      n("bass", 0, 1, 48),
      n("perc", 0, 1, null),
    ];
    expect(crowdedPairs(haps, { cyclesPerBar: 1 })).toEqual([]);
  });

  test("overlaps in bars 1, 2 and 4 run as 1–2 and 4", () => {
    const haps = [0, 1, 3].flatMap((b) => [n("bass", b, b + 1, 50), n("chords", b, b + 1, 52)]);
    expect(crowdedPairs(haps, { cyclesPerBar: 1 })[0]?.bars).toEqual([
      [1, 2],
      [4, 4],
    ]);
  });

  test("the window is REGISTER_WINDOW half steps, inclusive", () => {
    expect(REGISTER_WINDOW).toBe(5);
    expect(crowdedPairs([n("bass", 0, 1, 48), n("tune", 0, 1, 53)], { cyclesPerBar: 1 })).toHaveLength(1);
    expect(crowdedPairs([n("bass", 0, 1, 48), n("tune", 0, 1, 54)], { cyclesPerBar: 1 })).toHaveLength(0);
  });

  test("pairs follow the code's label order and then the first bar", () => {
    const haps = [n("mel", 2, 3, 60), n("chords", 2, 3, 62), n("chords", 0, 1, 48), n("bass", 0, 1, 48)];
    const pairs = crowdedPairs(haps, { cyclesPerBar: 1, order: ["bass", "chords", "mel"] });
    expect(pairs.map((p) => [p.a, p.b, p.bars[0]?.[0]])).toEqual([
      ["bass", "chords", 1],
      ["chords", "mel", 3],
    ]);
  });

  test("crowdingHaps reads MIDI as the roll does: note numbers, note names, freq and octave", () => {
    expect(midiOfValue({ note: 48 })).toBe(48);
    expect(midiOfValue({ note: "c3" })).toBe(48);
    expect(midiOfValue({ note: "c3", octave: 1 })).toBe(60);
    expect(midiOfValue({ freq: 440 })).toBeCloseTo(69, 6);
    expect(midiOfValue({ s: "bd", n: 2 })).toBeNull();
    const haps = crowdingHaps([{ track: "bass", begin: 0, end: 1, value: { note: "c3" }, locations: [] }]);
    expect(haps).toEqual([{ track: "bass", begin: 0, end: 1, midi: 48 }]);
  });

  test("a scale's degrees, evaluated, crowd as they sound", async () => {
    const { events } = await evalHeadless(
      'bass: note("c3").s("triangle")\nchords: n("[0,2,4]").scale("C3:major").s("piano")',
      1,
    );
    const frac = (s: string) => {
      const [a, b] = s.split("/");
      return Number(a) / (b === undefined ? 1 : Number(b));
    };
    // The live haps carry what `.scale()` wrote into the value: read it as the roll does.
    const haps = crowdingHaps(
      events.map((e) => ({
        track: e.track,
        begin: frac(e.begin),
        end: frac(e.end),
        value: e.value,
        locations: [],
      })),
    );
    expect(haps.map((x) => x.midi)).toEqual(events.map((e) => e.midi));
    expect(crowdedPairs(haps, { cyclesPerBar: 1 })).toEqual([
      { a: "bass", b: "chords", bars: [[1, 1]], near: "C3" },
    ]);
  });

  test("the sentence names both parts, the note and the bars", () => {
    expect(crowdedSentence({ a: "bass", b: "chords", bars: [[3, 4]], near: "C3" })).toBe(
      "bass and chords play near C3 at the same time in bars 3–4.",
    );
    expect(
      crowdedSentence({
        a: "bass",
        b: "chords",
        bars: [
          [1, 2],
          [4, 4],
        ],
        near: "C3",
      }),
    ).toBe("bass and chords play near C3 at the same time in bars 1–2 and bar 4.");
  });
});

test("every erase-pass string is descriptive, and none counts parts as a goal", () => {
  const strings = [
    ...Object.values(ERASE_COPY).filter((v): v is string => typeof v === "string"),
    ERASE_COPY.now("bass"),
    crowdedSentence({ a: "bass", b: "chords", bars: [[3, 4]], near: "C3" }),
  ];
  for (const s of strings) {
    expect(isDescriptive(s)).toBe(true);
    expect(s).not.toMatch(/\b(?:fewer than|at most|at least|only) \d/);
  }
  expect(ERASE_COPY.intro).toContain("this is not about having fewer parts");
});
