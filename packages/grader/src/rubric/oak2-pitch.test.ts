import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { KeySpec } from "@oak/content-kit";
import { identifyChord, toLeadSheet } from "@oak/theory";
import { strudel } from "../analyze/__support__/fixtures.ts";
import { normalizedFromEvents } from "../analyze/tracks.ts";
import type { Normalized } from "../types.ts";
import type { RubricContext } from "./context.ts";
import { oak2PitchRules } from "./oak2-pitch.ts";
import { CUSTOM_DEPS } from "./rules.ts";

setDefaultTimeout(30_000);
const rules = oak2PitchRules(CUSTOM_DEPS);
const C: KeySpec = { tonic: "C", mode: "major" };
const piece = (lines: string) => `setcpm(96/4)\n\n${lines}`;
const pair = (source: string, copy: string) => piece(`mel: ${source}.s("piano")\nmel2: ${copy}.s("sine")`);
const pairParams = { source: "mel", copy: "mel2" };
const minorShapes = piece('chords: note("<c3 f3 g3 bb2>").add(note("[0,3,7,10]")).s("piano")');
const majorShapes = piece('chords: note("[c3,e3,g3]").transpose("<0 3 5 -2>").s("piano")');

async function run(
  name: string,
  code: string,
  params: Record<string, unknown> = {},
  context: Partial<RubricContext> = {},
  transform?: (n: Normalized) => Normalized,
) {
  const ctx: RubricContext = { meter: "4/4", code, params: {}, bars: 4, totalBars: 4, ...context };
  const n = await strudel(code, ctx.bars);
  const rule = rules[name];
  if (!rule) throw new Error(`Missing rule ${name}`);
  const result = rule(transform ? transform(n) : n, ctx, params);
  if (!result.ok) {
    // AC9 applies to every failure exercised by this file, including the edge pins.
    expect(result.detail).not.toMatch(/semitone|[.!?].*\S|\n/i);
    expect(result.detail.length).toBeGreaterThan(0);
    expect(result.where?.track).toBeTruthy();
    expect(result.where?.bar).toBeDefined();
  }
  return result;
}

async function check(
  name: string,
  code: string,
  ok: boolean,
  params: Record<string, unknown> = {},
  context: Partial<RubricContext> = {},
) {
  const result = await run(name, code, params, context);
  expect({ ok: result.ok, detail: result.ok === ok ? "" : result.detail }).toEqual({ ok, detail: "" });
  return result;
}

describe("same-shape", () => {
  test("AC1 minor seventh additions and major triad transpositions", async () => {
    for (const code of [minorShapes, majorShapes]) {
      const r = await check("same-shape", code, true);
      expect(r).toMatchObject({ value: 4, target: 2 });
    }
  });
  test("AC2 scale steps change shapes and one repeated chord needs movement", async () => {
    const changing = await check(
      "same-shape",
      piece('chords: n("[0,2,4]").add(n("<0 1 5 3>")).scale("C:major").s("piano")'),
      false,
    );
    expect(changing.detail).toMatch(/shapes change/);
    const still = await check("same-shape", piece('chords: note("[c3,e3,g3]").s("piano")'), false);
    expect(still.detail).toMatch(/move/i);
  });
  test("AC2 I-IV-V keeps one shape even when written with scale steps", async () => {
    await check(
      "same-shape",
      piece('chords: n("[0,2,4]").add(n("<0 3 4>")).scale("C:major").s("piano")'),
      true,
    );
  });
  test("AC2 automatic voicing asks to move the shape yourself", async () => {
    const r = await check(
      "same-shape",
      piece('chords: chord("<Cm7 Fm7 Gm7 Bbm7>").voicing().s("piano")'),
      false,
    );
    expect(r.detail).toMatch(/move the shape yourself/i);
  });
  test("voicing on another part and in a comment does not block hand movement", async () => {
    await check("same-shape", `${majorShapes}\n// .voicing()\nmel: chord("C").voicing().s("piano")`, true);
  });
  test("voicing in a referenced constant is still automatic", async () => {
    await check(
      "same-shape",
      piece('const changes = chord("<C Eb F Bb>").voicing()\n\nchords: changes.s("piano")'),
      false,
    );
  });
  test("held notes form chords and short clips do not", async () => {
    await check(
      "same-shape",
      piece('chords: note("[c3 e3 g3]").legato(3).transpose("<0 3>").s("piano")'),
      false,
    );
    await check("same-shape", piece('chords: note("c3 e3 g3").clip(.1).s("piano")'), false);
  });
});

