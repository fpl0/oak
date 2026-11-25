// Pure sound-quality measurements for the sound pack (Wave 3): the fundamental of a rendered note (is the alias
// in tune, in the octave it claims?), a click detector for note ends and sample ends, and BS.1770 loudness
// (are the aliases loudness-matched?). Renders come from the audibility harness (`render-frame.ts`).
import type { Stereo } from "./metrics.ts";

export { loudness, peakDb } from "@oak/audio/loudness";

export const mono = (r: Stereo): Float32Array => {
  const out = new Float32Array(r.left.length);
  for (let i = 0; i < out.length; i++) out[i] = ((r.left[i] as number) + (r.right[i] as number)) / 2;
  return out;
};

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
/** Signed distance in cents from `ref` to `hz`. */
export const cents = (hz: number, ref: number): number => 1200 * Math.log2(hz / ref);

export interface PitchEstimate {
  hz: number;
  /** 1 − the YIN dip: 1 is perfectly periodic. */
  clarity: number;
}

/**
 * YIN (de Cheveigné & Kawahara 2002) on one window: the cumulative-mean-normalised difference, the first dip
 * under `threshold` (so an octave-up error needs a real periodicity there), parabolic interpolation.
 */
export function yin(
  x: Float32Array,
  sampleRate: number,
  from: number,
  size: number,
  minHz = 30,
  maxHz = 2000,
  threshold = 0.15,
): PitchEstimate | null {
  const maxLag = Math.min(Math.floor(sampleRate / minHz), size - 1);
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  if (from + size + maxLag > x.length) return null;
  const d = new Float64Array(maxLag + 2);
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i < size; i++) {
      const v = (x[from + i] as number) - (x[from + i + lag] as number);
      s += v * v;
    }
    d[lag] = s;
  }
  const cmnd = new Float64Array(maxLag + 2);
  cmnd[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    running += d[lag] as number;
    cmnd[lag] = running > 0 ? ((d[lag] as number) * lag) / running : 1;
  }
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if ((cmnd[lag] as number) < threshold) {
      while (lag + 1 <= maxLag && (cmnd[lag + 1] as number) < (cmnd[lag] as number)) lag++;
      best = lag;
      break;
    }
  }
  if (best < 0) {
    // No dip under the threshold: take the global minimum, reported with its (low) clarity.
    let min = Number.POSITIVE_INFINITY;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if ((cmnd[lag] as number) < min) {
        min = cmnd[lag] as number;
        best = lag;
      }
    }
  }
  const a = cmnd[best - 1] as number;
  const b = cmnd[best] as number;
  const c = cmnd[best + 1] as number;
  const den = a - 2 * b + c;
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
  const period = best + Math.max(-1, Math.min(1, shift));
  return { hz: sampleRate / period, clarity: 1 - b };
}

/**
 * The fundamental of a steady stretch: YIN on `windows` windows from `startSec`, the median of the estimates.
 * Returns null when the stretch is silent.
 */
export function fundamental(
  x: Float32Array,
  sampleRate: number,
  startSec: number,
  opts: { windows?: number; windowSec?: number; hopSec?: number; minHz?: number; maxHz?: number } = {},
): PitchEstimate | null {
  const size = Math.round((opts.windowSec ?? 0.08) * sampleRate);
  const hop = Math.round((opts.hopSec ?? 0.05) * sampleRate);
  const out: PitchEstimate[] = [];
  for (let w = 0; w < (opts.windows ?? 5); w++) {
    const from = Math.round(startSec * sampleRate) + w * hop;
    let energy = 0;
    for (let i = from; i < from + size && i < x.length; i++) energy += (x[i] as number) ** 2;
    if (energy / size < 1e-8) continue;
    const e = yin(x, sampleRate, from, size, opts.minHz, opts.maxHz);
    if (e) out.push(e);
  }
  if (out.length === 0) return null;
  out.sort((p, q) => p.hz - q.hz);
  return out[Math.floor(out.length / 2)] as PitchEstimate;
}

