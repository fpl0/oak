// Jazz song 1, "Two-five street" (docs/design/songs/makes-core-c.md §4.1 "J1"; AUTHORING §23). A swing tune in C,
// 4/4, 132 BPM, 57 bars, played as a jazz record: an intro vamp, the tune (A), a bridge that visits B♭ and F, the tune
// again, a solo chorus, the tune "from the bridge", and a tag ending. Every bar is a seventh chord, and almost every
// four bars is a ii–V–I, the unit's gesture.
//
//   intro 4             a1 8                    bridge (B♭) 4         bridge (F) 4
//   Dm7 G7 Em7 A7       (Dm7 G7 C^7 C^7)×2      Cm7 F7 B♭^7 B♭^7      Gm7 C7sus C7 F6
//
//   a2 8 = a1   solo 8                                   bridge (B♭) 4, bridge (F) 4   a3 8 = a1   outro 4        end 1
//               Dm7 G7 C^7 C^7 Gm7 C7 F^7 F^7                                            Em7 A7 Dm7 G7  C^7
//
// Each section is the loop of one lesson, so Oak plays the lesson's idea before the learner takes it over:
// - The ride cymbal plays the ride pattern (ding, ding-a, ding, ding-a), J1.L01's beat (a side sketch), in every
//   flavour in most of the bars (the tune, the bridges, the solo), and in all of them in jazz-soul and electronic; pop
//   rides in quarters under the tune, indie under the bridges, funk in the solo. The hi-hat closes on 2 and 4 there,
//   except in the solo (eighths in pop, indie and funk, open off-beats in electronic) and electronic's tune sections
//   (eighths).
// - The second half of the bridge is J1.L02's chart in F, with both of its new colours: C7sus floats for a bar (the
//   tune holds F, the 4th), C7 brings the 3rd back (the tune holds E), and the bridge lands on F6 (the tune holds D,
//   the 6th). F6 is Dm7's four notes over F, so the tune returns on Dm7 without a seam.
// - The solo is J1.L03's eight bars landing twice: a ii–V–I into C, then one into F.
// - The first half of the bridge is J1.L04's cycle in B♭, Cm7 F7 B♭maj7; Oak's tune lands on a guide tone at every
//   change (E♭, A, D, A).
// - The tune sections (A) are J1.L05's ii–V–I in C, Dm7 G7 Cmaj7 Cmaj7, twice; in jazz-soul the Rhodes comps them in
//   shells (D F C, G F B, C E B). The tune's first long notes are the guide-tone thread F, F, E.
//
// Every flavour plays the same notes: the tune, the bass root on every downbeat, the chord roots and qualities. A
// flavour is an idiomatic take of the same tune (§10a call 6): pop a piano trio with a cross-stick, indie a guitar
// trio, jazz-soul vibes, Rhodes, upright bass and brushes giving way to a cross-stick, funk a soul-jazz boogaloo on
// organ and clavinet, electronic a lo-fi jazz beat with a jazz-house solo. Every flavour swings (`.swingBy(1/3, 4)`),
// as Oak's jazz-blues and rhythm-changes Bands do in every kit (J1's own Bands swing only in jazz-soul): the unit's
// takes are swung parts the learner writes (every J1 Make declares swing), so a straight song
// would fight them. Jazz-soul and funk colour the major and dominant sevenths
// with a 9th (never a minor seventh: its 9th would sit a half step under the tune's minor 3rd). Wherever a chord is
// struck the bass is sounding its root (jazz-soul comps only on beat 1 and the "and" of 2, while its two-feel and its
// walk hold the root; the other flavours' bass plays roots and octaves only), so F6 never reads as Dm7. The tune and
// the bass hold no note a half step above a sounding chord tone (AUTHORING §13), and the kept tune and bass of the A
// sections clear J1.L05's shells. Nothing pitched is struck on the last swung eighth of a bar except a tune note, so
// no chord or bass note rings over a barline. Gains start from U12's levelled kits; packages/strudel/e2e/songs.pw.ts
// (budget sound-songs.json) sets them, so the learner's line sits on top. Every claim here is read off the evaluated
// events (content/validate/unit-songs.ts, and the scratch audit of the task report).
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const BB_MAJOR = { tonic: "Bb", mode: "major" } as const;
const F_MAJOR = { tonic: "F", mode: "major" } as const;

