// Song 6, "The long way home" (docs/design/songs/makes-core-a.md §8, U06 "the progression song"; AUTHORING §23).
// C major, 4/4, 92 BPM, with one four-bar part in G. U06 is the unit of chord progressions, so the song is a road
// trip through them: every section is a progression one lesson of the unit teaches, and Oak plays it before the
// learner takes it over.
//
// The form, 64 bars (2:47 at 92 BPM), one chord a bar unless two are written together:
//
//   intro 4       verse1 8           pre1 4          chorus1 8                   verse2 8   pre2 4   chorus2 8
//   C G Am Em     (C G Am F)×2       Dm Em F [F G]   C G Am [F G] C G [F G] C    = verse1   = pre1   = chorus1
//
//   lift 4 (in G)   bridge 4      chorus3 8    outro 4
//   Em C G D        C Am F G      = chorus1    C F G C
//
// - The opening is I V vi iii (U06.L09 takes it down by ear): keys and the tune's hook over light cymbals, then the
//   kick and the bass in bar 3 and a snare pickup in bar 4.
// - The verses are the four-chord loop I V vi IV (U06.L05, L06, L10, L11) with a low tune, E4 to E5, the tune the
//   unit's lessons already play over that loop (G E G, B G, A C A, A F), answered in bars 5 to 8.
// - The climbs into the loud parts go ii iii IV and then IV V in one bar: the chords on degrees 2 and 3 (U06.L01),
//   away then tension (U06.L03), and the changes coming faster just before the loud part (U06.L08). The tune climbs in
//   a sequence: each bar runs up its chord, holds the chord's 7th and steps to the next top note, D5, E5, F5.
// - The loud parts are eight bars that wait on V in bar 4 and land V to I in bars 7 and 8 (U06.L04), I V vi IV in
//   bars 1 to 3 and 5 to 6. The hook falls E D C G, D B G, and comes home on C.
// - The part in G is vi IV I V in G (U06.L02), half time, the hook's fall heard over IV of the new key.
// - The four bars before the last loud part are doo-wop, I vi IV V, the chords struck in threes (U06.L07), long tune
//   notes over a 12/8 feel.
// - The ending is home, away, tension, home, I IV V I (U06.L03's road home), with one held C.
//
// Chords (the same roots in every flavour; spec §5.1, contracts §5.10 FLAVOUR_RULES): pop, indie and electronic
// play close triads; electronic gets its four-note chords only from U06.L10, and the song sounds from U06.L01, so it
// stays in triads. Jazz-soul (four-note from U03, swung) and funk (four-note from U06.L01, sixteenths) play
// four-note chords: I and IV with an added 9th (Cadd9, Fadd9), V7, and the minor chords with their 7th (Am7, Dm7,
// Em7); in the part in G, Gadd9 and D7. No major 7th and no 6th: a major 7th under a tune on 1 or 4 is a half step
// below it, and C6/F6 read as Am7/Dm7 the moment the bass is not on the root. Triads sit D3 to C4, four-note chords
// D3 to D4, each voice moving a third at most from chord to chord. The pad doubles the triads, sustained.
//
// Clashes (AUTHORING §13, §23.5), read from the evaluated events: every tune note held a beat or more is a chord tone,
// or a 7th or 6th above the root that is no half step from any chord tone: D5 over Em at the end of the opening, and
// in the climbs C5 over Dm, D5 over Em, E5 over F (a major 14th above F3) and D5 over F. The passing eighths (D5 over
// C and over Am, A4 over G, G4 over F) step to chord tones. The tune never puts C over a G or an Em chord, or F over a
// C, an Am or an Em chord.
// Every bass note is a root, a fifth or an octave. So nothing a half step from a chord tone is held in any flavour.
// Oak's tune and bass also fit the four lessons whose chords are fixed (oakKeeps): U06.L09's I V vi iii in the
// opening, U06.L05's I V vi IV in the second verse, U06.L02's vi IV I V in the part in G, and U06.L12's I V vi IV
// comp over the last two loud parts (whose bars 4, 7 and 8 the tune fits on both F and G, Am and C).
//
// One builder writes all five flavours (AUTHORING §23.2): notes are shared, so the tune, the bass downbeats and the
// chord roots cannot drift. A flavour changes the kit, the grooves, the comp and bass rhythms, the chord colour its
// staging allows, swing (jazz-soul) and production. Gains stay at or under the Bands' (content/bands/index.ts KITS).
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
  { id: "pre1", type: "prechorus", bars: 4 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "pre2", type: "prechorus", bars: 4 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "lift", type: "lift", bars: 4, key: { tonic: "G", mode: "major" } },
  { id: "bridge", type: "bridge", bars: 4 },
  { id: "chorus3", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** The music a section plays; a section's repeats (verse2, pre2, chorus2 and chorus3) share their first's. */
type Kind = "intro" | "verse" | "pre" | "chorus" | "lift" | "bridge" | "outro";
const KIND: Readonly<Record<SectionId, Kind>> = {
  intro: "intro",
  verse1: "verse",
  pre1: "pre",
  chorus1: "chorus",
  verse2: "verse",
  pre2: "pre",
  chorus2: "chorus",
  lift: "lift",
  bridge: "bridge",
  chorus3: "chorus",
  outro: "outro",
};
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;
type ByKind = Readonly<Record<Kind, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
/** One mini-notation entry per bar: `<[…] […] …>`. */
const bars = (...b: readonly string[]): string => `<${b.map((x) => `[${x}]`).join(" ")}>`;

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`chordsVerse`; `percChorus3` for a later chorus that plays something else), `silence` where it rests, and one
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

