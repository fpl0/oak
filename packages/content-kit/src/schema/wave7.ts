// Wave 7: the advanced tracks (contracts §2.6, §4.3; contracts 1.8 §5.6). Jazz harmony (J1–J5), advanced rhythm
// (R1–R3) and arrangement & sound (A1.L05–L07, A2). What this module holds:
//
// - the canonical timing fixtures the pre-flight asked for (swing amount → ratio, the two-bar clave grids and
//   how a direction is read, the polymeter period, tempo-aware microtiming, the odd-meter groupings), so every
//   lesson, generator and rule computes them one way;
// - the canonical voicing shapes (shell, close, drop-2, rootless A and B), octave-aware, as code;
// - the tension and avoid-note table `allowed-tensions` reads against the melody;
// - the standard answer options of the tracks;
// - the custom rubric rules the tracks plan with (`PLANNED.customRules`), each with its parameters, which
//   `trackCustomParamIssues` checks so a spec or a lesson cannot misspell one before the grader lands it.
//
// Nothing here grades: @oak/grader implements every planned rule against these definitions in the Build phase
// and moves it into `IMPLEMENTED` with its golden tests (contracts §5.1).

import type { ChordQuality, MeterId, Rat, TrackRef } from "./common.ts";
import type { Choice } from "./exercise.ts";
import type { DeviceName } from "./rubric.ts";

// --- swing ---------------------------------------------------------------------------------------

/**
 * The long:short ratio a `swingBy(amount, n)` amount gives (contracts §6.10 item 1: the off-beat sits at
 * `(1 + amount) / 2` of its slot): `.1` → 1.22, `.2` → 1.5, `1/3` → 2 (triplet swing), `.5` → 3. Taught
 * amounts stay in 0–0.5 (STYLE §7); 0.5 is "hard" swing.
 */
export function swingRatio(amount: number): number {
  if (!(amount >= 0 && amount < 1)) throw new RangeError(`a swing amount is in [0, 1): ${amount}`);
  return (1 + amount) / (1 - amount);
}
/** The amount that gives a long:short ratio (the inverse of `swingRatio`). */
export function swingAmount(ratio: number): number {
  if (!(ratio >= 1)) throw new RangeError(`a swing ratio is at least 1: ${ratio}`);
  return (ratio - 1) / (ratio + 1);
}
/**
 * Named swing feels, as R1.L02 and `fam.rhy.swing` level 4 name them. `ratio` is long:short; `amount` the
 * `swingBy` amount that gives it.
 */
export const SWING_FEELS = [
  { id: "straight", label: "Straight (1:1)", ratio: 1, amount: 0 },
  { id: "light", label: "Light swing (3:2)", ratio: 1.5, amount: 0.2 },
  { id: "triplet", label: "Triplet swing (2:1)", ratio: 2, amount: 1 / 3 },
  { id: "hard", label: "Hard swing (3:1)", ratio: 3, amount: 0.5 },
] as const;
export type SwingFeelId = (typeof SWING_FEELS)[number]["id"];
/** "How hard does it swing" (R1.L02; `fam.rhy.swing` level 4): an `identify` with these options. */
export const SWING_RATIO_OPTIONS: readonly Choice[] = SWING_FEELS.map((f) => ({ id: f.id, label: f.label }));

// --- microtiming ----------------------------------------------------------------------------------

/**
 * Tempo-aware microtiming (R1.L05's comparison step, AC2.S2). `.late(x)` moves events by `x` CYCLES (bars), so
 * the same `x` is a different number of milliseconds at another tempo: `1/32` is 78 ms at 96 BPM in 4/4, a
 * displacement you hear as a rhythm, not a feel. A laid-back feel is 10–40 ms. `lateCycles(20, 90)` is the
 * `.late()` argument that delays by 20 ms at 90 BPM in 4/4 (0.0075). `unitsPerBar` is the meter's
 * (contracts §6.9; 4 in 4/4).
 */
export function lateCycles(ms: number, bpm: number, unitsPerBar = 4): number {
  return (ms / 1000) * (bpm / (60 * unitsPerBar));
}
/** The milliseconds a `.late(cycles)` delays by at `bpm` (the inverse of `lateCycles`). */
export function lateMs(cycles: number, bpm: number, unitsPerBar = 4): number {
  return (cycles * 60 * unitsPerBar * 1000) / bpm;
}
/** The window a laid-back (or pushed) feel is judged in, in milliseconds; above it the shift is a rhythm. */
export const FEEL_MS: readonly [min: number, max: number] = [8, 45];
/** "Ahead, on or behind the beat" (R1.L05's comparison step; AC2.S2). */
export const MICROTIMING_OPTIONS: readonly Choice[] = [
  { id: "ahead", label: "Ahead: it pushes, a hair early" },
  { id: "on", label: "On the beat" },
  { id: "behind", label: "Behind: it leans back, a hair late" },
];

