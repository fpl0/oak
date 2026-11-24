// Oak's own analog-style drum machines, `.bank("oak909")` and `.bank("oak808")`. Every hit is computed here
// from the published circuit ideas of the classic machines (a sine with a falling pitch for the kick; two
// tones and filtered noise for the snare; six detuned square waves through band-pass filters for the
// metallic hats and cymbals; staggered noise bursts for the clap), so the sounds are Oak's own and released
// CC0. No sample of any machine is used. Deterministic: seeded noise only.

import { RATE } from "./audio.ts";
import type { Pcm } from "./brk.ts";
import { biquad, rng, saturate } from "./dsp.ts";
import type { DrumRole } from "./library.ts";

const sec = (s: number) => Math.round(s * RATE);

/** A sine (or triangle-ish when `shape` > 0) whose frequency glides from `f0` to `f1` with time constant `tp`. */
function sweep(n: number, f0: number, f1: number, tp: number, shape = 0): Float32Array {
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = f1 + (f0 - f1) * Math.exp(-t / tp);
    ph += (2 * Math.PI * f) / RATE;
    const s = Math.sin(ph);
    x[i] = shape > 0 ? Math.tanh(s * (1 + shape * 3)) / Math.tanh(1 + shape * 3) : s;
  }
  return x;
}

function noise(n: number, seed: number): Float32Array {
  const r = rng(seed);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}

/** Multiplies by an envelope given as a function of time. */
function shape(x: Float32Array, f: (t: number) => number): Float32Array {
  return x.map((v, i) => v * f(i / RATE));
}

const add = (...xs: Float32Array[]): Float32Array => {
  const n = Math.max(...xs.map((x) => x.length));
  const out = new Float32Array(n);
  for (const x of xs) for (let i = 0; i < x.length; i++) out[i] = (out[i] as number) + (x[i] as number);
  return out;
};

const att = (a: number) => (t: number) => Math.min(1, t / a);
const dec = (tau: number) => (t: number) => Math.exp(-t / tau);

/** The six square oscillators of the 808/606 metal section (Hz), phases fixed. */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
function metal(n: number, ratio = 1): Float32Array {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < METAL.length; k++) {
      const f = (METAL[k] as number) * ratio;
      s += ((i * f) / RATE + k * 0.137) % 1 < 0.5 ? 1 : -1;
    }
    x[i] = s / METAL.length;
  }
  return x;
}

function clapBursts(n: number, seed: number, bursts: number[], tail: number, bp: number): Float32Array {
  let x = noise(n, seed);
  x = biquad(x, "bp", bp, 1.2);
  x = biquad(x, "hp", 600, 0.7);
  return shape(x, (t) => {
    let e = 0;
    for (const b of bursts) if (t >= b) e = Math.max(e, Math.exp(-(t - b) / 0.009));
    const last = bursts[bursts.length - 1] as number;
    if (t >= last) e = Math.max(e, 0.75 * Math.exp(-(t - last) / tail));
    return e;
  });
}

const mono = (x: Float32Array): Pcm => ({ sampleRate: RATE, channels: [x] });

/** One drum hit of a synthesised kit (the variants of a role are in `n` order; one velocity layer each). */
type Voice = () => Float32Array;

const KIT909: Partial<Record<DrumRole, Voice[]>> = {
  bd: [() => kick909(0.32, 2.2, 1), () => kick909(0.45, 1.8, 2), () => kick909(0.22, 2.8, 3)],
  sd: [
    () => snare909(185, 330, 0.11, 0.18, 0.55, 11),
    () => snare909(200, 350, 0.09, 0.22, 0.75, 12),
    () => snare909(170, 310, 0.14, 0.14, 0.4, 13),
  ],
  cp: [
    () => clapBursts(sec(0.5), 21, [0, 0.011, 0.023, 0.034], 0.12, 1150),
    () => clapBursts(sec(0.6), 22, [0, 0.009, 0.019, 0.031], 0.17, 1000),
  ],
  hh: [() => hat(0.045, 1, 31), () => hat(0.07, 1.04, 32)],
  oh: [() => hat(0.32, 1, 33), () => hat(0.5, 1.04, 34)],
  rd: [() => cymbal(1.4, 1.42, 5200, 41)],
  cr: [() => cymbal(1.9, 1.18, 4200, 42, 0.5)],
  lt: [() => tom(82, 0.38, 51)],
  mt: [() => tom(118, 0.32, 52)],
  ht: [() => tom(165, 0.27, 53)],
  rim: [() => rim(1700, 480, 61)],
};

