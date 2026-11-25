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

export default ["S4", "S6"].flatMap((at): Oak2Pin[] => [
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
    says: "every section plays the same parts: take some parts out of some sections",
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
    says: "`bass` plays something in the verse (bar 7) that it never plays in the chorus, your fullest section",
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
]) satisfies Oak2Pin[];
