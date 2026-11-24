// Song 5, "Climb the chord" (docs/design/songs/makes-core-a.md §8, U05 "the chord song"; AUTHORING §23). C major,
// 4/4, 88 BPM. U05 is the unit where the learner writes the chords, so the song is planned by section (§23.6): each
// lesson's Make hands the learner the chords of one part of the song, and a take that plays chords silences Oak's
// bass, tune and pad there unless the step keeps them (`oakKeeps`, clash-checked). By the checkpoint every section
// but the last bar plays the learner's chords; the bass of the second part and both loud parts is theirs too.
//
// The form, 53 bars (2:25 at 88 BPM):
//
//   intro 4 · verse1 8 · prechorus 4 · chorus1 8 · verse2 8 · bridge 8 · chorus2 8 · outro 4 · end 1
//   C G Am F  (C G Am F)×2  C C+ F B°  (C G Am F)×2  (C G/B Am F)×2  (C F Am G)×2  (C G Am F)×2  C Am G C  C
//
// Oak's song models each lesson's idea before the learner takes it over, so the song is already that lesson's sound:
// - the opening is the four chords broken into single notes (U05.L04, arpeggios), over a held bass and a soft pad;
// - the second part plays block triads on a bass of roots, 1 5 6 4 (U05.L01), with the tune low (A3–C5);
// - the four bars before the first loud part climb through a restless chord, C to C+ (the tune's G rises to G#, then
//   A) and B° (B, D, F) leaning into the loud part's C (U05.L03);
// - the loud parts are the hook: the tune climbs each chord from its root, root, 3rd, 5th (C E G, G B D, A C E), high
//   (G4–G5), over block chords in eighths and a pad (U05.L07 and L08 take them, voice-led and named);
// - the part after the first loud part keeps the chords and walks the floor down, C, G/B, Am, F: the bass plays
//   C B A F (U05.L05, inversions);
// - the half-time part is a chart, C F Am G, long tune notes, a snare roll in its last bar into the hook (U05.L09);
// - the ending is I vi V I, C Am G C, a minor chord in place of IV (U05.L02), then one bar on C.
//
// Clashes (AUTHORING §13), read from the evaluated events: every tune note, held or passing, over C, G, Am and F is
// a chord tone or a whole step from every chord tone (C D E G A over C and Am, D E F G A B over G, C D F G A over F),
// so the tune clashes with no voicing of those chords: Oak's, the learner's, or Strudel's `.voicing()`. That is what
// lets the steps that keep the learner's roots keep Oak's tune and bass. Over G the tune holds no E (jazz-soul's G7
// has F). Every bass note is a chord tone of its bar: root, 5th or octave (the 3rd over C+ and B°, the B of G/B).
//
// Every flavour plays the same notes (tune, bass downbeats, chord roots); a flavour changes sounds, grooves, comp and
// bass rhythms, and colour where its kit's staging allows it at U05 (contracts §5.10): jazz-soul swings and plays
// C6 G7 Am7 F6 (and Bø7), struck only while the bass sounds the root, so C6 and F6 never read as Am7 and Dm7;
// pop, indie, funk and electronic stay straight and in triads (funk's sevenths start at U06.L01, electronic's at
// U06.L10). Gains are levelled by songs.pw.ts (sound-songs.json).
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
  { id: "prechorus", type: "prechorus", bars: 4 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "bridge", type: "bridge", bars: 8 },
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
const mapSections = (f: (id: SectionId) => string | null): BySection =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, string | null>;
/** One bar per entry, as a `< >` alternation (a single bar is written bare). */
const alt = (bars: readonly string[]): string =>
  bars.length === 1 ? (bars[0] as string) : `<${bars.map((b) => `[${b}]`).join(" ")}>`;

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melVerse`; `melVerse2` for a second verse that plays something else), `silence` where it rests, and one
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

// ---- The harmony (every flavour) -------------------------------------------------------------------------------

type Chord = "C" | "G" | "G/B" | "Am" | "F" | "Caug" | "Bdim";
const AXIS: Chord[] = ["C", "G", "Am", "F"];
const PROG: Readonly<Record<SectionId, readonly Chord[]>> = {
  intro: AXIS,
  verse1: [...AXIS, ...AXIS],
  prechorus: ["C", "Caug", "F", "Bdim"],
  chorus1: [...AXIS, ...AXIS],
  verse2: ["C", "G/B", "Am", "F", "C", "G/B", "Am", "F"],
  bridge: ["C", "F", "Am", "G", "C", "F", "Am", "G"],
  chorus2: [...AXIS, ...AXIS],
  outro: ["C", "Am", "G", "C"],
  end: ["C"],
};

/**
 * Voicings. Low (the two quiet parts): B2–A3, under a tune that reaches down to A3. Mid (everything else): D3–C4,
 * each voice moving a third at most, and B° (D3 F3 B3) stepping up into the loud part's C (E3 G3 C4). Jazz-soul's
 * four-note chords take a 6th on I and IV (a major 7th would sit a half step under a tune on C or F) and a 7th on V
 * and vi.
 */
const TRIADS: Readonly<Record<"low" | "mid", Partial<Record<Chord, string>>>> = {
  low: { C: "c3,e3,g3", G: "b2,d3,g3", "G/B": "b2,d3,g3", Am: "c3,e3,a3", F: "c3,f3,a3" },
  mid: {
    C: "e3,g3,c4",
    G: "d3,g3,b3",
    Am: "e3,a3,c4",
    F: "f3,a3,c4",
    Caug: "e3,g#3,c4",
    Bdim: "d3,f3,b3",
  },
};
const FOURS: Readonly<Record<"low" | "mid", Partial<Record<Chord, string>>>> = {
  low: { C: "c3,e3,g3,a3", G: "b2,d3,f3,g3", "G/B": "b2,d3,f3,g3", Am: "c3,e3,g3,a3", F: "c3,d3,f3,a3" },
  mid: {
    C: "e3,g3,a3,c4",
    G: "d3,f3,g3,b3",
    Am: "e3,g3,a3,c4",
    F: "f3,a3,c4,d4",
    Caug: "e3,g#3,c4",
    Bdim: "d3,f3,a3,b3",
  },
};
const VOICE_SET: Readonly<Record<SectionId, "low" | "mid">> = {
  intro: "mid",
  verse1: "low",
  prechorus: "mid",
  chorus1: "mid",
  verse2: "low",
  bridge: "mid",
  chorus2: "mid",
  outro: "mid",
  end: "mid",
};
/** The last chord, every flavour: C with its octave (jazz-soul: C6, the 6th on top of the octave). */
const LAST = { triad: "c3,e3,g3,c4", four: "c3,g3,c4,e4,a4" };
/** The pad: close triads around middle C, held a bar (the same in every flavour). */
const PAD_NOTES: Readonly<Record<Chord, string>> = {
  C: "g3,c4,e4",
  G: "g3,b3,d4",
  "G/B": "g3,b3,d4",
  Am: "a3,c4,e4",
  F: "a3,c4,f4",
  Caug: "g#3,c4,e4",
  Bdim: "f3,b3,d4",
};
/** The opening's broken chords: four notes of each chord, from the bottom (single notes, never two at once). */
const ARP_NOTES: Readonly<Partial<Record<Chord, readonly string[]>>> = {
  C: ["c4", "e4", "g4", "c5"],
  G: ["b3", "d4", "g4", "b4"],
  Am: ["c4", "e4", "a4", "c5"],
  F: ["c4", "f4", "a4", "c5"],
};

/**
 * The bass's notes in a bar: R its lowest note (the root, or the B of G/B), F the chord's 5th (the 3rd over C+ and
 * the B° bar), O the root an octave away (down from G, A and F, so the bass stays under C3), U the root an octave up
 * (funk's pops, the acid line's jumps). Every one is a chord tone: nothing the bass plays sits a half step from the
 * chord over it.
 */
const BASS_NOTES: Readonly<Record<Chord, { R: string; F: string; O: string; U: string }>> = {
  C: { R: "c2", F: "g2", O: "c3", U: "c3" },
  G: { R: "g2", F: "d2", O: "g1", U: "g3" },
  "G/B": { R: "b1", F: "d2", O: "b2", U: "b2" },
  Am: { R: "a2", F: "e2", O: "a1", U: "a3" },
  F: { R: "f2", F: "c2", O: "f1", U: "f3" },
  Caug: { R: "c2", F: "e2", O: "c3", U: "c3" },
  Bdim: { R: "b1", F: "d2", O: "b2", U: "b2" },
};

/** A section's bars, each written from its chord: `f(chord, bar)` for each bar. */
const perBar = (id: SectionId, f: (c: Chord, i: number) => string): string =>
  alt(PROG[id].map((c, i) => f(c, i)));
/** A bass rhythm in tokens (R F O U, `~`, `@`, `*`), one template per bar (a shorter list repeats). */
const bassLine = (id: SectionId, templates: readonly string[]): string =>
  perBar(id, (c, i) =>
    (templates[i % templates.length] as string).replace(/[RFOU]/g, (t) => BASS_NOTES[c][t as "R"]),
  );
/** The opening's broken chords in an arp rhythm of indices into ARP_NOTES (`0 1 2 3`, `~`, `@`). */
const arpLine = (rhythm: string): string =>
  perBar("intro", (c) => rhythm.replace(/\d/g, (d) => ARP_NOTES[c]?.[Number(d)] ?? "~"));
/**
 * The opening's arp, every flavour: up the chord, then turning around its top (the order of the notes is part of
 * the song, so every kit plays it; a kit changes only the sound).
 */
const ARP = "0 1 2 3 2 1 2 1";

// ---- The tune (every flavour) ----------------------------------------------------------------------------------
//
// Note names, eight slots a bar. The quiet parts: a pickup of three eighths that turns around a note, then a fall
// (E G E D C over C), low, B3 to C5, answered higher in bar 6–7. The climb before the loud part: C5 above a line
// G4 G#4 A4 B4 that rises with the chords into the hook's C5. The hook: each chord climbed from its root, two
// quarters and a held top note (C E G over C, G B D over G, A C E over Am), falling back down F C A over F.

const VERSE = [
  "~ e4 g4 e4 d4@2 c4@2",
  "~ d4 e4 d4 b3@4",
  "~ c4 e4 c4 a3@4",
  "~ c4 d4 f4 a4@2 g4@2",
  "~ e4 g4 e4 d4@2 c4@2",
  "~ d4 e4 g4 b4@4",
  "~ c5 a4 e4 g4@2 a4@2",
  "a4@4 g4@2 ~@2",
];
const CLIMB = ["c5@2 g4@6", "c5@2 g#4@6", "c5@2 a4@6", "d5@2 b4@6"];
const HOOK = [
  "c5@2 e5@2 g5@3 e5",
  "g4@2 b4@2 d5@3 g4",
  "a4@2 c5@2 e5@3 c5",
  "f5@3 c5@3 a4@2",
  "c5@2 e5@2 g5@3 e5",
  "g4@2 b4@2 d5@3 g4",
  "a4@2 c5@2 e5@2 g5@2",
  "f5@2 c5@2 a4@4",
];
const CHART = [
  "g4@4 e4@4",
  "a4@4 f4@4",
  "c5@4 a4@4",
  "b4@4 d5@4",
  "e5@4 c5@4",
  "f5@4 c5@4",
  "e5@4 c5@4",
  "d5@6 ~@2",
];
const COME_HOME = ["c5@2 e5@2 g5@4", "e5@4 c5@4", "d5@4 b4@4", "c5@8"];

const MEL: BySection = {
  intro: null,
  verse1: `note("${alt(VERSE)}")`,
  prechorus: `note("${alt(CLIMB)}")`,
  chorus1: `note("${alt(HOOK)}")`,
  verse2: `note("${alt(VERSE)}")`,
  bridge: `note("${alt(CHART)}").room(.4)`,
  chorus2: `note("${alt(HOOK)}")`,
  outro: `note("${alt(COME_HOME)}").room(.4)`,
  end: null,
};
/** The pad holds a bar of each chord in the opening, the climb, the loud parts, the quiet part and the ending. */
const PAD_SECTIONS: ReadonlySet<SectionId> = new Set([
  "intro",
  "prechorus",
  "chorus1",
  "bridge",
  "chorus2",
  "outro",
]);

// ---- The kits ------------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the quiet parts, the 808 in the chart). */
  banks?: Partial<Record<SectionId, string>>;
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
  /** content/flavours.ts production: the room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  /** Jazz-soul: four-note chords and swung eighths on every track (its staging from U03.L01). */
  jazz?: boolean;
  kick: BySection;
  snare: BySection;
  hats: BySection;
  perc: BySection;
  /** Bass rhythm templates per section (BASS_NOTES tokens); the downbeat of every bar is R in every kit. */
  bass: Readonly<Record<SectionId, readonly string[]>>;
  /** The chords' rhythm (`struct`) per section; the opening plays ARP instead. */
  comp: Readonly<Record<SectionId, string>>;
  /** The pad's rhythm (`struct`) where it is not held a bar. */
  padComp?: Partial<Record<SectionId, string>>;
  /** Synth controls by section (electronic). */
  synth?: {
    bassSound: Readonly<Record<SectionId, string>>;
    bass: Readonly<Record<SectionId, string>>;
    chords: Readonly<Record<SectionId, string>>;
    lead: string;
    pad: string;
  };
}

// Shared grooves: the opening's pickup, the climb's roll, the chart's build, the half-time ending.
const SNARE_PICKUP = "<~ ~ ~ [~ ~ ~ ~ ~ ~ sd sd]>";
const ROLL = "[sd*4 sd*8]";
const CHART_SNARE = `<[~ ~ sd ~]!7 ${ROLL}>`;
const CHART_HATS = "<[~ hh]*4 [~ hh]*4 [~ hh]*4 [~ hh]*4 [hh*8]!4>";
/** The bass in the chart: a bar per note, then a 5th on beat 3, then eighths into the last loud part. */
const CHART_BASS = ["R@8", "R@8", "R@8", "R@8", "R@4 F@4", "R@4 F@4", "R@4 F@4", "R*8"];
/** Jazz-soul's chart: the 5th comes after the half-note chord, so every chord is struck over its root. */
const CHART_BASS_JAZZ = ["R@8", "R@8", "R@8", "R@8", "R@6 F@2", "R@6 F@2", "R@6 F@2", "R*8"];
const WHOLE = ["R@8"];

/** Pop: the default kit, piano, picked bass, piano tune, strings. Cross-stick quiet parts, clap on the loud ones. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", pad: "strings" },
  gain: { kick: 0.21, snare: 0.18, hats: 0.13, perc: 0.12, bass: 0.57, chords: 0.2, lead: 0.57, pad: 0.11 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<~ ~ bd [bd ~ bd ~]>"),
    verse1: v("bd ~ ~ bd ~ ~ ~ ~"),
    prechorus: v("<[bd ~ bd ~]!2 [bd*4]!2>"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    verse2: v("bd ~ ~ bd ~ ~ ~ ~"),
    bridge: v("<bd!4 [bd ~ ~ bd ~ ~ ~ ~]!3 [bd*4]>"),
    chorus2: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    prechorus: v(`<[~ sd ~ sd]!3 ${ROLL}>`),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    bridge: v(CHART_SNARE),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    prechorus: v("<[hh*8]!3 [hh*16]>"),
    chorus1: v("[hh hh hh oh]*2", V8),
    verse2: v("hh*8", V8),
    bridge: v(CHART_HATS),
    chorus2: v("[hh hh hh oh]*2", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    prechorus: v("<~ ~ [~ sh]*4 [sh*8]>"),
    chorus1: v("<[cr, [~ tb]*4] [~ tb]*4 [~ tb]*4 [~ tb]*4 [cr, [~ tb]*4] [~ tb]*4 [~ tb]*4 [~ tb]*4>"),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    bridge: v("<cr ~!3 [rd*4]!4>"),
    chorus2: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: WHOLE,
    verse1: ["R@3 R@3 F@2"],
    prechorus: ["R*8"],
    chorus1: ["R R R R R R O R"],
    verse2: ["R@3 R@3 F@2"],
    bridge: CHART_BASS,
    chorus2: ["R R R R R R O R"],
    outro: WHOLE,
    end: ["R"],
  },
  comp: {
    intro: "",
    verse1: "x ~ ~ x ~ ~ x ~",
    prechorus: "x*8",
    chorus1: "x*8",
    verse2: "x ~ ~ x ~ ~ x ~",
    bridge: "<x!4 [x x]!3 [x*8]>",
    chorus2: "x*8",
    outro: "x",
    end: "x",
  },
};

/** Indie: the rock kit, clean guitar, acoustic tune, organ pad. 3-3-2 quiet parts; four on the floor in the loud ones. */
const INDIE: Kit = {
  bank: "LinnDrum",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", pad: "organ" },
  gain: { kick: 0.39, snare: 0.34, hats: 0.25, perc: 0.22, bass: 0.53, chords: 0.44, lead: 0.93, pad: 0.19 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~]>"),
    verse1: v("bd ~ ~ bd ~ ~ bd ~"),
    prechorus: v("<[bd ~ ~ bd ~ ~ bd ~]!2 [bd*4] [bd*8]>"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ bd ~ ~ bd ~"),
    bridge: v("<bd!4 [bd ~ ~ bd ~ ~ ~ ~]!3 [bd*4]>"),
    chorus2: v("bd*4"),
    outro: v("bd"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    prechorus: v(`<[~ sd ~ sd]!3 ${ROLL}>`),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(CHART_SNARE),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    prechorus: v("<[hh*8]!3 [hh*16]>"),
    chorus1: v("[hh oh]*4", V8),
    verse2: v("hh*8", V8),
    bridge: v(CHART_HATS),
    chorus2: v("[hh oh]*4", V8),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    prechorus: v("<~ ~ tb*4 tb*8>"),
    chorus1: v("<[cr, tb*4] [tb*4]!3 [cr, tb*4] [tb*4]!3>"),
    verse2: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!7>"),
    bridge: v("<cr ~!3 [tb*4]!4>"),
    chorus2: v("<[cr, tb*8] [tb*8]!3 [cr, tb*8] [tb*8]!3>"),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: WHOLE,
    verse1: ["R@3 R@3 R@2"],
    prechorus: ["R*8"],
    chorus1: ["[R O]*4"],
    verse2: ["R@3 R@3 R@2"],
    bridge: CHART_BASS,
    chorus2: ["[R O]*4"],
    outro: WHOLE,
    end: ["R"],
  },
  comp: {
    intro: "",
    verse1: "x ~ ~ x ~ ~ x ~",
    prechorus: "<[x ~ x ~ x ~ x ~]!2 [x*8]!2>",
    chorus1: "x*8",
    verse2: "x ~ ~ x ~ ~ x ~",
    bridge: "<x!4 [x x]!3 [x*8]>",
    chorus2: "x*8",
    outro: "x",
    end: "x",
  },
};

/**
 * Jazz-soul: Oak's brushes kit, Rhodes, upright bass, vibes tune, strings pad; swung eighths and four-note chords
 * (FLAVOUR_RULES: from U03.L01). The Rhodes comps on beat 2 and the "and" of 3, over a bass that holds the root
 * until beat 4, so every chord is struck over its root. Cross-stick and ride in the quiet parts, snare and ride in
 * the loud ones.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", pad: "strings" },
  gain: { kick: 0.22, snare: 0.37, hats: 0.25, perc: 0.25, bass: 0.8, chords: 0.48, lead: 0.52, pad: 0.21 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  jazz: true,
  kick: {
    intro: v("<~ ~ bd [bd ~ ~ bd ~ ~ ~ ~]>"),
    verse1: v("bd ~ ~ bd ~ ~ ~ ~"),
    prechorus: v("<[bd ~ ~ bd ~ ~ ~ ~]!2 [bd ~ bd ~]!2>"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    verse2: v("bd ~ ~ bd ~ ~ ~ ~"),
    bridge: v("<bd!4 [bd ~ ~ bd ~ ~ ~ ~]!3 [bd ~ bd ~]>"),
    chorus2: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    prechorus: v("<[~ rim ~ rim]!2 [~ sd ~ sd] [sd*8]>"),
    chorus1: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    verse2: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!4 [~ ~ sd ~]!3 [sd*8]>"),
    chorus2: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("~ ~ rim ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [~ hh ~ hh] [~ hh ~ hh]>"),
    verse1: v("~ hh ~ hh"),
    prechorus: v("~ hh ~ hh"),
    chorus1: v("~ hh ~ hh"),
    verse2: v("~ hh ~ hh"),
    bridge: v("<[~ ~ ~ hh]!4 [~ hh ~ hh]!4>"),
    chorus2: v("~ hh ~ hh"),
    outro: v("~ hh ~ hh"),
    end: null,
  },
  // The ride carries the time; a shaker joins the second quiet part and the last loud one.
  perc: {
    intro: v("<~ ~ [rd*8] [rd*8]>", V8),
    verse1: v("<[cr, rd*8] [rd*8]!7>", V8),
    prechorus: v("rd*8", V8),
    chorus1: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    verse2: v("<[cr, rd*8, [~ sh]*4] [rd*8, [~ sh]*4]!7>"),
    bridge: v("<rd ~!3 [rd*4]!4>"),
    chorus2: v("<[cr, rd*8, sh*8] [rd*8, sh*8]!3 [cr, rd*8, sh*8] [rd*8, sh*8]!3>"),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: WHOLE,
    verse1: ["R@6 F@2"],
    prechorus: ["R@6 F@2"],
    chorus1: ["R@3 R@3 F@2"],
    verse2: ["R@6 F@2"],
    bridge: CHART_BASS_JAZZ,
    chorus2: ["R@3 R@3 F@2"],
    outro: WHOLE,
    end: ["R"],
  },
  comp: {
    intro: "",
    verse1: "~ ~ x ~ ~ x ~ ~",
    prechorus: "x ~ x ~ ~ x ~ ~",
    chorus1: "x ~ x ~ ~ x ~ ~",
    verse2: "~ ~ x ~ ~ x ~ ~",
    bridge: "<x!4 [x@4 x@2 ~@2]!3 [x x x x ~ ~ ~ ~]>",
    chorus2: "x ~ x ~ ~ x ~ ~",
    outro: "x",
    end: "x",
  },
};

const FUNK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FUNK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FUNK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";
/**
 * Funk: the 808, clavinet, finger bass, organ tune, strings pad. Sixteenths, straight, triads until U06. The kick and
 * the bass lock on 1, the "a" of 1, the "and" of 2 and the "and" of 3; the bass pops an octave up between them.
 */
const FUNK: Kit = {
  bank: "RolandTR808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", pad: "strings" },
  gain: { kick: 0.28, snare: 0.2, hats: 0.13, perc: 0.11, bass: 0.64, chords: 0.59, lead: 0.64, pad: 0.2 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<~ ~ [${FUNK_KICK}]!2>`),
    verse1: v(FUNK_KICK),
    prechorus: v(`<[${FUNK_KICK}]!2 [bd ~ bd ~]!2>`),
    chorus1: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    verse2: v(FUNK_KICK),
    bridge: v("<bd!4 [bd ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~]!3 [bd bd bd bd]>"),
    chorus2: v("bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~"),
    outro: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>"),
    verse1: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    prechorus: v(`<[${FUNK_BACKBEAT}]!3 ${ROLL}>`),
    chorus1: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    verse2: v(`<[${FUNK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    bridge: v(CHART_SNARE),
    chorus2: v(`<[${FUNK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*16] [hh*16]>", V16),
    verse1: v("hh*16", V16),
    prechorus: v("hh*16", V16),
    chorus1: v("[hh hh hh hh hh hh oh hh]*2", V16),
    verse2: v("hh*16", V16),
    bridge: v(CHART_HATS),
    chorus2: v("[hh hh hh hh hh hh oh hh]*2", V16),
    outro: v("hh*8", V8),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    prechorus: v("<~ ~ [~ sh]*4 sh*8>"),
    chorus1: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3 [cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    verse2: v("<[cr, [~ sh]*4] [[~ sh]*4]!7>"),
    bridge: v("<cr ~!3 [sh*8]!4>"),
    chorus2: v("<[cr, [~ cb]*4] [[~ cb]*4]!3 [cr, [~ cb]*4] [[~ cb]*4]!3>"),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: WHOLE,
    verse1: ["R ~ ~ R ~ ~ U ~ ~ ~ R ~ ~ ~ ~ ~"],
    prechorus: ["R*8"],
    chorus1: ["R ~ U R ~ ~ U ~ R ~ R ~ U ~ ~ ~"],
    verse2: ["R ~ ~ R ~ ~ U ~ ~ ~ R ~ ~ ~ ~ ~"],
    bridge: CHART_BASS,
    chorus2: ["R ~ U R ~ ~ U ~ R ~ R ~ U ~ ~ ~"],
    outro: ["R@6 R@10"],
    end: ["R"],
  },
  comp: {
    intro: "",
    verse1: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    prechorus: "<[~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~]!2 [x ~ x ~ x ~ x ~ x ~ x ~ x ~ x ~]!2>",
    chorus1: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    verse2: "~ ~ x ~ ~ ~ x ~ ~ x ~ ~ ~ ~ ~ ~",
    bridge: "<x!4 [x x]!3 [x*8]>",
    chorus2: "x ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~",
    outro: "x ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",
    end: "x",
  },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub in the quiet parts, sawtooth stabs, a supersaw pad, a square pluck with an echo. The
// acid line jumps an octave between the beats; every downbeat is the bar's root, as in every kit.
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The climb: the acid filter opens wider bar by bar into the loud part. */
const ACID_RISE = '.lpq(14).ftype("ladder").lpenv("<1.5 2.5 3.5 5>").lpd(.16).lps(0).decay(.2).sustain(.4)';
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
/** The opening's broken chords: a plucked sawtooth with a dotted-eighth echo. */
const PLUCK =
  ".lpf(2200).lpenv(1.5).lpd(.1).lps(0).decay(.18).sustain(.2).delay(.3).delaytime(.51).delayfeedback(.35)";

/**
 * Electronic: Oak's lo-fi kit in the quiet parts (a broken boom-bap beat over a sine sub and off-beat stabs), the 909
 * for the climb and the loud parts (four on the floor, acid line, pumping stabs and pad), the 808 in half time for the
 * chart (a supersaw pad swelling over the sub, then the acid build), the lo-fi kit again for the ending. A square
 * pluck with an echo plays the tune. Straight and in triads, like every kit but jazz-soul at U05.
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", verse1: "lofikit", verse2: "lofikit", bridge: "oak808", outro: "lofikit" },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", pad: "supersaw" },
  gain: { kick: 0.23, snare: 0.16, hats: 0.11, perc: 0.1, bass: 0.51, chords: 0.33, lead: 0.43, pad: 0.12 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~]!2>"),
    verse1: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    prechorus: v("<[bd*4]!3 [bd*8]>"),
    chorus1: v("bd*4"),
    verse2: v("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~"),
    bridge: v("<bd!4 [bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~]!3 [bd*4]>"),
    chorus2: v("bd*4"),
    outro: v("bd ~ ~ ~"),
    end: v("bd"),
  },
  snare: {
    intro: v(SNARE_PICKUP),
    verse1: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    prechorus: v("<[~ cp ~ cp]!3 [cp*4 cp*8]>"),
    chorus1: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    verse2: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v(CHART_SNARE),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    outro: v("~ ~ sd ~"),
    end: null,
  },
  hats: {
    intro: v("<~ ~ [hh*8] [hh*8]>", V8),
    verse1: v("hh*8", V8),
    prechorus: v("[hh hh oh hh]*4", V16),
    chorus1: v("[hh hh oh hh]*4", V16),
    verse2: v("hh*8", V8),
    bridge: v(CHART_HATS),
    chorus2: v("[hh hh oh hh]*4", V16),
    outro: v("hh*4", V4),
    end: null,
  },
  perc: {
    intro: null,
    verse1: v("<cr ~!7>"),
    prechorus: v("<~ ~ ~ [~ ~ [lt lt] [ht ht]]>"),
    chorus1: v("<cr ~!3 cr ~!3>"),
    verse2: v("<[cr, [~ sh ~ sh]] [~ sh ~ sh]!7>"),
    bridge: v("<cr ~!3 [sh*8]!3 [~ ~ [lt lt] [ht ht]]>"),
    chorus2: v("<[cr, rd*8] [rd*8]!3 [cr, rd*8] [rd*8]!3>", V8),
    outro: v("<cr ~!3>"),
    end: v("cr"),
  },
  bass: {
    intro: WHOLE,
    verse1: ["R@6 R@4 R@6"],
    prechorus: ["R*16"],
    chorus1: ["R ~ R U R ~ R ~ R ~ U R R ~ ~ R"],
    verse2: ["R@6 R@4 R@6"],
    bridge: CHART_BASS,
    chorus2: ["R ~ R U R ~ R ~ R ~ U R R ~ ~ R"],
    outro: WHOLE,
    end: ["R"],
  },
  comp: {
    intro: "",
    verse1: "~ x ~ x ~ x ~ ~",
    prechorus: "x*8",
    chorus1: "x*8",
    verse2: "~ x ~ x ~ x ~ ~",
    bridge: "<x!4 [x x]!3 [x*8]>",
    chorus2: "x*8",
    outro: "~ x ~ x ~ ~ ~ ~",
    end: "x",
  },
  // The pad pumps: struck on every beat with a slow attack, it swells after each kick (held a bar in the opening,
  // under the broken chords).
  padComp: { prechorus: "x*4", chorus1: "x*4", chorus2: "x*4", outro: "x*4" },
  synth: {
    bassSound: {
      intro: "sine",
      verse1: "sine",
      prechorus: "sawtooth",
      chorus1: "sawtooth",
      verse2: "sine",
      bridge: "<sine!4 sawtooth!4>",
      chorus2: "sawtooth",
      outro: "sine",
      end: "sine",
    },
    bass: {
      intro: SUB,
      verse1: SUB,
      prechorus: ACID_RISE,
      chorus1: ACID,
      verse2: SUB,
      // The whole notes on the sub, then the build on the acid line.
      bridge:
        '.lpq(12).ftype("ladder").lpenv("<0!4 3!4>").lpd(.14).lps(0).decay("<1.2!4 .2!4>").sustain("<.7!4 .4!4>")',
      chorus2: ACID,
      outro: SUB,
      end: SUB,
    },
    chords: {
      intro: PLUCK,
      verse1: STAB,
      prechorus: `.lpf("<900 1300 1800 2600>").lpenv(2).lpd(.12).lps(0).decay(.2).sustain(.3)`,
      chorus1: `${STAB}${PUMP}`,
      verse2: STAB,
      bridge: '.attack("<.3!4 0!4>").lpf(1400).decay(.6).sustain(.5)',
      chorus2: `${STAB}${PUMP}`,
      outro: STAB,
      end: ".lpf(1800).decay(1.5).sustain(.5)",
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.51).delayfeedback(.35)",
    pad: ".unison(5).detune(.2).attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8))",
  },
};

const KITS: Readonly<Record<FlavourId, Kit>> = {
  "flavour.pop": POP,
  "flavour.indie": INDIE,
  "flavour.jazz-soul": JAZZ,
  "flavour.funk": FUNK,
  "flavour.electronic": ELECTRONIC,
};

/** Jazz-soul's swing (contracts §5.10, amount 1/3): the second eighth of each beat lands on the last triplet. */
const SWING = ".swingBy(1/3, 4)";

/** One flavour's song: the tune first, then the pad, the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const swing = k.jazz ? SWING : "";
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const voicing = (id: SectionId, c: Chord): string => {
    const set = k.jazz ? FOURS : TRIADS;
    return set[VOICE_SET[id]][c] as string;
  };
  const chords = mapSections((id) => {
    const fx = syn?.chords[id] ?? "";
    if (id === "intro") return `note("${arpLine(ARP)}").s("${k.sounds.chords}")${fx}`;
    const notes = id === "end" ? (k.jazz ? LAST.four : LAST.triad) : perBar(id, (c) => voicing(id, c));
    return `note("${notes}").struct("${k.comp[id]}").s("${k.sounds.chords}")${fx}`;
  });
  const pad = mapSections((id) =>
    PAD_SECTIONS.has(id)
      ? `note("${perBar(id, (c) => PAD_NOTES[c])}").struct("${k.padComp?.[id] ?? "x"}")`
      : null,
  );
  const bass = mapSections((id) => {
    const line = bassLine(id, k.bass[id]);
    return syn ? `note("${line}").s("${syn.bassSound[id]}")${syn.bass[id]}` : `note("${line}")`;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: BySection): BySection =>
    k.banks
      ? mapSections((id) => (by[id] === null ? null : `${by[id]}.bank("${k.banks?.[id] ?? k.bank}")`))
      : by;
  /** The kick's sections on the 808 machine (`banks`) get its decay. */
  const kick808 = (by: BySection): BySection =>
    mapSections((id) => (by[id] !== null && k.banks?.[id] === "oak808" ? `${by[id]}${KICK_808}` : by[id]));
  const tracks = [
    track(
      "mel",
      MEL,
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}${swing}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)})`,
    ),
    track(
      "pad",
      pad,
      `.s("${k.sounds.pad}")${syn?.pad ?? ".attack(.3).release(.6)"}${swing}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${swing}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${syn ? "" : `.s("${k.sounds.bass}")`}${swing}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    track(
      "kick",
      kick808(drums(k.kick)),
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

export const U05_SONG = defineUnitSong({
  id: "usong.U05",
  unit: "U05",
  version: 1,
  title: "Climb the chord",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 88,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "pad", label: "pad", role: "pad", name: "Held chords", plainName: "Held chords" },
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
  // By section (AUTHORING §23.6): every U05 Make but L06 writes the chords, so each step hands over the chords of one
  // part of the song, and a take that plays chords silences Oak's bass, tune and pad there. Where the learner keeps
  // the roots C G A F (L01, L04, L05, L07, L08), Oak keeps what fits them (`oakKeeps`, clash-checked); where the
  // learner chooses the chords (L02, L03, L09), the learner's loop and Oak's drums play that part alone.
  plan: [
    take(
      "U05.L01",
      ["verse1"],
      ["chords"],
      "oak",
      "Your chords take over the second part of the song, stacked on Oak's bass, under Oak's tune.",
      ["bass", "lead"],
    ),
    take(
      "U05.L02",
      ["outro"],
      ["chords"],
      "oak",
      "Your loop of four chords, one of them darker, plays the ending of the song before its last chord.",
    ),
    take(
      "U05.L03",
      ["prechorus"],
      ["chords"],
      "U05.L01",
      "Your chords from Stacking Thirds, with one restless chord, play the four bars before the first loud part.",
    ),
    take(
      "U05.L04",
      ["intro"],
      ["chords"],
      "U05.L01",
      "Your chords from Stacking Thirds, played one note at a time, open the song over Oak's bass.",
      ["bass", "pad"],
    ),
    take(
      "U05.L09",
      ["bridge"],
      ["chords"],
      "oak",
      "Your four chords, two of them your choice, play the half-time part before the last loud part.",
    ),
    take(
      "U05.L05",
      ["verse2"],
      ["chords"],
      "U05.L01",
      "Your chords from Stacking Thirds, with a new lowest note, play the part after the first loud part.",
      ["lead"],
    ),
    take(
      "U05.L06",
      ["verse1", "chorus1", "chorus2"],
      ["bass"],
      "oak",
      "Your bass line plays under your chords in the second part and under both loud parts of the song.",
    ),
    take(
      "U05.L07",
      ["chorus1"],
      ["chords"],
      "oak",
      "Your chords, each note moving as little as it can, take over the first loud part of the song.",
      ["bass", "lead", "pad"],
    ),
    take(
      "U05.L08",
      ["chorus2"],
      ["chords"],
      "U05.L07",
      "Your chords by name, on a Rhodes or an organ, take over the last loud part of the song.",
      ["bass", "lead", "pad"],
    ),
  ],
  releaseAfter: "U05.CP",
});

export default U05_SONG;
