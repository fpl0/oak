// Song 9, "Turn it around" (docs/design/songs/makes-core-b.md "U09 song (form)"; AUTHORING §23). C major, 4/4,
// 100 BPM, 64 bars: the unit on form gets a whole pop song in nine sections.
//
//   intro 4 | verse 8 | chorus 8 | verse 8 | chorus 8 | B 8 | A 4 | chorus 8 | outro 8
//   C Am F G | (C Am F G)×2 | (F G C C)×2 | … | (F Em Dm G)×2 | C Am F G | (F G C C)×2 | C F C G C F G C
//
// The harmony is the unit's own: verse I vi IV V and chorus IV V I I (U09.L02, L04, L05, U09.CP), a bridge on
// IV iii ii V that starts away from home and stops on V (U09.L03), and an ending on the eight-bar phrase that asks
// on V and answers on I (U09.L01's Band, `band.phrase-8bar`). Two sections are typed by letter, `b` and `a`, because
// U09.L03's Make writes its form as A A B A (`chordsA`, `melB`) and a learner `arrange()` maps onto the song by type
// (spec §5.2, §10a call 3): its B fills the eight bars after the second chorus, its first A the four bars after that,
// the verse coming back half as long before the last chorus, as A comes back after the bridge.
//
// Oak's song models each lesson before the learner takes it over: four-bar phrases with a crash where each begins
// and a tune that asks and answers (L01), a verse and a chorus that lifts on new chords, a higher tune and a
// tambourine (L02), a bridge that wanders and returns to A (L03), a section whose energy climbs into the last chorus
// (hats rising on a `saw`, the band thickening bar by bar: L04's idea), and an intro whose parts come in one at a time
// plus a bass that drops out for the bar before each chorus (`.mask()`'s moves, L05).
//
// Version 2 (Oak 2.0 W2, the music-fix protocol of docs/superpowers/plans/2026-11-25-oak2-w2.md): the second verse and
// the second chorus no longer copy the first ones' drums (audit-core U09 "Repeats varied", agreed by the X4
// cross-check: open hats and a tambourine on 4 in verse2, the "and" of 4 on the kick and an off-beat tambourine in
// chorus2, chorus3 keeping its own); and the outro ends the way U09.L06 Endings teaches, the parts leaving in the
// reverse of the intro's order: Oak's chords stop after bar 62, the bass after bar 63, and the kick and a crash play
// bar 64 alone with the tune's last note (checked with `ends-on-purpose { modes: ["exit-order"] }` on Oak's chords,
// bass and drums).
//
// Every flavour plays the same notes (tune, bass roots on every downbeat, chord roots); a flavour changes sounds,
// grooves, comp and bass rhythms, and chord colour as its kit's staging allows at U09 (content/flavours.ts
// FLAVOUR_RULES): pop and indie play triads, straight; jazz-soul swings (1/3) with four-note chords; funk and
// electronic play four-note chords, straight. The four-note chords are sixths on I and IV and sevenths elsewhere
// (C6 F6 G7 Am7 Em7 Dm7), never a major seventh under the tune (content/bands/index.ts). Wherever a four-note chord
// is struck over the bass, the bass sounds its root, so C6 never reads as Am7 or F6 as Dm7; the only chords struck
// with the bass resting are the G7s of the bar before a chorus, which read as G on their own. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top. Tune and bass hold no note a half step above a sounding chord tone
// (AUTHORING §13); every claim here is read off the evaluated events (content/validate/unit-songs.ts).
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
  // U09.L03's B (the bridge of its A A B A) and its A: typed by letter so the learner's `melB` and `melA` land here.
  { id: "bridge", type: "b", bars: 8 },
  { id: "reprise", type: "a", bars: 4 },
  { id: "chorus3", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 8 },
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
// One chord a bar. Voiced close and low (C3 to A3) so every change moves each voice a step or two, and the tune, from
// C4 up, has the register above the chords to itself; the choruses lift the voicing to F3–E4 under a tune that
// starts on C5. The four-note set is the Bands': C6 (C E G A), Am7 (A C E G), F6 (C D F A), G7 (B D F G), Em7
// (B D E G), Dm7 (A C D F). Bass: roots C2 A2 F2 G2 E2 D2, with the fifth, the third and the octave for the
// patterns that walk or pop.

