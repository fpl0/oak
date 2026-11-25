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

// X14 round 2 (A2.L09 landed): the lesson's sixteen-bar song, written out independently. `drumsOnly` is the Make's
// starter (kick, snare, hats and perc over the Band); `changes` replaces one section's const.
const PARTS = ["kick", "snare", "hats", "perc", "bass", "chords", "mel"] as const;
type Part = (typeof PARTS)[number];
const SECTIONS = ["Verse", "Chorus", "Verse2", "Chorus2"] as const;
const BASE: Record<Part, [string, string]> = {
  kick: ['s("bd ~ bd ~")', 's("bd*4")'],
  snare: ['s("~ sd ~ sd")', 's("~ sd ~ sd")'],
  hats: ['s("hh*8")', 's("hh*16")'],
  perc: ["silence", 's("<~ [cr ~ ~ ~] ~ ~>")'],
  bass: ['note("<a1 f1 c2 g1>")', 'note("<a1 f1 c2 g1>")'],
  chords: ['n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")', 'n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")'],
  mel: ['n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")', 'n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")'],
};
const TAIL: Record<Part, string> = {
  kick: "",
  snare: "",
  hats: ".gain(.5)",
  perc: ".gain(.5)",
  bass: '.s("sawtooth").lpf(400)',
  chords: '.scale("A3:minor").s("piano").gain(.5)',
  mel: '.scale("A4:minor").s("square").lpf(2000).gain(.5)',
};
const song = (changes: Record<string, string> = {}, drumsOnly = false): string => {
  const parts = PARTS.filter((p) => !drumsOnly || !["bass", "chords", "mel"].includes(p));
  const defs = parts.flatMap((p) =>
    SECTIONS.map((x, i) => `const ${p}${x} = ${changes[`${p}${x}`] ?? BASE[p][i % 2]}`),
  );
  const tracks = parts.map(
    (p) =>
      `${p}: arrange(${SECTIONS.map((x) => `[4, ${p}${x}]`).join(", ")})${TAIL[p] ? `\n  ${TAIL[p]}` : ""}`,
  );
  return `setcpm(90/4)\n\n${defs.join("\n")}\n\n${tracks.join("\n")}`;
};
const verseFill = (fill: string) => `s("<[~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [${fill}]>")`;
const GAP = {
  kickChorus: 's("<[~ bd bd bd] bd*4 bd*4 bd*4>")',
  hatsChorus: 's("<[~ hh*4 hh*4 hh*4] hh*16 hh*16 hh*16>")',
};
const S5_START = { snareVerse: verseFill("~ sd sd*4 sd*4") };
// Codex X14 round 2, exactly as graded.
const TOMS_ACROSS_TRACKS = `setcpm(90/4)

const kickVerse = s("bd ~ bd ~")
const kickChorus = s("bd*4")
const snareVerse = s("<[~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd lt*4 mt*4]>")
const snareChorus = s("~ sd ~ sd")
const hatsVerse = s("hh*8")
const hatsChorus = s("hh*16")
const percVerse = silence
const percChorus = s("<[ht*4 ~ ~ ~] [cr ~ ~ ~] ~ ~>")
const percChorus2 = s("<~ [cr ~ ~ ~] ~ ~>")
const snareVerse2 = s("~ sd ~ sd")

kick: arrange([4, kickVerse], [4, kickChorus], [4, kickVerse], [4, kickChorus])
snare: arrange([4, snareVerse], [4, snareChorus], [4, snareVerse2], [4, snareChorus])
hats: arrange([4, hatsVerse], [4, hatsChorus], [4, hatsVerse], [4, hatsChorus])
  .gain(.5)
perc: arrange([4, percVerse], [4, percChorus], [4, percVerse], [4, percChorus2])
  .gain(.5)
bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)
chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("piano").gain(.5)
mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("A4:minor").s("square").lpf(2000).gain(.5)`;
const HATS_MAKE_ROOM = `setcpm(90/4)

const kickVerse = s("bd ~ bd ~")
const kickChorus = s("bd*4")
const snareVerse = s("<[~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd sd*4 sd*4]>")
const snareChorus = s("<[sd*4 sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd]>")
const snareVerse2 = s("~ sd ~ sd")
const hatsVerse = s("<hh*8 hh*8 hh*8 ~>")
const hatsChorus = s("hh*16")
const hatsVerse2 = s("hh*8")
const percVerse = silence
const percChorus = s("<~ [cr ~ ~ ~] ~ ~>")
const snareChorus2 = s("~ sd ~ sd")

kick: arrange([4, kickVerse], [4, kickChorus], [4, kickVerse], [4, kickChorus])
snare: arrange([4, snareVerse], [4, snareChorus], [4, snareVerse2], [4, snareChorus2])
hats: arrange([4, hatsVerse], [4, hatsChorus], [4, hatsVerse2], [4, hatsChorus])
  .gain(.5)
perc: arrange([4, percVerse], [4, percChorus], [4, percVerse], [4, percChorus])
  .gain(.5)
bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)
chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("piano").gain(.5)
mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>").scale("A4:minor").s("square").lpf(2000).gain(.5)`;
const CRASH_ON_DOWNBEAT = `setcpm(90/4)

const kickVerse = s("bd ~ bd ~")
const kickChorus = s("bd*4")
const hatsVerse = s("hh*8")
const hatsChorus = s("hh*16")
const percVerse = silence
const percChorus = s("<[cr ~ ~ ~] ~ ~ ~>")
const percChorus2 = s("<~ [cr ~ ~ ~] ~ ~>")

kick: arrange([4, kickVerse], [4, kickChorus], [4, kickVerse], [4, kickChorus])
snare: s("~ sd ~ sd")
hats: arrange([4, hatsVerse], [4, hatsChorus], [4, hatsVerse], [4, hatsChorus])
  .gain(.5)
perc: arrange([4, percVerse], [4, percChorus], [4, percVerse], [4, percChorus2])
  .gain(.5)`;

