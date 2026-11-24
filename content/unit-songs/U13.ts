// Song 13, "Ahead of the beat" (docs/design/songs/makes-core-c.md §3 "U13 song: the groove"; AUTHORING §23). C major,
// 4/4, 84 BPM, 54 bars (2:34): the rhythm unit gets a soul-funk record whose every section is one of its grooves.
//
//   intro 4         verse1 8              stop 1   chorus1 8      verse2 8   bridge 8 (in threes)   break 4
//   C^7 Am7 F^7 G7  (C^7 Am7 F^7 G7)×2    (fill)   (Dm7 G7)×4     = verse1   (C^7 Am7 Dm7 G7)×2     Dm7 G7 Dm7 G7
//
//   chorus2 8   outro 4          end 1
//   = chorus1   C^7 Am7 F^7 G7   C^7
//
// Oak plays each lesson's idea before the learner takes it over:
// - The intro, the verses and the ending push: the kick, the bass and the chords land together on the "and" of 4
//   and hold across the bar line, so every chord but a section's first arrives an eighth early (U13.L01's push).
//   In the intro the chords come in on that push, as a pushed Rhodes line does when it starts. Each verse ends with
//   one more push, a short hit on C^7: after the first, a one-bar fill on the snare (ghost notes swelling to accents)
//   leads into the chorus; after the second, the bridge comes in on C^7.
// - The verse tune leans (U13.L03): it starts on beat 2, and its long notes start on the "and" of 4, with the band's
//   push, and ring across the bar line into the chord they belong to (seven times in eight bars; the eighth push is
//   a short E on the C^7 hit).
// - The choruses are U13.L02's sixteenth-note vamp, Dm7 G7: the snare hits 2 and 4 with ghost notes on the "a" of 2,
//   the "e" of 3 and the "a" of 4 (velocity .3), the hats breathe inside every beat, and a guitar scratches every
//   sixteenth, loud on the third and sixth of each half bar, under a hook in sixteenths.
// - The bridge rolls in threes (U13.L05): the chords and the hats (jazz-soul: the ride) play three to every beat, the
//   snare rolls three hits into beat 4 of bars 4 and 8, and the tune moves in long notes and threes. Still 4/4.
// - The break is U13.L06's call and answer: the kick of bars 1–2 is the funk groove that lesson dictates
//   ([bd ~ ~ bd ~ ~ bd ~] [bd ~ ~ ~ ~ bd bd ~]), bars 3–4 answer with kicks on the "and"s, the bass on every kick,
//   and the last kick pushes into the last chorus.
//
// The song stays straight in every flavour (contracts §5.11 rule 7: U13's takes are straight grooves the learner
// writes); there is no `.swingBy()` anywhere, jazz-soul included. The chords are seventh chords in every flavour,
// because the unit's harmony is U12's sevenths by name (every U13 starter writes C^7 Am7 F^7 G7 or Dm7 G7), not a
// kit's colour: Cmaj7 C E G B, Am7 C E G A, Fmaj7 F A C E, G7 B D F G, Dm7 C D F A, voiced close and low under the
// tune; the choruses lift to Dm7 F A C D and G7 F G B D. Wherever one of these is struck, the bass sounds its root
// (Am7 is C6 and Dm7 is F6 without it). The guitar plays triads above them, which read alone (C: G C E, Am: A C E,
// F: F A C, G: G B D, Dm: F A D). The tune and the bass touch no chord or guitar note a half step away, at any length,
// in any flavour (AUTHORING §13 asks it of held notes): the tune has no C over Cmaj7 or G7, no F over Cmaj7, Am7 or
// Fmaj7, no B under the C of Am7 or Dm7. That holds against the learner's own Rhodes too (`chord(changes).voicing()`:
// C^7 C3 E4 G4 B4, Am7 A3 C4 E4 G4 C5, F^7 F3 C4 E4 A4 C5, G7 G3 D4 F4 G4 B4, Dm7 F3 C4 D4 F4 C5), so Oak's tune and
// guitar keep playing over the learner's takes (`oakKeeps`, clash-checked). Every flavour plays the same notes (tune,
// bass roots on every downbeat, chord roots); a flavour changes sounds, grooves, comp and bass rhythms. Gains are levelled by songs.pw.ts
// (budget sound-songs.json), so the learner's line sits on top.
// Every claim here is read off the evaluated events (content/validate/unit-songs.ts and the task report's audit).
//
// The tempo is 84: U13.L01 accepts 84 to 108 and U13.L05 60 to 84, so a song at 84 keeps its tempo when each Make
// opens (the Make's tempo line is set to the song's when its own rule accepts it, AUTHORING §23.1 rule 5).
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
  // One bar of fill after the first verse's last push: the chorus starts on Dm7, so a pushed verse loop's last
  // chord (C^7, on the "and" of 4) rings out over drums alone instead of over the chorus.
  { id: "stop", type: "break", bars: 1 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "bridge", type: "bridge", bars: 8 },
  // U13.L06's call and answer: four bars, the length of its loop.
  { id: "break", type: "break", bars: 4 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
  { id: "end", type: "outro", bars: 1 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const sectionOf = (id: SectionId) => SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number];
/** Slots in a bar: sixteenths, and twelve (three to the beat) in the bridge. */
const stepsOf = (id: SectionId): number => (id === "bridge" ? 12 : 16);

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `kickBreak2` for the second section of type break), `silence` where it rests, and one `arrange()`
 * over every section of the song.
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