// ---- The harmony (every flavour) ------------------------------------------------------------------------------
//
// A bar is one chord, or two written together ("F G": F on beats 1 and 2, G on 3 and 4). "GI" is G as I of the part
// in G (Gadd9 in the four-note kits, where V of C is G7).

type Chord = "C" | "G" | "GI" | "Am" | "F" | "Em" | "Dm" | "D";
const HARMONY: Readonly<Record<Kind, readonly string[]>> = {
  intro: ["C", "G", "Am", "Em"],
  verse: ["C", "G", "Am", "F", "C", "G", "Am", "F"],
  pre: ["Dm", "Em", "F", "F G"],
  chorus: ["C", "G", "Am", "F G", "C", "G", "F G", "C"],
  lift: ["Em", "C", "GI", "D"],
  bridge: ["C", "Am", "F", "G"],
  outro: ["C", "F", "G", "C"],
};
/** Close triads, E3 to D4 (pop, indie, electronic, and the pad in every kit). */
const TRIADS: Readonly<Record<Chord, string>> = {
  C: "e3,g3,c4",
  G: "d3,g3,b3",
  GI: "d3,g3,b3",
  Am: "e3,a3,c4",
  F: "f3,a3,c4",
  Em: "e3,g3,b3",
  Dm: "d3,f3,a3",
  D: "d3,f#3,a3",
};
/** Four-note chords (jazz-soul, funk): Cadd9 G7 Am7 Fadd9 Em7 Dm7, and Gadd9 D7 in G; the minor ones from the root. */
const FOURS: Readonly<Record<Chord, string>> = {
  C: "e3,g3,c4,d4",
  G: "d3,f3,g3,b3",
  GI: "d3,g3,a3,b3",
  Am: "e3,g3,a3,c4",
  F: "f3,g3,a3,c4",
  Em: "e3,g3,b3,d4",
  Dm: "d3,f3,a3,c4",
  D: "d3,f#3,a3,c4",
};
/** The bass's root (C2 to A2), its fifth (under the root for G, A and F, so the line stays low) and its octave pop. */
const BASS: Readonly<Record<Chord, { r: string; f: string; o: string }>> = {
  C: { r: "c2", f: "g2", o: "c3" },
  G: { r: "g2", f: "d2", o: "g3" },
  GI: { r: "g2", f: "d2", o: "g3" },
  Am: { r: "a2", f: "e2", o: "a3" },
  F: { r: "f2", f: "c2", o: "f3" },
  Em: { r: "e2", f: "b2", o: "e3" },
  Dm: { r: "d2", f: "a2", o: "d3" },
  D: { r: "d2", f: "a2", o: "d3" },
};
const chordsOfBar = (bar: string): Chord[] => bar.split(" ") as Chord[];
const voiced = (table: Readonly<Record<Chord, string>>, bar: string): string =>
  chordsOfBar(bar)
    .map((c) => `[${table[c]}]`)
    .join(" ");
/** A section's chord notes, a bar each (two chords in a bar split it in halves). */
const chordNotes = (kind: Kind, table: Readonly<Record<Chord, string>>): string =>
  bars(...HARMONY[kind].map((b) => voiced(table, b)));

/**
 * A bass bar from a rhythm: `R`, `F` and `O` are the chord's root, fifth and octave; in a bar of two chords the rhythm
 * is played once per half, on each chord (so it should hold half as many slots).
 */
