// Rubric rules on real Strudel pieces: for each rule a piece that meets it and a known-wrong variant that
// does not, with the music stated in the test name. Capstone rules follow contracts §6.6.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { RubricRule } from "@oak/content-kit";
import { rat } from "@oak/content-kit";
import { strudel } from "../analyze/__support__/fixtures.ts";
import { unknownCodes } from "../feedback/catalog.ts";
import type { RubricContext } from "./context.ts";
import { evaluateRubric, type runRubric } from "./index.ts";
import { CUSTOM_RULES, RULES } from "./rules.ts";
import { WAVE7_BUILT_CUSTOM } from "./wave7-custom.ts";
import { wave7UnbuiltCustom } from "./wave7-rules.ts";

setDefaultTimeout(30_000);

type Body = RubricRule extends infer R
  ? R extends RubricRule
    ? Omit<R, "id" | "label" | "required" | "skills">
    : never
  : never;
const rule = (body: Body): RubricRule =>
  ({ id: body.rule, label: body.rule, required: true, skills: [], ...body }) as RubricRule;
const C = { tonic: "C", mode: "major" } as const;

async function check(r: RubricRule, code: string, bars: number, o: Partial<RubricContext> = {}) {
  const n = await strudel(code, bars);
  const ctx: RubricContext = { meter: "4/4", code, params: {}, bars, ...o };
  const { rows, extra } = evaluateRubric([r], n, ctx);
  expect(unknownCodes([...rows.map((x) => x.diag as never), ...extra])).toEqual([]);
  return { row: rows[0] as NonNullable<ReturnType<typeof runRubric>[number]>, extra };
}
const passes = async (r: RubricRule, code: string, bars = 1, o: Partial<RubricContext> = {}) => {
  const { row } = await check(r, code, bars, o);
  if (!row.ok) throw new Error(`${r.rule} should pass: ${row.diag?.params.detail}`);
  return row;
};
const fails = async (r: RubricRule, code: string, bars = 1, o: Partial<RubricContext> = {}) => {
  const res = await check(r, code, bars, o);
  expect(res.row.ok).toBe(false);
  expect(res.row.diag?.id).toBe("rubric.unmet");
  return res;
};

test("every rule name of the content contract has an analyzer", () => {
  const names = [
    "bars",
    "duration-sec",
    "tempo-bpm",
    "tracks",
    "in-key",
    "ends-on-degree",
    "cadence",
    "chord-tones-strong",
    "progression",
    "contains-rn",
    "range",
    "step-ratio",
    "harmonic-rhythm",
    "groove-lock",
    "swing",
    "syncopation",
    "form",
    "voice-leading",
    "guide-tones",
    "modulation",
    "mode",
    "blues-form",
    "euclid",
    "clave",
    "polyrhythm",
    "register-separation",
    "no-muddy-low",
    "uses",
    "custom",
    "motif-reuse",
    "contrast",
    "key-change",
    "velocity-ghosts",
    "onsets",
    "degree-set",
    "sounds",
    "distinct-pitches",
    "device-count",
    "matches",
    "pickup",
    "chord-qualities",
    "chord-inversions",
    "non-chord-tones",
    // Wave 5 (docs/design/wave5.md §3.2): `bass-line` built on the bass view; `notates` a typed stub.
    "bass-line",
    "notates",
    // Wave 6 (rubric/wave6-rules.ts): the same tune over new chords (U16.L05); a triplet somewhere (U13.L05).
    "reharmonize",
    "tuplets",
  ];
  expect(Object.keys(RULES).sort()).toEqual([...names].sort());
  // Corrections pass: the effect checks of the lesson fixes (rubric/corrections-rules.ts).
  const built = [
    ...WAVE7_BUILT_CUSTOM,
    "silent-beat",
    "split-beat",
    "held",
    "bars-differ",
    "speed-change",
    "transposed-copy",
    "distinct-keys",
    "orbits-differ",
    "call-response",
    "stack-intervals",
    "chords-per-bar",
    "control-set",
    "parts-enter",
    "last-chord",
    "song-kept",
    "tuplets-every-bar",
    "swung-offbeats",
    "voiced-with",
    "broken-chord",
    "black-keys",
    "chance-varies",
    "echo",
    // Oak 2.0 W0 (rubric/oak2-form.ts, oak2-pitch.ts, oak2-rhythm.ts).
    "ends-on-purpose",
    "carved",
    "staggered-boundary",
    "unique-event",
    "arc",
    "same-shape",
    "bass-names-chord",
    "inverted-copy",
    "rotated-copy",
    "time-shifted",
    "gap-fill",
    "kick-bass-composite",
    "hocket",
    "stepped-control",
    "no-chance",
    "depth-layers",
    "linear-drums",
  ];
  // Wave 7 Build (rubric/wave7-custom.ts): every planned custom rule of the advanced tracks is built.
  expect(wave7UnbuiltCustom(built)).toEqual([]);
  expect(Object.keys(CUSTOM_RULES).sort()).toEqual([...built].sort());
});

