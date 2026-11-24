// Song R2, "Crosscurrent" (docs/design/songs/makes-core-c.md §4 "R Advanced Rhythm", §4.1; AUTHORING §23). 4/4,
// 96 BPM, 53 bars (2:13). R2's lessons each have their own meter (5/4, 7/8 and 9/8, 6/8), and a song has one meter
// (contracts §5.11; the schema has no per-section meter), so the song is in 4/4 and its two 4/4 lessons take it over:
// R2.L04's three against two plays both verses, R2.L05's drift plays the bridge and the ending. The first three
// lessons are side steps, and the song still plays their ideas in four: groups of three and two inside the bar, six
// pulses regrouped from threes into twos, two pulses at once, and a cycle that drifts across the bar line.
//
//   intro 4          verse1 8          chorus1 8               verse2 8   break 4          bridge 8 (D minor)
//   Cm7 Fm7 Cm7 Fm7  (Cm7 Fm7)×4       (Ab Bb Gm Cm)×2         = verse1   Ab Bb Gm A7      Dm7 ×8
//
//   chorus2 8 (D minor)   outro 4 (D minor)   end 1
//   (Bb C Am Dm)×2        Dm7 ×4              Dm7
//
// The verses, the choruses and the intro count every beat in threes (twelve even notes a bar, as triplets do); the
// break, the bridge and the ending count it in fours (sixteenths). Oak plays each lesson's idea before it is taken:
// - Intro and verses (R2.L04): the bar rolls. The chords and a cowbell play three even notes a bar while the kick and
//   the bass play two (in pop the hi-hats add four, four against the cowbell's three). They meet only on beat 1. The
//   verse tune sings the three too: three even notes over each C minor bar, answered on the two.
// - The choruses (R2.L03 in four, and R2.L05's implied metric modulation): the hats (in jazz-soul the ride) keep the
//   twelve-note pulse, the band groups it in threes (on the beats) for three bars, and in the fourth bar of each four
//   the drums, the chords, the bass and the tune regroup it into twos: six even hits, the beat seeming to speed up
//   while the bar stays as long.
// - The break (R2.L01 and R2.L02 in four): eight eighth notes grouped 3+3+2 (hits on the 1st, 4th and 7th), then in
//   bar 4 sixteen sixteenths grouped 3+3+3+3+2+2, and A7 carries the song up a whole step, from C minor to D minor.
// - The bridge and the ending (R2.L05): the snare and the hats keep the bar while the kick and the bass repeat a
//   three-beat cycle (D held two beats, A one), so they cross the bar line and meet beat 1 together every three bars.
//   In the bridge the tune adds a five-beat cycle of its own (A C D A G), four times round, then lands.
// - The second chorus is the first a whole step up, in D minor.
//
// Harmony. Every flavour plays the same chord roots and functions, bass roots on every downbeat, and tune pitches; a
// flavour changes sounds, grooves, comp and bass rhythms, and chord colour. Cm7, Fm7 and Dm7 are sevenths in every
// flavour, because R2's Makes write them by name (`chord("<Cm7 Fm7>")`, `chord("Dm7")`); the choruses and the break
// are triads in pop and indie and sevenths in jazz-soul, funk and electronic (Ab^7, Bb7, Gm7, Cm7; Bb^7, C7, Am7,
// Dm7). A7 is a dominant seventh everywhere. The bass sounds every four-note chord's root (or its fifth) under it, so
// Cm7 never reads as Eb6, nor Dm7 as F6. Straight in every flavour, jazz-soul included: R2's takes are even pulses
// the learner writes (contracts §5.11 rule 7), and the swing jazz-soul would add is written out here as triplets
// (the ride's spang-a-lang on the twelve-note grid), so it cannot pull the three against two out of line.
//
// Clashes (AUTHORING §13). The tune is built from the notes no chord tone of its bar touches a half step away in any
// flavour: C Eb F G Bb over Cm7 and Cm, C Eb F Ab Bb over Fm7, C Eb F Bb over Ab (Ab^7's G and Ab rule out both),
// Bb C D F over Bb7, G Bb C D F over Gm7, D F G A C over Dm7, the chorus set a whole step up in D minor. That holds at
// every length, against the learner's own Rhodes too (`chord("Cm7").voicing()` Bb3 Eb4 G4 Bb4 C5, `Fm7` F3 C4 Eb4 Ab4
// C5, `Dm7` F3 C4 D4 F4 C5, evaluated), so Oak's tune keeps playing over both takes (`oakKeeps`, clash-checked). The
// tune stays at C5 or above (to F6 in the last chorus), at or over the top note of every chord, Oak's and the learner's.
// Gains start from U13's levelled kits; songs.pw.ts levels them (budget sound-songs.json), so the learner's line sits
// on top. Every claim here is read off the evaluated events (content/validate/unit-songs.ts and the task report).
//
// The tempo is 96: R2.L04's Make has no tempo rule and R2.L05's suggests 90 to 130, so the song keeps its tempo when
// each Make opens (AUTHORING §23.1 rule 5).
import {
  defineUnitSong,
  FLAVOUR_IDS,
  type FlavourId,
  type SongPartId,
  type TakeStep,
  type UnitSongSection,
} from "@oak/content-kit";

const D_MINOR = { tonic: "D", mode: "minor" } as const;
const SECTIONS = [
  { id: "intro", type: "intro", bars: 4 },
  { id: "verse1", type: "verse", bars: 8 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  // Ab Bb Gm (the chorus's first three chords) then A7, the V of D minor: no take plays here, so it keeps the song's
  // key in the data while its last chord turns to D.
  { id: "break", type: "break", bars: 4 },
  // R2.L05's Make is in D minor: the drift and the ending carry its key.
  { id: "bridge", type: "bridge", bars: 8, key: D_MINOR },
  { id: "chorus2", type: "chorus", bars: 8, key: D_MINOR },
  { id: "outro", type: "outro", bars: 4, key: D_MINOR },
  { id: "end", type: "outro", bars: 1, key: D_MINOR },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const sectionOf = (id: SectionId) => SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number];
/** Sections counted in fours (sixteenths); the others in threes (twelve even notes a bar). */
const STRAIGHT = new Set<SectionId>(["break", "bridge", "outro", "end"]);
/** Slots in a bar. */
const stepsOf = (id: SectionId): number => (STRAIGHT.has(id) ? 16 : 12);

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `melChorus2` for a second chorus that plays something else), `silence` where it rests, and one
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

// ---- Harmony (every flavour) --------------------------------------------------------------------------------

