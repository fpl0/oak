import type { Oak2Pin } from "./types.ts";

// Keep the accompaniment on the chorus downbeat: only the fill ends early.
// This pin must pass without requiring the kick and hats to leave a gap too.
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

export default [
  {
    owner: "A2.L09",
    at: "S4",
    name: "toms finish inside the verse while kick and hats land on the chorus downbeat",
    kind: "book-other-way",
    expect: "pass",
    code: TOM_FILL,
  },
] satisfies Oak2Pin[];