const SECTIONS = [
  { id: "intro", type: "intro", bars: 4 },
  { id: "a1", type: "a", bars: 8 },
  // The bridge visits B♭ (J1.L04's cycle, its Make in B♭) and F (J1.L02's chart, its Make in F): a key each half.
  { id: "bridge-bb1", type: "bridge", bars: 4, key: BB_MAJOR },
  { id: "bridge-f1", type: "bridge", bars: 4, key: F_MAJOR },
  { id: "a2", type: "a", bars: 8 },
  { id: "solo", type: "solo", bars: 8 },
  // The tune comes back "from the bridge", as a jazz record's last chorus often does.
  { id: "bridge-bb2", type: "bridge", bars: 4, key: BB_MAJOR },
  { id: "bridge-f2", type: "bridge", bars: 4, key: F_MAJOR },
  { id: "a3", type: "a", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
  // One bar of C: the tag stops on G7, and the record lands home.
  { id: "end", type: "outro", bars: 1 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
type Kind = (typeof SECTIONS)[number]["type"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;
/** Something every section of the same kind shares (the A sections, the bridges), with exceptions by id. */
type ByKind<T> = Readonly<Record<Kind, T>> & { readonly only?: Partial<Record<SectionId, T>> };

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const kindOf = (id: SectionId): Kind => (SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number]).type;
/** A section's own exception first (`null` included: the part rests there), else its kind's. */
const pick = <T>(by: ByKind<T>, id: SectionId): T =>
  by.only !== undefined && id in by.only ? (by.only[id] as T) : by[kindOf(id)];

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melA`; `melBridge2` for the second bridge pattern), `silence` where it rests, and one `arrange()` over every
 * section of the song.
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
// One chord a bar, voiced close between B2 and E4, the root lowest or the bass sounding it: Dm7 D F A C, G7 B D F G,
// Cmaj7 C E G B, Em7 E G B D, A7 C♯ E G A, Cm7 C E♭ G B♭, F7 C E♭ F A, B♭maj7 B♭ D F A, Gm7 B♭ D F G, C7sus C F G B♭,
// C7 C E G B♭, F6 F A C D, Fmaj7 F A C E. Jazz-soul and funk add the 9th to the major and dominant sevenths (Cmaj9,
// G9, A9, F9, C9; Fmaj7 and B♭maj7 stay plain, under the tune's A and D). In the A sections jazz-soul comps in shells,
// root, 3rd and 7th, as J1.L05 teaches. Bass roots: D2 G1 C2 E2 A1 C2 F1 B♭1 G1 C2 F1.

type ChordName =
  | "Dm7"
  | "G7"
  | "Cmaj7"
  | "Em7"
  | "A7"
  | "Cm7"
  | "F7"
  | "Bbmaj7"
  | "Gm7"
  | "C7sus"
  | "C7"
  | "F6"
  | "Fmaj7";
interface Chord {
  /** Bass notes: root, fifth (the two-feel's other note), octave. */
  r: string;
  f: string;
  o: string;
  /** Close and low. */
  low: string;
  /** With the 9th (jazz-soul and funk); absent: as `low`. */
  nine?: string;
  /** Root, 3rd, 7th (jazz-soul's A sections). */
  shell?: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  Dm7: { r: "d2", f: "a1", o: "d3", low: "d3,f3,a3,c4", shell: "d3,f3,c4" },
  G7: { r: "g1", f: "d2", o: "g2", low: "b2,d3,f3,g3", nine: "b2,d3,f3,a3", shell: "g2,f3,b3" },
  Cmaj7: { r: "c2", f: "g1", o: "c3", low: "c3,e3,g3,b3", nine: "c3,e3,g3,b3,d4", shell: "c3,e3,b3" },
  Em7: { r: "e2", f: "b1", o: "e3", low: "e3,g3,b3,d4" },
  A7: { r: "a1", f: "e2", o: "a2", low: "c#3,e3,g3,a3", nine: "c#3,e3,g3,b3" },
  Cm7: { r: "c2", f: "g1", o: "c3", low: "c3,eb3,g3,bb3" },
  F7: { r: "f1", f: "c2", o: "f2", low: "c3,eb3,f3,a3", nine: "c3,eb3,g3,a3" },
  Bbmaj7: { r: "bb1", f: "f1", o: "bb2", low: "bb2,d3,f3,a3" },
  Gm7: { r: "g1", f: "d2", o: "g2", low: "bb2,d3,f3,g3" },
  C7sus: { r: "c2", f: "g1", o: "c3", low: "c3,f3,g3,bb3" },
  C7: { r: "c2", f: "g1", o: "c3", low: "c3,e3,g3,bb3", nine: "e3,g3,bb3,d4" },
  F6: { r: "f1", f: "c2", o: "f2", low: "f3,a3,c4,d4" },
  Fmaj7: { r: "f1", f: "c2", o: "f2", low: "f3,a3,c4,e4" },
};
const TWO_FIVE_ONE: ChordName[] = ["Dm7", "G7", "Cmaj7", "Cmaj7"];
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: ["Dm7", "G7", "Em7", "A7"],
  a1: [...TWO_FIVE_ONE, ...TWO_FIVE_ONE],
  "bridge-bb1": ["Cm7", "F7", "Bbmaj7", "Bbmaj7"],
  "bridge-f1": ["Gm7", "C7sus", "C7", "F6"],
  a2: [...TWO_FIVE_ONE, ...TWO_FIVE_ONE],
  solo: [...TWO_FIVE_ONE, "Gm7", "C7", "Fmaj7", "Fmaj7"],
  "bridge-bb2": ["Cm7", "F7", "Bbmaj7", "Bbmaj7"],
  "bridge-f2": ["Gm7", "C7sus", "C7", "F6"],
  a3: [...TWO_FIVE_ONE, ...TWO_FIVE_ONE],
  outro: ["Em7", "A7", "Dm7", "G7"],
  end: ["Cmaj7"],
};
/** The last chord, open: C G B E (with the colour: C6/9, C E A D). */
const END = { plain: "c3,g3,b3,e4", nine: "c3,e3,a3,d4" };

const bars = (b: readonly string[]): string => `<${b.map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// Eight swung eighths to a bar (`@` holds). The A tune's hook is a three-note pickup that lands late on a long note
// (rest, A, C, then F held over Dm7); its long notes on the changes are the guide-tone thread F, F, E (3rd of Dm7, 7th
// of G7, 3rd of Cmaj7), and the second half climbs to B and comes home on E. The bridge sings the hook a step down
// over Cm7 and lands on a guide tone at every change (E♭, A, D, A); over Gm7 it climbs to B♭, then holds F over C7sus
// (the 4th, floating), E over C7 (the 3rd back) and D over F6 (the 6th). The solo is a run of eighths through both
// landings; the outro tags the hook up a step over Em7 and A7, then plays the A tune's first and sixth bars over Dm7
// G7, and the last bar holds E over C.
// No tune note is a half step above a chord tone sounding with it, and none at all above J1.L05's shells in the A
// sections (no E♭, F♯ or C♯ over Dm7; no A♭, F♯ or C over G7; no C♯, F or C over Cmaj7), swung spills included.

const TUNE_A = [
  "~ a4 c5 f5@3 e5 d5",
  "f5@3 d5 b4@2 g4 d5",
  "e5@4 ~ d5 e5 g5",
  "a5@3 g5 e5@4",
  "~ a4 c5 f5@3 a5 g5",
  "f5@3 d5 b4@3 d5",
  "e5@3 g5 b5@2 a5 g5",
  "e5@6 ~@2",
];
const TUNE_BB = ["~ g4 bb4 eb5@3 d5 c5", "a4@3 c5 eb5@2 c5 a4", "d5@3 f5 a5@2 g5 f5", "a4@6 ~@2"];
const TUNE_F = ["~ d5 f5 bb5@3 a5 g5", "f5@4 ~ g5 bb5 g5", "e5@4 ~ g5 bb5 g5", "a5@3 f5 d5@4"];
const TUNE_SOLO = [
  "d5 e5 f5 a5 c6 a5 f5 e5",
  "d5 b4 g4 b4 d5 f5 a5 g5",
  "e5@2 g5 b5 d6@2 b5 a5",
  "g5@3 e5 d5@2 ~ d5",
  "~ d5 f5 a5 bb5@2 a5 g5",
  "e5@2 g5 bb5 a5 g5 e5 c5",
  "a5@3 g5 e5 c5 a4 c5",
  "e5@4 ~@4",
];
const TUNE_OUTRO = ["~ b4 d5 g5@3 f#5 e5", "c#5@3 e5 g5@2 a5 e5", "~ a4 c5 f5@3 e5 d5", "f5@3 d5 b4@3 d5"];

const MEL: BySection = {
  // The trio vamps; the vibes come in with the tune.
  intro: null,
  a1: `note("${bars(TUNE_A)}")`,
  "bridge-bb1": `note("${bars(TUNE_BB)}")`,
  "bridge-f1": `note("${bars(TUNE_F)}")`,
  a2: `note("${bars(TUNE_A)}")`,
  solo: `note("${bars(TUNE_SOLO)}")`,
  "bridge-bb2": `note("${bars(TUNE_BB)}")`,
  "bridge-f2": `note("${bars(TUNE_F)}")`,
  a3: `note("${bars(TUNE_A)}")`,
  outro: `note("${bars(TUNE_OUTRO)}")`,
  end: `note("${bars(["e5@8"])}")`,
};

// ---- The bass lines ---------------------------------------------------------------------------------------------
//
// Jazz-soul plays in two (root on 1, fifth on 3) through the intro, the first two A sections and the bridges, and
// walks four to the bar in the solo, the last A and the outro: the root on 1, its octave on 2, then two notes that
// lead into the next root by step or by a 4th. Every walking note is a chord tone or a 6th or 9th that no chord
// tone sits a half step above (no B under Cmaj7, no E under Dm7 or G7, no A under Gm7 or C7).
const WALK_A = [
  "d2 d3 c3 a2",
  "g2 g1 a1 b1",
  "c2 c3 g2 e2",
  "c2 c3 a2 e2",
  "d2 d3 c3 a2",
  "g2 g1 a1 b1",
  "c2 c3 g2 e2",
  "c2 c3 g2 d2",
];
const WALK_SOLO = [
  "d2 d3 c3 a2",
  "g2 g1 a1 b1",
  "c2 c3 g2 e2",
  "c2 c3 e2 a2",
  "g2 g1 d2 bb1",
  "c2 c3 bb2 g2",
  "f2 f1 a1 c2",
  "f1 f2 c2 d2",
];
const WALK_OUTRO = ["e2 e3 b2 g2", "a2 a1 b1 c#2", "d2 d3 c3 a2", "g2 g1 a1 b1"];

// ---- The kits -----------------------------------------------------------------------------------------------

/** Accents spread over the slots of the pattern to their left (STYLE §11 rule 7), as the Bands write them. */
const V8 = "[1 .86 .94 .86]*2";
const V4 = "1 .86 .92 .86";
const v = (mini: string, velocity?: string): string =>
  velocity ? `s("${mini}").velocity("${velocity}")` : `s("${mini}")`;
/** The ride pattern in eighths: ding, ding-a, ding, ding-a (beats 1 to 4, with the "and" of 2 and of 4), swung. */
const RIDE = "rd ~ rd rd rd ~ rd rd";
/** A crash on the first bar of a section of `n` bars, then the pattern. */
const crashed = (pattern: string, n: number): string => `<[cr, ${pattern}] [${pattern}]!${n - 1}>`;
/**
 * The A sections are not copies of each other (PLAN §7, W2). The second A ends on a longer fill into the solo
 * (`fillInto`), and in the fourth bar of the last A, where the tune lands on C, the drums hit beat 1 and lay out for
 * three beats while the bass and the tune play on (`layOut`): a moment heard once. `layOut` takes the section's bars as
 * `[bar 1, bar 2, bar 3, bar 5, bar 6, bar 7, bar 8]` (one pattern: every bar alike) and the bar that lays out.
 */
const layOut = (bar: string | readonly string[], out: string): string => {
  const b = typeof bar === "string" ? Array.from({ length: 7 }, () => bar) : bar;
  return `<${[...b.slice(0, 3), out, ...b.slice(3)].map((x) => (x === "~" ? "~" : `[${x}]`)).join(" ")}>`;
};
/** The seven bars `layOut` keeps when the eighth fills: six of `bar`, then `fill`. */
const withFill = (bar: string, fill: string): string[] => [...Array.from({ length: 6 }, () => bar), fill];
/** The last A's ride pattern (a crash on its first bar), laying out after beat 1 of bar 4. */
const RIDE_A3 = layOut([`cr, ${RIDE}`, ...Array.from({ length: 6 }, () => RIDE)], "rd ~ ~ ~");
/** The second A's last bar: the snare fills the whole bar into the solo. */
const FILL_INTO = "~ sd [sd sd] [sd sd sd sd]";
/** Swung eighths, as every J1 Make declares them. */
const SWING = ".swingBy(1/3, 4)";

/**
 * A bass bar: `{r}` root, `{f}` fifth, `{o}` octave of the bar's chord, or `~` for a rest; or a whole section of
 * explicit bars (the walking lines).
 */
type BassBar = string | readonly string[];

interface Kit {
  /** `.bank()` for the drum tracks, or "" for the default kit. */
  bank: string;
  /** A different machine in some sections (electronic: Oak's 909 in the solo). */
  banks?: Partial<Record<SectionId, string>>;
  /** The ride on another kit (funk: Oak's 808 has no ride cymbal). */
  rideBank?: string;
  /** Jazz-soul and funk add the 9th to the major and dominant sevenths. */
  nines: boolean;
  /** Jazz-soul comps the A sections in shells. */
  shells: boolean;
  sounds: { bass: string; chords: string; lead: string; pad: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    ride: number;
    bass: number;
    chords: number;
    lead: number;
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
  ride: ByKind<string | null>;
  bass: ByKind<BassBar>;
  /** The chords' rhythm (`struct`) in each section: never on the last eighth of a bar. */
  comp: ByKind<string>;
  chordSound?: Partial<Record<SectionId, string>>;
  /** The pad's rhythm: held a bar (`x`), or struck on every beat to swell after each kick (electronic). */
  padStruct: string;
  /** Synth controls by section (electronic): the bass's sound and filter, the chords' filter and pump, the lines' fx. */
  synth?: {
    bassSound: ByKind<string>;
    bass: ByKind<string>;
    chords: ByKind<string>;
    lead: string;
    pad: string;
  };
}

/**
 * Pop: a piano trio. The default kit with a cross-stick on 2 and 4 under the tune and the snare in the solo, the ride
 * in quarters under the tune and in the ride pattern elsewhere; a picked bass on roots, the piano comping and singing
 * the tune, strings under the bridges and the ending.
 */
const POP: Kit = {
  bank: "",
  nines: false,
  shells: false,
  sounds: { bass: "ebass", chords: "piano", lead: "piano", pad: "strings" },
  gain: { kick: 0.32, snare: 0.14, hats: 0.09, ride: 0.1, bass: 0.61, chords: 0.2, lead: 0.48, pad: 0.1 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    a: v("bd ~ ~ ~ bd ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("bd ~ ~ ~ bd ~ ~ ~"),
    only: { a3: v(layOut("bd ~ ~ ~ bd ~ ~ ~", "bd ~ ~ ~")), end: v("bd") },
  },
  snare: {
    intro: v("~ rim ~ rim"),
    a: v("<[~ rim ~ rim]!7 [~ rim [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!3 [~ ~ [~ sd] [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!3 [~ sd [~ sd] [sd sd]]>"),
    only: {
      a2: v(`<[~ rim ~ rim]!7 [${FILL_INTO}]>`),
      a3: v(layOut(withFill("~ rim ~ rim", "~ rim [~ sd] [sd sd]"), "~")),
      end: null,
    },
  },
  hats: {
    intro: v("~ hh ~ hh"),
    a: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    solo: v("hh*8", V8),
    outro: v("~ hh ~ hh"),
    only: { a3: v(layOut("~ hh ~ hh", "~")), end: null },
  },
  ride: {
    intro: v("rd*4"),
    a: v(crashed("rd*4", 8)),
    bridge: v(crashed(RIDE, 4), V8),
    solo: v(crashed(RIDE, 8), V8),
    outro: v(crashed(RIDE, 4), V8),
    only: {
      a3: v(layOut(["cr, rd*4", "rd*4", "rd*4", "rd*4", "rd*4", "rd*4", "rd*4"], "rd ~ ~ ~")),
      end: v("cr"),
    },
  },
  bass: {
    intro: "{r}@3 {r} {r}@4",
    a: "{r}@3 {r} {r}@4",
    bridge: "{r}@4 {r}@4",
    // With the solo's kick (1, the "and" of 2, 3), then the octave on 4.
    solo: "{r}@3 {r} {r}@2 {o}@2",
    outro: "{r}@3 {r} {r}@4",
    only: { end: "{r}@8" },
  },
  comp: {
    intro: "x ~ ~ x ~ ~ ~ ~",
    a: "x ~ ~ x x ~ ~ ~",
    bridge: "x ~ ~ ~ x ~ ~ ~",
    solo: "x ~ ~ x ~ ~ x ~",
    outro: "x ~ ~ x x ~ ~ ~",
    only: { end: "x" },
  },
  padStruct: "x",
};

/**
 * Indie: a guitar trio. The rock kit in a half-time feel under the tune (snare on 3) and a backbeat in the solo; the
 * clean guitar strums every beat, the acoustic guitar plays the tune, an organ holds the bridges and the ending.
 */
const INDIE: Kit = {
  bank: "rockkit",
  nines: false,
  shells: false,
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", pad: "organ" },
  gain: { kick: 0.39, snare: 0.36, hats: 0.24, ride: 0.2, bass: 0.52, chords: 0.37, lead: 0.76, pad: 0.14 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ bd ~"),
    a: v("bd ~ ~ ~ ~ ~ bd ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    solo: v("bd ~ ~ bd ~ ~ bd ~"),
    outro: v("bd ~ ~ ~ ~ ~ bd ~"),
    only: { a3: v(layOut("bd ~ ~ ~ ~ ~ bd ~", "bd ~ ~ ~")), end: v("bd") },
  },
  snare: {
    intro: v("~ ~ rim ~"),
    a: v("<[~ ~ sd ~]!7 [~ ~ sd [sd sd]]>"),
    bridge: v("<[~ ~ rim ~]!3 [~ ~ rim [sd sd]]>"),
    solo: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    outro: v("<[~ ~ sd ~]!3 [~ ~ sd [sd sd]]>"),
    only: {
      a2: v(`<[~ ~ sd ~]!7 [${FILL_INTO}]>`),
      a3: v(layOut(withFill("~ ~ sd ~", "~ ~ sd [sd sd]"), "~")),
      end: null,
    },
  },
  hats: {
    intro: v("~ hh ~ hh"),
    a: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    solo: v("hh*8", V8),
    outro: v("~ hh ~ hh"),
    only: { a3: v(layOut("~ hh ~ hh", "~")), end: null },
  },
  ride: {
    intro: v("rd*4"),
    a: v(crashed(RIDE, 8), V8),
    bridge: v(crashed("rd*4", 4)),
    solo: v(crashed(RIDE, 8), V8),
    outro: v(crashed(RIDE, 4), V8),
    only: { a3: v(RIDE_A3, V8), end: v("cr") },
  },
  bass: {
    intro: "{r}@6 {r}@2",
    a: "{r}@3 {r}@3 {r}@2",
    bridge: "{r}@8",
    // With the solo's kick (1, the "and" of 2, 4), the root on 3.
    solo: "{r}@3 {o} {r}@2 {o}@2",
    outro: "{r}@3 {r}@3 {r}@2",
    only: { end: "{r}@8" },
  },
  comp: {
    intro: "x ~ x ~ x ~ x ~",
    a: "x ~ x ~ x ~ x ~",
    bridge: "x",
    solo: "x ~ x ~ x ~ x ~",
    outro: "x ~ x ~ x ~ x ~",
    only: { end: "x" },
  },
  padStruct: "x",
};

/** Jazz-soul's Charleston: the Rhodes on beat 1 and on the "and" of 2, while the bass holds the root. */
const CHARLESTON = "x [~ x] ~ ~";
/**
 * The jazz kit's brushes: its snare's sample 2 is a stir, sample 0 a tap. A stir on 1 and 3, a tap on 2 and 4 (and on
 * every hit of a fill).
 */
const BRUSH = '"<[2 0 2 0]!7 [2 0 0 0]>"';
/** The jazz kit's hi-hat sample 1 is the foot (pedal) hi-hat: on 2 and 4. */
const FOOT = `${v("~ hh ~ hh")}.n(1)`;

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, strings under the bridges and the ending. Brushes (a stir on
 * 1 and 3, a tap on 2 and 4) through the intro and the first two A sections; from the bridge on, a cross-stick on 4
 * (the kit's `rim`) and brush taps for the fills and the solo's chatter (all three of the kit's snares are brushes). The hi-hat's foot on 2 and 4 throughout, the ride pattern on top. The bass plays in
 * two, then walks in the solo, the last A and the outro; the Rhodes comps the Charleston, in shells in the A sections.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  nines: true,
  shells: true,
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", pad: "strings" },
  gain: { kick: 0.19, snare: 0.3, hats: 0.19, ride: 0.22, bass: 0.61, chords: 0.35, lead: 0.45, pad: 0.14 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    // Feathered on every beat.
    intro: v("bd*4"),
    a: v("bd*4"),
    bridge: v("bd ~ ~ ~"),
    solo: v("<[bd*4]!3 [bd ~ bd [~ bd]]>"),
    outro: v("bd*4"),
    only: { a3: v(layOut("bd*4", "bd ~ ~ ~")), end: v("bd") },
  },
  snare: {
    intro: `${v("sd*4")}.n(${BRUSH})`,
    a: `${v("<[sd*4]!7 [sd sd [~ sd] [sd sd]]>")}.n(${BRUSH})`,
    bridge: v("<[~ ~ ~ rim]!3 [~ ~ [~ sd] [sd sd]]>"),
    solo: v("<[~ ~ ~ ~ ~ sd ~ ~] [~ ~ ~ sd ~ ~ ~ ~] [~ sd ~ ~ ~ ~ ~ sd] [~ ~ ~ ~ ~ sd ~ sd]>"),
    outro: v("<[~ ~ ~ rim]!3 [~ sd [~ sd] [sd sd]]>"),
    only: {
      a2: `${v("<[sd*4]!7 [sd [sd sd] [sd sd] [sd sd sd sd]]>")}.n(${BRUSH})`,
      a3: v(layOut(withFill("~ ~ ~ rim", "~ rim [~ sd] [sd sd]"), "~")),
      end: null,
    },
  },
  // The hi-hat's foot (the jazz kit's second hi-hat, `n` 1) on 2 and 4.
  hats: {
    intro: FOOT,
    a: FOOT,
    bridge: FOOT,
    solo: FOOT,
    outro: FOOT,
    only: { a3: `${v(layOut("~ hh ~ hh", "~"))}.n(1)`, end: null },
  },
  ride: {
    intro: v(RIDE, V8),
    a: v(crashed(RIDE, 8), V8),
    bridge: v(crashed(RIDE, 4), V8),
    solo: v(crashed(RIDE, 8), V8),
    outro: v(crashed(RIDE, 4), V8),
    only: { a3: v(RIDE_A3, V8), end: v("cr") },
  },
  bass: {
    intro: "{r}@2 {f}@2",
    a: "{r}@2 {f}@2",
    bridge: "{r}@2 {f}@2",
    solo: WALK_SOLO,
    outro: WALK_OUTRO,
    only: { a3: WALK_A, end: "{r}@4" },
  },
  comp: {
    intro: CHARLESTON,
    a: CHARLESTON,
    bridge: CHARLESTON,
    solo: `<[${CHARLESTON}] [~ [~ x] ~ ~]>`,
    outro: CHARLESTON,
    only: { end: "x" },
  },
  padStruct: "x",
};

/**
 * Funk: a soul-jazz boogaloo. Oak's 808 (with a ride from the rock kit, which the 808 lacks), the kick and the finger
 * bass locked on 1, the "and" of 2 and 3, the clavinet on the off-beats between them, the organ singing the tune,
 * strings under the bridges and the ending. The 9th on the major and dominant sevenths (from U06).
 */
const FUNK: Kit = {
  bank: "oak808",
  rideBank: "rockkit",
  nines: true,
  shells: false,
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", pad: "strings" },
  gain: { kick: 0.35, snare: 0.25, hats: 0.15, ride: 0.13, bass: 0.73, chords: 0.7, lead: 0.66, pad: 0.22 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: v("bd ~ ~ ~ ~ ~ ~ ~"),
    a: v("bd ~ ~ bd bd ~ ~ ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ bd ~"),
    outro: v("bd ~ ~ bd bd ~ ~ ~"),
    only: { a3: v(layOut("bd ~ ~ bd bd ~ ~ ~", "bd ~ ~ ~")), end: v("bd") },
  },
  snare: {
    intro: v("~ rim ~ rim"),
    a: v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!3 [~ ~ sd [sd sd]]>"),
    solo: v("<[~ [sd,cp] ~ [sd,cp]]!7 [~ sd [sd sd] [sd sd]]>"),
    outro: v("<[~ sd ~ sd]!3 [~ sd [sd sd] [sd sd]]>"),
    only: {
      a2: v(`<[~ sd ~ sd]!7 [${FILL_INTO}]>`),
      a3: v(layOut(withFill("~ sd ~ sd", "~ sd [~ sd] [sd sd]"), "~")),
      end: null,
    },
  },
  hats: {
    intro: v("~ hh ~ hh"),
    a: v("~ hh ~ hh"),
    bridge: v("~ hh ~ hh"),
    solo: v("hh*8", V8),
    outro: v("~ hh ~ hh"),
    only: { a3: v(layOut("~ hh ~ hh", "~")), end: null },
  },
  ride: {
    intro: v(RIDE, V8),
    a: v(crashed(RIDE, 8), V8),
    bridge: v(crashed(RIDE, 4), V8),
    solo: v(crashed("rd*4", 8)),
    outro: v(crashed(RIDE, 4), V8),
    only: { a3: v(RIDE_A3, V8), end: v("cr") },
  },
  bass: {
    intro: "{r}@2 ~ {o} {r}@2 {o} ~",
    a: "{r}@2 ~ {o} {r}@2 {o} ~",
    bridge: "{r}@6 {o}@2",
    solo: "{r}@2 ~ {o} {r}@2 {o} ~",
    outro: "{r}@2 ~ {o} {r}@2 {o} ~",
    only: { end: "{r}@8" },
  },
  comp: {
    intro: "~ x ~ x ~ x ~ ~",
    a: "~ x ~ x ~ x ~ ~",
    bridge: "x ~ ~ x ~ ~ ~ ~",
    solo: "~ x ~ x ~ x ~ ~",
    outro: "~ x ~ x ~ x ~ ~",
    only: { end: "x" },
  },
  padStruct: "x",
};

// Electronic: a lo-fi jazz beat (the lo-fi kit, a sine sub, soft sawtooth chords, a square pluck with an echo) that
// turns into jazz house for the solo (Oak's 909 four on the floor, the acid line, pumping stabs). Every note of the
// bass is the bar's root or its octave, so each chord has its root under it.
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** A soft sawtooth comp for the lo-fi parts: a short note under a low filter. */
const SOFT = ".lpf(1100).decay(.35).sustain(.3)";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The pump: the on-beat eighth ducked under the kick, as a sidechained record breathes. */
const PUMP = '.postgain("[.6 1]*4")';
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD =
  ".unison(5).detune(.2).attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
/**
 * The 808 kick (funk's `oak808`) rings for seconds with no choke: hits a beat apart pile up, by up to 7 dB and by the
 * tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at 96). A 0.35 s decay keeps
 * its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";

const ELECTRONIC: Kit = {
  bank: "lofikit",
  banks: { solo: "oak909" },
  nines: false,
  shells: false,
  sounds: { bass: "sawtooth", chords: "sawtooth", lead: "square", pad: "supersaw" },
  gain: { kick: 0.33, snare: 0.16, hats: 0.11, ride: 0.1, bass: 0.65, chords: 0.3, lead: 0.43, pad: 0.17 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    // Boom-bap: 1 and 4, with the sub.
    intro: v("bd ~ ~ ~ ~ ~ bd ~"),
    a: v("bd ~ ~ ~ ~ ~ bd ~"),
    bridge: v("bd ~ ~ ~ ~ ~ ~ ~"),
    solo: v("bd*4"),
    outro: v("bd ~ ~ ~ ~ ~ bd ~"),
    only: { a3: v(layOut("bd ~ ~ ~ ~ ~ bd ~", "bd ~ ~ ~")), end: v("bd") },
  },
  snare: {
    intro: v("~ sd ~ sd"),
    a: v("<[~ sd ~ sd]!7 [~ sd ~ [sd sd]]>"),
    bridge: v("<[~ ~ sd ~]!3 [~ ~ sd [sd sd]]>"),
    solo: v("<[~ cp ~ cp]!7 [~ cp [~ cp] [cp cp]]>"),
    outro: v("<[~ sd ~ sd]!3 [~ sd [~ sd] [sd sd]]>"),
    only: {
      a2: v(`<[~ sd ~ sd]!7 [${FILL_INTO}]>`),
      a3: v(layOut(withFill("~ sd ~ sd", "~ sd ~ [sd sd]"), "~")),
      end: null,
    },
  },
  hats: {
    intro: v("hh*8", V8),
    a: v("hh*8", V8),
    bridge: v("~ hh ~ hh"),
    solo: v("[~ oh]*4"),
    outro: v("hh*8", V8),
    only: { a3: v(layOut("hh*8", "~"), V8), end: null },
  },
  ride: {
    intro: v(RIDE, V8),
    a: v(crashed(RIDE, 8), V8),
    bridge: v(crashed(RIDE, 4), V8),
    solo: v(crashed(RIDE, 8), V8),
    outro: v(crashed(RIDE, 4), V8),
    only: { a3: v(RIDE_A3, V8), end: v("cr") },
  },
  bass: {
    intro: "{r}@6 {r}@2",
    a: "{r}@6 {r}@2",
    bridge: "{r}@8",
    // The acid line on every eighth but the last, so a root sounds under every stab.
    solo: "{r} {r} {r} {o} {r} {r} {o} ~",
    outro: "{r}@6 {r}@2",
    only: { end: "{r}@8" },
  },
  comp: {
    intro: "~ x ~ ~ ~ x ~ ~",
    a: "~ x ~ ~ ~ x ~ ~",
    bridge: "x ~ ~ ~ x ~ ~ ~",
    solo: "~ x ~ x ~ x ~ ~",
    outro: "~ x ~ ~ ~ x ~ ~",
    only: { end: "x" },
  },
  chordSound: { end: "supersaw" },
  padStruct: "x x x x",
  synth: {
    bassSound: {
      intro: "sine",
      a: "sine",
      bridge: "sine",
      solo: "sawtooth",
      outro: "sine",
      only: { end: "sine" },
    },
    bass: { intro: SUB, a: SUB, bridge: SUB, solo: ACID, outro: SUB, only: { end: SUB } },
    chords: {
      intro: SOFT,
      a: SOFT,
      bridge: SOFT,
      solo: `${STAB}${PUMP}`,
      outro: SOFT,
      only: { end: ".attack(.05).decay(2).sustain(.5).lpf(1600)" },
    },
    // A dotted-eighth echo at 132 BPM (.34 s).
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.34).delayfeedback(.35)",
    pad: PAD,
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

/** A section's bass line: one bar per chord, the kit's bar with the chord's notes filled in, or explicit bars. */
function bassLine(id: SectionId, bar: BassBar): string {
  const chords = PROGRESSION[id];
  if (typeof bar !== "string") {
    if (bar.length !== chords.length)
      throw new Error(`${id}: ${bar.length} walking bars for ${chords.length} chords`);
    return bars(bar);
  }
  return bars(chords.map((name) => bar.replace(/\{([rfo])\}/g, (_, k: "r" | "f" | "o") => CHORD[name][k])));
}

/** A section's chords: one bar per chord, voiced for the kit (shells in the A sections, 9ths). */
function voicings(id: SectionId, k: Kit): string {
  if (id === "end") return bars([k.nines ? END.nine : END.plain]);
  return bars(
    PROGRESSION[id].map((name) => {
      const c = CHORD[name];
      if (k.shells && kindOf(id) === "a" && c.shell) return c.shell;
      return k.nines ? (c.nine ?? c.low) : c.low;
    }),
  );
}

/** Where the pad holds the chords: the bridges, the outro and the last bar. */
const PADDED = new Set<SectionId>(["bridge-bb1", "bridge-f1", "bridge-bb2", "bridge-f2", "outro", "end"]);

/** One flavour's song: the tune first, then the pad, the chords, the bass and the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank && !k.banks ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    return `note("${voicings(id, k)}").struct("${pick(k.comp, id)}").s("${sound}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const pad = mapSections((id) =>
    PADDED.has(id) ? `note("${voicings(id, k)}").struct("${k.padStruct}")` : null,
  );
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
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: BySection): BySection =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(k.banks?.[id] ?? k.bank) ? `${p}${KICK_808}` : p;
    });
  const rideBank = k.rideBank ? `.bank("${k.rideBank}")` : bank;
  const tracks = [
    track(
      "mel",
      MEL,
      `${SWING}.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`,
    ),
    track(
      "pad",
      pad,
      `${SWING}.s("${k.sounds.pad}")${syn?.pad ?? ".attack(.3).release(.6)"}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${SWING}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track(
      "bass",
      bass,
      `${SWING}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    track("kick", kick808(drums(k.kick)), `${bank}${SWING}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare), `${bank}${SWING}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats), `${bank}${SWING}.gain(${num(k.gain.hats)})`),
    track("drums", drums(k.ride), `${rideBank}${SWING}.gain(${num(k.gain.ride)})`),
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

/** J1.L02–L04 write chords and a bass (and may add a tune): each hands over whole sections, and Oak keeps the drums. */
const PITCHED: SongPartId[] = ["lead", "chords", "bass"];

export const J1_SONG = defineUnitSong({
  id: "usong.J1",
  unit: "J1",
  version: 2,
  title: "Two-five street",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 132,
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
    { id: "hats", label: "hats", role: "drums", sounds: ["hh", "oh"], name: "Hi-hat", plainName: "Hi-hat" },
    // The kit's timekeeping line (STYLE §2 `drums`), as J1.L01's sketch writes it: `drums: s("rd …")`.
    {
      id: "ride",
      label: "drums",
      role: "drums",
      sounds: ["rd", "cr", "lt", "mt", "ht"],
      name: "Ride cymbal",
      plainName: "Ride cymbal",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // J1.L01 is a side step: its Make is a ride cymbal and a hi-hat alone, which sit 8 to 9 LU under the song's band
  // wherever the tune plays, in every flavour (songs.pw.ts: −27.7 LUFS against −19 to −20; the rule is at most 3 LU
  // under), and no gain brings the band that low without taking the whole song under its flavours' floors. J1.L02–L04
  // write chords and a bass, so each takes whole sections (the chords silence Oak's tune, pad and bass there) where
  // its Make's key is: the F and B♭ halves of both bridges, and the solo in C. J1.L05 writes only the Rhodes, on the A
  // sections' own changes, so Oak's tune and bass keep playing over its shells (oakKeeps, clash-checked). Every take
  // opens with its own starter: no earlier take's code is in today's key, or on today's changes (see the task report).
  plan: [
    {
      lesson: "J1.L01",
      kind: "side",
      reason:
        "A ride cymbal and a hi-hat alone are too quiet under the song's full band, so this beat stays a sketch of its own.",
    },
    take(
      "J1.L02",
      ["bridge-f1", "bridge-f2"],
      PITCHED,
      "oak",
      "Your four-bar chart in F plays the second half of both bridges, where the song visits F.",
    ),
    take(
      "J1.L03",
      ["solo"],
      PITCHED,
      "oak",
      "Your eight bars of chords and bass become the solo section, in the middle of the song.",
    ),
    take(
      "J1.L04",
      ["bridge-bb1", "bridge-bb2"],
      PITCHED,
      "oak",
      "Your tune on the guide tones plays the first half of both bridges, where the song visits B♭.",
    ),
    take(
      "J1.L05",
      ["a1", "a2", "a3"],
      ["chords"],
      "oak",
      "Your left-hand chords comp with Oak's tune and bass in all three A sections of the song.",
      ["lead", "bass"],
    ),
  ],
  // J1 has no checkpoint of its own (J.CP1 covers J1 and J2) and no capstone: the song is released after its last
  // lesson, as U08's, U12's and U15's are (AUTHORING §23.6).
  releaseAfter: "J1.L05",
});

export default J1_SONG;
