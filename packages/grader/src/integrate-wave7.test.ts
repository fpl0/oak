// Wave 7 integration (packages): the seams and the defects the builders and authors reported in the grader
// (scratchpad/w7/build-*.md apiNotes), each pinned here with the right answer, the wrong answer that uses the right
// function, and the probe the reporter ran. Music checked by running it (headless Strudel through `strudel()`).
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { AnswerUi, KeySpec, RubricRule } from "@oak/content-kit";
import { rat } from "@oak/content-kit";
import { strudel } from "./analyze/__support__/fixtures.ts";
import { normalizedFromEvents } from "./analyze/tracks.ts";
import { renderFeedback } from "./feedback/catalog.ts";
import { gradeAnswer } from "./grade/answers.ts";
import type { RubricContext } from "./rubric/context.ts";
import { evaluateRubric } from "./rubric/index.ts";
import type { SongMelodyNote } from "./types.ts";

setDefaultTimeout(30_000);
const C: KeySpec = { tonic: "C", mode: "major" };
const F_BLUES: KeySpec = { tonic: "F", mode: "blues" };
const EB: KeySpec = { tonic: "Eb", mode: "major" };

const rule = (body: Record<string, unknown>): RubricRule =>
  ({ id: "r", label: "rule", required: true, skills: [], ...body }) as unknown as RubricRule;
export async function check(
  r: RubricRule,
  code: string,
  bars: number,
  key: KeySpec | null = C,
  o: Partial<RubricContext> = {},
) {
  // As `normalize` hears it: silent parts and parts 24 dB under the loudest left out (capstone-wave7.test.ts).
  const raw = await strudel(code, bars);
  const peak = raw.all.reduce((m, e) => Math.max(m, e.gain), 0);
  const n = normalizedFromEvents(
    raw.all.filter((e) => e.gain > 0.01 && e.gain >= peak / 16),
    { cps: raw.cps },
  );
  for (const t of Object.keys(raw.byTrack)) n.byTrack[t] ??= [];
  const ctx: RubricContext = {
    meter: "4/4",
    code,
    params: {},
    bars,
    totalBars: bars,
    ...(key ? { key } : {}),
    ...o,
  };
  const out = evaluateRubric([r], n, ctx);
  const row = out.rows[0];
  return {
    ok: row?.ok ?? false,
    detail: String(row?.diag?.params.detail ?? ""),
    extra: out.extra,
  };
}

describe("chords are read where they are heard (build-author-J4a)", () => {
  const changes = 'const changes = "<Fm7 Bb7 Eb^7 Eb^7 Gm7 C7 Fm7 Bb7>"\n';
  const roots = 'bass: chord(changes).rootNotes(2).s("upright")\n';
  const comp = (tail: string) =>
    `chords: chord(changes).dict("lefthand").anchor("a4").voicing().struct("x ~ ~ x ~ ~ ~ ~")${tail}`;
  const RN = rule({ rule: "contains-rn", rn: ["iii7", "VI7", "ii7", "V7"], inOrder: true, min: 1 });
  test("contains-rn: the right chords comped pass; three other right answers pass", async () => {
    for (const tail of ['.s("rhodes").gain(.6)', '.s("piano")', '.s("rhodes").gain(.3)'])
      expect((await check(RN, changes + roots + comp(tail), 8, EB)).ok).toBe(true);
    const held = `${changes + roots}chords: chord(changes).voicing().s("rhodes")`;
    expect((await check(RN, held, 8, EB)).ok).toBe(true);
  });
  test("contains-rn: the right names on a silent comping line over a rootNotes() bass fail", async () => {
    const r = await check(RN, changes + roots + comp('.s("rhodes").gain(0)'), 8, EB);
    expect(r.ok).toBe(false);
  });
  test("blues-form: a jazz blues at .gain(0) over its roots fails; the comped one passes", async () => {
    const blues = 'const changes = "<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]>"\n';
    const form = rule({ rule: "blues-form", variant: "jazz" });
    expect((await check(form, blues + roots + comp('.s("rhodes")'), 12, F_BLUES)).ok).toBe(true);
    expect((await check(form, blues + roots + comp('.s("rhodes").gain(0)'), 12, F_BLUES)).ok).toBe(false);
  });
});

