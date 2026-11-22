// U03.CP Major-scale checkpoint (contracts §7.6; AUTHORING §10). The generated items come from the
// scale-spelling, degree-index, code-functions, circle, reading, tonic, functional-ear, dictation and sung
// families at each skill's level. These authored items cover what a family cannot ask directly: writing a
// key signature in its written order (N03, with S04), moving a tune given as degrees into another key in
// `n()` (S02, S03), and hearing and seeing a line that moves by step against one that leaps (M01, which
// otherwise only the Make measures). Then the checkpoint Make: an eight-bar melody over the eight-bar Band
// that comes home to 1. Spec: content/specs/U03.md, "U03.CP Major-scale checkpoint".
//
// Everything here is checked after U04.L01 (the checkpoint's place in the default order): the octave above
// home and below it (`tb.n.range`), `..`, a patterned `.scale()`, `.legato()`, `acgtr` and syllables are
// all the learner's. Degree rules are judged in the declared key (AUTHORING §8), so the Make stays in C.
import { type CheckpointDef, defineCheckpoint } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line written in degrees: `n` over a major scale. */
const deg = (pattern: string, key = "C4:major", sound = "piano", extra = "") =>
  `${TEMPO}mel: n("${pattern}").scale("${key}").s("${sound}")${extra}`;

/** 1 3 5 3 | 4 2 1, as `n` (one less than each degree). */
const TUNE = "<[0 2 4 2] [3 1 0 ~]>";
const TUNE_IN_D = deg(TUNE, "D4:major");

/** By step: 3 4 5 4 | 3 2 1. By leap: 1 5 3 1' | 6 2 5. Both two bars in C, ending at rest. */
const BY_STEP = deg("<[2 3 4 3] [2 1 0 ~]>");
const BY_LEAP = deg("<[0 4 2 7] [5 1 4 ~]>");

/**
 * The Make starter: eight bars over `band.phrase-8bar` (I IV I V | I IV V I), mostly steps. It pauses on 5
 * over the V of bar 4, as a phrase should, but bar 8 stops on 2 over the home chord: the tune is not
 * finished. Nothing holds 4 over the I chord or 1 over the V (a half step above a chord note).
 */
