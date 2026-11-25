import { PitchFrameAnalyzer } from "./detector.ts";
import { type HumToDraftOptions, type HumToDraftResult, humToDraft } from "./hum.ts";
import type { PitchFrame } from "./types.ts";

export interface HumFromPcmOptions extends HumToDraftOptions {
  /** The peak level the recording is scaled to before analysis, in dBFS. Default -3 (Oak's call). */
  normalizeDb?: number;
}

/** Largest gain the normalisation applies, in dB (Oak's call): a near-silent file is not blown up into noise. */
export const HUM_PCM_MAX_GAIN_DB = 30;

/**
 * "Hum it, Oak drafts it" from a recording: mono PCM on the recording's own clock (time 0 = its first sample),
 * through the live path's frame analyser, tracker and draft. `opts.downbeat` is in seconds of the recording.
 */
export function humFromPcm(pcm: Float32Array, sampleRate: number, opts: HumFromPcmOptions): HumToDraftResult {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError("humFromPcm: sample rate must be between 8000 and 192000 Hz");
  }
  const { normalizeDb = -3, ...rest } = opts;
  if (!Number.isFinite(normalizeDb) || normalizeDb > 0) {
    throw new RangeError("humFromPcm: normalisation level must be finite and at most 0 dBFS");
  }
  if (pcm.length === 0) return humToDraft([], rest);

  const signal = new Float32Array(pcm);
  let peak = 0;
  for (const sample of signal) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) {
    const gain = Math.min(10 ** (normalizeDb / 20) / peak, 10 ** (HUM_PCM_MAX_GAIN_DB / 20));
    for (let i = 0; i < signal.length; i++) signal[i] = (signal[i] as number) * gain;
  }

  const analyzer = new PitchFrameAnalyzer(sampleRate);
  const frames: PitchFrame[] = [];
  // Keep the live worklet's block clock, including any samples left at the end of the memo.
  for (let i = 0; i < signal.length; i += 128) {
    for (const frame of analyzer.push(signal.subarray(i, i + 128), i / sampleRate)) frames.push(frame);
  }
  return humToDraft(frames, rest);
}
