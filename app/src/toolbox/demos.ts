// The live examples of the tools U08–U17 and the A1 side lessons unlock (Waves 5 and 6): each plays the tool inside a
// short groove that sounds like music, not a bare test tone (the catalog's own demo is the tool alone, which the
// unlock moment and the locked teaser keep). Each uses only what its unlock site guarantees (the A1 examples stay
// inside U03.L02's tools: note(), s(), drums, no chords), and each was played in headless Strudel
// (demos.test.ts). The page also says which panel or probe shows the tool at work.
import type { MeterId } from "@oak/content-kit";
import type { VisualProbe } from "@oak/strudel/probes";
import type { PanelId } from "../workbench/panels.ts";
import { TRACK_TOOL_DEMOS } from "./demos-w7.ts";

export interface ToolDemo {
  code: string;
  /** Panels open on the page (the form map, the scope). */
  panels?: Partial<Record<PanelId, boolean>>;
  /** Probes drawn beside the example (the filter curve, the envelope, the echoes, the harmonics). */
  probes?: VisualProbe["kind"][];
  /** One line over the example: what to listen and look for, and what to change. */
  hint: string;
  /** The example's meter when its tempo line alone does not say it (6/8: `setcpm(60/2)`). */
  meter?: MeterId;
  /** Bars the example's loop takes when its alternations alone do not say it (a polymeter's period, a 12-bar form). */
  bars?: number;
}

const FORM_SONG = `setcpm(100/4)

const drumsVerse = s("bd ~ sd ~")
const drumsChorus = s("bd bd sd [~ bd]")
const hatsVerse = s("~ hh ~ hh")
const hatsChorus = s("hh*8")
const chordsVerse = chord("<C Am>").voicing().s("piano").gain(.55)
const chordsChorus = chord("<F G>").voicing().s("piano").gain(.75)
const bassVerse = note("<c2 a1>").s("sawtooth").lpf(600)
const bassChorus = note("<[f2 ~ f2 c2] [g2 ~ g2 d2]>").s("sawtooth").lpf(700)

drums: arrange([2, drumsVerse], [2, drumsChorus])
hats: arrange([2, hatsVerse], [2, hatsChorus])
chords: arrange([2, chordsVerse], [2, chordsChorus])
bass: arrange([2, bassVerse], [2, bassChorus])`;

const BASS_SAW = (body: string) => `setcpm(90/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4)
bass: ${body}`;