describe("a chord struck again is the same chord (build-workbench, build-tutor b)", () => {
  test("Charleston stabs on a ii–V–I read as three chords, and the ii–V resolves", async () => {
    const code =
      'chords: chord("<Dm7 G7 C^7 C^7>").voicing().struct("x ~ ~ x ~ ~ ~ ~").s("rhodes")\nbass: note("<d2 g2 c2 c2>").s("upright")';
    const r = rule({ rule: "contains-rn", rn: ["ii7", "V7", "Imaj7"], inOrder: true, min: 1 });
    expect((await check(r, code, 4)).ok).toBe(true);
  });
});

describe("the bar grid reads a jazz blues by quality, not by the last character (build-author-J4a)", () => {
  const grid: AnswerUi = {
    ui: "bar-grid",
    bars: 12,
    perRow: 4,
    entry: "symbol",
    qualities: ["7", "m7", "dim7"],
  };
  const JAZZ = "F7 Bb7 F7 Cm7 Bb7 Bo7 F7 D7 Gm7 C7 F7 C7".split(" ");
  test("a wrong quality in a jazz blues is not told 'every chord is a dominant seventh'", () => {
    const wrong = [...JAZZ];
    wrong[3] = "C7";
    const r = gradeAnswer(grid, { text: JAZZ }, { text: wrong }, { key: F_BLUES });
    expect(r.score).toBeCloseTo(11 / 12);
    const text = renderFeedback(r.diagnostics[0] as Parameters<typeof renderFeedback>[0]);
    expect(text).not.toContain("every chord of this blues is a dominant seventh");
    expect(text).toContain("a minor seventh");
  });
  test("a jazz blues' bar 9 is not told 'Bar 9 is the high point: V'", () => {
    const wrong = [...JAZZ];
    wrong[8] = "Am7";
    const r = gradeAnswer(grid, { text: JAZZ }, { text: wrong }, { key: F_BLUES });
    const text = renderFeedback(r.diagnostics[0] as Parameters<typeof renderFeedback>[0]);
    expect(text).not.toContain("high point");
  });
  test("the all-dominant twelve-bar blues still gets its sentences", () => {
    const STD = "F7 F7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7".split(" ");
    const wrong = [...STD];
    wrong[4] = "F7";
    const r = gradeAnswer(grid, { text: STD }, { text: wrong }, { key: F_BLUES });
    const text = renderFeedback(r.diagnostics[0] as Parameters<typeof renderFeedback>[0]);
    expect(text).toContain("bar 5 moves to IV");
  });
});

describe("blues-form under a jazz brief says the jazz chart (build-author-capstones-jazz-a)", () => {
  test("U11's blues under variant jazz: bar 8 should move to VI7 (D7), with no contradiction", async () => {
    const u11 = 'chords: chord("<F7 Bb7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7>").voicing().s("piano")';
    const r = await check(rule({ rule: "blues-form", variant: "jazz" }), u11, 12, F_BLUES);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("bar 8 of a jazz blues should move to VI7 (D7); it is I7 (F7) (and 2 more bars)");
    const text = renderFeedback(r.extra.find((d) => d.id === "harmony.blues-bar") as never);
    expect(text).toBe("Bar 8 of the blues should be VI7 (D7); yours is I7 (F7).");
  });
  test("the jazz chart itself passes; a jazz blues with bar 9 left on V fails at bar 9", async () => {
    const jazz = (c: string) => `chords: chord("<${c}>").voicing().s("piano")`;
    const JAZZ = "F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]";
    expect((await check(rule({ rule: "blues-form", variant: "jazz" }), jazz(JAZZ), 12, F_BLUES)).ok).toBe(
      true,
    );
    const r = await check(
      rule({ rule: "blues-form", variant: "jazz" }),
      jazz(JAZZ.replace("D7 Gm7", "D7 C7")),
      12,
      F_BLUES,
    );
    expect(r.detail).toStartWith("bar 9 of a jazz blues should move to ii7 (Gm7)");
  });
});