const KIT808: Partial<Record<DrumRole, Voice[]>> = {
  bd: [() => kick808(1.1, 49, 0), () => kick808(0.45, 52, 0.2), () => kick808(1.6, 45, 0.1)],
  sd: [
    () => snare808(238, 476, 0.09, 0.15, 0.6, 71),
    () => snare808(225, 450, 0.12, 0.2, 0.8, 72),
    () => snare808(250, 500, 0.07, 0.11, 0.45, 73),
  ],
  cp: [() => clapBursts(sec(0.7), 81, [0, 0.01, 0.02, 0.031], 0.22, 1000)],
  hh: [() => hat808(0.035, 91), () => hat808(0.055, 92)],
  oh: [() => hat808(0.28, 93), () => hat808(0.45, 94)],
  cb: [() => cowbell()],
  rim: [() => rim(1650, 500, 101)],
  lt: [() => tom808(90, 0.5)],
  mt: [() => tom808(130, 0.4)],
  ht: [() => tom808(180, 0.32)],
  sh: [() => maracas(111)],
  cr: [() => cymbal(1.6, 1.0, 4500, 121, 0.6)],
};

function kick909(decay: number, drop: number, seed: number): Float32Array {
  const n = sec(decay * 3.2);
  const body = shape(sweep(n, 52 * drop * 1.6, 52, 0.022, 0.25), (t) => att(0.0008)(t) * dec(decay)(t));
  const click = shape(biquad(noise(sec(0.02), seed), "hp", 1800, 0.7), dec(0.003));
  return saturate(
    add(
      body,
      click.map((v) => v * 0.35),
    ),
    1.4,
  );
}

function kick808(decay: number, f: number, click: number): Float32Array {
  const n = sec(Math.min(3, decay * 3.5));
  const body = shape(sweep(n, f * 1.35, f, 0.03), (t) => att(0.001)(t) * dec(decay)(t));
  const tick = shape(sweep(sec(0.012), 1200, 800, 0.004), dec(0.0025));
  return saturate(
    add(
      body,
      tick.map((v) => v * click),
    ),
    1.1,
  );
}

function snare909(
  f1: number,
  f2: number,
  toneTau: number,
  noiseTau: number,
  snappy: number,
  seed: number,
): Float32Array {
  const n = sec(0.55);
  const tone = add(
    shape(sweep(n, f1 * 1.5, f1, 0.012), dec(toneTau)),
    shape(sweep(n, f2 * 1.4, f2, 0.01), dec(toneTau * 0.7)).map((v) => v * 0.6),
  );
  let nz = noise(n, seed);
  nz = biquad(nz, "hp", 1600, 0.7);
  nz = biquad(nz, "lp", 9000, 0.7);
  const noisy = shape(nz, dec(noiseTau));
  return saturate(
    add(
      tone.map((v) => v * 0.8),
      noisy.map((v) => v * snappy),
    ),
    1.3,
  );
}

function snare808(
  f1: number,
  f2: number,
  toneTau: number,
  noiseTau: number,
  snappy: number,
  seed: number,
): Float32Array {
  const n = sec(0.45);
  const tone = add(
    shape(sweep(n, f1, f1, 1), dec(toneTau)),
    shape(sweep(n, f2, f2, 1), dec(toneTau * 0.6)).map((v) => v * 0.5),
  );
  let nz = noise(n, seed);
  nz = biquad(nz, "hp", 2200, 0.7);
  const noisy = shape(nz, dec(noiseTau));
  return add(
    tone.map((v) => v * 0.85),
    noisy.map((v) => v * snappy),
  );
}

