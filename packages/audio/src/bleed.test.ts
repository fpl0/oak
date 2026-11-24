// The headphone-leak check on synthetic mics: a quiet room, the test tones leaking in at several levels and
// delays, a learner talking or singing over the check, and both at once.
import { describe, expect, test } from "bun:test";
import { midiToHz } from "@oak/pitch";
import { mulberry32 } from "@oak/pitch/synth";
import { gradeGateDb, LEAK_CHECK, leakCheck, leakProbe, type MicBlock, type ProbeTone } from "./bleed.ts";

const SR = 48000;
const amp = (dbfs: number) => 10 ** (dbfs / 20) * Math.SQRT2; // peak of a sine at that RMS

interface Room {
  /** Broadband noise, dBFS RMS. */
  noiseDb?: number;
  /** The test tones in the mic, dBFS RMS, or null (headphones that do not leak). */
  leakDb?: number | null;
  /** Seconds between the schedule and the mic. */
  delay?: number;
  /** Anything else the mic hears at time t (a voice). */
  extra?: (t: number) => number;
  seed?: number;
}

/** The mic over the whole check, then read the way the calibration step reads it: a block every `pollMs`. */
function mic(probe: readonly ProbeTone[], room: Room, pollMs: number = LEAK_CHECK.pollMs): MicBlock[] {
  const end = (probe.at(-1) as ProbeTone).off + LEAK_CHECK.maxLagSec + 0.05;
  const n = Math.ceil(end * SR);
  const x = new Float32Array(n);
  const rand = mulberry32(room.seed ?? 11);
  const noise = 10 ** ((room.noiseDb ?? -62) / 20) * Math.sqrt(3); // uniform in ±a has RMS a/√3
  const delay = room.delay ?? 0.08;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = noise * (2 * rand() - 1);
    if (room.leakDb !== null && room.leakDb !== undefined) {
      for (const p of probe) {
        const on = p.on + delay;
        const off = p.off + delay;
        if (t < on || t >= off) continue;
        const env = Math.min(1, (t - on) / 0.02, (off - t) / 0.05);
        v += amp(room.leakDb) * env * Math.sin(2 * Math.PI * p.hz * (t - on));
      }
    }
    if (room.extra) v += room.extra(t);
    x[i] = v;
  }
  const blocks: MicBlock[] = [];
  for (let t = 0.1; t <= end; t += pollMs / 1000) {
    const last = Math.floor(t * SR);
    if (last < LEAK_CHECK.blockSize) continue;
    blocks.push({ t, samples: x.slice(last - LEAK_CHECK.blockSize, last) });
  }
  return blocks;
}

/**
 * A voice: a fundamental drifting as speech does (here 105–190 Hz), 24 partials falling 6 dB an octave, a formant
 * near 700 Hz and syllables about four times a second.
 */
function talking(dbfs: number, from = 0, to = Number.POSITIVE_INFINITY, seed = 3) {
  const rand = mulberry32(seed);
  const wobble = Array.from({ length: 8 }, () => rand() * 2 * Math.PI);
  let phase = 0;
  let last = 0;
  const a = amp(dbfs) * 0.6;
  return (t: number): number => {
    if (t < from || t >= to) return 0;
    const f0 =
      145 +
      30 * Math.sin(2 * Math.PI * 1.3 * t + (wobble[0] as number)) +
      15 * Math.sin(2 * Math.PI * 3.1 * t);
    phase += 2 * Math.PI * f0 * (t - last);
    last = t;
    const syllable = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4.2 * t + (wobble[1] as number));
    let v = 0;
    for (let k = 1; k <= 24; k++) {
      const formant = 1 + 2 * Math.exp(-(((k * f0 - 700) / 300) ** 2));
      v += (formant / k) * Math.sin(k * phase + (wobble[k % 8] as number));
    }
    return a * syllable * v * 0.4;
  };
}

/** A steady sung note with a few partials, the way someone humming along would hold it. */
function singing(midi: number, dbfs: number, from: number, to: number) {
  const hz = midiToHz(midi);
  const a = amp(dbfs);
  return (t: number): number => {
    if (t < from || t >= to) return 0;
    let v = 0;
    for (let k = 1; k <= 8; k++) v += Math.sin(2 * Math.PI * k * hz * t) / k;
    return a * v * 0.6;
  };
}

const probe = leakProbe(0);
const check = (room: Room) => leakCheck(mic(probe, room), probe, SR);

