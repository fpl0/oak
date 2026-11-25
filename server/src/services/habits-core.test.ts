import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { type Habits, isDescriptive, OAK_DEFAULTS } from "@oak/api";
import { evalHeadless } from "@oak/grader/testing";
import { SCHEMAS } from "@oak/theory";
import { terms } from "../../../content/terms.ts";
import {
  HABIT_MIN_SKETCHES,
  HABIT_TEMPO_WINDOW,
  HABIT_TERM_IDS,
  type HabitItem,
  habitFacts,
  summarizeHabits,
} from "./habits-core.ts";

setDefaultTimeout(30_000);

const defaults = OAK_DEFAULTS;
const A_MINOR = { tonic: "A", mode: "minor" } as const;
const aeolian = { key: [], schemas: [{ schema: "schema.aeolian" }] };
const axis = { key: [], schemas: [{ schema: "schema.axis" }] };

function item(code: string, extra: Partial<HabitItem> = {}): HabitItem {
  return {
    sketchId: "sk_fixture",
    version: 1,
    code,
    bpm: defaults.bpm,
    meter: defaults.meter,
    key: defaults.key,
    analysis: null,
    ...extra,
  };
}

const S1 = item('setcpm(84/4)\ndrums: s("bd ~ sd ~").bank("oak909")\nbass: note("a1 ~ e2 ~").s("ebass")', {
  sketchId: "sk_s1",
  bpm: 84,
  key: A_MINOR,
  analysis: aeolian,
});
const S2 = item(S1.code.replace("84/4", "88/4").replace("a1 ~ e2 ~", "a1 a1 e2 ~"), {
  sketchId: "sk_s2",
  bpm: 88,
  key: A_MINOR,
  analysis: aeolian,
});
const S3 = item(S1.code.replace("84/4", "92/4").replace("a1 ~ e2 ~", "d2 ~ a1 ~"), {
  sketchId: "sk_s3",
  bpm: 92,
  key: { tonic: "D", mode: "minor" },
  analysis: aeolian,
});
const S4 = item('setcpm(90/4)\ndrums: s("bd*4")\nbass: note("c2 ~ g1 ~").s("ebass")', {
  sketchId: "sk_s4",
  analysis: axis,
});
const S5 = item(
  'setcpm(120/3)\nconst verse = note("<[e3,g3,b3] [c3,e3,g3]>")\nconst chorus = note("<[a2,c3,e3] [b2,d3,f#3]>")\nchords: arrange([4, verse], [4, chorus]).s("piano")\ndrums: s("bd ~ ~")',
  { sketchId: "sk_s5", bpm: 120, meter: "3/4", key: { tonic: "E", mode: "minor" } },
);
const S6 = item(
  'setcpm(86/4)\nbass: note("a1 ~ ~ e2").s("sawtooth").lpf(400)\ndrums: s("bd ~ sd ~").bank("oak909")',
  {
    sketchId: "sk_s6",
    bpm: 86,
    key: null,
    analysis: { key: [{ key: A_MINOR }], schemas: [{ schema: "schema.aeolian" }] },
  },
);
const S7 = item(
  'setcpm(140/4)\nconst riff = "0 2 4 2"\nmel: arrange([2, n(riff)], [2, n(riff).add(n(1))]).scale("G4:major").s("sine")',
  { sketchId: "sk_s7", bpm: 140, key: { tonic: "G", mode: "major" }, analysis: axis },
);
const S8 = item('setcpm(90/4)\ndrums: s("bd*4 sd").n("~")\nbass: note("~").s("ebass")', {
  sketchId: "sk_s8",
  key: null,
  analysis: { key: [], schemas: [] },
});
const S9 = item('setcpm(90/4)\n\nhats: s("hh*8")\nbass: note("c2 ~ g1 ~").s("ebass")', {
  sketchId: "sk_s9",
  key: null,
});
const GOLDEN = [S1, S2, S3, S4, S5, S6, S7, S8, S9];
const EXPECTED: Habits = {
  sketches: 8,
  habits: [
    { id: "form.loop", text: "6 of your 8 sketches are one loop, with no sections." },
    { id: "mode.minor", text: "5 of your 8 sketches are in a minor key." },
    { id: "sound.bass.ebass", text: "5 of your 8 sketches give the bass the sound ebass." },
    { id: "tempo.84-92", text: "4 of your 8 sketches sit between 84 and 92 BPM." },
    { id: "kit.oak909", text: "4 of your 8 sketches use the drum kit oak909." },
    { id: "drums.bd_~_sd_~", text: '4 of your 8 sketches share the drum line "bd ~ sd ~".' },
    { id: "first.drums", text: "4 of your 8 sketches start with the drums." },
    { id: "schema.aeolian", text: "4 of your 8 sketches use the Aeolian loop (i–VI–III–VII) schema." },
  ],
};

