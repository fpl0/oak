// Song 8, "Ground floor" (docs/design/songs/makes-core-b.md §8, "U08 song (bass)"; AUTHORING §23). The bass song.
// C major, 4/4, 96 BPM. Every U08 Make writes a bass under chords in its own code (the grader reads the chords from
// there), so each take hands the learner whole sections: their chords and their bass replace Oak's there, and Oak's
// tune and Oak's pad keep playing on top (`oakKeeps`). U08.L04 writes no chords: it takes the kick and the bass of the
// last two loud parts (and the snare and hats when the learner writes them, as its task asks), over the chords the
// learner already wrote there in U08.L02. Oak's snare and hats play on until the learner's do.
//
// The form, 58 bars (2:25 at 96 BPM). Each section is one chord a bar, so a learner's 4-bar loop restarts on the
// section's first chord and lines up with every bar:
//
//   intro 4 · verse1 8 · chorus1 8 · verse2 8 · chorus2 8 · bridge 8 · stop 1 · chorus3 8 · outro 4 · end 1
//   C G Am F  (C F C G)×2  (C G Am F)×2  (C F C G)×2  (C G Am F)×2  (Am F C G)×2  G  (C G Am F)×2  C G Am F  C
//
// - The opening is a bass intro: the bass and the kick play alone for two bars, then the chords come in.
// - The verse is a soul vamp, I IV I V (U08.L03's loop). Its tune sits low (E4–E5) and leaves beat 4 of every bar
//   empty, so the bass can walk into the next chord there; Oak's bass does, with approach notes on the last eighth.
// - The chorus is I V vi IV (U08.L01, L02, L04): the hook, C5–F5, a syncopated cell (C, C D, then E on the "and" of
//   3) answered on G; the bass plays root, octave, 5th on the kick's rhythm (1, the "and" of 2, 4: the U08.L04 lock);
//   the pad joins; crash, clap and tambourine. The third chorus adds more percussion.
// - The bridge is vi IV I V (U08.L05's loop): four bars with no tune and whole notes, then long tune notes and a
//   build (snare to sixteenths); the one-bar stop hits V and rolls into the last chorus, the tune picking up G A B.
// - The ending is the hook's second half over I V vi IV, then one bar on C (F to C).
//
// Clashes (AUTHORING §13, spec §5.1), checked on the evaluated events at any note length: no tune note, long or
// short, is a half step from a tone of the chord under it (C D E G A over C, G A B D over G, A C D E G over Am,
// F G A C D over F), so the tune clears Oak's chords and pad in every flavour (Cadd9, G7, Am7 and Fadd9 included:
// the tune never plays E over G7) and the learner's plain triads under `oakKeeps`. Oak's bass holds roots, 5ths and
// octaves; its approach notes are an eighth long (pop, indie, electronic), a sixteenth (funk) or a chord tone
// (jazz-soul's walking quarters). Chords are close and low: triads E3–C4 (G3–F4 in the pop and indie loud parts),
// four-note chords D3–G4 (Cadd9 E G C D, G7 D F G B, Am7 E G A C, Fadd9 F A C G), which read as their roots over
// any bass note the song plays under them. The pad holds triads B3–A4 under the tune.
//
// Staging at U08 (contracts §5.10, content/flavours.ts FLAVOUR_RULES): pop and indie triads, straight; jazz-soul
// four-note chords and swung eighths (as its Bands play under these lessons); funk four-note chords and a sixteenth
// feel; electronic four-note chords, straight. One builder writes the five flavours (AUTHORING
// §23.2), so the tune, the bass downbeats and the chord roots cannot drift. Gains stay at or under U01/U02's.
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
  // One bar on V: the band hits beat 1, the drums roll into the last chorus.
  { id: "stop", type: "break", bars: 1 },
  { id: "chorus3", type: "chorus", bars: 8 },
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
 * (`bassVerse`; `bassChorus3` for a chorus that plays something else), `silence` where it rests, and one `arrange()`
 * over every section of the song.
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

// ---- Harmony (every flavour) ----------------------------------------------------------------------------------

type Chord = "C" | "G" | "Am" | "F";
/** One chord a bar; a section of 8 bars plays its 4-bar progression twice. */
const PROG: Readonly<Record<SectionId, readonly Chord[]>> = {
  intro: ["C", "G", "Am", "F"],
  verse1: ["C", "F", "C", "G"],
  chorus1: ["C", "G", "Am", "F"],
  verse2: ["C", "F", "C", "G"],
  chorus2: ["C", "G", "Am", "F"],
  bridge: ["Am", "F", "C", "G"],
  stop: ["G"],
  chorus3: ["C", "G", "Am", "F"],
  outro: ["C", "G", "Am", "F"],
  end: ["C"],
};
/** Close triads, E3–C4, each voice moving a step or two: C E3 G3 C4, G D3 G3 B3, Am E3 A3 C4, F F3 A3 C4. */
const TRIADS: Readonly<Record<Chord, string>> = {
  C: "[e3,g3,c4]",
  G: "[d3,g3,b3]",
  Am: "[e3,a3,c4]",
  F: "[f3,a3,c4]",
};
/** The loud parts' triads, a few notes higher (G3–F4), still under the hook. */
const TRIADS_HIGH: Readonly<Record<Chord, string>> = {
  C: "[g3,c4,e4]",
  G: "[g3,b3,d4]",
  Am: "[a3,c4,e4]",
  F: "[a3,c4,f4]",
};
/**
 * Four-note chords (jazz-soul, funk, electronic at U08): the added 9th on I and IV (Cadd9 E G C D, Fadd9 F A C G),
 * G7 (D F G B) and Am7 (E G A C). Not C6 and F6, the Bands' colours: over a walking bass on the 3rd or the 5th a sixth
 * chord turns into the relative minor seventh (C6 over E is Am7), and a major 7th would sit a half step under the
 * tune's C and F. The added 9th keeps I and IV themselves over any chord tone in the bass.
 */
