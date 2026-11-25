// Oak 2.0 fidelity pins for U06.L13 Parallel Chords (docs/oak2/PLAN.md §2 rule 4; DeSantis, "Parallel Harmony"). The
// book's point: one chord shape moved as a block, every note by the same distance, so the chords leave the key.
// A piece that plays the key's own chords, or the right chords re-voiced to stay close, keeps the surface (four
// chords, moving) and misses the point; a shape moved another way (by hand, by octave-equivalent moves, a major
// shape) gets it.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(122/4)\n\n";
const SHAPE = "[c3,eb3,g3,bb3]";

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "U06.L13",
    at: "S6",
    name: "X14: one chord moved only by octaves",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(122/4)\n\nchords: note("[c3,eb3,g3,bb3]").transpose("<0 12 24 12>").s("piano")\n',
  },
  {
    owner: "U06.L13",
    at: "S6",
    name: "X14: the shape an octave up and back, nothing else",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(122/4)\n\nchords: note("[c3,eb3,g3,bb3]").struct("[~ x]*4").transpose("<0 12>").s("rhodes")\n',
  },
];

export default [
  // S4: slide the shape to the target's four heights.
  {
    owner: "U06.L13",
    at: "S4",
    name: "the scale-step version: a degree stack moved in the key, so the shapes change",
    kind: "book-miss",
    expect: "fail",
    code: `${T}chords: n("[0,2,4,6]").add(n("<0 -1 2 3>")).scale("C3:major").s("piano")`,
  },
  {
    owner: "U06.L13",
    at: "S4",
    name: "the right chords, each re-voiced to the inversion nearest the last (voice-led, not parallel)",
    kind: "book-miss",
    expect: "fail",
    says: "Every bar plays the same shape, at three heights or more: not yet. The chord shapes change",
    code: `${T}chords: note("<[c3,eb3,g3,bb3] [bb2,db3,f3,ab3] [bb2,db3,eb3,gb3] [c3,eb3,f3,ab3]>").s("piano")`,
  },
  {
    owner: "U06.L13",
    at: "S4",
    name: "the target's chords by name with .voicing(): the notes move to the nearest place",
    kind: "book-miss",
    expect: "fail",
    code: `${T}chords: chord("<Cm Bbm Ebm Fm>").voicing().s("piano")`,
  },
  {
    owner: "U06.L13",
    at: "S4",
    name: "bar 2 moved up ten half steps instead of down two: the same chord, the same shape",
    kind: "book-other-way",
    expect: "pass",
    code: `${T}chords: note("${SHAPE}").transpose("<0 10 3 5>").s("piano")`,
  },
  {
    owner: "U06.L13",
    at: "S4",
    name: "the four chords written out by hand, an octave up",
    kind: "book-other-way",
    expect: "pass",
    code: `${T}chords: note("<[c4,eb4,g4,bb4] [bb3,db4,f4,ab4] [eb4,gb4,bb4,db5] [f4,ab4,c5,eb5]>").s("rhodes")`,
  },
  // S6: the Make.
  {
    owner: "U06.L13",
    at: "S6",
    name: "the key's own seventh stacks moving: four chords, the shape changes",
    kind: "book-miss",
    expect: "fail",
    code: `${T}chords: n("[0,2,4,6]").add(n("<0 3 4 5>")).scale("C3:major").s("piano")`,
  },
  {
    owner: "U06.L13",
    at: "S6",
    name: "chords by name with .voicing(): the rule's own line says to move the shape by hand",
    kind: "book-miss",
    expect: "fail",
    says: "Move the shape yourself by writing its notes and shifting them together",
    code: `${T}chords: chord("<Cm Fm Ebm Bbm>").voicing().s("rhodes")`,
  },
  {
    owner: "U06.L13",
    at: "S6",
    name: "a major-triad shape moved by half steps by hand",
    kind: "book-other-way",
    expect: "pass",
    code: `${T}chords: note("<[c3,e3,g3] [eb3,g3,bb3] [f3,a3,c4] [eb3,g3,bb3]>").s("piano")`,
  },
  {
    owner: "U06.L13",
    at: "S6",
    name: "a spread shape (root, 5th, 9th) moved with .add(note(…)) and struck in a rhythm",
    kind: "book-other-way",
    expect: "pass",
    code: `${T}chords: note("[c3,g3,d4]").add(note("<0 -2 -4 -5>")).struct("x ~ x x ~ x ~ ~").s("rhodes")`,
  },
  {
    owner: "U06.L13",
    at: "S6",
    name: "a lint pin: a learner's .voicing() is unlocked here and lints clean, so the rule decides",
    kind: "extra",
    expect: "fail",
    says: "Move the shape yourself",
    code: `${T}chords: chord("<C F G>").voicing().s("piano")`,
  },
  ...X14,
] satisfies Oak2Pin[];
