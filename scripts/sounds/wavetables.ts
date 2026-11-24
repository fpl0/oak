// Oak's morphing wavetables (`s("wt_morph")` ...): 64 frames of 2048 samples each, the frame length
// superdough's wavetable engine assumes for tables loaded from a sample map. Each frame is one cycle,
// built additively from band-limited harmonics, so `wt` (and `wtenv`, `wtrate`) sweeps a timbre that
// moves. Computed here, released CC0. Deterministic: fixed harmonic tables.

import type { Pcm } from "./brk.ts";

export const WT_FRAME = 2048;
export const WT_FRAMES = 64;
const HARMONICS = 96;

/** One cycle from harmonic amplitudes (sine phase), normalised to a 0.9 peak. */
function cycle(amp: (k: number) => number, phase: (k: number) => number = () => 0): Float32Array {
  const x = new Float32Array(WT_FRAME);
  for (let k = 1; k <= HARMONICS; k++) {
    const a = amp(k);
    if (a === 0) continue;
    const p = phase(k);
    for (let i = 0; i < WT_FRAME; i++)
      x[i] = (x[i] as number) + a * Math.sin((2 * Math.PI * k * i) / WT_FRAME + p);
  }
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  return m > 0 ? x.map((v) => (v * 0.9) / m) : x;
}

/** Smooth roll-off above harmonic 64, so high notes alias less. */
const rolloff = (k: number) => (k <= 48 ? 1 : Math.max(0, 1 - (k - 48) / 48));

type Table = (f: number) => Float32Array;

export const OAK_TABLES: Record<string, Table> = {
  // saw -> square: the even harmonics fade out
  wt_morph: (f) => cycle((k) => (rolloff(k) / k) * (k % 2 === 0 ? 1 - f : 1)),
  // pulse width from 50% down to 5%
  wt_pwm: (f) => {
    const d = 0.5 - 0.45 * f;
    return cycle(
      (k) => (rolloff(k) * Math.abs(Math.sin(Math.PI * k * d))) / k,
      (k) => (Math.sin(Math.PI * k * d) < 0 ? Math.PI : 0),
    );
  },
  // drawbars pulled out one by one (8', 4', 2 2/3', 2', 1 3/5', 1 1/3', 1')
  wt_drawbar: (f) => {
    const bars: [number, number][] = [
      [1, 1],
      [2, 0.8],
      [3, 0.6],
      [4, 0.6],
      [5, 0.4],
      [6, 0.4],
      [8, 0.35],
    ];
    const open = f * bars.length;
    return cycle((k) => {
      const i = bars.findIndex(([h]) => h === k);
      if (i < 0) return 0;
      const amount = Math.max(0, Math.min(1, open - i + (i === 0 ? 1 : 0)));
      return (bars[i] as [number, number])[1] * amount;
    });
  },
  // two-operator FM, ratio 1:1, index 0 -> 6 (the harmonics are the Bessel weights)
  wt_fmsweep: (f) => {
    const index = 6 * f;
    const x = new Float32Array(WT_FRAME);
    for (let i = 0; i < WT_FRAME; i++) {
      const t = (2 * Math.PI * i) / WT_FRAME;
      x[i] = Math.sin(t + index * Math.sin(t));
    }
    let m = 0;
    for (const v of x) m = Math.max(m, Math.abs(v));
    return x.map((v) => (v * 0.9) / m);
  },
};

/** The whole table: WT_FRAMES frames back to back, mono. */
export function renderTable(name: string): Pcm {
  const table = OAK_TABLES[name];
  if (!table) throw new Error(`wavetables: no table ${name}`);
  const out = new Float32Array(WT_FRAME * WT_FRAMES);
  for (let f = 0; f < WT_FRAMES; f++) out.set(table(f / (WT_FRAMES - 1)), f * WT_FRAME);
  return { sampleRate: 44100, channels: [out] };
}
