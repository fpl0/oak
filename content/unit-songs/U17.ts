// Song 17, "The long way round" (docs/design/songs/makes-core-c.md §3 "U17 song: the song that travels"; AUTHORING
// §23). 4/4, 104 BPM, 60 bars (2:18). The unit on modulation gets a song that sets out from C and never comes back:
// every section after the first chorus lives somewhere new, and the last chorus is the first one a whole step up.
//
//   intro 4 | verse 8 | chorus 8 | verse 8      | bridge 8        | lift 8          | chorus 8 | outro 8
//   C        | C       | C        | C, then G    | A minor         | F, then G       | D        | D
//   C G Am F | (C Am F G)×2 | (C G Am F)×2 | C Am F G C Am D7 G | (Am Dm E7 Am)×2 | F Dm Bb C G Em C D | (D A Bm G)×2 | D A Bm G D A G D
//
// The song is built from the unit's own music, so each lesson's Make is a piece of it: the second verse leaves C
// through Am (vi in C, ii in G), D7 and G (U17.L01's verse that leaves home); the choruses are U17.L02's chorus, the
// last one lifted a whole step to D with the same tune numbers under a new key plan; the bridge is U17.L03's, A minor
// reached through its own V, E7; the lift is U17.L04's pop chorus, four bars in F and the same four a whole step up in
// G. Between them the doors are the unit's: G (the new home) steps up to Am, the bridge's Am falls to F (vi of C is
// iii of F), and the lift's last chord, D, is V in G and then I in D as the last chorus starts on it.
//
// Keys. Every line written in degrees (the tune, its octave double, the bass) takes ONE key plan after its arrange(),
// counted in bars of the whole song (STYLE §9, contracts §6.8 item 4, U17.L02's lesson): `melChorus` is one const for
// both choruses, and the key plan alone lifts the second. The chords are note names, so the lifted chorus has its own
// const, `chordsChorus2`. Section keys (`sections[].key`): a take's Make must be in the key of every section it plays
// in, and the validator compares the Make's declared key (content/validate/unit-songs.ts `checkSongStep`). U17.L01,
// L02 and L03 declare C major and move inside their own code, so the sections they take (verse2, chorus1-2, bridge)
// keep the song's key, C, while Oak's key plans and chords carry the move; the lift carries F (U17.L04's Make is in F)
// and the outro, which no take plays in, D.
//
// Every flavour plays the same notes (tune, bass roots on every downbeat, chord roots); a flavour changes sounds,
// grooves, comp and bass rhythms, and chord colour as its kit's staging allows at U17 (content/flavours.ts
// FLAVOUR_RULES): pop and indie play triads (and the unit's dominant sevenths D7 and E7), straight; jazz-soul swings
// (1/3) with four-note chords; funk and electronic play four-note chords, straight. The four-note chords are sixths
// on the home chords and on IV and sevenths elsewhere, never a major seventh under the tune (content/bands/index.ts).
// A four-note chord is struck while the bass sounds its root (C6 and Am7, F6 and Dm7, G6 and Em7, D6 and Bm7 are the
// same notes; the root decides), except in the intro's first two bars and the bars before the first and the last
// chorus, where the bass rests and the chord is read from its own notes. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top.
// Tune
// and bass hold no note a half step from a sounding chord tone (AUTHORING §13); every claim here is read off the
// evaluated events (content/validate/unit-songs.ts).
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
  // C, then G through Am and D7 in bars 7 and 8 (U17.L01's Make is in C and ends in G).
  { id: "verse2", type: "verse", bars: 8 },
  // A minor through E7, C major's relative minor (U17.L03's Make is in C and ends there).
  { id: "bridge", type: "bridge", bars: 8 },
  // F, then G, a whole step up with no door: U17.L04's chorus (its Make is in F).
  { id: "lift", type: "lift", bars: 8, key: { tonic: "F", mode: "major" } },
  // D: the first chorus a whole step up. U17.L02's Make is in C and lifts its own last chorus, which plays here, so the
  // section keeps the song's key for the take; Oak's key plans and `chordsChorus2` carry the D.
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 8, key: { tonic: "D", mode: "major" } },
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
 * (`melChorus`; `chordsChorus2` for a second chorus that plays something else), `silence` where it rests, and one
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

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- Keys (every flavour) ------------------------------------------------------------------------------------
//
// One key a bar for the whole song. The tune's octave keeps each section's numbers where the lessons wrote them: G3
// for the end of the second verse (U17.L01: its 7 is the G above middle C), A3 harmonic minor for the bridge
// (U17.L03), F4 then G4 for the lift (U17.L04), D4 for the last chorus (U17.L02). The bass sits two octaves under C4,
// with G1, A1 and F1 as its low homes.

