// The live examples of the tools the advanced tracks unlock (Wave 7: jazz harmony J1–J5 and JC2, advanced rhythm
// R1–R3, arrangement and sound A1.L05–A2.L06 and AC2): each plays its tool inside a short groove that sounds like
// the music the track is for, and uses only what its unlock site guarantees on the earliest legal route (contracts
// §2.6, AUTHORING §20.1: the jazz and rhythm tracks from U13.CP — no mode names, no chromatic steps, no horns;
// A1.L05–L07 from U09.CP — no minor keys, no dominant sevenths, no swing, no sevenths; A2 from U10.CP — no dominant
// sevenths, no swingBy). Each was linted at its site and played in headless Strudel, and the musical claim of each
// hint read off the events (demos-w7.test.ts). Where a lens shows the tool at work, the hint says which.
import type { ToolDemo } from "./demos.ts";

/** A jazz trio in C (J1.L01's): the ride and hi-hat on the jazz kit, an upright bass in two, Rhodes comping. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd], ~ hh ~ hh").swingBy(1/3, 4).bank("jazzkit")';
const BASS_TWO = 'bass: note("<[d2 a1] [g1 d2] [c2 g1] [c2 e2]>").s("upright")';
const COMP =
  'chords: chord("<Dm7 G7 C^7 C^7>").dict("lefthand").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)';
const trio = (...lines: string[]) => ["setcpm(120/4)", "", ...lines].join("\n");

/** A straight pop groove in C for the sound tools (A1.L05–L07: major, triads, no swing). */
const POP_DRUMS = 'drums: s("bd ~ sd ~, hh*8").gain(.8)';
const pop = (bpm: number, ...lines: string[]) => [`setcpm(${bpm}/4)`, "", POP_DRUMS, ...lines].join("\n");

