// The audibility catalog (contracts §3.1 rule 7): every group-H control and every sound the unlock table
// names, with the base expression that makes it audible and a non-default value (spike S3: a control
// can need a partner, e.g. lpenv needs lpf, speed needs a sample). The harness turns this into
// `packages/strudel/audibility.json`; content CI reads `audible` from there.

export interface ControlCase {
  id: string;
  control: string;
  /** A JS literal, or raw code prefixed with "=" (`"=rev"`). */
  value: string | number;
  base?: string;
  /** The full code WITH the control, when appending `.control(value)` to the base is not the test. */
  withCode?: string;
}
export interface SoundCase {
  id: string;
  sound: string;
  code: string;
}

const ARP = 'note("c3 e3 g3 c4").s("sawtooth")';
const SAMPLE = 's("cr")';

const PIANO_TRIAD = 'note("[c3,e3,g3]").s("piano")';
const VOICED_C = 'chord("C").voicing().s("piano")';
const pair = (id: string, control: string, base: string, withCode: string): ControlCase => ({
  id,
  control,
  value: "=",
  base,
  withCode,
});

/** The U05–U07 tools: each as the same music without the tool and with it. */
function wave4Cases(): ControlCase[] {
  return [
    pair("tb.arp", "arp", PIANO_TRIAD, 'note("[c3,e3,g3]").arp("0 1 2 1").s("piano")'),
    pair(
      "chord.triad",
      "chord",
      'chord("C C C C").voicing().s("piano")',
      'chord("C Cm Co Caug").voicing().s("piano")',
    ),
    pair("tb.chord", "chord", VOICED_C, 'chord("Am").voicing().s("piano")'),
    pair("tb.voicing", "voicing", PIANO_TRIAD, VOICED_C),
    pair("tb.anchor", "anchor", VOICED_C, 'chord("C").anchor("g4").voicing().s("piano")'),
    // `below` is the default mode, so it is heard against root position.
    pair(
      "tb.mode.below",
      "mode",
      'chord("C").mode("root:c3").voicing().s("piano")',
      'chord("C").mode("below").voicing().s("piano")',
    ),
    pair("tb.dict.triads", "dict", VOICED_C, 'chord("C").dict("triads").voicing().s("piano")'),
    pair(
      "tb.add",
      "add",
      'n("0 2 4").scale("C4:major").s("piano")',
      'n("0 2 4").add(n("2")).scale("C4:major").s("piano")',
    ),
    pair("tb.mode.root", "mode", VOICED_C, 'chord("C").mode("root:g2").voicing().s("piano")'),
    pair("tb.rev", "rev", 'note("c3 e3 g3 c4").s("piano")', 'note("c3 e3 g3 c4").rev().s("piano")'),
    pair(
      "tb.scaleTranspose",
      "scaleTranspose",
      'n("0 1 2 3").scale("C4:major").s("piano")',
      'n("0 1 2 3").scale("C4:major").scaleTranspose(2).s("piano")',
    ),
    pair("tb.struct", "struct", PIANO_TRIAD, 'note("[c3,e3,g3]").struct("x ~ x x").s("piano")'),
    // One rendered cycle: `lastOf(1, …)` and `firstOf(1, …)` apply in it.
    pair("tb.lastOf", "lastOf", ARP, `${ARP}.lastOf(1, x => x.rev())`),
    pair("tb.firstOf", "firstOf", ARP, `${ARP}.firstOf(1, x => x.fast(2))`),
    pair("tb.off", "off", ARP, `${ARP}.off(1/8, x => x.add(note(7)))`),
    pair("tb.superimpose", "superimpose", ARP, `${ARP}.superimpose(x => x.add(note(12)))`),
    pair("tb.mini.maybe", "?", 'note("c3*8").s("sawtooth")', 'note("c3*8?").s("sawtooth")'),
    pair(
      "tb.degradeBy",
      "degradeBy",
      'note("c3*8").s("sawtooth")',
      'note("c3*8").degradeBy(0.5).s("sawtooth")',
    ),
    pair(
      "tb.sometimesBy",
      "sometimesBy",
      'note("c3*8").s("sawtooth")',
      'note("c3*8").sometimesBy(0.5, x => x.add(note(12))).s("sawtooth")',
    ),
  ];
}

/**
 * The U08–U11 tools that change what is heard (Wave 5): the root-bass helper, the energy-curve tools, layer
 * entries, swing and shuffle, the dominant seventh and every minor, pentatonic and blues scale, each as the same
 * music without the tool and with it.
 */
export function wave5Cases(): ControlCase[] {
  const SCALE_RUN = (name: string) => `n("0 1 2 3 4 5 6 7").scale("C4:${name}").s("piano")`;
  const scale = (id: string, name: string): ControlCase =>
    pair(id, "scale", SCALE_RUN("major"), SCALE_RUN(name));
  return [
    pair(
      "tb.rootNotes",
      "rootNotes",
      'note("c2*4").s("ebass")',
      'chord("Am").rootNotes(2).struct("x*4").s("ebass")',
    ),
    pair("tb.signal", "sine", 'note("c3*8").s("sawtooth")', 'note("c3*8").s("sawtooth").gain(sine)'),
    pair(
      "tb.range",
      "range",
      'note("c3*8").s("sawtooth").lpf(2000)',
      'note("c3*8").s("sawtooth").lpf(saw.range(200, 4000).segment(8))',
    ),
    pair(
      "tb.segment",
      "segment",
      'note("c3*8").s("sawtooth").lpf(saw.range(200, 4000))',
      'note("c3*8").s("sawtooth").lpf(saw.range(200, 4000).segment(2))',
    ),
    pair("tb.mask", "mask", 'note("c3*8").s("sawtooth")', 'note("c3*8").s("sawtooth").mask("1 0 1 1")'),
    // Swing moves the off-beat eighths onto the last triplet: the same hats, later.
    pair("tb.swingBy", "swingBy", 's("hh*8")', 's("hh*8").swingBy(1/3, 4)'),
    pair("tb.swing", "swing", 's("hh*8")', 's("hh*8").swing(4)'),
    pair("chord.dom7", "chord", VOICED_C, 'chord("C7").voicing().s("piano")'),
    scale("scale.minor", "minor"),
    scale("scale.harmonic-minor", "harmonic:minor"),
    scale("scale.melodic-minor", "melodic:minor"),
    scale("scale.major-pentatonic", "major:pentatonic"),
    scale("scale.minor-pentatonic", "minor:pentatonic"),
    scale("scale.blues", "blues"),
  ];
}

/**
 * The U12–U17 tools that change what is heard (Wave 6): the four new seventh qualities, the left-hand dictionary,
 * pushes, triplet repeats, the compound grouping, chromatic steps and the four modes, each as the same music
 * without the tool and with it. (`tb.velocity`, `tb.pan` and `tb.jux` are group-H rows above; the sounds U12–U17
 * unlock are in SOUND_CASES.)
 */
