// U09.L06 Endings: fidelity pins (docs/oak2/PLAN.md §2 rule 4). The book's point (DeSantis, "Three Ways to End",
// "Short Loops as Endings"): the end is written for the end. A piece that only looks like an ending (parts that drop
// out and come back, a loop played faster, a song that runs out on a stop bar it played all along, one part faded
// over a band at full level) must fail; an ending reached another way (parts leaving halfway through bars, the first
// half looped instead of the second, V to I on a new last bar, a fading loop) must pass.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(100/4)\n\n";
const song = (consts: string[], tracks: string[]) => `${T}${consts.join("\n")}\n\n${tracks.join("\n")}`;
const LOOP = 'chord("<C Am F G>").voicing()';
const ROOTS = 'n("<0 5 3 4>").scale("C2:major")';
const MEL_VERSE = 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")';
const CLOSE_CHORDS = 'chord("<F G C C>").voicing()';
const CLOSE_ROOTS = 'n("<3 4 0 0>").scale("C2:major")';
const CLOSE_MEL = 'n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] [0 ~ ~ ~]>").scale("C4:major")';
const LEVELS = '.gain("[.8 .4]*4")';
const BEAT = `s("bd hh sd hh bd hh sd hh")${LEVELS}`;
const LAST_KICK = `s("<[bd hh sd hh bd hh sd hh]!3 [bd ~ ~ ~]>")${LEVELS}`;

/** S4's song: chords and drums from bar 1, the bass at bar 2, the tune at bar 3; the outro's parts as given. */
const s4 = (melOutro: string, bassOutro: string, chordsOutro: string) =>
  song(
    [
      `const chordsIntro = ${LOOP}`,
      `const chordsVerse = ${LOOP}`,
      `const chordsOutro = ${chordsOutro}`,
      `const bassIntro = ${ROOTS}.mask("<0 1 1 1>")`,
      `const bassVerse = ${ROOTS}`,
      `const bassOutro = ${bassOutro}`,
      'const melIntro = n("<~ ~ [7 ~ 4 2] [0 ~ 2 ~]>").scale("C4:major")',
      `const melVerse = ${MEL_VERSE}`,
      `const melOutro = ${melOutro}`,
      `const drumsIntro = ${BEAT}`,
      `const drumsVerse = ${BEAT}`,
      `const drumsOutro = ${LAST_KICK}`,
    ],
    [
      "drums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsOutro])",
      'chords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsOutro]).s("piano")',
      'bass: arrange([4, bassIntro], [4, bassVerse], [4, bassOutro]).s("ebass").lpf(600)',
      'mel: arrange([4, melIntro], [4, melVerse], [4, melOutro]).s("piano")',
    ],
  );

/** S5's song: IV V I I, then the outro's tune over a C on every beat. */
const s5 = (melOutro: string) =>
  song(
    [
      'const chordsVerse = chord("<F G C C>").voicing().struct("x x x x")',
      'const chordsOutro = chord("C").voicing().struct("x x x x")',
      'const melVerse = n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] [4 2 1 0]>")',
      `const melOutro = n("${melOutro}")`,
    ],
    [
      'hats: s("hh*8").gain(.4)',
      'chords: arrange([4, chordsVerse], [4, chordsOutro]).s("piano").gain(.7)',
      'mel: arrange([4, melVerse], [4, melOutro]).scale("C4:major").s("piano")',
    ],
  );

/** The Make's song: the intro of Arranging in Code, the verse, an eight-bar outro as given. */
const make = (o: { chords: string; bass: string; mel: string; drums: string }, verse = {}) => {
  const v = { chords: LOOP, bass: ROOTS, mel: MEL_VERSE, drums: BEAT, ...verse };
  return song(
    [
      `const chordsIntro = ${LOOP}.mask("<0 0 1 1>")`,
      `const chordsVerse = ${v.chords}`,
      `const chordsOutro = ${o.chords}`,
      `const bassIntro = ${ROOTS}.mask("<0 1 1 1>")`,
      `const bassVerse = ${v.bass}`,
      `const bassOutro = ${o.bass}`,
      'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
      `const melVerse = ${v.mel}`,
      `const melOutro = ${o.mel}`,
      `const drumsIntro = ${BEAT}`,
      `const drumsVerse = ${v.drums}`,
      `const drumsOutro = ${o.drums}`,
    ],
    [
      "drums: arrange([4, drumsIntro], [4, drumsVerse], [8, drumsOutro])",
      'chords: arrange([4, chordsIntro], [4, chordsVerse], [8, chordsOutro]).s("piano")',
      'bass: arrange([4, bassIntro], [4, bassVerse], [8, bassOutro]).s("ebass").lpf(600)',
      'mel: arrange([4, melIntro], [4, melVerse], [8, melOutro]).s("piano")',
    ],
  );
};
const fade = (to: string) => `.gain(saw.range(1, ${to}).slow(8))`;

