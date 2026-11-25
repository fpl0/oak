// Original CC0 synthesis for v5. Keep this a separate recipe entry: changing v4's renderers would
// invalidate the existing kit hashes. All noise is seeded; no recording or external patch is used.
import { dB, midiToHz, onset, type Pcm, RATE, rms } from "./audio.ts";
import { SYNTH_KITS } from "./drummachine.ts";
import { biquad, rng } from "./dsp.ts";
import { ROLE_LEVEL_DB } from "./library.ts";
import { levelled, PIANO_RMS400_DB } from "./render.ts";

export type PlainRole = "bass" | "keys" | "lead";
export const PLAIN_RANGES: Record<PlainRole, [number, number]> = {
  bass: [28, 55],
  keys: [48, 84],
  lead: [55, 91],
};
export const PLAIN_STEP = 3;

type Kit = "oak909" | "oak808";
const sec = (seconds: number) => Math.round(seconds * RATE);
const mono = (x: Float32Array): Pcm => ({ sampleRate: RATE, channels: [x] });
const rise = (t: number, seconds: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, t / seconds));

/** Fade at both boundaries; cancel the finite hit's DC without introducing a constant tail. */
function finish(x: Float32Array, attack: number, release: number, dcSeconds: number): Pcm {
  const end = (x.length - 1) / RATE;
  const y = x.map((v, i) => v * rise(i / RATE, attack) * rise(end - i / RATE, release));
  const support = Math.min(y.length, sec(dcSeconds));
  let sum = 0;
  for (const v of y) sum += v;
  // A compact Hann correction keeps endpoints at zero and leaves the settled kick tail untouched.
  for (let i = 0; i < support; i++) {
    const w = 1 - Math.cos((2 * Math.PI * i) / (support - 1));
    y[i] = (y[i] as number) - (sum * w) / (support - 1);
  }
  y[0] = 0;
  y[y.length - 1] = 0;
  return mono(y);
}

/**
 * Plain writing placeholders: bass stands in for a sub/electric bass, keys for a soft electric piano,
 * lead for a rounded triangle lead. No vibrato, chorus, filter sweep or reverb. The default 2.5 seconds
 * gives measureCents its full analysis window, including at the bottom of the bass range.
 */
export function renderPlain(role: PlainRole, midi: number, seconds = 2.5): Pcm {
  if (!Number.isFinite(midi) || !Number.isFinite(seconds) || seconds < 0.6)
    throw new RangeError("plain notes need a finite MIDI pitch and at least 0.6 seconds");
  const hz = midiToHz(midi);
  const x = new Float32Array(sec(seconds));
  for (let i = 0; i < x.length; i++) {
    const t = i / RATE;
    const ph = 2 * Math.PI * hz * t;
    if (role === "bass") x[i] = Math.sin(ph) + 0.1 * Math.sin(2 * ph);
    else if (role === "keys")
      x[i] = Math.sin(ph) * Math.exp(-t / 0.85) + 0.22 * Math.sin(2 * ph) * Math.exp(-t / 0.3);
    else x[i] = Math.sin(ph) - Math.sin(3 * ph) / 9 + Math.sin(5 * ph) / 25;
  }
  return levelled(finish(x, 0.004, 0.15, seconds), PIANO_RMS400_DB, 400);
}

/** C1 remains the root: the short glide is over before the measured tail. */
export function renderTunedKick(): { pcm: Pcm; rootMidi: number } {
  const rootMidi = 24;
  const hz = midiToHz(rootMidi);
  const x = new Float32Array(sec(0.22));
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / RATE;
    ph += (2 * Math.PI * (hz + (120 - hz) * Math.exp(-t / 0.004))) / RATE;
    // Oak's call: hold the body for level/headroom, then a 14 ms exponential clears the bass's next
    // sixteenth at 100 BPM (150 ms). A conventional long falling sine would mask that next note.
    x[i] = Math.sin(ph) * Math.exp(-Math.max(0, t - 0.06) / 0.014);
  }
  return { pcm: levelled(finish(x, 0.0008, 0.01, 0.06), ROLE_LEVEL_DB.bd), rootMidi };
}

/**
 * For a settled, single sine partial only, not a general polyphonic pitch detector. Interpolated
 * same-direction zero-crossing periods avoid a short DFT's broad peak and are insensitive to a
 * positive decay envelope. Both polarities let a 50 ms C1 window supply a complete period. Reject
 * inconsistent periods and out-of-range input rather than guessing; the search is not tied to ±60 c.
 */
export function settledCents(p: Pcm, midi: number, fromFrame: number, toFrame: number): number | null {
  const x = p.channels[0];
  if (
    p.channels.length !== 1 ||
    !x ||
    !Number.isFinite(midi) ||
    !Number.isFinite(p.sampleRate) ||
    p.sampleRate <= 0 ||
    !Number.isInteger(fromFrame) ||
    !Number.isInteger(toFrame) ||
    fromFrame < 0 ||
    toFrame > x.length ||
    toFrame - fromFrame < 3
  )
    return null;
  const last: (number | undefined)[] = [undefined, undefined];
  const periods: number[] = [];
  for (let i = fromFrame + 1; i < toFrame; i++) {
    const a = x[i - 1] as number;
    const b = x[i] as number;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const direction = a <= 0 && b > 0 ? 0 : a >= 0 && b < 0 ? 1 : -1;
    if (direction < 0) continue;
    const crossing = i - 1 - a / (b - a);
    const previous = last[direction];
    if (previous !== undefined) periods.push(crossing - previous);
    last[direction] = crossing;
  }
  if (!periods.length) return null;
  const period = periods.reduce((sum, v) => sum + v, 0) / periods.length;
  if (periods.some((v) => Math.abs(v / period - 1) > 0.01)) return null;
  return 1200 * Math.log2(p.sampleRate / period / midiToHz(midi));
}

