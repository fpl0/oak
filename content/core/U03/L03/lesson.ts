// U03.L03 Restless Neighbours. Degrees 2 and 4 lean home (2 to 1, 4 to 3); `n` below 0 and from 7 up
// reaches under and over the home octave (`tb.n.range` unlocks here). What the learner has from U03.L02:
// `n` = degree − 1 over `.scale("C4:major")` with `n` 0 to 6, degree labels on the roll and the staff,
// 1, 3 and 5 by ear after a few chords that set home, a sung 1 3 5 3 1. Not yet: `..` (U03.L04), a
// patterned `.scale()` (U03.L05), syllables (U03.L08), `ebass` and `.lpf()` in learner code (granted when
// this lesson completes, contracts §3.1 rule 12). Spec: content/specs/U03.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 84;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line written in degrees: `n` over a major scale. */
const deg = (pattern: string, key = "C4:major", extra = "") =>
  `${TEMPO}mel: n("${pattern}").scale("${key}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The hook: 3 4-3 2 (rest), then 4 3 2-5 1, the 5 below home (`n` -3). Over the vamp's C chord the 4 is an
 * eighth that falls straight to 3; over its F chord the 4 is a chord note.
 */
const HOOK = deg("<[2 [3 2] 1 ~] [3 2 [1 -3] 0]>");
/** Below home, home, and the octave above it: 5, 7, 1, 3, 5, then 1 an octave up. */
const SPAN = deg("-3 -1 0 2 4 7");
/** The four-note line of S4: 5 3 2 1. */
const LINE = "4 2 1 0";
const LINE_LOW = "-3 -5 -6 -7";
/** Two endings over the same start: 5 4 then …2 1, or …1 2. */
const SETTLES = "4 3 1 0";
const HANGS = "4 3 0 1";

const BAND = { band: "band.two-chord-vamp", followsLearnerKey: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;

/** The catalog's `melody.wrong-degree` reads "you have 5 (sol)": syllables wait for U03.L08. */
const NUMBERS = {
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: you have degree {got}; the line has degree {exp}, an octave down. Seven numbers make one octave: take 7 from each number of the starter.",
} as const;

/** Sung drift, in numbers: the catalog's text says "re-anchor on do". */
const DRIFT = {
  "sing.drift": "You drifted {cents}¢ {dir}. Hum home again, the note the chords end on, and start from it.",
} as const;
const SING_TOL = {
  cents: "learner",
  octave: "global",
  driftCompCents: 30,
  minCoverage: 0.4,
  passHitRate: 0.8,
} as const;
const SING_HINTS: HintLadder = [
  {
    text: "Start from home: hum the note the chords end on. Each pattern starts or ends on it, or on the home an octave above.",
  },
  {
    text: "2 is the next note of the scale above home, and 4 is three notes above it. Sing up the scale from 1 to find them.",
  },
  { text: "Hear the pattern on the piano once, then sing it back.", replay: { rate: 0.75 } },
  "auto",
];

export default defineLesson({
  id: "U03.L03",
  version: 3,
  title: "Restless Neighbours",
  objective: "I can hear degrees 2 and 4 lean home, sing them there, and reach below or above home with `n`.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["E05", "V03"],
  practises: ["S02"],
  terms: [{ id: "term.resolution", step: "S5" }],
  canDo: ["cd.sing.neighbours"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Lean and settle",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "lean-and-settle",
        version: 1,
        role: "practice",
        prompt:
          "Watch the degree labels as the line plays. Some notes sound like they are waiting; others let the line rest. Listen for which numbers do the waiting.",
        skills: [{ skill: "E05", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "Bar 1 stops short of home. Bar 2 gets there, with one dip below it.",
            bars: 2,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Below zero",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "minus-three", code: deg("-3 0 ~ ~"), bars: 1 },
      exercise: {
        kind: "predict",
        id: "below-zero",
        version: 1,
        role: "practice",
        prompt:
          '`n` 0 is home. Predict where the first note of `n("-3 0 ~ ~")` sounds, and pick your answer below. Hum your guess before you hear it.',
        skills: [{ skill: "S02", w: 1 }],
        hints: null,
        tests: [],
        code: deg("-3 0 ~ ~"),
        bars: 1,
        mode: "choose",
        choices: [
          { id: "below", label: "Below home: the line climbs up to it" },
          { id: "above", label: "Above home: the line falls to it" },
          { id: "error", label: "Nowhere: numbers below 0 do not play" },
        ],
        correct: ["below"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Under and over",
      minutes: 1,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      example: { id: "under-and-over", code: SPAN, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "under-and-over",
        version: 1,
        role: "practice",
        prompt:
          "Run the line and watch where each note lands on the staff and which label it gets: the numbers in the code go below 0 and past 6. Then answer both questions below.",
        skills: [{ skill: "S02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. Line the code up with the labels again, in order: one number in the code, one note on the staff, one label.",
        },
        hints: ladder(
          "Find home first: the note labelled 1, played by `n` 0. Which notes sit below it on the staff, and which labels do they get?",
          "The scale has seven notes, so the labels repeat every seven numbers: `n` 7 is 1 again, an octave up.",
          "`n` -1 plays the 7 just below home. Count down two more labels from there.",
        ),
        code: { starter: SPAN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the degree that `n` -3 plays.",
            options: [
              { id: "five-below", label: "5, below home" },
              { id: "three", label: "3, above home" },
              { id: "minus-two", label: "−2: the label counts down from 1" },
            ],
            correct: ["five-below"],
          },
          { q: "number", prompt: "Type the `n` that plays 1, an octave above home.", correct: 7 },
        ],
        srs: [{ family: "fam.deg.index", mode: "review-if-due" }],
        tests: [
          { name: "both right", response: { answer: { choice: ["five-below"], number: 7 } }, expect: "pass" },
          {
            name: "counted below zero as negative labels",
            response: { answer: { choice: ["minus-two"], number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "eight notes to the octave",
            response: { answer: { choice: ["five-below"], number: 8 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "An octave down",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "an-octave-down",
        version: 1,
        role: "check",
        prompt:
          "Move this line one octave lower: the same four degrees, one home further down. Change only the four numbers in `n`; leave `.scale()` as it is.",
        skills: [{ skill: "S02", w: 1 }],
        code: { starter: `${TEMPO}mel: n("⟪${LINE}⟫").scale("C4:major").s("piano")` },
        reference: { solutions: [deg(LINE_LOW)], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          ...NUMBERS,
          "melody.index-shift":
            "Every note lands one degree {dir}. One octave is seven numbers in `n`: take 7 from each.",
        },
        hints: ladder(
          "Each note must play the same degree, one octave lower. How many numbers in `n` does it take to get from home to the next home?",
          "`n` 7 is home an octave up, so every number moves by 7 for one octave. Down means taking away.",
          "The first note, 5 (`n` 4), becomes `n` -3. Do the same to the other three.",
        ),
        srs: [{ family: "fam.deg.index", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: deg(LINE_LOW) }, expect: "pass" },
          {
            name: "the same numbers in two halves",
            response: { code: deg("[-3 -5] [-6 -7]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: deg(LINE) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "took away 8",
            response: { code: deg("-4 -6 -7 -8") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "took away 12, the half steps of an octave",
            response: { code: deg("-8 -10 -11 -12") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "moved the key down instead",
            response: { code: deg(LINE, "C3:major") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Which one settles?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-one-settles",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the chords that set home, then to two endings of the same line: A ends 2 1, B ends 1 2. Pick the ending that settles, the one after which the music could stop.",
        skills: [{ skill: "E05", w: 1 }],
        hints: ladder(
          "Pick the ending that sounds finished. Hum the last note of each card: after which one could the music stop?",
          "1 is home. A line that ends on home sounds finished; one that steps off it keeps you waiting.",
          "B leaves home for 2 at the very end. Listen to A once more.",
        ),
        stimulus: { src: "code", code: deg(`<[${SETTLES}] [${HANGS}]>`), bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "a", label: "A: … 2 1", audio: deg(SETTLES) },
            { id: "b", label: "B: … 1 2", audio: deg(HANGS) },
          ],
        },
        correct: { choice: ["a"] },
        feedbackText: {
          "id.wrong":
            "Not B: its last note, 2, is left waiting. In A the 2 steps down to 1 and the line can stop.",
        },
        tests: [
          { name: "A", response: { answer: { choice: ["a"] } }, expect: "pass" },
          { name: "B", response: { answer: { choice: ["b"] } }, expect: "fail", feedback: ["id.wrong"] },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "2 or 4",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "two-or-four",
        version: 1,
        role: "check",
        prompt: "Listen to the chords that set home, then to one note. Pick its degree: 1, 2, 3, 4 or 5.",
        skills: [{ skill: "E05", w: 1 }],
        hints: [
          {
            text: "Decide first whether the note is at rest or leans. If it leans, which way does it want to go?",
          },
          {
            text: "2 leans down to 1, one step away. 4 leans down to 3. Sing down from the note until you reach home.",
          },
          { text: "Hear it again, slower, then sing 1 2 3 4 5 against it.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.deg.fet-major", level: 2 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "degree-pad", set: ["1", "2", "3", "4", "5"], syllables: false },
        correct: {},
        srs: [{ family: "fam.deg.fet-major", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "sing",
      title: "Sing them home",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "sing-them-home",
        version: 1,
        role: "practice",
        prompt:
          "Sing two short patterns after the chords set home, on numbers or on any vowel. Each one starts or ends on home, the note the chords end on.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "E05", w: 0.4 },
        ],
        hints: SING_HINTS,
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        tests: [],
        parts: [
          {
            kind: "sing",
            id: "sing-two-one-four-three",
            version: 1,
            role: "practice",
            prompt:
              "Sing two, one; four, three; two, one: six notes, two beats each. Each restless note steps down to the note it settles on.",
            skills: [
              { skill: "V03", w: 0.6 },
              { skill: "E05", w: 0.4 },
            ],
            hints: SING_HINTS,
            fallback: "skip",
            mode: "degree",
            stimulus: { src: "code", code: deg("<[1 0] [3 2] [1 0]>"), bars: 3, showCode: false },
            cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
            // One bar each: two notes of two beats.
            target: { from: "degrees", degrees: ["2", "1", "4", "3", "2", "1"], rhythm: "x x" },
            labels: "numbers",
            tol: SING_TOL,
            showTrace: "live",
            feedbackText: DRIFT,
            srs: [{ family: "fam.deg.sing", mode: "evidence-only" }],
            tests: [],
          },
          {
            kind: "sing",
            id: "sing-one-five-one",
            version: 1,
            role: "practice",
            prompt:
              "Sing one, five, then one again an octave higher: three notes, one to a beat, then a beat of rest. The last note is home, higher.",
            skills: [{ skill: "V03", w: 1 }],
            hints: SING_HINTS,
            fallback: "skip",
            mode: "degree",
            stimulus: { src: "code", code: deg("0 4 7 ~"), bars: 1, showCode: false },
            cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
            target: { from: "degrees", degrees: ["1", "5", "1"], octaves: [0, 0, 1], rhythm: "x x x ~" },
            labels: "numbers",
            tol: SING_TOL,
            showTrace: "live",
            feedbackText: DRIFT,
            srs: [{ family: "fam.deg.sing", mode: "evidence-only" }],
            tests: [],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Over the edge",
      minutes: 2.5,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "over-the-edge",
        version: 1,
        role: "practice",
        prompt:
          "Change at least one note so the line reaches under home or past 7: an `n` below 0 or above 6. Then let the line settle on 1, home. Done when one `n` sits outside 0 to 6.",
        skills: [{ skill: "S02", w: 1 }],
        code: { starter: deg("<[0 2 4 2] [3 1 0 ~]>") },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "reach",
            label: "At least one `n` below 0 or above 6: a note under home or past 7",
            required: true,
            skills: ["S02"],
            rule: "uses",
            tool: "tb.n.range",
          },
          {
            id: "ends-home",
            label: "The line's last note is degree 1, home",
            required: false,
            skills: ["E05"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "neighbour",
            label: "The line plays degree 2 at least once",
            required: false,
            skills: ["E05"],
            rule: "degree-set",
            track: "@melody",
            contains: ["2"],
          },
        ],
        // The catalog's detail names the tool ID ("tb.n.range used 0×"); the label says it in words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "One `n` must end up below 0 or above 6. Which note of the starter could go higher or lower than the rest?",
          "`n` 7 is 1 an octave up, and `n` -3 is the 5 below home. Swap one of them in, in bar 1 or bar 2.",
          "Add 7 to one note's number: it plays the same degree an octave up. The top of bar 1 is a good place.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: deg("<[0 2 4 2] [3 1 0 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: deg("<[0 2 7 2] [3 1 0 ~]>") }, expect: "pass" },
          {
            name: "beyond the brief: up to the octave and below home",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: n("<[0 2 4 [7 4]] [5 3 [1 -3] 0]>").scale("C4:major").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "everything between home and 7",
            response: { code: deg("<[0 2 4 5] [3 1 1 0]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