export function wave6Cases(): ControlCase[] {
  const run = (name: string) => `n("0 1 2 3 4 5 6 7").scale("C4:${name}").s("piano")`;
  const mode = (id: string, from: string, name: string): ControlCase =>
    pair(id, "scale", run(from), run(name));
  const LINE = 'note("c3 e3 g3 c4").s("piano")';
  return [
    pair(
      "chord.seventh",
      "chord",
      'chord("C C Am Am").voicing().s("piano")',
      'chord("C C^7 Am Am7").voicing().s("piano")',
    ),
    pair(
      "chord.seventh-dim",
      "chord",
      'chord("Bm7 Bm7 Bm7b5 Bm7b5").voicing().s("piano")',
      'chord("Bm7 Bm7b5 Bm7b5 Bo7").voicing().s("piano")',
    ),
    pair(
      "tb.dict.lefthand",
      "dict",
      'chord("Dm7 G7 C^7 C^7").voicing().s("piano")',
      'chord("Dm7 G7 C^7 C^7").dict("lefthand").voicing().s("piano")',
    ),
    pair("tb.early", "early", LINE, 'note("c3 e3 g3 c4").early(1/8).s("piano")'),
    pair("tb.late", "late", LINE, 'note("c3 e3 g3 c4").late(1/8).s("piano")'),
    pair("tb.ply", "ply", 's("hh*4")', 's("hh*4").ply(3)'),
    // Six eighths a bar: three groups of two (3/4) against two groups of three (6/8, `setcpm(bpm/2)`).
    pair("tb.meter.compound", "meter", 's("[bd hh]*3")', 's("[bd hh hh]*2")'),
    pair(
      "tb.n.chromatic",
      "n",
      'n("4 3 4 7 6 6 5 ~").scale("C4:major").s("piano")',
      'n("4 3# 4 7 6 6b 5 ~").scale("C4:major").s("piano")',
    ),
    mode("scale.mixolydian", "major", "mixolydian"),
    mode("scale.dorian", "minor", "dorian"),
    mode("scale.lydian", "major", "lydian"),
    mode("scale.phrygian", "minor", "phrygian"),
  ];
}

/**
 * The tools, chords and scales the advanced tracks unlock (Wave 7: J1–J5, R1–R3; the sound controls of A1.L05–L07
 * and A2 are in the catalog above and in their lessons' loops below), each as the same music without the tool and
 * with it.
 */
export function wave7Cases(): ControlCase[] {
  const run = (name: string) => `n("0 1 2 3 4 5 6 7").scale("C4:${name}").s("piano")`;
  const scale = (id: string, from: string, name: string): ControlCase =>
    pair(id, "scale", run(from), run(name));
  const TWO_FIVE = 'chord("<Dm7 G7>")';
  const HATS = 'note("c3*8").s("piano")';
  return [
    pair("tb.swing.patterned", "swingBy", HATS, `${HATS}.swingBy("<.33 .2>", 4)`),
    // A bar of five against a bar of four: the same hits, regrouped (one cycle is one bar, STYLE §8).
    pair("tb.meter.odd", "meter", 's("bd hh hh hh")', 's("bd hh hh bd hh")'),
    pair("tb.mini.polymeter", "{}%", 's("[bd sd hh]")', 's("{bd sd hh}%4")'),
    pair("tb.mini.euclid", "(k,n)", 's("bd*3")', 's("bd(3,8)")'),
    pair("tb.mini.euclid-rot", "(k,n,r)", 's("bd(3,8)")', 's("bd(3,8,2)")'),
    pair("tb.euclid", "euclid", 's("bd*3")', 's("bd").euclid(3, 8)'),
    pair("tb.euclidRot", "euclidRot", 's("bd").euclid(3, 8)', 's("bd").euclidRot(3, 8, 2)'),
    pair(
      "tb.dict.guidetones",
      "dict",
      `${TWO_FIVE}.voicing().s("piano")`,
      `${TWO_FIVE}.dict("guidetones").voicing().s("piano")`,
    ),
    pair(
      "tb.set",
      "set",
      `${TWO_FIVE}.voicing().s("vibes")`,
      `n("0 1 2 3").set(${TWO_FIVE}).voicing().s("vibes")`,
    ),
    pair(
      "tb.voicing.n",
      "n",
      `${TWO_FIVE}.voicing().s("vibes")`,
      `n("0 1 2 3").chord("<Dm7 G7>").voicing().s("vibes")`,
    ),
    pair(
      "tb.dict.ireal-ext",
      "dict",
      'chord("<C Co>").voicing().s("piano")',
      'chord("<C Co>").dict("ireal-ext").voicing().s("piano")',
    ),
    pair(
      "tb.mode.duck",
      "mode",
      'chord("C^7").dict("lefthand").anchor("g4").voicing().s("piano")',
      'chord("C^7").dict("lefthand").anchor("g4").mode("duck").voicing().s("piano")',
    ),
    pair(
      "tb.offset",
      "offset",
      'chord("C^7").dict("lefthand").voicing().s("piano")',
      'chord("C^7").dict("lefthand").offset(1).voicing().s("piano")',
    ),
    pair(
      "chord.sixth-sus",
      "chord",
      'chord("C C C C").voicing().s("piano")',
      'chord("C6 C69 Csus C7sus").voicing().s("piano")',
    ),
    pair(
      "chord.alt",
      "chord",
      'chord("C7 C7 C7 C7").voicing().s("piano")',
      'chord("C7b9 C7#9 C7#11 C7alt").voicing().s("piano")',
    ),
    pair(
      "chord.ext",
      "chord",
      'chord("C^7 Cm7 C7 C7").voicing().s("piano")',
      'chord("C^9 Cm9 C9 C13").voicing().s("piano")',
    ),
    scale("scale.locrian", "minor", "locrian"),
    scale("scale.altered", "mixolydian", "altered"),
    scale("scale.lydian-dominant", "mixolydian", "lydian:dominant"),
    scale("scale.bebop", "major", "bebop:major"),
  ];
}

