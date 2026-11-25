// Song 14, "Four colours" (docs/design/songs/makes-core-c.md §3 "U14 song: one home, four colours", §2.2; AUTHORING
// §23). 4/4, 100 BPM, 64 bars (2:34 at 100): the unit on modes gets a song whose every section has a colour of its
// own, each one the colour a lesson of the unit writes in.
//
//   intro 8   | verse1 8     | chorus1 8  | verse2 8     | chorus2 8 | bridge 8   | chorus3 8 | outro 8
//   F Lydian  | G Mixolydian | D Dorian   | G Mixolydian | D Dorian  | E Phrygian | D Dorian  | D Dorian
//   (F G/F)×4 | G pedal      | (Dm7 G7)×4 | (G F C G)×2  | as 1      | (Em F)×4   | as 1      | (Dm7 G7)×3 Dm7 Dm7
//
// Why these homes and not one home G (the proposal's "one home, four colours"): each section of a song carries the key
// of the Make that takes it over (spec §5.2, §8: "take steps' Makes are in the key of every section they play in"),
// and U14's Makes are written on four homes by the unit's convention (content/specs/U14.ts: G Mixolydian, D Dorian,
// F Lydian, E Phrygian, "each parent key has exactly one accidental and the mode cancels it"). AUTHORING §23.11 says
// to fit the song to the lessons first, with a section that carries the lesson's key, and keeps re-keying a Make as
// the last resort: on one home G, four of the six Makes (U14.L03–L06) would have to be re-keyed, every starter, test
// and hint with them. So each section sits on its own lesson's home: the opening floats in F Lydian (U14.L04), the
// verses rock in G Mixolydian (U14.L01, L02), the choruses groove in D Dorian (U14.L03), the bridge darkens in E
// Phrygian (U14.L05), and the ending is a D vamp in the learner's own colour (U14.L06). The four modes share the white
// keys, so the whole song has no sharp or flat in it: what changes from section to section is home, and with it the
// colour, which is the observation U14.L06 makes ("the same seven notes, another home"). Every section's colour is
// in Oak's own parts before the learner takes them: the pad moves F to G over a held F (I–II) under a tune that
// rests on B; the verse riff leans on F, the ♭7, and the band plays G F C G (I–♭VII–IV–I); the chorus hook sits on B,
// the raised 6, over Dm7 and G7 (i–IV); the bridge riff presses F against E over Em and F (i–♭II).
//
// Keys: one key plan per pitched track after its arrange() (STYLE §9, contracts §6.8 item 4), one key a bar for the
// whole song; the section consts are bare degree patterns, so `n` 6 is F in the verse and C in the chorus. The
// sections carry their keys (`sections[].key`); the verses are in the song's key, G Mixolydian.
//
// Clashes (AUTHORING §13, §23.5), read off the evaluated events: every tune note held a beat or more is a tone of its
// bar's chord, or B over Dm (its sixth, the Dorian colour) or E over F in the opening (its major seventh, a half step
// under the root, never above it); none sits a half step above a sounding chord note. The riffs move in eighths, and
// their notes that rub (F over Em, B over C, C over B) are eighths that pass; the bridge riff holds F, E and D over F
// only (root, major seventh, sixth). In the tune, the only half step above a chord note is the hook's passing C, an
// eighth over G7's B. The bass plays roots, fifths, thirds and octaves. Chords sit from B2 to D4 (the opening's pad up to
// F4); the tune from D4 to A5 above them; the verse riff from F3 to G4 and the bridge riff from D4 to C5.
//
// One builder writes all five flavours (AUTHORING §23.2), so the roots, the bass downbeats and the tune cannot drift. A
// flavour changes the kit, the grooves inside a section, the comp and bass rhythms, swing (jazz-soul) and chord colour
// as its kit's staging allows at U14 (content/flavours.ts FLAVOUR_RULES): pop and indie triads; jazz-soul, funk and
// electronic four-note chords (sixths on F and C, sevenths on G, Dm and Em, never a major seventh); jazz-soul swung
// eighths, every other flavour straight. Wherever a four-note chord is struck, the bass sounds its root (the held F
// of the opening under G7/F included), so F6 never reads as Dm7. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top.
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const SECTIONS = [
  { id: "intro", type: "intro", bars: 8, key: { tonic: "F", mode: "lydian" } },
  { id: "verse1", type: "verse", bars: 8 },
  { id: "chorus1", type: "chorus", bars: 8, key: { tonic: "D", mode: "dorian" } },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "chorus2", type: "chorus", bars: 8, key: { tonic: "D", mode: "dorian" } },
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "E", mode: "phrygian" } },
  { id: "chorus3", type: "chorus", bars: 8, key: { tonic: "D", mode: "dorian" } },
  { id: "outro", type: "outro", bars: 8, key: { tonic: "D", mode: "dorian" } },
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
 * (`gtrVerse`; `percChorus3` for a third chorus that plays something else), `silence` where it rests, and one
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