export const TOOL_DEMOS: Readonly<Record<string, ToolDemo>> = {
  // --- U08 Bass Lines ---------------------------------------------------------------------------------
  "tb.rootNotes": {
    code: `setcpm(88/4)

drums: s("bd ~ sd ~")
chords: chord("<C Am F G>").voicing().s("piano").gain(.55)
bass: chord("<C Am F G>").rootNotes(2).s("sawtooth").lpf(600)`,
    hint: "The bass plays the root of each chord, two octaves down. Change the chords in both lines and press Run: the bass follows.",
  },
  "tb.const": {
    code: `setcpm(96/4)

const groove = "x ~ ~ x ~ ~ x ~"

kick: s("bd").struct(groove)
snare: s("~ sd ~ sd")
bass: note("<c2 a1 f1 g1>").struct(groove).s("sawtooth").lpf(600)`,
    hint: "One groove, named once, drives the kick and the bass together. Change the x's in groove and both move.",
  },
  "snd.fingerbass": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
chords: chord("<C Am F G>").voicing().s("piano").gain(.5)
bass: note("<[c2 ~ c2 g1] [a1 ~ a1 e2] [f1 ~ f1 c2] [g1 ~ g1 d2]>").s("fingerbass")`,
    hint: "Root, root, then the fifth: a finger-played bass under four chords.",
  },
  "tb.template.synthbass": {
    code: BASS_SAW(`note("<[c2 c2 ~ g1] [bb1 bb1 ~ f1]>").s("sawtooth").lpf(600)`),
    hint: "The synth-bass recipe: a sawtooth with the highs filtered away. Try .lpf(400) or .lpf(1200).",
  },
  // --- U09 Form ---------------------------------------------------------------------------------------
  "tb.lens.form": {
    code: FORM_SONG,
    panels: { form: true },
    hint: "Each track is arranged the same way, so the ribbon over the roll shows a verse then a chorus. Click a section to loop it; the form map draws the energy rising into the chorus. Shift+E opens the map anywhere.",
  },
  "tb.arrange": {
    code: FORM_SONG,
    hint: "One arrange() per labelled track, the same bars in the same order: two bars of verse, two of chorus. Swap the order in every track and press Run.",
  },
  "tb.signal": {
    code: `setcpm(96/4)

kick: s("bd*4")
hats: s("hh*8").gain(sine.range(.25, .9).slow(2))
chords: chord("<C F>").voicing().s("piano").gain(.5)`,
    hint: "A sine wave moves the hats' volume up and down every two bars, smoothly.",
  },
  "tb.range": {
    code: `setcpm(96/4)

kick: s("bd*4")
hats: s("hh*16").gain(saw.range(.15, .9).slow(4))
chords: chord("<C Am F G>").voicing().s("piano").gain(.5)`,
    hint: "saw.range(.15, .9) climbs from quiet to loud over four bars: a build-up. Change the two numbers to change how far it climbs.",
  },
  "tb.segment": {
    code: `setcpm(96/4)

kick: s("bd*4")
riser: n(saw.range(0, 7).segment(8).slow(2)).scale("C4:major").s("piano")`,
    hint: "The rising saw cut into eight steps per cycle becomes a scale that climbs over two bars.",
  },
  "tb.mask": {
    code: `setcpm(96/4)

kick: s("bd*4")
hats: s("hh*8").gain(.5).mask("<0 1>")
snare: s("~ sd ~ sd").mask("<0 0 1 1>")
bass: note("<c2 c2 f1 g1>").s("sawtooth").lpf(600)`,
    hint: "The hats drop in every other bar, the snare for the last two: the same lines, switched on and off by bar.",
  },
  // --- U10 Minor --------------------------------------------------------------------------------------
  "scale.minor": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
mel: n("<[0 2 4 2] [3 2 1 ~] [5 4 2 4] [1 ~ 0 ~]>").scale("C4:minor").s("piano")
bass: note("<c2 c2 ab1 g1>").s("sawtooth").lpf(600)`,
    hint: "The same degree numbers as a major tune, in C minor: 3, 6 and 7 come out flat (me, le, te). Change minor to major and press Run.",
  },
  "scale.harmonic-minor": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
mel: n("<[4 3 2 1] [6 ~ 7 ~]>").scale("A3:harmonic:minor").s("piano")
bass: note("<a1 e2>").s("sawtooth").lpf(600)`,
    hint: "Harmonic minor raises 7 (ti): G♯ in A minor pulls hard up to A. Change harmonic:minor to minor to hear the plain G.",
  },
  "scale.melodic-minor": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
mel: n("<[0 1 2 3] [4 5 6 7]>").scale("A3:melodic:minor").s("piano")
bass: note("a1").s("sawtooth").lpf(600)`,
    hint: "Melodic minor going up: 6 and 7 are raised (F♯ and G♯ in A minor), so the climb runs smoothly into the top note.",
  },
  "snd.strings": {
    code: `setcpm(80/4)

drums: s("bd ~ ~ ~, ~ ~ sd ~")
pad: n("<[0,2,4] [5,7,9] [2,4,6] [6,8,10]>").scale("A3:minor").s("strings").gain(.7)
bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(500)`,
    hint: "Strings hold the minor chords i VI III VII under a quiet beat: the Aeolian loop.",
  },
  // --- U11 Pentatonic & Blues -------------------------------------------------------------------------
  "scale.major-pentatonic": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
chords: chord("<C Am F G>").voicing().s("piano").gain(.5)
mel: n("<[0 1 2 4] [3 2 1 ~] [2 3 4 5] [4 ~ ~ ~]>").scale("C4:major:pentatonic").s("piano")`,
    hint: "Five notes, no half steps: every note of C major pentatonic fits over every chord here. Change the numbers freely.",
  },
  "scale.minor-pentatonic": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4)
riff: n("0 ~ 1 2 ~ 3 2 1").scale("A3:minor:pentatonic").s("piano")
bass: note("a1 ~ a1 ~").s("sawtooth").lpf(600)`,
    hint: "A minor pentatonic: 1 ♭3 4 5 ♭7. The riff counts the scale's own notes, so n(1) is C, the ♭3.",
  },
  "scale.blues": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