export const CONTROL_CASES: ControlCase[] = [
  { id: "tb.room", control: "room", value: 0.6 },
  { id: "tb.clip", control: "clip", value: 0.25 },
  { id: "tb.lpf", control: "lpf", value: 400 },
  { id: "tb.delay", control: "delay", value: 0.5 },
  { id: "tb.distort", control: "distort", value: 2 },
  { id: "tb.pan", control: "pan", value: 0 },
  { id: "tb.jux", control: "jux", value: "=rev" },
  {
    id: "tb.partials",
    control: "partials",
    value: "=[1, 0, 0.5, 0, 0.25]",
    base: 'note("c3 e3 g3 c4").s("user")',
  },
  { id: "tb.hpf", control: "hpf", value: 2000 },
  { id: "tb.bpf", control: "bpf", value: 800 },
  { id: "tb.lpq", control: "lpq", value: 20, base: `${ARP}.lpf(600)` },
  { id: "tb.lpenv", control: "lpenv", value: 4, base: `${ARP}.lpf(300)` },
  { id: "tb.lpenv", control: "lpa", value: 0.2, base: `${ARP}.lpf(300).lpenv(4)` },
  { id: "tb.lpenv", control: "lpd", value: 0.05, base: `${ARP}.lpf(300).lpenv(4)` },
  { id: "tb.lpenv", control: "lps", value: 0.1, base: `${ARP}.lpf(300).lpenv(4)` },
  { id: "tb.lpenv", control: "lpr", value: 0.5, base: `${ARP}.lpf(300).lpenv(4)` },
  { id: "tb.adsr", control: "attack", value: 0.1 },
  { id: "tb.adsr", control: "decay", value: 0.05 },
  { id: "tb.adsr", control: "sustain", value: 0.2 },
  { id: "tb.adsr", control: "release", value: 0.5 },
  { id: "tb.roomsize", control: "roomsize", value: 6, base: `${ARP}.room(0.6)` },
  { id: "tb.delaytime", control: "delaytime", value: 0.125, base: `${ARP}.delay(0.5)` },
  { id: "tb.delayfeedback", control: "delayfeedback", value: 0.8, base: `${ARP}.delay(0.5)` },
  // Effects are per orbit: a kick on the arpeggio's orbit retunes its delay line; on its own orbit it does not.
  {
    id: "tb.orbit",
    control: "orbit",
    value: 2,
    base: `stack(${ARP}.delay(0.6).delaytime(0.25), s("~ bd ~ bd").delay(0.6).delaytime(0.0625))`,
    withCode: `stack(${ARP}.delay(0.6).delaytime(0.25), s("~ bd ~ bd").delay(0.6).delaytime(0.0625).orbit(2))`,
  },
  { id: "tb.crush", control: "crush", value: 4 },
  { id: "tb.coarse", control: "coarse", value: 8 },
  { id: "tb.distorttype", control: "distorttype", value: "fold", base: `${ARP}.distort(2)` },
  { id: "tb.vib", control: "vib", value: 6 },
  { id: "tb.vib", control: "vibmod", value: 2, base: `${ARP}.vib(4)` },
  { id: "tb.phaser", control: "phaser", value: 4 },
  { id: "tb.tremolo", control: "tremolosync", value: 4 },
  { id: "tb.tremolo", control: "tremolodepth", value: 0.9, base: `${ARP}.tremolosync(4)` },
  { id: "tb.lpmod", control: "lprate", value: 4, base: `${ARP}.lpf(600).lpdepth(0.8)` },
  { id: "tb.lpmod", control: "lpdepth", value: 0.8, base: `${ARP}.lpf(600).lprate(4)` },
  { id: "tb.fm", control: "fm", value: 4 },
  { id: "tb.fm", control: "fmh", value: 2.5, base: `${ARP}.fm(4)` },
  { id: "tb.unison", control: "unison", value: 1, base: 'note("c3 e3 g3 c4").s("supersaw")' },
  { id: "tb.unison", control: "detune", value: 0.8, base: 'note("c3 e3 g3 c4").s("supersaw")' },
  { id: "tb.unison", control: "spread", value: 0, base: 'note("c3 e3 g3 c4").s("supersaw")' },
  { id: "tb.pw", control: "pw", value: 0.15, base: 'note("c3 e3 g3 c4").s("pulse")' },
  { id: "tb.chop", control: "chop", value: 4, base: SAMPLE },
  { id: "tb.chop", control: "striate", value: 4, base: SAMPLE },
  { id: "tb.chop", control: "slice", value: '=4, "0 2"', base: SAMPLE },
  { id: "tb.chop", control: "splice", value: '=4, "0 2"', base: SAMPLE },
  { id: "tb.loopAt", control: "loopAt", value: 2, base: SAMPLE },
  { id: "tb.speed", control: "speed", value: 2, base: SAMPLE },
  { id: "tb.speed", control: "begin", value: 0.25, base: SAMPLE },
  { id: "tb.speed", control: "end", value: 0.25, base: SAMPLE },
  { id: "tb.compressor", control: "compressor", value: "-30:20:10:.002:.02" },
  { id: "tb.postgain", control: "postgain", value: 0.3 },
  // The ducking trigger must not sit at t = 0 (superdough schedules the duck 10 ms early).
  {
    id: "tb.duck",
    control: "duckorbit",
    value: 1,
    base: `stack(${ARP}.orbit(1), s("~ bd ~ bd").orbit(2))`,
    withCode: `stack(${ARP}.orbit(1), s("~ bd ~ bd").orbit(2).duckorbit(1))`,
  },
  {
    id: "tb.duck",
    control: "duckdepth",
    value: 1,
    base: `stack(${ARP}.orbit(1), s("~ bd ~ bd").orbit(2).duckorbit(1).duckdepth(0.3))`,
    withCode: `stack(${ARP}.orbit(1), s("~ bd ~ bd").orbit(2).duckorbit(1).duckdepth(1))`,
  },
  // Sound pack v4 controls (docs/design/samples/proposal.md §5.2).
  { id: "tb.ftype", control: "ftype", value: "ladder", base: `${ARP}.lpf(500).lpq(15)` },
  { id: "tb.penv", control: "penv", value: 24, base: 'note("c2 ~ c2 ~").s("sine").decay(.4).sustain(0)' },
  {
    id: "tb.penv",
    control: "pdecay",
    value: 0.3,
    base: 'note("c2 ~ c2 ~").s("sine").penv(24).decay(.4).sustain(0)',
  },
  {
    id: "tb.penv",
    control: "pattack",
    value: 0.3,
    base: 'note("c2 ~ c2 ~").s("sine").penv(24).decay(.4).sustain(0)',
  },
  { id: "tb.drive", control: "drive", value: 3, base: `${ARP}.lpf(800).ftype("ladder")` },
  { id: "tb.density", control: "density", value: 0.3, base: 's("crackle")' },
  { id: "tb.wt", control: "wt", value: 0.8, base: 'note("c3 e3 g3 c4").s("wt_morph")' },
  { id: "tb.wt", control: "wtenv", value: 1, base: 'note("c3 e3 g3 c4").s("wt_morph").wtdecay(.3)' },
  { id: "tb.wt", control: "wtrate", value: 4, base: 'note("c3 e3 g3 c4").s("wt_morph").wtdepth(1)' },
  { id: "tb.wt", control: "wtdepth", value: 1, base: 'note("c3 e3 g3 c4").s("wt_morph").wtrate(4)' },
  { id: "tb.velocity", control: "velocity", value: 0.3 },
  { id: "tb.gain", control: "gain", value: 0.3 },
  // Wave 4: the pattern, chord and voicing tools U05–U07 unlock (the voicing gate's tools included). A pattern
  // tool is audible when the code with it sounds different from the same music without it; each pair is
  // written out in STYLE order (controls before `.voicing()`, `.add()` before `.scale()`).
  ...wave4Cases(),
  // Wave 5: the tools U08–U11 unlock.
  ...wave5Cases(),
  // Wave 6: the tools, chords and scales U12–U17 unlock.
  ...wave6Cases(),
  // Wave 7: the tools, chords and scales of the advanced tracks.
  ...wave7Cases(),
  // Known silent no-ops (contracts §3.1 rule 7): never taught; listed so a Strudel update that changes them shows.
  { id: "noop.leslie", control: "leslie", value: 1 },
  { id: "noop.lrate", control: "lrate", value: 4 },
  { id: "noop.lsize", control: "lsize", value: 2 },
  { id: "noop.amp", control: "amp", value: 0.3 },
  { id: "noop.squiz", control: "squiz", value: 2 },
  { id: "noop.triode", control: "triode", value: 0.5 },
  { id: "noop.ring", control: "ring", value: 1 },
];

const pitched = (id: string, sound: string, notes = "c3 e3 g3 c4"): SoundCase => ({
  id,
  sound,
  code: `note("${notes}").s("${sound}")`,
});
const drum = (role: string): SoundCase => ({
  id: `snd.drum.${role}`,
  sound: role,
  code: `s("${role} ${role}")`,
});
const bank = (name: string): SoundCase => ({
  id: `snd.bank.${name}`,
  sound: name,
  code: `s("bd sd hh cp").bank("${name}")`,
});

