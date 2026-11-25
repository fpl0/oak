// A1.L06 Movement, S8 "Steps, not sweeps" (the book's Rhythm of Automation): fidelity pins (docs/oak2/PLAN.md §2
// rule 4). The book's point is that a control change has a rhythm of its own: values that hold and then jump on the
// grid, not a glide that gives every note a new value. The loop is the lesson's: the A1 drums and bass under eighth-
// note chords whose cutoff the learner writes.
import type { Oak2Pin } from "./types.ts";

const loop = (lpf: string) =>
  [
    "setcpm(100/4)",
    "",
    'kick: s("bd ~ bd ~")',
    'snare: s("~ sd ~ sd").room(.5).roomsize(6)',
    'hats: s("hh*8").gain(.5)',
    'bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).decay(.2).sustain(0)',
    `chords: note("<[c4,e4,g4]*8 [c4,f4,a4]*8>").s("sawtooth").decay(.12).sustain(0).lpf(${lpf}).gain(.35)`,
  ].join("\n");

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "A1.L06",
    at: "S8",
    name: "X14: cutoff steps of 1 Hz at 18 kHz (no step anyone hears)",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(100/4)\n\nkick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd").room(.5).roomsize(6)\nhats: s("hh*8").gain(.5)\nbass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).decay(.2).sustain(0)\nchords: note("<[c4,e4,g4]*8 [c4,f4,a4]*8>")\n  .s("sawtooth")\n  .decay(.12)\n  .sustain(0)\n  .lpf("18000 18001 18002 18003")\n  .gain(.35)\n',
  },
  {
    owner: "A1.L06",
    at: "S8",
    name: "X14: held cutoffs 400, 800, 3000: an octave, then more",
    kind: "book-other-way",
    expect: "pass",
    code: 'setcpm(100/4)\n\nkick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd").room(.5).roomsize(6)\nhats: s("hh*8").gain(.5)\nbass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).decay(.2).sustain(0)\nchords: note("<[c4,e4,g4]*8 [c4,f4,a4]*8>")\n  .s("sawtooth")\n  .decay(.12)\n  .sustain(0)\n  .lpf("400 800 3000 3000")\n  .gain(.35)\n',
  },
  {
    owner: "A1.L06",
    at: "S8",
    name: "X14: held cutoffs 500, 700, 3000",
    kind: "book-other-way",
    expect: "pass",
    code: 'setcpm(100/4)\n\nkick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd").room(.5).roomsize(6)\nhats: s("hh*8").gain(.5)\nbass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(500).decay(.2).sustain(0)\nchords: note("<[c4,e4,g4]*8 [c4,f4,a4]*8>")\n  .s("sawtooth")\n  .decay(.12)\n  .sustain(0)\n  .lpf("500 700 3000")\n  .gain(.35)\n',
  },
];

export default [
  {
    owner: "A1.L06",
    at: "S8",
    name: "a sine sweep read per chord: every chord a new cutoff",
    kind: "book-miss",
    expect: "fail",
    says: "Not yet: The chords' cutoff holds a value",
    code: loop("sine.range(400, 2000)"),
  },
  {
    owner: "A1.L06",
    at: "S8",
    name: "one constant cutoff: steps of nothing",
    kind: "book-miss",
    expect: "fail",
    says: "Not yet: The chords' cutoff holds a value",
    code: loop("1200"),
  },
  {
    owner: "A1.L06",
    at: "S8",
    name: "a saw cut into four held steps with .segment(4), over eighth notes",
    kind: "book-other-way",
    expect: "pass",
    code: loop("saw.range(400, 2000).segment(4)"),
  },
  {
    owner: "A1.L06",
    at: "S8",
    name: "steps in a rhythm of their own, held for three, three and two chords",
    kind: "book-other-way",
    expect: "pass",
    code: loop('"400@3 2000@3 1200@2"'),
  },
  ...X14,
] satisfies Oak2Pin[];