type ChordName = "C" | "Am" | "F" | "G" | "Em" | "Dm";
interface Chord {
  /** Bass notes: root, fifth, third, octave. */
  r: string;
  f: string;
  t: string;
  o: string;
  triad: { low: string; high?: string };
  four: { low: string; high?: string };
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  C: {
    r: "c2",
    f: "g2",
    t: "e2",
    o: "c3",
    triad: { low: "c3,e3,g3", high: "g3,c4,e4" },
    four: { low: "c3,e3,g3,a3", high: "e3,g3,a3,c4" },
  },
  Am: { r: "a2", f: "e3", t: "c3", o: "a3", triad: { low: "c3,e3,a3" }, four: { low: "a2,c3,e3,g3" } },
  F: {
    r: "f2",
    f: "c3",
    t: "a2",
    o: "f3",
    triad: { low: "c3,f3,a3", high: "f3,a3,c4" },
    four: { low: "c3,d3,f3,a3", high: "f3,a3,c4,d4" },
  },
  G: {
    r: "g2",
    f: "d3",
    t: "b2",
    o: "g3",
    triad: { low: "b2,d3,g3", high: "g3,b3,d4" },
    four: { low: "b2,d3,f3,g3", high: "f3,g3,b3,d4" },
  },
  Em: { r: "e2", f: "b2", t: "g2", o: "e3", triad: { low: "b2,e3,g3" }, four: { low: "b2,d3,e3,g3" } },
  Dm: { r: "d2", f: "a2", t: "f2", o: "d3", triad: { low: "a2,d3,f3" }, four: { low: "a2,c3,d3,f3" } },
};
const LOOP: ChordName[] = ["C", "Am", "F", "G"];
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: LOOP,
  verse1: [...LOOP, ...LOOP],
  chorus1: ["F", "G", "C", "C", "F", "G", "C", "C"],
  verse2: [...LOOP, ...LOOP],
  chorus2: ["F", "G", "C", "C", "F", "G", "C", "C"],
  bridge: ["F", "Em", "Dm", "G", "F", "Em", "Dm", "G"],
  reprise: LOOP,
  chorus3: ["F", "G", "C", "C", "F", "G", "C", "C"],
  outro: ["C", "F", "C", "G", "C", "F", "G", "C"],
};
/** The choruses sit higher; everything else low. */
const HIGH = new Set<SectionId>(["chorus1", "chorus2", "chorus3"]);

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eighth notes to a bar (`@` holds). The verse asks in four bars and answers in four that start the same way, in the
// middle of the voice (C4–C5); the question stops open on D over G, the answer on G over G, so the chorus can arrive.
// The chorus hook climbs by step bar by bar (C A C over F, D B D over G, E C G over C), every held note a chord tone,
// and peaks on G5 late. The B section sings half notes, a falling sequence (C A, B G, A F) twice, the second time an
// octave-ish higher, and stops open on G over V. The A section brings the verse's question back. The ending is the
// eight bars U09.L01 is about: a question that stops on D over G, an answer that starts the same way and lands on C.

const V_Q = ["e4 ~ g4 ~ e4 d4 c4 ~", "e4 ~ a4 ~ c5 ~ a4 ~", "a4 ~ c5 ~ a4 g4 f4 ~", "g4@3 d4@3 ~@2"];
const V_A = ["e4 ~ g4 ~ e4 d4 c4 ~", "e4 ~ a4 ~ c5 ~ a4 ~", "f4 ~ a4 ~ c5 ~ a4 ~", "b4@3 a4 g4@4"];
const HOOK = [
  "c5@3 a4@3 c5@2",
  "d5@3 b4@3 d5@2",
  "e5@3 c5@3 g4@2",
  "c5@5 ~ g4 a4",
  "c5@3 a4@3 c5@2",
  "d5@3 b4@3 d5@2",
  "e5@3 g5@3 e5@2",
  "d5@2 c5@6",
];
const B_TUNE = [
  "c5@4 a4@4",
  "b4@4 g4@4",
  "a4@4 f4@4",
  "g4@4 b4@2 d5@2",
  "f5@4 c5@4",
  "e5@4 b4@4",
  "d5@4 a4@4",
  "b4@2 a4@2 g4@4",
];
const ENDING = [
  "c4 e4 g4 e4",
  "f4 a4 f4 ~",
  "e4 g4 e4 c4",
  "d4",
  "c4 e4 g4 e4",
  "f4 a4 f4 ~",
  "d4 f4 d4 b3",
  "c4",
];