export const SOUND_CASES: SoundCase[] = [
  ...["bd", "sd", "hh", "cp", "rim", "oh", "cr", "rd", "lt", "mt", "ht", "sh", "cb", "tb"].map(drum),
  ...["RolandTR909", "RolandTR808", "LinnDrum", "AkaiLinn", "RolandTR707"].map(bank),
  { id: "snd.jazzkit", sound: "jazzkit", code: 's("bd sd hh rd").bank("jazzkit")' },
  { id: "snd.brk", sound: "brk", code: 's("brk")' },
  // Sound pack v4: Oak's kits, the retired bank names that now play them (above), breaks, percussion, textures.
  ...["oak909", "oak808", "rockkit", "lofikit"].map((kit) => ({
    id: `snd.${kit}`,
    sound: kit,
    code: `s("bd sd hh cp").bank("${kit}")`,
  })),
  ...["clave", "conga", "bongo"].map(drum),
  ...["brkfunk", "brkboombap", "brkjungle", "brkhouse", "brkjazz", "brklofi"].map((b) => ({
    id: "snd.breaks",
    sound: b,
    code: `s("${b}")`,
  })),
  ...["foley", "snap", "impact", "swoosh", "scratch", "drone"].map((f) => ({
    id: "snd.foley",
    sound: f,
    code: `s("${f} ${f}")`,
  })),
  ...["vinyl", "tape"].map((t) => ({ id: "snd.textures", sound: t, code: `s("${t}")` })),
  ...["white", "pink", "brown"].map((n) => ({ id: "snd.noise", sound: n, code: `s("${n} ${n}")` })),
  // crackle's default density (0.02) is a click or two a second: heard at the density lessons use
  { id: "snd.noise", sound: "crackle", code: 's("crackle crackle").density(0.3)' },
  { id: "snd.sbd", sound: "sbd", code: 's("sbd sbd")' },
  ...[
    "wt_basic",
    "wt_organ",
    "wt_epiano",
    "wt_bass",
    "wt_fm",
    "wt_chip",
    "wt_voice",
    "wt_clav",
    "wt_morph",
    "wt_pwm",
    "wt_drawbar",
    "wt_fmsweep",
  ].map((w) => pitched("snd.wt", w)),
  pitched("snd.marimba", "marimba", "c4 e4 g4 c5"),
  pitched("snd.kalimba", "kalimba", "c4 e4 g4 c5"),
  pitched("snd.glockenspiel", "glockenspiel", "c6 e6 g6 c7"),
  pitched("snd.piano", "piano"),
  ...["sine", "triangle", "square", "sawtooth", "supersaw", "pulse"].map((w) => pitched(`snd.wave.${w}`, w)),
  pitched("snd.ebass", "ebass", "c2 e2 g2 c3"),
  pitched("snd.acgtr", "acgtr"),
  pitched("snd.upright", "upright", "c2 e2 g2 c3"),
  pitched("snd.rhodes", "rhodes"),
  pitched("snd.organ", "organ"),
  pitched("snd.pad", "pad"),
  pitched("snd.fingerbass", "fingerbass", "c2 e2 g2 c3"),
  pitched("snd.strings", "strings"),
  pitched("snd.crunch", "crunch", "e2 b2 e3 b2"),
  pitched("snd.jazzgtr", "jazzgtr"),
  pitched("snd.cleangtr", "cleangtr"),
  pitched("snd.horns", "horns", "c4 e4 g4 c5"),
  pitched("snd.trumpet", "trumpet", "c4 e4 g4 c5"),
  pitched("snd.tenor", "tenor", "c4 e4 g4 c5"),
  pitched("snd.vibes", "vibes", "c4 e4 g4 c5"),
  pitched("snd.mutetpt", "mutetpt", "c4 e4 g4 c5"),
  pitched("snd.clav", "clav"),
  pitched("snd.choir", "choir"),
  // U08.L05's synth-bass recipe (a template row: the sawtooth with the bass preset).
  { id: "tb.template.synthbass", sound: "sawtooth", code: 'note("c2 e2 g2 c3").s("sawtooth").lpf(600)' },
];

/** A pitched alias the sound-quality harness measures: tuning at `notes`, clicks at `clickNote`, loudness of `phrase`. */
export interface QualityCase {
  id: string;
  sound: string;
  /** MIDI notes whose fundamental is checked: A1/A2/A3 for basses, A2/A3/A4 or A3/A4 for the rest. */
  notes: number[];
  clickNote: number;
  phrase: string;
  /** Used by U03–U04 (the Band's jazz-soul and indie kits, and U03.L11): asserted, not only reported. */
  wave3: boolean;
}

const q = (sound: string, notes: number[], phrase: string, wave3 = false): QualityCase => ({
  id: `snd.${sound}`,
  sound,
  notes,
  clickNote: notes[1] ?? (notes[0] as number),
  phrase: `note("${phrase}").s("${sound}")`,
  wave3,
});
const MID = "c4 e4 g4 c5";
const LOW = "c2 e2 g2 c3";

export const QUALITY_CASES: QualityCase[] = [
  q("piano", [45, 57, 69], MID, true),
  q("rhodes", [45, 57, 69], MID, true),
  q("acgtr", [45, 57, 69], MID, true),
  q("upright", [33, 45, 57], LOW, true),
  q("ebass", [33, 45, 57], LOW, true),
  q("organ", [45, 57, 69], MID),
  q("jazzgtr", [45, 57, 69], MID),
  q("cleangtr", [45, 57, 69], MID),
  q("crunch", [45, 57, 69], "e3 g3 b3 e4"),
  q("strings", [45, 57, 69], MID),
  q("horns", [57, 69], MID),
  q("tenor", [57, 69], MID),
  q("fingerbass", [33, 45, 57], LOW),
  q("trumpet", [57, 69], MID),
  q("mutetpt", [57, 69], MID),
  q("vibes", [57, 69, 81], MID),
  q("clav", [45, 57, 69], MID),
  q("pad", [45, 57, 69], MID),
  q("choir", [45, 57, 69], MID),
  q("marimba", [57, 69, 81], MID),
  // the top tines (B4 up) ring for under 0.3 s: too short for the tuning window, so the measured notes are lower
  q("kalimba", [61, 69], MID),
  q("glockenspiel", [81, 93], "c6 e6 g6 c7"),
];

/**
 * A control heard in the context a lesson teaches it (Wave 5): the lesson's own parts, tempo and values, so
 * "only audible controls are taught" holds where the learner meets the control, not only on the harness's arpeggio.
 * A row with `same: true` is an equivalence a lesson relies on (two spellings that must sound alike); it is
 * asserted NOT audible and never decides an id.
 */
export interface LessonCase extends ControlCase {
  lesson: string;
  /** What the row proves, in the lesson's words. */
  claim: string;
  cps: number;
  cycles: number;
  same?: true;
}

/** The A1 loop (content/specs/A1.ts): 100 BPM in 4/4, the bass in note names, the riff in degrees of C major. */
const A1_CPS = 100 / 240;
const A1_BASS = 'note("<[c2 ~ c2 g1] [f1 ~ f1 c2]>")';
const A1_RIFF = 'n("<[4 4 2 4 ~ 2 0 ~] [5 5 3 5 ~ 3 0 ~]>").scale("C4:major")';
const A1_PAD = 'n("<[4 ~ 2 ~] [5 ~ 3 ~]>").scale("C4:major")';
const A1_SNARE = 's("~ sd ~ sd")';
const a1 = (
  lesson: string,
  id: string | undefined,
  control: string,
  base: string,
  withCode: string,
  claim: string,
  extra: Partial<LessonCase> = {},
): LessonCase => ({
  ...(id ? { id } : { id: "" }),
  lesson,
  control,
  value: "=",
  base,
  withCode,
  claim,
  cps: A1_CPS,
  cycles: 2,
  ...extra,
});

