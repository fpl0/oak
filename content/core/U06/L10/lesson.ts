// U06.L10 Seventh Colour (preview). Stack one more 3rd on a triad and it becomes a four-note chord:
// `n("[0,2,4,6]")` is root, 3rd, 5th and 7th. Put that stack on every chord of a loop and pop turns into
// neo-soul. A preview (contracts §2.1): the kinds of seventh chord, their symbols (Cmaj7, Dm7, G7) and their
// numerals wait for U12, so the lesson says "one more 3rd" and "the 7th", and its code is the stack.
// What the learner has: triads stacked by hand (U05.L01) and moved with `.add(n(…))` (U06.L01), Roman
// numerals (U06.L02), the keyboard in chord mode (U05.L01 S5). Not yet: slash chords under a walking bass
// (U06.L11), `.struct()` (U06.L12), "chord tone" (U07.L03). Spec: content/specs/U06.md.
//
// How it uses the Wave 4 kinds (AUTHORING §17): the stack is graded as a chord (`pcset` per onset with the
// bass), so the same four notes listed top down pass and the root doubled at the top (`[0,2,4,7]`) fails;
// the keyboard step compares pitch classes and the lowest note; the Make's one required rule is
// `chord-qualities` with the four diatonic seventh kinds and `min: 2`, which a triad loop cannot meet.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 80;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** One stack (`shape`) moved onto each root of the loop with U06.L01's `.add()`, on the Rhodes. */
const stacks = (shape: string, roots = LOOP, extra = "") =>
  `chords: n("${shape}").add(n("${roots}")).scale("C3:major").s("rhodes")${extra}`;
/** The upright bass on the roots, one a bar. */
const bass = (roots = LOOP) => `bass: n("${roots}").scale("C2:major").s("upright")`;
/** A melody line in degrees. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** I vi ii V in C: roots on degrees 1, 6, 2 and 5 (n 0, 5, 1, 4), one a bar. */
const LOOP = "<0 5 1 4>";
const TRIAD = "[0,2,4]";
const SEVENTH = "[0,2,4,6]";
/**
 * The tune: every note it plays belongs to the four-note chord under it (E G B | A G E | F D A | G F), so
 * the 7th of each chord sings in the tune too (B over C, G over A, C is left to the chord, F over G).
 */
const TUNE = "<[2 ~ 4 6] [5 ~ 4 2] [3 ~ 1 5] [4 ~ 3 ~]>";
const HOOK = code(stacks(SEVENTH), bass(), mel(TUNE));
/**
 * The tune for the plain-triad version: only notes of each triad (E G C | A E C | F D A | G B), so no 7th
 * sounds anywhere in it (review finding theory-d 6: the hook's own tune kept B over C, G over Am and F over G,
 * and the "plain triads" still sounded sevenths).
 */
const TRIAD_TUNE = "<[2 ~ 4 7] [5 ~ 2 0] [3 ~ 1 5] [4 ~ 6 ~]>";
/** The same loop in plain triads: C Am Dm G, the tune on triad notes too. */
const HOOK_TRIADS = code(stacks(TRIAD), bass(), mel(TRIAD_TUNE));
const SEVENTHS_ONLY = code(stacks(SEVENTH));
const TRIADS_ONLY = code(stacks(TRIAD));

/** S4: the stack is the one thing to change. */
const MODIFY_STARTER = code(stacks(`⟪${TRIAD}⟫`), bass());
const MODIFY_SOLUTION = code(stacks(SEVENTH), bass());
const modifyWith = (shape: string, roots = LOOP) => code(stacks(shape, roots), bass());

/**
 * The Make starts from the learner's oldest loop, I V vi IV with its U05.L01 tune, in triads (learner review:
 * the hook's loop in triads was S4's starter again, so the minimal pass was S4's answer). Coloured, it becomes
 * Cmaj7 G7 Am7 Fmaj7; which chords take the 7th is the learner's choice.
 */
const AXIS = "<0 4 5 3>";
const AXIS_TUNE = "<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>";
const MAKE_STARTER = code(stacks(TRIAD, AXIS), bass(AXIS), mel(AXIS_TUNE));

