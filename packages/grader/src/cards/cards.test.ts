import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { type AnalysisSummary, type CardCheck, type CardFacts, isDescriptive, rat } from "@oak/content-kit";
import { MODES, SCHEMAS, spellMidi } from "@oak/theory";
import { toolbox } from "../../../../content/toolbox.ts";
import { ev, norm, strudel } from "../analyze/__support__/fixtures.ts";
import { analyzePiece } from "../analyze/piece.ts";
import { toolsUsed } from "../lint/index.ts";
import { cardFacts, describeCard, habitCard } from "./index.ts";

setDefaultTimeout(30_000);

async function facts(
  code: string,
  bars = 1,
  extra?: { bpm?: number | null; slots?: AnalysisSummary["slots"] | null },
): Promise<CardFacts> {
  const n = await strudel(code, bars);
  const before = structuredClone(n);
  const result = cardFacts({ code, n, bpm: extra?.bpm ?? null, slots: extra?.slots ?? null, toolbox });
  expect(n).toEqual(before);
  return result;
}

function descriptive(text: string): void {
  expect(isDescriptive(text)).toBe(true);
  expect(text).not.toMatch(/[%✓✗]/);
}

// Every description assertion also pins the public string-only API and both inputs' immutability (AC9).
function description(check: CardCheck, input: CardFacts, expected: string): void {
  const beforeFacts = structuredClone(input);
  const beforeCheck = structuredClone(check);
  const result: string = describeCard(check, input);
  expect(typeof result).toBe("string");
  expect(result).toBe(expected);
  descriptive(result);
  expect(input).toEqual(beforeFacts);
  expect(check).toEqual(beforeCheck);
}

const hats: CardCheck = { kind: "sounds", sounds: ["hh", "oh"], role: "drums" };
const tune: CardCheck = { kind: "range", role: "tune" };
const room: CardCheck = { kind: "tools", tools: [{ id: "tb.room", label: ".room()" }] };
const goldenCode = 'drums: s("bd*2, hh*4")\nmel: n("0 4").scale("C4:major").s("piano")';