type KeyId = "C" | "Gv" | "Am" | "F" | "Gl" | "D";
const KEYS: Readonly<Record<KeyId, { mel: string; bass: string }>> = {
  C: { mel: "C4:major", bass: "C2:major" },
  Gv: { mel: "G3:major", bass: "G1:major" },
  Am: { mel: "A3:harmonic:minor", bass: "A1:harmonic:minor" },
  F: { mel: "F4:major", bass: "F1:major" },
  Gl: { mel: "G4:major", bass: "G1:major" },
  D: { mel: "D4:major", bass: "D2:major" },
};
const KEY_OF: Readonly<Record<SectionId, readonly KeyId[]>> = {
  intro: ["C", "C", "C", "C"],
  verse1: ["C", "C", "C", "C", "C", "C", "C", "C"],
  chorus1: ["C", "C", "C", "C", "C", "C", "C", "C"],
  verse2: ["C", "C", "C", "C", "C", "C", "Gv", "Gv"],
  bridge: ["Am", "Am", "Am", "Am", "Am", "Am", "Am", "Am"],
  lift: ["F", "F", "F", "F", "Gl", "Gl", "Gl", "Gl"],
  chorus2: ["D", "D", "D", "D", "D", "D", "D", "D"],
  outro: ["D", "D", "D", "D", "D", "D", "D", "D"],
};
/** A key plan after `arrange()`: one entry a bar for the whole song, runs written with `!`. */
function keyPlan(which: "mel" | "bass"): string {
  const keys = SECTIONS.flatMap((s) => KEY_OF[s.id].map((k) => KEYS[k][which]));
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
const MEL_KEYS = keyPlan("mel");
const BASS_KEYS = keyPlan("bass");

// ---- Harmony (every flavour) ---------------------------------------------------------------------------------
//
// One chord a bar. `r` is the root as a degree of the bar's key on the bass's key plan (C2, G1, A1 harmonic minor, F1,
// D2): the choruses' 0 4 5 3 is C2 G2 A2 F2 in C and D2 A2 B2 G2 in D, one const lifted by the key plan, as U17.L02's
// bass is. Voicings are note names, close: low (B♭2–A3) in the intro, verses, bridge and lift, under a tune from C4
// up; high (E3–E4) in the choruses and the ending, under a tune that climbs to E5 and F♯5. The four-note set: C6,
// Am7, F6, G7 (V of C), G6 (I in G, IV in D), D7 (V of G), E7 (V of A minor), Dm7, B♭6, C7 (V of F), Em7, D6, A7,
// Bm7. Pop and indie play the triads, and D7 and E7 as the unit writes them (the door's V7, the bridge's V7).

type ChordName =
  | "C"
  | "Am"
  | "F"
  | "G7"
  | "G"
  | "D7"
  | "E7"
  | "Dm"
  | "Bb"
  | "C7"
  | "Em"
  | "Dv"
  | "D"
  | "A"
  | "Bm";
interface Voicing {
  low: string;
  high?: string;
}
const CHORD: Readonly<Record<ChordName, { triad: Voicing; four: Voicing }>> = {
  C: { triad: { low: "c3,e3,g3", high: "g3,c4,e4" }, four: { low: "c3,e3,g3,a3", high: "e3,g3,a3,c4" } },
  Am: { triad: { low: "c3,e3,a3", high: "a3,c4,e4" }, four: { low: "a2,c3,e3,g3", high: "g3,a3,c4,e4" } },
  F: { triad: { low: "c3,f3,a3", high: "f3,a3,c4" }, four: { low: "c3,d3,f3,a3", high: "f3,a3,c4,d4" } },
  // High, under the chorus tune's D4 in its second bar.
  G7: { triad: { low: "b2,d3,g3", high: "d3,g3,b3" }, four: { low: "b2,d3,f3,g3", high: "d3,f3,g3,b3" } },
  G: { triad: { low: "b2,d3,g3", high: "g3,b3,d4" }, four: { low: "b2,d3,e3,g3", high: "g3,b3,d4,e4" } },
  D7: { triad: { low: "c3,d3,f#3,a3" }, four: { low: "c3,d3,f#3,a3" } },
  E7: { triad: { low: "b2,d3,e3,g#3" }, four: { low: "b2,d3,e3,g#3" } },
  Dm: { triad: { low: "a2,d3,f3" }, four: { low: "a2,c3,d3,f3" } },
  Bb: { triad: { low: "bb2,d3,f3" }, four: { low: "bb2,d3,f3,g3" } },
  C7: { triad: { low: "c3,e3,g3" }, four: { low: "bb2,c3,e3,g3" } },
  Em: { triad: { low: "b2,e3,g3" }, four: { low: "b2,d3,e3,g3" } },
  // D as G's V at the end of the lift.
  Dv: { triad: { low: "d3,f#3,a3" }, four: { low: "c3,d3,f#3,a3" } },
  D: { triad: { low: "f#3,a3,d4" }, four: { low: "f#3,a3,b3,d4" } },
  A: { triad: { low: "e3,a3,c#4" }, four: { low: "e3,g3,a3,c#4" } },
  Bm: { triad: { low: "f#3,b3,d4" }, four: { low: "f#3,a3,b3,d4" } },
};
type Bar = readonly [ChordName, number];
const PROGRESSION: Readonly<Record<SectionId, readonly Bar[]>> = {
  intro: [
    ["C", 0],
    ["G7", 4],
    ["Am", 5],
    ["F", 3],
  ],
  verse1: [
    ["C", 0],
    ["Am", 5],
    ["F", 3],
    ["G7", 4],
    ["C", 0],
    ["Am", 5],
    ["F", 3],
    ["G7", 4],
  ],
  chorus1: [
    ["C", 0],
    ["G7", 4],
    ["Am", 5],
    ["F", 3],
    ["C", 0],
    ["G7", 4],
    ["Am", 5],
    ["F", 3],
  ],
  // Am in bar 6 is the door (vi in C, ii in G), D7 in bar 7 brings G's F♯, G in bar 8 is home.
  verse2: [
    ["C", 0],
    ["Am", 5],
    ["F", 3],
    ["G7", 4],
    ["C", 0],
    ["Am", 5],
    ["D7", 4],
    ["G", 0],
  ],
  bridge: [
    ["Am", 0],
    ["Dm", 3],
    ["E7", 4],
    ["Am", 0],
    ["Am", 0],
    ["Dm", 3],
    ["E7", 4],
    ["Am", 0],
  ],
  lift: [
    ["F", 0],
    ["Dm", 5],
    ["Bb", 3],
    ["C7", 4],
    ["G", 0],
    ["Em", 5],
    ["C", 3],
    ["Dv", 4],
  ],
  chorus2: [
    ["D", 0],
    ["A", 4],
    ["Bm", 5],
    ["G", 3],
    ["D", 0],
    ["A", 4],
    ["Bm", 5],
    ["G", 3],
  ],
  outro: [
    ["D", 0],
    ["A", 4],
    ["Bm", 5],
    ["G", 3],
    ["D", 0],
    ["A", 4],
    ["G", 3],
    ["D", 0],
  ],
};
/** The choruses and the ending sit higher; everything else low. */
const HIGH = new Set<SectionId>(["chorus1", "chorus2", "outro"]);
/** The held chords (`pad:`) come in for the bridge, the last chorus and the ending. */
const PADDED = new Set<SectionId>(["bridge", "chorus2", "outro"]);

// ---- The tune (every flavour) --------------------------------------------------------------------------------
//
// Degrees on the tune's key plan (0 is home, 7 the home above), eight slots a bar, `@` holds. Each section's numbers
// are its lesson's tune, given more rhythm. Verse (U17.L01): E G E | C | F A F | G, then E G E | C E and either F A F |
// G (the first verse stays home, stopping on G over G7) or the same numbers as the end of a phrase read in G, D F♯ D |
// G (the second verse arrives). Chorus (U17.L02): G G A G | G D | A A C C | C A, the second half reaching D5 and E5;
// in D the same numbers sing A A B A | A E | B B D D | D B, up to F♯5. Bridge (U17.L03): E C E | F D F | E G♯ E | A
// in A harmonic minor, half notes and quarters, then the same climb a third higher. Lift (U17.L04): A C A | F A |
// B♭ D B♭ | G in F, written once; the key plan sings it again in G, B D B | G B | C E C | A. Every note held a beat or
// more is a tone of its chord (A over C and over a C triad is a sixth); the D in the verse's first bar is a passing
// eighth. The intro plays the chorus hook's first four bars and a pickup, C D, into the verse; the ending plays the
// hook in D twice and rises to D5.

const INTRO = ["4@2 4 5@3 4@2", "4@2 ~ 4 1@3 ~", "5@2 5 7@3 7@2", "7 5@3 ~@2 0 1"];
const VERSE_HEAD = [
  "2@2 ~ 2 4@2 2 1",
  "0@6 ~@2",
  "3@2 ~ 3 5@2 3@2",
  "4@6 ~@2",
  "2@2 ~ 2 4@2 2 1",
  "0@2 ~@2 2@2 ~@2",
];
/** The first verse stays in C: F A F, then G over G7. */
const VERSE1 = [...VERSE_HEAD, "3@2 ~ 3 5@2 3@2", "4@6 ~@2"];
/** The second verse arrives in G: the same rhythm, D F♯ D over D7, G over G (read in G3). */
const VERSE2 = [...VERSE_HEAD, "4@2 ~ 4 6@2 4@2", "7@6 ~@2"];
const CHORUS = [
  "4@2 4 5@3 4@2",
  "4@2 ~ 4 1@3 ~",
  "5@2 5 7@3 7@2",
  "7 5@5 ~@2",
  "4@2 4 5@3 4@2",
  "4@2 ~ 4 8@3 ~",
  "9@2 9 7@3 5@2",
  "7@2 5@2 3@4",
];
const BRIDGE = [
  "4@4 2@2 4@2",
  "5@4 3@2 5@2",
  "4@4 6@2 4@2",
  "7@8",
  "9@4 7@2 9@2",
  "10@4 9@2 7@2",
  "6@2 8@2 11@4",
  "7@8",
];
/** Four bars, written once: the lift's key plan plays them in F, then in G. */
const LIFT = ["2@2 ~ 2 4@2 2@2", "0@2 ~@2 2@2 ~@2", "3@2 ~ 3 5@2 3@2", "1@6 ~@2"];
const OUTRO = [
  "4@2 4 5@3 4@2",
  "4@2 ~ 4 1@3 ~",
  "5@2 5 7@3 7@2",
  "7 5@5 ~@2",
  "4@2 4 5@3 4@2",
  "4@2 ~ 4 8@3 ~",
  "7@2 5@2 3@4",
  "4@2 7@6",
];

/** Every degree of a bar moved by `k` (the octave double: `k` = -7), holds and rests kept. */
const shift = (bar: string, k: number): string =>
  bar
    .split(" ")
    .map((t) => {
      if (t.startsWith("~")) return t;
      const [n, hold] = t.split("@");
      return `${Number(n) + k}${hold === undefined ? "" : `@${hold}`}`;
    })
    .join(" ");

const MEL: BySection = {
  intro: `n("${bars(INTRO)}")`,
  verse1: `n("${bars(VERSE1)}")`,
  chorus1: `n("${bars(CHORUS)}")`,
  verse2: `n("${bars(VERSE2)}")`,
  bridge: `n("${bars(BRIDGE)}")`,
  lift: `n("${bars(LIFT)}")`,
  chorus2: `n("${bars(CHORUS)}")`,
  outro: `n("${bars(OUTRO)}")`,
};
/** The second line: the last chorus and the ending doubled an octave down on another sound. */
const VOX: BySection = {
  intro: null,
  verse1: null,
  chorus1: null,
  verse2: null,
  bridge: null,
  lift: null,
  chorus2: `n("${bars(CHORUS.map((b) => shift(b, -7)))}")`,
  outro: `n("${bars(OUTRO.map((b) => shift(b, -7)))}")`,
};

// ---- The kits ------------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;
/** The lift's hats: a line whose velocity climbs over its eight bars, into the last chorus. */
const RISING = (mini: string, from = 0.35): string =>
  `s("${mini}").velocity(saw.range(${num(from)}, 1).slow(8))`;

/**
 * A bass bar: `{r}` root, `{f}` fifth, `{t}` third, `{o}` octave of the bar's chord (degrees on the bass's key plan),
 * or `~` for a bar of rest. A function gets the bar's index in its section and the section's length.
 */
type BassBar = string | ((i: number, n: number) => string);

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit in the verses, the bridge and the ending). */
  banks?: Partial<Record<SectionId, string>>;
  /** Four-note chords (jazz-soul, funk, electronic at U17) or triads. */
  depth: "triad" | "four";
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; chords: string; lead: string; vox: string; pad: string };
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
  /** The held chords' rhythm and controls. */
  pad: { struct: string; fx: string };
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
 * Bass bars that change bar by bar. The bass comes in at bar 3 of the intro, drops out for the bar before the first
 * chorus and the bar before the last one (every flavour), and holds the last chord of the ending.
 */
