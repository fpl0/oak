// U06.L02 Roman Numerals (exemplar of U06). A Roman numeral names a chord by the degree of its root: I to
// vii, upper case for a major triad, lower case for a minor one, ° for the diminished one. In every major key
// the seven triads fall in the same pattern, I ii iii IV V vi vii°, so a loop written in numerals (I V vi IV)
// is the same loop in C as in G. In code the numeral is the root's `n` plus one: `.add(n("<0 4 5 3>"))` is
// I V vi IV. What the learner has: triads stacked by hand and their qualities (U05.L01–L03), chord names
// (U05.L04), `chord()` and `.voicing()` (U05.L08), the seven triads of a key stacked with `.add(n(…))` and
// the word "diatonic" (U06.L01). Not yet: what the chords do (function, U06.L03), endings (cadence,
// U06.L04), loops with a name (schema, U06.L06). Spec: content/specs/U06.md.
//
// How it uses the Wave 4 kinds (AUTHORING §17): numerals are an `rn-palette` answer graded by degree and
// quality, never by string (I against i is `harmony.rn-case`); a chord named in letters is a `text` answer
// with `normalize: "chord"`; numerals turned into code are graded as chords (`pcset` with the bass), so V an
// octave lower passes; the Make's required rule is a `progression` read in the exercise's key (G major), so
// stacks, `.add()` and chord symbols all pass.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 90;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One triad on each root of `roots` (n values, one a bar), stacked "+2, +2" with U06.L01's `.add()`. */
const triads = (roots: string, scale: string, extra = "") =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("${scale}").s("piano")${extra}`;
/** A melody line in degrees. */
const mel = (pattern: string, scale = "C4:major") => `mel: n("${pattern}").scale("${scale}").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The four-chord loop of U05: roots on degrees 1, 5, 6 and 4 (n 0, 4, 5, 3), one a bar. I V vi IV. */
const LOOP = "<0 4 5 3>";
/** The U05.L01 tune: chord notes on every beat it plays, so nothing rubs with the chords or the Band. */
const TUNE = "<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>";
const HOOK = code(triads(LOOP, "C3:major", ".gain(.7)"), mel(TUNE));
const LOOP_C = code(triads(LOOP, "C3:major"));
/** The same four numbers in G: G D Em C. */
const LOOP_G = code(triads(LOOP, "G3:major"));
/** The seven triads of C, one a bar, and home again: C Dm Em F G Am B° C. */
const SEVEN = code(triads("<0 1 2 3 4 5 6 0>", "C3:major"));
/** The see step: the same seven an octave up, on the treble staff. */
const SEVEN_ON_THE_PAGE = code(triads("<0 1 2 3 4 5 6 0>", "C4:major"));

const G = { tonic: "G", mode: "major" } as const;
/** I vi ii V in G (G Em Am D): bars 3 and 4 are the learner's. */
const IVIIIV = "<0 5 1 4>";
const MODIFY_STARTER = code(triads("<0 5 ⟪0 0⟫>", "G3:major"));
/** vi IV I V in G (Em C G D): the loop of the Make. */
const MAKE_LOOP = "<5 3 0 4>";
const MAKE_STARTER = code('chords: n("<[5,7,9] ~ ~ ~>").scale("G3:major").s("piano")');