const bassBar = (rhythm: string, half: string, bar: string): string => {
  const cs = chordsOfBar(bar);
  const fill = (r: string, c: Chord) =>
    r.replace(/\b[RFO]\b/g, (x) => (x === "R" ? BASS[c].r : x === "F" ? BASS[c].f : BASS[c].o));
  return cs.length === 1 ? fill(rhythm, cs[0] as Chord) : cs.map((c) => `[${fill(half, c)}]`).join(" ");
};
/** A section's bass line: `rest` bars of silence first (the opening), `last` in place of the last bar (the ending). */
const bassLine = (
  kind: Kind,
  rhythm: string,
  half: string,
  opts: { rest?: number; last?: string } = {},
): string => {
  const line = HARMONY[kind].map((b, i) => (i < (opts.rest ?? 0) ? "~" : bassBar(rhythm, half, b)));
  if (opts.last !== undefined) line[line.length - 1] = opts.last;
  return bars(...line);
};

// ---- The tune (every flavour) ---------------------------------------------------------------------------------
//
// Note names, eight eighth notes to a bar. The verse sits low (E4 to D5) and breathes on beat 4; the climb rises in a
// sequence (F A D, G B E, A C F); the hook falls from E5 (E D C G, D B G) and waits on D5 over V before it lands on
// C5. Every note held a beat or more is a chord tone in every flavour (see the header).

const MEL: Readonly<Record<Kind, string | null>> = {
  intro: bars("e5@3 d5 c5@2 g4@2", "d5@3 b4 g4@4", "c5@2 a4@2 e5@4", "d5@2 b4@2 g4@4"),
  verse: bars(
    "g4@3 e4 g4@2 ~@2",
    "b4@3 a4 g4@2 ~@2",
    "a4@2 c5@2 a4@2 ~@2",
    "a4@3 g4 f4@2 ~@2",
    "g4@3 e4 g4@2 c5@2",
    "b4@3 a4 g4@2 d5@2",
    "c5@3 d5 e5@2 c5@2",
    "a4@6 ~@2",
  ),
  pre: bars("f4@2 a4@2 c5@3 d5", "g4@2 b4@2 d5@3 e5", "a4@2 c5@2 e5@3 f5", "d5@2 c5@2 b4@2 d5@2"),
  chorus: bars(
    "e5@3 d5 c5@2 g4@2",
    "d5@3 b4 g4@2 b4@2",
    "a4@2 c5@2 e5@3 d5",
    "c5@2 a4@2 d5@4",
    "e5@3 d5 c5@2 g4@2",
    "d5@3 b4 g4@2 b4@2",
    "c5@2 a4@2 d5@4",
    "c5@6 ~@2",
  ),
  lift: bars("g4@2 b4@2 e5@4", "e5@3 d5 c5@2 g4@2", "d5@3 b4 g4@4", "f#4@2 a4@2 d5@4"),
  bridge: bars("g4@2 c5@2 e5@4", "e5@4 c5@4", "c5@4 a4@4", "b4@4 d5@4"),
  outro: bars("e5@3 d5 c5@2 g4@2", "c5@3 a4 f4@2 a4@2", "d5@3 b4 g4@2 b4@2", "c5@8"),
};

// ---- The kits -------------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const V12 = "[1 .86 .9]*4";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit; `banks` names another machine in some sections. */
  bank: string;
  banks?: Partial<Record<Kind, string>>;
  sounds: { bass: string; chords: string; pad: string; lead: string };
  four: boolean;
  /** Sections whose every track swings its eighths (jazz-soul; never the doo-wop part, already in threes). */
  swing?: readonly Kind[];
  /** At or under the kit's Bands: drums .7 (jazz-soul .65, electronic .6), bass .9 (.55), chords .4 (.45, .3). */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    pad: number;
    lead: number;
  };
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: ByKind & { chorus3?: string };
  snare: ByKind & { chorus3?: string };
  hats: ByKind & { chorus3?: string };
  perc: ByKind & { chorus3?: string };
  /** Bass notes; the downbeat of every bar is the chord's root in every kit. */
  bass: ByKind;
  /** The chords' rhythm (`struct`) in each section. */
  comp: Readonly<Record<Kind, string>>;
  /** The pad's rhythm, where it plays (the pre-chorus climbs, the loud parts, the part in G, the ending). */
  pad: Readonly<Partial<Record<Kind, string>>>;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' and pad's envelopes, the lead. */
  synth?: {
    bassSound: Readonly<Record<Kind, string>>;
    bass: Readonly<Record<Kind, string>>;
    chords: Readonly<Record<Kind, string>>;
    pad: string;
    lead: string;
  };
}

// The opening: two bars of keys and tune over cymbals, then the band; the ending stops on one held chord.
const INTRO_IN = (bar: string): string => `<~ ~ [${bar}] [${bar}]>`;
const LAST = (bar: string, last: string): string => `<[${bar}]!3 [${last}]>`;
const SNARE_PICKUP = (beat: string, fill: string): string => `<~ ~ [${beat}] [${fill}]>`;