type ChordName = "Cm7" | "Fm7" | "Ab" | "Bb7" | "Gm" | "Cm" | "A7" | "Dm7" | "Bbmaj" | "C7" | "Am" | "Dm";
interface Chord {
  /** Bass: root, fifth, octave. */
  r: string;
  f: string;
  o: string;
  /** The voicing in pop and indie (triads, or the seventh a Make names). */
  tri: string;
  /** The voicing in jazz-soul, funk and electronic (the kit's colour). */
  col: string;
}
const seventh = (r: string, f: string, o: string, v: string): Chord => ({ r, f, o, tri: v, col: v });
const CHORD: Readonly<Record<ChordName, Chord>> = {
  Cm7: seventh("c2", "g2", "c3", "eb3,g3,bb3,c4"),
  Fm7: seventh("f1", "c2", "f2", "eb3,f3,ab3,c4"),
  Ab: { r: "ab1", f: "eb2", o: "ab2", tri: "eb3,ab3,c4", col: "eb3,g3,ab3,c4" },
  Bb7: { r: "bb1", f: "f2", o: "bb2", tri: "d3,f3,bb3", col: "d3,f3,ab3,bb3" },
  Gm: { r: "g1", f: "d2", o: "g2", tri: "d3,g3,bb3", col: "d3,f3,g3,bb3" },
  Cm: { r: "c2", f: "g2", o: "c3", tri: "eb3,g3,c4", col: "eb3,g3,bb3,c4" },
  A7: seventh("a1", "e2", "a2", "c#3,e3,g3,a3"),
  Dm7: seventh("d2", "a2", "d3", "f3,a3,c4,d4"),
  Bbmaj: { r: "bb1", f: "f2", o: "bb2", tri: "d3,f3,bb3", col: "d3,f3,a3,bb3" },
  C7: { r: "c2", f: "g2", o: "c3", tri: "e3,g3,c4", col: "e3,g3,bb3,c4" },
  Am: { r: "a1", f: "e2", o: "a2", tri: "e3,a3,c4", col: "e3,g3,a3,c4" },
  Dm: { r: "d2", f: "a2", o: "d3", tri: "f3,a3,d4", col: "f3,a3,c4,d4" },
};
const VAMP: ChordName[] = ["Cm7", "Fm7"];
const CHORUS: ChordName[] = ["Ab", "Bb7", "Gm", "Cm"];
const CHORUS_D: ChordName[] = ["Bbmaj", "C7", "Am", "Dm"];
const times = <T>(xs: readonly T[], n: number): T[] => Array.from({ length: n }, () => xs).flat();
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: times(VAMP, 2),
  verse1: times(VAMP, 4),
  chorus1: times(CHORUS, 2),
  verse2: times(VAMP, 4),
  break: ["Ab", "Bb7", "Gm", "A7"],
  bridge: times(["Dm7"], 8),
  chorus2: times(CHORUS_D, 2),
  outro: times(["Dm7"], 4),
  end: ["Dm7"],
};

// ---- Patterns on a grid -------------------------------------------------------------------------------------
//
// A part is written as one string of slots per bar (twelve, or sixteen in the straight sections) and read as events:
// a letter starts a note, `-` holds it into the next slot (across the bar line too), `.` is silence. A section
// becomes one sequence `[…]` a bar inside `< >`, or, when a note crosses a bar line, one sequence slowed over its bars.

interface Ev {
  at: number;
  len: number;
  tok: string;
  vel: number;
}
/** One bar of slots: a string, or a function of the bar's index in its section and the section's length. */
type Bars = string | ((i: number, n: number) => string);
const barOf = (b: Bars, i: number, n: number): string => (typeof b === "string" ? b : b(i, n));

/** A section's slots, bar after bar, checked for length. */
function slotsOf(id: SectionId, b: Bars): string {
  const n = sectionOf(id).bars;
  const steps = stepsOf(id);
  let out = "";
  for (let i = 0; i < n; i++) {
    const bar = barOf(b, i, n);
    if (bar.length !== steps)
      throw new Error(`R2 ${id} bar ${i + 1}: ${bar.length} slots, not ${steps}: "${bar}"`);
    out += bar;
  }
  return out;
}

/** Events from slots; `value(char, slot)` names the note and its velocity. */
function eventsOf(slots: string, value: (c: string, slot: number) => { tok: string; vel: number }): Ev[] {
  const out: Ev[] = [];
  let cur: Ev | null = null;
  for (let s = 0; s < slots.length; s++) {
    const c = slots[s] as string;
    if (c === "-") {
      if (cur) cur.len++;
      continue;
    }
    cur = null;
    if (c === ".") continue;
    cur = { at: s, len: 1, ...value(c, s) };
    out.push(cur);
  }
  return out;
}

/**
 * A weighted sequence over `total` slots, and the matching velocities (a rest's velocity is never read). Runs of the
 * same one-slot note fold to `tok!k`.
 */
function sequence(evs: readonly Ev[], total: number): { notes: string; vel: string } {
  const notes: [string, number][] = [];
  const vel: [string, number][] = [];
  let t = 0;
  for (const e of evs) {
    if (e.at > t) {
      notes.push(["~", e.at - t]);
      vel.push(["1", e.at - t]);
    }
    notes.push([e.tok, e.len]);
    vel.push([num(e.vel), e.len]);
    t = e.at + e.len;
  }
  if (t < total) {
    notes.push(["~", total - t]);
    vel.push(["1", total - t]);
  }
  const fold = (xs: [string, number][]): string => {
    const out: string[] = [];
    for (let i = 0; i < xs.length; ) {
      const [tok, len] = xs[i] as [string, number];
      let j = i;
      while (len === 1 && j + 1 < xs.length && xs[j + 1]?.[0] === tok && xs[j + 1]?.[1] === 1) j++;
      out.push(j > i ? `${tok}!${j - i + 1}` : len === 1 ? tok : `${tok}@${len}`);
      i = j + 1;
    }
    return `[${out.join(" ")}]`;
  };
  return { notes: fold(notes), vel: fold(vel) };
}

/** The shortest run of bars that repeats through the whole list (a two-bar vamp: 2). */
function period(bars: readonly string[]): number {
  for (let p = 1; p < bars.length; p++)
    if (bars.length % p === 0 && bars.every((b, i) => b === bars[i % p])) return p;
  return bars.length;
}

/**
 * A pitched section. When no note crosses a bar line, one `[…]` a bar inside `< >` (only as many bars as repeat);
 * otherwise one sequence over the whole section, slowed over its bars (the drifting bass ties across bar lines).
 */
