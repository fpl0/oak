// A2.L05 Mix & Dynamics, S8 "Front, middle, back" (the book's Foreground, Middle Ground, Background): fidelity pins
// (docs/oak2/PLAN.md §2 rule 4). The book's point: the background barely changes, the front changes most, and a
// background part may step forward for a moment and settle back. The loop is the lesson's: eight bars on Am, a tune
// that changes every bar, chords and a bass that repeat, over the Band's drums.
import type { Oak2Pin } from "./types.ts";

const TUNE = "<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [2 ~ 4 ~] [4 ~ 7 ~] [4 2 6 ~] [4 3 2 1] [0 ~ ~ ~]>";
const BASS = 'bass: note("a1 ~ a1 [~ a1]").s("sawtooth").lpf(400).gain(.6)';
const CHORDS = "[0,2,4]@3 [0,2,4]";
const STEP_FORWARD = '"<.25 .25 .25 .25 .25 .25 .25 .5>"';
const piece = (chords: string, bass = BASS, tune = TUNE) =>
  [
    "setcpm(90/4)",
    "",
    bass,
    chords,
    `mel: n("${tune}").scale("A4:minor").s("square").lpf(2000).gain(.5)`,
  ].join("\n");
const chords = (pattern: string, gain: string) =>
  `chords: n("${pattern}").scale("A3:minor").s("piano").gain(${gain})`;

export default [
  {
    owner: "A2.L05",
    at: "S8",
    name: "every part equally busy: chords and bass change every bar like the tune, the chords louder in bar 8",
    kind: "book-miss",
    expect: "fail",
    says: "Not yet: The chords and the bass repeat",
    code: piece(
      chords(
        "<[0,2,4] [2,4,6] [0,2,4]*2 [-1,1,3] [3,5,7]@3 [1,3,5] [[0,2,4] [1,3,5]] [0,2,4]*4>",
        STEP_FORWARD,
      ),
      'bass: note("<a1 [a1 c2] e1 [g1 a1] d2 [f1 e1] [a1 a1 a1 a1] a1*8>").s("sawtooth").lpf(400).gain(.6)',
    ),
  },
  {
    owner: "A2.L05",
    at: "S8",
    name: "the depths kept, but nothing ever steps forward: the chords louder in every bar",
    kind: "book-miss",
    expect: "fail",
    says: "Not yet: The chords and the bass repeat",
    code: piece(chords(CHORDS, '"<.5 .5 .5 .5 .5 .5 .5 .5>"')),
  },
  {
    owner: "A2.L05",
    at: "S8",
    // The step keeps the given tune (an `events` match on `mel`), so the first lines the learner reads name the
    // tune's changed notes; `depth-layers` fails it too (the front varies no more than the chords).
    name: "the front repeating like the back: one bar of tune eight times, the chords stepping forward in bar 8",
    kind: "book-miss",
    expect: "fail",
    code: piece(chords(CHORDS, STEP_FORWARD), BASS, "[4 ~ 2 0]"),
  },
  {
    owner: "A2.L05",
    at: "S8",
    name: "the chords step forward by rhythm: busier in bar 8, the same level",
    kind: "book-other-way",
    expect: "pass",
    code: piece(chords(`<[${CHORDS}]!7 [0,2,4]*8>`, ".25")),
  },
  {
    owner: "A2.L05",
    at: "S8",
    name: "the chords step forward by level in bar 5",
    kind: "book-other-way",
    expect: "pass",
    code: piece(chords(CHORDS, '"<.25 .25 .25 .25 .5 .25 .25 .25>"')),
  },
] satisfies Oak2Pin[];
