// U02.L04 The Treble Staff. Pitch drawn as height: five lines and four spaces from e4 to f5, the treble
// clef fixing g4 on the second line, ledger lines for notes beyond (c4 below). Staff ↔ code ↔ keys; never
// all three panels at once. Every staff example is whole beats (quarters and halves): it engraves exactly.
// Spec: content/specs/U02.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 80;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band carries drums, bass and chords; the learner writes the line on top. */
const BAND = { band: "band.two-chord-vamp" } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;
const STAFF_KEYS = { roll: false, staff: "treble", keyboard: true } as const;
/** "Play from the page": the staff alone, no code view of the target, no roll, no keys. */
const STAFF_ONLY = { roll: false, staff: "treble", keyboard: false } as const;

/** The hook: a slow line that climbs the lines e4 g4 b4 d5. */
const HOOK = mel("e4 g4 b4 d5");
/** S4: three notes to name, one of them on a ledger line below. */
const READ_ME = mel("g4 e4 c4 ~");
/** S6: the line the page shows. Lines and spaces alternate: e4 line, g4 line, f4 space, a4 space. */
const PAGE = "e4 g4 f4 a4";

/** Before U03.L02 feedback names places and letters, never degrees or solfège. */
const NOTE_FEEDBACK = {
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than the page shows. Check the number after the letter.",
  "melody.wrong-degree":
    "Bar {bar}, {beatLabel}: a different note from the one on the page. Is it on a line or in a space?",
  "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here. The page shows four.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here. The page shows four.",
} as const;

