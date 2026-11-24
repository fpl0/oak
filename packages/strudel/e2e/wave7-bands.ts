// The Wave 7 Bands as the sound engineer proposes them (contracts §5.10): the jazz track's swing Bands (a ii–V–I that
// plays in all twelve keys, the jazz blues, rhythm changes), the arrangement track's neo-soul groove with a laid-back
// feel, and the rhythm track's sixteenth-note funk, son montuno (with and without a clave) and the odd meters 5/4,
// 7/8 and 9/8, each in all four flavours. Band code is content (content/bands, author:CP's path); this file holds the
// code as written and measured by the sound work, so the checks in wave7-bands.test.ts (headless) and wave7.pw.ts
// (the mix, in the browser) run on it today and move with it into content/bands unchanged.
//
// Every Band is written in half steps from C4 plus the step's tonic (content/bands' TONIC: `.add(n("0").scale(
// "{{key}}"))`), so its chart, given here in C, plays in any key (TONIC_BANDS). Each names the parts a lesson asks
// the LEARNER to write over it (`learnerParts`): a lesson that grades a part selects the Band's other tracks
// (`BandSetup.tracks`), so no Band ever sounds the notes the learner is asked to supply. No Band has a melody or a
// horn line: the head, the contrafact, the stabs (RC1) and the clave of the lessons that ask for one are the
// learner's.
import type { MeterId } from "@oak/content-kit";
import { claveMini } from "@oak/content-kit";
import { jazzBlues, rhythmChanges, twoFiveOne } from "@oak/theory";
import { flavourById } from "../../../content/flavours.ts";
import { type ChartBar, swingBacking } from "../src/swing-backing.ts";

export type Flavour = "flavour.pop" | "flavour.jazz-soul" | "flavour.indie" | "flavour.funk";
export const FLAVOURS: readonly Flavour[] = [
  "flavour.pop",
  "flavour.jazz-soul",
  "flavour.indie",
  "flavour.funk",
];

interface Kit {
  bank: string;
  bass: string;
  chords: string;
  drumsGain: number;
  /**
   * Controls on the whole drum line after the bank, or none. Funk: Oak's 808 kick (sound pack v4, which
   * `RolandTR808` now plays) rings for 3 s, where the old machine's lasted 0.25 s; it is choked as the unit songs and
   * content/bands choke it (`.decay(.35).sustain(0)`), which leaves the shorter hats and snare as they were.
   */
  drumsFx?: string;
  hatsGain: number;
  bassGain: number;
  chordsGain: number;
}
/** The flavour kits of content/bands (content/flavours.ts), as Wave 6's Bands use them. */
const KITS: Record<Flavour, Kit> = {
  "flavour.pop": {
    bank: "",
    bass: "ebass",
    chords: "piano",
    drumsGain: 0.7,
    hatsGain: 0.5,
    bassGain: 0.9,
    chordsGain: 0.4,
  },
  // Drums .65 → .72 and ride .55 → .6 (sound pack v4: the soft kick's layer trim): the swing Bands' kit sat 10.3 LU
  // under the walking bass (wave7.pw.ts).
  "flavour.jazz-soul": {
    bank: "jazzkit",
    bass: "upright",
    chords: "rhodes",
    drumsGain: 0.72,
    hatsGain: 0.6,
    bassGain: 0.9,
    chordsGain: 0.5,
  },
  "flavour.indie": {
    bank: "LinnDrum",
    bass: "ebass",
    chords: "cleangtr",
    drumsGain: 0.6,
    hatsGain: 0.25,
    bassGain: 0.9,
    chordsGain: 0.4,
  },
  // Sound pack v4 (Oak's 808 under `RolandTR808`, hits hotter than the old machine's): drums .9 → .6, hats .6 → .4,
  // the clav .4 → .5, and the swing Bands' hat figure .9 → .6 (they clipped): within 10 LU and under full scale.
  "flavour.funk": {
    bank: "RolandTR808",
    drumsFx: ".decay(.35).sustain(0)",
    bass: "fingerbass",
    chords: "clav",
    drumsGain: 0.6,
    hatsGain: 0.4,
    bassGain: 0.9,
    chordsGain: 0.5,
  },
};
const num = (x: number): string => String(x).replace(/^0\./, ".");
const TONIC = 'n("0").scale("{{key}}")';
const prodOf = (f: Flavour) => {
  const p = flavourById.get(f)?.production;
  if (!p) throw new Error(`no flavour kit ${f}`);
  return p;
};