/** One bar after another, `<[…] […]>`, a bar of rest as `~`. */
const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- Keys ---------------------------------------------------------------------------------------------------
//
// One home and mode a section. A key plan names the key once a bar, with the octave each track sits in.

type Home = "F" | "G" | "D" | "E";
const MODE: Readonly<Record<Home, string>> = { F: "lydian", G: "mixolydian", D: "dorian", E: "phrygian" };
const HOME: Readonly<Record<SectionId, Home>> = {
  intro: "F",
  verse1: "G",
  chorus1: "D",
  verse2: "G",
  chorus2: "D",
  bridge: "E",
  chorus3: "D",
  outro: "D",
};

/** A track's key plan after its arrange(): one key a bar for the whole song, runs written with `!`. */
function keyPlan(octave: (id: SectionId) => number): string {
  const keys = SECTIONS.flatMap((s) =>
    Array.from({ length: s.bars }, () => `${HOME[s.id]}${octave(s.id)}:${MODE[HOME[s.id]]}`),
  );
  const runs: string[] = [];
  let i = 0;
  while (i < keys.length) {
    let j = i;
    while (keys[j + 1] === keys[i]) j++;
    runs.push(j > i ? `${keys[i]}!${j - i + 1}` : (keys[i] as string));
    i = j + 1;
  }
  return `.scale("<${runs.join(" ")}>")`;
}
/** The tune: F4, G4, D4, E4. */
const MEL_KEYS = keyPlan(() => 4);
/** The riffs: G3 in the verses, E4 in the bridge (above the strum), D3 in the ending. */
const GTR_KEYS = keyPlan((id) => (HOME[id] === "E" ? 4 : 3));
/** Chords and the pad: F3, G3, D3, E3. */
const CHORD_KEYS = keyPlan(() => 3);
/** The bass: F1 (held under the opening), G1 (the verses' pumping G), D2 (the choruses), E1 (the bridge). */
const BASS_KEYS = keyPlan((id) => (HOME[id] === "D" ? 2 : 1));

// ---- Harmony (every flavour) --------------------------------------------------------------------------------
//
// One chord a bar, written in degrees of the bar's key (degree 0 is home). Voiced close and low (B2 to D4) so every
// change moves each voice a step or two and the tune has the register above D4 to itself; the opening's pad climbs
// F3 A3 C4 to G3 B3 D4 and back, all voices together, the floating I–II of Lydian. Four notes (jazz-soul, funk,
// electronic): F6 (F A C D), G7 (G B D F), C6 (C E G A), Dm7 (D F A C), Em7 (E G B D), and over the opening's F the
// G chord with F on top (G7 over its own F). Bass degrees on the bass plan: root, fifth, third, octave.

type ChordName = "F" | "G/F" | "G" | "F_bVII" | "C" | "Dm" | "G7" | "Em" | "F_bII";
interface Chord {
  /** Bass: root, fifth, third, octave (degrees on the bass plan). */
  r: number;
  f: number;
  t: number;
  o: number;
  /** Degrees on the chord plan. */
  triad: string;
  four: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  // F Lydian (F1 / F3): I, and II over I's bass.
  F: { r: 0, f: 4, t: 2, o: 7, triad: "0,2,4", four: "0,2,4,5" },
  "G/F": { r: 0, f: 4, t: 2, o: 7, triad: "1,3,5", four: "1,3,5,7" },
  // G Mixolydian (G1 / G3): I, ♭VII, IV.
  G: { r: 0, f: 4, t: 2, o: 7, triad: "-3,0,2", four: "-3,-1,0,2" },
  F_bVII: { r: -1, f: 3, t: 1, o: 6, triad: "-4,-1,1", four: "-4,-3,-1,1" },
  C: { r: 3, f: 7, t: 5, o: 10, triad: "-4,-2,0", four: "-4,-2,0,1" },
  // D Dorian (D2 / D3): i, IV.
  Dm: { r: 0, f: 4, t: 2, o: 7, triad: "0,2,4", four: "-1,0,2,4" },
  G7: { r: -4, f: 0, t: -2, o: 3, triad: "0,3,5", four: "-2,0,2,3" },
  // E Phrygian (E1 / E3): i, ♭II.
  Em: { r: 0, f: 4, t: 2, o: 7, triad: "0,2,4", four: "0,2,4,6" },
  F_bII: { r: 1, f: 5, t: 3, o: 8, triad: "1,3,5", four: "1,3,5,6" },
};
const ROCK: ChordName[] = ["G", "F_bVII", "C", "G"];
const GROOVE: ChordName[] = ["Dm", "G7", "Dm", "G7", "Dm", "G7", "Dm", "G7"];
const EDGE: ChordName[] = ["Em", "F_bII", "Em", "F_bII", "Em", "F_bII", "Em", "F_bII"];
/** The chords of each section, one a bar (`null`: the chords rest there; the bass still follows `BASS_ROOTS`). */
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: ["F", "G/F", "F", "G/F", "F", "G/F", "F", "G/F"],
  // The first verse is the riff over a pumping G: no chords until the second.
  verse1: ["G", "G", "G", "G", "G", "G", "G", "G"],
  chorus1: GROOVE,
  verse2: [...ROCK, ...ROCK],
  chorus2: GROOVE,
  bridge: EDGE,
  chorus3: GROOVE,
  outro: ["Dm", "G7", "Dm", "G7", "Dm", "G7", "Dm", "Dm"],
};

