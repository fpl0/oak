// Song 1, "Count me in" (docs/design/songs/makes-core-a.md §8, U01; AUTHORING §23 points here as the worked
// example). C major, 4/4, 100 BPM, straight in every flavour (U01 is drums the learner writes: contracts §5.10 keeps
// jazz-soul and funk straight and in triads until U03 and U06). Oak plays the whole song from the first listen; each
// U01 Make takes over the drums of one or two sections, so by the unit's end every kick, snare and hat is the
// learner's and Oak plays the bass, the chords, the tune and a few cymbals around them.
//
// The form, 37 bars (88.8 s at 100 BPM):
//
//   intro 4 · verse 8 · stop 1 · chorus 8 · bridge 4 · chorus 8 · outro 4
//   C F C G   (C F)×4   G      (C G Am F)×2  Am F G G  (C G Am F)×2  C F G C
//
// - The opening vamps under whole-note chords, no tune: the tune's entrance in the verse is an event.
// - The verse is a I–IV vamp with a low tune (C4–C5) that answers itself every two bars.
// - The stop is one bar: the band hits V on beat 1 and goes quiet, the snare picks up into the chorus.
// - The chorus is the hook, high (F4–E5): a falling three-note cell, E D C, D C B, C B A, sung over I V vi IV.
//   Chords and bass move to eighths, the snare doubles with a clap, the hats open, a crash every four bars.
// - The bridge drops to half-time over vi IV V V: kick on 1, snare on 3, a ride (pop), a tambourine (indie) or a
//   shaker (funk, electronic) in place of the hats (jazz-soul keeps its ride), long tune notes, and a snare roll into
//   the last chorus.
// - The ending plays the hook's cell over I IV V and stops on one held C.
//
// Clashes (AUTHORING §13, spec §5.1), read from the evaluated events and `bun run theory read`/`interval`: every tune
// note held a beat or more is a chord tone, except verse bar 8's D4 over F (a major sixth above F3, F's added
// colour); every bass note is a root, fifth or octave. So nothing held sits a half step from a chord tone in any
// flavour. The passing notes (D5 over C, C5 over G, B4 over Am, G4 over F) last an eighth and step to a chord tone.
// Chords are close root-position triads, D3–C4, each voice moving a third at most: C (E3 G3 C4), F (F3 A3 C4),
// G (D3 G3 B3), Am (E3 A3 C4). The bass plays its roots on C2–A2 under them; fifths and octave pops reach A3. The
// tune sits on top, C4–E5.
//
// One builder writes all five flavours (AUTHORING §23.2), so the roots, the bass downbeats and the tune cannot drift.
// A flavour changes only the kit, the grooves inside a section (kick, hats, comp and bass rhythm) and production.
// Gains stay at or under the Bands' kit gains (content/bands/index.ts KITS: drums .7, bass .9, chords .4/.45).
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const SECTIONS: UnitSongSection[] = [
  { id: "intro", type: "intro", bars: 4 },
  { id: "verse", type: "verse", bars: 8 },
  { id: "stop", type: "break", bars: 1 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "bridge", type: "bridge", bars: 4 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
];
type Kind = "intro" | "verse" | "break" | "chorus" | "bridge" | "outro";
const BARS: Record<Kind, number> = { intro: 4, verse: 8, break: 1, chorus: 8, bridge: 4, outro: 4 };

// --- the music every flavour shares ----------------------------------------------------------------------------

/** A chord: its root as a degree of C major (bass, on C2) and its close voicing (chords, degrees on C3). */
interface Chord {
  root: number;
  voicing: string;
}
const C: Chord = { root: 0, voicing: "[2,4,7]" }; // E3 G3 C4
const F: Chord = { root: 3, voicing: "[3,5,7]" }; // F3 A3 C4
const G: Chord = { root: 4, voicing: "[1,4,6]" }; // D3 G3 B3
const Am: Chord = { root: 5, voicing: "[2,5,7]" }; // E3 A3 C4

/** One chord a bar, per section kind (a list shorter than the section repeats). */
const HARMONY: Record<Kind, Chord[]> = {
  intro: [C, F, C, G],
  verse: [C, F],
  break: [G],
  chorus: [C, G, Am, F],
  bridge: [Am, F, G, G],
  outro: [C, F, G, C],
};
const chordsOf = (k: Kind): Chord[] =>
  Array.from({ length: BARS[k] }, (_, i) => HARMONY[k][i % HARMONY[k].length] as Chord);

/**
 * The tune, one bar per entry, degrees on C4 (0 = C4, 7 = C5), eighths as eight weights a bar. The intro and the stop
 * have none.
 */
const HOOK = {
  onI: "[9 ~ 9 8 ~ 7@3]", // E5 . E5 D5 . C5——, over C
  onV: "[8 ~ 8 7 ~ 6@3]", // D5 . D5 C5 . B4——, over G
  onVi: "[7 ~ 7 6 ~ 5@3]", // C5 . C5 B4 . A4——, over Am
  onIV: "[5 ~ 5 4 ~ 3@3]", // A4 . A4 G4 . F4——, over F
};
const TUNE: Partial<Record<Kind, string[]>> = {
  verse: [
    "[~ ~ 0 2 4@2 2@2]", // C: . . C E G— E—
    "[5@3 3@3 ~ ~]", // F: A—— F—— .
    "[~ ~ 0 2 4@2 7@2]", // C: . . C E G— C5—
    "[5@6 ~ ~]", // F: A————— .
    "[~ ~ 0 2 4@2 2@2]",
    "[5@3 7@3 5@2]", // F: A—— C5—— A—
    "[~ ~ 4 4 2@2 0@2]", // C: . . G G E— C—
    "[3@2 1@6]", // F: F— D————— (the sixth of F, leaning to the stop on G)
  ],
  chorus: [HOOK.onI, HOOK.onV, HOOK.onVi, "[3@2 5@2 7@4]", HOOK.onI, HOOK.onV, HOOK.onVi, HOOK.onIV],
  bridge: ["[9@4 7@4]", "[5@4 7@4]", "[6@4 8@4]", "[8@6 ~ ~]"], // E5 C5 | A4 C5 | B4 D5 | D5———
  outro: [HOOK.onI, HOOK.onIV, HOOK.onV, "7"], // the hook's cell over C F G, then one C5 held to the end
};

// --- writing Strudel ------------------------------------------------------------------------------------------

/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** Whether a bar is already one `[ … ]` group from its first character to its last. */
function grouped(bar: string): boolean {
  if (!bar.startsWith("[")) return false;
  let depth = 0;
  for (let i = 0; i < bar.length; i++) {
    if (bar[i] === "[") depth++;
    else if (bar[i] === "]" && --depth === 0) return i === bar.length - 1;
  }
  return false;
}
/** A bar as one item of `< >`: a bar with several steps goes in `[ ]`. */
const item = (bar: string): string => (/[\s,]/.test(bar) && !grouped(bar) ? `[${bar}]` : bar);
/**
 * One pattern per bar of a section, written as short as Strudel reads it: the shortest cycle that repeats through
 * the section, runs of one bar as `!n`, a single bar without `< >`.
 */
function perBar(bars: readonly string[]): string {
  const n = bars.length;
  let period = n;
  for (let p = 1; p < n; p++)
    if (n % p === 0 && bars.every((b, i) => b === bars[i % p])) {
      period = p;
      break;
    }
  const one = bars.slice(0, period);
  if (one.length === 1) return one[0] as string;
  const items: string[] = [];
  for (let i = 0; i < one.length; ) {
    let j = i;
    while (j < one.length && one[j] === one[i]) j++;
    items.push(j - i > 1 ? `${item(one[i] as string)}!${j - i}` : item(one[i] as string));
    i = j;
  }
  return `<${items.join(" ")}>`;
}
/** `count` bars of `bar`, the last one replaced by `last` when given (a fill, a build, a final hit). */
const bars = (count: number, bar: string, last?: string): string[] =>
  Array.from({ length: count }, (_, i) => (last !== undefined && i === count - 1 ? last : bar));

/** One labelled track: a const per section kind it plays (`kickVerse`), `silence` where it rests, one arrange(). */
function track(label: string, bySection: Readonly<Partial<Record<Kind, string>>>, tail: string) {
  const consts: string[] = [];
  const entries = SECTIONS.map(({ bars: n, type }) => {
    const pattern = bySection[type as Kind];
    if (pattern === undefined) return `[${n}, silence]`;
    const name = `${label}${cap(type)}`;
    if (!consts.some((c) => c.startsWith(`const ${name} =`))) consts.push(`const ${name} = ${pattern}`);
    return `[${n}, ${name}]`;
  });
  return { consts, line: `${label}: arrange(${entries.join(", ")})${tail}` };
}

// --- the four kits ---------------------------------------------------------------------------------------------

/** Bar patterns per section kind: a drum line's words, a bass groove of a root, a comp rhythm. */
type DrumBars = Partial<Record<Kind, string[]>>;
/** A bass bar from its chord's root `r` (fifth `r + 4`, octave `r + 7`) and the bar's place in the section. */
type BassBar = (r: number, i: number, count: number) => string;

interface Kit {
  /** `.bank()` name, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the opening and the bridge). */
  banks?: Partial<Record<Kind, string>>;
  kick: DrumBars;
  snare: DrumBars;
  hats: DrumBars;
  perc: DrumBars;
  /** Accents per drum line and kind (a `.velocity()` pattern), when the line has one. */
  accents: Partial<Record<"kick" | "snare" | "hats" | "perc", Partial<Record<Kind, string>>>>;
  gains: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
  };
  bass: {
    sound: string;
    lpf: number;
    groove: Record<Kind, BassBar>;
    /** Another sound in some sections, and synth controls per section (electronic: acid or sub). */
    sounds?: Partial<Record<Kind, string>>;
    fx?: Partial<Record<Kind, string>>;
  };
  chords: {
    sound: string;
    pan: number;
    comp: Record<Kind, string[]>;
    accents: Partial<Record<Kind, string>>;
    /** As for the bass (electronic: sawtooth stabs, a supersaw pad). */
    sounds?: Partial<Record<Kind, string>>;
    fx?: Partial<Record<Kind, string>>;
  };
  /** `fx`: synth controls after the lead's sound (electronic: the square pluck and its echo). */
  lead: { sound: string; pan: number; fx?: string };
  room: number;
}

