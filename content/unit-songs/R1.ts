// Song R1, "In the pocket" (docs/design/songs/makes-core-c.md §4.1 row R1; AUTHORING §23). E minor, 4/4, 96 BPM,
// 57 bars (2:23): the first rhythm unit gets a minor funk record whose every section is one of its grooves.
//
//   intro 4   verse 8                      chorus1 8   bridge 8 (A minor)         break 8 (C minor)
//   Em7       (Em7 C^7 G^7 D7)×2           Em7         (Am7 F^7 C^7 G7)×2         Cm7
//
//   lift 8 (D minor)          stop 1    chorus2 8   outro 4
//   (Dm7 Dm7 Gm7 Gm7)×2       (drums)   Em7         Em7, the last bar one held hit
//
// Every R1 lesson has its own key, so the song travels: home in E minor (R1.L01's verse and R1.L03's Em7 pocket), a
// bridge in A minor (R1.L02), then a climb by whole steps, C minor (R1.L04), D minor (R1.L05), back home to E minor
// for the last chorus. Each move is one a band makes: Em7 to Am7 is i to iv; the bridge's last chord, G7, is V of
// C minor; Cm7 to Dm7 is a lift a whole step up; the one-bar drum fill (`stop`) clears the lift's Gm7 before the
// last chorus lifts again to Em7.
//
// Oak plays each lesson's idea before the learner takes it over:
// - The verse is R1.L01's metric weight: the hi-hat's sixteen places are as loud as their weight (1, .3, .5, .3, .7
//   …), and the kick and the bass pull: beat 1, the "a" of 2 with beat 3 left empty, the "and" of 3. In bar 4 the
//   bass and the kick pull into the downbeat of bar 5: the last sixteenth of the bar, tied over an empty downbeat.
// - The choruses are R1.L03's pocket on one chord, Em7: the kick syncopates (1, the "a" of 1, the "and" of 2, the
//   "and" of 3), the snare whispers around 2 and 4 (ghost notes at .3 on the "a" of 2, the "e" and "a" of 3 and the
//   "a" of 4), and the kick, the bass, the clav and the tune all land together on the one.
// - The bridge is R1.L02's lean: the kick, the snare, the hats and the bass swing their sixteenths at 3:2
//   (`.swingBy(.2, 8)`), in every flavour. Everything else in the bridge (chords, tune, horns, shaker) sits on the
//   eighth grid, where sixteenth swing moves nothing, so a learner's own swing amount never flams against Oak.
// - The break is R1.L04's machine: the bass with the kick on 1, the "and" of 2 and the "and" of 3; the clav on the
//   "and" of 1, the "a" of 2, beat 4 and the "and" of 4; the guitar on the "e" of 1, the "e" of 3 and the "a" of 4.
//   No two of them share a place: three thin parts make one sixteenth-note rhythm.
// - The lift is R1.L05's displaced figure: the clav's three hits (1, 2, the "and" of 2) come back an eighth later in
//   every other bar (the "and" of 1, the "and" of 2, beat 3), while the drums and the bass keep the bar.
// - The intro is where R1.L06's one-line groove plays once the learner takes it (the kick, the snare and the hats,
//   no two at once); until then Oak opens with the chorus pocket.
// - The last chorus is not a copy of the first (Oak 2.0 W2, the W0 audit's "repeats varied", re-read on the rendered
//   song: chorus2's horns and guitar matched chorus1's bar for bar in every flavour, and indie's whole chorus did): in
//   its second half the guitar scratches sixteenths, and in its last two bars the horns shout into the outro. Both
//   are parts every take keeps (`oakKeeps` of R1.L03), so the change survives the learner's choruses.
//
// The song is straight everywhere else, in every flavour, jazz-soul included (contracts §5.11 rule 7: R1's other takes
// are straight sixteenth grooves the learner writes). The harmony is the unit's: minor seventh chords and the Bands' i7
// VI^7 III^7 VII7, voiced the same way in every flavour (a flavour changes sounds, grooves and comp rhythms): Em7 E3 G3
// B3 D4, C^7 C3 E3 G3 B3, G^7 G3 B3 D4 F#4, D7 D3 F#3 A3 C4, Am7 C3 E3 G3 A3, F^7 F3 A3 C4 E4, G7 F3 G3 B3 D4, Dm7 D3
// F3 A3 C4, Gm7 F3 G3 Bb3 D4. The clav plays Em7 E4 G4 B4 D5, Cm Eb4 G4 C5, Dm7 C4 D4 F4 A4, Gm7 D4 F4 G4 Bb4; the
// guitar's triads sit under it (G3 B3 E4 over Em7 and C^7, G3 C4 Eb4 over Cm7…). Under every chord the bass sounds its
// root, fifth or octave (Bb, the seventh, under Cm7 in the break), so every chord reads as itself. The tune and the
// bass hold no note a half step from a chord tone sounding with them, in any flavour (AUTHORING §13); the tune and the
// horns keep to notes that also fit the learner's own clav chords (R1.L03 `chord("Em7").voicing()` E3 B3 D4 G4 B4,
// R1.L05 Dm7 F3 C4 D4 F4 C5 and Gm7 G3 Bb3 D4 F4 Bb4), so they keep playing over those takes (`oakKeeps`,
// clash-checked). Gains are levelled by songs.pw.ts (budget sound-songs.json), so the learner's line sits on top.
//
// The tempo is 96: R1.L01 is written at 96, and R1.L02's checklist asks for 76 to 96, so the song's tempo passes it
// when that Make opens (AUTHORING §23.1 rule 5).
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
  { id: "verse", type: "verse", bars: 8 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "bridge", type: "bridge", bars: 8, key: { tonic: "A", mode: "minor" } },
  { id: "break", type: "break", bars: 8, key: { tonic: "C", mode: "minor" } },
  { id: "lift", type: "lift", bars: 8, key: { tonic: "D", mode: "minor" } },
  // One bar of drums: the lift's Gm7 clears before the last chorus comes back to Em7.
  { id: "stop", type: "break", bars: 1 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const sectionOf = (id: SectionId) => SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number];