describe("form-free rules", () => {
  test("bars, tempo and duration: a 4-bar loop at 120 BPM lasts 8 s", async () => {
    const code = 'setcpm(120/4)\nmel: n("<0 2 4 5>").scale("C4:major")';
    const row = await passes(rule({ rule: "bars", min: 4, max: 8 }), code, 16, { totalBars: 4 });
    expect(row.value).toBe(4);
    await fails(rule({ rule: "bars", min: 8 }), code, 16, { totalBars: 4 });
    await passes(rule({ rule: "tempo-bpm", min: 70, max: 140 }), code);
    await fails(rule({ rule: "tempo-bpm", min: 70, max: 100 }), code);
    const d = await passes(rule({ rule: "duration-sec", min: 8 }), code, 16, { totalBars: 4 });
    expect(d.value).toBe(8);
    await fails(rule({ rule: "duration-sec", min: 9 }), code, 16, { totalBars: 4 });
  });
  test("tracks with roles: drums + bass + melody (C1); a missing bass fails", async () => {
    const r = rule({ rule: "tracks", min: 3, roles: ["drums", "bass", "melody"] });
    await passes(r, 'drums: s("bd sd")\nbass: note("c2 g2")\nmel: note("e4 g4")');
    await fails(r, 'drums: s("bd sd")\nmel: note("e4 g4")');
  });
  test("in-key: a C-major tune is 100% in C; one F# drops it", async () => {
    const r = rule({ rule: "in-key", key: "declared", minRatio: 0.95 });
    await passes(r, 'mel: n("0 2 4 5 7").scale("C4:major")', 1, { key: C });
    const { row } = await fails(r, 'mel: note("c4 e4 f#4 g4")', 1, { key: C });
    expect(row.value).toBe(0.75);
  });
  test("range ≤ 15 semitones (C1); a two-octave leap fails with partial credit", async () => {
    const r = rule({ rule: "range", track: "mel", maxSpan: 15 });
    await passes(r, 'mel: note("c4 g4 c5 d5")');
    await fails(r, 'mel: note("c4 g4 c5 c6")');
  });
  test("range within c1–c3 for a bass (C1)", async () => {
    const r = rule({ rule: "range", track: "bass", within: ["c1", "c3"] });
    await passes(r, 'bass: note("c2 g2 c3")');
    await fails(r, 'bass: note("c2 g2 c4")');
  });
  test("step-ratio, distinct-pitches and degree-set (C4: ♭3 and ♭6 in A minor)", async () => {
    await passes(rule({ rule: "step-ratio", track: "mel", min: 0.75 }), 'mel: note("c4 d4 e4 f4 g4")');
    await fails(rule({ rule: "step-ratio", track: "mel", min: 0.75 }), 'mel: note("c4 g4 c5 e4 a4")');
    await passes(rule({ rule: "distinct-pitches", track: "bass", min: 3 }), 'bass: note("c2 e2 g2 c2")');
    await fails(rule({ rule: "distinct-pitches", track: "bass", min: 3 }), 'bass: note("c2 c2 g2 c2")');
    const am = { tonic: "C", mode: "minor" } as const;
    const ds = rule({ rule: "degree-set", track: "mel", contains: ["b3", "b6"] });
    await passes(ds, 'mel: n("0 2 4 5 4 2").scale("C4:minor")', 1, { key: am });
    await fails(ds, 'mel: n("0 2 4 2").scale("C4:minor")', 1, { key: am });
  });
  test("ends-on-degree: fails with melody.ends-on as well", async () => {
    const r = rule({ rule: "ends-on-degree", degrees: ["1"], track: "mel" });
    await passes(r, 'mel: n("4 2 1 0").scale("C4:major")', 1, { key: C });
    const { extra } = await fails(r, 'mel: n("4 2 1 1").scale("C4:major")', 1, { key: C });
    expect(extra.map((d) => d.id)).toEqual(["melody.ends-on"]);
  });
  test("motif-reuse: bar 1 repeated a step higher in bar 3 counts; four unrelated bars do not", async () => {
    const r = rule({ rule: "motif-reuse", track: "mel", minRatio: 0.5 });
    await passes(r, 'mel: n("<[0 2 4 2] [0 2 4 2] [1 3 5 3] [0 2 4 2]>").scale("C4:major")', 4);
    await fails(r, 'mel: n("<[0 2 4 2] [7 3 0 5] [2 9 1 6] [4 0 8 3]>").scale("C4:major")', 4);
  });
  test("sounds and uses", async () => {
    await passes(
      rule({ rule: "sounds", contains: ["snd.rhodes"] }),
      'chords: note("[c3,e3,g3]").s("rhodes")',
    );
    await fails(rule({ rule: "sounds", contains: ["snd.rhodes"] }), 'chords: note("[c3,e3,g3]").s("piano")');
    // anyOf (U05.L08: Rhodes or organ): one of them is enough; neither fails.
    const either = rule({ rule: "sounds", anyOf: ["snd.rhodes", "snd.organ"] });
    await passes(either, 'chords: note("[c3,e3,g3]").s("organ")');
    await passes(either, 'chords: note("[c3,e3,g3]").s("rhodes")\nmel: note("e4").s("piano")');
    await fails(either, 'chords: note("[c3,e3,g3]").s("piano")');
    await passes(rule({ rule: "uses", tool: "tb.mini.euclid" }), 'perc: s("rim(3,8)")');
    await fails(rule({ rule: "uses", tool: "tb.mini.euclid" }), 'perc: s("rim*3")');
    await passes(rule({ rule: "uses", tool: "tb.mini.euclid" }), 'perc: s("rim*3")', 1, {
      toolsUsed: () => [{ id: "tb.mini.euclid" }],
    });
  });
});