describe("blues-form with two choruses refuses the same chorus twice (build-author-capstones-jazz-a)", () => {
  const JAZZ = "F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]";
  const HEAD = "<a4 ab4 a4 [g4 a4] bb4 b4 c5 [c5 b4] bb4 g4 f4 [d4 e4]>";
  const piece = (second: string) =>
    `const comp = chord("<${JAZZ}>").voicing().s("piano")\nconst head = note("${HEAD}").s("vibes")\n` +
    `const head2 = note("${second}").s("vibes")\n` +
    "chords: arrange([12, comp], [12, comp])\nmel: arrange([12, head], [12, head2])";
  const FORM = rule({ rule: "blues-form", variant: "jazz", choruses: 2 });
  test("the head twice, note for note, fails; a second chorus with its own line passes", async () => {
    const same = await check(FORM, piece(HEAD), 24, F_BLUES);
    expect(same.ok).toBe(false);
    expect(same.detail).toContain("the second plays the first again note for note");
    for (const line of [
      "<c5 bb4 a4 [g4 a4] d5 b4 c5 [c5 a4] bb4 g4 f4 [d4 e4]>",
      "<a4 ab4 a4 [g4 a4] bb4 b4 c5 [c5 b4] bb4 g4 f4 [e4 f4]>",
      "<f4 ab4 a4 [g4 a4] bb4 b4 c5 [c5 b4] bb4 g4 f4 [d4 e4]>",
    ])
      expect((await check(FORM, piece(line), 24, F_BLUES)).ok).toBe(true);
  });
});

describe("song-melody-kept: one pass of the piece, and a swung tune is the same tune (build-author-capstones-sound)", () => {
  const NAMES = ["c5", "c#5", "d5", "d#5", "e5"];
  // A 32-bar stand-in song: in every bar a note on 1, one on the "and" of 2, one on 3.
  const song: SongMelodyNote[] = Array.from({ length: 32 }, (_, b) => [
    { onset: rat(b), dur: rat(1, 4), midi: 72 + (b % 5) },
    { onset: rat(8 * b + 3, 8), dur: rat(1, 8), midi: 74 },
    { onset: rat(2 * b + 1, 2), dur: rat(1, 4), midi: 76 },
  ]).flat();
  const bar = (b: number, first = NAMES[b % 5]) => `[${first} ~ ~ d5 e5 ~ ~ ~]`;
  const line = (bars: number, f: (b: number) => string = (b) => bar(b)) =>
    `<${Array.from({ length: bars }, (_, b) => f(b)).join(" ")}>`;
  const KEPT = rule({ rule: "custom", fn: "song-melody-kept", params: { pitch: "absolute" } });
  const run = (code: string, totalBars: number) => check(KEPT, code, 32, C, { songMelody: song, totalBars });
  test("the whole song passes; a 16-bar version (A and B only) passes on its own 16 bars", async () => {
    expect((await run(`mel: note("${line(32)}").s("piano")`, 32)).ok).toBe(true);
    const sixteen = await run(`const a = note("${line(16)}").s("piano")\nmel: arrange([16, a])`, 16);
    expect(sixteen.ok).toBe(true);
  });
  test("swung with .swingBy(1/3, 4), .swingBy(.2, 4) or .swingBy(1/4, 4): still the song's tune", async () => {
    for (const sw of ["1/3", ".2", "1/4"])
      expect((await run(`mel: note("${line(32)}").swingBy(${sw}, 4).s("piano")`, 32)).ok).toBe(true);
  });
  test("swung with one note changed fails; the on-beat notes moved an 8th late fail", async () => {
    const changed = line(32, (b) => (b === 5 ? bar(b, "g5") : bar(b)));
    const r = await run(`mel: note("${changed}").swingBy(1/3, 4).s("piano")`, 32);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("bar 6");
    const late = line(32, (b) => `[~ ${NAMES[b % 5]} ~ d5 ~ e5 ~ ~]`);
    expect((await run(`mel: note("${late}").s("piano")`, 32)).ok).toBe(false);
  });
});

