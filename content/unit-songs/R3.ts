// Song R3, "Wood and iron" (docs/design/songs/makes-core-c.md §4.1 R3 "a son in C, 100, I–V7"; AUTHORING §23). C
// major, 4/4, 100 BPM, 56 bars (2:14): the unit of the clave gets a son, a Cuban dance record, on two chords, C and G7,
// a bar each, from the first bar to the last. Every section starts on C, so every two bars of the song are one turn of
// the son clave 3-2, and every lesson's two-bar loop lands on the clave the way the song does.
//
//   intro 4           verse1 8          coro 8              verse2 8     bells 8            montuno 8
//   montuno, clave;   (C G7)×4: tune,   (C G7)×4: the       = verse1,    (C G7)×4: a bell   (C G7)×4: the piano's
//   horns call in     tresillo bass,    refrain twice,      congas       section, no tune   montuno, the tumbao,
//   bars 3–4          bongo, cinquillo  cowbell, congas                                    refrain and calls
//
//   mambo 8                                   outro 4
//   (C G7)×4: refrain with the horns doubling  C G7 (refrain), G7 on the three-side
//   it, horn riffs answering, cowbell moved    with the whole band, then C
//
// Oak plays each lesson's idea before the learner takes it over:
// - The verses stand on the tresillo (R3.L01): the bass plays root, root, octave on eighths 1, 4 and 7 of every bar,
//   held from one to the next, the kick with it, and the cowbell plays the cinquillo softly above it.
// - The clave (R3.L02) plays from the first bar to the last, on the claves (`clave`), 3-2. The tune faces it: the
//   verse and the refrain put notes on the three-side's strokes over C (beat 1, the "and" of 2, beat 4) and on the
//   two-side's over G7 (beats 2 and 3).
// - The bell section (R3.L03) is five cowbell hits over sixteen steps in every bar: `(5,16)` over C, whose first,
//   third and fifth hits are the clave's three-side, and the same rhythm started eight steps later over G7, whose
//   second and third hits are the two-side. Congas, bongos and shaker play round it; the chords hold, the tune rests.
// - The montuno (R3.L04) is the piano's two-bar figure facing the clave (it meets three of the three-side's strokes
//   and both of the two-side's) over the tumbao: the bass skips beat 1, plays the 5th on the "and" of 2 and the next
//   chord's root on beat 4, held across the bar line. The refrain alternates with two new calls.
// - The mambo (R3.L05) moves the cowbell: bars 1–2 of every four play the cinquillo, bars 3–4 the same figure an
//   eighth later, while the horns answer the refrain. R3.L05's take there opens with the lesson's tape, which plays
//   the same cinquillo.
// The tresillo bass is the song's own (RC2 asks for it, "not a tumbao"); the tumbao appears only in the montuno, the
// mambo and the ending's first two bars, the sections R3.L04 and R3.L05 take over with a tumbao of their own.
//
// The song is straight in every flavour, as every R3 Make is (contracts §5.11 rule 7): no `.swingBy()`. The chords are
// C and G7 everywhere. Pop and indie play triads (C: C E G, G7: B D F G); jazz-soul and funk colour them C6/9 (E A D G
// over the bass's C) and G9 (F A B D); electronic plays C6 and G7, four notes (its staging from U06.L10). The montuno,
// the ending's hits and the intro's chords are the same notes in every flavour. Every chord is struck with its root in
// it, except the coloured C6/9 and G9, which are struck only where the bass is sounding that root (the tresillo's
// notes are all roots). The tune, the horns
// and the bass hold no note a half step from a sounding chord tone (AUTHORING §13): no B and no F held over C, no C and
// no E held over G7, no B held into the montuno's last eighth, where its figure already plays C. That holds against
// the R3.L04 and R3.L05 piano too, so Oak's refrain and horns keep playing over those takes (`oakKeeps`,
// clash-checked). Every flavour plays the same notes (tune and horns, bass roots on every downbeat, chord roots); a
// flavour changes sounds, grooves and comp rhythms. Gains start from U13's levelled kits and are levelled by
// songs.pw.ts (budget sound-songs.json), so the learner's line sits on top.
// Every claim here is read off the evaluated events (content/validate/unit-songs.ts and the task report's audit).
//
// The tempo is 100: R3.L01 and R3.L02 accept 90 to 120, and R3.L03–L05 have no tempo rule, so every Make opens at the
// song's tempo (AUTHORING §23.1 rule 5). R3.L03 is written at 128; it opens at 100 in the song.
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
  // The refrain a son's singers answer with: four bars, twice.
  { id: "coro", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  // R3.L03's bell section: the percussion's eight bars.
  { id: "bells", type: "break", bars: 8 },
  // R3.L04: the piano's montuno and the tumbao, the second half of a son.
  { id: "montuno", type: "vamp", bars: 8 },
  // R3.L05: the loudest part, the horns and the moved cowbell.
  { id: "mambo", type: "lift", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const sectionOf = (id: SectionId) => SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number];
/** Sixteen slots a bar in every section. */
const STEPS = 16;
/**
 * The verses play softer than the refrain and the mambo: every part but the tune at three quarters of its velocity
 * there (about −2.5 dB), so the coro and the mambo are the loud parts of the record (songs.pw.ts measured the son's
 * even texture at 0.5 to 0.9 LU between them in pop, jazz-soul and funk; the rule is at least 1).
 */
const SECTION_LEVEL: Readonly<Partial<Record<SectionId, number>>> = { verse1: 0.75, verse2: 0.75 };
/** A velocity in a section: scaled by SECTION_LEVEL and rounded to two places. */
const velIn = (id: SectionId, v: number): number => Math.round(v * (SECTION_LEVEL[id] ?? 1) * 100) / 100;

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `kickVerse2` for a second, different pattern of the same type), `silence` where it rests, and one
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

