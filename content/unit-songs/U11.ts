// Song 11, "Down on C" (docs/design/songs/makes-core-b.md "U11 song (blues)"; AUTHORING §23). C blues, 4/4,
// 100 BPM, 64 bars: the unit on the pentatonic and the blues gets a song that grows into a full blues as it plays.
//
//   intro 4 | vamp 4 | vamp 4 | chorus 12 | chorus 12 (in G) | chorus 12 | chorus 12 | outro 4
//   Am7 | C F C F | C7 F7 C7 F7 | the twelve bars | the quick change in G | the quick change, shuffled |
//   the twelve bars, shuffled, riff and answers | C7 F7 C7–G7 C7
//
// The song tells the unit in order, so the learner takes it over from left to right. It opens on a guitar riff alone,
// on the A minor pentatonic over A minor (U11.L02: the intro carries that key). The band drops into C for a vamp on
// C and F in plain chords, the riff's E♭ stepping up into E (U11.L03: blue notes; the vamp carries the Make's key, C
// major pentatonic); the vamp comes back with every chord a dominant seventh, C7 and F7 (U11.L04). Then four
// choruses of twelve bars: the twelve bars as U11.L05 writes them; a chorus in G with the quick change (IV in bar
// 2) and the turnaround (bars 11–12 to V) of U11.L06, reached by holding chorus 1's last chord, G7, as the new home;
// back in C, the band falls into a shuffle (swung eighths, U11.L07) on U11.L07's own changes; and the last chorus is
// a riff that calls in bars 1–2 of every line while a second line answers, each time differently (U11.L08). A short
// ending tags the riff and lands on C. U11.L01 (the major pentatonic over C G Am F) has no place in a blues on C, F
// and G, so it stays a side step.
//
// Choruses 1–3 carry a tune that sings in bars 1–2, 5–6 and 9–10 (the blues' A A B) and a guitar riff that answers in
// the bars between; the tune is kept over the learner's chords in choruses 1–3 (`oakKeeps`), so its notes are
// chosen to clear any C7, F7, G7 and D7 a learner's `.voicing()` plays, not only Oak's: over C7 it uses C D E♭ G
// (E♭ always above the chord's E), over F7 C D E♭ G A, over G7 A D F, over D7 A D F♯.
//
// Every flavour plays the same notes (tune, riff, answers, bass roots on every downbeat, chord roots); a flavour
// changes sounds, grooves, comp and bass rhythms, and chord colour. The blues sections play dominant sevenths in every
// flavour, as the blues Bands do (content/bands/index.ts: the blues is made of them, whatever a kit's depth
// elsewhere); the first vamp plays triads in pop and indie and adds the 9th (Cadd9, Fadd9) in jazz-soul, funk and
// electronic (four-note chords from U03, U06 and U06.L10). Swing follows the kits' staging: jazz-soul swings
// everywhere (from U03); the other four play straight until the third chorus and shuffle from there to the end, as
// every kit's blues Band shuffles (contracts §5.10: a shuffle swings in every kit). The learner's straight riffs of
// U11.L02–L06 land in straight sections. In a swung section no chord or bass note starts on the last eighth of a bar,
// so swing never drags one over the barline. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top. Every claim here is read off
// the evaluated events (content/validate/unit-songs.ts).
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type KeySpec,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const A_MINOR: KeySpec = { tonic: "A", mode: "minor" };
const C_MAJOR_PENTATONIC: KeySpec = { tonic: "C", mode: "major pentatonic" };
const G_BLUES: KeySpec = { tonic: "G", mode: "blues" };

const SECTIONS = [
  // U11.L02's riff is on A minor pentatonic over A minor: the intro is in A minor.
  { id: "intro", type: "intro", bars: 4, key: A_MINOR },
  // U11.L03's Make is in C major pentatonic, the scale its blue note is added to.
  { id: "vamp1", type: "vamp", bars: 4, key: C_MAJOR_PENTATONIC },
  { id: "vamp2", type: "vamp", bars: 4 },
  { id: "chorus1", type: "chorus", bars: 12 },
  // U11.L06's blues is in G.
  { id: "chorus2", type: "chorus", bars: 12, key: G_BLUES },
  { id: "chorus3", type: "chorus", bars: 12 },
  { id: "chorus4", type: "chorus", bars: 12 },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
type BySection<T> = Readonly<Record<SectionId, T>>;

/** The sections that shuffle in every kit (jazz-soul swings all of them). */
const SHUFFLE = new Set<SectionId>(["chorus3", "chorus4", "outro"]);
const SWING = ".swingBy(1/3, 4)";

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const mapSections = <T>(f: (id: SectionId) => T): BySection<T> =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, T>;

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `melChorus2` for a later chorus that plays something else), `silence` where it rests, and one
 * `arrange()` over every section of the song.
 */