const PHRASE_START = "[2 1 0 1] [0 1 2 3] [2 1 2 4] [4 ~ ~ ~] [2 1 0 1] [0 1 2 3] [4 3 2 3]";
const PHRASE = (last: string, sound = "piano", extra = "") =>
  deg(`<${PHRASE_START} ${last}>`, "C4:major", sound, extra);

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U03.CP",
  title: "Major-scale checkpoint",
  covers: ["U03"],
  gated: ["S01", "S02", "S03", "S04", "N03", "M01"],
  levelSetting: ["E03", "E04", "E05", "E07", "V02", "V03", "V04"],
  version: 2,
  authored: [
    {
      kind: "staff-write",
      id: "keysig-eb",
      version: 1,
      role: "checkpoint",
      prompt:
        "Write the key signature of E♭ major: its flats at the start of the staff, from the left, in the order flats are always written. Write only the flats E♭ major needs.",
      skills: [
        { skill: "N03", w: 0.6 },
        { skill: "S04", w: 0.4 },
      ],
      hints: null,
      key: { tonic: "Eb", mode: "major" },
      answer: {
        ui: "staff-input",
        mode: "key-signature",
        clef: "treble",
        bars: 1,
        palette: { durations: [], accidentals: true, ties: false, rests: false },
      },
      expect: { e: "key-signature", key: { tonic: "Eb", mode: "major" }, order: "sequence" },
      tests: [
        { name: "B♭ E♭ A♭", response: { answer: { text: ["Bb", "Eb", "Ab"] } }, expect: "pass" },
        { name: "with flat signs", response: { answer: { text: ["B♭", "E♭", "A♭"] } }, expect: "pass" },
        {
          name: "the right three, the key's own flat first",
          response: { answer: { text: ["Eb", "Bb", "Ab"] } },
          expect: "fail",
          feedback: ["keysig.order"],
        },
        {
          name: "B♭ major's two flats",
          response: { answer: { text: ["Bb", "Eb"] } },
          expect: "fail",
          feedback: ["keysig.count"],
        },
        {
          name: "sharps for a flat key",
          response: { answer: { text: ["F#", "C#", "G#"] } },
          expect: "fail",
          feedback: ["keysig.type"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "tune-in-d",
      version: 1,
      role: "checkpoint",
      prompt:
        "Write the tune **1 3 5 3 | 4 2 1**, then a rest, in D major with home on `D4`. Replace the zeros with the tune's numbers and change the key in `.scale()`. `n` counts from 0, so degree 5 is `n` 4.",
      skills: [
        { skill: "S02", w: 0.6 },
        { skill: "S03", w: 0.4 },
      ],
      hints: null,
      key: { tonic: "D", mode: "major" },
      code: { starter: deg("⟪<[0 0 0 0] [0 0 0 ~]>⟫", "⟪C4:major⟫") },
      reference: { solutions: [TUNE_IN_D], bars: 2 },
      matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
      // The grader reads a tune moved by one degree, or left in C, as one shift; say both causes.
      feedbackText: {
        "melody.index-shift":
          "Every note is one step off the tune in D ({dir}). Check that `.scale()` names D, and that each `n` is its degree minus one.",
        "melody.octave":
          "Bar {bar}, {beatLabel}: right note, an octave {dir}. Home is `D4`: check the number after the D.",
      },
      target: { audible: false, showRoll: false },
      tests: [
        { name: "reference", response: { code: TUNE_IN_D }, expect: "pass" },
        {
          name: "the last note held into the rest",
          response: { code: deg("<[0 2 4 2] [3 1 0@2]>", "D4:major") },
          expect: "pass",
        },
        {
          name: "the same notes on acoustic guitar, a little softer",
          response: { code: deg(TUNE, "D4:major", "acgtr", ".gain(.8)") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: deg("<[0 0 0 0] [0 0 0 ~]>") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the degrees typed into n as they are, one too high",
          response: { code: deg("<[1 3 5 3] [4 2 1 ~]>", "D4:major") },
          expect: "fail",
          feedback: ["melody.index-shift"],
        },
        {
          name: "the right tune, still in C",
          response: { code: deg(TUNE) },
          expect: "fail",
          feedback: ["melody.index-shift"],
        },
        {
          name: "D major, an octave low",
          response: { code: deg(TUNE, "D3:major") },
          expect: "fail",
          feedback: ["melody.octave"],
        },
      ],
    },
    {
      kind: "fact",
      id: "steps-or-leaps",
      version: 1,
      role: "checkpoint",
      prompt:
        "Listen to the two short lines in C and read their staffs. Pick the one that moves mostly by step: each note to its neighbour in the scale.",
      skills: [{ skill: "M01", w: 1 }],
      hints: null,
      answer: {
        ui: "choice",
        layout: "audio-cards",
        options: [
          { id: "a", label: "A", audio: BY_LEAP, thumb: "staff" },
          { id: "b", label: "B", audio: BY_STEP, thumb: "staff" },
        ],
      },
      correct: { choice: ["b"] },
      // The catalog line names the option IDs; say what to look and listen for instead.
      feedbackText: {
        "id.wrong":
          "Not that one: it jumps over notes of the scale. The other walks 3 4 5 4 3 2 1, each note next to the last.",
      },
      spelling: "strict",
      order: "set",
      tests: [
        { name: "the walking line", response: { answer: { choice: ["b"] } }, expect: "pass" },
        { name: "the leaping line", response: { answer: { choice: ["a"] } }, expect: "fail" },
      ],
    },
  ],
  recipe: {
    items: [12, 18],
    perSkillMin: 2,
    families: {
      S01: ["fam.key.scale-spell"],
      S02: ["fam.deg.index"],
      S03: ["fam.code.functions"],
      S04: ["fam.key.circle"],
      N03: ["fam.not.read"],
      E03: ["fam.deg.tonic"],
      E04: ["fam.deg.fet-major"],
      E05: ["fam.deg.fet-major"],
      E07: ["fam.mel.dictation"],
      V02: ["fam.deg.sing"],
      V03: ["fam.deg.resolve", "fam.mel.echo"],
      V04: ["fam.mel.sight"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-phrase",
    version: 1,
    role: "checkpoint",
    title: "Eight bars home",
    prompt:
      "Change bar 8 so the melody's last note is degree 1, home; the starter's bar 8 stops on 2. Keep bar 4's pause on 5 and keep most moves to the next note of the scale. Done when the last note is 1.",
    skills: [{ skill: "M01", w: 1 }],
    hints: null,
    key: { tonic: "C", mode: "major" },
    bpm: BPM,
    code: { starter: PHRASE("[1 ~ ~ ~]") },
    bars: [8, 8],
    saveAs: "sketch",
    rubric: [
      {
        id: "home-on-1",
        label: "The melody's last note is degree 1, home",
        required: true,
        skills: ["M01"],
        rule: "ends-on-degree",
        track: "@melody",
        degrees: ["1"],
      },
      {
        id: "mostly-steps",
        label: "At least 6 in 10 moves to a new note go to the next note of the scale",
        required: false,
        skills: ["M01"],
        rule: "step-ratio",
        track: "@melody",
        min: 0.6,
      },
      {
        id: "eight-bars",
        label: "At least eight bars long",
        required: false,
        skills: ["M01"],
        rule: "bars",
        min: 8,
      },
    ],
    tests: [
      {
        name: "the starter: bar 8 stops on 2",
        response: { code: PHRASE("[1 ~ ~ ~]") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      { name: "minimal: bar 8 steps down to 1", response: { code: PHRASE("[1 0 ~ ~]") }, expect: "pass" },
      {
        name: "beyond the brief: a new second half on guitar, home through 3 2 1",
        response: {
          code: deg(
            "<[2 1 0 1] [0 1 2 3] [2 1 2 4] [4 ~ ~ ~] [7 6 5 4] [5 4 3 ~] [4 3 2 1] [0 ~ ~ ~]>",
            "C4:major",
            "acgtr",
            ".legato(.9)",
          ),
        },
        expect: "pass",
      },
      {
        name: "ends on 5, the open degree",
        response: { code: PHRASE("[4 ~ ~ ~]") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
