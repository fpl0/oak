// U02.L01 High & Low (exemplar). Pitch and octaves with note("c3 c4 c5").s("piano"); higher or lower by
// ear. The learner meets only C in different octaves here: the seven letters and C4 = 60 are U02.L02's.
// Everything from U01 is in reach (rests, [ ], < >, @, _, !, labels, gain, banks). Spec: content/specs/U02.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
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
const ROLL = { roll: true, staff: false, keyboard: false } as const;

/** The hook: a line that climbs through three octaves of C and falls back, over the band. */
const HOOK = mel("<[c3 ~ c4 c5] [~ c5 c4 c3]>");

export default defineLesson({
  id: "U02.L01",
  version: 3,
  title: "High & Low",
  objective: "I can hear which of two notes is higher and move a line up or down by an octave in code.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["P01", "E02"],
  practises: [],
  terms: [
    { id: "term.pitch", step: "S4" },
    { id: "term.octave", step: "S5" },
  ],
  canDo: ["cd.hear.higher-lower"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Up and back down",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "up-and-down",
        version: 1,
        role: "practice",
        prompt:
          "Listen for how many different heights the piano uses over the two bars. Let your hand rise as it climbs and sink as it falls.",
        skills: [{ skill: "P01", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Bar 1 climbs; bar 2 takes the same steps back down.", bars: 2 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which one is higher?",
      minutes: 0.5,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      example: { id: "two-notes", code: mel("c3 ~ c5 ~"), bars: 1 },
      exercise: {
        kind: "predict",
        id: "which-is-higher",
        version: 1,
        role: "practice",
        prompt:
          "Predict which note will sound higher: the first, `c3`, or the second, `c5`. Hum your guess, then pick one answer.",
        skills: [{ skill: "P01", w: 1 }],
        hints: null,
        tests: [],
        code: mel("c3 ~ c5 ~"),
        bars: 1,
        mode: "choose",
        choices: [
          { id: "first", label: "The first, `c3`" },
          { id: "second", label: "The second, `c5`" },
          { id: "same", label: "Neither: they are the same note" },
        ],
        correct: ["second"],
      },
    },
    {
      id: "S3",
      kind: "run",
      title: "Watch the roll",
      minutes: 0.5,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      example: { id: "three-heights", code: mel("c3 c4 c5 c4"), bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "watch-the-roll",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the four notes once through. Watch where each one lands on the roll, where low notes sit at the bottom and high notes at the top, and which key lights up.",
        skills: [{ skill: "P01", w: 1 }],
        hints: ladder(
          "Watch the roll while the four notes play: one of them sits above the other three. Which one?",
          "The roll is drawn like a graph: low notes at the bottom, high notes at the top. Compare the third note with the first.",
          "`c5` is the third note; it sits above the others.",
        ),
        tests: [],
        code: { starter: mel("c3 c4 c5 c4") },
        mustPlayLoops: 1,
        questions: [],
      },
    },
    {
      id: "S4",
      kind: "investigate",
      title: "The number decides",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "number-decides",
        version: 1,
        role: "practice",
        prompt:
          "Change the number after one `c` at a time, and listen after each change. Then answer the two questions below: which change makes a note higher, and how many different heights the line plays.",
        skills: [{ skill: "P01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Change one number at a time and watch the roll. Then count the heights, not the notes: a height that comes back counts once.",
        },
        hints: ladder(
          "Change one number, listen, and compare with before. When the number went up, did the note go up or down?",
          "Change the first note, `c3`, to `c2`, then the third note, `c5`, to `c6`. Watch where each one moves on the roll.",
          "A bigger number puts the note higher on the roll: that answers the first question. For the second, `c4` plays twice but is one height.",
        ),
        code: { starter: mel("c3 c4 c5 c4") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which change makes a note sound higher?",
            options: [
              { id: "bigger", label: "A bigger number after the `c`" },
              { id: "smaller", label: "A smaller number after the `c`" },
              { id: "neither", label: "The number changes how loud it is, not how high" },
            ],
            correct: ["bigger"],
          },
          {
            q: "number",
            prompt:
              "How many different heights does `c3 c4 c5 c4` play? A height that comes back counts once.",
            correct: 3,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["bigger"], number: 3 } }, expect: "pass" },
          {
            name: "smaller is higher",
            response: { answer: { choice: ["smaller"], number: 3 } },
            expect: "fail",
          },
          {
            name: "counted every note",
            response: { answer: { choice: ["bigger"], number: 4 } },
            expect: "fail",
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Lift the line",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "lift-the-line",
        version: 1,
        role: "check",
        prompt:
          "Lift the line: make each number after a `c` one bigger, so `c2` becomes `c3` and `c3` becomes `c4`. Keep the letters and the `~` where they are. Done when all three notes play one number higher.",
        skills: [{ skill: "P01", w: 1 }],
        code: { starter: mel("⟪c2 ~ c2 c3⟫") },
        reference: { solutions: [mel("c3 ~ c3 c4")], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        target: { audible: true, showRoll: true },
        // The catalog says "an octave higher" (the term arrives in this step's pass text) and names notes as
        // scale degrees, which wait for U03.L02. Before then, feedback names places and letters only.
        feedbackText: {
          "melody.octave":
            "Bar {bar}, {beatLabel}: the right letter, but {dir} than the target. Check the number after the `c`.",
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: a different note from the one asked for. Keep the letter `c` and change only the number.",
          "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here. Did a `~` go missing too?",
          "melody.extra-note":
            "Bar {bar}, {beatLabel}: one note too many here. The line keeps three notes and one `~`, in the same places.",
        },
        hints: ladder(
          "Every note must sound one step higher, and every letter stays `c`. Which part of `c2` sets its height?",
          "Only the digits change: the one after each `c`, in the first, third and fourth words. The `~` stays second.",
          "The first note becomes `c3`. Add 1 to the other two numbers the same way.",
        ),
        srs: [{ family: "fam.pit.compare", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: mel("c3 ~ c3 c4") }, expect: "pass" },
          {
            name: "same notes, a little softer",
            response: { code: mel("c3 ~ c3 c4", ".gain(.8)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: mel("c2 ~ c2 c3") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "two higher instead of one",
            response: { code: mel("c4 ~ c4 c5") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "moved only the first note",
            response: { code: mel("c3 ~ c2 c3") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "lost the rest",
            response: { code: mel("c3 c3 c4") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Higher or lower?",
      minutes: 1.5,
      graded: true,
      ui: { panels: { roll: false, staff: false, keyboard: false } },
      exercise: {
        kind: "identify",
        id: "higher-or-lower",
        version: 1,
        role: "check",
        prompt:
          "Listen to two notes, one after the other. Pick whether the second note is higher than the first, lower, or the same note. Six pairs in all.",
        skills: [{ skill: "E02", w: 1 }],
        hints: [
          {
            text: "Compare the second note with the first: hum the first, then the second. Did your voice go up, down, or stay?",
          },
          {
            text: "Listen to the end of the first note and the start of the second. A higher note would sit higher on the roll: picture where each one lands.",
          },
          { text: "Listen again at a slower speed and hum along.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.pit.compare", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: 2 },
        answer: {
          ui: "choice",
          options: [
            { id: "higher", label: "Higher" },
            { id: "lower", label: "Lower" },
            { id: "same", label: "The same" },
          ],
        },
        correct: {},
        srs: [{ family: "fam.pit.compare", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A riff in three heights",
      minutes: 2.75,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "riff-three-heights",
        version: 1,
        role: "practice",
        prompt:
          "Write a piano riff on the `mel:` line that plays `c` at **three or more** different heights, such as `c3`, `c4` and `c5`. Done when at least three different numbers follow the `c`s.",
        skills: [{ skill: "P01", w: 1 }],
        code: { starter: mel("c3 ~ c4 ~") },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "three-heights",
            label: "Three or more different pitches on the `mel:` line",
            required: true,
            skills: ["P01"],
            rule: "distinct-pitches",
            track: "@melody",
            min: 3,
          },
          {
            id: "space",
            label: "At least one `~` (a rest) for space",
            required: false,
            skills: ["R06"],
            rule: "uses",
            tool: "tb.mini.rest",
          },
          {
            id: "comfortable",
            label: "Every note from `c2` to `c6`, both included",
            required: false,
            skills: ["P01"],
            rule: "range",
            track: "@melody",
            within: ["c2", "c6"],
          },
          {
            id: "two-bars",
            label: "Uses `< >`, so bar 2 can answer bar 1",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.mini.alt",
          },
        ],
        hints: ladder(
          "The riff needs `c` at three different heights, and the starter has two. Which number could you add?",
          "The starter plays `c3` and `c4`, each followed by a `~`. Replace one `~` with a `c` at a third height.",
          "A `c` whose number is neither 3 nor 4, in place of the last `~`, gives the third height.",
        ),
        tests: [
          { name: "minimal", response: { code: mel("c3 ~ c4 c5") }, expect: "pass" },
          {
            name: "beyond the brief",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.4)\nmel: note("<[c3 c4 ~ c5] [c5 ~ c4 [c3 c2]]>").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: mel("c3 ~ c4 ~") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
