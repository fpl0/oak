// U09.L04 The Energy Curve, S9 "Freeze the bar": fidelity pins (docs/oak2/PLAN.md §2 rule 4). The book's point
// (DeSantis, "Repetition and Insistence"; "Randomness and Responsibility"): a chance result becomes an idea when the
// writer keeps it and repeats it. Keeping chance in the line (the notes written out but `.degradeBy()` still dropping
// some, or the `rand` line looped with `.slow()`) must fail, as must a fixed bar unrelated to what chance played; the
// kept bar with a note changed on purpose must pass.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(112/4)\n\n";
const KIT = ['kick: s("bd ~ bd ~")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*8").gain(.4)'];
const loop = (line: string, tail = "") =>
  `${T}${[...KIT, `mel: ${line}.scale("C4:major").s("piano")${tail}`].join("\n")}`;
/** Bar 1 of `n(rand.range(0, 7).segment(8))`, evaluated: C4 A4 F4 F4 E4 D4 E4 F4. */
const FIRST_BAR = "[0 5 3 3 2 1 2 3]";

const PINS: Oak2Pin[] = [
  {
    owner: "U09.L04",
    at: "S9",
    name: "the random line kept, with .degradeBy() dropping some of the written notes",
    kind: "book-miss",
    expect: "fail",
    code: loop(`n("${FIRST_BAR}")`, ".degradeBy(.2)"),
  },
  {
    owner: "U09.L04",
    at: "S9",
    name: "chance still choosing: the rand line slowed so each bar lasts longer",
    kind: "book-miss",
    expect: "fail",
    code: loop("n(rand.range(0, 7).segment(8))", ".slow(2)"),
  },
  {
    owner: "U09.L04",
    at: "S9",
    name: "a fixed bar, but not the one chance played",
    kind: "book-miss",
    expect: "fail",
    code: loop('n("[0 2 4 2 0 2 4 7]")'),
  },
  {
    owner: "U09.L04",
    at: "S9",
    name: "the kept bar with one note changed on purpose, its last note up to A",
    kind: "book-other-way",
    expect: "pass",
    code: loop('n("[0 5 3 3 2 1 2 5]")'),
  },
  {
    owner: "U09.L04",
    at: "S9",
    name: "the kept bar written as two half bars in brackets",
    kind: "book-other-way",
    expect: "pass",
    code: loop('n("[[0 5 3 3] [2 1 2 3]]")'),
  },
];

export default PINS;
