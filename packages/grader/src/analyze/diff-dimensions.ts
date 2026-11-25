import { type NEvent, R, rat } from "@oak/content-kit";
import { pieceSlots } from "../rubric/rules.ts";
import type { Normalized, SectionInfo } from "../types.ts";
import { sectionsFromAst } from "./sections.ts";

export type Dimension = "sound" | "rhythm" | "notes" | "harmony" | "form";
export interface PieceView {
  n: Normalized;
  code: string;
}

const ORDER: Dimension[] = ["sound", "rhythm", "notes", "harmony", "form"];
const key = (value: unknown): string => JSON.stringify(value);
const set = (values: string[]): string => key([...new Set(values)].sort());
const learner = (n: Normalized): [string, NEvent[]][] =>
  Object.entries(n.byTrack).filter(([track, events]) => !track.startsWith("band.") && events.length > 0);

/**
 * Oak's call (W5 S8): level and routing are not timbre, so they never change "sound" (PLAN F5 takes level out of
 * every A/B): a louder, panned or re-routed part is the same sound.
 */
const LEVEL_KEYS = new Set(["gain", "velocity", "postgain", "pan", "orbit"]);
/** Controls measured in hertz, heard as ratios (as in `rubric/oak2-form.ts`). */
const FREQUENCY_KEYS = ["cutoff", "hcutoff", "bandf"] as const;
const FREQUENCY = new Set<string>(FREQUENCY_KEYS);
/**
 * Oak's call, copied from `rubric/oak2-form.ts` (X14 round 2): frequencies less than a third of an octave apart are
 * heard as one setting, so a cutoff moved from 2000 to 2010 changes nothing.
 */
const SAME_SETTING_OCTAVES = 1 / 3;
/** Other control values are compared to 3 significant figures. */
const round3 = (v: unknown): unknown =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toPrecision(3)) : v;

interface SoundSig {
  /** The instruments, the control names and each event's non-frequency control values. */
  text: string;
  /** Per frequency control: its distinct values, near ones (< a third of an octave) folded into the lowest. */
  freq: number[][];
}

