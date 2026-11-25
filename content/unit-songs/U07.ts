// Song 7, "Somewhere to land" (docs/design/songs/makes-core-b.md "U07 song (melody)"; AUTHORING §23). C major, 4/4,
// 92 BPM, 57 bars. U07 is the melody unit, so the song is built around Oak's tune, and the plan hands the tune over
// section by section (from U05 on a Make that plays chords takes its whole section, §23.6).
//
// Form and harmony, each section the chords its lessons were written over (so a learner's loop, which restarts at
// the start of every section it plays in, always meets the chords it was written for):
//   intro    4  C F C F               the two-chord vamp (U07.L04)
//   verse1   8  C F C G | C F G C     the eight-bar phrase (U07.L01)
//   chorus1  8  C G Am F, twice       the four-chord loop (U07.L02)
//   verse2   8  C F C G | C F G C     (U07.L06)
//   chorus2  8  C G Am F, twice       (U07.L03)
//   bridge   8  C G/B Am F, twice     the same loop over a falling bass, a quiet part of call and answer (U07.L07)
//   break    1  G                     the band hits V once and stops; the tune leads in (U07.L08)
//   chorus3  8  C G Am F, twice       the last loud part (U07.L10)
//   outro    4  C F G C               I IV V I, slower in feel (U07.L05)
//
// Oak's tune models each lesson before it is taken: the intro line decorates its chord notes with passing and
// neighbour tones (L04); the verse moves mostly by step, asks in bars 1-4 (ending on D over G) and answers in 5-8,
// starting the same way, reaching its one high point (F5) in bar 6 and coming home (L01, L06); the chorus is one motif
// (G G A G E) moved onto each chord, as a sequence, then a late high point, A5 (L02, L03, L10); the quiet part trades a
// call on the tune with an answer on the second line (L07); the break's two notes lead into the last loud part (L08);
// the outro leans: an A held over from the F bar into the G bar falls to G (a 9-8 suspension), and a D on the last
// downbeat falls to C (L05).
//
// Every note of the tune held a beat or more is a chord tone of the chord under it, but for three: the outro's leaning
// A over G and D over C (a 9th) and, in the triad kits, the chorus's G5 over Am in its bar 7 (the chord's 7th); each is
// a whole step or more from every chord tone, so no half-step clash. Chords: triads in pop and indie;
// sixth chords on I and IV, G7 and Am7 in jazz-soul, funk and electronic (contracts §5.10 staging at U07: jazz-soul
// from U03, funk from U06, electronic from U06.L10), every four-note chord voiced from its root so it reads the same
// with or without the bass. No major sevenths: Cmaj7 and Fmaj7 would put B under a tune on C and E under one on F.
// Jazz-soul swings its eighths (from U03, as its Bands do) on the drums and the tune; its chords and bass start only on
// beats or over a root, unswung. The others play straight. The bass plays the chord's root on every downbeat in every
// kit, never holds a B under C, F or Am or an E under F or G, and locks with the kick.
// Gains are levelled by packages/strudel/e2e/songs.pw.ts (budget sound-songs.json), so the learner's line sits on top.
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
  { id: "bridge", type: "bridge", bars: 8 },
  // One bar on V: the band hits once and leaves the bar to the drums and the tune's lead-in.
  { id: "break", type: "break", bars: 1 },
  { id: "chorus3", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melVerse`; `melChorus3` for a third chorus that plays something else), `silence` where it rests, and one
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

const mapSections = (f: (id: SectionId) => string | null): BySection =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, string | null>;
/** Bars of a section as a `< >` sequence, one bracketed group a bar. */
const bars = (...b: string[]): string => `<${b.map((x) => `[${x}]`).join(" ")}>`;

// ---- Harmony ---------------------------------------------------------------------------------------------------

type Chord = "C" | "F" | "G" | "Am" | "G/B";
const LOOP: Chord[] = ["C", "G", "Am", "F"];
/** The chords of every section, one a bar. */
const PROG: Readonly<Record<SectionId, readonly Chord[]>> = {
  intro: ["C", "F", "C", "F"],
  verse1: ["C", "F", "C", "G", "C", "F", "G", "C"],
  chorus1: [...LOOP, ...LOOP],
  verse2: ["C", "F", "C", "G", "C", "F", "G", "C"],
  chorus2: [...LOOP, ...LOOP],
  bridge: ["C", "G/B", "Am", "F", "C", "G/B", "Am", "F"],
  break: ["G"],
  chorus3: [...LOOP, ...LOOP],
  outro: ["C", "F", "G", "C"],
};

/**
 * Voicings, close and at or under C4 so the tune has the register above them. Triads move a step at most (C E G C,
 * F A C, G D G B, Am E A C). The four-note chords stand on their root, so they read as C6, F6, G7 and Am7 with or
 * without the bass under them.
 */
const TRIADS: Readonly<Record<Chord, string>> = {
  C: "e3,g3,c4",
  F: "f3,a3,c4",
  G: "d3,g3,b3",
  Am: "e3,a3,c4",
  "G/B": "d3,g3,b3",
};
const FOURS: Readonly<Record<Chord, string>> = {
  C: "c3,e3,g3,a3",
  F: "f3,a3,c4,d4",
  G: "b2,d3,f3,g3",
  Am: "a2,c3,e3,g3",
  "G/B": "b2,d3,f3,g3",
};
/** The last chord of the song, open and ringing. */
const LAST = { triad: "c3,e3,g3,c4", four: "c3,e3,g3,a3,d4" };

/**
 * Bass notes by chord: `R` the root on the downbeat (in every kit), `F` the fifth above, `O` the octave above. G/B
 * puts B in the bass, so the quiet part's bass falls C B A F; its fifth is the G chord's D.
 */
const BASS: Readonly<Record<Chord, { R: string; F: string; O: string }>> = {
  C: { R: "c2", F: "g2", O: "c3" },
  F: { R: "f1", F: "c2", O: "f2" },
  G: { R: "g1", F: "d2", O: "g2" },
  Am: { R: "a1", F: "e2", O: "a2" },
  "G/B": { R: "b1", F: "d2", O: "b2" },
};
/** A bass rhythm with `R`, `F` and `O` filled in for each bar's chord. */
const bassOf = (chord: Chord, rhythm: string): string =>
  rhythm.replace(/\b[RFO]\b/g, (t) => BASS[chord][t as "R" | "F" | "O"]);
/**
 * A section's bass: one rhythm for every bar, or a list of rhythms by bar (the list repeats). A rhythm that is already
 * a bar of notes (the jazz walk) passes through.
 */
function bassLine(id: SectionId, rhythm: string | readonly string[]): string {
  const list = typeof rhythm === "string" ? [rhythm] : rhythm;
  return bars(...PROG[id].map((c, i) => bassOf(c, list[i % list.length] as string)));
}

// ---- The tune (every flavour), in degrees of C4 major --------------------------------------------------------------
//
// 0 is C4, 7 is C5, -1 is B3. Eight slots to a bar are eighth notes.

/** The opening line: chord notes on the beats, passing and neighbour tones between them (U07.L04). */
const INTRO = bars("2 [1 0] 4 ~", "5 [6 5] 3 ~", "4 [5 4] 2 ~", "3 [2 1] 0@2");
/**
 * Asks in bars 1-4 (ends on D over G), answers in 5-8: starts the same way, climbs to the one high point, F5, in bar 6
 * and comes home. Mostly steps; C4 to F5 (U07.L01, U07.L06).
 */
const VERSE = bars(
  "0 ~ 1 2 4@2 2 ~",
  "3 ~ 4 5 7@2 5 ~",
  "4 ~ 2 ~ 0@2 2 ~",
  "1@6 ~@2",
  "0 ~ 1 2 4@2 2 ~",
  "5 ~ 7 8 10@2 9 ~",
  "8 ~ 7 6 4@2 1 ~",
  "0@6 ~@2",
);
/**
 * The hook: G G A G E over C, moved onto each chord (a sequence: D over G, E over Am, C over F), twice, the second
 * time climbing to A5 over Am and falling home to F over F (U07.L02, L03, L10).
 */
const CHORUS = bars(
  "4 ~ 4 5 4@2 2 ~",
  "8 ~ 8 9 8@2 6 ~",
  "9 ~ 9 10 9@2 7 ~",
  "7 ~ 7 8 7@2 5 ~",
  "4 ~ 4 5 4@2 2 ~",
  "8 ~ 8 9 8@2 6 ~",
  "12 ~ 11 ~ 9@2 7 ~",
  "7 ~ 5 ~ 3@3 ~",
);
/** The quiet part: the tune calls in the odd bars, high (C5 E5 C5 G4 over C, E5 A5 E5 C5 over Am)… */
const CALL = bars("7 ~ 9 ~ 7@2 4 ~", "~", "9 ~ 12 ~ 9@2 7 ~", "~");
/** …and the second line answers in the even bars, lower, down the chord (G D B over G, A F C and A G F over F). */
const ANSWER = bars("~", "~ ~ 4 1 -1@3 ~", "~", "~ ~ 5 3 0@3 ~", "~", "~ ~ 4 1 -1@3 ~", "~", "~ ~ 5 4 3@3 ~");
/** The second line in the first two loud parts: long chord notes under the hook, E D C C E D E-G F. */
const COUNTER = bars("2", "1", "0", "0", "2", "1", "2 4", "3");

const MEL: BySection = {
  intro: `n("${INTRO}")`,
  verse1: `n("${VERSE}")`,
  chorus1: `n("${CHORUS}")`,
  verse2: `n("${VERSE}")`,
  chorus2: `n("${CHORUS}")`,
  bridge: `n("${CALL}")`,
  // E and F on beats 3 and 4, stepping up into the last loud part's first G (U07.L08).
  break: `n("~ ~ 2 3")`,
  chorus3: `n("${CHORUS}")`,
  // G E | F A~ | ~A G | D C: the A held over from the F bar into the G bar falls to G; the D on the last downbeat
  // falls to C (U07.L05).
  outro: `n("[4@2 2@2 3@2 5@4 4@2 1 0@3]").slow(4)`,
};
const VOX: BySection = {
  intro: null,
  verse1: null,
  chorus1: `n("${COUNTER}")`,
  verse2: null,
  chorus2: `n("${COUNTER}")`,
  bridge: `n("${ANSWER}")`,
  break: null,
  // The last loud part: the second line doubles the hook an octave down.
  chorus3: `n("${CHORUS}").add(n(-7))`,
  outro: null,
};

// ---- The kits ------------------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the verses and the ending). */
  banks?: Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; lead: string; vox: string };
  /** Triads, or the four-note chords the kit's staging allows at U07. */
  fours: boolean;
  /**
   * Jazz-soul's swung eighths, on the drums and the two melody lines. The chords and the bass stay unswung: they only
   * start on beats or over a root, and a swung chord on an "and" would ring into the next bar's first beat.
   */
  swing?: string;
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
  kick: BySection;
  snare: BySection;
  hats: BySection;
  perc: BySection;
  /** Bass rhythms by section (`R`, `F`, `O` per bar's chord), or bars of notes. */
  bass: Readonly<Record<SectionId, string | readonly string[]>>;
  /** The chords' rhythm (`struct`) in each section; `chordSound` changes their sound in a section. */
  comp: Readonly<Record<SectionId, string>>;
  chordSound?: Partial<Record<SectionId, string>>;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines' fx. */
  synth?: {
    bassSound: Readonly<Record<SectionId, string>>;
    bass: Readonly<Record<SectionId, string>>;
    chords: Readonly<Record<SectionId, string>>;
    lead: string;
    vox: string;
  };
}

// Shared grooves: the opening's pickup into the first part, the break's fill, the ending's crash on the last bar.
const SNARE_PICKUP = "<~ ~ ~ [~ ~ ~ ~ ~ ~ sd sd]>";
const SNARE_FILL = "~ ~ [sd sd] [sd sd sd sd]";
const ENTER = "<~ ~ cr ~>";
const ENDING = "<cr ~ ~ cr>";

/** Pop: the default kit, piano, picked bass, piano tune, strings on the second line. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", vox: "strings" },
  fours: false,
  gain: { kick: 0.18, snare: 0.14, hats: 0.09, perc: 0.09, bass: 0.5, chords: 0.23, lead: 0.64, vox: 0.39 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ ~ bd ~ ~ ~]>"),
    verse1: v("bd ~ ~ ~ bd bd ~ ~"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    verse2: v("bd ~ ~ ~ bd bd ~ ~"),
    chorus2: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!6 [bd ~ bd ~ bd ~ bd ~] [bd*8]>"),
    break: v("bd ~ ~ ~"),
    chorus3: v("bd ~ bd ~ bd ~ bd ~"),
    outro: v("<[bd ~ ~ ~ ~ ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!6 [sd*8] [sd*16]>"),
    break: v(SNARE_FILL),
    chorus3: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<[~ hh]*4 [~ hh]*4 [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh hh oh]*2", V8),
    verse2: v("hh*8", V8),
    chorus2: v("[hh hh hh oh]*2", V8),
    bridge: v("<~!6 [hh*8]!2>", V8),
    break: null,
    chorus3: v("hh*16", V16),
    outro: v("hh*4", V4),
  },
  perc: {
    intro: v(ENTER),
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, [~ tb]*4] [[~ tb]*4]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
    verse2: v("<[cr, [~ sh]*4] [[~ sh]*4]!7>"),
    chorus2: v("<[cr, [~ tb]*4] [[~ tb]*4]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
    bridge: v("<[cr, sh*8] [sh*8]!5 ~ ~>"),
    break: v("cr ~ ~ ~"),
    chorus3: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v(ENDING),
  },
  bass: {
    intro: ["~", "~", "R@3 ~ R R@2 ~", "R@3 ~ R R@2 ~"],
    verse1: "R@3 ~ R R@2 ~",
    chorus1: "R R R R R R R O",
    verse2: "R@3 ~ R R@2 ~",
    chorus2: "R R R R R R R O",
    bridge: ["R", "R", "R", "R", "R", "R", "R*8", "R*8"],
    break: "R@2 ~ ~",
    chorus3: "R R R R R R R O",
    outro: "R",
  },
  comp: {
    intro: "x@6 x@2",
    verse1: "x@3 x@3 x@2",
    chorus1: "x*8",
    verse2: "x@3 x@3 x@2",
    chorus2: "x*8",
    bridge: "<x!6 [x*4] [x*8]>",
    break: "x ~ ~ ~",
    chorus3: "x*8",
    outro: "x",
  },
};

/**
 * Indie: Oak's rock kit (LinnDrum), clean guitar strums, picked bass, acoustic guitar on the tune, organ on the second
 * line. The verses sit back (snare on 3); the loud parts go four on the floor over an octave bass.
 */
const INDIE: Kit = {
  bank: "LinnDrum",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "organ" },
  fours: false,
  gain: { kick: 0.38, snare: 0.33, hats: 0.23, perc: 0.19, bass: 0.52, chords: 0.41, lead: 1, vox: 0.64 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ bd ~]>"),
    verse1: v("bd ~ ~ ~ ~ bd ~ ~"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ bd ~ ~"),
    chorus2: v("bd*4"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!6 [bd*4] [bd*8]>"),
    break: v("bd ~ ~ ~"),
    chorus3: v("bd*4"),
    outro: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!6 [sd*8] [sd*16]>"),
    break: v(SNARE_FILL),
    chorus3: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh oh]*4", V8),
    verse2: v("hh*8", V8),
    chorus2: v("[hh oh]*4", V8),
    bridge: v("<~!6 [hh*8]!2>", V8),
    break: null,
    chorus3: v("[hh oh]*4", V8),
    outro: v("hh*4", V4),
  },
  perc: {
    intro: v(ENTER),
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, [~ tb]*4] [[~ tb]*4]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    chorus2: v("<[cr, [~ tb]*4] [[~ tb]*4]!3 [cr, [~ tb]*4] [[~ tb]*4]!3>"),
    bridge: v("<[cr, tb*4] [tb*4]!5 ~ ~>"),
    break: v("cr ~ ~ ~"),
    chorus3: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v(ENDING),
  },
  bass: {
    intro: ["~", "~", "R@5 R@3", "R@5 R@3"],
    verse1: "R@5 R@3",
    chorus1: "[R O]*4",
    verse2: "R@5 R@3",
    chorus2: "[R O]*4",
    bridge: ["R", "R", "R", "R", "R", "R", "R*8", "[R O]*4"],
    break: "R@2 ~ ~",
    chorus3: "[R O]*4",
    outro: "R",
  },
  comp: {
    intro: "x@3 x@3 x@2",
    verse1: "x ~ x ~ x x ~ ~",
    chorus1: "x*8",
    verse2: "x ~ x ~ x x ~ ~",
    chorus2: "x*8",
    bridge: "<x!6 [x*4] [x*8]>",
    break: "x ~ ~ ~",
    chorus3: "x*8",
    outro: "x",
  },
};

/** The jazz ride: on the beat, with the swung "and" of 2 and 4. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/**
 * The bass of the loud parts: the root on beats 1 and 2 (under the Rhodes), then a walk to the next root on 3 and 4:
 * C C E D | G G B D | A A C E | F F C A. No B under C, F or Am, no E under F or G.
 */
const WALK = ["c2 c2 e2 d2", "g1 g1 b1 d2", "a1 a1 c2 e2", "f2 f2 c2 a1"];
/** The walk into the break, out of the quiet part: A C E G, F A C D. */
const WALK_IN = ["a1 c2 e2 g1", "f1 a1 c2 d2"];

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes on the tune, tenor sax on the second line. Swung eighths and
 * four-note chords (from U03). The verses on cross-stick and the ride over a two-feel bass; the loud parts on the
 * snare's backbeat over a walking bass.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "tenor" },
  fours: true,
  swing: ".swingBy(1/3, 4)",
  gain: { kick: 0.2, snare: 0.34, hats: 0.22, perc: 0.22, bass: 0.72, chords: 0.38, lead: 0.5, vox: 0.5 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~] [bd ~ ~ ~]>"),
    verse1: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    verse2: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus2: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~]!6 [bd ~ bd ~] [bd bd bd bd]>"),
    break: v("bd ~ ~ ~"),
    chorus3: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ sd sd]>"),
    verse1: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!6 [~ sd ~ sd] [sd*8]>"),
    break: v("~ ~ [sd sd] [sd sd]"),
    chorus3: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("<[~ ~ rim ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ ~ [~ hh ~ hh] [~ hh ~ hh]>"),
    verse1: v("~ hh ~ hh"),
    chorus1: v("~ hh ~ hh"),
    verse2: v("~ hh ~ hh"),
    chorus2: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    break: null,
    chorus3: v("~ hh ~ hh"),
    outro: v("~ hh ~ hh"),
  },
  perc: {
    intro: v(`<~ ~ [cr, ${RIDE}] [${RIDE}]>`, V8),
    verse1: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    chorus1: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!3>`, V8),
    verse2: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    chorus2: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!3>`, V8),
    bridge: v("<[cr, rd*4] [rd*4]!5 [rd*8] [rd*8]>"),
    break: v("cr ~ ~ ~"),
    chorus3: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!3>`, V8),
    outro: v("<[cr, rd*4] [rd*4]!2 cr>"),
  },
  bass: {
    intro: ["~", "~", "R@4 F@4", "R@4 F@4"],
    verse1: "R@4 F@4",
    chorus1: WALK,
    verse2: "R@4 F@4",
    chorus2: WALK,
    // The falling bass in half notes, then the walk into the break: A C E G, F A C D.
    bridge: ["R@4 F@4", "R@4 F@4", "R@4 F@4", "R@4 F@4", "R@4 F@4", "R@4 F@4", ...WALK_IN],
    break: "R@2 ~ ~",
    chorus3: WALK,
    outro: "R",
  },
  comp: {
    intro: "x",
    verse1: "x@3 x@5",
    chorus1: "x@2 x x@5",
    verse2: "x@3 x@5",
    chorus2: "x@2 x x@5",
    bridge: "x",
    break: "x ~ ~ ~",
    chorus3: "x@2 x x@5",
    outro: "x",
  },
};