describe("AC5 and AC9 real Strudel descriptions are pure and descriptive", () => {
  const cases: [string, CardCheck, string, string][] = [
    ["hats present", hats, 'drums: s("bd*2, hh*4")', "hh plays in drums."],
    ["hats absent", hats, 'drums: s("bd ~ sd ~")', "No hh or oh so far."],
    ["both hats", hats, 'drums: s("bd hh oh hh")', "hh and oh play in drums."],
    ["hats role filter", hats, 'mel: n("0 2").scale("C4:major").s("hh")', "No hh or oh so far."],
    [
      "all sounds",
      { kind: "sounds", sounds: [] },
      'drums: s("bd sd")\nbass: note("c2").s("ebass")',
      "Sounds so far: drums: bd, sd; bass: ebass.",
    ],
    ["silent sounds", { kind: "sounds", sounds: [] }, 'drums: s("~")', "No sound plays yet."],
    [
      "tune range",
      tune,
      'mel: n("0 1 2 1").scale("C4:major").s("piano")',
      "The tune uses 3 different notes, from C4 to E4.",
    ],
    ["no tune", tune, 'drums: s("bd")', "No tune yet."],
    ["one tune note", tune, 'mel: note("c4 c4").s("piano")', "The tune uses 1 note, C4."],
    [
      "sharp tune",
      tune,
      'mel: note("f#4 a4").s("piano")',
      "The tune uses 2 different notes, from F#4 to A4.",
    ],
    [
      "chords range",
      { kind: "range", role: "chords" },
      'chords: note("[c3,e3,g3]").s("piano")',
      "The chords use 3 different notes, from C3 to G3.",
    ],
    [
      "two tune tracks",
      tune,
      'mel: n("0 1 2").scale("C4:major").s("piano")\nvox: note("g4").s("piano")',
      "The tune parts: mel uses 3 different notes, from C4 to E4; vox uses 1 note, G4.",
    ],
    [
      "three parts",
      { kind: "parts" },
      'drums: s("bd")\nbass: note("c2").s("ebass")\nchords: note("[c3,e3,g3]").s("piano")',
      "3 parts play: drums, bass and chords.",
    ],
    ["one part", { kind: "parts" }, 'bass: note("c2").s("ebass")', "1 part plays: bass."],
    ["no parts", { kind: "parts" }, 'drums: s("~")', "No part plays yet."],
    ["muted part", { kind: "parts" }, 'drums: s("bd")\n_bass: note("c2").s("ebass")', "1 part plays: drums."],
    ["no numerals", { kind: "numerals" }, 'drums: s("bd")', "No chords yet."],
    ["room used", room, 'mel: n("0 2").scale("C4:major").room(0.5)', "This sketch uses .room()."],
    ["room absent", room, 'mel: n("0 2").scale("C4:major")', "No .room() so far."],
    [
      "bass range",
      { kind: "range", role: "bass" },
      'bass: note("c2 g2").s("ebass")',
      "The bass uses 2 different notes, from C2 to G2.",
    ],
    ["no bass", { kind: "range", role: "bass" }, 'drums: s("bd")', "No bass yet."],
    ["no chords range", { kind: "range", role: "chords" }, 'drums: s("bd")', "No chords yet."],
    [
      "sounds across roles",
      { kind: "sounds", sounds: ["piano"] },
      'bass: note("c2").s("piano")\nmel: note("c4").s("piano")',
      "piano plays in bass and mel.",
    ],
    [
      "three sounds in check order",
      { kind: "sounds", sounds: ["sd", "hh", "bd"] },
      'drums: s("bd hh sd")',
      "sd, hh and bd play in drums.",
    ],
    [
      "three absent sounds",
      { kind: "sounds", sounds: ["hh", "oh", "rd"] },
      'drums: s("bd")',
      "No hh, oh or rd so far.",
    ],
    [
      "three source labels",
      { kind: "sounds", sounds: ["piano"] },
      'bass: note("c2").s("piano")\nchords: note("c3").s("piano")\nmel: note("c4").s("piano")',
      "piano plays in bass, chords and mel.",
    ],
  ];
  for (const [name, check, code, expected] of cases) {
    test(name, async () => description(check, await facts(code), expected));
  }

  for (const [bpm, expected] of [
    [84, "This sketch is at 84 BPM."],
    [null, "This sketch has no tempo line yet."],
    [92.5, "This sketch is at 92.5 BPM."],
    [90.04, "This sketch is at 90 BPM."],
    [89.96, "This sketch is at 90 BPM."],
  ] as const) {
    test(`tempo ${bpm}`, async () => {
      const code = bpm === null ? 'drums: s("bd")' : `setcpm(${bpm}/4)\n\ndrums: s("bd")`;
      description({ kind: "tempo" }, await facts(code, 1, { bpm }), expected);
    });
  }

  test("four-bar numerals from analyzePiece", async () => {
    const code = 'chords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano")';
    const n = await strudel(code, 4);
    const slots = analyzePiece(n, { meter: "4/4", key: { tonic: "C", mode: "major" }, code, bars: 4 }).slots;
    expect(slots.map(({ rn }) => rn)).toEqual(["I", "V", "vi", "IV"]);
    description({ kind: "numerals" }, await facts(code, 4, { slots }), "The chords so far: I–V–vi–IV.");
  });

  test("all black keys use ASCII sharps", async () => {
    expect([61, 63, 66, 68, 70].map((midi) => spellMidi(midi, { key: null }).name)).toEqual([
      "Db4",
      "Eb4",
      "F#4",
      "Ab4",
      "Bb4",
    ]);
    for (const [note, name] of [
      ["c#4", "C#4"],
      ["d#4", "D#4"],
      ["f#4", "F#4"],
      ["g#4", "G#4"],
      ["a#4", "A#4"],
    ]) {
      description(tune, await facts(`mel: note("${note}").s("piano")`), `The tune uses 1 note, ${name}.`);
    }
  });

  test("tool lists follow check order, with and/or joins", async () => {
    const check: CardCheck = {
      kind: "tools",
      tools: [
        { id: "tb.room", label: ".room()" },
        { id: "tb.lpf", label: ".lpf()" },
        { id: "tb.gain", label: ".gain()" },
      ],
    };
    description(
      check,
      await facts('mel: note("c4").lpf(800).gain(0.5).room(0.5)'),
      "This sketch uses .room(), .lpf() and .gain().",
    );
    description(
      check,
      await facts('mel: note("c4").lpf(800).room(0.5)'),
      "This sketch uses .room() and .lpf().",
    );
    description(check, await facts('mel: note("c4")'), "No .room(), .lpf() or .gain() so far.");
  });
});