/** Pop: the default kit, piano, picked bass, strings for the pad, piano lead high above the chords. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", pad: "strings", lead: "piano" },
  four: false,
  gain: { kick: 0.7, snare: 0.6, hats: 0.4, perc: 0.35, bass: 0.85, chords: 0.38, pad: 0.2, lead: 0.5 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(INTRO_IN("bd ~ ~ bd bd ~ ~ ~")),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    pre: v("bd*4"),
    chorus: v("bd ~ ~ bd bd ~ ~ bd"),
    lift: v("bd ~ ~ ~ ~ ~ bd ~"),
    bridge: v("bd ~ bd ~"),
    outro: v(LAST("bd ~ ~ bd ~ ~ ~ ~", "bd")),
  },
  snare: {
    intro: v(SNARE_PICKUP("~ sd ~ sd", "~ sd [~ sd] [sd sd]")),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    pre: v("<[~ sd ~ sd]!3 [~ sd [sd sd] [sd sd sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>", "1 .85"),
    lift: v("<[~ ~ sd ~]!3 [~ ~ sd [sd sd]]>"),
    bridge: v("<[~ sd ~ sd]!3 [~ sd [sd sd sd] [sd sd sd]]>"),
    outro: v(LAST("~ ~ sd ~", "~")),
  },
  hats: {
    intro: v("<[~ hh]*4!2 [hh*8]!2>", V8),
    verse: v("hh*8", V8),
    pre: v("[hh hh hh oh]*2", V8),
    chorus: v("[hh hh hh oh]*2", V8),
    lift: v("~ hh ~ hh"),
    bridge: v("[hh hh hh]*4", V12),
    outro: v(LAST("hh*4", "~"), V4),
  },
  perc: {
    intro: v("<[~ sh]*4!2 cr ~>"),
    verse: v("<cr ~!7>"),
    pre: v("~ tb ~ tb"),
    chorus: v("<[cr, [~ tb]*4] [~ tb]*4!3 [cr, [~ tb]*4] [~ tb]*4!3>"),
    chorus3: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    lift: v("<[cr, rd*4] [rd*4]!3>"),
    bridge: v("<cr ~!3>"),
    outro: v("<[cr, rd*4] [rd*4]!2 cr>"),
  },
  bass: {
    intro: bassLine("intro", "R@3 R R@4", "", { rest: 2 }),
    verse: bassLine("verse", "R@3 R R@4", "R@2 R@2"),
    pre: bassLine("pre", "R@2 R@2 R@2 R@2", "R@2 R@2"),
    chorus: bassLine("chorus", "R*8", "R*4"),
    lift: bassLine("lift", "R@6 R@2", ""),
    bridge: bassLine("bridge", "R@4 R@4", ""),
    outro: bassLine("outro", "R@3 R R@4", "", { last: "c2@8" }),
  },
  comp: {
    intro: "x ~ ~ x ~ ~ x ~",
    verse: "x ~ ~ x ~ ~ x ~",
    pre: "x*8",
    chorus: "x*8",
    lift: "x",
    bridge: "[x x x]*4",
    outro: "<[x ~ ~ x ~ ~ x ~]!3 x>",
  },
  pad: { pre: "x x", chorus: "x x", lift: "x", outro: "x" },
};

/** Indie: rock kit (LinnDrum's name), clean guitar strums, acoustic lead, a soft organ pad. 3-3-2 verses, four on the floor. */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", pad: "organ", lead: "acgtr" },
  four: false,
  gain: { kick: 0.7, snare: 0.6, hats: 0.4, perc: 0.35, bass: 0.85, chords: 0.4, pad: 0.15, lead: 0.5 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v(INTRO_IN("bd ~ ~ bd ~ ~ bd ~")),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    pre: v("bd*4"),
    chorus: v("bd*4"),
    lift: v("bd ~ ~ ~ ~ ~ ~ ~"),
    bridge: v("bd ~ bd ~"),
    outro: v(LAST("bd ~ ~ bd ~ ~ bd ~", "bd")),
  },
  snare: {
    intro: v(SNARE_PICKUP("~ ~ sd ~", "~ ~ sd [sd sd]")),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    pre: v("<[~ sd ~ sd]!3 [~ sd [sd sd] [sd sd sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    lift: v("<[~ ~ sd ~]!3 [~ ~ sd [sd sd]]>"),
    bridge: v("<[~ sd ~ sd]!3 [~ sd [sd sd sd] [sd sd sd]]>"),
    outro: v(LAST("~ ~ sd ~", "~")),
  },
  hats: {
    intro: v("<[~ hh]*4!2 [hh*8]!2>", V8),
    verse: v("hh*8", V8),
    pre: v("[hh oh]*4", V8),
    chorus: v("[hh oh]*4", V8),
    lift: v("hh*4", V4),
    bridge: v("[hh hh hh]*4", V12),
    outro: v(LAST("hh*8", "~"), V8),
  },
  perc: {
    intro: v("<[~ tb]*2!2 cr ~>"),
    verse: v("<cr ~!7>"),
    pre: v("[~ tb]*4"),
    chorus: v("<[cr, [~ tb]*4] [~ tb]*4!3 [cr, [~ tb]*4] [~ tb]*4!3>"),
    chorus3: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    lift: v("<[cr, [~ tb]*2] [~ tb]*2!3>"),
    bridge: v("<cr ~!3>"),
    outro: v("<cr ~!2 cr>"),
  },
  bass: {
    intro: bassLine("intro", "R@3 R@3 R@2", "", { rest: 2 }),
    verse: bassLine("verse", "R@3 R@3 R@2", "R@2 R@2"),
    pre: bassLine("pre", "R*8", "R*4"),
    chorus: bassLine("chorus", "[R O]*4", "[R O]*2"),
    lift: bassLine("lift", "R@8", ""),
    bridge: bassLine("bridge", "R@4 R@4", ""),
    outro: bassLine("outro", "R@3 R@3 R@2", "", { last: "c2@8" }),
  },
  comp: {
    intro: "x ~ ~ x ~ ~ x ~",
    verse: "x ~ ~ x ~ ~ x ~",
    pre: "x*8",
    chorus: "x*8",
    lift: "x ~ ~ ~ x ~ ~ ~",
    bridge: "[x x x]*4",
    outro: "<[x ~ ~ x ~ ~ x ~]!3 x>",
  },
  pad: { pre: "x x", chorus: "x x", lift: "x", outro: "x" },
};