/** Drums only from the Band (the jazz-soul flavour swings them; the prose says "lean back"): the learner's chords and bass set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "U06.L10",
  version: 5,
  title: "Seventh Colour (preview)",
  objective: 'I can stack one more 3rd on a triad, n("[0,2,4,6]"), and colour a chord loop with it.',
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C10"],
  practises: [],
  terms: [{ id: "term.seventh-chord", step: "S3" }],
  canDo: ["cd.compose.seventh-colour"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A neo-soul loop",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "a-neo-soul-loop",
        version: 1,
        role: "practice",
        prompt:
          "The same four roots twice, on the Rhodes over an upright bass. Listen for which version's chords sound richer and which sound more settled.",
        skills: [{ skill: "C10", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "The loop on 1, 6, 2 and 5, with a tune.", bars: 4 },
          {
            code: HOOK_TRIADS,
            caption: "The same roots in plain triads, with a tune that fits them.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "One more number",
      minutes: 0.5,
      ui: { panels: NONE },
      example: {
        id: "one-stack",
        code: code('chords: n("[0,2,4,6]").scale("C3:major").s("rhodes")'),
        bars: 1,
      },
      exercise: {
        kind: "predict",
        id: "one-more-number",
        version: 1,
        role: "practice",
        prompt:
          'Predict what `n("[0,2,4,6]")` plays in C major, and pick it. `n("[0,2,4]")` is the triad on 1, and `n` counts from 0, so `n` 6 is degree 7.',
        skills: [{ skill: "C10", w: 1 }],
        hints: null,
        tests: [],
        code: code('chords: n("[0,2,4,6]").scale("C3:major").s("rhodes")'),
        bars: 1,
        mode: "choose",
        choices: [
          { id: "one-three-five-seven", label: "Degrees 1, 3, 5 and 7 together: C, E, G and B" },
          { id: "one-to-four", label: "Degrees 1, 2, 3 and 4 together: C, D, E and F" },
          { id: "octave-on-top", label: "Degrees 1, 3 and 5, and 1 again an octave up" },
        ],
        correct: ["one-three-five-seven"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Count the notes",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      example: { id: "the-four-stacks", code: SEVENTHS_ONLY, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "count-the-notes",
        version: 1,
        role: "practice",
        prompt:
          "Run the four stacks over the drums and read the degree labels on the roll, chord by chord, from the bottom up. Then answer both questions below.",
        skills: [{ skill: "C10", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Stop on bar 1 and read its labels from the bottom: 1, 3, 5, and one more above the 5.",
        },
        hints: ladder(
          "Bar 1 has the labels 1, 3 and 5 at the bottom. Look for one more label above them.",
          "Every stack in this loop is the same shape, moved by `.add()`: count the numbers inside `[0,2,4,6]`.",
          "The top note of bar 1 is degree 7, B. How far is it above G, and how far below the next C?",
        ),
        code: { starter: SEVENTHS_ONLY },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many notes sound together in each chord?",
            correct: 4,
          },
          {
            q: "choice",
            prompt: "Where does the new top note sit?",
            options: [
              { id: "third-above-fifth", label: "A 3rd above the 5th, one step under the root an octave up" },
              { id: "octave", label: "On the root again, an octave up" },
              { id: "step-above-fifth", label: "One step above the 5th" },
            ],
            correct: ["third-above-fifth"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 4, choice: ["third-above-fifth"] } },
            expect: "pass",
          },
          {
            name: "three notes, as in a triad",
            response: { answer: { number: 3, choice: ["third-above-fifth"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the root doubled",
            response: { answer: { number: 4, choice: ["octave"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Colour the loop",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "colour-the-loop",
        version: 1,
        role: "check",
        prompt:
          "The loop plays triads from the stack `[0,2,4]`. Add one more number to that stack so every chord gets one more 3rd on top, as in the hook. Done when every chord plays four notes stacked in 3rds.",
        skills: [{ skill: "C10", w: 1 }],
        code: { starter: MODIFY_STARTER },
        reference: { solutions: [MODIFY_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one. The four notes listed
        // top down pass; the root doubled at the top (`[0,2,4,7]`) adds no new note and fails.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        srs: [{ family: "fam.har.rn", mode: "review-if-due" }],
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Keep stacking in 3rds: skip a degree each time.",
        },
        hints: ladder(
          "The stack goes 0, 2, 4: each number is 2 more than the one before. Continue the pattern.",
          "A 3rd is every other degree, 2 more in `n`. One more 3rd goes on top of the 4.",
          "The new number goes after the 4, inside the brackets, with a comma before it.",
        ),
        tests: [
          { name: "reference", response: { code: MODIFY_SOLUTION }, expect: "pass" },
          {
            name: "the same four notes listed top down",
            response: { code: modifyWith("[6,4,2,0]") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: MODIFY_STARTER.replace("⟪", "").replace("⟫", "") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the root doubled an octave up, not a 7th",
            response: { code: modifyWith("[0,2,4,7]") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "a step above the 5th: the 6th",
            response: { code: modifyWith("[0,2,4,5]") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the roots changed as well",
            response: { code: modifyWith(SEVENTH, "<0 5 3 4>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Three notes or four",
      minutes: 0.5,
      ui: { panels: NONE, band: DRUMS },
      exercise: {
        kind: "identify",
        id: "three-notes-or-four",
        version: 1,
        role: "practice",
        prompt:
          "Both cards play the same loop on the Rhodes. Pick the card where every chord has the extra 3rd on top.",
        skills: [{ skill: "C10", w: 1 }],
        hints: ladder(
          "Listen for which card sounds plainer and which sounds richer, a little blurred at the top.",
          "The extra 3rd sits a step under the root's octave, so it keeps a little of a 2nd's rub.",
          "Play the hook of this lesson, then each card. Which card shares its soft rub?",
        ),
        stimulus: { src: "code", code: SEVENTHS_ONLY, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "four", label: "Card A", audio: SEVENTHS_ONLY },
            { id: "three", label: "Card B", audio: TRIADS_ONLY },
          ],
        },
        correct: { choice: ["four"] },
        // The catalog's `id.wrong` names the option ids ("That was four, not three").
        feedbackText: {
          "id.wrong":
            "That was the plain triads. Play both cards again: the one with the extra 3rd sounds softer and fuller.",
        },
        tests: [
          { name: "four", response: { answer: { choice: ["four"] } }, expect: "pass" },
          {
            name: "three",
            response: { answer: { choice: ["three"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Four notes on 2",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "four-notes-on-two",
        version: 1,
        role: "check",
        prompt:
          "Play the chord of bar 3 on the keyboard: the four-note stack on degree 2 of C major. Put D at the bottom, then three more white keys, each a 3rd above the last, all four at once.",
        skills: [{ skill: "C10", w: 1 }],
        hints: ladder(
          "Start on D. Each new note is a 3rd above the last, so it skips one letter.",
          "On white keys a 3rd skips one key: D, skip E, F. Keep going the same way.",
          "D, F and A are the triad. One more white key, a 3rd above A.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [2, 5, 9, 0], bassPc: 2 },
        pitchMode: "octave-free",
        tests: [
          { name: "D F A C", response: { answer: { midi: [50, 53, 57, 60] } }, expect: "pass" },
          { name: "D F A C an octave up", response: { answer: { midi: [62, 65, 69, 72] } }, expect: "pass" },
          {
            name: "D F A: the triad, no 7th",
            response: { answer: { midi: [50, 53, 57] } },
            expect: "fail",
            feedback: ["kb.missing-note"],
          },
          {
            name: "D F A B: a step above A",
            response: { answer: { midi: [50, 53, 57, 59] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "F at the bottom",
            response: { answer: { midi: [53, 57, 60, 62] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Colour your loop",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "colour-your-loop",
        version: 1,
        role: "practice",
        prompt:
          "Your four-chord loop from The Four-Chord Schema is in the editor, for the part after your song's opening. Give at least two of its chords one more 3rd on top, whichever you choose. The Rhodes suits it. Done when at least two chords have a 7th on top.",
        skills: [{ skill: "C10", w: 1 }],
        // The catalog's text is "{label}: {detail}", and this rule's detail names the kinds of four-note
        // chord (major 7th, dominant 7th), which wait for U12. The same text serves the suggestions.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        // Decision of 2026-11-13 (d15): this Make opens with the learner's own sketch from U05.L01 when one is
        // saved, with "Start from Oak's copy" to put the starter back; without one it opens with the starter.
        fromSketch: "U05.L01",
        rubric: [
          {
            id: "two-sevenths",
            label: "At least two chords with a 7th on top: four notes stacked in 3rds",
            required: true,
            skills: ["C10"],
            rule: "chord-qualities",
            track: "chords",
            anyOf: ["maj7", "7", "m7", "m7b5"],
            min: 2,
          },
          {
            id: "rhodes",
            label: "The `rhodes` sound used",
            required: false,
            skills: ["C10"],
            rule: "sounds",
            contains: ["snd.rhodes"],
          },
          {
            id: "a-bass",
            label: "A bass line on its own line, such as `bass`",
            required: false,
            skills: ["H01"],
            rule: "tracks",
            min: 1,
            roles: ["bass"],
          },
        ],
        hints: ladder(
          "One more number in the stack gives a chord one more 3rd. Find the stack in the `chords` line.",
          "A stack of four, `[0,2,4,6]`, is a triad with one more 3rd. It only needs to reach two of the chords.",
          'Change the stack in `n("[0,2,4]")` and every chord the loop moves it to gets the new note.',
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the stack of four on every chord",
            response: { code: code(stacks(SEVENTH, AXIS), bass(AXIS), mel(AXIS_TUNE)) },
            expect: "pass",
          },
          {
            name: "two of the four coloured, by hand: Cmaj7 and Am7",
            response: {
              code: code(
                'chords: n("<[0,2,4,6] [4,6,8] [5,7,9,11] [3,5,7]>").scale("C3:major").s("rhodes")',
                bass(AXIS),
                mel(AXIS_TUNE),
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: two chords coloured, a new loop, a tune, the room",
            response: {
              code: code(
                'chords: n("<[3,5,7,9] [2,4,6] [1,3,5,7] [4,6,8]>").scale("C3:major").s("rhodes").room(.3)',
                bass("<3 2 1 4>"),
                mel("<[5 ~ 2 0] [4 ~ 2 ~] [3 ~ 5 7] [6 ~ 4 ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "only one chord coloured",
            response: {
              code: code(
                'chords: n("<[0,2,4,6] [4,6,8] [5,7,9] [3,5,7]>").scale("C3:major").s("rhodes")',
                bass(AXIS),
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the root doubled on top, not a 7th",
            response: { code: code(stacks("[0,2,4,7]", AXIS), bass(AXIS)) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
