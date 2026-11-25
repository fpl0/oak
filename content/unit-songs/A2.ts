// Song A2, "Room to breathe" (docs/design/songs/makes-core-c.md §4 "A Arrangement & Sound" and §4.1, A2: "an
// A-minor song, 90, verse/chorus; L01 registers → L02 chorus density → L03 counter-melody → L04 break → L05 mix → L06
// two styles"; AUTHORING §23). A minor, 4/4, 90 BPM, 64 bars (2:51): the arranging unit gets a song whose verses,
// break, ballad and drive all stand on the A2 loop, Am F C G, so the record is made by how the parts are arranged.
//
//   intro 4 | verse1 8 | chorus1 8 | verse2 8 | chorus2 8 | break 8 | ballad 8 | drive 8 | outro 4
//   Am F C G | (Am F C G)×2 | F G Am C F G E E | (Am F C G)×2 | F G Am C F G E E | (Am F C G)×2 ×3 | F G Am Am
//
// Each section shows the idea of the lesson that takes it, in Oak's own parts, before the learner takes it:
// - verse1 (A2.L01, registers): the bass under C3, the chords from C3 to E4 (the A2 loop's own close triads, A3 C4 E4 |
//   F3 A3 C4 | C3 E3 G3 | G3 B3 D4), the tune above them from G4 up; nothing crowds the low end.
// - chorus1 (A2.L02, density): the verse is thin (the chords three times a bar, the bass on the one, no pad), the
//   chorus thick (the chords in eighths, the bass busy, a held pad, a crash), and its hook climbs to A5 over F G Am C,
//   landing on E, the V that pulls back home.
// - verse2 (A2.L03, counter-melody): the verse with a second tune under it (A3–E4) that starts its notes in the
//   tune's gaps and rises where the tune falls: the A2.L03 strings line, A3 C4 | A3 C4 | C4 E4 | B3 G3.
// - chorus2 (A2.L05, mix): the chorus with a held line (A4 B4 C5 C5 A4 B4 B4 G♯4) on its own side under the hook.
// - break (A2.L04, sampling): the band drops to a bass and two chord stabs a bar under a recorded drum break, cut into
//   pieces and played in new orders (the kick again, the snare moved, a stutter into the last beat), with found sounds
//   (snaps, a swoosh, an impact, a scratch) in the gaps; the tune comes back for its last four bars. Each style picks
//   its own break and fits it to the bar with `.splice()`: boom-bap (pop, recorded at 90), funk (indie, funk, 100),
//   lo-fi (jazz-soul, 80), and in the electronic style the jungle break at its own speed over the half-time song (both
//   of its bars in one of ours: 170 against 2 × 90).
// - ballad and drive (A2.L06, one tune in two styles): the A2 tune twice, first as a ballad (a kick on the one, a rim
//   click, a held pad, the tune on a soft sound: kalimba in indie and electronic), then driven (four on the floor, an
//   eighth-note bass, chord stabs off the beat, the tune doubled an octave up: glockenspiel in pop and indie, marimba
//   in jazz-soul, disco strings in funk, a supersaw in electronic; pop's stabs are a marimba).
// - intro and outro are Oak's: the chords on a pad with the band coming in, and the hook's F G into A minor at the end.
//
// The tune (Oak's, the A2 loop's own: E C A | C A | E C E | B G, every note a beat long and a tone of its chord) is
// the verses', the ballad's and the drive's; its answer ends E D C | B D, open, on the G chord. The drive plays the
// tune twice, with no answer, as A2.L06's four-bar loop does, so its octave double stays exact under the learner's take. Every note held a beat or
// more by the tune, the second tune or the bass is a tone of its chord; the hook's eighths between them (G5 and F5 over
// F, G5 and E5 over A minor, A5 over G) are passing notes. Chord colour follows the kit staging (contracts §5.10):
// pop and indie play triads; jazz-soul (swung, 1/3), funk and electronic play four-note chords, Am7 F6 Cadd9 E7 and a G
// with its root doubled (G6 would read as Em7 over a passing bass note). F6 has no E and Cadd9 no B, so no chord sits
// a half step under a tune note; wherever a four-note chord or the pad is struck, the bass sounds its root.
//
// One builder writes all five flavours (AUTHORING §23.2), so the tune, the bass downbeats and the chord roots cannot
// drift. Gains start from U10's levelled kits (the pad from U12's); packages/strudel/e2e/songs.pw.ts levels them
// (budget sound-songs.json), so the learner's line sits on top. Every claim here is read off the evaluated events
// (content/validate/unit-songs.ts).
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
  { id: "break", type: "break", bars: 8 },
  { id: "ballad", type: "ballad", bars: 8 },
  { id: "drive", type: "drive", bars: 8 },
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
 * (`melChorus`; `percVerse2` for a second verse that plays something else), `silence` where it rests, and one
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
// One chord a bar. The verses, the break, the ballad, the intro and the ending voice the chords as the A2 loop does,
// close and from C3 up (A2.L01: a close chord below C3 turns to mud); the choruses and the drive lift them to G3–G4
// under a hook that sits round A5.