/** Slots in a bar: sixteenths. */
const STEPS = 16;

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

type ChordName = "Em" | "C" | "G" | "D" | "Am" | "F" | "G7" | "Cm" | "Dm" | "Gm";
interface Chord {
  /** Bass: root, fifth, octave, and the seventh (Cm7's Bb in the break). */
  r: string;
  f: string;
  o: string;
  s?: string;
  /** The Rhodes (piano, organ, pad): four notes, close and low, root at the bottom or the bass under it. */
  low: string;
  /** The clav. */
  keys?: string;
  /** The guitar's triad. */
  gtr?: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  Em: { r: "e2", f: "b2", o: "e3", s: "d3", low: "e3,g3,b3,d4", keys: "e4,g4,b4,d5", gtr: "g3,b3,e4" },
  C: { r: "c2", f: "g2", o: "c3", low: "c3,e3,g3,b3", gtr: "g3,b3,e4" },
  G: { r: "g2", f: "d2", o: "g1", low: "g3,b3,d4,f#4", gtr: "g3,b3,d4" },
  D: { r: "d2", f: "a2", o: "d3", low: "d3,f#3,a3,c4", gtr: "f#3,a3,d4" },
  Am: { r: "a1", f: "e2", o: "a2", low: "c3,e3,g3,a3" },
  F: { r: "f1", f: "c2", o: "f2", low: "f3,a3,c4,e4" },
  G7: { r: "g1", f: "d2", o: "g2", low: "f3,g3,b3,d4" },
  Cm: { r: "c2", f: "g2", o: "c3", s: "bb2", low: "c3,eb3,g3,bb3", keys: "eb4,g4,c5", gtr: "g3,c4,eb4" },
  Dm: { r: "d2", f: "a2", o: "d3", low: "d3,f3,a3,c4", keys: "c4,d4,f4,a4", gtr: "f3,a3,d4" },
  Gm: { r: "g1", f: "d2", o: "g2", low: "f3,g3,bb3,d4", keys: "d4,f4,g4,bb4", gtr: "g3,bb3,d4" },
};
const VERSE: ChordName[] = ["Em", "C", "G", "D"];
const BRIDGE: ChordName[] = ["Am", "F", "C", "G7"];
const LIFT: ChordName[] = ["Dm", "Dm", "Gm", "Gm"];
const times = (c: ChordName, n: number): ChordName[] => Array.from({ length: n }, () => c);
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = {
  intro: times("Em", 4),
  verse: [...VERSE, ...VERSE],
  chorus1: times("Em", 8),
  bridge: [...BRIDGE, ...BRIDGE],
  break: times("Cm", 8),
  lift: [...LIFT, ...LIFT],
  stop: [],
  chorus2: times("Em", 8),
  outro: times("Em", 4),
};

// ---- Patterns on a grid -------------------------------------------------------------------------------------
//
// A part is written as one string of sixteen slots per bar and read as events: a letter starts a note, `-` holds it
// into the next slot (across the bar line too, which is how a pull into the downbeat is tied over), `.` is silence.
// A section becomes one sequence `[…]` of weighted notes, slowed over its bars, or one `[…]` a bar inside `< >`.

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
  let out = "";
  for (let i = 0; i < n; i++) {
    const bar = barOf(b, i, n);
    if (bar.length !== STEPS)
      throw new Error(`R1 ${id} bar ${i + 1}: ${bar.length} slots, not ${STEPS}: "${bar}"`);
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

/** The shortest run of bars that repeats through the whole list (a one-chord vamp: 1). */
function period(bars: readonly string[]): number {
  for (let p = 1; p < bars.length; p++)
    if (bars.length % p === 0 && bars.every((b, i) => b === bars[i % p])) return p;
  return bars.length;
}

/**
 * A pitched section. When no note crosses a bar line, one `[…]` a bar inside `< >` (only as many bars as repeat);
 * otherwise one sequence over the whole section, slowed over its bars, so a pull can be tied across the bar line.
 */
function pitched(id: SectionId, evs: readonly Ev[], withVel = true): string {
  const bars = sectionOf(id).bars;
  const tied = evs.some((e) => (e.at % STEPS) + e.len > STEPS);
  if (tied || bars === 1) {
    const { notes, vel } = sequence(evs, bars * STEPS);
    const v = withVel ? `.velocity("${vel}")` : "";
    return `note("${notes}")${v}${bars > 1 ? `.slow(${bars})` : ""}`;
  }
  const per = Array.from({ length: bars }, (_, b) =>
    sequence(
      evs.filter((e) => Math.floor(e.at / STEPS) === b).map((e) => ({ ...e, at: e.at - b * STEPS })),
      STEPS,
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

/** Chords from slots: any letter strikes the bar's chord in the given voicing, at the letter's velocity. */
function chordEvents(id: SectionId, b: Bars, voicing: (c: Chord) => string | undefined, vel: Vel): Ev[] {
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const bar = Math.floor(s / STEPS);
    const name = prog[bar];
    if (!name) throw new Error(`R1 ${id}: no chord in bar ${bar + 1}`);
    const notes = voicing(CHORD[name]);
    if (!notes) throw new Error(`R1 ${id}: no voicing for ${name}`);
    return { tok: `[${notes}]`, vel: vel[c] ?? 1 };
  });
}

/**
 * Bass from slots: `r` root, `f` fifth, `o` octave, `s` seventh of the bar's chord, `N` the next bar's root (a pull
 * into the downbeat, tied over it).
 */
function bassEvents(id: SectionId, b: Bars): Ev[] {
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const bar = Math.floor(s / STEPS);
    const here = prog[bar] as ChordName;
    if (c === "N") {
      const next = prog[bar + 1];
      if (!next) throw new Error(`R1 ${id}: a pull in bar ${bar + 1} with no bar after it`);
      return { tok: CHORD[next].r, vel: 1 };
    }
    const note = ({ r: CHORD[here].r, f: CHORD[here].f, o: CHORD[here].o, s: CHORD[here].s } as const)[
      c as "r" | "f" | "o" | "s"
    ];
    if (!note) throw new Error(`R1 ${id}: "${c}" in a bass line over ${here}`);
    return { tok: note, vel: c === "r" ? 1 : 0.9 };
  });
}

