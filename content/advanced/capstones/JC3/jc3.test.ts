// JC3 Rhythm-Changes Contrafact (contracts §6.6 JC3, content/specs/J5.md): the brief of content/capstones.ts graded
// through the real grader in capstone mode, the way the capstone workspace grades it, with the model head passed as
// `GradeContext.songMelody` (the host reads it from I Got Rhythm's answer key).
//   - The model: until author:repertoire's answer key for song.i-got-rhythm exists, a STAND-IN head written for this
//     test (Oak's own riff tune on rhythm changes, 32 bars), never served. Once the key exists, the last block grades
//     the reference against the real head and the real head as a learner's tune.
//   - Every graded claim is a piece: the reference and three other right heads pass every required line (one per
//     shipped flavour's sounds); the model's own head, a bridge of one bar a chord, a VI7 in the A, a bridge tune on
//     roots, a muted tune, 24 bars and the starter each fail exactly the lines named.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CapstoneDef, GradeResult, SongDef } from "@oak/content-kit";
import { R, stripMarkers } from "@oak/content-kit";
import * as grader from "@oak/grader";
import {
  CAPSTONE_LINER_PROMPTS,
  CAPSTONE_LINER_SEEDS,
  capstoneById,
  JC3_CHANGES_A,
  JC3_CHANGES_B,
  JC3_CHANGES_BY_BAR,
  JC3_STAND_IN,
  JC3_TEMPLATE,
} from "../../../capstones.ts";
import { toolbox } from "../../../toolbox.ts";
import { evaluate, lint, unlockedFor } from "../../../validate/harness.ts";

setDefaultTimeout(180_000);

const jc3 = capstoneById.get("JC3") as CapstoneDef;
const brief = jc3.brief as NonNullable<CapstoneDef["brief"]>;

beforeAll(async () => {
  await grader.initRealm({ toolbox: [...toolbox], lockdown: false });
});

/** A melody as the host passes it: evaluated once, note by note (app/src/capstone/song-melody.ts). */
async function melodyNotes(code: string, bars: number): Promise<grader.SongMelodyNote[]> {
  const ev = await grader.evaluateForGrading(code, { mode: "capstone", bars, lint: null, meter: "4/4" });
  if (!ev.ok) throw new Error(ev.error.message);
  const n = grader.normalize(ev, { meter: "4/4" });
  return Object.values(n.byTrack)
    .flat()
    .filter((e) => e.midi !== null && R.toNum(e.onset) < bars - 1e-9)
    .sort((a, b) => R.cmp(a.onset, b.onset) || (a.midi as number) - (b.midi as number))
    .map((e) => ({ onset: e.onset, dur: e.dur, midi: e.midi as number }));
}

