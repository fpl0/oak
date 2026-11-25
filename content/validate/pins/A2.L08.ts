import type { Oak2Pin } from "./types.ts";

// Independent fixtures keep the book's claim separate from the lesson's reference.
const parts = ["hats", "bass", "chords", "mel", "vox"] as const;
type Part = (typeof parts)[number];
const full: Record<Part, string> = {
  hats: 's("hh*8")',
  bass: 'note("<a1 f1 c2 g1>")',
  chords: 'n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")',
  mel: 'n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")',
  vox: 'n("<[~ ~ 0 2] [~ 0 2 ~] [2 ~ ~ 4] [~ 1 ~ -1]>")',
};
const sounds: Record<Part, string> = {
  hats: ".gain(.35)",
  bass: '.s("ebass").lpf(700)',
  chords: '.scale("A3:minor").s("piano").gain(.5)',
  mel: '.scale("A4:minor").s("square").lpf(2000).gain(.5)',
  vox: '.scale("A3:minor").s("strings").gain(.4)',
};
type Section = "Intro" | "Verse" | "Chorus" | "Outro";
const order: Section[] = ["Intro", "Verse", "Chorus", "Outro"];
const song = (changes: Partial<Record<Section, Partial<Record<Part, string>>>>, sequence = order) =>
  `setcpm(90/4)\n\n${order
    .flatMap((section) =>
      parts.map((part) => `const ${part}${section} = ${changes[section]?.[part] ?? full[part]}`),
    )
    .join("\n")}\n\n${parts
    .map(
      (part) =>
        `${part}: arrange(${sequence.map((section) => `[4, ${part}${section}]`).join(", ")})${sounds[part]}`,
    )
    .join("\n")}`;

const ADDITIVE = song({
  Intro: { hats: "silence", chords: "silence", mel: "silence", vox: "silence" },
  Verse: { hats: "silence", mel: 'n("<0 0 0 0>")', vox: "silence" },
  Chorus: { vox: "silence" },
  Outro: { mel: "silence" },
});
// All surviving hits retain their onset and duration; only the intro loses a whole part.
const MOSTLY_ERASED = song({
  Intro: { bass: "silence", hats: 's("hh ~ ~ ~ hh ~ ~ ~")' },
  Verse: { hats: 's("hh ~ hh ~ hh ~ hh ~")' },
  Outro: { hats: 's("hh ~ ~ ~ hh ~ ~ ~")' },
});
const PEAK_FIRST = song(
  {
    Intro: { hats: "silence" },
    Verse: { mel: "silence", vox: "silence" },
    Outro: { hats: "silence", mel: "silence", vox: "silence" },
  },
  ["Chorus", "Intro", "Verse", "Outro"],
);

