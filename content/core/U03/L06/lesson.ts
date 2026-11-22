// U03.L06 Sharp Keys. Each major key needs the same sharps every time; musicians write them once, at the
// start of every line of the staff, in the fixed order F C G D A E B. What the learner has from U03.L01–L05:
// W W H W W W H, spelling G and D major in note names, degrees as `n`, a key as one word in `.scale()`.
// Not yet: flats in a key (U03.L07), the circle of fifths (U03.L07), syllables (U03.L08). Spec:
// content/specs/U03.md.
//
// Wave 3 shapes (AUTHORING §16): a key signature written in order (`mode: "key-signature"`,
// `order: "sequence"`) and U03's "Play from the page" step: a G-major tune on the staff only, its F♯ given
// by the key signature, answered in `n`.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
/** A line written in degrees over a major scale (G major unless said otherwise). */
const deg = (pattern: string, key = "G4:major", extra = "") =>
  `${TEMPO}mel: n("${pattern}").scale("${key}").s("piano")${extra}`;
/** A line in note names. */
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The hook: 1 3 5 7, then 1' 7-5 6, rest, in G. Over the vamp's G and C chords nothing clashes. */
const HOOK = deg("<[0 2 4 6] [7 [6 4] 5 ~]>");
/** G major from home to home: one black key, F♯ (degree 7). */
const G_SCALE = deg("0 .. 7");
/** D major from home to home, for the order of sharps: F♯ and C♯. */
const D_SCALE = deg("0 .. 7", "D4:major");
/**
 * S5, the page: 5 7 1' 5, then 6 5 3 held, in G (D5 F♯5 G5 D5 | E5 D5 B4). The F♯ sits on the top line,
 * where the key signature's sharp is: read without the signature it is an F.
 */
const PAGE = "<[4 6 7 4] [5 4 2@2]>";
/**
 * The Make's starter: G major in note names with one F left natural, on beat 4 of bar 1 (over the G chord,
 * so in the pop Band's triad the wrong note is wrong for the key without a half-step rub; the jazz-soul G6
 * has an E under it, and there the F sounds plainly sour, which is what the learner is asked to hear).
 */
const MAKE_START = mel("<[d5 b4 a4 f4] [g4 a4 b4 g4]>");

/** The Band plays in the lesson's key, G major. */
const BAND = { band: "band.two-chord-vamp" } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL_STAFF = { roll: true, staff: "treble", keyboard: false } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const STAFF_ONLY = { roll: false, staff: "treble", keyboard: false } as const;