const INTRO_IN =
  (bar: string): BassBar =>
  (i) =>
    i < 2 ? "~" : bar;
const LAST_OUT =
  (bar: string): BassBar =>
  (i, n) =>
    i === n - 1 ? "~" : bar;
const LAST_HELD =
  (bar: string, held: string): BassBar =>
  (i, n) =>
    i === n - 1 ? held : bar;
/** The lift: one groove in F, a busier one from the bar it rises to G, nothing in its last bar. */
const LIFTING =
  (first: string, second: string): BassBar =>
  (i, n) =>
    i === n - 1 ? "~" : i < 4 ? first : second;

/** Pop: the default kit, piano, picked bass, strings; the kick and the bass lock on 1, the "and" of 2 and 3. */
const POP: Kit = {
  bank: "",
  depth: "triad",
  swing: "",
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
    intro: v("<~ ~ [bd ~ ~ bd bd ~ ~ ~] [bd ~ ~ bd bd ~ bd ~]>"),
    verse: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus: v("bd ~ ~ bd bd ~ bd ~"),
    bridge: v("<[bd ~ ~ ~ ~ ~ bd ~]!7 bd>"),
    lift: v("<[bd ~ ~ bd bd ~ ~ ~]!4 [bd ~ bd ~ bd ~ bd ~]!3 bd>"),
    outro: v("<[bd ~ ~ bd bd ~ bd ~]!7 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ sd ~ sd] [~ sd [~ sd] [sd sd]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    // Half time: a cross-stick on 3.
    bridge: v("<[~ ~ rim ~]!7 [~ ~ sd [sd sd]]>"),
    lift: v("<[~ sd ~ sd]!4 [~ [sd,cp] ~ [sd,cp]]!3 [[sd sd sd sd] [sd*8]]>"),
    outro: v("<[~ [sd,cp] ~ [sd,cp]]!7 ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh hh oh]*2", V8),
    bridge: null,
    lift: RISING("<[hh*8]!4 [hh*16]!3 ~>"),
    outro: v("<[[hh hh hh oh]*2]!7 ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    // The ride in quarters under the long chords.
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    // A crash where the lift rises to G, the tambourine from there.
    lift: v("<cr ~ ~ ~ [cr, [~ tb]*4] [[~ tb]*4]!2 ~>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    // The second verse's arrival in G gets its own crash; the last chorus a tambourine in eighths.
    only: { verse2: v("<cr ~ ~ ~ ~ ~ ~ cr>"), chorus2: v("<[cr, tb*8] [tb*8]!3>") },
  },
  bass: {
    intro: INTRO_IN("{r}@3 {r} {r}@4"),
    verse: LAST_OUT("{r}@3 {r} {r}@4"),
    chorus: "{r} {r} {r} {r} {r} {r} {r} {o}",
    // With the kick: 1 and beat 4.
    bridge: "{r}@6 {f}@2",
    lift: LIFTING("{r}@3 {r} {r}@4", "{r} {r} {r} {r} {r} {r} {r} {o}"),
    outro: LAST_HELD("{r} {r} {r} {r} {r} {r} {r} {o}", "{r}@8"),
    only: { verse2: "{r}@3 {r} {r}@4" },
  },
  comp: {
    intro: "<x x [x@3 x@3 x@2] [x@3 x@3 x@2]>",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    bridge: "x@4 x@4",
    lift: "<[x@3 x@3 x@2]!4 [x*8]!3 x>",
    outro: "<[x*8]!7 x>",
  },
  pad: { struct: "x", fx: ".attack(.3).release(.8)" },
};

/** Indie: the rock kit, clean guitar, acoustic lead, organ held chords. 3-3-2 verses, four on the floor choruses. */
const INDIE: Kit = {
  bank: "rockkit",
  depth: "triad",
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", vox: "strings", pad: "organ" },
  gain: {
    kick: 0.47,
    snare: 0.42,
    hats: 0.28,
    perc: 0.24,
    bass: 0.59,
    chords: 0.48,
    lead: 0.92,
    vox: 0.31,
    pad: 0.24,
  },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~]>"),
    verse: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus: v("bd*4"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    lift: v("<[bd ~ ~ bd ~ ~ bd ~]!4 [bd*4]!3 bd>"),
    outro: v("<[bd*4]!7 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ sd ~] [~ ~ sd [sd sd]]>"),
    verse: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!7 [~ ~ rim [sd sd]]>"),
    lift: v("<[~ ~ sd ~]!4 [~ sd ~ sd]!3 [[sd sd sd sd] [sd*8]]>"),
    outro: v("<[~ sd ~ sd]!7 ~>"),
  },
  hats: {
    intro: v("hh*8", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh oh]*4", V8),
    bridge: null,
    lift: RISING("<[hh*8]!4 [[hh oh]*4]!3 ~>"),
    outro: v("<[[hh oh]*4]!7 ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ tb ~ tb]] [~ tb ~ tb]!3>"),
    // The bridge rolls on the floor tom under the guitar's long chords.
    bridge: v("<[cr, [lt ~ lt lt ~ lt ~ ~]] [lt ~ lt lt ~ lt ~ ~]!7>"),
    lift: v("<cr ~ ~ ~ [cr, [~ tb]*4] [[~ tb]*4]!2 ~>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: { verse2: v("<cr ~ ~ ~ ~ ~ ~ cr>"), chorus2: v("<[cr, tb*8] [tb*8]!3>") },
  },
  bass: {
    intro: INTRO_IN("{r}@3 {r}@3 {r}@2"),
    verse: LAST_OUT("{r}@3 {r}@3 {r}@2"),
    chorus: "[{r} {o}]*4",
    bridge: "{r}@8",
    lift: LIFTING("{r}@3 {r}@3 {r}@2", "[{r} {o}]*4"),
    outro: LAST_HELD("[{r} {o}]*4", "{r}@8"),
    only: { verse2: "{r}@3 {r}@3 {r}@2" },
  },
  comp: {
    intro: "<x x [x@3 x@3 x@2] [x@3 x@3 x@2]>",
    verse: "x@3 x@3 x@2",
    chorus: "x*8",
    bridge: "x",
    lift: "<[x@3 x@3 x@2]!4 [x*8]!3 x>",
    outro: "<[x*8]!7 x>",
  },
  pad: { struct: "x", fx: ".attack(.2).release(.6)" },
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A Rhodes comp on beat 1 and the "and" of 2 (the Charleston), both over the bass's root. */
const JAZZ_COMP = "x [~ x] ~ ~";

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, a tenor saxophone doubling the last chorus and the ending,
 * strings holding the chords. Swung eighths and four-note chords (from U03, FLAVOUR_RULES). Cross-stick and the
 * hi-hat on 2 and 4 under the ride in the verses, the snare in the choruses; the bass plays root and fifth in two in
 * the verses and walks root, root, fifth, third in the choruses and the lift.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  depth: "four",
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", vox: "tenor", pad: "strings" },
  gain: {
    kick: 0.24,
    snare: 0.32,
    hats: 0.2,
    perc: 0.2,
    bass: 0.66,
    chords: 0.39,
    lead: 0.52,
    vox: 0.46,
    pad: 0.17,
  },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~] [bd ~ bd ~]>"),
    verse: v("bd ~ bd ~"),
    chorus: v("bd ~ bd ~"),
    bridge: v("bd ~ ~ ~"),
    lift: v("<[bd ~ bd ~]!4 [bd bd bd bd]!3 bd>"),
    outro: v("<[bd ~ bd ~]!7 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ rim ~ rim] [~ rim ~ [sd sd]]>"),
    verse: v("<[~ rim ~ rim]!7 [~ rim ~ [sd sd]]>"),
    chorus: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    // Half time: the snare on 3.
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    lift: v("<[~ rim ~ rim]!4 [~ sd ~ sd]!3 [sd*8]>"),
    outro: v("<[~ sd ~ sd]!7 ~>"),
  },
  // The hi-hat on 2 and 4.
  hats: {
    intro: v("<~ ~ [~ hh ~ hh] [~ hh ~ hh]>"),
    verse: v("~ hh ~ hh"),
    chorus: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    lift: v("<[~ hh ~ hh]!7 ~>"),
    outro: v("<[~ hh ~ hh]!7 ~>"),
  },
  perc: {
    intro: v(`<[${RIDE}] [${RIDE}] [cr, ${RIDE}] [${RIDE}]>`, V8),
    verse: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    chorus: v("<[cr, rd*8] [rd*8]!3>", V8),
    // The ride in quarters.
    bridge: v("<[cr, rd*4] [rd*4]!7>"),
    lift: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, rd*8] [rd*8]!2 ~>`, V8),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!3 [cr, ${RIDE}] [${RIDE}]!2 cr>`, V8),
    only: {
      verse2: v(`<[cr, ${RIDE}] [${RIDE}]!6 [cr, ${RIDE}]>`, V8),
      chorus2: v("<[cr, rd*8, [~ tb]*4] [rd*8, [~ tb]*4]!3>"),
    },
  },
  bass: {
    intro: INTRO_IN("{r}@2 {f}@2"),
    verse: LAST_OUT("{r}@2 {f}@2"),
    chorus: "{r} {r} {f} {t}",
    bridge: "{r}@4",
    lift: LIFTING("{r}@2 {f}@2", "{r} {r} {f} {t}"),
    outro: LAST_HELD("{r} {r} {f} {t}", "{r}@4"),
    only: { verse2: "{r}@2 {f}@2" },
  },
  comp: {
    intro: `<x x [${JAZZ_COMP}] [${JAZZ_COMP}]>`,
    verse: JAZZ_COMP,
    chorus: JAZZ_COMP,
    bridge: "x",
    lift: `<[${JAZZ_COMP}]!7 x>`,
    outro: `<[${JAZZ_COMP}]!7 x>`,
  },
  pad: { struct: "x", fx: ".attack(.4).release(.8)" },
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
 * Funk: Oak's 808, clavinet, finger bass, organ lead, horns doubling the last chorus and the ending, strings holding
 * the chords. Sixteenths, straight, four-note chords (from U06). In the bridge the Rhodes holds the chords over a
 * half-time beat.
 */
