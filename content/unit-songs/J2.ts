// Jazz song 2, "On the road" (docs/design/songs/makes-core-c.md §4.1, the J2 row: "the same tune, its solo choruses:
// a touring chorus, a minor bridge, a ballad tag"; AUTHORING §23). 4/4, 132 BPM, swung, 60 bars (1:49). J1's world (a
// swing trio in C on ii–V–Is, vibes on top) with a new tune of its own. The heads are Oak's; the solo choruses between
// them are the unit's, each in the key of its lesson's Make, and each is where one Make takes over.
//
//   intro 4         | head 8                          | tour 12 (a solo)                        | bridge 8 (D minor)
//   Dm7 G7 C6 A7    | Dm7 G7 C6 A7 Dm7 G7 C6 C6       | Dm7 G7 C^7 C^7 Gm7 C7 F^7 F^7 Cm7 F7 Bb^7 Bb^7 | (Em7b5 A7b9 Dm7 Dm7) Em7b5 A7b9 Dm6 Dm6
//   solo 8 (G, then B♭)                 | head 8                        | ballad 8 (E♭)              | outro 4
//   Am7 D7 G^7 G^7 Cm7 F7 Bb^7 Bb^7     | Dm7 G7 C6 A7 Dm7 G7 C6 C7     | (Fm9 Bb13 Eb^9 Eb^9)×2     | Dm9 G13 C6/9 C6/9
//
// Each solo chorus plays its lesson's idea in Oak's own parts before the learner takes it:
// - The tour (J2.L01): one four-bar lick over a ii–V–I in C, then the same lick and chords five half steps up (F),
//   then five more (B♭, written 12 lower): the cycle of fourths, three keys. A crash marks each new key.
// - The bridge (J2.L02): the minor ii–V–i of D minor, twice. The comping voices the V without its root or its ♭9
//   (C♯ E G over the bass's A); the vibes hold the bent note, B♭, for two beats over it and fall to A, then sing the
//   ♭9 again at the top of the second time. Home is Dm7, then Dm6 to close.
// - The solo (J2.L04): a line of eighths that changes scale with every chord (A Dorian, D Mixolydian, G major, then
//   C Dorian, F Mixolydian, B♭ major), every note on a beat a tone of its chord, from G into B♭.
// - The ballad (J2.L03): Fm9 B♭13 E♭maj9 at half the pace, a tune whose long notes ring on 9ths and 13ths (G over
//   Fm9, G and C over B♭13, F over E♭maj9) and on E♭'s 7th and 6th (D, C).
// - The heads carry the same colours: E over G7 (its 13th) in bar 6, and the outro slides a half step down from
//   E♭maj9 into Dm9 G13 C6/9, its tune on the 9th, the 13th and the 9th.
//
// Keys (`sections[].key`): a take's Make must be in the key of every section it plays in, and the validator compares
// the Make's declared key (content/validate/unit-songs.ts `checkSongStep`). J2.L01's Make is in C and tours inside its
// own code, so the tour keeps the song's key; the bridge is D minor (J2.L02), the solo G major (J2.L04's Make is in G
// and moves to B♭ inside its code) and the ballad E♭ major (J2.L03). Every line is written in note names, so there is
// no key plan.
//
// Every flavour plays the same notes: the tune (and its double in the second head), the chords (the same voicings in
// every kit), the bass's root on every downbeat. A flavour changes sounds, drums, the comping rhythm and the bass's
// rhythm between the downbeats. The jazz forms swing in every kit (content/bands/index.ts `jazzForm`), and so does
// this song: `.swingBy(1/3, 4)` on every track, the swing of every J2 Make. Seventh chords in every kit: they are the
// unit's harmony, not a kit's colour (as U12 and U15). Wherever a chord is struck, the bass is sounding its root or its
// octave, so a C6 never reads as Am7. Swing delays every "and" by a sixth of a beat, so nothing struck on the "and"
// of 4 may last an eighth: the comping never strikes there (electronic's stabs last a sixteenth), and the bass's
// last note in a bar starts on a beat. The tune and the bass hold no note a half step above a sounding chord tone
// (AUTHORING §13): the tune never holds a major seventh chord's root, the comping's V in the bridge has no B♭ above
// the bass's A (the ♭9 is the tune's), and the bass walks on roots, 3rds and 5ths only. The only held half steps are
// the ♭9 itself, the vibes' B♭ over the bass's A, and the 9th against the minor 3rd inside the Fm9 voicing. Gains
// copy U17's levelled kits (songs.pw.ts, budget sound-songs.json), so the learner's line sits on top. Every claim here
// is read off the evaluated events.
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
  { id: "head1", type: "head", bars: 8 },
  // J2.L01's Make is in C and moves to F and B♭ inside its own code.
  { id: "tour", type: "solo", bars: 12 },
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "D", mode: "minor" } },
  // J2.L04's Make is in G and moves to B♭ inside its own code.
  { id: "solo", type: "solo", bars: 8, key: { tonic: "G", mode: "major" } },
  { id: "head2", type: "head", bars: 8 },
  { id: "ballad", type: "ballad", bars: 8, key: { tonic: "Eb", mode: "major" } },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
