// The preloader (architecture §6.4, spikes/s3-sounds/src/oak-audio.ts). It warms exactly the buffers
// superdough will need at trigger time: sample buffers through `getSampleBuffer` (pitched maps pick the
// closest note), soundfont zones through `getFontBufferSource` (cached per font and pitch).
import * as core from "@strudel/core";
import * as soundfonts from "@strudel/soundfonts";
import * as webaudio from "@strudel/webaudio";
import { type HapValue, layeredIndex, layerOf, type SoundEntry } from "./pack.ts";
import type { PreloadReport, PreloadSpec } from "./types.ts";

export type WarmResult = "warmed" | "synth" | "missing";

const REST = new Set(["-", "~", "_"]);
/** The range a soundfont is warmed over when the spec names no pitch and the sound declares none: C2–C6. */
export const DEFAULT_FONT_RANGE: readonly [number, number] = [36, 84];
/** Semitones between warmed pitches: a font's zones span a few semitones, so every zone in range is loaded. */
export const FONT_WARM_STEP = 3;

/**
 * The pitches a by-name preload warms for a soundfont: every `FONT_WARM_STEP` semitones across its range, ends
 * included. The font file is fetched once; each pitch decodes the zone it falls in (the soundfont loader caches
 * per pitch), so the first notes of a melody in any key find their zone decoded.
 */
export function fontWarmNotes(range: readonly [number, number] = DEFAULT_FONT_RANGE): number[] {
  const [lo, hi] = range[0] <= range[1] ? range : [range[1], range[0]];
  const out: number[] = [];
  for (let m = Math.round(lo); m < hi; m += FONT_WARM_STEP) out.push(m);
  out.push(Math.round(hi));
  return out;
}

/** The registry key superdough looks a hap value up by: `bank_s`, lower-cased by `getSound`. */
export function soundKeyOf(value: { s?: unknown; bank?: unknown }): string | null {
  if (typeof value.s !== "string" || REST.has(value.s)) return null;
  return typeof value.bank === "string" && value.bank.length > 0 ? `${value.bank}_${value.s}` : value.s;
}

type Resolved =
  | { kind: "sample"; value: HapValue; samples: unknown }
  | { kind: "font"; font: string }
  | { kind: "synth" }
  | { kind: "missing" };

/** What superdough will load for one hap value: the sample value it looks up, or the soundfont, or nothing. */
function resolve(value: HapValue): Resolved {
  const key = soundKeyOf(value);
  if (key === null) return { kind: "synth" };
  const sound = webaudio.getSound(key) as SoundEntry | undefined;
  if (!sound) return { kind: "missing" };
  const { type, samples, fonts, layers, split } = sound.data ?? {};
  if (type === "sample") {
    // A v4 layered sound plays the file its velocity picks (pack.ts sampleAliasTrigger / trimKits).
    const n =
      layers && layers > 1
        ? Array.isArray(samples)
          ? layeredIndex(value.n, value.velocity, samples.length, layers, split ?? [])
          : layerOf(value.velocity, split ?? [])
        : value.n;
    return { kind: "sample", value: { ...value, s: key, n }, samples };
  }
  if (type === "soundfont" && fonts && fonts.length > 0) {
    return { kind: "font", font: fonts[core.getSoundIndex(value.n ?? 0, fonts.length)] as string };
  }
  return { kind: "synth" };
}

/** Warm the buffer one hap value will need. Mirrors what superdough does at trigger time. */
export async function warmValue(value: HapValue): Promise<WarmResult> {
  const r = resolve(value);
  if (r.kind === "sample") {
    await webaudio.getSampleBuffer(r.value, r.samples);
    return "warmed";
  }
  if (r.kind === "font") {
    await soundfonts.getFontBufferSource(r.font, value, webaudio.getAudioContext());
    return "warmed";
  }
  return r.kind;
}

/**
 * Hap values to warm for one spec entry: every pitch it names; else the whole pitched map, every variant of a
 * sample role, or a soundfont's range.
 */