function track(
  label: string,
  by: BySection<string | null>,
  tail: string,
): { consts: string[]; line: string } {
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
// A bar holds one chord, or two (a half bar each). Voiced close round C4 as the blues Bands voice them, so each change
// moves a voice a half step or a step (C7 E G B♭ C, F7 E♭ F A C, G7 F G B D: the 3rds and 7ths slide); the lifted
// choruses (2 and 4) and funk's clavinet play the same chords a few notes higher. Bass roots C2 F2 G1 (D2 for V in
// G, A1 for the intro), with the 3rd, 5th, 6th, ♭7, octave and 9th above them for the lines that walk or boogie.

type ChordName = "Am7" | "C" | "F" | "C7" | "F7" | "G7" | "D7";
type Tone = "r" | "t" | "f" | "s" | "b" | "o" | "n";
interface Chord {
  bass: Readonly<Record<Tone, string>>;
  low: string;
  high: string;
  /** Pop and indie play the first vamp's chords as triads. */
  triad?: string;
  /** The final chord, with its 9th, for the kits that colour it. */
  ninth?: string;
}
const C_BASS = { r: "c2", t: "e2", f: "g2", s: "a2", b: "bb2", o: "c3", n: "d2" } as const;
const F_BASS = { r: "f2", t: "a2", f: "c3", s: "d3", b: "eb3", o: "f3", n: "g2" } as const;
const CHORD: Readonly<Record<ChordName, Chord>> = {
  Am7: {
    bass: { r: "a1", t: "c2", f: "e2", s: "f#2", b: "g2", o: "a2", n: "b1" },
    low: "g3,a3,c4,e4",
    high: "a3,c4,e4,g4",
    triad: "a3,c4,e4",
  },
  C: { bass: C_BASS, low: "e3,g3,c4,d4", high: "g3,c4,d4,e4", triad: "e3,g3,c4" },
  F: { bass: F_BASS, low: "f3,a3,c4,g4", high: "a3,c4,f4,g4", triad: "f3,a3,c4" },
  C7: { bass: C_BASS, low: "e3,g3,bb3,c4", high: "bb3,c4,e4,g4", ninth: "e3,bb3,d4,g4" },
  F7: { bass: F_BASS, low: "eb3,f3,a3,c4", high: "a3,c4,eb4,f4" },
  G7: {
    bass: { r: "g1", t: "b1", f: "d2", s: "e2", b: "f2", o: "g2", n: "a1" },
    low: "f3,g3,b3,d4",
    high: "b3,d4,f4,g4",
  },
  D7: {
    bass: { r: "d2", t: "f#2", f: "a2", s: "b2", b: "c3", o: "d3", n: "e2" },
    low: "f#3,a3,c4,d4",
    high: "c4,d4,f#4,a4",
  },
};

type Bar = readonly ChordName[];
const TWELVE: Bar[] = [
  ["C7"],
  ["C7"],
  ["C7"],
  ["C7"],
  ["F7"],
  ["F7"],
  ["C7"],
  ["C7"],
  ["G7"],
  ["F7"],
  ["C7"],
  ["G7"],
];
const QUICK_IN_C: Bar[] = [
  ["C7"],
  ["F7"],
  ["C7"],
  ["C7"],
  ["F7"],
  ["F7"],
  ["C7"],
  ["C7"],
  ["G7"],
  ["F7"],
  ["C7", "F7"],
  ["C7", "G7"],
];
/** U11.L06's blues in G: the quick change and the turnaround that ends on V. */
const QUICK_IN_G: Bar[] = [
  ["G7"],
  ["C7"],
  ["G7"],
  ["G7"],
  ["C7"],
  ["C7"],
  ["G7"],
  ["G7"],
  ["D7"],
  ["C7"],
  ["G7", "C7"],
  ["G7", "D7"],
];
const HARMONY: BySection<Bar[]> = {
  intro: [["Am7"], ["Am7"], ["Am7"], ["Am7"]],
  vamp1: [["C"], ["F"], ["C"], ["F"]],
  vamp2: [["C7"], ["F7"], ["C7"], ["F7"]],
  chorus1: TWELVE,
  chorus2: QUICK_IN_G,
  chorus3: QUICK_IN_C,
  chorus4: TWELVE,
  outro: [["C7"], ["F7"], ["C7", "G7"], ["C7"]],
};

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- The tune, the riff and the answers (every flavour) -----------------------------------------------------
//
// Eighth notes to a bar (`@` holds). The riff opens the song over a light beat, on the A minor pentatonic, low on the
// guitar; in the first vamp it turns to C, its E♭ stepping up into E (the blue 3rd into the 3rd), in the second it
// runs up the blues scale. In choruses 1–3 the tune sings two bars and the riff answers two (A, A, B): the tune's
// held notes are E♭ over C7 and F7, D and G, then D and F over G7, E♭ and A over F7. Chorus 2 sings the first phrase
// up a fifth, in G (D G B♭ A), and a last phrase of its own over D7 and C7 (A, D; G, C). Chorus 4 is
// U11.L08's idea: one riff calls in bars 1–2 of every line on the tune's part, and the second line answers each time
// with a new figure. The ending tags the call and holds C.

const INTRO_RIFF = [
  "a2 ~ c3 a2 d3 ~ e3 ~",
  "g3 ~ e3 d3 c3 ~ a2 ~",
  "a2 ~ c3 a2 d3 ~ e3 ~",
  "g3 ~ e3 d3 c3 d3 e3 g3",
];
const VAMP_RIFF = ["c3 ~ c3 eb3 e3 ~ g3 ~", "a3 ~ c4 a3 g3 ~ eb3 ~"];
const BLUES_RIFF = ["c3 ~ eb3 f3 gb3 g3 ~ eb3", "f3 ~ eb3 c3 eb3 f3 ~ c3"];
/** The riff's answer in bars 3–4 and 7–8 of a chorus in C, and its turnaround in bars 11–12. */
const ANSWER_C = ["~ g3 bb3 c4 eb4 e4 ~ c4", "bb3 ~ g3 ~ c3@4"];
const TURN_C = ["~ g3 bb3 c4 eb4 e4 ~ c4", "b3 ~ d4 ~ f4 d4 b3 g3"];
const TURN_C_QUICK = ["c4 ~ bb3 g3 a3 ~ c4 eb4", "e4 ~ c4 bb3 b3 ~ d4 f4"];
const ANSWER_G = ["~ d4 f4 g4 bb4 b4 ~ g4", "f4 ~ d4 ~ g3@4"];
const TURN_G = ["g4 ~ f4 d4 e4 ~ g4 bb4", "b4 ~ g4 f4 f#4 ~ a4 c5"];
const REST2 = ["~", "~"];

const SING_A = ["g4 ~ c5 c5 eb5@2 d5 c5", "d5@2 c5 ~ g4@4"];
const SING_B = ["d5@3 a4 d5 f5@3", "eb5@3 c5 a4@4"];
const SING_A_G = ["d5 ~ g5 g5 bb5@2 a5 g5", "a5@2 g5 ~ d5@4"];
const SING_B_G = ["a5@3 f#5 d5@4", "g5@3 e5 c5@4"];
/** U11.L08's call: the same two bars in every line. */
const CALL = ["c5 ~ eb5 f5 ~ eb5 c5 bb4", "c5@3 g4 ~ ~ ~ ~"];
const ANSWERS = [
  ["~ g4 bb4 c5 ~ bb4 g4 eb4", "e4@4 c4@4"],
  ["~ eb5 d5 c5 ~ bb4 g4 ~", "g4@2 a4 g4 e4@4"],
  ["~ c5 bb4 g4 e4 ~ c4 ~", "b3@2 d4 f4 g4@4"],
];

const chorusOf = (
  sing: string[],
  answer: string[],
  third: [string[], string[]],
  turn: string[],
): string[] => [...third[0], ...answer, ...third[1], ...answer, ...sing, ...turn];

const MEL: BySection<string | null> = {
  intro: null,
  vamp1: null,
  vamp2: null,
  chorus1: `note("${bars(chorusOf(SING_B, REST2, [SING_A, SING_A], REST2))}")`,
  chorus2: `note("${bars(chorusOf(SING_B_G, REST2, [SING_A_G, SING_A_G], REST2))}")`,
  chorus3: `note("${bars(chorusOf(SING_B, REST2, [SING_A, SING_A], REST2))}")`,
  chorus4: `note("${bars(chorusOf(CALL, REST2, [CALL, CALL], REST2))}")`,
  outro: `note("${bars([...CALL, "~", "c5@8"])}")`,
};
const RIFF: BySection<string | null> = {
  intro: `note("${bars(INTRO_RIFF)}")`,
  vamp1: `note("${bars([...VAMP_RIFF, ...VAMP_RIFF])}")`,
  vamp2: `note("${bars([...BLUES_RIFF, ...BLUES_RIFF])}")`,
  chorus1: `note("${bars(chorusOf(REST2, ANSWER_C, [REST2, REST2], TURN_C))}")`,
  chorus2: `note("${bars(chorusOf(REST2, ANSWER_G, [REST2, REST2], TURN_G))}")`,
  chorus3: `note("${bars(chorusOf(REST2, ANSWER_C, [REST2, REST2], TURN_C_QUICK))}")`,
  chorus4: null,
  outro: `note("${bars(["~", "~", "~", "c3@8"])}")`,
};
const VOX: BySection<string | null> = {
  intro: null,
  vamp1: null,
  vamp2: null,
  chorus1: null,
  chorus2: null,
  chorus3: null,
  chorus4: `note("${bars([...REST2, ...(ANSWERS[0] as string[]), ...REST2, ...(ANSWERS[1] as string[]), ...REST2, ...(ANSWERS[2] as string[])])}")`,
  outro: `note("${bars(["~", "~", "~ g4 bb4 c5 b4 ~ d5 ~", "~"])}")`,
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V16 = "[1 .86 .94 .86]*4";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;

/**
 * A bass bar: `{r}` root, `{t}` 3rd, `{f}` 5th, `{s}` 6th, `{b}` ♭7, `{o}` octave, `{n}` 9th of the bar's chord, or
 * `~`. `full` is a whole bar on one chord (a function gets the bar's index in its section and the section's length);
 * `half` is half a bar, used twice in a bar of two chords.
 */
interface BassPlan {
  full: string | ((i: number, n: number) => string);
  half: string;
}
const bp = (full: BassPlan["full"], half: string): BassPlan => ({ full, half });
/** The boogie: up the chord and back (root, 3rd, 5th, 6th, ♭7, 6th, 5th, 3rd). */
const BOOGIE = "{r} {t} {f} {s} {b} {s} {f} {t}";
/** The boogie for a swung section: the last two eighths tied, so nothing starts on the last eighth of the bar. */
const BOOGIE_SW = "{r} {t} {f} {s} {b} {s} {f}@2";
const BOOGIE_HALF = "{r} {t} {f} {s}";
/** Half a bar of boogie in a swung section: its last eighth tied, as BOOGIE_SW's. */
const BOOGIE_HALF_SW = "{r} {t} {f}@2";
/** A walk in quarters: up the chord in even bars, down from the octave in odd ones; every note a chord tone. */
const WALK = (i: number): string => (i % 2 === 0 ? "{r}@2 {t}@2 {f}@2 {b}@2" : "{o}@2 {b}@2 {f}@2 {t}@2");
const WALK_HALF = "{r}@2 {f}@2";
/** The last bar of the song: one held root. */
const ENDING = (bar: string) => (i: number, n: number) => (i === n - 1 ? "{r}@8" : bar);

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: the lo-fi kit before the choruses). */
  banks?: Partial<BySection<string>>;
  /** The first vamp's colour: plain triads, or the 9th added (four-note chords from U03/U06/U06.L10). */
  depth: "triad" | "four";
  /** Sections whose chords sit a few notes higher. */
  high: ReadonlySet<SectionId>;
  /** jazz-soul: every track swings in every section (from U03). The others shuffle in SHUFFLE only. */
  swingAll: boolean;
  sounds: { bass: string; chords: string; lead: string; riff: string; vox: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    riff: number;
    vox: number;
  };
  /** content/flavours.ts production: the room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  riffPan: number;
  kick: BySection<string | null>;
  snare: BySection<string | null>;
  hats: BySection<string | null>;
  perc: BySection<string | null>;
  bass: BySection<BassPlan>;
  /** The chords' rhythm (`struct`) in each section; it strikes in both halves of a bar of two chords. */
  comp: BySection<string>;
  chordSound?: Partial<BySection<string>>;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines. */
  synth?: {
    bassSound: BySection<string>;
    bass: BySection<string>;
    chords: BySection<string>;
    lead: string;
    riff: string;
    vox: string;
  };
}