type Kind = (typeof SECTIONS)[number]["type"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;
/** Something every section of the same kind shares (the heads, the solos), with exceptions by id. */
type ByKind<T> = Readonly<Record<Kind, T>> & { readonly only?: Partial<Record<SectionId, T>> };

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const kindOf = (id: SectionId): Kind => (SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number]).type;
const pick = <T>(by: ByKind<T>, id: SectionId): T => by.only?.[id] ?? by[kindOf(id)];

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melSolo`; `melSolo2` for the second solo), `silence` where it rests, and one `arrange()` over every section.
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

/** Bars as one slow sequence, one bar a cycle: `<[…] […]>`. */
const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- Notes ---------------------------------------------------------------------------------------------------

const SHARPS = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const FLATS = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"];
const STEP: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const midiOf = (name: string): number => {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note name: ${name}`);
  const [, letter, acc, oct] = m;
  return (
    12 * (Number(oct) + 1) + (STEP[letter as string] as number) + (acc === "#" ? 1 : acc === "b" ? -1 : 0)
  );
};
const nameOf = (midi: number, flats: boolean): string =>
  `${(flats ? FLATS : SHARPS)[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
/** Every note of a bar moved by `k` half steps, holds and rests kept, spelt with flats or sharps. */
const moveBar = (bar: string, k: number, flats: boolean): string =>
  bar
    .split(" ")
    .map((t) => {
      if (t.startsWith("~")) return t;
      const [n, hold] = t.split("@");
      return `${nameOf(midiOf(n as string) + k, flats)}${hold === undefined ? "" : `@${hold}`}`;
    })
    .join(" ");

// ---- Harmony (every flavour) ---------------------------------------------------------------------------------
//
// One chord a bar, voiced close between A2 and E4, always under the tune. `r`, `t` and `f` are the bass's root, 3rd
// and 5th, between E1 and B♭2. The four-note set: Dm7 D F A C, G7 B D F G, C6 E G A C, A7 C♯ E G A, C7 E G B♭ C,
// C^7 C E G B, Gm7 F G B♭ D, F^7 F A C E, Cm7 C E♭ G B♭, F7 A C E♭ F, B♭^7 B♭ D F A, Em7♭5 E G B♭ D, the bridge's V
// C♯ E G (the vibes carry its ♭9), Dm6 D F A B, Am7 A C E G, D7 C D F♯ A, G^7 F♯ G B D, Fm9 E♭ G A♭ C, B♭13 D G A♭ C,
// E♭^9 D F G B♭, Dm9 F A C E, G13 F A B E, C6/9 E G A D. The rootless ones read as their chord over the bass's root.

interface ChordDef {
  /** The voicing, note names, low to high. */
  v: string;
  /** The bass's root, 3rd and 5th. */
  r: string;
  t: string;
  f: string;
}
const CHORD = {
  Dm7: { v: "d3,f3,a3,c4", r: "d2", t: "f2", f: "a1" },
  G7: { v: "b2,d3,f3,g3", r: "g1", t: "b1", f: "d2" },
  C6: { v: "e3,g3,a3,c4", r: "c2", t: "e2", f: "g1" },
  A7: { v: "c#3,e3,g3,a3", r: "a1", t: "c#2", f: "e2" },
  C7: { v: "e3,g3,bb3,c4", r: "c2", t: "e2", f: "g1" },
  Cmaj7: { v: "c3,e3,g3,b3", r: "c2", t: "e2", f: "g1" },
  Gm7: { v: "f3,g3,bb3,d4", r: "g1", t: "bb1", f: "d2" },
  F7tour: { v: "a2,c3,eb3,f3", r: "f1", t: "a1", f: "c2" },
  C7tour: { v: "e3,g3,bb3,c4", r: "c2", t: "e2", f: "g1" },
  Fmaj7: { v: "f3,a3,c4,e4", r: "f1", t: "a1", f: "c2" },
  Cm7: { v: "c3,eb3,g3,bb3", r: "c2", t: "eb2", f: "g1" },
  Bbmaj7: { v: "bb2,d3,f3,a3", r: "bb1", t: "d2", f: "f1" },
  Em7b5: { v: "e3,g3,bb3,d4", r: "e2", t: "g1", f: "bb1" },
  // The V of D minor: the comping leaves out the root and the ♭9 (a B♭ over the bass's A is a minor 9th); the vibes
  // hold the B♭.
  A7b9: { v: "c#3,e3,g3", r: "a1", t: "c#2", f: "e2" },
  Dm6: { v: "d3,f3,a3,b3", r: "d2", t: "f2", f: "a1" },
  Am7: { v: "a2,c3,e3,g3", r: "a1", t: "c2", f: "e2" },
  D7: { v: "c3,d3,f#3,a3", r: "d2", t: "f#2", f: "a1" },
  Gmaj7: { v: "f#3,g3,b3,d4", r: "g1", t: "b1", f: "d2" },
  Fm9: { v: "eb3,g3,ab3,c4", r: "f1", t: "ab1", f: "c2" },
  Bb13: { v: "d3,g3,ab3,c4", r: "bb1", t: "d2", f: "f1" },
  Ebmaj9: { v: "d3,f3,g3,bb3", r: "eb2", t: "g1", f: "bb1" },
  Dm9: { v: "f3,a3,c4,e4", r: "d2", t: "f2", f: "a1" },
  G13: { v: "f3,a3,b3,e4", r: "g1", t: "b1", f: "d2" },
  C69: { v: "e3,g3,a3,d4", r: "c2", t: "e2", f: "g1" },
} as const satisfies Readonly<Record<string, ChordDef>>;
type ChordName = keyof typeof CHORD;

const HEAD: readonly ChordName[] = ["Dm7", "G7", "C6", "A7", "Dm7", "G7", "C6", "C6"];
const PROGRESSION: Readonly<Record<SectionId, readonly ChordName[]>> = {
  intro: ["Dm7", "G7", "C6", "A7"],
  head1: HEAD,
  tour: [
    "Dm7",
    "G7",
    "Cmaj7",
    "Cmaj7",
    "Gm7",
    "C7tour",
    "Fmaj7",
    "Fmaj7",
    "Cm7",
    "F7tour",
    "Bbmaj7",
    "Bbmaj7",
  ],
  bridge: ["Em7b5", "A7b9", "Dm7", "Dm7", "Em7b5", "A7b9", "Dm6", "Dm6"],
  solo: ["Am7", "D7", "Gmaj7", "Gmaj7", "Cm7", "F7tour", "Bbmaj7", "Bbmaj7"],
  // The last bar turns C into C7, the V of Fm9: the door into the ballad.
  head2: [...HEAD.slice(0, 7), "C7"],
  ballad: ["Fm9", "Bb13", "Ebmaj9", "Ebmaj9", "Fm9", "Bb13", "Ebmaj9", "Ebmaj9"],
  outro: ["Dm9", "G13", "C69", "C69"],
};
const layout = (() => {
  let start = 0;
  return SECTIONS.map((s) => {
    const at = start;
    start += s.bars;
    return { id: s.id as SectionId, start: at };
  });
})();
/** The chord of the bar after this one in the song (the song's own last chord at the end). */
function nextChord(id: SectionId, i: number): ChordName {
  const chords = PROGRESSION[id];
  if (i + 1 < chords.length) return chords[i + 1] as ChordName;
  const at = layout.findIndex((s) => s.id === id);
  const next = layout[at + 1];
  return next ? (PROGRESSION[next.id][0] as ChordName) : (chords[i] as ChordName);
}

// ---- The tune (every flavour) --------------------------------------------------------------------------------
//
// Eight swung eighths a bar, `@` holds. Every note held a beat or more is a tone or a 9th or 13th of its chord, never
// a half step above a chord tone; the pickups and passing notes are eighths.
//
// The head: a pickup run up to the 7th of Dm7 (C), the 3rd of G7 (B) falling to its 7th (F), which falls to the 3rd
// of C6 (E): the thread of J1. The A7 climbs to its 7th, G, which falls to the 3rd of Dm7, F; bar 6 sings E over G7,
// its 13th; the head ends on G. The intro is the head's last four bars over A7, the V of Dm7, into the head.
const HEAD_TUNE = [
  "~ d4 f4 a4 c5@3 a4",
  "b4@2 d5 b4 g4@2 f4@2",
  "e4@6 ~ g4",
  "a4@2 c#5 e5 g5@3 e5",
  "f5@2 d5 a4 c5@3 a4",
  "b4@2 d5 f5 e5@2 d5@2",
  "e5@3 d5 c5@2 a4@2",
  "g4@6 ~@2",
];
/**
 * The tour's lick over Dm7 G7 Cmaj7 Cmaj7, then up five half steps in F and down seven in B♭: E over Dm7 (its 9th),
 * B and D over G7, E, B and A over Cmaj7 (never its root C, which would sit a minor 9th over the chord's B).
 */
const LICK = ["d4 f4 a4 c5 e5@2 d5 c5", "b4@2 g4 f4 d4@2 b3 d4", "e4@3 g4 b4@2 a4 g4", "a4@2 g4 e4 ~@4"];
const TOUR_TUNE = [
  ...LICK,
  ...LICK.map((b) => moveBar(b, 5, true)),
  ...LICK.map((b) => moveBar(b, -2, true)),
];
/**
 * The minor bridge: the run up to the 7th of Em7♭5 (D); over the V the bent note, B♭, held two beats and falling
 * to A, then G (the V's 7th) to F (the 3rd of Dm7). The second time climbs: C♯ E G B♭ A, then F E D A over Dm6 and
 * D, home.
 */
const BRIDGE_TUNE = [
  "~ e4 g4 bb4 d5@3 bb4",
  "bb4@4 a4@2 g4@2",
  "f4@6 ~ a4",
  "d5@3 c5 a4@2 f4@2",
  "~ e4 g4 bb4 d5@3 bb4",
  "c#5@2 e5 g5 bb5@2 a5@2",
  "f5@3 e5 d5@2 a4@2",
  "d5@6 ~@2",
];
/**
 * The second solo, a line on a scale per chord: chord tones on the beats (A C G E, F♯ D A C, …), scale notes between
 * them. Over G^7 it rings A (the 9th) and F♯ (the 7th), over B♭^7 G (the 13th), and it ends on D, B♭'s 3rd.
 */
const SOLO_TUNE = [
  "a4 b4 c5 e5 g5 f#5 e5 c5",
  "f#5 e5 d5 c5 a4 b4 c5 a4",
  "b4@2 d5 f#5 a5@2 g5 d5",
  "f#5@2 e5 d5 b4@4",
  "c5 d5 eb5 g5 bb5 a5 g5 eb5",
  "a5 g5 f5 eb5 c5 d5 eb5 c5",
  "d5@2 f5 a5 g5@2 f5 d5",
  "d5@6 ~@2",
];
/**
 * The ballad: G over Fm9 (the 9th), C then G over B♭13 (the 9th, the 13th), F over E♭maj9 (the 9th), B♭; the second
 * time C, G, then D and C over E♭maj9 (its 7th and its 6th).
 */
const BALLAD_TUNE = [
  "g4@6 ab4 c5",
  "c5@2 bb4 ab4 g4@4",
  "f4@6 g4 bb4",
  "bb4@8",
  "c5@6 bb4 ab4",
  "g4@6 f4 ~",
  "f4@2 g4 bb4 d5@4",
  "c5@8",
];
/** The ending: E over Dm9 (its 9th), A and E over G13 (its 9th and 13th), E and G over C6/9, then D, its 9th. */
const OUTRO_TUNE = ["e5@6 d5 c5", "a4@4 e5@4", "e5@4 g4@4", "d5@8"];

const MEL: BySection = {
  intro: `note("${bars([...HEAD_TUNE.slice(4, 7), "g4@6 ~@2"])}")`,
  head1: `note("${bars(HEAD_TUNE)}")`,
  tour: `note("${bars(TOUR_TUNE)}")`,
  bridge: `note("${bars(BRIDGE_TUNE)}")`,
  solo: `note("${bars(SOLO_TUNE)}")`,
  head2: `note("${bars(HEAD_TUNE)}")`,
  ballad: `note("${bars(BALLAD_TUNE)}")`,
  outro: `note("${bars(OUTRO_TUNE)}")`,
};
/** The second line: the last head doubled an octave down on another sound (a tenor saxophone in jazz-soul). */
const VOX: BySection = {
  intro: null,
  head1: null,
  tour: null,
  bridge: null,
  solo: null,
  head2: `note("${bars(HEAD_TUNE.map((b) => moveBar(b, -12, false)))}")`,
  ballad: null,
  outro: null,
};

// ---- The kits ------------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

/** The jazz ride: ding, ding-a-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** The Charleston: beat 1 and the "and" of 2, both while the bass sounds the root. */
const CHARLESTON = "x ~ ~ x ~ ~ ~ ~";

/**
 * A bass bar: `{r}` root, `{o}` the root an octave up, `{t}` 3rd, `{f}` 5th, `{a}` the 3rd or 5th nearest the next
 * bar's root (a walking bass's last beat), or `~`.
 */
type BassBar = string;
/** Two-feel: root and 5th. */
const TWO = "{r}@2 {f}@2";
/** Walking: root, its octave, 5th, then the chord tone nearest the next root. */
const WALK = "{r} {o} {f} {a}";

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic). */
  banks?: Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; lead: string; vox: string; pad: string };
  /** Levels per part, copied from U17's levelled kits (packages/strudel/e2e/songs.pw.ts, sound-songs.json). */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    vox: number;
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
  /** The held chords' rhythm and controls (the ballad and the ending). */
  pad: { struct: string; fx: string };
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter, the lines' echo. */
  synth?: {
    bassSound: ByKind<string>;
    bass: ByKind<string>;
    chords: ByKind<string>;
    lead: string;
    vox: string;
  };
}

const SWING = ".swingBy(1/3, 4)";

/** Pop: the default kit swung, piano, picked bass, strings; a shuffle backbeat, the ride in the solos. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", vox: "strings", pad: "strings" },
  gain: {
    kick: 0.21,
    snare: 0.17,
    hats: 0.11,
    perc: 0.1,
    bass: 0.56,
    chords: 0.24,
    lead: 0.58,
    vox: 0.33,
    pad: 0.15,
  },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ ~ bd ~ ~ ~]>"),
    head: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ ~ bd ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    ballad: v("bd ~ ~ ~ ~ ~ ~ ~"),
    outro: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ sd ~ sd] [~ sd ~ [sd sd]]>"),
    head: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!3 [~ sd ~ [~ sd]]>"),
    // Half time: a cross-stick on 3.
    bridge: v("<[~ ~ rim ~]!7 [~ ~ rim [sd sd]]>"),
    ballad: v("~ ~ rim ~"),
    outro: v("<[~ sd ~ sd] [~ sd ~ sd] ~ ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    head: v("hh*8", V8),
    solo: v("~ hh ~ hh"),
    bridge: v("hh*4"),
    ballad: v("~ ~ hh ~"),
    outro: v("<[hh*8] [hh*8] ~ ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    head: v("<cr ~ ~ ~ ~ ~ ~ ~>"),
    // The ride in the solos, a crash on each new key.
    solo: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    ballad: v("<cr ~!7>"),
    outro: v("<cr ~ cr ~>"),
    only: { head2: v("<[cr, tb*4] [tb*4]!7>") },
  },
  bass: { intro: TWO, head: TWO, solo: WALK, bridge: TWO, ballad: TWO, outro: "{r}@4" },
  comp: {
    intro: CHARLESTON,
    head: "x@2 ~ x ~@4",
    solo: CHARLESTON,
    bridge: "x@4 ~@4",
    ballad: "x",
    outro: "x",
  },
  pad: { struct: "x", fx: ".attack(.3).release(.8)" },
};

/** Indie: the rock kit swung, clean guitar, acoustic lead, organ held chords. Brushy cross-sticks, toms in the bridge. */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "strings", pad: "organ" },
  gain: {
    kick: 0.4,
    snare: 0.36,
    hats: 0.24,
    perc: 0.2,
    bass: 0.5,
    chords: 0.41,
    lead: 0.78,
    vox: 0.26,
    pad: 0.2,
  },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ bd ~ ~ ~] [bd ~ ~ ~ bd ~ ~ ~]>"),
    head: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ ~ bd ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    ballad: v("bd ~ ~ ~ ~ ~ ~ ~"),
    outro: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ rim ~ rim] [~ rim ~ [sd sd]]>"),
    head: v("<[~ rim ~ rim]!7 [~ rim [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!3 [~ sd ~ [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!7 [~ ~ rim [sd sd]]>"),
    ballad: v("~ ~ rim ~"),
    outro: v("<[~ rim ~ rim] [~ rim ~ rim] ~ ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    head: v("hh*8", V8),
    solo: v("hh*8", V8),
    bridge: null,
    ballad: v("~ ~ hh ~"),
    outro: v("<[hh*8] [hh*8] ~ ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    head: v("<cr ~ ~ ~ ~ ~ ~ ~>"),
    solo: v("<[cr, rd*4] [rd*4]!3>"),
    // The bridge rolls on the floor tom under the guitar.
    bridge: v("<[cr, [lt ~ lt lt ~ lt ~ ~]] [lt ~ lt lt ~ lt ~ ~]!7>"),
    ballad: v("<cr ~!7>"),
    outro: v("<cr ~ cr ~>"),
    only: { head2: v("<[cr, tb*4] [tb*4]!7>") },
  },
  bass: { intro: TWO, head: TWO, solo: WALK, bridge: "{r}@4", ballad: TWO, outro: "{r}@4" },
  comp: {
    intro: CHARLESTON,
    head: "x@3 x@4 ~",
    solo: "x@3 x@4 ~",
    bridge: "x",
    ballad: "x",
    outro: "x",
  },
  pad: { struct: "x", fx: ".attack(.2).release(.6)" },
};

/**
 * Jazz-soul: the jazz kit, Rhodes, upright bass, vibes, a tenor saxophone doubling the last head, strings holding the
 * ballad and the ending. The ride's ding ding-a, the hi-hat on 2 and 4, the bass in two in the heads and walking in
 * the solos, the snare comping.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "tenor", pad: "strings" },
  gain: {
    kick: 0.22,
    snare: 0.29,
    hats: 0.18,
    perc: 0.18,
    bass: 0.59,
    chords: 0.35,
    lead: 0.47,
    vox: 0.41,
    pad: 0.15,
  },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd ~ bd ~] [bd ~ bd ~]>"),
    head: v("bd ~ bd ~"),
    solo: v("bd ~ bd ~"),
    bridge: v("bd ~ ~ ~"),
    ballad: v("bd ~ ~ ~"),
    outro: v("bd"),
  },
  snare: {
    intro: v("<~ ~ ~ [~ ~ ~ [sd sd]]>"),
    head: v("<~!7 [~ ~ [~ sd] [sd sd]]>"),
    // Comping: a snare on the "and" of 3 every other bar, a fill into each new key.
    solo: v("<~ [~ ~ [~ sd] ~] ~ [~ sd [~ sd] [sd sd]]>"),
    bridge: v("~ ~ ~ rim"),
    ballad: v("~ ~ rim ~"),
    outro: null,
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("~ hh ~ hh"),
    head: v("~ hh ~ hh"),
    solo: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    ballad: v("~ ~ hh ~"),
    outro: v("<[~ hh ~ hh] [~ hh ~ hh] ~ ~>"),
  },
  perc: {
    intro: v(`${RIDE}`, V8),
    head: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    solo: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    // The ride in quarters.
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    // Half time: the ride on 1 and 3.
    ballad: v("<[cr, rd ~ rd ~] [rd ~ rd ~]!7>"),
    outro: v(`<[cr, ${RIDE}] [${RIDE}] cr ~>`, V8),
  },
  bass: { intro: TWO, head: TWO, solo: WALK, bridge: TWO, ballad: TWO, outro: "{r}@4" },
  comp: {
    intro: CHARLESTON,
    head: CHARLESTON,
    solo: CHARLESTON,
    bridge: "x ~ ~ ~ ~ ~ ~ ~",
    ballad: "x",
    outro: "x",
  },
  pad: { struct: "x", fx: ".attack(.4).release(.8)" },
};

/**
 * Funk: Oak's 808 (its kick choked), clavinet, finger bass, organ lead, horns doubling the last head, strings holding
 * the ballad. A swung jazz-funk groove: the kick and the bass lock on 1, the "and" of 2 and beat 4, the clavinet hits
 * on 1, the "and" of 2 and the "and" of 3 over the root or its octave. The bridge and the ballad lay back on the Rhodes.
 */
const FK_KICK = "bd ~ ~ bd ~ ~ bd ~";
const FK_BASS = "{r} ~ {r} {o} ~ {o} {r} ~";
const FK_CLAV = "x ~ ~ x ~ x ~ ~";
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "horns", pad: "strings" },
  gain: {
    kick: 0.34,
    snare: 0.24,
    hats: 0.14,
    perc: 0.12,
    bass: 0.69,
    chords: 0.66,
    lead: 0.66,
    vox: 0.55,
    pad: 0.21,
  },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<~ ~ [${FK_KICK}] [${FK_KICK}]>`),
    head: v(FK_KICK),
    solo: v("bd ~ ~ ~ bd ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    ballad: v("bd ~ ~ ~ ~ ~ ~ ~"),
    outro: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ sd ~ sd] [~ sd ~ [sd sd]]>"),
    head: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!3 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("~ ~ sd ~"),
    ballad: v("~ ~ rim ~"),
    outro: v("<[~ [sd,cp] ~ [sd,cp]] [~ [sd,cp] ~ [sd,cp]] ~ ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    head: v("[hh hh hh oh]*2", V8),
    solo: v("hh*8", V8),
    bridge: v("hh*4"),
    ballad: v("~ ~ hh ~"),
    outro: v("<[hh*8] [hh*8] ~ ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    head: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!7>"),
    solo: v("<[cr, rd*4] [rd*4]!3>"),
    bridge: v("<cr ~!7>"),
    ballad: v("<cr ~!7>"),
    outro: v("<cr ~ cr ~>"),
  },
  bass: { intro: FK_BASS, head: FK_BASS, solo: WALK, bridge: TWO, ballad: TWO, outro: "{r}@4" },
  comp: {
    intro: FK_CLAV,
    head: FK_CLAV,
    solo: CHARLESTON,
    bridge: "x",
    ballad: "x",
    outro: "x",
  },
  chordSound: { bridge: "rhodes", ballad: "rhodes", outro: "rhodes" },
  pad: { struct: "x", fx: ".attack(.3).release(.8)" },
};