export interface Wave7Band {
  id: string;
  title: string;
  bars: number;
  meter: MeterId;
  /** The harmony, bar by bar, in C (each bar one chord, or two a half bar each). */
  changes: readonly ChartBar[];
  /** The lessons and capstones that use it (content/specs). */
  usedBy: readonly string[];
  /** What the learner writes over it in those lessons: their steps select the Band's other tracks. */
  learnerParts: readonly ("drums" | "bass" | "chords" | "melody" | "clave" | "stabs")[];
  /** A swing Band's eighths (1/3: the "and" on the last triplet), a 16th feel's, or none. */
  swing?: { subdivision: 8 | 16; amount: number };
  /** The laid-back part's delay in cycles (`.late()`), for the neo-soul groove. */
  late?: number;
  code: Record<Flavour, string>;
}

const SWING_CHORD_LIFT: Record<Flavour, number> = {
  "flavour.pop": 1,
  "flavour.jazz-soul": 1.3,
  "flavour.indie": 1,
  "flavour.funk": 1.6,
};
/** A swing Band from a chart, in every flavour's kit (the ride and the walk in every flavour: it is jazz). */
function swingBand(chart: readonly ChartBar[], gains: { chords?: number } = {}): Record<Flavour, string> {
  const out = {} as Record<Flavour, string>;
  for (const f of FLAVOURS) {
    const k = KITS[f];
    const prod = prodOf(f);
    const layers = swingBacking(chart, {
      relative: true,
      ...(k.bank ? { bank: k.bank } : {}),
      // The TR-808 has no ride: the funk kit plays the ride's figure on its closed hat.
      rideSound: f === "flavour.funk" ? "hh" : "rd",
      bassSound: f === "flavour.funk" ? "upright" : k.bass === "ebass" ? "upright" : k.bass,
      chordSound: k.chords,
      // Measured in wave7.pw.ts: the funk kit's hat figure and the clav's two hits a bar sat 8 and 10 LU under
      // the upright, the pop ride 9 under it and the Rhodes's two hits 9.9 under it in the blues: lifted.
      // Sound pack v4: `LinnDrum` plays rockkit, whose ride is a quiet jazz ride (16.5 dB under the old LinnDrum
      // ride): at the kit's hat level (.25) the indie kit sat 14 LU under the walk; .55.
      rideGain:
        f === "flavour.funk" ? 0.6 : f === "flavour.pop" ? 0.7 : f === "flavour.indie" ? 0.55 : k.hatsGain,
      bassGain: k.bassGain,
      chordGain: Math.round(k.chordsGain * (gains.chords ?? 1) * SWING_CHORD_LIFT[f] * 100) / 100,
      bassLpf: prod.bassLpf,
    });
    out[f] = [
      `drums: ${layers.drums}`,
      `bass: ${layers.bass}`,
      `chords: ${layers.chords}.pan(${num(prod.pan.chords ?? 0.42)}).room(${num(prod.room)})`,
    ].join("\n");
  }
  return out;
}

/** Three labelled tracks from half-step patterns (C4 = 0) in a flavour's kit. */
function semiLayers(
  f: Flavour,
  p: {
    drums: string;
    bass: string;
    chords: string;
    bassTail?: string;
    chordsTail?: string;
    chordsSound?: string;
    chordsLift?: number;
  },
): string {
  // (the drums' level is set inside each Band's own `stack(…)`)
  const k = KITS[f];
  const prod = prodOf(f);
  const bank = k.bank ? `.bank("${k.bank}")` : "";
  const gain = Math.round(k.chordsGain * (p.chordsLift ?? 1) * 100) / 100;
  return [
    `drums: ${p.drums}${bank}${k.drumsFx ?? ""}`,
    `bass: note(${p.bass}).add(${TONIC})${p.bassTail ?? ""}.s("${k.bass}").lpf(${prod.bassLpf}).gain(${num(k.bassGain)})`,
    `chords: note(${p.chords}).add(${TONIC})${p.chordsTail ?? ""}.s("${p.chordsSound ?? k.chords}").gain(${num(gain)}).pan(${num(prod.pan.chords ?? 0.42)}).room(${num(prod.room)})`,
  ].join("\n");
}
const eachFlavour = (code: (f: Flavour) => string): Record<Flavour, string> =>
  Object.fromEntries(FLAVOURS.map((f) => [f, code(f)])) as Record<Flavour, string>;

// --- the jazz track -------------------------------------------------------------------------------------------

