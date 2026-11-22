// U05.L02 Major & Minor. Triads have a quality, and the bottom 3rd decides it: a major 3rd (four half steps)
// under a minor 3rd (three) is a major triad, bright; a minor 3rd under a major 3rd is a minor triad, darker.
// The outer 5th stays the same (seven half steps), so moving the middle note one half step turns one into
// the other. In a major key the triads on 1, 4 and 5 are major, on 2, 3 and 6 minor. What the learner has:
// triads stacked by hand with `n("[0,2,4]")` (U05.L01), 3rds measured in half steps and named major or minor
// (U04.L02), note names with sharps (U02.L03). Not yet: the triads on 7 and with two equal 3rds (U05.L03),
// chord names on paper (U05.L04), `chord()` (U05.L08). Spec: content/specs/U05.md.
//
// A chord outside the key's own triads (A major in C) is written as a note list, since chromatic `n` steps
// wait for U15.L01. Chords are graded as chords (`pcset` with the bass), so `gb4` passes for `f#4`; the Make's
// one required rule is a `contains-rn` read from the learner's stacks, whose detail prints numerals (U06.L02),
// so its text is overridden.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A chord line in note names. */
const chordNotes = (pattern: string) => `chords: note("${pattern}").s("piano")`;
/** A chord line written as stacked degrees in C, an octave under the melody. */
const chords = (pattern: string, extra = "") =>
  `chords: n("${pattern}").scale("C3:major").s("piano")${extra}`;
