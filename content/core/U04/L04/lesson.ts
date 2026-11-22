// U04.L04 Interval Ear Lab. No new idea: intervals inside a key become familiar by hearing many of them,
// named as they play (passive blocks, AUTHORING §16.5), then by naming them: up, down, and together. A sung
// pair (1 up to 3, 1 up to 5) seeds `fam.int.sing`. The Make answers a one-bar riff with the same shape a
// named distance away; the grader hears the shape in half steps (`transposed-copy`: same rhythm, every note moved
// by one interval). Spec: content/specs/U04.md.
import { type AnswerUi, defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const deg = (pattern: string) => `${TEMPO}mel: n("${pattern}").scale("C4:major").s("piano")`;
const mel = (pattern: string, link = "") => `${TEMPO}mel: note("${pattern}")${link}.s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: home, then a 5th, a 3rd, a 6th and the octave above it, one per bar. */
const HOOK = deg("<[0 ~ 4 ~] [0 ~ 2 ~] [0 ~ 5 ~] [0 ~ 7 ~]>");

/** The Make: a one-bar riff; bar 2 is empty. A 4th up (F A C A) fits the vamp's F chord note for note. */
const MAKE_STARTER = mel("<[c4 e4 g4 e4] ~>");

const BAND = { band: "band.two-chord-vamp" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Both notes of a pair, by degree, on syllables. */
const PAD: AnswerUi = {
  ui: "degree-pad",
  set: ["1", "2", "3", "4", "5", "6", "7"],
  sequenceLen: 2,
  syllables: true,
};

export default defineLesson({
  id: "U04.L04",
  version: 3,
  title: "Interval Ear Lab",
  objective: "I can name the distance between two notes in a key, up, down and played together.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E06"],
  terms: [],
  canDo: ["cd.hear.intervals"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Hear them named",
      minutes: 1.25,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "hear-them-named",
        version: 1,
        role: "practice",
        prompt:
          "Listen for the colour of each distance: close, warm, open or wide. First home plays with a 5th, a 3rd, a 6th and the octave above it. Then twelve pairs from anywhere in the key, each named as it plays. Nothing to answer.",
        skills: [{ skill: "E06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Home, then a 5th, a 3rd, a 6th and the octave. Hear how far each one reaches.",
            bars: 4,
          },
        ],
        passive: { family: "fam.int.in-key", level: 3, items: 12, reveal: "with", gapBeats: 2 },
      },
    },
    {
      id: "S2",
      kind: "ear",
      title: "Pairs going up",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "pairs-up",
        version: 1,
        role: "check",
        prompt:
          "Chords set home, then you hear two notes from anywhere in the key, the second higher than the first. Enter both degrees, in the order they play.",
        skills: [{ skill: "E06", w: 1 }],
        hints: [
          {
            text: "Place the first note against home: sing down from it to do and note the syllable you started on.",
          },
          {
            text: "Then count up from the first note to the second, both ends included: that is the distance.",
          },
          {
            text: "Hear it again, slower, and sing the scale up between the two notes.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.int.in-key", level: 3 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: PAD,
        correct: {},
        srs: [{ family: "fam.int.in-key", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S3",
      kind: "listen",
      title: "Guess, then hear",
      minutes: 0.75,
      ui: { panels: NONE },
      exercise: {
        kind: "listen",
        id: "guess-then-hear",
        version: 1,
        role: "practice",
        prompt:
          "Eight pairs, each going down. Listen for how far the second note falls, name the distance silently, then hear Oak name it. Nothing to answer.",
        skills: [{ skill: "E06", w: 1 }],
        hints: null,
        tests: [],
        items: [],
        passive: { family: "fam.int.in-key", level: 4, items: 8, reveal: "after", gapBeats: 2 },
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Pairs going down",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "pairs-down",
        version: 1,
        role: "check",
        prompt:
          "Chords set home, then you hear two notes from anywhere in the key, the second lower than the first. Enter both degrees, in the order they play.",
        skills: [{ skill: "E06", w: 1 }],
        hints: [
          {
            text: "Place the first note against home: sing down from it to do and note its syllable. Then place the second note.",
          },
          {
            text: "Sing down from the first note to the second on syllables and count both ends: that is the distance.",
          },
          {
            text: "Hear it again, slower, and sing the scale down between the two notes.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.int.in-key", level: 4 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: PAD,
        correct: {},
        srs: [{ family: "fam.int.in-key", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "sing",
      title: "Sing up from do",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-up-from-do",
        version: 1,
        role: "practice",
        prompt:
          "Chords set home. Sing four notes on syllables, two beats each: do, then up a 3rd to mi, then do again, then up a 5th to sol.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "E06", w: 0.4 },
        ],
        hints: [
          { text: "Hum do first, the note the chords end on. Hold it before you move." },
          {
            text: "Mi is two degrees above do, sol two more above mi. Pass through them quietly if the jump feels far.",
          },
          { text: "Hear the pattern on the piano once, then sing it back.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        mode: "degree",
        stimulus: { src: "code", code: deg("<[0 2] [0 4]>"), bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["1", "3", "1", "5"] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        srs: [{ family: "fam.int.sing", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Pairs together",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "pairs-together",
        version: 1,
        role: "check",
        prompt: "Chords set home, then you hear two notes at once. Enter both degrees, the lower note first.",
        skills: [{ skill: "E06", w: 1 }],
        hints: [
          { text: "Hum the top note, then the bottom one, and name each by its syllable." },
          {
            text: "Find each note on its way down to do. Rest or clash tells you something too: 2nds and 7ths rub.",
          },
          { text: "Hear it again, slower, and hum both notes one after the other.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.int.in-key", level: 5 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: PAD,
        correct: {},
        srs: [{ family: "fam.int.in-key", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Answer the riff",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      exercise: {
        kind: "code-make",
        id: "answer-the-riff",
        version: 1,
        role: "practice",
        prompt:
          "Bar 2 is empty. Fill it with bar 1's riff moved up or down by one distance, every note by the same number of half steps. A perfect 4th up puts it on the band's F chord. Done when bar 2 is bar 1 at a new height, every distance inside it the same size.",
        skills: [{ skill: "E06", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "same-shape",
            label: "Bar 2 plays bar 1's notes, all moved up or down by the same number of half steps",
            required: true,
            skills: ["E06", "I01"],
            // The exact copy, moved (review finding theory-c A2): the same rhythm, and every note of bar 1 moved by one
            // interval, so every distance inside the riff keeps its size. Read on one pass of the loop.
            rule: "custom",
            fn: "transposed-copy",
            // Corrections gate (AS-10): the answer is bar 2 of the same line, as the brief says.
            params: { pairs: [[1, 2]], alone: true },
          },
          {
            id: "named",
            label: "`.transpose()` used with an interval name in quotes",
            required: false,
            skills: ["I02"],
            rule: "uses",
            tool: "tb.transpose.interval",
          },
          {
            id: "home",
            label: "The last note of the melody is 1, home",
            required: false,
            skills: ["E04"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
        ],
        // The check compares half steps (an exact copy, moved). Moving the riff by degrees inside the key
        // (`n` plus 2, as in U04.L01) turns C–E, a major 3rd, into E–G, a minor one, and fails.
        // Corrections gate: the rule's own detail reaches the learner ("bar 2 does not bring back bar 1: …").
        hints: ladder(
          "Bar 2 is a rest now. Fill it with bar 1's riff, every note moved by the same distance, so it answers bar 1 instead of starting a new idea.",
          "The same shape is the same distances between the notes, in half steps. Move every note of bar 1 by one named distance, up or down: a major 3rd stays a major 3rd.",
          "A 4th above C is F: the answer starts on `f4`. Move the other three notes the same way, five half steps each.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: a 4th up, by hand",
            response: { code: mel("<[c4 e4 g4 e4] [f4 a4 c5 a4]>") },
            expect: "pass",
          },
          {
            name: "beyond the brief: a 5th up, a split last beat, hats",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: note("<[c4 e4 g4 [e4 d4]] [g4 b4 d5 [b4 a4]]>").s("piano")`,
            },
            expect: "pass",
          },
          {
            // Review finding (theory-c A2): E4→D4 falls 2 half steps, B4→C5 rises 1: not the same shape.
            name: "a 5th up, the last note bent home",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: note("<[c4 e4 g4 [e4 d4]] [g4 b4 d5 [b4 c5]]>").s("piano")`,
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a 4th down, named",
            response: { code: mel("[c4 e4 g4 e4]", '.transpose("<1P -4P>")') },
            expect: "pass",
          },
          {
            name: "a whole step up, by hand, with a held note",
            response: { code: mel("<[c4 e4 g4@2] [d4 f#4 a4@2]>") },
            expect: "pass",
          },
          {
            name: "bar 1 played again at the same pitch",
            response: { code: mel("<[c4 e4 g4 e4] [c4 e4 g4 e4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a patterned named move",
            response: { code: mel("[c4 e4 g4 e4]", '.transpose("<1P 4P>")') },
            expect: "pass",
          },
          {
            name: "bar 2 a different shape",
            response: { code: mel("<[c4 e4 g4 e4] [g4 f4 e4 d4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            // A sequence by degrees: E–G is a minor 3rd where C–E is major, so the shape is not kept.
            name: "moved up a 3rd inside the key, by degrees",
            response: { code: mel("<[c4 e4 g4 e4] [e4 g4 b4 g4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a major 3rd up, named",
            response: { code: mel("[c4 e4 g4 e4]", '.transpose("<1P 3M>")') },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