function noise(n: number, seed: number): Float32Array {
  const r = rng(seed);
  return Float32Array.from({ length: n }, () => r() * 2 - 1);
}

// The kits' six-square metal circuit, reproduced here because drummachine.ts keeps it private.
// Editing that file to export it would change v4 recipe hashes. These are synthesized oscillators.
function metal(n: number, ratio = 1): Float32Array {
  const frequencies = [205.3, 304.4, 369.6, 522.7, 540, 800];
  return Float32Array.from({ length: n }, (_, i) => {
    let sum = 0;
    for (const [k, f] of frequencies.entries())
      sum += ((i * f * ratio) / RATE + k * 0.137) % 1 < 0.5 ? 1 : -1;
    return sum / frequencies.length;
  });
}

export function renderHatPair(kit: Kit): [Pcm, Pcm] {
  const is909 = kit === "oak909";
  const tau = is909 ? 0.045 : 0.035;
  const stroke = (hand: number): Pcm => {
    const n = sec(tau * 5 + 0.02);
    const nz = noise(n, (is909 ? 31 : 91) + hand);
    let x: Float32Array = metal(n).map((v, i) => v + (nz[i] as number) * (is909 ? 0.35 : 0.1));
    // Same circuit and decay, a small fixed brightness difference, independent seeds per hand.
    x = biquad(x, "bp", (is909 ? 9500 : 3440) * (1 + hand * 0.025), is909 ? 0.9 : 1.1);
    x = biquad(x, "hp", (is909 ? 7000 : 7100) * (1 + hand * 0.02), is909 ? 0.7 : 0.8);
    x = x.map((v, i) => v * Math.exp(-i / RATE / tau));
    return levelled(finish(x, is909 ? 0.0005 : 0.0004, 0.015, 0.02), ROLE_LEVEL_DB.hh);
  };
  return [stroke(0), stroke(1)];
}

export function renderGhost(kit: Kit, role: "sd" | "hh"): Pcm {
  const voice = SYNTH_KITS[kit][role]?.[0];
  if (!voice) throw new Error(`missing synthesized voice: ${kit} ${role}`);
  const loud = levelled(mono(voice()), ROLE_LEVEL_DB[role]);
  // The 808 snare hits the peak ceiling before reaching the nominal role RMS. Reference the actual
  // loud stroke so its ghost is still 10 dB down, rather than only 7.77 dB down from that capped hit.
  const target = dB(rms(loud, onset(loud), sec(0.1))) - 10;
  const cut = role === "sd" ? 1400 : 3200;
  let x = biquad(biquad(voice(), "lp", cut), "lp", cut);
  // Oak's deliberately loose soft-stroke bounds: 8–14 dB down, ≥15% darker, ≥20% shorter.
  // Less high-frequency excitation and faster damping model a soft strike; gain alone cannot.
  x = x.map((v, i) => v * Math.exp(-i / RATE / (role === "sd" ? 0.03 : 0.012)));
  return levelled(finish(x, 0.0008, 0.015, 0.025), target);
}

export function renderHandPerc(role: "sh" | "tb"): Pcm {
  const shaker = role === "sh";
  const n = sec(shaker ? 0.18 : 0.6);
  const nz = noise(n, shaker ? 501 : 502);
  let x = shaker ? nz : metal(n, 1.17).map((v, i) => v + (nz[i] as number) * 0.25);
  x = biquad(x, "hp", shaker ? 4500 : 3000, 0.7);
  x = biquad(x, "bp", shaker ? 8500 : 6500, 0.7);
  x = x.map((v, i) => v * Math.exp(-i / RATE / (shaker ? 0.025 : 0.085)));
  return levelled(finish(x, shaker ? 0.002 : 0.0008, 0.02, 0.025), ROLE_LEVEL_DB[role]);
}

export const V5_SYNTH_CREDITS: { name: string; licence: "CC0-1.0"; author: "Oak"; note: string }[] = [
  { name: "plainbass", note: "Original sine bass with a quiet second harmonic." },
  { name: "plainkeys", note: "Original decaying two-partial electric-piano-like tone." },
  { name: "plainlead", note: "Original rounded, three-partial triangle lead." },
  { name: "tkick", note: "Original C1 sine kick with a short glide and damped tail." },
  { name: "oak909-hh-pair", note: "Original seeded alternate-hand strokes of Oak's 909 metal circuit." },
  { name: "oak808-hh-pair", note: "Original seeded alternate-hand strokes of Oak's 808 metal circuit." },
  { name: "oak909-sd-ghost", note: "Original soft stroke of Oak's synthesized 909 snare." },
  { name: "oak909-hh-ghost", note: "Original soft stroke of Oak's synthesized 909 hat." },
  { name: "oak808-sd-ghost", note: "Original soft stroke of Oak's synthesized 808 snare." },
  { name: "oak808-hh-ghost", note: "Original soft stroke of Oak's synthesized 808 hat." },
  { name: "oak909-sh", note: "Original seeded filtered-noise shaker." },
  { name: "oak909-tb", note: "Original synthesized metal-and-noise tambourine." },
].map((entry) => ({ ...entry, licence: "CC0-1.0", author: "Oak" }));
