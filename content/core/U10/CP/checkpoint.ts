// U10.CP Minor checkpoint (contracts §7.6; AUTHORING §10). The generated items come from the minor degree
// family (E10, a re-test of the ear that sets its level and never blocks) and the circle-of-fifths family at its
// relative-key levels (S06). The concept skills have no family of their own, so the authored items measure
// them, each in a key the lessons did not drill (contracts §7.6 asks for the idea, not the key):
// - the-twins: one tune in E major, played by `mel` and then by `vox`; `mel` moves to the parallel minor
//   (E minor: the same home, ♭3 ♭6 ♭7) and `vox` to the relative minor (C♯ minor: the same notes, a new home)
//   by changing only the scale names (S05, S06);
// - number-the-minor-song: eight bars in D minor read as chord names, numbered: i VI III VII | i iv V i, the
//   Aeolian loop, the key's chords and the major V of harmonic minor (H07, H08, H09);
// - up-and-down: a line in E minor that climbs to home with the raised 6 and 7 and falls back natural, over a
//   chord that becomes the major V (S07, S08).
// The Make is a minor loop of the learner's own over the Band's ballad drums (`band.aeolian-4bar`, drums only:
// the chords are graded, so they are the learner's): the Aeolian loop on bars 1–4 (H08, required), a turn
// that lands with the major V (H09) and a tune that sings me and le (S05) as suggestions.
// Spec: content/specs/U10.md, "U10.CP Minor checkpoint".
//
// Checked at its place in the default order, after U11.L01: every U10 tool and word is the learner's.
import { type CheckpointDef, defineCheckpoint, type Matcher } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

// --- the-twins ----------------------------------------------------------------------------------------

/** One tune, 1 3 5 3 | 4 2 1: `mel` plays it in bars 1–2, `vox` in bars 3–4. */
const TUNE = "[0 2 4 2] [3 1 0 ~]";
const DRUMS = 'drums: s("bd ~ sd ~, hh*8").gain(.6)';
const twins = (melScale: string, voxScale: string) =>
  code(
    DRUMS,
    `mel: n("<${TUNE} ~ ~>").scale("${melScale}").s("piano")`,
    `vox: n("<~ ~ ${TUNE}>").scale("${voxScale}").s("piano")`,
  );
const TWINS_STARTER = twins("⟪E4:major⟫", "⟪E4:major⟫");
/** E minor: E G B G | A F♯ E. C♯ minor, a minor 3rd below E: C♯ E G♯ E | F♯ D♯ C♯. */
const TWINS = twins("E4:minor", "C#4:minor");
/**
 * Octave-free: the item asks for the two twin keys, not a register, so C♯ minor written an octave up (`C#5`) is
 * the relative minor too; a swapped pair or a twin on the wrong home still fails on every pitch class.
 */
const TWINS_MATCHER: Matcher = {
  m: "all",
  of: [
    { m: "events", pitch: "octave-free", rhythm: "onsets", durations: false, tracks: ["mel"] },
    { m: "events", pitch: "octave-free", rhythm: "onsets", durations: false, tracks: ["vox"] },
  ],
};

// --- number-the-minor-song ----------------------------------------------------------------------------

/** Dm B♭ F C | Dm Gm A Dm: the Aeolian loop, then iv and the major V home. */
const SONG = code(
  DRUMS,
  'chords: chord("<Dm Bb F C Dm Gm A Dm>").voicing().s("rhodes").room(.3)',
  'bass: n("<0 5 2 6 0 3 4 0>").scale("D2:minor").s("ebass").lpf(600)',
);

// --- up-and-down --------------------------------------------------------------------------------------

/** B C♯ D♯ E up to home over the major V, then E D C B down over Em. */
const LINE = "<[4 5 6 7] [7 6 5 4]>";
const upDown = (chords: string, scales: string) =>
  code(
    `chords: chord("${chords}").voicing().s("piano").gain(.6)`,
    `mel: n("${LINE}").scale("${scales}").s("piano")`,
  );
