// Fidelity pins for J3.L05 Fourths (docs/oak2/PLAN.md §2 rule 4). The book's point: a chord stacked in 4ths has no
// name of its own, so the bass under it decides what it is called; over its lowest note a stack of 4ths reads as a
// minor 11th. A stack of 3rds keeps the surface (four Rhodes notes over D) and misses the 4ths; a bass that names the
// chord only on a weak beat, with another note under it on the downbeat, misses the bass's job. A three-note stack, a
// stack built by adding 5 half steps in code, or a bass an octave lower get the point another way.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(132/4)\n\n";
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
/** The comping rhythm of J3.L01: beat 1 and the "and" of 2, swung. */
const COMP = '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes")';
const LOOP_BASS = 'bass: note("<d2 d2 e2 d2>").s("upright")';
const chords = (stacks: string, tail = COMP) => `chords: note("<${stacks}>")${tail}`;
const s3 = (line: string) => `${T}${RIDE}\n${LOOP_BASS}\n${line}`;
/** S4: one stack of 4ths on D held through each bar; the learner's bass decides its name. */
const HELD = 'chords: note("[d3,g3,c4,f4]").s("rhodes")';
const s4 = (bass: string) => `${T}${RIDE}\nbass: note("${bass}").s("upright")\n${HELD}`;
const make = (stacks: string, bass: string, tail = COMP) =>
  `${T}${chords(stacks, tail)}\nbass: note("<${bass}>").s("upright")`;

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "J3.L05",
    at: "S6",
    name: "X14: G (or A) under three quarters of every bar, four short Ds (or Es) after",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(132/4)\n\nbass: note("<[g1@12 d2 d2 d2 d2] [g1@12 d2 d2 d2 d2] [a1@12 e2 e2 e2 e2] [g1@12 d2 d2 d2 d2]>")\n  .s("upright")\nchords: note("<[d3,g3,c4,f4] [d3,g3,c4,f4] [e3,a3,d4,g4] [d3,g3,c4,f4]>")\n  .s("rhodes")\n',
  },
  {
    owner: "J3.L05",
    at: "S4",
    name: "X14: D under three beats, G on beat 4 (not all through the bar)",
    kind: "book-miss",
    expect: "fail",
    code: s4("[d2 d2 d2 g1]"),
  },
];

export default [
  // ---- S3: build the stacks ----------------------------------------------------------------------------------
  {
    owner: "J3.L05",
    at: "S3",
    name: "a stack of 3rds on each given note: four Rhodes notes over the bass, not 4ths",
    kind: "book-miss",
    expect: "fail",
    code: s3(chords("[d3,f3,a3,c4] [d3,f3,a3,c4] [e3,g3,b3,d4] [d3,f3,a3,c4]")),
  },
  {
    owner: "J3.L05",
    at: "S3",
    name: "the minor 11th chords from the dictionary with .voicing(): the name is written, the 4ths are not",
    kind: "book-miss",
    expect: "fail",
    code: s3(`chords: chord("<Dm11 Dm11 Em11 Dm11>").voicing()${COMP}`),
  },
  {
    owner: "J3.L05",
    at: "S3",
    name: "the 4ths added in code: 0, 5, 10 and 15 half steps on each given note",
    kind: "book-other-way",
    expect: "pass",
    code: s3(`chords: note("<d3 d3 e3 d3>").add(note("[0,5,10,15]"))${COMP}`),
  },
  // ---- S4: the bass names it ---------------------------------------------------------------------------------
  {
    owner: "J3.L05",
    at: "S4",
    name: "D only on beat 3, G under the stack on beat 1",
    kind: "book-miss",
    expect: "fail",
    says: "Not yet",
    code: s4("[g1 d2]"),
  },
  {
    owner: "J3.L05",
    at: "S4",
    name: "the bass on D an octave lower",
    kind: "book-other-way",
    expect: "pass",
    code: s4("d1"),
  },
  // ---- S6: the Make ------------------------------------------------------------------------------------------
  {
    owner: "J3.L05",
    at: "S6",
    name: "the stacks of 4ths kept, the bass a 4th under each (G7sus, A7sus): no minor 11th",
    kind: "book-miss",
    expect: "fail",
    code: make("[d3,g3,c4,f4] [d3,g3,c4,f4] [e3,a3,d4,g4] [d3,g3,c4,f4]", "g1 g1 a1 g1"),
  },
  {
    owner: "J3.L05",
    at: "S6",
    name: "the stacks held a bar each, the right bass only on beat 3 with a 4th under them on beat 1",
    kind: "book-miss",
    expect: "fail",
    code: make(
      "[d3,g3,c4,f4] [d3,g3,c4,f4] [e3,a3,d4,g4] [d3,g3,c4,f4]",
      "[g1 d2] [g1 d2] [a1 e2] [g1 d2]",
      '.s("rhodes")',
    ),
  },
  {
    owner: "J3.L05",
    at: "S6",
    name: "another stack of 4ths: three notes, G C F, over D",
    kind: "book-other-way",
    expect: "pass",
    code: make("[g3,c4,f4] [g3,c4,f4] [a3,d4,g4] [g3,c4,f4]", "d2 d2 e2 d2"),
  },
  {
    owner: "J3.L05",
    at: "S6",
    name: "minor 11ths voiced in 3rds: the bass names m11, the chords have no 4ths",
    kind: "book-miss",
    expect: "fail",
    code: make("[f3,a3,c4,e4,g4] [f3,a3,c4,e4,g4] [g3,b3,d4,f#4,a4] [f3,a3,c4,e4,g4]", "d2 d2 e2 d2"),
  },
  {
    owner: "J3.L05",
    at: "S6",
    name: "So What: four 4ths with a 3rd on top",
    kind: "book-other-way",
    expect: "pass",
    code: make("[e3,a3,d4,g4,b4] [e3,a3,d4,g4,b4] [d3,g3,c4,f4,a4] [e3,a3,d4,g4,b4]", "e2 e2 d2 e2"),
  },
  ...X14,
] satisfies Oak2Pin[];