type ChordName = "C" | "Am" | "F" | "G" | "Dm";
interface Chord {
  /** Bass: root, fifth, octave. */
  r: string;
  f: string;
  o: string;
  /** Four notes, close and low (verses, bridge, break, ending). */
  low: string;
  /** The choruses' lift. */
  high?: string;
  /** The guitar's triad. */
  gtr: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  C: { r: "c2", f: "g2", o: "c3", low: "c3,e3,g3,b3", gtr: "g3,c4,e4" },
  Am: { r: "a1", f: "e2", o: "a2", low: "c3,e3,g3,a3", gtr: "a3,c4,e4" },
  F: { r: "f1", f: "c2", o: "f2", low: "f3,a3,c4,e4", gtr: "f3,a3,c4" },
  G: { r: "g1", f: "d2", o: "g2", low: "b2,d3,f3,g3", high: "f3,g3,b3,d4", gtr: "g3,b3,d4" },
  Dm: { r: "d2", f: "a2", o: "d3", low: "c3,d3,f3,a3", high: "f3,a3,c4,d4", gtr: "f3,a3,d4" },
};
const VERSE: ChordName[] = ["C", "Am", "F", "G"];
const VAMP: ChordName[] = ["Dm", "G"];
const SLOW: ChordName[] = ["C", "Am", "Dm", "G"];
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: VERSE,
  verse1: [...VERSE, ...VERSE],
  stop: ["C"],
  chorus1: [...VAMP, ...VAMP, ...VAMP, ...VAMP],
  verse2: [...VERSE, ...VERSE],
  bridge: [...SLOW, ...SLOW],
  break: [...VAMP, ...VAMP],
  chorus2: [...VAMP, ...VAMP, ...VAMP, ...VAMP],
  outro: VERSE,
  end: ["C"],
};
/** Where a section's last push lands: the first chord after it (the verses push C^7 into the fill, the break Dm7). */
const EXIT: Partial<Record<SectionId, ChordName>> = { verse1: "C", verse2: "C", break: "Dm" };
const HIGH = new Set<SectionId>(["chorus1", "chorus2"]);

// ---- Patterns on a grid -------------------------------------------------------------------------------------
//
// A part is written as one string of slots per bar (sixteen, or twelve in the bridge) and read as events: a letter
// starts a note, `-` holds it into the next slot (across the bar line too, which is how a push is tied over), `.`
// is silence. A section becomes one sequence `[…]` of weighted notes, slowed over its bars.

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
      throw new Error(`U13 ${id} bar ${i + 1}: ${bar.length} slots, not ${steps}: "${bar}"`);
    out += bar;
  }
  return out;
}

/** Events from slots; `value(char, slot)` names the note (or `null` to ignore the letter) and its velocity. */
function eventsOf(
  slots: string,
  value: (c: string, slot: number) => { tok: string; vel: number } | null,
): Ev[] {
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
    const v = value(c, s);
    if (!v) continue;
    cur = { at: s, len: 1, ...v };
    out.push(cur);
  }
  return out;
}

/**
 * A weighted sequence over `total` slots, and the matching velocities (a rest's velocity is never read). Runs of the
 * same one-slot note fold to `tok!k`, rests to `~@k`.
 */
function sequence(evs: readonly Ev[], total: number): { notes: string; vel: string } {
  const notes: [string, number][] = [];
  const vel: [string, number][] = [];
  const push = (out: [string, number][], tok: string, len: number) => out.push([tok, len]);
  let t = 0;
  for (const e of evs) {
    if (e.at > t) {
      push(notes, "~", e.at - t);
      push(vel, "1", e.at - t);
    }
    push(notes, e.tok, e.len);
    push(vel, num(e.vel), e.len);
    t = e.at + e.len;
  }
  if (t < total) {
    push(notes, "~", total - t);
    push(vel, "1", total - t);
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
 * otherwise one sequence over the whole section, slowed over its bars, so a push can be tied across the bar line.
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

/**
 * Chords from slots: `x` the bar's chord, `n` the next bar's (a push; on a section's last bar, the chord after the
 * section), `g` the bar's chord softly.
 */
function chordEvents(id: SectionId, b: Bars, voicing: (c: Chord, id: SectionId) => string, vel: Vel): Ev[] {
  const steps = stepsOf(id);
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const bar = Math.floor(s / steps);
    let name: ChordName | undefined;
    if (c === "x" || c === "g" || c === "X") name = prog[bar];
    else if (c === "n") name = bar + 1 < prog.length ? prog[bar + 1] : EXIT[id];
    if (!name) throw new Error(`U13 ${id}: no chord for "${c}" in bar ${bar + 1}`);
    return { tok: `[${voicing(CHORD[name], id)}]`, vel: vel[c] ?? 1 };
  });
}

/** Bass from slots: `r` root, `f` fifth, `o` octave of the bar's chord, `N` the next chord's root (a push). */
function bassEvents(id: SectionId, b: Bars): Ev[] {
  const steps = stepsOf(id);
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const bar = Math.floor(s / steps);
    const here = prog[bar] as ChordName;
    if (c === "N") {
      const next = bar + 1 < prog.length ? prog[bar + 1] : EXIT[id];
      if (!next) throw new Error(`U13 ${id}: a push in bar ${bar + 1} with nothing after it`);
      return { tok: CHORD[next].r, vel: 1 };
    }
    const k = ({ r: "r", f: "f", o: "o" } as const)[c as "r" | "f" | "o"];
    if (!k) throw new Error(`U13 ${id}: "${c}" in a bass line`);
    return { tok: CHORD[here][k], vel: c === "r" ? 1 : 0.9 };
  });
}

/** Velocity by letter. */
type Vel = Readonly<Record<string, number>>;

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// In sixteenths, `note:length`. The verse starts on beat 2 with a cell that climbs and falls (E G A G E) and pushes
// a D across the bar line into Am7, where it falls to C: a note that arrives on the "and" of 4 and belongs to the
// next bar, eight times in eight bars, as the band pushes. The answer leans the same way (E into Fmaj7, its major
// seventh; D into G7; G into the second half), and the verse ends with F falling to E on the last push. The chorus
// hook is two bars in sixteenths, D D F, D C A over Dm7 and B D F G, F D over G7, then the same a fifth higher, and
// it rests on G. The bridge sings long notes broken by threes and climbs to C over Dm7. Range G4 to C6, above the
// chords; held notes are chord tones, ninths or sixths of the chord under them.