/** Every control A1.L01–L04 teach, in the lesson's own loop and values (content/specs/A1.ts). */
export const A1_CASES: LessonCase[] = [
  // A1.L01 Waves & Harmonics
  ...(["triangle", "square", "sawtooth"] as const).map((w) =>
    a1(
      "A1.L01",
      `snd.wave.${w}`,
      "s",
      `${A1_RIFF}.s("sine")`,
      `${A1_RIFF}.s("${w}")`,
      `a ${w} sounds unlike a sine`,
    ),
  ),
  a1(
    "A1.L01",
    "tb.partials",
    "partials",
    `${A1_RIFF}.s("sawtooth").partials([1, 0, 0, 0])`,
    `${A1_RIFF}.s("sawtooth").partials([1, 1, 1, 1])`,
    "S5: four equal harmonics are brighter than the fundamental alone",
  ),
  a1(
    "A1.L01",
    "tb.partials",
    "partials",
    `${A1_BASS}.s("sawtooth")`,
    `${A1_BASS}.s("sawtooth").partials([1, 1, 1, 1, 1, 1])`,
    "hook: six equal harmonics on the sawtooth bass change it",
  ),
  a1(
    "A1.L01",
    "tb.partials",
    "partials",
    `${A1_RIFF}.s("square")`,
    `${A1_RIFF}.s("square").partials([1, 1, 1, 1, 1]).gain(.8)`,
    "hook: five equal partials on the square riff change it",
  ),
  // A1.L02 Filters
  a1(
    "A1.L02",
    "tb.lpf",
    "lpf",
    `${A1_BASS}.s("sawtooth")`,
    `${A1_BASS}.s("sawtooth").lpf(400)`,
    "the bass under .lpf(400)",
  ),
  a1(
    "A1.L02",
    "tb.lpf",
    "lpf",
    `${A1_BASS}.s("sawtooth").lpf(4000)`,
    `${A1_BASS}.s("sawtooth").lpf(400)`,
    "S4: the starter's 4000 against the target 400",
  ),
  a1(
    "A1.L02",
    "tb.lpf",
    "lpf",
    `${A1_RIFF}.s("sawtooth").lpf(1000)`,
    `${A1_RIFF}.s("sawtooth").lpf(500)`,
    "S2: each step of <4000 2000 1000 500> is heard (the last one)",
  ),
  a1(
    "A1.L02",
    "tb.lpq",
    "lpq",
    `${A1_BASS}.s("sawtooth").lpf(400)`,
    `${A1_BASS}.s("sawtooth").lpf(400).lpq(4)`,
    "hook: .lpq(4) on the bass at 400 Hz",
  ),
  a1(
    "A1.L02",
    "tb.lpq",
    "lpq",
    `${A1_RIFF}.s("sawtooth").lpf(800).lpq(0)`,
    `${A1_RIFF}.s("sawtooth").lpf(800).lpq(10)`,
    "S5: a whistle at the cutoff from 10",
  ),
  a1(
    "A1.L02",
    "tb.lpenv",
    "lpenv",
    `${A1_RIFF}.s("sawtooth").lpf(300)`,
    `${A1_RIFF}.s("sawtooth").lpf(300).lpenv(4).lpd(.2)`,
    "S6: the pluck, up four octaves and back in 0.2 s",
  ),
  a1(
    "A1.L02",
    "tb.hpf",
    "hpf",
    `${A1_RIFF}.s("square")`,
    `${A1_RIFF}.s("square").hpf(400)`,
    "the riff under .hpf(400)",
  ),
  a1(
    "A1.L02",
    "tb.bpf",
    "bpf",
    `${A1_RIFF}.s("sawtooth")`,
    `${A1_RIFF}.s("sawtooth").bpf(800)`,
    "the riff through .bpf(800)",
  ),
  // Sound pack v4: the ladder filter (A1.L02), heard on the lesson's bass
  a1(
    "A1.L02",
    "tb.ftype",
    "ftype",
    `${A1_BASS}.s("sawtooth").lpf(500).lpq(15)`,
    `${A1_BASS}.s("sawtooth").lpf(500).lpq(15).ftype("ladder")`,
    "the acid squelch: the bass through the ladder filter",
  ),
  // Sound pack v4: the pitch envelope (A1.L03), a falling sine on the lesson's bass notes
  a1(
    "A1.L03",
    "tb.penv",
    "penv",
    `${A1_BASS}.s("sine").decay(.3).sustain(0)`,
    `${A1_BASS}.s("sine").penv(24).pdecay(.06).decay(.3).sustain(0)`,
    "a kick-like drop at the start of each bass note",
  ),
  // A1.L03 Envelopes
  a1(
    "A1.L03",
    "tb.adsr",
    "decay",
    `${A1_BASS}.s("sawtooth").lpf(500)`,
    `${A1_BASS}.s("sawtooth").lpf(500).decay(.2).sustain(0)`,
    "S4: the plucked bass",
  ),
  a1(
    "A1.L03",
    "tb.adsr",
    "attack",
    `${A1_PAD}.s("square").gain(.7)`,
    `${A1_PAD}.s("square").attack(.3).release(.8).gain(.7)`,
    "S5: the riff swells in and rings on",
  ),
  a1(
    "A1.L03",
    "tb.adsr",
    "attack",
    `${A1_PAD}.s("square")`,
    `${A1_PAD}.s("square").attack(.3)`,
    "attack alone",
  ),
  a1(
    "A1.L03",
    "tb.adsr",
    "release",
    `${A1_PAD}.s("square")`,
    `${A1_PAD}.s("square").release(.8)`,
    "release alone",
  ),
  a1(
    "A1.L03",
    "tb.adsr",
    "sustain",
    `${A1_PAD}.s("square")`,
    `${A1_PAD}.s("square").sustain(0)`,
    "mistake: .sustain(0) alone makes each note a click",
  ),
  a1(
    "A1.L03",
    undefined,
    "decay",
    `${A1_BASS}.s("sawtooth").lpf(500).decay(.2).sustain(0)`,
    `${A1_BASS}.s("sawtooth").lpf(500).decay(.2)`,
    "S4 equivalent: .decay(.2) alone sounds as .decay(.2).sustain(0)",
    { same: true },
  ),
  // A1.L04 Space
  a1("A1.L04", "tb.room", "room", A1_SNARE, `${A1_SNARE}.room(.5)`, "the snare in a room"),
  a1(
    "A1.L04",
    "tb.roomsize",
    "roomsize",
    `${A1_SNARE}.room(.5)`,
    `${A1_SNARE}.room(.5).roomsize(6)`,
    "hook: a big room (size 6) against the default",
  ),
  a1(
    "A1.L04",
    "tb.roomsize",
    "roomsize",
    `${A1_SNARE}.room(.5).roomsize(1)`,
    `${A1_SNARE}.room(.5).roomsize(6)`,
    "S5: a small room against a big one",
  ),
  a1(
    "A1.L04",
    "tb.delay",
    "delay",
    `${A1_RIFF}.s("square").lpf(2000)`,
    `${A1_RIFF}.s("square").lpf(2000).delay(.4)`,
    "the riff echoes",
  ),
  a1(
    "A1.L04",
    "tb.delaytime",
    "delaytime",
    `${A1_RIFF}.s("square").lpf(2000).delay(.4)`,
    `${A1_RIFF}.s("square").lpf(2000).delay(.4).delaytime(.3)`,
    "hook: half a beat (0.3 s) against the left-out default (0.45 s at 100 BPM)",
  ),
  a1(
    "A1.L04",
    "tb.delaytime",
    "delaytime",
    `${A1_RIFF}.s("square").delay(.4).delaytime(.6).delayfeedback(.3)`,
    `${A1_RIFF}.s("square").delay(.4).delaytime(.3).delayfeedback(.3)`,
    "S4: the starter's 0.6 against the target 0.3",
  ),
  a1(
    "A1.L04",
    "tb.delayfeedback",
    "delayfeedback",
    `${A1_RIFF}.s("square").delay(.4).delaytime(.3).delayfeedback(.7)`,
    `${A1_RIFF}.s("square").delay(.4).delaytime(.3).delayfeedback(.3)`,
    "S4: the starter's 0.7 against the target 0.3",
  ),
  a1(
    "A1.L04",
    "tb.delayfeedback",
    "delayfeedback",
    `${A1_RIFF}.s("square").delay(.5).delaytime(.3).delayfeedback(.2)`,
    `${A1_RIFF}.s("square").delay(.5).delaytime(.3).delayfeedback(.7)`,
    'S3: the two bars of delayfeedback("<.2 .7>")',
  ),
  // Orbits: the riff's small room shares the snare's orbit, so one reverb keeps switching size; orbit 2 gives the
  // riff its own (S5).
  a1(
    "A1.L04",
    "tb.orbit",
    "orbit",
    `stack(${A1_SNARE}.room(.5).roomsize(6), ${A1_PAD}.s("square").lpf(2000).room(.3).roomsize(1))`,
    `stack(${A1_SNARE}.room(.5).roomsize(6), ${A1_PAD}.s("square").lpf(2000).room(.3).roomsize(1).orbit(2))`,
    "S5: two rooms on one orbit, then the riff on its own",
  ),
  // The hook moves the echoing riff to orbit 2 while only the snare has a room: nothing on orbit 1 sets a delay,
  // so this is reported (does the hook's .orbit(2) change what is heard?), never used to decide tb.orbit.
  a1(
    "A1.L04",
    undefined,
    "orbit",
    `stack(${A1_SNARE}.room(.5).roomsize(6), ${A1_RIFF}.s("square").lpf(2000).delay(.4).delaytime(.3).delayfeedback(.4))`,
    `stack(${A1_SNARE}.room(.5).roomsize(6), ${A1_RIFF}.s("square").lpf(2000).delay(.4).delaytime(.3).delayfeedback(.4).orbit(2))`,
    "hook: .orbit(2) on the echoing riff when only the snare has a room",
  ),
];

