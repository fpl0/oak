// U04.L01 Steps Apart. The distance between two notes of a key, counted in degrees with both ends included:
// 1 up to 3 is a 3rd, 1 up to 5 a 5th, 1 up to the 1 above an octave. Heard first as a second voice two
// degrees above the first (the sound of 3rds), then counted, then written: `vox` takes every `n` of `mel`
// plus 2. What the learner has from U03: degrees with `n` (degree − 1), `n` 7 and below 0, syllables.
// Not yet: interval quality and `.transpose("3M")` (U04.L02), `,` (U04.L03). Spec: content/specs/U04.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line in degrees over C major. */
const line = (label: string, pattern: string, key = "C4:major", extra = "") =>
  `${label}: n("${pattern}").scale("${key}").s("piano")${extra}`;
const deg = (pattern: string) => `${TEMPO}${line("mel", pattern)}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: two voices, the upper one two degrees above the lower all the way through (3rds). */
const HOOK = `${TEMPO}${line("mel", "<[0 2 4 2] [3 5 4 ~]>")}\n${line("vox", "<[2 4 6 4] [5 7 6 ~]>", "C4:major", ".gain(.7)")}`;

/** The modify riff: 5 3 1 3 | 4 6 4, and the voice two degrees above it: 7 5 3 5 | 6 1' 6. */
const RIFF = "<[4 2 0 2] [3 5 3 ~]>";
const THIRD = "<[6 4 2 4] [5 7 5 ~]>";
const duo = (vox: string, voxKey = "C4:major", voxExtra = ".gain(.7)") =>
  `${TEMPO}${line("mel", RIFF)}\n${line("vox", vox, voxKey, voxExtra)}`;

/** The Make's starter: one voice. Over the vamp (C, then F) nothing sits a half step above a chord note. */
const MAKE_RIFF = "<[0 2 4 2] [3 2 1 ~]>";

const BAND = { band: "band.two-chord-vamp" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;
/** U03.L08 on: degrees with their syllables, on the roll and under the staff (AUTHORING §6). */
const LABELS = { rollLabels: "degree+solfege", staffLabels: "degree+solfege" } as const;

export default defineLesson({
  id: "U04.L01",
  version: 3,
  title: "Steps Apart",
  objective:
    "I can count the distance between two degrees of a key, and write a second voice a 3rd above a line.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["I01", "E06"],
  practises: [],
  terms: [{ id: "term.interval", step: "S3" }],
  canDo: ["cd.read.intervals-in-key"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Two voices",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "two-voices",
        version: 1,
        role: "practice",
        prompt:
          "Listen for what `vox` does each time `mel` rises or falls. Then mute `vox` for one loop to hear `mel` alone, and bring `vox` back.",
        skills: [{ skill: "I01", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "`mel` below, `vox` above. Follow the upper line.", bars: 2 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Count both ends",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "one-to-five", code: deg("0 ~ 4 ~"), bars: 1 },
      exercise: {
        kind: "predict",
        id: "count-both-ends",
        version: 1,
        role: "practice",
        prompt:
          "Predict a count. This plays degree 1, then degree 5. Walk up the scale from 1 to 5 and count every note on the way, both ends included. Enter that number.",
        skills: [{ skill: "I01", w: 1 }],
        hints: null,
        tests: [],
        code: deg("0 ~ 4 ~"),
        bars: 1,
        mode: "count",
        correct: 5,
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "How far apart",
      minutes: 1,
      ui: { panels: ROLL_STAFF, ...LABELS },
      example: { id: "three-pairs", code: deg("<[0 ~ 2 ~] [0 ~ 4 ~] [0 ~ 7 ~]>"), bars: 3 },
      exercise: {
        kind: "run-investigate",
        id: "how-far-apart",
        version: 1,
        role: "practice",
        prompt:
          "Run the code and read the degree labels. Each bar plays home, then a higher note. Answer both questions below by counting degrees, both ends included: 1 up to 5 is a 5th.",
        skills: [{ skill: "I01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count on the labels, not in the code: start at the lower note as 1 and count up to the higher one.",
        },
        hints: ladder(
          "For the first question, find the bar whose higher note is labelled 5. Read the labels, not the `n` numbers.",
          "`n` counts from 0, so each label is one more than its `n`. For the count, start at the lower note as 1 and walk up.",
          "From 3 up to 4 is a 2nd: two notes, both counted. Go on to 5, then to 6.",
        ),
        code: { starter: deg("<[0 ~ 2 ~] [0 ~ 4 ~] [0 ~ 7 ~]>") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which bar plays a 5th?",
            options: [
              { id: "bar1", label: 'Bar 1: `n("0 ~ 2 ~")`' },
              { id: "bar2", label: 'Bar 2: `n("0 ~ 4 ~")`' },
              { id: "bar3", label: 'Bar 3: `n("0 ~ 7 ~")`' },
            ],
            correct: ["bar2"],
          },
          {
            q: "number",
            prompt: "From degree 3 up to degree 6, both ends counted: how far apart?",
            correct: 4,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bar2"], number: 4 } }, expect: "pass" },
          {
            name: "read the n numbers as the count",
            response: { answer: { choice: ["bar2"], number: 3 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "five as in n 5",
            response: { answer: { choice: ["bar3"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "A 3rd above",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_STAFF, ...LABELS },
      exercise: {
        kind: "code-modify",
        id: "a-third-above",
        version: 1,
        role: "check",
        prompt:
          "`vox` plays the same notes as `mel`. Move every note of `vox` up a 3rd: two degrees higher, so each `n` number in `vox` goes up by 2. Leave `mel` as it is. Done when every `vox` note sits a 3rd above the `mel` note it plays with.",
        skills: [
          { skill: "I01", w: 0.8 },
          { skill: "E06", w: 0.2 },
        ],
        code: {
          starter: `${TEMPO}${line("mel", RIFF)}\nvox: n("⟪${RIFF}⟫").scale("C4:major").s("piano").gain(.7)`,
        },
        reference: { solutions: [duo(THIRD)], bars: 2 },
        // Note against note, in both lines: the upper voice must be exactly a 3rd above at every onset.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: you have {got} ({gotSyl}); a 3rd above `mel` is {exp} ({expSyl}). Count both ends: the note in `mel` is 1.",
        },
        hints: ladder(
          "Each `vox` note must sit a 3rd above the `mel` note it plays with, as in the hook. Count a 3rd from the `mel` note: it is 1.",
          "A 3rd counts three notes, both ends included: two degrees up. In `n`, add the same number to every note of `vox`.",
          "The first note of `mel` is `n` 4, degree 5. A 3rd above it is degree 7: `n` 6. Do the same for each note.",
        ),
        srs: [{ family: "fam.int.in-key", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: duo(THIRD) }, expect: "pass" },
          {
            name: "vox written in note names, softer",
            response: {
              code: `${TEMPO}${line("mel", RIFF)}\nvox: note("<[b4 g4 e4 g4] [a4 c5 a4 ~]>").s("piano").gain(.5)`,
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: duo(RIFF) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "a step above: plus 1",
            response: { code: duo("<[5 3 1 3] [4 6 4 ~]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "two half steps with .transpose(2)",
            response: { code: duo(RIFF, "C4:major", ".transpose(2).gain(.7)") },
            expect: "fail",
            // Half steps are not degrees (3 plus two half steps lands on ♯4, not 5), and the lint flags the move.
            feedback: ["melody.wrong-degree", "code.transpose-after-scale"],
          },
          {
            name: "a 3rd above, an octave too high",
            response: { code: duo(THIRD, "C5:major") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "From home",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "from-home",
        version: 1,
        role: "check",
        prompt:
          "Chords set home, then you hear home and one note above it. Enter both degrees: 1, then the degree of the higher note. That second degree names the distance, so 5 means a 5th.",
        skills: [{ skill: "E06", w: 1 }],
        hints: [
          { text: "Hum the second note, then sing down to home on syllables. How many notes did you sing?" },
          {
            text: "Do up to mi is a 3rd, warm; do up to sol is a 5th, open; the do above is the same syllable, higher.",
          },
          { text: "Hear it again, slower, and sing up from do to the second note.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.int.in-key", level: 1 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "degree-pad",
          set: ["1", "2", "3", "4", "5", "6", "7"],
          sequenceLen: 2,
          syllables: true,
        },
        correct: {},
        srs: [{ family: "fam.int.in-key", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Riff in two voices",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree+solfege", band: BAND },
      exercise: {
        kind: "code-make",
        id: "riff-in-two-voices",
        version: 1,
        role: "practice",
        // The catalog's text for a `uses` rule names the tool ID; the label says it in words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        prompt:
          "Add a `vox` line under `mel` that moves with it note for note. Try it a 3rd above (each `n` plus 2), then a 6th above (each `n` plus 5), and keep the one you like. Done when the riff has two lines that play notes.",
        skills: [{ skill: "I01", w: 1 }],
        code: { starter: deg(MAKE_RIFF) },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "two-voices",
            label: "Two labelled lines that play notes, such as `mel` and `vox`",
            required: true,
            skills: ["I01"],
            rule: "tracks",
            roles: ["melody"],
            min: 2,
          },
          {
            id: "in-key",
            label: "Every note of `vox` is a degree of C major, none raised or lowered",
            required: false,
            skills: ["I01"],
            rule: "degree-set",
            track: "vox",
            subsetOf: ["1", "2", "3", "4", "5", "6", "7"],
          },
          {
            id: "answer",
            label: "`< >` used somewhere, so bar 2 can answer bar 1",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.mini.alt",
          },
        ],
        hints: ladder(
          "The riff has one line that plays notes, `mel`. Add a second one under it, labelled `vox`.",
          "Copy the whole `mel` line onto a new line, rename its label to `vox`, then raise every `n` number by the same amount.",
          "Add 2 to the first note of the copy: `n` 0 becomes `n` 2, a 3rd above. Do the same to the rest.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: deg(MAKE_RIFF) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: a 3rd above",
            response: {
              code: `${deg(MAKE_RIFF)}\n${line("vox", "<[2 4 6 4] [5 4 3 ~]>", "C4:major", ".gain(.7)")}`,
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: a 6th below, hats, a held note",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\n${line("mel", "<[0 2 4 2] [3 2 1@2]>")}\n${line("vox", "<[2 4 6 4] [5 4 3@2]>", "C3:major", ".gain(.6)")}`,
            },
            expect: "pass",
          },
          {
            name: "a second line, but drums",
            response: { code: `${deg(MAKE_RIFF)}\nhats: s("hh*8").gain(.4)` },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
