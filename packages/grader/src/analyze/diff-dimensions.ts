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

function sound(events: readonly NEvent[]): string {
  return key([
    set(events.map((e) => key([e.s ?? null, e.bank ?? null]))),
    set(events.flatMap((e) => Object.keys(e.controls ?? {}))),
  ]);
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
    if (sound(events) !== sound(other)) changed.add("sound");
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
      if (!alternatives.some((candidate) => sound(candidate) === sound(events))) changed.add("sound");
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
