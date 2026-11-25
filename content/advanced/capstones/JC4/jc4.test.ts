// JC4 Reharmonize a Standard (contracts §6.6 JC4, content/specs/J5.md): the brief of content/capstones.ts graded
// through the real grader in capstone mode, the way the capstone workspace grades it, with the picked song's melody
// passed as `GradeContext.songMelody` (the host reads it from the song's answer key).
//   - The song: neither Georgia on My Mind nor Body and Soul has an answer key yet (author:repertoire), so every
//     piece here reharmonizes a STAND-IN standard written for this test: Oak's own sixteen-bar ballad in F, A A B A,
//     in the plain setting the host builds (the tune over its original sevenths), never served. Once a song's key
//     exists, the last block grades that song's own setting.
//   - Three, four and five devices pass; two fail naming the ones still open; one note of the tune moved fails
//     naming its bar; new chords that clash with the tune's long notes fail the tensions line; one device used three
//     times (the right device, the wrong result) fails; the unchanged song and the starter fail.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CapstoneDef, GradeResult, KeySpec, SongDef } from "@oak/content-kit";
import { R, stripMarkers } from "@oak/content-kit";
import * as grader from "@oak/grader";
import {
  CAPSTONE_LINER_PROMPTS,
  CAPSTONE_LINER_SEEDS,
  capstoneById,
  JC4_TEMPLATE,
} from "../../../capstones.ts";
import { toolbox } from "../../../toolbox.ts";
import { evaluate, lint, unlockedFor } from "../../../validate/harness.ts";

setDefaultTimeout(180_000);

const jc4 = capstoneById.get("JC4") as CapstoneDef;
const brief = jc4.brief as NonNullable<CapstoneDef["brief"]>;
const F: KeySpec = { tonic: "F", mode: "major" };

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