/** U08.L05's bass tone: each bass sound, darker and brighter under the bass preset `.lpf()`, at 96 BPM. */
const U08_BASS = 'n("<[0 ~ 0 4] [5 ~ 5 9] [3 ~ 3 7] [4 ~ 4 8]>").scale("C2:major")';
export const BASS_TONE_CASES: LessonCase[] = (
  ["ebass", "fingerbass", "upright", "sawtooth"] as const
).flatMap((sound) => [
  {
    id: "tb.lpf",
    lesson: "U08.L05",
    control: "lpf",
    value: "=",
    base: `${U08_BASS}.s("${sound}")`,
    withCode: `${U08_BASS}.s("${sound}").lpf(600)`,
    claim: `the bass preset .lpf(600) darkens ${sound}`,
    cps: 96 / 240,
    cycles: 2,
  },
  {
    id: "tb.lpf",
    lesson: "U08.L05",
    control: "lpf",
    value: "=",
    base: `${U08_BASS}.s("${sound}").lpf(1200)`,
    withCode: `${U08_BASS}.s("${sound}").lpf(400)`,
    claim: `moving .lpf() from 1200 to 400 is heard on ${sound}`,
    cps: 96 / 240,
    cycles: 2,
  },
]);

/** Every U08–U11 lesson context and A1 row, in the order audibility.pw.ts renders them. */
export const LESSON_CASES: LessonCase[] = [...A1_CASES, ...BASS_TONE_CASES];

// Wave 6: what U12–U17 teach, heard in the lessons' own loops (content/specs/U12.ts … U17.ts: the hooks and the
// Make starters, at their tempos). The render frame takes one expression, so a lesson's labelled tracks are the
// elements of a `stack(…)` here; the code of each element is the lesson's own.
const w6 = (
  lesson: string,
  id: string,
  control: string,
  bpm: number,
  base: readonly string[],
  withCode: readonly string[],
  claim: string,
  extra: Partial<LessonCase> = {},
): LessonCase => ({
  id,
  lesson,
  control,
  value: "=",
  base: `stack(${base.join(", ")})`,
  withCode: `stack(${withCode.join(", ")})`,
  claim,
  cps: bpm / 240,
  cycles: 2,
  ...extra,
});
const U12_BASS = (changes: string) => `chord("${changes}").rootNotes(2).s("upright")`;
/** U13.L01 (content/specs/U13.ts PUSHED): kick, snare and hats on the grid, the bass on 1, 3 and 4. */
const U13_GRID = ['s("bd ~ bd ~")', 's("~ sd ~ sd")', 's("hh*8").gain(.5)'];
const U13_PUSH_BASS = 'chord("<Dm7 G7>").rootNotes(2).struct("x ~ ~ ~ x ~ x ~").s("fingerbass").lpf(800)';
/** U13.L02 (FUNK): the sixteenth-note vamp, with every `.velocity()` of the hook or with none. */
const U13_KICK = 's("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")';
const U13_SNARE = 's("~ ~ ~ ~ sd ~ ~ sd ~ sd ~ ~ sd ~ ~ sd")';
const U13_SNARE_VELOCITY = '.velocity("1 1 1 1 1 1 1 .3 1 .3 1 1 1 1 1 .3")';
const U13_FUNK_BASS =
  'chord("<Dm7 G7>").rootNotes(2).struct("x ~ ~ ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~").s("fingerbass").lpf(800)';
const u13Gtr = (velocity: string) =>
  `chord("<Dm7 G7>").voicing().struct("x*16").s("cleangtr")${velocity}.clip(.5).gain(.6)`;
const U13_GTR_VELOCITY = '.velocity("[.25 .25 1 .25 .25 1 .25 .25]*2")';
/** U13.L04 and L05: the ballad's changes, one bar here. */
const U13_BALLAD_BASS = (struct: string) =>
  `chord("<C^7 Am7>").rootNotes(2).struct("${struct}").s("fingerbass").lpf(800)`;
/** U14.L06's Make starter: the Dorian vamp. */
const U14_VAMP = (pan: string, jux: string) => [
  `chord("<Dm7 Dm7>").voicing().struct("~ x ~ x ~ ~ x ~").s("rhodes")${pan}`,
  'chord("<Dm7 Dm7>").rootNotes(2).struct("x ~ ~ x ~ ~ x ~").s("fingerbass").lpf(800)',
  `n("<[0 ~ 2 3 ~ 4 6 ~] [7 ~ 6 4 ~ 3 2 0]>").scale("D3:dorian").s("cleangtr")${jux}`,
];
const riff = (scale: string, sound: string) =>
  `n("<[0 ~ 2 4 ~ 6 4 ~] [7 ~ 6 4 ~ 3 1 0]>").scale("${scale}").s("${sound}")`;

/** U14.L03's i–IV vamp (content/specs U14.ts): the Rhodes on i and IV, the riff through the 6th. */
const dorianVamp = (scale: string) =>
  `n("<[0,2,4] [3,5,7]>").struct("~ x ~ x ~ ~ x ~").scale("${scale}").s("rhodes"), n("<[0 ~ 2 4 ~ 5 4 ~] [7 ~ 5 4 ~ 3 2 0]>").scale("${scale.replace("3:", "4:")}").s("piano")`;