/** A verse whose last bar is a stop: one hit with a crash, then three beats of rest. */
const STOP_VERSE = {
  chords: 'chord("<C Am F [G ~ ~ ~]>").voicing()',
  bass: 'n("<0 5 3 [4 ~ ~ ~]>").scale("C2:major")',
  mel: 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
  drums: `s("<[bd hh sd hh bd hh sd hh]!3 [[bd,cr] ~ ~ ~]>")${LEVELS}`,
};

const PINS: Oak2Pin[] = [
  // S4: leave in the reverse order.
  {
    owner: "U09.L06",
    at: "S4",
    name: "the tune drops out and comes back: no part has left for good",
    kind: "book-miss",
    expect: "fail",
    says: "In the last section parts stop before the end in at least two different bars",
    code: s4(
      `${CLOSE_MEL}.mask("<1 0 1 0>")`,
      `${CLOSE_ROOTS}.mask("<1 1 0 0>")`,
      `${CLOSE_CHORDS}.mask("<1 1 1 0>")`,
    ),
  },
  {
    owner: "U09.L06",
    at: "S4",
    name: "each part leaves halfway through a bar, the tune first",
    kind: "book-other-way",
    expect: "pass",
    code: s4(
      'n("<[5 ~ ~ ~] ~ ~ ~>").scale("C4:major")',
      'n("<3 [4 ~] ~ ~>").scale("C2:major")',
      'chord("<F G [C ~] ~>").voicing()',
    ),
  },
  // S5: shrink the loop.
  {
    owner: "U09.L06",
    at: "S5",
    name: "faster, not shorter: the whole bar squeezed into a half and a quarter",
    kind: "book-miss",
    expect: "fail",
    says: "The outro loops a piece of the last bar, and the loop gets shorter: the last section",
    code: s5("<[4 2 1 0] [4 2 1 0] [[4 2 1 0]*2] [[4 2 1 0]*4]>"),
  },
  {
    owner: "U09.L06",
    at: "S5",
    name: "shorter loops of notes the phrase never played",
    kind: "book-miss",
    expect: "fail",
    code: s5("<[4 2 1 0] [4 2 1 0] [5 3 5 3] [6 6 6 6]>"),
  },
  {
    owner: "U09.L06",
    at: "S5",
    name: "the first half looped instead of the second",
    kind: "book-other-way",
    expect: "pass",
    code: s5("<[4 2 1 0] [4 2 1 0] [4 2 4 2] [4 4 4 4]>"),
  },
  // S7, the Make: end on purpose.
  {
    owner: "U09.L06",
    at: "S7",
    name: "no outro: the verse loop plays on and the song just stops",
    kind: "book-miss",
    expect: "fail",
    says: "The outro ends on purpose",
    code: song(
      [
        `const chordsIntro = ${LOOP}.mask("<0 0 1 1>")`,
        `const chordsVerse = ${LOOP}`,
        `const bassIntro = ${ROOTS}.mask("<0 1 1 1>")`,
        `const bassVerse = ${ROOTS}`,
        'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
        `const melVerse = ${MEL_VERSE}`,
        `const drumsIntro = ${BEAT}`,
        `const drumsVerse = ${BEAT}`,
      ],
      [
        "drums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsVerse])",
        'chords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsVerse]).s("piano")',
        'bass: arrange([4, bassIntro], [4, bassVerse], [4, bassVerse]).s("ebass").lpf(600)',
        'mel: arrange([4, melIntro], [4, melVerse], [4, melVerse]).s("piano")',
      ],
    ),
  },
  {
    owner: "U09.L06",
    at: "S7",
    name: "the last bar is a stop with a crash, but every verse already ended on it",
    kind: "book-miss",
    expect: "fail",
    code: make(STOP_VERSE, STOP_VERSE),
  },
  {
    owner: "U09.L06",
    at: "S7",
    name: "only the tune fades; the band plays on at full level",
    kind: "book-miss",
    expect: "fail",
    code: make({ chords: LOOP, bass: ROOTS, mel: `${MEL_VERSE}${fade(".1")}`, drums: BEAT }),
  },
  {
    owner: "U09.L06",
    at: "S7",
    name: "V to I on a new last bar, every part playing to the end",
    kind: "book-other-way",
    expect: "pass",
    code: make({
      chords: 'chord("<C Am F G F G G C>").voicing()',
      bass: 'n("<0 5 3 4 3 4 4 0>").scale("C2:major")',
      mel: 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~] [5 ~ 3 ~] [6 ~ 4 ~] [8 ~ 6 4] [7 ~ ~ ~]>").scale("C4:major")',
      drums: BEAT,
    }),
  },
  {
    owner: "U09.L06",
    at: "S7",
    name: "the last bar on C looped while everything fades",
    kind: "book-other-way",
    expect: "pass",
    code: make({
      chords: `chord("C").voicing()${fade(".1")}`,
      bass: `n("0").scale("C2:major")${fade(".1")}`,
      mel: `n("[7 ~ 4 2]").scale("C4:major")${fade(".1")}`,
      drums: `${BEAT}${fade(".1")}`,
    }),
  },
];

