// Song 16, "Borrowed light" (docs/design/songs/makes-core-c.md §3 "U16 song: anthem ballad with borrowed light";
// AUTHORING §23). C major, 4/4, 88 BPM, 64 bars: an anthem ballad that borrows its shadows from C minor.
//
//   intro 4 | verse 8 | chorus 8 | verse 8 | chorus 8 | solo 8 | bridge 8 (A minor) | chorus 8 | outro 4
//   C Eb F C | (C Am F Fm)×2 | C G Am F C G [Ab Bb] C | … | C D7 [D7 G] [Ab Bb] C D7 [D7 G] C |
//   Am D F E Am D E A | C G Am F C G [Ab Bb] C | C Eb Fm C
//
// Every lesson of U16 is a chord of the song before the learner writes it (U16.L01–L05, content/specs/U16.md):
// - the riff of the intro and the ending climbs I ♭III IV and closes iv into I (U16.L03's ♭III and minor plagal);
// - each half of the verse turns IV into the sad iv, the tune falling la, le, sol across the change (U16.L01);
// - each chorus comes home ♭VI ♭VII I in its seventh bar: the bass climbs le, te, do and the tune do, re, mi, the
//   3rds of A♭, B♭ and C (U16.L02);
// - the bridge goes to A minor, brightens iv to the Dorian IV (D major) and ends on A major (U16.L04's Picardy
//   chord), the light coming on just before the last chorus;
// - the solo is Aura Lee's verse, note for note an octave up, over chords from outside the key: a secondary dominant
//   (D7, which goes on to G as it leans: the tune's C over it is its 7th, never a 4th over G) and the climb ♭VI ♭VII
//   (U16.L05's lab).
//
// Every flavour plays the same notes (tune, bass roots on every downbeat and on beat 3 of a bar of two chords, chord
// roots); a flavour changes sounds, grooves, comp and bass rhythms, and chord colour as its kit's staging allows at
// U16 (content/flavours.ts FLAVOUR_RULES): pop and indie play triads, straight; jazz-soul swings (1/3) with
// four-note chords; funk and electronic play four-note chords, straight. The four-note chords are sixths on I and IV
// (C6 F6, the bright IV D6, the Picardy A6, and Fm6, whose one moving note is la to le) and sevenths elsewhere (Am7
// G7 D7 E7 B♭7), with a major seventh only on the borrowed ♭III and ♭VI (E♭maj7, A♭maj7), never under a tune
// note a half step above it. Wherever a chord is struck, the bass sounds its root, so a sixth chord never reads as
// another chord's seventh. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top.
// Tune and bass hold no note a half step above a
// sounding chord tone (AUTHORING §13); every claim here is read off the evaluated events (content/validate/unit-songs.ts).
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
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "solo", type: "solo", bars: 8 },
  // U16.L04's Make is in A minor and ends on A major: the bridge carries its key (spec §5.2, AUTHORING §23.11).
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "A", mode: "minor" } },
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
 * (`melChorus`; `percChorus3` for a third chorus that plays something else), `silence` where it rests, and one
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
// One chord a bar, or two (half a bar each) where a bar climbs. Voiced close and low (B♭2 to A3) under the verse,
// solo and bridge tunes, which keep above A3; the choruses lift the voicing to F3–E♭4 under a tune from G4 to A5.
// Bass roots: C2, G1, A1, F1 (F2 in the riff), A♭1 and B♭1 (so the climb ♭VI ♭VII I rises le, te, do into C2),
// E♭2, D2, E1.

