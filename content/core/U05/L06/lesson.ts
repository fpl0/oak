// U05.L06 Bass Clef & Grand Staff. Low notes have their own staff: the bass clef, whose two dots sit either
// side of the line for F3 (lines from the bottom G2 B2 D3 F3 A3). A treble and a bass staff braced together
// are the grand staff, with middle C on a short line between them; a `bass:` track reads on the lower staff,
// everything else on the upper one, the way a pianist reads the left hand under the right. What the learner
// has: the treble staff and ledger lines (U02.L04), note names with octaves (U02), triads stacked in `n`
// (U05.L01), chord names and inversions (U05.L04–L05), `ebass` and `.lpf()` (C1). Not yet: voice leading
// (U05.L07), `chord()` and `.voicing()` (U05.L08). Spec: content/specs/U05.md.
//
// The chords of the hook sit an octave higher than U05.L01's (C4, not C3), so that on the grand staff they
// read on the treble staff with middle C on its ledger line, and the bass alone fills the bass staff.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 88;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;
/** A bass line in degrees of C, from C2. */
const bassN = (pattern: string) => `bass: n("${pattern}").scale("C2:major").s("upright").lpf(800)`;
/** A bass line in note names, as the page shows it. */
const bassNotes = (notes: string, sound = "upright", extra = "") =>
  `bass: note("${notes}").s("${sound}").lpf(800)${extra}`;
/** The four-chord loop as stacked triads, on the treble staff of a grand staff. */
const chords = (pattern: string) => `chords: n("${pattern}").scale("C4:major").s("piano").gain(.6)`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/**
 * The bass plays each chord's root on beats 1 and 3 and its 5th on beat 4: C2 C2 G2 | G2 G2 D2 | A2 A2 E2 |
 * F2 F2 C2. Its first note, C2, sits on the second ledger line below the bass staff.
 */
const WALK = "<[0 ~ 0 4] [4 ~ 4 1] [5 ~ 5 2] [3 ~ 3 0]>";
/** The triads on 1, 5, 6 and 4 (U05.L01's loop): C E G, G B D, A C E, F A C. */
const LOOP = "<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>";
const HOOK = code(bassN(WALK), chords(LOOP));
const BASS_ALONE = code(bassN(WALK));

/** S3: the four lowest lines of the bass staff, bottom up. */
const LINES = code(bassNotes("g2 b2 d3 f3"));

/** S4, the page: up the C triad, then up the F triad, two ledger lines to the third line. */
const PAGE = "<[c2 e2 g2 e2] [f2 a2 c3 a2]>";
const PAGE_STARTER = "<[c2 c2 c2 c2] [c2 c2 c2 c2]>";

/**
 * The Make's starter: roots and 5ths under the four-chord loop, an octave too high (C3–A3), in the Band's
 * chords' own register. Learner review: under the two-chord vamp the Make ended on two bars of C and F; under
 * the four-chord loop the same task ends on a groove like the hook's.
 */
const MAKE_STARTER = code(bassNotes("<[c3 ~ g3 ~] [g3 ~ d3 ~] [a3 ~ e3 ~] [f3 ~ c3 ~]>"));
/** The Band's drums and the four-chord loop, C G Am F, for the Make. */
const AXIS_BAND = { band: "band.axis-4bar", tracks: ["drums", "chords"] } as const;

/** The Band's drums and chords (C, then F); the learner writes the bass. */
const VAMP = { band: "band.two-chord-vamp", tracks: ["drums", "chords"] } as const;
const GRAND = { roll: false, staff: "grand", keyboard: false } as const;
/** "Play from the page": the bass staff alone, no code view of the target, no roll, no keys. */
const BASS_STAFF = { roll: false, staff: "bass", keyboard: false } as const;
const BASS_KEYS = { roll: false, staff: "bass", keyboard: true } as const;

