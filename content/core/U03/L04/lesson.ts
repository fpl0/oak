// U03.L04 Leading Tone & Six. Degrees 6 and 7 complete the scale; 7 sits a half step under home and pulls
// up to it. `a .. b` (with spaces) writes a run of the scale in one step of the pattern (`tb.mini.range`
// unlocks here). What the learner has from U03.L03: `n` below 0 and from 7 up, 1 to 5 by ear after a few
// chords that set home, the word resolution (2 to 1, 4 to 3). From here `ebass` and `.lpf()` are open to
// every learner (contracts §3.1 rule 12) but not needed. Not yet: a patterned `.scale()` (U03.L05),
// syllables (U03.L08). Spec: content/specs/U03.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
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
 * The hook: 5 6 7 1' (a range, one quarter each), then 6 7-6 7 1'. Over the vamp's C chord the climb
 * passes 6 and 7 into the octave c; over its F chord 6 is a chord note and 7 leans up to c, a chord note too.
 */
const HOOK = deg("<[4 .. 7] [5 [6 5] 6 7]>");
/** 5 6 7, then a rest where 1 would land. */
const STOPS_ON_SEVEN = deg("4 5 6 ~");
/** The scale from home to home in one token: eight eighths. */
const RUN = deg("0 .. 7");
/** S4: up the octave, then back down to home, one eighth each. */
const UP_DOWN = "<[0 1 2 3 4 5 6 7] [7 6 5 4 3 2 1 0]>";
const UP_DOWN_RANGE = "<[0 .. 7] [7 .. 0]>";