function pitched(id: SectionId, evs: readonly Ev[], withVel = true): string {
  const bars = sectionOf(id).bars;
  const steps = stepsOf(id);
  const tied = evs.some((e) => (e.at % steps) + e.len > steps);
  if (tied || bars === 1) {
    const { notes, vel } = sequence(evs, bars * steps);
    const v = withVel ? `.velocity("${vel}")` : "";
    return `note("${notes}")${v}${bars > 1 ? `.slow(${bars})` : ""}`;
  }
  const per = Array.from({ length: bars }, (_, b) =>
    sequence(
      evs.filter((e) => Math.floor(e.at / steps) === b).map((e) => ({ ...e, at: e.at - b * steps })),
      steps,
    ),
  );
  const alt = (xs: string[]) => {
    const p = period(xs);
    return p === 1 ? (xs[0] as string) : `<${xs.slice(0, p).join(" ")}>`;
  };
  const notes = alt(per.map((x) => x.notes));
  const vel = alt(per.map((x) => x.vel));
  return `note("${notes}")${withVel ? `.velocity("${vel}")` : ""}`;
}

/** Velocity by letter. */
type Vel = Readonly<Record<string, number>>;

/** Chords from slots: `x` the bar's chord, `g` the bar's chord softly. */
function chordEvents(id: SectionId, b: Bars, voicing: (c: Chord) => string, vel: Vel): Ev[] {
  const steps = stepsOf(id);
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const name = prog[Math.floor(s / steps)];
    if (!name || !(c in vel)) throw new Error(`R2 ${id}: no chord for "${c}" at slot ${s}`);
    return { tok: `[${voicing(CHORD[name])}]`, vel: vel[c] as number };
  });
}

/** Bass from slots: `r` root, `f` fifth, `o` octave of the bar's chord. */
function bassEvents(id: SectionId, b: Bars): Ev[] {
  const steps = stepsOf(id);
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const here = prog[Math.floor(s / steps)] as ChordName;
    const k = ({ r: "r", f: "f", o: "o" } as const)[c as "r" | "f" | "o"];
    if (!k) throw new Error(`R2 ${id}: "${c}" in a bass line`);
    return { tok: CHORD[here][k], vel: c === "r" ? 1 : 0.85 };
  });
}

// ---- The drift (R2.L05), the same in every flavour --------------------------------------------------------
//
// Sixteen slots a bar. A three-beat cycle: the kick on its first beat; the bass D for two beats, then A for one. It
// crosses the bar line and meets beat 1 again every three bars (bars 1, 4, 7 of the bridge; 1 and 4 of the ending).

/** Bar `i` of a cycle of `beats` beats that restarts at the section's start: `on(beatInCycle)` gives a beat's slots. */
const cycle =
  (beats: number, on: (k: number) => string): Bars =>
  (i) => {
    let out = "";
    for (let b = i * 4; b < i * 4 + 4; b++) out += on(b % beats);
    return out;
  };
const DRIFT_KICK = cycle(3, (k) => (k === 0 ? "X..." : "...."));
/** D for two beats (cut by the section's end), then A for one. */
const DRIFT_BASS = cycle(3, (k) => (k === 0 ? "r---" : k === 1 ? "----" : "f---"));

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// `note:length` in slots (twelve a bar in the verses and choruses, sixteen in the bridge and the ending). The verse
// sings the three over each Cm7, three even notes (G F E♭, then G B♭ G, then C B♭ G at the top), and answers on the
// two over each Fm7. The chorus hook sits higher (E♭6 C6 B♭5 over A♭), and every fourth bar regroups into six even
// notes with the band, falling home to C. The bridge's tune is a five-beat cycle over the three-beat drift (four times
// round, so it drifts too) and then climbs into the last chorus. The last chorus is the first a whole step up; the
// ending falls A G F, the verse's first three notes a whole step up, and lands on D.

const T_VERSE = [
  "g5:4 f5:4 eb5:4",
  "f5:6 c5:6",
  "g5:4 bb5:4 g5:4",
  "ab5:6 f5:3 eb5:3",
  "g5:4 f5:4 eb5:4",
  "f5:6 ab5:3 bb5:3",
  "c6:4 bb5:4 g5:4",
  "f5:6 eb5:3 c5:3",
];
const T_CHORUS = [
  "eb6:6 c6:3 bb5:3",
  "bb5:6 f5:6",
  "d6:6 c6:3 bb5:3",
  "c6:2 bb5:2 g5:2 bb5:2 g5:2 f5:2",
  "eb6:6 c6:3 bb5:3",
  "bb5:6 c6:3 d6:3",
  "d6:4 c6:4 bb5:4",
  "c6:2 bb5:2 g5:2 f5:2 eb5:2 c5:2",
];
const NAMES = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"];
/** A note name a number of half steps up (`eb6` + 2 = `f6`), spelled as D minor spells it. */
function transpose(note: string, by: number): string {
  const m = /^([a-g]b?)(\d)$/.exec(note);
  if (!m) throw new Error(`R2: cannot transpose "${note}"`);
  const pc = NAMES.indexOf(m[1] as string);
  const midi = (Number(m[2]) + 1) * 12 + pc + by;
  const name = NAMES[midi % 12] as string;
  return `${name === "db" ? "c#" : name === "gb" ? "f#" : name}${Math.floor(midi / 12) - 1}`;
}
const T_CHORUS_D = T_CHORUS.map((bar) =>
  bar
    .split(" ")
    .map((tok) => {
      const [note, len] = tok.split(":");
      return note === "~" ? tok : `${transpose(note as string, 2)}:${len}`;
    })
    .join(" "),
);
/** The five-beat cycle: A C D A G, a quarter note each. */
const FIVE = ["a5", "c6", "d6", "a5", "g5"];
const T_BRIDGE = [
  "~:16",
  "~:16",
  Array.from({ length: 20 }, (_, i) => `${FIVE[i % 5]}:4`).join(" "),
  "f5:8 g5:4 a5:4",
];
const T_OUTRO = ["a5:4 g5:4 f5:8", "g5:8 d5:8", "a5:4 c6:4 a5:8", "g5:4 f5:4 d5:8"];

/** A tune section from `note:length` tokens (lengths in slots). */
function tuneEvents(id: SectionId, lines: readonly string[]): Ev[] {
  const out: Ev[] = [];
  let t = 0;
  for (const tok of lines.join(" ").split(/\s+/)) {
    const [note, len] = tok.split(":");
    const n = Number(len);
    if (note !== "~") out.push({ at: t, len: n, tok: note as string, vel: 1 });
    t += n;
  }
  const total = sectionOf(id).bars * stepsOf(id);
  if (t !== total) throw new Error(`R2 tune ${id}: ${t} slots, not ${total}`);
  return out;
}