const FUNK: Kit = {
  bank: "oak808",
  depth: "four",
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", vox: "horns", pad: "strings" },
  gain: {
    kick: 0.36,
    snare: 0.25,
    hats: 0.15,
    perc: 0.13,
    bass: 0.73,
    chords: 0.7,
    lead: 0.7,
    vox: 0.58,
    pad: 0.22,
  },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v(`<~ ~ [${FK_KICK_V}] [${FK_KICK_V}]>`),
    verse: v(FK_KICK_V),
    chorus: v(FK_KICK_C),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    lift: v(`<[${FK_KICK_V}]!4 [${FK_KICK_C}]!3 bd>`),
    outro: v(`<[${FK_KICK_C}]!7 bd>`),
  },
  snare: {
    intro: v(`<~ ~ [${FK_BACKBEAT}] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd]>`),
    verse: v(`<[${FK_BACKBEAT}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    chorus: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    bridge: v("<[~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~]!7 [~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ sd sd sd sd]>"),
    lift: v(`<[${FK_BACKBEAT}]!4 [${FK_CLAP}]!3 [sd*16]>`),
    outro: v(`<[${FK_CLAP}]!7 ~>`),
  },
  hats: {
    intro: v("hh*16", V16),
    verse: v("hh*16", V16),
    chorus: v("[hh hh hh hh hh hh oh hh]*2", V16),
    bridge: v("hh*8", V8),
    lift: RISING("<[hh*16]!7 ~>", 0.3),
    outro: v("<[[hh hh hh hh hh hh oh hh]*2]!7 ~>", V16),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ cb ~ cb]] [~ cb ~ cb]!3>"),
    bridge: v("<cr ~!7>"),
    lift: v("<cr ~ ~ ~ [cr, [~ cb]*4] [[~ cb]*4]!2 ~>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: { verse2: v("<cr ~ ~ ~ ~ ~ ~ cr>"), chorus2: v("<[cr, [~ cb]*4] [[~ cb]*4]!3>") },
  },
  bass: {
    intro: INTRO_IN(FK_BASS_V),
    verse: LAST_OUT(FK_BASS_V),
    chorus: FK_BASS_C,
    // With the kick: 1 and the "and" of 3.
    bridge: "{r}@10 {f}@6",
    lift: LIFTING(FK_BASS_V, FK_BASS_C),
    outro: LAST_HELD(FK_BASS_C, "{r}@16"),
    only: { verse2: FK_BASS_V },
  },
  comp: {
    intro: `<[${FK_CLAV_V}] [${FK_CLAV_V}] [${FK_CLAV_V}] [${FK_CLAV_V}]>`,
    verse: FK_CLAV_V,
    chorus: FK_CLAV_C,
    bridge: "x",
    lift: `<[${FK_CLAV_V}]!4 [${FK_CLAV_C}]!3 x>`,
    outro: `<[${FK_CLAV_C}]!7 x>`,
  },
  chordSound: { bridge: "rhodes" },
  pad: { struct: "x", fx: ".attack(.3).release(.8)" },
};

// Electronic: the acid line (the TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an
// accent pattern), a sine sub, sawtooth stabs and a supersaw pad. Every eighth of the acid bar sounds the root or its
// octave, so each stab has its root under it.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {r}";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The lift: the same acid, its filter envelope opening wider bar by bar over eight bars. */
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
/** A supersaw struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: Oak's 909 in the intro, the choruses and the lift; the lo-fi kit in the verses, the bridge and the
 * ending. The verses sit on a boom-bap beat over a sine sub and off-beat stabs; the choruses go four on the floor with
 * the acid line and pumping stabs, a supersaw pad swelling under the last one; the bridge drops to half time on the
 * sub and the pad; the lift builds (the acid's filter and the stabs' cutoff open over eight bars, the kick doubles,
 * then a bar with no kick and no bass before the last chorus). A square pluck with a dotted-eighth echo plays the
 * tune, a supersaw the double. Straight, four-note chords (from U06.L10).
 */
const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { verse1: "lofikit", verse2: "lofikit", bridge: "lofikit", outro: "lofikit" },
  depth: "four",
  swing: "",
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
    intro: v("<~ ~ bd*4 bd*4>"),
    verse: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    chorus: v("bd*4"),
    bridge: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!7 bd>"),
    lift: v("<[bd*4]!6 bd*8 ~>"),
    outro: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!7 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ cp ~ cp] [~ cp ~ [cp cp]]>"),
    verse: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    chorus: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ [sd,cp] [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    lift: v("<[~ cp ~ cp]!4 [~ [sd,cp] ~ [sd,cp]]!3 [[sd sd sd sd] [sd*8]]>"),
    outro: v("<[~ sd ~ sd]!7 ~>"),
  },
  hats: {
    intro: v("[~ hh]*4", V8),
    verse: v("hh*8", V8),
    chorus: v("[hh hh oh hh]*4", V16),
    bridge: v("~ hh ~ hh"),
    lift: RISING("<[hh*8]!4 [hh*16]!3 ~>", 0.3),
    outro: v("<[hh*8]!7 ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    verse: v("<cr ~ ~ ~>"),
    chorus: v("<[cr, [~ rd]*4] [[~ rd]*4]!3>"),
    bridge: v("<cr ~!7>"),
    lift: v("<cr ~ ~ ~ cr ~ ~ [~ ~ [lt lt] [ht ht]]>"),
    outro: v("<cr ~ ~ ~ cr ~ ~ cr>"),
    only: { verse2: v("<cr ~ ~ ~ ~ ~ ~ cr>"), chorus2: v("<[cr, rd*8] [rd*8]!3>", V8) },
  },
  bass: {
    intro: INTRO_IN("{r}"),
    verse: LAST_OUT("{r}@10 {r}@6"),
    chorus: ACID_BAR,
    bridge: "{r}",
    lift: LIFTING(ACID_BAR, ACID_BAR),
    outro: LAST_HELD("{r}@10 {r}@6", "{r}"),
    only: { verse2: "{r}@10 {r}@6" },
  },
  comp: {
    intro: "x x x x",
    verse: "[~ x]*4",
    chorus: "x*8",
    bridge: "[~ x]*2",
    lift: "<[[~ x]*4]!4 [x*8]!3 x*16>",
    outro: "<[[~ x]*4]!7 x>",
  },
  chordSound: { intro: "supersaw", outro: "<sawtooth!7 supersaw>" },
  pad: { struct: "x x x x", fx: PAD },
  synth: {
    bassSound: {
      intro: "sine",
      verse: "sine",
      chorus: "sawtooth",
      bridge: "sine",
      lift: "sawtooth",
      outro: "sine",
    },
    bass: { intro: SUB, verse: SUB, chorus: ACID, bridge: SUB, lift: ACID_RISING, outro: SUB },
    chords: {
      intro: PAD,
      verse: STAB,
      chorus: `${STAB}${PUMP}`,
      bridge: STAB,
      lift: ".lpf(saw.range(500, 4000).slow(8)).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)",
      outro: '.lpf(1800).lpenv(2).lpd(.12).lps(0).decay("<.22!7 1.5>").sustain("<.3!7 .6>")',
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.43).delayfeedback(.35)",
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

/** A section's bass line: one bar per chord, the kit's bar with the chord's degrees filled in. */
function bassLine(id: SectionId, bar: BassBar): string {
  const chords = PROGRESSION[id];
  const out = chords.map(([, r], i) => {
    const text = typeof bar === "string" ? bar : bar(i, chords.length);
    const deg: Record<"r" | "f" | "t" | "o", number> = { r, f: r + 4, t: r + 2, o: r + 7 };
    return text.replace(/\{([rfto])\}/g, (_, k: "r" | "f" | "t" | "o") => String(deg[k]));
  });
  return bars(out);
}

/** A section's chords: one bar per chord, voiced by the kit's depth and the section's register. */
function chordLine(id: SectionId, depth: Kit["depth"]): string {
  const out = PROGRESSION[id].map(([name]) => {
    const set = CHORD[name][depth === "four" ? "four" : "triad"];
    return HIGH.has(id) ? (set.high ?? set.low) : set.low;
  });
  return bars(out);
}

/** One flavour's song: the tune first, then its double, the chords, the held chords, the bass and the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${chordLine(id, k.depth)}").struct("${pick(k.comp, id)}").s("${sound}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const pad = mapSections((id) =>
    PADDED.has(id)
      ? `note("${chordLine(id, k.depth)}").struct("${k.pad.struct}").s("${k.sounds.pad}")${k.pad.fx}`
      : null,
  );
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
      MEL,
      `${MEL_KEYS}${sw}.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "vox",
      VOX,
      `${MEL_KEYS}${sw}.s("${k.sounds.vox}")${syn?.vox ?? ""}.gain(${num(k.gain.vox)}).pan(.45).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${sw}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track("pad", pad, `${sw}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`),
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

/** Every take of U17 writes chords, bass and tune together, so each hands over whole sections; Oak keeps the drums. */
const PITCHED: SongPartId[] = ["lead", "chords", "bass"];

export const U17_SONG = defineUnitSong({
  id: "usong.U17",
  unit: "U17",
  version: 1,
  title: "The long way round",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 104,
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
  // By section (AUTHORING §23.6): every U17 Make writes chords, bass and tune, so a take hands over whole sections and
  // Oak keeps the drums there. U17.L02's `arrange()` maps by type: its verse fills the first verse, its chorus the
  // first chorus, its `chorus2` (the lifted one) the second chorus, the last (spec §5.2).
  plan: [
    take(
      "U17.L01",
      ["verse2"],
      PITCHED,
      "oak",
      "Your eight bars play the song's second verse, the one that ends in G major.",
    ),
    take(
      "U17.L02",
      ["verse1", "chorus1", "chorus2"],
      PITCHED,
      "oak",
      "Your verse and chorus play the song's first verse and chorus, and your lifted chorus plays its last chorus.",
    ),
    take(
      "U17.L03",
      ["bridge"],
      PITCHED,
      "oak",
      "Your bridge plays the eight bars after the song's second verse, where the song turns to A minor.",
    ),
    take(
      "U17.L04",
      ["lift"],
      PITCHED,
      "oak",
      "Your bass, with the chords and tune, plays the eight bars before the last chorus: F major, then G major.",
    ),
  ],
  releaseAfter: "U17.CP",
});

export default U17_SONG;