const MEL: BySection = {
  // The tune waits, then leads in on beat 4 of the last bar, B D into the verse's E.
  intro: `note("${bars(["~", "~", "~", "~ ~ ~ ~ ~ ~ b3 d4"])}")`,
  verse1: `note("${bars([...V_Q, ...V_A])}")`,
  chorus1: `note("${bars(HOOK)}")`,
  verse2: `note("${bars([...V_Q, ...V_A])}")`,
  chorus2: `note("${bars(HOOK)}")`,
  bridge: `note("${bars(B_TUNE)}")`,
  reprise: `note("${bars(V_Q)}")`,
  chorus3: `note("${bars(HOOK)}")`,
  outro: `note("${bars(ENDING)}")`,
};
/** The second line: the last chorus doubled an octave down on another sound. */
const VOX: BySection = {
  intro: null,
  verse1: null,
  chorus1: null,
  verse2: null,
  chorus2: null,
  bridge: null,
  reprise: null,
  chorus3: `note("${bars(HOOK)}").transpose(-12)`,
  outro: null,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;
/** The build's hats: a steady line whose velocity climbs over the four bars (a signal, U09.L04). */
const RISING = (mini: string, from = 0.3): string =>
  `s("${mini}").velocity(saw.range(${num(from)}, 1).slow(4))`;

/**
 * A bass bar: `{r}` root, `{f}` fifth, `{t}` third, `{o}` octave of the bar's chord, or `~` for a bar of rest. A
 * function gets the bar's index in its section and the section's length.
 */
type BassBar = string | ((i: number, n: number) => string);

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the verses, the B section and the ending). */
  banks?: Partial<Record<SectionId, string>>;
  /** Four-note chords (jazz-soul, funk, electronic at U09) or triads. */
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

/**
 * Bass bars that change bar by bar: the intro brings the bass in at bar 2, the A section drops it for bar 4, and the
 * ending lets it go before the last bar.
 */
const INTRO_IN =
  (bar: string): BassBar =>
  (i) =>
    i === 0 ? "~" : bar;
const LAST_OUT =
  (bar: string): BassBar =>
  (i, n) =>
    i === n - 1 ? "~" : bar;
const BUILD_BASS =
  (one: string, two: string, three: string): BassBar =>
  (i) =>
    [one, two, three, "~"][i] ?? "~";

/** Pop: the default kit, piano, picked bass; the kick and the bass lock on 1, the "and" of 2 and 3. */
const POP: Kit = {
  bank: "",
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", vox: "strings" },
  gain: { kick: 0.21, snare: 0.17, hats: 0.11, perc: 0.09, bass: 0.62, chords: 0.22, lead: 0.64, vox: 0.34 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<[bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ bd bd ~ ~ ~]!3>"),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd bd ~ bd ~"),
    b: v("bd ~ ~ ~ ~ ~ bd ~"),
    a: v("<bd [bd ~ bd ~] [bd bd bd bd] [bd bd bd bd]>"),
    outro: v("<[bd ~ ~ bd bd ~ ~ ~]!7 bd>"),
    only: { chorus2: v("bd ~ ~ bd bd ~ bd bd") },
  },
  snare: {
    intro: v("<~ [~ sd ~ sd] [~ sd ~ sd] [~ sd [~ sd] [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    b: v("<[~ ~ rim ~]!7 [~ ~ sd [sd sd]]>"),
    a: v("<~ [~ ~ sd ~] [~ sd ~ sd] [[sd sd sd sd] [sd*8]]>"),
    outro: v("<[~ sd ~ sd]!6 [~ sd [~ sd] [sd sd]] ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh hh oh]*2", V8),
    b: null,
    a: RISING("hh*16"),
    outro: v("<[hh*8]!7 ~>", V8),
    only: { verse2: v("hh hh hh hh hh hh hh oh", V8) },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    b: v("<[cr, rd*4] [rd*4]!7>"),
    a: v("<~ ~ [sh*8] [sh*16]>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: {
      verse2: v("<[cr, [~ ~ ~ tb]] [~ ~ ~ tb]!3>"),
      chorus2: v("<[cr, [~ tb]*4] [[~ tb]*4]!3>"),
      chorus3: v("<[cr, tb*8] [tb*8]!3>"),
    },
  },
  bass: {
    intro: (i) => ["~", "{r}@4 {r}@4", "{r}@3 {r} {r}@4", "{r}*8"][i] ?? "~",
    verse: LAST_OUT("{r}@3 {r} {r}@4"),
    chorus: "{r} {r} {r} {r} {r} {r} {r} {o}",
    b: "{r}@4 {f}@4",
    a: BUILD_BASS("{r}@8", "{r}@4 {r}@4", "{r} {r} {r} {r}"),
    outro: LAST_OUT("{r}@3 {r} {r}@4"),
  },
  comp: {
    intro: "<~ ~ [x x x x] [x x x x]>",
    verse: "x x x x",
    chorus: "x*8",
    b: "x ~ x ~",
    a: "<x [x ~ x ~] [x x x x] [x*8]>",
    outro: "<[x x x x]!6 ~ ~>",
  },
};

