import type { Oak2Pin } from "./types.ts";

// The original reproducer stays intact: W0 requires a gap across every drum line.
const TOM_FILL = `setcpm(90/4)

const kickVerse = s("bd ~ bd ~")
const kickChorus = s("bd*4")
const snareVerse = s("<[~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [lt*4 mt*4 ht*4 ~]>")
const snareVerse2 = s("~ sd ~ sd")
const snareChorus = s("~ sd ~ sd")
const hatsVerse = s("hh*8")
const hatsChorus = s("hh*16")
const bassVerse = note("<a1 f1 c2 g1>")
const bassChorus = note("<a1 f1 c2 g1>")
const chordsVerse = n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")
const chordsChorus = n("<[0,2,4]*4 [-2,0,2]*4 [-5,-3,-1]*4 [-1,1,3]*4>")
const melVerse = n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")
const melChorus = n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")

kick: arrange([4, kickVerse], [4, kickChorus], [4, kickVerse], [4, kickChorus])
snare: arrange([4, snareVerse], [4, snareChorus], [4, snareVerse2], [4, snareChorus])
hats: arrange([4, hatsVerse], [4, hatsChorus], [4, hatsVerse], [4, hatsChorus]).gain(.5)
bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus])
  .s("sawtooth").lpf(400)
chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus])
  .scale("A3:minor").s("piano").gain(.5)
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus])
  .scale("A4:minor").s("square").lpf(2000).gain(.5)`;

// Independent fixtures keep the fidelity checks separate from the lesson references.
const PLAIN = TOM_FILL.replace("[lt*4 mt*4 ht*4 ~]", "[~ sd ~ sd]");
const GAP_TOMS = TOM_FILL.replace(
  'const kickChorus = s("bd*4")',
  'const kickChorus = s("<[~ bd bd bd] bd*4 bd*4 bd*4>")',
).replace('const hatsChorus = s("hh*16")', 'const hatsChorus = s("<[~ hh*4 hh*4 hh*4] hh*16 hh*16 hh*16>")');
const HESITATE_TOMS = TOM_FILL.replace(
  'const snareChorus = s("~ sd ~ sd")',
  'const snareChorus = s("<[lt*4 sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd]>")',
);
const HARD =
  PLAIN.replace("\n\nkick:", '\nconst percVerse = silence\nconst percChorus = s("cr ~ ~ ~")\n\nkick:') +
  "\nperc: arrange([4, percVerse], [4, percChorus], [4, percVerse], [4, percChorus])";
const WHOLE_BAR = PLAIN.replace(
  'const hatsVerse = s("hh*8")',
  'const hatsVerse = s("<hh*8 hh*8 hh*8 hh*16>")',
);
const LEAVES_EARLY = PLAIN.replace(
  'const hatsVerse = s("hh*8")',
  'const hatsVerse = s("<hh*8 hh*8 hh*8 [hh*4 ~]>")',
);
const MOVED = `setcpm(90/4)

const drumsVerse = s("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd sd bd cr]>")
const drumsChorus = s("cr*4")
const bassVerse = note("<[a1 a1 a1 a1] [a1 a1 a1 a1] [a1 a1 a1 a1] [a1 a1 a1 c2]>")
const bassChorus = note("c2*4")

drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse], [4, drumsChorus])
bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus])
  .s("sawtooth").lpf(400)`;
const REPEATED_EFFECT = PLAIN.replace(
  '.s("square").lpf(2000).gain(.5)',
  '.s("square").lpf("<2000 400 2000!6 2000 400 2000!6>").gain(.5)',
);
const CHORUS_EFFECT = PLAIN.replace(
  '.s("square").lpf(2000).gain(.5)',
  '.s("square").lpf("<2000!5 400 2000!10>").gain(.5)',
);
const BRIDGE = `setcpm(90/4)

const drumsVerse = s("bd sd bd sd")
const drumsChorus = s("bd*4")
const drumsBridge = s("bd sd bd sd").room(.8)

drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse], [4, drumsChorus], [4, drumsBridge])`;

// Message starts copied from content:check A2.L09 --verbose.
type Step = "S4" | "S5" | "S6" | "S7";
const SAYS: Record<Step, string> = {
  S4: "More drum hits in a section's last bar than its earlier bars; no drum in the next section's first half beat: not yet.",
  S5: "More drum hits in a section's last bar than its earlier bars, and in the next section's first beat than its later first beats: not yet.",
  S6: "A part's sound heard in one bar only, inside a verse or chorus that returns: not yet.",
  S7: "Some parts change a beat or more off the bar line at a seam, without every changing part moving together: not yet.",
};

const miss = (at: Step, name: string, code: string): Oak2Pin => ({
  owner: "A2.L09",
  at,
  name,
  kind: "book-miss",
  expect: "fail",
  code,
  says: SAYS[at],
});
const other = (at: Step, name: string, code: string): Oak2Pin => ({
  owner: "A2.L09",
  at,
  name,
  kind: "book-other-way",
  expect: "pass",
  code,
});
export default [
  {
    owner: "A2.L09",
    at: "S4",
    name: "fill ends early but kick and hats still land on the downbeat (Oak's call per W0: anticipation needs the drums silent on the downbeat)",
    kind: "extra",
    expect: "fail",
    code: TOM_FILL,
    says: SAYS.S4,
  },
  ...(["S4", "S5", "S7"] as const).flatMap((at) => [
    miss(at, "every part switches on the bar line with a crash", HARD),
    miss(at, "every part changes one beat early together", MOVED),
    miss(at, "hats change a whole bar early", WHOLE_BAR),
  ]),
  miss("S6", "an effect throughout a bridge heard once", BRIDGE),
  miss("S6", "the same effect in bar 2 of both verses", REPEATED_EFFECT),
  other("S4", "toms finish early and every drum leaves the downbeat empty", GAP_TOMS),
  other("S5", "a tom fill continues into the chorus", HESITATE_TOMS),
  other("S6", "one control change in a single chorus bar", CHORUS_EFFECT),
  other("S7", "hats leave two beats early instead of a fill", LEAVES_EARLY),
] satisfies Oak2Pin[];
