// Oak 2.0 W1 (S1): capture anywhere, the pure part. A capture (a hum, a tapped rhythm, a voice memo) always lands in
// scraps first, as one plain Strudel line the learner can read and change. The engines that turn taps and
// recordings into notation live behind `captureEngines()` (`./engines.ts`); this file only shapes their results.

import type { KeySpec, MeterId, ScrapCreate } from "@oak/api";
import type { HumDraft } from "@oak/pitch";
import { cpmToBpm } from "@oak/theory";
import { draftLine, type HumTarget } from "../transcribe/hum.ts";

/**
 * What a capture starts with when the learner has not captured before: C major, 90 bpm, 4/4. Oak's call, the same
 * values Oak's Blank fills in (`OAK_DEFAULTS` in `../studio/model.ts` lists them). The dialog shows them as fields the
 * learner can change before starting, so a capture never hides a default.
 */
export const DEFAULT_KEY: KeySpec = { tonic: "C", mode: "major" };
export const DEFAULT_BPM = 90;
export const DEFAULT_METER: MeterId = "4/4";

/**
 * How far one gap between taps may sit from the median gap and still count as a steady beat: 25 %. Oak's call,
 * loose, never shown.
 */
const STEADY_GAP = 0.25;
/** The fewest taps that give a tempo. */
const MIN_TAPS = 4;

/**
 * The tempo and the first downbeat of a steady run of taps (seconds): ≥ 4 taps, every gap within 25 % of the
 * median gap; bpm is the mean gap's tempo, rounded to one decimal. `null` when there are too few taps or the gaps
 * are uneven.
 */
export function tempoOfTaps(times: readonly number[]): { bpm: number; downbeat: number } | null {
  if (times.length < MIN_TAPS) return null;
  const t = [...times].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < t.length; i++) gaps.push((t[i] as number) - (t[i - 1] as number));
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  if (!(median > 0)) return null;
  if (gaps.some((g) => Math.abs(g - median) > STEADY_GAP * median)) return null;
  const mean = ((t[t.length - 1] as number) - (t[0] as number)) / gaps.length;
  return { bpm: Math.round(600 / mean) / 10, downbeat: t[0] as number };
}

export type TapDrum = "bd" | "sd" | "hh";

/** A tapped rhythm on one drum as a drums line: `drums: s("sd").struct("x ~ x x")`. */
export function tapScrapBody(
  r: { mini: string; bars: number },
  o: { drum: TapDrum; bpm: number; meter: MeterId },
): ScrapCreate {
  return {
    role: "drums",
    label: "drums",
    code: `drums: s("${o.drum}").struct("${r.mini}")`,
    bpm: o.bpm,
    meter: o.meter,
    key: null,
    sourceKind: "tap",
    sourceRef: null,
  };
}

/** `setcpm(96/4)` → 96: the bpm a tempo line plays in `meter`, rounded to one decimal; `null` when there is none. */
export function bpmOfTempoLine(line: string, meter: MeterId): number | null {
  const m = /set(cpm|cps)\s*\(\s*([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)/i.exec(line);
  if (!m) return null;
  const a = Number(m[2]);
  const b = m[3] === undefined ? 1 : Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const cpm = m[1]?.toLowerCase() === "cps" ? (a / b) * 60 : a / b;
  return Math.round(cpmToBpm(cpm, meter) * 10) / 10;
}

/**
 * A hum draft (live or from a voice memo) as a scrap: `draftLine(draft, target)` with a leading `melody:` written as
 * `mel:` (STYLE §2's label, so `roleOfLabel` reads it as a tune); the role is the tune or the bass, the bpm the
 * draft's tempo line.
 */
export function humScrapBody(
  draft: HumDraft,
  target: HumTarget,
  o: { sourceKind: "hum" | "memo"; meter: MeterId; key: KeySpec },
): ScrapCreate {
  const line = draftLine(draft, target).replace(/^\s*melody\s*:/, "mel:");
  const label = /^([A-Za-z_$][\w$]*)\s*:/.exec(line)?.[1] ?? null;
  return {
    role: target === "bass" ? "bass" : "tune",
    label,
    code: line,
    bpm: bpmOfTempoLine(draft.tempoLine, o.meter),
    meter: o.meter,
    key: o.key,
    sourceKind: o.sourceKind,
    sourceRef: null,
  };
}

/** One channel from many: the average of every channel, sample by sample. */
export function monoOf(buffer: {
  numberOfChannels: number;
  getChannelData(i: number): Float32Array;
  length: number;
}): Float32Array {
  const out = new Float32Array(buffer.length);
  const k = buffer.numberOfChannels;
  if (k <= 0) return out;
  for (let c = 0; c < k; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) + (data[i] ?? 0);
  }
  if (k > 1) for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) / k;
  return out;
}