const facts = (i: HabitItem) => habitFacts(i, defaults);
const ids = (i: HabitItem) => facts(i).map((f) => f.id);
const summary = (items: readonly HabitItem[]) => summarizeHabits(items, defaults);
const triple = (i: HabitItem) => [0, 1, 2].map((n) => ({ ...i, sketchId: `sk_repeat${n}` }));
const tempoItems = (bpms: number[]) =>
  bpms.map((bpm, i) => item(`setcpm(${bpm}/4)\ndrums: s("bd*2")`, { bpm, sketchId: `sk_tempo${i}` }));
const TEMPO_CASES = [
  {
    name: "densest window",
    bpms: [84, 96, 97, 100],
    habit: { id: "tempo.96-100", text: "3 of your 4 sketches sit between 96 and 100 BPM." },
  },
  {
    name: "lowest tied window",
    bpms: [80, 81, 82, 100, 101, 102],
    habit: { id: "tempo.80-82", text: "3 of your 6 sketches sit between 80 and 82 BPM." },
  },
  {
    name: "one tempo",
    bpms: [100, 100, 100],
    habit: { id: "tempo.100-100", text: "3 of your 3 sketches are at 100 BPM." },
  },
  { name: "no shared window", bpms: [84, 97, 110], habit: null },
];
const KIT_ITEMS = ["oak909", "oak909", "oak909", "oak808", "oak707", "oak606", "oak505"].map((bank, i) =>
  item(`drums: s("bd*${i + 2}").bank("${bank}")`, { sketchId: `sk_kit${i}` }),
);
const ALL_KINDS = item(
  'setcpm(108/3)\ndrums: s("bd ~ sd").bank("oak909")\nbass: note("a1").s("ebass")\nchords: arrange([2, note("[a3,c4,e4]")], [2, note("[f3,a3,c4]")]).s("piano")\nmel: note("a4 c5 e5").s("sine")',
  { bpm: 108, meter: "3/4", key: A_MINOR, analysis: aeolian },
);
const DORIAN = item('setcpm(90/4)\nmel: n("0 2 4").scale("D4:dorian").s("sine")', {
  key: { tonic: "D", mode: "dorian" },
});
function sentenceResults(): Habits[] {
  return [
    summary(GOLDEN),
    summary([S1, S2]),
    summary([]),
    summary(KIT_ITEMS),
    summary(KIT_ITEMS.slice(0, 6)),
    ...TEMPO_CASES.map((c) => summary(tempoItems(c.bpms))),
    summary(triple(ALL_KINDS)),
    summary(triple(DORIAN)),
    summary(triple(S7)),
  ];
}