type ChordName = "Am" | "F" | "C" | "G" | "E";
interface Chord {
  /** Major or minor: which third the bass walks through. */
  minor: boolean;
  triad: { low: string; high: string };
  four: { low: string; high: string };
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  Am: {
    minor: true,
    triad: { low: "a3,c4,e4", high: "a3,c4,e4" },
    four: { low: "g3,a3,c4,e4", high: "g3,a3,c4,e4" },
  },
  F: {
    minor: false,
    triad: { low: "f3,a3,c4", high: "a3,c4,f4" },
    four: { low: "f3,a3,c4,d4", high: "a3,c4,d4,f4" },
  },
  C: {
    minor: false,
    triad: { low: "c3,e3,g3", high: "g3,c4,e4" },
    four: { low: "c3,e3,g3,d4", high: "g3,c4,d4,e4" },
  },
  G: {
    minor: false,
    triad: { low: "g3,b3,d4", high: "g3,b3,d4" },
    four: { low: "g3,b3,d4,g4", high: "g3,b3,d4,g4" },
  },
  E: {
    minor: false,
    triad: { low: "g#3,b3,e4", high: "g#3,b3,e4" },
    four: { low: "g#3,b3,d4,e4", high: "g#3,b3,d4,e4" },
  },
};

const LOOP: ChordName[] = ["Am", "F", "C", "G"];
const CHORUS: ChordName[] = ["F", "G", "Am", "C", "F", "G", "E", "E"];
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: LOOP,
  verse1: [...LOOP, ...LOOP],
  chorus1: CHORUS,
  verse2: [...LOOP, ...LOOP],
  chorus2: CHORUS,
  break: [...LOOP, ...LOOP],
  ballad: [...LOOP, ...LOOP],
  drive: [...LOOP, ...LOOP],
  outro: ["F", "G", "Am", "Am"],
};
/** The bass's root, low: the A2 loop's own (A1 F1 C2 G1), and E1 for the chorus's V. */
const ROOT: Readonly<Record<ChordName, string>> = { Am: "a1", F: "f1", C: "c2", G: "g1", E: "e1" };
/** The choruses and the drive sit higher; everything else from C3 up. */
const HIGH = new Set<SectionId>(["chorus1", "chorus2", "drive"]);

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

const STEPS: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SHARP = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const midiOf = (name: string): number => {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + (STEPS[m[1] as string] as number) + acc;
};
const nameOf = (midi: number): string => `${SHARP[midi % 12] as string}${Math.floor(midi / 12) - 1}`;

// ---- The tunes (every flavour) ------------------------------------------------------------------------------
//
// The A2 tune: four quarter-note bars, each note a tone of its chord (E C A over Am, C A over F, E C E over C, B G
// over G). Its answer keeps the first two bars, steps down E D C over C and stops open on D over G, with a pickup C
// into bar 7. The hook (eight eighths a bar, `@` holds) climbs C F A over F and C E A over Am, falls G D B over G and
// E C G over C, and lands G♯ E B over E. The ending is the tune's F and G bars, then E C and a passing B (an
// eighth, so no B is held over the A minor chord's C), A.

const TUNE = ["e5 ~ c5 a4", "c5 ~ a4 ~", "e5 c5 e5 ~", "b4 ~ g5 ~"];
const ANSWER = ["e5 ~ c5 a4", "c5 ~ a4 [~ c5]", "e5 d5 c5 ~", "b4 ~ d5@2"];
const VERSE = [...TUNE, ...ANSWER];
const HOOK = [
  "~ c5 f5 a5@3 g5 f5",
  "g5@3 d5@3 b4@2",
  "~ c5 e5 a5@3 g5 e5",
  "e5@3 c5@3 g4@2",
  "~ c5 f5 a5@3 g5 f5",
  "g5@3 a5 b5@2 g5@2",
  "g#5@3 e5@3 b4@2",
  "e5@4 d5@2 b4@2",
];
const ENDING = ["c5 ~ a4 ~", "b4 ~ g5 ~", "e5@4 c5@3 b4", "a4@4"];

