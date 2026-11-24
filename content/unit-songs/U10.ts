// Song 10, "After dark" (docs/design/songs/makes-core-b.md "U10 song (minor)"; AUTHORING §23). A minor, 4/4,
// 88 BPM, 64 bars: the unit on minor gets a minor pop song in ten sections, with a bridge in C minor.
//
//   intro 4 | verse 8 | pre 4 | chorus 8 | verse 8 | pre 4 | chorus 8 | bridge 8 (C minor) | chorus 8 | outro 4
//   Am G F E | (Am Em F Dm)×2 | F G C E | (Am F C G)×2 | (Am Dm F Em)×2 | F G C E | (Am F C G)×2 |
//   Cm Gm A♭ Fm Cm Gm A♭ G | Am F C G Am F E Am | Am Dm E Am
//
// Every section carries one lesson's harmony, so each Make takes a section whose music it already writes:
// - the intro walks down the Andalusian cadence i VII VI V over the bass A G F E (U10.L07);
// - the first verse is the four-chord loop moved to A minor, i v VI iv, its tune coming home on A (U10.L02);
// - the second verse is i iv VI v, its tune leaning on me, le and te, C F G (U10.L03);
// - the four bars before the first two choruses lift on minor's major chords, VI VII III, then V (U10.L04);
// - the first two choruses circle on the Aeolian loop i VI III VII (U10.L05), and the last one lands on a major V
//   that goes home, its tune climbing G♯ to A (U10.L06);
// - the bridge is the first verse's loop a minor third higher, in C minor (U10.L01's key and loop, i v VI iv); the
//   chorus before it ends on G, which is VII in A minor and V in C minor, so the song turns into the bridge on V–i;
// - the ending is i iv V i, its tune climbing home through F♯ and G♯ over E (U10.L08).
//
// Every flavour plays the same notes (tune, bass roots on every downbeat, chord roots); a flavour changes sounds,
// grooves, comp and bass rhythms, and chord colour as its kit's staging allows at U10 (content/flavours.ts
// FLAVOUR_RULES): pop and indie play triads, straight; jazz-soul swings (1/3) with four-note chords; funk and
// electronic play four-note chords, straight. The four-note chords follow `band.aeolian-4bar`: minor sevenths on the
// minor chords, a sixth on VI, an added ninth on III, VII and V with their root on top or a seventh (Am7 F6 Cadd9 G
// E7 Em7 Dm7; Cm7 Gm7 A♭6 Fm7 G7 in the bridge), never a major seventh, which would sit a half step under a tune on
// me or le. F6 and Dm7, A♭6 and Fm7 are the same notes: wherever a four-note chord is struck, the bass sounds its
// root, so each reads as its own chord. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top.
// Tune and bass hold no note a half step above a sounding chord tone (AUTHORING §13); every claim here is read
// off the evaluated events (content/validate/unit-songs.ts).
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const SECTIONS = [
  { id: "intro", type: "intro", bars: 4 },
  { id: "verse1", type: "verse", bars: 8 },
  { id: "pre1", type: "pre", bars: 4 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "pre2", type: "pre", bars: 4 },
  { id: "chorus2", type: "chorus", bars: 8 },
  // U10.L01's Make is in C minor: the bridge carries that key.
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "C", mode: "minor" } },
  { id: "chorus3", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
type Kind = (typeof SECTIONS)[number]["type"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;
/** Something every section of the same kind shares (the choruses, the verses), with exceptions by id. */
type ByKind<T> = Readonly<Record<Kind, T>> & { readonly only?: Partial<Record<SectionId, T>> };

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const kindOf = (id: SectionId): Kind => (SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number]).type;
const pick = <T>(by: ByKind<T>, id: SectionId): T => by.only?.[id] ?? by[kindOf(id)];

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `melChorus3` for a third chorus that plays something else), `silence` where it rests, and one
 * `arrange()` over every section of the song.
 */
function track(label: string, by: BySection, tail: string): { consts: string[]; line: string } {
  const named = new Map<string, string>(); // type + pattern → const name
  const taken = new Set<string>();
  const consts: string[] = [];
  const entries = SECTIONS.map((section, i) => {
    const pattern = by[section.id];
    if (pattern === null) return `[${section.bars}, silence]`;
    const key = `${section.type}\u0000${pattern}`;
    let name = named.get(key);
    if (name === undefined) {
      const base = `${label}${cap(section.type)}`;
      const nth = SECTIONS.slice(0, i + 1).filter((s) => s.type === section.type).length;
      name = taken.has(base) ? `${base}${nth}` : base;
      taken.add(name);
      named.set(key, name);
      consts.push(`const ${name} = ${pattern}`);
    }
    return `[${section.bars}, ${name}]`;
  });
  return { consts, line: `${label}: arrange(${entries.join(", ")})${tail}` };
}

