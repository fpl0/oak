// Oak 2.0 W1: the capture engines (tap to notation, hum from a recording), behind a registry so the capture dialog
// compiles before they exist. Wired in stage A (X5 `tapsToMini`, X8 `humFromPcm`); the dialog offers tap and voice
// memo when this returns non-null. `tapsToMini` comes from its own subpath so this module never loads the mic worklet.
import { tapsToMini } from "@oak/audio/tap-notation";
import { type HumToDraftOptions, type HumToDraftResult, humFromPcm } from "@oak/pitch";

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

const ENGINES: CaptureEngines = { tapsToMini, humFromPcm };

export function captureEngines(): CaptureEngines | null {
  return ENGINES;
}