// --- clave ----------------------------------------------------------------------------------------

export type ClaveType = "son" | "rumba";
export type ClaveDirection = "3-2" | "2-3";
/**
 * The two-bar clave grids on the 8th grid, 1 cycle = 1 bar (contracts §6.6 RC2): the onsets of the first and
 * the second bar, as fractions of a bar. Son 3-2: bar A {0, 3/8, 6/8}, bar B {2/8, 4/8}; rumba 3-2 moves the
 * three-side's last hit to 7/8; 2-3 swaps the two bars.
 */
export const CLAVE_GRIDS: Readonly<
  Record<ClaveType, Readonly<Record<ClaveDirection, readonly [Rat[], Rat[]]>>>
> = {
  son: {
    "3-2": [
      [
        [0, 1],
        [3, 8],
        [3, 4],
      ],
      [
        [1, 4],
        [1, 2],
      ],
    ],
    "2-3": [
      [
        [1, 4],
        [1, 2],
      ],
      [
        [0, 1],
        [3, 8],
        [3, 4],
      ],
    ],
  },
  rumba: {
    "3-2": [
      [
        [0, 1],
        [3, 8],
        [7, 8],
      ],
      [
        [1, 4],
        [1, 2],
      ],
    ],
    "2-3": [
      [
        [1, 4],
        [1, 2],
      ],
      [
        [0, 1],
        [3, 8],
        [7, 8],
      ],
    ],
  },
};
/** The clave as mini-notation on the 8th grid, one bar per `< >` step: what lessons and generators write. */
export function claveMini(type: ClaveType, direction: ClaveDirection, hit = "rim"): string {
  const bar = (onsets: readonly Rat[]) =>
    Array.from({ length: 8 }, (_, i) => (onsets.some(([n, d]) => (n * 8) / d === i) ? hit : "~")).join(" ");
  const [a, b] = CLAVE_GRIDS[type][direction];
  return `<[${bar(a)}] [${bar(b)}]>`;
}
/**
 * How a clave's direction is read (the `clave` rule and `fam.rhy.clave` level 2): from the first two-bar window
 * that starts at bar 1 (cycle 0). The bar with three hits is the three-side; three first is 3-2. A clave line
 * of a piece in 2-3 therefore starts with its two-side in bar 1, as Strudel plays `"<[2-side] [3-side]>"`.
 */
export function claveDirectionOf(bar1Onsets: number, bar2Onsets: number): ClaveDirection | null {
  if (bar1Onsets === 3 && bar2Onsets === 2) return "3-2";
  if (bar1Onsets === 2 && bar2Onsets === 3) return "2-3";
  return null;
}
/** "Which clave" (R3.L02; `fam.rhy.clave` level 2). Offer rumba from R3.L02, like the son. */
export const CLAVE_OPTIONS: readonly Choice[] = [
  { id: "son 3-2", label: "Son clave, 3-2" },
  { id: "son 2-3", label: "Son clave, 2-3" },
  { id: "rumba 3-2", label: "Rumba clave, 3-2" },
  { id: "rumba 2-3", label: "Rumba clave, 2-3" },
];

// --- polymeter, odd meters ------------------------------------------------------------------------

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/**
 * The bars after which a polymeter realigns with the bar (R2.L05): `{a b c}%4` (3 steps at 4 a bar) lines up
 * again after `lcm(3, 4) / 4` = 3 bars. `steps` is the cycle's length in steps, `perBar` the `%n`.
 */
export function polymeterPeriodBars(steps: number, perBar: number): number {
  if (!(Number.isInteger(steps) && Number.isInteger(perBar) && steps > 0 && perBar > 0))
    throw new RangeError("steps and perBar are positive integers");
  return steps / gcd(steps, perBar);
}
/**
 * The groupings each odd meter may declare (contracts §6.9), in eighths for /8 meters and quarters for 5/4.
 * `9/8i` is the irregular 9/8 (2+2+2+3 and its rotations), never compound 9/8 (3+3+3).
 */
export const METER_GROUPINGS: Readonly<Partial<Record<MeterId, readonly (readonly number[])[]>>> = {
  "5/4": [
    [3, 2],
    [2, 3],
  ],
  "5/8": [
    [2, 3],
    [3, 2],
  ],
  "7/8": [
    [2, 2, 3],
    [2, 3, 2],
    [3, 2, 2],
  ],
  "9/8i": [
    [2, 2, 2, 3],
    [2, 2, 3, 2],
    [2, 3, 2, 2],
    [3, 2, 2, 2],
  ],
};
/** The group starts of a grouping, as fractions of the bar: 2+2+3 in 7/8 → 0, 2/7, 4/7. */
export function groupStarts(grouping: readonly number[]): Rat[] {
  const total = grouping.reduce((a, b) => a + b, 0);
  const out: Rat[] = [];
  let at = 0;
  for (const g of grouping) {
    const k = gcd(at, total);
    out.push(at === 0 ? [0, 1] : [at / k, total / k]);
    at += g;
  }
  return out;
}

