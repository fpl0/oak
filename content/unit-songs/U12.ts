// Song 12, "Seventh heaven" (docs/design/songs/makes-core-b.md "U12 song (seventh chords)"; AUTHORING §23). C major,
// 4/4, 88 BPM, 61 bars, with a bridge in A minor: the unit of seventh chords gets a soul song in which every chord is
// a seventh chord, from the first bar to the last.
//
//   intro 4         verse1 8            chorus1 8            verse2 8            chorus2 8
//   Dm7 Em7 F^7 G7  (C^7 Am7 Dm7 G7)×2  (F^7 Em7 Dm7 C^7)×2  (C^7 C7 F^7 G7)×2   = chorus1
//
//   bridge 8 (A minor)                     turn 4 (A harmonic minor)   chorus3 8    outro 4          end 1
//   Dm7 G7 C^7 F^7 Bm7b5 E7 Am7 Am7        Am7 F^7 Bm7b5 E7            = chorus1    Dm7 Em7 F^7 G7   C^7
//
// Each section is the loop of one lesson, so Oak plays the lesson's idea before the learner takes it over:
// - The verses are the soul loop of U12.L06 (and of U06.L10, U12.L01's hook), Cmaj7 Am7 Dm7 G7, and the turn of
//   U12.L02, Cmaj7 C7 Fmaj7 G7: the major seventh rests, the dominant seventh leans. Oak's tune shows the half step
//   that decides it: B over Cmaj7 in bar 1, B♭ over C7 in bar 2, and over G7 it holds F, which falls to E.
// - The choruses are U12.L01's walk down, Fmaj7 Em7 Dm7 Cmaj7, the chords in parallel root position. The hook sings
//   each chord's 7th, then its 5th and its 3rd, so its first notes fall a step a bar, E D C B.
// - The bridge is U12.L05's cycle, Dm7 G7 Cmaj7 Fmaj7 Bm7♭5 E7 Am7, which leaves C major and lands in A minor. Oak's
//   tune starts each of its first seven bars on a guide tone, the 3rd or the 7th (F F E E D D C), the thread of
//   U12.L05, and comes to rest on A.
// - The turn is U12.L03's torch song in A harmonic minor, Am7 Fmaj7 Bm7♭5 E7, the chords on every beat: the dark
//   seventh leads into E7, whose G♯ is in the tune; E7 then turns to Fmaj7 for the last chorus.
// - The opening and the ending climb the key's own sevenths by step, Dm7 Em7 Fmaj7 G7 (U12.L04's staircase), the
//   ending's tune starting its bars on the 7ths C D E F; one bar of Cmaj7, the tune on E, ends the song.
//
// Every flavour plays the same notes (tune, bass roots on every downbeat, chord roots and qualities). The song's chords
// are seventh chords in every flavour, because sevenths are this unit's harmony (every U12 starter writes them in
// every flavour), not a kit's colour; a flavour may add a 9th where its kit colours chords (jazz-soul from U03, funk
// from U06: Cmaj9, C9, G9), and swings as its kit's staging allows (jazz-soul from U03; the others straight). Wherever
// a chord is struck, its root is lowest in the chord or the bass is sounding its root (Am7 is voiced C E G A, which
// reads as C6 on its own). The tune and the bass hold no note a half step above a sounding chord tone (AUTHORING §13):
// no C over Cmaj7, G7 or Em7, no F over Cmaj7, Fmaj7, Am7, Em7 or E7. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top. Every claim here is read off the evaluated events
// (content/validate/unit-songs.ts, and the scratch audit of the task report).
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
  // U12.L05's cycle (its Make is in A minor) and U12.L03's torch song (its Make is in A harmonic minor): the bridge,
  // in two halves with a key each.
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "A", mode: "minor" } },
  { id: "turn", type: "bridge", bars: 4, key: { tonic: "A", mode: "harmonic minor" } },
  { id: "chorus3", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
  // One bar of Cmaj7: the staircase stops on G7, and the record lands home.
  { id: "end", type: "outro", bars: 1 },
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
/** A section's own exception first (`null` included: the part rests there), else its kind's. */
const pick = <T>(by: ByKind<T>, id: SectionId): T =>
  by.only !== undefined && id in by.only ? (by.only[id] as T) : by[kindOf(id)];

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `melBridge2` for the second bridge section), `silence` where it rests, and one `arrange()` over every
 * section of the song.
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
// One chord a bar. The verses, the bridge and the turn are voiced close and low (B2 to E4), each voice moving a step
// or two: Cmaj7 C E G B, Am7 C E G A, Dm7 C D F A, G7 B D F G, C7 C E G B♭, Bm7♭5 B D F A, E7 B D E G♯; Fmaj7 is
// always F A C E, its 7th above its root, so no E sits under an F (the learner's own Fmaj7 has F3 lowest).
// The choruses, the opening and the ending move the chords in parallel root position, a seventh chord on each
// step (Fmaj7 F A C E down to Cmaj7 C E G B; Dm7 D F A C up to G7 G B D F): the walk and the staircase are heard as
// one shape moving. The last chord is open, C G B E. Jazz-soul and funk add the 9th to the major and dominant sevenths
// of the verses and the end (Cmaj9, C9, G9); never to a minor seventh, whose 9th would sit a half step under the
// tune's minor 3rd. Bass roots: C2 A1 D2 G2 F2 E2 B1, so the verse falls a 3rd and climbs by 4ths, the walk falls by
// step F E D C, and the staircase climbs D E F G.