const NEW_VERSE_NOTE = song({
  Intro: { hats: "silence" },
  Verse: { mel: "silence", vox: "silence", bass: 'note("<a1 f1 d2 g1>")' },
  Outro: { hats: "silence", mel: "silence", vox: "silence" },
});
const THINNED_CHORUS = song({
  Intro: { hats: "silence" },
  Verse: { mel: "silence" },
  Chorus: { vox: "silence" },
  Outro: { hats: "silence", mel: "silence", vox: "silence" },
});

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "A2.L08",
    at: "S4",
    name: "X14: the intro bass plays the chorus bass in another order",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(90/4)\n\nconst hatsChorus = s("hh*8")\nconst bassChorus = note("<a1 f1 c2 g1>")\nconst chordsChorus = n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")\nconst melChorus = n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")\nconst voxChorus = n("<[~ ~ 0 2] [~ 0 2 ~] [2 ~ ~ 4] [~ 1 ~ -1]>")\nconst hatsIntro = silence\nconst bassIntro = note("<g1 c2 f1 a1>")\nconst chordsIntro = chordsChorus\nconst melIntro = melChorus\nconst voxIntro = voxChorus\nconst hatsVerse = hatsChorus\nconst bassVerse = bassChorus\nconst chordsVerse = chordsIntro\nconst melVerse = hatsIntro\nconst voxVerse = hatsIntro\nconst hatsOutro = hatsIntro\nconst bassOutro = bassVerse\nconst chordsOutro = chordsIntro\nconst melOutro = hatsIntro\nconst voxOutro = hatsIntro\n\nhats: arrange([4, hatsIntro], [4, hatsVerse], [4, hatsChorus], [4, hatsOutro]).gain(.35)\nbass: arrange([4, bassIntro], [4, bassVerse], [4, bassChorus], [4, bassOutro]).s("ebass").lpf(700)\nchords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsChorus], [4, chordsOutro])\n  .scale("A3:minor")\n  .s("piano")\n  .gain(.5)\nmel: arrange([4, melIntro], [4, melVerse], [4, melChorus], [4, melOutro])\n  .scale("A4:minor")\n  .s("square")\n  .lpf(2000)\n  .gain(.5)\nvox: arrange([4, voxIntro], [4, voxVerse], [4, voxChorus], [4, voxOutro])\n  .scale("A3:minor")\n  .s("strings")\n  .gain(.4)\n',
  },
  {
    owner: "A2.L08",
    at: "S4",
    name: "X14: the verse chords play the chorus chords backwards",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(90/4)\n\nconst hatsChorus = s("hh*8")\nconst bassChorus = note("<a1 f1 c2 g1>")\nconst chordsChorus = n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")\nconst melChorus = n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")\nconst voxChorus = n("<[~ ~ 0 2] [~ 0 2 ~] [2 ~ ~ 4] [~ 1 ~ -1]>")\nconst hatsIntro = silence\nconst bassIntro = bassChorus.mask("<1 0 1 0>")\nconst chordsIntro = chordsChorus\nconst melIntro = n("<[4 ~ ~ ~] [2 ~ ~ ~] [4 ~ ~ ~] [1 ~ ~ ~]>")\nconst voxIntro = n("<[~ ~ ~ 2] [~ ~ ~ ~] [2 ~ ~ ~] [~ ~ ~ ~]>")\nconst hatsVerse = s("hh ~ hh ~ hh ~ hh ~")\nconst bassVerse = bassChorus\nconst chordsVerse = n("<[-1,1,3] [-5,-3,-1] [-2,0,2] [0,2,4]>")\nconst melVerse = melChorus\nconst voxVerse = n("<[~ ~ 0 ~] [~ 0 ~ ~] [2 ~ ~ ~] [~ 1 ~ ~]>")\nconst hatsOutro = hatsIntro\nconst bassOutro = bassChorus.mask("<1 1 0 0>")\nconst chordsOutro = chordsChorus\nconst melOutro = melIntro\nconst voxOutro = voxIntro\n\nhats: arrange([4, hatsIntro], [4, hatsVerse], [4, hatsChorus], [4, hatsOutro]).gain(.35)\nbass: arrange([4, bassIntro], [4, bassVerse], [4, bassChorus], [4, bassOutro]).s("ebass").lpf(700)\nchords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsChorus], [4, chordsOutro])\n  .scale("A3:minor")\n  .s("piano")\n  .gain(.5)\nmel: arrange([4, melIntro], [4, melVerse], [4, melChorus], [4, melOutro])\n  .scale("A4:minor")\n  .s("square")\n  .lpf(2000)\n  .gain(.5)\nvox: arrange([4, voxIntro], [4, voxVerse], [4, voxChorus], [4, voxOutro])\n  .scale("A3:minor")\n  .s("strings")\n  .gain(.4)\n',
  },
  {
    owner: "A2.L08",
    at: "S4",
    name: "X14: every part kept in every section, thinned or masked",
    kind: "book-other-way",
    expect: "pass",
    code: 'setcpm(90/4)\n\nconst hatsChorus = s("hh*8")\nconst bassChorus = note("<a1 f1 c2 g1>")\nconst chordsChorus = n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")\nconst melChorus = n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")\nconst voxChorus = n("<[~ ~ 0 2] [~ 0 2 ~] [2 ~ ~ 4] [~ 1 ~ -1]>")\nconst hatsIntro = s("hh ~ ~ ~ hh ~ ~ ~")\nconst bassIntro = bassChorus.mask("<1 0 1 0>")\nconst chordsIntro = chordsChorus\nconst melIntro = n("<[4 ~ ~ ~] [2 ~ ~ ~] [4 ~ ~ ~] [1 ~ ~ ~]>")\nconst voxIntro = n("<[~ ~ ~ 2] [~ ~ ~ ~] [2 ~ ~ ~] [~ ~ ~ ~]>")\nconst hatsVerse = s("hh ~ hh ~ hh ~ hh ~")\nconst bassVerse = bassChorus\nconst chordsVerse = chordsChorus.mask("<1 1 1 0>")\nconst melVerse = melChorus\nconst voxVerse = n("<[~ ~ 0 ~] [~ 0 ~ ~] [2 ~ ~ ~] [~ 1 ~ ~]>")\nconst hatsOutro = hatsIntro\nconst bassOutro = bassChorus.mask("<1 1 0 0>")\nconst chordsOutro = chordsChorus\nconst melOutro = melIntro\nconst voxOutro = voxIntro\n\nhats: arrange([4, hatsIntro], [4, hatsVerse], [4, hatsChorus], [4, hatsOutro]).gain(.35)\nbass: arrange([4, bassIntro], [4, bassVerse], [4, bassChorus], [4, bassOutro]).s("ebass").lpf(700)\nchords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsChorus], [4, chordsOutro])\n  .scale("A3:minor")\n  .s("piano")\n  .gain(.5)\nmel: arrange([4, melIntro], [4, melVerse], [4, melChorus], [4, melOutro])\n  .scale("A4:minor")\n  .s("square")\n  .lpf(2000)\n  .gain(.5)\nvox: arrange([4, voxIntro], [4, voxVerse], [4, voxChorus], [4, voxOutro])\n  .scale("A3:minor")\n  .s("strings")\n  .gain(.4)\n',
  },
  {
    owner: "A2.L08",
    at: "S6",
    name: "X14: the intro bass plays the chorus bass in another order",
    kind: "book-miss",
    expect: "fail",
    code: 'setcpm(90/4)\n\nconst hatsChorus = s("hh*8")\nconst bassChorus = note("<a1 f1 c2 g1>")\nconst chordsChorus = n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")\nconst melChorus = n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")\nconst voxChorus = n("<[~ ~ 0 2] [~ 0 2 ~] [2 ~ ~ 4] [~ 1 ~ -1]>")\nconst hatsIntro = silence\nconst bassIntro = note("<g1 c2 f1 a1>")\nconst chordsIntro = chordsChorus\nconst melIntro = melChorus\nconst voxIntro = voxChorus\nconst hatsVerse = hatsChorus\nconst bassVerse = bassChorus\nconst chordsVerse = chordsIntro\nconst melVerse = hatsIntro\nconst voxVerse = hatsIntro\nconst hatsOutro = hatsIntro\nconst bassOutro = bassVerse\nconst chordsOutro = chordsIntro\nconst melOutro = hatsIntro\nconst voxOutro = hatsIntro\n\nhats: arrange([4, hatsIntro], [4, hatsVerse], [4, hatsChorus], [4, hatsOutro]).gain(.35)\nbass: arrange([4, bassIntro], [4, bassVerse], [4, bassChorus], [4, bassOutro]).s("ebass").lpf(700)\nchords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsChorus], [4, chordsOutro])\n  .scale("A3:minor")\n  .s("piano")\n  .gain(.5)\nmel: arrange([4, melIntro], [4, melVerse], [4, melChorus], [4, melOutro])\n  .scale("A4:minor")\n  .s("square")\n  .lpf(2000)\n  .gain(.5)\nvox: arrange([4, voxIntro], [4, voxVerse], [4, voxChorus], [4, voxOutro])\n  .scale("A3:minor")\n  .s("strings")\n  .gain(.4)\n',
  },
];