const MEL: BySection = {
  intro: null,
  verse1: pitched("verse1", tuneEvents("verse1", T_VERSE), false),
  chorus1: pitched("chorus1", tuneEvents("chorus1", T_CHORUS), false),
  verse2: pitched("verse2", tuneEvents("verse2", T_VERSE), false),
  break: null,
  bridge: pitched("bridge", tuneEvents("bridge", T_BRIDGE), false),
  chorus2: pitched("chorus2", tuneEvents("chorus2", T_CHORUS_D), false),
  outro: pitched("outro", tuneEvents("outro", T_OUTRO), false),
  end: pitched("end", tuneEvents("end", ["d5:16"]), false),
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** A drum letter: the sound (or a bracket of sounds) and its velocity. */
type DrumMap = Readonly<Record<string, readonly [string, number]>>;
const KICK: DrumMap = { X: ["bd", 1], x: ["bd", 0.75], g: ["bd", 0.5] };
const SNARE: DrumMap = {
  X: ["sd", 1],
  x: ["sd", 0.75],
  g: ["sd", 0.3],
  R: ["rim", 1],
  r: ["rim", 0.6],
  C: ["[sd,cp]", 0.9],
  c: ["cp", 0.85],
};
const HATS: DrumMap = { X: ["hh", 1], x: ["hh", 0.65], g: ["hh", 0.4], O: ["oh", 0.8] };
const PERC: DrumMap = {
  K: ["cb", 1],
  k: ["cb", 0.6],
  S: ["sh", 0.7],
  s: ["sh", 0.4],
  T: ["tb", 0.75],
  t: ["tb", 0.45],
  Q: ["conga", 1],
  q: ["conga", 0.6],
};
const PERC2: DrumMap = {
  C: ["cr", 1],
  R: ["rd", 0.8],
  r: ["rd", 0.55],
  Z: ["[cr,rd]", 1],
  L: ["lt", 0.85],
  M: ["mt", 0.85],
  H: ["ht", 0.85],
};

/** A drum section: one `<…>` entry a bar (repeats folded with `!`), its velocities alike. */
function drumSection(id: SectionId, b: Bars, map: DrumMap): string {
  const n = sectionOf(id).bars;
  const steps = stepsOf(id);
  const slots = slotsOf(id, b);
  const sBars: string[] = [];
  const vBars: string[] = [];
  let any = false;
  for (let i = 0; i < n; i++) {
    const bar = slots.slice(i * steps, (i + 1) * steps);
    const s: string[] = [];
    const v: string[] = [];
    for (const c of bar) {
      if (c === ".") {
        s.push("~");
        v.push("1");
        continue;
      }
      const hit = map[c];
      if (!hit) throw new Error(`R2 ${id}: drum letter "${c}"`);
      any = true;
      s.push(hit[0]);
      v.push(num(hit[1]));
    }
    sBars.push(`[${s.join(" ")}]`);
    vBars.push(`[${v.join(" ")}]`);
  }
  if (!any) throw new Error(`R2 ${id}: a drum section with no hit (write null)`);
  // Sounds and velocities fold over the same bars, so the two patterns keep one shape.
  const same = (a: number, c: number) => sBars[a] === sBars[c] && vBars[a] === vBars[c];
  const fold = (xs: string[]): string => {
    const out: string[] = [];
    for (let i = 0; i < xs.length; ) {
      let j = i;
      while (j + 1 < xs.length && same(j + 1, i)) j++;
      out.push(j > i ? `${xs[i]}!${j - i + 1}` : (xs[i] as string));
      i = j + 1;
    }
    return out.length === 1 && !(out[0] as string).includes("!") ? (out[0] as string) : `<${out.join(" ")}>`;
  };
  return `s("${fold(sBars)}").velocity("${fold(vBars)}")`;
}

type Drums = Readonly<Partial<Record<SectionId, Bars>>>;
interface Kit {
  /** `.bank()` for every drum track, or a bank per section (electronic), or "" for the default kit. */
  bank: string | Readonly<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; lead: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    cym: number;
    bass: number;
    chords: number;
    lead: number;
  };
  /** content/flavours.ts production: room, the bass low-pass. */
  room: number;
  lpf: number;
  /** Which voicing the chords play: pop and indie `tri`, the others `col`. */
  colour: "tri" | "col";
  kick: Drums;
  snare: Drums;
  hats: Drums;
  perc: Drums;
  cym: Drums;
  /** Slots per section; a section absent rests. */
  bass: Readonly<Partial<Record<SectionId, Bars>>>;
  comp: Readonly<Partial<Record<SectionId, Bars>>>;
  compVel: Vel;
  /** Synth sounds and controls by section (electronic). */
  synth?: {
    bass: Partial<Record<SectionId, string>>;
    chords: Partial<Record<SectionId, string>>;
    lead: string;
  };
}

/** The 4th and 8th bars of a section: the choruses regroup there. */
const fourth = (i: number) => i % 4 === 3;
const last = (i: number, n: number) => i === n - 1;
/** Per bar: one pattern in bars `which`, another elsewhere. */
const when =
  (which: (i: number, n: number) => boolean, yes: string, no: string): Bars =>
  (i, n) =>
    which(i, n) ? yes : no;
const from3 = (i: number) => i >= 2;
const firstOf = (i: number) => i === 0;
const firsts = (i: number) => i % 4 === 0;

// Shared rhythms on the twelve-note grid (a beat is three slots: 0, 3, 6, 9).
const THREE = "x---x---x---"; // the three: three even chords a bar
const SIX = "x-x-x-x-x-x-"; // the twos: six even hits a bar
const COWBELL = "K...K...K...";
const R12 = "............";
const R16 = "................";
// The break, on sixteen slots: 3+3+2 eighths (hits on slots 0, 6, 12), then 3+3+3+3+2+2 sixteenths in bar 4.
const BREAK_HITS = "x-----x-----x---";
const BREAK_FILL = "x--x--x--x--x-x-";
const BREAK_KICK = when(last, "X..X..X..X..X.X.", "X.....X.....X...");
const BREAK_SNARE = when(last, "............X.X.", "............X...");
const BREAK_BASS = when(last, "r--r--r--r--r-r-", "r-----r-----r---");
const BREAK_COMP = when(last, BREAK_FILL, BREAK_HITS);
/** Eighths accented in 3+3+2: the hats spell the break's groups. */
const BREAK_HATS = "X.g.g.X.g.g.X.g.";
const BREAK_CYM = (i: number, n: number) =>
  i === 0 ? "C..............." : last(i, n) ? "H..M..L..L......" : R16;

