// A2.L04 Sampling, S8 "Speed changes the rhythm" (the book's Sampling the Old-Fashioned Way): fidelity pins
// (docs/oak2/PLAN.md §2 rule 4). The book's point: on an old sampler a recording's speed, pitch and length are one
// dial, so a phrase played faster or slower comes back in a new rhythm. The loop is the lesson's: Oak's one-bar break
// `brk` at 96 BPM, cut into its four beats, played as recorded, at twice the speed and at half.
import type { Oak2Pin } from "./types.ts";

const tempo = "setcpm(96/4)\n\n";
const drums = (order: string, speeds: string) => `${tempo}drums: s("brk").slice(4, "${order}")${speeds}`;

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "A2.L04",
    at: "S8",
    name: "X14: every piece cut to a click with .end(.01): gaps after each",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(96/4)\n\ndrums: s("brk").slice(4, "<[0 1 2 3] [0 1 2 3]*2 [0 1]>").speed("<1 2 .5>").end(.01)\n',
  },
  {
    owner: "A2.L04",
    at: "S8",
    name: "X14: .end(1): every piece runs on into the next",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(96/4)\n\ndrums: s("brk").slice(4, "<[0 1 2 3] [0 1 2 3]*2 [0 1]>").speed("<1 2 .5>").end(1)\n',
  },
];

export default [
  {
    owner: "A2.L04",
    at: "S8",
    name: "the new rhythm written in, but every speed 1: the pieces change place, not speed",
    kind: "book-miss",
    expect: "fail",
    says: "Not yet: a piece plays at another speed",
    code: drums("<[0 1 2 3] [0 1 2 3]*2 [0 1]>", '.speed("<1 1 1>")'),
  },
  {
    owner: "A2.L04",
    at: "S8",
    name: "the speeds changed, the pieces left on the beats: a new pitch, the old rhythm",
    kind: "book-miss",
    expect: "fail",
    says: "Bar 2",
    code: drums("<[0 1 2 3] [[0 1 2 3]] [0 1 2 3]>", '.speed("<1 2 .5>")'),
  },
  {
    owner: "A2.L04",
    at: "S8",
    name: "the phrase as three sections of its own: as recorded, sped up by .speed(2), slowed by .speed(.5)",
    kind: "book-other-way",
    expect: "pass",
    code: [
      tempo.trimEnd(),
      "",
      'const recorded = s("brk").slice(4, "0 1 2 3").speed(1)',
      'const double = s("brk").slice(4, "[0 1 2 3]*2").speed(2)',
      'const half = s("brk").slice(4, "0 1").speed(.5)',
      "",
      "drums: arrange([1, recorded], [1, double], [1, half])",
    ].join("\n"),
  },
  {
    owner: "A2.L04",
    at: "S8",
    name: "the speeds written before the cut",
    kind: "book-other-way",
    expect: "pass",
    code: `${tempo}drums: s("brk").speed("<1 2 .5>").slice(4, "<[0 1 2 3] [0 1 2 3]*2 [0 1]>")`,
  },
  ...X14,
] satisfies Oak2Pin[];