const CHORUS_CRASH = "<cr ~ ~ ~ cr ~ ~ ~ cr ~ ~ ~>";
const LINES = (first: string, rest: string): string =>
  `<[${first}] [${rest}]!3 [${first}] [${rest}]!3 [${first}] [${rest}]!3>`;

/** Pop: the default kit, piano, picked bass, an overdriven guitar riff, an organ tune and horns answering. */
const POP: Kit = {
  bank: "",
  depth: "triad",
  high: new Set(["chorus2", "chorus4"]),
  swingAll: false,
  sounds: { bass: "ebass", chords: "piano", lead: "organ", riff: "crunch", vox: "horns" },
  gain: {
    kick: 0.19,
    snare: 0.15,
    hats: 0.1,
    perc: 0.08,
    bass: 0.5,
    chords: 0.23,
    lead: 0.81,
    riff: 0.75,
    vox: 0.65,
  },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  riffPan: 0.36,
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~]>"),
    vamp1: v("bd ~ ~ bd bd ~ ~ ~"),
    vamp2: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus2: v("bd ~ ~ bd bd ~ bd ~"),
    chorus3: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus4: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("<[bd ~ ~ bd bd ~ ~ ~]!2 [bd ~ ~ ~ bd ~ ~ ~] bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ ~ ~ sd ~ ~ ~] [~ ~ ~ ~ sd sd [sd sd] [sd sd]]>"),
    vamp1: v("~ ~ sd ~ ~ ~ sd ~"),
    vamp2: v("<[~ ~ sd ~ ~ ~ sd ~]!3 [~ ~ sd ~ sd sd [sd sd] [sd sd]]>"),
    chorus1: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!11 [~ ~ [sd,cp] ~ sd sd [sd sd] [sd sd]]>"),
    chorus2: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!11 [~ ~ [sd,cp] ~ sd sd sd sd]>"),
    chorus3: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    chorus4: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!11 [~ ~ [sd,cp] ~ sd sd sd sd]>"),
    outro: v("<[~ ~ sd ~ ~ ~ sd ~]!2 [~ ~ sd ~ sd sd sd sd] ~>"),
  },
  hats: {
    intro: v("<[~ hh]*4 [~ hh]*4 hh*8 hh*8>", V8),
    vamp1: v("hh*8", V8),
    vamp2: v("hh*8", V8),
    chorus1: v("hh hh hh hh hh hh hh oh", V8),
    chorus2: v("[hh oh]*4", V8),
    chorus3: v("hh*8", V8),
    chorus4: v("hh hh hh hh hh hh oh hh", V8),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    vamp1: v("<cr ~ ~ ~>"),
    vamp2: v("<cr ~ ~ ~>"),
    chorus1: v(CHORUS_CRASH),
    chorus2: v(LINES("cr, [~ tb ~ tb]", "~ tb ~ tb")),
    chorus3: v("<[cr, rd*4] [rd*4]!11>"),
    chorus4: v(LINES("cr, [~ tb ~ tb], sh*8", "[~ tb ~ tb], sh*8")),
    outro: v("<cr ~ ~ cr>"),
  },
  bass: {
    intro: bp((i) => ["~", "~", "{r}@3 {r}@3 {r}@2", "{r}@3 {r}@3 {b} {f}"][i] ?? "~", BOOGIE_HALF),
    vamp1: bp("{r}@3 {r} {r}@2 {o} {f}", "{r}@3 {r}"),
    vamp2: bp(BOOGIE, BOOGIE_HALF),
    chorus1: bp(BOOGIE, BOOGIE_HALF),
    chorus2: bp(BOOGIE, BOOGIE_HALF),
    chorus3: bp(BOOGIE_SW, BOOGIE_HALF_SW),
    chorus4: bp("{r} {r} {f} {f} {s} {s} {f}@2", "{r} {r} {f}@2"),
    outro: bp(ENDING(BOOGIE_SW), "{r}@2 {f}@2"),
  },
  comp: {
    intro: "<~ ~ x x>",
    vamp1: "~ x ~ x",
    vamp2: "~ x ~ x",
    chorus1: "~ x ~ x",
    chorus2: "x*8",
    chorus3: "~ x ~ x",
    chorus4: "x ~ x ~ x ~ x ~",
    outro: "<[~ x ~ x]!3 x>",
  },
};

