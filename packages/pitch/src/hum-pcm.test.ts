import { describe, expect, spyOn, test } from "bun:test";
import type { Rat } from "@oak/content-kit";
import { evalHeadless, midisOf } from "@oak/grader/testing";
import { PitchFrameAnalyzer } from "./detector.ts";
import { analyze, SR } from "./fixtures.test-data.ts";
import { humToDraft } from "./hum.ts";
import { HUM_PCM_MAX_GAIN_DB, type HumFromPcmOptions, humFromPcm } from "./hum-pcm.ts";
import { concat, silence, tone } from "./synth.ts";

/** Starts are seconds from the first note; the recording includes a one-second lead-in by default. */
function sing(
  notes: [midi: number, startSec: number, durSec: number][],
  sampleRate: number,
  o: { amp?: number; t0?: number; floorDb?: number } = {},
): Float32Array {
  const parts: Float32Array[] = [];
  // A quiet memo is quiet throughout, its room and breath noise included.
  const floorDb = o.floorDb ?? 0;
  let cursor = 0;
  for (const [i, [midi, start, dur]] of notes.entries()) {
    const at = (o.t0 ?? 1) + start;
    parts.push(silence(at - cursor, sampleRate, -60 + floorDb, 10 + i));
    parts.push(
      tone({
        hz: 440 * 2 ** ((midi - 69) / 12),
        seconds: dur,
        sampleRate,
        wave: "voice",
        amp: o.amp ?? 0.4,
        vibratoCents: 30,
        vibratoHz: 5.5,
        vibratoOnset: 0.15,
        noiseDb: -45 + floorDb,
        fade: 0.02,
        seed: 30 + i,
      }),
    );
    cursor = at + dur;
  }
  return concat(parts);
}

const major: HumFromPcmOptions = {
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  meter: "4/4",
  downbeat: 1,
  tonicOctave: 4,
};
const minor: HumFromPcmOptions = { ...major, key: { tonic: "A", mode: "minor" }, tonicOctave: 3 };
const majorNotes: [number, number, number][] = [
  [60, 0, 0.5],
  [64, 0.6, 0.5],
  [67, 1.2, 0.5],
  [64, 1.8, 0.5],
];
const minorNotes: [number, number, number][] = [
  [57, 0, 0.5],
  [60, 0.6, 0.5],
  [64, 1.2, 0.5],
];
const quarterOnsets: Rat[] = [
  [0, 1],
  [1, 4],
  [1, 2],
  [3, 4],
];