/**
 * Jazz-soul: the jazz kit on brushes and ride, Rhodes in four-note chords, upright bass in two (root and fifth), vibes
 * on the tune, strings for the pad. Swung eighths everywhere but the doo-wop part.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", pad: "strings", lead: "vibes" },
  four: true,
  swing: ["intro", "verse", "pre", "chorus", "lift", "outro"],
  gain: { kick: 0.6, snare: 0.5, hats: 0.35, perc: 0.35, bass: 0.85, chords: 0.42, pad: 0.15, lead: 0.55 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v(INTRO_IN("bd ~ ~ ~ ~ ~ bd ~")),
    verse: v("bd ~ ~ bd ~ ~ ~ ~"),
    pre: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd bd ~ ~ ~"),
    lift: v("bd ~ ~ ~"),
    bridge: v("bd ~ bd ~"),
    outro: v(LAST("bd ~ ~ ~", "bd")),
  },
  snare: {
    intro: v(SNARE_PICKUP("~ rim ~ rim", "~ rim ~ [~ ~ sd sd]")),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    pre: v("<[~ sd ~ sd]!3 [~ sd [~ sd] [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    lift: v("~ ~ sd ~"),
    bridge: v("~ rim ~ rim"),
    outro: v(LAST("~ ~ rim ~", "~")),
  },
  hats: {
    intro: v("<~ ~ [~ hh ~ hh] [~ hh ~ hh]>"),
    verse: v("~ hh ~ hh"),
    pre: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    lift: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    outro: v(LAST("~ hh ~ hh", "~")),
  },
  perc: {
    intro: v("rd ~ rd rd rd ~ rd rd", V8),
    verse: v("<[cr, rd ~ rd rd rd ~ rd rd] [rd ~ rd rd rd ~ rd rd]!7>", V8),
    pre: v("rd*8", V8),
    chorus: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    chorus3: v("<[cr, rd*8, [~ sh]*4] [rd*8, [~ sh]*4]!3 [cr, rd*8, [~ sh]*4] [rd*8, [~ sh]*4]!3>"),
    lift: v("<[cr, rd*4] [rd*4]!3>"),
    bridge: v("<[cr, [rd rd rd]*4] [rd rd rd]*4!3>"),
    outro: v("<[cr, rd*4] [rd*4]!2 cr>"),
  },
  bass: {
    intro: bassLine("intro", "R@4 F@4", "", { rest: 2 }),
    verse: bassLine("verse", "R@4 F@4", "R@4"),
    pre: bassLine("pre", "R@4 F@4", "R@2 F@2"),
    chorus: bassLine("chorus", "R@3 R F@2 R@2", "R@2 F@2"),
    lift: bassLine("lift", "R@8", ""),
    bridge: bassLine("bridge", "R@4 R@4", ""),
    outro: bassLine("outro", "R@4 F@4", "", { last: "c2@8" }),
  },
  comp: {
    intro: "x ~ ~ x ~ ~ x ~",
    verse: "~ [~ x] ~ x",
    pre: "x ~ x ~",
    chorus: "x ~ ~ x ~ ~ x ~",
    lift: "x",
    bridge: "[x x x]*4",
    outro: "<[x ~ ~ x ~ ~ x ~]!3 x>",
  },
  pad: { chorus: "x x", lift: "x", outro: "x" },
};

const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FUNK_GHOSTS = "1 1 1 1 1 1 1 .35 1 1 1 1 1 1 1 .35";
/**
 * Funk: Oak's 808, clavinet in four-note chords, finger bass locked to the kick with octave pops, organ on the tune,
 * strings for the pad. Straight sixteenths; the snare ghosts the last sixteenth of beats 2 and 4.
 */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", pad: "strings", lead: "organ" },
  four: true,
  gain: { kick: 0.7, snare: 0.6, hats: 0.35, perc: 0.3, bass: 0.85, chords: 0.4, pad: 0.15, lead: 0.4 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(INTRO_IN(FUNK_KICK)),
    verse: v(FUNK_KICK),
    pre: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ bd ~"),
    chorus: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    lift: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    outro: v(LAST(FUNK_KICK, "bd")),
  },
  snare: {
    intro: v(SNARE_PICKUP("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~", "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd")),
    verse: v("~ ~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd", FUNK_GHOSTS),
    pre: v("<[~ ~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd]!3 [~ ~ ~ ~ sd ~ ~ ~ sd ~ sd ~ sd sd sd sd]>"),
    chorus: v(
      "<[~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>",
    ),
    lift: v("~ ~ sd ~"),
    bridge: v("~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ ~"),
    outro: v(LAST("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~", "~")),
  },
  hats: {
    intro: v("<[~ hh]*8!2 [hh*16]!2>", V16),
    verse: v("hh*16", V16),
    pre: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    lift: v("hh*8", V8),
    bridge: v("[hh hh hh]*4", V12),
    outro: v(LAST("hh*16", "~"), V16),
  },
  perc: {
    intro: v("<[~ sh]*4!2 cr ~>"),
    verse: v("<cr ~!7>"),
    pre: v("[~ sh]*8"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    chorus3: v("<[cr, [~ cb]*4] [[~ cb]*4]!3 [cr, [~ cb]*4] [[~ cb]*4]!3>"),
    lift: v("<cr [~ sh]*4!3>"),
    bridge: v("<cr ~!3>"),
    outro: v("<cr ~!2 cr>"),
  },
  bass: {
    intro: bassLine("intro", "R ~ ~ R ~ ~ O ~ ~ ~ R ~ ~ ~ F ~", "", { rest: 2 }),
    verse: bassLine("verse", "R ~ ~ R ~ ~ O ~ ~ ~ R ~ ~ ~ F ~", "R ~ ~ R ~ ~ O ~"),
    pre: bassLine("pre", "R ~ R ~ O ~ R ~ R ~ R ~ O ~ R ~", "R ~ R ~ O ~ R ~"),
    chorus: bassLine("chorus", "R ~ O R ~ ~ O ~ R ~ R ~ O ~ ~ ~", "R ~ O R ~ ~ O ~"),
    lift: bassLine("lift", "R@10 R@4 O@2", ""),
    bridge: bassLine("bridge", "[R ~ R]*4", ""),
    outro: bassLine("outro", "R ~ ~ R ~ ~ O ~ ~ ~ R ~ ~ ~ F ~", "", { last: "c2@16" }),
  },
  comp: {
    intro: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ x ~",
    verse: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ x ~",
    pre: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    chorus: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    lift: "x",
    bridge: "[~ x x]*4",
    outro: "<[x ~ ~ x ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~]!3 x>",
  },
  pad: { lift: "x", outro: "x" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. The octave jumps fall between the beats; every
// downbeat is the chord's root, as in every kit.
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
const SUB = ".decay(1.2).sustain(.7)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/** A supersaw chord struck with a slow attack, so it swells after each kick; its filter drifts. */
const SWELL = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8))";
const ACID_BAR = "R ~ R O R ~ R ~ R ~ O R R ~ ~ R";
const ACID_HALF = "R ~ R O R ~ R ~";