const T_VERSE = [
  "~:4 e5:2 g5:2 a5:3 g5:1 e5:2 d5:6", // C^7, the D pushed into Am7
  "c5:4 a4:2 c5:2 d5:2 e5:8", // Am7, the E pushed into F^7
  // F^7, the D pushed into G7. Beat 4 holds A, not C: a learner's Rhodes pushed a whole beat (`.early(1/4)`, a
  // passing U13.L01 answer) brings G7's B in on beat 4, a half step under a C.
  "d5:2 c5:2 a4:4 d5:10",
  "~:2 b4:2 a4:2 g4:6", // G7, the G pushed into C^7
  "e5:2 g5:2 a5:3 g5:1 e5:2 d5:6",
  "c5:4 a4:2 c5:2 e5:2 g5:8",
  // F^7, the G pushed into G7. Not a B: under a Rhodes pushed only a sixteenth (`.early(1/16)`) F^7's C still
  // sounds for a sixteenth after the tune's push.
  "a5:2 g5:2 e5:2 d5:2 g5:6",
  "d5:2 f5:4 d5:2 ~:2 e5:2", // G7, F falling to E on the last push
];
const T_OUTRO = [
  "~:4 e5:2 g5:2 a5:3 g5:1 e5:2 d5:6",
  "c5:4 a4:2 c5:2 e5:2 g5:8",
  "a5:2 g5:2 e5:2 d5:2 g5:6",
  "d5:2 f5:4 d5:2 ~:4",
];
const HOOK = ["d5:2 d5:1 f5:3 d5:2 c5:2 a4:4 ~:2", "~:2 b4:2 d5:2 f5:2 g5:4 f5:2 d5:2"];
const T_CHORUS = [
  ...HOOK,
  ...HOOK,
  "a5:2 a5:1 c6:3 a5:2 g5:2 f5:4 ~:2",
  "~:2 g5:2 f5:2 d5:2 b4:4 d5:2 ~:2",
  HOOK[0] as string,
  "~:2 b4:2 d5:2 f5:2 g5:6 ~:2",
];
// Twelve slots a bar: a whole beat is three.
const T_BRIDGE = [
  "e5:6 d5:1 e5:1 g5:1 a5:3",
  "g5:6 e5:1 d5:1 c5:1 a4:3",
  "a4:1 c5:1 d5:1 f5:6 d5:1 c5:1 a4:1",
  "b4:6 a4:1 b4:1 d5:1 f5:3",
  "g5:6 a5:1 g5:1 e5:1 d5:3",
  "e5:6 g5:1 e5:1 d5:1 c5:3",
  "d5:3 f5:1 g5:1 a5:1 c6:6",
  "b5:6 a5:1 g5:1 f5:1 d5:3",
];

/** A tune section from `note:length` tokens (lengths in slots; a note may run across bar lines). */
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
  if (t !== total) throw new Error(`U13 tune ${id}: ${t} slots, not ${total}`);
  return out;
}

const MEL: BySection = {
  intro: null,
  verse1: pitched("verse1", tuneEvents("verse1", T_VERSE), false),
  stop: null,
  chorus1: pitched("chorus1", tuneEvents("chorus1", T_CHORUS), false),
  verse2: pitched("verse2", tuneEvents("verse2", T_VERSE), false),
  bridge: pitched("bridge", tuneEvents("bridge", T_BRIDGE), false),
  break: null,
  chorus2: pitched("chorus2", tuneEvents("chorus2", T_CHORUS), false),
  outro: pitched("outro", tuneEvents("outro", T_OUTRO), false),
  end: pitched("end", tuneEvents("end", ["e5:16"]), false),
};

// ---- The guitar (every flavour; its sound is the kit's) ------------------------------------------------------
//
// It joins in the second verse and the ending with short chops on the "and"s of 1, 2 and 3 and a last one a sixteenth
// before the bar line on the next chord, and scratches every sixteenth in the choruses, loud on the third and sixth
// of each half bar and a whisper (.25) in between, as U13.L02's guitar does. That last chop comes after every push
// a learner's Rhodes can make (`.early(1/16)`, `(1/8)` or `(1/4)`), so it always meets the chord it belongs to; on
// the "and" of 4 it would meet the old chord under a sixteenth push.
const GTR_CHOP = "..x...x...x....n";
const GTR_SCRATCH = "ggXggXggggXggXgg";
const GTR_VEL: Vel = { x: 0.8, n: 0.9, X: 1, g: 0.25 };
const gtrSlots: Partial<Record<SectionId, Bars>> = {
  verse2: GTR_CHOP,
  chorus1: GTR_SCRATCH,
  chorus2: GTR_SCRATCH,
  outro: (i, n) => (i === n - 1 ? "..x...x...x....." : GTR_CHOP),
};

// ---- The kits -----------------------------------------------------------------------------------------------

