// Song 3, "Home in three keys" (docs/design/songs/makes-core-a.md §8, U03, "the melody song"; AUTHORING §23).
// C major, 4/4, 88 BPM, 61 bars (2:46 at 88). The learner writes the tune in this unit, now in degrees, so the plan
// hands over the tune section by section, and Oak keeps the drums, the bass and the chords.
//
// The form, and the chords one a bar (every section a learner's loop plays in keeps the two-chord vamp its lesson was
// written over, I then IV, so a loop's first bar always lands on I and its second on IV):
//
//   intro 4 · verse1 8 · pre 4 · chorus1 8 · vamp 4 · verse2 8 · bridge 8 · lift 4 · chorus2 8 · outro 4 · end 1
//   C F C F   (C F)×4   C F C F  C F C G | C F G C  C F C F  (G C)×4 in G  (F Bb)×4 in F  C F | F Bb  (= chorus1)  C F C F  C
//
// - The opening teases the hook up high (C5–G5) over the vamp, bass and drums from bar 3.
// - The first verse is low (C4–C5) and walks the home chord, 1 3 5, with a light groove.
// - The pre-chorus climbs (E4–F5), the band builds, and it ends on 7 (B4, an eighth on the "and" of 4) right before
//   the chorus's first note, C5.
// - The chorus is the eight-bar phrase I IV I V | I IV V I: the hook "C C D E C | D C A C", up to G5 in bar 3, a pause
//   on 5 (G4) in bar 4 over V, and home on C5 in bar 8, B4 leading into it. Bass and comp in eighths, crash, clap.
// - The vamp after it is the sing-along: a chant inside C4–A4 (do to la) over stomp-and-clap drums.
// - The second verse moves to G (the scale's key plan, one word per bar): the first verse's tune in G, up high, with
//   an F sharp that leads up to G in bar 7; percussion joins.
// - The bridge is in F, quiet: half-time, long notes in a 3+3+2 rhythm, B flat over the B flat chord, strings in pop
//   and funk, a pad in electronic.
// - The lift plays one two-bar phrase in C, then the same phrase in F (C F | F Bb), and the band builds; B flat to C
//   throws the last chorus back home.
// - The ending plays the hook's head twice, the second time up to G5 and down to C5 over IV (the vamp U03.L10's
//   phrase was written over); one last bar on C rings out (F to C).
//
// Keys: one key plan per pitched track, after its arrange() (STYLE §9, contracts §6.8 item 4), in bars of the song:
// C for 28 bars, G for 8, F for 8, C C F F for the lift, C for 13. The section consts are bare degree patterns. The
// sections in G and F carry their key (`sections[].key`) for U03.L06 and U03.L07; the lift stays in C by the song's
// key, as U03.L05's Make does, and Oak's lift goes to F in its bars 3–4 exactly as the Make's own `<C4:major!2
// F4:major!2>` does.
//
// Clashes (AUTHORING §13, §23.5), read from the evaluated events and `bun run theory`: every tune note held a beat or
// more is a chord tone, a sixth (A over C, D over F, E over G, G over B flat) or a ninth (D over C, G over F), never
// a half step from one: the notes a half step from a chord tone (E over F, B over F, B over C, F♯ over G) are eighths
// that pass between chord tones or lead into the next bar (the pre-chorus's last B, on the "and" of 4, into the
// chorus's C). Over V the tune never holds C. The bass plays roots, fifths and octaves held, and its walks (jazz-soul)
// step to the next root from a whole step above, so no bass note held a beat sits a half step under a chord tone.
// Chords sit from B2 to D4, the tune from C4 to G5.
//
// One builder writes all five flavours (AUTHORING §23.2), so the roots, the bass downbeats and the tune cannot drift.
// A flavour changes the kit, the grooves inside a section, the comp and bass rhythms, swing and chord colour (jazz-soul
// from U03.L01: swung eighths and four-note chords, sixths on I and IV and V7, as the U03 Bands play them;
// content/flavours.ts FLAVOUR_RULES), and production. Gains are levelled by packages/strudel/e2e/songs.pw.ts
// (budget sound-songs.json), so the learner's tune sits on top. Each kit plays only sounds its machine has (sound pack v4: the 909 has no
// shaker, tambourine or cowbell, so electronic uses none of them).
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
  { id: "pre", type: "pre", bars: 4 },
  { id: "chorus1", type: "chorus", bars: 8 },
  // The sing-along after the first chorus: two chords for a crowd to chant over.
  { id: "vamp", type: "vamp", bars: 4 },
  { id: "verse2", type: "verse", bars: 8, key: { tonic: "G", mode: "major" } },
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "F", mode: "major" } },
  // Two bars in C, two in F, by Oak's key plan; the section's key is the song's (U03.L05's Make is in C).
  { id: "lift", type: "lift", bars: 4 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
  // The last bar: the band lands on C together and lets it ring.
  { id: "end", type: "outro", bars: 1 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melVerse`; `melVerse2` for a second verse that plays something else), `silence` where it rests, and one
 * `arrange()` over every section of the song.
 */
function track(label: string, by: BySection, tail: string): { consts: string[]; line: string } {
  const named = new Map<string, string>(); // pattern → const name
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

// ---- Harmony and keys (every flavour) ---------------------------------------------------------------------------

type Fn = "I" | "IV" | "V";
type Key = "C" | "G" | "F";
/** One bar: its chord, as a function in the bar's key. */
interface Bar {
  fn: Fn;
  key: Key;
}
const inKey =
  (key: Key) =>
  (...fns: Fn[]): Bar[] =>
    fns.map((fn) => ({ fn, key }));
const C = inKey("C");
const VAMP: Fn[] = ["I", "IV", "I", "IV"];
const PHRASE: Fn[] = ["I", "IV", "I", "V", "I", "IV", "V", "I"];
const HARMONY: Readonly<Record<SectionId, Bar[]>> = {
  intro: C(...VAMP),
  verse1: C(...VAMP, ...VAMP),
  pre: C(...VAMP),
  chorus1: C(...PHRASE),
  vamp: C(...VAMP),
  verse2: inKey("G")(...VAMP, ...VAMP),
  bridge: inKey("F")(...VAMP, ...VAMP),
  lift: [...C("I", "IV"), ...inKey("F")("I", "IV")],
  chorus2: C(...PHRASE),
  outro: C(...VAMP),
  end: C("I"),
};

/** A track's key plan after its arrange(): one key a bar for the whole song, runs written with `!`. */
function keyPlan(octave: Readonly<Record<Key, number>>): string {
  const keys = SECTIONS.flatMap((s) => HARMONY[s.id].map((b) => `${b.key}${octave[b.key]}:major`));
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
const MEL_KEYS = keyPlan({ C: 4, G: 4, F: 4 });
const CHORD_KEYS = keyPlan({ C: 3, G: 2, F: 2 });
const BASS_KEYS = keyPlan({ C: 2, G: 2, F: 2 });

/**
 * The bass's root of a chord, as a degree on the bass key plan (C2, G2, F2): C2 F2 G1; G1 C2 (G1, so the chord's low
 * B2 sits a tenth above it, not a muddy third); F2 B♭2.
 */
const ROOT: Readonly<Record<Key, Partial<Record<Fn, number>>>> = {
  C: { I: 0, IV: 3, V: -3 },
  G: { I: -7, IV: -4 },
  F: { I: 0, IV: 3 },
};
const rootOf = (b: Bar): number => ROOT[b.key][b.fn] as number;

/**
 * Chord voicings, degrees on the chord key plan (C3, G2, F2), close and low so the tune has the register above C4 to
 * itself. Low: C (C3 E3 G3), F (C3 F3 A3), G (B2 D3 G3) (four notes: F6 as F3 A3 C4 D4, G7 as G2 B2 D3 F3, root
 * first, so the chord reads as IV and V even where the bass rests); in G, G (B2 D3 G3) and C (C3 E3 G3); in F, F (C3 F3 A3) and
 * B♭ (D3 F3 B♭3). High, in the loud parts: C (E3 G3 C4), F (F3 A3 C4), G (D3 G3 B3); in F, F (F3 A3 C4) and B♭ (F3 B♭3
 * D4). Four notes (jazz-soul): the same with the sixth on I and IV and the seventh on V (C6, F6, G7; G6 and C6 in G;
 * F6 and B♭6 in F), never a major seventh (a B under a tune resting on C).
 */
type Register = "low" | "high";
type Depth = "triad" | "four";
const VOICING: Readonly<Record<Key, Record<Register, Record<Depth, Partial<Record<Fn, string>>>>>> = {
  C: {
    low: {
      triad: { I: "0,2,4", IV: "0,3,5", V: "-1,1,4" },
      four: { I: "0,2,4,5", IV: "3,5,7,8", V: "-3,-1,1,3" },
    },
    high: {
      triad: { I: "2,4,7", IV: "3,5,7", V: "1,4,6" },
      four: { I: "2,4,5,7", IV: "3,5,7,8", V: "1,3,4,6" },
    },
  },
  G: {
    low: { triad: { I: "2,4,7", IV: "3,5,7" }, four: { I: "2,4,5,7", IV: "3,5,7,8" } },
    high: { triad: { I: "2,4,7", IV: "3,5,7" }, four: { I: "2,4,5,7", IV: "3,5,7,8" } },
  },
  F: {
    low: { triad: { I: "4,7,9", IV: "5,7,10" }, four: { I: "4,5,7,9", IV: "5,7,8,10" } },
    high: { triad: { I: "7,9,11", IV: "7,10,12" }, four: { I: "7,9,11,12", IV: "7,8,10,12" } },
  },
};
const REGISTER: Readonly<Record<SectionId, Register>> = {
  intro: "low",
  verse1: "low",
  pre: "high",
  chorus1: "high",
  vamp: "low",
  verse2: "low",
  bridge: "low",
  lift: "high",
  chorus2: "high",
  outro: "low",
  end: "low",
};
/** The chords of a section, one a bar, as an `n()` pattern (the last bar adds the top C: C3 E3 G3 C4). */
function chordNotes(id: SectionId, depth: Depth): string {
  if (id === "end") return depth === "four" ? "[0,2,4,5,7]" : "[0,2,4,7]";
  const bars = HARMONY[id].map((b) => `[${VOICING[b.key][REGISTER[id]][depth][b.fn] as string}]`);
  return `<${shortest(bars).join(" ")}>`;
}
/** A one-a-bar list cut to its shortest repeating period, so `<C F C F>` is written `<C F>`. */
function shortest<T>(xs: readonly T[]): T[] {
  for (let p = 1; p < xs.length; p++)
    if (xs.length % p === 0 && xs.every((x, i) => x === xs[i % p])) return xs.slice(0, p);
  return [...xs];
}

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Degrees on the tune's key plan (C4, G4, F4: 0 is home, 7 the home above), eight slots a bar. Each section's tune
// models the lesson that takes it over: a C line that comes home (the opening, U03.L01), 1 3 5 (the first verse,
// L02), a line that climbs past 7 to the high home (the pre-chorus, L04, and the vamp's span, L03 and L08), the same
// phrase in two keys (the lift, L05), the verse in G with its F sharp (L06), a line in F with its B flat (L07), and
// eight bars that pause on 5 and end on 1 (the chorus, L11). The first verse moves mostly by step (L09) and the ending
// answers the hook's head (L10).

const bars = (...b: string[]): string => `<${b.map((x) => `[${x}]`).join(" ")}>`;
const HOOK_HEAD = ["7@2 7 8 9@2 7@2", "8 7 5@2 7@4"];
const VERSE = [
  "0@2 2 4 4@2 2@2",
  "3@2 5 3 0@2 ~@2",
  "4@2 4 5 4@2 2@2",
  "3 2 1@2 0@4",
  "0@2 2 4 7@2 5@2",
  "5 4 3@2 5@2 3@2",
];
const CHORUS = bars(
  ...HOOK_HEAD,
  "7@2 7 8 9@2 11@2",
  "10 9 8@2 4@4",
  "7@2 7 8 9@2 7@2",
  "10@2 9 8 7@2 5@2",
  "8@2 6@2 4 5 6@2",
  "7@6 ~@2",
);
const MEL: BySection = {
  intro: `n("${bars("7@2 7 8 9@4", "8 7 5@2 7@4", "7@2 7 8 9@2 11@2", "10 9 8@2 ~@4")}")`,
  verse1: `n("${bars(...VERSE, "4@2 2 4 5@2 4@2", "3 2 1@2 1@2 ~@2")}")`,
  pre: `n("${bars("2 4 5 6 7@2 4@2", "5@2 3 5 7@2 5@2", "4 5 6 7 8@2 9@2", "10@2 9 8 7@3 6")}")`,
  chorus1: `n("${CHORUS}")`,
  vamp: `n("${bars("4 4 ~ 4 2@2 0@2", "5 5 ~ 5 4@2 3@2", "4 4 ~ 4 2@2 0@2", "3@2 2 1 0@4")}")`,
  verse2: `n("${bars(...VERSE, "4@2 2 4 6 7@3", "3 2 1@2 1@2 ~@2")}")`,
  bridge: `n("${bars("4@3 2@3 0@2", "3@6 1@2", "2@3 4@3 2@2", "3@8", "4@3 5@3 4@2", "5@3 3@3 1@2", "2@3 1@3 0@2", "1@4 ~@4")}")`,
  lift: `n("${bars("0 2 4 7 4 2 4 7", "5 3 5 7 8@4")}")`,
  chorus2: `n("${CHORUS}")`,
  outro: `n("${bars(...HOOK_HEAD, "7@2 7 8 9@2 11@2", "10 9 8@2 7@4")}")`,
  end: null,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

/**
 * One bar of bass on the root `r` (a degree on the bass key plan): `i` is the bar's place in its section, `next` the
 * next bar's root when it is in the same section and key (`null` at a section's end or a key change).
 */
type Cell = (r: number, i: number, next: number | null) => string;
const each =
  (f: (r: number) => string): Cell =>
  (r) =>
    f(r);
/** Silent in the opening's first two bars (the bass comes in with the drums), then `f`. */
const fromBar3 =
  (f: (r: number) => string): Cell =>
  (r, i) =>
    i < 2 ? "~" : f(r);

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the verses, the bridge and the ending). */
  banks?: Partial<Record<SectionId, string>>;
  /** The cymbals and percussion from another kit, when the kit lacks them ("" is the default kit). */
  percBank?: string;
  sounds: { bass: string; chords: string; lead: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
  };
  /** content/flavours.ts production: the chords' room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  /** Four-note chords and swung eighths (jazz-soul from U03.L01). */
  depth: Depth;
  swing?: string;
  kick: BySection;
  snare: BySection;
  hats: BySection;
  perc: BySection;
  /** Bass cells; the downbeat of every bar is the chord's root in every kit. */
  bass: Readonly<Record<SectionId, Cell | null>>;
  /** The chords' rhythm (`struct`) in each section; `chordSound` changes their sound in a section. */
  comp: Readonly<Record<SectionId, string>>;
  chordSound?: Partial<Record<SectionId, string>>;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lead's echo. */
  synth?: {
    bassSound: Readonly<Record<SectionId, string>>;
    bass: Readonly<Record<SectionId, string>>;
    chords: Readonly<Record<SectionId, string>>;
    lead: string;
  };
}

// Grooves shared by the kits: the opening's pickup, the builds of the pre-chorus and the lift, the half-time ending.
const SNARE_PICKUP = "<~ ~ ~ [~ ~ ~ ~ ~ ~ sd sd]>";
const SNARE_PRE = "<[~ sd ~ sd]!2 [~ sd ~ [sd sd]] [sd*8]>";
const SNARE_LIFT = "<[~ sd ~ sd]!2 [sd*8] [sd*16]>";
const SNARE_BRIDGE = "<[~ ~ rim ~]!7 [~ ~ sd [sd sd]]>";
const HATS_BRIDGE = "<[~ hh ~ hh]!7 [hh*8]>";
const HATS_LIFT = "<[hh*8]!2 [hh*16]!2>";
const PERC_CHORUS = "<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb ~ tb]] [~ tb ~ tb]!3>";
const PERC_CHORUS2 = "<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>";

/** Pop: the default kit, piano, picked bass, strings in the bridge. The verses comp in 3+3+2, the loud parts in eighths. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano" },
  gain: { kick: 0.16, snare: 0.13, hats: 0.09, perc: 0.08, bass: 0.43, chords: 0.17, lead: 0.71 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  depth: "triad",
  kick: {
    intro: v("<~ ~ [bd ~ bd ~] [bd ~ bd ~]>"),
    verse1: v("bd ~ ~ bd bd ~ ~ ~"),
    pre: v("<[bd ~ bd ~]!2 [bd bd bd bd]!2>"),
    chorus1: v("bd ~ ~ bd bd ~ bd ~"),
    vamp: v("bd ~ bd ~"),
    verse2: v("bd ~ ~ bd bd ~ ~ bd"),
    bridge: v("<bd!7 [bd ~ ~ ~ bd ~ bd bd]>"),
    lift: v("<[bd ~ bd ~]!2 [bd bd bd bd] [bd*8]>"),
    chorus2: v("bd ~ ~ bd bd ~ bd ~"),
    outro: v("bd ~ ~ bd ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    pre: v(SNARE_PRE),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    vamp: v("~ cp ~ cp"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(SNARE_BRIDGE),
    lift: v(SNARE_LIFT),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    pre: v("hh*8", V8),
    chorus1: v("[hh hh hh oh]*2", V8),
    vamp: v("hh*4", V4),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BRIDGE),
    lift: v(HATS_LIFT),
    chorus2: v("[hh hh hh oh]*2", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    pre: v("<[~ tb ~ tb]!3 [tb*8]>"),
    chorus1: v(PERC_CHORUS),
    vamp: v("tb*8", V8),
    verse2: v("<[cr, [~ sh ~ sh]] [~ sh ~ sh]!7>"),
    bridge: v("<cr ~!7>"),
    lift: v("sh*8", V8),
    chorus2: v(PERC_CHORUS2),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: fromBar3((r) => `[${r} ${r}]`),
    verse1: each((r) => `[${r}@3 ${r} ${r}@3 ${r + 2}]`),
    pre: each((r) => `[${r}*8]`),
    chorus1: each((r) => `[${r} ${r} ${r} ${r} ${r} ${r} ${r} ${r + 2}]`),
    vamp: each((r) => `[${r} ${r + 4}]`),
    verse2: each((r) => `[${r}@3 ${r} ${r}@3 ${r + 2}]`),
    bridge: each((r) => `${r}`),
    lift: each((r) => `[${r}*8]`),
    chorus2: each((r) => `[${r} ${r} ${r} ${r} ${r} ${r} ${r} ${r + 2}]`),
    outro: each((r) => `[${r}@3 ~]`),
    end: each((r) => `${r}`),
  },
  comp: {
    intro: "x x",
    verse1: "x ~ ~ x ~ ~ x ~",
    pre: "x x x x",
    chorus1: "x*8",
    vamp: "x x x x",
    verse2: "x ~ ~ x ~ ~ x ~",
    bridge: "x",
    lift: "<[x x x x]!2 [x*8]!2>",
    chorus2: "x*8",
    outro: "x ~",
    end: "x",
  },
  chordSound: { bridge: "strings" },
};

/**
 * Indie: the rock kit (`LinnDrum`), clean guitar, acoustic lead; the tambourine and shaker from the default kit.
 * The verses sit back (snare on 3); the loud parts go four on the floor; the vamp stomps.
 */
const INDIE: Kit = {
  bank: "LinnDrum",
  percBank: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr" },
  gain: { kick: 0.32, snare: 0.29, hats: 0.19, perc: 0.17, bass: 0.46, chords: 0.36, lead: 1 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  depth: "triad",
  kick: {
    intro: v("<~ ~ [bd ~ bd ~] [bd ~ bd ~]>"),
    verse1: v("bd ~ ~ ~ ~ bd ~ ~"),
    pre: v("<[bd*4]!3 [bd*8]>"),
    chorus1: v("bd*4"),
    vamp: v("bd*4"),
    verse2: v("bd ~ ~ bd ~ bd ~ ~"),
    bridge: v("<bd!7 [bd ~ ~ ~ bd bd bd bd]>"),
    lift: v("<[bd*4]!2 [bd*8]!2>"),
    chorus2: v("bd*4"),
    outro: v("bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    pre: v(SNARE_PRE),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    // Cross-stick on 2 and 4 under the stomp, where pop claps.
    vamp: v("~ rim ~ rim"),
    verse2: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    bridge: v(SNARE_BRIDGE),
    lift: v(SNARE_LIFT),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    pre: v("hh*8", V8),
    chorus1: v("[hh oh]*4", V8),
    vamp: v("[~ oh]*4"),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BRIDGE),
    lift: v(HATS_LIFT),
    chorus2: v("[hh oh]*4", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    pre: v("<[~ tb ~ tb]!3 [tb*8]>"),
    chorus1: v(PERC_CHORUS),
    vamp: v("tb*8", V8),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    bridge: v("<cr ~!7>"),
    lift: v("sh*8", V8),
    chorus2: v(PERC_CHORUS2),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: fromBar3((r) => `[${r} ${r}]`),
    verse1: each((r) => `[${r}@5 ${r}@3]`),
    pre: each((r) => `[${r}*8]`),
    chorus1: each((r) => `[${r} ${r + 7}]*4`),
    vamp: each((r) => `[${r} ${r + 4}]`),
    verse2: each((r) => `[${r}@3 ${r}@2 ${r}@3]`),
    bridge: each((r) => `${r}`),
    lift: each((r) => `[${r}*8]`),
    chorus2: each((r) => `[${r} ${r + 7}]*4`),
    outro: each((r) => `[${r}@3 ~]`),
    end: each((r) => `${r}`),
  },
  comp: {
    intro: "x ~ ~ ~ x ~ ~ ~",
    verse1: "x ~ x ~ x x ~ ~",
    pre: "x*8",
    chorus1: "x*8",
    vamp: "x ~ x ~ x ~ x ~",
    verse2: "x ~ x ~ x x ~ x",
    bridge: "x",
    lift: "<[x x x x]!2 [x*8]!2>",
    chorus2: "x*8",
    outro: "x ~ x ~ ~ ~ ~ ~",
    end: "x",
  },
};

/** The jazz ride: ding, ding-a, ding, ding-a (swung). */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/**
 * A walking bar: root, its octave, the fifth, then a whole step above the next root (the fifth again at a section's
 * end). The root holds through beat 2, under the comp's push.
 */
const walk: Cell = (r, _i, next) => `[${r} ${r + 7} ${r + 4} ${next === null ? r + 4 : next + 1}]`;
const twoFeel = each((r) => `[${r}@2 ${r + 4}@2]`);

/**
 * Jazz-soul: Oak's jazz kit (sticks and brushes), Rhodes, upright bass, vibes. From U03 the kit swings its eighths and
 * plays four-note chords (C6 F6 G7, G6 C6 in G, F6 B♭6 in F). The verses on cross-stick, the hi-hat foot on 2 and 4 and
 * the ride; the bass in two, walking in the pre-chorus, the loud parts, the second verse and the lift.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes" },
  gain: { kick: 0.24, snare: 0.24, hats: 0.16, perc: 0.16, bass: 0.63, chords: 0.28, lead: 0.49 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd ~ ~ ~ ~] [bd ~ ~ bd ~ ~ ~ ~]>"),
    verse1: v("bd ~ ~ bd ~ ~ ~ ~"),
    pre: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    vamp: v("bd ~ ~ ~ bd ~ ~ ~"),
    verse2: v("bd ~ ~ bd ~ ~ bd ~"),
    bridge: v("<bd!7 [bd ~ ~ bd ~ ~ bd ~]>"),
    lift: v("<[bd ~ ~ bd bd ~ ~ ~]!2 [bd ~ bd ~ bd ~ bd ~]!2>"),
    chorus2: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd ~ ~ bd ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    pre: v(SNARE_PRE),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    vamp: v("~ rim ~ rim"),
    verse2: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    bridge: v(SNARE_BRIDGE),
    lift: v("<[~ sd ~ sd]!2 [sd*8]!2>"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ rim ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [~ hh ~ hh] [~ hh ~ hh]>"),
    verse1: v("~ hh ~ hh"),
    pre: v("~ hh ~ hh"),
    chorus1: v("~ hh ~ hh"),
    vamp: v("~ hh ~ hh"),
    verse2: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    lift: v("<[~ hh ~ hh]!2 [hh*8]!2>"),
    chorus2: v("~ hh ~ hh"),
    outro: v("~ hh ~ hh"),
    end: null,
  },
  // The ride carries the time; the crash marks the loud parts.
  perc: {
    intro: v(`<~ ~ [cr, ${RIDE}] [${RIDE}]>`, V8),
    verse1: v(RIDE, V8),
    pre: v(RIDE, V8),
    chorus1: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!3>`, V8),
    vamp: v("rd*4"),
    verse2: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    bridge: v("<cr [rd ~ ~ ~]!7>"),
    lift: v(`<[${RIDE}]!2 [rd*8]!2>`, V8),
    chorus2: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!3>`, V8),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    end: v("cr"),
  },
  bass: {
    intro: fromBar3((r) => `[${r}@2 ${r + 4}@2]`),
    verse1: twoFeel,
    pre: walk,
    chorus1: walk,
    vamp: twoFeel,
    verse2: walk,
    bridge: each((r) => `${r}`),
    lift: walk,
    chorus2: walk,
    outro: each((r) => `[${r}@3 ~]`),
    end: each((r) => `${r}`),
  },
  // Struck where the bass holds the root (beat 1 and the push on the "and" of 2), so a sixth chord reads as I or IV;
  // the push lets go before the bar line, so the swing never drags a chord over the next one.
  comp: {
    intro: "x@3 x@4 ~",
    verse1: "x@3 x@3 ~@2",
    pre: "x@3 x@4 ~",
    chorus1: "x@3 x@4 ~",
    vamp: "x@3 x@4 ~",
    verse2: "x@3 x@4 ~",
    bridge: "x",
    lift: "x@3 x@4 ~",
    chorus2: "x@3 x@4 ~",
    outro: "x@3 x ~@4",
    end: "x",
  },
};

const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FOUR_16 = "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~";
const EIGHTS_16 = "bd ~ bd ~ bd ~ bd ~ bd ~ bd ~ bd ~ bd ~";
const FUNK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FUNK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";
const funkBass = (r: number): string => `[${r} ~ ~ ${r} ~ ~ ${r + 7} ~ ~ ~ ${r} ~ ~ ~ ~ ~]`;
const funkPush = (r: number): string => `[${r} ~ ${r + 7} ${r} ~ ~ ${r + 7} ~ ${r} ~ ${r} ~ ${r + 7} ~ ~ ~]`;

/**
 * Funk: Oak's 808 (`RolandTR808`), clavinet, finger bass, organ lead, strings in the bridge. Sixteenths, straight, in
 * triads until U06 (FLAVOUR_RULES); the kick and the octave-popping bass lock on 1, the "a" of 1, the "and" of 2 and
 * the "and" of 3.
 */
const FUNK: Kit = {
  bank: "RolandTR808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ" },
  gain: { kick: 0.24, snare: 0.17, hats: 0.1, perc: 0.09, bass: 0.58, chords: 0.4, lead: 0.84 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  depth: "triad",
  kick: {
    intro: v(`<~ ~ [${FUNK_KICK}]!2>`),
    verse1: v(FUNK_KICK),
    pre: v(`<[${FOUR_16}]!3 [${EIGHTS_16}]>`),
    chorus1: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    vamp: v("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~"),
    verse2: v(FUNK_KICK),
    bridge: v(`<bd!7 [${FUNK_KICK}]>`),
    lift: v(`<[${FOUR_16}]!2 [${EIGHTS_16}]!2>`),
    chorus2: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    outro: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>"),
    verse1: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    pre: v(`<[${FUNK_CLAP}]!3 [sd*16]>`),
    chorus1: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    vamp: v("~ cp ~ cp"),
    verse2: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    bridge: v(SNARE_BRIDGE),
    lift: v(`<[${FUNK_BACKBEAT}]!2 [sd*8] [sd*16]>`),
    chorus2: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*16] [hh*16]>", V16),
    verse1: v("hh*16", V16),
    pre: v("hh*16", V16),
    chorus1: v("[hh hh hh hh hh hh oh hh]*2", V16),
    vamp: v("[~ hh]*4"),
    verse2: v("hh*16", V16),
    bridge: v("<[hh*8]!7 [hh*16]>"),
    lift: v("hh*16", V16),
    chorus2: v("[hh hh hh hh hh hh oh hh]*2", V16),
    outro: v("hh*8", V8),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    pre: v("<[sh*8]!3 [sh*16]>"),
    chorus1: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    vamp: v("sh*8", V8),
    verse2: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!7>"),
    bridge: v("<cr ~!7>"),
    lift: v("sh*16", V16),
    chorus2: v("<[cr, [~ cb]*4] [[~ cb]*4]!3 [cr, [~ cb]*4] [[~ cb]*4]!3>"),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: fromBar3(funkBass),
    verse1: each(funkBass),
    pre: each((r) => `[${r} ~ ${r} ~]*4`),
    chorus1: each(funkPush),
    vamp: each((r) => `[${r}@8 ${r + 7}@4 ${r}@4]`),
    verse2: each(funkBass),
    bridge: each((r) => `${r}`),
    lift: each((r) => `[${r} ~ ${r} ~]*4`),
    chorus2: each(funkPush),
    outro: each((r) => `[${r}@3 ~]`),
    end: each((r) => `${r}`),
  },
  comp: {
    intro: "~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~",
    verse1: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    pre: "[~ x]*8",
    chorus1: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    vamp: "~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~",
    verse2: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    bridge: "x",
    lift: "<[~ x ~ x ~ x ~ x ~ x ~ x ~ x ~ x]!2 [x*16]!2>",
    chorus2: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    outro: "x ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",
    end: "x",
  },
  chordSound: { bridge: "strings" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. The octave jumps fall between the beats; every
// downbeat is the chord's root, as in every kit.
const acid = (r: number): string => {
  const o = r + 7;
  return `[${r} ~ ${r} ${o} ${r} ~ ${r} ~ ${r} ~ ${o} ${r} ${r} ~ ~ ${r}]`;
};
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/**
 * The 808 kick (funk's `RolandTR808`, the electronic `oak808`) rings for seconds with no choke: hits a beat apart pile
 * up, by up to 7 dB and by the tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9
 * at 96). A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** A supersaw pad struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: Oak's 909-style machine and the lo-fi kit. The verses, the bridge and the ending sit on the lo-fi kit, a
 * broken beat over a sine sub and off-beat stabs; the pre-chorus, the loud parts and the lift go four on the floor on
 * the 909 with the acid line and pumping stabs; the opening, the vamp and the bridge swell on a supersaw pad. A square
 * pluck with a dotted-eighth echo plays the tune. Straight and in triads until U06.L10 (FLAVOUR_RULES).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", bridge: "lofikit", outro: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square" },
  gain: { kick: 0.23, snare: 0.09, hats: 0.06, perc: 0.05, bass: 0.44, chords: 0.19, lead: 0.34 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  depth: "triad",
  kick: {
    intro: v("<~ ~ [bd*4] [bd*4]>"),
    verse1: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    pre: v("<[bd*4]!3 [bd*8]>"),
    chorus1: v("bd*4"),
    vamp: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v("<bd!7 [bd ~ bd ~]>"),
    lift: v("<[bd*4]!2 [bd*8] [bd*16]>"),
    chorus2: v("bd*4"),
    outro: v("bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    pre: v("<[~ cp ~ cp]!3 [cp*8]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    vamp: v("~ cp ~ cp"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(SNARE_BRIDGE),
    lift: v("<[~ cp ~ cp]!2 [cp*8] [sd*16]>"),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh hh oh hh]*4 [hh hh oh hh]*4>", V16),
    verse1: v("hh*8", V8),
    pre: v("[hh hh oh hh]*4", V16),
    chorus1: v("[hh hh oh hh]*4", V16),
    vamp: v("[~ oh]*4"),
    verse2: v("hh*8", V8),
    bridge: v(HATS_BRIDGE),
    lift: v(HATS_LIFT),
    chorus2: v("[hh hh oh hh]*4", V16),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    pre: v("<~!3 [~ ~ [lt lt] [ht ht]]>"),
    chorus1: v("<cr ~!3 cr ~!3>"),
    vamp: v("<cr ~!3>"),
    verse2: v("<[cr, [~ rd ~ rd]] [~ rd ~ rd]!7>"),
    bridge: v("<cr ~!7>"),
    lift: v("<~!2 [~ ~ [lt lt] [ht ht]]!2>"),
    chorus2: v("<cr ~!3 cr ~!3>"),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: fromBar3((r) => `[${r}@2 ${r}@2]`),
    verse1: each((r) => `[${r}@6 ${r}@4 ${r}@6]`),
    pre: each(acid),
    chorus1: each(acid),
    vamp: each((r) => `[${r}@2 ${r}@2]`),
    verse2: each((r) => `[${r}@6 ${r}@4 ${r}@6]`),
    bridge: each((r) => `${r}`),
    lift: each(acid),
    chorus2: each(acid),
    outro: each((r) => `[${r}@3 ~]`),
    end: each((r) => `${r}`),
  },
  comp: {
    intro: "x*4",
    verse1: "~ x ~ x ~ x ~ x",
    pre: "x*8",
    chorus1: "x*8",
    vamp: "x*4",
    verse2: "~ x ~ x ~ x ~ x",
    bridge: "x*4",
    lift: "<[~ x ~ x ~ x ~ x]!2 [x*8]!2>",
    chorus2: "x*8",
    outro: "~ x ~ x ~ ~ ~ ~",
    end: "x",
  },
  chordSound: { intro: "supersaw", vamp: "supersaw", bridge: "supersaw" },
  synth: {
    bassSound: {
      intro: "sine",
      verse1: "sine",
      pre: "sawtooth",
      chorus1: "sawtooth",
      vamp: "sine",
      verse2: "sine",
      bridge: "sine",
      lift: "sawtooth",
      chorus2: "sawtooth",
      outro: "sine",
      end: "sine",
    },
    bass: {
      intro: SUB,
      verse1: SUB,
      pre: ACID,
      chorus1: ACID,
      vamp: SUB,
      verse2: SUB,
      bridge: SUB,
      lift: ACID,
      chorus2: ACID,
      outro: SUB,
      end: SUB,
    },
    chords: {
      intro: PAD,
      verse1: STAB,
      pre: `${STAB}${PUMP}`,
      chorus1: `${STAB}${PUMP}`,
      vamp: PAD,
      verse2: STAB,
      bridge: PAD,
      lift: `${STAB}${PUMP}`,
      chorus2: `${STAB}${PUMP}`,
      outro: STAB,
      end: ".lpf(1800).decay(1.5).sustain(.5)",
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.51).delayfeedback(.35)",
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

/** A section's bass, one cell a bar on the chord's root. */
function bassNotes(id: SectionId, cell: Cell): string {
  const harmony = HARMONY[id];
  const cells = harmony.map((b, i) => {
    const n = harmony[i + 1];
    const c = cell(rootOf(b), i, n && n.key === b.key ? rootOf(n) : null);
    return c.startsWith("[") || c === "~" || !c.includes(" ") ? c : `[${c}]`;
  });
  return cells.length === 1 ? (cells[0] as string) : `<${shortest(cells).join(" ")}>`;
}

/** One flavour's song: the tune first, then the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const swing = k.swing ?? "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `n("${chordNotes(id, k.depth)}").struct("${k.comp[id]}").s("${sound}")${syn?.chords[id] ?? ""}`;
  });
  const bass = mapSections((id) => {
    const cell = k.bass[id];
    if (cell === null) return null;
    const notes = `n("${bassNotes(id, cell)}")`;
    return syn ? `${notes}.s("${syn.bassSound[id]}")${syn.bass[id]}` : notes;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: BySection, bank = k.bank): { by: BySection; tail: string } =>
    k.banks
      ? {
          by: mapSections((id) => (by[id] === null ? null : `${by[id]}.bank("${k.banks?.[id] ?? bank}")`)),
          tail: "",
        }
      : { by, tail: bank ? `.bank("${bank}")` : "" };
  const drumTrack = (label: "kick" | "snare" | "hats" | "perc", gain: number, bank?: string) => {
    const d = drums(k[label], bank);
    const choke = label === "kick" && /^(RolandTR808|oak808)$/.test(k.bank) ? KICK_808 : "";
    return track(label, d.by, `${d.tail}${swing}${choke}.gain(${num(gain)})`);
  };
  const tracks = [
    track(
      "mel",
      MEL,
      `${MEL_KEYS}.s("${k.sounds.lead}")${syn?.lead ?? ""}${swing}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(.3)`,
    ),
    track(
      "chords",
      chords,
      `${CHORD_KEYS}${swing}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${BASS_KEYS}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    drumTrack("kick", k.gain.kick),
    drumTrack("snare", k.gain.snare),
    drumTrack("hats", k.gain.hats),
    drumTrack("perc", k.gain.perc, k.percBank),
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

export const U03_SONG = defineUnitSong({
  id: "usong.U03",
  unit: "U03",
  version: 1,
  title: "Home in three keys",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 88,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
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
  // By part (AUTHORING §23.6): the learner writes the tune, so each step hands over the tune of one section (two for
  // the eight-bar melody, which is the chorus). Two steps rework a section the learner already owns: U03.L08 brings
  // the U03.L03 line it starts from inside a singable range, in the same place; U03.L09 writes the first verse's tune
  // again, four bars that move by step. By the unit's end every bar of the tune is the learner's.
  plan: [
    take(
      "U03.L01",
      ["intro"],
      ["lead"],
      "oak",
      "Your line on the white keys, ending on c, opens the song in its first four bars.",
    ),
    take(
      "U03.L02",
      ["verse1"],
      ["lead"],
      "oak",
      "Your first line written in numbers plays the eight bars after the opening.",
    ),
    take(
      "U03.L03",
      ["vamp"],
      ["lead"],
      "U03.L02",
      "Your line from Degrees in Code, reaching past home, plays the four bars after the first loud part.",
    ),
    take(
      "U03.L04",
      ["pre"],
      ["lead"],
      "U03.L03",
      "Your line from Restless Neighbours, with a 6 and a 7 added, leads into the first loud part.",
    ),
    take(
      "U03.L05",
      ["lift"],
      ["lead"],
      "U03.L04",
      "Your line from Leading Tone & Six plays in C, then in F, just before the last loud part.",
    ),
    take(
      "U03.L06",
      ["verse2"],
      ["lead"],
      "oak",
      "Your line in G, with every F sharp, plays the eight bars of the song that move to G.",
    ),
    take(
      "U03.L07",
      ["bridge"],
      ["lead"],
      "oak",
      "Your line in F, with every B flat, plays the quiet eight bars of the song in F.",
    ),
    take(
      "U03.L08",
      ["vamp"],
      ["lead"],
      "U03.L03",
      "Your line from Restless Neighbours, made narrow enough to sing, becomes the sing-along after the first loud part.",
    ),
    take(
      "U03.L09",
      ["verse1"],
      ["lead"],
      "oak",
      "A four-bar tune that moves mostly by step takes over the eight bars after the opening.",
    ),
    take(
      "U03.L10",
      ["outro"],
      ["lead"],
      "oak",
      "Your answer to the first two bars of an old tune ends the song, just before its last chord.",
    ),
    take(
      "U03.L11",
      ["chorus1", "chorus2"],
      ["lead"],
      "oak",
      "Your eight bars that end on home become both loud parts of the song.",
    ),
  ],
  releaseAfter: "U03.CP",
});

export default U03_SONG;