/** The Band's drums and bass in C (the bass plays 1 5 6 4, one a bar). */
const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
/** Drums only: the learner's chords set the harmony, in any key. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const STAFF = { roll: false, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U06.L02",
  version: 4,
  title: "Roman Numerals",
  objective:
    "I can name the chords of a major key with Roman numerals, I ii iii IV V vi vii°, and play a loop from them in any key.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["N06"],
  practises: ["H01"],
  terms: [{ id: "term.roman-numeral", step: "S3" }],
  canDo: ["cd.read.roman"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The loop again",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "the-loop-again",
        version: 1,
        role: "practice",
        prompt:
          "Four chords and a tune. Listen for the bar where the loop sounds most at home. Then find on the roll which degree that bar's chord stands on.",
        skills: [{ skill: "H01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "The loop with its tune.", bars: 4 },
          { code: LOOP_C, caption: "The chords alone, without the tune.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Same numbers, new key",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "in-g", code: LOOP_G, bars: 4 },
      exercise: {
        kind: "predict",
        id: "same-numbers-new-key",
        version: 1,
        role: "practice",
        key: G,
        prompt:
          'The code keeps `.add(n("<0 4 5 3>"))` but uses `.scale("G3:major")`. Predict what you will hear, and pick it.',
        skills: [{ skill: "N06", w: 1 }],
        hints: null,
        tests: [],
        code: LOOP_G,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "same-loop", label: "The same loop, with a new home note" },
          { id: "other-loop", label: "A different loop: other chords in another order" },
          { id: "clash", label: "Chords that no longer fit together" },
        ],
        correct: ["same-loop"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Seven chords, one pattern",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "the-seven", code: SEVEN, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "seven-chords-one-pattern",
        version: 1,
        role: "practice",
        prompt:
          "Run the seven triads of C, one a bar, then home. Listen for which sound bright, dark or tense, and read each root's degree on the roll. Then answer both questions below.",
        skills: [{ skill: "H01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Play it again and stop on each bar: the bright chords have a major 3rd at the bottom, four half steps.",
        },
        hints: ladder(
          "Listen bar by bar and sort the chords into bright, dark and tense.",
          "Count the half steps of the bottom 3rd on the keyboard, as in Major & Minor: 4 is major, 3 is minor.",
          "Bar 1 (degree 1) is major and bar 2 (degree 2) is minor. Check bars 4 and 5 next.",
        ),
        code: { starter: SEVEN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "On which degrees are the major triads?",
            options: [
              { id: "one-four-five", label: "1, 4 and 5" },
              { id: "one-three-five", label: "1, 3 and 5" },
              { id: "two-three-six", label: "2, 3 and 6" },
            ],
            correct: ["one-four-five"],
          },
          {
            q: "number",
            prompt: "On which degree is the one diminished triad?",
            correct: 7,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["one-four-five"], number: 7 } },
            expect: "pass",
          },
          {
            name: "the minor ones picked",
            response: { answer: { choice: ["two-three-six"], number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the n value for the degree",
            response: { answer: { choice: ["one-four-five"], number: 6 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "see",
      title: "On the page",
      minutes: 0.5,
      ui: { panels: STAFF, staffLabels: "degree" },
      example: { id: "seven-on-the-page", code: SEVEN_ON_THE_PAGE, bars: 8 },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Number the loop",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "number-the-loop",
        version: 1,
        role: "check",
        prompt:
          "The hook's chords play again, with their code shown. Enter the Roman numeral of each chord, one a bar: upper case for major, lower case for minor.",
        skills: [
          { skill: "N06", w: 0.7 },
          { skill: "H01", w: 0.3 },
        ],
        hints: ladder(
          "Find the degree of each chord's root first. The numbers in `.add()` count from 0.",
          "Add one to each number in `.add()` to get the root's degree, then write that degree as a numeral.",
          "Bar 1 is I and bar 2 is V. Bar 3 sits on degree 6: is a triad there bright or dark?",
        ),
        stimulus: { src: "code", code: LOOP_C, bars: 4, showCode: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 4, allow: ["triads"] },
        correct: { rn: ["I", "V", "vi", "IV"] },
        srs: [{ family: "fam.har.rn", mode: "seed" }],
        // The catalog's `id.wrong` says "Listen to both", which fits audio cards, not a reading item.
        feedbackText: {
          "id.wrong":
            "Bar {slot}: not {got}. Add one to that bar's number in `.add()` to find the degree of its root.",
        },
        tests: [
          { name: "I V vi IV", response: { answer: { rn: ["I", "V", "vi", "IV"] } }, expect: "pass" },
          {
            name: "vi written in capitals",
            response: { answer: { rn: ["I", "V", "VI", "IV"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
          {
            name: "the n values read as degrees",
            response: { answer: { rn: ["I", "IV", "V", "iii"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "From numeral to name",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "numeral-to-name",
        version: 1,
        role: "check",
        key: G,
        prompt: "G major runs G A B C D E F♯. Type the chord symbol of ii in G.",
        skills: [{ skill: "N06", w: 1 }],
        hints: ladder(
          "Find the degree ii stands for, then the note of G major on that degree.",
          "ii is the triad on degree 2, and the lower case says it is minor.",
          "Degree 2 of G major is A. Stack A, C, E: which quality is it?",
        ),
        answer: { ui: "text", normalize: "chord" },
        correct: { text: ["Am"] },
        spelling: "enharmonic",
        order: "sequence",
        feedbackText: {
          "id.wrong": "Not that one. ii is the minor triad whose root is degree 2 of G major.",
        },
        tests: [
          { name: "Am", response: { answer: { text: ["Am"] } }, expect: "pass" },
          { name: "written in lower case", response: { answer: { text: ["am"] } }, expect: "pass" },
          {
            name: "major instead of minor",
            response: { answer: { text: ["A"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "ii in C",
            response: { answer: { text: ["Dm"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "modify",
      title: "Numerals into code",
      minutes: 1.25,
      graded: true,
      // No Band here: content/validate/course.test.ts reads a Band's chords in the lesson's key (C) even when
      // the step plays only its drums, and would hear this G-major D chord against the C loop's F.
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "numerals-into-code",
        version: 1,
        role: "check",
        key: G,
        prompt:
          "The loop should go I vi ii V in G. Bars 1 and 2 are written. Change the last two numbers in `.add()` so bar 3 plays ii and bar 4 plays V.",
        skills: [
          { skill: "N06", w: 0.6 },
          { skill: "H01", w: 0.4 },
        ],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [code(triads(IVIIIV, "G3:major"))], bars: 4 },
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. A numeral is a degree, and `n` counts from 0: subtract one.",
        },
        hints: ladder(
          "Bar 2 is vi and its number is 5. Compare the numeral's degree with the number.",
          "`n` counts from 0, so the number for a numeral is its degree minus one.",
          "ii is degree 2, so its number is 1. Now V.",
        ),
        tests: [
          { name: "reference", response: { code: code(triads(IVIIIV, "G3:major")) }, expect: "pass" },
          {
            name: "V an octave lower",
            response: { code: code(triads("<0 5 1 -3>", "G3:major")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(triads("<0 5 0 0>", "G3:major")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the numerals written as numbers: 2 and 5",
            response: { code: code(triads("<0 5 2 5>", "G3:major")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "bar 2 changed as well",
            response: { code: code(triads("<0 6 1 4>", "G3:major")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "A loop from numerals",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "loop-from-numerals",
        version: 1,
        role: "practice",
        key: G,
        prompt:
          "Your loop plays the four bars where your song moves into G. Write vi IV I V in G in the `chords` line, one chord a bar; bar 1, vi, is written. Then give the chords a rhythm if you like. Done when the four bars go vi IV I V in G.",
        skills: [
          { skill: "N06", w: 0.5 },
          { skill: "H01", w: 0.5 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "vi-iv-i-v",
            label: "The `chords` line plays vi IV I V in G, in that order",
            required: true,
            skills: ["N06"],
            rule: "progression",
            rn: ["vi", "IV", "I", "V"],
            track: "chords",
          },
          {
            id: "a-tune",
            label: "A tune on its own line, such as `mel`",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
          {
            id: "middle",
            label: "Every note of `chords` between `c3` and `c5`",
            required: false,
            skills: ["H01"],
            rule: "range",
            track: "chords",
            within: ["c3", "c5"],
          },
        ],
        hints: ladder(
          "Bar 1, vi, is written as `[5,7,9]`. Bars 2 to 4 need IV, I and V: find each one's degree.",
          "Subtract one from each numeral's degree: vi IV I V are the numbers 5, 3, 0 and 4.",
          'Bar 1 is written. `n("[0,2,4]").add(n("<5 3 … …>"))` gives bars 1 and 2; two numbers to go.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the four triads with .add()",
            response: { code: code(triads(MAKE_LOOP, "G3:major")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: chord names on a Rhodes, a bass, a tune",
            response: {
              code: code(
                'chords: chord("<Em C G D>").voicing().s("rhodes")',
                'bass: n("<5 3 0 4>").scale("G2:major").s("ebass").lpf(600)',
                mel("<[2 ~ 0 ~] [5 ~ 3 ~] [4 ~ 2 ~] [4 ~ 1 ~]>", "G4:major"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the numerals written as numbers: 6 4 1 5",
            response: { code: code(triads("<6 4 1 5>", "G3:major")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the right numbers over C instead of G",
            response: { code: code(triads(MAKE_LOOP, "C3:major")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
