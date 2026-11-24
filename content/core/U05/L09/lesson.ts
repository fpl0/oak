// U05.L09 Chord Names. Taught directly after U05.L04 "Arpeggios" (contracts 1.6 split that lesson in two: the
// arpeggio stayed there, the names came here, so each lesson has one idea). A chord has a short name: the
// root's letter, then a sign for its quality (C, Cm, C°, C+; in Strudel's code `C Cm Co Caug`). The learner
// reads a row of names (a chart), plays a chord from its name and names a chord from its notes. What the
// learner has: triads stacked by hand (U05.L01), the four qualities by ear and by their 3rds (U05.L02–L03),
// the quality signs seen once in U05.L03's spelling quiz, `.arp()` (U05.L04). Not yet: `chord()` and
// `.voicing()` (U05.L08, behind the gate of U05.L07), which appear here only in a read-only preview;
// inversions and slash names (U05.L05, the next lesson); Roman numerals (U06.L02).
// Spec: content/specs/U05.md.
//
// How it is graded: a name is a `fact` with `normalize: "chord"`, so B°, Bo and Bdim are one answer; a chord
// played from its name is its pitch classes and its lowest note on the keyboard; the chart step compares the
// chords' pitch classes bar by bar (`pcset`, lowest note included). The Make's one required rule is
// `chord-qualities` `contains: ["min"]`: a chart with a minor name in it, stacked by hand.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 92;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** The loop of Stacking Thirds: C G Am F, a triad on each note of the Band's bass (1 5 6 4). */
const LOOP = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
/** A chord line of stacked degrees in C. */
const blocks = (stacks: string, extra = "") => `chords: n("${stacks}").scale("C3:major").s("piano")${extra}`;
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: the loop the learner has stacked since U05.L01, whose names this lesson gives. */
const HOOK = code(blocks(LOOP));
/** The predict step: A, C and E stacked by hand. */
const A_MINOR = code('chords: note("[a3,c4,e4]").s("piano")');

/**
 * The concept card (preview: `chord()` is U05.L08's). Each bar plays a stack written by hand, then, half a
 * bar later, the same chord by its name. The named chords come voiced by Strudel (five notes, not always
 * with the root lowest), with the same pitch classes as the hand-made stacks.
 */
const BY_NAME = code(
  'chords: note("<[[c4,e4,g4] ~] [[a3,c4,e4] ~] [[b3,d4,f4] ~] [[c4,e4,g#4] ~]>").s("piano")',
  'keys: chord("<[~ C] [~ Am] [~ Bo] [~ Caug]>").voicing().s("piano")',
);

/** The quiz: the stack on degree 7, B D F, on the treble staff. */
const NAME_IT = code('chords: note("[b3,d4,f4]").s("piano")');

/** The chart step: C, Am, Dm, G. The first chord is given; the other three are bare roots. */
const CHART_STARTER = code(blocks("<[0,2,4] ⟪[5] [1] [4]⟫>"));
const CHART_SOLUTION = code(blocks("<[0,2,4] [5,7,9] [1,3,5] [4,6,8]>"));
const chartTry = (stacks: string) => code(blocks(stacks));

/** The Make: two names of the chart are stacked (C and F), two bars wait as bare roots. */
const MAKE_STARTER = code(blocks("<[0,2,4] [3,5,7] ⟪[0] [0]⟫>"));
/** A tune for the rich Make sketch: chord notes on the beats it plays (E G | C A | A F | D B). */
const TUNE = "<[2 ~ 4 ~] [7 ~ 5 ~] [5 ~ 3 ~] [1 ~ -1 ~]>";