// ---- Harmony (every flavour) --------------------------------------------------------------------------------
//
// One chord a bar. Voiced close and low (G2 to F3) so every change moves each voice a step or two and the tune, from
// A3 up, has the register above the chords to itself; the choruses lift the voicing to G3–F4 under a tune that sits
// round C5. The Andalusian intro moves its top voice E D F E over the falling bass; the bridge's voices move a step at
// a time through C minor (G C E♭, G B♭ D, A♭ C E♭, A♭ C F).

type ChordName = "Am" | "Em" | "F" | "Dm" | "G" | "C" | "E" | "Cm" | "Gm" | "Ab" | "Fm" | "G7";
interface Chord {
  /** Major or minor: which third the bass walks through. */
  minor: boolean;
  triad: { low: string; high?: string };
  four: { low: string; high?: string };
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  Am: {
    minor: true,
    triad: { low: "a2,c3,e3", high: "a3,c4,e4" },
    four: { low: "a2,c3,e3,g3", high: "g3,a3,c4,e4" },
  },
  Em: { minor: true, triad: { low: "g2,b2,e3" }, four: { low: "g2,b2,d3,e3" } },
  F: {
    minor: false,
    triad: { low: "a2,c3,f3", high: "a3,c4,f4" },
    four: { low: "a2,c3,d3,f3", high: "a3,c4,d4,f4" },
  },
  Dm: { minor: true, triad: { low: "a2,d3,f3" }, four: { low: "a2,c3,d3,f3" } },
  G: {
    minor: false,
    triad: { low: "g2,b2,d3", high: "g3,b3,d4" },
    four: { low: "g2,b2,d3,g3", high: "g3,b3,d4" },
  },
  C: {
    minor: false,
    triad: { low: "g2,c3,e3", high: "g3,c4,e4" },
    four: { low: "g2,c3,d3,e3", high: "g3,c4,d4,e4" },
  },
  E: {
    minor: false,
    triad: { low: "g#2,b2,e3", high: "g#3,b3,e4" },
    four: { low: "g#2,b2,d3,e3", high: "g#3,b3,d4,e4" },
  },
  Cm: { minor: true, triad: { low: "g2,c3,eb3" }, four: { low: "g2,bb2,c3,eb3" } },
  Gm: { minor: true, triad: { low: "g2,bb2,d3" }, four: { low: "g2,bb2,d3,f3" } },
  Ab: { minor: false, triad: { low: "ab2,c3,eb3" }, four: { low: "ab2,c3,eb3,f3" } },
  Fm: { minor: true, triad: { low: "ab2,c3,f3" }, four: { low: "ab2,c3,eb3,f3" } },
  // V of C minor, ending the bridge: in A minor it is VII, the chord the choruses end on.
  G7: { minor: false, triad: { low: "g2,b2,d3" }, four: { low: "g2,b2,d3,f3" } },
};

const AEOLIAN: ChordName[] = ["Am", "F", "C", "G"];
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: ["Am", "G", "F", "E"],
  verse1: ["Am", "Em", "F", "Dm", "Am", "Em", "F", "Dm"],
  pre1: ["F", "G", "C", "E"],
  chorus1: [...AEOLIAN, ...AEOLIAN],
  verse2: ["Am", "Dm", "F", "Em", "Am", "Dm", "F", "Em"],
  pre2: ["F", "G", "C", "E"],
  chorus2: [...AEOLIAN, ...AEOLIAN],
  bridge: ["Cm", "Gm", "Ab", "Fm", "Cm", "Gm", "Ab", "G7"],
  chorus3: ["Am", "F", "C", "G", "Am", "F", "E", "Am"],
  outro: ["Am", "Dm", "E", "Am"],
};
/**
 * The bass's root in each bar, low (A1 to G2). The intro is U10.L07's own bass, A G F E down by step; the choruses
 * step down to VI and up through III to VII, as `band.aeolian-4bar` does; the bridge moves C G A♭ F, never past a 5th.
 */
