// A small, deterministic FLAC encoder (16-bit PCM, fixed predictors, partitioned Rice residuals). Oak's
// drum one-shots, breaks and rendered sounds are written with it, so their bytes depend only on this file,
// never on an installed encoder's version (docs/spikes.md, "Sound pack v4"). The output is a plain FLAC
// stream: fLaC marker, one STREAMINFO block (MD5 left zero, which the format allows: "unknown"), frames of
// 4096 samples with independent channels. Chromium decodes it sample-exactly (onset +0, spike).

import type { Pcm } from "./brk.ts";

const BLOCK = 4096;

class Bits {
  private buf: number[] = [];
  private acc = 0;
  private n = 0;
  write(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | (Math.floor(value / 2 ** i) & 1);
      if (++this.n === 8) {
        this.buf.push(this.acc & 0xff);
        this.acc = 0;
        this.n = 0;
      }
    }
  }
  /** Two's-complement signed value. */
  signed(value: number, bits: number): void {
    this.write(value < 0 ? value + 2 ** bits : value, bits);
  }
  unary(q: number): void {
    for (let i = 0; i < q; i++) this.write(0, 1);
    this.write(1, 1);
  }
  align(): void {
    while (this.n !== 0) this.write(0, 1);
  }
  bytes(): number[] {
    return this.buf;
  }
}

function crc8(bytes: number[]): number {
  let c = 0;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

function crc16(bytes: number[]): number {
  let c = 0;
  for (const b of bytes) {
    c ^= b << 8;
    for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x8005) & 0xffff : (c << 1) & 0xffff;
  }
  return c;
}

/** Residual of the fixed predictor of `order` (0–4) for x[order..]. */
function residual(x: Int32Array, order: number): Int32Array {
  const n = x.length;
  const r = new Int32Array(Math.max(0, n - order));
  for (let i = order; i < n; i++) {
    const a = x[i] as number;
    const b = x[i - 1] ?? 0;
    const c = x[i - 2] ?? 0;
    const d = x[i - 3] ?? 0;
    const e = x[i - 4] ?? 0;
    let p = 0;
    if (order === 1) p = b;
    else if (order === 2) p = 2 * b - c;
    else if (order === 3) p = 3 * b - 3 * c + d;
    else if (order === 4) p = 4 * b - 6 * c + 4 * d - e;
    r[i - order] = a - p;
  }
  return r;
}

const fold = (v: number): number => (v >= 0 ? v * 2 : -v * 2 - 1);

/** Bits for a partition at Rice parameter k. */
function riceBits(u: Uint32Array, from: number, to: number, k: number): number {
  let bits = 0;
  for (let i = from; i < to; i++) bits += Math.floor((u[i] as number) / 2 ** k) + 1 + k;
  return bits;
}

interface Plan {
  order: number;
  porder: number;
  params: number[];
  bits: number;
}

/** The cheapest fixed order, partition order and Rice parameters for one channel block. */
function plan(x: Int32Array): Plan {
  const n = x.length;
  let best: Plan | null = null;
  for (let order = 0; order <= Math.min(4, n - 1); order++) {
    const r = residual(x, order);
    const u = new Uint32Array(r.length);
    for (let i = 0; i < r.length; i++) u[i] = fold(r[i] as number);
    for (let porder = 0; porder <= 6; porder++) {
      const parts = 1 << porder;
      if (n % parts !== 0 || n / parts <= order) break;
      const per = n / parts;
      const params: number[] = [];
      let bits = 2 + 4 + 16 * order; // coding method, partition order, warm-up
      let start = 0;
      for (let p = 0; p < parts; p++) {
        const end = (p + 1) * per - order;
        let sum = 0;
        for (let i = start; i < end; i++) sum += u[i] as number;
        const mean = end > start ? sum / (end - start) : 0;
        const guess = mean > 1 ? Math.min(14, Math.floor(Math.log2(mean))) : 0;
        let k = guess;
        let kb = riceBits(u, start, end, k);
        for (const t of [guess - 1, guess + 1]) {
          if (t < 0 || t > 14) continue;
          const b = riceBits(u, start, end, t);
          if (b < kb) {
            kb = b;
            k = t;
          }
        }
        params.push(k);
        bits += 4 + kb;
        start = end;
      }
      if (!best || bits < best.bits) best = { order, porder, params, bits };
    }
  }
  return best as Plan;
}

