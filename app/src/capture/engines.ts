// Oak 2.0 W1: the capture engines (tap to notation, hum from a recording), behind a registry so the capture dialog
// compiles before they exist. `null` until the W1 integrator wires them (stage A); the dialog then offers tap and
// voice memo.
import type { HumToDraftOptions, HumToDraftResult } from "@oak/pitch";

export interface CaptureEngines {
  /** Tap onsets (seconds) to a mini-notation rhythm on a grid; `dropped` taps did not fit, `pickup` if it starts early. */
  tapsToMini(
    onsetsSec: readonly number[],
    bpm: number,
    opts?: { grid?: 8 | 12 | 16; bars?: number; beatsPerBar?: 2 | 3 | 4 },
  ): { mini: string; bars: number; dropped: number; pickup: boolean };
  /** A mono recording to a hum draft, as `humToDraft` does for a live hum. */
  humFromPcm(
    pcm: Float32Array,
    sampleRate: number,
    opts: HumToDraftOptions & { normalizeDb?: number },
  ): HumToDraftResult;
}

export function captureEngines(): CaptureEngines | null {
  return null;
}