/** Eighth-note accents (content/bands/index.ts HUMAN_8THS): strong on the beat, lighter between. */
const EIGHTHS = "[1 .86 .94 .86]*2";
const SIXTEENTHS = "[1 .86 .94 .86]*4";
const QUARTERS = "1 .86 .92 .86";

// Grooves several kits share.
const SNARE_BACKBEAT = { verse: bars(8, "~ sd ~ sd", "~ sd ~ [sd sd]") };
/** The chorus backbeat doubled with a clap, a fill in its eighth bar. */
const SNARE_CLAP = {
  chorus: bars(8, "~ [sd,cp] ~ [sd,cp]", "~ [sd,cp] [~ sd] [sd sd]"),
  outro: ["~ [sd,cp] ~ [sd,cp]", "~ [sd,cp] ~ [sd,cp]", "~ [sd,cp] [~ sd] [sd sd]", "~"],
};
/** The snare and the clap together sound louder than the snare alone: a touch lighter, so the backbeat stays level. */
const CLAP_LEVEL = { chorus: ".85", outro: ".85" };
/** The opening's snare pickup, the stop's, and the bridge's half-time backbeat with a roll into the last chorus. */
const SNARE_EDGES = {
  intro: bars(4, "~", "~ ~ ~ [sd sd]"),
  break: ["~ ~ ~ [sd sd]"],
  bridge: bars(4, "~ ~ sd ~", "~ sd [sd sd] [sd sd sd sd]"),
};
/** Crashes mark the sections: the first bar of each, every fourth bar of a chorus, the ending's last hit. */
const CRASHES = {
  intro: ["cr", "~", "~", "~"],
  verse: ["cr", ...bars(7, "~")],
  break: ["cr ~ ~ ~"],
  chorus: ["cr", "~", "~", "~", "cr", "~", "~", "~"],
  outro: ["cr", "~", "~", "cr"],
};
const KICK_BUILD = bars(4, "bd ~ ~ ~", "bd ~ bd [bd bd]");
/** Roots held on 1 and 3 in the opening; its last bar walks into the verse in quarters. */
const HALVES: BassBar = (r, i, n) => (i === n - 1 ? `[${r}@2 ${r} ${r}]` : `[${r}@2 ${r}@2]`);
const STOP: BassBar = (r) => `[${r} ~ ~ ~]`;
const WHOLE: BassBar = (r) => `${r}`;
/** The ending: the chorus groove for three bars, then one held root. */
const ending =
  (groove: BassBar): BassBar =>
  (r, i, n) =>
    i === n - 1 ? WHOLE(r, i, n) : groove(r, i, n);