export function valuesOfSpec(spec: PreloadSpec["sounds"][number]): HapValue[] {
  const base: HapValue = { s: spec.s, n: spec.n ?? 0 };
  if (spec.bank !== undefined) base.bank = spec.bank;
  if (spec.notes && spec.notes.length > 0) return spec.notes.map((note) => ({ ...base, note }));
  const key = soundKeyOf(base);
  const sound = key ? (webaudio.getSound(key) as SoundEntry | undefined) : undefined;
  const data = sound?.data;
  if (
    data?.type === "sample" &&
    data.samples &&
    typeof data.samples === "object" &&
    !Array.isArray(data.samples)
  ) {
    // A pitched map ({ "c3": [...], "e3": [...] }): warm every file of it (every velocity layer).
    return Object.keys(data.samples).flatMap((note) =>
      layerVelocities(data).map((v) => withVelocity({ ...base, note }, v)),
    );
  }
  if (data?.type === "sample" && Array.isArray(data.samples) && spec.n === undefined) {
    // A drum role by name: every variant `n` can select (a kit's brush swirl is `sd:2`), every layer.
    const per = data.layers && data.layers > 1 ? data.layers : 1;
    return Array.from({ length: Math.ceil(data.samples.length / per) }, (_, n) =>
      layerVelocities(data).map((v) => withVelocity({ ...base, n }, v)),
    ).flat();
  }
  if (data?.type === "soundfont") return fontWarmNotes(data.range).map((note) => ({ ...base, note }));
  return [base];
}

/** A value at a layer's velocity (1, the default, is left unset so unlayered values stay as they were). */
const withVelocity = (v: HapValue, velocity: number): HapValue => (velocity === 1 ? v : { ...v, velocity });

/** One velocity per layer of a layered sound (the softest layer's below its threshold), else just 1. */
function layerVelocities(data: NonNullable<SoundEntry["data"]>): number[] {
  if (!data.layers || data.layers < 2) return [1];
  const split = data.split ?? [];
  return Array.from({ length: data.layers }, (_, i) =>
    i >= split.length ? 1 : ((i === 0 ? 0 : (split[i - 1] as number)) + (split[i] as number)) / 2,
  );
}

/** The key of a value `fileKeyOf` cannot resolve to a file (a synth, a missing sound, an unexpected shape). */
const valueKey = (v: HapValue): string =>
  JSON.stringify([v.bank, v.s, v.n, v.note, v.freq, typeof v.velocity === "number" ? v.velocity : 1]);

/**
 * What a value's warm loads: the sample file superdough resolves it to (the closest pitch of a pitched map, the
 * velocity layer, the variant), or a soundfont zone (cached per font and pitch). A melody's neighbouring pitches
 * and a chord's voices mostly share a pitched map's file; warmed as separate values, each held a loader slot
 * waiting on the same fetch, and new files queued behind them (Wave 5, C3 on pack v4).
 */
export function fileKeyOf(v: HapValue): string {
  try {
    const r = resolve(v);
    if (r.kind === "sample") {
      const url = (webaudio.getSampleInfo(r.value, r.samples) as { url?: unknown }).url;
      if (typeof url === "string") return `sample ${url}`;
    } else if (r.kind === "font") {
      return `font ${JSON.stringify([r.font, v.note ?? "c3", v.freq])}`;
    }
  } catch {
    // an unexpected value shape: fall back to the value itself
  }
  return valueKey(v);
}

/**
 * Warms one value per distinct file (`fileKeyOf`), at most `concurrency` at a time; the report counts files, not
 * values. Never rejects: a failed load counts as missing.
 */
export async function warmAll(
  values: readonly HapValue[],
  onProgress?: (done: number, total: number) => void,
  concurrency = 6,
): Promise<PreloadReport> {
  const t0 = performance.now();
  const report: PreloadReport = { warmed: 0, synths: 0, missing: [], ms: 0 };
  const seen = new Set<string>();
  const unique = values.filter((v) => {
    const key = fileKeyOf(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let done = 0;
  const queue = [...unique];
  const missing = new Set<string>();
  const worker = async (): Promise<void> => {
    for (let v = queue.shift(); v !== undefined; v = queue.shift()) {
      let result: WarmResult;
      try {
        result = await warmValue(v);
      } catch {
        result = "missing";
      }
      if (result === "warmed") report.warmed++;
      else if (result === "synth") report.synths++;
      else missing.add(soundKeyOf(v) ?? String(v.s));
      done++;
      onProgress?.(done, unique.length);
    }
  };
  onProgress?.(0, unique.length);
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, unique.length)) }, worker));
  report.missing = [...missing].sort();
  report.ms = Math.round(performance.now() - t0);
  return report;
}

