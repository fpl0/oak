// Oak 2.0 fidelity pins for U06.L08 S8 "Busy notes, slow chords" (docs/oak2/PLAN.md §2 rule 4; DeSantis, "Harmonic
// Rhythm"). The book's point: the chords' pace is set apart from the other parts' rhythm, so a busy line can run over
// slow chords. Slowing everything (the tune too) keeps the surface, half-pace chords, and misses it; the breakdown
// written another way keeps it.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(100/4)\n\n";
const BUSY = "<[4 2 0 2 4 2 0 2] [5 4 2 0 5 4 2 0]>";
const TWICE = "[0 4] [5 3] [0 4] [5 3]";
const chords = (roots: string, chain = "") =>
  `chords: n("${roots}").add(n("[0,2,4]")).scale("C3:major")${chain}.s("piano")`;
const mel = (chain = "") => `mel: n("${BUSY}").scale("C4:major")${chain}.s("piano")`;

export default [
  {
    owner: "U06.L08",
    at: "S8",
    name: ".slow(2) on the whole loop: the chords at half pace, but the tune slowed with them",
    kind: "book-miss",
    expect: "fail",
    code: `${T}${chords(`<${TWICE}>`, ".slow(2)")}\n${mel(".slow(2)")}`,
  },
  {
    owner: "U06.L08",
    at: "S8",
    name: "the breakdown made by halving the tempo: everything slower, the chords' pace per bar unchanged",
    kind: "book-miss",
    expect: "fail",
    code: `setcpm(50/4)\n\n${chords(`<${TWICE} ${TWICE}>`)}\n${mel()}`,
  },
  {
    owner: "U06.L08",
    at: "S8",
    name: "the breakdown chords stretched with @2 over two bars each",
    kind: "book-other-way",
    expect: "pass",
    code: `${T}${chords(`<${TWICE} [0 4]@2 [5 3]@2>`)}\n${mel()}`,
  },
  {
    owner: "U06.L08",
    at: "S8",
    name: "the breakdown chords written one item a bar inside < >",
    kind: "book-other-way",
    expect: "pass",
    code: `${T}${chords(`<${TWICE} 0 4 5 3>`)}\n${mel()}`,
  },
] satisfies Oak2Pin[];
