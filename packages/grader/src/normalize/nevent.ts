// OakEvent → NEvent (contracts §5.7): exact rationals, pitch precedence and source, cents, drum roles,
// gain, written spelling, deterministic IDs; then grouping by track and role inference (§6.2, the
// matcher library's `normalizedFromEvents`).
import {
  barOf,
  type DrumRole,
  type Layer,
  type NEvent,
  type PitchSource,
  parseRat,
  R,
  type Rat,
} from "@oak/content-kit";
import { normalizedFromEvents } from "../analyze/tracks.ts";
import { core } from "../runtime/strudel.ts";
import type { EvalSuccess, NormalizeContext, Normalized, OakEvent } from "../types.ts";

/** Drum sound → role (exercises §3.1): the bank prefix (`RolandTR909_bd`) is stripped first. */
const DRUM_MAP: Readonly<Record<string, DrumRole>> = {
  bd: "kick",
  kick: "kick",
  sd: "snare",
  snare: "snare",
  cp: "clap",
  clap: "clap",
  rim: "rim",
  rm: "rim",
  hh: "hatClosed",
  ch: "hatClosed",
  oh: "hatOpen",
  lt: "tom",
  mt: "tom",
  ht: "tom",
  cr: "crash",
  crash: "crash",
  rd: "ride",
  ride: "ride",
  sh: "shaker",
  cb: "perc",
  tb: "perc",
  perc: "perc",
  misc: "perc",
  fx: "perc",
  brk: "perc",
  // Sound pack v4 (added, nothing above changes): hand percussion and foley one-shots are percussion, the six
  // breaks are drums as `brk` is, and `sbd` (a synthesised kick) is a kick. Beds (`vinyl`, `tape`, `drone`) and
  // wavetables (`wt_*`) are not drum hits.
  conga: "perc",
  bongo: "perc",
  clave: "perc",
  foley: "perc",
  snap: "perc",
  impact: "perc",
  swoosh: "perc",
  scratch: "perc",
  brkfunk: "perc",
  brkboombap: "perc",
  brkjungle: "perc",
  brkhouse: "perc",
  brkjazz: "perc",
  brklofi: "perc",
  sbd: "kick",
};

export function drumRole(s: string, bank?: string): DrumRole | null {
  let name = s.trim();
  if (bank && name.startsWith(`${bank}_`)) name = name.slice(bank.length + 1);
  else if (/^[A-Za-z0-9]+_[a-z]+$/.test(name) && !name.startsWith("gm_"))
    name = name.slice(name.indexOf("_") + 1);
  name = name.split(":")[0] as string;
  return DRUM_MAP[name] ?? null;
}

function noteMidi(text: string): number | null {
  if (!core.isNote(text)) return null;
  try {
    return core.noteToMidi(text);
  } catch {
    return null;
  }
}

function pitchSourceOf(e: OakEvent): PitchSource {
  switch (e.pitchSource) {
    case "freq":
      return "freq";
    case "n-index":
      return "n-index";
    case "none":
      return "none";
    default: {
      if (e.midi === null) return e.pitchSource === "note-str" ? "note-str" : "none";
      if (e.chord !== null && e.scale === null) return "voicing";
      if (e.scale !== null) return "n-scale";
      if (e.pitchSource === "value") return typeof e.note === "number" ? "note-num" : "note-str";
      return e.pitchSource;
    }
  }
}

/** The note as the learner typed it: only when a `note("…")` atom produced exactly this pitch. */
function writtenOf(e: OakEvent, source: PitchSource): string | undefined {
  if (source !== "note-str" || e.midi === null) return undefined;
  const octaveShift = 12 * (e.octave ?? 0);
  for (const l of e.locations) {
    if (l.fn !== "note" || !l.text) continue;
    if (noteMidi(l.text) === e.midi - octaveShift) return l.text;
  }
  return undefined;
}

/** One raw event as an `NEvent`; the ID is assigned by `assignIds` once the whole set is known. */
export function toNEvent(e: OakEvent): NEvent {
  const onset: Rat = parseRat(e.begin);
  const end: Rat = parseRat(e.end);
  const dur = R.sub(end, onset);
  const source = pitchSourceOf(e);
  let midi: number | null = e.midi;
  let cents: number | undefined;
  if (midi !== null && !Number.isInteger(midi)) {
    const rounded = Math.round(midi);
    const c = Math.round((midi - rounded) * 100);
    midi = rounded;
    if (c !== 0) cents = c;
  }
  const drum = e.s !== null && e.midi === null ? drumRole(e.s, e.bank ?? undefined) : null;
  const written = writtenOf(e, source);
  const out: NEvent = {
    id: "",
    track: e.track,
    onset,
    dur,
    midi,
    pitchSource: source,
    gain: (e.gain ?? 0.8) * (e.velocity ?? 1) * (e.postgain ?? 1),
    locs: e.locations.map((l) => ({ from: l.start, to: l.end })),
  };
  if (e.clip !== null && e.clip > 0) out.clipDur = clipDur(dur, e.clip);
  if (cents !== undefined) out.cents = cents;
  if (written !== undefined) out.written = written;
  if (e.chord !== null) out.chordSymbol = e.chord;
  if (drum) out.drum = drum;
  if (e.s !== null) out.s = e.s;
  if (e.bank !== null) out.bank = e.bank;
  if (typeof e.n === "number" && e.scale === null && source !== "voicing" && Number.isInteger(e.n))
    out.sampleN = e.n;
  if (e.scale !== null) out.scaleCtx = e.scale;
  if (e.controls) out.controls = { ...e.controls };
  if (e.voicedWith) out.voicedWith = e.voicedWith;
  return out;
}