// Electronic: swing house. The solos run four on the floor on the 909 with the acid line (the TB-303 recipe, every
// eighth on the root or its octave) and sixteenth-long sawtooth stabs between the kicks; the heads sit on the lo-fi
// kit over a sine sub; the bridge drops to the 808 at half time; the ballad and the ending hold a supersaw pad.
const ACID_BAR = "{r} {r} {o} {r} {r} {o} {r}@2";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** A sawtooth stab whose filter snaps shut, a sixteenth long, so swing never carries it over a beat. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
const OFF_STABS = "[~ [x ~]]*4";
/** Soft sawtooth keys, the filter closed, under the pad's swell (the ballad, the ending). */
const KEYS = ".lpf(1200).attack(.02).decay(1.2).sustain(.5)";
/** The 808 kick rings for seconds with no choke: a 0.35 s decay keeps its thump and stops the pile-up (songs.pw.ts). */
const KICK_808 = ".decay(.35).sustain(0)";
/** A supersaw struck on every beat with a slow attack, so it swells after each kick; lowered as U17's (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: {
    intro: "lofikit",
    head1: "lofikit",
    bridge: "oak808",
    head2: "lofikit",
    ballad: "lofikit",
    outro: "lofikit",
  },
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", vox: "supersaw", pad: "supersaw" },
  gain: {
    kick: 0.25,
    snare: 0.22,
    hats: 0.15,
    perc: 0.13,
    bass: 0.68,
    chords: 0.4,
    lead: 0.44,
    vox: 0.31,
    pad: 0.21,
  },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd ~ ~ ~ ~] [bd ~ ~ bd ~ ~ ~ ~]>"),
    head: v("bd ~ ~ bd ~ ~ ~ ~"),
    solo: v("bd*4"),
    bridge: v("bd ~ ~ ~ ~ ~ bd ~"),
    ballad: v("bd ~ ~ ~ ~ ~ ~ ~"),
    outro: v("bd"),
  },
  snare: {
    intro: v("<~ ~ [~ sd ~ sd] [~ sd ~ [sd sd]]>"),
    head: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    solo: v("<[~ [sd,cp] ~ [sd,cp]]!3 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    ballad: v("~ ~ rim ~"),
    outro: v("<[~ sd ~ sd] [~ sd ~ sd] ~ ~>"),
  },
  hats: {
    intro: v("[~ hh]*4", V8),
    head: v("hh*8", V8),
    solo: v("[hh oh]*4", V8),
    bridge: v("~ hh ~ hh"),
    ballad: v("~ ~ hh ~"),
    outro: v("<[hh*8] [hh*8] ~ ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    head: v("<cr ~!7>"),
    solo: v("<[cr, [~ rd]*4] [[~ rd]*4]!3>"),
    bridge: v("<cr ~!7>"),
    ballad: v("<cr ~!7>"),
    outro: v("<cr ~ cr ~>"),
    only: { head2: v("<[cr, [~ rd]*4] [[~ rd]*4]!7>") },
  },
  bass: {
    intro: "{r}@3 {r}@3 {r}@2",
    head: "{r}@3 {r}@3 {r}@2",
    solo: ACID_BAR,
    bridge: "{r}@6 {r}@2",
    ballad: "{r}@8",
    outro: "{r}@8",
    only: { head2: ACID_BAR },
  },
  comp: {
    // The supersaw swell needs a beat to open (its attack is longer than a sixteenth stab), as U17's intro.
    intro: "x x x x",
    head: OFF_STABS,
    solo: OFF_STABS,
    bridge: "x x x x",
    ballad: "x",
    outro: "x",
  },
  chordSound: { intro: "supersaw", bridge: "supersaw" },
  pad: { struct: "x x x x", fx: PAD },
  synth: {
    bassSound: {
      intro: "sine",
      head: "sine",
      solo: "sawtooth",
      bridge: "sine",
      ballad: "sine",
      outro: "sine",
      only: { head2: "sawtooth" },
    },
    bass: { intro: SUB, head: SUB, solo: ACID, bridge: SUB, ballad: SUB, outro: SUB, only: { head2: ACID } },
    chords: {
      intro: PAD,
      head: STAB,
      solo: STAB,
      bridge: PAD,
      ballad: KEYS,
      outro: KEYS,
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.34).delayfeedback(.35)",
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

/**
 * The root, 3rd or 5th of `c` nearest the next bar's root, but neither on it nor on the 5th just played: a walking
 * bass's last beat. Spelt as the chord spells that note.
 */