type ChordName = "C" | "Am" | "F" | "F2" | "Fm" | "Fm2" | "G" | "Eb" | "Ab" | "Bb" | "D7" | "D" | "E" | "A";
interface Chord {
  /** Bass notes: root, fifth, octave. */
  r: string;
  f: string;
  o: string;
  triad: { low: string; high: string };
  four: { low: string; high: string };
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  C: {
    r: "c2",
    f: "g2",
    o: "c3",
    triad: { low: "c3,e3,g3", high: "g3,c4,e4" },
    four: { low: "c3,e3,g3,a3", high: "e3,g3,a3,c4" },
  },
  Am: {
    r: "a1",
    f: "e2",
    o: "a2",
    triad: { low: "c3,e3,a3", high: "a3,c4,e4" },
    four: { low: "a2,c3,e3,g3", high: "g3,a3,c4,e4" },
  },
  F: {
    r: "f1",
    f: "c2",
    o: "f2",
    triad: { low: "c3,f3,a3", high: "f3,a3,c4" },
    four: { low: "c3,d3,f3,a3", high: "f3,a3,c4,d4" },
  },
  // F in the riff, its bass an octave up so the riff's bass climbs C E♭ F.
  F2: {
    r: "f2",
    f: "c3",
    o: "f3",
    triad: { low: "c3,f3,a3", high: "f3,a3,c4" },
    four: { low: "c3,d3,f3,a3", high: "f3,a3,c4,d4" },
  },
  // The sad iv: F6 with its A lowered to A♭ (la to le), one note moving.
  Fm: {
    r: "f1",
    f: "c2",
    o: "f2",
    triad: { low: "c3,f3,ab3", high: "f3,ab3,c4" },
    four: { low: "c3,d3,f3,ab3", high: "f3,ab3,c4,d4" },
  },
  Fm2: {
    r: "f2",
    f: "c3",
    o: "f3",
    triad: { low: "c3,f3,ab3", high: "f3,ab3,c4" },
    four: { low: "c3,d3,f3,ab3", high: "f3,ab3,c4,d4" },
  },
  G: {
    r: "g1",
    f: "d2",
    o: "g2",
    triad: { low: "b2,d3,g3", high: "g3,b3,d4" },
    four: { low: "b2,d3,f3,g3", high: "f3,g3,b3,d4" },
  },
  Eb: {
    r: "eb2",
    f: "bb2",
    o: "eb3",
    // `high` is only the pad's (no chorus plays E♭): it sits under the four-note chord's D4, not a half step above it.
    triad: { low: "bb2,eb3,g3", high: "eb3,g3,bb3" },
    four: { low: "bb2,eb3,g3,d4", high: "g3,bb3,d4,eb4" },
  },
  Ab: {
    r: "ab1",
    f: "eb2",
    o: "ab2",
    triad: { low: "c3,eb3,ab3", high: "ab3,c4,eb4" },
    four: { low: "c3,eb3,g3,ab3", high: "g3,ab3,c4,eb4" },
  },
  Bb: {
    r: "bb1",
    f: "f2",
    o: "bb2",
    triad: { low: "bb2,d3,f3", high: "f3,bb3,d4" },
    four: { low: "bb2,d3,f3,ab3", high: "f3,ab3,bb3,d4" },
  },
  // The secondary dominant of the solo (V of V): a bar and a half, then home to G in the middle of the next bar.
  D7: {
    r: "d2",
    f: "a2",
    o: "d3",
    triad: { low: "a2,d3,f#3", high: "a3,d4,f#4" },
    four: { low: "c3,d3,f#3,a3", high: "f#3,a3,c4,d4" },
  },
  // The bridge's bright IV in A minor.
  D: {
    r: "d2",
    f: "a2",
    o: "d3",
    triad: { low: "a2,d3,f#3", high: "a3,d4,f#4" },
    four: { low: "a2,b2,d3,f#3", high: "f#3,a3,b3,d4" },
  },
  E: {
    r: "e1",
    f: "b1",
    o: "e2",
    triad: { low: "b2,e3,g#3", high: "g#3,b3,e4" },
    four: { low: "b2,d3,e3,g#3", high: "g#3,b3,d4,e4" },
  },
  // The bridge's last chord: A major where A minor was home.
  A: {
    r: "a1",
    f: "e2",
    o: "a2",
    triad: { low: "c#3,e3,a3", high: "a3,c#4,e4" },
    four: { low: "c#3,e3,f#3,a3", high: "f#3,a3,c#4,e4" },
  },
};

