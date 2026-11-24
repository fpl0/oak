// Audio arithmetic for the sound pack build (mirror.ts): decode, mix, trim, level, retune, encode.
//
// Determinism (docs/spikes.md, "Sound pack v4"): everything here is plain arithmetic on Float32/Float64
// arrays, so the same inputs give the same bytes on the machine that built the lock. Two steps call a
// pinned command-line tool: FLAC sources are decoded with `flac -d` (lossless, so the decoded samples do
// not depend on the flac version) and MP3 files are encoded with `lame` using fixed flags (byte-identical
// across runs; across LAME versions not guaranteed, which is why the lock records the encoder and is the
// source of truth). Drum one-shots, breaks and tables are encoded by Oak's own FLAC writer (flac.ts) or as
// WAV, with no external encoder at all.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeWav, encodeWav, type Pcm } from "./brk.ts";

export type { Pcm };
export { decodeWav, encodeWav };

/** The rate every derived file is written at. */
export const RATE = 44100;

const RIFF = (b: Uint8Array) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
const FLAC = (b: Uint8Array) => b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43;

function run(cmd: string[], stdin: Uint8Array): Uint8Array {
  const p = Bun.spawnSync({ cmd, stdin, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0)
    throw new Error(`${cmd[0]} failed (${p.exitCode}): ${new TextDecoder().decode(p.stderr).slice(0, 400)}`);
  return new Uint8Array(p.stdout);
}

/** Decodes a WAV (in TypeScript) or a FLAC file (lossless `flac -d`) to float PCM. */
export function decodeAudio(bytes: Uint8Array, name = "audio"): Pcm {
  if (RIFF(bytes)) return decodeWav(bytes);
  if (FLAC(bytes)) return decodeWav(run(["flac", "-d", "-c", "-s", "--force", "-"], bytes));
  throw new Error(`${name}: not a WAV or FLAC file`);
}

/** The version line of an external encoder (recorded in the lock). */
export function toolVersion(tool: "lame" | "flac"): string {
  const p = Bun.spawnSync({ cmd: [tool, "--version"], stdout: "pipe", stderr: "pipe" });
  return new TextDecoder().decode(p.stdout).split("\n")[0]?.trim() ?? "";
}

// --- channels and levels ---------------------------------------------------------------------------------

export const frames = (p: Pcm): number => p.channels[0]?.length ?? 0;

/** Channels averaged into one. */
export function mono(p: Pcm): Pcm {
  const n = frames(p);
  if (p.channels.length === 1) return p;
  const out = new Float32Array(n);
  for (const c of p.channels) for (let i = 0; i < n; i++) out[i] = (out[i] as number) + (c[i] as number);
  const k = 1 / p.channels.length;
  for (let i = 0; i < n; i++) out[i] = (out[i] as number) * k;
  return { sampleRate: p.sampleRate, channels: [out] };
}

/** A stereo pair from a mono or stereo buffer (mono is copied to both sides). */
export function stereo(p: Pcm): Pcm {
  if (p.channels.length === 2) return p;
  const m = mono(p).channels[0] as Float32Array;
  return { sampleRate: p.sampleRate, channels: [m, Float32Array.from(m)] };
}

/** Sums buffers (same rate) at fixed linear gains; channel counts follow the widest input. */
export function mix(parts: { pcm: Pcm; gain: number }[]): Pcm {
  const first = parts[0];
  if (!first) throw new Error("mix: nothing to mix");
  const rate = first.pcm.sampleRate;
  const ch = Math.max(...parts.map((p) => p.pcm.channels.length));
  const n = Math.max(...parts.map((p) => frames(p.pcm)));
  const out = Array.from({ length: ch }, () => new Float32Array(n));
  for (const { pcm, gain } of parts) {
    if (pcm.sampleRate !== rate) throw new Error("mix: sample rates differ");
    for (let c = 0; c < ch; c++) {
      const src = pcm.channels[Math.min(c, pcm.channels.length - 1)] as Float32Array;
      const dst = out[c] as Float32Array;
      for (let i = 0; i < src.length; i++) dst[i] = (dst[i] as number) + (src[i] as number) * gain;
    }
  }
  return { sampleRate: rate, channels: out };
}

export function scale(p: Pcm, g: number): Pcm {
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.map((x) => x * g)) };
}

export function peak(p: Pcm): number {
  let m = 0;
  for (const c of p.channels) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i] as number));
  return m;
}

/** RMS over [start, start + len) frames, all channels. */
export function rms(p: Pcm, start = 0, len = frames(p)): number {
  let s = 0;
  let n = 0;
  const end = Math.min(frames(p), start + len);
  for (const c of p.channels)
    for (let i = Math.max(0, start); i < end; i++) {
      const x = c[i] as number;
      s += x * x;
      n++;
    }
  return n ? Math.sqrt(s / n) : 0;
}

