// Flip: a boom-bap sample flip in C minor, 90 BPM, 40 bars (about 1:47).
// Draws on: A2.L04 chopping (slice, splice, speed, begin/end), A2.L05 sidechain, J1.L05 one chord
// pattern driving every part, J2 extended and altered chords, J2.L03 extended voicings, U07 call and answer.
setcpm(90/4)
// intro 4 · verse 8 · hook 8 · verse 8 · hook 8 · outro 4

// A chain of ii–Vs falling by a whole step, then the minor ii–V home: Cm9 F13 | Bbm9 Eb13 | Ab^9 | Dm7b5 G7b9
const changes = chord("<Cm9 F13 Bbm9 Eb13 Ab^9 Ab^9 Dm7b5 G7b9>")

// ── the break, re-cut: brkboombap is two bars at 90, sixteen pieces, eight to a bar ──
const straight = s("brkboombap").slice(16, "<[0 1 2 3 4 5 6 7] [8 9 10 11 12 13 14 15]>")
const recut    = s("brkboombap").slice(16, "<[0 1 0 3 4 5 2 7] [8 9 8 11 [12 12] 13 [14 15] [15 15]]>")
const tapestop = straight.speed(saw.range(1, .25))                        // the record slows to a halt

// ── the band, all reading the same changes ──
const comp = changes.dict("ireal-ext").voicing().struct("[~ x] ~ [~ x] [~ ~ x ~]").late(.01)
const walk = changes.rootNotes(2).struct("x ~ ~ [~ x] ~ ~ x ~")
const head = note("<[g4 ~ eb4 d4] [d4@3 ~] [c5 db5 f4 ab4] [g4@3 ~] [bb4 c5 eb5 g5] [g5@3 ~] [f5 ab4@2 c5] [b4 ab4 g4 ~]>")

// ── the sampled bits ──
const chant   = s("speech ~ ~ speech ~ ~ speech ~").n("<5 [5 ~ ~ 6]>").begin(.05).end(.6)
                  .speed("<1 1 .8 1.2>").gain(.7).delay(.4).delaytime(.5).delayfeedback(.45)
const cuts    = s("~ ~ ~ ~ ~ ~ [scratch scratch] ~").n("[0 1]").speed("<1 1.5>").gain(.5)
const fall    = s("<~ ~ ~ [~ ~ ~ fall]>").gain(1.2).room(.4)              // a trombone fall closes every four bars

const boom    = s("bd ~ ~ ~ ~ ~ bd ~, ~ ~ ~ ~ ~ ~ ~ [~ bd]")             // an 808 under the break, ducking the band

// ── the record ──
drums: arrange([4, silence], [8, straight], [8, recut], [8, straight], [8, recut], [4, tapestop]).gain(.75)
kick:  arrange([4, silence], [8, boom], [8, boom], [8, boom], [8, boom], [4, silence])
         .bank("oak808").gain(.4).duckorbit(2).duckdepth(.6)
keys:  arrange([4, comp], [8, comp], [8, comp], [8, comp], [8, comp], [4, comp])
         .s("rhodes").gain(.7).phaser(2).room(.3).orbit(2)
bass:  arrange([4, silence], [8, walk], [8, walk], [8, walk], [8, walk], [4, silence]).s("upright").gain(1.5).orbit(2)
horn:  arrange([4, silence], [8, silence], [8, head], [8, silence], [8, head], [4, silence])
         .s("tenor").gain(1.8).room(.3).delay(.15)
vox:   arrange([4, chant], [8, silence], [8, chant], [8, silence], [8, chant], [4, silence])
cuts:  arrange([4, silence], [8, cuts], [8, silence], [8, cuts], [8, silence], [4, silence])
falls: arrange([4, silence], [8, fall], [8, fall], [8, fall], [8, fall], [4, silence])
dust:  s("crackle").density(.5).gain(1)
