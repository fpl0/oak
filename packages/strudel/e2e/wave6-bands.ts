// The Wave 6 Bands as the sound engineer proposes them (contracts §5.10): a 6/8 and a 12/8 Band, a funk vamp
// with pushes and ghost notes, four modal vamps, and two loops for the chromatic units, each in all four flavours.
// Band code is content (content/bands, author:CP's path); this file holds the code as written and measured by
// the sound work, so that the checks in wave6-bands.test.ts (headless) and wave6.pw.ts (the mix, in the browser)
// run on it today and move with it into content/bands unchanged. The form is that of content/bands/index.ts:
// labelled tracks drums: bass: chords: only, `{{key}}` for the key, degrees below the tonic, the flavour's own
// kit, sounds and production numbers (content/flavours.ts).
//
// Three things differ from the earlier Bands, on purpose:
//   - Drums are a `stack(...)` with a gain on each element. `.gain()` on a whole line sets the level of every
//     element (it does not multiply), which is what made the indie Bands clip in Wave 5 (LinnDrum's hats are
//     peak-normalised like its kick).
//   - Ghost notes (`band.funk-push`) are `.velocity()` values of .35: quieter than the ±0.08 humanised hits on
//     purpose (STYLE §11 rule 5).
//   - A modal Band is written in the degrees of its own mode: it plays under a key of that mode only
//     (`{{key}}` = "G4:mixolydian"), as the Aeolian loop plays under a minor key.
import type { MeterId } from "@oak/content-kit";
import { flavourById } from "../../../content/flavours.ts";

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
  /** Kick and snare, and the hats or ride: a level each (see the header). */
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
const KITS: Record<Flavour, Kit> = {
  // Drums .7 → .55 (sound pack v4): the 6/8 and 12/8 Bands peaked at +0.7 dBFS (wave6.pw.ts).
  "flavour.pop": {
    bank: "",
    bass: "ebass",
    chords: "piano",
    drumsGain: 0.55,
    hatsGain: 0.5,
    bassGain: 0.9,
    chordsGain: 0.4,
  },
  "flavour.jazz-soul": {
    bank: "jazzkit",
    bass: "upright",
    chords: "rhodes",
    drumsGain: 0.65,
    hatsGain: 0.55,
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
  // the clav .4 → .5, so the funk push and the Phrygian figure sit within 10 LU (wave6.pw.ts).
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
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");

interface Parts {
  /** Kick and snare mini-notation (comma-separated layers allowed). */
  kit: string;
  /** Per-step velocities of the kick-and-snare layer when it carries ghost notes (one value a step). */
  kitVelocity?: string;
  /** Hats or ride mini-notation, and their accents. */
  hats: string;
  hatsVelocity: string;
  /** Bass and chord degree patterns (quoted), below the tonic. */
  bass: string;
  chords: string;
  /** The chords' rhythm; "" lets each chord ring for its own length. */
  struct: string;
  chordsVelocity: string;
  /**
   * Half steps added to the bass after `.scale()` (a quoted pattern): how a lowered root is written two octaves
   * under the tonic, where `n("-9b")` is the lint error `code.chromatic-step` (a step of 7 or more with an accidental).
   */
  bassAdd?: string;
  /** `.early(1/8)` and the like, on bass and chords (STYLE §2: time after pitch and structure). */
  bassTime?: string;
  chordsTime?: string;
  /** A chord sound other than the flavour's (the Lydian pad). */
  chordsSound?: string;
  chordsGain?: number;
}

/** One flavour's code: three labelled tracks with the kit's sounds and production numbers. */
function layers(f: Flavour, p: Parts): string {
  const k = KITS[f];
  const prod = flavourById.get(f)?.production;
  if (!prod) throw new Error(`no flavour kit ${f}`);
  const bank = k.bank ? `.bank("${k.bank}")` : "";
  const kitVel = p.kitVelocity ? `.velocity(${p.kitVelocity})` : "";
  const struct = p.struct ? `.struct("${p.struct}")` : "";
  return [
    `drums: stack(s("${p.kit}")${kitVel}.gain(${num(k.drumsGain)}), s("${p.hats}").velocity(${p.hatsVelocity}).gain(${num(k.hatsGain)}))${bank}${k.drumsFx ?? ""}`,
    `bass: n(${p.bass}).scale("{{key}}")${p.bassAdd ? `.add(note(${p.bassAdd}))` : ""}${p.bassTime ?? ""}.s("${k.bass}").lpf(${prod.bassLpf}).gain(${num(k.bassGain)})`,
    `chords: n(${p.chords}).scale("{{key}}")${struct}${p.chordsTime ?? ""}.s("${p.chordsSound ?? k.chords}").velocity(${p.chordsVelocity}).gain(${num(p.chordsGain ?? k.chordsGain)}).pan(${num(prod.pan.chords ?? 0.42)}).room(${num(prod.room)})`,
  ].join("\n");
}

// Accents (one value per step of the pattern on the left, STYLE §11 rule 7), all within ±0.08 of 0.92.
const THREES_2 = '"[1 .86 .9]*2"';
const THREES_4 = '"[1 .86 .9]*4"';
const SIXTEENTHS_OF_SIX = '"[1 .86 .94 .86 .9 .86]*2"';
const HUMAN_8THS = '"[1 .86 .94 .86]*2"';
const HUMAN_16THS = '"[1 .86 .94 .86]*4"';
const PUMP_4 = '"1 .86 .92 .86"';
const PUSH = '"1 .86"';
const THREE_HITS = '"1 .86 .9"';
const HELD = '"<1 .9>"';

// Chords, voiced close under the tonic as content/bands voices them (each change moves a voice a step at most).
const [I3, IV3, V3, VI3] = ["[-7,-5,-3]", "[-7,-4,-2]", "[-8,-6,-3]", "[-7,-5,-2]"];
const [I6, IV6, V7, VI7] = ["[-7,-5,-3,-2]", "[-7,-6,-4,-2]", "[-8,-6,-4,-3]", "[-9,-7,-5,-3]"];
const four = (f: Flavour): boolean => f === "flavour.jazz-soul" || f === "flavour.funk";

/** 6/8, I–vi–IV–V: a soul ballad, two beats of three a bar. No swing (contracts §6.10: not in compound meters). */
const compound68 = (f: Flavour): string => {
  const chords = four(f) ? `"<${I6} ${VI7} ${IV6} ${V7}>"` : `"<${I3} ${VI3} ${IV3} ${V3}>"`;
  switch (f) {
    case "flavour.pop":
      return layers(f, {
        kit: "bd ~ ~ sd ~ ~",
        hats: "hh*6",
        hatsVelocity: THREES_2,
        bass: '"<[-14 -14] [-9 -9] [-11 -11] [-10 -10]>"',
        chords,
        struct: "x*6",
        chordsVelocity: THREES_2,
      });
    case "flavour.jazz-soul":
      return layers(f, {
        kit: "bd ~ ~ sd ~ ~",
        hats: "rd*6",
        hatsVelocity: THREES_2,
        // Root on beat 1, the 5th on beat 2 (under V the 5th below, so the bass stays under G7's B).
        bass: '"<[-14 -10] [-9 -12] [-11 -7] [-10 -13]>"',
        chords,
        struct: "x ~ ~ x ~ x",
        chordsVelocity: THREE_HITS,
      });
    case "flavour.indie":
      return layers(f, {
        kit: "bd ~ ~ sd ~ ~",
        hats: "hh*6",
        hatsVelocity: THREES_2,
        bass: '"<[-14*6] [-9*6] [-11*6] [-10*6]>"',
        chords,
        struct: "x*6",
        chordsVelocity: THREES_2,
      });
    case "flavour.funk":
      return layers(f, {
        kit: "bd ~ ~ sd ~ bd",
        hats: "hh*12",
        hatsVelocity: SIXTEENTHS_OF_SIX,
        bass: '"<[-14 ~ ~ -14 ~ -10] [-9 ~ ~ -9 ~ -12] [-11 ~ ~ -11 ~ -7] [-10 ~ ~ -10 ~ -13]>"',
        chords,
        struct: "~ x x ~ x x",
        chordsVelocity: THREES_2,
      });
  }
};

/** 12/8, I–IV–I–V: a slow gospel-blues ballad, four beats of three a bar. */
const compound128 = (f: Flavour): string => {
  const chords = four(f) ? `"<${I6} ${IV6} ${I6} ${V7}>"` : `"<${I3} ${IV3} ${I3} ${V3}>"`;
  const kit = "bd ~ ~ sd ~ ~ bd ~ ~ sd ~ ~";
  switch (f) {
    case "flavour.pop":
      return layers(f, {
        kit,
        hats: "hh*12",
        hatsVelocity: THREES_4,
        bass: '"<[-14*4] [-11*4] [-14*4] [-10*4]>"',
        chords,
        struct: "x*12",
        chordsVelocity: THREES_4,
      });
    case "flavour.jazz-soul":
      return layers(f, {
        kit,
        hats: "rd*12",
        hatsVelocity: THREES_4,
        // A walking bass on the beat: root, 3rd, 5th, 3rd (under V it turns below the root).
        bass: '"<[-14 -12 -10 -12] [-11 -9 -7 -9] [-14 -12 -10 -12] [-10 -12 -13 -12]>"',
        chords,
        struct: "[x ~ ~] [x ~ x] [x ~ ~] [x ~ x]",
        chordsVelocity: THREES_4,
      });
    case "flavour.indie":
      return layers(f, {
        kit,
        hats: "hh*12",
        hatsVelocity: THREES_4,
        bass: '"<[-14*4] [-11*4] [-14*4] [-10*4]>"',
        chords,
        struct: "x*12",
        chordsVelocity: THREES_4,
      });
    case "flavour.funk":
      return layers(f, {
        kit: "bd ~ ~ sd ~ bd bd ~ ~ sd ~ ~",
        hats: "hh*12",
        hatsVelocity: THREES_4,
        bass: '"<[-14 ~ ~ -14 ~ -10 -14 ~ ~ ~ ~ ~] [-11 ~ ~ -11 ~ -7 -11 ~ ~ ~ ~ ~] [-14 ~ ~ -14 ~ -10 -14 ~ ~ ~ ~ ~] [-10 ~ ~ -10 ~ -13 -10 ~ ~ ~ ~ ~]>"',
        chords,
        struct: "[~ x x]*4",
        chordsVelocity: THREES_4,
      });
  }
};

/**
 * A funk vamp with pushes, ii–V a bar each (Dm7–G7 in C): the kick on 1, the "and" of 2 and the "and" of 4, the
 * bass on the same hits with the next chord's root on the "and" of 4; the chords strike a half bar apart, an
 * eighth early (`.early(1/8)`: the "and" of 4 and the "and" of 2); the snare is loud on 2 and 4 with three ghost
 * notes at .35. Straight in every flavour: a pushed eighth and a swung ride would sit a triplet apart.
 */
const SNARE_GHOSTS = "~ ~ ~ ~ sd ~ ~ sd ~ sd ~ ~ sd ~ ~ sd";
const GHOST_VELOCITY = '"1 1 1 1 1 1 1 .35 1 .35 1 1 1 1 1 .35"';
const funkPush = (f: Flavour): string => {
  const chords = four(f) ? '"<[-7,-6,-4,-2] [-8,-6,-4,-3]>"' : '"<[-6,-4,-2] [-8,-6,-3]>"';
  const p: Parts = {
    kit: `bd ~ ~ bd ~ ~ ~ bd, ${SNARE_GHOSTS}`,
    kitVelocity: GHOST_VELOCITY,
    hats: f === "flavour.jazz-soul" ? "rd*8" : "hh*16",
    hatsVelocity: f === "flavour.jazz-soul" ? HUMAN_8THS : HUMAN_16THS,
    bass: '"<[-13 ~ ~ -13 ~ ~ ~ -10] [-10 ~ ~ -10 ~ ~ ~ -13]>"',
    chords,
    struct: "x ~ x ~",
    chordsTime: ".early(1/8)",
    chordsVelocity: PUSH,
  };
  return layers(f, p);
};

/** The grooves of the 4/4 Bands below, per kit. */
const groove4 = (f: Flavour): Pick<Parts, "kit" | "hats" | "hatsVelocity"> => {
  switch (f) {
    case "flavour.pop":
      return { kit: "bd sd [~ bd] sd", hats: "hh*8", hatsVelocity: HUMAN_8THS };
    case "flavour.jazz-soul":
      return { kit: "bd ~ sd [~ bd]", hats: "rd*8", hatsVelocity: HUMAN_8THS };
    case "flavour.indie":
      return { kit: "bd ~ sd ~", hats: "hh*8", hatsVelocity: HUMAN_8THS };
    case "flavour.funk":
      return { kit: "bd ~ sd ~", hats: "hh*16", hatsVelocity: HUMAN_16THS };
  }
};
const comp4 = (f: Flavour): Pick<Parts, "struct" | "chordsVelocity"> =>
  f === "flavour.jazz-soul"
    ? { struct: "x ~ ~ [~ x]", chordsVelocity: PUSH }
    : f === "flavour.funk"
      ? { struct: "~ x ~ [~ x]", chordsVelocity: PUSH }
      : { struct: "x x x x", chordsVelocity: PUMP_4 };

/**
 * Mixolydian rock, I–♭VII–IV–I (G F C G in G): the ♭VII chord carries the mode's colour note in its root. With
 * four notes: I7 (the mode's own dominant seventh on home), ♭VIImaj7, IVmaj7.
 */
const mixolydian = (f: Flavour): string =>
  layers(f, {
    ...groove4(f),
    ...comp4(f),
    // ♭VII is taken above the tonic: below it the root would fall to F1 in G.
    bass:
      f === "flavour.funk"
        ? '"<[-14 ~ -14 -10] [-8 ~ -8 -11] [-11 ~ -11 -7] [-14 ~ -14 -10]>"'
        : f === "flavour.jazz-soul"
          ? '"<[-14 -10] [-8 -11] [-11 -7] [-14 -10]>"'
          : '"<[-14*8] [-8*8] [-11*8] [-14*8]>"',
    chords: four(f)
      ? '"<[-7,-5,-3,-1] [-8,-6,-4,-2] [-7,-5,-4,-2] [-7,-5,-3,-1]>"'
      : '"<[-7,-5,-3] [-8,-6,-4] [-7,-4,-2] [-7,-5,-3]>"',
  });

/** Dorian soul, i–IV (Dm7–G7 in D Dorian): the major IV chord carries the raised 6th. */
const dorian = (f: Flavour): string =>
  layers(f, {
    ...groove4(f),
    ...comp4(f),
    bass:
      f === "flavour.pop" || f === "flavour.indie"
        ? '"<[-14 ~ -14 ~] [-11 ~ -11 ~]>"'
        : '"<[-14 ~ -14 -10] [-11 ~ -11 -7]>"',
    chords: four(f) ? '"<[-7,-5,-3,-1] [-7,-5,-4,-2]>"' : '"<[-7,-5,-3] [-7,-4,-2]>"',
  });

/**
 * A Lydian pad, I–II over the tonic held in the bass (F and G over F in F Lydian): the II chord carries the
 * raised 4th. The chords are on `pad` in every flavour, a bar each, with the flavour's bass and a quiet kit.
 */
const lydian = (f: Flavour): string =>
  layers(f, {
    kit: "bd ~ ~ ~ ~ ~ bd ~",
    hats: f === "flavour.jazz-soul" ? "rd*4" : "hh*8",
    hatsVelocity: f === "flavour.jazz-soul" ? PUMP_4 : HUMAN_8THS,
    bass: '"<-14 -14>"',
    chords: '"<[-7,-5,-3] [-6,-4,-2]>"',
    struct: "",
    chordsVelocity: HELD,
    chordsSound: "pad",
    chordsGain: 0.35,
  });

/**
 * A Phrygian figure, i–♭II in three-three-two (Em and F in E Phrygian): the ♭II chord carries the lowered 2nd.
 * The snare is half-time, on beat 3 only: a backbeat on 4 lands with the figure's third kick and the two summed
 * past full scale in pop and indie (measured, wave6.pw.ts). The chords move in parallel, every voice up a half or
 * a whole step into ♭II, from the inversion just under the tonic (root position an octave down left the Rhodes and
 * the clav 12 LU under the kit).
 */
const phrygian = (f: Flavour): string =>
  layers(f, {
    kit: "bd ~ ~ bd ~ ~ bd ~, ~ ~ ~ ~ sd ~ ~ ~",
    hats: f === "flavour.jazz-soul" ? "rd*8" : f === "flavour.funk" ? "hh*16" : "hh*8",
    hatsVelocity: f === "flavour.funk" ? HUMAN_16THS : HUMAN_8THS,
    bass: '"<[-14 ~ ~ -14 ~ ~ -14 ~] [-13 ~ ~ -13 ~ ~ -13 ~]>"',
    chords: '"<[-5,-3,0] [-4,-2,1]>"',
    struct: "x ~ ~ x ~ ~ x ~",
    chordsVelocity: THREE_HITS,
    // Three short Rhodes stabs a bar against the ride's eight: a step louder than the kit's default .5.
    ...(f === "flavour.jazz-soul" ? { chordsGain: 0.6 } : {}),
  });

/**
 * Applied dominants, I – V7/vi – vi – V7/V V7 (C E7 Am | D7 G7 in C): each outside chord is a dominant seventh
 * with its root in the bass and its raised note (♯5, then ♯4) moving up a half step into the next chord.
 */
const applied = (f: Flavour): string =>
  layers(f, {
    ...groove4(f),
    // The last bar holds two chords: the comping strikes once in each half, so both dominants are heard.
    ...(f === "flavour.jazz-soul"
      ? { struct: "x ~ [~ x] ~", chordsVelocity: PUSH }
      : f === "flavour.funk"
        ? { struct: "~ x [~ x] ~", chordsVelocity: PUSH }
        : comp4(f)),
    bass:
      f === "flavour.funk"
        ? '"<[-14 ~ -14 -10] [-12 ~ -12 -8] [-9 ~ -9 -12] [-13 ~ -10 ~]>"'
        : f === "flavour.jazz-soul"
          ? '"<[-14 -10] [-12 -8] [-9 -12] [-13 -10]>"'
          : '"<-14 -12 -9 [-13 -10]>"',
    chords: four(f)
      ? `"<${I6} [-6,-5,-3#,-1] ${VI7} [[-7,-6,-4#,-2] ${V7}]>"`
      : `"<${I3} [-6,-5,-3#,-1] ${VI3} [[-7,-6,-4#,-2] ${V7}]>"`,
  });

/**
 * Borrowed chords, I – iv – ♭VI – ♭VII (C Fm A♭ B♭ in C): the sad iv, then the ♭VI–♭VII run that climbs back to
 * I when the loop turns. Roots in the bass; with four notes: iv6, ♭VImaj7, ♭VII7. The lowered roots of ♭VI and
 * ♭VII are the key's 6 and 7 a half step down (`.add(note(-1))` on those notes; see `Parts.bassAdd`).
 */
const borrowed = (f: Flavour): string =>
  layers(f, {
    ...groove4(f),
    ...comp4(f),
    // ♭VI moves on to its 3rd (the tonic), ♭VII to its 5th below: both are the key's own notes.
    bass:
      f === "flavour.funk"
        ? '"<[-14 ~ -14 -10] [-11 ~ -11 -7] [-9 ~ -9 -7] [-8 ~ -8 -11]>"'
        : f === "flavour.jazz-soul"
          ? '"<[-14 -10] [-11 -7] [-9 -7] [-8 -11]>"'
          : '"<-14 -11 -9 -8>"',
    bassAdd:
      f === "flavour.funk"
        ? '"<0 0 [-1 -1 -1 0] [-1 -1 -1 0]>"'
        : f === "flavour.jazz-soul"
          ? '"<0 0 [-1 0] [-1 0]>"'
          : '"<0 0 -1 -1>"',
    chords: four(f)
      ? `"<${I6} [-7,-6,-4,-2b] [-7,-5b,-3,-2b] [-6,-4,-2b,-1b]>"`
      : `"<${I3} [-7,-4,-2b] [-7,-5b,-2b] [-6,-4,-1b]>"`,
  });

export interface Wave6Band {
  id: string;
  title: string;
  bars: number;
  meter: MeterId;
  /** The mode the step's key must have (`{{key}}` = `<tonic>4:<mode>`). */
  mode: "major" | "mixolydian" | "dorian" | "lydian" | "phrygian";
  /** The harmony in C (or on C in the mode), one entry per chord in order. */
  changes: readonly string[];
  /** What the Band is for, for author:CP and the liner notes. */
  what: string;
  code: Record<Flavour, string>;
}
const each = (code: (f: Flavour) => string): Record<Flavour, string> =>
  Object.fromEntries(FLAVOURS.map((f) => [f, code(f)])) as Record<Flavour, string>;

export const WAVE6_BANDS: readonly Wave6Band[] = [
  {
    id: "band.compound-6-8",
    title: "6/8 ballad (I–vi–IV–V)",
    bars: 4,
    meter: "6/8",
    mode: "major",
    changes: ["C", "Am", "F", "G"],
    what: "U13.L04 on, U13.CP and the rhythm track: two beats of three a bar; tempo line setcpm(bpm/2).",
    code: each(compound68),
  },
  {
    id: "band.compound-12-8",
    title: "12/8 ballad (I–IV–I–V)",
    bars: 4,
    meter: "12/8",
    mode: "major",
    changes: ["C", "F", "C", "G"],
    what: "U13.L04 on: four beats of three a bar; tempo line setcpm(bpm/4), BPM counting the dotted quarter.",
    code: each(compound128),
  },
  {
    id: "band.funk-push",
    title: "Funk vamp with pushes (ii–V)",
    bars: 2,
    meter: "4/4",
    mode: "major",
    changes: ["Dm", "G"],
    what: "U13.L01–L02 on: chords an eighth early, the bass locked to the kick, ghost notes on the snare.",
    code: each(funkPush),
  },
  {
    id: "band.mixolydian-rock",
    title: "Mixolydian rock (I–♭VII–IV–I)",
    bars: 4,
    meter: "4/4",
    mode: "mixolydian",
    changes: ["C", "Bb", "F", "C"],
    what: "U14.L01–L02, U14.CP, C6: the ♭VII chord states the mode.",
    code: each(mixolydian),
  },
  {
    id: "band.dorian-soul",
    title: "Dorian soul (i–IV)",
    bars: 2,
    meter: "4/4",
    mode: "dorian",
    changes: ["Cm", "F"],
    what: "U14.L03, C6: the major IV chord states the mode.",
    code: each(dorian),
  },
  {
    id: "band.lydian-pad",
    title: "Lydian pad (I–II over the tonic)",
    bars: 2,
    meter: "4/4",
    mode: "lydian",
    changes: ["C", "D"],
    what: "U14.L04: the II chord over a held tonic states the mode.",
    code: each(lydian),
  },
  {
    id: "band.phrygian-figure",
    title: "Phrygian figure (i–♭II, three-three-two)",
    bars: 2,
    meter: "4/4",
    mode: "phrygian",
    changes: ["Cm", "Db"],
    what: "U14.L05: the ♭II chord states the mode.",
    code: each(phrygian),
  },
  {
    id: "band.applied-4bar",
    title: "Applied dominants (I–V7/vi–vi–V7/V–V7)",
    bars: 4,
    meter: "4/4",
    mode: "major",
    changes: ["C", "E7", "Am", "D7", "G7"],
    what: "U15.L02–L06, U17.CP: each applied dominant resolves to its target in the next chord.",
    code: each(applied),
  },
  {
    id: "band.borrowed-4bar",
    title: "Borrowed chords (I–iv–♭VI–♭VII)",
    bars: 4,
    meter: "4/4",
    mode: "major",
    changes: ["C", "Fm", "Ab", "Bb"],
    what: "U16.L01–L05, C7: the sad iv, then ♭VI–♭VII climbing home.",
    code: each(borrowed),
  },
];
export const wave6BandById: ReadonlyMap<string, Wave6Band> = new Map(WAVE6_BANDS.map((b) => [b.id, b]));