export default ["S4", "S6"]
  .flatMap((at): Oak2Pin[] => [
    {
      owner: "A2.L08",
      at,
      name: "additive sections bring material absent from the peak",
      kind: "book-miss",
      expect: "fail",
      code: ADDITIVE,
      says: "`vox` plays in the outro but not in the chorus, your fullest section",
    },
    {
      owner: "A2.L08",
      at,
      name: "every section identical",
      kind: "book-miss",
      expect: "fail",
      code: song({}),
      says: "every section plays the same parts with about as many notes: take some parts out of some sections, or thin them out",
    },
    {
      owner: "A2.L08",
      at,
      name: "mostly erased notes with only the intro bass removed whole",
      kind: "book-other-way",
      expect: "pass",
      code: MOSTLY_ERASED,
    },
    {
      owner: "A2.L08",
      at,
      name: "fullest first without an arc",
      kind: "book-other-way",
      expect: "pass",
      code: PEAK_FIRST,
    },
    {
      owner: "A2.L08",
      at,
      name: "a new bass note in the verse",
      kind: "extra",
      expect: "fail",
      code: NEW_VERSE_NOTE,
      says: "`bass` plays something in the verse (bar 7) that it does not play at that place in the chorus, your fullest section",
    },
    {
      owner: "A2.L08",
      at,
      name: "the peak loses strings retained elsewhere",
      kind: "extra",
      expect: "fail",
      code: THINNED_CHORUS,
      says: "`vox` plays in the intro but not in the chorus, your fullest section",
    },
  ])
  .concat(X14) satisfies Oak2Pin[];
