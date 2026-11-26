// Tide Engine: jungle in F minor, 170 BPM, 72 bars (about 1:42).
// Draws on: A2.L04 splice (the jungle break at its own tempo), R3 Euclidean rhythms and rotation,
// R2 polymeter, A1 supersaw/unison, ladder filter, drive, LFOs and delay throws, U09 arrangement.
setcpm(170/4)
// intro 16 · build 8 · drop 16 · half-time break 8 · drop 16 · outro 8

// ── drums: brkjungle is two bars at 170, so each piece fills its eighth exactly ──
const amen    = s("brkjungle").splice(16, "<[0 1 2 3 4 5 6 7] [8 9 10 11 12 13 14 15] [0 1 2 3 0 1 [6 6] 7] [8 9 10 11 [4 4] 5 [14 15] [15 15 15 15]]>")
const rolled  = amen.sometimesBy(.2, x => x.ply(2))                       // controlled chance: a roll here and there
const filtered = amen.hpf(saw.range(2000, 100).slow(16))                  // the intro opens from thin to full
const halftime = s("brkjungle").splice(16, "<[0 ~ 2 ~ 4 ~ 6 ~] [8 ~ 10 ~ 12 ~ [14 15] ~]>")
const perc    = s("rim(5,16,3), sh(7,16), {cb ~ cb ~ ~}%16").gain(.45)    // 5 over 16 rotated, 7 over 16, a five-step bell drifting over the bar

// ── harmony and bass ──
const pads  = chord("<Fm9 Fm9 Db^9 [Eb6 C7alt]>").voicing()
const reese = note("<f1 f1 db1 [eb1 c1]>").s("supersaw").unison(5).detune(.4)
                .lpf(sine.range(180, 900).slow(8)).lpq(10).ftype("ladder").drive(2)
const sub   = note("<f1 f1 db1 [eb1 c1]>").s("sine").gain(.65)

// ── lead and voice ──
const lead  = n("<[0 ~ 3 ~ 4 ~ 7 6] [4@3 ~ 3 ~ 2 ~] [0 ~ 3 4 [6 7] ~ 9 ~] [7@4 6 4 3 ~]>").scale("F4:minor:pentatonic")
                .s("wt_fm").gain(.8).wtrate(.3).wtdepth(.6).delay(.35).delaytime(.265).delayfeedback(.55).pan(sine.slow(4))
const voice = s("speech*2").n("<3 [3 9]>").speed("<1 1.5 .75 1>").begin(.1).end(.5).gain(.75).hpf(400).room(.5).roomsize(6)

// ── transitions ──
const rise  = s("<~ ~ ~ ~ ~ ~ swoosh ~>").gain(.7)
const hit   = s("<impact ~ ~ ~ ~ ~ ~ ~>").gain(.6)

drums: arrange([16, filtered], [8, amen], [16, rolled], [8, halftime], [16, rolled], [8, filtered.mask("<1 1 1 1 1 1 0 0>")]).gain(1)
perc:  arrange([16, silence], [8, perc], [16, perc], [8, silence], [16, perc], [8, silence])
pads:  arrange([16, pads], [8, pads], [16, pads], [8, pads], [16, pads], [8, pads])
         .s("pad").attack(.4).release(2).room(.6).roomsize(6).gain(.3)
reese: arrange([16, silence], [8, silence], [16, reese], [8, silence], [16, reese], [8, silence]).gain(1.1)
sub:   arrange([16, silence], [8, silence], [16, sub], [8, sub], [16, sub], [8, silence])
lead:  arrange([16, silence], [8, lead], [16, silence], [8, lead], [16, lead], [8, silence])
voice: arrange([16, voice], [8, voice], [16, silence], [8, voice], [16, silence], [8, voice])
fx:    arrange([16, silence], [8, rise], [16, hit], [8, rise], [16, hit], [8, silence])
