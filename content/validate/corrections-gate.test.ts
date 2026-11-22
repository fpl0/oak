// Corrections gate (attack:still-passes, attack:now-fails): every wrong answer the gate turned from a pass into a
// fail, with the start of the line the learner reads, and the right answers the attackers wrote (their controls and
// the answers the corrections pass had rejected), graded as content:check grades them: the real realm, production
// normalize, the step's own exercise and its lesson, checkpoint or capstone context.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Exercise, KeySpec } from "@oak/content-kit";
import { flattenExercise } from "@oak/content-kit";
import { capstones } from "../capstones.ts";
import { grade } from "./harness.ts";

setDefaultTimeout(600_000);

interface Pin {
  owner: string;
  /** A step id ("S7"), "brief" for a capstone, "make" for a checkpoint's Make, or an exercise id. */
  at: string;
  name: string;
  expect: "pass" | "fail";
  /** The start of the first line the learner reads that is not "done". */
  says?: string;
  code: string;
}

// biome-ignore format: one pin to a line
const PINS: Pin[] = [
  {"owner":"U01.L09","at":"S6","name":"slowed then sped back","expect":"fail","says":"At least one line that plays changes speed with `.slow()` or `.fast()`: the speed calls on","code":"setcpm(96/4)\n\nkick: s(\"bd ~ [~ bd] ~\").slow(2).fast(2).bank(\"LinnDrum\")\nsnare: s(\"~ sd ~ sd\").bank(\"LinnDrum\")\nhats: s(\"hh*8\").bank(\"LinnDrum\").gain(.5)"},
  {"owner":"U01.L09","at":"S6","name":"fast(1.01): drifts, no flip","expect":"fail","says":"At least one line that plays changes speed with `.slow()` or `.fast()`: `.fast(1.01)` keeps","code":"setcpm(96/4)\n\nkick: s(\"bd ~ [~ bd] ~\").bank(\"LinnDrum\")\nsnare: s(\"~ sd ~ sd\").fast(1.01).bank(\"LinnDrum\")\nhats: s(\"hh*8\").bank(\"LinnDrum\").gain(.5)"},
  {"owner":"U01.L09","at":"S6","name":"fast(2) on a muted line","expect":"fail","says":"At least one line that plays changes speed with `.slow()` or `.fast()`: the line that changes","code":"setcpm(96/4)\n\nkick: s(\"bd ~ [~ bd] ~\").bank(\"LinnDrum\")\nsnare: s(\"~ sd ~ sd\").bank(\"LinnDrum\")\nhats: s(\"hh*8\").bank(\"LinnDrum\").gain(.5)\n_x: s(\"hh*8\").fast(2)"},
  {"owner":"U01.L09","at":"S6","name":"fast(2) on a silent line of rests","expect":"fail","says":"At least one line that plays changes speed with `.slow()` or `.fast()`: the line that changes","code":"setcpm(96/4)\n\nkick: s(\"bd ~ [~ bd] ~\").bank(\"LinnDrum\")\nsnare: s(\"~ sd ~ sd\").bank(\"LinnDrum\")\nhats: s(\"hh*8\").bank(\"LinnDrum\").gain(.5)\nperc: s(\"~ ~ ~ ~\").fast(2)"},
  {"owner":"U01.L09","at":"S6","name":"fast(2) on a .gain(0) line","expect":"fail","says":"At least one line that plays changes speed with `.slow()` or `.fast()`: the line that changes","code":"setcpm(96/4)\n\nkick: s(\"bd ~ [~ bd] ~\").bank(\"LinnDrum\")\nsnare: s(\"~ sd ~ sd\").bank(\"LinnDrum\")\nhats: s(\"hh*8\").fast(2).bank(\"LinnDrum\").gain(0)"},
  {"owner":"U01.L09","at":"S6","name":"fast(2) on a line of one sustained-free rest pattern plus slow(2) on silence","expect":"fail","says":"At least one line that plays changes speed with `.slow()` or `.fast()`: the line that changes","code":"setcpm(96/4)\n\nkick: s(\"bd ~ [~ bd] ~\").bank(\"LinnDrum\")\nsnare: s(\"~ sd ~ sd\").bank(\"LinnDrum\")\nhats: s(\"hh*8\").bank(\"LinnDrum\").gain(.5)\nperc: s(\"~\").slow(2)"},
  {"owner":"U01.L09","at":"S6","name":"fast(2) on a one-hit-per-cycle crash at gain .005","expect":"fail","says":"At least one line that plays changes speed with `.slow()` or `.fast()`: the line that changes","code":"setcpm(96/4)\n\nkick: s(\"bd ~ [~ bd] ~\").bank(\"LinnDrum\")\nsnare: s(\"~ sd ~ sd\").bank(\"LinnDrum\")\nhats: s(\"hh*8\").bank(\"LinnDrum\").gain(.5)\nperc: s(\"cr\").fast(2).gain(.005)"},
  {"owner":"U02.L06","at":"S5","name":"vox alternates triangle and piano","expect":"fail","says":"The octave line on a synth wave: only 4 of 8 notes in `vox` are on","code":"setcpm(96/4)\n\nmel: note(\"c4 e4 g4 e4\").s(\"piano\").gain(.5)\nvox: note(\"c5 e5 g5 e5\").s(\"<triangle piano>\").gain(.4)"},
  {"owner":"U02.L06","at":"S5","name":"vox one note in four on a wave","expect":"fail","says":"The octave line on a synth wave: only 1 of 4 notes in `vox` are on","code":"setcpm(96/4)\n\nmel: note(\"c4 e4 g4 e4\").s(\"piano\").gain(.5)\nvox: note(\"c5 e5 g5 e5\").s(\"triangle piano piano piano\").gain(.4)"},
  {"owner":"U02.L06","at":"S6","name":"vox at gain .011","expect":"fail","says":"In every bar, a second line plays the same notes at the same time on another sound, at the same height or one or two octaves away: no line doubles","code":"setcpm(96/4)\n\nmel: note(\"<[c4 e4 g4 e4] [f4 a4 g4 e4]>\").s(\"piano\").gain(.5)\nvox: note(\"<[c4 e4 g4 e4] [f4 a4 g4 e4]>\").s(\"sine\").gain(.011)"},
  {"owner":"U02.L06","at":"S6","name":"the melody line itself replaced: both lines the new tune","expect":"pass","code":"setcpm(96/4)\n\nmel: note(\"c4 ~ ~ ~\").s(\"piano\").gain(.5)\nvox: note(\"c4 ~ ~ ~\").s(\"sine\").gain(.4)"},
  {"owner":"U02.L08","at":"S6","name":"room on the hats, the tune dry","expect":"fail","says":"At least half of the tune's notes play with `.room()` above 0, such as `.room(.4)`: no sound in the tune has `.room()` yet","code":"mel: note(\"<[e4 e4 f4 g4] [g4 f4 e4 d4] [c4 c4 d4 e4] [e4 d4 d4@2]>\").s(\"piano\")\nhats: s(\"hh*4\").gain(.3).room(.5)"},
  {"owner":"U02.L08","at":"S6","name":"room on a second line, the tune dry","expect":"fail","says":"At least half of the tune's notes play with `.room()` above 0, such as `.room(.4)`: no sound in the tune has `.room()` yet","code":"mel: note(\"<[e4 e4 f4 g4] [g4 f4 e4 d4] [c4 c4 d4 e4] [e4 d4 d4@2]>\").s(\"piano\")\nbass: note(\"c2\").s(\"sine\").gain(.3).room(.5)"},
  {"owner":"U02.L08","at":"S6","name":"room .001","expect":"fail","says":"At least half of the tune's notes play with `.room()` above 0, such as `.room(.4)`: `.room(.001)` changes nothing","code":"mel: note(\"<[e4 e4 f4 g4] [g4 f4 e4 d4] [c4 c4 d4 e4] [e4 d4 d4@2]>\").s(\"piano\").room(.001)"},
  {"owner":"U02.L08","at":"S6","name":"room patterned <0 0 0 .4>: three bars dry","expect":"fail","says":"At least half of the tune's notes play with `.room()` above 0, such as `.room(.4)`: only 12 of 60 notes in","code":"mel: note(\"<[e4 e4 f4 g4] [g4 f4 e4 d4] [c4 c4 d4 e4] [e4 d4 d4@2]>\").s(\"piano\").room(\"<0 0 0 .4>\")"},
  {"owner":"U03.L05","at":"S8","name":"the bass visits F, the tune stays in C","expect":"fail","says":"The tune plays in at least two different keys, set by a pattern in `.scale(\"< >\")`: the","code":"mel: n(\"<[0 2 1 4] [3 2 0 ~]>\").scale(\"C4:major\").s(\"piano\")\nbass: n(\"0\").scale(\"<C2:major!2 F2:major!2>\").s(\"sawtooth\").gain(.3)"},
  {"owner":"U03.L05","at":"S8","name":"the tune in C, a second line in F at gain .02","expect":"fail","says":"The tune plays in at least two different keys, set by a pattern in `.scale(\"< >\")`: the","code":"mel: n(\"<[0 2 1 4] [3 2 0 ~]>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<[0 2 1 4] [3 2 0 ~]>\").scale(\"<C4:major!2 F4:major!2>\").s(\"piano\").gain(.02)"},
  {"owner":"U03.L10","at":"S6","name":"the answer on a second line, the tune's bars 3-4 empty","expect":"fail","says":"Bars 3 and 4 copy bars 1 and 2, every note moved up or down by the same amount:","code":"mel: n(\"<[0 0 0 2] [1 0 1 2] ~ ~>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<~ ~ [5 5 5 7] [6 5 6 7]>\").scale(\"C4:major\").s(\"piano\").gain(.02)"},
  {"owner":"U03.L10","at":"S6","name":"the right answer inaudible on vox, a wrong answer heard on mel","expect":"fail","says":"Bars 3 and 4 copy bars 1 and 2, every note moved up or down by the same amount:","code":"mel: n(\"<[0 0 0 2] [1 0 1 2] [4 2 0 -3] [0 4 2 0]>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<~ ~ [5 5 5 7] [6 5 6 7]>\").scale(\"C4:major\").s(\"piano\").gain(.02)"},
  {"owner":"U04.L04","at":"S7","name":"the answer in bar 3, bar 2 empty","expect":"fail","says":"Bar 2 plays bar 1's notes, all moved up or down by the same number of half steps: bar 2","code":"mel: note(\"<[c4 e4 g4 e4] ~ [f4 a4 c5 a4] ~>\").s(\"piano\")"},
  {"owner":"U04.L04","at":"S7","name":"a two-note riff of one held note","expect":"pass","code":"mel: note(\"<[c4@4] [f4@4]>\").s(\"piano\")"},
  {"owner":"U04.L04","at":"S7","name":"the copy only heard at gain .02 under a wrong bar 2","expect":"fail","says":"Bar 2 plays bar 1's notes, all moved up or down by the same number of half steps: bar 2","code":"mel: note(\"<[c4 e4 g4 e4] [g4 f4 e4 d4]>\").s(\"piano\")\nvox: note(\"<~ [f4 a4 c5 a4]>\").s(\"piano\").gain(.02)"},
  {"owner":"U04.L04","at":"S7","name":"the copy on vox at full gain, bar 2 of mel a different shape at once","expect":"fail","says":"Bar 2 plays bar 1's notes, all moved up or down by the same number of half steps: bar 2","code":"mel: note(\"<[c4 e4 g4 e4] [g4 f4 e4 d4]>\").s(\"piano\")\nvox: note(\"<~ [f4 a4 c5 a4]>\").s(\"piano\")"},
  {"owner":"U04.L02","at":"S7","name":"an octave: named but a double, not a harmony","expect":"fail","says":"A second line plays every note of the riff at the same time, moved by an interval name in `.transpose()` (not an octave): `vox`","code":"mel: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").s(\"piano\")\nvox: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").transpose(\"8P\").s(\"piano\").gain(.6)"},
  {"owner":"U04.L02","at":"S7","name":"harmony by number, the named interval on a gain 0 line","expect":"fail","says":"A second line plays every note of the riff at the same time, moved by an interval name in `.transpose()` (not an octave): `vox`","code":"mel: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").s(\"piano\")\nvox: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").transpose(4).s(\"piano\").gain(.6)\nx: note(\"c4\").transpose(\"3M\").gain(0)"},
  {"owner":"U04.L02","at":"S7","name":"named move, but the vox line plays another riff","expect":"fail","says":"A second line plays every note of the riff at the same time, moved by an interval name in `.transpose()` (not an octave): the","code":"mel: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").s(\"piano\")\nvox: note(\"<[d4 a4 d4 ~] [e4 a4 e4 ~]>\").transpose(\"3M\").s(\"piano\").gain(.6)"},
  {"owner":"U04.L02","at":"S7","name":"harmony a bar late: follows in time, not with it","expect":"fail","says":"A second line plays every note of the riff at the same time, moved by an interval name in `.transpose()` (not an octave): no line","code":"mel: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").s(\"piano\")\nvox: note(\"<[f4 g4 f4 ~] [c4 g4 c4 ~]>\").transpose(\"3M\").s(\"piano\").gain(.6)"},
  {"owner":"U06.L04","at":"S7","name":"V to I6/4: home chord over G in the bass","expect":"fail","says":"Bars 7 and 8 go V to I: not","code":"chords: chord(\"<C F C G Am F G C>\").voicing().s(\"piano\")\nbass: note(\"<c2 f2 c2 g2 a2 f2 g2 g2>\").s(\"ebass\").lpf(800)"},
  {"owner":"U06.L04","at":"S7","name":"V to I with the I struck for a 16th then silence","expect":"pass","code":"chords: n(\"[0,2,4]\").add(n(\"<0 3 0 4 0 3 4 [0 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~]>\")).scale(\"C3:major\").s(\"piano\")"},
  {"owner":"U06.L05","at":"S6","name":"roots on beat 1 struck at gain .02, loud wrong notes after","expect":"fail","says":"On beat 1 of every bar, `bass` plays a note of that bar's chord: not","code":"bass: n(\"<[0 1 1 1] [4 5 5 5] [5 6 6 6] [3 4 4 4]>\").scale(\"C2:major\").s(\"ebass\").gain(\"[.02 1 1 1]\").lpf(800)\nchords: chord(\"<C G Am F>\").voicing().s(\"piano\").gain(.5)"},
  {"owner":"U06.L03","at":"S7","name":"V then I but the I is C minor","expect":"fail","says":"V followed straight away by I: 0 × V that resolve; at least 1","code":"chords: chord(\"<C F G Cm>\").voicing().s(\"piano\")"},
  {"owner":"U07.L07","at":"S6","name":"every note right but scattered across octaves","expect":"fail","says":"Bar 2, 3: right note, an octave","code":"mel: n(\"<[0 ~ 2 4] ~ [5 ~ 2 0] ~>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<~ [6 ~ 11 1] ~ [-2 ~ 10 0]>\").scale(\"C4:major\").s(\"rhodes\")"},
  {"owner":"U07.L07","at":"S6","name":"first and last notes swapped octave: the reply leaps instead of falling","expect":"fail","says":"Bar 2, 1: right note, an octave","code":"mel: n(\"<[0 ~ 2 4] ~ [5 ~ 2 0] ~>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<~ [-1 ~ 4 8] ~ [5 ~ 3 7]>\").scale(\"C4:major\").s(\"rhodes\")"},
  {"owner":"U07.L07","at":"S7","name":"the reply on hi-hats in bars 2 and 4","expect":"fail","says":"`mel` and `vox` both play notes and take turns: they rarely start a note on the same beat: `vox` plays no notes, only hh: a call and","code":"mel: n(\"<[0 2 4 ~] ~ [2 4 5 ~] ~>\").scale(\"C4:major\").s(\"piano\")\nvox: s(\"<~ [hh hh hh hh] ~ [hh hh hh hh]>\")"},
  {"owner":"U07.L07","at":"S7","name":"the reply at gain .02","expect":"fail","says":"`mel` and `vox` both play notes and take turns: they rarely start a note on the same beat: nothing plays in","code":"mel: n(\"<[0 2 4 ~] ~ [2 4 5 ~] ~>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<~ [4 ~ 1 ~] ~ [3 ~ 0 ~]>\").scale(\"C4:major\").s(\"rhodes\").gain(.02)"},
  {"owner":"U07.L07","at":"S7","name":"the reply is one 32nd-note blip a bar","expect":"pass","code":"mel: n(\"<[0 2 4 ~] ~ [2 4 5 ~] ~>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<~ [4 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] ~ ~>\").scale(\"C4:major\").s(\"rhodes\")"},
  {"owner":"U07.L08","at":"S7","name":"pickup on beat 4 at gain .02","expect":"fail","says":"Bar 0 starts with a rest, a note sounds on its beat 4, and bar 1 starts on beat 1: bar 0 is empty: the pickup goes in","code":"chords: n(\"<~ [0,2,4] [3,5,7] [4,6,8] [0,2,4]>\").scale(\"C3:major\").s(\"piano\").gain(.6)\nmel: n(\"<[~ ~ ~ -3] [0 ~ 2 ~] [3 ~ 5 ~] [4 ~ 1 ~] [0@4]>\").scale(\"C4:major\").s(\"piano\").gain(\"<.02 1 1 1 1>\")"},
  {"owner":"U12.L05","at":"S7","name":"the cycle rewritten to one Am7; the tune sits on C","expect":"fail","says":"All eight bars of the `mel` line start on the chord's 3rd or 7th: 3 of 8 bars meet","code":"const changes = \"<Am7>\"\nchords: chord(changes).voicing().s(\"rhodes\")\nbass: chord(changes).rootNotes(2).s(\"upright\")\nmel: note(\"<c5 c5 c5 c5 c5 c5 c5 c5>\").s(\"piano\")"},
  {"owner":"U12.L05","at":"S7","name":"each bar's guide tone a 32nd at gain .02, the roots loud after","expect":"fail","says":"All eight bars of the `mel` line start on the chord's 3rd or 7th: 0 of 8 bars meet","code":"const changes = \"<Dm7 G7 C^7 F^7 Bm7b5 E7 Am7 Am7>\"\nchords: chord(changes).voicing().s(\"rhodes\")\nbass: chord(changes).rootNotes(2).s(\"upright\")\nmel: note(\"<[f5 d5@31] [f5 g4@31] [e5 c5@31] [e5 f4@31] [d5 b4@31] [d5 e4@31] [c5 a4@31] [c5 a4@31]>\").gain(\"[.02 1]\").s(\"piano\")"},
  {"owner":"U12.L06","at":"S7","name":"lefthand chords at gain .02, the default voicing on a second loud line","expect":"fail","says":"The chords line reads the left hand's dictionary, `.dict(\"lefthand\")`, before `.voicing()`: not","code":"const changes = \"<C^7 Am7 Dm7 G7>\"\nchords: chord(changes).dict(\"lefthand\").voicing().s(\"rhodes\").gain(.02)\nbass: chord(changes).rootNotes(2).struct(\"x x x x\").s(\"upright\")\nmel: n(\"<[6 ~ 4 ~] [4 ~ 2 ~] [3 ~ 5 ~] [3 ~ 1 ~]>\").scale(\"C5:major\").s(\"piano\")\nkeys: chord(changes).voicing().s(\"rhodes\")"},
  {"owner":"U13.L02","at":"S5","name":"ghosts at .02: inaudible, not ghosts","expect":"fail","says":"Bar 1, 2a: a snare hit went missing. A `~` or a 0 in the velocity","code":"const changes = \"<Dm7 G7>\"\nkick: s(\"bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~\")\nsnare: s(\"~ ~ ~ ~ sd ~ ~ sd ~ sd ~ ~ sd ~ ~ sd\").velocity(\"1 1 1 1 1 1 1 .02 1 .02 1 1 1 1 1 .02\")\nhats: s(\"hh*16\").velocity(\"[1 .4 .7 .4]*4\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x ~ ~ ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~\").s(\"fingerbass\").lpf(800)\ngtr: chord(changes).voicing().struct(\"x*16\").s(\"cleangtr\").velocity(\"[.25 .25 1 .25 .25 1 .25 .25]*2\").clip(.5).gain(.6)"},
  {"owner":"U13.L05","at":"S8","name":"triplets on a new rimshot line over the straight hats and piano","expect":"fail","says":"The piano (`chords:`) or the hats play three even notes on every beat of every bar: not","code":"const changes = \"<C^7 Am7 Dm7 G7>\"\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x ~ x ~\").s(\"fingerbass\").lpf(800)\nchords: chord(changes).voicing().struct(\"x*4\").s(\"piano\").gain(.6)\nperc: s(\"rim*12\").gain(.3)"},
  {"owner":"U13.L05","at":"S8","name":"triplets on a line at gain .02","expect":"fail","says":"The piano (`chords:`) or the hats play three even notes on every beat of every bar: not","code":"const changes = \"<C^7 Am7 Dm7 G7>\"\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x ~ x ~\").s(\"fingerbass\").lpf(800)\nchords: chord(changes).voicing().struct(\"x*4\").s(\"piano\").gain(.6)\nperc: s(\"sh*12\").gain(.02)"},
  {"owner":"U13.L05","at":"S8","name":"triplets in the bass, piano and hats left straight","expect":"fail","says":"The piano (`chords:`) or the hats play three even notes on every beat of every bar: not","code":"const changes = \"<C^7 Am7 Dm7 G7>\"\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x*4\").ply(3).s(\"fingerbass\").lpf(800)\nchords: chord(changes).voicing().struct(\"x*4\").s(\"piano\").gain(.6)"},
  {"owner":"U15.L05","at":"S7","name":"the chain as plain triads: A, D, G, no sevenths","expect":"fail","says":"Three dominant sevenths in a row, A7, D7 and G7, then C, one straight after another:","code":"const changes = \"<C Em A A D G C G7>\"\nchords: chord(changes).voicing().struct(\"~ x ~ x\").s(\"jazzgtr\")\nbass: chord(changes).rootNotes(2).struct(\"x ~ x ~\").s(\"upright\")\nmel: n(\"<[4 ~ 2 4] [4 ~ 6 4] [0 ~ 2 4] [5 ~ ~ ~] [3 ~ 5 3] [4 ~ 3 1] [2 ~ ~ ~] ~>\").scale(\"C4:major\").s(\"trumpet\")"},
  {"owner":"U16.L04","at":"S7","name":"A major only as a 16th at the very end of an Am bar","expect":"fail","says":"The last chord that sounds is A major, the major home chord: not","code":"const changes = \"<Am Dm F E Am Dm E [Am@15 A]>\"\nchords: chord(changes).voicing().struct(\"x x x x\").s(\"piano\")\nbass: chord(changes).rootNotes(2).s(\"upright\")\npad: chord(changes).voicing().s(\"strings\").gain(.4)\nmel: n(\"<[4 ~ 2 0] [3 ~ 0 ~] [5 ~ 2 ~] [1 ~ ~ ~] [4 ~ 2 0] [3 ~ 4 3] [1 ~ 6# ~] [0@3 ~]>\").scale(\"A3:minor\").s(\"acgtr\")"},
  {"owner":"U16.L04","at":"S7","name":"ends on A7: a dominant pulling to D","expect":"fail","says":"The last chord that sounds is A major, the major home chord: not","code":"const changes = \"<Am Dm F E Am Dm E A7>\"\nchords: chord(changes).voicing().struct(\"x x x x\").s(\"piano\")\nbass: chord(changes).rootNotes(2).s(\"upright\")\npad: chord(changes).voicing().s(\"strings\").gain(.4)\nmel: n(\"<[4 ~ 2 0] [3 ~ 0 ~] [5 ~ 2 ~] [1 ~ ~ ~] [4 ~ 2 0] [3 ~ 4 3] [1 ~ 6# ~] [0@3 ~]>\").scale(\"A3:minor\").s(\"acgtr\")"},
  {"owner":"U17.L02","at":"S7","name":"lifted to D minor: Dm chords and a D minor key plan","expect":"fail","says":"Bars 9 to 12 are in D major, a whole step up, with the tune and the chords both lifted:","code":"const chordsVerse = chord(\"<C Am F G>\").voicing().struct(\"x ~ x ~\")\nconst chordsChorus = chord(\"<C G Am F>\").voicing().struct(\"x*4\")\nconst chordsChorus2 = chord(\"<Dm Am Bb Gm>\").voicing().struct(\"x*4\")\nconst bassVerse = n(\"<0 5 3 4>\").struct(\"x ~ ~ x\")\nconst bassChorus = n(\"<0 4 5 3>\").struct(\"x ~ x x\")\nconst melVerse = n(\"<[2 ~ 2 1] [0 ~ ~ ~] [3 ~ 3 2] [1 ~ ~ ~]>\")\nconst melChorus = n(\"<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>\")\nconst melChorus2 = n(\"<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>\")\nchords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsChorus2]).s(\"piano\")\nbass: arrange([4, bassVerse], [4, bassChorus], [4, bassChorus]).scale(\"<C2:major!8 D2:minor!4>\").s(\"ebass\").lpf(700)\nmel: arrange([4, melVerse], [4, melChorus], [4, melChorus]).scale(\"<C4:major!8 D4:minor!4>\").s(\"piano\")"},
  {"owner":"U17.L02","at":"S7","name":"the tune lifted at gain .02","expect":"fail","says":"Bars 9 to 12 are in D major, a whole step up, with the tune and the chords both lifted:","code":"const chordsVerse = chord(\"<C Am F G>\").voicing().struct(\"x ~ x ~\")\nconst chordsChorus = chord(\"<C G Am F>\").voicing().struct(\"x*4\")\nconst chordsChorus2 = chord(\"<D A Bm G>\").voicing().struct(\"x*4\")\nconst bassVerse = n(\"<0 5 3 4>\").struct(\"x ~ ~ x\")\nconst bassChorus = n(\"<0 4 5 3>\").struct(\"x ~ x x\")\nconst melVerse = n(\"<[2 ~ 2 1] [0 ~ ~ ~] [3 ~ 3 2] [1 ~ ~ ~]>\")\nconst melChorus = n(\"<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>\")\nconst melChorus2 = n(\"<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>\")\nchords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsChorus2]).s(\"piano\")\nbass: arrange([4, bassVerse], [4, bassChorus], [4, bassChorus]).scale(\"<C2:major!8 D2:major!4>\").s(\"ebass\").lpf(700)\nmel: arrange([4, melVerse], [4, melChorus], [4, melChorus]).scale(\"<C4:major!8 D4:major!4>\").s(\"piano\").gain(\"<1!8 .02!4>\")"},
  {"owner":"U17.L02","at":"S7","name":"the last chorus sings a new tune","expect":"pass","code":"const chordsVerse = chord(\"<C Am F G>\").voicing().struct(\"x ~ x ~\")\nconst chordsChorus = chord(\"<C G Am F>\").voicing().struct(\"x*4\")\nconst chordsChorus2 = chord(\"<D A Bm G>\").voicing().struct(\"x*4\")\nconst bassVerse = n(\"<0 5 3 4>\").struct(\"x ~ ~ x\")\nconst bassChorus = n(\"<0 4 5 3>\").struct(\"x ~ x x\")\nconst melVerse = n(\"<[2 ~ 2 1] [0 ~ ~ ~] [3 ~ 3 2] [1 ~ ~ ~]>\")\nconst melChorus = n(\"<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>\")\nconst melChorus2 = n(\"<[4 ~ 4 5] [4 ~ 1 ~] [5 ~ 5 7] [7 ~ 5 ~]>\")\nchords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsChorus2]).s(\"piano\")\nbass: arrange([4, bassVerse], [4, bassChorus], [4, bassChorus]).scale(\"<C2:major!8 D2:major!4>\").s(\"ebass\").lpf(700)\nmel: arrange([4, melVerse], [4, melChorus], [4, n(\"<[0 ~ 0 ~] [0 ~ 0 ~] [0 ~ 0 ~] [0 ~ 0 ~]>\")]).scale(\"<C4:major!8 D4:major!4>\").s(\"piano\")"},
  {"owner":"U17.L01","at":"S7","name":"D7 then G7: arrives on C's V7, not on G","expect":"fail","says":"The verse ends in G major, reached by a chord both C and G major own, then G's V, then G:","code":"const changes = \"<C Am F G C Am D7 G7>\"\nchords: chord(changes).voicing().s(\"rhodes\")\nbass: chord(changes).rootNotes(2).s(\"upright\")\nmel: n(\"<[2 ~ 4 2] [0 ~ ~ ~] [3 ~ 5 3] [4 ~ ~ ~] [2 ~ 4 2] [0 ~ 2 ~] [4 ~ 6 4] [7 ~ ~ ~]>\").scale(\"<C4:major!6 G3:major!2>\").s(\"piano\")"},
  {"owner":"C0","at":"brief","name":"the fill in bar 1 on its own line, bar 4 plain","expect":"fail","says":"The last bar is a fill, written with `< >`, playing something the bar before it does not: bar 4, the last of","code":"setcpm(100/4)\n\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\")\nfill: s(\"<[ht ht mt lt] ~ ~ ~>\")"},
  {"owner":"C0","at":"brief","name":"a fill on a line at gain .02","expect":"fail","says":"The last bar is a fill, written with `< >`, playing something the bar before it does not: every bar of your","code":"setcpm(100/4)\n\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\")\nfill: s(\"<~ ~ ~ [ht ht mt lt]>\").gain(.02)"},
  {"owner":"C2","at":"brief","name":"lands V to I6/4: home chord over G in the bass","expect":"fail","says":"bar 8 ends on the home chord with its 5th, G, in the bass","code":"setcpm(96/4)\n\ndrums: s(\"bd ~ sd ~, hh*8\")\nbass: n(\"<0 4 5 3 0 4 4 4>\").scale(\"C2:major\").s(\"ebass\").lpf(600)\nchords: chord(\"<C G Am F C G G C>\").voicing().s(\"piano\")\nmel: n(\"<[0 ~ 2 ~] [1 ~ 4 ~] [0 ~ 2 ~] [0 ~ 3 ~] [0 ~ 2 ~] [1 ~ 4 ~] [1 ~ 4 ~] [0 ~ ~ ~]>\").scale(\"C4:major\").s(\"piano\")"},
  {"owner":"C3","at":"brief","name":"verse and chorus identical but for a pad at gain .02 and a shaker at .02","expect":"fail","says":"The chorus differs from the verse on two counts or more: the chorus","code":"setcpm(80/4)\n\nconst groove = \"x ~ ~ x ~ ~ x ~\"\nconst kickVerse = s(\"bd\").struct(groove)\nconst kickChorus = s(\"bd\").struct(groove)\nconst hatsVerse = s(\"hh*8\").gain(.4)\nconst hatsChorus = s(\"hh*8\").gain(.4)\nconst chordsVerse = chord(\"<C Am F G>\").voicing()\nconst chordsChorus = chord(\"<C Am F G>\").voicing()\nconst bassVerse = n(\"<0 5 3 4>\").struct(groove).scale(\"C2:major\")\nconst bassChorus = n(\"<0 5 3 4>\").struct(groove).scale(\"C2:major\")\nconst melVerse = n(\"<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>\").scale(\"C4:major\")\nconst melChorus = n(\"<[2 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [1 ~ ~ ~]>\").scale(\"C4:major\")\nconst padVerse = silence\nconst padChorus = chord(\"<F G C C>\").voicing().gain(.02)\nconst shVerse = silence\nconst shChorus = s(\"sh*16\").gain(.02)\npad: arrange([8, padVerse], [8, padChorus], [8, padVerse], [8, padChorus]).s(\"piano\")\nperc: arrange([8, shVerse], [8, shChorus], [8, shVerse], [8, shChorus])\nkick: arrange([8, kickVerse], [8, kickChorus], [8, kickVerse], [8, kickChorus])\nsnare: s(\"~ sd ~ sd\")\nhats: arrange([8, hatsVerse], [8, hatsChorus], [8, hatsVerse], [8, hatsChorus])\nchords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus]).s(\"piano\")\nbass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus]).s(\"ebass\").lpf(600)\nmel: arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus]).s(\"piano\")"},
  {"owner":"C6","at":"brief","name":"I–IV with no ♭7 in chords or tune; the ♭7 on beats 1 and 3 only in a line at gain .02","expect":"fail","says":"It sounds Mixolydian or Dorian: the colour note (♭7, or the raised 6)","code":"setcpm(100/4)\n\nconst chordsVamp = chord(\"<G C>\").voicing()\nconst melVamp = n(\"0 2 4 2\").scale(\"G4:mixolydian\")\nconst xVamp = note(\"f4 ~ f4 ~\")\n\nchords: arrange([16, chordsVamp]).s(\"piano\")\nmel: arrange([16, melVamp]).s(\"piano\")\nvox: arrange([16, xVamp]).s(\"piano\").gain(.02)\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\").gain(.5)"},
  {"owner":"U01.L03","at":"S8","name":"a snare on every beat: no backbeat","expect":"fail","says":"In every bar, the snare plays on beats 2 and 4 and not on beats 1 or 3: right in 0 of 16 bars; bar 1, beat 1","code":"kick: s(\"bd ~ bd ~\")\nsnare: s(\"sd*4\")"},
  {"owner":"U01.L03","at":"S8","name":"a snare on every eighth","expect":"fail","says":"In every bar, the snare plays on beats 2 and 4 and not on beats 1 or 3: right in 0 of 16 bars; bar 1, beat 1","code":"kick: s(\"bd ~ bd ~\")\nsnare: s(\"sd*8\")"},
  {"owner":"U01.L06","at":"S7","name":"the four onsets of beat 1 spread over kick, snare and hats, each one sound","expect":"pass","code":"kick: s(\"[bd ~ ~ ~] ~ bd ~\")\nsnare: s(\"[~ sd ~ ~] sd ~ sd\")\nhats: s(\"[~ ~ hh hh] hh hh hh\").gain(.5)"},
  {"owner":"U02.L03","at":"S7","name":"a sharp that is a white key: e#4 (= F)","expect":"fail","says":"At least one note lands on a black key, written with `#` or `b`: `e#4` is written with a sharp","code":"mel: note(\"c4 e4 g4 e#4\").s(\"piano\")"},
  {"owner":"U02.L03","at":"S7","name":"flats that are white keys: fb4, cb5","expect":"fail","says":"At least one note lands on a black key, written with `#` or `b`: `fb4` is written with a sharp","code":"mel: note(\"c4 fb4 g4 cb5\").s(\"piano\")"},
  {"owner":"U03.L04","at":"S7","name":"6 and 7 as two 32nd-note blips","expect":"pass","code":"mel: n(\"<[0 1 2 4] [3 2 1 [~ ~ ~ ~ ~ ~ 5 6]]>\").scale(\"C4:major\").s(\"piano\")"},
  {"owner":"U03.L04","at":"S7","name":"6 and 7 only in a gain .02 line","expect":"fail","says":"The line plays degree 6 and degree 7, each at least once: not","code":"mel: n(\"<[0 1 2 4] [3 2 1 ~]>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<[5 6] ~>\").scale(\"C4:major\").s(\"piano\").gain(.02)"},
  {"owner":"U03.L09","at":"S6","name":"repeated notes with leaps: no steps at all","expect":"fail","says":"At least 6 in 10 moves to a new note are steps, to the next degree up or down: not","code":"mel: n(\"<[0 0 0 0] [4 4 4 4] [0 0 0 0] [4 4 4 4]>\").scale(\"C4:major\").s(\"piano\")"},
  {"owner":"U05.L04","at":"S5","name":"arp(\"0\"): only the lowest note, nothing broken","expect":"fail","says":"The `chords` line plays its stacks one note at a time, with `.arp()`: not","code":"chords: n(\"<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>\").arp(\"0\").scale(\"C3:major\").s(\"piano\")"},
  {"owner":"U05.L04","at":"S5","name":"arp(\"[0,1,2]\"): stacked back into a block","expect":"fail","says":"The `chords` line plays its stacks one note at a time, with `.arp()`: not","code":"chords: n(\"<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>\").arp(\"[0,1,2]\").scale(\"C3:major\").s(\"piano\")"},
  {"owner":"U07.L04","at":"S7","name":"two passing tones as 32nd blips","expect":"pass","code":"chords: n(\"<[0,2,4] [3,5,7]>\").scale(\"C3:major\").s(\"piano\").gain(.6)\nmel: n(\"<[0 ~ [~ ~ ~ 1] 2] [5 ~ [~ ~ ~ 4] 3] [0 ~ 4 ~] [7 ~ 5 ~]>\").scale(\"C4:major\").s(\"piano\")"},
  {"owner":"U07.L07","at":"S5","name":".off(0, …): the copy sounds with the call, no echo","expect":"fail","says":"`.off()` plays the call again, later than the call and not on top of it: no echo is heard: the copy","code":"mel: n(\"<[0 2 4 ~] ~ [5 4 2 ~] ~>\").scale(\"C4:major\").off(0, x => x.scaleTranspose(2)).s(\"piano\")"},
  {"owner":"U07.L07","at":"S5","name":".off(1/4, …) with the echo at gain 0","expect":"fail","says":"`.off()` plays the call again, later than the call and not on top of it: no echo is heard: the copy","code":"mel: n(\"<[0 2 4 ~] ~ [5 4 2 ~] ~>\").scale(\"C4:major\").off(1/4, x => x.scaleTranspose(2).gain(0)).s(\"piano\")"},
  {"owner":"U07.L07","at":"S5","name":".off(4, …): four bars later in a four-bar loop, on top of the call","expect":"fail","says":"`.off()` plays the call again, later than the call and not on top of it: no echo is heard: the copy","code":"mel: n(\"<[0 2 4 ~] ~ [5 4 2 ~] ~>\").scale(\"C4:major\").off(4, x => x.scaleTranspose(2)).s(\"piano\")"},
  {"owner":"U07.L10","at":"S5","name":".degradeBy(0): nothing ever changes","expect":"fail","says":"No chance yet: every repeat is still the same. Add `.degradeBy()` or","code":"mel: n(\"<[7 ~ 7 5] [4 ~ 4 2] [7 ~ 7 5] [5 ~ 5 3]>\").scale(\"C4:major\").degradeBy(0).s(\"piano\")"},
  {"owner":"U07.L10","at":"S5","name":".sometimesBy(.25, x => x): the change is no change","expect":"fail","says":"No chance yet: every repeat is still the same. Add `.degradeBy()` or","code":"mel: n(\"<[7 ~ 7 5] [4 ~ 4 2] [7 ~ 7 5] [5 ~ 5 3]>\").scale(\"C4:major\").sometimesBy(.25, x => x).s(\"piano\")"},
  {"owner":"U07.L10","at":"S5","name":"a ? on a rest","expect":"fail","says":"No chance yet: every repeat is still the same. Add `.degradeBy()` or","code":"mel: n(\"<[7 ~? 7 5] [4 ~ 4 2] [7 ~ 7 5] [5 ~ 5 3]>\").scale(\"C4:major\").s(\"piano\")"},
  {"owner":"U11.L03","at":"S7","name":"the blue note on a gain .02 riff copy; the heard riff still sweet","expect":"fail","says":"The gtr line plays at least one blue note: ♭3, ♭5 or ♭7: not","code":"chords: chord(\"<C F>\").voicing().s(\"organ\").gain(.5)\nbass: chord(\"<C F>\").rootNotes(2).s(\"ebass\").lpf(600)\ngtr: n(\"<[0 1 2 3] [4 ~ 3 2]>\").scale(\"C3:major:pentatonic\").s(\"acgtr\").superimpose(x => x.scale(\"C3:blues\").gain(.02))"},
  {"owner":"U13.L04","at":"S8","name":"a snare on every eighth: no second beat marked","expect":"fail","says":"In every bar, a snare on the fourth eighth (beat 2) and none on the first three eighths: not","code":"const changes = \"<Am7 Dm7 F^7 G7>\"\nkick: s(\"bd ~ ~ ~ ~ ~\")\nsnare: s(\"sd*6\")\nhats: s(\"hh*6\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x ~ ~ ~ ~ ~\").s(\"fingerbass\").lpf(800)\nchords: chord(changes).voicing().s(\"rhodes\")"},
  {"owner":"U13.L04","at":"S8","name":"the snare on beat 2 and on beat 1 too","expect":"fail","says":"In every bar, a snare on the fourth eighth (beat 2) and none on the first three eighths: not","code":"const changes = \"<Am7 Dm7 F^7 G7>\"\nkick: s(\"bd ~ ~ ~ ~ ~\")\nsnare: s(\"sd ~ ~ sd ~ ~\")\nhats: s(\"hh*6\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x ~ ~ ~ ~ ~\").s(\"fingerbass\").lpf(800)\nchords: chord(changes).voicing().s(\"rhodes\")"},
  {"owner":"U02.L08","at":"your-arrangement","name":"now-fails: room 0.05 (a small room)","expect":"pass","code":"setcpm(96/4)\n\nmel: note(\"<[e4 e4 f4 g4] [g4 f4 e4 d4] [c4 c4 d4 e4] [e4 d4 d4@2]>\").s(\"piano\").room(0.05)"},
  {"owner":"U04.L02","at":"named-harmony","name":"now-fails: an octave 8P","expect":"fail","says":"A second line plays every note of the riff at the same time, moved by an interval name in `.transpose()` (not an octave):","code":"setcpm(92/4)\n\nmel: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").s(\"piano\")\nvox: note(\"<[c4 g4 c4 ~] [f4 g4 f4 ~]>\").transpose(\"8P\").s(\"triangle\").gain(.4)"},
  {"owner":"U04.L04","at":"answer-the-riff","name":"now-fails: answer in bar 2 on a second line","expect":"pass","code":"setcpm(96/4)\n\nmel: note(\"<[c4 e4 g4 e4] ~>\").s(\"piano\")\nvox: note(\"<~ [f4 a4 c5 a4]>\").s(\"piano\")"},
  {"owner":"U07.CP","at":"checkpoint-hook","name":"now-fails: a response on vox, the hook in bars 1 and 3","expect":"pass","code":"setcpm(88/4)\n\nmel: n(\"<[2 4 2 0] [6 5 4 ~] [2 4 2 0] [3 2 1 0]>\").scale(\"C4:major\").s(\"piano\")\nvox: n(\"<[~ ~ ~ 4] ~ [~ ~ ~ 4] ~>\").scale(\"C4:major\").s(\"piano\").gain(.6)"},
  {"owner":"A1.L04","at":"two-rooms","name":"now-fails: orbit as a string","expect":"pass","code":"setcpm(100/4)\n\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\").room(.5).roomsize(6).orbit(\"2\")\nhats: s(\"hh*8\").gain(.5)\nmel: n(\"<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>\").scale(\"C4:major\").s(\"square\").lpf(2000).room(.3).roomsize(1).gain(.8)"},
  {"owner":"U12.L06","at":"your-trio","name":"now-fails: the comping line labelled gtr on the jazz guitar","expect":"pass","code":"setcpm(112/4)\n\nconst changes = \"<C^7 Am7 Dm7 G7>\"\n\ngtr: chord(changes).dict(\"lefthand\").voicing().struct(\"x ~ ~ x ~ ~ x ~\").s(\"jazzgtr\")\nbass: chord(changes).rootNotes(2).struct(\"x x x x\").s(\"upright\")\nmel: n(\"<[6 ~ 4 ~] [4 ~ 2 ~] [3 ~ 5 ~] [3 ~ 1 ~]>\").scale(\"C5:major\").s(\"piano\")\n"},
  {"owner":"U13.L05","at":"your-slow-dance","name":"now-fails: a ride line of its own in triplets","expect":"pass","code":"setcpm(76/4)\n\nconst changes = \"<C^7 Am7 Dm7 G7>\"\n\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x ~ x ~\").s(\"fingerbass\").lpf(800)\nchords: chord(changes).voicing().struct(\"x*4\").s(\"piano\").gain(.6)\nride: s(\"rd*12\").gain(.3)"},
  {"owner":"U13.L05","at":"your-slow-dance","name":"now-fails: the triplets on a 12/8-style bass instead","expect":"fail","says":"The piano (`chords:`) or the hats play three even notes on every beat of every bar: not","code":"setcpm(76/4)\n\nconst changes = \"<C^7 Am7 Dm7 G7>\"\n\nkick: s(\"bd ~ bd ~\")\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\").gain(.5)\nbass: chord(changes).rootNotes(2).struct(\"x*12\").s(\"fingerbass\").lpf(800)\nchords: chord(changes).voicing().struct(\"x*4\").s(\"piano\").gain(.6)\n"},
  {"owner":"U13.L06","at":"take-the-shuffle-down","name":"now-fails: swingBy(.33, 4)","expect":"pass","code":"setcpm(92/4)\n\nkick: s(\"<[bd ~ ~ bd bd ~ ~ ~] [bd ~ ~ ~ ~ bd ~ bd]>\").swingBy(.33, 4)\nsnare: s(\"~ sd ~ sd\")\nhats: s(\"hh*8\").swingBy(.33, 4).gain(.5)\nchords: chord(\"<C7 F7>\").voicing().s(\"organ\").gain(.5)"},
  {"owner":"U17.L01","at":"a-verse-that-leaves-home","name":"now-fails: arrives on G7","expect":"fail","says":"The verse ends in G major, reached by a chord both C and G major own, then G's V, then G:","code":"setcpm(96/4)\n\nconst changes = \"<C Am F G C Am D7 G7>\"\n\nchords: chord(changes).voicing().s(\"rhodes\")\nbass: chord(changes).rootNotes(2).s(\"upright\")\nmel: n(\"<[2 ~ 4 2] [0 ~ ~ ~] [3 ~ 5 3] [4 ~ ~ ~] [2 ~ 4 2] [0 ~ 2 ~] [4 ~ 6 4] [7 ~ ~ ~]>\").scale(\"<C4:major!6 G3:major!2>\").s(\"piano\")"},
  {"owner":"U07.L10","at":"your-hook","name":"now-fails: hint 3: bar 1 copied into bar 3, the rest as the starter","expect":"pass","code":"setcpm(104/4)\n\nmel: n(\"<[2 0 4 1] [6 8 4 5] [2 0 4 1] [3 5 0 5]>\").scale(\"C4:major\").s(\"piano\")"},
];