describe("rhythm and groove rules", () => {
  test("onsets: snare ⊇ {1/4, 3/4} in every bar (C0); a bar without beat 4 fails", async () => {
    const r = rule({
      rule: "onsets",
      track: "*",
      drum: "snare",
      contains: [rat(1, 4), rat(3, 4)],
      perBar: true,
    });
    await passes(r, 'drums: s("bd sd bd sd")', 4);
    const { row } = await fails(r, 'drums: s("<[bd sd bd sd] [bd sd bd ~]>")', 4);
    expect(row.value).toBe(2);
  });
  test("groove-lock: bass on every kick locks 100%; bass on the offbeats 0%", async () => {
    const r = rule({ rule: "groove-lock", kick: "drums", bass: "bass", min: 0.5 });
    await passes(r, 'drums: s("bd sd bd sd")\nbass: note("c2 ~ c2 ~")');
    await fails(r, 'drums: s("bd sd bd sd")\nbass: note("[~ c2] [~ c2] [~ c2] [~ c2]")');
  });
  test("swing (C5): hats with swingBy(1/3, 4) measure 2:1; straight hats fail with rhythm.swing-missing", async () => {
    const r = rule({
      rule: "swing",
      track: ["hats", "@drums"],
      drums: ["hatClosed", "hatOpen", "ride"],
      subdivision: 8,
      ratio: [1.6, 2.4],
    });
    const row = await passes(r, 'hats: s("hh*8").swingBy(1/3, 4)\nbass: note("c2*4")');
    expect(row.value).toBe(2);
    const { extra } = await fails(r, 'hats: s("hh*8")\nbass: note("c2*4")');
    expect(extra.map((d) => d.id)).toEqual(["rhythm.swing-missing"]);
  });
  test("swing never measures a quarter-note line: it falls through to the next listed track (JC2)", async () => {
    const r = rule({ rule: "swing", track: ["bass", "chords"], subdivision: 8, ratio: [1.6, 2.4] });
    await passes(r, 'bass: note("c2*4")\nchords: note("[c3,e3,g3]*8").swingBy(1/3, 4)');
    const { extra } = await fails(r, 'bass: note("c2*4")\nchords: note("[c3,e3,g3]*4")');
    expect(extra[0]?.id).toBe("rhythm.swing-missing");
  });
  test("swing 16ths (AC2): swingBy(1/3, 8) on 16th hats", async () => {
    await passes(
      rule({ rule: "swing", track: ["hats"], subdivision: 16, ratio: [1.2, 2.4] }),
      'hats: s("hh*16").swingBy(1/3, 8)',
    );
  });
  test("syncopation (RC1 bass): anticipations count, downbeat-only bass does not", async () => {
    const r = rule({ rule: "syncopation", track: "bass", min: 3 });
    await passes(r, 'bass: note("c2 [~ c2] ~ [~ c2] [~ c2] ~ c2 ~".slow(2))', 2);
    await fails(r, 'bass: note("c2 c2 c2 c2")');
  });
  test("velocity-ghosts on 16th offbeats (RC1)", async () => {
    const r = rule({ rule: "velocity-ghosts", track: "snare", min: 4, on: "16th-offbeat" });
    await passes(
      r,
      'snare: s("[~ sd:1 ~ ~] [sd ~ ~ sd:1] [~ sd:1 ~ ~] [sd ~ ~ sd:1]").gain("[0 .3 0 0] [.9 0 0 .3] [0 .3 0 0] [.9 0 0 .3]")',
    );
    await fails(r, 'snare: s("~ sd ~ sd")');
  });
  test("euclid E(3,8) in any rotation; clave son 3-2 on the 2-bar 8th grid (RC2)", async () => {
    await passes(
      rule({ rule: "euclid", track: "perc", k: 3, n: 8, rotationFree: true }),
      'perc: s("rim(3,8,2)")',
      2,
    );
    await fails(
      rule({ rule: "euclid", track: "perc", k: 3, n: 8, rotationFree: false }),
      'perc: s("rim(3,8,2)")',
      2,
    );
    const son = rule({ rule: "clave", track: "perc", type: "son", direction: "3-2" });
    await passes(son, 'perc: s("<[rim ~ ~ rim ~ ~ rim ~] [~ ~ rim ~ rim ~ ~ ~]>")', 8);
    await fails(son, 'perc: s("<[~ ~ rim ~ rim ~ ~ ~] [rim ~ ~ rim ~ ~ rim ~]>")', 8);
  });
  test("polyrhythm 3:2 between two named tracks (RC2)", async () => {
    const r = rule({ rule: "polyrhythm", a: "perc", b: "kick", ratio: [3, 2] });
    await passes(r, 'perc: s("rim*3")\nkick: s("bd*2")', 2);
    await fails(r, 'perc: s("rim*4")\nkick: s("bd*2")', 2);
  });
});

