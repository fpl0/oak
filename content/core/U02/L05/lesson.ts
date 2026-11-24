// U02.L05 Moving Melodies. Every note has a number (c4 = 60, one per half step), so moving a whole line is
// adding the same number to each note: `.transpose(n)`, with a plain number only (interval strings and
// patterned amounts are U04.L02's, so the patterned hook is a preview example). Unlocks note(60) and
// .transpose(). Spec: content/specs/U02.md.
import { defineLesson, type HintLadder } from "@oak/content-kit";

const BPM = 96;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const mel = (notes: string, extra = "") => `${TEMPO}mel: note("${notes}").s("piano")${extra}`;
const RIFF_NOTES = "c4 e4 g4 e4";
/** The riff with an optional link between `note()` and `.s()` (pitch before sound, STYLE §1.5). */
const riff = (link = "", notes = RIFF_NOTES) => `${TEMPO}mel: note("${notes}")${link}.s("piano")`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

/** The Band carries drums, bass and chords; the learner writes the line on top. */
const BAND = { band: "band.two-chord-vamp" } as const;
const ROLL_KEYS = { roll: true, staff: false, keyboard: true } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

/** The hook as Strudel writes it: a patterned transpose, read-only (preview) until U04.L02. */
// The amounts follow the Band (C, F, C, F): up 5 is the F chord itself (what S4 and the Make build on), up
// 7 sits over C as its bright upper notes. An earlier 0 2 4 0 put F♯ over the F chord and G♯ over C.
const HOOK_PREVIEW = `${TEMPO}mel: note("${RIFF_NOTES}").transpose("<0 5 7 0>").s("piano")`;
/** The same four bars spelled out note by note: evaluated, they give identical events. */
const HOOK = mel("<[c4 e4 g4 e4] [f4 a4 c5 a4] [g4 b4 d5 b4] [c4 e4 g4 e4]>");

/** Before U03.L02 feedback names places and letters, never degrees, solfège or keys. */
const NOTE_FEEDBACK = {
  "melody.octave":
    "Bar {bar}, {beatLabel}: the right letter, but {dir} than asked. Check the number after the letter.",
  "melody.wrong-degree": "Bar {bar}, {beatLabel}: a different note from the one asked for.",
  "melody.missing-note": "Bar {bar}, {beatLabel}: a note is missing here.",
  "melody.extra-note": "Bar {bar}, {beatLabel}: one note too many here.",
} as const;

/** Two bars for the ear: the riff, then a second version. */
const pair = (second: string) => mel(`<[${RIFF_NOTES}] [${second}]>`);
const ID_WRONG = {
  "id.wrong": "Not this time. Hum the riff, then the second line: did the shape stay the same?",
} as const;
const SAME_OR_NOT = [
  { id: "moved", label: "The same tune, moved up" },
  { id: "different", label: "A different tune" },
];