type ChordName = "Cmaj7" | "Am7" | "Dm7" | "G7" | "Fmaj7" | "Em7" | "C7" | "Bm7b5" | "E7";
interface Chord {
  /** Bass notes: root, fifth, third, octave. */
  r: string;
  f: string;
  t: string;
  o: string;
  /** Close and low (verses, bridge, turn). */
  low: string;
  /** Root position (choruses, opening, ending). */
  high: string;
  /** With the 9th (jazz-soul and funk), low only; absent: as `low`. */
  nine?: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  Cmaj7: {
    r: "c2",
    f: "g2",
    t: "e2",
    o: "c3",
    low: "c3,e3,g3,b3",
    high: "c3,e3,g3,b3",
    nine: "c3,e3,g3,b3,d4",
  },
  Am7: { r: "a1", f: "e2", t: "c2", o: "a2", low: "c3,e3,g3,a3", high: "c3,e3,g3,a3" },
  Dm7: { r: "d2", f: "a2", t: "f2", o: "d3", low: "c3,d3,f3,a3", high: "d3,f3,a3,c4" },
  G7: { r: "g2", f: "d3", t: "b2", o: "g3", low: "b2,d3,f3,g3", high: "g3,b3,d4,f4", nine: "b2,d3,f3,g3,a3" },
  Fmaj7: { r: "f2", f: "c3", t: "a2", o: "f3", low: "f3,a3,c4,e4", high: "f3,a3,c4,e4" },
  Em7: { r: "e2", f: "b2", t: "g2", o: "e3", low: "e3,g3,b3,d4", high: "e3,g3,b3,d4" },
  C7: {
    r: "c2",
    f: "g2",
    t: "e2",
    o: "c3",
    low: "c3,e3,g3,bb3",
    high: "c3,e3,g3,bb3",
    nine: "c3,e3,g3,bb3,d4",
  },
  Bm7b5: { r: "b1", f: "f2", t: "d2", o: "b2", low: "b2,d3,f3,a3", high: "b2,d3,f3,a3" },
  E7: { r: "e2", f: "b2", t: "g#2", o: "e3", low: "b2,d3,e3,g#3", high: "b2,d3,e3,g#3" },
};
const SOUL: ChordName[] = ["Cmaj7", "Am7", "Dm7", "G7"];
const LEAN: ChordName[] = ["Cmaj7", "C7", "Fmaj7", "G7"];
const WALK: ChordName[] = ["Fmaj7", "Em7", "Dm7", "Cmaj7"];
const STAIRS: ChordName[] = ["Dm7", "Em7", "Fmaj7", "G7"];
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: STAIRS,
  verse1: [...SOUL, ...SOUL],
  chorus1: [...WALK, ...WALK],
  verse2: [...LEAN, ...LEAN],
  chorus2: [...WALK, ...WALK],
  bridge: ["Dm7", "G7", "Cmaj7", "Fmaj7", "Bm7b5", "E7", "Am7", "Am7"],
  turn: ["Am7", "Fmaj7", "Bm7b5", "E7"],
  chorus3: [...WALK, ...WALK],
  outro: STAIRS,
  end: ["Cmaj7"],
};
/** The sections whose chords move in parallel root position. */
const HIGH = new Set<SectionId>(["intro", "chorus1", "chorus2", "chorus3", "outro"]);
/** The last chord, open: C G B E (with the 9th: C G B D E). */
const END = { plain: "c3,g3,b3,e4", nine: "c3,g3,b3,d4,e4" };

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eight eighth notes to a bar (`@` holds). The verse talks low (E4 to E5), each bar a pickup into a held chord
// tone, B over Cmaj7, C over Am7, B over G7; its answer climbs to E5 and stops open on D over G7, a step under the
// chorus's first note. The second verse leans: B♭ over C7, F over G7 falling to the next bar's E. The hook gives each
// bar of the walk its 7th, 5th and 3rd (E C A, D B G, C A F, B G E), then climbs and comes home on E over Cmaj7. Its
// rhythm (a long note, a short one, a held one) returns in the bridge, the turn and the ending. The bridge starts its
// first seven bars on guide tones, holds G♯ over E7 and comes to rest on A; the turn sings the hook's first bar over
// Am7 and holds G♯ over E7; the ending starts each bar of the staircase on its 7th (C, D, E, F), and the last bar
// holds E over Cmaj7.