const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FUNK_KICK_LOUD = "bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~";
const FUNK_BASS = "R ~ ~ R ~ ~ O ~ ~ ~ R ~ ~ ~ ~ ~";
const FUNK_PUSH = "R ~ O R ~ ~ O ~ R ~ R ~ O ~ ~ ~";
const FUNK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FUNK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";
const FUNK_VERSE_SNARE = `<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`;
const FUNK_CHORUS_SNARE = `<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`;

/**
 * Funk: Oak's 808, clavinet, finger bass, organ on the tune, trumpet on the second line. Straight sixteenths and
 * four-note chords (from U06); the kick and the octave-popping bass lock on 1, the "a" of 1, the "and" of 2 and the
 * "and" of 3. Strings hold the chords in the quiet part and the ending.
 */
const FUNK: Kit = {
  bank: "RolandTR808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "trumpet" },
  fours: true,
  gain: { kick: 0.27, snare: 0.18, hats: 0.1, perc: 0.1, bass: 0.68, chords: 0.39, lead: 0.89, vox: 0.55 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<~ ~ [${FUNK_KICK}] [${FUNK_KICK}]>`),
    verse1: v(FUNK_KICK),
    chorus1: v(FUNK_KICK_LOUD),
    verse2: v(FUNK_KICK),
    chorus2: v(FUNK_KICK_LOUD),
    bridge: v(`<[bd ~ ~ ~]!6 [${FUNK_KICK}] [bd ~ bd ~ bd ~ bd ~]>`),
    break: v("bd ~ ~ ~"),
    chorus3: v(FUNK_KICK_LOUD),
    outro: v("<[bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>"),
    verse1: v(FUNK_VERSE_SNARE),
    chorus1: v(FUNK_CHORUS_SNARE),
    verse2: v(FUNK_VERSE_SNARE),
    chorus2: v(FUNK_CHORUS_SNARE),
    bridge: v("<[~ ~ sd ~]!6 [sd*8] [sd*16]>"),
    break: v(SNARE_FILL),
    chorus3: v(FUNK_CHORUS_SNARE),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ ~ [hh*16] [hh*16]>", V16),
    verse1: v("hh*16", V16),
    chorus1: v("[hh hh hh hh hh hh oh hh]*2", V16),
    verse2: v("hh*16", V16),
    chorus2: v("[hh hh hh hh hh hh oh hh]*2", V16),
    bridge: v("<[hh*8]!6 [hh*16]!2>", V16),
    break: null,
    chorus3: v("[hh hh hh hh hh hh oh hh]*2", V16),
    outro: v("hh*8", V8),
  },
  perc: {
    intro: v(ENTER),
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    verse2: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!7>"),
    chorus2: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    bridge: v("<[cr, sh*8] [sh*8]!5 ~ ~>"),
    break: v("cr ~ ~ ~"),
    chorus3: v("<[cr, [~ cb]*4] [[~ cb]*4]!3 [cr, [~ cb]*4] [[~ cb]*4]!3>"),
    outro: v(ENDING),
  },
  bass: {
    intro: ["~", "~", FUNK_BASS, FUNK_BASS],
    verse1: FUNK_BASS,
    chorus1: FUNK_PUSH,
    verse2: FUNK_BASS,
    chorus2: FUNK_PUSH,
    bridge: ["R", "R", "R", "R", "R", "R", FUNK_BASS, FUNK_PUSH],
    break: "R@2 ~ ~",
    chorus3: FUNK_PUSH,
    outro: "R",
  },
  comp: {
    intro: "~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~",
    verse1: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    chorus1: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    verse2: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    chorus2: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    bridge: "<x!6 [x x x x]!2>",
    break: "x ~ ~ ~",
    chorus3: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    outro: "x",
  },
  chordSound: { bridge: "<strings!6 clav!2>", outro: "strings" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. The acid cells repeat the root and jump the octave
// between the beats; every downbeat is the chord's root, as in every kit.
const ACID_CELL = "R ~ R O R ~ R ~ R ~ O R R ~ ~ R";
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
 * Electronic: Oak's 909-style machine and the lo-fi kit. The opening swells on a supersaw pad; the verses sit on the
 * lo-fi kit, a broken beat over a sine sub and off-beat stabs; the loud parts go four on the floor on the 909 with the
 * acid line and pumping stabs; the quiet part drops the kick under the pad and builds into the acid; the ending is half
 * time on the lo-fi kit over the sub. A square pluck with a dotted-eighth echo plays the tune, a supersaw the second
 * line. Straight; four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", outro: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", vox: "supersaw" },
  fours: true,
  gain: { kick: 0.24, snare: 0.1, hats: 0.08, perc: 0.06, bass: 0.57, chords: 0.19, lead: 0.48, vox: 0.37 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd*4] [bd*4]>"),
    verse1: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus2: v("bd*4"),
    bridge: v("<~!4 [bd ~ ~ ~]!2 [bd*4] [bd*8]>"),
    break: v("bd ~ ~ ~"),
    chorus3: v("bd*4"),
    outro: v("<[bd ~ ~ ~]!3 bd>"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<~!4 [~ ~ cp ~]!2 [sd*8] [sd*16]>"),
    break: v(SNARE_FILL),
    chorus3: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 ~>"),
  },
  hats: {
    intro: v("<~ ~ [hh hh oh hh]*4 [hh hh oh hh]*4>", V16),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh oh hh]*4", V16),
    verse2: v("hh*8", V8),
    chorus2: v("[hh hh oh hh]*4", V16),
    bridge: v("<~!4 [hh*8]!2 [hh*16]!2>", V16),
    break: null,
    chorus3: v("[hh hh oh hh]*4", V16),
    outro: v("hh*4", V4),
  },
  perc: {
    intro: v(ENTER),
    verse1: v("<cr ~!7>"),
    chorus1: v("<cr ~!3 cr ~!3>"),
    verse2: v("<[cr, [~ sh ~ sh]] [~ sh ~ sh]!7>"),
    chorus2: v("<cr ~!3 cr ~!3>"),
    bridge: v("<cr ~!5 [~ ~ [lt lt] [ht ht]] [~ ~ [lt lt] [ht ht]]>"),
    break: v("cr ~ ~ ~"),
    chorus3: v("<[cr, [~ sh]*4] [[~ sh]*4]!3 [cr, [~ sh]*4] [[~ sh]*4]!3>"),
    outro: v(ENDING),
  },
  bass: {
    intro: ["~", "~", "R@2 R@2", "R@2 R@2"],
    // The sub locks with the broken beat's kick: 1, the "and" of 2, the "and" of 3.
    verse1: "R@3 R@2 R@3",
    chorus1: ACID_CELL,
    verse2: "R@3 R@2 R@3",
    chorus2: ACID_CELL,
    bridge: ["R", "R", "R", "R", "R", "R", "R*8", ACID_CELL],
    break: "R@2 ~ ~",
    chorus3: ACID_CELL,
    outro: "R",
  },
  comp: {
    intro: "x*4",
    verse1: "~ x ~ x ~ x ~ ~",
    chorus1: "x*8",
    verse2: "~ x ~ x ~ x ~ ~",
    chorus2: "x*8",
    bridge: "<[x*4]!6 [x*8]!2>",
    break: "x ~ ~ ~",
    chorus3: "x*8",
    outro: "<[~ x ~ x ~ ~ ~ ~]!3 x>",
  },
  chordSound: { intro: "supersaw", bridge: "<supersaw!6 sawtooth!2>" },
  synth: {
    bassSound: {
      intro: "sine",
      verse1: "sine",
      chorus1: "sawtooth",
      verse2: "sine",
      chorus2: "sawtooth",
      bridge: "<sine!6 sawtooth!2>",
      break: "sine",
      chorus3: "sawtooth",
      outro: "sine",
    },
    bass: {
      intro: SUB,
      verse1: SUB,
      chorus1: ACID,
      verse2: SUB,
      chorus2: ACID,
      // The falling bass on the sub, then the build on the acid line.
      bridge:
        '.lpq(12).ftype("ladder").lpenv("<0!6 3!2>").lpd(.14).lps(0).decay("<1.2!6 .2!2>").sustain("<.7!6 .4!2>")',
      break: SUB,
      chorus3: ACID,
      outro: SUB,
    },
    chords: {
      intro: PAD,
      verse1: STAB,
      chorus1: `${STAB}${PUMP}`,
      verse2: STAB,
      chorus2: `${STAB}${PUMP}`,
      bridge: '.attack("<.12!6 0!2>").lpf(1800).lpenv(2).lpd(.12).decay(.4).sustain(.5)',
      break: STAB,
      chorus3: `${STAB}${PUMP}`,
      outro: ".lpf(1600).decay(.6).sustain(.4)",
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.49).delayfeedback(.35)",
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

/** One flavour's song: the tune first, then the second line, the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const swing = k.swing ?? "";
  const syn = k.synth;
  const voicing = k.fours ? FOURS : TRIADS;
  const last = k.fours ? LAST.four : LAST.triad;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    const prog = PROG[id];
    // The ending's last bar is the open C chord; every other bar its chord's voicing.
    const notes = prog.map((c, i) => (id === "outro" && i === prog.length - 1 ? last : voicing[c]));
    return `note("${bars(...notes)}").struct("${k.comp[id]}").s("${sound}")${syn?.chords[id] ?? ""}`;
  });
  const bass = mapSections((id) => {
    const line = bassLine(id, k.bass[id]);
    return syn ? `note("${line}").s("${syn.bassSound[id]}")${syn.bass[id]}` : `note("${line}")`;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: BySection): BySection =>
    k.banks
      ? mapSections((id) => (by[id] === null ? null : `${by[id]}.bank("${k.banks?.[id] ?? k.bank}")`))
      : by;
  const tracks = [
    track(
      "mel",
      MEL,
      `.scale("C4:major")${swing}.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)})`,
    ),
    track(
      "vox",
      VOX,
      `.scale("C4:major")${swing}.s("${k.sounds.vox}")${syn?.vox ?? ""}.gain(${num(k.gain.vox)}).pan(.45).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track("bass", bass, `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`),
    track(
      "kick",
      drums(k.kick),
      `${bank}${swing}${/^(RolandTR808|oak808)$/.test(k.bank) ? KICK_808 : ""}.gain(${num(k.gain.kick)})`,
    ),
    track("snare", drums(k.snare), `${bank}${swing}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}${swing}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc), `${bank}${swing}.gain(${num(k.gain.perc)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: SectionId[],
  parts: SongPartId[],
  today: string,
  oakKeeps?: SongPartId[],
): TakeStep => ({
  lesson,
  kind: "take",
  sections,
  parts,
  ...(oakKeeps ? { oakKeeps } : {}),
  startFrom: "oak",
  today,
});

export const U07_SONG = defineUnitSong({
  id: "usong.U07",
  unit: "U07",
  version: 1,
  title: "Somewhere to land",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 92,
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
  // By section (AUTHORING §23.6): every take writes the tune of one section; the Makes whose code plays a `chords:`
  // line (L03, L04, L05, L08) take that section's chords too, and keep Oak's bass, which plays their chords' roots.
  // Every step opens with its own starter: each earlier take either already meets the next required rule (L01's
  // tune ends on 1 for L06; L02's motif comes back for L10) or lacks the chords line the next Make is about.
  plan: [
    take(
      "U07.L01",
      ["verse1"],
      ["lead"],
      "Your eight-bar tune replaces Oak's tune in the second part of the song, over the band's eight-bar phrase.",
    ),
    take(
      "U07.L02",
      ["chorus1"],
      ["lead", "vox"],
      "Your four bars built from one idea play twice in the first loud part of the song.",
    ),
    { lesson: "U07.L11", kind: "side", reason: "Placeholder until this lesson is written." },
    take(
      "U07.L03",
      ["chorus2"],
      ["lead", "chords"],
      "Your tune, over the chords line in your code, plays the second loud part of the song.",
      ["bass"],
    ),
    take(
      "U07.L04",
      ["intro"],
      ["lead", "chords"],
      "Your tune over C and F opens the song, its first four bars, with your chords line under it.",
      ["bass"],
    ),
    take(
      "U07.L05",
      ["outro"],
      ["lead", "chords"],
      "Your tune over I IV V I ends the song, in its last four bars.",
      ["bass"],
    ),
    take(
      "U07.L06",
      ["verse2"],
      ["lead"],
      "Your eight bars, four that ask and four that answer, take over the fourth part of the song.",
    ),
    take(
      "U07.L07",
      ["bridge"],
      ["lead", "vox"],
      "Your two tune lines take turns in the quiet part of the song, before the last loud part.",
    ),
    take(
      "U07.L08",
      ["break"],
      ["lead", "chords"],
      "The first bar of your code plays the one-bar stop, so its last note leads into the last loud part.",
      ["bass"],
    ),
    {
      lesson: "U07.L09",
      kind: "side",
      reason:
        "This lesson counts three to a bar and is in F, and the song counts four in C, so this tune stays a sketch of its own.",
    },
    take(
      "U07.L10",
      ["chorus3"],
      ["lead", "vox"],
      "Your four-bar hook plays the last loud part of the song, twice through.",
    ),
  ],
  releaseAfter: "U07.CP",
});

export default U07_SONG;
