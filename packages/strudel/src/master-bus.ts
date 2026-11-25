// The master bus (architecture §6.5, spikes/s3-sounds/src/oak-audio.ts):
//
//   superdough destinationGain ─┐
//   transcription player ───────┼─▶ input ─▶ limiter ─▶ trim ─┬─▶ volume ─▶ ctx.destination
//                               │     └─▶ preAnalyser         ├─▶ analyser (meter, Oak scope)
//                               │                             └─▶ tapGain ─▶ tap (MediaStream, the recorder)
//
// Oak 2.0 W1: `volume ─▶ listen-through stage ─▶ ctx.destination` (listen-through.ts). The stage is a pass-through
// unless the learner turns it on; it sits after the analyser and record-tap branches, so a muffled or quiet listen
// never reaches a meter reading or a recording.
//
// The DynamicsCompressor adds makeup gain even below threshold; `trim` undoes it. superdough rebuilds
// `destinationGain` on `resetGlobalEffects()` and connects it straight to the destination, so the bus
// hooks `initializeAudio` of the controller's output and re-attaches.
import * as webaudio from "@strudel/webaudio";
import { listenStage } from "./listen-through.ts";
import type { MasterBus } from "./types.ts";

export const LIMITER = { threshold: -3, knee: 0, ratio: 20, attack: 0.003, release: 0.1 } as const;

/** Makeup gain the compressor applies, in dB: `−(threshold − threshold / ratio) × 0.6`. */
export function limiterMakeupDb(
  threshold: number = LIMITER.threshold,
  ratio: number = LIMITER.ratio,
): number {
  return -(threshold - threshold / ratio) * 0.6;
}

export interface MasterBusInternals extends MasterBus {
  /** Route superdough's destinationGain into the bus (after `initAudio`). Idempotent. */
  attachSuperdough(): void;
  /** The recorder's own level before the tap: a take fades out on it, never what the listener hears. */
  readonly tapGain: GainNode;
  /** Duck the input to silence for `ms`, then restore: cuts every ringing voice (panic). */
  duck(ms?: number): void;
  dispose(): void;
}

interface SuperdoughOutputLike {
  destinationGain: GainNode | null;
  initializeAudio(): void;
  __oakHooked?: boolean;
}

export function levelOf(
  analyser: AnalyserNode,
  buf = new Float32Array(analyser.fftSize),
): { rms: number; peak: number } {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  let peak = 0;
  for (const x of buf) {
    sum += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  return { rms: Math.sqrt(sum / buf.length), peak };
}

export function createMasterBus(ctx: AudioContext): MasterBusInternals {
  const input = new GainNode(ctx, { gain: 1 });
  const limiter = new DynamicsCompressorNode(ctx, LIMITER);
  const trim = new GainNode(ctx, { gain: 10 ** (-limiterMakeupDb() / 20) });
  const volume = new GainNode(ctx, { gain: 1 });
  const analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  const preAnalyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  const tap = ctx.createMediaStreamDestination();
  const tapGain = new GainNode(ctx, { gain: 1 });
  const listen = listenStage(ctx);
  input.connect(limiter);
  input.connect(preAnalyser);
  limiter.connect(trim);
  trim.connect(volume);
  volume.connect(listen.input);
  listen.output.connect(ctx.destination);
  trim.connect(analyser);
  trim.connect(tapGain);
  tapGain.connect(tap);

  let attached = 0;
  let attachedGain: GainNode | null = null;
  let output: SuperdoughOutputLike | null = null;
  const levelBuf = new Float32Array(analyser.fftSize);

  const attach = (): void => {
    const gain = output?.destinationGain;
    if (!gain || gain === attachedGain) return;
    try {
      gain.disconnect(); // was: -> ctx.destination
    } catch {
      // not connected
    }
    gain.connect(input);
    attachedGain = gain;
    attached++;
  };

  return {
    input,
    limiter,
    trim,
    analyser,
    preAnalyser,
    tap,
    tapGain,
    setVolume(v) {
      const value = Math.max(0, Math.min(1, v));
      volume.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
    },
    level: () => levelOf(analyser, levelBuf),
    attachCount: () => attached,
    setListenThrough(mode) {
      listen.set(mode);
    },
    listenThrough: () => listen.mode,
    attachSuperdough() {
      const controller = webaudio.getSuperdoughAudioController() as { output: SuperdoughOutputLike };
      output = controller.output;
      if (!output.__oakHooked) {
        const original = output.initializeAudio.bind(output);
        const self = output;
        self.initializeAudio = () => {
          original();
          if (output === self) attach();
        };
        self.__oakHooked = true;
      }
      attach();
    },
    duck(ms = 60) {
      const t = ctx.currentTime;
      input.gain.cancelScheduledValues(t);
      input.gain.setValueAtTime(input.gain.value, t);
      input.gain.linearRampToValueAtTime(0, t + 0.01);
      input.gain.setValueAtTime(0, t + ms / 1000);
      input.gain.linearRampToValueAtTime(1, t + ms / 1000 + 0.01);
    },
    dispose() {
      listen.dispose();
      for (const node of [input, limiter, trim, volume, analyser, preAnalyser, tapGain, tap]) {
        try {
          node.disconnect();
        } catch {
          // already gone
        }
      }
    },
  };
}