const V1 = [
  "~ e4 g4 b4@2 a4 g4@2",
  "~ e4 g4 c5@2 b4 a4@2",
  "~ f4 a4 c5@2 d5 c5 a4",
  "b4@4 a4 g4@3",
  "~ e4 g4 b4@2 d5 e5@2",
  "~ e5 d5 c5@2 a4 g4@2",
  "~ f4 a4 c5@2 a4 f4@2",
  "g4@2 b4@2 d5@4",
];
const V2 = [
  "~ e4 g4 b4@2 a4 g4@2",
  "~ e4 g4 bb4@2 a4 g4@2",
  "~ a4 c5 e5@2 d5 c5 a4",
  "d5@2 b4@2 f4@4",
  "~ e4 g4 b4@2 d5 e5@2",
  "~ e5 d5 bb4@2 a4 g4@2",
  "~ a4 c5 e5@2 c5 a4@2",
  "g4@2 b4@2 d5@4",
];
const HOOK = [
  "e5@3 c5 a4@4",
  "d5@3 b4 g4@4",
  "c5@3 a4 f4@4",
  "b4@3 g4 e4@4",
  "e5@3 c5 a4@2 c5 e5",
  "g5@3 e5 d5@2 b4@2",
  "f5@3 d5 a4@2 c5@2",
  "b4@2 d5@2 e5@4",
];
const BRIDGE = [
  "f5@4 e5 d5 c5 a4",
  "f5@3 d5 b4@4",
  "e5@4 d5 b4 g4@2",
  "e5@3 c5 a4@4",
  "d5@4 a4@2 f4@2",
  "d5@3 b4 g#4@4",
  "c5@4 b4 a4 g4 e4",
  "a4@8",
];
const TORCH = ["e5@3 c5 a4@4", "g5@3 e5 c5@4", "f5@3 d5 b4@4", "e5@2 d5@2 g#4@4"];
const STAIRS_TUNE = ["c5@3 a4 f4@4", "d5@3 b4 g4@4", "e5@3 c5 a4@4", "f5@3 d5 b4@4"];