const timbre = (e: NEvent): [string, unknown][] =>
  Object.entries(e.controls ?? {})
    .filter(([k]) => !LEVEL_KEYS.has(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

function heard(values: number[]): number[] {
  const out: number[] = [];
  let prev = 0;
  for (const v of [...new Set(values)].sort((x, y) => x - y)) {
    if (out.length === 0 || Math.log2(v / prev) >= SAME_SETTING_OCTAVES - 1e-9) out.push(v);
    prev = v;
  }
  return out;
}

function sound(events: readonly NEvent[]): SoundSig {
  return {
    text: key([
      set(events.map((e) => key([e.s ?? null, e.bank ?? null]))),
      set(events.flatMap((e) => timbre(e).map(([k]) => k))),
      set(events.map((e) => key(timbre(e).flatMap(([k, v]) => (FREQUENCY.has(k) ? [] : [[k, round3(v)]]))))),
    ]),
    freq: FREQUENCY_KEYS.map((k) =>
      heard(events.map((e) => e.controls?.[k]).filter((v): v is number => typeof v === "number" && v > 0)),
    ),
  };
}

function sameSound(a: SoundSig, b: SoundSig): boolean {
  if (a.text !== b.text) return false;
  return a.freq.every((xs, i) => {
    const ys = b.freq[i] as number[];
    return (
      xs.length === ys.length &&
      xs.every((x, j) => Math.abs(Math.log2(x / (ys[j] as number))) < SAME_SETTING_OCTAVES - 1e-9)
    );
  });
}

// Keep the cycle number: folding all bars into one would hide alternating rhythms.
const onsets = (events: readonly NEvent[]): string =>
  set(events.map((e) => R.str(rat(e.onset[0], e.onset[1]))));

function pitches(events: readonly NEvent[]): string {
  const groups = new Map<string, string[]>();
  for (const e of [...events].sort((a, b) => R.cmp(a.onset, b.onset))) {
    const at = R.str(rat(e.onset[0], e.onset[1]));
    const group = groups.get(at) ?? [];
    if (e.midi !== null) group.push(key([e.midi, e.cents ?? 0]));
    groups.set(at, group);
  }
  // Simultaneous notes have no melodic ordering; the order returned by the evaluator is incidental.
  return key([...groups.values()].map((group) => group.sort()));
}

function material(events: readonly NEvent[]): string {
  return key(
    events
      .map((e) =>
        key([
          R.toNum(e.onset),
          R.toNum(e.dur),
          R.toNum(e.clipDur ?? e.dur),
          e.midi,
          e.cents ?? 0,
          e.drum ?? null,
        ]),
      )
      .sort(),
  );
}

function trackChanges(a: Normalized, b: Normalized, changed: Set<Dimension>): void {
  const left = new Map(learner(a));
  const right = new Map(learner(b));
  for (const [track, events] of left) {
    const other = right.get(track);
    if (!other) continue;
    if (!sameSound(sound(events), sound(other))) changed.add("sound");
    if (onsets(events) !== onsets(other)) changed.add("rhythm");
    else if (pitches(events) !== pitches(other)) changed.add("notes");
  }
  const added = (own: Map<string, NEvent[]>, other: Map<string, NEvent[]>): void => {
    const alternatives = [...other.values()];
    for (const [track, events] of own) {
      if (other.has(track)) continue;
      // A doubled part changes the instrumentation only, even when it uses a different instrument.
      // Otherwise classify each novel property against the opposite piece's tracks: new sound palette,
      // new onset pattern, and new pitched sequence. With no counterpart, notes may accompany rhythm.
      // Removal uses the same comparison in reverse; silence is never a new part.
      if (alternatives.some((candidate) => material(candidate) === material(events))) {
        changed.add("sound");
        continue;
      }
      if (!alternatives.some((candidate) => sameSound(sound(candidate), sound(events)))) changed.add("sound");
      if (!alternatives.some((candidate) => onsets(candidate) === onsets(events))) changed.add("rhythm");
      if (
        events.some((e) => e.midi !== null) &&
        !alternatives.some((candidate) => pitches(candidate) === pitches(events))
      )
        changed.add("notes");
    }
  };
  added(left, right);
  added(right, left);
}

function harmony(n: Normalized): string {
  const identities: string[] = [];
  for (const slot of pieceSlots(n)) {
    if (!slot.chord) continue;
    const identity = key([slot.chord.rootPc, slot.chord.quality]);
    // Re-striking or holding a chord for longer changes time, not its root or quality.
    if (identities.at(-1) !== identity) identities.push(identity);
  }
  return key(identities);
}

function window(n: Normalized, from: number, bars: number): Normalized {
  const byTrack: Normalized["byTrack"] = {};
  for (const [track, events] of learner(n)) {
    byTrack[track] = events
      .filter((e) => R.lte(rat(from), e.onset) && R.lt(e.onset, rat(from + bars)))
      .map((e) => ({
        ...e,
        onset: R.sub(e.onset, rat(from)),
        dur: R.min(e.dur, R.sub(rat(from + bars), e.onset)),
      }));
  }
  return { ...n, byTrack, all: Object.values(byTrack).flat(), band: [] };
}

function sections(code: string): SectionInfo[] {
  const result = sectionsFromAst(code);
  return result && "sections" in result ? result.sections : [];
}

/** Describe only the supplied learner events; parsing code reads form but never runs the sketch. */
export function diffDimensions(a: PieceView, b: PieceView): Dimension[] {
  const changed = new Set<Dimension>();
  const left = sections(a.code);
  const right = sections(b.code);
  const form = (sections: SectionInfo[]): string => key(sections.map((s) => [s.label, s.bars]));
  const compare = (a: Normalized, b: Normalized): void => {
    trackChanges(a, b, changed);
    if (harmony(a) !== harmony(b)) changed.add("harmony");
  };
  if (form(left) === form(right)) {
    compare(a.n, b.n);
  } else {
    changed.add("form");
    // Match occurrences of a label, not their absolute timeline positions. Ignore unmatched sections
    // and extra bars: those are already described by form, including the harmony they bring with them.
    const remaining = [...right];
    for (const section of left) {
      const i = remaining.findIndex((other) => other.label === section.label);
      if (i < 0) continue;
      const other = remaining.splice(i, 1)[0] as SectionInfo;
      const bars = Math.min(section.bars, other.bars);
      compare(window(a.n, section.startBar, bars), window(b.n, other.startBar, bars));
    }
    // A new section can introduce a new instrument even though its timing and notes belong to form.
    const sounds = new Set<Dimension>();
    trackChanges(a.n, b.n, sounds);
    if (sounds.has("sound")) changed.add("sound");
  }
  return ORDER.filter((dimension) => changed.has(dimension));
}