function hat(tau: number, ratio: number, seed: number): Float32Array {
  const n = sec(Math.min(2, tau * 5 + 0.02));
  let x = add(
    metal(n, ratio),
    noise(n, seed).map((v) => v * 0.35),
  );
  x = biquad(x, "bp", 9500, 0.9);
  x = biquad(x, "hp", 7000, 0.7);
  return shape(x, (t) => att(0.0005)(t) * dec(tau)(t));
}

function hat808(tau: number, seed: number): Float32Array {
  const n = sec(Math.min(2, tau * 5 + 0.02));
  let x = add(
    metal(n),
    noise(n, seed).map((v) => v * 0.1),
  );
  x = biquad(x, "bp", 3440, 1.1);
  x = biquad(x, "hp", 7100, 0.8);
  return shape(x, (t) => att(0.0004)(t) * dec(tau)(t));
}

function cymbal(tau: number, ratio: number, bp: number, seed: number, wash = 0.25): Float32Array {
  const n = sec(Math.min(4, tau * 2.8));
  let x = add(
    metal(n, ratio),
    noise(n, seed).map((v) => v * wash),
  );
  x = biquad(x, "bp", bp, 0.6);
  x = biquad(x, "hp", 3000, 0.7);
  return shape(x, (t) => att(0.001)(t) * (0.6 * dec(tau)(t) + 0.4 * dec(tau * 0.15)(t)));
}

function tom(f: number, tau: number, seed: number): Float32Array {
  const n = sec(tau * 3.5);
  const body = shape(sweep(n, f * 1.6, f, 0.03, 0.1), (t) => att(0.0008)(t) * dec(tau)(t));
  const nz = shape(biquad(noise(n, seed), "bp", f * 6, 0.8), dec(0.03));
  return saturate(
    add(
      body,
      nz.map((v) => v * 0.25),
    ),
    1.2,
  );
}

function tom808(f: number, tau: number): Float32Array {
  const n = sec(tau * 3.5);
  return shape(sweep(n, f * 1.12, f, 0.05), (t) => att(0.001)(t) * dec(tau)(t));
}

function rim(f1: number, f2: number, seed: number): Float32Array {
  const n = sec(0.08);
  const t1 = shape(sweep(n, f1, f1, 1), dec(0.006));
  const t2 = shape(sweep(n, f2, f2, 1), dec(0.01));
  const nz = shape(biquad(noise(n, seed), "hp", 3000, 0.7), dec(0.004));
  return add(
    t1.map((v) => v * 0.7),
    t2.map((v) => v * 0.5),
    nz.map((v) => v * 0.4),
  );
}

function cowbell(): Float32Array {
  const n = sec(0.6);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i * 540) / RATE;
    const b = (i * 800) / RATE;
    x[i] = ((a % 1 < 0.5 ? 1 : -1) + (b % 1 < 0.5 ? 1 : -1)) / 2;
  }
  const y = biquad(x, "bp", 2640, 3);
  return shape(y, (t) => att(0.0005)(t) * (t < 0.01 ? 1 : 0.6 * dec(0.12)(t - 0.01) + 0.4 * dec(0.015)(t)));
}

function maracas(seed: number): Float32Array {
  const n = sec(0.08);
  return shape(biquad(noise(n, seed), "hp", 5000, 0.7), (t) => att(0.002)(t) * dec(0.018)(t));
}

export const SYNTH_KITS: Record<"oak909" | "oak808", Partial<Record<DrumRole, Voice[]>>> = {
  oak909: KIT909,
  oak808: KIT808,
};

/** Every hit of a synthesised kit, mono at 44.1 kHz, peak-normalised to −1 dBFS (levels are set later). */
export function renderSynthKit(kit: keyof typeof SYNTH_KITS): Partial<Record<DrumRole, Pcm[]>> {
  const out: Partial<Record<DrumRole, Pcm[]>> = {};
  for (const [role, voices] of Object.entries(SYNTH_KITS[kit]) as [DrumRole, Voice[]][]) {
    out[role] = voices.map((v) => {
      const x = v();
      let p = 0;
      for (const s of x) p = Math.max(p, Math.abs(s));
      const g = p > 0 ? 10 ** (-1 / 20) / p : 1;
      return mono(x.map((s) => s * g));
    });
  }
  return out;
}