const MEL: BySection = {
  // The opening waits two bars, then sings the hook's first two cells over Fmaj7 and G7.
  intro: `note("${bars(["~", "~", "e5@3 c5 a4@4", "d5@3 b4 g4@2 ~@2"])}")`,
  verse1: `note("${bars(V1)}")`,
  chorus1: `note("${bars(HOOK)}")`,
  verse2: `note("${bars(V2)}")`,
  chorus2: `note("${bars(HOOK)}")`,
  bridge: `note("${bars(BRIDGE)}")`,
  turn: `note("${bars(TORCH)}")`,
  chorus3: `note("${bars(HOOK)}")`,
  outro: `note("${bars(STAIRS_TUNE)}")`,
  end: `note("${bars(["e5@8"])}")`,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

/**
 * A bass bar: `{r}` root, `{f}` fifth, `{t}` third, `{o}` octave of the bar's chord, or `~` for a bar of rest. A
 * function gets the bar's index in its section and the section's length.
 */
type BassBar = string | ((i: number, n: number) => string);

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the verses and the bridge). */
  banks?: Partial<Record<SectionId, string>>;
  /** Jazz-soul and funk add the 9th to the major and dominant sevenths of the verses and the end. */
  nines: boolean;
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; chords: string; lead: string; pad: string };
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
  /** The pad's rhythm: held a bar (`x`), or struck on every beat to swell after each kick (electronic). */
  padStruct: string;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines' fx. */
  synth?: {
    bassSound: ByKind<string>;
    bass: ByKind<string>;
    chords: ByKind<string>;
    lead: string;
    pad: string;
  };
}

/** The opening brings the bass in at its second bar. */
const IN_AT_2 =
  (bar: string): BassBar =>
  (i) =>
    i === 0 ? "~" : bar;

/**
 * Pop: the default kit, piano, picked bass, piano tune, strings holding the chords. A soul ballad: the kick and the bass
 * lock on 1, the "and" of 2 and 3, the piano with them; the choruses push in 3-3-2 over eighth-note bass.
 */
const POP: Kit = {
  bank: "",
  nines: false,
  swing: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", pad: "strings" },
  gain: { kick: 0.32, snare: 0.14, hats: 0.09, perc: 0.08, bass: 0.61, chords: 0.2, lead: 0.48, pad: 0.1 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<~ [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ bd bd ~ ~ ~] [bd ~ ~ bd bd ~ ~ ~]>"),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd bd ~ bd ~"),
    bridge: v("bd ~ ~ ~ ~ ~ bd ~"),
    outro: v("bd ~ ~ bd bd ~ ~ ~"),
    only: {
      turn: v("<[bd ~ ~ ~ bd ~ ~ ~]!3 [bd ~ bd ~ bd bd bd bd]>"),
      end: v("bd"),
    },
  },
  snare: {
    intro: v("<~ ~ [~ sd ~ sd] [~ sd ~ [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!3 [~ sd [~ sd] [sd sd]]>"),
    only: { turn: v("<[~ rim ~ rim]!3 [~ sd [sd sd] [sd sd sd sd]]>"), end: null },
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh hh oh]*2", V8),
    bridge: null,
    outro: v("hh*8", V8),
    only: { turn: null, end: null },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    outro: v("<cr ~ ~ ~>"),
    only: {
      verse2: v("<[cr, [~ sh]*4] [[~ sh]*4]!3>"),
      turn: v("<cr ~ ~ ~>"),
      // The second chorus: the tambourine moves to the off-beats in its last four bars.
      chorus2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
      chorus3: v("<[cr, tb*8] [tb*8]!3>"),
      end: v("cr"),
    },
  },
  bass: {
    intro: IN_AT_2("{r}@3 {r} {r}@4"),
    verse: "{r}@3 {r} {r}@3 {o}",
    chorus: "{r} {r} {r} {r} {r} {r} {r} {o}",
    bridge: "{r}@6 {f}@2",
    outro: "{r}@3 {r} {r}@3 {o}",
    only: { turn: "{r}@4 {r}@4", end: "{r}@8" },
  },
  comp: {
    intro: "<x x [x ~ ~ x x ~ ~ ~] [x ~ ~ x x ~ ~ ~]>",
    verse: "x ~ ~ x x ~ ~ ~",
    chorus: "x@3 x@3 x@2",
    bridge: "x ~ ~ ~ x ~ ~ ~",
    outro: "x ~ ~ x x ~ ~ ~",
    only: { turn: "x ~ x ~ x ~ x ~", end: "x" },
  },
  padStruct: "x",
};

/**
 * Indie: the rock kit, clean guitar, picked bass, acoustic guitar tune, an organ holding the chords. The verses push in
 * 3-3-2 with the snare on 3; the choruses go four on the floor with an octave bass; the bridge rolls on the floor tom.
 */
