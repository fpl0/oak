// Song A1, "Turn the dial" (docs/design/songs/makes-core-c.md §4 "A Arrangement & Sound" and §4.1, A1: "the C-major
// vamp loop, 100; one part's sound per lesson"; AUTHORING §23). C major, 4/4, 100 BPM, 57 bars (2:17): the sound
// design unit gets one two-chord vamp, C to F, that never changes its notes and keeps changing its sound. It opens
// like an old record, grows a build-up, drops into a squelching chorus, empties into a room full of echoes, builds
// again and drops into its loudest chorus, then turns back into the old record. In the electronic style it is an acid
// track from the first chorus on; in the other four styles the same moves are made with the style's own band.
//
//   intro 4   verse1 8   lift1 4   chorus1 8   verse2 8   bridge 8   lift2 4   chorus2 8   outro 4   end 1
//   (C F) in every bar but the last, which is C
//
// Every section is the A1 loop's two bars, C then F, so every lesson's Make (the A1 loop, the same notes in all seven
// lessons, over the Band's C | F) fits every section; each lesson takes the section whose sound is its idea:
// - intro and outro: grit (A1.L05). The snare and hats through a low-pass (electronic: the lo-fi kit), the chords
//   low-passed and crushed to six bits, a crackle bed under it all: a record from a shelf. The outro brings the riff
//   back the same way, and one clean bar of C ends the song.
// - verse1: waves (A1.L01). The vamp, clean, the riff on top (electronic: a wavetable bass and a wavetable e-piano).
// - lift1, lift2: movement (A1.L06). The chords pulse (eighths; funk sixteenths) while their cutoff climbs over four
//   bars, a pad swells in under a sweep of its own, the long-note tune wobbles (vibrato), a noise riser climbs (pink noise whose cutoff jumps
//   up two octaves every bar: noise plus a filter sweep), and the snare rolls in quarters, eighths, then sixteenths.
// - chorus1: filters (A1.L02). The song turns acid: the bass squelches open on every note under a resonant ladder
//   filter whose envelope opens wider on an accent pattern (electronic: the TB-303 recipe on a sawtooth; pop, indie and
//   funk: the same filter on the band's own bass; jazz-soul: the upright stays plain and the Rhodes wahs through an
//   envelope filter), the riff an octave up.
// - verse2: envelopes (A1.L03). The bass and the chords are plucked (`.decay()` with `.sustain(0)`; electronic: the
//   acid line and the stabs, short), and in the electronic style a kick made by a synth (`sbd`, a wave whose pitch
//   falls fast).
// - bridge: space (A1.L04). The drums stop; a pad swells in slowly and the tune plays long notes into a big room with
//   echoes on a dotted eighth (0.45 s at 100 BPM), the tune and the pad on an orbit of their own (orbit 3).
// - chorus2: richer sources (A1.L07). Chorus1 with a pad over it (electronic: a supersaw, and the riff rung like a bell
//   with FM).
//
// The tune is the A1 riff, G G E G · E C · | A A F A · F C ·, the same notes as every A1 Make's riff, so a learner's
// riff in place of Oak's keeps the song's tune: in the verses and the ending on C4, in the choruses an octave up with an
// answer that climbs to C6 and falls to C5; the build-ups hold long notes (G5 E5 | A5 F5, A1.L06's lead), the bridge
// plays G · E · | A · F ·, a beat each with a beat's rest (A1.L03's quarter-note riff, an octave up), and climbs into
// the second build-up. The intro has no tune.
//
// Harmony and clashes (read from the evaluated events, AUTHORING §13): every tune note is a chord tone of the bar's
// chord (G, E or C over C; A, F or C over F) but two: the chorus's last bar passes through G5 over F (an eighth, the
// ninth) and the bridge's seventh bar steps up to A5 over C for a beat (the sixth, a whole step from G). No tune or
// bass note, of any length, sits a half step from a sounding chord or pad note, in any style. The bass plays roots, fifths and octaves only (C2, G1, C3 under C; F1, C2, F2 under F),
// the A1 bass line's own notes: its root on every downbeat. Chords are close triads under the tune (C: E3 G3 C4,
// F: F3 A3 C4; the choruses G3 C4 E4 and A3 C4 F4), the pad G3 C4 E4 | A3 C4 F4. Jazz-soul colours them with a
// ninth (Cadd9 E3 G3 C4 D4, Fadd9 F3 G3 A3 C4: ninths, not sixths or major sevenths, so they read as C and F with or
// without the bass, and nothing in the tune sits a half step from the added note); funk and electronic stay triads,
// as their staging asks of a unit that opens at U03.L02 (contracts §5.10). The song is straight in every style: every
// A1 Make is straight eighths the learner writes (contracts §5.11 rule 7).
//
// One builder writes all five flavours (AUTHORING §23.2), so the tune, the bass downbeats and the chord roots cannot
// drift. Gains start from U13's levelled kits; packages/strudel/e2e/songs.pw.ts levels them (budget
// sound-songs.json), so the learner's line sits on top.
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
  { id: "lift1", type: "lift", bars: 4 },
  { id: "chorus1", type: "chorus", bars: 8 },
  { id: "verse2", type: "verse", bars: 8 },
  { id: "bridge", type: "bridge", bars: 8 },
  { id: "lift2", type: "lift", bars: 4 },
  { id: "chorus2", type: "chorus", bars: 8 },
  { id: "outro", type: "outro", bars: 4 },
  // One bar of C: the vamp stops on F, and the record lands home.
  { id: "end", type: "outro", bars: 1 },
] as const satisfies readonly UnitSongSection[];
type SectionId = (typeof SECTIONS)[number]["id"];
/** What one track plays in each section: a Strudel expression, or `null` where it rests. */
type BySection = Readonly<Record<SectionId, string | null>>;

const STEPS = 16;
const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** A number as Strudel code is written in this repo: `.4`, not `0.4`. */
const num = (x: number): string => String(x).replace(/^0\./, ".");
const sectionOf = (id: SectionId) => SECTIONS.find((s) => s.id === id) as (typeof SECTIONS)[number];
const mapSections = (f: (id: SectionId) => string | null): BySection =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, f(s.id)])) as Record<SectionId, string | null>;

/**
 * One labelled track in the STYLE §10 shape: a const per distinct section pattern, named by the section's type
 * (`melChorus`; `kickVerse2` for a second, different verse), `silence` where it rests, and one `arrange()` over every
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

type ChordName = "C" | "F";
interface Chord {
  /** Bass: root, fifth (the A1 bass line's: G1 under C, C2 under F) and octave. */
  r: string;
  f: string;
  o: string;
  /** Close triads under the tune; `high` for the choruses; `add9` jazz-soul's colour; `pad` the pad's voicing. */
  triad: string;
  high: string;
  add9: string;
  pad: string;
}
const CHORD: Readonly<Record<ChordName, Chord>> = {
  C: { r: "c2", f: "g1", o: "c3", triad: "e3,g3,c4", high: "g3,c4,e4", add9: "e3,g3,c4,d4", pad: "g3,c4,e4" },
  F: { r: "f1", f: "c2", o: "f2", triad: "f3,a3,c4", high: "a3,c4,f4", add9: "f3,g3,a3,c4", pad: "a3,c4,f4" },
};
/** The vamp: C in every odd bar, F in every even bar; the last bar of the song is C. */
const chordAt = (id: SectionId, bar: number): ChordName => (id === "end" || bar % 2 === 0 ? "C" : "F");

