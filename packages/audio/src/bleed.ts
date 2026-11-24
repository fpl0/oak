// The headphone-leak check (contracts §8.6, the set-up's speaker check): does Oak's own playback reach the mic?
// The mic is opened with echo cancellation, noise suppression and AGC off (mic.ts), so with speakers, or
// headphones that leak, the reference note or the Band can reach the pitch tracker and be graded as the learner.
//
// The check plays three steady sines (A5 880 Hz, D6 1175 Hz, G6 1568 Hz, one after the other) through Oak's normal
// output after a short silence, and records the mic as blocks of raw samples. This file decides from those blocks.
// It never looks at loudness alone: each tone is measured with a Goertzel filter at its own frequency, so a tone
// far below the room's broadband noise is still found, and a loud room or a talking learner is not mistaken for
// one. A tone counts as heard when, at the best delay (output latency, the air, input latency: searched over
// −50 ms…450 ms):
//
//  - it stands out of its own spectrum: ≥ 10 dB above four nearby frequencies (±8 %, ±12 %) in the same blocks
//    (a voice or a room spreads its energy; a sine leaked from the output does not);
//  - it is new: ≥ 10 dB above the same frequency in the silent blocks before the first tone (a steady hum or a
//    fan with a partial there is not a leak);
//  - it is alone: ≥ 10 dB above the other two test frequencies in the same blocks (Oak plays one tone at a time;
//    a sung D4 has partials at both 881 and 1175 Hz at once);
//  - it is loud enough to matter: within 20 dB of the grader's voicing gate (max(−45 dBFS, floor + 12 dB),
//    `trackerOptionsFor`). A leak further below that cannot be graded as a voice even if the Band plays louder
//    than the test tones; closed headphones a little audible to a sensitive mic stay "clean".
//
// Playback reaches the mic when at least two of the three tones are heard. Pure: the calibration step feeds it
// blocks from an AnalyserNode on the mic, and the tests feed it synthetic buffers.
import { midiToHz, rmsDb, trackerOptionsFor } from "@oak/pitch";

/** The schedule and the thresholds of the check (seconds and dB). */
export const LEAK_CHECK = {
  /** MIDI notes of the test tones: A5, D6, G6 (above most voices, away from mains hum and its partials). */
  tones: [81, 86, 91] as const,
  /** Silence before the first tone: the room's floor at each test frequency. */
  quietSec: 0.45,
  toneSec: 0.5,
  gapSec: 0.15,
  /** Delays searched between what Oak schedules and what the mic hears. */
  minLagSec: -0.05,
  maxLagSec: 0.45,
  lagStepSec: 0.01,
  /** Ramp and envelope at each tone's start, skipped. */
  edgeSec: 0.03,
  /** Samples per block (85 ms at 48 kHz): the analyser's `fftSize`. */
  blockSize: 4096,
  /** How often the calibration step reads a block. */
  pollMs: 20,
  /** Nearby frequencies (ratios of the tone's) a voice or a room fills as much as the tone's own. */
  neighbours: [0.88, 0.92, 1.08, 1.12] as const,
  tonalDb: 10,
  aboveQuietDb: 10,
  aloneDb: 10,
  /** A leak this far under the grader's voicing gate cannot be graded as a voice. */
  headroomDb: 20,
  /** Tones that must be heard for "playback reaches the mic". */
  minTones: 2,
  /** Blocks a tone needs to be judged at all. */
  minBlocks: 3,
} as const;

/** One block of mic samples. `t`: AudioContext time of its last sample. */
export interface MicBlock {
  t: number;
  samples: Float32Array;
}

/** A test tone as scheduled (AudioContext seconds). */
export interface ProbeTone {
  midi: number;
  hz: number;
  on: number;
  off: number;
}