/** The bridge: held roots, then the chorus groove as a run into the last chorus. */
const bridgeInto =
  (held: BassBar, run: BassBar): BassBar =>
  (r, i, n) =>
    i === n - 1 ? run(r, i, n) : held(r, i, n);

const POP_CHORUS_BASS: BassBar = (r) => `${r}*8`;
const INDIE_CHORUS_BASS: BassBar = (r) => `[${r} ${r + 7}]*4`;
const JAZZ_CHORUS_BASS: BassBar = (r) => `[${r} ${r + 4} ${r + 7} ${r + 4}]`;
const FUNK_CHORUS_BASS: BassBar = (r) => `[${r} ~ ~ ${r} ~ ~ ${r} ~ ${r} ~ ~ ${r} ~ ${r + 7} ~ ~]`;
/** Electronic: the acid line of the chorus, on every sixteenth but two, the octave on the off-beat sixteenths. */
const ACID_CHORUS: BassBar = (r) =>
  `[${r} ${r} ${r + 7} ${r} ~ ${r} ${r + 7} ${r} ${r} ~ ${r + 7} ${r} ${r} ${r} ${r + 7} ~]`;
/** The TB-303 recipe: a resonant ladder filter whose envelope opens on an accent pattern, short notes. */
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The chorus: the same line with the envelope opened wider on the accents. */
const ACID_OPEN = '.lpq(14).ftype("ladder").lpenv("<4 2 3 6>*8").lpd(.16).lps(0).decay(.2).sustain(.4)';
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** A supersaw pad that swells after each kick (a slow attack, struck on every beat), its filter drifting. */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8))";