describe("headphone-leak check", () => {
  test("the schedule: silence, then 880, 1175 and 1568 Hz one after the other", () => {
    expect(probe.map((p) => Math.round(p.hz))).toEqual([880, 1175, 1568]);
    expect(probe[0]?.on).toBeCloseTo(LEAK_CHECK.quietSec, 9);
    expect((probe[1] as ProbeTone).on - (probe[0] as ProbeTone).off).toBeCloseTo(LEAK_CHECK.gapSec, 9);
    expect(gradeGateDb(-70)).toBe(-45);
    expect(gradeGateDb(-40)).toBe(-28);
  });

  test("a quiet room with headphones: clean, and the floor is the room's", () => {
    for (const noiseDb of [-75, -62, -45]) {
      const r = check({ noiseDb, leakDb: null });
      expect(r.heard).toBe(false);
      expect(r.leakDb).toBeNull();
      expect(r.floorDb).toBeCloseTo(noiseDb, 0);
      expect(r.tones.every((t) => t.blocks >= LEAK_CHECK.minBlocks)).toBe(true);
    }
  });

  test("speakers: the tones in the mic at several levels and delays are heard, and the delay is found", () => {
    for (const leakDb of [-25, -40, -55]) {
      for (const delay of [0, 0.04, 0.12, 0.3, 0.42]) {
        const r = check({ noiseDb: -62, leakDb, delay });
        expect({ leakDb, delay, heard: r.heard }).toEqual({ leakDb, delay, heard: true });
        expect(Math.abs((r.lagSec as number) - delay)).toBeLessThanOrEqual(0.04);
        expect(r.leakDb as number).toBeCloseTo(leakDb, 0);
      }
    }
  });

  test("a leak quieter than the room's own noise is still found (the tones, not the loudness)", () => {
    const r = check({ noiseDb: -50, leakDb: -58, delay: 0.1 });
    expect(r.heard).toBe(true);
    expect(r.tones.every((t) => t.present)).toBe(true);
    expect(r.leakDb as number).toBeLessThan(r.floorDb);
  });

  test("a faint leak far under the grader's gate is reported, not called a leak", () => {
    // Room −62 dBFS: the grader's gate is −45; a leak at −72 is 27 dB under it.
    const r = check({ noiseDb: -62, leakDb: -72, delay: 0.1 });
    expect(r.tones.every((t) => t.present)).toBe(true);
    expect(r.leakDb as number).toBeCloseTo(-72, 0);
    expect(r.heard).toBe(false);
    // 18 dB under the gate is close enough to matter once the Band plays louder.
    expect(check({ noiseDb: -62, leakDb: -63, delay: 0.1 }).heard).toBe(true);
  });

  test("the learner talking through the check is not a leak, however loud", () => {
    for (const [dbfs, seed] of [
      [-35, 3],
      [-20, 5],
      [-12, 9],
    ] as const) {
      // Silent while the room is measured, talking over the tones (the hardest case for "new since the silence").
      const r = check({ noiseDb: -62, leakDb: null, extra: talking(dbfs, LEAK_CHECK.quietSec, 10, seed) });
      expect({ dbfs, heard: r.heard }).toEqual({ dbfs, heard: false });
      // Talking the whole time.
      expect(check({ noiseDb: -62, leakDb: null, extra: talking(dbfs, 0, 10, seed) }).heard).toBe(false);
    }
  });

  test("talking over leaking speakers is still a leak", () => {
    const r = check({ noiseDb: -62, leakDb: -40, delay: 0.15, extra: talking(-30, 0, 10) });
    expect(r.heard).toBe(true);
    expect(Math.abs((r.lagSec as number) - 0.15)).toBeLessThanOrEqual(0.04);
  });

  test("singing along on a note whose partials hit two test tones is not a leak", () => {
    // D4: its 3rd partial is 881 Hz and its 4th 1175 Hz — both test tones at once, so neither is alone.
    const start = (probe[0] as ProbeTone).on;
    const r = check({ noiseDb: -62, leakDb: null, extra: singing(62, -25, start, 10) });
    expect(r.heard).toBe(false);
    // A steady hum through the whole check is in the silence too.
    expect(check({ noiseDb: -62, leakDb: null, extra: singing(69, -25, 0, 10) }).heard).toBe(false);
  });

  test("too few blocks to judge (a throttled tab) is clean, never a guess; no blocks at all too", () => {
    const sparse = leakCheck(mic(probe, { leakDb: -30 }, 400), probe, SR);
    expect(sparse.heard).toBe(false);
    expect(sparse.tones.every((t) => t.blocks < LEAK_CHECK.minBlocks)).toBe(true);
    const none = leakCheck([], probe, SR);
    expect(none).toMatchObject({ heard: false, lagSec: null, floorDb: -120, leakDb: null });
  });

  test("digital silence (a muted interface) and a leak into it", () => {
    expect(check({ noiseDb: -400, leakDb: null }).heard).toBe(false);
    expect(check({ noiseDb: -400, leakDb: -60 }).heard).toBe(true);
  });
});