// --- last capture (localStorage) and the unsaved result (sessionStorage) -------------------------

export interface CaptureSettings {
  key: KeySpec;
  bpm: number;
  meter: MeterId;
  target: HumTarget;
}

export const LAST_CAPTURE_KEY = "oak.capture.last";
export const PENDING_CAPTURE_KEY = "oak.capture.pending";

const DEFAULT_SETTINGS: CaptureSettings = {
  key: DEFAULT_KEY,
  bpm: DEFAULT_BPM,
  meter: DEFAULT_METER,
  target: "melody",
};

/** The learner's last capture settings, else C major, 90, 4/4, a tune. Never throws. */
export function readLastCapture(storage: Pick<Storage, "getItem"> | null): CaptureSettings {
  try {
    const raw = storage?.getItem(LAST_CAPTURE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<CaptureSettings>;
    const key =
      v.key && typeof v.key.tonic === "string" && typeof v.key.mode === "string" ? v.key : DEFAULT_KEY;
    const bpm = typeof v.bpm === "number" && v.bpm >= 40 && v.bpm <= 240 ? v.bpm : DEFAULT_BPM;
    const meter = typeof v.meter === "string" && CAPTURE_METERS.includes(v.meter) ? v.meter : DEFAULT_METER;
    const target = v.target === "bass" ? "bass" : "melody";
    return { key, bpm, meter, target };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeLastCapture(storage: Pick<Storage, "setItem"> | null, s: CaptureSettings): void {
  try {
    storage?.setItem(LAST_CAPTURE_KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: the next capture starts from Oak's values.
  }
}

/** The meters a capture offers (tap needs 2, 3 or 4 beats a bar). */
export const CAPTURE_METERS: readonly MeterId[] = ["4/4", "3/4", "2/4", "6/8"];

/** Beats per bar and tap grid for a meter: 6/8 counts two dotted beats, each split in three. */
export function tapGridOf(meter: MeterId): { beatsPerBar: 2 | 3 | 4; grid: 8 | 12 | 16 } {
  switch (meter) {
    case "3/4":
      return { beatsPerBar: 3, grid: 16 };
    case "2/4":
      return { beatsPerBar: 2, grid: 16 };
    case "6/8":
      return { beatsPerBar: 2, grid: 12 };
    default:
      return { beatsPerBar: 4, grid: 16 };
  }
}

/** An unsaved capture result, kept until saved or discarded. */
export interface PendingCapture {
  body: ScrapCreate;
  to: "scrap" | "sketch";
}

export function readPendingCapture(storage: Pick<Storage, "getItem"> | null): PendingCapture | null {
  try {
    const raw = storage?.getItem(PENDING_CAPTURE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as PendingCapture;
    if (!v || typeof v.body?.code !== "string" || (v.to !== "scrap" && v.to !== "sketch")) return null;
    return v;
  } catch {
    return null;
  }
}

export function writePendingCapture(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  p: PendingCapture | null,
): void {
  try {
    if (p) storage?.setItem(PENDING_CAPTURE_KEY, JSON.stringify(p));
    else storage?.removeItem(PENDING_CAPTURE_KEY);
  } catch {
    // Storage blocked: the result stays on screen until the dialog closes.
  }
}

/** A short title for a sketch made from one capture. */
export function captureSketchTitle(body: Pick<ScrapCreate, "sourceKind">): string {
  return body.sourceKind === "tap"
    ? "Tapped idea"
    : body.sourceKind === "memo"
      ? "Voice memo idea"
      : "Hummed idea";
}