/** The Band's drums; the learner's chart decides the chords, so the Band's bass and chords stay out. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
/** The hook is the Band's own loop, so its bass plays too. */
const BAND = { band: "band.axis-4bar", tracks: ["drums", "bass"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;

export default defineLesson({
  id: "U05.L09",
  version: 4,
  title: "Chord Names",
  objective: "I can read a chord's name (C, Cm, C°, C+), play the chord it asks for and name a chord I see.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["N05"],
  practises: [],
  terms: [{ id: "term.chord-symbol", step: "S4" }],
  canDo: ["cd.read.chord-symbols"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Four chords, four names",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "four-chords-four-names",
        version: 1,
        role: "practice",
        prompt:
          "As each bar arrives, say its name under your breath: C, G, A minor, F. Listen for why one name needs an extra word.",
        skills: [{ skill: "N05", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four chords, one a bar. Listen hard to bar 3.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "A minor",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "a-minor",
        version: 1,
        role: "practice",
        prompt: "A page says A minor. Predict the three notes you will hear, and pick them.",
        skills: [{ skill: "N05", w: 1 }],
        hints: null,
        tests: [],
        code: A_MINOR,
        bars: 1,
        mode: "choose",
        choices: [
          { id: "a-c-e", label: "A, C and E" },
          { id: "a-c-sharp-e", label: "A, C♯ and E" },
          { id: "a-b-c", label: "A, B and C" },
        ],
        correct: ["a-c-e"],
      },
    },
    {
      id: "S3",
      kind: "concept",
      title: "Names on paper",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "note" },
      example: { id: "by-name", code: BY_NAME, bars: 4, preview: true },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Name the stack",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "name-the-stack",
        version: 1,
        role: "check",
        prompt:
          "A triad from the key of C plays and shows on the staff. Type its name: the root's letter, then the sign for its kind, as in Cm or C°. You can type ° as `o`.",
        skills: [{ skill: "N05", w: 1 }],
        hints: ladder(
          "Find the root first: the note the other two stack on in 3rds. Then measure the two 3rds above it.",
          "Count the half steps of each 3rd, from the bottom note up: 4 then 3 is major, 3 then 4 minor, 3 and 3 diminished, 4 and 4 augmented.",
          "B up to D is three half steps. Count D up to F the same way.",
        ),
        stimulus: { src: "code", code: NAME_IT, bars: 1, showCode: false, showStaff: true },
        answer: { ui: "text", normalize: "chord" },
        correct: { text: ["B°"] },
        spelling: "enharmonic",
        order: "sequence",
        srs: [
          { deck: "deck.chd.symbols", cards: ["fact.chord.Cm", "fact.chord.Cdim"], mode: "seed" },
          { family: "fam.chd.quality-triad", mode: "review-if-due" },
        ],
        tests: [
          { name: "B°", response: { answer: { text: ["B°"] } }, expect: "pass" },
          { name: "Bo, as in code", response: { answer: { text: ["Bo"] } }, expect: "pass" },
          { name: "Bdim", response: { answer: { text: ["Bdim"] } }, expect: "pass" },
          {
            name: "minor instead of diminished",
            response: { answer: { text: ["Bm"] } },
            expect: "fail",
            feedback: ["id.chord-quality"],
          },
          {
            name: "named after the middle note",
            response: { answer: { text: ["Dm"] } },
            expect: "fail",
            feedback: ["id.chord-root"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Play D minor",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS },
      exercise: {
        kind: "keyboard",
        id: "play-d-minor",
        version: 1,
        role: "check",
        prompt: "The page says Dm. Play D minor on the keyboard: three notes at once, with D as the lowest.",
        skills: [{ skill: "N05", w: 1 }],
        hints: ladder(
          "The letter D is the root and goes at the bottom. The m after it says which size the first 3rd is.",
          "A minor triad stacks a small 3rd, three half steps, then a large one, four half steps.",
          "D, then the key three half steps above it, then the one four half steps above that. All three are white keys.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        expect: { pcs: [2, 5, 9], bassPc: 2 },
        pitchMode: "octave-free",
        tests: [
          { name: "D F A", response: { answer: { midi: [50, 53, 57] } }, expect: "pass" },
          { name: "spread: D A F", response: { answer: { midi: [50, 57, 65] } }, expect: "pass" },
          {
            name: "D major: F♯ for F",
            response: { answer: { midi: [50, 54, 57] } },
            expect: "fail",
            feedback: ["kb.extra-note", "kb.missing-note"],
          },
          {
            name: "F at the bottom",
            response: { answer: { midi: [53, 57, 62] } },
            expect: "fail",
            feedback: ["kb.bass"],
          },
          {
            name: "only D and A",
            response: { answer: { midi: [50, 57] } },
            expect: "fail",
            feedback: ["kb.missing-note"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Play the chart",
      minutes: 1.5,
      graded: true,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-modify",
        id: "play-the-chart",
        version: 1,
        role: "check",
        prompt:
          "The chart reads C, Am, Dm, G, one chord a bar. Bar 1 is stacked for you; bars 2 to 4 hold only their roots. Add two notes to each of those stacks so the loop plays the chart. Done when every bar is a full triad on its root.",
        skills: [
          { skill: "N05", w: 0.6 },
          { skill: "C01", w: 0.4 },
        ],
        code: { starter: CHART_STARTER },
        reference: { solutions: [CHART_SOLUTION], bars: 4 },
        // A chord is its notes: the pitch classes at each onset and the lowest one.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        feedbackText: {
          "harmony.pcset":
            "Bar {bar}: your chord has {got}; the chart asks for {exp}. Stack from the root: skip a degree, twice.",
          "harmony.bass": "Bar {bar}: the lowest note is {got}; the chart's chord stands on {exp}.",
        },
        hints: ladder(
          "A name's letter is the root, and each bare number is already that root. Stack the other two notes on it the way bar 1 does.",
          "Each bare number is the root's `n`. Add the two notes above it: skip a degree, twice, as in bar 1.",
          "Bar 2 is A minor: `[5,7,9]`. In the key of C the stack on A comes out minor by itself. Do the same on 1 and on 4.",
        ),
        tests: [
          { name: "reference", response: { code: CHART_SOLUTION }, expect: "pass" },
          {
            name: "the same chords with the upper notes written first",
            response: { code: chartTry("<[0,2,4] [5,9,7] [1,5,3] [4,8,6]>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: chartTry("<[0,2,4] [5] [1] [4]>") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "steps instead of 3rds",
            response: { code: chartTry("<[0,2,4] [5,6,7] [1,2,3] [4,5,6]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "Dm and G swapped",
            response: { code: chartTry("<[0,2,4] [5,7,9] [4,6,8] [1,3,5]>") },
            expect: "fail",
            feedback: ["harmony.pcset"],
          },
          {
            name: "bar 1 changed as well",
            response: { code: chartTry("<[0,2,4,7] [5,7,9] [1,3,5] [4,6,8]>") },
            expect: "fail",
            feedback: ["code.edit-outside"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your own chart",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "note", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "your-own-chart",
        version: 1,
        role: "practice",
        prompt:
          "Your chart plays the half-time part of your song. Bars 1 and 2 are C and F. Replace the bare roots of bars 3 and 4 with stacks for two chords from Dm, Em, G and Am, at least one of them minor. Say the four names as the chart plays. Done when the chart has a minor chord.",
        skills: [{ skill: "N05", w: 1 }],
        // The catalog's text is "{label}: {detail}", and a chord rule's detail may name the chords in words
        // this lesson has not taught. The same text serves every rule, so it says only "not yet".
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "a-minor-name",
            label: "At least one minor chord in `chords`: a name with an m",
            required: true,
            skills: ["N05"],
            rule: "chord-qualities",
            track: "chords",
            contains: ["min"],
          },
          {
            id: "four-triads",
            label: "At least four full triads in `chords`",
            required: false,
            skills: ["C01"],
            rule: "chord-qualities",
            track: "chords",
            min: 4,
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
          "Three of the names to choose from are minor: Dm, Em and Am. Pick one and find the degree of C it stands on.",
          "Dm stands on degree 2, Em on 3, G on 5, Am on 6. A root's `n` is its degree minus 1; stack two more notes on it, skipping a degree each time.",
          "Try Am then G: `[5,7,9]` and `[4,6,8]` in place of the two bare roots.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: code(blocks("<[0,2,4] [3,5,7] [0] [0]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: C F Am G",
            response: { code: code(blocks("<[0,2,4] [3,5,7] [5,7,9] [4,6,8]>")) },
            expect: "pass",
          },
          {
            // Blocks, not `.arp()`: a chord rule reads the notes that start together (AUTHORING §17.6).
            name: "beyond the brief: C F Dm Em with the room, and a tune",
            response: {
              code: code(blocks("<[0,2,4] [3,5,7] [1,3,5] [2,4,6]>", ".gain(.7).room(.3)"), mel(TUNE)),
            },
            expect: "pass",
          },
          {
            name: "no minor name: C F G C",
            response: { code: code(blocks("<[0,2,4] [3,5,7] [4,6,8] [0,2,4]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
