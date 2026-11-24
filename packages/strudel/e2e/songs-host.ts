// The host page of the song loudness harness (songs.pw.ts): renders windows of a unit song in songs-render.html, one
// frame per render, and measures them here (BS.1770 loudness and sample peak as quality.ts reads them for the Bands'
// budgets, per-section loudness, the share of energy under 120 Hz). Only numbers go back to the spec.
import { createHarness } from "../src/audibility/harness.ts";
import { loudness, peakDb } from "../src/audibility/quality.ts";
import type { SongRenderReply, SongRenderRequest } from "./songs-render.ts";

export type RenderInput = Omit<SongRenderRequest, "type" | "id" | "fromBar" | "toBar">;

export interface Measured {
  lufs: number;
  peakDb: number;
  /** Energy under 120 Hz over all energy, in percent (unweighted, both channels). */
  lowPct: number;
  /** The ungated K-weighted level (the leveling model adds parts by it). */
  ungated: number;
  seconds: number;
}

export interface WindowsResult extends Measured {
  cps: number;
  haps: number;
  missing: string[];
  ms: number;
  /** Per named span (bars from the song's bar 0), when asked for. */
  spans: Record<string, Measured>;
}

const round = (x: number, d = 1) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);
let nextId = 1;

function renderInFrame(req: SongRenderRequest, timeoutMs = 240_000): Promise<SongRenderReply> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = "/songs-render.html";
    const done = (fn: () => void) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      frame.remove();
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("song render timeout"))), timeoutMs);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type === "oak-song-ready") frame.contentWindow?.postMessage(req, location.origin);
      else if (event.data?.type === "oak-song-rendered" && event.data.id === req.id) {
        const reply = event.data as SongRenderReply;
        done(() => (reply.error ? reject(new Error(reply.error)) : resolve(reply)));
      }
    };
    window.addEventListener("message", onMessage);
    document.body.append(frame);
  });
}

/** A 2nd-order Butterworth-style low-pass section (RBJ), run in place. */
function lowpass(x: Float32Array, fs: number, hz: number, q: number): Float32Array {
  const w = (2 * Math.PI * hz) / fs;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - cos) / 2 / a0;
  const b1 = (1 - cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const out = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i] as number;
    const y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/** 4th-order Butterworth under 120 Hz (two sections, Q .5412 and 1.3066). */
function lowShare(left: Float32Array, right: Float32Array, fs: number): number {
  let all = 0;
  let low = 0;
  for (const ch of [left, right]) {
    const lp = lowpass(lowpass(ch, fs, 120, 0.5412), fs, 120, 1.3066);
    for (let i = 0; i < ch.length; i++) {
      all += (ch[i] as number) ** 2;
      low += (lp[i] as number) ** 2;
    }
  }
  return all > 0 ? (100 * low) / all : 0;
}

// quality.ts's K-weighting (not exported there), for the ungated level below.
/** One biquad over a whole signal (direct form I). */
function biquad(x: Float64Array, b: [number, number, number], a: [number, number]): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i] as number;
    const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    y[i] = y0;
  }
  return y;
}

/** ITU-R BS.1770 K-weighting at any sample rate (the libebur128 derivation of the two filters). */
function kWeight(x: Float32Array, fs: number): Float64Array {
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const shelf = biquad(
    Float64Array.from(x),
    [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  );
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  return biquad(shelf, [1, -2, 1], [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]);
}

/**
 * Ungated K-weighted level (LUFS units, no gate): the mean power, so the parts of a mix add up (a gated level of a
 * sparse part reads only its loud blocks). For the leveling model, not a check.
 */
function ungated(left: Float32Array, right: Float32Array, fs: number): number {
  const l = kWeight(left, fs);
  const r = kWeight(right, fs);
  let s = 0;
  for (let i = 0; i < l.length; i++) s += (l[i] as number) ** 2 + (r[i] as number) ** 2;
  return s > 0 ? -0.691 + 10 * Math.log10(s / l.length) : Number.NEGATIVE_INFINITY;
}

function measure(left: Float32Array, right: Float32Array, fs: number): Measured {
  return {
    lufs: round(loudness({ left, right }, fs)),
    peakDb: round(peakDb({ left, right })),
    lowPct: round(lowShare(left, right, fs)),
    ungated: round(ungated(left, right, fs)),
    seconds: round(left.length / fs, 2),
  };
}

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * Renders each window `[fromBar, toBar)` of the song (bars from the song's bar 0) and measures them joined. `spans`
 * names bar ranges inside the windows to measure on their own (the sections).
 */
async function windows(
  input: RenderInput,
  wins: readonly (readonly [number, number])[],
  spans: Readonly<Record<string, readonly [number, number]>> = {},
): Promise<WindowsResult> {
  const fs = input.sampleRate;
  const lefts: Float32Array[] = [];
  const rights: Float32Array[] = [];
  const at: { from: number; to: number; offset: number; cps: number }[] = [];
  let offset = 0;
  let cps = 0;
  let haps = 0;
  let ms = 0;
  const missing = new Set<string>();
  for (const [fromBar, toBar] of wins) {
    const reply = await renderInFrame({ ...input, type: "oak-song-render", id: nextId++, fromBar, toBar });
    const left = reply.left as Float32Array;
    const right = reply.right as Float32Array;
    cps = reply.cps as number;
    // The window is exactly its bars (the tail after `toBar` is cut).
    const n = Math.min(left.length, Math.round(((toBar - fromBar) / cps) * fs));
    lefts.push(left.subarray(0, n));
    rights.push(right.subarray(0, n));
    at.push({ from: fromBar, to: toBar, offset, cps });
    offset += n;
    haps += reply.haps ?? 0;
    ms += reply.ms ?? 0;
    for (const m of reply.missing ?? []) missing.add(m);
  }
  const left = concat(lefts);
  const right = concat(rights);
  const out: WindowsResult = { ...measure(left, right, fs), cps, haps, ms, missing: [...missing], spans: {} };
  for (const [name, [from, to]] of Object.entries(spans)) {
    const w = at.find((a) => from >= a.from && to <= a.to);
    if (!w) continue;
    const a = w.offset + Math.round(((from - w.from) / w.cps) * fs);
    const b = w.offset + Math.round(((to - w.from) / w.cps) * fs);
    out.spans[name] = measure(left.subarray(a, b), right.subarray(a, b), fs);
  }
  return out;
}

/** One bar of code at `cps` through the audibility harness's frame (render.html), as sound-wave5.json's Bands are read. */
const phraseHarness = createHarness({ frameUrl: "/render.html", seconds: 3 });
async function phrase(code: string, cps: number): Promise<Measured> {
  const r = await phraseHarness.renderInFrame(code, 1, cps);
  return measure(r.left, r.right, phraseHarness.sampleRate);
}

declare global {
  interface Window {
    __songs: { windows: typeof windows; phrase: typeof phrase; ready: true };
  }
}
window.__songs = { windows, phrase, ready: true };
