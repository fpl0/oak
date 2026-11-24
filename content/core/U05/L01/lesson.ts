// U05.L01 Stacking Thirds (exemplar of U05). A chord is three notes of the key stacked a 3rd apart:
// `n("[0,2,4]")` is degrees 1, 3 and 5 sounding together, the triad on 1; the same "+2, +2" on any degree
// stacks the triad on it, and its bottom note is the root. What the learner has: degrees in `n` (U03),
// `n` past 7 (U03.L03), 3rds and 5ths counted in degrees (U04.L01) and in half steps (U04.L02), notes
// played together with `,` (U04.L03). Not yet: major and minor as chord qualities (U05.L02), chord names
// (U05.L04), the bass clef (U05.L06), `chord()` and `.voicing()` (U05.L08, behind the gate of U05.L07).
// Spec: content/specs/U05.md.
//
// How it uses the chord kinds (AUTHORING §17): chords written as `n` stacks are graded with the `pcset`
// matcher (pitch classes per onset plus the bass), never by text and never by octave, so `[9,7,5]` and
// `[-2,0,2]` pass where `[5,7,9]` does; a chord built on the keyboard is a `keyboard` exercise in `chord`
// mode, compared by pitch class and lowest note; the Make's one required rule is a `progression` read
// from the learner's own stacks, so any rhythm, spacing or octave of the right chords passes.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A chord line written as stacked degrees in C, an octave under the melody. */
const chords = (pattern: string, extra = "") =>
  `chords: n("${pattern}").scale("C3:major").s("piano")${extra}`;
/** A melody line in degrees. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The loop of the lesson: a triad on each note the Band's bass plays, 1 5 6 4 (C G A F), one a bar. Every
 * stack is "+2, +2" from its bottom note: [0,2,4] C E G, [4,6,8] G B D, [5,7,9] A C E, [3,5,7] F A C.
 */
const LOOP = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
/**
 * The tune over it: chord notes on every beat it plays (G E G | B G | A C A | A F), so nothing rubs with
 * the chords or with the jazz-soul Band's sevenths under it.
 */
const TUNE = "<[4 ~ 2 4] [6 ~ 4 ~] [5 ~ 7 5] [5 ~ 3 ~]>";
const HOOK = code(chords(LOOP, ".gain(.7)"), mel(TUNE));
const LOOP_ONLY = code(chords(LOOP));
/** The see step: the four triads an octave up, on the treble staff (C E G from middle C on its ledger line). */
const ON_THE_PAGE = `${TEMPO}chords: n("${LOOP}").scale("C4:major").s("piano")`;

/** The Band's drums and its bass (C G A F, a bar each); the learner plays the chords. */
const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;
const STAFF_KEYS = { roll: false, staff: "treble", keyboard: true } as const;

/** Bar 3 is the one to build: the bass plays A, degree 6. */
const MISSING = "<[0,2,4] [4,6,8] ⟪[5]⟫ [3,5,7]>";
const MAKE_STARTER = code(chords("<[0,2,4] ~ ~ ~>"));

