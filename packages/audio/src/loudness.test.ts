// Deterministic PCM fixtures; reference levels are BS.1770 facts, not snapshots of this implementation.
import { expect, test } from "bun:test";
import { applyGain, loudness, loudnessOf, normalizeGain, peakDb, peakDbOf } from "./loudness.ts";

const FS = 48000;
const zeros = (sec: number, fs = FS) => new Float32Array(Math.round(sec * fs));

function sine(hz: number, amp: number, sec: number, fs = FS): Float32Array {
  const x = zeros(sec, fs);
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * hz * i) / fs);
  return x;
}

function noise(sec: number, seed: number, fs = FS): Float32Array {
  const x = zeros(sec, fs);
  let s = seed;
  for (let i = 0; i < x.length; i++) {
    s = (1664525 * s + 1013904223) >>> 0;
    x[i] = (s / 2 ** 32 - 0.5) * 0.1;
  }
  return x;
}

function crest(): Float32Array {
  const x = sine(1000, 0.01, 5);
  for (let i = Math.round(0.25 * FS); i < x.length; i += Math.round(0.5 * FS)) x[i] = (x[i] as number) + 0.5;
  return x;
}

function inRange(value: number, lo: number, hi: number): void {
  expect(value).toBeGreaterThanOrEqual(lo);
  expect(value).toBeLessThanOrEqual(hi);
}

function normalised(row: number, channels: readonly Float32Array[], fs = FS) {
  const result = normalizeGain(channels, fs, -16);
  const output = applyGain(channels, result.gain);
  const measured = loudnessOf(output, fs);
  const peak = peakDbOf(output);
  console.info(`AC ${row}:`, result, { measured, peak });
  expect(Math.abs(measured - result.lufsAfter)).toBeLessThanOrEqual(0.05);
  expect(peak).toBeLessThanOrEqual(-1 + 1e-6);
  return result;
}

test("AC 2: mono 1 kHz at -20 dBFS reads -23 LUFS at 48 kHz", () => {
  const value = loudnessOf([sine(1000, 0.1, 5)], FS);
  inRange(value, -23.3, -22.7);
  console.info("AC 2:", value);
});

test("AC 3: one active stereo channel reads -23 LUFS; two read -20 at 48 kHz", () => {
  const x = sine(1000, 0.1, 5);
  const single = loudness({ left: x, right: zeros(5) }, FS);
  const both = loudness({ left: x, right: x }, FS);
  inRange(single, -23.3, -22.7);
  inRange(both, -20.3, -19.7);
  console.info("AC 3:", { single, both });
});

test("AC 4: mono and stereo reference levels also hold at 44.1 kHz", () => {
  const fs = 44100;
  const x = sine(1000, 0.1, 5, fs);
  const mono = loudnessOf([x], fs);
  const single = loudness({ left: x, right: zeros(5, fs) }, fs);
  const both = loudness({ left: x, right: x }, fs);
  inRange(mono, -23.3, -22.7);
  inRange(single, -23.3, -22.7);
  inRange(both, -20.3, -19.7);
  console.info("AC 4:", { mono, single, both });
});

test("AC 5: stereo sine reaches -16 LUFS without peak limiting", () => {
  const x = sine(1000, 0.1, 5);
  const result = normalised(5, [x, x]);
  inRange(result.lufsAfter, -16.5, -15.5);
  expect(result.peakDbAfter).toBeLessThanOrEqual(-1);
  expect(result.limitedByPeak).toBe(false);
  expect(result.gain).toBeGreaterThan(1);
});

test("AC 6: seeded stereo noise reaches -16 LUFS with its peak below -1 dBFS", () => {
  const result = normalised(6, [noise(5, 1), noise(5, 2)]);
  inRange(result.lufsAfter, -16.5, -15.5);
  expect(result.peakDbAfter).toBeLessThanOrEqual(-1);
});