// Message starts copied from content:check A2.L09 --verbose.
type Step = "S4" | "S5" | "S6" | "S7";
const SAYS: Record<Step, string> = {
  S4: "A drum fill toward the end of a section's last bar (more hits than its earlier bars); no drum in the next section's first half beat, where one usually plays: not yet.",
  S5: "A drum fill toward the end of a section's last bar (more hits than its earlier bars) that runs on: more drum hits just after the next section's downbeat than in its later first beats: not yet.",
  S6: "A part changes or stops for one bar only, inside a verse or chorus that returns: not yet.",
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
  ]),
  // The fill steps ask for a fill; a whole-bar move is none. The Make reads whole bars (`wholeBars`, W5 C8).
  miss("S4", "hats change a whole bar early", WHOLE_BAR),
  miss("S5", "hats change a whole bar early", WHOLE_BAR),
  other(
    "S7",
    "W5: the hats take up the chorus beat a whole bar early while the rest change on the bar line",
    WHOLE_BAR,
  ),
  other(
    "S7",
    "W5: the verse hats stay a whole bar late into the chorus",
    song({ hatsChorus: 's("<hh*8 hh*16 hh*16 hh*16>")' }, true),
  ),
  miss("S6", "an effect throughout a bridge heard once", BRIDGE),
  miss("S6", "the same effect in bar 2 of both verses", REPEATED_EFFECT),
  other("S4", "toms finish early and every drum leaves the downbeat empty", GAP_TOMS),
  other("S5", "a tom fill continues into the chorus", HESITATE_TOMS),
  other("S6", "one control change in a single chorus bar", CHORUS_EFFECT),
  other("S7", "hats leave two beats early instead of a fill", LEAVES_EARLY),
  // X14 round 2.
  miss(
    "S4",
    "a fill at the start of bar 4, then the usual backbeat, then the gap (Oak's call: a fill peaks in the bar's second half)",
    song({ ...GAP, snareVerse: verseFill("sd*4 sd*4 ~ sd") }),
  ),
  miss(
    "S4",
    "no drum ever plays a downbeat, so the empty one at the seam is no gap",
    song({
      snareVerse: verseFill("sd*4 sd*4 sd*4 ~"),
      kickVerse: 's("~ bd ~ bd")',
      kickChorus: 's("~ bd bd bd")',
      kickVerse2: 's("~ bd ~ bd")',
      kickChorus2: 's("~ bd bd bd")',
      hatsVerse: 's("[~ hh]*4")',
      hatsChorus: 's("[~ hh]*4")',
      hatsVerse2: 's("[~ hh]*4")',
      hatsChorus2: 's("[~ hh]*4")',
    }),
  ),
  other(
    "S4",
    "the fill is on the hats: sixteenths for three beats, then silence",
    song({ ...GAP, hatsVerse: 's("<hh*8 hh*8 hh*8 [hh*4 hh*4 hh*4 ~]>")' }),
  ),
  miss(
    "S5",
    "the fill stops at the bar line and the crash moves onto bar 5's downbeat: it marks the seam",
    song({ ...S5_START, percChorus: 's("<[cr ~ ~ ~] ~ ~ ~>")' }),
  ),
  miss(
    "S5",
    "the fill stops at the bar line and the kick doubles beat 1 of bar 5",
    song({ ...S5_START, kickChorus: 's("<[[bd bd] bd bd bd] bd*4 bd*4 bd*4>")' }),
  ),
  other("S5", "the fill runs from the snare line into toms on the perc line", TOMS_ACROSS_TRACKS),
  other("S5", "the hats rest in bar 4 to make room while the snare fill runs on", HATS_MAKE_ROOM),
  miss(
    "S6",
    "the tune's filter moved from 2000 to 1990 for one bar: not heard (Oak's call: a third of an octave)",
    song().replace(".lpf(2000)", '.lpf("<2000!9 1990 2000!6>")'),
  ),
  miss(
    "S6",
    "the same filter dip in a different bar of each verse: heard twice",
    song().replace(".lpf(2000)", '.lpf("<2000 400 2000!8 400 2000!5>")'),
  ),
  other(
    "S6",
    "the filter at 1200 for one bar of the second verse",
    song().replace(".lpf(2000)", '.lpf("<2000!9 1200 2000!6>")'),
  ),
  miss(
    "S7",
    "the three verse drums leave one beat early together, perc kept as in the starter",
    song(
      {
        kickVerse: 's("<bd*8 bd*8 bd*8 [bd bd bd bd bd bd ~ ~]>")',
        snareVerse: 's("<sd*8 sd*8 sd*8 [sd sd sd sd sd sd ~ ~]>")',
        hatsVerse: 's("<hh*8 hh*8 hh*8 [hh hh hh hh hh hh ~ ~]>")',
      },
      true,
    ),
  ),
  miss(
    "S7",
    "kick, snare and hats all silent from beat 3 of bar 4 (their last hits fall on different beats)",
    song(
      {
        kickVerse: 's("<[bd ~ bd ~] [bd ~ bd ~] [bd ~ bd ~] [bd ~ ~ ~]>")',
        snareVerse: 's("<[~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ ~]>")',
        hatsVerse: 's("<hh*8 hh*8 hh*8 [hh*4 ~]>")',
      },
      true,
    ),
  ),
  miss("S7", "only a crash added on the chorus downbeat", CRASH_ON_DOWNBEAT),
  other(
    "S7",
    "the verse hats carry on two beats into the chorus",
    song({ hatsChorus: 's("<[[hh hh] [hh hh] hh*4 hh*4] hh*16 hh*16 hh*16>")' }, true),
  ),
] satisfies Oak2Pin[];
