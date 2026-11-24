// U06.L01 The Seven Chords. Every degree of a key carries a triad, stacked "+2, +2" from it: seven chords,
// all made of the key's own notes. `.add(n("…"))`, written before `.scale()`, moves one stack `[0,2,4]` onto
// any root, so a whole loop is one stack and a line of roots. Major on 1, 4 and 5, minor on 2, 3 and 6,
// diminished on 7: the key's diatonic chords. What the learner has: triads stacked by hand (U05.L01), their
// qualities (U05.L02–L03), chord names (U05.L04), inversions and the bass clef (U05.L05–L06), hand voice
// leading and `chord().voicing()` (U05.L07–L08). Not yet: Roman numerals (U06.L02), what the chords do
// (function, U06.L03), endings (cadence, U06.L04). Spec: content/specs/U06.md.
//
// How it uses the chord kinds (AUTHORING §17): a loop moved with `.add()` is graded as chords (`pcset` per
// onset with the bass), so vi an octave lower passes; the chord on degree 2 is built on the keyboard in
// `chord` mode; the Make's one required rule is `contains-rn`, read from the learner's own chords. Its
// detail prints Roman numerals, which arrive next lesson, so `rubric.unmet` is overridden (U05.L01 S8).
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One triad on each root of `roots` (n values, one a bar), stacked "+2, +2" and moved with `.add()`. */
const triads = (roots: string, extra = "", scale = "C3:major") =>
  `chords: n("[0,2,4]").add(n("${roots}")).scale("${scale}").s("piano")${extra}`;
/** A bass line on the same roots, two octaves under the tune. */
const bass = (roots: string) => `bass: n("${roots}").scale("C2:major").s("ebass").lpf(600)`;
/** A melody line in degrees. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** Up the key a step a bar, C Dm Em F G, and back F Dm G: every bar a triad of C, the bass on its root. */
const CLIMB = "<0 1 2 3 4 3 1 4>";
const HOOK = code(triads(CLIMB), bass(CLIMB));
/** The predict step: C, then the same stack three degrees higher, F. */
const C_THEN_F = code(triads("<0 3>"));
/** The seven stacks, one a bar: C Dm Em F G Am B°. */
const SEVEN = code(triads("<0 1 2 3 4 5 6>"));

/** The four-chord loop of U05 in `.add()` form: roots on degrees 1, 5, 6 and 4. */
const LOOP = "<0 4 5 3>";
const MODIFY_STARTER = code(triads("<0 4 ⟪0 0⟫>"));
const MAKE_STARTER = code(triads(LOOP));

/** After a bar of C, a chord on D: the key's own D minor, or D major with its F♯. */
const C_CHORD = code('chords: n("[0,2,4]@4").scale("C3:major").s("piano")');
const D_MAJOR = code('chords: note("<[c3,e3,g3] [d3,f#3,a3]>").s("piano")');
const D_MINOR = code('chords: n("<[0,2,4] [1,3,5]>").scale("C3:major").s("piano")');