/** Power of a Hann-windowed stretch at one frequency (Goertzel). */
function powerAt(x: Float32Array, fs: number, hz: number, from: number, n: number): number {
  const w = (2 * Math.PI * hz) / fs;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const s0 = (x[from + i] as number) * hann + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

/**
 * The frequency of the first partial near `approxHz`: the spectral peak within ±`spanCents`, found on a
 * 1-cent grid and refined by a parabola through the log power. On a 1 s stretch this resolves a stable
 * partial to a small fraction of a cent, independent of the inharmonic upper partials (a piano's stretch)
 * that bias period-based estimators.
 */
export function partialHz(
  x: Float32Array,
  fs: number,
  approxHz: number,
  fromSec: number,
  sec = 1,
  spanCents = 80,
): number | null {
  const from = Math.round(fromSec * fs);
  const n = Math.min(Math.round(sec * fs), x.length - from);
  if (n < fs * 0.2) return null;
  const grid: number[] = [];
  for (let c = -spanCents; c <= spanCents; c++) grid.push(approxHz * 2 ** (c / 1200));
  const p = grid.map((hz) => powerAt(x, fs, hz, from, n));
  let k = 0;
  for (let i = 1; i < p.length; i++) if ((p[i] as number) > (p[k] as number)) k = i;
  if ((p[k] as number) <= 0) return null;
  if (k === 0 || k === p.length - 1) return grid[k] as number;
  const [a, b, c] = [Math.log(p[k - 1] as number), Math.log(p[k] as number), Math.log(p[k + 1] as number)];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
  return approxHz * 2 ** ((k - spanCents + shift) / 1200);
}

/** Which of the first `upTo` harmonics of `f0` is the strongest (1-based); ties go to the lower one. */
export function strongestHarmonic(
  x: Float32Array,
  fs: number,
  f0: number,
  fromSec: number,
  upTo = 4,
): number {
  const from = Math.round(fromSec * fs);
  const n = Math.min(fs, x.length - from);
  if (n <= 0) return 1;
  let best = 1;
  let bestP = -1;
  for (let k = 1; k <= upTo && k * f0 < fs / 2; k++) {
    const p = powerAt(x, fs, k * f0, from, n);
    if (p > bestP * 1.0001) {
      best = k;
      bestP = p;
    }
  }
  return best;
}

/** RMS of the second difference (the high-frequency content a click is made of) over [from, to). */
function hfRms(x: Float32Array, from: number, to: number): number {
  let s = 0;
  let n = 0;
  for (let i = Math.max(2, from); i < Math.min(x.length, to); i++) {
    const v = (x[i] as number) - 2 * (x[i - 1] as number) + (x[i - 2] as number);
    s += v * v;
    n++;
  }
  return n > 0 ? Math.sqrt(s / n) : 0;
}

export interface ClickScan {
  /** Worst jump: the HF level of a 4 ms window over the HF level of the 30 ms before it, dB. */
  worstDb: number;
  /** Where the worst jump is, seconds. */
  atSec: number;
}

/**
 * Scans for clicks after the attack: a click is a sudden burst of high-frequency energy against the note that
 * precedes it (a sample cut while its waveform is far from zero, a release too short for a low note). Windows
 * whose preceding stretch is below −60 dBFS are skipped (a soft tail after silence is not a click).
 */
export function scanClicks(x: Float32Array, sampleRate: number, fromSec: number, toSec?: number): ClickScan {
  const win = Math.round(0.004 * sampleRate);
  const before = Math.round(0.03 * sampleRate);
  const hop = Math.round(0.001 * sampleRate);
  const end = Math.min(x.length, Math.round((toSec ?? x.length / sampleRate) * sampleRate));
  let worst = { worstDb: Number.NEGATIVE_INFINITY, atSec: 0 };
  for (let i = Math.round(fromSec * sampleRate) + before; i + win <= end; i += hop) {
    let level = 0;
    for (let j = i - before; j < i; j++) level += (x[j] as number) ** 2;
    if (Math.sqrt(level / before) < 0.001) continue;
    const prev = hfRms(x, i - before, i);
    const cur = hfRms(x, i, i + win);
    if (prev <= 0 || cur <= 0) continue;
    const jump = 20 * Math.log10(cur / prev);
    if (jump > worst.worstDb) worst = { worstDb: jump, atSec: i / sampleRate };
  }
  return worst;
}

/**
 * Steadiness of a held tone: the spread (max − min) of the short-term RMS over [fromSec, toSec), in dB. A drone
 * that swells, beats or decays reads high; a steady tone reads under 1 dB.
 */
export function levelSpreadDb(x: Float32Array, fs: number, fromSec: number, toSec: number): number {
  const win = Math.round(0.05 * fs);
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = Math.round(fromSec * fs); i + win <= Math.round(toSec * fs); i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += (x[j] as number) ** 2;
    const v = 10 * Math.log10(s / win + 1e-20);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return hi - lo;
}

/**
 * How unambiguous the octave of a tone is: the fundamental's share of the energy of the first eight harmonics
 * (Goertzel at k·f0). A tone whose 2nd harmonic outweighs the fundamental can be heard an octave up; a share
 * above 0.5 means the fundamental dominates.
 */
export function fundamentalShare(
  x: Float32Array,
  fs: number,
  f0: number,
  fromSec: number,
  sec = 0.5,
): number {
  const from = Math.round(fromSec * fs);
  const n = Math.min(Math.round(sec * fs), x.length - from);
  const power = (hz: number): number => powerAt(x, fs, hz, from, n);
  let total = 0;
  let first = 0;
  for (let k = 1; k <= 8; k++) {
    if (k * f0 >= fs / 2) break;
    const p = power(k * f0);
    if (k === 1) first = p;
    total += p;
  }
  return total > 0 ? first / total : 0;
}
