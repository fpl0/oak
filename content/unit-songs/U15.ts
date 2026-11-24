// Song 15, "Visitors" (docs/design/songs/makes-core-c.md §3 "U15 song: soul song with visitors"; AUTHORING §23).
// C major, 4/4, 88 BPM, 61 bars: a soul song whose every section has chords from outside the key that lean into
// the chord after them, the unit's secondary dominants.
//
//   intro 4 | verse 8 | chorus 8 | solo 8 | verse 8 | chorus 8 | bridge 8 | outro 8 | end 1
//   C A7 Dm G7 | C Am F G7 C Am D7 G7 | C E7 Am C7 F A7 Dm G7 | Cmaj7 Dm7 Em7 C7 Fmaj7 A7 Dm7 G7 | … | … |
//   C C#°7 Dm7 F#°7 G7 G#°7 Am7 G7 | C E7 A7 A7 D7 G7 C G7 | C
//
// Every section is the harmony of the lesson that takes it over, with the doors already open, so Oak's song plays
// each lesson's idea before the learner writes it: the soul turn of U15.L01 opens the song (with A7, the V7 of ii,
// in bar 2); the verse is U15.L02's, D7 (V7 of V) in bar 7; the chorus is U15.L03's ballad turn with all three
// visitors, E7 into Am, C7 into F, A7 into Dm; the solo is U15.L06's staircase of sevenths with two doors open (C7
// into Fmaj7, A7 into Dm7); the bridge is U15.L04's gospel walk-up, a diminished seventh a half step under each new
// chord while the bass climbs C C# D, F# G G# A; the outro is U15.L05's chain, E7 A7 D7 G7 home to C, on horns and a
// trumpet, ending on one bar of C.
//
// The tune sings the note each visitor brings and lets it lean into the next chord: F# to G over D7 (verse), G# to
// A, Bb to A and C# to D in the chorus, whose hook (a three-note climb to a held note, then a fall) comes back to
// open the outro. Horns enter at the chorus and answer the chords that the visitors land on (bars 1, 3, 5, 7 and 8),
// swell under the bridge's last four bars and play stabs all through the outro.
//
// Every flavour plays the same notes (tune, bass roots on every downbeat, chord roots); a flavour changes sounds,
// grooves, comp and bass rhythms, and chord colour as its kit's staging allows at U15 (content/flavours.ts
// FLAVOUR_RULES): pop and indie play the chords as written, straight; jazz-soul swings (1/3); jazz-soul, funk and
// electronic colour the plain chords (C6, F6, Am7, Dm7). The visitors are dominant sevenths and diminished sevenths
// in every flavour: without its seventh C7 would be C. Wherever a C6 or F6 is struck the bass sounds its root, so it
// never reads as Am7 or Dm7. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top.
// Tune and bass hold no note a half step from a
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
  // U15.L06's staircase: an instrumental eight bars between the first chorus and the second verse.
  { id: "solo", type: "solo", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "bridge", type: "bridge", bars: 8 },
  { id: "outro", type: "outro", bars: 8 },
  // The last chord: U15.L05's loop ends on G7, so the song lands on C in a bar of its own.
  { id: "end", type: "outro", bars: 1 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What a section plays like: the verses share one plan, the choruses another; the last bar is its own. */
type Slot = "intro" | "verse" | "chorus" | "solo" | "bridge" | "outro" | "end";
const SLOT: Readonly<Record<SectionId, Slot>> = {
  intro: "intro",
  verse1: "verse",
  chorus1: "chorus",
  solo: "solo",
  verse2: "verse",
  chorus2: "chorus",
  bridge: "bridge",
  outro: "outro",
  end: "end",
};
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;
type BySlot<T> = Readonly<Record<Slot, T>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `melOutro2` for the last bar), `silence` where it rests, and one `arrange()` over the whole song.
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
// One chord a bar. Voiced close and low (B2 to B3) outside the loud parts, so every change moves each voice a step
// or two and the tune has the register above to itself; the choruses, the outro and the last bar lift the voicing
// to E3–F4 under a tune that starts on G4. Pop and indie play every chord as written; jazz-soul, funk and
// electronic make the key's plain triads four-note (C6, F6, Am7, Dm7). Dominant and diminished sevenths are the
// same in every flavour. Bass: roots C2 to B2, with the fifth, the third and the octave for the patterns that walk
// or pop. The bridge's bass climbs C2 C#2 D2, F#2 G2 G#2 A2.

type ChordName =
  | "C"
  | "Am"
  | "F"
  | "Dm"
  | "G7"
  | "D7"
  | "E7"
  | "C7"
  | "A7"
  | "Dm7"
  | "Am7"
  | "Em7"
  | "C^7"
  | "F^7"
  | "C#o7"
  | "F#o7"
  | "G#o7";