function grade(code: string, songMelody: readonly grader.SongMelodyNote[], key: KeySpec = F) {
  return grader.gradeExercise({
    exercise: brief,
    response: { code },
    ctx: {
      exerciseGlobalId: "JC4/brief",
      mode: "capstone",
      key,
      meter: "4/4",
      bpm: 72,
      songMelody,
      params: {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0,
      tutorHints: 0,
      extraReplays: 0,
      lint: {
        profile: "graded",
        unlocked: unlockedFor("JC4.S1"),
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
const where = (r: GradeResult, id: string) => (r.rubric ?? []).find((x) => x.ruleId === id)?.diag?.where;
const explain = (r: GradeResult): string =>
  (r.rubric ?? [])
    .filter((x) => x.required && !x.ok)
    .map((x) => `${x.ruleId}: ${detail(r, x.ruleId)}`)
    .join("\n");

// --- the stand-in standard (test only) --------------------------------------------------------------------------

/**
 * Sixteen bars in F, A A B A of four bars. The A: I, the secondary dominant VI7, ii–V, I; the bridge on IV, then
 * ii–V home. Every note of the tune is on a beat and is a chord tone of its plain chord (A over F, D C A over D7, B♭
 * over Gm7, G and E over C7; D F over B♭maj7 with C, its 9th, on beat 2).
 */
const PLAIN = [
  ...["F^7", "D7", "[Gm7 C7]", "F^7"],
  ...["F^7", "D7", "[Gm7 C7]", "F^7"],
  ...["Bb^7", "Bb^7", "Gm7", "C7"],
  ...["F^7", "D7", "[Gm7 C7]", "F^7"],
];
const TUNE_A = ["[a4@2 c5@2]", "[d5@2 c5 a4]", "[bb4@2 g4 e4]", "f4"];
const TUNE_B = ["[d5@2 f5@2]", "[d5 c5 bb4@2]", "[bb4@2 a4 g4]", "[e4@2 g4@2]"];
const TUNE = [...TUNE_A, ...TUNE_A, ...TUNE_B, ...TUNE_A];

interface Setting {
  changes: readonly string[];
  tune?: readonly string[];
  bpm?: number;
  sounds?: { chords: string; bass: string; lead: string };
}
/** The song in the host's plain setting: the tune (locked in the workspace) over one `changes` string. */
function setting(o: Setting): string {
  const s = o.sounds ?? { chords: "rhodes", bass: "upright", lead: "tenor" };
  return [
    `setcpm(${o.bpm ?? 72}/4)`,
    "",
    `const changes = "<${o.changes.join(" ")}>"`,
    "",
    'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit").gain(.5)',
    'hats: s("~ hh ~ hh").bank("jazzkit")',
    `bass: chord(changes).rootNotes(2).s("${s.bass}").lpf(900)`,
    `chords: chord(changes).dict("lefthand").voicing().s("${s.chords}").gain(.6)`,
    `mel: note("<${(o.tune ?? TUNE).join(" ")}>").s("${s.lead}")`,
  ].join("\n");
}
/** The plain changes with some bars replaced (1-based bar numbers). */
const reharm = (bars: Record<number, string>): string[] => PLAIN.map((c, i) => bars[i + 1] ?? c);

/** A passing diminished chord climbing F, F♯°7, G (bar 2); a tritone sub, G♭7 for C7 (bar 7); a backdoor home (bar 15). */
const THREE = { 2: "F#o7", 7: "[Gm7 Gb7]", 15: "[Bbm7 Eb7]" };
/** …and a secondary ii–V aimed at Gm7 (bar 6). */
const FOUR = { ...THREE, 6: "[Am7 D7]" };
/** …and a second tritone sub, G♭7 for the bridge's C7 (bar 12). */
const FIVE = { ...FOUR, 12: "Gb7" };

let SONG: grader.SongMelodyNote[] = [];
beforeAll(async () => {
  SONG = await melodyNotes(`setcpm(72/4)\n\nmel: note("<${TUNE.join(" ")}>")`, 16);
});

describe("the brief", () => {
  test("three required lines (contracts §6.6): the song's melody, tensions that fit, three different devices", () => {
    expect(brief.rubric.map((r) => [r.id, r.rule, r.required])).toEqual([
      ["melody", "custom", true],
      ["tensions", "custom", true],
      ["devices", "device-count", true],
      ["tempo", "tempo-bpm", false],
      ["top-voice", "voice-leading", false],
      // Oak 2.0 W4 F1: the book's ending as a suggestion (no skills, never blocks).
      ["ending", "custom", false],
    ]);
    expect(brief.rubric.find((r) => r.id === "devices")).toMatchObject({
      devices: ["tritone sub", "secondary ii–V", "backdoor", "diminished passing"],
      min: 3,
    });
    expect(jc4.song).toEqual(["song.georgia-on-my-mind", "song.body-and-soul"]);
    expect(jc4.opensAfter).toEqual({ checkpoints: ["J.CP2"] });
    expect(jc4.sessionDefs.map((s) => [s.id, !!s.release])).toEqual([
      ["JC4.S1", false],
      ["JC4.S2", false],
      ["JC4.S3", true],
    ]);
    for (const s of jc4.sessionDefs)
      for (const f of s.focusRules ?? []) expect(brief.rubric.map((r) => r.id)).toContain(f);
  });
  test("hints: rungs 1–3 name no chord of either song and no note", () => {
    const h = brief.hints ?? [];
    expect(h).toHaveLength(4);
    expect(h[3]).toBe("auto");
    for (const rung of h.slice(0, 3)) {
      const text = typeof rung === "string" ? rung : rung.text;
      expect(text).not.toMatch(/\b[A-G][#b♭♯]?(?:m7|7|\^7|maj7|o7|°7)?\b(?! )|Georgia|Body/);
    }
  });
  test("liner notes: three seeds and a question about the piece", () => {
    expect(CAPSTONE_LINER_SEEDS.JC4).toHaveLength(3);
    expect(CAPSTONE_LINER_PROMPTS.JC4).toMatch(/chord/);
  });
  test("the fallback starter lints at JC4.S1, plays, and is no solution", async () => {
    expect(stripMarkers(brief.code.starter).code).toBe(JC4_TEMPLATE);
    const errors = lint(JC4_TEMPLATE, { session: "JC4.S1", meter: "4/4" }).diagnostics.filter(
      (d) => d.severity === "error",
    );
    expect(errors.map((d) => d.id)).toEqual([]);
    const ev = await evaluate(JC4_TEMPLATE, 4);
    expect(ev.ok).toBe(true);
    expect(ev.events.length).toBeGreaterThan(20);
    const r = await grade(JC4_TEMPLATE, SONG);
    expect(failing(r)).toEqual(expect.arrayContaining(["devices", "melody"]));
  });
});

describe("the song's plain setting (the host's JC4 starter)", () => {
  test("keeps the melody and fits it, and has no device: it fails `devices` alone", async () => {
    const r = await grade(setting({ changes: PLAIN }), SONG);
    expect(failing(r)).toEqual(["devices"]);
    expect(detail(r, "devices")).toMatch(/still open/);
  });
});

describe("reharmonizations that pass every required line", () => {
  const right: [string, string][] = [
    [
      "three devices: passing diminished, tritone sub, backdoor (jazz-soul)",
      setting({ changes: reharm(THREE) }),
    ],
    [
      "four devices, the secondary ii–V added (pop: piano)",
      setting({ changes: reharm(FOUR), sounds: { chords: "piano", bass: "upright", lead: "piano" } }),
    ],
    [
      "five devices, a second tritone sub in the bridge (indie: jazz guitar, vibes)",
      setting({
        changes: reharm(FIVE),
        bpm: 64,
        sounds: { chords: "jazzgtr", bass: "upright", lead: "vibes" },
      }),
    ],
    [
      "three other devices in other bars: secondary ii–V, tritone sub, backdoor (funk: rhodes, finger bass)",
      setting({
        changes: reharm({ 6: "[Am7 D7]", 12: "Gb7", 15: "[Bbm7 Eb7]" }),
        bpm: 88,
        sounds: { chords: "rhodes", bass: "fingerbass", lead: "mutetpt" },
      }),
    ],
  ];
  for (const [name, code] of right)
    test(name, async () => {
      const errors = lint(code, { session: "JC4.S1", meter: "4/4" }).diagnostics.filter(
        (d) => d.severity === "error",
      );
      expect(errors.map((d) => d.id)).toEqual([]);
      const r = await grade(code, SONG);
      if (failing(r).length) throw new Error(explain(r));
      expect(r.status).toBe("pass");
    });
});

describe("JC4.S3's stretch: the comping written by hand", () => {
  /** THREE's chords voiced by hand, root at the bottom, the top note moving by a step or staying. */
  const HAND = [
    "[f3,a3,c4,e4]",
    "[f#3,a3,c4,eb4]",
    "[[g3,bb3,d4,f4] [c3,g3,bb3,e4]]",
    "[f3,a3,c4,e4]",
    "[f3,a3,c4,e4]",
    "[d3,a3,c4,f#4]",
    "[[g3,bb3,d4,f4] [gb3,bb3,db4,e4]]",
    "[f3,a3,c4,e4]",
    "[bb2,a3,d4,f4]",
    "[bb2,a3,d4,f4]",
    "[g3,bb3,d4,f4]",
    "[c3,bb3,e4,g4]",
    "[f3,a3,e4,g4]",
    "[d3,a3,c4,f#4]",
    "[[bb2,ab3,db4,f4] [eb3,g3,db4,f4]]",
    "[f3,a3,c4,e4]",
  ];
  test("a dictionary line passes the brief and leaves the optional top-voice line open, saying why", async () => {
    const r = await grade(setting({ changes: reharm(THREE) }), SONG);
    expect(r.status).toBe("pass");
    expect((r.rubric ?? []).find((x) => x.ruleId === "top-voice")?.ok).toBe(false);
    expect(detail(r, "top-voice")).toMatch(/dictionary/);
  });
  test("the same devices voiced by hand meet every line, the top-voice line too", async () => {
    const code = setting({ changes: reharm(THREE) }).replace(
      /chords: .*$/m,
      `chords: note("<${HAND.join(" ")}>").s("rhodes").gain(.6)`,
    );
    const r = await grade(code, SONG);
    if (failing(r).length) throw new Error(explain(r));
    expect((r.rubric ?? []).find((x) => x.ruleId === "top-voice")?.ok).toBe(true);
  });
});

describe("reharmonizations that fail, each on the line it breaks", () => {
  test("two devices fail `devices` alone, naming the two still open", async () => {
    const r = await grade(setting({ changes: reharm({ 2: "F#o7", 7: "[Gm7 Gb7]" }) }), SONG);
    expect(failing(r)).toEqual(["devices"]);
    const d = detail(r, "devices");
    expect(d).toMatch(/^2 of the 3 asked for/);
    expect(d).toMatch(/still open: secondary ii–V, backdoor/);
  });
  test("one note of the tune moved (a step up in bar 10) fails `melody`, naming bar 10", async () => {
    const tune = [...TUNE];
    tune[9] = "[d5 db5 bb4@2]";
    const r = await grade(setting({ changes: reharm(THREE), tune }), SONG);
    expect(failing(r)).toContain("melody");
    expect(where(r, "melody")?.bar).toBe(10);
    expect(detail(r, "melody")).toMatch(/[Bb]ar 10/);
  });
  test("the tune bent to fit a new chord (G♭ for G under G♭7 in bar 7) fails `melody`, naming bar 7", async () => {
    const tune = [...TUNE];
    tune[6] = "[bb4@2 gb4 e4]";
    const r = await grade(setting({ changes: reharm(THREE), tune }), SONG);
    expect(failing(r)).toContain("melody");
    expect(where(r, "melody")?.bar).toBe(7);
  });
  test("new chords that clash with the tune's long notes fail `tensions` alone", async () => {
    const r = await grade(
      setting({ changes: reharm({ ...THREE, 4: "C^7", 5: "B^7", 8: "C^7", 9: "B^7", 13: "B^7" }) }),
      SONG,
    );
    expect(failing(r)).toEqual(["tensions"]);
  });
  test("one device three times (three tritone subs) is one device: `devices` fails", async () => {
    const r = await grade(setting({ changes: reharm({ 3: "[Gm7 Gb7]", 7: "[Gm7 Gb7]", 12: "Gb7" }) }), SONG);
    expect(failing(r)).toEqual(["devices"]);
    expect(detail(r, "devices")).toMatch(/^1 of the 3 asked for: tritone sub/);
  });
  test("the devices written but the chords muted (.gain(0)) are not heard: `devices` fails", async () => {
    const r = await grade(setting({ changes: reharm(FOUR) }).replace(".gain(.6)", ".gain(0)"), SONG);
    expect(failing(r)).toContain("devices");
  });
});

// --- the real songs, once author:repertoire has written them -----------------------------------------------------

/** The song's chart as one changes string, a bar a step (two chords: a bracket), as the host's starter builds it. */
function chartChanges(song: SongDef): string[] {
  const chart = song.answerKey.chords ?? [];
  return Array.from({ length: song.answerKey.bars }, (_, i) => {
    const here = chart.filter((c) => c.bar === i + 1).sort((a, b) => a.beat - b.beat);
    return here.length === 1
      ? (here[0] as { symbol: string }).symbol
      : `[${here.map((c) => c.symbol).join(" ")}]`;
  });
}
/** The host's plain setting of a song: its tempo, its melody layer, its changes (any dictionary that voices them). */
function songSetting(song: SongDef, changes: readonly string[]): string {
  const layer = (song.answerKey.layers.melody ?? "").replace(/^[A-Za-z_$][\w$]*\s*:\s*/, "");
  return [
    song.answerKey.code.split("\n")[0] as string,
    "",
    `const changes = "<${changes.join(" ")}>"`,
    "",
    `bass: chord(changes).rootNotes(2).s("upright").lpf(900)`,
    `chords: chord(changes).voicing().s("rhodes").gain(.6)`,
    `mel: ${layer}`,
  ].join("\n");
}
async function songNotes(song: SongDef): Promise<grader.SongMelodyNote[]> {
  const layer = (song.answerKey.layers.melody ?? "").replace(/^[A-Za-z_$][\w$]*\s*:\s*/, "");
  const shift = song.pickup ? 1 : 0;
  return (await melodyNotes(`melody: ${layer}`, song.answerKey.bars + shift)).map((x) => ({
    ...x,
    onset: R.sub(x.onset, [shift, 1]),
  }));
}

/**
 * Georgia on My Mind: a tritone sub for the C7 of bar 14 (G♭7 down a half step into bar 15's F∆7; the tune's A there is its ♯9), a backdoor
 * into bar 31 (B♭m7 E♭7 for the Gm7 C7 of bar 30), and a passing F♯°7 on beat 4 of bar 31, climbing F, F♯, G into
 * the Gm7 of bar 32 under the held F (a half step below F♯: one of the diminished seventh's tensions). Applied only
 * where the chart still has the chords these replace. The chart's own Em7 A7 → Dm7 is a secondary ii–V: graded
 * beside the song's chart (`songForm`), it is the song's, not the learner's.
 */
const GEORGIA_DEVICES: Record<number, [string, string]> = {
  14: ["[Gm7 C7]", "[Gm7 Gb7]"],
  30: ["[Gm7 C7]", "[Bbm7 Eb7]"],
  31: ["F^7", "[F^7@3 F#o7]"],
};

for (const slug of ["georgia-on-my-mind", "body-and-soul"]) {
  const file = join(import.meta.dir, "..", "..", "..", "repertoire", slug, "song.ts");
  describe(`song.${slug}`, () => {
    if (!existsSync(file)) {
      test.todo("its plain setting keeps the melody and fails `devices` (no answer key yet)");
      return;
    }
    test("its plain setting keeps the melody, fits it, and fails `devices`", async () => {
      const song = ((await import(file)) as { default: SongDef }).default;
      const r = await grade(songSetting(song, chartChanges(song)), await songNotes(song), song.key);
      expect(failing(r)).toEqual(["devices"]);
    });
    if (slug === "georgia-on-my-mind")
      test("three devices of the learner's own, placed where the tune agrees, pass every line", async () => {
        const song = ((await import(file)) as { default: SongDef }).default;
        const changes = chartChanges(song);
        const fits = Object.entries(GEORGIA_DEVICES).every(
          ([bar, [was]]) => changes[Number(bar) - 1] === was,
        );
        if (!fits) return; // the chart changed under these bars: the placements are re-chosen with it
        for (const [bar, [, now]] of Object.entries(GEORGIA_DEVICES)) changes[Number(bar) - 1] = now;
        const r = await grade(songSetting(song, changes), await songNotes(song), song.key);
        if (failing(r).length) throw new Error(explain(r));
      });
  });
}