const FOURS: Readonly<Record<Chord, string>> = {
  C: "[e3,g3,c4,d4]",
  G: "[d3,f3,g3,b3]",
  Am: "[e3,g3,a3,c4]",
  F: "[f3,a3,c4,g4]",
};
/** The pad: the same triads, C4–A4, held under the tune. */
const PAD_NOTES: Readonly<Record<Chord, string>> = {
  C: "[c4,e4,g4]",
  G: "[b3,d4,g4]",
  Am: "[c4,e4,a4]",
  F: "[c4,f4,a4]",
};
const prog = (id: SectionId, voicing: Readonly<Record<Chord, string>>): string => {
  const p = PROG[id];
  return p.length === 1 ? (voicing[p[0] as Chord] as string) : `<${p.map((c) => voicing[c]).join(" ")}>`;
};

// ---- The tune (every flavour) -----------------------------------------------------------------------------------
//
// Note names, eight eighths to a bar. The verse runs up the chord in eighths and rests on beat 4; the chorus is the
// hook; the bridge holds long notes in its second half; the stop picks up into the last chorus; the ending plays
// the hook's second half and lands on C.

const bars = (...b: string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;
const VERSE_TUNE = bars(
  "e4 g4 a4 g4 e4@2 ~@2",
  "f4 a4 c5 a4 f4@2 ~@2",
  "e4 g4 a4 c5 a4@2 ~@2",
  "d5@2 b4 a4 g4@2 ~@2",
  "e4 g4 a4 g4 e4@2 ~@2",
  "f4 a4 c5 a4 f4@2 ~@2",
  "g4 a4 c5 d5 e5@2 ~@2",
  "b4@2 a4 b4 d5@2 ~@2",
);
const HOOK_A = ["c5@2 c5 d5 ~ e5@3", "d5@2 b4 g4 ~ g4@3", "c5@2 c5 d5 ~ e5@3", "f5@2 d5 c5 ~ c5@3"];
const HOOK_B = ["c5@2 c5 d5 ~ e5@3", "d5@2 b4 g4 ~ g4 a4 b4", "c5@2 d5 e5 ~ d5@2 c5", "a4@6 ~@2"];
const CHORUS_TUNE = bars(...HOOK_A, ...HOOK_B);
const BRIDGE_TUNE = bars("~", "~", "~", "~", "e5@4 c5@4", "d5@4 f5@4", "e5@4 d5@2 c5@2", "b4@4 d5@4");

const MEL: BySection = {
  intro: null,
  verse1: `note("${VERSE_TUNE}")`,
  chorus1: `note("${CHORUS_TUNE}")`,
  verse2: `note("${VERSE_TUNE}")`,
  chorus2: `note("${CHORUS_TUNE}")`,
  bridge: `note("${BRIDGE_TUNE}").velocity(.55)`,
  stop: `note("~@5 g4 a4 b4")`,
  chorus3: `note("${CHORUS_TUNE}")`,
  outro: `note("${bars(...HOOK_B)}")`,
  end: `note("c5")`,
};

// ---- The bass (every flavour: the chord's root on every downbeat) ---------------------------------------------------

/**
 * Each chord's root, 5th and octave, low (C2, G1, A1, F1); `w`, its 5th on the side of the next roots (G1 under C,
 * so the line stays near F1 and G1); and `up`, the eighth that leads into it from a half step below.
 */
const B: Readonly<Record<Chord, { r: string; f: string; o: string; w: string; up: string }>> = {
  C: { r: "c2", f: "g2", o: "c3", w: "g1", up: "b1" },
  G: { r: "g1", f: "d2", o: "g2", w: "d2", up: "f#1" },
  Am: { r: "a1", f: "e2", o: "a2", w: "e2", up: "g#1" },
  F: { r: "f1", f: "c2", o: "f2", w: "c2", up: "e1" },
};
/** A bass bar per chord of a section, `cell(chord, next chord)`; the last bar of the progression leads to its first. */
const perBar = (id: SectionId, cell: (c: Chord, next: Chord) => string): string => {
  const p = PROG[id];
  const cells = p.map((c, i) => `[${cell(c, p[(i + 1) % p.length] as Chord)}]`);
  return cells.length === 1 ? (cells[0] as string) : `<${cells.join(" ")}>`;
};
/** The lock (U08.L04's rhythm): root on 1, octave on the "and" of 2, 5th on 4. */
const LOCK = (c: Chord) => `${B[c].r}@3 ${B[c].o}@3 ${B[c].f}@2`;
/** Root on 1 and the "and" of 2, the 5th on 3, then a half step up into the next root on the last eighth. */
const WALK_UP = (c: Chord, next: Chord) => `${B[c].r}@3 ${B[c].r} ${B[c].w}@3 ${B[next].up}`;

// ---- The kits ---------------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the opening, the verses and the bridge). */
  banks?: Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; lead: string; pad: string };
  /** Four-note chords (jazz-soul, funk, electronic at U08) or triads. */
  fours: boolean;
  /** `.swingBy(…)` on every track (jazz-soul from U03), or "". */
  swing: string;
  gain: Readonly<Record<"kick" | "snare" | "hats" | "perc" | "bass" | "chords" | "lead" | "pad", number>>;
  /** content/flavours.ts production: the room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: BySection;
  snare: BySection;
  hats: BySection;
  perc: BySection;
  /** Bass notes; the downbeat of every bar is the chord's root in every kit. */
  bass: BySection;
  /** The chords' rhythm (`struct`) in each section; `chordSound` changes their sound in a section. */
  comp: Readonly<Record<SectionId, string>>;
  chordSound?: Partial<Record<SectionId, string>>;
  /** The pad's rhythm where it plays (chorus, bridge, ending). */
  padComp: string;
  /** The lead's own sound controls (envelope, echo), after its `.s()`. */
  leadFx?: string;
  padFx?: string;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump. */
  synth?: {
    bassSound: Readonly<Record<SectionId, string>>;
    bass: Readonly<Record<SectionId, string>>;
    chords: Readonly<Record<SectionId, string>>;
  };
}