const INDIE: Kit = {
  bank: "rockkit",
  nines: false,
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", pad: "organ" },
  gain: { kick: 0.46, snare: 0.42, hats: 0.28, perc: 0.24, bass: 0.61, chords: 0.43, lead: 0.89, pad: 0.17 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<~ [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~]>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus: v("bd*4"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    outro: v("bd ~ ~ bd ~ ~ bd ~"),
    only: { turn: v("<[bd ~ ~ ~ bd ~ ~ ~]!3 [bd ~ bd ~ bd bd bd bd]>"), end: v("bd") },
  },
  snare: {
    intro: v("<~ ~ [~ ~ sd ~] [~ ~ sd [sd sd]]>"),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!7 [~ ~ rim [sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 [~ ~ sd [sd sd]]>"),
    only: { turn: v("<[~ rim ~ rim]!3 [~ sd [sd sd] [sd sd sd sd]]>"), end: null },
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh oh]*4", V8),
    bridge: null,
    outro: v("hh*8", V8),
    only: { turn: null, end: null },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    // The bridge rolls on the floor tom under the guitar's long chords.
    bridge: v("<[cr, [lt ~ lt lt ~ lt ~ ~]] [lt ~ lt lt ~ lt ~ ~]!7>"),
    outro: v("<cr ~ ~ ~>"),
    only: {
      verse2: v("<[cr, [~ tb]*2] [[~ tb]*2]!3>"),
      turn: v("<cr ~ ~ ~>"),
      // The second chorus: the tambourine moves to the off-beats in its last four bars.
      chorus2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
      chorus3: v("<[cr, tb*8] [tb*8]!3>"),
      end: v("cr"),
    },
  },
  bass: {
    intro: IN_AT_2("{r}@3 {r}@3 {r}@2"),
    verse: "{r}@3 {r}@3 {r}@2",
    chorus: "[{r} {o}]*4",
    bridge: "{r}@8",
    outro: "{r}@3 {r}@3 {r}@2",
    only: { turn: "{r}@4 {r}@4", end: "{r}@8" },
  },
  comp: {
    intro: "<x x [x@3 x@3 x@2] [x@3 x@3 x@2]>",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    bridge: "x",
    outro: "x@3 x@3 x@2",
    only: { turn: "x ~ x ~ x ~ x ~", end: "x" },
  },
  padStruct: "x",
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A Rhodes comp on beat 1 and the "and" of 2 (the Charleston), both while the bass holds the root. */
const JAZZ_COMP = "x [~ x] ~ ~";

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, strings holding the chords. Swung eighths, the 9th on the
 * major and dominant sevenths of the verses (from U03, FLAVOUR_RULES). Cross-stick and the hi-hat on 2 and 4 in the
 * verses, the snare and the ride in the choruses; the bass plays root and fifth in two, and walks root, root, fifth,
 * third in the choruses; the Rhodes comps the Charleston, struck only while the bass holds the root.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  nines: true,
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", pad: "strings" },
  gain: { kick: 0.22, snare: 0.35, hats: 0.22, perc: 0.22, bass: 0.72, chords: 0.41, lead: 0.53, pad: 0.16 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ [bd ~ ~ ~] [bd ~ bd ~] [bd ~ bd ~]>"),
    verse: v("bd ~ bd ~"),
    chorus: v("bd ~ bd ~"),
    bridge: v("bd ~ ~ ~"),
    outro: v("bd ~ bd ~"),
    only: { turn: v("<[bd ~ bd ~]!3 [bd bd bd bd]>"), end: v("bd") },
  },
  snare: {
    intro: v("<~ ~ [~ rim ~ rim] [~ rim ~ [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    // Half time: the snare on 3.
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ rim ~ rim]!3 [~ rim [~ sd] [sd sd]]>"),
    only: { turn: v("<[~ rim ~ rim]!3 [~ sd [sd sd] [sd sd sd sd]]>"), end: null },
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("~ hh ~ hh"),
    verse: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    outro: v("~ hh ~ hh"),
    only: { end: null },
  },
  perc: {
    intro: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    chorus: v("<[cr, rd*8] [rd*8]!3>", V8),
    // The ride in quarters.
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    only: {
      turn: v("<[cr, rd*4] [rd*4]!3>"),
      // The second chorus: the tambourine joins the ride on 2 and 4 in its last four bars.
      chorus2: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8, [~ tb]*2] [rd*8, [~ tb]*2]!3>", V8),
      chorus3: v("<[cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!3>"),
      end: v("cr"),
    },
  },
  bass: {
    intro: IN_AT_2("{r}@2 {f}@2"),
    verse: "{r}@2 {f}@2",
    chorus: "{r} {r} {f} {t}",
    bridge: "{r}@2 {f}@2",
    outro: "{r}@2 {f}@2",
    only: { turn: "{r} {r} {r} {r}", end: "{r}@4" },
  },
  comp: {
    intro: `<x x [${JAZZ_COMP}] [${JAZZ_COMP}]>`,
    verse: JAZZ_COMP,
    chorus: JAZZ_COMP,
    bridge: "x",
    outro: JAZZ_COMP,
    only: { turn: "x x x x", end: "x" },
  },
  padStruct: "x",
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
const FK_HALF = "bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~";

/**
 * Funk: Oak's 808, clavinet, finger bass, organ tune, strings holding the chords. Straight sixteenths, the 9th on the
 * major and dominant sevenths of the verses (from U06). The turn struts on quarter-note stabs over a half-time kick.
 */
const FUNK: Kit = {
  bank: "oak808",
  nines: true,
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", pad: "strings" },
  gain: { kick: 0.35, snare: 0.25, hats: 0.15, perc: 0.13, bass: 0.73, chords: 0.7, lead: 0.66, pad: 0.22 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<~ [${FK_HALF}] [${FK_KICK_V}] [${FK_KICK_V}]>`),
    verse: v(FK_KICK_V),
    chorus: v(FK_KICK_C),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    outro: v(FK_KICK_V),
    only: {
      turn: v(`<[${FK_HALF}]!3 [bd ~ ~ ~ bd ~ ~ ~ bd ~ bd ~ bd ~ bd ~]>`),
      end: v("bd"),
    },
  },
  snare: {
    intro: v(`<~ ~ [${FK_BACKBEAT}] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    bridge: v("<[~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~]!7 [~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ sd sd sd sd]>"),
    outro: v(`<[${FK_BACKBEAT}]!3 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    only: {
      turn: v("<[~ ~ ~ ~ rim ~ ~ ~ ~ ~ ~ ~ rim ~ ~ ~]!3 [~ ~ ~ ~ sd ~ ~ ~ sd ~ sd ~ sd sd sd sd]>"),
      end: null,
    },
  },
  hats: {
    intro: v("hh*16", V16),
    verse: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    bridge: v("hh*8", V8),
    outro: v("hh*16", V16),
    only: { turn: v("[~ hh]*4"), end: null },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    bridge: v("<cr ~!7>"),
    outro: v("<cr ~ ~ ~>"),
    only: {
      verse2: v("<[cr, sh*8] [sh*8]!3>", V8),
      turn: v("<cr ~ ~ ~>"),
      // The second chorus: a shaker on the off-beats joins the cowbell in its last four bars.
      chorus2: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb], [~ sh]*4] [[~ cb ~ cb], [~ sh]*4]!3>"),
      chorus3: v("<[cr, [~ cb]*4] [[~ cb]*4]!3>"),
      end: v("cr"),
    },
  },
  bass: {
    intro: IN_AT_2(FK_BASS_V),
    verse: FK_BASS_V,
    chorus: FK_BASS_C,
    // The 5th on the "and" of 3, with the kick.
    bridge: "{r}@10 {f}@6",
    outro: FK_BASS_V,
    only: { turn: "{r}@8 {r}@8", end: "{r}@16" },
  },
  comp: {
    intro: `<x x [${FK_CLAV_V}] [${FK_CLAV_V}]>`,
    verse: FK_CLAV_V,
    chorus: FK_CLAV_C,
    bridge: "x ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~",
    outro: FK_CLAV_V,
    only: { turn: "x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~", end: "x" },
  },
  // The Rhodes holds the bridge's long chords; the clavinet stabs everywhere else.
  chordSound: { bridge: "rhodes" },
  padStruct: "x",
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. Every eighth of the acid bar sounds the root or its
// octave, so each stab and each pad chord has its root under it.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {r}";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The last chorus: the acid's filter envelope opens wider over its eight bars. */
const ACID_RISING =
  '.lpq(12).ftype("ladder").lpenv(saw.range(1.5, 5).slow(8)).lpd(.14).lps(0).decay(.2).sustain(.4)';
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
const PAD =
  ".unison(5).detune(.2).attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: Oak's 909 in the opening, the choruses and the ending; the lo-fi kit in the verses, the bridge and the
 * turn, where a boom-bap beat sits over a sine sub and off-beat stabs (88 BPM is lo-fi's own tempo). The choruses go
 * four on the floor with the acid line, pumping stabs and a supersaw pad swelling after every kick; the last chorus
 * opens the acid's filter over eight bars. The turn pulses its stabs on every beat. A square pluck with a dotted-eighth
 * echo plays the tune. Straight, plain sevenths (four-note chords from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", bridge: "lofikit", turn: "lofikit" },
  nines: false,
  swing: "",
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", pad: "supersaw" },
  gain: { kick: 0.33, snare: 0.16, hats: 0.11, perc: 0.1, bass: 0.65, chords: 0.3, lead: 0.43, pad: 0.17 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ [bd ~ ~ ~ bd ~ ~ ~] bd*4 bd*4>"),
    verse: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus: v("bd*4"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    outro: v("bd*4"),
    // On 1 and 3, with the sub.
    only: { turn: v("<[bd ~ ~ ~ bd ~ ~ ~]!3 [bd ~ bd ~ bd bd bd bd]>"), end: v("bd") },
  },
  snare: {
    intro: v("<~ ~ [~ cp ~ cp] [~ cp ~ [cp cp]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ cp ~ cp]!3 [~ cp [~ cp] [cp cp]]>"),
    only: { turn: v("<[~ rim ~ rim]!3 [~ sd [sd sd] [sd sd sd sd]]>"), end: null },
  },
  hats: {
    intro: v("[~ hh]*4", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh oh hh]*4", V16),
    bridge: v("~ hh ~ hh"),
    outro: v("[hh hh oh hh]*4", V16),
    only: { turn: null, end: null },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!3>"),
    bridge: v("<cr ~!7>"),
    outro: v("<cr ~ ~ ~>"),
    only: {
      turn: v("<cr ~ ~ ~>"),
      // The second chorus: a shaker in eighths joins the ride in its last four bars.
      chorus2: v("<[cr, [~ rd]*4] [[~ rd]*4]!3 [cr, [~ rd]*4, sh*8] [[~ rd]*4, sh*8]!3>"),
      chorus3: v("<[cr, rd*8] [rd*8]!3>", V8),
      end: v("cr"),
    },
  },
  bass: {
    intro: IN_AT_2("{r}"),
    // The sub locks with the lo-fi kick: 1 and the "and" of 3.
    verse: "{r}@10 {r}@6",
    chorus: ACID_BAR,
    bridge: "{r}@10 {r}@6",
    outro: ACID_BAR,
    only: { turn: "{r}@8 {r}@8", end: "{r}" },
  },
  comp: {
    intro: "<x x [~ x]*4 [~ x]*4>",
    verse: "[~ x]*4",
    chorus: "x*8",
    bridge: "[~ x]*2",
    outro: "x*8",
    only: { turn: "x x x x", end: "x" },
  },
  chordSound: { intro: "supersaw", end: "supersaw" },
  padStruct: "x x x x",
  synth: {
    bassSound: {
      intro: "sine",
      verse: "sine",
      chorus: "sawtooth",
      bridge: "sine",
      outro: "sawtooth",
      only: { end: "sine" },
    },
    bass: {
      intro: SUB,
      verse: SUB,
      chorus: ACID,
      bridge: SUB,
      outro: ACID,
      only: { turn: SUB, chorus3: ACID_RISING, end: SUB },
    },
    chords: {
      intro: ".attack(.2).decay(1).sustain(.6).lpf(1400)",
      verse: STAB,
      chorus: `${STAB}${PUMP}`,
      bridge: STAB,
      outro: `${STAB}${PUMP}`,
      only: { end: ".attack(.05).decay(2).sustain(.5).lpf(1600)" },
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.51).delayfeedback(.35)",
    pad: PAD,
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

/** A section's bass line: one bar per chord, the kit's bar with the chord's notes filled in. */
function bassLine(id: SectionId, bar: BassBar): string {
  const chords = PROGRESSION[id];
  const out = chords.map((name, i) => {
    const c = CHORD[name];
    const text = typeof bar === "string" ? bar : bar(i, chords.length);
    return text.replace(/\{([rfto])\}/g, (_, k: "r" | "f" | "t" | "o") => c[k]);
  });
  return bars(out);
}

/** A section's chords: one bar per chord, voiced for the section's register (and the kit's 9ths). */
function voicings(id: SectionId, nines: boolean): string {
  if (id === "end") return bars([nines ? END.nine : END.plain]);
  return bars(
    PROGRESSION[id].map((name) => {
      const c = CHORD[name];
      if (HIGH.has(id)) return c.high;
      return nines ? (c.nine ?? c.low) : c.low;
    }),
  );
}

/** Where the pad holds the chords: the opening, the choruses, the bridge and the last bar. */
const PADDED = new Set<SectionId>(["intro", "chorus1", "chorus2", "bridge", "chorus3", "end"]);

/** One flavour's song: the tune first, then the pad, the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${voicings(id, k.nines)}").struct("${pick(k.comp, id)}").s("${sound}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const pad = mapSections((id) =>
    PADDED.has(id) ? `note("${voicings(id, k.nines)}").struct("${k.padStruct}")` : null,
  );
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
      "pad",
      pad,
      `${sw}.s("${k.sounds.pad}")${syn?.pad ?? ".attack(.3).release(.6)"}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`,
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
  oakKeeps?: SongPartId[],
): TakeStep => ({
  lesson,
  kind: "take",
  sections,
  parts,
  ...(oakKeeps ? { oakKeeps } : {}),
  startFrom,
  today,
});

/** Every U12 Make writes chords, a bass and a tune: each take hands over whole sections, and Oak keeps the drums. */
const PITCHED: SongPartId[] = ["lead", "chords", "bass"];

export const U12_SONG = defineUnitSong({
  id: "usong.U12",
  unit: "U12",
  version: 2,
  title: "Seventh heaven",
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
  // By section (AUTHORING §23.6): every U12 Make writes its own chords, bass and tune, so each take hands over whole
  // sections (its chords silence Oak's tune, pad and bass there) and Oak keeps the drums. Each lesson takes the section
  // whose loop it writes, so the song grows by a section or more a lesson and no take is overwritten.
  plan: [
    take(
      "U12.L01",
      ["chorus1", "chorus2", "chorus3"],
      PITCHED,
      "oak",
      "Your walk from F down to C, in sevenths, becomes all three choruses of the song.",
    ),
    take(
      "U12.L02",
      ["verse2"],
      PITCHED,
      "oak",
      "Your four bars that rest and lean play the second verse of the song.",
    ),
    take(
      "U12.L03",
      ["turn"],
      PITCHED,
      "oak",
      "Your torch song in A minor plays the last four bars of the bridge, before the last chorus.",
    ),
    take(
      "U12.L04",
      ["intro", "outro"],
      PITCHED,
      "oak",
      "Your loop of C major's own sevenths opens the song and plays its outro.",
    ),
    take(
      "U12.L05",
      ["bridge"],
      PITCHED,
      "oak",
      "Your tune over eight seventh chords plays the first eight bars of the bridge, with Oak's held chords.",
      ["pad"],
    ),
    take(
      "U12.L06",
      ["verse1"],
      PITCHED,
      "oak",
      "Your trio, with the chords for the left hand, plays the first verse of the song.",
    ),
  ],
  // U12 has no checkpoint of its own (U13.CP covers U12 and U13) and no capstone: the song is released after its last
  // lesson, as U08's is (AUTHORING §23.6).
  releaseAfter: "U12.L06",
});

export default U12_SONG;