/** A drum letter: the sound (or a bracket of sounds) and its velocity. */
type DrumMap = Readonly<Record<string, readonly [string, number]>>;
const KICK: DrumMap = { X: ["bd", 1], x: ["bd", 0.8], g: ["bd", 0.5] };
const SNARE: DrumMap = {
  X: ["sd", 1],
  x: ["sd", 0.75],
  g: ["sd", 0.3],
  R: ["rim", 1],
  r: ["rim", 0.7],
  C: ["[sd,cp]", 0.9],
  c: ["cp", 0.85],
};
const HATS: DrumMap = { X: ["hh", 1], x: ["hh", 0.6], g: ["hh", 0.4], O: ["oh", 0.8], D: ["[hh hh]", 0.5] };
const PERC: DrumMap = {
  C: ["cr", 1],
  R: ["rd", 0.8],
  r: ["rd", 0.55],
  T: ["tb", 0.7],
  t: ["tb", 0.4],
  K: ["cb", 0.6],
  S: ["sh", 0.6],
  s: ["sh", 0.35],
  L: ["lt", 0.8],
  M: ["mt", 0.8],
  H: ["ht", 0.8],
  Z: ["[cr,rd]", 1],
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
      if (!hit) throw new Error(`U13 ${id}: drum letter "${c}"`);
      any = true;
      s.push(hit[0]);
      v.push(num(hit[1]));
    }
    sBars.push(`[${s.join(" ")}]`);
    vBars.push(`[${v.join(" ")}]`);
  }
  if (!any) throw new Error(`U13 ${id}: a drum section with no hit (write null)`);
  // Sounds and velocities fold over the same bars, so the two patterns keep one shape.
  const same = (a: number, b: number) => sBars[a] === sBars[b] && vBars[a] === vBars[b];
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
  bank: string | Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; lead: string; gtr: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    lead: number;
    gtr: number;
  };
  /** content/flavours.ts production: room, the bass low-pass. */
  room: number;
  lpf: number;
  kick: Drums;
  snare: Drums;
  hats: Drums;
  perc: Drums;
  /** Slots per section; a section absent rests. */
  bass: Readonly<Partial<Record<SectionId, Bars>>>;
  comp: Readonly<Partial<Record<SectionId, Bars>>>;
  compVel: Vel;
  /** Synth sounds and controls by section (electronic). */
  synth?: {
    bass: Partial<Record<SectionId, string>>;
    chords: Partial<Record<SectionId, string>>;
    lead: string;
    gtr: string;
  };
}

// The pushed sections (intro, verses, ending), as slots of one bar: the chord comes on the first bar's beat 1, or
// held over from the push before it, is struck again, and the next chord is pushed on the "and" of 4 (`n`, with the
// bass's `N` and the kick). The intro's first bar is silent until that push; the intro's and the ending's last bar
// push nothing (a fill leads on). The verses' last bar pushes C^7 as a short hit into the fill or the bridge.
interface Pushed {
  first: string;
  mid: string;
  hold: string;
}
const pushIntro =
  (p: Pushed, enter?: string): Bars =>
  (i, n) =>
    i === 0 ? (enter ?? p.first) : i === n - 1 ? p.hold : p.mid;
const pushVerse =
  (p: Pushed): Bars =>
  (i) =>
    i === 0 ? p.first : p.mid;
const pushOutro =
  (p: Pushed): Bars =>
  (i, n) =>
    i === 0 ? p.first : i === n - 1 ? p.hold : p.mid;
/** Every bar of the pushed sections, from one kit's three bars. */
const pushedSections = (p: Pushed, intro?: string): Partial<Record<SectionId, Bars>> => ({
  intro: pushIntro(p, intro),
  verse1: pushVerse(p),
  verse2: pushVerse(p),
  outro: pushOutro(p),
});
const CHORDS_ENTER = "..............n-";

/** The break's bass and chords on U13.L06's kicks: the call (bars 1–2), an answer, the last kick a push. */
const BREAK_KICK = ["X.....X.....X...", "X.........X.X...", "X.....x...x.....", "X.x.....X.....x."];
const BREAK_BASS = ["r-----r-----r---", "r---------r-r---", "r-----r---r-----", "r-r-----r-----N-"];
const BREAK_STABS = ["x...............", "x...............", "x...............", "x.............n."];
const at4 =
  (bars: readonly string[]): Bars =>
  (i) =>
    bars[i] as string;
/** Bars 4 and 8 of an eight-bar section, or the last bar. */
const fourth = (i: number) => i % 4 === 3;

// The fill: ghost notes on the snare swelling to accents over beats 3 and 4.
const FILL = "........ggxgxxXX";
const END_KICK = "X...............";