/** A melody line in note names. */
const melNotes = (pattern: string) => `mel: note("${pattern}").s("piano")`;
/** A melody line in degrees. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
/** A bass line of roots in degrees. */
const bass = (pattern: string) => `bass: n("${pattern}").scale("C2:major").s("ebass").lpf(700)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** A minor (A C E) for two bars, then A major (A C♯ E): only the middle note moves. */
const A_TWICE = "<[a3,c4,e4]!2 [a3,c#4,e4]!2>";
/** The tune sings each chord's own notes: E C, A | E C♯, A. */
const A_TUNE = "<[e4 ~ c4 ~] [a3 ~ ~ ~] [e4 ~ c#4 ~] [a3 ~ ~ ~]>";
const HOOK = code(`${chordNotes(A_TWICE)}.gain(.7)`, melNotes(A_TUNE));
const A_ONLY = code(chordNotes(A_TWICE));

/**
 * The modify step: D minor (D F A) under a tune that sings D major's F♯. The middle note is the one to move,
 * a half step up; the tune then sits on the chord's own notes (F♯ A | D A).
 */
const D_TUNE = "<[f#4 ~ a4 ~] [d5 ~ a4 ~]>";
const D_STARTER = code(chordNotes("⟪[d4,f4,a4]⟫"), melNotes(D_TUNE));
const dMajor = (stack: string) => code(chordNotes(stack), melNotes(D_TUNE));
const D_MAJOR = dMajor("[d4,f#4,a4]");

/** The Make starter: triads on 1, 4, 5 and 1 (C F G C), all major. */
const ALL_MAJOR = "<[0,2,4] [3,5,7] [4,6,8] [0,2,4]>";
const MAKE_STARTER = code(chords(ALL_MAJOR));

/** Drums only from the Band: the learner's chords set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "U05.L02",
  version: 3,
  title: "Major & Minor",
  objective:
    "I can tell a major triad from a minor one by ear and by its 3rds, and turn one into the other by moving its middle note a half step.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C02", "E08"],
  practises: [],
  terms: [
    { id: "term.major-triad", step: "S3" },
    { id: "term.minor-triad", step: "S3" },
  ],
  canDo: [],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "One chord, two moods",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "dark-then-bright",
        version: 1,
        role: "practice",
        prompt:
          "A chord on A plays for two bars, then nearly the same chord for two more. Listen for the bar where the mood changes, and whether it turns brighter or darker.",
        skills: [{ skill: "C02", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: HOOK,
            caption: "The chord on A with a tune. Listen across bar 3.",
            bars: 4,
          },
          { code: A_ONLY, caption: "The two chords alone, without the tune.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "One note moves",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "one-note-moves", code: A_ONLY, bars: 4 },
      exercise: {
        kind: "predict",
        id: "one-note-moves",
        version: 1,
        role: "practice",
        prompt:
          "Bars 1 and 2 play `[a3,c4,e4]`; bars 3 and 4 play `[a3,c#4,e4]`. Predict which bars sound brighter, and pick the answer that also gives the right reason.",
        skills: [{ skill: "C02", w: 1 }],
        hints: null,
        tests: [],
        code: A_ONLY,
        bars: 4,
        mode: "choose",
        choices: [
          { id: "bars-3-4", label: "Bars 3 and 4: the middle note goes up a half step" },
          { id: "bars-1-2", label: "Bars 1 and 2: the middle note sits lower" },
          { id: "same", label: "Neither: the lowest and highest notes stay put, so the colour does too" },
        ],
        correct: ["bars-3-4"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Count the 3rds",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      example: { id: "count-the-thirds", code: A_ONLY, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "count-the-thirds",
        version: 1,
        role: "practice",
        prompt:
          "Run the two chords and find their notes on the keyboard. Count the half steps from the bottom note up to the middle one, one for every key, black or white. Then answer both questions below.",
        skills: [{ skill: "C02", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count keys on the keyboard, black ones too: one half step for every key you move.",
        },
        hints: ladder(
          "In bars 1 and 2 the bottom note is A and the middle note is C. Count the keys from A up to C.",
          "One half step is one key, black or white. A 3rd of three half steps is minor, of four half steps major (Major, Minor, Perfect).",
          "From A: B♭ is one, B is two. Keep going to C, then on to C♯ for bars 3 and 4.",
        ),
        code: { starter: A_ONLY },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "Bars 1 and 2: how many half steps from A up to C?",
            correct: 3,
          },
          {
            q: "choice",
            prompt:
              "Bars 3 and 4 sound brighter. Which 3rd sits at the bottom of their chord, from A up to C♯?",
            options: [
              { id: "major", label: "A major 3rd: four half steps" },
              { id: "minor", label: "A minor 3rd: three half steps" },
              { id: "whole-step", label: "A whole step: two half steps" },
            ],
            correct: ["major"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 3, choice: ["major"] } }, expect: "pass" },
          {
            name: "keys counted from A itself",
            response: { answer: { number: 4, choice: ["major"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the minor 3rd picked",
            response: { answer: { number: 3, choice: ["minor"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Brighten D",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "brighten-d",
        version: 1,
        role: "check",
        prompt:
          "The tune sings D major, but the chord under it is D minor, D F A, and the two rub. Move one of the chord's three notes up a half step so the chord becomes D major. Change only the chord. Done when it is D major with D still at the bottom.",
        skills: [{ skill: "C02", w: 1 }],
        code: { starter: D_STARTER },
        reference: { solutions: [D_MAJOR], bars: 2 },
        // A chord is its notes, not its spelling: the pitch classes and the lowest note. `gb4` is the same key
        // as `f#4`, and the notes in another order are the same chord over the same D.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Keep D at the bottom and A at the top: only the middle note moves.",
          "harmony.bass":
            "Bar {bar}: D is no longer the lowest note. Keep D at the bottom; only the middle note changes.",
        },
        hints: ladder(
          "Only the 3rd above D decides major or minor. Find which of the three notes is that 3rd.",
          "D up to F is three half steps, a minor 3rd. A major triad needs four there, so the middle note goes up.",
          "Up a half step means one key to the right on the keyboard. The new key is a black one, and its name keeps the letter F.",
        ),
        tests: [
          { name: "reference", response: { code: D_MAJOR }, expect: "pass" },
          {
            name: "the same key spelled as a flat",
            response: { code: dMajor("[d4,gb4,a4]") },
            expect: "pass",
          },
          {
            name: "the same notes listed in another order",
            response: { code: dMajor("[d4,a4,f#4]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: dMajor("[d4,f4,a4]") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the bottom note moved instead",
            response: { code: dMajor("[d#4,f4,a4]") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the right notes with D moved to the top",
            response: { code: dMajor("[f#4,a4,d5]") },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "the top note moved instead",
            response: { code: dMajor("[d4,f4,a#4]") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the tune changed as well",
            response: { code: code(chordNotes("[d4,f#4,a4]"), melNotes("<[f4 ~ a4 ~] [d5 ~ a4 ~]>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "ear",
      title: "Bright or dark",
      minutes: 1.5,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "bright-or-dark",
        version: 1,
        role: "check",
        prompt: "Oak plays one chord at a time, each on a new note. Pick major or minor for each chord.",
        skills: [{ skill: "E08", w: 1 }],
        hints: [
          { text: "Listen for the colour: open and bright is major, darker and more inward is minor." },
          {
            text: "Hum the chord's lowest note, then the next note up. A small step up to it is minor; a wider one is major.",
          },
          { text: "Hear it again, slower, and hum the bottom two notes.", replay: { rate: 0.75 } },
          "auto",
        ],
        stimulus: { src: "generator", family: "fam.chd.quality-triad", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "quality-pad", set: ["maj", "min"] },
        correct: {},
        srs: [{ family: "fam.chd.quality-triad", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Spell the triad",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "spell-the-triad",
        version: 1,
        role: "check",
        prompt:
          "Oak names a triad by its root, with m after it when it is minor. Type its three notes from the root up, with any sharps or flats. Skip a letter twice to find the letters, then count half steps for each 3rd.",
        skills: [{ skill: "C02", w: 1 }],
        hints: ladder(
          "Start with the letters: from the root, skip one letter, then skip one more.",
          "The letters come first; the half steps decide any sharp or flat. Major: four half steps, then three. Minor: three, then four.",
          "E minor: the letters are E, G, B. E up to G is three half steps, G up to B four, so no sharps are needed.",
        ),
        stimulus: { src: "generator", family: "fam.chd.spell", level: 1 },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "text", normalize: "note" },
        correct: {},
        srs: [{ family: "fam.chd.spell", mode: "seed" }],
        tests: [],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Somewhere darker",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "somewhere-darker",
        version: 1,
        role: "practice",
        prompt:
          "Replace at least one of the four stacks with a minor triad, a stack on degree 2, 3 or 6. Try it in different bars, first, middle or last, and keep the place you like. Done when the loop has at least one minor triad.",
        skills: [{ skill: "C02", w: 1 }],
        // The catalog's text is "{label}: {detail}", and a contains-rn detail names the chords in Roman
        // numerals (U06.L02). The same text serves the suggestions, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-minor-triad",
            label: "At least one minor triad: a stack on degree 2, 3 or 6",
            required: true,
            skills: ["C02"],
            rule: "contains-rn",
            rn: ["ii", "iii", "vi"],
            min: 1,
          },
          {
            id: "a-bass",
            label: "A bass line on its own line, such as `bass`",
            required: false,
            skills: ["C01"],
            rule: "tracks",
            min: 1,
            roles: ["bass"],
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
        ],
        hints: ladder(
          "Pick one of the four bars and replace its stack with one built on degree 2, 3 or 6.",
          "Stack on `n` 1, 2 or 5 (degrees 2, 3 and 6, since `n` counts from 0). Put it in place of one of the four bars.",
          "Degree 6 is `n` 5, so its stack starts `[5,7,…]`. Swap it in for bar 2 or bar 4 and listen.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: bar 2 becomes the triad on 6",
            response: { code: code(chords("<[0,2,4] [5,7,9] [4,6,8] [0,2,4]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: a bass, chords twice a bar, a tune",
            response: {
              code: code(
                bass("<0 5 3 4>"),
                chords(
                  "<[[0,2,4] ~ [0,2,4] ~] [[5,7,9] ~ [5,7,9] ~] [[3,5,7] ~ [3,5,7] ~] [[4,6,8] ~ [4,6,8] ~]>",
                  ".gain(.7)",
                ),
                mel("<[4 ~ 2 0] [5 ~ 2 0] [5 ~ 3 0] [4 ~ 6 4]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "the minor chord in note names",
            response: { code: code(chordNotes("<[c4,e4,g4] [f4,a4,c5] [d4,f4,a4] [g3,b3,d4]>")) },
            expect: "pass",
          },
          {
            name: "four major triads in another order",
            response: { code: code(chords("<[0,2,4] [4,6,8] [3,5,7] [0,2,4]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
