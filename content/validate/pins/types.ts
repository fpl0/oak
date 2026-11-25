// One fidelity pin of Oak 2.0 (docs/oak2/PLAN.md §2 rule 4): a piece of learner code graded against one step of
// one lesson exactly as content:check grades it, with the result it must get. Each lesson keeps its pins in
// `content/validate/pins/<lesson id>.ts` (`export default [...] satisfies Oak2Pin[]`); `../oak2-pins.test.ts`
// loads every such file.

export type Oak2Pin = {
  /** The lesson the pin grades against, and the name of its file (`U06.L13`). */
  owner: string;
  /** The step id (`S4`, the Make's step id), or an exercise id inside a multi-part step. */
  at: string;
  /** What the code is, in plain words ("the scale-step version: shapes change"). */
  name: string;
  /**
   * `book-miss`: keeps the surface and misses the book's point, so it must fail. `book-other-way`: gets the point
   * another way, so it must pass. `extra`: any other pin the lesson's author wants held (a lint pin, a mistake).
   */
  kind: "book-miss" | "book-other-way" | "extra";
  expect: "pass" | "fail";
  /** The start of the first line the learner reads that is not "done", as content:check --verbose prints it. */
  says?: string;
  /** The learner's whole code; `setcpm(96/4)` is put in front when it sets no tempo. */
  code: string;
  /**
   * A `book-miss` must fail on the book's point: its feedback holds no lint finding (`form.*`, `code.locked-*`, …),
   * only `rubric.unmet` and the reference checks (`harmony.pcset`, `melody.*`, …). A pin meant to fail on lint says
   * so here (W5).
   */
  failsOn?: "lint";
};
