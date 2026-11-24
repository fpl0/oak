import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { NEvent } from "@oak/content-kit";
import { R, rat } from "@oak/content-kit";
import { strudel } from "../analyze/__support__/fixtures.ts";
import { normalizedFromEvents } from "../analyze/tracks.ts";
import type { Normalized } from "../types.ts";
import type { RubricContext } from "./context.ts";
import type { CorrectionEval } from "./corrections-rules.ts";
import { oak2RhythmRules } from "./oak2-rhythm.ts";
import { CUSTOM_DEPS } from "./rules.ts";

setDefaultTimeout(30_000);
const rules = oak2RhythmRules(CUSTOM_DEPS);
const codeOf = (body: string, meter = "4/4") => `setcpm(120/${meter === "3/4" ? 3 : 4})\n\n${body}`;
type Options = Partial<Pick<RubricContext, "meter" | "pickup">> & {
  bars?: number;
  transform?: (n: Normalized) => Normalized | Promise<Normalized>;
};
async function run(name: string, body: string, params: Record<string, unknown> = {}, opts: Options = {}) {
  const bars = opts.bars ?? 4;
  const code = codeOf(body, opts.meter);
  let n = await strudel(code, bars);
  if (opts.transform) n = await opts.transform(n);
  const ctx: RubricContext = {
    code,
    meter: opts.meter ?? "4/4",
    params: {},
    bars,
    totalBars: bars,
    ...(opts.pickup ? { pickup: opts.pickup } : {}),
  };
  const r = rules[name]?.(n, ctx, params);
  if (!r) throw new Error(`Missing rule ${name}`);
  checkDetail(r);
  return r;
}
// AC8 applies to every negative result, including static scans and edge pins.
function checkDetail(r: CorrectionEval) {
  if (r.ok) return;
  expect(r.detail).not.toMatch(/semitone|[\r\n]|[.!?]\s+[A-Z]/i);
  expect(r.detail.length).toBeGreaterThan(10);
}
function check(r: CorrectionEval, ok: boolean, detail?: RegExp) {
  if (r.ok !== ok) throw new Error(`Expected ${ok ? "pass" : "failure"}: ${r.detail}`);
  if (detail) expect(r.detail).toMatch(detail);
}
const kick = 'drums: s("bd*4")';
const offBass = 'bass: note("~ c2 ~ c2 ~ c2 ~ c2").s("sawtooth").clip(.4)';
const pitches = [60, 62, 64, 65, 67, 69, 71, 72];
const hocketParams = { tracks: ["mel", "chords"], pitches, steps: 8 };
const split = 'mel: note("c4 ~ e4 ~ g4 ~ b4 ~").s("sine")\nchords: note("~ d4 ~ f4 ~ a4 ~ c5").s("triangle")';
const linear = 'drums: s("bd hh sd hh hh bd hh sd bd sd hh bd hh hh sd hh")';
const grouped = 'drums: s("bd hh hh sd hh hh bd hh")';
const lead = 'mel: note("<c4 d4 e4 f4 g4 a4 b4 c5>").s("sine")';
const pad = 'chords: note("[c3,e3,g3]").s("triangle")';
const hats = 'hats: s("<hh*4!7 hh*8>").gain(.4)';
const depth = { front: "mel", back: ["chords", "hats"] };

describe("AC1 kick-bass-composite", () => {
  test("passes off-beat and busier threaded bass lines", async () => {
    check(await run("kick-bass-composite", `${kick}\n${offBass}`), true);
    check(
      await run("kick-bass-composite", `${kick}\nbass: note("[~ c2 g2 ~]*4").s("sawtooth").clip(.4)`),
      true,
    );
  });
  test("rejects locking on kicks, ringing through kicks, token bass and stacked bass", async () => {
    for (const [notes, clip, why] of [
      ['"c2*4"', ".4", /take turns/],
      ['"~ c2 ~ ~ ~ ~ ~ ~"', "2", /Shorten/],
      ['"<[~ c2 ~ ~ ~ ~ ~ ~] ~ ~ ~>"', ".4", /more/],
      ['"~ [c2,g2] ~ ~ ~ ~ ~ ~"', ".4", /another bass/],
    ] as const)
      check(
        await run("kick-bass-composite", `${kick}\nbass: note(${notes}).s("sawtooth").clip(${clip})`),
        false,
        why,
      );
  });
  test("checks near collisions, overlapping tails, and exact note endings", async () => {
    check(
      await run("kick-bass-composite", `${kick}\nbass: note("c2*4").s("sawtooth").late(1/32).clip(.1)`),
      false,
    );
    check(
      await run("kick-bass-composite", `${kick}\nbass: note("[~ c2 g2 ~]*4").s("sawtooth").clip(1.5)`),
      false,
      /another bass/,
    );
    check(await run("kick-bass-composite", `${kick}\n${offBass.replace(".4", "1")}`), true);
    check(await run("kick-bass-composite", `${kick}\n${offBass}`, { minBassPerBar: 5 }), false);
  });
});

