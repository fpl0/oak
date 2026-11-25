// U09.L07 Carve It: fidelity pins (docs/oak2/PLAN.md §2 rule 4). The book's points (DeSantis, "Arranging as a
// Subtractive Process", "Fuzzy Boundaries", "Unique Events"): sections made by taking away from one full loop; a
// seam where only some parts move off the bar line; a moment heard once among things that come back. A piece that
// keeps the surface and misses the point (a build that adds new notes, every part cut the same, every part moving by
// the same two beats, a whole-bar move, a whole new section, the "once" bar in both verses) must fail; the point
// reached another way (thinning notes, a part carrying on past the seam, the moment in a chorus) must pass.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(100/4)\n\n";
const song = (consts: string[], tracks: string[]) => `${T}${consts.join("\n")}\n\n${tracks.join("\n")}`;
const LOOP = 'chord("<C Am F G>").voicing()';
const ROOTS = 'n("<[0 ~ 0 0] [5 ~ 5 5] [3 ~ 3 3] [4 ~ 4 4]>").scale("C2:major")';
const THIN_ROOTS = 'n("<[0 ~ ~ ~] [5 ~ ~ ~] [3 ~ ~ ~] [4 ~ ~ ~]>").scale("C2:major")';
const TUNE = 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")';
const SECTIONS = ["Intro", "Verse", "Chorus", "Outro"] as const;
type Section = (typeof SECTIONS)[number];
type Carve = Partial<Record<Section, string | null>>;
const TAILS: Record<string, string> = {
  chords: '.s("piano")',
  bass: '.s("ebass").lpf(600)',
  mel: '.s("piano")',
};
const FULL: Record<string, string> = { chords: LOOP, bass: ROOTS, mel: TUNE };

/** Chords, bass and tune over intro, verse, chorus and outro; `null` is `silence`, a string replaces the loop. */
const carved = (o: Partial<Record<"chords" | "bass" | "mel", Carve>>, before: string[] = []) => {
  const consts: string[] = [];
  const tracks: string[] = [...before];
  for (const label of ["chords", "bass", "mel"] as const) {
    const by = o[label] ?? {};
    const entries = SECTIONS.map((sec) => {
      const v = by[sec];
      if (v === null) return "[4, silence]";
      consts.push(`const ${label}${sec} = ${v ?? FULL[label]}`);
      return `[4, ${label}${sec}]`;
    });
    tracks.push(`${label}: arrange(${entries.join(", ")})${TAILS[label]}`);
  }
  return song(consts, tracks);
};
/** The lesson's carve, and S5's seam piece: hats of its own over a steady kick and snare. */
const CARVE = { bass: { Intro: null, Outro: null }, mel: { Intro: null, Verse: null } };
const seam = (hatsVerse: string, hatsChorus = 's("[hh oh]*4").gain(.4)') =>
  carved(CARVE, [
    'drums: s("bd ~ sd ~ bd ~ sd ~").gain(.8)',
    `hats: arrange([4, silence], [4, ${hatsVerse}], [4, ${hatsChorus}], [4, silence])`,
  ]);

/** S6's song: verse, chorus, verse, chorus, with drums; the third and fourth sections' drums as given. */
const VC = [
  'const chordsVerse = chord("<C Am F G>").voicing()',
  'const chordsChorus = chord("<F G C C>").voicing()',
  'const bassVerse = n("<0 5 3 4>").scale("C2:major")',
  'const bassChorus = n("<[3 3 3 3] [4 4 4 4] [0 0 0 0] [0 0 0 0]>").scale("C2:major")',
  `const melVerse = ${TUNE}`,
  'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")',
  'const drumsVerse = s("bd hh sd hh bd hh sd hh").gain(".8 .4 .8 .4 .8 .4 .8 .4")',
  'const drumsChorus = s("bd hh sd oh bd hh sd oh").gain(".8 .4 .8 .4 .8 .4 .8 .4")',
];
const FILL = "[bd hh sd hh sd sd sd sd]";
const vc = (third: string, fourth: string, more: string[] = []) =>
  song(
    [...VC, ...more],
    [
      `drums: arrange([4, drumsVerse], [4, drumsChorus], [4, ${third}], [4, ${fourth}])`,
      'chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus]).s("piano")',
      'bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus]).s("ebass").lpf(600)',
      'mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus]).s("piano")',
    ],
  );