// ---- The tune and the riffs (every flavour) -------------------------------------------------------------------
//
// Steps are eighth notes (`@` holds), degrees of the section's key on MEL_KEYS / GTR_KEYS.
//
// The opening (F Lydian, F4 = 0): A C E C over F, then D and a held B over G (the raised 4th, a chord tone of II),
// again, and a high G falling to B; the second four bars climb to A5 and come down on B. The piano floats (U14.L04's
// sound: a delayed piano over a pad and one held bass note).
const INTRO_TUNE = ["2 4 6 4", "5@2 3@2", "2 4 6 7", "8@2 5 3", "2 4 6 4", "5@2 3@2", "4 6 7 9", "8@4 3@4"];
// The chorus hook (D Dorian, D4 = 0) sits on B, the raised 6, over Dm7: B held a beat and a half on the downbeat of
// every Dm bar but the seventh, then G B D over G7, D C B, and the last bar walks B A G home to the G of the next verse.
// Every note held a beat or more is a chord tone or B over Dm (a sixth); the C over G7 is an eighth.
const HOOK = [
  "5@3 4 2@2 0@2",
  "3@2 5 7 ~ 5 3@2",
  "5@3 4 2@2 4@2",
  "7@3 6 5@4",
  "5@3 4 2@2 0@2",
  "3@2 5 7 ~ 5 3@2",
  "7@2 9@2 7 5 4@2",
  "5 4 3@6",
];
// The verse riff (G Mixolydian, G3 = 0) spells I ♭VII IV I in eighths and leans on F, the ♭7: G, G B D, F D | C A F,
// A C | C E G, E C | D B G, F G. Over the first verse's pumping G it is the whole harmony; in the second the band
// plays the chords under it. Its last bar climbs A B C into the chorus's D.
const RIFF = ["0 ~ 0 2 4 ~ 6 4", "3 ~ 1 -1 ~ 1 3 ~", "3 ~ 3 5 7 ~ 5 3", "4 2 0 ~ -1 ~ 0 ~"];
const RIFF_OUT = "4 2 0 ~ 1 2 3 ~";
// The bridge riff (E Phrygian, E4 = 0): E F E, B, G F over Em (the F in eighths, a half step above home), F held over
// F, C, A F, E. The last bar falls C A F E to D, into the last chorus's Dm.
const EDGE_RIFF = ["0 1 0 ~ 4 ~ 2 1", "1@2 5 ~ 3 1 0@2"];
const EDGE_OUT = "5 3 1 0 -1@4";
// The ending's guitar vamp (D Dorian, D3 = 0): D, A B, A F over Dm7 (B the raised 6 again), G, B D, B G over G7; the
// last bar A F, then D held.
const VAMP_RIFF = ["0 ~ 4 5 ~ 4 2 ~", "3 ~ 5 7 ~ 5 3 ~"];
const VAMP_OUT = "4 ~ 2 ~ 0@4";