/** Where the pad plays: the loud parts, the quiet part and the ending. */
const PAD_SECTIONS: readonly SectionId[] = ["chorus1", "chorus2", "bridge", "chorus3", "outro", "end"];

// Grooves several kits share.
const BRIDGE_SNARE = "<[~ ~ rim ~]!4 [~ ~ sd ~]!2 [sd*8] [sd*16]>";
const BRIDGE_HATS = "<~!4 [hh*8]!2 [hh*16]!2>";
const STOP_ROLL = "~ ~ [sd sd] [sd sd sd sd]";
const INTRO_SNARE = "<~ ~ [~ sd ~ sd] [~ sd ~ [sd sd]]>";
const VERSE_SNARE = "<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>";
const CHORUS_SNARE = "<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>";
const OUTRO_SNARE = "<[~ [sd,cp] ~ [sd,cp]]!3 ~>";
/** The bridge bass: whole notes under the first four bars, then root and 5th, then driving eighths into the stop. */
const BRIDGE_BASS = "<a1 f1 c2 g1 [a1@4 e2@4] [f1@4 c2@4] [c2*8] [g1*8]>";
const OUTRO_LOCK = `<[${LOCK("C")}] [${LOCK("G")}] [${LOCK("Am")}] f1>`;

/** Pop: the default kit, piano chords, picked bass, piano tune, a string pad in the loud parts. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", pad: "strings" },
  fours: false,
  swing: "",
  gain: { kick: 0.7, snare: 0.6, hats: 0.4, perc: 0.35, bass: 0.8, chords: 0.38, lead: 0.5, pad: 0.22 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("bd ~ ~ bd ~ ~ bd ~"),
    verse1: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus1: v("bd ~ ~ bd ~ ~ bd ~"),
    verse2: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus2: v("bd ~ ~ bd ~ ~ bd ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!4 [bd ~ ~ ~ bd ~ ~ ~]!2 [bd ~ bd ~ bd ~ bd ~] [bd*8]>"),
    stop: v("bd ~ ~ ~"),
    chorus3: v("bd ~ ~ bd ~ ~ bd ~"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
    end: v("bd"),
  },
  snare: {
    intro: v(INTRO_SNARE),
    verse1: v(VERSE_SNARE),
    chorus1: v(CHORUS_SNARE),
    verse2: v(VERSE_SNARE),
    chorus2: v(CHORUS_SNARE),
    bridge: v(BRIDGE_SNARE),
    stop: v(STOP_ROLL),
    chorus3: v(CHORUS_SNARE),
    outro: v(OUTRO_SNARE),
    end: null,
  },
  hats: {
    intro: v("hh*8", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh hh oh]*2", V8),
    verse2: v("hh*8", V8),
    chorus2: v("[hh hh hh oh]*2", V8),
    bridge: v(BRIDGE_HATS),
    stop: null,
    chorus3: v("[hh hh hh oh]*2", V8),
    outro: v("<[hh hh hh oh hh hh hh oh]!3 ~>", V8),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    chorus2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    bridge: v("<[cr, rd*4] [rd*4]!3 [rd*8]!3 ~>"),
    stop: v("cr ~ ~ ~"),
    chorus3: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!2 ~>"),
    end: v("cr"),
  },
  bass: {
    intro: perBar("intro", LOCK),
    verse1: perBar("verse1", WALK_UP),
    chorus1: perBar("chorus1", LOCK),
    verse2: perBar("verse2", WALK_UP),
    chorus2: perBar("chorus2", LOCK),
    bridge: BRIDGE_BASS,
    stop: "g1 ~ ~ ~",
    chorus3: perBar("chorus3", LOCK),
    outro: OUTRO_LOCK,
    end: "c2",
  },
  comp: {
    intro: "<~ ~ [x x x x] [x x x x]>",
    verse1: "x x x ~",
    chorus1: "x*8",
    verse2: "x x x ~",
    chorus2: "x*8",
    bridge: "<x!4 [x ~ x ~]!2 [x*8]!2>",
    stop: "x",
    chorus3: "x*8",
    outro: "<[x*8]!3 x>",
    end: "x",
  },
  padComp: "x",
};

/** Indie: the rock kit, clean guitar strums, an acoustic tune, an organ pad; four on the floor in the loud parts. */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", pad: "organ" },
  fours: false,
  swing: "",
  gain: { kick: 0.7, snare: 0.6, hats: 0.4, perc: 0.35, bass: 0.8, chords: 0.38, lead: 0.5, pad: 0.18 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<[bd ~ ~ ~ bd ~ ~ ~]!2 [bd ~ ~ bd ~ ~ bd ~]!2>"),
    verse1: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus2: v("bd*4"),
    bridge: v("<[bd ~ ~ ~]!4 [bd ~ bd ~]!2 [bd*4]!2>"),
    stop: v("bd ~ ~ ~"),
    chorus3: v("bd*4"),
    outro: v("<[bd*4]!3 bd>"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ sd ~] [~ ~ sd [sd sd]]>"),
    verse1: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<~!4 [~ ~ sd ~]!2 [sd*8] [sd*16]>"),
    stop: v(STOP_ROLL),
    chorus3: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!3 ~>"),
    end: null,
  },
  hats: {
    intro: v("hh*8", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh oh]*4", V8),
    verse2: v("hh*8", V8),
    chorus2: v("[hh oh]*4", V8),
    bridge: v(BRIDGE_HATS),
    stop: null,
    chorus3: v("[hh oh]*4", V8),
    outro: v("<[hh oh hh oh hh oh hh oh]!3 ~>", V8),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, tb*4] [tb*4]!3 [cr, tb*4] [tb*4]!3>"),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    chorus2: v("<[cr, tb*4] [tb*4]!3 [cr, tb*4] [tb*4]!3>"),
    bridge: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3 [sh*8]!3 ~>"),
    stop: v("cr ~ ~ ~"),
    chorus3: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<[cr, tb*4] [tb*4]!2 ~>"),
    end: v("cr"),
  },
  bass: {
    intro: perBar("intro", (c) => `${B[c].r}*8`),
    // The 3-3-2 of the verse kick, then the last eighth leads into the next root.
    verse1: perBar("verse1", (c, n) => `${B[c].r}@3 ${B[c].r}@3 ${B[c].w} ${B[n].up}`),
    // The octave bounce under four on the floor.
    chorus1: perBar("chorus1", (c) => `[${B[c].r} ${B[c].o}]*4`),
    verse2: perBar("verse2", (c, n) => `${B[c].r}@3 ${B[c].r}@3 ${B[c].w} ${B[n].up}`),
    chorus2: perBar("chorus2", (c) => `[${B[c].r} ${B[c].o}]*4`),
    bridge: "<a1 f1 c2 g1 [a1*4] [f1*4] [c2*8] [g1*8]>",
    stop: "g1 ~ ~ ~",
    chorus3: perBar("chorus3", (c) => `[${B[c].r} ${B[c].o}]*4`),
    outro: "<[c2 c3]*4 [g1 g2]*4 [a1 a2]*4 f1>",
    end: "c2",
  },
  comp: {
    intro: "<~ ~ [x ~ x x ~ x x ~] [x ~ x x ~ x x ~]>",
    verse1: "x ~ ~ x ~ ~ x ~",
    chorus1: "x*8",
    verse2: "x ~ ~ x ~ ~ x ~",
    chorus2: "x*8",
    bridge: "<x!4 [x x x x]!2 [x*8]!2>",
    stop: "x",
    chorus3: "x*8",
    outro: "<[x*8]!3 x>",
    end: "x",
  },
  padComp: "x",
};