/** Pop: the default kit, piano, picked bass; a soul-pop band, straight. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", gtr: "cleangtr" },
  gain: { kick: 0.18, snare: 0.19, hats: 0.13, perc: 0.11, bass: 0.5, chords: 0.19, lead: 0.71, gtr: 0.64 },
  room: 0.25,
  lpf: 800,
  kick: {
    ...pushedSections({ first: "X.....x.X.....X.", mid: "......x.X.....X.", hold: "......x.X......." }),
    chorus1: (i) => (i % 2 ? "X.....x...x..x.." : "X.....x...x....."),
    chorus2: (i) => (i % 2 ? "X.....x...x..x.." : "X.....x...x....."),
    bridge: "X.....X.....",
    break: at4(BREAK_KICK),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (i === n - 1 ? "....X.......ggxX" : "....X.......X..."),
    verse1: (i) => (fourth(i) ? "....X..g....X.gg" : "....X..g....X..."),
    stop: FILL,
    chorus1: "....X..g.g..X..g",
    verse2: (i) => (fourth(i) ? "....X..g....X.gg" : "....X..g....X..."),
    bridge: (i) => (fourth(i) ? "...R.....XXX" : "...R.....R.."),
    break: "....X..g.g..X...",
    chorus2: "....X..g.g..X..g",
    outro: (i, n) => (i === n - 1 ? "....X.......ggxX" : "....X..g....X..."),
  },
  hats: {
    ...pushedSections({ first: "X.x.X.x.X.x.X.O.", mid: "X.x.X.x.X.x.X.O.", hold: "X.x.X.x.X.x.X.x." }),
    chorus1: "XgxgXgxgXgxgXgxg",
    chorus2: "XgxgXgxgXgxgXgxO",
    bridge: "XgxXgxXgxXgx",
    break: "X.x.X.x.X.x.X.x.",
  },
  perc: {
    intro: (i) => (i === 0 ? "C..............." : "................"),
    verse1: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    chorus1: (i) => (i === 0 ? "C.T...T...T...T." : "..T...T...T...T."),
    verse2: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    bridge: (i) => (i === 0 ? "C..........." : "............"),
    chorus2: (i) => (i === 0 ? "C.T.t.T.t.T.t.T." : "t.T.t.T.t.T.t.T."),
    outro: (i) => (i === 0 ? "C..............." : "................"),
    end: "C...............",
  },
  bass: {
    ...pushedSections({ first: "r-----r-f---o-N-", mid: "------r-f---o-N-", hold: "------r-f---o---" }),
    chorus1: "r--r..r-..r-.o..",
    chorus2: "r--r..r-..r-.o..",
    bridge: "r-----o-----",
    break: at4(BREAK_BASS),
    end: "r---------------",
  },
  comp: {
    ...pushedSections(
      { first: "x-----x-------n-", mid: "------x-------n-", hold: "------x---------" },
      CHORDS_ENTER,
    ),
    chorus1: "x.....x...x.....",
    chorus2: "x.....x...x.....",
    bridge: "xxxxxxxxxxxx",
    break: at4(BREAK_STABS),
    end: "x---------------",
  },
  compVel: { x: 0.85, n: 1, g: 0.5 },
};

/** Indie: the rock kit, clean-guitar strums in eighths, an organ tune, an acoustic guitar for the scratches. */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "organ", gtr: "acgtr" },
  gain: { kick: 0.24, snare: 0.24, hats: 0.15, perc: 0.14, bass: 0.3, chords: 0.21, lead: 0.84, gtr: 0.29 },
  room: 0.3,
  lpf: 750,
  kick: {
    ...pushedSections({ first: "X.....x.X.x...X.", mid: "......x.X.x...X.", hold: "......x.X.x....." }),
    chorus1: "X.....x...x.X...",
    chorus2: "X.....x...x.X...",
    bridge: "X.....X..X..",
    break: at4(BREAK_KICK),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (i === n - 1 ? "....X.......xgXX" : "....X.......X..."),
    verse1: (i) => (fourth(i) ? "....X.......X.xX" : "....X.......X..."),
    stop: FILL,
    chorus1: "....X..g.g..X..g",
    verse2: (i) => (fourth(i) ? "....X.......X.xX" : "....X.......X..."),
    bridge: (i) => (fourth(i) ? "...X.....XXX" : "...X.....X.."),
    break: "....X..g.g..X...",
    chorus2: "....X..g.g..X..g",
    outro: (i, n) => (i === n - 1 ? "....X.......xgXX" : "....X.......X..."),
  },
  hats: {
    ...pushedSections({ first: "X.x.X.x.X.x.X.O.", mid: "X.x.X.x.X.x.X.O.", hold: "X.x.X.x.X.x.X.x." }),
    chorus1: "X.O.X.O.X.O.X.O.",
    chorus2: "X.O.X.O.X.O.X.O.",
    bridge: "XgxXgxXgxXgx",
    break: "X.x.X.x.X.x.X.x.",
  },
  perc: {
    intro: (i) => (i === 0 ? "C..............." : "................"),
    verse1: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    chorus1: (i) => (i === 0 ? "C...T.......T..." : "....T.......T..."),
    verse2: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    // The floor tom rolls in threes under the bridge.
    bridge: (i) => (i === 0 ? "C..L.LL.LL.L" : "L..L.LL.LL.L"),
    chorus2: (i) => (i === 0 ? "C.t.T.t.t.t.T.t." : "t.t.T.t.t.t.T.t."),
    outro: (i) => (i === 0 ? "C..............." : "................"),
    end: "C...............",
  },
  bass: {
    ...pushedSections({ first: "r-r-r-r-o-o-o-N-", mid: "--r-r-r-o-o-o-N-", hold: "--r-r-r-o-o-o-o-" }),
    chorus1: "r-r-r-r-o-r-r-o-",
    chorus2: "r-r-r-r-o-r-r-o-",
    bridge: "r-----o-----",
    break: at4(BREAK_BASS),
    end: "r---------------",
  },
  comp: {
    ...pushedSections(
      { first: "x-x-x-x-x-x-x-n-", mid: "--x-x-x-x-x-x-n-", hold: "--x-x-x-x-x-x-x-" },
      CHORDS_ENTER,
    ),
    chorus1: "x-x-x-x-x-x-x-x-",
    chorus2: "x-x-x-x-x-x-x-x-",
    bridge: "xxxxxxxxxxxx",
    break: at4(BREAK_STABS),
    end: "x---------------",
  },
  compVel: { x: 0.8, n: 1, g: 0.5 },
};

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, a jazz guitar. Straight eighths and sixteenths (no swing in
 * this song). Cross-stick on 2 and 4, the hi-hat foot on 2 and 4 and the ride in the verses; snare with ghost notes in
 * the choruses; the ride in threes under the bridge.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", gtr: "jazzgtr" },
  gain: { kick: 0.23, snare: 0.43, hats: 0.27, perc: 0.27, bass: 0.79, chords: 0.42, lead: 0.47, gtr: 0.41 },
  room: 0.35,
  lpf: 900,
  kick: {
    ...pushedSections({ first: "X.......X.....X.", mid: "........X.....X.", hold: "........X......." }),
    chorus1: "X.....x...x.....",
    chorus2: "X.....x...x.....",
    bridge: "X.....X.....",
    break: at4(BREAK_KICK),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (i === n - 1 ? "....R.......ggxX" : "....R.......R..."),
    verse1: (i) => (fourth(i) ? "....R..g....R.gx" : "....R..g....R..."),
    stop: FILL,
    chorus1: "....X..g.g..X..g",
    verse2: (i) => (fourth(i) ? "....R..g....R.gx" : "....R..g....R..."),
    bridge: (i) => (fourth(i) ? "...R.....XXX" : "...R.....R.."),
    break: "....X..g.g..X...",
    chorus2: "....X..g.g..X..g",
    outro: (i, n) => (i === n - 1 ? "....R.......ggxX" : "....R..g....R..."),
  },
  // The hi-hat foot on 2 and 4; sixteenths in the choruses.
  hats: {
    ...pushedSections({ first: "....X.......X...", mid: "....X.......X...", hold: "....X.......X..." }),
    chorus1: "XgxgXgxgXgxgXgxg",
    chorus2: "XgxgXgxgXgxgXgxg",
    bridge: "...X.....X..",
    break: "....X.......X...",
  },
  perc: {
    intro: (i) => (i === 0 ? "Z.r.R.r.R.r.R.r." : "R.r.R.r.R.r.R.r."),
    verse1: (i) => (i === 0 ? "Z.r.R.r.R.r.R.r." : fourth(i) ? "R.r.R.r.R.r.R.C." : "R.r.R.r.R.r.R.r."),
    chorus1: (i) => (i === 0 ? "Z.r.R.r.R.r.R.r." : "R.r.R.r.R.r.R.r."),
    verse2: (i) => (i === 0 ? "Z.r.R.r.R.r.R.r." : fourth(i) ? "R.r.R.r.R.r.R.C." : "R.r.R.r.R.r.R.r."),
    bridge: (i) => (i === 0 ? "ZrrRrrRrrRrr" : "RrrRrrRrrRrr"),
    chorus2: (i) => (i === 0 ? "Z.rrR.rrR.rrR.rr" : "R.rrR.rrR.rrR.rr"),
    outro: (i) => (i === 0 ? "Z.r.R.r.R.r.R.r." : "R.r.R.r.R.r.R.r."),
    end: "C...............",
  },
  bass: {
    ...pushedSections({ first: "r-------f-----N-", mid: "--------f-----N-", hold: "--------f-------" }),
    chorus1: "r-----r---r-----",
    chorus2: "r-----r---r-----",
    bridge: "r-----o-----",
    break: at4(BREAK_BASS),
    end: "r---------------",
  },
  comp: {
    ...pushedSections(
      { first: "x--...x--.....n-", mid: "------x--.....n-", hold: "------x---------" },
      CHORDS_ENTER,
    ),
    chorus1: "..x-..x-..x-..x-",
    chorus2: "..x-..x-..x-..x-",
    bridge: "xxxxxxxxxxxx",
    break: at4(BREAK_STABS),
    end: "x---------------",
  },
  compVel: { x: 0.8, n: 0.95, g: 0.5 },
};