// W5 release review: the fade to silence (C5) and the groove cut off mid-bar (C6), pinned after the rule was fixed.
const W5: Oak2Pin[] = [
  {
    owner: "U09.L06",
    at: "S7",
    name: "W5: the verse looped while every part fades to silence (its last notes under the mix)",
    kind: "book-other-way",
    expect: "pass",
    code: make({
      chords: `${LOOP}${fade("0")}`,
      bass: `${ROOTS}${fade("0")}`,
      mel: `${MEL_VERSE}${fade("0")}`,
      drums: `${BEAT}${fade("0")}`,
    }),
  },
  {
    owner: "U09.L06",
    at: "S7",
    name: "W5: the verse groove cut off at beat 3 of the last bar, then silence: a stop, not a last hit",
    kind: "book-miss",
    expect: "fail",
    says: "The outro ends on purpose",
    code: make({
      chords: 'chord("<C Am F G C Am F [G G G ~]>").voicing()',
      bass: 'n("<0 5 3 4 0 5 3 [4 4 4 ~]>").scale("C2:major")',
      mel: 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~] [7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ 4 ~]>").scale("C4:major")',
      drums: `s("<[bd hh sd hh bd hh sd hh]!7 [bd hh sd hh bd hh ~ ~]>")${LEVELS}`,
    }),
  },
];

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "U09.L06",
    at: "S4",
    name: "X14: tune, bass and chords all stop after the same bar while the drums play on",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(100/4)\n\nconst chordsIntro = chord("<C Am F G>").voicing()\nconst chordsVerse = chord("<C Am F G>").voicing()\nconst chordsOutro = chord("<F G C C>").voicing().mask("<1 1 0 0>")\nconst bassIntro = n("<0 5 3 4>").scale("C2:major").mask("<0 1 1 1>")\nconst bassVerse = n("<0 5 3 4>").scale("C2:major")\nconst bassOutro = n("<3 4 0 0>").scale("C2:major").mask("<1 1 0 0>")\nconst melIntro = n("<~ ~ [7 ~ 4 2] [0 ~ 2 ~]>").scale("C4:major")\nconst melVerse = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")\nconst melOutro = n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] [0 ~ ~ ~]>").scale("C4:major").mask("<1 1 0 0>")\nconst drumsIntro = s("bd hh sd hh bd hh sd hh").gain("[.8 .4]*4")\nconst drumsVerse = s("bd hh sd hh bd hh sd hh").gain("[.8 .4]*4")\nconst drumsOutro = s("<[bd hh sd hh bd hh sd hh]!3 [bd ~ ~ ~]>").gain("[.8 .4]*4")\n\ndrums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsOutro])\nchords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsOutro]).s("piano")\nbass: arrange([4, bassIntro], [4, bassVerse], [4, bassOutro]).s("ebass").lpf(600)\nmel: arrange([4, melIntro], [4, melVerse], [4, melOutro]).s("piano")\n',
  },
  {
    owner: "U09.L06",
    at: "S4",
    name: "X14: tune and bass stop together, the chords a bar later: a two-stage exit counts (Oak's call, decisions)",
    kind: "extra",
    expect: "pass",
    code: 'setcpm(100/4)\n\nconst chordsIntro = chord("<C Am F G>").voicing()\nconst chordsVerse = chordsIntro\nconst chordsOutro = chord("<F G C C>").voicing().mask("<1 1 1 0>")\nconst bassIntro = n("<0 5 3 4>").scale("C2:major").mask("<0 1 1 1>")\nconst bassVerse = n("<0 5 3 4>").scale("C2:major")\nconst bassOutro = n("<3 4 0 0>").scale("C2:major").mask("<1 0 0 0>")\nconst melIntro = n("<~ ~ [7 ~ 4 2] [0 ~ 2 ~]>").scale("C4:major")\nconst melVerse = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")\nconst melOutro = n("<[5 ~ 3 ~] [6 ~ 4 ~] [7 ~ 4 2] [0 ~ ~ ~]>").scale("C4:major").mask("<1 0 0 0>")\nconst drumsIntro = s("bd hh sd hh bd hh sd hh").gain("[.8 .4]*4")\nconst drumsVerse = drumsIntro\nconst drumsOutro = s("<[bd hh sd hh bd hh sd hh]!3 [bd ~ ~ ~]>").gain("[.8 .4]*4")\n\ndrums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsOutro])\nbass: arrange([4, bassIntro], [4, bassVerse], [4, bassOutro]).s("ebass").lpf(600)\nchords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsOutro]).s("piano")\nmel: arrange([4, melIntro], [4, melVerse], [4, melOutro]).s("piano")\n',
  },
];

export default [...PINS, ...X14, ...W5];