const ROOTS: Readonly<Record<SectionId, string[]>> = {
  intro: ["a1", "g1", "f1", "e1"],
  verse1: ["a1", "e2", "f2", "d2", "a1", "e2", "f2", "d2"],
  pre1: ["f1", "g1", "c2", "e2"],
  chorus1: ["a1", "f1", "c2", "g1", "a1", "f1", "c2", "g1"],
  verse2: ["a1", "d2", "f2", "e2", "a1", "d2", "f2", "e2"],
  pre2: ["f1", "g1", "c2", "e2"],
  chorus2: ["a1", "f1", "c2", "g1", "a1", "f1", "c2", "g1"],
  bridge: ["c2", "g1", "ab1", "f1", "c2", "g1", "ab1", "g1"],
  chorus3: ["a1", "f1", "c2", "g1", "a1", "f1", "e1", "a1"],
  outro: ["a1", "d2", "e2", "a1"],
};
/** The choruses sit higher; everything else low. */
const HIGH = new Set<SectionId>(["chorus1", "chorus2", "chorus3"]);
/** The bridge is spelled in flats (C minor); everything else in sharps (A minor, with G♯ and F♯). */
const FLATS = new Set<SectionId>(["bridge"]);

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

const STEPS: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SHARP = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const FLAT = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"];
const midiOf = (name: string): number => {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + (STEPS[m[1] as string] as number) + acc;
};
const nameOf = (midi: number, flats: boolean): string =>
  `${(flats ? FLAT : SHARP)[midi % 12] as string}${Math.floor(midi / 12) - 1}`;

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eight slots to a bar (`@` holds). Every note held a beat or more is a note of its chord; the steps between are
// eighths. The verses sit low (A3–A4), each bar starting off the beat; the first verse's question stops open on D
// over Dm and its answer comes home on A (U10.L02), the second verse climbs to te and leans le onto sol over Em (C F G,
// U10.L03). The four bars before the first two choruses climb the major chords' own notes. The chorus hook is a 3+3+2 figure
// round C5 (E D C over Am, C A C over F), peaking on G5 in bar 7; the last chorus lands, E D B G♯ over E, then A. The
// bridge rises through C minor's chords in long notes; the ending climbs E F♯ G♯ A over E and Am (U10.L08).

const V1 = [
  "~ a3 c4 e4@2 e4 d4 c4",
  "b3@4 ~ g3 a3 b3",
  "~ a3 c4 f4@2 f4 e4 c4",
  "d4@4 ~@4",
  "~ a3 c4 e4@2 e4 d4 c4",
  "b3@3 e4@3 g4@2",
  "a4@3 g4 f4@2 c4@2",
  "f4@3 e4 d4 a3@3",
];
const V2 = [
  "~ a3 c4 e4@2 e4 d4 c4",
  "d4@4 ~ a3 c4 d4",
  "~ a3 c4 f4@2 f4 e4 c4",
  "b3@2 e4@2 g4@4",
  "~ a3 c4 e4@2 e4 d4 c4",
  "f4@3 e4 d4 a3@3",
  "a4@3 g4 f4@2 c4@2",
  "g4@3 f4 e4@4",
];
const PRE = ["c4@2 f4@2 a4@4", "b3@2 d4@2 g4@4", "c4@2 e4@2 g4@2 c5@2", "b4@4 g#4@2 b4@2"];
const HOOK = [
  "e5@3 d5@3 c5@2",
  "c5@3 a4@3 c5@2",
  "e5@3 d5@3 c5@2",
  "d5@3 b4@3 g4@2",
  "e5@3 d5@3 c5@2",
  "f5@3 e5 d5@2 c5@2",
  "e5@3 g5@3 e5@2",
  "d5@6 ~@2",
];
const LANDING = [...HOOK.slice(0, 6), "e5@2 d5@2 b4@2 g#4@2", "a4@8"];
const BRIDGE = [
  "g4@3 c5@3 eb5@2",
  "d5@6 bb4@2",
  "c5@3 eb5@3 c5@2",
  "ab4@6 ~@2",
  "g4@3 c5@3 eb5@2",
  "f5@3 d5@3 bb4@2",
  "eb5@3 c5@3 ab4@2",
  "g4@2 b4@2 d5@4",
];
const ENDING = ["e4@3 d4 c4@4", "f4@3 e4 d4@4", "e4@2 f#4@2 g#4@4", "a4@8"];