// --- voicings ---------------------------------------------------------------------------------------

/**
 * The voicing shapes the jazz track names (J1.L05 shells, J3.L01 rootless A and B, J3.L02 drop-2), defined on
 * the written notes, octave-aware. Strudel has no dictionary for any of them (no `rootless`, no `drop2`): a step
 * that asks for a shape is hand-voiced (`note("[d3,f3,c4]")`) and graded by the shape, never by a `voicing()`
 * dictionary, whose `lefthand` recipes are mostly rootless but not uniformly (`Cm7b5` keeps its root, `7#9` has
 * three notes).
 * - `shell`: three notes, the root lowest, then the 3rd and the 7th (or the 6th of a sixth chord) in either
 *   order above it (root–3–7 or root–7–3); one of them doubled in another octave (the root in octaves) is the
 *   same shell, up to five notes.
 * - `close`: four notes within one octave (the highest less than 12 half steps above the lowest).
 * - `drop-2`: four notes, not close, which become a close voicing when the second-highest goes up an octave
 *   (`G3 C4 E4 B4` from `C4 E4 G4 B4`).
 * - `rootless-a`: four notes, no root, the 3rd lowest (3–5–7–9; on a dominant 3–13–♭7–9).
 * - `rootless-b`: four notes, no root, the 7th lowest (7–9–3–5; on a dominant ♭7–9–3–13).
 */
export const VOICING_SHAPES = ["shell", "close", "drop-2", "rootless-a", "rootless-b"] as const;
export type VoicingShape = (typeof VOICING_SHAPES)[number];

/** A chord as its root pitch class and the pitch classes of its 3rd, 5th, 7th (or 6th) and 9th. */
export interface VoicedChord {
  root: number;
  third: number;
  fifth: number;
  seventh: number;
  ninth?: number;
  thirteenth?: number;
}
const pc = (m: number) => ((m % 12) + 12) % 12;
const sorted = (midis: readonly number[]) => [...midis].sort((a, b) => a - b);

/** Whether `midis` (any order) is in close position: four notes inside one octave. */
export function isClose(midis: readonly number[]): boolean {
  const s = sorted(midis);
  return s.length === 4 && (s[3] as number) - (s[0] as number) < 12 && new Set(s.map(pc)).size === 4;
}
/** Whether `midis` is a drop-2 voicing (see `VOICING_SHAPES`). */
export function isDropTwo(midis: readonly number[]): boolean {
  const s = sorted(midis);
  if (s.length !== 4 || isClose(s)) return false;
  // The note dropped from the close source (its second-highest) is the drop-2's lowest: raise it back an
  // octave and the four notes are close again, with it second from the top.
  const back = sorted([(s[0] as number) + 12, s[1] as number, s[2] as number, s[3] as number]);
  return isClose(back) && back[2] === (s[0] as number) + 12;
}
/** The shape of a hand voicing of `chord`, or null when it is none of `VOICING_SHAPES`. */
export function voicingShapeOf(midis: readonly number[], chord: VoicedChord): VoicingShape | null {
  const s = sorted(midis);
  const pcs = s.map(pc);
  const lowest = pcs[0];
  const has = (p: number | undefined) => p !== undefined && pcs.includes(p);
  // A shell is the root at the bottom with the 3rd and the 7th above it; a note doubled in another octave (the root
  // in octaves in the left hand) is still that shell (review:robustness: D2 D3 F3 C4 over Dm7 was refused).
  if (s.length >= 3 && s.length <= 5 && lowest === chord.root) {
    const all = new Set(pcs);
    const upper = new Set(pcs.slice(1));
    if (all.size === 3 && upper.has(chord.third) && upper.has(chord.seventh)) return "shell";
  }
  if (s.length !== 4 || new Set(pcs).size !== 4) return null;
  if (!has(chord.root)) {
    const upper = new Set(pcs);
    const nine = chord.ninth;
    const colour = chord.thirteenth !== undefined && has(chord.thirteenth) ? chord.thirteenth : chord.fifth;
    const set = [chord.third, colour, chord.seventh, nine];
    if (nine !== undefined && set.every((p) => upper.has(p as number))) {
      if (lowest === chord.third) return "rootless-a";
      if (lowest === chord.seventh) return "rootless-b";
    }
    return null;
  }
  // A close or drop-2 voicing holds the chord's own four notes (the 13th may stand for the 5th): D G A C over Dm7
  // has no 3rd and is no voicing of it (build-author-J3a).
  const own = (colour: number | undefined) =>
    colour !== undefined && [chord.root, chord.third, colour, chord.seventh].every((p) => pcs.includes(p));
  if (!own(chord.fifth) && !own(chord.thirteenth)) return null;
  if (isClose(s)) return "close";
  if (isDropTwo(s)) return "drop-2";
  return null;
}

