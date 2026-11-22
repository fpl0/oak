// U06.L11 Slash Chords & Walking Down. The bass decides which way up a chord stands: under C G Am the bass
// can walk down C B A, and the middle chord becomes G with its 3rd, B, at the bottom (G/B, V⁶). A bass held
// while the chords above it change is a pedal; one voice sliding down by half steps under a held chord
// (C, C/B, C/B♭, F/A) is a line cliché. What the learner has: inversions and slash chords as names (U05.L05),
// the bass clef and the grand staff (U05.L06), `chord()` and `.voicing()` (U05.L08), Roman numerals
// (U06.L02), the bass heard first (U06.L05). Not yet: `.struct()` (U06.L12), whole bass lines (U08).
// Spec: content/specs/U06.md.
//
// Slash chords are never written inside `chord()` (`chord("C/E")` is a lint error, STYLE §5.3): the chords
// are symbols, and the `bass:` track decides the inversion. So every check reads the chords together with
// the bass: `pcset` per onset with `bass: true` over both tracks, `rn-palette` with `allow: ["inversions"]`
// (V⁶ against V is graded by the bass), and the Make's `chord-inversions` rule, which reads the lowest note
// across all of the learner's tracks. `.mode("root:g3")` unlocks here and is heard once, in S3, as the
// contrast: every root at the bottom, the bass leaping.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 76;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** Chord symbols, voiced by `.voicing()` (the default dictionary keeps every voice above the bass here). */
const chordLine = (symbols: string, sound = "piano", extra = "") =>
  `chords: chord("${symbols}").voicing().s("${sound}")${extra}`;
