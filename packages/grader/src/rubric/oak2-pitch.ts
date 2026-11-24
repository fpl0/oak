// Oak 2.0 pitch strategies are read from sounding notes, with one explicit authorship check for parallel chords.
import type { NEvent, Rat } from "@oak/content-kit";
import { parseRat, R, rat } from "@oak/content-kit";
import { identifyChord, readChord, scalePcs } from "@oak/theory";
import { locAt, mod12, onsets, pitched, num as time } from "../analyze/events.ts";
import { periodOf, selectTrack } from "../analyze/tracks.ts";
import type { AstNode } from "../lint/ast.ts";
import { callSites, parseProgram, programInfo, walk } from "../lint/ast.ts";
import type { Normalized } from "../types.ts";
import type { RubricContext } from "./context.ts";
import type { CorrectionDeps, CorrectionEval, CorrectionRule } from "./corrections-rules.ts";

const num = (p: Record<string, unknown>, k: string, d: number): number =>
  typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : d;
const str = (p: Record<string, unknown>, k: string, d: string): string =>
  typeof p[k] === "string" && (p[k] as string).length > 0 ? (p[k] as string) : d;
const EPS = 1e-8;
const ONSET_TOLERANCE = 1 / 64;
type Note = NEvent & { midi: number };

function notes(n: Normalized, ref: string): Note[] {
  // Literal Band selectors are supported by selectTrack, but cannot earn learner credit here.
  if (ref.startsWith("band.")) return [];
  return pitched(selectTrack(n, ref)).filter(
    (e) => !e.track.startsWith("band.") && e.gain > 0 && time(e.clipDur ?? e.dur) > 0,
  );
}
function result(
  ok: boolean,
  detail: string,
  ctx: RubricContext,
  ref: string,
  at: Rat = rat(0),
  value = 0,
  target = 1,
): CorrectionEval {
  return { ok, detail, value, target, ...(!ok ? { where: locAt(at, ctx, { track: ref }) } : {}) };
}
const missing = (ctx: RubricContext, ref: string) =>
  result(false, `Add sounding notes to ${ref.replace(/^@/, "")} so this part can be checked`, ctx, ref);
const atEnd = (e: NEvent): Rat => R.add(e.onset, e.clipDur ?? e.dur);
const heard = (events: Note[], at: Rat): Note[] =>
  events.filter((e) => R.lte(e.onset, at) && R.lt(at, atEnd(e)));

interface Stack {
  at: Rat;
  midis: number[];
  track: string;
}
function stacks(events: Note[], boundaries: Note[] = events): Stack[] {
  // Ends matter too: a released voice changes the shape even when no new note starts.
  const times = [
    ...new Map(boundaries.flatMap((e) => [e.onset, atEnd(e)]).map((t) => [String(t), t])).values(),
  ].sort(R.cmp);
  return times.flatMap((at) => {
    const sounding = heard(events, at);
    const midis = [...new Set(sounding.map((e) => e.midi))].sort((a, b) => a - b);
    return midis.length >= 3 ? [{ at, midis, track: sounding[0]?.track ?? "chords" }] : [];
  });
}
function usesVoicing(code: string, tracks: Set<string>): boolean {
  const parsed = parseProgram(code);
  if (!parsed.ok) return false;
  const info = programInfo(parsed.ast);
  const visited = new Set<string>();
  const check = (node: AstNode): boolean => {
    if (callSites(node).some((c) => c.isMethod && ["voicing", "voicings"].includes(c.name))) return true;
    let found = false;
    // Consts are common in arranged pieces; hiding the call in one does not make the shape hand-written.
    walk(node, (child) => {
      if (child.type !== "Identifier" || visited.has(String(child.name))) return;
      const binding = info.consts.find((c) => c.name === child.name);
      if (!binding?.init) return;
      visited.add(binding.name);
      found ||= check(binding.init);
    });
    return found;
  };
  return info.labels.some((l) => tracks.has(l.label) && l.expr !== null && check(l.expr));
}