const MEL: BySection = {
  // The tune waits two bars, then sighs A C A over F and holds G♯ over E, into the verse.
  intro: `note("${bars(["~", "~", "a4@3 c5@3 a4@2", "g#4@6 ~@2"])}")`,
  verse1: `note("${bars(V1)}")`,
  pre1: `note("${bars(PRE)}")`,
  chorus1: `note("${bars(HOOK)}")`,
  verse2: `note("${bars(V2)}")`,
  pre2: `note("${bars(PRE)}")`,
  chorus2: `note("${bars(HOOK)}")`,
  bridge: `note("${bars(BRIDGE)}")`,
  chorus3: `note("${bars(LANDING)}")`,
  outro: `note("${bars(ENDING)}")`,
};
/** The second line: the second and last choruses doubled an octave down on another sound. */
const VOX: BySection = {
  intro: null,
  verse1: null,
  pre1: null,
  chorus1: null,
  verse2: null,
  pre2: null,
  chorus2: `note("${bars(HOOK)}").transpose(-12)`,
  bridge: null,
  chorus3: `note("${bars(LANDING)}").transpose(-12)`,
  outro: null,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;
/** The four bars before a chorus: a steady line whose velocity climbs bar by bar. */
const RISING = (mini: string, from = 0.4): string =>
  `s("${mini}").velocity(saw.range(${num(from)}, 1).slow(4))`;

/**
 * A bass bar: `{r}` root, `{f}` fifth, `{t}` third, `{o}` octave of the bar's chord, or `~` for a bar of rest. A
 * function gets the bar's index in its section and the section's length.
 */
type BassBar = string | ((i: number, n: number) => string);

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the quiet parts, the 808 in the bridge). */
  banks?: Partial<Record<SectionId, string>>;
  /** Four-note chords (jazz-soul, funk, electronic at U10) or triads. */
  depth: "triad" | "four";
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; chords: string; lead: string; vox: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    vox: number;
  };
  /** content/flavours.ts production: the chords' room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: ByKind<string | null>;
  snare: ByKind<string | null>;
  hats: ByKind<string | null>;
  perc: ByKind<string | null>;
  bass: ByKind<BassBar>;
  /** The chords' rhythm (`struct`) in each section. */
  comp: ByKind<string>;
  chordSound?: Partial<Record<SectionId, string>>;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines' echo. */
  synth?: {
    bassSound: ByKind<string>;
    bass: ByKind<string>;
    chords: ByKind<string>;
    lead: string;
    vox: string;
  };
}

/** The ending: the kit's bar, then one held root under the last chord. */
const LAST_HELD =
  (bar: string, held = "{r}@8"): BassBar =>
  (i, n) =>
    i === n - 1 ? held : bar;
/** The four bars before a chorus: the kit's bar, busier in the last. */
const LAST_BUSY =
  (bar: string, last: string): BassBar =>
  (i, n) =>
    i === n - 1 ? last : bar;