/** The ride's spang-a-lang: 1, 2 and its "and", 3, 4 and its "and" (swung). */
const RIDE = "[rd ~ rd rd rd ~ rd rd]";
/**
 * Walking quarters: beat 4 is a chord tone a step from the next root (a quarter held a beat never rubs). Under Am7
 * the walk skips C, so the Rhodes on the "and" of 2 never stands on C (Am7 over C is C6).
 */
const JAZZ_VERSE = "<[c2 e2 g2 e2] [f2 a2 f2 d2] [c2 e2 g2 a2] [g2 f2 d2 b1]>";
const JAZZ_CHORUS = "<[c2 e2 g2 a2] [g2 f2 d2 b1] [a1 e2 a2 g2] [f2 a2 f2 d2]>";

/** Jazz-soul: the jazz kit with a ride, upright walking, Rhodes in four-note chords, vibes, strings; swung eighths. */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", pad: "strings" },
  fours: true,
  swing: ".swingBy(1/3, 4)",
  gain: { kick: 0.6, snare: 0.55, hats: 0.4, perc: 0.4, bass: 0.8, chords: 0.42, lead: 0.5, pad: 0.2 },
  room: 0.3,
  lpf: 800,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<[bd ~ ~ ~ bd ~ ~ ~]!2 [bd ~ ~ bd ~ ~ ~ ~]!2>"),
    verse1: v("bd ~ ~ bd ~ ~ ~ ~"),
    chorus1: v("bd ~ ~ bd ~ ~ bd ~"),
    verse2: v("bd ~ ~ bd ~ ~ ~ ~"),
    chorus2: v("bd ~ ~ bd ~ ~ bd ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~]!4 [bd ~ ~ ~ bd ~ ~ ~]!2 [bd ~ bd ~ bd ~ bd ~]!2>"),
    stop: v("bd ~ ~ ~"),
    chorus3: v("bd ~ ~ bd ~ ~ bd ~"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ rim ~ rim] [~ rim ~ [rim rim]]>"),
    verse1: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!4 [~ rim ~ rim]!2 [~ sd ~ sd] [sd*8]>"),
    stop: v(STOP_ROLL),
    chorus3: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!3 ~>"),
    end: null,
  },
  hats: {
    intro: v("~ hh ~ hh"),
    verse1: v("~ hh ~ hh"),
    chorus1: v("~ hh ~ hh"),
    verse2: v("~ hh ~ hh"),
    chorus2: v("~ hh ~ hh"),
    bridge: v("<~!4 [~ hh ~ hh]!4>"),
    stop: null,
    chorus3: v("~ hh ~ hh"),
    outro: v("<[~ hh ~ hh]!3 ~>"),
    end: null,
  },
  perc: {
    intro: v(`<${RIDE} ${RIDE} [cr, ${RIDE}] ${RIDE}>`, V8),
    verse1: v(`<[cr, ${RIDE}] ${RIDE}!7>`, V8),
    chorus1: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    verse2: v(`<[cr, ${RIDE}] ${RIDE}!7>`, V8),
    chorus2: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    bridge: v(`<[cr, rd*4] [rd*4]!3 ${RIDE}!4>`),
    stop: v("cr ~ ~ ~"),
    chorus3: v("<[cr, rd*8, ~ tb ~ tb] [rd*8, ~ tb ~ tb]!3 [cr, rd*8, ~ tb ~ tb] [rd*8, ~ tb ~ tb]!3>", V8),
    outro: v("<[cr, rd*8] [rd*8]!2 ~>", V8),
    end: v("cr"),
  },
  bass: {
    // Root and 5th in half notes, then walking quarters.
    intro: perBar("intro", (c) => `${B[c].r}@2 ${B[c].f}@2`),
    verse1: JAZZ_VERSE,
    chorus1: JAZZ_CHORUS,
    verse2: JAZZ_VERSE,
    chorus2: JAZZ_CHORUS,
    bridge:
      "<[a1@2 e2@2] [f1@2 c2@2] [c2@2 g2@2] [g1@2 d2@2] [a1 e2 a2 g2] [f2 a2 f2 d2] [c2 e2 g2 a2] [g2 d2 b1 d2]>",
    stop: "g1 ~ ~ ~",
    chorus3: JAZZ_CHORUS,
    outro: "<[c2 e2 g2 a2] [g2 f2 d2 b1] [a1 e2 a2 g2] [f2 a2 f2 d2]>",
    end: "c2",
  },
  comp: {
    intro: "<~ ~ [x ~ ~ x ~ ~ ~ ~] [x ~ ~ x ~ ~ ~ ~]>",
    verse1: "x ~ ~ x ~ ~ ~ ~",
    chorus1: "x ~ ~ x ~ x ~ ~",
    verse2: "x ~ ~ x ~ ~ ~ ~",
    chorus2: "x ~ ~ x ~ x ~ ~",
    bridge: "<x!4 [x ~ ~ x ~ ~ ~ ~]!4>",
    stop: "x",
    chorus3: "x ~ ~ x ~ x ~ ~",
    outro: "<[x ~ ~ x ~ x ~ ~]!3 x>",
    end: "x",
  },
  padComp: "x",
};