// ---- The tune and the horns (every flavour) -------------------------------------------------------------------
//
// In sixteenths, `note:length`; a horn chord is `[a,b,c]:length`. The verse tune comes in after a rest of an eighth in
// every bar and leans on light places (E and G on the "and" of 1 and its "a", A on the "e" of 2); over each chord it
// holds only notes that sit a whole step or more from every chord tone: E G A B D over Em7, D E G A over C^7, B D E A
// over G^7, D E F# A over D7. The chorus hook starts on the one with the band (E E, G, E, A B A G E) and answers itself
// with D E held; the horns answer it with stabs in the second half of every other bar. The bridge sings long notes on
// the eighth grid; the lift climbs to D6 on the tones of each chord and its eleventh, the horns answering its rests.
// Range G4 to E6, above every chord, clav and guitar note in the same bar.

const T_VERSE = [
  "~:2 e5:1 g5:1 ~:1 a5:2 g5:1 e5:3 d5:1 e5:4", // Em7
  "~:2 g5:2 a5:2 g5:1 e5:3 d5:6", // C^7
  "~:2 b4:1 d5:1 ~:1 e5:2 d5:1 b4:3 a4:1 b4:4", // G^7
  "~:2 d5:2 e5:2 f#5:1 a5:3 f#5:2 e5:2 d5:2", // D7
  "~:2 e5:1 g5:1 ~:1 a5:2 g5:1 e5:3 d5:1 e5:4",
  "~:2 g5:2 a5:2 b5:1 a5:3 g5:2 e5:4",
  "~:2 d5:2 e5:2 a5:1 e5:3 d5:2 b4:4",
  "~:2 a4:2 d5:2 e5:1 f#5:3 e5:2 d5:4",
];
const HOOK_A = "e5:1 e5:1 ~:1 g5:2 e5:1 ~:2 a5:2 b5:1 a5:1 g5:2 e5:2";
const HOOK_B = "d5:3 e5:5 ~:8";
const HOOK_C = "g5:1 g5:1 ~:1 b5:2 g5:1 ~:2 d6:2 e6:1 d6:1 b5:2 a5:2";
const HOOK_D = "g5:3 e5:5 ~:8";
const T_CHORUS = [HOOK_A, HOOK_B, HOOK_A, HOOK_B, HOOK_C, HOOK_D, HOOK_A, HOOK_B];
const T_BRIDGE = [
  "~:2 c5:2 e5:2 g5:6 e5:4", // Am7
  "~:2 d5:2 c5:2 a4:6 c5:4", // F^7
  "~:2 e5:2 g5:2 a5:6 g5:4", // C^7
  "d5:4 b4:2 g4:2 ~:2 b4:2 d5:4", // G7
  "~:2 c5:2 e5:2 a5:6 g5:4",
  "~:2 a5:2 g5:2 c5:6 d5:4",
  "~:2 e5:2 d5:2 g5:6 e5:4",
  "~:2 d5:2 f5:2 g5:10",
];
const T_LIFT = [
  "a5:4 ~:2 f5:2 a5:2 c6:2 a5:4", // Dm7
  "g5:2 f5:2 d5:4 ~:8",
  "bb5:4 ~:2 g5:2 bb5:2 d6:2 bb5:4", // Gm7
  "c6:2 bb5:2 g5:4 ~:8",
  "d6:4 ~:2 c6:2 a5:2 c6:2 d6:4", // Dm7
  "c6:2 a5:2 f5:4 ~:8",
  "d6:4 ~:2 bb5:2 g5:2 bb5:2 c6:4", // Gm7
  "d6:2 c6:2 bb5:2 g5:10",
];
const T_OUTRO = [HOOK_A, HOOK_B, HOOK_A, "e5:16"];

const REST = "~:16";
/** The horns' answer to the hook: two stabs of Em7 and a third of A D G, in the second half of the bar. */
const H_ANSWER = "~:10 [g4,b4,e5]:1 ~:1 [g4,b4,e5]:1 ~:1 [a4,d5,g5]:2";
const H_ONE = "[g4,b4,e5]:2 ~:14";
const H_CHORUS = [H_ONE, H_ANSWER, REST, H_ANSWER, H_ONE, H_ANSWER, REST, H_ANSWER];
/**
 * The last chorus's last two bars (bars 52–53, Oak 2.0 W2): the horns shout instead of resting and answering. Bar 7
 * hits in the hook's rests and under its long notes (the "and" of 2, beat 3, the "and" of 4); bar 8 hits on 1, then
 * climbs on beat 3, its "and", beat 4 and its "and", through the tune's empty second half into the outro. Only E G A B D, so nothing sits a half step from Em7 or from R1.L03's clav.
 */