const TWO_FIVE = twoFiveOne("C").symbols;
/** J1–J2 (J1.L01's ride, J1.L05's shells over it, J2.L01's twelve keys): ii–V–I–I. */
const SWING_TWO_FIVE: readonly ChartBar[] = [[TWO_FIVE[0]], [TWO_FIVE[1]], [TWO_FIVE[2]], [TWO_FIVE[2]]];

// --- the arrangement track: neo-soul (A2, AC2) ----------------------------------------------------------------

/** Rootless voicings with 9ths and 13ths, each change a step or less in every voice (@oak/theory rootlessVoicing). */
const NEO_CHORDS = '"<[[-3,0,4,7] [-5,-1,2,6]] [[-7,-3,0,4] [-7,-3,-1,4]]>"';
/** Root on 1; the next chord's root a sixteenth early (the "a" of 2, the "a" of 4): the bass leans into each change. */
const NEO_BASS = '"<[-19 ~ ~ ~ ~ ~ ~ -20 ~ ~ ~ ~ ~ ~ -22 ~] [-22 ~ ~ ~ ~ ~ ~ -17 ~ ~ ~ ~ ~ ~ -19 ~]>"';
/** Laid back: the snare and the chords 1/128 of a bar late (24.7 ms at 76 BPM, 21 at 88: inside FEEL_MS 8–45). */
const LAID_BACK = 1 / 128;
/** The pop kit sat 10 LU over the Rhodes-and-bass in this sparse groove (measured): its drums at three quarters. */
const drumsOf = (f: Flavour, scale = 1): string => num(Math.round(KITS[f].drumsGain * scale * 100) / 100);
const neoSoul = (f: Flavour): string =>
  semiLayers(f, {
    drums: `stack(s("bd ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~").gain(${drumsOf(f, f === "flavour.pop" ? 0.75 : 1)}), s("~ sd ~ sd").late(1/128).gain(${drumsOf(f, f === "flavour.pop" ? 0.75 : 1)}), s("hh*16").velocity("[1 .7 .86 .7]*4").swingBy(1/5, 8).gain(${num(KITS[f].hatsGain)}))`,
    bass: NEO_BASS,
    chords: NEO_CHORDS,
    chordsTail: ".late(1/128)",
    chordsSound: f === "flavour.indie" ? "cleangtr" : f === "flavour.pop" ? "piano" : "rhodes",
    chordsLift: 0.9,
  });

// --- the rhythm track ---------------------------------------------------------------------------------------

/** Sixteenth funk (R1.L03, RC1): ghost notes on the snare at .35, the clav or guitar muted short on the off-16ths. */
const FUNK_KICK = "bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FUNK_SNARE = "~ ~ ~ ~ sd ~ ~ sd ~ sd ~ ~ sd ~ ~ sd";
const FUNK_SNARE_VELOCITY = '"1 1 1 1 1 1 1 .35 1 .35 1 1 1 1 1 .35"';
/**
 * Chopped short, the chords lose level: at the kit's chord gain they sat 11–17 LU under the drums (measured in
 * wave7.pw.ts). Lifted to .85 (the funk kit's clav to .64), and the pop kit's drums at .45.
 */
const FUNK_CHORD_LIFT: Record<Flavour, number> = {
  "flavour.pop": 2.125,
  "flavour.jazz-soul": 1.7,
  "flavour.indie": 2.125,
  "flavour.funk": 1.6,
};
const funk16 = (f: Flavour): string =>
  semiLayers(f, {
    drums: `stack(s("${FUNK_KICK}").gain(${drumsOf(f, f === "flavour.pop" ? 0.65 : 1)}), s("${FUNK_SNARE}").velocity(${FUNK_SNARE_VELOCITY}).gain(${drumsOf(f, f === "flavour.pop" ? 0.65 : 1)}), s("hh*16").velocity("[1 .7 .86 .7]*4").gain(${num(KITS[f].hatsGain)}))`,
    bass: '"<[-24 ~ ~ -12 ~ ~ -24 ~ ~ ~ -14 ~ -24 ~ -17 ~] [-19 ~ ~ -7 ~ ~ -19 ~ ~ ~ -9 ~ -19 ~ -12 ~]>"',
    chords: '"<[-8,-2,2] [-3,3,7]>"',
    // Muted: each chop a third of its sixteenth long (the "muted guitar" of the brief is the chord sound held short).
    chordsTail: '.struct("~ x ~ x x ~ x ~ ~ x ~ x x ~ x ~").clip(.3).velocity("[.86 1]*8")',
    chordsSound:
      f === "flavour.indie"
        ? "cleangtr"
        : f === "flavour.pop"
          ? "clav"
          : f === "flavour.jazz-soul"
            ? "rhodes"
            : "clav",
    chordsLift: FUNK_CHORD_LIFT[f],
  });