describe("AC2 hocket", () => {
  test("alternating starts must not hide overlapping held notes", async () => {
    check(await run("hocket", `${split}.legato(2)`, hocketParams), false, /Shorten/);
    check(await run("hocket", `${split}.clip(.5)`, hocketParams), true);
  });
  test("passes note-by-note and groups-of-three splits", async () => {
    check(await run("hocket", split, hocketParams), true);
    check(
      await run(
        "hocket",
        'mel: note("c4 d4 e4 ~ ~ ~ b4 c5").s("sine")\nchords: note("~ ~ ~ f4 g4 a4 ~ ~").s("triangle")',
        hocketParams,
      ),
      true,
    );
  });
  test("rejects one part owning the line, doubled beat one, same sound and broken phrase alternation", async () => {
    check(
      await run(
        "hocket",
        'mel: note("c4 d4 e4 f4 g4 a4 b4 c5").s("sine")\nchords: note("~").s("triangle")',
        hocketParams,
      ),
      false,
      /chords/,
    );
    check(await run("hocket", split.replace('"~ d4', '"c4 d4'), hocketParams), false, /once/);
    check(
      await run("hocket", split.replace('s("triangle")', 's("sine")'), hocketParams),
      false,
      /different sounds/,
    );
    check(
      await run(
        "hocket",
        'mel: note("<[c4 d4 e4 f4 g4 a4 b4 c5]!2 ~!2>").s("sine")\nchords: note("<~!2 [c4 d4 e4 f4 g4 a4 b4 ~]!2>").s("triangle")',
        hocketParams,
      ),
      false,
      /every note/,
    );
  });
  test("checks rests, exact grid, pitch, share and sixteenth steps", async () => {
    check(
      await run("hocket", split.replace("b4", "~"), {
        ...hocketParams,
        pitches: [60, 62, 64, 65, 67, 69, -1, 72],
      }),
      true,
    );
    check(await run("hocket", split.replace("e4", "f4"), hocketParams), false);
    check(await run("hocket", `${split}.late(1/64)`, hocketParams), false, /place/);
    check(
      await run(
        "hocket",
        'mel: note("c4 d4 e4 f4 g4 a4 b4 ~").s("sine")\nchords: note("~ ~ ~ ~ ~ ~ ~ c5").s("triangle")',
        hocketParams,
      ),
      false,
      /share/,
    );
    check(
      await run(
        "hocket",
        split
          .replace("c4 ~ e4 ~ g4 ~ b4 ~", "c4 ~ e4 ~ g4 ~ b4 ~ c4 ~ e4 ~ g4 ~ b4 ~")
          .replace("~ d4 ~ f4 ~ a4 ~ c5", "~ d4 ~ f4 ~ a4 ~ c5 ~ d4 ~ f4 ~ a4 ~ c5"),
        { ...hocketParams, pitches: [...pitches, ...pitches], steps: 16 },
      ),
      true,
    );
  });
});