export const TRACK_TOOL_DEMOS: Readonly<Record<string, ToolDemo>> = {
  // --- J1 Swing, sevenths in jazz names, ii–V–I, guide tones, shells ------------------------------------------
  "snd.jazzkit": {
    code: trio(RIDE, BASS_TWO, COMP),
    hint: "The jazz kit's ride cymbal plays every beat with a short hit just before beats 3 and 1, swung long–short; the hi-hat closes on 2 and 4. Change .swingBy(1/3, 4) to .swingBy(0, 4) and press Run: the same hits, straight.",
  },
  "snd.vibes": {
    code: trio(
      RIDE,
      BASS_TWO,
      COMP,
      'mel: n("<[3 ~ 5 0] [1 ~ 3 ~] [2 4 6 4] [2 ~ ~ ~]>").scale("C4:major").swingBy(1/3, 4).s("vibes")',
    ),
    hint: "The vibraphone: struck metal bars with a soft, ringing tone, the lead voice of many jazz trios. Every note it plays on a beat belongs to the chord under it.",
  },
  "chord.sixth-sus": {
    code: trio(
      RIDE,
      'chords: chord("<C6 Dm7 [G7sus G7] C6>").voicing().s("rhodes").gain(.6)',
      'bass: chord("<C6 Dm7 G7 C6>").rootNotes(2).s("upright")',
    ),
    hint: "C6 adds the 6th, A, to C major instead of a 7th: the home chord of a swing tune. In bar 3, G7sus holds C where G7 has B, then G7 lets it fall to B. Delete sus and press Run to hear the plain G7 from the start of the bar.",
  },
  "tb.feature.jazz-glyphs": {
    code: trio(
      RIDE,
      'chords: chord("<Dm7 G7 C^7 [Bm7b5 E7]>").dict("lefthand").voicing().s("rhodes").gain(.55)',
      'bass: chord("<Dm7 G7 C^7 [Bm7b5 E7]>").rootNotes(2).s("upright")',
      'mel: n("<[3 ~ 5 ~] [1 ~ 3 ~] [2 ~ 6 4] [3 ~ 1 ~]>").scale("C4:major").swingBy(1/3, 4).s("vibes")',
    ),
    panels: { lead: true },
    hint: "The chord band and the lead sheet now write chords as jazz charts do: D–7 for a minor seventh, C∆7 for a major seventh, Bø7 for a half-diminished seventh. The notes are the same; only the names change. In your code they stay Dm7, C^7, Bm7b5.",
  },
  "tb.dict.guidetones": {
    code: trio(
      RIDE,
      'chords: chord("<Dm7 G7 C^7 C^7>").dict("guidetones").voicing().s("rhodes").gain(.7)',
      'bass: chord("<Dm7 G7 C^7 C^7>").rootNotes(2).s("upright")',
    ),
    hint: "Two notes a chord, the 3rd and the 7th: F and C, then F and B, then E and B. From chord to chord one note stays and the other moves a half step. Guide tones (Shift+I) join them into their two lines on the roll.",
  },
  "tb.set": {
    code: trio(
      'const changes = "<Dm7 G7 C^7 C^7>"',
      "",
      RIDE,
      'chords: chord(changes).dict("lefthand").voicing().s("rhodes").gain(.5)',
      'bass: chord(changes).rootNotes(2).s("upright")',
      'mel: n("[0 1 2 3]").set(chord(changes)).voicing().s("vibes")',
    ),
    hint: "One set of changes drives the chords, the bass and the tune: .set(chord(changes)) gives the n numbers the chord of each bar, and n climbs through its notes, lowest first. Change one chord in changes and all three follow.",
  },
  "tb.voicing.n": {
    code: trio(
      'const changes = "<Dm7 G7 C^7 C^7>"',
      "",
      RIDE,
      'chords: chord(changes).dict("lefthand").voicing().s("rhodes").gain(.5)',
      'bass: chord(changes).rootNotes(2).s("upright")',
      'mel: n("<[0 1 2 3] [3 2 1 0] [0 2 1 3] [3 ~ ~ ~]>").chord(changes).voicing().s("vibes")',
    ),
    hint: "n picks notes out of each chord's voicing, 0 the lowest: the tune walks up Dm7, down G7, then skips through C∆7. The Voicings switch labels the Rhodes chords as dictionary voicings: their shape is lefthand's, not yours.",
  },
  // --- J2 All twelve keys, minor ii–V–i, extensions, chord-scales --------------------------------------------
  "chord.alt": {
    code: trio(
      RIDE,
      'chords: chord("<Dm7b5 G7b9 Cm7 Cm7>").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.6)',
      'bass: note("<[d2 ab1] [g1 d2] [c2 g1] [c2 eb2]>").s("upright")',
    ),
    hint: "The minor two-five-one: Dm7♭5 (half-diminished: D F A♭ C) and G7♭9 (G B D F A♭) lead home to C minor. The ♭9 of G7, A♭, is a note of C minor itself; the 5th of the first chord is the same A♭.",
  },
  "chord.ext": {
    code: trio(
      RIDE,
      'chords: chord("<Dm9 G13 C^9 C^9>").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.55)',
      'bass: chord("<Dm9 G13 C^9 C^9>").rootNotes(2).s("upright")',
      'mel: note("<[e5 ~ d5 c5] [e5 ~ ~ b4] [d5 ~ b4 g4] [d5 ~ ~ ~]>").swingBy(1/3, 4).s("vibes")',
    ),
    hint: "Extensions stack thirds past the 7th: Dm9 adds E, G13 adds E over G7, C∆9 adds D. The tune leans on them: E over Dm9 is the 9, E over G13 the 13, D over C∆9 the 9. Tensions (Shift+X) names each one over its chord.",
  },
  "tb.dict.ireal-ext": {
    code: trio(
      RIDE,
      'chords: chord("<Dm9 G13 C^9 C^9>").dict("ireal-ext").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.55)',
      'bass: chord("<Dm9 G13 C^9 C^9>").rootNotes(2).s("upright")',
    ),
    hint: 'The ireal-ext dictionary voices extended chords the way a jazz pianist would: each chord sounds with its colour note inside the voicing, E in Dm9, E in G13 (the 13th), D in C∆9. Delete .dict("ireal-ext") and press Run to hear the default dictionary\'s shapes.',
  },
  "scale.locrian": {
    code: trio(
      RIDE,
      'chords: chord("<Bm7b5 E7 Am7 Am7>").voicing().s("rhodes").gain(.5)',
      'bass: chord("<Bm7b5 E7 Am7 Am7>").rootNotes(2).s("upright")',
      'mel: n("<[0 1 2 3] [6 4 3 1] [0 2 4 2] [0 ~ ~ ~]>").scale("<B3:locrian A3:harmonic:minor A3:minor A3:minor>").s("vibes")',
    ),
    hint: "B Locrian over Bm7♭5: the half-diminished chord's own scale, with C, a half step above its root. Over E7 the line takes G♯ from A harmonic minor, then lands home on A minor. Chord-scales (Shift+Q) writes a common choice of scale under each chord.",
  },
  "scale.altered": {
    code: trio(
      RIDE,
      'chords: chord("<Dm7 G7alt C^7 C^7>").voicing().s("rhodes").gain(.5)',
      'bass: chord("<Dm7 G7alt C^7 C^7>").rootNotes(2).s("upright")',
      'mel: n("<[0 2 4 6] [7 6 5 4] [2 ~ 0 ~] [~ ~ ~ ~]>").scale("<D4:dorian G3:altered C4:major C4:major>").s("vibes")',
    ),
    hint: "G altered over G7alt: G with every colour note bent (A♭, B♭, D♭, E♭) and the 3rd and 7th kept. Over the dominant it pulls hard toward C. Chord-scales (Shift+Q) names the scale under each chord.",
  },
  "scale.lydian-dominant": {
    code: trio(
      RIDE,
      'chords: chord("<C^7 D7 Dm7 G7>").voicing().s("rhodes").gain(.5)',
      'bass: chord("<C^7 D7 Dm7 G7>").rootNotes(2).s("upright")',
      'mel: n("<[2 ~ 4 ~] [0 2 3 4] [2 ~ 0 ~] [4 ~ ~ ~]>").scale("<C4:major D4:lydian:dominant D4:dorian G3:mixolydian>").s("vibes")',
    ),
    hint: "D Lydian dominant over D7: a dominant scale with a raised 4th, G♯, the bright ♯11 that sits well over D7 going to Dm7. Chord-scales (Shift+Q) writes the scale under each chord.",
  },
  "scale.bebop": {
    code: trio(
      RIDE,
      'chords: chord("<Dm7 G7 C^7 C^7>").voicing().s("rhodes").gain(.5)',
      'bass: chord("<Dm7 G7 C^7 C^7>").rootNotes(2).s("upright")',
      'mel: n("<[7 6 5 4 3 2 1 0] [8 7 6 5 4 3 2 1] [0 ~ ~ ~] [~ ~ ~ ~]>").scale("<D4:dorian G3:bebop C4:major C4:major>").swingBy(1/3, 4).s("vibes")',
    ),
    hint: "The bebop scale over G7 adds F♯ between F and G: eight notes, so the run down in eighths in bar 2 puts G, F, D and B, the notes of G7, on the beats, and lands on C. Bar 1 runs down D Dorian for comparison: seven notes, so the beats fall elsewhere.",
  },
  // --- J3 Rootless voicings, drop-2, comping, walking bass -------------------------------------------------------
  "tb.mode.duck": {
    code: trio(
      RIDE,
      'chords: chord("<Dm7 G7 C^7 C^7>").dict("lefthand").anchor("<f4 f4 e4 e4>").mode("duck").voicing().s("rhodes").gain(.55)',
      'bass: chord("<Dm7 G7 C^7 C^7>").rootNotes(2).s("upright")',
      'mel: note("<f4 f4 e4 e4>").s("vibes")',
    ),
    hint: 'mode("duck") voices each chord at or below the anchor and leaves the anchor\'s own note out, so the chord never doubles the tune. Give .anchor() the tune\'s notes. Delete .mode("duck") to hear the Rhodes play F and E with the vibes.',
  },
  "tb.offset": {
    code: trio(
      RIDE,
      'chords: chord("<Dm7 G7 C^7 C^7>").dict("lefthand").offset(1).voicing().s("rhodes").gain(.55)',
      'bass: chord("<Dm7 G7 C^7 C^7>").rootNotes(2).s("upright")',
    ),
    hint: ".offset(1) picks the next voicing up from the one .voicing() would choose: in lefthand that swaps the two rootless positions, so C^7 plays E G B D (3rd lowest) instead of B D E G (7th lowest). Try .offset(0) and .offset(2).",
  },
  // --- J4 Jazz blues, rhythm changes, standards ---------------------------------------------------------------
  "snd.mutetpt": {
    code: trio(
      RIDE,
      'chords: chord("<F7 Bb7 F7 [Cm7 F7]>").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("rhodes").gain(.5)',
      'bass: note("<[f2 a2 c3 a2] [bb1 d2 f2 d2] [f2 a2 c3 a2] [c2 eb2 f2 a1]>").s("upright")',
      'mel: n("<[0 2 3 ~] [4 ~ 3 2] [0 ~ ~ ~] [~ ~ 2 3]>").scale("F4:blues").swingBy(1/3, 4).s("mutetpt")',
    ),
    hint: "The muted trumpet: a trumpet with a mute in its bell, close and buzzing. It plays a blues riff in F over the first four bars of the jazz blues, with a walking bass under it.",
  },
  "tb.template.jazz-blues-f": {
    code: [
      "setcpm(132/4)",
      "",
      'const changes = "<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]>"',
      "",
      RIDE,
      'chords: chord(changes).dict("lefthand").voicing().struct("x ~ ~ x ~ x ~ ~").swingBy(1/3, 4).s("rhodes").gain(.55)',
      'bass: chord(changes).rootNotes(2).struct("x x x x").s("upright")',
    ].join("\n"),
    bars: 12,
    hint: "The jazz blues in F, twelve bars: the blues' F7, B♭7 and C7, with a ii–V into bar 5 (Cm7 F7), a passing B°7, and the ii–Vs of the last four bars. Write a head over it, or walk the bass.",
  },
  // --- R1 Metric weight, swing ratios, the one, interlock, displacement ------------------------------------------
  "tb.swing.patterned": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("bd ~ sd ~, hh*8").swingBy("<0 .1 .2 .33>", 4)',
      'bass: note("<[c2 ~ c2 g1] [a1 ~ a1 e1] [f1 ~ f1 c2] [g1 ~ g1 d2]>").s("fingerbass")',
      'chords: chord("<C Am F G>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)',
    ].join("\n"),
    hint: "The swing changes bar by bar: 0 is straight, .1 a slight lean (11:9), .2 a 3:2 swing, .33 close to 2:1, the triplet swing of jazz. The Swing switch over the roll draws each swung hat against its straight place, in milliseconds.",
  },
  "snd.clav": {
    code: [
      "setcpm(100/4)",
      "",
      'drums: s("bd ~ ~ bd ~ ~ bd ~, ~ sd ~ sd, hh*16")',
      'keys: chord("<Cm7 F7>").voicing().struct("~ x ~ x ~ x x ~ ~ x ~ x ~ x ~ x").velocity("[1 .4 .8 .4]*4").s("clav")',
      'bass: note("<[c2 ~ ~ c2 ~ ~ eb2 ~ c2 ~ ~ ~ g1 ~ bb1 ~] [f1 ~ ~ f1 ~ ~ a1 ~ f1 ~ ~ ~ c2 ~ eb2 ~]>").s("fingerbass")',
    ].join("\n"),
    hint: "The clavinet: a keyboard whose strings are struck and damped at once, short and percussive, the sound of 1970s funk. It plays sixteenths on Cm7 and F7, some hits quieter (.velocity), the ghost notes of the groove.",
  },
  // --- R2 Odd meters, hemiola, polyrhythm, polymeter ---------------------------------------------------------
  "tb.meter.odd": {
    code: [
      "setcpm(240/7)",
      "",
      'drums: s("bd ~ sd ~ bd sd ~")',
      'hats: s("hh*7").gain("1 .5 1 .5 1 .5 .5")',
      'bass: note("<[c2 ~ c2 ~ g1 ~ ~] [bb1 ~ bb1 ~ f1 ~ ~]>").s("fingerbass")',
      'chords: chord("<C Bb>").voicing().struct("x ~ x ~ x ~ ~").s("rhodes").gain(.5)',
    ].join("\n"),
    meter: "7/8",
    hint: "7/8: seven eighths a bar, felt as 2+2+3 (count 1 2 | 1 2 | 1 2 3). setcpm(240/7) counts 240 eighths a minute. The hi-hat is louder on each group's first eighth, and the roll draws the three groups with their counts on its ruler.",
  },
  "tb.mini.polymeter": {
    code: [
      "setcpm(100/4)",
      "",
      'perc: s("{rim rim cb}%4")',
      'kick: s("bd ~ bd ~, ~ sd ~ sd")',
      'bass: note("<c2 c2 f1 g1>").struct("x ~ x x").s("fingerbass")',
    ].join("\n"),
    bars: 3,
    hint: "{rim rim cb}%4 plays a cycle of three sounds at four steps a bar, so the cowbell lands somewhere new each bar and lines up with the bar again after three. The Pulse lanes switch draws the cycle against the bar.",
  },
  // --- R3 Tresillo, clave, Euclid --------------------------------------------------------------------------
  "tb.mini.euclid": {
    code: [
      "setcpm(100/4)",
      "",
      'kick: s("bd(3,8)")',
      'hats: s("hh*8").gain(.4)',
      'bass: note("<c2 c2 f1 g1>").struct("x(3,8)").s("fingerbass")',
      'chords: chord("<C C F G>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)',
    ].join("\n"),
    hint: "bd(3,8): three hits spread as evenly as eight steps allow, on steps 1, 4 and 7: 3+3+2, the tresillo. The bass plays the same three places. Try (5,8) for the cinquillo.",
  },
  "tb.mini.euclid-rot": {
    code: [
      "setcpm(100/4)",
      "",
      'kick: s("bd ~ ~ bd")',
      'perc: s("rim(5,16,10)")',
      'hats: s("hh*8").gain(.35)',
      'chords: chord("<C^7 Dm7>").voicing().s("rhodes").gain(.5)',
    ].join("\n"),
    hint: "rim(5,16,10): five hits in sixteen steps, the pattern turned ten steps: 3+3+4+3+3, the rim of a bossa nova. Change the 10 to 0 to hear the same five hits start on the beat.",
  },
  "tb.euclid": {
    code: [
      "setcpm(100/4)",
      "",
      'perc: s("rim").euclid(5, 8)',
      'kick: s("bd ~ bd ~")',
      'bass: note("<c2 c2 g1 g1>").euclid(5, 8).s("fingerbass")',
    ].join("\n"),
    hint: ".euclid(5, 8): five hits spread over eight steps, 2+1+2+1+2: the cinquillo, on the rim and the bass together. It does what the mini-notation's (5,8) does, as a function you can chain.",
  },
  "tb.euclidRot": {
    code: [
      "setcpm(100/4)",
      "",
      'kick: s("bd(3,8)")',
      'perc: s("rim").euclidRot(3, 8, 1)',
      'hats: s("hh*8").gain(.35)',
      'chords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)',
    ].join("\n"),
    hint: ".euclidRot(3, 8, 1): the tresillo of the kick turned by one step, so the rim answers the kick in the spaces between its hits. Change the 1 to 0 and the two play together.",
  },
  // --- AC2 Neo-soul ballad ----------------------------------------------------------------------------------
  "snd.choir": {
    code: [
      "setcpm(72/4)",
      "",
      'drums: s("bd ~ ~ ~, ~ ~ sd ~, hh*8").gain(.7)',
      'pad: chord("<D^9 Em11 F#m7 Bm9>").voicing().s("choir").gain(.45)',
      'keys: chord("<D^9 Em11 F#m7 Bm9>").voicing().struct("x ~ ~ x ~ ~ x ~").s("rhodes").gain(.5)',
      'bass: chord("<D^9 Em11 F#m7 Bm9>").rootNotes(2).s("fingerbass")',
    ].join("\n"),
    hint: 'The choir: voices singing "aah", held under the Rhodes as a soft pad: D∆9, E–11, F♯–7, B–9, the chords of a neo-soul ballad. Lower its gain and it sits further back.',
  },
  // --- A1.L05 Grit: crush, coarse, distortion -----------------------------------------------------------------
  "tb.crush": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("bd ~ sd ~, hh*8").crush(4).gain(.8)',
      'bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(700)',
      'chords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.5)',
    ].join("\n"),
    hint: ".crush(4) keeps only 4 bits of each sample of the drums: they turn grainy and lo-fi while the bass and the chords stay clean. 16 is clean; try 6, then 3.",
  },
  "tb.coarse": {
    code: pop(
      96,
      'bass: note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>").s("sawtooth").lpf(700)',
      'chords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.5).coarse(8)',
    ),
    hint: ".coarse(8) keeps one sample in eight and repeats it: the Rhodes turns metallic and old-computer. 1 leaves it as it was; try 4, then 16.",
  },
  "tb.distorttype": {
    code: pop(
      100,
      'bass: note("<[c2 c2 ~ g1] [f1 f1 ~ c2]>").s("sawtooth").distort(2).distorttype("diode").lpf(900).gain(.5)',
      'chords: chord("<C F>").voicing().struct("x ~ ~ x ~ ~ x ~").s("rhodes").gain(.45)',
    ),
    hint: '.distorttype() chooses how .distort() bends the wave: "diode" is harder and buzzier than the default. Try "fold", then delete the call to hear the default.',
  },
  // --- A1.L06 Movement: vibrato, phaser, tremolo, filter LFO ------------------------------------------------------
  "tb.vib": {
    code: pop(
      84,
      'chords: chord("<C Am F G>").voicing().s("rhodes").gain(.45)',
      'bass: chord("<C Am F G>").rootNotes(2).s("fingerbass")',
      'mel: note("<[e5 ~ ~ ~] [c5 ~ ~ ~] [a4 ~ c5 ~] [b4 ~ ~ ~]>").s("sawtooth").lpf(2000).vib(5).vibmod(.25).gain(.5)',
    ),
    hint: ".vib(5) wobbles the pitch five times a second; .vibmod(.25) sets how far, a quarter of a half step. Held notes sing like a voice. With .vibmod(0) nothing moves.",
  },
  "tb.phaser": {
    code: pop(
      84,
      'chords: chord("<C Am F G>").voicing().s("sawtooth").lpf(1800).phaser(2).gain(.35)',
      'bass: chord("<C Am F G>").rootNotes(2).s("fingerbass")',
    ),
    hint: ".phaser(2) sweeps notches through the chords' sound twice a second: a swirling, watery movement. Try .phaser(.5) for a slow sweep, or .phaser(8) for a fast shimmer.",
  },
  "tb.tremolo": {
    code: pop(
      84,
      'chords: chord("<C Am F G>").voicing().s("sawtooth").lpf(1500).tremolosync(8).tremolodepth(.6).gain(.4)',
      'bass: chord("<C Am F G>").rootNotes(2).s("fingerbass")',
    ),
    hint: ".tremolosync(8) pulses the chords' volume eight times a bar, in time with the eighths; .tremolodepth(.6) sets how deep. With .tremolodepth(0) the chords hold steady.",
  },
  "tb.lpmod": {
    code: pop(
      96,
      'bass: note("<[c2 c2 ~ c2] [f1 f1 ~ g1]>").s("sawtooth").lpf(500).lprate(2).lpdepth(.6)',
      'chords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ),
    hint: ".lprate(2) moves the bass's filter (.lpf(500)) open and shut twice a cycle; .lpdepth(.6) sets how far. The bass wah-wahs. It needs the .lpf(): without a cutoff there is nothing to move.",
  },
  // --- A1.L07 FM, supersaw, pulse ---------------------------------------------------------------------------
  "tb.fm": {
    code: pop(
      90,
      'chords: chord("<C Am F G>").voicing().s("rhodes").gain(.4)',
      'bass: chord("<C Am F G>").rootNotes(2).s("fingerbass")',
      'mel: note("<[c5 e5 g5 e5] [a4 c5 e5 c5] [f4 a4 c5 a4] [g4 b4 d5 b4]>").s("sine").fm(3).fmh(2).gain(.5)',
    ),
    hint: ".fm(3) bends a sine wave with a second wave .fmh(2) times its pitch: new partials appear and the plain sine turns bell-like. .fm(0) is the sine again; try .fmh(3.5) for a clangy, inharmonic bell.",
  },
  "snd.wave.supersaw": {
    code: pop(
      110,
      'pad: chord("<C G Am F>").voicing().s("supersaw").lpf(2400).gain(.3)',
      'bass: chord("<C G Am F>").rootNotes(2).s("fingerbass")',
    ),
    hint: "The supersaw: several sawtooth waves a little out of tune with each other, so one chord sounds wide and thick, the lead and pad of trance and modern pop.",
  },
  "snd.wave.pulse": {
    code: pop(
      104,
      'bass: note("<[c2 c2 g1 c2] [f1 f1 c2 f1]>").s("pulse").lpf(1200).gain(.5)',
      'chords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ),
    hint: "The pulse wave: a square wave whose high and low parts can differ in length. As written it is hollow and reedy, the bass of old game consoles; .pw() changes its width.",
  },
  "tb.unison": {
    code: pop(
      110,
      'pad: chord("<C G Am F>").voicing().s("supersaw").unison(5).detune(.3).lpf(2400).gain(.3)',
      'bass: chord("<C G Am F>").rootNotes(2).s("fingerbass")',
    ),
    hint: ".unison(5) stacks five supersaw voices per note; .detune(.3) spreads their tuning. More voices and more detune make the pad wider and blurrier; .unison(1) is a single voice.",
  },
  "tb.pw": {
    code: pop(
      104,
      'bass: note("<[c2 c2 g1 c2] [f1 f1 c2 f1]>").s("pulse").pw(.2).lpf(1400).gain(.5)',
      'chords: chord("<C F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ),
    hint: ".pw(.2) makes the pulse high for a fifth of each wave and low for the rest: thinner and nasal. .5 is the hollow square; try .1 for a buzzing, very thin sound.",
  },
  // --- A2 Roles and registers, texture, sampling, the mix -----------------------------------------------------
  "tb.fscope": {
    code: [
      "setcpm(90/4)",
      "",
      'drums: s("bd ~ sd ~, hh*8").gain(.7)',
      'bass: note("<a1 f1 c2 g1>").struct("x ~ x ~").s("fingerbass")',
      'chords: chord("<Am F C G>").voicing().s("rhodes").gain(.5)',
      'mel: n("<[4 ~ 2 0] [2 ~ 0 ~] [4 5 4 2] [1 ~ ~ ~]>").scale("A4:minor").s("piano").fscope()',
    ].join("\n"),
    panels: { spectrum: true },
    hint: "Press Play: the spectrum shows where the sound sits, low on the left, high on the right. The Registers switch draws the register bands under it and each part's range: the bass low, the chords in the middle, the tune on top, each with room of its own.",
  },
  // Sound pack v4: grit and movement (A1.L05–L06), breaks and found sounds (A2.L04), timbres (A2.L06), Latin
  // percussion (R3).
  "tb.drive": {
    code: pop(
      120,
      'bass: note("<[c2 c2 eb2 g1] [c2 ~ bb1 g1]>").s("sawtooth").lpf(600).lpq(12).ftype("ladder").drive(3)',
    ),
    hint: 'Drive pushes the ladder filter into grit. Try .drive(0) and .drive(5); it works only with .ftype("ladder").',
  },
  "tb.density": {
    code: pop(80, 'fx: s("crackle").density(.3)', 'chords: chord("<Am F>").voicing().s("rhodes").gain(.5)'),
    hint: "Crackle is sparse clicks; .density sets how many. Low sounds like an old record, high like rain.",
  },
  "snd.textures": {
    code: pop(80, 'fx: s("vinyl").gain(.8)', 'chords: chord("<Am F>").voicing().s("rhodes").gain(.5)'),
    hint: "vinyl is the surface noise of a record; tape is a tape hiss bed. Under a loop they make it sound old.",
  },
  "tb.wt": {
    code: pop(90, 'pad: note("<[c3,e3,g3] [a2,c3,e3]>").s("wt_morph").wtrate(.5).wtdepth(1).gain(.6)'),
    hint: "wt_morph runs from a saw to a square; .wtrate and .wtdepth sweep through it, so the timbre moves. Try .wt(0) and .wt(1).",
  },
  "snd.breaks": {
    code: [
      "setcpm(100/4)",
      "",
      'drums: s("brkfunk").loopAt(2)',
      'bass: note("<[a1 ~ a1 c2] [f1 ~ f1 g1]>").s("fingerbass")',
      'chords: chord("<Am F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ].join("\n"),
    hint: "brkfunk is two bars recorded at 100, so .loopAt(2) fits it at its own tempo. Try brkboombap, brkhouse or brklofi, each at its own tempo.",
  },
  "snd.foley": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("brk").loopAt(1)',
      'fx: s("~ foley ~ snap").chop(2)',
      'bass: note("<[a1 ~ a1 c2] [f1 ~ f1 g1]>").s("fingerbass")',
    ].join("\n"),
    hint: "Found sounds as percussion: foley, snap, impact, swoosh and scratch, chopped like a break.",
  },
  "snd.marimba": {
    code: pop(100, 'mel: n("<[0 2 4 2] [4 5 7 4]>").scale("C4:major").s("marimba")'),
    hint: "A marimba: wooden bars, a soft attack and a short ring. Try kalimba or glockenspiel on the same line.",
  },
  "snd.kalimba": {
    code: pop(100, 'mel: n("<[0 2 4 2] [4 5 7 4]>").scale("C4:major").s("kalimba")'),
    hint: "A kalimba: plucked metal tines, the sound of many lo-fi and indie riffs.",
  },
  "snd.glockenspiel": {
    code: pop(100, 'mel: n("<[0 2 4 2] [4 5 7 4]>").scale("C5:major").s("glockenspiel")'),
    hint: "A glockenspiel: small metal bars, high and bright. It sounds two octaves above the written note on a real one.",
  },
  "snd.drum.clave": {
    code: pop(100, 'perc: s("clave ~ ~ clave ~ ~ clave ~ ~ ~ clave ~ clave ~ ~ ~")'),
    hint: "The claves play the son clave: three hits, then two. Every other part lines up with it.",
  },
  "snd.drum.conga": {
    code: pop(100, 'perc: s("~ ~ conga conga ~ ~ conga ~").n("<0 3>")'),
    hint: "The conga's open tones land on the last eighth of each bar: the tumbao.",
  },
  "snd.drum.bongo": {
    code: pop(100, 'perc: s("bongo*8").n("0 1 3 1 0 1 4 1")'),
    hint: "The bongos keep a steady eighth-note pattern: high and low drums, accented on the beat.",
  },
  "snd.brk": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("brk").loopAt(1)',
      'bass: note("<[a1 ~ a1 c2] [f1 ~ f1 g1]>").s("fingerbass")',
      'chords: chord("<Am F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ].join("\n"),
    hint: "brk: a one-bar drum break, played by a drummer and rendered by Oak, free to use. .loopAt(1) stretches it to fill one bar at this tempo.",
  },
  "tb.chop": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("brk").slice(4, "<[0 1 2 3] [0 2 1 3]>")',
      'bass: note("<[a1 ~ a1 c2] [f1 ~ f1 g1]>").s("fingerbass")',
      'chords: chord("<Am F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ].join("\n"),
    hint: '.slice(4, …) cuts the break into four equal pieces and plays them in the order given: bar 1 as recorded, bar 2 with the middle two swapped. Change "0 2 1 3" to "0 0 2 3".',
  },
  "tb.loopAt": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("brk").loopAt(2)',
      'bass: note("<[a1 ~ a1 c2] [f1 ~ f1 g1]>").s("fingerbass")',
      'chords: chord("<Am F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ].join("\n"),
    hint: ".loopAt(2) stretches the break to fill two bars: half speed, lower and heavier. .loopAt(1) puts it back to one bar.",
  },
  "tb.speed": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("brk*2").speed(1.5).end(.5)',
      'bass: note("<[a1 ~ a1 c2] [f1 ~ f1 g1]>").s("fingerbass")',
      'chords: chord("<Am F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ].join("\n"),
    hint: ".speed(1.5) plays the break half as fast again, so it is higher and shorter; .end(.5) keeps only its first half. Try .speed(.75), or .begin(.5) for the second half.",
  },
  "tb.compressor": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("bd ~ sd ~, hh*8").gain("[1 .5 .8 .5]*2").compressor("-20:4:10:.002:.1")',
      'bass: note("<[a1 ~ a1 c2] [f1 ~ f1 g1]>").s("fingerbass")',
      'chords: chord("<Am F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ].join("\n"),
    hint: "The compressor turns the loud hits of the drums down toward the quiet ones: -20 is where it starts, 4 how hard it pushes, then the knee, the attack and the release. The kit sits steadier in the mix. Delete it to hear the difference.",
  },
  "tb.postgain": {
    code: [
      "setcpm(96/4)",
      "",
      'drums: s("bd ~ sd ~, hh*8").gain(.7)',
      'bass: note("<[a1 a1 ~ c2] [f1 f1 ~ g1]>").s("sawtooth").distort(2).postgain(.4).lpf(1000)',
      'chords: chord("<Am F>").voicing().struct("~ x ~ x").s("rhodes").gain(.45)',
    ].join("\n"),
    hint: ".distort(2) makes the bass much louder as well as grittier; .postgain(.4) turns it down after the distortion, so it growls without burying the kit. .gain() would change the grit too.",
  },
  "tb.duck": {
    code: [
      "setcpm(110/4)",
      "",
      'kick: s("bd*4").duckorbit(2).duckdepth(.6)',
      'hats: s("~ hh ~ hh ~ hh ~ hh").gain(.5)',
      'pad: chord("<Am F C G>").voicing().s("supersaw").lpf(2000).gain(.35).orbit(2)',
      'bass: chord("<Am F C G>").rootNotes(2).s("fingerbass")',
    ].join("\n"),
    hint: "Every kick pushes the pad (orbit 2) down for a moment, .duckdepth(.6) how far: the pad breathes with the beat, the pumping of dance music. Change .duckdepth to 0 and it holds steady.",
  },
};