/** Indie: the rock kit, clean guitar chords, a crunch riff, acoustic guitar tune; 3-3-2 vamps, four on the floor in G. */
const INDIE: Kit = {
  bank: "rockkit",
  depth: "triad",
  high: new Set(["chorus2", "chorus4"]),
  swingAll: false,
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", riff: "crunch", vox: "organ" },
  gain: {
    kick: 0.37,
    snare: 0.32,
    hats: 0.21,
    perc: 0.19,
    bass: 0.45,
    chords: 0.37,
    lead: 0.83,
    riff: 0.67,
    vox: 0.54,
  },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  riffPan: 0.4,
  kick: {
    intro: v("<~ ~ [bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ bd ~ ~ bd ~]>"),
    vamp1: v("bd ~ ~ bd ~ ~ bd ~"),
    vamp2: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus1: v("bd ~ ~ bd bd ~ ~ ~"),
    chorus2: v("bd*4"),
    chorus3: v("bd ~ ~ ~ bd ~ ~ ~"),
    chorus4: v("bd*4"),
    outro: v("<[bd*4]!2 [bd ~ ~ ~ bd ~ ~ ~] bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ ~ ~ sd ~ ~ ~] [~ ~ ~ ~ sd ~ [sd sd] [sd sd]]>"),
    vamp1: v("~ ~ ~ ~ sd ~ ~ ~"),
    vamp2: v("<[~ ~ ~ ~ sd ~ ~ ~]!3 [~ ~ ~ ~ sd ~ [sd sd] [sd sd]]>"),
    chorus1: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd [sd sd] [sd sd]]>"),
    chorus2: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    chorus3: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    chorus4: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    outro: v("<[~ ~ sd ~ ~ ~ sd ~]!2 [~ ~ sd ~ sd sd sd sd] ~>"),
  },
  hats: {
    intro: v("<~ ~ hh*8 hh*8>", V8),
    vamp1: v("hh*8", V8),
    vamp2: v("hh*8", V8),
    chorus1: v("hh*8", V8),
    chorus2: v("[hh oh]*4", V8),
    chorus3: v("hh*8", V8),
    chorus4: v("[hh oh]*4", V8),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    // The riff alone, over the floor tom.
    intro: v("<[lt ~ ~ lt ~ ~ lt ~] [lt ~ ~ lt ~ ~ lt ~] cr ~>"),
    vamp1: v("<cr ~ ~ ~>"),
    vamp2: v("<cr ~ ~ ~>"),
    chorus1: v(CHORUS_CRASH),
    chorus2: v(LINES("cr, [~ tb ~ tb]", "~ tb ~ tb")),
    chorus3: v("<[cr, rd*4] [rd*4]!11>"),
    chorus4: v(LINES("cr, tb*8", "tb*8")),
    outro: v("<cr ~ ~ cr>"),
  },
  bass: {
    intro: bp((i) => ["~", "~", "{r}@3 {r}@3 {r}@2", "{r}@3 {r}@3 {b} {f}"][i] ?? "~", BOOGIE_HALF),
    vamp1: bp("{r}*8", "{r}*4"),
    vamp2: bp(BOOGIE, BOOGIE_HALF),
    chorus1: bp(BOOGIE, BOOGIE_HALF),
    chorus2: bp("[{r} {o}]*4", "[{r} {o}]*2"),
    chorus3: bp("{r} {r} {f} {f} {s} {s} {f}@2", "{r} {r} {f}@2"),
    chorus4: bp("{r} {r} {f} {f} {s} {s} {f}@2", "{r} {r} {f}@2"),
    outro: bp(ENDING("{r} {r} {f} {f} {s} {s} {f}@2"), "{r}@2 {f}@2"),
  },
  comp: {
    intro: "<~ ~ x x>",
    vamp1: "x@3 x@3 x@2",
    vamp2: "x@3 x@3 x@2",
    chorus1: "~ x ~ x",
    chorus2: "x*8",
    chorus3: "~ x ~ x",
    chorus4: "x ~ x ~ x ~ x ~",
    outro: "<[~ x ~ x]!3 x>",
  },
};

