// Oak 2.0 W4 F3 "Erase and listen" (The Power of Erasing): the learner mutes each part in turn and listens, says
// whether they miss it, and only then may leave a part out or thin it, each as visible code (one undoable change).
// Oak's reading of where two parts crowd one register at the same moment is shown only after the learner's own
// listening (PLAN §2 rule 3). There is no quota: keeping every part is a fine outcome, and the copy says so.
// Pure: `ErasePass.tsx` drives it.
import { labelledLines, roleOfLabel } from "@oak/api";
import { wrapChain } from "@oak/grader";
import type { LiveHap, MuteMap } from "@oak/strudel";
import { displayName, freqToMidi, noteToMidi, spellMidi } from "@oak/theory";

/**
 * Two notes crowd when they sound at the same moment within this many half steps (Oak's call, kept loose; never
 * shown to the learner as a target).
 */
export const REGISTER_WINDOW = 5;

/** The parts the pass goes through: unmuted labelled lines, in source order, one per label (`$:` lines aside). */
export function erasableParts(code: string): string[] {
  const out: string[] = [];
  for (const line of labelledLines(code)) {
    if (line.muted || line.label.includes("$") || out.includes(line.label)) continue;
    out.push(line.label);
  }
  return out;
}

/**
 * The mutes while `part` is left out: the learner's own mutes as they were, plus `part` (a solo is lifted, or it would
 * hide the very difference the pass listens for). `null`: `before` unchanged.
 */
export function withPartMuted(before: MuteMap, part: string | null): MuteMap {
  if (part === null) return before;
  return {
    muted: new Set([...before.muted, part]),
    solo: null,
    ...(before.hits && before.hits.size > 0 ? { hits: new Map(before.hits) } : {}),
  };
}

/** The first unmuted statement labelled `label`, written `_<label>:` (Strudel's mute in code); every other byte kept. */
export function leaveOut(code: string, label: string): string {
  const line = labelledLines(code).find((l) => l.label === label && !l.muted);
  if (!line) return code;
  return `${code.slice(0, line.from)}_${code.slice(line.from)}`;
}

/** Thins a part in its own code: every other bar (`.mask("<1 0>")`) or shorter notes (`.legato(0.5)`). */
export function thinLine(code: string, label: string, how: "every-other-bar" | "shorter"): string {
  return how === "every-other-bar"
    ? wrapChain(code, label, "mask", '"<1 0>"')
    : wrapChain(code, label, "legato", "0.5");
}

/** A hap's MIDI note as the roll reads it (`freq`, a numeric or named `note`, plus `octave`), else `null`. */
export function midiOfValue(value: Record<string, unknown> | null | undefined): number | null {
  if (!value) return null;
  const octave = typeof value.octave === "number" && Number.isFinite(value.octave) ? value.octave : 0;
  let m: number | null = null;
  if (typeof value.freq === "number" && value.freq > 0) m = freqToMidi(value.freq);
  else if (typeof value.note === "number" && Number.isFinite(value.note)) m = value.note;
  else if (typeof value.note === "string") m = noteToMidi(value.note);
  return m === null ? null : m + 12 * octave;
}

/** The haps `crowdedPairs` reads, from the editor's `queryHaps`. */
export function crowdingHaps(
  haps: readonly LiveHap[],
): { track: string; begin: number; end: number; midi: number | null }[] {
  return haps.map((h) => ({ track: h.track, begin: h.begin, end: h.end, midi: midiOfValue(h.value) }));
}

export interface CrowdedPair {
  a: string;
  b: string;
  /** 1-based bar runs, `[from, to]` inclusive. */
  bars: [number, number][];
  /** The note name of the lower part's middle crowded note ("C3"). */
  near: string;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)] as number;
};

function runsOf(bars: ReadonlySet<number>): [number, number][] {
  const sorted = [...bars].sort((x, y) => x - y);
  const out: [number, number][] = [];
  for (const b of sorted) {
    const last = out.at(-1);
    if (last && b === last[1] + 1) last[1] = b;
    else out.push([b, b]);
  }
  return out;
}

/**
 * Where two of the learner's parts play near each other in pitch at the same time. Learner tracks only (no `band.*`,
 * no drums by `roleOfLabel`, no unpitched hap). Two notes of different tracks crowd when their times overlap and their
 * MIDI notes are within `REGISTER_WINDOW`; bars are 1-based from the overlap's start, merged into runs. Pairs come in
 * order of their first bar, then of `o.order` (the labels as the code writes them; default: first heard).
 */