type ChordName = "C" | "G";
interface Chord {
  /** Bass: root, fifth, octave. */
  r: string;
  f: string;
  o: string;
  /** Kit voicings: triads (pop, indie), coloured (jazz-soul, funk: C6/9, G9), four notes (electronic: C6, G7). */
  triad: string;
  rich: string;
  four: string;
  /** The montuno's two shapes (every flavour). */
  m1: string;
  m2: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  C: {
    r: "c2",
    f: "g2",
    o: "c3",
    triad: "c4,e4,g4",
    rich: "e3,a3,d4,g4",
    four: "c4,e4,g4,a4",
    m1: "c4,e4,g4",
    m2: "e4,g4,c5",
  },
  G: {
    r: "g1",
    f: "d2",
    o: "g2",
    triad: "b3,d4,f4,g4",
    rich: "f3,a3,b3,d4",
    four: "b3,d4,f4,g4",
    m1: "b3,d4,g4",
    m2: "d4,f4,g4",
  },
};
/** C and G7 a bar each, in every section; the ending holds G7 for its hits, then lands on C. */
const PROGRESSION: Readonly<Record<SectionId, ChordName[]>> = Object.fromEntries(
  SECTIONS.map((s) => [
    s.id,
    s.id === "outro" ? ["C", "G", "G", "C"] : Array.from({ length: s.bars }, (_, i) => (i % 2 ? "G" : "C")),
  ]),
) as Record<SectionId, ChordName[]>;
/** Every section after a montuno starts on C: the figure's last eighth anticipates it. */
const NEXT: ChordName = "C";

// ---- Patterns on a grid -------------------------------------------------------------------------------------
//
// A part is written as one string of sixteen slots per bar and read as events: a letter starts a note, `-` holds it
// into the next slot (across the bar line too, which is how the tumbao's beat 4 is tied over), `.` is silence. A
// section becomes one sequence `[…]` of weighted notes, slowed over its bars.

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
      throw new Error(`R3 ${id} bar ${i + 1}: ${bar.length} slots, not ${STEPS}: "${bar}"`);
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

/** The shortest run of bars that repeats through the whole list (a two-bar figure: 2). */
function period(bars: readonly string[]): number {
  for (let p = 1; p < bars.length; p++)
    if (bars.length % p === 0 && bars.every((b, i) => b === bars[i % p])) return p;
  return bars.length;
}

/**
 * A pitched section. When no note crosses a bar line, one `[…]` a bar inside `< >` (only as many bars as repeat);
 * otherwise one sequence over the whole section, slowed over its bars, so the tumbao's beat 4 is tied across.
 */
function pitched(id: SectionId, given: readonly Ev[], withVel = true): string {
  const bars = sectionOf(id).bars;
  const evs = withVel ? given.map((e) => ({ ...e, vel: velIn(id, e.vel) })) : given;
  const tied = evs.some((e) => (e.at % STEPS) + e.len > STEPS);
  if (tied) {
    const { notes, vel } = sequence(evs, bars * STEPS);
    const v = withVel ? `.velocity("${vel}")` : "";
    return `note("${notes}")${v}.slow(${bars})`;
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

/**
 * Chords from slots: `x` (`X` louder, `g` softer) the bar's chord in the kit's voicing; `a` and `b` the montuno's two
 * shapes of the bar's chord; `n` the montuno's anticipation, the next chord's second shape on the last eighth.
 */
function chordEvents(id: SectionId, b: Bars, voicing: (c: Chord) => string, vel: Vel): Ev[] {
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const bar = Math.floor(s / STEPS);
    const here = CHORD[prog[bar] as ChordName];
    const next = CHORD[bar + 1 < prog.length ? (prog[bar + 1] as ChordName) : NEXT];
    const notes =
      c === "a"
        ? here.m1
        : c === "b"
          ? here.m2
          : c === "n"
            ? next.m2
            : "xXg".includes(c)
              ? voicing(here)
              : null;
    if (notes === null) throw new Error(`R3 ${id}: chord letter "${c}" in bar ${bar + 1}`);
    return { tok: `[${notes}]`, vel: vel[c] ?? 1 };
  });
}

/** Bass from slots: `r` root, `f` fifth, `o` octave of the bar's chord, `N` the next chord's root (the tumbao). */
function bassEvents(id: SectionId, b: Bars): Ev[] {
  const prog = PROGRESSION[id];
  return eventsOf(slotsOf(id, b), (c, s) => {
    const bar = Math.floor(s / STEPS);
    const here = CHORD[prog[bar] as ChordName];
    if (c === "N")
      return { tok: CHORD[bar + 1 < prog.length ? (prog[bar + 1] as ChordName) : NEXT].r, vel: 1 };
    const k = ({ r: "r", f: "f", o: "o" } as const)[c as "r" | "f" | "o"];
    if (!k) throw new Error(`R3 ${id}: "${c}" in a bass line`);
    return { tok: here[k], vel: c === "r" ? 1 : 0.9 };
  });
}

// ---- The bass (every flavour: the same notes, the same rhythm) ---------------------------------------------
//
// The tresillo: root on eighth 1 and eighth 4, the octave on eighth 7, each held to the next. The tumbao: nothing new
// on beat 1 (the next chord's root, struck on beat 4, still sounds), the 5th on the "and" of 2, the next chord's root
// on beat 4. A tumbao section's first bar strikes its root on beat 1, since nothing is tied into a section.
const TRESILLO = "r-----r-----o---";
const TUMBAO_FIRST = "r-----f-----N---";
const TUMBAO = "------f-----N---";
const tumbao: Bars = (i) => (i === 0 ? TUMBAO_FIRST : TUMBAO);
const REST = "................";
const BASS: Readonly<Record<SectionId, Bars>> = {
  intro: (i) => (i < 2 ? REST : TRESILLO),
  verse1: TRESILLO,
  coro: TRESILLO,
  verse2: TRESILLO,
  bells: TRESILLO,
  montuno: tumbao,
  mambo: tumbao,
  // The refrain on the tumbao, then the whole band on the three-side over G7, then C.
  outro: (i) =>
    i === 0 ? TUMBAO_FIRST : i === 1 ? TUMBAO : i === 2 ? "r-....r-....r---" : "r---------------",
};

