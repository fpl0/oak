// Oak 2.0 fidelity pins for U07.L11 Turn It Around (docs/oak2/PLAN.md §2 rule 4; DeSantis, "Note Transformations").
// The book's points: an inversion turns the motif's moves over (each step up becomes the same step down), a rotation
// starts the motif's pitch order from a later note while the rhythm stays, and a time shift moves the whole motif
// by one amount of time. Pieces that look like the transformation (backwards, the extreme notes swapped, the rhythm
// moved, two different offsets) must fail; the transformation reached another way must pass.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(92/4)\n\n";
const MOTIF = "0 2 4@2 3 1 ~ ~";
const mel = (p: string) => `mel: n("${p}").scale("C4:major").s("piano")`;
const vox = (p: string, chain = "") => `vox: n("${p}")${chain}.scale("C4:major").s("rhodes").gain(.7)`;
const pair = (copy: string, chain = "", motif = MOTIF) => `${T}${mel(motif)}\n${vox(copy, chain)}`;

export default [
  // S4: upside down.
  {
    owner: "U07.L11",
    at: "S4",
    name: ".rev() of the motif: backwards, not upside down",
    kind: "book-miss",
    expect: "fail",
    code: pair(MOTIF, "", MOTIF).replace(`vox: n("${MOTIF}")`, `vox: n("${MOTIF}").rev()`),
  },
  {
    owner: "U07.L11",
    at: "S4",
    name: "only the motif's highest and lowest notes swapped: the upside-down look, the other moves kept",
    kind: "book-miss",
    expect: "fail",
    says: "not yet. Make the copied tune move the opposite way around one fixed centre",
    code: pair("4 2 0@2 3 1 ~ ~"),
  },
  {
    owner: "U07.L11",
    at: "S4",
    name: "mirrored around the motif's first note instead of its middle (degree sum 0)",
    kind: "book-other-way",
    expect: "pass",
    code: pair("0 -2 -4@2 -3 -1 ~ ~"),
  },
  {
    owner: "U07.L11",
    at: "S4",
    name: "mirrored around a note above the motif (degree sum 10), on a lower scale",
    kind: "book-other-way",
    expect: "pass",
    code: `${T}${mel(MOTIF)}\nvox: n("10 8 6@2 7 9 ~ ~").scale("C3:major").s("rhodes").gain(.7)`,
  },
  // S6: rotation.
  {
    owner: "U07.L11",
    at: "S6",
    name: "the motif moved later by one note's length: the order kept, the rhythm moved",
    kind: "book-miss",
    expect: "fail",
    says: "not yet. Keep the note starts in vox aligned with the source",
    code: pair("~ 0 2 4@2 3 1 ~"),
  },
  {
    owner: "U07.L11",
    at: "S6",
    name: "the rotated notes with the motif's rhythm turned round (.rev() on the rotation)",
    kind: "book-miss",
    expect: "fail",
    code: pair("4 3 1@2 0 2 ~ ~", "").replace('vox: n("4 3 1@2 0 2 ~ ~")', 'vox: n("4 3 1@2 0 2 ~ ~").rev()'),
  },
  {
    owner: "U07.L11",
    at: "S6",
    name: "rotation from the second note",
    kind: "book-other-way",
    expect: "pass",
    code: pair("2 4 3@2 1 0 ~ ~"),
  },
  {
    owner: "U07.L11",
    at: "S6",
    name: "rotation from the fourth note",
    kind: "book-other-way",
    expect: "pass",
    code: pair("3 1 0@2 2 4 ~ ~"),
  },
  // S7: the Make, time shift.
  {
    owner: "U07.L11",
    at: "S7",
    name: "the copy delayed by a whole loop: offset 0, it sings with the motif",
    kind: "book-miss",
    expect: "fail",
    code: pair(MOTIF),
  },
  {
    owner: "U07.L11",
    at: "S7",
    name: "a copy with two different offsets (an eighth, then a quarter)",
    kind: "book-miss",
    expect: "fail",
    code: pair("~ 0 2 4@2 ~ 3 1"),
  },
  {
    owner: "U07.L11",
    at: "S7",
    name: "a quarter-note shift",
    kind: "book-other-way",
    expect: "pass",
    code: pair("~ ~ 0 2 4@2 3 1"),
  },
  {
    owner: "U07.L11",
    at: "S7",
    name: "an eighth-note shift of a motif of the learner's own",
    kind: "book-other-way",
    expect: "pass",
    code: pair("~ 2 ~ 4 2 1 0@2", "", "2 ~ 4 2 1 0@2 ~"),
  },
  {
    owner: "U07.L11",
    at: "S7",
    name: "a lint pin: .late() is locked until U13.L01, so the shift by .late(1/8) fails the lint",
    kind: "extra",
    expect: "fail",
    says: "`late` unlocks in U13.L01",
    code: pair(MOTIF, "").replace(".gain(.7)", ".late(1/8).gain(.7)"),
  },
] satisfies Oak2Pin[];