export const W6_LESSON_CASES: LessonCase[] = [
  w6(
    "U12.L01",
    "chord.seventh",
    "chord",
    90,
    ['chord("<C C>").voicing().s("rhodes")', U12_BASS("<C C>")],
    ['chord("<C C^7>").voicing().s("rhodes")', U12_BASS("<C C>")],
    "C then C^7 on the Rhodes: the added 7th is heard over the bass",
  ),
  w6(
    "U12.L03",
    "chord.seventh-dim",
    "chord",
    76,
    ['chord("Bm7b5").voicing().s("rhodes")', U12_BASS("B")],
    ['chord("Bo7").voicing().s("rhodes")', U12_BASS("B")],
    "half-diminished against diminished seventh: one voice a half step lower",
    { cycles: 1 },
  ),
  w6(
    "U12.L06",
    "tb.dict.lefthand",
    "dict",
    112,
    [
      'chord("<Dm7 G7>").voicing().struct("~ x ~ ~ x ~ ~ ~").s("rhodes")',
      'chord("<Dm7 G7>").rootNotes(2).struct("x x x x").s("upright")',
    ],
    [
      'chord("<Dm7 G7>").dict("lefthand").voicing().struct("~ x ~ ~ x ~ ~ ~").s("rhodes")',
      'chord("<Dm7 G7>").rootNotes(2).struct("x x x x").s("upright")',
    ],
    'the hook with and without .dict("lefthand"): the rootless voicing is another sound',
  ),
  w6(
    "U13.L01",
    "tb.early",
    "early",
    96,
    [...U13_GRID, U13_PUSH_BASS, 'chord("<Dm7 G7>").voicing().s("rhodes")'],
    [...U13_GRID, U13_PUSH_BASS, 'chord("<Dm7 G7>").voicing().early(1/8).s("rhodes")'],
    "the Rhodes an eighth early over drums and bass that stay on the beat",
  ),
  w6(
    "U13.L01",
    "tb.late",
    "late",
    96,
    [...U13_GRID, U13_PUSH_BASS, 'chord("<Dm7 G7>").voicing().struct("x x x x").s("organ")'],
    [...U13_GRID, U13_PUSH_BASS, 'chord("<Dm7 G7>").voicing().struct("x x x x").late(1/8).s("organ")'],
    "organ stabs an eighth late: off the beat, between the hats' accents",
  ),
  w6(
    "U13.L02",
    "tb.velocity",
    "velocity",
    96,
    [U13_KICK, U13_SNARE, 's("hh*16").gain(.5)', U13_FUNK_BASS, u13Gtr("")],
    [
      U13_KICK,
      `${U13_SNARE}${U13_SNARE_VELOCITY}`,
      's("hh*16").velocity("[1 .4 .7 .4]*4").gain(.5)',
      U13_FUNK_BASS,
      u13Gtr(U13_GTR_VELOCITY),
    ],
    "the vamp with no .velocity() anywhere against the hook (S1's two items)",
  ),
  w6(
    "U13.L02",
    "tb.velocity",
    "velocity",
    96,
    [
      U13_KICK,
      's("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~")',
      's("hh*16").velocity("[1 .4 .7 .4]*4").gain(.5)',
      U13_FUNK_BASS,
      u13Gtr(U13_GTR_VELOCITY),
    ],
    [
      U13_KICK,
      `${U13_SNARE}${U13_SNARE_VELOCITY}`,
      's("hh*16").velocity("[1 .4 .7 .4]*4").gain(.5)',
      U13_FUNK_BASS,
      u13Gtr(U13_GTR_VELOCITY),
    ],
    "the three ghost notes at .3 are heard in the full groove (the hook against the hook without them)",
  ),
  w6(
    "U13.L04",
    "tb.meter.compound",
    "meter",
    60,
    [
      's("bd ~ ~ ~ ~ ~")',
      's("~ ~ sd ~ sd ~")',
      's("hh*6").velocity("[1 .5]*3").gain(.5)',
      U13_BALLAD_BASS("x ~ x ~ x ~"),
    ],
    [
      's("bd ~ ~ ~ ~ bd")',
      's("~ ~ ~ sd ~ ~")',
      's("hh*6").velocity("[1 .5 .6]*2").gain(.5)',
      U13_BALLAD_BASS("x ~ ~ x ~ ~"),
    ],
    "six eighths as a waltz bar (three twos) against 6/8 (two threes), at 60 to the dotted quarter",
    { cps: 60 / 120 },
  ),
  w6(
    "U13.L05",
    "tb.ply",
    "ply",
    76,
    ['s("bd ~ bd ~")', 's("~ sd ~ sd")', 's("hh*4").gain(.5)', U13_BALLAD_BASS("x ~ x ~")],
    [
      's("bd ~ bd ~")',
      's("~ sd ~ sd").ply("1 1 1 3")',
      's("hh*4").ply(3).velocity("[1 .5 .6]*4").gain(.5)',
      U13_BALLAD_BASS("x ~ x ~"),
    ],
    "hats in triplets and a snare roll with .ply(3)",
    { cycles: 1 },
  ),
  w6(
    "U14.L01",
    "scale.mixolydian",
    "scale",
    104,
    [riff("G3:major", "crunch")],
    [riff("G3:mixolydian", "crunch")],
    "the riff on G major and on G Mixolydian: one note lower",
  ),
  w6(
    "U14.L03",
    "scale.dorian",
    "scale",
    96,
    [dorianVamp("D3:minor")],
    [dorianVamp("D3:dorian")],
    "D minor against D Dorian on the i–IV vamp: the raised 6th in the IV chord and the riff",
  ),
  w6(
    "U14.L04",
    "scale.lydian",
    "scale",
    84,
    ['n("<[0,2,4] [1,3,5]>").scale("F3:major").s("pad")', riff("F4:major", "piano")],
    ['n("<[0,2,4] [1,3,5]>").scale("F3:lydian").s("pad")', riff("F4:lydian", "piano")],
    "F major against F Lydian on the pad and the piano: the raised 4th",
  ),
  w6(
    "U14.L05",
    "scale.phrygian",
    "scale",
    100,
    ['n("<[0,2,4] [1,3,5]>").scale("E3:minor").struct("x ~ ~ x ~ ~ x ~").s("acgtr")'],
    ['n("<[0,2,4] [1,3,5]>").scale("E3:phrygian").struct("x ~ ~ x ~ ~ x ~").s("acgtr")'],
    "E minor's diminished ii against E Phrygian's ♭II on the guitar, three-three-two",
  ),
  w6(
    "U14.L06",
    "tb.pan",
    "pan",
    100,
    U14_VAMP("", ""),
    U14_VAMP(".pan(.3)", ""),
    "the Rhodes moved left with .pan(.3) in the vamp",
  ),
  w6(
    "U14.L06",
    "tb.jux",
    "jux",
    100,
    U14_VAMP(".pan(.3)", ""),
    U14_VAMP(".pan(.3)", ".jux(rev)"),
    "the riff doubled backwards on the right with .jux(rev)",
  ),
  w6(
    "U15.L01",
    "tb.n.chromatic",
    "n",
    92,
    ['n("<[4 3 4 7] [5 4 5 ~]>").scale("C4:major").s("piano")', 'note("<c2 a1>").s("ebass").lpf(800)'],
    ['n("<[4 3# 4 7] [5 4# 5 ~]>").scale("C4:major").s("piano")', 'note("<c2 a1>").s("ebass").lpf(800)'],
    "the leaning notes ♯4 and ♯5 against the plain 4 and 5",
  ),
  w6(
    "U17.L02",
    "tb.scale.patterned",
    "scale",
    112,
    [
      'n("<[4 ~ 2 4] [2 ~ 0 ~]>").scale("C4:major").s("piano")',
      'n("<0 5>").struct("x ~ x x").scale("C2:major").s("ebass").lpf(700)',
    ],
    [
      'n("<[4 ~ 2 4] [2 ~ 0 ~]>").scale("<C4:major D4:major>").s("piano")',
      'n("<0 5>").struct("x ~ x x").scale("<C2:major D2:major>").s("ebass").lpf(700)',
    ],
    "the lift: the second bar a whole step up, tune and bass",
  ),
];

// Wave 7: what A1.L05–L07 and A2 teach, in the lessons' own loops and at the values the specs grade (content/specs
// A1.ts, A2.ts): the A1 loop at 100 BPM for A1, A2.L01's A-minor loop at 90 and the break at 96 for A2. The `same`
// rows are the silencers the Makes must fail (a control set where it cannot be heard).
const A1_HATS = 's("hh*8").gain(.5)';
const A1_PLACED_BASS = `${A1_BASS}.s("sawtooth").lpf(500).decay(.2).sustain(0)`;
const A1_LEAD = 'n("<[4@3 2] [5@3 3]>").scale("C5:major").s("triangle")';
const A1_SYNTH_PAD = 'note("<[c4,e4,g4] [c4,f4,a4]>").s("sawtooth").lpf(900).gain(.3)';
const A1_PAD_OPEN = 'note("<[c4,e4,g4] [c4,f4,a4]>").s("sawtooth").gain(.3)';
const A1_SAW_PAD = 'note("<[c3,g3,e4] [f3,c4,a4]>").s("supersaw").lpf(2000).gain(.25)';
const A2_CPS = 90 / 240;
const A2_LOOP = [
  's("bd ~ ~ bd ~ ~ bd ~").gain(.8)',
  's("~ sd ~ sd").gain(.7)',
  'n("<[0 ~ 0 ~] [5 ~ 5 ~]>").scale("A1:minor").s("fingerbass").lpf(800)',
];
const A2_PAD = 'chord("<Am7 F^7>").voicing().s("rhodes").gain(.5)';
const a2 = (
  id: string,
  control: string,
  base: string,
  withCode: string,
  claim: string,
  cps = A2_CPS,
): LessonCase => ({
  id,
  lesson: id === "tb.chop" || id === "tb.loopAt" || id === "tb.speed" ? "A2.L04" : "A2.L05",
  control,
  value: "=",
  base,
  withCode,
  claim,
  cps,
  cycles: 2,
});

