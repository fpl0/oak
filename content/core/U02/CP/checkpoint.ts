// U02.CP Pitch checkpoint (contracts §7.6; AUTHORING §10). The generated items come from the keyboard,
// steps, staff-reading, compare and match families; these authored items cover what no family measures
// directly: moving a line by semitones (P06, with whole steps P03), octave numbers (P01, P05) and the
// sound of a waveform (D01). Then the checkpoint Make: a line over the band with five or more pitches.
// Notes are names with octaves; `n()` and `.scale()` wait for U03.L02. Spec: content/specs/U02.md.
import { type CheckpointDef, defineCheckpoint } from "@oak/content-kit";

const T = `setcpm(96/4)\n\n`;
const mel = (notes: string, extra = "") => `${T}mel: note("${notes}")${extra}.s("piano")`;
const wave = (sound: string) => `${T}mel: note("c4 e4 g4 e4").s("${sound}").gain(.5)`;

/** Before U03.L02 the grader's melody feedback is worded in degrees; say it in places and letters. */
const LETTER_FEEDBACK = {
  "melody.wrong-degree": "Bar {bar}, {beatLabel}: a different note from the one asked for.",
  "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here.",
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than the target. Check the octave number.",
} as const;

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "U02.CP",
  title: "Pitch checkpoint",
  covers: ["U02"],
  gated: ["P01", "P02", "P03", "P04", "P05", "P06", "N02", "D01"],
  levelSetting: ["E02", "V01"],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "up-a-whole-step",
      version: 1,
      role: "checkpoint",
      prompt:
        "Move this line up a **whole step**: every note two half steps higher. Rewrite the note names or add `.transpose()`; either is fine.",
      skills: [
        { skill: "P06", w: 0.6 },
        { skill: "P03", w: 0.4 },
      ],
      hints: null,
      code: { starter: mel("⟪c4 e4 g4 e4⟫") },
      reference: { solutions: [mel("d4 f#4 a4 f#4")], bars: 1 },
      matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
      target: { audible: true, showRoll: true },
      feedbackText: LETTER_FEEDBACK,
      tests: [
        { name: "reference", response: { code: mel("d4 f#4 a4 f#4") }, expect: "pass" },
        { name: "with transpose", response: { code: mel("c4 e4 g4 e4", ".transpose(2)") }, expect: "pass" },
        { name: "spelled with flats", response: { code: mel("d4 gb4 a4 gb4") }, expect: "pass" },
        {
          name: "unchanged",
          response: { code: mel("c4 e4 g4 e4") },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "white keys only: f for f#",
          response: { code: mel("d4 f4 a4 f4") },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "a whole step and an octave",
          response: { code: mel("d5 f#5 a5 f#5") },
          expect: "fail",
          feedback: ["melody.octave"],
        },
      ],
    },
    {
      kind: "fact",
      id: "number-of-c3",
      version: 1,
      role: "checkpoint",
      prompt: "`c4` is MIDI number 60. Answer with the MIDI number of `c3`, one octave lower.",
      skills: [
        { skill: "P01", w: 0.5 },
        { skill: "P05", w: 0.5 },
      ],
      hints: null,
      answer: { ui: "number" },
      correct: { number: 48 },
      // The catalog line says "Listen to both", but a fact has no sound.
      feedbackText: { "id.wrong": "Not {got}. One octave down takes 12 away from the number." },
      spelling: "strict",
      order: "set",
      tests: [
        { name: "48", response: { answer: { number: 48 } }, expect: "pass" },
        { name: "one less, 59", response: { answer: { number: 59 } }, expect: "fail" },
        { name: "seven white keys, 53", response: { answer: { number: 53 } }, expect: "fail" },
      ],
    },
    {
      kind: "identify",
      id: "which-is-square",
      version: 1,
      role: "checkpoint",
      prompt:
        "Listen to the same four notes on two synth sounds, A and B. Pick the one played on the square wave.",
      skills: [{ skill: "D01", w: 1 }],
      hints: null,
      stimulus: { src: "code", code: wave("sine"), bars: 1, showCode: false },
      cue: { context: "none", countInBars: 0, click: false, replays: -1 },
      answer: {
        ui: "choice",
        layout: "audio-cards",
        options: [
          { id: "a", label: "A", audio: wave("sine") },
          { id: "b", label: "B", audio: wave("square") },
        ],
      },
      correct: { choice: ["b"] },
      // The catalog line names the option IDs (`a`, `b`); say what to listen for instead.
      feedbackText: {
        "id.wrong": "Not that one. The sine is smooth and pure, like a whistle; the square sounds hollow.",
      },
      tests: [
        { name: "the hollow one", response: { answer: { choice: ["b"] } }, expect: "pass" },
        { name: "the pure one", response: { answer: { choice: ["a"] } }, expect: "fail" },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      P02: ["fam.pit.keyboard"],
      P04: ["fam.pit.keyboard"],
      P03: ["fam.pit.steps"],
      N02: ["fam.not.read"],
      E02: ["fam.pit.compare"],
      V01: ["fam.pit.match"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-line",
    version: 1,
    role: "checkpoint",
    prompt:
      "Write a line of two bars or more for the piano over the band, in note names like `e4`. Use at least five different notes; a sharp or a flat is welcome. Done when five or more different notes play.",
    skills: [{ skill: "P02", w: 1 }],
    hints: null,
    code: { starter: mel("<[c4 e4 g4 e4] [c4 e4 g4 ~]>") },
    bars: [2, 4],
    saveAs: "sketch",
    rubric: [
      {
        id: "five-notes",
        label: "Five or more different notes",
        required: true,
        skills: ["P02"],
        rule: "distinct-pitches",
        track: "@melody",
        min: 5,
      },
      {
        id: "on-the-staff",
        label: "Every note from `c4` to `a5`, both included: at most one ledger line off the staff",
        required: false,
        skills: ["N02"],
        rule: "range",
        track: "@melody",
        within: ["c4", "a5"],
      },
    ],
    tests: [
      {
        name: "the starter: three notes",
        response: { code: mel("<[c4 e4 g4 e4] [c4 e4 g4 ~]>") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "minimal: two more notes",
        response: { code: mel("<[c4 e4 g4 e4] [f4 a4 g4 ~]>") },
        expect: "pass",
      },
      {
        name: "beyond the brief: a sharp and a flat that lean into their neighbours",
        response: { code: mel("<[c4 e4 g4 g#4] [a4 c5 bb4 a4]>") },
        expect: "pass",
      },
      {
        name: "only four notes",
        response: { code: mel("<[c4 e4 g4 e4] [c4 e4 g4 c5]>") },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