riff: n("<[0 1 2 3] [4 ~ 3 2] [1 2 1 0] [~ ~ 0 ~]>").scale("C4:blues").s("piano")
bass: note("<c2 c2 f2 c2>").s("sawtooth").lpf(600)`,
    hint: "The blues scale adds the ♭5 (G♭) between 4 and 5. With the blue-note lens on, ♭3, ♭5 and ♭7 are ringed. Shift+U turns it off and on.",
  },
  "chord.dom7": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
chords: chord("<C7 F7 C7 G7>").voicing().s("piano").gain(.6)
bass: chord("<C7 F7 C7 G7>").rootNotes(2).s("sawtooth").lpf(600)`,
    hint: "Every chord a dominant seventh: the blues sound. The chord band names each one; drop the 7s to hear plain triads.",
  },
  "snd.crunch": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
gtr: n("0 ~ 1 2 ~ 1 0 ~").scale("E2:minor:pentatonic").s("crunch").gain(.7)`,
    hint: "An overdriven guitar on an E minor pentatonic riff.",
  },
  "tb.swing": {
    code: `setcpm(120/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").swing(4)
riff: n("0 ~ 2 3 4 ~ 3 2").scale("C4:blues").s("piano").swing(4)`,
    hint: "Every second eighth lands late: a shuffle. The track chips say Swing 8ths; remove .swing(4) to hear it straight.",
  },
  "tb.swingBy": {
    code: `setcpm(120/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").swingBy(1/3, 4)
riff: n("0 ~ 2 3 4 ~ 3 2").scale("C4:blues").s("piano").swingBy(1/3, 4)`,
    hint: "1/3 is a full triplet shuffle; try 1/6 for a lighter swing, 0 for straight.",
  },
  "tb.delay": {
    code: `setcpm(80/4)

drums: s("bd ~ sd ~")
mel: note("<[c4 ~ e4 ~] [g4 ~ ~ ~] [a4 ~ g4 ~] [e4 ~ ~ ~]>").s("piano").delay(.4)`,
    probes: ["delay"],
    hint: "Each note comes back as quieter echoes. The picture shows when each echo lands and how loud it is.",
  },
  "tb.distort": {
    code: BASS_SAW(`note("<[c2 c2 ~ g1] [bb1 bb1 ~ f1]>").s("sawtooth").distort(1.5).lpf(900).gain(.6)`),
    hint: "Distortion adds grit and new harmonics; .lpf(900) keeps the top from turning harsh.",
  },
  // --- A1 Sound (side lessons): note(), s() and drums only -------------------------------------------
  "tb.scope": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
bass: note("<c2 c2 g1 bb1>").s("sawtooth").lpf(800).scope()`,
    panels: { scope: true },
    hint: ".scope() opens Oak's scope: press Play and the wave of what plays stands still on the screen. Shift+W opens it anywhere.",
  },
  "tb.partials": {
    code: `setcpm(80/4)

mel: note("<c3 g3 e3 c3>").s("sine").partials([1, .5, .3, .2])
kick: s("bd ~ ~ ~")`,
    probes: ["harmonics"],
    hint: "Four numbers, four harmonics: the fundamental, then each harmonic quieter. Try [1, 0, .3] for a hollow sound.",
  },
  "tb.lpf": {
    code: BASS_SAW(`note("<[c2 c2 ~ g1] [bb1 bb1 ~ f1]>").s("sawtooth").lpf(600)`),
    probes: ["filter"],
    hint: "Everything above 600 Hz fades. Change 600 and press Run: the curve moves with it.",
  },
  "tb.hpf": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
lead: note("<[c4 e4 g4 e4] [a3 c4 e4 c4]>").s("sawtooth").hpf(800).gain(.6)`,
    probes: ["filter"],
    hint: "A high-pass keeps the highs and thins the lows: the lead gets out of the bass's way.",
  },
  "tb.bpf": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
lead: note("<[c3 e3 g3 c4] [bb2 d3 f3 bb3]>").s("sawtooth").bpf(900)`,
    probes: ["filter"],
    hint: "A band-pass keeps a band around 900 Hz: a nasal, telephone-like voice.",
  },
  "tb.lpq": {
    code: BASS_SAW(`note("<[c2 c2 ~ g1] [bb1 bb1 ~ f1]>").s("sawtooth").lpf(700).lpq(12)`),
    probes: ["filter"],
    hint: "Resonance lifts a peak right at the cutoff: the bass starts to sing. Try .lpq(2) and .lpq(20).",
  },
  // Sound pack v4 (A1.L01–L03): wavetables, noise, the ladder filter, the synth kick and the pitch envelope.
  "snd.wt": {
    code: `setcpm(90/4)

drums: s("bd ~ sd ~")
mel: note("<[c3 e3 g3 e3] [a2 c3 e3 c3]>").s("wt_organ")`,
    hint: "wt_organ is one cycle of an organ's wave, stored as a table and played as an oscillator. Try wt_epiano, wt_chip or wt_basic.",
  },
  "snd.noise": {
    code: `setcpm(100/4)

drums: s("bd ~ sd ~")
fx: s("pink*8").lpf("<800 2000 4000 8000>").gain(.5)`,
    probes: ["filter"],
    hint: "Noise holds every frequency at once, so a filter shapes it plainly: each bar the cutoff opens. Try white and brown.",
  },
  "tb.ftype": {
    code: BASS_SAW(`note("<[c2 c2 ~ g1] [bb1 bb1 ~ f1]>").s("sawtooth").lpf(500).lpq(16).ftype("ladder")`),
    hint: 'The ladder filter squelches when the resonance is high: the acid bass sound. Remove .ftype("ladder") to hear the plain filter.',
  },
  "snd.sbd": {
    code: `setcpm(100/4)

kick: s("sbd ~ sbd ~")
snare: s("~ sd ~ sd")
hats: s("hh*8").gain(.4)`,
    hint: "sbd is a kick made by a synth: a sine that falls in pitch. Compare it with bd.",
  },
  "tb.penv": {
    code: `setcpm(100/4)

kick: note("c2 ~ c2 ~").s("sine").penv(24).pdecay(.08).decay(.4).sustain(0)
snare: s("~ sd ~ sd")
hats: s("hh*8").gain(.4)`,
    probes: ["envelope"],
    hint: "Each note starts two octaves up and falls in 0.08 s: a sine becomes a kick. Try .penv(12) and .pdecay(.3).",
  },
  "tb.lpenv": {
    code: BASS_SAW(`note("<[c2 c2 ~ g1] [bb1 bb1 ~ f1]>").s("sawtooth").lpf(300).lpenv(4).lpd(.2)`),
    probes: ["filter"],
    hint: "The filter opens at each note and closes again within .lpd(.2) seconds: the classic synth-bass pluck.",
  },
  "tb.adsr": {
    code: `setcpm(80/4)

kick: s("bd ~ ~ ~")
pad: note("<c4 a3 f3 g3>").s("sawtooth").attack(.3).release(.8).lpf(1500).gain(.5)`,
    probes: ["envelope"],
    hint: "A slow attack fades each note in; a long release lets it ring on. The shape shows both.",
  },
  "tb.roomsize": {
    code: `setcpm(80/4)

kick: s("bd ~ ~ ~")
mel: note("<[c4 ~ g4 ~] [e4 ~ ~ ~]>").s("piano").room(.5).roomsize(6)`,
    hint: "A bigger room rings longer. Try .roomsize(1) and .roomsize(9).",
  },
  "tb.delaytime": {
    code: `setcpm(80/4)

kick: s("bd ~ ~ ~")
mel: note("<[c4 ~ e4 ~] [g4 ~ ~ ~]>").s("piano").delay(.4).delaytime(.25)`,
    probes: ["delay"],
    hint: "A quarter of a second between echoes. Change .25 and the echoes in the picture spread out or close up.",
  },
  "tb.delayfeedback": {
    code: `setcpm(80/4)

kick: s("bd ~ ~ ~")
mel: note("<[c4 ~ e4 ~] [g4 ~ ~ ~]>").s("piano").delay(.4).delayfeedback(.6)`,
    probes: ["delay"],
    hint: "Feedback decides how many echoes you hear: each is 60% of the one before.",
  },
  "tb.orbit": {
    code: `setcpm(80/4)

kick: s("bd ~ ~ ~")
mel: note("<[c4 ~ g4 ~] [e4 ~ ~ ~]>").s("piano").room(.6).orbit(2)`,
    hint: "A separate orbit gives this track its own reverb, so the kick stays dry.",
  },
  // --- U12 Seventh Chords ------------------------------------------------------------------------------
  "chord.seventh": {
    code: `setcpm(84/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.35)
chords: chord("<C^7 Am7 Dm7 G7>").voicing().s("rhodes").gain(.6)
bass: chord("<C^7 Am7 Dm7 G7>").rootNotes(2).s("fingerbass")`,
    hint: "Four sevenths in C: Cmaj7, Am7, Dm7, G7, each a triad with one more third on top. With guide tones on (Shift+I) the roll marks every chord's 3rd and 7th and joins them into their line. Delete the ^7 and 7s to hear the plain triads.",
  },
  "chord.seventh-dim": {
    code: `setcpm(84/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.35)
chords: chord("<Bm7b5 E7 Am7 [Am7 G#o7]>").voicing().s("rhodes").gain(.6)
bass: chord("<Bm7b5 E7 Am7 [Am7 G#o7]>").rootNotes(2).s("fingerbass")`,
    hint: "A minor's own two-five-one: Bm7♭5 (half-diminished) leans into E7, E7 into Am7. The last half bar is G♯°7, the fully diminished seventh: every note a minor third apart, pulling back to the start.",
  },
  "tb.dict.lefthand": {
    code: `setcpm(116/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").swing(4).gain(.35)
chords: chord("<Dm7 G7 C^7 A7>").dict("lefthand").voicing().struct("~ x ~ x").s("piano").gain(.6)
bass: chord("<Dm7 G7 C^7 A7>").rootNotes(2).s("fingerbass")`,
    hint: 'Left-hand voicings leave the root to the bass and keep the 3rd and the 7th close together in the middle of the piano. Delete .dict("lefthand") and press Run to hear the default voicing jump about.',
  },
  "snd.jazzgtr": {
    code: `setcpm(116/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").swing(4).gain(.35)
chords: chord("<Dm7 G7 C^7 A7>").voicing().struct("~ x ~ [~ x]").s("jazzgtr").gain(.7)
bass: note("<[d2 f2 a2 c3] [g2 b2 d3 f2] [c2 e2 g2 b2] [a2 g2 e2 c#2]>").s("fingerbass")`,
    hint: "A jazz guitar comping seventh chords off the beat over a walking bass. Move the x's in .struct() to change where the chords fall.",
  },
  // --- U13 Rhythm II -----------------------------------------------------------------------------------
  "tb.early": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4)