const sameShape: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "track", "@chords");
  const events = notes(n, ref);
  if (!events.length) return missing(ctx, ref);
  const first = events[0] as Note;
  const target = num(p, "minShifts", 2);
  if (usesVoicing(ctx.code, new Set(events.map((e) => e.track))))
    return result(
      false,
      "Move the shape yourself by writing its notes and shifting them together",
      ctx,
      first.track,
      first.onset,
      0,
      target,
    );
  const chords = stacks(events);
  const initial = chords[0];
  if (!initial)
    return result(
      false,
      "Play a chord with at least three notes sounding together",
      ctx,
      first.track,
      first.onset,
      0,
      target,
    );
  const shape = (c: Stack) =>
    c.midis
      .slice(1)
      .map((m, i) => m - (c.midis[i] as number))
      .join(",");
  const wrong = chords.find((c) => shape(c) !== shape(initial));
  const shifts = new Set(chords.map((c) => c.midis[0])).size;
  if (wrong)
    return result(
      false,
      "The chord shapes change, so keep the gaps between their notes the same",
      ctx,
      wrong.track,
      wrong.at,
      shifts,
      target,
    );
  return result(
    shifts >= target,
    shifts >= target
      ? "The same chord shape moves to different pitches"
      : "Move the chord shape to another pitch so the harmony moves",
    ctx,
    initial.track,
    initial.at,
    shifts,
    target,
  );
};

const bassNamesChord: CorrectionRule = (n, ctx, p) => {
  const chordsRef = str(p, "chords", "@chords");
  const bassRef = str(p, "bass", "@bass");
  const chords = notes(n, chordsRef);
  const bass = notes(n, bassRef);
  if (!chords.length) return missing(ctx, chordsRef);
  if (!bass.length) return missing(ctx, bassRef);
  const slots = stacks(chords, [...chords, ...bass]);
  const quality = str(p, "quality", "");
  if (!quality) return result(false, "Choose the chord quality this bass should make", ctx, bassRef);
  if (!slots.length)
    return result(
      false,
      "Play chord notes together above the bass",
      ctx,
      chords[0]?.track ?? chordsRef,
      chords[0]?.onset,
    );
  const matches = slots.map((slot) => {
    const lows = heard(bass, slot.at);
    if (!lows.length) return false;
    const midi = Math.min(...lows.map((e) => e.midi));
    return identifyChord([...slot.midis, midi])[0]?.quality === quality;
  });
  const value = matches.filter(Boolean).length / slots.length;
  const wrong = slots[matches.indexOf(false)];
  return result(
    value >= 0.75,
    value >= 0.75
      ? `The bass makes the requested ${quality} harmony`
      : `Change the bass beneath the chords to make the requested ${quality} harmony`,
    ctx,
    bass[0]?.track ?? bassRef,
    wrong?.at,
    value,
    0.75,
  );
};