describe("AC6 and AC9 facts from real Strudel", () => {
  test("golden track facts and tools, without mutating Normalized", async () => {
    const result = await facts(goldenCode);
    expect(result.tracks).toEqual([
      { label: "drums", role: "drums", sounds: ["bd", "hh"], notes: 6, low: null, high: null, distinct: 0 },
      { label: "mel", role: "tune", sounds: ["piano"], notes: 2, low: 60, high: 67, distinct: 2 },
    ]);
    expect(result.tools).toEqual([...new Set(toolsUsed(goldenCode, toolbox).map(({ id }) => id))]);
    expect(result.numerals).toEqual([]);
    description({ kind: "parts" }, result, "2 parts play: drums and mel.");
  });

  test("source order wins over event order", async () => {
    const result = await facts('mel: n("0").scale("C4:major").s("piano")\ndrums: s("bd")');
    expect(result.tracks.map(({ label }) => label)).toEqual(["mel", "drums"]);
    description({ kind: "parts" }, result, "2 parts play: mel and drums.");
  });

  test("band tracks never enter facts", async () => {
    const n = await strudel(goldenCode);
    const band = ev({ track: "band.bass", onset: rat(0), midi: 36, s: "ebass" });
    const withBand = { ...n, byTrack: { ...n.byTrack, "band.bass": [band] }, band: [band] };
    const before = structuredClone(withBand);
    const read = (input: typeof n) =>
      cardFacts({ code: goldenCode, n: input, bpm: null, slots: null, toolbox });
    expect(read(withBand).tracks).toEqual(read(n).tracks);
    expect(withBand).toEqual(before);
    description({ kind: "parts" }, read(withBand), "2 parts play: drums and mel.");
  });

  test("numerals collapse only consecutive repeats", async () => {
    const slots = ["I", "I", "V", "V", "I"].map((rn, i) => ({ bar: i + 1, beat: 1, symbol: "C", rn }));
    const before = structuredClone(slots);
    const result = await facts(goldenCode, 1, { slots });
    expect(result.numerals).toEqual(["I", "V", "I"]);
    expect(slots).toEqual(before);
    description({ kind: "numerals" }, result, "The chords so far: I–V–I.");
    for (const empty of [null, []]) {
      const result = await facts(goldenCode, 1, { slots: empty });
      expect(result.numerals).toEqual([]);
      description({ kind: "numerals" }, result, "No chords yet.");
    }
  });

  test("tools are unique and in first-use order", async () => {
    const code = 'mel: note("c4").room(0.5).lpf(800)\nvox: note("g4").room(0.2)';
    const result = await facts(code);
    expect(result.tools).toEqual([...new Set(toolsUsed(code, toolbox).map(({ id }) => id))]);
    expect(result.tools.filter((id) => id === "tb.room")).toHaveLength(1);
    expect(result.tools.indexOf("tb.room")).toBeLessThan(result.tools.indexOf("tb.lpf"));
    description(room, result, "This sketch uses .room().");
  });
});

describe("AC7 and AC9 bank facts", () => {
  // W0 known gap: the headless fixture never sets bank, so bank coverage uses explicit facts/events.
  test("bank name is described on the drums", () => {
    description(
      { kind: "sounds", sounds: ["oak909"], role: "drums" },
      {
        bpm: null,
        tracks: [
          {
            label: "drums",
            role: "drums",
            sounds: ["bd", "oak909"],
            notes: 4,
            low: null,
            high: null,
            distinct: 0,
          },
        ],
        tools: [],
        numerals: [],
      },
      "oak909 plays in drums.",
    );
  });
  test("event sounds precede banks without mutating events", () => {
    const event = { ...ev({ track: "drums", onset: rat(0), s: "bd", drum: "kick" }), bank: "oak909" };
    const n = norm([event]);
    const input = { code: 'drums: s("bd").bank("oak909")', n, bpm: null, slots: null, toolbox };
    const before = structuredClone(input);
    const result = cardFacts(input);
    expect(result.tracks[0]?.sounds).toEqual(["bd", "oak909"]);
    expect(input).toEqual(before);
    description({ kind: "sounds", sounds: ["oak909"], role: "drums" }, result, "oak909 plays in drums.");
  });
});