/** Funk sixteenths: kick and bass share 1, the last sixteenth of 1, the "and" of 2 and the "and" of 3. */
const FUNK_LOCK = (c: Chord) =>
  `${B[c].r} ~ ~ ${B[c].r} ~ ~ ${B[c].o} ~ ~ ~ ${B[c].r} ~ ${B[c].f} ~ ${B[c].o} ~`;
const FUNK_VERSE = (c: Chord, n: Chord) =>
  `${B[c].r} ~ ~ ${B[c].r} ~ ~ ${B[c].w} ~ ~ ~ ${B[c].r} ~ ~ ~ ${B[n].up} ~`;

/** Funk: Oak's 808, finger bass on sixteenths, clav in four-note chords, a tenor tune, an organ pad. */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "tenor", pad: "organ" },
  fours: true,
  swing: "",
  gain: { kick: 0.7, snare: 0.6, hats: 0.38, perc: 0.35, bass: 0.8, chords: 0.36, lead: 0.45, pad: 0.18 },
  room: 0.2,
  lpf: 900,
  chordsPan: 0.36,
  leadPan: 0.64,
  kick: {
    intro: v("<[bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~]!2 [bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~]!2>"),
    verse1: v("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus1: v("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    verse2: v("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus2: v("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v(
      "<[bd ~ ~ ~]!4 [bd ~ ~ bd ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~]!2 [bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~]!2>",
    ),
    stop: v("bd ~ ~ ~"),
    chorus3: v("bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ bd ~ ~ ~"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~]!3 bd>"),
    end: v("bd"),
  },
  snare: {
    intro: v(INTRO_SNARE),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd sd sd]]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd sd sd]]>"),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!4 [~ sd ~ sd]!2 [sd*8] [sd*16]>"),
    stop: v(STOP_ROLL),
    chorus3: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd sd sd]]>"),
    outro: v(OUTRO_SNARE),
    end: null,
  },
  hats: {
    intro: v("hh*16", V16),
    verse1: v("hh*16", V16),
    chorus1: v("[hh hh oh hh]*4", V16),
    verse2: v("hh*16", V16),
    chorus2: v("[hh hh oh hh]*4", V16),
    bridge: v("<~!4 [hh*16]!4>", V16),
    stop: null,
    chorus3: v("[hh hh oh hh]*4", V16),
    outro: v("<[hh*16]!3 ~>", V16),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v("<[cr, sh*8] [sh*8]!3 [cr, sh*8] [sh*8]!3>", V8),
    verse2: v("<[cr, sh*8] [sh*8]!7>", V8),
    chorus2: v("<[cr, sh*8] [sh*8]!3 [cr, sh*8] [sh*8]!3>", V8),
    bridge: v("<cr ~!3 [sh*8]!4>"),
    stop: v("cr ~ ~ ~"),
    chorus3: v("<[cr, sh*8, [~ cb]*2] [sh*8, [~ cb]*2]!3 [cr, sh*8, [~ cb]*2] [sh*8, [~ cb]*2]!3>"),
    outro: v("<[cr, sh*8] [sh*8]!2 ~>", V8),
    end: v("cr"),
  },
  bass: {
    intro: perBar("intro", FUNK_LOCK),
    verse1: perBar("verse1", FUNK_VERSE),
    chorus1: perBar("chorus1", FUNK_LOCK),
    verse2: perBar("verse2", FUNK_VERSE),
    chorus2: perBar("chorus2", FUNK_LOCK),
    bridge: `<a1 f1 c2 g1 [a1@8 e2@8] [f1@8 c2@8] [${FUNK_LOCK("C")}] [${FUNK_LOCK("G")}]>`,
    stop: "g1 ~ ~ ~",
    chorus3: perBar("chorus3", FUNK_LOCK),
    outro: `<[${FUNK_LOCK("C")}] [${FUNK_LOCK("G")}] [${FUNK_LOCK("Am")}] f1>`,
    end: "c2",
  },
  comp: {
    intro: "<~ ~ [~ ~ x ~ ~ x ~ ~ ~ ~ x ~ ~ x ~ ~] [~ ~ x ~ ~ x ~ ~ ~ ~ x ~ ~ x ~ ~]>",
    verse1: "~ ~ x ~ ~ x ~ ~ ~ ~ x ~ ~ x ~ ~",
    chorus1: "~ x ~ x ~ ~ x ~ ~ x ~ x ~ ~ x ~",
    verse2: "~ ~ x ~ ~ x ~ ~ ~ ~ x ~ ~ x ~ ~",
    chorus2: "~ x ~ x ~ ~ x ~ ~ x ~ x ~ ~ x ~",
    bridge: "<x!4 [~ ~ x ~ ~ x ~ ~ ~ ~ x ~ ~ x ~ ~]!4>",
    stop: "x",
    chorus3: "~ x ~ x ~ ~ x ~ ~ x ~ x ~ ~ x ~",
    outro: "<[~ x ~ x ~ ~ x ~ ~ x ~ x ~ ~ x ~]!3 x>",
    end: "x",
  },
  padComp: "x",
};

