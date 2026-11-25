// Oak 2.0 fidelity pins for U07.L01 S9 "Leap, then turn back" (docs/oak2/PLAN.md §2 rule 4; DeSantis, "Creating
// Melodies 1"). The book's point: after a leap a melody tends to turn back into the gap it jumped. A line that
// leaps and then steps on the same way keeps the surface (leaps and steps) and misses it; a smaller leap back, or an
// arpeggio (a chord's notes in a row, exempt), gets it another way.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(92/4)\n\n";
const gap = (bar1: string, bar3: string) =>
  `${T}mel: n("<${bar1} [2 ~ 1 ~] ${bar3} [4 2 0@2]>").scale("C4:major").s("piano")`;

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "U07.L01",
    at: "S9",
    name: "X14: up an octave and straight back down (a yo-yo, not a fill)",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(92/4)\n\nmel: n("<[0 ~ 7 0] [2 ~ 1 ~] [2 ~ 9 2] [4 2 0@2]>").scale("C4:major").s("piano")\n',
  },
  {
    owner: "U07.L01",
    at: "S9",
    name: "X14: up a 5th and straight back to the start note",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(92/4)\n\nmel: n("<[0 ~ 4 0] [2 ~ 1 ~] [2 ~ 6 2] [4 2 0@2]>").scale("C4:major").s("piano")\n',
  },
];

export default [
  {
    owner: "U07.L01",
    at: "S9",
    name: "every leap followed by a step in the same direction",
    kind: "book-miss",
    expect: "fail",
    says: "not yet. After a leap, move back toward the notes you left",
    code: gap("[0 ~ 5 6]", "[2 ~ 6 7]"),
  },
  {
    owner: "U07.L01",
    at: "S9",
    name: "the leaps made smaller than a 4th so nothing counts: no leap is left to turn back from",
    kind: "book-miss",
    expect: "fail",
    code: gap("[0 ~ 2 3]", "[2 ~ 4 5]"),
  },
  {
    owner: "U07.L01",
    at: "S9",
    name: "a leap answered by a smaller leap back (G down to E)",
    kind: "book-other-way",
    expect: "pass",
    code: gap("[0 ~ 4 2]", "[2 ~ 7 5]"),
  },
  {
    owner: "U07.L01",
    at: "S9",
    name: "bar 1 an arpeggio falling C G E C (exempt), bar 3 a leap that turns back",
    kind: "book-other-way",
    expect: "pass",
    code: gap("[7 4 2 0]", "[2 ~ 7 6]"),
  },
  ...X14,
] satisfies Oak2Pin[];
