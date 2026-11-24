// Song J5, "Home by another door" (docs/design/songs/makes-core-c.md §4 and §4.1, the J5 row; AUTHORING §23). An
// Oak-original jazz ballad in the style of a standard, 4/4, 72 BPM, 48 bars (2:40). Its tune and changes are Oak's;
// the only borrowed tune is Aura Lee (1861, public domain: content/repertoire/aura-lee), quoted by the tenor in the
// solo, as J5.L04's Make plays it.
//
//   intro 8 (B♭)          | a1 8 (G)                       | a2 8 (G)                       |
//   B♭^7 G7 Cm7 B7         | G^7 [Bm7 E7] Am7 D7            | G^7 [Bm7 E7] Am7 D7            |
//   B♭^7 D♭7 Cm7 F7        | G^7 Em7 [Em7 A7] D7            | Bm7 E7 Am7 [Dm7 G7]            |
//   solo 8 (C)                                   | a3 8 (F)                       | outro 8 (F)
//   [Cadd9@3 C♯°7] D7 [G7sus D♭7] Cadd9           | F^7 [Am7 D7] Gm7 C7            | F^7 [Gm7 C7] [Am7 D7] [Gm7 G♭7]
//   Cadd9 [Am7 D7] [G7sus D♭7] [Cadd9 C7]         | F^7 Dm7 B♭m7 E♭7               | Fadd9 [B♭m7 E♭7] Fadd9 Fadd9
//
// The song walks home to F through every door of the unit, and its key plan is itself a ii–V–I: the intro is the
// I–VI–ii–V turnaround in B♭ (IV of F) with both of its dominants traded for their tritone substitutes, B7 for F7
// in bar 4 and D♭7 for G7 in bar 6; its last two bars, Cm7 F7, are the backdoor into G, where the tune starts. The
// A sections in G aim ii–Vs at the chords of the tune (Bm7 E7 at Am7, Em7 A7 at D7), and the second one aims its
// last ii–V, Dm7 G7, at C, where the tenor plays Aura Lee's verse over J5.L04's devices: a passing C♯°7, D♭7 for G7
// sliding into C, a ii–V aimed at G. The solo's last chord turns to C7, V of F, and the last A comes home in F
// through the back door, B♭m7 E♭7, twice. The tag gathers every door once more: a ii–V, an aimed ii–V, the ii and
// G♭7 sliding home, the back door, and F held with its 9th. Keys by section: G (II of F), C (V), F (I).
//
// Each take is the section in the key of its lesson's Make (`sections[].key`): J5.L01's turnaround is the intro in
// B♭; J5.L03's tune in G is the first A; J5.L04's Aura Lee is the solo in C; J5.L02's loop in F is the last A, whose
// back door lands on the tag's F. J5.L01's Make writes chords and bass only, so Oak's lead keeps its intro line
// over it (`oakKeeps`): every note the line holds in bars 2, 4, 6 and 8 is a guide tone that both a dominant and its
// tritone substitute share (B for G7 and D♭7, E♭ for F7 and B7), and none sits a half step from the reference's
// chords or bass (content/validate/unit-songs.ts checks it). Bars 1–2 are bars 5–6, so the same B5 is heard over G7
// and then over D♭7; it sits above the left hand's D♭7 (`lefthand`: B3 E♭4 F4 B♭4, evaluated) as that voicing's own
// B3 does, never a half step over its B♭4 (a learner who swaps G7 alone). F5 would rub against the G7's E4.
//
// Every flavour plays the same notes (tune, bass roots on every downbeat, chords as voiced below); a flavour changes
// sounds, grooves, comp and bass rhythms and swing (§10a call 6: in the jazz track each flavour is an idiomatic take
// of the same tune and changes). The chords are the tune's changes, sevenths and added 9ths, in every flavour, as the J
// track writes them; only jazz-soul swings (1/3, from U03.L01). Pop is a piano ballad, indie a clean-guitar ballad
// over a half-time beat, jazz-soul a brushes trio with Rhodes and vibes, funk a slow jam on the 808, electronic a
// lo-fi beat on the lo-fi kit. Every chord is voiced with its root at the bottom. Where the tune holds the root of
// a major chord (C in the solo, F in the tag) the chord takes its 9th, not its major 7th (a half step under the
// tune) nor its 6th (C6 over the bass's fifth reads as Am7). Gains are levelled by songs.pw.ts (budget sound-songs.json),
// so the learner's line sits on top; they start from U17's levelled kits. Tune and bass hold no note a half step from
// a sounding chord tone (AUTHORING §13); every claim here is read off the evaluated events
// (content/validate/unit-songs.ts).
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const SECTIONS = [
  // J5.L01's turnaround: its Make is in B♭.
  { id: "intro", type: "intro", bars: 8, key: { tonic: "Bb", mode: "major" } },
  // J5.L03's tune: its Make is in G. The second A stays Oak's and turns to C in its last bar.
  { id: "a1", type: "a", bars: 8, key: { tonic: "G", mode: "major" } },
  { id: "a2", type: "a", bars: 8, key: { tonic: "G", mode: "major" } },
  // J5.L04's Aura Lee: its Make is in C.
  { id: "solo", type: "solo", bars: 8, key: { tonic: "C", mode: "major" } },
  // J5.L02's loop: its Make is in F, the song's key.
  { id: "a3", type: "a", bars: 8 },
  { id: "outro", type: "outro", bars: 8 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
type Kind = (typeof SECTIONS)[number]["type"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;
/** Something every section of the same kind shares (the A sections), with exceptions by id. */
type ByKind<T> = Readonly<Record<Kind, T>> & { readonly only?: Partial<Record<SectionId, T>> };

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const kindOf = (id: SectionId): Kind => (SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number]).type;
const pick = <T>(by: ByKind<T>, id: SectionId): T => by.only?.[id] ?? by[kindOf(id)];

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melA`; `melA2` for an A section that plays something else), `silence` where it rests, and one `arrange()` over
 * every section of the song.
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

const bars = (b: readonly string[]): string => `<${b.map((x) => `[${x}]`).join(" ")}>`;

// ---- Harmony (every flavour) ---------------------------------------------------------------------------------
//
// Chords as voiced on every flavour's chords and held-chords lines: four notes, root at the bottom, between G♭2 and
// F♯4, always under the tune. `r f t o` are the bass's root, fifth, third and octave (G1 to E3). D♭7 in the solo is
// voiced without its 5th (A♭ would rub against the tune's A on beat 3 of bars 3 and 7); C♯°7's "fifth" is its own G.

type ChordName =
  | "Bb^7"
  | "G7"
  | "Cm7"
  | "B7"
  | "Db7"
  | "F7"
  | "G^7"
  | "Bm7"
  | "E7"
  | "Am7"
  | "D7"
  | "Em7"
  | "A7"
  | "Dm7"
  | "Cadd9"
  | "C#o7"
  | "Db7s"
  | "G7sus"
  | "C7"
  | "F^7"
  | "Gm7"
  | "Bbm7"
  | "Eb7"
  | "Gb7"
  | "Fadd9";
interface Chord {
  r: string;
  f: string;
  t: string;
  o: string;
  /** The voicing, low to high. */
  v: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  "Bb^7": { r: "bb1", f: "f2", t: "d2", o: "bb2", v: "bb2,f3,a3,d4" },
  G7: { r: "g1", f: "d2", t: "b1", o: "g2", v: "g2,f3,b3,d4" },
  Cm7: { r: "c2", f: "g1", t: "eb2", o: "c3", v: "c3,g3,bb3,eb4" },
  B7: { r: "b1", f: "f#2", t: "d#2", o: "b2", v: "b2,f#3,a3,d#4" },
  Db7: { r: "db2", f: "ab1", t: "f2", o: "db3", v: "db3,ab3,b3,f4" },
  F7: { r: "f1", f: "c2", t: "a1", o: "f2", v: "f2,c3,eb3,a3" },
  "G^7": { r: "g1", f: "d2", t: "b1", o: "g2", v: "g2,d3,f#3,b3" },
  Bm7: { r: "b1", f: "f#2", t: "d2", o: "b2", v: "b2,f#3,a3,d4" },
  E7: { r: "e2", f: "b1", t: "g#2", o: "e3", v: "e3,g#3,b3,d4" },
  Am7: { r: "a1", f: "e2", t: "c2", o: "a2", v: "a2,e3,g3,c4" },
  D7: { r: "d2", f: "a1", t: "f#2", o: "d3", v: "d3,f#3,a3,c4" },
  Em7: { r: "e2", f: "b1", t: "g2", o: "e3", v: "e3,g3,b3,d4" },
  A7: { r: "a1", f: "e2", t: "c#2", o: "a2", v: "a2,e3,g3,c#4" },
  Dm7: { r: "d2", f: "a1", t: "f2", o: "d3", v: "d3,f3,a3,c4" },
  Cadd9: { r: "c2", f: "g1", t: "e2", o: "c3", v: "c3,e3,g3,d4" },
  "C#o7": { r: "c#2", f: "g2", t: "e2", o: "c#3", v: "c#3,e3,g3,bb3" },
  // The solo's G7, with C (the tune's note) in place of B, and its D♭7: root, 3rd and 7th (C♭, written B), its bass
  // walking to the 3rd, not to A♭.
  G7sus: { r: "g1", f: "d2", t: "d2", o: "g2", v: "g2,d3,f3,c4" },
  Db7s: { r: "db2", f: "f2", t: "f2", o: "db3", v: "db3,f3,b3" },
  C7: { r: "c2", f: "g1", t: "e2", o: "c3", v: "c3,e3,g3,bb3" },
  "F^7": { r: "f1", f: "c2", t: "a1", o: "f2", v: "f2,c3,e3,a3" },
  Gm7: { r: "g1", f: "d2", t: "bb1", o: "g2", v: "g2,d3,f3,bb3" },
  Bbm7: { r: "bb1", f: "f2", t: "db2", o: "bb2", v: "bb2,f3,ab3,db4" },
  Eb7: { r: "eb2", f: "bb1", t: "g2", o: "eb3", v: "eb3,g3,bb3,db4" },
  Gb7: { r: "gb1", f: "db2", t: "bb1", o: "gb2", v: "gb2,db3,e3,bb3" },
  Fadd9: { r: "f1", f: "c2", t: "a1", o: "f2", v: "f2,c3,g3,a3" },
};
/** A bar: its chords, each with its length in eighths (the eight of a bar). */
type Bar = readonly (readonly [ChordName, number])[];
const one = (c: ChordName): Bar => [[c, 8]];
const two = (a: ChordName, b: ChordName): Bar => [
  [a, 4],
  [b, 4],
];
const PROGRESSION: Readonly<Record<SectionId, readonly Bar[]>> = {
  // I VI ii V in B♭ twice: B7 (for F7) slides into B♭^7, D♭7 (for G7) into Cm7; Cm7 F7 is G's back door.
  intro: [one("Bb^7"), one("G7"), one("Cm7"), one("B7"), one("Bb^7"), one("Db7"), one("Cm7"), one("F7")],
  // I vi ii V in G: Bm7 E7 aimed at Am7, Em7 A7 at D7.
  a1: [
    one("G^7"),
    two("Bm7", "E7"),
    one("Am7"),
    one("D7"),
    one("G^7"),
    one("Em7"),
    two("Em7", "A7"),
    one("D7"),
  ],
  // The same four bars, then a chain of roots falling by 5ths, B E A D G, whose last ii–V aims at C.
  a2: [
    one("G^7"),
    two("Bm7", "E7"),
    one("Am7"),
    one("D7"),
    one("Bm7"),
    one("E7"),
    one("Am7"),
    two("Dm7", "G7"),
  ],
  // Aura Lee's verse over J5.L04's hook: C♯°7 climbing into D7 (bar 1), D♭7 for the second half of each G7 bar
  // sliding into C (bars 3 and 7), Am7 D7 aimed at G in bar 7 (bar 6). G7 is a G7sus4 here, because the tune holds
  // C on its first beat (G7's B would sit a half step under it). The last two beats turn to C7, V of F.
  solo: [
    [
      ["Cadd9", 6],
      ["C#o7", 2],
    ],
    one("D7"),
    two("G7sus", "Db7s"),
    one("Cadd9"),
    one("Cadd9"),
    two("Am7", "D7"),
    two("G7sus", "Db7s"),
    two("Cadd9", "C7"),
  ],
  // I, a ii–V aimed at Gm7, ii, V; then I vi and the back door, B♭m7 E♭7, home to the tag's F.
  a3: [one("F^7"), two("Am7", "D7"), one("Gm7"), one("C7"), one("F^7"), one("Dm7"), one("Bbm7"), one("Eb7")],
  // The tag: ii–V, an aimed ii–V, the ii and G♭7 sliding home, F, the back door, F held for two bars.
  outro: [
    one("F^7"),
    two("Gm7", "C7"),
    two("Am7", "D7"),
    two("Gm7", "Gb7"),
    one("Fadd9"),
    two("Bbm7", "Eb7"),
    one("Fadd9"),
    one("Fadd9"),
  ],
};
/** The held chords (`pad:`) come in for the second A, the last A and the tag. */
const PADDED = new Set<SectionId>(["a2", "a3", "outro"]);

// ---- The tune (every flavour) --------------------------------------------------------------------------------
//
// Note names, eight eighths a bar, `@` holds. The A tune is a long note, then steps that fall or climb into the next
// bar: in G, D | B | E | F♯ on the downbeats of its first four bars (J5.L03's long notes), G♯ the note the aimed E7
// brings, C♯ the A7's. Every note held a beat or more is a tone of its chord or a 9th, 11th or 13th of it, and
// starts on a beat; a note off the beat is an eighth, and none ends a bar where the next chord would rub against it,
// because the swing plays it late. The tune stays above every chord. The intro's line holds guide tones where a dominant can be
// swapped (bars 2, 4, 6, 8: B5 for G7 and D♭7, E♭5 for F7 and B7), and its last E♭ falls to the tune's first D. The
// second A climbs to G♯5 over E7 and hands over to the solo on B, G7's 3rd; Aura Lee starts on G and climbs to C. The last A
// is the first a whole step down until the back door: D♭ over B♭m7, A♭ falling to G over E♭7, then G B♭ D♭, and D♭
// falls to C as the tag starts on F.

const INTRO = [
  "d5@4 e5 f5 a5@2",
  "b5@8",
  "g5@4 f5 eb5 d5@2",
  "eb5@8",
  "d5@4 e5 f5 a5@2",
  "b5@8",
  "bb5@5 a5 g5 f5",
  "eb5@6 ~@2",
];
const A_HEAD = ["d5@5 c5 b4 a4", "b4@3 ~ g#4 a4 b4 d5", "e5@5 d5 c5 b4", "f#5@6 e5 d5"];
const A1 = [...A_HEAD, "d5@5 c5 b4 a4", "g5@3 ~ f#5 e5 d5 b4", "e5@3 ~ c#5 d5 e5@2", "f#5@8"];
const A2 = [...A_HEAD, "f#5@5 e5 d5 b4", "g#5@5 f#5 e5 d5", "c5@2 e5@2 a5@4", "f5@4 d5@2 b4@2"];
/** Aura Lee's verse at J5.L04's pitches (its `n("…").scale("C5:major")`): G4 to D5. */
const AURA_LEE = [
  "g4@2 c5@2 b4@2 c5@2",
  "d5@2 a4@2 d5@4",
  "c5@2 b4@2 a4@2 b4@2",
  "c5@8",
  "g4@2 c5@2 b4@2 c5@2",
  "d5@2 d5@2 d5@4",
  "c5@2 b4@2 a4@2 b4@2",
  "c5@8",
];
const A3 = [
  "c5@5 bb4 a4 g4",
  "a4@3 ~ f#4 g4 a4 c5",
  "d5@5 c5 bb4 a4",
  "e5@6 d5 c5",
  "c5@5 bb4 a4 g4",
  "f5@3 ~ e5 d5 c5@2",
  "db5@4 c5 bb4 ab4@2",
  "g4@4 bb4@2 db5@2",
];
const OUTRO = [
  "c5@5 bb4 a4 g4",
  "bb4@3 ~ e4 f4 g4@2",
  "c5@3 ~ f#4 g4 a4 c5",
  "d5@3 ~ bb4@4",
  "c5@4 d5 f5 a5@2",
  "ab5@4 g5@4",
  "a5@8",
  "~@8",
];
const MEL: Readonly<Record<SectionId, readonly string[]>> = {
  intro: INTRO,
  a1: A1,
  a2: A2,
  solo: AURA_LEE,
  a3: A3,
  outro: OUTRO,
};

// ---- Rhythms -------------------------------------------------------------------------------------------------

/**
 * A comp or held-chord rhythm: the slots of the bar (8 eighths or 16 sixteenths) where a chord is struck. A chord
 * that changes inside the bar is struck where it starts as well. Each strike holds until the next one, or for `len`
 * slots at most.
 */
interface Rhythm {
  grid: 8 | 16;
  hits: readonly number[];
  len?: number;
}
/** A bass rhythm: where the bass plays, and which note of the chord sounding there (root, fifth, third, octave). */
interface BassRhythm {
  grid: 8 | 16;
  hits: readonly (readonly [number, "r" | "f" | "t" | "o"])[];
  len?: number;
}
/** A rhythm for every bar of a section, or one that changes in its last bar (`last`). */
type Per<T> = T | { each: T; last: T };
const each = <T>(p: Per<T>, i: number, n: number): T =>
  typeof p === "object" && p !== null && "each" in p ? (i === n - 1 ? p.last : p.each) : (p as T);

/** The chords of a bar, as slots of the rhythm's grid. */
function segments(bar: Bar, grid: 8 | 16): { c: ChordName; start: number; end: number }[] {
  const k = grid / 8;
  let at = 0;
  return bar.map(([c, n]) => {
    const s = { c, start: at, end: at + n * k };
    at = s.end;
    return s;
  });
}
/** Slots into mini-notation: each event `[value]@len`, rests `~@len`. */
function slots(grid: number, events: { at: number; end: number; value: string }[]): string {
  const out: string[] = [];
  let t = 0;
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.at > t) out.push(e.at - t === 1 ? "~" : `~@${e.at - t}`);
    const n = e.end - e.at;
    out.push(n === 1 ? e.value : `${e.value}@${n}`);
    t = e.end;
  }
  if (t < grid) out.push(grid - t === 1 ? "~" : `~@${grid - t}`);
  return out.join(" ");
}
/**
 * One bar of chords: struck on the rhythm's slots and at every change of chord. Swung (`swung`), a strike off the
 * beat is played late, so one that would hold to its chord's last slot stops a slot earlier (or is left out): held to
 * the end, the swing would drag it over the next chord's first beat.
 */
function compBar(bar: Bar, r: Rhythm, swung = false): string {
  const events: { at: number; end: number; value: string }[] = [];
  const offBeat = (h: number) =>
    (h * 8) / r.grid !== Math.floor((h * 8) / r.grid) || ((h * 8) / r.grid) % 2 === 1;
  for (const s of segments(bar, r.grid)) {
    const hits = [...new Set([s.start, ...r.hits.filter((h) => h > s.start && h < s.end)])].sort(
      (a, b) => a - b,
    );
    hits.forEach((h, i) => {
      const next = hits[i + 1] ?? s.end;
      let end = Math.min(next, r.len === undefined ? next : h + r.len);
      if (swung && offBeat(h) && end === s.end) end -= 1;
      if (end > h) events.push({ at: h, end, value: `[${CHORD[s.c].v}]` });
    });
  }
  return slots(r.grid, events);
}
/** One bar of bass: the rhythm's notes of the chord sounding at each, and the root wherever a chord starts. */
function bassBar(bar: Bar, r: BassRhythm): string {
  const segs = segments(bar, r.grid);
  const hits = new Map<number, "r" | "f" | "t" | "o">(r.hits.map(([at, d]) => [at, d]));
  for (const s of segs) hits.set(s.start, "r");
  const at = [...hits.keys()].sort((a, b) => a - b);
  const events = at.map((h, i) => {
    const s = segs.find((x) => h >= x.start && h < x.end) as (typeof segs)[number];
    const next = at[i + 1] ?? r.grid;
    return {
      at: h,
      end: Math.min(next, r.len === undefined ? next : h + r.len),
      value: CHORD[s.c][hits.get(h) as "r" | "f" | "t" | "o"],
    };
  });
  return slots(r.grid, events);
}
const lineOf = (id: SectionId, f: (bar: Bar, i: number, n: number) => string): string => {
  const prog = PROGRESSION[id];
  return bars(prog.map((b, i) => f(b, i, prog.length)));
};

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
  /** `.swingBy(…)` on every track (jazz-soul), or "". */
  swing: string;
  sounds: { bass: string; chords: string; lead: string; pad: string };
  /** The tune's sound in the solo, the instrument that plays Aura Lee there. */
  soloLead: string;
  /** A different chords sound in some sections. */
  chordSound?: Partial<Record<SectionId, string>>;
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
  /** content/flavours.ts production: the chords' room, the bass low-pass, pans. */
  room: number;
  lpf: number;
  chordsPan: number;
  leadPan: number;
  kick: ByKind<string | null>;
  snare: ByKind<string | null>;
  hats: ByKind<string | null>;
  perc: ByKind<string | null>;
  bass: ByKind<Per<BassRhythm>>;
  comp: ByKind<Per<Rhythm>>;
  pad: { rhythm: Rhythm; fx: string };
  /** Synth controls (electronic): the bass's sound and filter, the chords' filter by section, the lines' sound. */
  synth?: {
    bassSound: string;
    bass: string;
    chords: ByKind<string>;
    lead: string;
    solo: string;
  };
}

const B8 = (...hits: (readonly [number, "r" | "f" | "t" | "o"])[]): BassRhythm => ({ grid: 8, hits });
const B16 = (...hits: (readonly [number, "r" | "f" | "t" | "o"])[]): BassRhythm => ({ grid: 16, hits });
const C8 = (hits: number[], len?: number): Rhythm =>
  len === undefined ? { grid: 8, hits } : { grid: 8, hits, len };
const C16 = (hits: number[], len?: number): Rhythm =>
  len === undefined ? { grid: 16, hits } : { grid: 16, hits, len };
/** The last bar of the song: one chord, held; the bass on its root. */
const HELD8 = C8([0]);
const ROOT8 = B8([0, "r"]);
const HELD16 = C16([0]);
const ROOT16 = B16([0, "r"]);

/**
 * Pop: a piano ballad. The default kit, a picked bass, piano chords and tune, strings holding the chords; a tenor
 * saxophone takes the solo. Straight. Kick and bass on 1 and 3, the kick adding the "and" of 2 from the second A.
 */
const POP: Kit = {
  bank: "",
  swing: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", pad: "strings" },
  soloLead: "tenor",
  gain: { kick: 0.24, snare: 0.19, hats: 0.12, perc: 0.11, bass: 0.63, chords: 0.27, lead: 0.65, pad: 0.17 },
  room: 0.25,
  lpf: 800,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: null,
    a: v("bd ~ ~ ~ bd ~ ~ ~"),
    solo: v("bd ~ ~ bd bd ~ ~ ~"),
    outro: v("<[bd ~ ~ ~ bd ~ ~ ~]!7 bd>"),
    only: { a2: v("bd ~ ~ bd bd ~ ~ ~") },
  },
  snare: {
    intro: null,
    a: v("<[~ ~ rim ~ ~ ~ rim ~]!7 [~ ~ rim ~ ~ ~ rim rim]>"),
    solo: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ sd sd sd sd]>"),
    outro: v("<[~ ~ rim ~ ~ ~ rim ~]!7 ~>"),
    only: { a2: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ ~ sd sd sd]>") },
  },
  hats: {
    intro: null,
    a: v("~ hh ~ hh ~ hh ~ hh", V8),
    solo: v("hh*8", V8),
    outro: v("<[~ hh ~ hh ~ hh ~ hh]!7 ~>", V8),
    only: { a2: v("hh*8", V8) },
  },
  perc: {
    intro: v("<~!7 [~ ~ ~ cr]>"),
    a: v("<cr ~!7>"),
    // The ride in quarters under the tenor.
    solo: v("<[cr, rd*4] [rd*4]!7>"),
    outro: v("<cr ~!6 cr>"),
  },
  bass: {
    intro: B8([0, "r"]),
    a: B8([0, "r"], [4, "f"]),
    solo: B8([0, "r"], [3, "r"], [4, "f"]),
    outro: { each: B8([0, "r"], [4, "f"]), last: ROOT8 },
    only: { a2: B8([0, "r"], [3, "r"], [4, "f"]) },
  },
  comp: {
    intro: C8([0]),
    a: C8([0, 2, 4, 6]),
    solo: C8([0, 3, 4, 6]),
    outro: { each: C8([0, 4]), last: HELD8 },
  },
  pad: { rhythm: C8([0]), fx: ".attack(.3).release(.8)" },
};

/**
 * Indie: a clean-guitar ballad. The rock kit at half time (kick on 1 and the "and" of 3, the snare on 3), an
 * electric bass with the kick, eighth-note strums, an acoustic guitar on the tune, an organ holding the chords; a jazz
 * guitar takes the solo, over a 3-3-2 kick. Straight. The intro rolls the floor tom under the guitar.
 */
const INDIE: Kit = {
  bank: "rockkit",
  swing: "",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", pad: "organ" },
  soloLead: "jazzgtr",
  gain: { kick: 0.47, snare: 0.42, hats: 0.28, perc: 0.24, bass: 0.59, chords: 0.48, lead: 0.92, pad: 0.24 },
  room: 0.3,
  lpf: 750,
  chordsPan: 0.38,
  leadPan: 0.62,
  kick: {
    intro: null,
    a: v("bd ~ ~ ~ ~ ~ bd ~"),
    solo: v("bd ~ ~ bd ~ ~ bd ~"),
    outro: v("<[bd ~ ~ ~ bd ~ ~ ~]!7 bd>"),
  },
  snare: {
    intro: null,
    a: v("<[~ ~ ~ ~ sd ~ ~ ~]!7 [~ ~ ~ ~ sd ~ sd sd]>"),
    solo: v("<[~ ~ sd ~ ~ ~ sd ~]!7 [~ ~ sd ~ sd sd sd sd]>"),
    outro: v("<[~ ~ ~ ~ sd ~ ~ ~]!7 ~>"),
  },
  hats: {
    intro: null,
    a: v("hh*8", V8),
    solo: v("[hh oh]*4", V8),
    outro: v("<[hh*8]!7 ~>", V8),
  },
  perc: {
    intro: v("<~!4 [lt ~ ~ ~ lt ~ ~ ~]!3 [lt ~ lt ~ lt lt cr ~]>"),
    a: v("<cr ~!7>"),
    solo: v("<[cr, rd*8] [rd*8]!7>"),
    outro: v("<cr ~!6 cr>"),
  },
  bass: {
    intro: B8([0, "r"]),
    a: B8([0, "r"], [6, "f"]),
    solo: B8([0, "r"], [3, "r"], [6, "f"]),
    outro: { each: B8([0, "r"], [4, "f"]), last: ROOT8 },
  },
  comp: {
    intro: C8([0]),
    a: C8([0, 1, 2, 3, 4, 5, 6, 7]),
    solo: C8([0, 3, 6]),
    outro: { each: C8([0, 4]), last: HELD8 },
  },
  pad: { rhythm: C8([0]), fx: ".attack(.2).release(.6)" },
};

/** The jazz ride: ding, ding-da-ding (beats 1 to 4, with the "and" of 2 and of 4), swung by the track. */
const RIDE = "rd ~ rd rd rd ~ rd rd";

/**
 * Jazz-soul: a brushes trio. Oak's jazz kit with brushes (`n` 2 the stir on 1 and 3, `n` 0 the tap on 2 and 4, the
 * pedal hi-hat, `hh` `n` 1, on 2 and 4), the upright in two (root on 1, fifth on 3) and walking in the solo, Rhodes held
 * and comping, the vibes on the tune, strings holding the chords; a tenor saxophone takes the solo over the ride and
 * a slapped brush on 2 and 4. Swung eighths (from U03, FLAVOUR_RULES); every off-beat chord stops before the barline.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  swing: ".swingBy(1/3, 4)",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", pad: "strings" },
  soloLead: "tenor",
  gain: { kick: 0.25, snare: 0.34, hats: 0.21, perc: 0.21, bass: 0.7, chords: 0.41, lead: 0.55, pad: 0.18 },
  room: 0.35,
  lpf: 900,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: v("<~!4 [bd ~ bd ~]!4>"),
    a: v("bd ~ bd ~"),
    solo: v("bd ~ bd ~"),
    outro: v("<[bd ~ bd ~]!7 bd>"),
  },
  snare: {
    intro: `${v("sd ~ sd ~")}.n(2)`,
    a: `${v("sd sd sd sd")}.n("2 0 2 0")`,
    solo: `${v("<[~ sd ~ sd]!7 [~ sd [~ sd] [sd sd]]>")}.n(1)`,
    outro: `${v("<[sd sd sd sd]!7 ~>")}.n("2 0 2 0")`,
  },
  hats: {
    intro: null,
    a: `${v("~ hh ~ hh")}.n(1)`,
    solo: `${v("~ hh ~ hh")}.n(1)`,
    outro: `${v("<[~ hh ~ hh]!7 ~>")}.n(1)`,
  },
  perc: {
    intro: v("<~!7 [~ ~ ~ cr]>"),
    a: v("<cr ~!7>"),
    solo: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8),
    outro: v("<cr ~!6 cr>"),
    only: { a2: v(`<[cr, ${RIDE}] [${RIDE}]!7>`, V8) },
  },
  bass: {
    intro: B8([0, "r"], [4, "f"]),
    a: B8([0, "r"], [4, "f"]),
    // Walking: root, fifth, octave, fifth.
    solo: B8([0, "r"], [2, "f"], [4, "o"], [6, "f"]),
    outro: { each: B8([0, "r"], [4, "f"]), last: ROOT8 },
  },
  comp: {
    intro: C8([0]),
    a: C8([0, 4]),
    // The Charleston, 1 and the "and" of 2, each chord stopping on beat 4.
    solo: C8([0, 3], 3),
    outro: { each: C8([0, 4]), last: HELD8 },
  },
  pad: { rhythm: C8([0]), fx: ".attack(.4).release(.8)" },
};

/**
 * The 808 kick (funk's `oak808`) rings for seconds with no choke: hits a beat apart pile up, by up to 7 dB and by the
 * tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at 96). A 0.35 s decay keeps
 * its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
// Funk, in sixteenths: the kick and the bass lock on 1, the "a" of 2 and the "and" of 3.
const FK_KICK = "bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~";
const FK_SNARE = "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~";
const FK_CLAP = "~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ [sd,cp] ~ ~ ~";

/**
 * Funk: a slow jam. Oak's 808 with the kick and finger bass locked, the snare on 2 and 4 (with a clap from the second
 * A), soft sixteenth hats, clavinet stabs between the kicks in the A sections and a Rhodes held in the intro, the
 * solo and the tag, an organ on the tune, strings holding the chords; a trumpet takes the solo. Straight sixteenths.
 */
const FUNK: Kit = {
  bank: "oak808",
  swing: "",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", pad: "strings" },
  soloLead: "trumpet",
  chordSound: { intro: "rhodes", solo: "rhodes", outro: "rhodes" },
  gain: { kick: 0.34, snare: 0.23, hats: 0.14, perc: 0.12, bass: 0.69, chords: 0.66, lead: 0.66, pad: 0.21 },
  room: 0.2,
  lpf: 850,
  chordsPan: 0.42,
  leadPan: 0.58,
  kick: {
    intro: null,
    a: v(FK_KICK),
    solo: v(FK_KICK),
    outro: v(`<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!7 bd>`),
  },
  snare: {
    intro: null,
    a: v(`<[${FK_SNARE}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`),
    solo: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    outro: v(`<[${FK_SNARE}]!7 ~>`),
    only: { a2: v(`<[${FK_CLAP}]!7 [~ ~ ~ ~ [sd,cp] ~ ~ ~ ~ ~ ~ ~ sd ~ sd sd]>`) },
  },
  hats: {
    intro: null,
    a: v("hh*16", V16),
    solo: v("[hh hh hh hh hh hh oh hh]*2", V16),
    outro: v("<[hh*16]!7 ~>", V16),
  },
  perc: {
    intro: v("<~!7 [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ cr ~ ~ ~]>"),
    a: v("<cr ~!7>"),
    solo: v("<cr ~!7>"),
    outro: v("<cr ~!6 cr>"),
  },
  bass: {
    intro: B16([0, "r"]),
    a: B16([0, "r"], [7, "r"], [10, "f"]),
    solo: B16([0, "r"], [7, "r"], [10, "f"]),
    outro: { each: B16([0, "r"], [10, "f"]), last: ROOT16 },
  },
  comp: {
    intro: C16([0]),
    // Clavinet stabs between the kicks, a sixteenth or two each.
    a: C16([0, 3, 6, 11, 14], 2),
    solo: C16([0, 6, 10], 4),
    outro: { each: C16([0, 8]), last: HELD16 },
  },
  pad: { rhythm: C8([0]), fx: ".attack(.3).release(.8)" },
};

/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level (songs.pw.ts, U09). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** Lo-fi keys: a sawtooth under a low filter that opens a little on each strike and rings on. */
const KEYS = ".lpf(1100).lpenv(1.5).lpd(.3).lps(.4).decay(.8).sustain(.4)";
/** The supersaw swell reads 5–7 LU over the stabs: lowered (songs.pw.ts, U09); struck on every beat, slow attack. */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";

/**
 * Electronic: a lo-fi beat. The lo-fi kit, boom-bap (the kick on 1 and the "and" of 3, the snare on 2 and 4), a sine
 * sub locked to the kick, sawtooth keys under a low filter, a supersaw swelling on every beat under the second A, the
 * last A and the tag, a square pluck with a dotted-eighth echo on the tune; a supersaw lead takes the solo. The intro
 * is the keys and the sub alone. Straight.
 */
const ELECTRONIC: Kit = {
  bank: "lofikit",
  swing: "",
  sounds: { bass: "sine", chords: "sawtooth", lead: "square", pad: "supersaw" },
  soloLead: "supersaw",
  gain: { kick: 0.25, snare: 0.22, hats: 0.15, perc: 0.13, bass: 0.68, chords: 0.4, lead: 0.44, pad: 0.21 },
  room: 0.2,
  lpf: 700,
  chordsPan: 0.4,
  leadPan: 0.6,
  kick: {
    intro: null,
    a: v("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~"),
    solo: v(FK_KICK),
    outro: v("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~]!7 bd>"),
  },
  snare: {
    intro: null,
    a: v(`<[${FK_SNARE}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ sd]>`),
    solo: v(`<[${FK_SNARE}]!7 [~ ~ ~ ~ sd ~ ~ ~ ~ ~ sd ~ sd sd sd sd]>`),
    outro: v(`<[${FK_SNARE}]!7 ~>`),
  },
  hats: {
    intro: null,
    a: v("hh*8", V8),
    solo: v("[hh hh oh hh]*2", V8),
    outro: v("<[hh*8]!7 ~>", V8),
  },
  perc: {
    intro: v("<~!7 [~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ cr ~ ~ ~]>"),
    a: v("<cr ~!7>"),
    solo: v("<cr ~!7>"),
    outro: v("<cr ~!6 cr>"),
  },
  bass: {
    intro: B16([0, "r"]),
    a: B16([0, "r"], [10, "f"]),
    solo: B16([0, "r"], [7, "r"], [10, "f"]),
    outro: { each: B16([0, "r"], [10, "f"]), last: ROOT16 },
  },
  comp: {
    intro: C16([0]),
    a: C16([0, 10]),
    solo: C16([0, 7, 10]),
    outro: { each: C16([0, 10]), last: HELD16 },
  },
  chordSound: { intro: "supersaw" },
  pad: { rhythm: C8([0, 2, 4, 6]), fx: PAD },
  synth: {
    bassSound: "sine",
    bass: SUB,
    chords: { intro: PAD, a: KEYS, solo: KEYS, outro: KEYS },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.62).delayfeedback(.35)",
    solo: ".unison(5).detune(.15).lpf(2800).attack(.02).decay(.3).sustain(.6).delay(.25).delaytime(.62).delayfeedback(.3)",
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

/** One flavour's song: the tune first, then the chords, the held chords, the bass and the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const bank = k.bank ? `.bank("${k.bank}")` : "";
  const syn = k.synth;
  const sw = k.swing;
  const mel = mapSections((id) => {
    const tune = `note("${bars(MEL[id])}")`;
    if (id === "solo") return `${tune}.s("${k.soloLead}")${syn?.solo ?? ""}`;
    return `${tune}.s("${k.sounds.lead}")${syn?.lead ?? ""}`;
  });
  const chords = mapSections((id) => {
    const sound = k.chordSound?.[id] ?? k.sounds.chords;
    const line = lineOf(id, (b, i, n) => compBar(b, each(pick(k.comp, id), i, n), sw !== ""));
    return `note("${line}").s("${sound}")${syn ? pick(syn.chords, id) : ""}`;
  });
  const pad = mapSections((id) =>
    PADDED.has(id)
      ? `note("${lineOf(id, (b) => compBar(b, k.pad.rhythm))}").s("${k.sounds.pad}")${k.pad.fx}`
      : null,
  );
  const bass = mapSections((id) => {
    const line = `note("${lineOf(id, (b, i, n) => bassBar(b, each(pick(k.bass, id), i, n)))}")`;
    return syn ? `${line}.s("${syn.bassSound}")${syn.bass}` : line;
  });
  const drums = (by: ByKind<string | null>): BySection => mapSections((id) => pick(by, id));
  const kick808 = /^(RolandTR808|oak808)$/.test(k.bank) ? KICK_808 : "";
  const tracks = [
    track("mel", mel, `${sw}.gain(${num(k.gain.lead)}).pan(${num(k.leadPan)}).room(${num(k.room)})`),
    track(
      "chords",
      chords,
      `${sw}.velocity("${V4}").gain(${num(k.gain.chords)}).pan(${num(k.chordsPan)}).room(${num(k.room)})`,
    ),
    track("pad", pad, `${sw}.gain(${num(k.gain.pad)}).pan(.5).room(${num(k.room)})`),
    track(
      "bass",
      bass,
      `${sw}${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`,
    ),
    track("kick", drums(k.kick), `${bank}${kick808}${sw}.gain(${num(k.gain.kick)})`),
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
  startFrom: "oak",
  today,
  ...(oakKeeps ? { oakKeeps } : {}),
});

/** J5.L02–L04 write chords, bass and tune together, so each hands over a whole section; Oak keeps the drums. */
const PITCHED: SongPartId[] = ["lead", "chords", "bass"];

export const J5_SONG = defineUnitSong({
  id: "usong.J5",
  unit: "J5",
  version: 1,
  title: "Home by another door",
  meter: "4/4",
  key: { tonic: "F", mode: "major" },
  bpm: 72,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
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
  // Every take starts from the lesson's own starter: each Make is in another key (B♭, F, G, C), so no earlier take's
  // code could open a later one. J5.L05 (Coltrane changes, enrichment) moves through three keys at 144 and stays a
  // sketch of its own.
  plan: [
    take(
      "J5.L01",
      ["intro"],
      ["chords", "bass"],
      "Your turnaround in B♭, chords and bass, opens the song, with Oak's line still playing over it.",
      ["lead"],
    ),
    take(
      "J5.L02",
      ["a3"],
      PITCHED,
      "Your loop in F plays the song's last A section, and its last two bars lead into the ending.",
    ),
    take(
      "J5.L03",
      ["a1"],
      PITCHED,
      "Your tune in G plays the song's first A section, right after the turnaround that opens it.",
    ),
    // J5.L04's reference plays its own ride and hi-hat (`drums:` `rd`, `hats:` `hh`), so the solo's hats and
    // cymbals are its too.
    take(
      "J5.L04",
      ["solo"],
      [...PITCHED, "hats", "perc"],
      "Your Aura Lee on the tenor plays the song's solo in C, its tune unchanged over your new chords.",
    ),
    {
      lesson: "J5.L05",
      kind: "side",
      reason:
        "This lesson moves through three keys in eight bars at a fast swing, so its line stays a sketch of its own.",
    },
  ],
  // J.CP2, the jazz track's second checkpoint, sits in J5's folder and covers J5.L01–L04 (J5.L05 is in no
  // checkpoint): the song is released after it (AUTHORING §23.6).
  releaseAfter: "J.CP2",
});

export default J5_SONG;