const BAND = { band: "band.two-chord-vamp", followsLearnerKey: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;

/** The catalog's `melody.wrong-degree` reads "you have 5 (sol)": syllables wait for U03.L08. */
const NUMBERS = {
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: you have degree {got}; the run has degree {exp}. Check where each range starts and ends.",
  "melody.extra-note":
    "Bar {bar}: one note too many. A range plays both ends, so each run of eight notes goes from 1 to 1, `n` 0 to 7.",
  "melody.missing-note":
    "Bar {bar}: a note is missing. A range plays both ends, so each run of eight notes goes from 1 to 1, `n` 0 to 7.",
} as const;

export default defineLesson({
  id: "U03.L04",
  version: 5,
  title: "Leading Tone & Six",
  objective: "I can hear degrees 6 and 7, feel 7 pull up to home, and write a run of the scale with `..`.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["E05"],
  terms: [{ id: "term.leading-tone", step: "S5" }],
  canDo: ["cd.hear.degrees"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The last two steps",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "the-last-two-steps",
        version: 1,
        role: "practice",
        prompt:
          "Watch the labels as the line climbs from 5 to the high 1. Listen for the note where the pull towards 1 feels strongest.",
        skills: [{ skill: "E05", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Bar 1 climbs straight up to home; bar 2 takes its time.", bars: 2 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Stop on 7?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "stops-on-seven", code: STOPS_ON_SEVEN, bars: 1 },
      exercise: {
        kind: "predict",
        id: "stop-on-seven",
        version: 1,
        role: "practice",
        prompt:
          '`n("4 5 6 ~")` plays degrees 5, 6 and 7, then rests. Predict whether it sounds finished, and pick your answer below. Hum your guess before you hear it.',
        skills: [{ skill: "E05", w: 1 }],
        hints: null,
        tests: [],
        code: STOPS_ON_SEVEN,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "one-more", label: "No: it wants one more note, home" },
          { id: "finished", label: "Yes: it can stop on 7" },
          { id: "down", label: "No: it wants to fall back to 5" },
        ],
        correct: ["one-more"],
      },
    },
    {
      id: "S3",
      kind: "run",
      title: "A run in one token",
      minutes: 0.5,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      example: { id: "run", code: RUN, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "a-run-in-one-token",
        version: 1,
        role: "practice",
        prompt:
          "Run the line and count the notes you hear. `0 .. 7` means every number from 0 to 7, both ends included, played in the place of one note.",
        skills: [{ skill: "S02", w: 1 }],
        hints: ladder(
          "Count the notes as they play and read their labels on the roll. How many are there?",
          "The range counts every whole number from its first end to its last: 0 1 2 3 4 5 6 7.",
          "Eight notes in one bar: 1 to 7, then 1 again an octave up.",
        ),
        tests: [],
        code: { starter: RUN },
        mustPlayLoops: 1,
        questions: [],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Up and back down",
      minutes: 1,
      graded: true,
      // A programmer who reads `0 .. 7` as a range needs no run step first (contracts §9.5).
      testOut: { skips: ["S3"] },
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "up-and-back-down",
        version: 1,
        role: "check",
        prompt:
          "Rewrite each bar as one range with `..`, with a space on each side of it. Bar 1 climbs from home to the home an octave higher; bar 2 comes back down. Keep the same sixteen notes. Done when each bar is a single range.",
        skills: [{ skill: "S02", w: 1 }],
        code: { starter: `${TEMPO}mel: n("⟪${UP_DOWN}⟫").scale("C4:major").s("piano")` },
        reference: { solutions: [deg(UP_DOWN_RANGE)], bars: 2 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        constraints: [{ c: "must-use", tool: "tb.mini.range", min: 2, feedback: "code.must-use" }],
        target: { audible: true, showRoll: false },
        feedbackText: {
          ...NUMBERS,
          "code.must-use": "Write both runs with `..`: one range per bar.",
        },
        hints: ladder(
          "Each bar becomes one range from its first number to its last. Which numbers does bar 1 start and end on? And bar 2?",
          "A range is the first number, a space, `..`, a space, the last number. It counts down as well as up.",
          "Bar 1 becomes `[0 .. 7]`. Bar 2 starts where bar 1 ended.",
        ),
        tests: [
          { name: "reference", response: { code: deg(UP_DOWN_RANGE) }, expect: "pass" },
          {
            name: "each bar as two ranges of four",
            response: { code: deg("<[[0 .. 3] [4 .. 7]] [7 .. 0]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: deg(UP_DOWN) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "one too far: up to 8",
            response: { code: deg("<[0 .. 8] [7 .. 0]>") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "stopped one short of home",
            response: { code: deg("<[0 .. 7] [7 .. 1]>") },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "no spaces around ..",
            response: { code: deg("<[0..7] [7 .. 0]>") },
            expect: "fail",
            feedback: ["code.range-spacing"],
          },
          {
            name: "only bar 1 as a range",
            response: { code: deg("<[0 .. 7] [7 6 5 4 3 2 1 0]>") },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "6 or 7",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "six-or-seven",
        version: 1,
        role: "check",
        prompt: "Listen to the chords that set home, then to one note. Pick its degree, from 1 to 7.",
        skills: [{ skill: "E05", w: 1 }],
        hints: [
          { text: "Decide which way the note wants to move. Hum where it wants to go: up or down?" },
          { text: "7 leans up, one half step, to home. 6 tends to fall back to 5." },
          {
            text: "Hear it again, slower, then sing up the scale from 1 until you meet it.",
            replay: { rate: 0.75 },
          },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.deg.fet-major", level: 3 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "degree-pad", set: ["1", "2", "3", "4", "5", "6", "7"], syllables: false },
        correct: {},
        srs: [{ family: "fam.deg.fet-major", mode: "review-if-due" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Lead them home",
      minutes: 1.25,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "lead-them-home",
        version: 1,
        role: "practice",
        prompt:
          "After the chords set home, sing three pairs, two beats a note: seven up to the high one, six down to five, two down to one. Sing on numbers or on any vowel.",
        skills: [
          { skill: "V03", w: 0.6 },
          { skill: "E05", w: 0.4 },
        ],
        hints: [
          { text: "Start from home: hum the note the chords end on. Every pair lands on 1 or on 5." },
          { text: "7 is the note just under the high 1: almost there already. 6 sits one step above 5." },
          { text: "Hear the three pairs on the piano once, then sing them back.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        mode: "resolution",
        stimulus: { src: "code", code: deg("<[6 7] [5 4] [1 0]>"), bars: 3, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        // 7 then 1 an octave up; the other pairs inside the home octave. Two notes a bar.
        target: {
          from: "degrees",
          degrees: ["7", "1", "6", "5", "2", "1"],
          octaves: [0, 1, 0, 0, 0, 0],
          rhythm: "x x",
        },
        labels: "numbers",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        feedbackText: {
          "sing.drift":
            "You drifted {cents}¢ {dir}. Hum home again, the note the chords end on, and find each pair from it.",
        },
        srs: [{ family: "fam.deg.resolve", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Let 7 lead",
      minutes: 2.5,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "let-seven-lead",
        version: 1,
        role: "practice",
        prompt:
          "Your line from Restless Neighbours is in the editor, for the four bars that lead into the first loud part of your song. Make it play degree 6 (`n` 5) and degree 7 (`n` 6), each at least once. Put 7 just before a 1 so it leads home. Done when both degrees play.",
        skills: [{ skill: "E05", w: 1 }],
        code: { starter: deg("<[0 1 2 4] [3 2 1 ~]>") },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "six-seven",
            label: "The line plays degree 6 and degree 7, each at least once",
            required: true,
            skills: ["E05"],
            rule: "degree-set",
            track: "@melody",
            contains: ["6", "7"],
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
            id: "run",
            label: "At least one range written with `..`",
            required: false,
            skills: ["S02"],
            rule: "uses",
            tool: "tb.mini.range",
          },
        ],
        // The catalog's detail for an unused tool names its ID ("tb.mini.range used 0×").
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "The line must play degrees 6 and 7. Which degrees does your line play, and which of those two are missing?",
          "`n` counts from 0, so degree 6 is `n` 5 and degree 7 is `n` 6. 7 sounds best just before a 1.",
          "Bar 2 can become a climb that passes through 6 and 7 on its way up to the high home.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: deg("<[0 1 2 4] [3 2 1 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: deg("<[0 1 2 4] [5 6 7 ~]>") }, expect: "pass" },
          {
            name: "beyond the brief: hats, a lean from 7 to the high 1",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: n("<[0 2 4 [5 6]] [7 [6 5] 4 [6 7]]>").scale("C4:major").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "6 but no 7",
            response: { code: deg("<[0 2 4 5] [4 2 1 0]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