describe("AC3 stepped-control", () => {
  const p = { track: "mel", control: "lpf" };
  const notes = 'mel: note("c4*8").s("sawtooth").clip(.3)';
  test("passes held values across bars and within a bar", async () => {
    check(await run("stepped-control", `${notes}.lpf("<400 400 2000 2000 800 800>")`, p, { bars: 6 }), true);
    check(await run("stepped-control", `${notes}.cutoff("400 2000 800 400")`, p), true);
  });
  test("rejects a sine sweep, constant value, small jumps and single-note holds", async () => {
    check(await run("stepped-control", `${notes}.lpf(sine.range(300, 3000))`, p), false, /Hold/);
    check(await run("stepped-control", `${notes}.lpf(800)`, p), false, /different/);
    check(await run("stepped-control", `${notes}.lpf("400 500 2000 400")`, p), false, /clearer jumps/);
    check(
      await run("stepped-control", `${notes}.lpf("400 2000 800 400 2000 800 400 2000")`, p),
      false,
      /Hold/,
    );
  });
  test("a chord cannot count as a held run and gain is read from effective gain", async () => {
    check(
      await run(
        "stepped-control",
        'mel: note("<[c4,e4,g4] [d4,f4,a4] [e4,g4,b4]>").s("sawtooth").lpf("<400 2000 800>")',
        p,
        { bars: 3 },
      ),
      false,
      /Hold/,
    );
    check(
      await run("stepped-control", `${notes}.gain(".2 .8 .5 .2")`, { track: "mel", control: "gain" }),
      true,
    );
  });
});

describe("AC4 no-chance", () => {
  test("passes frozen notes and checks only the requested part", async () => {
    check(await run("no-chance", 'mel: note("c4 d4 e4 f4").s("sine")'), true);
    check(
      await run(
        "no-chance",
        'mel: note("c4 d4 e4 f4").s("sine")\nbass: note("c2*8").s("sawtooth").degradeBy(.3)',
        { track: "mel" },
      ),
      true,
    );
  });
  test("names mini chance, degradeBy and sometimes", async () => {
    for (const [body, detail] of [
      ['mel: note("c4 d4? e4 f4").s("sine")', /\?/],
      ['mel: note("c4*8").s("sine").degradeBy(.3)', /degradeBy/],
      ['mel: note("c4*8").sometimes(x => x.add(12)).s("sine")', /sometimes/],
    ] as const)
      check(await run("no-chance", body), false, detail);
  });
  test("finds const dependencies and ignores comments and a JavaScript conditional", async () => {
    check(
      await run("no-chance", 'const notes = "c4 d4? e4 f4"\nmel: note(notes).s("sine")', { track: "mel" }),
      false,
      /\?/,
    );
    check(
      await run("no-chance", '// rand sometimes degradeBy ?\nmel: note(true ? "c4" : "d4").s("sine")'),
      true,
    );
  });
  test("the static scan names every forbidden tool without depending on a random outcome", async () => {
    const n = await strudel(codeOf('mel: note("c4").s("sine")'), 1);
    for (const tool of [
      "degrade",
      "degradeBy",
      "undegradeBy",
      "sometimes",
      "sometimesBy",
      "often",
      "rarely",
      "almostNever",
      "almostAlways",
      "someCycles",
      "someCyclesBy",
      "rand",
      "irand",
      "perlin",
      "choose",
      "chooseCycles",
      "wchoose",
      "shuffle",
      "scramble",
    ]) {
      const code = codeOf(`mel: note("c4").s("sine").add(${tool})`);
      const r = rules["no-chance"]?.(n, { code, meter: "4/4", params: {}, bars: 1 }, { track: "mel" });
      if (!r) throw new Error("Missing no-chance rule");
      expect(r.ok).toBe(false);
      expect(r.detail).toContain(tool);
      checkDetail(r);
    }
  });
});