export function preloadSpec(
  spec: PreloadSpec,
  onProgress?: (done: number, total: number) => void,
): Promise<PreloadReport> {
  return warmAll(spec.sounds.flatMap(valuesOfSpec), onProgress);
}

interface QueryablePattern {
  queryArc(begin: number, end: number, controls?: Record<string, unknown>): Strudel.Hap[];
}

/**
 * The exact (s, bank, n, note) values a pattern triggers in `[from, to)` cycles, earliest onset first. A query
 * lists haps voice by voice (a stack's layers in order); warmed in that order, a chunk's first new melody note
 * waited behind every drum, chord and pad file the later bars bring, and played before it was decoded.
 */
export function valuesOfPattern(pattern: QueryablePattern, from: number, to: number): HapValue[] {
  const out: { at: number; v: HapValue }[] = [];
  for (const hap of pattern.queryArc(from, to)) {
    if (!hap.hasOnset()) continue;
    const v = hap.value;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push({ at: Number((hap.whole ?? hap.part).begin.valueOf()), v: v as HapValue });
    }
  }
  return out.sort((a, b) => a.at - b.at).map((x) => x.v);
}

/** Exact preload: query the pattern and warm precisely the combinations it will trigger. */
export function preloadPattern(pattern: QueryablePattern, from = 0, to = 2): Promise<PreloadReport> {
  let values: HapValue[] = [];
  try {
    values = valuesOfPattern(pattern, from, to);
  } catch {
    // A query error is reported by the evaluation itself; nothing to warm.
  }
  return warmAll(values);
}

/**
 * Bars a long piece is warmed ahead after the first two. Wave 6: the Core Finale single (CF-A) is at least two
 * minutes with no upper limit in its brief; 256 bars is over six minutes at 160 BPM and four at 240, so the bridge,
 * the lift and the last chorus of any song a learner writes are decoded before they play. (Wave 5: 128.)
 */
export const WARM_AHEAD_BARS = 256;
/** Cycles queried per step of a warm-ahead (each step yields to the event loop). */
export const WARM_AHEAD_CHUNK = 8;

export interface WarmAhead {
  /** Stops after the step in flight (a new evaluation, a new load, dispose). */
  cancel(): void;
  /** Resolves with what was warmed (never rejects), when finished or cancelled. */
  readonly done: Promise<PreloadReport & { cycles: number; cancelled: boolean }>;
}

/**
 * Warms the rest of a long piece in the background, in order: `[from, to)` cycles in steps of `chunk`, each step
 * warming only files no earlier step warmed (`fileKeyOf`), earliest onset first. A 90-second song whose chorus
 * brings a crash, a pad or a pitch the first bars never play has it decoded long before bar 17 (Wave 5, C3), without
 * delaying the first note.
 */
export function warmAhead(
  pattern: QueryablePattern,
  from: number,
  to: number,
  opts: { chunk?: number; warm?: (values: readonly HapValue[]) => Promise<PreloadReport> } = {},
): WarmAhead {
  const chunk = Math.max(1, opts.chunk ?? WARM_AHEAD_CHUNK);
  const warm = opts.warm ?? ((values: readonly HapValue[]) => warmAll(values));
  let cancelled = false;
  const seen = new Set<string>();
  const done = (async () => {
    const t0 = performance.now();
    const total = { warmed: 0, synths: 0, missing: new Set<string>(), cycles: 0 };
    for (let c = from; c < to && !cancelled; c += chunk) {
      await new Promise<void>((r) => setTimeout(r, 0));
      if (cancelled) break;
      let values: HapValue[] = [];
      try {
        values = valuesOfPattern(pattern, c, Math.min(to, c + chunk));
      } catch {
        break; // a query error is the evaluation's to report
      }
      const fresh = values.filter((v) => {
        const key = fileKeyOf(v);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      total.cycles = Math.min(to, c + chunk) - from;
      if (fresh.length === 0) continue;
      const r = await warm(fresh);
      total.warmed += r.warmed;
      total.synths += r.synths;
      for (const m of r.missing) total.missing.add(m);
    }
    return {
      warmed: total.warmed,
      synths: total.synths,
      missing: [...total.missing].sort(),
      ms: Math.round(performance.now() - t0),
      cycles: total.cycles,
      cancelled,
    };
  })();
  return {
    cancel() {
      cancelled = true;
    },
    done,
  };
}