export default defineLesson({
  id: "U03.L06",
  version: 3,
  title: "Sharp Keys",
  objective:
    "I can write the sharps of G, D and A major as a key signature, in order, and read a tune in G from the staff.",
  key: { tonic: "G", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["S04", "N03"],
  practises: [],
  terms: [{ id: "term.key-signature", step: "S4" }],
  canDo: ["cd.read.keysig"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A line in G",
      minutes: 0.5,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree", band: BAND },
      example: { id: "hook", code: HOOK, bars: 2 },
      exercise: {
        kind: "listen",
        id: "a-line-in-g",
        version: 1,
        role: "practice",
        prompt:
          "Find the sharp at the very start of the staff, on the top line. Then listen for the note that sits on that line in bar 1: where does it want to go next?",
        skills: [{ skill: "S04", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "A line in G. Keep an eye on the top line of the staff.", bars: 2 }],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Count the sharps",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "degree" },
      example: { id: "g-major", code: G_SCALE, bars: 1 },
      exercise: {
        kind: "run-investigate",
        id: "count-the-sharps",
        version: 1,
        role: "practice",
        prompt:
          "Run G major and watch the keyboard for the one note on a black key. Then spell D major in your head from D (whole, whole, half, whole, whole, whole, half) and count its sharps. Answer both questions below.",
        skills: [{ skill: "S04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not yet. Watch the keyboard: only one note of G major lands on a black key. For D major, spell it from D with the pattern and count the letters that need a sharp.",
        },
        hints: ladder(
          "Watch the keyboard as G major plays: exactly one note lands on a black key. Which one?",
          "From D: whole step to E, whole step to the next letter, then a half step. Which letters need a sharp to make the steps fit?",
          "D major begins D, E, F♯, G, A. Keep going to D and count every sharp.",
        ),
        code: { starter: G_SCALE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Pick the note of G major that is a black key.",
            options: [
              { id: "f-sharp", label: "F♯, degree 7" },
              { id: "c-sharp", label: "C♯, degree 4" },
              { id: "b-flat", label: "B♭, degree 3" },
            ],
            correct: ["f-sharp"],
          },
          { q: "number", prompt: "Type how many sharps D major has.", correct: 2 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["f-sharp"], number: 2 } }, expect: "pass" },
          {
            name: "C sharp in G",
            response: { answer: { choice: ["c-sharp"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "D major with one sharp",
            response: { answer: { choice: ["f-sharp"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "concept",
      title: "The order of sharps",
      minutes: 0.75,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree" },
      example: { id: "d-major", code: D_SCALE, bars: 1 },
    },
    {
      id: "S4",
      kind: "notate",
      title: "Write D major's sharps",
      minutes: 1,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "staff-write",
        id: "d-major-sharps",
        version: 1,
        role: "check",
        key: { tonic: "D", mode: "major" },
        prompt:
          "Write D major's sharps at the start of the staff, from the left, in the order musicians always use: F C G D A E B. Write only the sharps D major needs.",
        skills: [
          { skill: "N03", w: 0.6 },
          { skill: "S04", w: 0.4 },
        ],
        feedbackText: {
          "keysig.wrong":
            "Not yet: you wrote {got}. Spell D major from D with whole, whole, half: which two letters need a sharp?",
          // The catalog's count and type texts print the whole signature; on a first try the hints do that.
          "keysig.count":
            "You wrote {count}. Spell D major from D, whole, whole, half, whole, whole, whole, half: how many letters need a sharp?",
          "keysig.type": "D major is a sharp key: its signature has sharps only.",
        },
        hints: ladder(
          "Write only D major's sharps, in order. How many sharps does D major have, and which letters are they?",
          "Sharps are always written in the order F C G D A E B, as many as the key needs, from the left.",
          "The first sharp of every sharp key is F♯, on the top line. D major needs one more.",
        ),
        answer: {
          ui: "staff-input",
          mode: "key-signature",
          clef: "treble",
          bars: 1,
          palette: { durations: [], accidentals: true, ties: false, rests: false },
        },
        expect: { e: "key-signature", key: { tonic: "D", mode: "major" }, order: "sequence" },
        tests: [
          { name: "F# then C#", response: { answer: { text: ["F#", "C#"] } }, expect: "pass" },
          {
            name: "C# first",
            response: { answer: { text: ["C#", "F#"] } },
            expect: "fail",
            feedback: ["keysig.order"],
          },
          {
            name: "only F#",
            response: { answer: { text: ["F#"] } },
            expect: "fail",
            feedback: ["keysig.count"],
          },
          {
            name: "A major's three",
            response: { answer: { text: ["F#", "C#", "G#"] } },
            expect: "fail",
            feedback: ["keysig.count"],
          },
          {
            name: "G sharp for C sharp",
            response: { answer: { text: ["F#", "G#"] } },
            expect: "fail",
            feedback: ["keysig.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.5,
      graded: true,
      ui: { panels: STAFF_ONLY, staffLabels: "none" },
      example: { id: "the-page", code: deg(PAGE), bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "page-in-g",
        version: 1,
        role: "check",
        prompt:
          "Read the two bars on the staff and write them as degrees in `n`, in place of the zeros. Home is `g4`, `n` 0, on the second line: count one number per line or space up from it. Keep the `@2` on the last note.",
        skills: [
          { skill: "N03", w: 0.6 },
          { skill: "S02", w: 0.4 },
        ],
        code: { starter: `${TEMPO}mel: n("⟪<[0 0 0 0] [0 0 0@2]>⟫").scale("G4:major").s("piano")` },
        reference: { solutions: [deg(PAGE)], bars: 2 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        constraints: [{ c: "must-use", tool: "tb.n", feedback: "code.must-use" }],
        target: { audible: true },
        // In `n` over `G4:major` the F♯ comes from `.scale()`: a learner cannot forget the sharp here, only
        // misread a line or a space. The texts say how to count, not what the sharp does.
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: the page has degree {exp} here. Count up from `g4`, home, one number for each line and each space.",
          // A held note written as two (the half note in bar 2 played twice) reads "extra note 3" in the catalog.
          "melody.extra-note":
            "Bar {bar}, {beatLabel}: one note too many. The last note on the page is held for two beats: write it once, with `@2`.",
          "melody.missing-note":
            "Bar {bar}, {beatLabel}: a note is missing. The page has four notes in bar 1 and three in bar 2, the last one held.",
          "melody.index-shift":
            "Every note is one step {dir}. Home, `g4`, is `n` 0: count lines and spaces up from it starting at 0.",
        },
        hints: ladder(
          "Each note's `n` is how many lines and spaces it sits above home, `g4`. How far above `g4` does the first note sit?",
          "Count one step per line or space up from `g4`, the second line: that count is the `n`. Home, `g4`, is `n` 0.",
          "The first bar starts on the fourth line, `d5`: `n` 4. Its next note is on the top line, F♯ because of the sharp at the start.",
        ),
        srs: [{ family: "fam.not.read", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: deg(PAGE) }, expect: "pass" },
          {
            name: "the same notes, a little softer",
            response: { code: deg(PAGE, "G4:major", ".gain(.8)") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: `${TEMPO}mel: n("<[0 0 0 0] [0 0 0@2]>").scale("G4:major").s("piano")` },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "read in C: every F natural",
            response: { code: deg("<[8 10 11 8] [9 8 6@2]>", "C4:major") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "counted from 1, so every note a step high",
            response: { code: deg("<[5 7 8 5] [6 5 3@2]>") },
            expect: "fail",
            feedback: ["melody.index-shift"],
          },
          {
            name: "one line misread: the top line counted as the fourth",
            response: { code: deg("<[4 5 7 4] [5 4 2@2]>") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the held note played twice",
            response: { code: deg("<[4 6 7 4] [5 4 2 2]>") },
            expect: "fail",
            feedback: ["melody.extra-note"],
          },
          {
            name: "the notes, but in note names",
            response: { code: mel("<[d5 f#5 g5 d5] [e5 d5 b4@2]>") },
            expect: "fail",
            feedback: ["code.must-use"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "quiz",
      title: "Sharps in A",
      minutes: 0.75,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "fact",
        id: "sharps-in-a",
        version: 1,
        role: "check",
        key: { tonic: "A", mode: "major" },
        prompt: "Type how many sharps A major has, as a number.",
        skills: [{ skill: "S04", w: 1 }],
        feedbackText: {
          "id.wrong":
            "Not {got}. G has one sharp and D two; each new sharp key adds the next sharp in the order.",
        },
        hints: ladder(
          "Count from the keys you know: how many sharps do G major and D major have?",
          "Sharp keys add one sharp at a time, in the order F C G D A E B: G has F♯, D adds C♯.",
          "D major has F♯ and C♯. A major keeps both and adds the next one in the order.",
        ),
        // A number, not free text: as text only the exact string "3#" passed, and "3", "3♯" or "3 sharps"
        // (all right) were marked wrong.
        answer: { ui: "number" },
        correct: { number: 3 },
        spelling: "strict",
        order: "sequence",
        srs: [
          { deck: "deck.key.signature", cards: ["fact.keysig.G-major", "fact.keysig.D-major"], mode: "seed" },
        ],
        tests: [
          { name: "3", response: { answer: { number: 3 } }, expect: "pass" },
          {
            name: "D major's count",
            response: { answer: { number: 2 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
          {
            name: "one too many",
            response: { answer: { number: 4 } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Every F sharp",
      minutes: 2.5,
      ui: { panels: ROLL_STAFF, rollLabels: "degree", staffLabels: "degree", band: BAND },
      exercise: {
        kind: "code-make",
        id: "every-f-sharp",
        version: 1,
        role: "practice",
        prompt:
          "Fix the one F in the starter that is missing its sharp: in G major every `f` is `f#`. Then change the notes and rhythm until the line is yours, still in note names. Done when every note is in G major.",
        skills: [
          { skill: "S04", w: 0.6 },
          { skill: "N03", w: 0.4 },
        ],
        code: { starter: MAKE_START },
        bars: [1, 4],
        saveAs: "sketch",
        // The catalog's degree-set detail reads "7 appears fewer than 1×": the label says it in words.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        rubric: [
          {
            id: "in-g",
            label: "Every note of the line is in G major: every F is `f#`, and no other sharps or flats",
            required: true,
            skills: ["S04"],
            rule: "in-key",
            key: { tonic: "G", mode: "major" },
            minRatio: 1,
            tracks: ["@melody"],
          },
          {
            id: "ends-home",
            label: "The line's last note is a `g`, home",
            required: false,
            skills: ["S02"],
            rule: "ends-on-degree",
            track: "@melody",
            degrees: ["1"],
          },
          {
            id: "uses-f-sharp",
            label: "The line plays F♯ (`f#`), degree 7, at least once",
            required: false,
            skills: ["S04"],
            rule: "degree-set",
            track: "@melody",
            contains: ["7"],
          },
        ],
        hints: ladder(
          "Every note must be in G major. Which letter carries the sharp in G major's key signature?",
          "Every F in G major is F♯: in code, `f#4` or `f#5`. Look for an F without its sharp.",
          "Look at the last note of bar 1: keep its letter and octave, and give it the key's sharp.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_START },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: mel("<[d5 b4 a4 f#4] [g4 a4 b4 g4]>") }, expect: "pass" },
          {
            name: "beyond the brief: hats, a run up to home, a held ending",
            response: {
              code: `${TEMPO}hats: s("hh*8").gain(.35)\nmel: note("<[g4 b4 d5 [e5 f#5]] [g5 d5 b4 ~] [a4 b4 e5 d5] [b4 a4 g4@2]>").s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "the F sharp fixed, an F natural added in bar 2",
            response: { code: mel("<[d5 b4 a4 f#4] [g4 a4 f4 g4]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
