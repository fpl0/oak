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