test("AC 7: enveloped 220 Hz stereo sine reaches -16 LUFS at 44.1 kHz", () => {
  const fs = 44100;
  const x = sine(220, 0.3, 6, fs);
  for (let i = 0; i < x.length; i++)
    x[i] = (x[i] as number) * (0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * i) / fs));
  const result = normalised(7, [x, x], fs);
  inRange(result.lufsAfter, -16.5, -15.5);
  expect(result.peakDbAfter).toBeLessThanOrEqual(-1);
});

test("AC 8: the peak cap wins for crest-heavy audio; it must not reach -16 LUFS", () => {
  const x = crest();
  const result = normalised(8, [x, x]);
  expect(result.limitedByPeak).toBe(true);
  expect(result.peakDbAfter).toBeLessThanOrEqual(-1 + 1e-9);
  expect(result.lufsAfter).toBeLessThan(-16.5);
});

test("AC 9: silence and sub-gate audio are never raised and never produce NaN", () => {
  for (const x of [zeros(2), sine(1000, 1e-5, 2)]) {
    const result = normalizeGain([x, x], FS, -16);
    expect(result).toEqual({
      gain: 1,
      gainDb: 0,
      lufsBefore: Number.NEGATIVE_INFINITY,
      lufsAfter: Number.NEGATIVE_INFINITY,
      peakDbAfter: peakDbOf([x, x]),
      limitedByPeak: false,
    });
    for (const value of Object.values(result)) expect(Number.isNaN(value)).toBe(false);
    console.info("AC 9:", result);
  }
  expect(peakDbOf([zeros(2), zeros(2)])).toBe(Number.NEGATIVE_INFINITY);
});

test("AC 10: mono normalisation uses one channel, from -23 to -16 LUFS", () => {
  const x = sine(1000, 0.1, 5);
  const result = normalised(10, [x]);
  inRange(result.lufsBefore, -23.3, -22.7);
  inRange(loudnessOf(applyGain([x], result.gain), FS), -16.5, -15.5);
});

test("AC 11: applyGain allocates exact scaled copies and refuses invalid gains", () => {
  const channels = [noise(5, 1), noise(5, 2)];
  const before = channels.map((channel) => channel.slice());
  const output = applyGain(channels, 0.5);
  expect(output).not.toBe(channels);
  expect(output.length).toBe(channels.length);
  for (let c = 0; c < channels.length; c++) {
    const input = channels[c] as Float32Array;
    const copy = before[c] as Float32Array;
    const scaled = output[c] as Float32Array;
    expect(scaled).not.toBe(input);
    expect(scaled.length).toBe(input.length);
    expect(input.every((sample, i) => Object.is(sample, copy[i]))).toBe(true);
    expect(scaled.every((sample, i) => Object.is(sample, Math.fround((input[i] as number) * 0.5)))).toBe(
      true,
    );
  }
  for (const gain of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])
    expect(() => applyGain(channels, gain)).toThrow(RangeError);
  expect(applyGain(channels, 0).every((channel) => channel.every((sample) => sample === 0))).toBe(true);
});

test("AC 12: absent or mismatched channels and invalid sample rates throw RangeError", () => {
  const mismatched = [new Float32Array(10), new Float32Array(11)];
  for (const channels of [[], mismatched]) {
    expect(() => normalizeGain(channels, FS, -16)).toThrow(RangeError);
    expect(() => loudnessOf(channels, FS)).toThrow(RangeError);
    expect(() => peakDbOf(channels)).toThrow(RangeError);
  }
  const channels = [zeros(1)];
  for (const fs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    expect(() => normalizeGain(channels, fs, -16)).toThrow(RangeError);
    expect(() => loudnessOf(channels, fs)).toThrow(RangeError);
  }
  const r = { left: mismatched[0] as Float32Array, right: mismatched[1] as Float32Array };
  expect(() => loudness(r, FS)).toThrow(RangeError);
  expect(() => peakDb(r)).toThrow(RangeError);
});