export interface LeakToneReading {
  hz: number;
  /** Blocks inside the tone at the chosen delay. */
  blocks: number;
  /** The tone over its nearby frequencies, dB. */
  tonalDb: number;
  /** The tone over the same frequency in the silence before, dB. */
  aboveQuietDb: number;
  /** The tone over the other test frequencies in the same blocks, dB. */
  aloneDb: number;
  /** Level of the tone in the mic, dBFS RMS (−Infinity when nothing stood out). */
  levelDb: number;
  /** Clearly in the mic (the first three rules). */
  present: boolean;
  /** Present and loud enough to matter. */
  heard: boolean;
}

export interface LeakCheck {
  /** Playback reaches the mic. */
  heard: boolean;
  /** The delay the mic heard the tones at, seconds, or null when no tone was present. */
  lagSec: number | null;
  /** Median broadband level of the silent blocks, dBFS (−120 with none). */
  floorDb: number;
  /** The grader's voicing gate for that floor, dBFS. */
  gateDb: number;
  /** The loudest present tone, dBFS, or null. */
  leakDb: number | null;
  tones: LeakToneReading[];
}

/** The tones of one check, the first `LEAK_CHECK.quietSec` after `opened`. */
export function leakProbe(opened: number): ProbeTone[] {
  const start = opened + LEAK_CHECK.quietSec;
  return LEAK_CHECK.tones.map((midi, i) => {
    const on = start + i * (LEAK_CHECK.toneSec + LEAK_CHECK.gapSec);
    return { midi, hz: midiToHz(midi), on, off: on + LEAK_CHECK.toneSec };
  });
}

/** The grader's voicing gate (contracts §8.1) for a room at `floorDb`. */
export function gradeGateDb(floorDb: number): number {
  return trackerOptionsFor({ rangeLow: Number.NaN, noiseFloorDb: floorDb }).rmsMinDb;
}

const hannCache = new Map<number, { w: Float64Array; sum: number }>();
function hann(n: number): { w: Float64Array; sum: number } {
  let h = hannCache.get(n);
  if (!h) {
    const w = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
      sum += w[i] as number;
    }
    h = { w, sum };
    hannCache.set(n, h);
  }
  return h;
}

/**
 * Squared peak amplitude of the sine at `hz` in `x` (already windowed; `wsum` is the window's sum): a full-scale
 * sine reads 1 and its RMS is `sqrt(value / 2)`. Goertzel, so any frequency, not only FFT bins.
 */
export function goertzelAmp2(x: ArrayLike<number>, hz: number, sampleRate: number, wsum: number): number {
  const c = 2 * Math.cos((2 * Math.PI * hz) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < x.length; i++) {
    const s0 = (x[i] as number) + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const mag2 = Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2);
  return (4 * mag2) / (wsum * wsum);
}

interface BlockFeatures {
  start: number;
  end: number;
  rmsDb: number;
  /** Per tone: [its own frequency, ...its neighbours]. */
  amp2: number[][];
}

function features(block: MicBlock, probe: readonly ProbeTone[], sampleRate: number): BlockFeatures {
  const n = block.samples.length;
  const { w, sum } = hann(n);
  const x = new Float64Array(n);
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const v = block.samples[i] as number;
    sq += v * v;
    x[i] = v * (w[i] as number);
  }
  const amp2 = probe.map((p) =>
    [p.hz, ...LEAK_CHECK.neighbours.map((r) => p.hz * r)].map((hz) => goertzelAmp2(x, hz, sampleRate, sum)),
  );
  return {
    start: block.t - n / sampleRate,
    end: block.t,
    rmsDb: n > 0 ? rmsDb(Math.sqrt(sq / n)) : -120,
    amp2,
  };
}

/** A tone of −150 dBFS: keeps the ratios finite in digital silence. */
const EPS = 1e-15;
const db = (a: number, b: number) => 10 * Math.log10((a + EPS) / (b + EPS));
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

interface ToneStats {
  blocks: number;
  own: number;
  near: number;
  others: number[];
}