const UP_DOWN_STARTER = upDown("<⟪Bm⟫ Em>", "⟪<E4:minor E4:minor>⟫");
const UP_DOWN = upDown("<B Em>", "<E4:melodic:minor E4:minor>");
const UP_DOWN_MATCHER: Matcher = {
  m: "all",
  of: [
    { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["mel"] },
    { m: "pcset", perOnset: true, bass: false, tracks: ["chords"] },
  ],
};

// --- the Make -----------------------------------------------------------------------------------------

/** Eight bars of chords by name, a root bass, and a tune on top. */
const ballad = (chords: string, ...extra: string[]) =>
  code(`chords: chord("${chords}").voicing().s("piano").room(.3)`, ...extra);
const ROOT_BASS = (roots: string) => `bass: n("${roots}").scale("A1:minor").s("ebass").lpf(600)`;
/** The starter: home and iv, nothing else. */
const MAKE_STARTER = ballad("<Am Am Dm Dm Am Am Dm Am>", ROOT_BASS("<0 0 3 3 0 0 3 0>"));
/** i VI III VII, then iv iv V i: the loop and a turn home with the raised 7 (G♯ in E). */
const AEOLIAN_TURN = "<Am F C G Dm Dm E Am>";
/**
 * A tune on chord notes, every bar: E C | F C | E C | B | F D | F E D | E B | A. It sings C (me, ♭3) over Am and
 * C, F (le, ♭6) over F and Dm, the raised 7 only through the E chord's own G♯ (never a natural G over it), and
 * lands on A.
 */