// ---- Patterns on a grid -------------------------------------------------------------------------------------
//
// A part is written as one string of sixteen slots per bar and read as events: a letter starts a note, `-` holds it
// into the next slot, `.` is silence. A section becomes one `[…]` per bar inside `< >` (only as many bars as repeat).

interface Ev {
  at: number;
  len: number;
  tok: string;
  vel: number;
}
/** One bar of slots: a string, or a function of the bar's index in its section and the section's length. */
type Bars = string | ((i: number, n: number) => string);
const barOf = (b: Bars, i: number, n: number): string => (typeof b === "string" ? b : b(i, n));
/** The last bar of a section differs (a fill, a stop). */
const lastBar =
  (bar: string, last: string): Bars =>
  (i, n) =>
    i === n - 1 ? last : bar;
/** Bars 1 and 5 (a section's first bar and its middle) differ: a crash. */
const onFirst =
  (first: string, rest: string): Bars =>
  (i) =>
    i % 4 === 0 ? first : rest;
const listed =
  (bars: readonly string[]): Bars =>
  (i) =>
    bars[i % bars.length] as string;

/** A section's slots, bar after bar, checked for length. */
function slotsOf(id: SectionId, b: Bars): string {
  const n = sectionOf(id).bars;
  let out = "";
  for (let i = 0; i < n; i++) {
    const bar = barOf(b, i, n);
    if (bar.length !== STEPS)
      throw new Error(`A1 ${id} bar ${i + 1}: ${bar.length} slots, not ${STEPS}: "${bar}"`);
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

/** A weighted sequence over `total` slots and its velocities; runs of one-slot notes fold to `tok!k`. */
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

/** The shortest run of bars that repeats through the whole list (the two-bar vamp: 2). */
function period(bars: readonly string[]): number {
  for (let p = 1; p < bars.length; p++)
    if (bars.length % p === 0 && bars.every((b, i) => b === bars[i % p])) return p;
  return bars.length;
}
/** Bars as one pattern: a single bar bare, else `< >` over the bars that repeat, runs folded with `!`. */
function alt(xs: readonly string[]): string {
  const one = xs.slice(0, period(xs));
  if (one.length === 1) return one[0] as string;
  const out: string[] = [];
  for (let i = 0; i < one.length; ) {
    let j = i;
    while (j + 1 < one.length && one[j + 1] === one[i]) j++;
    out.push(j > i ? `${one[i]}!${j - i + 1}` : (one[i] as string));
    i = j + 1;
  }
  return `<${out.join(" ")}>`;
}

/** A pitched section: one `[…]` a bar (no note crosses a bar line in this song). */
function pitched(id: SectionId, evs: readonly Ev[], withVel = true): string {
  const bars = sectionOf(id).bars;
  const per = Array.from({ length: bars }, (_, b) => {
    const inBar = evs.filter((e) => Math.floor(e.at / STEPS) === b);
    for (const e of inBar)
      if ((e.at % STEPS) + e.len > STEPS)
        throw new Error(`A1 ${id}: a note crosses the bar line of bar ${b + 1}`);
    return sequence(
      inBar.map((e) => ({ ...e, at: e.at - b * STEPS })),
      STEPS,
    );
  });
  const notes = alt(per.map((x) => x.notes));
  const vel = alt(per.map((x) => x.vel));
  return `note("${notes}")${withVel ? `.velocity("${vel}")` : ""}`;
}

/** Velocity by letter. */
type Vel = Readonly<Record<string, number>>;
/** Chords from slots: `X` the bar's chord, accented; `x` the bar's chord; `g` softly. */
function chordEvents(id: SectionId, b: Bars, voicing: (c: Chord) => string, vel: Vel): Ev[] {
  return eventsOf(slotsOf(id, b), (c, s) => {
    if (!(c in vel)) throw new Error(`A1 ${id}: chord letter "${c}"`);
    return { tok: `[${voicing(CHORD[chordAt(id, Math.floor(s / STEPS))])}]`, vel: vel[c] as number };
  });
}
/** Bass from slots: `r` root, `f` fifth, `o` octave of the bar's chord. */
function bassEvents(id: SectionId, b: Bars): Ev[] {
  return eventsOf(slotsOf(id, b), (c, s) => {
    const k = ({ r: "r", f: "f", o: "o" } as const)[c as "r" | "f" | "o"];
    if (!k) throw new Error(`A1 ${id}: "${c}" in a bass line`);
    return { tok: CHORD[chordAt(id, Math.floor(s / STEPS))][k], vel: c === "r" ? 1 : 0.9 };
  });
}

// ---- The tune (every flavour) -------------------------------------------------------------------------------
//
// In sixteenths, `note:length`. The A1 riff: G G E G, a rest, E C, a rest over C; A A F A, a rest, F C, a rest over F.

const R_C = "g4:2 g4:2 e4:2 g4:2 ~:2 e4:2 c4:2 ~:2";
const R_F = "a4:2 a4:2 f4:2 a4:2 ~:2 f4:2 c4:2 ~:2";
const RIFF = [R_C, R_F];
const T_VERSE = [...RIFF, ...RIFF, ...RIFF, ...RIFF];
// The choruses: the riff an octave up, its third bar climbing to C6, its fourth landing on C5 (half a bar), and the
// phrase's end falling A G F C.
const C1 = "g5:2 g5:2 e5:2 g5:2 ~:2 e5:2 c5:2 ~:2";
const C2 = "a5:2 a5:2 f5:2 a5:2 ~:2 f5:2 c5:2 ~:2";
const C3 = "g5:2 g5:2 e5:2 g5:2 ~:2 e5:2 g5:2 c6:2";
const T_CHORUS = [C1, C2, C3, "a5:6 f5:2 c5:8", C1, C2, C3, "a5:6 g5:2 f5:4 c5:4"];
// The build-ups: A1.L06's long-note lead, G (three beats) E | A (three beats) F.
const T_LIFT = ["g5:12 e5:4", "a5:12 f5:4", "g5:12 e5:4", "a5:12 f5:4"];
// The bridge: the riff's first notes a beat apart (A1.L03's quarter-note riff, an octave up), echoing; it climbs into
// the second build-up.
const B_C = "g5:4 ~:4 e5:4 ~:4";
const B_F = "a5:4 ~:4 f5:4 ~:4";
const T_BRIDGE = [B_C, B_F, B_C, B_F, B_C, B_F, "g5:4 a5:4 g5:4 e5:4", "f5:4 a5:4 c6:4 ~:4"];

/** A tune section from `note:length` tokens. */
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
  if (t !== total) throw new Error(`A1 tune ${id}: ${t} slots, not ${total}`);
  return out;
}
const tune = (id: SectionId, lines: readonly string[]) => pitched(id, tuneEvents(id, lines), false);
const MEL: BySection = {
  intro: null,
  verse1: tune("verse1", T_VERSE),
  lift1: tune("lift1", T_LIFT),
  chorus1: tune("chorus1", T_CHORUS),
  verse2: tune("verse2", T_VERSE),
  bridge: tune("bridge", T_BRIDGE),
  lift2: tune("lift2", T_LIFT),
  chorus2: tune("chorus2", T_CHORUS),
  outro: tune("outro", [...RIFF, ...RIFF]),
  end: tune("end", ["c5:16"]),
};

// ---- Drums --------------------------------------------------------------------------------------------------

/** A drum letter: the sound (or a bracket of sounds) and its velocity. */
type DrumMap = Readonly<Record<string, readonly [string, number]>>;
const KICK: DrumMap = { X: ["bd", 1], x: ["bd", 0.8], g: ["bd", 0.5], S: ["sbd", 1], s: ["sbd", 0.75] };
const SNARE: DrumMap = {
  X: ["sd", 1],
  x: ["sd", 0.75],
  g: ["sd", 0.3],
  R: ["rim", 1],
  r: ["rim", 0.7],
  C: ["[sd,cp]", 0.9],
  c: ["cp", 0.85],
};
const HATS: DrumMap = { X: ["hh", 1], x: ["hh", 0.6], g: ["hh", 0.4], O: ["oh", 0.8], o: ["oh", 0.5] };
const PERC: DrumMap = {
  C: ["cr", 1],
  R: ["rd", 0.8],
  r: ["rd", 0.55],
  T: ["tb", 0.7],
  t: ["tb", 0.4],
  K: ["cb", 0.6],
  S: ["sh", 0.6],
  s: ["sh", 0.35],
  Z: ["[cr,rd]", 1],
};

/** A drum section: one `[…]` a bar inside `< >` (repeats folded with `!`), its velocities alike. */
function drumSection(id: SectionId, b: Bars, map: DrumMap): string {
  const n = sectionOf(id).bars;
  const slots = slotsOf(id, b);
  const sBars: string[] = [];
  const vBars: string[] = [];
  let any = false;
  for (let i = 0; i < n; i++) {
    const s: string[] = [];
    const v: string[] = [];
    for (const c of slots.slice(i * STEPS, (i + 1) * STEPS)) {
      if (c === ".") {
        s.push("~");
        v.push("1");
        continue;
      }
      const hit = map[c];
      if (!hit) throw new Error(`A1 ${id}: drum letter "${c}"`);
      any = true;
      s.push(hit[0]);
      v.push(num(hit[1]));
    }
    sBars.push(`[${s.join(" ")}]`);
    vBars.push(`[${v.join(" ")}]`);
  }
  if (!any) throw new Error(`A1 ${id}: a drum section with no hit (write null)`);
  // Sounds and velocities fold over the same bars, so the two patterns keep one shape.
  const same = (a: number, b: number) => sBars[a] === sBars[b] && vBars[a] === vBars[b];
  const fold = (xs: string[]): string => {
    let p: number = n;
    for (let q = 1; q < n; q++)
      if (n % q === 0 && xs.every((_, i) => same(i, i % q))) {
        p = q;
        break;
      }
    if (p === 1) return xs[0] as string;
    const out: string[] = [];
    for (let i = 0; i < p; ) {
      let j = i;
      while (j + 1 < p && same(j + 1, i)) j++;
      out.push(j > i ? `${xs[i]}!${j - i + 1}` : (xs[i] as string));
      i = j + 1;
    }
    return `<${out.join(" ")}>`;
  };
  // Every hit at full strength: no velocity pattern.
  if (vBars.every((v) => /^\[(?:1 )*1\]$/.test(v))) return `s("${fold(sBars)}")`;
  return `s("${fold(sBars)}").velocity("${fold(vBars)}")`;
}

// Bars several kits share.
const K4 = "X...X...X...X...";
const SN_BACK = "....X.......X...";
const HH8 = "X.x.X.x.X.x.X.x.";
const HH16 = "XgxgXgxgXgxgXgxg";
const SILENT = "................";
/** The build-up: four on the floor that stops after beat 3 of its last bar; the snare rolls ever faster. */
const KICK_LIFT = lastBar(K4, "X...X...X.......");
const SNARE_LIFT = listed(["....X.......X...", "X...X...X...X...", "X.x.X.x.X.x.X.x.", "XxXxXxXxXXXX...."]);
const CLAP_LIFT = listed(["....c.......c...", "c...c...c...c...", "c.c.c.c.c.c.c.c.", "cccccccccccc...."]);
/** The crash that opens a section, and again at its fifth bar. */
const CRASH = onFirst("C...............", SILENT);
const CRASH_ONCE: Bars = (i) => (i === 0 ? "C..............." : SILENT);

/**
 * Noise in the percussion part, outside the kit (no `.bank()`): the riser of the build-ups, pink noise held for a
 * bar whose cutoff opens two octaves over the bar (a filter envelope with a bar-long attack, 2.4 s at 100 BPM), from
 * a base that doubles every bar, louder each bar; and the crackle of an old record in the opening and the ending.
 */
const RISER = 's("pink").lpf("<300 600 1200 2400>").lpenv(2).lpa(2.4).velocity("<.3 .45 .6 .8>")';
const CRACKLE = 's("crackle").density(.12).velocity(.7)';

/**
 * The 808 kick (funk's `oak808`) rings for seconds with no choke: hits a beat apart pile up, by up to 7 dB and by the
 * tempo (packages/strudel/e2e/songs.pw.ts measured `bd*4` at −8.6 LUFS at 92 BPM, −14.9 at 96). A 0.35 s decay keeps
 * its thump and stops the pile-up.
 */
const KICK_808 = ".decay(.35).sustain(0)";

// ---- The electronic recipes ---------------------------------------------------------------------------------

/**
 * The acid filter on a band's own bass (pop, indie): the ladder at a lower resonance than the 303's, its envelope
 * opening wider on the accents and snapping shut, so the choruses squelch in every style, not only in electronic.
 */
const BAND_ACID = '.lpq(10).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0)';
/** The sine sub reads 6–9 LU over the acid bass of the loud parts: half its level, so the loud parts stay louder (songs.pw.ts). */
const SUB = ".decay(1.2).sustain(.7).postgain(.5)";
/** The TB-303 recipe: a resonant ladder filter whose envelope opens on an accent pattern, short notes. */
const ACID = '.lpf(700).lpq(12).ftype("ladder").lpenv("<3 1.5 2 4>*8").lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The build-ups: the same line, its envelope opening wider over the four bars. */
const ACID_RISING =
  '.lpf(700).lpq(12).ftype("ladder").lpenv(saw.range(1, 5).slow(4)).lpd(.14).lps(0).decay(.2).sustain(.4)';
/** The choruses: the envelope wide open on the accents, the resonance up. */
const ACID_OPEN =
  '.lpf(700).lpq(14).ftype("ladder").lpenv("<4 2 3 6>*8").lpd(.16).lps(0).decay(.2).sustain(.4)';
/** Every sixteenth of the acid bar sounds the root or its octave, so each stab has its root under it. */
const ACID_BAR = "r-ro-rr-r-or-rr-";
/** A sawtooth stab whose filter snaps shut. */
const STAB = ".lpf(1800).lpenv(2).lpd(.12).lps(0).decay(.22).sustain(.3)";
/** The stabs ducked on the beat (the pump of a sidechained record). */
const PUMP = '.postgain("[.6 1]*4")';
/** A supersaw pad struck on every beat with a slow attack, so it swells after each kick; its filter drifts. */
const PAD = ".attack(.12).decay(.4).sustain(.7).lpf(sine.range(900, 2200).slow(8)).postgain(.6)";
/** The square pluck of the electronic kit, its echo on a dotted eighth (0.45 s at 100 BPM). */
const PLUCK = ".decay(.25).sustain(.3).lpf(2400).delay(.3).delaytime(.45).delayfeedback(.35)";

// ---- The production moves every flavour makes (the unit's ideas, heard in Oak's parts) -----------------------

/** The old record: the band through a low-pass, its chords and tune crushed to six bits. */
const LOFI_DRUMS = ".lpf(2200)";
const LOFI_KEYS = ".lpf(1300).crush(6)";
/** The build-ups: the chords' and the pad's cutoff climbs over the four bars; the tune wobbles. */
const SWEEP = ".lpf(saw.range(400, 6000).slow(4))";
const PAD_SWEEP = ".attack(.6).release(.6).lpf(saw.range(500, 5000).slow(4))";
const VIB = ".vib(5).vibmod(.15)";
/** The bridge: a big room and echoes on a dotted eighth, on an orbit of its own. */
const SPACE_LEAD = ".delay(.4).delaytime(.45).delayfeedback(.45).room(.5).roomsize(6).orbit(3)";
const SPACE_PAD = ".attack(1).release(2).room(.6).roomsize(6).orbit(3)";
/** The second verse: everything plucked. */
const PLUCKED = ".decay(.25).sustain(0)";

// ---- The kits -----------------------------------------------------------------------------------------------

type Drums = Readonly<Partial<Record<SectionId, Bars>>>;
type Synth = Partial<Record<SectionId, string>>;
interface Kit {
  /** `.bank()` for every drum track, or a bank per section ("" for the default kit, `null` for no bank). */
  bank: string | Partial<Record<SectionId, string | null>>;
  sounds: { bass: string; chords: string; lead: string; pad: string };
  /** The chords' voicing: close triads (the choruses higher), or jazz-soul's added ninths. */
  voicing: "triad" | "add9";
  /** Levels per part, levelled by packages/strudel/e2e/songs.pw.ts against sound-songs.json. */
  gain: {
    kick: number;
    snare: number;
    hats: number;
    perc: number;
    bass: number;
    chords: number;
    pad: number;
    lead: number;
  };
  /** content/flavours.ts production: room, the bass low-pass. */
  room: number;
  lpf: number;
  /** The choruses' bass: opens bright on every note under a resonant filter (`""` where the style keeps it plain). */
  chorusBass: string;
  /** The choruses' chords: an envelope filter (jazz-soul's Rhodes wah), where the bass stays plain. */
  chorusKeys?: string;
  /** Controls after the pad's sound in every section it plays (a supersaw a little quieter). */
  padFx?: string;
  kick: Drums;
  snare: Drums;
  hats: Drums;
  perc: Drums;
  bass: Readonly<Partial<Record<SectionId, Bars>>>;
  comp: Readonly<Partial<Record<SectionId, Bars>>>;
  compVel: Vel;
  /** The pad's rhythm where it differs from one long chord a bar. */
  padBars?: Readonly<Partial<Record<SectionId, Bars>>>;
  /** Electronic: the sound and the controls of a part per section, in place of the moves every flavour makes. */
  synth?: { bass: Synth; chords: Synth; lead: Synth; pad: Synth };
}

/** Where the pad plays (a long chord a bar): the build-ups, the bridge and the last chorus. */
const PAD_SECTIONS: readonly SectionId[] = ["lift1", "bridge", "lift2", "chorus2"];

/** Pop: the default kit, electric bass, piano chords and tune, a supersaw pad: synth-pop, four on the floor in the choruses. */
const POP: Kit = {
  bank: "",
  sounds: { bass: "ebass", chords: "piano", lead: "piano", pad: "supersaw" },
  voicing: "triad",
  gain: { kick: 0.18, snare: 0.19, hats: 0.13, perc: 0.11, bass: 0.5, chords: 0.19, pad: 0.1, lead: 0.71 },
  room: 0.25,
  lpf: 800,
  chorusBass: BAND_ACID,
  padFx: ".postgain(.6)",
  kick: {
    intro: "X.......X.x.....",
    verse1: lastBar("X.....x.X.......", "X.....x.X...x.x."),
    lift1: KICK_LIFT,
    chorus1: K4,
    verse2: lastBar("X.x...x.X.x.....", "X.x...x.X.x.x.x."),
    lift2: KICK_LIFT,
    chorus2: K4,
    outro: lastBar("X.......X.x.....", "X.......X......."),
    end: "X...............",
  },
  snare: {
    intro: lastBar(SN_BACK, "....X.......X.xx"),
    verse1: lastBar(SN_BACK, "....X.......XxXX"),
    lift1: SNARE_LIFT,
    chorus1: lastBar("....C.......C...", "....C.......CxXX"),
    verse2: lastBar("....X..g....X...", "....X..g....XxXX"),
    lift2: SNARE_LIFT,
    chorus2: lastBar("....C.......C...", "....C.......CxXX"),
    outro: SN_BACK,
  },
  hats: {
    intro: "g.g.g.g.g.g.g.g.",
    verse1: lastBar(HH8, "X.x.X.x.X.x.X.O."),
    lift1: "..x...x...x...x.",
    chorus1: "x.O.x.O.x.O.x.O.",
    verse2: HH16,
    lift2: "..x...x...x...x.",
    chorus2: "x.O.x.O.x.O.x.O.",
    outro: "g.g.g.g.g.g.g.g.",
  },
  perc: {
    verse1: CRASH_ONCE,
    chorus1: CRASH,
    verse2: CRASH_ONCE,
    bridge: CRASH_ONCE,
    chorus2: onFirst("C...T.......T...", "....T.......T..."),
    end: "C...............",
  },
  bass: {
    intro: "r-------r-------",
    verse1: "r---..r-r---f-..",
    lift1: "r.r.r.r.r.r.r.r.",
    chorus1: "r.o.r.o.r.o.r.o.",
    verse2: "r.r...r.r.r...f.",
    bridge: "r---------------",
    lift2: "r.r.r.r.r.r.r.r.",
    chorus2: "r.o.r.o.r.o.r.o.",
    outro: "r-------r-------",
    end: "r---------------",
  },
  comp: {
    intro: "x-----x---x-----",
    verse1: "X---x---X---x---",
    lift1: "x.x.x.x.x.x.x.x.",
    chorus1: "..x-..x-..x-..x-",
    verse2: "x..x..x...x..x..",
    lift2: "x.x.x.x.x.x.x.x.",
    chorus2: "..x-..x-..x-..x-",
    outro: "x-----x---x-----",
    end: "x---------------",
  },
  compVel: { X: 0.95, x: 0.8, g: 0.5 },
};

/** Indie: the rock kit, clean-guitar strums, an acoustic-guitar tune, strings for the pad: indie-dance choruses. */
const INDIE: Kit = {
  bank: "rockkit",
  sounds: { bass: "ebass", chords: "cleangtr", lead: "acgtr", pad: "strings" },
  voicing: "triad",
  gain: { kick: 0.3, snare: 0.3, hats: 0.19, perc: 0.18, bass: 0.38, chords: 0.26, pad: 0.28, lead: 1 },
  room: 0.3,
  lpf: 750,
  chorusBass: BAND_ACID,
  kick: {
    intro: "X.......X.......",
    verse1: lastBar("X.......X.X.....", "X.......X.X.x.x."),
    lift1: KICK_LIFT,
    chorus1: K4,
    verse2: lastBar("X..x..x.X.......", "X..x..x.X...x.x."),
    lift2: KICK_LIFT,
    chorus2: K4,
    outro: lastBar("X.......X.......", "X..............."),
    end: "X...............",
  },
  snare: {
    intro: lastBar(SN_BACK, "....X.......X.xx"),
    verse1: lastBar(SN_BACK, "....X.......XxXX"),
    lift1: SNARE_LIFT,
    chorus1: lastBar(SN_BACK, "....X.......XxXX"),
    verse2: lastBar(SN_BACK, "....X.......XxXX"),
    lift2: SNARE_LIFT,
    chorus2: lastBar(SN_BACK, "....X.......XxXX"),
    outro: SN_BACK,
  },
  hats: {
    intro: "g.g.g.g.g.g.g.g.",
    verse1: lastBar(HH8, "X.x.X.x.X.x.X.O."),
    lift1: HH8,
    chorus1: "x.O.x.O.x.O.x.O.",
    verse2: "X.x.X.x.X.x.X.O.",
    lift2: HH8,
    chorus2: "x.O.x.O.x.O.x.O.",
    outro: "g.g.g.g.g.g.g.g.",
  },
  perc: {
    verse1: CRASH_ONCE,
    chorus1: onFirst("C.t.T.t.T.t.T.t.", "T.t.T.t.T.t.T.t."),
    verse2: CRASH_ONCE,
    bridge: CRASH_ONCE,
    chorus2: onFirst("C.t.T.t.T.t.T.t.", "T.t.T.t.T.t.T.t."),
    end: "C...............",
  },
  bass: {
    intro: "r-------r-------",
    verse1: "r.r.r.r.r.r.f.f.",
    lift1: "r.r.r.r.r.r.r.r.",
    chorus1: "r.r.r.o.r.r.r.o.",
    verse2: "r..r..r.r.......",
    bridge: "r---------------",
    lift2: "r.r.r.r.r.r.r.r.",
    chorus2: "r.r.r.o.r.r.r.o.",
    outro: "r-------r-------",
    end: "r---------------",
  },
  comp: {
    intro: "x-------x-------",
    verse1: "X.x.X.x.X.x.X.x.",
    lift1: "x.x.x.x.x.x.x.x.",
    chorus1: "X.xxX.xxX.xxX.xx",
    verse2: "x..x..x.x..x..x.",
    lift2: "x.x.x.x.x.x.x.x.",
    chorus2: "X.xxX.xxX.xxX.xx",
    outro: "x-------x-------",
    end: "x---------------",
  },
  compVel: { X: 0.9, x: 0.7, g: 0.5 },
};

/**
 * Jazz-soul: Oak's jazz kit, Rhodes in added ninths, upright bass, vibes, an organ pad. Straight. Cross-stick on 2 and 4
 * and the ride in the verses, the snare in the choruses; the bass in two, then in four in the choruses.
 */
const JAZZ: Kit = {
  bank: "jazzkit",
  sounds: { bass: "upright", chords: "rhodes", lead: "vibes", pad: "organ" },
  voicing: "add9",
  gain: { kick: 0.23, snare: 0.43, hats: 0.27, perc: 0.27, bass: 0.79, chords: 0.42, pad: 0.22, lead: 0.47 },
  room: 0.35,
  lpf: 900,
  chorusBass: "",
  // The upright walks plain; the Rhodes wahs through an envelope filter (soul jazz's auto-wah) on every stab.
  chorusKeys: ".lpf(700).lpq(6).lpenv(3).lpd(.25).lps(0)",
  kick: {
    intro: "X.......X.......",
    verse1: lastBar("X.......X.....x.", "X.......X...x.x."),
    lift1: KICK_LIFT,
    chorus1: "X.....x.X.....x.",
    verse2: lastBar("X..x....X..x....", "X..x....X..x.x.x"),
    lift2: KICK_LIFT,
    chorus2: "X.....x.X.....x.",
    outro: lastBar("X.......X.......", "X..............."),
    end: "X...............",
  },
  snare: {
    intro: "....R.......R...",
    verse1: lastBar("....R.......R...", "....R.......RxXX"),
    lift1: SNARE_LIFT,
    chorus1: lastBar("....X..g....X...", "....X..g....XxXX"),
    verse2: lastBar("....X.......X..g", "....X.......XxXX"),
    lift2: SNARE_LIFT,
    chorus2: lastBar("....X..g....X...", "....X..g....XxXX"),
    outro: "....R.......R...",
  },
  // The hi-hat foot on 2 and 4 under the ride; eighths in the choruses.
  hats: {
    intro: "....g.......g...",
    verse1: "....X.......X...",
    lift1: HH8,
    chorus1: HH8,
    verse2: "....X.......X...",
    lift2: HH8,
    chorus2: HH8,
    outro: "....g.......g...",
  },
  perc: {
    verse1: onFirst("Z.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    chorus1: onFirst("Z.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    verse2: onFirst("Z.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    bridge: CRASH_ONCE,
    chorus2: onFirst("Z.rrR.rrR.rrR.rr", "R.rrR.rrR.rrR.rr"),
    end: "C...............",
  },
  bass: {
    intro: "r-------f-------",
    verse1: "r-------f-------",
    lift1: "r---r---r---r---",
    chorus1: "r---f---o---f---",
    verse2: "r-..r-..f-..r-..",
    bridge: "r---------------",
    lift2: "r---r---r---r---",
    chorus2: "r---f---o---f---",
    outro: "r-------f-------",
    end: "r---------------",
  },
  comp: {
    intro: "x-------x-------",
    verse1: "x-----x---x-----",
    lift1: "x.x.x.x.x.x.x.x.",
    chorus1: "..x-..x-..x-..x-",
    verse2: "x..x....x..x....",
    lift2: "x.x.x.x.x.x.x.x.",
    chorus2: "..x-..x-..x-..x-",
    outro: "x-------x-------",
    end: "x---------------",
  },
  compVel: { X: 0.9, x: 0.8, g: 0.5 },
};

/** Funk: Oak's 808, clavinet, finger bass, organ tune, strings for the pad; sixteenths, straight. */
const FUNK: Kit = {
  bank: "oak808",
  sounds: { bass: "fingerbass", chords: "clav", lead: "organ", pad: "strings" },
  voicing: "triad",
  gain: { kick: 0.36, snare: 0.31, hats: 0.18, perc: 0.15, bass: 0.68, chords: 0.6, pad: 0.22, lead: 0.57 },
  room: 0.2,
  lpf: 850,
  // The envelope filter of a funk bass, on the ladder: a resonant low-pass that opens wide on every note.
  chorusBass: '.lpq(12).ftype("ladder").lpenv("<4 2 3 5>*8").lpd(.12).lps(0)',
  kick: {
    intro: "X......xX.x.....",
    verse1: lastBar("X..x..x.X.....x.", "X..x..x.X...x.x."),
    lift1: KICK_LIFT,
    chorus1: "X..x..x.X..x..x.",
    verse2: lastBar("X..x....X.x.....", "X..x....X.x.x.x."),
    lift2: KICK_LIFT,
    chorus2: "X..x..x.X..x..x.",
    outro: lastBar("X......xX.x.....", "X..............."),
    end: "X...............",
  },
  snare: {
    intro: lastBar(SN_BACK, "....X.......X.xx"),
    verse1: lastBar("....X..g....X..g", "....X..g.g..XxXX"),
    lift1: SNARE_LIFT,
    chorus1: lastBar("....X..g.g..X..g", "....X..g.g..XxXX"),
    verse2: lastBar("....X..g....X..g", "....X..g.g..XxXX"),
    lift2: SNARE_LIFT,
    chorus2: lastBar("....C..g.g..C..g", "....C..g.g..CxXX"),
    outro: SN_BACK,
  },
  hats: {
    intro: "g.g.g.g.g.g.g.g.",
    verse1: "XgxgXgxgXgxgXgOg",
    lift1: "..x...x...x...x.",
    chorus1: "XgxgXgxOXgxgXgxg",
    verse2: HH16,
    lift2: "..x...x...x...x.",
    chorus2: "XgxgXgxOXgxgXgxO",
    outro: "g.g.g.g.g.g.g.g.",
  },
  perc: {
    verse1: CRASH_ONCE,
    chorus1: onFirst("C.K...K...K...K.", "..K...K...K...K."),
    verse2: CRASH_ONCE,
    bridge: CRASH_ONCE,
    chorus2: onFirst("C.K.s.K.s.K.s.K.", "s.K.s.K.s.K.s.K."),
    end: "C...............",
  },
  bass: {
    intro: "r-......r-......",
    verse1: "r-.r..r.o-....f.",
    lift1: "r.r.r.r.r.r.r.r.",
    chorus1: "r-.r..r.o-.r..r.",
    verse2: "r..r....r.f.....",
    bridge: "r---------------",
    lift2: "r.r.r.r.r.r.r.r.",
    chorus2: "r-.r..r.o-.r..r.",
    outro: "r-......r-......",
    end: "r---------------",
  },
  comp: {
    intro: "x.....x...x.....",
    verse1: "..x..x.x..x..x.x",
    lift1: "xxxxxxxxxxxxxxxx",
    chorus1: "X.x..x.xX.x..x.x",
    verse2: "..x...x...x...x.",
    lift2: "xxxxxxxxxxxxxxxx",
    chorus2: "X.x..x.xX.x..x.x",
    outro: "x.....x...x.....",
    end: "x---------------",
  },
  compVel: { X: 0.95, x: 0.75, g: 0.5 },
};

/**
 * Electronic: the acid track. The lo-fi kit in the opening and the ending (under a sine sub and crushed stabs); Oak's
 * 909 everywhere else, four on the floor with claps; a kick made by a synth (`sbd`) in the plucked second verse. The
 * bass grows from a sine sub to a wavetable bass (the verse) to the TB-303 acid line, its filter envelope opening wider
 * over each build-up and wide open in the choruses. Sawtooth stabs on the off-beats, then on every eighth ducked on the
 * beat (the pump); a supersaw pad. The tune: a wavetable e-piano in the verse, a morphing wavetable in the build-ups,
 * the kit's square pluck in the first chorus, a triangle into the bridge's echoes, and in the last chorus a bell made
 * with FM. Straight, triads.
 */
const ELECTRONIC: Kit = {
  bank: {
    intro: "lofikit",
    verse1: "oak909",
    lift1: "oak909",
    chorus1: "oak909",
    verse2: "oak909",
    bridge: "oak909",
    lift2: "oak909",
    chorus2: "oak909",
    outro: "lofikit",
    end: "oak909",
  },
  sounds: { bass: "sine", chords: "sawtooth", lead: "square", pad: "supersaw" },
  voicing: "triad",
  gain: { kick: 0.27, snare: 0.18, hats: 0.12, perc: 0.11, bass: 0.38, chords: 0.2, pad: 0.13, lead: 0.49 },
  room: 0.2,
  lpf: 700,
  chorusBass: "",
  kick: {
    intro: "X......xX.x.....",
    verse1: lastBar(K4, "X...X...X...X.x."),
    lift1: KICK_LIFT,
    chorus1: K4,
    verse2: lastBar("S...S...S...S...", "S...S...S.s.S.s."),
    lift2: KICK_LIFT,
    chorus2: K4,
    outro: lastBar("X......xX.x.....", "X..............."),
    end: "X...............",
  },
  snare: {
    intro: lastBar(SN_BACK, "....X.......X.xx"),
    verse1: lastBar("....c.......c...", "....c.......c.cc"),
    lift1: CLAP_LIFT,
    chorus1: lastBar("....C.......C...", "....C.......C.CC"),
    verse2: lastBar("....c.......c...", "....c.......c.cc"),
    lift2: CLAP_LIFT,
    chorus2: lastBar("....C.......C...", "....C.......C.CC"),
    outro: SN_BACK,
  },
  hats: {
    intro: "g.g.g.g.g.g.g.g.",
    verse1: lastBar("..x...x...x...x.", "..x...x...x...O."),
    lift1: HH16,
    chorus1: "xgOgxgOgxgOgxgOg",
    verse2: "x.x.x.x.x.x.x.x.",
    lift2: HH16,
    chorus2: "xgOgxgOgxgOgxgOg",
    outro: "g.g.g.g.g.g.g.g.",
  },
  perc: {
    verse1: CRASH_ONCE,
    chorus1: CRASH,
    verse2: CRASH_ONCE,
    bridge: CRASH_ONCE,
    chorus2: onFirst("C.r.R.r.R.r.R.r.", "R.r.R.r.R.r.R.r."),
    end: "C...............",
  },
  bass: {
    intro: "r-------r-------",
    verse1: "r---..r-r---..r-",
    lift1: ACID_BAR,
    chorus1: ACID_BAR,
    verse2: "r.ro.rr.r.or.rr.",
    bridge: "r---------------",
    lift2: ACID_BAR,
    chorus2: ACID_BAR,
    outro: "r-------r-------",
    end: "r---------------",
  },
  comp: {
    intro: "..x...x...x...x.",
    verse1: "..x...x...x...x.",
    lift1: "x.x.x.x.x.x.x.x.",
    chorus1: "x.x.x.x.x.x.x.x.",
    verse2: "..x..x....x..x..",
    lift2: "x.x.x.x.x.x.x.x.",
    chorus2: "x.x.x.x.x.x.x.x.",
    outro: "..x...x...x...x.",
    end: "x---------------",
  },
  compVel: { X: 1, x: 0.85, g: 0.5 },
  // The last chorus's pad is struck on every beat, so it swells after each kick.
  padBars: { chorus2: "x---x---x---x---" },
  synth: {
    bass: {
      intro: `.s("sine")${SUB}`,
      verse1: '.s("wt_bass").lpf(900).decay(.3).sustain(.5)',
      lift1: `.s("sawtooth")${ACID_RISING}`,
      chorus1: `.s("sawtooth")${ACID_OPEN}`,
      verse2: `.s("sawtooth")${ACID}`,
      bridge: `.s("sine")${SUB}`,
      lift2: `.s("sawtooth")${ACID_RISING}`,
      chorus2: `.s("sawtooth")${ACID_OPEN}`,
      outro: `.s("sine")${SUB}`,
      end: `.s("sine")${SUB}`,
    },
    chords: {
      intro: `.s("sawtooth")${STAB}${LOFI_KEYS}`,
      verse1: `.s("sawtooth")${STAB}`,
      lift1: `.s("sawtooth")${STAB}${SWEEP}`,
      chorus1: `.s("sawtooth")${STAB}${PUMP}`,
      verse2: `.s("sawtooth")${STAB}`,
      lift2: `.s("sawtooth")${STAB}${SWEEP}`,
      chorus2: `.s("sawtooth")${STAB}${PUMP}`,
      outro: `.s("sawtooth")${STAB}${LOFI_KEYS}`,
      end: '.s("sawtooth").lpf(1800).decay(1.5).sustain(0)',
    },
    lead: {
      verse1: '.s("wt_epiano").decay(.3).sustain(.2).delay(.3).delaytime(.45).delayfeedback(.35)',
      lift1: `.s("wt_morph").wtrate(.5).wtdepth(1).lpf(3000)${VIB}`,
      chorus1: `.s("square")${PLUCK}`,
      verse2: '.s("square").decay(.12).sustain(0).lpf(2400)',
      bridge: `.s("triangle")${SPACE_LEAD}`,
      lift2: `.s("wt_morph").wtrate(.5).wtdepth(1).lpf(3000)${VIB}`,
      chorus2: '.s("sine").fm(3).fmh(3.5).decay(.5).sustain(.1).delay(.3).delaytime(.45).delayfeedback(.35)',
      outro: `.s("square").decay(.25).sustain(.3)${LOFI_KEYS}`,
      end: '.s("square").lpf(2400)',
    },
    pad: {
      lift1: `.s("supersaw")${PAD_SWEEP}.postgain(.6)`,
      bridge: `.s("supersaw").lpf(1800)${SPACE_PAD}.postgain(.6)`,
      lift2: `.s("supersaw")${PAD_SWEEP}.postgain(.6)`,
      chorus2: `.s("supersaw")${PAD}`,
    },
  },
};

const KITS: Readonly<Record<FlavourId, Kit>> = {
  "flavour.pop": POP,
  "flavour.indie": INDIE,
  "flavour.jazz-soul": JAZZ,
  "flavour.funk": FUNK,
  "flavour.electronic": ELECTRONIC,
};

const LOFI = new Set<SectionId>(["intro", "outro"]);
const LIFT = new Set<SectionId>(["lift1", "lift2"]);
const CHORUS = new Set<SectionId>(["chorus1", "chorus2"]);
/** The choruses' chords sit higher (G3 C4 E4, A3 C4 F4), still under the tune an octave up. */
const CHORD_HIGH = CHORUS;

/**
 * The build-ups end on a gap: in their last bar the bass and the chords stop after beat 3, with the kick and the
 * snare roll, and only the pad, the riser and the tune's last note (F5, a step under the chorus's first G5) cross beat 4
 * into the chorus.
 */
const dropGap =
  (b: Bars): Bars =>
  (i, n) => {
    const bar = barOf(b, i, n);
    return i === n - 1 ? `${bar.slice(0, 12)}....` : bar;
  };

/** The moves every flavour makes, per part and section (a kit with `synth` writes its own). */
function moves(k: Kit, part: "bass" | "chords" | "lead" | "pad", id: SectionId): string {
  const room = `.room(${num(k.room)})`;
  switch (part) {
    case "bass":
      if (LOFI.has(id)) return ".lpf(400)";
      if (id === "bridge") return ".lpf(300)";
      if (CHORUS.has(id)) return `.lpf(${k.chorusBass ? Math.round(k.lpf * 0.6) : k.lpf})${k.chorusBass}`;
      if (id === "verse2") return `.lpf(${k.lpf})${PLUCKED}`;
      return `.lpf(${k.lpf})`;
    case "chords":
      if (LOFI.has(id)) return `${LOFI_KEYS}${room}`;
      if (LIFT.has(id)) return `${SWEEP}${room}`;
      if (id === "verse2") return `${PLUCKED}${room}`;
      if (CHORUS.has(id)) return `${k.chorusKeys ?? ""}${room}`;
      return room;
    case "lead":
      if (LOFI.has(id)) return `${LOFI_KEYS}${room}`;
      if (LIFT.has(id)) return `${VIB}${room}`;
      if (id === "bridge") return SPACE_LEAD;
      return room;
    case "pad":
      if (LIFT.has(id)) return `${PAD_SWEEP}${k.padFx ?? ""}${room}`;
      if (id === "bridge") return `.lpf(2000)${k.padFx ?? ""}${SPACE_PAD}`;
      return `.attack(.2).release(.8).lpf(3000)${k.padFx ?? ""}${room}`;
  }
}

/** One flavour's song: the tune, the pad, the chords, the bass, then the drums, each one arranged track. */
function code(flavour: FlavourId): string {
  const k = KITS[flavour];
  /** A pitched part's sound and controls in a section: the kit's synth recipe, or its sound and the moves. */
  const voice = (part: "bass" | "chords" | "lead" | "pad", id: SectionId): string => {
    const syn = k.synth?.[part][id];
    if (syn !== undefined) {
      const roomed = /\.room\(/.test(syn) || part === "bass" ? syn : `${syn}.room(${num(k.room)})`;
      return roomed;
    }
    return `.s("${k.sounds[part]}")${moves(k, part, id)}`;
  };
  const voicing = (id: SectionId) => (c: Chord) =>
    k.voicing === "add9" ? c.add9 : CHORD_HIGH.has(id) ? c.high : c.triad;
  const chords = mapSections((id) => {
    const b = k.comp[id];
    if (b === undefined) return null;
    const bars = LIFT.has(id) ? dropGap(b) : b;
    return `${pitched(id, chordEvents(id, bars, voicing(id), k.compVel))}${voice("chords", id)}`;
  });
  const pad = mapSections((id) => {
    if (!PAD_SECTIONS.includes(id)) return null;
    const b = k.padBars?.[id] ?? "x---------------";
    return `${pitched(
      id,
      chordEvents(id, b, (c) => c.pad, { x: 0.8 }),
      false,
    )}${voice("pad", id)}`;
  });
  const bass = mapSections((id) => {
    const b = k.bass[id];
    if (b === undefined) return null;
    return `${pitched(id, bassEvents(id, LIFT.has(id) ? dropGap(b) : b))}${voice("bass", id)}`;
  });
  const mel = mapSections((id) => {
    const p = MEL[id];
    return p === null ? null : `${p}${voice("lead", id)}`;
  });
  const bankOf = (id: SectionId): string => {
    const b = typeof k.bank === "string" ? k.bank : k.bank[id];
    return b ? `.bank("${b}")` : "";
  };
  const drums = (by: Drums, map: DrumMap, fx: (id: SectionId) => string = () => ""): BySection =>
    mapSections((id) => {
      const b = by[id];
      return b === undefined ? null : `${drumSection(id, b, map)}${bankOf(id)}${fx(id)}`;
    });
  /** The kick: an 808 gets its decay (KICK_808); a synth kick (`sbd`) takes no bank. */
  const kick = mapSections((id) => {
    const b = k.kick[id];
    if (b === undefined) return null;
    const pattern = drumSection(id, b, KICK);
    if (pattern.includes("sbd")) return pattern;
    const bank = bankOf(id);
    return `${pattern}${bank}${/oak808/.test(bank) ? KICK_808 : ""}`;
  });
  const lofi = (id: SectionId) => (LOFI.has(id) && !k.synth ? LOFI_DRUMS : "");
  const perc = mapSections((id) => {
    if (LIFT.has(id)) return RISER;
    if (LOFI.has(id)) return CRACKLE;
    const b = k.perc[id];
    return b === undefined ? null : `${drumSection(id, b, PERC)}${bankOf(id)}`;
  });
  const tracks = [
    track("mel", mel, `.gain(${num(k.gain.lead)}).pan(.6)`),
    track("pad", pad, `.gain(${num(k.gain.pad)}).pan(.5)`),
    track("chords", chords, `.gain(${num(k.gain.chords)}).pan(.4)`),
    track("bass", bass, `.gain(${num(k.gain.bass)})`),
    track("kick", kick, `.gain(${num(k.gain.kick)})`),
    track("snare", drums(k.snare, SNARE, lofi), `.gain(${num(k.gain.snare)})`),
    track("hats", drums(k.hats, HATS, lofi), `.gain(${num(k.gain.hats)})`),
    track("perc", perc, `.gain(${num(k.gain.perc)})`),
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

/** Every A1 Make is the A1 loop: kick, snare and hats lines, a bass and a riff (from A1.L06, a pad too). */
const LOOP: SongPartId[] = ["kick", "snare", "hats", "bass", "lead"];

export const A1_SONG = defineUnitSong({
  id: "usong.A1",
  unit: "A1",
  version: 1,
  title: "Turn the dial",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: [...SECTIONS],
  parts: [
    { id: "lead", label: "mel", role: "melody", name: "Riff", plainName: "Riff" },
    { id: "pad", label: "pad", role: "pad", name: "Pad", plainName: "Pad" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
    { id: "kick", label: "kick", role: "drums", sounds: ["bd", "sbd"], name: "Kick", plainName: "Kick" },
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
      sounds: [
        "cr",
        "rd",
        "lt",
        "mt",
        "ht",
        "sh",
        "cb",
        "tb",
        "white",
        "pink",
        "brown",
        "crackle",
        "vinyl",
        "tape",
      ],
      name: "Cymbals, percussion and noise",
      plainName: "Cymbals, percussion and noise",
    },
  ],
  code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, code(f)])) as Record<FlavourId, string>,
  // By section (AUTHORING §23.6): every A1 Make is the whole A1 loop (drums, bass, riff), so each take hands over
  // whole sections, the one whose sound is the lesson's idea. Oak's chords, pad and percussion keep playing under
  // A1.L01–L05 (their loops play no chords); A1.L06 and A1.L07 add a pad of chords, and Oak keeps its chords there
  // (clash-checked). Every A1 Make opens with its authored starter: A1.L01–L04 are optional side lessons a learner
  // may skip (the app opens A1.L05 without them), so none may open a later Make (AUTHORING §23.9 rule 2), even
  // though each starter is "the loop as the lesson before leaves it"; A1.L06 and A1.L07's starters bring a pad and
  // new lines (a long-note lead, a bell riff) the earlier loops do not have.
  plan: [
    take(
      "A1.L01",
      ["verse1"],
      LOOP,
      "oak",
      "Your loop, its bass and riff on waves you choose, plays the first part after the opening.",
    ),
    take(
      "A1.L02",
      ["chorus1"],
      LOOP,
      "oak",
      "Your loop, one part opening bright on every note, drives the first loud part of the song.",
    ),
    take(
      "A1.L03",
      ["verse2"],
      LOOP,
      "oak",
      "Your loop, its notes shaped to punch or to swell, plays the part right after the first loud one.",
    ),
    take(
      "A1.L04",
      ["bridge"],
      LOOP,
      "oak",
      "Your loop, placed in a room and given echoes, fills the quiet part where Oak's drums stop.",
    ),
    take(
      "A1.L05",
      ["intro", "outro"],
      LOOP,
      "oak",
      "Your loop, made gritty like an old record, opens and closes the song.",
    ),
    take(
      "A1.L06",
      ["lift1", "lift2"],
      [...LOOP, "pad"],
      "oak",
      "Your pad and long-note lead, moving while they hold, play both build-ups into the choruses.",
      ["chords"],
    ),
    take(
      "A1.L07",
      ["chorus2"],
      [...LOOP, "pad"],
      "oak",
      "Your riff, rung like a bell over a pad, plays the last chorus, the loudest part of the song.",
      ["chords"],
    ),
  ],
  // A1 has no checkpoint of its own (A.CP covers A1 and A2), so the song is released after its last lesson, as U08,
  // U12 and U15 are.
  releaseAfter: "A1.L07",
});

export default A1_SONG;