describe("onsets perBar counts the bars of an arranged piece, not the silence after it (build-author-capstones-rhythm)", () => {
  const TRES = rule({
    rule: "onsets",
    track: "bass",
    perBar: true,
    contains: [rat(0), rat(3, 8), rat(3, 4)],
  });
  const tres = "[c2 ~ ~ c2 ~ ~ c2 ~]";
  test("eight bars of tresillo and then nothing (an 8-bar arrange() under a 16-bar render) pass", async () => {
    const r = await check(TRES, `bass: note("<${`${tres} `.repeat(8)}${"~ ".repeat(8)}>")`, 16, null, {
      totalBars: 8,
    });
    expect(r.ok).toBe(true);
  });
  test("four bars of tresillo and four of straight 8ths fail; a loop that keeps playing past totalBars is still read", async () => {
    const half = `bass: note("<${`${tres} `.repeat(4)}${"[c2 c2 c2 c2] ".repeat(4)}${"~ ".repeat(8)}>")`;
    const r = await check(TRES, half, 16, null, { totalBars: 8 });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/^right in 4 of 8 bars; /);
    const loop = `bass: note("<${`${tres} `.repeat(8)}${"[c2 c2 c2 c2] ".repeat(8)}>")`;
    expect((await check(TRES, loop, 16, null, { totalBars: 8 })).detail).toMatch(/^right in 8 of 16 bars; /);
  });
});

describe("a bar comped on 2 and 4 is still that bar's chord (build-author-capstones-jazz-b, JC3's bridge)", () => {
  const BRIDGE = rule({
    rule: "progression",
    rn: ["III7", "III7", "VI7", "VI7", "II7", "II7", "V7", "V7"],
    bars: [1, 8],
  });
  const BB: KeySpec = { tonic: "Bb", mode: "major" };
  const bass = 'bass: note("<d2 d2 g1 g1 c2 c2 f1 f1>").s("upright")';
  const comp = (rhythm: string, changes = "<D7 D7 G7 G7 C7 C7 F7 F7>") =>
    `chords: chord("${changes}").voicing().struct("${rhythm}").s("rhodes")\n${bass}`;
  test("on 2 and 4, on the Charleston, held, and on 1 and 3: the bridge's changes, two bars each", async () => {
    for (const rhythm of ["~ x ~ x", "x ~ ~ x ~ ~ ~ ~", "x", "x ~ x ~", "~ x ~ x ~ x ~ x"])
      expect([rhythm, (await check(BRIDGE, comp(rhythm), 8, BB)).ok]).toEqual([rhythm, true]);
  });
  test("on 2 and 4 with a second chord crowding a bar, or one bar a chord: not the bridge", async () => {
    const crowded = await check(BRIDGE, comp("~ x ~ x", "<D7 [D7 A7] G7 G7 C7 C7 F7 F7>"), 8, BB);
    expect(crowded.ok).toBe(false);
    const quick = await check(BRIDGE, comp("~ x ~ x", "<D7 G7 C7 F7 D7 G7 C7 F7>"), 8, BB);
    expect(quick.ok).toBe(false);
  });
});

describe("sound controls read what superdough plays (build-author-A1a, A1b; the A spec's FM silencer)", () => {
  const PARTIALS = rule({
    rule: "custom",
    fn: "control-set",
    params: { control: "partials", above: 1, call: "partials" },
  });
  test("partials: more than one harmonic on a sawtooth, square, triangle or user wave passes", async () => {
    for (const code of [
      'mel: note("c4 e4").s("sawtooth").partials([1, 1, 1, 1])',
      'mel: note("c4 e4").s("square").partials([1, 0, 1])',
      'mel: note("c4 e4").s("triangle").partials([1, .5, .5])',
      'mel: note("c4 e4").s("user").partials([1, .3])',
    ])
      expect([code, (await check(PARTIALS, code, 1)).ok]).toEqual([code, true]);
  });
  test("partials on a sine, even harmonics only on a square, or on a sample: one or none heard, fails", async () => {
    for (const code of [
      'mel: note("c4 e4").s("sine").partials([1, 1, 1, 1])',
      'mel: note("c4 e4").s("square").partials([1, 1])',
      'mel: note("c4 e4").s("piano").partials([1, 1, 1])',
    ])
      expect([code, (await check(PARTIALS, code, 1)).ok]).toEqual([code, false]);
  });
  test("the controls matcher reads `fm` as `fmi`, and FM on a sample as no FM", async () => {
    const { controlValue, CONTROL_KEYS } = await import("./match/controls.ts");
    expect(CONTROL_KEYS.fm).toBe("fmi");
    const synth = (await strudel('mel: note("c4").s("sine").fm(3).fmh(2)', 1)).all[0];
    const sample = (await strudel('mel: note("c4").s("piano").fm(3).fmh(3.5)', 1)).all[0];
    expect(controlValue(synth as never, "fmi", 1)).toBe(3);
    expect(controlValue(sample as never, "fmi", 1)).toBeNull();
    expect(controlValue(sample as never, "fmh", 1)).toBeNull();
  });
});