const BALLAD_TUNE =
  'mel: n("<[4 ~ 2 ~] [5 ~ 2 ~] [4 ~ 2 ~] [1 ~ ~ ~] [5 ~ 3 ~] [5 4 3 ~] [4 ~ 1 ~] [7 ~ ~ ~]>").scale("A3:minor").s("piano")';

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U10.CP",
  title: "Minor checkpoint",
  covers: ["U10"],
  gated: ["S05", "S06", "S07", "S08", "H07", "H08", "H09"],
  levelSetting: ["E10"],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "the-twins",
      version: 1,
      role: "checkpoint",
      key: { tonic: "E", mode: "minor" },
      prompt:
        "One tune in E major: `mel` plays it in bars 1–2, `vox` in bars 3–4. Change only the two scale names. Move `mel` to E major's parallel minor, the twin with the same home. Move `vox` to its relative minor, the twin with the same notes.",
      skills: [
        { skill: "S05", w: 0.5 },
        { skill: "S06", w: 0.5 },
      ],
      hints: null,
      code: { starter: TWINS_STARTER },
      reference: { solutions: [TWINS], bars: 4 },
      matcher: TWINS_MATCHER,
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: TWINS }, expect: "pass" },
        {
          name: "the same keys by their mode name",
          response: { code: twins("E4:aeolian", "C#4:aeolian") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: twins("E4:major", "E4:major") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the twins swapped",
          response: { code: twins("C#4:minor", "E4:minor") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "the relative minor a 6th up instead of a 3rd down: the same key, higher",
          response: { code: twins("E4:minor", "C#5:minor") },
          expect: "pass",
        },
        {
          name: "the relative minor counted from the wrong degree: G# minor",
          response: { code: twins("E4:minor", "G#4:minor") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
      ],
    },
    {
      kind: "fact",
      id: "number-the-minor-song",
      version: 1,
      role: "checkpoint",
      key: { tonic: "D", mode: "minor" },
      prompt:
        "Write the numeral of each chord in this D minor song, one per bar: Dm B♭ F C, then Dm Gm A Dm. Count each root from D. Use upper case for a major chord and lower case for a minor one.",
      skills: [
        { skill: "H07", w: 0.4 },
        { skill: "H08", w: 0.3 },
        { skill: "H09", w: 0.3 },
      ],
      hints: null,
      stimulus: { src: "code", code: SONG, bars: 8, showCode: true },
      answer: { ui: "rn-palette", slots: 8, allow: ["triads"] },
      correct: { rn: ["i", "VI", "III", "VII", "i", "iv", "V", "i"] },
      spelling: "enharmonic",
      order: "sequence",
      feedbackText: {
        "harmony.rn-degree":
          "Chord {slot}: {expChord} is {exp} in D minor, not {got}. Count its root from D, the home note.",
      },
      tests: [
        {
          name: "i VI III VII | i iv V i",
          response: { answer: { rn: ["i", "VI", "III", "VII", "i", "iv", "V", "i"] } },
          expect: "pass",
        },
        {
          name: "the major V read as the key's own v",
          response: { answer: { rn: ["i", "VI", "III", "VII", "i", "iv", "v", "i"] } },
          expect: "fail",
          feedback: ["harmony.rn-case"],
        },
        {
          name: "counted from F, the relative major",
          response: { answer: { rn: ["vi", "IV", "I", "V", "vi", "ii", "III", "vi"] } },
          expect: "fail",
          feedback: ["harmony.rn-degree"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "up-and-down",
      version: 1,
      role: "checkpoint",
      key: { tonic: "E", mode: "melodic minor" },
      prompt:
        "A line in E minor climbs from 5 to home in bar 1, then falls back in bar 2. Change bar 1's scale name so the climb goes through raised 6 and 7; keep bar 2 in natural minor. Then change the chord under the climb, Bm, to the major V.",
      skills: [
        { skill: "S07", w: 0.4 },
        { skill: "S08", w: 0.4 },
        { skill: "H09", w: 0.2 },
      ],
      hints: null,
      code: { starter: UP_DOWN_STARTER },
      reference: { solutions: [UP_DOWN], bars: 2 },
      matcher: UP_DOWN_MATCHER,
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false },
      tests: [
        { name: "reference", response: { code: UP_DOWN }, expect: "pass" },
        {
          name: "the way down by its mode name",
          response: { code: upDown("<B Em>", "<E4:melodic:minor E4:aeolian>") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: upDown("<Bm Em>", "<E4:minor E4:minor>") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "harmonic minor on the way up: C natural, D♯",
          response: { code: upDown("<B Em>", "<E4:harmonic:minor E4:minor>") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "the line right, the chord still minor",
          response: { code: upDown("<Bm Em>", "<E4:melodic:minor E4:minor>") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      E10: ["fam.deg.fet-minor", "fam.key.mode"],
      S06: ["fam.key.circle"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-minor-loop",
    version: 1,
    role: "checkpoint",
    title: "A minor loop",
    prompt:
      "Write eight bars of chords in A minor over the band's drums. Bars 1–4 play the Aeolian loop, i VI III VII. Bars 5–8 are a turn of your own that comes home on i, with the major V before it if you like. Add a tune on top.",
    skills: [{ skill: "H08", w: 1 }],
    hints: null,
    key: { tonic: "A", mode: "minor" },
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [8, 16],
    saveAs: "sketch",
    rubric: [
      {
        id: "aeolian",
        label: "Bars 1–4 play the Aeolian loop, i VI III VII (Am F C G)",
        required: true,
        skills: ["H08"],
        rule: "progression",
        schema: "schema.aeolian",
        bars: [1, 4],
      },
      {
        id: "major-v",
        label: "The chords play a major V (E) followed by i (Am)",
        required: false,
        skills: ["H09"],
        rule: "contains-rn",
        rn: ["V"],
        min: 1,
        mustResolve: true,
      },
      {
        id: "me-and-le",
        label: "The tune plays ♭3 (me) and ♭6 (le)",
        required: false,
        skills: ["S05"],
        rule: "degree-set",
        track: "@melody",
        contains: ["b3", "b6"],
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: i and iv only",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: the loop in bars 1–4, the starter's ending",
        response: { code: ballad("<Am F C G Dm Dm Dm Am>", ROOT_BASS("<0 5 2 6 3 3 3 0>")) },
        expect: "pass",
      },
      {
        name: "beyond the brief: the loop, a turn through the major V and a tune with me and le",
        response: {
          code: ballad(
            AEOLIAN_TURN,
            ROOT_BASS("<[0 0 4 0] [5 5 2 5] [2 2 6 2] [6 6 3 6] [3 3 0 3] [3 3 0 3] [4 4 1 4] [0 ~ ~ ~]>"),
            BALLAD_TUNE,
          ),
        },
        expect: "pass",
      },
      {
        name: "the Andalusian descent instead: i VII VI V",
        response: { code: ballad("<Am G F E Am G F E>", ROOT_BASS("<0 6 5 4 0 6 5 4>")) },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