/** Funk: Oak's 808, clavinet, finger bass, organ tune, clean guitar; sixteenths, straight. */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", gtr: "cleangtr" },
  gain: { kick: 0.36, snare: 0.31, hats: 0.18, perc: 0.15, bass: 0.68, chords: 0.6, lead: 0.57, gtr: 0.61 },
  room: 0.2,
  lpf: 850,
  kick: {
    ...pushedSections({ first: "X..x..x.X.....X.", mid: "...x..x.X.....X.", hold: "...x..x.X..x...." }),
    chorus1: "X..x..x...x..x..",
    chorus2: "X..x..x...x..x..",
    bridge: "X.....X..X..",
    break: at4(BREAK_KICK),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (i === n - 1 ? "....X..g.g..gxXX" : "....X..g....X..g"),
    verse1: (i) => (fourth(i) ? "....X..g.g..X.gX" : "....X..g....X..g"),
    stop: FILL,
    chorus1: "....X..g.g..X..g",
    verse2: (i) => (fourth(i) ? "....X..g.g..X.gX" : "....X..g....X..g"),
    bridge: (i) => (fourth(i) ? "...X..g..XXX" : "...X..g..X.."),
    break: "....X..g.g..X..g",
    chorus2: "....C..g.g..C..g",
    outro: (i, n) => (i === n - 1 ? "....X..g.g..gxXX" : "....X..g....X..g"),
  },
  hats: {
    ...pushedSections({ first: "XgxgXgxgXgxgXgOg", mid: "XgxgXgxgXgxgXgOg", hold: "XgxgXgxgXgxgXgxg" }),
    chorus1: "XgxgXgxOXgxgXgxg",
    chorus2: "XgxgXgxOXgxgXgxO",
    bridge: "XgxXgxXgxXgx",
    break: "XgxgXgxgXgxgXgxg",
  },
  perc: {
    intro: (i) => (i === 0 ? "C..............." : "................"),
    verse1: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    chorus1: (i) => (i === 0 ? "C.K...K...K...K." : "..K...K...K...K."),
    verse2: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    bridge: (i) => (i === 0 ? "C.sS.sS.sS.s" : "S.sS.sS.sS.s"),
    chorus2: (i) => (i === 0 ? "C.K.s.K.s.K.s.K." : "s.K.s.K.s.K.s.K."),
    outro: (i) => (i === 0 ? "C..............." : "................"),
    end: "C...............",
  },
  bass: {
    ...pushedSections({ first: "r-.r..r-o-.r..N-", mid: "--.r..r-o-.r..N-", hold: "--.r..r-o-.r.o.." }),
    chorus1: "r--r--r---r--r-o",
    chorus2: "r--r--r---r--r-o",
    bridge: "r-----o-----",
    break: at4(BREAK_BASS),
    end: "r---------------",
  },
  comp: {
    ...pushedSections(
      { first: "x.....x.x.....n-", mid: "-.....x.x.....n-", hold: "-.....x.x......." },
      CHORDS_ENTER,
    ),
    chorus1: "..x..x.x..x..x.x",
    chorus2: "..x..x.x..x..x.x",
    bridge: "xxxxxxxxxxxx",
    break: at4(BREAK_STABS),
    end: "x---------------",
  },
  compVel: { x: 0.8, n: 1, g: 0.5 },
};