describe("habits core", () => {
  test("AC1: the nine-sketch golden is exact", () => {
    expect(summary(GOLDEN)).toEqual(EXPECTED);
  });

  for (const prefix of [
    "key.",
    "meter.3-4",
    "sound.chords.piano",
    "sound.tune.sine",
    "schema.axis",
    "form.sections",
    "first.bass",
    "mode.major",
  ]) {
    test(`AC1: golden excludes ${prefix}`, () => {
      expect(summary(GOLDEN).habits.some(({ id }) => id.startsWith(prefix))).toBe(false);
    });
  }
  test("AC1: only the chosen tempo, no Band hats and no silent-template facts", () => {
    expect(summary(GOLDEN).habits.filter(({ id }) => id.startsWith("tempo."))).toEqual(
      EXPECTED.habits.filter(({ id }) => id.startsWith("tempo.")),
    );
    expect(summary(GOLDEN).habits.some(({ id }) => id.includes("hh"))).toBe(false);
    expect(facts(S8)).toEqual([]);
  });

  test("AC2: defaults and silent starts are ignored, learner changes survive", () => {
    expect(facts(S8)).toEqual([]);
    expect(
      facts(S9)
        .map((f) => `${f.kind}:${f.id}`)
        .sort(),
    ).toEqual(["first:first.bass", "form:form.loop", "sound:sound.bass.ebass"]);
    const bass = item('setcpm(90/4)\nbass: note("c2").s("ebass")');
    for (const kind of ["tempo", "meter", "mode", "key"])
      expect(facts(bass).some((f) => f.kind === kind)).toBe(false);
    expect(ids(bass)).toContain("sound.bass.ebass");
    expect(facts({ ...bass, bpm: 91, code: bass.code.replace("90/4", "91/4") })).toContainEqual({
      kind: "tempo",
      id: "tempo",
      value: "91",
    });
    const minor = { ...bass, key: { tonic: "C", mode: "minor" } } as const;
    expect(ids(minor)).toContain("mode.minor");
    expect(ids(minor)).toContain("key.C-minor");
    const hats = item('hats: s("hh*16")');
    expect(ids(hats)).toContain("drums.hh*16");
    expect(ids(hats)).toContain("first.drums");
  });

  test("AC3: fixed permutations and removal of S8 preserve the whole result", () => {
    for (const shuffled of [
      [...GOLDEN].reverse(),
      [S5, S9, S1, S8, S3, S7, S2, S6, S4],
      [S8, S6, S4, S2, S9, S7, S5, S3, S1],
      [S1, S2, S3, S4, S5, S6, S7, S9],
    ])
      expect(summary(shuffled)).toEqual(EXPECTED);
  });

  test("AC4: three sketches and at least half are both required", () => {
    expect(HABIT_MIN_SKETCHES).toBe(3);
    expect(HABIT_TEMPO_WINDOW).toBe(12);
    expect(summary([S1, S2])).toEqual({ sketches: 2, habits: [] });
    expect(summary([])).toEqual({ sketches: 0, habits: [] });
    expect(summary(KIT_ITEMS).sketches).toBe(7);
    expect(summary(KIT_ITEMS).habits.some(({ id }) => id.startsWith("kit."))).toBe(false);
    expect(summary(KIT_ITEMS.slice(0, 6)).habits.filter(({ id }) => id.startsWith("kit."))).toEqual([
      { id: "kit.oak909", text: "3 of your 6 sketches use the drum kit oak909." },
    ]);
  });
  for (const c of TEMPO_CASES) {
    test(`AC4: tempo ${c.name}`, () => {
      const read = (items: HabitItem[]) => summary(items).habits.filter(({ id }) => id.startsWith("tempo."));
      expect(read(tempoItems(c.bpms))).toEqual(c.habit ? [c.habit] : []);
      expect(read(tempoItems([...c.bpms].reverse()))).toEqual(c.habit ? [c.habit] : []);
    });
  }

  test("AC5: muted, other-role, const heads and silent chains", () => {
    for (const label of ["_bass", "bass_"]) {
      const muted = item(`${label}: note("a1 ~ e2 ~").s("ebass")`);
      expect(facts(muted)).toEqual([]);
      expect(facts(muted).some((f) => f.kind === "sound" || f.kind === "first")).toBe(false);
    }
    const other = item('fx: s("bd ~ sd ~").bank("oak909")');
    for (const kind of ["first", "kit", "drums", "sound"])
      expect(facts(other).some((f) => f.kind === kind)).toBe(false);
    expect(ids(other)).toEqual(["form.loop"]);
    const constant = item('const groove = "bd ~ sd ~"\ndrums: s(groove).bank("oak909")');
    expect(ids(constant)).toContain("kit.oak909");
    expect(ids(constant)).toContain("first.drums");
    expect(ids(constant).some((id) => id.startsWith("drums."))).toBe(false);
    for (const code of ["drums: s('~')", 'drums: s("bd sd").struct("~")', 'drums: s("bd sd").note("~")'])
      expect(facts(item(code))).toEqual([]);
  });

  test("AC6: every kind has exact descriptive sentences and real glossary terms", () => {
    const all = summary(triple(ALL_KINDS)).habits;
    expect(new Set(all.map(({ id }) => id.split(".")[0])).size).toBe(10);
    for (const [id, ending] of [
      ["meter.3-4", "are in 3/4."],
      ["key.A-minor", "are in A minor."],
      ["form.sections", "are in sections."],
      ["sound.chords.piano", "give the chords the sound piano."],
      ["sound.tune.sine", "give the tune the sound sine."],
    ] as const)
      expect(all).toContainEqual({ id, text: `3 of your 3 sketches ${ending}` });
    expect(summary(triple(DORIAN)).habits).toContainEqual({
      id: "mode.dorian",
      text: "3 of your 3 sketches are in Dorian.",
    });
    expect(summary(triple(S7)).habits).toContainEqual({
      id: "mode.major",
      text: "3 of your 3 sketches are in a major key.",
    });
    expect(all).toContainEqual({
      id: "schema.aeolian",
      text: `3 of your 3 sketches use the ${SCHEMAS.find((s) => s.id === "schema.aeolian")?.title} schema.`,
    });
    for (const result of sentenceResults())
      for (const { text } of result.habits) {
        expect(isDescriptive(text)).toBe(true);
        expect(text).not.toMatch(/semitone|progression|%|should|must|missing/i);
      }
    expect(HABIT_TERM_IDS).toEqual([
      "term.tempo",
      "term.meter",
      "term.loop",
      "term.schema",
      "term.form",
      "term.major-scale",
      "term.natural-minor",
    ]);
    for (const id of HABIT_TERM_IDS) expect(terms.some((term) => term.id === id)).toBe(true);
  });

  test("AC7: habit id grammar and overlong drum facts", () => {
    const grammar =
      /^(tempo\.\d+-\d+|meter\.\d+-\d+|mode\.[a-z]+|key\.[A-G][#b]?-[a-z]+|kit\.[^\s]+|sound\.(bass|chords|tune)\.[^\s]+|drums\.[A-Za-z0-9*~_]+|first\.(drums|bass|chords|tune)|schema\.[a-z0-9-]+|form\.(loop|sections))$/;
    for (const result of sentenceResults())
      for (const { id } of result.habits) {
        expect(id).toMatch(grammar);
        expect(id.length).toBeLessThanOrEqual(74);
      }
    const long = item(`drums: s("${"bd ".repeat(26)}sd").bank("oak909")`);
    expect(ids(long).some((id) => id.startsWith("drums."))).toBe(false);
    expect(ids(long).sort()).toEqual(["first.drums", "form.loop", "kit.oak909"]);
  });

  test("facts count once per kind, distinct role sounds and known schemas", () => {
    const repeated = item(
      'drums: s("bd  ~  sd").bank("oak909")\nhats: sound("hh*16").bank("oak808")\nbass: note("a1").sound("<ebass sawtooth> [ebass,~]*2")\nbass2: note("a2").s("ebass")\nchords: note("[a3,c4,e4]").s("ebass")',
      {
        analysis: {
          key: [],
          schemas: [
            { schema: "schema.aeolian" },
            { schema: "schema.aeolian" },
            { schema: "schema.axis" },
            { schema: "schema.unknown" },
          ],
        },
      },
    );
    expect(ids(repeated).sort()).toEqual([
      "drums.bd_~_sd",
      "first.drums",
      "form.loop",
      "kit.oak909",
      "schema.aeolian",
      "schema.axis",
      "sound.bass.ebass",
      "sound.bass.sawtooth",
      "sound.chords.ebass",
    ]);
    expect(facts(repeated).find((f) => f.kind === "drums")?.value).toBe("bd ~ sd");
    expect(summary(triple(repeated)).habits.find((h) => h.id === "sound.bass.ebass")?.text).toBe(
      "3 of your 3 sketches give the bass the sound ebass.",
    );
  });

  test("key fallback, rounding, trimmed defaults and first other-role line", () => {
    expect(ids({ ...S6, key: defaults.key })).not.toContain("mode.minor");
    expect(ids({ ...S6, analysis: null })).not.toContain("mode.minor");
    expect(facts(item('drums: s("bd")', { bpm: 95.6 })).find((f) => f.kind === "tempo")?.value).toBe("96");
    expect(facts(item('  hats: s("hh*8")  '))).toEqual([]);
    expect(ids(item('fx: s("bd")\nbass: note("a1").s("ebass")'))).not.toContain("first.bass");
  });

  test("Studio never echoes verdict words from a sound name", () => {
    const result = summary(triple(item('bass: note("a1").s("missing")')));
    expect(result.habits.some((h) => h.id === "sound.bass.missing")).toBe(false);
    for (const habit of result.habits) expect(isDescriptive(habit.text)).toBe(true);
  });

  for (const [index, fixture] of GOLDEN.entries()) {
    test(`AC12: S${index + 1} evaluates as real Strudel over four bars`, async () => {
      const result = await evalHeadless(fixture.code, 4);
      const counts: Record<string, number> = {};
      for (const event of result.events) counts[event.track] = (counts[event.track] ?? 0) + 1;
      if (fixture === S8) expect(result.events).toEqual([]);
      else expect(result.events.length).toBeGreaterThan(0);
      if (fixture === S1) expect(counts).toEqual({ drums: 8, bass: 8 });
      if (fixture === S5) expect(counts).toEqual({ chords: 12, drums: 4 });
      if (fixture === S6) expect(counts).toEqual({ bass: 8, drums: 8 });
      if (fixture === S7) expect(counts).toEqual({ mel: 16 });
      if (fixture === S9) expect(counts).toEqual({ hats: 32, bass: 8 });
    });
  }
});
