// The measurements of the voice set-up wizard (contracts §8.6; U00.L02 and /settings/voice/setup):
// output check (L/R), devices, noise floor, bleed test, tap latency (16 clicks), sing latency (8 clicks),
// range sweep and pitch-match trials. The maths lives in @oak/pitch; this file schedules sound, opens the
// mic for exactly as long as a step needs and closes it again.
import type { PitchFrame, SungTarget } from "@oak/pitch";
import {
  calibrateTapLatency,
  centsFrom,
  detectBleed,
  estimateRange,
  median,
  PitchTracker,
  pitchFramesToNotes,
  rmsDb,
  WINDOW_SIZE,
} from "@oak/pitch";
import { LEAK_CHECK, leakCheck, leakProbe, type MicBlock } from "./bleed.ts";
import { detectDevices } from "./devices.ts";
import type {
  BleedCheck,
  Calibration,
  CalibrationDeps,
  MicSession,
  QuietCheck,
  RangeResult,
  TapLatencyResult,
} from "./types.ts";

/** Step lengths and counts (seconds unless stated). Exposed for the wizard's progress copy and for tests. */
export const CALIBRATION = {
  leadIn: 1,
  tapClicks: 16,
  tapSpacing: 0.6,
  singClicks: 8,
  singSpacing: 0.75,
  noiseFloorSec: 3,
  bleedTones: LEAK_CHECK.tones, // A5 880 Hz, D6 1175 Hz, G6 1568 Hz (bleed.ts)
  bleedToneSec: LEAK_CHECK.toneSec,
  rangeSweepSec: 10,
  pitchMatchToneSec: 1,
  pitchMatchSingSec: 2.5,
  /** Above this the tap-latency card says timing grades will be more forgiving. */
  highTapLatencyMs: 120,
} as const;

/**
 * Waits until the context clock reaches `t` (polling: AudioContext has no timer of its own), or until `signal`
 * aborts (the learner pressed Stop).
 */
export async function waitUntil(
  ctx: Pick<BaseAudioContext, "currentTime">,
  t: number,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  signal?: AbortSignal,
): Promise<void> {
  for (let guard = 0; ctx.currentTime < t && guard < 100_000 && signal?.aborted !== true; guard++) {
    await sleep(Math.min(50, Math.max(5, (t - ctx.currentTime) * 1000)));
  }
}

/** Plays a sine at `hz`, panned fully left (−1) or right (1), straight to the destination at −18 dBFS. */
export function playPannedTone(ctx: AudioContext, hz: number, pan: -1 | 1, at: number, dur: number): void {
  const osc = ctx.createOscillator();
  osc.frequency.value = hz;
  const gain = ctx.createGain();
  const peak = 10 ** (-18 / 20);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.02);
  gain.gain.setValueAtTime(peak, at + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0, at + dur);
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  osc.connect(gain).connect(panner).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.01);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    panner.disconnect();
  };
}

/** Median MIDI of the voiced frames whose window centre lies inside [from, to], or null with fewer than 10. */
function medianMidiIn(
  frames: readonly PitchFrame[],
  from: number,
  to: number,
  sampleRate: number,
): number | null {
  const tracker = new PitchTracker();
  const half = WINDOW_SIZE / 2 / sampleRate;
  const voiced: number[] = [];
  for (const f of frames) {
    const m = tracker.push(f).midi;
    const tc = f.t - half;
    if (m !== null && tc >= from && tc <= to) voiced.push(m);
  }
  return voiced.length >= 10 ? median(voiced) : null;
}

/**
 * A quiet check: the median frame level (the noise floor) and how much of it was a voice. Someone humming or
 * talking through the check would set the floor at their own voice, and every later take would then be cut by
 * the voicing gate (floor + 12 dB) and read as "no voice" (Wave 2, known gap 9). The wizard measures again
 * when `voiced` is true instead of storing that floor.
 */