describe("harmony rules", () => {
  test("progression: the axis loop in any rotation on the triad core, so sevenths pass (C2)", async () => {
    const r = rule({ rule: "progression", schema: "axis", allowRotation: true });
    await passes(r, 'chords: chord("<C G Am F>").voicing()', 4, { key: C });
    await passes(r, 'chords: chord("<Am7 F^7 C G7>").voicing()', 4, { key: C });
    await fails(r, 'chords: chord("<C Dm Em F>").voicing()', 4, { key: C });
  });
  test("progression by numerals: I IV V I", async () => {
    await passes(
      rule({ rule: "progression", rn: ["I", "IV", "V", "I"] }),
      'chords: chord("<C F G C>").voicing()',
      4,
      { key: C },
    );
    await fails(
      rule({ rule: "progression", rn: ["I", "IV", "V", "I"] }),
      'chords: chord("<C F Am C>").voicing()',
      4,
      { key: C },
    );
  });
  test("aeolian loop in A minor (C4)", async () => {
    await passes(
      rule({ rule: "progression", schema: "aeolian" }),
      'chords: chord("<Am F C G>").voicing()',
      4,
      { key: { tonic: "A", mode: "minor" } },
    );
  });
  test("cadence: G→C with a root-position bass and the melody on 1 is PAC; ending on G is HC; F→C is PC", async () => {
    const pac =
      'chords: chord("<F G C C>").voicing()\nbass: note("<f2 g2 c2 c2>")\nmel: note("<a4 b4 c5 c5>")';
    const row = await passes(rule({ rule: "cadence", types: ["PAC"], at: { bar: 3 } }), pac, 4, { key: C });
    expect(row.ok).toBe(true);
    await passes(rule({ rule: "cadence", types: ["HC"], at: { bar: 2 } }), pac, 4, { key: C });
    await fails(
      rule({ rule: "cadence", types: ["PAC", "IAC"], at: "last" }),
      'chords: chord("<C G F C>").voicing()\nbass: note("<c2 g2 f2 c2>")',
      4,
      { key: C },
    );
    await passes(
      rule({ rule: "cadence", types: ["PC"], at: "last" }),
      'chords: chord("<C G F C>").voicing()\nbass: note("<c2 g2 f2 c2>")',
      4,
      { key: C, totalBars: 4 },
    );
  });
  test("contains-rn V/vi resolving to vi (C7); an unresolved one does not count", async () => {
    const r = rule({ rule: "contains-rn", rn: ["V/V", "V/vi", "V/ii", "V/IV"], min: 1, mustResolve: true });
    await passes(r, 'chords: chord("<C E7 Am F>").voicing()', 4, { key: C });
    await fails(r, 'chords: chord("<C E7 F C>").voicing()', 4, { key: C });
  });
  test("contains-rn V then i in A minor (C4: the raised 7th)", async () => {
    await passes(
      rule({ rule: "contains-rn", rn: ["V"], min: 1, mustResolve: true }),
      'chords: chord("<Am Dm E Am>").voicing()',
      4,
      { key: { tonic: "A", mode: "minor" } },
    );
    await fails(
      rule({ rule: "contains-rn", rn: ["V"], min: 1, mustResolve: true }),
      'chords: chord("<Am Dm Em Am>").voicing()',
      4,
      { key: { tonic: "A", mode: "minor" } },
    );
  });
  test("chord-tones-strong on beats 1 and 3 (C2 ≥ 0.6)", async () => {
    const r = rule({
      rule: "chord-tones-strong",
      minRatio: 0.6,
      melody: "mel",
      harmony: "chords",
      strength: "strong",
    });
    await passes(r, 'chords: chord("<C F>").voicing()\nmel: note("<[c5 d5 e5 d5] [f5 g5 a5 g5]>")', 2);
    await fails(r, 'chords: chord("<C F>").voicing()\nmel: note("<[d5 e5 f5 e5] [g5 a5 b5 a5]>")', 2);
  });
  test("harmonic rhythm: one change per bar", async () => {
    const r = rule({ rule: "harmonic-rhythm", changesPerBar: [1, 1] });
    await passes(r, 'chords: chord("<C G Am F>").voicing()', 4);
    await fails(r, 'chords: chord("<[C G] [Am F]>").voicing()', 2);
  });
  test("blues-form: a standard 12-bar blues in F; a pop loop fails", async () => {
    const blues = 'chords: chord("<F7 F7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7>").voicing()';
    const row = await passes(rule({ rule: "blues-form", variant: "standard" }), blues, 12, {
      key: { tonic: "F", mode: "major" },
    });
    expect(row.value).toBe(1);
    await passes(
      rule({ rule: "blues-form", variant: "quick-change" }),
      blues.replace("<F7 F7", "<F7 Bb7"),
      12,
      { key: { tonic: "F", mode: "major" } },
    );
    await fails(
      rule({ rule: "blues-form", variant: "standard" }),
      'chords: chord("<F C Dm Bb>").voicing()',
      12,
      { key: { tonic: "F", mode: "major" } },
    );
  });
  test("voice-leading: C to F with common tone C moves ≤ 2 per voice; a parallel jump does not", async () => {
    const r = rule({ rule: "voice-leading", track: "chords", maxMovePerVoice: 2 });
    await passes(r, 'chords: note("<[c4,e4,g4] [c4,f4,a4]>")', 2);
    await fails(r, 'chords: note("<[c4,e4,g4] [f4,a4,c5]>")', 2);
  });
  test("guide-tones: a line on 3rds and 7th of a ii–V–I (JC1)", async () => {
    const r = rule({ rule: "guide-tones", track: "mel", harmony: "chords", minRatio: 0.7 });
    await passes(r, 'chords: chord("<Dm7 G7 C^7>").voicing()\nmel: note("<c5 b4 b4>")', 3);
    await fails(r, 'chords: chord("<Dm7 G7 C^7>").voicing()\nmel: note("<d5 g4 c5>")', 3);
  });
  test("register separation and no muddy low", async () => {
    await passes(
      rule({ rule: "register-separation", low: "bass", high: "mel", minGapSemis: 7 }),
      'bass: note("c2 g2")\nmel: note("c5 e5")',
    );
    await fails(
      rule({ rule: "register-separation", low: "bass", high: "mel", minGapSemis: 7 }),
      'bass: note("c3 g3")\nmel: note("a3 c4")',
    );
    await passes(rule({ rule: "no-muddy-low", track: "*" }), 'chords: note("[c2,g2,e3]")');
    await fails(rule({ rule: "no-muddy-low", track: "*" }), 'chords: note("[c2,e2,g2]")');
  });
  test("mode dorian with its ♮6 on strong beats (C6); a natural-minor vamp fails", async () => {
    const r = rule({ rule: "mode", tonic: "D", mode: "dorian", requireCharacteristic: true });
    await passes(r, 'chords: chord("<Dm7 G7>").voicing()\nmel: note("<[b4 a4 f4 d4] [b4 g4 a4 ~]>")', 4);
    await fails(r, 'chords: chord("<Dm7 Gm7>").voicing()\nmel: note("<[bb4 a4 f4 d4] [bb4 g4 a4 ~]>")', 4);
  });
  test("custom walking-bass (JC2) and ii-v-chain (JC1)", async () => {
    const walk = 'chords: chord("<F7 Bb7>").voicing()\nbass: note("<[f2 a2 c3 b2] [bb2 d3 f3 e2]>")';
    await passes(rule({ rule: "custom", fn: "walking-bass", params: { track: "bass" } }), walk, 2);
    await fails(
      rule({ rule: "custom", fn: "walking-bass", params: { track: "bass" } }),
      'chords: chord("<F7 Bb7>").voicing()\nbass: note("<[a2 a2] [d3 d3]>")',
      2,
    );
    const chain = 'chords: chord("<Dm7 G7 C^7 Em7 A7 Dm7 G7 C^7 Gm7 C7 F^7 F^7>").voicing()';
    const row = await passes(rule({ rule: "custom", fn: "ii-v-chain", params: { minKeys: 3 } }), chain, 12);
    expect(row.value).toBe(3);
    await fails(
      rule({ rule: "custom", fn: "ii-v-chain", params: { minKeys: 3 } }),
      'chords: chord("<Dm7 G7 C^7 C^7>").voicing()',
      4,
    );
    const { extra } = await fails(rule({ rule: "custom", fn: "nope" }), 'mel: note("c4")');
    expect(extra[0]?.id).toBe("rubric.unknown");
  });
  test("custom allowed-tensions (J2.L03, JC4): reads the MELODY against the chords (w7plan A4)", async () => {
    const r = rule({ rule: "custom", fn: "allowed-tensions", params: { minRatio: 0.85 } });
    const chords = 'chords: chord("<Dm7 G7 C^7 C^7>").voicing()';
    // The 9th over Dm7, the 13th over G7, the 9th and the ♯11 over Cmaj7: tensions the chords take.
    await passes(r, `${chords}\nmel: note("<e5 e5 d5 f#5>").s("piano")`, 4, { key: C });
    // A sustained C♯ over Cmaj7: outside the chord and its tensions (the pre-flight's counterexample).
    await fails(r, `${chords}\nmel: note("<e5 e5 c#5 c#5>").s("piano")`, 4, { key: C });
    // The 11th held over Cmaj7 (a half step above its 3rd): the avoid note.
    await fails(r, `${chords}\nmel: note("<e5 e5 f5 f5>").s("piano")`, 4, { key: C });
  });
  test("device-count (CF-A): a secondary dominant and a borrowed chord; ♭VII alone is modal colour", async () => {
    const r = rule({
      rule: "device-count",
      devices: ["secondary dominant", "borrowed chord", "modulation"],
      min: 2,
    });
    await passes(r, 'chords: chord("<C E7 Am Fm>").voicing()', 4, { key: C });
    // One event, one device (Wave 6): ♭VII with no other borrowed chord beside it is the Mixolydian colour.
    await fails(r, 'chords: chord("<C E7 Am Bb>").voicing()', 4, { key: C });
    await passes(
      rule({ rule: "device-count", devices: ["secondary dominant", "modal colour"], min: 2 }),
      'chords: chord("<C E7 Am Bb>").voicing()',
      4,
      { key: C },
    );
    await fails(r, 'chords: chord("<C G Am F>").voicing()', 4, { key: C });
  });
});