// ---- The montuno (every flavour: the same notes) -----------------------------------------------------------
//
// Over C: a chord on beat 1, the "and" of 2, the "and" of 3 and beat 4, the clave's three strokes among them. Over
// G7: the "and" of 1, beat 2, beat 3, beat 4 and its "and", the clave's two strokes among them; the last one already
// plays C (E G C), an anticipation of the bar after. Each chord is an eighth long.
const MONTUNO_C = "a-....b-..a-b-..";
const MONTUNO_G = "..a-b-..a-..b-n-";
const montuno: Bars = (i) => (i % 2 ? MONTUNO_G : MONTUNO_C);
const MONTUNO_VEL: Vel = { a: 0.8, b: 0.95, n: 1, x: 0.9, X: 1, g: 0.6 };

// ---- The tune and the horns (every flavour: the same notes) -------------------------------------------------
//
// In sixteenths, `note:length`. Every C bar of the verse has notes on the clave's three strokes (beat 1, the "and" of
// 2, beat 4) and one more on beat 3; every G7 bar answers on beats 2 and 3, the clave's two-side. The refrain is four
// bars, call and answer: C C E G E over C, its first four notes 3+3+2 in sixteenths and three of them on the clave's
// strokes, F D over G7 on the two-side; again, rising to A, then G F D. The montuno's calls and the horns' riffs land on
// the clave's strokes too. Range B4 to C6 for the tune, C4 to C6 for the horns. Long notes are chord tones, or the 6th
// of C (A).
const T_VERSE = [
  "e5:6 g5:2 e5:4 c5:4", // C
  "~:4 d5:4 b4:6 ~:2", // G7
  "e5:6 g5:2 a5:4 g5:4",
  "~:4 f5:4 d5:6 ~:2",
  "c6:6 b5:2 a5:4 g5:4",
  "~:2 a5:2 g5:2 f5:2 d5:6 ~:2",
  "e5:6 d5:2 c5:4 e5:4",
  "~:4 f5:4 d5:4 b4:4",
];
const HOOK = [
  "c5:3 c5:3 e5:2 g5:4 e5:4",
  "~:4 f5:4 d5:4 ~:4",
  "c5:3 c5:3 e5:2 g5:4 a5:4",
  "~:4 g5:4 f5:4 d5:4",
];
/** Two calls for the montuno, between the refrain's halves. */
const CALL1 = ["~:2 g5:2 a5:2 g5:2 e5:4 c5:4", "~:4 d5:2 e5:2 f5:4 ~:4"];
const CALL2 = ["c6:4 ~:2 a5:2 g5:4 e5:4", "~:4 d5:4 b4:4 ~:4"];
const REST_BAR = "~:16";
const octaveDown = (line: string): string =>
  line.replace(/([a-g])(\d)/g, (_, n: string, o: string) => `${n}${Number(o) - 1}`);

const TUNE: Readonly<Record<SectionId, readonly string[] | null>> = {
  intro: null,
  verse1: T_VERSE,
  coro: [...HOOK, ...HOOK],
  verse2: T_VERSE,
  bells: null,
  montuno: [HOOK[0], HOOK[1], ...CALL1, HOOK[0], HOOK[1], ...CALL2] as string[],
  // The refrain; the horns answer it in bars 3–4 and 7–8.
  mambo: [HOOK[0], HOOK[1], REST_BAR, REST_BAR, HOOK[2], HOOK[3], REST_BAR, REST_BAR] as string[],
  // The refrain's first half, the band's three hits over G7 (B on the last), C.
  outro: [HOOK[0], HOOK[1], "g5:2 ~:4 g5:2 ~:4 b5:4", "c6:16"] as string[],
};

/** The horns' riff: over C on the three-side's strokes, rising to C; over G7 on the two-side's, falling to D. */
const RIFF = ["e5:2 ~:4 g5:2 ~:2 a5:2 c6:4", "~:4 b5:2 g5:2 f5:2 d5:2 ~:4"];
const RIFF_END = "~:4 b5:2 g5:2 f5:2 d5:2 g5:4";
const HORNS: Readonly<Record<SectionId, readonly string[] | null>> = {
  // Bars 3–4: a call into the verse, C's notes on the three-side, then F D G over G7.
  intro: [REST_BAR, REST_BAR, "g4:2 ~:4 c5:2 ~:4 e5:4", "~:4 f5:4 d5:4 g4:4"],
  verse1: null,
  coro: null,
  verse2: null,
  bells: null,
  montuno: null,
  // The refrain an octave down under the tune, the riff alone in between.
  mambo: [
    octaveDown(HOOK[0] as string),
    octaveDown(HOOK[1] as string),
    ...RIFF,
    octaveDown(HOOK[2] as string),
    octaveDown(HOOK[3] as string),
    RIFF[0] as string,
    RIFF_END,
  ],
  outro: [octaveDown(HOOK[0] as string), octaveDown(HOOK[1] as string), "d5:2 ~:4 d5:2 ~:4 f5:4", "e5:16"],
};

/** A tune section from `note:length` tokens (lengths in slots). */
function lineEvents(id: SectionId, lines: readonly string[]): Ev[] {
  const out: Ev[] = [];
  let t = 0;
  for (const tok of lines.join(" ").split(/\s+/)) {
    const [note, len] = tok.split(":");
    const n = Number(len);
    if (note !== "~") out.push({ at: t, len: n, tok: note as string, vel: 1 });
    t += n;
  }
  const total = sectionOf(id).bars * STEPS;
  if (t !== total) throw new Error(`R3 line ${id}: ${t} slots, not ${total}`);
  return out;
}
const lines = (by: Readonly<Record<SectionId, readonly string[] | null>>): BySection =>
  mapSections((id) => {
    const l = by[id];
    return l === null ? null : pitched(id, lineEvents(id, l), false);
  });

// ---- The drums ----------------------------------------------------------------------------------------------