/**
 * Son montuno (R3.L02–L05, RC2), I–V7 over two bars on the 8th grid: the conga's tumbao on the toms (a slap on 2,
 * the open tones on 4 and its "and"), the bongo bell on the beat, the bass's tumbao (the "and" of 2 and beat 4,
 * which anticipates the next chord's root) and a montuno that faces 3-2. No clave of its own: the R3 lessons ask
 * the learner for it (band.son-clave plays one, for the steps that grade another part).
 */
const SON_PERC = (f: Flavour) =>
  `stack(s("~ ~ mt ~ ~ ~ lt lt").velocity("[.7 1]*4").gain(${num(KITS[f].drumsGain * 0.8)}), s("cb*4").velocity("1 .8 .9 .8").gain(${num(KITS[f].hatsGain * 0.7)}))`;
const SON_BASS = '"<[~ ~ ~ -17 ~ ~ -17 ~] [~ ~ ~ -22 ~ ~ -24 ~]>"';
const SON_MONTUNO =
  '"<[[-5,0,4] ~ [-5,0,4] ~ ~ [-5,0,4] ~ [-1,2,5]] [~ [-1,2,5] ~ [-1,2,5] ~ [-1,2,5] ~ [-5,0,4]]>"';
const sonMontuno = (f: Flavour, clave: boolean): string =>
  semiLayers(f, {
    drums: clave
      ? `stack(${SON_PERC(f).slice("stack(".length, -1)}, s("${claveMini("son", "3-2", "rim")}").gain(${num(KITS[f].drumsGain)}))`
      : SON_PERC(f),
    bass: SON_BASS,
    chords: SON_MONTUNO,
    chordsSound: f === "flavour.indie" ? "cleangtr" : "piano",
    // The clean guitar's montuno sat 9.3 LU under the LinnDrum percussion (measured): lifted.
    chordsLift: f === "flavour.indie" ? 1.4 : 1,
  });

/** 5/4 grouped 3+2 (R2.L01): the kick on the three's start, the snare on the two's, ten eighths of hats. I | IV. */
const odd54 = (f: Flavour): string =>
  semiLayers(f, {
    drums: `stack(s("bd ~ ~ ~ ~ ~ sd ~ ~ ~").gain(${drumsOf(f, f === "flavour.pop" ? 0.8 : 1)}), s("hh*10").velocity("1 .7 .8 .7 .8 .7 1 .7 .8 .7").gain(${num(KITS[f].hatsGain)}))`,
    bass: '"<[-24 ~ ~ ~ ~ ~ -17 ~ ~ ~] [-19 ~ ~ ~ ~ ~ -24 ~ ~ ~]>"',
    chords: '"<[[-8,-5,0] ~ ~ ~ ~ ~ [-8,-5,0] ~ ~ ~] [[-7,-3,0] ~ ~ ~ ~ ~ [-7,-3,0] ~ ~ ~]>"',
  });
/** 7/8 grouped 2+2+3 (R2.L02): kick, snare, kick on the three starts. i | ♭VII. */
const odd78 = (f: Flavour): string =>
  semiLayers(f, {
    drums: `stack(s("bd ~ sd ~ bd ~ ~").gain(${drumsOf(f, f === "flavour.pop" ? 0.8 : 1)}), s("hh*7").velocity("1 .7 1 .7 1 .7 .7").gain(${num(KITS[f].hatsGain)}))`,
    bass: '"<[-24 ~ ~ ~ -24 ~ -17] [-26 ~ ~ ~ -26 ~ -19]>"',
    chords: '"<[[-9,-5,0] ~ ~ ~ [-9,-5,0] ~ ~] [[-10,-7,-2] ~ ~ ~ [-10,-7,-2] ~ ~]>"',
  });