const PINS: Oak2Pin[] = [
  // S4: carve by deleting only.
  {
    owner: "U09.L07",
    at: "S4",
    name: "an additive build: the verse plays a bass line the chorus never plays",
    kind: "book-miss",
    expect: "fail",
    says: "The fullest section has every part",
    code: carved({
      bass: {
        Intro: null,
        Verse: 'n("<[0 2 4 2] [5 4 2 0] [3 5 3 1] [4 ~ 6 4]>").scale("C2:major")',
        Outro: null,
      },
      mel: { Intro: null, Verse: null },
    }),
  },
  {
    owner: "U09.L07",
    at: "S4",
    name: "every section carved the same: the tune out of all four",
    kind: "book-miss",
    expect: "fail",
    code: carved({ mel: { Intro: null, Verse: null, Chorus: null, Outro: null } }),
  },
  {
    owner: "U09.L07",
    at: "S4",
    name: "carved by thinning notes: the bass on beat 1 in the intro and outro, the tune out of the verse",
    kind: "book-other-way",
    expect: "pass",
    code: carved({ bass: { Intro: THIN_ROOTS, Outro: THIN_ROOTS }, mel: { Verse: null } }),
  },
  // S5: a fuzzy boundary.
  {
    owner: "U09.L07",
    at: "S5",
    name: "the hats out for the whole bar before the chorus: a move on the bar line",
    kind: "book-miss",
    expect: "fail",
    says: "At one change of section, some parts but not all change a beat or more off the bar line",
    code: seam('s("<hh*8 hh*8 hh*8 ~>").gain(.4)'),
  },
  {
    owner: "U09.L07",
    at: "S5",
    name: "every part stops two beats early together: the seam only moved",
    kind: "book-miss",
    expect: "fail",
    code: song(
      [
        'const drumsVerse = s("<[bd ~ sd ~ bd ~ sd ~]!3 [bd ~ sd ~ ~ ~ ~ ~]>")',
        'const drumsChorus = s("bd ~ sd ~ bd ~ sd ~")',
        'const hatsVerse = s("<hh*8 hh*8 hh*8 [hh*4 ~]>").gain(.4)',
        'const hatsChorus = s("[hh oh]*4").gain(.4)',
        'const bassVerse = n("<[0 0 0 0]!3 [0 0 ~ ~]>").scale("C2:major")',
        'const bassChorus = n("[3 3 3 3]").scale("C2:major")',
      ],
      [
        "drums: arrange([4, drumsVerse], [4, drumsChorus])",
        "hats: arrange([4, hatsVerse], [4, hatsChorus])",
        'bass: arrange([4, bassVerse], [4, bassChorus]).s("ebass").lpf(600)',
      ],
    ),
  },
  {
    owner: "U09.L07",
    at: "S5",
    name: "the hats carry the verse's beat two beats into the chorus",
    kind: "book-other-way",
    expect: "pass",
    code: seam('s("hh*8").gain(.4)', 's("<[hh*4 [hh oh]*2] [hh oh]*4 [hh oh]*4 [hh oh]*4>").gain(.4)'),
  },
  // S6: one moment heard once.
  {
    owner: "U09.L07",
    at: "S6",
    name: "a whole new section heard once: a bridge in place of the second verse",
    kind: "book-miss",
    expect: "fail",
    says: "One bar of one part is heard only once, inside a section that comes back",
    code: song(
      [
        ...VC,
        'const chordsBridge = chord("<F Em Dm G>").voicing()',
        'const bassBridge = n("<3 2 1 4>").scale("C2:major")',
        'const melBridge = n("<[5 ~ 5 7] [6 ~ 4 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
      ],
      [
        "drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse], [4, drumsChorus])",
        'chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsBridge], [4, chordsChorus]).s("piano")',
        'bass: arrange([4, bassVerse], [4, bassChorus], [4, bassBridge], [4, bassChorus]).s("ebass").lpf(600)',
        'mel: arrange([4, melVerse], [4, melChorus], [4, melBridge], [4, melChorus]).s("piano")',
      ],
    ),
  },
  {
    owner: "U09.L07",
    at: "S6",
    name: "the fill copied into both verses",
    kind: "book-miss",
    expect: "fail",
    code: vc("drumsVerse2", "drumsChorus", [
      `const drumsVerse2 = s("<[bd hh sd hh bd hh sd hh]!3 ${FILL}>").gain(.8)`,
    ]).replace(
      "arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse2]",
      "arrange([4, drumsVerse2], [4, drumsChorus], [4, drumsVerse2]",
    ),
  },
  {
    owner: "U09.L07",
    at: "S6",
    name: "a fill in the second chorus's last bar, once",
    kind: "book-other-way",
    expect: "pass",
    code: vc("drumsVerse", "drumsChorus2", [
      `const drumsChorus2 = s("<[bd hh sd oh bd hh sd oh]!3 ${FILL}>").gain(.8)`,
    ]),
  },
  // S7, the Make: carve the song.
  {
    owner: "U09.L07",
    at: "S7",
    name: "an additive build: a new tune in the intro the chorus never plays",
    kind: "book-miss",
    expect: "fail",
    says: "The fullest section has every part",
    code: carved({
      bass: { Intro: null },
      mel: { Intro: 'n("<[9 ~ 7 ~] [7 ~ 5 ~] [8 ~ 6 ~] [6 ~ ~ ~]>").scale("C4:major")' },
    }),
  },
  {
    owner: "U09.L07",
    at: "S7",
    name: "every section loses the same part, so all four still sound the same",
    kind: "book-miss",
    expect: "fail",
    code: carved({ bass: { Intro: null, Verse: null, Chorus: null, Outro: null } }),
  },
  {
    owner: "U09.L07",
    at: "S7",
    name: "carved mostly by masking bars and thinning notes; only the tune rests for a whole section",
    kind: "book-other-way",
    expect: "pass",
    code: carved({
      chords: { Intro: `${LOOP}.mask("<1 0 1 0>")` },
      bass: { Intro: THIN_ROOTS, Verse: THIN_ROOTS },
      mel: { Intro: null, Verse: `${TUNE}.mask("<0 0 1 1>")` },
    }),
  },
];

export default PINS;