/** A drum letter: the sound (with its sample) and its velocity. */
type DrumMap = Readonly<Record<string, readonly [string, number]>>;
const KICK: DrumMap = { X: ["bd", 1], x: ["bd", 0.8], g: ["bd", 0.55] };
/** The snare part: the backbeat, the clap, the toms of the fills and the crash. */
const SNARE: DrumMap = {
  X: ["sd", 1],
  x: ["sd", 0.7],
  g: ["sd", 0.3],
  C: ["cp", 0.9],
  c: ["cp", 0.6],
  L: ["lt", 0.85],
  M: ["mt", 0.85],
  H: ["ht", 0.85],
  Z: ["cr", 0.9],
};
/** The shaker and the hi-hats. */
const HATS: DrumMap = {
  S: ["sh", 1],
  s: ["sh", 0.55],
  X: ["hh", 1],
  x: ["hh", 0.6],
  g: ["hh", 0.35],
  O: ["oh", 0.8],
};
/** The claves. */
const CLAVE: DrumMap = { K: ["clave:0", 1], k: ["clave:2", 0.85] };
/** The cowbell: the open mouth (loud) and the heel (soft). */
const BELL: DrumMap = { B: ["cb", 1], b: ["cb", 0.55], q: ["cb", 0.45] };
/**
 * The hand drums (sound pack v4, VCSL): conga heel and tip (`conga:0` soft), the slap (`conga:2`), the open tones of
 * the low drum (`conga:6`) and of the conga (`conga:0`), the quinto (`conga:3`); bongo strokes (`bongo:2` muted),
 * the high bongo open (`bongo:0`) and the low one (`bongo:3`).
 */
const HANDS: DrumMap = {
  h: ["conga:0", 0.4],
  m: ["conga:2", 0.75],
  O: ["conga:6", 0.95],
  o: ["conga:0", 0.9],
  Q: ["conga:3", 0.9],
  b: ["bongo:2", 0.55],
  B: ["bongo:0", 0.95],
  l: ["bongo:3", 0.85],
};

/**
 * A drum section: one `<…>` entry a bar (repeats folded), its velocities alike, and its samples (`.n()`, when a
 * letter names one: `conga:2` is the conga's sample 2; the `:` of mini-notation is not in Oak's toolbox).
 */
function drumSection(id: SectionId, b: Bars, map: DrumMap): string {
  const n = sectionOf(id).bars;
  const slots = slotsOf(id, b);
  const sBars: string[] = [];
  const vBars: string[] = [];
  const nBars: string[] = [];
  let any = false;
  let indexed = false;
  for (let i = 0; i < n; i++) {
    const bar = slots.slice(i * STEPS, (i + 1) * STEPS);
    const s: string[] = [];
    const v: string[] = [];
    const k: string[] = [];
    for (const c of bar) {
      if (c === ".") {
        s.push("~");
        v.push("1");
        k.push("0");
        continue;
      }
      const hit = map[c];
      if (!hit) throw new Error(`R3 ${id}: drum letter "${c}"`);
      any = true;
      const [sound, sample = "0"] = hit[0].split(":");
      if (sample !== "0") indexed = true;
      s.push(sound as string);
      v.push(num(velIn(id, hit[1])));
      k.push(sample);
    }
    sBars.push(`[${s.join(" ")}]`);
    vBars.push(`[${v.join(" ")}]`);
    nBars.push(`[${k.join(" ")}]`);
  }
  if (!any) throw new Error(`R3 ${id}: a drum section with no hit (write null)`);
  // The three patterns fold over the same bars, so they keep one shape.
  const keyOf = (i: number) => `${sBars[i]}${vBars[i]}${indexed ? nBars[i] : ""}`;
  const p = period(sBars.map((_, i) => keyOf(i)));
  const fold = (xs: string[]): string => {
    if (p < xs.length) return p === 1 ? (xs[0] as string) : `<${xs.slice(0, p).join(" ")}>`;
    const out: string[] = [];
    for (let i = 0; i < xs.length; ) {
      let j = i;
      while (j + 1 < xs.length && keyOf(j + 1) === keyOf(i)) j++;
      out.push(j > i ? `${xs[i]}!${j - i + 1}` : (xs[i] as string));
      i = j + 1;
    }
    return `<${out.join(" ")}>`;
  };
  return `s("${fold(sBars)}")${indexed ? `.n("${fold(nBars)}")` : ""}.velocity("${fold(vBars)}")`;
}

// The parts every flavour shares: the clave, the cowbell's figures, the hand drums.
const CLAVE_32: Bars = (i) => (i % 2 ? "....K...K......." : "K.....K.....K...");
/** The cinquillo, soft: eighths 1, 3, 4, 6 and 7. */
const CINQUILLO = "q...q.q...q.q...";
/** The cowbell on the beats, loud, and on the "and"s, soft. */
const CAMPANA = "B.b.B.b.B.b.B.b.";
/** The mambo's cowbell: the cinquillo, loud (R3.L05's tape), then the same figure an eighth later (its displacement). */
const CINQUILLO_LOUD = "B...B.B...B.B...";
const CINQUILLO_LATE = "..B...B.B...B.B.";
/** Five hits over sixteen steps over C (the clave's three-side among them); the same, eight steps later, over G7. */
const BELLS: Bars = (i) => (i % 2 ? ".B..B...B..B..B." : "B..B..B..B..B...");
/** The conga's march: heel and tip, the slap on 2, two open tones on 4 and its "and". */
const TUMBA = "h.h.m.h.h.h.O.o.";
/** The bongo's eighths, the open tones on 4 and its "and". */
const MARTILLO = "b.b.b.b.b.b.B.l.";
/** A bongo and quinto answer in the fourth bar of four (the bell section). */
const HANDS_FILL = "h.h.m.h.Q.QQB.l.";