export function crowdedPairs(
  haps: readonly { track: string; begin: number; end: number; midi: number | null }[],
  o: { cyclesPerBar: number; order?: readonly string[] },
): CrowdedPair[] {
  const notes = haps.filter(
    (h): h is { track: string; begin: number; end: number; midi: number } =>
      h.midi !== null &&
      Number.isFinite(h.midi) &&
      !h.track.startsWith("band.") &&
      roleOfLabel(h.track) !== "drums" &&
      h.end > h.begin,
  );
  const order = [...(o.order ?? [])];
  for (const h of notes) if (!order.includes(h.track)) order.push(h.track);
  const rank = (t: string) => order.indexOf(t);
  const cpb = o.cyclesPerBar > 0 ? o.cyclesPerBar : 1;
  const pairs = new Map<string, { a: string; b: string; bars: Set<number>; mA: number[]; mB: number[] }>();
  for (let i = 0; i < notes.length; i++) {
    const x = notes[i] as (typeof notes)[number];
    for (let j = i + 1; j < notes.length; j++) {
      const y = notes[j] as (typeof notes)[number];
      if (x.track === y.track) continue;
      if (!(x.begin < y.end && y.begin < x.end)) continue;
      if (Math.abs(x.midi - y.midi) > REGISTER_WINDOW) continue;
      const [p, q] = rank(x.track) <= rank(y.track) ? [x, y] : [y, x];
      const key = `${p.track}\u0000${q.track}`;
      const entry = pairs.get(key) ?? { a: p.track, b: q.track, bars: new Set<number>(), mA: [], mB: [] };
      entry.bars.add(Math.floor(Math.max(x.begin, y.begin) / cpb + 1e-9) + 1);
      entry.mA.push(p.midi);
      entry.mB.push(q.midi);
      pairs.set(key, entry);
    }
  }
  return [...pairs.values()]
    .map((e) => {
      const lower = Math.min(median(e.mA), median(e.mB));
      return {
        a: e.a,
        b: e.b,
        bars: runsOf(e.bars),
        near: displayName(spellMidi(Math.round(lower), { key: null })),
      };
    })
    .sort(
      (x, y) =>
        (x.bars[0]?.[0] ?? 0) - (y.bars[0]?.[0] ?? 0) || rank(x.a) - rank(y.a) || rank(x.b) - rank(y.b),
    );
}

const barsText = ([from, to]: [number, number]) => (from === to ? `bar ${from}` : `bars ${from}–${to}`);

/** "bass and chords play near C3 at the same time in bars 3–4." */
export function crowdedSentence(p: CrowdedPair): string {
  const runs = p.bars.map(barsText);
  const where = runs.length <= 1 ? (runs[0] ?? "") : `${runs.slice(0, -1).join(", ")} and ${runs.at(-1)}`;
  return `${p.a} and ${p.b} play near ${p.near} at the same time in ${where}.`;
}

/** Every learner-facing string of the pass (checked with `isDescriptive` in `erase.test.ts`). */
export const ERASE_COPY = {
  title: "Erase and listen",
  intro:
    "Mute each part in turn and listen. Keep every part you would miss; this is not about having fewer parts.",
  start: "Start",
  now: (label: string) => `Now without ${label}. Do you miss it?`,
  missIt: "I miss it",
  dontMissIt: "I don't",
  next: "Next",
  finish: "Finish",
  close: "Close",
  hide: "Hide",
  noneLeft: "There is no part to mute yet: label a line (drums: …) to hear it on its own.",
  keptAll: "You would miss every part: they all stay.",
  notMissed: "Parts you would not miss. Leave one out, or thin it, in your code:",
  leaveOut: "Leave it out in the code",
  everyOtherBar: "Every other bar",
  shorter: "Shorter notes",
  readingTitle: "Oak's reading",
  showReading: "Show Oak's reading now",
  noCrowding: "No two parts share a register at the same moment.",
  runFirst: "Run the code once, then Oak can read where the parts sit.",
  noEditor: "The editor is not ready yet: run the code once, then start.",
  readingNote:
    "Two parts near each other in pitch at the same moment can blur; you decide whether that is what you want.",
} as const;