export default defineLesson({
  id: "U02.L04",
  version: 4,
  title: "The Treble Staff",
  objective: "I can read and write notes from c4 to f5 on the treble staff and play them in code.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["N02"],
  practises: [],
  terms: [
    { id: "term.staff", step: "S3" },
    { id: "term.treble-clef", step: "S3" },
    { id: "term.ledger-line", step: "S4" },
  ],
  canDo: ["cd.read.treble"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "A slow climb",
      minutes: 0.5,
      ui: { panels: KEYS, band: BAND },
      example: { id: "hook", code: HOOK, bars: 1 },
      exercise: {
        kind: "listen",
        id: "slow-climb",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the four-note climb and watch the keys. Count how many white keys each note skips over on its way up.",
        skills: [{ skill: "N02", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Four white keys, one beat each, going up.", bars: 1 }],
      },
    },
    {
      id: "S2",
      kind: "see",
      title: "Written down",
      minutes: 0.5,
      ui: { panels: STAFF_KEYS },
      example: { id: "climb-on-paper", code: HOOK, bars: 1 },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Lines and heights",
      minutes: 1,
      ui: { panels: STAFF_KEYS },
      exercise: {
        kind: "run-investigate",
        id: "lines-and-heights",
        version: 1,
        role: "practice",
        prompt:
          "Change the letter or the number of one note, listen, and watch where it moves on the five lines. Then click the note that sits on the second line from the bottom.",
        skills: [{ skill: "N02", w: 1 }],
        feedbackText: {
          "investigate.not-here": "Not that one. The bottom line holds `e4`; count up one line from it.",
        },
        hints: ladder(
          "Count the five lines from the bottom up and find the note on line 2. Which note sits on line 1?",
          "The bottom line holds `e4`. Count up one line from it.",
          "The notes climb one line at a time: the first is on line 1, the next on line 2.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "click-staff",
            prompt: "Click the note on the second line from the bottom.",
            target: { track: "mel", beat: 2 },
          },
        ],
        tests: [
          // `${TEMPO}mel: note("e4 ` is 28 characters: the g4 sits at 28–30, the e4 at 25–27, the b4 at 31–33.
          { name: "the g4", response: { click: { from: 28, to: 30 } }, expect: "pass" },
          {
            name: "the bottom line",
            response: { click: { from: 25, to: 27 } },
            expect: "fail",
            feedback: ["investigate.not-here"],
          },
          {
            name: "the third line",
            response: { click: { from: 31, to: 33 } },
            expect: "fail",
            feedback: ["investigate.not-here"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "quiz",
      title: "Name three notes",
      minutes: 1,
      graded: true,
      ui: { panels: STAFF_ONLY },
      example: { id: "three-to-name", code: READ_ME, bars: 1 },
      exercise: {
        kind: "staff-read",
        id: "name-three-notes",
        version: 1,
        role: "check",
        prompt:
          "Name the three notes on the staff, left to right: one letter each, no numbers. The last note sits below the five lines, on a short line of its own.",
        skills: [{ skill: "N02", w: 1 }],
        feedbackText: {
          "spell.wrong":
            "Not {got}. Is that note on a line or in a space? Count up from the bottom line, `e4`.",
        },
        hints: ladder(
          "Start from a line you know: the clef curls around the second line from the bottom. Which note does that line hold?",
          "The second line from the bottom is `g4` and the bottom line is `e4`. Below the bottom line, count on: space, then the short line.",
          "The first note is on the second line: g. The second is on the bottom line.",
        ),
        source: READ_ME,
        bars: 1,
        answer: { ui: "text", normalize: "note" },
        correct: { text: ["g", "e", "c"] },
        srs: [
          {
            deck: "deck.pit.staff-names",
            cards: ["fact.staff.treble.E4", "fact.staff.treble.G4"],
            mode: "seed",
          },
        ],
        tests: [
          { name: "g e c", response: { answer: { text: ["g", "e", "c"] } }, expect: "pass" },
          { name: "capital letters", response: { answer: { text: ["G", "E", "C"] } }, expect: "pass" },
          {
            name: "each read as the space above",
            response: { answer: { text: ["a", "f", "d"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "missed the short line",
            response: { answer: { text: ["g", "e", "d"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "notate",
      title: "Write it down",
      minutes: 1.25,
      graded: true,
      ui: { panels: STAFF_KEYS },
      exercise: {
        kind: "staff-write",
        id: "write-c-e-g-c",
        version: 1,
        role: "check",
        prompt: "Write `c4`, `e4`, `g4` and `c5` on the staff, in that order, one note per beat.",
        skills: [{ skill: "N02", w: 1 }],
        feedbackText: {
          "spell.wrong": "{got} → {exp}. Count lines and spaces up from the bottom line, `e4`.",
        },
        hints: ladder(
          "Place the four notes left to right, starting with `c4`. Does `c4` sit on the five lines, or below them?",
          "`c4` sits on a ledger line below the staff; `e4` is the bottom line and `g4` the second.",
          "`c5` is in the third space from the bottom, between `b4` and `d5`.",
        ),
        answer: {
          ui: "staff-input",
          clef: "treble",
          bars: 1,
          palette: { durations: ["4"], accidentals: false, ties: false, rests: false },
        },
        expect: { e: "pitches", spelled: ["C4", "E4", "G4", "C5"], order: "sequence", withOctave: true },
        tests: [
          { name: "right", response: { staff: "C4:4 E4:4 G4:4 C5:4" }, expect: "pass" },
          {
            name: "e4 one space too high",
            response: { staff: "C4:4 F4:4 G4:4 C5:4" },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "the last note missing",
            response: { staff: "C4:4 E4:4 G4:4" },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "c5 written as c4",
            response: { staff: "C4:4 E4:4 G4:4 C4:4" },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Play from the page",
      minutes: 1.5,
      graded: true,
      ui: { panels: STAFF_ONLY },
      example: { id: "the-page", code: mel(PAGE), bars: 1 },
      exercise: {
        kind: "code-modify",
        id: "play-from-the-page",
        version: 1,
        role: "check",
        prompt:
          "Read the four notes on the staff and write them in code in place of the four `c4`s, left to right, each with its letter and number. Done when your line matches the staff.",
        skills: [{ skill: "N02", w: 1 }],
        code: { starter: mel("⟪c4 c4 c4 c4⟫") },
        reference: { solutions: [mel(PAGE)], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        target: { audible: true },
        feedbackText: NOTE_FEEDBACK,
        hints: ladder(
          "Read each note up from the bottom line, `e4`: lines and spaces alternate. Which of the four notes sit on lines, and which in spaces?",
          "The bottom line is `e4` and the second line `g4`. The space between them is `f4`.",
          "The first two notes are `e4 g4`. Read the other two the same way.",
        ),
        tests: [
          { name: "reference", response: { code: mel(PAGE) }, expect: "pass" },
          { name: "same notes, a little softer", response: { code: mel(PAGE, ".gain(.8)") }, expect: "pass" },
          {
            name: "unchanged",
            response: { code: mel("c4 c4 c4 c4") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the bottom line read as the space above",
            response: { code: mel("f4 g4 f4 a4") },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "right letters, an octave up",
            response: { code: mel("e5 g5 f5 a5") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Stay on the lines",
      minutes: 2.5,
      ui: { panels: STAFF_KEYS, band: BAND },
      exercise: {
        kind: "code-make",
        id: "on-the-staff",
        version: 1,
        role: "practice",
        prompt:
          "Write a melody on the `mel:` line for the first loud part of your song, and keep it on the staff: every note from `e4`, the bottom line, to `f5`, the top line, so no ledger lines. Done when no note is below `e4` or above `f5`.",
        skills: [{ skill: "N02", w: 1 }],
        code: { starter: mel("c4 e4 g4 c5") },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "on-the-staff",
            label: "Every note from `e4` to `f5`, both included: no ledger lines",
            required: true,
            skills: ["N02"],
            rule: "range",
            track: "@melody",
            within: ["e4", "f5"],
          },
          {
            id: "five-notes",
            label: "Five or more different notes",
            required: false,
            skills: ["P02"],
            rule: "distinct-pitches",
            track: "@melody",
            min: 5,
          },
          {
            id: "long-note",
            label: "Uses `@` to hold a note longer, such as `c5@2`",
            required: false,
            skills: ["N02"],
            rule: "uses",
            tool: "tb.mini.elongate",
          },
        ],
        hints: ladder(
          "Every note must sit between the bottom line, `e4`, and the top line, `f5`. Which note of the starter falls outside?",
          "`c4` sits on a ledger line below the staff. The lowest line note is `e4`.",
          "Swap `c4` for `e4` and the line is on the staff. Then add notes of your own.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: mel("c4 e4 g4 c5") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          { name: "minimal", response: { code: mel("e4 g4 c5 g4") }, expect: "pass" },
          {
            name: "beyond the brief",
            response: { code: mel("<[e4 g4 c5@2] [f4 a4 c5 a4] [g4 e4 d5 c5] [b4 d5 c5@2]>") },
            expect: "pass",
          },
          {
            name: "one note above the top line",
            response: { code: mel("<[e4 g4 c5 g4] [f4 a4 c5 a5]>") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
