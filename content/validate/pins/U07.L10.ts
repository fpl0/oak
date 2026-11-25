// Oak 2.0 fidelity pins for U07.L10 S5 "Freeze it" (docs/oak2/PLAN.md §2 rule 4; DeSantis, "Randomness and
// Responsibility"). The book's point: chance proposes and the writer takes responsibility for the result, so the
// random result is kept as fixed notes and then edited. Writing the notes out but keeping chance, or dropping chance
// without keeping its result, keeps the surface and misses it; the frozen result with some notes fixed gets it.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(104/4)\n\n";
const FROZEN = "<[9 ~ 9 7] [4 ~ 4 4] [7 ~ 7 5] [7 ~ 5 3]>";
const mel = (pattern: string, tail = "") => `${T}mel: n("${pattern}").scale("C4:major")${tail}.s("piano")`;

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "U07.L10",
    at: "S5",
    name: "X14: five of the twelve frozen notes changed (more than one in four)",
    kind: "extra",
    expect: "fail",
    code: 'setcpm(104/4)\n\nmel: n("<[0 ~ 9 7] [0 ~ 4 4] [0 ~ 7 5] [0 ~ 0 3]>").scale("C4:major").s("piano")\n',
  },
];

export default [
  {
    owner: "U07.L10",
    at: "S5",
    name: "the notes written out but .degradeBy(.2) kept: still chance",
    kind: "book-miss",
    expect: "fail",
    says: "No chance left on `mel`: no `?`, `.degradeBy()` or `.sometimesBy()`: not yet.",
    code: mel(FROZEN, ".degradeBy(.2)"),
  },
  {
    owner: "U07.L10",
    at: "S5",
    name: "a fixed tune unrelated to the frozen one: no chance, nothing kept",
    kind: "book-miss",
    expect: "fail",
    says: "At least 3 in 4 of the notes are the ones chance played in the first four bars: not yet.",
    code: mel("<[0 ~ 2 4] [5 ~ 4 2] [0 ~ 2 4] [2 ~ 1 0]>"),
  },
  {
    owner: "U07.L10",
    at: "S5",
    name: "the frozen result with a quarter of its notes changed (3 of 12: one in each of bars 1, 2 and 4)",
    kind: "book-other-way",
    expect: "pass",
    code: mel("<[9 ~ 8 7] [4 ~ 4 2] [7 ~ 7 5] [5 ~ 5 3]>"),
  },
  {
    owner: "U07.L10",
    at: "S5",
    name: "the frozen result with one note dropped to a rest and one held longer",
    kind: "book-other-way",
    expect: "pass",
    code: mel("<[9 ~ 9 7] [4 ~ 4 ~] [7 ~ 7 5] [7@2 5 3]>"),
  },
  ...X14,
] satisfies Oak2Pin[];