function subframe(out: Bits, x: Int32Array): void {
  // constant (silence and DC blocks)
  if (x.every((v) => v === x[0])) {
    out.write(0, 1);
    out.write(0b000000, 6);
    out.write(0, 1);
    out.signed(x[0] ?? 0, 16);
    return;
  }
  const p = plan(x);
  if (p.bits >= 16 * x.length) {
    out.write(0, 1);
    out.write(0b000001, 6);
    out.write(0, 1);
    for (const v of x) out.signed(v, 16);
    return;
  }
  out.write(0, 1);
  out.write(0b001000 | p.order, 6);
  out.write(0, 1);
  for (let i = 0; i < p.order; i++) out.signed(x[i] as number, 16);
  const r = residual(x, p.order);
  out.write(0b00, 2);
  out.write(p.porder, 4);
  const per = x.length >> p.porder;
  let start = 0;
  for (let part = 0; part < 1 << p.porder; part++) {
    const end = (part + 1) * per - p.order;
    const k = p.params[part] as number;
    out.write(k, 4);
    for (let i = start; i < end; i++) {
      const u = fold(r[i] as number);
      out.unary(Math.floor(u / 2 ** k));
      if (k > 0) out.write(u % 2 ** k, k);
    }
    start = end;
  }
}

function utf8(n: number): number[] {
  if (n < 0x80) return [n];
  if (n < 0x800) return [0xc0 | (n >> 6), 0x80 | (n & 0x3f)];
  if (n < 0x10000) return [0xe0 | (n >> 12), 0x80 | ((n >> 6) & 0x3f), 0x80 | (n & 0x3f)];
  return [0xf0 | (n >> 18), 0x80 | ((n >> 12) & 0x3f), 0x80 | ((n >> 6) & 0x3f), 0x80 | (n & 0x3f)];
}

const RATE_CODE: Record<number, number> = {
  22050: 0b0110,
  24000: 0b0111,
  32000: 0b1000,
  44100: 0b1001,
  48000: 0b1010,
};

/** 16-bit FLAC bytes of a mono or stereo buffer (samples clamped to −1..1, rounded, no dither). */
export function encodeFlac(pcm: Pcm): Uint8Array {
  const ch = pcm.channels.length;
  if (ch < 1 || ch > 2) throw new Error("encodeFlac: mono or stereo only");
  const rateCode = RATE_CODE[pcm.sampleRate];
  if (rateCode === undefined) throw new Error(`encodeFlac: unsupported rate ${pcm.sampleRate}`);
  const n = pcm.channels[0]?.length ?? 0;
  const ints = pcm.channels.map((c) => {
    const out = new Int32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.round(Math.max(-1, Math.min(1, c[i] as number)) * 32767);
    return out;
  });
  const frames: number[][] = [];
  let minFrame = Number.POSITIVE_INFINITY;
  let maxFrame = 0;
  for (let f = 0, start = 0; start < n; f++, start += BLOCK) {
    const size = Math.min(BLOCK, n - start);
    const hdr = new Bits();
    hdr.write(0xfff8, 16); // sync, reserved, fixed blocksize
    hdr.write(size === BLOCK ? 0b1100 : 0b0111, 4);
    hdr.write(rateCode, 4);
    hdr.write(ch === 1 ? 0b0000 : 0b0001, 4); // independent channels
    hdr.write(0b100, 3); // 16 bits per sample
    hdr.write(0, 1);
    const head = [...hdr.bytes(), ...utf8(f)];
    if (size !== BLOCK) head.push(((size - 1) >> 8) & 0xff, (size - 1) & 0xff);
    head.push(crc8(head));
    const body = new Bits();
    for (const c of ints) subframe(body, c.subarray(start, start + size));
    body.align();
    const frame = [...head, ...body.bytes()];
    const crc = crc16(frame);
    frame.push(crc >> 8, crc & 0xff);
    frames.push(frame);
    minFrame = Math.min(minFrame, frame.length);
    maxFrame = Math.max(maxFrame, frame.length);
  }
  // STREAMINFO
  const si = new Bits();
  si.write(BLOCK, 16);
  si.write(BLOCK, 16);
  si.write(frames.length ? minFrame : 0, 24);
  si.write(maxFrame, 24);
  si.write(pcm.sampleRate, 20);
  si.write(ch - 1, 3);
  si.write(15, 5);
  si.write(Math.floor(n / 2 ** 32), 4);
  si.write(n % 2 ** 32, 32);
  for (let i = 0; i < 16; i++) si.write(0, 8);
  const info = si.bytes();
  const total = 4 + 4 + info.length + frames.reduce((a, f) => a + f.length, 0);
  const out = new Uint8Array(total);
  out.set([0x66, 0x4c, 0x61, 0x43], 0);
  out.set([0x80, 0, 0, info.length], 4); // last metadata block, type 0 (STREAMINFO), length 34
  out.set(info, 8);
  let at = 8 + info.length;
  for (const f of frames) {
    out.set(f, at);
    at += f.length;
  }
  return out;
}