const H_SHOUT_7 = "~:6 [g4,b4,e5]:1 ~:1 [a4,d5,g5]:2 ~:4 [g4,b4,e5]:2";
const H_SHOUT_8 = "[g4,b4,e5]:2 ~:6 [g4,b4,e5]:1 ~:1 [a4,d5,g5]:1 ~:1 [b4,e5,g5]:2 [b4,e5,a5]:2";
const H_CHORUS2 = [...H_CHORUS.slice(0, 6), H_SHOUT_7, H_SHOUT_8];
/** Over D7 in the verse and G7 in the bridge: three notes of the chord, held through beats 3 and 4. */
const H_D7 = "~:8 [f#4,a4,c5]:8";
const H_G7 = "~:8 [f4,b4,d5]:8";
const H_BREAK = "~:10 [eb4,c5,eb5]:1 ~:1 [eb4,c5,eb5]:1 ~:1 [f4,bb4,eb5]:2";
const H_LIFT_ONE = "[f4,a4,d5]:2 ~:14";
const H_LIFT_DM = "~:8 [f4,a4,d5]:1 ~:1 [f4,a4,d5]:1 ~:3 [g4,c5,f5]:2";
const H_LIFT_GM = "~:8 [f4,bb4,d5]:1 ~:1 [f4,bb4,d5]:1 ~:3 [g4,c5,f5]:2";
/** Pickups: into the verse over the intro's last two beats, and up into the last chorus over the drum fill. */
const H_INTRO = [REST, REST, REST, "~:12 b4:2 d5:2"];
const H_STOP = ["~:8 b4:2 d5:2 e5:2 g5:2"];

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
  const total = sectionOf(id).bars * STEPS;
  if (t !== total) throw new Error(`R1 tune ${id}: ${t} slots, not ${total}`);
  return out;
}
const tune = (id: SectionId, lines: readonly string[]) => pitched(id, tuneEvents(id, lines), false);

const MEL: BySection = {
  intro: null,
  verse: tune("verse", T_VERSE),
  chorus1: tune("chorus1", T_CHORUS),
  bridge: tune("bridge", T_BRIDGE),
  break: null,
  lift: tune("lift", T_LIFT),
  stop: null,
  chorus2: tune("chorus2", T_CHORUS),
  outro: tune("outro", T_OUTRO),
};
const HORNS: BySection = {
  intro: tune("intro", H_INTRO),
  verse: tune("verse", [REST, REST, REST, H_D7, REST, REST, REST, H_D7]),
  chorus1: tune("chorus1", H_CHORUS),
  bridge: tune("bridge", [REST, REST, REST, H_G7, REST, REST, REST, H_G7]),
  break: tune("break", [REST, REST, REST, H_BREAK, REST, REST, REST, H_BREAK]),
  lift: tune("lift", [H_LIFT_ONE, H_LIFT_DM, REST, H_LIFT_GM, H_LIFT_ONE, H_LIFT_DM, REST, H_LIFT_GM]),
  stop: tune("stop", H_STOP),
  chorus2: tune("chorus2", H_CHORUS2),
  outro: tune("outro", [REST, H_ANSWER, REST, "[g4,b4,e5]:16"]),
};

// ---- The clav and the guitar (every flavour; their sounds are the kit's) -------------------------------------
//
// The same places in every flavour, because their places are the unit's ideas: the chorus clav is R1.L03's (1, the
// "a" of 2, the "a" of 2's neighbour, the "e" of 4: 0, 5, 7, 13), the break's three parts R1.L04's machine, the lift's
// clav R1.L05's figure (0, 4, 6) and the same figure an eighth later (2, 6, 8) in every other bar.
const CLAV_POCKET = "x....x.x.....x..";
const KEYS: Readonly<Partial<Record<SectionId, Bars>>> = {
  intro: (i) => (i < 2 ? "................" : CLAV_POCKET),
  chorus1: CLAV_POCKET,
  break: "..x....x....x.x.",
  lift: (i) => (i % 2 === 0 ? "x...x.x........." : "..x...x.x......."),
  chorus2: CLAV_POCKET,
  outro: (i, n) => (i === n - 1 ? "X..............." : CLAV_POCKET),
};
const CHANK = "..x...x...x...x.";
/**
 * The last chorus's second half (bars 50–53, Oak 2.0 W2): the guitar scratches sixteenths, soft (`g`) around its
 * chank on each "and" (`x`), and leaves Oak's clav pocket (1, the "a" of 2, its neighbour, the "e" of 4) alone.
 */
const SCRATCH = ".gxgg.x.ggxgg.xg";
const GTR: Readonly<Partial<Record<SectionId, Bars>>> = {
  intro: CHANK,
  verse: "......x.......x.",
  chorus1: CHANK,
  break: ".x.......x.....x",
  lift: "....x.......x...",
  chorus2: (i) => (i < 4 ? CHANK : SCRATCH),
  outro: (i, n) => (i === n - 1 ? "X..............." : CHANK),
};
const PART_VEL: Vel = { x: 0.85, X: 1, g: 0.5 };

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
/** The hats; the digits are R1.L01's weights (.3 to .9) and R1.L02's and R1.L04's accents. */
const HATS: DrumMap = {
  X: ["hh", 1],
  x: ["hh", 0.6],
  g: ["hh", 0.4],
  O: ["oh", 0.8],
  D: ["[hh hh]", 0.5],
  "9": ["hh", 0.9],
  "8": ["hh", 0.8],
  "7": ["hh", 0.7],
  "5": ["hh", 0.5],
  "4": ["hh", 0.4],
  "3": ["hh", 0.3],
};
const PERC: DrumMap = {
  C: ["cr", 1],
  R: ["rd", 0.8],
  r: ["rd", 0.55],
  T: ["tb", 0.7],
  t: ["tb", 0.4],
  K: ["cb", 0.6],
  k: ["cb", 0.4],
  S: ["sh", 0.6],
  s: ["sh", 0.35],
};