interface Pair {
  source: Note[];
  copy: Note[];
  sourceRef: string;
  copyRef: string;
}
function pair(n: Normalized, ctx: RubricContext, p: Record<string, unknown>): Pair | CorrectionEval {
  const sourceRef = str(p, "source", "source");
  const copyRef = str(p, "copy", "copy");
  const source = notes(n, sourceRef);
  const copy = notes(n, copyRef);
  if (!source.length) return missing(ctx, sourceRef);
  if (!copy.length) return missing(ctx, copyRef);
  return { source, copy, sourceRef, copyRef };
}
function sameOnsets(pair: Pair, ctx: RubricContext): CorrectionEval | null {
  const { source, copy, copyRef } = pair;
  const mismatch = source.findIndex(
    (e, i) => !copy[i] || Math.abs(time(e.onset) - time((copy[i] as Note).onset)) > ONSET_TOLERANCE + EPS,
  );
  if (mismatch !== -1 || source.length !== copy.length)
    return result(
      false,
      `Keep the note starts in ${copyRef} aligned with the source`,
      ctx,
      copy[mismatch]?.track ?? copy[0]?.track ?? copyRef,
      copy[mismatch]?.onset ?? source[mismatch]?.onset ?? copy[source.length]?.onset,
    );
  for (const events of [source, copy]) {
    const simultaneous = events.find((e, i) => i > 0 && R.eq(e.onset, (events[i - 1] as Note).onset));
    if (simultaneous)
      return result(
        false,
        "Use one note at a time so the copied tune has a clear order",
        ctx,
        simultaneous.track,
        simultaneous.onset,
      );
  }
  return null;
}
function degree(midi: number, pcs: number[]): number | null {
  const index = pcs.indexOf(mod12(midi));
  return index < 0 ? null : Math.floor((midi - (pcs[0] as number)) / 12) * pcs.length + index;
}
const invertedCopy: CorrectionRule = (n, ctx, p) => {
  const parts = pair(n, ctx, p);
  if ("ok" in parts) return parts;
  const rhythm = sameOnsets(parts, ctx);
  if (rhythm) return rhythm;
  const pcs = ctx.key ? scalePcs(ctx.key) : null;
  const sums = parts.source.map((s, i) => {
    const c = parts.copy[i] as Note;
    const a = pcs ? degree(s.midi, pcs) : s.midi;
    const b = pcs ? degree(c.midi, pcs) : c.midi;
    return a === null || b === null ? null : a + b;
  });
  const tolerance = pcs ? 0 : 1;
  const centers = [
    ...new Set(sums.filter((s): s is number => s !== null).flatMap((s) => [s - tolerance, s, s + tolerance])),
  ];
  let matches = sums.map(() => false);
  for (const center of centers) {
    const candidate = sums.map((s) => s !== null && Math.abs(s - center) <= tolerance);
    if (candidate.filter(Boolean).length > matches.filter(Boolean).length) matches = candidate;
  }
  const value = matches.filter(Boolean).length / sums.length;
  const moves =
    new Set(parts.source.map((e) => e.midi)).size > 1 && new Set(parts.copy.map((e) => e.midi)).size > 1;
  // The half-step tolerance must not turn a narrow transposition into an inversion.
  const transposed = new Set(parts.source.map((e, i) => (parts.copy[i] as Note).midi - e.midi)).size === 1;
  const ok = moves && !transposed && value >= 0.85;
  const wrong = parts.copy[matches.indexOf(false)] ?? parts.copy[0];
  return result(
    ok,
    ok
      ? "The copied tune mirrors the source around one centre"
      : "Make the copied tune move the opposite way around one fixed centre",
    ctx,
    wrong?.track ?? parts.copyRef,
    wrong?.onset,
    value,
    0.85,
  );
};

function windowBars(events: Note[], ctx: RubricContext): number {
  return ctx.bars ?? Math.max(1, ...events.map((e) => Math.floor(time(e.onset)) + 1));
}
function loopLength(events: Note[], ctx: RubricContext): number {
  const bars = windowBars(events, ctx);
  return periodOf(events, bars, bars);
}
const rotatedCopy: CorrectionRule = (n, ctx, p) => {
  const parts = pair(n, ctx, p);
  if ("ok" in parts) return parts;
  const rhythm = sameOnsets(parts, ctx);
  if (rhythm) return rhythm;
  const period = loopLength(parts.source, ctx);
  const loop = parts.source.filter((e) => time(e.onset) < period);
  const identical = parts.source.every((e, i) => e.midi === parts.copy[i]?.midi);
  let best = parts.copy.map(() => false);
  for (let k = 1; k < loop.length; k++) {
    const matches = parts.copy.map((e, i) => e.midi === loop[(i + k) % loop.length]?.midi);
    if (matches.filter(Boolean).length > best.filter(Boolean).length) best = matches;
  }
  const value = best.filter(Boolean).length / parts.copy.length;
  const ok = !identical && value === 1;
  const wrong = parts.copy[best.indexOf(false)] ?? parts.copy[0];
  return result(
    ok,
    ok
      ? "The copied pitches start at a different place in the same order"
      : "Start the copied pitches at another place and keep their order around the loop",
    ctx,
    wrong?.track ?? parts.copyRef,
    wrong?.onset,
    value,
    1,
  );
};