export const dB = (x: number): number => 20 * Math.log10(Math.max(x, 1e-12));
export const fromDb = (d: number): number => 10 ** (d / 20);

/** First frame whose level reaches `rel` of the peak (the onset). */
export function onset(p: Pcm, rel = 10 ** (-40 / 20)): number {
  const th = peak(p) * rel;
  const n = frames(p);
  for (let i = 0; i < n; i++) for (const c of p.channels) if (Math.abs(c[i] as number) >= th) return i;
  return 0;
}

export function slice(p: Pcm, start: number, end = frames(p)): Pcm {
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.slice(start, end)) };
}

/**
 * Cuts the silence before the onset (keeping `preMs`), ends the sound where it has decayed below `floorDb`
 * of its peak or at `maxSec`, whichever comes first, and fades the last `fadeMs` out (a cosine), so the
 * sample never clicks when it ends.
 */
export function trim(
  p: Pcm,
  o: { maxSec: number; fadeMs?: number; preMs?: number; floorDb?: number; keepStart?: boolean },
): Pcm {
  const rate = p.sampleRate;
  const start = o.keepStart ? 0 : Math.max(0, onset(p) - Math.round(((o.preMs ?? 1) / 1000) * rate));
  const body = slice(p, start);
  const n = frames(body);
  // the tail: last 10 ms block whose RMS is above the floor
  const floor = peak(body) * fromDb(o.floorDb ?? -60);
  const block = Math.round(rate * 0.01);
  let end = n;
  for (let b = Math.floor(n / block) - 1; b >= 0; b--) {
    if (rms(body, b * block, block) >= floor) {
      end = Math.min(n, (b + 1) * block);
      break;
    }
  }
  end = Math.min(end, Math.round(o.maxSec * rate));
  const out = slice(body, 0, end);
  const fade = Math.min(end, Math.round(((o.fadeMs ?? 30) / 1000) * rate));
  for (const c of out.channels)
    for (let i = 0; i < fade; i++) {
      const at = end - fade + i;
      c[at] = (c[at] as number) * 0.5 * (1 + Math.cos((Math.PI * (i + 1)) / fade));
    }
  return out;
}

/** A short fade-in from the first frame (`ms`), for cut-in material. */
export function fadeIn(p: Pcm, ms: number): Pcm {
  const n = Math.round((ms / 1000) * p.sampleRate);
  const out = { sampleRate: p.sampleRate, channels: p.channels.map((c) => Float32Array.from(c)) };
  for (const c of out.channels) for (let i = 0; i < n && i < c.length; i++) c[i] = (c[i] as number) * (i / n);
  return out;
}

// --- resampling ------------------------------------------------------------------------------------------

const TAPS = 32; // zero crossings each side
const PHASES = 1024;
let kernel: Float64Array | null = null;

/** Blackman-windowed sinc, tabulated (PHASES per zero crossing). */
function sincTable(): Float64Array {
  if (kernel) return kernel;
  const len = TAPS * PHASES + 1;
  const k = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const x = i / PHASES; // 0..TAPS
    const s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.42 + 0.5 * Math.cos((Math.PI * x) / TAPS) + 0.08 * Math.cos((2 * Math.PI * x) / TAPS);
    k[i] = s * w;
  }
  kernel = k;
  return k;
}

/**
 * Reads the input at `step` input frames per output frame (step > 1 shortens and raises the pitch),
 * band-limited when shortening. `outRate` is the rate written into the result. Windowed-sinc
 * interpolation with a tabulated kernel and linear interpolation between table points.
 */
export function resampleStep(p: Pcm, step: number, outRate: number): Pcm {
  const k = sincTable();
  const cutoff = Math.min(1, 1 / step) * 0.97; // keep below the new Nyquist
  const n = frames(p);
  const outN = Math.floor((n - 1) / step) + 1;
  const reach = Math.ceil(TAPS / cutoff);
  const channels = p.channels.map((src) => {
    const out = new Float32Array(outN);
    for (let j = 0; j < outN; j++) {
      const x = j * step;
      const i0 = Math.floor(x);
      let acc = 0;
      let wsum = 0;
      for (let i = i0 - reach + 1; i <= i0 + reach; i++) {
        const d = Math.abs((x - i) * cutoff);
        if (d >= TAPS) continue;
        const t = d * PHASES;
        const ti = Math.floor(t);
        const f = t - ti;
        const w = (k[ti] as number) * (1 - f) + (k[ti + 1] ?? 0) * f;
        wsum += w;
        if (i >= 0 && i < n) acc += (src[i] as number) * w;
      }
      out[j] = wsum ? acc / wsum : 0;
    }
    return out;
  });
  return { sampleRate: outRate, channels };
}