/** A bar: one chord, or two that split it in halves. */
type Bar = ChordName | readonly [ChordName, ChordName];
const CHORUS: Bar[] = ["C", "G", "Am", "F", "C", "G", ["Ab", "Bb"], "C"];
const VERSE: Bar[] = ["C", "Am", "F", "Fm", "C", "Am", "F", "Fm"];
const PROGRESSION: Readonly<Record<SectionId, Bar[]>> = {
  intro: ["C", "Eb", "F2", "C"],
  verse1: VERSE,
  chorus1: CHORUS,
  verse2: VERSE,
  chorus2: CHORUS,
  solo: ["C", "D7", ["D7", "G"], ["Ab", "Bb"], "C", "D7", ["D7", "G"], "C"],
  bridge: ["Am", "D", "F", "E", "Am", "D", "E", "A"],
  chorus3: CHORUS,
  outro: ["C", "Eb", "Fm2", "C"],
};
/** The choruses sit higher; everything else low. */
const HIGH = new Set<SectionId>(["chorus1", "chorus2", "chorus3"]);
const halves = (bar: Bar): readonly [ChordName, ChordName] => (typeof bar === "string" ? [bar, bar] : bar);
const isSplit = (bar: Bar): boolean => typeof bar !== "string";

/** One element per bar inside `< >`; a split bar is two elements in a bracket. */
const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eighth notes to a bar (`@` holds). Every note held a beat or more is a tone of its chord; no note that starts off
// the beat runs to a barline (jazz-soul's swing would carry it into the next chord).
//
// The riff (intro, ending) answers each stab in 3 + 3 + 2 and bends to ♭7 (B♭) over I and over ♭III; the ending
// holds le (A♭) over iv and lands sol then do over the last C. The verse sings low (C4–C5): each half climbs to A over
// F and falls a half step to A♭ over F minor, and the next bar arrives on G (la, le, sol). The chorus hook climbs
// to A5 in its third bar and comes home do, re, mi over A♭, B♭ and C. The solo is Aura Lee's verse an octave up
// (G4–D5). The bridge sings A minor through the bright IV's F♯ to C♯ over the last A major.

const RIFF = ["c5@3 g4@3 bb4 c5", "bb4@3 g4@3 f4 g4", "c5@3 a4@3 bb4 c5", "g4@3 e4@3 c4@2"];
const ENDING = ["c5@3 g4@3 bb4 c5", "bb4@3 g4@3 f4 g4", "c5@2 ab4@6", "g4@2 c5@6"];
const VERSE_TUNE = [
  "c4 d4 e4@3 g4 e4@2",
  "c4@2 e4@2 a4@3 g4",
  "f4@2 a4@6",
  "ab4@6 ~@2",
  "g4@3 e4 c4@2 d4 e4",
  "c4@2 e4@2 a4@4",
  "c5@4 a4@4",
  "ab4@6 ~@2",
];
const HOOK = [
  "g4 c5 e5@3 d5 c5@2",
  "b4@3 c5 d5@4",
  "c5 e5 a5@3 g5 e5@2",
  "f5@3 e5 c5@4",
  "g4 c5 e5@3 d5 c5@2",
  "b4@3 c5 d5@4",
  "c5@4 d5@4",
  "e5@6 ~@2",
];
/** Aura Lee's verse (U16.L05, content/repertoire/aura-lee), every note an octave above the lesson's tenor. */
const AURA_LEE = [
  "g4@2 c5@2 b4@2 c5@2",
  "d5@2 a4@2 d5@4",
  "c5@2 b4@2 a4@2 b4@2",
  "c5@8",
  "g4@2 c5@2 b4@2 c5@2",
  "d5@2 d5@2 d5@4",
  "c5@2 b4@2 a4@2 b4@2",
  "c5@8",
];
const BRIDGE_TUNE = [
  "a4@3 b4 c5@4",
  "b4@2 a4@2 f#4@4",
  "c5@3 b4 a4@4",
  "b4@4 g#4@2 e4@2",
  "a4@3 b4 c5@4",
  "d5@3 c5 b4@2 a4@2",
  "g#4@3 a4 b4@4",
  "c#5@6 ~@2",
];