/** Pop: the default kit, piano, picked bass; the kick and the bass lock on 1, the "and" of 2 and 3. */
const POP: Kit = {
  bank: "",
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", vox: "strings" },
  gain: { kick: 0.2, snare: 0.16, hats: 0.11, perc: 0.1, bass: 0.56, chords: 0.19, lead: 0.33, vox: 0.17 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<bd [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ bd bd ~ bd bd]>"),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    pre: v("<[bd ~ bd ~ bd ~ bd ~]!3 [bd bd bd bd bd bd bd bd]>"),
    chorus: v("bd ~ ~ bd bd ~ bd ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ bd ~]!7 [bd ~ bd ~ bd bd bd bd]>"),
    outro: v("<[bd ~ ~ ~ bd ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ rim ~ ~ ~ rim ~] [~ ~ sd ~ sd sd [sd sd] [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    pre: v("<[~ sd ~ sd]!3 [[sd sd] [sd sd] [sd sd sd sd] [sd sd sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ [hh*8] [hh*8] [hh*8]>", V8),
    verse: v("hh*8", V8),
    pre: RISING("hh*16"),
    chorus: v("[hh hh hh oh]*2", V8),
    bridge: null,
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    pre: v("<[sh*8]!3 [sh*16]>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    outro: v("<cr ~ ~ cr>"),
    only: { verse2: v("<[cr, [~ sh]*4] [[~ sh]*4]!3>"), chorus3: v("<[cr, tb*8] [tb*8]!3>") },
  },
  bass: {
    intro: "{r}@4 {r}@4",
    verse: "{r}@3 {r} {r}@4",
    pre: LAST_BUSY("{r} {r} {r} {r} {r} {r} {r} {r}", "{r} {r} {r} {r} {o} {o} {o} {o}"),
    chorus: "{r}@3 {r} {r}@2 {r} {o}",
    bridge: "{r}@6 {r}@2",
    outro: LAST_HELD("{r}@4 {r}@4"),
  },
  comp: {
    intro: "x@3 x@3 x@2",
    verse: "x@3 x@3 x@2",
    pre: "x*8",
    chorus: "x*8",
    bridge: "x@4 x@4",
    outro: "<[x@3 x@3 x@2]!3 x>",
  },
};

/** Indie: the rock kit, clean guitar, acoustic lead. The verses push in 3-3-2; the choruses go four on the floor. */
const INDIE: Kit = {
  bank: "rockkit",
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "organ" },
  gain: { kick: 0.38, snare: 0.33, hats: 0.22, perc: 0.19, bass: 0.49, chords: 0.38, lead: 0.94, vox: 0.53 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<bd [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd bd]>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    pre: v("<[bd*4]!3 [bd*8]>"),
    chorus: v("bd*4"),
    // The bridge rolls on the floor tom (perc) over a kick on 1.
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!7 [bd ~ bd ~ bd bd bd bd]>"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ sd ~] [~ ~ sd [sd sd]]>"),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    pre: v("<[~ sd ~ sd]!3 [[sd sd] [sd sd] [sd sd sd sd] [sd sd sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!7 [~ ~ rim [sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ [hh*8] [hh*8] [hh*8]>", V8),
    verse: v("hh*8", V8),
    pre: RISING("hh*16"),
    chorus: v("[hh oh]*4", V8),
    bridge: null,
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    pre: v("<[tb*8]!3 [tb*16]>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    bridge: v("<[cr, [lt ~ lt lt ~ lt ~ ~]] [lt ~ lt lt ~ lt ~ ~]!7>"),
    outro: v("<cr ~ ~ cr>"),
    only: { verse2: v("<[cr, [~ tb]*4] [[~ tb]*4]!3>"), chorus3: v("<[cr, tb*8] [tb*8]!3>") },
  },
  bass: {
    intro: "{r}@3 {r}@3 {r}@2",
    verse: "{r}@3 {r}@3 {r}@2",
    pre: LAST_BUSY("{r}*8", "[{r} {o}]*4"),
    chorus: "[{r} {o}]*4",
    bridge: "{r}@8",
    outro: LAST_HELD("{r}@3 {r}@3 {r}@2"),
  },
  comp: {
    intro: "x@3 x@3 x@2",
    verse: "x@3 x@3 x@2",
    pre: "x*8",
    chorus: "x*8",
    bridge: "x",
    outro: "<[x@3 x@3 x@2]!3 x>",
  },
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A Rhodes comp on beat 1 and the "and" of 2 (the Charleston), both over the bass's root. */
const JAZZ_COMP = "x [~ x] ~ ~";

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, a tenor saxophone doubling the last two choruses. Swung
 * eighths and four-note chords (from U03, FLAVOUR_RULES). Cross-stick and the hi-hat on 2 and 4 in the verses, the
 * snare and the ride in the choruses; the bass plays root and fifth in two, and walks root, root, fifth, third in the
 * choruses; the Rhodes strikes only while the bass holds the root.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "tenor" },
  gain: { kick: 0.22, snare: 0.35, hats: 0.22, perc: 0.22, bass: 0.74, chords: 0.43, lead: 0.51, vox: 0.45 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<bd [bd ~ bd ~] [bd ~ bd ~] [bd ~ bd bd]>"),
    verse: v("bd ~ bd ~"),
    pre: v("<[bd ~ bd ~]!3 [bd bd bd bd]>"),
    chorus: v("bd ~ bd ~"),
    bridge: v("<[bd ~ ~ ~]!7 [bd ~ bd bd]>"),
    outro: v("<[bd ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ [~ rim ~ rim] [~ rim ~ rim] [~ rim ~ [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    pre: v("<[~ sd ~ sd]!3 [sd sd [sd sd] [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    // Half time: the snare on 3.
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ rim ~ rim]!3 ~>"),
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("~ hh ~ hh"),
    verse: v("~ hh ~ hh"),
    pre: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    outro: v("<[~ hh ~ hh]!3 ~>"),
  },
  perc: {
    intro: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    pre: v("<[rd*8]!3 [rd*8, [~ ~ ~ cr]]>", V8),
    chorus: v("<[cr, rd*8] [rd*8]!3>", V8),
    // The ride in quarters.
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!2 cr>`, V8),
    only: { chorus3: v("<[cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!3>") },
  },
  bass: {
    intro: "{r}@2 {f}@2",
    verse: "{r}@2 {f}@2",
    pre: "{r} {r} {f} {o}",
    chorus: "{r} {r} {f} {t}",
    bridge: "{r}@2 {f}@2",
    outro: LAST_HELD("{r}@2 {f}@2", "{r}@4"),
  },
  comp: {
    intro: "x@2 ~@2",
    verse: JAZZ_COMP,
    pre: JAZZ_COMP,
    chorus: JAZZ_COMP,
    bridge: "x@2 ~@2",
    outro: `<[${JAZZ_COMP}]!3 x>`,
  },
};

// Funk, in sixteenths: the kick and the bass lock on 1, the "a" of 1, the "and" of 2 and the "and" of 3 in the verses
// (and on 3 as well in the choruses); the clavinet stabs between them, each over a sounding root or its octave.
const FK_KICK_V = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FK_KICK_C = "bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~";
const FK_BASS_V = "{r}@2 ~ {r}@3 {o}@3 ~ {r}@3 ~@3";
const FK_BASS_C = "{r}@3 {r}@3 {o}@2 {r}@2 {r}@2 {o}@2 ~@2";
const FK_CLAV_V = "~ ~ ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~";
const FK_CLAV_C = "~ ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~";
const FK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";

/**
 * Funk: Oak's 808, clavinet, finger bass, organ lead, horns doubling the last two choruses. Sixteenths, straight,
 * four-note chords (from U06). In the bridge strings hold the chords over a half-time beat.
 */
const FUNK: Kit = {
  bank: "oak808",
  depth: "four",
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "horns" },
  gain: { kick: 0.33, snare: 0.23, hats: 0.13, perc: 0.12, bass: 0.67, chords: 0.52, lead: 0.88, vox: 0.72 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [${FK_KICK_V}]!3>`),
    verse: v(FK_KICK_V),
    pre: v("<[bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~]!3 [bd ~ bd ~ bd ~ bd ~ bd ~ bd ~ bd ~ bd ~]>"),
    chorus: v(FK_KICK_C),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!7 [bd ~ bd ~ bd ~ bd ~ bd bd bd bd bd bd bd bd]>"),
    outro: v(`<[${FK_KICK_V}]!3 bd>`),
  },
  snare: {
    intro: v(`<~ [${FK_BACKBEAT}] [${FK_BACKBEAT}] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    pre: v(`<[${FK_BACKBEAT}]!3 [sd*16]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    bridge: v("<[~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~]!7 [~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ sd sd sd sd]>"),
    outro: v(`<[${FK_BACKBEAT}]!3 ~>`),
  },
  hats: {
    intro: v("hh*16", V16),
    verse: v("hh*16", V16),
    pre: RISING("hh*16"),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    bridge: v("hh*8", V8),
    outro: v("<[hh*16]!3 ~>", V16),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    pre: v("<[sh*8]!3 [sh*16]>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    bridge: v("<cr ~!7>"),
    outro: v("<cr ~ ~ cr>"),
    only: { chorus3: v("<[cr, [~ cb]*4] [[~ cb]*4]!3>") },
  },
  bass: {
    intro: FK_BASS_V,
    verse: FK_BASS_V,
    pre: LAST_BUSY("{r}@2 {r}@2 {o}@2 {r}@2 {r}@2 {r}@2 {o}@2 {r}@2", "{r} {r} {o} {r} {r} {o} {r} {o}"),
    chorus: FK_BASS_C,
    bridge: "{r}@8 {f}@8",
    outro: LAST_HELD(FK_BASS_V),
  },
  comp: {
    intro: FK_CLAV_V,
    verse: FK_CLAV_V,
    pre: "[~ x]*4",
    chorus: FK_CLAV_C,
    bridge: "x",
    outro: `<[${FK_CLAV_V}]!3 x>`,
  },
  chordSound: { bridge: "strings" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. Every eighth of the acid bar sounds the root or its
// octave, so each stab and each pad chord has its root under it.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {r}";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The four bars before a chorus: the same acid, its filter envelope opening wider bar by bar. */
const ACID_RISING =
  '.lpq(12).ftype("ladder").lpenv(saw.range(1, 5).slow(4)).lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/**
 * The 808 kick (funk's `oak808`, the electronic bridge's) rings for seconds with no choke: hits a beat apart pile up,
 * by up to 7 dB and by the tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at
 * 96). A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** A supersaw pad struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: the lo-fi kit in the intro, the verses and the ending; Oak's 909 in the two four-bar lifts into the
 * choruses and in the choruses; Oak's 808 in the bridge. The verses sit on a boom-bap beat over a sine sub and off-beat stabs;
 * the four bars before a chorus build (kick in quarters then eighths, the acid's filter and the stabs' cutoff opening
 * over the four bars); the choruses go four on the floor with the acid line and pumping stabs; the bridge swells on
 * a supersaw pad over the 808 in half time. A square pluck with a dotted-eighth echo plays the tune, a supersaw the
 * double. Straight, four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", verse1: "lofikit", verse2: "lofikit", bridge: "oak808", outro: "lofikit" },
  depth: "four",
  swing: "",
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", vox: "supersaw" },
  gain: { kick: 0.29, snare: 0.17, hats: 0.12, perc: 0.1, bass: 0.72, chords: 0.33, lead: 0.43, vox: 0.3 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v(
      "<bd [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ bd bd]>",
    ),
    verse: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    pre: v("<[bd*4]!3 [bd*8]>"),
    chorus: v("bd*4"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!7 [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~]>"),
    outro: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    pre: v("<[~ cp ~ cp]!3 [[sd sd sd sd] [sd sd sd sd] [sd*4] [sd*4]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ cp ~]!7 [~ ~ cp [cp cp]]>"),
    outro: v("<[~ sd ~ sd]!3 ~>"),
  },
  hats: {
    intro: v("<~ [~ hh]*4 [~ hh]*4 [hh*8]>", V8),
    verse: v("hh*8", V8),
    pre: RISING("hh*16"),
    chorus: v("[hh hh oh hh]*4", V16),
    bridge: v("~ hh ~ hh"),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    pre: v("<~ ~ ~ [~ ~ [lt lt] [ht ht]]>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!3>"),
    bridge: v("<cr ~!7>"),
    outro: v("<cr ~ ~ cr>"),
    only: { chorus3: v("<[cr, rd*8] [rd*8]!3>", V8) },
  },
  bass: {
    intro: "{r}",
    verse: "{r}@10 {r}@6",
    pre: ACID_BAR,
    chorus: ACID_BAR,
    bridge: "{r}@10 {r}@6",
    outro: LAST_HELD("{r}@10 {r}@6", "{r}"),
  },
  comp: {
    intro: "x x x x",
    verse: "[~ x]*4",
    pre: "<[~ x]*4 [~ x]*4 x*8 x*16>",
    chorus: "x*8",
    bridge: "x x x x",
    outro: "<[[~ x]*4]!3 x>",
  },
  chordSound: { intro: "supersaw", bridge: "supersaw", outro: "<sawtooth!3 supersaw>" },
  synth: {
    bassSound: {
      intro: "sine",
      verse: "sine",
      pre: "sawtooth",
      chorus: "sawtooth",
      bridge: "sine",
      outro: "sine",
    },
    bass: { intro: SUB, verse: SUB, pre: ACID_RISING, chorus: ACID, bridge: SUB, outro: SUB },
    chords: {
      intro: PAD,
      verse: STAB,
      pre: ".lpf(saw.range(500, 4000).slow(4)).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)",
      chorus: `${STAB}${PUMP}`,
      bridge: PAD,
      outro: '.lpf(1800).lpenv(2).lpd(.12).lps(0).decay("<.22!3 1.5>").sustain("<.3!3 .6>")',
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.51).delayfeedback(.35)",
    vox: ".unison(5).detune(.2).lpf(3000).decay(.3).sustain(.5)",
  },
};

const KITS: Readonly<Record<FlavourId, Kit>> = {
  "flavour.pop": POP,
  "flavour.indie": INDIE,
  "flavour.jazz-soul": JAZZ,
  "flavour.funk": FUNK,
  "flavour.electronic": ELECTRONIC,
};

const mapSections = (f: (id: SectionId) => string | null): BySection =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, string | null>;

/** A section's bass line: one bar per chord, the kit's bar with the chord's root, fifth, third and octave filled in. */
function bassLine(id: SectionId, bar: BassBar): string {
  const chords = PROGRESSION[id];
  const out = chords.map((name, i) => {
    const root = midiOf(ROOTS[id][i] as string);
    const at: Record<"r" | "f" | "t" | "o", number> = {
      r: root,
      f: root + 7,
      t: root + (CHORD[name].minor ? 3 : 4),
      o: root + 12,
    };
    const text = typeof bar === "string" ? bar : bar(i, chords.length);
    return text.replace(/\{([rfto])\}/g, (_, k: "r" | "f" | "t" | "o") => nameOf(at[k], FLATS.has(id)));
  });
  return bars(out);
}

/** A section's chords: one bar per chord, voiced by the kit's depth and the section's register. */
function chordLine(id: SectionId, depth: Kit["depth"]): string {
  const out = PROGRESSION[id].map((name) => {
    const set = CHORD[name][depth === "four" ? "four" : "triad"];
    return HIGH.has(id) ? (set.high ?? set.low) : set.low;
  });
  return bars(out);
}

/** One flavour's song: the tune first, then the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${chordLine(id, k.depth)}").struct("${pick(k.comp, id)}").s("${sound}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const bass = mapSections((id) => {
    const line = `note("${bassLine(id, pick(k.bass, id))}")`;
    return syn ? `${line}.s("${pick(syn.bassSound, id)}")${pick(syn.bass, id)}` : line;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: ByKind<string | null>): BySection =>
    mapSections((id) => {
      const p = pick(by, id);
      if (p === null || !k.banks) return p;
      return `${p}.bank("${k.banks[id] ?? k.bank}")`;
    });
  const sw = k.swing;
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: ReturnType<typeof drums>): ReturnType<typeof drums> =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(k.banks?.[id] ?? k.bank) ? `${p}${KICK_808}` : p;
    });
  const tracks = [
    track(
      "mel",
      MEL,
      `${sw}.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "vox",
      VOX,
      `${sw}.s("${k.sounds.vox}")${syn?.vox ?? ""}.gain(${num(k.gain.vox)}).pan(.45).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${sw}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${sw}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    track("kick", kick808(drums(k.kick)), `${bank}${sw}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${bank}${sw}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}${sw}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc), `${bank}${sw}.gain(${num(k.gain.perc)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: SectionId[],
  parts: SongPartId[],
  startFrom: TakeStep["startFrom"],
  today: string,
): TakeStep => ({ lesson, kind: "take", sections, parts, startFrom, today });

/** Every take of U10 writes its chords (and, but for U10.L04's starter, its bass and tune), so it takes whole sections. */
const PITCHED: SongPartId[] = ["lead", "chords", "bass"];

export const U10_SONG = defineUnitSong({
  id: "usong.U10",
  unit: "U10",
  version: 1,
  title: "After dark",
  meter: "4/4",
  key: { tonic: "A", mode: "minor" },
  bpm: 88,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "vox", label: "vox", role: "melody", name: "Second line", plainName: "Second line" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
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
      name: "Cymbals and percussion",
      plainName: "Cymbals and percussion",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // By section (AUTHORING §23.6): every U10 Make writes chords, so each take hands over whole sections and Oak keeps
  // the drums there. Each lesson takes the section whose harmony it writes, and none takes a section an earlier one
  // took, so the song grows to the learner's in every pitched cell by U10.L08. No `oakKeeps`: each take sets its own
  // chords (U10.L04 and U10.L07 choose theirs), and Oak's tune or bass could rub against them.
  plan: [
    take(
      "U10.L01",
      ["bridge"],
      PITCHED,
      "oak",
      "Your tune over the starter's dark chords plays the bridge, the eight bars after the second chorus.",
    ),
    take(
      "U10.L02",
      ["verse1"],
      PITCHED,
      "oak",
      "Your loop, moved to A minor with a tune that ends on A, plays the first verse.",
    ),
    take(
      "U10.L03",
      ["verse2"],
      PITCHED,
      "oak",
      "Your tune on me, le and te plays the second verse, over its own chords and bass.",
    ),
    take(
      "U10.L04",
      ["pre1", "pre2"],
      ["chords", "bass"],
      "oak",
      "Your minor loop with two major chords plays the four bars leading into the first two choruses.",
    ),
    take(
      "U10.L05",
      ["chorus1", "chorus2"],
      PITCHED,
      "oak",
      "Your loop of i VI III VII, with its bass and a tune, plays the first two choruses.",
    ),
    take(
      "U10.L06",
      ["chorus3"],
      PITCHED,
      "U10.L05",
      "Your chorus from The Aeolian Loop, given a V that goes home to i, becomes the last chorus.",
    ),
    take(
      "U10.L07",
      ["intro"],
      ["chords", "bass"],
      "oak",
      "Your chords over the bass that walks down A G F E open the song, its first four bars.",
    ),
    take(
      "U10.L08",
      ["outro"],
      PITCHED,
      "oak",
      "Your tune that climbs home through F♯ and G♯ ends the song, in its last four bars.",
    ),
    {
      lesson: "U10.L09",
      kind: "side",
      reason:
        "This tune starts with a pickup and runs five bars, and every section of the song runs four or eight, so it stays a sketch of its own.",
    },
  ],
  releaseAfter: "U10.CP",
});

export default U10_SONG;