describe("AC5 depth-layers", () => {
  test("passes a busier background bar and a louder background bar", async () => {
    check(await run("depth-layers", `${lead}\n${pad}\n${hats}`, depth, { bars: 8 }), true);
    check(
      await run("depth-layers", `${lead}\n${pad}\nhats: s("hh*4").gain("<.4!7 .8>")`, depth, { bars: 8 }),
      true,
    );
  });
  test("rejects every part changing, no step forward and a repeating lead", async () => {
    check(
      await run(
        "depth-layers",
        `${lead}\nchords: note("<c3 d3 e3 f3 g3 a3 b3 c4>").s("triangle")\n${hats}`,
        depth,
        { bars: 8 },
      ),
      false,
      /mostly repeating/,
    );
    check(
      await run("depth-layers", `${lead}\n${pad}\nhats: s("hh*4").gain(.4)`, depth, { bars: 8 }),
      false,
      /occasional bar/,
    );
    check(
      await run("depth-layers", `mel: note("c4").s("sine")\n${pad}\n${hats}`, depth, { bars: 8 }),
      false,
      /Vary mel/,
    );
  });
  test("rejects frequent steps forward and gains below three decibels", async () => {
    check(
      await run("depth-layers", `${lead}\n${pad}\nhats: s("hh*4").gain("<.4!6 .8!2>")`, depth, { bars: 8 }),
      false,
    );
    check(
      await run("depth-layers", `${lead}\n${pad}\nhats: s("hh*4").gain("<.4!7 .5>")`, depth, { bars: 8 }),
      false,
    );
    check(
      await run("depth-layers", `${lead}\n${pad}\nhats: s("hh*4").gain("<.4!7 .8 .8 .4!7>")`, depth, {
        bars: 16,
      }),
      false,
    );
  });
});

describe("AC6 linear-drums", () => {
  test("passes a sixteenth figure and a three-three-two role grouping", async () => {
    check(await run("linear-drums", linear), true);
    check(await run("linear-drums", grouped, { group: [3, 3, 2] }), true);
  });
  test("rejects a hat timekeeper without overlaps and doubled beat one", async () => {
    check(
      await run("linear-drums", 'drums: s("hh bd hh ~ hh sd hh ~ hh bd hh ~ hh sd hh ~")'),
      false,
      /evenly spaced/,
    );
    check(await run("linear-drums", linear.replace('"bd hh', '"[bd,hh] hh')), false, /first beat/);
  });
  test("accepts accents instead of role changes on a sixteenth grid", async () => {
    check(
      await run(
        "linear-drums",
        'drums: s("hh bd sd bd hh hh hh sd bd hh bd bd bd sd hh sd").gain("1 .4 .4 .4 .4 .4 1 .4 .4 .4 .4 .4 1 .4 .4 .4")',
        { group: [3, 3, 2] },
      ),
      true,
    );
  });
  test("rejects missed group starts, a missing downbeat marker and sparse token hits", async () => {
    check(
      await run("linear-drums", 'drums: s("bd hh hh hh sd sd bd sd")', { group: [3, 3, 2] }),
      false,
      /group start/,
    );
    check(
      await run("linear-drums", 'drums: s("bd hh hh sd hh hh bd bd")', { group: [3, 3, 2] }),
      false,
      /group start/,
    );
    check(await run("linear-drums", 'drums: s("bd ~ ~ ~")'), false, /more drum/);
  });
});