const MEL: BySection = {
  intro: `n("${bars(INTRO_TUNE)}")`,
  verse1: null,
  chorus1: `n("${bars(HOOK)}")`,
  verse2: null,
  chorus2: `n("${bars(HOOK)}")`,
  bridge: null,
  chorus3: `n("${bars(HOOK)}")`,
  // The hook's first four bars, then the guitar vamps alone, and the tune ends on D held over the last Dm7.
  outro: `n("${bars([...HOOK.slice(0, 4), "~", "~", "~", "7@8"])}")`,
};
const GTR_NOTES: Readonly<Record<SectionId, string | null>> = {
  intro: null,
  verse1: bars([...RIFF, ...RIFF.slice(0, 3), RIFF_OUT]),
  chorus1: null,
  verse2: bars([...RIFF, ...RIFF.slice(0, 3), RIFF_OUT]),
  chorus2: null,
  bridge: bars([...EDGE_RIFF, ...EDGE_RIFF, ...EDGE_RIFF, EDGE_RIFF[0] as string, EDGE_OUT]),
  chorus3: null,
  outro: bars([...VAMP_RIFF, ...VAMP_RIFF, ...VAMP_RIFF, VAMP_RIFF[0] as string, VAMP_OUT]),
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
const LAST_HELD =
  (bar: string, held = "{r}"): BassBar =>
  (i, n) =>
    i === n - 1 ? held : bar;

/** Per section, the sound a part plays (riff, chords) where it changes with the colour. */
type Sounds = ByKind<string>;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the verses, the bridge and the ending). */
  banks?: Partial<Record<SectionId, string>>;
  /** Four-note chords (jazz-soul, funk, electronic at U14) or triads. */
  depth: "triad" | "four";
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; lead: string; pad: string; chords: Sounds; riff: Sounds };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: Readonly<
    Record<"kick" | "snare" | "hats" | "perc" | "bass" | "chords" | "pad" | "lead" | "riff", number>
  >;
  /** content/flavours.ts production: the room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  /** Right of centre, across from the chords: the riff carries the verses and the bridge, where the tune rests. */
  riffPan: number;
  kick: ByKind<string | null>;
  snare: ByKind<string | null>;
  hats: ByKind<string | null>;
  perc: ByKind<string | null>;
  bass: ByKind<BassBar>;
  /** The chords' rhythm (`struct`) in each section where they play (the opening's pad is held). */
  comp: ByKind<string>;
  /** The lead's echo (the opening's delayed piano), on the tune track. */
  leadFx: string;
  /** On the riff track (jazz-soul: short notes, so a swung last eighth ends before the barline). */
  riffFx?: string;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines. */
  synth?: {
    bassSound: ByKind<string>;
    bass: ByKind<string>;
    chords: ByKind<string>;
    riff: ByKind<string>;
    pad: string;
  };
}