describe("slices-reordered counts the pieces the sample is cut into (build-author-A2b, A.CP)", () => {
  const CHOP = rule({ rule: "custom", fn: "slices-reordered", params: { minSlices: 4 } });
  test("cut in four, a kick repeated or two pieces swapped: passes", async () => {
    for (const order of ["0 1 0 3", "0 2 1 3", "3 2 1 0", "0 3 2 3"])
      expect([order, (await check(CHOP, `brk: s("breaks165").slice(4, "${order}")`, 1)).ok]).toEqual([
        order,
        true,
      ]);
  });
  test("cut in four and played in its own order, or cut in two: fails", async () => {
    expect((await check(CHOP, 'brk: s("breaks165").slice(4, "0 1 2 3")', 1)).ok).toBe(false);
    expect((await check(CHOP, 'brk: s("breaks165").slice(2, "1 0")', 1)).ok).toBe(false);
  });
});

describe("allowed-tensions and reharmonize hear the chords, not the names (build-author-J5a, J5b)", () => {
  const changes = 'const changes = "<Dm7 G7 C^7 C^7>"\n';
  const roots = 'bass: chord(changes).rootNotes(2).s("upright")\n';
  const chords = (tail: string) => `chords: chord(changes).voicing().s("rhodes")${tail}\n`;
  const TENS = rule({ rule: "custom", fn: "allowed-tensions", params: { minRatio: 0.85 } });
  test("allowed-tensions: tensions over heard chords pass; the same tune over silent chords fails", async () => {
    for (const mel of ['mel: note("<e5 e5 d5 f#5>").s("vibes")', 'mel: note("<f5 b4 e5 g5>").s("vibes")'])
      expect((await check(TENS, changes + roots + chords("") + mel, 4)).ok).toBe(true);
    const silent = await check(
      TENS,
      `${changes + roots + chords(".gain(0)")}mel: note("<e5 e5 d5 f#5>").s("vibes")`,
      4,
    );
    expect(silent.ok).toBe(false);
    expect(silent.detail).toBe("no chords under the tune's notes yet");
  });
  test("reharmonize: new colours heard pass; the same colours on a silent chords line fail", async () => {
    const TUNE = 'mel: n("<[0 3 2 3] [4 1 4@2] [3 2 1 2] [3@4]>").scale("C4:major").s("piano")';
    const piece = (c: string, tail = "") =>
      `setcpm(84/4)\nconst changes = "<${c}>"\nchords: chord(changes).voicing().s("piano")${tail}\nbass: chord(changes).rootNotes(2).s("upright")\n${TUNE}`;
    const ORIGINAL = piece("C Dm G C");
    const n0 = await strudel(ORIGINAL, 4);
    const R = rule({
      rule: "reharmonize",
      melody: "mel",
      reference: { solutions: [ORIGINAL], bars: 4 },
      min: 2,
      kinds: ["borrowed", "secondary-dominant"],
    });
    const o = { resolveReference: () => n0 };
    expect((await check(R, piece("C D7 G [Ab Bb]"), 4, C, o)).ok).toBe(true);
    expect((await check(R, piece("C D7 G [Ab Bb]", ".gain(0)"), 4, C, o)).ok).toBe(false);
  });
});

