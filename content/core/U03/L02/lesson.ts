// U03.L02 Degrees in Code (exemplar of U03). n = degree − 1 over `.scale("C4:major")`; the key as one word;
// the first functional ear training (1 against 5, then 1, 3 and 5 after a few chords that set home); a
// first degree pattern sung on numbers; degree labels on the roll and the staff. What the learner has from
// U03.L01: the major scale in note names, home (the tonic), W W H W W W H. Not yet: `n` 7 or below 0
// (U03.L03), `..` (U03.L04), a patterned `.scale()` (U03.L05), syllables (U03.L08). Spec: content/specs/U03.md.
//
// Shows the Wave 3 shapes (AUTHORING §16): `staffLabels`, a modify step that reveals the target roll after
// the first failed check (`revealRollAfter`), and a sung degree pattern (`target.from: "degrees"`,
// `labels: "numbers"`). Feedback that names syllables is overridden with numbers until U03.L08.
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

/** The hook: 1 3 5 6-5, then 6 5-4 2, rest. Over the vamp's I and IV chords nothing clashes. */
const HOOK = deg("<[0 2 4 [5 4]] [5 [4 3] 1 ~]>");
/** The first seven degrees, one per eighth, and a rest where the eighth would be. */
const SCALE = deg("0 1 2 3 4 5 6 ~");
/** Ode to Joy, bars 1–2 (U02.L08 played them as e4 e4 f4 g4 | g4 f4 e4 d4): degrees 3 3 4 5 | 5 4 3 2. */
const ODE = "<[2 2 3 4] [4 3 2 1]>";

