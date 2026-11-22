// U08.L01 Roots Down Low (exemplar of U08). A bass line's first job is the floor: on the downbeat of each
// chord it plays that chord's root, low, so the chord stands on its own note. In code the root bass is the
// chords' own numbers an octave down (`n("<0 4 5 3>").scale("C2:major")` under `.add(n("<0 4 5 3>"))`), or,
// from chord names, `.rootNotes(2)` (unlocked here). What the learner has: the seven triads of a key and their
// numerals (U06.L01–L02), the four-chord loop and the doo-wop order (U06.L06–L07), the bass degree by ear and
// sung roots (U06.L05), `chord()` and `.voicing()` (U05.L08), `ebass` and the bass preset `.lpf(600)` (C1).
// Not yet: the fifth and the octave (U08.L02), approach notes (U08.L03), the kick lock and `const` (U08.L04).
// Spec: content/specs/U08.md.
//
// How it is graded (AUTHORING §18): a bass line written as degrees is an `events` match on the `bass` track
// with `pitch: "octave-free"`, so a root an octave lower passes; the Make's required rule reads the lowest note
// under each chord change against a root bass (`matches` with a `harmony` matcher at level `bass`), so a bass
// that repeats, holds or decorates its roots passes as long as each change lands on its root. The chords sit in
// the learner's code (the Band plays the drums only), because the grader is not given the Band.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Triads stacked on `roots` (n values, one a bar), as in U06.L01. */
const chords = (roots: string) => `chords: n("[0,2,4]").add(n("${roots}")).scale("C3:major").s("piano")`;
/** A bass line in degrees, an octave below the chords, with the C1 bass preset. */
const bass = (pattern: string) => `bass: n("${pattern}").scale("C2:major").s("ebass").lpf(600)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The four-chord loop: I V vi IV (C G Am F), one chord a bar. */
const AXIS = "<0 4 5 3>";
/** The U05.L01 tune: chord notes on every beat it plays. */
const TUNE = 'mel: n("<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>").scale("C4:major").s("piano")';
const NO_BASS = code(chords(AXIS), TUNE);
const HOOK = code(chords(AXIS), TUNE, bass(AXIS));
/** The doo-wop order I vi IV V (C Am F G), for the first bass the learner writes. */
const DOO_WOP = "<0 5 3 4>";
const MODIFY_STARTER = code(chords(DOO_WOP), bass("<0 ⟪0 0 0⟫>"));
const MODIFY_SOLUTION = code(chords(DOO_WOP), bass(DOO_WOP));
/** Chord names voiced by Strudel: under C the lowest note is E, so the chord needs its root underneath. */
const NAMES = 'chords: chord("<C G Am F>").voicing().s("piano")';
const NAMES_STARTER = code(NAMES, 'bass: ⟪n("0").scale("C2:major")⟫.s("ebass").lpf(600)');
const NAMES_SOLUTION = code(NAMES, 'bass: chord("<C G Am F>").rootNotes(2).s("ebass").lpf(600)');
/** The roots of the doo-wop loop, for singing: do la fa sol. */
const SING = code(chords(DOO_WOP), bass(DOO_WOP));
/** The Make starts with a bass that sits on C under every chord. */
const MAKE_STARTER = code(chords(AXIS), bass("0"));

/** Drums from the Band; the chords and the bass are in the learner's code. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROOT_BASS = {
  m: "harmony",
  level: "bass",
  qualityDepth: "triad",
  inversion: false,
  harmonicRhythm: "given",
} as const;

export default defineLesson({
  id: "U08.L01",
  version: 3,
  title: "Roots Down Low",
  objective:
    "I can write a bass line that plays each chord's root on its downbeat, in degrees or from chord names.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["B01"],
  practises: [],
  terms: [],
  canDo: ["cd.code.root-bass"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Floor in",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "floor-in",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both loops. The second adds one low line under the chords. Listen for what that low line changes in how the chords sound.",
        skills: [{ skill: "B01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: NO_BASS, caption: "The chords and the tune, no bass.", bars: 4 },
          { code: HOOK, caption: "The same loop with a low line added.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which note?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "which-note",
        version: 1,
        role: "practice",
        prompt:
          'Predict which note of each chord the bass plays, then pick it. The bass is `n("<0 4 5 3>")` over `.scale("C2:major")`: the same numbers as the chords\' `.add()`, in a lower octave.',
        skills: [{ skill: "B01", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "root", label: "The note each chord is stacked on, an octave or two lower" },
          { id: "top", label: "The top note of each chord" },
          { id: "tune", label: "The tune's first note in each bar" },
        ],
        correct: ["root"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "On the one",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "on-the-one", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "on-the-one",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop and watch the lowest line on the roll, the bass. Answer both questions below: when the bass moves to a new note, and which degree it plays under Am in bar 3.",
        skills: [{ skill: "B01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop on each bar: the bass note starts with the chord, and its degree is the chord's own number plus one.",
        },
        hints: ladder(
          "Compare the lowest line with the chord stacks above it on the roll. Where does each one change?",
          "Look at bar 3 on the roll: the chord is Am, stacked on degree 6. Which degree is the bass?",
          "The bass moves with the chord, on beat 1. In bar 1 it is degree 1 under C.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "When does the bass move to a new note?",
            options: [
              { id: "with-the-chord", label: "On beat 1 of each bar, with the chord" },
              { id: "every-beat", label: "On every beat" },
              { id: "beat-3", label: "On beat 3, between the chords" },
            ],
            correct: ["with-the-chord"],
          },
          { q: "number", prompt: "Bar 3's chord is Am. Which degree does the bass play there?", correct: 6 },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["with-the-chord"], number: 6 } },
            expect: "pass",
          },
          {
            name: "every beat",
            response: { answer: { choice: ["every-beat"], number: 6 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the n value for the degree",
            response: { answer: { choice: ["with-the-chord"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "New loop, new roots",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "roots-for-a-new-loop",
        version: 1,
        role: "check",
        prompt:
          "The chords now play the doo-wop order, I vi IV V. The bass plays 0 in bar 1, then stays on 0. Change the three highlighted numbers so the bass plays each chord's root. Done when the bass numbers match the chords' `.add()` numbers.",
        skills: [{ skill: "B01", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        matcher: {
          m: "events",
          pitch: "octave-free",
          rhythm: "onsets",
          durations: false,
          tracks: ["bass"],
        },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: the bass plays degree {got} ({gotSyl}); the chord's root is degree {exp} ({expSyl}). Read the chord's number in `.add()`: the bass takes the same `n` number, one less than the degree.",
        },
        hints: ladder(
          "The chords' `.add()` already says which number each chord is stacked on. The bass needs the same four numbers.",
          "Each bass number is the same as the chord's number in `.add()`: both count from 0.",
          "Bar 2 is vi, stacked on 5 in `.add()`, so the bass plays 5 too. Two to go.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "vi from below, an octave lower",
            response: { code: code(chords(DOO_WOP), bass("<0 -2 3 4>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(chords(DOO_WOP), bass("<0 0 0 0>")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the numerals written as degrees: 6 4 5",
            response: { code: code(chords(DOO_WOP), bass("<0 6 4 5>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the chords changed as well",
            response: { code: code(chords("<0 5 3 3>"), bass(DOO_WOP)) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Roots from the names",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree" },
      exercise: {
        kind: "code-modify",
        id: "roots-from-the-names",
        version: 1,
        role: "check",
        prompt:
          'Replace the highlighted bass with `chord("<C G Am F>").rootNotes(2)`. It plays the root of each chord name in octave 2. Keep the chords line as it is.',
        skills: [{ skill: "B01", w: 1 }],
        code: { starter: NAMES_STARTER },
        reference: { solutions: [NAMES_SOLUTION], bars: 4 },
        matcher: {
          m: "events",
          pitch: "octave-free",
          rhythm: "onsets",
          durations: false,
          tracks: ["bass"],
        },
        constraints: [
          { c: "edit-only-regions", feedback: "code.edit-outside" },
          { c: "must-use", tool: "tb.rootNotes", feedback: "code.must-use" },
        ],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "code.must-use": "This step is for `.rootNotes()`: let the chord names give the bass its notes.",
          "melody.wrong-degree":
            "Bar {bar}: the bass plays {got}, the chord's root is {exp}. Copy the chord names in the same order.",
        },
        hints: ladder(
          "The chords line already has the names C, G, Am and F. The bass needs the same names, in the same order.",
          "`.rootNotes(2)` goes after a `chord(…)` with the same names as the chords line.",
          'Start the box with `chord("<C G Am F>")` and add `.rootNotes(2)` after it.',
        ),
        tests: [
          { name: "reference", response: { code: NAMES_SOLUTION }, expect: "pass" },
          {
            name: "an octave lower",
            response: { code: code(NAMES, 'bass: chord("<C G Am F>").rootNotes(1).s("ebass").lpf(600)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(NAMES, 'bass: n("0").scale("C2:major").s("ebass").lpf(600)') },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the roots written as degrees",
            response: { code: code(NAMES, 'bass: n("<0 4 5 3>").scale("C2:major").s("ebass").lpf(600)') },
            expect: "fail",
            feedback: ["code.must-use"],
          },
          {
            name: "the names in another order",
            response: { code: code(NAMES, 'bass: chord("<C Am F G>").rootNotes(2).s("ebass").lpf(600)') },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "sing",
      title: "Sing the floor",
      minutes: 1.5,
      ui: { panels: NONE },
      exercise: {
        kind: "sing",
        id: "sing-the-floor",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the doo-wop loop with its bass. Then sing its four roots, one note a bar: do, la, fa, sol. Sing in your own range; your voice does not need to reach the bass.",
        skills: [
          { skill: "V05", w: 0.6 },
          { skill: "B01", w: 0.4 },
        ],
        hints: [
          { text: "Hum do first, the note the loop starts on, and hold it." },
          { text: "La is a step above sol; fa a step below sol. From do, la is the furthest jump." },
          { text: "Hear the roots again, slower, and hum along before you sing.", replay: { rate: 0.75 } },
          "auto",
        ],
        // Quiet mode or no microphone: name the four degrees instead (contracts §8.5); singing never gates.
        fallback: "identify",
        mode: "degree",
        stimulus: { src: "code", code: SING, bars: 4, showCode: false },
        cue: { context: "cadence", countInBars: 1, click: false, replays: -1 },
        target: { from: "degrees", degrees: ["1", "6", "4", "5"] },
        labels: "syllables",
        tol: { cents: "learner", octave: "global", driftCompCents: 30, minCoverage: 0.4, passHitRate: 0.8 },
        showTrace: "live",
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Lay the floor",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "a-floor-for-the-loop",
        version: 1,
        role: "practice",
        prompt:
          "Change the bass so it plays each chord's root on beat 1 of that chord's bar, all four bars. Then give the bass any rhythm you like. Keep the chords as they are.",
        skills: [{ skill: "B01", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "roots-on-the-one",
            label: "The bass plays each chord's root on beat 1 of its bar, in every bar",
            required: true,
            skills: ["B01"],
            rule: "matches",
            reference: { solutions: [code(chords(AXIS), bass(AXIS))], bars: 4 },
            matcher: ROOT_BASS,
            // "Each chord its root": every change, not three of four (corrections pass).
            min: 1,
          },
          {
            id: "low-down",
            label: "Every bass note between C1 and C3",
            required: false,
            skills: ["B01"],
            rule: "range",
            track: "bass",
            within: ["c1", "c3"],
          },
          {
            id: "a-tune",
            label: "A melody line on top of the chords",
            required: false,
            skills: ["M01"],
            rule: "tracks",
            min: 1,
            roles: ["melody"],
          },
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Each chord is stacked on one number in the chords' `.add()`. The bass needs that number in each bar.",
          "The bass can take the chords' numbers: the same `<…>` of four, one a bar.",
          'Bar 1 already has its root, 0. Write `n("<0 4 … …>")` for the bass: two numbers to go.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one root a bar",
            response: { code: code(chords(AXIS), bass(AXIS)) },
            expect: "pass",
          },
          {
            name: "beyond the brief: names, pumping roots, a tune",
            response: {
              code: code(
                NAMES,
                'bass: chord("<C G Am F>").rootNotes(2).struct("x ~ x x ~ x x ~").s("ebass").lpf(600)',
                TUNE,
              ),
            },
            expect: "pass",
          },
          {
            name: "eighths on the root",
            response: {
              code: code(chords(AXIS), bass("<[0*8] [4*8] [5*8] [3*8]>")),
            },
            expect: "pass",
          },
          {
            name: "the bass on each chord's 3rd",
            response: { code: code(chords(AXIS), bass("<2 6 7 5>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "three roots right, the last chord left on C",
            response: { code: code(chords(AXIS), bass("<0 4 5 0>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "roots an octave apart, each on beat 1 then up high",
            response: { code: code(chords(AXIS), bass("<[0 ~ 7 ~] [4 ~ 11 ~] [5 ~ 12 ~] [3 ~ 10 ~]>")) },
            expect: "pass",
          },
          {
            name: "roots held, a push on beat 4",
            response: { code: code(chords(AXIS), bass("<[0@3 0] [4@3 4] [5@3 5] [3@3 3]>")) },
            expect: "pass",
          },
        ],
      },
    },
  ],
});