/** Converts to another rate, pitch unchanged. */
export function toRate(p: Pcm, rate = RATE): Pcm {
  return p.sampleRate === rate ? p : resampleStep(p, p.sampleRate / rate, rate);
}

/** Shifts the pitch by `cents` (and the length by the inverse ratio), rate unchanged. */
export function retune(p: Pcm, cents: number): Pcm {
  return Math.abs(cents) < 0.05 ? p : resampleStep(p, 2 ** (cents / 1200), p.sampleRate);
}

// --- pitch -----------------------------------------------------------------------------------------------

export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** Hann-windowed DFT magnitude of `x[s..s+n)` at `hz` (complex rotation, no per-sample trig). */
function magnitudeAt(x: Float32Array, rate: number, hz: number, s: number, n: number): number {
  const w = (2 * Math.PI * hz) / rate;
  const cr = Math.cos(w);
  const ci = Math.sin(w);
  let re = 1;
  let im = 0;
  let accR = 0;
  let accI = 0;
  const wn = (2 * Math.PI) / n;
  const hr = Math.cos(wn);
  const hi = Math.sin(wn);
  let hcr = 1; // cos of the Hann phase
  let hci = 0;
  for (let i = 0; i < n; i++) {
    const v = (x[s + i] as number) * (0.5 - 0.5 * hcr);
    accR += v * re;
    accI += v * im;
    const nr = re * cr - im * ci;
    im = re * ci + im * cr;
    re = nr;
    const hn = hcr * hr - hci * hi;
    hci = hcr * hi + hci * hr;
    hcr = hn;
  }
  return Math.hypot(accR, accI) / n;
}

/**
 * How far (in cents) the partial nearest `midi` sits from equal temperament: the peak of the windowed
 * spectrum within ±60 cents, read from 0.3 s after the onset over up to 1.5 s. That partial is the
 * fundamental the file name claims (the octave is fixed per source in library.ts), so this works for
 * harmonic and for struck, inharmonic bars alike. Null when the sample is too short or the partial is
 * not a clear peak.
 */
export function measureCents(p: Pcm, midi: number): number | null {
  const x = mono(p).channels[0] as Float32Array;
  const rate = p.sampleRate;
  // From 0.3 s after the onset over up to 1.5 s (as the sound-quality harness listens), else from 0.1 s.
  let s = onset(p) + Math.round(0.3 * rate);
  if (x.length - s < 8192) s = onset(p) + Math.round(0.1 * rate);
  const n = Math.min(65536, x.length - s);
  if (n < 4096) return null;
  const hz = midiToHz(midi);
  const mags: number[] = [];
  for (let c = -60; c <= 60; c++) mags.push(magnitudeAt(x, rate, hz * 2 ** (c / 1200), s, n));
  let best = 0;
  for (let i = 1; i < mags.length; i++) if ((mags[i] as number) > (mags[best] as number)) best = i;
  if (best === 0 || best === mags.length - 1) return null;
  const edge = Math.max(mags[0] as number, mags[mags.length - 1] as number);
  if ((mags[best] as number) < edge * 1.5) return null;
  const a = mags[best - 1] as number;
  const b = mags[best] as number;
  const c = mags[best + 1] as number;
  const den = a - 2 * b + c;
  return best - 60 + (den !== 0 ? (0.5 * (a - c)) / den : 0);
}

// --- encoders --------------------------------------------------------------------------------------------

/** 16-bit PCM WAV (deterministic; no dither). */
export const wav16 = (p: Pcm): Uint8Array => encodeWav(p);

/**
 * MP3 through the pinned `lame` (see the file header): VBR quality 0, highest algorithm quality, no
 * ReplayGain scan, mono or joint stereo. The LAME info tag is KEPT: Chromium reads its encoder delay and
 * padding, so the decoded file starts on the original sample (docs/spikes.md: onset +0 with the tag,
 * +1105 frames without it).
 */
export function mp3(p: Pcm): Uint8Array {
  const mode = p.channels.length === 1 ? "m" : "j";
  // The info tag is written by seeking back to the start, so the output must be a file, not a pipe.
  const dir = mkdtempSync(join(tmpdir(), "oak-mp3-"));
  const out = join(dir, "out.mp3");
  try {
    run(["lame", "--silent", "--noreplaygain", "-q", "0", "-V", "0", "-m", mode, "-", out], wav16(p));
    return new Uint8Array(readFileSync(out));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