const KITS: Record<FlavourId, Kit> = {
  // The default kit, electric bass, piano chords and a piano tune: a pop-rock band.
  "flavour.pop": {
    bank: "",
    kick: {
      intro: bars(4, "bd ~ bd ~"),
      verse: bars(8, "bd ~ bd [~ bd]"),
      break: ["bd ~ ~ ~"],
      chorus: bars(8, "bd [~ bd] bd ~"),
      bridge: KICK_BUILD,
      outro: bars(4, "bd [~ bd] bd ~", "bd ~ ~ ~"),
    },
    snare: { ...SNARE_EDGES, ...SNARE_BACKBEAT, ...SNARE_CLAP },
    hats: {
      intro: bars(4, "hh*8"),
      verse: bars(8, "hh*8"),
      chorus: bars(8, "hh hh hh hh hh hh hh oh"),
      outro: bars(4, "hh hh hh hh hh hh hh oh", "~"),
    },
    perc: { ...CRASHES, bridge: bars(4, "rd*4") },
    accents: {
      snare: CLAP_LEVEL,
      hats: { intro: "[.8 .6]*4", verse: EIGHTHS, chorus: EIGHTHS, outro: EIGHTHS },
      perc: { bridge: QUARTERS },
    },
    gains: { kick: 0.65, snare: 0.6, hats: 0.45, perc: 0.4, bass: 0.85, chords: 0.38, lead: 0.5 },
    bass: {
      sound: "ebass",
      lpf: 800,
      groove: {
        intro: HALVES,
        verse: (r) => `[${r} ~ ${r} [~ ${r}]]`,
        break: STOP,
        chorus: POP_CHORUS_BASS,
        bridge: bridgeInto(WHOLE, POP_CHORUS_BASS),
        outro: ending(POP_CHORUS_BASS),
      },
    },
    chords: {
      sound: "piano",
      pan: 0.42,
      comp: {
        intro: bars(4, "x"),
        verse: bars(8, "x x x x"),
        break: ["x ~ ~ ~"],
        chorus: bars(8, "[x x]*4"),
        bridge: bars(4, "x@2 x@2"),
        outro: bars(4, "[x x]*4", "x"),
      },
      accents: { verse: QUARTERS, chorus: "[1 .8]*4", outro: "[1 .8]*4" },
    },
    lead: { sound: "piano", pan: 0.58 },
    room: 0.25,
  },
  // LinnDrum, electric bass, clean guitar and an acoustic lead: a 3-3-2 verse, a four-on-the-floor chorus whose hats
  // open on every "and" and whose bass jumps octaves, a tambourine in the bridge.
  "flavour.indie": {
    bank: "LinnDrum",
    kick: {
      intro: bars(4, "bd ~ ~ bd ~ ~ bd ~"),
      verse: bars(8, "bd ~ ~ bd ~ ~ bd ~"),
      break: ["bd ~ ~ ~"],
      chorus: bars(8, "bd*4"),
      bridge: KICK_BUILD,
      outro: bars(4, "bd*4", "bd ~ ~ ~"),
    },
    snare: { ...SNARE_EDGES, ...SNARE_BACKBEAT, ...SNARE_CLAP },
    hats: {
      intro: bars(4, "hh*8"),
      verse: bars(8, "hh*8"),
      chorus: bars(8, "[hh oh]*4"),
      outro: bars(4, "[hh oh]*4", "~"),
    },
    perc: { ...CRASHES, bridge: bars(4, "[~ tb]*4") },
    accents: {
      snare: CLAP_LEVEL,
      hats: { intro: "[.8 .6]*4", verse: EIGHTHS, chorus: EIGHTHS, outro: EIGHTHS },
    },
    gains: { kick: 0.65, snare: 0.6, hats: 0.45, perc: 0.4, bass: 0.85, chords: 0.38, lead: 0.5 },
    bass: {
      sound: "ebass",
      lpf: 750,
      groove: {
        intro: (r) => `[${r}@3 ${r}@3 ${r}@2]`,
        verse: (r) => `[${r}@3 ${r}@3 ${r + 4}@2]`,
        break: STOP,
        chorus: INDIE_CHORUS_BASS,
        bridge: bridgeInto(WHOLE, INDIE_CHORUS_BASS),
        outro: ending(INDIE_CHORUS_BASS),
      },
    },
    chords: {
      sound: "cleangtr",
      pan: 0.38,
      comp: {
        intro: bars(4, "x"),
        verse: bars(8, "x ~ ~ x ~ ~ x ~"),
        break: ["x ~ ~ ~"],
        chorus: bars(8, "[x x]*4"),
        bridge: bars(4, "x"),
        outro: bars(4, "[x x]*4", "x"),
      },
      accents: { chorus: "[1 .75]*4", outro: "[1 .75]*4" },
    },
    lead: { sound: "acgtr", pan: 0.62 },
    room: 0.3,
  },
  // The jazz kit (it has no crash: the ride marks the sections), upright bass, Rhodes and vibes; straight eighths and
  // triads until U03 (FLAVOUR_RULES). A sidestick backbeat in the verse, brushes in the chorus, the hi-hat foot on 2
  // and 4, the bass in two (root, fifth) and then in four (root, fifth, octave, fifth).
  "flavour.jazz-soul": {
    bank: "jazzkit",
    kick: {
      intro: bars(4, "bd ~ ~ ~"),
      verse: bars(8, "bd ~ bd ~"),
      break: ["bd ~ ~ ~"],
      chorus: bars(8, "bd ~ bd [~ bd]"),
      bridge: bars(4, "bd ~ ~ ~", "bd ~ bd [~ bd]"),
      outro: bars(4, "bd ~ bd [~ bd]", "bd ~ ~ ~"),
    },
    snare: {
      ...SNARE_EDGES,
      verse: bars(8, "~ rim ~ rim", "~ rim ~ [sd sd]"),
      chorus: bars(8, "~ sd ~ sd", "~ sd [~ sd] [sd sd]"),
      bridge: bars(4, "~ ~ rim ~", "~ sd [sd sd] [sd sd sd sd]"),
      outro: ["~ sd ~ sd", "~ sd ~ sd", "~ sd [~ sd] [sd sd]", "~"],
    },
    hats: {
      intro: bars(4, "~ hh ~ hh"),
      verse: bars(8, "~ hh ~ hh"),
      chorus: bars(8, "~ hh ~ hh"),
      outro: bars(4, "~ hh ~ hh", "~"),
    },
    perc: {
      intro: bars(4, "rd*4"),
      verse: bars(8, "rd*8"),
      break: ["rd ~ ~ ~"],
      chorus: bars(8, "rd*8"),
      bridge: bars(4, "rd*4"),
      outro: bars(4, "rd*8", "rd ~ ~ ~"),
    },
    accents: { perc: { intro: QUARTERS, verse: EIGHTHS, chorus: EIGHTHS, bridge: QUARTERS, outro: EIGHTHS } },
    gains: { kick: 0.6, snare: 0.55, hats: 0.4, perc: 0.35, bass: 0.85, chords: 0.42, lead: 0.5 },
    bass: {
      sound: "upright",
      lpf: 900,
      groove: {
        intro: (r) => `[${r}@2 ${r + 4}@2]`,
        verse: (r) => `[${r}@2 ${r + 4}@2]`,
        break: STOP,
        chorus: JAZZ_CHORUS_BASS,
        bridge: bridgeInto((r) => `[${r}@2 ${r + 4}@2]`, JAZZ_CHORUS_BASS),
        outro: ending(JAZZ_CHORUS_BASS),
      },
    },
    chords: {
      sound: "rhodes",
      pan: 0.4,
      comp: {
        intro: bars(4, "x"),
        verse: bars(8, "x ~ ~ [~ x]"),
        break: ["x ~ ~ ~"],
        chorus: bars(8, "x [~ x] ~ [~ x]"),
        bridge: bars(4, "x@2 x@2"),
        outro: bars(4, "x [~ x] ~ [~ x]", "x"),
      },
      accents: { verse: '"1 .86"', chorus: "1 .86 .92 .86" },
    },
    lead: { sound: "vibes", pan: 0.6 },
    room: 0.35,
  },
  // The 808, finger bass, clavinet and organ, on a straight sixteenth grid (U01 stays straight): a kick and bass
  // that lock on 1, the last sixteenth of 2 and the "and" of 3, clav upstrokes, a shaker in the bridge.
  "flavour.funk": {
    bank: "RolandTR808",
    kick: {
      intro: bars(4, "bd ~ bd ~"),
      verse: bars(8, "bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~"),
      break: ["bd ~ ~ ~"],
      chorus: bars(8, "bd ~ ~ bd ~ ~ bd ~ bd ~ ~ bd ~ ~ ~ ~"),
      bridge: KICK_BUILD,
      outro: bars(4, "bd ~ ~ bd ~ ~ bd ~ bd ~ ~ bd ~ ~ ~ ~", "bd ~ ~ ~"),
    },
    snare: {
      ...SNARE_EDGES,
      ...SNARE_BACKBEAT,
      ...SNARE_CLAP,
      bridge: bars(4, "~ ~ cp ~", "~ sd [sd sd] [sd sd sd sd]"),
    },
    hats: {
      intro: bars(4, "hh*8"),
      verse: bars(8, "hh*16"),
      chorus: bars(8, "[hh hh oh hh]*4"),
      outro: bars(4, "[hh hh oh hh]*4", "~"),
    },
    perc: { ...CRASHES, bridge: bars(4, "sh*8") },
    accents: {
      snare: CLAP_LEVEL,
      hats: { intro: "[.8 .6]*4", verse: SIXTEENTHS, chorus: SIXTEENTHS, outro: SIXTEENTHS },
      perc: { bridge: EIGHTHS },
    },
    gains: { kick: 0.65, snare: 0.6, hats: 0.4, perc: 0.4, bass: 0.85, chords: 0.36, lead: 0.4 },
    bass: {
      sound: "fingerbass",
      lpf: 850,
      groove: {
        intro: (r) => `[${r} ~ ~ ~ ~ ~ ~ ~ ${r} ~ ~ ~ ~ ~ ${r + 7} ~]`,
        verse: (r) => `[${r} ~ ~ ~ ~ ~ ~ ${r} ~ ~ ${r} ~ ~ ${r + 7} ~ ~]`,
        break: STOP,
        chorus: FUNK_CHORUS_BASS,
        bridge: bridgeInto((r) => `[${r}@4 ~ ~ ~ ~ ~ ~ ~ ~ ${r} ~ ${r + 7} ~]`, FUNK_CHORUS_BASS),
        outro: ending(FUNK_CHORUS_BASS),
      },
    },
    chords: {
      sound: "clav",
      pan: 0.42,
      comp: {
        intro: bars(4, "~ x ~ x"),
        verse: bars(8, "~ x ~ [~ x]"),
        break: ["x ~ ~ ~"],
        chorus: bars(8, "[~ x]*4"),
        bridge: bars(4, "x ~ x ~"),
        outro: bars(4, "[~ x]*4", "x"),
      },
      accents: { verse: '"1 .86"' },
    },
    lead: { sound: "organ", pan: 0.58 },
    room: 0.2,
  },
  // Electronic: Oak's 909-style machine for the verse, the choruses and the ending, the lo-fi kit (a dusty crate kit)
  // for the opening and the half-time bridge. Four on the floor and a clap from the verse on, sixteenth hats that open
  // on every "and". The bass is an acid line, a sawtooth under a resonant ladder filter whose envelope opens on an
  // accent pattern, on the chord's root with octave jumps between the beats; in the opening and the bridge a sine sub
  // holds the roots instead. The chords are sawtooth stabs between the kicks in the verse, eighths in the chorus whose
  // on-beat ones are ducked (the pump of a sidechained record), and a supersaw pad that swells after every kick in the
  // opening and the bridge, its filter drifting. The tune is a square pluck with a dotted-eighth echo. Straight and in
  // triads (FLAVOUR_RULES: sevenths from U06.L10).
  "flavour.electronic": {
    bank: "oak909",
    banks: { intro: "lofikit", bridge: "lofikit" },
    kick: {
      intro: bars(4, "bd ~ ~ [~ bd] ~ ~ bd ~", "bd ~ ~ [~ bd] bd ~ bd bd"),
      verse: bars(8, "bd*4"),
      break: ["bd ~ ~ ~"],
      chorus: bars(8, "bd*4"),
      bridge: KICK_BUILD,
      outro: bars(4, "bd*4", "bd ~ ~ ~"),
    },
    snare: {
      ...SNARE_EDGES,
      intro: bars(4, "~ sd ~ sd", "~ sd ~ [sd sd]"),
      verse: bars(8, "~ cp ~ cp", "~ cp ~ [cp cp]"),
      chorus: SNARE_CLAP.chorus,
      outro: SNARE_CLAP.outro,
    },
    hats: {
      intro: bars(4, "[~ hh]*4"),
      verse: bars(8, "[hh hh oh hh]*4"),
      chorus: bars(8, "[hh hh oh hh]*4"),
      outro: bars(4, "[hh hh oh hh]*4", "~"),
    },
    perc: { ...CRASHES, intro: ["~", "~", "~", "~"], bridge: bars(4, "sh*8") },
    accents: {
      snare: { ...CLAP_LEVEL, verse: ".85" },
      hats: { intro: "[.8 .6]*4", verse: SIXTEENTHS, chorus: SIXTEENTHS, outro: SIXTEENTHS },
      perc: { bridge: EIGHTHS },
    },
    gains: { kick: 0.6, snare: 0.5, hats: 0.35, perc: 0.35, bass: 0.5, chords: 0.28, lead: 0.4 },
    bass: {
      sound: "sawtooth",
      lpf: 700,
      groove: {
        intro: HALVES,
        verse: (r) => `[${r} ~ ${r} ${r + 7} ${r} ~ ${r} ~ ${r} ~ ${r + 7} ${r} ${r} ~ ~ ${r}]`,
        break: STOP,
        chorus: ACID_CHORUS,
        bridge: bridgeInto(WHOLE, ACID_CHORUS),
        outro: ending(ACID_CHORUS),
      },
      sounds: { intro: "sine", bridge: "sine" },
      fx: {
        intro: ".decay(1.2).sustain(.6)",
        verse: ACID,
        break: ACID,
        chorus: ACID_OPEN,
        bridge: ".decay(1.2).sustain(.6)",
        outro: ACID,
      },
    },
    chords: {
      sound: "sawtooth",
      pan: 0.4,
      comp: {
        intro: bars(4, "x*4"),
        verse: bars(8, "[~ x]*4"),
        break: ["x ~ ~ ~"],
        chorus: bars(8, "x*8"),
        bridge: bars(4, "x*4"),
        outro: bars(4, "x*8", "x"),
      },
      accents: { chorus: "[.6 1]*4", outro: "[.6 1]*4" },
      sounds: { intro: "supersaw", bridge: "supersaw" },
      fx: {
        intro: PAD,
        verse: STAB,
        break: STAB,
        chorus: STAB,
        bridge: PAD,
        outro: STAB,
      },
    },
    lead: {
      sound: "square",
      pan: 0.6,
      fx: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.45).delayfeedback(.35)",
    },
    room: 0.2,
  },
};