/**
 * Electronic: Oak's 909-style machine and the lo-fi kit. The opening, the part in G and the ending sit on the lo-fi kit
 * over a sine sub and a swelling supersaw; the verses are a broken lo-fi beat over the sub and off-beat stabs; the
 * climbs go four on the floor on the 909 with a snare roll and the acid line starting; the loud parts are the 909 with
 * the acid line, pumping stabs and the pad. A square pluck with a dotted-eighth echo plays the tune. In triads until
 * U06.L10 (FLAVOUR_RULES), so in triads here.
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", verse: "lofikit", lift: "lofikit", outro: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", pad: "supersaw", lead: "square" },
  four: false,
  gain: { kick: 0.6, snare: 0.5, hats: 0.35, perc: 0.3, bass: 0.5, chords: 0.28, pad: 0.15, lead: 0.4 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v(INTRO_IN("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~")),
    verse: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    pre: v("bd*4"),
    chorus: v("bd*4"),
    lift: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v("bd*4"),
    outro: v(LAST("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~", "bd")),
  },
  snare: {
    intro: v(SNARE_PICKUP("~ sd ~ sd", "~ sd ~ [sd sd]")),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    pre: v("<[~ cp ~ cp]!2 [sd*8] [sd*16]>"),
    chorus: v("<[~ cp ~ cp]!7 [~ cp [~ cp] [cp cp]]>"),
    lift: v("~ ~ sd ~"),
    bridge: v("<[~ cp ~ cp]!3 [~ cp [cp cp cp] [cp cp cp]]>"),
    outro: v(LAST("~ ~ sd ~", "~")),
  },
  hats: {
    intro: v("<[~ hh]*4!2 [hh*8]!2>", V8),
    verse: v("hh*8", V8),
    pre: v("[hh hh oh hh]*4", V16),
    chorus: v("[hh hh oh hh]*4", V16),
    lift: v("hh*4", V4),
    bridge: v("[hh hh oh]*4", V12),
    outro: v(LAST("hh*4", "~"), V4),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<[cr, [~ sh]*4] [~ sh]*4!7>"),
    pre: v("<cr ~!3>"),
    chorus: v("<cr ~!3 cr ~!3>"),
    chorus3: v("<[cr, [~ rd]*4] [~ rd]*4!3 [cr, [~ rd]*4] [~ rd]*4!3>"),
    lift: v("<cr ~!3>"),
    bridge: v("<cr ~!2 [~ ~ [lt lt] [ht ht]]>"),
    outro: v("<cr ~!2 cr>"),
  },
  bass: {
    intro: bassLine("intro", "R@6 R@4 R@6", "", { rest: 2 }),
    verse: bassLine("verse", "R@6 R@4 R@6", "R@6 R@2"),
    pre: bassLine("pre", "R*8", "R*4"),
    chorus: bassLine("chorus", ACID_BAR, ACID_HALF),
    lift: bassLine("lift", "R@8", ""),
    bridge: bassLine("bridge", "[R ~ R]*4", ""),
    outro: bassLine("outro", "R@6 R@4 R@6", "", { last: "c2@16" }),
  },
  comp: {
    intro: "x*4",
    verse: "~ x ~ x ~ x ~ x",
    pre: "[~ x]*4",
    chorus: "x*8",
    lift: "x*4",
    bridge: "[~ x x]*4",
    outro: "<[x*4]!3 x>",
  },
  pad: { chorus: "x x" },
  synth: {
    bassSound: {
      intro: "sine",
      verse: "sine",
      pre: "sawtooth",
      chorus: "sawtooth",
      lift: "sine",
      bridge: "sawtooth",
      outro: "sine",
    },
    bass: {
      intro: SUB,
      verse: SUB,
      pre: '.lpq(12).ftype("ladder").lpenv("<1 1.5 2.5 4>").lpd(.14).lps(0).decay(.2).sustain(.4)',
      chorus: ACID,
      lift: SUB,
      bridge: ACID,
      outro: SUB,
    },
    chords: {
      intro: `.s("supersaw")${SWELL}`,
      verse: `.s("sawtooth")${STAB}`,
      pre: `.s("sawtooth")${STAB}`,
      chorus: `.s("sawtooth")${STAB}${PUMP}`,
      lift: `.s("supersaw")${SWELL}`,
      bridge: `.s("sawtooth")${STAB}`,
      outro: `.s("supersaw")${SWELL}`,
    },
    pad: ".attack(.3).decay(.5).sustain(.6).lpf(1600)",
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.49).delayfeedback(.35)",
  },
};

const KITS: Readonly<Record<FlavourId, Kit>> = {
  "flavour.pop": POP,
  "flavour.indie": INDIE,
  "flavour.jazz-soul": JAZZ,
  "flavour.funk": FUNK,
  "flavour.electronic": ELECTRONIC,
};

const mapSections = (f: (id: SectionId, kind: Kind) => string | null): BySection =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id, KIND[s.id])])) as Record<SectionId, string | null>;

/** One flavour's song: the tune first, then the chords, the pad, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const syn = k.synth;
  const swing = (kind: Kind, p: string): string => (k.swing?.includes(kind) ? `${p}.swingBy(1/3, 4)` : p);
  const table = k.four ? FOURS : TRIADS;
  const mel = mapSections((_, kind) => {
    const line = MEL[kind];
    return line === null ? null : swing(kind, `note("${line}")`);
  });
  const chords = mapSections((_, kind) =>
    swing(kind, `note("${chordNotes(kind, table)}").struct("${k.comp[kind]}")${syn ? syn.chords[kind] : ""}`),
  );
  const pad = mapSections((_, kind) => {
    const rhythm = k.pad[kind];
    return rhythm === undefined ? null : `note("${chordNotes(kind, TRIADS)}").struct("${rhythm}")`;
  });
  const bass = mapSections((_, kind) => {
    const line = k.bass[kind];
    if (line === null) return null;
    return swing(
      kind,
      syn ? `note("${line}").s("${syn.bassSound[kind]}")${syn.bass[kind]}` : `note("${line}")`,
    );
  });
  /** A drum track: the later loud parts may play their own pattern; with `banks`, each section names its machine. */
  const drums = (by: ByKind & { chorus3?: string }): BySection =>
    mapSections((id, kind) => {
      const p = id === "chorus3" && by.chorus3 ? by.chorus3 : by[kind];
      if (p === null) return null;
      const bank = k.banks ? `.bank("${k.banks[kind] ?? k.bank}")` : "";
      return swing(kind, `${p}${bank}`);
    });
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const tracks = [
    track(
      "mel",
      mel,
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${syn ? "" : `.s("${k.sounds.chords}")`}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "pad",
      pad,
      `.s("${k.sounds.pad}")${syn?.pad ?? ""}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`,
    ),
    track("bass", bass, `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`),
    track("kick", drums(k.kick), `${bank}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${bank}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc), `${bank}.gain(${num(k.gain.perc)})`),
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

export const U06_SONG = defineUnitSong({
  id: "usong.U06",
  unit: "U06",
  version: 1,
  title: "The long way home",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 92,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "pad", label: "pad", role: "pad", name: "Pad", plainName: "Pad" },
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
  // By section (AUTHORING §23.6): every U06 Make plays chords, so a take owns its sections' pitched parts and Oak's
  // drums play on under it. Oak keeps its tune (and bass) only where the lesson fixes the chords to Oak's own.
  plan: [
    take(
      "U06.L01",
      ["pre1"],
      ["chords"],
      "oak",
      "Your loop with a new chord on degree 2, 3 or 7 plays the climb into the first loud part.",
    ),
    take(
      "U06.L02",
      ["lift"],
      ["chords"],
      "oak",
      "Your loop in G plays the four bars where the song moves into G, after the second loud part.",
      ["bass", "lead"],
    ),
    take(
      "U06.L03",
      ["outro"],
      ["chords"],
      "oak",
      "Your phrase that goes away, builds tension and comes home plays the ending of the song.",
    ),
    take(
      "U06.L04",
      ["chorus1"],
      ["chords"],
      "oak",
      "Your eight bars that wait on V, then land V to I, become the first loud part.",
    ),
    take(
      "U06.L05",
      ["verse2"],
      ["bass", "chords"],
      "oak",
      "Your bass line under I V vi IV takes over the part after the first loud part, under Oak's tune.",
      ["lead"],
    ),
    take(
      "U06.L06",
      ["verse1"],
      ["chords"],
      "oak",
      "Your four-chord loop on the pad, from any of its chords, plays the part after the opening.",
    ),
    take(
      "U06.L07",
      ["bridge"],
      ["chords"],
      "oak",
      "Your doo-wop loop, its chords broken into single notes, plays the four bars before the last loud part.",
    ),
    take(
      "U06.L08",
      ["pre2"],
      ["chords"],
      "oak",
      "Your loop that changes chord faster in some bars plays the climb into the second loud part.",
    ),
    take(
      "U06.L09",
      ["intro"],
      ["chords"],
      "oak",
      "The loop you take down by ear becomes the opening of the song, under Oak's tune.",
      ["bass", "lead"],
    ),
    take(
      "U06.L10",
      ["verse1"],
      ["chords", "bass", "lead"],
      "U06.L06",
      "Your loop from the part after the opening comes back with a 7th on top of some of its chords.",
    ),
    take(
      "U06.L11",
      ["verse2"],
      ["bass", "chords"],
      "oak",
      "Your bass walks down by step under the part after the first loud part.",
    ),
    take(
      "U06.L12",
      ["chorus2", "chorus3"],
      ["chords"],
      "oak",
      "Your chords, in a rhythm of your own, play the last two loud parts over Oak's drums, bass and tune.",
      ["bass", "lead"],
    ),
  ],
  releaseAfter: "U06.CP",
});

export default U06_SONG;