const CLAVE_PART: Readonly<Record<SectionId, Bars | null>> = {
  intro: CLAVE_32,
  verse1: CLAVE_32,
  coro: CLAVE_32,
  verse2: CLAVE_32,
  bells: CLAVE_32,
  montuno: CLAVE_32,
  mambo: CLAVE_32,
  // The ending's hits are the three-side over G7; the last bar, one stroke with the final chord.
  outro: (i) =>
    i === 0
      ? "K.....K.....K..."
      : i === 1
        ? "....K...K......."
        : i === 2
          ? "K.....K.....K..."
          : "K...............",
};
const BELL_PART: Readonly<Record<SectionId, Bars | null>> = {
  intro: null,
  verse1: CINQUILLO,
  coro: CAMPANA,
  verse2: CINQUILLO,
  bells: BELLS,
  montuno: CAMPANA,
  mambo: (i) => (i % 4 < 2 ? CINQUILLO_LOUD : CINQUILLO_LATE),
  outro: (i) => (i < 2 ? CAMPANA : i === 2 ? "B.....B.....B..." : "B..............."),
};
const HANDS_PART: Readonly<Record<SectionId, Bars | null>> = {
  intro: (i) => (i < 2 ? (i === 0 ? "................" : "............B.l.") : MARTILLO),
  verse1: MARTILLO,
  coro: TUMBA,
  verse2: TUMBA,
  bells: (i) => (i % 4 === 3 ? HANDS_FILL : TUMBA),
  montuno: TUMBA,
  mambo: TUMBA,
  outro: (i) => (i < 2 ? TUMBA : i === 2 ? "O.....O.....O..." : "O..............."),
};

type Drums = Readonly<Partial<Record<SectionId, Bars>>>;
interface Kit {
  /** `.bank()` for the kit's tracks (kick, snare, hats): one, or one per section; "" for the default kit. */
  bank: string | Partial<Record<SectionId, string>>;
  /** `.bank()` of the cowbell ("" for the default kit). */
  bellBank: string;
  sounds: { bass: string; keys: string; lead: string; horns: string };
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    clave: number;
    bell: number;
    hands: number;
    bass: number;
    keys: number;
    lead: number;
    horns: number;
  };
  /** content/flavours.ts production: room, the bass low-pass. */
  room: number;
  lpf: number;
  kick: Drums;
  snare: Drums;
  hats: Drums;
  /** The keys' comp outside the montuno (verses, refrain, bell section), and its voicing. */
  comp: Readonly<Partial<Record<SectionId, Bars>>>;
  voicing: (c: Chord) => string;
  /** Synth sounds and controls by section (electronic). */
  synth?: {
    bass: Partial<Record<SectionId, string>>;
    keys: Partial<Record<SectionId, string>>;
    lead: string;
    horns: string;
  };
}

/** Bar 8 of eight (bar 4 of four): a fill on the toms into the next section. */
const last = (i: number, n: number) => i === n - 1;
const FILL = "........L.LMM.HH";
/** The lo-fi kit has no middle tom (`lofikit_mt` is not in the pack): the snare takes its two hits. */
const FILL_LOFI = "........L.Lxx.HH";
const withFill =
  (bar: string, fill = FILL): Bars =>
  (i, n) =>
    last(i, n) ? fill : bar;
/** A crash on the first beat of the section, then `bar`. */
const crashIn =
  (bar: string, first: string): Bars =>
  (i, n) =>
    i === 0 ? first : last(i, n) ? FILL : bar;
/** The ending: the band's three hits over G7, then the final C. */
const END_HITS = {
  kick: ["X.....X.....X...", "X..............."],
  snare: ["Z.....H.....Z...", "Z..............."],
};
const outroOf =
  (bar: string, kind: "kick" | "snare"): Bars =>
  (i) =>
    i < 2 ? bar : (END_HITS[kind][i - 2] as string);

/** The comp rhythms: offbeats (son piano), eighths, the clave's strokes, the funk chops, one held chord a bar. */
const OFFBEATS = "..x...x...x...x.";
const EIGHTHS = "g.x.g.x.g.x.g.x.";
const PUNCH: Bars = (i) => (i % 2 ? "....x---x-------" : "x-----x-----x---");
const CHOPS = "..x..x.x..x..x.x";
const HELD = "x---------------";
/** The montuno in the intro, the montuno and the mambo; the ending's first two bars, its hits and its last chord. */
const OUTRO_KEYS: Bars = (i) => (i < 2 ? montuno(i, 4) : i === 2 ? "x-....x-....x---" : "x---------------");
const montunoComp = (comp: Bars, coro: Bars = comp): Readonly<Partial<Record<SectionId, Bars>>> => ({
  intro: montuno,
  verse1: comp,
  coro,
  verse2: comp,
  bells: HELD,
  montuno,
  mambo: montuno,
  outro: OUTRO_KEYS,
});

/** Pop: the default kit, piano montuno, picked bass, a piano tune and a trumpet. */
const POP: Kit = {
  bank: "",
  bellBank: "",
  sounds: { bass: "ebass", keys: "piano", lead: "piano", horns: "trumpet" },
  gain: {
    kick: 0.18,
    snare: 0.17,
    hats: 0.12,
    clave: 0.32,
    bell: 0.14,
    hands: 0.3,
    bass: 0.5,
    keys: 0.19,
    lead: 0.71,
    horns: 0.42,
  },
  room: 0.25,
  lpf: 800,
  kick: {
    intro: (i) => (i < 2 ? "................" : "X.....x.....x..."),
    verse1: "X.....x.....x...",
    coro: "X.....x.....x...",
    verse2: "X.....x.....x...",
    bells: "X.....x.....x...",
    montuno: "X.....x.....x...",
    mambo: "X.....x.....x...",
    outro: outroOf("X.....x.....x...", "kick"),
  },
  snare: {
    intro: (i) => (i === 3 ? FILL : "................"),
    verse1: withFill("....c.......c..."),
    coro: withFill("....c.......c..."),
    verse2: withFill("....c.......c..."),
    bells: withFill("................"),
    montuno: crashIn("....c.......c...", "Z...c.......c..."),
    mambo: crashIn("....C.......C...", "Z...C.......C..."),
    outro: outroOf("....C.......C...", "snare"),
  },
  hats: {
    intro: (i) => (i < 2 ? "................" : "S.s.S.s.S.s.S.s."),
    verse1: "S.s.S.s.S.s.S.s.",
    coro: "SsssSsssSsssSsss",
    verse2: "S.s.S.s.S.s.S.s.",
    bells: "SsssSsssSsssSsss",
    montuno: "S.s.S.s.S.s.S.s.",
    mambo: "SsssSsssSsssSsss",
    outro: (i) => (i < 2 ? "SsssSsssSsssSsss" : i === 2 ? "S.....S.....S..." : "S..............."),
  },
  comp: montunoComp(OFFBEATS),
  voicing: (c) => c.triad,
};