export default defineLesson({
  id: "U05.L06",
  version: 4,
  title: "Bass Clef & Grand Staff",
  objective:
    "I can read and write low notes on the bass clef, and read a bass line under chords on the grand staff.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["N04"],
  practises: [],
  terms: [
    { id: "term.bass-clef", step: "S2" },
    { id: "term.grand-staff", step: "S2" },
  ],
  canDo: ["cd.read.bass-clef"],
  wrapAt: "S3",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Down below",
      minutes: 0.5,
      ui: { panels: GRAND, staffLabels: "degree" },
      example: { id: "hook", code: HOOK, bars: 4 },
      exercise: {
        kind: "listen",
        id: "down-below",
        version: 1,
        role: "practice",
        prompt:
          "An upright bass plays under the piano's chords. Listen for the note it keeps coming back to in each bar. Then watch the page: the bass has a staff of its own.",
        skills: [{ skill: "N04", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK, caption: "The bass under the four-chord loop. Watch the lower staff.", bars: 4 },
          {
            code: BASS_ALONE,
            caption: "The bass alone. Which beats repeat a note?",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Two staves",
      minutes: 1,
      ui: { panels: GRAND, staffLabels: "degree" },
      example: { id: "two-staves", code: HOOK, bars: 4 },
      exercise: {
        kind: "run-investigate",
        id: "two-staves",
        version: 1,
        role: "practice",
        prompt:
          "Run the loop and watch both staves. Find the staff that holds the bass line, then its first note, `c2`, and count the short lines between that note and the staff. Answer both questions below.",
        skills: [{ skill: "N04", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. The bass plays the lowest notes; find them on the page, then count the short lines down from the bottom line of their staff.",
        },
        hints: ladder(
          "The bass plays the lowest notes. Look for the staff where the lowest notes are drawn.",
          "Ledger lines go down one for every two letters, as they did under the treble staff. The bottom line of the lower staff is `g2`.",
          "Below `g2` comes `f2` in the space, then `e2` on the first short line. Keep counting down to `c2`.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which staff holds the bass line?",
            options: [
              { id: "lower", label: "The lower staff" },
              { id: "upper", label: "The upper staff" },
              { id: "both", label: "Both: the notes are split by height" },
            ],
            correct: ["lower"],
          },
          {
            q: "number",
            prompt: "The bass's first note is `c2`. How many short lines below the lower staff does it sit?",
            correct: 2,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["lower"], number: 2 } }, expect: "pass" },
          {
            name: "the upper staff",
            response: { answer: { choice: ["upper"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one short line: e2 read as c2",
            response: { answer: { choice: ["lower"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Name the lines",
      minutes: 1,
      graded: true,
      // No degree labels here: in C they would name the notes for the learner. This step reads the page.
      ui: { panels: BASS_STAFF, staffLabels: "none" },
      example: { id: "four-lines", code: LINES, bars: 1 },
      exercise: {
        kind: "staff-read",
        id: "name-the-lines",
        version: 1,
        role: "check",
        prompt:
          "The bass clef shows four notes, one on each line from the bottom up. Type their letters, left to right.",
        skills: [{ skill: "N04", w: 1 }],
        feedbackText: {
          "spell.wrong":
            "Not {got}. These lines are not the treble staff's. Find the line between the clef's two dots, name it, and count the other lines from it, a letter skipped each time.",
        },
        hints: ladder(
          "Start from the clef's two dots. They sit either side of one line, and that line's note is your anchor.",
          "The dots mark F3, the fourth line from the bottom. From one line to the next you skip a letter.",
          "Going down from the fourth line: F, then D. Two lines to go.",
        ),
        source: LINES,
        bars: 1,
        answer: { ui: "text", normalize: "note" },
        correct: { text: ["g", "b", "d", "f"] },
        srs: [
          {
            deck: "deck.pit.staff-names",
            cards: ["fact.staff.bass.G2", "fact.staff.bass.F3"],
            mode: "seed",
          },
          { family: "fam.not.read", mode: "review-if-due" },
        ],
        tests: [
          { name: "g b d f", response: { answer: { text: ["g", "b", "d", "f"] } }, expect: "pass" },
          { name: "capital letters", response: { answer: { text: ["G", "B", "D", "F"] } }, expect: "pass" },
          {
            name: "read as the treble staff",
            response: { answer: { text: ["e", "g", "b", "d"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
          {
            name: "the top line slipped a letter",
            response: { answer: { text: ["g", "b", "d", "e"] } },
            expect: "fail",
            feedback: ["spell.wrong"],
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
      ui: { panels: BASS_STAFF, staffLabels: "none", band: VAMP },
      example: { id: "the-page", code: code(bassNotes(PAGE)), bars: 2 },
      exercise: {
        kind: "code-modify",
        id: "play-the-bass-part",
        version: 1,
        role: "check",
        prompt:
          "The bass clef shows a two-bar bass line, four notes a bar. Replace the `c2`s with the notes on the page, letter and number, in order. Done when your line plays exactly what the page shows.",
        skills: [{ skill: "N04", w: 1 }],
        code: { starter: code(bassNotes(`⟪${PAGE_STARTER}⟫`)) },
        reference: { solutions: [code(bassNotes(PAGE))], bars: 2 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        target: { audible: true },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: a different note from the one on the page. Is it on a line, in a space, or on a short line below? Count from the bottom line, `g2`.",
          "melody.octave":
            "Bar {bar}, {beatLabel}: the right letter, {dir} than the page shows. Check the number after the letter.",
          "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here. The page shows four a bar.",
          "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here. The page shows four a bar.",
        },
        hints: ladder(
          "Sort the notes first: some sit on short lines below the staff, the rest on the staff itself.",
          "The bottom line is `g2` and the space above it `a2`. Below the staff, the first short line is `e2` and the second `c2`.",
          "Bar 1 climbs from the second short line below the staff to the bottom line and back: `c2 e2 g2 e2`. Read bar 2 the same way.",
        ),
        tests: [
          { name: "reference", response: { code: code(bassNotes(PAGE)) }, expect: "pass" },
          {
            name: "the same notes on the electric bass",
            response: { code: code(bassNotes(PAGE, "ebass")) },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: code(bassNotes(PAGE_STARTER)) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "read as the treble staff",
            response: { code: code(bassNotes("<[a1 c2 e2 c2] [d2 f2 a2 f2]>")) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the right letters an octave up",
            response: { code: code(bassNotes("<[c3 e3 g3 e3] [f3 a3 c4 a3]>")) },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "notate",
      title: "Write the roots",
      minutes: 1.25,
      graded: true,
      ui: { panels: BASS_KEYS },
      exercise: {
        kind: "staff-write",
        id: "write-the-roots",
        version: 1,
        role: "check",
        prompt:
          "Write four notes on the bass clef, one per beat, in this order: `c2`, `g2`, `a2`, `f2`. They are the roots the opening bass starts each bar on.",
        skills: [{ skill: "N04", w: 1 }],
        feedbackText: {
          "spell.wrong":
            "{got} → {exp}. On the bass clef the bottom line is `g2` and the space above it `a2`; count from there.",
        },
        hints: ladder(
          "Two of the four notes sit below the staff and two on it. Start from the bottom line of the bass clef.",
          "`c2` is on the second short line below the staff. The bottom line of the bass clef is `g2`.",
          "`c2` on the second short line below, `g2` on the bottom line. `a2` is the next step up.",
        ),
        answer: {
          ui: "staff-input",
          clef: "bass",
          bars: 1,
          palette: { durations: ["4"], accidentals: false, ties: false, rests: false },
        },
        expect: { e: "pitches", spelled: ["C2", "G2", "A2", "F2"], order: "sequence", withOctave: true },
        tests: [
          { name: "right", response: { staff: "C2:4 G2:4 A2:4 F2:4" }, expect: "pass" },
          {
            name: "an octave up",
            response: { staff: "C3:4 G3:4 A3:4 F3:4" },
            expect: "fail",
            feedback: ["staff.octave"],
          },
          {
            name: "placed where the treble staff has them",
            response: { staff: "E2:4 B2:4 C3:4 A2:4" },
            expect: "fail",
            feedback: ["spell.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your own bass line",
      minutes: 2.75,
      ui: { panels: BASS_KEYS, band: AXIS_BAND },
      exercise: {
        kind: "code-make",
        id: "bass-of-your-own",
        version: 1,
        role: "practice",
        prompt:
          "The starter's bass line sits an octave too high, among the chords. Move it down so every note is at `c3` or below, then reshape it: the root of each chord on beat 1, anything you like between. It plays under your song's second part and both loud parts. Done when every bass note is at `c3` or below.",
        skills: [{ skill: "N04", w: 1 }],
        code: { starter: MAKE_STARTER },
        bars: [2, 8],
        saveAs: "sketch",
        rubric: [
          {
            id: "low",
            label: "Every note of `bass` between `c1` and `c3`",
            required: true,
            skills: ["N04"],
            rule: "range",
            track: "bass",
            within: ["c1", "c3"],
          },
          {
            id: "three-notes",
            label: "At least three different notes in `bass`",
            required: false,
            skills: ["N04"],
            rule: "distinct-pitches",
            track: "bass",
            min: 3,
          },
          {
            id: "downbeats",
            label: "`bass` plays a note on beat 1 of every bar",
            required: false,
            skills: ["R01"],
            rule: "onsets",
            track: "bass",
            contains: [[0, 1]],
            perBar: true,
          },
        ],
        hints: ladder(
          "Look at the lower staff while the starter plays: its notes sit as high as the band's chords. The whole line has to move lower.",
          "The starter plays `c3` to `g3`, right where the chords are. The number after each letter sets the octave.",
          "`c3` becomes `c2` and `g3` becomes `g2`: the same line, one octave down. Do the same for the rest, then reshape the line.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: the starter an octave down",
            response: { code: code(bassNotes("<[c2 ~ g2 ~] [g2 ~ d2 ~] [a2 ~ e2 ~] [f2 ~ c2 ~]>")) },
            expect: "pass",
          },
          {
            name: "beyond the brief: steps into each root, the electric bass",
            response: {
              code: code(
                bassNotes("<[c2 ~ c2 e2] [g1 ~ g1 b1] [a1 ~ a1 g1] [f1 c2 f2 g2]>", "ebass", ".room(.2)"),
              ),
            },
            expect: "pass",
          },
          {
            name: "one note climbs above c3",
            response: { code: code(bassNotes("<[c2 ~ g2 ~] [g2 ~ d2 ~] [a2 ~ e2 ~] [f2 ~ c3 a3]>")) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