describe("bass-names-chord", () => {
  const a = piece('bass: note("a1").s("sawtooth")\nchords: note("[e3,a3,d4,g4,c5]").s("piano")');
  const d = piece('bass: note("d2").s("sawtooth")\nchords: note("[a3,d4,g4,c5,f5]").s("piano")');
  test("AC3 fourth stacks name Am11 and Dm11 with their bass", async () => {
    for (const [code, name] of [
      [a, "Am11"],
      [d, "Dm11"],
    ] as const) {
      const n = await strudel(code, 1);
      const named = identifyChord(n.all.map((e) => e.midi as number))[0];
      expect(named?.quality).toBe("m11");
      expect(named && toLeadSheet(named)).toBe(name);
      await check("bass-names-chord", code, true, { quality: "m11" });
    }
  });
  test("AC3 another bass names another chord", async () => {
    for (const code of [a.replace('"a1"', '"c2"'), d.replace('"d2"', '"f2"')]) {
      await check("bass-names-chord", code, false, { quality: "m11" });
    }
  });
  test("counts bass changes under a held chord and pins the 75 percent boundary", async () => {
    const code = piece(
      'bass: note("a1 a1 a1 c2").s("sawtooth")\nchords: note("[e3,a3,d4,g4,c5]").s("piano")',
    );
    expect(await check("bass-names-chord", code, true, { quality: "m11" })).toMatchObject({
      value: 0.75,
      target: 0.75,
    });
    expect(
      await check("bass-names-chord", code.replace("a1 a1 a1 c2", "a1 a1 c2 c2"), false, { quality: "m11" }),
    ).toMatchObject({ value: 0.5, target: 0.75 });
  });
});

describe("inverted-copy", () => {
  test("AC4 mirrors C major degrees and chromatic pitches", async () => {
    await check(
      "inverted-copy",
      pair('n("0 1 4 2").scale("C4:major")', 'n("4 3 0 2").scale("C4:major")'),
      true,
      pairParams,
      { key: C },
    );
    await check("inverted-copy", pair('note("60 61 67 64")', 'note("67 66 60 63")'), true, pairParams);
  });
  test("AC4 rejects transposition and reversal", async () => {
    for (const copy of ['note("65 66 72 69")', 'note("64 67 61 60")']) {
      await check("inverted-copy", pair('note("60 61 67 64")', copy), false, pairParams);
    }
  });
  test("a narrow chromatic inversion passes but tolerance cannot admit a transposition", async () => {
    await check("inverted-copy", pair('note("60 61 60 61")', 'note("61 60 61 60")'), true, pairParams);
    for (const copy of ['note("62 63 62 63")', 'note("60 61 60 61")']) {
      await check("inverted-copy", pair('note("60 61 60 61")', copy), false, pairParams);
    }
  });
  test("degree sums keep octave information across B major", async () => {
    await check(
      "inverted-copy",
      pair('n("-1 0 4 8").scale("B4:major")', 'n("8 7 3 -1").scale("B4:major")'),
      true,
      pairParams,
      { key: { tonic: "B", mode: "major" } },
    );
    await check(
      "inverted-copy",
      pair('n("0 1 4 2").scale("C4:major")', 'n("4 3 7 2").scale("C4:major")'),
      false,
      pairParams,
      { key: C },
    );
  });
  test("pins the 85 percent threshold without treating off-scale notes as scale degrees", async () => {
    const source = 'n("0 1 2 4 2 1 0 4 1 2 0 4 2 1 4 0 2 1 0 4").scale("C4:major")';
    const good = "4 3 2 0 2 3 4 0 3 2 4 0 2 3 0 4 2 0 0 1";
    expect(
      await check("inverted-copy", pair(source, `n("${good}").scale("C4:major")`), true, pairParams, {
        key: C,
      }),
    ).toMatchObject({ value: 0.85, target: 0.85 });
    await check(
      "inverted-copy",
      pair(source, `n("${good.replace("0 4 2 0 0 1", "0 4 1 0 0 1")}").scale("C4:major")`),
      false,
      pairParams,
      { key: C },
    );
    await check("inverted-copy", pair('note("60 62 67 64")', 'note("67 65 60 63")'), false, pairParams, {
      key: C,
    });
  });
});