describe("AC7 and AC8 edges and beginner feedback", () => {
  const cases = [
    ["kick-bass-composite", `${kick}\n${offBass}`, {}, "bass"],
    ["hocket", split, hocketParams, "chords"],
    [
      "stepped-control",
      'mel: note("c4*8").s("sawtooth").lpf("400 2000 800 400")',
      { track: "mel", control: "lpf" },
      "mel",
    ],
    ["no-chance", 'mel: note("c4").s("sine")', { track: "mel" }, "mel"],
    ["depth-layers", `${lead}\n${pad}\n${hats}`, depth, "hats"],
    ["linear-drums", linear, {}, "drums"],
  ] as const;
  test("every rule rejects a missing, muted or zero-gain part by name", async () => {
    for (const [name, body, params, track] of cases) {
      const lines = body.split("\n");
      for (const variant of [
        lines.filter((line) => !line.startsWith(`${track}:`)).join("\n"),
        body.replace(`${track}:`, `_${track}:`),
        lines.map((line) => (line.startsWith(`${track}:`) ? `${line}.gain(0)` : line)).join("\n"),
      ]) {
        // Retain a harmless learner part when testing the last remaining labelled line.
        check(
          await run(name, `${variant}\nspare: note("c6").s("sine")`, params, { bars: 8 }),
          false,
          new RegExp(track),
        );
      }
    }
    check(await run("kick-bass-composite", offBass), false, /kick/);
  });
  test("Band events cannot spoil a pass or rescue a missing learner part", async () => {
    for (const [name, body, params, track] of cases) {
      const transform = async (n: Normalized) => {
        const band = await strudel(codeOf(`${kick}\n${offBass}\n${split}`), 8);
        const extra: NEvent[] = band.all.map((e) => ({ ...e, id: `band:${e.id}`, track: `band.${e.track}` }));
        return normalizedFromEvents([...n.all, ...extra]);
      };
      check(await run(name, body, params, { bars: 8, transform }), true);
      check(
        await run(name, body, params, {
          bars: 8,
          transform: (n) =>
            normalizedFromEvents(
              n.all.map((e) => (e.track === track ? { ...e, track: `band.${track}` } : e)),
            ),
        }),
        false,
        new RegExp(track),
      );
    }
    check(await run("hocket", split, { ...hocketParams, tracks: ["band.mel", "chords"] }), false, /band.mel/);
  });
  test("three-quarter bars keep their own beats and a full cycle of material", async () => {
    check(
      await run(
        "kick-bass-composite",
        'drums: s("bd*3")\nbass: note("~ c2 ~ c2 ~ c2").s("sawtooth").clip(.4)',
        { minBassPerBar: 3 },
        { meter: "3/4" },
      ),
      true,
    );
    check(await run("hocket", split, hocketParams, { meter: "3/4" }), true);
    const wrong = await run("hocket", split.replace("g4", "a4"), hocketParams, { meter: "3/4" });
    check(wrong, false);
    expect(wrong.where?.beat).toBe(2.5);
    check(
      await run("linear-drums", 'drums: s("bd hh hh sd hh hh")', { group: [3, 3] }, { meter: "3/4" }),
      true,
    );
    check(await run("linear-drums", grouped, { group: [3, 3, 2] }, { meter: "3/4" }), false, /meter/);
    for (const [name, body, params] of cases.slice(2, 5))
      check(await run(name, body, params, { meter: "3/4", bars: 8 }), true);
  });
  test("pickup bars do not dilute counts or become missing full bars", async () => {
    const shift = (n: Normalized) =>
      normalizedFromEvents(
        n.all.filter((e) => R.floor(e.onset) < 4).map((e) => ({ ...e, onset: R.add(e.onset, rat(1)) })),
      );
    const opts: Options = { bars: 5, meter: "3/4", pickup: { units: [1, 1] }, transform: shift };
    check(await run("kick-bass-composite", `${kick}\n${offBass}`, { minBassPerBar: 4 }, opts), true);
    check(await run("hocket", split, hocketParams, opts), true);
    check(await run("linear-drums", linear, { minHitsPerBar: 16 }, opts), true);
  });
});

interface RealCase {
  name: string;
  rule: string;
  body: string;
  ok: boolean;
  params?: Record<string, unknown>;
  bars?: number;
  meter?: RubricContext["meter"];
  detail?: RegExp;
  inspect?: (n: Normalized) => void;
}