function approach(c: ChordDef, next: ChordDef): string {
  const target = midiOf(next.r);
  const tones = [c.t, c.f, c.r].flatMap((n) => [0, 12, -12].map((k) => ({ m: midiOf(n) + k, n, k })));
  const near = tones
    .filter(({ m }) => m !== target && m !== midiOf(c.f) && m >= midiOf("e1") && m <= midiOf("d3"))
    .sort((a, b) => Math.abs(a.m - target) - Math.abs(b.m - target) || a.m - b.m);
  const best = near[0] as { m: number; n: string };
  return nameOf(best.m, /^[a-g]b/.test(best.n));
}

/** A section's bass line: one bar per chord, the kit's bar with the chord's notes filled in. */
function bassLine(id: SectionId, bar: BassBar): string {
  const chords = PROGRESSION[id];
  const out = chords.map((name, i) => {
    const c: ChordDef = CHORD[name];
    const o = nameOf(midiOf(c.r) + 12, /b/.test(c.r));
    const notes: Record<"r" | "o" | "t" | "f" | "a", string> = {
      r: c.r,
      o,
      t: c.t,
      f: c.f,
      a: bar.includes("{a}") ? approach(c, CHORD[nextChord(id, i)]) : c.f,
    };
    return bar.replace(/\{([rotfa])\}/g, (_, k: "r" | "o" | "t" | "f" | "a") => notes[k]);
  });
  return bars(out);
}

