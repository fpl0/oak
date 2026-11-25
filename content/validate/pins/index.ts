// The graded steps Oak 2.0 W2 adds (docs/superpowers/plans/2026-11-25-oak2-w2.md): every graded code step and every
// Make of the ten new lessons, and the graded steps added to existing lessons. `../oak2-pins.test.ts` requires each
// of them (every one is written since W5) to grade the code (a rubric or a code target, whatever its `graded` flag)
// and to hold at least one `book-miss` pin that fails and one `book-other-way` pin that passes (docs/oak2/PLAN.md
// §2 rule 4).

export const W2_GRADED: readonly { owner: string; at: string }[] = [
  // The ten new lessons.
  { owner: "U06.L13", at: "S4" },
  { owner: "U06.L13", at: "S6" },
  { owner: "U07.L11", at: "S4" },
  { owner: "U07.L11", at: "S6" },
  { owner: "U07.L11", at: "S7" },
  // W5 (X22): the optional "Under the motif", graded by `inverted-copy` and `register-separation`.
  { owner: "U07.L11", at: "S8" },
  { owner: "U08.L06", at: "S4" },
  { owner: "U08.L06", at: "S5" },
  { owner: "U08.L06", at: "S6" },
  { owner: "U09.L06", at: "S4" },
  { owner: "U09.L06", at: "S5" },
  { owner: "U09.L06", at: "S7" },
  { owner: "U09.L07", at: "S4" },
  { owner: "U09.L07", at: "S5" },
  { owner: "U09.L07", at: "S6" },
  { owner: "U09.L07", at: "S7" },
  { owner: "R1.L06", at: "S4" },
  { owner: "R1.L06", at: "S5" },
  { owner: "R1.L06", at: "S6" },
  { owner: "J3.L05", at: "S3" },
  { owner: "J3.L05", at: "S4" },
  { owner: "J3.L05", at: "S6" },
  { owner: "A2.L07", at: "S4" },
  { owner: "A2.L07", at: "S6" },
  { owner: "A2.L08", at: "S4" },
  { owner: "A2.L08", at: "S6" },
  { owner: "A2.L09", at: "S4" },
  { owner: "A2.L09", at: "S5" },
  { owner: "A2.L09", at: "S6" },
  { owner: "A2.L09", at: "S7" },
  // New graded steps in existing lessons.
  { owner: "U06.L08", at: "S8" },
  { owner: "U07.L01", at: "S9" },
  { owner: "U07.L10", at: "S5" },
  { owner: "U09.L04", at: "S9" },
  { owner: "A1.L06", at: "S8" },
  { owner: "A2.L04", at: "S8" },
  { owner: "A2.L05", at: "S8" },
];