export function quietCheckOf(frames: readonly PitchFrame[]): QuietCheck {
  const levels = frames.map((f) => rmsDb(f.rms)).filter(Number.isFinite);
  const floorDb = levels.length > 0 ? median(levels) : -120;
  const tracker = new PitchTracker();
  let voicedFrames = 0;
  for (const f of frames) if (tracker.push(f).voiced) voicedFrames++;
  const hop =
    frames.length > 1
      ? ((frames.at(-1) as PitchFrame).t - (frames[0] as PitchFrame).t) / (frames.length - 1)
      : 0;
  const voicedSec = voicedFrames * hop;
  return {
    floorDb,
    voicedSec,
    voiced: voicedSec >= QUIET_VOICE_SEC || (frames.length > 0 && voicedFrames / frames.length >= 0.15),
  };
}
/** A voice this long during the quiet check spoils it. */
export const QUIET_VOICE_SEC = 0.3;

/** Raw mic samples for the leak check: an AnalyserNode on the session's source, read on each poll. */
function listenRaw(
  ctx: Pick<BaseAudioContext, "currentTime">,
  s: MicSession,
): { poll(): void; blocks: MicBlock[]; close(): void } | null {
  const make = (ctx as Partial<Pick<BaseAudioContext, "createAnalyser">>).createAnalyser;
  if (!s.tap || typeof make !== "function") return null;
  const analyser = make.call(ctx);
  analyser.fftSize = LEAK_CHECK.blockSize;
  analyser.smoothingTimeConstant = 0;
  const off = s.tap(analyser);
  const blocks: MicBlock[] = [];
  return {
    blocks,
    poll() {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      blocks.push({ t: ctx.currentTime, samples });
    },
    close: off,
  };
}

export interface CalibrationExtras {
  /** For tests: replaces `setTimeout` polling. */
  sleep?: (ms: number) => Promise<void>;
  /** Plays the panned L/R tones; default `playPannedTone` on `deps.ctx`. */
  playPanned?: (hz: number, pan: -1 | 1, at: number, dur: number) => void;
}