const modulo = (x: number, length: number) => ((x % length) + length) % length;
const timeShifted: CorrectionRule = (n, ctx, p) => {
  const parts = pair(n, ctx, p);
  if ("ok" in parts) return parts;
  const period = loopLength(parts.source, ctx);
  const bars = windowBars(parts.source, ctx);
  const loop = parts.source.filter((e) => time(e.onset) < period);
  let min: number;
  try {
    min = time(parseRat(str(p, "min", "1/16")));
  } catch {
    return result(false, "Write the minimum shift as a fraction of a cycle", ctx, parts.copyRef);
  }
  const first = loop[0] as Note;
  const offsets = [
    ...new Set(
      parts.copy
        .filter((c) => c.midi === first.midi)
        .map((c) => modulo(time(c.onset) - time(first.onset), period)),
    ),
  ];
  let bestCount = -1;
  let bestOffset = 0;
  let wrong: Note | undefined = parts.copy[0];
  for (const offset of offsets) {
    const expected: { at: number; note: Note }[] = [];
    for (const note of loop) {
      const phase = modulo(time(note.onset) + offset, period);
      for (let at = phase; at < bars - EPS; at += period) expected.push({ at, note });
    }
    expected.sort((a, b) => a.at - b.at || a.note.midi - b.note.midi);
    const matches = expected.map((e, i) => {
      const c = parts.copy[i];
      return (
        !!c &&
        Math.abs(time(c.onset) - e.at) < EPS &&
        c.midi === e.note.midi &&
        Math.abs(time(c.clipDur ?? c.dur) - time(e.note.clipDur ?? e.note.dur)) < EPS
      );
    });
    const count = matches.filter(Boolean).length;
    const distance = Math.min(offset, period - offset);
    if (count > bestCount) {
      bestCount = count;
      bestOffset = distance;
      wrong = parts.copy[matches.indexOf(false)] ?? parts.copy[expected.length] ?? parts.copy[0];
    }
    if (
      matches.every(Boolean) &&
      expected.length === parts.copy.length &&
      distance > EPS &&
      distance + EPS >= min
    )
      return result(
        true,
        "The whole copied tune moves by one steady time shift",
        ctx,
        parts.copyRef,
        undefined,
        distance,
        min,
      );
  }
  return result(
    false,
    "Move the whole copied tune earlier or later by the same amount",
    ctx,
    wrong?.track ?? parts.copyRef,
    wrong?.onset,
    bestOffset,
    min,
  );
};

function arpeggioLeaps(events: Note[]): Set<number> {
  const exempt = new Set<number>();
  // Thirds are arpeggio leaps too, even when the exercise only counts larger gaps to fill.
  for (let start = 0; start + 2 < events.length; start++) {
    const direction = Math.sign((events[start + 1] as Note).midi - (events[start] as Note).midi);
    for (let end = start + 1; end < events.length; end++) {
      const interval = (events[end] as Note).midi - (events[end - 1] as Note).midi;
      if (Math.abs(interval) <= 2 || Math.sign(interval) !== direction) break;
      if (end < start + 2) continue;
      const pitches = events.slice(start, end + 1).map((e) => e.midi);
      if (new Set(pitches.map(mod12)).size >= 3 && readChord(pitches.map(mod12), mod12(Math.min(...pitches))))
        for (let i = start; i < end; i++) exempt.add(i);
    }
  }
  return exempt;
}
const gapFill: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "track", "@melody");
  const all = notes(n, ref);
  if (!all.length) return missing(ctx, ref);
  const period = loopLength(all, ctx);
  const events = all.filter((e) => time(e.onset) < period);
  if (onsets(events).length !== events.length)
    return result(
      false,
      "Use one note at a time so the tune has a clear direction",
      ctx,
      events[0]?.track ?? ref,
      events[0]?.onset,
    );
  const leap = num(p, "leap", 5);
  const target = num(p, "ratio", 0.6);
  const exempt = arpeggioLeaps(events);
  const counted = events.slice(0, -1).flatMap((e, i) => {
    const next = events[i + 1] as Note;
    const interval = next.midi - e.midi;
    if (Math.abs(interval) < leap || exempt.has(i)) return [];
    const after = events[i + 2];
    return [{ note: next, filled: !!after && (after.midi - next.midi) * interval < 0 }];
  });
  if (!counted.length)
    return result(
      false,
      "There is no leap yet to answer with a move back",
      ctx,
      events[0]?.track ?? ref,
      events[0]?.onset,
      0,
      target,
    );
  const value = counted.filter((l) => l.filled).length / counted.length;
  const wrong = counted.find((l) => !l.filled)?.note ?? events[0];
  return result(
    value >= target,
    value >= target
      ? "The tune usually turns back after a leap"
      : "After a leap, move back toward the notes you left",
    ctx,
    wrong?.track ?? ref,
    wrong?.onset,
    value,
    target,
  );
};

export function oak2PitchRules(_deps: CorrectionDeps): Record<string, CorrectionRule> {
  return {
    "same-shape": sameShape,
    "bass-names-chord": bassNamesChord,
    "inverted-copy": invertedCopy,
    "rotated-copy": rotatedCopy,
    "time-shifted": timeShifted,
    "gap-fill": gapFill,
  };
}