/** Indie: the rock kit, a clean guitar playing the montuno like a tres, a marimba tune, a trumpet. */
const INDIE: Kit = {
  bank: "rockkit",
  bellBank: "rockkit",
  sounds: { bass: "ebass", keys: "cleangtr", lead: "marimba", horns: "trumpet" },
  gain: {
    kick: 0.29,
    snare: 0.26,
    hats: 0.17,
    clave: 0.43,
    bell: 0.19,
    hands: 0.41,
    bass: 0.36,
    keys: 0.25,
    lead: 1,
    horns: 0.36,
  },
  room: 0.3,
  lpf: 750,
  kick: {
    intro: (i) => (i < 2 ? "................" : "X.....x.....x..."),
    verse1: "X.....x.....x.x.",
    coro: "X.....x.....x.x.",
    verse2: "X.....x.....x.x.",
    bells: "X.....x.....x...",
    montuno: "X.....x...x.x...",
    mambo: "X.....x...x.x...",
    outro: outroOf("X.....x...x.x...", "kick"),
  },
  snare: {
    intro: (i) => (i === 3 ? FILL : "................"),
    verse1: withFill("....x.......x..."),
    coro: withFill("....X.......X..."),
    verse2: withFill("....x.......x..."),
    bells: withFill("................"),
    montuno: crashIn("....x.......x...", "Z...x.......x..."),
    mambo: crashIn("....X.......X...", "Z...X.......X..."),
    outro: outroOf("....X.......X...", "snare"),
  },
  hats: {
    intro: (i) => (i < 2 ? "................" : "X.x.X.x.X.x.X.x."),
    verse1: "X.x.X.x.X.x.X.x.",
    coro: "X.O.X.O.X.O.X.O.",
    verse2: "X.x.X.x.X.x.X.x.",
    bells: "SsssSsssSsssSsss",
    montuno: "X.x.X.x.X.x.X.x.",
    mambo: "X.O.X.O.X.O.X.O.",
    outro: (i) => (i < 2 ? "X.O.X.O.X.O.X.O." : i === 2 ? "X.....X.....O..." : "O..............."),
  },
  // Offbeats in the verses, every eighth in the refrain.
  comp: montunoComp(OFFBEATS, EIGHTHS),
  voicing: (c) => c.triad,
};

/**
 * Jazz-soul: Oak's jazz kit, Rhodes, upright bass, vibes, a muted trumpet. Straight (a son does not swing). The Rhodes
 * punches the clave's strokes in the verses and the refrain, coloured C6/9 and G9; the hi-hat foot on 2 and 4 under
 * the shaker; no backbeat.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  bellBank: "jazzkit",
  sounds: { bass: "upright", keys: "rhodes", lead: "vibes", horns: "mutetpt" },
  gain: {
    kick: 0.21,
    snare: 0.32,
    hats: 0.22,
    clave: 0.36,
    bell: 0.18,
    hands: 0.36,
    bass: 0.71,
    keys: 0.38,
    lead: 0.42,
    horns: 0.34,
  },
  room: 0.35,
  lpf: 900,
  kick: {
    intro: (i) => (i < 2 ? "................" : "g.....x.....x..."),
    verse1: "g.....x.....x...",
    coro: "g.....x.....x...",
    verse2: "g.....x.....x...",
    bells: "g.....x.....x...",
    montuno: "g.....x.....x...",
    mambo: "x.....x.....x...",
    outro: outroOf("x.....x.....x...", "kick"),
  },
  snare: {
    intro: (i) => (i === 3 ? FILL : "................"),
    verse1: withFill("................"),
    coro: withFill("................"),
    verse2: withFill("................"),
    bells: withFill("................"),
    montuno: crashIn("................", "Z..............."),
    mambo: crashIn("....g.......g...", "Z...g.......g..."),
    outro: outroOf("....g.......g...", "snare"),
  },
  hats: {
    intro: (i) => (i < 2 ? "................" : "S.s.X.s.S.s.X.s."),
    verse1: "S.s.X.s.S.s.X.s.",
    coro: "SsssXsssSsssXsss",
    verse2: "S.s.X.s.S.s.X.s.",
    bells: "SsssXsssSsssXsss",
    montuno: "S.s.X.s.S.s.X.s.",
    mambo: "SsssXsssSsssXsss",
    outro: (i) => (i < 2 ? "SsssXsssSsssXsss" : i === 2 ? "S.....S.....S..." : "S..............."),
  },
  comp: montunoComp(PUNCH),
  voicing: (c) => c.rich,
};

/** Funk: Oak's 808, clavinet, finger bass, an organ tune and a trumpet; sixteenths, straight. */
const FUNK: Kit = {
  bank: "oak808",
  bellBank: "oak808",
  sounds: { bass: "fingerbass", keys: "clav", lead: "organ", horns: "trumpet" },
  gain: {
    kick: 0.33,
    snare: 0.27,
    hats: 0.16,
    clave: 0.31,
    bell: 0.14,
    hands: 0.29,
    bass: 0.63,
    keys: 0.51,
    lead: 0.52,
    horns: 0.37,
  },
  room: 0.2,
  lpf: 850,
  kick: {
    intro: (i) => (i < 2 ? "................" : "X.....x.....x..."),
    verse1: "X..x..x.....x..x",
    coro: "X..x..x.....x..x",
    verse2: "X..x..x.....x..x",
    bells: "X.....x.....x...",
    montuno: "X.....x..x..x...",
    mambo: "X.....x..x..x...",
    outro: outroOf("X.....x..x..x...", "kick"),
  },
  snare: {
    intro: (i) => (i === 3 ? FILL : "................"),
    verse1: withFill("....X.......X..."),
    coro: withFill("....X..g.g..X..g"),
    verse2: withFill("....X.......X..."),
    bells: withFill("................"),
    montuno: crashIn("....X.......X...", "Z...X.......X..."),
    mambo: crashIn("....X..g.g..X..g", "Z...X..g.g..X..g"),
    outro: outroOf("....X..g.g..X..g", "snare"),
  },
  hats: {
    intro: (i) => (i < 2 ? "................" : "XgxgXgxgXgxgXgxg"),
    verse1: "X.x.X.x.X.x.X.x.",
    coro: "XgxgXgxOXgxgXgxg",
    verse2: "X.x.X.x.X.x.X.x.",
    bells: "SsssSsssSsssSsss",
    montuno: "X.x.X.x.X.x.X.x.",
    mambo: "XgxgXgxOXgxgXgxO",
    outro: (i) => (i < 2 ? "XgxgXgxOXgxgXgxg" : i === 2 ? "X.....X.....O..." : "O..............."),
  },
  comp: montunoComp(CHOPS),
  voicing: (c) => c.rich,
};