/** The drifting kick, the same in every flavour. */
const DRIFT: Partial<Record<SectionId, Bars>> = { bridge: DRIFT_KICK, outro: DRIFT_KICK };
const END_KICK = "X...............";
const END_BASS = "r---------------";

/** Pop: the default kit, piano, picked bass, congas in the choruses; straight. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano" },
  gain: { kick: 0.19, snare: 0.2, hats: 0.14, perc: 0.15, cym: 0.12, bass: 0.53, chords: 0.2, lead: 0.75 },
  room: 0.25,
  lpf: 800,
  colour: "tri",
  kick: {
    intro: when(from3, "X.....X.....", R12),
    verse1: "X.....X.....",
    chorus1: when(fourth, "X...X...X...", "X....xX....."),
    verse2: "X.....X.....",
    break: BREAK_KICK,
    ...DRIFT,
    chorus2: when(fourth, "X...X...X...", "X....xX....."),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (last(i, n) ? "...X.....XxX" : i === 2 ? "...X.....X.." : R12),
    verse1: when(fourth, "...X.....XxX", "...X.....X.."),
    chorus1: when(fourth, "..X...X...X.", "...X.....X.."),
    verse2: when(fourth, "...X.....XxX", "...X.....X.."),
    break: BREAK_SNARE,
    bridge: when(last, "....X.......XxXX", "....X.......X..."),
    chorus2: when(fourth, "..X...X...X.", "...X.....X.."),
    outro: "....X.......X...",
  },
  hats: {
    intro: when(from3, "X..x..X..x..", R12),
    verse1: "X..x..X..x..",
    chorus1: "XgxXgxXgxXgx",
    verse2: "X.gx.gX.gx.g",
    break: BREAK_HATS,
    bridge: "X.x.X.x.X.x.X.x.",
    chorus2: "XgxXgxXgxXgx",
    outro: "X.x.X.x.X.x.X.x.",
  },
  perc: {
    intro: COWBELL,
    verse1: COWBELL,
    chorus1: when(fourth, "Q.Q.Q.Q.Q.Q.", "Q.qQ.qQ.qQ.q"),
    verse2: COWBELL,
    bridge: "SsssSsssSsssSsss",
    chorus2: when(fourth, "Q.Q.Q.Q.Q.Q.", "Q.qQ.qQ.qQ.q"),
    outro: "SsssSsssSsssSsss",
  },
  cym: {
    intro: (i) => (i === 2 ? "C..........." : R12),
    verse1: when(firstOf, "C...........", R12),
    chorus1: when(firsts, "C...........", R12),
    verse2: when(firstOf, "C...........", R12),
    break: BREAK_CYM,
    bridge: when(firstOf, "C...............", R16),
    chorus2: when(firsts, "C...........", R12),
    outro: when(firstOf, "C...............", R16),
    end: "C...............",
  },
  bass: {
    intro: when(from3, "r-----o-----", "r-----------"),
    verse1: "r-----o-----",
    chorus1: when(fourth, "r-o-r-o-r-o-", "r----ro-----"),
    verse2: "r-----o-----",
    break: BREAK_BASS,
    bridge: DRIFT_BASS,
    chorus2: when(fourth, "r-o-r-o-r-o-", "r----ro-----"),
    outro: DRIFT_BASS,
    end: END_BASS,
  },
  comp: {
    intro: THREE,
    verse1: THREE,
    chorus1: when(fourth, SIX, "x-----x-----"),
    verse2: THREE,
    break: BREAK_COMP,
    bridge: "x-------x-------",
    chorus2: when(fourth, SIX, "x-----x-----"),
    outro: "x-------x-------",
    end: "x---------------",
  },
  compVel: { x: 0.85, g: 0.5 },
};

/** Indie: the rock kit, clean-guitar strums, a shuffling hi-hat, a marimba tune. */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "marimba" },
  gain: { kick: 0.3, snare: 0.3, hats: 0.19, perc: 0.22, cym: 0.18, bass: 0.38, chords: 0.26, lead: 1 },
  room: 0.3,
  lpf: 750,
  colour: "tri",
  kick: {
    intro: when(from3, "X.....X.....", R12),
    verse1: "X.....X.....",
    chorus1: when(fourth, "X...X...X...", "X..x.xX....."),
    verse2: "X.....X.....",
    break: BREAK_KICK,
    ...DRIFT,
    chorus2: when(fourth, "X...X...X...", "X..x.xX....."),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (last(i, n) ? "...X.....xXX" : i === 2 ? "...X.....X.." : R12),
    verse1: when(fourth, "...X.....xXX", "...X.....X.."),
    chorus1: when(fourth, "..X...X...X.", "...X.....X.."),
    verse2: when(fourth, "...X.....xXX", "...X.....X.."),
    break: BREAK_SNARE,
    bridge: when(last, "....X.......XxXX", "....X.......X..."),
    chorus2: when(fourth, "..X...X...X.", "...X.....X.."),
    outro: "....X.......X...",
  },
  hats: {
    intro: when(from3, "X.xX.xX.xX.x", R12),
    verse1: "X.xX.xX.xX.x",
    chorus1: "OgxOgxOgxOgx",
    verse2: "X.xX.xX.xX.x",
    break: BREAK_HATS,
    bridge: "X.x.X.x.X.x.X.x.",
    chorus2: "OgxOgxOgxOgx",
    outro: "X.x.X.x.X.x.X.x.",
  },
  perc: {
    intro: COWBELL,
    verse1: COWBELL,
    chorus1: when(fourth, "T.T.T.T.T.T.", "T.tT.tT.tT.t"),
    verse2: COWBELL,
    bridge: "SsssSsssSsssSsss",
    chorus2: when(fourth, "T.T.T.T.T.T.", "T.tT.tT.tT.t"),
    outro: "SsssSsssSsssSsss",
  },
  cym: {
    intro: (i) => (i === 2 ? "C..........." : R12),
    verse1: when(firstOf, "C...........", R12),
    chorus1: when(firsts, "C...........", R12),
    verse2: when(firstOf, "C...........", R12),
    break: BREAK_CYM,
    bridge: when(firstOf, "C...............", R16),
    chorus2: when(firsts, "C...........", R12),
    outro: when(firstOf, "C...............", R16),
    end: "C...............",
  },
  bass: {
    intro: when(from3, "r-----r-----", "r-----------"),
    verse1: "r-----r-----",
    chorus1: when(fourth, "r-r-r-r-r-r-", "r-rr-rr-rr-r"),
    verse2: "r-----r-----",
    break: BREAK_BASS,
    bridge: DRIFT_BASS,
    chorus2: when(fourth, "r-r-r-r-r-r-", "r-rr-rr-rr-r"),
    outro: DRIFT_BASS,
    end: END_BASS,
  },
  comp: {
    intro: THREE,
    verse1: THREE,
    chorus1: when(fourth, SIX, "x-xx-xx-xx-x"),
    verse2: THREE,
    break: BREAK_COMP,
    bridge: "x-x-x-x-x-x-x-x-",
    chorus2: when(fourth, SIX, "x-xx-xx-xx-x"),
    outro: "x-x-x-x-x-x-x-x-",
    end: "x---------------",
  },
  compVel: { x: 0.8, g: 0.5 },
};

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes. The ride plays its spang-a-lang as written triplets on the
 * twelve-note grid (no `.swingBy()`), the hi-hat foot 2 and 4, cross-stick in the verses; straight eighths on the ride
 * under the drift.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes" },
  gain: { kick: 0.2, snare: 0.37, hats: 0.23, perc: 0.26, cym: 0.23, bass: 0.67, chords: 0.36, lead: 0.4 },
  room: 0.35,
  lpf: 900,
  colour: "col",
  kick: {
    intro: when(from3, "X.....X.....", R12),
    verse1: "X.....X.....",
    chorus1: when(fourth, "X...X...X...", "X.....X..x.."),
    verse2: "X.....X.....",
    break: BREAK_KICK,
    ...DRIFT,
    chorus2: when(fourth, "X...X...X...", "X.....X..x.."),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (last(i, n) ? "...R.....gxX" : i === 2 ? "...R.....R.." : R12),
    verse1: when(fourth, "...R.....gxX", "...R.....R.."),
    chorus1: when(fourth, "..X...X...X.", "...X..g..X.g"),
    verse2: when(fourth, "...R.....gxX", "...R..g..R.."),
    break: BREAK_SNARE,
    bridge: when(last, "....R.......XxXX", "....R.......R..."),
    chorus2: when(fourth, "..X...X...X.", "...X..g..X.g"),
    outro: "....R.......R...",
  },
  // The hi-hat foot on 2 and 4.
  hats: {
    intro: when(from3, "...X.....X..", R12),
    verse1: "...X.....X..",
    chorus1: "...X.....X..",
    verse2: "...X.....X..",
    break: "....X.......X...",
    bridge: "....X.......X...",
    chorus2: "...X.....X..",
    outro: "....X.......X...",
  },
  perc: {
    intro: COWBELL,
    verse1: COWBELL,
    chorus1: when(fourth, "T.T.T.T.T.T.", "...T.....T.."),
    verse2: COWBELL,
    bridge: "S.s.S.s.S.s.S.s.",
    chorus2: when(fourth, "T.T.T.T.T.T.", "...T.....T.."),
    outro: "S.s.S.s.S.s.S.s.",
  },
  cym: {
    intro: (i) => (i < 2 ? R12 : i === 2 ? "Z..R.rR..R.r" : "R..R.rR..R.r"),
    verse1: when(firstOf, "Z..R.rR..R.r", "R..R.rR..R.r"),
    chorus1: when(firsts, "Z..R.rR..R.r", "R..R.rR..R.r"),
    verse2: when(firstOf, "Z..R.rR..R.r", "R..R.rR..R.r"),
    break: BREAK_CYM,
    bridge: when(firstOf, "Z.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    chorus2: when(firsts, "Z..R.rR..R.r", "R..R.rR..R.r"),
    outro: when(firstOf, "Z.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    end: "C...............",
  },
  bass: {
    intro: when(from3, "r-----f-----", "r-----------"),
    verse1: "r-----f-----",
    chorus1: when(fourth, "r-o-r-f-r-o-", "r-----f--o--"),
    verse2: "r-----f-----",
    break: BREAK_BASS,
    bridge: DRIFT_BASS,
    chorus2: when(fourth, "r-o-r-f-r-o-", "r-----f--o--"),
    outro: DRIFT_BASS,
    end: END_BASS,
  },
  comp: {
    intro: THREE,
    verse1: THREE,
    chorus1: when(fourth, SIX, "x-----.x----"),
    verse2: THREE,
    break: BREAK_COMP,
    bridge: "x---------------",
    chorus2: when(fourth, SIX, "x-----.x----"),
    outro: "x---------------",
    end: "x---------------",
  },
  compVel: { x: 0.8, g: 0.5 },
};

/** Funk: Oak's 808, clavinet, finger bass, organ tune; the twelve-note grid ghosted on the hats and the snare. */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ" },
  gain: { kick: 0.33, snare: 0.29, hats: 0.17, perc: 0.18, cym: 0.14, bass: 0.63, chords: 0.55, lead: 0.52 },
  room: 0.2,
  lpf: 850,
  colour: "col",
  kick: {
    intro: when(from3, "X.....X.....", R12),
    verse1: "X.....X.....",
    chorus1: when(fourth, "X...X...X...", "X..x.xX..x.."),
    verse2: "X.....X.....",
    break: BREAK_KICK,
    ...DRIFT,
    chorus2: when(fourth, "X...X...X...", "X..x.xX..x.."),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (last(i, n) ? "...X..g..XxX" : i === 2 ? "...X..g..X.g" : R12),
    verse1: when(fourth, "...X..g..XxX", "...X..g..X.g"),
    chorus1: when(fourth, "..X...X...X.", "...X.g...X.g"),
    verse2: when(fourth, "...X..g..XxX", "...X..g..X.g"),
    break: BREAK_SNARE,
    bridge: when(last, "....X..g....XxXX", "....X..g....X..g"),
    chorus2: when(fourth, "..C...C...C.", "...C.g...C.g"),
    outro: "....X..g....X..g",
  },
  hats: {
    intro: when(from3, "XgxXgxXgxXgx", R12),
    verse1: "XgxXgxXgxXgx",
    chorus1: "XgxXgxXgOXgx",
    verse2: "XgxXgxXgxXgx",
    break: BREAK_HATS,
    bridge: "XgxgXgxgXgxgXgxg",
    chorus2: "XgxXgxXgOXgx",
    outro: "XgxgXgxgXgxgXgxg",
  },
  perc: {
    intro: COWBELL,
    verse1: COWBELL,
    chorus1: when(fourth, "S.S.S.S.S.S.", "SssSssSssSss"),
    verse2: COWBELL,
    bridge: "SsssSsssSsssSsss",
    chorus2: when(fourth, "S.S.S.S.S.S.", "SssSssSssSss"),
    outro: "SsssSsssSsssSsss",
  },
  cym: {
    intro: (i) => (i === 2 ? "C..........." : R12),
    verse1: when(firstOf, "C...........", R12),
    chorus1: when(firsts, "C...........", R12),
    verse2: when(firstOf, "C...........", R12),
    break: BREAK_CYM,
    bridge: when(firstOf, "C...............", R16),
    chorus2: when(firsts, "C...........", R12),
    outro: when(firstOf, "C...............", R16),
    end: "C...............",
  },
  // Locked with the kick (the verses' two, the choruses' pushes), held from hit to hit so every clav stab has its root
  // under it.
  bass: {
    intro: when(from3, "r-----o-----", "r-----------"),
    verse1: "r-----o-----",
    chorus1: when(fourth, "r-o-r-o-r-o-", "r--r-rr--r-o"),
    verse2: "r-----o-----",
    break: BREAK_BASS,
    bridge: DRIFT_BASS,
    chorus2: when(fourth, "r-o-r-o-r-o-", "r--r-rr--r-o"),
    outro: DRIFT_BASS,
    end: END_BASS,
  },
  comp: {
    intro: "x...x...x...",
    verse1: "x...x...x...",
    chorus1: when(fourth, "x.x.x.x.x.x.", "..x..x..x..x"),
    verse2: "x...x...x...",
    break: BREAK_COMP,
    bridge: "x.......x.......",
    chorus2: when(fourth, "x.x.x.x.x.x.", "..x..x..x..x"),
    outro: "x.......x.......",
    end: "x---------------",
  },
  compVel: { x: 0.8, g: 0.5 },
};