/** A drum section: one `<…>` entry a bar (repeats folded with `!`), its velocities alike. */
function drumSection(id: SectionId, b: Bars, map: DrumMap): string {
  const n = sectionOf(id).bars;
  const slots = slotsOf(id, b);
  const sBars: string[] = [];
  const vBars: string[] = [];
  let any = false;
  for (let i = 0; i < n; i++) {
    const bar = slots.slice(i * STEPS, (i + 1) * STEPS);
    const s: string[] = [];
    const v: string[] = [];
    for (const c of bar) {
      if (c === ".") {
        s.push("~");
        v.push("1");
        continue;
      }
      const hit = map[c];
      if (!hit) throw new Error(`R1 ${id}: drum letter "${c}"`);
      any = true;
      s.push(hit[0]);
      v.push(num(hit[1]));
    }
    sBars.push(`[${s.join(" ")}]`);
    vBars.push(`[${v.join(" ")}]`);
  }
  if (!any) throw new Error(`R1 ${id}: a drum section with no hit (write null)`);
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
  bank: string | Partial<Record<SectionId, string>>;
  sounds: { bass: string; chords: string; keys: string; gtr: string; lead: string; horns: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    keys: number;
    gtr: number;
    lead: number;
    horns: number;
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
    keys: string;
    gtr: string;
    lead: string;
    horns: string;
  };
}

/** Bar 1 of a section, then the rest. */
const firstBar =
  (first: string, rest: string): Bars =>
  (i) =>
    i === 0 ? first : rest;
/** Every bar but the last, then the last. */
const lastBar =
  (rest: string, last: string): Bars =>
  (i, n) =>
    i === n - 1 ? last : rest;
/** Bars 4 and 8 of an eight-bar section. */
const fourth = (i: number) => i % 4 === 3;

// The grooves every kit starts from (the funk band's), each the idea of its section:
// - verse: R1.L01's pull. Kick and bass on 1, on the "a" of 2 with beat 3 empty, and on the "and" of 3; in bar 4 both
//   pull into bar 5 on the last sixteenth, its downbeat left empty (the bass's E ties over it).
// - chorus: R1.L03's pocket, its kick (1, "a" of 1, "and" of 2, "and" of 3) with the bass on every kick.
// - bridge: R1.L02's kick (the "a" of 2 and the "and" of 3), swung at 3:2 by the code builder.
// - break: R1.L04's kick (1, "and" of 2, "and" of 3) with the bass on every kick.
// - lift: the kick and the bass keep the bar under the moving clav (1, the "and" of 2, 3, the "and" of 4).
const VERSE_KICK: Bars = (i) =>
  i === 3 ? "X......x..x....x" : i === 4 ? ".......x..x....." : "X......x..x.....";
const VERSE_BASS: Bars = (i) =>
  i === 3 ? "r------r--f----N" : i === 4 ? "-------r--f---o-" : "r------r--f---o-";
const POCKET_KICK = "X..x..x...x.....";
/**
 * The pocket's bass: E on the one with the kick, the octave popped on the "a" of 1, E again on the "and" of 2, the
 * fifth on the "and" of 3 and the "e" of 4, the seventh (D) on the last "a", where no chord is struck.
 */
const POCKET_BASS = "r-.o..r-..f-.f.s";
const BASE_KICK: Drums = {
  intro: POCKET_KICK,
  verse: VERSE_KICK,
  chorus1: lastBar(POCKET_KICK, "X..x..x...x..x.."),
  bridge: "X......x..x.....",
  break: "X.....x...x.....",
  lift: "X.....x.X.....x.",
  stop: "X...............",
  chorus2: lastBar(POCKET_KICK, "X..x..x...x..x.."),
  outro: lastBar(POCKET_KICK, "X..............."),
};
/** R1.L03's snare: 2 and 4, ghost notes on the "a" of 2, the "e" and "a" of 3 and the "a" of 4. */
const GHOSTS = "....X..g.g.gX..g";
const BASE_SNARE: Drums = {
  intro: lastBar(GHOSTS, "....X..g.g..XgXX"),
  verse: (i) => (fourth(i) ? "....X..g....X.gx" : "....X.......X..."),
  chorus1: lastBar(GHOSTS, "....X..g.g.gX.xX"),
  bridge: "....X..g....X..g",
  break: "....X.......X...",
  lift: lastBar("....X..g....X..g", "....X..g..xxXxXX"),
  stop: "....X..gxgxgXXXX",
  chorus2: lastBar(GHOSTS, "....X..g.g.gX.xX"),
  outro: lastBar(GHOSTS, "................"),
};
/** R1.L01's hats: every place as loud as its weight. */
const WEIGHTED = "X353735393537353";
const BASE_HATS: Drums = {
  intro: "XgxgXgxgXgxgXgxg",
  verse: WEIGHTED,
  chorus1: "XgxgXgxgXgxgXgOg",
  bridge: "X474X474X474X474",
  break: "X585X585X585X585",
  lift: "X.x.X.x.X.x.X.O.",
  chorus2: "XgxgXgxOXgxgXgOg",
  outro: lastBar("XgxgXgxgXgxgXgOg", "................"),
};
const BASE_PERC: Drums = {
  intro: firstBar("C...............", "................"),
  verse: firstBar("C...............", "................"),
  chorus1: firstBar("C.T...T...T...T.", "..T...T...T...T."),
  // The shaker in eighths: on the eighth grid, so the bridge's swing never moves it.
  bridge: firstBar("C.s.S.s.S.s.S.s.", "S.s.S.s.S.s.S.s."),
  break: firstBar("C...............", "................"),
  lift: (i) => (i % 4 === 0 ? "C.T.T.T.T.T.T.T." : "T.T.T.T.T.T.T.T."),
  stop: "C...............",
  chorus2: firstBar("C.K.T.K.T.K.T.K.", "T.K.T.K.T.K.T.K."),
  outro: (i, n) => (i === 0 ? "C.T...T...T...T." : i === n - 1 ? "C..............." : "..T...T...T...T."),
};
const BASE_BASS: Readonly<Partial<Record<SectionId, Bars>>> = {
  intro: (i) => (i < 2 ? "................" : POCKET_BASS),
  verse: VERSE_BASS,
  chorus1: POCKET_BASS,
  bridge: "r------r--f---o-",
  break: "r-----f---s-----",
  lift: "r-----r-f-----f-",
  chorus2: POCKET_BASS,
  outro: lastBar(POCKET_BASS, "r---------------"),
};
/** The chords' last hit: the outro's last bar, held. */
const END_HIT: Bars = lastBar("................", "x---------------");