function clipDur(dur: Rat, clip: number): Rat {
  // clip is usually a short decimal (.5, .25, 1.5): exact with a 1000 denominator.
  const c: Rat = Number.isInteger(clip * 1000) ? [clip * 1000, 1000] : [Math.round(clip * 1000), 1000];
  const r = R.mul(dur, [c[0], c[1]]);
  return r;
}

/** `${track}|${bar}|${n}/${d}|${midi ?? s ?? chordSymbol}|${k}`: deterministic for the same code. */
export function assignIds(events: NEvent[], pickup: boolean): NEvent[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const what = e.midi ?? e.s ?? e.chordSymbol ?? "-";
    const base = `${e.track}|${barOf(e.onset, pickup)}|${e.onset[0]}/${e.onset[1]}|${what}`;
    const k = counts.get(base) ?? 0;
    counts.set(base, k + 1);
    e.id = `${base}|${k}`;
  }
  return events;
}

/**
 * At or below this effective gain ((gain ?? 0.8) · velocity · postgain) an event is not heard: `.gain(0)`,
 * `.velocity(0)`, `.postgain(0)`, a `"<0 .4>"` gain pattern's silent bars (−40 dB under full scale). Such events
 * are not part of the music that is graded or analysed: a muted part cannot show a backbeat, a melody or a
 * transcription. The raw `EvalSuccess.events` keep them.
 */
export const SILENT_GAIN = 0.01;
/** Effective gain of one event: `(gain ?? 0.8) · velocity · postgain`. */
export const effectiveGain = (e: OakEvent): number => (e.gain ?? 0.8) * (e.velocity ?? 1) * (e.postgain ?? 1);
export const isAudible = (e: OakEvent): boolean => effectiveGain(e) > SILENT_GAIN;

/**
 * Corrections gate (attack:still-passes S1): a learner event this far under the loudest learner event of the piece
 * (−24 dB) is masked by the rest of the mix: `.gain(.02)` under a piano at full scale is not heard as a part, so it
 * cannot carry a melody, a reply, a second key or a backbeat. Ghost notes (.3), quiet hats (.3 · .5) and soft pads
 * (.1) stay well above it. Band tracks are judged on their own (they are mixed apart from the learner's code).
 */
export const MASKED_RATIO = 1 / 16;
export function audibleInMix(events: readonly OakEvent[]): OakEvent[] {
  const heard = events.filter(isAudible);
  let peak = 0;
  for (const e of heard) if (!e.track.startsWith("band.")) peak = Math.max(peak, effectiveGain(e));
  const floor = peak * MASKED_RATIO;
  return heard.filter((e) => e.track.startsWith("band.") || effectiveGain(e) >= floor);
}

/**
 * Raw events to `NEvent`s grouped by track, with the roles of contracts §6.2. Inaudible events (`isAudible`) and
 * events masked by the rest of the mix (`audibleInMix`) are left out; a chord whose voiced notes were moved to another pitch class after `voicing()` (`chordStale` on any
 * of its notes) loses its symbol, so it is read from the notes that sound.
 */
export function normalize(result: EvalSuccess, ctx: NormalizeContext): Normalized {
  const audible = audibleInMix(result.events);
  const stale = new Set(
    audible.filter((e) => e.chordStale).map((e) => `${e.track}|${e.begin}|${e.chord ?? ""}`),
  );
  const nevents = audible.map((e) => {
    const ne = toNEvent(e);
    if (stale.size > 0 && stale.has(`${e.track}|${e.begin}|${e.chord ?? ""}`)) delete ne.chordSymbol;
    return ne;
  });
  const events = assignIds(nevents, ctx.pickup !== undefined);
  const n = normalizedFromEvents(events, { cps: result.cps, bpm: result.bpm });
  // Every evaluated track is present, even a silent one, so a selector can tell "silent" from "absent".
  for (const t of result.tracks) n.byTrack[t] ??= [];
  return n;
}

/** Role resolution alone: fixed labels first, then the inference rules. */
export function inferRoles(
  byTrack: Record<string, NEvent[]>,
): Partial<Record<Exclude<Layer, "all">, string>> {
  return normalizedFromEvents(Object.values(byTrack).flat()).roles;
}