const KINDS: Kind[] = ["intro", "verse", "break", "chorus", "bridge", "outro"];
/** `.velocity("…")` with a pattern, quoting it when it is not quoted yet. */
const velocity = (accent: string | undefined): string =>
  accent === undefined ? "" : `.velocity(${accent.startsWith('"') ? accent : `"${accent}"`})`;

/** Oak's whole song in one flavour: seven labelled tracks, one arrange() each, no tempo line (spec §5.1). */
function code(f: FlavourId): string {
  const k = KITS[f];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const sectionBank = (kind: Kind) => (k.banks ? `.bank("${k.banks[kind] ?? k.bank}")` : "");
  const drum = (label: "kick" | "snare" | "hats" | "perc") =>
    track(
      label,
      Object.fromEntries(
        KINDS.flatMap((kind) => {
          const b = k[label][kind];
          if (!b || b.every((x) => x === "~")) return [];
          return [[kind, `s("${perBar(b)}")${sectionBank(kind)}${velocity(k.accents[label]?.[kind])}`]];
        }),
      ),
      `${bank}.gain(${num(k.gains[label])})`,
    );
  /** A section's own sound and synth controls, when the kit changes them by section; else the track's sound. */
  const voiced = (part: Kit["bass"] | Kit["chords"], kind: Kind) =>
    part.fx || part.sounds ? `.s("${part.sounds?.[kind] ?? part.sound}")${part.fx?.[kind] ?? ""}` : "";
  const tailSound = (part: Kit["bass"] | Kit["chords"]) =>
    part.fx || part.sounds ? "" : `.s("${part.sound}")`;
  const bass = track(
    "bass",
    Object.fromEntries(
      KINDS.map((kind) => {
        const chords = chordsOf(kind);
        return [
          kind,
          `n("${perBar(chords.map((c, i) => k.bass.groove[kind](c.root, i, chords.length)))}")${voiced(k.bass, kind)}`,
        ];
      }),
    ),
    `.scale("C2:major")${tailSound(k.bass)}.lpf(${k.bass.lpf}).gain(${num(k.gains.bass)})`,
  );
  const chords = track(
    "chords",
    Object.fromEntries(
      KINDS.map((kind) => [
        kind,
        `n("${perBar(chordsOf(kind).map((c) => c.voicing))}").struct("${perBar(k.chords.comp[kind])}")${voiced(k.chords, kind)}${velocity(k.chords.accents[kind])}`,
      ]),
    ),
    `.scale("C3:major")${tailSound(k.chords)}.gain(${num(k.gains.chords)}).pan(${num(k.chords.pan)}).room(${num(k.room)})`,
  );
  const mel = track(
    "mel",
    Object.fromEntries(
      KINDS.flatMap((kind) => {
        const tune = TUNE[kind];
        return tune ? [[kind, `n("${perBar(tune)}")`]] : [];
      }),
    ),
    `.scale("C4:major").s("${k.lead.sound}")${k.lead.fx ?? ""}.gain(${num(k.gains.lead)}).pan(${num(k.lead.pan)}).room(${num(k.room)})`,
  );
  const tracks = [drum("kick"), drum("snare"), drum("hats"), drum("perc"), bass, chords, mel];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

// --- the plan --------------------------------------------------------------------------------------------------

const take = (
  lesson: TakeStep["lesson"],
  sections: TakeStep["sections"],
  parts: string[],
  startFrom: TakeStep["startFrom"],
  today: string,
): TakeStep => ({ lesson, kind: "take", sections, parts, startFrom, today });

/** The drum parts a U01 Make writes; a take of a section claims all three, so a learner's line plays whole there. */
const KIT = ["kick", "snare", "hats"];

export const U01_SONG = defineUnitSong({
  id: "usong.U01",
  unit: "U01",
  version: 1,
  title: "Count me in",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: SECTIONS,
  parts: [
    { id: "kick", label: "kick", role: "drums", sounds: ["bd"], name: "Kick", plainName: "Kick" },
    {
      id: "snare",
      label: "snare",
      role: "drums",
      sounds: ["sd", "rim", "cp"],
      name: "Snare",
      plainName: "Snare",
    },
    { id: "hats", label: "hats", role: "drums", sounds: ["hh", "oh"], name: "Hi-hats", plainName: "Hi-hats" },
    {
      id: "perc",
      label: "perc",
      role: "drums",
      sounds: ["cr", "rd", "lt", "mt", "ht", "sh", "cb", "tb"],
      name: "Cymbals and toms",
      plainName: "Cymbals and toms",
    },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // Each Make takes the drums of the section its idea belongs to: the first beat opens the song, the silent beat is
  // the stop, the backbeat is the verse, split beats drive both choruses, a ringing crash is the ending, sixteenths
  // lift the last chorus, the four-bar phrase with a fill replaces the verse, half-time is the bridge. A Make that
  // grows the learner's own earlier loop opens with it (`startFrom`); none of those loops meets today's rule yet.
  plan: [
    take(
      "U01.L01",
      ["intro"],
      KIT,
      "oak",
      "Your first drum beat opens the song, and the speed you choose becomes the speed of the whole song.",
    ),
    take(
      "U01.L02",
      ["stop"],
      KIT,
      "U01.L01",
      "Your beat with one silent beat in it plays the one-bar stop before the first loud part.",
    ),
    take(
      "U01.L03",
      ["verse"],
      KIT,
      "oak",
      "Kick, snare and hats, one line each, play the second part of the song, where the tune comes in.",
    ),
    take(
      "U01.L04",
      ["chorus1", "chorus2"],
      KIT,
      "U01.L03",
      "Your backbeat, with a beat split in two, drives both loud parts of the song.",
    ),
    take(
      "U01.L05",
      ["outro"],
      [...KIT, "perc"],
      "oak",
      "Your groove of long and short sounds plays the ending of the song, its last four bars.",
    ),
    take(
      "U01.L06",
      ["chorus2"],
      KIT,
      "U01.L04",
      "Your groove, with four drum sounds in beat 1, lifts the last loud part of the song.",
    ),
    take(
      "U01.L07",
      ["verse"],
      [...KIT, "perc"],
      "U01.L03",
      "A four-bar groove that changes in its last bar takes over the second part of the song.",
    ),
    {
      lesson: "U01.L08",
      kind: "side",
      reason:
        "This lesson counts three to a bar and the song counts four, so this beat stays a sketch of its own.",
    },
    take(
      "U01.L09",
      ["bridge"],
      KIT,
      "U01.L03",
      "Your backbeat at a new speed plays the quiet part before the last loud part.",
    ),
  ],
  releaseAfter: "U01.CP",
});

export default U01_SONG;