/** Pop: the default kit, piano, picked bass, the clav and a clean guitar, a brass section. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", keys: "clav", gtr: "cleangtr", lead: "piano", horns: "horns" },
  gain: {
    kick: 0.18,
    snare: 0.19,
    hats: 0.13,
    perc: 0.11,
    bass: 0.5,
    chords: 0.19,
    keys: 0.35,
    gtr: 0.45,
    lead: 0.71,
    horns: 0.25,
  },
  room: 0.25,
  lpf: 800,
  kick: BASE_KICK,
  snare: BASE_SNARE,
  hats: BASE_HATS,
  perc: BASE_PERC,
  bass: BASE_BASS,
  comp: {
    verse: "x-----x-....x---",
    bridge: "x-----..x-----..",
    lift: "x---------------",
    outro: END_HIT,
  },
  compVel: { x: 0.8 },
};

/** Indie: the rock kit, eighth-note hats and open hats in the choruses, an organ under it, a muted trumpet. */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "organ", keys: "clav", gtr: "cleangtr", lead: "acgtr", horns: "mutetpt" },
  gain: {
    kick: 0.29,
    snare: 0.29,
    hats: 0.18,
    perc: 0.17,
    bass: 0.36,
    chords: 0.2,
    keys: 0.36,
    gtr: 0.35,
    lead: 1,
    horns: 0.48,
  },
  room: 0.3,
  lpf: 750,
  kick: {
    ...BASE_KICK,
    chorus1: lastBar("X..x..x.X.x.....", "X..x..x.X.x..x.."),
    chorus2: lastBar("X..x..x.X.x.....", "X..x..x.X.x..x.."),
  },
  snare: BASE_SNARE,
  hats: {
    ...BASE_HATS,
    intro: "X.x.X.x.X.x.X.x.",
    chorus1: "X.O.X.O.X.O.X.O.",
    chorus2: "X.O.X.O.X.O.X.O.",
    outro: lastBar("X.O.X.O.X.O.X.O.", "................"),
  },
  perc: {
    ...BASE_PERC,
    chorus1: firstBar("C.t.T.t.T.t.T.t.", "T.t.T.t.T.t.T.t."),
    chorus2: firstBar("C.t.T.t.T.t.T.t.", "T.t.T.t.T.t.T.t."),
  },
  bass: BASE_BASS,
  comp: {
    verse: "x---------------",
    bridge: "x-------x-------",
    lift: "x-------x-------",
    outro: END_HIT,
  },
  compVel: { x: 0.75 },
};

/**
 * Jazz-soul: Oak's jazz kit, Rhodes on 2 and 4, upright bass, vibes, a jazz guitar and a tenor saxophone. Straight
 * sixteenths, as the unit's grooves are (no eighth swing in this song): cross-stick and ride in the verse and the
 * bridge, the snare with its ghost notes in the choruses.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", keys: "clav", gtr: "jazzgtr", lead: "vibes", horns: "tenor" },
  gain: {
    kick: 0.2,
    snare: 0.37,
    hats: 0.23,
    perc: 0.23,
    bass: 0.67,
    chords: 0.36,
    keys: 0.26,
    gtr: 0.35,
    lead: 0.4,
    horns: 0.29,
  },
  room: 0.35,
  lpf: 900,
  kick: BASE_KICK,
  snare: {
    ...BASE_SNARE,
    verse: (i) => (fourth(i) ? "....R..g....R.gx" : "....R.......R..."),
    bridge: "....R..g....R..g",
  },
  hats: BASE_HATS,
  perc: {
    ...BASE_PERC,
    verse: firstBar("C.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    chorus1: firstBar("C.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    chorus2: firstBar("C.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
  },
  bass: BASE_BASS,
  comp: {
    verse: "....x--.....x--.",
    bridge: "..x-......x-....",
    lift: "x-------........",
    outro: END_HIT,
  },
  compVel: { x: 0.8 },
};

/** Funk: Oak's 808, finger bass, Rhodes on 2 and 4, the clav, a clean guitar, the organ's tune, a brass section. */
const FUNK: Kit = {
  bank: "oak808",
  sounds: {
    bass: "fingerbass",
    chords: "rhodes",
    keys: "clav",
    gtr: "cleangtr",
    lead: "organ",
    horns: "horns",
  },
  gain: {
    kick: 0.36,
    snare: 0.31,
    hats: 0.18,
    perc: 0.15,
    bass: 0.68,
    chords: 0.4,
    keys: 0.6,
    gtr: 0.5,
    lead: 0.57,
    horns: 0.5,
  },
  room: 0.2,
  lpf: 850,
  kick: BASE_KICK,
  snare: {
    ...BASE_SNARE,
    chorus2: lastBar("....C..g.g.gC..g", "....C..g.g.gC.xX"),
  },
  hats: BASE_HATS,
  perc: BASE_PERC,
  bass: BASE_BASS,
  comp: {
    verse: "....x--.....x--.",
    bridge: "..x-......x-....",
    lift: "x---------------",
    outro: END_HIT,
  },
  compVel: { x: 0.8 },
};