interface Voicing {
  low: string;
  high?: string;
}
interface Chord {
  /** Bass notes: root, fifth, third, octave. */
  r: string;
  f: string;
  t: string;
  o: string;
  /** As written (pop, indie). */
  plain: Voicing;
  /** With the kit's colour (jazz-soul, funk, electronic); the same as `plain` for sevenths. */
  four?: Voicing;
  /** The horns: three notes of the chord, root included, under the tune. */
  horns: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  C: {
    r: "c2",
    f: "g2",
    t: "e2",
    o: "c3",
    plain: { low: "c3,e3,g3", high: "g3,c4,e4" },
    four: { low: "c3,e3,g3,a3", high: "e3,g3,a3,c4" },
    horns: "g3,c4,e4",
  },
  Am: {
    r: "a2",
    f: "e3",
    t: "c3",
    o: "a3",
    plain: { low: "c3,e3,a3", high: "a3,c4,e4" },
    four: { low: "a2,c3,e3,g3", high: "g3,a3,c4,e4" },
    horns: "a3,c4,e4",
  },
  F: {
    r: "f2",
    f: "c3",
    t: "a2",
    o: "f3",
    plain: { low: "c3,f3,a3", high: "a3,c4,f4" },
    four: { low: "c3,d3,f3,a3", high: "f3,a3,c4,d4" },
    horns: "a3,c4,f4",
  },
  Dm: {
    r: "d2",
    f: "a2",
    t: "f2",
    o: "d3",
    plain: { low: "a2,d3,f3", high: "a3,d4,f4" },
    four: { low: "a2,c3,d3,f3", high: "f3,a3,c4,d4" },
    horns: "a3,d4,f4",
  },
  G7: {
    r: "g2",
    f: "d3",
    t: "b2",
    o: "g3",
    plain: { low: "b2,d3,f3,g3", high: "g3,b3,d4,f4" },
    four: { low: "b2,d3,f3,g3", high: "f3,g3,b3,d4" },
    horns: "g3,b3,f4",
  },
  D7: {
    r: "d2",
    f: "a2",
    t: "f#2",
    o: "d3",
    plain: { low: "c3,d3,f#3,a3", high: "f#3,a3,c4,d4" },
    horns: "f#3,c4,d4",
  },
  E7: {
    r: "e2",
    f: "b2",
    t: "g#2",
    o: "e3",
    plain: { low: "b2,d3,e3,g#3", high: "g#3,b3,d4,e4" },
    horns: "g#3,d4,e4",
  },
  C7: {
    r: "c2",
    f: "g2",
    t: "e2",
    o: "c3",
    plain: { low: "c3,e3,g3,bb3", high: "g3,bb3,c4,e4" },
    horns: "bb3,c4,e4",
  },
  A7: {
    r: "a2",
    f: "e3",
    t: "c#3",
    o: "a3",
    plain: { low: "c#3,e3,g3,a3", high: "g3,a3,c#4,e4" },
    horns: "a3,c#4,g4",
  },
  Dm7: {
    r: "d2",
    f: "a2",
    t: "f2",
    o: "d3",
    plain: { low: "a2,c3,d3,f3", high: "f3,a3,c4,d4" },
    horns: "a3,c4,f4",
  },
  Am7: {
    r: "a2",
    f: "e3",
    t: "c3",
    o: "a3",
    plain: { low: "a2,c3,e3,g3", high: "g3,a3,c4,e4" },
    horns: "a3,c4,e4",
  },
  Em7: { r: "e2", f: "b2", t: "g2", o: "e3", plain: { low: "b2,d3,e3,g3" }, horns: "g3,b3,e4" },
  "C^7": { r: "c2", f: "g2", t: "e2", o: "c3", plain: { low: "c3,e3,g3,b3" }, horns: "g3,c4,e4" },
  "F^7": { r: "f2", f: "c3", t: "a2", o: "f3", plain: { low: "c3,e3,f3,a3" }, horns: "a3,c4,f4" },
  "C#o7": { r: "c#2", f: "g2", t: "e2", o: "c#3", plain: { low: "c#3,e3,g3,bb3" }, horns: "bb3,e4,g4" },
  "F#o7": { r: "f#2", f: "c3", t: "a2", o: "f#3", plain: { low: "c3,eb3,f#3,a3" }, horns: "a3,c4,eb4" },
  // The horns over the bridge's bar 6 play only B and D: notes of G7, G#°7 and E7 alike, so they stay when the
  // learner's walk-up (U15.L04) puts any of the three there.
  "G#o7": { r: "g#2", f: "d3", t: "b2", o: "g#3", plain: { low: "d3,f3,g#3,b3" }, horns: "b3,d4" },
};
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: ["C", "A7", "Dm", "G7"],
  verse1: ["C", "Am", "F", "G7", "C", "Am", "D7", "G7"],
  chorus1: ["C", "E7", "Am", "C7", "F", "A7", "Dm", "G7"],
  solo: ["C^7", "Dm7", "Em7", "C7", "F^7", "A7", "Dm7", "G7"],
  verse2: ["C", "Am", "F", "G7", "C", "Am", "D7", "G7"],
  chorus2: ["C", "E7", "Am", "C7", "F", "A7", "Dm", "G7"],
  bridge: ["C", "C#o7", "Dm7", "F#o7", "G7", "G#o7", "Am7", "G7"],
  outro: ["C", "E7", "A7", "A7", "D7", "G7", "C", "G7"],
  end: ["C"],
};
/** The loud parts sit higher; everything else low. */
const HIGH = new Set<Slot>(["chorus", "outro", "end"]);

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eighth notes to a bar (`@` holds). Every held note (a beat or longer) is a note of its chord. The verse talks low
// (C4–C5), starting off the beat; its bar 7 sits on F# over D7 and steps up to G over G7. The chorus hook climbs
// three notes to a held note on beat 2, then falls to a held note on the "and" of 3; over each visitor that last note
// is the visitor's own (G#, Bb, C#) and the next bar starts a half step away (A, A, D). The solo runs in eighths over
// the staircase, never resting on C over Cmaj7 or F over Fmaj7. The bridge climbs a step every two bars (G, A, B, C)
// in long notes, singing over each push only notes that every push of U15.L04 shares (E and G, A and C, D and B).
// The outro starts with the chorus hook and rides the chain: G# over E7, C# over A7 sliding to C over D7, B over G7.