// --- tensions ---------------------------------------------------------------------------------------

/**
 * The tensions available over each seventh-chord quality, and the avoid notes, as `allowed-tensions` reads them
 * against the melody (J2.L03, J5.L04, JC4). Intervals are half steps above the chord's root. A melody note that
 * is a chord tone or an available tension is fine; an avoid note (a half step above a chord tone, held or on a
 * beat) is not. These are starting choices, not laws: the rule counts only structural notes (on a beat, or
 * lasting a beat or more), so passing notes and suspensions that resolve are free, and a lesson that teaches
 * the sus sound uses a `7sus4` chord, where 4 is a chord tone.
 * - maj7 (Ionian, or Lydian with ♯11): 9, ♯11, 13 available; the natural 11 is the avoid note.
 * - 7 (Mixolydian and the altered colours): 9, ♭9, ♯9, ♯11, 13, ♭13 available; the natural 11 is the avoid note.
 * - m7 (Dorian): 9, 11, 13 available; ♭9 is the avoid note. (♭13 is Aeolian's colour, allowed only on a
 *   minor tonic; the table leaves it out, so over ii it counts as a clash.)
 * - m7b5 (Locrian ♮2): 9, 11, ♭13 available; ♭9 is avoided.
 * - dim7: the notes a whole step above each chord tone (2, 5, 8, 11).
 * - 7alt: ♭9, ♯9, ♯11, ♭13; natural 9, 5 and 13 are not in the altered collection.
 */
export const AVAILABLE_TENSIONS: Readonly<
  Partial<
    Record<
      ChordQuality,
      { chordTones: readonly number[]; tensions: readonly number[]; avoid: readonly number[] }
    >
  >
> = {
  maj7: { chordTones: [0, 4, 7, 11], tensions: [2, 6, 9], avoid: [5] },
  "7": { chordTones: [0, 4, 7, 10], tensions: [1, 2, 3, 6, 8, 9], avoid: [5] },
  m7: { chordTones: [0, 3, 7, 10], tensions: [2, 5, 9], avoid: [1] },
  m7b5: { chordTones: [0, 3, 6, 10], tensions: [2, 5, 8], avoid: [1] },
  dim7: { chordTones: [0, 3, 6, 9], tensions: [2, 5, 8, 11], avoid: [] },
  "7alt": { chordTones: [0, 4, 10], tensions: [1, 3, 6, 8], avoid: [2, 7, 9] },
  "6": { chordTones: [0, 4, 7, 9], tensions: [2, 6], avoid: [5] },
  m6: { chordTones: [0, 3, 7, 9], tensions: [2, 5], avoid: [1] },
  mMaj7: { chordTones: [0, 3, 7, 11], tensions: [2, 5, 9], avoid: [1] },
  "7sus4": { chordTones: [0, 5, 7, 10], tensions: [2, 9], avoid: [4] },
};
/** "What is this note over the chord" (J2.L03): the tension names a melody note can have, plus the avoid note. */
export const TENSION_OPTIONS: readonly Choice[] = [
  { id: "chord-tone", label: "A chord tone" },
  { id: "9", label: "The 9th" },
  { id: "b9", label: "The ♭9" },
  { id: "#9", label: "The ♯9" },
  { id: "11", label: "The 11th" },
  { id: "#11", label: "The ♯11" },
  { id: "13", label: "The 13th" },
  { id: "b13", label: "The ♭13" },
  { id: "avoid", label: "A clash: a half step above a chord tone" },
];

// --- sound ------------------------------------------------------------------------------------------

/**
 * "Which is brighter / dirtier / wider / closer" (A1.L05–L07, A2): a `compare` step (two audio cards) with one
 * of these pairs as its options, the first id the A card when it is the answer.
 */
export const SOUND_COMPARE_OPTIONS = {
  brightness: [
    { id: "brighter", label: "Brighter" },
    { id: "darker", label: "Darker" },
  ],
  grit: [
    { id: "dirtier", label: "Dirtier" },
    { id: "cleaner", label: "Cleaner" },
  ],
  width: [
    { id: "wider", label: "Wider" },
    { id: "narrower", label: "Narrower" },
  ],
  space: [
    { id: "farther", label: "Farther away" },
    { id: "closer", label: "Closer" },
  ],
  movement: [
    { id: "moving", label: "Moving" },
    { id: "still", label: "Still" },
  ],
  // Wave 7 integration (build-answers, A2.L02 "which is busier"): the density axis, so content and the answers
  // widget read one table.
  density: [
    { id: "busier", label: "Busier" },
    { id: "sparser", label: "Sparser" },
  ],
} as const satisfies Record<string, readonly Choice[]>;

// --- planned custom rules ---------------------------------------------------------------------------