const MEL: BySection = {
  intro: `note("${bars(RIFF)}")`,
  verse1: `note("${bars(VERSE_TUNE)}")`,
  chorus1: `note("${bars(HOOK)}")`,
  verse2: `note("${bars(VERSE_TUNE)}")`,
  chorus2: `note("${bars(HOOK)}")`,
  solo: `note("${bars(AURA_LEE)}")`,
  bridge: `note("${bars(BRIDGE_TUNE)}")`,
  chorus3: `note("${bars(HOOK)}")`,
  outro: `note("${bars(ENDING)}")`,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

/**
 * A bass bar: a flat sequence of steps (`@` weights), each `{r}` root, `{f}` fifth or `{o}` octave of the chord
 * sounding where the step starts (the second chord from the middle of a split bar), or `~`. A function gets the
 * bar's index in its section and the section's length.
 */
type BassBar = string | ((i: number, n: number) => string);
/** The bass's last bar rings: one note held through the bar. */
const LAST_HELD =
  (bar: string, held = "{r}@8"): BassBar =>
  (i, n) =>
    i === n - 1 ? held : bar;
/** The bridge: whole notes for four bars, then the kit's bar, then the held A major. */
const BRIDGE_BASS =
  (quiet: string, build: string, held = "{r}@8"): BassBar =>
  (i, n) =>
    i === n - 1 ? held : i < 4 ? quiet : build;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the verses, the solo and the bridge). */
  banks?: Partial<Record<SectionId, string>>;
  /** Four-note chords (jazz-soul, funk, electronic at U16) or triads. */
  depth: "triad" | "four";
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; chords: string; lead: string; pad: string };
  /** The tune's sound in the solo (the instrument that takes it). */
  soloLead: string;
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    pad: number;
  };
  /** content/flavours.ts production: the room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: ByKind<string | null>;
  snare: ByKind<string | null>;
  hats: ByKind<string | null>;
  perc: ByKind<string | null>;
  bass: ByKind<BassBar>;
  /** The chords' rhythm (`struct`) in each section: in a split bar it strikes on beat 1 and on beat 3. */
  comp: ByKind<string>;
  chordSound?: Partial<Record<SectionId, string>>;
  /** Where the held chords play (a sustained bar, or half bar, per chord). */
  pad: ReadonlySet<SectionId>;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the leads. */
  synth?: {
    bassSound: ByKind<string>;
    bass: ByKind<string>;
    chords: ByKind<string>;
    lead: string;
    solo: string;
    pad: string;
  };
}

const PAD_EVERYWHERE_BUT = (...rest: SectionId[]): ReadonlySet<SectionId> =>
  new Set(SECTIONS.map((s) => s.id).filter((id) => !rest.includes(id)));

/** The intro's and the ending's riff rhythm: three, three, two eighths. */
const R332 = "x@3 x@3 x@2";