export const W7_LESSON_CASES: LessonCase[] = [
  // Sound pack v4: drive and crackle density (A1.L05), the morphing table (A1.L06)
  a1(
    "A1.L05",
    "tb.drive",
    "drive",
    `${A1_BASS}.s("sawtooth").lpf(800).ftype("ladder")`,
    `${A1_BASS}.s("sawtooth").lpf(800).ftype("ladder").drive(3)`,
    "the ladder filter's drive on the bass",
  ),
  a1(
    "A1.L05",
    "tb.density",
    "density",
    's("crackle").density(.05)',
    's("crackle").density(.4)',
    "a crackle bed thickened",
  ),
  a1(
    "A1.L06",
    "tb.wt",
    "wt",
    `${A1_RIFF}.s("wt_morph").wt(0)`,
    `${A1_RIFF}.s("wt_morph").wt(1)`,
    "the morph table from saw to square",
  ),
  // A1.L05 Grit
  a1(
    "A1.L05",
    "tb.distort",
    "distort",
    `${A1_PLACED_BASS}`,
    `${A1_PLACED_BASS}.distort(.5)`,
    "the Make's threshold: the bass at .distort(.5)",
  ),
  a1(
    "A1.L05",
    "tb.distort",
    "distort",
    `${A1_PLACED_BASS}`,
    `${A1_PLACED_BASS}.distort(1.5).gain(.6)`,
    "hook: the bass saturated at 1.5 and turned down to match",
  ),
  a1("A1.L05", "tb.crush", "crush", A1_HATS, `${A1_HATS}.crush(5)`, "hook: the hats crushed to five bits"),
  a1(
    "A1.L05",
    "tb.crush",
    "crush",
    `${A1_RIFF}.s("square")`,
    `${A1_RIFF}.s("square").crush(6)`,
    "the Make's threshold: the riff at six bits",
  ),
  a1(
    "A1.L05",
    "tb.coarse",
    "coarse",
    `${A1_RIFF}.s("square")`,
    `${A1_RIFF}.s("square").coarse(4)`,
    "the Make's threshold: every fourth sample held",
  ),
  a1(
    "A1.L05",
    "tb.distorttype",
    "distorttype",
    `${A1_PLACED_BASS}.distort(1)`,
    `${A1_PLACED_BASS}.distorttype("diode").distort(1)`,
    "a saturation curve of your own: diode against the default",
  ),
  a1(
    "A1.L05",
    undefined,
    "crush",
    `${A1_RIFF}.s("square")`,
    `${A1_RIFF}.s("square").crush(16)`,
    "silencer: 16 bits is too fine to hear",
    { same: true },
  ),
  a1(
    "A1.L05",
    undefined,
    "coarse",
    `${A1_RIFF}.s("square")`,
    `${A1_RIFF}.s("square").coarse(1)`,
    "silencer: .coarse(1) changes nothing",
    { same: true },
  ),
  // A1.L06 Movement
  a1(
    "A1.L06",
    "tb.vib",
    "vib",
    A1_LEAD,
    `${A1_LEAD}.vib(5).vibmod(.25)`,
    "hook: the lead sings with .vib(5).vibmod(.25)",
  ),
  a1("A1.L06", "tb.vib", "vib", A1_LEAD, `${A1_LEAD}.vib(5).vibmod(.3)`, "S4's target, .vib(5).vibmod(.3)"),
  a1(
    "A1.L06",
    "tb.phaser",
    "phaser",
    A1_SYNTH_PAD,
    `${A1_SYNTH_PAD}.phaser(2)`,
    "the pad through a phaser at 2 Hz",
  ),
  a1(
    "A1.L06",
    "tb.tremolo",
    "tremolosync",
    A1_SYNTH_PAD,
    `${A1_SYNTH_PAD}.tremolosync(4)`,
    "the pad's level dipping four times a bar",
  ),
  a1(
    "A1.L06",
    "tb.lpmod",
    "lprate",
    A1_SYNTH_PAD,
    `${A1_SYNTH_PAD}.lprate(.5).lpdepth(.6)`,
    "hook: the pad's cutoff swept at .5 Hz",
  ),
  a1(
    "A1.L06",
    undefined,
    "vibmod",
    A1_LEAD,
    `${A1_LEAD}.vib(5).vibmod(0)`,
    "silencer: .vibmod(0) is no vibrato",
    { same: true },
  ),
  a1(
    "A1.L06",
    undefined,
    "lprate",
    A1_PAD_OPEN,
    `${A1_PAD_OPEN}.lprate(1)`,
    "silencer: .lprate() on a line with no .lpf() does nothing",
    { same: true },
  ),
  // A1.L07 FM & Supersaw
  a1(
    "A1.L07",
    "tb.fm",
    "fm",
    `${A1_RIFF}.s("sine")`,
    `${A1_RIFF}.s("sine").fm(.5)`,
    "the Make's threshold: .fm(.5) on the sine riff",
  ),
  a1(
    "A1.L07",
    "tb.fm",
    "fmh",
    `${A1_RIFF}.s("sine").fm(3)`,
    `${A1_RIFF}.s("sine").fm(3).fmh(3.5)`,
    "S4: the ratio 3.5 rings like a bell against ratio 1",
  ),
  a1(
    "A1.L07",
    "tb.unison",
    "detune",
    `${A1_SAW_PAD}.detune(0)`,
    `${A1_SAW_PAD}.detune(.4)`,
    "S5: the supersaw pad narrow and wide",
  ),
  a1(
    "A1.L07",
    "tb.pw",
    "pw",
    `${A1_RIFF}.s("pulse")`,
    `${A1_RIFF}.s("pulse").pw(.2)`,
    "the pulse wave's width, named in the stretch's hint",
  ),
  a1(
    "A1.L07",
    "snd.wave.supersaw",
    "s",
    `${A1_RIFF}.s("sawtooth")`,
    `${A1_RIFF}.s("supersaw")`,
    "five detuned saws against one",
  ),
  a1(
    "A1.L07",
    "snd.wave.pulse",
    "s",
    `${A1_RIFF}.s("square")`,
    `${A1_RIFF}.s("pulse").pw(.2)`,
    "a narrow pulse against the square",
  ),
  a1(
    "A1.L07",
    undefined,
    "fm",
    `${A1_RIFF}.s("piano")`,
    `${A1_RIFF}.s("piano").fm(4)`,
    "silencer: FM does nothing on a recorded instrument",
    { same: true },
  ),
  // A2.L04 Sampling (the break at 96 BPM) and A2.L05 Mix
  a2(
    "tb.chop",
    "slice",
    's("brk").slice(4, "0 1 2 3")',
    's("brk").slice(4, "0 2 1 3")',
    "the break's slices reordered",
    96 / 240,
  ),
  a2("tb.loopAt", "loopAt", 's("brk")', 's("brk").loopAt(2)', "the break stretched over two bars", 96 / 240),
  a2("tb.speed", "speed", 's("brk")', 's("brk").speed(1.5)', "the break played faster and higher", 96 / 240),
  a2(
    "tb.compressor",
    "compressor",
    `stack(${A2_LOOP.join(", ")}, ${A2_PAD})`,
    `stack(${A2_LOOP.join(", ")}, ${A2_PAD}.compressor("-20:4:10:.005:.1"))`,
    "the pad compressed under the loop",
  ),
  a2(
    "tb.postgain",
    "postgain",
    `stack(${A2_LOOP.join(", ")}, ${A2_PAD})`,
    `stack(${A2_LOOP.join(", ")}, ${A2_PAD}.postgain(.5))`,
    "the pad turned down after its effects",
  ),
  a2(
    "tb.duck",
    "duckorbit",
    // The trigger off t = 0 (superdough schedules the duck 10 ms early, as the catalog's tb.duck row notes).
    `stack(${A2_PAD}.orbit(1), s("~ bd ~ ~ bd ~ bd ~").orbit(2))`,
    `stack(${A2_PAD}.orbit(1), s("~ bd ~ ~ bd ~ bd ~").orbit(2).duckorbit(1))`,
    "the pad ducking under the kick",
  ),
  a2(
    "tb.pan",
    "pan",
    `stack(${A2_LOOP.join(", ")}, ${A2_PAD})`,
    `stack(${A2_LOOP.join(", ")}, ${A2_PAD}.pan(.25))`,
    "the pad moved left in the mix",
  ),
];