/** A section's chords: one voicing a bar. */
const chordLine = (id: SectionId): string => bars(PROGRESSION[id].map((name) => CHORD[name].v));

/** The held chords play under the ballad and the ending. */
const PADDED = new Set<SectionId>(["ballad", "outro"]);

/** One flavour's song: the tune first, then its double, the chords, the held chords, the bass and the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${chordLine(id)}").struct("${pick(k.comp, id)}").s("${sound}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const pad = mapSections((id) =>
    PADDED.has(id)
      ? `note("${chordLine(id)}").struct("${k.pad.struct}").s("${k.sounds.pad}")${k.pad.fx}`
      : null,
  );
  const bass = mapSections((id) => {
    const line = `note("${bassLine(id, pick(k.bass, id))}")`;
    return syn ? `${line}.s("${pick(syn.bassSound, id)}")${pick(syn.bass, id)}` : line;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const machine = (id: SectionId): string => k.banks?.[id] ?? k.bank;
  const drums = (by: ByKind<string | null>): BySection =>
    mapSections((id) => {
      const p = pick(by, id);
      if (p === null || !k.banks) return p;
      return `${p}.bank("${machine(id)}")`;
    });
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: BySection): BySection =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(machine(id)) ? `${p}${KICK_808}` : p;
    });
  const tracks = [
    track(
      "mel",
      MEL,
      `${SWING}.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "vox",
      VOX,
      `${SWING}.s("${k.sounds.vox}")${syn?.vox ?? ""}.gain(${num(k.gain.vox)}).pan(.45).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${SWING}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track("pad", pad, `${SWING}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`),
    track(
      "bass",
      bass,
      `${SWING}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    track("kick", kick808(drums(k.kick)), `${bank}${SWING}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${bank}${SWING}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}${SWING}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc), `${bank}${SWING}.gain(${num(k.gain.perc)})`),
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

/** Every J2 Make writes a trio (chords, bass and a vibes line), so each hands over a whole section; Oak keeps the drums. */
const TRIO: SongPartId[] = ["lead", "chords", "bass"];

