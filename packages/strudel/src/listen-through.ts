// Oak 2.0 W1 (PLAN S4, listen-through): hear the mix as from another room, on a small speaker, or very quietly. A
// stage on the master bus after `volume` and before the speakers only, so the analyser, the meters and the record
// tap never hear it (master-bus.ts). It changes what is heard, never the code, and is off (a plain pass-through)
// unless the learner turns it on.
import type { ListenThroughMode } from "./types.ts";

export interface ListenThroughSetting {
  /** A lowpass at this frequency, or none. */
  lowpassHz: number | null;
  /** A highpass at this frequency, or none. */
  highpassHz: number | null;
  /** Level change in dB. */
  gainDb: number;
}

/**
 * Oak's call, loose, never shown as numbers: "muffled" is a wall away (only the low end gets through), "small
 * speaker" a phone or laptop speaker (no low bass, no air, a bit quieter), "quiet" the same mix turned well down.
 */
export const LISTEN_THROUGH: Readonly<Record<ListenThroughMode, Readonly<ListenThroughSetting>>> = {
  muffled: { lowpassHz: 700, highpassHz: null, gainDb: 0 },
  "small-speaker": { lowpassHz: 4000, highpassHz: 400, gainDb: -6 },
  quiet: { lowpassHz: null, highpassHz: null, gainDb: -24 },
};

export const LISTEN_THROUGH_MODES = Object.keys(LISTEN_THROUGH) as ListenThroughMode[];

export interface ListenStage {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** `null`: pass-through (unity gain, no filter in the path). */
  set(mode: ListenThroughMode | null): void;
  readonly mode: ListenThroughMode | null;
  dispose(): void;
}

const dbToGain = (db: number): number => 10 ** (db / 20);

/**
 * `input → [lowpass] → [highpass] → output`: only the filters the mode uses are in the path; with no mode the input
 * goes straight to the output at unity gain.
 */
export function listenStage(ctx: BaseAudioContext): ListenStage {
  const input = new GainNode(ctx, { gain: 1 });
  const output = new GainNode(ctx, { gain: 1 });
  const lowpass = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 20000, Q: Math.SQRT1_2 });
  const highpass = new BiquadFilterNode(ctx, { type: "highpass", frequency: 20, Q: Math.SQRT1_2 });
  let mode: ListenThroughMode | null = null;

  const unplug = (node: AudioNode): void => {
    try {
      node.disconnect();
    } catch {
      // not connected
    }
  };

  const wire = (): void => {
    unplug(input);
    unplug(lowpass);
    unplug(highpass);
    const setting = mode ? LISTEN_THROUGH[mode] : null;
    let last: AudioNode = input;
    if (setting?.lowpassHz != null) {
      lowpass.frequency.value = setting.lowpassHz;
      last.connect(lowpass);
      last = lowpass;
    }
    if (setting?.highpassHz != null) {
      highpass.frequency.value = setting.highpassHz;
      last.connect(highpass);
      last = highpass;
    }
    last.connect(output);
    output.gain.value = setting ? dbToGain(setting.gainDb) : 1;
  };
  wire();

  return {
    input,
    output,
    get mode() {
      return mode;
    },
    set(next) {
      if (next !== null && !(next in LISTEN_THROUGH)) return;
      mode = next;
      wire();
    },
    dispose() {
      for (const node of [input, lowpass, highpass, output]) unplug(node);
    },
  };
}