const INTRO_TUNE = ["~", "~", "d5 e5 f5@2 e5 d5@3", "b4 d5 g5@2 f5 d5@3"];
const VERSE_TUNE = [
  "~ e4 g4 a4 g4@2 e4 c4",
  "e4@3 d4 c4@2 ~ ~",
  "~ f4 a4 c5 a4@2 g4 f4",
  "g4@3 ~ d4 f4 g4@2",
  "~ e4 g4 a4 g4@2 e4 c4",
  "e4@3 g4 a4@2 c5@2",
  "~ c5 a4 f#4@2 a4 f#4@2",
  "g4@3 f4 d4@4",
];
const HOOK = [
  "g4 c5 e5@2 d5 c5@3",
  "b4 d5 e5@2 d5 g#4@3",
  "a4 c5 e5@2 d5 c5@3",
  "g4 c5 e5@2 c5 bb4@3",
  "a4 c5 f5@2 e5 c5@3",
  "a4 c#5 e5@2 g5 c#5@3",
  "d5 e5 f5@2 e5 d5@3",
  "b4 d5 g5@2 f5 d5@3",
];
const SOLO_TUNE = [
  "e4 g4 b4 d5@2 b4 g4 e4",
  "f4 a4 c5 e5@2 d5 c5 a4",
  "g4 b4 d5 g5@2 e5 d5 e5",
  "c5 bb4 g4 e4@2 g4 bb4@2",
  "a4@2 c5 e5 a5@2 g5 e5",
  "e5 c#5 a4 e4@2 g4 c#5@2",
  "d5@2 f5 a5 d5@2 c5 a4",
  "b4@3 a4 g4@2 f4 d4",
];
const BRIDGE_TUNE = [
  "g4@4 e4@2 g4@2",
  "g4@6 e4@2",
  "a4@4 f4@2 a4@2",
  "c5@6 a4@2",
  "b4@4 g4@2 b4@2",
  "d5@6 b4@2",
  "e5@4 c5@2 a4@2",
  "d5@6 b4@2",
];
const OUTRO_TUNE = [
  "g4 c5 e5@2 d5 c5@3",
  "b4 d5 e5@2 d5 g#4@3",
  "a4 c#5 e5@2 g5 e5@3",
  "c#5 e5 g5@2 e5 c#5@3",
  "c5 a4 f#4@2 a4 c5@3",
  "b4 d5 f5@2 d5 b4@3",
  "c5 e5 g5@2 e5 c5@3",
  "b4 d5 f5@2 e5 d5@3",
];

/**
 * The tune, section by section. `bar` rewrites each bar: in the swung kit a note held from the "and" of 3 to the bar
 * line (`x@3` at the end of a bar) is cut to a beat and a rest, because swing starts it late and it would otherwise
 * ring into the next bar's chord.
 */
const melOf = (bar: (b: string) => string): BySection => {
  const t = (tune: readonly string[]) => `note("${bars(tune.map(bar))}")`;
  return {
    intro: t(INTRO_TUNE),
    verse1: t(VERSE_TUNE),
    chorus1: t(HOOK),
    solo: t(SOLO_TUNE),
    verse2: t(VERSE_TUNE),
    chorus2: t(HOOK),
    bridge: t(BRIDGE_TUNE),
    outro: t(OUTRO_TUNE),
    end: t(["c5"]),
  };
};
const AS_WRITTEN = (b: string): string => b;
const SWING_SAFE = (b: string): string => b.replace(/@3$/, "@2 ~");

/**
 * The horns' rhythm (a `struct` over one chord a bar), the same in every flavour: none until the chorus; in the
 * chorus a hit on the chords the visitors land on (bars 1, 3, 5, 7) and two into the last bar; long notes under the
 * bridge's last four bars; stabs on 1, the "and" of 2 and 4 all through the outro (U15.L05's own `.struct()`).
 */