/** The jazz ride: ding, ding-a, ding, ding-a, swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** The Rhodes on beat 1 and the "and" of 2 (the Charleston), and on beat 4: a hit in each half of the bar. */
const JAZZ_COMP = "x [~ x] ~ x";

/**
 * Jazz-soul: the jazz kit, Rhodes, upright bass, a jazz guitar riff, vibes for the tune, a tenor saxophone answering.
 * Swung eighths everywhere (from U03); a two-feel bass under the opening and the first vamp, a walk from the second.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  depth: "four",
  high: new Set(["chorus2", "chorus4"]),
  swingAll: true,
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", riff: "jazzgtr", vox: "tenor" },
  gain: {
    kick: 0.21,
    snare: 0.32,
    hats: 0.2,
    perc: 0.2,
    bass: 0.63,
    chords: 0.4,
    lead: 0.5,
    riff: 0.52,
    vox: 0.48,
  },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  riffPan: 0.36,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~] [bd ~ bd ~]>"),
    vamp1: v("bd ~ ~ ~"),
    vamp2: v("bd ~ bd ~"),
    chorus1: v("bd ~ bd ~"),
    chorus2: v("bd ~ bd ~"),
    chorus3: v("bd ~ bd ~"),
    chorus4: v("bd ~ bd ~"),
    outro: v("<[bd ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ ~ rim] [~ ~ ~ [sd sd]]>"),
    vamp1: v("~ ~ ~ rim"),
    vamp2: v("<[~ rim ~ rim]!3 [~ rim [~ sd] [sd sd]]>"),
    chorus1: v("<[~ sd ~ sd]!11 [~ sd [~ sd] [sd sd]]>"),
    chorus2: v("<[~ sd ~ sd]!11 [~ sd [~ sd] [sd sd]]>"),
    chorus3: v("<[~ sd ~ sd]!11 [~ sd [sd sd] [sd sd]]>"),
    chorus4: v("<[~ sd ~ sd]!11 [~ sd [sd sd] [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!2 [~ sd [sd sd] [sd sd]] ~>"),
  },
  // The hi-hat's foot on 2 and 4.
  hats: {
    intro: v("<~ ~ [~ hh ~ hh] [~ hh ~ hh]>"),
    vamp1: v("~ hh ~ hh"),
    vamp2: v("~ hh ~ hh"),
    chorus1: v("~ hh ~ hh"),
    chorus2: v("~ hh ~ hh"),
    chorus3: v("~ hh ~ hh"),
    chorus4: v("~ hh ~ hh"),
    outro: v("<[~ hh ~ hh]!3 ~>"),
  },
  perc: {
    intro: v(`<[${RIDE}] [${RIDE}] [cr, ${RIDE}] [${RIDE}]>`, V8),
    vamp1: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    vamp2: v(`<[cr, ${RIDE}] [${RIDE}]!3>`, V8),
    chorus1: v(LINES(`cr, ${RIDE}`, RIDE), V8),
    chorus2: v(LINES("cr, rd*8", "rd*8"), V8),
    chorus3: v(LINES(`cr, ${RIDE}`, RIDE), V8),
    chorus4: v(LINES("cr, rd*8, [~ tb]*4", "rd*8, [~ tb]*4"), V8),
    outro: v(`<[cr, ${RIDE}] [${RIDE}]!2 cr>`, V8),
  },
  bass: {
    intro: bp((i) => ["~", "~", "{r}@4 {f}@4", "{r}@4 {f}@2 {b}@2"][i] ?? "~", WALK_HALF),
    vamp1: bp("{r}@4 {f}@4", WALK_HALF),
    vamp2: bp(WALK(0), WALK_HALF),
    chorus1: bp(WALK, WALK_HALF),
    chorus2: bp(WALK, WALK_HALF),
    chorus3: bp(WALK, WALK_HALF),
    chorus4: bp(WALK, WALK_HALF),
    outro: bp(ENDING("{r}@2 {t}@2 {f}@2 {b}@2"), WALK_HALF),
  },
  comp: {
    intro: "<~ ~ x x>",
    vamp1: "x [~ x] ~ ~",
    vamp2: JAZZ_COMP,
    chorus1: JAZZ_COMP,
    chorus2: JAZZ_COMP,
    chorus3: JAZZ_COMP,
    chorus4: JAZZ_COMP,
    outro: `<[${JAZZ_COMP}]!3 x>`,
  },
};

// Funk, in sixteenths: the kick and the bass lock on 1, the "a" of 1, the "and" of 2 and the "and" of 3; the
// clavinet stabs between them. The shuffle choruses go to swung eighths: the bass bounces root, 5th, ♭7, 6th.
const FK_KICK = "bd ~ ~ bd ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~";
const FK_KICK_LIFT = "bd ~ ~ bd ~ ~ bd ~ bd ~ bd ~ ~ ~ ~ ~";
const FK_BASS = "{r}@2 ~ {r}@3 {o}@3 ~ {r}@2 ~ {b} {f}@2";
const FK_BASS_HALF = "{r}@2 ~ {r} ~ {o}@2 {f}";
const FK_CLAV = "~ ~ x ~ ~ x ~ x ~ ~ x ~ x ~ ~ ~";
const FK_BACKBEAT = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";
const FK_FILL = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ sd sd sd sd";
const FUNK_SHUFFLE = "{r} ~ {f} {b} ~ {s} {f} ~";

/** Funk: Oak's 808, clavinet, finger bass, a clean guitar riff, organ tune, horns answering. Four-note chords. */
const FUNK: Kit = {
  bank: "oak808",
  depth: "four",
  high: new Set(["intro", "vamp1", "vamp2", "chorus1", "chorus2", "chorus3", "chorus4", "outro"]),
  swingAll: false,
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", riff: "cleangtr", vox: "horns" },
  gain: {
    kick: 0.33,
    snare: 0.21,
    hats: 0.12,
    perc: 0.11,
    bass: 0.68,
    chords: 0.52,
    lead: 0.84,
    riff: 0.73,
    vox: 0.67,
  },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  riffPan: 0.36,
  kick: {
    intro: v(`<~ ~ [${FK_KICK}] [${FK_KICK}]>`),
    vamp1: v(FK_KICK),
    vamp2: v(FK_KICK),
    chorus1: v(FK_KICK),
    chorus2: v(FK_KICK_LIFT),
    chorus3: v("bd ~ ~ bd ~ ~ bd ~"),
    chorus4: v("bd ~ ~ bd bd ~ bd ~"),
    outro: v("<[bd ~ ~ bd ~ ~ bd ~]!3 bd>"),
  },
  snare: {
    intro: v(`<~ ~ [${FK_BACKBEAT}] [${FK_FILL}]>`),
    vamp1: v(FK_BACKBEAT),
    vamp2: v(`<[${FK_BACKBEAT}]!3 [${FK_FILL}]>`),
    chorus1: v(`<[${FK_CLAP}]!11 [${FK_FILL}]>`),
    chorus2: v(`<[${FK_CLAP}]!11 [${FK_FILL}]>`),
    chorus3: v("<[~ ~ sd ~ ~ ~ sd ~]!11 [~ ~ sd ~ sd sd sd sd]>"),
    chorus4: v("<[~ ~ [sd,cp] ~ ~ ~ [sd,cp] ~]!11 [~ ~ [sd,cp] ~ sd sd sd sd]>"),
    outro: v("<[~ ~ sd ~ ~ ~ sd ~]!2 [~ ~ sd ~ sd sd sd sd] ~>"),
  },
  hats: {
    intro: v("<[~ hh]*8 [~ hh]*8 hh*16 hh*16>", V16),
    vamp1: v("hh*16", V16),
    vamp2: v("hh*16", V16),
    chorus1: v("[hh hh hh hh hh hh oh hh]*2", V16),
    chorus2: v("[hh hh hh hh hh hh oh hh]*2", V16),
    chorus3: v("hh*8", V8),
    chorus4: v("hh hh hh hh hh hh oh hh", V8),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    vamp1: v("<cr ~ ~ ~>"),
    vamp2: v("<cr ~ ~ ~>"),
    chorus1: v(CHORUS_CRASH),
    chorus2: v(LINES("cr, [~ cb ~ cb]", "~ cb ~ cb")),
    chorus3: v("<cr ~!11>"),
    chorus4: v(LINES("cr, [~ cb]*4, sh*8", "[~ cb]*4, sh*8")),
    outro: v("<cr ~ ~ cr>"),
  },
  bass: {
    intro: bp((i) => ["~", "~", FK_BASS, FK_BASS][i] ?? "~", FK_BASS_HALF),
    vamp1: bp("{r}@2 ~ {r}@3 {o}@3 ~ {r}@3 ~ {f}@2", FK_BASS_HALF),
    vamp2: bp(FK_BASS, FK_BASS_HALF),
    chorus1: bp(FK_BASS, FK_BASS_HALF),
    chorus2: bp(FK_BASS, FK_BASS_HALF),
    chorus3: bp(FUNK_SHUFFLE, "{r} ~ {f}@2"),
    chorus4: bp(FUNK_SHUFFLE, "{r} ~ {f}@2"),
    outro: bp(ENDING(FUNK_SHUFFLE), "{r} ~ {f}@2"),
  },
  comp: {
    intro: "<~ ~ x x>",
    vamp1: FK_CLAV,
    vamp2: FK_CLAV,
    chorus1: FK_CLAV,
    chorus2: FK_CLAV,
    chorus3: "~ x ~ x ~ x ~ ~",
    chorus4: "~ x ~ x ~ x ~ ~",
    outro: "<[~ x ~ x ~ x ~ ~]!3 x>",
  },
  chordSound: { intro: "organ" },
};