describe("rotated-copy", () => {
  test("AC5 rotations by one and three positions", async () => {
    for (const copy of ['note("e4 g4 d4 c4")', 'note("d4 c4 e4 g4")']) {
      await check("rotated-copy", pair('note("c4 e4 g4 d4")', copy), true, pairParams);
    }
  });
  test("AC5 identical pitches and a non-rotation shuffle fail", async () => {
    for (const copy of ['note("c4 e4 g4 d4")', 'note("c4 g4 e4 d4")']) {
      await check("rotated-copy", pair('note("c4 e4 g4 d4")', copy), false, pairParams);
    }
  });
  test("rotation keeps an uneven rhythm and one rotation across repeated loops", async () => {
    await check("rotated-copy", pair('note("c4 [e4 g4] d4")', 'note("e4 [g4 d4] c4")'), true, pairParams);
    await check(
      "rotated-copy",
      pair('note("c4 e4 g4 d4")', 'note("<[e4 g4 d4 c4] [d4 c4 e4 g4]>")'),
      false,
      pairParams,
    );
  });
});

describe("time-shifted", () => {
  test("AC6 early by an eighth and late by a quarter", async () => {
    for (const shift of ["early(1/8)", "late(1/4)"]) {
      const r = await check(
        "time-shifted",
        pair('note("c4 e4 g4 d4")', `note("c4 e4 g4 d4").${shift}`),
        true,
        pairParams,
      );
      expect(r.target).toBe(1 / 16);
    }
  });
  test("AC6 zero offset and different offsets in each half fail", async () => {
    for (const copy of ['note("c4 e4 g4 d4")', 'note("c4 e4 g4 d4").late("0.125 0.25")']) {
      await check("time-shifted", pair('note("c4 e4 g4 d4")', copy), false, pairParams);
    }
  });
  test("shift keeps note lengths and checks the smallest signed distance", async () => {
    await check(
      "time-shifted",
      pair('note("c4 e4 g4 d4")', 'note("c4 e4 g4 d4").early(1/128)'),
      false,
      pairParams,
    );
    await check(
      "time-shifted",
      pair('note("c4 e4 g4 d4")', 'note("c4 e4 g4 d4").late(1/4).clip(.1)'),
      false,
      pairParams,
    );
    await check(
      "time-shifted",
      pair('note("<[c4 e4] [g4 d4]>")', 'note("<[c4 e4] [g4 d4]>").early(1/8)'),
      true,
      pairParams,
    );
  });
});

describe("gap-fill", () => {
  test("AC7 a sixth up steps down and an arpeggio run is exempt", async () => {
    await check("gap-fill", piece('mel: note("c4 a4 g4 f4").s("piano")'), true, { track: "mel" });
    const r = await check("gap-fill", piece('mel: note("c4 e4 g4 c5 b4 d4 e4").s("piano")'), true, {
      track: "mel",
    });
    expect(r).toMatchObject({ value: 1, target: 0.6 });
  });
  test("AC7 continuing leaps fail and stepwise melody has no leap yet", async () => {
    await check("gap-fill", piece('mel: note("c3 f#3 c#4 g4 d5").s("piano")'), false, { track: "mel" });
    const r = await check("gap-fill", piece('mel: note("c4 d4 e4 f4").s("piano")'), false, { track: "mel" });
    expect(r.detail).toContain("no leap yet");
  });
  test("a terminal leap has no answer and an all-arpeggio line has no eligible leap", async () => {
    await check("gap-fill", piece('mel: note("c4 d4 e4 c5").s("piano")'), false, { track: "mel" });
    await check("gap-fill", piece('mel: note("c4 e4 g4 c5").s("piano")'), false, { track: "mel" });
  });
});

