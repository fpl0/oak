// Sing capture logic (contracts §8.1, ux §4.3): targets fitted to the learner's comfort range, the live trace
// folded onto the target lane, the needle words, and the per-note summary an attempt stores. The ONE rule for a
// sung note is `@oak/pitch` `gradeSung` (`gradeSungLive` while singing); nothing here grades on its own terms.
// Pure: tested with `bun test`.
import type { Degree, KeySpec, LearnerProfile, SingMode, SingTolerance } from "@oak/content-kit";
import {
  fitToRange,
  gradeSung,
  gradeSungLive,
  type PitchFrame,
  PitchTracker,
  type SungResult,
  type SungTarget,
  trackerOptionsFor,
} from "@oak/pitch";
import { degreeOf } from "@oak/theory";
import { degreeDisplay, degreeSpoken, SYLLABLES } from "./normalize.ts";
import type { AnswerFeedback, PartMark, SungSummary } from "./types.ts";

/** Authors use the learner's rung with per-note folding (contracts §8.1, §8.2). */
export const DEFAULT_SING_TOL: SingTolerance = {
  cents: "learner",
  octave: "per-note",
  driftCompCents: 0,
  minCoverage: 0.4,
  passHitRate: 0.8,
};

/** One note to sing, relative to the take's start (seconds). */
export interface SingNote {
  midi: number;
  /** Seconds after the take starts. */
  at: number;
  dur: number;
  /** "5", "sol": printed on the ribbon. */
  label?: string;
  /** The scale degree (1-based, "b3"): the lane prints it, with its syllable when the labels are syllables. */
  degree?: Degree;
  /**
   * Wave 6 (U15 chromatic degrees, U14 colour tones): the notes a half step away a learner is likely to sing
   * instead (fa for fi). Passed to @oak/pitch, whose neighbour rule then gives a pitch nearer to one of them,
   * outside the band, no credit: "sol fa sol" no longer passes for "sol fi sol".
   */
  neighbours?: SungTarget["neighbours"];
}

/**
 * What the lane prints for a target (contracts §8.3): the degree number, and from U03.L08 its movable-do
 * syllable as well ("5 · sol"; numbers stay shown and accepted). A target without a degree keeps its label.
 */
export function targetLabel(
  n: Pick<SingNote, "label" | "degree">,
  labels: "numbers" | "syllables" = "numbers",
): string {
  if (!n.degree) return n.label ?? "";
  // A host that passes the content's own spelling as the label ("#4") gets it printed as the pad prints it (♯4).
  const num = n.label && n.label !== n.degree ? n.label : degreeDisplay(n.degree);
  return labels === "syllables" ? `${num} · ${SYLLABLES[n.degree]}` : num;
}

/** The spoken form of a target: "degree 5, sol". */
export function targetSpoken(
  n: Pick<SingNote, "label" | "degree">,
  labels: "numbers" | "syllables" = "numbers",
): string {
  if (!n.degree) return n.label ?? "a note";
  return `degree ${degreeSpoken(n.degree)}${labels === "syllables" ? `, ${SYLLABLES[n.degree]}` : ""}`;
}

/**
 * Sing targets from degrees in a key (`SingTarget` `from: "degrees"`): the tonic's MIDI note, the degrees, and
 * per-degree octaves relative to the tonic (1 5 1′ = `[0, 0, 1]`), one per `beat` seconds after `start`.
 */