/** The acid line: the bar's root on sixteenths with gaps and two octave jumps (the acid is in the filter). */
const ACID_CELL = (c: Chord) =>
  `${B[c].r} ~ ${B[c].r} ${B[c].o} ${B[c].r} ~ ${B[c].r} ~ ${B[c].r} ~ ${B[c].o} ${B[c].r} ${B[c].r} ~ ~ ${B[c].r}`;
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
const SUB = ".decay(1.2).sustain(.7)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/** A supersaw struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
const SWELL = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8))";

/**
 * Electronic: Oak's 909-style machine in the loud parts, the lo-fi kit in the opening, the verses and the bridge;
 * a sine sub where it is soft and an acid sawtooth where it is loud; off-beat sawtooth stabs, pumped in the loud parts;
 * a supersaw pad that swells after every kick; a square pluck with a dotted-eighth echo for the tune.
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", verse1: "lofikit", verse2: "lofikit", bridge: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", pad: "supersaw" },
  fours: true,
  swing: "",
  gain: { kick: 0.6, snare: 0.5, hats: 0.35, perc: 0.3, bass: 0.5, chords: 0.26, lead: 0.4, pad: 0.16 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  leadFx: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.47).delayfeedback(.35)",
  padFx: `.unison(5).detune(.2)${SWELL}`,
  kick: {
    // The lo-fi kick lands with the sub: on 1, the "and" of 2 and 4 in the opening, on 1, the "and" of 2 and 3
    // in the verses, with a ghost on the last sixteenth of 3.
    intro: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ bd ~ ~ ~"),
    verse1: v("bd ~ ~ ~ ~ ~ bd ~ bd ~ ~ bd ~ ~ ~ ~", "1 .8 .8 .8 .8 .8 .9 .8 .95 .8 .8 .6 .8 .8 .8 .8"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ ~ bd ~ bd ~ ~ bd ~ ~ ~ ~", "1 .8 .8 .8 .8 .8 .9 .8 .95 .8 .8 .6 .8 .8 .8 .8"),
    chorus2: v("bd*4"),
    bridge: v("<[bd ~ ~ ~]!4 [bd ~ bd ~]!2 [bd*4]!2>"),
    stop: v("bd ~ ~ ~"),
    chorus3: v("bd*4"),
    outro: v("<[bd*4]!3 bd>"),
    end: v("bd"),
  },
  snare: {
    intro: v(INTRO_SNARE),
    verse1: v(VERSE_SNARE),
    chorus1: v("<[~ cp ~ cp]!7 [~ cp [~ cp] [cp cp cp cp]]>"),
    verse2: v(VERSE_SNARE),
    chorus2: v("<[~ cp ~ cp]!7 [~ cp [~ cp] [cp cp cp cp]]>"),
    bridge: v("<~!4 [~ ~ sd ~]!2 [sd*8] [sd*16]>"),
    stop: v("~ ~ [cp cp] [cp cp cp cp]"),
    chorus3: v("<[~ cp ~ cp]!7 [~ cp [~ cp] [cp cp cp cp]]>"),
    outro: v("<[~ cp ~ cp]!3 ~>"),
    end: null,
  },
  hats: {
    intro: v("hh*8", V8),
    verse1: v("hh*8", V8),
    chorus1: v("[hh hh oh hh]*4", V16),
    verse2: v("hh*8", V8),
    chorus2: v("[hh hh oh hh]*4", V16),
    bridge: v(BRIDGE_HATS),
    stop: null,
    chorus3: v("[hh hh oh hh]*4", V16),
    outro: v("<[hh hh oh hh hh hh oh hh hh hh oh hh hh hh oh hh]!3 ~>", V16),
    end: null,
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse1: v("<cr ~!7>"),
    chorus1: v("<cr ~!3 cr ~!3>"),
    verse2: v("<[cr, sh*8] [sh*8]!7>", V8),
    chorus2: v("<cr ~!3 cr ~!3>"),
    bridge: v("<cr ~!3 [sh*8]!4>"),
    stop: v("cr ~ ~ ~"),
    chorus3: v("<[cr, [~ rd]*4] [[~ rd]*4]!3 [cr, [~ rd]*4] [[~ rd]*4]!3>"),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: perBar("intro", LOCK),
    verse1: perBar("verse1", WALK_UP),
    chorus1: perBar("chorus1", ACID_CELL),
    verse2: perBar("verse2", WALK_UP),
    chorus2: perBar("chorus2", ACID_CELL),
    bridge: `<a1 f1 c2 g1 [a1@4 e2@4] [f1@4 c2@4] [${ACID_CELL("C")}] [${ACID_CELL("G")}]>`,
    stop: "g1 ~ ~ ~",
    chorus3: perBar("chorus3", ACID_CELL),
    outro: `<[${ACID_CELL("C")}] [${ACID_CELL("G")}] [${ACID_CELL("Am")}] f1>`,
    end: "c2",
  },
  comp: {
    intro: "<~ ~ [x x x x] [x x x x]>",
    verse1: "~ x ~ x ~ x ~ ~",
    chorus1: "x*8",
    verse2: "~ x ~ x ~ x ~ ~",
    chorus2: "x*8",
    bridge: "<[~ x ~ x]!4 [~ x ~ x ~ x ~ x]!2 [x*8]!2>",
    stop: "x",
    chorus3: "x*8",
    outro: "<[x*8]!3 x>",
    end: "x",
  },
  chordSound: { intro: "supersaw", end: "supersaw" },
  padComp: "x*4",
  synth: {
    bassSound: {
      intro: "sine",
      verse1: "sine",
      chorus1: "sawtooth",
      verse2: "sine",
      chorus2: "sawtooth",
      bridge: "<sine!6 sawtooth!2>",
      stop: "sawtooth",
      chorus3: "sawtooth",
      outro: "<sawtooth!3 sine>",
      end: "sine",
    },
    bass: {
      intro: SUB,
      verse1: SUB,
      chorus1: ACID,
      verse2: SUB,
      chorus2: ACID,
      // The sub under the long chords, then the acid line opens up for the build.
      bridge:
        '.lpq(12).ftype("ladder").lpenv("<0!6 3!2>").lpd(.14).lps(0).decay("<1.2!6 .2!2>").sustain("<.7!6 .4!2>")',
      stop: ACID,
      chorus3: ACID,
      outro:
        '.lpq(12).ftype("ladder").lpenv("<3!3 0>").lpd(.14).lps(0).decay("<.2!3 1.2>").sustain("<.4!3 .7>")',
      end: SUB,
    },
    chords: {
      intro: `.unison(5).detune(.2)${SWELL}`,
      verse1: STAB,
      chorus1: `${STAB}${PUMP}`,
      verse2: STAB,
      chorus2: `${STAB}${PUMP}`,
      bridge: STAB,
      stop: ".lpf(1800).decay(1.5).sustain(.5)",
      chorus3: `${STAB}${PUMP}`,
      outro: `${STAB}${PUMP}`,
      end: ".lpf(1800).decay(2).sustain(.6)",
    },
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

/** One flavour's song: the tune first, then the pad, the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const sw = k.swing;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    // The loud parts' triads sit higher in pop and indie; four-note chords stay low and in root position.
    const loud = id.startsWith("chorus") || id === "outro";
    const voicing = k.fours ? FOURS : loud ? TRIADS_HIGH : TRIADS;
    const notes = id === "end" ? (k.fours ? FOURS.C : "[c3,e3,g3,c4]") : prog(id, voicing);
    return `note("${notes}").struct("${k.comp[id]}").s("${sound}")${syn?.chords[id] ?? ""}`;
  });
  const pad = mapSections((id) =>
    PAD_SECTIONS.includes(id) ? `note("${prog(id, PAD_NOTES)}").struct("${k.padComp}")` : null,
  );
  const bass = mapSections((id) => {
    const line = k.bass[id];
    if (line === null) return null;
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
      `.s("${k.sounds.lead}")${k.leadFx ?? ""}${sw}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "pad",
      pad,
      `.s("${k.sounds.pad}")${k.padFx ?? ""}${sw}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${sw}.velocity("1 .86 .92 .86").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf})${sw}.gain(${num(k.gain.bass)})`,
    ),
    track("kick", drums(k.kick), `${bank}${sw}.gain(${num(k.gain.kick)})`),
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

export const U08_SONG = defineUnitSong({
  id: "usong.U08",
  unit: "U08",
  version: 1,
  title: "Ground floor",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 96,
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
  // By section (AUTHORING §23.6): every U08 Make but L04 writes the chords and the bass, so a take owns whole sections
  // and Oak keeps its tune and its pad on top (the pad holds the triad's own tones, and no tune note is a half step
  // from a tone of the learner's triads). Every Make opens with its own starter: each starter holds the one thing the lesson fixes
  // (a C under every chord, a 3rd in the cell, no approach notes, no lock, a bass a bar late), and an earlier take's
  // code is in other chords (L03, L05), already meets the rule (L01 into L02), or has no kick (L02 into L04).
  plan: [
    take(
      "U08.L01",
      ["intro", "outro"],
      ["chords", "bass"],
      "Your chords and a bass on their roots play the opening and the ending of the song.",
      ["lead", "pad"],
    ),
    take(
      "U08.L02",
      ["chorus1", "chorus2", "chorus3"],
      ["chords", "bass"],
      "Your bass of roots, 5ths and octaves drives all three loud parts of the song.",
      ["lead", "pad"],
    ),
    take(
      "U08.L03",
      ["verse1", "verse2"],
      ["chords", "bass"],
      "Your bass leans into the chord changes in the second and fourth parts of the song.",
      // The verses have no pad; keeping it leaves the grid's "Held chords" cells there Oak's, as in every other take.
      ["lead", "pad"],
    ),
    take(
      "U08.L04",
      ["chorus2", "chorus3"],
      // Kick and bass only: the snare and the hats are claimed when the learner's code plays them (its task asks for
      // both, its rubric does not), so a passing answer without them leaves Oak's snare and hats in, never a silence.
      ["kick", "bass"],
      "Your kick and bass, sharing one rhythm, drive the last two loud parts of the song.",
    ),
    take(
      "U08.L05",
      ["bridge"],
      ["chords", "bass"],
      "Your bass, in a sound you choose, carries the quiet part before the last loud part.",
      ["lead", "pad"],
    ),
  ],
  // U08 has no checkpoint (U09.CP covers U08 and U09), so the song is released after its last lesson (AUTHORING §23.6).
  releaseAfter: "U08.L05",
});

export default U08_SONG;