export type ParamKind =
  | "track"
  | "tracks"
  | "number"
  | "ratio"
  | "rat"
  | "rats"
  | "string"
  | "strings"
  | "boolean"
  | "section"
  | "devices"
  | "model";
export interface ParamSpec {
  kind: ParamKind;
  required?: boolean;
  /** One line: what it is and its default. */
  doc: string;
  /** For `string`/`strings`: the allowed values. */
  values?: readonly string[];
}
export interface PlannedCustomRule {
  /** What the rule measures, as the grader implements it: an effect heard, never a function written. */
  doc: string;
  /** Where the tracks plan to use it. */
  usedBy: readonly string[];
  params: Readonly<Record<string, ParamSpec>>;
}
const track = (doc: string, required = false): ParamSpec => ({ kind: "track", doc, required });
const ratio = (doc: string, required = false): ParamSpec => ({ kind: "ratio", doc, required });
const num = (doc: string, required = false): ParamSpec => ({ kind: "number", doc, required });

/**
 * The custom rules the advanced tracks plan with (contracts 1.8 §5.6). Every one also takes `alsoUses` (the
 * corrections-pass convention: once the effect is heard, the code must also use one of these tools, credit 0.5
 * otherwise), so a lesson Make keeps ONE required rule (contracts §6.5). A part more than 24 dB under the
 * loudest part does not count as heard in any of them (decision 71).
 */