export function degreeNotes(
  tonic: number,
  degrees: readonly Degree[],
  o: { octaves?: readonly number[]; beat?: number; start?: number; mode?: "major" | "minor" } = {},
): SingNote[] {
  const beat = o.beat ?? 0.75;
  const start = o.start ?? 0;
  return degrees.map((d, i) => ({
    midi: tonic + degreeSemitones(d) + 12 * (o.octaves?.[i] ?? 0),
    at: start + i * beat,
    dur: beat * 0.9,
    degree: d,
  }));
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
/** Semitones above the tonic of a degree relative to the major scale ("b3" → 3, "#4" → 6). */
export function degreeSemitones(d: Degree): number {
  const m = /^(b|#)?([1-7])$/.exec(d);
  if (!m) return 0;
  return (MAJOR_STEPS[Number(m[2]) - 1] as number) + (m[1] === "b" ? -1 : m[1] === "#" ? 1 : 0);
}

/**
 * "A few chords that set home" (the reference before a degree pattern): I IV V I in close position around the
 * tonic, minor with iv and a major V (the leading tone), each chord with its bass.
 */
export function cadenceChords(tonic: number, mode: "major" | "minor" = "major"): number[][] {
  const third = mode === "minor" ? 3 : 4;
  const sixth = mode === "minor" ? 8 : 9;
  const one = [tonic - 12, tonic, tonic + third, tonic + 7];
  return [
    one,
    [tonic - 7, tonic, tonic + 5, tonic + sixth],
    [tonic - 5, tonic - 1, tonic + 2, tonic + 7],
    one,
  ];
}

/**
 * "Hear my singing": the pitch the learner sang on each target, in the target's octave (target + error), at the
 * target's time. Missed notes are silent. Nothing here is audio: only the tracked pitches.
 */
export function takeNotes(
  summaries: readonly SungSummary[],
  notes: readonly SingNote[],
): { midi: number; at: number; dur: number }[] {
  const out: { midi: number; at: number; dur: number }[] = [];
  summaries.forEach((s, i) => {
    const n = notes[i];
    if (!n || s.cents === null) return;
    out.push({ midi: n.midi + s.cents / 100, at: n.at, dur: n.dur });
  });
  return out;
}

/**
 * The sing environment a host reads from `voice.get` (wave3.md §5.3): Quiet mode, the singing labels and the
 * tolerance the server's ladder holds. Hosts spread it into `AnswerEnv` (`quiet`) and `SingEnv`.
 */
export function voiceSing(v: {
  quiet: boolean;
  labels: "numbers" | "syllables";
  ladder: { cents: LearnerProfile["singTolCents"] };
}): { quiet: boolean; labels: "numbers" | "syllables"; tolCents: LearnerProfile["singTolCents"] } {
  return { quiet: v.quiet, labels: v.labels, tolCents: v.ladder.cents };
}

/** Notes moved by whole octaves into the comfort range (contracts §8.1 rule 3), and the shift used. */
export function fitNotes(
  notes: readonly SingNote[],
  profile: LearnerProfile,
): { notes: SingNote[]; shift: number } {
  const shift = fitToRange(
    notes.map((n) => n.midi),
    profile,
  );
  return { notes: notes.map((n) => ({ ...n, midi: n.midi + shift })), shift };
}

/** The targets `gradeSung` reads, on the AudioContext clock. */
export function targetsAt(notes: readonly SingNote[], startAt: number): SungTarget[] {
  return notes.map((n) => ({
    midi: n.midi,
    on: startAt + n.at,
    off: startAt + n.at + n.dur,
    ...(n.neighbours && n.neighbours.length > 0 ? { neighbours: n.neighbours } : {}),
  }));
}

/** Seconds from the take's start to the end of its last note. */
export function takeSeconds(notes: readonly SingNote[]): number {
  return notes.reduce((end, n) => Math.max(end, n.at + n.dur), 0);
}

/** `midi` moved by octaves to the nearest copy of `ref` (fold into (−6, +6] semitones): the lane's octave folding. */
export function foldTo(midi: number, ref: number): { midi: number; octaves: number } {
  let octaves = 0;
  let m = midi;
  while (m - ref > 6) {
    m -= 12;
    octaves--;
  }
  while (m - ref <= -6) {
    m += 12;
    octaves++;
  }
  return { midi: m, octaves };
}

export interface TracePoint {
  /** Seconds after the take's start (window centre). */
  t: number;
  /** Folded to the nearest target in time, fractional MIDI; `null` = unvoiced (a gap in the trace). */
  midi: number | null;
  /** Octaves the point was folded by (the 8va/8vb badge). */
  folded: number;
}

/**
 * The live trace: frames through the same tracker the grader uses (clarity gate, median of 5, octave repair),
 * folded onto the target that is active at that moment (or the nearest one). With `octave: "global"` (a sung
 * pattern) the whole take folds by one shift — onto the pattern's middle — so a voice that stays on 1 draws a
 * flat line under 3 and 5 instead of leaping above them (per-target folding moved a held C4 a fourth ABOVE G4).
 */
export function traceOf(
  frames: readonly PitchFrame[],
  notes: readonly SingNote[],
  startAt: number,
  profile: LearnerProfile,
  octave: SingTolerance["octave"] = "per-note",
): TracePoint[] {
  const centre =
    octave === "global" && notes.length > 1
      ? (Math.min(...notes.map((n) => n.midi)) + Math.max(...notes.map((n) => n.midi))) / 2
      : null;
  const tracker = new PitchTracker({ ...trackerOptionsFor(profile) });
  const out: TracePoint[] = [];
  for (const f of frames) {
    const tr = tracker.push(f);
    const t = tr.t - startAt;
    if (tr.midi === null || notes.length === 0) {
      out.push({ t, midi: null, folded: 0 });
      continue;
    }
    if (centre !== null) {
      const g = foldTo(tr.midi, centre);
      out.push({ t, midi: g.midi, folded: g.octaves });
      continue;
    }
    let ref = notes[0] as SingNote;
    let best = Number.POSITIVE_INFINITY;
    for (const n of notes) {
      const d = t < n.at ? n.at - t : t > n.at + n.dur ? t - n.at - n.dur : 0;
      if (d < best) {
        best = d;
        ref = n;
      }
    }
    const f2 = foldTo(tr.midi, ref.midi);
    out.push({ t, midi: f2.midi, folded: f2.octaves });
  }
  return out;
}

/** The needle (ux §4.3): words and an arrow, never red/green. `null` cents = nothing heard. */
export function needleWords(
  cents: number | null,
  tolCents: number,
): { words: string; arrow: "↑" | "↓" | "" } {
  if (cents === null) return { words: "listening", arrow: "" };
  const c = Math.round(cents);
  if (Math.abs(c) <= 10) return { words: "spot on", arrow: "" };
  if (Math.abs(c) <= tolCents)
    return c < 0 ? { words: "a little low", arrow: "↑" } : { words: "a little high", arrow: "↓" };
  return c < 0 ? { words: "low", arrow: "↑" } : { words: "high", arrow: "↓" };
}

/** Signed cents as the lane prints them: `+12¢`, `−30¢`, `0¢`. */
export function centsText(cents: number): string {
  const c = Math.round(cents);
  if (c === 0) return "0¢";
  return `${c > 0 ? "+" : "−"}${Math.abs(c)}¢`;
}

/**
 * A settled note's mark as the lane prints it: signed cents near the note (`−30¢`), and "another note" once the
 * voice is a semitone or more away — folded cents like `+440¢` for a held 1 under a 5 say nothing to a learner.
 */
export function noteMarkText(cents: number | null): string {
  if (cents === null) return "not heard";
  return Math.abs(cents) >= 100 ? "another note" : centsText(cents);
}

/** What an attempt stores for each target note: the sung pitch (folded), its error and credit. Never audio. */
export function summarize(result: SungResult): SungSummary[] {
  return result.notes.map((n) => ({
    midi: n.sungMidi === null ? null : Math.round(n.sungMidi * 100) / 100,
    cents: n.cents === null ? null : Math.round(n.cents * 10) / 10,
    credit: n.credit,
  }));
}

/** Why a take could not be judged, or what spoiled it, as @oak/pitch reports it (`take.ts`). */
export type TakeProblemKind = "no-voice" | "too-noisy" | "too-short" | "clipped" | "bleed";

/**
 * The take-quality cases of the pitch tracker, each with its own calm line and always a way forward: nothing
 * heard, a voice the room drowned, only short blips, an input so loud it clipped. `null` for a take Oak could
 * follow. Read from the diagnostics alone, so a host can say it from a stored grade too.
 */
export function takeProblem(
  diagnostics: readonly { id: string; params?: Record<string, unknown> }[],
): { kind: TakeProblemKind; text: string } | null {
  const nv = diagnostics.find((d) => d.id === "sing.no-voice");
  if (nv) {
    const reason = nv.params?.reason;
    if (reason === "noisy")
      return {
        kind: "too-noisy",
        text: "There was sound, but too much noise around your voice to follow the pitch. Find a quieter spot or sing closer to the microphone, then try again.",
      };
    if (reason === "short")
      return {
        kind: "too-short",
        text: "Oak heard only short sounds. Hold each note for about half a second, then try again.",
      };
    return {
      kind: "no-voice",
      text: "Oak didn't hear a voice. Sing or hum a little closer to the microphone, then try again. No mic today? Quiet mode lets you hear it in your head instead.",
    };
  }
  // The mic hears the playback (wave4 audio: runtime bleed detection): the fix is headphones, or Quiet mode.
  if (diagnostics.some((d) => d.id === "sing.bleed"))
    return {
      kind: "bleed",
      text: "The mic hears the playback; use wired headphones, then try again. No headphones today? Quiet mode lets you hear it in your head instead.",
    };
  if (diagnostics.some((d) => d.id === "sing.clipped"))
    return {
      kind: "clipped",
      text: "The microphone input is too loud, so the pitch reads unevenly. Turn the input down or sing a little further from the mic, then try again.",
    };
  return null;
}

/** Per-note marks and a calm line, from the same result the grade comes from. */
export function singFeedback(
  result: SungResult,
  labels: readonly (string | undefined)[] = [],
): AnswerFeedback {
  const marks: PartMark[] = result.notes.map((n, i) => {
    const name = labels[i] ? `${labels[i]}: ` : "";
    if (n.cents === null || n.feedback === "sing.missed")
      return { part: i, ok: false, note: `${name}not heard` };
    const words = needleWords(n.cents, result.tolCents).words;
    return { part: i, ok: n.credit >= 1, note: `${name}${words}, ${centsText(n.cents)}` };
  });
  if (result.pass) return { state: "correct", marks };
  const problem = takeProblem(result.diagnostics);
  const noVoice = problem !== null && problem.kind !== "clipped";
  const missed = result.notes.filter((n) => n.feedback === "sing.missed").length;
  const off = result.notes.filter((n) => n.credit < 1 && n.feedback !== "sing.missed").length;
  const message = noVoice
    ? problem.text
    : [
        off ? `${off} ${off === 1 ? "note was" : "notes were"} outside ±${result.tolCents}¢` : null,
        missed ? `${missed} ${missed === 1 ? "note was" : "notes were"} too short to hear` : null,
      ]
        .filter(Boolean)
        .join("; ")
        .replace(/^./, (c) => c.toUpperCase())
        .concat(".");
  return { state: "wrong", marks, message };
}

/** Grades a finished take (the same call the grader makes). */
export function gradeTake(
  frames: readonly PitchFrame[],
  notes: readonly SingNote[],
  startAt: number,
  tol: SingTolerance,
  mode: SingMode,
  profile: LearnerProfile,
): SungResult {
  return gradeSung(frames, targetsAt(notes, startAt), tol, mode, profile);
}

/** The live form: per-note credit for the frames so far (the ribbon fill and the tick). */
export function gradeLive(
  frames: readonly PitchFrame[],
  notes: readonly SingNote[],
  startAt: number,
  tol: SingTolerance,
  mode: SingMode,
  profile: LearnerProfile,
  now: number,
): SungResult {
  return gradeSungLive(frames, targetsAt(notes, startAt), tol, mode, profile, now);
}

// --- the trace coloured by degree (Wave 4, wave3.md §0 carry-over; ux §4.3 "degree colour when in band") ---------

/** A run of the live trace drawn in one colour: the target's degree while the voice is in its band, else neutral. */
export interface TraceSegment {
  /** The degree the voice is on (in band of the target sounding then), or `null` (out of band: neutral). */
  degree: Degree | null;
  points: { t: number; midi: number }[];
}

/**
 * The key a take is in, for degree colours: the reference's tonic when the step has one, else read back from a
 * target that carries its degree (its MIDI minus the degree's semitones). `null`: no degree to colour by.
 */
export function traceKey(
  notes: readonly SingNote[],
  reference?: { tonic: number; mode?: "major" | "minor" } | null,
): KeySpec | null {
  const PC = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
  const mode = reference?.mode ?? "major";
  if (reference) return { tonic: PC[((reference.tonic % 12) + 12) % 12] as string, mode };
  const withDegree = notes.find((n) => n.degree);
  if (!withDegree?.degree) return null;
  const tonicPc = withDegree.midi - degreeSemitones(withDegree.degree);
  return { tonic: PC[((tonicPc % 12) + 12) % 12] as string, mode };
}

/**
 * Splits the trace into runs of one colour. A point is in band when it is within `tolCents` of the target sounding
 * at that moment; its degree is the target's (its own `degree`, else read in `key`). Unvoiced frames break the
 * line; a change of colour starts the next run at the last point so the line stays joined.
 */
export function traceSegments(
  trace: readonly TracePoint[],
  notes: readonly SingNote[],
  tolCents: number,
  key: KeySpec | null,
): TraceSegment[] {
  const out: TraceSegment[] = [];
  let cur: TraceSegment | null = null;
  for (const pt of trace) {
    if (pt.midi === null) {
      cur = null;
      continue;
    }
    const target = notes.find((n) => pt.t >= n.at && pt.t < n.at + n.dur);
    const inBand = target !== undefined && Math.abs(pt.midi - target.midi) * 100 <= tolCents;
    const degree: Degree | null = inBand
      ? (target.degree ?? (key ? (degreeOf(target.midi, key).degree as Degree) : null))
      : null;
    const p = { t: pt.t, midi: pt.midi };
    const prev = cur as TraceSegment | null;
    if (prev && prev.degree === degree) {
      prev.points.push(p);
      continue;
    }
    const last = prev?.points[prev.points.length - 1];
    cur = { degree, points: last ? [last, p] : [p] };
    out.push(cur);
  }
  return out;
}