const HORNS_STRUCT: BySlot<string | null> = {
  intro: null,
  verse: null,
  chorus: "<[x@2 ~@6] ~ [x@2 ~@6] ~ [x@2 ~@6] ~ [x@2 ~@6] [~@4 x ~ x@2]>",
  solo: null,
  bridge: "<~ ~ ~ ~ x x x x>",
  outro: "x ~ ~ x ~ ~ x ~",
  end: "x",
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;
/** The bridge's hats: a steady line whose velocity climbs over its eight bars, into the outro. */
const RISING = (mini: string, from = 0.3): string =>
  `s("${mini}").velocity(saw.range(${num(from)}, 1).slow(8))`;

/**
 * A bass bar: `{r}` root, `{f}` fifth, `{t}` third, `{o}` octave of the bar's chord, or `~` for a rest. A function
 * gets the bar's index in its section.
 */
type BassBar = string | ((i: number) => string);
/** Bars 1–2 of the intro hold the root under the chords; bars 3–4 play the verse's bar. */
const INTRO_BASS =
  (held: string, groove: string): BassBar =>
  (i) =>
    i < 2 ? held : groove;
/** The bridge builds: one bar for its first four bars, another for the next two, a third for the last two. */
const BUILD =
  (a: string, b: string, c: string): BassBar =>
  (i) =>
    i < 4 ? a : i < 6 ? b : c;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the quiet ones). */
  banks?: Partial<Record<SectionId, string>>;
  /** The key's plain chords as written (pop, indie) or four-note (jazz-soul, funk, electronic at U15). */
  depth: "plain" | "four";
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; chords: string; lead: string; horns: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    horns: number;
  };
  /** content/flavours.ts production: the room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: BySlot<string | null>;
  snare: BySlot<string | null>;
  hats: BySlot<string | null>;
  perc: BySlot<string | null>;
  bass: BySlot<BassBar>;
  /** The chords' rhythm (`struct`) in each section. */
  comp: BySlot<string>;
  /** Another sound for the chords, the tune or the horns in some sections. */
  chordSound?: Partial<Record<Slot, string>>;
  leadSound?: Partial<Record<Slot, string>>;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines'. */
  synth?: {
    bassSound: BySlot<string>;
    bass: BySlot<string>;
    chords: BySlot<string>;
    lead: string;
    horns: string;
  };
}

/** Pop: the default kit, piano, picked bass; the kick and the bass lock on 1, the "and" of 2 and 3. */
const POP: Kit = {
  bank: "",
  depth: "plain",
  swing: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", horns: "horns" },
  gain: { kick: 0.21, snare: 0.18, hats: 0.12, perc: 0.1, bass: 0.66, chords: 0.22, lead: 0.31, horns: 0.23 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<[bd ~ ~ ~ ~ ~ ~ ~]!2 [bd ~ ~ bd bd ~ ~ ~]!2>"),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd bd ~ bd ~"),
    solo: v("bd ~ ~ ~ ~ ~ bd ~"),
    bridge: v("<[bd ~ ~ ~ bd ~ ~ ~]!4 [bd ~ ~ bd bd ~ ~ ~]!2 [bd ~ bd ~ bd ~ bd ~]!2>"),
    outro: v("bd ~ bd ~ bd ~ bd ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ sd ~ ~ ~ sd ~] [~ ~ sd ~ ~ ~ [sd sd] [sd sd]]>"),
    verse: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ ~ ~ sd [sd sd]]>"),
    chorus: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!7 [~ ~ [sd,cp] ~ sd sd [sd sd] [sd sd]]>"),
    solo: v("~ ~ rim ~ ~ ~ rim ~"),
    bridge: v("<[~ ~ ~ ~ sd ~ ~ ~]!4 [~ ~ sd ~ ~ ~ sd ~]!3 [sd sd sd sd [sd sd] [sd sd] [sd sd] [sd sd]]>"),
    outro: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!7 [~ ~ [sd,cp] ~ ~ ~ [sd sd] [sd sd]]>"),
    end: null,
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh hh oh]*2", V8),
    solo: null,
    bridge: RISING("<[hh*8]!6 [hh*16]!2>"),
    outro: v("[hh oh]*4", V8),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<[cr, [~ ~ tb ~ ~ ~ tb ~]] [~ ~ tb ~ ~ ~ tb ~]!7>"),
    solo: v("<[cr, rd*8] [rd*8]!7>", V8),
    bridge: v("<[cr, [~ ~ tb ~ ~ ~ tb ~]] [~ ~ tb ~ ~ ~ tb ~]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    end: v("cr"),
  },
  bass: {
    intro: INTRO_BASS("{r}@8", "{r}@3 {r} {r}@4"),
    verse: "{r}@3 {r} {r}@4",
    chorus: "{r}@3 {r} {r}@2 {o}@2",
    solo: "{r}@6 {r}@2",
    bridge: BUILD("{r}@4 {r}@4", "{r}@3 {r} {r}@4", "{r}@2 {r}@2 {r}@2 {r}@2"),
    outro: "{r}@2 {o}@2 {r}@2 {o}@2",
    end: "{r}@8",
  },
  comp: {
    intro: "<x x [x ~ x ~ x ~ x ~] [x ~ x ~ x ~ x ~]>",
    verse: "x ~ x ~ x ~ x ~",
    chorus: "x*8",
    solo: "x@6 x@2",
    bridge: "<x x x x [x ~ x ~ x ~ x ~]!2 [x*8]!2>",
    outro: "~ ~ x ~ ~ ~ x ~",
    end: "x",
  },
  chordSound: { bridge: "organ" },
  leadSound: { outro: "trumpet", end: "trumpet" },
};