function toneStats(
  fs: readonly BlockFeatures[],
  probe: readonly ProbeTone[],
  i: number,
  lag: number,
): ToneStats {
  const p = probe[i] as ProbeTone;
  const from = p.on + lag + LEAK_CHECK.edgeSec;
  const to = p.off + lag;
  const own: number[] = [];
  const near: number[] = [];
  const others: number[][] = probe.map(() => []);
  for (const f of fs) {
    if (f.start < from || f.end > to) continue;
    const a = f.amp2[i] as number[];
    own.push(a[0] as number);
    near.push(mean(a.slice(1)));
    for (let j = 0; j < probe.length; j++)
      if (j !== i) (others[j] as number[]).push(f.amp2[j]?.[0] as number);
  }
  return {
    blocks: own.length,
    own: mean(own),
    near: mean(near),
    others: others.flatMap((o, j) => (j === i ? [] : [mean(o)])),
  };
}

/**
 * Does the mic hear the test tones? `blocks`: the mic from before the first tone to past the last one plus the
 * longest delay; `probe`: the tones as scheduled (`leakProbe`).
 */
export function leakCheck(
  blocks: readonly MicBlock[],
  probe: readonly ProbeTone[],
  sampleRate: number,
): LeakCheck {
  const fs = blocks.filter((b) => b.samples.length > 0).map((b) => features(b, probe, sampleRate));
  const firstOn = probe[0]?.on ?? Number.POSITIVE_INFINITY;
  const quiet = fs.filter((f) => f.end <= firstOn);
  const levels = quiet.map((f) => f.rmsDb).sort((a, b) => a - b);
  const floorDb = levels.length ? Math.max(-120, levels[Math.floor(levels.length / 2)] as number) : -120;
  const gateDb = gradeGateDb(floorDb);
  const quietOwn = probe.map((_, i) =>
    quiet.length ? mean(quiet.map((f) => f.amp2[i]?.[0] as number)) : null,
  );

  // The delay at which the tones stand out of their neighbourhoods the most.
  let best = { lag: 0, score: Number.NEGATIVE_INFINITY };
  const steps = Math.round((LEAK_CHECK.maxLagSec - LEAK_CHECK.minLagSec) / LEAK_CHECK.lagStepSec);
  for (let k = 0; k <= steps; k++) {
    const lag = LEAK_CHECK.minLagSec + k * LEAK_CHECK.lagStepSec;
    let score = 0;
    for (let i = 0; i < probe.length; i++) {
      const s = toneStats(fs, probe, i, lag);
      if (s.blocks >= LEAK_CHECK.minBlocks) score += db(s.own, s.near);
    }
    if (score > best.score + 1e-9) best = { lag, score };
  }

  const tones = probe.map((p, i): LeakToneReading => {
    const s = toneStats(fs, probe, i, best.lag);
    const tonalDb = db(s.own, s.near);
    const q = quietOwn[i];
    const aboveQuietDb = q === null || q === undefined ? tonalDb : db(s.own, q);
    const aloneDb = s.others.length
      ? Math.min(...s.others.map((o) => db(s.own, o)))
      : Number.POSITIVE_INFINITY;
    const present =
      s.blocks >= LEAK_CHECK.minBlocks &&
      tonalDb >= LEAK_CHECK.tonalDb &&
      aboveQuietDb >= LEAK_CHECK.aboveQuietDb &&
      aloneDb >= LEAK_CHECK.aloneDb;
    const toneAmp2 = Math.max(0, s.own - s.near);
    const levelDb = present ? rmsDb(Math.sqrt(toneAmp2 / 2)) : Number.NEGATIVE_INFINITY;
    return {
      hz: p.hz,
      blocks: s.blocks,
      tonalDb,
      aboveQuietDb,
      aloneDb,
      levelDb,
      present,
      heard: present && levelDb >= gateDb - LEAK_CHECK.headroomDb,
    };
  });
  const present = tones.filter((t) => t.present);
  return {
    heard: tones.filter((t) => t.heard).length >= LEAK_CHECK.minTones,
    lagSec: present.length ? best.lag : null,
    floorDb,
    gateDb,
    leakDb: present.length ? Math.max(...present.map((t) => t.levelDb)) : null,
    tones,
  };
}