// Electronic: a sine sub under the verses, the drift and the ending, the acid line (the TB-303 recipe: a sawtooth under
// a resonant ladder filter whose envelope opens on an accent pattern) in the choruses and the break, a supersaw pad
// that swells after each hit (verses, drift), sawtooth stabs ducked on each beat in the choruses, and a square pluck
// whose echo is two thirds of a beat long, so it lands on the twelve-note grid.
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*6").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The break: the acid's filter envelope opening wider bar by bar into the drift. */
const ACID_RISING =
  '.lpq(12).ftype("ladder").lpenv(saw.range(1, 5).slow(4)).lpd(.14).lps(0).decay(.2).sustain(.4)';
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** Each beat's first triplet ducked, as a sidechained record pumps. */
const PUMP = '.postgain("[.6 1 1]*4")';
/**
 * The 808 kick (funk's `oak808`, electronic's choruses and drift) rings for seconds with no choke: hits a beat apart
 * pile up, by up to 7 dB and by the tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM).
 * A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
/** Every acid note of the chorus is the root or its octave, so each stab has its root under it. */
const ACID_BAR = "r-ro-rr-or-r";

/**
 * Electronic: the lo-fi kit in the intro and the verses (a dusty beat under the sub and the pad, the cowbell's three on
 * top), Oak's 808 in the choruses and the drift, the 909 in the break and the last hit. Straight, four-note chords.
 */