describe("AC8 and AC9 habit cards", () => {
  const keyInstead = "Instead, try another key or mode from your lessons.";
  const cases: [string, string, string, CardCheck | null][] = [
    [
      "sound.bass.ebass",
      "Not this time: no ebass on the bass.",
      "Instead, try a sound you have not given the bass before.",
      { kind: "sounds", sounds: ["ebass"], role: "bass" },
    ],
    [
      "kit.oak909",
      "Not this time: no oak909 drum kit.",
      "Instead, try another kit for the drums.",
      { kind: "sounds", sounds: ["oak909"], role: "drums" },
    ],
    [
      "tempo.84-92",
      "This time, try a tempo outside 84 to 92 BPM.",
      "Instead, try Tempo try and pick a tempo by feel.",
      { kind: "tempo" },
    ],
    ["mode.minor", "Not this time: no minor key.", keyInstead, null],
    ["mode.dorian", "Not this time: no Dorian key.", keyInstead, null],
    ["key.A-minor", "Not this time: a key other than A minor.", keyInstead, null],
    [
      "meter.3-4",
      "Not this time: a meter other than 3/4.",
      "Instead, try another meter from your lessons.",
      null,
    ],
    [
      "drums.bd_~_sd_~",
      "Not this time: a drum line you have not used before.",
      "Instead, try starting from the bass, or from a rest on beat 1.",
      null,
    ],
    [
      "first.drums",
      "Not this time: start with something other than the drums.",
      "Instead, try starting with another part.",
      { kind: "parts" },
    ],
    [
      "schema.aeolian",
      "Not this time: no Aeolian loop (i–VI–III–VII).",
      "Instead, try two chords, or a loop that starts away from home.",
      { kind: "numerals" },
    ],
    [
      "form.loop",
      "Not this time: more than one loop.",
      "Instead, try two sections with arrange(), even short ones.",
      null,
    ],
    [
      "form.sections",
      "Not this time: one loop, no sections.",
      "Instead, try making one loop carry the whole piece.",
      null,
    ],
  ];
  for (const [id, text, instead, check] of cases) {
    test(`exact ${id}`, () => {
      const result = habitCard(id);
      expect(result).toEqual({
        id: `habit.${id}`,
        kind: "avoid",
        unlock: "U00.L01",
        source: "Avoidance List",
        text,
        instead,
        ...(check ? { check } : {}),
      });
      expect(result && "check" in result).toBe(check !== null);
      for (const copy of [result?.text, result?.instead, result?.source]) {
        expect(copy).toBeDefined();
        descriptive(copy ?? "");
      }
      expect(habitCard(id)).toEqual(result);
    });
  }
  for (const id of [
    "schema.nope",
    "weird",
    "",
    "sound.other.x",
    "sound.bass.",
    "tempo.92-84",
    "tempo.a-b",
    "meter.3",
    "mode.nope",
    "form.other",
    "first.other",
    "kit.",
    `sound.bass.${"x".repeat(70)}`,
    "key.H-minor",
    "key.A-nope",
    "meter.0-4",
    "meter.3-0",
    "meter.-3-4",
    "tempo.84.5-92",
    "drums.",
  ]) {
    test(`rejects malformed ${JSON.stringify(id)}`, () => expect(habitCard(id)).toBeNull());
  }
  test("all known modes, schemas and pitched roles produce descriptive cards", () => {
    for (const id of [
      ...MODES.map(({ mode }) => `mode.${mode}`),
      ...MODES.map(({ mode }) => `key.F#-${mode}`),
      ...SCHEMAS.map(({ id }) => id),
      "sound.chords.piano",
      "sound.tune.sine",
      "first.bass",
      "first.chords",
      "first.tune",
      "tempo.84-84",
      `sound.bass.${"x".repeat(63)}`,
    ]) {
      const card = habitCard(id);
      expect(card).not.toBeNull();
      for (const text of [card?.text, card?.instead, card?.source]) descriptive(text ?? "");
    }
  });
});