/** Indie: the rock kit, clean guitar, acoustic lead, muted trumpets. The verses push in 3-3-2, the loud parts drive. */
const INDIE: Kit = {
  bank: "rockkit",
  depth: "plain",
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", horns: "mutetpt" },
  gain: { kick: 0.43, snare: 0.37, hats: 0.24, perc: 0.21, bass: 0.58, chords: 0.4, lead: 0.8, horns: 0.4 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<[bd ~ ~ ~ ~ ~ ~ ~]!2 [bd ~ ~ bd ~ ~ bd ~]!2>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus: v("bd ~ bd ~ bd ~ bd ~"),
    solo: v("bd ~ ~ ~ ~ ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!4 [bd ~ ~ bd ~ ~ bd ~]!2 [bd ~ bd ~ bd ~ bd ~]!2>"),
    outro: v("bd ~ bd ~ bd ~ bd ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ ~ ~ sd ~ ~ ~] [~ ~ ~ ~ sd ~ [sd sd] [sd sd]]>"),
    verse: v("<[~ ~ ~ ~ sd ~ ~ ~]!7 [~ ~ ~ ~ sd ~ [sd sd] [sd sd]]>"),
    chorus: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ sd sd [sd sd] [sd sd]]>"),
    solo: v("~ ~ ~ ~ rim ~ ~ ~"),
    bridge: v("<[~ ~ ~ ~ sd ~ ~ ~]!4 [~ ~ sd ~ ~ ~ sd ~]!3 [sd sd sd sd [sd sd] [sd sd] [sd sd] [sd sd]]>"),
    outro: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ ~ ~ [sd sd] [sd sd]]>"),
    end: null,
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh oh]*4", V8),
    solo: null,
    bridge: RISING("<[hh*8]!6 [hh*16]!2>"),
    outro: v("[hh oh]*4", V8),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<[cr, [~ ~ tb ~ ~ ~ tb ~]] [~ ~ tb ~ ~ ~ tb ~]!7>"),
    // The solo rolls on the floor tom under the guitar's long chords.
    solo: v("<[cr, [lt ~ lt lt ~ lt ~ ~]] [lt ~ lt lt ~ lt ~ ~]!7>"),
    bridge: v("<[cr, [~ ~ tb ~ ~ ~ tb ~]] [~ ~ tb ~ ~ ~ tb ~]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    end: v("cr"),
  },
  bass: {
    intro: INTRO_BASS("{r}@8", "{r}@3 {r}@3 {r}@2"),
    verse: "{r}@3 {r}@3 {r}@2",
    chorus: "[{r} {o}]*4",
    solo: "{r}@8",
    bridge: BUILD("{r}@8", "{r}@3 {r}@3 {r}@2", "[{r} {o}]*4"),
    outro: "[{r} {o}]*4",
    end: "{r}@8",
  },
  comp: {
    intro: "<x x [x@3 x@3 x@2] [x@3 x@3 x@2]>",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    solo: "x",
    bridge: "<x x x x [x@3 x@3 x@2]!2 [x*8]!2>",
    outro: "~ ~ x ~ ~ ~ x ~",
    end: "x",
  },
  chordSound: { bridge: "organ" },
  leadSound: { outro: "trumpet", end: "trumpet" },
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A Rhodes comp on beat 1 and the "and" of 2 (the Charleston), both over the bass's root. */
const JAZZ_COMP = "x ~ ~ x ~ ~ ~ ~";

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, a tenor section. Swung eighths and four-note chords (from
 * U03, FLAVOUR_RULES). Cross-stick and the hi-hat on 2 and 4 in the verses, the snare and the ride in the choruses;
 * the bass plays root and fifth in two and walks root, root, fifth, third in the choruses. The bridge is the organ;
 * the outro goes back to 1925: a jazz guitar on 2 and 4 over a bass on 1 and 3, a trumpet on the tune.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", horns: "tenor" },
  gain: { kick: 0.23, snare: 0.35, hats: 0.22, perc: 0.22, bass: 0.76, chords: 0.43, lead: 0.5, horns: 0.34 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<[bd ~ ~ ~ ~ ~ ~ ~]!2 [bd ~ ~ ~ bd ~ ~ ~]!2>"),
    verse: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ ~ ~ ~ ~ ~"),
    bridge: v("<[bd ~ ~ ~ bd ~ ~ ~]!6 [bd ~ bd ~ bd ~ bd ~]!2>"),
    outro: v("bd ~ bd ~ bd ~ bd ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ rim ~ ~ ~ rim ~] [~ ~ rim ~ ~ ~ [sd sd] [sd sd]]>"),
    verse: v("<[~ ~ rim ~ ~ ~ rim ~]!7 [~ ~ rim ~ ~ ~ [sd sd] [sd sd]]>"),
    chorus: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ ~ sd [sd sd] [sd sd]]>"),
    solo: v("~ ~ rim ~ ~ ~ rim ~"),
    bridge: v("<[~ ~ ~ ~ sd ~ ~ ~]!4 [~ ~ sd ~ ~ ~ sd ~]!3 [sd*8]>"),
    outro: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ ~ ~ [sd sd] [sd sd]]>"),
    end: null,
  },
  // The hi-hat's foot on 2 and 4.
  hats: {
    intro: v("~ ~ hh ~ ~ ~ hh ~"),
    verse: v("~ ~ hh ~ ~ ~ hh ~"),
    chorus: v("~ ~ hh ~ ~ ~ hh ~"),
    solo: v("~ ~ hh ~ ~ ~ hh ~"),
    bridge: v("~ ~ hh ~ ~ ~ hh ~"),
    outro: v("~ ~ hh ~ ~ ~ hh ~"),
    end: null,
  },
  perc: {
    intro: v(`<[${RIDE}] [${RIDE}] [cr, ${RIDE}] [${RIDE}]>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    chorus: v("<[cr, rd*8] [rd*8]!7>", V8),
    solo: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    bridge: v("<[cr, [rd ~ rd ~ rd ~ rd ~]] [rd ~ rd ~ rd ~ rd ~]!3 [cr, rd*8] [rd*8]!3>", V8),
    outro: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    end: v("cr"),
  },
  bass: {
    intro: INTRO_BASS("{r}@8", "{r}@4 {f}@4"),
    verse: "{r}@4 {f}@4",
    chorus: "{r}@2 {r}@2 {f}@2 {t}@2",
    solo: "{r}@4 {f}@4",
    bridge: BUILD("{r}@4 {r}@4", "{r}@4 {r}@4", "{r}@2 {r}@2 {r}@2 {r}@2"),
    // 1925: the bass on 1 and 3, under the guitar's 2 and 4.
    outro: "{r}@4 {r}@4",
    end: "{r}@8",
  },
  comp: {
    intro: `<x x [${JAZZ_COMP}] [${JAZZ_COMP}]>`,
    verse: JAZZ_COMP,
    chorus: JAZZ_COMP,
    solo: "x",
    bridge: "<x x x x x x [x ~ x ~ x ~ x ~]!2>",
    outro: "~ ~ x ~ ~ ~ x ~",
    end: "x",
  },
  chordSound: { bridge: "organ", outro: "jazzgtr" },
  leadSound: { outro: "trumpet", end: "trumpet" },
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
 * Funk: Oak's 808, clavinet, finger bass, organ lead, a trumpet section. Sixteenths, straight, four-note chords (from
 * U06). The bridge is the organ, with a tenor on the tune; the outro's tune is the trumpet.
 */
const FUNK: Kit = {
  bank: "oak808",
  depth: "four",
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", horns: "trumpet" },
  gain: {
    kick: 0.39,
    snare: 0.19,
    hats: 0.11,
    perc: 0.09,
    bass: 0.68,
    chords: 0.46,
    lead: 0.67,
    horns: 0.35,
  },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<[bd ~!15]!2 [${FK_KICK_V}]!2>`),
    verse: v(FK_KICK_V),
    chorus: v(FK_KICK_C),
    solo: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v(`<[bd ~!7 bd ~!7]!4 [${FK_KICK_V}]!2 [bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~]!2>`),
    outro: v("bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(`<~ ~ [${FK_BACKBEAT}] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    solo: v("~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~"),
    bridge: v(`<[~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~]!4 [${FK_BACKBEAT}]!3 [sd*16]>`),
    outro: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    end: null,
  },
  hats: {
    intro: v("hh*16", V16),
    verse: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    solo: v("hh*8", V8),
    bridge: RISING("<[hh*8]!4 [hh*16]!4>"),
    outro: v("[hh hh oh hh]*4", V16),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!7>"),
    solo: v("<cr ~!7>"),
    bridge: v("<cr ~!3 [cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    outro: v("<[cr, [~ cb]*4] [[~ cb]*4]!3 [cr, [~ cb]*4] [[~ cb]*4]!3>"),
    end: v("cr"),
  },
  bass: {
    intro: INTRO_BASS("{r}@16", FK_BASS_V),
    verse: FK_BASS_V,
    chorus: FK_BASS_C,
    solo: "{r}@10 {r}@6",
    bridge: BUILD("{r}@8 {r}@8", FK_BASS_V, "{r}@4 {o}@4 {r}@4 {o}@4"),
    outro: "{r}@4 {o}@4 {r}@4 {o}@4",
    end: "{r}@16",
  },
  comp: {
    intro: `<x x [${FK_CLAV_V}] [${FK_CLAV_V}]>`,
    verse: FK_CLAV_V,
    chorus: FK_CLAV_C,
    solo: "x@10 x@6",
    bridge: `<x x x x [${FK_CLAV_V}]!2 [x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~]!2>`,
    outro: "~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~ ~ ~",
    end: "x",
  },
  chordSound: { bridge: "organ" },
  leadSound: { bridge: "tenor", outro: "trumpet", end: "trumpet" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. Every sixteenth the acid sounds is the root or its
// octave, so each stab and each pad chord has its root under it.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {r}";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The bridge: eighths of the root on the same acid, its filter envelope opening over eight bars. */
const ACID_RISING =
  '.lpq(12).ftype("ladder").lpenv(saw.range(1, 5).slow(8)).lpd(.14).lps(0).decay(.2).sustain(.4)';
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
 * Electronic: the lo-fi kit in the intro, the verses and the solo, Oak's 909 in the choruses, the bridge, the outro
 * and the last bar. The verses sit on a boom-bap beat over a sine sub and off-beat stabs; the choruses go four on the
 * floor with the acid line and pumping stabs; the solo floats on a supersaw pad; the bridge builds (the pad's filter
 * and the acid's envelope open over eight bars, the kick doubles, a snare roll, a last bar with no kick); the outro
 * is the acid and the pump again, with filtered saw brass. A square pluck with a dotted-eighth echo plays the tune.
 * Straight, four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", verse1: "lofikit", solo: "lofikit", verse2: "lofikit" },
  depth: "four",
  swing: "",
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", horns: "sawtooth" },
  gain: { kick: 0.38, snare: 0.16, hats: 0.11, perc: 0.1, bass: 0.69, chords: 0.24, lead: 0.39, horns: 0.27 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<[bd ~ ~ ~ ~ ~ ~ ~]!2 [bd ~ ~ ~ ~ bd ~ ~]!2>"),
    verse: v("bd ~ ~ ~ ~ bd ~ ~"),
    chorus: v("bd ~ bd ~ bd ~ bd ~"),
    solo: v("bd ~ ~ ~ ~ bd ~ ~"),
    bridge: v("<[bd ~ ~ ~ bd ~ ~ ~]!4 [bd ~ bd ~ bd ~ bd ~]!2 bd*8 ~>"),
    outro: v("bd ~ bd ~ bd ~ bd ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ sd ~ ~ ~ sd ~] [~ ~ sd ~ ~ ~ sd [sd sd]]>"),
    verse: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ ~ ~ sd [sd sd]]>"),
    chorus: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!7 [~ ~ [sd,cp] ~ ~ ~ [sd sd] [sd sd]]>"),
    solo: v("~ ~ ~ ~ sd ~ ~ ~"),
    bridge: v("<[~ ~ ~ ~ cp ~ ~ ~]!4 [~ ~ cp ~ ~ ~ cp ~]!2 [sd*8] [sd*16]>"),
    outro: v("<[~ ~ cp ~ ~ ~ cp ~]!7 [~ ~ cp ~ ~ ~ [cp cp] [cp cp]]>"),
    end: null,
  },
  hats: {
    intro: v("~ hh ~ hh ~ hh ~ hh", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh oh hh]*4", V16),
    solo: v("~ hh ~ hh ~ hh ~ hh", V8),
    bridge: RISING("hh*16"),
    outro: v("[hh hh oh hh]*4", V16),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~!7>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!7>"),
    solo: v("<cr ~!7>"),
    bridge: v("<cr ~!5 [~ ~ ~ ~ ~ ~ [lt lt] [ht ht]] ~>"),
    outro: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    end: v("cr"),
  },
  bass: {
    intro: INTRO_BASS("{r}@8", "{r}@5 {r}@3"),
    verse: "{r}@5 {r}@3",
    chorus: ACID_BAR,
    solo: "{r}@5 {r}@3",
    bridge: "{r}*8",
    outro: ACID_BAR,
    end: "{r}@8",
  },
  comp: {
    intro: "<x x [x x x x] [x x x x]>",
    verse: "[~ x]*4",
    chorus: "x*8",
    solo: "x x x x",
    bridge: "<[x x x x]!6 [x*8]!2>",
    outro: "x*8",
    end: "x",
  },
  chordSound: { intro: "supersaw", solo: "supersaw", bridge: "supersaw", end: "supersaw" },
  synth: {
    bassSound: {
      intro: "sine",
      verse: "sine",
      chorus: "sawtooth",
      solo: "sine",
      bridge: "sawtooth",
      outro: "sawtooth",
      end: "sine",
    },
    bass: { intro: SUB, verse: SUB, chorus: ACID, solo: SUB, bridge: ACID_RISING, outro: ACID, end: SUB },
    chords: {
      intro: PAD,
      verse: STAB,
      chorus: `${STAB}${PUMP}`,
      solo: PAD,
      bridge: ".attack(.12).decay(.4).sustain(.7).lpf(saw.range(700, 3500).slow(8))",
      outro: `${STAB}${PUMP}`,
      end: ".attack(.05).decay(1.5).sustain(.6).lpf(2000)",
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.51).delayfeedback(.35)",
    // Filtered saw brass: a short swell that the filter opens and closes.
    horns: ".lpf(1400).lpenv(2).lpd(.2).lps(.4).attack(.02).decay(.3).sustain(.5)",
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
  const out = PROGRESSION[id].map((name, i) => {
    const c = CHORD[name];
    const text = typeof bar === "string" ? bar : bar(i);
    return text.replace(/\{([rfto])\}/g, (_, k: "r" | "f" | "t" | "o") => c[k]);
  });
  return bars(out);
}

/** A section's chords: one bar per chord, voiced by the kit's depth and the section's register. */
function chordLine(id: SectionId, depth: Kit["depth"]): string {
  const high = HIGH.has(SLOT[id]);
  const out = PROGRESSION[id].map((name) => {
    const c = CHORD[name];
    const set = depth === "four" ? (c.four ?? c.plain) : c.plain;
    return high ? (set.high ?? set.low) : set.low;
  });
  return bars(out);
}

/** A section's horn chords, one a bar. */
const hornLine = (id: SectionId): string => bars(PROGRESSION[id].map((name) => CHORD[name].horns));

/** One flavour's song: the tune first, then the horns, the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const tune = melOf(k.swing ? SWING_SAFE : AS_WRITTEN);
  const mel = mapSections((id) => {
    const sound = k.leadSound?.[SLOT[id]] ?? k.sounds.lead;
    return `${tune[id]}.s("${sound}")`;
  });
  const horns = mapSections((id) => {
    const struct = HORNS_STRUCT[SLOT[id]];
    if (struct === null) return null;
    return `note("${hornLine(id)}").struct("${struct}").s("${k.sounds.horns}")${syn ? syn.horns : ""}`;
  });
  const chords = mapSections((id) => {
    const slot = SLOT[id];
    const sound = k.chordSound?.[slot] ?? k.sounds.chords;
    return `note("${chordLine(id, k.depth)}").struct("${k.comp[slot]}").s("${sound}")${syn ? syn.chords[slot] : ""}`;
  });
  const bass = mapSections((id) => {
    const slot = SLOT[id];
    const line = `note("${bassLine(id, k.bass[slot])}")`;
    return syn ? `${line}.s("${syn.bassSound[slot]}")${syn.bass[slot]}` : line;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: BySlot<string | null>): BySection =>
    mapSections((id) => {
      const p = by[SLOT[id]];
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
      mel,
      `${sw}${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track("horns", horns, `${sw}.velocity("${V4}").gain(${num(k.gain.horns)}).pan(.55).room(${num(k.room)})`),
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

/** Every U15 Make writes chords, bass and (but for U15.L04) a tune: a take hands over whole sections. */
const PITCHED: SongPartId[] = ["lead", "chords", "bass"];

export const U15_SONG = defineUnitSong({
  id: "usong.U15",
  unit: "U15",
  version: 1,
  title: "Visitors",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 88,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "horns", label: "horns", role: "chords", name: "Horns", plainName: "Horns" },
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
  // By section (AUTHORING §23.6): every U15 Make writes its chords and bass in one `const changes`, so a take hands
  // over whole sections and Oak keeps the drums there. Every step takes sections no earlier step took, so the song
  // grows with each lesson (U15.L01's four-bar turn is the intro; U15.L02's eight-bar verse, the verses). Every step
  // opens with the lesson's own starter (`'oak'`): the sections are in other chords from one lesson to the next.
  // `oakKeeps: ["horns"]` where Oak's horns rest anyway (intro, verses, solo) keeps the grid's horn cells Oak's; in the
  // choruses Oak's horns play only on the bars U15.L03 leaves as they are; in the bridge Oak keeps its tune and its
  // horns, on notes every push of U15.L04 shares. U15.L05 writes its own horns. No checkpoint, no capstone: the song
  // is released after U15.L06.
  plan: [
    take(
      "U15.L01",
      ["intro"],
      PITCHED,
      "Your soul turn with its bent notes plays the song's intro, the four bars before its first verse.",
      ["horns"],
    ),
    take(
      "U15.L02",
      ["verse1", "verse2"],
      PITCHED,
      "Your eight-bar verse, with chords, bass and tune, plays both verses of the song.",
      ["horns"],
    ),
    take(
      "U15.L03",
      ["chorus1", "chorus2"],
      PITCHED,
      "Your eight bars of chords, bass and tune play both choruses of the song, with Oak's horns.",
      ["horns"],
    ),
    take(
      "U15.L04",
      ["bridge"],
      ["chords", "bass"],
      "Your organ chords and bass play the song's bridge, with Oak's tune and horns on top.",
      ["lead", "horns"],
    ),
    take(
      "U15.L05",
      ["outro"],
      ["lead", "horns", "chords", "bass"],
      "Your 1920s band, horns and all, plays the song's ending, the eight bars before its last chord.",
    ),
    take(
      "U15.L06",
      ["solo"],
      PITCHED,
      "Your staircase of seventh chords plays the song's solo, the eight bars after its first chorus.",
      ["horns"],
    ),
  ],
  releaseAfter: "U15.L06",
});

export default U15_SONG;