// Electronic: a sine sub held under the pushed sections, the acid line (the TB-303 recipe: a sawtooth under a
// resonant ladder filter whose envelope opens on an accent pattern) in the choruses and the break, a supersaw pad
// struck on every beat with a slow attack so it swells after each hit (the pump), sawtooth stabs ducked on the beat in
// the choruses, a square pluck with a dotted-eighth echo for the tune, and the guitar chopped through a filter and
// an echo.
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The break: the acid's filter envelope opening wider bar by bar into the last chorus. */
const ACID_RISING =
  '.lpq(12).ftype("ladder").lpenv(saw.range(1, 5).slow(4)).lpd(.14).lps(0).decay(.2).sustain(.4)';
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
const PUMP = '.postgain("[.6 1]*4")';
/**
 * The 808 kick (funk's `oak808`, the electronic bridge's) rings for seconds with no choke: hits a beat apart pile up,
 * by up to 7 dB and by the tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at
 * 96). A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
/** Every sixteenth of the acid bar sounds the root or its octave, so each stab has its root under it. */
const ACID_BAR = "r-ro-rr-r-or-rr-";

/**
 * Electronic: the lo-fi kit in the intro, the verses and the ending (a boom-bap beat under the sub and the pad), Oak's
 * 808 in the fill, the choruses and the bridge (sixteenth hats with thirty-second rolls, claps and ghost claps; hats
 * in threes and rolls in the bridge), the 909 in the break. Straight, four-note chords.
 */