describe("humFromPcm", () => {
  test("AC1: major at 48 kHz keeps degrees, octaves and beat onsets", () => {
    const result = humFromPcm(sing(majorNotes, SR), SR, major);
    expect(result.degrees.map((d) => d.degree)).toEqual(["1", "3", "5", "3"]);
    expect(result.degrees.map((d) => d.octave)).toEqual([0, 0, 0, 0]);
    expect(result.notes.map((n) => n.bar)).toEqual([0, 0, 0, 0]);
    expect(result.notes.map((n) => n.onset)).toEqual(quarterOnsets);
    expect(result.warnings.some((w) => w.code === "chromatic-snapped")).toBe(false);
    expect(result.machineMade).toBe(true);
  });

  test("AC2: 44.1 kHz gives the same degrees, bars and onsets", () => {
    const reference = humFromPcm(sing(majorNotes, SR), SR, major);
    const result = humFromPcm(sing(majorNotes, 44100), 44100, major);
    expect(result.degrees).toEqual(reference.degrees);
    expect(result.notes.map((n) => n.bar)).toEqual(reference.notes.map((n) => n.bar));
    expect(result.notes.map((n) => n.onset)).toEqual(reference.notes.map((n) => n.onset));
  });

  test("AC3: a held note and a repeated pitch retain their rhythm", () => {
    const pcm = sing(
      [
        [60, 0, 1.1],
        [60, 1.2, 0.5],
        [67, 1.8, 0.5],
      ],
      SR,
    );
    const result = humFromPcm(pcm, SR, major);
    expect(result.degrees.map((d) => d.degree)).toEqual(["1", "1", "5"]);
    expect(result.notes.map((n) => n.onset)).toEqual([
      [0, 1],
      [1, 2],
      [3, 4],
    ]);
    expect(
      result.notes.map((n) => n.dur),
      result.line,
    ).toEqual([
      [1, 2],
      [1, 4],
      [1, 4],
    ]);
  });

  test("AC4: A minor keeps the flat third", () => {
    const result = humFromPcm(sing(minorNotes, SR), SR, minor);
    expect(result.degrees.map((d) => d.degree)).toEqual(["1", "b3", "5"]);
  });

  test("AC5: a quiet memo keeps the same degrees and onsets", () => {
    const reference = humFromPcm(sing(majorNotes, SR), SR, major);
    const pcm = sing(majorNotes, SR, { amp: 0.02, floorDb: 20 * Math.log10(0.02 / 0.4) });
    let peak = 0;
    for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
    expect(20 * Math.log10(peak)).toBeLessThan(-30);
    const result = humFromPcm(pcm, SR, major);
    expect(result.degrees).toEqual(reference.degrees);
    expect(result.notes.map((n) => n.onset)).toEqual(reference.notes.map((n) => n.onset));
  });

  test("a quiet voice buried in room noise drafts nothing rather than wrong notes", () => {
    const result = humFromPcm(sing(majorNotes, SR, { amp: 0.02 }), SR, major);
    expect(result.notes).toEqual([]);
    expect(result.warnings).toContainEqual({ code: "empty" });
  });

  test("AC6: silence and quiet white noise draft no notes", () => {
    for (const pcm of [new Float32Array(5 * SR), silence(5, SR, -60, 3)]) {
      const result = humFromPcm(pcm, SR, major);
      expect(result.notes).toEqual([]);
      expect(result.warnings).toContainEqual({ code: "empty" });
    }
  });

  test("AC7: a 60-second memo finishes under 2000 ms and reports truncation", () => {
    const notes: [number, number, number][] = [];
    for (let i = 0; 1 + i * 0.6 + 0.5 <= 60; i++) {
      notes.push([(majorNotes[i % 4] as [number, number, number])[0], i * 0.6, 0.5]);
    }
    const sung = sing(notes, SR);
    const pcm = concat([sung, silence((60 * SR - sung.length) / SR, SR, -60, 3)]);
    expect(pcm.length).toBe(60 * SR);
    const start = performance.now();
    const result = humFromPcm(pcm, SR, major);
    const elapsed = performance.now() - start;
    console.log(`AC7: 60 seconds at 48 kHz analysed in ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(2000);
    expect(result.bars).toBeLessThanOrEqual(8);
    expect(result.warnings).toContainEqual({ code: "truncated", bars: 8 });
  });

  test("AC8: the input is unchanged element by element and repeated calls agree", () => {
    const pcm = sing(majorNotes, SR);
    const before = pcm.slice();
    const result = humFromPcm(pcm, SR, major);
    for (let i = 0; i < pcm.length; i++) expect(pcm[i]).toBe(before[i]);
    expect(humFromPcm(pcm, SR, major)).toEqual(result);
  });

  for (const [name, notes, opts] of [
    ["major", majorNotes, major],
    ["minor", minorNotes, minor],
  ] as const) {
    test(`AC9: the ${name} draft plays its claimed MIDI notes`, async () => {
      const result = humFromPcm(sing(notes, SR), SR, opts);
      const played = await evalHeadless(result.code, result.bars);
      expect(played.tracks).toEqual(["mel"]);
      expect(played.events.filter((e) => e.track === "mel").map((e) => e.midi)).toEqual(
        result.notes.map((n) => n.midi),
      );
      expect(await midisOf(result.code, result.bars)).toEqual(result.notes.map((n) => n.midi));
    });
  }

  test("AC10: normalised live-path frames give the same line and complete result", () => {
    const pcm = sing(majorNotes, SR);
    const normalised = pcm.slice();
    let peak = 0;
    for (const sample of normalised) peak = Math.max(peak, Math.abs(sample));
    const gain = Math.min(10 ** (-3 / 20) / peak, 10 ** (30 / 20));
    for (let i = 0; i < normalised.length; i++) normalised[i] = (normalised[i] as number) * gain;
    const live = humToDraft(analyze(normalised, SR), major);
    const result = humFromPcm(pcm, SR, major);
    expect(result.line).toBe(live.line);
    expect(result).toEqual(live);
  });

  test("empty PCM returns the live path's empty result", () => {
    expect(humFromPcm(new Float32Array(), SR, major)).toEqual(humToDraft([], major));
  });

  test("invalid sample rates and normalisation levels throw RangeError", () => {
    const pcm = new Float32Array(128);
    for (const sr of [0, Number.NaN, 4000, 7999, 192001, Infinity, -Infinity]) {
      expect(() => humFromPcm(pcm, sr, major)).toThrow(RangeError);
    }
    for (const normalizeDb of [3, Number.NaN, Infinity, -Infinity]) {
      expect(() => humFromPcm(pcm, SR, { ...major, normalizeDb })).toThrow(RangeError);
    }
    for (const sr of [8000, 192000]) {
      expect(() => humFromPcm(pcm, sr, major)).not.toThrow();
    }
  });

  test("normalisation honours its target and gain cap and feeds the final partial block", () => {
    expect(HUM_PCM_MAX_GAIN_DB).toBe(30);
    for (const [amplitude, normalizeDb, expected] of [
      [0.25, undefined, 10 ** (-3 / 20)],
      [0.25, -6, 10 ** (-6 / 20)],
      [0.25, 0, 1],
      [0.001, undefined, 0.001 * 10 ** (30 / 20)],
      [0, undefined, 0],
    ] as const) {
      const pcm = new Float32Array(129).fill(-amplitude);
      const push = spyOn(PitchFrameAnalyzer.prototype, "push");
      try {
        humFromPcm(pcm, SR, normalizeDb === undefined ? major : { ...major, normalizeDb });
        expect(push.mock.calls.length).toBe(2);
        expect(push.mock.calls.map(([block, time]) => [block.length, time])).toEqual([
          [128, 0],
          [1, 128 / SR],
        ]);
        for (const [block] of push.mock.calls) {
          for (const sample of block) expect(sample).toBeCloseTo(-expected, 6);
        }
      } finally {
        push.mockRestore();
      }
    }
  });
});