describe("ii-v-chain counts target keys, tonic and mode (contracts §6.6 JC1; build-author-capstones-jazz-a asked)", () => {
  const CHAIN = rule({ rule: "custom", fn: "ii-v-chain", params: { minKeys: 3 } });
  const play = (c: string) => `chords: chord("<${c}>").voicing().s("rhodes")`;
  test("C major, C minor and F major are three keys; three ii–Vs into two keys fail", async () => {
    const three = await check(CHAIN, play("Dm7 G7 C^7 C^7 Dm7b5 G7b9 Cm7 Cm7 Gm7 C7 F^7 F^7"), 12);
    expect(three.ok).toBe(true);
    const two = await check(CHAIN, play("Dm7 G7 C^7 C^7 Gm7 C7 F^7 F^7 Dm7 G7 C^7 C^7"), 12);
    expect(two.ok).toBe(false);
    expect(two.detail).toContain("2 keys");
    for (const c of [
      "Dm7 G7 C^7 C^7 Fm7 Bb7 Eb^7 Eb^7 Bm7b5 E7alt Am7 Am7",
      "Dm7 G7 C^7 C^7 Gm7 C7 F^7 F^7 Am7 D7 G^7 G^7",
      "Em7 A7 Dm7 G7 C^7 C^7 Fm7 Bb7",
    ])
      expect([c, (await check(CHAIN, play(c), 12)).ok]).toEqual([c, true]);
  });
});

describe("voicingShapeOf: a close or drop-2 voicing holds the chord's own notes (build-author-J3a)", () => {
  const Dm7 = { root: 2, third: 5, fifth: 9, seventh: 0 };
  test("Dm7 drop-2 in two inversions and close position read as such", async () => {
    const { voicingShapeOf } = await import("@oak/content-kit");
    expect(voicingShapeOf([57, 62, 65, 72], Dm7)).toBe("drop-2");
    expect(voicingShapeOf([60, 65, 69, 74], Dm7)).toBe("drop-2");
    expect(voicingShapeOf([62, 65, 69, 72], Dm7)).toBe("close");
  });
  test("A D G C (no F) is not a Dm7 drop-2; D F G C (no A) is not a close Dm7", async () => {
    const { voicingShapeOf } = await import("@oak/content-kit");
    expect(voicingShapeOf([57, 62, 67, 72], Dm7)).toBeNull();
    expect(voicingShapeOf([62, 65, 67, 72], Dm7)).toBeNull();
  });
});

describe("an unknown chord spelling is told its Strudel spelling, never itself (build-author-J2b, J4a)", () => {
  test("Cdom7, Fmin9, Dmin11 and Cmi7 suggest C7, Fm9, Dm11 and Cm7", async () => {
    const { checkChord } = await import("./lint/chords.ts");
    expect(["Cdom7", "Fmin9", "Dmin11", "Cmi7", "Gdom13"].map((s) => checkChord(s).suggest)).toEqual([
      "C7",
      "Fm9",
      "Dm11",
      "Cm7",
      "G13",
    ]);
    // A right spelling suggests nothing.
    expect(checkChord("Fm9").suggest).toBeNull();
  });
});

describe("uses tb.mini.euclid counts a rotated x(k,n,r) (build-author-capstones-rhythm, RC2)", () => {
  test("cb(5,16,10) and a rotated bell are rhythms written with (k,n); hand-written steps are not", async () => {
    const { toolsUsed } = await import("./lint/oak.ts");
    const { TOOLBOX } = await import("./lint/toolbox.test-data.ts");
    const USES = rule({ rule: "uses", tool: "tb.mini.euclid" });
    const o = { toolsUsed: (code: string) => toolsUsed(code, TOOLBOX) };
    for (const code of ['bell: s("cb(5,16,10)")', 'bell: s("cb(3,8)")', 'bell: s("rim(3,8,2)")'])
      expect([code, (await check(USES, code, 1, null, o)).ok]).toEqual([code, true]);
    expect((await check(USES, 'bell: s("cb ~ ~ cb ~ ~ cb ~")', 1, null, o)).ok).toBe(false);
  });
});