// Electronic: the lo-fi kit before the choruses, a sine sub under the opening and the first vamp; the acid line (the
// TB-303 recipe: a sawtooth under a resonant ladder filter whose envelope opens on an accent pattern) comes in on the
// second vamp with its filter opening bar by bar, and drives the choruses over Oak's 909.
// Sawtooth stabs, pumped in the loud choruses; a supersaw pad swells under the riff in the opening and holds the last
// chord. A wavetable pluck plays the riff, a square pluck with a dotted-eighth echo the tune, a supersaw the answers.
const ACID_BAR = "{r} ~ {r} {o} {r} ~ {r} {b} {r} ~ {o} {r} {r} ~ {f} {o}";
const ACID_HALF = "{r} ~ {r} {o} {r} ~ {f} {o}";
/** The shuffle's acid: root and 5th in swung eighths, the last two tied. */
const ACID_SHUFFLE = "{r} {r} {f} {r} {r} {f} {r}@2";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The second vamp builds: the acid line comes in on the root and its octave, its filter opening over four bars. */
const ACID_ROOTS = "{r} ~ {r} {o} {r} ~ {r} {r} {r} ~ {o} {r} {r} ~ {r} {o}";
const ACID_RISING =
  '.lpq(12).ftype("ladder").lpenv(saw.range(1, 4).slow(4)).lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/**
 * The 808 kick (funk's `oak808`, the electronic bridge's) rings for seconds with no choke: hits a beat apart pile up,
 * by up to 7 dB and by the tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at
 * 96). A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** A supersaw pad struck with a slow attack, so it swells; its filter drifts. */
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