// Electronic: a Latin house record. The lo-fi kit with a sine sub and a swelling supersaw pad in the intro and the
// verses; Oak's 909 four on the floor with a clap from the refrain on, the acid line (the TB-303 recipe: a sawtooth
// under a resonant ladder filter whose envelope opens on an accent pattern) on the same tresillo and tumbao notes,
// sawtooth stabs ducked on the beat for the refrain and the montuno, Oak's 808 cowbell, a square pluck with a
// dotted-eighth echo for the tune, a filtered sawtooth for the horns.
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
const ACID = '.lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
const PUMP = '.postgain("[.6 1]*4")';
/**
 * The 808 kick (funk's `oak808`) rings for seconds with no choke: hits a beat apart pile up, by up to 7 dB and by the
 * tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at 96). A 0.35 s decay keeps
 * its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";
/** The supersaw swell reads 5–7 LU over the stabs of the loud parts: lowered, so the loud parts stay louder (songs.pw.ts). */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
const FLOOR = "X...X...X...X...";

const ELECTRONIC: Kit = {
  bank: {
    intro: "lofikit",
    verse1: "lofikit",
    coro: "oak909",
    verse2: "lofikit",
    bells: "oak909",
    montuno: "oak909",
    mambo: "oak909",
    outro: "oak909",
  },
  bellBank: "oak808",
  sounds: { bass: "sine", keys: "supersaw", lead: "square", horns: "sawtooth" },
  gain: {
    kick: 0.27,
    snare: 0.17,
    hats: 0.11,
    clave: 0.3,
    bell: 0.12,
    hands: 0.28,
    bass: 0.38,
    keys: 0.13,
    lead: 0.49,
    horns: 0.22,
  },
  room: 0.2,
  lpf: 700,
  kick: {
    intro: (i) => (i < 2 ? "................" : "X.....x.....x..."),
    verse1: "X.....x.....x...",
    coro: FLOOR,
    verse2: "X.....x.....x...",
    bells: FLOOR,
    montuno: FLOOR,
    mambo: FLOOR,
    outro: outroOf(FLOOR, "kick"),
  },
  snare: {
    // The intro and the verses play the lo-fi kit: its fill has no middle tom.
    intro: (i) => (i === 3 ? FILL_LOFI : "................"),
    verse1: withFill("....x.......x...", FILL_LOFI),
    coro: withFill("....C.......C..."),
    verse2: withFill("....x.......x...", FILL_LOFI),
    bells: withFill("................"),
    montuno: crashIn("....C.......C...", "Z...C.......C..."),
    mambo: crashIn("....C.......C...", "Z...C.......C..."),
    outro: outroOf("....C.......C...", "snare"),
  },
  hats: {
    intro: (i) => (i < 2 ? "................" : "S.s.S.s.S.s.S.s."),
    verse1: "S.s.S.s.S.s.S.s.",
    coro: "..O...O...O...O.",
    verse2: "S.s.S.s.S.s.S.s.",
    bells: "XgxgXgxgXgxgXgxg",
    montuno: "g.O.g.O.g.O.g.O.",
    mambo: "XgOgXgOgXgOgXgOg",
    outro: (i) => (i < 2 ? "XgOgXgOgXgOgXgOg" : i === 2 ? "X.....X.....O..." : "O..............."),
  },
  // The pad swells on every beat in the verses; the refrain's stabs sit on the "and"s, between the kicks.
  comp: montunoComp("x---x---x---x---", OFFBEATS),
  voicing: (c) => c.four,
  synth: {
    bass: {
      intro: `.s("sine")${SUB}`,
      verse1: `.s("sine")${SUB}`,
      coro: `.s("sawtooth")${ACID}`,
      verse2: `.s("sine")${SUB}`,
      bells: `.s("sine")${SUB}`,
      montuno: `.s("sawtooth")${ACID}`,
      mambo: `.s("sawtooth")${ACID}`,
      outro: `.s("sawtooth")${ACID}`,
    },
    keys: {
      intro: `.s("sawtooth")${STAB}`,
      verse1: `.s("supersaw")${PAD}`,
      coro: `.s("sawtooth")${STAB}`,
      verse2: `.s("supersaw")${PAD}`,
      bells: `.s("supersaw").attack(.3).decay(1.5).sustain(.6).postgain(.6)`,
      montuno: `.s("sawtooth")${STAB}`,
      mambo: `.s("sawtooth")${STAB}${PUMP}`,
      outro: `.s("sawtooth")${STAB}`,
    },
    lead: ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.45).delayfeedback(.35)",
    horns: ".lpf(2000).lpenv(1.5).lpd(.2).lps(.4).decay(.3).sustain(.5)",
  },
};

const KITS: Readonly<Record<FlavourId, Kit>> = {
  "flavour.pop": POP,
  "flavour.indie": INDIE,
  "flavour.jazz-soul": JAZZ,
  "flavour.funk": FUNK,
  "flavour.electronic": ELECTRONIC,
};

function mapSections(f: (id: SectionId) => string | null): BySection {
  return Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, string | null>;
}