export const TRACK_CUSTOM_RULES: Readonly<Record<string, PlannedCustomRule>> = {
  "walking-bass": {
    doc: "A walking bass: an attack on every quarter of every bar (0, 1/4, 1/2, 3/4; with `skips`, also an eighth just before a beat), the chord's root on beat 1 in at least `rootOnOne` of the bars, a chord tone on beat 3 in at least `chordToneOnThree`, and beat 4 within `maxSemis` of the next bar's beat-1 note (and not the same note) in at least `approachOnFour` of the bar lines. Four attacks crowded into beat 1 are not a walk.",
    usedBy: ["J3.L04", "J4.L02", "JC2"],
    params: {
      bass: track('The bass line (default "@bass").'),
      harmony: track('The chords the roots are read from (default "@chords"; a `changes` list wins).'),
      changes: {
        kind: "strings",
        doc: "Chord symbols, one a bar, looped: judged against these whatever the chords line plays.",
      },
      rootOnOne: ratio("Share of bars with the root on beat 1 (default 0.75)."),
      chordToneOnThree: ratio("Share of bars with a chord tone on beat 3 (default 0)."),
      approachOnFour: ratio(
        "Share of bar lines approached from beat 4 by a step or a half step (default 0.5).",
      ),
      maxSemis: num("The largest approach, in half steps (default 2)."),
      skips: { kind: "boolean", doc: "Allow an eighth-note skip before a beat (default false)." },
    },
  },
  "allowed-tensions": {
    doc: "Reads the MELODY against the chords: of the melody's structural notes (on a beat, or lasting a beat or more), the share that are a chord tone or an available tension of the chord sounding at their onset (`AVAILABLE_TENSIONS`) is at least `minRatio`. Shorter notes off the beat are passing notes and free. A sustained C♯ over Cmaj7 fails.",
    usedBy: ["J2.L03", "J5.L04", "JC4"],
    params: {
      melody: track('The melody (default "@melody").'),
      harmony: track('The chords (default "@chords").'),
      minRatio: ratio("Default 0.85."),
      structural: {
        kind: "string",
        doc: 'Which notes count: "beat" (default) or "all".',
        values: ["beat", "all"],
      },
    },
  },
  "ii-v-chain": {
    doc: "Chained ii–Vs: a minor seventh (or m7♭5) followed by a dominant seventh a 4th above it, each pair aimed at a target a 5th below the V. Counts the distinct TARGET keys, tonic and mode (contracts §6.6: C major and C minor are two keys; a ii–V aims at a key whether or not its I arrives), and passes at `minKeys`.",
    usedBy: ["J2.L01", "JC1"],
    params: {
      harmony: track('Default "@chords".'),
      minKeys: num("Distinct target keys (JC1: 3).", true),
      minPairs: num("ii–V pairs in all (default minKeys)."),
      resolved: ratio("Share of pairs whose target chord follows (default 0)."),
    },
  },
  "voicing-shape": {
    doc: "Hand voicings of a given shape (`VOICING_SHAPES`, `voicingShapeOf`), read octave-aware from the written notes of each chord of `track`, against `changes` (one symbol a bar) or the chord the notes spell. A `voicing()` line fails with a message: dictionary voicings are not graded by shape (contracts §6.7).",
    usedBy: ["J1.L05", "J3.L01", "J3.L02", "JC2"],
    params: {
      track: track("The hand-voiced chords.", true),
      shape: {
        kind: "strings",
        doc: 'Shapes accepted, e.g. ["shell"] or ["rootless-a", "rootless-b"].',
        required: true,
        values: VOICING_SHAPES,
      },
      changes: { kind: "strings", doc: "Chord symbols, one a bar, looped." },
      minRatio: ratio("Share of chords in the shape (default 1)."),
    },
  },
  "song-melody-kept": {
    doc: "The melody track is the song's own melody, note for note: pitch (by `pitch`), onset and pickup, read against `GradeContext.songMelody` (the song the learner picked; carry f4). Reharmonising never touches the tune.",
    usedBy: ["JC4", "J4.L04"],
    params: {
      melody: track('Default "@melody".'),
      pitch: {
        kind: "string",
        doc: 'Default "absolute"; "key-relative" when the learner may move the key.',
        values: ["absolute", "key-relative", "pitch-class"],
      },
      minRatio: ratio("Default 1."),
    },
  },
  contrafact: {
    doc: "A new head on old changes (JC3): the changes are the song's (or `changes`), bar by bar on the triad core, in at least `changesMinRatio` of the bars; and the melody is NEW: at most `maxSharedRatio` of its bars repeat the original head's pitches and rhythm.",
    usedBy: ["JC3"],
    params: {
      melody: track('Default "@melody".'),
      harmony: track('Default "@chords".'),
      changes: { kind: "strings", doc: "The changes, one symbol a bar (default the song's)." },
      changesMinRatio: ratio("Default 0.85."),
      maxSharedRatio: ratio("Default 0.5."),
      standIn: {
        kind: "model",
        doc: "A stand-in model head, read only when the host passes no `songMelody` (the song has no answer key): one section's notes and the bars where it starts (W7 gate, decision 80).",
      },
    },
  },
  "two-versions-differ": {
    doc: "AC1 with `capstone.versions`: both versions keep the tune (melody pitch-class sequence equal after declared swing and tempo are normalised) and they differ audibly: tempo by at least `tempoDelta` BPM, or one swung and one straight; and at least `soundsDiffer` sounds of one are absent from the other.",
    usedBy: ["AC1"],
    params: {
      melody: track('Default "@melody".'),
      tempoDelta: num("BPM (default 20)."),
      soundsDiffer: num("Sounds (default 2)."),
    },
  },
  "same-tune-two-ways": {
    doc: "A2.L06, one piece: the melody of section `a` and section `b` is the same tune (key-relative degrees and rhythm), and the two sections differ on at least `minAxes` of: the sounds used, density (onsets per bar ±25%), groove (the drum onsets), register (±5 half steps).",
    usedBy: ["A2.L06"],
    params: {
      melody: track('Default "@melody".'),
      a: { kind: "section", doc: "The first section.", required: true },
      b: { kind: "section", doc: "The second section.", required: true },
      minAxes: num("Default 2."),
    },
  },
  "extended-share": {
    doc: "AC2: the share of bars whose chord carries a 9th, 11th or 13th (from its symbol; from its notes for a hand voicing) is at least `minRatio`.",
    usedBy: ["AC2"],
    params: { harmony: track('Default "@chords".'), minRatio: ratio("Default 0.6.") },
  },
  microtiming: {
    doc: "A track sits behind (or ahead of) the grid by a FEEL, tempo-aware: the median offset of its onsets from the nearest 16th (or from `against`'s onsets) is between `minMs` and `maxMs` in the direction asked (`FEEL_MS`; `lateMs`). `.late(1/32)` at 76 BPM is 99 ms: a displacement, and it fails.",
    usedBy: ["R1.L05", "AC2"],
    params: {
      track: track("The line that leans.", true),
      against: track("Measured against this line's onsets (default the grid)."),
      direction: { kind: "string", doc: 'Default "late".', values: ["late", "early"] },
      minMs: num("Default 8."),
      maxMs: num("Default 45."),
    },
  },
  "displaced-copy": {
    doc: "R1.L05's one idea: a figure comes back moved to another place in the bar (every onset shifted by the same amount, not a whole bar and at least a 16th), with the same pitches or drums in the same rhythm.",
    usedBy: ["R1.L05"],
    params: {
      track: track("Default: any learner line."),
      by: { kind: "rats", doc: "Shifts accepted, fractions of a bar (default any)." },
      min: num("Copies (default 1)."),
    },
  },
  "metric-weight": {
    doc: "R1.L01: the accents follow the metric hierarchy: the downbeat loudest, then beat 3, then beats 2 and 4, then the off-beats, then the 16ths (effective gain), in at least `minRatio` of the bars.",
    usedBy: ["R1.L01"],
    params: { track: track("The accented line.", true), minRatio: ratio("Default 0.75.") },
  },
  "grouping-accents": {
    doc: "R2.L01–L02: the groove's accents (kick, a louder hit, or a bass note) fall at the starts of the declared groups (`groupStarts`) of the meter's grouping, and nowhere else on the eighth grid, in at least `minRatio` of the bars. `allowOthers` drops the nowhere-else requirement.",
    usedBy: ["R2.L01", "R2.L02", "R1.L06"],
    params: {
      track: track("The accent line (default the kick)."),
      grouping: { kind: "rats", doc: "Unused; the grouping comes from the meter declaration or `groups`." },
      groups: { kind: "strings", doc: 'The grouping, e.g. ["2", "2", "3"].', required: true },
      minRatio: ratio("Default 1."),
      allowOthers: {
        kind: "boolean",
        doc: "Accents may also fall on other eighths; every group start still needs one (default false; R1.L06's suggestion).",
      },
    },
  },
  regrouped: {
    doc: "R2.L03 (hemiola): the same six pulses of a bar grouped both ways in the piece: some bars accent 3+3, others 2+2+2.",
    usedBy: ["R2.L03"],
    params: { track: track("Default: any learner line.") },
  },
  "polymeter-cycle": {
    doc: "R2.L05: track `a` repeats a cycle whose length is not a bar (it crosses the bar line) and lines up with the bar again after `periodBars` (`polymeterPeriodBars`), while `b` keeps the bar.",
    usedBy: ["R2.L05"],
    params: {
      a: track("The polymetric line.", true),
      b: track("The line that keeps the bar.", true),
      periodBars: num("Default: whatever the cycle gives, at least 2."),
    },
  },
  "clave-aligned": {
    doc: "R3.L04: a two-bar part (tumbao bass, montuno piano) is oriented with the clave: read in the clave's two-bar windows, its two bars differ, and at least `min` of its onsets per window coincide with clave hits.",
    usedBy: ["R3.L04", "RC2"],
    params: {
      track: track("The part.", true),
      clave: track('The clave line (default "perc").'),
      min: num("Shared onsets per window (default 2)."),
    },
  },
  stabs: {
    doc: "RC1: a track of short attacks: at least `min` onsets in every `perBars` bars, each shorter than `maxDur` (default an 8th) and audible.",
    usedBy: ["RC1"],
    params: {
      track: track('Default "horns".'),
      min: num("Default 2."),
      perBars: num("Default 2."),
      maxDur: { kind: "rat", doc: "Default [1, 8]." },
    },
  },
  "chord-scale-fit": {
    doc: "J2.L04: the melody's structural notes over each chord belong to that chord's scale (m7 → Dorian, 7 → Mixolydian, maj7 → Ionian or Lydian, m7♭5 → Locrian, 7alt → altered) in at least `minRatio` of them.",
    usedBy: ["J2.L04"],
    params: {
      melody: track('Default "@melody".'),
      harmony: track('Default "@chords".'),
      minRatio: ratio("Default 0.8."),
    },
  },
  "tensions-used": {
    doc: "J2.L03: the melody lands on one of `tensions` (half steps above the chord root, by name: 9, 11, 13, b9, #9, #11, b13) over its chord at least `min` times, on a structural note.",
    usedBy: ["J2.L03", "AC2"],
    params: {
      melody: track('Default "@melody".'),
      harmony: track('Default "@chords".'),
      tensions: {
        kind: "strings",
        doc: 'Tension names, e.g. ["9", "13"].',
        required: true,
        values: ["9", "b9", "#9", "11", "#11", "13", "b13"],
      },
      min: num("Default 2."),
    },
  },
  "counter-melody": {
    doc: "A2.L03: a second line that is its own melody: it moves when the tune holds or in contrary or oblique motion in at least `minIndependence` of the tune's moves, never doubles the tune for more than two beats, and is audible.",
    usedBy: ["A2.L03"],
    params: {
      melody: track('Default "mel".'),
      counter: track('Default "vox".'),
      minIndependence: ratio("Default 0.5."),
    },
  },
  "slices-reordered": {
    doc: "A2.L04: a sample is cut into at least `minSlices` slices (begin/end or `slice` events) and they play in an order other than the sample's own.",
    usedBy: ["A2.L04"],
    params: { track: track("Default: the line playing the sample."), minSlices: num("Default 4.") },
  },
  interlock: {
    doc: "R1.L04 (the R1 spec's request, Wave 7 Build): parts that interlock like gears, read on the 16th grid of each bar: at most `maxShared` of the places played (beat 1 left out) are played by two parts or more, each part has at least `minOwn` places of its own a bar, and together they cover at least `minCover` of the 16 places. A part more than 24 dB under the loudest does not count.",
    usedBy: ["R1.L04", "RC1"],
    params: {
      tracks: { kind: "tracks", doc: 'The parts (default ["@bass", "keys", "gtr"]).' },
      maxShared: ratio("Default 0.25."),
      minOwn: num("Places of its own per part per bar (default 2)."),
      minCover: num("Places covered of the 16 (default 8)."),
    },
  },
  "level-balance": {
    doc: "A2.L05: `quieter` sits between `minDb` and `maxDb` under `louder` (effective gain, median over the notes that sound together); more than 24 dB under is not heard.",
    usedBy: ["A2.L05"],
    params: {
      louder: track("The part on top.", true),
      quieter: track("The part underneath.", true),
      minDb: num("Default 3."),
      maxDb: num("Default 18."),
    },
  },
};
/** The devices the jazz track's reharmonization steps name (`reharmonize.devices`, JC4's `device-count`). */
export const JAZZ_DEVICES: readonly DeviceName[] = [
  "tritone sub",
  "secondary ii–V",
  "backdoor",
  "diminished passing",
];