/** An octave up, note for note (the drive's doubling). */
const up = (bar: string): string =>
  bar.replace(/([a-g]#?)(\d)/g, (_, n: string, o: string) => `${n}${Number(o) + 1}`);

const DRIVE_TUNE = [...TUNE, ...TUNE];

const MEL: BySection = {
  intro: null,
  verse1: `note("${bars(VERSE)}")`,
  chorus1: `note("${bars(HOOK)}")`,
  verse2: `note("${bars(VERSE)}")`,
  chorus2: `note("${bars(HOOK)}")`,
  // The drums have the break to themselves for four bars; the tune comes back for the last four.
  break: `note("${bars(["~", "~", "~", "~", ...TUNE])}")`,
  ballad: `note("${bars(VERSE)}")`,
  // The drive plays the tune twice, as A2.L06's four-bar loop does, so the octave double above it (`vox`) still
  // doubles it note for note once the learner's drive replaces Oak's tune.
  drive: `note("${bars(DRIVE_TUNE)}")`,
  outro: `note("${bars(ENDING)}")`,
};
/**
 * The second tune. In the second verse, the A2.L03 strings line under the tune (A3 C4 | A3 C4 | C4 E4 | B3 G3, twice):
 * it starts its notes where the tune rests or holds, and rises in bar 1 while the tune falls. In the second chorus, a
 * held line under the hook, one note a bar (A4 B4 C5 C5 A4 B4 B4 G♯4). In the drive, the drive's tune an octave up.
 */
const COUNTER = ["~ ~ a3 c4", "~ a3 c4 ~", "c4 ~ ~ e4", "~ b3 ~ g3"];
const HELD = ["a4", "b4", "c5", "c5", "a4", "b4", "b4", "g#4"];
const VOX: BySection = {
  intro: null,
  verse1: null,
  chorus1: null,
  verse2: `note("${bars([...COUNTER, ...COUNTER])}")`,
  chorus2: `note("${bars(HELD)}")`,
  break: null,
  ballad: null,
  drive: `note("${bars(DRIVE_TUNE.map(up))}")`,
  outro: null,
};
/** Where the pad holds the chords: the opening, the choruses, the ballad, the drive and the ending. */
const PADDED = new Set<SectionId>(["intro", "chorus1", "chorus2", "ballad", "drive", "outro"]);

// ---- The break ----------------------------------------------------------------------------------------------
//
// A two-bar break cut into sixteen pieces (one an eighth long), eight to a bar: bars 1–2 as recorded, then new orders
// (the first kick again, the second bar's snare moved, a repeated kick) and a stutter into the ballad. `.splice()`
// fits every piece to its eighth, so a break recorded at another tempo plays at the song's.
const CHOP_8 = bars([
  "0 1 2 3 4 5 6 7",
  "8 9 10 11 12 13 14 15",
  "0 1 2 3 0 1 6 7",
  "8 9 4 5 12 13 14 15",
  "0 1 2 3 4 5 6 7",
  "8 9 10 11 2 3 6 7",
  "0 0 2 3 4 5 2 7",
  "8 9 10 11 12 13 [14 14] [15 15]",
]);
/** The jungle break, both of its bars in one of ours (170 against 2 × 90): sixteen pieces a bar, a sixteenth each. */
const CHOP_16 = bars([
  "0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15",
  "0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15",
  "0 1 2 3 4 5 6 7 0 1 2 3 12 13 14 15",
  "0 1 2 3 8 9 10 11 4 5 6 7 12 13 14 15",
  "0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15",
  "0 1 4 5 2 3 6 7 8 9 12 13 10 11 14 15",
  "0 0 2 3 4 5 6 7 8 8 10 11 12 13 14 15",
  "0 1 2 3 4 5 6 7 8 9 10 11 [12 12] [13 13] [14 14] [15 15]",
]);
/** Found sounds in the break's gaps: a swoosh into bar 3, snaps off the beat, an impact, a scratch. */
const FOUND = bars([
  "~",
  "~ ~ ~ ~ ~ ~ ~ swoosh",
  "~ ~ ~ snap ~ ~ ~ ~",
  "~ ~ ~ ~ ~ ~ impact ~",
  "~ ~ ~ snap ~ ~ ~ snap",
  "~ ~ ~ ~ ~ foley ~ ~",
  "~ ~ ~ snap ~ ~ scratch ~",
  "~ ~ ~ ~ ~ ~ ~ swoosh",
]);

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
/** The ending: the kit's bar, then one held root under the last chord. */
const LAST_HELD =
  (bar: string, held = "{r}@8"): BassBar =>
  (i, n) =>
    i === n - 1 ? held : bar;

interface Kit {
  /** `.bank()` for the drums, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the quiet parts). */
  banks?: Partial<Record<SectionId, string>>;
  /** The break this style cuts up, how many pieces a bar it plays, and its level against the kick. */
  brk: { sound: string; chop: string; postgain: number };
  /** Four-note chords (jazz-soul, funk, electronic from U06) or triads. */
  depth: "triad" | "four";
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; chords: string; lead: string; vox: string; pad: string };
  /** The tune's and the second tune's sound where it changes (the ballad, the drive). */
  leadBy?: Partial<Record<Kind, string>>;
  voxBy?: Partial<Record<Kind, string>>;
  chordSound?: Partial<Record<Kind, string>>;
  /** Levels per part, from U10's levelled kits (the pad from U12's); songs.pw.ts levels them against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    pad: number;
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
  /** The cymbals and percussion; the break section plays the cut-up break and the found sounds here. */
  perc: ByKind<string | null>;
  bass: ByKind<BassBar>;
  /** The chords' rhythm (`struct`) in each section. */
  comp: ByKind<string>;
  /** The pad's rhythm where it plays: held a bar (`x`), or struck on every beat to swell (electronic). */
  padStruct: string;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines' echo. */
  synth?: {
    bassSound: ByKind<string>;
    bass: ByKind<string>;
    chords: ByKind<string>;
    lead: string;
    vox: string;
    pad: string;
  };
}

/** The break section: the kick, the snare and the hats rest, because the break on `perc` plays the whole kit. */
const BREAK = null;

/** Pop: the default kit, piano, picked bass, strings pad; a boom-bap break; a marimba and a glockenspiel in the drive. */
const POP: Kit = {
  bank: "",
  brk: { sound: "brkboombap", chop: CHOP_8, postgain: 2.6 },
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", vox: "strings", pad: "strings" },
  voxBy: { drive: "glockenspiel" },
  chordSound: { drive: "marimba" },
  gain: {
    kick: 0.19,
    snare: 0.21,
    hats: 0.14,
    perc: 0.13,
    bass: 0.5,
    chords: 0.25,
    pad: 0.13,
    lead: 0.44,
    vox: 0.22,
  },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<bd [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ bd bd ~ bd bd]>"),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd bd ~ bd ~"),
    break: BREAK,
    ballad: v("bd ~ ~ ~"),
    drive: v("bd*4"),
    outro: v("<[bd ~ ~ ~ bd ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ rim ~ ~ ~ rim ~] [~ ~ sd ~ sd sd [sd sd] [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    break: BREAK,
    ballad: v("<[~ ~ rim ~]!7 [~ ~ rim [rim rim]]>"),
    drive: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [sd sd] [sd sd sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ [hh*8] [hh*8] [hh*8]>", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh hh oh]*2", V8),
    break: BREAK,
    ballad: null,
    drive: v("[hh oh]*4", V8),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    break: BREAK,
    ballad: v("[~ sh]*4", V8),
    drive: v("<[cr, [~ tb]*4] [[~ tb]*4]!7>"),
    outro: v("<cr ~ ~ cr>"),
    only: { verse2: v("<[cr, [~ sh]*4] [[~ sh]*4]!3>") },
  },
  bass: {
    intro: "{r}@4 {r}@4",
    verse: "{r}@3 {r} {r}@4",
    chorus: "{r}@3 {r} {r}@2 {r} {o}",
    break: "{r}@6 {o}@2",
    ballad: "{r}@8",
    drive: "[{r} {o}]*4",
    outro: LAST_HELD("{r}@4 {r}@4"),
  },
  comp: {
    intro: "x@3 x@3 x@2",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    break: "~ x ~ ~ ~ x ~ ~",
    ballad: "x",
    drive: "[~ x]*4",
    outro: "<[x@3 x@3 x@2]!3 x>",
  },
  padStruct: "x",
};