// Keep each acceptance case separately discoverable, with no event rewriting between Strudel and the rule.
const realCases: RealCase[] = [
  {
    name: "AC1 off-beat bass passes",
    rule: "kick-bass-composite",
    body: `${kick}\n${offBass}`,
    ok: true,
    inspect: (n) => {
      expect(n.byTrack.drums?.every((e) => e.drum === "kick")).toBe(true);
      expect(n.byTrack.bass?.[0]).toMatchObject({ onset: [1, 8], dur: [1, 8], clipDur: [1, 20] });
    },
  },
  {
    name: "AC1 busier threaded bass passes",
    rule: "kick-bass-composite",
    body: `${kick}\nbass: note("[~ c2 g2 ~]*4").s("sawtooth").clip(.4)`,
    ok: true,
    inspect: (n) => expect(n.byTrack.bass).toHaveLength(32),
  },
  {
    name: "AC1 bass on every kick fails",
    rule: "kick-bass-composite",
    body: `${kick}\nbass: note("c2*4").s("sawtooth").clip(.4)`,
    ok: false,
    detail: /take turns/,
  },
  {
    name: "AC1 long bass through a kick fails",
    rule: "kick-bass-composite",
    body: `${kick}\nbass: note("~ c2 ~ ~ ~ ~ ~ ~").s("sawtooth").legato(2)`,
    ok: false,
    detail: /Shorten/,
    inspect: (n) => {
      expect(n.byTrack.bass?.[0]).toMatchObject({ onset: [1, 8], dur: [1, 8], clipDur: [1, 4] });
    },
  },
  {
    name: "AC1 one bass note in four bars fails",
    rule: "kick-bass-composite",
    body: `${kick}\nbass: note("<[~ c2 ~ ~ ~ ~ ~ ~] ~ ~ ~>").s("sawtooth").clip(.4)`,
    ok: false,
    detail: /more/,
    inspect: (n) => expect(n.byTrack.bass).toHaveLength(1),
  },
  {
    name: "AC1 stacked bass notes fail",
    rule: "kick-bass-composite",
    body: `${kick}\nbass: note("~ [c2,g2] ~ ~ ~ ~ ~ ~").s("sawtooth").clip(.4)`,
    ok: false,
    detail: /another bass/,
    inspect: (n) => {
      expect(n.byTrack.bass?.slice(0, 2).map((e) => [e.onset, e.midi])).toEqual([
        [[1, 8], 36],
        [[1, 8], 43],
      ]);
    },
  },
  {
    name: "AC2 note-by-note hocket passes",
    rule: "hocket",
    body: split,
    params: hocketParams,
    ok: true,
  },
  {
    name: "AC2 groups-of-three hocket passes",
    rule: "hocket",
    body: 'mel: note("c4 d4 e4 ~ ~ ~ b4 c5").s("sine")\nchords: note("~ ~ ~ f4 g4 a4 ~ ~").s("triangle")',
    params: hocketParams,
    ok: true,
  },
  {
    name: "AC2 one track plays everything fails",
    rule: "hocket",
    body: 'mel: note("c4 d4 e4 f4 g4 a4 b4 c5").s("sine")\nchords: note("~").s("triangle")',
    params: hocketParams,
    ok: false,
    detail: /chords/,
  },
  {
    name: "AC2 both tracks on beat one fails",
    rule: "hocket",
    body: 'mel: note("c4 ~ e4 ~ g4 ~ b4 ~").s("sine")\nchords: note("c4 d4 ~ f4 ~ a4 ~ c5").s("triangle")',
    params: hocketParams,
    ok: false,
    detail: /once/,
  },
  {
    name: "AC2 same sound fails",
    rule: "hocket",
    body: 'mel: note("c4 ~ e4 ~ g4 ~ b4 ~").s("sine")\nchords: note("~ d4 ~ f4 ~ a4 ~ c5").s("sine")',
    params: hocketParams,
    ok: false,
    detail: /different sounds/,
  },
  {
    name: "AC2 alternating two-bar phrases with a missing note fails",
    rule: "hocket",
    body: 'mel: note("<[c4 d4 e4 f4 g4 a4 b4 c5]!2 ~!2>").s("sine")\nchords: note("<~!2 [c4 d4 e4 f4 g4 a4 b4 ~]!2>").s("triangle")',
    params: hocketParams,
    ok: false,
    detail: /every note/,
  },
  {
    name: "AC3 held filter values pass",
    rule: "stepped-control",
    body: 'mel: note("c4*8").s("sawtooth").clip(.3).lpf("<400 400 2000 2000 800 800>")',
    params: { track: "mel", control: "lpf" },
    bars: 6,
    ok: true,
    inspect: (n) => {
      expect(n.byTrack.mel?.map((e) => e.controls?.cutoff)).toEqual(
        [400, 400, 2000, 2000, 800, 800].flatMap((v) => Array(8).fill(v)),
      );
    },
  },
  {
    name: "AC3 sine filter sweep fails",
    rule: "stepped-control",
    body: 'mel: note("c4*8").s("sawtooth").clip(.3).lpf(sine.range(300, 3000))',
    params: { track: "mel", control: "lpf" },
    ok: false,
    detail: /Hold/,
    inspect: (n) => {
      expect(new Set(n.byTrack.mel?.map((e) => e.controls?.cutoff)).size).toBeGreaterThan(3);
    },
  },
  {
    name: "AC3 constant filter fails",
    rule: "stepped-control",
    body: 'mel: note("c4*8").s("sawtooth").clip(.3).lpf(800)',
    params: { track: "mel", control: "lpf" },
    ok: false,
    detail: /different/,
    inspect: (n) => expect(new Set(n.byTrack.mel?.map((e) => e.controls?.cutoff))).toEqual(new Set([800])),
  },
  {
    name: "AC4 frozen plain notes pass",
    rule: "no-chance",
    body: 'mel: note("c4 d4 e4 f4").s("sine")',
    ok: true,
  },
  {
    name: "AC4 mini question mark fails",
    rule: "no-chance",
    body: 'mel: note("c4 d4? e4 f4").s("sine")',
    ok: false,
    detail: /\?/,
  },
  {
    name: "AC4 degradeBy fails",
    rule: "no-chance",
    body: 'mel: note("c4*8").s("sine").degradeBy(.3)',
    ok: false,
    detail: /degradeBy/,
  },
  {
    name: "AC4 sometimes fails",
    rule: "no-chance",
    body: 'mel: note("c4*8").sometimes(x => x.add(12)).s("sine")',
    ok: false,
    detail: /sometimes/,
  },
  {
    name: "AC5 steady pad and hats with one busier bar pass",
    rule: "depth-layers",
    body: `${lead}\n${pad}\n${hats}`,
    params: depth,
    bars: 8,
    ok: true,
    inspect: (n) => {
      expect(
        Array.from({ length: 8 }, (_, b) => n.byTrack.hats?.filter((e) => R.floor(e.onset) === b).length),
      ).toEqual([4, 4, 4, 4, 4, 4, 4, 8]);
    },
  },
  {
    name: "AC5 everything changes every bar fails",
    rule: "depth-layers",
    body: `${lead}\nchords: note("<c3 d3 e3 f3 g3 a3 b3 c4>").s("triangle")\nhats: s("<hh hh*2 hh*3 hh*4 hh*5 hh*6 hh*7 hh*8>")`,
    params: depth,
    bars: 8,
    ok: false,
    detail: /mostly repeating/,
  },
  {
    name: "AC5 no background step forward fails",
    rule: "depth-layers",
    body: `${lead}\n${pad}\nhats: s("hh*4").gain(.4)`,
    params: depth,
    bars: 8,
    ok: false,
    detail: /occasional bar/,
  },
  {
    name: "AC5 lead repeats like the background fails",
    rule: "depth-layers",
    body: `mel: note("c4").s("sine")\n${pad}\n${hats}`,
    params: depth,
    bars: 8,
    ok: false,
    detail: /Vary mel/,
  },
  {
    name: "AC6 sixteen-step linear figure passes",
    rule: "linear-drums",
    body: linear,
    ok: true,
    inspect: (n) => {
      expect(new Set(n.all.map((e) => e.drum))).toEqual(new Set(["kick", "snare", "hatClosed"]));
      expect(n.all).toHaveLength(64);
    },
  },
  {
    name: "AC6 three-three-two groove passes",
    rule: "linear-drums",
    body: grouped,
    params: { group: [3, 3, 2] },
    ok: true,
  },
  {
    name: "AC6 rock beat without overlaps but with eighth-note hats fails",
    rule: "linear-drums",
    body: 'drums: s("hh bd hh ~ hh sd hh ~ hh bd hh ~ hh sd hh ~")',
    ok: false,
    detail: /evenly spaced/,
  },
  {
    name: "AC6 kick and hat together on beat one fails",
    rule: "linear-drums",
    body: 'drums: s("[bd,hh] hh sd hh hh bd hh sd bd sd hh bd hh hh sd hh")',
    ok: false,
    detail: /first beat/,
  },
  {
    name: "duration weighted bass through a kick fails",
    rule: "kick-bass-composite",
    body: `${kick}\nbass: note("~ c2@3 ~@4").s("sawtooth")`,
    ok: false,
    detail: /Shorten/,
    inspect: (n) => {
      expect(n.byTrack.bass?.[0]).toMatchObject({ onset: [1, 8], dur: [3, 8] });
      expect(n.byTrack.bass?.[0]?.clipDur).toBeUndefined();
    },
  },
  {
    name: "duration clipped weighted bass passes",
    rule: "kick-bass-composite",
    body: `${kick}\nbass: note("~ c2@3 ~@4").s("sawtooth").clip(.25)`,
    ok: true,
    inspect: (n) => {
      expect(n.byTrack.bass?.[0]).toMatchObject({ onset: [1, 8], dur: [3, 8], clipDur: [3, 32] });
    },
  },
  {
    name: "banked kick and clipped bass pass",
    rule: "kick-bass-composite",
    body: `${kick}.bank("RolandTR909")\n${offBass}`,
    ok: true,
    inspect: (n) => expect(n.byTrack.drums?.every((e) => e.drum === "kick" && e.s === "bd")).toBe(true),
  },
  {
    name: "banked linear drums pass",
    rule: "linear-drums",
    body: `${linear}.bank("RolandTR808")`,
    ok: true,
    inspect: (n) =>
      expect(new Set(n.all.map((e) => e.drum))).toEqual(new Set(["kick", "snare", "hatClosed"])),
  },
  {
    name: "gain and velocity make one background bar louder",
    rule: "depth-layers",
    body: `${lead}\n${pad}\nhats: s("hh*4").gain(.8).velocity("<.5!7 1>")`,
    params: depth,
    bars: 8,
    ok: true,
    inspect: (n) => {
      expect(n.byTrack.hats?.map((e) => e.gain)).toEqual([...Array(28).fill(0.4), ...Array(4).fill(0.8)]);
    },
  },
];