/** One flavour's song: the tune, the horns, the keys, the bass, then the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  const syn = k.synth;
  const kitBank = (id: SectionId): string => (typeof k.bank === "string" ? k.bank : (k.bank[id] ?? "oak909"));
  const bankOf = (id: SectionId) => (typeof k.bank === "string" ? "" : `.bank("${kitBank(id)}")`);
  const kitTail = typeof k.bank === "string" && k.bank ? `.bank("${k.bank}")` : "";
  const drums = (
    by: Readonly<Partial<Record<SectionId, Bars | null>>>,
    map: DrumMap,
    perSection = true,
  ): BySection =>
    mapSections((id) => {
      const b = by[id];
      return b === undefined || b === null
        ? null
        : `${drumSection(id, b, map)}${perSection ? bankOf(id) : ""}`;
    });
  const keys = mapSections((id) => {
    const b = k.comp[id];
    if (b === undefined) return null;
    return `${pitched(id, chordEvents(id, b, k.voicing, MONTUNO_VEL))}${syn?.keys[id] ?? ""}`;
  });
  const bass = mapSections((id) => `${pitched(id, bassEvents(id, BASS[id]))}${syn?.bass[id] ?? ""}`);
  /** The kick, in the sections played on an 808, gets its decay (KICK_808). */
  const kick = mapSections((id) => {
    const p = drums(k.kick, KICK)[id];
    return p && /^(RolandTR808|oak808)$/.test(kitBank(id)) ? `${p}${KICK_808}` : p;
  });
  const bellTail = k.bellBank ? `.bank("${k.bellBank}")` : "";
  const tracks = [
    track(
      "mel",
      lines(TUNE),
      `.s("${k.sounds.lead}")${syn?.lead ?? ""}.gain(${num(k.gain.lead)}).pan(.6).room(${num(k.room)})`,
    ),
    track(
      "horns",
      lines(HORNS),
      `.s("${k.sounds.horns}")${syn?.horns ?? ""}.gain(${num(k.gain.horns)}).pan(.7).room(${num(k.room)})`,
    ),
    track(
      "keys",
      keys,
      `${syn ? "" : `.s("${k.sounds.keys}")`}.gain(${num(k.gain.keys)}).pan(.4).room(${num(k.room)})`,
    ),
    track("bass", bass, `${syn ? "" : `.s("${k.sounds.bass}")`}.lpf(${k.lpf}).gain(${num(k.gain.bass)})`),
    track("kick", kick, `${kitTail}.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare, SNARE), `${kitTail}.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats, HATS), `${kitTail}.gain(${num(k.gain.hats)}).pan(.65)`),
    track("perc", drums(CLAVE_PART, CLAVE, false), `.gain(${num(k.gain.clave)}).pan(.55)`),
    track("perc2", drums(BELL_PART, BELL, false), `${bellTail}.gain(${num(k.gain.bell)}).pan(.35)`),
    track(
      "perc3",
      drums(HANDS_PART, HANDS, false),
      `.gain(${num(k.gain.hands)}).pan(.3).room(${num(k.room)})`,
    ),
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

export const R3_SONG = defineUnitSong({
  id: "usong.R3",
  unit: "R3",
  version: 1,
  title: "Wood and iron",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Melody", plainName: "Tune" },
    { id: "horns", label: "horns", role: "melody", name: "Horns", plainName: "Horns" },
    { id: "keys", label: "keys", role: "chords", name: "Keys", plainName: "Keys" },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
    { id: "kick", label: "kick", role: "drums", sounds: ["bd"], name: "Kick", plainName: "Kick" },
    {
      id: "snare",
      label: "snare",
      role: "drums",
      sounds: ["sd", "cp", "lt", "mt", "ht", "cr"],
      name: "Snare, toms and crash",
      plainName: "Snare, toms and crash",
    },
    {
      id: "hats",
      label: "hats",
      role: "drums",
      sounds: ["hh", "oh", "sh", "tb", "rd"],
      name: "Shaker and hi-hats",
      plainName: "Shaker and hi-hats",
    },
    {
      id: "clave",
      label: "perc",
      role: "drums",
      sounds: ["clave", "rim"],
      name: "Clave",
      plainName: "Sticks",
      termId: "term.clave",
    },
    { id: "bell", label: "perc2", role: "drums", sounds: ["cb"], name: "Cowbell", plainName: "Cowbell" },
    {
      id: "hands",
      label: "perc3",
      role: "drums",
      sounds: ["conga", "bongo"],
      name: "Congas and bongos",
      plainName: "Hand drums",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // By section (AUTHORING §23.6). R3.L01 and R3.L02 take parts (a bass and a cowbell; a rhythm on the rimshot and a
  // tune), R3.L03 the percussion of the bell section, R3.L04 and R3.L05 whole sections of the band (their pianos play
  // chords, so Oak's tune is kept over them where it fits, clash-checked).
  plan: [
    take(
      "R3.L01",
      ["verse1", "verse2"],
      ["bass", "bell"],
      "oak",
      "Your bass, three notes a bar spaced 3+3+2, and your cowbell play under both verses of the song.",
    ),
    take(
      "R3.L02",
      ["coro"],
      ["clave", "lead"],
      "oak",
      "Your two-bar rimshot rhythm and a piano tune that lands with it play the chorus after the first verse.",
    ),
    take(
      "R3.L03",
      ["bells"],
      ["clave", "bell", "kick", "hats"],
      "oak",
      "Your percussion lines, spread by numbers in brackets, play the eight-bar break after the second verse.",
    ),
    take(
      "R3.L04",
      ["montuno"],
      ["clave", "bell", "bass", "keys"],
      "oak",
      "Your piano figure and your bass, lined up with the clave, play the vamp under Oak's chorus tune.",
      ["lead"],
    ),
    // Opens with the lesson's own tape (clave, cinquillo cowbell, kick, tumbao, montuno), the groove the learner has
    // just taken apart by ear, not with R3.L04's take: `kick` must be in `parts` (the tape plays one), and an R3.L04
    // take has no kick, so starting from it would leave the loudest section without one.
    take(
      "R3.L05",
      ["mambo"],
      ["clave", "bell", "kick", "bass", "keys"],
      "oak",
      "Your son band, its cowbell moved later in bars 3 and 4, plays the horns' section after the vamp.",
      ["lead", "horns"],
    ),
  ],
  releaseAfter: "R.CP",
});

export default R3_SONG;