export function createCalibration(deps: CalibrationDeps & CalibrationExtras): Calibration {
  const { ctx, mic } = deps;
  const sleep = deps.sleep;
  const wait = (t: number, signal?: AbortSignal) => waitUntil(ctx, t, sleep, signal);
  const panned = deps.playPanned ?? ((hz, pan, at, dur) => playPannedTone(ctx, hz, pan, at, dur));

  /** Opens the mic, runs `body`, always closes it. */
  async function withMic<T>(body: (s: MicSession) => Promise<T>): Promise<T> {
    await mic.prepare();
    const s = await mic.open();
    try {
      return await body(s);
    } finally {
      s.close();
    }
  }

  async function noiseCheck(seconds: number = CALIBRATION.noiseFloorSec): Promise<QuietCheck> {
    return withMic(async (s) => {
      const from = ctx.currentTime + 0.2; // skip the first window after the stream opens
      await wait(from + seconds);
      return quietCheckOf(s.frames().filter((f) => f.t >= from));
    });
  }

  /**
   * The headphone-leak check (bleed.ts): a short silence, then the three test tones through Oak's own output
   * with the mic open. Heard when the tones stand out in the raw mic samples (`leakCheck`), or when the pitch
   * tracker hears them as notes (`detectBleed`, the older check, kept: it is what grading sees).
   */
  async function bleedCheck(): Promise<BleedCheck> {
    return withMic(async (s) => {
      const raw = listenRaw(ctx, s);
      const probe = leakProbe(ctx.currentTime);
      for (const p of probe) deps.playTone(p.midi, p.on, p.off - p.on);
      const end = (probe.at(-1) as (typeof probe)[number]).off + LEAK_CHECK.maxLagSec + 0.05;
      const pause = sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
      try {
        for (let guard = 0; ctx.currentTime < end && guard < 100_000; guard++) {
          await pause(LEAK_CHECK.pollMs);
          raw?.poll();
        }
      } finally {
        raw?.close();
      }
      const byPitch = detectBleed(
        s.frames(),
        probe.map((p): SungTarget => ({ midi: p.midi, on: p.on, off: p.off })),
      );
      const tones = raw ? leakCheck(raw.blocks, probe, ctx.sampleRate) : null;
      return { heard: byPitch || tones?.heard === true, byPitch, tones };
    });
  }

  return {
    async outputCheck() {
      const t = ctx.currentTime + 0.1;
      panned(440, -1, t, 0.8);
      panned(660, 1, t + 1.2, 0.8);
      await wait(t + 2.1);
    },

    devices: () => detectDevices(ctx),

    async noiseFloor(seconds = CALIBRATION.noiseFloorSec) {
      return (await noiseCheck(seconds)).floorDb;
    },

    noiseCheck,

    bleedCheck,

    async bleedTest() {
      return (await bleedCheck()).heard;
    },

    async tapLatency(taps, onClick, signal) {
      const start = ctx.currentTime + CALIBRATION.leadIn;
      const clicks = Array.from(
        { length: CALIBRATION.tapClicks },
        (_, i) => start + i * CALIBRATION.tapSpacing,
      );
      for (const at of clicks) deps.playClick(at);
      const end = (clicks[clicks.length - 1] as number) + 0.6;
      const got: number[] = [];
      const it = taps[Symbol.asyncIterator]();
      let reported = -1;
      const progress = () => {
        if (!onClick) return;
        while (reported + 1 < clicks.length && (clicks[reported + 1] as number) <= ctx.currentTime)
          onClick(++reported);
      };
      // Consume taps until the last click has passed, reporting click progress on the way.
      for (;;) {
        progress();
        if (ctx.currentTime >= end || signal?.aborted === true) break;
        const next = await Promise.race([
          it.next(),
          (sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(50).then(() => null),
        ]);
        if (next === null) continue;
        if (next.done) {
          await wait(end, signal);
          break;
        }
        got.push(next.value);
      }
      // After a Stop the source may still be waiting for a tap: close it without waiting on it.
      if (signal?.aborted === true) void it.return?.();
      else await it.return?.();
      progress();
      const r = calibrateTapLatency(got, clicks);
      const result: TapLatencyResult = {
        latencyMs: r.latencyMs,
        jitterMs: r.jitterMs,
        taps: got.length,
        high: r.latencyMs > CALIBRATION.highTapLatencyMs,
      };
      return result;
    },

    async singLatency(onClick, signal) {
      return withMic(async (s) => {
        const start = ctx.currentTime + CALIBRATION.leadIn;
        const clicks = Array.from(
          { length: CALIBRATION.singClicks },
          (_, i) => start + i * CALIBRATION.singSpacing,
        );
        for (const at of clicks) deps.playClick(at);
        let reported = -1;
        const end = (clicks[clicks.length - 1] as number) + 0.7;
        while (ctx.currentTime < end && signal?.aborted !== true) {
          await wait(Math.min(end, ctx.currentTime + 0.05), signal);
          while (
            onClick &&
            reported + 1 < clicks.length &&
            (clicks[reported + 1] as number) <= ctx.currentTime
          ) {
            onClick(++reported);
          }
        }
        // Note starts are already at the window centre; their offset from the clicks is the sing latency.
        const notes = pitchFramesToNotes(s.frames(), {
          minNoteSec: 0.07,
          windowSec: WINDOW_SIZE / s.sampleRate,
        });
        return calibrateTapLatency(
          notes.map((n) => n.start),
          clicks,
        ).latencyMs;
      });
    },

    async rangeSweep(onFrame, signal) {
      return withMic(async (s) => {
        const off = onFrame ? s.onFrame(onFrame) : null;
        await wait(ctx.currentTime + CALIBRATION.rangeSweepSec, signal);
        off?.();
        const r = estimateRange(s.frames());
        if (!r) throw new RangeError("@oak/audio: the range sweep heard no sustained voice");
        const result: RangeResult = {
          lowMidi: r.low,
          highMidi: r.high,
          comfortLowMidi: r.comfLow,
          comfortHighMidi: r.comfHigh,
        };
        return result;
      });
    },

    async pitchMatch(targets) {
      return withMic(async (s) => {
        const errors: number[] = [];
        for (const midi of targets) {
          const t = ctx.currentTime + 0.3;
          deps.playTone(midi, t, CALIBRATION.pitchMatchToneSec);
          const singFrom = t + CALIBRATION.pitchMatchToneSec + 0.3;
          const singTo = singFrom + CALIBRATION.pitchMatchSingSec;
          await wait(singTo + 0.1);
          const sung = medianMidiIn(s.frames(), singFrom, singTo, s.sampleRate);
          errors.push(sung === null ? Number.NaN : centsFrom(sung, midi, true));
        }
        return errors;
      });
    },
  };
}