const realEdges = [
  {
    rule: "kick-bass-composite",
    body: 'drums: s("bd*3")\nbass: note("~ c2 ~ c2 ~ c2").s("sawtooth").clip(.4)',
    params: { minBassPerBar: 3 },
    track: "bass",
  },
  { rule: "hocket", body: split, params: hocketParams, track: "chords" },
  {
    rule: "stepped-control",
    body: 'mel: note("c4*8").s("sawtooth").lpf("400 2000 800 400")',
    params: { track: "mel", control: "lpf" },
    track: "mel",
  },
  { rule: "no-chance", body: 'mel: note("c4 d4 e4 f4").s("sine")', params: { track: "mel" }, track: "mel" },
  { rule: "depth-layers", body: `${lead}\n${pad}\n${hats}`, params: depth, track: "hats" },
  { rule: "linear-drums", body: 'drums: s("bd hh hh sd hh hh")', params: { group: [3, 3] }, track: "drums" },
];
for (const edge of realEdges) {
  realCases.push({
    name: `AC7 ${edge.rule} in three-quarter time passes`,
    ...edge,
    bars: 8,
    meter: "3/4",
    ok: true,
  });
  for (const muted of [false, true]) {
    const body = muted
      ? edge.body.replace(`${edge.track}:`, `_${edge.track}:`)
      : edge.body
          .split("\n")
          .filter((line) => !line.startsWith(`${edge.track}:`))
          .join("\n");
    realCases.push({
      name: `AC7 ${edge.rule} with ${muted ? "muted" : "missing"} ${edge.track} fails`,
      rule: edge.rule,
      body: `${body}\nspare: note("c6").s("sine")`,
      params: edge.params,
      bars: 8,
      ok: false,
      detail: new RegExp(edge.track),
      inspect: (n) => expect(n.byTrack[edge.track] ?? []).toHaveLength(0),
    });
  }
}

describe("real Strudel", () => {
  for (const c of realCases) {
    test(c.name, async () => {
      const bars = c.bars ?? 4;
      const meter = c.meter ?? "4/4";
      const code = codeOf(c.body, meter);
      const n = await strudel(code, bars);
      const ctx: RubricContext = { code, meter, bars, totalBars: bars, params: {} };
      const rule = rules[c.rule];
      if (!rule) throw new Error(`Missing rule ${c.rule}`);
      const r = rule(n, ctx, c.params ?? {});
      // Include actual event evidence if a new evaluator behavior changes the verdict or the pinned fields.
      try {
        expect(n.all.length).toBeGreaterThan(0);
        c.inspect?.(n);
        check(r, c.ok, c.detail);
        checkDetail(r);
      } catch (cause) {
        const observed = n.all.map(({ track, onset, dur, clipDur, midi, drum, s, gain, controls }) => ({
          track,
          onset,
          dur,
          clipDur,
          midi,
          drum,
          s,
          gain,
          controls,
        }));
        throw new Error(`${c.name}\n${code}\nObserved events: ${JSON.stringify(observed)}`, { cause });
      }
    });
  }
});
