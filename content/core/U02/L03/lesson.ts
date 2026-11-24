// U02.L03 Half & Whole Steps. Neighbouring keys are a half step apart, two half steps make a whole step,
// and the black keys are named as sharps (#) or flats (b) of their white neighbours; f#4 and gb4 are one
// key. This lesson unlocks accidentals in note names. Spec: content/specs/U02.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band carries drums, bass and chords; the learner writes the line on top. */
const BAND = { band: "band.two-chord-vamp" } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

/**
 * The hook: a creep by the smallest steps (e f f# g) over the Band's C, answered by wider ones (eb f g a)
 * over its F. The stride lands on `a4`, a note of the F chord; an earlier `c4 d4 e4 f#4` ended on F♯
 * against the chord's F, a half step that grated on every loop.
 */
const HOOK = mel("<[e4 f4 f#4 g4] [eb4 f4 g4 a4]>");

/** Before U03.L02 feedback names places and letters, never degrees or solfège. */
const NOTE_FEEDBACK = {
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right key, but {dir} than asked. Check the number after the letter.",
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: a different key from the one asked for. Only the third note moves, up to the very next key.",
  "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here. The line keeps its four notes.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here. The line keeps its four notes.",
} as const;

export default defineLesson({
  id: "U02.L03",
  version: 5,
  title: "Half & Whole Steps",
  objective:
    "I can find half and whole steps on the keyboard and name a black key as a sharp or a flat of its neighbours.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["P03", "P04"],
  practises: [],
  terms: [
    // Two antonym pairs and one term: three by the pair rule (contracts §9.2 rule 5). Both halves of each
    // pair are declared so the tutor's introduced-terms list carries whole step and flat too.
    { id: "term.semitone", step: "S2" },
    { id: "term.whole-step", step: "S2" },
    { id: "term.sharp", step: "S3" },
    { id: "term.flat", step: "S3" },
    { id: "term.enharmonic", step: "S5" },
  ],
  canDo: ["cd.read.half-whole"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Tight and open",
      minutes: 0.5,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "creep-and-stride",
        version: 1,
        role: "practice",
        prompt:
          "Listen for which bar sounds tighter, bar 1 or bar 2. Watch the keys: in which bar do the notes sit closer together?",
        skills: [{ skill: "P03", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Bar 1 climbs four notes; bar 2 climbs four too, across more keys.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "The smallest step",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "smallest-step",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the line and watch the keyboard: find the white keys with no black key between them. Then change `e4 f4` to `c4 d4` and listen again. Answer the two questions below.",
        skills: [{ skill: "P03", w: 1 }],
        feedbackText: {
          "investigate.wrong": "Not quite. Count every key on the way, black and white, then look again.",
        },
        hints: ladder(
          "Find `e4` and `f4` on the keyboard and look between them. Is there a black key there, or nothing?",
          "Count every key, black and white. From `e4`, the very next key up is already `f4`.",
          "From `c4` the next key up is a black key, and `d4` is the one after it.",
        ),
        code: { starter: mel("e4 f4 b4 c5") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "How far is it from `e4` to `f4`?",
            options: [
              { id: "next", label: "To the very next key: no key in between" },
              { id: "two", label: "Two keys: one key in between" },
              { id: "octave", label: "A whole octave" },
            ],
            correct: ["next"],
          },
          {
            q: "number",
            prompt: "Counting black and white keys, how many keys up from `c4` is `d4`?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["next"], number: 2 } }, expect: "pass" },
          {
            name: "counted white keys only",
            response: { answer: { choice: ["next"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "thought e to f skips a key",
            response: { answer: { choice: ["two"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Naming the black keys",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "name-the-black-keys",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the four notes and watch which key lights up for each. `f#4` is `f4` with a `#`, and `gb4` is `g4` with a `b` after the letter. Then answer the two questions below.",
        skills: [{ skill: "P04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Listen again and watch which key lights up for the second note, `f#4`, and for the third, `gb4`.",
        },
        hints: ladder(
          "Watch the keyboard for the second note, `f#4`, and the third, `gb4`. Does one key light up for both, or two different keys?",
          "`#` moves a note up by a half step; `b` after the letter moves it down by a half step.",
          "`f4` up one key and `g4` down one key: count from each side.",
        ),
        code: { starter: mel("f4 f#4 gb4 g4") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Do `f#4` and `gb4` play the same key?",
            options: [
              { id: "same", label: "Yes: one black key, two names" },
              { id: "different", label: "No: two different black keys" },
            ],
            correct: ["same"],
          },
          {
            q: "number",
            prompt: "How many half steps up from `f4` is `f#4`?",
            correct: 1,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["same"], number: 1 } }, expect: "pass" },
          {
            name: "two keys",
            response: { answer: { choice: ["different"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "a whole step",
            response: { answer: { choice: ["same"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "ear",
      title: "Half or whole?",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "half-or-whole",
        version: 1,
        role: "check",
        prompt:
          "Listen to two notes, one after the other. Pick half step if they are neighbouring keys, or whole step if one key lies between them. Six pairs in all.",
        skills: [{ skill: "P03", w: 1 }],
        hints: [
          { text: "Hum both notes. Did your voice barely move, or move a little more?" },
          { text: "A half step is the tight creep of `e4 f4`; a whole step is the open stride of `c4 d4`." },
          { text: "Listen again at a slower speed and hum along.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.pit.steps", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "half", label: "Half step" },
            { id: "whole", label: "Whole step" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.pit.steps", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Raise one note",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "raise-one-note",
        version: 1,
        role: "check",
        prompt:
          "Raise the third note, `f4`, by one half step, to the black key just above it. Keep the other three notes as they are.",
        skills: [
          { skill: "P03", w: 0.5 },
          { skill: "P04", w: 0.5 },
        ],
        code: { starter: mel("⟪c4 d4 f4 g4⟫") },
        reference: { solutions: [mel("c4 d4 f#4 g4"), mel("c4 d4 gb4 g4")], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        target: { audible: true },
        feedbackText: NOTE_FEEDBACK,
        hints: ladder(
          "Only the third note, `f4`, changes: it moves up to the very next key. Which key is that?",
          "The third word of the line is `f4`. A `#` after its letter raises it by a half step; the number stays 4.",
          "A half step above `c4` would be `c#4`. Do the same to the third note.",
        ),
        srs: [{ family: "fam.pit.steps", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: mel("c4 d4 f#4 g4") }, expect: "pass" },
          { name: "the same key, as a flat", response: { code: mel("c4 d4 gb4 g4") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: mel("c4 d4 f4 g4") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a whole step instead of a half",
            response: { code: mel("c4 d4 g4 g4") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "raised the second note",
            response: { code: mel("c4 d#4 f4 g4") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the right key, an octave up",
            response: { code: mel("c4 d4 f#5 g4") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "A whole step up",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "whole-step-above-e4",
        version: 1,
        role: "check",
        prompt: "Play the key one whole step above `e4` on the keyboard. Count black and white keys alike.",
        skills: [
          { skill: "P03", w: 0.5 },
          { skill: "P04", w: 0.5 },
        ],
        hints: ladder(
          "A whole step is two half steps: two keys up from `e4`, black or white. Which key comes first after `e4`?",
          "There is no black key between `e4` and `f4`, so the first key up from `e4` is already `f4`.",
          "The answer is the key right after `f4`: a black key, named from `f` with a `#`.",
        ),
        answer: { ui: "keyboard", range: ["c4", "c5"], mode: "single" },
        expect: { midi: [66] },
        pitchMode: "absolute",
        srs: [{ family: "fam.pit.keyboard", mode: "review-if-due" }],
        tests: [
          { name: "f#4", response: { answer: { midi: [66] } }, expect: "pass" },
          {
            name: "f4, a half step",
            response: { answer: { midi: [65] } },
            expect: "fail",
            feedback: ["kb.wrong-note"],
          },
          {
            name: "g4, two white keys",
            response: { answer: { midi: [67] } },
            expect: "fail",
            feedback: ["kb.wrong-note"],
          },
          {
            name: "f#5",
            response: { answer: { midi: [78] } },
            expect: "fail",
            feedback: ["kb.octave"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "One black key",
      minutes: 2.5,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "riff-black-key",
        version: 1,
        role: "practice",
        prompt:
          "Your riff from The White Keys is in the editor, for the fourth part of your song. Give it at least **one note on a black key**, written with `#` or `b`, such as `f#4` or `bb4`. Listen to it with the band. Done when a black key sounds in the riff.",
        skills: [
          { skill: "P04", w: 0.5 },
          { skill: "P03", w: 0.5 },
        ],
        code: { starter: mel("c4 e4 g4 a4") },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "black-key",
            label: "At least one note lands on a black key, written with `#` or `b`",
            required: true,
            skills: ["P04"],
            // Corrections gate (AS-38): the note lands on a black key (`e#4` is spelt with a sharp but sounds F).
            rule: "custom",
            fn: "black-keys",
            params: { alsoUses: ["tb.note.accidentals"] },
          },
          {
            id: "steps",
            label: "At least half of the moves to another note are half or whole steps",
            required: false,
            skills: ["P03"],
            rule: "step-ratio",
            track: "@melody",
            min: 0.5,
          },
          {
            id: "four-notes",
            label: "Four or more different notes",
            required: false,
            skills: ["P02"],
            rule: "distinct-pitches",
            track: "@melody",
            min: 4,
          },
        ],
        hints: ladder(
          "The riff needs one note on a black key, and yours uses white keys only. Which of its notes could slide to a black key next to it?",
          "A `#` after the letter raises a note by a half step and a `b` lowers it. Try it on one note of your riff: an `e4` becomes `eb4`, an `a4` becomes `bb4`.",
          "End bar 1 on `bb4`, the black key below `b4`, and start bar 2 on `a4`: `<[c4 e4 g4 bb4] [a4 g4 f4 c4]>`. Over the band, the `bb4` sags into the `a4`.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: mel("c4 e4 g4 a4") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: mel("c4 e4 g4 bb4") }, expect: "pass" },
          {
            name: "beyond the brief",
            response: { code: mel("<[e4 f4 f#4 g4] [a4 ~ g4 eb4]>") },
            expect: "pass",
          },
          {
            // Hint 3's riff: B flat over the band's C chord falls a half step to A, a note of its F chord.
            name: "hint 3: a flat that sags into the next bar",
            response: { code: mel("<[c4 e4 g4 bb4] [a4 g4 f4 c4]>") },
            expect: "pass",
          },
          {
            name: "white keys only",
            response: { code: mel("<[c4 d4 e4 g4] [a4 g4 f4 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
