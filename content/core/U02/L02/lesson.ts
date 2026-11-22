// U02.L02 The White Keys. The seven letters a to g on the white keys, the octave number that changes at
// every c, and c4 = 60 (as a fact: `note(60)` waits for U02.L05). No sharps or flats yet (U02.L03).
// Spec: content/specs/U02.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
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

/** The hook: a bright white-key riff that climbs and comes home, over the band. */
const HOOK = mel("<[c4 e4 g4 a4] [g4 e4 d4 c4]>");
/** The white keys from c4 up to the next c, one per eighth. */
const WHITE_KEYS = mel("c4 d4 e4 f4 g4 a4 b4 c5");
/** S5's target: the line the roll shows. */
const TARGET = "e4 g4 a4 g4";

/** Before U03.L02 feedback names places and letters, never degrees or solfège. */
const NOTE_FEEDBACK = {
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than the roll shows. Check the number after the letter.",
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: a different letter from the one on the roll. Count the keys from the nearest c.",
  "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here. The line has four notes.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here. The line has four notes.",
} as const;

export default defineLesson({
  id: "U02.L02",
  version: 3,
  title: "The White Keys",
  objective: "I can name the white keys a to g, give each its octave number, and find c4, number 60.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["P02", "P05"],
  practises: [],
  terms: [{ id: "term.middle-c", step: "S4" }],
  canDo: ["cd.code.notes"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Five white keys",
      minutes: 0.5,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "white-key-riff",
        version: 1,
        role: "practice",
        prompt:
          "Listen for the note the riff starts on and the note it ends on. Watch which keys light up as it plays.",
        skills: [{ skill: "P02", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Bar 1 climbs away from `c4`; bar 2 walks back down.", bars: 2 }],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Find the e",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "find-the-e",
        version: 1,
        role: "practice",
        prompt:
          "Find the note labelled `e4` on the roll and click it. While the line plays, watch which key lights up for it.",
        skills: [{ skill: "P02", w: 1 }],
        feedbackText: {
          "investigate.not-here":
            "Not that note. Find the label that reads `e4` on the roll and click that note.",
        },
        hints: ladder(
          "Every note on the roll carries a label, a letter and a number. Find the one that reads `e4`.",
          "The roll plays left to right: the first note is `c4`, the second is the one you want.",
          "On the keys, `e4` is two white keys up from `c4`.",
        ),
        code: { starter: mel("c4 e4 g4 a4") },
        mustPlayLoops: 1,
        questions: [
          { q: "click-roll", prompt: "Click the note labelled `e4`.", target: { track: "mel", beat: 2 } },
        ],
        tests: [
          // `${TEMPO}mel: note("c4 ` is 28 characters: the e4 sits at 28–30, the c4 at 25–27.
          { name: "the e4", response: { click: { from: 28, to: 30 } }, expect: "pass" },
          {
            name: "the c4",
            response: { click: { from: 25, to: 27 } },
            expect: "fail",
            feedback: ["investigate.not-here"],
          },
          {
            name: "the g4",
            response: { click: { from: 31, to: 33 } },
            expect: "fail",
            feedback: ["investigate.not-here"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "concept",
      title: "Seven letters, then again",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      example: { id: "white-keys", code: WHITE_KEYS, bars: 1 },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Find it on the keys",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "all",
        id: "find-on-the-keys",
        version: 1,
        role: "check",
        prompt: "Play three keys on the keyboard, one at a time: `c4`, then `e4`, then `a3`.",
        skills: [
          { skill: "P02", w: 0.5 },
          { skill: "P05", w: 0.5 },
        ],
        hints: ladder(
          "Find each key by its letter and its number: first the right `c`, then count white keys from it. Which `c` is `c4`?",
          "Every `c` sits just left of a pair of black keys. The number says which of them.",
          "`c4` is the c nearest the middle of the keyboard. Count white keys up or down from it.",
        ),
        srs: [{ family: "fam.pit.keyboard", mode: "seed" }],
        tests: [],
        parts: [
          {
            kind: "keyboard",
            id: "key-c4",
            version: 1,
            role: "check",
            prompt: "Play `c4` on the keyboard.",
            skills: [{ skill: "P05", w: 1 }],
            hints: ladder(
              "Play the `c` with the number 4. The keyboard has several `c` keys: which one is it?",
              "Every `c` is the white key just left of a pair of black keys. The number 4 picks one of them.",
              "`c4` is the `c` nearest the middle of the keyboard.",
            ),
            answer: { ui: "keyboard", range: ["c3", "c5"], mode: "single" },
            expect: { midi: [60] },
            pitchMode: "absolute",
            tests: [
              { name: "c4", response: { answer: { midi: [60] } }, expect: "pass" },
              { name: "c5", response: { answer: { midi: [72] } }, expect: "fail", feedback: ["kb.octave"] },
              {
                name: "d4",
                response: { answer: { midi: [62] } },
                expect: "fail",
                feedback: ["kb.wrong-note"],
              },
            ],
          },
          {
            kind: "keyboard",
            id: "key-e4",
            version: 1,
            role: "check",
            prompt: "Play `e4` on the keyboard.",
            skills: [{ skill: "P02", w: 1 }],
            hints: ladder(
              "Find `c4` first, then count white keys up to `e`. Which way is up on the keyboard?",
              "The letters go up the keyboard in order: c, d, e.",
              "`d4` is the white key right after `c4`.",
            ),
            answer: { ui: "keyboard", range: ["c3", "c5"], mode: "single" },
            expect: { midi: [64] },
            pitchMode: "absolute",
            tests: [
              { name: "e4", response: { answer: { midi: [64] } }, expect: "pass" },
              { name: "e3", response: { answer: { midi: [52] } }, expect: "fail", feedback: ["kb.octave"] },
              {
                name: "f4",
                response: { answer: { midi: [65] } },
                expect: "fail",
                feedback: ["kb.wrong-note"],
              },
            ],
          },
          {
            kind: "keyboard",
            id: "key-a3",
            version: 1,
            role: "check",
            prompt: "Play `a3` on the keyboard.",
            skills: [
              { skill: "P02", w: 0.5 },
              { skill: "P05", w: 0.5 },
            ],
            hints: ladder(
              "Find `c4` first. `a3` has a smaller number: is it to the left of `c4` or to the right?",
              "The number changes at every c, so `a3` sits a little below `c4`.",
              "Just below `c4` comes `b3`.",
            ),
            answer: { ui: "keyboard", range: ["c3", "c5"], mode: "single" },
            expect: { midi: [57] },
            pitchMode: "absolute",
            tests: [
              { name: "a3", response: { answer: { midi: [57] } }, expect: "pass" },
              {
                name: "the a above c4",
                response: { answer: { midi: [69] } },
                expect: "fail",
                feedback: ["kb.octave"],
              },
              {
                name: "b3",
                response: { answer: { midi: [59] } },
                expect: "fail",
                feedback: ["kb.wrong-note"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Write what the roll shows",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "write-the-roll",
        version: 1,
        role: "check",
        prompt:
          "Write the four-note line the roll shows in place of the four `c4`s, left to right: a letter and a number for every note. Done when your line matches the roll note for note.",
        skills: [
          { skill: "P02", w: 0.5 },
          { skill: "P05", w: 0.5 },
        ],
        code: { starter: mel("⟪c4 c4 c4 c4⟫") },
        reference: { solutions: [mel(TARGET)], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        target: { audible: true, showRoll: true },
        feedbackText: NOTE_FEEDBACK,
        hints: ladder(
          "Replace each `c4` with the note at the same place on the roll, left to right. Which label does the first note carry?",
          "Each roll label is a letter and a number, like `e4`. Copy the four labels, in order, into the four places.",
          "The first note is `e4`. Read the other three the same way.",
        ),
        srs: [{ family: "fam.pit.keyboard", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: mel(TARGET) }, expect: "pass" },
          {
            name: "same notes, a little softer",
            response: { code: mel(TARGET, ".gain(.8)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: mel("c4 c4 c4 c4") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "right letters, an octave low",
            response: { code: mel("e3 g3 a3 g3") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "one letter off",
            response: { code: mel("d4 g4 a4 g4") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "three notes only",
            response: { code: mel("e4 g4 a4") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Numbers for notes",
      minutes: 0.5,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "fact",
        id: "number-of-c3",
        version: 1,
        role: "check",
        prompt:
          "`c4` is number 60 and `c5` is number 72. Work out the number of `c3` and answer with that number.",
        skills: [{ skill: "P05", w: 1 }],
        hints: ladder(
          "`c3` is one octave below `c4`. How far apart are the numbers of `c4` and `c5`, one octave apart?",
          "One step up in the octave number adds 12. One step down takes 12 away.",
          "`c6` would be 84: 72 and another 12.",
        ),
        feedbackText: { "id.wrong": "Not {got}. Going down one octave takes 12 away from the number." },
        answer: { ui: "number" },
        correct: { number: 48 },
        spelling: "strict",
        order: "set",
        tests: [
          { name: "48", response: { answer: { number: 48 } }, expect: "pass" },
          { name: "one less than 60", response: { answer: { number: 59 } }, expect: "fail" },
          { name: "went up instead", response: { answer: { number: 84 } }, expect: "fail" },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A white-key riff",
      minutes: 2.75,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "white-key-riff-make",
        version: 1,
        role: "practice",
        prompt:
          "Write a riff on the `mel:` line with at least **four different white-key notes**. The starter has two, `c4` and `e4`. Done when four or more different notes play.",
        skills: [
          { skill: "P02", w: 0.5 },
          { skill: "P05", w: 0.5 },
        ],
        code: { starter: mel("c4 e4 ~ c4") },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "four-notes",
            label: "Four or more different notes on the `mel:` line",
            required: true,
            skills: ["P02"],
            rule: "distinct-pitches",
            track: "@melody",
            min: 4,
          },
          {
            id: "one-octave",
            label: "Lowest to highest note at most one octave apart, like `c4` to `c5`",
            required: false,
            skills: ["P05"],
            rule: "range",
            track: "@melody",
            maxSpan: 12,
          },
          // Spec suggestion `ends-on-degree` ["1"] is left out: its rubric detail reads "it ends on 6; the
          // brief asks for 1", degree numbers the learner meets only in U03.L02 (reported to the grader).
          {
            id: "two-bars",
            label: "Uses `< >`, so bar 2 can answer bar 1",
            required: false,
            skills: ["P02"],
            rule: "uses",
            tool: "tb.mini.alt",
          },
        ],
        hints: ladder(
          "The riff needs four different notes, and the starter plays two, `c4` and `e4`. Where could new ones go?",
          "Replace the `~` and the last `c4` with white keys between `c4` and `c5` that the riff does not use yet. All of them fit the band.",
          "One new letter where the `~` is and another where the last `c4` is makes four different notes.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: mel("c4 e4 ~ c4") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: mel("c4 e4 g4 a4") }, expect: "pass" },
          {
            name: "beyond the brief",
            response: { code: mel("<[e4 g4 a4 g4] [f4 e4 d4 c4]>") },
            expect: "pass",
          },
          {
            name: "three letters",
            response: { code: mel("c4 e4 g4 e4") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