const ELECTRONIC: Kit = {
  bank: {
    intro: "lofikit",
    verse1: "lofikit",
    chorus1: "oak808",
    verse2: "lofikit",
    break: "oak909",
    bridge: "oak808",
    chorus2: "oak808",
    outro: "oak808",
    end: "oak909",
  },
  sounds: { bass: "sine", chords: "supersaw", lead: "square" },
  gain: { kick: 0.27, snare: 0.18, hats: 0.12, perc: 0.15, cym: 0.11, bass: 0.38, chords: 0.13, lead: 0.49 },
  room: 0.2,
  lpf: 700,
  colour: "col",
  kick: {
    intro: when(from3, "X.....X.....", R12),
    verse1: "X.....X.....",
    // Four on the floor, and in every fourth bar six kicks: the beat seems to speed up.
    chorus1: when(fourth, "X.X.X.X.X.X.", "X..X..X..X.."),
    verse2: "X.....X.....",
    break: BREAK_KICK,
    ...DRIFT,
    chorus2: when(fourth, "X.X.X.X.X.X.", "X..X..X..X.."),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (last(i, n) ? "...X.....gxX" : i === 2 ? "...X.....X.." : R12),
    verse1: when(fourth, "...X.....gxX", "...X.....X.."),
    chorus1: when(fourth, "..c...c...c.", "...c.....c.."),
    verse2: when(fourth, "...X.....gxX", "...X.....X.."),
    break: "............c.c.",
    bridge: when(last, "....c.......cccc", "....c.......c..."),
    chorus2: when(fourth, "..C...C...C.", "...C.....C.."),
    outro: "....c.......c...",
  },
  hats: {
    intro: when(from3, "XggxggXggxgg", R12),
    verse1: "XggxggXggxgg",
    chorus1: "gxggxggxggxg",
    verse2: "XggxggXggxgg",
    break: BREAK_HATS,
    bridge: "gxgOgxgOgxgOgxgO",
    chorus2: "gxggxggxggxg",
    outro: "gxgOgxgOgxgOgxgO",
  },
  perc: {
    intro: COWBELL,
    verse1: COWBELL,
    chorus1: when(fourth, "S.S.S.S.S.S.", "s.Ss.Ss.Ss.S"),
    verse2: COWBELL,
    bridge: "SsssSsssSsssSsss",
    chorus2: when(fourth, "S.S.S.S.S.S.", "s.Ss.Ss.Ss.S"),
    outro: "SsssSsssSsssSsss",
  },
  cym: {
    intro: (i) => (i === 2 ? "C..........." : R12),
    verse1: when(firstOf, "C...........", R12),
    chorus1: when(firsts, "C...........", R12),
    verse2: when(firstOf, "C...........", R12),
    break: BREAK_CYM,
    bridge: when(firstOf, "C...............", R16),
    chorus2: when(firsts, "C...........", R12),
    outro: when(firstOf, "C...............", R16),
    end: "C...............",
  },
  bass: {
    // The sub strikes with the kick, held in between.
    intro: when(from3, "r-----r-----", "r-----------"),
    verse1: "r-----r-----",
    chorus1: when(fourth, "r-o-r-o-r-o-", ACID_BAR),
    verse2: "r-----r-----",
    break: BREAK_BASS,
    bridge: DRIFT_BASS,
    chorus2: when(fourth, "r-o-r-o-r-o-", ACID_BAR),
    outro: DRIFT_BASS,
    end: END_BASS,
  },
  comp: {
    intro: THREE,
    verse1: THREE,
    chorus1: when(fourth, "x.x.x.x.x.x.", "..x..x..x..x"),
    verse2: THREE,
    break: BREAK_COMP,
    // The pad struck on every beat, swelling after each hit.
    bridge: "x---x---x---x---",
    chorus2: when(fourth, "x.x.x.x.x.x.", "..x..x..x..x"),
    outro: "x---x---x---x---",
    end: "x---------------",
  },
  compVel: { x: 0.85, g: 0.5 },
  synth: {
    bass: {
      intro: `.s("sine")${SUB}`,
      verse1: `.s("sine")${SUB}`,
      chorus1: `.s("sawtooth")${ACID}`,
      verse2: `.s("sine")${SUB}`,
      break: `.s("sawtooth")${ACID_RISING}`,
      bridge: `.s("sine")${SUB}`,
      chorus2: `.s("sawtooth")${ACID}`,
      outro: `.s("sine")${SUB}`,
      end: `.s("sine")${SUB}`,
    },
    chords: {
      intro: `.s("supersaw")${PAD}`,
      verse1: `.s("supersaw")${PAD}`,
      chorus1: `.s("sawtooth")${STAB}${PUMP}`,
      verse2: `.s("supersaw")${PAD}`,
      break: `.s("sawtooth")${STAB}`,
      bridge: `.s("supersaw")${PAD}`,
      chorus2: `.s("sawtooth")${STAB}${PUMP}`,
      outro: `.s("supersaw")${PAD}`,
      end: `.s("supersaw").attack(.12).decay(1.5).sustain(.6)`,
    },
    // An echo two thirds of a beat long at 96 BPM (.42 s): it lands on the twelve-note grid.
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.42).delayfeedback(.35)",
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

/** One flavour's song: the tune, the chords, the bass, then the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const syn = k.synth;
  const bankName = (id: SectionId) => (typeof k.bank === "string" ? k.bank : k.bank[id]);
  const bankOf = (id: SectionId) => (typeof k.bank === "string" ? "" : `.bank("${k.bank[id]}")`);
  const drumTail = typeof k.bank === "string" && k.bank ? `.bank("${k.bank}")` : "";
  const drums = (by: Drums, map: DrumMap): BySection =>
    mapSections((id) => {
      const b = by[id];
      return b === undefined ? null : `${drumSection(id, b, map)}${bankOf(id)}`;
    });
  const chords = mapSections((id) => {
    const b = k.comp[id];
    if (b === undefined) return null;
    return `${pitched(
      id,
      chordEvents(id, b, (c) => c[k.colour], k.compVel),
    )}${syn?.chords[id] ?? ""}`;
  });
  const bass = mapSections((id) => {
    const b = k.bass[id];
    if (b === undefined) return null;
    return `${pitched(id, bassEvents(id, b))}${syn?.bass[id] ?? ""}`;
  });
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: BySection): BySection =>
    mapSections((id) => {
      const p = by[id];
      return p && /^(RolandTR808|oak808)$/.test(bankName(id)) ? `${p}${KICK_808}` : p;
    });
  const tracks = [
    track(
      "mel",
      MEL,
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(.6).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${syn ? "" : `.s("${k.sounds.chords}")`}.gain(${num(k.gain.chords)}).pan(.4).room(${num(k.room)})`,
    ),
    track("bass", bass, `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`),
    track("kick", kick808(drums(k.kick, KICK)), `${drumTail}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare, SNARE), `${drumTail}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats, HATS), `${drumTail}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc, PERC), `${drumTail}.gain(${num(k.gain.perc)}).pan(.35)`),
    track("perc2", drums(k.cym, PERC2), `${drumTail}.gain(${num(k.gain.cym)})`),
  ];
  return [...tracks.flatMap((t) => t.consts), "", ...tracks.map((t) => t.line)].join("\n");
}

const take = (
  lesson: TakeStep["lesson"],
  sections: SectionId[],
  parts: SongPartId[],
  today: string,
  oakKeeps: SongPartId[],
): TakeStep => ({ lesson, kind: "take", sections, parts, oakKeeps, startFrom: "oak", today });

export const R2_SONG = defineUnitSong({
  id: "usong.R2",
  unit: "R2",
  version: 1,
  title: "Crosscurrent",
  meter: "4/4",
  key: { tonic: "C", mode: "minor" },
  bpm: 96,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
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
    // The cowbell's three (R2.L04's `perc:` line) and the hand percussion; the cymbals and toms are a part of their
    // own, so a learner's cowbell takes the percussion and Oak's crashes keep marking the sections.
    {
      id: "perc",
      label: "perc",
      role: "drums",
      sounds: ["cb", "sh", "tb", "conga", "bongo"],
      name: "Percussion",
      plainName: "Percussion",
    },
    {
      id: "cymbals",
      label: "perc2",
      role: "drums",
      sounds: ["cr", "rd", "lt", "mt", "ht"],
      name: "Cymbals and toms",
      plainName: "Cymbals and toms",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // One meter per song (contracts §5.11): the 5/4, 7/8 and 9/8, and 6/8 lessons are side steps; the two 4/4 lessons
  // hand over whole sections (AUTHORING §23.6: every R2 Make carries its own drums, bass and chords). Each take plays
  // chords, so Oak keeps only its tune, clash-checked against the learner's Rhodes, and its drums the take leaves.
  plan: [
    {
      lesson: "R2.L01",
      kind: "side",
      reason:
        "This lesson's grooves count five and seven to a bar, and the song counts four, so your groove stays a sketch of its own.",
    },
    {
      lesson: "R2.L02",
      kind: "side",
      reason:
        "This lesson's grooves count seven and nine eighth notes to a bar, and the song counts four beats, so your groove stays a sketch of its own.",
    },
    {
      lesson: "R2.L03",
      kind: "side",
      reason:
        "This lesson plays in 6/8, six eighth notes to a bar over the band's drums, and the song counts four beats, so your piece stays a sketch of its own.",
    },
    take(
      "R2.L04",
      ["verse1", "verse2"],
      ["kick", "perc", "bass", "chords"],
      "Your loop, the cowbell's three against the kick's two, plays both verses of the song under Oak's tune.",
      ["lead"],
    ),
    take(
      "R2.L05",
      ["bridge", "outro"],
      ["kick", "snare", "hats", "bass", "chords"],
      "Your loop, with a kick that crosses the bar line, plays the D minor bridge and the ending.",
      ["lead"],
    ),
  ],
  // R2 has no checkpoint of its own (R.CP closes the whole track, after R3): the song is released after its last lesson.
  releaseAfter: "R2.L05",
});

export default R2_SONG;
