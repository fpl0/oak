// Night Bus: late-night soul in D minor, 84 BPM, 60 bars (about 2:51).
// Draws on: U10 minor, U15 secondary dominants, J2 minor ii–V and extensions, U17 modulation,
// R1 swing and microtiming, A1 wavetables, A2 sidechain and break chops.
setcpm(84/4)
// intro 4 · verse 8 · chorus 8 · verse 8 · chorus 8 · bridge 8 · last chorus up a step 8 · outro 8

// ── harmony ───────────────────────────────────────────────
const verse  = chord("<Dm9 Bb^7 Gm11 A7>").voicing()                    // A7: the major V of harmonic minor
const chorus = chord("<Bb^7 C7 F^7 D7 Gm9 Gm9 Em7b5 A7sus>").voicing()  // D7 → Gm: secondary dominant · Em7b5 A7: minor ii–V
const bridge = chord("<F^7 F^7 Eb^7 Eb^7 Db^7 Db^7 A7sus A7>").voicing() // slides down by whole steps, the sus sets up the lift
const up = x => x.transpose(2)                                            // the last chorus in E minor

// ── parts ─────────────────────────────────────────────────
const push    = "x ~ ~ x ~ ~ x [~ x]"
const bassV   = note("<d2 bb1 g1 a1>").struct(push)
const bassC   = note("<bb1 c2 f1 d2 g1 g1 e2 a1>").struct(push)
const bassB   = note("<f1 f1 eb2 eb2 db2 db2 a1 a1>").struct("x@3 x")
const hook    = note("<[a4 ~ f4 g4] [a4@3 ~] [c5 a4 g4 f4] [e4@3 ~]>")
                  .off(1/8, x => x.transpose(12).gain(.3))                 // the answer, an octave up
const shimmer = n("0 2 4 6 4 2").scale("D4:minor").jux(rev)                // wide stereo arpeggio
const groove  = stack(
  s("bd ~ ~ bd ~ ~ bd ~").lastOf(4, x => x.ply(2)).duckorbit(2).duckdepth(.5),
  s("~ sd ~ sd").late(.006),                                               // the snare a hair behind the beat
  s("hh*16").swingBy(1/3, 8).gain(sine.range(.2, .45).fast(2)),
)
const breakbeat = s("brk").slice(4, "<[0 1 2 3] [0 1 0 3] [0 2 1 3] [0 1 [2 2] 3]>").gain(.6)

// ── the song: every track has the same eight sections ─────
keys:  arrange([4, verse], [8, verse], [8, chorus], [8, verse], [8, chorus], [8, bridge], [8, up(chorus)], [8, verse])
         .s("rhodes").gain(.75).room(.3).orbit(2)
pad:   arrange([4, verse], [8, silence], [8, silence], [8, silence], [8, silence], [8, silence], [8, silence], [8, verse])
         .s("wt_morph").wtrate(.5).wtdepth(.8).lpf(sine.range(300, 3000).slow(16)).gain(.5).orbit(2)
arp:   arrange([4, shimmer], [8, silence], [8, silence], [8, silence], [8, silence], [8, shimmer], [8, silence], [8, silence])
         .s("wt_epiano").gain(.4).delay(.3)
bass:  arrange([4, silence], [8, bassV], [8, bassC], [8, bassV], [8, bassC], [8, bassB], [8, up(bassC)], [8, bassV.mask("<1 1 1 1 0 0 0 0>")])
         .s("ebass").lpf(800).gain(1.2).orbit(2)
mel:   arrange([4, silence], [8, silence], [8, hook], [8, silence], [8, hook], [8, silence], [8, up(hook)], [8, silence])
         .s("triangle").gain(1.1).delay(.25)
drums: arrange([4, silence], [8, groove], [8, groove], [8, groove], [8, groove], [8, breakbeat], [8, groove], [8, silence])
const dust = s("crackle").density(.5).gain(1)
texture: arrange([4, dust], [8, silence], [8, silence], [8, silence], [8, silence], [8, silence], [8, silence], [8, dust])