export default defineLesson({
  id: "U05.L01",
  version: 4,
  title: "Stacking Thirds",
  objective: 'I can stack a triad on any degree of a key with n("[0,2,4]"): root, 3rd and 5th.',
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["C01"],
  practises: [],
  terms: [
    { id: "term.triad", step: "S3" },
    { id: "term.root", step: "S4" },
  ],
  canDo: ["cd.code.triads"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three at once",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "three-at-once",
        version: 1,
        role: "practice",
        prompt:
          "Under the tune, the piano plays three notes at once, one stack a bar. Listen for the one bar whose stack sounds darker than the other three.",
        skills: [{ skill: "C01", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "Drums, bass, a tune, and the stacks under it.", bars: 4 },
          { code: LOOP_ONLY, caption: "The stacks alone, without the tune. Listen bar by bar.", bars: 4 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which degrees?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "one-stack", code: code(chords("[0,2,4]")), bars: 1 },
      exercise: {
        kind: "predict",
        id: "which-degrees",
        version: 1,
        role: "practice",
        prompt:
          'Predict what `n("[0,2,4]")` plays in C major, then pick that answer. `n` counts degrees from 0, and the commas play the numbers at once.',
        skills: [{ skill: "C01", w: 1 }],
        hints: null,
        tests: [],
        code: code(chords("[0,2,4]")),
        bars: 1,
        mode: "choose",
        choices: [
          { id: "one-three-five", label: "Degrees 1, 3 and 5 together: C, E and G" },
          { id: "one-two-three", label: "Degrees 1, 2 and 3 together: C, D and E" },
          { id: "in-turn", label: "Degrees 1, 3 and 5, one after another" },
        ],
        correct: ["one-three-five"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Every other note",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      example: { id: "the-loop", code: LOOP_ONLY, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "every-other-note",
        version: 1,
        role: "practice",
        prompt:
          "Run the four stacks with the band and read the degree labels on the roll, bar by bar. Then answer both questions below.",
        skills: [{ skill: "C01", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the labels inside one stack on the roll: 1, 3, 5 skips a degree each time.",
        },
        hints: ladder(
          "In bar 1 the labels are 1, 3 and 5. Which degrees are left out between them?",
          "Each stack skips one degree, then another: two steps of the scale from note to note, the distance U04 called a 3rd.",
          "`[4,6,8]` is `n` 4, 6 and 8. The lowest is `n` 4: add one to get its degree.",
        ),
        code: { starter: LOOP_ONLY },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "How far apart are neighbouring notes inside each stack?",
            options: [
              { id: "third", label: "A 3rd: every other note of the scale" },
              { id: "second", label: "A 2nd: the very next note of the scale" },
              { id: "fifth", label: "A 5th: four notes of the scale apart" },
            ],
            correct: ["third"],
          },
          {
            q: "number",
            prompt: "Bar 2 plays `[4,6,8]`. Which degree is its lowest note?",
            correct: 5,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["third"], number: 5 } }, expect: "pass" },
          {
            name: "seconds",
            response: { answer: { choice: ["second"], number: 5 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the n value read as the degree",
            response: { answer: { choice: ["third"], number: 4 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Build bar 3",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-modify",
        id: "build-bar-three",
        version: 1,
        role: "check",
        prompt:
          "In bar 3 the bass plays A, degree 6, but the stack there has only one note, `n` 5. Add two more notes to it, built the same way as the other bars. Change only bar 3. Done when bar 3 stacks three notes on degree 6.",
        skills: [{ skill: "C01", w: 1 }],
        code: { starter: code(chords(MISSING)) },
        reference: { solutions: [code(chords(LOOP))], bars: 4 },
        // A chord is its notes, not its spelling in code: the pitch classes at each onset and the lowest one.
        // `[9,7,5]` and `[-2,0,2]` (the same notes listed top down, or an octave lower) pass.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the target has {exp}. Stack from the bass note: skip a degree, then skip another.",
        },
        hints: ladder(
          "Bar 1 starts on `n` 0 and goes `0, 2, 4`: the same amount is added each time. Do the same from `n` 5.",
          "Degree 6 is `n` 5. Add 2, then 2 more, inside the brackets, with commas between.",
          "The first two notes are `n` 5 and `n` 7. One more, 2 above the last.",
        ),
        tests: [
          { name: "reference", response: { code: code(chords(LOOP)) }, expect: "pass" },
          {
            name: "the same notes listed top down",
            response: { code: code(chords("<[0,2,4] [4,6,8] [9,7,5] [3,5,7]>")) },
            expect: "pass",
          },
          {
            name: "the same chord an octave down",
            response: { code: code(chords("<[0,2,4] [4,6,8] [-2,0,2] [3,5,7]>")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(chords("<[0,2,4] [4,6,8] [5] [3,5,7]>")) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "steps instead of 3rds",
            response: { code: code(chords("<[0,2,4] [4,6,8] [5,6,7] [3,5,7]>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "the stack on the wrong degree",
            response: { code: code(chords("<[0,2,4] [4,6,8] [6,8,10] [3,5,7]>")) },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "bar 4 changed as well",
            response: { code: code(chords("<[0,2,4] [4,6,8] [5,7,9] [3,5,8]>")) },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "A triad on F",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "triad-on-f",
        version: 1,
        role: "check",
        prompt:
          "Play the triad on F, degree 4 of C major: F as the lowest note, then two more white keys above it, each a 3rd above the last, all three at once.",
        skills: [{ skill: "C01", w: 1 }],
        hints: ladder(
          "Start on F. Each new note is a 3rd above the last one, so it skips one letter.",
          "On white keys a 3rd skips one key: F, skip G, A.",
          "F and A are the first two. Skip B for the third note.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [5, 9, 0], bassPc: 5 },
        pitchMode: "octave-free",
        tests: [
          { name: "F A C", response: { answer: { midi: [53, 57, 60] } }, expect: "pass" },
          { name: "F A C an octave up", response: { answer: { midi: [65, 69, 72] } }, expect: "pass" },
          {
            name: "F G A: steps",
            response: { answer: { midi: [53, 55, 57] } },
            expect: "fail",
            feedback: ["kb.missing-note"],
          },
          {
            name: "C at the bottom",
            response: { answer: { midi: [48, 53, 57] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
          {
            name: "two notes",
            response: { answer: { midi: [53, 57] } },
            expect: "fail",
            feedback: ["kb.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "see",
      title: "On the page",
      minutes: 0.5,
      ui: { panels: STAFF_KEYS, staffLabels: "degree" },
      example: { id: "on-the-page", code: ON_THE_PAGE, bars: 4 },
    },
    {
      id: "S7",
      kind: "compare",
      title: "Stack or cluster",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "stack-or-cluster",
        version: 1,
        role: "practice",
        prompt:
          "Each card plays three notes at once. Pick the card stacked in 3rds; the other plays three neighbouring notes squeezed together.",
        skills: [{ skill: "C01", w: 1 }],
        hints: ladder(
          "Listen to both cards for the one that sounds open and settled, and the one that rubs.",
          "Neighbours a step apart clash, the way a 2nd did in U04. Notes a 3rd apart sit well together.",
          "Play card 2, then the first stack of the loop from this lesson. Are they the same sound?",
        ),
        stimulus: { src: "code", code: code(chords("[0,2,4]@4")), bars: 1, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "cluster", label: "Three neighbours", audio: code(chords("[0,1,2]@4")) },
            { id: "stack", label: "Stacked in 3rds", audio: code(chords("[0,2,4]@4")) },
          ],
        },
        correct: { choice: ["stack"] },
        // The catalog's `id.wrong` names the option ids ("That was stack, not cluster").
        feedbackText: {
          "id.wrong": "That was the stack in 3rds. Play both cards again: the cluster is the one that rubs.",
        },
        tests: [
          { name: "stack", response: { answer: { choice: ["stack"] } }, expect: "pass" },
          {
            name: "cluster",
            response: { answer: { choice: ["cluster"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Chords on the bass",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "chords-on-the-bass",
        version: 1,
        role: "practice",
        prompt:
          "Write the chords of your song's second part. Oak's bass plays degrees 1, 5, 6 and 4 there, one a bar: in the `chords` line, stack a triad on each bass note, in that order. Then give the chords a rhythm if you like. Done when the four bars play triads on 1, 5, 6 and 4.",
        skills: [{ skill: "C01", w: 1 }],
        // The catalog's text is "{label}: {detail}", and a progression's detail names the chords in Roman
        // numerals (U06.L02). The same text serves the suggestions, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "triads-on-the-bass",
            label: "The `chords` line plays triads on 1, 5, 6 and 4, in that order",
            required: true,
            skills: ["C01"],
            rule: "progression",
            rn: ["I", "V", "vi", "IV"],
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
            skills: ["C01"],
            rule: "range",
            track: "chords",
            within: ["c3", "c5"],
          },
        ],
        hints: ladder(
          "Bar 1 already has its triad, `[0,2,4]`. Bar 2's bass plays degree 5: start that bar's stack on degree 5's `n`.",
          "Bar 2's bass is degree 5, `n` 4: stack `[4,6,8]` there. Bars 3 and 4 sit on degrees 6 and 4.",
          "`<[0,2,4] [4,6,8] … …>`: two bars done. Stack on `n` 5 and on `n` 3 for the last two.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal: the four triads", response: { code: LOOP_ONLY }, expect: "pass" },
          {
            name: "beyond the brief: chords on beats 1 and 3, a tune, the room",
            response: {
              code: code(
                chords(
                  "<[[0,2,4] ~ [0,2,4] ~] [[4,6,8] ~ [4,6,8] ~] [[5,7,9] ~ [5,7,9] ~] [[3,5,7] ~ [3,5,7] ~]>",
                  ".room(.3)",
                ),
                mel(TUNE),
              ),
            },
            expect: "pass",
          },
          {
            name: "another song's chords: 1, 4, 5, 1",
            response: { code: code(chords("<[0,2,4] [3,5,7] [4,6,8] [0,2,4]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "every stack one degree too high",
            response: { code: code(chords("<[1,3,5] [5,7,9] [6,8,10] [4,6,8]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