/** 9/8 grouped 2+2+2+3 (R2.L02's 9/8i, the aksak): kick and snare alternating on the four starts. i | iv. */
const odd98 = (f: Flavour): string =>
  semiLayers(f, {
    drums: `stack(s("bd ~ sd ~ bd ~ sd ~ ~").gain(${drumsOf(f, f === "flavour.pop" ? 0.8 : 1)}), s("hh*9").velocity("1 .7 1 .7 1 .7 1 .7 .7").gain(${num(KITS[f].hatsGain)}))`,
    bass: '"<[-24 ~ ~ ~ -24 ~ ~ ~ -17] [-19 ~ ~ ~ -19 ~ ~ ~ -24]>"',
    chords: '"<[[-9,-5,0] ~ ~ ~ [-9,-5,0] ~ ~ ~ ~] [[-7,-4,0] ~ ~ ~ [-7,-4,0] ~ ~ ~ ~]>"',
  });

export const WAVE7_BANDS: readonly Wave7Band[] = [
  {
    id: "band.swing-two-five",
    title: "Swing ii–V–I (ride, walk, rootless comping)",
    bars: 4,
    meter: "4/4",
    changes: SWING_TWO_FIVE,
    usedBy: ["J1.L01", "J1.L03", "J1.L05", "J2.L01", "J2.L02", "JC1"],
    learnerParts: ["melody", "chords", "bass"],
    swing: { subdivision: 8, amount: 1 / 3 },
    code: swingBand(SWING_TWO_FIVE),
  },
  {
    id: "band.jazz-blues",
    title: "Jazz blues (12 bars)",
    bars: 12,
    meter: "4/4",
    changes: jazzBlues("C"),
    usedBy: ["J4.L02", "J.CP2", "JC2"],
    learnerParts: ["melody", "bass"],
    swing: { subdivision: 8, amount: 1 / 3 },
    code: swingBand(jazzBlues("C")),
  },
  {
    id: "band.rhythm-changes",
    title: "Rhythm changes (32 bars, AABA)",
    bars: 32,
    meter: "4/4",
    changes: rhythmChanges("C").bars,
    usedBy: ["J4.L03", "J.CP2", "JC3"],
    learnerParts: ["melody"],
    swing: { subdivision: 8, amount: 1 / 3 },
    code: swingBand(rhythmChanges("C").bars),
  },
  {
    id: "band.neo-soul",
    title: "Neo-soul, laid back (two bars)",
    bars: 2,
    meter: "4/4",
    changes: [
      ["F^9", "Em7"],
      ["Dm9", "G13"],
    ],
    usedBy: ["A2.L02", "A2.L05", "AC2"],
    learnerParts: ["chords", "melody"],
    swing: { subdivision: 16, amount: 1 / 5 },
    late: LAID_BACK,
    code: eachFlavour(neoSoul),
  },
  {
    id: "band.funk-16",
    title: "Sixteenth-note funk (two bars)",
    bars: 2,
    meter: "4/4",
    changes: [["C9"], ["F9"]],
    usedBy: ["R1.L03", "R1.L04", "RC1"],
    learnerParts: ["drums", "bass", "stabs"],
    code: eachFlavour(funk16),
  },
  {
    id: "band.son-montuno",
    title: "Son montuno, no clave (two bars)",
    bars: 2,
    meter: "4/4",
    changes: [["C"], ["G7"]],
    usedBy: ["R3.L02", "R3.L03", "R3.L05", "RC2"],
    learnerParts: ["clave", "bass", "chords"],
    code: eachFlavour((f) => sonMontuno(f, false)),
  },
  {
    id: "band.son-clave",
    title: "Son montuno with a 3-2 son clave (two bars)",
    bars: 2,
    meter: "4/4",
    changes: [["C"], ["G7"]],
    usedBy: ["R3.L04", "RC2"],
    learnerParts: ["bass", "chords"],
    code: eachFlavour((f) => sonMontuno(f, true)),
  },
  {
    id: "band.odd-5-4",
    title: "5/4 (3+2)",
    bars: 2,
    meter: "5/4",
    changes: [["C"], ["F"]],
    usedBy: ["R2.L01"],
    learnerParts: ["drums", "melody"],
    code: eachFlavour(odd54),
  },
  {
    id: "band.odd-7-8",
    title: "7/8 (2+2+3)",
    bars: 2,
    meter: "7/8",
    changes: [["Cm"], ["Bb"]],
    usedBy: ["R2.L02"],
    learnerParts: ["drums", "melody"],
    code: eachFlavour(odd78),
  },
  {
    id: "band.odd-9-8",
    title: "9/8 (2+2+2+3)",
    bars: 2,
    meter: "9/8i",
    changes: [["Cm"], ["Fm"]],
    usedBy: ["R2.L02"],
    learnerParts: ["drums", "melody"],
    code: eachFlavour(odd98),
  },
];