/** Pop: the default kit, picked bass, a piano tune; crunch guitar and organ for the rock verses, piano in the choruses. */
const POP: Kit = {
  bank: "",
  depth: "triad",
  swing: "",
  sounds: {
    bass: "ebass",
    lead: "piano",
    pad: "pad",
    chords: { intro: "pad", verse: "organ", chorus: "piano", bridge: "acgtr", outro: "piano" },
    riff: { intro: "crunch", verse: "crunch", chorus: "crunch", bridge: "acgtr", outro: "cleangtr" },
  },
  gain: {
    kick: 0.19,
    snare: 0.14,
    hats: 0.09,
    perc: 0.08,
    bass: 0.57,
    chords: 0.27,
    pad: 0.16,
    lead: 0.57,
    riff: 0.69,
  },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  riffPan: 0.64,
  kick: {
    intro: v("<~ ~ ~ ~ [bd ~ ~ ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~] [bd ~ ~ bd bd ~ ~ ~] [bd ~ ~ ~ bd ~ ~ ~]>"),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd ~ ~ bd ~"),
    bridge: v("bd ~ ~ bd ~ ~ bd ~"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!7 bd>"),
  },
  snare: {
    intro: v("<~!6 [~ sd ~ sd] [~ ~ ~ ~ sd ~ [sd sd] [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    // Half time: the snare on 3.
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!7 ~>"),
  },
  hats: {
    intro: v("<~!4 [~ hh]*4 [~ hh]*4 hh*8 hh*8>", V8),
    verse: v("hh*8", V8),
    chorus: v("hh*16", V16),
    bridge: null,
    outro: v("<[hh*8]!7 ~>", V8),
    only: {
      verse2: v("[hh hh hh oh]*2", V8),
      // The second chorus: the hi-hat opens on the "and" of 4 at the end of every fourth bar.
      chorus2: v("<[hh*16]!3 [hh!14 oh ~]>", V16),
    },
  },
  perc: {
    intro: v("<cr ~ ~ ~ cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, tb*8] [tb*8]!3>", V8),
    // The ride in quarters, and the floor tom under the strum's last two eighths.
    bridge: v("<[cr, rd*4] [rd*4, [~ ~ ~ ~ ~ ~ lt lt]]!7>"),
    outro: v("<cr ~ ~ ~ [tb*8] [tb*8] [tb*8] cr>", V8),
    only: { verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"), chorus3: v("<[cr, tb*16] [tb*16]!3>", V16) },
  },
  bass: {
    intro: "{r}@8",
    verse: "{r}*8",
    chorus: "{r}@3 {r}@3 {o}@2",
    bridge: "{r}@3 {r}@3 {r}@2",
    outro: LAST_HELD("{r}@3 {r}@3 {o}@2", "{r}@8"),
  },
  comp: {
    intro: "x",
    verse: "x",
    chorus: "~ x ~ x ~ ~ x ~",
    bridge: "x ~ ~ x ~ ~ x ~",
    outro: "<[~ x ~ x ~ ~ x ~]!7 x>",
  },
  leadFx: ".delay(.25).delaytime(.45).delayfeedback(.3)",
};

/** Indie: the rock kit, clean guitar chords, an acoustic tune; crunch riff and organ in the verses, strings for the pad. */
const INDIE: Kit = {
  bank: "rockkit",
  depth: "triad",
  swing: "",
  sounds: {
    bass: "ebass",
    lead: "acgtr",
    pad: "strings",
    chords: { intro: "strings", verse: "organ", chorus: "cleangtr", bridge: "acgtr", outro: "cleangtr" },
    riff: { intro: "crunch", verse: "crunch", chorus: "crunch", bridge: "acgtr", outro: "cleangtr" },
  },
  gain: {
    kick: 0.39,
    snare: 0.4,
    hats: 0.27,
    perc: 0.23,
    bass: 0.5,
    chords: 0.43,
    pad: 0.24,
    lead: 0.77,
    riff: 0.81,
  },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  riffPan: 0.7,
  kick: {
    intro: v("<~ ~ ~ ~ [bd ~ ~ ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~] [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~]>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus: v("bd*4"),
    bridge: v("bd ~ ~ bd ~ ~ bd ~"),
    outro: v("<[bd*4]!7 bd>"),
  },
  snare: {
    intro: v("<~!6 [~ ~ sd ~] [~ ~ ~ ~ sd ~ [sd sd] [sd sd]]>"),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!7 ~>"),
    only: { verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>") },
  },
  hats: {
    intro: v("<~!4 [~ hh]*4 [~ hh]*4 hh*8 hh*8>", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh oh]*4", V8),
    bridge: null,
    outro: v("<[[hh oh]*4]!7 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~ cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    // The floor tom rolls with the strum's three-three-two under the bridge's long chords.
    bridge: v("<[cr, [lt ~ ~ lt ~ ~ lt ~]] [lt ~ ~ lt ~ ~ lt ~]!7>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: {
      // The second chorus: the tambourine moves to the off-beats in its last four bars.
      chorus2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
      chorus3: v("<[cr, tb*8] [tb*8]!3>", V8),
    },
  },
  bass: {
    intro: "{r}@8",
    verse: "{r}*8",
    chorus: "[{r} {o}]*4",
    bridge: "{r}@3 {r}@3 {r}@2",
    outro: LAST_HELD("[{r} {o}]*4", "{r}@8"),
    only: { verse2: "{r}@3 {r}@3 {r}@2" },
  },
  comp: {
    intro: "x",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    bridge: "x ~ ~ x ~ ~ x ~",
    outro: "<[x*8]!7 x>",
  },
  leadFx: ".delay(.25).delaytime(.45).delayfeedback(.3)",
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A comp on beat 1 and the "and" of 2 (the Charleston), both while the bass holds the root. */
const CHARLESTON = "x [~ x] ~ ~";

/**
 * Jazz-soul: Oak's jazz kit, upright bass, vibes, Rhodes in the choruses and the ending; an organ comps the rock verses
 * under a jazz guitar riff, a jazz guitar strums the bridge under the vibes' riff, strings hold the opening. Swung eighths (from U03,
 * FLAVOUR_RULES) on every track, four-note chords. The bass plays in two (root, fifth) under the verses, holds the
 * root under every comp hit in the choruses (root, root, fifth, third) and the opening.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  sounds: {
    bass: "upright",
    lead: "vibes",
    pad: "strings",
    chords: { intro: "strings", verse: "organ", chorus: "rhodes", bridge: "jazzgtr", outro: "rhodes" },
    riff: { intro: "jazzgtr", verse: "jazzgtr", chorus: "jazzgtr", bridge: "vibes", outro: "jazzgtr" },
  },
  gain: {
    kick: 0.23,
    snare: 0.36,
    hats: 0.23,
    perc: 0.23,
    bass: 0.73,
    chords: 0.44,
    pad: 0.18,
    lead: 0.5,
    riff: 0.51,
  },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  riffPan: 0.66,
  kick: {
    intro: v("<~!4 bd bd [bd ~ bd ~] [bd ~ bd ~]>"),
    verse: v("bd ~ bd ~"),
    chorus: v("bd ~ bd ~"),
    bridge: v("bd ~ ~ bd ~ ~ bd ~"),
    outro: v("<[bd ~ bd ~]!7 bd>"),
  },
  snare: {
    intro: v("<~!6 [~ rim ~ rim] [~ ~ rim ~ sd ~ [sd sd] [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ rim ~ rim]!7 ~>"),
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("<~!4 [~ hh ~ hh]!4>"),
    verse: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    outro: v("<[~ hh ~ hh]!7 ~>"),
  },
  perc: {
    // The opening: a cymbal on bar 1, then the ride from bar 5, with the band.
    intro: v(`<cr ~ ~ ~ [cr, ${RIDE}] [${RIDE}]!3>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    chorus: v("<[cr, rd*8] [rd*8]!3>", V8),
    bridge: v("<[cr, rd*4] [rd*4, [~ ~ ~ ~ ~ ~ lt lt]]!7>"),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!6 cr>`, V8),
    // The choruses are not copies of each other: the tambourine joins the ride on 2 and 4 in the second chorus's last
    // four bars, and on every off-beat in the last chorus.
    only: {
      chorus2: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8, [~ tb]*2] [rd*8, [~ tb]*2]!3>", V8),
      chorus3: v("<[cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!3>", V8),
    },
  },
  bass: {
    intro: "{r}@8",
    verse: "{r}@4 {f}@4",
    chorus: "{r}@2 {r}@2 {f}@2 {t}@2",
    bridge: "{r}@3 {r}@3 {r}@2",
    outro: LAST_HELD("{r}@2 {r}@2 {f}@2 {t}@2", "{r}@8"),
  },
  comp: {
    intro: "x",
    verse: CHARLESTON,
    chorus: CHARLESTON,
    bridge: "x ~ ~ x ~ ~ x ~",
    outro: `<[${CHARLESTON}]!7 x>`,
  },
  leadFx: ".delay(.2).delaytime(.45).delayfeedback(.25)",
  riffFx: ".legato(.6)",
};

// Funk, in sixteenths: the kick and the bass lock on 1, the "a" of 1, the "and" of 2 and the "and" of 3 (and on 3 as
// well in the choruses); the clavinet stabs between them, each over a sounding root or its octave.
const FK_KICK_V = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FK_KICK_C = "bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~";
const FK_BASS_V = "{r}@2 ~ {r}@3 {o}@3 ~ {r}@3 ~@3";
const FK_BASS_C = "{r}@3 {r}@3 {o}@2 {r}@2 {r}@2 {o}@2 ~@2";
const FK_CLAV_V = "~ ~ ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~";
const FK_CLAV_C = "~ ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~";
const FK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";

/**
 * Funk: Oak's 808, finger bass, clavinet, organ tune, a clean guitar riff; acoustic guitar strums the bridge, strings
 * hold the opening. Sixteenths, straight, four-note chords (from U06).
 */
const FUNK: Kit = {
  bank: "oak808",
  depth: "four",
  swing: "",
  sounds: {
    bass: "fingerbass",
    lead: "organ",
    pad: "strings",
    chords: { intro: "strings", verse: "clav", chorus: "clav", bridge: "acgtr", outro: "clav" },
    riff: { intro: "cleangtr", verse: "cleangtr", chorus: "cleangtr", bridge: "cleangtr", outro: "cleangtr" },
  },
  gain: {
    kick: 0.33,
    snare: 0.23,
    hats: 0.13,
    perc: 0.11,
    bass: 0.72,
    chords: 0.69,
    pad: 0.2,
    lead: 0.87,
    riff: 0.74,
  },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  riffPan: 0.68,
  kick: {
    intro: v(`<~!4 [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~]!2 [${FK_KICK_V}]!2>`),
    verse: v(FK_KICK_V),
    chorus: v(FK_KICK_C),
    bridge: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~"),
    outro: v(`<[${FK_KICK_C}]!7 bd>`),
  },
  snare: {
    intro: v(`<~!6 [${FK_BACKBEAT}] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    bridge: v("<[~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~]!7 [~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ sd sd sd sd]>"),
    outro: v(`<[${FK_BACKBEAT}]!7 ~>`),
  },
  hats: {
    intro: v("<~!4 hh*8 hh*8 hh*16 hh*16>", V16),
    verse: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    bridge: v("hh*8", V8),
    outro: v("<[hh*16]!7 ~>", V16),
  },
  perc: {
    intro: v("<cr ~ ~ ~ cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    bridge: v("<[cr, [~ ~ ~ ~ ~ ~ lt lt]] [~ ~ ~ ~ ~ ~ lt lt]!7>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: {
      verse2: v("<[cr, sh*8] [sh*8]!3>", V8),
      // The second chorus: a shaker on the off-beats joins the cowbell in its last four bars.
      chorus2: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb], [~ sh]*4] [[~ cb ~ cb], [~ sh]*4]!3>"),
      chorus3: v("<[cr, [~ cb]*4] [[~ cb]*4]!3>"),
    },
  },
  bass: {
    intro: "{r}@16",
    verse: FK_BASS_V,
    chorus: FK_BASS_C,
    bridge: "{r}@6 {r}@6 {r}@4",
    outro: LAST_HELD(FK_BASS_C, "{r}@16"),
  },
  comp: {
    intro: "x",
    verse: FK_CLAV_V,
    chorus: FK_CLAV_C,
    bridge: "x ~ ~ x ~ ~ x ~",
    outro: `<[${FK_CLAV_C}]!7 x>`,
  },
  leadFx: ".delay(.2).delaytime(.45).delayfeedback(.25)",
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs, a supersaw pad. Every eighth of the acid bar sounds the root or its
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
/** A supersaw pad struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD =
  ".unison(5).detune(.2).attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
/** The riff: a sawtooth pluck, its filter snapping shut on every note. */
const PLUCK = ".lpf(1400).lpenv(2.5).lpd(.1).lps(0).decay(.16).sustain(.15)";

/**
 * Electronic: Oak's 909 in the opening and the choruses; the lo-fi kit in the verses, the bridge and the ending. The
 * opening swells on a supersaw pad over a sine sub, kick from bar 5; the verses ride a boom-bap beat over the sub, the
 * riff a sawtooth pluck, the second verse adding off-beat stabs; the choruses go four on the floor with the acid line
 * and pumping stabs; the bridge sits in half time on the pad and the sub; the ending goes back to the lo-fi kit.
 * Straight, four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", bridge: "lofikit", outro: "lofikit" },
  depth: "four",
  swing: "",
  sounds: {
    bass: "sawtooth",
    lead: "square",
    pad: "supersaw",
    chords: {
      intro: "supersaw",
      verse: "sawtooth",
      chorus: "sawtooth",
      bridge: "supersaw",
      outro: "sawtooth",
    },
    riff: { intro: "sawtooth", verse: "sawtooth", chorus: "sawtooth", bridge: "triangle", outro: "sawtooth" },
  },
  gain: {
    kick: 0.25,
    snare: 0.18,
    hats: 0.12,
    perc: 0.11,
    bass: 0.75,
    chords: 0.35,
    pad: 0.2,
    lead: 0.4,
    riff: 0.59,
  },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  riffPan: 0.65,
  kick: {
    intro: v("<~!4 [bd ~ ~ ~] [bd ~ ~ ~] bd*4 bd*4>"),
    verse: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus: v("bd*4"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    outro: v("<[bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~]!7 bd>"),
  },
  snare: {
    intro: v("<~!6 [~ cp ~ cp] [~ cp ~ [cp cp]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!7 ~>"),
  },
  hats: {
    intro: v("<~!4 [~ hh]*4 [~ hh]*4 [~ hh]*4 [hh oh]*4>", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh oh hh]*4", V16),
    bridge: v("~ hh ~ hh"),
    outro: v("<[hh*8]!7 ~>", V8),
  },
  perc: {
    intro: v("<cr ~ ~ ~ cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!3>"),
    bridge: v("<cr ~ ~ ~ ~ ~ ~ [~ ~ [lt lt] [ht ht]]>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: {
      // The second chorus: a shaker in eighths joins the ride in its last four bars.
      chorus2: v("<[cr, [~ rd]*4] [[~ rd]*4]!3 [cr, [~ rd]*4, sh*8] [[~ rd]*4, sh*8]!3>"),
      chorus3: v("<[cr, rd*8] [rd*8]!3>", V8),
    },
  },
  bass: {
    intro: "{r}",
    verse: "{r}@6 {r}@4 {r}@6",
    chorus: ACID_BAR,
    bridge: "{r}",
    outro: LAST_HELD("{r}@6 {r}@4 {r}@6", "{r}"),
  },
  comp: {
    intro: "x x x x",
    verse: "[~ x]*4",
    chorus: "x*8",
    bridge: "x x x x",
    outro: "<[[~ x]*4]!7 x>",
  },
  leadFx: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.45).delayfeedback(.35)",
  synth: {
    bassSound: { intro: "sine", verse: "sine", chorus: "sawtooth", bridge: "sine", outro: "sine" },
    bass: { intro: SUB, verse: SUB, chorus: ACID, bridge: SUB, outro: SUB },
    chords: {
      intro: PAD,
      verse: STAB,
      chorus: `${STAB}${PUMP}`,
      bridge: PAD,
      outro: '.lpf(1800).lpenv(2).lpd(.12).lps(0).decay("<.22!7 1.5>").sustain("<.3!7 .6>")',
    },
    riff: {
      intro: PLUCK,
      verse: PLUCK,
      chorus: PLUCK,
      bridge: ".decay(.3).sustain(.4).lpf(2600).delay(.25).delaytime(.45).delayfeedback(.3)",
      outro: PLUCK,
    },
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

/** A section's bass line: one bar per chord, the kit's bar with the chord's degrees filled in. */
function bassLine(id: SectionId, bar: BassBar): string {
  const chords = PROGRESSION[id];
  const out = chords.map((name, i) => {
    const c = CHORD[name];
    const text = typeof bar === "string" ? bar : bar(i, chords.length);
    return text.replace(/\{([rfto])\}/g, (_, k: "r" | "f" | "t" | "o") => String(c[k]));
  });
  return bars(out);
}

/** A section's chords: one stack of degrees a bar, voiced by the kit's depth. */
function chordLine(id: SectionId, depth: Kit["depth"]): string {
  return bars(PROGRESSION[id].map((name) => CHORD[name][depth === "four" ? "four" : "triad"]));
}

/** Where the chords and the pad play: the pad holds the opening; the chords play from the second verse on. */
const CHORDS_REST = new Set<SectionId>(["intro", "verse1"]);

/** One flavour's song: the tune first, then the riff, the pad, the chords, the bass and the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const sw = k.swing;
  const riff = mapSections((id) => {
    const notes = GTR_NOTES[id];
    if (notes === null) return null;
    return `n("${notes}").s("${pick(k.sounds.riff, id)}")${syn ? pick(syn.riff, id) : ""}`;
  });
  const pad = mapSections((id) =>
    id === "intro" ? `n("${chordLine(id, k.depth)}").s("${k.sounds.pad}")${syn ? syn.pad : ""}` : null,
  );
  const chords = mapSections((id) => {
    if (CHORDS_REST.has(id)) return null;
    return `n("${chordLine(id, k.depth)}").struct("${pick(k.comp, id)}").s("${pick(k.sounds.chords, id)}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const bass = mapSections((id) => {
    const line = `n("${bassLine(id, pick(k.bass, id))}")`;
    return syn ? `${line}.s("${pick(syn.bassSound, id)}")${pick(syn.bass, id)}` : line;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: ByKind<string | null>): BySection =>
    mapSections((id) => {
      const p = pick(by, id);
      if (p === null || !k.banks) return p;
      return `${p}.bank("${k.banks[id] ?? k.bank}")`;
    });
  // The opening's pad is struck once a bar and held (electronic: on every beat, swelling).
  const padStruct = syn ? `.struct("${pick(k.comp, "intro")}")` : "";
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
      `${MEL_KEYS}${sw}.s("${k.sounds.lead}")${k.leadFx}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "gtr",
      riff,
      `${GTR_KEYS}${sw}${k.riffFx ?? ""}.velocity("${V8}").gain(${num(k.gain.riff)}).pan(${num(k.riffPan)}).room(${num(k.room)})`,
    ),
    track("pad", pad, `${CHORD_KEYS}${padStruct}${sw}.gain(${num(k.gain.pad)}).room(${num(k.room)})`),
    track(
      "chords",
      chords,
      `${CHORD_KEYS}${sw}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${BASS_KEYS}${sw}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
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

export const U14_SONG = defineUnitSong({
  id: "usong.U14",
  unit: "U14",
  version: 2,
  title: "Four colours",
  meter: "4/4",
  key: { tonic: "G", mode: "mixolydian" },
  bpm: 100,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "riff", label: "gtr", role: "melody", name: "Riff", plainName: "Riff" },
    { id: "pad", label: "pad", role: "pad", name: "Pad", plainName: "Pad" },
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
  // By section (AUTHORING §23.6): every U14 Make writes its own pitched parts, so a take hands over whole sections in
  // the Make's own colour and Oak keeps the drums there. Each lesson takes the section on its own home; by the end
  // every pitched part of the song is the learner's.
  plan: [
    take(
      "U14.L01",
      ["verse1"],
      ["riff", "bass"],
      "oak",
      "Your rock riff and its pumping bass play the first verse of the song, with no chords under them.",
    ),
    take(
      "U14.L02",
      ["verse2"],
      ["riff", "chords", "bass"],
      "oak",
      "Your rock loop in G Mixolydian, with a chord on its ♭7, plays the second verse of the song.",
    ),
    take(
      "U14.L03",
      ["chorus1", "chorus2", "chorus3"],
      ["lead", "chords", "bass"],
      "oak",
      "Your two-chord groove on D, with its major IV, plays all three choruses of the song.",
    ),
    take(
      "U14.L04",
      ["intro"],
      ["lead", "pad", "bass"],
      "oak",
      "Your floating line over one held F opens the song, in the eight bars before the first verse.",
    ),
    take(
      "U14.L05",
      ["bridge"],
      ["riff", "chords", "bass"],
      "oak",
      "Your riff on E, pressing on home from a half step above, plays the bridge of the song.",
    ),
    take(
      "U14.L06",
      ["outro"],
      ["riff", "chords", "bass"],
      "oak",
      "Your vamp on D, in the colour you choose, ends the song in its last eight bars.",
    ),
  ],
  releaseAfter: "U14.CP",
});

export default U14_SONG;