/** The Band takes the key of the learner's `.scale()`, so a line moved to G keeps its backing. */
const BAND = { band: "band.two-chord-vamp", followsLearnerKey: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;

/**
 * The catalog's `melody.wrong-degree` reads "you have 5 (sol)": syllables wait for U03.L08. Numbers only,
 * and the bridge said the way the unit says it.
 */
const NUMBERS = {
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: you have degree {got}; the tune has degree {exp}. In `n`, every degree is one less.",
  // The catalog's "extra note 3" / "note 3 missing" says nothing about why: usually the `< >` was lost and
  // eight notes were squeezed into one bar.
  "melody.extra-note":
    "Bar {bar}, {beatLabel}: one note too many here. The tune has four notes a bar: keep the `< >`, one group of four per bar.",
  "melody.missing-note":
    "Bar {bar}, {beatLabel}: a note is missing here. The tune has four notes a bar: keep the `< >`, one group of four per bar.",
} as const;

export default defineLesson({
  id: "U03.L02",
  version: 4,
  title: "Degrees in Code",
  objective:
    "I can write a melody as scale degrees with n() and .scale(), and move it to another key with one word.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S02", "E04", "V02"],
  practises: [],
  terms: [{ id: "term.scale-degree", step: "S3" }],
  canDo: ["cd.code.degrees"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Numbers, not letters",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "numbers-not-letters",
        version: 1,
        role: "practice",
        prompt:
          "Watch the numbers on the roll as the line plays. The note marked 1 is home. Listen for the last note of bar 2: is it 1, or a different number?",
        skills: [{ skill: "S02", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Two bars in numbers. Read the roll's labels as they pass.", bars: 2 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which three notes?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "zero-two-four", code: deg("0 2 4 ~"), bars: 1 },
      exercise: {
        kind: "predict",
        id: "which-three-notes",
        version: 1,
        role: "practice",
        prompt:
          'Predict which three notes `n("0 2 4 ~")` plays in C major, and pick your answer below. `n` counts the notes of the scale from 0 at home. Hum your guess before you hear it.',
        skills: [{ skill: "S02", w: 1 }],
        hints: null,
        tests: [],
        code: deg("0 2 4 ~"),
        bars: 1,
        mode: "choose",
        choices: [
          { id: "steps", label: "`c4 e4 g4`: every other note of the scale" },
          { id: "half-steps", label: "`c4 d4 e4`: two half steps at a time" },
          { id: "from-one", label: "`d4 f4 a4`: counting from 1" },
        ],
        correct: ["steps"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Read the labels",
      minutes: 1,
      // The roll and the staff both label degrees from here (tb.feature.degree-labels unlocks in this lesson).
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      example: { id: "seven-degrees", code: SCALE, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "read-the-labels",
        version: 1,
        role: "practice",
        prompt:
          "Run the scale and compare each `n` in the code with the number beside its note on the roll (and under it on the staff). Then answer both questions below.",
        skills: [{ skill: "S02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. Line up each number in the code with the label on the roll, in order: the first `n`, 0, plays the note labelled for home.",
        },
        hints: ladder(
          "Match the first number in the code with the first label on the roll. That note is home: what label does it have?",
          "Line the code up with the labels: the first number in the code is the first label, then the second.",
          "`n` 0 plays the note labelled 1. Count up from there to the label 5.",
        ),
        code: { starter: SCALE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the label shown beside the note that `n` 0 plays.",
            options: [
              { id: "one", label: "1: home" },
              { id: "zero", label: "0, the same as the code" },
              { id: "letter", label: "C, its letter" },
            ],
            correct: ["one"],
          },
          { q: "number", prompt: "Type the `n` that plays the note labelled 5.", correct: 4 },
        ],
        srs: [{ family: "fam.deg.index", mode: "seed" }],
        tests: [
          { name: "both right", response: { answer: { choice: ["one"], number: 4 } }, expect: "pass" },
          {
            name: "labels count from 0",
            response: { answer: { choice: ["zero"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "n equals the label",
            response: { answer: { choice: ["one"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "A tune by numbers",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "tune-by-numbers",
        version: 1,
        role: "check",
        prompt:
          "Write the start of Ode to Joy with `n`: degrees 3 3 4 5 in bar 1, then 5 4 3 2 in bar 2. `n` counts from 0, so each number in the code is the degree minus one. Keep the `< >` and four notes per bar.",
        skills: [
          { skill: "S02", w: 0.7 },
          { skill: "E04", w: 0.3 },
        ],
        code: { starter: `${TEMPO}mel: n("⟪<[0 0 0 0] [0 0 0 0]>⟫").scale("C4:major").s("piano")` },
        reference: { solutions: [deg(ODE)], bars: 2 },
        // `events`, note against note at the same onset: the classic slip (the degrees typed as `n`, every note
        // one step high) then reads "you have degree 4; the tune has degree 3" at each place, with the bridge.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        constraints: [{ c: "must-use", tool: "tb.n", feedback: "code.must-use" }],
        // By ear and by number first; after one failed check the target's roll appears, to compare with yours.
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: NUMBERS,
        hints: ladder(
          "Your code must play degrees 3 3 4 5, then 5 4 3 2. Each `n` is the degree minus one: which `n` gives degree 3?",
          "`n` counts from 0, so every degree becomes one less: degree 3 is `n` 2.",
          "Degree 4 is `n` 3 and degree 5 is `n` 4. The second bar comes back down the same way.",
        ),
        srs: [{ family: "fam.deg.index", mode: "evidence-only" }],
        tests: [
          { name: "reference", response: { code: deg(ODE) }, expect: "pass" },
          {
            name: "the repeated note written with !",
            response: { code: deg("<[2!2 3 4] [4 3 2 1]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: `${TEMPO}mel: n("<[0 0 0 0] [0 0 0 0]>").scale("C4:major").s("piano")` },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the degrees written as n",
            response: { code: deg("<[3 3 4 5] [5 4 3 2]>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "the `< >` dropped: both bars squeezed into one",
            response: { code: deg("[2 2 3 4] [4 3 2 1]") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "an octave up",
            response: { code: deg(ODE, "C5:major") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "note names instead of n",
            response: { code: `${TEMPO}mel: note("<[e4 e4 f4 g4] [g4 f4 e4 d4]>").s("piano")` },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Home is G",
      minutes: 0.75,
      graded: true,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "home-is-g",
        version: 1,
        role: "check",
        // The answer is in G major; the starter stays in the lesson's C (content check 13 allows a starter that).
        key: { tonic: "G", mode: "major" },
        prompt:
          "Change one word in `.scale()` so G is home. Keep the numbers in `n`, the octave number and `:major` as they are. Done when the same tune plays in G major.",
        skills: [
          { skill: "S02", w: 0.8 },
          { skill: "E04", w: 0.2 },
        ],
        code: { starter: `${TEMPO}mel: n("${ODE}").scale("⟪C4:major⟫").s("piano")` },
        reference: { solutions: [deg(ODE, "G4:major")], bars: 2 },
        // Any octave of G is fine: the key is the point, not the register.
        matcher: { m: "events", pitch: "octave-free", rhythm: "onsets", durations: false },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false },
        // The catalog's wrong-degree text (with syllables), worded for a key that went to the wrong place. It
        // does not print the learner's degree: a wrong home makes it chromatic in G ("degree #4" for A major's
        // C♯), a symbol this lesson has not taught.
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the tune has degree {exp} of G major here, and your note is not it. Is G home in your `.scale()`?",
        },
        hints: ladder(
          "The tune stays the same; only home moves, from C to G. Which part of the line says where home is?",
          '`.scale("C4:major")` names home: its letter, its octave number, then the kind of scale.',
          "Keep the octave number and `:major`; only the letter changes.",
        ),
        srs: [{ family: "fam.code.functions", mode: "seed" }],
        tests: [
          { name: "reference", response: { code: deg(ODE, "G4:major") }, expect: "pass" },
          { name: "the G below", response: { code: deg(ODE, "G3:major") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: deg(ODE) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "A instead of G",
            response: { code: deg(ODE, "A4:major") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "changed the tune as well as the key",
            response: { code: deg("<[2 2 3 4] [4 3 2 0]>", "G4:major") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "compare",
      title: "At rest or open?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "rest-or-open",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the chords that set home, then to one note. Pick what that note is: 1, which sounds at rest, or 5, which is steady but wants to go on.",
        skills: [{ skill: "E04", w: 1 }],
        hints: ladder(
          "Decide whether the note after the chords sounds finished. Hum it: could the music stop there?",
          "1 sounds finished. 5 sounds stable too, but leaves the door open: it wants to go on.",
          "Listen to the card marked 1, then to the note again. Are they the same note?",
        ),
        // The chords that set home come from the cue (the drills' cadence); the stimulus is the one note.
        stimulus: { src: "code", code: deg("4@4"), bars: 1, showCode: false },
        cue: { context: "cadence", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "one", label: "1, at rest", audio: deg("0@4") },
            { id: "five", label: "5, open", audio: deg("4@4") },
          ],
        },
        correct: { choice: ["five"] },
        tests: [
          { name: "five", response: { answer: { choice: ["five"] } }, expect: "pass" },
          { name: "one", response: { answer: { choice: ["one"] } }, expect: "fail", feedback: ["id.wrong"] },
        ],
      },
    },
    {
      id: "S7",
      kind: "ear",
      title: "1, 3 or 5",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "one-three-five",
        version: 1,
        role: "check",
        prompt: "Listen to the chords that set home, then to one note. Pick that note's degree: 1, 3 or 5.",
        skills: [{ skill: "E04", w: 1 }],
        hints: [
          {
            text: "Name the note by its place above home. Hum it, then sing down to home on numbers: how many numbers did you pass?",
          },
          { text: "1 is at rest. 5 is open. 3 sits between them and sounds warm." },
          { text: "Hear it again, slower, then sing 1 3 5 against it.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.deg.fet-major", level: 1 },
        cue: { context: "cadence", countInBars: 0, click: false, replays: 2 },
        answer: { ui: "degree-pad", set: ["1", "3", "5"], syllables: false },
        correct: {},
        srs: [{ family: "fam.deg.fet-major", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S8",
      kind: "sing",
      title: "Sing 1 3 5",
      minutes: 1,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-one-three-five",
        version: 1,
        role: "practice",
        prompt:
          "After the chords set home, sing one, three, five, three, one: five notes, one to a beat, on any vowel or on the numbers. One is home, the note the chords end on.",
        skills: [
          { skill: "V02", w: 0.6 },
          { skill: "E04", w: 0.4 },
        ],
        hints: [
          {
            text: "Start on one, home: hum the note the chords end on, then climb from it to three and five.",
          },
          // Not "two steps": 3 to 5 is a step and a half, so a count in whole steps would mislead.
          { text: "Three is two notes of the scale above one; five is two more above three." },
          { text: "Hear the pattern on the piano once, then sing it back.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: "hear it in your head" (contracts §8.5); singing never gates.
        fallback: "skip",
        mode: "degree",
        // What Oak plays on "Hear it" and after the attempt; the targets are the degrees below.
        stimulus: { src: "code", code: deg("<[0 2 4 2] 0>"), bars: 2, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["1", "3", "5", "3", "1"] },
        labels: "numbers",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        feedbackText: {
          "sing.drift":
            "You drifted {cents}¢ {dir}. Hum home again, the note the chords end on, and climb from it.",
        },
        srs: [{ family: "fam.deg.sing", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S9",
      kind: "make",
      title: "A line by numbers",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "a-line-by-numbers",
        version: 1,
        role: "practice",
        // The catalog's text for a `uses` rule names the tool ID; the label says it in words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        prompt:
          "Change the starter so the line plays degrees 1, 3 and 5 (`n` 0, 2 and 4), each at least once. The starter has no degree 3 yet. Ending on 1 is a bonus. This line plays the eight bars after the opening of your song.",
        skills: [{ skill: "S02", w: 1 }],
        code: { starter: deg("<[0 1 0 ~] [4 [5 4] 1 ~]>") },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "one-three-five",
            label: "The line plays degrees 1, 3 and 5 (`n` 0, 2 and 4), each at least once",
            required: true,
            skills: ["S02"],
            rule: "degree-set",
            track: "@melody",
            contains: ["1", "3", "5"],
          },
          {
            id: "ends-home",
            label: "The line's last note is degree 1, home (`n` 0)",
            required: false,
            skills: ["E04"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "answer",
            label: "Uses `< >`, so bar 2 plays different notes from bar 1",
            required: false,
            skills: ["R03"],
            rule: "uses",
            tool: "tb.mini.alt",
          },
          {
            id: "space",
            label: "At least one rest, `~`, somewhere in the line",
            required: false,
            skills: ["R06"],
            rule: "uses",
            tool: "tb.mini.rest",
          },
        ],
        hints: ladder(
          "The line must play degrees 1, 3 and 5. The starter plays `n` 0 and `n` 4: which of the three degrees is missing?",
          "Degree 3 is `n` 2, and the starter has none. Put one where it sounds good, in the first bar or the second.",
          "Change one number in the starter to `n` 2. A note in the first bar, between home and 5, fits well.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: deg("<[0 1 0 ~] [4 [5 4] 1 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: deg("<[0 1 2 ~] [4 [5 4] 1 ~]>") }, expect: "pass" },
          {
            name: "beyond the brief: a hats line, a rest, ending home",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: n("<[0 2 4 [5 4]] [5 [4 3] 1 [0 ~]]>").scale("C4:major").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "no 3 anywhere",
            response: { code: deg("<[0 1 0 ~] [4 5 4 ~]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