const ELECTRONIC: Kit = {
  bank: {
    intro: "lofikit",
    verse1: "lofikit",
    stop: "oak808",
    chorus1: "oak808",
    verse2: "lofikit",
    bridge: "oak808",
    break: "oak909",
    chorus2: "oak808",
    outro: "lofikit",
    end: "lofikit",
  },
  sounds: { bass: "sine", chords: "supersaw", lead: "square", gtr: "cleangtr" },
  gain: { kick: 0.27, snare: 0.18, hats: 0.12, perc: 0.11, bass: 0.38, chords: 0.13, lead: 0.49, gtr: 0.57 },
  room: 0.2,
  lpf: 700,
  kick: {
    ...pushedSections({ first: "X.....x...x...X.", mid: "......x...x...X.", hold: "......x...x....." }),
    chorus1: "X.....x...x..x..",
    chorus2: "X.....x...x..x..",
    bridge: "X.....X.....",
    break: at4(BREAK_KICK),
    end: END_KICK,
  },
  snare: {
    intro: (i, n) => (i === n - 1 ? "....X.......gxXX" : "....X.......X..."),
    verse1: (i) => (fourth(i) ? "....X..g....X.gX" : "....X..g....X..."),
    stop: FILL,
    chorus1: "....c..g.g..c..g",
    verse2: (i) => (fourth(i) ? "....X..g....X.gX" : "....X..g....X..."),
    bridge: (i) => (fourth(i) ? "...c.....ccc" : "...c.....c.."),
    break: "....c..g.g..c...",
    chorus2: "....C..g.g..C..g",
    outro: (i, n) => (i === n - 1 ? "....X.......gxXX" : "....X..g....X..."),
  },
  hats: {
    ...pushedSections({ first: "X.x.X.x.X.x.X.x.", mid: "X.x.X.x.X.x.X.x.", hold: "X.x.X.x.X.x.X.x." }),
    chorus1: (i) => (i % 2 ? "XgxgXgxgXgDgXDDD" : "XgxgXgxgXgxgXgDg"),
    chorus2: (i) => (i % 2 ? "XgxgXgxgXgDgXDDD" : "XgxgXgxgXgxgXgDg"),
    bridge: (i) => (fourth(i) ? "XgxXgxXDDDDD" : "XgxXgxXgxXgD"),
    break: "..x...x...x...O.",
  },
  perc: {
    intro: (i) => (i === 0 ? "C..............." : "................"),
    verse1: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    chorus1: (i) => (i === 0 ? "C...R.......R..." : "....R.......R..."),
    verse2: (i) => (i === 0 ? "C..............." : fourth(i) ? "..............C." : "................"),
    bridge: (i) => (i === 0 ? "C..........." : "............"),
    chorus2: (i) => (i === 0 ? "C.r.R.r.r.r.R.r." : "r.r.R.r.r.r.R.r."),
    outro: (i) => (i === 0 ? "C..............." : "................"),
    end: "C...............",
  },
  bass: {
    // The sub strikes again with the kick, held in between.
    ...pushedSections({ first: "r-----r---r---N-", mid: "------r---r---N-", hold: "------r---r-----" }),
    chorus1: ACID_BAR,
    chorus2: ACID_BAR,
    bridge: "r-----------",
    break: at4(BREAK_BASS),
    end: "r---------------",
  },
  comp: {
    ...pushedSections(
      { first: "x---x---x---x-n-", mid: "----x---x---x-n-", hold: "----x---x---x---" },
      CHORDS_ENTER,
    ),
    chorus1: "..x...x...x...x.",
    chorus2: "..x...x...x...x.",
    bridge: "xxxxxxxxxxxx",
    break: at4(BREAK_STABS),
    end: "x---------------",
  },
  compVel: { x: 0.85, n: 1, g: 0.5 },
  synth: {
    bass: {
      intro: `.s("sine")${SUB}`,
      verse1: `.s("sine")${SUB}`,
      chorus1: `.s("sawtooth")${ACID}`,
      verse2: `.s("sine")${SUB}`,
      bridge: `.s("sine")${SUB}`,
      break: `.s("sawtooth")${ACID_RISING}`,
      chorus2: `.s("sawtooth")${ACID}`,
      outro: `.s("sine")${SUB}`,
      end: `.s("sine")${SUB}`,
    },
    chords: {
      intro: `.s("supersaw")${PAD}`,
      verse1: `.s("supersaw")${PAD}`,
      chorus1: `.s("sawtooth")${STAB}${PUMP}`,
      verse2: `.s("supersaw")${PAD}`,
      bridge: `.s("supersaw")${PAD}`,
      break: `.s("sawtooth")${STAB}`,
      chorus2: `.s("sawtooth")${STAB}${PUMP}`,
      outro: `.s("supersaw")${PAD}`,
      end: `.s("supersaw").attack(.12).decay(1.5).sustain(.6)`,
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.54).delayfeedback(.35)",
    gtr: ".lpf(2200).delay(.25).delaytime(.36).delayfeedback(.3)",
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

const lowOrHigh = (c: Chord, id: SectionId): string => (HIGH.has(id) ? (c.high ?? c.low) : c.low);

/** One flavour's song: the tune, the guitar, the chords, the bass, then the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const syn = k.synth;
  const bankOf = (id: SectionId) => (typeof k.bank === "string" ? "" : `.bank("${k.bank[id] ?? "oak909"}")`);
  const drumTail = typeof k.bank === "string" && k.bank ? `.bank("${k.bank}")` : "";
  const drums = (by: Drums, map: DrumMap): BySection =>
    mapSections((id) => {
      const b = by[id];
      return b === undefined ? null : `${drumSection(id, b, map)}${bankOf(id)}`;
    });
  const chords = mapSections((id) => {
    const b = k.comp[id];
    if (b === undefined) return null;
    return `${pitched(id, chordEvents(id, b, lowOrHigh, k.compVel))}${syn?.chords[id] ?? ""}`;
  });
  const gtr = mapSections((id) => {
    const b = gtrSlots[id];
    return b === undefined
      ? null
      : pitched(
          id,
          chordEvents(id, b, (c) => c.gtr, GTR_VEL),
        );
  });
  const bass = mapSections((id) => {
    const b = k.bass[id];
    if (b === undefined) return null;
    return `${pitched(id, bassEvents(id, b))}${syn?.bass[id] ?? ""}`;
  });
  /** The kick, in the sections played on an 808 (`oak808`, `RolandTR808`), gets its decay (KICK_808). */
  const kick808 = (by: ReturnType<typeof drums>): ReturnType<typeof drums> =>
    mapSections((id) => {
      const p = by[id];
      return p &&
        /^(RolandTR808|oak808)$/.test(typeof k.bank === "string" ? k.bank : (k.bank[id] ?? "oak909"))
        ? `${p}${KICK_808}`
        : p;
    });
  const tracks = [
    track(
      "mel",
      MEL,
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(.6).room(${num(k.room)})`,
    ),
    track(
      "gtr",
      gtr,
      `.s("${k.sounds.gtr}").clip(.5)${syn?.gtr ?? ""}.gain(${num(k.gain.gtr)}).pan(.65).room(${num(k.room)})`,
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
    track("perc", drums(k.perc, PERC), `${drumTail}.gain(${num(k.gain.perc)})`),
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

/** Every U13 Make carries a whole rhythm section: kick, snare and hats lines, a bass and the chords. */
const GROOVE: SongPartId[] = ["kick", "snare", "hats", "bass", "chords"];

export const U13_SONG = defineUnitSong({
  id: "usong.U13",
  unit: "U13",
  version: 1,
  title: "Ahead of the beat",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 84,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "gtr", label: "gtr", role: "chords", name: "Guitar", plainName: "Guitar" },
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
  // By section (AUTHORING §23.6): every U13 Make carries its own drums, bass and chords, so each take hands over whole
  // sections. Oak keeps its tune and its guitar where they fit the learner's chords (clash-checked), and its cymbals.
  plan: [
    take(
      "U13.L01",
      ["intro", "verse1", "verse2", "outro"],
      GROOVE,
      "oak",
      "Your groove, its Rhodes chords pushed ahead of the beat, plays the intro, both verses and the ending.",
      // The guitar's chops (a sixteenth, clipped to half) play the song's chords on the "and"s. A learner who writes
      // other chords (U13.L01's "beyond the brief" test, F^7 Em7 Dm7 G7) meets one in verse2 and the ending a half
      // step away (Em7's B under Am's C); kept anyway, since a guitar this step claimed would never come back.
      ["lead", "gtr"],
    ),
    take(
      "U13.L02",
      ["chorus1", "chorus2"],
      GROOVE,
      "oak",
      "Your sixteenth-note groove, with quiet snare hits between the loud ones, drives both choruses under Oak's tune.",
      ["lead", "gtr"],
    ),
    take(
      "U13.L03",
      ["verse1", "verse2"],
      [...GROOVE, "lead"],
      "oak",
      "Your tune, its notes leaning across the beats over a pushed Rhodes, sings both verses of the song.",
      ["gtr"],
    ),
    {
      lesson: "U13.L04",
      kind: "side",
      reason:
        "This lesson's groove counts six eighth notes to a bar, in two groups of three, and the song counts four beats, so it stays a sketch of its own.",
    },
    take(
      "U13.L05",
      ["bridge"],
      GROOVE,
      "oak",
      "Your piano or hats, three notes to every beat, roll through the bridge under Oak's tune.",
      ["lead"],
    ),
    take(
      "U13.L06",
      ["break"],
      GROOVE,
      "oak",
      "Your answer to the funk kick you write down today fills the four-bar break before the last chorus.",
    ),
  ],
  releaseAfter: "U13.CP",
});

export default U13_SONG;