/** A bass line in note names, as a bass player reads it. */
const bassLine = (notes: string) => `bass: note("${notes}").s("ebass").lpf(600)`;
/** A melody line in degrees. */
const mel = (pattern: string) => `mel: n("${pattern}").scale("C4:major").s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: C G/B Am Am/G F C/E Dm G over a bass that walks down by step from C3 to D2, then G2. */
const HOOK_CHORDS = "<C G Am Am F C Dm G>";
const HOOK_BASS = "<c3 b2 a2 g2 f2 e2 d2 g2>";
const HOOK = code(chordLine(HOOK_CHORDS), bassLine(HOOK_BASS));

/** The first four bars: C, G/B, Am, Am/G. */
const FOUR = "<C G Am Am>";
const WALK = "<c3 b2 a2 g2>";
const FOUR_BARS = code(chordLine(FOUR), bassLine(WALK));
/**
 * The contrast of S3: the same chords in root position (`.mode("root:g3")`), no bass track: C3, G3, A2, A2.
 * (Integration: `root:g2` put Am at A1 C2 E2, a close chord far too low to hear as one.)
 */
const ROOTS_LOW = code(`chords: chord("${FOUR}").mode("root:g3").voicing().s("piano")`);

/** S2: two bars, C then G over B. */
const PREDICT = code(chordLine("<C G>"), bassLine("<c3 b2>"));

/** S4, the page: the bass part alone, on the bass staff. The chords play from the given code. */
const PAGE = code(bassLine(WALK));
/** The starter's bass plays every root (C G A A); the learner writes the walk from the page. */
const ROOTS = "<c3 g2 a2 a2>";
const PAGE_STARTER = code(chordLine(FOUR), `bass: note("⟪${ROOTS}⟫").s("ebass").lpf(600)`);
const pageAnswer = (notes: string) => code(chordLine(FOUR), bassLine(notes));

/** S5: the walk's first three bars, I V⁶ vi. */
const NUMBER_IT = code(chordLine("<C G Am>"), bassLine("<c3 b2 a2>"));

/** S6: C F G C over a bass that follows the roots, and over a bass that holds C. */
const MOVING = code(chordLine("<C F G C>"), bassLine("<c3 f2 g2 c3>"));
const HELD = code(chordLine("<C F G C>"), bassLine("<c3 c3 c3 c3>"));

/** S7: C held above a bass that slides down by half steps, C B B♭, then F over A. */
const CLICHE = code(
  'chords: note("<[e3,g3,c4] [e3,g3,c4] [e3,g3,c4] [f3,a3,c4]>").s("piano")',
  bassLine("<c3 b2 bb2 a2>"),
);

/** The Make starts with root-position chords: the bass plays every root. */
const MAKE_CHORDS = "<C G Am F>";
const MAKE_STARTER = code(chordLine(MAKE_CHORDS), bassLine("<c3 g2 a2 f2>"));

/** Drums only from the Band: the learner's chords and bass set the harmony. */
const DRUMS = { band: "band.axis-4bar", tracks: ["drums"] } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const GRAND = { roll: false, staff: "grand", keyboard: false } as const;
const ROLL_GRAND = { roll: true, staff: "grand", keyboard: false } as const;
/** "Play from the page": the bass staff alone, no code view of the target, no roll, no keys. */
const BASS_STAFF = { roll: false, staff: "bass", keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "U06.L11",
  version: 3,
  title: "Slash Chords & Walking Down",
  objective:
    "I can walk a bass down by step under a chord loop, so that some chords stand on their 3rd or 5th (C G/B Am).",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["H15"],
  practises: ["C04"],
  terms: [
    { id: "term.pedal", step: "S6" },
    { id: "term.line-cliche", step: "S7" },
  ],
  canDo: ["cd.compose.walking-down"],
  wrapAt: "S5",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Walking down",
      minutes: 0.5,
      ui: { panels: GRAND, staffLabels: "none", band: DRUMS },
      example: { id: "hook", code: HOOK, bars: 8 },
      exercise: {
        kind: "listen",
        id: "walking-down",
        version: 1,
        role: "practice",
        prompt:
          "Follow the bass on the lower staff, bar by bar. Listen for whether it leaps from root to root or moves another way, and what that does to the ballad.",
        skills: [{ skill: "H15", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "A slow ballad, eight bars. Keep your ear on the bottom.", bars: 8 }],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Which chord now?",
      minutes: 0.5,
      ui: { panels: NONE },
      example: { id: "c-then-g", code: PREDICT, bars: 2 },
      exercise: {
        kind: "predict",
        id: "which-chord-now",
        version: 1,
        role: "practice",
        prompt:
          'The chords are `chord("<C G>")`; the bass plays `c3`, then `b2`. Predict what the second bar sounds like, and pick it.',
        skills: [{ skill: "C04", w: 1 }],
        hints: null,
        tests: [],
        code: PREDICT,
        bars: 2,
        mode: "choose",
        choices: [
          { id: "g-over-b", label: "A G chord with B, its 3rd, at the bottom" },
          { id: "b-minor", label: "A B minor chord" },
          { id: "c-again", label: "The C chord again" },
        ],
        correct: ["g-over-b"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Step or leap",
      minutes: 1,
      ui: { panels: ROLL_GRAND, rollLabels: "degree", staffLabels: "none" },
      example: { id: "roots-low", code: ROOTS_LOW, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "step-or-leap",
        version: 1,
        role: "practice",
        prompt:
          "Run the hook's first four bars in the editor. Watch the bass on the lower staff and on the roll, bar by bar, then answer both questions below.",
        skills: [
          { skill: "H15", w: 0.6 },
          { skill: "C04", w: 0.4 },
        ],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Count the keys from C down to B on the keyboard, and look for the bar whose bass is G.",
        },
        hints: ladder(
          "Count how far the bass moves from bar 1 to bar 2 on the keyboard: a step or a leap.",
          "B and C have no black key between them. In which bar does the bass play G under an A minor chord?",
          "From C down to B is one key. Bars 3 and 4 are both Am; only their bass differs.",
        ),
        code: { starter: FOUR_BARS },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many half steps does the bass move from bar 1 (C) to bar 2 (B)?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "Which bar is Am with G at the bottom?",
            options: [
              { id: "bar-2", label: "Bar 2" },
              { id: "bar-3", label: "Bar 3" },
              { id: "bar-4", label: "Bar 4" },
            ],
            correct: ["bar-4"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 1, choice: ["bar-4"] } },
            expect: "pass",
          },
          {
            name: "a whole step",
            response: { answer: { number: 2, choice: ["bar-4"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the bar with A at the bottom",
            response: { answer: { number: 1, choice: ["bar-3"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.25,
      graded: true,
      ui: { panels: BASS_STAFF, staffLabels: "none", band: DRUMS },
      example: { id: "the-page", code: PAGE, bars: 4 },
      exercise: {
        kind: "code-modify",
        id: "walk-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "The bass staff shows the bass part for the chords C, G, Am, Am, one note a bar. The `bass` line in the code plays every root. Replace its notes with the part from the page, letter and number. Done when each bar's lowest note matches the page.",
        skills: [
          { skill: "H15", w: 0.6 },
          { skill: "C04", w: 0.4 },
        ],
        code: { starter: PAGE_STARTER },
        reference: { solutions: [pageAnswer(WALK)], bars: 4 },
        // The chords and the bass are read together: the pitch classes at each onset and the lowest note.
        matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords", "bass"] },
        constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
        target: { audible: true },
        srs: [{ family: "fam.har.bass", mode: "review-if-due" }],
        feedbackText: {
          "harmony.bass":
            "Bar {bar}: the lowest note is {got}; the page shows {exp}. Read the note on the bass staff, and keep it under the chords.",
        },
        hints: ladder(
          "Look at the bass on the page: it moves one line or space at a time, not from root to root.",
          "The first note sits in the second space from the bottom: `c3`. Each note after it is one line or space lower.",
          "Bar 1 is `c3` and bar 3 is `a2`. Read bars 2 and 4 from the page.",
        ),
        tests: [
          { name: "reference", response: { code: pageAnswer(WALK) }, expect: "pass" },
          {
            name: "the same walk an octave lower",
            response: { code: pageAnswer("<c2 b1 a1 g1>") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: pageAnswer(ROOTS) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "B written above the chords",
            response: { code: pageAnswer("<c3 b3 a2 g2>") },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
          {
            name: "G under the second chord: its root",
            response: { code: pageAnswer("<c3 g2 a2 g2>") },
            expect: "fail",
            feedback: ["harmony.bass"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "quiz",
      title: "Number the walk",
      minutes: 1,
      graded: true,
      ui: { panels: GRAND, staffLabels: "none" },
      exercise: {
        kind: "identify",
        id: "number-the-walk",
        version: 1,
        role: "check",
        prompt:
          "Enter the Roman numeral of each of the three chords, one a bar. Where the bass is not the root, add the figure: 6 when the 3rd is at the bottom, 64 when the 5th is.",
        skills: [
          { skill: "C04", w: 0.6 },
          { skill: "N06", w: 0.4 },
        ],
        hints: ladder(
          "For each bar, name the chord first, then the note the bass plays under it.",
          "Find each chord's degree for the numeral. Then compare the bass with the chord's own notes: root, 3rd or 5th.",
          "Bar 1 is I with C at the bottom. Bar 2 is G with B in the bass: which member of the chord is B?",
        ),
        stimulus: { src: "code", code: NUMBER_IT, bars: 3, showCode: true, showStaff: true },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: { ui: "rn-palette", slots: 3, allow: ["triads", "inversions"] },
        correct: { rn: ["I", "V6", "vi"] },
        srs: [{ family: "fam.chd.inversion", mode: "review-if-due" }],
        // The catalog's `id.wrong` says "Listen to both", which fits audio cards, not a reading item.
        feedbackText: {
          "id.wrong":
            "Bar {slot}: not {got}. Name the chord by its root's degree, then check which of its notes the bass plays.",
        },
        tests: [
          { name: "I V6 vi", response: { answer: { rn: ["I", "V6", "vi"] } }, expect: "pass" },
          {
            name: "V without its figure",
            response: { answer: { rn: ["I", "V", "vi"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "the bass note read as the root: vii°",
            response: { answer: { rn: ["I", "vii°", "vi"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "vi in capitals",
            response: { answer: { rn: ["I", "V6", "VI"] } },
            expect: "fail",
            feedback: ["harmony.rn-case"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "compare",
      title: "The bass that stays",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "identify",
        id: "the-bass-that-stays",
        version: 1,
        role: "practice",
        prompt:
          "Both cards play the chords C, F, G, C, each with a different bass part. Pick the card whose bass stays on one note.",
        skills: [{ skill: "H15", w: 1 }],
        hints: ladder(
          "Listen only to the lowest sound, and notice whether it moves when the chords change.",
          "In one card the bass follows each chord's root; in the other it keeps playing C.",
          "Play each card and hum its bass. Which one could you hum on a single note?",
        ),
        stimulus: { src: "code", code: HELD, bars: 4, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "moving", label: "Card A", audio: MOVING },
            { id: "held", label: "Card B", audio: HELD },
          ],
        },
        correct: { choice: ["held"] },
        // The catalog's `id.wrong` names the option ids ("That was held, not moving").
        feedbackText: {
          "id.wrong":
            "That one follows the roots: C, F, G, C. Play both again; in the other, the bass plays C all the way through.",
        },
        tests: [
          { name: "held", response: { answer: { choice: ["held"] } }, expect: "pass" },
          {
            name: "moving",
            response: { answer: { choice: ["moving"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "investigate",
      title: "Half steps down",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "degree" },
      example: { id: "half-steps-down", code: CLICHE, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "half-steps-down",
        version: 1,
        role: "practice",
        prompt:
          "Run it. The bass slides down from C while the chord above it waits. Read the bass on the roll, bar by bar, then answer both questions below.",
        skills: [{ skill: "H15", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Compare bars 1 to 3 on the roll: one line moves, and the notes above it do not.",
        },
        hints: ladder(
          "Count the keys the bass moves each time: from C to B, then from B to B♭.",
          "A half step is the very next key, black or white. Then look at the three notes above the bass in bars 1 to 3.",
          "C to B is one half step. In bars 1 to 3 the notes above the bass never change: which are they?",
        ),
        code: { starter: CLICHE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "How many half steps does the bass move each time, from C to B to B♭ to A?",
            correct: 1,
          },
          {
            q: "choice",
            prompt: "What holds still above the bass in bars 1 to 3?",
            options: [
              { id: "c-chord", label: "The C chord: E, G and C" },
              { id: "nothing", label: "Nothing: every note moves with the bass" },
              { id: "top-only", label: "Only the top C" },
            ],
            correct: ["c-chord"],
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { number: 1, choice: ["c-chord"] } },
            expect: "pass",
          },
          {
            name: "whole steps",
            response: { answer: { number: 2, choice: ["c-chord"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "everything moves",
            response: { answer: { number: 1, choice: ["nothing"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S8",
      kind: "make",
      title: "Walk it down",
      minutes: 2.75,
      ui: { panels: ROLL_GRAND, rollLabels: "degree", staffLabels: "none", band: DRUMS },
      exercise: {
        kind: "code-make",
        id: "walk-it-down",
        version: 1,
        role: "practice",
        prompt:
          "The `bass` line plays every root: C, G, A, F. Make it walk down by step instead, C, B, A, so at least one chord stands on its 3rd or 5th. Change the chords too if you like. Done when at least one chord has its 3rd or 5th in the bass.",
        skills: [
          { skill: "H15", w: 0.6 },
          { skill: "C04", w: 0.4 },
        ],
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "one-inversion",
            label: "At least one chord with its 3rd or 5th as the lowest note",
            required: true,
            skills: ["C04"],
            rule: "chord-inversions",
            track: "chords",
            min: 1,
          },
          {
            id: "by-step",
            label: "Most moves in `bass` are steps, at least three in four",
            required: false,
            skills: ["H15"],
            rule: "step-ratio",
            track: "bass",
            min: 0.75,
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
          "Between C and A the bass needs one note to step instead of leap. Find it, and check it belongs to the G chord.",
          "A bass note that is the chord's 3rd or 5th turns it into a slash chord. G's 3rd is B; F's 3rd is A.",
          "Bars 1 and 3 can keep C and A. Bar 2 needs the note between them, which belongs to the G chord.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: B under the G chord",
            response: { code: code(chordLine(MAKE_CHORDS), bassLine("<c3 b2 a2 f2>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: the eight-bar walk on the Rhodes, a tune",
            response: {
              code: code(
                chordLine(HOOK_CHORDS, "rhodes", ".gain(.7)"),
                bassLine(HOOK_BASS),
                mel("<[4 ~ 2 ~] [4 ~ 1 ~] [2 ~ 0 ~] [0 ~ ~ ~] [5 ~ 3 ~] [4 ~ 2 ~] [3 ~ 1 ~] [1 ~ ~ ~]>"),
              ),
            },
            expect: "pass",
          },
          {
            name: "a new bass that still plays only roots",
            response: { code: code(chordLine("<C G Am G>"), bassLine("<c3 g2 a2 g2>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