const STATED = new Set(["major", "minor", "mixolydian", "dorian", "lydian", "phrygian"]);
const statedKey = (code: string): KeySpec | null => {
  const m = /\.scale\("<?\s*([A-G][#b]?)-?\d*:([a-z]+)[\s!">]/.exec(code);
  return m && STATED.has(m[2] as string) ? ({ tonic: m[1], mode: m[2] } as KeySpec) : null;
};

async function target(
  p: Pin,
): Promise<{ ex: Exercise; lesson: never; session: string; mode: "lesson" | "capstone" }> {
  const cp = /^(U\d\d)\.CP$/.exec(p.owner);
  const lesson = /^(U\d\d|A\d)\.(L\d\d)$/.exec(p.owner);
  if (cp) {
    const def = (await import(`../core/${cp[1]}/CP/checkpoint.ts`)).default;
    const all = [...def.authored, def.make].flatMap((e: Exercise) => flattenExercise(e));
    const ex = p.at === "make" ? def.make : all.find((e: Exercise) => e.id === p.at);
    const mk = def.make;
    const ctx = {
      id: def.id,
      key: mk.key ?? { tonic: "C", mode: "major" },
      meter: mk.meter ?? "4/4",
      bpm: typeof mk.bpm === "number" ? mk.bpm : 96,
    };
    return { ex, lesson: ctx as never, session: def.id, mode: "lesson" };
  }
  if (lesson) {
    const dir = lesson[1]?.startsWith("A") ? "advanced" : "core";
    const def = (await import(`../${dir}/${lesson[1]}/${lesson[2]}/lesson.ts`)).default;
    const step = def.steps.find((s: { id: string }) => s.id === p.at);
    const all = def.steps.flatMap((s: { exercise?: Exercise }) =>
      s.exercise ? flattenExercise(s.exercise) : [],
    );
    const ex = step?.exercise
      ? (flattenExercise(step.exercise).find((x: Exercise) => x.kind !== "all") ?? step.exercise)
      : all.find((e: Exercise) => e.id === p.at);
    return { ex, lesson: def as never, session: def.id, mode: "lesson" };
  }
  const cap = capstones.find((c) => c.id === p.owner);
  if (!cap?.brief) throw new Error(`no owner ${p.owner}`);
  const key = cap.key ?? statedKey(p.code) ?? { tonic: "C", mode: "major" };
  const ctx = {
    id: cap.id,
    key,
    meter: cap.meter,
    bpm: cap.bpm ? Math.round((cap.bpm[0] + cap.bpm[1]) / 2) : 100,
  };
  return {
    ex: cap.brief as Exercise,
    lesson: ctx as never,
    session: cap.sessionDefs[0]?.id as string,
    mode: "capstone",
  };
}