chords: chord("<C F Am G>").voicing().s("rhodes").gain(.6).early(1/8)
bass: note("<c2 f2 a1 g1>").s("fingerbass")`,
    hint: "Every chord comes in an eighth early, ahead of the bar line, while the drums and the bass stay on the beat: a push. With the beat grid on (Shift+V) the roll draws each push against the beat it comes in ahead of. Try 1/16, or delete .early(1/8).",
  },
  "tb.late": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4)
chords: chord("<Am F C G>").voicing().struct("x ~ x ~").s("piano").gain(.6).late(1/8)
bass: note("<a1 f1 c2 g1>").s("fingerbass")`,
    hint: "The chords are written on beats 1 and 3 and land an eighth later: an answer to the kick on the off-beat. Delete .late(1/8) to put them back on the beat.",
  },
  "tb.velocity": {
    code: `setcpm(100/4)

kick: s("bd ~ ~ bd ~ ~ bd ~")
snare: s("~ sd ~ sd")
hats: s("hh*16").velocity("[1 .35 .6 .35]*4")
bass: note("<[d2 ~ d2 ~ ~ d2 f2 g2] [g1 ~ g1 ~ ~ g1 a1 c2]>").s("fingerbass")`,
    hint: "Sixteen hats a bar, but only one in four at full strength: the quiet ones are ghost notes, drawn small and hollow on the roll. Change .35 to 1 and the groove turns stiff.",
  },
  "snd.cleangtr": {
    code: `setcpm(100/4)

drums: s("bd ~ sd ~")
hats: s("hh*16").velocity("[1 .35 .6 .35]*4")
gtr: n("<[0 2 4 2 0 2 4 7] [3 5 7 5 3 5 7 9]>").scale("C3:major").s("cleangtr").gain(.7)
bass: note("<c2 f1>").s("fingerbass")`,
    hint: "A clean electric guitar picking through C and F in even eighths over sixteenth hats.",
  },
  "tb.meter.compound": {
    code: `setcpm(60/2)

drums: s("bd ~ ~ sd ~ ~")
hats: s("hh*6").gain(.4)
chords: chord("<C Am F G>").voicing().s("rhodes").gain(.55)
bass: note("<c2 a1 f1 g1>").s("fingerbass")
mel: n("<[4 ~ 2 0 ~ 2] [4 ~ 5 4 ~ ~] [3 ~ 2 0 ~ 2] [1 ~ ~ ~ ~ ~]>").scale("C4:major").s("piano")`,
    meter: "6/8",
    hint: "6/8: two beats in a bar, each of three eighths. setcpm(60/2) sets the dotted-quarter beat to 60. The beat grid (Shift+V) counts 1 la li 2 la li over the roll; the snare falls on 2.",
  },
  "tb.ply": {
    code: `setcpm(72/4)

drums: s("bd ~ sd ~")
hats: s("hh hh hh hh").ply(3).gain(.45)
chords: chord("<C Am F G>").voicing().struct("x x x x").ply(3).s("piano").gain(.45)
bass: note("<c2 a1 f1 g1>").s("fingerbass")`,
    hint: ".ply(3) plays every hit three times inside its own beat: four beats become four triplets, the slow-dance feel. The beat grid (Shift+V) shows each beat cut in three: 1 trip let. Try .ply(2) for plain eighths.",
  },
  // --- U14 Modes ---------------------------------------------------------------------------------------
  "scale.mixolydian": {
    code: `setcpm(104/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4)
chords: chord("<G F C G>").voicing().s("organ").gain(.5)
bass: note("<g1 f1 c2 g1>").s("fingerbass")
riff: n("<[0 2 4 6] [6 5 4 2] [3 5 6 5] [4 ~ 0 ~]>").scale("G4:mixolydian").s("piano")`,
    panels: { key: true },
    hint: "Mixolydian is major with a lowered 7. In G that note is F: the riff leans on it and the F chord (♭VII) is built on it. The Key panel names the mode and rings its colour note on the roll. Change mixolydian to major and press Run: F♯ comes back.",
  },
  "scale.dorian": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4)
