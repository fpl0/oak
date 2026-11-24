// Deterministic DSP for Oak's rendered sounds (drum machines, breaks, lo-fi chain, tape bed). No randomness
// that is not seeded, no time-dependent state: the same call gives the same samples.

import { frames, RATE, resampleStep } from "./audio.ts";
import type { Pcm } from "./brk.ts";

/** mulberry32: a small seeded PRNG, uniform in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FilterKind = "lp" | "hp" | "bp" | "peak";

/** RBJ cookbook biquad, applied in place over a mono buffer (Direct Form I). */
export function biquad(
  x: Float32Array,
  kind: FilterKind,
  hz: number,
  q = Math.SQRT1_2,
  gainDb = 0,
  rate = RATE,
): Float32Array {
  const w = (2 * Math.PI * Math.min(hz, rate * 0.49)) / rate;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const alpha = sw / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0: number;
  let b1: number;
  let b2: number;
  let a0: number;
  let a1: number;
  let a2: number;
  if (kind === "lp") {
    b0 = (1 - cw) / 2;
    b1 = 1 - cw;
    b2 = (1 - cw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cw;
    a2 = 1 - alpha;
  } else if (kind === "hp") {
    b0 = (1 + cw) / 2;
    b1 = -(1 + cw);
    b2 = (1 + cw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cw;
    a2 = 1 - alpha;
  } else if (kind === "bp") {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cw;
    a2 = 1 - alpha;
  } else {
    b0 = 1 + alpha * A;
    b1 = -2 * cw;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cw;
    a2 = 1 - alpha / A;
  }
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number;
    const y = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    out[i] = y;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = y;
  }
  return out;
}

export const env = {
  /** Exponential decay to 1/e at `tau` seconds. */
  exp: (t: number, tau: number) => Math.exp(-t / tau),
};

/** Soft saturation: tanh with makeup so small signals keep their level. */
export function saturate(x: Float32Array, drive: number): Float32Array {
  const k = Math.tanh(drive);
  return x.map((v) => Math.tanh(v * drive) / k);
}

/** Quantise to `bits` (no dither) and hold every `hold` samples (a simple sampler-style rate reduction). */
export function crush(x: Float32Array, bits: number, hold: number): Float32Array {
  const steps = 2 ** (bits - 1);
  const out = new Float32Array(x.length);
  let held = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % hold === 0) held = Math.round((x[i] as number) * steps) / steps;
    out[i] = held;
  }
  return out;
}

/**
 * Oak's lo-fi chain (lofikit, brkboombap, brklofi): tape-style saturation, 12-bit quantisation, a
 * sample-and-hold of two frames (the aliasing of a 22 kHz sampler), a 9 kHz low-pass and a gentle low-mid
 * bump. Mono or stereo; rate unchanged.
 */
export function lofi(p: Pcm, drive = 1.6): Pcm {
  return {
    sampleRate: p.sampleRate,
    channels: p.channels.map((c) => {
      let x = saturate(c, drive);
      x = crush(x, 12, 2);
      x = biquad(x, "lp", 9000, 0.6, 0, p.sampleRate);
      x = biquad(x, "peak", 180, 0.8, 2.5, p.sampleRate);
      return x;
    }),
  };
}

/** Halves the rate (44.1 -> 22.05 kHz), band-limited. */
export const halfRate = (p: Pcm): Pcm => resampleStep(p, 2, p.sampleRate / 2);

/**
 * A small stereo room (Schroeder: four combs, two all-passes per side, fixed and slightly different
 * delays left and right). Returns the wet signal only, as long as the input.
 */
export function room(p: Pcm, size = 0.5, damp = 0.4): Pcm {
  const rate = p.sampleRate;
  const n = frames(p);
  const inMono = new Float32Array(n);
  for (const c of p.channels)
    for (let i = 0; i < n; i++) inMono[i] = (inMono[i] as number) + (c[i] as number) / p.channels.length;
  const side = (combs: number[], aps: number[]) => {
    const out = new Float32Array(n);
    for (const ms of combs) {
      const d = Math.round((ms / 1000) * rate);
      const buf = new Float32Array(d);
      let idx = 0;
      let lp = 0;
      const fb = 0.7 + 0.25 * size;
      for (let i = 0; i < n; i++) {
        const y = buf[idx] as number;
        lp = y * (1 - damp) + lp * damp;
        buf[idx] = (inMono[i] as number) + lp * fb;
        idx = (idx + 1) % d;
        out[i] = (out[i] as number) + y / combs.length;
      }
    }
    let x = out;
    for (const ms of aps) {
      const d = Math.round((ms / 1000) * rate);
      const buf = new Float32Array(d);
      let idx = 0;
      const y = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const b = buf[idx] as number;
        const v = (x[i] as number) + b * 0.5;
        y[i] = b - v * 0.5;
        buf[idx] = v;
        idx = (idx + 1) % d;
      }
      x = y;
    }
    return x;
  };
  return {
    sampleRate: rate,
    channels: [side([29.7, 37.1, 41.1, 43.7], [5.0, 1.7]), side([30.5, 36.3, 40.3, 44.9], [5.3, 1.9])],
  };
}

/** Oak's tape bed: pink-ish hiss with a slow wow in its tone and a faint 50 Hz hum, seamless at the loop. */
export function tapeBed(seconds: number, seed = 7): Pcm {
  const n = Math.round(seconds * RATE);
  const ch = [0, 1].map((side) => {
    const r = rng(seed + side * 101);
    // Paul Kellet's economical pink filter
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
    let y = biquad(x, "hp", 300, 0.7);
    y = biquad(y, "lp", 7500, 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const wow = 1 + 0.15 * Math.sin(2 * Math.PI * 0.5 * t + side);
      y[i] = (y[i] as number) * wow + 0.004 * Math.sin(2 * Math.PI * 50 * t);
    }
    // crossfade the last 0.5 s into the first, so the bed loops without a seam
    const xf = Math.round(0.5 * RATE);
    const out = y.slice(0, n - xf);
    for (let i = 0; i < xf; i++) {
      const a = i / xf;
      out[i] = (y[i] as number) * a + (y[n - xf + i] as number) * (1 - a);
    }
    return out;
  });
  return { sampleRate: RATE, channels: ch };
}
