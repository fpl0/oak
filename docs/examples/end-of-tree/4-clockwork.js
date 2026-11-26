// Clockwork: a 7/8 piece in E Phrygian, 240 eighths a minute, 48 bars (about 1:24).
// Draws on: R2 odd meters (2+2+3) and polymeter, U14 modes, R3 Euclidean rhythms, A2.L06 idiomatic
// timbres (marimba, kalimba, glockenspiel), A2.L04 one-shots and speed, A1 filters and FM.
setcpm(240/7)
// intro 8 · A 16 · B 16 · outro 8 — each bar is seven eighths, grouped 2+2+3

// ── the groove: the 2+2+3 is in the kick and snare, the shaker counts all seven ──
const meter = stack(
  s("bd ~ ~ ~ bd ~ ~"),                                     // 1 . . . 1 . .  (the long group comes last)
  s("~ ~ sd ~ ~ ~ sd").lastOf(4, x => x.ply(2)),
  s("sh*7").velocity("1 .5 1 .5 1 .5 .5"),                  // the accents spell 2+2+3
).bank("oak909").gain(.5)
const clock = s("{snap foley foley}%7").n("{0 3 7}%7").speed("<1 1.25 .9 1>").gain(.4)   // three one-shots over seven: they line up every three bars

// ── E Phrygian: the ♭2 (F) is the colour ──
const ostinato = n("0 1 0 [3 4] 0 1 [2 0]").scale("E3:phrygian")
const answer   = ostinato.rev().scaleTranspose(2)
const bells    = n("{0 4 7 6 4}%7").scale("E5:phrygian")                 // five notes over seven steps
const drone    = s("drone").speed(.5).gain(.3).lpf(1200).room(.5)
const chordsA  = chord("<Em F Em [Dm F]>").voicing()                       // i ♭II i ♭vii–♭II
const chordsB  = chord("<C^7 F^7 Dm7 F^7>").voicing()

drums:  arrange([8, silence], [16, meter], [16, meter], [8, meter.mask("<1 1 1 1 0 0 0 0>")])
clock:  arrange([8, clock], [16, clock], [16, clock], [8, clock])
marimba: arrange([8, ostinato], [16, ostinato], [16, ostinato.lastOf(2, x => x.superimpose(y => y.transpose(12)))], [8, ostinato])
           .s("marimba").gain(.7)
kalimba: arrange([8, silence], [16, answer], [16, silence], [8, silence]).s("kalimba").pan(.7).delay(.3)
bells:  arrange([8, silence], [16, silence], [16, bells], [8, bells.degradeBy(.4)]).s("glockenspiel").gain(.9).pan(.3)
chords: arrange([8, silence], [16, chordsA], [16, chordsB], [8, chordsA]).s("strings").attack(.3).gain(.4)
bass:   arrange([8, silence], [16, n("<0 1 0 [-1 1]>").scale("E2:phrygian").struct("x ~ ~ ~ x ~ ~")],
          [16, n("<5 1 3 1>").scale("E2:phrygian").struct("x ~ ~ ~ x ~ x")], [8, silence])
          .s("sine").fm(2).fmh(1).lpf(700).decay(.3).sustain(.6)
drone:  arrange([8, drone], [16, silence], [16, silence], [8, drone])