chords: chord("<Dm G>").voicing().s("rhodes").gain(.55)
bass: note("<[d2 ~ d2 a1] [g1 ~ g1 d2]>").s("fingerbass")
mel: n("<[0 2 4 5] [5 4 2 ~]>").scale("D4:dorian").s("piano")`,
    panels: { key: true },
    hint: "Dorian is minor with a raised 6. In D that note is B: it turns the IV chord major (G) and gives the vamp its lift. Change dorian to minor and press Run to hear B♭ darken it.",
  },
  "scale.lydian": {
    code: `setcpm(88/4)

drums: s("bd ~ ~ ~, ~ ~ sd ~")
chords: chord("<F G>").voicing().s("pad").gain(.5)
bass: note("f1").s("fingerbass")
mel: n("<[0 2 3 4] [3 ~ 2 ~]>").scale("F4:lydian").s("piano").delay(.3)`,
    panels: { key: true },
    hint: "Lydian is major with a raised 4. In F that note is B: it floats over the held F in the bass, and the G chord (II) is built on it. Change lydian to major to hear B♭ settle it.",
  },
  "scale.phrygian": {
    code: `setcpm(92/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4)
chords: chord("<Em F>").voicing().s("strings").gain(.5)
bass: note("<e1 f1>").s("fingerbass")
mel: n("<[0 1 0 ~] [4 3 1 0]>").scale("E4:phrygian").s("piano")`,
    panels: { key: true },
    hint: "Phrygian is minor with a lowered 2. In E that note is F, a half step above home: the F chord (♭II) falls back onto E minor. Change phrygian to minor to hear F♯ take the tension out.",
  },
  "tb.pan": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").gain(.4).pan(.85)
keys: chord("<Dm Bb>").voicing().s("rhodes").gain(.55).pan(.2)
mel: n("<[0 2 4 5] [5 4 2 ~]>").scale("D4:minor").s("piano").pan(.7)
bass: note("<d2 bb1>").s("fingerbass")`,
    hint: "0 is hard left, 1 hard right, .5 the middle. The keys sit left, the tune and the hats right, the kick and the bass stay in the middle. Best heard on headphones.",
  },
  "tb.jux": {
    code: `setcpm(96/4)

drums: s("bd ~ sd ~")
mel: n("0 2 4 5 4 2 0 ~").scale("D4:dorian").s("piano").jux(rev)
bass: note("<d2 g1>").s("fingerbass")`,
    hint: ".jux(rev) plays the line in your left ear and the same line backwards in your right: one tune, twice as wide. Try .jux(x => x.fast(2)).",
  },
  // --- U15 Secondary Dominants and U16 Borrowed Chords ------------------------------------------------
  "tb.n.chromatic": {
    code: `setcpm(92/4)

drums: s("bd ~ sd ~")
chords: chord("<C F F G>").voicing().s("rhodes").gain(.5)
bass: note("<c2 f1 f1 g1>").s("fingerbass")
mel: n("<[4 3# 4 ~] [7 6b 5 ~] [5 4# 5 ~] [4 ~ 1 ~]>").scale("C4:major").s("piano")`,
    hint: "A number with # or b is a note from outside the key. 3# is ♯4 (fi) and leans up to 5; 6b is ♭7 (te) and leans down to 6; 4# is ♯5 (si), up to 6. Turn on Degrees and Solfège to read them on the roll.",
  },
  "snd.horns": {
    code: `setcpm(120/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").swing(4).gain(.35)
horns: chord("<C E7 A7 A7 D7 G7 C G7>").voicing().struct("x ~ ~ x ~ ~ x ~").s("horns").gain(.6)
bass: chord("<C E7 A7 A7 D7 G7 C G7>").rootNotes(2).s("fingerbass")`,
    hint: "Horn stabs on a chain of dominants: E7 leads to A7, A7 to D7, D7 to G7, G7 home to C. Once you know them, the chord band writes each as V7 of the chord it points at.",
  },
  "snd.trumpet": {
    code: `setcpm(120/4)

drums: s("bd ~ sd ~")
hats: s("hh*8").swing(4).gain(.35)
chords: chord("<C E7 A7 D7>").voicing().s("rhodes").gain(.5)
bass: chord("<C E7 A7 D7>").rootNotes(2).s("fingerbass")
mel: n("<[4 ~ 2 0] [4# ~ 2 1] [5 ~ 4 0#] [3# ~ 1 ~]>").scale("C4:major").s("trumpet").gain(.7)`,
    hint: "A trumpet lead over dominants: each bar's raised note (G♯, C♯, F♯) is the new chord's 3rd, the note that pulls on to the next chord.",
  },
  "snd.tenor": {
    code: `setcpm(80/4)

drums: s("bd ~ sd ~")
chords: chord("<C Fm C [Ab Bb]>").voicing().s("rhodes").gain(.55)
bass: note("<c2 f1 c2 [ab1 bb1]>").s("fingerbass")
mel: n("<[4 ~ 2 0] [5b ~ 3 0] [2 ~ 1 0] [5b 2b 6b 1]>").scale("C4:major").s("tenor").gain(.7)`,
    hint: "A tenor sax over chords borrowed from C minor: Fm in bar 2, then A♭ and B♭ climbing back home. The flats in the tune (5b, 2b, 6b) are the borrowed chords' own notes.",
  },
};

export function toolDemo(toolId: string): ToolDemo | null {
  return TOOL_DEMOS[toolId] ?? TRACK_TOOL_DEMOS[toolId] ?? null;
}