describe("form, contrast and key change (contracts §6.3, §6.8)", () => {
  const piece = (keyPlan: string, chorusBars = 8) => `setcpm(100/4)
const drumsVerse = s("bd ~ sd ~")
const drumsChorus = s("bd sd bd sd, hh*8")
const melVerse = n("<[0 2 4 2] [4 2 1 ~]>")
const melChorus = n("<[7 9 11 9] [11 ~ 9 ~]>")
drums: arrange([8, drumsVerse], [8, drumsChorus], [${chorusBars}, drumsChorus])
mel: arrange([8, melVerse], [8, melChorus], [${chorusBars}, melChorus]).scale("${keyPlan}").s("piano")`;
  test("form: names and letters; a tagged chorus2 matches chorus", async () => {
    const code = piece("C4:major");
    await passes(rule({ rule: "form", pattern: "verse chorus chorus" }), code, 24);
    await passes(rule({ rule: "form", pattern: "ABB" }), code, 24);
    await passes(rule({ rule: "form", pattern: "A?B" }), code, 24);
    await fails(rule({ rule: "form", pattern: "verse chorus verse chorus" }), code, 24);
    await passes(
      rule({ rule: "form", pattern: "verse chorus" }),
      code
        .replace(/melVerse/g, "melVerse")
        .replace("const melChorus", "const melChorus2")
        .replace(/\[8, melChorus\], \[8, melChorus\]/, "[8, melChorus2]")
        .replace(/\[8, drumsChorus\], \[8, drumsChorus\]/, "[8, drumsChorus2]")
        .replace("const drumsChorus =", "const drumsChorus2 ="),
      16,
    );
  });
  test("form fails with form.inconsistent-arrange when two tracks disagree (only that)", async () => {
    const bad = piece("C4:major").replace("mel: arrange([8, melVerse]", "mel: arrange([4, melVerse]");
    const { extra } = await fails(rule({ rule: "form", pattern: "verse chorus chorus" }), bad, 24);
    expect(extra.map((d) => d.id)).toEqual(["form.inconsistent-arrange"]);
  });
  test("contrast(chorus, verse) on pitch, density and energy", async () => {
    const r = rule({
      rule: "contrast",
      a: { section: "chorus" },
      b: { section: "verse" },
      axes: ["pitch", "density", "energy", "register"],
      minAxes: 2,
    });
    const row = await passes(r, piece("C4:major"), 24);
    expect(row.value).toBeGreaterThanOrEqual(3);
    const flat = `const melVerse = n("0 2 4 2")\nconst melChorus = n("0 2 4 2")\nmel: arrange([4, melVerse], [4, melChorus]).scale("C4:major")`;
    await fails(r, flat, 8);
  });
  test("key-change: the last chorus lifted +2 with the same degrees passes (C7); +5 or too short fails", async () => {
    const r = rule({ rule: "key-change", at: "last", semitones: [1, 2], minBarsAfter: 8, sameMelody: true });
    await passes(r, piece("<C4:major!16 D4:major!8>"), 24);
    await fails(r, piece("<C4:major!16 F4:major!8>"), 24);
    await fails(r, piece("<C4:major!16 D4:major!4>", 4), 20);
  });
  test("modulation up a step (kept rule for pivot modulations)", async () => {
    await passes(
      rule({ rule: "modulation", to: "up-step" }),
      'mel: n("<0 2 4 0>").scale("<C4:major!4 D4:major!4>")',
      8,
    );
    await fails(rule({ rule: "modulation", to: "up-step" }), 'mel: n("<0 2 4 0>").scale("C4:major")', 8);
  });
});

describe("matches", () => {
  test("the melody identical to the reference (JC4, AC1), reference evaluated by the caller", async () => {
    const ref = await strudel('mel: note("c4 e4 g4 e4")');
    const r = rule({
      rule: "matches",
      reference: { solutions: ['mel: note("c4 e4 g4 e4")'], bars: 1 },
      matcher: { m: "melody", pitch: "absolute", wPitch: 1, wRhythm: 0, rhythmTol: rat(0) },
      min: 1,
    });
    await passes(r, 'mel: note("c4 e4 g4 e4")\nchords: chord("C").voicing()', 1, {
      resolveReference: () => ref,
    });
    await fails(r, 'mel: note("c4 e4 a4 e4")', 1, { resolveReference: () => ref });
  });
});