export const J2_SONG = defineUnitSong({
  id: "usong.J2",
  unit: "J2",
  version: 1,
  title: "On the road",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 132,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "vox", label: "vox", role: "melody", name: "Second line", plainName: "Second line" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "pad", label: "pad", role: "pad", name: "Held chords", plainName: "Held chords" },
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
  // By section (AUTHORING §23.6): every J2 Make writes chords, bass and a vibes line, so a take hands over a whole solo
  // chorus and Oak keeps the drums there. Each Make is in another key and opens on its own starter: no earlier take is
  // a natural start (startFrom 'oak' throughout; the task report says why for each). J2.L04 may be passed over
  // (syllabus PASSABLE_LESSONS): then Oak keeps playing the second solo.
  plan: [
    take(
      "J2.L01",
      ["tour"],
      TRIO,
      "oak",
      "Your trio plays the song's first solo: twelve bars, a new key every four bars.",
    ),
    take(
      "J2.L02",
      ["bridge"],
      TRIO,
      "oak",
      "Your trio plays the song's bridge: eight bars in D minor, after the first solo.",
    ),
    take(
      "J2.L03",
      ["ballad"],
      TRIO,
      "oak",
      "Your trio plays the slow eight bars in E♭ major near the end of the song.",
    ),
    take(
      "J2.L04",
      ["solo"],
      TRIO,
      "oak",
      "Your trio plays the song's second solo: eight bars from G major into B♭ major.",
    ),
  ],
  releaseAfter: "J2.L04",
});

export default J2_SONG;