// Electronic: a sine sub under the intro, the verse, the bridge and the ending, the acid line (the TB-303 recipe: a
// sawtooth under a resonant ladder filter whose envelope opens on an accent pattern) in the choruses, the break and
// the lift; a supersaw pad that swells after each beat; the clav as a plucked wavetable; sawtooth brass with a filter
// that snaps shut; a square pluck with a dotted-eighth echo on the tune.
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/**
 * The 808 kick (funk's `oak808`, the electronic choruses' and lift's) rings for seconds with no choke: hits a beat
 * apart pile up, by up to 7 dB and by the tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at
 * 92 BPM, −14.9 at 96). A 0.35 s decay keeps its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
/** R1.L02's lean: the bridge's kick, snare, hats and bass swing their sixteenths at 3:2. */
const LEAN = ".swingBy(.2, 8)";

/**
 * Electronic: the lo-fi kit in the intro, the verse, the bridge and the ending, Oak's 808 in the choruses and the
 * lift (claps, sixteenth hats with thirty-second rolls), the 909 in the break and the fill. Straight but for the
 * bridge's lean.
 */
const ELECTRONIC: Kit = {
  bank: {
    intro: "lofikit",
    verse: "lofikit",
    chorus1: "oak808",
    bridge: "lofikit",
    break: "oak909",
    lift: "oak808",
    stop: "oak909",
    chorus2: "oak808",
    outro: "lofikit",
  },
  sounds: {
    bass: "sine",
    chords: "supersaw",
    keys: "wt_clav",
    gtr: "cleangtr",
    lead: "square",
    horns: "sawtooth",
  },
  gain: {
    kick: 0.27,
    snare: 0.18,
    hats: 0.12,
    perc: 0.11,
    bass: 0.38,
    chords: 0.13,
    keys: 0.4,
    gtr: 0.5,
    lead: 0.49,
    horns: 0.22,
  },
  room: 0.2,
  lpf: 700,
  kick: BASE_KICK,
  snare: {
    ...BASE_SNARE,
    chorus1: lastBar("....c..g.g.gc..g", "....c..g.g.gc.cC"),
    lift: lastBar("....c..g....c..g", "....c..g..ccCcCC"),
    chorus2: lastBar("....C..g.g.gC..g", "....C..g.g.gC.cC"),
  },
  hats: {
    ...BASE_HATS,
    chorus1: (i) => (i % 2 ? "XgxgXgxgXgDgXDDD" : "XgxgXgxgXgxgXgDg"),
    lift: (i) => (i % 2 ? "X.x.X.x.X.x.XDDD" : "X.x.X.x.X.x.X.x."),
    chorus2: (i) => (i % 2 ? "XgxgXgxgXgDgXDDD" : "XgxgXgxgXgxgXgDg"),
  },
  perc: {
    ...BASE_PERC,
    chorus1: firstBar("C...R.......R...", "....R.......R..."),
    lift: (i) => (i % 4 === 0 ? "C...R.......R..." : "....R.......R..."),
    chorus2: firstBar("C.r.R.r.r.r.R.r.", "r.r.R.r.r.r.R.r."),
  },
  bass: BASE_BASS,
  comp: {
    verse: "x---x---x---x---",
    bridge: "x---x---x---x---",
    lift: "x---x---x---x---",
    outro: END_HIT,
  },
  compVel: { x: 0.85 },
  synth: {
    bass: {
      intro: `.s("sawtooth")${ACID}`,
      verse: `.s("sine")${SUB}`,
      chorus1: `.s("sawtooth")${ACID}`,
      bridge: `.s("sine")${SUB}`,
      break: `.s("sawtooth")${ACID}`,
      lift: `.s("sawtooth")${ACID}`,
      chorus2: `.s("sawtooth")${ACID}`,
      outro: `.s("sine")${SUB}`,
    },
    chords: {
      verse: `.s("supersaw")${PAD}`,
      bridge: `.s("supersaw")${PAD}`,
      lift: `.s("supersaw")${PAD}`,
      outro: `.s("supersaw").attack(.12).decay(1.5).sustain(.6)`,
    },
    keys: ".decay(.16).sustain(0).lpf(2400)",
    gtr: ".lpf(2200).delay(.25).delaytime(.47).delayfeedback(.3)",
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.47).delayfeedback(.35)",
    horns: ".lpf(2000).lpenv(2).lpd(.15).lps(0).decay(.25).sustain(.35)",
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

/** One flavour's song: the tune, the horns, the guitar, the clav, the chords, the bass, then the drums. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const syn = k.synth;
  const bankName = (id: SectionId): string =>
    typeof k.bank === "string" ? k.bank : (k.bank[id] ?? "oak909");
  const bankOf = (id: SectionId) => (typeof k.bank === "string" ? "" : `.bank("${bankName(id)}")`);
  const drumTail = typeof k.bank === "string" && k.bank ? `.bank("${k.bank}")` : "";
  /** The bridge's kick, snare and hats lean (LEAN); the 808 kick gets its decay (KICK_808). */
  const drums = (by: Drums, map: DrumMap, opts: { lean?: boolean; kick?: boolean } = {}): BySection =>
    mapSections((id) => {
      const b = by[id];
      if (b === undefined) return null;
      const lean = opts.lean && id === "bridge" ? LEAN : "";
      const decay = opts.kick && /^(RolandTR808|oak808)$/.test(bankName(id)) ? KICK_808 : "";
      return `${drumSection(id, b, map)}${bankOf(id)}${lean}${decay}`;
    });
  const parts = (
    slots: Readonly<Partial<Record<SectionId, Bars>>>,
    voicing: (c: Chord) => string | undefined,
  ) =>
    mapSections((id) => {
      const b = slots[id];
      return b === undefined ? null : pitched(id, chordEvents(id, b, voicing, PART_VEL));
    });
  const chords = mapSections((id) => {
    const b = k.comp[id];
    if (b === undefined) return null;
    return `${pitched(
      id,
      chordEvents(id, b, (c) => c.low, k.compVel),
    )}${syn?.chords[id] ?? ""}`;
  });
  const bass = mapSections((id) => {
    const b = k.bass[id];
    if (b === undefined) return null;
    return `${pitched(id, bassEvents(id, b))}${id === "bridge" ? LEAN : ""}${syn?.bass[id] ?? ""}`;
  });
  const tracks = [
    track(
      "mel",
      MEL,
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(.6).room(${num(k.room)})`,
    ),
    track(
      "horns",
      HORNS,
      `.s("${k.sounds.horns}").clip(.9)${syn?.horns ?? ""}.gain(${num(k.gain.horns)}).pan(.55).room(${num(k.room)})`,
    ),
    track(
      "gtr",
      parts(GTR, (c) => c.gtr),
      `.s("${k.sounds.gtr}").clip(.5)${syn?.gtr ?? ""}.gain(${num(k.gain.gtr)}).pan(.65).room(${num(k.room)})`,
    ),
    track(
      "keys",
      parts(KEYS, (c) => c.keys),
      `.s("${k.sounds.keys}").clip(.3)${syn?.keys ?? ""}.gain(${num(k.gain.keys)}).pan(.35).room(${num(k.room)})`,
    ),
    track(
      "chords",
      chords,
      `${syn ? "" : `.s("${k.sounds.chords}")`}.gain(${num(k.gain.chords)}).pan(.45).room(${num(k.room)})`,
    ),
    track("bass", bass, `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`),
    track("kick", drums(k.kick, KICK, { lean: true, kick: true }), `${drumTail}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare, SNARE, { lean: true }), `${drumTail}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats, HATS, { lean: true }), `${drumTail}.gain(${num(k.gain.hats)})`),
    track("perc", drums(k.perc, PERC), `${drumTail}.gain(${num(k.gain.perc)})`),
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
  // Every R1 lesson is in its own key (E minor, A minor, E minor, C minor, D minor), so no earlier take's code fits
  // a later Make: R1.L03 is the only one in an earlier take's key (R1.L01's), and its Make is a one-chord clav pocket,
  // not R1.L01's moving bass. Every Make opens with its own starter.
  startFrom: "oak",
  today,
});

const DRUM_PARTS: SongPartId[] = ["kick", "snare", "hats"];

export const R1_SONG = defineUnitSong({
  id: "usong.R1",
  unit: "R1",
  version: 2,
  title: "In the pocket",
  meter: "4/4",
  key: { tonic: "E", mode: "minor" },
  bpm: 96,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "horns", label: "horns", role: "melody", name: "Horns", plainName: "Horns" },
    { id: "gtr", label: "gtr", role: "chords", name: "Guitar", plainName: "Guitar" },
    { id: "keys", label: "keys", role: "chords", name: "Clav", plainName: "Clav" },
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
      sounds: ["cr", "rd", "cb", "tb", "sh", "lt", "mt", "ht"],
      name: "Cymbals and percussion",
      plainName: "Cymbals and percussion",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // By section (AUTHORING §23.6): every R1 Make carries its own drums and bass, and from R1.L03 its own clav (and
  // guitar), so each take hands over whole sections. Oak keeps its tune, horns and guitar where they fit the
  // learner's chords (clash-checked), and its cymbals and percussion everywhere.
  plan: [
    take(
      "R1.L01",
      ["verse"],
      [...DRUM_PARTS, "bass"],
      "Your drums and a bass that pulls against the beat play the verse, under Oak's tune and chords.",
    ),
    take(
      "R1.L02",
      ["bridge"],
      [...DRUM_PARTS, "bass"],
      "Your drums and bass, their sixteenths swung long-short, play the bridge in A minor under Oak's tune.",
    ),
    take(
      "R1.L03",
      ["chorus1", "chorus2"],
      [...DRUM_PARTS, "bass", "keys"],
      "Your funk pocket on Em7, ghost notes and clav, drives both choruses under Oak's tune and horns.",
      ["lead", "horns", "gtr"],
    ),
    take(
      "R1.L04",
      ["break"],
      [...DRUM_PARTS, "bass", "keys", "gtr"],
      "Your bass, clav and guitar, each on places of its own, play the break in C minor.",
      ["horns"],
    ),
    take(
      "R1.L06",
      ["intro"],
      [...DRUM_PARTS],
      "Your one-line drum part, no two drums at once, opens the song.",
    ),
    take(
      "R1.L05",
      ["lift"],
      [...DRUM_PARTS, "bass", "keys"],
      "Your figure, moved to another place in the bar, drives the D minor lift before the last chorus.",
      ["lead", "horns", "gtr"],
    ),
  ],
  // R1 has no checkpoint of its own: R.CP closes the whole rhythm track (R1–R3), as U13.CP closes U12 and U13 and
  // U12's song releases after its last lesson. So the song releases after R1.L05.
  releaseAfter: "R1.L05",
});

export default R1_SONG;