export default defineLesson({
  id: "U02.L05",
  version: 4,
  title: "Moving Melodies",
  objective: "I can give a note its number and move a whole line up or down by half steps with .transpose().",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: ["P06"],
  practises: ["P05"],
  terms: [
    { id: "term.midi-number", step: "S2" },
    { id: "term.transpose", step: "S3" },
    { id: "term.chromatic-scale", step: "S5" },
  ],
  canDo: ["cd.code.transpose"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "The same tune, climbing",
      minutes: 0.5,
      ui: { panels: ROLL_KEYS, rollLabels: "note", band: BAND },
      example: { id: "hook", code: HOOK_PREVIEW, bars: 4, preview: true },
      exercise: {
        kind: "listen",
        id: "same-tune-climbing",
        version: 1,
        role: "practice",
        prompt:
          "Listen for the shape of bar 1: how it climbs and falls. Then listen for whether bars 2 and 3 repeat that shape from a higher start. Hum along if it helps.",
        skills: [{ skill: "P06", w: 1 }],
        hints: null,
        tests: [],
        items: [{ code: HOOK, caption: "Bar 1 sets the riff. Watch where bars 2 and 3 start.", bars: 4 }],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "Notes as numbers",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "notes-as-numbers",
        version: 1,
        role: "practice",
        prompt:
          "`note()` also takes numbers: 60, 62 and 64 play `c4`, `d4` and `e4`. Put other numbers, such as 61 and 63, in place of the `~` and listen. Then answer the two questions below.",
        skills: [{ skill: "P05", w: 1 }],
        feedbackText: {
          "investigate.wrong": "Not quite. Watch the keyboard: which key does each number light?",
        },
        hints: ladder(
          "Put 61 in place of the `~` and watch the keyboard. Which key lights up, compared with the one for 60?",
          "Each number is one key, black or white. 60 is `c4`, 61 the black key above it, 62 is `d4`.",
          "64 is `e4`. Is there a black key between `e4` and `f4`?",
        ),
        code: { starter: mel("60 62 64 ~") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "number",
            prompt: "Which number plays `f4`?",
            correct: 65,
          },
          {
            q: "choice",
            prompt: "What does adding 1 to a number do?",
            options: [
              { id: "half", label: "Moves the note up one key, black or white: a half step" },
              { id: "white", label: "Moves the note up one white key" },
              { id: "octave", label: "Moves the note up one octave" },
            ],
            correct: ["half"],
          },
        ],
        tests: [
          { name: "both right", response: { answer: { number: 65, choice: ["half"] } }, expect: "pass" },
          {
            name: "counted two for every letter",
            response: { answer: { number: 66, choice: ["half"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "one white key",
            response: { answer: { number: 65, choice: ["white"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Move every note",
      minutes: 1,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "run-investigate",
        id: "move-every-note",
        version: 1,
        role: "practice",
        prompt:
          "Listen to the riff with `.transpose(2)`, then delete `.transpose(2)` and listen again. Compare the note labels on the roll in the two versions, then answer the two questions below.",
        skills: [{ skill: "P06", w: 1 }],
        feedbackText: {
          "investigate.wrong": "Not quite. Put `.transpose(2)` back and compare the labels on the roll.",
        },
        hints: ladder(
          "Compare the four labels on the roll with and without `.transpose(2)`. Did one note change, or all four?",
          "Compare each label on the roll with and without it. `c4` became `d4`: how many half steps is that?",
          "`e4` became `f#4`, two half steps up, not the white key `f4`.",
        ),
        code: { starter: riff(".transpose(2)") },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "What did `.transpose(2)` do to the riff?",
            options: [
              { id: "all-half-steps", label: "Moved every note up two half steps: the same tune, higher" },
              { id: "first", label: "Moved only the first note" },
              { id: "white-keys", label: "Moved every note up two white keys" },
            ],
            correct: ["all-half-steps"],
          },
          {
            q: "number",
            prompt: "How many octaves up would `.transpose(12)` move it?",
            correct: 1,
          },
        ],
        tests: [
          {
            name: "both right",
            response: { answer: { choice: ["all-half-steps"], number: 1 } },
            expect: "pass",
          },
          {
            name: "white keys",
            response: { answer: { choice: ["white-keys"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "twelve octaves",
            response: { answer: { choice: ["all-half-steps"], number: 12 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Up five half steps",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "code-modify",
        id: "up-five",
        version: 1,
        role: "check",
        prompt:
          "Move the whole riff up five half steps with `.transpose()`. Keep the four note names as they are.",
        skills: [
          { skill: "P06", w: 0.5 },
          { skill: "P03", w: 0.5 },
        ],
        code: { starter: `${TEMPO}mel: note("${RIFF_NOTES}")⟪.s("piano")⟫` },
        reference: { solutions: [riff(".transpose(5)")], bars: 1 },
        matcher: {
          m: "all",
          of: [
            { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
            // Names the commonest slip (the right tune, moved by the wrong amount) as melody.transposed.
            { m: "melody", pitch: "key-relative", wPitch: 1, wRhythm: 0, rhythmTol: [1, 16] },
          ],
        },
        constraints: [{ c: "must-use", tool: "tb.transpose", feedback: "code.must-use" }],
        target: { audible: true, showRoll: true },
        feedbackText: {
          ...NOTE_FEEDBACK,
          "melody.wrong-degree":
            "Bar {bar}, {beatLabel}: a different note from the one asked for. Count the half steps again.",
          "melody.transposed":
            "The right tune, moved by a different number of half steps than five. Change the number inside `.transpose()`.",
          "code.must-use":
            "Move the notes with `.transpose()` and a number of half steps inside it, and keep the note names as they were.",
          // A move of 17 or -7 lands on the right letters an octave out: point at the number in `.transpose()`.
          "melody.octave":
            "Bar {bar}, {beatLabel}: the right letter, but {dir} than asked, an octave out. Twelve half steps make an octave: check the number in `.transpose()`.",
        },
        hints: ladder(
          "Every note must move up by the same five half steps. Which method from the last step moved the whole riff up by two?",
          '`.transpose()` goes between `note(…)` and `.s("piano")`; the number in it counts half steps.',
          "`.transpose(2)` moved the riff up two half steps. You need a bigger number.",
        ),
        srs: [{ family: "fam.pit.steps", mode: "review-if-due" }],
        tests: [
          { name: "reference", response: { code: riff(".transpose(5)") }, expect: "pass" },
          {
            name: "written as numbers",
            response: { code: riff(".transpose(5)", "60 64 67 64") },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: riff() },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "counted white keys: four",
            response: { code: riff(".transpose(4)") },
            expect: "fail",
            feedback: ["melody.transposed"],
          },
          {
            name: "five half steps and an octave",
            response: { code: riff(".transpose(17)") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
          {
            name: "moved by hand, one note wrong",
            response: { code: riff("", "f4 a4 c5 a#4") },
            expect: "fail",
            feedback: ["code.must-use", "melody.wrong-degree"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Every key in a row",
      minutes: 1,
      graded: true,
      ui: { panels: ROLL_KEYS, rollLabels: "note" },
      exercise: {
        kind: "code-fill",
        id: "every-key",
        version: 1,
        role: "check",
        prompt:
          "Fill the three gaps so the line climbs from `c4` to `b4` one half step at a time, every key in turn. Each gap takes one note name with its number, like `c#4`.",
        skills: [{ skill: "P06", w: 1 }],
        code: { starter: mel("c4 c#4 d4 ⟦1⟧ e4 f4 ⟦2⟧ g4 g#4 a4 ⟦3⟧ b4") },
        blanks: [
          { id: "1", input: "text", maxLen: 4 },
          { id: "2", input: "text", maxLen: 4 },
          { id: "3", input: "text", maxLen: 4 },
        ],
        reference: { solutions: [mel("c4 c#4 d4 d#4 e4 f4 f#4 g4 g#4 a4 a#4 b4")], bars: 1 },
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false },
        feedbackText: {
          ...NOTE_FEEDBACK,
          "fill.blank-wrong":
            "Gap {blank} isn't right yet. Each gap is the black key between the white keys on either side of it, named with a `#` or a `b`.",
          "fill.blank-empty":
            "Gap {blank} is still empty. Write a note name with its number there, like `c#4`.",
        },
        hints: ladder(
          "Each gap sits between two white keys: `d4` and `e4`, `f4` and `g4`, `a4` and `b4`. Which key lies between each pair?",
          "Each gap is a black key. Name it from the white key below it with a `#`.",
          "The first gap is `d#4`. The other two follow the same way.",
        ),
        tests: [
          { name: "sharps", response: { blanks: { "1": "d#4", "2": "f#4", "3": "a#4" } }, expect: "pass" },
          {
            name: "flats, the same keys",
            response: { blanks: { "1": "eb4", "2": "gb4", "3": "bb4" } },
            expect: "pass",
          },
          {
            name: "a white key in the first gap",
            response: { blanks: { "1": "e4", "2": "f#4", "3": "a#4" } },
            expect: "fail",
            feedback: ["fill.blank-wrong"],
          },
          {
            name: "a gap left empty",
            response: { blanks: { "1": "d#4", "2": "", "3": "a#4" } },
            expect: "fail",
            feedback: ["fill.blank-empty"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "ear",
      title: "Moved, or new?",
      minutes: 1.25,
      graded: true,
      ui: { panels: NONE },
      exercise: {
        kind: "all",
        id: "moved-or-new",
        version: 1,
        role: "check",
        prompt:
          "Listen to three clips. Each plays the riff, then a second line. For each, pick whether the second line is the same tune moved up or a different tune.",
        skills: [{ skill: "P06", w: 1 }],
        hints: ladder(
          "Hum the riff, then hum the second line. Did the shape of your humming change?",
          "A moved tune keeps every distance: same ups and downs, by the same amounts, just higher.",
          "Listen to the second bar as if the first did not exist. Could you sing it to the same shape?",
        ),
        tests: [],
        parts: [
          {
            kind: "identify",
            id: "moved-two",
            version: 1,
            role: "check",
            prompt:
              "Listen to the riff, then the second line. Pick whether the second is the same tune moved up or a different tune.",
            skills: [{ skill: "P06", w: 1 }],
            hints: ladder(
              "Follow the ups and downs of both lines. Does the second climb and fall back like the riff?",
              "Hum both. Moved tunes keep their shape.",
              "Listen again at a slower speed and hum along.",
            ),
            stimulus: { src: "code", code: pair("d4 f#4 a4 f#4"), bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: 2 },
            answer: { ui: "choice", options: SAME_OR_NOT },
            feedbackText: ID_WRONG,
            correct: { choice: ["moved"] },
            tests: [
              { name: "moved", response: { answer: { choice: ["moved"] } }, expect: "pass" },
              { name: "different", response: { answer: { choice: ["different"] } }, expect: "fail" },
            ],
          },
          {
            kind: "identify",
            id: "new-shape",
            version: 1,
            role: "check",
            prompt:
              "Listen to the riff, then the second line. Pick whether the second is the same tune moved up or a different tune.",
            skills: [{ skill: "P06", w: 1 }],
            hints: ladder(
              "Follow the ups and downs of both lines. Does the second climb and fall back like the riff?",
              "The riff goes up, up, then down. Does the second line?",
              "Listen again at a slower speed and hum along.",
            ),
            stimulus: { src: "code", code: pair("g4 e4 d4 a4"), bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: 2 },
            answer: { ui: "choice", options: SAME_OR_NOT },
            feedbackText: ID_WRONG,
            correct: { choice: ["different"] },
            tests: [
              { name: "different", response: { answer: { choice: ["different"] } }, expect: "pass" },
              { name: "moved", response: { answer: { choice: ["moved"] } }, expect: "fail" },
            ],
          },
          {
            kind: "identify",
            id: "moved-five",
            version: 1,
            role: "check",
            prompt:
              "Listen to the riff, then the second line. Pick whether the second is the same tune moved up or a different tune.",
            skills: [{ skill: "P06", w: 1 }],
            hints: ladder(
              "Follow the ups and downs of both lines. Does the second climb and fall back like the riff?",
              "Hum both. Moved tunes keep their shape, however far they move.",
              "Listen again at a slower speed and hum along.",
            ),
            stimulus: { src: "code", code: pair("f4 a4 c5 a4"), bars: 2, showCode: false },
            cue: { context: "none", countInBars: 0, click: false, replays: 2 },
            answer: { ui: "choice", options: SAME_OR_NOT },
            feedbackText: ID_WRONG,
            correct: { choice: ["moved"] },
            tests: [
              { name: "moved", response: { answer: { choice: ["moved"] } }, expect: "pass" },
              { name: "different", response: { answer: { choice: ["different"] } }, expect: "fail" },
            ],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "A riff and its copy",
      minutes: 2.5,
      ui: { panels: ROLL, rollLabels: "note", band: BAND },
      exercise: {
        kind: "code-make",
        id: "riff-and-copy",
        version: 1,
        role: "practice",
        prompt:
          "Your melody from The Treble Staff is in the editor, for the last loud part of your song. Play it a second time, moved with `.transpose()` and a number other than 0: on a second labelled line, or in a second bar with `< >`. Keep the melody playing too. Done when the copy keeps its shape at a new height.",
        skills: [{ skill: "P06", w: 1 }],
        code: { starter: riff() },
        bars: [1, 4],
        saveAs: "sketch",
        rubric: [
          {
            id: "moved-copy",
            // The effect, not the call: `.transpose(0)` moves nothing, and the riff must also sound unmoved.
            label: "A copy of the riff, every note moved up or down with `.transpose()`",
            required: true,
            skills: ["P06"],
            rule: "custom",
            fn: "transposed-copy",
            params: { rhythm: "any", alsoUses: ["tb.transpose"] },
          },
          {
            id: "two-lines",
            label: "Two labelled melody lines, such as `mel:` and `vox:`",
            required: false,
            skills: ["P06"],
            rule: "tracks",
            min: 2,
            roles: ["melody"],
          },
          {
            id: "number-note",
            label: "At least one note written as a number, such as 60 for `c4`",
            required: false,
            skills: ["P05"],
            rule: "uses",
            tool: "tb.note.midi",
          },
        ],
        hints: ladder(
          "The melody must play twice: once as written, once moved. Where could the second copy go?",
          'Copy the `mel` line to a new line labelled `vox` (a second melody line), and put `.transpose()` before its `.s("piano")`.',
          "`.transpose(12)` on the copy doubles the melody an octave up. Other numbers give other colours.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: riff() },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: an octave double",
            response: { code: `${riff()}\nvox: note("${RIFF_NOTES}").transpose(12).s("piano")` },
            expect: "pass",
          },
          {
            name: "beyond the brief: the copy follows the band's second chord",
            response: {
              code: `${TEMPO}mel: note("<[c4 e4 g4 e4] ~>").s("piano")\nvox: note("<~ [60 64 67 64]>").transpose(5).s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "`.transpose(0)`: the copy sounds where the riff does",
            response: { code: riff(".transpose(0)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "only the moved line, no riff to compare it with",
            response: { code: riff(".transpose(7)") },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "an octave below, on a second line",
            response: { code: `${riff()}\nvox: note("${RIFF_NOTES}").transpose(-12).s("piano").gain(.6)` },
            expect: "pass",
          },
          {
            name: "a fifth up in the second bar, as numbers",
            response: {
              code: `${TEMPO}mel: note("<[60 64 67 64] ~>").s("piano")\nvox: note("<~ [60 64 67 64]>").transpose(7).s("piano")`,
            },
            expect: "pass",
          },
          {
            name: "copied by hand",
            response: { code: `${riff()}\nvox: note("f4 a4 c5 a4").s("piano")` },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