const isRat = (v: unknown) =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((x) => typeof x === "number" && Number.isInteger(x)) &&
  (v[1] as number) > 0;
/**
 * Problems with a planned custom rule's params: an unknown rule, an unknown or missing param, a wrong kind.
 * `alsoUses` is accepted everywhere (a list of tool IDs, checked by the content checks).
 */
export function trackCustomParamIssues(fn: string, params: Readonly<Record<string, unknown>> = {}): string[] {
  const rule = TRACK_CUSTOM_RULES[fn];
  if (!rule) return [];
  const out: string[] = [];
  for (const [name, spec] of Object.entries(rule.params))
    if (spec.required && params[name] === undefined) out.push(`${fn}: \`${name}\` is required (${spec.doc})`);
  for (const [name, v] of Object.entries(params)) {
    if (name === "alsoUses") {
      if (!Array.isArray(v) || !v.every((x) => typeof x === "string"))
        out.push(`${fn}: \`alsoUses\` is a list of tool IDs`);
      continue;
    }
    const spec = rule.params[name];
    if (!spec) {
      out.push(`${fn}: unknown param \`${name}\` (known: ${Object.keys(rule.params).join(", ")}, alsoUses)`);
      continue;
    }
    const bad = (what: string) => out.push(`${fn}: \`${name}\` is ${what}`);
    switch (spec.kind) {
      case "track":
        if (typeof v !== "string" || v === "") bad("a track reference");
        break;
      case "tracks":
        if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) bad("a list of tracks");
        break;
      case "number":
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) bad("a number ≥ 0");
        break;
      case "ratio":
        if (typeof v !== "number" || v < 0 || v > 1) bad("a share between 0 and 1");
        break;
      case "rat":
        if (!isRat(v)) bad("a fraction [n, d]");
        break;
      case "rats":
        if (!Array.isArray(v) || !v.every(isRat)) bad("a list of fractions [n, d]");
        break;
      case "boolean":
        if (typeof v !== "boolean") bad("true or false");
        break;
      case "string":
        if (typeof v !== "string" || (spec.values && !spec.values.includes(v)))
          bad(spec.values ? `one of ${spec.values.join(", ")}` : "a string");
        break;
      case "strings":
        if (
          !Array.isArray(v) ||
          !v.every((x) => typeof x === "string" && (!spec.values || spec.values.includes(x)))
        )
          bad(spec.values ? `a list of ${spec.values.join(", ")}` : "a list of strings");
        break;
      case "section":
        if (!(v === "last" || (typeof v === "object" && v !== null && ("section" in v || "bars" in v))))
          bad('a section: { section }, { bars: [from, to] } or "last"');
        break;
      case "devices":
        if (!Array.isArray(v) || !v.every((x) => (JAZZ_DEVICES as readonly string[]).includes(x as string)))
          bad(`a list of ${JAZZ_DEVICES.join(", ")}`);
        break;
      case "model": {
        const m = v as { name?: unknown; at?: unknown; notes?: unknown } | null;
        const note = (x: unknown) =>
          Array.isArray(x) &&
          x.length === 5 &&
          x.every((y) => typeof y === "number" && Number.isFinite(y)) &&
          (x[1] as number) > 0 &&
          (x[3] as number) > 0 &&
          (x[2] as number) > 0;
        if (
          typeof m !== "object" ||
          m === null ||
          typeof m.name !== "string" ||
          m.name.length === 0 ||
          !Array.isArray(m.at) ||
          m.at.length === 0 ||
          !m.at.every((b) => Number.isInteger(b) && (b as number) >= 0) ||
          !Array.isArray(m.notes) ||
          m.notes.length === 0 ||
          !m.notes.every(note)
        )
          bad("a model head: { name, at: [bar, …], notes: [[onsetNum, onsetDen, durNum, durDen, midi], …] }");
        break;
      }
    }
  }
  return out;
}

/** Wave 7. One lane of a two-lane tap (feature `tap.lanes`): R2.L04's 3 against 2, one hand per pulse. */
export interface TapLane {
  /** What the lane taps, as the learner reads it: "Left hand: the 2". */
  label: string;
  /** The stimulus track the lane follows. */
  track: TrackRef;
  /** The key the lane listens to ("f", "j"); the app's defaults when absent. */
  key?: string;
}