/** Indie: the rock kit, clean guitar, acoustic lead, organ pad; a funk break; a kalimba ballad, a glockenspiel drive. */
const INDIE: Kit = {
  bank: "rockkit",
  brk: { sound: "brkfunk", chop: CHOP_8, postgain: 2.6 },
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "strings", pad: "organ" },
  leadBy: { ballad: "kalimba" },
  voxBy: { drive: "glockenspiel" },
  gain: {
    kick: 0.38,
    snare: 0.33,
    hats: 0.22,
    perc: 0.19,
    bass: 0.49,
    chords: 0.38,
    pad: 0.17,
    lead: 0.94,
    vox: 0.3,
  },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<bd [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd bd]>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus: v("bd*4"),
    break: BREAK,
    ballad: v("bd ~ ~ ~"),
    drive: v("bd ~ bd ~ bd ~ bd bd"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ sd ~] [~ ~ sd [sd sd]]>"),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    break: BREAK,
    ballad: v("~ ~ rim ~"),
    drive: v("<[~ sd ~ sd]!7 [~ sd [sd sd] [sd sd sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ [hh*8] [hh*8] [hh*8]>", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh oh]*4", V8),
    break: BREAK,
    ballad: null,
    drive: v("[oh hh]*4", V8),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    break: BREAK,
    ballad: v("<cr ~!7>"),
    drive: v("<[cr, tb*8] [tb*8]!7>"),
    outro: v("<cr ~ ~ cr>"),
    only: { verse2: v("<[cr, [~ tb]*4] [[~ tb]*4]!3>") },
  },
  bass: {
    intro: "{r}@3 {r}@3 {r}@2",
    verse: "{r}@3 {r}@3 {r}@2",
    chorus: "[{r} {o}]*4",
    break: "{r}@6 {o}@2",
    ballad: "{r}@8",
    drive: "{r}*8",
    outro: LAST_HELD("{r}@3 {r}@3 {r}@2"),
  },
  comp: {
    intro: "x@3 x@3 x@2",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    break: "~ x ~ ~ ~ x ~ ~",
    ballad: "x@3 x@3 x@2",
    drive: "x*8",
    outro: "<[x@3 x@3 x@2]!3 x>",
  },
  padStruct: "x",
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A Rhodes comp on beat 1 and the "and" of 2 (the Charleston), both over the bass's root. */
const JAZZ_COMP = "x [~ x] ~ ~";

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, a tenor saxophone for the second tune, strings for the pad;
 * a lo-fi break; brushes in the ballad and a marimba doubling the drive. Swung eighths and four-note chords (from U03,
 * FLAVOUR_RULES); the bass plays root and fifth in two and walks root, root, fifth, third where the music drives, and
 * the Rhodes strikes only while the bass holds the root.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  brk: { sound: "brklofi", chop: CHOP_8, postgain: 1.3 },
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "tenor", pad: "strings" },
  voxBy: { drive: "marimba" },
  gain: {
    kick: 0.22,
    snare: 0.35,
    hats: 0.22,
    perc: 0.22,
    bass: 0.74,
    chords: 0.43,
    pad: 0.16,
    lead: 0.51,
    vox: 0.45,
  },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<bd [bd ~ bd ~] [bd ~ bd ~] [bd ~ bd bd]>"),
    verse: v("bd ~ bd ~"),
    chorus: v("bd ~ bd ~"),
    break: BREAK,
    ballad: v("bd ~ ~ ~"),
    drive: v("bd ~ [~ bd] ~"),
    outro: v("<[bd ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ [~ rim ~ rim] [~ rim ~ rim] [~ rim ~ [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    break: BREAK,
    // Brushes: the snare's stir (n 2), swept on every beat.
    ballad: 's("sd*4").n(2).velocity(".7 .5 .6 .5")',
    drive: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("<[~ rim ~ rim]!3 ~>"),
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("~ hh ~ hh"),
    verse: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    break: BREAK,
    ballad: v("~ hh ~ hh"),
    drive: v("~ hh ~ hh"),
    outro: v("<[~ hh ~ hh]!3 ~>"),
  },
  perc: {
    intro: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    chorus: v("<[cr, rd*8] [rd*8]!3>", V8),
    break: BREAK,
    ballad: v("rd ~ rd ~"),
    drive: v("<[cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!7>", V8),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!2 cr>`, V8),
  },
  bass: {
    intro: "{r}@2 {f}@2",
    verse: "{r}@2 {f}@2",
    chorus: "{r} {r} {f} {t}",
    break: "{r}@3 {o}",
    ballad: "{r}@4 {f}@4",
    drive: "{r} {r} {f} {t}",
    outro: LAST_HELD("{r}@2 {f}@2", "{r}@4"),
  },
  comp: {
    intro: "x@2 ~@2",
    verse: JAZZ_COMP,
    chorus: JAZZ_COMP,
    break: "x@2 ~@2",
    ballad: "x",
    drive: JAZZ_COMP,
    outro: `<[${JAZZ_COMP}]!3 x>`,
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

/**
 * Funk: Oak's 808, clavinet, finger bass, organ lead, horns for the second tune, strings for the pad; a funk break; a
 * slow soul ballad on the Rhodes; a disco drive (four on the floor, open hats off the beat, octave bass, strings an
 * octave over the tune). Sixteenths, straight, four-note chords (from U06).
 */
const FUNK: Kit = {
  bank: "oak808",
  brk: { sound: "brkfunk", chop: CHOP_8, postgain: 3.6 },
  depth: "four",
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "horns", pad: "strings" },
  voxBy: { drive: "strings" },
  chordSound: { ballad: "rhodes" },
  gain: {
    kick: 0.3,
    snare: 0.21,
    hats: 0.12,
    perc: 0.11,
    bass: 0.6,
    chords: 0.47,
    pad: 0.2,
    lead: 0.79,
    vox: 0.65,
  },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [${FK_KICK_V}]!3>`),
    verse: v(FK_KICK_V),
    chorus: v(FK_KICK_C),
    break: BREAK,
    ballad: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    drive: v("bd*4"),
    outro: v(`<[${FK_KICK_V}]!3 bd>`),
  },
  snare: {
    intro: v(`<~ [${FK_BACKBEAT}] [${FK_BACKBEAT}] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    break: BREAK,
    ballad: v("~ ~ ~ ~ ~ ~ ~ ~ rim ~ ~ ~ ~ ~ ~ ~"),
    drive: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    outro: v(`<[${FK_BACKBEAT}]!3 ~>`),
  },
  hats: {
    intro: v("hh*16", V16),
    verse: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    break: BREAK,
    ballad: v("hh*8", V8),
    drive: v("[hh hh oh hh]*4", V16),
    outro: v("<[hh*16]!3 ~>", V16),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    break: BREAK,
    ballad: v("<cr ~!7>"),
    drive: v("<[cr, [~ cb]*4] [[~ cb]*4]!7>"),
    outro: v("<cr ~ ~ cr>"),
  },
  bass: {
    intro: FK_BASS_V,
    verse: FK_BASS_V,
    chorus: FK_BASS_C,
    break: "{r}@12 {o}@4",
    ballad: "{r}@6 {f}@2",
    drive: "[{r} {o}]*4",
    outro: LAST_HELD(FK_BASS_V),
  },
  comp: {
    intro: FK_CLAV_V,
    verse: FK_CLAV_V,
    chorus: FK_CLAV_C,
    break: "~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",
    ballad: "x",
    drive: "[~ x]*4",
    outro: `<[${FK_CLAV_V}]!3 x>`,
  },
  padStruct: "x",
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. Every eighth of the acid bar sounds the root or its
// octave, so each stab and each pad chord has its root under it.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {r}";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/**
 * The 808 kick (funk's `oak808`) rings for seconds with no choke: hits a beat apart pile up, by up to 7 dB and by the
 * tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at 96). A 0.35 s decay keeps
 * its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** A held chord that blooms in slowly under a closed filter (the break's supersaw, the ballad's sawtooth). */
const HELD_SAW = ".attack(.3).decay(1.5).sustain(.6).lpf(1200).postgain(.6)";
/** A supersaw struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD =
  ".unison(5).detune(.2).attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: the lo-fi kit in the intro, the verses, the ballad and the ending; Oak's 909 in the choruses and the
 * drive. The verses sit on a boom-bap beat over a sine sub and off-beat stabs; the choruses and the drive go four on
 * the floor with the acid line, pumping stabs and a supersaw swelling after every kick; the break is the jungle break
 * at its own speed over a sub and a held supersaw (drum and bass against the song's half time); the ballad is a sub,
 * a held supersaw and the tune on a kalimba with an echo. A square pluck with a dotted-eighth echo plays the tune, a
 * supersaw doubles it in the drive. Straight, four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", verse1: "lofikit", verse2: "lofikit", ballad: "lofikit", outro: "lofikit" },
  brk: { sound: "brkjungle", chop: CHOP_16, postgain: 3.8 },
  depth: "four",
  swing: "",
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", vox: "supersaw", pad: "supersaw" },
  leadBy: { ballad: "kalimba" },
  chordSound: { break: "supersaw" },
  gain: {
    kick: 0.29,
    snare: 0.17,
    hats: 0.12,
    perc: 0.1,
    bass: 0.72,
    chords: 0.33,
    pad: 0.17,
    lead: 0.43,
    vox: 0.3,
  },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v(
      "<bd [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ bd bd]>",
    ),
    verse: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus: v("bd*4"),
    break: BREAK,
    ballad: null,
    drive: v("bd*4"),
    outro: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    break: BREAK,
    ballad: v("<[~ ~ rim ~]!7 [~ ~ rim [rim rim]]>"),
    drive: v("<[~ cp ~ cp]!7 [~ cp [~ sd] [sd sd sd sd]]>"),
    outro: v("<[~ sd ~ sd]!3 ~>"),
  },
  hats: {
    intro: v("<~ [~ hh]*4 [~ hh]*4 [hh*8]>", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh oh hh]*4", V16),
    break: BREAK,
    ballad: v("[~ hh]*4", V8),
    drive: v("[hh hh oh hh]*4", V16),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!3>"),
    break: BREAK,
    ballad: null,
    drive: v("<[cr, rd*8] [rd*8]!7>", V8),
    outro: v("<cr ~ ~ cr>"),
  },
  bass: {
    intro: "{r}",
    verse: "{r}@10 {r}@6",
    chorus: ACID_BAR,
    break: "{r}",
    ballad: "{r}",
    drive: ACID_BAR,
    outro: LAST_HELD("{r}@10 {r}@6", "{r}"),
  },
  comp: {
    intro: "[~ x]*4",
    verse: "[~ x]*4",
    chorus: "x*8",
    break: "x",
    ballad: "x",
    drive: "x*8",
    outro: "<[[~ x]*4]!3 x>",
  },
  padStruct: "x x x x",
  synth: {
    bassSound: {
      intro: "sine",
      verse: "sine",
      chorus: "sawtooth",
      break: "sine",
      ballad: "sine",
      drive: "sawtooth",
      outro: "sine",
    },
    bass: { intro: SUB, verse: SUB, chorus: ACID, break: SUB, ballad: SUB, drive: ACID, outro: SUB },
    chords: {
      intro: STAB,
      verse: STAB,
      chorus: `${STAB}${PUMP}`,
      break: HELD_SAW,
      ballad: HELD_SAW,
      drive: `${STAB}${PUMP}`,
      outro: '.lpf(1800).lpenv(2).lpd(.12).lps(0).decay("<.22!3 1.5>").sustain("<.3!3 .6>")',
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.51).delayfeedback(.35)",
    vox: ".unison(5).detune(.2).lpf(3000).decay(.3).sustain(.5)",
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

/** A section's bass line: one bar per chord, the kit's bar with the chord's root, fifth, third and octave filled in. */
function bassLine(id: SectionId, bar: BassBar): string {
  const chords = PROGRESSION[id];
  const out = chords.map((name, i) => {
    const root = midiOf(ROOT[name]);
    const at: Record<"r" | "f" | "t" | "o", number> = {
      r: root,
      f: root + 7,
      t: root + (CHORD[name].minor ? 3 : 4),
      o: root + 12,
    };
    const text = typeof bar === "string" ? bar : bar(i, chords.length);
    return text.replace(/\{([rfto])\}/g, (_, k: "r" | "f" | "t" | "o") => nameOf(at[k]));
  });
  return bars(out);
}

/** A section's chords: one bar per chord, voiced by the kit's depth and the section's register. */
function chordLine(id: SectionId, depth: Kit["depth"]): string {
  const out = PROGRESSION[id].map((name) => {
    const set = CHORD[name][depth === "four" ? "four" : "triad"];
    return HIGH.has(id) ? set.high : set.low;
  });
  return bars(out);
}

/** One flavour's song: the tunes first, then the pad, the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const syn = k.synth;
  const sound = (by: Partial<Record<Kind, string>> | undefined, id: SectionId, fallback: string): string =>
    by?.[kindOf(id)] ?? fallback;
  const mel = mapSections((id) => (MEL[id] ? `${MEL[id]}.s("${sound(k.leadBy, id, k.sounds.lead)}")` : null));
  const vox = mapSections((id) => (VOX[id] ? `${VOX[id]}.s("${sound(k.voxBy, id, k.sounds.vox)}")` : null));
  const pad = mapSections((id) =>
    PADDED.has(id) ? `note("${chordLine(id, k.depth)}").struct("${k.padStruct}")` : null,
  );
  const chords = mapSections((id) => {
    const s = sound(k.chordSound, id, k.sounds.chords);
    return `note("${chordLine(id, k.depth)}").struct("${pick(k.comp, id)}").s("${s}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const bass = mapSections((id) => {
    const line = `note("${bassLine(id, pick(k.bass, id))}")`;
    return syn ? `${line}.s("${pick(syn.bassSound, id)}")${pick(syn.bass, id)}` : line;
  });
  /** The machine of a section: each section const names its own, so the break's samples are never banked. */
  const machine = (id: SectionId): string => k.banks?.[id] ?? k.bank;
  const drums = (by: ByKind<string | null>): BySection =>
    mapSections((id) => {
      const p = pick(by, id);
      if (p === null || machine(id) === "") return p;
      return `${p}.bank("${machine(id)}")`;
    });
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: BySection): BySection =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(machine(id)) ? `${p}${KICK_808}` : p;
    });
  /** The break section's percussion: the break cut up and fitted to the bar, and found sounds in its gaps. */
  const perc = mapSections((id) =>
    kindOf(id) === "break"
      ? `stack(s("${k.brk.sound}").splice(16, "${k.brk.chop}").postgain(${num(k.brk.postgain)}), s("${FOUND}").postgain(${num(Math.round(k.brk.postgain * 6) / 10)}))`
      : drums(k.perc)[id],
  );
  const sw = k.swing;
  const tracks = [
    track(
      "mel",
      mel,
      `${sw}${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track("vox", vox, `${sw}${syn?.vox ?? ""}.gain(${num(k.gain.vox)}).pan(.38).room(${num(k.room)})`),
    track(
      "pad",
      pad,
      `${sw}.s("${k.sounds.pad}")${syn?.pad ?? ".attack(.3).release(.6)"}.gain(${num(k.gain.pad)}).pan(.65).room(${num(k.room)})`,
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
    track("kick", kick808(drums(k.kick)), `${sw}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${sw}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${sw}.gain(${num(k.gain.hats)})`),
    track("perc", perc, `${sw}.gain(${num(k.gain.perc)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: SectionId[],
  parts: SongPartId[],
  today: string,
): TakeStep => ({ lesson, kind: "take", sections, parts, startFrom: "oak", today });

export const A2_SONG = defineUnitSong({
  id: "usong.A2",
  unit: "A2",
  version: 1,
  title: "Room to breathe",
  meter: "4/4",
  key: { tonic: "A", mode: "minor" },
  bpm: 90,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    {
      id: "vox",
      label: "vox",
      role: "melody",
      name: "Counter-melody",
      plainName: "Second tune",
      termId: "term.counter-melody",
    },
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
  // By section (AUTHORING §23.6). Each lesson takes the section whose idea it is, and none takes a section an earlier
  // one took, so the song grows to the learner's in every section but the intro and the ending by A2.L06:
  // - A2.L01, A2.L03 and A2.L05 are four-bar loops that play chords, so each takes a whole section and silences Oak's
  //   tune, second tune, pad and bass there; Oak keeps the drums.
  // - A2.L02 writes a verse and a chorus with `arrange()`; it takes the first chorus only, so the learner's own verse of
  //   A2.L01 leads into it (its verse plays in its "Today's code").
  // - A2.L04 writes the drums (a break plays the whole kit) and the tune; Oak's bass and chords, the A2 loop, keep
  //   playing under it.
  // - A2.L06 writes the kick, the snare, the bass and the tune in a ballad and a drive; Oak's chords, pad, hi-hats and
  //   the drive's octave doubling keep playing with them (no chords in the take: nothing is silenced). The hi-hats are
  //   not handed over, because the Make's starter has no hi-hat line: a learner who writes one takes them (a played
  //   part is always claimed), and one who does not keeps Oak's, so the drive never loses its hats.
  // Every take opens with its own starter: each Make's starter is built for its task (the empty second tune, every
  // level at .5, the break as recorded, two sections arranged alike), and no earlier take's code holds what it needs.
  plan: [
    take(
      "A2.L01",
      ["verse1"],
      ["lead", "chords", "bass"],
      "Your loop, with the bass low, the chords in the middle and the tune on top, plays the first verse.",
    ),
    take(
      "A2.L02",
      ["chorus1"],
      ["lead", "pad", "chords", "bass"],
      "Your chorus, with more notes in every bar than its verse, plays the song's first chorus.",
    ),
    { lesson: "A2.L08", kind: "side", reason: "Placeholder until this lesson is written." },
    { lesson: "A2.L09", kind: "side", reason: "Placeholder until this lesson is written." },
    take(
      "A2.L03",
      ["verse2"],
      ["lead", "vox", "chords", "bass"],
      "Your loop with a second tune that answers the first plays the song's second verse.",
    ),
    { lesson: "A2.L07", kind: "side", reason: "Placeholder until this lesson is written." },
    take(
      "A2.L04",
      ["break"],
      ["kick", "snare", "hats", "perc", "lead"],
      "Your drum break, cut into pieces and played in a new order, drives the song's break.",
    ),
    take(
      "A2.L05",
      ["chorus2"],
      ["lead", "pad", "chords", "bass"],
      "Your loop, with the tune on top and every part at its own level, plays the last chorus.",
    ),
    take(
      "A2.L06",
      ["ballad", "drive"],
      ["kick", "snare", "bass", "lead"],
      "Your tune as a quiet ballad, then as a driving version, plays the two sections before the ending.",
    ),
  ],
  releaseAfter: "A.CP",
});

export default A2_SONG;