const ELECTRONIC: Kit = {
  bank: "oak909",
  banks: { intro: "lofikit", vamp1: "lofikit", vamp2: "lofikit" },
  depth: "four",
  high: new Set(["chorus2", "chorus4"]),
  swingAll: false,
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", riff: "wt_pwm", vox: "supersaw" },
  gain: {
    kick: 0.32,
    snare: 0.14,
    hats: 0.1,
    perc: 0.09,
    bass: 0.75,
    chords: 0.3,
    lead: 0.4,
    riff: 0.93,
    vox: 0.27,
  },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  riffPan: 0.42,
  kick: {
    intro: v("<~ ~ [bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~]>"),
    vamp1: v("bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~"),
    vamp2: v("bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~"),
    chorus1: v("bd*4"),
    chorus2: v("bd*4"),
    chorus3: v("bd*4"),
    chorus4: v("bd*4"),
    outro: v("<[bd*4]!3 bd>"),
  },
  snare: {
    intro: v("<~ ~ [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>"),
    vamp1: v("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~"),
    vamp2: v("<[~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~]!3 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>"),
    chorus1: v("<[~ cp ~ cp]!11 [~ cp [~ sd] [sd sd]]>"),
    chorus2: v("<[~ [sd,cp] ~ [sd,cp]]!11 [~ [sd,cp] [~ sd] [sd sd]]>"),
    chorus3: v("<[~ cp ~ cp]!11 [~ cp [sd sd] [sd sd]]>"),
    chorus4: v("<[~ [sd,cp] ~ [sd,cp]]!11 [~ [sd,cp] [sd sd] [sd sd]]>"),
    outro: v("<[~ cp ~ cp]!2 [~ cp [sd sd] [sd sd]] ~>"),
  },
  hats: {
    intro: v("<[~ hh]*4 [~ hh]*4 hh*8 hh*8>", V8),
    vamp1: v("hh*8", V8),
    vamp2: v("hh*8", V8),
    chorus1: v("[hh hh oh hh]*4", V16),
    chorus2: v("[hh hh oh hh]*4", V16),
    chorus3: v("hh*8", V8),
    chorus4: v("[hh oh]*4", V8),
    outro: v("<[hh*8]!3 ~>", V8),
  },
  perc: {
    intro: v("<~ ~ cr ~>"),
    vamp1: v("<cr ~ ~ ~>"),
    vamp2: v("<cr ~ ~ ~>"),
    chorus1: v(CHORUS_CRASH),
    chorus2: v(LINES("cr, [~ rd]*4", "[~ rd]*4")),
    chorus3: v("<cr ~!11>"),
    chorus4: v(LINES("cr, rd*8", "rd*8"), V8),
    outro: v("<cr ~ ~ cr>"),
  },
  bass: {
    intro: bp((i) => ["~", "~", "{r}@8", "{r}@8"][i] ?? "~", "{r}@4"),
    vamp1: bp("{r}@7 {r}@3 {r}@6", "{r}@8"),
    vamp2: bp(ACID_ROOTS, ACID_HALF),
    chorus1: bp(ACID_BAR, ACID_HALF),
    chorus2: bp(ACID_BAR, ACID_HALF),
    chorus3: bp(ACID_SHUFFLE, "{r} {r} {f}@2"),
    chorus4: bp(ACID_SHUFFLE, "{r} {r} {f}@2"),
    outro: bp(ENDING(ACID_SHUFFLE), "{r} {r} {f}@2"),
  },
  comp: {
    intro: "<~ ~ x x>",
    vamp1: "[~ x]*4",
    vamp2: "[~ x]*4",
    chorus1: "x*8",
    chorus2: "x*8",
    chorus3: "~ x ~ x",
    chorus4: "~ x ~ x",
    outro: "<[~ x ~ x]!3 x>",
  },
  chordSound: { intro: "supersaw", outro: "<sawtooth!3 supersaw>" },
  synth: {
    bassSound: {
      intro: "sine",
      vamp1: "sine",
      vamp2: "sawtooth",
      chorus1: "sawtooth",
      chorus2: "sawtooth",
      chorus3: "sawtooth",
      chorus4: "sawtooth",
      outro: "<sawtooth!3 sine>",
    },
    bass: {
      intro: SUB,
      vamp1: SUB,
      vamp2: ACID_RISING,
      chorus1: ACID,
      chorus2: ACID,
      chorus3: ACID,
      chorus4: ACID,
      outro: ACID,
    },
    chords: {
      intro: PAD,
      vamp1: STAB,
      vamp2: STAB,
      chorus1: `${STAB}${PUMP}`,
      chorus2: `${STAB}${PUMP}`,
      chorus3: STAB,
      chorus4: STAB,
      outro: '.lpf(1800).lpenv(2).lpd(.12).lps(0).decay("<.22!3 1.5>").sustain("<.3!3 .6>")',
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.45).delayfeedback(.35)",
    riff: ".decay(.18).sustain(.25).lpf(2000)",
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

const fill = (text: string, c: ChordName): string =>
  text.replace(/\{([rtfsbon])\}/g, (_, k: Tone) => CHORD[c].bass[k]);

/** A section's bass line: one bar per bar of harmony, the kit's bar with the chord's notes filled in. */
function bassLine(id: SectionId, plan: BassPlan): string {
  const harmony = HARMONY[id];
  const out = harmony.map((bar, i) => {
    if (bar.length === 2) return bar.map((c) => `[${fill(plan.half, c)}]`).join(" ");
    const text = typeof plan.full === "string" ? plan.full : plan.full(i, harmony.length);
    return text === "~" ? "~" : fill(text, bar[0] as ChordName);
  });
  return bars(out);
}

/** A section's chords: one bar per bar of harmony (two halves for two chords), voiced for the kit and section. */
function chordLine(id: SectionId, k: Kit): string {
  const harmony = HARMONY[id];
  const voiceOf = (c: ChordName, last: boolean): string => {
    const chord = CHORD[c];
    if (id === "vamp1" && k.depth === "triad" && chord.triad) return chord.triad;
    if (id === "intro" && k.depth === "triad" && chord.triad) return chord.triad;
    if (last && k.depth === "four" && chord.ninth) return chord.ninth;
    return k.high.has(id) ? chord.high : chord.low;
  };
  const out = harmony.map((bar, i) => {
    const last = id === "outro" && i === harmony.length - 1;
    return bar.map((c) => (bar.length === 2 ? `[${voiceOf(c, last)}]` : voiceOf(c, last))).join(" ");
  });
  return bars(out);
}

/** One flavour's song: the tune first, then the riff, the answers, the chords, the bass and the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const syn = k.synth;
  /** A section's own swing, where the kit does not swing the whole track. */
  const sw = (id: SectionId): string => (!k.swingAll && SHUFFLE.has(id) ? SWING : "");
  const swung = (by: BySection<string | null>): BySection<string | null> =>
    mapSections((id) => {
      const p = by[id];
      return p === null ? null : `${p}${sw(id)}`;
    });
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${chordLine(id, k)}").struct("${k.comp[id]}").s("${sound}")${syn ? syn.chords[id] : ""}${sw(id)}`;
  });
  const bass = mapSections((id) => {
    const line = `note("${bassLine(id, k.bass[id])}")`;
    return `${syn ? `${line}.s("${syn.bassSound[id]}")${syn.bass[id]}` : line}${sw(id)}`;
  });
  /** With `banks`, each section names its machine; otherwise the track does, once. */
  const drums = (by: BySection<string | null>): BySection<string | null> =>
    mapSections((id) => {
      const p = by[id];
      if (p === null) return null;
      const bank = k.banks ? `.bank("${k.banks[id] ?? k.bank}")` : "";
      return `${p}${bank}${sw(id)}`;
    });
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const all = k.swingAll ? SWING : "";
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: ReturnType<typeof drums>): ReturnType<typeof drums> =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(k.banks?.[id] ?? k.bank) ? `${p}${KICK_808}` : p;
    });
  const tracks = [
    track(
      "mel",
      swung(MEL),
      `${all}.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "gtr",
      swung(RIFF),
      `${all}.s("${k.sounds.riff}")${syn?.riff ?? ""}.gain(${num(k.gain.riff)}).pan(${num(k.riffPan)}).room(${num(k.room)})`,
    ),
    track(
      "vox",
      swung(VOX),
      `${all}.s("${k.sounds.vox}")${syn?.vox ?? ""}.gain(${num(k.gain.vox)}).pan(.55).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${all}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${all}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    track("kick", kick808(drums(k.kick)), `${bank}${all}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${bank}${all}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}${all}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc), `${bank}${all}.gain(${num(k.gain.perc)})`),
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

export const U11_SONG = defineUnitSong({
  id: "usong.U11",
  unit: "U11",
  version: 1,
  title: "Down on C",
  meter: "4/4",
  key: { tonic: "C", mode: "blues" },
  bpm: 100,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "riff", label: "gtr", role: "melody", name: "Riff", plainName: "Riff" },
    { id: "vox", label: "vox", role: "melody", name: "Answers", plainName: "Answers" },
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
  // By section from U11.L03 (AUTHORING §23.6): those Makes write chords, bass and riff together, so each takes a
  // whole section's pitched parts and Oak keeps the drums (and, in choruses 1–3, its tune, which clears any
  // `.voicing()` of the chords there). U11.L02 writes the riff alone, so it takes the opening's riff and Oak's band
  // keeps playing under it. U11.L07 and U11.L08 also write the kick, snare and hats.
  plan: [
    {
      lesson: "U11.L01",
      kind: "side",
      reason:
        "This tune is written over the loop C G Am F, which your song never plays, so it stays a sketch of its own.",
    },
    take(
      "U11.L02",
      ["intro"],
      ["riff"],
      "oak",
      "Your riff opens the song, first over a light beat, then with the band on an A minor chord.",
    ),
    // Oak's tune and answers rest in the vamps: kept, so the take claims no cell where nothing plays.
    take(
      "U11.L03",
      ["vamp1"],
      ["chords", "bass", "riff"],
      "oak",
      "Your riff with a bite, over your own C and F chords, plays the four bars after the opening.",
      ["lead", "vox"],
    ),
    take(
      "U11.L04",
      ["vamp2"],
      ["chords", "bass", "riff"],
      "oak",
      "Your two chords, each with a 7th on top, play the four bars just before the first chorus.",
      ["lead", "vox"],
    ),
    // Oak's tune keeps singing over the learner's chorus: its notes clear every C7, F7, G7 and D7 `.voicing()` plays.
    take(
      "U11.L05",
      ["chorus1"],
      ["chords", "bass", "riff"],
      "U11.L04",
      "Your two-chord vamp grows into twelve bars and plays the song's first chorus, under Oak's tune.",
      ["lead", "vox"],
    ),
    take(
      "U11.L06",
      ["chorus2"],
      ["chords", "bass", "riff"],
      "oak",
      "Your twelve bars in G play the second chorus, where the song moves up from C to G.",
      ["lead", "vox"],
    ),
    take(
      "U11.L07",
      ["chorus3"],
      ["kick", "snare", "hats", "chords", "bass", "riff"],
      "oak",
      "Your hats, kick, snare and twelve bars play the third chorus, where the song changes its feel.",
      ["lead", "vox"],
    ),
    // Oak's riff rests in the last chorus (its call is on the tune's part there).
    take(
      "U11.L08",
      ["chorus4"],
      ["kick", "snare", "hats", "chords", "bass", "lead", "vox"],
      "oak",
      "Your riff and its answers play the last chorus, the busiest part of the song.",
      ["riff"],
    ),
  ],
  releaseAfter: "U11.CP",
});

export default U11_SONG;