const cases = [
  { name: "same-shape", code: majorShapes, params: { track: "chords" }, track: "chords" },
  {
    name: "bass-names-chord",
    code: piece('bass: note("a1").s("sawtooth")\nchords: note("[e3,a3,d4,g4,c5]").s("piano")'),
    params: { chords: "chords", bass: "bass", quality: "m11" },
    track: "bass",
  },
  {
    name: "inverted-copy",
    code: pair('note("60 61 67 64")', 'note("67 66 60 63")'),
    params: pairParams,
    track: "mel2",
  },
  {
    name: "rotated-copy",
    code: pair('note("c4 e4 g4 d4")', 'note("e4 g4 d4 c4")'),
    params: pairParams,
    track: "mel2",
  },
  {
    name: "time-shifted",
    code: pair('note("c4 e4 g4 d4")', 'note("c4 e4 g4 d4").late(1/4)'),
    params: pairParams,
    track: "mel2",
  },
  {
    name: "gap-fill",
    code: piece('mel: note("c4 a4 g4 f4").s("piano")'),
    params: { track: "mel" },
    track: "mel",
  },
];

describe("AC8 edge pins and AC9 plain failure details", () => {
  for (const c of cases) {
    test(`${c.name}: missing, muted and silent parts name the missing part`, async () => {
      for (const code of [
        c.code.replace(new RegExp(`^${c.track}:.*$`, "m"), ""),
        c.code.replace(`${c.track}:`, `_${c.track}:`),
        c.code.replace(new RegExp(`^(${c.track}:.*)$`, "m"), "$1.gain(0)"),
      ]) {
        const r = await check(c.name, code, false, c.params);
        expect(r.detail).toContain(c.track);
      }
    });
    test(`${c.name}: Band cannot supply a missing part or spoil a passing part`, async () => {
      // Like wave4.test.ts, normalize band-labelled events; their IDs include their own track.
      const band = (n: Normalized) =>
        normalizedFromEvents(
          n.all.map((e) =>
            e.track === c.track ? { ...e, id: `band.${e.id}`, track: `band.${e.track}` } : e,
          ),
        );
      expect((await run(c.name, c.code, c.params, {}, band)).ok).toBe(false);
      expect(
        (
          await run(c.name, c.code, c.params, {}, (n) =>
            normalizedFromEvents([
              ...n.all,
              ...n.all.map((e) => ({
                ...e,
                id: `band.${e.id}`,
                track: `band.${e.track}`,
                midi: e.midi === null ? null : e.midi + 1,
              })),
            ]),
          )
        ).ok,
      ).toBe(true);
    });
    test(`${c.name}: three-four keeps cycles as bars`, async () => {
      await check(c.name, c.code.replace("96/4", "96/3"), true, c.params, { meter: "3/4" });
    });
  }
  test("same-shape locates a changed chord in three-four with a pickup", async () => {
    const r = await check(
      "same-shape",
      piece('chords: note("<[c3,e3,g3] [[c3,e3,g3] [d3,f3,a3] ~]>").s("piano")').replace("96/4", "96/3"),
      false,
      {},
      { meter: "3/4", pickup: { units: [1, 1] } },
    );
    expect(r.where).toMatchObject({ bar: 1, beat: 2, track: "chords" });
  });
  test("inverted-copy locates the wrong note on beat three in three-four", async () => {
    const r = await check(
      "inverted-copy",
      pair('note("c4 d4 g4")', 'note("g4 f4 d4")').replace("96/4", "96/3"),
      false,
      pairParams,
      { meter: "3/4", key: C },
    );
    expect(r.where).toMatchObject({ bar: 1, beat: 3, track: "mel2" });
  });
  test("gap-fill locates the continued leap on beat two in three-four", async () => {
    const r = await check(
      "gap-fill",
      piece('mel: note("c3 f#3 c#4").s("piano")').replace("96/4", "96/3"),
      false,
      { track: "mel" },
      { meter: "3/4" },
    );
    expect(r.where).toMatchObject({ bar: 1, beat: 2, track: "mel" });
  });
});