/** The Band's drums only: the learner's chords set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
/** Drums and the Band's bass (C G A F, a bar each), for the step whose target is I V vi IV. */
const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "U06.L01",
  version: 4,
  title: "The Seven Chords",
  objective:
    'I can build a triad on any degree of a key and move one stack onto any root with .add(n("…")): seven chords, all from the key\'s own notes.',
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H01"],
  practises: [],
  terms: [{ id: "term.diatonic", step: "S6" }],
  canDo: ["cd.write.triads"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes" } } },
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Up the key",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "up-the-key",
        version: 1,
        role: "practice",
        prompt:
          "The chords climb the key a step a bar, then turn back, with the bass on every root. Listen for which chords sound bright and which sound darker as they pass.",
        skills: [{ skill: "H01", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Up the key a step a bar, then back. Listen bar by bar.", bars: 8 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "One stack, moved",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "c-then-f", code: C_THEN_F, bars: 2 },
      exercise: {
        kind: "predict",
        id: "one-stack-moved",
        version: 1,
        role: "practice",
        prompt:
          'Predict what the two bars play, and pick it. `.add(n("<0 3>"))` comes before `.scale()`: in bar 1 it adds 0 to the stack `[0,2,4]`, in bar 2 it adds 3.',
        skills: [{ skill: "H01", w: 1 }],
        hints: null,
        tests: [],
        code: C_THEN_F,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "moved", label: "C, then F: every note of the stack moves up three degrees" },
          { id: "grown", label: "C, then C with a fourth note on top" },
          { id: "same", label: "C twice: the numbers change nothing" },
        ],
        correct: ["moved"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Triads on every degree",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "the-seven", code: SEVEN, bars: 7 },
      exercise: {
        kind: "run-investigate",
        id: "a-triad-on-every-degree",
        version: 1,
        role: "practice",
        prompt:
          "Run it and read the degree labels on the roll, bar by bar. Each bar adds 1 more than the bar before. Then answer both questions below.",
        skills: [{ skill: "H01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare bar 1 with bar 2 on the roll: look at all three labels, not only the lowest.",
        },
        hints: ladder(
          "In bar 1 the labels read 1, 3, 5. Read all three labels of bar 2 and compare.",
          "`.add()` adds its number to every note of the stack, and `n` counts from 0: adding 4 starts the stack on `n` 4.",
          "Bar 2 adds 1 and plays 2, 4, 6: every label one higher. Now read bar 5's lowest label.",
        ),
        code: { starter: SEVEN },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What does adding 1 more each bar do to the stack?",
            options: [
              { id: "all-up", label: "Moves every note up one degree" },
              { id: "one-more", label: "Adds one more note on top" },
              { id: "bottom-only", label: "Moves only the lowest note" },
            ],
            correct: ["all-up"],
          },
          {
            q: "number",
            prompt: "Bar 5 adds 4. On which degree is that chord's root?",
            correct: 5,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["all-up"], number: 5 } }, expect: "pass" },
          {
            name: "one note added",
            response: { answer: { choice: ["one-more"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the n value read as the degree",
            response: { answer: { choice: ["all-up"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Finish the loop",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "finish-the-loop",
        version: 1,
        role: "check",
        prompt:
          "This is the four-chord loop from Stacking Thirds, one stack moved by `.add()`. Bars 3 and 4 still add 0, so they sit on degree 1. Change those two numbers so bar 3's chord sits on degree 6 and bar 4's on degree 4.",
        skills: [{ skill: "H01", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [code(triads(LOOP))], bars: 4 },
        // A chord is its notes and its lowest one, not its spelling: vi an octave lower (`-2`) passes.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. `n` counts from 0, so the number to add is the degree minus one.",
        },
        hints: ladder(
          "Bar 2 adds 4, and its chord sits on degree 5. Compare the number with the degree.",
          "`n` counts from 0, so the number to add is the degree minus one.",
          "Bar 3 needs degree 6, so it adds one less than 6. Bar 4 works the same way.",
        ),
        tests: [
          { name: "reference", response: { code: code(triads(LOOP)) }, expect: "pass" },
          {
            name: "vi an octave lower",
            response: { code: code(triads("<0 4 -2 3>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: MODIFY_STARTER.replace(/[⟪⟫]/g, "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the degrees written as numbers: 6 and 4",
            response: { code: code(triads("<0 4 6 4>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "bar 2 changed as well",
            response: { code: code(triads("<0 3 5 3>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
          {
            name: ".add() after .scale(): nothing moves",
            response: {
              code: code('chords: n("[0,2,4]").scale("C3:major").add(n("<0 4 5 3>")).s("piano")'),
            },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "A triad on D",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "triad-on-d",
        version: 1,
        role: "check",
        prompt:
          "Play the triad on degree 2 of C major: three notes at once, its root at the bottom. Use only notes of C major.",
        skills: [{ skill: "H01", w: 1 }],
        hints: ladder(
          "Start from degree 2 of C major: count up the scale from C.",
          "Stack from D the way `[1,3,5]` does: skip a white key, take the next, twice.",
          "D and F are the first two. One more white key, a 3rd above F.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [2, 5, 9], bassPc: 2 },
        pitchMode: "octave-free",
        tests: [
          { name: "D F A", response: { answer: { midi: [50, 53, 57] } }, expect: "pass" },
          { name: "D F A an octave up", response: { answer: { midi: [62, 65, 69] } }, expect: "pass" },
          {
            name: "D F♯ A: D major",
            response: { answer: { midi: [50, 54, 57] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "F under D and A",
            response: { answer: { midi: [53, 62, 69] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "compare",
      title: "Which D belongs?",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "which-d-belongs",
        version: 1,
        role: "practice",
        prompt:
          "A bar of C plays, then two cards: each plays C again, then a triad on D. Pick the card whose D chord uses only notes of C major.",
        skills: [{ skill: "H01", w: 1 }],
        hints: ladder(
          "Listen for a D chord that brings in a note from outside the C bar's key.",
          "C major has no black keys. A triad on D that is major needs one: F♯.",
          "Card A plays D, F♯ and A. Is F♯ a note of C major?",
        ),
        stimulus: { src: "code", code: C_CHORD, bars: 1, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "major", label: "Card A", audio: D_MAJOR },
            { id: "minor", label: "Card B", audio: D_MINOR },
          ],
        },
        correct: { choice: ["minor"] },
        // The catalog's `id.wrong` names the option ids ("That was minor, not major").
        feedbackText: {
          "id.wrong":
            "Card B is the one. Card A's D chord has F♯, a black key: C major has none. Play both again.",
        },
        tests: [
          { name: "card B", response: { answer: { choice: ["minor"] } }, expect: "pass" },
          {
            name: "card A",
            response: { answer: { choice: ["major"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your own loop",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "loop-of-your-own",
        version: 1,
        role: "practice",
        prompt:
          "Change at least one number in `.add()` so the loop uses a chord the four-chord loop never had: the one on degree 2, 3 or 7. Your loop plays the four bars that climb into the first loud part of your song. Done when the loop has a chord on degree 2, 3 or 7.",
        skills: [{ skill: "H01", w: 1 }],
        // The catalog's text is "{label}: {detail}", and this rule's detail names the chords in Roman
        // numerals (U06.L02). The same text serves the suggestions, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-new-chord",
            label: "At least one chord on degree 2, 3 or 7",
            required: true,
            skills: ["H01"],
            rule: "contains-rn",
            rn: ["ii", "iii", "viio"],
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
          "Change one number in `.add()`. The number for a degree is that degree minus one.",
          "`n` counts from 0: degree 2 is 1, degree 3 is 2, degree 7 is 6. Change one of the four numbers.",
          "Bar 3 could add 1 instead of 5: the dark chord on degree 2. The one on 7 sounds tense on its own; it settles best when the next bar adds 0.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: one number changed, degree 2 in bar 3",
            response: { code: code(triads("<0 4 1 3>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: degree 7 into home, a bass, a tune on a Rhodes",
            response: {
              code: code(
                // Roots first, so bar 4 really holds V then vii° (U06.L08): stack-first would fold to V.
                'chords: n("<0 2 3 [4 6]>").add(n("[0,2,4]")).scale("C3:major").s("rhodes").gain(.7)',
                bass("<0 2 3 [4 6]>"),
                mel("<[4 ~ 2 ~] [4 ~ 6 ~] [5 ~ 3 ~] [1 ~ 3 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "every chord major: 1, 4, 5, 1",
            response: { code: code(triads("<0 3 4 0>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