describe("corrections gate: wrong answers fail with a line to act on, right answers pass", () => {
  for (const p of PINS)
    test(`${p.owner} ${p.at}: ${p.name} (${p.expect})`, async () => {
      const t = await target(p);
      expect(t.ex).toBeDefined();
      const tempo = t.mode === "capstone" || /setcp[ms]\(/.test(p.code) ? "" : "setcpm(96/4)\n\n";
      const r = await grade(
        t.ex,
        { name: p.name, response: { code: tempo + p.code }, expect: p.expect } as never,
        t.lesson,
        t.session as never,
        t.mode,
      );
      expect(r.passed).toBe(p.expect === "pass");
      if (p.says) expect((r.messages ?? []).join("\n")).toContain(p.says);
    });
});

describe("corrections gate: the words attack:theory found false (A1–A10)", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  test("A1 U15.L03: the outside note is found by ear, not by its place at the top of the chord", () => {
    const t = read("../core/U15/L03/lesson.ts");
    expect(t).not.toContain("hum the top note of bar 2");
    expect(t).not.toContain("Hum the top of bar 2");
    expect(t).toContain("find the note in bar 2 that is not in C major");
  });
  test("A2 the six Wave 6 decks: no format example is the card's own answer", async () => {
    const { WAVE6_DECKS } = await import("../decks/index.ts");
    let checked = 0;
    for (const d of WAVE6_DECKS)
      for (const c of d.cards) {
        const text = c.prompt.text ?? "";
        const answers = "text" in c.answer ? (c.answer.text as string[]) : [];
        for (const m of text.matchAll(/\(([^()]*)\)/g)) {
          const shown = (m[1] as string).split(/,\s*/);
          for (const a of answers) expect(shown).not.toContain(a);
          checked++;
        }
      }
    expect(checked).toBeGreaterThan(9);
  });
  test("A3 U06.L11: no seventh-chord name before U12, and G is in the key of A minor", () => {
    const t = read("../core/U06/L11/lesson.mdx");
    expect(t).not.toContain("Am7");
    expect(t).not.toContain("not in A minor at all");
  });
  test("A4 U17.L04, A5 U12.L02, A6 U14.L04, A7 U05.L08: the corrected sentences", () => {
    expect(read("../core/U17/L04/lesson.ts")).toContain("neighbouring keys on the keyboard, black or white");
    expect(read("../core/U12/L02/lesson.mdx")).toContain("the other leans on toward the chord a 5th below");
    expect(read("../core/U14/L04/lesson.ts")).toContain("the 4th sits only a half step under 5");
    expect(read("../core/U05/L08/lesson.ts")).toContain("an anchor below D5 keeps them there");
  });
  test("A8 test names say what the code plays; A10 the U11 pool no longer names Scarborough Fair", () => {
    expect(read("../core/U08/L01/lesson.ts")).toContain('"roots held, a push on beat 4"');
    expect(read("../core/U06/L04/lesson.ts")).toContain('"IV, V, I at the end, the V on bar 7"');
    expect(read("../capstones.ts")).toContain('const melVamp = n("2 0 6 0").scale("G4:mixolydian")');
    expect(read("../specs/U11.md")).not.toContain("Scarborough");
  });
  test("A9 glossary examples keep STYLE order: drums, bass, chords, melody", async () => {
    const { terms } = await import("../terms.ts");
    for (const id of ["term.line-cliche", "term.comping"]) {
      const ex = terms.find((t) => t.id === id)?.example ?? "";
      const at = (label: string) => ex.indexOf(`${label}:`);
      if (at("chords") >= 0 && at("bass") >= 0) expect(at("bass")).toBeLessThan(at("chords"));
      if (at("chords") >= 0 && at("drums") >= 0) expect(at("drums")).toBeLessThan(at("chords"));
    }
  });
});