function grade(code: string, songMelody?: readonly grader.SongMelodyNote[]): Promise<GradeResult> {
  return grader.gradeExercise({
    exercise: brief,
    response: { code },
    ctx: {
      exerciseGlobalId: "JC3/brief",
      mode: "capstone",
      key: { tonic: "Bb", mode: "major" },
      meter: "4/4",
      bpm: 160,
      swing: { subdivision: 8, amount: 1 / 3 },
      ...(songMelody ? { songMelody } : {}),
      params: {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0,
      tutorHints: 0,
      extraReplays: 0,
      lint: {
        profile: "graded",
        unlocked: unlockedFor("JC3.S1"),
        allowPreview: false,
        meter: "4/4",
        key: null,
      },
    },
  });
}
const failing = (r: GradeResult): string[] =>
  (r.rubric ?? [])
    .filter((x) => x.required && !x.ok)
    .map((x) => x.ruleId)
    .sort();
const detail = (r: GradeResult, id: string): string =>
  String((r.rubric ?? []).find((x) => x.ruleId === id)?.diag?.params.detail ?? "");
const explain = (r: GradeResult): string =>
  (r.rubric ?? [])
    .filter((x) => x.required && !x.ok)
    .map((x) => `${x.ruleId}: ${detail(r, x.ruleId)}`)
    .join("\n");

// --- the pieces -------------------------------------------------------------------------------------------------

interface Head {
  bpm?: number;
  /** Chord symbols of the A section and the bridge (the changes the tracks play). */
  changesA?: string;
  changesB?: string;
  bassA?: string;
  bassB?: string;
  compA?: string;
  compB?: string;
  melA: string;
  melB: string;
  /** A last A of its own (`melA2`): the head ends differently. */
  melA2?: string;
  sounds?: { chords: string; bass: string; lead: string };
  /** Bars per section: 8 (32 bars), or a shorter form for the failing pieces. */
  form?: ("A" | "B")[];
  melTail?: string;
}
/** A head on rhythm changes in B♭, laid out as JC3_TEMPLATE lays it out, every track arranged A A B A. */
function head(h: Head): string {
  const s = h.sounds ?? { chords: "rhodes", bass: "upright", lead: "mutetpt" };
  const form = h.form ?? ["A", "A", "B", "A"];
  const lastA = form.lastIndexOf("A");
  const sec = (role: string) =>
    form.map((x, i) => `[8, ${role}${x}${h.melA2 && role === "mel" && i === lastA ? "2" : ""}]`).join(", ");
  return [
    `setcpm(${h.bpm ?? 160}/4)`,
    "",
    `const changesA = "${h.changesA ?? JC3_CHANGES_A}"`,
    `const changesB = "${h.changesB ?? JC3_CHANGES_B}"`,
    `const bassA = note("${h.bassA ?? "<[bb1 g1] [c2 f1] [bb1 g1] [c2 f1] [bb1 d2] [eb2 eb2] [bb1 f1] [bb1 f1]>"}")`,
    `const bassB = note("${h.bassB ?? "<[d2 a1] [d2 f#1] [g1 d2] [g1 b1] [c2 g1] [c2 e2] [f1 c2] [f1 a1]>"}")`,
    `const chordsA = chord(changesA).dict("lefthand").voicing().struct("${h.compA ?? "[x ~ ~ x]*2"}")`,
    `const chordsB = chord(changesB).dict("lefthand").voicing().struct("${h.compB ?? "x ~ ~ x ~ ~ ~ ~"}")`,
    `const melA = note("${h.melA}")`,
    ...(h.melA2 ? [`const melA2 = note("${h.melA2}")`] : []),
    `const melB = note("${h.melB}")`,
    "",
    'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")',
    'hats: s("~ hh ~ hh").bank("jazzkit")',
    `bass: arrange(${sec("bass")}).s("${s.bass}").lpf(900)`,
    `chords: arrange(${sec("chords")}).swingBy(1/3, 4).s("${s.chords}").gain(.6)`,
    `mel: arrange(${sec("mel")}).swingBy(1/3, 4).s("${s.lead}")${h.melTail ?? ""}`,
  ].join("\n");
}

/**
 * The reference (J5.md): the A lands on the 3rd of B♭ and of Gm7, the 3rd of Cm7 and the root of F7, the 3rd of
 * E♭m7 (G♭) in bar 6; the bridge lands on F♯, B, E and A, the 3rds of D7, G7, C7 and F7, each two bars long.
 */
const REF_A =
  "<[d5 ~ bb4 d5] [eb5 ~ f5 ~] [d5 ~ bb4 g4] [c5 ~ ~ a4] [bb4 ~ d5 ~] [eb5 ~ gb5 ~] [f5 ~ eb5 ~] [d5 ~ ~ ~]>";
const REF_B =
  "<[f#5 ~ ~ ~] [e5 d5 c5 a4] [b4 ~ ~ ~] [a4 g4 f4 d4] [e5 ~ ~ ~] [d5 c5 bb4 g4] [a4 ~ ~ ~] [c5 ~ ~ ~]>";
const REFERENCE = head({ melA: REF_A, melB: REF_B });

/** An eighth-note line (indie: jazz guitar): arpeggios up from each chord's 3rd, the bridge on its 7ths. */
const BOP_A =
  "<[d5 f5 a5 f5 g5 f5 d5 bb4] [eb5 g5 bb5 g5 a5 g5 f5 eb5] [d5 f5 a5 f5 bb5 a5 g5 f5] [eb5 d5 c5 bb4 a4 c5 eb5 ~] [d5 ~ f5 d5 ab5 ~ f5 d5] [g5 ~ eb5 bb4 gb5 ~ eb5 bb4] [f5 d5 bb4 d5 eb5 c5 a4 ~] [bb4 ~ ~ ~ ~ ~ ~ ~]>";
const BOP_B =
  "<[c5 ~ ~ ~ a4 c5 d5 f#5] [a5 ~ f#5 d5 c5 ~ ~ ~] [f5 ~ ~ ~ d5 f5 g5 b5] [d6 ~ b5 g5 f5 ~ ~ ~] [bb4 ~ ~ ~ g4 bb4 c5 e5] [g5 ~ e5 c5 bb4 ~ ~ ~] [eb5 ~ ~ ~ c5 eb5 f5 a5] [c6 ~ a5 f5 eb5 ~ ~ ~]>";

/** A riff head (pop: piano): one two-bar riff answered, the bridge in long notes on the 3rds, a new last A. */
const RIFF_A =
  "<[bb4 d5 ~ f5] [eb5 ~ c5 ~] [bb4 d5 ~ f5] [g5 ~ f5 ~] [d5 f5 ~ bb5] [g5 ~ gb5 ~] [f5 ~ d5 c5] [bb4 ~ ~ ~]>";
const RIFF_A2 =
  "<[bb4 d5 ~ f5] [eb5 ~ c5 ~] [bb4 d5 ~ f5] [g5 ~ f5 ~] [d5 f5 ~ bb5] [g5 ~ gb5 ~] [f5 ~ eb5 c5] [d5 ~ ~ ~]>";
const RIFF_B =
  "<[f#4 ~ ~ ~] [a4 ~ c5 ~] [b4 ~ ~ ~] [d5 ~ f5 ~] [e5 ~ ~ ~] [g5 ~ bb5 ~] [a5 ~ ~ ~] [eb5 ~ c5 ~]>";

/** The stand-in model head (test only): a riff of its own in every A, the bridge in half notes from each 3rd. */
const MODEL_A =
  "<[bb4 c5 d5 f5] [g5 ~ ~ ~] [g5 f5 d5 c5] [bb4 ~ ~ ~] [bb4 c5 d5 f5] [g5 ~ ~ ~] [f5 d5 c5 d5] [bb4 ~ ~ ~]>";
const MODEL_B =
  "<[f#4 ~ a4 ~] [c5 ~ a4 ~] [b4 ~ d5 ~] [f5 ~ d5 ~] [e5 ~ g4 ~] [bb4 ~ g4 ~] [a4 ~ c5 ~] [eb5 ~ c5 ~]>";
const MODEL_CODE = `setcpm(160/4)\n\nconst melA = note("${MODEL_A}")\nconst melB = note("${MODEL_B}")\n\nmel: arrange([8, melA], [8, melA], [8, melB], [8, melA])`;

let MODEL: grader.SongMelodyNote[] = [];
beforeAll(async () => {
  MODEL = await melodyNotes(MODEL_CODE, 32);
});

describe("the brief", () => {
  test("seven required lines, the bridge two bars a chord from bar 17, the model read as `songMelody`", () => {
    expect(brief.rubric.map((r) => [r.id, r.rule, r.required])).toEqual([
      ["form", "form", true],
      ["bars", "bars", true],
      ["a-changes", "progression", true],
      ["bridge", "progression", true],
      ["chord-tones", "chord-tones-strong", true],
      ["bridge-guides", "guide-tones", true],
      ["original", "custom", true],
      ["tempo", "tempo-bpm", false],
      // Oak 2.0 W4 F1: the book's ending, seam, once-only and arc lines as suggestions (no skills, never block).
      ["ending", "custom", false],
      ["seam", "custom", false],
      ["once", "custom", false],
      ["arc", "custom", false],
    ]);
    expect(brief.rubric.find((r) => r.id === "bridge")).toMatchObject({
      rn: ["III7", "III7", "VI7", "VI7", "II7", "II7", "V7", "V7"],
      bars: [17, 24],
    });
    expect(brief.rubric.find((r) => r.id === "original")).toMatchObject({
      fn: "contrafact",
      params: { changesMinRatio: 0.85, maxSharedRatio: 0.25 },
    });
    expect(JC3_CHANGES_BY_BAR).toHaveLength(32);
    expect(jc3.song).toEqual(["song.i-got-rhythm"]);
    expect(jc3.opensAfter).toEqual({ checkpoints: ["J.CP2"] });
    expect(jc3.sessionDefs.map((s) => [s.id, !!s.release, !!s.review])).toEqual([
      ["JC3.S1", false, false],
      ["JC3.S2", false, false],
      ["JC3.S3", true, true],
    ]);
    // Every focus rule is a rule of the brief.
    for (const s of jc3.sessionDefs)
      for (const f of s.focusRules ?? []) expect(brief.rubric.map((r) => r.id)).toContain(f);
  });
  test("hints: concept, place, partial, then the reveal; none quotes a note of a solution", () => {
    const h = brief.hints ?? [];
    expect(h).toHaveLength(4);
    expect(h[3]).toBe("auto");
    for (const rung of h.slice(0, 3)) {
      const text = typeof rung === "string" ? rung : rung.text;
      expect(text).not.toMatch(/[a-g][#b]?\d|F♯|B♭ on/);
    }
  });
  test("liner notes: three seeds and a question about the piece, never about how well it went", () => {
    expect(CAPSTONE_LINER_SEEDS.JC3).toHaveLength(3);
    expect(CAPSTONE_LINER_PROMPTS.JC3).toMatch(/bridge/);
  });
});

describe("the starter (JC3.S1)", () => {
  test("lints clean at JC3.S1, plays, and is the brief's starter", async () => {
    expect(stripMarkers(brief.code.starter).code).toBe(JC3_TEMPLATE);
    const errors = lint(JC3_TEMPLATE, { session: "JC3.S1", meter: "4/4" }).diagnostics.filter(
      (d) => d.severity === "error",
    );
    expect(errors.map((d) => d.id)).toEqual([]);
    const ev = await evaluate(JC3_TEMPLATE, 8);
    expect(ev.ok).toBe(true);
    expect(ev.events.length).toBeGreaterThan(100);
  });
  test("a session-1 draft (the starter with its A tune written) meets session 1's lines", async () => {
    const draft = JC3_TEMPLATE.replace("const melA = silence", `const melA = note("${REF_A}")`);
    const r = await grade(draft, MODEL);
    const focus = jc3.sessionDefs[0]?.focusRules ?? [];
    expect(focus).toEqual(["a-changes", "chord-tones", "original"]);
    expect(failing(r).filter((id) => focus.includes(id))).toEqual([]);
    // What is left is session 2's: the bridge and the 32-bar form.
    expect(failing(r)).toEqual(["bars", "bridge", "bridge-guides", "form"]);
  });
  test("is not a solution: no tune, eight bars", async () => {
    const r = await grade(JC3_TEMPLATE, MODEL);
    expect(r.status).not.toBe("pass");
    expect(failing(r)).toEqual(["bars", "bridge", "bridge-guides", "chord-tones", "form", "original"]);
  });
});

describe("heads that pass every required line", () => {
  const right: [string, string][] = [
    ["the reference (jazz-soul: rhodes, upright, muted trumpet)", REFERENCE],
    [
      "an eighth-note line at 200 (indie: jazz guitar on top, guitar comping)",
      head({
        bpm: 200,
        melA: BOP_A,
        melB: BOP_B,
        sounds: { chords: "jazzgtr", bass: "upright", lead: "jazzgtr" },
      }),
    ],
    [
      "a riff head with its own last A and four-to-the-bar comping in the bridge (pop: piano)",
      head({
        bpm: 138,
        melA: RIFF_A,
        melA2: RIFF_A2,
        melB: RIFF_B,
        compB: "x x x x",
        sounds: { chords: "piano", bass: "upright", lead: "piano" },
      }),
    ],
    [
      "the reference quoting two bars of the old head (funk: rhodes and finger bass, tenor)",
      head({
        bpm: 176,
        melA: REF_A.replace("<[d5 ~ bb4 d5] [eb5 ~ f5 ~]", "<[bb4 c5 d5 f5] [g5 ~ ~ ~]"),
        melB: REF_B,
        sounds: { chords: "rhodes", bass: "fingerbass", lead: "tenor" },
      }),
    ],
  ];
  for (const [name, code] of right)
    test(name, async () => {
      const ev = lint(code, { session: "JC3.S1", meter: "4/4" }).diagnostics.filter(
        (d) => d.severity === "error",
      );
      expect(ev.map((d) => d.id)).toEqual([]);
      const r = await grade(code, MODEL);
      if (failing(r).length) throw new Error(explain(r));
      expect(r.status).toBe("pass");
    });
});

describe("heads that fail, each on the line it breaks", () => {
  test("the model's own head as the tune fails `original` alone, naming the bars it repeats", async () => {
    const r = await grade(head({ melA: MODEL_A, melB: MODEL_B }), MODEL);
    expect(failing(r)).toEqual(["original"]);
    expect(detail(r, "original")).toMatch(/repeat the old head \(bar 1, 2, 3\)/);
  });
  test("the same head an octave lower is still the old head", async () => {
    const r = await grade(head({ melA: MODEL_A, melB: MODEL_B, melTail: ".transpose(-12)" }), MODEL);
    expect(failing(r)).toEqual(["original"]);
  });
  // Grader gap (apiNotes): `progression` and `guide-tones` read the chord sounding at beat 1, so a bridge comped on 2
  // and 4 only (one chord a bar, nothing struck on the downbeat) reads as the A's last chord held over: `bridge` and
  // `bridge-guides` fail although D7 G7 C7 F7 are heard, the bass on each root on beat 1.
  test.todo("comping on 2 and 4 only in the bridge still states the bridge's changes");
  test("the bridge one bar a chord (right chords, wrong length) fails `bridge`", async () => {
    const r = await grade(head({ melA: REF_A, melB: REF_B, changesB: "<D7 G7 C7 F7>" }), MODEL);
    expect(failing(r)).toContain("bridge");
    expect(failing(r)).not.toContain("a-changes");
  });
  test("the bridge as major sevenths (D∆7 G∆7 C∆7 F∆7): right roots, wrong seventh, fails `bridge` (W7 gate)", async () => {
    const r = await grade(
      head({ melA: REF_A, melB: REF_B, changesB: "<D^7 D^7 G^7 G^7 C^7 C^7 F^7 F^7>" }),
      MODEL,
    );
    expect(failing(r)).toContain("bridge");
    expect(failing(r)).not.toContain("a-changes");
    expect(detail(r, "bridge")).toMatch(/bar 17 is .*D∆7|bar 17 is .*Dmaj7|another seventh on the same root/);
  });
  test("a VI7 in place of the vi (G7 for Gm7) fails `a-changes` alone: that substitute is JC4's", async () => {
    const r = await grade(
      head({ melA: REF_A, melB: REF_B, changesA: JC3_CHANGES_A.replaceAll("Gm7", "G7") }),
      MODEL,
    );
    expect(failing(r)).toEqual(["a-changes"]);
  });
  test("a bridge tune on the roots fails `bridge-guides` alone", async () => {
    const roots =
      "<[d5 ~ ~ ~] [a4 ~ d5 ~] [g4 ~ ~ ~] [d5 ~ g4 ~] [c5 ~ ~ ~] [g4 ~ c5 ~] [f4 ~ ~ ~] [c5 ~ f4 ~]>";
    const r = await grade(head({ melA: REF_A, melB: roots }), MODEL);
    expect(failing(r)).toEqual(["bridge-guides"]);
  });
  test("the tune written but muted (.gain(0)) is not heard: no tune, so three lines fail", async () => {
    const r = await grade(head({ melA: REF_A, melB: REF_B, melTail: ".gain(0)" }), MODEL);
    expect(failing(r)).toEqual(["bridge-guides", "chord-tones", "original"]);
  });
  test("24 bars, A B A, fail `form` and `bars`", async () => {
    const r = await grade(head({ melA: REF_A, melB: REF_B, form: ["A", "B", "A"] }), MODEL);
    expect(failing(r)).toEqual(expect.arrayContaining(["bars", "form"]));
    expect(failing(r)).not.toContain("chord-tones");
  });
});

// --- the stand-in model: J4.L04's head, while I Got Rhythm has no answer key (W7 gate, decision 80) ---------------

/** J4.L04's head, pinned to that lesson: one of its reference solutions plays exactly `J4_HEAD_A`. */
async function j4l04HeadNotes(): Promise<number[][]> {
  const { default: lesson } = (await import("../../J4/L04/lesson.ts")) as { default: unknown };
  const head8 = `mel: note("<${J4_HEAD_A.join(" ")}>")`;
  expect(JSON.stringify(lesson)).toContain(JSON.stringify(head8).slice(1, -1));
  const notes = await melodyNotes(`setcpm(160/4)\n${head8}`, 8);
  return notes.map((x) => [x.onset[0], x.onset[1], x.dur[0], x.dur[1], x.midi]);
}

describe("without I Got Rhythm's key the brief's stand-in is the model (decision 80)", () => {
  test("the stand-in is J4.L04's head, note for note, in the three A sections", async () => {
    expect(JC3_STAND_IN.notes.map((x): number[] => [...x])).toEqual(await j4l04HeadNotes());
    expect([...JC3_STAND_IN.at]).toEqual([0, 8, 24]);
    const original = brief.rubric.find((r) => r.id === "original") as { params?: { standIn?: unknown } };
    expect(original.params?.standIn).toMatchObject({ name: JC3_STAND_IN.name, at: [0, 8, 24] });
  });
  test("the reference and the three other right heads pass every required line with no songMelody", async () => {
    for (const code of [
      REFERENCE,
      head({ bpm: 200, melA: BOP_A, melB: BOP_B }),
      head({ bpm: 138, melA: RIFF_A, melA2: RIFF_A2, melB: RIFF_B }),
    ]) {
      const r = await grade(code);
      if (failing(r).length) throw new Error(explain(r));
      expect(r.status).toBe("pass");
    }
  });
  test("J4.L04's head as the tune of every A fails `original` alone, naming the head (right function, old tune)", async () => {
    const A = `<${J4_HEAD_A.join(" ")}>`;
    const r = await grade(head({ melA: A, melB: REF_B }));
    expect(failing(r)).toEqual(["original"]);
    expect(detail(r, "original")).toMatch(/repeat the head you read in J4\.L04 \(bar 1, 2, 3\)/);
  });
  test("the same head an octave lower is still that head", async () => {
    const A = `<${J4_HEAD_A.join(" ")}>`;
    const r = await grade(head({ melA: A, melB: REF_B, melTail: ".transpose(-12)" }));
    expect(failing(r)).toContain("original");
  });
  test("a host's songMelody wins over the stand-in", async () => {
    const r = await grade(head({ melA: MODEL_A, melB: MODEL_B }), MODEL);
    expect(detail(r, "original")).toMatch(/repeat the old head/);
  });
});

/** J4.L04's HEAD_BARS as written there (pinned against the lesson by the stand-in test above). */
const J4_HEAD_A = [
  "[d5@2 bb4 d5]",
  "[eb5@2 a4@2]",
  "[d5@2 bb4 g4]",
  "[c5 [bb4 a4] f4 ~]",
  "[c5 eb5 d5@2]",
  "[g4 bb4 db5@2]",
  "[f4 a4 b4 d5]",
  "[c5@2 a4@2]",
];

// --- the real model, once author:repertoire has written it -------------------------------------------------------

const IGR = join(import.meta.dir, "..", "..", "..", "repertoire", "i-got-rhythm", "song.ts");
describe("against I Got Rhythm's answer key (song.i-got-rhythm)", () => {
  if (!existsSync(IGR)) {
    test.todo("the reference passes `original`; the head itself fails it (no answer key yet)");
    return;
  }
  test("the reference passes `original`; the head itself, as a learner's tune, fails it", async () => {
    const song = ((await import(IGR)) as { default: SongDef }).default;
    const layer = (song.answerKey.layers.melody ?? "").replace(/^[A-Za-z_$][\w$]*\s*:\s*/, "");
    expect(layer).not.toBe("");
    const shift = song.pickup ? 1 : 0;
    const notes = (await melodyNotes(`melody: ${layer}`, song.answerKey.bars + shift)).map((x) => ({
      ...x,
      onset: R.sub(x.onset, [shift, 1]),
    }));
    const ok = await grade(REFERENCE, notes);
    expect(failing(ok)).toEqual([]);
    const copy = `${REFERENCE.split("\nmel:")[0]}\nmel: ${layer}`;
    const r = await grade(copy, notes);
    expect(failing(r)).toContain("original");
  });
});