describe("polyrhythm and polymeter-cycle (build-author-R2c)", () => {
  const POLY = rule({ rule: "polyrhythm", a: "a", b: "b", ratio: [3, 2], minBars: 4 });
  test("a one-bar or two-bar loop of 3 against 2 heard for four bars passes minBars 4", async () => {
    for (const code of ['a: s("rim*3")\nb: s("bd*2")', 'a: s("<rim*3 [rim rim rim]>")\nb: s("bd*2")'])
      expect([
        code,
        (await check(POLY, code, 4, null, { totalBars: code.includes("<") ? 2 : 1 })).ok,
      ]).toEqual([code, true]);
  });
  test("alternating bars still fail; a one-bar loop heard for one bar fails minBars 4", async () => {
    const turns = await check(POLY, 'a: s("<rim*3 ~>")\nb: s("<~ bd*2>")', 4, null, { totalBars: 2 });
    expect(turns.ok).toBe(false);
    expect((await check(POLY, 'a: s("rim*3")\nb: s("bd*2")', 1, null, { totalBars: 1 })).ok).toBe(false);
  });
  const PM = rule({ rule: "custom", fn: "polymeter-cycle", params: { a: "a", b: "b" } });
  test("a cycle of a whole number of bars fails; one that crosses the bar line passes", async () => {
    for (const code of ['a: s("<bd ~>")\nb: s("hh*4")', 'a: s("{bd ~ ~ ~ ~ ~ ~ ~}%4")\nb: s("hh*4")'])
      expect([code, (await check(PM, code, 6, null)).ok]).toEqual([code, false]);
    for (const code of ['a: s("{bd ~ ~}%4")\nb: s("hh*4")', 'a: s("{bd ~ sd ~ ~}%4")\nb: s("hh*8")'])
      expect([code, (await check(PM, code, 6, null)).ok]).toEqual([code, true]);
  });
});

describe("a form written over wrapped consts reads its sections (build-author-J4b, JC3)", () => {
  test("arrange([8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)]) is AABA; A B A B is not", async () => {
    const { sectionsFromAst } = await import("./analyze/sections.ts");
    const { formMatches } = await import("./analyze/form.ts");
    const read = (form: string) => {
      const s = sectionsFromAst(
        `const A = "<C D>"\nconst A3 = "<C E>"\nconst B = "<F G>"\nchords: arrange(${form}).voicing()`,
      );
      return s && "sections" in s ? s.sections : [];
    };
    const aaba = read("[8, chord(A)], [8, chord(A)], [8, chord(B)], [8, chord(A3)]");
    expect(aaba.map((x) => x.label)).toEqual(["a", "a", "b", "a"]);
    expect(formMatches("AABA", aaba)).toBe(true);
    expect(formMatches("AABA", read("[8, chord(A)], [8, chord(B)], [8, chord(A)], [8, chord(B)]"))).toBe(
      false,
    );
    // A chain after the call names the same const; a literal names none.
    expect(read('[8, chord(A).voicing()], [8, note("c d")]').map((x) => x.label)).toEqual(["a", "rest"]);
  });
});

describe("feelView reads swung 8ths, not 16th pushes (build-tutor (a))", () => {
  test("a swung 8th line reads about 2:1; a straight 16th funk line and cb(5,16,2) read no 8th swing", async () => {
    const { feelView } = await import("./analyze/wave7-views.ts");
    const view = async (code: string) => feelView(await strudel(code, 2), { meter: "4/4", tracks: ["x"] })[0];
    expect((await view('x: s("hh*8").swingBy(1/3, 4)'))?.swingRatio).toBeCloseTo(2, 1);
    expect((await view('x: s("hh*8")'))?.swingRatio).toBeCloseTo(1, 5);
    for (const code of ['x: note("e2 ~ ~ e3 ~ ~ e2 ~ e2 ~ ~ e3 ~ ~ e2 e2").s("bass")', 'x: s("cb(5,16,2)")'])
      expect([code, (await view(code))?.swingRatio]).toEqual([code, null]);
  });
});

describe("tensionView names a chord tone the voicing leaves out as a chord tone (build-workbench, build-capstone)", () => {
  test("A over a D–F–C shell of Dm7 is a chord tone; E over it is the 9; C# over it is outside", async () => {
    const { tensionView } = await import("./analyze/wave7-views.ts");
    const code = (mel: string) =>
      `chords: note("[d3,f3,c4]").s("piano")\nmel: note("${mel}").s("vibes")\nsym: chord("Dm7").voicing().s("piano").gain(.5)`;
    const roleOf = async (mel: string) =>
      tensionView(await strudel(code(mel), 1), { meter: "4/4", melody: "mel" })[0]?.role;
    expect(await roleOf("a4")).toBe("chord-tone");
    expect(await roleOf("e5")).toBe("9");
  });
});