/** Indie: the rock kit, clean guitar, acoustic lead. The verses push in 3-3-2; the choruses go four on the floor. */
const INDIE: Kit = {
  bank: "rockkit",
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "organ" },
  gain: { kick: 0.44, snare: 0.37, hats: 0.25, perc: 0.22, bass: 0.6, chords: 0.47, lead: 1, vox: 0.57 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<[bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ bd ~ ~ bd ~]!3>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus: v("bd*4"),
    b: v("bd ~ ~ ~ ~ ~ ~ ~"),
    a: v("<bd [bd ~ bd ~] [bd*4] [bd*8]>"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!7 bd>"),
    only: { chorus2: v("bd bd bd [bd bd]") },
  },
  snare: {
    intro: v("<~ [~ ~ sd ~] [~ ~ sd ~] [~ ~ sd [sd sd]]>"),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    b: v("<[~ ~ rim ~]!7 [~ ~ rim [sd sd]]>"),
    a: v("<~ [~ ~ sd ~] [~ sd ~ sd] [[sd sd sd sd] [sd*8]]>"),
    outro: v("<[~ ~ sd ~]!6 [~ ~ sd [sd sd]] ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh oh]*4", V8),
    b: null,
    a: RISING("hh*16"),
    outro: v("<[hh*8]!7 ~>", V8),
    only: { verse2: v("hh hh hh hh hh hh hh oh", V8) },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    // The B section rolls on the floor tom under the guitar's long chords.
    b: v("<[cr, [lt ~ lt lt ~ lt ~ ~]] [lt ~ lt lt ~ lt ~ ~]!7>"),
    a: v("<~ ~ [sh*8] [sh*16]>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: {
      verse2: v("<[cr, [~ ~ ~ tb]] [~ ~ ~ tb]!3>"),
      chorus2: v("<[cr, [~ tb]*4] [[~ tb]*4]!3>"),
      chorus3: v("<[cr, tb*8] [tb*8]!3>"),
    },
  },
  bass: {
    intro: (i) => ["~", "{r}@4 {r}@4", "{r}@3 {r}@3 {r}@2", "{r}@3 {r}@3 {r}@2"][i] ?? "~",
    verse: LAST_OUT("{r}@3 {r}@3 {r}@2"),
    chorus: "[{r} {o}]*4",
    b: "{r}@8",
    a: BUILD_BASS("{r}@8", "{r}@4 {r}@4", "{r} {r} {r} {r}"),
    outro: LAST_OUT("{r}@3 {r}@3 {r}@2"),
  },
  comp: {
    intro: "<~ ~ [x@3 x@3 x@2] [x@3 x@3 x@2]>",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    b: "x",
    a: "<x [x ~ x ~] [x x x x] [x*8]>",
    outro: "<[x@3 x@3 x@2]!6 ~ ~>",
  },
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A Rhodes comp on beat 1 and the "and" of 2 (the Charleston), both over the bass's root. */
const JAZZ_COMP = "x [~ x] ~ ~";

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, a tenor saxophone doubling the last chorus. Swung eighths and
 * four-note chords (from U03, FLAVOUR_RULES). Cross-stick and the hi-hat on 2 and 4 in the verses, the snare and the ride in the
 * choruses; the bass plays root and fifth in two, and walks root, root, fifth, third in the choruses.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "tenor" },
  gain: { kick: 0.24, snare: 0.37, hats: 0.23, perc: 0.23, bass: 0.77, chords: 0.47, lead: 0.44, vox: 0.39 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<[bd ~ ~ ~] [bd ~ bd ~]!3>"),
    verse: v("bd ~ bd ~"),
    chorus: v("bd ~ bd ~"),
    b: v("bd ~ ~ ~"),
    a: v("<bd [bd ~ bd ~] [bd bd bd bd] [bd bd bd bd]>"),
    outro: v("<[bd ~ bd ~]!7 bd>"),
    only: { chorus2: v("bd ~ bd [~ bd]") },
  },
  snare: {
    intro: v("<~ [~ rim ~ rim] [~ rim ~ rim] [~ rim ~ [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    // Half time: the snare on 3.
    b: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    a: v("<~ [~ ~ rim ~] [~ sd ~ sd] [sd*8]>"),
    outro: v("<[~ rim ~ rim]!6 [~ rim [~ sd] [sd sd]] ~>"),
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("~ hh ~ hh"),
    verse: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    b: v("~ hh ~ hh"),
    a: RISING("<[~ hh ~ hh]!2 [hh*8]!2>", 0.5),
    outro: v("<[~ hh ~ hh]!7 ~>"),
  },
  perc: {
    intro: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    chorus: v("<[cr, rd*8] [rd*8]!3>", V8),
    // The ride in quarters.
    b: v("<[cr, rd*4] [rd*4]!7>"),
    a: v(`<[${RIDE}]!2 [rd*8]!2>`, V8),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!2 cr>`, V8),
    only: {
      verse2: v(`<[cr, ${RIDE}, [~ ~ ~ tb]] [${RIDE}, [~ ~ ~ tb]]!3>`, V8),
      chorus2: v("<[cr, rd*8, [~ tb ~ tb]] [rd*8, [~ tb ~ tb]]!3>", V8),
      chorus3: v("<[cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!3>"),
    },
  },
  bass: {
    intro: INTRO_IN("{r}@2 {f}@2"),
    verse: LAST_OUT("{r}@2 {f}@2"),
    chorus: "{r} {r} {f} {t}",
    b: "{r}@2 {f}@2",
    a: BUILD_BASS("{r}@4", "{r}@2 {f}@2", "{r} {r} {f} {t}"),
    outro: LAST_OUT("{r}@2 {f}@2"),
  },
  comp: {
    intro: `<~ ~ [${JAZZ_COMP}] [${JAZZ_COMP}]>`,
    verse: JAZZ_COMP,
    chorus: JAZZ_COMP,
    b: "x",
    a: `<x [${JAZZ_COMP}] [${JAZZ_COMP}] [${JAZZ_COMP}]>`,
    outro: `<[${JAZZ_COMP}]!6 ~ ~>`,
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
 * Funk: Oak's 808, clavinet, finger bass, organ lead, horns doubling the last chorus. Sixteenths, straight, four-note
 * chords (from U06). In the B section strings hold the chords over a half-time beat.
 */
const FUNK: Kit = {
  bank: "oak808",
  depth: "four",
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "horns" },
  gain: { kick: 0.3, snare: 0.21, hats: 0.12, perc: 0.1, bass: 0.64, chords: 0.49, lead: 0.79, vox: 0.61 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<[bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~] [${FK_KICK_V}]!3>`),
    verse: v(FK_KICK_V),
    chorus: v(FK_KICK_C),
    b: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    a: v("<bd [bd ~ bd ~] [bd*4] [bd*8]>"),
    outro: v(`<[${FK_KICK_V}]!7 bd>`),
    only: { chorus2: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ bd ~") },
  },
  snare: {
    intro: v(`<~ [${FK_BACKBEAT}] [${FK_BACKBEAT}] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    b: v("<[~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~]!7 [~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ sd sd sd sd]>"),
    a: v("<~ [~ ~ sd ~] [~ sd ~ sd] [sd*16]>"),
    outro: v(`<[${FK_BACKBEAT}]!6 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ sd sd sd sd] ~>`),
  },
  hats: {
    intro: v("hh*16", V16),
    verse: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    b: v("hh*8", V8),
    a: RISING("hh*16"),
    outro: v("<[hh*16]!7 ~>", V16),
    only: { verse2: v("[hh hh hh hh hh hh oh hh]*2", V16) },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    b: v("<cr ~!7>"),
    a: v("<~ ~ [sh*8] [sh*16]>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: {
      verse2: v("<[cr, [~ ~ ~ cb]] [~ ~ ~ cb]!3>"),
      chorus2: v("<[cr, [~ cb ~ [cb cb]]] [~ cb ~ [cb cb]]!3>"),
      chorus3: v("<[cr, [~ cb]*4] [[~ cb]*4]!3>"),
    },
  },
  bass: {
    intro: INTRO_IN(FK_BASS_V),
    verse: LAST_OUT(FK_BASS_V),
    chorus: FK_BASS_C,
    b: "{r}@8 {f}@8",
    a: BUILD_BASS("{r}", "{r} {r} {r} {r}", "{r}*8"),
    outro: LAST_OUT(FK_BASS_V),
  },
  comp: {
    intro: `<~ ~ [${FK_CLAV_V}] [${FK_CLAV_V}]>`,
    verse: FK_CLAV_V,
    chorus: FK_CLAV_C,
    b: "x",
    a: "<x [x ~ x ~] [x*8] [x*16]>",
    outro: `<[${FK_CLAV_V}]!6 ~ ~>`,
  },
  chordSound: { bridge: "strings" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. Every eighth of the acid bar sounds the root or its
// octave, so each stab and each pad chord has its root under it.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {r}";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The build: the same acid, its filter envelope opening wider bar by bar. */
const ACID_RISING =
  '.lpq(12).ftype("ladder").lpenv(saw.range(1, 5).slow(4)).lpd(.14).lps(0).decay(.2).sustain(.4)';
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
 * Electronic: Oak's 909 in the intro, the choruses and the build; the lo-fi kit in the verses, the B section and the
 * ending. The verses sit on a boom-bap beat over a sine sub and off-beat stabs; the choruses go four on the floor with
 * the acid line and pumping stabs; the B section swells on a supersaw pad in half time; the A section builds (the
 * acid's filter and the stabs' cutoff open over four bars, kick in eighths, a snare roll, then a bar with no kick and
 * no bass before the last chorus). A square pluck with a dotted-eighth echo plays the tune, a supersaw the double.
 * Straight, four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", bridge: "lofikit", outro: "lofikit" },
  depth: "four",
  swing: "",
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", vox: "supersaw" },
  gain: { kick: 0.3, snare: 0.15, hats: 0.11, perc: 0.1, bass: 0.65, chords: 0.3, lead: 0.49, vox: 0.34 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<[bd ~ bd ~] bd*4 bd*4 bd*4>"),
    verse: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus: v("bd*4"),
    b: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    a: v("<bd*4 bd*4 bd*8 ~>"),
    outro: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!7 bd>"),
    only: { chorus2: v("bd bd bd [bd bd]") },
  },
  snare: {
    intro: v("<~ [~ cp ~ cp] [~ cp ~ cp] [~ cp ~ [cp cp]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    b: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    a: v("<~ [~ ~ cp ~] [~ cp ~ cp] [[sd sd sd sd] [sd*8]]>"),
    outro: v("<[~ sd ~ sd]!6 [~ sd [~ sd] [sd sd]] ~>"),
    // The second verse fills every four bars, not every eight: the lo-fi kit has no open hat to vary.
    only: { verse2: v("<[~ sd ~ sd]!3 [~ sd ~ [sd sd]]>") },
  },
  hats: {
    intro: v("[~ hh]*4", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh oh hh]*4", V16),
    b: v("~ hh ~ hh"),
    a: RISING("hh*16"),
    outro: v("<[hh*8]!7 ~>", V8),
    only: { verse2: v("hh hh hh hh hh [hh hh] hh hh", V8) },
  },
  perc: {
    intro: v("<cr ~ ~ ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!3>"),
    b: v("<cr ~!7>"),
    a: v("<~ ~ ~ [~ ~ [lt lt] [ht ht]]>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: {
      chorus2: v("<[cr, [~ rd]*4] [[~ rd]*4]!2 [[~ rd]*4, [~ ~ ~ [lt ht]]]>"),
      chorus3: v("<[cr, rd*8] [rd*8]!3>", V8),
    },
  },
  bass: {
    intro: INTRO_IN("{r}"),
    verse: LAST_OUT("{r}@10 {r}@6"),
    chorus: ACID_BAR,
    b: "{r}",
    a: BUILD_BASS(ACID_BAR, ACID_BAR, ACID_BAR),
    outro: LAST_OUT("{r}@10 {r}@6"),
  },
  comp: {
    intro: "<~ ~ [x x x x] [x x x x]>",
    verse: "[~ x]*4",
    chorus: "x*8",
    b: "x x x x",
    a: "<[~ x]*4 [~ x]*4 x*8 x*16>",
    outro: "<[[~ x]*4]!6 ~ ~>",
  },
  chordSound: { intro: "supersaw", bridge: "supersaw" },
  synth: {
    bassSound: { intro: "sine", verse: "sine", chorus: "sawtooth", b: "sine", a: "sawtooth", outro: "sine" },
    bass: { intro: SUB, verse: SUB, chorus: ACID, b: SUB, a: ACID_RISING, outro: SUB },
    chords: {
      intro: PAD,
      verse: STAB,
      chorus: `${STAB}${PUMP}`,
      b: PAD,
      a: ".lpf(saw.range(500, 4000).slow(4)).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)",
      outro: STAB,
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.45).delayfeedback(.35)",
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
    track(
      "kick",
      drums(k.kick),
      `${bank}${sw}${/^(RolandTR808|oak808)$/.test(k.bank) ? KICK_808 : ""}.gain(${num(k.gain.kick)})`,
    ),
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

/** Where U09.L02's verse and chorus land: every verse and every chorus of the song. */
const VERSES_AND_CHORUSES: SectionId[] = ["verse1", "chorus1", "verse2", "chorus2", "chorus3"];

export const U09_SONG = defineUnitSong({
  id: "usong.U09",
  unit: "U09",
  version: 2,
  title: "Turn it around",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
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
  // By section (AUTHORING §23.6): from U09.L02 the learner writes chords, bass and tune together, so a take hands over
  // whole sections and Oak keeps the drums there. U09.L01 writes only a tune, over the ending's own phrase.
  plan: [
    take(
      "U09.L01",
      ["outro"],
      ["lead"],
      "oak",
      "Your eight bars that ask and answer become the song's ending, its last eight bars.",
    ),
    take(
      "U09.L02",
      VERSES_AND_CHORUSES,
      ["lead", "chords", "bass"],
      "oak",
      "Your chords, bass and tune, in two sections that take turns, play five of the song's nine sections.",
    ),
    take(
      "U09.L03",
      ["bridge", "reprise"],
      ["lead", "chords"],
      "oak",
      "Your section B plays after the second chorus, and your A comes back after it, before the last chorus.",
    ),
    {
      lesson: "U09.L04",
      kind: "side",
      reason:
        "Your song goes from each verse straight into its chorus, with no section between them to rise through, so this Make stays a sketch of its own.",
    },
    take(
      "U09.L05",
      ["intro", ...VERSES_AND_CHORUSES],
      ["lead", "chords", "bass"],
      "U09.L02",
      "Your song from Verse & Chorus opens with your own intro, its parts coming in one at a time.",
    ),
    take(
      "U09.L06",
      ["outro"],
      // Its Make carries its own drums and plays with no Band (an ending is heard in the silence after it), so its
      // ending takes the drums of the song's last eight bars too; Oak's crash stays.
      ["lead", "chords", "bass", "kick", "snare", "hats"],
      "oak",
      "Your ending, with parts leaving or a last loop that shrinks, closes the song.",
    ),
    take(
      "U09.L07",
      ["intro", ...VERSES_AND_CHORUSES],
      ["lead", "chords", "bass"],
      "oak",
      "Your carved song plays the opening and every verse and chorus, each with the parts you kept.",
    ),
  ],
  releaseAfter: "U09.CP",
});

export default U09_SONG;