/** Pop: the default kit, piano, picked bass, strings; a tenor saxophone takes the solo. */
const POP: Kit = {
  bank: "",
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", pad: "strings" },
  soloLead: "tenor",
  gain: { kick: 0.22, snare: 0.19, hats: 0.13, perc: 0.11, bass: 0.61, chords: 0.23, lead: 0.46, pad: 0.13 },
  room: 0.3,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 [bd ~ ~ bd ~ ~ ~ ~]>"),
    verse: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd bd ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!4 [bd ~ ~ ~ bd ~ ~ ~]!3 bd>"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
    only: { verse2: v("bd ~ ~ bd bd ~ ~ ~") },
  },
  snare: {
    intro: v("<[~ sd ~ sd]!3 [~ sd ~ [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v("<~!4 [~ ~ sd ~]!3 [~ ~ [sd sd] [sd sd sd sd]]>"),
    outro: v("<[~ sd ~ sd]!3 ~>"),
    only: { verse2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>") },
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", "[.7 .5 .6 .5]*2"),
    chorus: v("[hh hh hh oh]*2", V8),
    solo: null,
    bridge: null,
    outro: v("<[hh*8]!3 ~>", V8),
    only: { verse2: v("[hh hh hh oh]*2", V8) },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<[cr, [~ tb]*4] [[~ tb]*4]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
    solo: v("<[cr, rd*8] [rd*8]!7>", V8),
    bridge: v("<[rd*4]!7 cr>"),
    outro: v("<cr ~ ~ cr>"),
    only: { chorus3: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>", V8) },
  },
  bass: {
    intro: "{r}@3 {r}@3 {r}@2",
    verse: "{r}@4 {r}@4",
    chorus: "{r} {r} {r} {r} {r} {r} {r} {o}",
    solo: "{r}@3 {r} {r}@4",
    bridge: BRIDGE_BASS("{r}@8", "{r}@4 {r}@4"),
    outro: LAST_HELD("{r}@3 {r}@3 {r}@2"),
    only: { verse2: "{r}@3 {r} {r}@4" },
  },
  comp: {
    intro: R332,
    verse: "x x x x",
    chorus: "x*8",
    solo: "x@3 x x@4",
    bridge: "<[x x x x]!7 x>",
    outro: `<[${R332}]!3 x>`,
  },
  pad: PAD_EVERYWHERE_BUT("intro", "verse1", "solo"),
};

/** Indie: the rock kit, clean guitar, acoustic lead, organ; the overdriven guitar takes the solo. */
const INDIE: Kit = {
  bank: "rockkit",
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", pad: "organ" },
  soloLead: "crunch",
  gain: { kick: 0.36, snare: 0.33, hats: 0.22, perc: 0.19, bass: 0.48, chords: 0.38, lead: 0.85, pad: 0.17 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 [bd ~ ~ bd ~ ~ ~ ~]>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus: v("bd*4"),
    solo: v("bd ~ ~ bd bd ~ ~ bd"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!4 [bd ~ ~ ~ bd ~ ~ ~]!3 bd>"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v("<[~ ~ sd ~]!3 [~ ~ sd [sd sd]]>"),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v("<~!4 [~ ~ sd ~]!3 [~ ~ [sd sd] [sd sd sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh oh]*4", V8),
    solo: v("hh*8", V8),
    bridge: null,
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<cr ~ ~ ~ cr ~ ~ ~>"),
    solo: v("<cr ~!7>"),
    // The bridge rolls on the floor tom under the ringing guitar, then crashes into the A major.
    bridge: v("<[lt ~ lt lt ~ lt ~ ~]!7 cr>"),
    outro: v("<cr ~ ~ cr>"),
    only: { chorus3: v("<[cr, [~ tb]*4] [[~ tb]*4]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>") },
  },
  bass: {
    intro: "{r}@3 {r}@3 {r}@2",
    verse: "{r}@3 {r}@3 {r}@2",
    chorus: "{r} {o} {r} {o} {r} {o} {r} {o}",
    solo: "{r}@3 {r} {r}@3 {r}",
    bridge: BRIDGE_BASS("{r}@8", "{r}@4 {r}@4"),
    outro: LAST_HELD("{r}@3 {r}@3 {r}@2"),
  },
  comp: {
    intro: R332,
    verse: R332,
    chorus: "x*8",
    solo: "x@3 x x@3 x",
    bridge: "x",
    outro: `<[${R332}]!3 x>`,
  },
  pad: PAD_EVERYWHERE_BUT("intro", "verse1", "solo"),
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, strings; a tenor saxophone takes the solo. Swung eighths and
 * four-note chords (from U03, FLAVOUR_RULES). Cross-stick and the hi-hat on 2 and 4 in the verses, the snare and the
 * ride in the choruses. The Rhodes strikes only while the bass holds the chord's root.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", pad: "strings" },
  soloLead: "tenor",
  gain: { kick: 0.21, snare: 0.34, hats: 0.21, perc: 0.21, bass: 0.68, chords: 0.4, lead: 0.57, pad: 0.18 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 [bd ~ ~ ~ ~ ~ ~ ~]>"),
    verse: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ ~ bd ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!4 [bd ~ ~ ~ bd ~ ~ ~]!3 bd>"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v("<[~ rim ~ rim]!3 [~ rim ~ [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v("<~!4 [~ ~ rim ~]!3 [~ ~ [sd sd] [sd sd sd sd]]>"),
    outro: v("<[~ rim ~ rim]!3 ~>"),
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("~ hh ~ hh"),
    verse: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    solo: v("~ hh ~ hh"),
    bridge: null,
    outro: v("<[~ hh ~ hh]!3 ~>"),
  },
  perc: {
    intro: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    chorus: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    solo: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    bridge: v("<[rd*4]!7 cr>"),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!2 cr>`, V8),
    only: {
      chorus3: v("<[cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!3 [cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!3>", V8),
    },
  },
  bass: {
    intro: "{r}@3 {r}@3 {r}@2",
    // In two, with the kick on 1 and 3: the root to beat 4, the fifth as a pickup (the Rhodes has struck by then).
    verse: "{r}@4 {r}@2 {f}@2",
    chorus: "{r}@2 {o}@2 {r}@2 {f}@2",
    solo: "{r}@2 {o}@2 {r}@2 {f}@2",
    bridge: BRIDGE_BASS("{r}@8", "{r}@4 {r}@2 {f}@2"),
    outro: LAST_HELD("{r}@3 {r}@3 {r}@2"),
  },
  comp: {
    intro: R332,
    verse: "x ~ ~ x ~ x ~ ~",
    chorus: "x ~ ~ x x ~ ~ ~",
    solo: "x ~ ~ x x ~ ~ ~",
    bridge: "<[x ~ ~ ~ x ~ ~ ~]!7 x>",
    outro: `<[${R332}]!3 x>`,
  },
  pad: PAD_EVERYWHERE_BUT("intro", "verse1", "solo"),
};

// Funk, in sixteenths: the kick and the bass lock; the clavinet stabs between, each over a sounding root or octave.
const FK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";
const FK_RIFF = "x ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ x ~ ~ ~";

/** Funk: Oak's 808, clavinet, finger bass, organ, strings; a trumpet takes the solo. Sixteenths, four-note chords. */
const FUNK: Kit = {
  bank: "oak808",
  depth: "four",
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", pad: "strings" },
  soloLead: "trumpet",
  gain: { kick: 0.38, snare: 0.27, hats: 0.16, perc: 0.13, bass: 0.78, chords: 0.71, lead: 0.55, pad: 0.28 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<[bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~]!3 [bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~]>"),
    verse: v("bd ~ ~ bd ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    solo: v("bd ~ ~ bd ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~]!4 [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!3 bd>"),
    outro: v("<[bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v(`<[${FK_BACKBEAT}]!3 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    solo: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    bridge: v("<~!4 [~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~]!3 [~ ~ ~ ~ ~ ~ ~ ~ sd ~ sd ~ sd sd sd sd]>"),
    outro: v(`<[${FK_BACKBEAT}]!3 ~>`),
  },
  hats: {
    intro: v("hh*16", V16),
    verse: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    solo: v("hh*16", V16),
    bridge: v("<~!4 [hh*8]!3 ~>", V8),
    outro: v("<[hh*16]!3 ~>", V16),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    solo: v("<cr ~!7>"),
    bridge: v("<~!7 cr>"),
    outro: v("<cr ~ ~ cr>"),
    only: { chorus3: v("<[cr, [~ cb]*4] [[~ cb]*4]!3 [cr, [~ cb]*4] [[~ cb]*4]!3>") },
  },
  bass: {
    intro: "{r}@6 {r}@6 {o}@4",
    verse: "{r}@3 {r}@5 ~@2 {r}@2 {o}@4",
    chorus: "{r}@3 {r}@3 {o}@2 {r}@2 {r}@2 {o}@2 ~@2",
    solo: "{r}@3 {r}@3 ~@2 {r}@3 {r}@3 {o}@2",
    bridge: BRIDGE_BASS("{r}@16", "{r}@10 {r}@6", "{r}@16"),
    outro: LAST_HELD("{r}@6 {r}@6 {o}@4", "{r}@16"),
  },
  comp: {
    intro: FK_RIFF,
    verse: "~ ~ ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~",
    chorus: "x ~ x ~ ~ x ~ x x ~ x ~ x ~ ~ ~",
    solo: "x ~ x ~ ~ x ~ ~ x ~ x ~ ~ x ~ ~",
    bridge: "<x!7 x>",
    outro: `<[${FK_RIFF}]!3 x>`,
  },
  // The bridge's chords on the Rhodes, ringing, under the strings.
  chordSound: { bridge: "rhodes" },
  pad: PAD_EVERYWHERE_BUT("intro", "verse1", "solo", "chorus1", "chorus2"),
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. Every eighth of the acid bar sounds the root or its
// octave, so each stab has its root under it.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {r}";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
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
/** A supersaw pad struck with a slow attack, so it swells; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const SWELL = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: Oak's 909 in the intro, the choruses and the ending; the lo-fi kit in the verses, the solo and the bridge.
 * The riff rides four on the floor over the acid line; the verses sit on a boom-bap beat over a sine sub and off-beat
 * stabs; the choruses pump (acid, eighth stabs ducked on the beat, a supersaw pad); the solo is a wide supersaw lead
 * over the sub; the bridge swells on the pad in half time. A square pluck with a dotted-eighth echo plays the tune.
 * Straight, four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", solo: "lofikit", bridge: "lofikit" },
  depth: "four",
  swing: "",
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", pad: "supersaw" },
  soloLead: "supersaw",
  gain: { kick: 0.33, snare: 0.16, hats: 0.11, perc: 0.1, bass: 0.73, chords: 0.31, lead: 0.42, pad: 0.18 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<bd*4!3 [bd ~ bd ~]>"),
    verse: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus: v("bd*4"),
    solo: v("bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~]!4 [bd ~ bd ~]!3 bd>"),
    outro: v("<bd*4!3 bd>"),
  },
  snare: {
    intro: v("<[~ cp ~ cp]!3 [~ cp ~ [cp cp]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v("<~!4 [~ ~ sd ~]!3 [~ ~ [sd sd] [sd sd sd sd]]>"),
    outro: v("<[~ cp ~ cp]!3 ~>"),
  },
  hats: {
    intro: v("[~ hh]*4", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh oh hh]*4", V16),
    solo: v("hh*8", V8),
    bridge: v("~ hh ~ hh"),
    outro: v("<[[~ hh]*4]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!3 [cr, [~ rd]*4] [[~ rd]*4]!3>"),
    solo: v("<cr ~!7>"),
    bridge: v("<~!7 cr>"),
    outro: v("<cr ~ ~ cr>"),
    only: { chorus3: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8) },
  },
  bass: {
    intro: ACID_BAR,
    verse: "{r}@10 {r}@6",
    chorus: ACID_BAR,
    solo: "{r}@8 {r}@2 {r}@6",
    bridge: BRIDGE_BASS("{r}@16", "{r}@8 {r}@8", "{r}@16"),
    outro: LAST_HELD(ACID_BAR, "{r}@16"),
  },
  comp: {
    intro: "[~ x]*4",
    verse: "[~ x]*4",
    chorus: "x*8",
    solo: "x ~ ~ x x ~ ~ ~",
    bridge: "<[x x x x]!7 x>",
    outro: "<[[~ x]*4]!3 x>",
  },
  chordSound: { bridge: "supersaw" },
  pad: PAD_EVERYWHERE_BUT("intro", "verse1", "solo"),
  synth: {
    bassSound: {
      intro: "sawtooth",
      verse: "sine",
      chorus: "sawtooth",
      solo: "sine",
      bridge: "sine",
      outro: "<sawtooth!3 sine>",
    },
    bass: { intro: ACID, verse: SUB, chorus: ACID, solo: SUB, bridge: SUB, outro: ACID },
    chords: {
      intro: STAB,
      verse: STAB,
      chorus: `${STAB}${PUMP}`,
      solo: STAB,
      bridge: SWELL,
      outro: '.lpf(1800).lpenv(2).lpd(.12).lps(0).decay("<.22!3 1.5>").sustain("<.3!3 .6>")',
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.45).delayfeedback(.35)",
    solo: ".unison(5).detune(.15).lpf(2800).attack(.02).decay(.3).sustain(.6).delay(.25).delaytime(.34).delayfeedback(.3)",
    pad: SWELL,
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

/** Fills a flat bass bar's tokens with the notes of the chord sounding where each step starts. */
function fillBass(template: string, bar: Bar): string {
  const [first, second] = halves(bar);
  const steps = template.trim().split(/\s+/);
  const weightOf = (s: string) => Number(/@(\d+)$/.exec(s)?.[1] ?? 1);
  const total = steps.reduce((n, s) => n + weightOf(s), 0);
  let at = 0;
  return steps
    .map((step) => {
      const c = CHORD[at < total / 2 ? first : second];
      at += weightOf(step);
      return step.replace(/\{([rfo])\}/g, (_, k: "r" | "f" | "o") => c[k]);
    })
    .join(" ");
}

/** A section's bass line: one bar per chord (or pair), the kit's bar with the chord's notes filled in. */
function bassLine(id: SectionId, bar: BassBar): string {
  const prog = PROGRESSION[id];
  return bars(prog.map((b, i) => fillBass(typeof bar === "string" ? bar : bar(i, prog.length), b)));
}

/** A voicing of one bar: a stack, or two stacks in halves. */
const voiced = (b: Bar, of: (c: Chord) => string): string =>
  isSplit(b)
    ? halves(b)
        .map((n) => `[${of(CHORD[n])}]`)
        .join(" ")
    : of(CHORD[b as ChordName]);

/** A section's chords: one bar per chord, voiced by the kit's depth and the section's register. */
function chordLine(id: SectionId, depth: Kit["depth"]): string {
  const reg = HIGH.has(id) ? "high" : "low";
  return bars(PROGRESSION[id].map((b) => voiced(b, (c) => c[depth === "four" ? "four" : "triad"][reg])));
}

/** The held chords: triads in the middle register, a whole bar (or half) each. */
const padLine = (id: SectionId): string => bars(PROGRESSION[id].map((b) => voiced(b, (c) => c.triad.high)));

/** One flavour's song: the tune first, then the held chords, the chords, the bass and the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const mel = mapSections((id) => {
    const tune = MEL[id] as string;
    if (id === "solo") return `${tune}.s("${k.soloLead}")${syn?.solo ?? ""}`;
    return `${tune}.s("${k.sounds.lead}")${syn?.lead ?? ""}`;
  });
  const pad = mapSections((id) =>
    k.pad.has(id)
      ? `note("${padLine(id)}").s("${k.sounds.pad}")${syn?.pad ?? ".attack(.3).release(.6)"}`
      : null,
  );
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
    track("mel", mel, `${sw}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`),
    track("pad", pad, `${sw}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`),
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
  today: string,
): TakeStep => ({ lesson, kind: "take", sections, parts, startFrom: "oak", today });

export const U16_SONG = defineUnitSong({
  id: "usong.U16",
  unit: "U16",
  version: 1,
  title: "Borrowed light",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 88,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "pad", label: "pad", role: "pad", name: "Pad", plainName: "Held chords" },
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
  // By section (AUTHORING §23.6): every Make of U16 writes chords, bass and tune in one `const changes`, so each take
  // hands over whole sections and Oak keeps the drums there (a chord take silences Oak's pitched parts, so no
  // `oakKeeps`). Each Make has its own material, so each opens with its own starter.
  plan: [
    take(
      "U16.L01",
      ["verse1", "verse2"],
      ["lead", "chords", "bass"],
      "Your ballad loop, chords, bass and tune, plays both verses of the song.",
    ),
    take(
      "U16.L02",
      ["chorus1", "chorus2", "chorus3"],
      ["lead", "chords", "bass"],
      "Your eight bars of anthem become the chorus and play all three times it comes round.",
    ),
    take(
      "U16.L03",
      ["intro"],
      ["lead", "chords", "bass"],
      "Your riff opens the song: its first four bars play before the first verse.",
    ),
    take(
      "U16.L04",
      ["bridge"],
      ["lead", "pad", "chords", "bass"],
      "Your eight bars in A minor play the bridge, just before the last chorus.",
    ),
    take(
      "U16.L05",
      ["solo"],
      ["lead", "chords", "bass"],
      "Your Aura Lee on the tenor sax plays the solo after the second chorus, over chords you choose.",
    ),
  ],
  releaseAfter: "U16.L05",
});

export default U16_SONG;