test("AC 13: three minutes of stereo noise normalises in under 2000 ms", () => {
  const channels = [noise(180, 1), noise(180, 2)];
  const start = performance.now();
  const result = normalizeGain(channels, FS, -16);
  const ms = performance.now() - start;
  console.info("AC 13:", { ms });
  expect(ms).toBeLessThan(2000);
  inRange(result.lufsAfter, -16.5, -15.5);
  expect(result.peakDbAfter).toBeLessThanOrEqual(-1);
}, 20_000);

test("AC 14: stereo wrappers and channel functions are Object.is-identical", () => {
  const x = sine(1000, 0.1, 5);
  const impulses = crest();
  for (const r of [
    { left: x, right: zeros(5) },
    { left: x, right: x },
    { left: noise(5, 1), right: noise(5, 2) },
    { left: impulses, right: impulses },
  ]) {
    expect(Object.is(loudness(r, FS), loudnessOf([r.left, r.right], FS))).toBe(true);
    expect(Object.is(peakDb(r), peakDbOf([r.left, r.right]))).toBe(true);
  }
});

test("AC 15: a loud stereo take is turned down to -16 LUFS, never up", () => {
  const x = sine(1000, 0.5, 5);
  const result = normalised(15, [x, x]);
  expect(result.gain).toBeLessThan(1);
  inRange(result.lufsAfter, -16.05, -15.95);
  expect(result.limitedByPeak).toBe(false);
});

test("empty buffers and signals shorter than one block are unmeasurable and untouched", () => {
  for (const x of [zeros(0), sine(1000, 0.1, 0.399)]) {
    expect(loudnessOf([x], FS)).toBe(Number.NEGATIVE_INFINITY);
    expect(normalizeGain([x], FS, -16)).toEqual({
      gain: 1,
      gainDb: 0,
      lufsBefore: Number.NEGATIVE_INFINITY,
      lufsAfter: Number.NEGATIVE_INFINITY,
      peakDbAfter: peakDbOf([x]),
      limitedByPeak: false,
    });
  }
});

test("all channels have weight one and sample peak includes negative samples in later channels", () => {
  const x = sine(1000, 0.1, 5);
  // Three copies of a mono signal have three times its power: +10 log10(3) LU.
  inRange(loudnessOf([x, x, x], FS), -23.3 + 10 * Math.log10(3), -22.7 + 10 * Math.log10(3));
  expect(peakDbOf([new Float32Array([0.1]), new Float32Array([0]), new Float32Array([-0.5])])).toBe(
    20 * Math.log10(0.5),
  );
});

test("a custom peak ceiling is respected and a gain tie is not peak-limited", () => {
  const x = sine(1000, 0.1, 5);
  const channels = [x, x];
  const tied = normalizeGain(channels, FS, loudnessOf(channels, FS), peakDbOf(channels));
  expect(tied.gain).toBe(1);
  expect(tied.limitedByPeak).toBe(false);
  const capped = normalizeGain(channels, FS, -16, -24);
  expect(capped.limitedByPeak).toBe(true);
  expect(capped.peakDbAfter).toBeLessThanOrEqual(-24 + 1e-9);
  expect(peakDbOf(applyGain(channels, capped.gain))).toBeLessThanOrEqual(-24 + 1e-6);
});

test("non-finite samples, targets and unrepresentable gains are refused instead of returning NaN", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const channels = [new Float32Array([value])];
    expect(() => loudnessOf(channels, FS)).toThrow(RangeError);
    expect(() => peakDbOf(channels)).toThrow(RangeError);
    expect(() => normalizeGain(channels, FS, -16)).toThrow(RangeError);
    expect(() => normalizeGain([zeros(1)], FS, value)).toThrow(RangeError);
    expect(() => normalizeGain([zeros(1)], FS, -16, value)).toThrow(RangeError);
  }
  expect(() => loudnessOf([zeros(1)], 1)).toThrow(RangeError);
  const x = sine(1000, 0.1, 1);
  expect(() => normalizeGain([x], FS, -1e6)).toThrow(RangeError);
  expect(() => normalizeGain([x], FS, 1e6, 1e6)).toThrow(RangeError);
});
